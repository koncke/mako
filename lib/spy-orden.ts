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
import { FORMATOS, esFormato, formatoPorTexto } from './spy-detalle';

/**
 * `etapa` se acepta y no se usa desde el 4/11/2026 (ver `carpetasDe`). `duracion` separa un Short de un video largo. El título,
 * el texto y el análisis dicen su FORMATO (Tutorial, Storytime…), que parte una carpeta grande en varias (12/11/2026).
 */
export type PiezaParaOrdenar = {
  id: number; canal: string; tipo: TipoPieza; etapa?: EtapaTendencia | null; duracion?: string | null;
  titulo?: string | null; texto?: string | null; analisis?: { formato?: string } | null;
};

export type CarpetaOrden = {
  clave: string;
  canal: string;
  tipo: TipoPieza;
  rotulo: string;
  /** La línea chica de la carpeta: de qué tipo de contenido es una carpeta de formato («Shorts»), o «Otros formatos». */
  detalle?: string;
  /** Todas las que tiene, aunque no todas se dibujen. */
  n: number;
  ids: number[];
};

/**
 * Más miniaturas que esto traban una computadora normal. El número que se lee sigue siendo el real (`CarpetaOrden.n`). Era 140
 * hasta el 12/11/2026; Martín: «que se vean más tarjetas». Se mueven sólo `transform` y `opacity` (OrdenSpy.tsx): 200 aguantan.
 */
export const TOPE_MINIATURAS = 200;

/**
 * Cuántas carpetas como mucho (12/11/2026, Martín: «que se acomoden no solamente en 2 cuadros, sino en más cuadros»). Con más, cada
 * una queda tan chica que las miniaturas no se ven: 4 por lado en una pantalla ancha.
 */
export const MAXIMO_CARPETAS = 8;
/** En el teléfono van DEBAJO de la bola, de a dos: con 8 cada una quedaba de 60 px y las miniaturas de 12 (mirado a 375). */
export const MAXIMO_CARPETAS_ANGOSTA = 4;
/** Un formato tiene su carpeta desde estas piezas: una carpeta de 1 es ruido. */
const MINIMO_POR_FORMATO = 2;
const ROTULO_FORMATO: Record<string, string> = Object.fromEntries(FORMATOS.map((f) => [f.value, f.label]));

/** Su formato: el que dijo la IA y, si no dijo ninguno (o «otro»), el que dice su título o su texto (`formatoPorTexto`). */
const formatoDePieza = (p: PiezaParaOrdenar): string => {
  const dicho = p.analisis?.formato;
  return esFormato(dicho) && dicho !== 'otro' ? dicho : formatoPorTexto(`${p.titulo ?? ''}\n${p.texto ?? ''}`);
};

/** El orden de las carpetas: el de los tipos del desplegable de la ficha, y los anuncios al final. */
const ORDEN_GRUPO = [...TIPOS_CONTENIDO.filter((t) => t.value !== 'todo').map((t) => t.value as string), 'anuncios'];
const ROTULO_GRUPO: Record<string, string> = { ...Object.fromEntries(TIPOS_CONTENIDO.map((t) => [t.value, t.label])), anuncios: 'Anuncios' };

/**
 * Las carpetas: una por TIPO DE CONTENIDO —Reels, Carruseles e imágenes, Videos de YouTube, Shorts, Anuncios—, los mismos
 * del desplegable de la ficha. El sitio no va: es una página, no una publicación.
 *
 * ⚠️ HASTA EL 4/11/2026 IBAN POR FORMATO Y ETAPA («Videos · Probado»), y Martín: «"Sigue a la vista" y "Probado" no se
 * entiende qué hacen». Lo que pidió es contenido corto, contenido largo y carruseles (`tipoDeContenido`).
 *
 * ⚠️ Y DESDE EL 12/11/2026, MÁS CARPETAS (Martín: «que se acomoden no solamente en 2 cuadros, sino en más cuadros»): mientras
 * entren (`maximo`), de cada tipo sale una carpeta por FORMATO —«Tutorial», «Storytime»—, la más grande primero. Lo que no tiene
 * formato, o tiene uno con menos de `MINIMO_POR_FORMATO`, queda en la del tipo («Otros formatos»). Sin formatos, como antes.
 */
