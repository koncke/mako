// =============================================================================
// comunidad-eventos — el calendario de la comunidad (puro): un evento, su serie y su .ics
// =============================================================================
// La segunda mitad de la comunidad tipo Skool (D8 de docs/diseno-curso-skool.md; el relevo de
// Skool, B.6): un evento tiene título, fecha, hora, ZONA HORARIA, duración (30 min a 24 h),
// descripción, portada, lugar (un link de Zoom/Meet/otro, o una dirección), una recurrencia
// (diaria, semanal con sus días, mensual; termina nunca, en una fecha o tras N veces) y un acceso
// (todos, desde un nivel, o los que tienen un módulo del curso).
//
// Sin 'use client' ni 'server-only' a propósito: lo usan la capa de datos
// (lib/comunidad-calendario.ts), la pantalla (app/_comunidad/Calendario.tsx) y el test que lo EJECUTA
// (tests/comunidad-eventos.test.ts). Acá no se lee ni se escribe nada.
//
// ── LA HORA ES DE PARED, Y CADA OCURRENCIA SE ARMA DESDE LA FECHA DE LA ANTERIOR ──────────────
// «Todos los martes a las 18:00 de Ciudad de México» es una hora de PARED: después del cambio de
// horario tiene que seguir siendo 18:00 allá, aunque en UTC sea una hora más o una menos. Por eso
// la serie NO se expande sumando 7 × 86.400.000 ms al instante anterior —eso deriva una hora el día
// del cambio, sin un solo error—: se camina la FECHA LOCAL (la de la ocurrencia anterior + 1 día, + 7
// días, + 1 mes) y cada fecha se convierte a instante con `instanteDe` (lib/cron-aviso.ts), que hace
// DOS PASADAS porque el desvío cambia justo en el salto (AGENTS.md: «un horario que se repite se
// ancla en la OCURRENCIA ANTERIOR»; medido allá: con una pasada, Tijuana el 8/3 a las 9:00 sale 10:00).
//
// ── LAS EXCEPCIONES VAN POR FECHA LOCAL, NO POR INSTANTE ─────────────────────────────────────
// «Borrar este evento» y «editar este evento» anotan la FECHA (`'2026-10-15'`) en la serie. Una serie
// tiene a lo sumo una ocurrencia por día, así que la fecha la nombra sola — y sigue valiendo si después
// se le cambia la hora a «todos» (un instante guardado quedaría apuntando a una hora que ya no existe).

import { instanteDe, partesEn } from './cron-aviso';
import { saneaPortada } from './portadas';
import { sanearTexto } from './comunidad-reglas';

// ── Los tipos ─────────────────────────────────────────────────────────────────────

export type Frecuencia = 'diaria' | 'semanal' | 'mensual';
export const FRECUENCIAS: readonly Frecuencia[] = ['diaria', 'semanal', 'mensual'];

export type FinSerie = { tipo: 'nunca' } | { tipo: 'fecha'; fecha: string } | { tipo: 'veces'; veces: number };

/**
 * La recurrencia. `cada` = cada cuántos días / semanas / meses. `dias` (0 = domingo) sólo vale en la
 * semanal, y SIEMPRE incluye el día de la semana del inicio (`sanearEvento` lo agrega): una serie
 * semanal cuyo primer evento no cae en ninguno de sus días no tendría primer evento.
 */
export type Recurrencia = { frecuencia: Frecuencia; cada: number; dias: number[]; fin: FinSerie };

/**
 * Quién puede entrar (Skool, B.6: todos, desde cierto nivel, o los que tienen acceso a un curso).
 * `modulo` es la clave de un módulo del curso de ESTE producto (`curso_clases.etapa`, D1): entra quien
 * tiene ese módulo en sus permisos (`moduloPermitido`, lib/curso-alcance.ts).
 */
export type AccesoEvento = { tipo: 'todos' } | { tipo: 'nivel'; nivel: number } | { tipo: 'modulo'; clave: string };

export type LugarTipo = 'link' | 'direccion';

/** Lo que hace falta para expandir una serie (una fila de `comunidad_eventos`, ya leída). */
export type SerieEvento = {
  inicioMs: number;
  zona: string;
  duracionMin: number;
  recurrencia: Recurrencia | null;
  /** Fechas locales (`YYYY-MM-DD`) que la serie NO tiene: borradas o movidas («este evento»). */
  excepciones: readonly string[];
};

/** Una ocurrencia. `indice` = la cuenta de la serie (0 = la primera), excluidas incluidas, como el COUNT del RFC 5545. */
export type Ocurrencia = { inicio: number; fin: number; fecha: string; indice: number };

// ── Topes ─────────────────────────────────────────────────────────────────────────

