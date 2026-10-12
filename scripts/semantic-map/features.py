"""Source rail envelopes; features never imply inter-floor routing."""
from shapely.geometry import MultiPoint

def equipment_features(paths, floor_id):
    """Reviewed cabin casings and escalator rails, in master coordinates."""
    cabins = {
        'GF': ['0001-path-09683', '0001-path-09717', '0001-path-09751', '0002-path-10443', '0002-path-10475'],
        '01': ['0001-path-09201', '0001-path-09237', '0001-path-09273', '0002-path-10033', '0002-path-10069'],
    }
    rails = {
        'GF': [['0001-path-08616','0001-path-08574'], ['0001-path-08684','0001-path-08642']],
        '01': [['0001-path-11977','0001-path-11936'], ['0001-path-12045','0002-path-13794']],
    }
    by_id = {p['id']: p for p in paths}
    out = []
    for kind, groups in [('elevator', [[pid] for pid in cabins[floor_id]]), ('escalator', rails[floor_id])]:
        for index, ids in enumerate(groups):
            points = [xy for pid in ids for item in by_id[pid]['items'] for xy in item['points']]
            polygon = MultiPoint(points).convex_hull
            assert polygon.geom_type == 'Polygon' and polygon.is_valid
            suffix = str(index+1) if kind == 'elevator' else ['west', 'east'][index]
            out.append(dict(id=f'B03-{floor_id}-{kind}-{suffix}', buildingId='B03', floorId=floor_id,
                name=dict(en=f'{"Lift" if kind == "elevator" else "Escalator"} {index+1}', ar=f'{"مصعد" if kind == "elevator" else "سلم متحرك"} {index+1}'),
                kind=kind, polygon=[[round(x,3),round(y,3)] for x,y in polygon.exterior.coords[:-1]],
                geometryStatus='candidate', accessibility='unknown', connectedFloorIds=[],
                provenance=[dict(source=f"maps/B03/{floor_id}/source/{by_id[pid]['sourceId']}.json#{pid}", page=1, status='candidate',
                    note='Source cabin casing or paired escalator rail envelope. Illustrative raised display only; no measured height, accessibility or inter-floor connection inferred.') for pid in ids]))
    return out