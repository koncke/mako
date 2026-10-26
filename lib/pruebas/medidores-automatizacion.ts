// =============================================================================
// pruebas/medidores-automatizacion — «respondió», «agendó» y «pagó» de una prueba de la tarjeta «A/B TEST» (25/10/2026)
// =============================================================================
// Los medidores de Automations que corre el cron de pruebas (app/api/cron/pruebas). La unidad es el `lead_id`. Leen lo que
// ya existe con el ws EXPLÍCITO (corren en un cron): la inscripción del lead en la automatización de la prueba
// (`pruebas.lugar.secuencia_id`) y la fila del lead. Las reglas (el primer resultado manda, un estado cuenta sólo si al asignar
// no estaba) están en lib/pruebas/resultados.ts, puras y con test. Devuelven el resultado de CADA asignación que se les pide:
// una que no encuentran es un «no», nunca un hueco (un hueco haría fallar la lectura entera).
// =============================================================================

import 'server-only';
import { getSupabaseServer } from '@/lib/supabase';
import { agendoLead, pagoLead } from '@/lib/nutricion-grafo-motor';
import type { Asignacion, Medidor, Resultado } from './metricas';
import { conElPrimero, pasoA, respondio, type Congelado } from './resultados';
import { congelarResultado, leerPrueba, resultadosCongelados } from './store';

type Fila = Record<string, unknown>;
const TANDA = 200;

/** Lee de a tandas las filas de `tabla` cuyo `columna` está entre `ids`, del negocio `ws` (y, si viene, con `igual`). */
async function enTandas(ws: number, tabla: string, columnas: string, columna: string, ids: readonly number[], igual?: { columna: string; valor: number }): Promise<Fila[]> {
  const out: Fila[] = [];
  for (let i = 0; i < ids.length; i += TANDA) {
    const base = getSupabaseServer().from(tabla).select(columnas).eq('workspace_id', ws).in(columna, ids.slice(i, i + TANDA));
    const { data, error } = await (igual ? base.eq(igual.columna, igual.valor) : base);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    out.push(...((data ?? []) as unknown as Fila[]));
  }
  return out;
}

const idsDe = (asignaciones: readonly Asignacion[]): number[] =>
  [...new Set(asignaciones.map((a) => Number(a.unidad)).filter((n) => Number.isInteger(n) && n > 0))];

/** Arma el mapa con el primer resultado de cada una (de ESTA métrica) y congela los «sí» nuevos. */
async function conCongelados(ws: number, pruebaId: number, metrica: string, asignaciones: readonly Asignacion[], medir: (a: Asignacion) => Resultado): Promise<Map<string, Resultado>> {
  const p = await leerPrueba(ws, pruebaId);
  const congelados = p ? await resultadosCongelados(ws, pruebaId, p.epoca) : new Map<string, Record<string, { at: string | null }>>();
  const out = new Map<string, Resultado>();
  for (const a of asignaciones) {
    const previos = congelados.get(a.unidad) ?? {};
    const ya: Congelado | undefined = previos[metrica] ? { resultado: true, resultadoAt: previos[metrica].at } : undefined;
    const r = conElPrimero(ya, medir(a));
    if (r.congelar) {
      await congelarResultado(ws, pruebaId, a.unidad, metrica, r.resultado.at ?? null, previos);
      congelados.set(a.unidad, { ...previos, [metrica]: { at: r.resultado.at ?? null } });
    }
    out.set(a.unidad, r.resultado);
  }
  return out;
}

/** «Respondió»: la inscripción del lead en ESTA automatización terminó contestando. */
export const medirRespondio: Medidor = async ({ ws, pruebaId, metrica, lugar, asignaciones }) => {
  const sec = Number(lugar.secuencia_id);
  if (!Number.isInteger(sec) || sec <= 0) throw new Error('la prueba no dice de qué automatización es (lugar.secuencia_id)');
  const filas = await enTandas(ws, 'nutricion_inscripciones', 'lead_id, estado, desenlace_at, updated_at', 'lead_id', idsDe(asignaciones),
    { columna: 'secuencia_id', valor: sec });
  const porLead = new Map(filas.map((f) => [String(f.lead_id), f as { estado: string | null; desenlace_at: string | null; updated_at: string | null }]));
  return conCongelados(ws, pruebaId, metrica, asignaciones, (a) => respondio(porLead.get(a.unidad)));
};

/** Un ESTADO del lead («agendó», «pagó»): cuenta si al asignar no estaba y hoy sí. */
function medirEstado(esta: (lead: Fila) => boolean): Medidor {
  return async ({ ws, pruebaId, metrica, asignaciones, hasta }) => {
    const filas = await enTandas(ws, 'leads', 'id, fecha_junta_1, junta_1_at, fecha_junta_2, junta_2_at, fecha_primer_pago, cerro', 'id', idsDe(asignaciones));
    const porLead = new Map(filas.map((f) => [String(f.id), f]));
    // La hora de lo que se ve HOY es la de esta lectura: el día ya cerró (`hasta`).
    return conCongelados(ws, pruebaId, metrica, asignaciones, (a) => {
      const lead = porLead.get(a.unidad);
      return pasoA(a.previo, metrica, !!lead && esta(lead), hasta);
    });
  };
}

export const medirAgendo = medirEstado(agendoLead);
export const medirPago = medirEstado(pagoLead);

/** Los medidores de Automations, por clave de métrica (lib/pruebas/metricas.ts). */
export const MEDIDORES_AUTOMATIZACION: Readonly<Record<string, Medidor>> = {
  respondio: medirRespondio,
  agendo: medirAgendo,
  pago: medirPago,
};
