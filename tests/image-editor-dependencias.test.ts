// =============================================================================
// Todo paquete que importa el Image Editor está DECLARADO en package.json
// =============================================================================
// El 14/10/2026 el deploy de main quedó en Error con «Module not found: Can't
// resolve 'qrcode'»: el QR de Doory (_doory/editor/engine/objects/qr.ts) importa
// `qrcode`, que en el node_modules del clon estaba instalado SUELTO por otra sesión.
// Local compilaba, el typecheck pasaba y Vercel —que instala desde el lock— no lo
// tenía. Un paquete que «está en la máquina» no es un paquete del proyecto.
//
// Este guard barre los imports de app/image-editor (estáticos, dinámicos y de
// efecto) y exige que cada paquete esté en dependencies/devDependencies. Las
// excepciones van con su porqué.
//
// Correr: node --import tsx --test tests/image-editor-dependencias.test.ts
// PROBADO ROMPIÉNDOLO (14/10/2026): sacando `qrcode` de package.json → 0/1, nombrándolo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');

/** Lo que se importa sin estar declarado, A PROPÓSITO. */
const EXCEPCIONES: Record<string, string> = {
  // Sólo tipos (_doory/editor/engine/bgRemoval/ort-wasm.d.ts): el import se borra al compilar.
  'onnxruntime-common': 'sólo tipos, en un .d.ts',
  // Viene con @huggingface/transformers (1.22.0-dev) y el editor lo usa a esa versión exacta: declararlo con otra
  // movería el que usa el Whisper del Video Editor. El wasm se baja de jsDelivr con la versión instalada.
  'onnxruntime-web': 'transitiva de @huggingface/transformers, a propósito',
};

/** Archivos que no entran al build de Next. Vacío desde el 14/10: el único era la entrada de Vite de la vista del
 * presentador (`presenter/view/main.tsx`), y esa vista pasó a ser la ruta app/image-editor/presentador. */
const FUERA_DEL_BUILD = new Set<string>();

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(join(RAIZ, dir))) {
    const r = `${dir}/${n}`;
    if (statSync(join(RAIZ, r)).isDirectory()) out.push(...archivos(r));
    else if (/\.(ts|tsx)$/.test(n) && !/\.d\.ts$/.test(n)) out.push(r);
  }
  return out;
}

function paquete(spec: string): string | null {
  if (spec.startsWith('.') || spec.startsWith('@/') || spec.startsWith('node:')) return null;
  const partes = spec.split('/');
  return spec.startsWith('@') ? partes.slice(0, 2).join('/') : partes[0];
}

test('cada paquete que importa app/image-editor está en package.json', () => {
  const pkg = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const declarados = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]);
  const faltan = new Map<string, string>();
  const vistos = archivos('app/image-editor').filter((f) => !FUERA_DEL_BUILD.has(f));
  assert.ok(vistos.length > 300, `sólo ${vistos.length} archivos: el barrido no está mirando el editor`);
  for (const f of vistos) {
    const src = readFileSync(join(RAIZ, f), 'utf8').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of src.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm)) {
      const p = paquete(m[1]);
      if (!p || declarados.has(p) || p in EXCEPCIONES) continue;
      if (!faltan.has(p)) faltan.set(p, f);
    }
  }
  assert.deepEqual([...faltan].map(([p, f]) => `${p} (${f})`), [], 'paquetes importados que no están en package.json: Vercel no los instala');
});
