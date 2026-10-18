// =============================================================================
// Escribir en Meta expira el árbol de ESE negocio, y sólo ése (17/10/2026)
// =============================================================================
// docs/hallazgos-ads.md, «El árbol de Meta que leen las guardas puede tener CUALQUIER edad»: `getMetaHealth` tenía sólo
// `TAG.marketing`, que es GLOBAL (lo comparten las lecturas de lib/queries.ts de todos los negocios), así que nadie lo
// invalidaba al escribir y la tabla del Ads Manager podía pintar un presupuesto viejo. Y `updateTag` en `metaWrite` no
// hacía nada: sólo corre en una server action. La cura: un tag del árbol por negocio (`tagArbolMeta`) que `metaWrite`
// expira con `revalidateTag(…, { expire: 0 })` después de una escritura que salió bien. Asserts sobre el fuente
// (lib/meta-health.ts y lib/meta-write.ts llevan `server-only`).
//
// Probado rompiéndolo (17/10/2026; base 3 / 0). Una rotura por vez, restaurando (pasan / fallan):
//   · getMetaHealth sin el tag por negocio                                  -> 2 / 1
//   · expirarArbolMeta con updateTag (no corre fuera de una server action)  -> 2 / 1
//   · metaWrite sin expirar el árbol                                        -> 2 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (rel: string) => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const HEALTH = leer('lib/meta-health.ts');
const WRITE = leer('lib/meta-write.ts');

test('el árbol de Meta se guarda con un tag PROPIO del negocio, además del global', () => {
  assert.match(HEALTH, /export const tagArbolMeta = \(ws: number \| null\): string => `metaHealth:ws:\$\{ws\}`;/);
  assert.match(HEALTH, /tags: \[TAG\.marketing, tagArbolMeta\(ws\)\], revalidate: 120,/);
  assert.match(HEALTH, /\['metaHealth', `ws:\$\{ws\}`\]/, 'la clave de siempre: no se pierde lo cacheado');
});

test('expirarlo es revalidateTag con expire 0 (updateTag no corre fuera de una server action)', () => {
  const f = HEALTH.slice(HEALTH.indexOf('export function expirarArbolMeta('));
  assert.match(f.slice(0, f.indexOf('\n}\n')), /revalidateTag\(tagArbolMeta\(ws\), \{ expire: 0 \}\)/);
});

test('metaWrite expira el árbol del negocio cuando la escritura salió bien', () => {
  const f = WRITE.slice(WRITE.indexOf('export async function metaWrite('));
  const cuerpo = f.slice(0, f.indexOf('\n}\n'));
  assert.match(cuerpo, /const r = await escribirEnMeta\(body, ws\);/);
  assert.match(cuerpo, /if \(r\.ok\) \{[\s\S]*expirarArbolMeta\(ws\);/);
});
