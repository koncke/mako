// =============================================================================
// La PC que no contesta deja tiempo para SU clave, y Gemini no tiene computadora (24/10/2026)
// =============================================================================
// Martín, 24/10/2026: «qué pasó con habilitar la opción de GPT en la PC? Y veo que agregaste Gemini, podríamos hacer eso
// también en PC». Dos cosas fija este archivo:
//
//   1. GEMINI NO VA A LA PC, y no por falta de código. Desde el 18/06/2026 Gemini CLI no atiende el «Login with Google» de
//      cuentas personales (developers.google.com/gemini-code-assist/docs/deprecations/code-assist-individuals, actualizada el
//      09/10/2026), y su reemplazo, Antigravity CLI, prohíbe usarlo «in connection with products not provided by us»
//      (antigravity.google/terms, cláusula 6). Sin una suscripción que corra en la computadora, su Gemini va por clave (IA16).
//      Con IA16, «Conectar tu IA» ya trae Gemini, y el tutorial de la computadora es sólo de Claude o ChatGPT: el tipo lo dice.
//
//   2. EL RESPALDO DE UNA PC QUE NO CONTESTA ES SU CLAVE, Y NECESITA TIEMPO. El vigía levantó que a Brigitte Eberlin su
//      Gemini le dio timeout y no había nada detrás (en la nube: lo arregla Automations). En la PC pasaba lo mismo de otra
//      forma: la espera se comía todo el plazo de la ruta y, si la PC no contestaba, ya no quedaba tiempo para su clave. Ahora,
//      en Automático y con una clave propia, la PC deja `RESERVA_RESPALDO_MS` libres. El respaldo es SIEMPRE una IA del
//      negocio, nunca la de MaKo (IA16).
//
// PROBADO ROMPIÉNDOLO: el pie.
// Correr: npx tsx --test tests/ia-pc-respaldo.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ESPERA_RESPUESTA_MS, MARGEN_RUTA_MS, PROVEEDORES_PC, RESERVA_RESPALDO_MS, esperaDelTurno, probarSuClaveTrasLaPc, sanearCuentas,
} from '../lib/ia-pc-reglas';
import { CHATGPT_EN_LA_PC, comoConectar, iaDeLaPcPara, pcListaPara } from '../lib/conectar-ia-reglas';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. Gemini no tiene computadora: ni en las IA de la PC, ni en «Conectar tu IA», ni en lo que reporta una PC', () => {
  assert.deepEqual([...PROVEEDORES_PC], ['claude', 'chatgpt'], 'Gemini CLI ya no acepta cuentas personales (18/06/2026)');
  assert.equal(iaDeLaPcPara('gemini'), null);
  assert.equal(iaDeLaPcPara('claude'), 'claude');
  assert.equal(iaDeLaPcPara('chatgpt'), 'chatgpt');
  assert.equal(pcListaPara('gemini'), false);
  assert.equal(pcListaPara('claude'), true);
  assert.equal(pcListaPara('chatgpt'), CHATGPT_EN_LA_PC);
  assert.deepEqual(comoConectar('gemini', { esAdmin: true }).map((o) => o.que), ['clave'], 'su Gemini, sólo por clave');
  assert.deepEqual(comoConectar('gemini', { esAdmin: false }).map((o) => o.que), ['pedir']);
  assert.deepEqual(comoConectar('chatgpt', { esAdmin: true }).map((o) => o.que), ['pc', 'clave'], 'ChatGPT sigue diciendo «Pronto»');
  assert.deepEqual(sanearCuentas([{ proveedor: 'gemini', email: 'ana@negocio.com' }, { proveedor: 'claude' }]).map((c) => c.proveedor), ['claude'],
    'una cuenta de Gemini que reporte una PC no entra');
});

test('2. el tutorial de la computadora es de una IA de la PC: para Gemini no se abre', () => {
  const ui = sinComentarios(leer('app/integraciones/TusCuentasIA.tsx'));
  assert.match(ui, /const deLaPc = iaDeLaPcPara\(ia\);\s*if \(!deLaPc\) return;/);
  assert.match(ui, /setIaTutorial\(deLaPc\)/);
  assert.match(ui, /useState<ProveedorPc>\('claude'\)/);
  assert.match(ui, /pasoInicial\?: number; ia\?: ProveedorPc \}\)/);
});

