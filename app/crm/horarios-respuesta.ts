// =============================================================================
// Cómo se LEE la respuesta de /api/crm/horarios (fuente única)
// =============================================================================
// Módulo puro: sin 'use client' ni 'server-only', para poder testearlo solo.
//
// El server nunca falla acá: un problema con Google vuelve como 200 con un
// `codigo` distinto de 'ok' y la grilla completa. Toda la inteligencia está en
// leer bien esa respuesta, y ahí es donde estaba el bug caro:
//
//  · el `motivo` se descartaba cuando el `codigo` era 'ok'. Pero 'ok' también
//    trae avisos que NO son errores — el principal: "ya pasaron todos los
//    horarios de hoy" con `slots: []`. Sin ese texto, la pantalla no decía nada.
//  · `slots: []` se leía como "no se sabe" y el selector dibujaba la jornada
//    entera 9:00–19:00 como disponible. El usuario elegía las 10:00 de un día
//    que ya había pasado, se guardaba `junta_N_at` en el pasado y el lead volvía
//    al worklist en el render siguiente, con la asistencia recién borrada.
//  · el `error` crudo del server ("No autorizado", un stack) se mostraba tal
//    cual: el mensaje más alarmante y menos accionable de todo el camino.
//
// La distinción que ordena todo: `null` = NO SE SABE (grilla completa, todo
// elegible), `[]` = ese día no tiene horarios (se dice, no se inventa grilla).
// =============================================================================

/** Un horario del día con su disponibilidad real, tal cual lo emite el server. */
export type SlotAgenda = { hora: string; inicioIso: string; libre: boolean };

/**
 * Los parámetros con los que se armó la grilla, ya acotados por el server.
 *
 * Viajan en la respuesta porque el cliente los NECESITA en el peor caso: con
 * `slots: null` (agenda no verificada) la UI dibuja su propia grilla, y si usara
 * otros números que el server mostraría un rango distinto según si Google
 * respondió o no. Todo en minutos desde la medianoche local: la jornada dejó de
 * ser "horas enteras" cuando el paso bajó a 15.
 */
export type RangoGrilla = {
  /** Primer horario ofrecible del día. */
  desdeMin: number;
  /** Último horario ofrecible, INCLUSIVE (es un inicio, no el fin de la reunión). */
  hastaMin: number;
  /** Cada cuántos minutos hay un horario. */
  pasoMin: number;
  /** Cuánto dura la reunión: define el solapamiento contra lo ocupado. */
  duracionMin: number;
  /** Cuánta anticipación mínima se exige sobre "ahora" cuando la fecha es hoy. */
  margenMin: number;
};

/** El JSON de GET /api/crm/horarios (todo opcional: viene de la red). */
export type RespuestaHorarios = {
  ok?: boolean;
  codigo?: string;
  motivo?: string;
  tz?: string;
  slots?: SlotAgenda[];
  rango?: Partial<RangoGrilla>;
  error?: string;
};

export type LecturaHorarios = {
  /** La grilla del día, o null cuando no se pudo saber (se cae a la de siempre). */
  slots: SlotAgenda[] | null;
  /** Zona en la que se leyeron los horarios ('' si no se sabe). */
  tz: string;
  /** Lo que se le muestra al usuario, ya en castellano ('' = nada que aclarar). */
  nota: string;
  /** El error crudo del server: va a la consola, NUNCA a la pantalla. */
  errorTecnico: string | null;
  /** Con qué números se armó (o se tiene que armar) la grilla. Nunca es null. */
  rango: RangoGrilla;
};

/** Lo que se dice cuando la agenda no se pudo leer. Nunca bloquea el paso. */
export const AVISO_SIN_AGENDA =
  'No pude leer tu agenda. Elegí la hora igual: el CRM se actualiza y queda en el historial.';

export function leerRespuestaHorarios(j: RespuestaHorarios | null | undefined): LecturaHorarios {
  // El rango se normaliza SIEMPRE, también en los caminos de error: es justo
  // cuando la UI tiene que dibujar la grilla por su cuenta y no puede quedarse
  // sin números (ni inventar unos distintos de los del server).
  const rango = normalizarRango(j?.rango);
  if (!j || !j.ok || !Array.isArray(j.slots)) {
    return { slots: null, tz: '', nota: AVISO_SIN_AGENDA, errorTecnico: j?.error ?? null, rango };
  }
  // Un código distinto de 'ok' significa que NO se pudo leer la agenda. El server
  // igual manda la grilla del día para que el paso sea usable, pero con todos los
  // slots en `libre: true` — o sea, indistinguible de "tenés el día entero libre".
  // Devolverla como grilla verificada era lo que hacía convivir el aviso de error
  // con un sub que prometía "los ocupados se ven tachados": el usuario leía que no
  // había nada tachado y agendaba encima de otra reunión. Sin verificar = null.
  if (j.codigo !== 'ok') {
    return { slots: null, tz: j.tz ?? '', nota: j.motivo || AVISO_SIN_AGENDA, errorTecnico: null, rango };
  }
  return {
    slots: j.slots,
    tz: j.tz ?? '',
    // El motivo viaja SIEMPRE, también con 'ok' (ej: "ya pasaron todos los horarios").
    nota: j.motivo || '',
    errorTecnico: null,
    rango,
  };
}

