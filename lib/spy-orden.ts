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

import { NOMBRE_ETAPA, type EtapaTendencia, type TipoPieza } from './spy-reglas';

export type PiezaParaOrdenar = { id: number; canal: string; tipo: TipoPieza; etapa: EtapaTendencia | null };

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

const VARIOS: Record<TipoPieza, string> = { reel: 'Reels', publicacion: 'Publicaciones', video: 'Videos', anuncio: 'Anuncios', landing: 'Sitios' };
const ORDEN_ETAPA: ReadonlyArray<EtapaTendencia | null> = ['probado', 'ganando-traccion', 'test-nuevo', null];

/**
 * Las carpetas: por canal, formato y etapa, que es lo que Spy sabe de cada pieza. El sitio no va: es una página, no una publicación.
 * «Videos · Probado», o sólo «Videos» si no tiene etapa. Primero el formato y, adentro, de lo más probado a lo más nuevo.
 */
export function carpetasDe(piezas: readonly PiezaParaOrdenar[]): CarpetaOrden[] {
  const porClave = new Map<string, CarpetaOrden & { etapa: EtapaTendencia | null }>();
  for (const p of piezas) {
    if (p.canal === 'landing') continue;
    const clave = `${p.canal}|${p.tipo}|${p.etapa ?? ''}`;
    const ya = porClave.get(clave);
    if (ya) { ya.n += 1; ya.ids.push(p.id); continue; }
    const rotulo = p.etapa ? `${VARIOS[p.tipo]} · ${NOMBRE_ETAPA[p.etapa].rotulo}` : VARIOS[p.tipo];
    porClave.set(clave, { clave, canal: p.canal, tipo: p.tipo, rotulo, n: 1, ids: [p.id], etapa: p.etapa });
  }
  return [...porClave.values()]
    .sort((a, b) => a.canal.localeCompare(b.canal) || a.tipo.localeCompare(b.tipo) || ORDEN_ETAPA.indexOf(a.etapa) - ORDEN_ETAPA.indexOf(b.etapa))
    .map(({ etapa: _etapa, ...c }) => c);
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
