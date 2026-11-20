// Inspiración del lado del servidor (lib/inspiracion/servidor.ts, 19/11/2026): un link nunca se pierde por culpa de Apify.
// Ese día la única clave de Apify (la de la plataforma, que usa todo negocio sin clave propia) daba 401: si la lectura del post
// fallaba, el link tenía que quedar guardado y ordenado con lo que hubiera, y releerse cuando la lectura volviera a andar.
// El servidor habla con la base y con Apify: esto lee su código (como tests/mako-responde-siempre.test.ts) y fija el orden.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fuente = readFileSync(new URL('../lib/inspiracion/servidor.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const cuerpo = (desde: string) => {
  const i = fuente.indexOf(desde);
  assert.ok(i >= 0, `falta ${desde}`);
  const j = fuente.indexOf('\nexport ', i + desde.length);
  return fuente.slice(i, j < 0 ? undefined : j);
};

test('el link se GUARDA antes de leerlo: si Apify falla, ya está en la base', () => {
  const g = cuerpo('export async function guardarDeWhatsApp(');
  const inserta = g.indexOf('.insert({');
  const lee = g.indexOf('await leerYOrdenar(');
  assert.ok(inserta > 0 && lee > inserta, 'primero el insert, después la lectura');
});

test('sin lectura se ordena IGUAL con la nota y la cuenta; sin nada, a la bandeja sin pagar la IA', () => {
  const l = cuerpo('export async function leerYOrdenar(');
  // La falla de la lectura no corta: sigue a la clasificación.
  assert.doesNotMatch(l, /if \(!leido[^)]*\) \{\s*await db\.from\(T_PIEZAS\)\.update\(\{ estado: 'sin_leer' \}\)/, 'la versión vieja dejaba la pieza sin_leer y sin sugerencia');
  assert.match(l, /if \(!leida && !pieza\.nota && !pieza\.cuenta\)/, 'sin nada que leer, no se paga la IA');
  assert.match(l, /chatCheapCascade\(/);
  assert.match(l, /sinLeer: !leida/, 'la respuesta sabe que falta la lectura');
  // Lo que la persona decidió no se mueve al releer.
  assert.match(l, /if \(pieza\.revisada_en\) return/);
  // Se marca leída sólo con la lectura buena.
  assert.match(l, /leida_en: new Date\(\)\.toISOString\(\)/);
});

test('una lectura que falla tira adentro del medidor y vuelve null afuera; el costo se reporta sólo si Apify contestó', () => {
  const r = cuerpo('async function leerDeInstagram(');
  assert.match(r, /throw new Error\(`Apify no leyó/);
  assert.match(r, /\}\)\)\.catch\(\(e\) => \{/);
  assert.ok(r.indexOf('reportarCostoReal(') > r.indexOf("throw new Error(`Apify no leyó"), 'el costo después de saber que contestó');
});

test('la lectura completa llega después: cuando una lectura anda, se releen las que quedaron sin leer', () => {
  const g = cuerpo('export async function guardarDeWhatsApp(');
  assert.match(g, /await releerPendientes\(ws, ids\)/);
  const rp = cuerpo('export async function releerPendientes(');
  assert.match(rp, /\.is\('leida_en', null\)/);
  assert.match(rp, /\.neq\('tipo_link', 'cuenta'\)/);
  assert.match(rp, /leerYOrdenar\(ws, id\)/);
});

test('la migración tiene `leida_en`', () => {
  const m = readFileSync(new URL('../supabase/migrations/0422_inspiracion.sql', import.meta.url), 'utf8');
  assert.match(m, /leida_en\s+timestamptz/);
});
