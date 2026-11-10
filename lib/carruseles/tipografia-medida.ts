// =============================================================================
// La tipografía MEDIDA de una lámina: elegir la fuente comparando, y que ningún texto se salga de su caja (PURO; 9/11/2026)
// =============================================================================
// Martín, 9/11/2026, probando «crear un carrusel»: «son editables las letras, pero se superponen unas con otras, no era la
// tipografía correcta». Las dos causas estaban en `replica.ts`, y por diseño:
//   · la letra se elegía entre SEIS categorías (`LETRAS`: sans, gruesa, condensada, serif, manuscrita, mono), cada una con UNA
//     familia fija. Una categoría no es una tipografía: «sans» tiene Inter y Bebas Neue adentro, y nunca iba a coincidir;
//   · el texto nuevo se escribía en el lugar del original con el tamaño que dijo el modelo, sin medir si entraba. Un texto más
//     largo que el original desborda su caja y se pisa con el de abajo.
//
// LO QUE HACE ESTO, y es lo que se recomendó (docs/relevo/nube-carruseles-guiado.md §4):
//   1. LA FUENTE SE ELIGE COMPARANDO, NO POR CATEGORÍA. El recorte del original (lo que dice la lámina, en su caja) contra la
//      misma frase dibujada con cada candidata del catálogo del editor. El parecido es de los TRAZOS (`parecidoDeTrazos`): cuánto
//      se pisan las dos tintas una vez llevadas al mismo tamaño, más el perfil de columnas (el ancho de cada letra y el aire entre
//      ellas) y el de filas (la altura x, los ascendentes). La categoría que dijo la lectura sólo ORDENA las candidatas.
//   2. NINGÚN TEXTO SE SALE DE SU CAJA: se busca el cuerpo más grande con el que entra (`encajarEnCaja`), con el ancho de verdad
//      de cada renglón (`Medidor`: en el navegador, `measureText` de un canvas con la fuente cargada).
//   3. DOS CAJAS QUE SE PISAN SIN QUERERLO SE SEPARAN (`sinSuperponer`). Lo superpuesto A PROPÓSITO en el original (el «best» y
//      el «font» de @growithalex) lo marca la lectura con `superpuesto` y no se toca: no se adivina.
//
// Puro: no dibuja nada. Dibujar (la fuente en un canvas, el recorte del original) lo hace el navegador, que ya carga las fuentes
// del editor (app/image-editor/mako/fuentes.ts); acá entra por parámetro (`Medidor`, `Dibujar`). Lo prueba
// tests/carruseles-tipografia-medida.test.ts con máscaras y con un medidor de mentira.
// =============================================================================

// ── Encajar un texto en su caja ───────────────────────────────────────────────────────────────────────────────────────

/** Una caja en píxeles de la lámina (1080 × 1350 en un carrusel). */
export type Caja = { x: number; y: number; ancho: number; alto: number };

/** La fuente de un texto: familia, peso, itálica, cuerpo y tracking (milésimas de em, como `charSpacing` del motor). */
export type FuenteTexto = { familia: string; peso: number; italica: boolean; tam: number; espaciado?: number };

/** Mide el ancho de un renglón con una fuente. En el navegador: `measureText` (con el tracking sumado); en un test, un estimador. */
export type Medidor = (renglon: string, f: FuenteTexto) => number;

/** El cuerpo más chico que se acepta: debajo no se lee en un teléfono (y el aviso dice que el texto es largo para esa caja). */
export const TAM_MINIMO = 14;

/**
 * Parte un texto en renglones que entran en `ancho`, palabra por palabra. Los saltos de línea del texto se respetan (el modelo
 * los pone donde el original corta). Una palabra que sola no entra queda sola en su renglón: la decide el cuerpo, no el corte.
 */
export function partirEnRenglones(texto: string, ancho: number, f: FuenteTexto, medir: Medidor): string[] {
  const out: string[] = [];
  for (const parrafo of texto.replace(/\r/g, '').split('\n')) {
    const palabras = parrafo.split(/[ \t]+/).filter(Boolean);
    if (!palabras.length) { out.push(''); continue; }
    let linea = palabras[0];
    for (const p of palabras.slice(1)) {
      const prueba = `${linea} ${p}`;
      if (medir(prueba, f) <= ancho) linea = prueba;
      else { out.push(linea); linea = p; }
    }
    out.push(linea);
  }
  return out;
}

export type Encaje = {
  tam: number;
  renglones: string[];
  /** Lo que ocupa de verdad (el ancho del renglón más largo y el alto de todos). */
  ancho: number;
  alto: number;
  /** false = ni en `TAM_MINIMO` entra: el texto es largo para esa caja (la pantalla lo dice; nunca se corta solo). */
  entra: boolean;
};

