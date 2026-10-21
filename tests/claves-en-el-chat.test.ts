// =============================================================================
// Nunca una key en el chat (pieza 1.6 de docs/ops-center-principal.md, 20/10/2026)
// =============================================================================
// Una clave pegada en el chat llegaba al modelo y quedaba guardada en `chart_chats`. Lo que fija este archivo:
//   1. QUÉ SE TAPA: las claves de los proveedores (y la línea de un .env), con el servicio de /integraciones al que
//      pertenecen; NO un email, un teléfono ni un monto, que en el chat del negocio son su trabajo;
//   2. EL TURNO la tapa ANTES de todo: lo que se guarda, el título, El Archivero y el modelo leen el texto tapado, y el
//      crudo no se vuelve a leer;
//   3. LA RESPUESTA dice que la tapó y trae el botón «Conectar» de ese servicio.
//
// PROBADO ROMPIÉNDOLO (21/10/2026, arnés del scratchpad `romper-tapado.mjs`: una rotura por vez, restaurada de memoria y
// comprobada con sha256; base 3 / 0). Cada una dio 2 / 1: el turno guardando el crudo (`recortarMensaje(entrada.mensaje…`)
// · los pegados de El Archivero con el crudo · la respuesta sin el botón · OpenRouter detrás de OpenAI (salía «openai») ·
// las reglas de personas adentro (tapaba el email). Restaurado: 3 / 0.
//
// Correr: npx tsx --test tests/claves-en-el-chat.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLAVE_TAPADA, avisoClaveTapada, taparClaves } from '../lib/claves-en-el-chat';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// Claves de mentira con la forma de las de verdad.
const X = 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6';
const CASOS: Array<[string, string, string | null]> = [
  ['anthropic', `mi clave es sk-ant-api03-${X}`, 'anthropic'],
  ['openrouter', `toma sk-or-v1-${X}`, 'openrouter'],
  ['openai', `sk-proj-${X}`, 'openai'],
  ['google', `AIzaSy${X}`, 'gemini'],
  ['groq', `gsk_${X}`, 'groq'],
  ['cerebras', `csk-${X}`, 'cerebras'],
  ['stripe', `sk_live_${X}`, 'stripe'],
  ['resend', `re_${X}`, 'email'],
  ['env con una de Google', `GEMINI_API_KEY=AIzaSy${X}`, 'gemini'],
  ['env sin proveedor', 'MI_SERVICIO_TOKEN=abc123', null],
];

test('se tapa cada clave, con el servicio al que pertenece; lo del negocio (email, teléfono, monto) no', () => {
  for (const [nombre, texto, servicio] of CASOS) {
    const t = taparClaves(texto);
    assert.ok(t.tapadas >= 1, `${nombre}: se tapó`);
    assert.ok(t.texto.includes(CLAVE_TAPADA), `${nombre}: queda «${CLAVE_TAPADA}»`);
    assert.doesNotMatch(t.texto, new RegExp(X), `${nombre}: no queda nada de la clave`);
    assert.equal(t.servicio, servicio, `${nombre}: el servicio del botón`);
  }
  assert.equal(taparClaves('MI_SERVICIO_TOKEN=abc123').texto, `MI_SERVICIO_TOKEN=${CLAVE_TAPADA}`, 'la línea del .env dice qué se pegó');
  // Rota: meter las reglas de personas → este test falla (en el chat del negocio, un email es su trabajo).
  const negocio = 'Escríbele a ana@cliente.com al +54 9 11 2345-6789: el plan sale $1.500 y la reunión es el 12/10.';
  assert.deepEqual(taparClaves(negocio), { texto: negocio, tapadas: 0, servicio: null });
  assert.deepEqual(taparClaves(''), { texto: '', tapadas: 0, servicio: null });
  assert.match(avisoClaveTapada('anthropic'), /Tapé tu clave.*Pégala aquí/);
  assert.equal(avisoClaveTapada(null), 'Tapé tu clave: no quedó en el chat.');
});

test('el turno tapa ANTES de guardar, titular, archivar y pensar; el crudo no se vuelve a leer', () => {
  const t = sinComentarios(leer('lib/mako-turno-app.ts'));
  const tapa = t.indexOf("const tapado = taparClaves(entrada.mensaje ?? '');");
  assert.ok(tapa > 0, 'el turno tapa el mensaje');
  // Rota: `recortarMensaje((entrada.mensaje ?? '')…` de vuelta → este test falla (se guardaría el crudo).
  assert.match(t, /const mensaje = tapado\.texto;\s*const textoPersona = recortarMensaje\(mensaje\.trim\(\), TOPE_MENSAJE\);/);
  assert.equal((t.match(/entrada\.mensaje/g) ?? []).length, 1, 'el crudo se lee UNA vez: para taparlo');
  assert.ok(tapa < t.indexOf("appendMessage(s.id, 'user'"), 'se tapa antes de guardar');
  assert.match(t, /partirPegados\(mensaje\)/, 'El Archivero recibe lo tapado');
});

test('la respuesta dice que la tapó, con el botón «Conectar» de su servicio', () => {
  const t = sinComentarios(leer('lib/mako-turno-app.ts'));
  // Rota: sin el `conectar` de la clave → este test falla.
  assert.match(t, /if \(tapado\.tapadas\) \{\s*aviso = \[avisoClaveTapada\(tapado\.servicio\), aviso\]\.filter\(Boolean\)\.join\(' '\);\s*conectar = conectar \?\? tapado\.servicio;\s*\}/);
  assert.match(t, /pantallas, conectar \}/);
});
