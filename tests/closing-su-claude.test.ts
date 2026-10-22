// =============================================================================
// IA12 (22/10/2026): el Closing Analyst corre con el Claude del cliente, no con el de MaKo
// =============================================================================
// closing hizo 123 llamadas por US$13,22 en 30 días (ws9: 69, ws1: 54), siempre con la clave de la plataforma (la del ws1 es
// una copia), y el permiso de Sonnet para closing vence el 2026-11-13 (lib/veto-claude.ts). Lo que fija este test, corriendo
// `analyzeMeeting` de verdad (tests/_closing-su-claude-hijo.ts):
//   1. un negocio con su clave analiza con SU clave y el modelo que eligió (IA5), con su marca en el gasto;
//   2. si su clave falla, se dice y la clave de MaKo no se toca;
//   3. sin clave y con el permiso de la plataforma vencido, el cliente lee «Conecta tu Claude para el Closing Analyst», no
//      «Claude vetado».
//
// Probado rompiéndolo (22/10/2026, una rotura por vez, restaurada):
//   · sin probar la clave del negocio primero → 1 en rojo;
//   · su clave rota cayendo al camino de la plataforma → 2 en rojo;
//   · el permiso vencido sin traducir → 3 en rojo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
type Corrida = { r: { ok: boolean; model?: string; error?: string }; pedidos: Array<{ host: string; clave: string; model: string }> };
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_closing-su-claude-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'ignore'],
});
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as { ws3: Corrida; ws11: Corrida; ws13: Corrida; gasto: Array<{ ws: number; model: string; motivo: string }>; error?: string };

test('1. con su clave, el closing corre con SU Claude y el modelo que eligió, con su marca en el gasto', () => {
  assert.equal(R.error, undefined, String(R.error));
  assert.equal(R.ws3.r.ok, true, String(R.ws3.r.error));
  assert.equal(R.ws3.r.model, 'claude-sonnet-5');
  assert.deepEqual(R.ws3.pedidos.map((p) => [p.host, /DEL-NEGOCIO/.test(p.clave), p.model]), [['api.anthropic.com', true, 'claude-sonnet-5']]);
  assert.ok(R.gasto.some((g) => g.ws === 3 && g.model === 'claude-sonnet-5' && g.motivo.startsWith('⚠ clave de Anthropic del negocio')));
});

test('2. si su clave falla, se dice, y la de MaKo no se toca', () => {
  assert.equal(R.ws11.r.ok, false);
  assert.match(R.ws11.r.error ?? '', /^Tu clave de Claude no pudo analizar la llamada/);
  assert.ok(R.ws11.pedidos.every((p) => !/PLATAFORMA/.test(p.clave)), 'la clave de la plataforma no se usa');
  assert.equal(R.ws11.pedidos.length, 1);
});

test('3. sin clave y con el permiso vencido: «Conecta tu Claude para el Closing Analyst», sin gastar nada', () => {
  assert.equal(R.ws13.r.ok, false);
  assert.match(R.ws13.r.error ?? '', /^Conecta tu Claude para el Closing Analyst/);
  assert.deepEqual(R.ws13.pedidos, []);
});
