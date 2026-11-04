// =============================================================================
// cs-diseno — lo que dibuja la hoja CS Analyst con su DISEÑO PROPIO (la copia de Mender), con los datos de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco» y «Después seguí con la segunda hoja, de a una». La copia y la adaptación están en
// docs/diseno/mockups-dashboard/cs-mender/; acá, de dónde sale cada número con los DATOS REALES: los componentes de la hoja
// (`hoja.diseno.piezas`, lib/graficos-plantillas-analysts.ts, «cs-analyst»). La pregunta: «¿quién necesita atención?».
//   · la cabecera: la frase de cuántos clientes piden atención, cuánto deben vencido y cuántas sesiones tuvieron;
//   · «Tu cartera por etapa» («Case pipeline»): un carril por etapa de la entrega, con cada cliente, su señal (el aro coral
//     cuando pide atención), su último contacto y «Debe» cuando tiene cuotas vencidas. Las pestañas filtran los carriles;
//   · «Por qué piden atención» («Top case drivers»): el anillo de los motivos de la señal, o de la señal de toda la cartera;
//   · «Cómo está la cartera» («Case health»): tres medidores — hablaron hace poco, sin pedir atención y siguen contigo.
//
// LO QUE MENDER TIENE Y MaKo NO MIDE NO SE INVENTA: el tiempo de primera respuesta de un caso, la satisfacción de 1 a 5 y el
// cumplimiento de un SLA (MaKo no tiene casos ni encuestas), el avance de cada caso («56% through») y por qué se van (el motivo
// de baja no se guarda todavía: docs/templates-dashboard-propuesta.md §7.4). Por eso el anillo dice por qué PIDEN ATENCIÓN (el
// motivo de la señal), no por qué se van.
//
// Puro y sin `server-only`: lo usan la pantalla (app/dashboard/disenos/HojaCs.tsx) y el test. Lo que no llegó es `null`, nunca
// un cero.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import { OTROS, SIN_DATO, type Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';
import type { Trozo } from './comercial-diseno';
import { inicialesDe } from './chat-diseno';
import { entero } from './marketing-diseno';
import { plata } from './cobranza-diseno';

export type { DatosPieza, Trozo };

const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const res = (datos: Record<string, DatosPieza>, id: string | undefined): Resultado | null => (id ? datos[id]?.resultado ?? null : null);
const col = (r: Resultado | null, metrica: string) => (r ? r.columnas.findIndex((c) => c.id === metrica) : -1);
const total = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && i >= 0 ? num(r.totales[i]) : null; };
const enFila = (r: Resultado, f: Resultado['filas'][number], metrica: string): number | null => { const i = col(r, metrica); return i >= 0 ? num(f.valores[i]) : null; };
/** Una parte, de 0 a 100, o null si no hay de dónde. */
const parte = (n: number | null, de: number | null) => (n != null && de != null && de > 0 ? (n / de) * 100 : null);

// ── la cabecera ─────────────────────────────────────────────────────────────────────────────────────────────────
/** «3 de tus 19 clientes piden atención. Deben $1,240 vencidos. Tuvieron 22 sesiones.» */
export function fraseCs(atencion: number | null, clientes: number | null, deuda: number | null, sesiones: number | null): Trozo[] {
  if (clientes == null) return [];
  if (clientes === 0) return [{ tipo: 'texto', s: 'Todavía no tienes clientes en tu cartera.' }];
  const out: Trozo[] = [];
  if (atencion != null && atencion > 0) {
    out.push({ tipo: 'fuerte', s: entero(atencion) }, { tipo: 'texto', s: ` de tus ${entero(clientes)} clientes ${atencion === 1 ? 'pide' : 'piden'} atención.` });
  } else {
    out.push({ tipo: 'texto', s: `Ninguno de tus ${entero(clientes)} clientes pide atención.` });
  }
  if (deuda != null && deuda > 0) out.push({ tipo: 'texto', s: ' Deben ' }, { tipo: 'fuerte', s: plata(deuda) }, { tipo: 'texto', s: ' vencidos.' });
  if (sesiones != null && sesiones > 0) out.push({ tipo: 'texto', s: ` Tuvieron ${entero(sesiones)} ${sesiones === 1 ? 'sesión' : 'sesiones'} en el período.` });
  return out;
}

