// =============================================================================
// Settings › Notificaciones, copiada de Linear (25/10/2026)
// =============================================================================
// Lo que una captura no muestra: qué dice cada canal a la derecha de su fila (app/perfil/notificaciones-reglas.ts), que
// «No molestar» calla los avisos al celular en el horario y la zona de la persona (lib/notif-catalogo.ts → enSilencio) y que
// el envío de verdad lo mira (lib/push.ts), y que el `?canal=` de la URL no abre cualquier cosa.
//
// Correr: node --import tsx --test tests/settings-notificaciones.test.ts
// Probado ROMPIÉNDOLO (25/10/2026): los números, en ROTURAS al final.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canalDeUrl, ciudadDeZona, resumenApp, resumenCelular, resumenDestinatarios } from '../app/perfil/notificaciones-reglas';
import { enSilencio, normalizarPush, normalizarSilencio, type NotifInApp } from '../lib/notif-catalogo';

const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const app = (popup: boolean, sonido: boolean): NotifInApp => ({ popup, sonido, items: {} });

test('el canal de la URL: sólo los cuatro; cualquier otra cosa es la lista', () => {
  for (const c of ['app', 'celular', 'whatsapp', 'email']) assert.equal(canalDeUrl(c), c);
  for (const c of [null, undefined, '', 'admin', '../x', ['app']]) assert.equal(canalDeUrl(c), null);
});

test('lo que dice cada canal a la derecha, y su punto', () => {
  assert.deepEqual(resumenApp(app(false, true)), { texto: 'Apagado', tono: 'off' });
  assert.deepEqual(resumenApp(app(true, true)), { texto: 'Pop-up y sonido', tono: 'good' });
  assert.deepEqual(resumenApp(app(true, false)), { texto: 'Pop-up sin sonido', tono: 'good' });

  const ids = ['a', 'b', 'c'];
  assert.deepEqual(resumenCelular({ activo: false, items: {} }, 2, ids), { texto: 'Apagado', tono: 'off' });
  // Prendido sin un solo teléfono: no llega nada, y eso se dice en ámbar (la fila lleva a instalar la app).
  assert.deepEqual(resumenCelular({ activo: true, items: {} }, 0, ids), { texto: 'Sin teléfono', tono: 'warn' });
  // Sin saber cuántos (la lectura falló), se dice lo que se sabe: qué avisos.
  assert.deepEqual(resumenCelular({ activo: true, items: {} }, null, ids), { texto: 'Todos los avisos', tono: 'good' });
  assert.deepEqual(resumenCelular({ activo: true, items: { b: false } }, 1, ids), { texto: '2 de 3 avisos', tono: 'good' });
  assert.deepEqual(resumenCelular({ activo: true, items: { a: false, b: false, c: false } }, 1, ids), { texto: 'Ningún aviso', tono: 'off' });
  // Un apagado de un aviso que ya no se ofrece no cuenta.
  assert.deepEqual(resumenCelular({ activo: true, items: { viejo: false } }, 1, ids), { texto: 'Todos los avisos', tono: 'good' });

  assert.deepEqual(resumenDestinatarios(0, 'whatsapp'), { texto: 'Sin números', tono: 'warn' });
  assert.deepEqual(resumenDestinatarios(1, 'whatsapp'), { texto: '1 número', tono: 'good' });
  assert.deepEqual(resumenDestinatarios(3, 'email'), { texto: '3 direcciones', tono: 'good' });
  assert.equal(ciudadDeZona('America/Argentina/Buenos_Aires'), 'Buenos Aires');
});

test('«No molestar»: el horario se mide en la zona de la persona, y cruza la medianoche', () => {
  // 25/10/2026 05:30 UTC = 22:30 del 24 en Tijuana (UTC-7) = 02:30 en Buenos Aires (UTC-3).
  const t = new Date('2026-10-25T05:30:00Z');
  const noche = { silencio: { desde: 22, hasta: 8 } };
  assert.equal(enSilencio(noche, 'America/Tijuana', t), true, '22:30 está entre las 22 y las 8');
  assert.equal(enSilencio(noche, 'America/Argentina/Buenos_Aires', t), true, '02:30 también (después de medianoche)');
  assert.equal(enSilencio(noche, 'Asia/Tokyo', t), false, '14:30 en Tokio: fuera del horario');
});

