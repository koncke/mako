// =============================================================================
// Los pedidos sueltos en el chat de MaKo de Automations (16/10/2026)
// =============================================================================
// Martín, textual (docs/diseno-mako-pedidos.md): «Si hablo con un "sub-chat" y en algún momento le digo algo como
// "Quiero eliminar la otra automatización que tengo porque podría unificarla..." Que sepa como hacerlo, y a que
// automatización se refiere incluso sin nombrarla, interpretandolo y de última preguntando...». El contrato del enganche
// lo dejó el Web Generator: ANTES de MaKo, POST /api/mako/pedidos; lo de la abierta sigue a MaKo, el resto son burbujas.
// Lo que persigue este archivo (con los ejemplos de Martín tal cual, por el resolver de verdad):
//   1. «la otra automatización» con UNA sola otra → ésa, con confirmación, y «Eliminar» archiva SÓLO ésa (nunca un cuerpo
//      sin ids: `archivar` sin ids archiva TODAS), con «Deshacer»;
//   2. con dos o más → pregunta cuál con las dos más recientes; nunca la abierta, nunca elige sola;
//   3. lo de la abierta sigue a MaKo; una landing es de OTRA tab (su link); «créame otra» propone Sí / Después y, con MaKo
//      trabajando, espera;
//   4. si la ruta falla, el mensaje entero va a MaKo, como antes;
//   5. el cableado: la ruta lista las automatizaciones con la puerta de su lista, y el chat pregunta ANTES de MaKo.
//
// ⚠️ PROBADO ROMPIÉNDOLO (16/10/2026, scratchpad romper-pedidos.mjs, con tests/automations-chat-mako.test.ts: base 13 de 13),
// una rotura por vez:
//   · `cuerpoEliminar` sin mirar el id → 12 / 1, cae el 1;
//   · `burbujasDe` sin cuidar la abierta → 12 / 1, cae el 2;
//   · MaKo recibiendo el mensaje entero → 11 / 2, caen el 5 y el del turno (automations-chat-mako);
//   · el chat sin preguntarle a la ruta, la ruta sin la puerta de la lista o con las archivadas, el cliente que tira →
//     12 / 1 cada uno, cae el 5;
//   · la creación que esperaba sin salir, o «Sí» sin esperar a MaKo → 12 / 1 cada uno, cae el 3.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { interpretarCon, type ContextoPedidos, type ObjetoChat, type OperacionChat } from '../lib/mako-pedidos';
import { REGISTRO, ordenarPorRelevancia, porId, visible, type Vista } from '../lib/api-mako/registro';
import { esAccion, esLectura, type OperacionDef } from '../lib/api-mako/tipos';
import {
  cuerpoPedidos, cuerpoEliminar, cuerpoRecuperar, interpretacionDe, textoActual, burbujasDe, vistaDeBurbuja, pulsar,
  trasEliminar, trasRecuperar, trasCrear, alTerminar, objetosDeAutomatizaciones, rutaDeAutomatizacion, TEXTOS,
} from '../app/automations/pedidos-chat';

const leer = (r: string): string => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const E1 = 'Quiero eliminar la otra automatización que tengo porque podría unificarla...';
const E2 = 'Feedback sobre lo actual... Y luego y también quiero que me crees otra landing para mi otro producto...';

const WS = 3;
const VISTA: Vista = { canal: 'app', alcance: 'proponer', ws: WS, rol: 'admin', tabs: null };
const OPS: OperacionChat[] = REGISTRO.filter((d) => (esAccion(d) || esLectura(d)) && visible(d, VISTA))
  .map((d) => ({ id: d.id, area: d.area, tipo: esLectura(d) ? 'lectura' : 'accion', titulo: d.titulo, descripcion: d.descripcion }));
const ordenar = (ops: readonly OperacionChat[], texto: string): OperacionChat[] => {
  const m = new Map(ops.map((o) => [o.id, o]));
  return ordenarPorRelevancia(ops.map((o) => porId(o.id)).filter((d): d is OperacionDef => !!d), texto).map((d) => m.get(d.id)!);
};

