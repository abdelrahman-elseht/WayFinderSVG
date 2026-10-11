import { createMapRegistry } from '@wayfinding/map-engine';
import floor from '@data/buildings/B03/GF.json';
import graph from '@data/buildings/B03/GF.graph.json';
import content from '@content/B03/GF.json';
import firstFloor from '@data/buildings/B03/01.json';
import firstGraph from '@data/buildings/B03/01.graph.json';
import firstContent from '@content/B03/01.json';
import { WayfindingApp } from '../components/WayfindingApp';

// Complete data bundles must share building metadata. The client still receives
// only the configured floor; interactive floor switching is a separate phase.
const registry = createMapRegistry([
  { floorData: floor, graph, contents: content },
  { floorData: firstFloor, graph: firstGraph, contents: firstContent },
]);
export default function Page() {
  const buildingId = process.env.WAYFINDING_BUILDING_ID ?? floor.building.id;
  const floorId = process.env.WAYFINDING_FLOOR_ID ?? floor.floor.id;
  const bundle = registry.getFloor(buildingId, floorId);
  if (!bundle) throw new Error(`Unregistered kiosk floor: ${buildingId}/${floorId}`);
  const kioskId = process.env.WAYFINDING_KIOSK_ID || undefined;
  if (kioskId) {
    const kiosk = registry.getKiosk(kioskId);
    if (!kiosk || kiosk.buildingId !== buildingId || kiosk.floorId !== floorId) throw new Error(`Kiosk ${kioskId} is not registered on ${buildingId}/${floorId}`);
  }
  return <WayfindingApp {...bundle} configuredKioskId={kioskId} />;
}
