// =============================================================================
// Ops Center 1.15 — PARA QUÉ PRODUCTO es la landing que se le pide a MaKo
// =============================================================================
// Martín (20/10/2026): «comienza a implementar directamente toda mi idea de que Ops Center sea lo principal en MaKo...
// quiero que en Ops Center se pueda hacer todo, editar videos, crear webs, etc...». La pieza 1.15 de
// docs/ops-center-principal.md: con un solo producto en el catálogo, «créame una landing para mi otro producto» no es
// ése, y crear igual armaba la landing del que hay (el esquema sale del perfil del negocio). Dos capas:
//   · la receta (lib/doer-recetas.ts, RECETA_LANDING): MaKo pregunta antes de proponer, y viaja sólo con las
//     herramientas que crean una landing;
//   · el código (lib/editor-landing/producto-de-landing.ts, `productoDeLanding`, en el `preparar` de
//     generar_landing_con_ia): aunque el modelo proponga igual, no se prepara nada y el error es la pregunta.
//
// TRES REVISIONES ADVERSARIALES (20 y 21/10/2026) tiraron tres rondas de reglas que adivinaban el producto. La tercera
// probó unas 200 frases y el Cerebro decidió dejar de adivinar (la regla de AGENTS.md: «la red es que la persona
// CONFIRME lo que se entendió»): se elige sin preguntar SÓLO si `producto` es un nombre del catálogo, si el catálogo está
// vacío, o si el pedido nombra exactamente UNO sin ninguna palabra de otro, nuevo, excluir o comparar. En todo lo demás
// se PREGUNTA con opciones (los productos, «Un producto nuevo» y «El negocio en general»). Las frases de las tres
// revisiones son la BATERÍA de abajo; la de PREGUNTA es la más larga a propósito.
// El chat del editor (productoDelPedido) quedó como en producción: su test fija lo que devolvía main.
//
// PROBADO ROMPIÉNDOLO (21/10/2026; arnés que rompe UNA cosa, corre este archivo, restaura y compara el sha256; base 8 / 0;
// las 42, en rojo y restauradas):
//   R1  `producto` del catálogo no se reconoce · R2 sin sacar el artículo · R3 sin «El negocio en general»
//   R4  `producto_nuevo` no se acepta · R5 se acepta vago · R6 un nuevo que es del catálogo · R7 catálogo vacío pregunta
//   R8  «Un producto nuevo» sin nombre no lo pide · R9/R10 lo que mandó el modelo y no vale cae al texto
//   R11 el texto nunca elige · R12 elige sin mirar las dudas · R13–R16 sin «otr», «además/parecid», «no», «ya tengo»
//   R17 prefijos sin borde de palabra («nosotros») · R18 sin el nombre largo · R19 el corto suelto no cuenta
//   R20 nombres de menos de 3 letras · R21 sin las dos opciones · R22 sin el aviso de catálogo largo
//   R23 rellenos («a definir») como nombre · R24 números como nombre · R25 el guardia sólo con «otro»
//   R26 el preparar no frena · R27 queda lo del modelo · R28 sin catálogo legible queda lo del modelo
//   R29 sin `producto_nuevo` en el payload · R30 sólo se mira la idea · R31 el producto no se ve al confirmar
//   R32 el negocio no se ve · R33 se repite en la idea · R34 sin la frase del negocio · R35 el nuevo como del catálogo
//   R36 el nuevo no llega al pedido · R37 sin la frase del editor · R38 sin el producto en las instrucciones
//   R39 la receta viaja con todo · R40 la receta adivina · R41 la definición sin `producto_nuevo`
//   R42 el chat del editor (main) pega el único producto con «otro producto»
//
// Correr: node --import tsx --test tests/ops-center-landing-receta.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { OPCION_NEGOCIO, OPCION_NUEVO, esDescripcionVaga, nombradosEn, productoDeLanding } from '../lib/editor-landing/producto-de-landing';
import { productoDelPedido } from '../lib/mako-pedidos';
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
const M = ['Mentoría'], M11 = ['Mentoría 1 a 1'], C = ['Curso'], MC = ['Mentoría', 'Curso'], CA = ['Curso', 'Curso avanzado'];
const MCT = ['Mentoría', 'Curso', 'Taller'], M11CC = ['Mentoría 1 a 1', 'Curso de cerámica'];
const CINCO = ['Curso', 'Taller', 'Asesoría', 'Mentoría 1 a 1', 'Programa Élite'];

// ── La batería ────────────────────────────────────────────────────────────────
// ELIGE: el pedido nombra exactamente uno del catálogo y no dice nada de otro, nuevo, excluir ni comparar.
const ELIGE: [string, string, string[], string][] = [
  ['h2c', 'landing para la MENTORIA 1 A 1', M11, 'Mentoría 1 a 1'],
  ['k1', 'Créame una landing de ventas para Kairos que agende llamadas', ['Kairos'], 'Kairos'],
  ['k2', '¿Me armás una landing para la mentoría 1 a 1?', M11, 'Mentoría 1 a 1'],
  ['k3', 'landing de ventas\nPara emprendedoras\nLa Mentoría 1 a 1', M11, 'Mentoría 1 a 1'],
  ['k4', 'Una landing para el Diseño Web, sin precios', ['Diseño web'], 'Diseño web'],
  ['n7', 'landing para mi curso online de cerámica', ['Curso', 'Mentoría'], 'Curso'],
  // El nombre largo, cuando el corto sólo aparece adentro de él.
  ['s1', 'créame una landing para el Curso avanzado', CA, 'Curso avanzado'],
  ['s2', 'landing para mi Mentoría VIP', ['Mentoría', 'Mentoría VIP'], 'Mentoría VIP'],
  ['y2', 'landing para mi producto curso avanzado', CA, 'Curso avanzado'],
  // «Todos mis productos» de paso no tapa el producto nombrado (3ª revisión, regresiones 9).
  ['C10', 'Landing para la Asesoría, nuestro servicio estrella, el más pedido de todos nuestros servicios', ['Asesoría', 'Curso'], 'Asesoría'],
  ['F3', 'Landing para la Mentoría 1 a 1, con un link a todos mis productos al final', ['Mentoría 1 a 1', 'Curso'], 'Mentoría 1 a 1'],
];

