import type { MapFeature, Point, Room, RoomCategory, EvidenceStatus } from '@wayfinding/map-engine';

// Display height is illustrative, never a surveyed architectural dimension.
export const BLOCK_HEIGHT = .65;
export type MapBlock = { id: string; polygon: Point[]; category: RoomCategory; geometryStatus: EvidenceStatus; height: number };
export const roomFootprint = (room: Room) => room.polygon ?? room.displayFootprint?.polygon ?? null;

export function roomBlock(room: Room): MapBlock | null {
  const polygon = roomFootprint(room);
  if (!polygon) return null;
  const stairs = /^stairs?\b/i.test(room.name.en);
  return { id: room.id, polygon, category: room.category, geometryStatus: room.polygon ? room.geometryStatus : 'candidate',
    height: room.category === 'circulation' && !stairs ? .045 : BLOCK_HEIGHT };
}

export function featureBlock(feature: MapFeature): MapBlock {
  return { id: feature.id, polygon: feature.polygon, category: 'circulation', geometryStatus: feature.geometryStatus, height: BLOCK_HEIGHT };
}
