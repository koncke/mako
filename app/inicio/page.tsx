import { redirect } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual, getRolWsEfectivo, rutaConWs } from '@/lib/workspace';
import { onboardingPendiente } from '@/lib/onboarding-state';
import { prefiereMovil } from '@/lib/movil-guard';
import { MOVIL_ACTIVO } from '@/lib/movil-desvio';

/** Si un teléfono que entra por /inicio va solo a MaKo Mobile (/m). Ver la nota de abajo. */
const MOBILE_AL_ENTRAR = MOVIL_ACTIVO;

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
    if (ws == null) redirect('/customer-success');
  }
  // MaKo Mobile: un TELÉFONO va a /m (lib/movil-dispositivo.ts), salvo que haya pedido
  // la «Versión completa» (cookie `mako_vista=escritorio`, 12 h). Va DESPUÉS del admin
  // sin workspace —/m es la app de UN negocio, sin cliente no tiene nada que mostrar— y
  // ANTES del reparto por rol: /m reparte solo (su guard manda el onboarding pendiente a
  // /m/configurar). Acá y no en el proxy: el proxy es el choke point de seguridad y lo
  // atraviesan también /api y la landing que leen Meta y Google.
  //
  // El interruptor es `MOVIL_ACTIVO` (lib/movil-desvio.ts): salió APAGADO con la v1 y se PRENDIÓ
  // con la v2 (11/10/2026, Martín: «a cualquiera que entre desde mobile le debe salir este
  // diseño»). El admin sin cliente ya salió arriba: /m no tiene nada que mostrarle.
  if (MOBILE_AL_ENTRAR && sesion && (await prefiereMovil())) redirect(await rutaConWs('/m'));
  // ⚠️ TODOS los destinos de acá van con `rutaConWs`. Este archivo es EL repartidor:
  // si pierde la pestaña, el admin que abre un cliente termina mirando otra cuenta con
  // el chrome de admin puesto — se lee como «la app se rompió», no como «me cambió de
  // cliente». Para un usuario sin `?ws=` devuelve el mismo string de siempre.
  const rolWs = await getRolWsEfectivo();
  if (rolWs === 'closer' || rolWs === 'setter') redirect(await rutaConWs('/crm'));
  if (await onboardingPendiente()) redirect(await rutaConWs('/onboarding'));
  redirect(await rutaConWs('/general'));
}
