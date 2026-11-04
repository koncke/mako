// =============================================================================
// automatizaciones-diseno — lo que dibuja la hoja Automatizaciones con su DISEÑO PROPIO (la copia de Noria), con los datos de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco» y «Después seguí con la segunda hoja, de a una». La copia y la adaptación están en
// docs/diseno/mockups-dashboard/automatizaciones-noria/; acá, de dónde sale cada número con los DATOS REALES: los componentes de la
// hoja (`hoja.diseno.piezas`, lib/graficos-plantillas-generales.ts, «automatizaciones»). La pregunta: «¿qué corrió, qué falló?».
//   · la cabecera: el saludo y la frase de cuántos mensajes salieron, cuántos no y cuántas veces te respondieron;
//   · «El pulso» («Run pulse»): los cuatro números (los mensajes, qué parte salió bien, la tasa de respuesta y las personas que
//     entraron, con las que siguen en el flujo) y, día por día, lo que salió y lo que falló, con la línea de hace una semana;
//   · «El recorrido» («Live now»): de entrar a responder, en cuatro pasos, cuánto tardan en responder y cómo terminaron;
//   · «Dónde falló» («Needs a look»): las automatizaciones con mensajes que no salieron;
//   · «Qué tan bien salen» («Reliability»): los últimos 14 días de cada automatización, en casillas;
//   · «Las que más mandan» («Busiest flows»): la tabla por automatización, con sus 14 días;
//   · «En cuántas horas responden» («Team activity»): cada automatización con lo que tardan en contestarle.
//
// LO QUE NORIA TIENE Y MaKo NO MIDE NO SE INVENTA: las horas de trabajo que ahorra cada automatización (pediría cuánto tardaría
// una persona: «Desk time saved»), la corrida en vivo paso por paso con sus milisegundos (MaKo guarda lo que mandó, no cuánto tardó
// cada paso), el pulso por HORA de hoy (las automatizaciones se leen por día), quién cambió qué en cada flujo, el estado «Live» de
// cada uno y el reintento de una corrida fallida (se revisa en Automations).
//
// Puro y sin `server-only`: lo usan la pantalla (app/dashboard/disenos/HojaAutomatizaciones.tsx) y el test. Lo que no llegó es
// `null`, nunca un cero.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import { OTROS, SIN_DATO, type Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';
import type { Trozo } from './comercial-diseno';
import { inicialesDe } from './chat-diseno';
import { cambioDe, entero, pasoDe, rotuloDia, type PasoTiempo } from './marketing-diseno';

export type { DatosPieza, Trozo };

const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const res = (datos: Record<string, DatosPieza>, id: string | undefined): Resultado | null => (id ? datos[id]?.resultado ?? null : null);
const col = (r: Resultado | null, metrica: string) => (r ? r.columnas.findIndex((c) => c.id === metrica) : -1);
const total = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && i >= 0 ? num(r.totales[i]) : null; };
const anteriorDe = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && r.anterior && i >= 0 ? num(r.anterior[i]) : null; };
const enFila = (r: Resultado, f: Resultado['filas'][number], metrica: string): number | null => { const i = col(r, metrica); return i >= 0 ? num(f.valores[i]) : null; };
const plural = (n: number, uno: string, varios: string) => `${entero(n)} ${n === 1 ? uno : varios}`;
/** Una parte, de 0 a 100, o null si no hay de dónde. */
const parte = (n: number | null, de: number | null) => (n != null && de != null && de > 0 ? (n / de) * 100 : null);

/** Un porcentaje con un decimal («96.4»), y 100 sin decimales: como Noria. */
export const conDecimal = (v: number) => (v >= 99.95 ? '100' : (Math.round(v * 10) / 10).toFixed(1));

export type Cambio = { cambio: string | null; sube: boolean | null };
function cambio(dif: 'pct' | 'puntos', actual: number | null, anterior: number | null): Cambio {
  const c = actual != null && anterior != null ? cambioDe(dif, actual, anterior) : null;
  return { cambio: c?.texto ?? null, sube: c ? (c.d > 0 ? true : c.d < 0 ? false : null) : null };
}
/** Qué parte salió bien: lo que salió sobre lo que se intentó (salió o falló). Un borrador, un simulado o una acción no cuentan. */
export const exitoDe = (enviados: number | null, fallaron: number | null) => (enviados != null && fallaron != null ? parte(enviados, enviados + fallaron) : null);