export const TOPE_TITULO_EVENTO = 120;
export const TOPE_DESCRIPCION_EVENTO = 4000;
export const TOPE_LUGAR = 600;
export const TOPE_DIRECCION = 300;
/** Skool: de 30 minutos a 24 horas. La 0217 repite el rango en un CHECK. */
export const DURACION_MIN = 30;
export const DURACION_MAX = 1440;
export const CADA_MAX_EVENTO = 30;
export const VECES_MAX = 365;
/** Hasta cuántas ocurrencias devuelve una consulta (un mes con un evento diario son 31). */
export const MAX_OCURRENCIAS = 500;
/** El cinturón del bucle: un evento diario de hace 100 años no cuelga el pedido. */
const MAX_PASOS = 40_000;

const DIA_MS = 86_400_000;
/** El tope de un pedido de calendario: un mes visible con sus bordes entra holgado. */
export const RANGO_MAX_MS = 130 * DIA_MS;
/** Hasta dónde se puede mirar, para atrás y para adelante de hoy. */
export const HORIZONTE_MS = 10 * 366 * DIA_MS;

/**
 * El rango `[desde, hasta)` que se le contesta a un pedido del calendario. Lo manda el NAVEGADOR (el
 * del alumno también), así que se acota acá: `desde` dentro de ±10 años de hoy, y no más de 130 días.
 *
 * ⚠️ SIN EL TOPE DE `desde`, un pedido armado a mano con el año 2200 caminaba cada serie desde su
 *    inicio hasta ahí (una semanal de 7 días: ~63.000 fechas por evento, por pedido) y un año fuera
 *    del rango de `Date` tiraba un `RangeError` que la ruta contestaba 500. Diez años son 36 clics
 *    de «mes siguiente» de sobra para cualquiera que lo use de verdad.
 */
export function rangoDeCalendario(desdeRaw: unknown, hastaRaw: unknown, ahoraMs: number): { desde: number; hasta: number } {
  let desde = typeof desdeRaw === 'number' || typeof desdeRaw === 'string' ? Number(desdeRaw) : NaN;
  let hasta = typeof hastaRaw === 'number' || typeof hastaRaw === 'string' ? Number(hastaRaw) : NaN;
  if (!Number.isFinite(desde)) desde = ahoraMs - 7 * DIA_MS;
  desde = Math.min(Math.max(desde, ahoraMs - HORIZONTE_MS), ahoraMs + HORIZONTE_MS);
  if (!Number.isFinite(hasta) || hasta <= desde) hasta = desde + 42 * DIA_MS;
  return { desde, hasta: Math.min(hasta, desde + RANGO_MAX_MS) };
}

// ── Fechas locales (sin zona: un día del calendario) ─────────────────────────────

export type Fecha = { y: number; m: number; d: number };

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
export const fechaTexto = (f: Fecha): string => `${pad(f.y, 4)}-${pad(f.m)}-${pad(f.d)}`;

/** Una fecha `YYYY-MM-DD` que existe en el calendario, o `null`. */
export function leerFecha(s: unknown): Fecha | null {
  if (typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const f = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  const t = new Date(Date.UTC(f.y, f.m - 1, f.d));
  if (t.getUTCFullYear() !== f.y || t.getUTCMonth() !== f.m - 1 || t.getUTCDate() !== f.d) return null;
  if (f.y < 2000 || f.y > 2200) return null;
  return f;
}

/** Una hora `HH:MM` de 00:00 a 23:59, o `null`. */
export function leerHora(s: unknown): { h: number; min: number } | null {
  if (typeof s !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59 ? { h, min } : null;
}

const utcDe = (f: Fecha) => Date.UTC(f.y, f.m - 1, f.d);
const deUtc = (t: number): Fecha => { const d = new Date(t); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; };
export const sumarDias = (f: Fecha, n: number): Fecha => deUtc(Date.UTC(f.y, f.m - 1, f.d + n));
export const diasEntre = (a: Fecha, b: Fecha): number => Math.round((utcDe(b) - utcDe(a)) / 86_400_000);
/** El día de la semana de una fecha (0 = domingo). Es del CALENDARIO, no de ninguna zona. */
export const diaDeSemana = (f: Fecha): number => new Date(utcDe(f)).getUTCDay();
const comparar = (a: Fecha, b: Fecha) => utcDe(a) - utcDe(b);
const diasDelMes = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** La fecha y la hora LOCALES de un instante en `zona`. */
export function localDe(ms: number, zona: string): { fecha: Fecha; h: number; min: number } {
  const p = partesEn(zona, new Date(ms));
  return { fecha: { y: p.y, m: p.m, d: p.d }, h: p.h, min: p.min };
}

/** ¿Es una zona horaria que este motor conoce? (`UTC`, `America/Mexico_City`…). */
export function esZonaValida(z: unknown): z is string {
  if (typeof z !== 'string' || z.length > 64 || !/^[A-Za-z][A-Za-z0-9_+\-/]*$/.test(z)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: z });
    return true;
  } catch {
    return false;
  }
}

