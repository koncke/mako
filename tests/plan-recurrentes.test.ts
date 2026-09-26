// =============================================================================
// Recurrentes: lo que se repite para siempre NO compite (mig 0163)
// =============================================================================
// El criterio es de Mauricio (16/07/2026): «acá lo que entran son tareas que tienen un
// inicio y tienen un fin». Lo que este test fija NO es la vista —eso es pintura— sino la
// EXCLUSIÓN, que es la razón por la que la columna existe: el Perro puntúa por «qué mueve
// la aguja» y le pone deadline a todo, así que una tarea sin fin compite por un puesto que
// no le corresponde, hereda urgencias que no le tocan y hunde el avance de su proyecto
// para siempre.
//
// ⚠️ PROBADO ROMPIÉNDOLO, UNA REGLA POR VEZ, CON LOS NÚMEROS DE CADA ROTURA.
// Base: **12 pasan, 0 fallan**. Cada línea es un cambio hecho a propósito en el código de
// producción, corrido, y revertido:
//
//  #  Qué se rompió                                                  Resultado   Qué test cayó
//  1  `esRecurrente` con `!!t.recurrente` en vez de `=== true`        11 / 1      «contesta que NO ante cualquier duda»
//  2  `llevaDeadline` devolviendo siempre `true`                      10 / 2      «no lleva deadline» + «el triangulito NO titila»
//  3  `altaIncompleta` sin el `&& llevaDeadline(t)`                    11 / 1      «el triangulito NO titila»
//  4  `bloqueantes` armado con `viva` en vez de `compite`              11 / 1      «NO frena a nadie»
//  5  `abiertasPorProy` contando también las recurrentes               11 / 1      «un proyecto de PURAS recurrentes no frena para siempre»
//  6  `conTareas` ignorando las recurrentes (la rama opuesta de 5)     11 / 1      el MISMO test que 5
//  7  `clasificarVencimientos` volviendo a `p.abiertas === 0`          10 / 2      «SIGUE avisando» + «no dice 0 tareas abiertas»
//  8  `carga()` devolviendo siempre «N tareas abiertas»                11 / 1      «no dice 0 tareas abiertas»
//  9  `ROTULO_RECURRENTE = 'BAU'`                                      11 / 1      «NUNCA dice BAU»
// 10  `soloRecurrentes` devolviendo el array entero                    11 / 1      «parten el MISMO universo»
// 11  `const abiertas = e.tareas.filter(viva)` en `resolverDeps`       11 / 1      «no se cuela en el orden que se reparte»
// 12  las roturas 11 y 4 JUNTAS                                         9 / 3      los tres del grafo
//
// ⚠️ LO QUE LA ROTURA ENSEÑÓ, Y NO SE VEÍA ESCRIBIENDO EL TEST: **«…ni hereda la urgencia»
// no cae con la rotura 4 sola.** Con el filtro de `abiertas` intacto, la recurrente ni
// siquiera entra al recorrido que calcula la urgencia, así que su valor queda `undefined` y
// la aserción pasa por una razón que no es la suya. Hacen falta las dos capas rotas (#12)
// para que herede el 90. O sea: la herencia está cortada DOS veces, y eso es a propósito
// —es la vía de escape menos obvia de toda la exclusión—, pero el test de la herencia por sí
// solo mide menos de lo que su nombre promete. Queda escrito acá en vez de borrarlo: el que
// saque una de las dos capas creyendo que la otra alcanza tiene que leer esto.
//
// 5 y 6 comparten test a propósito: son las DOS ramas del mismo caso, y la medición había
// levantado justamente que las dos fallan — no hay un default correcto entre ellas.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROTULO_RECURRENTE, esRecurrente, sinRecurrentes, soloRecurrentes, llevaDeadline } from '../lib/plan-recurrentes';
import { resolverDeps, estaBloqueada, type Dep, type TareaDep } from '../app/plan/board/dependencias';
import { clasificarVencimientos, textoVencimientos } from '../lib/plan-vencimientos';
import { altaIncompleta, type BoardTask } from '../app/plan/board/types';

const T = (id: string, score: number, extra: Partial<TareaDep> = {}): TareaDep =>
  ({ id, num: Number(id.replace(/\D/g, '')) || 1, score, progress: 0, labels: [], ...extra });

