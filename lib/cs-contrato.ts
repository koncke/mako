// =============================================================================
// cs-contrato — cuánto dura el programa DE ESTE cliente, según su contrato
// =============================================================================
// ⚠️ ESTO EXISTE PORQUE INVENTÉ UN NÚMERO. Puse «26 semanas» como constante del
// programa teniendo el dato real en la base: `leads.deal_servicio` guarda lo que
// dice el contrato firmado —«16 semanas», «3 meses», «12 a 14 sesiones»— con su
// fecha de inicio y su fecha de término. Una constante inventada es peor que un
// dato faltante: el faltante se ve, el inventado se cree.
//
// EL ORDEN DE LAS FUENTES, de la más fuerte a la más débil:
//   1. `deal_servicio.duracion` — lo que dice el contrato. Es la verdad.
//   2. `duracion_meses` — lo que alguien cargó a mano en la ficha.
//   3. nada. Se devuelve null y la pantalla dice «—», no un número.
//
// Lo mismo con el arranque: `deal_servicio.fecha_inicio` (del contrato) gana
// sobre `fecha_inicio_servicio` (cargado a mano, y sucio: hay una ficha que
// arranca cuatro meses ANTES de la venta) y sobre `fecha_cierre`.
//
// SIN `server-only`: es parseo de texto y tiene tests.

/** Lo que el contrato dice del servicio. Todo opcional: los contratos viejos
 *  tienen medio objeto en null y eso es un hecho, no un error. */
export type DealServicio = {
  que_es?: string | null;
  duracion?: string | null;
  sesiones?: string | null;
  modalidad?: string | null;
  frecuencia?: string | null;
  fecha_inicio?: string | null;
  fecha_termino?: string | null;
};

export type DealPromesa = {
  resultado?: string | null;
  garantia?: string | null;
};

export type Reloj = {
  /** Semana en la que va. Null si no se sabe cuándo arrancó. */
  semana: number | null;
  /** Cuántas dura, según su contrato. Null si el contrato no lo dice. */
  semanasTotales: number | null;
  /** De dónde salió el total, para poder mostrarlo y auditarlo. */
  fuente: 'contrato' | 'ficha' | null;
  /** Cuándo arrancó, y de dónde salió esa fecha. */
  arranque: string | null;
  fuenteArranque: 'contrato' | 'ficha' | 'cierre' | null;
  /** Ya pasó su fecha de término o su cantidad de semanas. */
  terminado: boolean;
};

const jsonb = <T,>(v: unknown): T | null => {
  if (!v) return null;
  if (typeof v === 'object') return v as T;
  if (typeof v === 'string') { try { return JSON.parse(v) as T; } catch { return null; } }
  return null;
};

/**
 * Cuántas semanas dura, leyendo el texto del contrato.
 *
 * Los contratos escriben la duración en castellano y de tres formas distintas:
 * «16 semanas», «3 meses», «12 a 14 sesiones». Las dos primeras son tiempo; la
 * tercera NO —una sesión semanal de 12 a 14 dura 12 a 14 semanas, pero eso es
 * una suposición, así que las sesiones no se convierten en semanas acá—.
 */
export function semanasDelTexto(txt: string | null | undefined): number | null {
  if (!txt) return null;
  const t = txt.toLowerCase();
  const num = (re: RegExp): number | null => {
    const m = t.match(re);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) && n > 0 && n < 500 ? n : null;
  };
  const semanas = num(/(\d+)\s*semana/);
  if (semanas) return semanas;
  const meses = num(/(\d+)\s*mes/);
  if (meses) return Math.round(meses * 4.345); // 52/12: un mes NO son 4 semanas
  return null;
}

const dias = (a: string | number, b: string | number) =>
  Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);

/**
 * El reloj del programa de un cliente. Devuelve null antes que inventar: una
 * pantalla que dice «—» es honesta; una que dice «semana 12 de 26» sobre un
 * número inventado le hace tomar decisiones sobre humo.
 */
export function relojDe(lead: {
  deal_servicio?: unknown;
  duracion_meses?: number | null;
  fecha_inicio_servicio?: string | null;
  fecha_cierre?: string | null;
}): Reloj {
  const ds = jsonb<DealServicio>(lead.deal_servicio);

  // ── Cuántas semanas dura ────────────────────────────────────────────────
  let semanasTotales = semanasDelTexto(ds?.duracion);
  let fuente: Reloj['fuente'] = semanasTotales ? 'contrato' : null;
  if (!semanasTotales && lead.duracion_meses) {
    semanasTotales = Math.round(lead.duracion_meses * 4.345);
    fuente = 'ficha';
  }

  // ── Cuándo arrancó ──────────────────────────────────────────────────────
  // El contrato gana. `fecha_inicio_servicio` se carga a mano y viene sucia —hay
  // una ficha que arranca cuatro meses antes del cierre—, así que cuando se cae
  // ahí se toma la MÁS RECIENTE entre ella y el cierre: una fecha de inicio
  // anterior a la venta es un dato mal cargado, no un cliente que empezó antes.
  let arranque: string | null = null;
  let fuenteArranque: Reloj['fuenteArranque'] = null;
  if (ds?.fecha_inicio) { arranque = ds.fecha_inicio; fuenteArranque = 'contrato'; }
  else {
    const cands = [lead.fecha_inicio_servicio, lead.fecha_cierre].filter(Boolean) as string[];
    if (cands.length) {
      arranque = cands.sort().at(-1)!;
      fuenteArranque = arranque === lead.fecha_inicio_servicio ? 'ficha' : 'cierre';
    }
  }

  const d = arranque ? dias(arranque, Date.now()) : null;
  const semana = d === null || d < 0 ? null : Math.max(1, Math.ceil((d + 1) / 7));

  // ── ¿Terminó? ───────────────────────────────────────────────────────────
  // La fecha de término del contrato manda sobre el cálculo por semanas.
  const terminado = ds?.fecha_termino
    ? dias(ds.fecha_termino, Date.now()) > 0
    : Boolean(semana && semanasTotales && semana > semanasTotales);

  return { semana, semanasTotales, fuente, arranque, fuenteArranque, terminado };
}

/** Lo que se le prometió, para tenerlo a mano antes de una sesión. */
export function promesaDe(lead: { deal_promesa?: unknown; deal_servicio?: unknown }): {
  resultado: string | null; garantia: string | null; queEs: string | null; sesiones: string | null;
} {
  const p = jsonb<DealPromesa>(lead.deal_promesa);
  const s = jsonb<DealServicio>(lead.deal_servicio);
  return {
    resultado: p?.resultado?.trim() || null,
    garantia: p?.garantia?.trim() || null,
    queEs: s?.que_es?.trim() || null,
    sesiones: s?.sesiones?.trim() || null,
  };
}
