// =============================================================================
// La propuesta del chat de la landing se ve ARMARSE (O13, 18/11/2026)
// =============================================================================
// AGENTS.md, «Lo que MaKo construye se ve CONSTRUYÉNDOSE»: la respuesta de «editar» llega entera, y la tarjeta
// «Original | Modificado» (RevisionPropuesta, app/web-generator/editor/paneles/PanelAgente.tsx) la dibujaba de golpe.
// Ahora las secciones aparecen de a una con la cadencia de la pieza compartida (`useRevelado`; la cadencia y el «reducir
// movimiento» los prueba tests/armado-en-vivo.test.ts, acá no se duplican). Lo que se fija, EJECUTADO:
//   1. qué se revela (app/web-generator/editor/revelado-propuesta.ts): sólo la pendiente que no se vio; una vez vista,
//      o dejando de estar pendiente, no se vuelve a armar (el chat es un store que sobrevive al panel);
//   2. cuántas filas se dibujan y cuándo está completa;
//   3. la tarjeta DIBUJADA (renderToStaticMarkup, sin efectos: el primer cuadro): recién llegada no muestra ninguna
//      sección ni «Aceptar», muestra «Ver todo»; ya vista, todas las secciones y «Aceptar».
//
// PROBADO ROMPIÉNDOLO (18/11/2026), sobre una base de 3 / 0:
//   R1 `seRevela` sin mirar el WeakSet (todas se revelan siempre)          → 1 / 2 (el 1 y el 3)
//   R2 `comoSeVe` devolviendo siempre el total                              → 1 / 2 (el 2 y el 3)
//   R3 «Aceptar» sin la condición `completa` en PanelAgente.tsx             → 2 / 1 (el 3)
// Restaurado, 3 / 0.
//
// Correr: node --import tsx --test tests/web-generator-propuesta-revelada.test.ts
// =============================================================================
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://proyecto.supabase.co';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { comoSeVe, marcarRevelada, seRevela } from '../app/web-generator/editor/revelado-propuesta';
import { RevisionPropuesta, type Propuesta } from '../app/web-generator/editor/paneles/PanelAgente';
import { EditorLandingContext, type CtxEditorLanding } from '../app/web-generator/editor/contexto';
import { temaPorId } from '../lib/editor-landing/temas';
import { CONFIG_DEFAULT } from '../lib/editor-landing/api-tipos';
import { NODO, type JsonNodo } from '../lib/editor-landing/doc';

const seccion = (id: string, texto: string): JsonNodo => ({
  type: NODO.tarjeta, attrs: { id }, content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: texto }] }],
});
const propuesta = (): Propuesta => ({
  paginaId: 'p1',
  enviadas: [seccion('tA', 'Precio de lanzamiento'), seccion('tB', 'Lo que incluye')],
  tarjetas: [seccion('tA', 'Precio especial de noviembre'), seccion('tB', 'Todo lo que te llevas')],
  anclaNuevas: null,
});

test('1. sólo se arma la pendiente que no se vio; vista (o resuelta) no se vuelve a armar', () => {
  const p = propuesta();
  assert.equal(seRevela(p, 'pendiente'), true, 'recién llegada, se arma');
  assert.equal(seRevela(p, 'aplicada'), false, 'una aplicada no se arma');
  assert.equal(seRevela(p, 'descartada'), false);
  marcarRevelada(p);
  assert.equal(seRevela(p, 'pendiente'), false, 'reabrir el panel no la vuelve a armar');
  assert.equal(seRevela(propuesta(), 'pendiente'), true, 'otra propuesta sí');
});

test('2. cuántas filas se ven y cuándo la revisión está completa', () => {
  assert.deepEqual(comoSeVe({ total: 3, visibles: 0, revelando: true }), { mostrar: 0, completa: false });
  assert.deepEqual(comoSeVe({ total: 3, visibles: 2, revelando: true }), { mostrar: 2, completa: false });
  assert.deepEqual(comoSeVe({ total: 3, visibles: 3, revelando: true }), { mostrar: 3, completa: true });
  assert.deepEqual(comoSeVe({ total: 3, visibles: 9, revelando: true }), { mostrar: 3, completa: true }, 'nunca más que las que hay');
  assert.deepEqual(comoSeVe({ total: 3, visibles: 0, revelando: false }), { mostrar: 3, completa: true }, 'sin revelado, todas');
  assert.deepEqual(comoSeVe({ total: 0, visibles: 0, revelando: true }), { mostrar: 0, completa: true }, 'sin cambios, completa');
});

test('3. la tarjeta dibujada: recién llegada, sin secciones ni «Aceptar»; ya vista, todo y «Aceptar»', () => {
  // Un doble del contexto: la revisión sólo lee el tema, el editor (null: no hay documento vivo) y la config.
  const ctx = { tema: temaPorId('pewter'), editor: null, config: CONFIG_DEFAULT } as unknown as CtxEditorLanding;
  const nada = () => {};
  const dibujar = (p: Propuesta) => renderToStaticMarkup(createElement(EditorLandingContext.Provider, { value: ctx },
    createElement(RevisionPropuesta, { propuesta: p, estado: 'pendiente', onAceptar: nada, onAplicarIgual: nada, onDescartar: nada })));

  const p = propuesta();
  const nueva = dibujar(p);
  assert.equal((nueva.match(/class="gma-rv-fila"/g) ?? []).length, 0, 'el primer cuadro no muestra ninguna sección: se arman de a una');
  assert.equal(nueva.includes('>Aceptar<'), false, 'no se acepta lo que todavía no se ve');
  assert.equal(nueva.includes('>Ver todo<'), true, 'se puede saltear');
  assert.equal(nueva.includes('data-armando'), true);

  marcarRevelada(p);
  const vista = dibujar(p);
  assert.equal((vista.match(/class="gma-rv-fila"/g) ?? []).length, 2, 'ya vista, las dos secciones');
  assert.equal(vista.includes('>Aceptar<'), true);
  assert.equal(vista.includes('>Ver todo<'), false);
  assert.equal(vista.includes('data-armando'), false, 'sin la animación de entrada');
});