const D = (deId: string, aId: string, extra: Partial<Dep> = {}): Dep =>
  ({ entidad: 'tarea', deId, aId, clase: 'bloquea', razon: 'porque sí', origen: 'user', ...extra });

const tarea = (extra: Partial<BoardTask> = {}): BoardTask => ({
  id: 't1', num: 1, emoji: '📌', title: 'Tarea', detalle: '', priority: 'alta', score: 85,
  progress: 0, deadline: '', labels: [], checklist: [], historial: [], origen: 'user', enPrioridad: false, ...extra,
});

// ── El predicado ─────────────────────────────────────────────────────────────────────

test('esRecurrente contesta que NO ante cualquier duda, no «truthy»', () => {
  // El campo llega de tres lugares con tres formas: la fila de Postgres, el estado
  // optimista del navegador (sin el campo, mientras la tarjeta no se guardó) y el JSON de
  // un modelo. Marcarla de MÁS la hace desaparecer del ranking sin que nadie lo pidiera,
  // que es peor que una recurrente que todavía compite: el error se ve al revés.
  assert.equal(esRecurrente({ recurrente: true }), true);
  assert.equal(esRecurrente({}), false, 'sin el campo (tarea vieja, tarjeta optimista) = NO');
  assert.equal(esRecurrente({ recurrente: undefined }), false);
  assert.equal(esRecurrente({ recurrente: 1 as unknown as boolean }), false, 'un 1 del JSON de un modelo no alcanza');
  assert.equal(esRecurrente({ recurrente: 'true' as unknown as boolean }), false, 'ni el string "true"');
});

test('sinRecurrentes y soloRecurrentes parten el MISMO universo, sin perder ni duplicar', () => {
  const ts = [{ id: 'a' }, { id: 'b', recurrente: true }, { id: 'c', recurrente: false }, { id: 'd', recurrente: true }];
  assert.deepEqual(sinRecurrentes(ts).map((t) => t.id), ['a', 'c']);
  assert.deepEqual(soloRecurrentes(ts).map((t) => t.id), ['b', 'd']);
  assert.equal(sinRecurrentes(ts).length + soloRecurrentes(ts).length, ts.length, 'la partición es exacta');
});

test('el rótulo del producto es «Se repite» y NUNCA dice BAU', () => {
  // El nombre con el que nació el criterio se descartó a propósito: «el nombre tal vez no
  // es muy conocido». Un test lo fija porque un rótulo es lo más fácil de reescribir «para
  // que quede más claro» sin saber que hubo una decisión.
  assert.equal(ROTULO_RECURRENTE, 'Se repite');
  assert.doesNotMatch(ROTULO_RECURRENTE, /bau/i);
});

// ── La fecha ─────────────────────────────────────────────────────────────────────────

test('una recurrente no lleva deadline: lo que se repite no vence', () => {
  assert.equal(llevaDeadline({ recurrente: true }), false);
  assert.equal(llevaDeadline({ recurrente: false }), true);
  assert.equal(llevaDeadline({}), true, 'una tarea normal sigue llevando fecha');
});

test('el triangulito rojo NO titila para siempre sobre una recurrente sin fecha', () => {
  // `altaIncompleta` alimenta un aviso que PARPADEA. En una tarea sin fin, «le falta el
  // deadline» sería una alarma permanente sobre algo a lo que no le falta nada — el caso
  // exacto del «consumidor huérfano de un campo que ya nadie escribe».
  assert.equal(altaIncompleta(tarea({ deadline: '' })), true, 'una Alta sin fecha sí está incompleta');
  assert.equal(altaIncompleta(tarea({ deadline: '', recurrente: true })), false);
  assert.equal(altaIncompleta(tarea({ deadline: '2026-10-01' })), false);
});

// ── El grafo: no frena, no hereda ────────────────────────────────────────────────────

test('una recurrente NO frena a nadie: esperar a que deje de repetirse es esperar para siempre', () => {
  const est = resolverDeps({ tareas: [T('t1', 40, { recurrente: true }), T('t2', 90)], deps: [D('t2', 't1')] });
  assert.equal(estaBloqueada('t2', est), false);
});

