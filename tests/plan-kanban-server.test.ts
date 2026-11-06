// =============================================================================
// El kanban de FLUJO, en la base: qué queda en la fila al crear, mover, editar y guardar
// =============================================================================
// 16/10/2026, «hacer el kanban un kanban» (Martín, sobre la reunión con Mauricio del 12/10):
// las columnas pasan a ser el ESTADO — Por iniciar · En proceso · Atorada · Completada (y «No
// cumplen tu criterio») — en las DOS mitades del tablero: `experimento_tareas` (cliente) y
// `plan_tareas` (dueño, mig 0294). Este test corre las funciones REALES de lib/todo.ts y
// lib/plan-board.ts contra un PostgREST de mentira (tests/_plan-kanban-hijo.ts, en un node aparte
// con `--conditions=react-server`, porque las dos llevan `server-only`) y mira la FILA.
//
// Lo que fija, una decisión por test:
//   · el retroceso (decisión 10): editar el título de una tarjeta movida a mano NO la devuelve
//     de columna — en ninguna de las dos mitades;
//   · mover acomoda el avance (Completada = 100%, reabrir = 0%) y el motivo de «Atorada»;
//   · las tareas nacen LIBRES (decisión 6): sin prioridad, score 0 = «Sin priorizar»;
//   · el reparto de las 9:10 no toca las «Sin priorizar» ni lo que el criterio no dejó pasar.
//
// ⚠️ PROBADO ROMPIÉNDOLO (16/10/2026), base en verde primero (8 de 8), cada rotura restaurada
// de memoria. Seis roturas, seis cazadas, y cada una tira SU test:
//   1. `editarTarea` derivando a ciegas en cada guardado (sin `estadoAlGuardar`)
//                                                   → cae «el retroceso, cliente» (1 de 8)
//   2. `guardarPlanTarea` sin el bloque que relee la fila (upsert del payload tal cual)
//                                                   → cae «el retroceso, dueño» (1 de 8)
//   3. `avanceAlMover` sin el «reabrir = 0» (devuelve el progreso tal cual)
//                                                   → caen «mover, cliente» y «mover, dueño» (2 de 8)
//   4. `scoreAlCrear` cayendo a 62 sin prioridad → cae «nacen libres» (1 de 8)
//   5. `recurvarPlanOwner` con las libres en `filas` → cae «el reparto» (1 de 8, por el total)
//   6. `moverTarea` sin `motivoParaNoMover`      → cae «lo que el server rechaza» (1 de 8)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

const RAIZ = join(__dirname, '..');

type ResCli = { estado: string; progreso: number; motivo: string | null; orden: number; hecho: boolean; score: number };
type ResPlan = { estado: string; progress: number; motivo: string | null; orden: number; score: number };
type Rechazo = { ok: false; error: string; status: number };

const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_plan-kanban-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as {
  crearCli: Record<'libre' | 'conPrio' | 'scoreGana' | 'enCurso' | 'completa', ResCli>;
  retrocesoCli: Record<'trasTitulo' | 'trasCien' | 'trasBajar', ResCli>;
  moverCli: { aHecho: ResCli; hechoAtSeConserva: boolean; aReabrir: ResCli; aAtorada: string; reordenada: ResCli; atoradaConAvance: ResCli; aPorIniciar: ResCli };
  rechazosCli: { inventado: Rechazo; noExiste: Rechazo; recurrente: Rechazo; recurrenteSigue: ResCli };
  crearPlan: { atorada: ResPlan; hecha: ResPlan };
  guardarPlan: { trasGuardar: ResPlan; titulo: string; trasCien: ResPlan };
  moverPlan: { reabierta: ResPlan; inventado: Rechazo; recurrente: Rechazo };
  recurvar: { r: { total: number; sinPriorizar: number }; libre1: number; libre2: number; nocumple: number };
  filtroDelPlan: { creadas: number; todas: string[]; soloDelPlan: string[]; deLaRetro: string[] };
};

