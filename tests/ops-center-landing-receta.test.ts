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
// LA REVISIÓN ADVERSARIAL DEL 20/10 (noche) tiró la primera versión, que contaba palabras «que no son relleno»:
//   1. dos cualesquiera saltaban el guardia («ventas», «moderna», «porfa», el voseo «creás»);
//   2. nombrar el ÚNICO producto lo frenaba con un mensaje falso;
//   3. con dos o más productos creaba sin preguntar;
//   4. una respuesta de una palabra («Kairos») volvía a frenarse;
//   5. «otro de mis productos» no se detectaba;
//   6. sólo se miraba `idea`, no las instrucciones ni el título.
// Ahora el pedido se compara con los NOMBRES del catálogo, y la vuelta llega marcada en el parámetro `producto`. Cada
// caso es una frase de la batería de abajo (tuteo y voseo), y el `preparar` se EJECUTA con el catálogo de mentira.
//
// PROBADO ROMPIÉNDOLO (20/10/2026; arnés que rompe UNA cosa, corre este archivo, restaura y compara el sha256; las 9
// restauradas con el mismo hash; base 6 / 0). Pasan / fallan:
//   R1  el `producto` dicho se ignora (caso 4: la vuelta con una palabra se frena)        → 3 / 3
//   R2  nombrar el producto del catálogo con «otro» no cuenta (caso 2)                    → 4 / 2
//   R3  con dos o más productos y «otro», sigue sin preguntar (caso 3)                     → 5 / 1
//   R4  «otro de mis productos» y «otro servicio» no se detectan (caso 5)                  → 4 / 2
//   R5  el guardia mira sólo la idea (caso 6)                                              → 4 / 2
//   R6  el `preparar` no frena con la pregunta                                             → 5 / 1
//   R7  el producto no llega al pedido                                                     → 5 / 1
//   R8  con varios productos y «mi producto», no pregunta cuál                              → 5 / 1
//   R9  la receta viaja siempre                                                            → 5 / 1
//
// Correr: node --import tsx --test tests/ops-center-landing-receta.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { pideOtroProducto, productoDeLanding, productoDelPedido } from '../lib/mako-pedidos';
import { recetasDelTurno } from '../lib/doer-recetas';
import { pedidoGenerar } from '../lib/api-mako/areas/landing-contenido.helpers';

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

const UNO = [{ id: '1', nombre: 'Mentoría 1 a 1' }];
const DOS = [...UNO, { id: '2', nombre: 'Curso de cerámica' }];
const pregunta = (t: string, ps = UNO, producto: string | null = null) => {
  const d = productoDeLanding(t, producto, ps);
  return d.que === 'preguntar' ? d.mensaje : null;
};
const sigue = (t: string, ps = UNO, producto: string | null = null) => {
  const d = productoDeLanding(t, producto, ps);
  return d.que === 'sigue' ? d.producto : `PREGUNTÓ: ${d.mensaje}`;
};

test('con UN producto, «otro producto» pregunta cuál, por más palabras que traiga el pedido (casos 1 y 5, tuteo y voseo)', () => {
  for (const t of [
    'créame una landing para mi otro producto', 'Creame una web para mi otro producto por favor', 'hazme otra landing de mis otros productos',
    'haceme una landing para mi otro producto', 'armame una web de mi otro producto', 'podés crear una landing para mi otro producto',
    // El caso 1 de la revisión: dos palabras cualesquiera no dicen cuál es.
    'una landing de ventas para mi otro producto que agende llamadas', 'Landing de ventas moderna para mi otro producto',
    '¿Me creás una landing para mi otro producto, porfa?', 'Quiero que me hagas una landing para mi otro producto, gracias',
    // El caso 5: «otro de mis productos», y un servicio.
    'créame una landing para otro de mis productos', 'necesito una web para mi otro servicio',
  ]) {
    const m = pregunta(t);
    assert.ok(m, `«${t}» pasó: se iba a armar sobre el producto que hay`);
    assert.match(m!, /un solo producto \(«Mentoría 1 a 1»\) y el pedido es para OTRO[\s\S]*no la armes sobre «Mentoría 1 a 1»/);
    assert.match(m!, /pásalo en «producto»/, 'la pregunta dice por dónde vuelve la respuesta');
  }
  // Sin productos: también se pregunta, sin nombrar uno que no existe.
  assert.match(pregunta('créame una landing para mi otro producto', []) ?? '', /todavía no tiene productos/);
  assert.equal(pideOtroProducto('para MI OTRO PRODUCTO'), true);
});

test('la vuelta pasa: el producto dicho (aunque sea una palabra, caso 4) y el del catálogo nombrado (caso 2)', () => {
  // Caso 4: la respuesta llega marcada en `producto`, sin depender de cuántas palabras tiene.
  assert.equal(sigue('créame una landing para mi otro producto', UNO, 'Kairos'), 'Kairos');
  assert.equal(sigue('créame una landing para mi otro producto', UNO, 'un ebook'), 'un ebook');
  assert.equal(sigue('créame una landing para mi otro producto', UNO, 'mentoría 1 a 1'), 'Mentoría 1 a 1', 'dicho en minúsculas, es el del catálogo');
  // Caso 2: nombrar el único producto del catálogo NO frena: es ése.
  assert.equal(sigue('Créame una landing para mi otro producto, la Mentoría 1 a 1'), 'Mentoría 1 a 1');
  assert.equal(sigue('una landing para la mentoría 1 a 1'), 'Mentoría 1 a 1');
  // Lo que no habla de un producto sigue como siempre.
  assert.equal(sigue('una landing para mi taller de cerámica que agende llamadas'), null);
  assert.equal(sigue('créame otra landing'), null);
  assert.equal(sigue('una landing para mi producto', []), null, 'sin catálogo y sin «otro», nada que preguntar');
});