/**
 * El cuerpo MÁS GRANDE (≤ `f.tam`, que es el del original) con el que el texto entra en la caja: cada renglón ≤ el ancho y
 * todos juntos ≤ el alto. Búsqueda binaria sobre el cuerpo: los renglones cambian con él (más chico, más palabras por renglón).
 * Nunca agranda: lo que el original tenía chico sigue chico.
 */
export function encajarEnCaja(texto: string, caja: Caja, f: FuenteTexto, medir: Medidor, o: { interlineado?: number; tamMinimo?: number } = {}): Encaje {
  const inter = o.interlineado ?? 1.15;
  const piso = Math.max(1, Math.min(o.tamMinimo ?? TAM_MINIMO, f.tam));
  const medida = (tam: number) => {
    const ft = { ...f, tam };
    const renglones = partirEnRenglones(texto, caja.ancho, ft, medir);
    const ancho = Math.max(0, ...renglones.map((r) => medir(r, ft)));
    const alto = renglones.length * tam * inter;
    return { tam, renglones, ancho, alto, entra: ancho <= caja.ancho + 0.5 && alto <= caja.alto + 0.5 };
  };
  const tope = medida(f.tam);
  if (tope.entra) return tope;
  let lo = piso;
  let hi = f.tam;
  let mejor = medida(piso);
  if (!mejor.entra) return mejor;
  for (let i = 0; i < 18 && hi - lo > 0.25; i++) {
    const m = (lo + hi) / 2;
    const x = medida(m);
    if (x.entra) { mejor = x; lo = m; } else hi = m;
  }
  return { ...mejor, tam: Math.floor(mejor.tam * 4) / 4 };
}

// ── Que dos textos no se pisen ────────────────────────────────────────────────────────────────────────────────────────

export type BloqueEnCaja = {
  id: string;
  caja: Caja;
  /** En el original se pisa con otro A PROPÓSITO (lo dice la lectura): se deja como está. */
  superpuesto?: boolean;
};

/** ¿Se pisan? Con `holgura` px de aire que se tolera (un borde que se toca no es pisarse). */
export function sePisan(a: Caja, b: Caja, holgura = 2): boolean {
  return a.x + a.ancho - holgura > b.x && b.x + b.ancho - holgura > a.x && a.y + a.alto - holgura > b.y && b.y + b.alto - holgura > a.y;
}

/**
 * Las cajas, sin pisarse: de arriba abajo, una caja que pisa a otra de más arriba arranca debajo de ella (conserva su alto si
 * entra en la lámina; si no, se achica hasta el borde). Las marcadas `superpuesto` no se mueven ni empujan. Devuelve las cajas
 * en el MISMO orden en que vinieron. Lo que se achicó se vuelve a encajar con `encajarEnCaja`.
 */
export function sinSuperponer<B extends BloqueEnCaja>(bloques: readonly B[], lamina: { ancho: number; alto: number }, aire = 8): B[] {
  const orden = bloques.map((b, i) => ({ b, i })).sort((p, q) => p.b.caja.y - q.b.caja.y || p.b.caja.x - q.b.caja.x);
  const puestos: Caja[] = [];
  const out = new Map<number, B>();
  for (const { b, i } of orden) {
    if (b.superpuesto) { out.set(i, b); puestos.push(b.caja); continue; }
    let caja = { ...b.caja };
    for (const p of puestos) {
      if (!sePisan(caja, p)) continue;
      const y = p.y + p.alto + aire;
      const alto = Math.min(caja.alto, lamina.alto - y);
      caja = { ...caja, y, alto: Math.max(0, alto) };
    }
    out.set(i, { ...b, caja });
    puestos.push(caja);
  }
  return bloques.map((_, i) => out.get(i)!);
}

// ── Elegir la fuente comparando los trazos ────────────────────────────────────────────────────────────────────────────

/** Una máscara de tinta: `px[y * ancho + x]` es 1 donde hay tinta. */
export type Mascara = { ancho: number; alto: number; px: Uint8Array };