test('el retroceso, cliente: editar una tarjeta movida a mano NO la devuelve de columna', () => {
  // Movida a «En proceso» al 0% y después se le corrige el título, con el avance en el patch
  // (como lo mandaba `editPatch` en CADA guardado). Antes: volvía a «Por iniciar».
  assert.equal(R.retrocesoCli.trasTitulo.estado, 'en_curso');
  // El avance SÍ mueve la columna cuando CAMBIA: al 100% se completa y se sella…
  assert.deepEqual([R.retrocesoCli.trasCien.estado, R.retrocesoCli.trasCien.hecho], ['hecho', true]);
  // …y bajarlo la reabre.
  assert.deepEqual([R.retrocesoCli.trasBajar.estado, R.retrocesoCli.trasBajar.hecho], ['en_curso', false]);
});

test('el retroceso, dueño: el guardado de una pestaña vieja no mueve la columna ni el lugar', () => {
  // La pestaña tenía la tarjeta en «Por iniciar», lugar 999 y sin motivo; en la base ya estaba
  // en «Atorada», lugar 42, con su motivo. Guarda un título: el título entra, lo demás no.
  assert.equal(R.guardarPlan.titulo, 'título corregido');
  assert.deepEqual(R.guardarPlan.trasGuardar, { estado: 'en_seguimiento', progress: 0, motivo: 'el cliente no contesta', orden: 42, score: 0 });
  // Si el AVANCE cambió, ahí sí: 100% la completa y el motivo de Atorada se va con ella.
  assert.deepEqual(R.guardarPlan.trasCien, { estado: 'hecho', progress: 100, motivo: null, orden: 42, score: 0 });
});

test('mover, cliente: Completada = 100% sellada; reabrir = 0%; Atorada con su motivo', () => {
  const m = R.moverCli;
  assert.deepEqual([m.aHecho.estado, m.aHecho.progreso, m.aHecho.hecho], ['hecho', 100, true]);
  assert.equal(m.hechoAtSeConserva, true, 'reordenar adentro de Completada no la vuelve a completar');
  assert.deepEqual([m.aReabrir.estado, m.aReabrir.progreso, m.aReabrir.hecho], ['en_curso', 0, false]);
  assert.equal(m.aAtorada, 'el cliente no manda el logo', 'el motivo entra saneado, en una línea');
  assert.deepEqual([m.reordenada.estado, m.reordenada.orden, m.reordenada.motivo], ['en_seguimiento', -50, 'el cliente no manda el logo'], 'reordenar adentro de Atorada conserva el motivo');
  assert.deepEqual([m.atoradaConAvance.estado, m.atoradaConAvance.progreso], ['en_seguimiento', 60], 'el avance no la saca de Atorada');
  assert.deepEqual([m.aPorIniciar.estado, m.aPorIniciar.motivo, m.aPorIniciar.progreso], ['por_hacer', null, 60], 'salir de Atorada borra el motivo; el avance entre abiertas no se toca');
});

test('mover, dueño: la misma regla que el cliente', () => {
  assert.deepEqual([R.moverPlan.reabierta.estado, R.moverPlan.reabierta.progress], ['en_curso', 0]);
  assert.deepEqual([R.crearPlan.atorada.estado, R.crearPlan.atorada.motivo, R.crearPlan.atorada.orden], ['en_seguimiento', 'falta plata', 2], 'el «＋» de Atorada: nace ahí, arriba de la columna');
  assert.deepEqual([R.crearPlan.hecha.estado, R.crearPlan.hecha.progress], ['hecho', 100], 'creada en Completada nace al 100%');
});

test('lo que el server rechaza: un estado inventado, una que no existe, una recurrente a Completada', () => {
  assert.equal(R.rechazosCli.inventado.status, 400, 'un estado inventado NO es «Por iniciar»');
  assert.equal(R.rechazosCli.noExiste.status, 404);
  assert.deepEqual([R.rechazosCli.recurrente.status, R.rechazosCli.recurrente.error], [409, 'Se repite: no se completa']);
  assert.equal(R.rechazosCli.recurrenteSigue.estado, 'por_hacer', 'y no se escribió nada');
  assert.equal(R.moverPlan.inventado.status, 400);
  assert.equal(R.moverPlan.recurrente.status, 409);
});

