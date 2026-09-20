import type { Building, Kiosk } from './types';
import { validateFloorBundle, type FloorBundle } from './validate';

/** Data-driven catalog; adding a real floor requires its own validated source bundle. */
export function createMapRegistry(inputs: { floorData: unknown; graph: unknown; contents: unknown }[]) {
  const floors = new Map<string, FloorBundle>();
  const buildings = new Map<string, Building>();
  const kiosks = new Map<string, Kiosk>();
  for (const input of inputs) {
    const bundle = validateFloorBundle(input.floorData, input.graph, input.contents);
    const { building, floor } = bundle.floorData;
    const key = `${building.id}/${floor.id}`;
    if (floors.has(key)) throw new Error(`Duplicate floor: ${key}`);
    const previous = buildings.get(building.id);
    if (previous && (JSON.stringify(previous.name)!==JSON.stringify(building.name) || [...previous.floorIds].sort().join('/')!==[...building.floorIds].sort().join('/'))) throw new Error(`Inconsistent building metadata: ${building.id}`);
    buildings.set(building.id, building); floors.set(key, bundle);
    for (const kiosk of bundle.floorData.kiosks) {
      if(kiosks.has(kiosk.id)) throw new Error(`Duplicate kiosk: ${kiosk.id}`);
      kiosks.set(kiosk.id,kiosk);
    }
  }
  for (const building of buildings.values()) for (const floorId of building.floorIds) {
    if(!floors.has(`${building.id}/${floorId}`)) throw new Error(`Missing registered floor: ${building.id}/${floorId}`);
  }
  return {
    buildings: [...buildings.values()],
    floors: [...floors.values()],
    getFloor: (buildingId: string, floorId: string) => floors.get(`${buildingId}/${floorId}`) ?? null,
    getKiosk: (kioskId: string) => kiosks.get(kioskId) ?? null,
  };
}
