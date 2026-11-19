import { describe, expect, it } from 'vitest';
import { shouldDisplayMapLabel } from '../../apps/web/components/map-label-policy';

const corridorIds = [
  'B03-GF-G-02',
  'B03-GF-G-03',
  'B03-GF-G-04',
  'B03-01-F-01',
  'B03-01-F-02',
  'B03-01-F-03',
  'B03-01-F-04',
  'B03-01-F-05',
  'B03-01-F-06',
  'B03-01-F-49',
];

describe('shouldDisplayMapLabel', () => {
  it.each(corridorIds)('hides the floating corridor label for %s', roomId => {
    expect(shouldDisplayMapLabel(roomId)).toBe(false);
  });

  it.each([
    'B03-GF-G-01', // Main Entrance
    'B03-GF-G-08', // Stairs 3
    'B03-GF-G-09', // Elevator Lobby
    'B03-GF-G-14', // Lobby
    'B03-01-F-17', // STAIR 03
    'B03-01-F-22', // LOBBY
    'B03-01-F-37', // ELEVATOR LOBBY
  ])('keeps the non-corridor circulation label for %s', roomId => {
    expect(shouldDisplayMapLabel(roomId)).toBe(true);
  });

  it.each([
    '',
    'unknown-room',
    'B03-GF-G-99',
    'B03-01-F-99',
    'B03-02-F-01',
    'Corridor',
    'CORRIDOR',
    'service-corridor',
  ])('defaults to showing labels for unlisted IDs: %s', roomId => {
    expect(shouldDisplayMapLabel(roomId)).toBe(true);
  });

  it.each(corridorIds)('matches %s exactly, not by substring or normalization', roomId => {
    for (const otherId of [
      `prefix-${roomId}`,
      `${roomId}-suffix`,
      `${roomId}0`,
      roomId.slice(0, -1),
      roomId.toLowerCase(),
      ` ${roomId}`,
      `${roomId} `,
    ]) {
      expect(shouldDisplayMapLabel(otherId)).toBe(true);
    }
  });
});