// ── La serie: qué fechas tiene ───────────────────────────────────────────────────

/** Los días de una semanal en el orden de la semana que arranca el LUNES (como el WKST=MO del .ics). */
const ordenLunes = (dia: number) => (dia + 6) % 7;

/**
 * Las fechas candidatas de una serie, en orden, desde la del inicio. No mira el fin ni las
 * excepciones (eso lo hace quien consume): sólo «qué días caen en la regla».
 *
 * ⚠️ MENSUAL EN UN DÍA QUE EL MES NO TIENE: ese mes NO tiene evento (el 31 no existe en abril), como
 *    el RFC 5545 y Google Calendar. Correrlo al 30 sería inventar una fecha que nadie eligió. Y un mes
 *    salteado no cuenta para «tras N veces» (el RFC tampoco lo cuenta).
 */
function* fechasDeLaRegla(base: Fecha, r: Recurrencia | null): Generator<Fecha> {
  if (!r) { yield base; return; }
  if (r.frecuencia === 'diaria') {
    for (let i = 0; i < MAX_PASOS; i++) yield sumarDias(base, i * r.cada);
    return;
  }
  if (r.frecuencia === 'semanal') {
    // La semana se cuenta desde el LUNES de la semana del inicio: «cada 2 semanas» son las semanas
    // 0, 2, 4… de esa grilla, y adentro de cada una, los días elegidos en orden.
    const lunes = sumarDias(base, -ordenLunes(diaDeSemana(base)));
    const dias = [...new Set(r.dias)].sort((a, b) => ordenLunes(a) - ordenLunes(b));
    for (let s = 0; s < MAX_PASOS; s += r.cada) {
      for (const dia of dias) {
        const f = sumarDias(lunes, s * 7 + ordenLunes(dia));
        if (comparar(f, base) >= 0) yield f;
      }
    }
    return;
  }
  // mensual
  for (let i = 0; i < MAX_PASOS; i++) {
    const total = base.m - 1 + i * r.cada;
    const y = base.y + Math.floor(total / 12);
    const m = (total % 12) + 1;
    if (base.d <= diasDelMes(y, m)) yield { y, m, d: base.d };
  }
}

/**
 * Las fechas de la serie con su índice, respetando el FIN (no las excepciones): `nunca`, `fecha`
 * (inclusive: el evento de ese día sí va) o `veces` (N ocurrencias contando las borradas, como el
 * COUNT del RFC: borrar una no estira la serie).
 */
function* fechasDeLaSerie(base: Fecha, r: Recurrencia | null): Generator<{ fecha: Fecha; indice: number }> {
  const finFecha = r?.fin.tipo === 'fecha' ? leerFecha(r.fin.fecha) : null;
  const veces = r?.fin.tipo === 'veces' ? r.fin.veces : null;
  let k = 0;
  for (const f of fechasDeLaRegla(base, r)) {
    if (veces != null && k >= veces) return;
    if (finFecha && comparar(f, finFecha) > 0) return;
    yield { fecha: f, indice: k };
    k++;
  }
}

/**
 * Las ocurrencias de una serie (o del evento único) que se CRUZAN con `[desdeMs, hastaMs)`: las que
 * empiezan antes de `hastaMs` y terminan después de `desdeMs` (una clase en curso también cuenta).
 * Sin las excepciones. Hasta `max`.
 *
 * Cada ocurrencia se arma desde su FECHA local + la hora de pared del inicio (ver la cabecera). Antes
 * del rango se camina sólo con fechas, sin convertir a instante: una diaria de hace tres años son mil
 * pasos de aritmética y no mil conversiones de zona.
 */
export function ocurrencias(s: SerieEvento, desdeMs: number, hastaMs: number, max = MAX_OCURRENCIAS): Ocurrencia[] {
  if (!(hastaMs > desdeMs) || !esZonaValida(s.zona)) return [];
  const durMs = Math.max(0, s.duracionMin) * 60_000;
  const { fecha: base, h, min } = localDe(s.inicioMs, s.zona);
  const excluidas = new Set(s.excepciones);
  // La fecha local desde la que vale la pena convertir: un día antes del rango (y lo que dura un
  // evento largo), para no perder uno que empezó ayer y sigue.
  const desdeLocal = sumarDias(localDe(desdeMs - durMs, s.zona).fecha, -1);
  const out: Ocurrencia[] = [];
  for (const { fecha, indice } of fechasDeLaSerie(base, s.recurrencia)) {
    if (comparar(fecha, desdeLocal) < 0) continue;
    const inicio = instanteDe(s.zona, fecha.y, fecha.m, fecha.d, h, min).getTime();
    if (inicio >= hastaMs) break;
    if (inicio + durMs <= desdeMs) continue;
    if (excluidas.has(fechaTexto(fecha))) continue;
    out.push({ inicio, fin: inicio + durMs, fecha: fechaTexto(fecha), indice });
    if (out.length >= max) break;
  }
  return out;
}

