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

test('el RESET deja a su gente de cero: sin la foto, el nombre ni el perfil que copió «Traer datos de Mau»', () => {
  // MEDIDO (18/10/2026, sólo lectura): el único miembro del ws 3 («Ayelen») tenía el `foto_url` de Mauricio. Lo pone
  // `copiarPerfilDelDueno` (lib/datos-mau.ts), con un recibo DENTRO de app_settings que el RESET borraba. Roturas
  // (romper-reset-gente.js; base 2/0): sin borrar la foto → 1/1 · sin los campos de perfil copiados → 1/1.
  const src = leer('lib/reset-workspace.ts');
  assert.match(src, /import \{ PERFIL_EXTRA \} from '\.\/datos-mau';/, 'los campos que copia «Datos de Mau» salen de UNA lista');
  assert.match(src, /for \(const k of PERFIL_EXTRA\) delete perfil\[k\];/);
  assert.match(src, /\.update\(\{ nombre: NOMBRE_WS_PRUEBA, foto_url: null, perfil \}\)\.eq\('id', u\.id\)\.eq\('workspace_id', ws\)/, 'la foto de Mauricio sobrevive al RESET');
  assert.match(leer('lib/datos-mau.ts'), /export const PERFIL_EXTRA = \[/);
});