/**
 * Traduce el fallo de Google a una frase accionable en castellano.
 *
 * El caso que motivó esto salió en producción: la API de Calendar no estaba
 * habilitada en el proyecto de Google Cloud, y el párrafo de Google —con el id del
 * proyecto y un link a la consola de desarrolladores— se imprimió tal cual arriba
 * de la grilla de horarios. Un mensaje así no es un aviso: es ruido alarmante que
 * el usuario no puede accionar. Cada rama dice QUÉ pasó y QUÉ hacer, en una línea.
 */
export function motivoLegible(status: number, crudo: string): string {
  const t = (crudo || '').toLowerCase();
  // 403 accessNotConfigured / SERVICE_DISABLED: falta prender la API en Cloud.
  if (t.includes('has not been used in project') || t.includes('accessnotconfigured') || t.includes('service_disabled') || t.includes('is disabled')) {
    return 'Falta habilitar la API de Google Calendar en tu proyecto de Google Cloud. Mientras tanto elegí la hora a mano: el CRM se actualiza igual.';
  }
  if (status === 401) return 'Tu conexión con Google venció: reconectala desde Integraciones.';
  if (status === 429 || t.includes('rate limit') || t.includes('quota')) {
    return 'Google está limitando las consultas en este momento. Probá de nuevo en un rato o elegí la hora a mano.';
  }
  if (status >= 500) return 'Google no está respondiendo en este momento. Elegí la hora a mano: el CRM se actualiza igual.';
  return 'No pude leer tu agenda: los horarios de abajo no están verificados.';
}

// =============================================================================
// LA GRILLA — de qué horarios se compone un día (fuente ÚNICA)
// =============================================================================
// Esto vivía duplicado: las constantes y el bucle estaban en lib/google-calendar.ts
// (server-only) y otra vez en app/crm/SelectorHora.tsx (cliente), con un comentario
// admitiendo que "no se pueden compartir sin un tercer módulo puro". Este archivo ES
// ese módulo: no tiene 'use client' ni 'server-only', así que lo importan los dos —
// y además se puede testear sin levantar nada (tests/horarios-grilla.test.ts).
//
// Importa que sea uno solo justamente por el caso feo: cuando la agenda no se puede
// leer, el cliente arma la grilla por su cuenta. Con dos juegos de constantes, el
// usuario veía 9:00–19:00 si Google fallaba y 7:00–22:00 si respondía.
// =============================================================================

/**
 * LA JORNADA OFRECIBLE. El tope de las 19:00 lo rechazó el dueño de frente ("dame
 * todos los horarios disponibles, no solo hasta las 7 PM"), pero el otro extremo
 * tampoco sirve: una grilla de 00:00 a 23:45 son 96 opciones y ofrecer las 3 de la
 * mañana es ruido que hace inusable el desplegable.
 *
 * El criterio: 07:00–22:00 cubre el día entero de trabajo real —el que arranca
 * temprano, el que cierra de noche, y los husos vecinos, que es de donde salen las
 * llamadas raras— y deja afuera SOLO la franja donde no se agenda nunca. Lo que
 * recorta la lista de verdad no es este rango sino la agenda: los ocupados no se
 * muestran. Y si alguna vez hace falta una hora fuera de esto, el rango es
 * configurable por `opts` (y por query string en /api/crm/horarios).
 */
export const HORA_DESDE_DEFECTO = 7;
export const HORA_HASTA_DEFECTO = 22;

/**
 * El paso baja de 30 a 15 para que existan los cuartos de hora ("¿qué pasa si se
 * quiere agendar y cuarto?"). No cuesta un request más: freeBusy se pide UNA vez
 * por ventana, no por horario.
 */
export const PASO_MIN_DEFECTO = 15;

/** Cuánto dura una reunión si nadie lo dice. El mismo valor que usa el alta del evento. */
export const DURACION_DEFECTO_MIN = 45;

