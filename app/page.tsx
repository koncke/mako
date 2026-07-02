import { redirect } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

// Home: un admin sin impersonar arranca en su panel de gestión; el resto
// (usuarios, dueño, admin impersonando) va a la Vista General de su workspace.
export default async function Home() {
  const sesion = await getUsuarioActual();
  if (sesion?.rol === 'admin') {
    const ws = await getWorkspaceActual(); // null si no está impersonando
    if (ws == null) redirect('/admin');
  }
  redirect('/general');
}
