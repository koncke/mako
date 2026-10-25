// =============================================================================
// pruebas/store — dónde se guardan las pruebas A/B: la prueba, sus ramas, quién vio qué, las lecturas y el porqué
// =============================================================================
// Tablas de la migración «pruebas_ab» (supabase/migrations/XXXX_pruebas_ab.sql, sin número hasta que la numere el Cerebro).
// TENANT-SAFETY: todo recibe `ws` EXPLÍCITO y filtra `.eq('workspace_id', ws)` con el cliente de servicio, como
// lib/media-buyer/store.ts: lo llaman la página pública de una landing y el cron, que no tienen sesión. Las dos únicas
// lecturas de TODOS los negocios son las del cron (`pruebasVivas`, `vencerPropuestas`), y cada fila trae su ws.
//
// ⚠️ FALTA LA MIG → `PruebasSinTabla`. Sin tablas no se crea ninguna prueba (crear tira), servir da el CONTROL sin escribir
// (nunca un sorteo sin registro, crítica 15) y el cron no decide. Una pantalla lo dice; no finge «no hay pruebas».
// Lo que decide es puro y vive aparte: el reparto (asignar.ts), el juez (juez.ts), la fila de experimentos (concluir.ts).
// =============================================================================

import 'server-only';
import { getSupabaseServer } from '@/lib/supabase';
import { ramaParaServir } from './asignar';
import { filaDeExperimento } from './concluir';
import type { Juicio, NumeroJuez, Veredicto } from './juez';
import { metricaDe, type Asignacion, type DefinicionMetrica, type Superficie, type Unidad } from './metricas';
import { problemasDeNuevaPrueba, VENCE_PROPUESTA_HORAS, type NuevaPrueba } from './nueva';

export class PruebasSinTabla extends Error {
  constructor() { super('Falta aplicar la migración «pruebas_ab»: las pruebas A/B todavía no tienen dónde guardarse.'); this.name = 'PruebasSinTabla'; }
}
export class PruebaYaViva extends Error {
  constructor() { super('Ya hay una prueba viva en ese lugar: termínala o detenla antes de empezar otra.'); this.name = 'PruebaYaViva'; }
}

/** ¿El error es «la tabla no existe»? (Postgres 42P01, o PostgREST PGRST205 cuando no la tiene en su caché). */
export function tablaFalta(e: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!e) return false;
  return e.code === '42P01' || e.code === 'PGRST205' || /\bprueba(s|_\w+)\b.*(does not exist|schema cache)/i.test(e.message ?? '');
}

const db = () => getSupabaseServer();
const falla = (donde: string, e: { code?: string | null; message?: string | null }): never => {
  if (tablaFalta(e)) throw new PruebasSinTabla();
  throw new Error(`${donde}: ${e.message}`);
};

export type EstadoPrueba = 'propuesta' | 'corriendo' | 'detenida' | 'concluida' | 'descartada' | 'vencida' | 'deshecha';
export type RamaGuardada = { id: number; clave: string; control: boolean; nombre: string; peso: number; contenido: Record<string, unknown>; firma: string | null; activa: boolean; autor: 'dueno' | 'ia' };
export type PruebaGuardada = {
  id: number; ws: number; superficie: Superficie; lugar: Record<string, unknown>; claveLugar: string;
  titulo: string; hipotesis: string; cambio: string | null; origen: 'dueno' | 'mako'; unidad: Unidad;
  metrica: string; metricaDef: DefinicionMetrica; guardrails: Array<{ metrica: string; toleranciaRel: number }>;
  ventanaDias: number; tasaBase: number | null; mdeRel: number; nPorRama: number; minDias: number; maxDias: number;
  epoca: number; epocaAt: string | null; autoAplicar: boolean; estado: EstadoPrueba; veredicto: Veredicto | null;
  sirviendo: string | null; experimentoId: number | null; iniciadaAt: string | null; concluidaAt: string | null;
  ultimaLecturaAt: string | null; ultimaLecturaError: string | null;
  ramas: RamaGuardada[];
};

type Fila = Record<string, unknown>;
const n = (x: unknown): number | null => (x == null || x === '' ? null : Number.isFinite(Number(x)) ? Number(x) : null);
const s = (x: unknown): string | null => (typeof x === 'string' ? x : null);

