// =============================================================================
// Formularios instantáneos: se leen con el token de la PÁGINA, y un error no es «no hay»
// =============================================================================
// El 2026-09-11 el wizard le dijo a Código Inmobiliario (ws13) «No tienes
// formularios instantáneos» sobre una página con cuatro. Dos bugs encadenados:
//   1) listLeadForms pedía /{página}/leadgen_forms con META_ACCESS_TOKEN (usuario) y
//      Meta contesta #190 «This method must be called with a Page Access Token» —
//      medido en ws1 y en ws13, o sea que no le listaba formularios a nadie;
//   2) el modal hacía `setLeadForms(it ?? [])`, y el rechazo se pintaba como vacío.
//
// Son asserts sobre el FUENTE porque lib/meta-ads-create.ts lleva `server-only`
// (mismo precedente que tests/ads-manager-credenciales.test.ts).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const sinComentarios = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function cuerpoDe(src: string, firma: string): string {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const j = src.indexOf('\n}\n', i);
  return src.slice(i, j === -1 ? undefined : j);
}

test('listLeadForms lee con el token de la página, no con el de usuario', () => {
  const src = sinComentarios(leer('lib/meta-ads-create.ts').replace(/\r/g, ''));
  const lista = cuerpoDe(src, 'export async function listLeadForms(');
  assert.match(lista, /tokenDePagina\(\)/, 'listLeadForms tiene que pedir con tokenDePagina()');
  assert.doesNotMatch(lista, /cred\('META_ACCESS_TOKEN'\)/, 'con el token de usuario Meta contesta #190');
  // Y el token de página sale de la credencial del workspace, con sus DOS argumentos.
  assert.match(cuerpoDe(src, 'async function tokenDePagina('), /credWs\('META_PAGE_ACCESS_TOKEN', ws\)/);
  //   ROTO A PROPÓSITO (2026-09-11): volviendo a pedir con cred('META_ACCESS_TOKEN'),
  //   pass 1 / fail 1 — «listLeadForms tiene que pedir con tokenDePagina()».
});

test('un error al leer los formularios no se pinta como «no tienes formularios»', () => {
  const src = sinComentarios(leer('app/ads-manager/NuevaCampanaModal.tsx').replace(/\r/g, ''));
  assert.doesNotMatch(src, /setLeadForms\(it \?\? \[\]\)/, 'eso convierte un rechazo de Meta en lista vacía');
  assert.match(src, /setLeadFormsError\(/);
  // El texto de «no hay» sólo sale cuando NO hubo error.
  assert.match(src, /leadForms\.length === 0 && !leadFormsError/);
  //   ROTO A PROPÓSITO (2026-09-11): sacando `&& !leadFormsError` del JSX, pass 1 / fail 1 —
  //   el «No hay formularios instantáneos» volvía a salir debajo del error real.
});