// ── la cabecera ─────────────────────────────────────────────────────────────────────────────────────────────────
/** «Salieron 1,240 mensajes. 12 no salieron y esperan que los mires. Te respondieron 84 veces.» */
export function fraseAutomatizaciones(enviados: number | null, fallaron: number | null, respuestas: number | null): Trozo[] {
  if (enviados == null) return [];
  if (enviados === 0 && !fallaron) return [{ tipo: 'texto', s: 'Tus automatizaciones no mandaron nada en este período.' }];
  const t: Trozo[] = [{ tipo: 'texto', s: 'Salieron ' }, { tipo: 'fuerte', s: plural(enviados, 'mensaje', 'mensajes') }, { tipo: 'texto', s: '. ' }];
  if (fallaron) t.push({ tipo: 'fuerte', s: `${entero(fallaron)} no ${fallaron === 1 ? 'salió' : 'salieron'}` }, { tipo: 'texto', s: ' y esperan que los mires.' });
  else if (fallaron === 0) t.push({ tipo: 'texto', s: 'Ninguno falló.' });
  if (respuestas) t.push({ tipo: 'texto', s: ' Te respondieron ' }, { tipo: 'fuerte', s: plural(respuestas, 'vez', 'veces') }, { tipo: 'texto', s: '.' });
  return t;
}

// ── los cuatro números ──────────────────────────────────────────────────────────────────────────────────────────
export type NumeroAuto = { valor: number | null; cambio: Cambio };
export type NumerosAuto = {
  mensajes: NumeroAuto;
  /** Qué parte salió bien (0-100), y cuántos no salieron. */
  exito: NumeroAuto & { fallaron: number | null };
  /** La tasa de respuesta de los mensajes (0-100). */
  respuesta: NumeroAuto;
  /** Las personas que entraron a una automatización, y las que siguen en el flujo. */
  entraron: NumeroAuto & { siguen: number | null };
};
export function numerosDe(ap: Resultado | null, resp: Resultado | null, entraron: Resultado | null, recorrido: Resultado | null): NumerosAuto {
  const env = total(ap, 'enviados'), fal = total(ap, 'fallaron');
  const exito = exitoDe(env, fal), exitoAntes = exitoDe(anteriorDe(ap, 'enviados'), anteriorDe(ap, 'fallaron'));
  const tr = total(resp, 'tasa_respuesta'), pe = total(entraron, 'personas');
  return {
    mensajes: { valor: env, cambio: cambio('pct', env, anteriorDe(ap, 'enviados')) },
    exito: { valor: exito, cambio: cambio('puntos', exito, exitoAntes), fallaron: fal },
    respuesta: { valor: tr, cambio: cambio('puntos', tr, anteriorDe(resp, 'tasa_respuesta')) },
    entraron: { valor: pe, cambio: cambio('pct', pe, anteriorDe(entraron, 'personas')), siguen: total(recorrido, 'en_curso') },
  };
}

