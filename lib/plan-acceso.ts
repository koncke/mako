// =============================================================================
// plan-acceso — quien deja de pagar su lugar en MaKo deja de entrar (17/10/2026; la deuda, 23/10/2026)
// =============================================================================
// Las reglas puras viven en lib/plan-acceso-reglas.ts. Acá: leer los cobros de la plataforma que pagan el lugar de
// cada negocio, decidir, y PAUSAR o REABRIR el negocio (`workspaces.estado`). El corte en sí (que un negocio pausado
// no se abra) vive en lib/workspace.ts (`negocioPausado`) y lib/tab-access.ts (`requireSesion` → /cuenta-pausada).
//
// Lo corre el cron de la pasarela (app/api/cron/cobros-reconciliar, cada media hora), después de reconciliar, y el
// pago que entra (`soloWs`, lib/cobros.ts): quien paga su deuda vuelve a entrar en el acto.
//
// ⚠️ ESCRIBE EN PRODUCCIÓN SOLO, así que:
//   · sólo toca negocios con un cobro de la plataforma que pague su lugar (`alta_ws` o `cliente_ws`): el ws1 y
//     cualquier cliente con un acuerdo a mano no tienen ninguno, y la plataforma se saltea siempre;
//   · corta como mucho TOPE_POR_CORRIDA por vuelta (un error de lectura que los diera a todos por vencidos no puede
//     dejar afuera a todos de una vez) y `enSeco` dice qué haría sin escribir;
//   · ⚠️ ANTES DE CORTAR POR IMPAGO LE PREGUNTA A LA PASARELA (lib/plan-deuda.ts, `confirmarImpago`): una renovación que
//     se cobró y cuyo aviso se perdió no deja afuera a quien pagó; se repara y no se corta. Si la pasarela no contesta,
//     tampoco se corta (en la próxima vuelta se vuelve a mirar);
//   · pausa con compare-and-set (`estado = activo`) y guarda el corte DESPUÉS: si guardar falla, deshace la pausa;
//   · un negocio reactivado a mano por el mismo vencimiento no se vuelve a cortar (`pasoDeAcceso`).
//
// LOS TRES DEFECTOS DE LA REVISIÓN DEL 17/10, arreglados el 23/10:
//   · el cron sólo veía `alta_ws`: quien vuelve a pagar después de una pausa no volvía a entrar. Ahora reactiva desde adentro
//     de su cuenta y el cobro nace atado a su negocio (atarlo por el email era una puerta para pausar negocios ajenos);
//   · un primer pago devuelto con la suscripción activa pausaba a quien paga: la cobertura (plan-acceso-reglas) no corta
//     por un reembolso mientras la pasarela siga cobrando;
//   · las cuotas se leían sin paginar (PostgREST corta en 1.000): se leen de a tandas.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { wsSuperAdmin } from './workspace';
import {
  CLAVE_CORTE, CORTE_DE_ACCESO_PRENDIDO, finDeLoCubierto, leerCorte, pasoDeAcceso, vigenciaDelLugar,
  type CobroDelLugar, type CorteGuardado, type PagoDelLugar, type Paso, type Vigencia,
} from './plan-acceso-reglas';
import { CLAVE_RETENCION, leerRetencion, mesesDePausa } from './retencion-reglas';

/** Cuántos negocios puede pausar una corrida. */
export const TOPE_POR_CORRIDA = 5;

export type FilaCobroLugar = CobroDelLugar & {
  alta_ws: number | null; cliente_ws?: number | null; proveedor: 'stripe' | 'mercadopago';
  proveedor_suscripcion_id: string | null; proveedor_ref: string | null; token: string; lead_id: number | null;
};

// `creado_por` y `alta_capa`: para reconocer la prueba gratis (25/10/2026, lib/prueba-plan-reglas.ts).
const COLS = 'id, tipo, estado, suscripcion_estado, pagado_at, reembolsado_at, created_at, alta_ws, monto, moneda, monto_usd, motivo, proveedor, proveedor_suscripcion_id, proveedor_ref, token, lead_id, creado_por, alta_capa';

