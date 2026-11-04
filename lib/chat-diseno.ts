// =============================================================================
// chat-diseno — lo que dibuja la hoja Chat Analyst con su DISEÑO PROPIO (la copia de Parley), con los datos de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco» y «Después seguí con la segunda hoja, de a una». La copia y la adaptación están en
// docs/diseno/mockups-dashboard/chat-parley/; acá, de dónde sale cada número con los DATOS REALES: los componentes de la hoja
// (`hoja.diseno.piezas`, lib/graficos-plantillas-analysts.ts, CHAT). La pregunta de la hoja es «¿cuánto tardamos en contestar?»:
//   · la cabecera: el saludo y, debajo, la frase de cuántas veces te escribieron y cuántas respondiste;
//   · la tarjeta naranja («Audience»): los mensajes recibidos, cuántos chats y su cambio; las columnas son los últimos días (o
//     semanas) del período, la más alta con su número;
//   · «Respondidos» («Delivery rate»): el porcentaje de veces que alguien respondió, en 40 casillas, y cuántos esperan hoy;
//   · «En 15 minutos» («Active campaigns»): cuántas veces se respondió en menos de 15 minutos, de cuántas;
//   · «Tiempo de respuesta» («Credits»): la mediana, su barra contra los 15 minutos de MaKo y el 10 % más lento (el p90);
//   · «Enviados» (la tarjeta oscura, «Messages sent»): lo que mandaste día por día, con el de hoy;
//   · «Por día» («Messages by month»): cada día, lo respondido y lo que quedó sin respuesta (rayado);
//   · «Por tipo» («Channel mix»): el reparto entre texto, audio, imagen… de lo recibido (o de lo enviado);
//   · «Por setter» («Top contacts»): cuántas veces le escribieron a cada uno y qué parte respondió en 15 minutos.
//
// LO QUE PARLEY TIENE Y MaKo NO HACE NO SE INVENTA: la proyección del mes en curso (la columna rayada de «Audience»), el «live»
// (no hay presencia: se dice cuántos mensajes llegaron hoy), los créditos y su recarga, ni el cambio de cada canal contra el mes
// pasado (el gráfico no compara fila por fila: se dice cuánto es cada uno).
//
// Puro y sin `server-only`: lo usan la pantalla (app/dashboard/disenos/HojaChat.tsx) y el test. Lo que no llegó es `null`, nunca
// un cero.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';
import type { Trozo } from './comercial-diseno';
import { cambioDe, entero, pasoDe, rotuloDia, type PasoTiempo } from './marketing-diseno';
import { escalaColumnas } from './landing-diseno';

export type { DatosPieza, Trozo };

const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const res = (datos: Record<string, DatosPieza>, id: string | undefined): Resultado | null => (id ? datos[id]?.resultado ?? null : null);
const col = (r: Resultado | null, metrica: string) => (r ? r.columnas.findIndex((c) => c.id === metrica) : -1);
const total = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && i >= 0 ? num(r.totales[i]) : null; };
const anteriorDe = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && r.anterior && i >= 0 ? num(r.anterior[i]) : null; };
const enFila = (r: Resultado, f: Resultado['filas'][number], metrica: string): number | null => { const i = col(r, metrica); return i >= 0 ? num(f.valores[i]) : null; };

/** Los 15 minutos de «Respondidos en 15 min» (`rapidos_15`, lib/graficos-fuentes-extra.ts): la meta es la de MaKo, no una inventada. */
export const META_MINUTOS = 15;

/** Un porcentaje como Parley: con un decimal («94.2»), y 100 sin decimales. Lo usan la frase y las casillas. */
export const conDecimal = (v: number) => (v >= 99.95 ? '100' : (Math.round(v * 10) / 10).toFixed(1));

export type Cambio = { cambio: string | null; sube: boolean | null };
function cambio(dif: 'pct' | 'puntos', actual: number | null, anterior: number | null): Cambio {
  const c = actual != null && anterior != null ? cambioDe(dif, actual, anterior) : null;
  return { cambio: c?.texto ?? null, sube: c ? (c.d > 0 ? true : c.d < 0 ? false : null) : null };
}

