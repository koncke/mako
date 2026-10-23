// =============================================================================
// La tarjeta de la Ticketera que se entiende: DÓNDE, POR QUÉ y QUÉ decidir (23/10/2026, feedback 7 de Martín)
// =============================================================================
// Martín, con captura: la tarjeta «MaKo no le pudo contestar a Mauricio» no se entiende. «Que diga DÓNDE (qué chat o tab), POR
// QUÉ, en palabras, sin "Claude vetado — lib/veto-claude.ts", y QUÉ hay que decidir. Escrita para que Martín decida en 5
// segundos. El texto técnico, plegado en el detalle. El botón de deshacer no va con los otros cuatro: arriba, sutil».
// Lo que dice la tarjeta lo fija tests/ticketera-mazo.test.ts (F1, G1, H2). Acá, lo que trae el DÓNDE de la base:
//   1. la bandeja suma, a cada ticket que MaKo levantó al fallar en un chat, el título y la clave de ese chat
//      (chart_sessions, por `contexto.chat.hilo`): una lectura para todos, y si falla, la bandeja sale igual.
//
// Correr: node --import tsx --test tests/ticketera-tarjeta-7.test.ts
// PROBADO ROMPIÉNDOLO junto con tests/ticketera-mazo.test.ts, ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. la bandeja suma el chat donde falló MaKo: una lectura para todos, y sin romper la bandeja si falla', () => {
  const db = sinComentarios(leer('lib/tickets-db.ts'));
  const f = db.slice(db.indexOf('export async function conChatDeLosTickets('), db.indexOf('export async function bandeja('));
  assert.match(f, /filas\.map\(\(f\) => f\.contexto\?\.chat\?\.hilo\)\.filter\(\(h\): h is string => !!h && \/\^\\d\{1,12\}\$\/\.test\(h\)\)/, 'sólo hilos numéricos');
  assert.match(f, /\.from\('chart_sessions'\)\.select\('id, chart_key, titulo'\)\.in\('id', ids\.map\(Number\)\)/, 'una lectura, por los ids');
  assert.match(f, /if \(error \|\| !data\) return filas;/);
  assert.match(f, /\} catch \{\n\s*return filas;/);
  const acc = sinComentarios(leer('app/tickets/bandeja/acciones.ts'));
  assert.match(acc, /tickets: await conChatDeLosTickets\(r\.datos\)/, 'lo que lee la Ticketera, con el chat');
  // La tarjeta lo usa (mazo-reglas → `dondeDelChat`), y lo técnico sigue plegado en «Detalle» (F1).
  assert.match(sinComentarios(leer('app/tickets/bandeja/mazo-reglas.ts')), /donde: pantalla \? `En «\$\{pantalla\}»` : dondeDelChat\(t\.chatDelTicket\),/);
});

// PROBADO ROMPIÉNDOLO (23/10/2026, con tests/ticketera-mazo.test.ts; base 1/0 y 29/0):
//   · el por qué vuelve a «No tenía una IA…»                  → ticketera-mazo 27/2 (F1, H2)
//   · la tarjeta dice lo que hay que hacer, no qué decidir     → ticketera-mazo 28/1 (F1)
//   · el dónde sin el origen del chat                          → ticketera-mazo 27/2 (F1, H2)
//   · el deshacer vuelve a la fila de los botones              → ticketera-mazo 28/1 (G1)
//   · la frase repite «en su chat» sabiendo cuál               → ticketera-mazo 28/1 (F1)
//   · la bandeja sin el chat de cada ticket                    → ticketera-tarjeta-7 0/1
