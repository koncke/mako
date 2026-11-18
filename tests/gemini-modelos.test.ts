// =============================================================================
// Los modelos de Gemini salen de UN lugar: lib/gemini-modelos.ts (18/11/2026, F74)
// =============================================================================
// `gemini-flash-latest` y `gemini-flash-lite-latest` estaban escritos a mano en once lugares, y cada uno leía GEMINI_MODEL,
// GEMINI_STT_MODEL y GEMINI_VISION_MODEL en su orden. Se EJECUTA lo que devuelve cada función con distintos entornos (el mismo
// `||` de antes, en el mismo orden: esto no cambia qué modelo corre), y un BARRIDO frena un literal nuevo de esos dos alias en
// app/, lib/ y scripts/ (fuera de los comentarios: la historia de lo medido los nombra a propósito).
//
// Probado rompiéndolo (18/11/2026), base 3 pases / 0 fallos:
//   · `modeloGeminiStt` sin GEMINI_MODEL en el medio (`STT || FLASH`)             → 2 / 1
//   · un `'gemini-flash-latest'` escrito a mano otra vez en lib/transcribe-plataforma.ts → 2 / 1
//   · RESPALDOS_GEMINI vacío                                                       → 2 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import {
  GEMINI_FLASH, GEMINI_FLASH_LITE, RESPALDOS_GEMINI,
  modeloGeminiStt, modeloGeminiTexto, modeloGeminiVideo, modeloGeminiVision,
} from '../lib/gemini-modelos';

const RAIZ = join(__dirname, '..');

test('cada función lee el entorno en el MISMO orden que el `||` que reemplazó', () => {
  assert.equal(GEMINI_FLASH, 'gemini-flash-latest');
  assert.equal(GEMINI_FLASH_LITE, 'gemini-flash-lite-latest');
  // Sin nada: el Flash.
  for (const f of [modeloGeminiTexto, modeloGeminiStt, modeloGeminiVision, modeloGeminiVideo]) assert.equal(f({}), GEMINI_FLASH);
  // GEMINI_MODEL pisa a todos.
  const g = { GEMINI_MODEL: 'gemini-x' };
  for (const f of [modeloGeminiTexto, modeloGeminiStt, modeloGeminiVision, modeloGeminiVideo]) assert.equal(f(g), 'gemini-x');
  // El específico gana sobre GEMINI_MODEL, y sólo en su función.
  const e = { GEMINI_MODEL: 'gemini-x', GEMINI_STT_MODEL: 'stt', GEMINI_VISION_MODEL: 'vis', GEMINI_VIDEO_MODEL: 'vid' };
  assert.equal(modeloGeminiTexto(e), 'gemini-x');
  assert.equal(modeloGeminiStt(e), 'stt');
  assert.equal(modeloGeminiVision(e), 'vis');
  assert.equal(modeloGeminiVideo(e), 'vid');
  // Un específico sin GEMINI_MODEL: el específico; y vacío cuenta como «no está» (el `||` de antes).
  assert.equal(modeloGeminiStt({ GEMINI_STT_MODEL: 'stt' }), 'stt');
  assert.equal(modeloGeminiVision({ GEMINI_VISION_MODEL: '', GEMINI_MODEL: '' }), GEMINI_FLASH);
});

test('hay al menos un respaldo distinto del Flash (un Google saturado no es un pedido perdido)', () => {
  assert.ok(RESPALDOS_GEMINI.length >= 1);
  assert.ok(RESPALDOS_GEMINI.every((m) => m !== GEMINI_FLASH));
});

const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('ningún literal de los dos alias fuera de lib/gemini-modelos.ts', () => {
  const archivos = execFileSync('git', ['ls-files', 'app', 'lib', 'scripts'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter((f) => /\.(tsx?|mts|mjs|cjs|js)$/.test(f) && f !== 'lib/gemini-modelos.ts');
  assert.ok(archivos.length > 1000, `el barrido no está mirando el repo (vio ${archivos.length} archivos)`);
  const ALIAS = /(['"])gemini-flash(?:-lite)?-latest\1/;
  const sueltos: string[] = [];
  for (const f of archivos) {
    const src = sinComentarios(readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n'));
    src.split('\n').forEach((l, i) => { if (ALIAS.test(l)) sueltos.push(`${f}:${i + 1} · ${l.trim().slice(0, 120)}`); });
  }
  assert.deepEqual(sueltos, [], `estos archivos escriben el nombre del modelo a mano: usá GEMINI_FLASH, GEMINI_FLASH_LITE o modeloGemini…() de lib/gemini-modelos.ts\n${sueltos.join('\n')}`);
});
