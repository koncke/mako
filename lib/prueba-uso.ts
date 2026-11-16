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
//
// UN TOPE NO ES UN PERMISO (14/11/2026). La prueba NO es una capa propia: vale EL PLAN ELEGIDO desde el primer día
// (lib/plan-esencial.ts, `capaVendidaDe`) y los DOS planes arrancan con los 7 días (`PLANES_CON_PRUEBA`, lib/planes-mako.ts),
// así que una prueba del de US$47 es «Essential por la pasarela» y choca con los candados de `FUNCIONES_SOLO_PRO` igual que un
// Essential pagado. El tope de la prueba es el TECHO de quien ya tiene la función por su plan, nunca la llave: lo que decide
// si la tiene es su plan. Lo que se cuenta en el RESUMEN (y por lo tanto se promete) se filtra por eso:
// `FUNCION_PRO_DE_CADA_TOPE`, abajo.
// =============================================================================

import 'server-only';
import { cache } from 'react';
import { getSupabaseServer } from './supabase';
import { getWorkspace, runWithWorkspace, wsSuperAdmin } from './workspace';
import { CLAVE_PLAN_A_MANO, leerPlanAMano, llevaTopesDePrueba } from './plan-a-mano-reglas';
import { nombreDePlan } from './clientes-plataforma-reglas';
import { getSetting, setSetting } from './settings';
import { diasQueQuedan, esPruebaDePlan, FILTRO_SUSCRIPCION_DE_MAKO } from './prueba-plan-reglas';
import { NOMBRE_COSA_PRUEBA, textoTopePrueba, topeEnPrueba, type FuncionSoloPro, type TopePrueba } from './topes-plan';
// ¿A este negocio le está cerrada una función de `FUNCIONES_SOLO_PRO`? Lo decide el cruce del plan que se le VENDIÓ con la
// capa que tiene HOY (`esEsencialPorPasarela`): las dos tienen que ser `completo`.
// ¿Arrastra lib/cobros, que alcanza una IA en su grafo? NO: lib/plan-esencial.ts hace esa MISMA lectura a mano justamente para
// no importarlo. Medido: la clausura de este archivo queda en 49 módulos y no toca lib/ai-cheap.ts (tests/d6b-rutas.test.ts).
import { esEsencialDe } from './plan-esencial';
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
  // Los 6 meses gratis, mientras duran, no son una prueba: su plan entero (`llevaTopesDePrueba`, lib/plan-a-mano-reglas.ts).
  if (!llevaTopesDePrueba(p, Date.now())) return nada;
  // ⚠️ YA PAGÓ CON SU EMAIL (29/10/2026, la verificación de ddfa645d4): quien compra por /planes con el email de una cuenta que ya
  //    existe deja el cobro `ya_tenia_cuenta`, SIN atar al negocio (`alta_ws` null) hasta que Martín lo ate en /admin/cobros, y el
  //    negocio que ya pagó seguía con los topes de la prueba (y al vencer le llegaba «Terminó tu prueba»). Acá el email SÓLO quita
  //    topes, nunca ata ni pausa: quien paga con tu email te paga a vos (atarlo solo, en cambio, es lo que lib/plan-acceso.ts no hace).
  if (await pagoConElEmailDeSusAdmins(ws)) return nada;
  const w = await getWorkspace(ws);
  const capa = w?.capa ?? null;
  if (!capa) return nada;
  return { enPrueba: true, capa, hasta: p.hasta, despues: null, plan: nombreDePlan(capa), dias: diasQueQuedan(p.hasta, Date.now()) };
}

/**
 * ¿Este negocio paga su plan (o lo está probando con su tarjeta)? Lo que corta a los 6 meses gratis (30/10/2026): no se le dan
 * ni se le avisa que terminan a quien tiene una suscripción, porque el regalo no frena lo que su tarjeta va a pagar. La misma
 * lectura que `estadoDePrueba`, más lo pagado con su email. Tira si no se puede leer: quien llama no lo toma como «no paga».
 */
export async function pagaSuPlan(ws: number): Promise<boolean> {
  const { data, error } = await getSupabaseServer().from('cobros').select('id')
    .eq('workspace_id', await wsSuperAdmin()).eq('alta_ws', ws).eq('tipo', 'suscripcion').or(FILTRO_SUSCRIPCION_DE_MAKO).limit(1);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown[]).length > 0 || (await pagoConElEmailDeSusAdmins(ws));
}

/**
 * ¿Hay un cobro PAGADO de la plataforma, `ya_tenia_cuenta` y sin atar, con el email de un admin de este negocio? Tira si no se
 * puede leer (el que llama lo toma como «sin topes»).
 */
async function pagoConElEmailDeSusAdmins(ws: number): Promise<boolean> {
  const db = getSupabaseServer();
  const { data: us, error: eU } = await db.from('usuarios').select('email, rol_ws').eq('workspace_id', ws).limit(50);
  if (eU) throw new Error(eU.message);
  const emails = [...new Set(((us ?? []) as Array<{ email: string | null; rol_ws: string | null }>)
    .filter((u) => u.email && (u.rol_ws === 'admin' || u.rol_ws == null)).map((u) => u.email!.trim().toLowerCase()))];
  if (!emails.length) return false;
  const { data, error } = await db.from('cobros').select('id, email').eq('workspace_id', await wsSuperAdmin())
    .eq('estado', 'pagado').eq('alta_estado', 'ya_tenia_cuenta').is('alta_ws', null).limit(500);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ email: string | null }>).some((c) => !!c.email && emails.includes(c.email.trim().toLowerCase()));
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

