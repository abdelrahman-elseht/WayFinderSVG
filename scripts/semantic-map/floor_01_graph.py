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
    domain = region.intersection(context['frame']).difference(unary_union(solids)).difference(wall.buffer(.8, join_style=2))
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
        for dy in range(-10, 11):
            for dx in range(-10, 11):
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
                    options.append((math.dist(approach, point), None, pos(k), k))
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
                                options.append((offset, seal['id'], approach, k))
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
                            options.append((offset, seal['id'], approach, k))
        if not options:
            if code in cfg['unsupportedNotes']:
                room['navigationNote'] = cfg['unsupportedNotes'][code]
            missing.append(dict(code=code, reason='No source portal with a covered corridor-side approach in the reviewed navigation union.'))
            continue
        _, arc, approach, k = min(options, key=lambda o: (o[0], o[1] or '', o[2]))
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
    # Retain the full pairwise shortest network, including cycles. Disconnected
    # components stay separate and are explicitly classified in the router matrix.
    used = defaultdict(set); reference = []; disconnected = []
    for i, (room, p, start) in enumerate(endpoints):
        lengths, parents = shortest(start)
        used[start]
        for other, q, target in endpoints[i+1:]:
            if target not in lengths:
                disconnected.append([room['code'], other['code']]); continue
            reference.append(dict(start=room['doorNodeId'], end=other['doorNodeId'], distance=round(math.dist(p, pos(start))+lengths[target]+math.dist(q, pos(target)), 6)))
            current = target
            while current != start:
                parent = parents[current]; used[current].add(parent); used[parent].add(current); current = parent
    special = {k for _, _, k in endpoints} | {k for k, links in used.items() if len(links) != 2}
    def rnd(p):
        return [round(v, 4) for v in p]
    nodes = [dict(id=f'{prefix}-j{k}', buildingId='B03', floorId='01', point=rnd(pos(k)), type='junction', status='candidate') for k in sorted(special)]
    for room, _, k in endpoints:
        if room['doorNodeId'] == f'{prefix}-j{k}':
            node = next(n for n in nodes if n['id'] == room['doorNodeId'])
            assert 'roomId' not in node, 'Distinct circulation identities need distinct mapped approaches'
            node['roomId'] = room['id']
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
        assert domain.buffer(.0002).covers(line) and not wall.intersects(line)
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
        nodes.append(dict(id=room['doorNodeId'], buildingId='B03', floorId='01', point=p, type='junction', roomId=room['id'], status='candidate'))
        add_edge(room['doorNodeId'], f'{prefix}-j{k}', [p, pos(k)], 'door' if room['code'] not in cfg['circulationCodes'] else 'corridor')
    areas = []
    for x in range(math.floor(minx/25)*25, math.ceil(maxx/25)*25, 25):
        for part in pieces(domain.intersection(box(x, miny-1, x+25, maxy+1))):
            candidates = list(constrained_delaunay_triangles(part).geoms) if part.interiors else [part]
            for area in candidates:
                points = [rnd(p) for p in area.exterior.coords[:-1]]
                if len(set(map(tuple, points))) >= 3 and Polygon(points).is_valid and Polygon(points).area > .00001:
                    areas.append(points)
    return nodes, edges, areas, evidence, missing, dict(method='Source-bounded clearance-weighted eight-neighbour grid; retain all connected pair paths without joining disconnected components', gridStep=step,
        gridVertices=len(adjacency), pairs=reference, disconnectedPairs=disconnected)
