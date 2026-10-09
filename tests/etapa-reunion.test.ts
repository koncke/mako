// =============================================================================
// «Es una reunión» en el editor de etapas del CRM
// =============================================================================
// Pedido de Martín (09/10/2026, vía el chat de Chatbot): «dentro del editor de etapas en el CRM,
// debería poder seleccionarse qué etapas hacen referencia a una REUNIÓN». Ver
// lib/etapa-reunion.ts.
//
// Verificado en ws3 el 09/10 (scratchpad/reunion-ws3.mts, con la misma transformación que la
// action): desmarcar «Agenda R2» guardó `kind: 'paso'`, bajó el nivel de Facturando de 4 a 2 y
// el de Ganado de 5 a 3, y sacó 6 transiciones (las de no-show y «asistió, no compró» de la R2).
// Volver a marcarla dejó el embudo IDÉNTICO al de antes y las demás etapas intactas.
//
// Correr: npx tsx --test tests/etapa-reunion.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (09/10/2026), una rotura por vez, 5 tests: dejar marcar cualquier
// etapa salvo el cierre, dejar marcar las terminales, desmarcar a `undefined` en vez de
// `'paso'`, no contar las reuniones que se corren, no avisar la tercera sin lugar, sacar el
// guardia de la action y marcar sin preguntar cuando una reunión se corre: 4 / 1 cada una.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { puedeSerReunion, tipoAlMarcar, cambioDeReuniones, reunionSinLugar } from '../lib/etapa-reunion';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// El embudo de plantilla de ws3, con una etapa de paso sumada al medio.
const EMBUDO = [
  { key: 'lead', label: 'Lead entrante', kind: 'entrada' },
  { key: 'st0', label: 'Calificado', kind: 'paso' },
  { key: 'agenda', label: 'Agenda R1', kind: 'reunion' },
  { key: 'agendaj2', label: 'Agenda R2', kind: 'reunion' },
  { key: 'st1', label: 'Propuesta', kind: 'paso' },
  { key: 'facturando', label: 'Facturando', kind: 'pago' },
  { key: 'ganado', label: 'Ganado', kind: 'cierre' },
];

test('qué etapa se puede marcar: las de paso y las reuniones; nunca entrada, pago, cierre ni terminales', () => {
  assert.equal(puedeSerReunion({ key: 'st0', kind: 'paso' }), true);
  assert.equal(puedeSerReunion({ key: 'st9' }), true, 'una etapa sin tipo es un paso');
  assert.equal(puedeSerReunion({ key: 'agenda', kind: 'reunion' }), true, 'tiene que poder desmarcarse');
  for (const kind of ['entrada', 'pago', 'cierre', 'grupo']) {
    assert.equal(puedeSerReunion({ key: 'x', kind }), false, `una etapa de ${kind} perdería su tipo`);
  }
  for (const key of ['ganado', 'perdido', 'descal', 'noresp']) {
    assert.equal(puedeSerReunion({ key, kind: 'paso' }), false, `${key} está en todos los embudos`);
  }
  assert.equal(tipoAlMarcar(true), 'reunion');
  assert.equal(tipoAlMarcar(false), 'paso', 'apagada vuelve a ser un paso, como una etapa nueva');
});

test('marcar una etapa ANTES de una reunión la corre de número; después, no', () => {
  // «Calificado» va antes de la R1: las dos reuniones que había pasan a ser la 2 y la 3.
  const antes = cambioDeReuniones(EMBUDO, 'st0', true);
  assert.deepEqual(antes.corridas.map((r) => [r.key, r.de, r.a]), [['agenda', 1, 2], ['agendaj2', 2, 3]]);
  // «Propuesta» va después: nadie se corre, pero es la tercera y no tiene dónde.
  const despues = cambioDeReuniones(EMBUDO, 'st1', true);
  assert.deepEqual(despues.corridas, []);
  assert.deepEqual(despues.sinLugar, ['st1']);
  // Desmarcar la R1 corre a la R2 al primer lugar.
  assert.deepEqual(cambioDeReuniones(EMBUDO, 'agenda', false).corridas.map((r) => [r.key, r.de, r.a]), [['agendaj2', 2, 1]]);
  // Desmarcar la última no corre a nadie.
  assert.deepEqual(cambioDeReuniones(EMBUDO, 'agendaj2', false).corridas, []);
});

test('la tercera reunión no tiene dónde guardar fecha ni asistencia', () => {
  const con3 = EMBUDO.map((e) => (e.key === 'st1' ? { ...e, kind: 'reunion' } : e));
  assert.equal(reunionSinLugar(con3, 'st1'), true);
  assert.equal(reunionSinLugar(con3, 'agenda'), false);
  assert.equal(reunionSinLugar(con3, 'agendaj2'), false);
});

test('la action lo decide del lado del server, con la misma regla', () => {
  const src = sinComentarios(leer('app/crm/actions.ts'));
  const i = src.indexOf("} else if (op.op === 'reunion') {");
  assert.ok(i > 0, 'falta la op reunion en editarEtapaAction');
  const rama = src.slice(i, src.indexOf('} else {', i));
  assert.match(rama, /if \(!puedeSerReunion\(st\)\) return \{ ok: false/, 'la action guarda lo que mande el navegador');
  assert.match(rama, /kind: tipoAlMarcar\(op\.es\)/);
});

test('la pantalla pregunta antes de correr una reunión de número, y muestra el botón sólo donde se puede', () => {
  const src = sinComentarios(leer('app/crm/EtapasModal.tsx'));
  assert.match(src, /\{puedeSerReunion\(e\) && \(\s*<BotonReunion/);
  const f = src.slice(src.indexOf('const marcarReunion'), src.indexOf('const marcarReunion') + 900);
  assert.match(f, /cambioDeReuniones\(etapas, e\.key, es\)/);
  assert.match(f, /if \(!c\.corridas\.length\) \{ hacer\(\); return; \}/, 'sin nada que se corra, se marca sin fricción');
  assert.match(f, /setConfirmar\(/, 'si una reunión se corre de número, se pregunta');
});
