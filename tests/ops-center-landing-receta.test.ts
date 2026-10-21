// =============================================================================
// Ops Center 1.15 — la receta de landing: PARA QUÉ PRODUCTO es la landing que se le pide a MaKo
// =============================================================================
// Martín (20/10/2026): «comienza a implementar directamente toda mi idea de que Ops Center sea lo principal en MaKo...
// quiero que en Ops Center se pueda hacer todo, editar videos, crear webs, etc...». La pieza 1.15 de
// docs/ops-center-principal.md: con un solo producto en el catálogo, «créame una landing para mi otro producto» no es
// ése, y crear igual armaba la landing del que hay (el esquema sale del perfil del negocio). Dos capas:
//   · la receta (lib/doer-recetas.ts, RECETA_LANDING): MaKo pregunta antes de proponer, y viaja sólo con las
//     herramientas que crean una landing;
//   · el código (lib/mako-pedidos.ts, `productoDeLanding`, en el `preparar` de generar_landing_con_ia): aunque el
//     modelo proponga igual, no se prepara nada y el error es la pregunta.
//
// DOS REVISIONES ADVERSARIALES (20/10/2026, noche) tiraron las versiones anteriores:
//   · la primera contaba palabras «que no son relleno»: dos cualesquiera la saltaban, nombrar el único producto la
//     frenaba con un mensaje falso, con dos o más creaba sin preguntar, una vuelta de una palabra se frenaba, «otro de mis
//     productos» no se veía y sólo se miraba la idea;
//   · la segunda (60 frases reales): el parámetro `producto` con una referencia («mi otro producto», «el otro», «no sé»)
//     saltaba el guardia; «un producto nuevo» con uno solo le pegaba ése al pedido y al confirmar no se veía; un nombre
//     común del catálogo («un curso de fotografía», «una mentoría grupal») ganaba sobre «otro»; las negaciones («no
//     menciones otros productos») frenaban; y «Curso avanzado» con «Curso» en el catálogo preguntaba «cuál».
// Las frases de las dos revisiones son la BATERÍA de abajo (tuteo y voseo), cada una con lo que tiene que pasar.
//
// PROBADO ROMPIÉNDOLO (21/10/2026; arnés que rompe UNA cosa, corre este archivo, restaura y compara el sha256; base 6 / 0;
// las 30, en rojo y restauradas):
//   R1  `producto` vago se toma igual ........................ batería (e1–e7, s6, s7) + preparar (eco)
//   R2  sin «nuevo/segundo producto» · R3 sin «producto nuevo/aparte» · R4 «otro» sólo con producto/servicio/oferta
//   R5  sin negaciones · R6 sin «que» de comparación (n15) · R7 «otro» sin destino · R8 sin principio de renglón
//   R9  todo en un renglón (t9) · R10 «otro» suelto apaga los nombres (n2) · R11 «un curso…» es el Curso (n9, n11)
//   R12 sin el nombre largo (s1, s2) · R13 sin el plural (c2) · R14 «todos» es un producto (v1–v3)
//   R15 `producto` «el otro» con una idea sin «otro» (e8, e9) · R16 con uno solo, la mención suelta se pega (n10, t5)
//   R17–R19 sin demostrativos, «en/para», «opción/primera» en las vagas · R20 el producto no se ve al confirmar
//   R21 se repite adentro de la idea · R22 `producto` solo no lee el catálogo · R23 la referencia queda en el payload
//   R24 sólo se mira la idea · R25 el preparar no frena · R26 sin `producto` en el pedido · R27 sin la frase del editor
//   R28 la receta viaja con todo · R29 dos nombrados no preguntan (n16) · R30 con varios, «producto» suelto no pregunta
//
// Correr: node --import tsx --test tests/ops-center-landing-receta.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { esReferenciaVaga, pideOtroProducto, productoDeLanding, productoDelPedido, productosNombrados } from '../lib/mako-pedidos';
import { recetasDelTurno } from '../lib/doer-recetas';
import { pedidoGenerar, resumenGenerar } from '../lib/api-mako/areas/landing-contenido.helpers';

