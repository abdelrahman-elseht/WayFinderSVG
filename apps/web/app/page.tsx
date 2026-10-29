import { createMapRegistry } from '@wayfinding/map-engine';
import floor from '@data/buildings/B03/GF.json';
import graph from '@data/buildings/B03/GF.graph.json';
import diagnosticGraph from '../../../artifacts/navigation-v2/GF.v2.graph.diagnostic.json';
import content from '@content/B03/GF.json';
import firstFloor from '@data/buildings/B03/01.json';
import firstGraph from '@data/buildings/B03/01.graph.json';
import firstContent from '@content/B03/01.json';
import { WayfindingApp } from '../components/WayfindingApp';

// Complete data bundles must share building metadata. The client still receives
// only the configured floor; interactive floor switching is a separate phase.
const diagnosticMode = process.env.NODE_ENV === 'development'
  && process.env.WAYFINDING_GRAPH_MODE === 'navigation-v2-diagnostic';
const registry = createMapRegistry([
  { floorData: floor, graph: diagnosticMode ? diagnosticGraph : graph, contents: content },
  { floorData: firstFloor, graph: firstGraph, contents: firstContent },
]);
export default async function Page({ searchParams }: { searchParams: Promise<{ floor?: string }> }) {
  const buildingId = process.env.WAYFINDING_BUILDING_ID ?? floor.building.id;
  const params = await searchParams;
  const floorId = params.floor ?? process.env.WAYFINDING_FLOOR_ID ?? floor.floor.id;
  const bundle = registry.getFloor(buildingId, floorId);
  if (!bundle) throw new Error(`Unregistered kiosk floor: ${buildingId}/${floorId}`);
  const kioskId = process.env.WAYFINDING_KIOSK_ID || undefined;
  if (kioskId) {
    const kiosk = registry.getKiosk(kioskId);
    if (!kiosk || kiosk.buildingId !== buildingId || kiosk.floorId !== floorId) throw new Error(`Kiosk ${kioskId} is not registered on ${buildingId}/${floorId}`);
  }
  return <>
    {diagnosticMode && <aside role="status" data-testid="navigation-v2-diagnostic-banner" style={{
      position: 'fixed', top: 8, left: 8, zIndex: 10000, padding: '8px 12px',
      background: '#fff3cd', color: '#422006', border: '2px solid #b45309', fontWeight: 700,
    }}>DEVELOPMENT TEST ONLY | Navigation V2 diagnostic candidate | G-39 and G-40 have no incident edges</aside>}
    <WayfindingApp {...bundle} floorOptions={registry.floors.filter(item => item.floorData.building.id === buildingId).map(item => item.floorData.floor)} configuredKioskId={kioskId} />
  </>;
}
