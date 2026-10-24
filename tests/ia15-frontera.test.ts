// =============================================================================
// IA15, revisión adversarial (22/10/2026): el Plan con la clave del negocio, en los bordes
// =============================================================================
// Martín, 22/10/2026: «Sí, si es su clave». La revisión encontró que:
//   · ALTA: con una fila de la PLATAFORMA ilegible (el secreto rotó, la fila se dañó), la frontera no reconocía el crédito
//     de Martín ni la copia de la clave de MaKo, y el Plan pagaba con ellas, con la marca «del negocio» (fuera del gasto
//     de MaKo). Lo cierran `credWsEstricta(…, { ilegibleTira })` y que la puerta 2 pida la decisión del Plan, cierta;
//   · MEDIA: con su OpenAI, el Plan pedía 32.000 tokens a gpt-4o-mini (acepta 16.384) y fallaba siempre;
//   · BAJA: lo que no es del Plan, llamado desde adentro de una función del Plan, heredaba la decisión del Plan;
//   · y que ningún test miraba `planConSuClave` caso por caso (la PC, una clave ilegible, una copia, la base caída).
// Corre la capa real en tests/_ia15-frontera-hijo.ts.
//
// Probado rompiéndolo (22/10/2026, una rotura por vez, restaurada): ver la cosecha en docs/hallazgos-ia.md.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { conTechoDeSalida, TECHO_SALIDA_OPENAI } from '../lib/ai-cheap-techo';

type Pedido = { host: string; clave: string };
let cache: Record<string, unknown> | null = null;
function correr(): Record<string, any> {
  if (cache) return cache;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_ia15-frontera-hijo.ts', import.meta.url))], { encoding: 'utf8', timeout: 180_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@IA15@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  cache = JSON.parse(linea.slice('@@IA15@@'.length));
  assert.equal(cache!.error, undefined, String(cache!.error));
  return cache!;
}
const GRATIS = /generativelanguage\.googleapis\.com|api\.groq\.com/;

test('ALTA: con las filas de la plataforma ilegibles, nadie paga con el crédito de Martín ni con la clave de MaKo', () => {
  const r = correr();
  const { CREDITO, DE_MAKO } = r.claves as { CREDITO: string; DE_MAKO: string };
  for (const [caso, pedidos] of Object.entries(r.ilegible as Record<string, Pedido[]>)) {
    const conAnthropic = pedidos.filter((p) => p.host === 'api.anthropic.com');
    assert.ok(!conAnthropic.some((p) => CREDITO.startsWith(p.clave.slice(0, 22))), `${caso}: pagó con el crédito de Martín`);
    assert.ok(!conAnthropic.some((p) => DE_MAKO.startsWith(p.clave.slice(0, 22))), `${caso}: pagó con la clave de MaKo`);
    // Y falla CERRADA también para la privacidad: «no pude saber» no manda a Gemini.
    assert.deepEqual(pedidos.filter((p) => GRATIS.test(p.host)), [], `${caso}: salió a una IA gratis`);
  }
});

test('planConSuClave, caso por caso: su OpenAI y su Claude sí; el crédito, la PC sola y una copia no; ilegible y sin base, sí', () => {
  const r = correr();
  assert.deepEqual(r.plan, {
    ws3: { suClave: true }, // su OpenAI
    ws10: { suClave: false }, // su «Claude» es el crédito de Martín
    ws14: { suClave: false }, // sólo su PC: el Plan corre de fondo, y la suscripción no se puede usar de fondo (D6a)
    ws16: { suClave: false }, // una copia de la clave de MaKo
    ws17: { suClave: true }, // su clave guardada e ilegible: la fila existe, es suya
    ws18: { suClave: true }, // su Claude
  });
  assert.deepEqual(r.planConLaBaseCaida, { suClave: true, incierto: true }, 'sin poder leer: falla cerrada, y dicha como incierta');
});

test('«no pude saber» del Plan no paga y no se recuerda: con la base de vuelta, el Plan usa su clave', () => {
  const r = correr();
  assert.deepEqual((r.ws18PlanConBache as Pedido[]).filter((p) => p.host === 'api.anthropic.com'), [], 'con la base caída, el Plan no pagó con ninguna clave');
  assert.ok((r.ws18PlanDespues as Pedido[]).some((p) => p.host === 'api.anthropic.com' && /ws18-propia/.test(p.clave)), 'con la base de vuelta, el Plan usa su Claude');
});

test('el «no pude saber» de una copia (ws16) no se recuerda: con la base de vuelta, su Plan vuelve a lo de siempre', () => {
  const r = correr();
  assert.ok((r.ws16PlanDespuesDelBache as Pedido[]).some((p) => /generativelanguage/.test(p.host)), `quedó recordado el «sí» del bache: ${JSON.stringify(r.ws16PlanDespuesDelBache)}`);
});

test('la puerta 2 pide la decisión del Plan, CIERTA: aunque su frontera no vea el crédito, y aunque la suya lea bien', () => {
  const r = correr();
  assert.deepEqual((r.ws19PlanCreditoConOtroNombre as Pedido[]).filter((p) => p.host === 'api.anthropic.com'), [], 'el Plan del ws19 pagó con un crédito que la frontera no vio');
  assert.deepEqual((r.ws20PlanIncierto as Pedido[]).filter((p) => p.host === 'api.anthropic.com'), [], 'el Plan pagó con la decisión incierta');
});

test('lo que NO es del Plan, desde adentro de una función del Plan, usa SU decisión (no la del Plan)', () => {
  const r = correr();
  const pedidos = r.noPlanAdentroDelPlan as Pedido[];
  assert.deepEqual(pedidos.filter((p) => GRATIS.test(p.host)), [], 'heredó la decisión del Plan y salió a una IA gratis');
  assert.ok(pedidos.some((p) => p.host === 'api.anthropic.com'), 'no usó la IA del negocio');
});

test('MEDIA: a OpenAI nunca se le pide más salida de la que acepta el modelo; a los demás, lo pedido', () => {
  assert.equal(conTechoDeSalida({ nombre: 'openai' }, 'gpt-4o-mini', 32_000), 16_384);
  assert.equal(conTechoDeSalida({ nombre: 'openai' }, 'gpt-4.1-mini', 32_000), 32_000);
  assert.equal(conTechoDeSalida({ nombre: 'openai' }, 'un-modelo-nuevo', 32_000), 16_384, 'uno que no está en la tabla, con el más chico');
  assert.equal(conTechoDeSalida({ nombre: 'gemini' }, 'gemini-flash-latest', 32_000), 32_000);
  assert.ok(TECHO_SALIDA_OPENAI['gpt-4o-mini'] === 16_384);
  // Los tres pedidos de la capa barata (texto, herramientas y el cierre sin herramientas) pasan por el techo: `paramsDeSalida`
  // lo aplica, con el nombre de campo que acepta cada modelo (tests/openai-razonador.test.ts).
  const ai = readFileSync(new URL('../lib/ai-cheap.ts', import.meta.url), 'utf8');
  assert.equal((ai.match(/\.\.\.paramsDeSalida\(p, model, /g) ?? []).length, 3);
});
