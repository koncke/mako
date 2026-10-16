// =============================================================================
// «Editar con MaKo» entiende el pedido: lo de la hoja abierta a la edición, lo demás como burbujas (app/dashboard/pedidos-hoja.ts)
// =============================================================================
// Martín, 16/10/2026 (textual en docs/diseno-mako-pedidos.md): «estoy creando... un dashboard... y le digo algo como
// "Feedback sobre lo actual... Y luego <y también quiero que me crees otra...>" ahí debe saber interpretarlo... e incluso
// proponerle "¿Quieres que primero terminemos esto y luego creamos la otra?"... Es más incluso si se está trabajando en
// una tab y se envía un mensaje totalmente diferente, relacionado a otra tab, que el chat le deje ahí en el chat el link».
//
// Los ejemplos de Martín, llevados al Dashboard y a General, pasan por la regla pura REAL (`interpretarCon` de
// lib/mako-pedidos.ts, sin IA, con las operaciones del registro) y después por las burbujas del panel. Y el cableado: el
// panel pregunta a la ruta ANTES de editar, edita sólo lo de esta hoja, y crear, abrir y archivar son del editor.
//
// PROBADO ROMPIÉNDOLO, cada rotura restaurada de memoria (base 10/0):
//   · sin la propuesta de la ruta («¿Terminamos esto…?»)        -> 9 / 1
//   · un botón usado repite su efecto                          -> 9 / 1
//   · elegir la hoja la archiva sin confirmar                  -> 9 / 1
//   · la hoja abierta se archiva desde el chat                 -> 9 / 1
//   · General sin sus partes (las tareas se iban al Plan)      -> 9 / 1
//   · a la edición va el mensaje entero                        -> 9 / 1
//   · el panel no le pregunta a la ruta                        -> 9 / 1
//   · se crea aunque MaKo no armó nada                         -> 9 / 1
//   · archivar borra para siempre (borrarArchivada)            -> 9 / 1
//   · la ruta lista las hojas de General sin la puerta         -> 9 / 1
//
// Correr: npx tsx --test tests/dashboard-pedidos-chat.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { interpretarCon, resolverPedidos, type ContextoPedidos, type Interpretacion } from '../lib/mako-pedidos';
import { REGISTRO, ordenarPorRelevancia } from '../lib/api-mako/registro';
import {
  TAB_DEL_INFORME, TEXTOS_HOJA, burbujasDeHoja, interpretacionDe, pulsarHoja, textoActual, trasCrear, vistaDeBurbujaHoja,
  type BurbujaHoja,
} from '../app/dashboard/pedidos-hoja';

const RAIZ = join(__dirname, '..');
// Líneas `//` primero y bloques después (docs/hallazgos-ia.md, 16/10/2026).
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (...ruta: string[]) => sinComentarios(readFileSync(join(RAIZ, ...ruta), 'utf8'));

const operaciones = REGISTRO.map((d) => ({ id: d.id, area: d.area, tipo: d.tipo, titulo: d.titulo, descripcion: d.descripcion })) as ContextoPedidos['operaciones'];
const ordenar = ordenarPorRelevancia as unknown as ContextoPedidos['ordenar'];
const HOJAS = [{ id: 'h1', nombre: 'Marketing' }, { id: 'h2', nombre: 'Comercial' }, { id: 'h3', nombre: 'Cobranza' }];
const DASH: ContextoPedidos = { tab: TAB_DEL_INFORME.dashboard, actual: HOJAS[0], objetos: HOJAS, operaciones, ws: 9, ordenar };
const GEN: ContextoPedidos = { tab: TAB_DEL_INFORME.general, actual: { id: 'g1', nombre: 'General' }, objetos: [{ id: 'g1', nombre: 'General' }, { id: 'g2', nombre: 'Bienvenida' }], operaciones, ws: 9, ordenar };
const enDash = async (texto: string) => { const i = await interpretarCon(texto, DASH); return { i, actual: textoActual(i), b: burbujasDeHoja(i, 'h1') }; };

