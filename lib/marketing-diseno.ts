// =============================================================================
// marketing-diseno — lo que dibuja la hoja Marketing con su DISEÑO PROPIO (la copia de Kestrel), con los datos de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco» y «Después seguí con la segunda hoja, de a una». La copia y la adaptación están en
// docs/diseno/mockups-dashboard/marketing-kestrel/; acá, de dónde sale cada número con los DATOS REALES: los componentes de la hoja
// (`hoja.diseno.piezas`, lib/graficos-plantillas.ts, MARKETING). La pregunta de la hoja es «¿cuánto cuesta una agenda y de qué
// anuncio vino?»:
//   · la cabecera: lo gastado, las agendas que trajo y lo que costó cada una (el «Realtime overview» de Kestrel);
//   · los seis números de Kestrel, con su cambio: costo por agenda, ROAS cobrado, agendas, gasto, CTR y costo por lead;
//   · «Trends»: cómo se movieron el gasto, los leads y las agendas contra la primera semana del período (ventanas de 7 días);
//   · la tabla con pestañas («Lead quality»): por anuncio, por campaña y día por día, con el costo por agenda marcado contra
//     el promedio (barata, en el promedio, cara, sin agendas);
//   · el bloque de Instagram: del anuncio a la página (impresiones, clics, cuántos llegan a la página) y los anuncios que más
//     agendas trajeron; el de X.com: qué red trae las agendas, en vivo de Meta.
//
// LO QUE KESTREL TIENE Y MaKo NO HACE NO SE INVENTA: el «Live» (los datos de Meta no son en tiempo real), la calidad de cada
// lead (MaKo no la puntúa: lo que se marca es el COSTO, que sí se mide), las búsquedas y las palabras clave, y los seguidores.
//
// Puro y sin `server-only`: lo usan la pantalla (app/dashboard/disenos/HojaMarketing.tsx) y el test. Lo que no llegó es `null`,
// nunca un cero.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';
import type { Trozo } from './comercial-diseno';

export type { DatosPieza, Trozo };

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const res = (datos: Record<string, DatosPieza>, id: string | undefined): Resultado | null => (id ? datos[id]?.resultado ?? null : null);
const col = (r: Resultado | null, metrica: string) => (r ? r.columnas.findIndex((c) => c.id === metrica) : -1);
/** El total de una métrica de la pieza, por su id (no por la posición: la pieza puede traer otras). */
const total = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && i >= 0 ? num(r.totales[i]) : null; };
const anteriorDe = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && r.anterior && i >= 0 ? num(r.anterior[i]) : null; };
const enFila = (r: Resultado, f: Resultado['filas'][number], metrica: string): number | null => { const i = col(r, metrica); return i >= 0 ? num(f.valores[i]) : null; };
const plural = (n: number, uno: string, varios: string) => `${n.toLocaleString('es-MX')} ${n === 1 ? uno : varios}`;
const signo = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '');

