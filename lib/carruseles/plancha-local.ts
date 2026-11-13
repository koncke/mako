// =============================================================================
// La plancha SIN IA de imagen: la lámina original sin sus letras, para escribir encima (PURO; 13/11/2026)
// =============================================================================
// Martín, 13/11/2026, mirando la réplica de @lifeofarjav («Claude + Hormozi = 100M Business»): «fíjate cómo quedaron los textos,
// no son igual a los de la referencia… se está replicando terriblemente mal». Y lo que vio: las láminas 2 a 6 sin las capturas
// de pantalla del original, sin el encabezado «© 2026 · @cuenta · 01 / 06», sin las palabras en naranja, y el titular cortado.
//
// La causa era de diseño, no de prompt: `documentoDeReplica` RE-DIBUJA la lámina con lo que la IA supo decir en un JSON (un color
// de fondo, cajas, líneas, textos). Una captura de pantalla, un logo o un ícono no se pueden decir en ese JSON, así que se
// perdían siempre. ./clon-fiel.ts ya lo había escrito el 7/11: lo editable viene DESPUÉS de lo fiel, primero «la plancha» (la
// imagen del original sin letras) y encima los textos. Faltaba quién hiciera la plancha: ./plancha.ts la pide a la IA de imagen
// (Flow), y sin Flow no había nada.
//
// Esto la hace SIN IA cuando se puede, que es en la mayoría de los carruseles de texto: las letras están sobre un fondo liso
// (o un degradé suave, o una tarjeta lisa).
//   1. LEER LA LÁMINA (`leerLamina`): sus renglones de texto y sus figuras (fotos, íconos, personas), detectados en los píxeles.
//      ⚠️ Las cajas que dice la IA NO sirven para borrar (medido el 13/11/2026 con @lifeofarjav y la IA de ws 9): el encabezado le
//      salió 35 px más arriba, un titular de dos renglones con la caja de uno, y a la persona de la portada no la marcó (la nombró
//      en su «lectura» y en «cuadros» puso el logo). Por eso los renglones y las figuras se detectan acá, y a cada texto se le
//      asignan sus renglones por el ORDEN (`asignarRenglones`); qué figura es una persona lo dice un segundo pedido con la figura
//      recortada (./plancha-servidor.ts → `completarLoQueFalta`).
//   2. MEDIR (`bloqueDeRenglones`): con los renglones de cada texto, su caja exacta, cuántos renglones son y a qué distancia van,
//      y el color de la letra. Con eso el texto nuevo va en el mismo lugar y con el mismo cuerpo que el original.
//   3. BORRAR (`borrarZona`): la caja se rellena con el fondo que la rodea, interpolado de izquierda a derecha en cada fila (un
//      degradé no deja un parche). Sólo si lo que rodea es parejo: sobre una foto o una textura NO se toca, y la lámina se arma
//      como antes (no hay plancha a medias: un texto quemado debajo del nuevo se ve dos veces).
// La persona del original se borra igual: en su lugar va la del negocio GENERADA con la IA de imagen, nunca su foto pegada
// (Martín, 13/11: «no que de pronto me ponga mi imagen. Queda muy, muy feo»).
//
// Puro: trabaja sobre los píxeles RGBA de la lámina. Leer el JPEG, marcarlo y subir la plancha lo hace ./plancha-servidor.ts
// (sharp). Lo prueba tests/carruseles-plancha-local.test.ts con láminas dibujadas a mano.
// =============================================================================

import type { Caja } from './tipografia-medida';

/** Los píxeles de una lámina: RGBA, 4 bytes por píxel, fila por fila. */
export type Rgba = { ancho: number; alto: number; px: Uint8Array | Uint8ClampedArray };
type Color = readonly [number, number, number];

const pixel = (img: Rgba, x: number, y: number): Color => {
  const i = (y * img.ancho + x) * 4;
  return [img.px[i], img.px[i + 1], img.px[i + 2]];
};
const distancia = (a: Color, b: Color): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const hex = (c: Color): string => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
const dentro = (img: Rgba, c: Caja): Caja => {
  const x = Math.max(0, Math.floor(c.x));
  const y = Math.max(0, Math.floor(c.y));
  return { x, y, ancho: Math.max(0, Math.min(img.ancho, Math.ceil(c.x + c.ancho)) - x), alto: Math.max(0, Math.min(img.alto, Math.ceil(c.y + c.alto)) - y) };
};

/** El color que más se repite en una zona (redondeado a 32 niveles por canal; se devuelve el promedio de los que cayeron ahí). */
export function colorDominante(img: Rgba, zona: Caja, saltear?: (x: number, y: number) => boolean): Color {
  const z = dentro(img, zona);
  const cubos = new Map<number, [number, number, number, number]>();
  const paso = Math.max(1, Math.floor(Math.sqrt((z.ancho * z.alto) / 40_000)));
  for (let y = z.y; y < z.y + z.alto; y += paso) {
    for (let x = z.x; x < z.x + z.ancho; x += paso) {
      if (saltear?.(x, y)) continue;
      const [r, g, b] = pixel(img, x, y);
      const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      const c = cubos.get(k) ?? [0, 0, 0, 0];
      c[0] += r; c[1] += g; c[2] += b; c[3] += 1;
      cubos.set(k, c);
    }
  }
  let mejor: [number, number, number, number] | null = null;
  for (const c of cubos.values()) if (!mejor || c[3] > mejor[3]) mejor = c;
  return mejor ? [mejor[0] / mejor[3], mejor[1] / mejor[3], mejor[2] / mejor[3]] : [255, 255, 255];
}

// ── Leer la lámina: sus renglones de texto y sus figuras ─────────────────────────────────────────────────────────────────

/** El lado de una baldosa: el fondo se toma por baldosa (una tarjeta blanca sobre crema tiene su propio fondo). */
const BALDOSA = 48;
/** Un píxel es tinta si se aparta así del fondo de su baldosa (el blanco de una tarjeta sobre crema queda debajo, ~30). */
export const TINTA_DE_LAMINA = 70;

/** Un renglón de texto detectado (sus letras, juntas) y una figura (lo que no es texto: una foto, un ícono, una persona). */
export type Renglon = { n: number; caja: Caja };
export type Figura = { n: string; caja: Caja };
export type LecturaDeLamina = { renglones: Renglon[]; figuras: Figura[] };

/**
 * El fondo de cada baldosa: el color dominante de ella Y sus vecinas (una ventana de 3 × 3 baldosas). Con la baldosa sola, una
 * letra gruesa y grande la cubría casi entera, su color pasaba a ser «el fondo» y la letra dejaba de ser tinta (13/11/2026: un
 * titular quedaba cortado en un renglón de cuatro letras y una «figura» con el resto).
 */
function fondosPorBaldosa(img: Rgba): { cols: number; colores: Color[] } {
  const cols = Math.ceil(img.ancho / BALDOSA);
  const filas = Math.ceil(img.alto / BALDOSA);
  const colores: Color[] = [];
  for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) colores.push(colorDominante(img, { x: (c - 1) * BALDOSA, y: (f - 1) * BALDOSA, ancho: 3 * BALDOSA, alto: 3 * BALDOSA }));
  return { cols, colores };
}