// ── Los ejemplos de Martín ───────────────────────────────────────────────────────────────────

test('«feedback sobre lo actual, y también créame otra hoja»: lo de esta hoja a la edición, y «¿terminamos esto y después…?»', async () => {
  const { actual, b } = await enDash('Agrega el CPL por semana y también créame otra hoja de cobranza');
  assert.equal(actual, 'Agrega el CPL por semana');
  assert.equal(b.length, 1);
  assert.equal(b[0].tipo, 'crear');
  const v = vistaDeBurbujaHoja(b[0]);
  assert.match(v.texto, /^¿Terminamos esto y después/);
  assert.deepEqual(v.botones.map((x) => x.id), ['si', 'despues']);
  const si = pulsarHoja(b[0], 'si');
  assert.deepEqual(si.efecto, { tipo: 'crear', pedido: 'créame otra hoja de cobranza' });
  assert.equal(pulsarHoja(si.burbuja, 'si').efecto, null, 'un botón usado no repite');
  assert.equal(vistaDeBurbujaHoja(trasCrear(si.burbuja, true)).texto, TEXTOS_HOJA.creada);
  const despues = pulsarHoja(b[0], 'despues');
  assert.equal(despues.efecto, null);
  assert.deepEqual(vistaDeBurbujaHoja(despues.burbuja).botones.map((x) => x.id), ['crear'], '«Crear ahora» queda');
});

test('«un mensaje de otra tab»: el link a donde corresponde, y nada se ejecuta por acá', async () => {
  const { actual, b } = await enDash('Agrega los leads por semana y además agéndame una reunión con Juan el viernes');
  assert.ok(actual && actual.startsWith('Agrega los leads por semana'));
  assert.equal(b[0].tipo, 'ir');
  const v = vistaDeBurbujaHoja(b[0]);
  assert.ok(v.link && /^\/crm\?ws=9/.test(v.link.href), 'el link de la ruta, con el ?ws=');
  assert.deepEqual(v.botones, []);
});

test('«la otra hoja»: con dos posibles, pregunta cuál; borrar SIEMPRE confirma y archiva', async () => {
  const { actual, b } = await enDash('Borra la otra hoja');
  assert.equal(actual, null);
  assert.equal(b[0].tipo, 'elegir');
  const elegir = vistaDeBurbujaHoja(b[0]);
  assert.match(elegir.texto, /Comercial.*Cobranza/);
  const elegida = pulsarHoja(b[0], 'elegir:h2');
  assert.equal(elegida.efecto, null, 'elegir no borra: todavía confirma');
  assert.match(vistaDeBurbujaHoja(elegida.burbuja).texto, /^¿Archivo «Comercial»\?/);
  assert.deepEqual(pulsarHoja(elegida.burbuja, 'archivar').efecto, { tipo: 'archivar', id: 'h2' });
  assert.equal(pulsarHoja(elegida.burbuja, 'no').efecto, null);
});

test('la hoja ABIERTA nunca se archiva desde el chat: se dice dónde', () => {
  const i: Interpretacion = { pedidos: [{ sobre: 'otro', texto: 'Borra esta hoja', verbo: 'borrar', objeto: HOJAS[0], candidatos: [], operacion: 'borrar_hoja_dashboard', confirmar: true, pregunta: '¿Borro «Marketing»?' }], propuesta: null, origen: 'reglas' };
  const b = burbujasDeHoja(i, 'h1');
  assert.deepEqual(b, [{ tipo: 'texto', texto: TEXTOS_HOJA.estaHoja }]);
});

test('abrir otra hoja que nombra: un botón, y el efecto es del editor', () => {
  const i: Interpretacion = { pedidos: [{ sobre: 'otro', texto: 'Muéstrame la hoja Cobranza', verbo: 'ver', objeto: HOJAS[2], candidatos: [], operacion: null, confirmar: false, pregunta: null }], propuesta: null, origen: 'reglas' };
  const [b] = burbujasDeHoja(i, 'h1');
  assert.deepEqual(pulsarHoja(b as BurbujaHoja, 'abrir').efecto, { tipo: 'abrir', id: 'h3' });
});

