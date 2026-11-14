// =============================================================================
// spy-anuncios-ficha — la pestaña «Anuncios» de la ficha de un competidor, como Spyder de Foreplay (14/11/2026)
// =============================================================================
// Martín (por el chat de Landings, 14/11): «implementar todo lo que tiene Foreplay… darle mucha prioridad al tema de anuncios,
// que nosotros no le estamos dando casi nada». En Foreplay (Spyder), la ficha de una marca trae arriba el media mix de sus
// anuncios activos y las landings con su %, una pestaña de «Creative Tests» (anuncios lanzados el mismo día, con «Winner
// Identified» cuando de la tanda queda uno solo activo) y una línea de tiempo con los días que corrió cada uno.
//
// TODO sale de lo que Spy YA guardó de cada anuncio: la fecha en que empezó según la Biblioteca (`publicada_en`), si terminó
// (`dejo_de_verse_en`), a dónde manda (`dominio_destino`) y su formato (`medio`). No gasta Apify ni IA.
//
// ⚠️ LOS DÍAS SON LOS DE LA TARJETA (`tiempoDePieza`, lib/spy-vista.ts): uno activo cuenta hasta hoy; uno terminado, hasta el día
// en que terminó. Si la última lectura es vieja, «activo» quiere decir «activo la última vez que se miró», y la pestaña dice
// cuándo fue eso (`frescuraDeAnuncios`).
// ⚠️ EL FORMATO ES NUEVO (columna `medio`, 13/11/2026): los anuncios guardados antes no lo tienen y lo reciben en la próxima
// lectura. Un anuncio sin formato no se cuenta como ninguno, y el % es sobre los que lo tienen.
//
// Puro: lo importan la pantalla (computadora y teléfono) y el test (tests/spy-anuncios-ficha.test.ts).
// =============================================================================

import type { Pieza } from './spy';
import type { Medio } from './spy-medio';
import { diasCorriendo } from './spy-reglas';

const DIA_MS = 86_400_000;

/** Lo que estas cuentas leen de un anuncio. */
export type AnuncioFicha = Pick<Pieza, 'id' | 'publicada_en' | 'visto_primera_vez' | 'visto_ultima_vez' | 'dejo_de_verse_en' | 'dominio_destino' | 'medio'>;

/** ¿Seguía activo la última vez que se miró? Un anuncio terminado trae el día en que terminó. */
export const sigueActivo = (a: Pick<Pieza, 'dejo_de_verse_en'>): boolean => !a.dejo_de_verse_en;

/** Días al aire, los mismos de la tarjeta. null = la Biblioteca no dijo cuándo empezó (no es «0»). */
export function diasAlAire(a: Pick<Pieza, 'publicada_en' | 'dejo_de_verse_en'>, ahora: Date = new Date()): number | null {
  return diasCorriendo(a.publicada_en, a.dejo_de_verse_en ? new Date(a.dejo_de_verse_en) : ahora);
}

/** Más días al aire primero; a igual cantidad, el que sigue activo. Sin fecha, al final. */
export function porDiasAlAire<A extends Pick<Pieza, 'publicada_en' | 'dejo_de_verse_en'>>(ahora: Date = new Date()): (a: A, b: A) => number {
  return (a, b) => (diasAlAire(b, ahora) ?? -1) - (diasAlAire(a, ahora) ?? -1) || Number(sigueActivo(b)) - Number(sigueActivo(a));
}

/** «Actualizado hace X»: la última vez que se leyeron sus anuncios. «Desde»: la primera. */
export function frescuraDeAnuncios(anuncios: readonly Pick<Pieza, 'visto_primera_vez' | 'visto_ultima_vez'>[]): { actualizado: string | null; desde: string | null } {
  let actualizado: string | null = null;
  let desde: string | null = null;
  for (const a of anuncios) {
    if (a.visto_ultima_vez && (!actualizado || a.visto_ultima_vez > actualizado)) actualizado = a.visto_ultima_vez;
    if (a.visto_primera_vez && (!desde || a.visto_primera_vez < desde)) desde = a.visto_primera_vez;
  }
  return { actualizado, desde };
}