test('nacen libres: sin prioridad, score 0 = «Sin priorizar»; el score explícito manda', () => {
  const c = R.crearCli;
  assert.equal(c.libre.score, 0);
  assert.equal(c.conPrio.score, 85, 'con prioridad, su número de siempre');
  assert.equal(c.scoreGana.score, 0, 'el tablero manda score 0 Y prioridad: gana el score');
});

test('nacen en su columna y ARRIBA de ella', () => {
  const c = R.crearCli;
  assert.deepEqual([c.libre.estado, c.libre.orden], ['por_hacer', -1]);
  assert.ok(c.conPrio.orden < c.libre.orden && c.scoreGana.orden < c.conPrio.orden, 'cada alta entra arriba de la anterior');
  assert.deepEqual([c.enCurso.estado, c.enCurso.orden], ['en_curso', 4], 'arriba de la que ya estaba en el lugar 5');
  assert.deepEqual([c.completa.estado, c.completa.progreso, c.completa.hecho], ['hecho', 100, true]);
});

test('el reparto de las 9:10 no toca las «Sin priorizar» ni lo que no cumple el criterio', () => {
  assert.equal(R.recurvar.libre1, 0);
  assert.equal(R.recurvar.libre2, 0);
  assert.equal(R.recurvar.nocumple, 40, '«No cumplen tu criterio» no es un pendiente: no se reparte');
  assert.equal(R.recurvar.r.sinPriorizar, 2, 'y las cuenta: una exclusión que nadie disparó se ve igual que una que funciona');
  assert.equal(R.recurvar.r.total, 24, 'sólo las 24 priorizadas entran al reparto');
});

// ── EL TELÉFONO (tanda 2, 16/10/2026) ──────────────────────────────────────────────
// El kanban del teléfono es el mismo por estado y mueve con el gesto del CRM
// (`moverTareaAction` → `moverEnTablero`, lib/plan-mover.ts). Escribe por las MISMAS funciones
// que el arrastre de escritorio, así que acá se mira lo que agrega: la entrada del historial y
// el Deshacer que la SACA (no suma otra).
//
// ⚠️ PROBADO ROMPIÉNDOLO (16/10/2026), base en verde (9 de 9), cada rotura restaurada:
//   7. `historialAlMover` sumando una entrada también al deshacer → cae «el teléfono» (1 de 9)
//   8. `moverEnTablero` sin el `esEstado` (escribe «Completada» como estado) → cae «el teléfono» (1 de 9)
//   9. `moverCliente` sin el `yaEstaba` (escribe aunque ya esté ahí)          → cae «el teléfono» (1 de 9)
test('el teléfono: mueve por el camino de cada tablero y el Deshacer saca SU entrada', () => {
  const T = (R as unknown as { telefono: Record<string, unknown> }).telefono as {
    histAntesCli: number; m9: { ok: boolean; antes: string; entryId: string };
    trasMoverCli: ResCli & { hist: string[] }; d9: { ok: boolean }; trasDeshacerCli: ResCli & { hist: string[] };
    yaEstaba: { ok: boolean; yaEstaba?: boolean }; invalida: { ok: boolean; error: string };
    m9p: { ok: boolean; antes: string }; trasMoverPlan: ResPlan & { hist: string[] }; d9p: { ok: boolean }; trasDeshacerPlan: ResPlan & { hist: string[] };
  };
  // Cliente: a «En proceso», con UNA entrada nueva arriba.
  assert.deepEqual([T.m9.ok, T.m9.antes], [true, 'por_hacer']);
  assert.equal(T.trasMoverCli.estado, 'en_curso');
  assert.equal(T.trasMoverCli.hist.length, T.histAntesCli + 1);
  assert.equal(T.trasMoverCli.hist[0], 'Movió a En proceso');
  // Deshacer: vuelve a «Por iniciar» y el historial queda como estaba (sin una segunda entrada).
  assert.equal(T.d9.ok, true);
  assert.equal(T.trasDeshacerCli.estado, 'por_hacer');
  assert.equal(T.trasDeshacerCli.hist.length, T.histAntesCli);
  // Ya estaba ahí: éxito sin escribir (sin Deshacer). Lo que no es una columna: no se escribe.
  assert.deepEqual([T.yaEstaba.ok, T.yaEstaba.yaEstaba], [true, true]);
  assert.deepEqual([T.invalida.ok, T.invalida.error], [false, 'Columna inválida']);
  // Dueño: a «Completada» queda al 100% (la regla de `trasMover`), y el Deshacer la reabre.
  assert.deepEqual([T.m9p.ok, T.m9p.antes], [true, 'por_hacer']);
  assert.deepEqual([T.trasMoverPlan.estado, T.trasMoverPlan.progress, T.trasMoverPlan.hist[0]], ['hecho', 100, 'Movió a Completada']);
  assert.deepEqual([T.d9p.ok, T.trasDeshacerPlan.estado, T.trasDeshacerPlan.progress, T.trasDeshacerPlan.hist.length], [true, 'por_hacer', 0, T.trasMoverPlan.hist.length - 1]);
});