/**
 * ANTICIPACIÓN MÍNIMA sobre "ahora" para los horarios de HOY. Sin esto, a las 10:14
 * la grilla ofrece las 10:15: técnicamente futuro, en la práctica una reunión "en un
 * minuto" que nadie puede atender ni avisarle al lead.
 *
 * OJO con la otra lectura del pedido ("también tienes que sumar 1 hora en adelante"):
 * la frase que sigue —"¿qué pasa si agendo 6:30 PM y había una reunión a las 7 PM?"—
 * aclara que habla del LARGO DE LA REUNIÓN pisando lo que viene después, no de la
 * anticipación. Eso es `duracionMin` y se resuelve en marcarOcupados(). Son dos cosas
 * distintas y se configuran por separado.
 */
export const MARGEN_MIN_DEFECTO = 30;

/** Un intervalo ocupado de la agenda, ya parseado a milisegundos absolutos. */
export type Ocupado = { ini: number; fin: number };

const MIN_POR_DIA = 24 * 60;

/**
 * Hora local → minutos desde medianoche. Admite fracciones (8.5 = 8:30): la jornada
 * dejó de ser "horas enteras" cuando el paso bajó a 15 y un `Math.trunc` acá haría
 * imposible arrancar la grilla a y media.
 */
export const horaAMinutos = (hora: number): number =>
  Math.min(MIN_POR_DIA - 1, Math.max(0, Math.round((Number.isFinite(hora) ? hora : 0) * 60)));

/** Entero acotado con default cuando el valor no es un número usable. */
const acotar = (v: unknown, min: number, max: number, def: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : def;
};

/**
 * Acota los parámetros de la grilla. Un `hastaMin` de 99 horas o un paso de 0
 * generarían una grilla infinita y el request moriría por timeout en vez de devolver
 * algo usable; un `margenMin` gigante dejaría el día de hoy sin un solo horario.
 *
 * Todo entra en MINUTOS. Quien tenga horas (las opciones del server, el query
 * string) las convierte antes con horaAMinutos().
 */
export function normalizarRango(o?: Partial<RangoGrilla> | null): RangoGrilla {
  const desdeMin = acotar(o?.desdeMin, 0, MIN_POR_DIA - 1, HORA_DESDE_DEFECTO * 60);
  const hastaMin = acotar(o?.hastaMin, 0, MIN_POR_DIA - 1, HORA_HASTA_DEFECTO * 60);
  return {
    desdeMin,
    // Un `hasta` por debajo del `desde` no vacía la grilla: deja exactamente un
    // horario. Devolver [] acá sería indistinguible de "ese día no tiene horarios".
    hastaMin: Math.max(desdeMin, hastaMin),
    pasoMin: acotar(o?.pasoMin, 5, 180, PASO_MIN_DEFECTO),
    duracionMin: acotar(o?.duracionMin, 5, 480, DURACION_DEFECTO_MIN),
    // 0 es un margen legítimo (los tests, o agendar para ya): tiene que sobrevivir
    // a la normalización en vez de caer al default.
    margenMin: acotar(o?.margenMin, 0, MIN_POR_DIA, MARGEN_MIN_DEFECTO),
  };
}

/**
 * Formateadores por zona, cacheados a nivel de módulo.
 *
 * `new Intl.DateTimeFormat(...)` es lo caro de todo esto (carga los datos de la
 * zona), no el `formatToParts`. Con el rango de 07:00–22:00 cada 15' la grilla
 * tiene 61 slots e `instanteDeLocal` hace DOS pasadas por slot: eran 122
 * constructores por request, ~15-25 ms que se van enteros acá. Reusando el
 * formateador baja a ~3 ms. El Map no crece: hay una entrada por zona horaria.
 */
const FMT_TZ = new Map<string, Intl.DateTimeFormat>();
function fmtDeTz(tz: string): Intl.DateTimeFormat {
  let f = FMT_TZ.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
    FMT_TZ.set(tz, f);
  }
  return f;
}

/**
 * Cuánto está corrida `tz` respecto de UTC en ESE instante (ms). Se calcula
 * formateando el instante en la zona y volviendo a leer las partes como si fueran
 * UTC: la diferencia es el offset real, con DST incluido.
 */
function offsetTzMs(tz: string, tsUtc: number): number {
  const p = fmtDeTz(tz).formatToParts(new Date(tsUtc));
  const g = (t: string): number => Number(p.find((x) => x.type === t)?.value);
  // Algunos runtimes devuelven "24" en vez de "00" a medianoche con hour12:false.
  const h = g('hour') % 24;
  return Date.UTC(g('year'), g('month') - 1, g('day'), h, g('minute'), g('second')) - tsUtc;
}