// ─────────────────────────────────────────────────────────────────────────────
// Arriba: el media mix de los activos y a dónde mandan
// ─────────────────────────────────────────────────────────────────────────────

export const ROTULO_MEDIO: Record<Medio, string> = { video: 'Video', imagen: 'Imagen', carrusel: 'Carrusel' };

const pct = (n: number, total: number): number => (total ? Math.round((n / total) * 100) : 0);

export type MezclaDeFormatos = {
  /** Cuántos siguen activos, y de cuántos. */
  activos: number;
  total: number;
  /** Sobre qué se reparte: los activos; si no queda ninguno, todos. */
  base: 'activos' | 'todos';
  /** Cuántos de la base tienen formato: el % de cada fila es sobre éstos. */
  conFormato: number;
  filas: Array<{ medio: Medio; rotulo: string; n: number; pct: number }>;
};

/** El «Active Ads – Media Mix» de Foreplay: video, imagen y carrusel entre los activos. */
export function mezclaDeFormatos(anuncios: readonly Pick<Pieza, 'dejo_de_verse_en' | 'medio'>[]): MezclaDeFormatos {
  const activos = anuncios.filter(sigueActivo);
  const base = activos.length ? activos : anuncios;
  const cuenta = new Map<Medio, number>();
  for (const a of base) if (a.medio) cuenta.set(a.medio, (cuenta.get(a.medio) ?? 0) + 1);
  const conFormato = [...cuenta.values()].reduce((s, n) => s + n, 0);
  const filas = [...cuenta.entries()]
    .map(([medio, n]) => ({ medio, rotulo: ROTULO_MEDIO[medio], n, pct: pct(n, conFormato) }))
    .sort((a, b) => b.n - a.n || a.rotulo.localeCompare(b.rotulo));
  return { activos: activos.length, total: anuncios.length, base: activos.length ? 'activos' : 'todos', conFormato, filas };
}

/**
 * El destino como se lee: sin el protocolo, sin «www.», sin la consulta (ahí van los utm y el id del clic, que hacen distinta cada
 * URL) y sin la barra final. Dos anuncios que mandan a la misma página cuentan juntos.
 */
