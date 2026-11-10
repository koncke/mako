// =============================================================================
// B-roll y cambios de plano del Video Editor (pedido de Leila, 30/10/2026; tanda 2 de nube-video-clips)
// =============================================================================
// Lo que fija este archivo, corriendo el código (no leyéndolo):
//   1. DÓNDE (lib/editor-video/broll.ts): nada en el gancho ni en el cierre, nada sobre lo que la persona ya puso, los
//      huecos separados por el aire del ritmo, el objetivo por largo y ritmo, y las palabras que se pueden mostrar.
//   2. LO QUE ELIGE LA IA (`eleccionDeIA`), con CASOS DE EJEMPLO de respuestas de un modelo: lo bueno pasa; un hueco
//      inventado, repetido, una búsqueda con una dirección o vacía y lo que pasa del objetivo se descartan con su motivo;
//      y sin nada que sirva, el respaldo sin IA.
//   3. LOS PLANOS: cortan en el borde de una frase, el primero va abierto, alternan, el fuerte va donde se dice algo con
//      peso, y lo ocupado no se recorta: se saltea.
//   4. PEXELS (lib/editor-video/broll-pexels.ts): sólo se baja de images.pexels.com (con los cuatro parecidos de la
//      regla de origen), la orientación, y dos huecos no llevan la misma foto.
//   5. LAS PISTAS (app/video-editor/_opencut/broll/pistas.ts): la propuesta va abajo de lo de la persona, los planos
//      últimos, dejar y sacar no tocan nada que no sea una propuesta, y una pista de MaKo vacía se va.
//   6. EL CABLEADO: el registro está importado, la línea de tiempo dibuja la marca, la ruta corre la IA adentro de «sólo
//      su IA», el chat y la API tienen la operación, y los prompts editables coinciden con lo que se renderiza.
//
// PROBADO ROMPIÉNDOLO: al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  eleccionDeIA,
  eleccionDeRespaldo,
  huecosDelPedido,
  huecosParaBroll,
  objetivoBroll,
  palabrasVisibles,
  planosDeLaLinea,
  TOPES_BROLL,
  type Frase,
} from '../lib/editor-video/broll';
import {
  errorDePexels,
  fotoDePexels,
  fotosElegidas,
  orientacionDeLienzo,
  orientacionPexels,
  urlDeFotoPexels,
} from '../lib/editor-video/broll-pexels';
import { BROLL_SYSTEM_TEMPLATE, BROLL_USER_TEMPLATE, PROMPTS_BROLL } from '../lib/editor-video/broll-prompts';
import {
  conPropuestas,
  dejarPropuestas,
  frasesDeSubtitulos,
  pendientesDe,
  sacarPropuestas,
  sinPendientes,
  tramosOcupados,
  NOMBRE_PISTA_BROLL,
  NOMBRE_PISTA_PLANOS,
  PARAM_PROPUESTA,
} from '../app/video-editor/_opencut/broll/pistas';
import { validarOperacion } from '../lib/editor-video/chat-catalogo';
import { OPERACIONES_API } from '../lib/editor-video/chat-api';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// Un guion ficticio de 25 s (una cafetería que se llenó con Instagram): nada de clientes reales.
const GUION: Frase[] = [
  ['¿Sabías que el 80% de los restaurantes cierran el primer año?', 0, 3.2],
  ['Yo tenía una cafetería y casi la pierdo.', 3.4, 6.0],
  ['Las mesas estaban vacías todos los martes.', 6.1, 8.5],
  ['Entonces probé algo distinto con Instagram.', 8.7, 11.0],
  ['Empecé a grabar a mis clientes tomando café.', 11.2, 14.0],
  ['Y en tres semanas, la fila llegaba a la esquina.', 14.1, 17.0],
  ['Hoy facturo el doble que antes.', 17.2, 19.4],
  ['Si tienes un negocio local, esto es para ti.', 19.6, 22.0],
  ['Te dejo la guía gratis en el link.', 22.2, 24.5],
].map(([texto, inicio, fin]) => ({ texto: texto as string, inicio: inicio as number, fin: fin as number }));

// ── 1. Dónde ─────────────────────────────────────────────────────────────────