/**
 * Día local ('YYYY-MM-DD') + minutos desde medianoche + zona → instante UTC.
 * Es el INVERSO de fechaHoraEnTz (lib/date-utils); el único precedente en el repo
 * era un offset fijo -6 en lib/nutricion.ts, que ignora DST y por eso NO se copia.
 *
 * Dos pasadas: la primera estima el offset del día suponiendo la hora en UTC, y la
 * segunda lo recalcula ya parado en el instante estimado. Sin eso, el día del cambio
 * de horario queda corrido una hora.
 *
 * Las dos horas patológicas del cambio de horario están cubiertas sin caso especial:
 * la que NO existe (2:00 el día que adelanta) cae en la hora real más cercana y la
 * que se repite toma la primera vuelta. Con la jornada por defecto (07:00–22:00)
 * ninguna de las dos entra en la grilla, y en cualquier caso el instante devuelto
 * existe. Ojo si alguien baja `desdeHora` a la madrugada: dos slots consecutivos
 * pueden caer en el mismo instante ese día puntual. No rompe nada (el de arriba se
 * marca ocupado junto con el de abajo), pero es la única rareza posible.
 */
export function instanteDeLocal(fechaISO: string, minutosDelDia: number, tz: string): string | null {
  const [y, m, d] = fechaISO.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  try {
    const local = Date.UTC(y, m - 1, d) + minutosDelDia * 60_000;
    let ts = local - offsetTzMs(tz, local);
    ts = local - offsetTzMs(tz, ts);
    return Number.isFinite(ts) ? new Date(ts).toISOString() : null;
  } catch {
    return null;
  }
}

/** Minutos desde medianoche → 'HH:MM'. */
export const hhmm = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Igual que esFechaValida de lib/date-utils, pero sin arrastrar ese módulo hasta acá. */
export function esDiaValido(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * La grilla del día ENTERA, todo en `libre: true`. Todavía no sabe nada de la
 * agenda: se arma antes de hablar con Google porque es también la respuesta de
 * todos los caminos de error.
 */
export function construirGrilla(fechaISO: string, tz: string, r: RangoGrilla): SlotAgenda[] {
  const out: SlotAgenda[] = [];
  if (!esDiaValido(fechaISO)) return out;
  for (let min = r.desdeMin; min <= r.hastaMin; min += r.pasoMin) {
    const inicioIso = instanteDeLocal(fechaISO, min, tz);
    if (!inicioIso) continue;
    out.push({ hora: hhmm(min), inicioIso, libre: true });
  }
  return out;
}

/**
 * Saca los horarios que ya pasaron y los que están DEMASIADO cerca de ahora.
 *
 * Se van de la grilla en vez de marcarse ocupados: "ocupado" significa "hay otra
 * cosa ahí", que es distinto de "ese momento ya no existe". Con `margenMin` en 0 el
 * corte es el de siempre (estrictamente futuro).
 */
export function filtrarPasados(slots: SlotAgenda[], ahoraMs: number, margenMin: number): SlotAgenda[] {
  const corte = ahoraMs + Math.max(0, margenMin) * 60_000;
  return slots.filter((s) => {
    const t = Date.parse(s.inicioIso);
    return Number.isFinite(t) && t >= corte;
  });
}

/**
 * Cruza la grilla contra lo ocupado. EL HUECO SIRVE SOLO SI LA REUNIÓN ENTRA ENTERA:
 * es el caso que preguntó el dueño —18:30 con algo a las 19:00 y una reunión de 45'
 * está OCUPADO, aunque a las 18:30 no haya nada—. Dos intervalos se pisan si uno
 * empieza antes de que el otro termine y termina después de que el otro empieza.
 *
 * No se filtra nada acá: el dato honesto viaja entero (todos los slots con su flag) y
 * es la UI la que decide esconder los ocupados. Así se puede decir "3 horarios
 * ocupados no se muestran" en vez de mentir por omisión.
 */
export function marcarOcupados(slots: SlotAgenda[], ocupados: Ocupado[], duracionMin: number): SlotAgenda[] {
  const duracionMs = Math.max(1, duracionMin) * 60_000;
  return slots.map((s) => {
    const ini = Date.parse(s.inicioIso);
    if (!Number.isFinite(ini)) return { ...s, libre: false };
    const fin = ini + duracionMs;
    return { ...s, libre: !ocupados.some((b) => b.ini < fin && b.fin > ini) };
  });
}
