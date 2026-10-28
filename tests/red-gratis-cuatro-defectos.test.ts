// =============================================================================
// Los cuatro defectos que la revisión del Cerebro le encontró al corte de la IA gratis (17/10/2026)
// =============================================================================
// 1. A la red gratis le seguía llegando el TEXTO del turno: «anotá: llamar a Juan Pérez 11 2233 4455,
//    juan@mail.com» no pide herramientas de clientes y viajaba tal cual; y la nota de voz se transcribía con la red
//    gratis de la agencia. Ahora un email, un teléfono o un adjunto cortan (`turnoParaLaRed`), y la nota de voz va con
//    `pii: true` (sin las keys del negocio, no se escucha).
// 2. El system de la red salía de `buildSystemPrompt` completo, con «TU METODOLOGÍA» de `searchKnowledge`, y el
//    glosario (fuente «reunión») trae nombres y apellidos de las llamadas. Ahora va LEAN.
// 3. `wsDeGrupoJid` resolvía el grupo SuperAdmin y los de prueba al ws1 (Mauricio, un cliente): ahora a la plataforma.
// 4. `wsDeProveedor` le anotaba al ws1 el gasto de Claude de cualquier negocio sin key propia: ahora va a la plataforma.
//
// Probado rompiéndolo (17/10/2026), sobre los 5 de este archivo (base 5 / 0), una rotura por vez: sacando el corte
// por texto de `turnoParaLaRed` → 4 / 1; sacando el `pii: true` de la nota de voz del grupo → 4 / 1; con la red
// usando `system` en vez de `baseRed` → 4 / 1; con `wsDeGrupoJid` devolviendo OWNER_WS → 4 / 1; con `insertUsage`
// volviendo a `wsDeProveedor` → 4 / 1.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { turnoParaLaRed } from '../lib/doer-herramientas';

const leer = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const nada = { tools: [] as Array<{ name: string }>, delRegistro: [], tiposPendientes: [] };

test('1a. un email, un teléfono o un adjunto en el TURNO cortan la red gratis', () => {
  assert.ok(turnoParaLaRed({ ...nada, texto: 'anotá: llamar a Juan Pérez 11 2233 4455', conAdjuntos: false }).cortar, 'el teléfono viajó');
  assert.ok(turnoParaLaRed({ ...nada, texto: 'su mail es juan@mail.com', conAdjuntos: false }).cortar, 'el email viajó');
  assert.ok(turnoParaLaRed({ ...nada, texto: 'mirá esto', conAdjuntos: true }).cortar, 'el adjunto viajó');
  // Y un saludo sigue corriendo: el corte es por lo que lleva, no por todo.
  assert.equal(turnoParaLaRed({ ...nada, texto: 'hola MaKo, ¿cómo estás?', conAdjuntos: false }).cortar, null);
});

test('1b. el doer le pasa el texto y los adjuntos, y la nota de voz se transcribe con pii', () => {
  const src = sinComentarios(leer('lib/mako-doer-in.ts'));
  assert.match(src, /turnoParaLaRed\(\{[\s\S]{0,400}?texto, conAdjuntos: !!mediaBlocks,/);
  const notas = [...src.matchAll(/transcribirAudio\([^)]*\{([^}]*)\}/g)].map((m) => m[1]);
  assert.ok(notas.length >= 2, `vi ${notas.length} transcripciones`);
  for (const o of notas) assert.match(o, /pii: true/, `una nota de voz se transcribe sin pii: ${o}`);
});

test('2. el system de la red va LEAN: sin el conocimiento propio (el glosario trae nombres)', () => {
  const src = sinComentarios(leer('lib/mako-doer-in.ts'));
  assert.match(src, /const baseRed = await runWithWorkspace\(wsData, \(\) => buildSystemPrompt\(\{[^}]*lean: true(?:, canal: 'grupo')? \}\)\);/);
  assert.match(src, /const systemRed = armarSystem\(toolsRed, [^;]*, baseRed\);/);
  // Y el modo lean de buildSystemPrompt no lee el conocimiento.
  const ctx = leer('lib/mako-context.ts');
  const lean = ctx.slice(ctx.indexOf('if (opts.lean) {'), ctx.indexOf('const [persona, perfil'));
  assert.doesNotMatch(lean, /searchKnowledge/);
});

test('3. el grupo SuperAdmin y los de prueba son de la PLATAFORMA, no del ws1', () => {
  const src = sinComentarios(leer('lib/mako-doer-in.ts'));
  const f = src.slice(src.indexOf('export async function wsDeGrupoJid('), src.indexOf('export async function manejarEntranteDoer('));
  assert.doesNotMatch(f, /return OWNER_WS/, 'un grupo de la plataforma devuelve el ws1, que es un cliente');
  assert.match(f, /if \(esDeLaPlataforma\) return wsSuperAdmin\(\)\.catch\(\(\) => null\);/);
});

test('4. el gasto de Claude de otro negocio sin key propia no se anota en el ws1', () => {
  const src = sinComentarios(leer('lib/anthropic-usage.ts'));
  assert.match(src, /const ws = wsForzado \?\? await wsDeLaFila\(row\.provider as string \| undefined\);/);
  const f = src.slice(src.indexOf('async function wsDeLaFila('), src.indexOf('export type UsageInfo'));
  assert.match(f, /if \(actual === OWNER_WS\) return OWNER_WS;/);
  assert.match(f, /return wsSuperAdmin\(\)\.catch\(\(\) => WS_NINGUNO\);/);
});
