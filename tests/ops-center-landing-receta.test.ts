// =============================================================================
// Ops Center 1.15 — la receta de landing: «créame una landing para mi otro producto» con UN producto pregunta cuál
// =============================================================================
// Martín (20/10/2026): «comienza a implementar directamente toda mi idea de que Ops Center sea lo principal en MaKo...
// quiero que en Ops Center se pueda hacer todo, editar videos, crear webs, etc...». La pieza 1.15 de
// docs/ops-center-principal.md: con un solo producto en el catálogo, «mi otro producto» no es ése, y crear igual armaba
// la landing del que hay (el esquema sale del perfil del negocio). Dos capas:
//   · la receta (lib/doer-recetas.ts, RECETA_LANDING): MaKo pregunta antes de proponer, y viaja sólo con las
//     herramientas que crean una landing;
//   · el código (lib/mako-pedidos.ts, `faltaElOtroProducto`, en el `preparar` de generar_landing_con_ia): aunque el
//     modelo proponga igual, no se prepara nada y el error que vuelve es la pregunta. Se EJECUTA con el catálogo de
//     mentira, en un proceso hijo con los módulos del server.
//
// PROBADO ROMPIÉNDOLO (20/10/2026; arnés que rompe UNA cosa, corre este archivo, restaura y compara el sha256; las 4
// restauradas con el mismo hash; base 4 / 0). Pasan / fallan:
//   R1  faltaElOtroProducto deja pasar con un producto (devuelve null siempre)         → 2 / 2
//   R2  el `preparar` sin el guardia                                                    → 2 / 2
//   R3  la receta viaja siempre (sin su condición)                                      → 3 / 1
//   R4  el guardia no mira si el pedido ya cuenta cuál es (cualquier «otro producto»)   → 2 / 2
//
// Correr: node --import tsx --test tests/ops-center-landing-receta.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { faltaElOtroProducto, pideOtroProducto, productoDelPedido } from '../lib/mako-pedidos';
import { recetasDelTurno } from '../lib/doer-recetas';

const RAIZ = join(import.meta.dirname, '..');
const url = (rel: string): string => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);

