// =============================================================================
// Los adjuntos guardados del chat con MaKo (lib/chat-mako-bloques.ts, tanda 4 de la etapa 2, 16/10/2026)
// =============================================================================
// El `path` de un bloque es lo que la ruta del adjunto FIRMA (/api/mako/chat?adjunto=) y lo que `deleteSession` BORRA.
// Viene de la base, así que se sanea: de este workspace, de la carpeta del chat, un uuid y nada más. Y la pantalla no
// lo ve nunca: ve un `ref` (`<id del mensaje>:<n>`).
//
// PROBADO ROMPIÉNDOLO (16/10/2026, base 6 / 0), una rotura por vez, restaurada:
//   R1  `esRutaDeChat` sin el `^` del principio (acepta `x/3/chat/<uuid>`)            → 5 / 1
//   R2  `esRutaDeChat` con `[0-9a-f./-]+` en vez del uuid (acepta `..`)                → 5 / 1
//       ⚠️ La primera versión daba 6 / 0: todos los casos malos tenían alguna letra fuera de [0-9a-f] («x», «.jpg»),
//       así que el uuid flojo los rechazaba igual. Lo cazan `3/chat/..` y `3/chat/abc`.
//   R3  `sanearBloques` sin mirar que el tipo calce con el formato                     → 5 / 1
//   R4  `adjuntosVisibles` con `...b` (el path sale a la pantalla)                     → 5 / 1
//   R5  `leerRef` aceptando `0:0`                                                      → 5 / 1
//   R6  `textoConArchivos` sin el caso de varios archivos                              → 5 / 1
//
// Correr: node --import tsx --test tests/chat-mako-bloques.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjuntosVisibles, conArchivero, esRutaDeChat, esRutaDeChatDeAlguno, leerRef, rutaDeAdjunto, sanearBloques,
} from '../lib/chat-mako-bloques';
import { placeholderDeAdjunto } from '../lib/mako-adjuntos';
import { textoConArchivos } from '../app/m/mako/chat-ui';

const U = '0f8b6c2e-4d1a-4c3b-9e7f-1a2b3c4d5e6f';
const bien = { k: 'adjunto', path: `3/chat/${U}`, nombre: 'plano.jpg', mime: 'image/jpeg', tipo: 'image' };

test('el path de un adjunto: de ESTE workspace, de la carpeta del chat, un uuid y nada más', () => {
  assert.equal(rutaDeAdjunto(3, U), `3/chat/${U}`);
  assert.equal(esRutaDeChat(3, `3/chat/${U}`), true);
  for (const p of [
    `4/chat/${U}`, // otro workspace
    `x/3/chat/${U}`, `3/chat/${U}/x`, `3/chat/${U}.jpg`, // algo antes, después o una extensión
    `3/offer/${U}`, `3/chatdoc/${U}`, `3/${U}`, // otra carpeta (la copia de El Archivero no es del chat)
    '3/chat/../4/chat/x', '3/chat/..', '3/chat/abc', `3/chat/${U.toUpperCase()}`, '3/chat/----------------------------------- ', '', null, 7,
  ]) assert.equal(esRutaDeChat(3, p), false, String(p));
  for (const ws of [0, -3, 1.5, NaN]) assert.equal(esRutaDeChat(ws, `${ws}/chat/${U}`), false, `ws ${ws}`);
  // Para borrar los de una conversación que se va: cualquier workspace, la misma forma.
  assert.equal(esRutaDeChatDeAlguno(`12/chat/${U}`), true);
  assert.equal(esRutaDeChatDeAlguno(`0/chat/${U}`), false);
  assert.equal(esRutaDeChatDeAlguno(`12/offer/${U}`), false);
});

test('sanearBloques: sólo adjuntos de este workspace con un formato del chat y su tipo; lo demás se cae', () => {
  assert.deepEqual(sanearBloques(3, null), []);
  assert.deepEqual(sanearBloques(3, { 0: bien }), []);
  assert.deepEqual(sanearBloques(3, [bien]), [bien]);
  const malos = [
    { ...bien, k: 'creacion' },
    { ...bien, path: `4/chat/${U}` },
    { ...bien, mime: 'image/heic', tipo: 'image' },
    { ...bien, mime: 'application/pdf', tipo: 'image' }, // el tipo no calza con el formato
    { ...bien, tipo: 'document' },
    'x', null,
  ];
  assert.deepEqual(sanearBloques(3, malos), []);
  // El nombre se recorta y, vacío, se nombra por su tipo; El Archivero raro se descarta, el bueno se queda.
  const [a] = sanearBloques(3, [{ ...bien, nombre: `  ${'n'.repeat(200)}  `, archivero: { estado: 'raro' } }]);
  assert.equal(a.nombre.length, 120);
  assert.equal('archivero' in a, false);
  assert.equal(sanearBloques(3, [{ ...bien, nombre: '' }])[0].nombre, 'foto');
  const guardado = { estado: 'guardado', id: 'abc' } as const;
  assert.deepEqual(sanearBloques(3, [{ ...bien, archivero: guardado }])[0].archivero, guardado);
  // Como mucho cuatro (los que entran en un mensaje).
  assert.equal(sanearBloques(3, Array(9).fill(bien)).length, 4);
});

test('lo que ve la pantalla: un ref por archivo y NUNCA el path', () => {
  const vis = adjuntosVisibles(42, sanearBloques(3, [bien, { ...bien, mime: 'application/pdf', tipo: 'document', nombre: 'brief.pdf' }]));
  assert.deepEqual(vis, [
    { ref: '42:0', nombre: 'plano.jpg', tipo: 'image' },
    { ref: '42:1', nombre: 'brief.pdf', tipo: 'document' },
  ]);
  assert.ok(!JSON.stringify(vis).includes('/chat/'), 'el path no sale');
});

test('el ref: `<id del mensaje>:<n>`, con n menor que cuatro', () => {
  assert.deepEqual(leerRef('42:1'), { msgId: 42, i: 1 });
  for (const r of ['0:0', '42', '42:4', '42:-1', '-42:1', '42:1:2', ' 42:1', '4.2:1', 'abc', '', null, 42]) {
    assert.equal(leerRef(r), null, String(r));
  }
});

test('lo que pasó en El Archivero se anota en su bloque y en ningún otro', () => {
  const dos = sanearBloques(3, [bien, { ...bien, nombre: 'b.jpg' }]);
  const r = conArchivero(dos, 1, { estado: 'fallo', motivo: 'la IA no pudo leerlo ahora' });
  assert.equal('archivero' in r[0], false);
  assert.deepEqual(r[1].archivero, { estado: 'fallo', motivo: 'la IA no pudo leerlo ahora' });
  assert.equal('archivero' in dos[1], false, 'no toca los de entrada');
});

test('la burbuja con archivos no repite el «(envió…)» que el turno guarda para el modelo', () => {
  // Las entradas salen de la MISMA función que las escribe (lib/mako-adjuntos.ts) y del armado de varios del turno.
  assert.equal(textoConArchivos(placeholderDeAdjunto('image', 'plano.jpg', '¿qué opinas?')), '¿qué opinas?');
  assert.equal(textoConArchivos(placeholderDeAdjunto('document', 'brief.pdf', '')), '');
  assert.equal(textoConArchivos('(envió 2 archivos: a.jpg, b.pdf) — mira esto'), 'mira esto');
  assert.equal(textoConArchivos('(envió una imagen)'), '');
  // Lo que escribió la persona entre paréntesis, sin el placeholder, se queda.
  assert.equal(textoConArchivos('(ojo) mira esto'), '(ojo) mira esto');
});
