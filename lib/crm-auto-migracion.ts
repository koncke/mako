// =============================================================================
// crm-auto-migracion — el plan PURO para pasar el CRM automático a plantillas de Automations (b5, 24/10/2026)
// =============================================================================
// Lo usa scripts/crm-auto-a-automatizaciones.mts, que lee la base y escribe. Acá vive lo que se puede probar sin base
// (tests/crm-auto-migracion.test.ts):
//   · qué automatizaciones necesita un negocio, con qué CRON y a qué etapas mueve (`planDelNegocio`);
//   · los pasos EXACTOS que escribe cada una (`pasosDelPlan`: la espera y la pregunta, ancladas a SU reunión);
//   · si una automatización viva ya ES una del plan o sólo tiene su clave (`clasificarVivas`, por la firma del grafo);
//   · a quién toma cada una al prenderla (`tomaAlPrender`) y lo que el motor haría hoy de verdad (`claveAntiLoop`);
//   · qué confirmaciones viejas del motor se archivan en el mismo movimiento que lo apaga (`confirmacionesAArchivar`).
// Cada regla sale de un hallazgo de las revisiones del b5 (S1–S9, M1/E1/M4 y la segunda, wf_933af347-1e1: docs/hallazgos-crm.md).

import { esperaDesde, normalizar, type AnclaDespues, type FilaCondicion, type PasoGrafo } from './flujo-grafo';
import { OP_MOVER_ETAPA } from './flujo-legado';
import { reunionesDe } from './funnel-etapas';
import { pipelineStageOf, type StageDerivable } from './pipeline';
import { destinosDeEleccion, pasosConDestinos, plantillaPorId } from './plantillas-automatizaciones';
import { anclaDeEspera, fechasDespuesDe } from './nutricion-grafo-motor';
import { quedaDondeLoPusieron } from '../app/crm/origen-lead';

export type EtapaDelFunnel = { key: string; label?: string; kind?: string };
export type ReglaMigrada = 'T1' | 'T2' | 'T3';
export type AnclaDeReunion = Extract<AnclaDespues, 'reunion_1' | 'reunion_2'>;

/** Una automatización que el negocio necesita para que apagar el motor no deje una regla sin cubrir. */
export type PlanMigracion = {
  plantilla: 'lead-no-agendo' | 'reunion-sin-marcar' | 'nutricion-vencida';
  regla: ReglaMigrada;
  /** El CRON como lo elige el desplegable: `venta::<etapa>[,<etapa>]` (sin embudo: la etapa de la casa del lead). */
  cron: string;
  /** Las etapas de ese CRON. */
  etapas: string[];
  /** Destino de la plantilla → la etapa, como el desplegable (`venta::<etapa>`). */
  destinos?: Record<string, string>;
  /** Sólo «Una Reunión Sin Marcar»: la reunión de ESA automatización (la 1ª o la 2ª de `reunionesDe`). */
  ancla?: AnclaDeReunion;
  /** Y su etapa en el embudo del negocio (`<funnelId>:<etapa>`): «Asistencia sin marcar» mira SÓLO esa reunión. */
  reunion?: string;
};

const venta = (etapas: readonly string[]) => `venta::${etapas.join(',')}`;
/** `venta:<embudo>:<etapa>` → la etapa. */
export const etapaDeValor = (v: string): string => v.split(':')[2] ?? '';

/**
 * LO QUE NECESITA UN NEGOCIO, con las etapas de SU CRM.
 *   · T2 «Un Lead No Agendó» cuelga de Lead entrante Y de No Agenda (S5): el motor mira las dos (lib/crm-auto-plan.ts), y
 *     los que ya pasó a No Agenda tienen que llegar a Reactivación cuando se lo apague. Moverlos «a No Agenda» desde No
 *     Agenda no hace nada (`setPipelineStage` no reinscribe en la misma etapa).
 *   · T1 «Una Reunión Sin Marcar», UNA por reunión (M1/E1): una inscripción por lead y automatización, así que una sola
 *     para las dos reuniones nunca revisaba la 2ª. Cada una con la espera anclada a SU reunión (M4: «la reunión» es la
 *     última) y la pregunta acotada a ESA reunión (`reunion`). La de la 1ª cuelga de las DOS etapas de reunión (2ª
 *     revisión): con la 2ª cargada, la etapa DERIVADA del lead pasa a la de la 2ª, y colgada sólo de la 1ª la pregunta por la
 *     1ª sin marcar esperaba a la 2ª o se perdía. El motor sólo conoce dos reuniones.
 *   · T3 «Venció la Nutrición Manual», en la etapa manual.
 *   · T6 NO (S1/S4): su CRON son etapas de salida, que el CRON no acepta (`productosConEtapas` las saca), y el barrido sólo
 *     toma abiertos. Al apagar el motor deja de correr: el simulacro lo dice.
 * `vendibles`: las etapas que el CRON acepta (las de `productosConEtapas`). Una etapa del plan que no está ahí BLOQUEA al
 * negocio entero antes de crear nada (S1: `guardarDisparadores` la rechaza después del insert). `funnelId`: el embudo del
 * negocio, para acotar la pregunta a una reunión; sin él, T1 bloquea.
 */
