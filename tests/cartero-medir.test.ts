// =============================================================================
// `cartero.mjs medir`: el Runner de la app anota las dos ventanas de uso (17/10/2026)
// =============================================================================
// Pedido de Martín: «comienza a medir el % de la ventana de 5 hs». La app no tiene barra de estado, así que el Ops Center
// decía «Sesión de 5 horas: Sin medir» para la cuenta 4. Ahora el Runner llama a get_usage en cada vuelta y pasa las dos
// ventanas a `medir`, que escribe:
//   - USO/<cuenta>.json, lo que sube `cuotaDe` al Ops Center;
//   - uso-cinco.txt y uso-semanal.txt, lo que lee el corte del 97% (~/.claude/guardia/corte-97.mjs).
//
// Probado rompiéndolo (17/10/2026):
//   - sin escribir uso-cinco.txt → 1 / 1 (el corte del 97% se queda sin la ventana de 5 h);
//   - aceptando un % que no es número → 1 / 1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const casa = mkdtempSync(join(tmpdir(), 'cartero-medir-'));
mkdirSync(join(casa, '.claude'), { recursive: true });
process.env.CARTERO_HOME = casa;
process.env.CARTERO_DIR = join(casa, '.claude', 'operaciones');

const cargar = async () => import(pathToFileURL(join(process.cwd(), 'scripts/operaciones/cartero.mjs')).href) as Promise<{
  medir: (cuenta: string, args: string[], ahora?: number) => { cinco: { pct: number } | null; semana: { pct: number } | null; medido: string };
}>;

test('medir anota las dos ventanas para el Ops Center y para el corte del 97%', async () => {
  const { medir } = await cargar();
  const ahora = Date.parse('2026-10-17T12:00:00Z');
  const r = medir('claude4', ['41.6', '2026-10-17T14:40:00Z', '26', '2026-10-20T20:00:00Z'], ahora);
  assert.equal(r.cinco?.pct, 42);
  assert.equal(r.semana?.pct, 26);
  const json = JSON.parse(readFileSync(join(casa, '.claude', 'operaciones', 'uso', 'claude4.json'), 'utf8'));
  assert.equal(json.cinco.pct, 42);
  assert.equal(json.cinco.reinicia, '2026-10-17T14:40:00.000Z');
  assert.equal(readFileSync(join(casa, '.claude', 'uso-cinco.txt'), 'utf8').trim(), '42 2026-10-17T14:40:00.000Z 2026-10-17T12:00:00.000Z claude4');
  assert.equal(readFileSync(join(casa, '.claude', 'uso-semanal.txt'), 'utf8').trim(), '26 2026-10-20T20:00:00.000Z 2026-10-17T12:00:00.000Z claude4');
});

test('sin ningún número no anota nada: no inventa una medición', async () => {
  const { medir } = await cargar();
  assert.throws(() => medir('claude4', ['cuarenta', 'x', '', '']), /uso: medir/);
});
