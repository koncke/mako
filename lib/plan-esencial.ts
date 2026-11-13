// =============================================================================
// plan-esencial — ¿el negocio paga MaKo Esencial por la pasarela? (23/10/2026)
// =============================================================================
// La regla está en lib/plan-esencial-reglas.ts (pura). Esto la lee contra la base: el de la sesión (una vez por request) y
// el de un negocio dado (para lo que corre sin sesión, como MaKo por WhatsApp).
// ⚠️ ANTE LA DUDA, NO HAY CANDADO NI TOPE: si no se puede leer la suscripción, se deja pasar. Sacarle una tab a quien paga es
//    peor que dejarle ver una de más un rato (lo pidió el Cerebro, 23/10/2026: «que nunca un cliente que paga Pro… pierda una
//    tab»).
import 'server-only';
import { cache } from 'react';
import { getCapaActual, getWorkspaceActual, wsSuperAdmin } from './workspace';
import { getSupabaseServer } from './supabase';
import { KEY_PLAN_CAMBIADO, WS_SIN_PLAN_DE_PASARELA, esEsencialPorPasarela, rigeElPlanDeAgencia } from './plan-esencial-reglas';
import { FILTRO_SUSCRIPCION_DE_MAKO } from './prueba-plan-reglas';
import { CLAVE_CORTE, leerCorte } from './plan-acceso-reglas';

/**
 * ¿La cuenta la soltó su agencia y sigue con el corte `sin-agencia` vigente (lib/agencia-baja.ts)? Mientras usa lo que ya
 * pagó (la pausa programada), no tiene cartera ni plan propio, y sin esto quedaba con lo de Pro y sin topes (tercera pasada
 * de la revisión de plata). La usan `esEsencialDe` y `aplicanTopes` (lib/topes-plan-server.ts). Tira si no se puede leer.
 */
/**
 * ¿Rige el plan de esta cuenta de agencia? (H1 de la verificación independiente, lib/plan-esencial-reglas.ts): con el plan
 * elegido (la marca `agency.plan_cambiado`), sí; las de antes, sin elegir, siguen como Pro mientras
 * `CUENTAS_DE_AGENCIA_SIN_ELEGIR_SON_PRO`. Tira si no se puede leer.
 */
export async function rigeElPlanDeAgenciaEn(ws: number): Promise<boolean> {
  const { data, error } = await getSupabaseServer().from('app_settings').select('workspace_id').eq('workspace_id', ws).eq('key', KEY_PLAN_CAMBIADO).limit(1);
  if (error) throw new Error(error.message);
  return rigeElPlanDeAgencia(!!data?.length);
}

export async function soltadaPorSuAgencia(ws: number): Promise<boolean> {
  const { data, error } = await getSupabaseServer().from('app_settings').select('value').eq('workspace_id', ws).eq('key', CLAVE_CORTE).maybeSingle();
  if (error) throw new Error(error.message);
  const c = leerCorte((data as { value?: string } | null)?.value ?? null);
  return c?.motivo === 'sin-agencia' && c.vigente;
}

/**
 * La capa del plan que se le VENDIÓ al negocio (`completo` = Esencial, `agencia` = Pro), o null si no paga un plan. La leen
 * `esEsencialDe` y `planVendidoDe`. Tira si no se puede leer.
 */