/** «US$8,840»; debajo de US$100, con centavos («US$14.40»): un costo por lead chico sin centavos no se distingue. */
export function plata(n: number): string {
  const a = Math.abs(n);
  return `${n < 0 ? '−' : ''}US$${a < 100 ? a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(a).toLocaleString('en-US')}`;
}
/** «US$2,460», siempre sin centavos: lo GASTADO (en una tabla, «US$83.00» se lee como un costo). */
export const plataEntera = (n: number) => `${n < 0 ? '−' : ''}US$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
/** «12,495», y lo grande en corto para un cambio («+12.3k»). */
export const entero = (n: number) => Math.round(n).toLocaleString('en-US');
export const corto = (n: number) => (Math.abs(n) >= 10_000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : entero(n));

// ── los seis números ─────────────────────────────────────────────────────────────────────────────────────────────
export type IdNumero = 'cpa' | 'roas' | 'agendas' | 'gasto' | 'ctr' | 'cpl';
export type NumeroMk = {
  id: IdNumero;
  titulo: string;
  /** El número como se dibuja («US$91», «3.4×»); null = no se pudo leer o no hay con qué calcularlo. */
  texto: string | null;
  valor: number | null;
  /** El cambio contra el período anterior, en la unidad que se lee («−US$4», «+0.3×», «+9%», «−0.2 pt»). */
  cambio: string | null;
  /** Para dónde va la flecha. */
  sube: boolean | null;
  /** ¿El cambio es bueno? null = ni bueno ni malo (gastar más o menos no es, solo, ni una cosa ni la otra). */
  bueno: boolean | null;
};
const DEF_NUMERO: Record<IdNumero, { titulo: string; metrica: string; fmt: (v: number) => string; dif: 'plata' | 'veces' | 'pct' | 'puntos'; mejor: 'sube' | 'baja' | null }> = {
  cpa: { titulo: 'Costo por agenda', metrica: 'cpa', fmt: plata, dif: 'plata', mejor: 'baja' },
  roas: { titulo: 'ROAS cobrado', metrica: 'roas_cobrado', fmt: (v) => `${(Math.round(v * 10) / 10).toFixed(1)}×`, dif: 'veces', mejor: 'sube' },
  agendas: { titulo: 'Agendas', metrica: 'agendas', fmt: entero, dif: 'pct', mejor: 'sube' },
  gasto: { titulo: 'Gasto', metrica: 'gasto', fmt: plata, dif: 'pct', mejor: null },
  ctr: { titulo: 'CTR', metrica: 'ctr', fmt: (v) => `${(Math.round(v * 10) / 10).toFixed(1)}%`, dif: 'puntos', mejor: 'sube' },
  cpl: { titulo: 'Costo por lead', metrica: 'cpl', fmt: plata, dif: 'plata', mejor: 'baja' },
};
export const ORDEN_NUMEROS: readonly IdNumero[] = ['cpa', 'roas', 'agendas', 'gasto', 'ctr', 'cpl'];

/** El cambio de un número en SU unidad: lo que es plata o veces se resta; lo que se cuenta, en %; un porcentaje, en puntos. */
export function cambioDe(dif: 'plata' | 'veces' | 'pct' | 'puntos', actual: number, anterior: number): { texto: string; d: number } | null {
  const d = actual - anterior;
  if (dif === 'pct') {
    if (!anterior) return null;
    const p = Math.round((d / Math.abs(anterior)) * 100);
    return { texto: `${signo(p)}${Math.abs(p)}%`, d: p };
  }
  if (dif === 'veces') { const r = Math.round(d * 10) / 10; return { texto: `${signo(r)}${Math.abs(r).toFixed(1)}×`, d: r }; }
  if (dif === 'puntos') { const r = Math.round(d * 10) / 10; return { texto: `${signo(r)}${Math.abs(r).toFixed(1)} pt`, d: r }; }
  const a = Math.abs(d), r = a < 100 ? Math.round(a * 100) / 100 : Math.round(a);
  return { texto: `${signo(d === 0 || r === 0 ? 0 : d)}${plata(r)}`, d: r === 0 ? 0 : d };
}

export function numeroDe(id: IdNumero, r: Resultado | null): NumeroMk {
  const def = DEF_NUMERO[id];
  const valor = total(r, def.metrica), ant = anteriorDe(r, def.metrica);
  const c = valor != null && ant != null ? cambioDe(def.dif, valor, ant) : null;
  const sube = c ? (c.d > 0 ? true : c.d < 0 ? false : null) : null;
  const bueno = sube == null || def.mejor == null ? null : def.mejor === 'sube' ? sube : !sube;
  return { id, titulo: def.titulo, valor, texto: valor != null ? def.fmt(valor) : null, cambio: c?.texto ?? null, sube, bueno };
}

// ── la frase de arriba ───────────────────────────────────────────────────────────────────────────────────────────
/**
 * «Gastaste US$2,460 en anuncios, trajeron 27 agendas y cada una costó US$91.11.» En UN renglón, como el de Kestrel: el cambio del
 * costo contra el período anterior ya está en su número (el primero de los seis), y repetido acá la frase pasaba a dos renglones.
 */
export function fraseMarketing(gasto: number | null, agendas: number | null, cpa: number | null): Trozo[] {
  if (gasto == null && agendas == null) return [];
  const t: Trozo[] = [];
  if (gasto != null) t.push({ tipo: 'texto', s: 'Gastaste ' }, { tipo: 'fuerte', s: plataEntera(gasto) }, { tipo: 'texto', s: ' en anuncios' });
  if (agendas != null) {
    if (agendas === 0) t.push({ tipo: 'texto', s: t.length ? ' y no trajeron agendas' : 'No llegaron agendas' });
    else t.push({ tipo: 'texto', s: t.length ? (cpa != null ? ', trajeron ' : ' y trajeron ') : 'Llegaron ' }, { tipo: 'fuerte', s: plural(agendas, 'agenda', 'agendas') });
  }
  if (cpa != null && agendas) t.push({ tipo: 'texto', s: ' y cada una costó ' }, { tipo: 'fuerte', s: plata(cpa) });
  t.push({ tipo: 'texto', s: '.' });
  return t;
}

// ── Trends ───────────────────────────────────────────────────────────────────────────────────────────────────────
export type PasoTiempo = 'dia' | 'semana' | 'mes';
export type SerieTendencia = { id: 'gasto' | 'leads' | 'agendas'; nombre: string; color: 's1' | 's2' | 's3'; pct: Array<number | null>; fin: number | null };
export type Tendencias = {
  x: Array<{ clave: string; rotulo: string }>;
  /** Las que se pudieron indexar (con algo en la primera ventana). */
  series: SerieTendencia[];
  /** Las que no: «Agendas» si la primera semana no tuvo ninguna (un % contra cero no existe). */
  sinBase: string[];
  /** El tope del eje, simétrico (±20%, ±50%…). */
  tope: number;
  /** De a cuántas filas se suma cada punto (7 días; de a una si las filas ya son semanas o meses). */
  ventana: number;
  paso: PasoTiempo;
  /** Las filas tal cual (para la tabla de «Table» y la pestaña día por día). */
  filas: Array<{ clave: string; rotulo: string; gasto: number | null; leads: number | null; agendas: number | null }>;
};
const SERIES: ReadonlyArray<{ id: SerieTendencia['id']; nombre: string; color: SerieTendencia['color'] }> = [
  { id: 'gasto', nombre: 'Gasto', color: 's1' }, { id: 'leads', nombre: 'Leads', color: 's2' }, { id: 'agendas', nombre: 'Agendas', color: 's3' },
];
const fecha = (clave: string) => new Date(`${clave.slice(0, 10)}T12:00:00Z`);
export const rotuloDia = (clave: string, paso: PasoTiempo = 'dia') => {
  const d = fecha(clave);
  return paso === 'mes' ? `${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}` : `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
};
/** Si las filas son días, semanas o meses: lo dice la distancia entre las dos primeras. */
export function pasoDe(claves: readonly string[]): PasoTiempo {
  if (claves.length < 2) return 'dia';
  const dias = Math.round((fecha(claves[1]).getTime() - fecha(claves[0]).getTime()) / 864e5);
  return dias >= 28 ? 'mes' : dias >= 7 ? 'semana' : 'dia';
}
const TOPES = [10, 20, 25, 50, 100, 200, 500, 1000];

