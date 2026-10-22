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
import { readFileSync } from 'node:fs';

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

// ── Lo que encontró la revisión adversarial de IA5/IA12 (22/10/2026) ──────────────────────────────────────────────────
type Bache = { ws3: Corrida; ws10: Corrida; cron: string };
const X = R as unknown as { bache: Bache; ws10: Corrida; chatClaudeConSuClave: { r: string; pedidos: unknown[] }; chatClaudeToolsConSuClave: { r: string; pedidos: unknown[] }; cron: { antesDel13: Record<string, string>; despuesDel13: Record<string, string> } };

test('4. con un bache en la frontera, el closing NO cae a pagar con la clave del negocio ni con el crédito de Martín', () => {
  for (const ws of ['ws3', 'ws10'] as const) {
    assert.equal(X.bache[ws].r.ok, false, `${ws} analizó sin poder comprobar su clave`);
    assert.match(X.bache[ws].r.error ?? '', /^No pude comprobar tu clave de Claude/, `${ws}: ${X.bache[ws].r.error}`);
    assert.deepEqual(X.bache[ws].pedidos, [], `${ws} le pidió a Anthropic sin poder comprobar su clave`);
  }
  assert.equal(X.bache.cron, 'no-se', 'el cron lo deja para la próxima ronda');
  // El control: sin bache, el ws10 (el crédito de Martín) analiza con Haiku aunque eligió Sonnet.
  assert.equal(X.ws10.r.ok, true, String(X.ws10.r.error));
  assert.deepEqual(X.ws10.pedidos.map((p) => p.model), ['claude-haiku-4-5']);
});

test('5. la lista blanca de la plataforma no paga con la clave propia de un negocio', () => {
  assert.match(X.chatClaudeConSuClave.r, /^tiró: closing: la clave de Claude de este negocio es SUYA/);
  assert.deepEqual(X.chatClaudeConSuClave.pedidos, []);
  assert.match(X.chatClaudeToolsConSuClave.r, /^tiró: closing: la clave de Claude de este negocio es SUYA/, 'con herramientas, lo mismo');
  assert.deepEqual(X.chatClaudeToolsConSuClave.pedidos, []);
  assert.ok(R.gasto.some((g) => g.ws === 3 && g.model.startsWith('vetado:') && /es SUYA/.test(g.motivo)), 'el bloqueo queda en el gasto, a US$0');
});

test('6. el cron pregunta lo mismo que el análisis: el ws1 (copia de la plataforma) deja de intentarlo el 13/11', () => {
  assert.deepEqual(X.cron.antesDel13, { ws1: 'plataforma', ws3: 'su-clave', ws13: 'no' });
  assert.deepEqual(X.cron.despuesDel13, { ws1: 'no', ws3: 'su-clave' });
  const cron = readFileSync(join(RAIZ, 'app/api/cron/closing-sync/route.ts'), 'utf8');
  assert.match(cron, /const con = await conQueAnalizaElClosing\(\);/);
  assert.doesNotMatch(cron, /credWs\(/, 'el cron volvió a preguntar sólo si hay una clave');
});
