import { redirect } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual, getRolWsEfectivo, rutaConWs } from '@/lib/workspace';
import { onboardingPendiente } from '@/lib/onboarding-state';

export const dynamic = 'force-dynamic';

// /inicio — el repartidor de la app. Vivía en '/' hasta que la raíz pasó a ser la
// landing pública: con el repartidor ahí, un usuario logueado no podía ver el VSL
// (la raíz lo pateaba a /general).
//
// Es la puerta de entrada: acá cae el login, el "Entrar" de la landing y cualquier
// pantalla que rebota a alguien "a su casa". No es pública, así que a quien no tiene
// sesión el gate lo manda a /login?next=/inicio y vuelve solo.
//
// Un admin sin impersonar arranca en su panel de gestión; un closer/setter en su CRM
// (no ven General); un admin-cliente con onboarding pendiente cae al wizard; el resto
// (admin-cliente, dueño, admin impersonando) va a la Vista General de su workspace.
export default async function Inicio() {
  const sesion = await getUsuarioActual();
  if (sesion?.rol === 'admin') {
    const ws = await getWorkspaceActual(); // null si no está impersonando
    if (ws == null) redirect('/admin');
  }
  // ⚠️ TODOS los destinos de acá van con `rutaConWs`. Este archivo es EL repartidor:
  // si pierde la pestaña, el admin que abre un cliente termina mirando otra cuenta con
  // el chrome de admin puesto — se lee como «la app se rompió», no como «me cambió de
  // cliente». Para un usuario sin `?ws=` devuelve el mismo string de siempre.
  const rolWs = await getRolWsEfectivo();
  if (rolWs === 'closer' || rolWs === 'setter') redirect(await rutaConWs('/crm'));
  if (await onboardingPendiente()) redirect(await rutaConWs('/onboarding'));
  redirect(await rutaConWs('/general'));
}
