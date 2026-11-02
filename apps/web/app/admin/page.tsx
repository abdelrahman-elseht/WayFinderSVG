import { headers } from 'next/headers';
import { adminAuthorized } from '../../lib/admin-auth';
import NavigationEditor from '../../components/admin/NavigationEditor';

export const dynamic = 'force-dynamic';
export default async function AdminPage() {
  if (!adminAuthorized(await headers())) return <main>Administrator authorization required.</main>;
  return <NavigationEditor />;
}
