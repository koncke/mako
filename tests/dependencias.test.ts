// =============================================================================
// Dependencias del plan: qué frena qué, y qué le pasa a la prioridad
// =============================================================================
// El pedido que las trajo (2026-08-21): «Hay proyectos y tareas que DEPENDEN de otros…
// el de Cobros y Planes depende totalmente de que se termine la oferta y precios».
//
// Lo que se fija acá son las DOS invariantes, que son distintas y se confunden fácil:
//   1. la IMPORTANCIA sube del bloqueado al bloqueante (lo que destraba algo importante
//      es al menos tan importante como lo que destraba);
//   2. la EJECUTABILIDAD baja, pero el SCORE NO — un trabajo bloqueado sigue valiendo lo
//      que vale; lo que no puede es aparecer en la lista de «qué hago ahora».
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanearDep, puedeDepender, resolverDeps, estaBloqueada, type Dep, type TareaDep } from '../app/plan/board/dependencias';

const T = (id: string, score: number, extra: Partial<TareaDep> = {}): TareaDep =>
  ({ id, num: Number(id.replace(/\D/g, '')) || 1, score, progress: 0, labels: [], ...extra });

const D = (deId: string, aId: string, extra: Partial<Dep> = {}): Dep =>
  ({ entidad: 'tarea', deId, aId, clase: 'bloquea', razon: 'porque sí', origen: 'user', ...extra });

// ── Saneo ────────────────────────────────────────────────────────────────────────────

test('sanearDep — una arista a sí misma se descarta: es el ciclo más barato de crear', () => {
  assert.equal(sanearDep({ deId: 't1', aId: 't1' }), null);
});

test('sanearDep — sin las dos puntas no hay arista', () => {
  assert.equal(sanearDep({ deId: 't1' }), null);
  assert.equal(sanearDep({ aId: 't1' }), null);
  assert.equal(sanearDep(null), null);
  assert.equal(sanearDep('t1 depende de t2'), null);
});

test('sanearDep — el default de clase es la DURA, que es lo que el dueño pidió', () => {
  assert.equal(sanearDep({ deId: 'a', aId: 'b' })?.clase, 'bloquea');
  assert.equal(sanearDep({ deId: 'a', aId: 'b', clase: 'ordena' })?.clase, 'ordena');
  assert.equal(sanearDep({ deId: 'a', aId: 'b', clase: 'pomelo' })?.clase, 'bloquea');
});

test('sanearDep — una arista puesta a mano NO lleva confianza', () => {
  // «Confianza» es cuánto se cree la IA lo que dijo. Una persona no tiene confianza: decidió.
  assert.equal(sanearDep({ deId: 'a', aId: 'b', origen: 'user', confianza: 'alta' })?.confianza, undefined);
  assert.equal(sanearDep({ deId: 'a', aId: 'b', origen: 'ia', confianza: 'alta' })?.confianza, 'alta');
  assert.equal(sanearDep({ deId: 'a', aId: 'b', origen: 'ia', confianza: 'segurísimo' })?.confianza, undefined);
});

test('sanearDep — un actor que no existe cae en «ia», no rompe', () => {
  assert.equal(sanearDep({ deId: 'a', aId: 'b', origen: 'MaKo' })?.origen, 'ia');
});

// ── Ciclos ───────────────────────────────────────────────────────────────────────────

test('puedeDepender — un círculo directo se rechaza y dice el camino', () => {
  const deps = [D('b', 'a')];               // b espera a a
  const r = puedeDepender(deps, 'tarea', 'a', 'b');   // …y ahora a querría esperar a b
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.camino.includes('b'), 'el camino tiene que nombrar al culpable');
});

test('puedeDepender — un círculo LARGO también, que es el que un guard en negativo deja pasar', () => {
  const deps = [D('b', 'a'), D('c', 'b'), D('d', 'c')];
  assert.equal(puedeDepender(deps, 'tarea', 'a', 'd').ok, false, 'a→d cerraría el anillo de 4');
});

test('puedeDepender — lo que NO es círculo se deja pasar', () => {
  const deps = [D('b', 'a'), D('c', 'b')];
  assert.equal(puedeDepender(deps, 'tarea', 'd', 'a').ok, true);
  assert.equal(puedeDepender(deps, 'tarea', 'c', 'a').ok, true, 'un atajo sobre la misma cadena no es un ciclo');
});

