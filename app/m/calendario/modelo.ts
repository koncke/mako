// =============================================================================
// /m/calendario — el modelo puro del Calendario del teléfono (con su test, tests/m-calendario.test.ts)
// =============================================================================
// Qué se lee de una vez, qué día se mira, cómo se acomoda el Día (la grilla de horas) y la Agenda (los días con algo),
// y qué dice cada renglón. Las reglas de NEGOCIO no viven acá: qué es un renglón, de qué calendario es, qué se ve y
// cómo se arma un evento nuevo salen de lib/calendario-modelo.ts y de app/calendario/comun.ts, los mismos de escritorio.
//
// Puro, sin `server-only` ni 'use client': lo importan la página (server), la pantalla (cliente) y el test.
// =============================================================================

import {
  NOMBRES_MESES, ROTULO_FORMATO, ROTULO_TIPO, VISTAS_CALENDARIO, columnasDelDia, diaDe, horaDe, itemsPorDia, lunesDe,
  minutosDelDia, rangoDeVista, sumarDias, vaArriba,
  type ItemCalendario,
} from '@/lib/calendario-modelo';
import type { CalendarioGoogle } from '@/lib/calendario-google-modelo';
import type { FallosCalendario, GoogleDelCalendario } from '@/lib/calendario';
import { rangoGoogle, type BorradorNuevo, type TipoRapido } from '@/app/calendario/comun';

// ── Las vistas ──────────────────────────────────────────────────────────────────────────────────────────────────────

export type VistaM = 'dia' | 'agenda';

/**
 * Las vistas del teléfono: Día y Agenda, con el NOMBRE y en el ORDEN de escritorio (`VISTAS_CALENDARIO`). Semana, Mes,
 * Año y 4 días se quedan en la computadora: en 390 px son siete columnas de 50 px.
 */
export const VISTAS_M: ReadonlyArray<{ id: VistaM; label: string }> = VISTAS_CALENDARIO
  .filter((v) => v.id === 'dia' || v.id === 'agenda')
  .map((v) => ({ id: v.id as VistaM, label: v.nombre }));

const primero = (x: unknown): unknown => (Array.isArray(x) ? x[0] : x);

/**
 * La vista de la URL (`?vista=`, la misma clave de escritorio: un link de la computadora abre lo más parecido). Sin
 * vista, la Agenda: es la portada, como la Programación de la app de Google Calendar. Las de grilla de horas (Semana,
 * 4 días) caen en el Día; Mes y Año, en la Agenda.
 */
export function vistaDeParam(x: unknown): VistaM {
  const v = primero(x);
  return v === 'dia' || v === 'semana' || v === '4dias' ? 'dia' : 'agenda';
}

const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** La fecha de la URL (`?fecha=YYYY-MM-DD`, una fecha que exista); si no, hoy. */
export function fechaDeParam(x: unknown, hoy: string): string {
  const v = primero(x);
  const m = typeof v === 'string' ? RE_FECHA.exec(v) : null;
  if (!m) return hoy;
  const [y, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mes < 1 || mes > 12 || d < 1 || d > new Date(Date.UTC(y, mes, 0)).getUTCDate()) return hoy;
  return v as string;
}

// ── Lo que se lee ───────────────────────────────────────────────────────────────────────────────────────────────────

export type RangoM = { desde: string; hasta: string };

/**
 * Lo que se lee de UNA vez (`hasta` exclusivo): desde el lunes de la semana de `fecha` hasta donde llega la Agenda de
 * escritorio (`fecha` + DIAS_AGENDA). Así la tira de la semana tiene sus puntos, y cambiar de vista o de día dentro de
 * eso no vuelve a pedirle nada al server (con Google son varias lecturas, ~1-3 s).
 */
export function rangoDeLectura(fecha: string): RangoM {
  return { desde: lunesDe(fecha), hasta: rangoDeVista('agenda', fecha).hasta };
}

export const enRango = (d: string, r: RangoM): boolean => d >= r.desde && d < r.hasta;

/** Los días que tienen algo dibujado, dentro de lo leído (los puntos de la tira y del mes). */
export function diasConAlgo(items: readonly ItemCalendario[], r: RangoM, tz: string): Set<string> {
  const dias: string[] = [];
  for (let d = r.desde; d < r.hasta; d = sumarDias(d, 1)) dias.push(d);
  const por = itemsPorDia(items, dias, tz);
  return new Set(dias.filter((d) => (por.get(d) ?? []).length > 0));
}

// ── Fechas que se dibujan ───────────────────────────────────────────────────────────────────────────────────────────

/** «Octubre» (el año en curso) u «Octubre de 2027», como la app de Google: el año sólo cuando no es el de hoy. */
export function rotuloDelMes(fecha: string, hoy: string): string {
  const [y, m] = fecha.split('-').map(Number);
  const nombre = NOMBRES_MESES[m - 1] ?? '';
  const mayus = nombre.charAt(0).toUpperCase() + nombre.slice(1);
  return y === Number(hoy.slice(0, 4)) ? mayus : `${mayus} de ${y}`;
}

