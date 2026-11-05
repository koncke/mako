import { redirect } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { getCapaActual, getWorkspaceActual, rutaConWs } from '@/lib/workspace';
import { onboardingPendiente } from '@/lib/onboarding-state';
import { prefiereMovil } from '@/lib/movil-guard';
import { MOVIL_ACTIVO } from '@/lib/movil-desvio';
import { ENTRADA_MOVIL } from '@/lib/movil-rutas';
import { quienOpera } from '@/lib/second-brain-opera';
import { casaEnLaComputadora } from '@/lib/ops-center-ruta';

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
// En la COMPUTADORA todos entran al Ops Center desde el 21/10/2026 (`casaEnLaComputadora`, lib/ops-center-ruta.ts): el
// super admin al suyo (/admin/operaciones) y los demás —el cliente, su closer y su setter, el super admin mirando a un
// cliente— al de su negocio (/second-brain). Un admin-cliente con onboarding pendiente cae antes al wizard. Hasta ese
// día el super admin con workspace propio (Martín, ws 9) y el cliente iban a /general, que redirige al Dashboard, y el
// closer/setter a su CRM. Un admin SIN workspace sigue en su panel de clientes: no tiene Ops Center que abrir.
export default async function Inicio() {
  const sesion = await getUsuarioActual();
  // MaKo Mobile: un TELÉFONO va a /m (lib/movil-dispositivo.ts), salvo que haya pedido
  // la «Versión completa» (cookie `mako_vista=escritorio`, 12 h). Va ANTES del reparto por rol:
  // /m reparte solo (su guard manda el onboarding pendiente a /m/configurar). Acá y no en el
  // proxy: el proxy es el choke point de seguridad y lo atraviesan también /api y la landing que
  // leen Meta y Google. El interruptor es `MOVIL_ACTIVO` (lib/movil-desvio.ts).
  const telefono = MOBILE_AL_ENTRAR && !!sesion && (await prefiereMovil());
  if (sesion?.rol === 'admin') {
    const ws = await getWorkspaceActual(); // null si no está impersonando
    // En el teléfono, el admin SIN cliente va a /m de SU negocio: `requireMovil` le pone el `?ws=`
    // del workspace de plataforma. Hasta el 12/10/2026 iba a /customer-success y el desvío lo dejaba
    // en el escritorio (Martín: «No aún no veo la versión mobile, me sale todo igual...»).
    // Con LAS MISMAS RUTAS (13/10/2026) el teléfono va a /general: el proxy le sirve ahí Today.
    // Desde el 20/10/2026 el teléfono entra al Ops Center, la tab principal (`ENTRADA_MOVIL`); hasta ese día, a /general.
    // En la computadora, su grilla de negocios: Customers desde el 25/10/2026 (antes era /clients, que la dibujaba).
    if (ws == null) redirect(telefono ? ENTRADA_MOVIL : '/admin');
  }
  if (telefono) redirect(await rutaConWs(ENTRADA_MOVIL));
  // ⚠️ TODOS los destinos de acá van con `rutaConWs`. Este archivo es EL repartidor:
  // si pierde la pestaña, el admin que abre un cliente termina mirando otra cuenta con
  // el chrome de admin puesto — se lee como «la app se rompió», no como «me cambió de
  // cliente». Para un usuario sin `?ws=` devuelve el mismo string de siempre.
  // ⚠️ LA COMPUTADORA, DESDE ACÁ. `quienOpera` es la guarda del Centro (rol admin, SU workspace de plataforma, 2FA) y da
  // false mirando a un cliente: así el super admin que abre `/inicio?ws=N` entra al Ops Center de ESE negocio y nunca al
  // suyo con la cuenta del cliente puesta. El que opera no pasa por el onboarding: el wizard es de un negocio, y el suyo
  // es la plataforma. El orden lo fija tests/inicio-ops-center.test.ts.
  const opera = await quienOpera();
  if (!opera && (await onboardingPendiente())) redirect(await rutaConWs('/onboarding'));
  redirect(await rutaConWs(casaEnLaComputadora({ opera, capa: opera ? null : await getCapaActual() })));
}
