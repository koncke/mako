// =============================================================================
// Lo que DIBUJA una lectura o una propuesta llega al hilo: UN solo canal, `ctx.aDibujar` (21/10/2026)
// =============================================================================
// Hasta la 1.11, el marco de bloques recibía sólo lo de una acción confirmada (`datos.bloque`). Tres áreas pidieron lo
// mismo por otro lado: Pagos («A quién cobrar», la 2.27), Dashboard (una PREGUNTA que dibuja su gráfico) y Video (la
// propuesta del editor con su antes y después, que no pasa por la tarjeta). Pagos armó el camino para las lecturas
// (d9e69e7a1); es EL camino, extendido a las propuestas:
//   · una lectura devuelve `{ content, bloque }`; una propuesta de pantalla, `extra.bloque`;
//   · `ejecutarOperacion` (lib/api-mako/ejecutar.ts) lo sanea y lo pasa por `ctx.aDibujar`, que sólo pone el turno de la
//     app; el modelo recibe la salida SIN el bloque, y sin `aDibujar` (WhatsApp, HTTP) se descarta;
//   · el turno lo cuelga del mensaje de MaKo: se ve sin recargar (itemsDeRespuesta) y vuelve al recargar.
// ⚠️ El 21/10 a la mañana el turno leía un campo `bloque` de CUALQUIER JSON de salida (`bloqueDeSalida`): se sacó. Choca con
//    una salida que ya tenga ese campo (la ficha arma `bloques`), y el tipo no lo veía. Lo que una herramienta dibuja va
//    tipado en su respuesta.
//
// Probado rompiéndolo (21/10/2026, con la base en 0 fallos):
//   · la lectura sin pasar el bloque por `aDibujar` → 1 fallo (1);
//   · la propuesta que deja el bloque en `extra` (el modelo lo pagaría) → 1 fallo (1);
//   · el turno sin colgar los dibujos del mensaje → 1 fallo (2).

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { itemsDeRespuesta } from '../app/m/mako/chat-ui';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('1. una lectura y una propuesta dibujan por `ctx.aDibujar`, y el modelo no lo ve', () => {
  const r = JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_dibujar-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'],
  })) as { lectura: { resultado: string }; propuesta: { ok: boolean; propuesta: { extra: Record<string, unknown> } }; sinCanal: { resultado: string }; dibujados: { t: string }[]; cuantosConCanal: number; red: string[] };
  assert.deepEqual(r.red, [], 'nada sale a la red');
  assert.deepEqual(r.dibujados.map((b) => b.t), ['creado', 'antes_despues'], 'la lectura y la propuesta dibujan, saneado');
  assert.equal(r.lectura.resultado, '{"disenos":1}', 'al modelo le llega sólo el contenido');
  assert.ok(r.propuesta.ok);
  assert.deepEqual(r.propuesta.propuesta.extra, { para: 'el proyecto' }, 'y el `extra` de la propuesta sin el bloque');
  assert.equal(r.cuantosConCanal, r.dibujados.length, 'sin `aDibujar` (WhatsApp, HTTP) no se dibuja nada');
  assert.equal(r.sinCanal.resultado, '{"disenos":1}');
});

test('2. el turno lo cuelga del mensaje de MaKo, sin dibujarlo dos veces', () => {
  const s = sinComentarios(leer('lib/mako-turno-app.ts'));
  assert.match(s, /aDibujar: dibujar,/, 'el turno de la app es el único que abre el canal');
  assert.match(s, /herramientaActual = name;\s*const out = conInstruccionDeTarjeta\(/, 'sabe qué herramienta dibujó');
  assert.match(s, /const dibujos = bloquesDelTurno\.filter\(\(x\) => !pregunta \|\| !x\.accion\)\.map\(\(x\) => x\.b\);/, 'con una pregunta, sólo lo de las lecturas');
  assert.match(s, /const pantallas = retirado\.pantallas\.filter\(\(p\) => !conBloque\.has\(p\.escritorio\)\);/, 'la propuesta que ya trae su bloque no se dibuja dos veces');
  // Desde el 12/11/2026 va con «lo que leí» al final (una marca que la pantalla no dibuja, tests/chat-app-hilo.test.ts): los bloques, igual.
  assert.match(s, /const conLoLeido = \[\.\.\.conElMensaje\.map\(aGuardar\), \.\.\.\(leido \? \[marcaLeido\(leido\)\] : \[\]\)\];\s*await appendMessage\(s\.id, 'assistant', respuesta, conLoLeido\.length \? conLoLeido : undefined\);/, 'va con el mensaje: vuelve al recargar');
  assert.doesNotMatch(s, /bloqueDeSalida/, 'nada lee un `bloque` de un JSON a ciegas');
  const items = itemsDeRespuesta({ ok: true, sesion: { id: 1, titulo: null, updatedAt: '' }, mensajes: [{ role: 'assistant', content: 'Aquí lo tienes.', bloques: [{ t: 'creado', titulo: 'x', abrir: { titulo: 'Abrir', href: '/x' } }] }], aviso: null, paraLaPersona: [], propuestas: [], pantallas: [] } as never);
  assert.deepEqual(items.map((x) => x.k), ['msg', 'bloque'], 'y se ve sin recargar');
});
