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
import { avisoDeDatosDeLaOriginal, conFrasesNuevas, frasesCopiadas, sinCifrasDeLaOriginal, sinNumeroDelPedido, TOPE_FRASES } from '../lib/editor-landing/ia-reglas';
import { VARIANTES_CON_IMAGEN, varianteCercana } from '../lib/editor-landing/ia-bloques';
import {
  acomodoDeSeccion, alTuteoEnTarjeta, anchoDeColumna, conAnchoDeColumna, conBotonEnCadaSeccion, conFondoDeLaOriginal, conHuecoDeFoto, conLadoDeFoto,
  conTituloResaltado, disposicionPorSeccion, huecosParaPublicar, itemsDeTarjeta, itemsEsperados, notaDeCantidad, testimoniosParaCompletar,
  NOTA_TITULO_RESALTA, PARTES_BOTON_REPETIDO, TESTIMONIO_PARA_COMPLETAR, type MoldeSeccion,
} from '../lib/editor-landing/replicar-estructura';
import { estiloDeHtml, sanearEstilo, tamanoPx, temaDeEstilo } from '../lib/editor-landing/estilo-original';
import { attrsTarjeta, specTarjeta } from '../lib/editor-landing/especificacion';
import { htmlDeArbol } from '../lib/editor-landing/grafico-svg';
import { nombreDeCopia, nombreDeOferta, PARTES_ADAPTAR } from '../lib/editor-landing/replicar-partes';
import { sanearTemaPropio, temaPorId, varsDeTema } from '../lib/editor-landing/temas';
import { CSS_CONTENIDO } from '../lib/editor-landing/css';
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
  assert.match(src, /sinCifrasDeLaOriginal\(t, original, negocio\)/, 'con lo que dice el negocio');
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
  assert.match(src, /conHuecoDeFoto\(t0IA, disposiciones\[i\] \?\? null, VARIANTES_CON_IMAGEN\)/, 'la réplica lo aplica a cada sección que pasó por la IA');
});

test('4. una variante con el nombre parecido es esa variante (no «Viñetas grandes»)', () => {
  assert.equal(varianteCercana('cajas-numeradas'), 'cajas-numeros');
  assert.equal(varianteCercana('viñetas-grandes'), 'vinetas-grandes');
  assert.equal(varianteCercana('Cajas Numeros'), 'cajas-numeros');
  assert.equal(varianteCercana('cosa-que-no-existe'), null);
  assert.equal(varianteCercana(''), null);
});

// ── La segunda vuelta del 13/11, con la lista del Cerebro: lo que la réplica tiene que copiar del diseño ──

test('5. el lector mide la columna, de qué lado va la foto y si el botón se repite', () => {
  const html = `<html><head><style>.wrap{max-width:760px;margin:auto}.cta{background:#c9a227;color:#111}</style></head><body>
    <section><div class="wrap"><h1>El titular</h1><p>texto</p><video src="v.mp4"></video><a class="cta" href="#">Quiero</a></div></section>
    <section><div class="wrap"><img src="https://x.com/clara.jpg" width="400" height="500"><h2>Quién es</h2><p>bio</p><a class="cta" href="#">Quiero</a></div></section>
    <section><div class="wrap"><h2>Pasos</h2><a class="cta" href="#">Quiero</a></div></section>
    <section><div class="wrap"><h2>Preguntas</h2><a class="cta" href="#">Quiero</a></div></section>
  </body></html>`;
  const e = estiloDeHtml(html, 'https://x.com/');
  assert.equal(e.anchoContenido, 760);
  assert.equal(e.botonEnPartes, 4);
  assert.equal(e.secciones[0].video, true);
  assert.equal(e.secciones[0].lado, 'derecha', 'el video después del título: a la derecha');
  assert.equal(e.secciones[1].lado, 'izquierda', 'la foto antes del título: a la izquierda');
  const saneado = sanearEstilo(JSON.parse(JSON.stringify(e)))!;
  assert.equal(saneado.anchoContenido, 760);
  assert.equal(saneado.botonEnPartes, 4);
  assert.equal(saneado.secciones[1].lado, 'izquierda');
  assert.equal(PARTES_BOTON_REPETIDO, 4);
});

const tarjetaCon = (attrs: Record<string, unknown>, ...hijos: JsonNodo[]): JsonNodo => ({ type: NODO.tarjeta, attrs: { id: 't', diseno: 'sin', ancho: 'normal', ...attrs }, content: hijos });