test('1. los huecos: fuera del gancho y del cierre, en el borde de una frase, separados por el ritmo', () => {
  const { huecos, objetivo } = huecosParaBroll({ frases: GUION, duracion: 25 });
  assert.ok(huecos.length >= objetivo && objetivo >= 1, `${huecos.length} huecos para ${objetivo}`);
  huecos.forEach((h, n) => {
    assert.equal(h.i, n, 'numerados desde 0 en el orden del video');
    assert.ok(h.inicio >= TOPES_BROLL.ganchoSeg, `el hueco ${n} pisa el gancho`);
    assert.ok(h.fin <= 25 - TOPES_BROLL.finalSeg, `el hueco ${n} pisa el cierre`);
    assert.ok(GUION.some((f) => f.inicio === h.inicio), `el hueco ${n} no arranca en una frase`);
    const largo = h.fin - h.inicio;
    assert.ok(largo >= TOPES_BROLL.minSeg - 1e-9 && largo <= TOPES_BROLL.maxSeg + 1e-9, `el hueco ${n} dura ${largo}`);
  });
  for (let a = 0; a < huecos.length; a++) {
    for (let b = a + 1; b < huecos.length; b++) {
      const aire = Math.max(huecos[b].inicio - huecos[a].fin, huecos[a].inicio - huecos[b].fin);
      assert.ok(aire >= 4 - 1e-9, `los huecos ${a} y ${b} quedan a ${aire} s`);
    }
  }
});

test('1b. nada sobre lo que la persona ya puso encima', () => {
  const libre = huecosParaBroll({ frases: GUION, duracion: 25 }).huecos;
  const tapado = libre[0];
  const conOcupado = huecosParaBroll({ frases: GUION, duracion: 25, ocupados: [{ inicio: tapado.inicio + 0.5, fin: tapado.inicio + 1 }] }).huecos;
  assert.ok(conOcupado.every((h) => h.fin <= tapado.inicio + 0.5 || h.inicio >= tapado.inicio + 1), 'un hueco pisa lo ocupado');
  assert.ok(!conOcupado.some((h) => h.inicio === tapado.inicio), 'el hueco tapado sigue estando');
});

test('1c. cuántas: por el largo y el ritmo; un video sin lugar no lleva ninguna', () => {
  assert.equal(objetivoBroll(25, 'normal'), 2);
  assert.ok(objetivoBroll(60, 'mucho') > objetivoBroll(60, 'normal') && objetivoBroll(60, 'normal') > objetivoBroll(60, 'poco'));
  assert.equal(objetivoBroll(3), 0, 'un video de 3 s no tiene lugar después del gancho');
  assert.ok(objetivoBroll(10_000) <= TOPES_BROLL.maxPropuestas);
  assert.deepEqual(huecosParaBroll({ frases: GUION, duracion: 3 }).huecos, []);
});

test('1d. lo que se puede mostrar: sin números, sin lo abstracto, sin verbos; con los sustantivos y los nombres', () => {
  const v = (t: string) => palabrasVisibles(t).map((x) => x.palabra.toLowerCase());
  assert.deepEqual(v('Y en tres semanas, la fila llegaba a la esquina.'), ['esquina']);
  assert.ok(v('Yo tenía una cafetería y casi la pierdo.').includes('cafetería'));
  assert.ok(v('Entonces probé algo distinto con Instagram.').includes('instagram'), 'un nombre propio se puede mostrar');
  assert.deepEqual(v('Es importante, la verdad, el 80% y gratis.'), [], 'abstracto, número y venta no se fotografían');
  assert.deepEqual(v('estaban tomando y llegaban'), [], 'verbos');
});

// ── 2. Lo que elige la IA (casos de ejemplo de respuestas de un modelo) ─────

test('2. una respuesta buena pasa entera, ordenada por hueco', () => {
  const { huecos, objetivo } = huecosParaBroll({ frases: GUION, duracion: 25 });
  const ultimo = huecos[huecos.length - 1].i;
  const r = eleccionDeIA(huecos, {
    broll: [
      { hueco: ultimo, busqueda: 'small business owner smiling', motivo: 'Habla de un negocio local.' },
      { hueco: 0, busqueda: 'cozy coffee shop', motivo: 'Habla de su cafetería.' },
    ],
  }, objetivo);
  assert.deepEqual(r.descartes, []);
  assert.deepEqual(r.elegidos.map((e) => e.hueco), [0, ultimo]);
  assert.equal(r.elegidos[0].busqueda, 'cozy coffee shop');
});

