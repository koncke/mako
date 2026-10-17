// =============================================================================
// plan-acceso — quien deja de pagar su lugar en MaKo deja de entrar (17/10/2026)
// =============================================================================
// Las reglas puras viven en lib/plan-acceso-reglas.ts. Acá: leer los cobros de la plataforma que pagan el lugar de
// cada negocio, decidir, y PAUSAR o REABRIR el negocio (`workspaces.estado`). El corte en sí (que un negocio pausado
// no se abra) vive en lib/workspace.ts (`negocioPausado`) y lib/tab-access.ts (`requireSesion` → /cuenta-pausada).
//
// Lo corre el cron de la pasarela (app/api/cron/cobros-reconciliar, cada media hora), después de reconciliar.
//
// ⚠️ ESCRIBE EN PRODUCCIÓN SOLO, así que:
//   · sólo toca negocios con un cobro de la plataforma que pague su lugar (`alta_ws` o `cliente_ws`): el ws1 y
//     cualquier cliente con un acuerdo a mano no tienen ninguno, y la plataforma se saltea siempre;
//   · corta como mucho TOPE_POR_CORRIDA por vuelta (un error de lectura que los diera a todos por vencidos no puede
//     dejar afuera a todos de una vez) y `enSeco` dice qué haría sin escribir;
//   · pausa con compare-and-set (`estado = activo`) y guarda el corte DESPUÉS: si guardar falla, deshace la pausa;
//   · un negocio reactivado a mano por el mismo vencimiento no se vuelve a cortar (`pasoDeAcceso`).
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { wsSuperAdmin } from './workspace';
import {
  CLAVE_CORTE, leerCorte, pasoDeAcceso, vigenciaDelLugar,
  type CobroDelLugar, type CorteGuardado, type PagoDelLugar, type Paso,
} from './plan-acceso-reglas';

/** Cuántos negocios puede pausar una corrida. */
export const TOPE_POR_CORRIDA = 5;

type FilaCobro = CobroDelLugar & { alta_ws: number | null; cliente_ws?: number | null };

const COLS = 'id, tipo, estado, suscripcion_estado, pagado_at, reembolsado_at, created_at, alta_ws';

/** Los cobros de la plataforma que pagan el lugar de un negocio. Sin la mig 0308, sólo los planes vendidos. */
async function cobrosDeLugares(plataforma: number): Promise<FilaCobro[]> {
  const db = getSupabaseServer();
  const con = await db.from('cobros').select(`${COLS}, cliente_ws, inicio_at`)
    .eq('workspace_id', plataforma).or('alta_ws.not.is.null,cliente_ws.not.is.null').limit(2000);
  if (!con.error) return (con.data ?? []) as FilaCobro[];
  if (!/cliente_ws|inicio_at/.test(con.error.message)) throw new Error(`No pude leer los cobros de los lugares: ${con.error.message}`);
  const sin = await db.from('cobros').select(COLS).eq('workspace_id', plataforma).not('alta_ws', 'is', null).limit(2000);
  if (sin.error) throw new Error(`No pude leer los cobros de los lugares: ${sin.error.message}`);
  return (sin.data ?? []) as FilaCobro[];
}

export type Revision = {
  revisados: number;
  cortados: number[];
  reabiertos: number[];
  soltados: number[];
  /** Lo que se habría cortado pero no entró en el tope de esta corrida (se corta en la próxima). */
  postergados: number[];
  errores: number;
  enSeco: boolean;
  /** Qué decidió por negocio, para leerlo en seco. */
  pasos: Array<{ ws: number; paso: Paso['tipo']; vigencia: string }>;
};

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
  const out: Revision = { revisados: 0, cortados: [], reabiertos: [], soltados: [], postergados: [], errores: 0, enSeco, pasos: [] };

  const cobros = await cobrosDeLugares(plataforma);
  const porWs = new Map<number, FilaCobro[]>();
  for (const c of cobros) {
    const ws = Number(c.alta_ws ?? c.cliente_ws);
    if (!Number.isFinite(ws) || ws === plataforma) continue;
    if (opts.soloWs != null && ws !== opts.soloWs) continue;
    porWs.set(ws, [...(porWs.get(ws) ?? []), c]);
  }
  if (!porWs.size) return out;

  const ids = cobros.map((c) => c.id);
  const wss = [...porWs.keys()];
  const [pagosR, wsR, cortesR] = await Promise.all([
    db.from('pagos').select('cobro_id, pagado, fecha_pago').eq('workspace_id', plataforma).in('cobro_id', ids).eq('pagado', true),
    db.from('workspaces').select('id, estado').in('id', wss),
    db.from('app_settings').select('workspace_id, value').eq('key', CLAVE_CORTE).in('workspace_id', wss),
  ]);
  if (pagosR.error) throw new Error(`No pude leer las cuotas de los lugares: ${pagosR.error.message}`);
  if (wsR.error) throw new Error(`No pude leer el estado de los negocios: ${wsR.error.message}`);
  if (cortesR.error) throw new Error(`No pude leer los cortes guardados: ${cortesR.error.message}`);
  const pagos = (pagosR.data ?? []) as PagoDelLugar[];
  const estados = new Map(((wsR.data ?? []) as Array<{ id: number; estado: string }>).map((w) => [Number(w.id), w.estado]));
  const cortes = new Map(((cortesR.data ?? []) as Array<{ workspace_id: number; value: string }>).map((r) => [Number(r.workspace_id), leerCorte(r.value)]));

  for (const [ws, suyos] of porWs) {
    const estado = estados.get(ws);
    if (estado !== 'activo' && estado !== 'pausado') continue; // borrado, o un estado que no es de esto
    out.revisados++;
    const v = vigenciaDelLugar(suyos, pagos, ahoraMs);
    const corte = cortes.get(ws) ?? null;
    const paso = pasoDeAcceso(v, estado, corte);
    out.pasos.push({ ws, paso: paso.tipo, vigencia: v.estado === 'vencido' || v.estado === 'cubierto' ? `${v.estado} (${v.motivo}, hasta ${v.hasta})` : v.estado });
    if (paso.tipo === 'nada') continue;
    if (paso.tipo === 'cortar' && out.cortados.length >= TOPE_POR_CORRIDA) { out.postergados.push(ws); continue; }
    if (enSeco) {
      (paso.tipo === 'cortar' ? out.cortados : paso.tipo === 'reabrir' ? out.reabiertos : out.soltados).push(ws);
      continue;
    }
    try {
      if (paso.tipo === 'cortar') { if (await cortar(ws, { ...paso.corte, desde: new Date(ahoraMs).toISOString(), vigente: true })) out.cortados.push(ws); }
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
