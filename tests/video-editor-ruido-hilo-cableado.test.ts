// =============================================================================
// Video Editor: el cableado de «Reducir el ruido» en un worker (audio/ruido-hilo/)
// =============================================================================
// La parte que se EJECUTA (el mismo resultado byte a byte, el avance, cancelar y el respaldo) está en
// tests/video-editor-ruido-hilo.test.ts. Acá, lo que no se ve corriendo en node: que la cadena de un clip (la vista
// previa y el export) y «Borrar silencios» le pidan al worker, que el worker se cree con el patrón que Turbopack
// empaqueta y con el camino de antes de respaldo, y que NADIE MÁS corra la red en el hilo de la pantalla.
//
// Correr: node --import tsx --test tests/video-editor-ruido-hilo-cableado.test.ts
// ── Roturas ── al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = process.cwd();

/** El fuente sin comentarios (AGENTS.md: un guard de «esto no está» se acusa con su propia prosa). */
const sinComentarios = (src: string) => src.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (...p: string[]) => sinComentarios(fs.readFileSync(path.join(RAIZ, 'app/video-editor/_opencut/audio', ...p), 'utf8'));

test('el cableado: la cadena y «Borrar silencios» le piden al worker, con el camino de antes de respaldo', () => {
  const cadena = leer('cadena.ts');
  assert.match(cadena, /canales = await reducirRuidoEnSegundoPlano\(\{ canales, sampleRate, intensidad: INTENSIDAD_RUIDO \}, \{ signal \}\);/);
  const silencios = leer('borrar-silencios.ts');
  assert.match(silencios, /const reducir = reducirRuidoEnSegundoPlano;/);
  assert.match(leer('dsp', 'silencios-sin-ruido.ts'), /await reducir\(\{ canales: \[mezcla\(audio\.canales\)\]/);
  const cliente = leer('ruido-hilo', 'cliente.ts');
  assert.match(cliente, /new Worker\(new URL\("\.\/worker\.ts", import\.meta\.url\), \{ type: "module" \}\)/, 'el worker se crea con el patrón que Turbopack empaqueta');
  assert.match(cliente, /enEsteHilo: reductorEnEsteHilo\(motorRnnoise\)/, 'sin el respaldo en este hilo');
  const worker = leer('ruido-hilo', 'worker.ts');
  assert.match(worker, /crearAtendedor\(\{\s*cargarMotor: motorRnnoise,/);
  assert.match(worker, /soltar: soltarConMensajes\(\)/);
  assert.match(worker, /alcance\.onmessage = /);
  // Nadie más corre la red por su cuenta: en positivo, quién llama a `reducirRuido(` y quién carga el motor del navegador.
  const archivos = fs.readdirSync(path.join(RAIZ, 'app/video-editor'), { recursive: true, encoding: 'utf8' }).filter((f) => /\.tsx?$/.test(f));
  assert.ok(archivos.length > 200, `se recorrieron ${archivos.length} archivos`);
  const llaman = (re: RegExp) => archivos.filter((f) => re.test(sinComentarios(fs.readFileSync(path.join(RAIZ, 'app/video-editor', f), 'utf8')))).map((f) => f.replace(/\\/g, '/')).sort();
  assert.deepEqual(llaman(/\breducirRuido\(/), ['_opencut/audio/dsp/ruido.ts', '_opencut/audio/ruido-hilo/cliente.ts', '_opencut/audio/ruido-hilo/protocolo.ts']);
  assert.deepEqual(llaman(/\bmotorRnnoise\b/), ['_opencut/audio/dsp/rnnoise.ts', '_opencut/audio/ruido-hilo/cliente.ts', '_opencut/audio/ruido-hilo/worker.ts']);
});

// ── Roturas (10/11/2026, base 1/0), cada una sola y restaurada desde la copia en memoria ──
//   la cadena vuelve a `reducirRuido` con `motorRnnoise()`  → rojo (la regex de la cadena y, si compilara, la lista de quién llama)
//   el worker suelta con `setTimeout`                        → rojo
//   «Borrar silencios» con `reductorEnEsteHilo(motorRnnoise)` → rojo
//   (la tabla completa, con los de la parte que se ejecuta, en tests/video-editor-ruido-hilo.test.ts)
