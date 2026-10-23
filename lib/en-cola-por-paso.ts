// =============================================================================
// en-cola-por-paso — cuántos esperan en cada tarjeta del lienzo, y POR QUÉ no les sale (23/10/2026, P0 de #289)
// =============================================================================
// Martín, por el Cerebro: «Si algo frena un envío (horario, tope, condición, línea), la tarjeta del paso y el lead lo DICEN
// en palabras: "No salió: fuera del horario, sale mañana 9:00". Nunca silencio». El lead lo dice en el CRM
// (lib/automatizaciones-del-lead.ts); esto es la tarjeta: las inscripciones vivas de UNA automatización, agrupadas por la
// tarjeta en la que están paradas (la MISMA ubicación que el motor: `indiceActual`), con el porqué de lib/por-que-no-sale.ts.
// Sólo las frenadas: las que corren no dicen nada (salen en la próxima vuelta). Puro: lo usan la ruta
// (app/api/flujos/en-cola) y los tests; el chip lo dibuja app/automations/FlujoLienzo.tsx (`ChipEnCola`).
// =============================================================================
import { indiceActual } from './nutricion-grafo-motor';
import { idDe, type PasoGrafo } from './flujo-grafo';
import { canalDelPaso, type FilaAutomatizacion, type FilaInscripcion, type FrenoDeFila } from './automatizaciones-del-lead-reglas';

/** Lo de UNA tarjeta: cuántos están frenados ahí, el chip («2 esperando · Sale mañana 9:00») y el porqué entero. */
export type EnColaDelPaso = { cuantos: number; chip: string; texto: string };

export function enColaPorPaso(filas: readonly FilaInscripcion[], sec: FilaAutomatizacion, frenoDe: FrenoDeFila | undefined): Record<string, EnColaDelPaso> {
  const out: Record<string, EnColaDelPaso> = {};
  if (!frenoDe) return out;
  const pasos = (Array.isArray(sec.pasos) ? sec.pasos : []) as PasoGrafo[];
  const porNodo = new Map<string, { cuantos: number; corto: string; texto: string }>();
  for (const f of filas) {
    if (f.estado !== 'activa' || Number(f.secuencia_id) !== Number(sec.id)) continue;
    const i = pasos.length ? indiceActual(pasos, { paso_actual: f.paso_actual ?? 0, nodo_actual: f.nodo_actual }) : -1;
    if (i < 0) continue;
    const freno = frenoDe(f, sec, canalDelPaso(pasos[i]));
    if (!freno) continue;
    const id = idDe(pasos[i], i);
    const ya = porNodo.get(id);
    // El primero manda el texto: en una tarjeta casi siempre es el mismo motivo para todos (el horario, la pausa).
    porNodo.set(id, ya ? { ...ya, cuantos: ya.cuantos + 1 } : { cuantos: 1, corto: freno.corto, texto: freno.texto });
  }
  for (const [id, x] of porNodo) {
    out[id] = { cuantos: x.cuantos, chip: `${x.cuantos === 1 ? '1 esperando' : `${x.cuantos} esperando`} · ${x.corto}`, texto: x.texto };
  }
  return out;
}
