// =============================================================================
// mako-tokens-caja — la caja: leer el saldo, acreditar el cupo, descontar un gasto, liquidar la diferencia
// =============================================================================
// Martín, 15/11/2026: «vinculemos todas las cosas que utilicen inteligencia artificial y que todo utilice MaKo Tokens».
//
// Esto es LA ÚNICA PUERTA a las tablas `mako_tokens_saldo` y `mako_tokens_movimientos`. Nadie más las escribe: el día que
// alguien haga un `update` del saldo por su cuenta vuelve el bug no atómico de la migración 0113 (ver la 0412), y lo
// vuelve de la forma que no da error — se gasta el doble y el contador dice que se gastó una vez.
//
// ⚠️ EL CHEQUEO Y EL DESCUENTO NO ESTÁN ACÁ: ESTÁN EN SQL. `mako_tokens_gastar` (migración 0416) hace las dos cosas en la
// misma sentencia, que es lo único que las hace seguras con dos generaciones a la vez. Este archivo la llama y traduce el
// resultado; si la lógica del descuento se mudara a TypeScript, el bug vuelve aunque las dos líneas sean correctas por
// separado.
//
// ⚠️ TODO FALLA CERRADO. Un saldo que no se pudo leer es `null`, y `null` no alcanza (`alcanzaElSaldo`,
// lib/mako-tokens-reglas.ts). Si un error de base dejara pasar la llamada, el medidor no protege nada justo el día que la
// base anda mal — que es cuando más raro se comporta todo. La única excepción es la LIQUIDACIÓN, que es best-effort a
// propósito: ya se cobró de más o de menos por unos pocos MT, y tirar ahí rompería una generación que salió bien.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { cupoDeCapa } from './mako-tokens-reglas';

/** El saldo de un negocio, partido en sus dos baldes. `null` = no se pudo leer (y eso NO alcanza). */
export type SaldoDeCaja = {
  /** Lo que queda del cupo de ESTE mes. Se reinicia el mes que viene. */
  readonly cupo: number;
  /** Lo que compró aparte. NO se reinicia. */
  readonly comprado: number;
  /** Lo gastable: la suma de los dos. Es contra esto que se compara un costo. */
  readonly total: number;
  /** El mes de cupo acreditado (`cupo:2026-11`), o null si nunca se le acreditó uno. */
  readonly mes: string | null;
};

/** El mes al que pertenece una fecha, como referencia del ledger. UTC a propósito: el mes del cupo es uno para todos. */
export function mesDeCupo(ahora: Date = new Date()): string {
  const y = ahora.getUTCFullYear();
  const m = String(ahora.getUTCMonth() + 1).padStart(2, '0');
  return `cupo:${y}-${m}`;
}

/**
 * El cupo mensual que le toca a ese negocio, o null si su capa no vende cupo.
 *
 * ⚠️ `cupoDeCapa` devuelve null para cualquier capa que no sea `completo` o `agencia` — el Accelerator incluido, a
 * propósito (nadie decidió cuántos MaKo Tokens da, y esto NO lo inventa). Un null acá significa «este negocio no recibe
 * cupo»: va a poder gastar sólo lo que haya comprado, y si no compró nada, nada. Es lo correcto hasta que Martín decida
 * el número.
 */
export async function cupoDelWorkspace(ws: number): Promise<number | null> {
  const { data, error } = await getSupabaseServer().from('workspaces').select('capa').eq('id', ws).maybeSingle();
  if (error) throw new Error(`la capa del negocio ${ws}: ${error.message}`);
  const capa = (data as { capa?: string | null } | null)?.capa ?? null;
  return capa ? cupoDeCapa(capa) : null;
}

