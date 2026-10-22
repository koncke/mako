// =============================================================================
// El subtítulo de cada chat en la lista: «Trabajando…», «Espera tu respuesta» o nada (20/10/2026)
// =============================================================================
// Martín, con captura de /admin/operaciones: «En la preview de los chats, que estan todos unos abajos de otros, en la
// sidebar... Jamás debe decir el subtitulo las cosas que ponen... O debe decir "Trabajando..." o "Espera tu respuesta" o no
// tener subtitulo.» Decía el paso en curso («Listar los chats de la app y…», «Escribe flujo-ia-recurrente.ts»: los `pasos`
// del cartero 1.15.3), el último mensaje, el borrador o el título de un «Completado». docs/feedback-20-10.md, punto 11.
// Lo que se fija:
//   1. la regla: con un paso cargado, la fila dice «Trabajando…»; con algo que espera a Martín, «Espera tu respuesta»; si
//      no, nada (ni el último mensaje, ni el borrador, ni un «Completado» ya visto);
//   2. las dos listas (la computadora y el teléfono) dibujan SÓLO esas palabras, y el paso sigue ADENTRO del chat.
//
// Probado rompiéndolo (20/10/2026, con la base en 0 fallos):
//   · la fila de la computadora con el paso en curso otra vez → 1 fallo (2);
//   · `segundoRenglon` devolviendo lo último que pasó → 1 fallo (1).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEXTO_SEGUNDO_RENGLON, segundoRenglon } from '../lib/centro-chats';

const leer = (r: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', r), 'utf8').replace(/\r\n/g, '\n');
const quieto = { estado: 'abierto' as const, viejo: false };
const ocupado = { estado: 'trabajando' as const, viejo: false };

test('1. «Trabajando…», «Espera tu respuesta» o nada; nunca el texto de un paso o de un mensaje', () => {
  // Con un paso cargado (el chat trabaja): «Trabajando…», no el paso.
  assert.equal(segundoRenglon(ocupado, 0), 'vivo');
  assert.equal(TEXTO_SEGUNDO_RENGLON.vivo, 'Trabajando…');
  assert.equal(segundoRenglon(quieto, 2), 'espera', 'una pregunta o una tarjeta que espera a Martín');
  assert.equal(segundoRenglon(quieto, 0, true), 'revisar', 'un «Completado» sin su ✓');
  // Desde el 22/10 dice «Completado», no «Espera tu respuesta»: eso es SÓLO para una pregunta abierta (tests/ops-center-estado-honesto.test.ts).
  assert.equal(TEXTO_SEGUNDO_RENGLON.revisar, 'Completado');
  assert.equal(TEXTO_SEGUNDO_RENGLON.espera, 'Espera tu respuesta');
  assert.equal(segundoRenglon(quieto, 0), null, 'sin nada que esperar: sin subtítulo (ni el último mensaje, ni el borrador)');
  assert.equal(segundoRenglon({ estado: 'trabajando', viejo: true }, 0), null, 'un «trabajando» viejo no es trabajando');
  assert.deepEqual(Object.values(TEXTO_SEGUNDO_RENGLON).sort(), ['Completado', 'Espera tu respuesta', 'Trabajando…'], 'no hay otro texto');
});

test('2. las dos listas dibujan sólo esas palabras; el paso en curso sigue adentro del chat', () => {
  const pc = leer('app/admin/operaciones/PiezasCentro.tsx');
  const previa = pc.slice(pc.indexOf('function Previa('), pc.indexOf('export function SelloCompletado'));
  assert.match(previa, /\{TEXTO_SEGUNDO_RENGLON\[r\]\}/, 'computadora: sólo las palabras de la regla');
  assert.doesNotMatch(previa, /enCurso|borrador|p\?\.texto|Tick/, 'computadora: ni el paso, ni el borrador, ni el último mensaje');
  assert.match(pc, /<Previa c=\{c\} espera=\{espera\} sinVer=\{sinVer\} \/>/);
  const movil = leer('app/m/operaciones/ChatsMovil.tsx');
  const fila = movil.slice(movil.indexOf('const FilaChatM = memo('), movil.indexOf('function mismaFila('));
  assert.match(fila, /\{TEXTO_SEGUNDO_RENGLON\[renglon\]\}/, 'teléfono: sólo las palabras de la regla');
  assert.doesNotMatch(fila, /enCurso|borrador|p\?\.texto|<Tick/, 'teléfono: ni el paso, ni el borrador, ni el último mensaje');
  // Adentro del chat, el «Trabajando ••• …» del hilo sigue diciendo el paso (eso no lo objetó).
  assert.match(leer('app/admin/operaciones/Hilo.tsx'), /pasos/);
});
