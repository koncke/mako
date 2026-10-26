// =============================================================================
// pruebas/automatizacion — la prueba de la tarjeta «A/B TEST» de una automatización (25/10/2026)
// =============================================================================
// docs/diseno-pruebas-ab.md (3.1, con la crítica D): una prueba por automatización (`clave_lugar` = `auto:<secuencia>`),
// colgada de UNA tarjeta (`lugar.nodo_id`). El motor de nutrición (lib/nutricion.ts) pregunta acá qué rama le toca a un
// lead cuando llega a la tarjeta (`ramaABDe`), y la escribe en ese momento: es cuando «entra a la rama», y desde ahí corre
// su ventana.
//   · SIN PRUEBA CORRIENDO DE ESA TARJETA (propuesta, detenida, copiada a otro negocio, sin tablas, una lectura que falló)
//     → la A, y la tarjeta lo dice. Nunca un sorteo sin registro (crítica 15).
//   · Las métricas de ESTADO («agendó», «pagó») congelan cómo estaba el lead al asignar (`previo`): sólo cuenta pasar de no a
//     sí (crítica 5). Las de la prueba y las de sus guardrails.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from '@/lib/supabase';
import { getWorkspaceActual } from '@/lib/workspace';
import { ESTADOS_RESPONDIO } from '@/lib/graficos-datos-puro';
import { nodoPorId, problemasDeTarjetaAB, ramasABDe, type PasoGrafo } from '@/lib/flujo-grafo';
import { previoDe } from './resultados';
import {
  actualizarRamas, crearPrueba, detenerPrueba, pruebaVivaDe, reiniciarEpoca, servirRama, ultimaLectura, ultimaPruebaDe,
  PruebasSinTabla, PruebaYaViva, type PruebaGuardada,
} from './store';
import { cambiosDeLaPrueba, metricaDeLaAutomatizacion, ramasParaLaPrueba, tarjetaABDe } from './tarjeta-ab';
import { efectoQueSeNota, planDePrueba } from './volumen';
import { textoDeLaPrueba, textoDeRama, type EstadoPantalla } from './pantalla';
import { metricaDe } from './metricas';
import type { NumerosRama } from './juez';

/** El lugar de la prueba de una automatización: una por automatización (el índice de la migración). */
export const claveLugarAuto = (secuenciaId: number): string => `auto:${secuenciaId}`;
/** La rama de una tarjeta sin prueba corriendo: el control. */
export const RAMA_SIN_PRUEBA = 'A';

/**
 * LA RAMA DE UN LEAD en la tarjeta `nodoId` de la automatización `secuenciaId`: la de su asignación (la escribe si es
 * nueva), o la A si esa tarjeta no tiene una prueba corriendo. Nunca tira: ante cualquier error, la A.
 */
export async function ramaABDe(ws: number, secuenciaId: number, nodoId: string, leadId: number, lead: Record<string, unknown> | null): Promise<string> {
  try {
    const p = await pruebaVivaDe(ws, claveLugarAuto(secuenciaId));
    if (!p || p.superficie !== 'automatizacion' || String(p.lugar.nodo_id ?? '') !== nodoId) return RAMA_SIN_PRUEBA;
    return await servirRama(ws, p, String(leadId), { at: new Date().toISOString(), previo: previoDe(p, lead) });
  } catch (e) {
    console.error(`[pruebas] la rama A/B del lead ${leadId} en #${secuenciaId}/${nodoId}: ${e instanceof Error ? e.message : String(e)} (va a la A)`);
    return RAMA_SIN_PRUEBA;
  }
}

// ── La tarjeta: lo que dice, empezar, detener y lo que pasa al guardar ─────────────────────────────────────────────

/** El plan de fábrica de la tarjeta (diseño 3.1): una ventana de 7 días desde que entra a la rama, y hasta 60 días. */
export const VENTANA_DIAS_AB = 7;
export const MAX_DIAS_AB = 60;
/** El salto que la prueba quiere poder ver, de fábrica: de 10 % a 18 % (un 80 % más). Con menos gente no se nota. */
export const MDE_DE_FABRICA = 0.8;
/** Sin historia (menos de 20 entradas en 30 días), la tasa con la que se planea: 10 %. */
export const TASA_SIN_HISTORIA = 0.1;
const MIN_HISTORIA = 20;

/** Lo que el lienzo dibuja de la prueba de una automatización. */
export type EstadoTarjetaAB = { estado: EstadoPantalla['estado']; texto: string; filas: Record<string, string>; pruebaId: number | null; sinTablas?: boolean };