test('lo de esta hoja sola no da burbujas (cero regresión), y una respuesta que no sirve es «el mensaje entero»', async () => {
  for (const t of ['Agrega el CPL por semana', 'Quita el gráfico de leads', 'Cambia el título de la hoja a Pauta']) {
    const { actual, b } = await enDash(t);
    assert.equal(actual, t);
    assert.deepEqual(b, []);
  }
  const i = interpretacionDe({ ok: false, error: 'tardó' }, 'agrega algo');
  assert.equal(textoActual(i), 'agrega algo');
  assert.deepEqual(burbujasDeHoja(i, 'h1'), []);
});

test('General: sus bloques son de la hoja aunque la palabra sea de otra tab, también si la IA la etiqueta así', async () => {
  for (const t of ['Agrega mis tareas prioritarias', 'Agrega Mi día', 'Pon arriba mis KPIs y quita el semáforo', 'Agrega un gráfico de leads por semana']) {
    const i = await interpretarCon(t, GEN);
    assert.equal(textoActual(i), t, t);
  }
  // La IA dijo «es del Plan» (`tareas` es palabra del área `plan`): en General es un bloque de la hoja abierta.
  const i = resolverPedidos([{ texto: 'Agrega mis tareas prioritarias', verbo: 'crear', area: 'plan', referencia: 'mis tareas prioritarias', etiqueta: 'ia' }], GEN, { origen: 'ia', texto: 'Agrega mis tareas prioritarias' });
  assert.equal(textoActual(i), 'Agrega mis tareas prioritarias');
});

// ── El cableado ──────────────────────────────────────────────────────────────────────────────

test('el panel: entiende el pedido ANTES de editar, y a la edición va sólo lo de esta hoja', () => {
  const p = leer('app', 'dashboard', 'PanelEditarMako.tsx');
  const i = p.indexOf('await pedirPedidos({ texto: mensaje, tab: TAB_DEL_INFORME[informe], actualId: enviada.id, actualNombre: enviada.nombre }, { ms: PLAZO_PEDIDOS_MS, signal: c.signal });');
  assert.ok(i > 0 && i < p.indexOf("fetch('/api/graficos/editar'"), 'la ruta de los pedidos va antes de la edición');
  assert.match(p, /body: JSON\.stringify\(\{ hoja: enviada, pedido: deEstaHoja, historial, informe \}\)/);
  assert.ok(p.indexOf("decir({ k: 'pedido'") > p.indexOf("fetch('/api/graficos/editar'"), 'las burbujas, después de lo de esta hoja');
  assert.match(p, /fetch\('\/api\/graficos\/ia', \{[\s\S]*?body: JSON\.stringify\(\{ pedido: efecto\.pedido\.slice\(0, TOPE_PEDIDO_IA\), informe \}\)/);
  assert.match(p, /if \(creada\) onCrearHoja\(creada\);/);
});

test('el editor: crear, abrir y archivar son los suyos (crearHoja, irAHoja, eliminarHoja)', () => {
  assert.match(leer('app', 'dashboard', 'EditorInforme.tsx'), /onCrearHoja=\{crearHoja\} onAbrirHoja=\{irAHoja\} onArchivarHoja=\{eliminarHoja\}/);
});

test('la ruta: las hojas de General de quien mira, con la puerta de su pantalla', () => {
  const r = leer('app', 'api', 'mako', 'pedidos', 'route.ts');
  const g = r.slice(r.indexOf("if (tab === 'general') {"), r.indexOf("if (tab === 'general') {") + 500);
  assert.match(g, /if \(rol !== 'admin' \|\| !tabEnCapa\('general', await getCapaActual\(\)\.catch\(\(\) => null\)\)\) return \[\];/);
  assert.match(g, /const l = await leerInformeGeneral\(\);\s*if \(l\.estado !== 'propio'\) return \[\];/);
});
