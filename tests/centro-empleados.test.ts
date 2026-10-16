// =============================================================================
// El Centro como un equipo de empleados de IA (16/10/2026) — lo que, roto, no da error y muestra otra cosa
// =============================================================================
// Martín: «Quiero que copie a Grok, que tiene un mejor diseño, y sobre todo me gusta el concepto de los muñequitos
// de IA o "empleados"». Cada chat es un empleado con su muñeco (app/admin/operaciones/Muneco.tsx) y, como en Grok
// Bot, vuelve a pedir lo que necesita: las tarjetas de la Ticketera que esperan una respuesta.
//
//   1. El muñeco es ESTABLE: el mismo título da el mismo muñeco en el server, en el navegador y en las dos cuentas.
//   2. El equipo de siempre no se repite: dos áreas principales con el mismo muñeco no se distinguen en la lista.
//   3. Los ojos dicen el estado: un chat cerrado duerme, uno que trabaja parpadea, una foto vieja está cansada.
//   4. Una tarjeta pendiente va al empleado que preguntó: por su sesión, o por un título exacto y único.

import test from 'node:test';
import assert from 'node:assert/strict';
import { aspectoDe, animoDe } from '../app/admin/operaciones/Muneco';
import { esperasPorChat } from '../lib/centro-chats';

test('el muñeco sale del título normalizado: el mismo empleado en las dos cuentas, igual en todos lados', () => {
  // Probado rompiéndolo: sin normalizar (el título crudo al hash), « crm » y «CRM» dan muñecos distintos y falla éste.
  assert.deepEqual(aspectoDe('CRM'), aspectoDe(' crm '));
  assert.deepEqual(aspectoDe('Integración de pasarelas'), aspectoDe('integracion de pasarelas'));
  assert.deepEqual(aspectoDe('Un área que no está en el equipo'), aspectoDe('Un área que no está en el equipo'), 'el hash es estable');
});

test('el equipo de siempre no repite muñeco: cada área principal se reconoce de un vistazo', () => {
  // Probado rompiéndolo: dándole a Offer el muñeco de Mako Mobile (círculo azul), falla éste.
  const EQUIPO = ['CRM', 'Automations', 'Video Editor', 'Image Editor', 'Web Generator', 'Graphics', 'MaKo Mobile', 'Offer',
    'Estrategia 3 cuentas', 'Centro de Operaciones', 'MaKo Pricing', 'Onboarding', 'Plan - Perro Guardián', 'Seguridad',
    'Customer Success', 'Ads Manager', 'Integración Mercado Pago y Stripe'];
  const vistos = new Map<string, string>();
  for (const t of EQUIPO) {
    const a = aspectoDe(t);
    const k = `${a.forma}·${a.color}`;
    assert.ok(!vistos.has(k), `«${t}» y «${vistos.get(k)}» tienen el mismo muñeco (${k})`);
    vistos.set(k, t);
  }
  // Y un área renombrada es el mismo empleado.
  assert.deepEqual(aspectoDe('Chatbot'), aspectoDe('Automations'));
  assert.deepEqual(aspectoDe('Landing Generator'), aspectoDe('Web Generator'));
});

test('los ojos dicen el estado: cerrado duerme, trabajando parpadea, la foto vieja está cansada', () => {
  // Probado rompiéndolo: tomando «trabajando» aunque el dato sea viejo, el tercer assert da «trabajando».
  assert.equal(animoDe({ estado: 'cerrado', viejo: false }), 'dormido');
  assert.equal(animoDe({ estado: 'sin_dato', viejo: false }), 'dormido', 'sin dato no es despierto');
  assert.equal(animoDe({ estado: 'trabajando', viejo: true }), 'cansado');
  assert.equal(animoDe({ estado: 'trabajando', viejo: false }), 'trabajando');
  assert.equal(animoDe({ estado: 'abierto', viejo: false }), 'despierto');
});

test('una tarjeta pendiente va al empleado que preguntó, y con dos del mismo nombre no se adivina', () => {
  // Probado rompiéndolo: quedándose con el primero de dos chats del mismo título (en vez de no adivinar), el último
  // assert ve una tarjeta en el CRM de la cuenta 1, y falla éste.
  const S = (n: number) => `local_${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
  const chat = (n: number, titulo: string, cuenta: string) => ({ local: S(n), titulo, cuenta, vivo: true, estado: 'idle' as const, actividad: null });
  const carteros = [
    { cuenta: 'claude1', chats: [chat(1, 'CRM', 'claude1'), chat(2, 'Graphics', 'claude1')] },
    { cuenta: 'claude3', chats: [chat(3, 'CRM', 'claude3')] },
  ];
  const e = esperasPorChat([
    { chat: 'Lo que sea', destino: S(9), respuesta: null }, // con sesión: exacta, aunque ningún cartero la vea
    { chat: 'Graphics', destino: null, respuesta: null }, // título único
    { chat: 'Graphics', destino: null, respuesta: 'a' }, // ya contestada: no espera
    { chat: 'CRM', destino: null, respuesta: null }, // dos «CRM»: no se adivina
  ], carteros);
  assert.deepEqual(e, { [S(9)]: 1, [S(2)]: 1 });
});