export function planDelNegocio(stages: readonly EtapaDelFunnel[], vendibles: ReadonlySet<string>, funnelId: number | null): { planes: PlanMigracion[]; faltan: string[]; bloqueos: string[] } {
  const hay = new Set(stages.map((s) => s.key));
  const planes: PlanMigracion[] = [];
  const faltan: string[] = [];
  const bloqueos: string[] = [];
  const t2 = ['lead', 'nutri', 'reactivacion'];
  if (t2.every((k) => hay.has(k))) {
    planes.push({ plantilla: 'lead-no-agendo', regla: 'T2', cron: venta(['lead', 'nutri']), etapas: ['lead', 'nutri'], destinos: { no_agenda: venta(['nutri']), reactivacion: venta(['reactivacion']) } });
  } else faltan.push(`T2 «Un Lead No Agendó»: faltan las etapas ${t2.filter((k) => !hay.has(k)).join(', ')}`);
  const reus = reunionesDe(stages);
  if (reus.length && funnelId == null) bloqueos.push('T1: sin el embudo del negocio no se puede acotar la pregunta a una reunión');
  else if (reus.length) {
    const dos = reus.slice(0, 2);
    planes.push({ plantilla: 'reunion-sin-marcar', regla: 'T1', cron: venta(dos), etapas: dos, ancla: 'reunion_1', reunion: `${funnelId}:${reus[0]}` });
    if (reus[1]) planes.push({ plantilla: 'reunion-sin-marcar', regla: 'T1', cron: venta([reus[1]]), etapas: [reus[1]], ancla: 'reunion_2', reunion: `${funnelId}:${reus[1]}` });
  }
  if (!reus.length) faltan.push('T1 «Una Reunión Sin Marcar»: el embudo no tiene etapas de reunión');
  if (reus.length > 2) faltan.push(`T1 para ${reus.slice(2).join(', ')}: el motor sólo conoce la 1ª y la 2ª reunión`);
  if (hay.has('manual')) planes.push({ plantilla: 'nutricion-vencida', regla: 'T3', cron: venta(['manual']), etapas: ['manual'] });
  else faltan.push('T3 «Venció la Nutrición Manual»: no hay etapa manual');
  faltan.push('T6 «Un Lead Se Enfrió»: no se crea (su CRON son etapas de salida, que el CRON no acepta, y el barrido sólo toma abiertos). Al apagar el motor, T6 deja de correr');
  for (const p of planes) {
    for (const k of [...p.etapas, ...Object.values(p.destinos ?? {}).map(etapaDeValor)]) {
      if (!vendibles.has(k)) bloqueos.push(`${p.regla}: la etapa «${k}» no se puede elegir (no está en las etapas de venta de ningún producto)`);
    }
  }
  return { planes, faltan, bloqueos: [...new Set(bloqueos)] };
}

/**
 * LA ESPERA «N DESPUÉS DE LA REUNIÓN», anclada a una reunión fija. Copia: no toca los pasos que recibe. Toda espera «después
 * de la reunión» pasa a esa; las demás quedan igual.
 */
export function conAnclaDeReunion<T extends PasoGrafo>(pasos: readonly T[], ancla: AnclaDeReunion): T[] {
  return pasos.map((p) => {
    if (p.espera?.modo !== 'despues_de' || p.espera.de !== 'reunion') return p;
    const e = esperaDesde(p.espera, ancla);
    return e ? { ...p, espera: e } : p;
  });
}

