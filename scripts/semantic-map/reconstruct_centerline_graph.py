"""Independent source-spine topology; exact geometry; diagnostic-only output."""
import heapq
import json
import math
from functools import lru_cache
from shapely.geometry import LineString, Point, box
from shapely.ops import unary_union
from centerline_common import Evidence, NUMERICAL_INSET, components, parts, stable_id, write

ASTAR_STEP = 4.0
ASTAR_PADDING = 100.0
ASTAR_MAX_VISITED = 20000
ASTAR_MAX_TARGETS = 4
POINT_TOLERANCE = 1e-8  # only identifies projected points; never relaxes safety


def atomic_topology(lines, protected, safe):
    """Node real intersections, explicitly cut protected points, preserve bends."""
    segments = []
    rejected = []
    for line in parts(unary_union(lines)):
        coordinates = list(line.coords)
        for start, end in zip(coordinates, coordinates[1:]):
            segment = LineString([start, end])
            cuts = [(0., start), (segment.length, end)]
            for p in sorted(protected):
                if p in (start, end): continue
                if segment.distance(Point(p)) <= POINT_TOLERANCE:
                    distance = segment.project(Point(p))
                    if 0 < distance < segment.length: cuts.append((distance, p))
            cuts.sort()
            for (_, a), (_, b) in zip(cuts, cuts[1:]):
                if a == b: continue
                geometry = [a, b]
                if safe(LineString(geometry)): segments.append((a, b))
                else: rejected.append({'coordinates': list(map(list, geometry)), 'reason': 'exact safety rejection after noding'})
    adjacency = {}
    for a, b in segments:
        adjacency.setdefault(a, set()).add(b); adjacency.setdefault(b, set()).add(a)
    special = {p for p, adjacent in adjacency.items() if len(adjacent) != 2} | (set(protected) & set(adjacency))
    # A closed ring needs an anchor; keep its full polyline as a self-loop.
    unseen = set(adjacency)
    while unseen:
        stack, group = [min(unseen)], set()
        while stack:
            p = stack.pop()
            if p in group: continue
            group.add(p); stack.extend(adjacency[p] - group)
        unseen -= group
        if not group & special: special.add(min(group))
    chains, visited = [], set()
    for start in sorted(special):
        for nxt in sorted(adjacency[start]):
            if (start, nxt) in visited: continue
            chain = [start, nxt]; visited.update(((start, nxt), (nxt, start)))
            while chain[-1] not in special:
                a, b = chain[-2:]; following = next(iter(adjacency[b] - {a}))
                chain.append(following); visited.update(((b, following), (following, b)))
            chains.append(chain)
    return chains, rejected


class ConnectorSearch:
    def __init__(self, evidence):
        self.e = evidence
        self.attempts = []

    @lru_cache(maxsize=256)
    def search(self, start, end):
        e = self.e
        bounds = (min(start[0], end[0])-ASTAR_PADDING, min(start[1], end[1])-ASTAR_PADDING,
                  max(start[0], end[0])+ASTAR_PADDING, max(start[1], end[1])+ASTAR_PADDING)
        local = e.interior.intersection(box(*bounds))
        ox, oy = bounds[:2]; nx = math.ceil((bounds[2]-ox)/ASTAR_STEP)+1; ny = math.ceil((bounds[3]-oy)/ASTAR_STEP)+1
        def xy(k): return (ox+k[0]*ASTAR_STEP, oy+k[1]*ASTAR_STEP)
        @lru_cache(maxsize=None)
        def valid(a, b):
            line = LineString([a, b])
            return local.covers(line) and e.safe(line)
        def nearest(p):
            ix, iy = round((p[0]-ox)/ASTAR_STEP), round((p[1]-oy)/ASTAR_STEP)
            for radius in range(9):
                options = []
                for dx in range(-radius, radius+1):
                    for dy in range(-radius, radius+1):
                        if max(abs(dx), abs(dy)) != radius: continue
                        k = (ix+dx, iy+dy)
                        if 0 <= k[0] < nx and 0 <= k[1] < ny and valid(p, xy(k)): options.append((math.dist(p, xy(k)), k))
                if options: return min(options)[1]
            return None
        source, target = nearest(start), nearest(end)
        record = {'start': list(start), 'end': list(end), 'bounds': list(bounds), 'visited': 0, 'status': 'no-grid-anchor'}
        self.attempts.append(record)
        if source is None or target is None: return None
        best, previous, queue, settled = {source: 0.}, {}, [(math.dist(xy(source), xy(target)), 0., source)], set()
        while queue and len(settled) < ASTAR_MAX_VISITED:
            _, cost, current = heapq.heappop(queue)
            if current in settled or cost != best[current]: continue
            settled.add(current)
            if current == target: break
            for dx, dy in [(1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)]:
                nxt = (current[0]+dx, current[1]+dy)
                if not (0 <= nxt[0] < nx and 0 <= nxt[1] < ny) or not valid(xy(current), xy(nxt)): continue
                new = cost + math.dist(xy(current), xy(nxt))
                if new >= best.get(nxt, math.inf): continue
                best[nxt] = new; previous[nxt] = current
                heapq.heappush(queue, (new+math.dist(xy(nxt), xy(target)), new, nxt))
        record['visited'] = len(settled)
        if target not in settled:
            record['status'] = 'visit-limit' if len(settled) >= ASTAR_MAX_VISITED else 'no-local-path'; return None
        path = [target]
        while path[-1] != source: path.append(previous[path[-1]])
        coords = [start, *[xy(k) for k in reversed(path)], end]
        simple, i = [coords[0]], 0
        while i < len(coords)-1:
            j = len(coords)-1
            while j > i+1 and not e.safe(LineString([coords[i], coords[j]])): j -= 1
            if coords[j] != simple[-1]: simple.append(coords[j])
            i = j
        line = LineString(simple)
        record['status'] = 'safe' if e.safe(line) else 'rejected-final-geometry'
        return line if e.safe(line) else None


