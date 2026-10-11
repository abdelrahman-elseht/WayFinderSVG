"""First-floor approaches and horizontal graph, bounded by reviewed source ink."""
import heapq
import math
from collections import defaultdict
import numpy as np
from shapely.geometry import Point, LineString, Polygon, box
from shapely.ops import unary_union, nearest_points
from shapely import contains_xy, covers, linestrings, constrained_delaunay_triangles, set_precision


def pieces(g):
    if g.geom_type == 'Polygon':
        return [g]
    return [p for part in getattr(g, 'geoms', []) for p in pieces(part)]


def derive(rooms, context, cfg):
    prefix = cfg['buildingId'] + '-' + cfg['floorId']
    spines = unary_union([LineString(p) for p in cfg['corridorSpines']])
    region = unary_union([LineString(p).buffer(cfg['corridorHalfWidth'], cap_style=2, join_style=2) for p in cfg['corridorSpines']])
    # Display faces include omitted obstruction holes. Exclude their full solids
    # and ALL bounded non-circulation labelled faces (including rejected aliases).
    solids = [Polygon(r['polygon']).buffer(.3) for r in rooms if r['polygon'] and r['code'] not in cfg['circulationCodes']]
    for face in context['polys']:
        occupants = {l['code'] for l in context['labels'] if face.contains(Point(l['point']))}
        if face.area < 400000 and occupants and not occupants.issubset(cfg['circulationCodes']):
            solids.append(face.buffer(.3))
    solids += [Polygon(p) for p in cfg.get('voidExclusions', [])]
    wall = unary_union(context['walls'])
    # Structural walls remain obstacles, except at explicit source door
    # openings. This keeps thresholds routable without turning arbitrary wall
    # contacts into walkable space.
    safe = context['frame'].difference(unary_union(solids)).difference(wall.buffer(.8, join_style=2))
    door_opening_clearance = max(2, cfg['corridorHalfWidth'] / 6)
    door_openings = unary_union([s['line'].buffer(door_opening_clearance, cap_style=2, join_style=2) for s in context['seals']])
    door_safe = safe.union(door_openings)
    domain = region.intersection(door_safe)

    # Reviewed spine traces omit some short landings. Extend a spine to a
    # source-derived door only when the connector stays in source-safe space
    # (with the explicit door opening exemption above). The limit scales with
    # the reviewed corridor width rather than using floor coordinates.
    bridge_limit = cfg['corridorHalfWidth'] * 8
    landing_bridges = []
    for seal in context['seals']:
        center = Point([(seal['portal'][0][j] + seal['portal'][1][j]) / 2 for j in range(2)])
        target = spines.interpolate(spines.project(center))
        connector = LineString([center, target])
        if connector.length <= bridge_limit and door_safe.covers(connector):
            domain = domain.union(connector.buffer(cfg['corridorHalfWidth'], cap_style=2, join_style=2).intersection(door_safe))
            landing_bridges.append(dict(arcPathId=seal['id'], points=list(connector.coords), halfWidth=cfg['corridorHalfWidth']))

    # If a landing connector bends around a wall, find that bend in a small
    # source-safe grid. This preserves the wall topology while allowing a
    # source-evidenced threshold to reach the reviewed corridor union.
    def safe_grid_path(start, goal):
        pad = cfg['corridorHalfWidth'] * 2
        step = max(2., cfg['corridorHalfWidth'] / 12)
        minx = math.floor((min(start[0], goal[0]) - pad) / step) * step
        miny = math.floor((min(start[1], goal[1]) - pad) / step) * step
        maxx = math.ceil((max(start[0], goal[0]) + pad) / step) * step
        maxy = math.ceil((max(start[1], goal[1]) + pad) / step) * step
        nx = int((maxx - minx) / step) + 1; ny = int((maxy - miny) / step) + 1
        def point(k): return [minx + (k % nx) * step, miny + (k // nx) * step]
        xx, yy = np.meshgrid(np.arange(nx) * step + minx, np.arange(ny) * step + miny)
        mask = contains_xy(door_safe, xx, yy)
        def nearest_grid(p):
            choices = []
            ix = round((p[0] - minx) / step); iy = round((p[1] - miny) / step)
            radius = max(4, int(math.ceil(pad / step)) + 2)
            for dy in range(-radius, radius + 1):
                for dx in range(-radius, radius + 1):
                    x, y = ix + dx, iy + dy
                    if 0 <= x < nx and 0 <= y < ny and mask[y, x]:
                        k = y * nx + x
                        if door_safe.covers(LineString([p, point(k)])):
                            choices.append((math.dist(p, point(k)), k))
            return min(choices)[1] if choices else None
        source = nearest_grid(start); target = nearest_grid(goal)
        if source is None or target is None: return None
        queue = [(0., source)]; distances = {source: 0.}; parents = {source: None}
        while queue:
            cost, current = heapq.heappop(queue)
            if cost != distances[current]: continue
            if current == target: break
            x, y = current % nx, current // nx
            for dx, dy in ((1, 0), (0, 1), (1, 1), (-1, 1), (-1, 0), (0, -1), (1, -1), (-1, -1)):
                tx, ty = x + dx, y + dy
                if not (0 <= tx < nx and 0 <= ty < ny): continue
                nxt = ty * nx + tx
                if not mask[ty, tx]: continue
                segment = LineString([point(current), point(nxt)])
                if not door_safe.covers(segment): continue
                step_cost = segment.length
                if cost + step_cost < distances.get(nxt, math.inf):
                    distances[nxt] = cost + step_cost; parents[nxt] = current
                    heapq.heappush(queue, (cost + step_cost, nxt))
        if target not in parents: return None
        path = []; current = target
        while current is not None:
            path.append(point(current)); current = parents[current]
        path.reverse(); path[0] = list(start); path[-1] = list(goal)
        return path

    for room in rooms:
        if room['code'] in cfg['excludedRoomCodes'] or room['code'] in cfg['circulationCodes']:
            continue
        face = next((p for p in context['polys'] if p.contains(Point(room['centroid'])) and p.area < 400000), None)
        if face is None: continue
        candidate_seals = [s for s in context['seals'] if face.boundary.distance(s['line']) <= 1]
        if not candidate_seals: continue
        seal = min(candidate_seals, key=lambda s: s['line'].distance(Point(room['centroid'])))
        a, b = seal['portal']; length = math.dist(a, b)
        normal = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length]
        center = [(a[j] + b[j]) / 2 for j in range(2)]
        approaches = [[center[j] + sign * offset * normal[j] for j in range(2)] for offset in (2, 4, 6, 10, 15, 22) for sign in (-1, 1)]
        approach = next((p for p in approaches if door_safe.covers(Point(p)) and not face.covers(Point(p))), None)
        if approach is None or domain.covers(Point(approach)): continue
        target = nearest_points(Point(approach), domain)[1]
        path = safe_grid_path(approach, list(target.coords)[0])
        if path and door_safe.covers(LineString(path)):
            domain = domain.union(LineString(path).buffer(1.5, cap_style=2, join_style=2).intersection(door_safe))
            landing_bridges.append(dict(arcPathId=seal['id'], points=path, halfWidth=1.5))

    if domain.geom_type == 'MultiPolygon' and len(domain.geoms) > 1:
        main = max(domain.geoms, key=lambda part: part.area)
        for room in rooms:
            if room['code'] in cfg['excludedRoomCodes'] or room['code'] in cfg['circulationCodes']:
                continue
            face = next((p for p in context['polys'] if p.contains(Point(room['centroid'])) and p.area < 400000), None)
            if face is None: continue
            seals = [s for s in context['seals'] if face.boundary.distance(s['line']) <= 1]
            if not seals: continue
            seal = min(seals, key=lambda s: s['line'].distance(Point(room['centroid'])))
            a, b = seal['portal']; length = math.dist(a, b)
            normal = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length]
            center = [(a[j] + b[j]) / 2 for j in range(2)]
            approach = next(([center[j] + sign * offset * normal[j] for j in range(2)] for offset in (2, 4, 6, 10, 15, 22) for sign in (-1, 1)
                if door_safe.covers(Point([center[j] + sign * offset * normal[j] for j in range(2)]))
                and not face.covers(Point([center[j] + sign * offset * normal[j] for j in range(2)]))), None)
            if approach is None or not domain.covers(Point(approach)) or main.covers(Point(approach)):
                continue
            target = nearest_points(Point(approach), main)[1]
            path = safe_grid_path(approach, list(target.coords)[0])
            if path and door_safe.covers(LineString(path)):
                domain = domain.union(LineString(path).buffer(1.5, cap_style=2, join_style=2).intersection(door_safe))
                landing_bridges.append(dict(arcPathId=seal['id'], points=path, halfWidth=1.5))

    domain = set_precision(domain, .01).simplify(.01, preserve_topology=True)
    minx, miny, maxx, maxy = domain.bounds
    step = 3.; ox = math.floor(minx/step)*step; oy = math.floor(miny/step)*step
    nx = int((maxx-ox)/step)+2; ny = int((maxy-oy)/step)+2
    xx, yy = np.meshgrid(np.arange(nx)*step+ox, np.arange(ny)*step+oy)
    mask = contains_xy(domain, xx, yy)
    def pos(k):
        return [ox+(k % nx)*step, oy+(k // nx)*step]
    def nearest(p):
        ix = round((p[0]-ox)/step); iy = round((p[1]-oy)/step)
        choices = []
        for dy in range(-40, 41):
            for dx in range(-40, 41):
                x, y = ix+dx, iy+dy
                if 0 <= x < nx and 0 <= y < ny and mask[y, x]:
                    k = y*nx+x
                    line = LineString([p, pos(k)])
                    if domain.covers(line):
                        choices.append((line.length, k))
        return min(choices)[1] if choices else None
    keys = np.flatnonzero(mask); gx = keys % nx; gy = keys // nx
    adjacency = {int(k): [] for k in keys}
    clearance = {k: domain.boundary.distance(Point(pos(k))) for k in adjacency}
    for dx, dy in [(1, 0), (0, 1), (1, 1), (-1, 1)]:
        ax, ay = gx+dx, gy+dy
        inside = (ax >= 0) & (ax < nx) & (ay >= 0) & (ay < ny)
        starts, ends = keys[inside], ay[inside]*nx+ax[inside]
        valid = mask.ravel()[ends]; starts, ends = starts[valid], ends[valid]
        coords = np.array([[pos(int(a)), pos(int(b))] for a, b in zip(starts, ends)])
        valid = covers(domain, linestrings(coords))
        length = step*math.hypot(dx, dy)
        for a, b in zip(starts[valid], ends[valid]):
            a, b = int(a), int(b)
            cost = length*(1+8/max(min(clearance[a], clearance[b]), .25))
            adjacency[a].append((b, cost, length)); adjacency[b].append((a, cost, length))
    component_sizes = {}
    seen_grid = set()
    for root in adjacency:
        if root in seen_grid: continue
        stack = [root]; seen_grid.add(root); members = []
        while stack:
            current = stack.pop(); members.append(current)
            for neighbor, _, _ in adjacency[current]:
                if neighbor not in seen_grid:
                    seen_grid.add(neighbor); stack.append(neighbor)
        for member in members: component_sizes[member] = len(members)
    def shortest(start):
        costs = {start: 0.}; lengths = {start: 0.}; parents = {start: None}; queue = [(0., start)]
        while queue:
            score, current = heapq.heappop(queue)
            if score != costs[current]:
                continue
            for target, cost, length in adjacency[current]:
                candidate = score+cost
                if candidate < costs.get(target, math.inf):
                    costs[target] = candidate; lengths[target] = lengths[current]+length; parents[target] = current
                    heapq.heappush(queue, (candidate, target))
        return lengths, parents
    endpoints, evidence, missing = [], [], []
    for room in rooms:
        code = room['code']; point = room['centroid']
        if code in cfg['excludedRoomCodes']:
            room['navigationNote'] = cfg['unsupportedNotes'][code]
            missing.append(dict(code=code, reason='Conflicting source identity; no approach commissioned.'))
            continue
        options = []
        source = None
        if code in cfg['circulationCodes']:
            approach = list(nearest_points(spines, Point(point))[0].coords)[0]
            if math.dist(approach, point) < cfg['corridorHalfWidth'] and domain.covers(Point(approach)):
                k = nearest(approach)
                if k is not None:
                    # Use the constrained corridor grid, not the room label anchor.
                    options.append((-component_sizes.get(k, 0), math.dist(approach, point), None, pos(k), k))
        else:
            face = next((p for p in context['polys'] if p.contains(Point(point)) and p.area < 400000), None)
            for seal in context['seals']:
                if face is None or face.boundary.distance(seal['line']) > 1:
                    continue
                a, b = seal['portal']; center = [(a[j]+b[j])/2 for j in range(2)]
                length = math.dist(a, b); normal = [-(b[1]-a[1])/length, (b[0]-a[0])/length]
                for offset in (2, 4, 6, 10, 15, 22):
                    for sign in (-1, 1):
                        approach = [center[j]+sign*offset*normal[j] for j in range(2)]
                        if domain.covers(Point(approach)) and not face.covers(Point(approach)):
                            k = nearest(approach)
                            if k is not None:
                                options.append((-component_sizes.get(k, 0), offset, seal['id'], approach, k))
        override = cfg['endpointOverrides'].get(code)
        if override:
            options = []
            seal = next(s for s in context['seals'] if s['id'] == override['arcPathId'])
            a, b = seal['portal']; center = [(a[j]+b[j])/2 for j in range(2)]
            length = math.dist(a, b); normal = [-(b[1]-a[1])/length, (b[0]-a[0])/length]
            for offset in (2, 4, 6, 10, 15, 22):
                for sign in (-1, 1):
                    approach = [center[j]+sign*offset*normal[j] for j in range(2)]
                    if domain.covers(Point(approach)):
                        k = nearest(approach)
                        if k is not None:
                            options.append((-component_sizes.get(k, 0), offset, seal['id'], approach, k))
        if not options:
            if code in cfg['unsupportedNotes']:
                room['navigationNote'] = cfg['unsupportedNotes'][code]
            missing.append(dict(code=code, reason='No source portal with a covered corridor-side approach in the reviewed navigation union.'))
            continue
        _, _, arc, approach, k = min(options, key=lambda o: (o[0], o[1], o[2] or '', o[3]))
        source = next((s for s in context['seals'] if s['id'] == arc), None)
        approach = [round(v, 4) for v in approach]
        room['doorNodeId'] = room['id']+'-approach' if source else f'{prefix}-j{k}'
        room['navigationNote'] = override['note'] if override else dict(
            en='Route ends at the mapped corridor approach; doorway access and accessibility are unverified.' if source else 'Route ends at a mapped approach in this source-labelled circulation space; no physical doorway or current location is implied.',
            ar='ينتهي المسار عند نقطة الاقتراب المرسومة من الممر؛ لم يتم التحقق من الدخول أو الإتاحة.' if source else 'ينتهي المسار عند نقطة اقتراب مرسومة في مساحة الحركة المسماة بالمخطط؛ لا يعني ذلك وجود باب أو تحديد الموقع الحالي.')
        if override and override.get('partial'):
            room['navigationPartial'] = True
        provenance = f"maps/B03/01/source/{source['sourceId']}.json#{arc}" if source else f"scripts/semantic-map/floors/01.json#corridorSpines/{code}"
        room['provenance'].append(dict(source=provenance, page=1, status='candidate', note=room['navigationNote']['en']))
        endpoints.append((room, approach, k))
        evidence.append(dict(roomId=room['id'], kind='source-door-approach' if source else 'mapped-circulation-approach',
            point=approach, arcPathId=arc, leafPathId=source['leaf'] if source else None,
            sourceDoorSegment=source['portal'] if source else None, qualification=room['navigationNote'],
            sourceLabel=next(l['id'] for l in context['labels'] if l['code'] == code), override=override))
    # A rooted tree discards corridor loops and can force long detours between
    # nearby endpoints. Retain source-safe paths in increasing length order,
    # adding an alternative only when the existing network is longer than the
    # full-grid reference (apart from export rounding).
    # Degree-two grid chains are still collapsed below; spacing pixels are not
    # exported as graph nodes.
    used = defaultdict(set); reference = []; disconnected = []; candidates = []
    for i, (room, p, start) in enumerate(endpoints):
        lengths, parents = shortest(start)
        used[start]
        for other, q, target in endpoints[i+1:]:
            if target not in lengths:
                disconnected.append([room['code'], other['code']]); continue
            reference.append(dict(start=room['doorNodeId'], end=other['doorNodeId'], distance=round(math.dist(p, pos(start))+lengths[target]+math.dist(q, pos(target)), 6)))
            path = [target]
            while path[-1] != start:
                path.append(parents[path[-1]])
            candidates.append((lengths[target], start, target, path))
    def retained_distance(start, target, limit):
        queue = [(0., start)]; distances = {start: 0.}
        while queue:
            cost, current = heapq.heappop(queue)
            if cost != distances[current]: continue
            if current == target: return cost
            if cost > limit: break
            for neighbor in sorted(used[current]):
                score = cost + math.dist(pos(current), pos(neighbor))
                if score < distances.get(neighbor, math.inf):
                    distances[neighbor] = score; heapq.heappush(queue, (score, neighbor))
        return math.inf
    for length, start, target, path in sorted(candidates):
        if retained_distance(start, target, length + .01) <= length + .01:
            continue
        for a, b in zip(path, path[1:]):
            used[a].add(b); used[b].add(a)
    special = {k for _, _, k in endpoints} | {k for k, links in used.items() if len(links) != 2}
    def rnd(p):
        return [round(v, 4) for v in p]
    nodes = []
    for k in sorted(special):
        degree = len(used[k])
        nodes.append(dict(id=f'{prefix}-j{k}', buildingId='B03', floorId='01', point=rnd(pos(k)),
            type='junction', reason='junction' if degree > 2 else 'dead-end' if degree == 1 else 'turn', status='candidate'))
    for room, _, k in endpoints:
        if room['doorNodeId'] == f'{prefix}-j{k}':
            node = next(n for n in nodes if n['id'] == room['doorNodeId'])
            assert 'roomId' not in node, 'Distinct circulation identities need distinct mapped approaches'
            node['roomId'] = room['id']; node['reason'] = 'door'
    edges = []
    def add_edge(a, b, points, kind='corridor'):
        if a == b:
            return
        simplified = [points[0]]; i = 0
        while i < len(points)-1:
            j = len(points)-1
            while j > i+1 and not domain.covers(LineString([points[i], points[j]])):
                j -= 1
            simplified.append(points[j]); i = j
        simplified = [rnd(p) for p in simplified]; line = LineString(simplified)
        if line.length < .001:
            return
        # Retained geometry must be contained by the exact domain that is
        # exported as navigable areas.  A tolerance here can produce an edge
        # whose rounded endpoint falls just outside the polygon bundle.
        assert domain.covers(line) and not wall.intersects(line)
        edges.append(dict(id=f'{prefix}-e{len(edges):04}', **{'from': a, 'to': b}, floorId='01', pathType=kind,
            distance=round(line.length, 4), distanceUnit='map-unit', accessibility='unknown', restriction='unknown',
            status='candidate', bidirectional=True, geometry=simplified))
    seen = set()
    for start in sorted(special):
        for nxt in sorted(used[start]):
            if (start, nxt) in seen:
                continue
            chain = [start, nxt]; seen.update([(start, nxt), (nxt, start)])
            while chain[-1] not in special:
                a, b = chain[-2:]; n = next(k for k in used[b] if k != a)
                chain.append(n); seen.update([(b, n), (n, b)])
            add_edge(f'{prefix}-j{start}', f'{prefix}-j{chain[-1]}', [pos(k) for k in chain])
    for room, p, k in endpoints:
        # A mapped circulation approach already IS this retained junction.
        # Reuse it directly; a neighbour connector would add a false detour.
        if room['doorNodeId'] == f'{prefix}-j{k}':
            continue
        nodes.append(dict(id=room['doorNodeId'], buildingId='B03', floorId='01', point=p, type='door', reason='door', roomId=room['id'], status='candidate'))
        add_edge(room['doorNodeId'], f'{prefix}-j{k}', [p, pos(k)], 'door' if room['code'] not in cfg['circulationCodes'] else 'corridor')
    areas = []
    for x in range(math.floor(minx/25)*25, math.ceil(maxx/25)*25, 25):
        for part in pieces(domain.intersection(box(x, miny-1, x+25, maxy+1))):
            candidates = list(constrained_delaunay_triangles(part).geoms) if part.interiors else [part]
            for area in candidates:
                points = [rnd(p) for p in area.exterior.coords[:-1]]
                if len(set(map(tuple, points))) >= 3 and Polygon(points).is_valid and Polygon(points).area > .00001:
                    areas.append(points)
    # The chunked polygon export can lose a sub-millimetre sliver at a
    # rounded boundary even though the source-safe domain contains the edge.
    # Preserve each retained route in the exported area union with a narrow
    # source-safe strip.  This does not create a route: it is clipped to the
    # same domain used by edge construction and therefore cannot cross a wall,
    # room solid, or unmapped void.
    for edge in edges:
        support = LineString(edge['geometry']).buffer(.1, cap_style=2, join_style=2).intersection(domain)
        for part in pieces(support):
            # Keep six decimals for this numerical guard so rounding cannot
            # move a door endpoint back outside the exported support strip.
            points = [[round(v, 6) for v in p] for p in part.exterior.coords[:-1]]
            if len(set(map(tuple, points))) >= 3 and Polygon(points).is_valid and Polygon(points).area > .00001:
                areas.append(points)
    # Exported polygons are checked again below by the shared validator; keep
    # the generator's own containment check in the same coordinate precision.
    exported = unary_union([Polygon(a) for a in areas])
    for edge in edges:
        line = LineString(edge['geometry'])
        if not exported.covers(line):
            # Polygon clipping and four-decimal graph coordinates can differ
            # by a few ten-thousandths at a boundary. Snap only that numeric
            # residue to the nearest exported point; larger discrepancies are
            # rejected instead of being bridged.
            adjusted = [list(p) for p in edge['geometry']]
            for index in (0, -1):
                point = Point(adjusted[index])
                if exported.covers(point):
                    continue
                nearest = nearest_points(point, exported)[1]
                if point.distance(nearest) > .05:
                    raise AssertionError(f"exported area misses {edge['id']}")
                adjusted[index] = [round(nearest.x, 6), round(nearest.y, 6)]
                node_id = edge['from'] if index == 0 else edge['to']
                node = next(n for n in nodes if n['id'] == node_id)
                node['point'] = adjusted[index]
            edge['geometry'] = adjusted
            edge['distance'] = round(LineString(adjusted).length, 4)
            assert exported.covers(LineString(adjusted)), f"exported area misses {edge['id']}"
    reasons = defaultdict(int)
    for node in nodes:
        reasons[node.get('reason', 'unknown')] += 1
    return nodes, edges, areas, evidence, missing, dict(method='Source-bounded clearance-weighted eight-neighbour grid; deterministic sparse corridor network preserving endpoint distances and source-safe landing bridges', gridStep=step,
        gridVertices=len(adjacency), pairs=reference, disconnectedPairs=disconnected, landingBridges=landing_bridges, nodeReasonCounts=dict(sorted(reasons.items())))