// PREGUNTA: todo lo demás. [id, pedido, catálogo].
const PREGUNTA: [string, string, string[]][] = [
  // 1ª revisión: «mi otro producto» con más palabras, en tuteo y voseo.
  ['h1a', 'una landing de ventas para mi otro producto que agende llamadas', M11], ['h1b', 'Landing de ventas moderna para mi otro producto', M11],
  ['h1c', '¿Me creás una landing para mi otro producto, porfa?', M11], ['h1d', 'Quiero que me hagas una landing para mi otro producto, gracias', M11],
  ['t1', 'haceme una landing para mi otro producto', M11], ['t2', 'armame una web de mi otro producto', M11], ['t3', 'necesito una web para mi otro servicio', M11],
  ['h3a', 'créame una landing para mi otro producto', MC], ['h3b', 'créame una landing para mi otro producto', ['Mentoría', 'Curso', 'Taller', 'Ebook', 'Bootcamp']],
  ['h4a', 'Landing para mi otro producto: Kairos', M],
  // 2ª revisión: todas las formas de «otro».
  ['h5a', 'créame una landing para otro de mis productos', M], ['h5b', 'créame una landing para otra de mis ofertas', M],
  ['h5c', 'créame una landing para mi nuevo producto', M], ['h5d', 'créame una landing para un producto nuevo, un curso de cerámica', M],
  ['h5e', 'créame una landing para mi segundo producto', M], ['h5f', 'créame una landing para otro producto más', M],
  ['h5g', 'creame una landing para mi otro curso', M], ['h5h', 'creame una landing para mi otra mentoría', M],
  ['s3', 'Haceme una landing para mi producto nuevo que lanzo en noviembre', M11], ['s4', 'Necesito una landing para un nuevo producto: un taller de cerámica para principiantes', M11],
  ['n9', 'Créame una landing para mi otro producto, un curso de fotografía', C], ['n11', 'landing para mi otro producto, una mentoría grupal', M],
  ['n8', 'Créame una landing para mi otro producto, un curso de fotografía', MC],
  ['n1', 'landing de ventas\nno menciones otros productos', M], ['n2', 'landing de ventas para mi mentoría\nque no se compare con otros productos', M],
  ['n3', 'una landing que muestre por qué conviene más que otros productos del mercado', M], ['n4', 'landing de ventas\nclientes que ya compraron otros productos', M],
  ['s5', 'landing de ventas\nsin hablar de mis otros servicios', M11], ['n15', 'landing para vender más que otros productos de la competencia', M],
  ['t9', 'landing que agende llamadas\nMi otro producto', M],
  // Sin nombrar un producto: también saldría sobre el principal.
  ['n10', 'landing para mi producto estrella', M], ['t5', 'hazme una landing de mi producto', M11], ['t7', 'una landing para mi taller de cerámica que agende llamadas', M11],
  ['t8', 'créame otra landing', M11], ['u1', 'una landing', M], ['u2', 'landing de ventas que agende llamadas', M11],
  ['n5', 'landing que muestre el producto con fotos', MC], ['n6', 'landing para lanzar un producto nuevo de skincare', MC],
  ['n12', 'landing para mis productos', MC], ['n13', 'landing para todos mis productos', MC], ['C9', 'Landing que presente todos tus productos', MC],
  // Dos nombrados: cuál.
  ['n14', 'landing para mi producto, la mentoría y el curso', MC], ['n16', 'landing para la mentoría y el curso', ['Mentoría', 'Curso', 'Taller']],
  ['y1', 'landing de producto para el Curso y el Curso avanzado', CA],
  ['E1', 'Landing para la Mentoría, que es más barata que la Mentoría 1 a 1', ['Mentoría', 'Mentoría 1 a 1']],
  ['E2', 'Créame una landing para el Curso, con un botón al final que lleve al Curso avanzado', CA],
  ['E3', 'landing para el Taller, sin mezclar con el Taller intensivo', ['Taller', 'Taller intensivo']],
  ['x10', 'Créame una landing para el Curso de cerámica, no para la Mentoría 1 a 1', M11CC],
  // 3ª revisión (web3-arreglos 1): «otro» sin palabra de destino.
  ['1a', 'una landing de ventas para mi otro producto que agende llamadas', M11], ['1b', 'Landing de ventas moderna para mi otro producto', M11],
  ['1c', '¿Me creás una landing para mi otro producto, porfa?', M11], ['1d', 'Quiero que me hagas una landing para mi otro producto, gracias', M11],
  ['1e', 'créame una landing para mi otro producto', M11], ['1f', 'Hacé una landing de mi otro producto', M11], ['1g', 'una landing para el otro producto', M11],
  ['1h', 'necesito una landing pa mi otro producto', M11], ['1i', 'landing: mi otro producto', M11], ['1j', 'quiero una landing. Es mi otro producto', M11],
  ['1k', 'quiero vender mi otro producto con una landing', M11], ['1l', 'una landing que venda mi otro producto', M11],
  ['1m', 'una landing que promocione mi otro producto', M11], ['1n', 'una landing enfocada en mi otro producto', M11],
  ['1o', 'una landing dedicada a mi otro producto', M11], ['1p', 'una landing exclusiva para el otro producto que tengo', M11],
  ['1q', 'una landing por mi otro producto', M11], ['1r', 'otra landing, ahora de mi otro producto', M11], ['1s', 'mi otro producto necesita una landing', M11],
  ['1t', 'hace falta landing a mi otro producto', M11], ['1u', 'una landing que hable de mi otro producto', M11],
  ['1v', 'una landing que presente mi otro producto', M11], ['1w', 'una landing que lance mi otro producto', M11],
  ['1x', 'una landing que ofrezca mi otro servicio', M11], ['1y', 'una landing para mi otra oferta', M11],
  ['1z', 'una landing que agende llamadas, pero de mi otro producto', M11],
  // 3ª revisión (web3-arreglos 7 y 2ª #3): el nombre del catálogo con «otro», en cualquier forma.
  ['3a', 'créame una landing para mi otro producto, Mentoría grupal', M], ['3b', 'créame una landing para mi otro producto: la Mentoría grupal', M],
  ['3c', 'créame una landing para mi otro producto, el curso de fotografía', C], ['3d', 'créame una landing para mi otro producto, Curso de Fotografía', C],
  ['3e', 'créame una landing para mi otro producto, una mentoría grupal', M], ['2a', 'créame una landing para mi otro producto, mentoría 1 a 1', M11],
  ['2b', 'créame una landing para mi otro producto, kairos', ['Kairos']], ['2c', 'créame una landing para mi otro producto: KAIROS', ['Kairos']],
  ['2d', 'créame una landing para mi otro producto, Kairos', ['Kairos']], ['2e', 'créame una landing para mi otro producto (Kairos)', ['Kairos']],
  ['2f', 'Créame una landing para mi otro producto, la Mentoría 1 a 1', M11],
  ['3x', 'una landing que ofrezca mi otro servicio', MC], ['3y', 'una landing que venda mi otro producto', MC], ['3z', 'una landing para mi otro curso', MC],
  // 3ª revisión (web3-arreglos 5): más formas de «otro».
  ['5a', 'créame una landing para mi próximo producto', M11], ['5b', 'créame una landing para el producto que voy a lanzar', M11],
  ['5c', 'créame una landing para mi tercer producto', M11], ['5d', 'créame una landing para un producto adicional', M11],
  ['5e', 'créame una landing para otro ebook', M11], ['5f', 'créame una landing para mi otra membresía', M11],
  ['5g', 'créame una landing para mi otra masterclass', M11], ['5h', 'créame una landing para mi otro lanzamiento', M11],
  ['5i', 'créame una landing para otro producto que tengo', M11], ['5j', 'créame una landing para mis otros productos', M11],
  ['5k', 'créame una landing para un producto que todavía no cargué', M11],
  // 3ª revisión (web3-arreglos 6): instrucciones y audiencia en otro renglón. Pregunta de más: un toque.
  ['6a', 'landing de ventas\nes para mi otro producto', M11], ['6b', 'landing de ventas\nemprendedores cansados de otros cursos', M11],
  ['6c', 'landing de ventas\ndiferenciala de otros programas', M11], ['6d', 'landing de ventas\ncompará con otros servicios del mercado', M11],
  ['6e', 'landing de ventas\nmostrá la diferencia con otros productos', M11], ['6f', 'landing de ventas\ngente que viene de otros talleres', M11],
  ['6g', 'landing de ventas para la Mentoría 1 a 1\nemprendedores cansados de otros cursos', M11],
  ['6h', 'landing de ventas para mi mentoría 1 a 1\nemprendedores cansados de otros cursos', M11],
  ['6i', 'landing de ventas\nque no la confundan con otros productos', M11], ['6j', 'landing de ventas\nevitá hablar de otros productos', M11],
  ['6k', 'landing de ventas\nnada de otros productos', M11], ['6l', 'landing de ventas\nolvidate de otros productos', M11],
  ['6m', 'landing de ventas\nsolo la mentoría, no otros productos', M11],
  // 3ª revisión (web3-arreglos 2): nombrar el que hay para EXCLUIRLO o compararlo.
  ['x1', 'Créame una landing para mi otro producto, no para la Mentoría 1 a 1', M11], ['x2', 'Créame una landing para mi otro producto, no la Mentoría 1 a 1', M11],
  ['x3', 'Créame una landing para mi otro producto (no la Mentoría 1 a 1)', M11], ['x4', 'Créame una landing para mi otro producto, que no es la Mentoría 1 a 1', M11],
  ['x5', 'Créame una landing para mi otro producto, distinto de la Mentoría 1 a 1', M11], ['x9', 'Créame una landing para mi otro producto, no para la Mentoría 1 a 1', M11CC],
  ['x11', 'Ya tengo landing de la Mentoría 1 a 1; créame una para mi otro producto', M11], ['x12', 'Además de la Mentoría 1 a 1, créame una landing para mi otro producto', M11],
  ['x13', 'Créame una landing para mi otro producto, parecida a la de la Mentoría 1 a 1', M11],
  ['x14', 'Como la Mentoría 1 a 1 ya tiene landing, quiero otra para mi otro producto', M11],
  ['x15', 'Créame una landing para mi otro producto, no para Kairos', ['Kairos']], ['x16', 'Créame una landing para mi otro producto, no la de Kairos', ['Kairos']],
  ['y3', 'landing para mi otro producto, no el Curso', MCT], ['y4', 'Ya tengo landing de la Mentoría y del Curso; créame una para mi otro producto', MCT],
  ['y5', 'Créame una landing para mi otro producto, el Taller', MCT],
  ['y13', 'crea una landing para lo que sería mi otro producto', M], ['y14', 'crea una landing que me ayude a difundir mi otro producto', M],
  // 3ª revisión (web3-regresiones): asesoría y coaching, comparaciones, «los distintos servicios», nombres en minúscula.
  ['B1', 'créame una landing para mi otra asesoría', ['Asesoría']], ['B2', 'créame una landing para mi otra asesoría', ['Asesoría', 'Curso']],
  ['B3', 'haceme una landing para mi otro coaching', ['Coaching']],
  ['D1', 'Landing de ventas para mi Mentoría 1 a 1\nEvitá hablar de otros productos', M11], ['D2', 'landing de ventas\nEvita hablar de otros productos', M11],
  ['D3', 'Landing para mi curso de excel, destacando en qué se diferencia de otros cursos', ['Curso de Excel']],
  ['D4', 'haceme una landing para mi mentoría, con el mismo estilo que la de mi otro producto', MC],
  ['D5', 'haceme una landing para mi otro producto, mentoria 1 a 1', M11], ['D6', 'Landing para mi taller con una oferta nueva de Black Friday', ['Taller']],
  ['D7', 'Haceme una landing de mi agencia con los distintos servicios que ofrezco', ['Asesoría', 'Taller']],
  ['D8', 'Haceme una landing de mi agencia con los distintos servicios que ofrezco', ['Asesoría']],
  ['D9', 'landing de ventas\nNo quiero que se hable de otros productos', M11],
  ['D10', 'landing para mi programa elite, para los que vienen de otros programas', ['Programa Élite']],
  ['F1', 'landing de ventas que agende llamadas\nEmprendedores que vienen de otros programas', ['Programa Élite']],
  ['F2', 'landing de ventas\nGente que viene de otros cursos y no tuvo resultados', ['Curso', 'Mentoría 1 a 1']],
];