const RAIZ = join(import.meta.dirname, '..');
const url = (rel: string): string => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

function hijo(codigo: string): Record<string, unknown> {
  const out = execFileSync(process.execPath, [
    '--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', '--input-type=module', '-e', codigo,
  ], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const lineas = out.trim().split('\n');
  return JSON.parse(lineas[lineas.length - 1]!) as Record<string, unknown>;
}

const P = (...n: string[]) => n.map((nombre, i) => ({ id: String(i + 1), nombre }));
/** Lo que tiene que pasar: preguntar (con los nombres del catálogo, si se dicen) o seguir con ese producto (o con ninguno). */
type Espera = { pregunta: true; nombres?: string[] } | { sigue: string | null };
const PREGUNTA: Espera = { pregunta: true };

// La batería: [id de la revisión, pedido, `producto` que mandó el modelo, catálogo, lo que tiene que pasar].
const BATERIA: [string, string, string | null, ReturnType<typeof P>, Espera][] = [
  // 1ª revisión, 1: dos palabras cualesquiera no dicen cuál es.
  ['h1a', 'una landing de ventas para mi otro producto que agende llamadas', null, P('Mentoría 1 a 1'), PREGUNTA],
  ['h1b', 'Landing de ventas moderna para mi otro producto', null, P('Mentoría 1 a 1'), PREGUNTA],
  ['h1c', '¿Me creás una landing para mi otro producto, porfa?', null, P('Mentoría 1 a 1'), PREGUNTA],
  ['h1d', 'Quiero que me hagas una landing para mi otro producto, gracias', null, P('Mentoría 1 a 1'), PREGUNTA],
  ['t1', 'haceme una landing para mi otro producto', null, P('Mentoría 1 a 1'), PREGUNTA],
  ['t2', 'armame una web de mi otro producto', null, P('Mentoría 1 a 1'), PREGUNTA],
  // 1ª revisión, 2: nombrar el del catálogo (con artículo o con su mayúscula) es ése.
  ['h2a', 'Créame una landing para mi otro producto, la Mentoría 1 a 1', null, P('Mentoría 1 a 1'), { sigue: 'Mentoría 1 a 1' }],
  ['h2b', 'Armame una landing para mi otro producto, Kairos', null, P('Kairos'), { sigue: 'Kairos' }],
  ['h2c', 'landing para la MENTORIA 1 A 1', null, P('Mentoría 1 a 1'), { sigue: 'Mentoría 1 a 1' }],
  // 1ª revisión, 3: con dos o más, cuál, con sus nombres.
  ['h3a', 'créame una landing para mi otro producto', null, P('Mentoría', 'Curso'), { pregunta: true, nombres: ['Mentoría', 'Curso'] }],
  ['h3b', 'créame una landing para mi otro producto', null, P('Mentoría', 'Curso', 'Taller', 'Ebook', 'Bootcamp'), { pregunta: true, nombres: ['Mentoría', 'Curso', 'Taller', 'Ebook'] }],
  // 1ª revisión, 4: la vuelta llega marcada en `producto`, aunque sea una palabra.
  ['h4a', 'Landing para mi otro producto: Kairos', null, P('Mentoría'), PREGUNTA],
  ['h4b', 'Landing para mi otro producto', 'Kairos', P('Mentoría'), { sigue: 'Kairos' }],
  ['h4c', 'Landing para mi otro producto', 'un ebook', P('Mentoría'), { sigue: 'un ebook' }],
  // 1ª y 2ª revisión, 5: todas las formas de «otro».
  ['h5a', 'créame una landing para otro de mis productos', null, P('Mentoría'), PREGUNTA],
  ['h5b', 'créame una landing para otra de mis ofertas', null, P('Mentoría'), PREGUNTA],
  ['h5c', 'créame una landing para mi nuevo producto', null, P('Mentoría'), PREGUNTA],
  ['h5d', 'créame una landing para un producto nuevo, un curso de cerámica', null, P('Mentoría'), PREGUNTA],
  ['h5e', 'créame una landing para mi segundo producto', null, P('Mentoría'), PREGUNTA],
  ['h5f', 'créame una landing para otro producto más', null, P('Mentoría'), PREGUNTA],
  ['h5g', 'creame una landing para mi otro curso', null, P('Mentoría'), PREGUNTA],
  ['h5h', 'creame una landing para mi otra mentoría', null, P('Mentoría'), PREGUNTA],
  ['s3', 'Haceme una landing para mi producto nuevo que lanzo en noviembre', null, P('Mentoría 1 a 1'), PREGUNTA],
  ['s4', 'Necesito una landing para un nuevo producto: un taller de cerámica para principiantes', null, P('Mentoría 1 a 1'), PREGUNTA],
  ['t3', 'necesito una web para mi otro servicio', null, P('Mentoría 1 a 1'), PREGUNTA],
  ['t4', 'créame una landing para mi otro producto', null, [], PREGUNTA],
  // 2ª revisión, 1: `producto` con una referencia es como no decirlo.
  ['e1', 'créame una landing para mi otro producto', 'mi otro producto', P('Mentoría'), PREGUNTA],
  ['e2', 'créame una landing para mi otro producto', 'otro producto', P('Mentoría', 'Curso'), { pregunta: true, nombres: ['Mentoría', 'Curso'] }],
  ['e3', 'créame una landing para mi otro producto', 'otro', P('Mentoría'), PREGUNTA],
  ['e4', 'créame una landing para mi otro producto', 'N/A', P('Mentoría'), PREGUNTA],
  ['e5', 'créame una landing para mi otro producto', 'nuevo', P('Mentoría'), PREGUNTA],
  ['e6', 'créame una landing para mi otro producto', 'el otro', P('Mentoría'), PREGUNTA],
  ['s6', 'créame una landing para mi otro producto', 'no sé', P('Mentoría 1 a 1'), PREGUNTA],
  ['s7', 'créame una landing para mi otro producto', 'otro de mis productos', P('Mentoría 1 a 1'), PREGUNTA],
  ['e7', 'créame una landing para mi otro producto', 'mi otro curso', P('Mentoría'), PREGUNTA],
  // La idea que escribió el modelo no dice «otro», pero el `producto` sí: es lo que dijo la persona.
  ['e8', 'landing de ventas que agende llamadas', 'mi otro producto', P('Mentoría'), PREGUNTA],
  ['e9', 'landing de ventas', 'el segundo', P('Mentoría', 'Curso'), { pregunta: true, nombres: ['Mentoría', 'Curso'] }],
  ['e10', 'landing de ventas', 'no sé', P('Mentoría'), { sigue: null }],
  // `producto` del catálogo, con mayúsculas, tildes o artículo.
  ['c1', 'landing', 'MENTORIA', P('Mentoría'), { sigue: 'Mentoría' }],
  ['c2', 'landing', 'mentorías', P('Mentoría'), { sigue: 'Mentoría' }],
  ['c3', 'landing', 'la mentoría', P('Mentoría'), { sigue: 'Mentoría' }],
  ['c4', 'landing', 'Mentoría 1 a 1', P('Mentoría', 'Mentoría 1 a 1'), { sigue: 'Mentoría 1 a 1' }],
  ['c5', 'landing', 'Mentoría', P('Mentoría', 'Mentoría 1 a 1'), { sigue: 'Mentoría' }],
  ['c6', 'landing', 'Diseño Web', P('Diseño web'), { sigue: 'Diseño web' }],
  // 2ª revisión, 2: un producto suelto con UNO solo no se pega al pedido (como antes de esta pieza).
  ['n10', 'landing para mi producto estrella', null, P('Mentoría'), { sigue: null }],
  ['t5', 'hazme una landing de mi producto', null, P('Mentoría 1 a 1'), { sigue: null }],
  // 2ª revisión, 3: un nombre común del catálogo no gana sobre «otro».
  ['n9', 'Créame una landing para mi otro producto, un curso de fotografía', null, P('Curso'), PREGUNTA],
  ['n11', 'landing para mi otro producto, una mentoría grupal', null, P('Mentoría'), PREGUNTA],
  ['n8', 'Créame una landing para mi otro producto, un curso de fotografía', null, P('Mentoría', 'Curso'), { pregunta: true, nombres: ['Mentoría', 'Curso'] }],
  // 2ª revisión, 4: las negaciones y las comparaciones no piden otro producto.
  ['n1', 'landing de ventas\nno menciones otros productos', null, P('Mentoría'), { sigue: null }],
  ['n2', 'landing de ventas para mi mentoría\nque no se compare con otros productos', null, P('Mentoría'), { sigue: 'Mentoría' }],
  ['n3', 'una landing que muestre por qué conviene más que otros productos del mercado', null, P('Mentoría'), { sigue: null }],
  ['n4', 'landing de ventas\nclientes que ya compraron otros productos', null, P('Mentoría'), { sigue: null }],
  ['s5', 'landing de ventas\nsin hablar de mis otros servicios', null, P('Mentoría 1 a 1'), { sigue: null }],
  ['n15', 'landing para vender más que otros productos de la competencia', null, P('Mentoría'), { sigue: null }],
  // Renglón por renglón: un título «Mi otro producto» es el destino aunque la idea de arriba no lo diga.
  ['t9', 'landing que agende llamadas\nMi otro producto', null, P('Mentoría'), PREGUNTA],
  // 2ª revisión, 5: un nombre adentro de otro del catálogo: el largo.
  ['s1', 'créame una landing para el Curso avanzado', null, P('Curso', 'Curso avanzado'), { sigue: 'Curso avanzado' }],
  ['s2', 'landing para mi Mentoría VIP', null, P('Mentoría', 'Mentoría VIP'), { sigue: 'Mentoría VIP' }],
  // Varios productos en el catálogo.
  ['n5', 'landing que muestre el producto con fotos', null, P('Mentoría', 'Curso'), { pregunta: true, nombres: ['Mentoría', 'Curso'] }],
  ['n6', 'landing para lanzar un producto nuevo de skincare', null, P('Mentoría', 'Curso'), { pregunta: true, nombres: ['Mentoría', 'Curso'] }],
  ['n7', 'landing para mi curso online de cerámica', null, P('Curso', 'Mentoría'), { sigue: 'Curso' }],
  ['n12', 'landing para mis productos', null, P('Mentoría', 'Curso'), { pregunta: true, nombres: ['Mentoría', 'Curso'] }],
  ['n13', 'landing para todos mis productos', null, P('Mentoría', 'Curso'), { sigue: null }],
  // La vuelta de «¿para cuál?» cuando es para todos: no es un producto que se llame «todos».
  ['v1', 'landing para mis productos', 'todos', P('Mentoría', 'Curso'), { sigue: null }],
  ['v2', 'landing para mis productos', 'para todos mis productos', P('Mentoría', 'Curso'), { sigue: null }],
  ['v3', 'landing para mis productos', 'el negocio en general', P('Mentoría', 'Curso'), { sigue: null }],
  ['v4', 'landing para mis productos', 'Marca personal', P('Mentoría', 'Curso'), { sigue: 'Marca personal' }],
  ['v5', 'créame una landing para mi otro producto', 'ninguno de esos', P('Mentoría'), PREGUNTA],
  ['n14', 'landing para mi producto, la mentoría y el curso', null, P('Mentoría', 'Curso'), { pregunta: true, nombres: ['Mentoría', 'Curso'] }],
  // Dos nombrados sin decir «producto»: cuál de ESOS dos, no de todo el catálogo.
  ['n16', 'landing para la mentoría y el curso', null, P('Mentoría', 'Curso', 'Taller'), { pregunta: true, nombres: ['Mentoría', 'Curso'] }],
  ['t6', 'créame una landing para mi otro producto', 'Yoga para embarazadas', P('Mentoría', 'Curso'), { sigue: 'Yoga para embarazadas' }],
  // Lo que no habla de un producto sigue como siempre.
  ['t7', 'una landing para mi taller de cerámica que agende llamadas', null, P('Mentoría 1 a 1'), { sigue: null }],
  ['t8', 'créame otra landing', null, P('Mentoría 1 a 1'), { sigue: null }],
];

test('la batería de las dos revisiones: cada frase pregunta o sigue con el producto que corresponde', () => {
  const mal: string[] = [];
  for (const [id, texto, producto, catalogo, espera] of BATERIA) {
    const d = productoDeLanding(texto, producto, catalogo);
    if ('pregunta' in espera) {
      if (d.que !== 'preguntar') { mal.push(`${id}: siguió con ${JSON.stringify(d.producto)} y tenía que preguntar («${texto}»)`); continue; }
      for (const n of espera.nombres ?? []) if (!d.mensaje.includes(`«${n}»`)) mal.push(`${id}: la pregunta no nombra «${n}»`);
      if (!/pásalo en «producto»/.test(d.mensaje)) mal.push(`${id}: la pregunta no dice por dónde vuelve la respuesta`);
    } else if (d.que !== 'sigue' || d.producto !== espera.sigue) {
      mal.push(`${id}: ${d.que === 'sigue' ? `siguió con ${JSON.stringify(d.producto)}` : 'preguntó'} y tenía que seguir con ${JSON.stringify(espera.sigue)} («${texto}»)`);
    }
  }
  assert.deepEqual(mal, []);
  // Con uno solo, la pregunta dice cuál hay y que no se arme sobre ése; sin catálogo, no nombra uno que no existe.
  const uno = productoDeLanding('créame una landing para mi otro producto', null, P('Mentoría 1 a 1'));
  assert.match(uno.que === 'preguntar' ? uno.mensaje : '', /un solo producto \(«Mentoría 1 a 1»\) y el pedido es para OTRO[\s\S]*no la armes sobre «Mentoría 1 a 1»/);
  const ninguno = productoDeLanding('créame una landing para mi otro producto', null, []);
  assert.match(ninguno.que === 'preguntar' ? ninguno.mensaje : '', /todavía no tiene productos/);
});

test('«otro» cuenta como DESTINO de la landing, no negado ni en una comparación', () => {
  for (const t of ['para mi otro producto', 'Mi otro producto', 'de mis otros productos', 'para un producto nuevo', 'para lanzar un producto nuevo de skincare', 'otro de mis productos']) {
    assert.equal(pideOtroProducto(t), true, t);
  }
  for (const t of ['no menciones otros productos', 'sin hablar de mis otros servicios', 'conviene más que otros productos', 'clientes que ya compraron otros productos', 'que no se compare con otros productos', 'para vender más que otros productos']) {
    assert.equal(pideOtroProducto(t), false, t);
  }
  // Renglón por renglón: el «otro» de las instrucciones no se mezcla con la idea.
  assert.equal(pideOtroProducto('landing de ventas\nes para mi otro producto'), true);
});

test('una referencia no es un producto; un nombre o una descripción sí', () => {
  for (const r of ['mi otro producto', 'otro', 'el otro', 'N/A', 'no sé', 'nuevo', 'otro de mis productos', 'mi otro curso', 'el segundo', 'el 2', 'la opción 2', 'la primera', '  ']) assert.equal(esReferenciaVaga(r), true, r);
  for (const r of ['Kairos', 'un ebook', 'curso de fotografía', 'Yoga para embarazadas', 'Mentoría grupal']) assert.equal(esReferenciaVaga(r), false, r);
  // El nombre largo gana; y con «otro», «un curso…» no es el «Curso» del catálogo (también en el chat del editor).
  assert.deepEqual(productosNombrados('el Curso avanzado', P('Curso', 'Curso avanzado')).map((p) => p.nombre), ['Curso avanzado']);
  assert.deepEqual(productosNombrados('mi otro producto, un curso de fotografía', P('Curso')), []);
  assert.equal(productoDelPedido('créame una landing para mi otro producto, un curso de fotografía', P('Curso')), null);
  assert.equal(productoDelPedido('créame una landing para otro de mis productos', P('Mentoría')), null);
});

test('el producto llega al pedido con la frase del chat del editor, y se VE adelante en el resumen que se confirma', () => {
  const tema = (id: string) => ({ id });
  const idea = 'Necesito una landing de ventas para un nuevo producto: un taller de cerámica para principiantes que agende llamadas';
  const g = pedidoGenerar({ idea, producto: 'Taller de cerámica' }, tema);
  assert.ok(!('error' in g), JSON.stringify(g));
  if ('error' in g) return;
  assert.equal(g.idea, `${idea}. Es para el producto «Taller de cerámica».`);
  assert.equal(g.producto, 'Taller de cerámica');
  const r = resumenGenerar(g, null);
  assert.match(r, /^Crear con IA una landing para el producto «Taller de cerámica» desde la idea «Necesito/, 'el producto va adelante, no al final de la idea cortada');
  assert.doesNotMatch(r, /Es para el producto/, 'y no se repite adentro de la idea');
  const conTexto = pedidoGenerar({ texto: 'El texto de la página', producto: 'Kairos', instrucciones: 'corto' }, tema);
  assert.equal('params' in conTexto ? conTexto.params.instrucciones : null, 'Es para el producto «Kairos». corto');
  const sin = pedidoGenerar({ idea: 'Una landing' }, tema);
  assert.ok(!('error' in sin) && sin.producto === null && !resumenGenerar(sin, null).includes('para el producto'));
});

test('generar_landing_con_ia no prepara nada sin saber para cuál producto, y lo que sigue se ve en el resumen (se ejecuta)', () => {
  const r = hijo(`
import { mock } from 'node:test';
const real = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));
const log = { lecturas: 0 };
let catalogo = [{ id: 1, nombre: 'Mentoría 1 a 1' }];
mock.module(${url('lib/productos.ts')}, { exports: { ...real(await import(${url('lib/productos.ts')})), listProductos: async () => { log.lecturas++; return catalogo; } } });
mock.module(${url('lib/editor-landing/server.ts')}, { exports: { ...real(await import(${url('lib/editor-landing/server.ts')})), temas: async () => ({ ok: true, temas: [] }) } });
const { RUNNERS_EDITOR } = await import(${url('lib/api-mako/areas/landing-editor.run.ts')});
const ctx = { ws: 3, canal: 'app', canalKey: 'app:prueba', alcance: 'proponer', rol: 'admin' };
const preparar = (input) => RUNNERS_EDITOR.generar_landing_con_ia.preparar(input, ctx);
const otro = await preparar({ idea: 'una landing de ventas para mi otro producto que agende llamadas' });
const eco = await preparar({ idea: 'créame una landing para mi otro producto', producto: 'mi otro producto' });
const nuevo = await preparar({ idea: 'Necesito una landing para un nuevo producto: un taller de cerámica para principiantes' });
const kairos = await preparar({ idea: 'créame una landing para mi otro producto', producto: 'Kairos' });
const enInstrucciones = await preparar({ idea: 'landing de ventas', instrucciones: 'es para mi otro producto' });
const soloProducto = await preparar({ idea: 'landing de ventas que agende llamadas', producto: 'mi otro producto' });
const vacio = await preparar({ idea: 'landing de ventas que agende llamadas', producto: 'N/A' });
const negada = await preparar({ idea: 'landing de ventas', instrucciones: 'no menciones otros productos' });
const nombrado = await preparar({ idea: 'Créame una landing para mi otro producto, la Mentoría 1 a 1' });
const antes = log.lecturas;
const comun = await preparar({ idea: 'una landing para mi taller de cerámica que agende llamadas' });
const sinLeer = log.lecturas === antes;
catalogo = [{ id: 1, nombre: 'Mentoría 1 a 1' }, { id: 2, nombre: 'Curso de cerámica' }];
const conDos = await preparar({ idea: 'créame una landing para mi otro producto' });
const todos = await preparar({ idea: 'landing para mis productos', producto: 'todos' });
console.log(JSON.stringify({ otro, eco, nuevo, kairos, enInstrucciones, soloProducto, vacio, negada, nombrado, comun, sinLeer, conDos, todos }));
`) as Record<string, { error?: string; faltan?: string[]; payload?: Record<string, unknown>; resumen?: string }> & { sinLeer: boolean };
  for (const k of ['otro', 'eco', 'nuevo', 'enInstrucciones', 'soloProducto'] as const) {
    assert.match(r[k].error ?? '', /un solo producto \(«Mentoría 1 a 1»\)/, `${k}: ${JSON.stringify(r[k]).slice(0, 200)}`);
    assert.deepEqual(r[k].faltan, ['producto'], k);
    assert.equal(r[k].payload, undefined, `${k}: preparó la landing igual`);
  }
  assert.equal(r.kairos.payload?.producto, 'Kairos', JSON.stringify(r.kairos).slice(0, 200));
  assert.match(r.kairos.resumen ?? '', /^Crear con IA una landing para el producto «Kairos»/, 'lo que se confirma dice el producto');
  assert.ok(r.negada.payload && !r.negada.error, `una negación frenaba: ${JSON.stringify(r.negada).slice(0, 200)}`);
  assert.equal(r.negada.payload?.producto, undefined, 'y no se le pega el producto que hay');
  assert.equal(r.nombrado.payload?.producto, 'Mentoría 1 a 1');
  assert.ok(r.comun.payload && !r.comun.error, JSON.stringify(r.comun).slice(0, 200));
  assert.equal(r.sinLeer, true, 'leyó el catálogo en un pedido que no habla de un producto');
  assert.match(r.conDos.error ?? '', /«Mentoría 1 a 1», «Curso de cerámica»/);
  // Lo que sigue reemplaza al `producto` del modelo: una referencia no va pegada al pedido como si fuera el nombre.
  for (const k of ['vacio', 'todos'] as const) {
    assert.ok(r[k].payload && !r[k].error, `${k}: ${JSON.stringify(r[k]).slice(0, 200)}`);
    assert.equal(r[k].payload?.producto, undefined, `${k}: quedó el producto ${JSON.stringify(r[k].payload?.producto)}`);
    assert.doesNotMatch(JSON.stringify(r[k].payload), /Es para el producto/, `${k}: la referencia quedó pegada a la idea`);
  }
});

test('la receta de landing viaja con las herramientas que crean una landing, y con ninguna otra', () => {
  for (const h of ['generar_landing_con_ia', 'crear_landing_desde_diseno', 'crear_landing_en_blanco', 'crear_presentacion_desde_plantilla', 'replicar_landing']) {
    assert.match(recetasDelTurno(new Set([h]), false), /CUANDO TE PIDEN UNA LANDING O UNA PRESENTACIÓN/, h);
  }
  for (const h of ['listar_landings_creadas', 'publicar_landing', 'cambiar_texto_landing', 'buscar_leads', 'ver_plan']) {
    assert.doesNotMatch(recetasDelTurno(new Set([h]), false), /CUANDO TE PIDEN UNA LANDING/, h);
  }
  const r = recetasDelTurno(new Set(['generar_landing_con_ia']), false);
  assert.match(r, /«mi otro producto» y el catálogo tiene uno solo, ese otro NO está en MaKo: pregunta en texto libre cuál es/);
  assert.ok(r.length < 900, `la receta de landing pesa ${r.length}`);
  assert.doesNotMatch(r, /\b[a-z]+_[a-z_]+\b/, 'no nombra herramientas: no siempre viajan las que nombraría');
  const run = sinComentarios(readFileSync(join(RAIZ, 'lib/api-mako/areas/landing-editor.run.ts'), 'utf8').replace(/\r\n/g, '\n'));
  assert.match(run, /const pedido = \['idea', 'instrucciones', 'titulo', 'audiencia'\]\.map\(\(k\) => str\(input, k\)\)/);
});