export function tendenciasDe(r: Resultado | null): Tendencias | null {
  if (!r || r.clase !== 'tiempo' || !r.filas.length) return null;
  const filas = r.filas.map((f) => ({ clave: f.clave, gasto: enFila(r, f, 'gasto'), leads: enFila(r, f, 'leads'), agendas: enFila(r, f, 'agendas') }));
  const paso = pasoDe(filas.map((f) => f.clave));
  const ventana = paso === 'dia' && filas.length >= 21 ? 7 : 1;
  const n = filas.length;
  const series: SerieTendencia[] = [], sinBase: string[] = [];
  for (const s of SERIES) {
    const v = filas.map((f) => f[s.id] ?? 0);
    const suma = (i: number) => v.slice(i - ventana + 1, i + 1).reduce((a, b) => a + b, 0);
    const base = n >= ventana ? suma(ventana - 1) : 0;
    if (!base) { sinBase.push(s.nombre); continue; }
    const pct = v.map((_, i) => (i < ventana - 1 ? null : Math.round(((suma(i) - base) / base) * 1000) / 10));
    series.push({ ...s, pct, fin: pct[n - 1] });
  }
  const max = Math.max(0, ...series.flatMap((s) => s.pct.map((p) => Math.abs(p ?? 0))));
  const tope = TOPES.find((t) => t >= max) ?? Math.ceil(max / 1000) * 1000;
  return {
    x: filas.map((f) => ({ clave: f.clave, rotulo: rotuloDia(f.clave, paso) })),
    series, sinBase, tope, ventana, paso,
    filas: filas.map((f) => ({ ...f, rotulo: rotuloDia(f.clave, paso) })),
  };
}