// Las automatizaciones de la lista, con los ids que tienen de verdad (enteros).
const ABIERTA: ObjetoChat = { id: '10', nombre: 'Bienvenida', tocadoAt: '2026-10-16T10:00:00Z' };
const OTRA: ObjetoChat = { id: '20', nombre: 'Seguimiento de agendados', tocadoAt: '2026-10-14T10:00:00Z' };
const TERCERA: ObjetoChat = { id: '30', nombre: 'Reactivar leads fríos', tocadoAt: '2026-10-15T10:00:00Z' };
const ctx = (objetos: ObjetoChat[]): ContextoPedidos => ({ tab: 'chatbot', actual: ABIERTA, objetos, operaciones: OPS, ordenar, ws: WS });

/** Lo que haría el chat: la ruta (el resolver de verdad, sin IA) → la respuesta validada → las burbujas. */
async function chat(texto: string, objetos: ObjetoChat[]) {
  const r = await interpretarCon(texto, ctx(objetos), null);
  const i = interpretacionDe({ ok: true, ...r }, texto);
  return { i, actual: textoActual(i), burbujas: burbujasDe(i, ABIERTA.id) };
}

test('1. «la otra automatización» con UNA sola otra: ésa, con confirmación, y «Eliminar» archiva SÓLO ésa, con «Deshacer»', async () => {
  const { actual, burbujas } = await chat(E1, [ABIERTA, OTRA]);
  assert.equal(actual, null, 'MaKo no tiene nada que hacer con la abierta');
  assert.equal(burbujas.length, 1);
  const b = burbujas[0];
  assert.equal(b.tipo, 'eliminar');
  assert.match(vistaDeBurbuja(b).texto, /^¿Elimino «Seguimiento de agendados»\? Deja de enviar y sale de la lista\.$/);
  // «Sí, eliminarla» manda a la API de la lista ESA y sólo esa.
  const r = pulsar(b, 'eliminar', ABIERTA.id);
  assert.deepEqual(r.efecto, { tipo: 'eliminar', objeto: OTRA, cuerpo: { action: 'archivar', ids: [20] } });
  assert.equal(vistaDeBurbuja(r.burbuja).nota, TEXTOS.eliminando);
  assert.equal(pulsar(r.burbuja, 'eliminar', ABIERTA.id).efecto, null, 'dos clics: un solo archivar');
  // Hecha: «Deshacer» la devuelve (pausada).
  const hecha = trasEliminar(r.burbuja, true);
  assert.deepEqual(vistaDeBurbuja(hecha).botones.map((x) => x.id), ['deshacer']);
  const d = pulsar(hecha, 'deshacer', ABIERTA.id);
  assert.deepEqual(d.efecto, { tipo: 'recuperar', objeto: OTRA, cuerpo: { action: 'desarchivar', secuenciaId: 20 } });
  assert.equal(vistaDeBurbuja(trasRecuperar(d.burbuja, true)).nota, TEXTOS.recuperada);
  // ⚠️ `archivar` SIN ids archiva TODAS: nunca se arma un cuerpo sin un id entero positivo.
  for (const id of ['', 'A', '0', '-3', '2.5', '1e3', '99999999999999999']) assert.equal(cuerpoEliminar({ id, nombre: 'x' }), null, `«${id}»`);
  assert.equal(cuerpoRecuperar({ id: 'A', nombre: 'x' }), null);
  // «No» la deja como estaba; un error vuelve a prender el botón.
  assert.equal(vistaDeBurbuja(pulsar(b, 'no', ABIERTA.id).burbuja).botones.every((x) => x.apagado), true);
  assert.equal(vistaDeBurbuja(trasEliminar(r.burbuja, false)).botones.find((x) => x.id === 'eliminar')!.apagado, false);
});

