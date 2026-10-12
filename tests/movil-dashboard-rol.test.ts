// =============================================================================
// /m/dashboard: un rol con hoja única ve SÓLO esa hoja, igual que en escritorio (tanda v5, 12/10/2026)
// =============================================================================
// El closer ve la hoja Closing y el setter la hoja Chat Analyst (`HOJA_DE_ROL`, lib/graficos-plantillas.ts).
// El teléfono preguntaba sólo `ctx.rol === 'closer'`: con el setter sumado al Dashboard, caía en la rama del
// admin y veía Marketing, Comercial y las hojas del informe — los números del negocio que su pantalla de
// escritorio no le muestra. No da error: se ve una pantalla perfectamente armada.
//
// Verificado volviendo a `if (ctx.rol === 'closer') {` en app/m/dashboard/page.tsx: 0 pasan, 1 falla.
//
// Correr: npx tsx --test tests/movil-dashboard-rol.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOJA_DE_ROL } from '../lib/graficos-plantillas';
import { CAPA_DE_HOJA_DE_ROL } from '../lib/graficos-roles';

const RAIZ = join(__dirname, '..');
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('/m/dashboard y /m/dashboard/[hoja] preguntan por la hoja del ROL, no sólo por el closer', () => {
  for (const f of ['app/m/dashboard/page.tsx', 'app/m/dashboard/[hoja]/page.tsx']) {
    const src = sinComentarios(readFileSync(join(RAIZ, f), 'utf8'));
    assert.match(src, /hojaDeRol\(ctx\.rol\)/, `${f} no pregunta por la hoja del rol`);
    assert.doesNotMatch(src, /ctx\.rol === 'closer'/, `${f} pregunta sólo por el closer`);
  }
  // Y la capa de cada hoja es UNA: la que lee el teléfono (lib/movil-rutas.ts) es la de HOJA_DE_ROL.
  for (const [rol, capa] of Object.entries(CAPA_DE_HOJA_DE_ROL)) {
    assert.equal(HOJA_DE_ROL[rol as keyof typeof HOJA_DE_ROL]?.capa, capa, `la capa del ${rol}`);
  }
});