test('…ni hereda la urgencia de lo que la espera, que es la vía de escape menos obvia', () => {
  // `u(A) = max(score(A), u de los que lo esperan)`. Marcada como bloqueante de algo de 90,
  // una recurrente de 40 volvería al top del ranking por la puerta de atrás, saltándose
  // toda la exclusión de arriba.
  const est = resolverDeps({ tareas: [T('t1', 40, { recurrente: true }), T('t2', 90)], deps: [D('t2', 't1')] });
  assert.notEqual(est.urgencia.t1, 90, 'no puede heredar el 90 del que la espera');
});

test('el bloqueante que se repite no se cuela en el orden que se reparte', () => {
  const est = resolverDeps({ tareas: [T('t1', 40, { recurrente: true }), T('t2', 90)], deps: [D('t2', 't1')] });
  assert.deepEqual(est.orden.map((t) => t.id), ['t2'], 'sólo compite lo que tiene un fin');
});

test('un proyecto de PURAS recurrentes no frena para siempre a lo que depende de él', () => {
  // ⚠️ ACÁ FALLABAN LAS DOS RAMAS, y por eso el test las mira juntas:
  //  · contando la recurrente como «abierta», el proyecto nunca termina → bloqueo eterno;
  //  · no contándola, cae en «no tiene NINGUNA tarea» → «no hay evidencia de que se haya
  //    hecho nada» → también pendiente para siempre.
  // La salida es que sean dos preguntas: la recurrente ES evidencia de trabajo y NO es
  // trabajo pendiente.
  // La arista es de PROYECTO a PROYECTO: «pOtro no puede empezar hasta que pClien termine».
  const deps = [D('pOtro', 'pClien', { entidad: 'proyecto' })];
  const vivo = resolverDeps({
    tareas: [T('t1', 40, { recurrente: true, labels: ['pClien'] }), T('t9', 90, { labels: ['pOtro'] })],
    deps,
  });
  assert.equal(estaBloqueada('t9', vivo), false, 'su único trabajo se repite: no hay nada que esperar');

  const vacio = resolverDeps({ tareas: [T('t9', 90, { labels: ['pOtro'] })], deps });
  assert.equal(estaBloqueada('t9', vacio), true, 'y un proyecto SIN NINGUNA tarea sí sigue frenando');

  const conFin = resolverDeps({
    tareas: [T('t1', 40, { labels: ['pClien'] }), T('t9', 90, { labels: ['pOtro'] })],
    deps,
  });
  assert.equal(estaBloqueada('t9', conFin), true, 'y una tarea con fin abierta también');
});

// ── El aviso de vencimientos ─────────────────────────────────────────────────────────

test('un proyecto que sólo tiene recurrentes SIGUE avisando que se venció', () => {
  // El cruce que la medición levantó: si se las resta de `abiertas` y nada más, el cliente
  // al que se le atiende todas las semanas pasa a `abiertas === 0` y DESAPARECE del único
  // mensaje que persigue fechas. Restarlas y callarlas es la otra mitad del error.
  const r = clasificarVencimientos([
    { nombre: 'Cliente: Vive', deadline: '2026-01-01', abiertas: 0, recurrentes: 3 },
    { nombre: 'Terminado', deadline: '2026-01-01', abiertas: 0, recurrentes: 0 },
  ], '2026-09-23');
  assert.deepEqual(r.atrasados.map((p) => p.nombre), ['Cliente: Vive']);
});

test('…y el renglón no dice «0 tareas abiertas», que sería lo contrario de la verdad', () => {
  const r = clasificarVencimientos([{ nombre: 'Cliente: Vive', deadline: '2026-01-01', abiertas: 0, recurrentes: 3 }], '2026-09-23');
  const m = textoVencimientos(r)!;
  assert.doesNotMatch(m.texto, /0 tareas abiertas/);
  assert.match(m.texto, /sin trabajo con fin, sólo 3 que se repiten/);
});

test('un proyecto con trabajo de verdad sigue contándolo como siempre', () => {
  // La regla nueva no puede cambiar el renglón del caso normal: es el 95% de los avisos.
  const r = clasificarVencimientos([{ nombre: 'Feature: Plan', deadline: '2026-09-20', abiertas: 10, recurrentes: 4 }], '2026-09-23');
  const m = textoVencimientos(r)!;
  assert.match(m.texto, /Feature: Plan — 3 días, 10 tareas abiertas/, 'las 4 que se repiten no se suman');
});