/** Los siete días (de lunes a domingo) de la semana de `fecha`: la tira de arriba. */
export const semanaDe = (fecha: string): string[] => Array.from({ length: 7 }, (_, i) => sumarDias(lunesDe(fecha), i));

/** El primero del mes, `n` meses antes o después. */
export function sumarMeses(fecha: string, n: number): string {
  const [y, m] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
}

// ── Lo que dice un renglón ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * La segunda línea de un evento: la hora (o «Todo el día», como la Agenda de escritorio) y qué es. Una reunión del CRM
 * ya lleva su R1/R2 en el título (`tituloDe`): acá va el resto («closer Ana»). Lo de Google, sólo la hora.
 */
export function lineaDelEvento(it: ItemCalendario, tz: string): string {
  const hora = vaArriba(it, tz) ? 'Todo el día' : rangoGoogle(horaDe(it.inicio, tz), it.fin ? horaDe(it.fin, tz) : null);
  const que = queEs(it);
  return que ? `${hora} · ${que}` : hora;
}

function queEs(it: ItemCalendario): string | null {
  if (it.fuente === 'propio') return it.tipo === 'publicacion' && it.formato ? ROTULO_FORMATO[it.formato] : it.tipo ? ROTULO_TIPO[it.tipo] : null;
  if (it.fuente === 'google') return null;
  if (it.fuente === 'crm') return (it.detalle ?? '').split(' · ').slice(1).join(' · ') || null;
  return it.detalle?.trim() || null;
}

// ── La Agenda ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Un día de la Agenda: sus renglones y, si con él empieza otro mes, el nombre del mes (la banda de la app de Google). */
export type GrupoAgenda = { dia: string; mes: string | null; items: ItemCalendario[] };

/** Los días CON ALGO de los treinta de la Agenda de escritorio (`rangoDeVista('agenda')`), en orden. */
export function gruposDeAgenda(items: readonly ItemCalendario[], fecha: string, hoy: string, tz: string): GrupoAgenda[] {
  const { dias } = rangoDeVista('agenda', fecha);
  const por = itemsPorDia(items, dias, tz);
  const out: GrupoAgenda[] = [];
  let mesAnterior = fecha.slice(0, 7);
  for (const d of dias) {
    const del = por.get(d) ?? [];
    if (!del.length) continue;
    out.push({ dia: d, mes: d.slice(0, 7) !== mesAnterior ? rotuloDelMes(d, hoy) : null, items: del });
    mesAnterior = d.slice(0, 7);
  }
  return out;
}

// ── El Día: la grilla de horas ──────────────────────────────────────────────────────────────────────────────────────

/** Un minuto, un píxel: la hora mide 60 (la app de Google, ~56). */
export const HORA_PX = 60;
/** Lo mínimo que mide un evento dibujado: el toque de 44 px más los 2 de aire entre uno y otro. Uno de 15 minutos se dibuja así. */
export const ALTO_MIN_PX = 46;
/** Las horas que se ven siempre, aunque el día esté vacío. */
const VENTANA = { desde: 8, hasta: 20 } as const;

export type BloqueDia = {
  item: ItemCalendario;
  /** Minutos desde la medianoche: el inicio y el fin reales (los del texto). */
  ini: number;
  fin: number;
  /** «10 – 11 a.m.». */
  rango: string;
  /** Dónde se dibuja, en px desde la primera hora de la ventana. */
  top: number;
  alto: number;
  /** La columna, cuando se pisan (`columnasDelDia`, la misma cuenta de escritorio). */
  col: number;
  cols: number;
};

export type DiaEnGrilla = {
  /** Lo de todo el día o de varios días: arriba, fuera de la grilla. */
  arriba: ItemCalendario[];
  /** La ventana de horas que se dibuja: [desde, hasta). */
  desde: number;
  hasta: number;
  bloques: BloqueDia[];
};

const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/**
 * El Día como lo dibuja la grilla de Google: lo de todo el día arriba y lo que tiene hora en su lugar, repartido en
 * columnas si se pisa. La ventana es de 8 a 20 y se estira para que entre todo lo del día (y la línea de ahora, si es
 * hoy): sin un scroll propio que arranque «un poco antes de ahora», como el de escritorio, las 24 horas serían 1.440 px
 * de vacío para llegar a la mañana.
 *
 * El fin es el de la grilla de escritorio (VistaTiempo): el del mismo día; si sigue al otro día, la medianoche; sin
 * fin, media hora. Lo que se DIBUJA mide al menos ALTO_MIN_PX, y las columnas se cuentan con ese alto (si no, uno de
 * 15 minutos taparía al de las 10:30).
 */
