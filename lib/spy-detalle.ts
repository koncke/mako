// =============================================================================
// spy-detalle — el detalle de un competidor: todo lo que publica en un solo gráfico (puntos 7 y 9 del 4/11/2026)
// =============================================================================
// Martín, 4/11: «Quiero que analices este video… y quiero que eso sea el Detail de cada competidor… como va poniendo
// todos sus contenidos en un gráfico… uno para contenido corto, otro para contenido largo, de sus carruseles o
// imágenes» y «si se selecciona un reel, un YT, un carrusel, o una web, debería fácilmente estar el botón de "Copiar
// estructura"». La especificación salió de mirar ese video cuadro por cuadro (docs/diseno-competitors-spy.md §15).
//
// Lo puro, con test: dónde cae cada miniatura (X = el día en que se publicó, Y = sus vistas en escala logarítmica), los
// números de arriba, qué formatos le funcionan y el texto que se lleva «Copiar estructura». Lo dibuja
// app/competitor-spy/GraficoSpy.tsx.
//
// ⚠️ SIN INVENTAR: donde no hay vistas (Instagram las da sólo en los reels) se usan los «me gusta» y el gráfico lo dice; una
// pieza sin ningún número no entra al gráfico (sigue en la grilla). Ni «visto hasta el final» ni «guardados»: un
// competidor no los publica. Y la lectura de los formatos la escribe este código con medianas, no una IA.
// =============================================================================

import type { Pieza } from './spy';
import type { TipoGuion } from './copywriter/tipos';
import { cortarSinPartir } from './unicode-seguro';
import { tipoDeContenido } from './spy-vista';

/** Los formatos que la IA del negocio le pone a cada pieza al analizarla (`analizarCompetidor`, lib/spy.ts). */
export const FORMATOS = [
  { value: 'pov', label: 'POV' },
  { value: 'storytime', label: 'Storytime' },
  { value: 'antes-despues', label: 'Antes y después' },
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'lista', label: 'Lista o tips' },
  { value: 'opinion', label: 'Opinión' },
  { value: 'resena', label: 'Reseña' },
  { value: 'testimonio', label: 'Testimonio' },
  { value: 'detras', label: 'Detrás de escena' },
  { value: 'entrevista', label: 'Entrevista' },
  { value: 'otro', label: 'Otro' },
] as const;
export type Formato = (typeof FORMATOS)[number]['value'];
export const esFormato = (v: unknown): v is Formato => typeof v === 'string' && FORMATOS.some((f) => f.value === v);
const rotuloFormato = (v: Formato): string => FORMATOS.find((f) => f.value === v)?.label ?? v;

const plano = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Lo que la IA dijo del formato, leído: su valor («antes-despues») o su nombre («Antes y después»), sin tildes ni
 * mayúsculas. Lo que no es ninguno queda vacío: un formato inventado no se suma a ninguna fila.
 */
export function formatoDe(v: unknown): Formato | '' {
  if (typeof v !== 'string') return '';
  const t = plano(v);
  const f = FORMATOS.find((x) => x.value === t || plano(x.label) === t);
  return f ? f.value : '';
}

type PiezaDelGrafico = Pick<Pieza, 'id' | 'canal' | 'tipo' | 'vistas' | 'megusta' | 'publicada_en' | 'visto_primera_vez' | 'dejo_de_verse_en'> & {
  analisis?: { gancho?: string; formato?: string } | null;
};

/** Qué número usa el gráfico: las vistas si hay en la mayoría; si no, los «me gusta». Un anuncio, los días al aire. */
export type Metrica = 'vistas' | 'me gusta' | 'días al aire';

const diasAlAire = (p: PiezaDelGrafico, ahora: number): number | null => {
  const desde = Date.parse(p.publicada_en ?? '');
  if (!Number.isFinite(desde)) return null;
  const hasta = p.dejo_de_verse_en ? Date.parse(p.dejo_de_verse_en) : ahora;
  return Math.max(1, Math.round((hasta - desde) / 86_400_000));
};

export function metricaDe(piezas: readonly PiezaDelGrafico[]): Metrica {
  if (piezas.length && piezas.every((p) => p.canal === 'anuncios')) return 'días al aire';
  const conVistas = piezas.filter((p) => p.vistas != null).length;
  return conVistas >= piezas.length / 2 ? 'vistas' : 'me gusta';
}

