// =============================================================================
// journey — construye la línea de tiempo del recorrido de un lead
// =============================================================================
// A partir de las fechas reales del lead (alta, reuniones, confirmación, cierre)
// arma los hitos del funnel en orden, con su estado. Compartido por el modal de
// detalle (CrmLead), la ruta /crm/[id] (Lead) y la lectura `journey_lead` de la
// API de MaKo. Función pura.
//
// LAS REUNIONES SALEN DEL EMBUDO DE ESE LEAD, no de dos rótulos cableados. El
// funnel es configurable por workspace (`lib/funnels.ts`): un negocio cuyas
// etapas `kind: 'reunion'` se llaman «Discovery» y «Cierre» veía igual «Reunión
// 1» y «Reunión 2» — la regla de la casa es nombrar la etapa como la ve el
// dueño, y una línea de tiempo que usa otro vocabulario que el Kanban de al
// lado está en otro idioma.
//
// ⚠️ LA TABLA `leads` SÓLO TIENE DOS SLOTS de reunión (fecha_junta_1/_2 +
// asistio_j1/_j2), así que un embudo con una TERCERA reunión no tiene dónde
// guardar su fecha. Quién es reunión, en qué orden y qué slot le toca lo decide
// un solo módulo (`lib/funnel-etapas.ts`); acá se consume. La tercera en
// adelante se dibuja únicamente cuando el lead ESTÁ parado en ella —si no sería
// un renglón permanente que no informa nada— y dice que su fecha no se
// registra, en vez de desaparecer en silencio.

import { fmtDDMMYYYY } from './date-utils';
// `reunionesDe` (quién es reunión y en qué orden) y `slotPorIndice` (qué par de
// columnas le toca) son la fuente ÚNICA de ese mapeo — ver la cabecera de
// funnel-etapas.ts. Copiar el filtro `kind === 'reunion'` acá sería el segundo
// lugar donde vive el mismo dato.
import { reunionesDe, slotPorIndice } from './funnel-etapas';

export type JourneyState = 'done' | 'failed' | 'pending' | 'upcoming' | 'lost';

export interface JourneyStep {
  key: string;
  label: string;
  sub?: string;
  date: string | null; // 'dd/mm/aaaa' o null
  state: JourneyState;
}

/**
 * Lo mínimo que hace falta de una etapa del embudo para armar su hito: la clave
 * (para saber si el lead está parado ahí) y el rótulo que ve el dueño. Trae
 * `kind` porque es lo único que marca una reunión.
 *
 * No ata a `Stage` a propósito: journey.ts lo importa un componente cliente
 * (`app/crm/LeadSheet.tsx`), y el tipo liviano deja claro que de las ~20
 * propiedades de un Stage acá sólo se miran tres.
 */
export type EtapaReunion = { key: string; label: string; kind?: string };

export interface JourneyInput {
  createdISO: string | null;
  fechaAgenda: string | null;
  fechaJ1: string | null;
  asistioJ1: boolean | null;
  fechaJ2: string | null;
  asistioJ2: boolean | null;
  fechaConfirmacion: string | null;
  fechaPrimerPago: string | null;
  fechaCierre: string | null;
  estadoLead: string;
  monto: number;
  /** Hoy en ISO (YYYY-MM-DD) para distinguir reunión futura de pasada; opcional. */
  hoyISO?: string | null;
  /**
   * Etapas del embudo DE ESE LEAD (`getPipelineStagesDeLead`), en orden. De acá
   * salen las reuniones y sus rótulos.
   *
   * ⚠️ OPCIONAL, Y SIN ELLAS NO SE INVENTA NADA: un recorrido armado sin el
   * embudo cae a los dos rótulos de siempre («Reunión 1» / «Reunión 2»), que es
   * exactamente lo que se veía antes. Un chequeo que no puede mirar se abstiene.
   */
  etapas?: readonly EtapaReunion[] | null;
  /**
   * Etapa EFECTIVA del lead (`etapaVigenteDe`). Lo único que decide es si se
   * dibuja una reunión SIN SLOT —la tercera en adelante—: sin esto, el embudo de
   * tres reuniones termina su línea de tiempo antes de donde el lead está.
   */
  etapaActual?: string | null;
}

const fmt = (s: string | null): string | null => (s ? fmtDDMMYYYY(s) : null);

/** Rótulos de cuando no se sabe cómo llama este negocio a sus reuniones. */
const ROTULO_FIJO = { r1: 'Reunión 1', r2: 'Reunión 2' } as const;

/**
 * Los dos slots de reunión que la tabla `leads` sí tiene, aplanados.
 *
 * ⚠️ ES LA SEGUNDA MITAD DEL MAPEO de `SLOTS` (lib/funnel-etapas.ts), que nombra
 * las COLUMNAS (`fecha_junta_1`, `junta_1_at`). Acá hace falta la versión plana
 * porque `JourneyInput` no es una fila de `leads`: los tres call-sites la
 * aplanan antes de llamar. El día que `JourneyInput` reciba el lead entero, esto
 * se borra y se lee `slot.colFecha`.
 */
