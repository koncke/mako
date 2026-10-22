// =============================================================================
// Renombrar un chat no saca a Martín de él (17/10/2026)
// =============================================================================
// Martín: «Le pedí que renombre el chat, lo hizo, pero falta que automáticamente me posicione en el mismo chat que
// estaba, porque me dejó en una tab tipo "No existe este chat"». La clave de un chat es su NOMBRE (`nombre:video
// generator`): al renombrarlo, la vieja deja de existir. Esto fija que el chat abierto se siga por sus sesiones, que un
// link con el nombre viejo lleve al nuevo, y que la URL guarde la sesión (lib/centro-chats.ts → seguirChat, claveParaUrl).
//
// Probado rompiéndolo (17/10/2026, con la base en 0 fallos):
//   · `seguirChat` sin el paso 2 (las sesiones de antes) → 1 fallo («recién renombrado»);
//   · sin el paso 3 (el último trabajo a ese nombre) → 1 fallo («un link viejo»);
//   · el teléfono buscando por la clave sola (`chats.find(c => c.clave === abierto)`) → 1 fallo (el de las pantallas);
//   · la computadora anotando la clave en la URL en vez de `urlCentro` → 1 fallo (el de las pantallas).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chatsDelCentro, claveDeNombre, claveParaUrl, seguirChat, type CarteroP, type TrabajoP } from '../lib/centro-chats';

const AHORA = Date.parse('2026-10-17T13:00:00Z');
const S1 = 'local_11111111-1111-4111-8111-111111111111';
const S2 = 'local_22222222-2222-4222-8222-222222222222';
const cartero = (titulo1: string): CarteroP[] => [{
  cuenta: 'claude1', vistoAt: '2026-10-17T12:59:40Z',
  chats: [
    { local: S1, titulo: titulo1, cuenta: 'claude1', vivo: true, estado: 'idle', actividad: '2026-10-17T12:50:00Z' },
    { local: S2, titulo: 'CRM', cuenta: 'claude1', vivo: true, estado: 'idle', actividad: '2026-10-17T12:40:00Z' },
  ],
}];
const chats = (titulo1: string) => chatsDelCentro({ carteros: cartero(titulo1), areas: [], pedidos: [], trabajos: [], ahora: AHORA });
const renombre: TrabajoP = { id: 't1', destino: S1, destino_titulo: 'Video Generator', destino_cuenta: 'claude1', created_at: '2026-10-17T12:55:00Z' };

test('el chat abierto se sigue por su clave, y renombrado por las sesiones que tenía', () => {
  const antes = chats('Video Generator');
  const abierto = seguirChat(antes, claveDeNombre('Video Generator'), null, []);
  assert.equal(abierto?.titulo, 'Video Generator');
  const despues = chats('Video Editor');
  assert.equal(seguirChat(despues, claveDeNombre('Video Generator'), abierto!.miembros, [])?.titulo, 'Video Editor', 'recién renombrado: es el mismo chat');
  assert.equal(seguirChat(despues, claveDeNombre('Video Generator'), null, [])?.titulo, undefined, 'sin sesiones ni trabajos no se adivina');
});

test('un link viejo (o recargar) con el nombre de antes lleva al chat renombrado', () => {
  const despues = chats('Video Editor');
  assert.equal(seguirChat(despues, claveDeNombre('Video Generator'), null, [renombre])?.titulo, 'Video Editor', 'un link viejo: por el último trabajo a ese nombre');
  assert.equal(seguirChat(despues, claveDeNombre('Otro chat'), null, [renombre]), null, 'un nombre que nadie tuvo no lleva a ninguno');
  assert.equal(seguirChat(despues, S1, null, [])?.titulo, 'Video Editor', 'la sesión sigue abriendo');
});

test('la URL guarda la sesión, que no cambia al renombrar; el chat sin sesión, su clave', () => {
  const [video] = chats('Video Editor');
  assert.equal(claveParaUrl(video), S1);
  assert.equal(claveParaUrl({ clave: 'nombre:crm', sesion: null }), 'nombre:crm');
});

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');

test('la computadora y el teléfono siguen al chat con seguirChat, y la URL lleva la sesión', () => {
  const pc = leer('app/second-brain/ChatSecondBrain.tsx');
  assert.match(pc, /const chatCentro = [^;]*seguirChat\(/, 'la computadora sigue al chat abierto');
  assert.match(pc, /anotarEnUrl\(elegido, urlCentro\)/, 'la computadora anota la sesión en la URL');
  assert.match(leer('app/m/operaciones/ChatsMovil.tsx'), /const elegido = seguirChat\(/, 'el teléfono sigue al chat abierto');
});