// ── la tabla con pestañas ────────────────────────────────────────────────────────────────────────────────────────
export type Veredicto = 'barata' | 'media' | 'cara' | 'sin-agendas';
export type FilaCosto = {
  clave: string; nombre: string; segunda: string | null;
  gasto: number | null; leads: number | null; agendas: number | null; cpa: number | null;
  veredicto: Veredicto | null; porque: string | null;
  /** La fila de hoy (día por día): va con el punto y en negrita, como el «Today» de Kestrel. */
  hoy: boolean;
  /** Si la fila abre algo (el anuncio, la campaña). */
  abre: boolean;
};
export type Pestana = { id: 'anuncios' | 'campanas' | 'tiempo'; nombre: string; columna: string; segunda: string; filas: FilaCosto[]; promedio: number | null; vacio: string };

/** Contra el promedio de lo que se mira: hasta 20 % debajo es barata; 25 % arriba, cara. Gastar sin agendas es lo peor. */
export function veredictoDe(gasto: number | null, agendas: number | null, cpa: number | null, promedio: number | null): { v: Veredicto | null; porque: string | null } {
  if (gasto != null && gasto > 0 && agendas === 0) return { v: 'sin-agendas', porque: `Gastó ${plataEntera(gasto)} y no trajo agendas` };
  if (cpa == null) return { v: null, porque: null };
  if (promedio == null || promedio <= 0) return { v: 'media', porque: null };
  const r = cpa / promedio, p = Math.round(Math.abs(r - 1) * 100);
  if (r <= 0.8) return { v: 'barata', porque: `${p}% más barata que el promedio (${plata(promedio)})` };
  if (r >= 1.25) return { v: 'cara', porque: `${p}% más cara que el promedio (${plata(promedio)})` };
  return { v: 'media', porque: `Cerca del promedio (${plata(promedio)})` };
}
const filaDe = (r: Resultado, f: Resultado['filas'][number], promedio: number | null, segunda: string | null, abre: boolean, hoy = false): FilaCosto => {
  const gasto = enFila(r, f, 'gasto'), leads = enFila(r, f, 'leads'), agendas = enFila(r, f, 'agendas');
  const cpa = enFila(r, f, 'cpa') ?? (gasto != null && agendas ? gasto / agendas : null);
  const { v, porque } = veredictoDe(gasto, agendas, cpa, promedio);
  return { clave: f.clave, nombre: f.etiqueta, segunda, gasto, leads, agendas, cpa, veredicto: v, porque, hoy, abre };
};
const promedioDe = (r: Resultado | null) => total(r, 'cpa') ?? ((g, a) => (g != null && a ? g / a : null))(total(r, 'gasto'), total(r, 'agendas'));

