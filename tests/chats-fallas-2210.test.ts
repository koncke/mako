// =============================================================================
// Las cuatro fallas que encontró la prueba de los chats del Ops Center (22/10/2026, el Cerebro contra producción)
// =============================================================================
// Las probó como el CLIENTE del ws3, con los POST reales (scripts/probar-chats/ops-center.mts, rama probar-chats-ops-center),
// y las cuatro miran lo GUARDADO:
//   1. P1 · el pegado largo de la COMPUTADORA prometía El Archivero y no lo guardaba: el envío sin fotos (JSON) llamaba al
//      turno sin `guardarAdjuntos`, y el turno archiva sólo con esa marca (el teléfono sí la pasaba);
//   2. P2 · un mensaje escrito de más de 8.000 caracteres se cortaba CALLADO (`texto.slice`);
//   3. P2 · con una clave de OpenAI pegada, el botón era el de Gemini (el del «sin IA» se ponía primero);
//   4. P2 · la nota de voz del teléfono le mostraba la cascada a la persona («ninguna IA pudo: red gratis salteada…»).
//
// Correr: node --import tsx --test tests/chats-fallas-2210.test.ts
// PROBADO ROMPIÉNDOLO (base 4/0), ver el pie.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AVISO_CORTE_PEGADO, AVISO_CORTE_SIN_ARCHIVO, conPegados, partirPegados, recortarMensaje, textosParaArchivar } from '../lib/chat-pegado';
import { NO_PUDE_ESCUCHAR, SIN_OIDO, errorDeDictado } from '../lib/dictado-error';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. la computadora archiva lo pegado en los DOS envíos (con fotos y sin ellas), como el teléfono', () => {
  const ruta = sinComentarios(leer('app/api/mako/chat/route.ts'));
  const turnos = ruta.match(/await turnoApp\([^;]*\);/g) ?? [];
  assert.equal(turnos.length, 2, 'los dos envíos de la computadora');
  for (const t of turnos) assert.match(t, /guardarAdjuntos: true/, `sin la marca, lo pegado no va a El Archivero: ${t.slice(0, 120)}`);
  assert.match(sinComentarios(leer('app/api/m/mako/route.ts')), /guardarAdjuntos: true/, 'el teléfono, igual');
});

test('2. un mensaje largo: entra mucho más, y lo que no entra se DICE y va entero a El Archivero', () => {
  const turno = sinComentarios(leer('lib/mako-turno-app.ts'));
  const tope = Number(/const TOPE_MENSAJE = ([\d_]+);/.exec(turno)?.[1].replace(/_/g, '') ?? 0);
  assert.ok(tope >= 20_000, `«tiene que dejar mensajes mucho más largos» (Martín, 18/10): ${tope}`);
  // El de la prueba: 9.500 caracteres con la clave al final, entero.
  const largo = `${'Párrafo de relleno. '.repeat(470)}La palabra clave es MANZANA-42.`;
  assert.ok(recortarMensaje(largo, tope).endsWith('MANZANA-42.'));
  // Más que el tope: se corta DICIÉNDOLO, y lo escrito entero va a El Archivero (si se puede; si no, no lo promete).
  const enorme = 'x'.repeat(tope + 500);
  assert.ok(recortarMensaje(enorme, tope).endsWith(AVISO_CORTE_PEGADO));
  assert.ok(recortarMensaje(enorme, tope, undefined, false).endsWith(AVISO_CORTE_SIN_ARCHIVO));
  assert.deepEqual(textosParaArchivar(enorme, tope), [enorme]);
  // El turno decide si archiva ANTES de cortar, para que el aviso diga la verdad, y archiva eso.
  assert.match(turno, /const archiva = !paraArchivar\.length \? 'no' : negocio\.suIA \? await puedeArchivarConSuIA\(\) : 'si';\s*const textoPersona = recortarMensaje\(mensaje\.trim\(\), TOPE_MENSAJE, undefined, archiva === 'si'\);/);
  assert.match(turno, /if \(paraArchivar\.length\) await archivarPegadosDelChat\(ws, inicio, paraArchivar\);/);
  // Lo pegado sigue igual: su tope y su aviso.
  const { pegados } = partirPegados(recortarMensaje(conPegados('hola', ['p'.repeat(20)]), 100, 10));
  assert.equal(pegados[0], `${'p'.repeat(10)}\n${AVISO_CORTE_PEGADO}`);
});

test('3. con una clave pegada, el botón es el de SU servicio aunque el negocio no tenga IA', () => {
  const turno = sinComentarios(leer('lib/mako-turno-app.ts'));
  assert.match(turno, /if \(tapado\.tapadas\) \{[^}]*conectar = tapado\.servicio \?\? conectar;\s*\}/);
  assert.doesNotMatch(turno, /conectar = conectar \?\? tapado\.servicio/, 'el del «sin IA» (Gemini) ganaba');
});

test('4. la nota de voz que no se pudo escuchar se dice sin jerga, y sin IA como el chat', () => {
  const cascada = 'transcribirAudio — ninguna IA pudo: red gratis salteada: el audio es de un cliente del negocio y el plan gratis entrena con lo que recibe';
  assert.equal(errorDeDictado(cascada), SIN_OIDO);
  assert.match(SIN_OIDO, /necesito una IA conectada\. Conecta la tuya/, 'lo mismo que dice el chat sin IA');
  assert.equal(errorDeDictado('fetch failed'), NO_PUDE_ESCUCHAR);
  const jerga = /(red gratis|salteada|transcribirAudio|ninguna IA pudo|entrena con lo que recibe|cascada|provider|\bkey\b)/i;
  for (const t of [SIN_OIDO, NO_PUDE_ESCUCHAR]) assert.doesNotMatch(t, jerga, t);
  const ruta = sinComentarios(leer('app/api/plan-dictado/route.ts'));
  assert.match(ruta, /return Response\.json\(\{ ok: false, error: errorDeDictado\(msg\) \}, \{ status: 200 \}\);/);
  assert.doesNotMatch(ruta, /No pude transcribir el audio\. \$\{msg\}/, 'el error de la cascada viajaba tal cual');
});

// PROBADO ROMPIÉNDOLO (22/10/2026, base 4/0):
//   · el envío sin fotos de la computadora sin `guardarAdjuntos` de vuelta   → 3/1 (1)
//   · `TOPE_MENSAJE` en 8.000                                               → 3/1 (2)
//   · lo escrito cortado callado (`texto.slice(0, topeTexto)`)               → 3/1 (2)
//   · `conectar = conectar ?? tapado.servicio` de vuelta                     → 3/1 (3)
//   · la ruta de la voz devolviendo el error de la cascada                   → 3/1 (4)