// ── la cartera por etapa ────────────────────────────────────────────────────────────────────────────────────────
/** Los tramos del último contacto (lib/graficos-datos-puro.ts, TRAMOS_CONTACTO) que cuentan como «hablaron hace poco». */
export const TRAMOS_RECIENTES: readonly string[] = ['0-7 días', '8-14 días'];
/** Los que cuentan como «hace tiempo que no hablan»: más de dos semanas, o nunca. */
export const TRAMOS_LEJANOS: readonly string[] = ['15-30 días', 'Más de 30 días', 'Nunca'];
/** Cuántos clientes se ven por carril, como Mender: los demás, «y N más». */
export const FILAS_CARRIL = 5;
/** Los cinco tonos de las caras (las de Mender, sin sus dibujos): sale del nombre, así un cliente no cambia de color. */
export type TonoCara = 'a' | 'b' | 'c' | 'd' | 'e';
export function tonoDe(nombre: string): TonoCara {
  let h = 0;
  for (const ch of nombre) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return (['a', 'b', 'c', 'd', 'e'] as const)[h % 5];
}
export type TarjetaCs = {
  clave: string; nombre: string; iniciales: string; tono: TonoCara;
  producto: string | null; contacto: string | null; senal: string | null; estado: string | null; deuda: number | null;
  /** Pide atención (la señal de la cartera): el aro coral de Mender. */
  atencion: boolean;
};
/** «habló hace 8-14 días», «nunca habló», o null si no se sabe. */
export function textoContacto(tramo: string | null): string | null {
  if (!tramo || tramo === SIN_DATO) return null;
  if (tramo === 'Nunca') return 'nunca habló';
  return `habló hace ${tramo.replace(/^Más de/, 'más de')}`;
}
/** El ícono de la derecha: el reloj si hace tiempo que no hablan, el doble tilde si está al día; nada si no hay qué decir. */
export function iconoDe(t: Pick<TarjetaCs, 'contacto' | 'senal'>): 'reloj' | 'tilde' | null {
  if (t.contacto && TRAMOS_LEJANOS.includes(t.contacto)) return 'reloj';
  if (t.senal === 'Bien' && t.contacto && TRAMOS_RECIENTES.includes(t.contacto)) return 'tilde';
  return null;
}
export type FiltroCs = 'todos' | 'atencion' | 'bien' | 'sin-hablar';
export const FILTROS_CS: ReadonlyArray<{ id: FiltroCs; largo: string; corto: string }> = [
  { id: 'todos', largo: 'Todos', corto: 'Todos' },
  { id: 'atencion', largo: 'Piden atención', corto: 'Atención' },
  { id: 'bien', largo: 'Al día', corto: 'Al día' },
  { id: 'sin-hablar', largo: 'Sin hablar', corto: 'Sin hablar' },
];
export function pasaFiltro(t: TarjetaCs, f: FiltroCs): boolean {
  if (f === 'atencion') return t.atencion;
  if (f === 'bien') return t.senal === 'Bien';
  if (f === 'sin-hablar') return !!t.contacto && TRAMOS_LEJANOS.includes(t.contacto);
  return true;
}
export type CarrilCs = {
  etapa: string;
  /** Cuántos clientes hay en la etapa (de la pieza de las etapas, que cuenta a todos); null si no se pudo leer. */
  n: number | null;
  tarjetas: TarjetaCs[];
};
export type CarterasCs = {
  carriles: CarrilCs[];
  /** Los clientes que no entraron en los carriles (la pieza trae los primeros 50). */
  fuera: number;
};