export function pestanasDe(anuncios: Resultado | null, campanas: Resultado | null, tendencias: Tendencias | null, hoy: string): Pestana[] {
  const out: Pestana[] = [];
  const pa = promedioDe(anuncios);
  out.push({
    id: 'anuncios', nombre: 'Por anuncio', columna: 'Anuncio', segunda: 'Campaña', promedio: pa,
    filas: (anuncios?.filas ?? []).map((f) => filaDe(anuncios!, f, pa, f.extra?.campana ?? null, !!f.ref)),
    vacio: anuncios ? 'No hubo anuncios con gasto en este período.' : 'No pude leer los anuncios de Meta.',
  });
  const pc = promedioDe(campanas);
  out.push({
    id: 'campanas', nombre: 'Por campaña', columna: 'Campaña', segunda: 'Anuncios', promedio: pc,
    filas: (campanas?.filas ?? []).map((f) => { const n = enFila(campanas!, f, 'anuncios'); return filaDe(campanas!, f, pc, n != null ? plural(n, 'anuncio', 'anuncios') : null, false); }),
    vacio: campanas ? 'No hubo campañas con gasto en este período.' : 'No pude leer las campañas de Meta.',
  });
  // Día por día (o semana a semana, mes a mes: lo dicen las filas): las más nuevas primero, hasta 10 (las de Kestrel).
  const t = tendencias;
  const g = t ? t.filas.reduce((a, f) => a + (f.gasto ?? 0), 0) : 0, ag = t ? t.filas.reduce((a, f) => a + (f.agendas ?? 0), 0) : 0;
  const pt = ag ? g / ag : null;
  out.push({
    id: 'tiempo', nombre: t?.paso === 'mes' ? 'Mes a mes' : t?.paso === 'semana' ? 'Semana a semana' : 'Día por día', columna: t?.paso === 'mes' ? 'Mes' : t?.paso === 'semana' ? 'Semana' : 'Día', segunda: 'Leads', promedio: pt,
    filas: (t?.filas ?? []).slice(-10).reverse().map((f) => {
      const cpa = f.gasto != null && f.agendas ? f.gasto / f.agendas : null;
      const { v, porque } = veredictoDe(f.gasto, f.agendas, cpa, pt);
      const esHoy = t?.paso === 'dia' && f.clave.slice(0, 10) === hoy;
      return { clave: f.clave, nombre: esHoy ? 'Hoy' : f.rotulo, segunda: null, gasto: f.gasto, leads: f.leads, agendas: f.agendas, cpa, veredicto: v, porque, hoy: esHoy, abre: false };
    }),
    vacio: t ? 'No hubo gasto en este período.' : 'No pude leer la pauta día por día.',
  });
  return out;
}

// ── del anuncio a la página (el bloque de Instagram) ─────────────────────────────────────────────────────────────
export type Mosaico = { clave: string; nombre: string; agendas: number; imagen: string | null; iniciales: string };
export type EmbudoMk = {
  impresiones: { valor: number | null; cambio: string | null; sube: boolean | null };
  clics: { valor: number | null; cambio: string | null; sube: boolean | null };
  /** De cada 100 clics, cuántos llegaron a la página (el anillo). null sin vistas de la página o sin clics. */
  llega: number | null;
  filas: Array<{ nombre: string; valor: number | null }>;
  /** Los anuncios que más agendas trajeron (las «Top posts»), hasta 4. */
  mosaico: Mosaico[];
};
const absoluto = (actual: number | null, ant: number | null) => {
  if (actual == null || ant == null) return { cambio: null, sube: null };
  const d = actual - ant;
  return { cambio: d === 0 ? '0' : `${signo(d)}${corto(Math.abs(d))}`, sube: d > 0 ? true : d < 0 ? false : null };
};
export const inicialesDe = (s: string) => {
  const p = s.split(/[\s·|\-_/]+/).filter((x) => /[\p{L}\p{N}]/u.test(x));
  return ((p[0]?.match(/[\p{L}\p{N}]/u)?.[0] ?? '') + (p[1]?.match(/[\p{L}\p{N}]/u)?.[0] ?? '')).toUpperCase() || '·';
};

