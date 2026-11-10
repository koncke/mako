// =============================================================================
// La tipografía medida de una lámina (lib/carruseles/tipografia-medida.ts, 9/11/2026)
// =============================================================================
// Martín, 9/11: «se superponen unas con otras, no era la tipografía correcta». Estos tests EJECUTAN las reglas con máscaras
// dibujadas acá (letras como óvalos de trazo, más anchas o más finas, más gruesas o más livianas) y con un medidor de mentira.
//
// Correr: node --import tsx --test tests/carruseles-tipografia-medida.test.ts
//
// PROBADO ROMPIÉNDOLO (9/11/2026, base 8/0), cada rotura con su rojo:
//   · lo superpuesto a propósito se mueve             → 7/1 (3)
//   · no separa lo que se pisa                         → 7/1 (3)
//   · no achica un texto que no entra                  → 7/1 (1)
//   · cuenta como probada una fuente que no cargó      → 7/1 (5)
//   · el parecido mira sólo el solapamiento            → 7/1 (4b) — daba VERDE hasta que existió 4b
//   · un umbral fijo en vez de los dos colores         → 7/1 (6)
//   · la variante no mira la itálica                   → 7/1 (7)
//   · devuelve las cajas en otro orden                 → 7/1 (3)
// Medido (las máscaras de este archivo): la misma tinta a otra escala da 0,934; una condensada, 0,569; una negra, 0,610.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TAM_MINIMO, candidatasDeFuente, elegirFuente, encajarEnCaja, mascaraDeImagen, parecidoDeTrazos, partirEnRenglones, recortarTinta,
  sePisan, sinSuperponer, varianteMasCercana,
  type Candidata, type FuenteDelCatalogo, type FuenteTexto, type Mascara, type Medidor,
} from '../lib/carruseles/tipografia-medida';
import { FUENTES } from '../app/image-editor/mako/fuentes';

/** Un medidor de mentira: cada carácter mide la mitad del cuerpo (una sans común). */
const medir: Medidor = (r, f) => Array.from(r).length * f.tam * 0.5;
const f60: FuenteTexto = { familia: 'Inter', peso: 800, italica: false, tam: 60 };

test('1. encajar: el cuerpo más grande con el que entra, sin pasarse del ancho ni del alto, y nunca agranda', () => {
  const caja = { x: 0, y: 0, ancho: 300, alto: 150 };
  const e = encajarEnCaja('Cuatro reglas para vender sin descuentos', caja, f60, medir);
  assert.ok(e.entra);
  assert.ok(e.tam < 60, 'un texto largo se achica');
  for (const r of e.renglones) assert.ok(medir(r, { ...f60, tam: e.tam }) <= caja.ancho + 0.5, `«${r}» se sale de la caja`);
  assert.ok(e.alto <= caja.alto + 0.5, 'el alto se sale de la caja');
  // Medio punto más grande ya no entra: es el más grande.
  const mas = encajarEnCaja('Cuatro reglas para vender sin descuentos', caja, { ...f60, tam: e.tam + 1.5 }, medir);
  assert.ok(mas.tam <= e.tam + 1.5);
  // Un texto corto en una caja grande se queda con el cuerpo del original.
  assert.equal(encajarEnCaja('Hola', { x: 0, y: 0, ancho: 900, alto: 400 }, { ...f60, tam: 40 }, medir).tam, 40);
  // Lo que no entra ni en el mínimo se DICE (entra: false), no se corta.
  const largo = encajarEnCaja('x'.repeat(600), { x: 0, y: 0, ancho: 100, alto: 40 }, f60, medir);
  assert.equal(largo.entra, false);
  assert.equal(largo.tam, TAM_MINIMO);
});

test('2. los renglones: por palabra, respetando los saltos del original', () => {
  const r = partirEnRenglones('uno dos tres\ncuatro', 140, { ...f60, tam: 20 }, medir);
  assert.deepEqual(r, ['uno dos tres', 'cuatro']);
  assert.deepEqual(partirEnRenglones('uno dos tres', 70, { ...f60, tam: 20 }, medir), ['uno dos', 'tres']);
});

