"""Independent display audit: exported polygons against dense source ink.

No semantic generator imports. Door closures use whole source swings; sampled
curves have 96 subdivisions. Display geometry never alters route constraints.
"""
import json
import math
from pathlib import Path
from shapely.geometry import Polygon, LineString, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[2]


def read(path):
    return json.loads((ROOT/path).read_text(encoding='utf-8'))


def affine(p, m):
    return [m[0]*p[0]+m[2]*p[1]+m[4], m[1]*p[0]+m[3]*p[1]+m[5]]


def main():
    reports = []
    for floor_id in ['GF', '01']:
        data = read(f'data/buildings/B03/{floor_id}.json')
        graph = read(f'data/buildings/B03/{floor_id}.graph.json')
        align = read(f'maps/B03/{floor_id}/alignment.json')
        raw = {s['id']: {p['id']: p for p in read(f"maps/B03/{floor_id}/source/{s['id']}.json")['paths']} for s in align['sources']}
        matrices = {s['id']: s['displayToMaster'] for s in align['sources']}
        x, y, w, h = data['floor']['viewBox']
        frame = box(x,y,x+w,y+h)
        solids = [(r['id'], Polygon(r['polygon'])) for r in data['rooms'] if r['polygon'] and r['category'] != 'circulation']
        additions = [r for r in data['rooms'] if 'displayFootprint' in r]
        for room in additions:
            display = room['displayFootprint']
            shape = Polygon(display['polygon'])
            assert shape.is_valid and frame.covers(shape), room['code']
            ink = []
            for evidence in display['provenance']:
                filename, pid = evidence['source'].split('#')
                sid = Path(filename).stem
                path = raw[sid][pid]
                matrix = matrices[sid]
                curves = []
                for item in path['items']:
                    ps = [affine(p,matrix) for p in item['points']]
                    if item['type'] in ['cubic','curve']:
                        curves.append(ps)
                        points = []
                        for k in range(97):
                            t=k/96
                            weights=[(1-t)**3,3*t*(1-t)**2,3*t*t*(1-t),t**3]
                            points.append([sum(weights[i]*ps[i][j] for i in range(4)) for j in range(2)])
                    else:
                        points=ps+([ps[0]] if item['type'] in ['quad','rect'] else [])
                    ink.append(LineString(points))
                if 'DOOR' in path['layer'] and curves:
                    # Check each legacy segment and the complete compound swing.
                    for pieces in [[p] for p in curves] + [curves]:
                        a,b=pieces[0][0],pieces[-1][-1]
                        u=[-(pieces[0][1][1]-a[1]),pieces[0][1][0]-a[0]]
                        v=[-(b[1]-pieces[-1][-2][1]),b[0]-pieces[-1][-2][0]]
                        det=u[0]*v[1]-u[1]*v[0]
                        if abs(det)<.001: continue
                        t=((b[0]-a[0])*v[1]-(b[1]-a[1])*v[0])/det
                        hinge=[a[j]+t*u[j] for j in range(2)]
                        radius=math.dist(hinge,a)
                        if not 7<radius<65 or abs(radius-math.dist(hinge,b))>2: continue
                        for endpoint in [a,b]:
                            direction=[(endpoint[j]-hinge[j])/radius for j in range(2)]
                            ink.append(LineString([[hinge[j]-3*direction[j] for j in range(2)], [endpoint[j]+3*direction[j] for j in range(2)]]))
            assert unary_union(ink).buffer(.65).covers(shape.boundary), f'{floor_id}/{room["code"]}: boundary leaves source ink'
            for other_id, other in solids:
                assert shape.intersection(other).area < 1, (room['id'], other_id, 'overlap')
            solids.append((room['id'],shape))
            for edge in graph['edges']:
                assert not shape.intersects(LineString(edge['geometry'])), (room['id'],edge['id'],'route hidden inside raised block')
        equipment=data['mapFeatures']
        assert len(equipment)==7
        for feature in equipment:
            shape=Polygon(feature['polygon'])
            assert shape.is_valid and frame.covers(shape)
            for reference in feature['provenance']:
                filename,pid=reference['source'].split('#')
                assert pid in raw[Path(filename).stem]
            for edge in graph['edges']:
                assert not shape.intersects(LineString(edge['geometry'])), (feature['id'],edge['id'],'equipment/route overlap')
        reports.append(dict(floor=floor_id, displayFootprints=len(additions), equipmentBlocks=len(equipment),
            sourceBoundary='passed', roomOverlap='passed', routeOcclusion='passed'))
    destination=ROOT/'artifacts/block-heights/source-audit.json'
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(json.dumps(reports,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(reports,indent=2))


if __name__ == '__main__': main()
