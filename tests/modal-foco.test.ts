// =============================================================================
// modal-foco — el arreglo de raíz del foco de `Modal` (app/_ui/Modal.tsx)
// =============================================================================
// El bug (09/10/2026, «cada vez que se introduce un carácter se deselecciona el cuadro de texto»): el
// efecto de foco de `Modal` dependía de `onCerrar`. Casi todos los que lo montan pasan una flecha nueva
// en cada render, así que cada letra re-ejecutaba el efecto, su limpieza devolvía el foco atrás y el
// campo perdía el foco. Medido en «Abrir cuenta» (CuentaDeMaKo.tsx): tipear «ana@x» dejaba «a». Y el
// foco inicial se daba al MONTAR, con la caja todavía en `display:none`: no caía en ningún lado.
//
// Lo que se fija acá, leyendo el fuente sin comentarios:
//   1. el efecto del teclado NO depende de `onCerrar` (lo lee por un ref);
//   2. el Escape llama al ref, no a la prop;
//   3. el foco inicial va cuando la capa SE VE, y respeta `data-autofocus`.
//
// Roto el 13/10/2026, una por vez y restaurado de memoria:
//   · deps del teclado con `onCerrar` otra vez        → 1 / 1 «1: …»
//   · el Escape llamando a `onCerrar()` directo        → 1 / 1 «1: …»
//   · el foco de vuelta al montar (`cajaRef.current?.focus()` en el efecto del teclado) → 1 / 1 «2: …»
//   · el efecto del foco sin `capa.visible` en sus deps → 1 / 1 «2: …»

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const SRC = sinComentarios(leer('app/_ui/Modal.tsx'));

/** El cuerpo del efecto que escucha el teclado: desde su `useEffect(` hasta su `}, [ … ]);`. */
function efectoDelTeclado(): { cuerpo: string; deps: string } {
  const ini = SRC.indexOf("const onKey = (e: KeyboardEvent) =>");
  assert.ok(ini > 0, 'no encontré el efecto del teclado');
  const desde = SRC.lastIndexOf('useEffect(', ini);
  const cierre = SRC.indexOf('}, [', ini);
  const fin = SRC.indexOf(']);', cierre);
  return { cuerpo: SRC.slice(desde, cierre), deps: SRC.slice(cierre + 4, fin) };
}

test('1: el efecto del teclado no depende de onCerrar, y el Escape lo lee por un ref', () => {
  const { cuerpo, deps } = efectoDelTeclado();
  assert.doesNotMatch(deps, /onCerrar/, 'con onCerrar en las deps, cada render re-ejecuta el efecto y el campo pierde el foco');
  assert.match(cuerpo, /e\.key === 'Escape'[^\n]*cerrarRef\.current\(\)/);
  assert.doesNotMatch(cuerpo, /[^.]onCerrar\(\)/, 'el Escape tiene que llamar al ref, no a la prop');
  assert.match(SRC, /const cerrarRef = useRef\(onCerrar\);/);
  assert.match(SRC, /useLayoutEffect\(\(\) => \{ cerrarRef\.current = onCerrar; \}\);/);
});

test('2: el foco inicial va cuando la capa se ve, no al montar, y respeta data-autofocus', () => {
  const { cuerpo } = efectoDelTeclado();
  assert.doesNotMatch(cuerpo, /cajaRef\.current\?\.focus\(\)/, 'al montar la caja está en display:none: el foco no cae');
  const ini = SRC.indexOf('const enfocada = useRef(false);');
  assert.ok(ini > 0, 'falta el efecto que enfoca al verse');
  const efecto = SRC.slice(ini, SRC.indexOf(']);', ini) + 3);
  assert.match(efecto, /if \(!capa\.visible \|\| enfocada\.current \|\| !caja\) return;/);
  assert.match(efecto, /\[data-autofocus\]/);
  assert.match(efecto, /\}, \[capa\.visible\]\);$/);
});