test('6. la foto o el video al costado, y la columna con el ancho de la original', () => {
  const vacia: JsonNodo = { type: NODO.imagen, attrs: { src: '', alt: '' } };
  const hero = tarjetaCon({}, p('titular'), vacia);
  const r = conLadoDeFoto(hero, { tarjetas: null, fotos: 0, video: true, lado: 'derecha' });
  assert.equal(r.cambiada, true);
  assert.equal(r.tarjeta.attrs?.diseno, 'derecha');
  assert.ok(!r.tarjeta.content?.some((c) => c.type === NODO.imagen), 'el hueco es el del costado: la imagen vacía del cuerpo se va');
  assert.equal(conLadoDeFoto(hero, { tarjetas: null, fotos: 1, video: false, lado: 'izquierda' }).tarjeta.attrs?.diseno, 'izquierda');
  assert.equal(conLadoDeFoto(hero, { tarjetas: { cantidad: 6, conFoto: true }, fotos: 6, video: false }).cambiada, false, 'las fotos de una grilla no van al costado');
  assert.equal(conLadoDeFoto(tarjetaCon({ diseno: 'arriba' }), { tarjetas: null, fotos: 1, video: false }).cambiada, false, 'la que ya tiene imagen de acento queda');
  assert.equal(anchoDeColumna(760), 'angosto');
  assert.equal(anchoDeColumna(1100), 'normal');
  assert.equal(anchoDeColumna(1400), 'amplio');
  assert.equal(anchoDeColumna(undefined), null);
  assert.equal(conAnchoDeColumna(hero, 'angosto').attrs?.ancho, 'angosto');
  const ancha = conAnchoDeColumna(tarjetaCon({ ancho: 'completo' }), 'angosto');
  assert.deepEqual([ancha.attrs?.ancho, ancha.attrs?.anchoCuerpo], ['completo', 'angosto'], 'a todo el ancho, con el contenido en la columna');
});

