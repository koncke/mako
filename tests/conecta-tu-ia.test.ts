// =============================================================================
// IA9 (22/10/2026): la app deja de pedir «Gemini gratis» — «Conecta tu Claude, tu GPT o tu Gemini»
// =============================================================================
// Martín (22/10): la IA del cliente es la vía principal de todo lo que hace MaKo. Pero la app, sin IA, decía «Conecta una IA
// gratis para empezar — con Gemini alcanza» (lib/ia-mensajes.ts), el botón «Conectar tu IA» abría el modal de Gemini, el
// link de WhatsApp también, y las fichas de /integraciones vendían las gratis. Lo que fija este test:
//   1. el mensaje sin IA, el link y el botón apuntan a SU Claude (desde ahí, su GPT o su Gemini: IA16, «Cada usuario debe
//      poder pagar su token, su propia IA de gemini»);
//   2. «con Gemini alcanza» no queda en el código de la app (salvo el panel del Dashboard, que lo cambia TB3 importando
//      `FALTA_TU_IA`: esa pantalla es de otro chat);
//   3. las fichas de Claude y OpenAI son lo recomendado; las de Gemini y Groq ya no dicen «gratis».
//
// Probado rompiéndolo (22/10/2026, una rotura por vez, restaurada): el mensaje viejo → 1 y 2 en rojo; el botón a Gemini →
// 1 en rojo; el link de WhatsApp a Gemini → 1 en rojo; Groq «gratis» otra vez → 3 en rojo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONECTA_TU_IA, FALTA_TU_IA, mensajeIAFallo } from '../lib/ia-mensajes';
import { linkKeysIA } from '../lib/fallo-ia-texto';
import { SERVICIO_IA, iaParaConectar } from '../lib/mako-turno-app-reglas';
import { DEFS } from '../lib/integraciones-catalogo';

const RAIZ = join(__dirname, '..');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. sin IA: «Conecta tu Claude o tu GPT» (sin Gemini desde el 25/10), y el botón abre su Claude (el link del grupo, su GPT)', () => {
  const m = mensajeIAFallo({ hayIA: false, motivo: null, tema: 'generar las razones' });
  assert.match(m, /No hay ninguna IA conectada, así que MaKo no puede generar las razones\. Conecta tu Claude o tu GPT en Integraciones\./);
  // 25/10/2026, Martín: «le sigue diciendo que debe conectar su IA de Gemini, cuando dijimos que todo eso se hace con la app de
  // escritorio de MaKo y conectado a su claude o GPT». Gemini salió de la frase (reemplaza lo de IA16).
  assert.doesNotMatch(m, /gemini/i);
  // SU Gemini sí; «Gemini gratis» (la de la plataforma) no.
  assert.doesNotMatch(m, /gratis/);
  assert.equal(CONECTA_TU_IA, 'Conecta tu Claude o tu GPT');
  assert.equal(FALTA_TU_IA, 'Tu Claude o tu GPT');
  assert.equal(SERVICIO_IA, 'anthropic');
  assert.equal(iaParaConectar([]), 'anthropic', 'sin ninguna IA, su Claude');
  // El de WhatsApp abre su GPT desde el 25/10/2026 (lib/fallo-ia-texto.ts, `CUBREN_EL_TURNO`): en el grupo su Claude no
  // corre los turnos con herramientas ni escucha notas de voz.
  assert.equal(linkKeysIA('https://hola-mako.com'), 'https://hola-mako.com/integraciones?abrir=openai');
});

test('2. «con Gemini alcanza» no queda en el código de la app', () => {
  const archivos = execFileSync('git', ['ls-files', 'lib', 'app'], { cwd: RAIZ, encoding: 'utf8' }).split('\n')
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.startsWith('app/admin/dev/'));
  const conLaFrase = archivos.filter((f) => /con Gemini alcanza/.test(sinComentarios(readFileSync(join(RAIZ, f), 'utf8'))));
  assert.deepEqual(conLaFrase, [], 'quedó «con Gemini alcanza» en el código');
  // 22/10/2026 (TB3): el AI Analyst del Dashboard, el último que quedaba, dice lo de IA9 y abre su Claude.
  const analista = sinComentarios(readFileSync(join(RAIZ, 'app/dashboard/PanelAnalista.tsx'), 'utf8'));
  assert.match(analista, /datos=\{\[\{ k: 'Qué falta', v: FALTA_TU_IA \}\]\} accion=\{\{ label: CONECTA_TU_IA, onClick: \(\) => integracion\.abrir\('anthropic'\) \}\}/);
});

test('3. las fichas: su Claude y su GPT son lo recomendado; Gemini y Groq ya no dicen «gratis»', () => {
  const ficha = (k: string) => DEFS.find((d) => d.key === k)?.descripcion ?? '';
  assert.match(ficha('anthropic'), /^Tu Claude/);
  assert.match(ficha('openai'), /^Tu GPT/);
  assert.match(ficha('gemini'), /^Tu Gemini/);
  for (const k of ['anthropic', 'openai', 'gemini', 'groq']) assert.doesNotMatch(ficha(k), /gratis/i, `la ficha de ${k} vende «gratis»`);
});