export function valorDe(p: PiezaDelGrafico, m: Metrica, ahora: number = Date.now()): number | null {
  if (m === 'días al aire') return diasAlAire(p, ahora);
  const v = m === 'vistas' ? p.vistas : p.megusta;
  return v != null && v >= 0 ? v : null;
}

const mediana = (xs: readonly number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/** Los números de arriba: cuántas piezas, el total y la mediana del número que usa el gráfico. */
export function numerosDe(piezas: readonly PiezaDelGrafico[], ahora: number = Date.now()): { piezas: number; metrica: Metrica; total: number | null; mediana: number | null } {
  const m = metricaDe(piezas);
  const vs = piezas.map((p) => valorDe(p, m, ahora)).filter((v): v is number => v != null);
  return { piezas: piezas.length, metrica: m, total: vs.length && m !== 'días al aire' ? vs.reduce((a, b) => a + b, 0) : null, mediana: mediana(vs) };
}

// ── Qué se grafica ───────────────────────────────────────────────────────────

/** Los gráficos del detalle (Martín: «uno para contenido corto, otro para contenido largo, de sus carruseles o imágenes, y luego el análisis de su web»). */
export const GRUPOS = [
  { value: 'corto', label: 'Contenido corto' },
  { value: 'largo', label: 'Contenido largo' },
  { value: 'imagenes', label: 'Carruseles e imágenes' },
  { value: 'anuncios', label: 'Anuncios' },
  { value: 'web', label: 'Su web' },
] as const;
export type Grupo = (typeof GRUPOS)[number]['value'];

/** A qué gráfico va una pieza: los reels y los shorts son contenido corto; un video de YouTube, largo. */
export function grupoDe(p: Pick<Pieza, 'canal' | 'tipo' | 'duracion'>): Grupo | null {
  if (p.canal === 'landing') return 'web';
  if (p.canal === 'anuncios') return 'anuncios';
  const t = tipoDeContenido(p);
  if (t === 'reels' || t === 'shorts') return 'corto';
  if (t === 'largos') return 'largo';
  return t === 'carruseles' ? 'imagenes' : null;
}

/** Lo que se elige en el desplegable del gráfico: un gráfico, o sumarle la red que le falta. */
export type ValorDeGrafico = Grupo | 'agregar-instagram' | 'agregar-youtube';

/**
 * Las opciones del desplegable: sólo los gráficos que tienen algo (con cuántas piezas) y, al final, la red que le falta
 * (Martín: «Agregar Instagram o la red que falte, ahora se hará en el desplegable»).
 */
export function opcionesDeGrafico(
  piezas: readonly Pick<Pieza, 'canal' | 'tipo' | 'duracion'>[],
  c: { instagram: string | null; youtube_id: string | null },
): Array<{ value: ValorDeGrafico; label: string }> {
  const n = new Map<Grupo, number>();
  for (const p of piezas) { const g = grupoDe(p); if (g) n.set(g, (n.get(g) ?? 0) + 1); }
  return [
    ...GRUPOS.filter((g) => (n.get(g.value) ?? 0) > 0).map((g) => ({ value: g.value as ValorDeGrafico, label: g.value === 'web' ? g.label : `${g.label} · ${n.get(g.value)}` })),
    ...(!c.instagram ? [{ value: 'agregar-instagram' as const, label: 'Agregar su Instagram' }] : []),
    ...(!c.youtube_id ? [{ value: 'agregar-youtube' as const, label: 'Agregar su YouTube' }] : []),
  ];
}

/** El primer gráfico que tiene algo, en el orden de `GRUPOS`. */
export const primerGrupo = (piezas: readonly Pick<Pieza, 'canal' | 'tipo' | 'duracion'>[]): Grupo | null =>
  GRUPOS.find((g) => piezas.some((p) => grupoDe(p) === g.value))?.value ?? null;

/** Las redes de un gráfico con cuántas piezas: el filtro de arriba. Con una sola red no hay filtro. */
export function redesDe(piezas: readonly Pick<Pieza, 'canal'>[]): Array<{ red: string; n: number }> {
  const n = new Map<string, number>();
  for (const p of piezas) n.set(p.canal, (n.get(p.canal) ?? 0) + 1);
  return n.size > 1 ? [{ red: 'todo', n: piezas.length }, ...[...n.entries()].map(([red, k]) => ({ red, n: k })).sort((a, b) => b.n - a.n)] : [];
}

/**
 * La proporción REAL de su miniatura (Martín, 4/11): un reel o un short son verticales (9:16), una publicación o un
 * anuncio cuadrados, un video de YouTube y una web apaisados (16:9). Antes todas eran cuadradas en el gráfico y 4:5 en
 * las tarjetas, y un video apaisado se veía recortado.
 */
export function proporcionDe(p: Pick<Pieza, 'canal' | 'tipo' | 'duracion'>): { ancho: number; alto: number } {
  const t = tipoDeContenido(p);
  if (t === 'reels' || t === 'shorts') return { ancho: 9, alto: 16 };
  if (t === 'largos' || p.canal === 'landing') return { ancho: 16, alto: 9 };
  return { ancho: 1, alto: 1 };
}

/** Su miniatura en el gráfico: el lado más largo mide `lado`, y el otro sale de su proporción. */
export function medidaEnElGrafico(p: Pick<Pieza, 'canal' | 'tipo' | 'duracion'>, lado: number): { ancho: number; alto: number } {
  const r = proporcionDe(p);
  return r.ancho >= r.alto
    ? { ancho: lado, alto: Math.round((lado * r.alto) / r.ancho) }
    : { ancho: Math.round((lado * r.ancho) / r.alto), alto: lado };
}

/** Una fila de «¿En qué publica?»: cuántas piezas y qué parte del total. `red` dibuja su logo. */
export type FilaReparto = { clave: string; rotulo: string; n: number; pct: number; red?: 'instagram' | 'youtube' | 'anuncios' };

const ROTULO_FORMATO = { reels: 'Reels', carruseles: 'Carruseles e imágenes', shorts: 'Shorts', largos: 'Videos largos', anuncios: 'Anuncios' } as const;

/**
 * «¿En qué publica?», de verdad: por RED y por FORMATO (Martín, 4/11: nada de «100% videos»). Antes se contaba por el tipo
 * guardado, y un canal de YouTube decía «100% videos» aunque la mitad fueran shorts. Su web no es una publicación: no
 * entra. Las filas van de la que más tiene a la que menos, y un formato sin piezas no aparece.
 */
export function repartoDePublicaciones(piezas: readonly Pick<Pieza, 'canal' | 'tipo' | 'duracion'>[]): { total: number; redes: FilaReparto[]; formatos: FilaReparto[] } {
  const publicadas = piezas.filter((p) => p.canal !== 'landing');
  const total = publicadas.length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const porRed = new Map<'instagram' | 'youtube' | 'anuncios', number>();
  const porFormato = new Map<keyof typeof ROTULO_FORMATO, number>();
  for (const p of publicadas) {
    if (p.canal === 'instagram' || p.canal === 'youtube' || p.canal === 'anuncios') porRed.set(p.canal, (porRed.get(p.canal) ?? 0) + 1);
    const f = p.canal === 'anuncios' ? 'anuncios' : tipoDeContenido(p);
    if (f) porFormato.set(f, (porFormato.get(f) ?? 0) + 1);
  }
  const NOMBRE = { instagram: 'Instagram', youtube: 'YouTube', anuncios: 'Anuncios' } as const;
  const redes = [...porRed.entries()].map(([red, n]) => ({ clave: red, rotulo: NOMBRE[red], n, pct: pct(n), red })).sort((a, b) => b.n - a.n);
  const formatos = [...porFormato.entries()].map(([f, n]) => ({ clave: f, rotulo: ROTULO_FORMATO[f], n, pct: pct(n) })).sort((a, b) => b.n - a.n);
  return { total, redes, formatos };
}

/** Cuántas miniaturas se dibujan como mucho: más no se leen y la animación se traba. En el teléfono, menos. */
export const MINIATURAS_POR_GRAFICO = 180;

/**
 * Las que se dibujan cuando hay más que el tope: las de más arriba (las que se van a copiar) y, del resto, una cada tanto en
 * el tiempo, para que el gráfico siga diciendo cómo publica. Con menos que el tope, todas.
 */
export function muestraDe<T extends { x: number; valor: number }>(puntos: readonly T[], tope = MINIATURAS_POR_GRAFICO): T[] {
  if (puntos.length <= tope) return [...puntos];
  const arriba = Math.round(tope * 0.6);
  const porValor = [...puntos].sort((a, b) => b.valor - a.valor);
  const elegidas = new Set(porValor.slice(0, arriba));
  const resto = porValor.slice(arriba).sort((a, b) => a.x - b.x);
  const faltan = tope - arriba;
  for (let i = 0; i < faltan; i += 1) elegidas.add(resto[Math.floor((i * resto.length) / faltan)]);
  return puntos.filter((p) => elegidas.has(p));
}

/** Un punto del gráfico: dónde cae su miniatura, de 0 a 1 en cada eje. */
export type Punto = { id: number; x: number; y: number; valor: number };

/** Las marcas del eje Y: potencias de 10 entre el mínimo y el máximo (100, 1k, 10k, 100k…). */
export type Marca = { y: number; rotulo: string };

const rotuloCorto = (v: number): string => (v >= 1_000_000 ? `${Math.round(v / 100_000) / 10}M` : v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v));

