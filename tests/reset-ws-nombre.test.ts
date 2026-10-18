// =============================================================================
// RESET del Cliente de Prueba: también vuelve el NOMBRE del workspace (18/10/2026)
// =============================================================================
// Martín, probando el ws 3: después de RESET el onboarding seguía diciendo «Consultesis». MEDIDO (sólo lectura): el ws 3 se
// llamaba «Consultesis» en `workspaces.nombre` — el onboarding le escribe ahí el nombre del negocio
// (`guardarNombreNegocio`) y el RESET no tocaba la fila. Ahora la deja como recién creada: «Cliente de Prueba».
//
// ROTURAS (18/10/2026, arnés romper-reset.js del scratchpad, con onboarding-preguntas y onboarding-arranque; base 34/0):
// sin la vuelta del nombre → 33/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('el RESET devuelve el nombre del workspace de prueba', () => {
  const src = leer('lib/reset-workspace.ts');
  assert.match(src, /export const NOMBRE_WS_PRUEBA = 'Cliente de Prueba';/);
  assert.match(src, /\.from\('workspaces'\)\.update\(\{ nombre: NOMBRE_WS_PRUEBA \}\)\.eq\('id', ws\)/, 'el RESET deja el negocio de la prueba anterior');
  assert.match(leer('lib/onboarding-arranque-server.ts'), /export async function guardarNombreNegocio\(/, 'el onboarding ya no escribe el nombre: revisar si esto sigue haciendo falta');
});