// Lo que mandó el modelo. [id, pedido, `producto`, `producto_nuevo`, catálogo, lo que tiene que pasar].
type Espera = { catalogo: string } | { nuevo: string } | 'negocio' | 'ninguno' | 'pregunta';
const T = 'créame una landing para mi otro producto';
const REFERENCIAS = ['mi otro', 'ese otro', 'el que te dije', 'el de antes', 'lo otro', 'otra cosa', 'el otro que vendo', 'el que vendo aparte',
  'el segundo producto', 'mi producto 2', 'producto B', 'other product', 'no lo sé', 'no se todavía', 'pendiente', 'a definir', 'TBD',
  'desconocido', 'sin nombre', 'el que no está', 'el que no está en el catálogo', 'mi otro producto (no especificado)', 'otro producto del cliente',
  'producto no especificado', 'el producto nuevo', 'uno nuevo', 'el nuevo lanzamiento', 'mi próximo producto', 'el otro producto que mencionó',
  'el que la persona no nombró', 'por definir', 'no dijo', 'desconocido (preguntar)', '?', '...', 'otro producto distinto a la Mentoría 1 a 1',
  'mi otro producto', 'otro producto', 'otro', 'N/A', 'nuevo', 'el otro', 'no sé', 'otro de mis productos', 'mi otro curso', 'el 2', 'la opción 12',
  'la primera', 'uno nuevo que estoy armando', 'un curso', 'mi otra asesoría', 'mi otro coaching', 'mi otro ebook', '  '];
