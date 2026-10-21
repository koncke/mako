// =============================================================================
// Con Claude en pausa, el negocio que conectó SU Claude no lee «Conecta tu Claude» (17/10/2026)
// =============================================================================
// docs/hallazgos-graficos.md («Lo que quedó SIN hacer», 16/10): «Si Claude está pausado para todos (`claudePausado`), un
// negocio con su Claude conectado igual ve "Conecta tu Claude": la pausa no deja error». `conClaveDelNegocio` devolvía
// null con la pausa, la lista de errores del negocio quedaba vacía y `avisoSinIA` elegía «Conecta tu Claude». Ahora la
// pausa deja SU error (`CLAUDE_EN_PAUSA`) y el aviso dice lo que pasa.
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026): `conClaveDelNegocio` otra vez con `if (!v.ok) return null;` → 1 fallo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avisoSinIA, SIN_IA_PARA_DATOS_DE_CLIENTES } from '../lib/graficos-ia-elemento';

test('la pausa deja un error del negocio, y con él el aviso ya no manda a conectar su Claude', () => {
  const src = readFileSync(join(__dirname, '..', 'lib', 'anthropic.ts'), 'utf8').replace(/\r\n/g, '\n');
  // Desde el 20/10/2026 la frontera vive en `permisoDeLaClaveDelNegocio` (la comparten la cascada de texto y el chat con
  // herramientas): ahí la pausa se devuelve como tal, y `conClaveDelNegocio` la convierte en el error del negocio.
  const permiso = src.slice(src.indexOf('export async function permisoDeLaClaveDelNegocio('), src.indexOf('export async function conClaveDelNegocio('));
  assert.match(permiso, /if \(!v\.ok\) return pausa \? \{ pausa: true \} : null;/);
  const f = src.slice(src.indexOf('export async function conClaveDelNegocio('), src.indexOf('export async function conClaveDelNegocio(') + 2500);
  assert.match(f, /if \('pausa' in r\) return \{ error: CLAUDE_EN_PAUSA \};/);
  assert.match(src, /export const CLAUDE_EN_PAUSA = '[^']*en pausa[^']*';/);
  // Cómo lo consume la caja: con un error del negocio, el aviso es su error y no «Conecta tu Claude».
  assert.equal(avisoSinIA(true, []), SIN_IA_PARA_DATOS_DE_CLIENTES);
  assert.equal(avisoSinIA(true, ['anthropic/ANTHROPIC_API_KEY: Tu Claude está conectado, pero MaKo lo tiene en pausa']), null);
});