const hex = (c: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * La tinta de un recorte RGBA (un `ImageData`): cada píxel va a la tinta si está más cerca del color del texto que del fondo.
 * Con los dos colores que dio la lectura, y no un umbral fijo: un texto blanco sobre una foto oscura se lee igual que uno negro
 * sobre papel. Un color que no se entiende cae al de más contraste con el otro.
 */
export function mascaraDeImagen(rgba: Uint8ClampedArray | Uint8Array, ancho: number, alto: number, tinta: string, fondo: string): Mascara {
  const t = hex(tinta) ?? [0, 0, 0];
  const f = hex(fondo) ?? (t[0] + t[1] + t[2] > 382 ? [0, 0, 0] : [255, 255, 255]);
  const px = new Uint8Array(ancho * alto);
  for (let i = 0; i < ancho * alto; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2], a = rgba[i * 4 + 3];
    if (a < 64) continue;
    const dt = (r - t[0]) ** 2 + (g - t[1]) ** 2 + (b - t[2]) ** 2;
    const df = (r - f[0]) ** 2 + (g - f[1]) ** 2 + (b - f[2]) ** 2;
    if (dt < df) px[i] = 1;
  }
  return { ancho, alto, px };
}

/** La caja de la tinta (sin el aire de alrededor): así no importa dónde cayó el texto en el recorte. `null` = no hay tinta. */
export function recortarTinta(m: Mascara): Mascara | null {
  let x0 = m.ancho, y0 = m.alto, x1 = -1, y1 = -1;
  for (let y = 0; y < m.alto; y++) for (let x = 0; x < m.ancho; x++) {
    if (!m.px[y * m.ancho + x]) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  const ancho = x1 - x0 + 1;
  const alto = y1 - y0 + 1;
  const px = new Uint8Array(ancho * alto);
  for (let y = 0; y < alto; y++) px.set(m.px.subarray((y + y0) * m.ancho + x0, (y + y0) * m.ancho + x0 + ancho), y * ancho);
  return { ancho, alto, px };
}

/** La máscara llevada a `ancho` × `alto`, por vecino más cercano (es tinta: no hace falta suavizar). */
export function reescalar(m: Mascara, ancho: number, alto: number): Mascara {
  const px = new Uint8Array(ancho * alto);
  for (let y = 0; y < alto; y++) {
    const sy = Math.min(m.alto - 1, Math.floor(((y + 0.5) * m.alto) / alto));
    for (let x = 0; x < ancho; x++) {
      const sx = Math.min(m.ancho - 1, Math.floor(((x + 0.5) * m.ancho) / ancho));
      px[y * ancho + x] = m.px[sy * m.ancho + sx];
    }
  }
  return { ancho, alto, px };
}

/** La fracción de tinta por columna (`x`) o por fila (`y`). */
export function perfil(m: Mascara, eje: 'x' | 'y'): number[] {
  const n = eje === 'x' ? m.ancho : m.alto;
  const largo = eje === 'x' ? m.alto : m.ancho;
  const out = new Array<number>(n).fill(0);
  for (let y = 0; y < m.alto; y++) for (let x = 0; x < m.ancho; x++) if (m.px[y * m.ancho + x]) out[eje === 'x' ? x : y] += 1;
  return out.map((v) => v / Math.max(1, largo));
}

/** Cuánto se parecen dos perfiles del mismo largo: 1 menos la diferencia media (los dos van de 0 a 1). */
const parecidoDePerfiles = (a: number[], b: number[]): number => 1 - a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / Math.max(1, a.length);

/** El lado de la grilla donde se comparan las dos tintas (más fino no mide más: el ruido del recorte pesa más). */
export const GRILLA = 64;

/**
 * El parecido de dos tintas, de 0 a 1. Las dos se recortan a su tinta y se llevan a la MISMA grilla, así que lo que cuenta es la
 * FORMA de los trazos y no su tamaño. Tres medidas:
 *   · cuánto se pisan (intersección sobre unión): el dibujo de cada letra;
 *   · el perfil de columnas: el ancho de cada letra y el aire entre ellas (una condensada contra una ancha);
 *   · el perfil de filas: la altura x, los ascendentes y el peso (una fina contra una negra).
 * Y una penalidad por la PROPORCIÓN de la tinta (ancho sobre alto): la misma frase en una condensada y en una ancha tiene cajas
 * de proporciones distintas, y llevarlas a la misma grilla borraría justo esa diferencia.
 */
export function parecidoDeTrazos(a: Mascara, b: Mascara): number {
  const ta = recortarTinta(a);
  const tb = recortarTinta(b);
  if (!ta || !tb) return 0;
  const ra = reescalar(ta, GRILLA, GRILLA);
  const rb = reescalar(tb, GRILLA, GRILLA);
  let inter = 0, union = 0;
  for (let i = 0; i < ra.px.length; i++) { if (ra.px[i] && rb.px[i]) inter++; if (ra.px[i] || rb.px[i]) union++; }
  const iou = union ? inter / union : 0;
  const px = parecidoDePerfiles(perfil(ra, 'x'), perfil(rb, 'x'));
  const py = parecidoDePerfiles(perfil(ra, 'y'), perfil(rb, 'y'));
  const pa = ta.ancho / ta.alto;
  const pb = tb.ancho / tb.alto;
  const proporcion = Math.min(pa, pb) / Math.max(pa, pb);
  return (0.5 * iou + 0.25 * px + 0.25 * py) * (0.6 + 0.4 * proporcion);
}

// ── Las candidatas y la elección ─────────────────────────────────────────────────────────────────────────────────────

/** Lo que hace falta de una familia del catálogo del editor (app/image-editor/mako/fuentes.ts → `FUENTES` lo cumple). */
export type FuenteDelCatalogo = {
  family: string;
  category: 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';
  variants: readonly { weight: number; style: 'normal' | 'italic' }[];
  popularity: number;
};

/** El estilo de letra que dijo la lectura (las mismas seis de `replica.ts`): sólo ORDENA, no decide. */
export type PistaDeLetra = 'sans' | 'gruesa' | 'condensada' | 'serif' | 'manuscrita' | 'mono';

/** Qué categorías del catálogo se prueban primero para cada pista, y cuáles después (una «gruesa» puede ser una display). */
const CATEGORIAS: Record<PistaDeLetra, readonly FuenteDelCatalogo['category'][]> = {
  sans: ['sans-serif', 'display'],
  gruesa: ['sans-serif', 'display'],
  condensada: ['sans-serif', 'display'],
  serif: ['serif', 'display'],
  manuscrita: ['handwriting', 'display'],
  mono: ['monospace', 'sans-serif'],
};

export type Candidata = { familia: string; peso: number; italica: boolean };

/** El peso más cercano que la familia TIENE, con la itálica pedida si la tiene (un peso que no existe cae a la del sistema). */
export function varianteMasCercana(f: FuenteDelCatalogo, peso: number, italica: boolean): Candidata | null {
  const conEstilo = f.variants.filter((v) => (v.style === 'italic') === italica);
  const lista = conEstilo.length ? conEstilo : f.variants;
  if (!lista.length) return null;
  const v = [...lista].sort((a, b) => Math.abs(a.weight - peso) - Math.abs(b.weight - peso) || b.weight - a.weight)[0];
  return { familia: f.family, peso: v.weight, italica: v.style === 'italic' };
}

/** Cuántas se dibujan y se comparan como mucho (cada una es un canvas y una fuente que bajar). */
export const MAX_CANDIDATAS = 14;

/**
 * Las familias a comparar: las de las categorías de la pista primero (por popularidad), después las demás de su segunda
 * categoría, cada una en la variante más cercana al peso y la itálica que dijo la lectura. Sin repetir, hasta `max`.
 */
export function candidatasDeFuente(catalogo: readonly FuenteDelCatalogo[], pista: { letra: PistaDeLetra; peso: number; italica: boolean }, max = MAX_CANDIDATAS): Candidata[] {
  const cats = CATEGORIAS[pista.letra] ?? CATEGORIAS.sans;
  const out: Candidata[] = [];
  for (const cat of cats) {
    for (const f of [...catalogo].filter((x) => x.category === cat).sort((a, b) => a.popularity - b.popularity)) {
      const c = varianteMasCercana(f, pista.peso, pista.italica);
      if (c && !out.some((x) => x.familia === c.familia)) out.push(c);
      if (out.length >= max) return out;
    }
  }
  return out;
}

/** Dibuja `texto` con una candidata y devuelve su tinta (en el navegador, un canvas). `null` = la fuente no cargó. */
export type Dibujar = (texto: string, c: Candidata) => Promise<Mascara | null>;

/** Debajo de esto, ninguna candidata se parece de verdad: se usa la primera de la pista y se dice que no es segura. */
export const PARECIDO_SEGURO = 0.55;

export type Eleccion = Candidata & { parecido: number; seguro: boolean; probadas: number };

/**
 * La candidata que más se parece al recorte del original. Una que no cargó no cuenta (y no se elige por descarte: «no pude
 * dibujarla» no es «se parece»). Sin ninguna dibujada, `null`: quien llama se queda con la fuente que ya tenía.
 */
export async function elegirFuente(original: Mascara, texto: string, candidatas: readonly Candidata[], dibujar: Dibujar): Promise<Eleccion | null> {
  let mejor: Eleccion | null = null;
  let probadas = 0;
  for (const c of candidatas) {
    const m = await dibujar(texto, c).catch(() => null);
    if (!m) continue;
    probadas++;
    const p = parecidoDeTrazos(original, m);
    if (!mejor || p > mejor.parecido) mejor = { ...c, parecido: p, seguro: false, probadas: 0 };
  }
  if (!mejor) return null;
  return { ...mejor, seguro: mejor.parecido >= PARECIDO_SEGURO, probadas };
}
