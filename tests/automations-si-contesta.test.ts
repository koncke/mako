// =============================================================================
// «Si el lead contesta: sigue / se corta», POR CAMINO del CRON (14/10/2026)
// =============================================================================
// Bug 5 del feedback del 13/10 («no salió el mensaje» de «Un Lead Agendó Llamada», #213 ws1): la reserva de
// Calendly reinició el flujo y el lead le contestó a Mauricio un mensaje a mano; `pausarPorRespuesta` (lib/nutricion.ts)
// frenó TODO lo que tenía por delante y el audio de los 5 minutos no salió. Era una regla escondida (sólo el carril
// del recordatorio seguía). Martín: «jamás que "mako" haga cosas que no están en el flujo», y eligió «Opción en cada
// camino, sigue de fábrica». La opción vive en el inicio (`si_contesta`) y la leen, con la MISMA función
// (`sigueSiContesta`), el motor (`alResponder`, `seMueveEnLaCorrida`) y «Probar» (`pausarPorRespuesta` del simulador).
//
// PROBADO ROMPIÉNDOLO (14/10/2026), cada rotura de a una y restaurada. Pasan / fallan:
//   R1 `SI_CONTESTA_DE_FABRICA` en 'corta'                                              → 6 / 2
//   R2 `alResponder` vuelve a quedarse sólo con el carril (`esHiloDelCarril`)            → 7 / 1
//   R3 `seMueveEnLaCorrida` sin mirar la opción (el carril siempre se mueve)             → 7 / 1
//   R4 `camposDelFlujo` sin la línea de `si_contesta` (la quinta puerta)                → 7 / 1
//   R5 `conectarParalelo` sin mudar la opción con la flecha del CRON                     → 7 / 1
//   R6 el simulador sin `salidaQueSigue` (vuelve a pausar todo)                           → 7 / 1
//
// Correr: node --import tsx --test tests/automations-si-contesta.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  caminosDeSalida, caminoDe, siContestaDe, sigueSiContesta, fijarSiContesta, algunCaminoSigue, normalizar, insertarNodo,
  indicePorId, SI_CONTESTA_DE_FABRICA, type PasoGrafo,
} from '../lib/flujo-grafo';
import { alResponder, seMueveEnLaCorrida, camposDelFlujo } from '../lib/nutricion-grafo-motor';
import { iniciar, pausarPorRespuesta, entrarEnRespuesta, siguiente } from '../lib/simulador-grafo';

const msg = (id: string, siguiente: string | null, cuerpo = id): PasoGrafo => ({ id, canal: 'whatsapp', cuerpo, siguiente, delay_horas: 0 });
const espera = (id: string, siguiente: string | null, minutos: number, modo: 'tiempo' | 'antes_reunion' = 'tiempo'): PasoGrafo =>
  ({ id, nodo: 'esperar', espera: { modo, minutos }, siguiente });

/** La forma de la #213 de hoy (ws1): la bienvenida por el principal, el aviso y el carril en paralelo, y el AI Step. */
function flujo213(si_contesta?: Record<string, 'corta' | 'sigue'>): PasoGrafo[] {
  return [
    espera('n0b3fpa', 'o0', 5),
    msg('o0', 'nh92v3h', 'audio de bienvenida'),
    espera('nh92v3h', 'o1', 120),
    msg('o1', null, '¿alcanzaste a ver el video?'),
    { id: 'u11aviso', canal: 'whatsapp', cuerpo: '', siguiente: null, accion: { operacion: 'avisar_al_equipo', params: {} } } as PasoGrafo,
    espera('u11e60', 'u11t60', 60, 'antes_reunion'),
    msg('u11t60', null, 'en 1 hora'),
    { id: 'nb7dt1y', nodo: 'respuesta', paso_ia: true, casos: [], si_no: null } as PasoGrafo,
    { id: 'entrada', nodo: 'inicio', siguiente: 'n0b3fpa', paralelos: ['u11aviso', 'u11e60'], ...(si_contesta ? { si_contesta } : {}) } as PasoGrafo,
  ];
}
const idx = (pasos: readonly PasoGrafo[], id: string) => indicePorId(pasos, id);

test('los caminos son las flechas del CRON, y cada tarjeta es del suyo (lo de «Si responde», de ninguno)', () => {
  const p = normalizar(flujo213());
  assert.deepEqual(caminosDeSalida(p), [{ clave: 'p', raiz: 'n0b3fpa' }, { clave: 'u11aviso', raiz: 'u11aviso' }, { clave: 'u11e60', raiz: 'u11e60' }]);
  const c = caminoDe(p);
  for (const id of ['n0b3fpa', 'o0', 'nh92v3h', 'o1']) assert.equal(c.get(id), 'p', id);
  assert.equal(c.get('u11t60'), 'u11e60');
  assert.equal(c.has('nb7dt1y'), false, 'el AI Step no es de ningún camino');
  assert.equal(c.has('entrada'), false);
});

test('de fábrica SIGUE; lo que dice el CRON manda; un camino que no existe no se guarda', () => {
  assert.equal(SI_CONTESTA_DE_FABRICA, 'sigue');
  const p = normalizar(flujo213({ p: 'corta', fantasma: 'corta' }));
  assert.equal(siContestaDe(p, 'p'), 'corta');
  assert.equal(siContestaDe(p, 'u11aviso'), 'sigue', 'sin la clave, el de fábrica');
  assert.deepEqual(p.find((x) => x.id === 'entrada')!.si_contesta, { p: 'corta' }, 'normalizar limpia lo que no es un camino');
  assert.equal(sigueSiContesta(p, idx(p, 'o1')), false);
  assert.equal(sigueSiContesta(p, idx(p, 'u11t60')), true);
  assert.equal(algunCaminoSigue(p), true);
  assert.equal(algunCaminoSigue(normalizar(flujo213({ p: 'corta', u11aviso: 'corta', u11e60: 'corta' }))), false);
});

