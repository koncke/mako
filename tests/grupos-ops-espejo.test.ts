// =============================================================================
// El espejo de WhatsApp en el grupo de la app: sin duplicar y sin que MaKo conteste dos veces (3/11/2026)
// =============================================================================
// El hijo corre el WEBHOOK REAL, con su firma y la voz en el número de Martín, como hoy: tests/_grupos-ops-espejo-hijo.ts.
//
// PROBADO ROMPIÉNDOLO: al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
let corrida: Record<string, any> | null = null;
let fallo: unknown = null;
function R(): Record<string, any> {
  if (corrida) return corrida;
  // Una sola vez aunque falle: cada test volvería a correr el hijo, y el archivo pasaría el tope del vigía de tandas.
  if (fallo) throw fallo;
  try { return correrElHijo(); } catch (e) { fallo = e; throw e; }
}
function correrElHijo(): Record<string, any> {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_grupos-ops-espejo-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 240_000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
  corrida = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
  return corrida;
}

test('una persona en WhatsApp: una fila con su nombre, ANTES del turno, y un solo turno', () => {
  const p = R().persona;
  assert.equal(p.status, 200);
  assert.equal(p.antesDelTurno.length, 1, 'sincrónico: `after` no es durable');
  const f = p.antesDelTurno[0];
  assert.equal(f.autor, 'persona');
  assert.equal(f.canal, 'whatsapp');
  assert.equal(f.nombre, 'Pedro');
  assert.equal(f.wa, 'WA1');
  assert.equal(p.llamadas, 1);
  assert.equal(p.envios, 1, 'MaKo contesta una vez');
  assert.deepEqual(p.despues.map((x: { autor: string }) => x.autor), ['persona', 'mako'], 'lo que MaKo dice en WhatsApp se ve en la app');
  assert.equal(R().sinTelefono, true, 'el teléfono lo leería alguien de otro negocio');
  const espejo = readFileSync(join(RAIZ, 'lib/grupo-espejo.ts'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/manejarEntranteDoer|procesarDoer|bufferearYResponder/.test(espejo), 'el espejo no llama al doer: por eso MaKo no contesta dos veces');
});

test('una re-entrega o dos líneas: una fila y un turno', () => {
  assert.deepEqual(R().reentrega, { filas: 1, llamadas: 1 });
});

test('⛔ los grupos personales de Martín y los de prueba no entran a ningún hilo', () => {
  const a = R().ajenos;
  assert.deepEqual(a.personal, { filas: 0, llamadas: 0 }, 'la voz es su número: `messages.upsert` trae todos sus grupos');
  assert.equal(a.pruebas.filas, 0, 'caerían en el grupo de la plataforma, sin la pregunta');
  assert.ok(a.pruebas.envios >= 1, 'el doer los sigue atendiendo, por WhatsApp');
});

test('una clave pegada en WhatsApp se tapa antes de guardar', () => {
  assert.equal(R().clave.enLaBase, false);
  assert.match(R().clave.texto, /\[clave tapada\]/);
});

test('una reacción de WhatsApp no es un mensaje', () => {
  assert.equal(R().reaccion, 0);
  assert.deepEqual(R().leer, { reaccion: null, protocolo: null, vacio: null });
});

test('⛔ los archivos se validan por sus bytes; lo demás queda como texto', () => {
  const por = Object.fromEntries(R().archivos.map((a: { wa: string }) => [a.wa, a]));
  assert.deepEqual({ tipo: por.WA7.tipo, conPath: por.WA7.conPath, texto: por.WA7.texto }, { tipo: 'imagen', conPath: true, texto: 'mirá' });
  assert.deepEqual({ tipo: por.WA8.tipo, conPath: por.WA8.conPath }, { tipo: 'audio', conPath: true });
  assert.deepEqual({ tipo: por.WA9.tipo, conPath: por.WA9.conPath }, { tipo: 'pdf', conPath: true });
  assert.deepEqual({ tipo: por.WA10.tipo, conPath: por.WA10.conPath }, { tipo: null, conPath: false }, 'un HTML con nombre de PDF se serviría en línea desde el storage');
  assert.match(por.WA10.texto, /archivo en WhatsApp/);
  assert.deepEqual({ tipo: por.WA11.tipo, conPath: por.WA11.conPath }, { tipo: null, conPath: false }, 'un SVG tampoco');
  assert.match(por.WA12.texto, /plan\.docx/);
  assert.match(por.WA13.texto, /el video/);
  assert.match(por.WA14.texto, /sticker/);
  assert.deepEqual({ tipo: por.WA15.tipo, conPath: por.WA15.conPath }, { tipo: null, conPath: false }, 'lo que no se puede bajar queda con su texto');
  assert.match(por.WA15.texto, /sin bajar/);
});

test('la cita se ata por el id de WhatsApp, y queda la hora de WhatsApp', () => {
  assert.deepEqual(R().cita, { responde: true, waAt: true });
});

test('⚠️ el eco no duplica: la copia se encuentra por su texto, aunque le gane al id', () => {
  const r = R();
  assert.deepEqual(r.ecoAntesDelId, [{ autor: 'mako', wa: 'ECO1' }]);
  assert.equal(r.ecoConLink.filas, 1, 'el doer manda el link crudo y la copia lo guarda con `?ws=`: sin normalizar, burbuja doble');
  assert.match(r.ecoConLink.guardado, /ws=10/);
  assert.ok(!r.ecoConLink.enviado.includes('ws=10'));
  assert.deepEqual(r.ecoConLinkSinId, [{ autor: 'mako', wa: 'ECO2' }], 'con el eco ganándole al id: una burbuja a nombre de Martín');
  assert.deepEqual(r.dosIguales, ['ECO6', 'ECO7'], 'dos avisos iguales se atan en orden');
});

test('⚠️ el eco de un video o un Word de una tarjeta no duplica: el hilo los guarda como texto, y dicen otra cosa', () => {
  assert.deepEqual(R().ecoDeVideo, [{ autor: 'mako', wa: 'ECOV' }, { autor: 'mako', wa: 'ECOD' }], 'una tarjeta con video salía con una burbuja de más');
});

test('sin copia: el anillo dice de quién es; fuera del anillo, es la persona dueña de la línea', () => {
  const r = R();
  assert.deepEqual(r.ecoDelAnillo, [{ autor: 'mako', nombre: 'MaKo' }, { autor: 'equipo', nombre: 'Equipo de MaKo' }]);
  assert.deepEqual(r.ecoDeLaPersona, [{ autor: 'persona', nombre: 'Martín' }]);
});

test('el turno de un mensaje de WhatsApp: en la app una vez, también con su eco, y con su reacción', () => {
  const t = R().turnoConEco;
  assert.deepEqual(t.filas, ['persona', 'mako']);
  assert.equal(t.reaccionEnLaFila, '👍');
  assert.equal(t.envios, 1);
});

test('el push: lo de ahora suena; lo viejo que reentrega Evolution, no', () => {
  const p = R().push;
  assert.equal(p.reciente, 1);
  assert.equal(p.viejo, 0, 'al reconectar sonarían horas de mensajes');
  assert.equal(p.filaVieja, true, 'entra al hilo igual');
});

test('el acuse del webhook sigue cerrando, por la función que comparte con la app', () => {
  assert.equal(R().acuse, true);
});

// PROBADO ROMPIÉNDOLO (3/11/2026): una rotura por vez sobre el código real, corriendo este archivo, y restaurada. Las 11 dieron rojo:
//   · la puerta por la instancia → 12 en rojo: «una persona en WhatsApp: una fila con su nombre, ANTES del t»
//   · la allowlist entra → 1 en rojo: «⛔ los grupos personales de Martín y los de prueba no entran»
//   · sin buscar la copia → 1 en rojo: «⚠️ el eco no duplica: la copia se encuentra por su texto, au»
//   · el eco sin normalizar los links → 1 en rojo: «⚠️ el eco no duplica: la copia se encuentra por su texto, au»
//   · la clave de WhatsApp sin tapar → 1 en rojo: «una clave pegada en WhatsApp se tapa antes de guardar»
//   · los bytes sin validar → 1 en rojo: «⛔ los archivos se validan por sus bytes; lo demás queda como»
//   · lo viejo suena → 1 en rojo: «el push: lo de ahora suena; lo viejo que reentrega Evolution»
//   · el webhook no acusa → 1 en rojo: «el acuse del webhook sigue cerrando, por la función que comp»
//   · el espejo llama al doer → 1 en rojo: «una persona en WhatsApp: una fila con su nombre, ANTES del t»
//   · el webhook sin espejo → 12 en rojo: «una persona en WhatsApp: una fila con su nombre, ANTES del t»
//   · sin el anillo, todo fromMe es persona → 1 en rojo: «sin copia: el anillo dice de quién es; fuera del anillo, es»

// PROBADO ROMPIÉNDOLO (4/11/2026, la revisión): el eco de un video sin igualar → 1 en rojo: «el eco de un video o un Word».