/**
 * Los carriles: uno por etapa de la entrega. Las tarjetas salen de la pieza de los carriles (cada cliente, con su etapa en el
 * CRUCE: un cliente que está en dos servicios va en las dos etapas), y lo que dice cada una, de la tabla de la cartera (su
 * señal, su último contacto y lo que debe), cruzado por el id del cliente. El orden de los carriles es el de la ENTREGA
 * (`orden`, el catálogo de etapas de los servicios); sin él, el de la pieza de las etapas.
 */
export function carrilesDe(carriles: Resultado | null, etapas: Resultado | null, tabla: Resultado | null, orden: readonly string[] | null): CarterasCs {
  const porEtapa = new Map<string, number | null>();
  for (const f of etapas?.filas ?? []) if (f.clave !== OTROS) porEtapa.set(f.clave, enFila(etapas!, f, 'clientes'));
  const datosDe = new Map<string, Omit<TarjetaCs, 'clave' | 'nombre' | 'iniciales' | 'tono'>>();
  for (const f of tabla?.filas ?? []) {
    if (f.clave === OTROS) continue;
    const senal = f.extra?.senal ?? null;
    const d = {
      producto: f.extra?.producto && f.extra.producto !== SIN_DATO ? f.extra.producto : null,
      contacto: f.extra?.tramo_contacto && f.extra.tramo_contacto !== SIN_DATO ? f.extra.tramo_contacto : null,
      senal: senal && senal !== SIN_DATO ? senal : null,
      estado: f.extra?.estado && f.extra.estado !== SIN_DATO ? f.extra.estado : null,
      deuda: enFila(tabla!, f, 'deuda_vencida_usd'),
      atencion: senal === 'Atención',
    };
    datosDe.set(f.ref ? `id:${f.ref}` : `n:${f.clave}`, d);
  }
  // Con un solo servicio, el producto dice lo mismo en cada tarjeta y le quita lugar al último contacto: va sólo si hay dos o más.
  if (new Set([...datosDe.values()].map((d) => d.producto).filter(Boolean)).size < 2) for (const d of datosDe.values()) d.producto = null;
  const vacio = { producto: null, contacto: null, senal: null, estado: null, deuda: null, atencion: false };
  const tarjetas = new Map<string, TarjetaCs[]>();
  const claves = carriles?.cruce?.claves ?? [];
  (carriles?.filas ?? []).forEach((f, i) => {
    if (f.clave === OTROS) return;
    const nombre = f.clave === SIN_DATO ? 'Sin nombre' : f.etiqueta;
    const d = (f.ref ? datosDe.get(`id:${f.ref}`) : undefined) ?? datosDe.get(`n:${f.clave}`) ?? vacio;
    const t: TarjetaCs = { clave: f.clave, nombre, iniciales: inicialesDe(nombre) || '·', tono: tonoDe(nombre), ...d };
    const celdas = carriles!.cruce?.celdas[i] ?? [];
    claves.forEach((etapa, j) => {
      if (!((celdas[j] ?? 0) > 0)) return;
      const nom = etapa === OTROS ? 'Otras etapas' : etapa === SIN_DATO ? 'Sin etapa' : etapa;
      if (!tarjetas.has(nom)) tarjetas.set(nom, []);
      tarjetas.get(nom)!.push(t);
    });
  });
  // Las etapas: las del catálogo en su orden, después las que trae la pieza de las etapas y las que sólo aparecen en los carriles.
  const nombres: string[] = [];
  const sumar = (e: string) => { if (!nombres.includes(e)) nombres.push(e); };
  for (const e of orden ?? []) if (porEtapa.has(e) || tarjetas.has(e)) sumar(e);
  for (const e of porEtapa.keys()) sumar(e === SIN_DATO ? 'Sin etapa' : e);
  for (const e of tarjetas.keys()) sumar(e);
  // Las que piden atención primero adentro de cada carril, como Mender pone arriba lo que espera.
  const peso = (t: TarjetaCs) => (t.atencion ? 0 : t.contacto && TRAMOS_LEJANOS.includes(t.contacto) ? 1 : 2);
  const carrilesCs = nombres.map((etapa) => ({
    etapa,
    n: porEtapa.has(etapa) ? porEtapa.get(etapa) ?? null : etapas ? (tarjetas.get(etapa)?.length ?? 0) : null,
    tarjetas: [...(tarjetas.get(etapa) ?? [])].sort((x, y) => peso(x) - peso(y) || x.nombre.localeCompare(y.nombre, 'es')),
  }));
  return { carriles: carrilesCs, fuera: carriles?.fuera ?? 0 };
}