test('2b. lo que un modelo inventa o repite se descarta con su motivo', () => {
  const { huecos } = huecosParaBroll({ frases: GUION, duracion: 25 });
  const r = eleccionDeIA(huecos, {
    broll: [
      { hueco: 99, busqueda: 'coffee', motivo: '' }, // un hueco que no existe
      { hueco: 0, busqueda: 'https://evil.tld/foto.jpg' }, // una dirección
      { hueco: 0, busqueda: '' }, // vacía
      { hueco: '1', busqueda: '"empty tables"' }, // número como texto y comillas: sirve
      { hueco: 1, busqueda: 'coffee' }, // el mismo hueco otra vez
      { hueco: 2, busqueda: 'EMPTY TABLES' }, // la misma búsqueda
      { hueco: 1.5, busqueda: 'x y' }, // no es un número entero
    ],
  }, 5);
  assert.deepEqual(r.elegidos.map((e) => [e.hueco, e.busqueda]), [[1, 'empty tables']]);
  assert.equal(r.descartes.length, 6, r.descartes.join(' · '));
});

test('2c. no pasa del objetivo, y sin "broll" no hay nada (que use el respaldo)', () => {
  const { huecos } = huecosParaBroll({ frases: GUION, duracion: 25, ritmo: 'mucho' });
  const todos = huecos.map((h) => ({ hueco: h.i, busqueda: `foto ${h.i}` }));
  assert.equal(eleccionDeIA(huecos, { broll: todos }, 1).elegidos.length, 1);
  for (const crudo of [null, {}, { broll: 'no' }, { otra: [] }, []]) {
    assert.deepEqual(eleccionDeIA(huecos, crudo, 3).elegidos, []);
  }
});

test('2d. el respaldo sin IA: los de más peso, en orden, buscando su palabra más fuerte', () => {
  const { huecos, objetivo } = huecosParaBroll({ frases: GUION, duracion: 25 });
  const r = eleccionDeRespaldo(huecos, objetivo);
  assert.equal(r.length, objetivo);
  assert.deepEqual(r.map((e) => e.hueco), [...r.map((e) => e.hueco)].sort((a, b) => a - b));
  for (const e of r) {
    assert.ok(!/\s/.test(e.busqueda), `una palabra sola, no «${e.busqueda}»`);
    assert.equal(e.busqueda, huecos.find((h) => h.i === e.hueco)!.palabras[0]);
  }
});

test('2e. lo que llega del navegador a la ruta: se recorta y se tira lo que no sirve', () => {
  const h = huecosDelPedido([
    { i: 0, frase: 'Una cafetería llena', palabras: ['cafetería', 7, 'llena', 'a', 'b'], inicio: 3, fin: 6 },
    { i: -1, frase: 'x', palabras: ['x'] },
    { i: 2, frase: '', palabras: ['x'] },
    { i: 3, frase: 'sin palabras', palabras: [] },
    'basura',
  ]);
  assert.equal(h.length, 1);
  assert.deepEqual(h[0].palabras, ['cafetería', 'llena', 'a']);
  assert.deepEqual(huecosDelPedido('no'), []);
  assert.equal(huecosDelPedido(Array.from({ length: 99 }, (_, i) => ({ i, frase: 'f', palabras: ['p'] }))).length, TOPES_BROLL.maxHuecos);
});

// ── 3. Los planos ────────────────────────────────────────────────────────────

test('3. los planos cortan en el borde de una frase, el primero va abierto y alternan', () => {
  const planos = planosDeLaLinea({ frases: GUION, duracion: 25 });
  assert.ok(planos.length >= 2, `${planos.length} planos`);
  for (const p of planos) {
    assert.ok(GUION.some((f) => f.inicio === p.inicio), `un plano arranca a mitad de una frase (${p.inicio})`);
    assert.ok(GUION.some((f) => Math.abs(f.fin - p.fin) < 1e-9), `un plano termina a mitad de una frase (${p.fin})`);
    assert.ok(p.inicio > 0, 'el primero va abierto (el gancho con la cara entera)');
  }
  for (let n = 1; n < planos.length; n++) assert.ok(planos[n].inicio > planos[n - 1].fin, 'dos cerrados seguidos sin un abierto en el medio');
});