test('3. no superponer: la de abajo arranca debajo, lo superpuesto a propósito se queda, y el orden no cambia', () => {
  const lamina = { ancho: 1080, alto: 1350 };
  const bloques = [
    { id: 'cuerpo', caja: { x: 100, y: 300, ancho: 800, alto: 200 } },
    { id: 'titular', caja: { x: 100, y: 100, ancho: 800, alto: 260 } },
    { id: 'pie', caja: { x: 100, y: 1200, ancho: 800, alto: 100 } },
  ];
  const out = sinSuperponer(bloques, lamina);
  assert.deepEqual(out.map((b) => b.id), ['cuerpo', 'titular', 'pie'], 'el orden de entrada se conserva');
  assert.equal(out[0].caja.y, 100 + 260 + 8, 'el cuerpo arranca debajo del titular');
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) assert.ok(!sePisan(out[i].caja, out[j].caja), `${out[i].id} y ${out[j].id} se pisan`);
  assert.deepEqual(out[2].caja, bloques[2].caja, 'lo que no se pisaba no se mueve');
  const aProposito = sinSuperponer([{ id: 'best', caja: { x: 370, y: 180, ancho: 300, alto: 130 } }, { id: 'font', caja: { x: 275, y: 225, ancho: 520, alto: 250 }, superpuesto: true }], lamina);
  assert.equal(aProposito[1].caja.y, 225, '«font» se pisa con «best» en el original: no se mueve');
  // Al borde de la lámina se achica en vez de salirse.
  const alBorde = sinSuperponer([{ id: 'a', caja: { x: 0, y: 1000, ancho: 500, alto: 300 } }, { id: 'b', caja: { x: 0, y: 1200, ancho: 500, alto: 300 } }], lamina);
  assert.ok(alBorde[1].caja.y + alBorde[1].caja.alto <= lamina.alto);
});

// ── Las máscaras de prueba ──────────────────────────────────────────────────────────────────────────────────────────

/** Una «palabra» de `n` letras como óvalos de trazo: `ancho` y `grosor` dan una condensada, una ancha, una fina o una negra. */
function palabra(o: { n: number; ancho: number; alto: number; grosor: number; aire: number; escala?: number; dx?: number }): Mascara {
  const k = o.escala ?? 1;
  const W = Math.round((o.n * (o.ancho + o.aire) + 40) * k);
  const H = Math.round((o.alto + 40) * k);
  const px = new Uint8Array(W * H);
  for (let i = 0; i < o.n; i++) {
    const cx = (20 + (o.dx ?? 0) + i * (o.ancho + o.aire) + o.ancho / 2) * k;
    const cy = (20 + o.alto / 2) * k;
    const rx = (o.ancho / 2) * k, ry = (o.alto / 2) * k, g = o.grosor * k;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const afuera = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
      const adentro = ((x - cx) / Math.max(1, rx - g)) ** 2 + ((y - cy) / Math.max(1, ry - g)) ** 2 <= 1;
      if (afuera && !adentro) px[y * W + x] = 1;
    }
  }
  return { ancho: W, alto: H, px };
}
const normal = { n: 5, ancho: 40, alto: 60, grosor: 7, aire: 10 };
const condensada = { n: 5, ancho: 20, alto: 60, grosor: 7, aire: 5 };
const negra = { n: 5, ancho: 40, alto: 60, grosor: 18, aire: 10 };

test('4. el parecido mide la FORMA: igual a sí misma en otro tamaño y otro lugar; menos con otro ancho o con otro peso', () => {
  const a = palabra(normal);
  const misma = parecidoDeTrazos(a, palabra({ ...normal, escala: 1.7, dx: 30 }));
  const otraAncho = parecidoDeTrazos(a, palabra(condensada));
  const otroPeso = parecidoDeTrazos(a, palabra(negra));
  assert.ok(misma > 0.85, `la misma tinta a otra escala da ${misma.toFixed(3)}`);
  assert.ok(otraAncho < misma - 0.15, `una condensada (${otraAncho.toFixed(3)}) no se puede parecer como la misma (${misma.toFixed(3)})`);
  assert.ok(otroPeso < misma - 0.1, `una negra (${otroPeso.toFixed(3)}) no se puede parecer como la misma (${misma.toFixed(3)})`);
  assert.equal(parecidoDeTrazos(a, { ancho: 4, alto: 4, px: new Uint8Array(16) }), 0, 'sin tinta no hay parecido');
});

