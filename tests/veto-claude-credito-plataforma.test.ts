// =============================================================================
// El crédito de API de los planes Max de la plataforma: la tercera puerta del veto
// =============================================================================
// Martín, 13/8/2026, el veto: «que ya no se pueda gastar con Claude directamente, que se prohíba».
// Martín, 16/10/2026, sobre el crédito de API de dos planes Max suyos (US$200 por mes cada uno, que
// se renuevan y no se acumulan): «Vinculalas a MaKo», para «habilitar los TOKENS a usuarios nuevos,
// sobre todo para el onboarding, para que no tengan la fricción de traer su API».
//
// Las dos frases no se contradicen porque ese crédito ya está pago y al acabarse corta en vez de
// cobrar. Pero la puerta que lo deja pasar es exactamente por donde se colaría el gasto que el
// veto cerró, así que este test prueba la frontera por los dos lados:
//   · la regla, ejecutándola (evaluarCreditoDeLaPlataforma, pura): pasan SÓLO las dos claves con
//     nombre, y ninguna otra clave de la plataforma;
//   · el cableado: de dónde salen las claves, cuál llega al fetch, dónde queda el gasto.
//
// Correr: npx tsx --test tests/veto-claude-credito-plataforma.test.ts
//
// PROBADO ROMPIÉNDOLO el 16/10/2026, cada rotura restaurada DE MEMORIA. Base: 9 pasan, 0 fallan.
//   - el veto acepta cualquier clave como crédito                         → 8/1
//   - una tercera clave en la lista se cuela                               → 8/1
//   - el Plan usa el crédito                                               → 8/1
//   - el crédito no vence                                                  → 8/1
//   - el crédito lee ANTHROPIC_API_KEY                                     → 8/1
//   - el fetch del crédito usa otra clave que la verificada                → 8/1
//   - la fila de uso del crédito cae al ws por default (el ws1)            → daba 9/0: el test buscaba UNA
//     fila con el ws del cliente y la del «sin crédito» tapaba a la otra. Ahora exige todas → 8/1
//   - los errores del crédito van a la lista del cliente                   → 8/1
//   - el gasto de MaKo vuelve a sumar el crédito                           → 8/1
// Y el PARA QUÉ (16/10/2026, «Por ahora solo en onboarding»; base 11/0):
//   - el veto deja de mirar la lista de lo habilitado                      → 10/1
//   - el veto ignora «sólo durante el onboarding»                          → 10/1
//   - el análisis del lead entra a la lista sin que Martín lo habilite      → 10/1
//   - conCreditoDeLaPlataforma no le pasa al veto si el onboarding sigue    → 10/1
// Y el chat de Offer, que ES el onboarding desde el 16/10/2026 (base 11/0):
//   - sin la fila de 'offer' en la lista                                   → 10/1
//   - 'offer' con soloDuranteElOnboarding: false                          → 10/1
// Y 'productos', que salió con el wizard (base 11/0; el ejemplo de lo habilitado pasó a 'El Archivero'):
//   - 'productos' vuelve a la lista                                       → 10/1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  evaluarCreditoDeLaPlataforma, CLAVES_CREDITO_PLATAFORMA, CREDITO_DE_LA_PLATAFORMA, CREDITO_HABILITADO_PARA, FEATURES_DEL_PLAN,
  MOTIVO_CREDITO_PLATAFORMA, esDelCreditoDeLaPlataforma, esDeLaClaveDelNegocio, evaluarPermiso,
} from '../lib/veto-claude';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
// Líneas `//` primero y bloques después, y nada más (docs/hallazgos-ia.md, 16/10/2026).
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const C1 = 'sk-ant-api03-credito-max-cuenta-1';
const C2 = 'sk-ant-api03-credito-max-cuenta-2';
const PLATAFORMA = 'sk-ant-api03-la-de-siempre-de-la-plataforma';
const NEGOCIO = 'sk-ant-api03-de-un-negocio';
const HOY = new Date('2026-10-16T12:00:00Z');

