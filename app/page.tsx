import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual, getRolWsEfectivo } from '@/lib/workspace';
import { onboardingPendiente } from '@/lib/onboarding-state';
import Landing from './vsl/Landing';

export const dynamic = 'force-dynamic';

// La raíz es la landing de venta (antes vivía en /vsl): es lo primero que ve
// quien llega a makodigital.app sin cuenta. El chrome de la app no se monta acá
// — lo desmonta PublicRouteGate, que trata '/' como ruta pública.
export const metadata: Metadata = {
  title: 'MaKo — El mejor software para vender High Ticket con VSL Funnel',
  description:
    'Una sola plataforma para todo tu negocio: del primer clic en tu anuncio al cliente que paga. Menos herramientas, menos adivinanza, más cierres. Agenda tu llamada.',
};

// Con sesión, la raíz sigue siendo el repartidor de siempre: un admin sin
// impersonar arranca en su panel de gestión; un closer/setter en su CRM (no ven
// General); un admin-cliente con onboarding pendiente cae al wizard; el resto
// (admin-cliente, dueño, admin impersonando) va a la Vista General de su
// workspace. Sin sesión, se ve la landing.
export default async function Home() {
  const sesion = await getUsuarioActual();
  if (!sesion) return <Landing />;

  if (sesion.rol === 'admin') {
    const ws = await getWorkspaceActual(); // null si no está impersonando
    if (ws == null) redirect('/admin');
  }
  const rolWs = await getRolWsEfectivo();
  if (rolWs === 'closer' || rolWs === 'setter') redirect('/leads');
  if (await onboardingPendiente()) redirect('/onboarding');
  redirect('/general');
}
