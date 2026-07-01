// =============================================================================
// /admin — administración de usuarios del dashboard (solo admin)
// =============================================================================

import { redirect } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { AdminView } from './AdminView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminPage() {
  const sesion = await getUsuarioActual();
  if (!sesion || sesion.rol !== 'admin') redirect('/');
  return <AdminView />;
}