function deFila(f: Fila, ramas: Fila[]): PruebaGuardada {
  return {
    id: Number(f.id), ws: Number(f.workspace_id), superficie: f.superficie as Superficie, lugar: (f.lugar ?? {}) as Record<string, unknown>,
    claveLugar: String(f.clave_lugar), titulo: String(f.titulo ?? ''), hipotesis: String(f.hipotesis ?? ''), cambio: s(f.cambio),
    origen: f.origen === 'mako' ? 'mako' : 'dueno', unidad: f.unidad === 'visitante' ? 'visitante' : 'lead',
    metrica: String(f.metrica), metricaDef: (f.metrica_def ?? {}) as DefinicionMetrica,
    guardrails: ((f.guardrails ?? []) as Array<{ metrica?: unknown; tolerancia_rel?: unknown }>).map((g) => ({ metrica: String(g.metrica), toleranciaRel: Number(g.tolerancia_rel ?? 0) })),
    ventanaDias: Number(f.ventana_dias), tasaBase: n(f.tasa_base), mdeRel: Number(f.mde_rel), nPorRama: Number(f.n_por_rama),
    minDias: Number(f.min_dias), maxDias: Number(f.max_dias), epoca: Number(f.epoca), epocaAt: s(f.epoca_at),
    autoAplicar: f.auto_aplicar === true, estado: f.estado as EstadoPrueba, veredicto: (f.veredicto ?? null) as Veredicto | null,
    sirviendo: s(f.sirviendo), experimentoId: n(f.experimento_id), iniciadaAt: s(f.iniciada_at), concluidaAt: s(f.concluida_at),
    ultimaLecturaAt: s(f.ultima_lectura_at), ultimaLecturaError: s(f.ultima_lectura_error),
    ramas: ramas.map((r): RamaGuardada => ({
      id: Number(r.id), clave: String(r.clave), control: r.es_control === true, nombre: String(r.nombre ?? ''), peso: Number(r.peso),
      contenido: (r.contenido ?? {}) as Record<string, unknown>, firma: s(r.firma), activa: r.activa !== false, autor: r.autor === 'ia' ? 'ia' : 'dueno',
    })).sort((a, b) => a.clave.localeCompare(b.clave)),
  };
}

/** El porqué de cada decisión (el molde del Media Buyer). Un historial que no se escribe no frena la decisión. */
async function anotar(ws: number, pruebaId: number, accion: string, quien: string, porque: string | null, numeros: NumeroJuez[] = []): Promise<void> {
  const { error } = await db().from('prueba_historial').insert({ prueba_id: pruebaId, workspace_id: ws, accion, quien, porque, numeros });
  if (error) console.error(`[pruebas] historial de #${pruebaId} (${accion}): ${error.message}`);
}

// ── Leer ────────────────────────────────────────────────────────────────────

export async function leerPrueba(ws: number, id: number): Promise<PruebaGuardada | null> {
  const { data, error } = await db().from('pruebas').select('*').eq('workspace_id', ws).eq('id', id).maybeSingle();
  if (error) return falla('leerPrueba', error);
  if (!data) return null;
  const { data: ramas, error: er } = await db().from('prueba_variantes').select('*').eq('workspace_id', ws).eq('prueba_id', id);
  if (er) return falla('leerPrueba (ramas)', er);
  return deFila(data as Fila, (ramas ?? []) as Fila[]);
}

/** La prueba viva (propuesta o corriendo) de un lugar, o null. Sin tablas, null: se sirve el control. */
export async function pruebaVivaDe(ws: number, claveLugar: string): Promise<PruebaGuardada | null> {
  const { data, error } = await db().from('pruebas').select('id').eq('workspace_id', ws).eq('clave_lugar', claveLugar).in('estado', ['propuesta', 'corriendo']).maybeSingle();
  if (error) { if (tablaFalta(error)) return null; return falla('pruebaVivaDe', error); }
  return data ? leerPrueba(ws, Number((data as Fila).id)) : null;
}

// ── Crear y cambiar de estado ───────────────────────────────────────────────

export { problemasDeNuevaPrueba, VENCE_PROPUESTA_HORAS, type NuevaPrueba };