/** Los cobros de la plataforma que pagan el lugar de un negocio. Tolera una base sin la 0308 o sin la 0330. */
export async function cobrosDeLugares(plataforma: number, soloWs?: number): Promise<FilaCobroLugar[]> {
  const db = getSupabaseServer();
  const intentos = [`${COLS}, cliente_ws, inicio_at, meses`, `${COLS}, cliente_ws, inicio_at`, COLS];
  let ultimo = '';
  for (const cols of intentos) {
    let q = db.from('cobros').select(cols).eq('workspace_id', plataforma);
    const conAgencia = cols.includes('cliente_ws');
    if (soloWs != null) q = conAgencia ? q.or(`alta_ws.eq.${soloWs},cliente_ws.eq.${soloWs}`) : q.eq('alta_ws', soloWs);
    else q = conAgencia ? q.or('alta_ws.not.is.null,cliente_ws.not.is.null') : q.not('alta_ws', 'is', null);
    const { data, error } = await q.order('id', { ascending: true }).limit(5000);
    if (!error) return (data ?? []) as unknown as FilaCobroLugar[];
    ultimo = error.message;
    if (!/cliente_ws|inicio_at|meses|column/.test(error.message)) break;
  }
  throw new Error(`No pude leer los cobros de los lugares: ${ultimo}`);
}

/** Las cuotas cobradas de esos cobros, DE A TANDAS (la revisión del 17/10: sin paginar, PostgREST corta en 1.000). */
export async function cuotasDeLugares(plataforma: number, ids: readonly number[]): Promise<PagoDelLugar[]> {
  const db = getSupabaseServer();
  const out: PagoDelLugar[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const tanda = ids.slice(i, i + 200);
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await db.from('pagos').select('cobro_id, pagado, fecha_pago')
        .eq('workspace_id', plataforma).in('cobro_id', tanda).eq('pagado', true)
        .order('id', { ascending: true }).range(desde, desde + 999);
      if (error) throw new Error(`No pude leer las cuotas de los lugares: ${error.message}`);
      out.push(...((data ?? []) as PagoDelLugar[]));
      if ((data ?? []).length < 1000) break;
    }
  }
  return out;
}

/**
 * ⚠️ UN PLAN PAGADO CON UN EMAIL QUE YA ERA DE MAKO (`ya_tenia_cuenta`) NO SE ATA SOLO A NINGÚN NEGOCIO (revisión adversarial
 * del 23/10, alta 5): atarlo por el email dejaba que CUALQUIERA comprara un plan con el email del admin de otro negocio (el
 * ws1 incluido) y, dejando fallar la renovación, lo hiciera pausar. Quien vuelve, reactiva desde adentro de su cuenta
 * (/cuenta-pausada, «Tu plan»: el cobro nace atado a SU negocio); un `ya_tenia_cuenta` lo resuelve el super admin.
 */

export type Revision = {
  revisados: number;
  cortados: number[];
  reabiertos: number[];
  soltados: number[];
  /** Lo que se habría cortado pero no entró en el tope de esta corrida (se corta en la próxima). */
  postergados: number[];
  /** Lo que se iba a cortar por impago y la pasarela dijo que no (pagó: se reparó) o no contestó. */
  noCortados: Array<{ ws: number; por: string }>;
  errores: number;
  enSeco: boolean;
  /** Qué decidió por negocio, para leerlo en seco. */
  pasos: Array<{ ws: number; paso: Paso['tipo']; vigencia: string }>;
};

const describir = (v: Vigencia): string =>
  v.estado === 'vencido' || v.estado === 'cubierto' ? `${v.estado} (${v.motivo}, hasta ${v.hasta})`
    : v.estado === 'mora' ? `mora (desde ${v.hasta}, ${v.deuda.ciclos} ciclo(s))` : v.estado;

/**
 * Revisa el lugar de cada negocio que paga por la pasarela y lo pausa o lo reabre. `enSeco`: no escribe nada.
 * `ahoraMs` se puede fijar para probar; por defecto, el reloj. `soloWs`: sólo ese negocio (lo usa el pago que entra,
 * para reabrir en el acto a quien acaba de pagar).
 */
