// =============================================================================
// «Ordenar sus piezas»: las cuentas de la animación de Competitors Spy (1/11/2026)
// =============================================================================
// Martín: «https://yanny.space/studio/ ... la animación de "Sort my footage", que son las miniaturas de los videos/posteos y luego
// repartidas y ordenadas. Eso copialo para Competitors Spy». Medido cuadro por cuadro (es un video de 13 s): las miniaturas entran
// volando desde afuera y forman una bola, aparecen carpetas con nombre a los dos lados, y cada miniatura vuela a la suya y se acomoda en
// grilla mientras sube su cuenta. Acá está lo que se puede probar: qué carpetas hay y dónde cae cada cosa. Lo que se mueve es
// app/competitor-spy/OrdenSpy.tsx.
//
// ⚠️ ANIMA DATOS DE VERDAD: las carpetas y los números salen de lo que se acaba de leer. Si la lectura no trajo nada, no hay animación.
// Sin `server-only`: lo usan la pantalla y un test.

import type { EtapaTendencia, TipoPieza } from './spy-reglas';
import { TIPOS_CONTENIDO, tipoDeContenido } from './spy-vista';

/** `etapa` se acepta y no se usa desde el 4/11/2026 (ver `carpetasDe`). `duracion` separa un Short de un video largo. */
export type PiezaParaOrdenar = { id: number; canal: string; tipo: TipoPieza; etapa?: EtapaTendencia | null; duracion?: string | null };

export type CarpetaOrden = {
  clave: string;
  canal: string;
  tipo: TipoPieza;
  rotulo: string;
  /** Todas las que tiene, aunque no todas se dibujen. */
  n: number;
  ids: number[];
};

/** Más miniaturas que esto traban una computadora normal. El número que se lee sigue siendo el real (`CarpetaOrden.n`). */
export const TOPE_MINIATURAS = 140;

/** El orden de las carpetas: el de los tipos del desplegable de la ficha, y los anuncios al final. */
const ORDEN_GRUPO = [...TIPOS_CONTENIDO.filter((t) => t.value !== 'todo').map((t) => t.value as string), 'anuncios'];
const ROTULO_GRUPO: Record<string, string> = { ...Object.fromEntries(TIPOS_CONTENIDO.map((t) => [t.value, t.label])), anuncios: 'Anuncios' };

/**
 * Las carpetas: una por TIPO DE CONTENIDO —Reels, Carruseles e imágenes, Videos de YouTube, Shorts, Anuncios—, los mismos
 * del desplegable de la ficha. El sitio no va: es una página, no una publicación.
 *
 * ⚠️ HASTA EL 4/11/2026 IBAN POR FORMATO Y ETAPA («Videos · Probado»), y Martín: «"Sigue a la vista" y "Probado" no se
 * entiende qué hacen». Lo que pidió es contenido corto, contenido largo y carruseles (`tipoDeContenido`).
 */
export function carpetasDe(piezas: readonly PiezaParaOrdenar[]): CarpetaOrden[] {
  const porClave = new Map<string, CarpetaOrden>();
  for (const p of piezas) {
    if (p.canal === 'landing') continue;
    const grupo = p.canal === 'anuncios' ? 'anuncios' : tipoDeContenido({ canal: p.canal as never, tipo: p.tipo, duracion: p.duracion ?? null });
    if (!grupo) continue;
    const clave = `${p.canal}|${grupo}`;
    const ya = porClave.get(clave);
    if (ya) { ya.n += 1; ya.ids.push(p.id); continue; }
    porClave.set(clave, { clave, canal: p.canal, tipo: p.tipo, rotulo: ROTULO_GRUPO[grupo] ?? grupo, n: 1, ids: [p.id] });
  }
  const lugar = (c: CarpetaOrden) => ORDEN_GRUPO.indexOf(c.clave.split('|')[1]);
  return [...porClave.values()].sort((a, b) => lugar(a) - lugar(b));
}

/** Qué miniaturas se dibujan: todas si entran; si no, cada carpeta en proporción, y ninguna se queda sin mostrar la suya. */
export function repartirMiniaturas(carpetas: readonly CarpetaOrden[], tope = TOPE_MINIATURAS): Map<string, number[]> {
  const total = carpetas.reduce((s, c) => s + c.n, 0);
  const salida = new Map<string, number[]>();
  if (total <= tope) { for (const c of carpetas) salida.set(c.clave, [...c.ids]); return salida; }
  const cuantas = new Map(carpetas.map((c) => [c.clave, Math.max(1, Math.floor((c.n * tope) / total))]));
  let suma = [...cuantas.values()].reduce((s, n) => s + n, 0);
  for (const c of [...carpetas].sort((a, b) => b.n - a.n)) {
    if (suma >= tope) break;
    const lugar = Math.min(c.n - (cuantas.get(c.clave) ?? 0), tope - suma);
    cuantas.set(c.clave, (cuantas.get(c.clave) ?? 0) + lugar);
    suma += lugar;
  }
  for (const c of carpetas) salida.set(c.clave, c.ids.slice(0, cuantas.get(c.clave)));
  return salida;
}