test('3. la espera de la PC le deja tiempo a su clave, y «tardó» prueba su clave sólo si se le reservó', () => {
  assert.equal(esperaDelTurno(300_000, 0), ESPERA_RESPUESTA_MS, 'sin reserva, lo de siempre');
  assert.equal(esperaDelTurno(300_000, 0, RESERVA_RESPALDO_MS), 300_000 - MARGEN_RUTA_MS - RESERVA_RESPALDO_MS);
  assert.equal(esperaDelTurno(120_000, 0, RESERVA_RESPALDO_MS), 5_000);
  assert.equal(esperaDelTurno(100_000, 0, RESERVA_RESPALDO_MS), 0, 'nunca negativa');
  assert.equal(probarSuClaveTrasLaPc('tarde', { eligioLaPc: false, reservado: true }), true, 'la PC no contestó: contesta su clave');
  assert.equal(probarSuClaveTrasLaPc('tarde', { eligioLaPc: false, reservado: false }), false, 'sin reserva ya no queda tiempo');
  assert.equal(probarSuClaveTrasLaPc('muchos', { eligioLaPc: false, reservado: true }), false, 'pasó su tope');
  assert.equal(probarSuClaveTrasLaPc('apagada', { eligioLaPc: true, reservado: false }), false, 'eligió su computadora');
  assert.equal(probarSuClaveTrasLaPc('apagada', { eligioLaPc: false, reservado: false }), true);
  assert.equal(probarSuClaveTrasLaPc(null, { eligioLaPc: false, reservado: false }), true, 'sin PC, su clave');
});

test('4. el turno reserva sólo en Automático, con una clave propia y yendo a la PC; y el respaldo es SU clave', () => {
  const t = sinComentarios(leer('lib/mako-turno-app.ts'));
  assert.match(t, /const reservado = conLaPc && !!pc && pcPuede && !eligioLaPc && await claveDeIAPropia\(ws\)\.catch\(\(\) => false\);/);
  assert.ok(t.indexOf('const reservado =') < t.indexOf('const espera = esperaDelTurno('), 'antes de calcular la espera');
  assert.match(t, /const espera = esperaDelTurno\(entrada\.plazoMs \?\? PLAZO_RUTA_MS, Date\.now\(\) - inicio, reservado \? RESERVA_RESPALDO_MS : 0\);/);
  assert.match(t, /if \(!texto && probarSuClaveTrasLaPc\(falloDeLaPc, \{ eligioLaPc, reservado \}\)\) \{\s*try \{\s*const r = await chatClaudeTools\(system, msgs, tools, nuevoIntento\(\), \{\s*feature: FEATURE, maxSteps: 8, sinFallbackClaude: true, soloSuIA: negocio\.suIA,/,
    'el respaldo es su clave, con «sólo su IA» y sin el Claude de MaKo');
  assert.match(t, /if \(texto\) \{ fallo = null; falloDeLaPc = null; \}/, 'si contestó su clave, lo de la PC ya no es lo que pasó');
});

test('5. Automático prueba la PC con su Claude y después con las otras, en el orden de PROVEEDORES_PC', () => {
  const t = sinComentarios(leer('lib/mako-turno-app.ts'));
  assert.match(t, /for \(const otra of PROVEEDORES_PC\.filter\(\(p\) => p !== 'claude'\)\) \{/);
  assert.match(t, /const modelo = iaDeLaPc !== 'claude' \? undefined/, 'con ChatGPT, Codex usa su modelo');
  assert.match(t, /\.\.\.\(iaDeLaPc !== 'claude' \? \{ proveedor: iaDeLaPc \} : \{\}\)/, 'un turno de Claude sale igual que antes, sin proveedor');
});

// ROTURAS (24/10/2026; base 5/0, una por vez y el original de vuelta byte a byte, scripts del scratchpad de la sesión):
//   cada una da 1 fallo y 4 pases, en el test que nombra:
//   · PROVEEDORES_PC con 'gemini' de vuelta (y su tipo) → 1.
//   · el tutorial sin la guarda de iaDeLaPcPara → 2.
//   · probarSuClaveTrasLaPc con «tarde» siempre false → 3.
//   · `reservado` sin `!eligioLaPc` → 4.
//   · el loop de Automático vuelto a ChatGPT a mano → 5.