/**
 * El índice de la ocurrencia de `fecha` en la serie (0 = la primera), o `null` si esa fecha no es de
 * la serie (no cae en la regla, está después del fin, o está borrada). Es lo que decide «este y los
 * siguientes»: dónde se parte.
 */
export function indiceDeFecha(s: SerieEvento, fechaRaw: unknown): number | null {
  const objetivo = leerFecha(fechaRaw);
  if (!objetivo || !esZonaValida(s.zona)) return null;
  if (s.excepciones.includes(fechaTexto(objetivo))) return null;
  const { fecha: base } = localDe(s.inicioMs, s.zona);
  for (const { fecha, indice } of fechasDeLaSerie(base, s.recurrencia)) {
    const c = comparar(fecha, objetivo);
    if (c === 0) return indice;
    if (c > 0) return null;
  }
  return null;
}

/**
 * Partir una serie en la ocurrencia `indice` (que cae en `corte`): «este y los siguientes».
 *   · `antes`: el fin que le queda a la serie vieja. Con «tras N veces» pasa a `indice` veces (las que
 *     ya tuvo); si no, termina el día ANTERIOR al corte.
 *   · `despues`: el fin de la serie nueva. Con «tras N veces» le quedan `N − indice`; con una fecha o
 *     nunca, el mismo.
 * `null` si el corte es la primera (ahí no se parte: es «todos»).
 */
export function partirSerie(r: Recurrencia, corte: Fecha, indice: number): { antes: FinSerie; despues: FinSerie } | null {
  if (indice <= 0) return null;
  if (r.fin.tipo === 'veces') {
    return { antes: { tipo: 'veces', veces: indice }, despues: { tipo: 'veces', veces: Math.max(1, r.fin.veces - indice) } };
  }
  return { antes: { tipo: 'fecha', fecha: fechaTexto(sumarDias(corte, -1)) }, despues: r.fin };
}

/** Las excepciones partidas en el corte: las de antes se quedan en la serie vieja, las de después van a la nueva. */
export function partirExcepciones(excepciones: readonly string[], corte: Fecha): { antes: string[]; despues: string[] } {
  const c = fechaTexto(corte);
  return { antes: excepciones.filter((f) => f < c), despues: excepciones.filter((f) => f >= c) };
}

/** Las excepciones guardadas: sólo fechas válidas, sin repetir, en orden. */
export function excepcionesGuardadas(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const x of raw) { const f = leerFecha(x); if (f) out.add(fechaTexto(f)); }
  return [...out].sort().slice(0, 2000);
}

// ── Validar lo que llega ──────────────────────────────────────────────────────────

const esEntero = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d{1,6}$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/**
 * Una recurrencia que llega del navegador (o de la base), contra la FECHA de inicio. `null` en `ok`
 * = no se repite. El día de la semana del inicio se agrega solo a una semanal (ver el tipo).
 */
