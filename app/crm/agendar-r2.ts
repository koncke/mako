// =============================================================================
// agendar-r2 — los huecos de Calendly, agrupados por día en la zona del negocio
// =============================================================================
// Lo que hace falta para que la ficha del lead pueda reservar la R2 sin salir,
// y nada más: las dos piezas caras (`huecosDisponibles` y `reservarReunion`) ya
// viven en lib/calendly-agenda.ts.
//
// Vive SIN directiva a propósito: lo importan el componente de cliente
// (lead-view/AgendarR2.tsx) y la server action (agendar-r2-actions.ts). Si esto
// viviera adentro del componente, la acción no podría agrupar; si viviera en la
// acción, el cliente no podría resolver una hora elegida sin un viaje más.
//
// ── LAS DOS TRAMPAS QUE ESTE MÓDULO EXISTE PARA TAPAR ────────────────────────
//
// 1. UN HUECO NO VIVE EN UN DÍA: vive en un INSTANTE. Calendly devuelve ISO en
//    UTC, y agrupar por los primeros 10 caracteres de ese ISO pone las 20:00 del
//    lunes en Tijuana (03:00 UTC del martes) debajo del MARTES. La persona elige
//    «martes» y reserva el lunes a la noche. El día y la hora salen siempre de
//    `Intl` con la zona del negocio, nunca de recortar el string.
//
// 2. EL `startIso` NO SE RECONSTRUYE NUNCA. Calendly exige el instante exacto que
//    él devolvió (ver la nota 2 del encabezado de lib/calendly-agenda.ts): no hay
//    redondeo ni «el más cercano». Así que de una hora elegida no se arma un ISO
//    — se BUSCA el hueco que la tiene, y si no está, se devuelve null y no se
//    reserva nada. Es la misma regla que gobierna al doer de WhatsApp: un dato
//    exacto no lo transporta nadie que pueda reescribirlo.
// =============================================================================

/** Lo único que se necesita de un hueco de Calendly (`HuecoCalendly`). */
export type HuecoR2 = { startIso: string };

/** Una hora ofrecible y el instante EXACTO que Calendly acepta para ella. */
export type HoraDeHueco = {
  /** "HH:MM" en la zona del negocio: lo que lee una persona. */
  hora: string;
  /** El `start_time` tal cual lo devolvió Calendly. Nunca se reescribe. */
  startIso: string;
};

/** Un día del calendario del negocio con sus horas libres, ya ordenadas. */
export type DiaConHuecos = {
  /** "YYYY-MM-DD" en la zona del negocio. */
  dia: string;
  horas: HoraDeHueco[];
};

/**
 * El formateador de la zona del negocio.
 *
 * `en-CA` da la fecha en ISO (`2026-10-06`) y `h23` evita el `24:00` que algunos
 * motores devuelven para la medianoche con `hour12: false`. Si la zona no existe,
 * `Intl` tira `RangeError` y lo dejamos subir: una zona inválida tiene que doler
 * acá, no convertirse en horas de otro huso dibujadas como si fueran las buenas.
 */
function formateador(tz: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
}

function partes(fmt: Intl.DateTimeFormat, iso: string): { dia: string; hora: string } | null {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  const p = fmt.formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) => p.find((x) => x.type === t)?.value ?? '';
  const [y, m, dd, hh, mm] = [get('year'), get('month'), get('day'), get('hour'), get('minute')];
  if (!y || !m || !dd || !hh || !mm) return null;
  return { dia: `${y}-${m}-${dd}`, hora: `${hh}:${mm}` };
}

/**
 * Los huecos de Calendly agrupados por día del calendario DEL NEGOCIO.
 *
 * Un ISO ilegible se saltea en vez de tirar la lista entera: que Calendly mande
 * una fila rara no puede dejar sin agendar las otras cuarenta.
 */