/** El saldo tal como está. `null` si no se pudo leer. Un negocio sin fila tiene cero, que es distinto de «no se pudo leer». */
export async function saldoDeWorkspace(ws: number): Promise<SaldoDeCaja | null> {
  try {
    const { data, error } = await getSupabaseServer()
      .from('mako_tokens_saldo').select('saldo, comprado, cupo_mes').eq('workspace_id', ws).maybeSingle();
    if (error) throw new Error(error.message);
    const cupo = Number((data as { saldo?: number } | null)?.saldo ?? 0) || 0;
    const comprado = Number((data as { comprado?: number } | null)?.comprado ?? 0) || 0;
    return { cupo, comprado, total: cupo + comprado, mes: (data as { cupo_mes?: string | null } | null)?.cupo_mes ?? null };
  } catch (e) {
    console.error(`[mako-tokens-caja] ws=${ws}: no pude leer el saldo: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** De qué balde salió cada token de una reserva. Lo necesita la liquidación para devolver a los mismos. */
export type Tomado = { readonly cupo: number; readonly comprado: number };

export type Gasto =
  | { readonly ok: true; readonly cuesta: number; readonly tomado: Tomado; readonly queda: SaldoDeCaja }
  | { readonly ok: false; readonly cuesta: number; readonly saldo: SaldoDeCaja | null; readonly falta: number };

/**
 * Descuenta `cuesta` MT del negocio, acreditándole antes el cupo del mes si le corresponde y todavía no lo cobró.
 *
 * Devuelve `ok: true` si alcanzaba —y entonces YA SE DESCONTÓ— o `ok: false` si no, **sin haber tocado nada**. Eso es lo
 * que hace que la propiedad se cumpla: «si una generación sólo corre cuando hay saldo, y el saldo entra con el pago, no
 * se puede gastar antes de cobrar».
 *
 * ⚠️ FALLA CERRADO: cualquier error de base devuelve `ok: false`. Nunca se deja pasar una llamada porque la caja no
 * contestó.
 */
export async function gastarMt(
  ws: number,
  cuesta: number,
  o: { feature?: string | null; costoUsd?: number | null; referencia?: string | null; cupo?: number | null; ahora?: Date } = {},
): Promise<Gasto> {
  const c = Math.max(0, Math.ceil(Number(cuesta) || 0));
  try {
    const cupo = o.cupo !== undefined ? o.cupo : await cupoDelWorkspace(ws);
    const { data, error } = await getSupabaseServer().rpc('mako_tokens_gastar', {
      p_ws: ws,
      p_cuesta: c,
      p_cupo: cupo,
      p_mes: mesDeCupo(o.ahora),
      p_feature: o.feature ?? null,
      p_costo_usd: o.costoUsd ?? null,
      p_referencia: o.referencia ?? null,
    });
    if (error) throw new Error(error.message);
    // La función devuelve SIEMPRE una fila. Ninguna fila es una base que no es la que creemos: falla cerrado.
    const f = (Array.isArray(data) ? data[0] : data) as
      { ok?: boolean; saldo?: number; comprado?: number; tomado_cupo?: number; tomado_comprado?: number } | null;
    if (!f) throw new Error('mako_tokens_gastar no devolvió ninguna fila');
    const quedaCupo = Number(f.saldo ?? 0) || 0;
    const quedaComprado = Number(f.comprado ?? 0) || 0;
    const queda: SaldoDeCaja = { cupo: quedaCupo, comprado: quedaComprado, total: quedaCupo + quedaComprado, mes: mesDeCupo(o.ahora) };
    if (f.ok === true) {
      return { ok: true, cuesta: c, tomado: { cupo: Number(f.tomado_cupo ?? 0) || 0, comprado: Number(f.tomado_comprado ?? 0) || 0 }, queda };
    }
    return { ok: false, cuesta: c, saldo: queda, falta: Math.max(0, c - queda.total) };
  } catch (e) {
    console.error(`[mako-tokens-caja] ws=${ws}: no pude descontar ${c} MT (${o.feature ?? 'sin feature'}): ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, cuesta: c, saldo: null, falta: c };
  }
}

/**
 * Liquida la diferencia de una reserva: `mt` positivo devuelve, negativo cobra de más.
 *
 * ⚠️ SE DEVUELVE EN EL ORDEN INVERSO AL QUE SE TOMÓ (primero `comprado`, después el cupo), y eso deja la fila
 * exactamente como estaba antes de la reserva. Devolverlo todo al cupo le regalaría al cliente tokens que se le vencen a
 * fin de mes en lugar de los que no; devolverlo todo a `comprado` le vencería lo que pagó.
 *
 * ⚠️ BEST-EFFORT A PROPÓSITO: un error acá no rompe nada de lo que la persona estaba haciendo. Ya se cobró la reserva, la
 * generación salió bien, y lo que está en juego son unos pocos MT. Queda en el log.
 */
