// =============================================================================
// El crédito de Claude para TODO lo del espacio de MaKo, menos el Plan (11/11/2026) — la regla, pura
// =============================================================================
// Martín, textual: «MaKo con WhatsApp ya habíamos dicho que eso se gaste con los tokens de las cuentas de Claude 200 dólares que
// estoy pagando… En general, yo creo que sería bueno que gastemos eso para todo esto en lugar de Gemini, porque es mucho más
// estable.» Lo que NO cambia: cada negocio fuera de WhatsApp sigue con su propia IA, y el Plan queda afuera.
//
// Lo que fija este test (`puedeUsarUnaCuentaDelCredito` y `queHacerSiFallaElCredito`, lib/veto-claude.ts):
//   1. las funciones de los grupos de WhatsApp, en cualquier negocio (como desde el 28/10);
//   2. cualquier otra función que no sea del Plan, SÓLO en la plataforma; con «no es» o «no sé», no;
//   3. el Plan, nunca; vencido o en pausa, no;
//   4. cuándo se prueba la otra cuenta y cuándo se pasa al respaldo.
// Lo de verdad (la puerta, la cascada, las herramientas) lo prueba rompiéndolo tests/credito-plataforma-frontera.test.ts.
//
// Probado rompiéndolo (11/11/2026, una rotura por vez, restaurada): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CREDITO_PARA_LA_PLATAFORMA, FEATURES_DE_LOS_GRUPOS, FEATURES_DEL_PLAN, FEATURE_DE_LOS_GRUPOS, esFallaPasajeraDelCredito, primeroConElCredito, puedeUsarUnaCuentaDelCredito, queHacerSiFallaElCredito,
} from '../lib/veto-claude';
import { CATALOGO_MODELOS } from '../lib/model-catalogo';

const HOY = new Date('2026-11-11T15:00:00Z');
const puede = (feature: string, esLaPlataforma?: boolean, extra: { pausa?: boolean; hoy?: Date } = {}) =>
  puedeUsarUnaCuentaDelCredito({ feature, esLaPlataforma, hoy: HOY, ...extra });
const para = (v: ReturnType<typeof puedeUsarUnaCuentaDelCredito>) => (v.ok ? v.para : null);

test('1. las funciones de los grupos de WhatsApp usan el crédito en cualquier negocio, como desde el 28/10', () => {
  assert.deepEqual([...FEATURES_DE_LOS_GRUPOS], [FEATURE_DE_LOS_GRUPOS, 'MaKo en WhatsApp · adjunto']);
  for (const f of FEATURES_DE_LOS_GRUPOS) {
    for (const es of [true, false, undefined]) assert.equal(para(puede(f, es)), 'grupos', `«${f}» con esLaPlataforma=${es}`);
  }
  assert.equal(para(puede('MaKo · nota de voz', false)), null, 'la nota de voz va con Groq, no con el crédito');
});

test('2. cualquier otra función que no sea del Plan, SÓLO en la plataforma; «no es» o «no sé» es no', () => {
  // Lo interno de MaKo del 26/10 (el editor de landings, la réplica, el analizador) entra por acá: antes era la puerta 3, y último.
  for (const f of ['mako-doer', 'mako-chat', 'spy', 'video-editor-ia', 'carrusel-replica', 'landing-editor', 'landing-editor-ia', 'landing-analyst']) {
    assert.equal(para(puede(f, true)), 'plataforma', `«${f}» en el espacio de MaKo`);
    assert.equal(puede(f, false).ok, false, `«${f}» usó el crédito en un negocio: cada negocio paga su IA`);
    assert.equal(puede(f, undefined).ok, false, `«${f}»: sin saber si es la plataforma, se tomó que sí`);
  }
  assert.equal(puede('', true).ok, false, 'sin feature no se sabe qué se compra');
});

test('3. el Plan nunca; las funciones con `fallback: []` tampoco; vencido o en pausa, no', () => {
  for (const f of FEATURES_DEL_PLAN) assert.equal(puede(f, true).ok, false, `«${f}» es del Plan y usó el crédito`);
  // Un juicio que nadie revisa corre con UN proveedor: el crédito primero mezclaría dos modelos (lib/model-catalogo.ts).
  const sinDegradar = CATALOGO_MODELOS.filter((f) => f.fallback?.length === 0).map((f) => f.feature);
  assert.ok(sinDegradar.includes('cs-sesion') && sinDegradar.includes('cs-autoasignar'), `cambió la lista de las que no se degradan: ${sinDegradar.join(', ')}`);
  for (const f of sinDegradar) assert.equal(puede(f, true).ok, false, `«${f}» tiene \`fallback: []\` y probó el crédito antes que su proveedor`);
  assert.equal(puede('mako-doer', true, { pausa: true }).ok, false, 'la pausa de pánico no apagó el crédito de la plataforma');
  assert.equal(puede(FEATURE_DE_LOS_GRUPOS, false, { pausa: true }).ok, false, 'la pausa de pánico no apagó el crédito de los grupos');
  const despues = new Date(`${CREDITO_PARA_LA_PLATAFORMA.hasta}T12:00:00Z`);
  despues.setUTCDate(despues.getUTCDate() + 1);
  assert.equal(puede('mako-doer', true, { hoy: despues }).ok, false, 'el crédito de la plataforma no vence');
  assert.equal(puede('mako-doer', true, { hoy: new Date(`${CREDITO_PARA_LA_PLATAFORMA.hasta}T12:00:00Z`) }).ok, true, 'el último día todavía vale');
  assert.match(CREDITO_PARA_LA_PLATAFORMA.pidio, /^Martín, 11\/11\/2026: «/, 'un permiso sin dueño no lo revisa nadie');
});