export function rotuloDeDestino(d: string | null | undefined): string | null {
  const limpio = (d ?? '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();
  return limpio || null;
}

/** «Landing Pages» de Foreplay: las páginas a las que mandan más anuncios, con su % sobre TODOS sus anuncios. */
export function landingsDeAnuncios(anuncios: readonly Pick<Pieza, 'dominio_destino' | 'dejo_de_verse_en'>[], tope = 5): Array<{ rotulo: string; n: number; pct: number; activos: number }> {
  const cuenta = new Map<string, { n: number; activos: number }>();
  for (const a of anuncios) {
    const r = rotuloDeDestino(a.dominio_destino);
    if (!r) continue;
    const v = cuenta.get(r) ?? { n: 0, activos: 0 };
    v.n += 1;
    if (sigueActivo(a)) v.activos += 1;
    cuenta.set(r, v);
  }
  return [...cuenta.entries()]
    .map(([rotulo, v]) => ({ rotulo, n: v.n, pct: pct(v.n, anuncios.length), activos: v.activos }))
    .sort((a, b) => b.n - a.n || b.activos - a.activos || a.rotulo.localeCompare(b.rotulo))
    .slice(0, tope);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests creativos: los anuncios lanzados el mismo día
// ─────────────────────────────────────────────────────────────────────────────

/** Desde cuántos anuncios del mismo día hay una tanda: uno solo no es un test. */
export const MINIMO_TANDA = 2;

export type Tanda<A> = {
  /** El día en que empezaron, «AAAA-MM-DD». */
  dia: string;
  /** Primero los activos; después, los que más corrieron. */
  anuncios: A[];
  vivos: number;
  /**
   * «Winner Identified» de Foreplay: de la tanda queda UNO solo activo. Si quedan varios, el test sigue; si no queda ninguno, no
   * se sabe cuál ganó (todos se apagaron).
   */
  ganador: A | null;
};

/**
 * Las tandas: los anuncios que la Biblioteca dice que empezaron el MISMO día, la más nueva primero. El día sale tal cual de la
 * fecha guardada: la Biblioteca da el día (sin la hora), y se guarda a la medianoche del Pacífico, que en UTC sigue siendo ese día.
 */
export function tandasDeAnuncios<A extends Pick<Pieza, 'publicada_en' | 'dejo_de_verse_en'>>(anuncios: readonly A[], ahora: Date = new Date()): Tanda<A>[] {
  const porDia = new Map<string, A[]>();
  for (const a of anuncios) {
    const dia = /^\d{4}-\d{2}-\d{2}/.exec(a.publicada_en ?? '')?.[0];
    if (!dia) continue;
    porDia.set(dia, [...(porDia.get(dia) ?? []), a]);
  }
  const orden = porDiasAlAire<A>(ahora);
  return [...porDia.entries()]
    .filter(([, lista]) => lista.length >= MINIMO_TANDA)
    .map(([dia, lista]) => {
      const ordenados = [...lista].sort((a, b) => Number(sigueActivo(b)) - Number(sigueActivo(a)) || orden(a, b));
      const vivos = ordenados.filter(sigueActivo);
      return { dia, anuncios: ordenados, vivos: vivos.length, ganador: vivos.length === 1 ? vivos[0] : null };
    })
    .sort((a, b) => b.dia.localeCompare(a.dia));
}

// ─────────────────────────────────────────────────────────────────────────────
// La línea de tiempo
// ─────────────────────────────────────────────────────────────────────────────

/** Las ventanas que se pueden mirar: el último mes, los últimos tres y el último año. */
export const VENTANAS = [
  { dias: 30, rotulo: '30 días' },
  { dias: 90, rotulo: '90 días' },
  { dias: 365, rotulo: '1 año' },
] as const;

export type FilaTiempo<A> = { a: A; x0: number; x1: number; sigue: boolean; dias: number | null };

/**
 * Una barra por anuncio con los días que corrió, dentro de la ventana que termina hoy. `x0` y `x1` van de 0 a 1. Un anuncio que
 * terminó antes de la ventana no entra; uno que empezó antes, arranca en el borde. Sin fecha de inicio no hay barra que dibujar.
 * Primero los que siguen activos (lo que corre hoy) y, en cada grupo, el «Longest running» de Foreplay: más días al aire primero.
 */
export function lineaDeTiempo<A extends Pick<Pieza, 'publicada_en' | 'dejo_de_verse_en'>>(anuncios: readonly A[], ventanaDias: number, ahora: Date = new Date()): { desde: number; hasta: number; filas: FilaTiempo<A>[] } {
  const hasta = ahora.getTime();
  const desde = hasta - ventanaDias * DIA_MS;
  const ancho = hasta - desde;
  const borde = (t: number) => Math.min(1, Math.max(0, (t - desde) / ancho));
  const filas: FilaTiempo<A>[] = [];
  const orden = porDiasAlAire<A>(ahora);
  for (const a of [...anuncios].sort((a, b) => Number(sigueActivo(b)) - Number(sigueActivo(a)) || orden(a, b))) {
    const inicio = Date.parse(a.publicada_en ?? '');
    if (!Number.isFinite(inicio)) continue;
    // El día en que terminó cuenta entero: la barra llega a su fin, no a su comienzo.
    const finCrudo = a.dejo_de_verse_en ? Date.parse(a.dejo_de_verse_en) + DIA_MS : hasta;
    const fin = Number.isFinite(finCrudo) ? Math.min(finCrudo, hasta) : hasta;
    if (fin < desde || inicio > hasta) continue;
    const x0 = borde(inicio);
    // Un anuncio de un día se ve: al menos medio por ciento de ancho.
    const x1 = Math.max(borde(fin), Math.min(1, x0 + 0.005));
    filas.push({ a, x0, x1, sigue: sigueActivo(a), dias: diasAlAire(a, ahora) });
  }
  return { desde, hasta, filas };
}
