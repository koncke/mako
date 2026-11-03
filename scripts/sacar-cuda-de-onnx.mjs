#!/usr/bin/env node
// =============================================================================
// sacar-cuda-de-onnx.mjs — 327 MB de disco que en Vercel no se pueden usar (3/11/2026)
// =============================================================================
// Corre como `prebuild`: npm lo dispara solo antes de `npm run build`, o sea después de instalar
// y antes de que Next empiece a escribir la salida.
//
// POR QUÉ: el 3/11/2026 el deploy murió en «Deploying outputs...» con ENOSPC. El reporte del
// contenedor listó el archivo más grande del disco:
//
//     327 MB : node_modules/onnxruntime-node/bin/napi-v3/linux/x64/libonnxruntime_providers_cuda.so
//
// Es el proveedor de CUDA de onnxruntime: sirve para inferir en GPU. En Vercel NO HAY GPU, así que
// ese archivo no se puede usar ni queriendo. Y acá nadie lo usaría igual: `@huggingface/transformers`
// lo importa un solo archivo, un Web Worker que transcribe con Whisper en la máquina del usuario
// (app/video-editor/_opencut/services/transcription/worker.ts).
//
// next.config.ts ya lo saca del BUNDLE de las funciones (`outputFileTracingExcludes`). Esto es lo
// otro: sacarlo del DISCO del contenedor, que es lo que se llenó.
//
// ⚠️ NUNCA FALLA EL BUILD. Si el archivo no está (Windows no trae el de CUDA), si no se puede
// borrar, o si el paquete no existe, avisa y sale con 0. Un prebuild que tira error deja la app
// sin deploy por intentar ahorrar disco, que es mucho peor que el disco.
//
// Si `onnxruntime-node` se va del árbol de dependencias, este script queda en no-op y se puede
// borrar junto con la exclusión de next.config.ts.
// =============================================================================
import { rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

// Sólo proveedores de GPU, por nombre completo. NO se toca `libonnxruntime.so.1` ni el binding:
// son el runtime en CPU, que es el que usaría Node si algún día se usara del lado del servidor.
const PROVEEDORES_DE_GPU = [
  'libonnxruntime_providers_cuda.so',
  'libonnxruntime_providers_tensorrt.so',
];
const CARPETAS = ['bin/napi-v3/linux/x64', 'bin/napi-v3/linux/arm64'];

let liberado = 0;
for (const carpeta of CARPETAS) {
  for (const archivo of PROVEEDORES_DE_GPU) {
    const ruta = join(process.cwd(), 'node_modules/onnxruntime-node', carpeta, archivo);
    try {
      const { size } = await stat(ruta);
      await rm(ruta);
      liberado += size;
      console.log('[MaKo] prebuild: borrado %s (%d MB) — Vercel no tiene GPU.', archivo, Math.round(size / 1e6));
    } catch {
      /* no está, o no se puede borrar: no es un problema */
    }
  }
}
console.log(liberado ? `[MaKo] prebuild: ${Math.round(liberado / 1e6)} MB de disco liberados.`
  : '[MaKo] prebuild: no había proveedores de GPU de onnxruntime para borrar.');