type Mancha = [number, number, number, number, number];
/** Las manchas de tinta (8 vecinos) con su caja: [x0, y0, x1, y1, píxeles]. */
function manchas(tinta: Uint8Array, W: number, H: number): Mancha[] {
  const padre = new Int32Array(W * H).fill(-1);
  const raiz = (a: number): number => { while (padre[a] !== a) { padre[a] = padre[padre[a]]; a = padre[a]; } return a; };
  const unir = (a: number, b: number) => { const x = raiz(a); const y = raiz(b); if (x !== y) padre[y] = x; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x;
    if (!tinta[k]) continue;
    padre[k] = k;
    if (x > 0 && tinta[k - 1]) unir(k - 1, k);
    if (y > 0) {
      if (tinta[k - W]) unir(k - W, k);
      if (x > 0 && tinta[k - W - 1]) unir(k - W - 1, k);
      if (x < W - 1 && tinta[k - W + 1]) unir(k - W + 1, k);
    }
  }
  const cajas = new Map<number, Mancha>();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x;
    if (!tinta[k]) continue;
    const r = raiz(k);
    const c = cajas.get(r);
    if (!c) cajas.set(r, [x, y, x, y, 1]);
    else { if (x < c[0]) c[0] = x; if (y < c[1]) c[1] = y; if (x > c[2]) c[2] = x; if (y > c[3]) c[3] = y; c[4]++; }
  }
  return [...cajas.values()];
}

/** Cuánto se pisan dos cajas [x0, y0, x1, y1] de arriba a abajo (negativo: hay un hueco). */
const solapeVertical = (a: readonly number[], b: readonly number[]) => Math.min(a[3], b[3]) - Math.max(a[1], b[1]);

/**
 * El renglón [x0, y0, x1, y1, letras, suma de altos] sin el ícono de sus puntas: la primera o la última mancha, si es más del
 * 1,8 veces más alta que la letra típica del renglón (la mediana de las del medio) y casi cuadrada (no una «l» ni un paréntesis:
 * una mayúscula mide 1,3 a 1,5 veces una minúscula). Con menos de cuatro manchas, el renglón queda como está.
 */
export function sinIconoEnLasPuntas(l: readonly number[], manchas: ReadonlyArray<readonly number[]>): number[] {
  if (manchas.length < 4) return [...l];
  const ps = [...manchas].sort((a, b) => a[0] - b[0]);
  const alto = (g: readonly number[]) => g[3] - g[1] + 1;
  const altos = ps.slice(1, -1).map(alto).sort((a, b) => a - b);
  const tipica = altos[Math.floor(altos.length / 2)];
  const esIcono = (g: readonly number[]) => alto(g) > 1.8 * tipica && g[2] - g[0] + 1 >= 0.6 * alto(g);
  const quedan = ps.filter((g, i) => !((i === 0 || i === ps.length - 1) && esIcono(g)));
  if (quedan.length === ps.length) return [...l];
  return [
    Math.min(...quedan.map((g) => g[0])), Math.min(...quedan.map((g) => g[1])), Math.max(...quedan.map((g) => g[2])), Math.max(...quedan.map((g) => g[3])),
    quedan.length, quedan.reduce((s, g) => s + alto(g), 0),
  ];
}

/**
 * Los renglones de texto y las figuras de una lámina. Una letra es una mancha de tinta del tamaño de una letra; un renglón, las
 * letras que comparten franja y están a menos de un espacio grande una de otra (las palabras se unen; el «© 2026» y el «01 / 06»
 * de un encabezado, no). Una figura es la tinta que no es de ningún renglón (una foto, un ícono grande, una persona), agrupada.
 */
export function leerLamina(img: Rgba): LecturaDeLamina {
  const W = img.ancho;
  const H = img.alto;
  const { cols, colores } = fondosPorBaldosa(img);
  const tinta = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (distancia(pixel(img, x, y), colores[Math.floor(y / BALDOSA) * cols + Math.floor(x / BALDOSA)]) > TINTA_DE_LAMINA) tinta[y * W + x] = 1;
  }
  const letras = manchas(tinta, W, H).filter((c) => {
    const w = c[2] - c[0] + 1;
    const h = c[3] - c[1] + 1;
    return h >= 5 && h <= 0.17 * H && w <= 0.42 * W && c[4] >= 6 && !(h <= 4 && w > 30) && !(w > 8 * h && h < 10);
  }).sort((a, b) => a[0] - b[0]);
  // Letras → renglones, de izquierda a derecha; después, los pedazos de un mismo renglón que quedaron separados se unen.
  // Cada renglón lleva la suma de los altos de sus letras ([x0, y0, x1, y1, letras, suma de altos]) y se compara por el alto
  // PROMEDIO de sus letras, no por su caja: la caja crece con cada letra que entra y terminaba aceptando un globo de chat y después
  // un ícono redondo, uno más grande que el otro (13/11/2026, la caja «Comment GIFT» de @lifeofarjav: un «renglón» de 114 px).
  const promedio = (L: readonly number[]) => L[5] / L[4];
  // Las manchas de cada renglón, para sacarle después un ícono de las puntas (`sinIconoEnLasPuntas`).
  const piezas = new Map<number[], number[][]>();
  let lineas: number[][] = [];
  for (const g of letras) {
    const h = g[3] - g[1] + 1;
    const l = lineas.find((L) => {
      const lh = promedio(L);
      return solapeVertical(L, g) >= 0.4 * Math.min(h, lh) && g[0] - L[2] <= 0.9 * Math.max(lh, h) && Math.max(h, lh) <= 2.2 * Math.min(h, lh) + 4;
    });
    if (l) { l[0] = Math.min(l[0], g[0]); l[1] = Math.min(l[1], g[1]); l[2] = Math.max(l[2], g[2]); l[3] = Math.max(l[3], g[3]); l[4]++; l[5] += h; piezas.get(l)!.push(g); }
    else { const nueva = [g[0], g[1], g[2], g[3], 1, h]; lineas.push(nueva); piezas.set(nueva, [g]); }
  }
  for (let cambio = true; cambio;) {
    cambio = false;
    lineas.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < lineas.length && !cambio; i++) {
      for (let j = i + 1; j < lineas.length && !cambio; j++) {
        const a = lineas[i];
        const b = lineas[j];
        const ha = promedio(a);
        const hb = promedio(b);
        const hueco = Math.max(a[0], b[0]) - Math.min(a[2], b[2]);
        if (solapeVertical(a, b) >= 0.6 * Math.min(a[3] - a[1], b[3] - b[1]) && hueco <= 1.3 * Math.max(ha, hb) && Math.max(ha, hb) <= 1.6 * Math.min(ha, hb) + 4) {
          lineas[i] = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3]), a[4] + b[4], a[5] + b[5]];
          piezas.set(lineas[i], [...(piezas.get(a) ?? []), ...(piezas.get(b) ?? [])]);
          lineas.splice(j, 1);
          cambio = true;
        }
      }
    }
  }
  // Un ÍCONO en la punta de un renglón (el ✳ antes de «Follow @lifeofarjav for more…», el logo antes del @ del encabezado) no es
  // una letra: entraba con la primera mayúscula, el renglón medía el doble de alto, el texto nuevo salía con la letra el doble de
  // grande y el ícono se borraba (13/11/2026, el pie de la lámina 6 en producción). Se saca del renglón: queda en la plancha y el
  // texto nuevo va a su lado, con el tamaño de las letras.
  lineas = lineas.map((l) => sinIconoEnLasPuntas(l, piezas.get(l) ?? []));
  // Un renglón de una sola mancha es un signo suelto, salvo que sea ANCHO: una pastilla lisa (su letra blanca no es tinta sobre la
  // lámina crema) es una sola mancha.
  lineas = lineas.filter((l) => (l[4] >= 2 || l[2] - l[0] >= 2.5 * (l[3] - l[1])) && l[3] - l[1] + 1 >= 8).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const renglones: Renglon[] = lineas.map((l, i) => ({ n: i + 1, caja: { x: l[0], y: l[1], ancho: l[2] - l[0] + 1, alto: l[3] - l[1] + 1 } }));
  // Figuras: la tinta que no es de ningún renglón, por celdas; las celdas ocupadas y vecinas son una figura.
  const CELDA = 16;
  const cc = Math.ceil(W / CELDA);
  const cf = Math.ceil(H / CELDA);
  const enRenglon = new Uint8Array(W * H);
  for (const r of renglones) for (let y = r.caja.y; y < r.caja.y + r.caja.alto; y++) enRenglon.fill(1, y * W + r.caja.x, y * W + r.caja.x + r.caja.ancho);
  const llena = new Uint8Array(cc * cf);
  for (let f = 0; f < cf; f++) {
    for (let c = 0; c < cc; c++) {
      let n = 0;
      for (let y = f * CELDA; y < Math.min(H, f * CELDA + CELDA); y++) for (let x = c * CELDA; x < Math.min(W, c * CELDA + CELDA); x++) { const k = y * W + x; if (tinta[k] && !enRenglon[k]) n++; }
      if (n >= 0.15 * CELDA * CELDA) llena[f * cc + c] = 1;
    }
  }
  const visto = new Uint8Array(cc * cf);
  const figuras: Figura[] = [];
  for (let k0 = 0; k0 < llena.length; k0++) {
    if (!llena[k0] || visto[k0]) continue;
    const pila = [k0];
    visto[k0] = 1;
    let x0 = Infinity; let y0 = Infinity; let x1 = -1; let y1 = -1;
    while (pila.length) {
      const k = pila.pop()!;
      const c = k % cc;
      const f = (k - c) / cc;
      x0 = Math.min(x0, c); y0 = Math.min(y0, f); x1 = Math.max(x1, c); y1 = Math.max(y1, f);
      // Vecinas hasta a dos celdas: una foto con partes claras sigue siendo UNA figura.
      for (let df = -2; df <= 2; df++) {
        for (let dc = -2; dc <= 2; dc++) {
          const ff = f + df;
          const c2 = c + dc;
          if (ff < 0 || c2 < 0 || ff >= cf || c2 >= cc) continue;
          const k2 = ff * cc + c2;
          if (llena[k2] && !visto[k2]) { visto[k2] = 1; pila.push(k2); }
        }
      }
    }
    const caja = { x: x0 * CELDA, y: y0 * CELDA, ancho: Math.min(W, (x1 + 1) * CELDA) - x0 * CELDA, alto: Math.min(H, (y1 + 1) * CELDA) - y0 * CELDA };
    if (caja.ancho * caja.alto >= (0.06 * W) ** 2 && !(caja.ancho > 0.95 * W && caja.alto > 0.95 * H)) figuras.push({ n: `F${figuras.length + 1}`, caja });
  }
  // Un «renglón» adentro de una figura es parte de la imagen (la tapa de un libro, el estampado de una remera): no es un texto
  // de la lámina. Uno sobre una foto tampoco se podría borrar.
  const adentro = (r: Renglon) => figuras.some((f) => {
    const w = Math.min(r.caja.x + r.caja.ancho, f.caja.x + f.caja.ancho) - Math.max(r.caja.x, f.caja.x);
    const h = Math.min(r.caja.y + r.caja.alto, f.caja.y + f.caja.alto) - Math.max(r.caja.y, f.caja.y);
    return w > 0 && h > 0 && w * h >= 0.7 * r.caja.ancho * r.caja.alto;
  });
  return { renglones: renglones.filter((r) => !adentro(r)).map((r, i) => ({ ...r, n: i + 1 })), figuras };
}

