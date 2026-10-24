// =============================================================================
// El Fathom se pide por REUNIÓN: cargada la R1, la R2 también se pide (24/10/2026)
// =============================================================================
// Martín, 03/07 (memoria ficha-lead-v5-pedido.md; docs/feedback-diseno-pendiente.md, «El CRM, medido aparte»): «Fathom se
// pide siempre pero es opcional». `stepsForStage` miraba «¿hay ALGÚN link?», así que con la grabación de la R1 cargada la de
// la R2 no se pedía nunca, y el paso del wizard mostraba la misma lista en los dos casos.
//
// Lo que NO cambia a propósito: quien no pasa el link de cada reunión (el «Completar datos», el server) sigue con «hay
// alguno». Un lead ganado hace meses con sólo la R1 grabada no se vuelve un faltante en «A revisar».
//
// PROBADO ROMPIÉNDOLO: con `hayFathomR2` mirando otra vez «hay alguno», falla el primero; sin el `fathomPorReunion` del
// guard (sólo un paso), el segundo; con el guard sacado del todo, el tercero (el viejo pide dos veces lo mismo); sin el
// `hasFathomR2: false` de VACIAR, el cuarto; con el paso del wizard validando «algún link», el quinto.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stepsForStage, pasosResueltos, type StageReqValues } from '../lib/stage-requirements';

const ids = (stage: string, v: StageReqValues) => stepsForStage(stage, v).map((s) => s.id);
// Un lead que pasó las dos reuniones y se cierra en Ganado, con todo lo demás cargado.
const lleno: StageReqValues = {
  hoyISO: '2026-10-24', fechaJ1: '2026-10-01', asistioJ1: true, calificado: true, closer: 'Ana',
  fechaJ2: '2026-10-10', asistioJ2: true, monto: 1000,
  dealServicioOk: true, dealPromesaOk: true, dealFiscalOk: true, dealFiscalDocOk: true, dealObligacionesOk: true,
};

test('con la grabación de la R1 cargada, el wizard pide la de la R2', () => {
  const got = ids('ganado', { ...lleno, hasFathomUrl: true, hasFathomR1: true, hasFathomR2: false });
  assert.ok(got.includes('fathomR2'), 'la R2 no se pide');
  assert.ok(!got.includes('fathomR1'));
  assert.deepEqual(ids('ganado', { ...lleno, hasFathomUrl: true, hasFathomR1: true, hasFathomR2: true }).filter((s) => s.startsWith('fathom')), []);
});

test('sin ninguna grabación y con el link de cada reunión, se piden las dos', () => {
  const got = ids('ganado', { ...lleno, hasFathomUrl: false, hasFathomR1: false, hasFathomR2: false });
  assert.ok(got.includes('fathomR1') && got.includes('fathomR2'));
});

test('quien no pasa el link de cada reunión sigue como antes (no se llena «A revisar»)', () => {
  assert.deepEqual(ids('ganado', { ...lleno, hasFathomUrl: true }).filter((s) => s.startsWith('fathom')), [], 'un link alcanza');
  assert.deepEqual(ids('ganado', { ...lleno, hasFathomUrl: false }).filter((s) => s.startsWith('fathom')), ['fathomR1'], 'sin links, un solo paso');
  // «No se grabó» y un encuentro que no se graba siguen apagando los dos.
  assert.deepEqual(ids('ganado', { ...lleno, hasFathomR1: false, hasFathomR2: false, fathomOmitido: true }).filter((s) => s.startsWith('fathom')), []);
  assert.deepEqual(ids('ganado', { ...lleno, hasFathomR1: false, hasFathomR2: false, grabable: false }).filter((s) => s.startsWith('fathom')), []);
});

test('el «✓» de la R2 se dice cuando su link está cargado', () => {
  const resueltos = pasosResueltos('ganado', { ...lleno, hasFathomUrl: true, hasFathomR1: true, hasFathomR2: true }).map((s) => s.id);
  assert.ok(resueltos.includes('fathomR1') && resueltos.includes('fathomR2'));
});

test('el wizard: un link por reunión, con el reparto de la ficha', () => {
  const src = readFileSync(join(__dirname, '..', 'app/crm/StageMoveDialog.tsx'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(src, /hasFathomR1: lead\.fathom\.some\(\(f\) => f\.url\?\.trim\(\) && !etiquetaEsR2\(f\.label\)\),/);
  assert.match(src, /hasFathomR2: lead\.fathom\.some\(\(f\) => f\.url\?\.trim\(\) && etiquetaEsR2\(f\.label\)\),/);
  assert.match(src, /case 'fathomR1': case 'fathomR2': return fathomOmitido \|\| !!linkDe\(paso === 'fathomR2'\)\.trim\(\);/, 'un link cualquiera contesta los dos pasos');
  assert.match(src, /setFathom\(\(arr\) => ponerLinkFathom\(arr, r2 \? 'fathom_r2' : 'fathom_r1', url \|\| null, etiquetaEsR2\)\)/);
  assert.doesNotMatch(src, /\+ Agregar otro link/);
});