export async function crearPrueba(ws: number, p: NuevaPrueba, quien: string): Promise<PruebaGuardada> {
  const err = problemasDeNuevaPrueba(p);
  if (err.length) throw new Error(err.join(' '));
  const ahora = new Date();
  const fila: Record<string, unknown> = {
    workspace_id: ws, superficie: p.superficie, lugar: p.lugar, clave_lugar: p.claveLugar, titulo: p.titulo, hipotesis: p.hipotesis,
    cambio: p.cambio ?? null, origen: p.origen, unidad: metricaDe(p.metrica)!.unidad, metrica: p.metrica, metrica_def: p.metricaDef ?? {},
    guardrails: (p.guardrails ?? []).map((g) => ({ metrica: g.metrica, tolerancia_rel: g.toleranciaRel })),
    ventana_dias: p.ventanaDias, tasa_base: p.tasaBase ?? null, mde_rel: p.mdeRel, n_por_rama: p.nPorRama, min_dias: p.minDias ?? 7,
    max_dias: p.maxDias, auto_aplicar: p.autoAplicar === true,
    ...(p.arrancar
      ? { estado: 'corriendo', iniciada_at: ahora.toISOString(), epoca_at: ahora.toISOString() }
      : { estado: 'propuesta', propuesta_vence_at: new Date(ahora.getTime() + VENCE_PROPUESTA_HORAS * 3_600_000).toISOString() }),
  };
  const { data, error } = await db().from('pruebas').insert(fila).select('id').single();
  if (error) {
    if (error.code === '23505') throw new PruebaYaViva();
    return falla('crearPrueba', error);
  }
  const id = Number((data as Fila).id);
  const ramas = p.ramas.map((r) => ({
    prueba_id: id, workspace_id: ws, clave: r.clave, es_control: r.control === true, nombre: r.nombre, peso: r.peso,
    contenido: r.contenido ?? {}, firma: r.firma ?? null, porque: r.porque ?? null, autor: r.autor ?? 'dueno',
  }));
  const { error: er } = await db().from('prueba_variantes').insert(ramas);
  if (er) {
    // Una prueba sin ramas no se sirve: se borra la fila recién creada (nadie la vio todavía).
    await db().from('pruebas').delete().eq('workspace_id', ws).eq('id', id);
    return falla('crearPrueba (ramas)', er);
  }
  await anotar(ws, id, 'propuesta', quien, p.hipotesis || null);
  if (p.arrancar) await anotar(ws, id, 'arrancada', quien, null);
  return (await leerPrueba(ws, id))!;
}

/** De «propuesta» a «corriendo». Reclama: sólo si sigue propuesta (dos «sí» no la arrancan dos veces). */
export async function arrancarPrueba(ws: number, id: number, quien: string): Promise<boolean> {
  const ahora = new Date().toISOString();
  const { data, error } = await db().from('pruebas').update({ estado: 'corriendo', iniciada_at: ahora, epoca_at: ahora, updated_at: ahora })
    .eq('workspace_id', ws).eq('id', id).eq('estado', 'propuesta').select('id');
  if (error) return falla('arrancarPrueba', error);
  if (!(data ?? []).length) return false;
  await anotar(ws, id, 'arrancada', quien, null);
  return true;
}

/** Detener: deja de repartir (todo al control) y no concluye nada. */
export async function detenerPrueba(ws: number, id: number, quien: string, porque: string): Promise<boolean> {
  const { data, error } = await db().from('pruebas').update({ estado: 'detenida', updated_at: new Date().toISOString() })
    .eq('workspace_id', ws).eq('id', id).in('estado', ['propuesta', 'corriendo']).select('id');
  if (error) return falla('detenerPrueba', error);
  if (!(data ?? []).length) return false;
  await anotar(ws, id, 'detenida', quien, porque);
  return true;
}

/**
 * UNA ÉPOCA NUEVA (diseño 2.4): se editó una rama o cambiaron los pesos. Desde ahora sólo cuentan los que entran después, y
 * el día de la prueba vuelve a 1. Reclama sobre la época leída: dos ediciones a la vez no saltan dos épocas.
 */
export async function reiniciarEpoca(ws: number, id: number, epocaLeida: number, quien: string, porque: string): Promise<boolean> {
  const ahora = new Date().toISOString();
  const { data, error } = await db().from('pruebas').update({ epoca: epocaLeida + 1, epoca_at: ahora, updated_at: ahora })
    .eq('workspace_id', ws).eq('id', id).eq('epoca', epocaLeida).eq('estado', 'corriendo').select('id');
  if (error) return falla('reiniciarEpoca', error);
  if (!(data ?? []).length) return false;
  await anotar(ws, id, 'reiniciada', quien, porque);
  return true;
}

// ── Servir y asignar ────────────────────────────────────────────────────────