/** Lo que se midió de un texto en la lámina original. */
export type Bloque = {
  /** La caja EXACTA de sus renglones, en píxeles de la lámina. */
  caja: Caja;
  /** Cuántos renglones tiene (dos pedazos en la misma franja son uno). */
  renglones: number;
  /** De la parte de arriba de un renglón a la del siguiente (0 con un renglón). */
  paso: number;
  /** El alto del renglón más alto (de la letra más alta a la que más baja). */
  altoRenglon: number;
  /** El color de las letras (el que más se repite en la tinta) y el del fondo que las rodea. */
  tinta: string;
  fondo: string;
  /**
   * Si el texto va sobre una PASTILLA (una etiqueta «STEP 1»: la caja medida es la pastilla entera, de un color que no es el de la
   * lámina): su color y la caja de la letra de adentro. La pastilla se queda en la plancha (redonda y de su color exacto) y sólo
   * se borra su letra (13/11/2026: rehecha como resaltado del texto salía cuadrada y de otro naranja).
   */
  pastilla?: { color: string; letra: Caja; contorno?: boolean };
  /** La caja de cada renglón (de arriba a abajo), y lo que se midió de ellos: la alineación y las palabras de otro color. */
  franjas: Caja[];
  /** ¿Sobre el fondo de la lámina (true) o adentro de una caja o una tarjeta (false)? */
  principal?: boolean;
  /** El grosor del trazo de la letra en píxeles (la mediana de los tramos de tinta a lo ancho, en la mitad del renglón): con el
   *  cuerpo de la letra, dice si es regular o negrita (`pesoMedido` en ./replica.ts). 0 = no se pudo medir. */
  trazo?: number;
  alineacion?: 'left' | 'center' | 'right';
  acento?: { color: string; tramos: Array<Array<[number, number]>> };
};

/**
 * El renglón estirado a lo ancho hasta su última tinta: un signo suelto («=», una coma, un punto) no llega a ser una letra para
 * `leerLamina` (es chico o más bajo que el resto) y quedaba en la plancha. Se sigue mientras haya tinta a menos de medio renglón.
 */
function conSusSignos(img: Rgba, r: Caja): Caja {
  const fondo = colorDominante(img, { x: r.x - 8, y: r.y - 4, ancho: r.ancho + 16, alto: r.alto + 8 }, (x, y) => x >= r.x && x < r.x + r.ancho && y >= r.y && y < r.y + r.alto);
  const conTinta = (x: number) => { for (let y = r.y; y < r.y + r.alto; y++) if (distancia(pixel(img, x, y), fondo) > TINTA_DE_LAMINA) return true; return false; };
  const hueco = Math.max(4, Math.round(0.45 * r.alto));
  let x0 = r.x;
  for (let x = r.x - 1, sin = 0; x >= 0 && sin <= hueco; x--) { if (conTinta(x)) { x0 = x; sin = 0; } else sin++; }
  let x1 = r.x + r.ancho - 1;
  for (let x = r.x + r.ancho, sin = 0; x < img.ancho && sin <= hueco; x++) { if (conTinta(x)) { x1 = x; sin = 0; } else sin++; }
  return { x: x0, y: r.y, ancho: x1 - x0 + 1, alto: r.alto };
}

/**
 * Un texto de la IA, para buscarle sus renglones: su caja aproximada (px), su cuerpo, cuántos renglones, cómo se alinea y qué
 * ancho tendría su renglón más largo con ese cuerpo (`anchoEsperado`, medido con lo que dice: el que llama lo mide, ./medir-letra.ts).
 */
export type TextoABuscar = { x: number; y: number; ancho: number; em: number; renglones: number; alinear: 'left' | 'center' | 'right'; anchoEsperado?: number };

/** Lo que cuesta dejar un texto de la IA sin renglones (no se encontró): más que casi cualquier parecido flojo. */
const SIN_ENCONTRAR = 2.6;
/** Un bloque más lejos que esto no es de ese texto, aunque el orden lo permita. */
const COSTO_MAXIMO = 3.4;

/**
 * Qué tan lejos está un bloque de renglones de un texto de la IA. La IA ubica MAL (medido el 13/11: 35 px en un encabezado, 290
 * px en un subtítulo, un renglón de más o de menos), pero el TAMAÑO de la letra y el anclaje según la alineación casi no los
 * erra: pesan esos, y el alto muy poco.
 */
