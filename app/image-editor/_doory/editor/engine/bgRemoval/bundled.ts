import type { ModelDescriptor } from './model'
import { WorkerBackgroundRemover } from './remover'

/**
 * The remover the app ships: the cut-out worker (built as its own chunk with the model runtime).
 *
 * MaKo: Doory importaba el .wasm con el `?url` de Vite; Turbopack no lo entiende y un .wasm del build da 404 en
 * Vercel (docs/editor-imagen/relevamiento-integracion-mako.md). `wasmUrl` vacío = el worker lo baja de jsDelivr con
 * la versión EXACTA del runtime instalado (session.ts).
 */
export function createBundledRemover(model: ModelDescriptor): WorkerBackgroundRemover {
  return new WorkerBackgroundRemover(model, {
    createWorker: () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'doory-cutout' }),
    wasmUrl: '',
  })
}
