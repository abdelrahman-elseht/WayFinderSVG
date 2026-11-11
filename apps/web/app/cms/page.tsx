import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminAuthorized } from '../../lib/admin-auth';
import { contentRevision, isCmsFloorId, readContentState } from '../../lib/content-store';
import type { Floor, Room } from '@wayfinding/map-engine';
import floor from '@data/buildings/B03/GF.json';
import firstFloor from '@data/buildings/B03/01.json';
import CmsEditor from '../../components/admin/CmsEditor';

export const dynamic = 'force-dynamic';

export default async function CmsPage({ searchParams }: { searchParams: Promise<{ floorId?: string }> }) {
  if (!adminAuthorized(await headers())) redirect('/admin');
  const requested = (await searchParams).floorId ?? 'GF';
  const floorId = isCmsFloorId(requested) ? requested : 'GF';
  const data = floorId === 'GF' ? floor : firstFloor;
  const state = await readContentState(floorId);
  return <CmsEditor floorId={floorId} rooms={data.rooms as Room[]} floor={data.floor as Floor} contents={state.draft} published={state.published} colorGroups={state.draftColorGroups} revision={contentRevision(state, floorId)} />;
}