// ── Dónde cae cada cosa ──────────────────────────────────────────────────────────────────────────────────────────────────

export type Punto = { x: number; y: number };
export type RectCarpeta = { clave: string; x: number; y: number; w: number; h: number; lado: number; huecos: Punto[] };
export type Disposicion = { centro: Punto; ladoBola: number; bola: Array<Punto & { rot: number }>; carpetas: RectCarpeta[] };

const CABEZA = 40;
const RELLENO = 10;
const ESPACIO = 8;

/** El lado más grande de miniatura con el que `m` entran en el área. Si ni a 10 px entran, 10: lo que no entra se apila en el último hueco. */
function ladoQueEntra(m: number, ancho: number, alto: number): { lado: number; cols: number } {
  for (let lado = 34; lado > 10; lado -= 1) {
    const cols = Math.max(1, Math.floor((ancho + 3) / (lado + 3)));
    if (Math.ceil(m / cols) * (lado + 3) - 3 <= alto) return { lado, cols };
  }
  return { lado: 10, cols: Math.max(1, Math.floor((ancho + 3) / 13)) };
}

function rectDe(clave: string, x: number, y: number, w: number, h: number, m: number): RectCarpeta {
  const { lado, cols } = ladoQueEntra(m, w - 2 * RELLENO, h - CABEZA - RELLENO);
  const filasQueEntran = Math.max(1, Math.floor((h - CABEZA - RELLENO + 3) / (lado + 3)));
  const huecos = Array.from({ length: m }, (_, i) => {
    const j = Math.min(i, cols * filasQueEntran - 1);
    return { x: x + RELLENO + (j % cols) * (lado + 3) + lado / 2, y: y + CABEZA + Math.floor(j / cols) * (lado + 3) + lado / 2 };
  });
  return { clave, x, y, w, h, lado, huecos };
}

/**
 * La bola: una espiral de girasol, que llena un círculo parejo sin grilla a la vista, con cada miniatura un poco torcida. Las carpetas: a
 * los dos lados de la bola, como en la referencia; en una pantalla angosta no entran, y van debajo.
 */
export function disponer(ancho: number, alto: number, carpetas: readonly CarpetaOrden[], visibles: ReadonlyMap<string, readonly number[]>): Disposicion {
  const n = [...visibles.values()].reduce((s, v) => s + v.length, 0);
  const angosta = ancho < 860;
  const rects: RectCarpeta[] = [];
  let centro: Punto;
  let radio: number;
  const k = carpetas.length;
  if (angosta) {
    const altoBola = Math.round(alto * 0.42);
    centro = { x: ancho / 2, y: altoBola / 2 };
    radio = Math.min(altoBola / 2 - 6, ancho / 2 - 6);
    const cols = k > 2 ? 2 : Math.max(1, k);
    const filas = Math.max(1, Math.ceil(k / cols));
    const w = (ancho - (cols - 1) * ESPACIO) / cols;
    const h = (alto - altoBola - (filas - 1) * ESPACIO) / filas;
    carpetas.forEach((c, i) => {
      rects.push(rectDe(c.clave, (i % cols) * (w + ESPACIO), altoBola + Math.floor(i / cols) * (h + ESPACIO), w, h, visibles.get(c.clave)?.length ?? 0));
    });
  } else {
    const w = Math.max(170, Math.min(250, ancho * 0.21));
    centro = { x: ancho / 2, y: alto / 2 };
    radio = Math.min(alto / 2 - 8, ancho / 2 - w - 22);
    const izquierda = Math.ceil(k / 2);
    const poner = (lista: readonly CarpetaOrden[], x: number) => {
      const h = lista.length ? Math.min((alto - (lista.length - 1) * ESPACIO) / lista.length, 260) : 0;
      const arranque = (alto - (lista.length * h + (lista.length - 1) * ESPACIO)) / 2;
      lista.forEach((c, i) => rects.push(rectDe(c.clave, x, arranque + i * (h + ESPACIO), w, h, visibles.get(c.clave)?.length ?? 0)));
    };
    poner(carpetas.slice(0, izquierda), 0);
    poner(carpetas.slice(izquierda), ancho - w);
  }
  const ladoBola = Math.max(20, Math.min(62, (radio * 1.72) / Math.sqrt(Math.max(1, n))));
  // Con pocas piezas la bola es chica y apretada, no unas sueltas en un círculo grande.
  const radioReal = Math.min(radio - ladoBola / 2, ladoBola * 0.62 * Math.sqrt(n));
  const bola = Array.from({ length: n }, (_, i) => {
    const r = radioReal * Math.sqrt((i + 0.5) / Math.max(1, n));
    const a = i * 2.399963;
    return { x: centro.x + r * Math.cos(a), y: centro.y + r * Math.sin(a), rot: ((i * 37) % 27) - 13 };
  });
  return { centro, ladoBola, bola, carpetas: rects };
}