/** Un tiempo en minutos, como se lee: «menos de 1 min», «3 min», «5.4 h», «2.1 días». */
export function duracion(min: number | null): { n: string; u: string } | null {
  if (min == null || !(min >= 0)) return null;
  if (min < 1) return { n: '<1', u: 'min' };
  if (min < 60) return { n: String(Math.round(min)), u: 'min' };
  if (min < 48 * 60) { const h = Math.round((min / 60) * 10) / 10; return { n: h.toFixed(h < 10 ? 1 : 0), u: 'h' }; }
  const d = Math.round((min / 1440) * 10) / 10;
  return { n: d.toFixed(d < 10 ? 1 : 0), u: d === 1 ? 'día' : 'días' };
}
export const duracionTexto = (min: number | null) => { const d = duracion(min); return d ? `${d.n} ${d.u}` : null; };

// ── la cabecera ─────────────────────────────────────────────────────────────────────────────────────────────────
/** «Te escribieron 1,240 veces y respondiste el 94.2%, 3 pt más que el período anterior.» En UN renglón. */
export function fraseChat(turnos: number | null, respondidos: number | null, anterior: number | null): Trozo[] {
  if (turnos == null) return [];
  if (turnos === 0) return [{ tipo: 'texto', s: 'Nadie te escribió en este período.' }];
  const t: Trozo[] = [{ tipo: 'texto', s: 'Te escribieron ' }, { tipo: 'fuerte', s: `${entero(turnos)} ${turnos === 1 ? 'vez' : 'veces'}` }];
  if (respondidos != null) t.push({ tipo: 'texto', s: ' y respondiste el ' }, { tipo: 'fuerte', s: `${conDecimal(respondidos)}%` });
  const c = respondidos != null && anterior != null ? Math.round((respondidos - anterior) * 10) / 10 : null;
  if (c != null && c !== 0) t.push({ tipo: 'texto', s: ', ' }, { tipo: 'fuerte', s: `${Math.abs(c).toFixed(1)} pt ${c > 0 ? 'más' : 'menos'}` }, { tipo: 'texto', s: ' que el período anterior' });
  else if (c === 0) t.push({ tipo: 'texto', s: ', igual que el período anterior' });
  t.push({ tipo: 'texto', s: '.' });
  return t;
}