// ── LA REVISIÓN ADVERSARIAL (16/10/2026) ───────────────────────────────────────────
// Dos revisores reprodujeron, con las funciones reales, tres formas de que la base y la pantalla
// terminaran distintas después de un Deshacer o de un guardado de una pestaña vieja:
//   · el Deshacer del TELÉFONO de un «Mover a Completada» dejaba la tarea al 0% (y una «Atorada» sin
//     su motivo): ahora el mover devuelve el avance y el motivo de antes y el Deshacer los manda;
//   · el Deshacer del ESCRITORIO devolvía el avance por un SEGUNDO guardado, que el server leía como
//     «cambió el avance»: una «Por iniciar» al 40% quedaba «En proceso» en la base. Ahora va en el
//     mismo mover (`progreso`);
//   · una pestaña VIEJA del dueño reabría una tarea completada en otro lado al corregirle el título:
//     ahora viaja el último avance que la base le confirmó (`progresoGuardado`), como en el cliente.
//
// ⚠️ PROBADO ROMPIÉNDOLO (16/10/2026), base en verde (12 de 12), cada rotura restaurada. Las
// roturas y lo que tiraron están al final del bloque.
const RV = (R as unknown as { revision: Record<string, ResCli & ResPlan & { title?: string }> }).revision;
const leerFuente = (...p: string[]) => readFileSync(join(RAIZ, ...p), 'utf8');

test('el Deshacer del teléfono vuelve con el avance y el motivo de antes, en las dos mitades', () => {
  assert.deepEqual([RV.telCli.estado, RV.telCli.progreso], ['en_curso', 40], 'cliente: antes quedaba al 0%');
  assert.deepEqual([RV.telAtorada.estado, RV.telAtorada.motivo], ['en_seguimiento', 'el cliente no contesta'], 'y la «Atorada», con su motivo');
  assert.deepEqual([RV.telPlan.estado, RV.telPlan.progress], ['en_curso', 40], 'dueño: antes quedaba al 0%');
  // El teléfono manda lo que devolvió el mover (y la action lo deja pasar).
  assert.match(leerFuente('app', 'm', 'plan', 'ListaPlan.tsx'), /moverTareaAction\(id, antes, \{ entryId, progreso: antesAvance, motivo: antesMotivo \}\)/);
  assert.match(leerFuente('app', 'm', 'plan', 'acciones.ts'), /progreso: deshacer\.progreso/);
});

