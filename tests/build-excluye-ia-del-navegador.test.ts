// El motor de IA que corre en el navegador NO viaja en las funciones del servidor.
//
// POR QUÉ EXISTE: el 3/11/2026 el deploy murió en «Deploying outputs...» con ENOSPC, con la salida
// en 2001 MB. El archivo más grande del contenedor era el proveedor de CUDA de `onnxruntime-node`
// (327 MB), que en Vercel no se puede usar —no hay GPU— y que nadie importa del lado del servidor:
// `@huggingface/transformers` lo pide un Web Worker (Whisper transcribiendo en la máquina del
// usuario). El arreglo es `outputFileTracingExcludes` en next.config.ts, y este test lo sostiene.
//
// SE PRUEBA EJECUTANDO LA REGLA, no leyendo el texto de la config: se arma el mismo emparejamiento
// que hace Next (next/dist/build/collect-build-traces.js → picomatch con `{ dot: true,
// contains: true }` sobre la ruta, y `path.join(raíz, patrón)` sobre el archivo) y se le pregunta
// por el binario real. Un test que buscara la cadena «onnxruntime-node» daría verde con la clave
// equivocada, que es justo la forma en que esto se rompe.
//
// ⚠️ TODO EN POSIX A PROPÓSITO. En Windows la exclusión no aplica (Next normaliza las barras de los
// includes y no las de los excludes), así que medir con `path.join` nativo daría rojo acá y verde en
// Vercel. Lo que importa es el contenedor, que es Linux: por eso `path.posix`.
//
// Verificado rompiéndolo: cambiar la clave `'/*'` por `'/admin/*'` deja `/crm` y `/api/cron/montaje`
// sin excluir (2 fallos); sacar `onnxruntime-node` de la lista deja los tres binarios adentro.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import config from '../next.config';

// El picomatch que usa Next, no el que haya suelto en node_modules: lo que se mide es su resultado.
const picomatch = createRequire(import.meta.url)('next/dist/compiled/picomatch') as (
  g: string | string[],
  o?: { dot?: boolean; contains?: boolean },
) => (s: string) => boolean;

const RAIZ = '/vercel/path0'; // la raíz del proyecto en el contenedor de Vercel
const excluye = config.outputFileTracingExcludes ?? {};

/** ¿Next sacaría este archivo del bundle de esta ruta? Mismo algoritmo que collect-build-traces. */
function queda_afuera(ruta: string, archivo: string): boolean {
  const patrones: string[] = [];
  for (const glob of Object.keys(excluye)) {
    if (picomatch(glob, { dot: true, contains: true })(ruta)) {
      for (const p of excluye[glob]) patrones.push(path.posix.join(RAIZ, p));
    }
  }
  if (!patrones.length) return false;
  return picomatch(patrones, { dot: true, contains: true })(path.posix.join(RAIZ, archivo));
}

// Los tres que el log del 3/11 marcó como «files larger than 100 MB», y el paquete que los arrastra.
const PESADOS = [
  'node_modules/onnxruntime-node/bin/napi-v3/linux/x64/libonnxruntime_providers_cuda.so',
  'node_modules/onnxruntime-node/bin/napi-v3/linux/x64/libonnxruntime.so.1',
  'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm',
  'node_modules/@huggingface/transformers/dist/transformers.js',
];

// Rutas de árboles distintos: una clave que sólo cubra `/admin/**` pasaría el test con `/admin/docs`
// y dejaría al resto de la app arrastrando los 500 MB.
const RUTAS = ['/admin/docs', '/crm', '/api/cron/montaje', '/video-editor', '/'];

for (const ruta of RUTAS) {
  test(`${ruta} no se lleva la IA del navegador`, () => {
    for (const archivo of PESADOS) {
      assert.equal(queda_afuera(ruta, archivo), true, `${ruta} todavía empaqueta ${archivo}`);
    }
  });
}

test('la exclusión no se come lo que el servidor SÍ necesita', () => {
  for (const archivo of [
    'node_modules/@supabase/supabase-js/dist/main/index.js',
    'node_modules/ffmpeg-static/ffmpeg',
    'node_modules/next/dist/server/next-server.js',
    'docs/hallazgos.md',
  ]) {
    assert.equal(queda_afuera('/admin/docs', archivo), false, `se excluyó de más: ${archivo}`);
  }
});
