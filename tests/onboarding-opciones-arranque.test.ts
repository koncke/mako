// =============================================================================
// Las respuestas rápidas del onboarding: dos o más, y ninguna con cifras que el dueño no dijo (20/10/2026)
// =============================================================================
// Florencia (ws21, sesión 14, 18/10): el turno #6 trajo UNA sola opción («Un plan de trabajo con hitos, tareas y
// seguimiento semanal»), ella la tocó y esa frase de MaKo es hoy la 1ª sección de su PDF y el «incluye» del producto; los
// #12 y #14 ofrecieron rangos de precio inventados («Entre $100 y $300 USD») y eligió uno. Una opción tocada se anota como
// palabra del dueño. docs/hallazgos-onboarding.md, «Florencia (ws21, 18/10)».
//
// ROTURAS (20/10/2026, arnés romper.js + roturas-opciones.json del scratchpad; base 3/0): sin el filtro de cifras → 1/2 ·
// una sola opción pasa → 2/1 · la ruta no filtra en el onboarding → 2/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conOpcionesDelArranque, opcionesDelArranque } from '../lib/offer-reglas';

test('fuera las opciones con cifras que el dueño no dijo; las suyas quedan', () => {
  const dicho = ['Cobro 150 dólares al mes', 'Trabajo con estudiantes de posgrado'];
  assert.deepEqual(opcionesDelArranque(['Entre $100 y $300 USD', '$150 al mes', 'Depende del cliente'], dicho), ['$150 al mes', 'Depende del cliente']);
  assert.deepEqual(opcionesDelArranque(['$1.500 por mes', 'Depende'], ['Cobro 1500 por mes']), ['$1.500 por mes', 'Depende'], 'el separador de miles no cambia el número');
});

test('con menos de dos, ninguna: una sola opción es contestar por el dueño', () => {
  assert.deepEqual(opcionesDelArranque(['Un plan de trabajo con hitos, tareas y seguimiento semanal'], []), []);
  assert.deepEqual(opcionesDelArranque(['Entre $100 y $300 USD', 'Depende del cliente'], []), [], 'si las cifras se van y queda una, tampoco');
  const m = conOpcionesDelArranque({ id: 'x', de: 'mako', texto: '¿Cuánto cobras?', at: '', opciones: ['$100 a $300', 'Depende'], varias: true }, []);
  assert.equal('opciones' in m, false);
  assert.equal('varias' in m, false);
});

test('la ruta las filtra en el onboarding, con lo que dijo el dueño y sus documentos', () => {
  const ruta = readFileSync(join(__dirname, '..', 'app/api/offer/route.ts'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(ruta, /const dicho = \[\.\.\.f\.mensajes\.filter\(\(x\) => x\.de === 'yo'\)\.map\(\(x\) => x\.texto\), \.\.\.f\.documentos\.map\(\(d\) => d\.texto\)\];/);
  assert.match(ruta, /const mensaje = p\.arranque \? conOpcionesDelArranque\(m, dicho\) : m;\n\s*return \{ mensajes: \[\.\.\.inferida\.mensajes, mensaje\], piezas \};/);
});