test('fijar: sin tarjeta CRON en el dato la crea (como la primera flecha en paralelo); con ella, cambia sólo esa clave', () => {
  const simple = [msg('a', 'b'), msg('b', null)];
  const con = fijarSiContesta(simple, 'p', 'corta');
  const ini = con.find((x) => x.nodo === 'inicio')!;
  assert.equal(ini.siguiente, 'a');
  assert.deepEqual(ini.si_contesta, { p: 'corta' });
  assert.equal(siContestaDe(con, 'p'), 'corta');
  const otra = fijarSiContesta(normalizar(flujo213({ p: 'corta' })), 'u11e60', 'corta');
  assert.deepEqual(otra.find((x) => x.id === 'entrada')!.si_contesta, { p: 'corta', u11e60: 'corta' });
  assert.deepEqual(fijarSiContesta(simple, 'nada', 'corta'), normalizar(simple), 'un camino que no existe no cambia nada');
});

test('la opción viaja con la flecha del CRON: insertar en el medio la muda a la tarjeta nueva', () => {
  const p = normalizar(flujo213({ u11aviso: 'corta' }));
  const out = insertarNodo(p, { nodo: 'entrada', puerto: 'par:u11aviso' }, msg('nuevo', null));
  const ini = out.find((x) => x.id === 'entrada')!;
  assert.deepEqual(ini.paralelos, ['nuevo', 'u11e60']);
  assert.equal(siContestaDe(out, 'nuevo'), 'corta', 'la opción se quedó en la clave vieja');
});

test('el motor, al contestar: siguen los hilos de un camino que SIGUE; los demás se cortan (también el carril si su camino corta)', () => {
  const p = normalizar(flujo213({ p: 'sigue', u11aviso: 'corta', u11e60: 'corta' }));
  const hilos = [
    { h: 'p', nodo: 'nh92v3h', proximo: '2026-10-13T04:10:00.000Z' },
    { h: 'u11e60', nodo: 'u11e60', proximo: '2026-10-14T05:00:00.000Z' },
  ];
  const r = alResponder(p, { paso_actual: idx(p, 'nh92v3h'), nodo_actual: 'nh92v3h', proximo_envio_at: hilos[0].proximo, hilos }, '2026-10-13T02:08:16.000Z');
  assert.equal(r.carril, true);
  assert.deepEqual((r.update.hilos as Array<{ h: string }>).map((x) => x.h), ['p'], 'el bug 5: la bienvenida tenía que seguir');
  // Un cursor solo: sigue si su camino sigue.
  const solo = alResponder(p, { paso_actual: idx(p, 'o1'), nodo_actual: 'o1', proximo_envio_at: '2026-10-13T04:10:00.000Z' }, '2026-10-13T02:08:16.000Z');
  assert.equal(solo.carril, true);
});

test('el motor, en una inscripción que respondió: mueve lo que SIGUE y nada más', () => {
  const p = normalizar(flujo213({ p: 'corta', u11e60: 'corta' }));
  assert.equal(seMueveEnLaCorrida(p, idx(p, 'o1'), { enRespuesta: true, fueraDeHorario: false }), false);
  assert.equal(seMueveEnLaCorrida(p, idx(p, 'u11t60'), { enRespuesta: true, fueraDeHorario: false }), false, 'el carril ya no se salva solo');
  const q = normalizar(flujo213({ p: 'sigue' }));
  assert.equal(seMueveEnLaCorrida(q, idx(q, 'o1'), { enRespuesta: true, fueraDeHorario: false }), true);
  // Sin respuesta, lo de siempre.
  assert.equal(seMueveEnLaCorrida(p, idx(p, 'o1'), { enRespuesta: false, fueraDeHorario: false }), true);
});

test('la quinta puerta: el saneo del motor guarda la opción del inicio (y sólo valores que existen)', () => {
  const c = camposDelFlujo({ id: 'entrada', nodo: 'inicio', siguiente: 'a', si_contesta: { p: 'corta', u11e60: 'sigue', x: 'quizas' } });
  assert.deepEqual(c.si_contesta, { p: 'corta', u11e60: 'sigue' });
  assert.equal(camposDelFlujo({ id: 'a', canal: 'whatsapp', si_contesta: { p: 'corta' } }).si_contesta, undefined, 'sólo el inicio');
});

test('«Probar»: al contestar, lo que SIGUE queda y vuelve a correr cuando termina la respuesta (o enseguida sin «Si responde»)', () => {
  // Sin «Si responde»: la salida sigue enseguida.
  const pasos = normalizar([msg('a', 'b', 'hola'), msg('b', null, 'segundo'), { id: 'entrada', nodo: 'inicio', siguiente: 'a' } as PasoGrafo]);
  let st = siguiente(pasos, iniciar(pasos)).estado; // salió «hola»; el hilo queda en «b»
  const p = pausarPorRespuesta(st, pasos);
  assert.equal(p.siguen, 1);
  assert.equal(p.pausoLaSalida, false);
  st = entrarEnRespuesta(pasos, p.estado, null).estado;
  const e = siguiente(pasos, st);
  assert.equal(e.evento?.t, 'mensaje');
  assert.equal((e.evento as { nodo: string }).nodo, 'b', 'el segundo mensaje no salió');
  // Con la opción en «se corta», como antes.
  const cortada = fijarSiContesta(pasos, 'p', 'corta');
  const st2 = siguiente(cortada, iniciar(cortada)).estado;
  const p2 = pausarPorRespuesta(st2, cortada);
  assert.equal(p2.siguen, 0);
  assert.equal(p2.pausoLaSalida, true);
});
