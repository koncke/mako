// =============================================================================
// /admin — los clientes de la plataforma (solo super admin)
// =============================================================================

import { redirect } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { AdminView } from './AdminView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sesion = await getUsuarioActual();
  if (!sesion || sesion.rol !== 'admin') redirect('/inicio');

  // ⚠️ EL DEEP-LINK VIEJO SIGUE ANDANDO, y el redirect va en el SERVER a propósito.
  // `/admin?tab=copy` abría la tercera sub-tab, que desde el 27/09/2026 es una ruta
  // (/admin/copywriting). Lo leía un `useEffect` de MONTAJE en el cliente, y por eso
  // ya se había reportado dos veces como «me redirige»: estando ya en /admin, una
  // navegación del router no remonta nada y te dejaba mirando Clientes. Un redirect
  // del server no tiene ese problema — y sacarlo sin reemplazo dejaría los links
  // viejos aterrizando en una pantalla que no es la que prometen.
  const q = await searchParams;
  if (q.tab === 'copy') redirect('/admin/copywriting');

  return <AdminView />;
}
