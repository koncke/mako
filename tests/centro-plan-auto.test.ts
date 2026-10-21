// =============================================================================
// El Plan de cada chat se arma solo: «Voy a trabajar en…» crea su tarea y «Ya está» la marca hecha (17/10/2026)
// =============================================================================
// Martín (la C y la D del feedback del 17/10): «Marcar resuelta una tarea o un proyecto cuando algo ya está es
// AUTOMÁTICO, siempre», y «con "Voy a trabajar en…" y "Ya está", el Plan de cada chat se arma solo: no puede haber chats
// con el Plan vacío». Lo que se fija (lib/centro-plan-auto-reglas.ts, lib/centro-plan-auto.ts, lib/operaciones.ts):
//   1. «Voy a trabajar en X» crea una tarea «X»; otro «Voy a…» con una abierta no crea otra; «Ya está» la deja para
//      marcarla hecha, y sin abierta crea y cierra una;
//   2. una PC que vuelve a subir los mismos turnos no duplica nada; tampoco el «Voy a…» que se dijo con otra abierta, una
//      vez que la cerró un «Ya está» (revisión de la ola 1, 21/10/2026), y la vuelta anota el Plan sólo si avanza;
//   3. lo que se hace en el Plan va en orden (crear antes de cerrar), y lo que falla tres veces no se reintenta más;
//   4. la vuelta del Runner anota rápido y aplica DESPUÉS de contestar, con el actor «MaKo · Ops Center».
//
// Probado rompiéndolo (17/10/2026, con la base en 0 fallos):
//   · `anotarTurnos` creando con una abierta → 1 fallo (1);
//   · sin mirar los turnos ya vistos → 1 fallo (2);
//   · `conResultado` sin el tope de intentos → 1 fallo (3);
//   · la vuelta aplicando en el acto (sin `after`) → 1 fallo (4);
//   · (21/10) sin anotar el «Voy a…» saltado → 1 fallo (2); `sanearTareasDelChat` sin guardarlo → 1 fallo (2); el Plan
//     anotado aunque la vuelta no avance → 1 fallo (2).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { anotarTurnos, conResultado, esVoyATrabajar, proximoPaso, sanearTareasDelChat, tituloDeVoy, tituloDeYa, type TareaDelChat } from '../lib/centro-plan-auto-reglas';
import type { TurnoChat } from '../lib/operaciones-reglas';

const L = 'local_11111111-1111-4111-8111-111111111111';
let n = 0;
const dice = (texto: string, rol: TurnoChat['rol'] = 'el'): TurnoChat => {
  n += 1;
  return { local: L, uuid: `u${String(n).padStart(4, '0')}`, rol, de: null, texto, at: new Date(Date.parse('2026-10-17T12:00:00Z') + n * 60_000).toISOString(), trabajo: null };
};

test('«Voy a trabajar en…» y su título; «Ya está» y el suyo', () => {
  assert.equal(esVoyATrabajar('**Voy a trabajar en** el filtro del CRM, para que…'), true);
  assert.equal(esVoyATrabajar('Ahora voy a trabajar en esto'), false, 'sólo al principio');
  assert.equal(tituloDeVoy('Voy a trabajar en el filtro del CRM.'), 'El filtro del CRM');
  assert.equal(tituloDeVoy('Voy a trabajar en'), null);
  assert.equal(tituloDeYa('✅ Ya está: el filtro del CRM.\nPruébalo en /crm'), 'El filtro del CRM');
  assert.equal(tituloDeYa('Ya está'), 'Ya está');
});

test('1. «Voy a…» crea, otro con una abierta no, «Ya está» la cierra, y sin abierta crea y cierra', () => {
  const v1 = dice('Voy a trabajar en el filtro del CRM.');
  const v2 = dice('Voy a trabajar en la columna nueva.');
  const y1 = dice('Ya está: el filtro.');
  const y2 = dice('Ya está: el arreglo suelto.');
  const yo = dice('Voy a trabajar en algo que escribió Martín', 'yo');
  const lista = anotarTurnos([], [v1, v2, y1, y2, yo], 'CRM');
  assert.deepEqual(lista.map((t) => [t.titulo, t.voy, t.ya, t.estado]), [
    ['El filtro del CRM', v1.uuid, y1.uuid, 'pendiente'],
    ['El arreglo suelto', null, y2.uuid, 'pendiente'],
  ], 'el segundo «Voy a…» es el mismo trabajo que sigue; lo de Martín no cuenta');
  assert.equal(lista[0].chat, 'CRM', 'su proyecto es el del jefe');
});