// ── el tiempo ───────────────────────────────────────────────────────────────────────────────────────────────────
function masDias(clave: string, n: number): string {
  const d = new Date(`${clave.slice(0, 10)}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** ¿La fila contiene hoy? El día, la semana (de lunes) o el mes. */
function contieneHoy(clave: string, paso: PasoTiempo, hoy: string): boolean {
  return paso === 'dia' ? clave.slice(0, 10) === hoy : paso === 'mes' ? clave.slice(0, 7) === hoy.slice(0, 7) : clave.slice(0, 10) <= hoy && hoy < masDias(clave, 7);
}
const INICIAL_MES = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
/** El rótulo corto de una columna: el día del mes («28»), o la inicial del mes. */
function corto(clave: string, paso: PasoTiempo): string {
  const d = new Date(`${clave.slice(0, 10)}T12:00:00Z`);
  return paso === 'mes' ? INICIAL_MES[d.getUTCMonth()] : String(d.getUTCDate());
}

// ── la tarjeta naranja: los recibidos ───────────────────────────────────────────────────────────────────────────
export type ColumnaHero = { clave: string; rotulo: string; corto: string; valor: number; ahora: boolean };
export type HeroChat = {
  total: number | null;
  cambio: Cambio;
  chats: number | null;
  /** Los recibidos de hoy (en lugar del «live»): null si el período no llega a hoy o va por semanas. */
  hoy: number | null;
  /** Las últimas columnas del período (ocho, como los meses de Parley). */
  columnas: ColumnaHero[];
  paso: PasoTiempo;
  /** La más alta, que lleva su número (el «386» de Parley); -1 sin columnas. */
  pico: number;
};
export const COLUMNAS_HERO = 8;
export function heroDe(recibidos: Resultado | null, chats: Resultado | null, dias: Resultado | null, hoy: string): HeroChat {
  const t = total(recibidos, 'recibidos');
  let columnas: ColumnaHero[] = [];
  let paso: PasoTiempo = 'dia';
  let deHoy: number | null = null;
  if (dias && dias.clase === 'tiempo' && dias.filas.length) {
    paso = pasoDe(dias.filas.map((f) => f.clave));
    const todas = dias.filas.map((f) => ({
      clave: f.clave, rotulo: rotuloDia(f.clave, paso), corto: corto(f.clave, paso), valor: enFila(dias, f, 'recibidos') ?? 0, ahora: contieneHoy(f.clave, paso, hoy),
    }));
    columnas = todas.slice(-COLUMNAS_HERO);
    const ultima = todas[todas.length - 1];
    if (paso === 'dia' && ultima?.ahora) deHoy = ultima.valor;
  }
  const max = Math.max(0, ...columnas.map((c) => c.valor));
  return {
    total: t, cambio: cambio('pct', t, anteriorDe(recibidos, 'recibidos')), chats: total(chats, 'chats'), hoy: deHoy, columnas, paso,
    pico: max > 0 ? columnas.findIndex((c) => c.valor === max) : -1,
  };
}

// ── las casillas: respondidos y en 15 minutos ───────────────────────────────────────────────────────────────────
export const CASILLAS = 40;
/** Cuántas de las 40 casillas se llenan (el 94.2 % de Parley son 38). */
export const casillasDe = (porcentaje: number | null) => (porcentaje == null ? 0 : Math.max(0, Math.min(CASILLAS, Math.round((porcentaje / 100) * CASILLAS))));

export type RespondidosChat = { pct: number | null; cambio: Cambio; esperando: number | null };
export function respondidosDe(ap: Resultado | null, esperando: Resultado | null): RespondidosChat {
  const p = total(ap, 'pct_respondidos');
  return { pct: p, cambio: cambio('puntos', p, anteriorDe(ap, 'pct_respondidos')), esperando: total(esperando, 'sin_responder') };
}

export type RapidosChat = { n: number | null; de: number | null; pct: number | null; cambio: Cambio };
export function rapidosDe(rapidos: Resultado | null, ap: Resultado | null): RapidosChat {
  const p = total(rapidos, 'pct_rapidos'), de = total(ap, 'turnos');
  // El número es el porcentaje por las veces: los dos vienen enteros del mismo conjunto, así que la cuenta da el conteo exacto.
  return { n: p != null && de != null ? Math.round((p / 100) * de) : null, de, pct: p, cambio: cambio('puntos', p, anteriorDe(rapidos, 'pct_rapidos')) };
}

// ── el tiempo de respuesta ──────────────────────────────────────────────────────────────────────────────────────
export type RespuestaChat = {
  mediana: number | null;
  p90: number | null;
  /** La barra: la mediana sobre los 15 minutos, de 0 a 1 (llena si los pasa). */
  relleno: number | null;
  pasa: boolean;
};
export function respuestaDe(mediana: Resultado | null, lento: Resultado | null): RespuestaChat {
  const m = total(mediana, 'mediana_respuesta');
  return { mediana: m, p90: total(lento, 'p90_respuesta'), relleno: m == null ? null : Math.min(1, m / META_MINUTOS), pasa: m != null && m > META_MINUTOS };
}

// ── la tarjeta oscura: los enviados ─────────────────────────────────────────────────────────────────────────────
export type EnviadosChat = {
  total: number | null;
  hoy: number | null;
  /** Por día (o por semana) del período, en orden; el último puede ser el de hoy (va por la mitad: se dibuja punteado). */
  puntos: Array<{ clave: string; rotulo: string; valor: number; ahora: boolean }>;
  paso: PasoTiempo;
};
export function enviadosDe(dias: Resultado | null, hoy: string): EnviadosChat | null {
  if (!dias || dias.clase !== 'tiempo' || !dias.filas.length) return null;
  const paso = pasoDe(dias.filas.map((f) => f.clave));
  const puntos = dias.filas.map((f) => ({ clave: f.clave, rotulo: rotuloDia(f.clave, paso), valor: enFila(dias, f, 'enviados') ?? 0, ahora: contieneHoy(f.clave, paso, hoy) }));
  const ultimo = puntos[puntos.length - 1];
  return { total: total(dias, 'enviados'), hoy: paso === 'dia' && ultimo?.ahora ? ultimo.valor : null, puntos, paso };
}

// ── por día: respondidos y sin respuesta ────────────────────────────────────────────────────────────────────────
export type ColumnaDia = { clave: string; rotulo: string; corto: string; turnos: number; respondidos: number; ahora: boolean };
export type DiasChat = { columnas: ColumnaDia[]; paso: PasoTiempo; tope: number; pasoEje: number; fuera: number };
export const COLUMNAS_DIAS = 12;
/** Las doce columnas (los doce meses de Parley): las últimas del período, cada una con lo respondido y lo que quedó sin respuesta. */
export function diasDe(r: Resultado | null, hoy: string): DiasChat | null {
  if (!r || r.clase !== 'tiempo' || !r.filas.length) return null;
  const paso = pasoDe(r.filas.map((f) => f.clave));
  const todas = r.filas.map((f) => {
    const turnos = enFila(r, f, 'turnos') ?? 0;
    // Nunca más respondidos que veces: un dato raro no dibuja una columna negativa.
    const respondidos = Math.min(turnos, enFila(r, f, 'respondidos') ?? 0);
    return { clave: f.clave, rotulo: rotuloDia(f.clave, paso), corto: corto(f.clave, paso), turnos, respondidos, ahora: contieneHoy(f.clave, paso, hoy) };
  });
  const columnas = todas.slice(-COLUMNAS_DIAS);
  const { tope, paso: pasoEje } = escalaColumnas(Math.max(0, ...columnas.map((c) => c.turnos)));
  return { columnas, paso, tope, pasoEje: pasoEje, fuera: todas.length - columnas.length };
}
/** Las mismas columnas, juntadas por semana (de lunes): el «2025» de Parley es acá «Semanas». Sólo si son días. */
export function porSemana(d: DiasChat, hoy: string): DiasChat {
  if (d.paso !== 'dia') return d;
  const lunes = (clave: string) => { const x = new Date(`${clave.slice(0, 10)}T12:00:00Z`); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
  const grupos = new Map<string, ColumnaDia>();
  for (const c of d.columnas) {
    const k = lunes(c.clave);
    const g = grupos.get(k) ?? { clave: k, rotulo: rotuloDia(k, 'semana'), corto: corto(k, 'semana'), turnos: 0, respondidos: 0, ahora: contieneHoy(k, 'semana', hoy) };
    g.turnos += c.turnos; g.respondidos += c.respondidos;
    grupos.set(k, g);
  }
  const columnas = [...grupos.values()];
  const { tope, paso } = escalaColumnas(Math.max(0, ...columnas.map((c) => c.turnos)));
  return { columnas, paso: 'semana', tope, pasoEje: paso, fuera: 0 };
}

// ── por tipo ────────────────────────────────────────────────────────────────────────────────────────────────────
export type ParteTipo = { clave: string; nombre: string; valor: number; pct: number; otros: boolean };
export type TiposChat = { recibidos: ParteTipo[]; enviados: ParteTipo[]; totales: { recibidos: number; enviados: number } };
/** Tres partes, como Parley (SMS, WhatsApp, Email): con más de tres tipos, los dos primeros y «Otros» con el resto. */
function partes(filas: Array<{ clave: string; nombre: string; valor: number }>): ParteTipo[] {
  const tot = filas.reduce((a, f) => a + f.valor, 0);
  if (!tot) return [];
  const orden = filas.filter((f) => f.valor > 0).sort((a, b) => b.valor - a.valor);
  const elegidas = orden.length <= 3 ? orden : orden.slice(0, 2);
  const resto = tot - elegidas.reduce((a, f) => a + f.valor, 0);
  const todas = [...elegidas.map((f) => ({ ...f, otros: false })), ...(resto > 0 ? [{ clave: 'Otros', nombre: 'Otros', valor: resto, otros: true }] : [])];
  return todas.map((x) => ({ ...x, pct: (x.valor / tot) * 100 }));
}
export function tiposDe(r: Resultado | null): TiposChat | null {
  if (!r || !r.filas.length) return null;
  const claves = r.cruce?.claves ?? [];
  const iRec = claves.indexOf('Recibido'), iEnv = claves.indexOf('Enviado');
  const de = (j: number) => (j < 0 || !r.cruce ? [] : r.filas.map((f, i) => ({ clave: f.clave, nombre: f.etiqueta === '(sin dato)' ? 'Sin tipo' : f.etiqueta, valor: num(r.cruce!.celdas[i]?.[j]) ?? 0 })));
  const rec = de(iRec), env = de(iEnv);
  return { recibidos: partes(rec), enviados: partes(env), totales: { recibidos: rec.reduce((a, f) => a + f.valor, 0), enviados: env.reduce((a, f) => a + f.valor, 0) } };
}

// ── por setter ──────────────────────────────────────────────────────────────────────────────────────────────────
export type SetterChat = { clave: string; nombre: string; iniciales: string; turnos: number; parte: number; rapidos: number | null; sinNombre: boolean };
export const FILAS_SETTERS = 5;
/** Las iniciales de un nombre («Ana Ruiz» → «AR»), por punto de código (un nombre que empieza con un emoji no se parte). */
export function inicialesDe(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const letra = (s: string) => Array.from(s)[0] ?? '';
  return (partes.length > 1 ? letra(partes[0]) + letra(partes[partes.length - 1]) : Array.from(partes[0] ?? '').slice(0, 2).join('')).toUpperCase();
}
export function settersDe(r: Resultado | null): SetterChat[] {
  if (!r || !r.filas.length) return [];
  const tot = total(r, 'turnos') ?? r.filas.reduce((a, f) => a + (enFila(r, f, 'turnos') ?? 0), 0);
  return r.filas
    .map((f) => {
      const sinNombre = f.etiqueta === '(sin dato)';
      const nombre = sinNombre ? 'Sin setter' : f.etiqueta;
      const turnos = enFila(r, f, 'turnos') ?? 0;
      return { clave: f.clave, nombre, iniciales: sinNombre ? '—' : inicialesDe(nombre), turnos, parte: tot ? (turnos / tot) * 100 : 0, rapidos: enFila(r, f, 'pct_rapidos'), sinNombre };
    })
    .filter((s) => s.turnos > 0)
    .sort((a, b) => b.turnos - a.turnos)
    .slice(0, FILAS_SETTERS);
}

// ── la hoja ─────────────────────────────────────────────────────────────────────────────────────────────────────
export type VistaChat = {
  frase: Trozo[];
  hero: HeroChat;
  respondidos: RespondidosChat;
  rapidos: RapidosChat;
  respuesta: RespuestaChat;
  enviados: EnviadosChat | null;
  dias: DiasChat | null;
  tipos: TiposChat | null;
  setters: SetterChat[];
  /** Lo que no se pudo leer, por parte (para decirlo en su tarjeta, nunca dibujar ceros). */
  fallos: Partial<Record<'hero' | 'respondidos' | 'rapidos' | 'respuesta' | 'enviados' | 'dias' | 'tipos' | 'setters', string>>;
};

export function vistaChat(hoja: Pick<Hoja, 'diseno'>, datos: Record<string, DatosPieza>, hoy: string): VistaChat {
  const p = hoja.diseno?.piezas ?? {};
  const ap = res(datos, p.apertura);
  const fallos: VistaChat['fallos'] = {};
  const err = (k: string | undefined) => (k ? datos[k]?.error : undefined);
  if (err(p.recibidos) || err(p.dias)) fallos.hero = 'No pude leer los mensajes recibidos.';
  if (err(p.apertura)) fallos.respondidos = 'No pude leer cuántas respondiste.';
  if (err(p.rapidos)) fallos.rapidos = 'No pude leer cuántas respondiste en 15 minutos.';
  if (err(p.mediana)) fallos.respuesta = 'No pude leer el tiempo de respuesta.';
  if (err(p.dias)) fallos.enviados = 'No pude leer los mensajes enviados.';
  if (err(p.respondidos)) fallos.dias = 'No pude leer los mensajes día por día.';
  if (err(p.tipos)) fallos.tipos = 'No pude leer qué tipo de mensajes hay.';
  if (err(p.setters)) fallos.setters = 'No pude leer los mensajes por setter.';
  return {
    frase: fraseChat(total(ap, 'turnos'), total(ap, 'pct_respondidos'), anteriorDe(ap, 'pct_respondidos')),
    hero: heroDe(res(datos, p.recibidos), res(datos, p.chats), res(datos, p.dias), hoy),
    respondidos: respondidosDe(ap, res(datos, p.esperando)),
    rapidos: rapidosDe(res(datos, p.rapidos), ap),
    respuesta: respuestaDe(res(datos, p.mediana), res(datos, p.lento)),
    enviados: enviadosDe(res(datos, p.dias), hoy),
    dias: diasDe(res(datos, p.respondidos), hoy),
    tipos: tiposDe(res(datos, p.tipos)),
    setters: settersDe(res(datos, p.setters)),
    fallos,
  };
}