/** La pregunta «Asistencia sin marcar» acotada a UNA reunión (`<funnelId>:<etapa>`). Copia. */
export function conPreguntaDeReunion<T extends PasoGrafo>(pasos: readonly T[], reunion: string): T[] {
  return pasos.map((p) => (!p.ramas?.length ? p : {
    ...p,
    ramas: p.ramas.map((r) => ({ ...r, filas: r.filas.map((f: FilaCondicion) => (f.campo === 'asistencia_sin_marcar' ? { ...f, reuniones: [reunion] } : f)) })),
  }));
}

/** El plan sobre los pasos de su plantilla: la espera anclada y la pregunta acotada a su reunión (lo que hace `setPasos` del script). */
export function alPlan<T extends PasoGrafo>(pasos: readonly T[], plan: PlanMigracion): T[] {
  const anclados = plan.ancla ? conAnclaDeReunion(pasos, plan.ancla) : [...pasos];
  return plan.reunion ? conPreguntaDeReunion(anclados, plan.reunion) : anclados;
}

/** LOS PASOS QUE ESCRIBE EL SCRIPT para un plan: los de la plantilla, con sus destinos, el plan encima, normalizados. */
export function pasosDelPlan(plan: PlanMigracion): PasoGrafo[] {
  const p = plantillaPorId(plan.plantilla);
  if (!p) return [];
  const { elegidos } = destinosDeEleccion(p, plan.destinos);
  return normalizar(alPlan(pasosConDestinos(p, elegidos) as PasoGrafo[], plan)) as PasoGrafo[];
}

type FilaFirma = FilaCondicion & { reuniones?: unknown; funnel_id?: unknown; union?: unknown };
/**
 * LA FIRMA DE UN PASO: lo que decide a quién toma, cuándo y qué hace (2ª revisión: adoptar una fila mirando sólo el CRON
 * prendía una T3 que no avisaba, o una T2 sin su «Está en la etapa»). Sin los textos: el aviso se puede reescribir. Medido
 * que da IGUAL entre lo esperado y lo que guarda `setSecuenciaPasos` (tests/crm-auto-migracion.test.ts, 2c).
 */
function firmaDePaso(p: PasoGrafo & { si_no?: string | null; accion?: { operacion?: string; params?: Record<string, unknown> } }): string {
  return JSON.stringify([
    p.nodo ?? null, p.siguiente ?? null, p.si_no ?? null,
    p.espera ? [p.espera.modo, p.espera.minutos ?? null, (p.espera as { de?: unknown }).de ?? null] : null,
    (p.ramas ?? []).map((r) => [r.siguiente ?? null, (r.filas ?? []).map((f: FilaFirma) => [f.campo, f.valor ?? null, !!f.no, f.union ?? null, f.reuniones ?? null, f.funnel_id ?? null])]),
    p.accion ? [p.accion.operacion ?? null, p.accion.params?.etapa ?? null, p.accion.params?.embudoId ?? null] : null,
  ]);
}

/** Una automatización viva del negocio, como la lee el script. */
export type FilaViva = {
  id: number; clave: string | null; nombre: string; activa: boolean; trigger_tipo: string | null; disparadores: unknown; pasos: unknown;
};

type DisparadorFila = { trigger_tipo?: unknown; etapa?: unknown; etapas?: unknown; funnel_id?: unknown };
const conjunto = (xs: readonly string[]) => [...new Set(xs)].sort().join(',');

/** Las etapas del CRON de una fila, si es UN CRON de etapa de venta sin embudo; si no, por qué no. */
function etapasDelCron(disparadores: unknown): { etapas: string[] } | { motivo: string } {
  const ds = Array.isArray(disparadores) ? (disparadores as DisparadorFila[]) : [];
  if (ds.length !== 1) return { motivo: ds.length ? `tiene ${ds.length} CRON` : 'no tiene CRON' };
  const d = ds[0];
  if (d.trigger_tipo !== 'etapa_actual') return { motivo: `su CRON es «${String(d.trigger_tipo)}»` };
  if (d.funnel_id != null) return { motivo: `su CRON es del embudo ${String(d.funnel_id)}` };
  const etapas = Array.isArray(d.etapas) && d.etapas.length ? d.etapas.map(String) : typeof d.etapa === 'string' && d.etapa ? [d.etapa] : [];
  return etapas.length ? { etapas } : { motivo: 'su CRON no tiene etapa' };
}

