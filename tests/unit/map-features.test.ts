import { describe, expect, it } from 'vitest';
import type { FloorData } from '@wayfinding/map-engine';
import floorJson from '../../data/buildings/B03/GF.json';

const floor = floorJson as unknown as FloorData;

describe('source reviewed map features', () => {
  it('keeps cafeteria and elevator lobby as localized marker-only identities', () => {
    const features = floor.mapFeatures ?? [];
    expect(features).toHaveLength(4);
    expect(features).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'B03-GF-cafeteria', kind: 'cafeteria', roomId: 'B03-GF-G-18', polygon: null, geometryStatus: 'unknown', accessibility: 'unknown', connectedFloorIds: [], anchor: [2783.383, 1778.704] }),
      expect.objectContaining({ id: 'B03-GF-elevator-lobby', kind: 'elevator', roomId: 'B03-GF-G-09', polygon: null, geometryStatus: 'unknown', accessibility: 'unknown', connectedFloorIds: [], anchor: [2639.69, 1467.012] }),
    ]));
  });

  it('keeps the elevator feature separate from vertical graph transitions', () => {
    const elevator = floor.mapFeatures?.find(feature => feature.kind === 'elevator');
    expect(elevator?.connectedFloorIds).toEqual([]);
    expect(elevator?.provenance[0].source).toContain('0002-text-0139');
    expect(floor.rooms.find(room => room.code === 'G-09')?.doorNodeId).toBeTruthy();
  });
});
