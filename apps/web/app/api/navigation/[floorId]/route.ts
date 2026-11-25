import { createMapRegistry, type FloorBundle } from '@wayfinding/map-engine';
import floor from '@data/buildings/B03/GF.json';
import graph from '@data/buildings/B03/GF.graph.json';
import diagnosticGraph from '../../../../../../artifacts/navigation-v2/GF.v2.graph.diagnostic.json';
import content from '@content/B03/GF.json';
import firstFloor from '@data/buildings/B03/01.json';
import firstGraph from '@data/buildings/B03/01.graph.json';
import firstContent from '@content/B03/01.json';
import { publishedContent } from '../../../../lib/content-store';
import { publishedNavigation } from '../../../../lib/navigation-store';
import { publicNavigationBundle, publicNavigationRevision } from '../../../../lib/public-navigation-bundle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const diagnosticMode = process.env.NODE_ENV === 'development'
  && process.env.WAYFINDING_GRAPH_MODE === 'navigation-v2-diagnostic';
const registry = createMapRegistry([
  { floorData: floor, graph: diagnosticMode ? diagnosticGraph : graph, contents: content, allowUnsafeGeometry: true },
  { floorData: firstFloor, graph: firstGraph, contents: firstContent, allowUnsafeGeometry: true },
]);

type FloorId = 'GF' | '01';

function isFloorId(value: string): value is FloorId {
  return value === 'GF' || value === '01';
}

function headers(revision: string, immutable: boolean) {
  return {
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-store',
    ETag: `"${revision}"`,
  };
}

export async function GET(request: Request, context: { params: Promise<{ floorId: string }> }) {
  const { floorId } = await context.params;
  if (!isFloorId(floorId)) return Response.json({ error: 'Unknown floor' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const ground = floorId === 'GF';
  const selectedFloor = ground ? floor : firstFloor;
  const selectedGraph = ground && diagnosticMode ? diagnosticGraph : ground ? graph : firstGraph;
  const selectedContent = await publishedContent(floorId).catch(() => ground ? content : firstContent);
  const bundle: FloorBundle = ground && diagnosticMode
    ? { ...registry.getFloor(floor.building.id, floorId)!, contents: selectedContent }
    : await publishedNavigation(floorId, selectedFloor, selectedGraph, selectedContent);
  const publicBundle = publicNavigationBundle(bundle);
  const revision = publicNavigationRevision(publicBundle);
  const requestedRevision = new URL(request.url).searchParams.get('revision');
  const changed = requestedRevision !== null && requestedRevision !== revision;
  return Response.json({ revision, bundle: publicBundle }, {
    status: changed ? 409 : 200,
    headers: headers(revision, requestedRevision === revision),
  });
}