test('3b. el cerrado fuerte va donde se dice algo con peso; lo ocupado se saltea entero', () => {
  const frases: Frase[] = [
    { texto: 'Hola, soy Ana.', inicio: 0, fin: 3 },
    { texto: 'Te cuento algo.', inicio: 3, fin: 6 },
    { texto: 'Esto cambia todo.', inicio: 6, fin: 9 },
    { texto: '¡Es gratis!', inicio: 9, fin: 12 },
  ];
  const planos = planosDeLaLinea({ frases, duracion: 12 });
  assert.deepEqual(planos.map((p) => [p.inicio, p.fin, p.zoom]), [[3, 6, 'suave'], [9, 12, 'fuerte']]);
  const conOcupado = planosDeLaLinea({ frases, duracion: 12, ocupados: [{ inicio: 10, fin: 11 }] });
  assert.deepEqual(conOcupado.map((p) => p.inicio), [3], 'el plano que pisa lo ocupado no se recorta: se saltea');
});

// ── 4. Pexels ────────────────────────────────────────────────────────────────

const FOTO = {
  id: 12345,
  width: 4000,
  height: 6000,
  url: 'https://www.pexels.com/photo/cafe-12345/',
  photographer: 'Ana Pérez',
  alt: 'Una cafetería',
  src: {
    medium: 'https://images.pexels.com/photos/12345/a.jpeg?h=350',
    large2x: 'https://images.pexels.com/photos/12345/a.jpeg?w=1880',
    portrait: 'https://images.pexels.com/photos/12345/a.jpeg?h=1200&w=800',
    landscape: 'https://images.pexels.com/photos/12345/a.jpeg?h=627&w=1200',
  },
};

test('4. una foto de Pexels: sólo de images.pexels.com, en la orientación del video', () => {
  assert.equal(fotoDePexels(FOTO)?.autor, 'Ana Pérez');
  assert.match(urlDeFotoPexels(FOTO, 'vertical')!, /h=1200&w=800/);
  assert.match(urlDeFotoPexels(FOTO, 'horizontal')!, /h=627/);
  assert.match(urlDeFotoPexels(FOTO, 'cuadrada')!, /w=1880/);
  for (const mala of [
    'https://images.pexels.com.evil.tld/a.jpg',
    'https://images.pexels.com@evil.tld/a.jpg',
    'https://images.pexels.comevil.tld/a.jpg',
    'https://images.pexels.com:8443/a.jpg',
    'http://images.pexels.com/a.jpg',
  ]) {
    const otra = { ...FOTO, src: { portrait: mala, large2x: mala, large: mala, medium: mala } };
    assert.equal(urlDeFotoPexels(otra, 'vertical'), null, mala);
    assert.equal(fotoDePexels(otra), null, mala);
  }
  assert.equal(fotoDePexels({ ...FOTO, id: 'x' }), null);
  assert.equal(orientacionDeLienzo(1080, 1920), 'vertical');
  assert.equal(orientacionDeLienzo(1920, 1080), 'horizontal');
  assert.equal(orientacionDeLienzo(1080, 1080), 'cuadrada');
  assert.equal(orientacionPexels('vertical'), 'portrait');
  assert.match(errorDePexels(401), /clave/);
  assert.match(errorDePexels(429), /límite/);
});

test('4b. dos huecos no llevan la misma foto', () => {
  const f = (id: number) => ({ id, ancho: 1, alto: 1, autor: '', pagina: '', mini: '', alt: '' });
  const pares = fotosElegidas(
    [{ hueco: 0, busqueda: 'coffee', motivo: '' }, { hueco: 1, busqueda: 'Coffee', motivo: '' }, { hueco: 2, busqueda: 'sin fotos', motivo: '' }],
    [{ consulta: 'coffee', fotos: [f(1), f(2)] }],
  );
  assert.deepEqual(pares.map((p) => [p.elegido.hueco, p.foto.id]), [[0, 1], [1, 2]]);
});