test('2. con dos o más otras pregunta cuál (las dos más recientes); nunca la abierta ni una elegida sola', async () => {
  const { burbujas } = await chat(E1, [ABIERTA, OTRA, TERCERA]);
  assert.equal(burbujas.length, 1);
  const b = burbujas[0];
  assert.equal(b.tipo, 'elegir');
  if (b.tipo !== 'elegir') return;
  assert.deepEqual(b.candidatos.map((c) => c.id).sort(), ['20', '30']);
  // Elegir una agrega su confirmación (no la elimina sin preguntar).
  const r = pulsar(b, 'elegir:30', ABIERTA.id);
  assert.equal(r.efecto?.tipo, 'agregar');
  assert.equal(r.efecto?.tipo === 'agregar' && r.efecto.burbuja.tipo, 'eliminar');
  // «Elimina ESTA automatización» no se archiva por acá: se dice dónde está «Eliminar».
  const abierta = burbujasDe({ pedidos: [{ sobre: 'otro', texto: 'elimina esta', verbo: 'borrar', objeto: ABIERTA, candidatos: [], operacion: null, confirmar: true, pregunta: null }], propuesta: null, origen: 'reglas' }, ABIERTA.id);
  assert.deepEqual(abierta, [{ tipo: 'abierta' }]);
  assert.equal(vistaDeBurbuja(abierta[0]).texto, TEXTOS.laAbierta);
  // Sin ninguna otra: pregunta el nombre.
  const { burbujas: sola } = await chat(E1, [ABIERTA]);
  assert.deepEqual(sola.map((x) => x.tipo === 'aviso' && x.texto), [TEXTOS.cual]);
  // Abrir otra: su lienzo por `?sec=`.
  assert.equal(rutaDeAutomatizacion(OTRA), '/automations?sec=20');
});

test('3. lo de la abierta sigue a MaKo; una landing es de otra tab; «créame otra» propone Sí / Después y espera a MaKo', async () => {
  const { actual, burbujas } = await chat(E2, [ABIERTA, OTRA]);
  assert.match(actual ?? '', /^Feedback sobre lo actual/, 'lo de la abierta va a MaKo');
  assert.equal(burbujas.length, 1);
  const ir = burbujas[0];
  assert.equal(ir.tipo, 'ir');
  if (ir.tipo !== 'ir') return;
  assert.match(ir.link, /^\/web-generator/, 'una landing se hace en el Web Generator');
  assert.deepEqual(vistaDeBurbuja(ir).links.map((l) => l.href), [ir.link]);
  // «Créame otra automatización»: con algo de la abierta, Sí / Después; «Sí» con MaKo trabajando espera.
  const crear = burbujasDe({ pedidos: [{ sobre: 'actual', texto: 'Cambia el saludo' }, { sobre: 'nuevo', texto: 'créame otra para los que no pagan', operacion: null }], propuesta: null, origen: 'reglas' }, ABIERTA.id)[0];
  assert.equal(crear.tipo, 'crear');
  assert.equal(vistaDeBurbuja(crear).texto, TEXTOS.propuesta);
  assert.deepEqual(vistaDeBurbuja(crear).botones.map((x) => x.id), ['si', 'despues']);
  const espera = pulsar(crear, 'si', ABIERTA.id, { trabajando: true });
  assert.equal(espera.efecto, null);
  assert.equal(vistaDeBurbuja(espera.burbuja).nota, TEXTOS.esperando);
  const fin = alTerminar(espera.burbuja);
  assert.deepEqual(fin.efecto, { tipo: 'crear', pedido: 'créame otra para los que no pagan' });
  assert.equal(vistaDeBurbuja(trasCrear(fin.burbuja, true)).nota, TEXTOS.creada);
  // «Después»: queda «Crear ahora».
  assert.deepEqual(vistaDeBurbuja(pulsar(crear, 'despues', ABIERTA.id).burbuja).botones.map((x) => x.id), ['crear-ahora']);
});