export function carpetasDe(piezas: readonly PiezaParaOrdenar[], maximo = MAXIMO_CARPETAS): CarpetaOrden[] {
  type Base = CarpetaOrden & { grupo: string; porFormato: Map<string, number[]> };
  const porClave = new Map<string, Base>();
  for (const p of piezas) {
    if (p.canal === 'landing') continue;
    const grupo = p.canal === 'anuncios' ? 'anuncios' : tipoDeContenido({ canal: p.canal as never, tipo: p.tipo, duracion: p.duracion ?? null });
    if (!grupo) continue;
    const clave = `${p.canal}|${grupo}`;
    const b: Base = porClave.get(clave) ?? { clave, canal: p.canal, tipo: p.tipo, rotulo: ROTULO_GRUPO[grupo] ?? grupo, n: 0, ids: [], grupo, porFormato: new Map<string, number[]>() };
    porClave.set(clave, b);
    b.n += 1;
    b.ids.push(p.id);
    const f = formatoDePieza(p);
    if (f) b.porFormato.set(f, [...(b.porFormato.get(f) ?? []), p.id]);
  }
  const lugar = (g: string) => ORDEN_GRUPO.indexOf(g);
  const bases = [...porClave.values()].sort((a, b) => lugar(a.grupo) - lugar(b.grupo));

  // Los formatos que pueden tener su carpeta, el más grande primero. Sacar uno suma una carpeta; si se lleva TODAS las de su tipo, la
  // del tipo desaparece y la cuenta queda igual.
  const candidatos = bases.flatMap((b) => [...b.porFormato.entries()].filter(([, ids]) => ids.length >= MINIMO_POR_FORMATO).map(([f, ids]) => ({ b, f, ids })))
    .sort((x, y) => y.ids.length - x.ids.length);
  const quedan = new Map(bases.map((b) => [b.clave, b.n]));
  const elegidos = new Map<string, Array<{ f: string; ids: number[] }>>();
  let cuantas = bases.length;
  for (const c of candidatos) {
    const vacia = (quedan.get(c.b.clave) ?? 0) === c.ids.length;
    const suma = vacia ? 0 : 1;
    if (cuantas + suma > maximo) continue;
    cuantas += suma;
    quedan.set(c.b.clave, (quedan.get(c.b.clave) ?? 0) - c.ids.length);
    elegidos.set(c.b.clave, [...(elegidos.get(c.b.clave) ?? []), { f: c.f, ids: c.ids }]);
  }

  const salida: CarpetaOrden[] = [];
  for (const b of bases) {
    const suyas = elegidos.get(b.clave) ?? [];
    const fuera = new Set(suyas.flatMap((s) => s.ids));
    for (const s of suyas) {
      salida.push({ clave: `${b.clave}|${s.f}`, canal: b.canal, tipo: b.tipo, rotulo: ROTULO_FORMATO[s.f] ?? s.f, detalle: b.rotulo, n: s.ids.length, ids: s.ids });
    }
    const resto = b.ids.filter((id) => !fuera.has(id));
    if (resto.length) salida.push({ clave: b.clave, canal: b.canal, tipo: b.tipo, rotulo: b.rotulo, ...(suyas.length ? { detalle: 'Otros formatos' } : {}), n: resto.length, ids: resto });
  }
  return salida;
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

/** El lado de miniatura más grande en una carpeta (12/11/2026: era 34; con más carpetas y menos en cada una, que se vean). */
const LADO_MAXIMO = 46;
/** Entre la bola y las carpetas de cada lado. */
const HUECO_BOLA = 28;
/** Desde este ancho, las carpetas van a los costados de la bola; más angosta (el teléfono), debajo. Era 860, y una pantalla de 960
    (la escena mide ~850) dejaba la bola ARRIBA de todo (Martín, 12/11/2026: «se están agrupando alineado arriba del todo»). */
const ANCHO_A_LOS_COSTADOS = 640;

/** Cuántas carpetas entran en una escena de este ancho (se mide al montar la película, antes de armar las carpetas). */
export const maximoDeCarpetas = (ancho: number): number => (ancho < ANCHO_A_LOS_COSTADOS ? MAXIMO_CARPETAS_ANGOSTA : MAXIMO_CARPETAS);

/** El lado más grande de miniatura con el que `m` entran en el área. Si ni a 10 px entran, 10: lo que no entra se apila en el último hueco. */
function ladoQueEntra(m: number, ancho: number, alto: number): { lado: number; cols: number } {
  for (let lado = LADO_MAXIMO; lado > 10; lado -= 1) {
    const cols = Math.max(1, Math.floor((ancho + 3) / (lado + 3)));
    if (Math.ceil(m / cols) * (lado + 3) - 3 <= alto) return { lado, cols };
  }
  return { lado: 10, cols: Math.max(1, Math.floor((ancho + 3) / 13)) };
}

function rectDe(clave: string, x: number, y: number, w: number, h: number, m: number): RectCarpeta {
  const { lado, cols } = ladoQueEntra(m, w - 2 * RELLENO, h - CABEZA - RELLENO);
  const filasQueEntran = Math.max(1, Math.floor((h - CABEZA - RELLENO + 3) / (lado + 3)));
  // ⚠️ CENTRADAS EN SU CARPETA (12/11/2026, Martín: «quisiera que esté centrada»): antes arrancaban arriba a la izquierda, y una
  // carpeta con pocas quedaba con todo el espacio vacío abajo.
  const usadas = Math.max(1, Math.min(cols, m));
  const filas = Math.max(1, Math.min(filasQueEntran, Math.ceil(m / usadas)));
  const dx = Math.max(0, (w - 2 * RELLENO - (usadas * (lado + 3) - 3)) / 2);
  const dy = Math.max(0, (h - CABEZA - RELLENO - (filas * (lado + 3) - 3)) / 2);
  const huecos = Array.from({ length: m }, (_, i) => {
    const j = Math.min(i, cols * filasQueEntran - 1);
    return { x: x + RELLENO + dx + (j % cols) * (lado + 3) + lado / 2, y: y + CABEZA + dy + Math.floor(j / cols) * (lado + 3) + lado / 2 };
  });
  return { clave, x, y, w, h, lado, huecos };
}

/**
 * La bola: una espiral de girasol, que llena un círculo parejo sin grilla a la vista, con cada miniatura un poco torcida. Las carpetas: a
 * los dos lados de la bola, como en la referencia, y PEGADAS A ELLA (no a los bordes de la escena: todo junto en el medio); en una
 * pantalla angosta no entran, y van debajo.
 */
export function disponer(ancho: number, alto: number, carpetas: readonly CarpetaOrden[], visibles: ReadonlyMap<string, readonly number[]>): Disposicion {
  const n = [...visibles.values()].reduce((s, v) => s + v.length, 0);
  const angosta = ancho < ANCHO_A_LOS_COSTADOS;
  const rects: RectCarpeta[] = [];
  let centro: Punto;
  let radio: number;
  const k = carpetas.length;
  const ladoDe = (r: number) => Math.max(20, Math.min(62, (r * 1.72) / Math.sqrt(Math.max(1, n))));
  // Con pocas piezas la bola es chica y apretada, no unas sueltas en un círculo grande.
  const radioDe = (r: number) => Math.min(r - ladoDe(r) / 2, ladoDe(r) * 0.62 * Math.sqrt(n));
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
    const w = Math.max(150, Math.min(240, ancho * 0.2));
    centro = { x: ancho / 2, y: alto / 2 };
    radio = Math.min(alto / 2 - 8, ancho / 2 - w - HUECO_BOLA);
    // Cada columna, a `HUECO_BOLA` del borde de la bola (con un piso, que una bola chica no las amontone), sin salirse de la escena.
    const borde = Math.max(radioDe(radio) + ladoDe(radio) / 2, Math.min(radio, 120));
    const desdeElCentro = Math.min(ancho / 2 - w, borde + HUECO_BOLA);
    const izquierda = Math.ceil(k / 2);
    const poner = (lista: readonly CarpetaOrden[], x: number) => {
      const h = lista.length ? Math.min((alto - (lista.length - 1) * ESPACIO) / lista.length, 260) : 0;
      const arranque = (alto - (lista.length * h + (lista.length - 1) * ESPACIO)) / 2;
      lista.forEach((c, i) => rects.push(rectDe(c.clave, x, arranque + i * (h + ESPACIO), w, h, visibles.get(c.clave)?.length ?? 0)));
    };
    poner(carpetas.slice(0, izquierda), centro.x - desdeElCentro - w);
    poner(carpetas.slice(izquierda), centro.x + desdeElCentro);
  }
  const ladoBola = ladoDe(radio);
  const radioReal = radioDe(radio);
  const bola = Array.from({ length: n }, (_, i) => {
    const r = radioReal * Math.sqrt((i + 0.5) / Math.max(1, n));
    const a = i * 2.399963;
    return { x: centro.x + r * Math.cos(a), y: centro.y + r * Math.sin(a), rot: ((i * 37) % 27) - 13 };
  });
  return { centro, ladoBola, bola, carpetas: rects };
}