/**
 * LOS TOPES QUE CUENTAN UNA FUNCIÓN QUE EL PLAN PUEDE CERRAR (14/11/2026, la verificación de lo que se cerró en Essential).
 * ⚠️ UN TOPE DE LA PRUEBA NO ES UN PERMISO: es el TECHO de lo que se puede llevar quien YA tiene la función por su plan. La
 * tabla de topes no sabe nada de `FUNCIONES_SOLO_PRO` a propósito — son dos ejes distintos (lib/topes-plan.ts) —, y por eso
 * `topeEnPrueba('completo', 'prueba.avatares')` da 1 también para un Essential: el 1 sale de la prueba porque el PLAN no tiene
 * la clave (`topeEnPrueba` devuelve el de la prueba cuando el plan no la topa). Leída como «lo que la prueba incluye», esa
 * fila se volvía una promesa: el resumen le contaba «0 de 1 video con avatar de IA» a un Essential que en /ai-avatar se come
 * el cartel de Pro (`candadoDeAiAvatar`, app/ai-avatar/acceso.ts). Y los dos planes arrancan con los 7 días
 * (`PLANES_CON_PRUEBA`), con los topes de SU plan desde el primer día (lib/plan-esencial.ts, `capaVendidaDe`): la prueba no
 * es una capa aparte, así que «está en prueba» no destraba nada.
 * Acá se cruzan los dos ejes, en el ÚNICO lugar que arma esa lista (`resumenDePrueba`, abajo): la fila de un tope cuya
 * función su plan le cierra no se cuenta. EL TOPE NO SE TOCA: sigue frenando a quien sí la tiene (`frenoDePrueba`).
 * El tipo ata la clave: si 'ai-avatar' sale de `FUNCIONES_SOLO_PRO`, esto no compila y alguien lo decide.
 */
const FUNCION_PRO_DE_CADA_TOPE: Readonly<Partial<Record<UsoDePrueba['tope'], FuncionSoloPro>>> = {
  'prueba.avatares': 'ai-avatar',
};

export type ResumenPrueba =
  | { enPrueba: false }
  | { enPrueba: true; dias: number | null; hasta: string | null; plan: string; despues: string | null; usos: UsoDePrueba[]; exportarHabilitado: false };

/**
 * La prueba del negocio en un vistazo: cuántos días quedan, qué se cobra después y cuánto usó de cada tope. Lo dibujan el
 * cartel de la barra lateral, la franja de cada pantalla con tope, «Tu plan» del teléfono, y lo lee la API (`ver_mi_prueba`).
 * Las páginas publicadas se cuentan de la tabla (las publicadas hoy), como el freno. Nunca tira.
 * `usos` ES UNA LISTA DE LO QUE LA PRUEBA LE DA, y por eso se filtra por plan: sin el filtro, los cuatro lugares que la
 * dibujan le prometían el avatar de IA a un Essential que lo tiene cerrado (`FUNCION_PRO_DE_CADA_TOPE`, arriba). Quien lee
 * esto no agrega su propia lista de topes: la de acá ya viene filtrada, y una segunda se desfasa el día que cambie el plan.
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
  // ¿Su plan le cierra lo que es sólo de Pro? Una lectura, y sólo cuando está en prueba (`FUNCION_PRO_DE_CADA_TOPE`, arriba).
  // ⚠️ SE LE PASA EL ws Y NO `e.capa`: `e.capa` es la capa VENDIDA (el `alta_capa` del cobro) y `esEsencialDe` espera la que
  //    el negocio tiene HOY. El que ayer subió a Pro sigue con `alta_capa` completo, y pasársela le cerraba el avatar a un Pro.
  //    `esEsencialDe` lee la capa de hoy él mismo: una lectura más vale menos que esa confusión.
  // ⚠️ ANTE LA DUDA, LA FILA SALE: `esEsencialDe` devuelve false si no pudo leer el plan, igual que el candado de /ai-avatar.
  //    Las dos puertas tienen que fallar para el mismo lado: contarle un tope a quien resulta que lo tiene cerrado es un rato
  //    de ruido; esconderle a un Pro el techo de lo que puede generar es sacarle algo que paga.
  const cerradoPorSuPlan = await esEsencialDe(ws);
  const usos: UsoDePrueba[] = [];
  for (const tope of Object.keys(NOMBRE_COSA_PRUEBA) as Array<UsoDePrueba['tope']>) {
    const de = topeEnPrueba(e.capa ?? '', tope);
    if (de == null) continue;
    if (cerradoPorSuPlan && FUNCION_PRO_DE_CADA_TOPE[tope]) continue;
    usos.push({ tope, usado: tope === 'web.landings_publicadas' ? publicadas : uso[tope] ?? 0, de });
  }
  return { enPrueba: true, dias: diasQueQuedan(e.hasta, ahoraMs), hasta: e.hasta, plan: e.plan ?? 'tu plan', despues: e.despues, usos, exportarHabilitado: false };
}
