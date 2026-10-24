// =============================================================================
// «Creando…» en TODOS los «+» del editor de etapas (24/10/2026)
// =============================================================================
// Llamada con Mauricio del 22/10 (C4): «tarda mucho en crearse y tal vez necesita un loader». El «Creando…» quedó en el
// tablero, en «+ Agregar etapa» y en los «+» entre etapas del recorrido (tests/crm-llamada-22-10-p1.test.ts), pero NO en
// el «+» de arriba de Ganado ni en los de la banda Nutrición: esos dejaban el «+» apagado y nada más durante los segundos
// que tarda guardar y releer (docs/feedback-diseno-pendiente.md, «El CRM, medido aparte»).
//
// Cómo se dibuja: la nutrición que cae en el lugar `n` de la banda aparece DEBAJO de la fila anterior — Ganado si n = 0,
// la nutrición n-1 si no —, así cubre los «+» de entre nutriciones y el de encima del primer descarte (n = largo).
//
// PROBADO ROMPIÉNDOLO: sin el setCreando del «+» de Ganado falla el primero; sin el de la banda, o sin el del primer
// descarte, el segundo; sin la fila debajo de Ganado o debajo de la nutrición, el tercero.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const m = readFileSync(join(__dirname, '..', 'app/crm/EtapasModal.tsx'), 'utf8').replace(/\r\n/g, '\n');

test('el «+» de arriba de Ganado marca la etapa que se crea, debajo de la última del recorrido', () => {
  assert.match(m, /onCrear=\{\(label\) => \{ setCreando\(\{ label, despuesDe: etapas\[etapas\.length - 1\]\?\.key \?\? null \}\); aplicar\(\{ op: 'agregar', label, \.\.\.\(etapas\.length \? \{ despuesDe: etapas\[etapas\.length - 1\]\.key \} : null\) \}\); \}\}/);
});

test('los «+» de la banda Nutrición marcan su lugar en la banda', () => {
  assert.match(m, /onCrear=\{\(label\) => \{ setCreando\(\{ label, despuesDe: null, nutricionEn: i \}\); aplicar\(\{ op: 'agregar', label, nutricionEn: i \}\); \}\}/, 'el «+» entre nutriciones');
  assert.match(m, /onCrear=\{\(label\) => \{ setCreando\(\{ label, despuesDe: null, nutricionEn: nutricionEtapas\.length \}\); aplicar\(\{ op: 'agregar', label, nutricionEn: nutricionEtapas\.length \}\); \}\}/, 'el «+» de encima del primer descarte');
  assert.doesNotMatch(m, /onCrear=\{\(label\) => aplicar\(/, 'queda un «+» sin «Creando…»');
});

test('la fila «Creando…» se dibuja en la banda', () => {
  assert.match(m, /\{e\.key === 'ganado' && creando\?\.nutricionEn === 0 && <FilaCreando label=\{creando\.label\} caja=\{caja\} \/>\}/, 'en el primer lugar de la banda no aparece');
  assert.match(m, /\{creando\?\.nutricionEn === i \+ 1 && <FilaCreando label=\{creando\.label\} caja=\{caja\} \/>\}/, 'entre nutriciones no aparece');
  assert.match(m, /useState<\{ label: string; despuesDe: string \| null; nutricionEn\?: number \} \| null>\(null\)/);
});
