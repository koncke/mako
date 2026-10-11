import 'server-only';

// =============================================================================
// Quién puede abrir el Video Editor — HOY, sólo el super admin
// =============================================================================
// El editor está en construcción (una copia de CapCut armada por tandas) y no se
// le muestra a ningún cliente hasta que Martín lo valide. Una sola pregunta, en
// UN lugar, que usan las dos pantallas del editor y el botón «Editar en el
// editor» de Video Generator: si cada uno decidiera por su cuenta, el día que se
// abra se abriría en dos de tres lados, y el tercero ofrecería un botón que rebota.
//
// ⚠️ La pregunta es por la PERSONA (`getSesionAdmin`, el rol global), no por el
// workspace. Es al revés que el token del repo (AGENTS.md, «La pregunta es por el
// WORKSPACE»), y a propósito: acá no se lee nada de la plataforma, se decide qué
// pantalla se le muestra a quién. El super admin prueba el editor ADENTRO de un
// cliente (ws3, el Cliente de Prueba) con el `?ws=`, y ahí tiene que seguir
// pudiendo entrar.
//
// ⚠️ Y el `adminOnly` del nav NO alcanza: el filtro del Sidebar es cosmético
// (lib/tab-access.ts). Sin este guard, la URL tecleada abre el editor a cualquiera.
//
// Para ABRIRLO a los clientes: `veEditorVideo` devuelve true para todos, se saca
// `adminOnly` de la entrada del nav y se decide la capa (lib/capas.ts: hoy lo ven
// `completo` y `agencia`, que tienen `navKeys: null`).

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { homeDeCapa, requireRolWs, requireSesion } from '@/lib/tab-access';
import { getCapaActual, rutaConWs } from '@/lib/workspace';

/** ¿Quien mira puede usar el Video Editor? */
export async function veEditorVideo(): Promise<boolean> {
  return (await getSesionAdmin()) != null;
}

/**
 * El guard de las dos pantallas del editor. Sin sesión → /login; quien no es super
 * admin → a SU casa, con el `?ws=` (un rebote pelado lo deja mirando su propia
 * cuenta en vez de la del cliente que tenía abierto); después, lo de toda tab
 * (capa con la key exacta del nav, rol y onboarding).
 *
 * El super admin se pregunta ANTES que `requireRolWs`: si no, un admin-cliente con
 * el onboarding sin terminar rebotaba al wizard en vez de a su casa, que es otra
 * pantalla para el mismo «esto no es para vos».
 */
export async function requireEditorVideo(): Promise<void> {
  await requireSesion();
  if (!(await veEditorVideo())) redirect(await rutaConWs(homeDeCapa(await getCapaActual())));
  await requireRolWs([], { nav: 'video-editor' });
}