export function embudoDe(r: Resultado | null, anuncios: Resultado | null): EmbudoMk | null {
  if (!r) return null;
  const imp = total(r, 'impresiones'), cl = total(r, 'clics'), vl = total(r, 'vistas_landing');
  const llega = vl != null && cl ? Math.round((vl / cl) * 100) : null;
  const ordenados = (anuncios?.filas ?? []).filter((f) => (enFila(anuncios!, f, 'agendas') ?? 0) > 0);
  return {
    impresiones: { valor: imp, ...absoluto(imp, anteriorDe(r, 'impresiones')) },
    clics: { valor: cl, ...absoluto(cl, anteriorDe(r, 'clics')) },
    llega,
    filas: [
      { nombre: 'Vistas de la landing', valor: vl },
      { nombre: 'Vistas del VSL', valor: total(r, 'vistas_vsl') },
      { nombre: 'Leads', valor: total(r, 'leads') },
      { nombre: 'Agendas', valor: total(r, 'agendas') },
    ],
    mosaico: ordenados.slice(0, 4).map((f) => ({ clave: f.clave, nombre: f.etiqueta, agendas: enFila(anuncios!, f, 'agendas') ?? 0, imagen: f.imagen ?? null, iniciales: inicialesDe(f.etiqueta) })),
  };
}

// ── qué red trae agendas (el bloque de X.com) ────────────────────────────────────────────────────────────────────
export type RedesMk = { agendas: number | null; redes: Array<{ clave: string; nombre: string; agendas: number }>; filas: Array<{ nombre: string; texto: string | null }> };
export function redesDe(r: Resultado | null): RedesMk | null {
  if (!r) return null;
  const ctr = total(r, 'ctr'), cpm = total(r, 'cpm'), imp = total(r, 'impresiones');
  return {
    agendas: total(r, 'agendas'),
    redes: r.filas.map((f) => ({ clave: f.clave, nombre: f.etiqueta, agendas: enFila(r, f, 'agendas') ?? 0 })).slice(0, 6),
    filas: [
      { nombre: 'Impresiones', texto: imp != null ? entero(imp) : null },
      { nombre: 'CTR', texto: ctr != null ? `${(Math.round(ctr * 10) / 10).toFixed(1)}%` : null },
      { nombre: 'Costo por mil', texto: cpm != null ? plata(cpm) : null },
    ],
  };
}

// ── todo junto ───────────────────────────────────────────────────────────────────────────────────────────────────
export type VistaMarketing = {
  frase: Trozo[];
  numeros: NumeroMk[];
  tendencias: Tendencias | null;
  pestanas: Pestana[];
  embudo: EmbudoMk | null;
  redes: RedesMk | null;
  /** Lo que no se pudo leer, por pieza (para decirlo en su tarjeta, nunca dibujar ceros). */
  fallos: Partial<Record<'tendencias' | 'embudo' | 'redes', string>>;
};

export function vistaMarketing(hoja: Pick<Hoja, 'diseno'>, datos: Record<string, DatosPieza>, hoy: string): VistaMarketing {
  const p = hoja.diseno?.piezas ?? {};
  const ap = res(datos, p.apertura);
  const tend = tendenciasDe(res(datos, p.tendencias));
  const anuncios = res(datos, p.anuncios);
  const fallos: VistaMarketing['fallos'] = {};
  const err = (k: string | undefined) => (k ? datos[k]?.error : undefined);
  if (err(p.tendencias)) fallos.tendencias = 'No pude leer la pauta día por día.';
  if (err(p.funnel)) fallos.embudo = 'No pude leer el camino del anuncio a la página.';
  if (err(p.plataforma)) fallos.redes = 'No pude leer las redes de Meta.';
  return {
    frase: fraseMarketing(total(ap, 'gasto'), total(ap, 'agendas'), total(ap, 'cpa')),
    numeros: ORDEN_NUMEROS.map((id) => numeroDe(id, res(datos, p[id]))),
    tendencias: tend,
    pestanas: pestanasDe(anuncios, res(datos, p.campanas), tend, hoy),
    embudo: embudoDe(res(datos, p.funnel), anuncios),
    redes: redesDe(res(datos, p.plataforma)),
    fallos,
  };
}