export function diaEnGrilla(items: readonly ItemCalendario[], dia: string, tz: string, ahoraMin: number | null): DiaEnGrilla {
  const del = itemsPorDia(items, [dia], tz).get(dia) ?? [];
  const arriba = del.filter((it) => vaArriba(it, tz));
  const minDibujo = Math.round((ALTO_MIN_PX / HORA_PX) * 60);
  const conHora = del.filter((it) => !vaArriba(it, tz)).map((it) => {
    const ini = minutosDelDia(it.inicio, tz);
    const fin = it.fin && diaDe(it.fin, tz) === dia ? Math.max(ini + 15, minutosDelDia(it.fin, tz)) : it.fin ? 24 * 60 : ini + 30;
    const dIni = Math.min(ini, 24 * 60 - minDibujo);
    const dFin = Math.min(24 * 60, Math.max(fin, dIni + minDibujo));
    return { it, ini, fin, dIni, dFin };
  });
  let desde: number = VENTANA.desde;
  let hasta: number = VENTANA.hasta;
  for (const b of conHora) {
    desde = Math.min(desde, Math.floor(b.dIni / 60));
    hasta = Math.max(hasta, Math.ceil(b.dFin / 60));
  }
  if (ahoraMin != null) {
    desde = Math.min(desde, Math.floor(ahoraMin / 60));
    hasta = Math.max(hasta, Math.floor(ahoraMin / 60) + 1);
  }
  desde = Math.max(0, desde);
  hasta = Math.min(24, hasta);
  const cols = columnasDelDia(conHora.map((b) => ({ id: b.it.id, ini: b.dIni, fin: b.dFin })));
  const px = HORA_PX / 60;
  const bloques = conHora.map((b) => {
    const c = cols.get(b.it.id) ?? { col: 0, cols: 1 };
    return {
      item: b.it, ini: b.ini, fin: b.fin, rango: rangoGoogle(hhmm(b.ini), b.it.fin ? hhmm(b.fin) : null),
      top: (b.dIni - desde * 60) * px, alto: (b.dFin - b.dIni) * px, col: c.col, cols: c.cols,
    };
  });
  return { arriba, desde, hasta, bloques };
}

// ── Crear ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * El borrador con el que abre «Nuevo evento», como el de escritorio (`borradorEn`, CalendarioApp): un Evento de una
 * hora, al calendario principal de Google si hay donde escribir. `iniMin` null = todo el día.
 */
export function borradorNuevo(fecha: string, iniMin: number | null, editables: readonly CalendarioGoogle[]): BorradorNuevo {
  return {
    tipo: 'evento', titulo: '', fecha,
    hora: iniMin == null ? null : hhmm(iniMin),
    horaFin: iniMin == null ? null : hhmm(Math.min(iniMin + 60, 24 * 60 - 1)),
    formato: 'reel', calendarioId: editables.find((c) => c.primario)?.id ?? editables[0]?.id ?? null,
  };
}

/** El día en el que nace lo que se crea con el «+»: el que se mira en el Día; en la Agenda, hoy si está en ella. */
export function fechaParaCrear(vista: VistaM, dia: string, fecha: string, hoy: string): string {
  if (vista === 'dia') return dia;
  return hoy >= fecha && hoy < rangoDeVista('agenda', fecha).hasta ? hoy : fecha;
}

/** El botón de guardar dice QUÉ guarda (nunca «Guardar» a secas). */
export const TEXTO_GUARDAR: Record<TipoRapido, string> = {
  evento: 'Guardar evento',
  publicacion: 'Guardar publicación',
  bloque: 'Guardar bloque',
  llamada: 'Guardar llamada',
  otro: 'Guardar evento',
};

// ── Lo que no se pudo leer ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * «No pude leer el Plan y los cobros.»: UNA frase con todo lo que falló (en el teléfono no hay barra lateral para una
 * línea por lectura). ⚠️ «NO PUDE LEER» NO ES «NO HAY» (lib/calendario.ts): con una lectura caída, el día vacío no se
 * afirma. Que Google NO ESTÉ CONECTADO no es un fallo: se dice en la fila de la computadora (`queEnLaComputadora`).
 */
export function fraseDeFallos(f: FallosCalendario, g: GoogleDelCalendario | null): string | null {
  const cuales: string[] = [];
  if (f.propios) cuales.push('tus eventos');
  if (f.crm) cuales.push('las reuniones del CRM');
  if (f.google === 'error') cuales.push('tu Google Calendar');
  else if (g?.fallaron.length) cuales.push(...g.fallaron);
  if (f.plan) cuales.push('los deadlines del Plan');
  if (f.recurrentes) cuales.push('lo que se repite');
  if (f.cobros) cuales.push('los cobros');
  if (f.objetivos) cuales.push('los Objetivos');
  if (!cuales.length) return null;
  const lista = cuales.length === 1 ? cuales[0] : `${cuales.slice(0, -1).join(', ')} y ${cuales[cuales.length - 1]}`;
  return `No pude leer ${lista}.`;
}

/** La fila gris del final: lo que se hace en la computadora (conectar Google, si falta, va primero). */
export function queEnLaComputadora(f: FallosCalendario): string {
  return f.google === 'sin-conexion' ? 'Conectar Google Calendar' : 'Semana, Mes y plantillas';
}
