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

test('sin el AI Analyst, «Editar con MaKo» no ofrece un modo que ya no existe, y un análisis lo manda a la estrella', () => {
  // 24/10/2026 (Martín: «Sí, y que la criatura vea la hoja»): el AI Analyst salió del Dashboard; lo de analizar es de la
  // estrella de la tab, que recibe la hoja con su vista. El panel que edita queda solo: sin «Analizar · Editar».
  const ed = leer('app/dashboard/EditorInforme.tsx');
  assert.doesNotMatch(ed, /<PanelAnalista /);
  assert.match(ed, /<PanelEditarMako [^>]*textoInicial=\{pedidoDeProbar\(probar\)\} \/>/, 'el panel que edita volvió a recibir un `onModo`');
  // El panel sigue sabiendo mostrar los modos si alguien se los da: sin `onModo`, no salen.
  assert.match(leer('app/dashboard/PanelEditarMako.tsx'), /\{onModo && <ModosMako modo="editar" onModo=\{onModo\} \/>\}/);
  // Lo que contesta un pedido de análisis apunta a la estrella, no al «modo Analizar».
  assert.doesNotMatch(leer('lib/graficos-ia-edicion.ts'), /modo Analizar/);
  assert.equal(aplicarEdicion(hoja(), { analizar: true }).respuesta, 'Eso es un análisis, no un cambio: la hoja no se tocó. Pregúntaselo a MaKo en la estrella de la tab.');
});