test('puedeDepender — una arista a sí mismo es un ciclo de largo 1', () => {
  assert.equal(puedeDepender([], 'tarea', 'a', 'a').ok, false);
});

test('puedeDepender — los proyectos no se mezclan con las tareas', () => {
  const deps = [D('b', 'a', { entidad: 'proyecto' })];
  assert.equal(puedeDepender(deps, 'tarea', 'a', 'b').ok, true, 'la arista de proyecto no gobierna el grafo de tareas');
  assert.equal(puedeDepender(deps, 'proyecto', 'a', 'b').ok, false);
});

test('puedeDepender — con datos YA sucios (un ciclo guardado) no se cuelga', () => {
  // El guard cubre la escritura nueva; los datos viejos y las escrituras concurrentes no.
  const deps = [D('a', 'b'), D('b', 'a')];
  assert.equal(puedeDepender(deps, 'tarea', 'c', 'a').ok, true);
});

// ── La invariante 1: la importancia sube por la cadena ───────────────────────────────

test('el bloqueante HEREDA la urgencia de lo que destraba', () => {
  // El caso del dueño: «Cobros y planes» (98) depende de «Oferta y precios» (51).
  const est = resolverDeps({ tareas: [T('t1', 51), T('t2', 98)], deps: [D('t2', 't1')] });
  assert.equal(est.urgencia.t1, 98, 'lo que destraba un 98 vale 98');
  assert.equal(est.urgencia.t2, 98, 'y el bloqueado no cambia de valor');
  assert.equal(est.orden[0].id, 't1', 'y el bloqueante va PRIMERO');
});

test('la urgencia se propaga por toda la cadena, no solo un escalón', () => {
  const est = resolverDeps({ tareas: [T('t1', 10), T('t2', 20), T('t3', 90)], deps: [D('t3', 't2'), D('t2', 't1')] });
  assert.equal(est.urgencia.t1, 90, 'el primero de la fila hereda del último');
  assert.equal(est.orden.map((t) => t.id).join(), 't1,t2,t3');
});

test('la urgencia NUNCA baja el score propio: es un piso, no un reemplazo', () => {
  const est = resolverDeps({ tareas: [T('t1', 95), T('t2', 30)], deps: [D('t2', 't1')] });
  assert.equal(est.urgencia.t1, 95, 'destrabar algo chico no puede hundir al bloqueante');
});

test('un bloqueante YA TERMINADO no bloquea ni hereda nada', () => {
  const est = resolverDeps({ tareas: [T('t1', 10, { progress: 100 }), T('t2', 90)], deps: [D('t2', 't1')] });
  assert.equal(estaBloqueada('t2', est), false);
  assert.equal(est.urgencia.t1, undefined, 'una tarea cerrada ni entra al ranking');
});

test('una arista COLGADA (a un id que ya no existe) se ignora, no rompe el tablero', () => {
  // No hay foreign key posible: la PK de plan_tareas es compuesta y la tabla mezcla dos
  // niveles. Un borrado deja punteros muertos y el tablero tiene que seguir andando.
  const est = resolverDeps({ tareas: [T('t2', 90)], deps: [D('t2', 'fantasma')] });
  assert.equal(estaBloqueada('t2', est), false);
  assert.equal(est.orden.length, 1);
});

test('«ordena» no toca NINGÚN número — es la distinción textual del dueño', () => {
  // «puede que haya algunos que estén correlacionados, pero iniciar no depende del anterior»
  const blanda = resolverDeps({ tareas: [T('t1', 10), T('t2', 90)], deps: [D('t2', 't1', { clase: 'ordena' })] });
  const sinNada = resolverDeps({ tareas: [T('t1', 10), T('t2', 90)], deps: [] });
  assert.deepEqual(blanda.urgencia, sinNada.urgencia);
  assert.equal(estaBloqueada('t2', blanda), false, 'una correlación no frena nada');
  assert.deepEqual(blanda.orden.map((t) => t.id), sinNada.orden.map((t) => t.id));
});

// ── La invariante 2: baja la ejecutabilidad, NO el score ─────────────────────────────