// ── 5. Las pistas ────────────────────────────────────────────────────────────

const TPS = 1000;
type Pista = { id: string; name: string; type: string; elements: Array<Record<string, unknown>>; hidden?: boolean; muted?: boolean };
const el = (id: string, inicio: number, fin: number, params: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  id, name: id, startTime: inicio * TPS, duration: (fin - inicio) * TPS, trimStart: 0, trimEnd: 0, params, ...extra,
});
const escena = (overlay: Pista[]) => ({ main: { id: 'main', name: 'Main', type: 'video', elements: [], muted: false, hidden: false }, overlay, audio: [] }) as never;

test('5. lo que se lee de la línea de tiempo: frases de los subtítulos, ocupado sin las propuestas', () => {
  const tracks = escena([
    { id: 'sub', name: 'Subtítulos', type: 'text', elements: [el('s1', 1, 2, { subtitulo: true, content: 'Hola  mundo' }), el('t1', 0, 9, { content: 'título' })] },
    { id: 'suya', name: 'Video', type: 'video', elements: [el('f1', 3, 5)] },
    { id: 'br', name: NOMBRE_PISTA_BROLL, type: 'video', elements: [el('p1', 6, 8, { [PARAM_PROPUESTA]: 'broll' })] },
    { id: 'pl', name: NOMBRE_PISTA_PLANOS, type: 'effect', elements: [el('z1', 1, 4, { [PARAM_PROPUESTA]: 'plano' }), el('z2', 5, 6)] },
  ]);
  assert.deepEqual(frasesDeSubtitulos(tracks, TPS), [{ texto: 'Hola mundo', inicio: 1, fin: 2 }]);
  assert.deepEqual(tramosOcupados(tracks, TPS, 'broll'), [{ inicio: 3, fin: 5 }], 'la propuesta pendiente no ocupa');
  assert.deepEqual(tramosOcupados(tracks, TPS, 'plano'), [{ inicio: 5, fin: 6 }]);
  assert.deepEqual(pendientesDe(tracks).map((p) => [p.element.id, p.tipo]), [['z1', 'plano'], ['p1', 'broll']]);
});

test('5b. dejar y sacar tocan sólo propuestas; la pista de MaKo vacía se va, la de la persona no', () => {
  const tracks = escena([
    { id: 'suya', name: 'Video', type: 'video', elements: [el('f1', 3, 5), el('fx', 9, 10, { [PARAM_PROPUESTA]: 'broll' })] },
    { id: 'br', name: NOMBRE_PISTA_BROLL, type: 'video', elements: [el('p1', 6, 8, { [PARAM_PROPUESTA]: 'broll' })] },
  ]);
  const sinTodo = sacarPropuestas(tracks) as unknown as { overlay: Pista[] };
  assert.deepEqual(sinTodo.overlay.map((t) => [t.id, t.elements.map((e) => e.id)]), [['suya', ['f1']]], 'se fue la pista vacía de MaKo y quedó la suya');
  const sinUna = sacarPropuestas(tracks, new Set(['p1', 'f1'])) as unknown as { overlay: Pista[] };
  assert.deepEqual(sinUna.overlay.map((t) => t.elements.map((e) => e.id)), [['f1', 'fx']], 'lo suyo (f1) no se saca aunque lo nombren');
  const dejadas = dejarPropuestas(tracks, new Set(['p1'])) as unknown as { overlay: Pista[] };
  assert.equal((dejadas.overlay[1].elements[0].params as Record<string, unknown>)[PARAM_PROPUESTA], '');
  assert.equal(pendientesDe(dejadas as never).length, 1);
  const vacia = escena([]);
  assert.equal(dejarPropuestas(vacia), vacia, 'sin nada que dejar, la misma escena');
  const igual = escena([{ id: 'suya', name: 'Video', type: 'video', elements: [el('f1', 3, 5)] }]);
  assert.equal(sacarPropuestas(igual), igual, 'sin propuestas, la escena es la misma (sin paso de deshacer)');
  assert.equal(sinPendientes(tracks, 'plano'), tracks);
});