// ── el pulso: día por día ───────────────────────────────────────────────────────────────────────────────────────
function masDias(clave: string, n: number): string {
  const d = new Date(`${clave.slice(0, 10)}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** ¿La fila contiene hoy? El día, la semana (de lunes) o el mes. */
function contieneHoy(clave: string, paso: PasoTiempo, hoy: string): boolean {
  return paso === 'dia' ? clave.slice(0, 10) === hoy : paso === 'mes' ? clave.slice(0, 7) === hoy.slice(0, 7) : clave.slice(0, 10) <= hoy && hoy < masDias(clave, 7);
}
/** El tope del eje con DOS pasos, como Noria (0 · 25 · 50): el primero «redondo» que deja todo adentro. */
export function topeDos(max: number): number {
  if (!(max > 0)) return 2;
  const base = 10 ** Math.floor(Math.log10(max / 2));
  for (const k of [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) if (k * base * 2 >= max) return Math.max(2, k * base * 2);
  return base * 20;
}
export type ColumnaPulso = { clave: string; rotulo: string; salieron: number; fallaron: number; ahora: boolean; antes: number | null };
export type PulsoAuto = {
  columnas: ColumnaPulso[];
  paso: PasoTiempo;
  tope: number;
  /** El nombre de la línea: «Hace una semana», «La semana anterior», «El mes anterior». */
  linea: string;
};
/**
 * Lo que salió y lo que falló, por columna. La línea es lo que se INTENTÓ (salió o falló) el mismo día de la semana anterior, si
 * va por días (Noria: «the same span a week earlier»); si va por semanas o meses, la columna anterior. Sale de las mismas filas:
 * las primeras columnas del período no tienen con qué compararse y la línea arranca después.
 */
export function pulsoDe(r: Resultado | null, hoy: string): PulsoAuto | null {
  if (!r || r.clase !== 'tiempo' || !r.filas.length) return null;
  const paso = pasoDe(r.filas.map((f) => f.clave));
  const intentos = new Map(r.filas.map((f) => [f.clave.slice(0, 10), (enFila(r, f, 'enviados') ?? 0) + (enFila(r, f, 'fallaron') ?? 0)] as const));
  const columnas = r.filas.map((f, i): ColumnaPulso => {
    const antes = paso === 'dia' ? intentos.get(masDias(f.clave, -7)) ?? null : i > 0 ? (intentos.get(r.filas[i - 1].clave.slice(0, 10)) ?? null) : null;
    return { clave: f.clave, rotulo: rotuloDia(f.clave, paso), salieron: enFila(r, f, 'enviados') ?? 0, fallaron: enFila(r, f, 'fallaron') ?? 0, ahora: contieneHoy(f.clave, paso, hoy), antes };
  });
  const max = Math.max(0, ...columnas.map((c) => Math.max(c.salieron + c.fallaron, c.antes ?? 0)));
  return { columnas, paso, tope: topeDos(max), linea: paso === 'dia' ? 'Hace una semana' : paso === 'semana' ? 'La semana anterior' : 'El mes anterior' };
}

// ── el recorrido ────────────────────────────────────────────────────────────────────────────────────────────────
export type PasoRecorrido = { id: 'entraron' | 'escritos' | 'respondieron' | 'siguen'; titulo: string; sub: string; n: number | null; pct: number | null };
export type DesenlaceAuto = { clave: string; nombre: string; personas: number; pct: number | null; respondio: boolean };
export type RecorridoAuto = {
  /** Cuántas automatizaciones mandaron algo en el período (las filas de la tabla). */
  automatizaciones: number | null;
  /** Qué parte de los que entraron respondió (0-100). */
  respondio: number | null;
  pasos: PasoRecorrido[];
  /** En cuántas horas responden, en promedio (`horas_respuesta`). */
  horas: number | null;
  desenlaces: DesenlaceAuto[];
};
export const FILAS_DESENLACE = 5;
export function recorridoDe(rec: Resultado | null, tabla: Resultado | null, horas: Resultado | null): RecorridoAuto {
  const pe = total(rec, 'personas'), re = total(rec, 'respondieron'), si = total(rec, 'en_curso'), le = total(tabla, 'leads');
  const pasos: PasoRecorrido[] = [
    { id: 'entraron', titulo: 'Entraron', sub: 'a una automatización', n: pe, pct: null },
    { id: 'escritos', titulo: 'Les escribió MaKo', sub: 'recibieron al menos un mensaje', n: le, pct: parte(le, pe) },
    { id: 'respondieron', titulo: 'Respondieron', sub: 'contestaron o pasaron a una persona', n: re, pct: parte(re, pe) },
    { id: 'siguen', titulo: 'Siguen en el flujo', sub: 'todavía les falta algún paso', n: si, pct: parte(si, pe) },
  ];
  const desenlaces = rec ? rec.filas.filter((f) => f.clave !== SIN_DATO && (enFila(rec, f, 'personas') ?? 0) > 0).slice(0, FILAS_DESENLACE).map((f) => {
    const n = enFila(rec, f, 'personas') ?? 0;
    return { clave: f.clave, nombre: f.etiqueta, personas: n, pct: parte(n, pe), respondio: (enFila(rec, f, 'respondieron') ?? 0) > 0 };
  }) : [];
  return { automatizaciones: tabla ? tabla.filas.filter((f) => f.clave !== SIN_DATO).length + (tabla.fuera ?? 0) : null, respondio: parte(re, pe), pasos, horas: total(horas, 'horas_respuesta'), desenlaces };
}

// ── dónde falló ─────────────────────────────────────────────────────────────────────────────────────────────────
export type FalloAuto = { clave: string; nombre: string; fallaron: number; envios: number | null; pct: number | null };
export const FILAS_FALLOS = 3;
export function fallosDe(r: Resultado | null, tabla: Resultado | null): { total: number | null; filas: FalloAuto[]; mas: number } {
  if (!r) return { total: null, filas: [], mas: 0 };
  const envios = new Map(tabla ? tabla.filas.map((f) => [f.clave, enFila(tabla, f, 'envios')] as const) : []);
  const todas = r.filas.filter((f) => f.clave !== OTROS && (enFila(r, f, 'fallaron') ?? 0) > 0).map((f) => {
    const n = enFila(r, f, 'fallaron') ?? 0, e = envios.get(f.clave) ?? null;
    return { clave: f.clave, nombre: f.clave === SIN_DATO ? 'Sin automatización' : f.etiqueta, fallaron: n, envios: e, pct: parte(n, e) };
  });
  return { total: total(r, 'fallaron'), filas: todas.slice(0, FILAS_FALLOS), mas: Math.max(0, todas.length - FILAS_FALLOS) + (r.fuera ?? 0) };
}

// ── los últimos 14 días de cada automatización ─────────────────────────────────────────────────────────────────
export const DIAS_CONFIABILIDAD = 14;
export const FILAS_CONFIABILIDAD = 7;
/** El color de una casilla: 1 = 99.5 %+, 2 = 98 %+, 3 = 95 %+, 4 = menos; 0 = ese día no mandó nada o no se sabe. */
export type Nivel = 0 | 1 | 2 | 3 | 4;
export const nivelDe = (pct: number | null): Nivel => (pct == null ? 0 : pct >= 99.5 ? 1 : pct >= 98 ? 2 : pct >= 95 ? 3 : 4);
export type DiaConf = { dia: string; envios: number; fallaron: number | null; nivel: Nivel };
export type FilaConf = { clave: string; nombre: string; dias: DiaConf[]; pct: number | null; envios: number[] };
/**
 * Dos piezas por día y por automatización (el cruce: `envios` y `fallaron`). Lo que salió bien un día es 1 − fallaron / envíos
 * (un envío es todo lo que la automatización hizo: un mensaje, un aviso, una acción). Las filas van en el orden de los envíos (las
 * que más mandan primero). ⚠️ El cruce de los fallos se ordena por los fallos: una automatización que no está entre sus columnas
 * no falló NADA si el cruce no tiene «Otros»; si lo tiene, no se sabe y la casilla queda gris.
 */
export function confiabilidadDe(vol: Resultado | null, fal: Resultado | null, hoy: string): FilaConf[] {
  if (!vol?.cruce || !vol.filas.length) return [];
  const dias = Array.from({ length: DIAS_CONFIABILIDAD }, (_, k) => masDias(hoy, k - DIAS_CONFIABILIDAD + 1));
  const filaVol = new Map(vol.filas.map((f, i) => [f.clave.slice(0, 10), i] as const));
  const filaFal = new Map((fal?.filas ?? []).map((f, i) => [f.clave.slice(0, 10), i] as const));
  const otrosFal = !!fal?.cruce?.claves.includes(OTROS);
  return vol.cruce.claves.filter((k) => k !== OTROS && k !== SIN_DATO).slice(0, FILAS_CONFIABILIDAD).map((k) => {
    const j = vol.cruce!.claves.indexOf(k), jf = fal?.cruce ? fal.cruce.claves.indexOf(k) : -1;
    let se = 0, sf = 0, sabe = !!fal?.cruce;
    const ds = dias.map((dia): DiaConf => {
      const i = filaVol.get(dia);
      const e = i == null ? 0 : num(vol.cruce!.celdas[i]?.[j]) ?? 0;
      const fi = filaFal.get(dia);
      const f = !fal?.cruce ? null : jf >= 0 ? (fi == null ? 0 : num(fal.cruce.celdas[fi]?.[jf]) ?? 0) : otrosFal ? null : 0;
      if (f == null) sabe = false;
      se += e; sf += f ?? 0;
      return { dia, envios: e, fallaron: f, nivel: e > 0 && f != null ? nivelDe(Math.max(0, 100 - (f / e) * 100)) : 0 };
    });
    return { clave: k, nombre: k, dias: ds, pct: sabe && se > 0 ? Math.max(0, 100 - (sf / se) * 100) : null, envios: ds.map((d) => d.envios) };
  });
}

// ── las que más mandan ──────────────────────────────────────────────────────────────────────────────────────────
export type FlujoAuto = {
  clave: string; nombre: string; iniciales: string;
  envios: number | null; fallaron: number | null; respuestas: number | null; tasaRespuesta: number | null;
  /** Qué parte salió bien: 1 − fallaron / envíos. */
  exito: number | null;
  /** Los envíos de sus últimos 14 días (de «Qué tan bien salen»), o null si no está entre las que se cruzan. */
  dias: number[] | null;
  sinNombre: boolean;
};
export const FILAS_FLUJOS = 6;
export function flujosDe(tabla: Resultado | null, conf: FilaConf[]): FlujoAuto[] {
  if (!tabla) return [];
  const dias = new Map(conf.map((c) => [c.clave, c.envios] as const));
  return tabla.filas.filter((f) => f.clave !== OTROS).slice(0, FILAS_FLUJOS).map((f) => {
    const sin = f.clave === SIN_DATO, nombre = sin ? 'Sin automatización' : f.etiqueta;
    const e = enFila(tabla, f, 'envios'), fa = enFila(tabla, f, 'fallaron');
    return {
      clave: f.clave, nombre, iniciales: sin ? '—' : inicialesDe(nombre), envios: e, fallaron: fa, respuestas: enFila(tabla, f, 'respuestas'),
      tasaRespuesta: enFila(tabla, f, 'tasa_respuesta'), exito: e != null && fa != null && e > 0 ? Math.max(0, 100 - (fa / e) * 100) : null,
      dias: dias.get(f.clave) ?? null, sinNombre: sin,
    };
  });
}

// ── en cuántas horas responden ──────────────────────────────────────────────────────────────────────────────────
export type HoraAuto = { clave: string; nombre: string; iniciales: string; horas: number; respondieron: number | null };
export const FILAS_HORAS = 6;
export function horasDe(r: Resultado | null): HoraAuto[] {
  if (!r) return [];
  return r.filas.filter((f) => f.clave !== OTROS && f.clave !== SIN_DATO).map((f) => ({ f, h: enFila(r, f, 'horas_respuesta') })).filter((x): x is { f: Resultado['filas'][number]; h: number } => x.h != null)
    .slice(0, FILAS_HORAS).map(({ f, h }) => ({ clave: f.clave, nombre: f.etiqueta, iniciales: inicialesDe(f.etiqueta), horas: h, respondieron: enFila(r, f, 'respondieron') }));
}
/** Unas horas, como se leen: «menos de 1 h», «3.2 h», «2.1 días». */
export function horasTexto(h: number | null): string | null {
  if (h == null || !(h >= 0)) return null;
  if (h < 1) return 'menos de 1 h';
  if (h < 48) return `${(Math.round(h * 10) / 10).toFixed(h < 10 ? 1 : 0)} h`;
  const d = Math.round((h / 24) * 10) / 10;
  return `${d.toFixed(d < 10 ? 1 : 0)} ${d === 1 ? 'día' : 'días'}`;
}

// ── la hoja entera ──────────────────────────────────────────────────────────────────────────────────────────────
export type VistaAutomatizaciones = {
  frase: Trozo[];
  numeros: NumerosAuto;
  pulso: PulsoAuto | null;
  recorrido: RecorridoAuto;
  fallos: { total: number | null; filas: FalloAuto[]; mas: number };
  confiabilidad: FilaConf[];
  flujos: FlujoAuto[];
  horas: HoraAuto[];
  /** Lo que no se pudo leer, por bloque: el bloque lo dice en vez de dibujar un cero. */
  problemas: Partial<Record<'numeros' | 'pulso' | 'recorrido' | 'fallos' | 'confiabilidad' | 'flujos' | 'horas', string>>;
};
export function vistaAutomatizaciones(hoja: Pick<Hoja, 'diseno'>, datos: Record<string, DatosPieza>, hoy: string): VistaAutomatizaciones {
  const p = hoja.diseno?.piezas ?? {};
  const err = (k: string | undefined) => (k ? datos[k]?.error : undefined);
  const problemas: VistaAutomatizaciones['problemas'] = {};
  if (err(p.apertura)) problemas.numeros = 'No pude leer lo que mandaron tus automatizaciones.';
  if (err(p.dias)) problemas.pulso = 'No pude leer los mensajes día por día.';
  if (err(p.recorrido)) problemas.recorrido = 'No pude leer a quién le escribieron.';
  if (err(p.fallos)) problemas.fallos = 'No pude leer qué falló.';
  if (err(p.vol) || err(p.fal)) problemas.confiabilidad = 'No pude leer los últimos 14 días.';
  if (err(p.tabla)) problemas.flujos = 'No pude leer tus automatizaciones.';
  if (err(p.horas)) problemas.horas = 'No pude leer en cuánto responden.';
  const ap = res(datos, p.apertura), tabla = res(datos, p.tabla);
  const confiabilidad = confiabilidadDe(res(datos, p.vol), res(datos, p.fal), hoy);
  return {
    frase: fraseAutomatizaciones(total(ap, 'enviados'), total(ap, 'fallaron'), total(ap, 'respuestas')),
    numeros: numerosDe(ap, res(datos, p.respuesta), res(datos, p.entraron), res(datos, p.recorrido)),
    pulso: pulsoDe(res(datos, p.dias), hoy),
    recorrido: recorridoDe(res(datos, p.recorrido), tabla, res(datos, p.horas)),
    fallos: fallosDe(res(datos, p.fallos), tabla),
    confiabilidad,
    flujos: flujosDe(tabla, confiabilidad),
    horas: horasDe(res(datos, p.horas)),
    problemas,
  };
}