def reconstruct():
    e = Evidence()
    clipped = e.spine_pieces(inset=True)
    skeleton = parts(unary_union([line for _, line in clipped]))
    safe_skeleton, excluded = [], []
    for line in skeleton:
        if e.safe(line): safe_skeleton.append(line)
        else: excluded.append({'coordinates': list(map(list, line.coords)), 'tests': e.tests(line)})
    search = ConnectorSearch(e)
    links, unresolved, approach_records = [], [], []
    for room in e.floor['rooms']:
        node = e.approaches[room['doorNodeId']]
        start = tuple(node['point']); point = Point(start); options = []
        targets = sorted([(line.distance(point), i, line.interpolate(line.project(point))) for i, line in enumerate(safe_skeleton)], key=lambda x:(x[0],x[1]))
        for distance, i, target in targets:
            if distance > e.cfg['corridorHalfWidth']*2: continue
            end = tuple(target.coords[0]); line = LineString([start, end])
            if distance == 0 or e.safe(line): options.append((line.length, i, end, line, 'direct'))
        if not options:
            for distance, i, target in targets[:ASTAR_MAX_TARGETS]:
                if distance > e.cfg['corridorHalfWidth']*2: continue
                end = tuple(target.coords[0]); line = search.search(start, end)
                if line is not None: options.append((line.length, i, end, line, 'bounded-local-astar'))
        record = {'id': node['id'], 'room': room['code'], 'point': list(start),
            'source': e.cfg['roomEndpoints'][room['code']], 'provenance': room['provenance'],
            'navigationPartial': room.get('navigationPartial', False), 'navigationNote': room.get('navigationNote'),
            'sharedApproachIds': sorted(n['id'] for n in e.approaches.values() if n['point'] == node['point'])}
        if options:
            length, index, end, line, method = min(options,key=lambda x:(x[0],x[1]))
            record.update({'attachment': list(end), 'method': method, 'length': length, 'tests': e.tests(line)})
            links.append((node, line, end))
        else:
            record.update({'reason': 'No direct or bounded local connector to a reviewed spine passes exact geometry.',
                'nearestSpines': [{'distance': distance, 'point': list(p.coords[0]),
                    'tests': e.tests(LineString([start,p.coords[0]]))} for distance, _, p in targets[:ASTAR_MAX_TARGETS]]})
            unresolved.append(record)
        approach_records.append(record)
    protected = {tuple(n['point']) for n in e.approaches.values()} | {end for _, _, end in links}
    lines = safe_skeleton + [line for _, line, _ in links if line.length > 0]
    chains, rejected = atomic_topology(lines, protected, e.safe)
    point_approaches = {}
    for node in e.approaches.values(): point_approaches.setdefault(tuple(node['point']), []).append(node)
    node_by_point = {}; nodes = []
    for p in sorted({p for chain in chains for p in (chain[0],chain[-1])} | set(point_approaches)):
        if p in point_approaches:
            associated = sorted(point_approaches[p],key=lambda n:n['id'])
            node_by_point[p] = associated[0]['id']; nodes.extend(dict(n) for n in associated)
        else:
            node_id = stable_id('B03-GF-v2-j-', list(p)); node_by_point[p] = node_id
            nodes.append({'id': node_id, 'buildingId': 'B03', 'floorId': 'GF', 'point': list(p), 'type': 'junction', 'status': 'candidate'})
    edges, evidence_records = [], []
    for chain in chains:
        line = LineString(chain)
        if line.length <= 0: continue
        starts = point_approaches.get(chain[0], [{'id':node_by_point[chain[0]]}])
        ends = point_approaches.get(chain[-1], [{'id':node_by_point[chain[-1]]}])
        for start in starts:
            for end in ends:
                geometry = list(map(list, chain))
                edge_id = stable_id('B03-GF-v2-e-', [start['id'],end['id'],geometry])
                is_door = start.get('type') == 'door' or end.get('type') == 'door'
                edge = {'id':edge_id,'from':start['id'],'to':end['id'],'floorId':'GF',
                    'pathType':'door' if is_door else 'corridor','distance':line.length,'distanceUnit':'map-unit',
                    'accessibility':'unknown','restriction':'unknown','status':'candidate','bidirectional':True,'geometry':geometry}
                # Revalidate the exact emitted coordinates after JSON round-trip. No rounding.
                if not e.safe(LineString(json.loads(json.dumps(geometry)))): raise ValueError(edge_id)
                edges.append(edge)
                owners = sorted({i for i, raw in enumerate(e.raw) if raw.buffer(1e-8).intersection(line).length > 1e-8})
                linked = sorted(n['id'] for n, connector, _ in links if connector.length and connector.buffer(1e-8).intersection(line).length > 1e-8)
                evidence_records.append({'edgeId':edge_id,'sourceSpineIds':owners,'approachIds':linked,
                    'sourceReferences':e.references(owners),'tests':e.tests(line)})
    nodes.sort(key=lambda n:n['id']); edges.sort(key=lambda x:x['id'])
    graph = {**e.constraints,'nodes':nodes,'edges':edges}
    groups = components(nodes, edges)
    connected = {edge[k] for edge in edges for k in ('from','to')}
    for record in approach_records:
        record['incidentEdgeCount'] = sum(edge['from']==record['id'] or edge['to']==record['id'] for edge in edges)
        record['componentIndex'] = next(i for i,g in enumerate(groups) if record['id'] in g)
        if record['id'] not in connected and record not in unresolved:
            record['reason'] = 'Approach connector did not survive exact topology noding'; unresolved.append(record)
    report = {'configuredSpines':len(e.raw),'clippedSpineComponents':len(skeleton),
        'nodes':len(nodes),'edges':len(edges),'resultingGraphComponents':len(groups),'componentSizes':list(map(len,groups)),
        'roomApproachesRepresented':len(e.approaches),'roomApproachesWithEdges':sum(n in connected for n in e.approaches),
        'approachComponents':[sorted(r['room'] for r in approach_records if r['id'] in group) for group in groups],
        'cycleRank':len(edges)-len(nodes)+len(groups),'excludedSpinePieces':excluded,'rejectedSerializedEdges':rejected,
        'unresolved':unresolved,'approaches':approach_records,'edgeEvidence':evidence_records,
        'parameters':{'inwardDomainMarginMapUnits':NUMERICAL_INSET,'pointIdentificationTolerance':POINT_TOLERANCE,
            'astarStep':ASTAR_STEP,'astarPadding':ASTAR_PADDING,'astarMaxVisited':ASTAR_MAX_VISITED,'astarMaxTargets':ASTAR_MAX_TARGETS},
        'astarAttempts':search.attempts,'astarCache':search.search.cache_info()._asdict(),
        'generation':'Independent configured spines plus source approach connectors; legacy edges are discarded on input.',
        'runtimePromotion':'blocked: disconnected or unsupported source topology requires explicit review; no runtime import changes'}
    write('GF.v2.graph.diagnostic.json',graph); write('reconstruction-report.json',report); write('unresolved-approaches.json',unresolved)
    print(json.dumps({k:report[k] for k in ['nodes','edges','resultingGraphComponents','roomApproachesRepresented','roomApproachesWithEdges','cycleRank']}))
    return graph, report

if __name__ == '__main__': reconstruct()