async function capaVendidaDe(ws: number, capa: string | null, plataforma: number | null): Promise<string | null> {
  // La MISMA lectura que `suscripcionDeMakoDe` (lib/cobros.ts: su suscripción pagada más reciente, en la plataforma), sin
  // importar el módulo: lib/cobros alcanza una IA en su grafo, y esto lo importan /api/auth/me y todas las páginas
  // (tests/d6b-rutas.test.ts). tests/plan-esencial.test.ts ata los filtros de las dos.
  // Con la PRUEBA GRATIS autorizada (25/10/2026): el negocio en prueba tiene los topes de su plan desde el primer día.
  const { data, error } = await getSupabaseServer().from('cobros').select('alta_capa')
    .eq('workspace_id', plataforma).eq('alta_ws', ws).eq('tipo', 'suscripcion').or(FILTRO_SUSCRIPCION_DE_MAKO)
    .order('pagado_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  let capaVendida = (data as { alta_capa?: string | null } | null)?.alta_capa ?? null;
  // Una suscripción propia SIN `alta_capa` (la que se le pasó al cliente al soltarlo su agencia, o su primer plan propio:
  // lib/agencia-baja.ts, lib/compra-plan.ts → primerPlanPropio): su plan es su capa (segunda pasada, hallazgo B).
  if (!capaVendida && data) capaVendida = capa ?? null;
  // LA CUENTA DE UNA AGENCIA (29/10/2026, revisión de plata, hallazgo 4): la paga su agencia, no tiene suscripción propia, y
  // su plan ES su capa (lib/agencia-cobro-reglas.ts, `CAPA_DE_PLAN`). Sin esto, el Esencial de US$47 tenía las tabs de Pro,
  // las automatizaciones sin tope, el piloto automático y el scraper. La misma cartera que `aplicanTopes` (lib/topes-plan-server.ts).
  if (!capaVendida) {
    const { data: cart, error: eCart } = await getSupabaseServer().from('agencia_clientes').select('cliente_ws').eq('cliente_ws', ws).neq('estado', 'revocado').limit(1);
    if (eCart) throw new Error(eCart.message);
    // Las de antes, sin el plan elegido, siguen como Pro (H1 de la verificación independiente).
    if ((cart?.length || (await soltadaPorSuAgencia(ws))) && (await rigeElPlanDeAgenciaEn(ws))) capaVendida = capa ?? null;
  }
  return capaVendida;
}

/**
 * ¿El negocio paga un plan de MaKo (por la pasarela o por su agencia)? Para la ficha de los tickets (12/11/2026, después del
 * #89: decía la capa, «Completo», y se leyó como otro plan). NO usa `aplicanTopes` (lib/topes-plan-server.ts) a propósito:
 * ése importa lib/cobros, que alcanza una IA, y la Ticketera la llama el Ops Center (tests/d6b-rutas.test.ts, caso 4 — dio
 * rojo así). Lo mismo que `esEsencialDe`: el ws1 y la plataforma nunca. Tira si no se puede leer.
 */
export async function pagaUnPlanDe(ws: number, capa: string | null): Promise<boolean> {
  const plataforma = await wsSuperAdmin();
  if (ws === plataforma || WS_SIN_PLAN_DE_PASARELA.has(ws)) return false;
  if (capa !== 'completo' && capa !== 'agencia') return false;
  return (await capaVendidaDe(ws, capa, plataforma)) != null;
}

/** El negocio `ws`, con la capa que tiene hoy (si se sabe; si no, se lee). */
export async function esEsencialDe(ws: number, capaDeHoy?: string | null): Promise<boolean> {
  try {
    const plataforma = await wsSuperAdmin();
    let capa = capaDeHoy;
    if (capa === undefined) {
      const { data } = await getSupabaseServer().from('workspaces').select('capa').eq('id', ws).maybeSingle();
      capa = (data as { capa?: string } | null)?.capa ?? null;
    }
    // Lo barato primero: sin capa `completo`, o el ws1 o la plataforma, no hace falta leer cobros.
    if (!esEsencialPorPasarela({ ws, wsPlataforma: plataforma, capa, capaVendida: 'completo' })) return false;
    const capaVendida = await capaVendidaDe(ws, capa ?? null, plataforma);
    return esEsencialPorPasarela({ ws, wsPlataforma: plataforma, capa, capaVendida });
  } catch (e) {
    console.warn(`[plan-esencial] no pude leer el plan del negocio ${ws}; sin candado:`, e instanceof Error ? e.message : String(e));
    return false;
  }
}

export const esEsencialDeLaSesion = cache(async (): Promise<boolean> => {
  try {
    const ws = await getWorkspaceActual();
    return ws == null ? false : await esEsencialDe(ws, await getCapaActual());
  } catch {
    return false;
  }
});