export function sanearRecurrencia(raw: unknown, inicio: Fecha): { ok: true; recurrencia: Recurrencia | null } | { ok: false; error: string } {
  if (raw == null || raw === false) return { ok: true, recurrencia: null };
  const b = (typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (b.frecuencia == null || b.frecuencia === '' || b.frecuencia === 'nunca') return { ok: true, recurrencia: null };
  if (!FRECUENCIAS.includes(b.frecuencia as Frecuencia)) return { ok: false, error: 'Esa repetición no va.' };
  const frecuencia = b.frecuencia as Frecuencia;
  const cada = esEntero(b.cada ?? 1, 1, CADA_MAX_EVENTO);
  if (cada == null) return { ok: false, error: `Cada 1 a ${CADA_MAX_EVENTO}.` };
  let dias: number[] = [];
  if (frecuencia === 'semanal') {
    const crudos = Array.isArray(b.dias) ? b.dias : [];
    const set = new Set<number>();
    for (const x of crudos) { const n = esEntero(x, 0, 6); if (n != null) set.add(n); }
    set.add(diaDeSemana(inicio));
    dias = [...set].sort((x, y) => ordenLunes(x) - ordenLunes(y));
  }
  const f = (b.fin && typeof b.fin === 'object' ? b.fin : { tipo: 'nunca' }) as Record<string, unknown>;
  let fin: FinSerie;
  if (f.tipo === 'fecha') {
    const fecha = leerFecha(f.fecha);
    if (!fecha) return { ok: false, error: 'Falta la fecha de fin.' };
    if (comparar(fecha, inicio) < 0) return { ok: false, error: 'El fin va después del inicio.' };
    fin = { tipo: 'fecha', fecha: fechaTexto(fecha) };
  } else if (f.tipo === 'veces') {
    const veces = esEntero(f.veces, 1, VECES_MAX);
    if (veces == null) return { ok: false, error: `De 1 a ${VECES_MAX} veces.` };
    fin = { tipo: 'veces', veces };
  } else {
    fin = { tipo: 'nunca' };
  }
  return { ok: true, recurrencia: { frecuencia, cada, dias, fin } };
}

/** Una recurrencia guardada (jsonb). Lo que no tiene la forma, no se repite. */
export function recurrenciaGuardada(raw: unknown, inicio: Fecha): Recurrencia | null {
  const r = sanearRecurrencia(raw, inicio);
  return r.ok ? r.recurrencia : null;
}

/** El acceso: `todos` si no llega nada; un nivel de 2 a 9 (el 1 es «todos»); un módulo con su clave. */
export function sanearAcceso(raw: unknown): { ok: true; acceso: AccesoEvento } | { ok: false; error: string } {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (b.tipo === 'nivel') {
    const nivel = esEntero(b.nivel, 1, 9);
    if (nivel == null) return { ok: false, error: 'Elige un nivel.' };
    return { ok: true, acceso: nivel <= 1 ? { tipo: 'todos' } : { tipo: 'nivel', nivel } };
  }
  if (b.tipo === 'modulo') {
    const clave = typeof b.clave === 'string' ? b.clave.trim() : '';
    if (!clave || clave.length > 120 || /[\u0000-\u001f\u007f]/.test(clave)) return { ok: false, error: 'Elige un módulo.' };
    return { ok: true, acceso: { tipo: 'modulo', clave } };
  }
  return { ok: true, acceso: { tipo: 'todos' } };
}

/** Un acceso guardado (jsonb): lo que no se entiende es `todos`… salvo que traiga un tipo: ahí, cerrado. */
export function accesoGuardado(raw: unknown): AccesoEvento | null {
  const r = sanearAcceso(raw);
  if (r.ok) return r.acceso;
  // ⚠️ UN ACCESO ROTO NO ABRE EL EVENTO: un `{ tipo: 'nivel' }` sin nivel es una restricción que se
  //    leyó mal, y «todos» la abriría. `null` = nadie del alumnado (el equipo lo ve igual).
  return null;
}

/** Un link de reunión: http/https y que parsee. Cualquier otra cosa no es un link. */
export function linkDeLugar(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s || s.length > TOPE_LUGAR) return null;
  const conProtocolo = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(conProtocolo);
    if ((u.protocol !== 'https:' && u.protocol !== 'http:') || !u.hostname.includes('.')) return null;
    // El tope sobre lo que se GUARDA (normalizado: una «ñ» son seis letras), que es lo que mira el CHECK.
    const limpio = u.toString();
    return limpio.length <= TOPE_LUGAR ? limpio : null;
  } catch {
    return null;
  }
}

export type EventoLimpio = {
  titulo: string;
  descripcion: string;
  fecha: string;
  hora: string;
  zona: string;
  /** El primer inicio, en UTC: la hora de pared de `fecha` y `hora` en `zona`, con dos pasadas. */
  inicioMs: number;
  duracionMin: number;
  lugarTipo: LugarTipo;
  lugar: string;
  portada: string | null;
  acceso: AccesoEvento;
  recurrencia: Recurrencia | null;
};

/**
 * Valida un evento antes de escribirlo. El server lo vuelve a correr siempre: lo que manda la pantalla
 * es una propuesta. La PORTADA pasa por `saneaPortada` (un degradado del catálogo o una foto de un
 * origen permitido); cualquier otra cosa es «sin portada», nunca un string a medias.
 */
