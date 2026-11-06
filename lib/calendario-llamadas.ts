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
// pestañas, con test. Lo usan la computadora (app/calendario/ListaLlamadas.tsx) y el teléfono (app/m/calendario/LlamadasM.tsx).
// =============================================================================

import { fechaLarga, sumarDias } from './calendario-modelo';

export type CualReunion = 'R1' | 'R2';

/** «Hoy», «Mañana», «Ayer» o la fecha larga con mayúscula: lo primero que se lee en una agenda de ventas. */
export function rotuloDelDia(dia: string, hoy: string): string {
  if (dia === hoy) return 'Hoy';
  if (dia === sumarDias(hoy, 1)) return 'Mañana';
  if (dia === sumarDias(hoy, -1)) return 'Ayer';
  const f = fechaLarga(dia);
  return f.charAt(0).toUpperCase() + f.slice(1);
}

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
  /** El setter del lead (6/11/2026, las reuniones del equipo): una llamada es de su closer Y de su setter. */
  setter?: string | null;
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

/** El tono de la pastilla del teléfono (`PildoraM`) para cada estado: los colores de la computadora. */
export const TONO_ESTADO_LLAMADA: Readonly<Record<EstadoLlamada, 'info' | 'good' | 'bad' | 'warn' | 'neutro'>> = {
  agendada: 'info',
  asistio: 'good',
  'no-vino': 'bad',
  'sin-marcar': 'warn',
  cancelada: 'neutro',
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

// ── Las reuniones del EQUIPO (6/11/2026, la promesa a la agencia de Thiago: «gestionar las reuniones de tu equipo») ──────
// Al Calendario entraba sólo el admin. Desde ahora un closer o un setter entra a «Llamadas» y arranca en LAS SUYAS, y el
// admin filtra por persona. Una llamada es de una persona si es su closer o su setter (`leads.closer` / `leads.setter`
// guardan el NOMBRE, el del desplegable del equipo): se compara sin mayúsculas ni espacios de más, como el filtro
// `persona` de `listar_leads` (lib/api-mako/areas/crm.helpers.ts). Lo que un closer o un setter NO ve del Calendario —la
// agenda de Google del dueño, los cobros, los objetivos, el Plan— lo decide `quienMiraElCalendario`
// (lib/calendario-equipo-server.ts), no esta lista.

/** «Todas las personas»: el filtro apagado. */
export const PERSONA_TODAS = 'todas';
/** Las llamadas que no tienen closer ni setter. */
export const PERSONA_SIN_ASIGNAR = 'sin_asignar';

const persona = (s: string | null | undefined): string => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/** ¿Esta llamada es de esa persona (su closer o su setter)? `PERSONA_SIN_ASIGNAR` = la que no tiene ninguno. */
export function esDeLaPersona(l: Pick<LlamadaDeVenta, 'closer' | 'setter'>, quien: string): boolean {
  if (quien === PERSONA_SIN_ASIGNAR) return !persona(l.closer) && !persona(l.setter);
  const q = persona(quien);
  return !!q && (persona(l.closer) === q || persona(l.setter) === q);
}

/** Las llamadas del filtro: todas con `PERSONA_TODAS` (o vacío), si no las de esa persona. */
export function llamadasDeLaPersona<T extends Pick<LlamadaDeVenta, 'closer' | 'setter'>>(lista: readonly T[], quien: string | null | undefined): T[] {
  if (!quien || quien === PERSONA_TODAS) return [...lista];
  return lista.filter((l) => esDeLaPersona(l, quien));
}

/**
 * Las personas del filtro, con cuántas llamadas tiene cada una: las del equipo (aunque no tengan ninguna en la ventana) y las
 * que aparecen en las llamadas, sin repetir y en orden alfabético. Con el nombre como está escrito la primera vez.
 */
export function personasDeLlamadas(lista: readonly Pick<LlamadaDeVenta, 'closer' | 'setter'>[], equipo: readonly string[] = []): Array<{ nombre: string; llamadas: number }> {
  const por = new Map<string, { nombre: string; llamadas: number }>();
  const sumar = (n: string | null | undefined, cuenta: number) => {
    const k = persona(n);
    if (!k) return;
    const ya = por.get(k);
    if (ya) ya.llamadas += cuenta; else por.set(k, { nombre: (n ?? '').trim().replace(/\s+/g, ' '), llamadas: cuenta });
  };
  for (const n of equipo) sumar(n, 0);
  for (const l of lista) {
    sumar(l.closer, 1);
    if (persona(l.setter) !== persona(l.closer)) sumar(l.setter, 1);
  }
  return [...por.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** Lo que una persona ve del Calendario, según su rol en el negocio. */
export type MiradaCalendario = {
  /**
   * Un closer o un setter: sólo «Llamadas». Ni la grilla (la agenda de Google del dueño), ni los cobros, ni los objetivos,
   * ni las tareas del Plan: eso es del admin, como la pantalla de cada una.
   */
  soloLlamadas: boolean;
  /** Su nombre, para arrancar en SUS llamadas. null = el admin (arranca en todas). */
  personaPropia: string | null;
};

/** De su rol a lo que ve (puro: lo usan la computadora, el teléfono y el test). Un rol que no se pudo leer ve lo mínimo. */
export function miradaDeRol(rol: string | null | undefined, nombre: string | null | undefined): MiradaCalendario {
  if (rol === 'admin') return { soloLlamadas: false, personaPropia: null };
  return { soloLlamadas: true, personaPropia: (nombre ?? '').trim() || null };
}

/** A quién filtra la lista al abrir: lo que pide la URL (`?persona=`), y si no pide nada, la persona misma (o todas). */
export function personaDelFiltro(pedida: string | null | undefined, m: MiradaCalendario): string {
  const p = (pedida ?? '').trim();
  if (p) return p.slice(0, 120);
  return m.personaPropia ?? PERSONA_TODAS;
}
