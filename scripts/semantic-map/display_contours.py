"""Source-derived display footprints, independent of navigation qualifications.

Source name labels can fall on a partition or outside a small room. Keep the
original directory anchor; never stretch a room outline to include its label.
Investigation windows/seeds select faces, and cannot supply boundary geometry.
"""
from shapely import set_precision
from shapely.geometry import Point, LineString, box
from shapely.ops import unary_union
from display_closures import compound_closures
from source_geometry import sample


def display_contours(rooms, paths, seals, floor_id, config):
    door_layers = {p['layer'] for p in paths if 'DOOR' in p['layer'] and 'STEP' not in p['layer']}
    compound = compound_closures(paths, door_layers)
    evidence_lines = []
    for path in paths:
        layer = path['layer']
        if not any(s in layer for s in ('WALL', 'GLAZ', 'CONC', 'GYPSUM', 'CLADDING', 'HANDRAIL', 'HPL', 'SLABEDGE', 'LOUVER')) and layer not in door_layers and path['id'] not in config.get('extraBoundaryPaths', []):
            continue
        for item in path['items']:
            if layer in door_layers and item['type'] in ('cubic', 'curve'):
                continue
            line = LineString(sample(item))
            if line.length > .001:
                evidence_lines.append((path['sourceId'], path['id'], line))
    evidence_lines += [(s['sourceId'], s['id'], s['line']) for s in seals + compound]
    report = []
    for group in config['groups']:
        window = box(*group['window'])
        local = [(sid, pid, line.intersection(window)) for sid, pid, line in evidence_lines if line.intersects(window)]
        network = unary_union([set_precision(line, .01) for _, _, line in local])
        free = window.difference(network.buffer(group['buffer'], join_style=2))
        faces = [free] if free.geom_type == 'Polygon' else list(free.geoms)
        for code, seed in group['rooms'].items():
            room = next(r for r in rooms if r['code'] == code)
            assert room['polygon'] is None, f'{code}: do not override accepted semantic geometry'
            anchor = Point(seed if seed else room['centroid'])
            candidates = [p for p in faces if p.contains(anchor) and not p.intersects(window.boundary) and p.area > 50]
            assert len(candidates) == 1, f'{floor_id}/{code}: no unique source-bounded display face'
            face = candidates[0].simplify(.18, preserve_topology=True)
            assert face.is_valid and not face.intersects(window.boundary), code
            refs = sorted({(sid, pid) for sid, pid, line in local if face.boundary.distance(line) < group['buffer']+.3})
            note = group['note'] + f" Source-vector face with {group['buffer']:.2f}-unit drafting tolerance and 0.18 simplification. Display only; no new route, access, height measurement or floor connection."
            room['displayFootprint'] = dict(polygon=[[round(x, 3), round(y, 3)] for x, y in face.exterior.coords[:-1]], geometryStatus='candidate',
                provenance=[dict(source=f'maps/B03/{floor_id}/source/{sid}.json#{pid}', page=1, status='candidate', note=note) for sid, pid in refs])
            report.append(dict(code=code, area=round(face.area, 3), sourcePathCount=len(refs), sourceLabelInside=face.covers(Point(room['centroid'])), note=note))
    return report
