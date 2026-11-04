// =============================================================================
// Ticket #51 (Leandro, 4/11/2026): «cuando adjunto una imagen ya no tengo el botón de audio», y el composer de Chats en el teléfono
// =============================================================================
// El botón de la caja es UNO (Martín, 17/10: micrófono sin nada, flecha con algo), y un adjunto lo volvía flecha. Con lo adjuntado y nada
// escrito van los dos, y esa nota sale como el TEXTO del mensaje, junto con lo adjuntado (`onMandar`), no sola por el camino de la pantalla.
// La caja se dibuja de verdad en un node aparte (tests/_caja-adjuntos-hijo.ts): sin DOM no se toca el botón, pero sí se llama su `onGrabar`
// y se le entrega la nota a cada sesión. El último paso (lo transcrito ya en la caja → `onMandar`) lo fija tests/chat-nota-de-voz.test.ts.
//
// ROMPIÉNDOLO (4/11/2026, base 5 de 5), lo que dio cada rotura, con el archivo restaurado:
//   · `micAlLadoDeLaFlecha` siempre en false → 4 fallos;
//   · `micAlLadoDeLaFlecha` sin mirar lo escrito → 2 fallos (el micrófono al lado de un texto);
//   · el botón arranca la sesión de la pantalla → 1 fallo (la nota saldría sola, sin la imagen);
//   · `grabacion` siempre la de la pantalla → 1 fallo (la barra no sería la de lo que se está grabando);
//   · la sesión de adjuntos con `onGrabada: p.onGrabada` → 1 fallo (no se transcribe);
//   · el teclado «abierto» medido con lo que hay que subir → 1 fallo (la captura del ticket: Safari ya corrió la pantalla).
// Sin efecto (las dos condiciones de `grabandoConAdjuntos` en otro orden): 0 fallos, 5 pases.
//
// Correr: node --import tsx --test tests/caja-nota-con-adjuntos.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { micAlLadoDeLaFlecha } from '../lib/centro-caja';
import { tecladoDelComposer } from '../app/m/mako/chat-ui';

const RAIZ = join(__dirname, '..');

type Estado = { grabarAlLado: boolean; micSolo: boolean; flecha: boolean; barra: string | null; sesiones: number };
type Resultado = {
  estados: Record<string, Estado>;
  arranco: { pantalla: boolean; adjuntos: boolean };
  trasLaDeAdjuntos: { textos: string[]; enElActo: number; transcripciones: number };
  trasLaDePantalla: { textos: string[]; enElActo: number; transcripciones: number };
  conVoz: { audios: number; textos: string[] };
};

let cache: Resultado | null = null;
function hijo(): Resultado {
  if (cache) return cache;
  // Sin NODE_TEST_CONTEXT: llamado desde un test, node toma al hijo por un test anidado.
  const out = execFileSync(process.execPath, ['--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests/_caja-adjuntos-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, NODE_TEST_CONTEXT: undefined },
  });
  const i = out.lastIndexOf('@@R@@');
  assert.ok(i >= 0, `el hijo no terminó: ${out.slice(-800)}`);
  cache = JSON.parse(out.slice(i + 5)) as Resultado;
  return cache;
}

test('con lo adjuntado y nada escrito van el micrófono y la flecha; con texto, sólo la flecha; sin nada, sólo el micrófono', () => {
  const { estados: e } = hijo();
  assert.deepEqual([e.sinNada.micSolo, e.sinNada.grabarAlLado, e.sinNada.flecha], [true, false, false]);
  assert.deepEqual([e.conAdjunto.grabarAlLado, e.conAdjunto.flecha, e.conAdjunto.micSolo], [true, true, false], 'el ticket: la imagen no le saca el audio');
  assert.deepEqual([e.conAdjuntoYTexto.grabarAlLado, e.conAdjuntoYTexto.flecha], [false, true]);
  assert.deepEqual([e.soloTexto.grabarAlLado, e.soloTexto.flecha], [false, true]);
  assert.equal(e.conAdjuntoBloqueada.grabarAlLado, false, 'bloqueada (sin la app de escritorio), en su lugar va lo que la destraba');
  assert.equal(e.conAdjuntoSaliendo.grabarAlLado, false, 'saliendo, no se empieza otra');
});

test('grabando, la barra es la de la sesión que graba', () => {
  const { estados: e } = hijo();
  assert.equal(e.grabandoLaDeAdjuntos.barra, '1');
  assert.equal(e.grabandoLaDeLaPantalla.barra, '0');
  assert.equal(e.grabandoLaDeLaPantalla.grabarAlLado, false);
});

test('el micrófono de al lado arranca la nota que sale con lo adjuntado: se transcribe y va al campo, no sale sola', () => {
  const r = hijo();
  assert.deepEqual(r.arranco, { pantalla: false, adjuntos: true });
  assert.deepEqual(r.trasLaDeAdjuntos, { textos: ['mira esta captura'], enElActo: 0, transcripciones: 1 });
  // La de la pantalla sigue como siempre: sale en el acto, sin transcribir.
  assert.deepEqual(r.trasLaDePantalla, { textos: ['mira esta captura'], enElActo: 1, transcripciones: 1 });
  assert.deepEqual(r.conVoz, { audios: 0, textos: ['mira esta captura'] }, 'con `voz`, igual: la imagen no queda atrás');
});

test('la regla, sola', () => {
  assert.equal(micAlLadoDeLaFlecha({ adjuntos: 1, texto: '' }), true);
  assert.equal(micAlLadoDeLaFlecha({ adjuntos: 1, texto: '   ' }), true);
  assert.equal(micAlLadoDeLaFlecha({ adjuntos: 0, texto: '' }), false);
  assert.equal(micAlLadoDeLaFlecha({ adjuntos: 1, texto: 'hola' }), false);
  assert.equal(micAlLadoDeLaFlecha({ adjuntos: 1, texto: '', hayAlgoMas: true }), false, 'un texto largo pegado también es texto');
});

test('el teclado de iOS: abierto aunque Safari ya haya corrido la pantalla (ahí no hay que subir nada, y sí sacar el área segura)', () => {
  // La captura del ticket: el teclado arriba y la pantalla corrida para mostrar el campo. `altoTeclado` da 0, y el composer igual debe saberlo.
  assert.deepEqual(tecladoDelComposer(873, { height: 520, offsetTop: 353 }), { corrimiento: 0, abierto: true, reserva: 353 });
  // Sin correr la pantalla: se sube lo que mide.
  assert.deepEqual(tecladoDelComposer(873, { height: 520, offsetTop: 0 }), { corrimiento: 353, abierto: true, reserva: 353 });
  // La barra de Safari que se esconde no es un teclado.
  assert.deepEqual(tecladoDelComposer(873, { height: 790, offsetTop: 0 }), { corrimiento: 83, abierto: false, reserva: 0 });
  assert.deepEqual(tecladoDelComposer(873, null), { corrimiento: 0, abierto: false, reserva: 0 });
});
