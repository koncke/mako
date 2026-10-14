// =============================================================================
// calendario-modelo — el Calendario de MaKo: qué se ve, cómo se arma una semana y qué se puede crear
// =============================================================================
// Pedido de Martín (punto 14 de su feedback; y el 13/10/2026: «Dale, arrancá con el Calendario, pero que sea en
// otra tab, no en GENERAL»), textual: «debería ser "CALENDARIO" y listo... puede utilizarse para planificar
// publicaciones de Stories, Reels, Ads... organizar llamadas de ventas, de entrega de servicio... poner "bloques de
// trabajo" para crear guiones o lo que necesite el usuario... Se puede combinar con lo que queremos implementar de
// "OBJETIVOS", el Q, el PLAN... que sea simple de usar, que sirva para todos los casos, que tenga IA que te ayude o
// "templates" y que no sea restrictivo».
//
// UNA PANTALLA, CINCO CAPAS (`CAPAS_CALENDARIO`), cada una con su color y su interruptor:
//   · Publicaciones — lo que la persona planea publicar (Story, Reel, Post, Anuncio, Email, Video). Propio.
//   · Llamadas      — las reuniones del CRM (R1/R2 con su hora, de Calendly/Cal.com), la agenda de Google y las
//                     llamadas sueltas que se agendan acá.
//   · Bloques       — bloques de trabajo («Escribir guiones», «Grabar») y lo demás que se agenda acá.
//   · Plan          — los deadlines de las tareas y los proyectos del tablero.
//   · Objetivos     — dónde empieza y termina el Quarter, y los objetivos que cierran con él.
//
// ⚠️ SÓLO LO PROPIO SE GUARDA ACÁ (`calendario_eventos`, mig 0271). El CRM, Google, el Plan y el Q se LEEN de donde
//    viven (lib/calendario.ts): una copia sería la segunda verdad, y la que se queda vieja.
// ⚠️ UNA HORA DE PARED NO ES UN INSTANTE. Lo que la persona escribe («el martes a las 10») se convierte con la zona
//    del NEGOCIO y en DOS pasadas (`instanteDe`, lib/cron-aviso.ts), por el salto de horario de verano.
// ⚠️ LA AGENDA NO PASA POR LA IA (decisión de Martín del 07/10/2026). La IA de «¿Qué vas a crear hoy?» ve el pedido
//    y las fechas de la semana; nunca un evento de Google ni una reunión del CRM. Lo que propone vuelve a la persona,
//    que lo mira y lo confirma: un canal propone, una persona confirma.
//
// Puro, sin `server-only`: lo importan la pantalla, el server, la ruta de la IA y el test.
// =============================================================================

import { instanteDe } from './cron-aviso';
import { hoyEnTz } from './date-utils';
import type { EventoGoogle } from './calendario-google-modelo';

export const TIPOS_EVENTO = ['publicacion', 'bloque', 'llamada', 'otro'] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];
export const FORMATOS_PUBLICACION = ['story', 'reel', 'post', 'ad', 'email', 'video', 'otro'] as const;
export type FormatoPublicacion = (typeof FORMATOS_PUBLICACION)[number];

export const ROTULO_TIPO: Record<TipoEvento, string> = { publicacion: 'Publicación', bloque: 'Bloque de trabajo', llamada: 'Llamada', otro: 'Otro' };
export const ROTULO_FORMATO: Record<FormatoPublicacion, string> = { story: 'Story', reel: 'Reel', post: 'Post', ad: 'Anuncio', email: 'Email', video: 'Video', otro: 'Otro' };

export const esTipoEvento = (x: unknown): x is TipoEvento => typeof x === 'string' && (TIPOS_EVENTO as readonly string[]).includes(x);
export const esFormato = (x: unknown): x is FormatoPublicacion => typeof x === 'string' && (FORMATOS_PUBLICACION as readonly string[]).includes(x);