test('4. una cuenta que falla: la otra cuenta si es de ESA cuenta; el respaldo si es Anthropic entero o el pedido', () => {
  assert.equal(queHacerSiFallaElCredito(400, 'Your credit balance is too low to access the Anthropic API.'), 'otra_cuenta');
  assert.equal(queHacerSiFallaElCredito(401, 'invalid x-api-key'), 'otra_cuenta');
  assert.equal(queHacerSiFallaElCredito(429, 'Number of request tokens has exceeded your per-minute rate limit'), 'otra_cuenta');
  assert.equal(queHacerSiFallaElCredito(null, 'falló la IA (el negocio no tiene su clave de Claude)'), 'otra_cuenta');
  assert.equal(queHacerSiFallaElCredito(529, 'Overloaded'), 'al_respaldo', 'un Anthropic saturado lo está para todas las cuentas');
  assert.equal(queHacerSiFallaElCredito(500, 'Internal server error'), 'al_respaldo');
  assert.equal(queHacerSiFallaElCredito(null, 'The operation was aborted due to timeout'), 'al_respaldo', 'un plazo vencido no se repite con otra cuenta');
  assert.equal(queHacerSiFallaElCredito(400, 'prompt is too long: 250000 tokens > 200000 maximum'), 'al_respaldo', 'la otra cuenta contestaría lo mismo');
  // SIN RESPALDO (un negocio sin su IA en su grupo), lo pasajero prueba UNA cuenta más; la segunda vez, no; un 400 del pedido, nunca.
  const sin = { sinRespaldo: true };
  assert.equal(queHacerSiFallaElCredito(529, 'Overloaded', sin), 'otra_cuenta', 'sin respaldo, un 529 dejó el turno sin contestar');
  assert.equal(queHacerSiFallaElCredito(500, 'Internal server error', sin), 'otra_cuenta');
  assert.equal(queHacerSiFallaElCredito(undefined, 'The operation was aborted due to timeout', sin), 'otra_cuenta');
  assert.equal(queHacerSiFallaElCredito(529, 'Overloaded', { sinRespaldo: true, pasajerasAntes: 1 }), 'al_respaldo', 'lo pasajero se repitió en todas las cuentas');
  assert.equal(queHacerSiFallaElCredito(400, 'prompt is too long: 250000 tokens > 200000 maximum', sin), 'al_respaldo', 'un 400 del pedido se repitió con otra cuenta');
  assert.equal(queHacerSiFallaElCredito(null, 'Claude contestó vacío', sin), 'al_respaldo');
  assert.equal(esFallaPasajeraDelCredito(529, 'Overloaded'), true);
  assert.equal(esFallaPasajeraDelCredito(null, 'fetch failed'), true);
  assert.equal(esFallaPasajeraDelCredito(400, 'prompt is too long'), false);
});

test('5. lo que dice la lista de modelos es lo que corre: el crédito PRIMERO, con la misma regla, sin tocar el `def`', () => {
  assert.equal(primeroConElCredito('mako-doer'), 'primero: crédito de Claude (Haiku), sólo en el espacio de MaKo');
  assert.equal(primeroConElCredito('mako-doer-in'), 'primero: crédito de Claude (Haiku), en los grupos de WhatsApp de todos los negocios sin su Claude');
  assert.equal(primeroConElCredito('plan-fathom'), null, 'la lista dice que el Plan va con el crédito');
  assert.equal(primeroConElCredito('cs-sesion'), null, 'la lista dice que una función con `fallback: []` va con el crédito');
  // El `def` sigue siendo el respaldo, no Anthropic (un `def` de Anthropic va a la puerta 1, que el veto frena).
  for (const f of ['mako-doer-in', 'mako-doer', 'mako-chat', 'MaKo en WhatsApp · adjunto']) {
    const c = CATALOGO_MODELOS.find((x) => x.feature === f);
    assert.ok(c, `«${f}» no está en el catálogo`);
    assert.equal(c!.def.provider, 'gemini', `«${f}»: el \`def\` pasó a otro proveedor`);
    assert.match(c!.nota ?? '', /crédito de Claude/, `la nota de «${f}» no dice que va primero con el crédito`);
  }
  const reg = readFileSync(new URL('../lib/model-registry.ts', import.meta.url), 'utf8');
  assert.match(reg, /primero: primeroConElCredito\(f\.feature\)/, 'la API de /modelos-ia no dice qué corre primero');
});

// ── Probado rompiéndolo (11/11/2026; cada rotura sola, restaurada después) ──────────────────────────────────────────────
//   R1 `esLaPlataforma !== true` → `=== false` (sin saber, deja pasar)            → falla el 2
//   R2 sin mirar `FEATURES_DEL_PLAN`                                               → falla el 3
//   R3 sin la fecha `hasta`                                                        → falla el 3
//   R4 un 529 «Overloaded» prueba la otra cuenta                                   → falla el 4
//   R5 sin mirar `fallback: []` del catálogo                                       → falla el 3
//   R6 la API de /modelos-ia sin el `primero`                                      → falla el 5
//   R7 sin respaldo, lo pasajero sigue yendo «al respaldo» (el 529 corta el turno)  → falla el 4
//   R8 sin respaldo, lo pasajero prueba TODAS las cuentas (sin `pasajerasAntes`)   → falla el 4
