// =============================================================================
// Renombrar un CRM: el desplegable cambia al instante y el editor muestra el nombre nuevo
// =============================================================================
// Feedback de Martín del 16/10/2026, punto 1 del CRM (docs/feedback-16-10-crm-onboarding-second-brain.md): «Si se
// cambió pero luego de unos segundos y debería ser automático... Y fijate el bug que en el modal ya me aparece bien
// el nombre y luego en la edición del CRM me aparece el viejo nombre».
//
// La causa del nombre viejo: desde el 13/10 el CRM tiene nombre propio (`funnels.nombre`, lo que escribe
// `renombrarFunnel`) y el desplegable lo lee con `nombreVisible`, pero `embudoEnDetalleAction` seguía devolviendo
// el del PRODUCTO (la regla de antes). Y los segundos: el desplegable esperaba al `router.refresh()`.
//
// Correr: node --import tsx --test tests/crm-renombrar-16-10.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (16/10/2026, base 3/0): volver a leer el producto en embudoEnDetalleAction → 2 / 1; no
// avisar el nombre al mandarlo → 2 / 1; comparar `funnels` por identidad en el tablero → 2 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');

test('el editor lee el nombre con la MISMA regla que el desplegable', () => {
  const src = leer('app/crm/actions.ts');
  const ini = src.indexOf('export async function embudoEnDetalleAction');
  const cuerpo = src.slice(ini, src.indexOf('\nexport ', ini + 10));
  assert.match(cuerpo, /nombre: nombreVisible\(\{\s*nombre: cfg\.nombre \?\? '',\s*producto: /);
  assert.doesNotMatch(cuerpo, /\(await productosPorFunnel\(\[cfg\.id\]\)\)\.get\(cfg\.id\) : null\)\?\.trim\(\)/, 'volvió a mandar el producto');
});

test('el pop-up avisa el nombre al MANDARLO, y lo devuelve si el server lo rechaza', () => {
  const src = leer('app/crm/EtapasModal.tsx');
  assert.match(src, /n\.base = limpio;\n\s*ctx\.current\.onRenombrado\?\.\(limpio\);\n\s*void renombrarEmbudoAction/);
  assert.match(src, /if \(!r\.ok\) \{ n\.base = previo; ctx\.current\.onRenombrado\?\.\(previo\);/);
});

test('el tablero dibuja el nombre local hasta que el server mande la lista nueva, comparando por contenido', () => {
  const src = leer('app/crm/CrmBoard.tsx');
  assert.match(src, /<SelectorFunnel funnels=\{funnelsConNombre\}/);
  assert.match(src, /onRenombrado=\{\(nuevo\) => \{/);
  assert.match(src, /const claveFunnels = funnels\.map\(\(f\) => `\$\{f\.id\}:\$\{f\.nombre\}`\)\.join\('\|'\);/);
  assert.match(src, /if \(funnelsVistos !== claveFunnels\) \{ setFunnelsVistos\(claveFunnels\); setNombresLocales\(\{\}\); \}/);
});