// ── por qué piden atención ──────────────────────────────────────────────────────────────────────────────────────
/** `clave`: la fila de la pieza, para abrir su detalle; null en «Lo demás», que junta varias. */
export type TramoAnillo = { clave: string | null; nombre: string; n: number; pct: number; barra: number; tono: string };
export type AnilloCs = { total: number; tramos: TramoAnillo[] };
/** Los tonos del anillo, en el orden de Mender (el más grande, esmeralda; después coral, ámbar y lo demás gris). */
export const TONOS_ANILLO: readonly string[] = ['var(--emerald)', 'var(--coral)', 'var(--amber)', 'var(--ink-4)'];
/** El color de cada señal, el mismo que la escala de la cartera (lib/graficos-fuentes-extra.ts). */
export const TONOS_SENAL: Readonly<Record<string, string>> = { 'Atención': 'var(--coral)', Bien: 'var(--emerald)', 'Sin datos': 'var(--ink-4)' };
/** Cuántos tramos con nombre tiene el anillo: el resto va en «Lo demás», como «Everything else». */
export const TRAMOS_ANILLO = 3;
export function anilloDe(r: Resultado | null, como: 'motivo' | 'senal'): AnilloCs | null {
  if (!r) return null;
  const filas = r.filas
    .map((f) => ({ clave: f.clave === OTROS ? null : f.clave, nombre: f.clave === SIN_DATO ? (como === 'motivo' ? 'Sin motivo' : 'Sin señal') : f.clave === OTROS ? 'Lo demás' : f.etiqueta, n: enFila(r, f, 'clientes') ?? 0, otros: f.clave === OTROS }))
    .filter((f) => f.n > 0);
  const total = filas.reduce((a, f) => a + f.n, 0);
  if (!total) return { total: 0, tramos: [] };
  let tramos: Array<{ clave: string | null; nombre: string; n: number }>;
  if (como === 'senal') tramos = filas;
  else {
    const con = filas.filter((f) => !f.otros).sort((a, b) => b.n - a.n);
    const resto = con.slice(TRAMOS_ANILLO).reduce((a, f) => a + f.n, 0) + filas.filter((f) => f.otros).reduce((a, f) => a + f.n, 0);
    tramos = [...con.slice(0, TRAMOS_ANILLO), ...(resto > 0 ? [{ clave: null, nombre: 'Lo demás', n: resto }] : [])];
  }
  const max = Math.max(...tramos.map((t) => t.n));
  return {
    total,
    tramos: tramos.map((t, i) => ({
      clave: t.clave, nombre: t.nombre, n: t.n, pct: (t.n / total) * 100, barra: t.n / max,
      tono: como === 'senal' ? TONOS_SENAL[t.nombre] ?? 'var(--ink-4)' : t.nombre === 'Lo demás' ? 'var(--ink-4)' : TONOS_ANILLO[i] ?? 'var(--ink-4)',
    })),
  };
}