export function sanearEvento(raw: unknown): { ok: true; evento: EventoLimpio } | { ok: false; error: string } {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const titulo = sanearTexto(b.titulo, { unaLinea: true });
  if (!titulo) return { ok: false, error: 'Falta el título.' };
  if (titulo.length > TOPE_TITULO_EVENTO) return { ok: false, error: `El título pasa de ${TOPE_TITULO_EVENTO} letras.` };
  const descripcion = sanearTexto(b.descripcion);
  if (descripcion.length > TOPE_DESCRIPCION_EVENTO) return { ok: false, error: `La descripción pasa de ${TOPE_DESCRIPCION_EVENTO} letras.` };
  const fecha = leerFecha(b.fecha);
  if (!fecha) return { ok: false, error: 'Falta la fecha.' };
  const hora = leerHora(b.hora);
  if (!hora) return { ok: false, error: 'Falta la hora.' };
  if (!esZonaValida(b.zona)) return { ok: false, error: 'Esa zona horaria no existe.' };
  const zona = b.zona;
  const duracionMin = esEntero(b.duracionMin, DURACION_MIN, DURACION_MAX);
  if (duracionMin == null) return { ok: false, error: 'De 30 minutos a 24 horas.' };

  const lugarTipo: LugarTipo = b.lugarTipo === 'direccion' ? 'direccion' : 'link';
  let lugar = '';
  const lugarCrudo = typeof b.lugar === 'string' ? b.lugar.trim() : '';
  if (lugarCrudo) {
    if (lugarTipo === 'link') {
      const link = linkDeLugar(lugarCrudo);
      if (!link) return { ok: false, error: 'Ese link no es una dirección web.' };
      lugar = link;
    } else {
      lugar = sanearTexto(lugarCrudo, { unaLinea: true });
      if (lugar.length > TOPE_DIRECCION) return { ok: false, error: 'La dirección es muy larga.' };
    }
  }

  const acc = sanearAcceso(b.acceso);
  if (!acc.ok) return acc;
  const rec = sanearRecurrencia(b.recurrencia, fecha);
  if (!rec.ok) return rec;

  return {
    ok: true,
    evento: {
      titulo, descripcion, fecha: fechaTexto(fecha), hora: `${pad(hora.h)}:${pad(hora.min)}`, zona,
      inicioMs: instanteDe(zona, fecha.y, fecha.m, fecha.d, hora.h, hora.min).getTime(),
      duracionMin, lugarTipo, lugar, portada: saneaPortada(b.portada), acceso: acc.acceso, recurrencia: rec.recurrencia,
    },
  };
}

// ── El acceso de quien mira ───────────────────────────────────────────────────────

/** Quién mira, para el acceso: el equipo entra a todo; un alumno, según su nivel y sus módulos. */
export type QuienMira = { equipo: boolean; nivel: number; tieneModulo: (clave: string) => boolean };

/**
 * ¿Entra? `acceso` en `null` (uno guardado que no se pudo leer) deja afuera a los alumnos: un
 * evento restringido que se leyó mal no se abre (ver `accesoGuardado`).
 */
export function accesoPermite(acceso: AccesoEvento | null, q: QuienMira): boolean {
  if (q.equipo) return true;
  if (!acceso) return false;
  if (acceso.tipo === 'todos') return true;
  if (acceso.tipo === 'nivel') return q.nivel >= acceso.nivel;
  return q.tieneModulo(acceso.clave);
}

/** El motivo, corto, de por qué está cerrado. Es lo único del evento que se dice de él (además del título y la hora). */
export function motivoBloqueo(acceso: AccesoEvento | null, nombreModulo?: string | null): string {
  if (!acceso) return 'Cerrado';
  if (acceso.tipo === 'nivel') return `Desde el nivel ${acceso.nivel}`;
  if (acceso.tipo === 'modulo') return nombreModulo ? `Con el módulo «${nombreModulo}»` : 'Con un módulo del curso';
  return '';
}

// ── El texto de la serie ──────────────────────────────────────────────────────────

export const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «Cada semana: lun, mié · 10 veces». Corto: es una línea debajo de la hora. */
export function textoRecurrencia(r: Recurrencia | null, inicio: Fecha | null): string | null {
  if (!r) return null;
  let base: string;
  if (r.frecuencia === 'diaria') base = r.cada === 1 ? 'Cada día' : `Cada ${r.cada} días`;
  else if (r.frecuencia === 'semanal') {
    const dias = r.dias.map((d) => DIAS_CORTOS[d]).join(', ');
    base = `${r.cada === 1 ? 'Cada semana' : `Cada ${r.cada} semanas`}: ${dias}`;
  } else base = `${r.cada === 1 ? 'Cada mes' : `Cada ${r.cada} meses`}, el día ${inicio?.d ?? '?'}`;
  if (r.fin.tipo === 'veces') return `${base} · ${r.fin.veces} ${r.fin.veces === 1 ? 'vez' : 'veces'}`;
  if (r.fin.tipo === 'fecha') {
    const f = leerFecha(r.fin.fecha);
    return f ? `${base} · hasta el ${f.d} ${MESES_CORTOS[f.m - 1]} ${f.y}` : base;
  }
  return base;
}

// ── El .ics («Agregar a mi calendario») ──────────────────────────────────────────
// RFC 5545. Las líneas van con CRLF y se pliegan a 75 octetos; el texto escapa `\`, `;`, `,` y los
// saltos de línea. Se genera en el SERVER (lib/comunidad-calendario.ts) con lo que ese miembro puede
// ver: un evento cerrado para él no tiene .ics.

const CRLF = '\r\n';

