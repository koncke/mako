// =============================================================================
// El buscador de conocimiento sin Gemini (25/10/2026): por palabras cuando el negocio no tiene su IA, y nunca «conecta tu Gemini»
// =============================================================================
// El Cerebro, 25/10/2026 (docs/conexiones-y-ayuda.md): «Embebe con la IA del negocio que la tenga: su OpenAI
// (text-embedding-3-small, 1536) primero, su Gemini si es lo único que tiene. Sin ninguna de las dos, búsqueda por palabras...
// nunca la Gemini de la plataforma y nunca "conecta tu Gemini"». La capa real (embeber, buscar, re-embeber, sin la columna) la
// prueba tests/ia16-cada-uno-su-ia.test.ts (tests 4, 6, 7 y 9). Éste fija:
//   1. la búsqueda por palabras (lib/conocimiento-palabras.ts): sin tildes, el plural, las que no dicen nada, el título pesa;
//   2. el umbral: una pregunta larga no trae cualquier fila que comparta UNA palabra;
//   3. ningún texto del buscador ni del Second Brain pide su Gemini, y el aviso de lo no indexado lleva a su GPT;
//   4. el buscador ya no descarta lo que no tiene vector, y el goteo re-embebe lo del negocio desde la búsqueda;
//   5. la migración de `embedding_modelo` va SIN número (la numera el Cerebro).
//
// Probado rompiéndolo (25/10/2026, una rotura por vez, restaurada): ver docs/hallazgos-ia.md («El buscador de conocimiento sin
// Gemini»).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { palabrasDe, puntajePorPalabras, UMBRAL_PALABRAS } from '../lib/conocimiento-palabras';

const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('1. por palabras: sin tildes ni mayúsculas, el plural cuenta como el singular, las vacías no cuentan', () => {
  assert.deepEqual(palabrasDe('¿Cómo respondo las OBJECIONES de precio?'), ['respondo', 'objecion', 'precio']);
  assert.deepEqual(palabrasDe('Hola MaKo, ¿qué es esto?'), [], 'un saludo no es una búsqueda');
  // El título pesa el doble: todas en el título = 1; todas sólo en el cuerpo = 0,5; ninguna = 0.
  assert.equal(puntajePorPalabras('objeciones de precio', { titulo: 'Objeción de precio', cuerpo: '' }), 1);
  assert.equal(puntajePorPalabras('objeciones de precio', { titulo: 'Cierre', cuerpo: 'Cuando hay una objeción por el precio…' }), 0.5);
  assert.equal(puntajePorPalabras('objeciones de precio', { titulo: 'Horarios', cuerpo: 'De 9 a 18.' }), 0);
  assert.equal(puntajePorPalabras('hola', { titulo: 'hola', cuerpo: 'hola' }), 0, 'una pregunta sin palabras que digan algo trajo filas');
});

test('2. el umbral: la mitad de las palabras en el cuerpo entra; una sola de cuatro, no', () => {
  const fila = { titulo: 'Seguimiento', cuerpo: 'Escribe al lead al día siguiente de la llamada.' };
  assert.ok(puntajePorPalabras('seguimiento del lead', fila) >= UMBRAL_PALABRAS);
  assert.ok(puntajePorPalabras('lead caliente campaña presupuesto', fila) < UMBRAL_PALABRAS, 'una palabra en común de cuatro trae la fila');
  assert.equal(UMBRAL_PALABRAS, 0.25);
});

test('3. ningún texto del buscador ni del Second Brain pide su Gemini; lo no indexado lleva a su GPT', () => {
  for (const p of ['lib/embeddings.ts', 'lib/mako-knowledge.ts', 'lib/reembeber-al-conectar.ts', 'lib/recolector.ts', 'lib/recolector-reglas.ts']) {
    assert.doesNotMatch(leer(p), /['"`][^'"`\n]*[Cc]onecta tu Gemini/, `${p} vuelve a pedirle su Gemini`);
  }
  const dir = new URL('../app/second-brain/', import.meta.url);
  for (const f of readdirSync(dir).filter((x) => /\.tsx?$/.test(x))) {
    const s = readFileSync(new URL(f, dir), 'utf8');
    assert.doesNotMatch(s, />\s*conecta tu Gemini\s*</i, `app/second-brain/${f} vuelve a pedirle su Gemini`);
    assert.doesNotMatch(s, /<BotonIntegracion servicio="gemini"/, `app/second-brain/${f} ofrece su Gemini`);
  }
  const aprende = leer('app/second-brain/AprendeSolo.tsx');
  assert.match(aprende, /<BotonIntegracion servicio="openai"[^>]*>conecta tu GPT<\/BotonIntegracion>/, 'el aviso de lo no indexado no lleva a su GPT');
  assert.match(aprende, /se buscan'\} sólo por palabras:/);
});

test('4. el buscador no descarta lo que no tiene vector, y el goteo re-embebe lo del negocio desde la búsqueda', () => {
  const k = leer('lib/mako-knowledge.ts');
  const busca = k.slice(k.indexOf('export async function searchKnowledge('), k.indexOf('export async function listActiveKnowledgeByArea'));
  assert.ok(busca.length > 100 && busca.length < 8000, 'no encontré searchKnowledge');
  assert.doesNotMatch(busca, /^\s*\.not\('embedding', 'is', null\)/m, 'el buscador vuelve a descartar lo que no tiene vector: sin su IA no encuentra nada');
  assert.match(busca, /if \(qv && candidatas\.some\(\(r\) => r\.workspace_id === wsPropio && !sePresta\(r\.fuente\) && !mismoModelo\(r\) && r\.cuerpo\?\.trim\(\)\)\) gotear\(wsPropio\);/,
    'el goteo no corre: lo de un negocio que ya tenía su GPT se queda por palabras para siempre');
  assert.match(k, /after\(\(\) => runWithWorkspace\(ws, \(\) => reembeberLoQueFalta\(GOTEO_DE_A\)\)/);
});

test('5. la migración de `embedding_modelo` va sin número, y no está en supabase/migrations', () => {
  assert.ok(existsSync(new URL('../supabase/sin-numero/mako_knowledge_modelo.sql', import.meta.url)), 'falta la migración sin número');
  const sql = leer('supabase/sin-numero/mako_knowledge_modelo.sql');
  assert.match(sql, /alter table mako_knowledge add column if not exists embedding_modelo text/);
  assert.match(sql, /notify pgrst, 'reload schema';/);
  const numeradas = readdirSync(new URL('../supabase/migrations/', import.meta.url));
  assert.ok(!numeradas.some((f) => /embedding_modelo|mako_knowledge_modelo/.test(f)), 'la migración se numeró sola: la numera el Cerebro');
});