function costoDeBloque(t: TextoABuscar, b: readonly Renglon[], W: number): number {
  const x0 = Math.min(...b.map((r) => r.caja.x));
  const x1 = Math.max(...b.map((r) => r.caja.x + r.caja.ancho));
  const ancla = t.alinear === 'center' ? Math.abs((x0 + x1) / 2 - (t.x + t.ancho / 2)) : t.alinear === 'right' ? Math.abs(x1 - (t.x + t.ancho)) : Math.abs(x0 - t.x);
  // El ancho del renglón más largo contra el que tendría lo que dice: una pastilla «STEP 3» no es «Tell it How to Act».
  // Pesa más que el alto (13/11/2026): un ícono pegado agranda el alto de un renglón, no su ancho.
  const ancho = t.anchoEsperado ? 2 * Math.abs(Math.log((x1 - x0) / t.anchoEsperado)) : 0;
  return Math.min(1.2, 0.08 * Math.abs(b[0].caja.y - t.y) / t.em) + (4 * ancla) / W + (2 * b.reduce((a, r) => a + Math.abs(Math.log(r.caja.alto / (0.85 * t.em))), 0)) / b.length + 0.35 * Math.abs(b.length - t.renglones) + ancho;
}

/** Lo que cuesta saltear un renglón de la lámina (no es de ningún texto de la IA): poco si es chico (la letra de una captura). */
const salteo = (r: Renglon, masAlto: number) => 0.05 + 0.6 * (r.caja.alto / masAlto);

/** En orden de lectura: por franjas de arriba a abajo (lo que se pisa a lo alto es la misma franja) y en cada una de izquierda a
 *  derecha. Un encabezado «© 2026 · @cuenta · 01 / 06» sale en ese orden, aunque el «01 / 06» empiece un píxel más arriba. */
function enOrdenDeLectura<T>(xs: readonly T[], caja: (x: T) => { x: number; y: number; alto: number }): T[] {
  const orden = [...xs].sort((a, b) => caja(a).y - caja(b).y);
  const franjas: T[][] = [];
  for (const x of orden) {
    const c = caja(x);
    const f = franjas[franjas.length - 1];
    const u = f ? caja(f[0]) : null;
    if (f && u && c.y < u.y + 0.6 * Math.min(u.alto, c.alto)) f.push(x);
    else franjas.push([x]);
  }
  return franjas.flatMap((f) => f.sort((a, b) => caja(a).x - caja(b).x));
}

/**
 * Los renglones de cada texto de la IA (13/11/2026). La IA NO sirve para decir qué renglón es cuál: con los renglones numerados
 * sobre la lámina, inventó su propia cuenta (1, 2, 3… en el orden en que leía) y le dio el renglón 1 a cuatro textos. Y sus
 * cajas están corridas. Lo que sí respeta es el ORDEN: lista los textos de arriba a abajo. Así que se alinean las dos listas en
 * orden (los textos de la IA y los renglones de la lámina, los dos en orden de lectura), como dos secuencias: cada texto se lleva
 * uno o más renglones SEGUIDOS (uno debajo del otro, alineados), un renglón que la IA no listó se saltea (la letra de una captura),
 * y un texto que no encaja en ningún lado queda sin renglones (`[]`). Se elige la alineación más barata (programación dinámica).
 */
export function asignarRenglones(textos: readonly TextoABuscar[], renglones: readonly Renglon[], W: number): number[][] {
  const out: number[][] = textos.map(() => []);
  if (!textos.length || !renglones.length) return out;
  const L = enOrdenDeLectura(renglones, (r) => ({ x: r.caja.x, y: r.caja.y, alto: r.caja.alto }));
  const idx = enOrdenDeLectura(textos.map((t, i) => ({ t, i })), ({ t }) => ({ x: t.x, y: t.y, alto: t.em }));
  const masAlto = Math.max(...L.map((r) => r.caja.alto));
  // ¿Los renglones j..j+k-1 son un bloque? Cada uno debajo del anterior, sin un hueco grande, y pisándose a lo ancho.
  const esBloque = (j: number, k: number) => {
    for (let q = j + 1; q < j + k; q++) {
      const u = L[q - 1].caja;
      const s = L[q].caja;
      const hueco = s.y - (u.y + u.alto);
      if (hueco < -0.3 * u.alto || hueco > 1.2 * Math.max(u.alto, s.alto)) return false;
      if (Math.min(u.x + u.ancho, s.x + s.ancho) - Math.max(u.x, s.x) < 0.3 * Math.min(u.ancho, s.ancho)) return false;
      // Una pastilla chica arriba de un titular no es su primer renglón.
      if (Math.max(u.alto, s.alto) > 1.45 * Math.min(u.alto, s.alto)) return false;
    }
    return true;
  };
  const m = idx.length;
  const n = L.length;
  const MAX_K = 6;
  const costo: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(Infinity));
  const vino: Array<Array<{ i: number; j: number; k: number } | null>> = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(null));
  costo[0][0] = 0;
  for (let i = 0; i <= m; i++) {
    for (let j = 0; j <= n; j++) {
      const c = costo[i][j];
      if (!Number.isFinite(c)) continue;
      const probar = (i2: number, j2: number, c2: number, k: number) => { if (c2 < costo[i2][j2]) { costo[i2][j2] = c2; vino[i2][j2] = { i, j, k }; } };
      if (j < n) probar(i, j + 1, c + salteo(L[j], masAlto), 0);
      if (i < m) {
        probar(i + 1, j, c + SIN_ENCONTRAR, 0);
        for (let k = 1; k <= MAX_K && j + k <= n; k++) {
          if (!esBloque(j, k)) break;
          const cb = costoDeBloque(idx[i].t, L.slice(j, j + k), W);
          if (cb <= COSTO_MAXIMO) probar(i + 1, j + k, c + cb, k);
        }
      }
    }
  }
  for (let i = m, j = n; i > 0 || j > 0;) {
    const v = vino[i][j];
    if (!v) break;
    if (v.i === i - 1 && v.k > 0) out[idx[i - 1].i] = L.slice(v.j, v.j + v.k).map((r) => r.n);
    i = v.i;
    j = v.j;
  }
  // Un bloque que no tiene el ancho de lo que dice (menos de la mitad o más del doble) no es de ese texto: el orden lo dejó pasar
  // igual. 13/11/2026, lámina 6 de @lifeofarjav: el pie «Síguenos para más…» se llevó el segundo renglón de la caja de «Comenta…»
  // (300 px contra 700 esperados) y el pie del original, con su @, quedó quemado. Suelto, ese renglón vuelve a su texto (abajo) y
  // el pie queda sin dueño para el segundo pedido.
  const porN = new Map(L.map((r) => [r.n, r]));
  out.forEach((rs, i) => {
    const t = textos[i];
    if (!rs.length || !t.anchoEsperado) return;
    const x0 = Math.min(...rs.map((n) => porN.get(n)!.caja.x));
    const x1 = Math.max(...rs.map((n) => porN.get(n)!.caja.x + porN.get(n)!.caja.ancho));
    const razon = (x1 - x0) / t.anchoEsperado;
    if (razon < 0.45 || razon > 2.2) out[i] = [];
  });
  // Un texto cuyo bloque queda ADENTRO del bloque de otro es el mismo texto dicho dos veces (13/11/2026: la IA listó «STEP 2» dos
  // veces, una se llevó el contorno de la etiqueta y la otra su letra, y salía «PASO 2» encima de «PASO 2»).
  const cajaDeTexto = (rs: readonly number[]) => cajaDe(rs.map((n) => porN.get(n)!));
  out.forEach((rs, j) => {
    if (!rs.length) return;
    const c = cajaDeTexto(rs);
    const dueno = out.some((otro, i) => i !== j && otro.length && (() => {
      const o = cajaDeTexto(otro);
      return c.x >= o.x && c.y >= o.y && c.x + c.ancho <= o.x + o.ancho && c.y + c.alto <= o.y + o.alto && (o.ancho > c.ancho || o.alto > c.alto || i < j);
    })());
    if (dueno) out[j] = [];
  });
  // Un renglón que sigue PEGADO debajo de un texto y no es de nadie es su continuación: la IA contó «Turn Claude into your…
  // step by step.» como un renglón, y el «step by step.» (otra letra, en itálica) quedaba quemado en la plancha.
  const usados = new Set(out.flat());
  const porNumero = new Map(L.map((r) => [r.n, r]));
  for (const rs of out) {
    for (let seguir = rs.length > 0; seguir;) {
      seguir = false;
      const u = porNumero.get(rs[rs.length - 1])!.caja;
      const s = L.find((r) => {
        if (usados.has(r.n)) return false;
        const hueco = r.caja.y - (u.y + u.alto);
        const pisa = Math.min(u.x + u.ancho, r.caja.x + r.caja.ancho) - Math.max(u.x, r.caja.x);
        return hueco >= -0.2 * u.alto && hueco <= 0.6 * u.alto && pisa >= 0.3 * Math.min(u.ancho, r.caja.ancho) && r.caja.alto <= 1.35 * u.alto && r.caja.alto >= 0.62 * u.alto;
      });
      if (s) { rs.push(s.n); usados.add(s.n); seguir = true; }
    }
  }
  // Un signo SUELTO en la franja de un texto, pegado a él, es de ese texto: el «=» de «= 100M Business» son dos barras, dos
  // «renglones» chicos a la izquierda del titular (13/11/2026), que quedaban sin dueño, iban al segundo pedido como si fueran un
  // texto y, sin borrar, asomaban detrás del titular nuevo.
  for (const rs of out) {
    for (const n of [...rs]) {
      const u = porNumero.get(n)!.caja;
      for (const r of L) {
        if (usados.has(r.n) || r.caja.alto > 0.6 * u.alto) continue;
        const enSuFranja = r.caja.y >= u.y - 0.1 * u.alto && r.caja.y + r.caja.alto <= u.y + 1.1 * u.alto;
        const hueco = Math.max(r.caja.x - (u.x + u.ancho), u.x - (r.caja.x + r.caja.ancho));
        if (enSuFranja && hueco <= 0.8 * u.alto) { rs.push(r.n); usados.add(r.n); }
      }
    }
  }
  return out;
}