/**
 * LA RAMA QUE SE LE SIRVE A UNA UNIDAD, y la asignación escrita si es nueva (insert … on conflict do nothing, y se relee:
 * si otro pedido la escribió primero, gana ésa). `at` es la hora del PEDIDO (crítica 9). `previo` congela el estado de la
 * métrica al asignar («ya había agendado»). Si escribir falla, el CONTROL: nunca una rama que no quedó registrada.
 */
export async function servirRama(ws: number, p: PruebaGuardada | null, unidad: string | null | undefined, o: { at?: string; previo?: boolean } = {}): Promise<string> {
  const control = p?.ramas.find((r) => r.control)?.clave ?? 'A';
  if (!p || !unidad) return ramaParaServir(p, unidad).clave;
  const leer = async (): Promise<string | null | 'error'> => {
    const { data, error } = await db().from('prueba_asignaciones').select('variante').eq('workspace_id', ws).eq('prueba_id', p.id).eq('unidad', unidad).maybeSingle();
    if (error) return 'error';
    return data ? String((data as Fila).variante) : null;
  };
  const previa = p.estado === 'corriendo' && !p.sirviendo ? await leer() : null;
  if (previa === 'error') return control;
  const r = ramaParaServir(p, unidad, previa);
  if (!r.escribir) return r.clave;
  const { error } = await db().from('prueba_asignaciones').upsert({
    prueba_id: p.id, unidad, variante: r.clave, workspace_id: ws, epoca: p.epoca,
    asignada_at: o.at ?? new Date().toISOString(), ...(o.previo != null ? { previo: o.previo } : {}),
  }, { onConflict: 'prueba_id,unidad', ignoreDuplicates: true });
  if (error) return control;
  const escrita = await leer();
  return escrita && escrita !== 'error' ? ramaParaServir(p, unidad, escrita).clave : control;
}

/** Las asignaciones de la época, para el medidor (de a 1.000). */
export async function asignacionesDe(ws: number, pruebaId: number, epoca: number): Promise<Asignacion[]> {
  const out: Asignacion[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db().from('prueba_asignaciones').select('unidad, variante, asignada_at, previo')
      .eq('workspace_id', ws).eq('prueba_id', pruebaId).eq('epoca', epoca).order('unidad').range(desde, desde + 999);
    if (error) return falla('asignacionesDe', error);
    for (const f of (data ?? []) as Fila[]) {
      out.push({ unidad: String(f.unidad), rama: String(f.variante), asignadaAt: String(f.asignada_at), ...(f.previo != null ? { previo: f.previo === true } : {}) });
    }
    if ((data ?? []).length < 1000) return out;
  }
}

/** Congela el PRIMER resultado de una unidad (sólo si todavía no tiene: «respondió» se reescribe al volver a entrar). */
export async function congelarResultado(ws: number, pruebaId: number, unidad: string, logro: boolean, at: string | null): Promise<void> {
  const { error } = await db().from('prueba_asignaciones').update({ resultado: logro, resultado_at: at })
    .eq('workspace_id', ws).eq('prueba_id', pruebaId).eq('unidad', unidad).is('resultado', null);
  if (error) falla('congelarResultado', error);
}

// ── Lo que hace el cron ─────────────────────────────────────────────────────

/** Las pruebas corriendo de TODOS los negocios (sólo el cron): cada una con su ws. */
export async function pruebasVivas(): Promise<Array<{ id: number; ws: number }>> {
  const { data, error } = await db().from('pruebas').select('id, workspace_id').eq('estado', 'corriendo').order('id');
  if (error) { if (tablaFalta(error)) return []; return falla('pruebasVivas', error); }
  return ((data ?? []) as Fila[]).map((f) => ({ id: Number(f.id), ws: Number(f.workspace_id) }));
}

/** Las propuestas que nadie aprobó en 72 h vencen (sólo el cron). */
export async function vencerPropuestas(ahora: Date): Promise<number> {
  const { data, error } = await db().from('pruebas').update({ estado: 'vencida', updated_at: ahora.toISOString() })
    .eq('estado', 'propuesta').lt('propuesta_vence_at', ahora.toISOString()).select('id, workspace_id');
  if (error) { if (tablaFalta(error)) return 0; return falla('vencerPropuestas', error); }
  for (const f of (data ?? []) as Fila[]) await anotar(Number(f.workspace_id), Number(f.id), 'vencida', 'mako', `Nadie la aprobó en ${VENCE_PROPUESTA_HORAS} h.`);
  return (data ?? []).length;
}

