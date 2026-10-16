// =============================================================================
// El Plan adentro de cada chat jefe (16/10/2026) — lo que, roto, no da error y muestra otra cosa
// =============================================================================
// Martín: «Los chats y el Centro deberían poder conectarse con el PLAN... Crear tareas nuevas, marcar como
// completadas». Cada jefe ES un proyecto del Plan (se llaman como la tab). Lo que se fija:
//   · el proyecto del jefe se encuentra aunque el tablero lo guarde como «Feature: CRM» (la revisión del 16/10 encontró
//     la lista SIEMPRE vacía con datos reales, y el test de antes pasaba porque su fixture decía «CRM»);
//   · el listado se sanea: lo que no tiene forma de tarea no se dibuja, y las recurrentes no se marcan hechas;
//   · un pedido se vuelve tarea con su texto TEXTUAL en el detalle (lo que no queda ahí se pierde);
//   · la pantalla dice si ya estaba, si el Perro la fusionó o la puso en otro proyecto;
//   · la ruta pregunta por Martín con su segundo factor ANTES de hacer cualquier otra cosa.
//
// ⚠️ Probado ROMPIÉNDOLO (16/10/2026), contra la base en verde de 5 pases:
//   · comparando el nombre sin `nucleo` (sin el prefijo «Feature:») → 2 fallos («el proyecto del jefe» y «dónde quedó»);
//   · dejando pasar las recurrentes → 1 fallo («el listado se sanea»);
//   · el Cerebro con proyecto (su propio nombre) → 1 fallo («el proyecto del jefe»);
//   · el detalle sin el pedido textual → 1 fallo («un pedido como tarea»);
//   · «Sumada al Plan» aunque no naciera ninguna → 1 fallo («dónde quedó»);
//   · la ruta leyendo el body antes de la guarda → 1 fallo («la ruta»).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  avisoDeAlta, avisoDeYaEstaba, dondeQuedo, evidenciaDeCierre, proyectoDelChat, proyectoDelJefe, proyectosDelListado, tareaDePedido,
  tareasDelListado, tituloValido, yaAbierta,
} from '../lib/centro-plan-reglas';

// Como lo devuelve `listar_tareas_plan` en el tablero del super admin: el proyecto con su prefijo canónico.
const listado = JSON.stringify({
  board: 'dueno', total_abiertas: 5,
  tareas: [
    { id: 't1', num: 12, titulo: 'Filtro por etapa', score: 80, prioridad: 'alta', avance_pct: 40, deadline: '2026-10-21', proyecto: 'Feature: CRM' },
    { id: 't3', titulo: 'Portada del informe', score: 60, prioridad: 'baja', avance_pct: 0, deadline: '2026-10-18', proyecto: 'Feature: Dashboard' },
    { id: 't4', titulo: 'Junta de los lunes', score: 85, prioridad: 'media', avance_pct: 0, proyecto: 'Feature: CRM', se_repite: true },
    { titulo: 'sin id', proyecto: 'Feature: CRM' },
    { id: 't5', titulo: 'Sin proyecto', avance_pct: 250, deadline: 'mañana', proyecto: null },
    'basura',
  ],
  proyectos: [{ id: 'p1', nombre: 'Feature: CRM' }, { id: 'p2', nombre: 'Feature: Dashboard' }, { id: 'p3', nombre: 'Agente: Closing Analyst' }, { nombre: 'sin id' }],
});

test('el listado se sanea: sin recurrentes, sin filas rotas, con topes', () => {
  const ts = tareasDelListado(listado);
  assert.deepEqual(ts.map((t) => t.id), ['t1', 't3', 't5'], 'la recurrente y la fila sin id no entran');
  const t5 = ts.find((t) => t.id === 't5')!;
  assert.equal(t5.avance, 100, 'el avance se acota');
  assert.equal(t5.deadline, null, 'una fecha que no es fecha no se dibuja');
  assert.equal(ts[0].num, 12);
  assert.deepEqual(tareasDelListado('no es json'), []);
  assert.deepEqual(tareasDelListado('{"tareas": 3}'), []);
  // `ver_proyecto_plan` las trae en `abiertas`.
  assert.deepEqual(tareasDelListado(JSON.stringify({ abiertas: [{ id: 'a', titulo: 'Una' }] }), 'abiertas').map((t) => t.id), ['a']);
});