test('un bloqueado sigue valiendo lo que vale — no se hunde al fondo', () => {
  const est = resolverDeps({
    tareas: [T('t1', 40), T('t2', 90), T('t3', 5)],
    deps: [D('t2', 't1')],
  });
  // t2 está bloqueada por t1, pero sigue por encima de t3 (que vale 5 y no la bloquea nadie).
  const pos = est.orden.map((t) => t.id);
  assert.ok(pos.indexOf('t2') < pos.indexOf('t3'), 'hundir lo bloqueado sería mentir sobre cuánto vale');
  assert.equal(estaBloqueada('t2', est), true);
  assert.equal(estaBloqueada('t3', est), false);
});

test('un bloqueado NUNCA queda por encima de su bloqueante, ni cuando empatan', () => {
  const est = resolverDeps({ tareas: [T('t1', 70), T('t2', 70)], deps: [D('t2', 't1')] });
  const pos = est.orden.map((t) => t.id);
  assert.ok(pos.indexOf('t1') < pos.indexOf('t2'), 'el desempate por profundidad es lo que lo garantiza');
});

// ── Dependencias declaradas a nivel PROYECTO ─────────────────────────────────────────

test('una dependencia de proyecto frena a TODAS las tareas abiertas del proyecto que espera', () => {
  const est = resolverDeps({
    tareas: [T('t1', 50, { labels: ['pA'] }), T('t2', 60, { labels: ['pB'] }), T('t3', 70, { labels: ['pB'] })],
    deps: [D('pB', 'pA', { entidad: 'proyecto' })],
  });
  assert.equal(estaBloqueada('t2', est), true);
  assert.equal(estaBloqueada('t3', est), true);
  assert.equal(estaBloqueada('t1', est), false, 'el que va primero no se bloquea a sí mismo');
});

test('la urgencia CRUZA de proyecto a tarea — es el caso que trajo la feature', () => {
  // «Cobros y planes depende de que se termine Oferta y precios». Sin esta propagación la
  // arista solo FRENA a Cobros y no SUBE a Oferta: hace la mitad visible del trabajo y
  // deja intacto el empate que había que romper.
  const est = resolverDeps({
    tareas: [
      T('t1', 40, { labels: ['oferta'] }),   // la mejor tarea de Oferta vale poco…
      T('t2', 93, { labels: ['cobros'] }),   // …y la de Cobros, mucho
      T('t3', 60, { labels: ['otro'] }),
    ],
    deps: [D('cobros', 'oferta', { entidad: 'proyecto' })],
  });
  assert.equal(est.urgencia.t1, 93, 'la tarea de Oferta hereda lo que destraba');
  assert.equal(est.orden[0].id, 't1', 'y por eso pasa a la punta del tablero');
  assert.equal(estaBloqueada('t2', est), true);
  assert.equal(est.urgencia.t3, 60, 'lo que no está en la cadena no se mueve');
});

test('la herencia de proyecto sube por DELTA: NO aplana el orden de adentro', () => {
  // Medido sobre el tablero real: con `max`, las 14 tareas abiertas de «Oferta y precios»
  // saltaban TODAS a 93 y copaban el top 12 — incluidas «Investigar competencia: Crush.ai»
  // (15) y «Analizar embudo de GoMarz» (7). Aplanar el orden interno de un proyecto es
  // cambiar una mentira por otra.
  const est = resolverDeps({
    tareas: [
      T('t1', 40, { labels: ['oferta'] }),   // la mejor de Oferta
      T('t2', 7, { labels: ['oferta'] }),    // la trivia de Oferta
      T('t3', 93, { labels: ['cobros'] }),
      T('t4', 60, { labels: ['otro'] }),
    ],
    deps: [D('cobros', 'oferta', { entidad: 'proyecto' })],
  });
  assert.equal(est.urgencia.t1, 93, 'la mejor de Oferta llega al nivel de lo que destraba');
  assert.equal(est.urgencia.t2, 60, 'y la trivia sube LO MISMO (7 + 53), no salta a 93');
  const pos = est.orden.map((t) => t.id);
  assert.ok(pos.indexOf('t1') < pos.indexOf('t2'), 'el orden de adentro del proyecto queda intacto');
  assert.ok(pos.indexOf('t4') < pos.indexOf('t2'), 'y la trivia no pasa por encima de un 60 de otro proyecto…');
});