const DICHO: [string, string, string | null, string | null, string[], Espera][] = [
  // `producto` del catálogo, normalizado.
  ['c1', 'landing', 'MENTORIA', null, M, { catalogo: 'Mentoría' }], ['c3', 'landing', 'la mentoría', null, M, { catalogo: 'Mentoría' }],
  ['c4', 'landing', 'Mentoría 1 a 1', null, ['Mentoría', 'Mentoría 1 a 1'], { catalogo: 'Mentoría 1 a 1' }],
  ['c5', 'landing', 'Mentoría', null, ['Mentoría', 'Mentoría 1 a 1'], { catalogo: 'Mentoría' }],
  ['c6', 'landing', 'Diseño Web', null, ['Diseño web'], { catalogo: 'Diseño web' }],
  ['y6', 'landing para mi otro producto', 'el Taller', null, MCT, { catalogo: 'Taller' }], ['y7', 'landing para mi otro producto', 'taller', null, MCT, { catalogo: 'Taller' }],
  ['c7', 'landing para la Mentoría', 'Curso', null, MC, { catalogo: 'Curso' }],
  ['c8', T, null, 'Mentoría', M, { catalogo: 'Mentoría' }],
  // El negocio en general.
  ['g1', 'landing para mis productos', OPCION_NEGOCIO, null, MC, 'negocio'], ['g2', 'landing para mis productos', 'el negocio en general', null, MC, 'negocio'],
  ['g3', 'landing de mi agencia', 'Todo el negocio', null, ['Asesoría'], 'negocio'],
  // Un producto nuevo, con su nombre o de qué se trata, aunque tenga una palabra del catálogo (3ª revisión, arreglos 3).
  ['3f', T, null, 'curso de fotografía', C, { nuevo: 'curso de fotografía' }],
  ['3g', T, null, 'Mentoría grupal para emprendedoras, 8 semanas', M, { nuevo: 'Mentoría grupal para emprendedoras, 8 semanas' }],
  ['3h', T, null, 'una mentoría grupal', M, { nuevo: 'una mentoría grupal' }], ['3i', T, null, 'Mentorías grupales', M, { nuevo: 'Mentorías grupales' }],
  ['3j', T, null, 'Taller de cerámica', ['Taller'], { nuevo: 'Taller de cerámica' }], ['3k', T, null, 'mentoría 1 a 1 grupal', M11, { nuevo: 'mentoría 1 a 1 grupal' }],
  ['y8', 'landing para mi otro producto', null, 'el taller de los sábados', MCT, { nuevo: 'el taller de los sábados' }],
  ['y9', T, null, 'Un ebook de recetas veganas', M, { nuevo: 'Un ebook de recetas veganas' }],
  ['A1', T, null, 'un curso de fotografía', C, { nuevo: 'un curso de fotografía' }], ['A2', T, null, 'Curso de Fotografía', C, { nuevo: 'Curso de Fotografía' }],
  ['A3', T, null, 'Taller de cerámica', ['Taller', 'Mentoría 1 a 1'], { nuevo: 'Taller de cerámica' }],
  ['A4', T, null, 'Asesorías grupales', ['Asesoría'], { nuevo: 'Asesorías grupales' }], ['A5', T, null, 'Mentoría grupal', M, { nuevo: 'Mentoría grupal' }],
  ['C1', T, null, 'un curso para tu negocio', M11, { nuevo: 'un curso para tu negocio' }],
  ['C2', T, null, 'Mentoría para tu negocio', ['Curso', 'Taller'], { nuevo: 'Mentoría para tu negocio' }],
  ['C3', T, null, 'Taller de marca', M11, { nuevo: 'Taller de marca' }],
  ['F5', T, null, 'Curso para emprendedores', CINCO, { nuevo: 'Curso para emprendedores' }],
  ['F6', 'creame una landing para mi nuevo taller', null, 'Taller de Fotografía', CINCO, { nuevo: 'Taller de Fotografía' }],
  ['F7', 'creame una landing para mi otra mentoria', null, 'Mentoría para tu marca', CINCO, { nuevo: 'Mentoría para tu marca' }],
  ['t6', T, null, 'Yoga para embarazadas', MC, { nuevo: 'Yoga para embarazadas' }], ['h4b', 'Landing para mi otro producto', null, 'Kairos', M, { nuevo: 'Kairos' }],
  ['o1', T, OPCION_NUEVO, 'Yoga para embarazadas', MC, { nuevo: 'Yoga para embarazadas' }],
  // Sin catálogo: no hay cuál elegir mal.
  ['t4', T, null, null, [], 'ninguno'], ['F4', 'landing de ventas\nEvitá hablar de otros productos', null, null, [], 'ninguno'],
  ['0p', T, 'Kairos', null, [], 'ninguno'], ['0n', T, null, 'Yoga para embarazadas', [], { nuevo: 'Yoga para embarazadas' }],
  // Lo que mandó el modelo y no es del catálogo: se pregunta, no se adivina desde el texto.
  ['z1', 'landing para la Mentoría', 'Mentoría grupal', null, M, 'pregunta'], ['z2', T, 'mentorías', null, M, 'pregunta'],
  ['x6', T, 'otro producto distinto a la Mentoría 1 a 1', null, M11, 'pregunta'], ['x7', T, 'Otro (no la Mentoría 1 a 1)', null, M11, 'pregunta'],
  ['x8', T, 'no es la Mentoría 1 a 1', null, M11, 'pregunta'], ['y8p', 'landing para mi otro producto', 'el taller de los sábados', null, MCT, 'pregunta'],
  ['C4', 'landing para mis productos', 'los dos', null, MC, 'pregunta'], ['C5', 'landing para mis productos', 'ambos', null, MC, 'pregunta'],
  ['C7', 'landing para mis productos', 'la página principal', null, MC, 'pregunta'], ['C12', 'landing para mi producto principal', 'el principal', null, MC, 'pregunta'],
  ['F8', 'landing para mis productos', 'cualquiera', null, MC, 'pregunta'], ['B4', 'créame una landing para mi otra asesoría', 'mi otra asesoría', null, ['Asesoría'], 'pregunta'],
  ['o2', T, OPCION_NUEVO, null, MC, 'pregunta'], ['o3', T, 'Un producto nuevo', 'a definir', MC, 'pregunta'],
  ...REFERENCIAS.flatMap((r, i): [string, string, string | null, string | null, string[], Espera][] => [
    [`rp${i}`, T, r, null, M11, 'pregunta'], [`rn${i}`, T, null, r, M11, 'pregunta'], [`rm${i}`, 'landing de ventas', r, null, MC, 'pregunta']]),
];

