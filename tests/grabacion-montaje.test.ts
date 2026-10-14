import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * La grabación de sesión se monta cuando el recuadro EXISTE (13/10/2026).
 *
 * Martín: «revisa en la grabación de la pantalla, en tracking no se está trayendo, lo intenté ver
 * con un lead y se quedó cargando eternamente». Medido en producción (ws1, lead 2636), envolviendo
 * el `requestAnimationFrame`: el montaje corría 4 ms después de pedirlo y el recuadro todavía no
 * existía —React no había dibujado el render de 'listo'—, así que un `if (!nodo) return` mudo lo
 * dejaba vacío para siempre. La misma grabación, montada a mano, andaba.
 *
 * Verificado rompiéndolo (base 3/0): volver al `requestAnimationFrame`, 2 fallos; que el ref del
 * recuadro no intente montar, 1 fallo; el `fetch` sin `signal`, 1 fallo.
 */

const leer = (r: string) => readFileSync(new URL(r, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const SRC = sinComentarios(leer('../app/crm/lead-view/GrabacionModal.tsx'));

test('no se monta en un requestAnimationFrame a ciegas', () => {
  assert.doesNotMatch(SRC, /requestAnimationFrame/, 'el rAF corre antes de que exista el recuadro y sale callado');
});

test('monta el que llega segundo: lo bajado o el recuadro', () => {
  const ini = SRC.indexOf('const refLienzo = useCallback(');
  const ref = SRC.slice(ini, SRC.indexOf('}, [intentarMontar]);', ini));
  assert.ok(ini > 0, 'no encontré el ref del recuadro');
  assert.match(ref, /lienzo\.current = nodo;\s*intentarMontar\(\);/, 'el recuadro se engancha y no intenta montar');
  assert.match(SRC, /listo\.current = \{ r, eventos \};\s*setFase\(\{ k: 'listo', ilegibles \}\);\s*intentarMontar\(\);/, 'lo bajado no intenta montar');
  assert.match(SRC, /<div ref=\{refLienzo\}/);
  // Y el montaje mira las DOS cosas.
  assert.match(SRC, /if \(!nodo \|\| !l \|\| montado\.current\) return;/);
});

test('el cuerpo de la grabación tiene un tope de espera', () => {
  assert.match(SRC, /fetch\(`\/api\/crm\/replay\?sesion=\$\{encodeURIComponent\(sesion\.id\)\}`, \{ cache: 'no-store', signal: AbortSignal\.timeout\(ESPERA_CUERPO_MS\) \}\)/);
});
