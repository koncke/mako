// =============================================================================
// La línea sorda o atrasada se recupera en UN paso: el panel la desvincula y da el QR (11/11/2026, informe de la voz sorda)
// =============================================================================
// La voz estuvo sorda de las 12:14 a las 21:51 UTC contestando la sonda y mandando; ws20, ws21 y ws22 reciben todo con ~24 h de
// atraso desde hace días. La cura es un dispositivo nuevo (QR). Pero «Conectar por QR» veía la sonda «viva» y contestaba «ya está
// conectada» (lib/mako-canal.ts:257): Martín tenía que desvincularla desde el teléfono primero, y el cliente de ws20 ni sabría cómo.
// Lo que fija:
//   1. la regla pura (`puedeSoltarseSorda`, `vinculadaDesdeDe`): sólo con la marca medida sobre la vinculación de AHORA;
//   2. la función REAL de las dos pantallas (tests/_linea-enferma-qr-hijo.ts): marcada → logout por API y QR, sin borrar la instancia
//      ni reiniciar; sin marca, con la marca de antes del último QR o con la marca rota → no se toca la sesión;
//   3. el cableado: el corte de la sonda viva sigue en su lugar, y la excepción va adentro.
//
// Probado rompiéndolo (11/11/2026, una rotura por vez, restaurada): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { puedeSoltarseSorda, vinculadaDesdeDe } from '../lib/linea-sorda';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const T = (iso: string) => Date.parse(iso);

test('1. la regla: se suelta sólo con la marca medida sobre la vinculación de ahora', () => {
  // La voz del 11/11: rehecha con el QR de las 02:51:07 (createdAt), su corte anterior a las 02:40:30.
  const v = vinculadaDesdeDe({ createdAt: '2026-11-11T02:51:07.000Z', disconnectionAt: '2026-11-11T02:40:30.000Z' });
  assert.equal(v, T('2026-11-11T02:51:07.000Z'));
  // Martín la desvinculó desde el teléfono a las 21:50:20 (401, `disconnectionAt`) y escaneó: ésa es la vinculación nueva.
  const nueva = vinculadaDesdeDe({ createdAt: '2026-11-11T02:51:07.000Z', disconnectionAt: '2026-11-11T21:50:20.391Z' });
  assert.equal(nueva, T('2026-11-11T21:50:20.391Z'));
  assert.equal(vinculadaDesdeDe({}), null);
  assert.equal(vinculadaDesdeDe(null), null);
  assert.equal(puedeSoltarseSorda({ vinculadaDesde: v }, v), true, 'marcada sobre esta vinculación');
  assert.equal(puedeSoltarseSorda({ vinculadaDesde: v }, nueva), false, 'soltó la línea que se acaba de curar');
  assert.equal(puedeSoltarseSorda(null, v), false, 'sin marca se suelta');
  assert.equal(puedeSoltarseSorda({ vinculadaDesde: null }, v), false, 'sin saber sobre qué vinculación se midió');
  assert.equal(puedeSoltarseSorda({ vinculadaDesde: v }, null), false, 'sin saber cuándo se vinculó');
});

test('2. la función real: marcada → logout y QR en un paso; si no, la sesión no se toca', () => {
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_linea-enferma-qr-hijo.ts', import.meta.url))], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 240_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@QR@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  const o = JSON.parse(linea.slice('@@QR@@'.length));
  assert.equal(o.error, undefined, String(o.error));
  // La voz marcada sorda: logout por API y el QR, en el mismo clic.
  assert.deepEqual(o.vozMarcada.logout, ['/instance/logout/mako_superadmin_muylqv8r'], JSON.stringify(o.vozMarcada));
  assert.equal(o.vozMarcada.r.ok, true, JSON.stringify(o.vozMarcada.r));
  assert.equal(o.vozMarcada.r.qr.code, '2@qr-nuevo');
  // Sin marca, o con la marca de antes del último QR: «ya está conectada» y nada más.
  for (const k of ['vozSinMarca', 'vozYaReVinculada']) {
    assert.deepEqual(o[k].logout, [], `${k}: desvinculó una voz que no está marcada sobre esta vinculación`);
    assert.match(String(o[k].r.error), /ya está conectada y respondiendo/, `${k}: ${JSON.stringify(o[k].r)}`);
  }
  // La línea de un negocio marcada atrasada: igual, y la instancia queda (es re-vincular la misma línea).
  assert.deepEqual(o.negocioMarcado.logout, ['/instance/logout/mako_ws20'], JSON.stringify(o.negocioMarcado));
  assert.equal(o.negocioMarcado.r.ok, true, JSON.stringify(o.negocioMarcado.r));
  assert.equal(o.negocioMarcado.r.qr.code, '2@qr-nuevo');
  for (const k of ['negocioSinMarca', 'marcaRota']) assert.deepEqual(o[k].logout, [], `${k}: desvinculó la línea viva de un cliente sin marca`);
  for (const k of Object.keys(o)) assert.deepEqual([o[k].borrar, o[k].reinicio, o[k].crear], [0, 0, 0], `${k}: borró, reinició o creó una instancia`);
});

test('3. el cableado: el corte de la sonda viva sigue, con la excepción adentro', () => {
  const canal = sinComentarios(leer('lib/mako-canal.ts'));
  assert.match(canal, /if \(sondeo === 'vivo'\) \{\n\s*const marca = await marcaDeLineaEnferma\(inst\);\n\s*if \(!marca \|\| !puedeSoltarseSorda\(marca, await vinculadaDesdeDeLinea\(inst\)\.catch\(\(\) => null\)\)\) \{\n\s*return \{ ok: false, error: 'La línea ya está conectada y respondiendo/);
  const ev = sinComentarios(leer('lib/evolution.ts'));
  assert.match(ev, /if \(abierta && c\.ok && !c\.data\.base64 && !c\.data\.code\) \{\n\s*const marca = await marcaDeLineaEnferma\(instance\);\n\s*if \(marca && puedeSoltarseSorda\(marca, vinculadaDesdeDe\(fila\)\)\) \{/);
  assert.ok(!/instance\/restart/.test(ev) && !/instance\/restart/.test(canal), 'volvió el POST /instance/restart: no cura una línea sorda');
});

// ── Probado rompiéndolo (11/11/2026; cada rotura sola, restaurada después) ──────────────────────────────────────────────
//   Q1 la voz sin la excepción (vuelve el «ya está conectada» de siempre)                → fallan el 2 y el 3
//   Q2 la voz sin mirar la vinculación (suelta con la marca vieja)                       → fallan el 2 y el 3
//   Q3 el negocio sin la excepción                                                       → fallan el 2 y el 3
//   Q4 `puedeSoltarseSorda` sin comparar la vinculación                                  → fallan el 1 y el 2