export async function liquidarMt(
  ws: number,
  mt: number,
  tomado: Tomado,
  o: { feature?: string | null; costoUsd?: number | null; referencia?: string | null } = {},
): Promise<void> {
  const d = Math.trunc(Number(mt) || 0);
  if (d === 0) return;
  // El reparto: una devolución vuelve a los baldes de los que salió, empezando por el que NO se vence.
  let deltaComprado = 0;
  let deltaCupo = 0;
  if (d > 0) {
    deltaComprado = Math.min(d, Math.max(0, tomado.comprado));
    deltaCupo = d - deltaComprado;
  } else {
    // Un cobro de más sale del cupo, igual que una reserva: lo que se vence se gasta antes.
    //
    // ⚠️ Y SI AL CUPO NO LE ALCANZA, LA DIFERENCIA NO SE LE SACA DE LO COMPRADO: el `greatest(0, …)` del SQL la recorta
    // y queda perdonada. Es a propósito, y conviene saber el tamaño de lo que se regala antes de «arreglarlo»: pasa sólo
    // cuando el costo real superó la ESTIMACIÓN de esa llamada (`mtReservaDeFeature`), está acotado a UNA llamada —la
    // siguiente ya encuentra el cupo en cero y no arranca— y el ledger queda con el delta que de verdad se aplicó, así
    // que la diferencia se puede ver sumando. Cascadear el sobrante a `comprado` pide una cuarta función de SQL que
    // reste de dos baldes sin cobrar dos veces; si alguna feature empieza a pasarse seguido, eso es lo que hay que
    // escribir — y la señal para mirarlo es un `estimado` de la tabla de costos que quedó corto, no esta línea.
    deltaCupo = d;
  }
  try {
    const { error } = await getSupabaseServer().rpc('mako_tokens_ajustar', {
      p_ws: ws,
      p_delta_cupo: deltaCupo,
      p_delta_comprado: deltaComprado,
      p_motivo: d > 0 ? 'devolucion' : 'gasto',
      p_feature: o.feature ?? null,
      p_costo_usd: o.costoUsd ?? null,
      p_referencia: o.referencia ?? null,
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.warn(`[mako-tokens-caja] ws=${ws}: no pude liquidar ${d} MT (${o.feature ?? 'sin feature'}): ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Suma MT que el negocio PAGÓ aparte (un paquete de `mako-tokens-paquetes.ts`), al balde que no se reinicia.
 *
 * ⚠️ `referencia` ES OBLIGATORIA y tiene que identificar el PAGO (el id del cobro), no el momento: es lo único que impide
 * que un reintento del webhook de la pasarela acredite el paquete dos veces. El índice único de la 0412 cubre sólo los
 * movimientos de `cupo`, así que acá la idempotencia la tiene que poner quien llama — y por eso esta función la exige.
 */
export async function acreditarCompra(
  ws: number,
  mt: number,
  referencia: string,
  o: { costoUsd?: number | null } = {},
): Promise<boolean> {
  const d = Math.max(0, Math.trunc(Number(mt) || 0));
  const ref = (referencia ?? '').trim();
  if (d <= 0 || !ref) {
    console.warn(`[mako-tokens-caja] ws=${ws}: una compra sin monto o sin referencia no se acredita (mt=${mt}, ref=«${ref}»)`);
    return false;
  }
  try {
    const db = getSupabaseServer();
    // El anti-duplicado, explícito: si ya hay un movimiento de compra con esa referencia, no se vuelve a acreditar.
    const { data: ya, error: eYa } = await db.from('mako_tokens_movimientos')
      .select('id').eq('workspace_id', ws).eq('motivo', 'compra').eq('referencia', ref).limit(1);
    if (eYa) throw new Error(eYa.message);
    if (ya?.length) return false;
    // Sin fila todavía: se crea en cero y después se suma, para que el `on conflict` no pise un saldo que ya existía.
    const { error: eFila } = await db.from('mako_tokens_saldo').upsert({ workspace_id: ws }, { onConflict: 'workspace_id', ignoreDuplicates: true });
    if (eFila) throw new Error(eFila.message);
    const { error } = await db.rpc('mako_tokens_ajustar', {
      p_ws: ws, p_delta_cupo: 0, p_delta_comprado: d,
      p_motivo: 'compra', p_feature: null, p_costo_usd: o.costoUsd ?? null, p_referencia: ref,
    });
    if (error) throw new Error(error.message);
    return true;
  } catch (e) {
    console.error(`[mako-tokens-caja] ws=${ws}: no pude acreditar la compra de ${d} MT (${ref}): ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

export type Movimiento = {
  readonly delta: number;
  readonly motivo: string;
  readonly feature: string | null;
  readonly costoUsd: number | null;
  readonly referencia: string | null;
  readonly creado: string;
};

/**
 * Los últimos movimientos de un negocio, para poder EXPLICAR un saldo.
 *
 * ⚠️ El saldo NO se calcula sumando esto (lo dice la 0412): a los pocos meses son millones de filas y la suma se vuelve
 * lenta justo en el camino caliente, que es antes de CADA llamada a un modelo. El saldo vigente vive en la otra tabla.
 */
export async function movimientosDeWorkspace(ws: number, tope = 50): Promise<readonly Movimiento[]> {
  try {
    const { data, error } = await getSupabaseServer().from('mako_tokens_movimientos')
      .select('delta, motivo, feature, costo_usd, referencia, creado_en')
      .eq('workspace_id', ws).order('creado_en', { ascending: false }).limit(Math.max(1, Math.min(500, tope)));
    if (error) throw new Error(error.message);
    return (data ?? []).map((f) => {
      const r = f as Record<string, unknown>;
      return {
        delta: Number(r.delta ?? 0) || 0,
        motivo: String(r.motivo ?? ''),
        feature: (r.feature as string | null) ?? null,
        costoUsd: r.costo_usd == null ? null : Number(r.costo_usd),
        referencia: (r.referencia as string | null) ?? null,
        creado: String(r.creado_en ?? ''),
      };
    });
  } catch (e) {
    console.warn(`[mako-tokens-caja] ws=${ws}: no pude leer los movimientos: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}