test('las dos claves del crédito pasan, cada una con su cuenta y el modelo barato', () => {
  for (const [clave, cuenta] of [[C1, 1], [C2, 2]] as const) {
    const v = evaluarCreditoDeLaPlataforma({ feature: 'El Archivero', clave, creditos: [C1, C2], hoy: HOY, onboardingEnCurso: true });
    assert.equal(v.ok, true, `la cuenta ${cuenta} no pasó`);
    if (!v.ok) continue;
    assert.equal(v.permiso.cuenta, cuenta);
    assert.equal(v.permiso.clave, clave, 'el permiso lleva la clave verificada');
    assert.equal(v.permiso.model, CREDITO_DE_LA_PLATAFORMA.modelos[0]);
  }
});

test('LA FRONTERA: ninguna otra clave pasa por la puerta del crédito', () => {
  // La de siempre de la plataforma (ANTHROPIC_API_KEY): es la que el veto cerró el 13/8.
  assert.equal(evaluarCreditoDeLaPlataforma({ feature: 'El Archivero', clave: PLATAFORMA, creditos: [C1, C2], hoy: HOY, onboardingEnCurso: true }).ok, false,
    'la clave de siempre de la plataforma pasó como crédito: MaKo pagaría sin lista blanca');
  // La de un negocio tampoco: ésa tiene su propia puerta.
  assert.equal(evaluarCreditoDeLaPlataforma({ feature: 'El Archivero', clave: NEGOCIO, creditos: [C1, C2], hoy: HOY, onboardingEnCurso: true }).ok, false);
  // Sin claves del crédito cargadas, nada pasa, ni una clave vacía «igual» a un casillero vacío.
  assert.equal(evaluarCreditoDeLaPlataforma({ feature: 'El Archivero', clave: C1, creditos: [null, undefined], hoy: HOY, onboardingEnCurso: true }).ok, false);
  assert.equal(evaluarCreditoDeLaPlataforma({ feature: 'El Archivero', clave: '', creditos: ['', null], hoy: HOY, onboardingEnCurso: true }).ok, false);
  // Y una tercera clave no se cuela por estar en la lista: sólo hay dos cuentas.
  assert.equal(evaluarCreditoDeLaPlataforma({ feature: 'El Archivero', clave: PLATAFORMA, creditos: [C1, C2, PLATAFORMA], hoy: HOY, onboardingEnCurso: true }).ok, false);
  // Con espacios sigue siendo la misma clave del crédito.
  assert.equal(evaluarCreditoDeLaPlataforma({ feature: 'El Archivero', clave: `  ${C1}\n`, creditos: [C1, C2], hoy: HOY, onboardingEnCurso: true }).ok, true);
});

test('PARA QUÉ: sólo lo que Martín habilitó, y hoy es el onboarding en curso («Por ahora solo en onboarding»)', () => {
  // Lo habilitado, y nada más: las funciones del wizard del primer ingreso.
  assert.deepEqual(CREDITO_HABILITADO_PARA.map((h) => h.feature).sort(), ['El Archivero', 'onboarding-extract', 'offer'].sort(),
    'la lista de lo que usa el crédito cambió: habilitar algo más lo decide Martín');
  // El chat de Offer ES el onboarding desde el 16/10/2026 («el onboarding será ese chat de offer»): lo usa
  // mientras el onboarding está en curso, y la tab Offer de después, no.
  assert.equal(evaluarCreditoDeLaPlataforma({ feature: 'offer', clave: C1, creditos: [C1, C2], hoy: HOY, onboardingEnCurso: true }).ok, true,
    'el chat de Offer del primer ingreso no llega al crédito');
  assert.equal(evaluarCreditoDeLaPlataforma({ feature: 'offer', clave: C1, creditos: [C1, C2], hoy: HOY, onboardingEnCurso: false }).ok, false,
    'la tab Offer usa el crédito con el onboarding ya cerrado');
  // 'productos' era el paso del wizard, y salió con él (16/10/2026): nada lo llama durante el onboarding.
  assert.equal(evaluarCreditoDeLaPlataforma({ feature: 'productos', clave: C1, creditos: [C1, C2], hoy: HOY, onboardingEnCurso: true }).ok, false,
    'el paso Productos del wizard, que ya no existe, sigue usando el crédito');
  for (const h of CREDITO_HABILITADO_PARA) {
    assert.equal(h.soloDuranteElOnboarding, true, `${h.feature} usaría el crédito fuera del onboarding`);
    assert.ok(!FEATURES_DEL_PLAN.includes(h.feature), `${h.feature} es del Plan`);
  }
  // Lo que ya llamaba al crédito el 16/10 y Martín NO habilitó: el AI Step, las Conclusiones del Dashboard y
  // el análisis del lead. El crédito les dice que no y su cascada sigue como si no existiera.
  for (const f of ['lead_insights', 'dashboard-conclusiones', 'mako-chat', 'setting-ai-step']) {
    assert.equal(evaluarCreditoDeLaPlataforma({ feature: f, clave: C1, creditos: [C1, C2], hoy: HOY, onboardingEnCurso: true }).ok, false,
      `«${f}» usa el crédito sin que Martín lo habilitara`);
  }
  // Lo habilitado, con el onboarding terminado (o sin saberlo): tampoco.
  assert.equal(evaluarCreditoDeLaPlataforma({ feature: 'El Archivero', clave: C1, creditos: [C1, C2], hoy: HOY, onboardingEnCurso: false }).ok, false);
  assert.equal(evaluarCreditoDeLaPlataforma({ feature: 'El Archivero', clave: C1, creditos: [C1, C2], hoy: HOY }).ok, false,
    'sin saber si el onboarding está en curso, se toma que no');
  assert.equal(evaluarCreditoDeLaPlataforma({ feature: 'El Archivero', clave: C1, creditos: [C1, C2], hoy: HOY, onboardingEnCurso: true }).ok, true);
});