test('la herencia cruzada no se cuelga con dos proyectos que se esperan', () => {
  const est = resolverDeps({
    tareas: [T('t1', 10, { labels: ['pA'] }), T('t2', 20, { labels: ['pB'] })],
    deps: [D('pA', 'pB', { entidad: 'proyecto' }), D('pB', 'pA', { entidad: 'proyecto' })],
  });
  assert.equal(est.orden.length, 2);
  assert.ok(Number.isFinite(est.urgencia.t1) && Number.isFinite(est.urgencia.t2));
});

test('un proyecto SIN tareas no cuenta como terminado', () => {
  // Tratar «vacío» como «listo» destrabaría media cadena sin que nadie hiciera el trabajo.
  const est = resolverDeps({
    tareas: [T('t2', 60, { labels: ['pB'] })],
    deps: [D('pB', 'pVacio', { entidad: 'proyecto' })],
  });
  assert.equal(estaBloqueada('t2', est), true);
});

test('un proyecto con TODAS sus tareas hechas sí destraba', () => {
  const est = resolverDeps({
    tareas: [T('t1', 50, { labels: ['pA'], progress: 100 }), T('t2', 60, { labels: ['pB'] })],
    deps: [D('pB', 'pA', { entidad: 'proyecto' })],
  });
  assert.equal(estaBloqueada('t2', est), false);
});

test('una tarea que vive en los DOS proyectos no se bloquea a sí misma', () => {
  const est = resolverDeps({
    tareas: [T('t1', 50, { labels: ['pA', 'pB'] })],
    deps: [D('pB', 'pA', { entidad: 'proyecto' })],
  });
  assert.equal(estaBloqueada('t1', est), false);
});

// ── Robustez: lo que igual va a entrar ───────────────────────────────────────────────

test('un ciclo GUARDADO no cuelga el resolvedor', () => {
  // El guard de escritura no cubre los datos viejos ni dos pestañas escribiendo a la vez.
  const est = resolverDeps({ tareas: [T('t1', 10), T('t2', 20)], deps: [D('t1', 't2'), D('t2', 't1')] });
  assert.equal(est.orden.length, 2);
  assert.ok(Number.isFinite(est.urgencia.t1) && Number.isFinite(est.urgencia.t2));
});

test('el orden es ESTABLE: no depende de en qué orden vinieron las filas', () => {
  // `curveTaskScores` desempata por índice del array, y ese array viene de un select sin
  // .order() — o sea el orden que devuelva Postgres. Sin un desempate propio, dos tareas
  // empatadas se intercambian solas entre corridas y el tablero «se mueve» sin que nadie
  // lo toque.
  const tareas = [T('t1', 50), T('t2', 50), T('t3', 50)];
  const a = resolverDeps({ tareas, deps: [] }).orden.map((t) => t.id);
  const b = resolverDeps({ tareas: tareas.slice().reverse(), deps: [] }).orden.map((t) => t.id);
  assert.deepEqual(a, b);
  assert.deepEqual(a, ['t1', 't2', 't3'], 'el desempate final es el número de tarjeta, que es estable');
});

test('sin dependencias, el orden es exactamente el de siempre (por score)', () => {
  // La red de que agregar esto no mueve un tablero que no tiene ninguna arista.
  const est = resolverDeps({ tareas: [T('t1', 10), T('t2', 90), T('t3', 50)], deps: [] });
  assert.deepEqual(est.orden.map((t) => t.id), ['t2', 't3', 't1']);
});

test('550 tareas y 200 aristas se resuelven sin explotar', () => {
  const tareas = Array.from({ length: 550 }, (_, i) => T(`t${i + 1}`, (i % 100) + 1));
  const deps = Array.from({ length: 200 }, (_, i) => D(`t${i + 2}`, `t${i + 1}`));  // una cadena de 200
  const est = resolverDeps({ tareas, deps });
  assert.equal(est.orden.length, 550);
  assert.equal(est.urgencia.t1, Math.max(...Array.from({ length: 201 }, (_, i) => (i % 100) + 1)));
});
