"""Build map features from reviewed source references in navigation-config.json."""
from shapely.geometry import MultiPoint


def derive_features(read):
    source_cache = {}

    def source(source_id):
        if source_id not in source_cache:
            source_cache[source_id] = read(f'maps/B03/GF/source/{source_id}.json')
        return source_cache[source_id]

    out = []
    for record in read('scripts/semantic-map/navigation-config.json')['mapFeatures']:
        source_id = record['sourceId']
        source_data = source(source_id)
        affine = source_data['displayToMaster']
        transform = lambda point: [point[0] * affine[0] + point[1] * affine[2] + affine[4], point[0] * affine[1] + point[1] * affine[3] + affine[5]]
        paths = {path['id']: path for path in source_data['paths']}
        provenance = []
        if record.get('pathIds'):
            points = [transform(point) for path_id in record['pathIds'] for item in paths[path_id]['items'] for point in item['points']]
            geometry = MultiPoint(points).convex_hull
            polygon = [[round(x, 3), round(y, 3)] for x, y in geometry.exterior.coords[:-1]]
            anchor = [round(sum(point[0] for point in polygon) / len(polygon), 3), round(sum(point[1] for point in polygon) / len(polygon), 3)]
            provenance.extend(dict(source=f'maps/B03/GF/source/{source_id}.json#{path_id}', page=1, status=record['geometryStatus'], note=record['note']) for path_id in record['pathIds'])
        else:
            label = next(text for text in source_data['texts'] if text['id'] == record['labelId'])
            anchor = [round(value, 3) for value in transform([(label['bbox'][0] + label['bbox'][2]) / 2, (label['bbox'][1] + label['bbox'][3]) / 2])]
            polygon = None
            provenance.append(dict(source=f'maps/B03/GF/source/{source_id}.json#{record["labelId"]}', page=1, status='confirmed', note=record['note']))
        out.append(dict(id=record['id'], buildingId='B03', floorId='GF', name=record['name'], kind=record['kind'], polygon=polygon, anchor=anchor, roomId=f'B03-GF-{record["roomCode"]}', geometryStatus=record['geometryStatus'], accessibility=record['accessibility'], connectedFloorIds=record['connectedFloorIds'], provenance=provenance))
    return out
