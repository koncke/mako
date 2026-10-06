// =============================================================================
// Asignar una campaña a un producto desde Ads Manager
// =============================================================================
// Pedido de Martín (05/10/2026): elegir producto al crear la campaña y asignarla desde la
// tabla, «que no haya tanta fricción». La pieza es la del CRM (app/crm/campanas-actions.ts)
// y acá sólo se ofrece: lo que se fija es CUÁNDO se pregunta, qué dice la pregunta, y que
// las dos pantallas nuevas pasen por esas acciones en vez de escribir el setting a mano.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hayQuePreguntar, preguntaAsignar, valorDeProducto, funnelDeValor, VAL_PPAL } from '../lib/campana-asignar';

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r/g, '');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('sólo se pregunta cuando hay algo que decidir', () => {
  assert.equal(hayQuePreguntar(0, null), false, 'sin leads y sin dueño previo, se asigna directo');
  assert.equal(hayQuePreguntar(896, null), true, 'mover 896 leads de tablero no se hace sin avisar');
  assert.equal(hayQuePreguntar(0, 'Negocio que Escala'), true, 'sacársela a otro producto es una decisión');
  //   ROTO A PROPÓSITO (2026-10-05): con `return false` fijo, pass 3 / fail 1 — se movían
  //   896 leads de producto sin preguntar.
});

test('la pregunta trae el NÚMERO y de dónde salen, no un «¿confirmás?»', () => {
  const con = preguntaAsignar({ producto: 'Mentoría', aTraer: 896, desde: null, porProducto: [{ nombre: 'Negocio que Escala', n: 896 }] });
  assert.match(con.titulo, /¿Traer 896 leads a «Mentoría»\?/);
  assert.match(con.mensaje, /896 de Negocio que Escala/);
  assert.equal(con.confirmar, 'Traer 896');
  assert.equal(con.cancelar, 'No asignar');

  const uno = preguntaAsignar({ producto: 'Mentoría', aTraer: 1, desde: null, porProducto: [{ nombre: 'X', n: 1 }] });
  assert.match(uno.titulo, /1 lead a/, 'singular');

  const mudanza = preguntaAsignar({ producto: 'Mentoría', aTraer: 0, desde: 'Negocio que Escala', porProducto: [] });
  assert.match(mudanza.titulo, /¿Mover a «Mentoría»\?/);
  assert.match(mudanza.mensaje, /Hoy sus leads entran en «Negocio que Escala»/);
  assert.equal(mudanza.confirmar, 'Mover');
});

test('el producto principal viaja por su nombre, nunca por su id', () => {
  assert.equal(valorDeProducto(null), VAL_PPAL);
  assert.equal(funnelDeValor(VAL_PPAL), null, 'el principal se asigna con null (productosConNull)');
  assert.equal(valorDeProducto(12), '12');
  assert.equal(funnelDeValor('12'), 12);
});

test('las dos pantallas usan las acciones del CRM y no escriben el setting a mano', () => {
  const celda = sinComentarios(leer('app/ads-manager/ProductoCelda.tsx'));
  for (const accion of ['previaCampanaAction', 'asignarCampanaAction', 'quitarCampanaAction', 'deshacerAsignacionAction']) {
    assert.match(celda, new RegExp(accion), `la celda usa ${accion}`);
  }
  assert.doesNotMatch(celda, /meta\.campanas|setSetting/, 'el setting lo escriben las acciones, no la pantalla');
  assert.match(celda, /hayQuePreguntar\(previa\.aTraer, desde\)/, 'la regla sale de la función compartida');

  assert.match(sinComentarios(leer('app/ads-manager/CampanasBrowser.tsx')), /<ProductoCelda/, 'la tabla ofrece la celda');

  // Una campaña recién creada no tiene leads: asignarla NO puede traer nada.
  const modal = sinComentarios(leer('app/ads-manager/NuevaCampanaModal.tsx'));
  assert.match(modal, /asignarCampanaAction\(funnelDeValor\(producto\), \{[^}]*\}, false\)/);
  //   ROTO A PROPÓSITO (2026-10-05): con `true`, pass 3 / fail 1.
});