/** ¿La fila ES ese plan? null = sí; si no, la diferencia, dicha. Primero lo que se entiende, al final la firma entera. */
export function diferenciaConElPlan(fila: FilaViva, plan: PlanMigracion): string | null {
  const cron = etapasDelCron(fila.disparadores);
  if ('motivo' in cron) return cron.motivo;
  if (conjunto(cron.etapas) !== conjunto(plan.etapas)) return `su CRON es ${cron.etapas.join(' + ')}, no ${plan.etapas.join(' + ')}`;
  const pasos = Array.isArray(fila.pasos) ? (fila.pasos as PasoGrafo[]) : [];
  const porId = new Map(pasos.map((p) => [p.id, p]));
  for (const d of plantillaPorId(plan.plantilla)?.destinos ?? []) {
    const quiere = plan.destinos?.[d.id] ? etapaDeValor(plan.destinos[d.id]) : null;
    for (const id of d.mover) {
      const x = porId.get(id) as (PasoGrafo & { accion?: { operacion?: string; params?: Record<string, unknown> } }) | undefined;
      if (x?.accion?.operacion !== OP_MOVER_ETAPA) return `no tiene el «Mover de etapa» ${id}`;
      if (x.accion.params?.etapa !== quiere) return `${id} mueve a «${String(x.accion.params?.etapa ?? '')}», no a «${quiere ?? ''}»`;
      if (x.accion.params?.embudoId != null) return `${id} mueve dentro del embudo ${String(x.accion.params.embudoId)}`;
    }
  }
  if (plan.ancla) {
    const anclas = pasos.filter((p) => p.espera?.modo === 'despues_de').map((p) => (p.espera as { de?: unknown }).de);
    if (!anclas.length) return 'no tiene la espera «después de la reunión»';
    const otra = anclas.find((a) => a !== plan.ancla);
    if (otra !== undefined) return `su espera cuenta desde «${String(otra)}», no desde «${plan.ancla}»`;
  }
  const esperado = pasosDelPlan(plan);
  const ids = new Set([...esperado.map((p) => p.id), ...pasos.map((p) => p.id)]);
  const deEsperado = new Map(esperado.map((p) => [p.id, p]));
  for (const id of ids) {
    const a = deEsperado.get(id);
    const b = porId.get(id);
    if (!a) return `tiene una tarjeta de más (${String(id)})`;
    if (!b) return `le falta la tarjeta ${String(id)}`;
    if (firmaDePaso(a) !== firmaDePaso(b)) return `la tarjeta ${String(id)} no es la de la plantilla`;
  }
  return null;
}

/**
 * LAS VIVAS DEL NEGOCIO CONTRA EL PLAN (S3). «Ya existe» es una fila con la clave de la plantilla que ES el plan (el mismo
 * grafo: CRON, destinos, ancla, condiciones), no cualquiera con el prefijo: una que se cortó a mitad o que alguien armó
 * distinta no se adopta. Una con la clave de una plantilla del plan que no es ninguno, o dos que son el mismo, frenan al
 * negocio: el script no adivina cuál vale.
 */
export function clasificarVivas(vivas: readonly FilaViva[], planes: readonly PlanMigracion[]): { deCada: Array<FilaViva | null>; ajenas: Array<{ fila: FilaViva; motivo: string }> } {
  const deCada: Array<FilaViva | null> = planes.map(() => null);
  const ajenas: Array<{ fila: FilaViva; motivo: string }> = [];
  const plantillas = new Set(planes.map((p) => p.plantilla));
  for (const fila of vivas) {
    const pl = [...plantillas].find((x) => (fila.clave ?? '').startsWith(`plantilla-${x}-`));
    if (!pl) continue;
    const mios = planes.map((p, i) => ({ p, i })).filter(({ p }) => p.plantilla === pl);
    const igual = mios.find(({ p }) => diferenciaConElPlan(fila, p) == null);
    if (!igual) {
      // La diferencia que se dice es la del plan con su MISMO CRON, si hay uno (con dos «Reunión Sin Marcar», la de la R2
      // anclada a la R1 es «otra ancla», no «otro CRON»).
      const difs = mios.map(({ p }) => diferenciaConElPlan(fila, p) ?? '');
      ajenas.push({ fila, motivo: difs.find((d) => !/CRON/.test(d)) ?? difs[0] ?? 'no es ninguna del plan' });
      continue;
    }
    const ya = deCada[igual.i];
    if (ya) { ajenas.push({ fila, motivo: `es la misma que #${ya.id}` }); continue; }
    deCada[igual.i] = fila;
  }
  return { deCada, ajenas };
}

