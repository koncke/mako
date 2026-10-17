// =============================================================================
// Un MaKo con dos modos: Analizar no cambia la hoja; Editar sí, y un análisis pedido en Editar no la toca (#862)
// =============================================================================
// Martín, revisión del 16/10/2026 (1:24:47): Joan le pidió al panel «Editar con MaKo» un análisis del funnel y MaKo le
// EDITÓ la hoja: «Una cosa es MaKo analiza y otra cosa es MaKo Edita, entonces ahí está confundido». Lo que se puede romper
// sin que se vea: que un pedido de análisis vuelva a cambiar la hoja (el modelo a veces manda cambios igual: el código
// los descarta), y que el panel no diga en qué modo está ni deje pasar al otro.
//
// Correr: node --import tsx --test tests/dashboard-mako-modos.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026, base 4/0): `aplicarEdicion` aplicando los cambios aunque diga «analizar» → 3 / 1;
// la guía de analizar fuera del mensaje → 3 / 1; la ruta sin pasar `analizar` → 3 / 1; el panel sin los modos → 3 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { aplicarEdicion, userDeEdicion } from '../lib/graficos-ia-edicion';
import { ALCANCE_GENERAL } from '../lib/graficos-ia';
import { sanearHoja, type Hoja } from '../lib/graficos-catalogo';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n'));
const hoja = (): Hoja => sanearHoja({ id: 'h1', nombre: 'Marketing', componentes: [] }, 0)!;

test('un análisis pedido en Editar NO cambia la hoja, aunque el modelo mande cambios', () => {
  const h = hoja();
  const r = aplicarEdicion(h, { respuesta: 'Eso es un análisis: pásalo a Analizar.', analizar: true, agregar: [{ seccion: 'Embudo' }], nombre: 'Otra' });
  assert.equal(r.analizar, true);
  assert.deepEqual(r.cambios, [], 'un pedido de análisis cambió la hoja');
  assert.equal(r.hoja, h);
  assert.equal(aplicarEdicion(h, { respuesta: 'Listo', agregar: [{ seccion: 'Embudo' }] }).analizar, false);
});

test('MaKo sabe que analizar no es editar, en el Dashboard y en General', () => {
  for (const alcance of [{}, ALCANCE_GENERAL]) {
    assert.match(userDeEdicion({ hoja: hoja(), pedido: 'analiza mi funnel', alcance }), /"analizar":true/);
  }
});

test('la ruta le pasa «analizar» al panel', () => {
  assert.match(leer('app/api/graficos/editar/route.ts'), /analizar: r\.analizar/);
});

test('el panel de MaKo dice en qué modo está y deja pasar al otro', () => {
  const editar = leer('app/dashboard/PanelEditarMako.tsx');
  assert.match(editar, /<ModosMako modo="editar" onModo=\{onModo\} \/>/);
  assert.match(editar, /onClick=\{\(\) => onModo\('analizar'\)\}/, 'un análisis pedido en Editar no ofrece pasar a Analizar');
  assert.match(leer('app/dashboard/PanelAnalista.tsx'), /<ModosMako modo="analizar" onModo=\{onModo\} \/>/);
  const ed = leer('app/dashboard/EditorInforme.tsx');
  assert.match(ed, /<PanelAnalista [^>]*onModo=\{conModosMako \? cambiarModoMako : undefined\}/);
  assert.match(ed, /<PanelEditarMako [^>]*onModo=\{conModosMako \? cambiarModoMako : undefined\}/);
  // Los modos, sólo si la persona tiene los dos (el AI Analyst no es del que sólo mira; editar, del que guarda).
  // Y sólo EDITANDO (17/10/2026, tests/dashboard-mako-vista.test.ts): mirando, MaKo asesora y no ofrece pasar a Editar.
  assert.match(ed, /const conModosMako = editando && !soloMirar && guardable && !enBlanco && !compartido;/);
});
