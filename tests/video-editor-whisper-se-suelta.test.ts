// =============================================================================
// El modelo de subtítulos (Whisper) se suelta al minuto sin uso (11/11/2026)
// =============================================================================
// docs/editor-video/memoria-del-editor.md §5: el hilo de Whisper quedaba cargado después de un subtitulado bueno, y sólo
// se terminaba al cancelar, al fallar o al cambiar de modelo. Son ≈250 MB (WASM) o ≈300 MB (WebGPU) hasta recargar la
// pestaña. Fija que services/transcription/service.ts lo termine a los WHISPER_INACTIVO_MS sin uso, que un segundo
// pedido dentro de ese minuto reuse el mismo hilo y que nunca se suelte con uno en curso.
//
// PROBADO ROMPIÉNDOLO (11/11/2026, cada uno dio rojo y se volvió atrás):
//   · sin el `setTimeout` del finally (lo de antes): rojo el de soltarse;
//   · sin `noSoltar()` al empezar: rojo el del segundo pedido;
//   · sin el `if (this.enUso === 0)` del temporizador Y sin `noSoltar()`: rojo el del pedido en curso. Cada una sola NO da
//     rojo ahí, y está bien: se cubren (al empezar un pedido se corta el temporizador, y si igual saltara no suelta nada).

import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Un Worker de mentira que contesta como el de Whisper (services/transcription/worker.ts).
const hilos: HiloFalso[] = [];
let retenerTranscripcion = false;
class HiloFalso {
  terminado = false;
  private oyentes = new Map<string, Set<(e: { data: unknown }) => void>>();
  constructor() {
    hilos.push(this);
  }
  addEventListener(tipo: string, fn: (e: { data: unknown }) => void) {
    if (!this.oyentes.has(tipo)) this.oyentes.set(tipo, new Set());
    this.oyentes.get(tipo)!.add(fn);
  }
  removeEventListener(tipo: string, fn: (e: { data: unknown }) => void) {
    this.oyentes.get(tipo)?.delete(fn);
  }
  private emitir(data: unknown) {
    queueMicrotask(() => {
      for (const fn of [...(this.oyentes.get('message') ?? [])]) fn({ data });
    });
  }
  postMessage(msg: { type: string }) {
    if (msg.type === 'init') this.emitir({ type: 'init-complete' });
    if (msg.type === 'transcribe' && !retenerTranscripcion) {
      this.emitir({ type: 'transcribe-complete', text: 'hola', palabras: [], precision: 'palabra', language: 'es' });
    }
  }
  terminate() {
    this.terminado = true;
  }
}
(globalThis as { Worker?: unknown }).Worker = HiloFalso;

const cargar = () => import('../app/video-editor/_opencut/services/transcription/service');
const audio = () => new Float32Array(16_000);
const esperarMicrotareas = () => new Promise<void>((r) => setImmediate(r));

beforeEach(async () => {
  (await cargar()).transcriptionService.terminate();
  hilos.length = 0;
  retenerTranscripcion = false;
});

test('después de subtitular, el modelo sigue cargado un rato y al minuto sin uso se suelta', async () => {
  const { transcriptionService, WHISPER_INACTIVO_MS } = await cargar();
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    await transcriptionService.transcribe({ audioData: audio() });
    assert.equal(hilos.length, 1);
    assert.equal(hilos[0].terminado, false, 'se soltó en el acto: un segundo pedido tendría que recargarlo');
    mock.timers.tick(WHISPER_INACTIVO_MS - 1);
    assert.equal(hilos[0].terminado, false);
    mock.timers.tick(2);
    assert.equal(hilos[0].terminado, true, 'el modelo sigue cargado después de un minuto sin uso');
  } finally {
    mock.timers.reset();
  }
});

test('un segundo pedido dentro del minuto reusa el mismo hilo y vuelve a contar desde cero', async () => {
  const { transcriptionService, WHISPER_INACTIVO_MS } = await cargar();
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    await transcriptionService.transcribe({ audioData: audio() });
    mock.timers.tick(WHISPER_INACTIVO_MS - 1000);
    await transcriptionService.transcribe({ audioData: audio() });
    assert.equal(hilos.length, 1, 'volvió a cargar el modelo');
    mock.timers.tick(WHISPER_INACTIVO_MS - 1000);
    assert.equal(hilos[0].terminado, false, 'se soltó contando desde el primer pedido');
    mock.timers.tick(2000);
    assert.equal(hilos[0].terminado, true);
  } finally {
    mock.timers.reset();
  }
});

test('con un subtitulado en curso nunca se suelta, aunque pase el minuto', async () => {
  const { transcriptionService, WHISPER_INACTIVO_MS } = await cargar();
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    await transcriptionService.transcribe({ audioData: audio() });
    retenerTranscripcion = true;
    const enCurso = transcriptionService.transcribe({ audioData: audio() });
    enCurso.catch(() => {});
    await esperarMicrotareas();
    mock.timers.tick(WHISPER_INACTIVO_MS * 3);
    assert.equal(hilos[0].terminado, false, 'cortó un subtitulado a la mitad');
    transcriptionService.cancel();
    await assert.rejects(enCurso);
  } finally {
    mock.timers.reset();
  }
});
