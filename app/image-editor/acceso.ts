import 'server-only';

// =============================================================================
// Quién puede abrir el Image Editor — HOY, sólo el super admin
// =============================================================================
// El editor está en construcción: es Doory portado (ver _doory/COMMIT-DOORY y
// docs/diseno-editor-imagen.md) que se re-viste como Canva por tandas, y no se le
// muestra a ningún cliente hasta que Martín lo valide. Molde: la primera versión
// de app/video-editor/acceso.ts (commit b112e5b7).
//
// ⚠️ La pregunta es por la PERSONA (`getSesionAdmin`, el rol global), no por el
// workspace: acá no se lee nada de la plataforma, se decide qué pantalla se le
// muestra a quién. El super admin prueba el editor ADENTRO de un cliente con el
// `?ws=` y ahí tiene que seguir pudiendo entrar.
//
// ⚠️ Y el `adminOnly` del nav NO alcanza: el filtro del Sidebar es cosmético
// (lib/tab-access.ts). Sin este guard, la URL tecleada abre el editor a cualquier
// admin de un cliente `completo` o `agencia` (pasa hoy con /carousels).
//
// Para ABRIRLO a los clientes: `veEditorImagen` devuelve true para todos, se saca
// `adminOnly` de la entrada del nav y se decide la capa (lib/capas.ts). ANTES hay
// que resolver el crédito de la licencia de Doory (CreditoDoory.tsx): con código de
// Doory adentro, cada cliente que abra el editor lo tiene que ver.

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { homeDeCapa, requireRolWs, requireSesion } from '@/lib/tab-access';
import { getCapaActual, rutaConWs } from '@/lib/workspace';

/** ¿Quien mira puede usar el Image Editor? */
export async function veEditorImagen(): Promise<boolean> {
  return (await getSesionAdmin()) != null;
}

/**
 * El guard de las dos pantallas del editor. Sin sesión → /login; quien no es super
 * admin → a SU casa, con el `?ws=`; después, lo de toda tab (capa con la key exacta
 * del nav, rol y onboarding).
 */
export async function requireEditorImagen(): Promise<void> {
  await requireSesion();
  if (!(await veEditorImagen())) redirect(await rutaConWs(homeDeCapa(await getCapaActual())));
  await requireRolWs([], { nav: 'image-editor' });
}
