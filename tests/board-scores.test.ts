// Tests de las funciones PURAS de scoring del Perro Guardián (app/plan/board/types.ts).
// Characterization tests: fijan el comportamiento ACTUAL (pirámide sana + spread sin
// empates) para que un refactor no lo rompa en silencio. Correr: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  curveTaskScores, spreadProjScores, prioFromScore, sanearHist,
  clampScore, clampProj, clampPct, MAX_PROJ,
} from '../app/plan/board/types';
import { empujeDeadline, castigoQuietud, esToque, diasQuieta, diasAlDeadline, ajusteTemporal } from '../app/plan/board/envejecer';

test('prioFromScore — cortes en 75 / 50 / 25', () => {
  assert.equal(prioFromScore(100), 'alta');
  assert.equal(prioFromScore(75), 'alta');
  assert.equal(prioFromScore(74), 'media');
  assert.equal(prioFromScore(50), 'media');
  assert.equal(prioFromScore(49), 'baja');
  assert.equal(prioFromScore(25), 'baja');
  assert.equal(prioFromScore(24), 'futuro');
  assert.equal(prioFromScore(0), 'futuro');
});

test('clampScore / clampProj / clampPct — saturan, redondean y toleran NaN', () => {
  assert.equal(clampScore(150), 100);
  assert.equal(clampScore(-5), 0);
  assert.equal(clampScore(3.6), 4);
  assert.equal(clampScore(NaN), 0);
  assert.equal(clampScore(Infinity), 0);
  assert.equal(clampProj(0), 1);          // proyectos: piso 1
  assert.equal(clampProj(200), 100);
  assert.equal(clampProj(NaN), 50);       // default sano
  assert.equal(clampPct(120), 100);
  assert.equal(clampPct(-1), 0);
  assert.equal(clampPct(NaN), 0);
});

test('curveTaskScores — n=0 → {}, n<5 → sin tocar', () => {
  assert.deepEqual(curveTaskScores([]), {});
  const chicos = [
    { id: 'a', score: 90 }, { id: 'b', score: 80 }, { id: 'c', score: 10 },
  ];
  const out = curveTaskScores(chicos);
  assert.equal(out.a, 90);
  assert.equal(out.b, 80);
  assert.equal(out.c, 10);
});

test('curveTaskScores — n>=5 arma una PIRÁMIDE (Alta arriba, siempre hay Baja y A-futuro)', () => {
  const items = Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, score: 100 - i }));
  const out = curveTaskScores(items);
  const scores = Object.values(out);
  // todos en 1-100
  assert.ok(scores.every((s) => s >= 1 && s <= 100));
  const prios = scores.map(prioFromScore);
  // la más importante queda en Alta; y SIEMPRE cae gente en Baja y en A-futuro
  assert.equal(prioFromScore(out.t0), 'alta');
  assert.ok(prios.includes('baja'), 'la pirámide debe tener tareas en Baja');
  assert.ok(prios.includes('futuro'), 'la pirámide debe tener tareas en A futuro');
  // menos "Alta" que "Baja"+"Futuro" juntas (pirámide, no un rectángulo)
  const alta = prios.filter((p) => p === 'alta').length;
  const bajaYfuturo = prios.filter((p) => p === 'baja' || p === 'futuro').length;
  assert.ok(alta < bajaYfuturo, `Alta(${alta}) debe ser menos que Baja+Futuro(${bajaYfuturo})`);
});

test('spreadProjScores — sin empates, estrictamente decreciente, respeta el ranking', () => {
  // tres proyectos EMPATADOS en 50 → tres números distintos
  const empatados = [{ id: 'a', score: 50 }, { id: 'b', score: 50 }, { id: 'c', score: 50 }];
  const out = spreadProjScores(empatados);
  const vals = [out.a, out.b, out.c];
  assert.equal(new Set(vals).size, 3, 'no puede haber dos proyectos con el mismo score');
  // estrictamente decreciente en orden de entrada (mismo score → estable por índice)
  assert.ok(out.a > out.b && out.b > out.c);
  assert.ok(vals.every((v) => v >= 1 && v <= MAX_PROJ));
});

test('spreadProjScores — n<=1 → MAX_PROJ; ranking por score preservado', () => {
  assert.deepEqual(spreadProjScores([{ id: 'solo', score: 5 }]), { solo: MAX_PROJ });
  const rankeados = [{ id: 'lo', score: 10 }, { id: 'hi', score: 90 }, { id: 'mid', score: 50 }];
  const out = spreadProjScores(rankeados);
  // el de mayor score queda arriba, el menor abajo
  assert.ok(out.hi > out.mid && out.mid > out.lo);
  assert.equal(new Set([out.hi, out.mid, out.lo]).size, 3);
});

