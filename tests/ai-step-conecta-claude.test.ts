// =============================================================================
// EL AI STEP SIN RED POR LLEVAR DATOS DEL LEAD: «CONECTA TU CLAUDE» (16/10/2026)
// =============================================================================
// Martín por Cerebro (punto D): el crédito de Claude, «por ahora solo en onboarding» (lo corta una compuerta central de
// Onboarding), y si el AI Step con datos del lead se queda sin red, «que avise ("Conecta tu Claude…") y nunca use un
// gratis». La cascada ya saltea la red gratis con datos de clientes (lib/ai-cheap.ts); lo que faltaba es que el aviso al
// negocio dijera el remedio y no «no hay ninguna API key de IA cargada».
//
// ⚠️ PROBADO ROMPIENDO (16/10/2026, scratchpad romper-claude.mjs; base 3 pass / 0 fail, 3 roturas, todas atajadas). El
// resultado MEDIDO de cada rotura, al lado de su test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sinRedPorDatos, CONECTA_TU_CLAUDE } from '../lib/fallo-ia-texto';

const leer = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// rotura 1 (la cascada anota el salto con otro comienzo): 2 pass / 1 fail, cae éste.
test('lo que anota la cascada al saltear la red por datos de clientes se reconoce, y nada más', () => {
  const marcas = [...leer('lib/ai-cheap.ts').matchAll(/push\('(red gratis salteada:[^']*)'\)/g)].map((m) => m[1]);
  assert.equal(marcas.length, 2, 'la respuesta y la nota de voz');
  for (const m of marcas) assert.equal(sinRedPorDatos([m]), true, m);
  assert.equal(sinRedPorDatos(['gemini: 429 quota']), false);
  assert.equal(sinRedPorDatos([]), false);
  assert.match(CONECTA_TU_CLAUDE, /^Conecta tu Claude en Integraciones: /);
});

// rotura 2 (la respuesta del AI Step vuelve a hablar de keys): 2 pass / 1 fail, cae éste.
// rotura 3 (la nota de voz vuelve a hablar de keys): 2 pass / 1 fail, cae éste.
test('la respuesta del AI Step y la nota de voz lo dicen así, en el aviso al negocio', () => {
  assert.match(leer('lib/setting-simulador.ts'), /return \{ ok: false, error: sinRedPorDatos\(erroresRed\) \? CONECTA_TU_CLAUDE : await errorDeCascada\(errores, tema\) \};/);
  assert.match(leer('lib/nutricion.ts'), /if \(sinRedPorDatos\(e\.erroresPlataforma\)\) return CONECTA_TU_CLAUDE;/);
});

test('y nunca un gratis: la respuesta en vivo del AI Step va con `pii: true`', () => {
  assert.match(leer('lib/nutricion.ts'), /tema: 'redactar la respuesta a tu lead', redDePlataforma: true, hastaMs: c\.hastaMs, pii: true,/);
});