test('el Plan nunca paga IA, tampoco con el crédito', () => {
  for (const f of FEATURES_DEL_PLAN) {
    assert.equal(evaluarCreditoDeLaPlataforma({ feature: f, clave: C1, creditos: [C1, C2], hoy: HOY, onboardingEnCurso: true }).ok, false, `${f} usaría el crédito`);
  }
});

test('el pánico, la falta de feature, otro modelo y el vencimiento cierran la puerta', () => {
  assert.equal(evaluarCreditoDeLaPlataforma({ feature: 'El Archivero', clave: C1, creditos: [C1, C2], pausa: true, hoy: HOY, onboardingEnCurso: true }).ok, false);
  assert.equal(evaluarCreditoDeLaPlataforma({ feature: '', clave: C1, creditos: [C1, C2], hoy: HOY, onboardingEnCurso: true }).ok, false);
  assert.equal(evaluarCreditoDeLaPlataforma({ feature: 'El Archivero', model: 'claude-opus-4-8', clave: C1, creditos: [C1, C2], hoy: HOY, onboardingEnCurso: true }).ok, false);
  const despues = new Date(`${CREDITO_DE_LA_PLATAFORMA.hasta}T12:00:00Z`);
  despues.setUTCDate(despues.getUTCDate() + 1);
  assert.equal(evaluarCreditoDeLaPlataforma({ feature: 'El Archivero', clave: C1, creditos: [C1, C2], hoy: despues, onboardingEnCurso: true }).ok, false);
});

test('la marca del gasto del crédito se reconoce, no se confunde con la del negocio, y la puerta 1 sigue igual', () => {
  assert.equal(esDelCreditoDeLaPlataforma(`${MOTIVO_CREDITO_PLATAFORMA} (cuenta 1) · Armar el catálogo`), true);
  assert.equal(esDeLaClaveDelNegocio(`${MOTIVO_CREDITO_PLATAFORMA} (cuenta 1)`), false);
  assert.equal(esDelCreditoDeLaPlataforma('Analizar la llamada de Ana'), false);
  assert.equal(evaluarPermiso({ feature: 'El Archivero' }).ok, false, 'una feature cualquiera sigue sin poder pagarle a Claude por la lista blanca');
});

// ── El cableado ───────────────────────────────────────────────────────────────

function cuerpoDelCredito(): string {
  const src = leer('lib/anthropic.ts');
  const ini = src.indexOf('export async function conCreditoDeLaPlataforma(');
  assert.ok(ini > 0, 'no existe conCreditoDeLaPlataforma en lib/anthropic.ts');
  const b = src.slice(ini, src.indexOf('\nexport async function ', ini + 10));
  // Contra un recorte desbocado: medido el 16/10/2026, unos 3.000 caracteres.
  assert.ok(b.length > 1500 && b.length < 8000, `el recorte mide ${b.length}: está mirando otra cosa`);
  return sinComentarios(b);
}