/** El texto de una propiedad: la barra primero (si no, se escaparían los escapes). */
export function escaparIcs(s: string): string {
  return s.split('\\').join('\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Pliega una línea a 75 OCTETOS (no caracteres: una «ñ» son dos), sin partir un carácter por la
 * mitad. La continuación empieza con un espacio.
 */
export function plegar(linea: string): string {
  const enc = new TextEncoder();
  if (enc.encode(linea).length <= 75) return linea;
  const partes: string[] = [];
  let actual = '';
  let bytes = 0;
  for (const ch of linea) {
    const n = enc.encode(ch).length;
    const tope = partes.length === 0 ? 75 : 74;
    if (bytes + n > tope) { partes.push(actual); actual = ''; bytes = 0; }
    actual += ch;
    bytes += n;
  }
  partes.push(actual);
  return partes.join(`${CRLF} `);
}

const enUtc = (ms: number): string => {
  const d = new Date(ms);
  return `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
};
const enLocal = (f: Fecha, h: number, min: number): string => `${pad(f.y, 4)}${pad(f.m)}${pad(f.d)}T${pad(h)}${pad(min)}00`;

export type DatosIcs = {
  uid: string;
  titulo: string;
  descripcion: string;
  lugarTipo: LugarTipo;
  lugar: string;
  ahoraMs: number;
};

function cuerpoComun(d: DatosIcs): string[] {
  const out = [`UID:${d.uid}`, `DTSTAMP:${enUtc(d.ahoraMs)}`, `SUMMARY:${escaparIcs(d.titulo)}`];
  const desc = [d.descripcion, d.lugarTipo === 'link' && d.lugar ? d.lugar : ''].filter(Boolean).join('\n\n');
  if (desc) out.push(`DESCRIPTION:${escaparIcs(desc)}`);
  if (d.lugar) out.push(`LOCATION:${escaparIcs(d.lugar)}`);
  if (d.lugarTipo === 'link' && d.lugar) out.push(`URL:${d.lugar}`);
  return out;
}

function calendario(lineas: string[]): string {
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MaKo//Comunidad//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    ...lineas, 'END:VCALENDAR',
  ].map(plegar).join(CRLF) + CRLF;
}

/**
 * UNA ocurrencia, en UTC (`Z`). Sin zona que interpretar: cualquier calendario la pone en su lugar.
 */
export function icsDeOcurrencia(d: DatosIcs & { inicioMs: number; finMs: number }): string {
  return calendario(['BEGIN:VEVENT', ...cuerpoComun(d), `DTSTART:${enUtc(d.inicioMs)}`, `DTEND:${enUtc(d.finMs)}`, 'END:VEVENT']);
}

// La zona de la serie, para el VTIMEZONE: los cambios de horario reales, medidos con Intl.
const formatos = new Map<string, Intl.DateTimeFormat>();
function desvioMin(zona: string, ms: number): number {
  let f = formatos.get(zona);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    formatos.set(zona, f);
  }
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(new Date(ms))) p[x.type] = x.value;
  const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second));
  return Math.round((local - Math.floor(ms / 1000) * 1000) / 60_000);
}

const textoDesvio = (min: number): string => {
  const s = min < 0 ? '-' : '+';
  const a = Math.abs(min);
  return `${s}${pad(Math.floor(a / 60))}${pad(a % 60)}`;
};

/** Los cambios de horario de `zona` entre dos instantes: muestreo de a 12 h y búsqueda al minuto. */
export function cambiosDeHorario(zona: string, desdeMs: number, hastaMs: number): Array<{ ms: number; de: number; a: number }> {
  const paso = 12 * 3_600_000;
  const out: Array<{ ms: number; de: number; a: number }> = [];
  let t = desdeMs;
  let antes = desvioMin(zona, t);
  while (t < hastaMs) {
    const sig = Math.min(t + paso, hastaMs);
    const despues = desvioMin(zona, sig);
    if (despues !== antes) {
      let lo = t, hi = sig;
      while (hi - lo > 60_000) {
        const mid = lo + Math.floor((hi - lo) / 2 / 60_000) * 60_000;
        if (mid <= lo) break;
        if (desvioMin(zona, mid) === antes) lo = mid; else hi = mid;
      }
      out.push({ ms: hi, de: antes, a: despues });
      antes = despues;
    }
    t = sig;
  }
  return out;
}

/**
 * El VTIMEZONE de la serie: un tramo por cada cambio de horario real en su rango (sin RRULE: cada
 * tramo con su DTSTART). Es lo que deja escribir el DTSTART con TZID sin depender de que el
 * calendario del alumno conozca el nombre IANA.
 */
function vtimezone(zona: string, desdeMs: number, hastaMs: number): string[] {
  const cambios = cambiosDeHorario(zona, desdeMs, hastaMs);
  const inicial = desvioMin(zona, desdeMs);
  const todos = [inicial, ...cambios.map((c) => c.a)];
  const minimo = Math.min(...todos);
  const tramo = (dtstart: string, de: number, a: number) => [
    a > minimo ? 'BEGIN:DAYLIGHT' : 'BEGIN:STANDARD',
    `DTSTART:${dtstart}`, `TZOFFSETFROM:${textoDesvio(de)}`, `TZOFFSETTO:${textoDesvio(a)}`,
    a > minimo ? 'END:DAYLIGHT' : 'END:STANDARD',
  ];
  const out = ['BEGIN:VTIMEZONE', `TZID:${zona}`, ...tramo('19700101T000000', inicial, inicial)];
  for (const c of cambios) {
    // El DTSTART de un tramo es la hora LOCAL del cambio, contada con el desvío de ANTES (RFC 5545).
    const local = deUtc(c.ms + c.de * 60_000);
    const d = new Date(c.ms + c.de * 60_000);
    out.push(...tramo(enLocal(local, d.getUTCHours(), d.getUTCMinutes()), c.de, c.a));
  }
  out.push('END:VTIMEZONE');
  return out;
}

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** La regla de la serie en RRULE. El UNTIL va en UTC (lo exige el RFC con un DTSTART con TZID). */
export function rruleDe(r: Recurrencia, zona: string, inicio: { fecha: Fecha; h: number; min: number }): string {
  const partes = [`FREQ=${r.frecuencia === 'diaria' ? 'DAILY' : r.frecuencia === 'semanal' ? 'WEEKLY' : 'MONTHLY'}`];
  if (r.cada > 1) partes.push(`INTERVAL=${r.cada}`);
  if (r.frecuencia === 'semanal') partes.push(`BYDAY=${r.dias.map((d) => BYDAY[d]).join(',')}`, 'WKST=MO');
  if (r.frecuencia === 'mensual') partes.push(`BYMONTHDAY=${inicio.fecha.d}`);
  if (r.fin.tipo === 'veces') partes.push(`COUNT=${r.fin.veces}`);
  if (r.fin.tipo === 'fecha') {
    const f = leerFecha(r.fin.fecha);
    if (f) partes.push(`UNTIL=${enUtc(instanteDe(zona, f.y, f.m, f.d, inicio.h, inicio.min).getTime())}`);
  }
  return `RRULE:${partes.join(';')}`;
}

/**
 * La SERIE entera: DTSTART con su zona, la RRULE, las fechas borradas (EXDATE) y el VTIMEZONE con los
 * cambios de horario de su rango. Las ocurrencias movidas («editar este evento») son eventos aparte y
 * no van acá: en la serie quedan como borradas.
 */
export function icsDeSerie(d: DatosIcs & { serie: SerieEvento }): string {
  const s = d.serie;
  const ini = localDe(s.inicioMs, s.zona);
  const r = s.recurrencia;
  // El rango del VTIMEZONE: hasta el fin de la serie (o la última de «N veces»), y 5 años si no termina.
  let hasta = s.inicioMs + 5 * 366 * 86_400_000;
  if (r?.fin.tipo === 'fecha') {
    const f = leerFecha(r.fin.fecha);
    if (f) hasta = instanteDe(s.zona, f.y, f.m, f.d, 23, 59).getTime() + 86_400_000;
  } else if (r?.fin.tipo === 'veces') {
    const todas = ocurrencias({ ...s, excepciones: [] }, s.inicioMs, s.inicioMs + 60 * 366 * 86_400_000, r.fin.veces);
    if (todas.length) hasta = todas[todas.length - 1].fin + 86_400_000;
  }
  hasta = Math.min(hasta, s.inicioMs + 10 * 366 * 86_400_000);
  const evento = [
    'BEGIN:VEVENT', ...cuerpoComun(d),
    `DTSTART;TZID=${s.zona}:${enLocal(ini.fecha, ini.h, ini.min)}`,
    `DURATION:PT${s.duracionMin}M`,
  ];
  if (r) evento.push(rruleDe(r, s.zona, ini));
  const exdates = s.excepciones.map(leerFecha).filter((f): f is Fecha => !!f).map((f) => enLocal(f, ini.h, ini.min));
  if (r && exdates.length) evento.push(`EXDATE;TZID=${s.zona}:${exdates.join(',')}`);
  evento.push('END:VEVENT');
  return calendario([...vtimezone(s.zona, s.inicioMs - 86_400_000, hasta), ...evento]);
}

/** El nombre del archivo: el título en minúsculas, sin acentos ni símbolos. */
export function nombreDeIcs(titulo: string): string {
  const base = titulo.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `${base || 'evento'}.ics`;
}
