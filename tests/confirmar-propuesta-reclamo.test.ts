// =============================================================================
// Confirmar una propuesta de contactos: se RECLAMA antes de crear los leads
// =============================================================================
// Estaba en docs/relevo/crm.md (§3) como «a medio hacer»: confirmar marcaba la propuesta
// DESPUÉS de crear, y el comentario afirmaba que «dos pestañas o un doble click crean UN solo
// lote». La lectura del código decía que no: las dos pestañas pasaban el `pendiente`, las dos
// creaban, y recién después una no podía marcarla. Ahora reclama primero, con el molde de las
// acciones del registro (lib/api-mako/acciones.ts).
//
// La action es `'use server'` y arrastra la base: se fija por la fuente, en el orden.
//
// Correr: npx tsx --test tests/confirmar-propuesta-reclamo.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (13/10/2026), una rotura por vez, 3 tests: volver a marcar después de
// crear, no cortar cuando el reclamo no es mío, y no soltar cuando no se escribió nada.
// Los números, en el commit.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const src = sinComentarios(leer('app/crm/revisar/[id]/acciones.ts'));
const cuerpo = src.slice(src.indexOf('export async function confirmarLeadsAction'), src.indexOf('export async function descartarLeadsAction'));

test('reclama la propuesta ANTES de crear un solo lead, y corta si otro la reclamó', () => {
  const reclamo = cuerpo.indexOf("marcarAplicada(id, { en_curso: true })");
  const crear = cuerpo.indexOf('importarLeadsRevisadosAction(');
  assert.ok(reclamo > 0, 'confirmar ya no reclama la propuesta');
  assert.ok(crear > reclamo, 'crea los leads antes de reclamar: dos pestañas crean dos veces');
  assert.match(cuerpo.slice(reclamo, crear), /if \(!mia\) return \{ ok: false/, 'sin cortar, la segunda pestaña crea igual');
  // Y no se vuelve a marcar al final: eso era la guarda que no guardaba nada.
  assert.equal((cuerpo.match(/marcarAplicada\(/g) ?? []).length, 1);
  assert.ok(cuerpo.indexOf('guardarResultadoPropuesta(id, { creados') > crear, 'el resultado se escribe después de crear');
});

test('si no escribió NADA se suelta; si pudo escribir a medias, queda aplicada con el error', () => {
  const nada = cuerpo.slice(cuerpo.indexOf('if (!r.creados && !r.ids?.length && r.errores.length)'));
  assert.match(nada.slice(0, 200), /await soltarPropuesta\(id\)/, 'una propuesta que no creó nada quedaba cerrada para siempre');
  const tiro = cuerpo.slice(cuerpo.indexOf('} catch (e) {'), cuerpo.indexOf('if (!r.creados'));
  assert.doesNotMatch(tiro, /soltarPropuesta/, 'si tiró a mitad de camino pudo haber escrito: no se reabre');
  assert.match(tiro, /guardarResultadoPropuesta\(id, \{ error \}\)/);
});

test('soltar sólo reabre la que sigue «en curso»', () => {
  const lib = sinComentarios(leer('lib/propuestas.ts'));
  const f = lib.slice(lib.indexOf('export async function soltarPropuesta'), lib.indexOf('export async function soltarPropuesta') + 500);
  assert.match(f, /\.eq\('estado', 'aplicada'\)\.eq\('resultado->>en_curso', 'true'\)/, 'soltar podría reabrir una que otro ya terminó');
});