/** El verbo de la métrica para la fila de la tarjeta: «3 respondieron». */
const VERBO: Record<string, string> = { respondio: 'respondieron', agendo: 'agendaron', pago: 'pagaron' };

/** LO QUE DICE LA TARJETA: el estado de la última prueba de esta automatización y los números de cada rama. */
export async function estadoDeLaTarjeta(ws: number, secuenciaId: number): Promise<EstadoTarjetaAB> {
  let p: PruebaGuardada | null;
  try {
    p = await ultimaPruebaDe(ws, claveLugarAuto(secuenciaId));
  } catch (e) {
    if (e instanceof PruebasSinTabla) return { estado: 'sin_prueba', texto: 'Sin prueba: todos van a A.', filas: {}, pruebaId: null, sinTablas: true };
    throw e;
  }
  if (!p) return { estado: 'sin_prueba', texto: 'Sin prueba: todos van a A.', filas: {}, pruebaId: null };
  const lectura = await ultimaLectura(ws, p.id);
  const ramas: NumerosRama[] = p.ramas.map((r) => {
    const l = lectura.find((x) => x.variante === r.clave);
    const n = l?.nMaduros ?? 0;
    return { clave: r.clave, control: r.control, activa: r.activa, n, x: l?.x ?? 0, tasa: n ? (l?.x ?? 0) / n : 0, pMejor: l?.pMejor ?? 0, pPeor: l?.pPeor ?? null, perdida: null, lift: null };
  });
  const dia = lectura[0]?.dia ?? 0;
  const nMin = Math.min(...ramas.map((r) => r.n));
  const seNotaDesde = p.tasaBase && nMin >= 20 ? efectoQueSeNota({ base: p.tasaBase, n: nMin, ramas: ramas.length }) : null;
  const texto = textoDeLaPrueba({ estado: p.estado, superficie: 'automatizacion', dia, maxDias: p.maxDias, ramas, veredicto: p.veredicto, sirviendo: p.sirviendo, seNotaDesde });
  const verbo = VERBO[p.metrica] ?? (metricaDe(p.metrica)?.titulo ?? '').toLowerCase();
  const filas: Record<string, string> = {};
  for (const r of p.ramas) {
    const l = lectura.find((x) => x.variante === r.clave);
    filas[r.clave] = textoDeRama({ clave: r.clave, pct: r.peso }, ramas.find((x) => x.clave === r.clave), l?.n, verbo);
  }
  return { estado: p.estado, texto, filas, pruebaId: p.id };
}

/** La tasa de la métrica y el ritmo de entradas de esta automatización en los últimos 30 días (para el plan). */
async function historiaDe(ws: number, secuenciaId: number): Promise<{ base: number; ritmoPorDia: number; conHistoria: boolean }> {
  const desde = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await getSupabaseServer().from('nutricion_inscripciones').select('estado')
    .eq('workspace_id', ws).eq('secuencia_id', secuenciaId).gte('inscripto_at', desde).limit(5000);
  if (error) throw new Error(`nutricion_inscripciones: ${error.message}`);
  const filas = (data ?? []) as Array<{ estado: string | null }>;
  const respondieron = filas.filter((f) => ESTADOS_RESPONDIO.has(String(f.estado ?? ''))).length;
  const conHistoria = filas.length >= MIN_HISTORIA && respondieron > 0;
  return { base: conHistoria ? respondieron / filas.length : TASA_SIN_HISTORIA, ritmoPorDia: filas.length / 30, conHistoria };
}

/**
 * EMPEZAR LA PRUEBA de la tarjeta, sobre lo PUBLICADO (lo que corre el motor): la tarjeta tiene que estar guardada y
 * completa. Calcula el plan antes de arrancar (el horizonte del juez) y la crea corriendo. El texto del plan vuelve a la
 * pantalla («Con tu ritmo … en ~24 días», o «No llega en 60 días…»).
 */
