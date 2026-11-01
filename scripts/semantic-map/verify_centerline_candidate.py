"""Strict geometry, contract-shape and connectivity audit for the V2 graph."""
from collections import Counter
from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union
from centerline_common import Evidence, components, read, write


def verify():
    e = Evidence(); graph = read('artifacts/navigation-v2/GF.v2.graph.diagnostic.json')
    node_map = {node['id']: node for node in graph['nodes']}
    bad_area, bad_walls, bad_rooms, bad_distances, bad_endpoints, metadata = [], [], [], [], [], []
    pair_counts = Counter()
    for edge in graph['edges']:
        a, b = node_map[edge['from']], node_map[edge['to']]
        line = LineString(edge['geometry']); tests = e.tests(line)
        if not e.domain.covers(line): bad_area.append({'edge':edge['id'],'outsideLength':tests['outsideLength']})
        if tests['wallIndices']: bad_walls.append({'edge':edge['id'],'wallIndices':tests['wallIndices']})
        if tests['roomInteriors']: bad_rooms.append({'edge':edge['id'],'roomInteriors':tests['roomInteriors']})
        if edge['geometry'][0] != a['point'] or edge['geometry'][-1] != b['point']:
            bad_endpoints.append(edge['id'])
        length = sum(LineString([p,q]).length for p,q in zip(edge['geometry'],edge['geometry'][1:]))
        if abs(edge['distance']-length)>max(.01,length*1e-5): bad_distances.append(edge['id'])
        if edge.get('status') != 'candidate' or edge.get('restriction') != 'unknown' or edge.get('accessibility') != 'unknown':
            metadata.append(edge['id'])
        pair_counts[tuple(sorted((edge['from'],edge['to'])))] += 1
    missing_nodes = sorted(nid for nid in e.approaches if nid not in node_map)
    missing_edges = sorted(nid for nid in e.approaches if not any(x['from']==nid or x['to']==nid for x in graph['edges']))
    door_nodes = {nid for nid, node in e.approaches.items() if node.get('type') == 'door'}
    door_entries_missing = sorted(nid for nid in door_nodes - set(e.intentional_edge_free_approaches) if not any(
        edge.get('pathType') == 'door' and (edge['from'] == nid or edge['to'] == nid) for edge in graph['edges']))
    groups = components(graph['nodes'],graph['edges'])
    largest_approaches = [node_map[nid]['roomId'] for nid in groups[0] if node_map[nid].get('roomId')] if groups else []
    source_isolation = sorted({n.get('roomId') for n in graph['nodes'] if n.get('roomId')} -
                               {a.get('roomId') for edge in graph['edges'] for a in (node_map[edge['from']],node_map[edge['to']])})
    result = {'graph':'diagnostic-only','nodes':len(graph['nodes']),'edges':len(graph['edges']),
        'connectedComponents':len(groups),'componentNodeCounts':list(map(len,groups)),
        'approachCount':len(e.approaches),'approachNodesMissing':missing_nodes,'approachesWithoutEdges':missing_edges,
        'doorApproachNodesWithoutDoorEdges':door_entries_missing,
        'intentionallyEdgeFreeApproaches':sorted(e.intentional_edge_free_approaches),
        'approachNodesWithEdges':len(e.approaches)-len(missing_edges),'approachesInLargestComponent':len(largest_approaches),
        'strictWalkableAreaFailures':bad_area,'wallContacts':bad_walls,'roomInteriorCrossings':bad_rooms,
        'endpointMismatches':bad_endpoints,'distanceMismatches':bad_distances,'candidateMetadataFailures':metadata,
        'duplicateUndirectedEdges':[list(k) for k,v in pair_counts.items() if v>1],
        'isolatedApproachRooms':source_isolation,'acceptance':'PASS' if not any([bad_area,bad_walls,bad_rooms,bad_endpoints,bad_distances,metadata,missing_nodes,missing_edges,door_entries_missing]) and len(groups)==1 else 'FAIL',
        'reason':'Complete connectivity is source-unsupported; candidate must remain diagnostic-only.'}
    write('candidate-validation.json',result); print(result); return result

if __name__ == '__main__': verify()