// ── cómo está la cartera ────────────────────────────────────────────────────────────────────────────────────────
export type Medidor = { id: 'contacto' | 'atencion' | 'siguen'; titulo: string; sub: string; pct: number | null; tono: string };
/** El tono de un medidor por cómo le va, en los colores de Mender: esmeralda, ámbar o coral. */
export const tonoMedidor = (pct: number | null) => (pct == null ? 'var(--ink-4)' : pct >= 80 ? 'var(--emerald)' : pct >= 60 ? 'var(--amber)' : 'var(--coral)');
export function medidoresDe(contacto: Resultado | null, atencion: number | null, clientes: number | null, bajas: number | null): Medidor[] {
  let recientes: number | null = null, todos: number | null = null;
  if (contacto) {
    todos = 0; recientes = 0;
    for (const f of contacto.filas) {
      const n = enFila(contacto, f, 'clientes') ?? 0;
      todos += n;
      if (TRAMOS_RECIENTES.includes(f.clave)) recientes += n;
    }
  }
  const pContacto = parte(recientes, todos);
  const pAtencion = clientes != null && atencion != null ? parte(clientes - atencion, clientes) : null;
  const pSiguen = clientes != null && bajas != null ? parte(clientes - bajas, clientes) : null;
  return [
    { id: 'contacto', titulo: 'Hablaron hace poco', sub: 'en los últimos 14 días', pct: pContacto, tono: tonoMedidor(pContacto) },
    {
      id: 'atencion', titulo: 'Sin pedir atención', pct: pAtencion, tono: tonoMedidor(pAtencion),
      sub: atencion == null ? 'de tu cartera' : atencion === 0 ? 'nadie pide atención' : `${entero(atencion)} ${atencion === 1 ? 'pide' : 'piden'} atención`,
    },
    {
      id: 'siguen', titulo: 'Siguen contigo', pct: pSiguen, tono: tonoMedidor(pSiguen),
      sub: bajas == null ? 'de tu cartera' : bajas === 0 ? 'nadie se dio de baja' : `${entero(bajas)} ${bajas === 1 ? 'se dio' : 'se dieron'} de baja`,
    },
  ];
}

// ── todo junto ──────────────────────────────────────────────────────────────────────────────────────────────────
export type VistaCs = {
  frase: Trozo[];
  cartera: CarterasCs;
  motivos: AnilloCs | null;
  senal: AnilloCs | null;
  medidores: Medidor[];
  problemas: Partial<Record<'frase' | 'cartera' | 'anillo' | 'medidores', string>>;
};
export function vistaCs(hoja: Pick<Hoja, 'diseno'>, datos: Record<string, DatosPieza>, orden: readonly string[] | null): VistaCs {
  const p = hoja.diseno?.piezas ?? {};
  const err = (k: string | undefined) => (k ? datos[k]?.error : undefined);
  const problemas: VistaCs['problemas'] = {};
  if (err(p.apertura)) problemas.frase = 'No pude leer tu cartera.';
  if (err(p.carriles) || err(p.etapas)) problemas.cartera = 'No pude leer en qué etapa está cada cliente.';
  if (err(p.motivos) || err(p.senal)) problemas.anillo = 'No pude leer por qué piden atención.';
  if (err(p.contacto) || err(p.bajas)) problemas.medidores = 'No pude leer cómo está tu cartera.';
  const ap = res(datos, p.apertura);
  const atencion = total(ap, 'atencion'), clientes = total(ap, 'clientes');
  return {
    frase: fraseCs(atencion, clientes, total(ap, 'deuda_vencida_usd'), total(res(datos, p.sesiones), 'llamadas')),
    cartera: carrilesDe(res(datos, p.carriles), res(datos, p.etapas), res(datos, p.tabla), orden),
    motivos: anilloDe(res(datos, p.motivos), 'motivo'),
    senal: anilloDe(res(datos, p.senal), 'senal'),
    medidores: medidoresDe(res(datos, p.contacto), atencion, clientes, total(res(datos, p.bajas), 'clientes')),
    problemas,
  };
}