export async function revisarAccesosPorPago(opts: { enSeco?: boolean; ahoraMs?: number; soloWs?: number } = {}): Promise<Revision> {
  const enSeco = !!opts.enSeco;
  const ahoraMs = opts.ahoraMs ?? Date.now();
  const plataforma = await wsSuperAdmin();
  const db = getSupabaseServer();
  const out: Revision = { revisados: 0, cortados: [], reabiertos: [], soltados: [], postergados: [], noCortados: [], errores: 0, enSeco, pasos: [] };
  if (!CORTE_DE_ACCESO_PRENDIDO) return out; // apagado (lib/plan-acceso-reglas.ts): no lee ni escribe nada

  const cobros = await cobrosDeLugares(plataforma, opts.soloWs);
  const porWs = new Map<number, FilaCobroLugar[]>();
  for (const c of cobros) {
    const ws = Number(c.alta_ws ?? c.cliente_ws);
    if (!Number.isFinite(ws) || ws === plataforma) continue;
    if (opts.soloWs != null && ws !== opts.soloWs) continue;
    porWs.set(ws, [...(porWs.get(ws) ?? []), c]);
  }
  if (!porWs.size) return out;

  const wss = [...porWs.keys()];
  const [pagos, wsR, cortesR, pausasR] = await Promise.all([
    cuotasDeLugares(plataforma, cobros.map((c) => c.id)),
    db.from('workspaces').select('id, estado').in('id', wss),
    db.from('app_settings').select('workspace_id, value').eq('key', CLAVE_CORTE).in('workspace_id', wss),
    // El mes pausado de la retención cuenta como cubierto (lib/retencion-plan.ts): no es una deuda.
    db.from('app_settings').select('workspace_id, value').eq('key', CLAVE_RETENCION).in('workspace_id', wss),
  ]);
  if (wsR.error) throw new Error(`No pude leer el estado de los negocios: ${wsR.error.message}`);
  if (cortesR.error) throw new Error(`No pude leer los cortes guardados: ${cortesR.error.message}`);
  const estados = new Map(((wsR.data ?? []) as Array<{ id: number; estado: string }>).map((w) => [Number(w.id), w.estado]));
  const cortes = new Map(((cortesR.data ?? []) as Array<{ workspace_id: number; value: string }>).map((r) => [Number(r.workspace_id), leerCorte(r.value)]));
  const pausas = new Map(((pausasR.data ?? []) as Array<{ workspace_id: number; value: string }>).map((r) => [Number(r.workspace_id), mesesDePausa(leerRetencion(r.value))]));

  for (const [ws, suyos] of porWs) {
    const estado = estados.get(ws);
    if (estado !== 'activo' && estado !== 'pausado') continue; // borrado, o un estado que no es de esto
    out.revisados++;
    const v = vigenciaDelLugar(suyos, pagos, ahoraMs, pausas.get(ws) ?? []);
    const corte = cortes.get(ws) ?? null;
    const paso = pasoDeAcceso(v, estado, corte);
    out.pasos.push({ ws, paso: paso.tipo, vigencia: describir(v) });
    if (paso.tipo === 'nada') continue;
    if (paso.tipo === 'cortar' && out.cortados.length >= TOPE_POR_CORRIDA) { out.postergados.push(ws); continue; }
    // ⚠️ ANTES DE PAUSAR POR IMPAGO, la pasarela (un aviso de renovación perdido no deja afuera a quien pagó).
    if (paso.tipo === 'cortar' && paso.corte.motivo === 'impago') {
      const c = suyos.find((x) => x.id === paso.corte.cobroId);
      const { confirmarImpago } = await import('./plan-deuda');
      // `reparar` sólo en la vuelta del cron: desde un pago (`soloWs`) asentar llama otra vez a esto (revisión del 23/10, media 10).
      const r = c ? await confirmarImpago(c, { reparar: !enSeco && opts.soloWs == null }).catch(() => 'no-se-sabe' as const) : 'no-se-sabe';
      if (r !== 'impago') { out.noCortados.push({ ws, por: r }); continue; }
    }
    if (enSeco) {
      (paso.tipo === 'cortar' ? out.cortados : paso.tipo === 'reabrir' ? out.reabiertos : out.soltados).push(ws);
      continue;
    }
    try {
      if (paso.tipo === 'cortar') {
        if (await cortar(ws, { ...paso.corte, desde: new Date(ahoraMs).toISOString(), vigente: true })) {
          out.cortados.push(ws);
          const { avisarSuspension } = await import('./plan-deuda');
          await avisarSuspension(ws, { ...paso.corte, desde: new Date(ahoraMs).toISOString(), vigente: true }).catch((e) => console.warn(`[plan-acceso] ws=${ws} aviso de la pausa:`, e instanceof Error ? e.message : String(e)));
        }
      }
      else if (paso.tipo === 'reabrir') { if (await reabrir(ws, corte!)) out.reabiertos.push(ws); }
      else { await guardarCorte(ws, { ...corte!, vigente: false }); out.soltados.push(ws); }
    } catch (e) {
      out.errores++;
      console.error(`[plan-acceso] ws=${ws} ${paso.tipo}:`, e instanceof Error ? e.message : String(e));
    }
  }
  return out;
}