test('el Deshacer del escritorio manda el avance EN el mover: la base y la pantalla quedan iguales', () => {
  assert.deepEqual([RV.antesEsc.estado, RV.antesEsc.progreso], ['por_hacer', 40]);
  assert.deepEqual([RV.escCli.estado, RV.escCli.progreso], ['por_hacer', 40], 'cliente: antes la base la pasaba a «En proceso»');
  assert.deepEqual([RV.escPlan.estado, RV.escPlan.progress], ['por_hacer', 40], 'dueño: lo mismo');
  assert.equal(RV.cienFuera.progreso, 40, 'un 100% fuera de «Completada» no se acepta');
  // useBoard ya no hace el segundo guardado, y las dos rutas y los dos repos llevan `progreso`.
  const ub = leerFuente('app', 'plan', 'board', 'useBoard.ts');
  const desh = ub.slice(ub.indexOf('const deshacerMover'), ub.indexOf('const setMotivoAtorada'));
  // (20/10/2026) Con las columnas PROPIAS del negocio (lib/plan-columnas.ts) la columna de una tarjeta es su CLAVE
  // (el estado, o el id de una propia), no su estado: tests/plan-columnas-propias.test.ts.
  assert.match(desh, /repo\.mover\(id, antes\.estado, antes\.orden, \{ motivo: antes\.motivoAtorada, historial, progreso: antes\.progress, columna: antes\.columna \}\)/);
  assert.doesNotMatch(desh, /\bpatch\(id,/, 'el segundo guardado era el que la base leía como «cambió el avance»');
  assert.match(leerFuente('app', 'api', 'todo', 'route.ts'), /moverTarea\(id, estado, orden, \{ motivo, historial, progreso, columna \}\)/);
  assert.match(leerFuente('app', 'api', 'plan-board', 'route.ts'), /moverPlanTarea\(id, estado, orden, \{ motivo, historial, progreso, columna \}\)/);
  assert.match(leerFuente('app', 'plan', 'TodoBoard.tsx'), /action: 'mover'[^\n]*progreso: opts\?\.progreso/);
  assert.match(leerFuente('app', 'plan', 'board', 'repo-plan.ts'), /action: 'mover-tarea'[^\n]*progreso: opts\?\.progreso/);
});

test('una pestaña VIEJA del dueño no reabre lo que se completó en otro lado (y si ella movió el avance, manda)', () => {
  assert.deepEqual([RV.viejaNoTocoAvance.estado, RV.viejaNoTocoAvance.progress], ['hecho', 100], 'antes: «En proceso» al 40%');
  assert.equal(RV.viejaNoTocoAvance.title, 'vieja (tilde corregida)', 'el título sí se guarda');
  assert.deepEqual([RV.viejaMovioAvance.estado, RV.viejaMovioAvance.progress], ['en_curso', 60]);
  // El dato viaja: useBoard lo lleva por tarea y el repo del dueño lo manda.
  const ub = leerFuente('app', 'plan', 'board', 'useBoard.ts');
  assert.match(ub, /repo\.saveTask\(t, \{ progresoGuardado: avanceGuardado\.current!\.get\(t\.id\) \}\)/);
  assert.match(leerFuente('app', 'plan', 'board', 'repo-plan.ts'), /action: 'guardar-tarea', tarea: d, progresoGuardado: o\?\.progresoGuardado/);
  assert.match(leerFuente('app', 'api', 'plan-board', 'route.ts'), /guardarPlanTarea\(t, \{ progresoGuardado \}\)/);
});

// ── El tablero del cliente no es toda la tabla (#507, 6/11/2026) ─────────────

/** Las líneas de CÓDIGO: un comentario que nombra `listTareas()` no es una lectura del tablero. */
const soloCodigo = (src: string): string[] => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));

test('el tablero del cliente muestra SÓLO sus tareas del Plan, no las de la Retro ni las de un experimento', () => {
  const F = R.filtroDelPlan;
  assert.equal(F.creadas, 6);
  assert.equal(F.todas.length, 6, 'sin la opción, `listTareas` sigue trayendo la tabla entera (hay lectores que la necesitan)');
  assert.deepEqual(F.soloDelPlan, ['a mano', 'del plan'], 'el tablero del cliente: sólo lo del Plan');
  // Las cuatro que se van, y las DOS que el `origen` no delata (nacieron de una Retro o de un
  // experimento por su columna): una sola de las cuatro marcas alcanza para dejarla afuera.
  for (const fuera of ['la propuso la Retro', 'paso de un experimento', 'de una Retro, con origen mako', 'de un experimento, a mano']) {
    assert.ok(F.todas.includes(fuera), `${fuera} tendría que estar en la tabla`);
    assert.ok(!F.soloDelPlan.includes(fuera), `${fuera} no es del Plan del cliente: no va a su tablero`);
  }
  // Y el filtro no se las esconde a quien las necesita: la Retro las sigue leyendo por su camino.
  assert.deepEqual(F.deLaRetro, ['de una Retro, con origen mako']);
});

