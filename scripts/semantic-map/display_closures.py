"""Complete compound door swings for candidate display contours only.

Never replace route portal evidence with these closure segments.
"""
import math
from shapely.geometry import LineString


def compound_closures(paths, door_layers):
    result = []
    for path in paths:
        if path['layer'] not in door_layers:
            continue
        curves = [i['points'] for i in path['items'] if i['type'] in ('curve', 'cubic')]
        if len(curves) < 2 or any(math.dist(a[-1], b[0]) > .05 for a, b in zip(curves, curves[1:])):
            continue
        a, b = curves[0][0], curves[-1][-1]
        va = [-(curves[0][1][1]-a[1]), curves[0][1][0]-a[0]]
        vb = [-(b[1]-curves[-1][-2][1]), b[0]-curves[-1][-2][0]]
        det = va[0]*vb[1]-va[1]*vb[0]
        if abs(det) < .001:
            continue
        t = ((b[0]-a[0])*vb[1]-(b[1]-a[1])*vb[0])/det
        hinge = [a[j]+t*va[j] for j in range(2)]
        radius = math.dist(hinge, a)
        if not 7 < radius < 65 or abs(math.dist(hinge, b)-radius) > .1:
            continue
        # A matching straight leaf proves which endpoint is open and which is
        # the closed jamb. Both must belong to this sheet and door layer.
        for leaf in paths:
            if leaf['sourceId'] != path['sourceId'] or leaf['layer'] != path['layer']:
                continue
            for item in leaf['items']:
                if item['type'] != 'line':
                    continue
                ends = item['points']
                if abs(math.dist(*ends)-radius) > .15 or min(math.dist(hinge, p) for p in ends) > .15:
                    continue
                for opened, closed in [(a, b), (b, a)]:
                    if min(math.dist(opened, p) for p in ends) > .15:
                        continue
                    direction = [(closed[j]-hinge[j])/radius for j in range(2)]
                    line = LineString([[hinge[j]-3*direction[j] for j in range(2)], [closed[j]+3*direction[j] for j in range(2)]])
                    result.append(dict(id=path['id'], sourceId=path['sourceId'], leaf=leaf['id'], line=line))
                    break
            if result and result[-1]['id'] == path['id']:
                break
    return result