async function guardarCorte(ws: number, c: CorteGuardado): Promise<void> {
  const { error } = await getSupabaseServer().from('app_settings')
    .upsert({ workspace_id: ws, key: CLAVE_CORTE, value: JSON.stringify(c), updated_at: new Date().toISOString() }, { onConflict: 'workspace_id,key' });
  if (error) throw new Error(`No pude guardar el corte del negocio ${ws}: ${error.message}`);
}

/** Pausa (compare-and-set sobre `activo`) y guarda el corte; si guardar falla, deshace la pausa. */
async function cortar(ws: number, c: CorteGuardado): Promise<boolean> {
  const db = getSupabaseServer();
  const ahora = new Date().toISOString();
  const { data, error } = await db.from('workspaces').update({ estado: 'pausado', updated_at: ahora }).eq('id', ws).eq('estado', 'activo').select('id');
  if (error) throw new Error(`No pude pausar el negocio ${ws}: ${error.message}`);
  if (!data?.length) return false; // otro lo cambió en el medio
  try {
    await guardarCorte(ws, c);
  } catch (e) {
    // Sin el corte guardado, el pago no lo reabriría nunca: mejor no cortar en esta vuelta.
    await db.from('workspaces').update({ estado: 'activo', updated_at: new Date().toISOString() }).eq('id', ws).eq('estado', 'pausado');
    throw e;
  }
  console.log(`[plan-acceso] ws=${ws} PAUSADO: ${c.motivo}, lo pagado cubría hasta ${c.hasta} (cobro ${c.cobroId})`);
  return true;
}

/** Reabre lo que cortó el cobro (compare-and-set sobre `pausado`) y deja el corte como no vigente. */
async function reabrir(ws: number, c: CorteGuardado): Promise<boolean> {
  const { data, error } = await getSupabaseServer().from('workspaces')
    .update({ estado: 'activo', updated_at: new Date().toISOString() }).eq('id', ws).eq('estado', 'pausado').select('id');
  if (error) throw new Error(`No pude reabrir el negocio ${ws}: ${error.message}`);
  await guardarCorte(ws, { ...c, vigente: false });
  if (data?.length) console.log(`[plan-acceso] ws=${ws} REABIERTO: volvió a estar al día (el corte era del cobro ${c.cobroId})`);
  return !!data?.length;
}

/** El corte guardado de un negocio (para la pantalla de /cuenta-pausada). null si no hay, o si no se pudo leer. */
export async function corteDe(ws: number): Promise<CorteGuardado | null> {
  const { data, error } = await getSupabaseServer().from('app_settings').select('value').eq('workspace_id', ws).eq('key', CLAVE_CORTE).maybeSingle();
  if (error) return null;
  return leerCorte((data as { value?: string } | null)?.value ?? null);
}

/**
 * Cómo está HOY el lugar de un negocio (para el aviso de la mora, /cuenta-pausada y «Tu plan»). null = MaKo no se lo
 * cobra por la pasarela (o no se pudo leer: el aviso no se muestra antes que mostrar uno falso). Funciona aunque el
 * corte esté apagado: la deuda se VE igual, lo que no pasa es la pausa.
 */
export async function vigenciaDe(ws: number, ahoraMs: number = Date.now()): Promise<{ vigencia: Vigencia; cobros: FilaCobroLugar[]; cubierto: string | null } | null> {
  try {
    const plataforma = await wsSuperAdmin();
    if (ws === plataforma) return null;
    const cobros = (await cobrosDeLugares(plataforma, ws)).filter((c) => Number(c.alta_ws ?? c.cliente_ws) === ws);
    if (!cobros.length) return null;
    const [pagos, ret] = await Promise.all([
      cuotasDeLugares(plataforma, cobros.map((c) => c.id)),
      getSupabaseServer().from('app_settings').select('value').eq('workspace_id', ws).eq('key', CLAVE_RETENCION).maybeSingle(),
    ]);
    const extras = mesesDePausa(leerRetencion((ret.data as { value?: string } | null)?.value ?? null));
    return { vigencia: vigenciaDelLugar(cobros, pagos, ahoraMs, extras), cobros, cubierto: finDeLoCubierto(cobros, pagos, extras)?.hasta ?? null };
  } catch (e) {
    console.warn(`[plan-acceso] no pude leer la vigencia del negocio ${ws}:`, e instanceof Error ? e.message : String(e));
    return null;
  }
}
