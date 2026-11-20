// =============================================================================
// «SIGAMOS EN TU COMPUTADORA»: ¿le toca al teléfono, y adónde va? (20/11/2026, OA-10 y OD-12; módulo CHICO a propósito)
// =============================================================================
// ⚠️ NO IMPORTAR NADA PESADO ACÁ. Lo importa lib/movil-guard.ts, y a ése lo importa el LAYOUT RAÍZ (app/layout.tsx): todo lo que
// cuelgue de aquí entra en el análisis de CADA ruta. El 20/11 esto vivía en lib/onboarding-arranque-server.ts y movil-guard lo
// importaba de ahí: movil-guard pasó de 53 a 1786 módulos del repo, y el build de Vercel se colgó en «Creating an optimized production
// build» (antes compilaba en 2-3 min). Lo cuida tests/seguir-en-pc-liviano.test.ts.
// Sólo: la sesión, el workspace, el interruptor del V2, `usuarios.perfil` (leer lo visto; anotar que empezó el V2) y las reglas puras
// de lo visto y de quién opera.
// =============================================================================
import 'server-only';
import { getSesionAdmin, getUsuarioActual } from './auth';
import { estaImpersonando, getWorkspaceActual, wsSuperAdmin } from './workspace';
import { escribeComoElCliente, veOnboardingV2 } from './onboarding-v2/revision';
import { getSupabaseServer } from './supabase';
import { CLAVE_EMPEZO_V2, empezoElV2, vistosDePerfil } from './recorridos';
import { emailDelDuenoDelWs } from './dueno-del-ws';
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
 * DE QUIÉN ES EL ESTADO DEL ONBOARDING V2 QUE SE DIBUJA (Martín, 20/11, probando en Lalaland «como administrador»: la vista como
 * administrador muestra LO MISMO que ve el cliente). La persona logueada; mirando un negocio como administrador, su DUEÑO. Lo que se
 * mira por persona (empezó el V2, vio el recorrido) se lee y se anota en la fila del dueño. `mirando`: un administrador mira el negocio.
 */
export async function personaDelOnboarding(): Promise<{ email: string; ws: number | null; mirando: boolean } | null> {
  const s = await getUsuarioActual();
  if (!s?.email) return null;
  const ws = await getWorkspaceActual().catch(() => null);
  const mirando = await estaImpersonando().catch(() => false);
  const email = mirando ? await emailDelDuenoDelWs(ws).catch(() => '') : s.email.trim().toLowerCase();
  return email ? { email, ws, mirando } : null;
}

/**
 * EN EL TELÉFONO, «SIGAMOS EN TU COMPUTADORA» SE QUEDA (20/11, OA-10 y OD-12: la maqueta; Martín, 18/11: «la PC es obligatoria»).
 * ¿Le toca esa pantalla a quien entra desde el teléfono? Sólo a quien EMPEZÓ el onboarding V2 (su marca, `empezoElV2`), y mientras
 * NO vio el recorrido del Ops Center en la computadora (`tutorial-ops-center` en `usuarios.perfil`, lo que guarda /api/recorridos).
 * Decidido por el Cerebro (20/11, tarde, en la memoria): con el interruptor para todos, un cliente que ya usa MaKo Mobile y nunca
 * pasó por el V2 no tiene la marca, y nunca queda trabado en /onboarding. Mirando un negocio como administrador, lo del DUEÑO
 * (`personaDelOnboarding`: lo mismo que ve el cliente; antes daba siempre que no, y la barra no se escondía). Quien opera la plataforma
 * en SU cuenta (Martín en la suya), nunca: su email está en la revisión del V2 y el guard de /m lo dejaba fuera de su teléfono. Si no
 * se puede leer, no (la persona entra como siempre).
 */
export async function seguirEnPcPendiente(): Promise<boolean> {
  try {
    const p = await personaDelOnboarding();
    if (!p) return false;
    const { email } = p;
    if (!veOnboardingV2({ email, ws: p.ws })) return false;
    // Quien opera, en su cuenta: la misma regla que `quienOpera` (lib/second-brain-opera.ts), sin importar el Centro. Mirando un
    // negocio, no: ahí se ve lo del cliente.
    if (!p.mirando && puedeOperar(await getSesionAdmin().catch(() => null), await wsSuperAdmin().catch(() => -1))) return false;
    const { data, error } = await getSupabaseServer().from('usuarios').select('perfil').eq('email', email).maybeSingle();
    if (error) return false;
    const perfil = (data as { perfil?: unknown } | null)?.perfil;
    if (!empezoElV2(perfil)) return false;
    return !Object.prototype.hasOwnProperty.call(vistosDePerfil(perfil), ID_RECORRIDO_PC);
  } catch { return false; }
}


/**
 * Anota que la persona empezó el onboarding V2: lo llama la ruta del arranque (app/api/onboarding/arranque/route.ts) con cada respuesta
 * del V2, y escribe sólo la primera vez. Mirando un negocio como administrador, en su DUEÑO (`personaDelOnboarding`: quien contesta así
 * el onboarding del negocio lo está haciendo como el cliente, y el cliente lo ve igual).
 * ⚠️ El jsonb `perfil` tiene varios escritores y cada uno lo reescribe ENTERO: se conserva todo lo demás y se escribe con
 * compare-and-set sobre `updated_at`, como /api/recorridos. Nunca tira: una marca que no se pudo anotar deja a la persona
 * entrar a MaKo Mobile como siempre, que es lo seguro.
 */
export async function anotarQueEmpezoElV2(): Promise<void> {
  try {
    const p = await personaDelOnboarding();
    // Mirando un negocio, se anota en su dueño SÓLO en los de prueba (ws 3 y ws 9; la D7, decidida el 20/11): soporte mirando una
    // cuenta nunca le cambia el onboarding al cliente.
    if (!p || (p.mirando && !escribeComoElCliente(p.ws))) return;
    const { email } = p;
    const sb = getSupabaseServer();
    for (let intento = 0; intento < 3; intento++) {
      const { data, error } = await sb.from('usuarios').select('id, perfil, updated_at').eq('email', email).maybeSingle();
      if (error || !data) return;
      const fila = data as { id: number; perfil: unknown; updated_at: string | null };
      if (empezoElV2(fila.perfil)) return;
      const ahora = new Date().toISOString();
      const base = fila.perfil && typeof fila.perfil === 'object' && !Array.isArray(fila.perfil) ? (fila.perfil as Record<string, unknown>) : {};
      let q = sb.from('usuarios').update({ perfil: { ...base, [CLAVE_EMPEZO_V2]: ahora }, updated_at: ahora }).eq('id', fila.id);
      q = fila.updated_at == null ? q.is('updated_at', null) : q.eq('updated_at', fila.updated_at);
      const r = await q.select('id');
      if (r.error || (Array.isArray(r.data) && r.data.length > 0)) return;
    }
  } catch { /* nunca tira */ }
}