/**
 * El gráfico: X = el día en que se publicó (de la primera a la última), Y = el número en escala logarítmica. Una pieza sin
 * fecha o sin número no entra (se cuenta en `fuera`).
 */
export function graficoDe(piezas: readonly PiezaDelGrafico[], ahora: number = Date.now()): {
  metrica: Metrica; puntos: Punto[]; marcas: Marca[]; desde: string | null; hasta: string | null; fuera: number;
} {
  const metrica = metricaDe(piezas);
  const con = piezas.map((p) => ({ p, t: Date.parse(p.publicada_en ?? p.visto_primera_vez ?? ''), v: valorDe(p, metrica, ahora) }))
    .filter((x): x is { p: PiezaDelGrafico; t: number; v: number } => Number.isFinite(x.t) && x.v != null);
  if (!con.length) return { metrica, puntos: [], marcas: [], desde: null, hasta: null, fuera: piezas.length };
  const t0 = Math.min(...con.map((x) => x.t));
  const t1 = Math.max(...con.map((x) => x.t));
  const lo = Math.floor(Math.log10(Math.max(1, Math.min(...con.map((x) => x.v)))));
  const hi = Math.max(lo + 1, Math.ceil(Math.log10(Math.max(1, ...con.map((x) => x.v))) - 1e-9));
  const yDe = (v: number) => (Math.log10(Math.max(1, v)) - lo) / (hi - lo);
  const puntos = con.map((x) => ({ id: x.p.id, x: t1 > t0 ? (x.t - t0) / (t1 - t0) : 0.5, y: yDe(x.v), valor: x.v }));
  const marcas: Marca[] = [];
  for (let e = lo; e <= hi; e += 1) marcas.push({ y: (e - lo) / (hi - lo), rotulo: rotuloCorto(10 ** e) });
  return { metrica, puntos, marcas, desde: new Date(t0).toISOString(), hasta: new Date(t1).toISOString(), fuera: piezas.length - con.length };
}