/** La caja que junta varios renglones. */
export const cajaDe = (rs: readonly Renglon[]): Caja => {
  const x0 = Math.min(...rs.map((r) => r.caja.x));
  const y0 = Math.min(...rs.map((r) => r.caja.y));
  return { x: x0, y: y0, ancho: Math.max(...rs.map((r) => r.caja.x + r.caja.ancho)) - x0, alto: Math.max(...rs.map((r) => r.caja.y + r.caja.alto)) - y0 };
};

/**
 * Los bloques de texto PRINCIPALES que no son de ningún texto de la IA (13/11/2026: en una corrida listó el encabezado de la
 * portada, en la siguiente no; las pastillas «STEP 1», casi nunca). Principal = sobre el fondo de la lámina: lo que rodea al
 * bloque es del color de la lámina (una pastilla también: su borde es la lámina). La letra de adentro de una tarjeta o de una
 * captura, no (lo que la rodea es la tarjeta): esa se queda como en el original. Renglones seguidos y parejos son un bloque.
 */
/** El color de la lámina: el de su BORDE (los márgenes siempre son fondo; el dominante de toda la lámina puede ser una captura). */
const colorDeLaLamina = (img: Rgba): Color =>
  colorDominante(img, { x: 0, y: 0, ancho: img.ancho, alto: img.alto }, (x, y) => x > 20 && x < img.ancho - 20 && y > 20 && y < img.alto - 20);

/** Qué tanto se puede apartar del color de la lámina lo que rodea a un texto principal. Una tarjeta blanca sobre una lámina casi
 *  blanca se aparta 17 (medido, @lifeofarjav lámina 4: lámina 250,245,239; tarjeta 254,254,253); el degradé de una lámina, menos de 8. */
export const UMBRAL_PRINCIPAL = 10;

/** ¿Estos renglones están sobre el fondo de la lámina (no adentro de una tarjeta o una captura)? Lo que los rodea es su color. */
export function esPrincipal(img: Rgba, rs: readonly Renglon[], fondoLamina: Color = colorDeLaLamina(img)): boolean {
  const c = cajaDe(rs);
  const anillo = colorDominante(img, { x: c.x - 10, y: c.y - 10, ancho: c.ancho + 20, alto: c.alto + 20 }, (x, y) => x >= c.x - 2 && x < c.x + c.ancho + 2 && y >= c.y - 2 && y < c.y + c.alto + 2);
  return distancia(anillo, fondoLamina) < UMBRAL_PRINCIPAL;
}

/**
 * ¿Estos renglones son de una LISTA o de una interfaz (una ventana, un documento, un menú)? Tienen cerca tres o más renglones de
 * su mismo tamaño (13/11/2026: sobre una lámina casi blanca, una tarjeta blanca no se distingue por su color, y la IA reescribía
 * la mitad de los renglones de una guía y la otra mitad no). Un encabezado tiene a lo sumo sus dos vecinos de franja; un
 * titular, ninguno de su tamaño.
 */
export function esDeUnaLista(lectura: LecturaDeLamina, rs: readonly Renglon[]): boolean {
  const c = cajaDe(rs);
  const h = Math.max(...rs.map((r) => r.caja.alto));
  const propios = new Set(rs.map((r) => r.n));
  const vecinos = lectura.renglones.filter((r) => !propios.has(r.n) && r.caja.alto >= 0.7 * h && r.caja.alto <= 1.4 * h
    && r.caja.y < c.y + c.alto + 3 * h && r.caja.y + r.caja.alto > c.y - 3 * h
    && r.caja.x < c.x + c.ancho + 4 * h && r.caja.x + r.caja.ancho > c.x - 4 * h);
  return vecinos.length >= 3;
}

export function bloquesSinDueno(img: Rgba, lectura: LecturaDeLamina, usados: ReadonlySet<number>): Renglon[][] {
  // El color de la lámina es el de su BORDE: el dominante de toda la lámina era el blanco de la captura en una lámina que es casi
  // toda captura, y la letra de la captura pasaba por principal.
  const fondoLamina = colorDeLaLamina(img);
  // Lo que queda ADENTRO de un renglón que ya es de alguien (la letra de una etiqueta de contorno: el contorno es un renglón y su
  // letra otro) tampoco es de nadie más: se escribiría dos veces (13/11/2026: «PASO 2» dos veces, una encima de la otra).
  const cajasUsadas = lectura.renglones.filter((r) => usados.has(r.n)).map((r) => r.caja);
  // Y al revés: el contorno que RODEA a un renglón que ya es de alguien (la IA se quedó con la letra; el contorno es otro renglón).
  const contiene = (a: Caja, b: Caja) => b.x >= a.x && b.y >= a.y && b.x + b.ancho <= a.x + a.ancho && b.y + b.alto <= a.y + a.alto;
  const deOtro = (r: Renglon) => cajasUsadas.some((u) => contiene(u, r.caja) || contiene(r.caja, u));
  const libres = enOrdenDeLectura(lectura.renglones.filter((r) => !usados.has(r.n) && !deOtro(r) && r.caja.alto >= 12), (r) => ({ x: r.caja.x, y: r.caja.y, alto: r.caja.alto }));
  const bloques: Renglon[][] = [];
  for (const r of libres) {
    const b = bloques.find((q) => {
      const u = q[q.length - 1].caja;
      const hueco = r.caja.y - (u.y + u.alto);
      const pisa = Math.min(u.x + u.ancho, r.caja.x + r.caja.ancho) - Math.max(u.x, r.caja.x);
      return hueco >= -0.2 * u.alto && hueco <= 0.8 * u.alto && pisa >= 0.3 * Math.min(u.ancho, r.caja.ancho) && Math.max(u.alto, r.caja.alto) <= 1.45 * Math.min(u.alto, r.caja.alto);
    });
    if (b) b.push(r);
    else bloques.push([r]);
  }
  return bloques.filter((b) => {
    const c = cajaDe(b);
    if (!esPrincipal(img, b, fondoLamina)) return false;
    return !esDeUnaLista(lectura, b) && c.alto > 0;
  });
}

