// =============================================================================
// El chat de Automations con el muñeco de su tab, no la estrella (17/10/2026, punto 8 del feedback del 16/10)
// =============================================================================
// Martín: «En lugar de la estrella de MaKo el ícono debería ser el muñequito que se asignó» a la tab. El CRM lo hizo en
// 8db1e3cbc (`Muneco titulo="CRM"`). Acá, la cabecera del chat de MaKo de Automations: el muñeco «Automations», que
// TRABAJA mientras MaKo arma o cambia la automatización. (El resto de la cara del Second Brain —el hilo `HiloMako`— no se
// pasó: este chat tiene otro modelo de mensajes, con las preguntas de MaKo, el archivo y la copia pegada.)
//
// PROBADO ROMPIÉNDOLO (17/10/2026, arnés `romper.py` + `roturas-muneco.json`; base 1 / 0): volver a `MakoLogo` → 0 / 1;
// el muñeco siempre despierto (no trabaja) → 0 / 1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('la cabecera del chat de MaKo lleva el muñeco de la tab, que trabaja mientras MaKo arma', () => {
  const src = leer('app/automations/ChatMako.tsx');
  const i = src.indexOf('const cabecera = (');
  assert.ok(i > 0);
  const cabecera = src.slice(i, src.indexOf('\n  );\n', i));
  assert.match(cabecera, /<span role="img" aria-label="MaKo"[^>]*><Muneco titulo="Automations" animo=\{trabajando \? 'trabajando' : 'despierto'\} size=\{30\} \/><\/span>/, 'sin su rótulo, el logo no se anuncia');
  assert.doesNotMatch(src, /<MakoLogo /, 'volvió la estrella');
  // La hoja va en la PÁGINA: ChatMako.tsx lo importan los tests, y Node no carga un .css.
  assert.doesNotMatch(src, /\.css';/, 'un .css en el componente rompe los tests que lo importan');
  assert.match(leer('app/automations/page.tsx'), /import '@\/app\/admin\/operaciones\/centro\.css';/, 'sin su hoja, el muñeco no parpadea ni flota');
});