test('2. los mismos turnos subidos dos veces no duplican nada', () => {
  const v = dice('Voy a trabajar en el borrador.');
  const y = dice('Ya está: el borrador.');
  const una = anotarTurnos([], [v, y], 'CRM');
  assert.deepEqual(anotarTurnos(una, [v, y], 'CRM'), una);
  // El caso de la revisión: T0 abierta; «Voy a… B» (saltado: T0 sigue abierta) y «Ya está» (cierra T0). Re-subida la
  // tanda, con T0 ya cerrada, el «Voy a… B» no crea una tarea de más. La lista va guardada y releída (`sanearTareasDelChat`).
  const t0 = anotarTurnos([], [dice('Voy a trabajar en lo de antes.')], 'CRM');
  const tanda = [dice('Voy a trabajar en la ficha nueva.'), dice('Ya está: lo de antes.')];
  const vuelta = sanearTareasDelChat(JSON.parse(JSON.stringify(anotarTurnos(t0, tanda, 'CRM'))));
  assert.deepEqual(vuelta.map((t) => t.titulo), ['Lo de antes'], 'la primera vez, sólo cierra la abierta');
  assert.deepEqual(anotarTurnos(vuelta, tanda, 'CRM').map((t) => [t.titulo, t.ya != null]), [['Lo de antes', true]], 'y la tanda re-subida no crea otra');
  // La vuelta anota el Plan DESPUÉS de las preguntas, y sólo si avanza.
  const ciclo = leer('lib/operaciones.ts');
  assert.ok(ciclo.indexOf('await anotarTurnosDelPlan(') > ciclo.indexOf('preguntasIds = await guardarPreguntas(preguntas)'), 'después de las preguntas');
  assert.match(ciclo, /if \(turnos\.length && turnosOk\) \{\s*const titulos[\s\S]{0,120}await anotarTurnosDelPlan\(turnos, titulos\)/, 'y sólo si la vuelta avanza');
});

test('3. en el Plan: crear antes de cerrar, y lo que falla tres veces queda «no se pudo»', () => {
  const v = dice('Voy a trabajar en la caja.');
  let lista: TareaDelChat[] = anotarTurnos([], [v, dice('Ya está: la caja.')], 'CRM');
  assert.equal(proximoPaso(lista)?.accion, 'crear');
  lista = conResultado(lista, lista[0], { ok: true, tarea: 'T1' });
  assert.deepEqual([lista[0].estado, lista[0].tarea, proximoPaso(lista)?.accion], ['creada', 'T1', 'cerrar']);
  lista = conResultado(lista, lista[0], { ok: true });
  assert.equal(lista[0].estado, 'hecha');
  assert.equal(proximoPaso(lista), null);
  // Lo que el Plan no acepta se reintenta, pero no para siempre.
  let otra = anotarTurnos([], [dice('Voy a trabajar en lo que falla.')], 'CRM');
  for (let i = 0; i < 3; i++) otra = conResultado(otra, otra[0], { ok: false });
  assert.equal(otra[0].estado, 'no_se_pudo');
  assert.equal(proximoPaso(otra), null);
  // Creada pero sin encontrarla en el tablero (el Perro la fusionó o la mandó a otro lado): no se puede cerrar, y se dice.
  const suelta = anotarTurnos([], [dice('Voy a trabajar en otra.')], 'CRM');
  assert.equal(conResultado(suelta, suelta[0], { ok: true, tarea: null })[0].estado, 'no_se_pudo');
});

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/^[ \t]*\/\/.*$/gm, '');

test('4. la vuelta anota rápido y aplica después de contestar, con el actor de MaKo', () => {
  const ciclo = leer('lib/operaciones.ts');
  assert.match(ciclo, /await anotarTurnosDelPlan\(turnos, titulos\)/, 'anota con los turnos que entraron');
  assert.match(ciclo, /after\(\(\) => aplicarPlanDeLosChats\(/, 'y aplica en after(): el Runner corta a los 120 s');
  const auto = leer('lib/centro-plan-auto.ts');
  assert.match(auto, /actor: 'MaKo · Ops Center'/, 'el historial dice que fue MaKo');
  assert.match(auto, /sumarTareaAlPlan\(ctx,[\s\S]*cerrarTareaDelPlan\(ctx,/, 'por las operaciones de la API de MaKo, como todo el Centro');
  assert.doesNotMatch(auto, /from\('plan_tareas'\)/, 'ninguna escritura directa al tablero');
});
