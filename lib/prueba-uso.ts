// =============================================================================
// prueba-uso — si un negocio está EN PRUEBA y cuánto usó de lo que la prueba topa (25/10/2026)
// =============================================================================
// El Cerebro (25/10): «Vale el plan elegido, con un tope de prueba en lo que alguien se puede "llevar" y después irse... cada
// pantalla le dice al que llega al tope "Disponible al terminar tu prueba" con un botón para empezar ya el plan». Los topes
// están en lib/topes-plan.ts (`TOPES_PRUEBA`, con `topeDe(CAPA_PRUEBA, …)`); acá, la lectura y el contador.
//
// EN PRUEBA = su suscripción de MaKo (la misma lectura que `suscripcionDeMakoDe`, con `FILTRO_SUSCRIPCION_DE_MAKO`) es una
// prueba que todavía no se cobró. Con el primer cobro, deja de estar en prueba y los topes se van solos.
// EL CONTADOR: no hay un registro de usos por negocio (los videos y las imágenes se generan en el navegador, con el Google
// Flow del cliente, y no todo queda en una tabla). Cada pantalla que crea suma en `prueba.uso` (un setting del negocio),
// SÓLO mientras está en prueba. Sin poder leer, deja pasar (AGENTS.md, «Hacer cumplir un tope del plan»).
// Sin importar lib/cobros (alcanza una IA en su grafo): lo usan acciones que el navegador llama (tests/d6b-rutas.test.ts).
// =============================================================================

import 'server-only';
import { cache } from 'react';
import { getSupabaseServer } from './supabase';
import { getWorkspace, runWithWorkspace, wsSuperAdmin } from './workspace';
import { CLAVE_PLAN_A_MANO, leerPlanAMano } from './plan-a-mano-reglas';
import { nombreDePlan } from './clientes-plataforma-reglas';
import { getSetting, setSetting } from './settings';
import { diasQueQuedan, esPruebaDePlan, FILTRO_SUSCRIPCION_DE_MAKO } from './prueba-plan-reglas';
import { NOMBRE_COSA_PRUEBA, textoTopePrueba, topeEnPrueba, type TopePrueba } from './topes-plan';
import { formatoMonto } from './pasarela-moneda';

export const CLAVE_USO_PRUEBA = 'prueba.uso';

export type EstadoPrueba = {
  enPrueba: boolean; capa: string | null; hasta: string | null;
  /** Lo que se cobra al terminar («US$ 97/mes») y el plan («MaKo Pro»): lo dicen el cartel y la franja. */
  despues: string | null; plan: string | null;
  /** Los días que quedan, contados al leer (fuera del render: una pantalla no lee el reloj). */
  dias: number | null;
};

/** ¿Este negocio está en su prueba gratis? Una lectura por pedido (`cache`). Sin poder leer: no está (deja pasar). */
export const estadoDePrueba = cache(async (ws: number): Promise<EstadoPrueba> => {
  const nada: EstadoPrueba = { enPrueba: false, capa: null, hasta: null, despues: null, plan: null, dias: null };
  try {
    const plataforma = await wsSuperAdmin();
    if (ws === plataforma) return nada;
    const { data, error } = await getSupabaseServer().from('cobros').select('tipo, estado, creado_por, alta_capa, inicio_at, monto, moneda, concepto')
      .eq('workspace_id', plataforma).eq('alta_ws', ws).eq('tipo', 'suscripcion').or(FILTRO_SUSCRIPCION_DE_MAKO)
      .order('pagado_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    const c = data as { tipo: string; estado: string; creado_por: string | null; alta_capa: string | null; inicio_at: string | null; monto: number | null; moneda: string | null; concepto: string | null } | null;
    // Sin ninguna suscripción de MaKo, el plan a mano (si tiene). Con una pagada, nada: con el primer cobro los topes se van solos,
    // aunque haya quedado un vencimiento a mano de antes.
    if (!c) return await deUnPlanAMano(ws, nada);
    if (!esPruebaDePlan(c) || c.estado !== 'pendiente') return nada;
    // El concepto es «MaKo Pro · mensual» (`conceptoDelPlan`): el plan es lo de antes del punto.
    const plan = (c.concepto ?? '').replace(/\s*·\s*mensual$/i, '').trim() || null;
    const despues = c.monto != null && c.moneda ? `${formatoMonto(Number(c.monto), c.moneda)}/mes` : null;
    return { enPrueba: true, capa: c.alta_capa, hasta: c.inicio_at, despues, plan, dias: diasQueQuedan(c.inicio_at, Date.now()) };
  } catch (e) {
    console.warn(`[prueba-uso] no pude leer si el negocio ${ws} está en prueba; sin topes de prueba:`, e instanceof Error ? e.message : String(e));
    return nada;
  }
});

/**
 * EL PLAN DADO A MANO CON VENCIMIENTO (28/10/2026, lib/plan-a-mano-reglas.ts): sin una prueba por la pasarela, el negocio que
 * tiene uno está «en prueba» con el plan que le dieron, vigente o vencido sin resolver: los topes de la prueba valen hasta que
 * Martín le saque el vencimiento. Sin cobro que lo diga, «después» no se sabe. Sin poder leer: no está (deja pasar).
 */
async function deUnPlanAMano(ws: number, nada: EstadoPrueba): Promise<EstadoPrueba> {
  const p = leerPlanAMano(await runWithWorkspace(ws, () => getSetting(CLAVE_PLAN_A_MANO)));
  if (!p) return nada;
  const w = await getWorkspace(ws);
  const capa = w?.capa ?? null;
  if (!capa) return nada;
  return { enPrueba: true, capa, hasta: p.hasta, despues: null, plan: nombreDePlan(capa), dias: diasQueQuedan(p.hasta, Date.now()) };
}

/** Lo usado en la prueba, por cosa. */
export function leerUsoDePrueba(crudo: string | null | undefined): Partial<Record<TopePrueba, number>> {
  try {
    const o = crudo ? JSON.parse(crudo) : null;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    const out: Partial<Record<TopePrueba, number>> = {};
    for (const [k, v] of Object.entries(o)) if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k as TopePrueba] = Math.floor(v);
    return out;
  } catch {
    return {};
  }
}