test('5c. la propuesta va ABAJO de lo de la persona, y los planos últimos (pegados a la principal)', () => {
  let n = 0;
  const nuevoId = () => `n${++n}`;
  const tracks = escena([{ id: 'suya', name: 'Textos', type: 'text', elements: [el('t', 0, 9)] }]);
  const foto = el('img', 3, 6, { [PARAM_PROPUESTA]: 'broll' }, { type: 'image', mediaId: 'm' });
  const capa = el('cap', 6, 9, { [PARAM_PROPUESTA]: 'plano' }, { type: 'effect', effectType: 'efecto.acercar' });
  const con = conPropuestas({ tracks, imagenes: [foto as never], capas: [capa as never], nuevoId }) as unknown as { overlay: Pista[] };
  assert.deepEqual(con.overlay.map((t) => t.name), ['Textos', NOMBRE_PISTA_BROLL, NOMBRE_PISTA_PLANOS]);
  // Otra vez: va a las mismas pistas si entra, y lo de la persona no se mueve.
  const foto2 = el('img2', 10, 12, { [PARAM_PROPUESTA]: 'broll' }, { type: 'image', mediaId: 'm' });
  const otra = conPropuestas({ tracks: con as never, imagenes: [foto2 as never], capas: [], nuevoId }) as unknown as { overlay: Pista[] };
  assert.equal(otra.overlay.length, 3);
  assert.deepEqual(otra.overlay[1].elements.map((e) => e.id), ['img', 'img2']);
  // Si no entra (se pisa), una pista nueva, todavía arriba de los planos.
  const pisa = el('img3', 4, 5, { [PARAM_PROPUESTA]: 'broll' }, { type: 'image', mediaId: 'm' });
  const tercera = conPropuestas({ tracks: con as never, imagenes: [pisa as never], capas: [], nuevoId }) as unknown as { overlay: Pista[] };
  assert.deepEqual(tercera.overlay.map((t) => t.name), ['Textos', NOMBRE_PISTA_BROLL, NOMBRE_PISTA_BROLL, NOMBRE_PISTA_PLANOS]);
  assert.equal(conPropuestas({ tracks, imagenes: [], capas: [], nuevoId }), tracks);
});

// ── 6. El cableado ───────────────────────────────────────────────────────────