/** Las capas del calendario: el filtro y la leyenda. El color es un token de la casa (se da vuelta en oscuro). */
export const CAPAS_CALENDARIO = [
  { id: 'publicaciones', nombre: 'Publicaciones', color: 'var(--accent)' },
  { id: 'llamadas', nombre: 'Llamadas', color: 'var(--primary)' },
  { id: 'bloques', nombre: 'Bloques', color: 'var(--good)' },
  { id: 'plan', nombre: 'Plan', color: 'var(--warn-fill)' },
  { id: 'objetivos', nombre: 'Objetivos', color: 'var(--ink)' },
] as const;
export type CapaCalendario = (typeof CAPAS_CALENDARIO)[number]['id'];
export const colorDeCapa = (c: CapaCalendario): string => CAPAS_CALENDARIO.find((x) => x.id === c)!.color;

/** De qué capa es un evento propio. Una llamada propia va con las llamadas; un «otro», con los bloques. */
export const capaDeTipo = (t: TipoEvento): CapaCalendario => (t === 'publicacion' ? 'publicaciones' : t === 'llamada' ? 'llamadas' : 'bloques');

/** De dónde salió un renglón del calendario. Sólo `propio` se edita desde acá. */
export type FuenteCalendario = 'propio' | 'crm' | 'google' | 'plan' | 'objetivo';

/** Un renglón del calendario, venga de donde venga. */
export type ItemCalendario = {
  id: string;
  fuente: FuenteCalendario;
  capa: CapaCalendario;
  titulo: string;
  /** El instante (ISO). Un día completo va al inicio de su día en la zona del negocio. */
  inicio: string;
  fin: string | null;
  diaCompleto: boolean;
  /** A dónde lleva (la ficha del lead, la tarea del Plan, /general). null = no lleva a ningún lado. */
  href: string | null;
  /** Lo de debajo del título, corto («R1 · closer Ana», «Reel»). */
  detalle?: string | null;
  /** Sólo los propios. */
  tipo?: TipoEvento;
  formato?: FormatoPublicacion | null;
  notas?: string;
  hecho?: boolean;
  /**
   * Sólo los de Google (14/10/2026, la copia fiel de Google Calendar): el evento tal como lo dibuja Google —su color,
   * su calendario, la ubicación, la videollamada— y si se puede mover desde acá.
   */
  google?: EventoGoogle;
};

/** Un evento propio, como está en la base. */
export type FilaEvento = {
  id: string;
  tipo: TipoEvento;
  formato: FormatoPublicacion | null;
  titulo: string;
  notas: string;
  inicio: string;
  fin: string | null;
  dia_completo: boolean;
  estado: 'planeado' | 'hecho';
};

/** El renglón de un evento propio. */
export function itemDeFila(f: FilaEvento): ItemCalendario {
  return {
    id: `propio:${f.id}`, fuente: 'propio', capa: capaDeTipo(f.tipo), titulo: f.titulo || ROTULO_TIPO[f.tipo],
    inicio: f.inicio, fin: f.fin, diaCompleto: f.dia_completo, href: null,
    detalle: f.tipo === 'publicacion' && f.formato ? ROTULO_FORMATO[f.formato] : null,
    tipo: f.tipo, formato: f.formato, notas: f.notas, hecho: f.estado === 'hecho',
  };
}

// ── Lo que se escribe ─────────────────────────────────────────────────────────────────────────

/** Lo que manda la pantalla (o la API, o una plantilla) para crear o cambiar un evento. */
export type EntradaEvento = {
  titulo: string;
  tipo: TipoEvento;
  formato?: FormatoPublicacion | null;
  /** 'YYYY-MM-DD' en la zona del negocio. */
  fecha: string;
  /** 'HH:MM' en la zona del negocio. null = día completo. */
  hora?: string | null;
  /** Cuánto dura (minutos). null = sin fin. */
  duracionMin?: number | null;
  notas?: string;
};

export const TOPE_TITULO = 160;
export const TOPE_NOTAS = 4000;
/** Un tope de cordura para un lote (una plantilla o lo que propone MaKo). */
export const MAX_LOTE = 40;
const MAX_DURACION_MIN = 24 * 60;

const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type FilaNueva = Omit<FilaEvento, 'id' | 'estado'>;

/**
 * La entrada, validada y convertida a instantes con la zona del negocio. ⚠️ En un texto que escribe una PERSONA el
 * tope RECHAZA, no recorta (AGENTS.md): un título de 161 caracteres es un error, no un título cortado en silencio.
 */
