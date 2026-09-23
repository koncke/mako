import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textoVencimientos, clasificarVencimientos, huellaVencimientos, type ResumenVencimientos } from '../lib/plan-vencimientos';

// ---------------------------------------------------------------------------
// El aviso de proyectos que vencen: UNO solo, y que se pueda leer
// ---------------------------------------------------------------------------
// «Las notificaciones de WhatsApp son demasiadas, y ninguna avisa que un proyecto está
// por vencer o atrasado» (22/09/2026). Las dos mitades del pedido se contradicen si el
// aviso sale uno por proyecto: con 70 proyectos eso son 13 mensajes una mañana cualquiera.
//
// ⚠️ PROBADO ROMPIÉNDOLO, con los números de cada rotura (6 tests en total):
//   · sin el `return null` cuando no hay nada → 5 pasan, 1 falla («sin nada, no hay mensaje»);
//   · sin el corte en 5 + «y N más»          → 5 pasan, 1 falla («una lista larga se corta»);
//   · con la huella usando los días crudos   → 5 pasan, 1 falla (la del hostigamiento diario).
// Cada rotura tira un test distinto, así que ninguno está midiendo de prestado.

const vacio: ResumenVencimientos = { atrasados: [], porVencer: [] };

test('sin nada que deber, NO hay mensaje', () => {
  assert.equal(textoVencimientos(vacio), null);
});

test('un atrasado y uno por vencer entran los dos, con su conteo de tareas', () => {
  const r: ResumenVencimientos = {
    atrasados: [{ nombre: 'Feature: Plan', dias: 3, abiertas: 10 }],
    porVencer: [{ nombre: 'Agente: Chatbot', dias: 1, abiertas: 20 }],
  };
  const m = textoVencimientos(r)!;
  assert.match(m.titulo, /1 proyecto atrasado y 1 por vencer/);
  assert.match(m.texto, /Feature: Plan — 3 días, 10 tareas abiertas/);
  assert.match(m.texto, /Agente: Chatbot — mañana, 20 tareas abiertas/);
});

test('una lista larga se corta en 5 y dice cuántos quedan', () => {
  const r: ResumenVencimientos = {
    atrasados: Array.from({ length: 8 }, (_, i) => ({ nombre: `P${i}`, dias: i + 1, abiertas: 1 })),
    porVencer: [],
  };
  const m = textoVencimientos(r)!;
  const vinetas = (m.texto.match(/^• /gm) ?? []).length;
  assert.equal(vinetas, 6, '5 proyectos + la línea del resto');
  assert.match(m.texto, /y 3 más/);
});

test('el singular y el plural no quedan mal escritos', () => {
  const m = textoVencimientos({ atrasados: [], porVencer: [{ nombre: 'X', dias: 0, abiertas: 1 }] })!;
  assert.match(m.titulo, /1 proyecto vence esta semana/);
  assert.match(m.texto, /X — hoy, 1 tarea abierta/);
});

test('un proyecto TERMINADO no se persigue por una fecha vieja', () => {
  const r = clasificarVencimientos([
    { nombre: 'Terminado', deadline: '2026-01-01', abiertas: 0 },
    { nombre: 'Vivo', deadline: '2026-01-01', abiertas: 2 },
  ], '2026-09-23');
  assert.deepEqual(r.atrasados.map((p) => p.nombre), ['Vivo']);
});

test('la huella NO cambia sola con los días de atraso (si no, avisa todas las mañanas)', () => {
  const hoy = clasificarVencimientos([{ nombre: 'P', deadline: '2026-07-24', abiertas: 1 }], '2026-09-23');
  const manana = clasificarVencimientos([{ nombre: 'P', deadline: '2026-07-24', abiertas: 1 }], '2026-09-24');
  assert.notEqual(hoy.atrasados[0].dias, manana.atrasados[0].dias, 'el atraso sí crece');
  assert.equal(huellaVencimientos(hoy), huellaVencimientos(manana), 'pero el aviso es el mismo');
});
