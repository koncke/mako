// =============================================================================
// La réplica adaptada en producción (13/11/2026): lo que la IA copió de la original a pesar del prompt
// =============================================================================
// Replicada desde la tarjeta de outliers la landing de Clara (clase.highticketclarity.com) para el negocio de MaKo: 7 de 7
// secciones y escrita para su oferta, pero con sus testimonios y montos («De 0 a 9.000 USD por mes»), sus números
// («+192.000 seguidores», «más de 400.000»), su trayectoria («más de 10 años») y la fecha y hora de SU masterclass. El
// registro decía «0 citas o cifras de la original vaciadas» y el aviso listaba cinco. Y los 5 pasos numerados salieron como
// 3 viñetas: la IA pidió «cajas-numeradas», que no existe, y el bloque cayó a «Viñetas grandes». Lo que fija:
//   1. la cifra de la original (valor con su unidad, o 1.000 o más con cualquiera) pasa a [DATO]; la fecha y la hora, a
//      [FECHA] y [HORA]; lo del negocio y lo de la estructura no se tocan;
//   2. el aviso dice cuántas quedaron así; y la réplica lo hace (no sólo el prompt);
//   3. la grilla con foto de la original deja el hueco de cada foto (la IA la armó sin imagen);
//   4. una variante con el nombre parecido es esa variante.
// Correr: node --import tsx --test tests/web-generator-replicar-1311.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avisoDeDatosDeLaOriginal, sinCifrasDeLaOriginal } from '../lib/editor-landing/ia-reglas';
import { VARIANTES_CON_IMAGEN, varianteCercana } from '../lib/editor-landing/ia-bloques';
import { conHuecoDeFoto } from '../lib/editor-landing/replicar-estructura';
import { NODO, textoDe, type JsonNodo } from '../lib/editor-landing/doc';

// Lo que dice la original (frases de su página, como las lee el esquema).
const ORIGINAL = [
  'Imaginá agregar 10K AL MES a tu facturación', 'Lunes 28 de septiembre', '19:00 Argentina',
  'Más de 10 años en negocios online y marketing digital', 'Más de 50 negocios high ticket acompañados a escalar',
  'Más de 400.000 seguidores entre mis cuentas', 'De 0 a 9.000 USD por mes, en 60 días', 'De 2.000 a 10.000 USD por mes',
  'le agregó 8.000 dólares a su facturación mensual', '7.000 USD en ventas, con menos de 400 seguidores',
  '+192.000 seguidores en TikTok', 'En los primeros 15 minutos de la masterclass', 'Nos vemos el lunes 28 a las 19:00',
  'Parte 1 · Qué publicar', 'Precio: 97 dólares',
].join(' ');
const NEGOCIO = 'WhatsApp Ads Funnel. Para negocios que venden por WhatsApp. US$97 por mes.';

const p = (texto: string): JsonNodo => ({ type: 'paragraph', content: [{ type: 'text', text: texto }] });
const tarjeta = (...hijos: JsonNodo[]): JsonNodo => ({ type: NODO.tarjeta, attrs: { id: 't1' }, content: hijos });

test('1. lo de la original pasa a [DATO], [FECHA] y [HORA]; lo del negocio y lo de la estructura, no', () => {
  // Las frases tal como las escribió la réplica de producción (landing 117).
  const casos: Array<[string, string]> = [
    ['Llevo más de 10 años en esto, acompañé a decenas de negocios', 'Llevo más de [DATO] años en esto, acompañé a decenas de negocios'],
    ['De 0 a 9.000 USD por mes', 'De 0 a [DATO] USD por mes'],
    ['De 2.000 a 10.000 USD por mes', 'De [DATO] a [DATO] USD por mes'],
    ['le agregó 8.000 dólares a su facturación mensual', 'le agregó [DATO] dólares a su facturación mensual'],
    ['+192.000 seguidores en WhatsApp Business', '+[DATO] seguidores en WhatsApp Business'],
    ['Más de 400.000 contactos y conversaciones', 'Más de [DATO] contactos y conversaciones'],
    ['Lunes 28 de septiembre · 19:00 Argentina · gratis y en vivo', '[FECHA] · [HORA] Argentina · gratis y en vivo'],
    ['Nos vemos el lunes 28 a las 19:00', 'Nos vemos el [FECHA] a las [HORA]'],
    ['En los primeros 15 minutos te lo muestro', 'En los primeros [DATO] minutos te lo muestro'],
    // Lo que no se toca: la estructura, lo del negocio, lo que la original no tiene, lo que ya es un hueco.
    ['Parte 1: Qué escribir', 'Parte 1: Qué escribir'],
    ['Desde US$97 por mes', 'Desde US$97 por mes'],
    ['Soporte 24/7 y 3 pasos', 'Soporte 24/7 y 3 pasos'],
    ['Acompañamos a 35 agencias', 'Acompañamos a 35 agencias'],
    ['Hoy tiene [cifra de seguidores]', 'Hoy tiene [cifra de seguidores]'],
    ['Imaginá agregar [DATO] al mes', 'Imaginá agregar [DATO] al mes'],
  ];
  for (const [antes, despues] of casos) {
    const r = sinCifrasDeLaOriginal(tarjeta(p(antes)), ORIGINAL, NEGOCIO);
    assert.equal(textoDe(r.tarjeta, ' ').trim(), despues, antes);
  }
  const todo = sinCifrasDeLaOriginal(tarjeta(...casos.map(([a]) => p(a))), ORIGINAL, NEGOCIO);
  assert.ok(todo.cambiadas.includes('9.000 USD'), todo.cambiadas.join(' | '));
  assert.ok(todo.cambiadas.includes('Lunes 28 de septiembre'));
  assert.ok(!todo.cambiadas.some((c) => /97|24|35|Parte/.test(c)), 'lo del negocio y la estructura no se cuentan');
  // El valor de un ítem de estadísticas también.
  const item: JsonNodo = { type: NODO.optimizadoItem, attrs: { valor: '9.000 USD' }, content: [p('por mes')] };
  const conItem = sinCifrasDeLaOriginal(tarjeta(item), ORIGINAL, NEGOCIO).tarjeta;
  assert.equal(conItem.content?.[0]?.attrs?.valor, '[DATO] USD');
  // «10K al mes» de la original: el mismo valor escrito de otra forma también es de ella.
  assert.equal(textoDe(sinCifrasDeLaOriginal(tarjeta(p('Sumá 10.000 al mes')), ORIGINAL, NEGOCIO).tarjeta, ' ').trim(), 'Sumá [DATO] al mes');
});

