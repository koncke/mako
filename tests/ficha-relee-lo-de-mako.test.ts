// =============================================================================
// La ficha muestra lo que MaKo cambió desde el chat de «Editar» sin cerrar y abrir (17/10/2026)
// =============================================================================
// `useFichaDelFunnel` hacía ganar SIEMPRE lo guardado en esta sesión sobre una relectura del mismo funnel (para que una
// relectura vieja no pisara lo recién guardado), así que el cambio que MaKo hacía desde el chat no se veía
// (docs/hallazgos-crm.md, «Las tabs como HOJAS»). Ahora cada foto trae `version` (= `funnels.updated_at`) y gana la más
// NUEVA (`masNueva`, ficha/guardado-ficha.ts); sin versión, lo de siempre.
//
// Verificado rompiéndolo (el archivo da 2 / 0): `masNueva` devolviendo siempre false → 1 / 1; el hook sin
// `!masNueva(base, local)` → 1 / 1; `armar` sin `version` → 1 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { masNueva } from '../app/crm/lead-view/ficha/guardado-ficha';

const leer = (p: string) => readFileSync(join(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('masNueva: gana la fila más nueva; los dos formatos de fecha (PostgREST y JS) se comparan bien', () => {
  const base = { version: '2026-10-17T15:32:33.500+00:00' };     // lo que devuelve PostgREST
  const local = { version: '2026-10-17T15:32:33.274Z' };          // lo que puso esta sesión al guardar
  assert.equal(masNueva(base, local), true, 'MaKo guardó después: se ve lo suyo');
  assert.equal(masNueva(local, base), false);
  assert.equal(masNueva({ version: null }, local), false, 'sin versión no le gana a nada');
  assert.equal(masNueva(base, { version: undefined }), true);
  assert.equal(masNueva({ version: 'basura' }, { version: null }), false);
});

test('el cableado: el hook deja ganar a la relectura más nueva, y cada foto trae su versión', () => {
  const hook = leer('app/crm/lead-view/ficha/useFichaDelFunnel.ts');
  assert.match(hook, /const actual = local && base && local\.funnel\.id === base\.funnel\.id && !masNueva\(base, local\) \? local : base;/);
  const srv = leer('lib/ficha/config-server.ts');
  assert.match(srv, /version: f\.updated_at \?\? null,/);
  assert.match(srv, /armar\(\{ \.\.\.fila, data: nueva, updated_at: ahora \}, canal, respaldo\)/, 'lo recién guardado vuelve con SU versión');
});