test('7. los testimonios de la otra quedan para completar; la grilla y su cantidad, no', () => {
  const item = (t: string): JsonNodo => ({ type: NODO.optimizadoItem, attrs: { imagenSrc: null, valor: '9.000 USD' }, content: [p(t)] });
  const prueba = tarjetaCon({}, { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Lo que pasa cuando…' }] },
    { type: NODO.optimizado, attrs: { variante: 'imagenes-texto' }, content: [item('Arrancó de cero…'), item('Publicaba, pero…'), item('Cobraba poco…')] },
    { type: 'blockquote', content: [p('«Me cambió la vida» — Sele')] });
  const r = testimoniosParaCompletar(prueba);
  assert.equal(r.items, 4);
  const texto = textoDe(r.tarjeta, ' ');
  assert.ok(!/Arrancó|Publicaba|Cobraba|Sele|9\.000/.test(texto), texto);
  assert.ok(texto.includes('Lo que pasa cuando…'), 'el título de la sección queda');
  assert.equal(texto.split(TESTIMONIO_PARA_COMPLETAR[1]).length - 1, 3);
  assert.ok(texto.includes('[Testimonio real de un cliente]'));
  assert.equal(r.tarjeta.content?.[1]?.attrs?.variante, 'imagenes-texto', 'la grilla con su hueco de foto queda');
  const src = readFileSync(join(process.cwd(), 'lib/editor-landing/replicar.ts'), 'utf8');
  assert.match(src, /tipo === 'prueba'\) \{\s*const tp = testimoniosParaCompletar\(d\.tarjeta\);/, 'en la sección de prueba social de la adaptada');
});

test('8. el botón principal después de cada sección, cuando la original lo repite', () => {
  const boton: JsonNodo = { type: NODO.botones, attrs: { alinea: 'izquierda' }, content: [{ type: NODO.boton, attrs: { href: '#', variante: 'primario' }, content: [{ type: 'text', text: 'Quiero mi lugar' }] }] };
  const form: JsonNodo = { type: NODO.formulario, attrs: {} };
  const ts = [tarjetaCon({}, p('hero'), boton), tarjetaCon({}, p('pasos')), tarjetaCon({}, p('con form'), form), tarjetaCon({}, p('preguntas'))];
  const r = conBotonEnCadaSeccion(ts);
  assert.equal(r.sumados, 2, 'la de pasos y la de preguntas; la del formulario ya tiene el suyo');
  const ultimo = r.tarjetas[3].content?.at(-1);
  assert.equal(ultimo?.type, NODO.botones);
  assert.equal(ultimo?.attrs?.alinea, 'centro');
  assert.equal(textoDe(ultimo!, ' ').trim(), 'Quiero mi lugar');
  assert.equal(r.tarjetas[2].content?.length, 2, 'la del formulario, sin botón de más');
  assert.equal(conBotonEnCadaSeccion([tarjetaCon({}, p('sin botón'))]).sumados, 0, 'sin un botón en la réplica, nada que repetir');
});

test('9. una réplica con huecos de lo ajeno no se publica; una plantilla con corchetes, sí', () => {
  const contenido = { type: 'doc', content: [tarjetaCon({}, p('Llevo más de [DATO] años'), p('[FECHA] a las [HORA]'), p(TESTIMONIO_PARA_COMPLETAR[1]))] };
  const replica = { origen: { modo: 'importar', basadoEnUrl: 'https://clase.highticketclarity.com/' } };
  assert.equal(
    huecosParaPublicar(contenido, replica),
    'Antes de publicar, completa lo que la réplica dejó para ti: una cifra [DATO], 2 fechas u horas, un testimonio. Pon los de tu negocio o pídele a MaKo que los cambie.',
  );
  assert.equal(huecosParaPublicar(contenido, { origen: { modo: 'plantilla' } }), null, 'los corchetes de una plantilla son otra cosa');
  assert.equal(huecosParaPublicar({ type: 'doc', content: [tarjetaCon({}, p('Todo completo'))] }, replica), null);
  const pub = readFileSync(join(process.cwd(), 'lib/editor-landing/publicar.ts'), 'utf8');
  assert.match(pub, /const huecos = huecosParaPublicar\(f\.contenido, f\.config\);\s*if \(huecos\) return falla\(huecos, 422\);/, 'publicar frena antes de escribir la foto');
});

test('10. las frases iguales a la original se reconocen y se reemplazan; el sello va al pie en el teléfono', () => {
  const t = tarjetaCon({}, p('Imaginá agregar 10K al mes a tu facturación con un sistema'), p('Una frase nueva escrita para este negocio de punta a punta'), p('corta'));
  const copiadas = frasesCopiadas(t, `${ORIGINAL} Imaginá agregar 10K al mes a tu facturación con un sistema de contenido`);
  assert.deepEqual(copiadas, ['Imaginá agregar 10K al mes a tu facturación con un sistema']);
  const nueva = conFrasesNuevas(t, new Map([[copiadas[0], 'Suma ventas por WhatsApp sin perseguir a nadie']]));
  assert.equal(textoDe(nueva.content![0], ' ').trim(), 'Suma ventas por WhatsApp sin perseguir a nadie');
  assert.equal(textoDe(nueva.content![1], ' ').trim(), 'Una frase nueva escrita para este negocio de punta a punta');
  assert.ok(TOPE_FRASES >= 24, 'entran las 24 de Clara');
  // Producción, landing 118: el titular volvió como «1. Imagina sumar…» (las frases van numeradas en el pedido).
  assert.equal(sinNumeroDelPedido('1. Imagina sumar [DATO] al mes', 'Imaginá agregar 10K al mes'), 'Imagina sumar [DATO] al mes');
  assert.equal(sinNumeroDelPedido('12) Otra frase', 'Una frase'), 'Otra frase');
  assert.equal(sinNumeroDelPedido('3 pasos para vender', '3 pasos para crecer'), '3 pasos para vender', 'si la original empezaba con un número, queda');
  assert.equal(sinNumeroDelPedido('2026 es tu año', 'Este es tu año'), '2026 es tu año', 'un número que no es de la lista, queda');
  assert.match(readFileSync(join(process.cwd(), 'lib/editor-landing/ia.ts'), 'utf8'), /sinNumeroDelPedido\(limpiarTextoDelModelo\(nuevas\[i\] as string\), f\)/);
  // El sello «Hecho con MaKo»: en la publicada flota; en el teléfono, al pie (no tapa el texto).
  const movil = CSS_CONTENIDO.slice(CSS_CONTENIDO.indexOf('@media (max-width: 768px) {'));
  assert.match(movil, /\.gm-doc \.gm-marca ?\{ ?position: static;/);
});

// ── La tercera vuelta del 13/11 (Cerebro): el titular dorado y la cantidad exacta de ítems ──

test('11. el lector ve la parte del titular que resalta, aunque su regla sea «h1 em»', () => {
  // El h1 de Clara, tal cual: el dorado viene de `h1 em{color:var(--gold-deep)}`, una regla con descendiente.
  const html = `<html><head><style>:root{--gold-deep:#8A6E27}h1{color:#111}h1 em{font-style:normal;color:var(--gold-deep)}h1 em.gigante{font-size:1.5em}</style></head>
    <body><section><h1>Imaginá agregar<br> <em class="gigante">10K AL MES</em><br> a tu facturación</h1></section></body></html>`;
  const e = estiloDeHtml(html, 'https://x.com/');
  assert.equal(e.titulo, '#111111');
  assert.deepEqual(e.tituloResalta, { color: '#8a6e27' });
  assert.equal(e.acento, '#8a6e27', 'la parte que resalta es el acento del tema');
  const conDegradado = estiloDeHtml('<html><head><style>h1{color:#111}.dorado{background-image:linear-gradient(90deg,#c9a227,#f5d76e);-webkit-background-clip:text;color:transparent}</style></head><body><h1>Sumá <span class="dorado">más ventas</span></h1></body></html>', 'https://x.com/');
  assert.equal(conDegradado.tituloResalta?.color, '#c9a227');
  assert.match(conDegradado.tituloResalta?.degradado ?? '', /linear-gradient/);
  assert.equal(estiloDeHtml('<html><head><style>h1{color:#111}</style></head><body><h1>Todo <b>de un color</b></h1></body></html>', 'https://x.com/').tituloResalta, undefined, 'una negrita del mismo color no resalta');
  assert.deepEqual(sanearEstilo(JSON.parse(JSON.stringify(e)))!.tituloResalta, { color: '#8a6e27' });
});

test('12. la réplica pone su frase clave en el color de acento (la IA la marca en negrita)', () => {
  const titulo: JsonNodo = { type: 'heading', attrs: { level: 1 }, content: [
    { type: 'text', text: 'Suma ' }, { type: 'text', text: 'más clientes', marks: [{ type: 'bold' }] }, { type: 'text', text: ' por WhatsApp' },
  ] };
  const r = conTituloResaltado(tarjetaCon({}, titulo, { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'otro', marks: [{ type: 'bold' }] }] }));
  assert.equal(r.cambiada, true);
  const marcas = r.tarjeta.content?.[0]?.content?.[1]?.marks ?? [];
  assert.deepEqual(marcas, [{ type: 'bold' }, { type: 'textStyle', attrs: { color: 'acento', tam: null } }]);
  assert.deepEqual(r.tarjeta.content?.[1]?.content?.[0]?.marks, [{ type: 'bold' }], 'sólo el primer título');
  assert.equal(conTituloResaltado(tarjetaCon({}, p('sin título'))).cambiada, false);
  assert.match(NOTA_TITULO_RESALTA, /\*\*/);
  const src = readFileSync(join(process.cwd(), 'lib/editor-landing/replicar.ts'), 'utf8');
  assert.match(src, /i === 0 && estiloLeido\?\.tituloResalta \? \[a, NOTA_TITULO_RESALTA\]/, 'la nota del hero lo pide');
  assert.match(src, /i === 0 && estiloLeido\?\.tituloResalta \? conTituloResaltado\(conAncho\)/, 'y el hero lo recibe');
});

