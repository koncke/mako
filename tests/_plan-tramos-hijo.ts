// =============================================================================
// Hijo de tests/pagos-tramos.test.ts — NO es un test
// =============================================================================
// Dibuja sin navegador el editor del plan por tramos (`ArmarPlan`, app/crm/lead-view/ficha/pagos/bloques-cobro.tsx) con el lead
// que llega en argv[2]. Las acciones de servidor van de mentira con `mock.module` (en un node aparte con
// `--experimental-test-module-mocks`, como tests/_bloques-pagos-hijo.ts): el dibujo no llama a ninguna. Imprime el HTML.
// =============================================================================

import { mock } from 'node:test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';

const url = (r: string) => pathToFileURL(join(__dirname, '..', r)).href;
const nada = async () => ({ ok: false, error: 'de mentira' });
const router = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} };

async function main() {
  const { lead, pagos, hoy } = JSON.parse(process.argv[2] ?? '{}');
  // Lo que traen los módulos de servidor que la ficha importa de paso (la hora del negocio, la base): no corren al dibujar.
  mock.module('server-only', { namedExports: {} });
  mock.module(url('app/crm/[id]/pagos-campo-actions.ts'), { namedExports: {
    cambiarEstadoSuscripcionAction: nada, cortarRecordatoriosCuotaAction: nada, editarCuotaAction: nada, guardarCuotasAction: nada, guardarVentaAction: nada,
  } });
  mock.module(url('app/crm/lead-view/ficha/pagos/cuotas-actions.ts'), { namedExports: { bajaDelClienteAction: nada, proteccionesDeCuotasAction: async () => ({}), quitarCuotaAction: nada } });
  mock.module(url('app/crm/[id]/cobros-actions.ts'), { namedExports: { cancelarSuscripcionAction: nada, crearCobroAction: nada, monedasCobroAction: async () => ({}) } });
  mock.module(url('app/crm/[id]/deal-actions.ts'), { namedExports: { quitarSinCobroAction: nada } });
  const { ArmarPlan } = await import('../app/crm/lead-view/ficha/pagos/bloques-cobro');
  const ctx = { lead, data: { pagos, tratos: [] }, hoy, crm: null, releer() {}, parchear() {}, esAdmin: true };
  const html = renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never },
    createElement(ArmarPlan, { ctx: ctx as never, protegidas: {}, onListo: () => {} })));
  process.stdout.write(html);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