/** «#51 de 420»: su puesto por el número del gráfico, o null si no tiene número. */
export function puestoDe(id: number, piezas: readonly PiezaDelGrafico[], ahora: number = Date.now()): string | null {
  const m = metricaDe(piezas);
  const orden = piezas.map((p) => ({ id: p.id, v: valorDe(p, m, ahora) })).filter((x): x is { id: number; v: number } => x.v != null).sort((a, b) => b.v - a.v);
  const i = orden.findIndex((x) => x.id === id);
  return i < 0 ? null : `#${i + 1} de ${orden.length}`;
}

/**
 * Cuántas veces su mediana hizo ESTA pieza (4/11/2026, el detalle rediseñado; copiado del «multiplicador» de vidIQ): 2,3 =
 * 2,3 veces lo que hace una pieza suya típica. Con la misma métrica del gráfico y sobre las mismas piezas. null sin su número,
 * con menos de 3 piezas con número (la mediana de dos no dice nada) y en los anuncios (los días al aire no son un rendimiento).
 */
export function vecesSuMediana(id: number, piezas: readonly PiezaDelGrafico[], ahora: number = Date.now()): number | null {
  const m = metricaDe(piezas);
  if (m === 'días al aire') return null;
  const vs = piezas.map((p) => valorDe(p, m, ahora)).filter((v): v is number => v != null);
  const med = vs.length >= 3 ? mediana(vs) : null;
  const p = piezas.find((x) => x.id === id);
  const v = p ? valorDe(p, m, ahora) : null;
  if (v == null || !med) return null;
  return Math.round((v / med) * 10) / 10;
}

