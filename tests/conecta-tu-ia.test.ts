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

test('1. sin IA: «Conecta tu Claude, tu GPT o tu Gemini», y el botón y el link abren su Claude', () => {
  const m = mensajeIAFallo({ hayIA: false, motivo: null, tema: 'generar las razones' });
  assert.match(m, /No hay ninguna IA conectada, así que MaKo no puede generar las razones\. Conecta tu Claude, tu GPT o tu Gemini en Integraciones\./);
  // SU Gemini sí; «Gemini gratis» (la de la plataforma) no.
  assert.doesNotMatch(m, /gratis/);
  assert.equal(CONECTA_TU_IA, 'Conecta tu Claude, tu GPT o tu Gemini');
  assert.equal(FALTA_TU_IA, 'Tu Claude, tu GPT o tu Gemini');
  assert.equal(SERVICIO_IA, 'anthropic');
  assert.equal(iaParaConectar([]), 'anthropic', 'sin ninguna IA, su Claude');
  assert.equal(linkKeysIA('https://hola-mako.com'), 'https://hola-mako.com/integraciones?abrir=anthropic');
});

test('2. «con Gemini alcanza» no queda en el código de la app (salvo el panel del Dashboard, de TB3)', () => {
  const archivos = execFileSync('git', ['ls-files', 'lib', 'app'], { cwd: RAIZ, encoding: 'utf8' }).split('\n')
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.startsWith('app/admin/dev/'));
  const conLaFrase = archivos.filter((f) => /con Gemini alcanza/.test(sinComentarios(readFileSync(join(RAIZ, f), 'utf8'))));
  assert.deepEqual(conLaFrase, ['app/dashboard/PanelAnalista.tsx'], 'quedó «con Gemini alcanza» en el código (PanelAnalista lo cambia TB3 con FALTA_TU_IA)');
});

test('3. las fichas: su Claude y su GPT son lo recomendado; Gemini y Groq ya no dicen «gratis»', () => {
  const ficha = (k: string) => DEFS.find((d) => d.key === k)?.descripcion ?? '';
  assert.match(ficha('anthropic'), /^Tu Claude/);
  assert.match(ficha('openai'), /^Tu GPT/);
  assert.match(ficha('gemini'), /^Tu Gemini/);
  for (const k of ['anthropic', 'openai', 'gemini', 'groq']) assert.doesNotMatch(ficha(k), /gratis/i, `la ficha de ${k} vende «gratis»`);
});