export function filaDeEntrada(e: EntradaEvento, tz: string): { ok: true; fila: FilaNueva } | { ok: false; error: string } {
  const titulo = (e.titulo ?? '').replace(/\s+/g, ' ').trim();
  if (!titulo) return { ok: false, error: 'Ponle un título.' };
  if (titulo.length > TOPE_TITULO) return { ok: false, error: `El título tiene más de ${TOPE_TITULO} caracteres.` };
  const notas = (e.notas ?? '').trim();
  if (notas.length > TOPE_NOTAS) return { ok: false, error: `Las notas tienen más de ${TOPE_NOTAS} caracteres.` };
  if (!esTipoEvento(e.tipo)) return { ok: false, error: 'Ese tipo de evento no existe.' };
  const formato = e.tipo === 'publicacion' ? (esFormato(e.formato) ? e.formato : 'post') : null;
  const f = RE_FECHA.exec(e.fecha ?? '');
  if (!f) return { ok: false, error: 'La fecha no es válida.' };
  const [y, m, d] = [Number(f[1]), Number(f[2]), Number(f[3])];
  if (m < 1 || m > 12 || d < 1 || d > new Date(Date.UTC(y, m, 0)).getUTCDate()) return { ok: false, error: 'La fecha no es válida.' };
  const hora = e.hora == null || e.hora === '' ? null : RE_HORA.exec(e.hora);
  if (e.hora && !hora) return { ok: false, error: 'La hora no es válida.' };
  const diaCompleto = !hora;
  const inicio = instanteDe(tz, y, m, d, hora ? Number(hora[1]) : 0, hora ? Number(hora[2]) : 0);
  const dur = e.duracionMin == null ? null : Math.round(Number(e.duracionMin));
  if (dur != null && (!Number.isFinite(dur) || dur < 0 || dur > MAX_DURACION_MIN)) return { ok: false, error: 'La duración no es válida.' };
  const fin = !diaCompleto && dur ? new Date(inicio.getTime() + dur * 60_000).toISOString() : null;
  return { ok: true, fila: { tipo: e.tipo, formato, titulo, notas, inicio: inicio.toISOString(), fin, dia_completo: diaCompleto } };
}

// ── Fechas: la semana y el mes ────────────────────────────────────────────────────────────────

