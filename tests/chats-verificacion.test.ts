// =============================================================================
// Chats: lo que encontró la verificación antes de publicar (15/10/2026) y no puede volver
// =============================================================================
// Tres agentes revisaron, sólo lectura, la bandeja unificada antes de su primer deploy. Lo que le rompía a un
// cliente quedó arreglado y fijado acá:
//   1. El hilo armaba el destino de WhatsApp con los 10 dígitos de la clave (o el teléfono del CRM sin código de
//      país): la respuesta salía a «4741234567» → Evolution la rechazaba o le llegaba a un desconocido
//      (+47 41234567 es Noruega). Ahora usa el chat_jid y el teléfono REALES del espejo (`contactoDeFilas`).
//   2. Los chats OCULTOS (personales) se veían en el buscador y en el hilo, y la API de MaKo los leía.
//   3. La etapa se leía y se escribía con el funnel DEFAULT para leads de otro producto (st0 es otra etapa en
//      cada funnel): ahora se lee con el de su casa, y la ruta no mueve a un lead de otro producto.
//   4. «Editar» un borrador que otro ya mandaba: salía dos veces (el descarte no miraba el estado).
//   5. Un envío cortado por tiempo se daba por «no salió» y el texto volvía al campo: Enter = dos mensajes.
//
// Probado ROMPIÉNDOLO (15/10/2026), cada rotura restaurada después (pasan / fallan, base 6 / 0):
//   · contactoDeFilas devuelve los 10 dígitos en vez del teléfono de la fila           → 5 / 1
//   · hiloDeChat sin el filtro de ocultos (`ocultos.has(`)                               → 5 / 1
//   · la ruta de etapa sin la guarda del funnel de la casa (`necesitaFicha: true` de casa) → 5 / 1
//   · descartarBorrador sin `.eq('estado', 'pendiente')`                                 → 5 / 1
//   · postJson sin `incierto: true` en el catch                                          → 5 / 1
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contactoDeFilas, type FilaContactoWa } from '../lib/chats-reglas';

