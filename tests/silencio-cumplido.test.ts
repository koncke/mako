// «No contestó» presupone «le escribimos»
// =============================================================================
// El fallo por silencio de una secuencia decide dos cosas caras: que el lead
// quede en `no_responde` (y con eso fuera de la secuencia), y que al dueño le
// llegue un aviso diciendo «le mandé el audio y no contestó». La condición vivía
// inline en `evaluarDesenlaces` y fallaba de las tres formas posibles — el
// detalle, en la cabecera de `silencioCumplido` (lib/setting-estrategia.ts).
//
// El caso que la trajo, medido el 17/09/2026 en el ws1: las 4 inscripciones de
// la post-agenda quedaron en `no_responde` 12-19 h después de inscribirse, con
// `ultimo_paso_at = null`. La línea de WhatsApp estaba caída y no les había
// salido NADA.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { silencioCumplido } from '../lib/setting-estrategia';

const H = 3_600_000;
const ahoraMs = Date.parse('2026-09-17T12:00:00Z');
const hace = (h: number) => new Date(ahoraMs - h * H).toISOString();

test('sin NADA enviado no hay silencio que contar (el caso del ws1)', () => {
  // Inscripto hace dos días, la secuencia «terminó» sin que saliera un mensaje.
  assert.equal(silencioCumplido({ falloHoras: 12, estado: 'completada', ultimoEnviadoAt: null, ahoraMs }), false);
  assert.equal(silencioCumplido({ falloHoras: 12, estado: 'activa', ultimoEnviadoAt: null, ahoraMs }), false);
});

test('a MITAD de la secuencia no se la da por perdida: falta el recordatorio', () => {
  // La post-agenda: audio enviado hace 13 h, recordatorio pendiente a las 24 h.
  // Con la condición vieja esto daba `fallo` y el recordatorio no salía nunca.
  assert.equal(silencioCumplido({ falloHoras: 12, estado: 'activa', ultimoEnviadoAt: hace(13), ahoraMs }), false);
});

test('terminada y pasado el umbral desde el último envío: sí', () => {
  assert.equal(silencioCumplido({ falloHoras: 12, estado: 'completada', ultimoEnviadoAt: hace(13), ahoraMs }), true);
});

test('terminada pero todavía dentro del umbral: no', () => {
  assert.equal(silencioCumplido({ falloHoras: 12, estado: 'completada', ultimoEnviadoAt: hace(11), ahoraMs }), false);
});

test('falloHoras 0 es «nunca»', () => {
  assert.equal(silencioCumplido({ falloHoras: 0, estado: 'completada', ultimoEnviadoAt: hace(500), ahoraMs }), false);
});

test('los que ya tienen su desenlace no vuelven a entrar', () => {
  // `respondio` (pausarPorRespuesta) y `no_responde` ya decidieron: no es silencio.
  for (const estado of ['respondio', 'no_responde', 'pausada', 'cancelada']) {
    assert.equal(silencioCumplido({ falloHoras: 12, estado, ultimoEnviadoAt: hace(100), ahoraMs }), false, estado);
  }
});

test('una fecha ilegible no dispara nada', () => {
  assert.equal(silencioCumplido({ falloHoras: 12, estado: 'completada', ultimoEnviadoAt: 'no-es-fecha', ahoraMs }), false);
});

// Probado rompiéndolo (17/09/2026), volviendo a la condición vieja —corre solo con
// `estado === 'activa'` y, sin nada enviado, cuenta desde la inscripción—:
// 3 fallos, 4 pases. Caen justo los tres casos que la motivaron: «sin NADA
// enviado», «a MITAD de la secuencia» y «terminada y pasado el umbral».