/**
 * ¿Es el NOMBRE de un logo? Un renglón solo y corto justo DEBAJO de una figura casi cuadrada que no es una persona, dentro de su
 * ancho: «Claude» debajo del logo de Claude (13/11/2026: salió «PASO 2» en producción y «MaKo» en seco, aunque el prompt dice
 * que va igual). El logo queda en la plancha; su nombre, también.
 */
export function esNombreDeLogo(le: { img: Rgba; lectura: LecturaDeLamina }, rs: readonly Renglon[], personas: readonly string[]): boolean {
  const W = le.img.ancho;
  const H = le.img.alto;
  const c = cajaDe(rs);
  if (rs.length !== 1 || c.ancho > 0.3 * W) return false;
  const centro = c.x + c.ancho / 2;
  return le.lectura.figuras.some((f) => {
    const g = f.caja;
    if (personas.includes(f.n) || g.alto > 0.3 * H || g.ancho / g.alto < 0.6 || g.ancho / g.alto > 1.6) return false;
    const debajo = c.y >= g.y + g.alto - 0.3 * c.alto && c.y <= g.y + g.alto + 1.2 * c.alto;
    return debajo && centro >= g.x && centro <= g.x + g.ancho;
  });
}

/** ¿Un «texto» sin una letra ni un número? Es un ícono (la IA principal leyó «📄» en el ícono de un PDF y «✦» en un logo): no
 *  se borra, no se escribe y no va de recorte. */
export const sinLetras = (s: string) => !/[\p{L}\p{N}]/u.test(s);

/**
 * ¿Dos grupos de renglones son UN bloque a la vista? (uno debajo del otro, sin un hueco grande, pisándose a lo ancho y de letra
 * parecida: las dos filas de «Comment "GIFT" / and I'll send it over.»; un titular y su subtítulo, no).
 */
export function mismoBloque(a: readonly Renglon[], b: readonly Renglon[]): boolean {
  const [arriba, abajo] = cajaDe(a).y <= cajaDe(b).y ? [a, b] : [b, a];
  const u = [...arriba].sort((x, y) => (y.caja.y + y.caja.alto) - (x.caja.y + x.caja.alto))[0].caja;
  const s = [...abajo].sort((x, y) => x.caja.y - y.caja.y)[0].caja;
  const hueco = s.y - (u.y + u.alto);
  const pisa = Math.min(u.x + u.ancho, s.x + s.ancho) - Math.max(u.x, s.x);
  return hueco >= -0.2 * u.alto && hueco <= 0.8 * u.alto && pisa >= 0.3 * Math.min(u.ancho, s.ancho) && Math.max(u.alto, s.alto) <= 1.45 * Math.min(u.alto, s.alto);
}

/** Las filas de un bloque (los renglones que comparten franja son una). */
export function filasDe(b: readonly Renglon[]): Array<{ ancho: number }> {
  const filas: Array<{ y0: number; y1: number; ancho: number }> = [];
  for (const r of [...b].sort((x, y) => x.caja.y - y.caja.y)) {
    const f = filas.find((q) => Math.min(q.y1, r.caja.y + r.caja.alto) - Math.max(q.y0, r.caja.y) > 0.5 * Math.min(q.y1 - q.y0, r.caja.alto));
    if (f) { f.ancho += r.caja.ancho; f.y0 = Math.min(f.y0, r.caja.y); f.y1 = Math.max(f.y1, r.caja.y + r.caja.alto); }
    else filas.push({ y0: r.caja.y, y1: r.caja.y + r.caja.alto, ancho: r.caja.ancho });
  }
  return filas;
}

/** Lo que se mide de un texto con sus renglones: la caja de todos, cuántos son, a qué distancia van y sus colores. */
export function bloqueDeRenglones(img: Rgba, rs0: readonly Renglon[]): Bloque | null {
  if (!rs0.length) return null;
  const rs = rs0.map((r) => ({ ...r, caja: conSusSignos(img, r.caja) }));
  const x0 = Math.min(...rs.map((r) => r.caja.x));
  const y0 = Math.min(...rs.map((r) => r.caja.y));
  const x1 = Math.max(...rs.map((r) => r.caja.x + r.caja.ancho));
  const y1 = Math.max(...rs.map((r) => r.caja.y + r.caja.alto));
  const filas: Renglon[] = [];
  for (const r of [...rs].sort((a, b) => a.caja.y - b.caja.y)) {
    const misma = filas.find((q) => solapeVertical([0, q.caja.y, 0, q.caja.y + q.caja.alto], [0, r.caja.y, 0, r.caja.y + r.caja.alto]) > 0.5 * Math.min(q.caja.alto, r.caja.alto));
    if (!misma) filas.push(r);
  }
  const caja = { x: x0, y: y0, ancho: x1 - x0, alto: y1 - y0 };
  const fondo = colorDominante(img, { x: x0 - 6, y: y0 - 6, ancho: x1 - x0 + 12, alto: y1 - y0 + 12 }, (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1);
  // El color de la letra con su NÚCLEO: los píxeles del borde suavizado (mitad letra, mitad fondo) son más que los del centro en
  // una letra fina, y el subtítulo salía gris en vez de negro.
  let lejos = 0;
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) lejos = Math.max(lejos, distancia(pixel(img, x, y), fondo));
  const tinta = colorDominante(img, caja, (x, y) => distancia(pixel(img, x, y), fondo) < Math.max(TINTA_DE_LAMINA, 0.75 * lejos));
  // Cada franja con TODOS sus pedazos (la caja de la franja, no la de su primer pedazo).
  const franjas = filas.map((f) => cajaDe(rs.filter((r) => solapeVertical([0, f.caja.y, 0, f.caja.y + f.caja.alto], [0, r.caja.y, 0, r.caja.y + r.caja.alto]) > 0.5 * Math.min(f.caja.alto, r.caja.alto))));
  const alineacion = alineacionMedida(franjas, img.ancho);
  const acento = acentoMedido(img, franjas, tinta, fondo);
  const trazo = trazoMedido(img, franjas, fondo);
  return {
    caja,
    renglones: filas.length,
    paso: filas.length > 1 ? (filas[filas.length - 1].caja.y - filas[0].caja.y) / (filas.length - 1) : 0,
    altoRenglon: Math.max(...filas.map((r) => r.caja.alto)),
    tinta: hex(tinta),
    fondo: hex(fondo),
    franjas,
    principal: esPrincipal(img, rs0),
    ...(trazo ? { trazo } : {}),
    ...(alineacion ? { alineacion } : {}),
    ...(acento ? { acento } : {}),
  };
}

/**
 * El grosor del trazo, medido (13/11/2026): la mediana de los tramos de tinta a lo ancho, en la mitad de cada franja (los palos de
 * las letras; las barras horizontales dan tramos largos, pero son menos). El cuerpo de un tuit de @AlexHormozi es regular y la
 * réplica lo ponía en Inter 800 porque la IA lo llamó «titular». Calibrado con Inter a 100 px: 400 → 9 px, 600 → 13, 700 → 15,
 * 800 → 17; el tuit mide 11 con un cuerpo de ~115 px (regular) y los titulares de @lifeofarjav 17 con ~114 (700).
 */