test('13. la cantidad de ítems la pone la original: lo esperado, lo que vino y la nota de la segunda pasada', () => {
  const molde = (o: Partial<MoldeSeccion>): MoldeSeccion => ({ titulo: 'x', subtitulos: 0, parrafos: 0, vinetas: 0, botones: 0, desplegables: 0, palabras: 1, ...o });
  assert.deepEqual(itemsEsperados(molde({ desplegables: 6 }), null), { cantidad: 6, que: 'preguntas' });
  assert.deepEqual(itemsEsperados(molde({ subtitulos: 5 }), { tarjetas: { cantidad: 5, conFoto: false }, fotos: 0, video: false }), { cantidad: 5, que: 'tarjetas' });
  assert.deepEqual(itemsEsperados(molde({ subtitulos: 4 }), null), { cantidad: 4, que: 'tarjetas' });
  assert.equal(itemsEsperados(molde({ subtitulos: 2 }), null), null, 'dos subtítulos no son una grilla');
  const pasos = (n: number): JsonNodo => tarjetaCon({}, { type: NODO.optimizado, attrs: { variante: 'cajas-numeros' }, content: Array.from({ length: n }, (_, i) => ({ type: NODO.optimizadoItem, attrs: {}, content: [p(`paso ${i + 1}`)] })) });
  assert.equal(itemsDeTarjeta(pasos(3), 'tarjetas'), 3);
  const faq = tarjetaCon({}, ...Array.from({ length: 4 }, () => ({ type: NODO.desplegable, content: [] } as JsonNodo)));
  assert.equal(itemsDeTarjeta(faq, 'preguntas'), 4);
  assert.equal(notaDeCantidad({ cantidad: 5, que: 'tarjetas' }, 3), 'CANTIDAD EXACTA: 5 ítems (tarjetas o pasos) en un solo bloque, ni uno más ni uno menos (la vuelta anterior trajo 3: faltaron 2).');
  assert.match(notaDeCantidad({ cantidad: 6, que: 'preguntas' }, 8), /6 preguntas desplegables.*sobraron 2/);
  assert.equal(acomodoDeSeccion(molde({ desplegables: 6 }), null), '6 preguntas desplegables, ni una más ni una menos');
  const src = readFileSync(join(process.cwd(), 'lib/editor-landing/replicar.ts'), 'utf8');
  assert.match(src, /await correr\(torcidas\.map\(\(i\) => \[i\]\), '3ª vuelta: cantidad', esqFirme\);/, 'la segunda pasada corre sola');
  assert.match(src, /if \(lejos\(ahora\) > lejos\(antes\)\) porIndice\.set\(i, antes\);/, 'y queda la que más se acerca');
});