/** Una lectura que falló NO decide: queda dicho en la prueba y en su historial. */
export async function marcarLecturaFallida(ws: number, id: number, motivo: string): Promise<void> {
  const ahora = new Date().toISOString();
  const { error } = await db().from('pruebas').update({ ultima_lectura_at: ahora, ultima_lectura_error: motivo.slice(0, 500), updated_at: ahora }).eq('workspace_id', ws).eq('id', id);
  if (error) falla('marcarLecturaFallida', error);
  await anotar(ws, id, 'fallida', 'mako', motivo.slice(0, 500));
}

/** Los números del día (idempotente: la clave es prueba + fecha + rama; correr dos veces el cron no duplica). */
export async function guardarLectura(ws: number, p: PruebaGuardada, fecha: string, dia: number, j: Juicio, asignados: Record<string, number>): Promise<void> {
  const filas = j.ramas.map((r) => ({
    prueba_id: p.id, fecha, variante: r.clave, workspace_id: ws, epoca: p.epoca, dia,
    n: asignados[r.clave] ?? 0, n_maduros: r.n, x: r.x, p_mejor: r.pMejor, p_peor: r.pPeor, perdida: r.perdida,
    lift_p5: r.lift?.[0] ?? null, lift_p95: r.lift?.[1] ?? null,
  }));
  const { error } = await db().from('prueba_lecturas').upsert(filas, { onConflict: 'prueba_id,fecha,variante' });
  if (error) falla('guardarLectura', error);
  const ahora = new Date().toISOString();
  const { error: e2 } = await db().from('pruebas').update({ ultima_lectura_at: ahora, ultima_lectura_error: null, updated_at: ahora }).eq('workspace_id', ws).eq('id', p.id);
  if (e2) falla('guardarLectura (prueba)', e2);
}

/** El juez cortó ramas por daño: dejan de recibir gente (los que ya están, siguen). */
export async function cortarRamas(ws: number, id: number, claves: readonly string[], porque: string, numeros: NumeroJuez[]): Promise<void> {
  const { error } = await db().from('prueba_variantes').update({ activa: false, cortada_motivo: porque.slice(0, 500), cortada_at: new Date().toISOString() })
    .eq('workspace_id', ws).eq('prueba_id', id).in('clave', [...claves]).eq('es_control', false);
  if (error) falla('cortarRamas', error);
  await anotar(ws, id, 'cortada', 'mako', porque, numeros);
}

/**
 * CONCLUIR: reclama la prueba (sólo si sigue corriendo: dos crons no concluyen dos veces), guarda el veredicto y la rama
 * que se sirve, y escribe la conclusión en `experimentos` con el ws explícito. Si `experimentos` falla, la prueba queda
 * concluida igual (el veredicto vive en `pruebas`) y el historial lo dice.
 */
export async function concluirPrueba(ws: number, p: PruebaGuardada, j: Extract<Juicio, { accion: 'concluir' }>, ahora: Date): Promise<{ ok: boolean; experimentoId: number | null }> {
  const iso = ahora.toISOString();
  const { data, error } = await db().from('pruebas').update({ estado: 'concluida', veredicto: j.veredicto, sirviendo: j.sirviendo, concluida_at: iso, updated_at: iso })
    .eq('workspace_id', ws).eq('id', p.id).eq('estado', 'corriendo').select('id');
  if (error) return falla('concluirPrueba', error);
  if (!(data ?? []).length) return { ok: false, experimentoId: null };
  const { data: exp, error: ee } = await db().from('experimentos').insert(filaDeExperimento(ws, p, j, iso)).select('id').single();
  if (ee) {
    await anotar(ws, p.id, 'concluida', 'mako', `${j.porque} (No se pudo escribir en Experimentos: ${ee.message})`, j.numeros);
    return { ok: true, experimentoId: null };
  }
  const experimentoId = Number((exp as Fila).id);
  const { error: e3 } = await db().from('pruebas').update({ experimento_id: experimentoId }).eq('workspace_id', ws).eq('id', p.id);
  if (e3) console.error(`[pruebas] #${p.id}: experimento ${experimentoId} sin enlazar: ${e3.message}`);
  await anotar(ws, p.id, 'concluida', 'mako', j.porque, j.numeros);
  return { ok: true, experimentoId };
}
