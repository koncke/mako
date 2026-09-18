// 08-T22 — Guardar en el CRM nunca se bloquea por datos que faltan.
//
// Mauricio, 08/09: «me meto al CRM y me pregunta un chorro de cosas… quiero nomás
// cambiar este… yo veo esto que me dice define no sé cuántas cosas y ya lo
// abandono». Actualizaba el CRM una vez por semana. Decisión del 17/09 (Martín):
// mover y cambiar se guardan siempre, Ganado incluido; lo que falta queda
// pendiente, visible y sin bloquear, y MaKo lo pide después. Reemplaza la regla
// del 21/06 y 03/07 («ninguna blanda») — ver docs/hallazgos-crm.md.
//
// Tres cosas que se testean acá:
//   1. Las dos señales de Meta que se OFRECEN al mover (senales-meta.ts), que es
//      lógica pura: cuándo tiene sentido preguntar cada una.
//   2. El CABLEADO: que ningún camino vuelva a frenar un movimiento por datos.
//      Son guardas sobre el código fuente, como las de leads-duplicados.test.ts.
//   3. Que la ficha mueva como el tablero: qué etapa va directo y cuál al wizard.
//
// Probado rompiendo cada cosa por separado (17 tests): setLeadStageAction con un
// `return { ok: false }` antes de mover, handleDrop abriendo el wizard otra vez,
// el wizard sin «Guardar y completar después», asistenciaImplicita dándole
// asistencia a una pérdida, la ficha abriendo siempre el wizard, pideWizardAlElegir
// sin el respaldo para un funnel sin `kind`, y el tablero con su propia copia de
// los chips. Cada rotura: 16 pases y 1 fallo. Restaurado: 17 de 17.
// Correr: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { senalesAOfrecer, asistenciaImplicita, hayAlgoQueOfrecer } from '../app/crm/senales-meta';
import { pideWizardAlElegir } from '../app/crm/mover-etapa';
import { DEFAULT_STAGES, generateFunnel, DEFAULT_PIPELINE } from '../lib/pipeline';

const HOY = '2026-09-17';
const leadR1 = (over: Partial<{ fechaJ1: string | null; asistioJ1: boolean | null; calificado: boolean | null }> = {}) =>
  ({ fechaJ1: '2026-09-10', asistioJ1: null, calificado: null, ...over });

// ── 1. Las señales de Meta ──────────────────────────────────────────────────────

test('sin reunión de la que hablar no se ofrece nada', () => {
  // Sin fecha de R1, updateLead anula asistencia y calificado: preguntarlos es pedir
  // un dato que se tira.
  assert.equal(hayAlgoQueOfrecer(senalesAOfrecer(leadR1({ fechaJ1: null }), { hoyISO: HOY })), false);
  // Una R1 que todavía no ocurrió no tiene asistencia que marcar.
  assert.equal(hayAlgoQueOfrecer(senalesAOfrecer(leadR1({ fechaJ1: '2026-09-20' }), { hoyISO: HOY })), false);
});

test('la R1 de hoy sí cuenta: si alguien mueve al lead, algo pasó', () => {
  const s = senalesAOfrecer(leadR1({ fechaJ1: HOY }), { hoyISO: HOY });
  assert.equal(s.asistio, true);
});

test('con la R1 pasada y nada marcado se ofrecen las dos', () => {
  const s = senalesAOfrecer(leadR1(), { hoyISO: HOY });
  assert.deepEqual(s, { asistio: true, calificado: true, asistioConocida: null });
});

test('si ya se sabe que asistió, solo queda calificado', () => {
  const s = senalesAOfrecer(leadR1({ asistioJ1: true }), { hoyISO: HOY });
  assert.deepEqual(s, { asistio: false, calificado: true, asistioConocida: true });
});

test('si no asistió no hay calificación posible', () => {
  assert.equal(hayAlgoQueOfrecer(senalesAOfrecer(leadR1({ asistioJ1: false }), { hoyISO: HOY })), false);
});

test('nada que ofrecer cuando las dos ya están marcadas', () => {
  assert.equal(hayAlgoQueOfrecer(senalesAOfrecer(leadR1({ asistioJ1: true, calificado: true }), { hoyISO: HOY })), false);
});

test('avanzar de etapa implica que asistió: no se pregunta, y queda calificado', () => {
  const tr = { asistioJ1: true, category: 'avanza' };
  assert.equal(asistenciaImplicita(tr), true);
  assert.deepEqual(senalesAOfrecer(leadR1(), { tr, hoyISO: HOY }), { asistio: false, calificado: true, asistioConocida: true });
});

test('un no-show implica que NO asistió', () => {
  assert.equal(asistenciaImplicita({ asistioJ1: false, category: 'nutricion' }), false);
});

test('⚠️ perderse NO implica haber asistido', () => {
  // El funnel generado marca «Se perdió» con asistioJ1: true. Copiar ese flag
  // escribía "asistió a la reunión" en leads de los que nadie sabía si se habían
  // presentado. En el wizard se corrigió en agosto; el arrastre lo seguía teniendo.
  const tr = { asistioJ1: true, category: 'perdida' };
  assert.equal(asistenciaImplicita(tr), undefined);
  const s = senalesAOfrecer(leadR1(), { tr, hoyISO: HOY });
  assert.equal(s.asistio, true, 'se pregunta, en vez de darlo por hecho');
  assert.equal(s.asistioConocida, null);
});