/** Una pieza de «Lo que mejor le fue»: su número, en qué métrica, y cuántas veces la mediana de SU grupo. */
export type PiezaDestacada = { id: number; valor: number; metrica: Metrica; veces: number };

/**
 * Lo que mejor le fue (4/11/2026, el bloque al lado de «¿Qué formatos le funcionan?»: Martín, «debería ir otro bloque con algo
 * más... porque sino queda vacío»). Se ordena por cuántas veces la mediana de SU grupo hizo cada pieza (un short y un video
 * largo no se comparan en vistas crudas), y a igual veces, por su número. Sin los anuncios (días al aire no es rendimiento),
 * y sin grupos de menos de 3 piezas con número.
 */
export function mejoresPiezas(piezas: readonly (PiezaDelGrafico & Pick<Pieza, 'duracion'>)[], tope: number, ahora: number = Date.now()): PiezaDestacada[] {
  const porGrupo = new Map<string, PiezaDelGrafico[]>();
  for (const p of piezas) {
    const g = grupoDe(p);
    if (!g || g === 'anuncios') continue;
    const del = porGrupo.get(g);
    if (del) del.push(p);
    else porGrupo.set(g, [p]);
  }
  const out: PiezaDestacada[] = [];
  for (const grupo of porGrupo.values()) {
    const m = metricaDe(grupo);
    if (m === 'días al aire') continue;
    const vs = grupo.map((p) => valorDe(p, m, ahora)).filter((v): v is number => v != null);
    const med = vs.length >= 3 ? mediana(vs) : null;
    if (!med) continue;
    for (const p of grupo) {
      const v = valorDe(p, m, ahora);
      if (v != null) out.push({ id: p.id, valor: v, metrica: m, veces: Math.round((v / med) * 10) / 10 });
    }
  }
  return out.sort((a, b) => b.veces - a.veces || b.valor - a.valor).slice(0, Math.max(0, tope));
}

/** Una fila de «¿Qué formatos le funcionan?»: el formato, sus piezas ubicadas por su número, su mediana y su mejor gancho. */
export type FilaFormato = {
  formato: Formato; rotulo: string; n: number; mediana: number; veces: number; gancho: string | null;
  piezas: Array<{ id: number; x: number; valor: number }>; xMediana: number;
};

/** Cuántas piezas necesita un formato para tener fila: con una sola, la mediana es esa pieza. */
export const PIEZAS_POR_FORMATO = 2;

/**
 * Los formatos, del que más rinde al que menos (por la mediana de cada uno contra la de todas). Sólo con piezas que la IA
 * ya etiquetó; sin ninguna, no hay filas y la sección no se dibuja.
 */
export function formatosDe(piezas: readonly PiezaDelGrafico[], ahora: number = Date.now()): FilaFormato[] {
  const m = metricaDe(piezas);
  const conValor = piezas.map((p) => ({ p, v: valorDe(p, m, ahora) })).filter((x): x is { p: PiezaDelGrafico; v: number } => x.v != null);
  const general = mediana(conValor.map((x) => x.v));
  if (!general) return [];
  const grupos = new Map<Formato, typeof conValor>();
  for (const x of conValor) {
    const f = x.p.analisis?.formato;
    if (!esFormato(f) || f === 'otro') continue;
    grupos.set(f, [...(grupos.get(f) ?? []), x]);
  }
  const todos = conValor.map((x) => x.v);
  const lo = Math.log10(Math.max(1, Math.min(...todos)));
  const hi = Math.max(lo + 1, Math.log10(Math.max(1, ...todos)));
  const xDe = (v: number) => (Math.log10(Math.max(1, v)) - lo) / (hi - lo);
  return [...grupos.entries()].filter(([, xs]) => xs.length >= PIEZAS_POR_FORMATO).map(([formato, xs]) => {
    const med = mediana(xs.map((x) => x.v)) as number;
    const mejor = [...xs].sort((a, b) => b.v - a.v)[0];
    return {
      formato, rotulo: rotuloFormato(formato), n: xs.length, mediana: med, veces: Math.round((med / general) * 10) / 10,
      gancho: mejor.p.analisis?.gancho?.trim() || null,
      piezas: xs.map((x) => ({ id: x.p.id, x: xDe(x.v), valor: x.v })), xMediana: xDe(med),
    };
  }).sort((a, b) => b.mediana - a.mediana);
}