test('la batería de las tres revisiones: elige SÓLO lo seguro y pregunta todo lo demás', () => {
  const mal: string[] = [];
  const ver = (d: ReturnType<typeof productoDeLanding>): string => (d.que === 'preguntar' ? 'preguntó' : `siguió (${d.es}: ${JSON.stringify(d.producto)})`);
  for (const [id, texto, cat, nombre] of ELIGE) {
    const d = productoDeLanding(texto, {}, P(...cat));
    if (d.que !== 'sigue' || d.es !== 'catalogo' || d.producto !== nombre) mal.push(`${id}: ${ver(d)} y tenía que elegir «${nombre}» («${texto}»)`);
  }
  for (const [id, texto, cat] of PREGUNTA) {
    const d = productoDeLanding(texto, {}, P(...cat));
    if (d.que !== 'preguntar') mal.push(`${id}: ${ver(d)} y tenía que preguntar («${texto}»)`);
  }
  for (const [id, texto, producto, nuevo, cat, espera] of DICHO) {
    const d = productoDeLanding(texto, { producto, nuevo }, P(...cat));
    const bien = espera === 'pregunta' ? d.que === 'preguntar'
      : espera === 'negocio' || espera === 'ninguno' ? d.que === 'sigue' && d.es === espera && d.producto === null
        : 'catalogo' in espera ? d.que === 'sigue' && d.es === 'catalogo' && d.producto === espera.catalogo
          : d.que === 'sigue' && d.es === 'nuevo' && d.producto === espera.nuevo;
    if (!bien) mal.push(`${id}: ${ver(d)} y tenía que ${JSON.stringify(espera)} (producto ${JSON.stringify(producto)}, nuevo ${JSON.stringify(nuevo)})`);
  }
  assert.deepEqual(mal, []);
  assert.ok(ELIGE.length + PREGUNTA.length + DICHO.length > 300, `la batería tiene ${ELIGE.length + PREGUNTA.length + DICHO.length} casos`);
});