export async function empezarPruebaDeLaTarjeta(ws: number, secuenciaId: number, nodoId: string, quien: string, o: { mdeRel?: number } = {}):
  Promise<{ ok: true; pruebaId: number; plan: string } | { ok: false; error: string }> {
  const { data: sec, error } = await getSupabaseServer().from('nutricion_secuencias').select('id, nombre, pasos, estrategia')
    .eq('workspace_id', ws).eq('id', secuenciaId).maybeSingle();
  if (error) throw new Error(`nutricion_secuencias: ${error.message}`);
  if (!sec) return { ok: false, error: 'Esa automatización no es de este negocio.' };
  const pasos = (Array.isArray((sec as { pasos?: unknown }).pasos) ? (sec as { pasos: PasoGrafo[] }).pasos : []) as PasoGrafo[];
  const ab = nodoPorId(pasos, nodoId);
  if (!ab || tarjetaABDe(pasos) !== nodoId) return { ok: false, error: 'Publica la automatización antes de empezar la prueba: la tarjeta todavía no está guardada.' };
  const mal = problemasDeTarjetaAB(ab, nodoId, true);
  if (mal.length) return { ok: false, error: `Antes de empezar: ${mal[0]}.` };
  if (ramasABDe(ab).some((r) => !r.siguiente)) return { ok: false, error: 'Cada rama tiene que llevar a algo: conecta las ramas vacías y publica.' };
  const metrica = metricaDeLaAutomatizacion((sec as { estrategia?: unknown }).estrategia);
  const h = await historiaDe(ws, secuenciaId);
  const ramas = ramasParaLaPrueba(pasos, nodoId);
  const mdeRel = o.mdeRel && o.mdeRel > 0 ? o.mdeRel : MDE_DE_FABRICA;
  const plan = planDePrueba({
    base: h.base, mdeRel, ramas: ramas.length, ritmoPorDia: h.ritmoPorDia, ventanaDias: VENTANA_DIAS_AB, minDias: 7, maxDias: MAX_DIAS_AB,
    pesoMinimo: Math.min(...ramas.map((r) => r.peso)),
  });
  try {
    const p = await crearPrueba(ws, {
      superficie: 'automatizacion', lugar: { secuencia_id: secuenciaId, nodo_id: nodoId }, claveLugar: claveLugarAuto(secuenciaId),
      titulo: `Prueba A/B de «${String((sec as { nombre?: unknown }).nombre ?? '')}»`,
      hipotesis: `Una de las ramas mejora «${metricaDe(metrica)?.titulo ?? metrica}»`, origen: 'dueno',
      metrica, guardrails: metrica === 'agendo' ? [] : [{ metrica: 'agendo', toleranciaRel: 0.1 }],
      ventanaDias: VENTANA_DIAS_AB, tasaBase: h.base, mdeRel, nPorRama: plan.nPorRama, minDias: 7, maxDias: MAX_DIAS_AB,
      ramas, arrancar: true,
    }, quien);
    const sinHistoria = h.conHistoria ? '' : ' (Todavía no hay historia: se planeó con un 10 %.)';
    return { ok: true, pruebaId: p.id, plan: plan.texto + sinHistoria };
  } catch (e) {
    if (e instanceof PruebaYaViva) return { ok: false, error: e.message };
    if (e instanceof PruebasSinTabla) return { ok: false, error: 'Las pruebas A/B todavía no están prendidas en MaKo: falta un paso del equipo.' };
    throw e;
  }
}

/** DETENER la prueba de la automatización: deja de repartir (todos a A) y no concluye nada. */
export async function detenerPruebaDeLaTarjeta(ws: number, secuenciaId: number, quien: string): Promise<{ ok: boolean; error?: string }> {
  const p = await pruebaVivaDe(ws, claveLugarAuto(secuenciaId));
  if (!p) return { ok: false, error: 'Esta automatización no tiene una prueba corriendo.' };
  return { ok: await detenerPrueba(ws, p.id, quien, 'La detuvo el dueño.') };
}

/**
 * AL GUARDAR EL FLUJO (lo llama `setSecuenciaPasos`): con una prueba corriendo, cambiar lo de una rama o su porcentaje abre
 * una ÉPOCA nueva (sólo cuentan los que entran después, diseño 2.4), y borrar la tarjeta o cambiar sus ramas la DETIENE.
 * Nunca tira: lo guardado ya quedó, y una prueba que no se pudo revisar se revisa en el próximo guardado.
 */
export async function revisarLaPruebaAlGuardar(secuenciaId: number, pasos: readonly PasoGrafo[]): Promise<void> {
  try {
    const ws = await getWorkspaceActual();
    if (ws == null) return;
    const p = await pruebaVivaDe(ws, claveLugarAuto(secuenciaId));
    if (!p || p.estado !== 'corriendo') return;
    const c = cambiosDeLaPrueba(pasos, String(p.lugar.nodo_id ?? ''), p.ramas);
    if (c.que === 'nada') return;
    if (c.que === 'detener') { await detenerPrueba(ws, p.id, 'mako', c.porque); return; }
    await actualizarRamas(ws, p.id, c.ramas);
    await reiniciarEpoca(ws, p.id, p.epoca, 'dueno', c.porque);
  } catch (e) {
    console.error(`[pruebas] revisar la prueba de #${secuenciaId} al guardar: ${e instanceof Error ? e.message : String(e)}`);
  }
}