/** Suma días a una fecha 'YYYY-MM-DD' (en UTC: una fecha de calendario no tiene zona). */
export function sumarDias(fecha: string, n: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 0 = lunes … 6 = domingo. */
export function diaDeLaSemana(fecha: string): number {
  const [y, m, d] = fecha.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** El lunes de la semana de `fecha`. La semana arranca el lunes (la de un negocio, no la del calendario de pared). */
export const lunesDe = (fecha: string): string => sumarDias(fecha, -diaDeLaSemana(fecha));

/**
 * Las vistas de Google Calendar (14/10/2026, la copia fiel): Día, 4 días, Semana, Mes, Año y Agenda. Se llaman como en
 * Google en español, y la tecla de cada una es la de Google (D, X, W, M, Y, A).
 */
export const VISTAS_CALENDARIO = [
  { id: 'dia', nombre: 'Día', tecla: 'd' },
  { id: 'semana', nombre: 'Semana', tecla: 'w' },
  { id: 'mes', nombre: 'Mes', tecla: 'm' },
  { id: 'anio', nombre: 'Año', tecla: 'y' },
  { id: 'agenda', nombre: 'Agenda', tecla: 'a' },
  { id: '4dias', nombre: '4 días', tecla: 'x' },
] as const;
export type VistaCalendario = (typeof VISTAS_CALENDARIO)[number]['id'];
export const esVistaCalendario = (x: unknown): x is VistaCalendario => VISTAS_CALENDARIO.some((v) => v.id === x);
/** Cuántos días lee la Agenda hacia adelante. */
export const DIAS_AGENDA = 30;

/**
 * Los días que dibuja una vista y el rango a leer. La semana: de lunes a domingo. El mes: la grilla completa de
 * semanas que lo contienen (de 4 a 6 filas de 7), así un evento del 30 del mes anterior se ve en su lugar. El año: sus
 * doce meses, sin eventos (Google tampoco los dibuja ahí): `dias` vacío y nada que leer. `hasta` es EXCLUSIVO.
 */
export function rangoDeVista(vista: VistaCalendario, fecha: string): { desde: string; hasta: string; dias: string[] } {
  const serie = (desde: string, n: number) => Array.from({ length: n }, (_, i) => sumarDias(desde, i));
  if (vista === 'dia') return { desde: fecha, hasta: sumarDias(fecha, 1), dias: [fecha] };
  if (vista === '4dias') return { desde: fecha, hasta: sumarDias(fecha, 4), dias: serie(fecha, 4) };
  if (vista === 'agenda') return { desde: fecha, hasta: sumarDias(fecha, DIAS_AGENDA), dias: serie(fecha, DIAS_AGENDA) };
  if (vista === 'semana') {
    const desde = lunesDe(fecha);
    return { desde, hasta: sumarDias(desde, 7), dias: serie(desde, 7) };
  }
  if (vista === 'anio') {
    const y = Number(fecha.slice(0, 4));
    return { desde: `${y}-01-01`, hasta: `${y + 1}-01-01`, dias: [] };
  }
  const primero = `${fecha.slice(0, 7)}-01`;
  const [y, m] = primero.split('-').map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const desde = lunesDe(primero);
  const hasta = sumarDias(lunesDe(ultimo), 7);
  const dias: string[] = [];
  for (let f = desde; f < hasta; f = sumarDias(f, 1)) dias.push(f);
  return { desde, hasta, dias };
}

/** La fecha de antes o de después, según la vista (las flechas ‹ › de Google). */
export function moverFecha(vista: VistaCalendario, fecha: string, delta: -1 | 1): string {
  if (vista === 'dia') return sumarDias(fecha, delta);
  if (vista === '4dias') return sumarDias(fecha, 4 * delta);
  if (vista === 'agenda') return sumarDias(fecha, 7 * delta);
  if (vista === 'semana') return sumarDias(lunesDe(fecha), 7 * delta);
  const [y, m] = fecha.split('-').map(Number);
  if (vista === 'anio') return `${y + delta}-01-01`;
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 10);
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const NOMBRES_MESES = MESES;
export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;
/** Las iniciales de la grilla del mes chico de la barra lateral (las de Google en español). */
export const INICIALES_DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/**
 * El título de la barra de arriba, como lo escribe Google: «octubre de 2026» (semana, mes, agenda, 4 días dentro del
 * mismo mes), «sep – oct de 2026» o «dic de 2026 – ene de 2027» si cruza, «14 de octubre de 2026» (día) y «2026» (año).
 */
export function rotuloDeRango(vista: VistaCalendario, fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  if (vista === 'anio') return String(y);
  if (vista === 'dia') return `${d} de ${MESES[m - 1]} de ${y}`;
  if (vista === 'mes') return `${MESES[m - 1]} de ${y}`;
  const { desde, hasta } = rangoDeVista(vista, fecha);
  const ultimo = sumarDias(hasta, -1);
  const [y1, m1] = desde.split('-').map(Number);
  const [y2, m2] = ultimo.split('-').map(Number);
  if (y1 === y2 && m1 === m2) return `${MESES[m1 - 1]} de ${y1}`;
  if (y1 === y2) return `${MESES_CORTOS[m1 - 1]} – ${MESES_CORTOS[m2 - 1]} de ${y2}`;
  return `${MESES_CORTOS[m1 - 1]} de ${y1} – ${MESES_CORTOS[m2 - 1]} de ${y2}`;
}

/** «miércoles, 14 de octubre»: la fecha de la tarjeta de un evento. */
export function fechaLarga(fecha: string): string {
  const [, m, d] = fecha.split('-').map(Number);
  return `${DIAS_LARGOS[diaDeLaSemana(fecha)]}, ${d} de ${MESES[m - 1]}`;
}

/** «10:00 a.m.»: la hora como la escribe Google en español (12 h). `00:00` es «12:00 a.m.». */
export function horaGoogle(hhmm: string, conMinutos = true): string {
  const [h, mi] = hhmm.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const suf = h < 12 ? 'a.m.' : 'p.m.';
  return conMinutos && mi ? `${h12}:${String(mi).padStart(2, '0')} ${suf}` : `${h12} ${suf}`;
}

/** Las semanas (de lunes a domingo) de un mes chico: la grilla de la barra lateral y de la vista Año. Siempre 6 filas. */
export function semanasDelMes(fecha: string): string[][] {
  const primero = `${fecha.slice(0, 7)}-01`;
  const desde = lunesDe(primero);
  return Array.from({ length: 6 }, (_, f) => Array.from({ length: 7 }, (_, c) => sumarDias(desde, f * 7 + c)));
}

/** El día (en la zona del negocio) de un instante. */
export const diaDe = (iso: string, tz: string): string => hoyEnTz(tz, new Date(iso));

/** 'HH:MM' de un instante en la zona del negocio. */
export function horaDe(iso: string, tz: string): string {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  const h = p.find((x) => x.type === 'hour')?.value ?? '00';
  const m = p.find((x) => x.type === 'minute')?.value ?? '00';
  return `${h === '24' ? '00' : h}:${m}`;
}

/**
 * Los renglones de cada día, en orden: primero los de día completo, después por hora. Un renglón que no cae en
 * ningún día dibujado no aparece (lo trajo una lectura más ancha que la vista).
 */
export function itemsPorDia(items: readonly ItemCalendario[], dias: readonly string[], tz: string): Map<string, ItemCalendario[]> {
  const out = new Map<string, ItemCalendario[]>(dias.map((d) => [d, []]));
  for (const it of items) {
    // Uno de varios días va en cada día que abarca (la Agenda y el «+N más» del mes lo cuentan en todos).
    const { primero, ultimo } = diasDeItem(it, tz);
    for (let d = primero; d <= ultimo; d = sumarDias(d, 1)) {
      out.get(d)?.push(it);
      if (d === ultimo || d > dias[dias.length - 1]) break;
    }
  }
  for (const lista of out.values()) {
    lista.sort((a, b) => (a.diaCompleto === b.diaCompleto ? a.inicio.localeCompare(b.inicio) || a.titulo.localeCompare(b.titulo, 'es') : a.diaCompleto ? -1 : 1));
  }
  return out;
}

/** Sólo las capas prendidas. */
export const filtrarPorCapas = (items: readonly ItemCalendario[], prendidas: ReadonlySet<CapaCalendario>): ItemCalendario[] =>
  items.filter((i) => prendidas.has(i.capa));

/**
 * Una reunión del CRM y un evento de Google que son la MISMA llamada (empiezan en el mismo minuto, ±2): queda la del
 * CRM, que lleva a la ficha del lead. Sin esto, cada llamada agendada por Calendly sale dos veces.
 */
export function sinDuplicarLlamadas(crm: readonly ItemCalendario[], google: readonly ItemCalendario[]): ItemCalendario[] {
  const inicios = crm.filter((c) => !c.diaCompleto).map((c) => Date.parse(c.inicio));
  return google.filter((g) => {
    if (g.diaCompleto) return true;
    const t = Date.parse(g.inicio);
    return !inicios.some((c) => Math.abs(c - t) <= 2 * 60_000);
  });
}

// ── Cómo se acomoda en la grilla (la de Google) ────────────────────────────────────────────────

/** Los minutos desde la medianoche de un instante, en la zona del negocio. */
export function minutosDelDia(iso: string, tz: string): number {
  const [h, m] = horaDe(iso, tz).split(':').map(Number);
  return h * 60 + m;
}

/** El primer y el último día (incluido) de un renglón: un día completo de Google puede abarcar varios. */
export function diasDeItem(it: ItemCalendario, tz: string): { primero: string; ultimo: string } {
  if (it.google?.diaCompleto && it.google.fecha) return { primero: it.google.fecha, ultimo: it.google.fechaFin ?? it.google.fecha };
  const primero = diaDe(it.inicio, tz);
  if (it.diaCompleto || !it.fin) return { primero, ultimo: primero };
  // Con hora: el último día es el del fin, salvo que termine justo a la medianoche (eso es el día anterior).
  const fin = new Date(Date.parse(it.fin) - 1).toISOString();
  const ultimo = diaDe(fin, tz);
  return { primero, ultimo: ultimo < primero ? primero : ultimo };
}

/** Lo que va en la franja de arriba (todo el día, o varios días) y no en la grilla de horas. */
export const vaArriba = (it: ItemCalendario, tz: string): boolean => {
  if (it.diaCompleto) return true;
  const { primero, ultimo } = diasDeItem(it, tz);
  return primero !== ultimo;
};

/**
 * Los eventos con hora de UN día, repartidos en columnas como en Google: los que se pisan comparten el ancho; los que
 * no, ocupan el día entero. Cada grupo de eventos que se pisan entre sí (aunque sea de a pares) usa las mismas
 * columnas. Un evento sin fin dura 30 minutos para el dibujo. Devuelve, por id, la columna y cuántas hay en su grupo.
 */
export function columnasDelDia(eventos: ReadonlyArray<{ id: string; ini: number; fin: number }>): Map<string, { col: number; cols: number }> {
  const orden = [...eventos].sort((a, b) => a.ini - b.ini || b.fin - a.fin);
  const out = new Map<string, { col: number; cols: number }>();
  let grupo: Array<{ id: string; col: number }> = [];
  let finGrupo = -1;
  let finesCols: number[] = [];
  const cerrar = () => {
    const cols = finesCols.length;
    for (const g of grupo) out.set(g.id, { col: g.col, cols });
    grupo = []; finesCols = [];
  };
  for (const e of orden) {
    const fin = Math.max(e.fin, e.ini + 30);
    if (grupo.length && e.ini >= finGrupo) cerrar();
    let col = finesCols.findIndex((f) => f <= e.ini);
    if (col < 0) { col = finesCols.length; finesCols.push(fin); } else finesCols[col] = fin;
    grupo.push({ id: e.id, col });
    finGrupo = Math.max(finGrupo, fin);
  }
  if (grupo.length) cerrar();
  return out;
}

/**
 * Las barras de la franja de arriba en una fila de días (la semana, o una fila del mes): cada renglón de todo el día
 * o de varios días, recortado a la fila, en el primer carril libre. `desde` y `hasta` son columnas (incluidas), y
 * `sigueAntes`/`sigueDespues` dicen si el evento continúa fuera de la fila (Google le dibuja la punta).
 */
export function barrasDeLaFila(items: readonly ItemCalendario[], dias: readonly string[], tz: string): {
  barras: Array<{ item: ItemCalendario; desde: number; hasta: number; carril: number; sigueAntes: boolean; sigueDespues: boolean }>;
  carriles: number;
} {
  if (!dias.length) return { barras: [], carriles: 0 };
  const d0 = dias[0];
  const dN = dias[dias.length - 1];
  const tramos = items
    .map((it) => ({ it, ...diasDeItem(it, tz) }))
    .filter((t) => t.ultimo >= d0 && t.primero <= dN)
    .map((t) => ({
      item: t.it,
      desde: t.primero < d0 ? 0 : dias.indexOf(t.primero),
      hasta: t.ultimo > dN ? dias.length - 1 : dias.indexOf(t.ultimo),
      sigueAntes: t.primero < d0,
      sigueDespues: t.ultimo > dN,
    }))
    .filter((t) => t.desde >= 0 && t.hasta >= t.desde)
    // Los más largos primero (como Google), y a igual largo, por hora y título.
    .sort((a, b) => (b.hasta - b.desde) - (a.hasta - a.desde) || a.desde - b.desde || a.item.inicio.localeCompare(b.item.inicio) || a.item.titulo.localeCompare(b.item.titulo, 'es'));
  const ocupado: boolean[][] = [];
  const barras = tramos.map((t) => {
    let carril = 0;
    for (;; carril++) {
      ocupado[carril] ??= Array(dias.length).fill(false);
      let libre = true;
      for (let c = t.desde; c <= t.hasta; c++) if (ocupado[carril][c]) { libre = false; break; }
      if (libre) break;
    }
    for (let c = t.desde; c <= t.hasta; c++) ocupado[carril][c] = true;
    return { ...t, carril };
  });
  return { barras, carriles: ocupado.length };
}

// ── El Quarter ────────────────────────────────────────────────────────────────────────────────

/** Los Quarters que tocan el rango [desde, hasta): `{ anio, q, inicio, fin }` con fechas 'YYYY-MM-DD' (fin incluido). */
export function quartersDelRango(desde: string, hasta: string): Array<{ anio: number; q: 1 | 2 | 3 | 4; inicio: string; fin: string }> {
  const out: Array<{ anio: number; q: 1 | 2 | 3 | 4; inicio: string; fin: string }> = [];
  const [y0] = desde.split('-').map(Number);
  for (let anio = y0 - 1; anio <= y0 + 1; anio++) {
    for (const q of [1, 2, 3, 4] as const) {
      const inicio = `${anio}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`;
      const fin = new Date(Date.UTC(anio, q * 3, 0)).toISOString().slice(0, 10);
      if (fin >= desde && inicio < hasta) out.push({ anio, q, inicio, fin });
    }
  }
  return out;
}

// ── Las plantillas ────────────────────────────────────────────────────────────────────────────

/** Un evento de una plantilla: el día de la semana (0 = lunes), la hora y cuánto dura. */
export type EventoDePlantilla = { dia: number; hora: string | null; duracionMin: number | null; tipo: TipoEvento; formato?: FormatoPublicacion; titulo: string };
export type PlantillaCalendario = { id: string; emoji: string; nombre: string; linea: string; eventos: readonly EventoDePlantilla[] };

/**
 * La galería de «Nueva semana». Genéricas a propósito (un ejemplo de UI es ficticio por regla): lo que planea un
 * negocio cualquiera. Se aplican sobre la semana que se está mirando, y los eventos nacen como propios y editables.
 */
export const PLANTILLAS_CALENDARIO: readonly PlantillaCalendario[] = [
  {
    id: 'contenido', emoji: '📱', nombre: 'Semana de contenido', linea: 'Tres Reels, dos Stories y un bloque para grabar.',
    eventos: [
      { dia: 0, hora: '15:00', duracionMin: 120, tipo: 'bloque', titulo: 'Grabar el contenido de la semana' },
      { dia: 0, hora: '10:00', duracionMin: null, tipo: 'publicacion', formato: 'reel', titulo: 'Reel' },
      { dia: 1, hora: '10:00', duracionMin: null, tipo: 'publicacion', formato: 'story', titulo: 'Story' },
      { dia: 2, hora: '10:00', duracionMin: null, tipo: 'publicacion', formato: 'reel', titulo: 'Reel' },
      { dia: 3, hora: '10:00', duracionMin: null, tipo: 'publicacion', formato: 'story', titulo: 'Story' },
      { dia: 4, hora: '10:00', duracionMin: null, tipo: 'publicacion', formato: 'reel', titulo: 'Reel' },
    ],
  },
  {
    id: 'guiones', emoji: '✍️', nombre: 'Guiones de la semana', linea: 'Escribir, grabar y editar, en tres bloques.',
    eventos: [
      { dia: 0, hora: '10:00', duracionMin: 120, tipo: 'bloque', titulo: 'Escribir los guiones' },
      { dia: 2, hora: '10:00', duracionMin: 90, tipo: 'bloque', titulo: 'Grabar' },
      { dia: 4, hora: '10:00', duracionMin: 90, tipo: 'bloque', titulo: 'Editar y programar' },
    ],
  },
  {
    id: 'foco', emoji: '🧠', nombre: 'Bloques de foco', linea: 'Dos horas sin interrupciones, de lunes a viernes.',
    eventos: [0, 1, 2, 3, 4].map((dia) => ({ dia, hora: '09:00', duracionMin: 120, tipo: 'bloque' as const, titulo: 'Bloque de foco' })),
  },
  {
    id: 'anuncios', emoji: '📣', nombre: 'Campaña de anuncios', linea: 'Lanzar, revisar y ajustar en la semana.',
    eventos: [
      { dia: 0, hora: '09:00', duracionMin: null, tipo: 'publicacion', formato: 'ad', titulo: 'Lanzar los anuncios' },
      { dia: 2, hora: '09:00', duracionMin: 30, tipo: 'bloque', titulo: 'Revisar cómo rinden los anuncios' },
      { dia: 4, hora: '09:00', duracionMin: 30, tipo: 'bloque', titulo: 'Ajustar el presupuesto' },
    ],
  },
  {
    id: 'lanzamiento', emoji: '🚀', nombre: 'Semana de lanzamiento', linea: 'Avisar, mostrar, abrir y cerrar.',
    eventos: [
      { dia: 0, hora: '10:00', duracionMin: null, tipo: 'publicacion', formato: 'story', titulo: 'Story: algo viene' },
      { dia: 1, hora: '10:00', duracionMin: null, tipo: 'publicacion', formato: 'reel', titulo: 'Reel: el problema que resuelves' },
      { dia: 2, hora: '10:00', duracionMin: null, tipo: 'publicacion', formato: 'email', titulo: 'Email: se abre la inscripción' },
      { dia: 3, hora: '10:00', duracionMin: null, tipo: 'publicacion', formato: 'story', titulo: 'Story: testimonio' },
      { dia: 4, hora: '10:00', duracionMin: null, tipo: 'publicacion', formato: 'email', titulo: 'Email: último día' },
    ],
  },
  {
    id: 'revision', emoji: '📋', nombre: 'Revisión semanal', linea: 'Una hora el viernes para mirar la semana y planear.',
    eventos: [{ dia: 4, hora: '16:00', duracionMin: 60, tipo: 'bloque', titulo: 'Revisar la semana y planear la próxima' }],
  },
];

/** «Evento en blanco»: la primera tarjeta, SIEMPRE. */
export const EVENTO_EN_BLANCO = { nombre: 'Evento en blanco', linea: 'Lo armas tú.' } as const;

/** Los eventos de una plantilla sobre la semana del `lunes`. */
export function entradasDePlantilla(p: PlantillaCalendario, lunes: string): EntradaEvento[] {
  return p.eventos.map((e) => ({
    titulo: e.titulo, tipo: e.tipo, formato: e.formato ?? null, fecha: sumarDias(lunes, e.dia), hora: e.hora, duracionMin: e.duracionMin,
  }));
}

export function filtrarPlantillasCalendario(lista: readonly PlantillaCalendario[], texto: string): PlantillaCalendario[] {
  const q = sinAcentos(texto);
  if (!q) return [...lista];
  return lista.filter((p) => sinAcentos(`${p.nombre} ${p.linea} ${p.eventos.map((e) => e.titulo).join(' ')}`).includes(q));
}

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// ── Lo que propone la IA ──────────────────────────────────────────────────────────────────────

/**
 * La respuesta de la IA, revalidada: cada evento con un tipo y un formato que existen, un día de la semana pedida y
 * una hora válida. Lo que no se puede leer se SACA con un aviso; nunca se inventa una fecha. Sin un solo evento
 * válido es un error (se reintenta).
 */
export function deIACalendario(obj: unknown, dias: readonly string[], tz: string): { entradas: EntradaEvento[]; avisos: string[]; errores: string[] } {
  const r = obj && typeof obj === 'object' ? (obj as Record<string, unknown>) : {};
  const crudos = Array.isArray(r.eventos) ? r.eventos.slice(0, MAX_LOTE) : [];
  const entradas: EntradaEvento[] = [];
  let malos = 0;
  for (const c of crudos) {
    const e = c && typeof c === 'object' ? (c as Record<string, unknown>) : {};
    const fecha = typeof e.fecha === 'string' && dias.includes(e.fecha) ? e.fecha : null;
    // Una hora que vino y no se lee no es «todo el día»: es un evento que no se puede agendar como lo pidieron.
    const horaRota = e.hora != null && e.hora !== '' && !(typeof e.hora === 'string' && RE_HORA.test(e.hora));
    if (horaRota) { malos++; continue; }
    const entrada: EntradaEvento = {
      titulo: typeof e.titulo === 'string' ? e.titulo.slice(0, TOPE_TITULO) : '',
      tipo: esTipoEvento(e.tipo) ? e.tipo : 'bloque',
      formato: esFormato(e.formato) ? e.formato : null,
      fecha: fecha ?? '',
      hora: typeof e.hora === 'string' && RE_HORA.test(e.hora) ? e.hora : null,
      duracionMin: typeof e.duracionMin === 'number' && e.duracionMin > 0 && e.duracionMin <= MAX_DURACION_MIN ? Math.round(e.duracionMin) : null,
    };
    if (!fecha || !filaDeEntrada(entrada, tz).ok) { malos++; continue; }
    entradas.push(entrada);
  }
  const avisos = malos ? [`Saqué ${malos === 1 ? 'un evento que no se podía agendar' : `${malos} eventos que no se podían agendar`}`] : [];
  const errores = entradas.length ? [] : [`"eventos" tiene que traer al menos uno con "fecha" en: ${dias.join(', ')}`];
  return { entradas, avisos, errores };
}