export type FrenoDePrueba = { ok: true } | { ok: false; tope: number; texto: string };

/**
 * ¿Puede crear `cuantas` más de esto? null-safe: fuera de la prueba, siempre. `usadas`: lo que ya tiene, cuando se cuenta de
 * una tabla (las páginas publicadas); si no, lo del contador. Nunca tira.
 */
export async function frenoDePrueba(ws: number, cual: TopePrueba, opts: { cuantas?: number; usadas?: number } = {}): Promise<FrenoDePrueba> {
  const e = await estadoDePrueba(ws);
  if (!e.enPrueba) return { ok: true };
  const tope = topeEnPrueba(e.capa ?? '', cual);
  if (tope == null) return { ok: true };
  let usadas = opts.usadas;
  if (usadas == null) {
    try {
      usadas = leerUsoDePrueba(await runWithWorkspace(ws, () => getSetting(CLAVE_USO_PRUEBA)))[cual] ?? 0;
    } catch {
      return { ok: true };
    }
  }
  return usadas + (opts.cuantas ?? 1) <= tope ? { ok: true } : { ok: false, tope, texto: textoTopePrueba(cual, tope) };
}

/** Suma lo que se acaba de crear, SÓLO mientras está en prueba. Best effort: nunca tira. */
export async function sumarUsoDePrueba(ws: number, cual: TopePrueba, cuantas = 1): Promise<void> {
  try {
    if (!(await estadoDePrueba(ws)).enPrueba) return;
    await runWithWorkspace(ws, async () => {
      const uso = leerUsoDePrueba(await getSetting(CLAVE_USO_PRUEBA));
      uso[cual] = (uso[cual] ?? 0) + Math.max(1, Math.floor(cuantas));
      await setSetting(CLAVE_USO_PRUEBA, JSON.stringify(uso));
    });
  } catch (e) {
    console.warn(`[prueba-uso] no pude sumar ${cual} en la prueba del negocio ${ws}:`, e instanceof Error ? e.message : String(e));
  }
}

export type UsoDePrueba = { tope: Exclude<TopePrueba, 'prueba.exportar'>; usado: number; de: number };
export type ResumenPrueba =
  | { enPrueba: false }
  | { enPrueba: true; dias: number | null; hasta: string | null; plan: string; despues: string | null; usos: UsoDePrueba[]; exportarHabilitado: false };

/**
 * La prueba del negocio en un vistazo: cuántos días quedan, qué se cobra después y cuánto usó de cada tope. Lo dibujan el
 * cartel de la barra lateral, la franja de cada pantalla con tope, «Tu plan» del teléfono, y lo lee la API (`ver_mi_prueba`).
 * Las páginas publicadas se cuentan de la tabla (las publicadas hoy), como el freno. Nunca tira.
 */
export async function resumenDePrueba(ws: number, ahoraMs: number = Date.now()): Promise<ResumenPrueba> {
  const e = await estadoDePrueba(ws);
  if (!e.enPrueba) return { enPrueba: false };
  let uso: Partial<Record<TopePrueba, number>> = {};
  try { uso = leerUsoDePrueba(await runWithWorkspace(ws, () => getSetting(CLAVE_USO_PRUEBA))); } catch { /* sin uso leído: 0 */ }
  let publicadas = 0;
  try {
    const { count } = await getSupabaseServer().from('landing_docs').select('id', { count: 'exact', head: true })
      .eq('workspace_id', ws).is('papelera_at', null).not('publicado', 'is', null);
    publicadas = count ?? 0;
  } catch { /* sin contar: 0 */ }
  const usos: UsoDePrueba[] = [];
  for (const tope of Object.keys(NOMBRE_COSA_PRUEBA) as Array<UsoDePrueba['tope']>) {
    const de = topeEnPrueba(e.capa ?? '', tope);
    if (de == null) continue;
    usos.push({ tope, usado: tope === 'web.landings_publicadas' ? publicadas : uso[tope] ?? 0, de });
  }
  return { enPrueba: true, dias: diasQueQuedan(e.hasta, ahoraMs), hasta: e.hasta, plan: e.plan ?? 'tu plan', despues: e.despues, usos, exportarHabilitado: false };
}
