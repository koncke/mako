// =============================================================================
// Seis puntos numerados no pueden volverse UNA tarea
// =============================================================================
// El mensaje del caso 1 es el real del 9/8/2026: seis puntos sobre monitorear el uso
// de la app, cerrado con «Todo esto podría ser más de una sola idea/tarea». MaKo armó
// una sola. No se truncó —933 tokens de 2500— simplemente resumió.
//
// Contar es trabajo de código. Estos tests fijan qué es una enumeración y qué no,
// porque el error opuesto (partir en dos un pedido que era uno) ensucia el tablero y
// es más difícil de deshacer.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { puntosDelMensaje, avisaQueSonVarias, avisoDePuntos } from '../lib/puntos-mensaje';

/** El mensaje REAL del 9/8. */
const LAS_SEIS_IDEAS = `Ideas:
Monitoriar TODO lo que hacen los usuarios en la app y guardar todos sus movimientos...
Eso nos sirve para:
1. Detectar bugs automáticamente, sin necesidad que el usuario los reporte.
2. Alimentar a la IA, modificar los prompts, etc... Cuando un usuario CORRIGE a una IA, el contexto o lo que sea, la IA debe aprender.
3. Mandarle mensajes, por ejemplo cuando no abre la app, o cuando no abre cierta funcionalidad hace mucho...
4. Saber internamente que cosas utilizan más los usuarios, eso nos permite enfocarnos con datos en las funcionalidades más usadas y perfeccionarlas.
5. Registrar el tiempo de uso, y compararlo con otros. Detectar picos de uso en horas, evitar colapsos por pico de usos.
6. Matchear toda la data, cruzarla, armar un dashboard en superAdmin para visualizarlo todo...

Todo esto podría ser más de una sola idea/tarea`;

test('EL CASO REAL: el mensaje de las 6 ideas tiene 6 puntos', () => {
  const p = puntosDelMensaje(LAS_SEIS_IDEAS);
  assert.equal(p.length, 6);
  assert.match(p[0].texto, /Detectar bugs/);
  assert.match(p[5].texto, /dashboard en superAdmin/);
});

test('…y además el dueño AVISÓ con palabras que era más de una', () => {
  assert.equal(avisaQueSonVarias(LAS_SEIS_IDEAS), true);
  // El aviso del prompt tiene que llevar las dos cosas: el número y la instrucción.
  const a = avisoDePuntos(LAS_SEIS_IDEAS);
  assert.match(a, /ENUMERA 6 PUNTOS/);
  assert.match(a, /más de una tarea/i);
});

test('el otro mensaje real, el de «Dos tareas», da 2', () => {
  const dos = `Investigar:
https://www.instagram.com/reel/DY3QJuthWBT/

Dos tareas:
1. Por un lado investigar profundamente qué reinicia el aprendizaje de las campañas de Meta.
2. Investigar la competencia, en este caso novamkt___ para reels y ads.`;
  assert.equal(puntosDelMensaje(dos).length, 2);
});

test('NO parte lo que no es una lista: un pedido suelto es UNA tarea', () => {
  for (const t of [
    'Mejorar la tipografía de la app, es muy standard.',
    'Che, agregá al plan que hay que llamar a Juan el jueves.',
    'El CRM tiene que ser funcional - no hace falta que sea lindo.',   // guion en medio de la frase
    'Bajamos un -5% el presupuesto de Meta.',                          // no es viñeta
    '1. Solo una cosa: revisar el funnel.',                            // un solo numerado
  ]) {
    assert.deepEqual(puntosDelMensaje(t), [], t);
  }
});

test('un año o un monto no son una enumeración', () => {
  const t = 'En 2025 facturamos X.\n2026 va a ser distinto.';
  assert.deepEqual(puntosDelMensaje(t), []);
});

test('los numerados le ganan a las viñetas de adentro', () => {
  // Si no, un mensaje de 2 puntos con 3 guiones cada uno daría 6 tareas.
  const t = `1. Rehacer el onboarding
- que sea más corto
- con menos preguntas
2. Rehacer el CRM
- tabla nueva
- filtros`;
  const p = puntosDelMensaje(t);
  assert.equal(p.length, 2);
  assert.match(p[0].texto, /onboarding/);
  assert.match(p[1].texto, /CRM/);
});

test('una lista con viñetas sola sí cuenta', () => {
  const t = 'Para el plan:\n- Conectar Meta\n- Armar la landing\n- Escribir la secuencia';
  assert.equal(puntosDelMensaje(t).length, 3);
});

test('sin lista y sin aviso, el prompt no se ensucia', () => {
  assert.equal(avisoDePuntos('Mejorar la tipografía de la app.'), '');
  assert.equal(avisoDePuntos(''), '');
});

test('el aviso por palabras funciona aunque no haya lista', () => {
  assert.equal(avisaQueSonVarias('Esto son varias tareas, separalas por favor'), true);
  assert.equal(avisaQueSonVarias('Podrían ser más de una tarea'), true);
  assert.equal(avisaQueSonVarias('Anotá esta tarea'), false);
});
