// =============================================================================
// #873: Supr o ⌫ borra las tarjetas elegidas con el lazo (17/10/2026)
// =============================================================================
// Martín en la llamada con Mauricio (38:04): «cuando selecciono varias tarjetas, si aprieto el botón de delete, se deben
// eliminar. Obvio, solamente se eliminan si le doy clic derecho». La tecla llama a lo MISMO que el menú
// (`eliminarVarias`, que apila para el Ctrl+Z), y nunca mientras se escribe en un campo.
// Probado rompiéndolo (17/10/2026, arnés `romper.py` + `roturas-873.json`; base 1 / 1): sin mirar `escribiendo()` → 0 / 1;
// sin pasarle `onEliminarVarios` al lienzo → 0 / 1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('Supr / ⌫ con varias elegidas las borra con el mismo camino que el menú, y nunca mientras se escribe', () => {
  const lienzo = leer('app/_components/Lienzo.tsx');
  const i = lienzo.indexOf('const alTeclear = (e: KeyboardEvent) => {');
  assert.ok(i > 0);
  const tecla = lienzo.slice(i, lienzo.indexOf('\n    };', i));
  assert.match(tecla, /if \(\(e\.key === 'Delete' \|\| e\.key === 'Backspace'\) && r\.varios\.length && r\.onEliminarVarios && !escribiendo\(\)\) \{\n\s*e\.preventDefault\(\);\n\s*r\.onEliminarVarios\(\[\.\.\.r\.varios\]\);/,
    'con el foco en un texto, ⌫ borraría tarjetas en vez de letras');
  assert.match(lienzo, /const refsTeclado = useRef\(\{ onCopiar, onPegar, onVarios, onEliminarVarios, varios, seleccion \}\);/);
  const flujo = leer('app/automations/FlujoLienzo.tsx');
  assert.match(flujo, /onVarios=\{editable \? setVarios : undefined\} onEliminarVarios=\{editable \? eliminarVarias : undefined\}/, 'la tecla no hace nada en Automations');
  // Lo mismo que el menú: cada una sale y lo de después queda suelto, con su deshacer (apila).
  assert.match(flujo, /const eliminarVarias = \(ids: readonly string\[\]\) => \{[\s\S]*?onPasos\(\(\) => out, true\);/);
});
