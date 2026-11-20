// =============================================================================
// «SIGAMOS EN TU COMPUTADORA»: ¿le toca al teléfono, y adónde va? (20/11/2026, OA-10 y OD-12; módulo CHICO a propósito)
// =============================================================================
// ⚠️ NO IMPORTAR NADA PESADO ACÁ. Lo importa lib/movil-guard.ts, y a ése lo importa el LAYOUT RAÍZ (app/layout.tsx): todo lo que
// cuelgue de aquí entra en el análisis de CADA ruta. El 20/11 esto vivía en lib/onboarding-arranque-server.ts y movil-guard lo
// importaba de ahí: movil-guard pasó de 53 a 1786 módulos del repo, y el build de Vercel se colgó en «Creating an optimized production
// build» (antes compilaba en 2-3 min). Lo cuida tests/seguir-en-pc-liviano.test.ts.
// Sólo: la sesión, el workspace, el interruptor del V2, una lectura de `usuarios.perfil` y las reglas puras de lo visto y de quién opera.
// =============================================================================
import 'server-only';
import { getSesionAdmin, getUsuarioActual } from './auth';
import { estaImpersonando, getWorkspaceActual, wsSuperAdmin } from './workspace';
import { veOnboardingV2 } from './onboarding-v2/revision';
import { getSupabaseServer } from './supabase';
import { vistosDePerfil } from './recorridos';
import { puedeOperar } from './operaciones-reglas';

/**
 * Dónde se dibuja «Sigamos en tu computadora»: la página del onboarding (app/onboarding/page.tsx), que en el teléfono la muestra
 * mientras `seguirEnPcPendiente`. No es el hub retirado (tests/onboarding-hub-retirado.test.ts): el guard del teléfono y el Ops
 * Center de escritorio abierto en un teléfono mandan aquí por esta constante, sin nombrar la ruta.
 */
export const RUTA_SEGUIR_EN_PC = '/onboarding';

/** Lo visto del recorrido del Ops Center: el id con que lo anota el motor (`tutorial-<pestaña>`, app/_ui/tutorial/MotorTutorial.tsx). */
const ID_RECORRIDO_PC = 'tutorial-ops-center';

/**
 * EN EL TELÉFONO, «SIGAMOS EN TU COMPUTADORA» SE QUEDA (20/11, OA-10 y OD-12: la maqueta; Martín, 18/11: «la PC es obligatoria»).
 * ¿Le toca esa pantalla a quien entra desde el teléfono? Con el onboarding V2, terminado el primer paso (el onboarding ya no está
 * pendiente) y mientras NO vio el recorrido del Ops Center en la computadora (`tutorial-ops-center` en `usuarios.perfil`, lo que
 * guarda /api/recorridos). Mirando a un cliente, nunca. Quien opera la plataforma (Martín en la suya), nunca: su email está en la
 * revisión del V2 y el guard de /m lo dejaba fuera de su teléfono. Si no se puede leer, no (la persona entra como siempre).
 */
export async function seguirEnPcPendiente(): Promise<boolean> {
  try {
    if (await estaImpersonando().catch(() => true)) return false;
    const s = await getUsuarioActual();
    const email = s?.email?.trim().toLowerCase();
    if (!s || !email) return false;
    if (!veOnboardingV2({ email: s.email, ws: await getWorkspaceActual().catch(() => null) })) return false;
    // Quien opera: la misma regla que `quienOpera` (lib/second-brain-opera.ts), sin importar el Centro.
    if (puedeOperar(await getSesionAdmin().catch(() => null), await wsSuperAdmin().catch(() => -1))) return false;
    const { data, error } = await getSupabaseServer().from('usuarios').select('perfil').eq('email', email).maybeSingle();
    if (error) return false;
    return !Object.prototype.hasOwnProperty.call(vistosDePerfil((data as { perfil?: unknown } | null)?.perfil), ID_RECORRIDO_PC);
  } catch { return false; }
}
