// =============================================================================
// El decodificador de un clip que salió de pantalla se cierra (11/11/2026)
// =============================================================================
// Medido el 11/11/2026 (docs/editor-video/memoria-del-editor.md §2): cada clip que se tocó dejaba su decodificador
// abierto (≈100 MB uno de celular) hasta sacar el archivo del proyecto; 10 clips, ≈1 GB. Fija que el videoCache
// (services/video-cache/service.ts) cierre el que no pidió un cuadro en 5 s DE USO:
//   · con el editor quieto no cuenta (si no, al volver de una pausa se cerrarían los clips que siguen a la vista);
//   · nunca uno con un pedido en curso;
//   · si se vuelve al clip, se reabre solo.
//
// PROBADO ROMPIÉNDOLO (11/11/2026, cada uno dio rojo y se volvió atrás):
//   · sin `podarInactivos()` en el finally de getFrameAt: rojo el de cerrar;
//   · el tiempo de uso con el reloj entero (sin `PASO_MAXIMO_MS`): rojo el de la pausa;
//   · sin mirar `pedidosEnCurso`: rojo el del pedido en curso.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VideoCache } from '../app/video-editor/_opencut/services/video-cache/service';

// Un VideoCache con decodificadores de mentira: cuenta cuáles se abren y cuáles se cierran.
class CacheFalso extends VideoCache {
  abiertosHistorial: string[] = [];
  cerrados: string[] = [];
  demora: Promise<void> | null = null;
  async initializeSink({ mediaId }: { mediaId: string }) {
    this.abiertosHistorial.push(mediaId);
    const cerrados = this.cerrados;
    const demora = () => this.demora;
    (this as unknown as { sinks: Map<string, unknown> }).sinks.set(mediaId, {
      input: { dispose: () => cerrados.push(mediaId) },
      sink: {
        canvases: async function* (desde: number) {
          let t = desde;
          for (;;) {
            const d = demora();
            if (d) await d;
            yield { canvas: {}, timestamp: t, duration: 1 / 30 };
            t += 1 / 30;
          }
        },
      },
      iterator: null,
      currentFrame: null,
      nextFrame: null,
      lastTime: -1,
      prefetching: false,
      prefetchPromise: null,
    });
  }
}

const archivo = {} as File;

// Reproduce `segundos` de un clip a 30 cuadros por segundo, con el reloj avanzando 33 ms por cuadro.
async function reproducir(c: CacheFalso, reloj: { t: number }, mediaId: string, segundos: number) {
  for (let i = 0; i < segundos * 30; i++) {
    reloj.t += 1000 / 30;
    await c.getFrameAt({ mediaId, file: archivo, time: i / 30 });
  }
}

test('un clip que salió de pantalla hace 5 s de uso se cierra; el que se ve, no', async () => {
  const reloj = { t: 1000 };
  const c = new CacheFalso({ reloj: () => reloj.t });
  await reproducir(c, reloj, 'a', 2);
  await reproducir(c, reloj, 'b', 7);
  assert.deepEqual(c.cerrados, ['a']);
  assert.equal(c.abiertos(), 1);
});

test('con el editor quieto no corre el tiempo: al volver de una pausa larga no se cierra lo que se ve', async () => {
  const reloj = { t: 1000 };
  const c = new CacheFalso({ reloj: () => reloj.t });
  // Dos clips a la vez (una capa encima de otra), un segundo.
  for (let i = 0; i < 30; i++) {
    reloj.t += 1000 / 30;
    await c.getFrameAt({ mediaId: 'fondo', file: archivo, time: i / 30 });
    await c.getFrameAt({ mediaId: 'capa', file: archivo, time: i / 30 });
  }
  reloj.t += 10 * 60 * 1000; // diez minutos en pausa
  for (let i = 0; i < 30; i++) {
    reloj.t += 1000 / 30;
    await c.getFrameAt({ mediaId: 'fondo', file: archivo, time: 1 + i / 30 });
    await c.getFrameAt({ mediaId: 'capa', file: archivo, time: 1 + i / 30 });
  }
  assert.deepEqual(c.cerrados, []);
  assert.deepEqual(c.abiertosHistorial, ['fondo', 'capa'], 'se reabrió un clip que estaba a la vista');
});

test('volver a un clip cerrado lo reabre y da el cuadro', async () => {
  const reloj = { t: 1000 };
  const c = new CacheFalso({ reloj: () => reloj.t });
  await reproducir(c, reloj, 'a', 1);
  await reproducir(c, reloj, 'b', 7);
  assert.ok(c.cerrados.includes('a'));
  reloj.t += 33;
  const cuadro = await c.getFrameAt({ mediaId: 'a', file: archivo, time: 0.5 });
  assert.ok(cuadro, 'no dio el cuadro');
  assert.deepEqual(c.abiertosHistorial, ['a', 'b', 'a']);
});

test('nunca cierra uno con un pedido en curso', async () => {
  const reloj = { t: 1000 };
  const c = new CacheFalso({ reloj: () => reloj.t });
  // Sin leer el cuadro siguiente: así lo único que lo protege es el pedido en curso (la lectura adelantada también
  // protege, y si no se apaga el test no distingue cuál de las dos lo salvó).
  (c as unknown as { startPrefetch: () => void }).startPrefetch = () => {};
  await reproducir(c, reloj, 'lento', 1);
  // Un pedido de «lento» que tarda: mientras tanto se reproducen 7 s de otro clip.
  let soltar!: () => void;
  c.demora = new Promise((r) => (soltar = r));
  reloj.t += 33;
  const enCurso = c.getFrameAt({ mediaId: 'lento', file: archivo, time: 30 });
  await new Promise((r) => setTimeout(r, 0));
  c.demora = null;
  await reproducir(c, reloj, 'otro', 7);
  assert.ok(!c.cerrados.includes('lento'), 'cerró un decodificador con un pedido en curso');
  soltar();
  await enCurso;
});
