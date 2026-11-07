// =============================================================================
// Copia fiel: cada bloque conserva SU tipografía (7/11/2026)
// =============================================================================
// Martín, 7/11: «recalcar la misma tipografía, eso es súper importante. Cada letra, porque fíjate
// que en esa imagen hay muchas tipografías».
//
// El modelo viejo tiene DOS ranuras de fuente (`EstiloCarrusel.titular` y `.texto`) y las aplica
// POR ROL. La referencia real tiene dos familias en ocho bloques con seis tratamientos, una de
// ellas itálica y una con texto blanco sobre placa. Esto prueba que la copia ya no hereda.
//
// Prueba CONDUCTA, no redacción: construye el documento de verdad y mira lo que sale. Si mañana
// alguien cambia los nombres de los bloques o un color, sigue en verde mientras cada bloque siga
// llevando su propia fuente.
//
// Correr: node --import tsx --test tests/clon-fiel-tipografia.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { familiasDe, variantesDe, faltanEnElCatalogo, documentoDeClon, type BloqueMedido } from '../lib/carruseles/clon-fiel';
import { BLOQUES_PAIRINGS, documentoPairings, GROTESCA, SERIF_ITALICA } from '../lib/carruseles/portada-pairings';
import { texto } from '../lib/carruseles/documento';

/** Ids previsibles: así el test mira el contenido y no el azar. */
const contador = () => { let n = 0; return () => `o${++n}`; };

type Obj = Record<string, unknown>;
const paginas = (d: Record<string, unknown>) => d.pages as Obj[];
const objetos = (d: Record<string, unknown>) => paginas(d)[0].objects as Obj[];
const textos = (d: Record<string, unknown>) => objetos(d).filter((o) => o.type === 'textbox');

test('la portada medida tiene DOS familias, no una', () => {
  const fams = familiasDe(BLOQUES_PAIRINGS);
  assert.equal(fams.length, 2, `esperaba 2 familias y hay ${fams.length}: ${fams.join(', ')}`);
  assert.ok(fams.includes(GROTESCA) && fams.includes(SERIF_ITALICA), `salieron ${fams.join(', ')}`);
});

test('cada bloque sale con SU fuente: ninguna se aplastó contra una sola', () => {
  const d = documentoPairings({ src: 'https://ejemplo/plancha.jpg' }, contador());
  const t = textos(d);
  assert.equal(t.length, BLOQUES_PAIRINGS.length, `${BLOQUES_PAIRINGS.length} bloques → ${t.length} textos`);
  // Lo que importa: la familia de cada objeto es la que declaró SU bloque, una por una.
  BLOQUES_PAIRINGS.forEach((b, i) => {
    assert.equal(t[i].fontFamily, b.familia, `«${b.nombre}» quedó en ${String(t[i].fontFamily)}`);
    assert.equal(t[i].fontWeight, b.peso, `«${b.nombre}» quedó en peso ${String(t[i].fontWeight)}`);
    assert.equal(t[i].fontSize, b.tam, `«${b.nombre}» quedó en ${String(t[i].fontSize)} px`);
    assert.equal(t[i].fill, b.color, `«${b.nombre}» quedó en ${String(t[i].fill)}`);
  });
  // Y el número que contesta la pregunta de Martín, contado sobre el documento REAL, no sobre la entrada.
  const familiasEnElDocumento = new Set(t.map((o) => o.fontFamily));
  assert.equal(familiasEnElDocumento.size, 2, `el documento quedó con ${familiasEnElDocumento.size} familia(s)`);
  const cuerpos = new Set(t.map((o) => o.fontSize));
  assert.ok(cuerpos.size >= 5, `esperaba al menos 5 cuerpos distintos y hay ${cuerpos.size}`);
});

