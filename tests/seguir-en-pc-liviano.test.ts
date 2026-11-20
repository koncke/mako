// =============================================================================
// EL GUARD DEL TELÉFONO NO ARRASTRA EL SERVIDOR DEL ARRANQUE AL LAYOUT RAÍZ (20/11/2026, el build de Vercel colgado)
// =============================================================================
// lib/movil-guard.ts lo importa app/layout.tsx: todo lo que cuelgue de él entra en el análisis de CADA ruta. El 20/11 el guard
// importó `./onboarding-arranque-server` (para «Sigamos en tu computadora») y pasó de 53 a 1786 módulos del repo; el build de
// producción se quedó en «Creating an optimized production build» más de 25 minutos (antes, 2-3). «Sigamos en tu computadora» vive
// ahora en lib/seguir-en-pc.ts, un módulo chico.
// Mide el grafo de verdad con esbuild (lo que importa cada archivo, también un `import()`), no el texto.
// Probado rompiéndolo (20/11/2026): con el `import('./onboarding-arranque-server')` de vuelta en el guard, cae el 1.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

const RAIZ = join(__dirname, '..');
/** Los módulos del repo (sin node_modules) que arrastra `archivo`, siguiendo también los `import()`. */
async function grafo(archivo: string): Promise<string[]> {
  const r = await build({
    entryPoints: [join(RAIZ, archivo)], bundle: true, write: false, metafile: true, platform: 'node', format: 'esm', jsx: 'automatic',
    absWorkingDir: RAIZ, tsconfig: join(RAIZ, 'tsconfig.json'), packages: 'external', logLevel: 'silent', loader: { '.css': 'empty' },
    plugins: [{ name: 'externos', setup(b) { b.onResolve({ filter: /^server-only$|^client-only$|^next\// }, (a) => ({ path: a.path, external: true })); } }],
  });
  return Object.keys(r.metafile.inputs).filter((m) => !m.includes('node_modules')).map((m) => m.replace(/\\/g, '/'));
}

/** Lo pesado que no puede entrar al layout por el guard. */
const PESADOS = ['lib/onboarding-arranque-server.ts', 'lib/second-brain-opera.ts', 'lib/cerebro-construccion-datos.ts', 'lib/offer-sesiones.ts'];
/** Medido el 20/11/2026: el guard, 62 módulos (53 antes del cambio); con el servidor del arranque, 1786. El techo deja aire. */
const TECHO_GUARD = 150;

test('1. el guard del teléfono es chico: ni el servidor del arranque ni el del Ops Center', async () => {
  const g = await grafo('lib/movil-guard.ts');
  assert.ok(g.length < TECHO_GUARD, `lib/movil-guard.ts arrastra ${g.length} módulos del repo (techo ${TECHO_GUARD}): lo importa el layout raíz`);
  for (const p of PESADOS) assert.ok(!g.includes(p), `lib/movil-guard.ts arrastra ${p}`);
  assert.ok(g.includes('lib/seguir-en-pc.ts'), '«Sigamos en tu computadora» sale del módulo chico');
});

test('2. lib/seguir-en-pc.ts es chico, y nadie lo trae desde el servidor del arranque', async () => {
  const g = await grafo('lib/seguir-en-pc.ts');
  assert.ok(g.length < TECHO_GUARD, `lib/seguir-en-pc.ts arrastra ${g.length} módulos del repo`);
  for (const p of PESADOS) assert.ok(!g.includes(p), `lib/seguir-en-pc.ts arrastra ${p}`);
  const srv = readFileSync(join(RAIZ, 'lib/onboarding-arranque-server.ts'), 'utf8');
  assert.doesNotMatch(srv, /export (async function seguirEnPcPendiente|const RUTA_SEGUIR_EN_PC)/, 'una sola definición: la del módulo chico');
});