// ⛔ ACÁ VIVÍAN LOS TESTS DE `scoreProyectoDerivado`, y se borraron con la función.
//
// Vale la pena que quede escrito por qué, porque los tests pasaban: fijaban la invariante
// «ninguna tarea puede puntuar por encima de su propio proyecto» y la fijaban bien. El
// problema no era el test — era que la invariante se había conseguido REEMPLAZANDO EL
// JUICIO POR UNA CUENTA (`max` de las tareas), o sea apagando la parte del sistema que el
// dueño paga. Un test verde sobre la propiedad equivocada es la forma más cara de estar
// seguro de algo que está mal.
//
// Lo que hay que testear en su lugar NO es la fórmula (no hay fórmula): es que la SALIDA DEL
// PERRO cumpla las reglas de su propia metodología — que no empate dos proyectos, que use
// todo el rango, que no meta el 60% en Alta, y que cada razón compare contra otro proyecto
// nombrado en vez de parafrasear el título. Eso es lo que no tenía una sola línea de código
// que lo mirara, y es por donde entró este bug.

// ── El historial que viene de la base ────────────────────────────────────────────────
// 418 entradas reales tenían `ts` como string ISO y `actor: 'MaKo'` (un cuarto valor que no
// existe en el union). Las escribió un script sobre un `Row`, donde el compilador no mira.
// La fecha se DIBUJABA bien, así que el bug era invisible; lo que rompía era la aritmética.

test('sanearHist — un ts ISO se convierte a epoch, no se descarta', () => {
  const [h] = sanearHist([{ id: 'a', ts: '2026-08-06T14:55:22.894Z', actor: 'MaKo', text: 'x' }]);
  assert.equal(typeof h.ts, 'number');
  assert.equal(h.ts, Date.parse('2026-08-06T14:55:22.894Z'));
});

test('sanearHist — un actor fuera del tipo cae en «ia», que es lo que MaKo es', () => {
  assert.equal(sanearHist([{ id: 'a', ts: 1, actor: 'MaKo', text: 'x' }])[0].actor, 'ia');
  assert.equal(sanearHist([{ id: 'a', ts: 1, actor: 'user', text: 'x' }])[0].actor, 'user');
  assert.equal(sanearHist([{ id: 'a', ts: 1, actor: 'code', text: 'x' }])[0].actor, 'code');
});

test('sanearHist — LA razón de existir: Math.max sobre lo saneado nunca da NaN', () => {
  // Es el modo de falla exacto que se midió: NaN en una comparación es siempre false, así
  // que la regla de «30 días sin tocar» se evaluaba sobre 362 de 550 tareas y no lo decía.
  const sucio = [
    { id: 'a', ts: '2026-08-06T14:55:22.894Z', actor: 'MaKo', text: 'x' },
    { id: 'b', ts: 1785935073901, actor: 'ia', text: 'y' },
    { id: 'c', ts: null, actor: 'ia', text: 'z' },
    { id: 'd', ts: 'no es una fecha', actor: 'ia', text: 'w' },
  ];
  assert.ok(Number.isNaN(Math.max(...sucio.map((h) => h.ts as number))), 'el crudo SÍ da NaN');
  const limpio = Math.max(...sanearHist(sucio).map((h) => h.ts));
  assert.ok(Number.isFinite(limpio), 'lo saneado nunca');
  assert.equal(limpio, Date.parse('2026-08-06T14:55:22.894Z'), 'y el más reciente es el que estaba en ISO');
});

test('sanearHist — lo que no se puede fechar se descarta, no se inventa', () => {
  // Una entrada sin fecha usable ordenaría mal el historial y envenenaría la cuenta de días.
  assert.equal(sanearHist([{ id: 'a', ts: null, actor: 'ia', text: 'x' }]).length, 0);
  assert.equal(sanearHist([{ id: 'a', ts: 'pomelo', actor: 'ia', text: 'x' }]).length, 0);
});

test('sanearHist — basura de entrada devuelve lista vacía, nunca explota', () => {
  assert.deepEqual(sanearHist(null), []);
  assert.deepEqual(sanearHist('no soy un array'), []);
  assert.deepEqual(sanearHist([null, 3, 'x']), []);
});

test('sanearHist — conserva undo y kind, que son lo que hace deshacible una entrada', () => {
  const [h] = sanearHist([{ id: 'a', ts: 1, actor: 'user', text: 'x', undo: { field: 'score', prev: 32 }, kind: 'task' }]);
  assert.deepEqual(h.undo, { field: 'score', prev: 32 });
  assert.equal(h.kind, 'task');
});