test('cada palabra de otro, nuevo, excluir o comparar hace preguntar aunque el producto esté nombrado', () => {
  const base = 'Créame una landing para la Mentoría 1 a 1';
  for (const resto of ['y otra para el curso', 'una versión nueva', 'algo distinto', 'con un enfoque diferente', 'y aparte la del curso', 'la segunda edición',
    'para el próximo mes', 'la tercera cohorte', 'con un bono adicional', 'además del taller', 'parecida a la del curso', 'similar a la vieja',
    'igual que la anterior', 'con el mismo estilo', 'para compararla', 'excepto la parte de precios', 'salvo el video', 'que no es la de siempre',
    'pero no la de la agencia', 'ya tengo la del curso', 'en vez de la vieja', 'en lugar del curso']) {
    assert.equal(productoDeLanding(`${base}, ${resto}`, {}, P(...M11)).que, 'preguntar', resto);
  }
  // Una palabra que sólo CONTIENE las letras no cuenta («nosotros» tiene «otr», «nota» tiene «no»).
  for (const resto of ['para nosotros', 'con una nota de prensa', 'sin precios']) {
    const d = productoDeLanding(`${base}, ${resto}`, {}, P(...M11));
    assert.ok(d.que === 'sigue' && d.producto === 'Mentoría 1 a 1', resto);
  }
});

test('la pregunta trae las opciones: los productos, uno nuevo y el negocio en general, y dice por dónde vuelve', () => {
  const d = productoDeLanding('créame una landing para mi otro producto', {}, P(...MC));
  assert.ok(d.que === 'preguntar');
  assert.deepEqual(d.opciones, ['Mentoría', 'Curso', OPCION_NUEVO, OPCION_NEGOCIO]);
  assert.match(d.mensaje, /no lo adivines, pregúntale a la persona con estas opciones: «Mentoría», «Curso», «Un producto nuevo», «El negocio en general»/);
  assert.match(d.mensaje, /en «producto», con el nombre exacto; si es «Un producto nuevo», su nombre y de qué se trata van en «producto_nuevo»/);
  const cinco = productoDeLanding('una landing', {}, P(...CINCO));
  assert.ok(cinco.que === 'preguntar' && cinco.opciones.length === 6 && /el catálogo tiene 5: puede nombrar otro/.test(cinco.mensaje));
  // El porqué, para que MaKo pregunte bien.
  const dos = productoDeLanding('landing para la mentoría y el curso', {}, P(...MC));
  assert.match(dos.que === 'preguntar' ? dos.mensaje : '', /^El pedido nombra más de uno: «Mentoría», «Curso»\./);
  const duda = productoDeLanding('Ya tengo la de la Mentoría; créame una para mi otro producto', {}, P(...M));
  assert.match(duda.que === 'preguntar' ? duda.mensaje : '', /^El pedido nombra «Mentoría», pero también dice algo que puede ser otro producto/);
  const malo = productoDeLanding('landing', { producto: 'Mentoría grupal' }, P(...M));
  assert.match(malo.que === 'preguntar' ? malo.mensaje : '', /^«Mentoría grupal» no es un producto del catálogo\./);
  const vago = productoDeLanding('landing', { nuevo: 'mi otro' }, P(...M));
  assert.match(vago.que === 'preguntar' ? vago.mensaje : '', /^«mi otro» no dice cuál es el producto nuevo\./);
  const sinNombre = productoDeLanding('landing', { producto: OPCION_NUEVO }, P(...M));
  assert.ok(sinNombre.que === 'preguntar' && !sinNombre.opciones.length && /pregúntale su nombre y de qué se trata/.test(sinNombre.mensaje));
});

test('los nombres: enteros, sin tildes ni mayúsculas, y el corto sólo adentro del largo no cuenta', () => {
  assert.deepEqual(nombradosEn('el Curso avanzado', P(...CA)).map((p) => p.nombre), ['Curso avanzado']);
  assert.deepEqual(nombradosEn('el Curso y el Curso avanzado', P(...CA)).map((p) => p.nombre), ['Curso', 'Curso avanzado']);
  assert.deepEqual(nombradosEn('la MENTORIA 1 A 1', P(...M11)).map((p) => p.nombre), ['Mentoría 1 a 1']);
  assert.deepEqual(nombradosEn('cursos y cursillos', P(...C)), [], 'una palabra que empieza igual no es el nombre');
  assert.deepEqual(nombradosEn('para la ia', P('IA')), [], 'un nombre de menos de 3 letras no se busca');
  for (const r of ['Kairos', 'curso de fotografía', 'Yoga para embarazadas', 'Taller de marca', 'Mentoría grupal']) assert.equal(esDescripcionVaga(r), false, r);
});

