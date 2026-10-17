// =============================================================================
// AI Avatar: la galería no puede prometer lo que el motor no hace
// =============================================================================
// Las plantillas y las voces son DATOS, y cada uno alimenta algo que cobra o que
// se ve: el formato decide el plan del Video Generator, el prompt va a Flow con la
// cara de la persona, la voz se escucha en la tarjeta. Un dato roto no tira error:
// deja un botón que no hace nada o un video con otra cara.
//
// Probado rompiéndolo (17/10/2026), con el resultado de cada rotura:
//   · `puestaId: 'cocina'` en una plantilla → falla «todo formato existe»
//     (generarPlanAction contestaría «Elige una puesta en escena»).
//   · «realistic skin texture» en un prompt → falla «ningún prompt describe la
//     cara»: la cara la pone la foto, y describirla rompía el parecido.
//   · «Si tenés un negocio» en un guion → falla «sin voseo».
//   · borrar `const g = await puerta();` de `estadoLookAction` → falla «toda action
//     pasa por la puerta».
//   · `await guardarEnHistorial(...)` en `crearLookAction` → falla «los looks no van
//     al historial» (el tope de 10 empujaría afuera anuncios con clips pagados).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { PLANTILLAS_AVATAR, vozSugerida, CATEGORIAS } from '../lib/ai-avatar/plantillas';
import { VOCES_GALERIA, ACENTOS_GALERIA } from '../lib/ai-avatar/voces-galeria';
import { puestaPorId } from '../lib/puestas-data';
import { RUTA_SUBIDA, rutaDeSubida } from '../lib/flow-interfaz';

const ACTIONS = readFileSync(join(process.cwd(), 'app/ai-avatar/actions.ts'), 'utf8');

test('todo formato de una plantilla existe en el Video Generator', () => {
  for (const p of PLANTILLAS_AVATAR) assert.ok(puestaPorId(p.puestaId), `${p.id}: el formato «${p.puestaId}» no existe`);
});

test('ningún prompt describe la cara: la identidad la pone la foto', () => {
  const CARA = /\b(face|faces|facial|eyes?|eyebrows?|hair|beard|mustache|jaw|nose|lips?|skin|wrinkles?|freckles?|complexion)\b/i;
  for (const p of PLANTILLAS_AVATAR) assert.doesNotMatch(p.prompt, CARA, `${p.id}: el prompt describe la cara`);
});

test('el texto de la galería es de tú, sin voseo', () => {
  const VOS = /\b(tenés|contás|sentís|quedate|mostrás|hablás|anunciás|explicás|sabés|querés|podés|vos)\b/i;
  for (const p of PLANTILLAS_AVATAR) {
    for (const t of [p.nombre, p.resumen, p.lugar, p.guion]) assert.doesNotMatch(t, VOS, `${p.id}: «${t}»`);
  }
});

test('cada plantilla tiene categoría, voz que suena y, si dice tener video, el archivo', () => {
  for (const p of PLANTILLAS_AVATAR) {
    assert.ok((CATEGORIAS as readonly string[]).includes(p.categoria), p.id);
    assert.ok(vozSugerida(p.voz), `${p.id}: la voz «${p.voz}» no está en la galería`);
    if (p.ejemplo) {
      assert.ok(existsSync(join(process.cwd(), 'public', p.ejemplo.video)), `${p.id}: falta ${p.ejemplo.video}`);
      assert.ok(existsSync(join(process.cwd(), 'public', p.ejemplo.poster)), `${p.id}: falta ${p.ejemplo.poster}`);
    }
  }
  assert.equal(new Set(PLANTILLAS_AVATAR.map((p) => p.id)).size, PLANTILLAS_AVATAR.length, 'ids repetidos');
});

test('la galería de voces: ids únicos, muestra https y los dos géneros en cada acento', () => {
  assert.equal(new Set(VOCES_GALERIA.map((v) => v.id)).size, VOCES_GALERIA.length);
  for (const v of VOCES_GALERIA) {
    assert.match(v.muestra, /^https:\/\//, v.nombre);
    assert.ok(v.dueno.length > 10, `${v.nombre}: sin dueño no se puede sumar a la cuenta`);
  }
  for (const a of ACENTOS_GALERIA) {
    for (const g of ['mujer', 'hombre'] as const) assert.ok(VOCES_GALERIA.some((v) => v.acento === a && v.genero === g), `${a} sin ${g}`);
  }
});

test('la ruta del look es una que el puente acepta firmar', () => {
  assert.ok(RUTA_SUBIDA.test(rutaDeSubida('ai-avatar', 'escena', 1, '0f8b3c2a-1111-2222-3333-444455556666')));
});

test('toda action de la tab pasa por la puerta antes de hacer nada', () => {
  const nombres = [...ACTIONS.matchAll(/export async function (\w+)\(/g)].map((m) => m[1]);
  assert.ok(nombres.length >= 6, 'no encontré las actions');
  for (const n of nombres) {
    const i = ACTIONS.indexOf(`export async function ${n}(`);
    const cuerpo = ACTIONS.slice(i, ACTIONS.indexOf('\n}\n', i));
    assert.match(cuerpo, /const g = await puerta\(\);\s*\n\s*if \(!g\.ok\)/, `${n} no pasa por la puerta`);
  }
});

test('los looks no van al historial del Video Generator', () => {
  const i = ACTIONS.indexOf('export async function crearLookAction(');
  const cuerpo = ACTIONS.slice(i, ACTIONS.indexOf('\n}\n', i));
  assert.doesNotMatch(cuerpo, /guardarEnHistorial/, 'un look en el historial empuja afuera anuncios con clips pagados (tope de 10)');
});
