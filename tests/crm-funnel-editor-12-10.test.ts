// =============================================================================
// El editor del funnel del cuarto feedback del 12/10/2026: el tipo de funnel (una opción) y
// las etapas de nutrición que se quitan todas y se arrastran
// =============================================================================
// «Todas las etapas de nutrición se deben poder editar, incluso si las quiero eliminar todas...
// Las etapas de nutrición también se deben poder desplazar arrastrando», y el tipo de funnel:
// «que solo se pueda elegir 1 opción... "Anuncios a Landing", "Anuncios a WhatsApp",
// "Prospección", "Anuncios a carrito", "Anuncios a formulario"».
//
// Verificado ROMPIÉNDOLO, una rotura por vez (base: 6 pass / 0 fail):
//   · `generateFunnel` coloca «Manual» aunque esté quitada (sin la guarda de `idNutricionFija`) → 5 / 1
//   · `idsParaQuitarNutricion` sin la marca fija de «Manual» → 5 / 1
//   · `ordenarNutricion` sin renumerar la `col` → 5 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PIPELINE, generateFunnel, idNutricionFija, idsParaQuitarNutricion, ordenarNutricion,
  TIPOS_FUNNEL, tipoDeFunnel, parseEntradas,
} from '../lib/pipeline';

test('el tipo de funnel: cinco, en el orden pedido, y cada uno ES una entrada que ya se lee', () => {
  assert.deepEqual(TIPOS_FUNNEL.map((t) => t.label),
    ['Anuncios a Landing', 'Anuncios a WhatsApp', 'Prospección', 'Anuncios a carrito', 'Anuncios a formulario']);
  // Cada tipo se guarda como su entrada, y el saneo de siempre la acepta.
  for (const t of TIPOS_FUNNEL) assert.deepEqual(parseEntradas([t.entrada]), [t.entrada]);
  // Prospección es el único sin campañas de Meta.
  assert.deepEqual(TIPOS_FUNNEL.filter((t) => !t.anuncios).map((t) => t.id), ['prospeccion']);
});

test('el tipo de funnel se lee de lo declarado: la primera entrada que es un tipo; lo demás no inventa uno', () => {
  assert.equal(tipoDeFunnel(['landing'])?.id, 'anuncios_landing');
  assert.equal(tipoDeFunnel(['agenda_sola', 'chat_saliente'])?.id, 'prospeccion');
  assert.equal(tipoDeFunnel(['agenda_sola']), null);
  assert.equal(tipoDeFunnel([]), null);
});

test('«Nutrición - Manual» se puede quitar: con su marca fija, generateFunnel no la coloca', () => {
  const con = generateFunnel(DEFAULT_PIPELINE, []).stages.map((s) => s.key);
  assert.ok(con.includes('manual'));
  const sin = generateFunnel(DEFAULT_PIPELINE, [idNutricionFija('manual')]).stages.map((s) => s.key);
  assert.ok(!sin.includes('manual'));
});

test('quitar una nutrición apaga TODO lo que llega a ella; una que no existe no apaga nada', () => {
  assert.deepEqual(idsParaQuitarNutricion(DEFAULT_PIPELINE, {}, 'manual'), [idNutricionFija('manual')]);
  const nutri = idsParaQuitarNutricion(DEFAULT_PIPELINE, {}, 'nutri');
  assert.ok(nutri.length >= 1 && nutri.every((id) => id.endsWith('>nutri')));
  // Y con esos ids suprimidos, la columna se va del tablero.
  assert.ok(!generateFunnel(DEFAULT_PIPELINE, nutri).stages.some((s) => s.key === 'nutri'));
  assert.deepEqual(idsParaQuitarNutricion(DEFAULT_PIPELINE, {}, 'no-existe'), []);
  assert.deepEqual(idsParaQuitarNutricion(DEFAULT_PIPELINE, {}, 'ganado'), []);
});

test('el orden de la banda Nutrición: el elegido primero, lo demás al final, la col renumerada', () => {
  const stages = generateFunnel(DEFAULT_PIPELINE, []).stages;
  const antes = stages.filter((s) => s.band === 'nutricion').map((s) => s.key);
  assert.ok(antes.length >= 3);
  const ultimo = antes[antes.length - 1];
  const out = ordenarNutricion(stages, [ultimo]);
  const despues = out.filter((s) => s.band === 'nutricion');
  assert.equal(despues[0].key, ultimo);
  assert.deepEqual(despues.slice(1).map((s) => s.key), antes.filter((k) => k !== ultimo));
  assert.deepEqual(despues.map((s) => s.col), despues.map((_, i) => i));
  // Lo que no es de la banda no se mueve.
  assert.deepEqual(out.filter((s) => s.band !== 'nutricion').map((s) => s.key), stages.filter((s) => s.band !== 'nutricion').map((s) => s.key));
  // Sin orden guardado, el mismo arreglo.
  assert.equal(ordenarNutricion(stages, undefined), stages);
});

test('el server tiene las tres operaciones, y el lector aplica el orden guardado', async () => {
  const { readFileSync } = await import('node:fs');
  const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const act = leer('app/crm/actions.ts');
  assert.match(act, /op\.op === 'quitarNutricion' \|\| op\.op === 'ponerNutricion'/);
  assert.match(act, /const ids = idsParaQuitarNutricion\(actual\.pipeline, labels, op\.key\);/);
  assert.match(act, /op\.op === 'ordenNutricion'/);
  const fila = leer('lib/funnel-fila.ts');
  assert.match(fila, /const stages = ordenarNutricion\(generado\.stages, extra\?\.ordenNutricion\);/);
  assert.match(fila, /ordenNutricion: Array\.isArray\(cfg\.ordenNutricion\)/);
});