test('2. el aviso dice cuántas quedaron como hueco, y la réplica lo hace (no sólo el prompt)', () => {
  assert.equal(avisoDeDatosDeLaOriginal([]), '');
  assert.equal(avisoDeDatosDeLaOriginal(['9.000 USD']), 'Una cifra, fecha u hora de la original quedó como [DATO], [FECHA] u [HORA]: complétalas con las de tu negocio.');
  assert.match(avisoDeDatosDeLaOriginal(['a', 'b', 'c']), /^3 cifras, fechas u horas de la original quedaron/);
  const src = readFileSync(join(process.cwd(), 'lib/editor-landing/replicar.ts'), 'utf8');
  assert.match(src, /sinCifrasDeLaOriginal\(f\.tarjeta, original, negocio\)/, 'después del filtro de citas, con lo que dice el negocio');
  assert.match(src, /avisoDeDatosDeLaOriginal\(datosAjenos\),/);
});

test('3. la grilla con foto de la original deja el hueco de cada foto aunque la IA la arme sin imagen', () => {
  const item = (t: string): JsonNodo => ({ type: NODO.optimizadoItem, attrs: { icono: null, imagenSrc: null }, content: [p(t)] });
  const grilla = (variante: string, n: number): JsonNodo => ({ type: NODO.optimizado, attrs: { variante, columnas: 'auto' }, content: Array.from({ length: n }, (_, i) => item(`caso ${i + 1}`)) });
  // Como salió en producción: los 6 testimonios en una grilla sin imagen, y 3 beneficios arriba.
  const t = tarjeta(grilla('cajas-solidas', 3), grilla('cajas-solidas', 6));
  const disp = { tarjetas: { cantidad: 6, conFoto: true }, fotos: 6, video: false };
  const r = conHuecoDeFoto(t, disp, VARIANTES_CON_IMAGEN);
  assert.equal(r.cambiada, true);
  assert.deepEqual(r.tarjeta.content?.map((c) => c.attrs?.variante), ['cajas-solidas', 'imagenes-texto'], 'la de 6, no la de 3');
  assert.equal(conHuecoDeFoto(t, { ...disp, tarjetas: { cantidad: 6, conFoto: false } }, VARIANTES_CON_IMAGEN).cambiada, false, 'sin foto en la original, nada');
  assert.equal(conHuecoDeFoto(tarjeta(grilla('citas-caras', 6)), disp, VARIANTES_CON_IMAGEN).cambiada, false, 'si ya lleva imagen, queda');
  assert.equal(conHuecoDeFoto(t, null, VARIANTES_CON_IMAGEN).tarjeta, t);
  const src = readFileSync(join(process.cwd(), 'lib/editor-landing/replicar.ts'), 'utf8');
  assert.match(src, /conHuecoDeFoto\(deLaIA, disposiciones\[i\] \?\? null, VARIANTES_CON_IMAGEN\)/, 'la réplica lo aplica a cada sección que pasó por la IA');
});

test('4. una variante con el nombre parecido es esa variante (no «Viñetas grandes»)', () => {
  assert.equal(varianteCercana('cajas-numeradas'), 'cajas-numeros');
  assert.equal(varianteCercana('viñetas-grandes'), 'vinetas-grandes');
  assert.equal(varianteCercana('Cajas Numeros'), 'cajas-numeros');
  assert.equal(varianteCercana('cosa-que-no-existe'), null);
  assert.equal(varianteCercana(''), null);
});