test('el chat del editor sigue como en producción: productoDelPedido devuelve lo mismo que origin/main', () => {
  // Lo que devolvía origin/main (81f16a865) con cada frase de la tercera revisión. Algunas están MAL en producción (la
  // revisión las marcó) y quedan así hasta que el chat del editor use productoDeLanding: lo que no puede haber es una
  // regresión. Ver «Lo que quedó SIN hacer» en docs/hallazgos-editor-landing.md.
  const MAIN: [string, string[], string | string[] | null][] = [
    ['créame otra landing que venda mi otro producto', M, null], ['créame una landing que promocione mi otro producto', M, null],
    ['créame una landing enfocada en mi otro producto', M, null], ['créame una landing dedicada a mi otro producto', M, null],
    ['créame una landing que presente mi otro producto', M, null], ['créame una landing pa mi otro producto', M, null],
    ['quiero otra landing, es mi otro producto', M, null], ['créame una landing por mi otro producto', M, null],
    ['créame otra landing para mi otro producto', M, null], ['créame una landing para mi otro producto, la Mentoría', M, 'Mentoría'],
    ['créame una landing para mi otro producto, Mentoría grupal', M, 'Mentoría'], ['créame una landing para mi otro producto: la Mentoría grupal', M, 'Mentoría'],
    ['créame una landing para mi otro producto, el curso de fotografía', C, 'Curso'], ['créame una landing para mi otro producto, Curso de Fotografía', C, 'Curso'],
    ['créame una landing para mi otro producto, mentoría 1 a 1', M11, 'Mentoría 1 a 1'], ['créame una landing para mi otro producto, kairos', ['Kairos'], 'Kairos'],
    ['créame una landing para mi otro producto: KAIROS', ['Kairos'], 'Kairos'],
    ['créame una landing para mi producto que no se compare con otros productos', M, null],
    ['créame una landing para mi producto, diferenciala de otros productos', M, null],
    ['créame una landing para mi producto, para gente cansada de otros cursos', M, 'Mentoría'],
    ['créame una landing para mi próximo producto', M, 'Mentoría'], ['créame una landing para el producto que voy a lanzar', M, 'Mentoría'],
    ['créame una landing para mi tercer producto', M, 'Mentoría'], ['créame una landing para un producto adicional', M, 'Mentoría'],
    ['haceme una landing para mi mentoría, con el mismo estilo que la de mi otro producto', MC, 'Mentoría'],
    ['créame otra landing para mi curso, igual a la de mis otros productos', MC, 'Curso'],
    ['haceme una landing para mi otro producto, mentoria 1 a 1', ['Mentoría 1 a 1', 'Curso'], 'Mentoría 1 a 1'],
    ['créame otra landing para mi taller con una oferta nueva de Black Friday', ['Taller', 'Curso'], 'Taller'],
    ['créame otra landing para mi curso de excel, que muestre en qué se diferencia de otros cursos', ['Curso de Excel', 'Taller'], 'Curso de Excel'],
    ['Créame otra landing para la Mentoría, que es más barata que la Mentoría 1 a 1', ['Mentoría', 'Mentoría 1 a 1'], ['Mentoría', 'Mentoría 1 a 1']],
    ['Créame otra landing para el Curso, con un botón al final que lleve al Curso avanzado', CA, CA],
    ['Créame una landing para mi otro producto, no para la Mentoría 1 a 1', M11, 'Mentoría 1 a 1'],
    ['Ya tengo landing de la Mentoría 1 a 1; créame una para mi otro producto', M11, 'Mentoría 1 a 1'],
    ['Además de la Mentoría 1 a 1, créame una landing para mi otro producto', M11, 'Mentoría 1 a 1'],
    ['Créame una landing para el Curso de cerámica, no para la Mentoría 1 a 1', M11CC, M11CC],
    ['créame una landing para la Mentoría 1 a 1', M11, 'Mentoría 1 a 1'], ['créame una landing de mi producto', M11, 'Mentoría 1 a 1'],
    ['créame una landing de mi producto', MC, MC],
  ];
  const mal: string[] = [];
  for (const [t, cat, espera] of MAIN) {
    const r = productoDelPedido(t, P(...cat));
    const dio = r == null ? null : r.objeto ? r.objeto.nombre : r.candidatos.map((c) => c.nombre);
    if (JSON.stringify(dio) !== JSON.stringify(espera)) mal.push(`«${t}»: ${JSON.stringify(dio)} y en main era ${JSON.stringify(espera)}`);
  }
  assert.deepEqual(mal, []);
});

test('el producto llega al pedido y se VE adelante en lo que se confirma: del catálogo, nuevo o el negocio', () => {
  const tema = (id: string) => ({ id });
  const idea = 'Necesito una landing de ventas para un nuevo producto: un taller de cerámica para principiantes que agende llamadas';
  const g = pedidoGenerar({ idea, producto: 'Taller de cerámica' }, tema);
  assert.ok(!('error' in g), JSON.stringify(g));
  if ('error' in g) return;
  assert.equal(g.idea, `${idea}. Es para el producto «Taller de cerámica».`);
  assert.equal(g.productoEs, 'catalogo');
  const r = resumenGenerar(g, null);
  assert.match(r, /^Crear con IA una landing para el producto «Taller de cerámica» desde la idea «Necesito/, 'el producto va adelante, no al final de la idea cortada');
  assert.doesNotMatch(r, /Es para el producto/, 'y no se repite adentro de la idea');
  const n = pedidoGenerar({ idea: 'créame una landing para mi otro producto', producto_nuevo: 'Curso de fotografía para principiantes' }, tema);
  assert.ok(!('error' in n) && n.productoEs === 'nuevo' && n.producto === 'Curso de fotografía para principiantes');
  assert.ok(!('error' in n) && n.idea === 'créame una landing para mi otro producto. Es para el producto «Curso de fotografía para principiantes».');
  assert.match(!('error' in n) ? resumenGenerar(n, null) : '', /^Crear con IA una landing para un producto nuevo, «Curso de fotografía para principiantes» desde la idea «créame una landing para mi otro producto»/);
  const neg = pedidoGenerar({ idea: 'Una landing de mi agencia.', producto: OPCION_NEGOCIO }, tema);
  assert.ok(!('error' in neg) && neg.productoEs === 'negocio' && neg.producto === null);
  assert.ok(!('error' in neg) && neg.idea === 'Una landing de mi agencia. Es para el negocio en general, no para un producto.');
  assert.match(!('error' in neg) ? resumenGenerar(neg, null) : '', /^Crear con IA una landing para el negocio en general desde la idea «Una landing de mi agencia»/);
  const conTexto = pedidoGenerar({ texto: 'El texto de la página', producto: 'Kairos', instrucciones: 'corto' }, tema);
  assert.equal('params' in conTexto ? conTexto.params.instrucciones : null, 'Es para el producto «Kairos». corto');
  const negTexto = pedidoGenerar({ texto: 'El texto de la página', producto: OPCION_NEGOCIO }, tema);
  assert.equal('params' in negTexto ? negTexto.params.instrucciones : null, 'Es para el negocio en general, no para un producto.');
  const sin = pedidoGenerar({ idea: 'Una landing' }, tema);
  assert.ok(!('error' in sin) && sin.producto === null && sin.productoEs === null && !/ para (?:el|un) /.test(resumenGenerar(sin, null).slice(0, 30)));
});