const RAIZ = join(__dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('1. el destino de WhatsApp es el teléfono REAL de la fila, con código de país, y el nombre es el del contacto', () => {
  const filas: FilaContactoWa[] = [
    { chat_jid: '5214741234567@s.whatsapp.net', telefono: '5214741234567', push_name: 'Mi negocio', from_me: true },
    { chat_jid: '5214741234567@s.whatsapp.net', telefono: '5214741234567', push_name: 'Você', from_me: false },
    { chat_jid: '5214741234567@s.whatsapp.net', telefono: '5214741234567', push_name: 'Lucía Herrera', from_me: false },
  ];
  assert.deepEqual(contactoDeFilas(filas, '4741234567'), { jid: '5214741234567@s.whatsapp.net', tel: '5214741234567', nombre: 'Lucía Herrera' });
  // Otro número que sólo CONTIENE esos dígitos en el medio no es el contacto.
  assert.equal(contactoDeFilas([{ chat_jid: 'x', telefono: '4741234567999', push_name: null, from_me: false }], '4741234567'), null);
  assert.equal(contactoDeFilas([], '4741234567'), null);
  // Y el hilo lo usa ANTES de pedir los mensajes y armar la identidad.
  const chats = sinComentarios(leer('lib/chats.ts'));
  const iHilo = chats.indexOf('export async function hiloDeChat');
  const cuerpo = chats.slice(iHilo);
  assert.ok(cuerpo.indexOf('contactoWhatsappReal(') > 0 && cuerpo.indexOf('contactoWhatsappReal(') < cuerpo.indexOf('getMensajesDeChat('),
    'el hilo volvió a armar el destino desde la clave');
});

test('2. un chat OCULTO no se busca, no se lee en el hilo, y la API de MaKo no lo lee', () => {
  const chats = sinComentarios(leer('lib/chats.ts'));
  const buscar = chats.slice(chats.indexOf('async function buscarChats'), chats.indexOf('export async function hiloDeChat'));
  const hilo = chats.slice(chats.indexOf('export async function hiloDeChat'));
  assert.match(buscar, /telefonosOcultos\(\)/, 'el buscador no mira los ocultos');
  assert.match(buscar, /ocultos\?\.has\(ultimos10\(tel\)\)/, 'el buscador arma la identidad de un teléfono oculto');
  assert.match(hilo, /telefonosOcultos\(\)/, 'el hilo no mira los ocultos');
  assert.match(hilo, /ocultos\.has\(/, 'el hilo lee los mensajes de un teléfono oculto');
  const api = sinComentarios(leer('lib/api-mako/areas/chats.run.ts'));
  assert.match(api, /if \(h\.ocultoWhatsapp\) return errorLectura\('Ese chat está oculto: MaKo no lo lee\.'\)/, 'hilo_chat de MaKo lee un chat oculto');
});

test('3. la etapa se lee con el funnel de la casa del lead, y la ruta no mueve a un lead de otro producto', () => {
  const chats = sinComentarios(leer('lib/chats.ts'));
  assert.match(chats, /const COLS_LEAD_CHAT = '[^']*\bfunnel_id\b/, 'sin funnel_id no hay forma de saber la casa');
  assert.match(chats, /async function embudosDeLeads\(/);
  assert.equal((chats.match(/leadDelChat\([a-zA-Z]+, embudo\.stages/g) ?? []).length, 0, 'algún lead se sigue leyendo con el funnel default');
  const ruta = sinComentarios(leer('app/api/chats/etapa/route.ts'));
  assert.match(ruta, /casa != null && casa !== def/, 'la ruta mueve a un lead de otro producto con las claves del default');
  assert.match(ruta, /necesitaFicha: true, error: 'Cámbiala en la ficha\.'/);
});

test('4. descartar un borrador mira que siga pendiente, y «Editar» descarta ANTES de poner el texto', () => {
  const envio = sinComentarios(leer('lib/evolution-envio.ts'));
  const desc = envio.slice(envio.indexOf('export async function descartarBorrador('));
  assert.match(desc.slice(0, 400), /\.eq\('estado', 'pendiente'\)/, 'el descarte no mira el estado: un borrador que ya sale se «descarta»');
  const comp = sinComentarios(leer('app/chats/Composer.tsx'));
  const editar = comp.slice(comp.indexOf('async function editarBorrador'));
  assert.ok(editar.indexOf("resolverBorrador('descartar'") < editar.indexOf('setTexto('), 'Editar pone el texto antes de confirmar el descarte');
});

test('5. un envío cortado por tiempo es «no sé si salió»: no vuelve al campo', () => {
  const piezas = sinComentarios(leer('app/chats/ventana-piezas.tsx'));
  const post = piezas.slice(piezas.indexOf('export async function postJson'));
  assert.match(post.slice(0, 1200), /catch \(e\) \{\s*return \{ ok: false, incierto: true/, 'un corte de red o de tiempo se lee como «no salió»');
  const comp = sinComentarios(leer('app/chats/Composer.tsx'));
  assert.equal((comp.match(/if \(j\.incierto\) \{ incierto\(tmp\); return; \}/g) ?? []).length, 2, 'WhatsApp y social tratan el incierto');
  const zernio = sinComentarios(leer('lib/canal-zernio.ts'));
  assert.match(zernio, /input\.idempotencia/, 'la clave de idempotencia vuelve a ser nueva en cada pedido');
});

test('la convivencia: /chats y /whatsapp son la misma pestaña del teléfono, y un lead abre SU chat', async () => {
  const { rutaMovil, rutaEscritorio } = await import('../lib/movil-rutas');
  assert.equal(rutaMovil('/chats'), '/m/chats');
  assert.equal(rutaMovil('/whatsapp'), '/m/chats');
  assert.equal(rutaMovil('/chats?lead=7'), '/m/crm/7/chat');
  assert.equal(rutaEscritorio('/m/chats'), '/chats');
});