function trazoMedido(img: Rgba, franjas: readonly Caja[], fondo: Color): number {
  const tramos: number[] = [];
  for (const f of franjas) {
    for (let y = f.y + Math.floor(0.25 * f.alto); y < f.y + Math.ceil(0.75 * f.alto); y++) {
      let n = 0;
      for (let x = f.x; x <= f.x + f.ancho; x++) {
        if (x < f.x + f.ancho && x < img.ancho && distancia(pixel(img, x, y), fondo) > TINTA_DE_LAMINA) n++;
        else if (n) { tramos.push(n); n = 0; }
      }
    }
  }
  if (tramos.length < 20) return 0;
  tramos.sort((a, b) => a - b);
  return tramos[tramos.length >> 1];
}

/**
 * Cómo está alineado el original, medido (la IA lo dice mal a veces: el subtítulo centrado de la portada de @lifeofarjav lo dio
 * «left»). Con varios renglones: los que comparten el borde izquierdo, el centro o el derecho. Con uno: centrado si su centro es
 * el de la lámina. null = no se sabe (va lo que dijo la IA).
 */
function alineacionMedida(franjas: readonly Caja[], W: number): 'left' | 'center' | 'right' | null {
  const desvio = (xs: number[]) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); };
  const centros = franjas.map((f) => f.x + f.ancho / 2);
  if (franjas.length >= 2) {
    const izq = desvio(franjas.map((f) => f.x));
    const cen = desvio(centros);
    const der = desvio(franjas.map((f) => f.x + f.ancho));
    const menor = Math.min(izq, cen, der);
    if (menor > 0.015 * W) return null;
    return menor === izq ? 'left' : menor === cen ? 'center' : 'right';
  }
  // Un renglón solo que ocupa casi todo el ancho está centrado Y alineado a los dos lados: no dice nada (va lo de la IA).
  if (franjas[0].x < 0.08 * W) return null;
  return Math.abs(centros[0] - W / 2) < 0.015 * W ? 'center' : null;
}

/**
 * Las palabras de OTRO color dentro del texto, medidas (la IA no siempre las marca: «Claude» en naranja dentro de un titular
 * negro, el «02» de «02 / 06»): el color del acento y, en cada franja, los tramos de ese color como fracción de su ancho. null =
 * todo de un color.
 */
function acentoMedido(img: Rgba, franjas: readonly Caja[], tinta: Color, fondo: Color): { color: string; tramos: Array<Array<[number, number]>> } | null {
  // Un acento es un color VIVO distinto de la letra: el borde suavizado de una letra negra sobre crema es gris (sin color) y se
  // contaba como acento, y el titular entero salía pintado. Primero los candidatos; después, sólo lo cercano a su color puro.
  const vivo = (c: Color) => Math.max(...c) - Math.min(...c);
  const candidato = (c: Color) => vivo(c) > 70 && vivo(c) > vivo(tinta) + 40 && distancia(c, tinta) > 90 && distancia(c, fondo) > TINTA_DE_LAMINA;
  const union = cajaDe(franjas.map((f, i) => ({ n: i, caja: f })));
  let candidatos = 0;
  let conTinta = 0;
  for (const f of franjas) for (let y = f.y; y < f.y + f.alto; y++) for (let x = f.x; x < f.x + f.ancho; x++) {
    const c = pixel(img, x, y);
    if (distancia(c, fondo) <= TINTA_DE_LAMINA) continue;
    conTinta++;
    if (candidato(c)) candidatos++;
  }
  if (candidatos < 0.08 * conTinta || candidatos < 40) return null;
  const puro = colorDominante(img, union, (x, y) => !candidato(pixel(img, x, y)));
  const esAcento = (c: Color) => distancia(c, puro) < 50;
  const color = puro;
  const tramosDe = (f: Caja): Array<[number, number]> => {
    const cols: number[] = [];
    for (let x = f.x; x < f.x + f.ancho; x++) {
      let n = 0;
      for (let y = f.y; y < f.y + f.alto; y++) if (esAcento(pixel(img, x, y))) n++;
      cols.push(n);
    }
    const out: Array<[number, number]> = [];
    const hueco = Math.max(3, Math.round(0.35 * f.alto));
    cols.forEach((n, i) => {
      if (n < 2) return;
      const u = out[out.length - 1];
      if (u && i - u[1] <= hueco) u[1] = i; else out.push([i, i]);
    });
    return out.filter(([a, b]) => b - a >= 0.3 * f.alto).map(([a, b]) => [a / f.ancho, (b + 1) / f.ancho] as [number, number]);
  };
  return { color: hex(color), tramos: franjas.map(tramosDe) };
}

// ── Borrar ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Cuánto puede variar el borde de una zona para considerarla lisa: de una fila a la siguiente, y de un lado al otro. */
const SALTO_MAXIMO = 22;
const LADO_A_LADO_MAXIMO = 60;
/** El color de un costado en una fila: el del medio de unos píxeles pegados a la zona (uno con tinta no lo arrastra). */
function costado(img: Rgba, x: number, y: number, hacia: -1 | 1): Color | null {
  const xs: Color[] = [];
  for (let k = 1; k <= 4; k++) { const xx = x + hacia * k; if (xx >= 0 && xx < img.ancho) xs.push(pixel(img, xx, y)); }
  if (!xs.length) return null;
  const medio = (i: 0 | 1 | 2) => xs.map((c) => c[i]).sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  return [medio(0), medio(1), medio(2)];
}

/**
 * Rellena una zona con el fondo que la rodea, interpolado de izquierda a derecha en cada fila. Sólo si lo que la rodea es PAREJO
 * (un fondo liso o un degradé suave): si un borde salta (una foto, otra letra pegada, el filo de una tarjeta), devuelve false y
 * NO toca nada. `pad` agranda la zona para llevarse el borde suavizado de las letras.
 */
export function borrarZona(img: Rgba, zona: Caja, pad: number): boolean {
  const z = dentro(img, { x: zona.x - pad, y: zona.y - pad, ancho: zona.ancho + 2 * pad, alto: zona.alto + 2 * pad });
  if (!z.ancho || !z.alto) return false;
  const izq: Color[] = [];
  const der: Color[] = [];
  for (let y = z.y; y < z.y + z.alto; y++) {
    const a = costado(img, z.x, y, -1);
    const b = costado(img, z.x + z.ancho - 1, y, 1);
    if (!a && !b) return false;
    izq.push(a ?? b!);
    der.push(b ?? a!);
  }
  // Arriba y abajo también tienen que ser parejos con los costados: una zona pegada a un filo no se borra.
  const arriba = z.y > 0 ? colorDominante(img, { x: z.x, y: z.y - 2, ancho: z.ancho, alto: 2 }) : null;
  const abajo = z.y + z.alto < img.alto ? colorDominante(img, { x: z.x, y: z.y + z.alto, ancho: z.ancho, alto: 2 }) : null;
  // Una fila RARA (un ícono o el filo de algo pegado a un costado) toma el fondo de la zona en vez de sus costados; con muchas
  // raras, la zona no es lisa y no se toca. Así un ícono al lado de un texto no deja el texto sin borrar.
  const fondo = colorDominante(img, { x: z.x - 6, y: z.y - 6, ancho: z.ancho + 12, alto: z.alto + 12 }, (x, y) => x >= z.x && x < z.x + z.ancho && y >= z.y && y < z.y + z.alto);
  // Con un costado raro (un ícono pegado de un lado), la fila toma el otro; con los dos, el fondo de la zona. Muchas filas con los
  // dos costados raros es una foto o una textura: no se toca.
  let raras = 0;
  for (let i = 0; i < izq.length; i++) {
    const malIzq = distancia(izq[i], fondo) > 2 * SALTO_MAXIMO;
    const malDer = distancia(der[i], fondo) > 2 * SALTO_MAXIMO;
    if (malIzq && malDer) { raras++; izq[i] = fondo; der[i] = fondo; }
    else if (malIzq) izq[i] = der[i];
    else if (malDer) der[i] = izq[i];
    else if (distancia(izq[i], der[i]) > LADO_A_LADO_MAXIMO) { izq[i] = fondo; der[i] = fondo; }
  }
  if (raras > 0.25 * izq.length) return false;
  if (arriba && distancia(arriba, fondo) > SALTO_MAXIMO * 2) return false;
  if (abajo && distancia(abajo, fondo) > SALTO_MAXIMO * 2) return false;
  for (let y = z.y; y < z.y + z.alto; y++) {
    const a = izq[y - z.y];
    const b = der[y - z.y];
    for (let x = z.x; x < z.x + z.ancho; x++) {
      const t = z.ancho > 1 ? (x - z.x) / (z.ancho - 1) : 0;
      const i = (y * img.ancho + x) * 4;
      img.px[i] = Math.round(a[0] + (b[0] - a[0]) * t);
      img.px[i + 1] = Math.round(a[1] + (b[1] - a[1]) * t);
      img.px[i + 2] = Math.round(a[2] + (b[2] - a[2]) * t);
    }
  }
  return true;
}

