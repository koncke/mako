// «Conectar un canal» a la vista: arriba en el chip «Canales», después de «Todos los canales» (27/10/2026, Leandro: «¿cómo
// conecto otro número de teléfono?»). Al final de la lista quedaba debajo de cada línea, red y email.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('«Conectar un canal» va segundo en la lista del admin, no al final', () => {
  const f = readFileSync(join(__dirname, '..', 'app/chats/FiltrosChats.tsx'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(f, /\? \[canales\[0\], \{ value: 'conectar', label: 'Conectar un canal', crear: true \}, \.\.\.canales\.slice\(1\)\]/);
  assert.doesNotMatch(f, /opcionesCanal\.push\(\{ value: 'conectar'/, 'volvió al final de la lista');
});