// ── 2. El cableado: nada frena un movimiento por datos ──────────────────────────

const leer = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
/** El cuerpo de una función top-level: desde su firma hasta el `}` en columna 0. */
const cuerpo = (src: string, firma: string) => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  return src.slice(i, src.indexOf('\n}\n', i) + 3);
};

test('CABLEADO: mover desde el tablero se guarda aunque falten datos', () => {
  const acciones = leer('../app/crm/actions.ts');
  for (const firma of ['export async function setLeadStageAction', 'export async function completeStageMoveAction']) {
    const c = cuerpo(acciones, firma);
    assert.ok(!/ok:\s*false/.test(c), `${firma} volvió a devolver ok:false — eso frena el movimiento en la UI`);
    assert.ok(/return \{ ok: true, pendientes \}/.test(c), `${firma} tiene que devolver lo que falta como pendientes`);
    assert.ok(/registrarPendientes\(/.test(c), `${firma} tiene que dejar en el historial que se guardó incompleto`);
  }
});

test('CABLEADO: soltar una card no abre el wizard de datos', () => {
  const board = leer('../app/crm/CrmBoard.tsx');
  const i = board.indexOf('const handleDrop = (stageKey: string) => {');
  assert.ok(i >= 0, 'no encontré handleDrop');
  const drop = board.slice(i, board.indexOf('\n  };\n', i));
  assert.ok(!/openStageMove\(/.test(drop), 'handleDrop volvió a abrir StageMoveDialog en vez de mover');
  // Pero sigue pasando por la confirmación: arrastrar es fácil de hacer sin querer.
  assert.ok(/setConfirmacion\(/.test(drop), 'soltar una card tiene que seguir confirmando');
});

test('CABLEADO: el wizard de datos tiene una salida que guarda lo contestado', () => {
  const dialog = leer('../app/crm/StageMoveDialog.tsx');
  assert.ok(/extraFooter=\{!enResumen \? \(\s*<button type="button" onClick=\{confirmar\}/.test(dialog),
    'falta «Guardar y completar después» en los pasos del wizard');
  assert.ok(dialog.includes('Guardar y completar después'));
});

test('CABLEADO: las cards incompletas no titilan', () => {
  // Un tablero donde cada card incompleta parpadeaba en rojo le decía a quien
  // entraba que tenía un chorro de cosas por contestar.
  const board = leer('../app/crm/CrmBoard.tsx');
  assert.ok(!board.includes('blinkRed'), 'volvió el parpadeo al tablero');
});

// ── 3. La ficha mueve igual que el tablero ──────────────────────────────────────
// Elegir otra etapa en la ficha abría SIEMPRE el wizard con sus preguntas. Ahora
// confirma y mueve (MoverEtapaConfirm), salvo las etapas que encierran una
// decisión: reunión (¿se agenda o ya ocurrió?) y nutrición manual (el plazo).

test('desde la ficha, Ganado/Perdido/Descalificado se mueven directo', () => {
  const funnel = generateFunnel(DEFAULT_PIPELINE, []).stages;
  for (const k of ['ganado', 'facturando', 'perdido', 'descal', 'noshow_r1', 'lead']) {
    assert.equal(pideWizardAlElegir(funnel, k), false, `${k} no tendría que abrir el wizard`);
  }
});

test('las etapas de reunión y la nutrición manual sí abren el wizard', () => {
  const funnel = generateFunnel(DEFAULT_PIPELINE, []).stages;
  for (const k of ['agenda', 'agendaj2', 'manual']) assert.equal(pideWizardAlElegir(funnel, k), true, k);
});

test('con un funnel ilegible (DEFAULT_STAGES, sin kind) la reunión igual va al wizard', () => {
  // Es lo que recibe la ficha si getPipelineStages falla: sin `kind` no hay forma
  // de saber qué etapa es reunión, y mover directo a Agenda R1 saltearía la fecha.
  assert.equal(pideWizardAlElegir(DEFAULT_STAGES, 'agenda'), true);
  assert.equal(pideWizardAlElegir(DEFAULT_STAGES, 'agendaj2'), true);
  assert.equal(pideWizardAlElegir(DEFAULT_STAGES, 'ganado'), false);
});

test('CABLEADO: las dos fichas mueven con MoverEtapaConfirm, no con el wizard', () => {
  for (const f of ['../app/crm/LeadSheet.tsx', '../app/crm/[id]/LeadDetailBody.tsx']) {
    const src = leer(f);
    assert.ok(/pideWizardAlElegir\(stages, (k|key)\)\) setMoveTo\((k|key)\); else setMoverDirecto\((k|key)\)/.test(src),
      `${f}: elegir etapa tiene que decidir entre wizard y mover directo`);
    assert.ok(src.includes('<MoverEtapaConfirm'), `${f}: falta la confirmación compartida`);
  }
  // Y los toques de Meta viven en UN lugar: el tablero importa la pieza, no la copia.
  const board = leer('../app/crm/CrmBoard.tsx');
  assert.ok(!board.includes('function SenalesMetaChips'), 'el tablero volvió a tener su propia copia de los chips');
  assert.ok(board.includes("import { SenalesMetaChips } from './MoverEtapaConfirm'"));
});