function datosDeSlot(i: JourneyInput, cual: 'r1' | 'r2'): { fecha: string | null; asistio: boolean | null } {
  // R1 cae a `fecha_agenda` cuando no hay `fecha_junta_1`: es el lead que agendó
  // por Calendly y todavía nadie pasó por la ficha. R2 no tiene equivalente.
  return cual === 'r1'
    ? { fecha: i.fechaJ1 || i.fechaAgenda, asistio: i.asistioJ1 }
    : { fecha: i.fechaJ2, asistio: i.asistioJ2 };
}

function meetingStep(key: string, label: string, date: string | null, asistio: boolean | null, hoyISO?: string | null): JourneyStep {
  if (asistio === true) return { key, label, sub: 'Asistió', date: fmt(date), state: 'done' };
  if (asistio === false) return { key, label, sub: 'No-show', date: fmt(date), state: 'failed' };
  // Sin asistencia marcada: si la reunión es futura, todavía no hay nada que
  // marcar ("Agendada"); si ya pasó (o no hay fecha), sí falta marcarla.
  const esFutura = !!date && !!hoyISO && date.slice(0, 10) >= hoyISO;
  return { key, label, sub: esFutura ? 'Agendada' : 'Agendada · falta marcar asistencia', date: fmt(date), state: 'upcoming' };
}

/**
 * Las reuniones del recorrido, en orden: las del embudo de ese lead si llegó, y
 * si no (o si ese embudo no declara ninguna) los dos rótulos de siempre.
 *
 * Que un embudo no tenga ninguna etapa `kind: 'reunion'` y el lead igual tenga
 * una fecha agendada es posible —se reconfiguró el funnel después—, y ahí
 * esconder la fecha sería perder un hecho medido por un cambio de configuración.
 */
function reunionesDelRecorrido(etapas?: readonly EtapaReunion[] | null): EtapaReunion[] {
  const lista = etapas ?? [];
  const claves = reunionesDe(lista);
  if (!claves.length) return [{ key: 'r1', label: ROTULO_FIJO.r1 }, { key: 'r2', label: ROTULO_FIJO.r2 }];
  return claves.map((k) => {
    const e = lista.find((s) => s.key === k);
    return { key: k, label: e?.label?.trim() || k };
  });
}

export function buildJourney(i: JourneyInput): JourneyStep[] {
  const steps: JourneyStep[] = [];
  steps.push({ key: 'form', label: 'Entró como lead', sub: 'Alta / formulario', date: fmt(i.createdISO), state: 'done' });

  const vistos = new Set<'r1' | 'r2'>();
  reunionesDelRecorrido(i.etapas).forEach((et, idx) => {
    const slot = slotPorIndice(idx);
    if (!slot) {
      // Tercera reunión en adelante: no hay columnas donde vivir. Se dibuja sólo
      // si el lead está ahí, y declara el hueco en vez de omitirlo.
      if (i.etapaActual && i.etapaActual === et.key) {
        steps.push({ key: `reu-${et.key}`, label: et.label, sub: 'Sin fecha registrada', date: null, state: 'pending' });
      }
      return;
    }
    vistos.add(slot.cual);
    const { fecha, asistio } = datosDeSlot(i, slot.cual);
    if (fecha || asistio != null) steps.push(meetingStep(slot.cual, et.label, fecha, asistio, i.hoyISO));
  });

  // Un slot CON DATO que el embudo de hoy no reclama se dibuja igual, con el
  // rótulo genérico: la fecha de esa reunión es un hecho que pasó, y un embudo
  // reconfigurado no puede borrarlo de la línea de tiempo.
  (['r1', 'r2'] as const).forEach((cual) => {
    if (vistos.has(cual)) return;
    const { fecha, asistio } = datosDeSlot(i, cual);
    if (fecha || asistio != null) steps.push(meetingStep(cual, ROTULO_FIJO[cual], fecha, asistio, i.hoyISO));
  });

  if (i.fechaConfirmacion) steps.push({ key: 'conf', label: 'Confirmó el cierre', date: fmt(i.fechaConfirmacion), state: 'done' });
  if (i.fechaPrimerPago) steps.push({ key: 'pago', label: 'Primer pago', date: fmt(i.fechaPrimerPago), state: 'done' });

  if (i.estadoLead === 'ganado') steps.push({ key: 'cierre', label: 'Cierre ganado', sub: i.monto > 0 ? '$' + i.monto.toLocaleString('en-US') : undefined, date: fmt(i.fechaCierre), state: 'done' });
  else if (i.estadoLead === 'perdido') steps.push({ key: 'cierre', label: 'Perdido', sub: 'Se trabajó y no compró', date: fmt(i.fechaCierre), state: 'lost' });
  else if (i.estadoLead === 'descalificado') steps.push({ key: 'cierre', label: 'Descalificado', sub: 'No era buen fit', date: fmt(i.fechaCierre), state: 'lost' });
  else steps.push({ key: 'open', label: 'En proceso', sub: 'Sigue abierto', date: null, state: 'upcoming' });

  return steps;
}
