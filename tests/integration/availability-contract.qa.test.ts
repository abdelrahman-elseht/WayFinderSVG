import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DataContractError, validateFloorBundle } from '@wayfinding/map-engine';

const canonicalFloor = JSON.parse(readFileSync('data/buildings/B03/GF.json', 'utf8')) as Record<string, any>;
const canonicalGraph = JSON.parse(readFileSync('data/buildings/B03/GF.graph.json', 'utf8'));
const canonicalContent = JSON.parse(readFileSync('content/B03/GF.json', 'utf8'));

function validate(mutator: (floor: Record<string, any>) => void) {
  const floor = structuredClone(canonicalFloor);
  mutator(floor);
  return () => validateFloorBundle(floor, structuredClone(canonicalGraph), structuredClone(canonicalContent));
}

describe('room availability contract', () => {
  it('keeps omitted availability backward compatible for unconfigured rooms', () => {
    const bundle = validateFloorBundle(structuredClone(canonicalFloor), structuredClone(canonicalGraph), structuredClone(canonicalContent));
    expect(bundle.floorData.rooms.find(room => room.code === 'G-28')?.availability?.status).toBe('unavailable');
    expect(bundle.floorData.rooms.filter(room => room.code !== 'G-28').every(room => room.availability === undefined)).toBe(true);
  }, 30000);
  it('requires independent visibility booleans for every generated room', () => {
    expect(canonicalFloor.rooms).toHaveLength(54);
    expect(canonicalFloor.rooms.every((room: any) => typeof room.mapVisible === 'boolean' && typeof room.destinationVisible === 'boolean')).toBe(true);
    expect(canonicalFloor.rooms.find((room: any) => room.code === 'G-02')).toMatchObject({mapVisible: false, destinationVisible: false});
    expect(canonicalFloor.rooms.find((room: any) => room.code === 'G-08')).toMatchObject({mapVisible: true, destinationVisible: false});
  });

  it.each([
    ['missing map visibility', (room: any) => { delete room.mapVisible; }],
    ['non-boolean map visibility', (room: any) => { room.mapVisible = 'yes'; }],
    ['missing destination visibility', (room: any) => { delete room.destinationVisible; }],
    ['non-boolean destination visibility', (room: any) => { room.destinationVisible = 1; }],
  ])('rejects %s', (_name, mutator) => {
    expect(validate(floor => mutator(floor.rooms[0]))).toThrow(DataContractError);
  });

  it.each([
    ['unknown status', (room: any) => { room.availability = { status: 'maintenance', reason: { en: 'Closed', ar: 'مغلقة' } }; }],
    ['missing English reason', (room: any) => { room.availability = { status: 'unavailable', reason: { ar: 'مغلقة' } }; }],
    ['missing Arabic reason', (room: any) => { room.availability = { status: 'unavailable', reason: { en: 'Closed' } }; }],
    ['unknown room reference', (room: any) => { room.availability = { status: 'available', reason: { en: 'Open', ar: 'مفتوحة' }, roomId: 'missing-room' }; }],
    ['contradictory destination state', (room: any) => { room.availability = { status: 'unavailable', reason: { en: '', ar: 'متاحة' } }; }],
  ])('rejects %s', (_name, mutator) => {
    expect(validate(floor => mutator(floor.rooms[0]))).toThrow(DataContractError);
  });
});
