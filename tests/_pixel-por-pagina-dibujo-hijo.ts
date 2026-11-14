// =============================================================================
// Hijo de tests/pixel-por-pagina.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Dibuja sin navegador la tarjeta de la tab Tracking (`ComportamientoCard`) con cada caso que le pasan en argv (JSON:
// `[{ sinTracking, partes }]`), todo en cero: un lead sin un solo evento. Las dos acciones de servidor que la tarjeta
// importa (nombrar un video y la zona horaria del negocio) van de mentira con `mock.module`: traen `server-only`.

import { mock } from 'node:test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';

const url = (r: string) => pathToFileURL(join(__dirname, '..', r)).href;
const router = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} };

async function main() {
  mock.module(url('app/integraciones/landing-actions.ts'), { namedExports: { guardarVideoAction: async () => ({ ok: true }) } });
  mock.module(url('app/crm/lead-view/tz-workspace.ts'), { namedExports: { tzWorkspaceAction: async () => 'America/Tijuana' } });
  const { ComportamientoCard } = await import('../app/crm/lead-view/ComportamientoCard');
  const casos = JSON.parse(process.argv[2] ?? '[]') as Array<{ sinTracking: unknown; partes?: Record<string, boolean> }>;
  const html = casos.map((c) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never },
    createElement(ComportamientoCard, { visitas: 0, dias: 0, plays: 0, maxPct: null, eventos: [], pixelPuesto: true, sinTracking: c.sinTracking as never, replay: null, partes: c.partes }))));
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(html)}\n`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
