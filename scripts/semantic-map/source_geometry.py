"""Affine source geometry and swing/leaf evidence shared by pack-backed floors."""
import math
from shapely.geometry import LineString, Point, box
from shapely.ops import unary_union
from shapely.strtree import STRtree
from shapely import set_precision
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from floor_context import read_json


def transform(p, matrix):
    a, b, c, d, e, f = matrix
    x, y = p
    return [a*x + c*y + e, b*x + d*y + f]


def sample(item):
    points = item['points']
    if item['type'] in ('cubic', 'curve'):
        return [[sum(weights[k] * points[k][j] for k in range(4)) for j in range(2)]
            for t in [k/24 for k in range(25)]
            for weights in [[(1-t)**3, 3*t*(1-t)**2, 3*t*t*(1-t), t**3]]]
    return points + ([points[0]] if item['type'] in ('rect', 'quad') else [])


def load(cfg):
    base = f"maps/{cfg['buildingId']}/{cfg['floorId']}"
    align = read_json(base + '/alignment.json')
    x, y, w, h = align['viewBox']
    frame = box(x, y, x+w, y+h)
    paths, labels, walls, wall_evidence, doorlines, arcs = [], [], [], [], [], []
    for source in align['sources']:
        raw = read_json(base + '/source/' + source['id'] + '.json')
        matrix, crop = source['displayToMaster'], source['planCrop']
        corners = [transform(p, matrix) for p in [[crop[0], crop[1]], [crop[2], crop[3]]]]
        retained = box(*corners[0], *corners[1]).intersection(frame)
        source_crop = retained
        seam = align.get('seamX')
        if seam is not None:
            retained = retained.intersection(box(x if source['id'] == '0001' else seam, y,
                seam if source['id'] == '0001' else x+w, y+h))
        for path in raw['paths']:
            if path['layer'] not in align['keepLayers']:
                continue
            transformed = {**path, 'sourceId': source['id'], 'items': [
                {**item, 'points': [transform(p, matrix) for p in item['points']]} for item in path['items']]}
            if not any(retained.intersects(LineString(sample(item))) for item in transformed['items']):
                continue
            paths.append(transformed)
            wall = path['layer'] in cfg['wallLayers']
            door = path['layer'] in cfg['doorLayers']
            for item in transformed['items']:
                line = LineString(sample(item)).intersection(retained)
                lines = [line] if line.geom_type == 'LineString' else [g for g in getattr(line, 'geoms', []) if g.geom_type == 'LineString']
                for segment in lines:
                    if segment.length < .001:
                        continue
                    if wall:
                        walls.append(segment)
                        wall_evidence.append(dict(sourceId=source['id'], pathId=path['id'], layer=path['layer']))
                # Full source leaf/swing evidence may straddle the render seam.
                # Keep it for portal inference; structural walls remain clipped.
                if door and item['type'] not in ('cubic', 'curve'):
                    full = LineString(sample(item)).intersection(source_crop)
                    if full.geom_type == 'LineString' and full.length > .001:
                        doorlines.append((transformed, full))
                if door and item['type'] in ('cubic', 'curve') and source_crop.covers(LineString(sample(item))) and retained.intersects(LineString(sample(item))):
                    arcs.append((transformed, item))
        texts = raw['texts']
        for i, text in enumerate(texts):
            if text['text'] != cfg['tagPrefix'] or i < 2 or not texts[i-2]['text'].isdigit():
                continue
            tag, name = texts[i-2:i]
            if not 1 <= int(tag['text']) <= cfg['scheduleCount']:
                continue
            bbox = name['bbox']
            # Schedule/title block coordinates are excluded by the source crop.
            if not box(*crop).covers(Point((bbox[0]+bbox[2])/2, (bbox[1]+bbox[3])/2)):
                continue
            point = transform([(bbox[0]+bbox[2])/2, (bbox[1]+bbox[3])/2], matrix)
            if not frame.covers(Point(point)):
                continue
            labels.append(dict(code=f"{cfg['tagPrefix']}-{int(tag['text']):02}", name=name['text'],
                id=name['id'], tagTextId=tag['id'], prefixTextId=text['id'], sourceId=source['id'],
                bbox=bbox, masterBBox=[*transform(bbox[:2], matrix), *transform(bbox[2:], matrix)], point=point))
    tree = STRtree([line for _, line in doorlines])
    seals = []
    for path, item in arcs:
        points = item['points']; a, b = points[0], points[-1]
        va = [-(points[1][1]-a[1]), points[1][0]-a[0]]
        vb = [-(b[1]-points[2][1]), b[0]-points[2][0]]
        det = va[0]*vb[1]-va[1]*vb[0]
        if abs(det) < .001:
            continue
        delta = [b[0]-a[0], b[1]-a[1]]
        t = (delta[0]*vb[1]-delta[1]*vb[0])/det
        center = [a[0]+t*va[0], a[1]+t*va[1]]
        radius = math.dist(center, a)
        if not 7 < radius < 65 or abs(math.dist(center, b)-radius) > 2:
            continue
        matches = []
        for index in tree.query(Point(center).buffer(3)):
            leaf, line = doorlines[index]
            ends = list(line.coords)
            if leaf['sourceId'] != path['sourceId'] or abs(line.length-radius) > 2 or min(math.dist(center, p) for p in ends) > 2:
                continue
            for endpoint, closed in ((a, b), (b, a)):
                if min(math.dist(endpoint, p) for p in ends) < 2:
                    matches.append((leaf['id'], closed))
        if matches:
            leaf, closed = sorted(matches)[0]
            direction = [(closed[j]-center[j])/radius for j in range(2)]
            # Extension is for candidate face closure only, never a walkable portal.
            seals.append(dict(id=path['id'], sourceId=path['sourceId'], leaf=leaf,
                portal=[center, closed], line=LineString([[center[j]-3*direction[j] for j in range(2)],
                    [closed[j]+3*direction[j] for j in range(2)]])))
    network = unary_union([set_precision(line, .01) for line in walls + [l for _, l in doorlines] + [s['line'] for s in seals]])
    free = frame.difference(network.buffer(.20, join_style=2))
    polys = [free] if free.geom_type == 'Polygon' else list(free.geoms)
    return dict(align=align, frame=frame, paths=paths, labels=labels, walls=walls,
        wallEvidence=wall_evidence, doorlines=doorlines, seals=seals, polys=[p for p in polys if p.area > 50])
