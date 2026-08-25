// =============================================================================
// La cara de marca: el dato que el cliente cargó y ninguna IA leía
// =============================================================================
// 2026-08-24. Un cliente probó el WhatsApp de MaKo: «tenés unas imágenes cargadas
// de mí, decime cómo soy físicamente». Tenía 5 fotos y 1.166 caracteres
// describiéndolo —ojos avellana, 1,78 m, hasta una curita en el puente nasal—
// cargados en su propio onboarding, y MaKo no podía verlos.
//
// El hallazgo de fondo era más grande que WhatsApp: `getPersona()` tenía DOS
// consumidores, el grafo del cerebro y su propia ruta de onboarding. NINGUNA IA
// la leía. La tab dice «subí fotos de la persona que aparece en tus creativos» y
// ningún generador de creativos la usaba.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

test('La cara de marca entra al contexto que ve MaKo', () => {
  const ctx = leer('../lib/mako-context.ts');
  assert.ok(ctx.includes('resumenCaraDeMarca'),
    'buildSystemPrompt dejó de cargar la cara de marca: MaKo vuelve a no saber nada de la persona de los creativos');
  // Va en el prompt COMPLETO, no en el lean: el lean es para turnos que no razonan
  // (cargar una tarea, confirmar un «sí») y ahí solo viaja la voz de MaKo.
  const iLean = ctx.indexOf('if (opts.lean)');
  const iCara = ctx.indexOf('resumenCaraDeMarca');
  assert.ok(iCara > iLean, 'la cara de marca quedó adentro del modo lean: encarece los turnos que no la necesitan');
});

test('Sin persona cargada no se ensucia el prompt', () => {
  // El bloque es condicional: un workspace que no cargó fotos ni descripción no
  // paga tokens por un encabezado vacío. Medido: ws13 pasó de 7.060 a 8.428
  // chars y ws9 (sin persona) quedó igual.
  const src = leer('../lib/persona.ts');
  assert.match(src, /if \(!desc && !p\?\.fotos\.length\) return '';/,
    'resumenCaraDeMarca dejó de ser condicional');
  assert.match(leer('../lib/mako-context.ts'), /if \(caraTxt\)/,
    'el bloque de la cara de marca se agrega aunque venga vacío');
});

test('No se afirma que la cara de marca sea quien está escribiendo', () => {
  // La persona de los creativos casi siempre es el dueño, pero eso no está
  // confirmado en ningún lado. Afirmarlo sería inventar un dato que nadie cargó
  // — la misma falla que costó los avisos falsos de Meta esta semana.
  const src = leer('../lib/persona.ts');
  const i = src.indexOf('LA CARA DE MARCA DEL NEGOCIO');
  assert.ok(i > 0, 'se perdió el encabezado de la cara de marca');
  const bloque = src.slice(i, i + 400);
  assert.match(bloque, /no lo afirmes|no está confirmado/,
    'el encabezado dejó de aclarar que no se sabe si es quien escribe');
});

test('Las dos «personas» del repo no son la misma, y el código lo dice', () => {
  // `getActivePersona()` (lib/mako-prompts.ts) es la VOZ de MaKo y ya iba en todos
  // los prompts; `getPersona()` (lib/persona.ts) es la CARA DE MARCA del cliente.
  // Que la primera estuviera en el contexto hacía parecer que la persona ya estaba
  // cubierta: por eso la aclaración vive pegada al código y no en un doc.
  const src = leer('../lib/persona.ts');
  assert.ok(src.includes('getActivePersona'),
    'se perdió la advertencia sobre las dos «personas»: es la confusión que ocultó el bug');
});