test('CABLEADO: cada lugar que PRESENTA el tablero del cliente pide `soloDelPlan` (y los demás no)', () => {
  // La SPEC del kanban lo pedía y ninguna tanda lo hizo (docs/hallazgos-plan.md). Si una de estas
  // puertas se olvida, las tareas de la Retro vuelven por ahí — el GET es el caso típico: el primer
  // refresco del tablero las repintaba.
  const PRESENTAN: Array<[string[], number]> = [
    [['app', 'plan', 'page.tsx'], 3],                          // /plan, el tablero del cliente
    [['app', 'api', 'todo', 'route.ts'], 1],                   // su GET (el refresco del mismo tablero)
    [['lib', 'plan-hoy.ts'], 1],                               // «Hoy» / «Semana» / Today
    [['lib', 'vista-general.ts'], 1],                           // el escalón «Plan» del foco de /general
    [['lib', 'api-mako', 'areas', 'plan.helpers.ts'], 1],       // el tablero que devuelve la API de MaKo
    [['lib', 'mako-tools.ts'], 1],                              // `ver_plan` del doer
    [['app', 'api', 'agente', 'plan', 'route.ts'], 1],          // el tablero del agente
  ];
  for (const [ruta, cuantas] of PRESENTAN) {
    const src = leerFuente(...ruta);
    const llamadas = soloCodigo(src).filter((l) => /\blistTareas(ConTope)?\(/.test(l));
    assert.equal(llamadas.length, cuantas, `${ruta.join('/')}: cambió la cantidad de lecturas del tablero`);
    for (const l of llamadas) assert.match(l, /listTareas(ConTope)?\(\{ soloDelPlan: true \}\)/, `${ruta.join('/')}: una lectura del tablero sin filtrar`);
  }
  // Y el aviso de «se cortó en 1000 filas» se mide con las LEÍDAS, no con las que quedaron: si no, el
  // filtro le saca el aviso a una lectura cortada (el límite que corta en silencio, otra vez).
  for (const ruta of [['lib', 'plan-hoy.ts'], ['lib', 'api-mako', 'areas', 'plan.helpers.ts']]) {
    assert.match(leerFuente(...ruta), /recortado: leidas >= TOPE_FILAS/, `${ruta.join('/')}: mide el tope con la lista ya filtrada`);
  }
  // Y los que necesitan la tabla ENTERA siguen sin filtro: el cierre por señales (si no, una tarea
  // de la Retro no se cierra nunca), buscar una por id para editarla o cerrarla, y la deduplicación
  // de lo que se propone (deduplicar contra media tabla propone un duplicado).
  const ENTERA = [
    ['app', 'api', 'cron', 'tareas-verificar', 'route.ts'],
    ['lib', 'plan-cerrar.ts'],
    ['lib', 'plan-propuesta.ts'],
    ['lib', 'reunion-cruce.ts'],
    ['lib', 'retro-pipeline.ts'],
  ];
  for (const ruta of ENTERA) {
    const src = leerFuente(...ruta);
    for (const l of soloCodigo(src).filter((x) => /\blistTareas(ConTope)?\(/.test(x))) {
      assert.doesNotMatch(l, /soloDelPlan/, `${ruta.join('/')}: este lector necesita la tabla entera`);
    }
  }
});

// ROTURAS DE LA REVISIÓN ADVERSARIAL (16/10/2026), base en verde (12 de 12), cada una restaurada.
// Cinco roturas, cinco cazadas:
//   K1. `trasMover` ignorando el avance dado (vuelve a `avanceAlMover`)
//                       → caen «el Deshacer del teléfono» y «el Deshacer del escritorio» (2 de 12)
//   K2. `alDeshacer` (lib/plan-mover.ts) sin pasar avance ni motivo → cae «el Deshacer del teléfono» (1 de 12)
//   K3. `guardarPlanTarea` sin `progresoGuardado` (compara el avance viejo contra la fila)
//                       → cae «una pestaña VIEJA del dueño» (1 de 12)
//   K4. `deshacerMover` (useBoard) otra vez con el segundo guardado → cae «el Deshacer del escritorio» (1 de 12)
//   K5. `trasMover` aceptando un 100% fuera de «Completada» → cae «el Deshacer del escritorio» (1 de 12)