/** Un lead como lo lee el script (las columnas de `AUTO_COLS`). */
export type LeadMigracion = StageDerivable & {
  id: number; funnel_id?: number | null; origen_lead?: string | null; nutricion_manual_deadline?: string | null; created_at: string;
  junta_1_at?: string | null; junta_2_at?: string | null;
};

/** El último hito del lead, como el barrido del CRON de etapa (lib/nutricion.ts, cohorte `etapa_actual`). */
const ultimoHito = (l: LeadMigracion): number => Math.max(
  ...[l.created_at, l.fecha_agenda, l.fecha_junta_1, l.fecha_junta_2]
    .filter((x): x is string => Boolean(x)).map((x) => Date.parse(x)).filter((ms) => Number.isFinite(ms)),
  0,
);

/** Las 3 h de «Una Reunión Sin Marcar» (lib/plantillas-automatizaciones.ts, `rm_e`): la leo de la plantilla, no la copio. */
function minutosDespuesDeLaReunion(): number {
  const rm = plantillaPorId('reunion-sin-marcar');
  const e = rm?.pasos.find((p) => p.espera?.modo === 'despues_de')?.espera;
  return e?.minutos ?? 180;
}

/**
 * A QUIÉN TOMA AL PRENDERLA (S7/S8): los que el barrido del CRON de etapa inscribe en la primera pasada, con la misma regla
 * (abiertos, parados en una etapa del CRON, con un hito en los últimos 90 días). Aparte:
 *   · `sinFecha`: los que no tienen la fecha de su espera (la reunión de esa automatización, o el plazo de nutrición). Se
 *     los vuelve a mirar 24 h y después se cierran: si la fecha llega más tarde, ya no los toma (S8);
 *   · `delGrupo`: los traídos de un grupo de WhatsApp en T2, que entran pero quedan quietos;
 *   · `fueraDeVentana`: abiertos en la etapa con el último hito hace más de 90 días: el barrido no los toma nunca;
 *   · `avisaEnseguida`: los que MaKo avisa en el grupo apenas se prende, y eso no se deshace. T3 (con `hoy`, el día del
 *     NEGOCIO): el plazo ya vencido. T1 (con `zona`): su reunión + 3 h ya pasó y nadie marcó si vino (2ª revisión);
 *   · `yaPasaron`: ids de quien ya tiene una inscripción en ESA automatización (una adoptada que ya corrió): una por lead y
 *     automatización, así que no vuelve a entrar. Salen de la toma.
 */
export function tomaAlPrender(
  leads: readonly LeadMigracion[], plan: PlanMigracion, ahoraMs: number,
  o: { hoy?: string; zona?: string | null; yaPasaron?: ReadonlySet<number> } = {},
): { ids: number[]; sinFecha: number[]; delGrupo: number[]; fueraDeVentana: number[]; avisaEnseguida: number[] } {
  const corte = ahoraMs - 90 * 86_400_000;
  const enLaEtapa = leads.filter((l) => l.estado_lead === 'abierto' && plan.etapas.includes(pipelineStageOf(l)));
  const toma = enLaEtapa.filter((l) => ultimoHito(l) >= corte && !o.yaPasaron?.has(l.id));
  const fecha = (l: LeadMigracion): string | null | undefined => (plan.regla === 'T3' ? l.nutricion_manual_deadline
    : plan.ancla === 'reunion_1' ? l.fecha_junta_1 : plan.ancla === 'reunion_2' ? l.fecha_junta_2 : 'no aplica');
  const espera = minutosDespuesDeLaReunion() * 60_000;
  const avisa = (l: LeadMigracion): boolean => {
    if (plan.regla === 'T3') return !!o.hoy && !!l.nutricion_manual_deadline && l.nutricion_manual_deadline.slice(0, 10) < o.hoy;
    if (plan.regla !== 'T1' || !plan.ancla) return false;
    const reunion = anclaDeEspera(fechasDespuesDe(l, o.zona), plan.ancla);
    const asistio = plan.ancla === 'reunion_1' ? l.asistio_j1 : l.asistio_j2;
    return reunion != null && reunion + espera <= ahoraMs && asistio == null;
  };
  return {
    ids: toma.map((l) => l.id),
    sinFecha: toma.filter((l) => !fecha(l)).map((l) => l.id),
    delGrupo: plan.regla === 'T2' ? toma.filter((l) => quedaDondeLoPusieron(l.origen_lead)).map((l) => l.id) : [],
    fueraDeVentana: enLaEtapa.filter((l) => ultimoHito(l) < corte).map((l) => l.id),
    avisaEnseguida: toma.filter((l) => !!fecha(l) && avisa(l)).map((l) => l.id),
  };
}

