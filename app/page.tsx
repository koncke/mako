import { redirect } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual, getRolWsEfectivo } from '@/lib/workspace';
import { onboardingPendiente } from '@/lib/onboarding-state';

export const dynamic = 'force-dynamic';

// Home: un admin sin impersonar arranca en su panel de gestión; un closer/setter
// arranca en su CRM (no ven General); un admin-cliente con onboarding pendiente
// cae al wizard; el resto (admin-cliente, dueño, admin impersonando) va a la
// Vista General de su workspace.
export default async function Home() {
  const sesion = await getUsuarioActual();
  if (sesion?.rol === 'admin') {
    const ws = await getWorkspaceActual(); // null si no está impersonando
    if (ws == null) redirect('/admin');
  }
  const rolWs = await getRolWsEfectivo();
  if (rolWs === 'closer' || rolWs === 'setter') redirect('/leads');
  if (await onboardingPendiente()) redirect('/onboarding');
  redirect('/general');
}
