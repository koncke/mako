// =============================================================================
// Cómo ver los nombres en Chats: como lo agendé o como se llama (31/10/2026)
// =============================================================================
// Leila (30/10): «eso es importante para mí». Es de quien mira: no cambia ningún dato y quien no se puso un nombre sigue como está.
//
// Correr: node --import tsx --test tests/chats-nombre-propio.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { coincideBusqueda, conNombreElegido } from '../lib/chats-reglas';

const leer = (r: string) => readFileSync(r, 'utf8').replace(/\r\n/g, '\n');
const chat = (nombre: string, nombrePropio?: string | null) => ({ nombre, nombrePropio, clave: 'x' });

test('1. elegir no borra a nadie ni cambia el dato', () => {
  assert.equal(conNombreElegido(chat('MX Nadia', 'Nadia C.'), 'propio').nombre, 'Nadia C.');
  assert.equal(conNombreElegido(chat('MX Nadia', 'Nadia C.'), 'agenda').nombre, 'MX Nadia', 'de entrada, como siempre');
  assert.equal(conNombreElegido(chat('MX Nadia', null), 'propio').nombre, 'MX Nadia', 'sin nombre propio queda el que hay');
  assert.equal(conNombreElegido(chat('MX Nadia', '   '), 'propio').nombre, 'MX Nadia');
  assert.equal(conNombreElegido(chat('MX Nadia'), 'propio').nombre, 'MX Nadia');
  const c = chat('MX Nadia', 'Nadia C.');
  conNombreElegido(c, 'propio');
  assert.equal(c.nombre, 'MX Nadia', 'no toca el original');
});

test('1b. se encuentra por el nombre que se ve, sea cual sea', () => {
  const c = { nombre: 'MX Nadia', nombrePropio: 'Nadia C.', empresa: null, canales: [] };
  assert.equal(coincideBusqueda(c, 'nadia c'), true);
  assert.equal(coincideBusqueda(c, 'mx'), true);
  assert.equal(coincideBusqueda({ ...c, nombrePropio: null }, 'nadia c'), false);
});

test('2. el nombre propio sale de un mensaje SUYO, y la agenda sigue ganando en `nombre`', () => {
  const e = leer('lib/evolution-mensajes.ts');
  assert.match(e, /nombrePropio: nombreDe\(r\),/);
  assert.match(e, /if \(!prev\.nombrePropio\) prev\.nombrePropio = nombreDe\(r\);/);
  assert.match(e, /\(!r\.from_me && r\.push_name && r\.push_name !== 'Você'\) \? r\.push_name : null/, 'el de un saliente es nuestro perfil');
  assert.match(e, /if \(n\) c\.nombre = n;/, 'la agenda le sigue ganando al nombre de la lista');
  assert.match(leer('lib/chats.ts'), /nombrePropio: c\.nombrePropio \?\? null,/);
  assert.match(leer('lib/chats-reglas.ts'), /nombrePropio: suyas\.map\(\(f\) => f\.nombrePropio\?\.trim\(\)\)\.find\(Boolean\) \?\? null,/);
});

test('3. la lista y la ventana lo muestran; es del navegador de quien mira', () => {
  const a = leer('app/chats/ChatsApp.tsx');
  assert.match(a, /const listaVista = useMemo\(\(\) => \(resultados \?\? visibles\)\.map\(\(c\) => conNombreElegido\(c, verNombre\)\), \[resultados, visibles, verNombre\]\);/);
  assert.match(a, /chats=\{listaVista\}/);
  assert.match(a, /const seleccionVista = useMemo\(\(\) => seleccion && conNombreElegido\(seleccion, verNombre\), \[seleccion, verNombre\]\);/);
  assert.match(a, /chat=\{seleccionVista\}/);
  assert.doesNotMatch(a, /chat=\{seleccion\}/);
  assert.match(a, /leerLocal\(st, ws, 'nombre'\) === 'propio'/, 'con el ws en la clave: dos negocios no comparten la elección');
  assert.match(a, /guardarLocal\(almacenLocal\(\), ws, 'nombre', v\)/);
  const f = leer('app/chats/FiltrosChats.tsx');
  assert.match(f, /\{ title: 'Nombre', options: NOMBRES\.map/);
  assert.match(f, /if \(v\.startsWith\('n:'\)\) \{ onVerNombre\(/);
  assert.match(f, /`n:\$\{verNombre\}`\]/, 'se ve cuál está elegido');
});