test('generar_landing_con_ia no prepara nada sin saber para cuál producto, y lo decidido reemplaza a lo del modelo (se ejecuta)', () => {
  const r = hijo(`
import { mock } from 'node:test';
const real = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));
let catalogo = [{ id: 1, nombre: 'Mentoría 1 a 1' }];
mock.module(${url('lib/productos.ts')}, { exports: { ...real(await import(${url('lib/productos.ts')})), listProductos: async () => { if (catalogo === 'falla') throw new Error('sin base'); return catalogo; } } });
mock.module(${url('lib/editor-landing/server.ts')}, { exports: { ...real(await import(${url('lib/editor-landing/server.ts')})), temas: async () => ({ ok: true, temas: [] }) } });
const { RUNNERS_EDITOR } = await import(${url('lib/api-mako/areas/landing-editor.run.ts')});
const ctx = { ws: 3, canal: 'app', canalKey: 'app:prueba', alcance: 'proponer', rol: 'admin' };
const preparar = (input) => RUNNERS_EDITOR.generar_landing_con_ia.preparar(input, ctx);
const venda = await preparar({ idea: 'una landing que venda mi otro producto' });
const excluye = await preparar({ idea: 'Ya tengo la landing de la Mentoría 1 a 1; créame una para mi otro producto' });
const sinNombrar = await preparar({ idea: 'una landing para mi taller de cerámica que agende llamadas' });
const enInstrucciones = await preparar({ idea: 'landing de ventas para la Mentoría 1 a 1', instrucciones: 'que no se parezca a la vieja' });
const referencia = await preparar({ idea: 'landing de ventas que agende llamadas', producto: 'mi otro producto' });
const nombrado = await preparar({ idea: 'Créame una landing para la Mentoría 1 a 1' });
const eligio = await preparar({ idea: 'créame una landing para mi otro producto', producto: 'mentoria 1 a 1' });
const nuevo = await preparar({ idea: 'créame una landing para mi otro producto', producto: 'Un producto nuevo', producto_nuevo: 'Curso de fotografía para principiantes' });
const negocio = await preparar({ idea: 'una landing de mi agencia', producto: 'El negocio en general' });
catalogo = [];
const vacio = await preparar({ idea: 'créame una landing para mi otro producto', producto: 'mi otro producto' });
catalogo = 'falla';
const falla = await preparar({ idea: 'créame una landing para mi otro producto', producto: 'Kairos', producto_nuevo: 'mi otro' });
console.log(JSON.stringify({ venda, excluye, sinNombrar, enInstrucciones, referencia, nombrado, eligio, nuevo, negocio, vacio, falla }));
`) as Record<string, { error?: string; faltan?: string[]; payload?: Record<string, unknown>; resumen?: string }>;
  for (const k of ['venda', 'excluye', 'sinNombrar', 'enInstrucciones', 'referencia'] as const) {
    assert.match(r[k].error ?? '', /pregúntale a la persona con estas opciones: «Mentoría 1 a 1», «Un producto nuevo», «El negocio en general»/, `${k}: ${JSON.stringify(r[k]).slice(0, 200)}`);
    assert.deepEqual(r[k].faltan, ['producto'], k);
    assert.equal(r[k].payload, undefined, `${k}: preparó la landing igual`);
  }
  assert.equal(r.nombrado.payload?.producto, 'Mentoría 1 a 1', JSON.stringify(r.nombrado).slice(0, 200));
  assert.match(r.nombrado.resumen ?? '', /^Crear con IA una landing para el producto «Mentoría 1 a 1»/);
  assert.equal(r.eligio.payload?.producto, 'Mentoría 1 a 1', 'el nombre del catálogo, no lo que escribió el modelo');
  assert.equal(r.nuevo.payload?.producto, undefined, 'la opción «Un producto nuevo» no queda como nombre');
  assert.equal(r.nuevo.payload?.producto_nuevo, 'Curso de fotografía para principiantes');
  assert.match(r.nuevo.resumen ?? '', /^Crear con IA una landing para un producto nuevo, «Curso de fotografía para principiantes»/);
  assert.equal(r.negocio.payload?.producto, 'El negocio en general');
  assert.match(r.negocio.resumen ?? '', /^Crear con IA una landing para el negocio en general/);
  for (const k of ['vacio', 'falla'] as const) {
    assert.ok(r[k].payload && !r[k].error, `${k}: ${JSON.stringify(r[k]).slice(0, 200)}`);
    assert.equal(r[k].payload?.producto, undefined, `${k}: quedó el producto ${JSON.stringify(r[k].payload?.producto)}`);
    assert.equal(r[k].payload?.producto_nuevo, undefined, k);
    assert.doesNotMatch(JSON.stringify(r[k].payload), /Es para el producto/, `${k}: lo del modelo quedó pegado a la idea`);
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
  assert.match(r, /NO lo adivines: antes de proponer, pregunta con opciones \(los productos del catálogo, «Un producto nuevo» y «El negocio en general»\)/);
  assert.ok(r.length < 900, `la receta de landing pesa ${r.length}`);
  assert.doesNotMatch(r, /\b[a-z]+_[a-z_]+\b/, 'no nombra herramientas: no siempre viajan las que nombraría');
  const run = sinComentarios(readFileSync(join(RAIZ, 'lib/api-mako/areas/landing-editor.run.ts'), 'utf8').replace(/\r\n/g, '\n'));
  assert.match(run, /const pedido = \['idea', 'instrucciones', 'titulo', 'audiencia'\]\.map\(\(k\) => str\(input, k\)\)/);
  // El modelo sólo puede mandar lo que la definición declara: sin `producto_nuevo`, un producto nuevo no tendría por dónde volver.
  const def = readFileSync(join(RAIZ, 'lib/api-mako/areas/landing-editor.def.ts'), 'utf8');
  assert.match(def, /nombre: 'producto', rotulo: 'Producto', tipo: 'string', max: 300, descripcion: 'Para qué producto es: el nombre EXACTO de uno del catálogo, o «El negocio en general»/);
  assert.match(def, /nombre: 'producto_nuevo', rotulo: 'Producto nuevo', tipo: 'string', max: 300, descripcion: 'Si la persona eligió «Un producto nuevo»/);
});