test('el proyecto del jefe: «Feature: CRM» es CRM, un sub-chat trabaja para su jefe, y el Cerebro no tiene', () => {
  const ps = proyectosDelListado(listado);
  assert.deepEqual(ps.map((p) => p.id), ['p1', 'p2', 'p3'], 'un proyecto sin id no entra');
  assert.equal(proyectoDelJefe(ps, 'CRM')?.id, 'p1', 'sin el prefijo del tablero');
  assert.equal(proyectoDelJefe(ps, 'crm › Funnels')?.id, 'p1', 'un sub-chat, el de su jefe; sin mayúsculas');
  assert.equal(proyectoDelJefe(ps, 'Closing Analyst')?.id, 'p3', 'también con «Agente:»');
  assert.equal(proyectoDelJefe(ps, 'Automations'), null, 'un jefe que no es un proyecto: la pantalla lo dice');
  assert.equal(proyectoDelChat('Cerebro'), null, 'el Cerebro reparte: no tiene proyecto');
  assert.equal(proyectoDelChat('Estrategia 3 cuentas'), null, 'tampoco con su nombre de antes');
  assert.equal(proyectoDelJefe([{ id: 'x', nombre: 'Cerebro' }], 'Cerebro'), null);
});

test('un pedido como tarea: título de un renglón, y el pedido TEXTUAL en el detalle con de dónde salió', () => {
  const texto = 'Que el tablero permita arrastrar varias tarjetas a la vez y deshacer el movimiento entero, como en Trello cuando seleccionas varias.\nY que lo anote.';
  const t = tareaDePedido(texto, 'CRM › Funnels');
  assert.ok(t.titulo.length <= 121 && !t.titulo.includes('\n'), 'un renglón, cortado en una palabra');
  assert.ok(t.detalle.startsWith(texto), 'el pedido entero, textual');
  assert.match(t.detalle, /Centro de Operaciones, en el chat «CRM › Funnels»/);
  assert.ok(evidenciaDeCierre('CRM').length >= 10, 'proponer_cierre_tareas pide 10 caracteres de evidencia');
  assert.deepEqual(tituloValido('  ab '), { ok: false, error: 'Escribe la tarea para sumarla al Plan.' });
  assert.equal(tituloValido('x'.repeat(201)).ok, false, 'se rechaza, no se recorta');
  assert.deepEqual(tituloValido(' Revisar   el filtro '), { ok: true, titulo: 'Revisar el filtro' });
});

test('dónde quedó: ya estaba, el Perro la fusionó, o la puso en otro proyecto', () => {
  const ts = tareasDelListado(listado);
  assert.equal(yaAbierta(ts, ' filtro  POR etapa ')?.id, 't1', 'el mismo título sin mayúsculas ni espacios de más');
  assert.equal(yaAbierta(ts, 'Filtro por etapa del CRM'), null, 'otro título no es la misma');
  assert.deepEqual(dondeQuedo(ts, 'Filtro por etapa', 'CRM › Funnels'), { enEsteChat: true, proyecto: 'Feature: CRM' });
  assert.deepEqual(dondeQuedo(ts, 'Portada del informe', 'CRM'), { enEsteChat: false, proyecto: 'Feature: Dashboard' });
  assert.equal(dondeQuedo(ts, 'No existe', 'CRM'), null, 'si no se encuentra, no se inventa');
  assert.equal(avisoDeAlta(1, { enEsteChat: true, proyecto: 'Feature: CRM' }), 'Sumada al Plan');
  assert.equal(avisoDeAlta(1, { enEsteChat: false, proyecto: 'Feature: Dashboard' }), 'Quedó en «Dashboard»');
  assert.equal(avisoDeAlta(0, { enEsteChat: true, proyecto: 'Feature: CRM' }), 'Ya estaba: le sumé esto', '0 creadas = se fusionó con una que había');
  assert.equal(avisoDeAlta(1, null), 'Sumada al Plan');
  assert.equal(avisoDeYaEstaba({ titulo: 'Filtro por etapa', proyecto: 'Feature: CRM' }), 'Ya hay «Filtro por etapa» en «CRM»: no sumé nada', 'dice cuál y dónde: puede ser otra con el mismo renglón');
});

test('la ruta pregunta por Martín con su segundo factor ANTES de hacer cualquier otra cosa', () => {
  const src = readFileSync('app/api/centro/plan/route.ts', 'utf8').replace(/\/\/.*$/gm, '');
  for (const m of ['GET', 'POST']) {
    const i = src.indexOf(`export async function ${m}(`);
    assert.ok(i > 0, m);
    const cuerpo = src.slice(src.indexOf('{', i) + 1).trimStart();
    assert.match(cuerpo, /^const (\w+) = await getSesionAdmin\(\);\s*if \(!puedeOperar\(\1, await wsSuperAdmin\(\)\)\) return /, `${m}: la guarda del Centro primero`);
  }
  const post = src.slice(src.indexOf('export async function POST('));
  assert.ok(post.indexOf('origenValido(req)') > 0 && post.indexOf('origenValido(req)') < post.indexOf('req.json()'), 'el POST mira el origen antes de leer el cuerpo');
  assert.equal((src.match(/export async function /g) ?? []).length, 2, 'una puerta nueva en esta ruta entra a este test');
});