function hijo(codigo: string): Record<string, unknown> {
  const out = execFileSync(process.execPath, [
    '--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', '--input-type=module', '-e', codigo,
  ], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const lineas = out.trim().split('\n');
  return JSON.parse(lineas[lineas.length - 1]!) as Record<string, unknown>;
}

const UNO = [{ id: '1', nombre: 'Mentoría 1 a 1' }];
const DOS = [...UNO, { id: '2', nombre: 'Curso de cerámica' }];

test('con un producto, «mi otro producto» es una pregunta en texto libre; con la respuesta en el pedido, pasa', () => {
  // En tuteo y en voseo (lo escribe la persona): el verbo de pedir con su pronombre no cuenta como «contar cuál es».
  for (const t of ['créame una landing para mi otro producto', 'Creame una web para mi otro producto por favor', 'hazme otra landing de mis otros productos',
    'haceme una landing para mi otro producto', 'armame una web de mi otro producto', 'podés crear una landing para mi otro producto']) {
    const f = faltaElOtroProducto(t, UNO);
    assert.ok(f, `«${t}» pasó y se iba a armar sobre el producto que hay`);
    assert.match(f!, /un solo producto \(«Mentoría 1 a 1»\)/);
    assert.match(f!, /pregúntale a la persona cuál es ese otro producto/);
  }
  // Sin productos: también se pregunta, sin nombrar uno que no existe.
  assert.match(faltaElOtroProducto('créame una landing para mi otro producto', []) ?? '', /todavía no tiene productos/);
  // Con la respuesta adentro (la vuelta después de preguntar), pasa.
  assert.equal(faltaElOtroProducto('landing para mi otro producto: un curso online de cerámica', UNO), null);
  assert.equal(faltaElOtroProducto('Landing para el curso de cerámica online (mi otro producto)', UNO), null);
  // Lo que no es ese caso: sin «otro producto», o con varios (ahí `productoDelPedido` pregunta con los nombres).
  assert.equal(faltaElOtroProducto('créame otra landing', UNO), null);
  assert.equal(faltaElOtroProducto('hazme una landing de mi producto', UNO), null);
  assert.equal(faltaElOtroProducto('créame una landing para mi otro producto', DOS), null);
  assert.deepEqual(productoDelPedido('créame una landing para mi otro producto', DOS)?.candidatos.map((c) => c.nombre), ['Mentoría 1 a 1', 'Curso de cerámica']);
  // Una sola regla de «otro producto» para las dos.
  assert.equal(productoDelPedido('créame una landing para mi otro producto', UNO), null);
  assert.equal(pideOtroProducto('para MI OTRO PRODUCTO'), true);
});

test('generar_landing_con_ia no prepara nada con «mi otro producto» y uno solo: vuelve la pregunta (se ejecuta)', () => {
  const r = hijo(`
import { mock } from 'node:test';
const real = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));
const log = { lecturas: 0 };
let catalogo = [{ id: 1, nombre: 'Mentoría 1 a 1' }];
mock.module(${url('lib/productos.ts')}, { exports: { ...real(await import(${url('lib/productos.ts')})), listProductos: async () => { log.lecturas++; return catalogo; } } });
mock.module(${url('lib/editor-landing/server.ts')}, { exports: { ...real(await import(${url('lib/editor-landing/server.ts')})), temas: async () => ({ ok: true, temas: [] }) } });
const { RUNNERS_EDITOR } = await import(${url('lib/api-mako/areas/landing-editor.run.ts')});
const ctx = { ws: 3, canal: 'app', canalKey: 'app:prueba', alcance: 'proponer', rol: 'admin' };
const preparar = (idea) => RUNNERS_EDITOR.generar_landing_con_ia.preparar({ idea }, ctx);
const otro = await preparar('créame una landing para mi otro producto');
const contado = await preparar('landing para mi otro producto: un curso online de cerámica para principiantes');
const lecturasAntes = log.lecturas;
const comun = await preparar('una landing para mi taller de cerámica que agende llamadas');
const sinLeer = log.lecturas === lecturasAntes;
catalogo = [{ id: 1, nombre: 'Mentoría 1 a 1' }, { id: 2, nombre: 'Curso' }];
const conDos = await preparar('créame una landing para mi otro producto');
console.log(JSON.stringify({ otro, contado, comun, sinLeer, conDos }));
`) as Record<string, { error?: string; payload?: unknown; resumen?: string }> & { sinLeer: boolean };
  assert.match(r.otro.error ?? '', /un solo producto \(«Mentoría 1 a 1»\)[\s\S]*pregúntale a la persona/, JSON.stringify(r.otro));
  assert.equal(r.otro.payload, undefined, 'preparó la landing igual');
  assert.ok(r.contado.payload && !r.contado.error, `con el producto contado no pasó: ${JSON.stringify(r.contado)}`);
  assert.ok(r.comun.payload && !r.comun.error, JSON.stringify(r.comun));
  assert.equal(r.sinLeer, true, 'leyó el catálogo en un pedido que no habla de «otro producto»');
  assert.ok(r.conDos.payload, 'con dos productos la pregunta es la de productoDelPedido, no ésta');
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
  // Lo que se paga en cada pedido del turno: corta.
  assert.ok(r.length < 900, `la receta de landing pesa ${r.length}`);
  // No nombra herramientas: no siempre viajan las que nombraría.
  assert.doesNotMatch(r, /\b[a-z]+_[a-z_]+\b/);
});

test('el guardia del preparar lee el catálogo sólo con «otro producto», y si no lo puede leer sigue como antes', async () => {
  const { readFileSync } = await import('node:fs');
  const run = readFileSync(join(RAIZ, 'lib/api-mako/areas/landing-editor.run.ts'), 'utf8').replace(/\r\n/g, '\n');
  const g = run.slice(run.indexOf('  generar_landing_con_ia: {'), run.indexOf('    ejecutar:', run.indexOf('  generar_landing_con_ia: {')));
  assert.match(g, /if \(pideOtroProducto\(idea\)\) \{\s*(?:\/\/[^\n]*\n\s*)*const productos = await listProductos\(true\)[^\n]*\.catch\(\(\) => null\);\s*const falta = productos \? faltaElOtroProducto\(idea, productos\) : null;\s*if \(falta\) return \{ error: falta \};/);
});