/** La clave anti-loop del motor para una acción (lib/crm-auto.ts, `aplicarAccion`): con una confirmación así, la saltea. */
export function claveAntiLoop(a: { regla: string; which?: string | null }): string | null {
  if (a.regla === 'T1') return `T1:${a.which ?? 'j1'}`;
  return a.regla === 'T3' || a.regla === 'T6' ? a.regla : null;
}

/** La clave que cubre cada plan: T1 la de SU reunión, T3 la suya; T2 no deja confirmación. */
export function claveDelPlan(p: PlanMigracion): string | null {
  if (p.regla === 'T1') return p.ancla === 'reunion_2' ? 'T1:j2' : 'T1:j1';
  return p.regla === 'T3' ? 'T3' : null;
}

/** Una confirmación del motor (`mako_confirmaciones`) pendiente. */
export type ConfirmacionPendiente = { id: number; lead_id: number; lead_nombre: string | null; regla: string; clave: string; aplicado: boolean | null };

/**
 * QUÉ CONFIRMACIONES VIEJAS SE ARCHIVAN al apagar el motor (el Cerebro, 23/10/2026), POR CLAVE (2ª revisión): T1:j1 la cubre
 * la automatización de la 1ª reunión, T1:j2 la de la 2ª, T3 la suya. Ninguna toca al lead.
 *   · La que el motor YA aplicó (aplicado): lo aplicado queda como está y se deshace desde el historial; se archiva si su
 *     clave queda cubierta.
 *   · La que PIDE una decisión (aplicado=false: «¿fue a la reunión?», «decide si no responde o se perdió») sólo se archiva si
 *     la automatización la vuelve a pedir a ESE lead: su id en `vuelveAPreguntar` de esa clave. Sin el conjunto de esa clave,
 *     queda viva: se cierra en falla, porque archivarla dejaba la decisión sin nadie que la vuelva a pedir.
 * Las de una clave sin automatización (T6, o la 2ª reunión en un embudo con una sola) quedan vivas, y el script lo dice.
 */
export function confirmacionesAArchivar(
  pendientes: readonly ConfirmacionPendiente[], cubiertas: ReadonlySet<string>, vuelveAPreguntar: ReadonlyMap<string, ReadonlySet<number>> = new Map(),
): { archivar: Array<ConfirmacionPendiente & { motivo: string }>; quedan: Array<ConfirmacionPendiente & { porque: string }> } {
  const archivar: Array<ConfirmacionPendiente & { motivo: string }> = [];
  const quedan: Array<ConfirmacionPendiente & { porque: string }> = [];
  const nombre: Record<string, string> = { T1: 'Una Reunión Sin Marcar', T3: 'Venció la Nutrición Manual' };
  for (const c of pendientes) {
    const regla = c.clave.split(':')[0];
    if (!cubiertas.has(c.clave) || !nombre[regla]) { quedan.push({ ...c, porque: `${c.clave} no pasa a una automatización prendida en este movimiento` }); continue; }
    if (!c.aplicado && !vuelveAPreguntar.get(c.clave)?.has(c.lead_id)) {
      quedan.push({ ...c, porque: `«${nombre[regla]}» no lo vuelve a preguntar al prenderla (no está en la etapa, le falta la fecha, ya pasó por ella o su último hito pasó de 90 días)` });
      continue;
    }
    const loAplicado = c.aplicado ? ' Lo que el motor ya aplicó queda como está y se deshace desde el historial del lead.' : '';
    archivar.push({ ...c, motivo: `Archivada (b5): el CRM automático pasó a la automatización «${nombre[regla]}». Se cerró sin tocar al lead.${loAplicado}` });
  }
  return { archivar, quedan };
}