test('con DOS o más productos se pregunta cuál, con sus nombres (caso 3); nombrar uno pasa', () => {
  for (const t of ['créame una landing para mi otro producto', 'armame una landing de mi producto', 'hazme una web para otro de mis productos', 'una landing para mi otro servicio']) {
    const m = pregunta(t, DOS);
    assert.ok(m, `«${t}» pasó sin decir para cuál`);
    assert.match(m!, /«Mentoría 1 a 1», «Curso de cerámica»/, 'la pregunta trae los nombres del catálogo');
  }
  assert.equal(sigue('una landing para el curso de cerámica', DOS), 'Curso de cerámica');
  assert.equal(sigue('créame una landing para mi otro producto', DOS, 'Curso de cerámica'), 'Curso de cerámica');
  assert.equal(sigue('créame una landing para mi otro producto', DOS, 'Yoga para embarazadas'), 'Yoga para embarazadas', 'uno nuevo, dicho');
  // La misma regla que el chat del editor: productoDelPedido pregunta igual.
  assert.deepEqual(productoDelPedido('créame una landing para mi otro producto', DOS)?.candidatos.map((c) => c.nombre), ['Mentoría 1 a 1', 'Curso de cerámica']);
  // Y con uno solo, «otro de mis productos» ya no elige ése (caso 5, en el chat del editor).
  assert.equal(productoDelPedido('créame una landing para otro de mis productos', UNO), null);
});

test('el producto llega al pedido con la MISMA frase del chat del editor', () => {
  const tema = (id: string) => ({ id });
  const conIdea = pedidoGenerar({ idea: 'Una landing que agende llamadas', producto: 'Kairos' }, tema);
  assert.ok(!('error' in conIdea), JSON.stringify(conIdea));
  assert.equal('idea' in conIdea ? conIdea.idea : null, 'Una landing que agende llamadas. Es para el producto «Kairos».');
  const conTexto = pedidoGenerar({ texto: 'El texto de la página', producto: 'Kairos', instrucciones: 'corto' }, tema);
  assert.ok(!('error' in conTexto));
  assert.equal('params' in conTexto ? conTexto.params.instrucciones : null, 'Es para el producto «Kairos». corto');
  const sin = pedidoGenerar({ idea: 'Una landing' }, tema);
  assert.equal('idea' in sin ? sin.idea : null, 'Una landing');
});

test('generar_landing_con_ia no prepara nada sin saber para cuál producto, y mira también instrucciones y título (casos 3 y 6; se ejecuta)', () => {
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
const kairos = await preparar({ idea: 'créame una landing para mi otro producto', producto: 'Kairos' });
const enInstrucciones = await preparar({ idea: 'landing de ventas', instrucciones: 'es para mi otro producto' });
const enTitulo = await preparar({ idea: 'landing de ventas', titulo: 'Mi otro producto' });
const nombrado = await preparar({ idea: 'Créame una landing para mi otro producto, la Mentoría 1 a 1' });
const antes = log.lecturas;
const comun = await preparar({ idea: 'una landing para mi taller de cerámica que agende llamadas' });
const sinLeer = log.lecturas === antes;
catalogo = [{ id: 1, nombre: 'Mentoría 1 a 1' }, { id: 2, nombre: 'Curso de cerámica' }];
const conDos = await preparar({ idea: 'créame una landing para mi otro producto' });
console.log(JSON.stringify({ otro, kairos, enInstrucciones, enTitulo, nombrado, comun, sinLeer, conDos }));
`) as Record<string, { error?: string; faltan?: string[]; payload?: Record<string, unknown> }> & { sinLeer: boolean };
  assert.match(r.otro.error ?? '', /un solo producto \(«Mentoría 1 a 1»\)/, JSON.stringify(r.otro));
  assert.deepEqual(r.otro.faltan, ['producto']);
  assert.equal(r.otro.payload, undefined, 'preparó la landing igual');
  assert.equal(r.kairos.payload?.producto, 'Kairos', `la vuelta con una palabra no pasó: ${JSON.stringify(r.kairos)}`);
  assert.match(r.enInstrucciones.error ?? '', /el pedido es para OTRO/, 'el «otro producto» de las instrucciones se pasaba de largo');
  assert.match(r.enTitulo.error ?? '', /el pedido es para OTRO/, 'el del título también');
  assert.equal(r.nombrado.payload?.producto, 'Mentoría 1 a 1', `nombrar el del catálogo lo frenaba: ${JSON.stringify(r.nombrado)}`);
  assert.ok(r.comun.payload && !r.comun.error, JSON.stringify(r.comun));
  assert.equal(r.sinLeer, true, 'leyó el catálogo en un pedido que no habla de un producto');
  assert.match(r.conDos.error ?? '', /«Mentoría 1 a 1», «Curso de cerámica»/, `con dos productos creaba sin preguntar: ${JSON.stringify(r.conDos)}`);
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
  // El guardia del código mira todo lo que pide la persona, no sólo la idea.
  const run = sinComentarios(readFileSync(join(RAIZ, 'lib/api-mako/areas/landing-editor.run.ts'), 'utf8').replace(/\r\n/g, '\n'));
  assert.match(run, /const pedido = \['idea', 'instrucciones', 'titulo', 'audiencia'\]\.map\(\(k\) => str\(input, k\)\)/);
});