// ── Envejecimiento: el tiempo mueve la prioridad ─────────────────────────────────────
// Las dos reglas las pidió el dueño textual: «30 días sin tocar baja, deadline a menos de
// 7 sube». Lo que la MEDICIÓN cambió del diseño está en el comentario de envejecer.ts.

test('empujeDeadline — una VENCIDA pesa más que una que vence mañana', () => {
  // Ya falló, y el tablero no lo decía en ningún lado: había 25 vencidas, la más vieja
  // hacía 13 días, y 7 de ellas ni siquiera estaban en Alta.
  assert.ok(empujeDeadline(-1) > empujeDeadline(1));
  assert.ok(empujeDeadline(1) > empujeDeadline(5));
  assert.ok(empujeDeadline(5) > empujeDeadline(10));
  assert.equal(empujeDeadline(30), 0, 'una fecha lejana no empuja nada');
  assert.equal(empujeDeadline(null), 0, 'y sin fecha no hay empuje: 425 de 550 tareas no tienen');
});

test('castigoQuietud — arranca en el día 30 y TIENE TOPE', () => {
  assert.equal(castigoQuietud(29), 0, 'hasta el día 29 no pasa nada');
  assert.equal(castigoQuietud(30), 1, 'y arranca de a poco, no de golpe');
  assert.equal(castigoQuietud(60), 20);
  assert.equal(castigoQuietud(3000), 20, 'el tope impide que la regla entierre sola algo importante');
});

test('esToque — lista CERRADA: lo que hace el SISTEMA no cuenta como toque', () => {
  // Medido: con `actor === user` solo 7 de 550 tareas tenían señal, y `Math.max` sobre TODO
  // el historial marca como «tocada hoy» cualquier tarjeta que el Perro acaba de puntuar.
  const h = (actor: string, text: string) => ({ id: 'x', ts: 1, actor, text } as never);
  assert.equal(esToque(h('user', 'Editó el título')), true);
  assert.equal(esToque(h('ia', 'Creó la tarjeta — Fathom')), true, 'nació porque él lo dijo');
  assert.equal(esToque(h('ia', 'MaKo le sumó contexto (no la duplicó) — Fathom')), true, 'volvió a hablar de esto');
  assert.equal(esToque(h('ia', 'MaKo la priorizó — score 62')), false, 'el Perro puntuando no es un toque');
  assert.equal(esToque(h('ia', 'MaKo la movió a «CRM» al reordenar el tablero')), false);
  assert.equal(esToque(h('ia', 'MaKo reescribió el detalle con el contexto de la fuente')), false, 'un barrido de mantenimiento tampoco');
});

test('diasQuieta — un ts corrupto no envenena la cuenta', () => {
  // Es la razón por la que hay un filtro de finitos antes del Math.max: había 418 entradas
  // con `ts` en string ISO, y NaN en una comparación es siempre false.
  const ahora = Date.parse('2026-08-21T12:00:00Z');
  const hist = sanearHist([
    { id: 'a', ts: 'no es fecha', actor: 'ia', text: 'Creó la tarjeta — Fathom' },
    { id: 'b', ts: ahora - 5 * 86400000, actor: 'ia', text: 'Creó la tarjeta — Fathom' },
  ]);
  assert.equal(diasQuieta(hist, undefined, ahora), 5);
});

test('diasQuieta — sin ningún toque cuenta desde que nació', () => {
  const ahora = Date.parse('2026-08-21T12:00:00Z');
  assert.equal(diasQuieta([], ahora - 40 * 86400000, ahora), 40);
});

test('diasAlDeadline — el mediodía UTC evita que ±3 horas cambien el día', () => {
  const ahora = Date.parse('2026-08-21T02:00:00Z');   // de madrugada en UTC
  assert.equal(diasAlDeadline('2026-08-21', ahora), 1, 'hoy sigue contando como hoy');
  assert.equal(diasAlDeadline('2026-08-14', ahora), -6);
  assert.equal(diasAlDeadline('', ahora), null, 'la columna es NOT NULL con default vacío: nunca llega null');
  assert.equal(diasAlDeadline(undefined, ahora), null);
});

test('ajusteTemporal — cuando las dos reglas chocan, se restan y la razón dice las dos', () => {
  const aj = ajusteTemporal({ quieta: 40, alDeadline: 2 });
  assert.equal(aj.delta, 20 - 11);
  assert.ok(aj.razon.includes('vence en 2') && aj.razon.includes('40 días'));
});

test('ajusteTemporal — sin nada que decir, delta 0 y razón vacía (no se pinta ningún chip)', () => {
  assert.deepEqual(ajusteTemporal({ quieta: 3, alDeadline: 90 }), { delta: 0, razon: '' });
});
