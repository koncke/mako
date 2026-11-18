// =============================================================================
// El crédito de Claude de la plataforma va con el modelo que pide el ROUTER, no siempre con Haiku (18/11/2026)
// =============================================================================
// Martín, por el Cerebro: «hoy MaKo usa siempre Haiku con el crédito de Claude de la plataforma, aunque el router pida Sonnet u
// Opus; ¿lo cambiamos? Contesta mejor cuando hace falta pensar, pero el crédito se gasta más rápido» → «Si, cambia el modelo sin
// problema». Reemplaza la regla del 22/10 (IA5, «el crédito va con el barato»). El Plan queda como estaba: nunca con el crédito, y
// con la clave del negocio, siempre Haiku. La clave que paga el negocio va con lo que eligió él. Lo de verdad, por la puerta real:
// tests/credito-grupos.test.ts (el 10). Probado rompiéndolo: al pie.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluarClaveDelNegocio, MODELOS_DEL_CREDITO } from '../lib/veto-claude';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const PLATAFORMA = ['sk-ant-de-mako'];
const CREDITO = 'sk-ant-credito-cuenta2';
const NEGOCIO = 'sk-ant-del-negocio';
const conCredito = (modeloConCredito?: string, feature = 'mako-doer-in') =>
  evaluarClaveDelNegocio({ feature, clave: CREDITO, clavesPlataforma: PLATAFORMA, creditosPlataforma: [CREDITO], modeloConCredito });

test('1. con el crédito, el modelo del router: Haiku, Sonnet u Opus; sin él, o con otro, Haiku', () => {
  const modelo = (m?: string) => { const v = conCredito(m); assert.ok(v.ok, m); return v.permiso.model; };
  // Rota: `if (esCredito || delPlan) model = modelos[0]` (la regla del 22/10) → los tres dan Haiku.
  assert.equal(modelo('claude-sonnet-5'), 'claude-sonnet-5');
  assert.equal(modelo('claude-opus-4-8'), 'claude-opus-4-8');
  assert.equal(modelo('claude-haiku-4-5'), 'claude-haiku-4-5');
  assert.equal(modelo(undefined), 'claude-haiku-4-5', 'sin modelo del router (la charla, el clasificador, el bot): el barato');
  // Rota: aceptar cualquier modelo → un id que el router no usa pagaría con el crédito.
  assert.equal(modelo('claude-fable-5'), 'claude-haiku-4-5');
  const v = conCredito('claude-opus-4-8');
  assert.ok(v.ok && v.permiso.esCredito, 'el gasto deja de anotarse como del crédito');
});

test('2. sin poder leer el crédito, Haiku; la clave que paga el negocio, lo que eligió él; el Plan, como estaba', () => {
  // Rota: el modelo del router también con `creditosPlataforma: null` → «no pude leer» habilitaría gastar más.
  const sinLeer = evaluarClaveDelNegocio({ feature: 'mako-doer-in', clave: NEGOCIO, clavesPlataforma: PLATAFORMA, creditosPlataforma: null, modeloConCredito: 'claude-opus-4-8' });
  assert.ok(sinLeer.ok && sinLeer.permiso.model === 'claude-haiku-4-5');
  // Rota: el modelo del router con la clave del negocio → paga Opus sin haberlo elegido.
  const suya = evaluarClaveDelNegocio({ feature: 'mako-doer-in', clave: NEGOCIO, clavesPlataforma: PLATAFORMA, creditosPlataforma: [CREDITO], model: 'claude-sonnet-5', modeloConCredito: 'claude-opus-4-8' });
  assert.ok(suya.ok && suya.permiso.model === 'claude-sonnet-5' && !suya.permiso.esCredito);
  const suyaHaiku = evaluarClaveDelNegocio({ feature: 'mako-doer-in', clave: NEGOCIO, clavesPlataforma: PLATAFORMA, creditosPlataforma: [CREDITO], modeloConCredito: 'claude-opus-4-8' });
  assert.ok(suyaHaiku.ok && suyaHaiku.permiso.model === 'claude-haiku-4-5');
  // El Plan: nunca con el crédito, y con su clave siempre Haiku, pida lo que pida el router.
  assert.equal(conCredito('claude-opus-4-8', 'plan-fathom').ok, false);
  const plan = evaluarClaveDelNegocio({ feature: 'plan-fathom', clave: NEGOCIO, clavesPlataforma: PLATAFORMA, creditosPlataforma: [CREDITO], model: 'claude-sonnet-5', modeloConCredito: 'claude-opus-4-8' });
  assert.ok(plan.ok && plan.permiso.model === 'claude-haiku-4-5');
});

test('3. los modelos del crédito son los del router, con los mismos ids, y el turno del grupo le pasa el suyo', () => {
  const router = leer('lib/mako-router.ts');
  for (const n of ['SONNET', 'OPUS']) {
    const id = new RegExp(`const ${n} = '([^']+)'`).exec(router)?.[1];
    assert.ok(id, `no encontré ${n} en lib/mako-router.ts`);
    // Rota: cambiar el modelo del router sin sumarlo acá → el crédito vuelve a Haiku en silencio.
    assert.ok(MODELOS_DEL_CREDITO.includes(id), `${id} (el ${n} del router) no está en MODELOS_DEL_CREDITO`);
  }
  assert.equal(MODELOS_DEL_CREDITO[0], 'claude-haiku-4-5', 'el default del crédito es el barato');
  // Rota: el turno del grupo sin pasarle el modelo del router → la puerta 2 nunca lo ve.
  const doer = leer('lib/mako-doer-in.ts');
  const i = doer.indexOf("const claudeDelGrupo = async (cuenta?: string): Promise<'listo' | 'sin_su_claude' | 'otra_cuenta'> => {");
  assert.ok(i > 0, 'no encontré claudeDelGrupo');
  assert.match(doer.slice(i, i + 2500), /\.\.\.\(ruta\.model \? \{ modeloDelCredito: ruta\.model, effort: ruta\.effort \} : \{\}\),/);
});

// ── Probado rompiéndolo (18/11/2026; cada rotura sola, restaurada después) ──────────────────────────────────────────────
//   R1 la regla del 22/10 (`if (esCredito || delPlan) model = modelos[0]`)       → falla el 1 (y el 10 de credito-grupos)
//   R2 aceptar cualquier `modeloConCredito`                                        → falla el 1
//   R3 el modelo del router también con `creditosPlataforma: null`                 → falla el 2
//   R4 el turno del grupo sin `modeloDelCredito`                                   → falla el 3
//   R5 sin `output_config` en el pedido del crédito                                → falla el 10 de credito-grupos