test('«font» sale en itálica de verdad, que antes era imposible', () => {
  const d = documentoPairings({ src: 'https://ejemplo/plancha.jpg' }, contador());
  const f = textos(d).find((o) => o.text === 'font');
  assert.ok(f, 'no está el bloque «font»');
  assert.equal(f.fontStyle, 'italic');
  assert.equal(f.fontFamily, SERIF_ITALICA);
  // Y es la ÚNICA: si salieran todas en itálica, el arreglo estaría invertido y el test pasaría igual.
  assert.equal(textos(d).filter((o) => o.fontStyle === 'italic').length, 1);
});

test('un texto que no pide itálica sigue saliendo redondo (no se rompió lo que ya existía)', () => {
  const redondo = texto('x', 'Titular', 'hola', { left: 0, top: 0, width: 100, tam: 20, peso: 700, fam: 'Inter', color: '#000' });
  assert.equal(redondo.fontStyle, 'normal');
});

test('la placa del «Pa» se dibuja DETRÁS de su texto, si no lo tapa', () => {
  const d = documentoPairings({ src: 'https://ejemplo/plancha.jpg' }, contador());
  const objs = objetos(d);
  const iPlaca = objs.findIndex((o) => o.type === 'rect');
  const iPa = objs.findIndex((o) => o.text === 'Pa');
  assert.ok(iPlaca >= 0, 'no se dibujó la placa');
  assert.ok(iPlaca < iPa, `la placa quedó encima del texto (placa ${iPlaca}, Pa ${iPa})`);
  assert.equal(objs[iPa].fill, '#FFFFFF', 'el «Pa» tiene que ser blanco sobre la placa');
});

test('el fondo es la PLANCHA, no un color: sin eso el texto se vería dos veces', () => {
  const d = documentoPairings({ src: 'https://ejemplo/plancha.jpg' }, contador());
  const fondo = paginas(d)[0].background as Obj;
  assert.equal(fondo.type, 'image');
  assert.equal(fondo.src, 'https://ejemplo/plancha.jpg');
  assert.equal(fondo.fit, 'cover');
  assert.equal(d.width, 1080);
  assert.equal(d.height, 1350);
});

test('una variante que el catálogo no tiene se CAZA antes de guardar', () => {
  // El catálogo real verifica archivo por archivo; una variante inexistente da 404 y el navegador
  // pinta la fuente del sistema EN SILENCIO. Por eso se compara contra la lista, no se confía.
  const catalogoCompleto = variantesDe(BLOQUES_PAIRINGS);
  assert.deepEqual(faltanEnElCatalogo(BLOQUES_PAIRINGS, catalogoCompleto), []);

  const sinLaItalica = catalogoCompleto.filter((v) => !v.endsWith('i'));
  const faltan = faltanEnElCatalogo(BLOQUES_PAIRINGS, sinLaItalica);
  assert.equal(faltan.length, 1, `esperaba que faltara 1 y faltan ${faltan.length}: ${faltan.join(', ')}`);
  assert.ok(faltan[0].includes(SERIF_ITALICA) && faltan[0].endsWith('i'), faltan[0]);
});

test('documentoDeClon respeta el orden que se le da', () => {
  const bloques: BloqueMedido[] = [
    { nombre: 'uno', texto: 'A', familia: 'Inter', peso: 400, italica: false, tam: 10, left: 0, top: 0, ancho: 10, color: '#000' },
    { nombre: 'dos', texto: 'B', familia: 'Lato', peso: 700, italica: true, tam: 20, left: 0, top: 0, ancho: 10, color: '#fff' },
  ];
  const d = documentoDeClon({ plancha: { src: 'p.jpg' }, bloques, nombre: 'x', nuevoId: contador() });
  const t = textos(d);
  assert.deepEqual(t.map((o) => o.text), ['A', 'B']);
  assert.deepEqual(t.map((o) => o.fontFamily), ['Inter', 'Lato']);
  assert.deepEqual(t.map((o) => o.fontStyle), ['normal', 'italic']);
});