test('«No molestar»: los bordes, y lo que no es un horario no calla nada', () => {
  const a = (iso: string) => new Date(iso);
  // Tijuana es UTC-7 en octubre (horario de verano del Pacífico hasta el 1/11).
  const tarde = { silencio: { desde: 13, hasta: 15.5 } };
  assert.equal(enSilencio(tarde, 'America/Tijuana', a('2026-10-25T20:00:00Z')), true, '13:00 entra');
  assert.equal(enSilencio(tarde, 'America/Tijuana', a('2026-10-25T22:29:00Z')), true, '15:29 entra');
  assert.equal(enSilencio(tarde, 'America/Tijuana', a('2026-10-25T22:30:00Z')), false, '15:30 ya no');
  assert.equal(enSilencio({}, 'America/Tijuana', a('2026-10-25T20:00:00Z')), false, 'sin silencio, nunca');
  assert.equal(enSilencio({ silencio: null }, 'America/Tijuana'), false);
  // Una zona que no existe no rompe el envío: se mide en la de MaKo por defecto.
  assert.equal(enSilencio(tarde, 'Marte/Olympus', a('2026-10-25T20:00:00Z')), true);
  assert.equal(normalizarSilencio({ desde: 8, hasta: 8 }), null, 'una ventana de cero horas no es un silencio');
  assert.equal(normalizarSilencio({ desde: 7.25, hasta: 9 }), null, 'sólo medias horas');
  assert.equal(normalizarSilencio({ desde: '22', hasta: 8 }), null);
  assert.equal(normalizarSilencio({ desde: 24, hasta: 8 }), null);
});

test('el silencio se guarda con las preferencias del celular y sobrevive a un cambio de otro interruptor', () => {
  const p = normalizarPush({ activo: true, items: {}, silencio: { desde: 22, hasta: 8 } }, 'admin');
  assert.deepEqual(p.silencio, { desde: 22, hasta: 8 });
  // El teléfono guarda `{ ...prefs, activo }`: el silencio viaja con el resto.
  assert.deepEqual(normalizarPush({ ...p, activo: false }, 'admin').silencio, { desde: 22, hasta: 8 });
  assert.equal('silencio' in normalizarPush({ activo: true, silencio: { desde: 3, hasta: 3 } }, 'admin'), false, 'basura no se guarda');
});

test('el envío de verdad respeta «No molestar», con la zona de la fila de cada persona', () => {
  const push = sinComentarios(leer('lib/push.ts'));
  assert.match(push, /return quierePush\(prefs, e\.tipo\) && !enSilencio\(prefs, typeof perfil\.timezone === 'string' \? perfil\.timezone : ''\);/);
  // La prueba que pide la persona NO pasa por el filtro: la pidió ella, ahora.
  const prueba = push.slice(push.indexOf('export async function enviarPushAUsuario('), push.indexOf('export async function pushPorDetras('));
  assert.doesNotMatch(prueba, /enSilencio/);
  // Y la pantalla lo mide en la zona de quien está frente al teclado, no en la del cliente que mira.
  assert.match(sinComentarios(leer('app/perfil/notificaciones/page.tsx')), /zonaPropia\(\)/);
});

test('cada canal se puede probar, y el de la app no abre un chat que no existe', () => {
  const panel = sinComentarios(leer('app/perfil/NotificacionesPanel.tsx'));
  assert.match(panel, /window\.dispatchEvent\(new Event\(EVENTO_PRUEBA_IN_APP\)\)/);
  assert.match(panel, /fetch\('\/api\/push\/prueba', \{ method: 'POST' \}\)/);
  const prov = sinComentarios(leer('app/_components/NotificationsProvider.tsx'));
  assert.match(prov, /window\.addEventListener\(EVENTO_PRUEBA_IN_APP, probar\)/);
  assert.match(prov, /onAbrir=\{\(\) => \(toast\.prueba \? setToast\(null\) : goToChatNoOficial\(toast\.gid\)\)\}/);
});

// ROTURAS (25/10/2026), una por vez y restaurando de memoria (base 7/0); cada una dio 6/1:
//   · `enSilencio` sin el caso que cruza la medianoche (sólo `h >= desde && h < hasta`)
//   · lib/push.ts sin `!enSilencio(...)` en el filtro de quién recibe
//   · `resumenCelular` sin el «Sin teléfono» en ámbar
//   · `canalDeUrl` aceptando cualquier texto
//   · `normalizarPush` perdiendo el `silencio` guardado