/**
 * ¿El bloque es una pastilla? Su color dominante no es el del fondo que la rodea y ocupa más de la mitad de la caja. Si lo es, la
 * caja de la letra de adentro: lo que se aparta del color de la pastilla, buscado lejos de las puntas redondeadas (ahí el borde
 * es del color de la lámina y parecería letra).
 */
function pastillaDe(img: Rgba, b: Bloque): { color: string; letra: Caja; contorno: boolean } | null {
  const color = colorDeHex(b.tinta);
  const fondo = colorDeHex(b.fondo);
  if (b.renglones !== 1 || distancia(color, fondo) < 60) return null;
  const c = b.caja;
  let cubre = 0;
  let total = 0;
  for (let y = c.y; y < c.y + c.alto; y += 2) for (let x = c.x; x < c.x + c.ancho; x += 2) { total++; if (distancia(pixel(img, x, y), color) < 40) cubre++; }
  // Una letra gruesa cubre a lo sumo un 45 % de su caja; una pastilla, más de la mitad (su letra blanca se lleva el resto). Una
  // etiqueta de CONTORNO («STEP 2»: borde naranja, adentro la lámina) cubre poco, pero su borde es todo de ese color.
  const contorno = !(total && cubre >= 0.5 * total) && bordeDe(img, c, fondo) >= 0.7;
  if (!total || (cubre < 0.5 * total && !contorno)) return null;
  // La letra se busca en el MEDIO de la pastilla: en las puntas redondeadas asoma la lámina, que parecería letra. En una de
  // contorno, la letra es lo que se aparta de lo de ADENTRO (la lámina), no del color del borde.
  const mx = Math.round(contorno ? Math.min(0.55 * c.alto, c.ancho / 5) : Math.min(0.3 * c.alto, c.ancho / 6));
  const my = Math.round((contorno ? 0.22 : 0.18) * c.alto);
  const adentro = contorno ? fondo : color;
  let x0 = Infinity; let y0 = Infinity; let x1 = -1; let y1 = -1;
  for (let y = c.y + my; y < c.y + c.alto - my; y++) {
    for (let x = c.x + mx; x < c.x + c.ancho - mx; x++) {
      if (distancia(pixel(img, x, y), adentro) > TINTA_DE_LAMINA) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
  }
  if (x1 < 0) return null;
  return { color: b.tinta, contorno, letra: { x: x0, y: y0, ancho: x1 - x0 + 1, alto: y1 - y0 + 1 } };
}

/** Qué parte del borde de arriba y de abajo de una caja (sin las puntas) NO es del fondo: el trazo de un contorno (más fino y más
 *  claro que la letra: medido 197,149,127 contra una letra 188,77,27; por eso no se compara con el color de la letra). */
function bordeDe(img: Rgba, c: Caja, fondo: Color): number {
  let si = 0;
  let total = 0;
  const r = Math.round(c.alto / 2);
  // En cada columna, el píxel que más se aparta del fondo entre las 4 filas de arriba (y las 4 de abajo): el trazo es fino.
  const mirar = (x: number, ys: number[]) => { total++; if (Math.max(...ys.map((y) => distancia(pixel(img, x, y), fondo))) > 50) si++; };
  for (let x = c.x + r; x < c.x + c.ancho - r; x += 2) {
    mirar(x, [c.y, c.y + 1, c.y + 2, c.y + 3]);
    mirar(x, [c.y + c.alto - 4, c.y + c.alto - 3, c.y + c.alto - 2, c.y + c.alto - 1]);
  }
  return total ? si / total : 0;
}
const colorDeHex = (h: string): Color => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Lo que se pide planchar: los renglones de cada texto (los números que dijo la IA) y las figuras que son personas. */
export type PedidoPlancha = { textos: ReadonlyArray<{ renglones: readonly number[] }>; personas: readonly string[] };
export type Planchada = { ok: true; textos: Array<Bloque | null>; personas: Caja[] } | { ok: false; motivo: string };

/**
 * Planchea una lámina EN EL LUGAR (modifica `img`): mide todos los textos primero (sobre el original, así borrar uno no tapa al
 * de al lado) y después borra sus renglones y cada persona. Un texto sin renglones (la IA no los dijo) queda `null`: no se borra
 * ni va en un lugar medido. Con el FONDO es todo o nada: si uno no es parejo, la lámina se devuelve intacta con el motivo y se
 * arma como antes (un texto quemado debajo del nuevo se ve dos veces).
 */
export function planchar(img: Rgba, lectura: LecturaDeLamina, p: PedidoPlancha): Planchada {
  const copia = new Uint8ClampedArray(img.px);
  const deshacer = (motivo: string): Planchada => { img.px.set(copia); return { ok: false, motivo }; };
  const porNumero = new Map(lectura.renglones.map((r) => [r.n, r]));
  const usados = new Set<number>();
  const bloques: Array<Bloque | null> = [];
  for (const [i, t] of p.textos.entries()) {
    const rs = [...new Set(t.renglones)].filter((n) => !usados.has(n)).map((n) => porNumero.get(n)).filter((r): r is Renglon => !!r);
    if (t.renglones.length && !rs.length) return deshacer(`los renglones del texto ${i + 1} no existen o ya eran de otro`);
    rs.forEach((r) => usados.add(r.n));
    bloques.push(bloqueDeRenglones(img, rs));
  }
  const figuras = new Map(lectura.figuras.map((f) => [f.n, f]));
  const personas = p.personas.map((n) => figuras.get(n)?.caja).filter((c): c is Caja => !!c);
  for (const [i, b] of bloques.entries()) {
    if (!b) continue;
    const pastilla = pastillaDe(img, b);
    if (pastilla && borrarZona(img, pastilla.letra, 2)) { bloques[i] = { ...b, pastilla }; continue; }
    // Renglón por renglón: la caja que los junta a todos toca lo que hay al lado del renglón más ancho (un ícono, otra caja).
    const pad = Math.max(3, Math.round(0.08 * b.altoRenglon));
    if (!b.franjas.every((f) => borrarZona(img, f, pad))) return deshacer(`el fondo del texto ${i + 1} no es parejo`);
  }
  for (const c of personas) if (!borrarZona(img, c, 6)) return deshacer('el fondo de la persona no es parejo');
  return { ok: true, textos: bloques, personas };
}