test('el PARA QUÉ se pregunta ANTES de leer las claves, y «en curso» es lo mismo que pregunta el wizard', () => {
  const b = cuerpoDelCredito();
  const lista = b.indexOf('CREDITO_HABILITADO_PARA.find(');
  const claves = b.indexOf('for (const nombre of CLAVES_CREDITO_PLATAFORMA)');
  assert.ok(lista > 0 && claves > lista, 'la lista de lo habilitado tiene que mirarse antes de leer las claves');
  assert.match(b, /onboardingPendiente\(\)/, '«en curso» tiene que ser lo mismo que decide si el negocio va al wizard');
  assert.match(b, /evaluarCreditoDeLaPlataforma\(\{[^}]*onboardingEnCurso \}\)/, 'el veto no recibe si el onboarding está en curso');
});

test('las claves salen SÓLO de los dos nombres del crédito, nunca de ANTHROPIC_API_KEY', () => {
  const b = cuerpoDelCredito();
  assert.deepEqual([...CLAVES_CREDITO_PLATAFORMA], ['ANTHROPIC_CREDITO_CUENTA1', 'ANTHROPIC_CREDITO_CUENTA2']);
  assert.match(b, /for \(const nombre of CLAVES_CREDITO_PLATAFORMA\)/);
  assert.doesNotMatch(b, /ANTHROPIC_API_KEY/, 'el crédito lee la clave de siempre de la plataforma');
  assert.doesNotMatch(b, /credWs\(/, 'credWs cae al env del dueño: las claves del crédito se leen estrictas y por nombre');
  assert.match(b, /evaluarCreditoDeLaPlataforma\(/);
});

test('el fetch usa la clave que verificó el veto, y la fila de uso va al cliente con la marca primero', () => {
  const b = cuerpoDelCredito();
  assert.match(b, /'x-api-key': permiso\.clave/);
  assert.match(b, /fetch\(permiso\.endpoint/);
  assert.match(b, /recordUsage\([^;]*\[`\$\{MOTIVO_CREDITO_PLATAFORMA\}/, 'la marca del crédito tiene que ir al principio del motivo');
  // TODAS las filas al workspace del cliente: buscando una sola, la del «sin crédito» tapaba a la del
  // uso normal sin el ws (medido rompiéndolo el 16/10/2026: daba verde).
  const filas = (b.match(/recordUsage\(/g) || []).length;
  assert.ok(filas >= 2, 'faltan las filas de uso del crédito');
  assert.equal((b.match(/permiso\.cuenta, p\.wsCliente\)/g) || []).length, filas,
    'una fila de uso del crédito cae al ws por default (el ws1, un cliente): va al workspace del que lo usó');
  // Sin crédito, la cuenta se saltea y queda una línea.
  assert.match(b, /credit balance is too low/);
  assert.match(b, /creditoAgotado\.set\(permiso\.cuenta/);
});

test('la cascada prueba el crédito en la red de plataforma, ANTES de las keys gratis, y sus errores son de la plataforma', () => {
  const src = sinComentarios(leer('lib/ai-cheap.ts'));
  const red = src.indexOf('if (opts.redDePlataforma) {');
  const credito = src.indexOf('conCreditoDeLaPlataforma(', red);
  const gratis = src.indexOf('provsGratisDePlataforma()', red);
  assert.ok(red > 0 && credito > red && gratis > credito, 'el crédito tiene que ir dentro de la red y antes de las keys gratis');
  const tramo = src.slice(credito, gratis);
  assert.match(tramo, /erroresPlataformaOut\?\.push\(c\.error\)/);
  assert.doesNotMatch(tramo, /erroresOut\?\.push/, 'los errores del crédito caen en la lista con la que se le habla al cliente');
});

test('el gasto del crédito no se suma como gasto de MaKo ni le cuesta al cliente', () => {
  const costos = sinComentarios(leer('lib/costos-ia.ts'));
  const ini = costos.indexOf('function costoDe(');
  assert.match(costos.slice(ini, costos.indexOf('\n}', ini)), /if \(esDelCreditoDeLaPlataforma\(r\.motivo\)\) return 0;/);
  assert.match(costos, /delCredito: \{ llamadas: delCredito\.length/);
  const panel = sinComentarios(leer('lib/anthropic-usage.ts'));
  assert.match(panel, /if \(esDelCreditoDeLaPlataforma\(r\.motivo\)\) return 0;/, 'el panel del cliente le cobra un crédito que no paga');
});