const veces = (v: number) => `${String(v).replace('.', ',')}x`;

/**
 * La lectura de arriba de los formatos, escrita por el CÓDIGO: los que pasan la mediana y el que más queda abajo.
 * «POV y Storytime rinden 2,3x y 1,6x la mediana; Reseña, 0,4x.» Sin ninguno arriba: «Reseña rinde 0,4x la mediana.»
 * null con menos de dos formatos, o si ninguno se aparta de la mediana.
 */
export function lecturaDeFormatos(filas: readonly FilaFormato[]): string | null {
  if (filas.length < 2) return null;
  const arriba = filas.filter((f) => f.veces >= 1.2).slice(0, 2);
  const abajo = [...filas].reverse().find((f) => f.veces < 0.8 && !arriba.includes(f));
  if (!arriba.length && !abajo) return null;
  if (!arriba.length) return `${abajo!.rotulo} rinde ${veces(abajo!.veces)} la mediana.`;
  const dicho = `${arriba.map((f) => f.rotulo).join(' y ')} ${arriba.length > 1 ? 'rinden' : 'rinde'} ${arriba.map((f) => veces(f.veces)).join(' y ')} la mediana`;
  return abajo ? `${dicho}; ${abajo.rotulo}, ${veces(abajo.veces)}.` : `${dicho}.`;
}

// ── Copiar estructura ────────────────────────────────────────────────────────

/** A qué tipo de página del Copywriter va cada pieza. */
export function tipoParaCopiar(p: Pick<Pieza, 'canal' | 'tipo' | 'duracion'>): TipoGuion {
  if (p.canal === 'anuncios') return 'ad';
  const t = tipoDeContenido(p);
  if (t === 'shorts' || t === 'reels') return 'reel';
  return t === 'largos' ? 'youtube' : 'post';
}

/**
 * Lo que «Copiar estructura» escribe en la página nueva del Copywriter: de dónde viene, lo que la IA leyó (su gancho, su
 * ángulo, su formato) y su texto, citado. Lo que dice el competidor va en citas («> »): una línea suya en MAYÚSCULA no
 * puede abrir una sección del guion (lib/copywriter/texto.ts).
 */
export function textoParaCopiar(
  c: { nombre: string },
  p: Pick<Pieza, 'canal' | 'tipo' | 'url' | 'titulo' | 'texto' | 'vistas' | 'megusta'> & { analisis?: { gancho?: string; angulo?: string; formato?: string } | null },
): string {
  const red = p.canal === 'youtube' ? 'YouTube' : p.canal === 'anuncios' ? 'su anuncio' : 'Instagram';
  const numeros = [p.vistas != null ? `${p.vistas} vistas` : '', p.megusta != null ? `${p.megusta} me gusta` : ''].filter(Boolean).join(' · ');
  const a = p.analisis ?? {};
  const citar = (t: string) => t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => `> ${l}`).join('\n');
  return [
    `## Copiado de ${c.nombre}`,
    `${red}${numeros ? ` · ${numeros}` : ''}${p.url ? ` · ${p.url}` : ''}`,
    '',
    '## Su estructura',
    a.gancho ? `- Gancho: ${a.gancho}` : '',
    a.angulo ? `- Ángulo: ${a.angulo}` : '',
    esFormato(a.formato) && a.formato !== 'otro' ? `- Formato: ${rotuloFormato(a.formato)}` : '',
    !a.gancho && !a.angulo ? '- Todavía no la analizó la IA: pídele a MaKo que la lea.' : '',
    '',
    ...(p.titulo ? ['## Su título', citar(p.titulo), ''] : []),
    ...(p.texto ? ['## Su texto', citar(cortarSinPartir(p.texto, 3000)), ''] : []),
    '## Tu versión',
    'Pídele a MaKo que la escriba con tu oferta y tu voz.',
  ].filter((l, i, arr) => l !== '' || arr[i - 1] !== '').join('\n').trim();
}
