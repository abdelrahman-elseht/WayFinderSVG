import { headers } from 'next/headers';
import { adminAuthorized } from '../../lib/admin-auth';
import AdminFloorView from '../../components/admin/AdminFloorView';

export const dynamic = 'force-dynamic';
export default async function AdminPage() {
  if (!adminAuthorized(await headers())) return <main>Administrator authorization required.</main>;
  return <AdminFloorView />;
}