// ── La cuarta vuelta del 13/11 (Cerebro, mirando la landing 118 en el editor) ──

test('14. el nombre es el de la oferta (el origen queda en config), y el texto de la réplica va de «tú»', () => {
  const oferta = 'WhatsApp Ads Funnel; promesa: más clientes por WhatsApp; precio: US$97';
  assert.equal(nombreDeCopia(PARTES_ADAPTAR, 'clase.highticketclarity.com', 'Su título', oferta), 'Landing · WhatsApp Ads Funnel');
  assert.equal(nombreDeCopia(PARTES_ADAPTAR, 'otra.com', 'Su título'), 'Adaptada de otra.com', 'sin oferta, como antes');
  assert.equal(nombreDeOferta('Mentoría para coaches que quieren vender programas de alto valor por WhatsApp sin perseguir a nadie'), 'Mentoría para coaches que quieren vender programas de alto…');
  const conVoseo = tarjetaCon({}, { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Lo que pasa cuando sabés exactamente qué vende' }] }, p('Mirá cómo funciona y escribinos por WhatsApp. Esto es para vos.'));
  const tu = textoDe(alTuteoEnTarjeta(conVoseo), ' ');
  assert.match(tu, /cuando sabes exactamente/);
  assert.match(tu, /Mira cómo funciona/);
  assert.match(tu, /para ti/);
  assert.doesNotMatch(tu, /sabés|Mirá|vos\b/);
  const src = readFileSync(join(process.cwd(), 'lib/editor-landing/replicar.ts'), 'utf8');
  assert.match(src, /const t = vosea \? conFrases : alTuteoEnTarjeta\(conFrases\);/, 'salvo que el negocio declare una voz que vosea');
  assert.match(src, /return a\.seguro && VOSEAN\.has\(a\.id\);/, 'declarada, como Copywriting: la zona horaria sola no cuenta');
  assert.match(src, /nombreDeCopia\(partes, hostDe\(url\), esq\.titulo, entrada\.oferta\)/);
});

test('15. el fondo de cada sección como el de su parte de la original', () => {
  const disp = disposicionPorSeccion([[0], [1]], [{ fondo: '#ffffff' }, { fondo: '#faf7ee', fotos: 1 }]);
  assert.equal(disp[1]?.fondo, '#faf7ee');
  const quien = conFondoDeLaOriginal(tarjetaCon({ fondo: 'tema' }), disp[1]?.fondo, '#ffffff');
  assert.equal(quien.cambiada, true);
  assert.deepEqual([quien.tarjeta.attrs?.fondo, quien.tarjeta.attrs?.fondoColor], ['color', '#faf7ee']);
  assert.deepEqual([quien.tarjeta.attrs?.ancho, quien.tarjeta.attrs?.anchoCuerpo], ['completo', 'normal'], 'una FRANJA: de borde a borde, el contenido en su columna');
  const angosta = conFondoDeLaOriginal(tarjetaCon({ fondo: 'tema', ancho: 'angosto' }), '#faf7ee', '#ffffff').tarjeta;
  assert.equal(angosta.attrs?.anchoCuerpo, 'angosto');
  // El render: la franja lleva data-cuerpo, y la hoja deja el contenido en la columna con el fondo a sangre.
  const html = htmlDeArbol(specTarjeta(angosta.attrs) as never);
  assert.match(html, /data-ancho="completo" data-cuerpo="angosto"/);
  assert.match(CSS_CONTENIDO, /\.gm-tarjeta\[data-ancho="completo"\]\[data-cuerpo="angosto"\] ?\{ ?padding-inline: max\(0em, calc\(\(100% - 48em\) \/ 2\)\);/);
  assert.equal(attrsTarjeta({ ancho: 'angosto', anchoCuerpo: 'raro' }).anchoCuerpo, null, 'el saneo sólo deja angosto o normal');
  assert.ok(!htmlDeArbol(specTarjeta(attrsTarjeta({ ancho: 'angosto', anchoCuerpo: 'angosto' })) as never).includes('data-cuerpo'), 'sin todo el ancho, no hay franja');
  assert.equal(conFondoDeLaOriginal(tarjetaCon({ fondo: 'tema' }), '#FFFFFF', '#ffffff').cambiada, false, 'el de la página no se repite');
  assert.equal(conFondoDeLaOriginal(tarjetaCon({ fondo: 'acento' }), '#faf7ee', '#ffffff').cambiada, false, 'la que ya trae su fondo queda');
  assert.equal(conFondoDeLaOriginal(tarjetaCon({}), 'linear-gradient(red, blue)', '#ffffff').cambiada, false, 'sólo un color');
});

test('16. el titular y los títulos con su tamaño, cada uno con su escala', () => {
  assert.equal(tamanoPx('clamp(1.9rem,7.2vw,3.5rem)'), 56, 'de un clamp, el máximo (el de escritorio)');
  assert.equal(tamanoPx('48px'), 48);
  assert.equal(tamanoPx('5vw'), null);
  // Como Clara: el h1 suelto y los h2 adentro de un contenedor («.sec-h h2»), ninguno suelto.
  const html = `<html><head><style>body{background:#ffffff;color:#222222}h1{font-size:clamp(1.9rem,7.2vw,3.5rem)}.sec-h h2{font-size:clamp(1.55rem,5.4vw,2.3rem)}.quien h2{font-size:2.3rem}.paso h3{font-size:1.05rem}</style></head><body>
    <section><h1>Titular</h1></section><section><div class="sec-h"><h2>Uno</h2><div class="paso"><h3>Paso</h3></div></div></section><section class="quien"><h2>Dos</h2></section><section class="sec-h"><h2>Tres</h2></section></body></html>`;
  const e = estiloDeHtml(html, 'https://x.com/');
  assert.equal(e.tamTitular, 56);
  assert.equal(e.tamTitulos, 37);
  assert.equal(e.tamSubtitulos, 17);
  const tema = temaDeEstilo(e, 'https://x.com/')!;
  assert.deepEqual(tema.cambios.escala, { titulos: 1.22, titular: 0.7, subtitulos: 0.73 });
  const resuelto = sanearTemaPropio(tema)!;
  const escalaDe = (t: { cambios: { escala?: unknown } }) => (t.cambios.escala ?? {}) as { titular?: number; subtitulos?: number };
  assert.equal(escalaDe(resuelto).titular, 0.7, 'el saneo del tema la conserva');
  // El CSS: el h1 grande usa SU escala; sin ella, la de los títulos (ningún tema de antes cambia).
  assert.match(CSS_CONTENIDO, /\.gm-doc h1\.gm-titulo ?\{ font-size: calc\(5em \* var\(--gm-escala-titular, var\(--gm-escala-titulos, 1\)\)/);
  const vars = varsDeTema(temaPorId('pewter'));
  assert.equal(vars['--gm-escala-titular'], vars['--gm-escala-titulos'], 'un tema sin titular: la de los títulos');
  assert.equal(vars['--gm-escala-subtitulos'], vars['--gm-escala-titulos'], 'ni subtítulos: la de los títulos');
  assert.match(CSS_CONTENIDO, /\.gm-doc h3 ?\{ font-size: calc\(1\.45em \* var\(--gm-escala-subtitulos, var\(--gm-escala-titulos, 1\)\)/);
  assert.equal(escalaDe(sanearTemaPropio(tema)!).subtitulos, 0.73);
});
