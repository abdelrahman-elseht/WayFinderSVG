"""Shared, exact geometry evidence for offline Navigation V2.

Only constraints and room approach nodes are read from the legacy graph.
Legacy edges are deliberately removed at the input boundary.
"""
import hashlib
import json
from pathlib import Path

from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'artifacts/navigation-v2'
NUMERICAL_INSET = 0.0001  # drawing units; shrink, never expand, the source domain


def read(relative):
    return json.loads((ROOT / relative).read_text(encoding='utf-8'))


def write(name, value):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def parts(geometry):
    if geometry.geom_type == 'LineString':
        return [geometry] if geometry.length > 0 else []
    return [line for child in getattr(geometry, 'geoms', []) for line in parts(child)]


def stable_id(prefix, coordinates):
    return prefix + hashlib.sha256(json.dumps(coordinates, separators=(',', ':')).encode()).hexdigest()[:12]


def components(nodes, edges):
    adjacent = {node['id']: set() for node in nodes}
    for edge in edges:
        adjacent[edge['from']].add(edge['to'])
        adjacent[edge['to']].add(edge['from'])
    unseen, groups = set(adjacent), []
    while unseen:
        stack, group = [min(unseen)], set()
        while stack:
            node = stack.pop()
            if node in group:
                continue
            group.add(node)
            stack.extend(adjacent[node] - group)
        unseen -= group
        groups.append(sorted(group))
    return sorted(groups, key=lambda group: (-len(group), group))


class Evidence:
    def __init__(self):
        self.cfg = read('scripts/semantic-map/navigation-config.json')
        self.floor = read('data/buildings/B03/GF.json')
        legacy = read('data/buildings/B03/GF.graph.json')
        self.constraints = {key: legacy[key] for key in ('navigableAreas', 'walls', 'metersPerUnit', 'calibrationStatus', 'status', 'routingPolicy')}
        self.approaches = {n['id']: n for n in legacy['nodes'] if n.get('roomId')}
        del legacy
        self.domain = unary_union([Polygon(p) for p in self.constraints['navigableAreas']])
        self.interior = self.domain.buffer(-NUMERICAL_INSET, join_style=2)
        self.walls = [LineString(w) for w in self.constraints['walls']]
        self.wall_tree = STRtree(self.walls)
        foyer = Polygon(self.cfg['sharedAVFoyer']['polygon'])
        self.obstacles = []
        for room in self.floor['rooms']:
            if room.get('polygon'):
                polygon = Polygon(room['polygon'])
                if room['code'] == self.cfg['sharedAVFoyer']['roomCode']:
                    polygon = polygon.difference(foyer)
                self.obstacles.append((room['code'], polygon))
            if room.get('displayFootprint'):
                self.obstacles.append((room['code'], Polygon(room['displayFootprint']['polygon'])))
        self.obstacle_tree = STRtree([p for _, p in self.obstacles])
        self.raw = [LineString(p) for p in self.cfg['corridorSpines']]

    def tests(self, line):
        wall_hits = [int(i) for i in self.wall_tree.query(line) if line.intersects(self.walls[int(i)])]
        # Boundary contact with a room is not an interior crossing; walls remain strict.
        room_hits = [self.obstacles[int(i)][0] for i in self.obstacle_tree.query(line)
                     if line.relate_pattern(self.obstacles[int(i)][1], 'T********')]
        area = self.domain.covers(line)
        return {'areaCovered': bool(area), 'outsideLength': float(line.difference(self.domain).length),
                'wallIndices': wall_hits, 'roomInteriors': room_hits,
                'restriction': 'unknown', 'accessibility': 'unknown',
                'safe': bool(area and not wall_hits and not room_hits)}

    def safe(self, line):
        return self.tests(line)['safe']

    def references(self, spine_ids):
        # These are configuration provenance, not invented drawing primitive IDs.
        return [f'scripts/semantic-map/navigation-config.json#/corridorSpines/{i}' for i in spine_ids] + [
            'maps/B03/GF/master.svg', 'maps/B03/GF/alignment.json',
            '2761-SOD-B03-DWG-AAR-15-GF-Z-0001-01.pdf#page=1',
            '2761-SOD-B03-DWG-AAR-15-GF-Z-0002-01.pdf#page=1']

    def spine_pieces(self, inset=False):
        domain = self.interior if inset else self.domain
        return [(i, line) for i, raw in enumerate(self.raw) for line in parts(raw.intersection(domain))]
