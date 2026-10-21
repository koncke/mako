// =============================================================================
// Lo que dibuja la SALIDA de una herramienta llega al hilo (21/10/2026, el camino único para Video, Dashboard y Web)
// =============================================================================
// Hasta la 1.11, el marco de bloques recibía sólo lo de una acción confirmada (`datos.bloque`). Tres áreas pidieron lo
// mismo por otro lado: Video (la propuesta del editor con su antes y después, que no pasa por la tarjeta: se acepta en el
// editor), Dashboard (una PREGUNTA que dibuja su gráfico o su tabla) y Web Generator (la tarjeta de la landing). Un solo
// camino: un campo `bloque` arriba de todo en el JSON que devuelve la herramienta (en una propuesta, `extra.bloque`, que
// lib/api-mako/ejecutar.ts pone primero). Lo que se fija:
//   1. `bloqueDeSalida` saca el bloque, lo sanea, y deja la salida sin él (el modelo no lo lee: lo dibuja el código);
//   2. el turno lo cuelga del mensaje de MaKo (se ve sin recargar y vuelve al recargar), sin dibujar dos veces la
//      propuesta de pantalla que ya trae su bloque, y con una pregunta sólo lo de las lecturas.
//
// Probado rompiéndolo (21/10/2026, con la base en 0 fallos):
//   · `bloqueDeSalida` sin sanear (devuelve el crudo) → 1 fallo (1);
//   · el turno sin colgar los dibujos del mensaje → 1 fallo (2).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bloqueDeSalida } from '../lib/chat-bloques';
import { itemsDeRespuesta } from '../app/m/mako/chat-ui';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Lo que devuelve una propuesta del Video Editor (rama video-ops-center): `extra.bloque` primero, después el link. */
const G4_VIDEO = {
  t: 'antes_despues', titulo: 'Cambiar la velocidad del clip v1',
  filas: [{ campo: 'Velocidad', antes: '1×', despues: '1,5×' }],
  abrir: { titulo: 'Aceptar en el editor', href: '/video-editor/proy%201?propuesta=0f7a' },
};

test('1. bloqueDeSalida: saca el bloque saneado y deja la salida sin él', () => {
  const salida = JSON.stringify({ bloque: G4_VIDEO, ok: true, url: 'https://hola-mako.com/video-editor/proy%201?propuesta=0f7a&ws=3', nueva: true });
  const r = bloqueDeSalida(salida);
  assert.deepEqual(r.bloque, G4_VIDEO, 'el antes y el después, entero');
  assert.deepEqual(JSON.parse(r.out), { ok: true, url: 'https://hola-mako.com/video-editor/proy%201?propuesta=0f7a&ws=3', nueva: true }, 'al modelo le llega sin el bloque');
  const conError = bloqueDeSalida({ content: salida, isError: false });
  assert.ok(conError.bloque && !conError.out.content.includes('"bloque"'), 'también una salida { content, isError }');
  assert.deepEqual(bloqueDeSalida('no es json "bloque"'), { out: 'no es json "bloque"', bloque: null }, 'lo que no es JSON vuelve igual');
  const sin = JSON.stringify({ ok: true });
  assert.equal(bloqueDeSalida(sin).out, sin, 'sin bloque, la misma salida');
  const afuera = bloqueDeSalida(JSON.stringify({ bloque: { ...G4_VIDEO, abrir: { titulo: 'Abrir', href: 'https://otro.com' } } }));
  assert.equal(afuera.bloque, null, 'un bloque que no calza no se dibuja');
  assert.equal(afuera.out, '{}', 'y tampoco le llega al modelo');
});

test('2. el turno lo cuelga del mensaje de MaKo, sin dibujarlo dos veces', () => {
  const s = sinComentarios(leer('lib/mako-turno-app.ts'));
  assert.match(s, /const salida = bloqueDeSalida\(conInstruccionDeTarjeta\(/, 'de la salida de CUALQUIER herramienta');
  assert.match(s, /bloquesDelTurno\.push\(\{ b: salida\.bloque, accion: porId\(name\)\?\.tipo !== 'lectura' \}\)/);
  assert.match(s, /const dibujos = bloquesDelTurno\.filter\(\(x\) => !pregunta \|\| !x\.accion\)\.map\(\(x\) => x\.b\);/, 'con una pregunta, sólo lo de las lecturas');
  assert.match(s, /const pantallas = retirado\.pantallas\.filter\(\(p\) => !conBloque\.has\(p\.escritorio\)\);/, 'la propuesta que ya trae su bloque no se dibuja dos veces');
  assert.match(s, /await appendMessage\(s\.id, 'assistant', respuesta, conElMensaje\.length \? conElMensaje\.map\(aGuardar\) : undefined\);/, 'va con el mensaje: vuelve al recargar');
  // Y se ve sin recargar: itemsDeRespuesta suma los bloques del mensaje de MaKo (1.9).
  const items = itemsDeRespuesta({ ok: true, sesion: { id: 1, titulo: null, updatedAt: '' }, mensajes: [{ role: 'assistant', content: 'Aquí lo tienes.', bloques: [G4_VIDEO as never] }], aviso: null, paraLaPersona: [], propuestas: [], pantallas: [] } as never);
  assert.deepEqual(items.map((x) => x.k), ['msg', 'bloque']);
});
