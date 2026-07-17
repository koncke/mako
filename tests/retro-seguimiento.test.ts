// =============================================================================
// La rendición de cuentas de la Retro: aceptar NO es hacer.
// =============================================================================
// Regla que dictó Martín (punto 7 de "Terminar la Retro"): si NO se completaron
// las tareas y experimentos de la última Retro, no se ejecuta la nueva. Eso solo
// tiene sentido si "se completaron" es VERDAD, y hasta este cambio era mentira:
// una tarea con status 'aceptada' se reportaba como {st:'done', fxT:'good'} sin
// mirar jamás la tabla de tareas. El cerebro que arma el plan siguiente leía ese
// verde y se autoengañaba cada semana.
//
// Estos tests fijan la regla para que no vuelva a aflojarse.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seguimientoDeItem } from '../lib/retro-seguimiento';
import type { RetroPlanItem } from '../lib/retro-reporte';

const tarea = (over: Partial<RetroPlanItem> = {}): RetroPlanItem =>
  ({ kind: 'tarea', titulo: 'Rehacer el creativo', why: '', ...over }) as RetroPlanItem;

const enBoard = (over: Partial<{ id: number; titulo: string; estado: string; progreso: number }> = {}) =>
  ({ id: 10, titulo: 'Rehacer el creativo', estado: 'por_hacer', progreso: 0, ...over });

// ── El corazón: aceptada y sin tocar NO es "hecho" ──────────────────────────
test('tarea aceptada pero en 0% → NO es done (era la mentira)', () => {
  const r = seguimientoDeItem(
    tarea({ status: { estado: 'aceptada', tarea_id: 10, at: '' } }),
    [],
    [enBoard({ progreso: 0 })],
  );
  assert.equal(r.st, 'no');
  assert.equal(r.estado, 'Aceptada y sin tocar');
  assert.equal(r.fxT, 'bad', 'aceptar sin hacer no puede pintar verde');
});

test('tarea aceptada y completada → done', () => {
  const r = seguimientoDeItem(
    tarea({ status: { estado: 'aceptada', tarea_id: 10, at: '' } }),
    [],
    [enBoard({ estado: 'hecho', progreso: 100 })],
  );
  assert.equal(r.st, 'done');
  assert.equal(r.fxT, 'good');
});

test('tarea aceptada y empezada → en curso, con el % real', () => {
  const r = seguimientoDeItem(
    tarea({ status: { estado: 'aceptada', tarea_id: 10, at: '' } }),
    [],
    [enBoard({ progreso: 40 })],
  );
  assert.equal(r.st, 'curso');
  assert.equal(r.fx, '40%');
  assert.equal(r.fxT, 'warn');
});

test('progreso 100 sin estado hecho también cuenta como done', () => {
  const r = seguimientoDeItem(
    tarea({ status: { estado: 'aceptada', tarea_id: 10, at: '' } }),
    [],
    [enBoard({ estado: 'en_curso', progreso: 100 })],
  );
  assert.equal(r.st, 'done');
});

// ── El vínculo ───────────────────────────────────────────────────────────────
test('sin tarea_id, matchea por título', () => {
  const r = seguimientoDeItem(
    tarea({ titulo: 'Rehacer el creativo', status: { estado: 'aceptada', at: '' } }),
    [],
    [enBoard({ id: 99, estado: 'hecho', progreso: 100 })],
  );
  assert.equal(r.st, 'done', 'las retros viejas no guardaron tarea_id: el título es el fallback');
});

test('tarea_id gana sobre el título homónimo', () => {
  const r = seguimientoDeItem(
    tarea({ status: { estado: 'aceptada', tarea_id: 10, at: '' } }),
    [],
    [enBoard({ id: 7, progreso: 100 }), enBoard({ id: 10, progreso: 0 })],
  );
  assert.equal(r.st, 'no', 'con dos tareas del mismo título, manda el id');
});

test('aceptada pero la tarea no está en el tablero → se perdió, y se dice', () => {
  const r = seguimientoDeItem(tarea({ status: { estado: 'aceptada', tarea_id: 10, at: '' } }), [], []);
  assert.equal(r.st, 'no');
  assert.equal(r.fxT, 'bad');
  assert.match(r.estado, /no está en el tablero/);
});

// ── Los experimentos nunca mintieron: que siga siendo así ────────────────────
test('experimento cerrado y validado → done', () => {
  const r = seguimientoDeItem(
    tarea({ kind: 'exp', status: { estado: 'aceptada', experimento_id: 3, at: '' } }),
    [{ id: 3, estado: 'cerrado', veredicto: 'validada' }],
    [],
  );
  assert.equal(r.st, 'done');
  assert.equal(r.fx, 'validada');
});

test('experimento aceptado y abierto → en curso, no done', () => {
  const r = seguimientoDeItem(
    tarea({ kind: 'exp', status: { estado: 'aceptada', experimento_id: 3, at: '' } }),
    [{ id: 3, estado: 'abierto', veredicto: null }],
    [],
  );
  assert.equal(r.st, 'curso');
});

// ── Los estados que ya andaban ──────────────────────────────────────────────
test('sin status → sin tocar', () => {
  assert.equal(seguimientoDeItem(tarea(), [], []).estado, 'Sin tocar');
});

test('pospuesta y descartada no cuentan como hechas', () => {
  assert.equal(seguimientoDeItem(tarea({ status: { estado: 'pospuesta', at: '' } }), [], []).st, 'no');
  const d = seguimientoDeItem(tarea({ status: { estado: 'descartada', motivo: 'no aplica', at: '' } }), [], []);
  assert.equal(d.st, 'no');
  assert.match(d.estado, /no aplica/);
});
