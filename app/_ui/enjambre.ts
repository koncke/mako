// =============================================================================
// _ui/enjambre — lo PURO de «los varios mouse trabajando a la vez» (Martín, 9/11/2026)
// =============================================================================
// Martín, por el reel que mandó para Web Replicate: «COPIAR ESTO… Sobre todo la animación de los multiples mouse actuando».
// Copiado del reel (referencias/reels-0911:web-replicate.mp4; la descripción cuadro por cuadro, en
// docs/relevo/web-replicate-nube.md): doce cursores, cada uno con su color, una flecha del color y al lado una pastilla con
// un robotito y su nombre en monoespaciada. Se mueven de a TIRONES: un salto corto que frena al llegar (ease-out) y una
// pausa de medio segundo a un segundo y medio; nunca un deslizamiento continuo.
//
// Acá vive lo que no depende de qué se arma (por eso en app/_ui, como armado-en-vivo.ts): quiénes son, el azar
// determinista, el paso del movimiento y el tecleo. Lo de la réplica (qué caja trabaja cada uno, cuándo) va en
// lib/editor-landing/replicar-escena.ts. Con test: tests/web-replicate-agentes.test.ts.
// =============================================================================

/** Un ayudante: su nombre (en la pastilla) y su color (la flecha y la pastilla; la letra va oscura encima). */
export type Agente = { id: string; nombre: string; color: string };

/**
 * Los doce del reel, con nombre de lo que hace MaKo al replicar. Los colores salen de los fotogramas (Scout azul, Layout
 * ámbar, Typeset menta, Copy cian, Lint blanco, Index verde, Palette amarillo, Images lima, Render lavanda, Motion rosa, QA
 * violeta, Deploy naranja). El orden importa: el dueño de cada caja sale de acá (`duenoDeCaja`).
 */
export const AGENTES: readonly Agente[] = [
  { id: 'lector', nombre: 'Lector', color: '#60A5FA' },
  { id: 'estructura', nombre: 'Estructura', color: '#F5B83D' },
  { id: 'titulos', nombre: 'Títulos', color: '#5EE6A8' },
  { id: 'textos', nombre: 'Textos', color: '#5CD3E0' },
  { id: 'revisor', nombre: 'Revisor', color: '#E5E7EB' },
  { id: 'botones', nombre: 'Botones', color: '#3DDC84' },
  { id: 'colores', nombre: 'Colores', color: '#F7DF5B' },
  { id: 'imagenes', nombre: 'Imágenes', color: '#B8E35A' },
  { id: 'fuentes', nombre: 'Fuentes', color: '#A5A6F6' },
  { id: 'animacion', nombre: 'Animación', color: '#F28CA8' },
  { id: 'calidad', nombre: 'Calidad', color: '#C4B5FD' },
  { id: 'armado', nombre: 'Armado', color: '#F59E4B' },
];

export type Punto = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

/** Un número en [0, 1) que sale siempre igual de la misma semilla (mulberry32): el baile no depende de Math.random. */
export function azar(semilla: number): number {
  let t = (Math.floor(semilla) + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Cuánto se acerca un cursor a su destino en `dtMs`: el tirón del reel. Suavizado exponencial (rápido al salir, frena al
 * llegar, nunca se pasa). `tauMs`: cuánto tarda en recorrer ~63 % del camino.
 */
export const TAU_SALTO_MS = 95;
export function acercar(actual: Punto, destino: Punto, dtMs: number, tauMs = TAU_SALTO_MS): Punto {
  const k = dtMs <= 0 ? 0 : 1 - Math.exp(-dtMs / Math.max(1, tauMs));
  return { x: actual.x + (destino.x - actual.x) * k, y: actual.y + (destino.y - actual.y) * k };
}

/** Lo mismo en una dimensión (la cámara que baja por la página). */
export const acercar1 = (actual: number, destino: number, dtMs: number, tauMs = 260): number =>
  acercar({ x: actual, y: 0 }, { x: destino, y: 0 }, dtMs, tauMs).x;

/** Las pausas del reel: entre `PAUSA_MIN_MS` y `PAUSA_MIN_MS + PAUSA_RANGO_MS` según el ayudante. */
export const PAUSA_MIN_MS = 520;
export const PAUSA_RANGO_MS = 1_000;
/** Lo lejos que salta un ayudante sin tarea, alrededor de su lugar (el reel: 50 a 100 px por tirón). */
export const RADIO_OCIO = 64;

/**
 * Dónde está parado un ayudante SIN tarea en el momento `ahora`: un lugar propio dentro de `zona` (lo que se ve) y, cada
 * pausa, un salto corto alrededor de él. Determinista: el mismo `i` y el mismo `ahora` dan el mismo punto.
 */
export function puntoOcioso(i: number, ahora: number, zona: Rect): Punto {
  const periodo = PAUSA_MIN_MS + azar(i * 31 + 7) * PAUSA_RANGO_MS;
  const fase = azar(i * 17 + 3) * periodo;
  const k = Math.floor((ahora + fase) / periodo);
  // Cada uno con su lugar en una grilla de 4 × 3 (con un corrimiento propio): sin tarea no se amontonan.
  const casaX = zona.x + ((i % 4) + 0.5 + (azar(i * 101 + 11) - 0.5) * 0.6) * (zona.w / 4);
  const casaY = zona.y + ((Math.floor(i / 4) % 3) + 0.5 + (azar(i * 211 + 13) - 0.5) * 0.6) * (zona.h / 3);
  const dx = (azar(i * 1009 + k * 7 + 1) - 0.5) * 2 * RADIO_OCIO;
  const dy = (azar(i * 2003 + k * 13 + 2) - 0.5) * 2 * RADIO_OCIO * 0.7;
  return dentro({ x: casaX + dx, y: casaY + dy }, zona);
}

/** Un punto adentro de `zona` (el cursor y su pastilla no se salen del escenario). */
export function dentro(p: Punto, zona: Rect, margenDerecho = 0): Punto {
  return {
    x: Math.min(Math.max(p.x, zona.x), zona.x + Math.max(0, zona.w - margenDerecho)),
    y: Math.min(Math.max(p.y, zona.y), zona.y + zona.h),
  };
}

/** El tecleo del reel: cuánto tarda cada letra y lo más que tarda un título entero. */
export const MS_POR_LETRA = 26;
export const TOPE_TECLEO_MS = 1_400;
/** Las letras que se ven «llegando» detrás de la última escrita (el reel las muestra a medio aparecer). */
export const COLA_TECLEO = 4;

/** Cuánto tarda en escribirse `texto` entero. */
export const duracionTecleo = (texto: string): number => Math.min(Array.from(texto).length * MS_POR_LETRA, TOPE_TECLEO_MS);

/** Cuántas letras de `texto` se ven a los `ms` de empezar a escribirlo (por punto de código: un emoji no se parte). */
export function letrasVisibles(texto: string, ms: number): number {
  const n = Array.from(texto).length;
  if (n === 0 || ms <= 0) return 0;
  const dur = duracionTecleo(texto);
  if (ms >= dur) return n;
  return Math.min(n, Math.floor((ms / dur) * n));
}