test('6. el registro está importado, y la línea de tiempo dibuja la marca de propuesta', () => {
  assert.match(leer('app/video-editor/ce/extensiones.ts'), /^import '\.\.\/_opencut\/broll\/registro';$/m);
  const linea = sinComentarios(leer('app/video-editor/_opencut/timeline/components/timeline-element.tsx'));
  assert.match(linea, /\{propuestaDe\(element\) && \(/, 'la línea de tiempo no marca las propuestas');
  assert.match(linea, /border-dashed/);
  assert.match(sinComentarios(leer('app/video-editor/_opencut/effects/definitions/efectos.ts')), /id: "acercar",/, 'falta el efecto «Acercar» que usan los planos');
  assert.match(sinComentarios(leer('app/video-editor/_opencut/broll/proponer.ts')), /effectType: "efecto\.acercar"/);
});

test('6b. la ruta: la IA adentro de «sólo su IA», una foto por su ID (nunca una URL), y la clave del negocio', () => {
  const ruta = sinComentarios(leer('app/api/video-editor/broll/route.ts'));
  assert.match(ruta, /conSuIADelNegocio\(p\.ws, \(\) => elegirBroll\(huecos, objetivo\)\)/);
  assert.match(ruta, /\/\^\\d\{1,12\}\$\/\.test\(id\)/, 'la foto se pide por id numérico');
  assert.doesNotMatch(ruta, /searchParams\.get\('url'\)/);
  assert.match(ruta, /busquedaValida/);
  const pexels = sinComentarios(leer('lib/pexels.ts'));
  assert.match(pexels, /credDelClienteEstricta\(CLAVE_PEXELS, ws/, 'la clave es la del negocio, leída estricta');
  assert.match(pexels, /fetchSeguro\(url/, 'la foto se baja con la baranda');
  assert.match(pexels, /sniffImagen\(bytes\)/);
});

test('6c. el chat y la API: la operación «broll» valida su forma y sale como proponer_broll_video', () => {
  assert.deepEqual(validarOperacion({ op: 'broll' }), { ok: true, op: { op: 'broll' } });
  assert.deepEqual(validarOperacion({ op: 'broll', ritmo: 'mucho', planos: false }), { ok: true, op: { op: 'broll', ritmo: 'mucho', planos: false } });
  assert.equal(validarOperacion({ op: 'broll', ritmo: 'muchísimo' }).ok, false);
  assert.equal(validarOperacion({ op: 'broll', planos: 'si' }).ok, false);
  assert.equal(validarOperacion({ op: 'broll', fotos: ['x'] }).ok, false, 'el chat no elige las fotos');
  const api = OPERACIONES_API.find((o) => o.op === 'broll');
  assert.equal(api?.id, 'proponer_broll_video');
  // Al final cuando se sumó (6/11): detrás de todas las que ya estaban. Los clips mágicos, sumados después, van detrás de ella.
  const orden = OPERACIONES_API.map((o) => o.op);
  assert.ok(orden.indexOf('broll') > orden.indexOf('usar_preset_subtitulos') && orden.indexOf('usar_preset_subtitulos') >= 0, 'una operación nueva va al final de las que ya estaban');
  const aplicar = sinComentarios(leer('app/video-editor/_opencut/chat/aplicar.ts'));
  assert.match(aplicar, /if \(r\.op === "broll"\) \{[\s\S]*?proponerBroll\(editor, \{ ritmo: r\.ritmo, planos: r\.planos(?:, [^}]*)? \}\)[\s\S]*?textoDeBroll\(hecho\)/, 'el chat corre el MISMO que la sección y dice por qué no salió');
  assert.match(sinComentarios(leer('lib/api-mako/areas/video.run.ts')), /proponer_broll_video: \{ \.\.\.enElEditor\('proponer_broll_video'\) \},/);
});

test('6d. los prompts editables: las keys y los slots son los que se renderizan', () => {
  const registro = leer('lib/prompt-registry.ts');
  assert.ok(registro.includes(`key: '${PROMPTS_BROLL.system.key}'`) && registro.includes(`key: '${PROMPTS_BROLL.user.key}'`));
  const slots = (t: string) => [...t.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
  assert.deepEqual(slots(BROLL_SYSTEM_TEMPLATE), ['formato', 'objetivo']);
  assert.deepEqual(slots(BROLL_USER_TEMPLATE), ['huecos', 'negocio']);
  const ia = sinComentarios(leer('lib/editor-video/broll-ia.ts'));
  assert.match(ia, /renderPrompt\(PROMPTS_BROLL\.system\.key, BROLL_SYSTEM_TEMPLATE, \{ objetivo: [^}]*formato: FORMATO_BROLL \}\)/);
  assert.match(ia, /renderPrompt\(PROMPTS_BROLL\.user\.key, BROLL_USER_TEMPLATE, \{\s*negocio:[\s\S]*?huecos: contenidoNoConfiable\(/);
  assert.match(ia, /feature: FEATURE_BROLL/);
  assert.match(leer('lib/model-catalogo.ts'), /feature: 'video-editor-broll'[^\n]*def: GEMINI\(\)/, 'la IA del B-roll es gratis por defecto');
});

// PROBADO ROMPIÉNDOLO (06/11/2026, base 20 / 0; una rotura por vez, restaurada de memoria; 19 de 19 en rojo):
//   sin el corte del gancho → 1 · sin mirar lo ocupado → 1b · sin el aire del ritmo → 1 · los verbos como palabra → 1d ·
//   un hueco que no existe pasa → 2b · el mismo hueco dos veces → 2b · una URL como búsqueda → 2b · sin el tope del
//   objetivo → 2c · el primer plano cerrado → 3 y 3b · un plano sobre lo ocupado → 3b · el origen de Pexels por prefijo →
//   4 · la misma foto en dos huecos → 4b · la pista vacía de MaKo se queda → 5b · sacar lo de la persona → 5b · la pista
//   del B-roll arriba de todo → 5c · las propuestas cuentan como ocupado → 5 · la IA sin «sólo su IA» → 6b · la línea de
//   tiempo sin la marca → 6 · el chat acepta que le pasen fotos → 6c.