test('4b. la PROPORCIÓN cuenta: la misma tinta estirada a lo ancho (una condensada de la misma familia) no es la misma', () => {
  // Las dos tintas, llevadas a la grilla, son EXACTAMENTE el mismo dibujo (se amplían de la misma base por factores enteros):
  // el solapamiento y los perfiles dan 1. Lo único que las separa es la proporción de la caja, y es justo lo que distingue a
  // Bebas Neue de Oswald. Sin este caso, un parecido que mirara sólo el solapamiento daba verde en todo el archivo (lo cazó el
  // arnés de romper, dos veces: la primera versión de este test estiraba con pérdida y el solapamiento ya bajaba solo).
  const L = 64;
  const base = new Uint8Array(L * L);
  for (let i = 0; i < L; i++) { base[i] = 1; base[(L - 1) * L + i] = 1; base[i * L] = 1; base[i * L + L - 1] = 1; base[i * L + i] = 1; }
  const ampliar = (kx: number, ky: number): Mascara => {
    const W = L * kx, H = L * ky, px = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px[y * W + x] = base[Math.floor(y / ky) * L + Math.floor(x / kx)];
    return { ancho: W, alto: H, px };
  };
  const cuadrada = ampliar(2, 2);
  const misma = parecidoDeTrazos(cuadrada, ampliar(3, 3));
  const ancha = parecidoDeTrazos(cuadrada, ampliar(4, 2));
  assert.ok(misma > 0.95, `la misma, a otra escala, da ${misma.toFixed(3)}`);
  assert.ok(ancha < misma - 0.1, `el doble de ancha da ${ancha.toFixed(3)} contra ${misma.toFixed(3)} de la misma`);
});

test('5. elegir: gana la que se parece, una que no cargó no cuenta, y sin ninguna dibujada no se elige nada', async () => {
  const original = palabra({ ...condensada, escala: 1.3 });
  const formas: Record<string, typeof normal> = { Inter: normal, 'Bebas Neue': condensada, 'Archivo Black': negra };
  const candidatas: Candidata[] = ['Inter', 'Archivo Black', 'Bebas Neue', 'No Carga'].map((familia) => ({ familia, peso: 400, italica: false }));
  const dibujar = async (_t: string, c: Candidata) => (formas[c.familia] ? palabra(formas[c.familia]) : null);
  const e = await elegirFuente(original, 'ABCDE', candidatas, dibujar);
  assert.equal(e?.familia, 'Bebas Neue');
  assert.equal(e?.probadas, 3, 'la que no cargó no se cuenta como probada');
  assert.ok(e?.seguro);
  assert.equal(await elegirFuente(original, 'ABCDE', candidatas, async () => null), null);
  // La mejor de las que hay, pero ninguna se parece de verdad: se dice que no es segura.
  const raro = palabra({ n: 1, ancho: 200, alto: 20, grosor: 10, aire: 0 });
  const debil = await elegirFuente(raro, 'x', candidatas.slice(0, 1), dibujar);
  assert.equal(debil?.seguro, false);
});

test('6. la tinta de un recorte: texto blanco sobre oscuro igual que negro sobre papel', () => {
  // 4 × 1: blanco, gris oscuro, blanco, negro.
  const rgba = new Uint8Array([255, 255, 255, 255, 30, 30, 30, 255, 250, 250, 250, 255, 0, 0, 0, 255]);
  assert.deepEqual([...mascaraDeImagen(rgba, 4, 1, '#FFFFFF', '#111111').px], [1, 0, 1, 0]);
  assert.deepEqual([...mascaraDeImagen(rgba, 4, 1, '#111111', '#FFFFFF').px], [0, 1, 0, 1]);
  assert.equal(recortarTinta({ ancho: 3, alto: 3, px: new Uint8Array(9) }), null);
});

test('7. las candidatas salen del catálogo del editor: varias por pista, con un peso que la familia TIENE', () => {
  const sans = candidatasDeFuente(FUENTES as unknown as FuenteDelCatalogo[], { letra: 'sans', peso: 800, italica: false });
  assert.ok(sans.length >= 8, `«sans» compara ${sans.length} familias: con una sola no hay elección`);
  for (const c of sans) {
    const f = FUENTES.find((x) => x.family === c.familia)!;
    assert.ok(f.variants.some((v) => v.weight === c.peso && (v.style === 'italic') === c.italica), `${c.familia} ${c.peso}: un peso que no existe cae a la del sistema`);
  }
  const serif = candidatasDeFuente(FUENTES as unknown as FuenteDelCatalogo[], { letra: 'serif', peso: 900, italica: true });
  assert.equal(FUENTES.find((x) => x.family === serif[0].familia)!.category, 'serif', 'la pista ordena: serif primero');
  assert.ok(serif.some((c) => c.familia === 'Playfair Display' && c.italica), 'la itálica de Playfair (la del «font» de @growithalex) entra');
  const solo700i: FuenteDelCatalogo = { family: 'X', category: 'serif', popularity: 1, variants: [{ weight: 400, style: 'normal' }, { weight: 700, style: 'italic' }] };
  assert.deepEqual(varianteMasCercana(solo700i, 900, true), { familia: 'X', peso: 700, italica: true });
  assert.deepEqual(varianteMasCercana({ ...solo700i, variants: [{ weight: 400, style: 'normal' }] }, 900, true), { familia: 'X', peso: 400, italica: false });
});
