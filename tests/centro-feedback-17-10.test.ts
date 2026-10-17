// =============================================================================
// El feedback de Martín del 17/10/2026 (A–I) en las pantallas del Ops Center: lo que se ve, fijado en el código
// =============================================================================
// Martín miró el Ops Center en producción y pidió, entre otras cosas (docs/relevo/centro-operaciones.md, «EL FEEDBACK DE
// MARTÍN DEL 17/10»): fuera los tres puntos de arriba de cada chat (H), y que «Second Brain» abra sólo el grafo, sin cambiar de chat, sin la
// entrada «Mapa» (I). Cada punto va en la computadora Y en el teléfono.
// Lo que tiene reglas puras va en su propio test (centro-preguntas-chat, centro-envio, centro-renombre, centro-jefes);
// acá queda lo que sólo se ve en el componente.
//
// Probado rompiéndolo (17/10/2026, con la base en 0 fallos):
//   · H: devolviendo el botón `co-cab__mas` a Conversacion.tsx → 1 fallo; el «⋯» del teléfono → 1 fallo (el mismo test).
//   · I: el botón «Second Brain» cambiando de lista otra vez (`enSB ? irAClaudeCode() : …`) → 1 fallo; «Mapa» sin `listaSB`
//     → 1 fallo; el grafo sin el chat abierto en su link (`&centro=`) → 1 fallo (el mismo test).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');
/** El código sin comentarios: un «⋯» que se nombra para decir que se fue no cuenta. */
const codigo = (r: string) => leer(r).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('H: sin los tres puntos arriba de cada chat; en el teléfono, el muñeco abre Renombrar y el muñeco', () => {
  assert.doesNotMatch(codigo('app/admin/operaciones/Conversacion.tsx'), /co-cab__mas|name="mas"/, 'la computadora');
  const movil = codigo('app/m/operaciones/ChatsMovil.tsx');
  assert.doesNotMatch(movil, /m-operaciones-mas/, 'el teléfono');
  assert.match(movil, /className="m-operaciones-muneco" onClick=\{\(\) => setOpciones\(true\)\}/, 'Renombrar sigue a mano en el teléfono');
});

test('I: «Second Brain» abre sólo el grafo y no cambia de chat ni de lista; «Mapa» no está en el Ops Center', () => {
  const sb = codigo('app/second-brain/ChatSecondBrain.tsx');
  assert.match(sb, /aria-pressed=\{mapa != null && !ticketera\} onClick=\{irAlSecondBrain\}/, 'el botón abre el grafo, nada más');
  assert.doesNotMatch(sb, /irAClaudeCode/, 'ya no alterna la lista');
  assert.match(sb, /const listaSB = !ops;/, 'en Ops Center la lista es siempre la de Claude Code');
  assert.match(sb, /\{veMapa && listaSB && \(/, '«Mapa» sólo fuera del Ops Center');
  assert.match(sb, /const hrefMapa = `\$\{base\}\?panel=mapa\$\{idElegido \? `&chat=\$\{idElegido\}` : urlCentro \? `&centro=/, 'el grafo se abre con el chat abierto anotado: vuelve a él');
  const movil = codigo('app/m/operaciones/CentroAppMovil.tsx');
  assert.match(movil, /titulo="Second Brain" href="\/m\/second-brain\?panel=mapa"/, 'el teléfono abre el grafo');
  assert.doesNotMatch(movil, /titulo="Mapa"/);
});