test('4. si la ruta falla o contesta otra cosa, el mensaje entero va a MaKo, como antes', () => {
  for (const r of [null, { ok: false, error: 'x' }, { ok: true, pedidos: [] }, { ok: true, pedidos: [{ sobre: 'raro' }] }]) {
    const i = interpretacionDe(r, '  Cambia el saludo  ');
    assert.equal(textoActual(i), 'Cambia el saludo');
    assert.deepEqual(burbujasDe(i, ABIERTA.id), []);
  }
  assert.deepEqual(cuerpoPedidos(' Cambia el saludo ', 10, ' Bienvenida '), { texto: 'Cambia el saludo', tab: 'chatbot', actualId: 10, actualNombre: 'Bienvenida' });
});

test('5. el cableado: la ruta lista con la puerta de la lista, y el chat pregunta ANTES de MaKo', () => {
  // Las filas de la lista como objetos: ids enteros, la última tocada como `tocadoAt`.
  assert.deepEqual(objetosDeAutomatizaciones([{ id: 7, nombre: 'Cobranza', updated_at: '2026-10-16T10:00:00Z' }, { id: 'x' }, { id: 0 }, { id: 8 }]),
    [{ id: '7', nombre: 'Cobranza', tocadoAt: '2026-10-16T10:00:00Z' }, { id: '8', nombre: '', tocadoAt: null }]);
  const ruta = leer('app/api/mako/pedidos/route.ts');
  const chatbot = ruta.slice(ruta.indexOf("if (tab === 'chatbot') {"), ruta.indexOf('return objetosDeAutomatizaciones('));
  assert.match(chatbot, /if \(rolWs !== 'admin' && rolWs !== 'setter'\) return \[\];/, 'la puerta de la lista de Automations: admin y setter');
  assert.match(chatbot, /\.from\('nutricion_secuencias'\)\.select\('id, nombre, updated_at'\)\s*\.is\('archivada_at', null\)\.order\('updated_at', \{ ascending: false \}\)/);
  // El chat: la ruta ANTES de MaKo, con su plazo, y sin respuesta útil, el mensaje entero (lo de siempre).
  const chat = leer('app/automations/ChatMako.tsx');
  const enviar = chat.slice(chat.indexOf('const enviarTexto = async'), chat.indexOf('/** Lo que pide un clic en una burbuja'));
  const iRuta = enviar.indexOf("const crudo = await pedirPedidos(cuerpoPedidos(t, p.secuenciaId, p.nombre ?? ''));");
  const iTurno = enviar.indexOf('return turno(t, null, origen, actual');
  assert.ok(iRuta > 0 && iTurno > iRuta, 'el chat tiene que preguntar a la ruta ANTES de mandarle a MaKo');
  assert.match(enviar, /const i = interpretacionDe\(crudo, t\);/);
  // La ruta con su plazo, y nunca tira: sin respuesta, null (y el mensaje entero va a MaKo).
  const cliente = leer('app/automations/pedidos-cliente.ts');
  assert.match(cliente, /fetch\('\/api\/mako\/pedidos', \{\n\s*method: 'POST',[^\n]*signal: AbortSignal\.timeout\(ms\),/);
  assert.match(cliente, /\} catch \{\n\s*return null;\n\s*\}/);
  assert.match(chat, /: \{ pedido: pedido \?\? dicho, respuestas: \[\] as RespuestaMako\[\] \};/, 'MaKo recibe sólo lo de la abierta');
  // «Crear otra» entra por la puerta de «Pídeselo a MaKo», y la lista se relee al eliminar.
  assert.match(leer('app/automations/ChatAgentApp.tsx'), /onCrearOtra=\{pedirAMako\}/);
  assert.match(leer('app/automations/SimuladorWhatsApp.tsx'), /onCrearOtra=\{onCrearOtra\} onListaCambio=\{onReload\}/);
  assert.match(leer('app/automations/SecuenciaPerfil.tsx'), /nombre=\{secuencia\.nombre \?\? ''\} onCrearOtra=\{onCrearOtra\} onListaCambio=\{onListaCambio\}/);
});
