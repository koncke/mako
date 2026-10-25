// =============================================================================
// calendario-llamadas — «Llamadas» del Calendario: las reuniones de venta del CRM como una lista (24/10/2026), lo puro
// =============================================================================
// La llamada con Leandro (24/10, f07): «Ese calendario todavía no está listo para feedback mío (...) ahora se ve muy como
// calendario de Google (...) lo tengo que personalizar un poco», y que ponga lo que ya existe en MaKo: las llamadas de
// ventas y las tareas del Plan con deadline. COPIADO DEL «Appointment List View» de HighLevel (help.gohighlevel.com,
// artículo 155000003447, mirado el 24/10): al lado de la grilla, una vista de LISTA con las citas de venta, sus pestañas
// (Próximas, Canceladas…), el contacto y su ESTADO (Confirmada, Asistió, No vino). La entrada, como el «Calendario |
// Tareas» de arriba a la derecha de Google Calendar.
//
// Los datos salen del CRM, como la capa «Llamadas» de la grilla (lib/calendario.ts, `leerLlamadasDeVenta`): la R1 y la R2
// de cada lead con su hora (`junta_X_at`) o sólo su día (`fecha_junta_X`), y la asistencia (`asistio_jX`). Una reunión
// CANCELADA conserva su hora y pierde la fecha (docs/hallazgos-calendario.md). Acá, sin base ni red: el estado y las
// pestañas, con test.
// =============================================================================

export type CualReunion = 'R1' | 'R2';

export type LlamadaDeVenta = {
  /** `crm:<lead>:R1`: el mismo id que la capa «Llamadas» de la grilla. */
  id: string;
  leadId: number;
  nombre: string;
  cual: CualReunion;
  /** El instante del inicio; con `diaCompleto`, el comienzo del día del negocio. */
  inicio: string;
  /** Sólo el día (la reunión no tiene hora cargada). */
  diaCompleto: boolean;
  closer: string | null;
  /** true asistió, false no vino, null sin marcar. */
  asistio: boolean | null;
  /** Conserva la hora y perdió la fecha. */
  cancelada: boolean;
  /** El calificado del lead: marcar que no vino a la R1 (o desmarcarla) lo borra, y se le dice antes. */
  calificado?: boolean | null;
};

export type EstadoLlamada = 'agendada' | 'asistio' | 'no-vino' | 'sin-marcar' | 'cancelada';

export const TEXTO_ESTADO_LLAMADA: Readonly<Record<EstadoLlamada, string>> = {
  agendada: 'Agendada',
  asistio: 'Asistió',
  'no-vino': 'No vino',
  'sin-marcar': 'Sin marcar',
  cancelada: 'Cancelada',
};

export const PESTANAS_LLAMADAS = [
  { id: 'proximas', nombre: 'Próximas' },
  { id: 'pasadas', nombre: 'Pasadas' },
  { id: 'canceladas', nombre: 'Canceladas' },
] as const;
export type PestanaLlamadas = (typeof PESTANAS_LLAMADAS)[number]['id'];
export const esPestanaLlamadas = (x: unknown): x is PestanaLlamadas => PESTANAS_LLAMADAS.some((p) => p.id === x);

/** Cuántos días hacia atrás y hacia adelante lee la lista (la grilla lee la vista; la lista, una ventana fija). */
export const DIAS_ATRAS_LLAMADAS = 60;
export const DIAS_ADELANTE_LLAMADAS = 120;

const DIA_MS = 86_400_000;

/** Cuándo terminó (o termina) la reunión, para decidir si ya pasó: con sólo el día, el día entero. */
const finDe = (l: Pick<LlamadaDeVenta, 'inicio' | 'diaCompleto'>): number => Date.parse(l.inicio) + (l.diaCompleto ? DIA_MS : 0);

/** En qué va una reunión. Lo marcado gana sobre la hora: una que asistió es «Asistió» aunque sea de hoy. */
export function estadoDeLlamada(l: Pick<LlamadaDeVenta, 'inicio' | 'diaCompleto' | 'asistio' | 'cancelada'>, ahoraIso: string): EstadoLlamada {
  if (l.cancelada) return 'cancelada';
  if (l.asistio === true) return 'asistio';
  if (l.asistio === false) return 'no-vino';
  return finDe(l) > Date.parse(ahoraIso) ? 'agendada' : 'sin-marcar';
}

/** Lo de una pestaña, en el orden en que se trabaja: las próximas de la más cercana a la más lejana; lo pasado, al revés. */
export function llamadasDeLaPestana(lista: readonly LlamadaDeVenta[], pestana: PestanaLlamadas, ahoraIso: string): LlamadaDeVenta[] {
  const ahora = Date.parse(ahoraIso);
  const asc = (a: LlamadaDeVenta, b: LlamadaDeVenta) => Date.parse(a.inicio) - Date.parse(b.inicio) || a.id.localeCompare(b.id);
  if (pestana === 'canceladas') return lista.filter((l) => l.cancelada).sort((a, b) => asc(b, a));
  const vivas = lista.filter((l) => !l.cancelada);
  return pestana === 'proximas'
    ? vivas.filter((l) => finDe(l) > ahora).sort(asc)
    : vivas.filter((l) => finDe(l) <= ahora).sort((a, b) => asc(b, a));
}

// ── Marcar la asistencia desde la lista (25/10/2026: el «Status» de HighLevel es un desplegable en la fila) ───────────
// Escribe por el MISMO camino que la ficha del lead (`guardarCampoLeadAction` con `asistio_j1`/`asistio_j2`): la etapa
// derivada, el historial, el «Deshacer» y lo que se le manda a Meta salen de ahí, no de acá.

/** Sólo una reunión que no se canceló y que ya empezó: marcar que «asistió» a una de la semana que viene no es un dato. */
export const sePuedeMarcar = (l: Pick<LlamadaDeVenta, 'inicio' | 'cancelada'>, ahoraIso: string): boolean =>
  !l.cancelada && Date.parse(l.inicio) <= Date.parse(ahoraIso);

export const campoDeAsistencia = (cual: CualReunion): 'asistio_j1' | 'asistio_j2' => (cual === 'R2' ? 'asistio_j2' : 'asistio_j1');

/**
 * Lo que hay que decir ANTES de marcar: en la R1, todo lo que no sea «asistió» borra el calificado del lead (`updateLead`:
 * `asistio_j1 !== true` → calificado = null), y eso se le resta a Meta. null = nada que avisar.
 */
export function avisoAlMarcar(l: Pick<LlamadaDeVenta, 'cual' | 'calificado'>, asistio: boolean | null): string | null {
  if (l.cual !== 'R1' || asistio === true || l.calificado == null) return null;
  return `Tenía cargado «${l.calificado ? 'calificado' : 'no calificado'}». Si no asistió a la R1, ese dato se borra.`;
}

/** Cuántas hay en cada pestaña (el número al lado de su nombre). */
export function cuentaPorPestana(lista: readonly LlamadaDeVenta[], ahoraIso: string): Record<PestanaLlamadas, number> {
  return {
    proximas: llamadasDeLaPestana(lista, 'proximas', ahoraIso).length,
    pasadas: llamadasDeLaPestana(lista, 'pasadas', ahoraIso).length,
    canceladas: llamadasDeLaPestana(lista, 'canceladas', ahoraIso).length,
  };
}