export function agruparHuecos(huecos: readonly HuecoR2[], tz: string): DiaConHuecos[] {
  const fmt = formateador(tz);
  const porDia = new Map<string, HoraDeHueco[]>();
  for (const h of huecos) {
    const p = partes(fmt, h.startIso);
    if (!p) continue;
    const lista = porDia.get(p.dia) ?? [];
    // Dos instantes distintos que caen en la MISMA hora legible (los segundos no
    // se dibujan) serían dos filas idénticas en la lista, y elegir una sería
    // elegir al azar cuál se reserva. Se conserva la primera.
    if (!lista.some((x) => x.hora === p.hora)) lista.push({ hora: p.hora, startIso: h.startIso });
    porDia.set(p.dia, lista);
  }
  return [...porDia.entries()]
    .map(([dia, horas]) => ({ dia, horas: [...horas].sort((a, b) => a.hora.localeCompare(b.hora)) }))
    .sort((a, b) => a.dia.localeCompare(b.dia));
}

/**
 * El `startIso` EXACTO de la hora elegida, o null si esa hora no es un hueco.
 *
 * El null es la mitad importante: el selector de horarios acepta texto libre (se
 * puede tipear «6 y cuarto»), y una hora tipeada que Calendly no ofreció NO se
 * puede reservar. Devolver null es lo que apaga el botón; inventar un ISO sería
 * un 400 de Calendly con cara de bug nuestro.
 */
export function startIsoDe(dias: readonly DiaConHuecos[], dia: string, hora: string): string | null {
  const d = dias.find((x) => x.dia === dia);
  return d?.horas.find((h) => h.hora === hora)?.startIso ?? null;
}

/**
 * Las horas de un día en la forma que dibuja `SelectorHora` (`SlotHora[]`).
 *
 * Todas van `libre: true` porque Calendly ya devolvió SOLO las disponibles. Un
 * array vacío significa «ese día no tiene ninguna», que es un dato; `null` sería
 * «no se pudo verificar» y haría que el selector ofrezca el día entero — o sea,
 * horarios que Calendly va a rechazar.
 */
export function slotsDelDia(dias: readonly DiaConHuecos[], dia: string): { hora: string; libre: boolean }[] {
  const d = dias.find((x) => x.dia === dia);
  return (d?.horas ?? []).map((h) => ({ hora: h.hora, libre: true }));
}

/**
 * "2026-10-06" → "lun 6 oct".
 *
 * ⚠️ Se formatea en UTC sobre el MEDIODÍA, y no es un detalle: `new Date('2026-10-06')`
 * es la medianoche UTC, así que pintarla en la zona del negocio (UTC-7) la corre al
 * 5 de octubre y el chip del lunes dice «domingo». El día ya viene resuelto en la
 * zona correcta por `agruparHuecos`; acá sólo se le pone nombre.
 */
export function labelDeDia(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return dia;
  const p = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short',
  }).formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) => (p.find((x) => x.type === t)?.value ?? '').replace('.', '');
  return `${get('weekday')} ${get('day')} ${get('month')}`;
}

/**
 * ¿Este negocio puede agendar la R2 desde la ficha?
 *
 * Son dos preguntas y las dos tienen que dar sí:
 *  · Calendly CONECTADO — lo contesta `integracionConectada('calendly')`, que es
 *    la función con la que el repo pregunta eso en todas partes. No se escribe
 *    acá una condición propia sobre los campos: el día que Calendly pida un campo
 *    más, esa condición se queda vieja y el botón se dibuja igual.
 *  · el EVENT TYPE DE LA R2 cargado — y éste hay que preguntarlo aparte porque es
 *    `opcional: true` en el catálogo (lib/metodo-catalogo.ts), así que un negocio
 *    «conectado» puede no tenerlo. Sin él, `eventTypeDeReunion('R2')` tira y el
 *    botón contestaría con un error de configuración, que se lee como que la app
 *    está rota.
 */
export function puedeAgendarR2(p: { calendlyConectada: boolean; eventTypeR2: string | null | undefined }): boolean {
  return p.calendlyConectada && !!p.eventTypeR2?.trim();
}
