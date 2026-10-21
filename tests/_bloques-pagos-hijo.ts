// =============================================================================
// Hijo de tests/chat-bloque-cobranza.test.ts y tests/chat-bloque-estado-cuenta.test.ts — NO es un test
// =============================================================================
// Dibuja sin navegador los bloques de Pagos del hilo con MaKo (app/_chat/bloques/*). Lo que trae `server-only` adentro
// va de mentira con `mock.module`, en un node aparte con `--experimental-test-module-mocks`:
//   · «A quién cobrar» (`cobranza`): las dos acciones de servidor (marcar y la lista viva). Imprime `hilo` (la foto
//     guardada, antes de la lista viva) y `viva` (la pieza de General con la lista viva, las acciones prendidas).
//   · el estado de cuenta (`estado_cuenta`): la pieza de la tab Pagos (`BloquesDePagos`) se reemplaza por una que
//     muestra lo que recibe —el lead, la lista de bloques y el comprobante del chat que le llega por contexto—. Imprime
//     `hilo`.
// `useRouter` de Next pide el router de la app montado: va uno de mentira, que no navega.
// =============================================================================

import { mock } from 'node:test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { createElement, useContext, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';

const url = (r: string) => pathToFileURL(join(__dirname, '..', r)).href;
const router = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} };
const dibujar = (el: ReactElement) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el));

async function main() {
  const bloque = JSON.parse(process.argv[2] ?? '{}');
  if (bloque.t === 'cobranza') {
    mock.module(url('app/crm/actions.ts'), { namedExports: { marcarPagoAction: async () => ({ quitada: false }) } });
    mock.module(url('app/_chat/bloques/cobranza-actions.ts'), { namedExports: { leerCobranzaDelHilo: async () => ({ ok: false, error: 'de mentira' }) } });
    const { default: CobranzaHilo } = await import('../app/_chat/bloques/CobranzaHilo');
    const { Cobranza } = await import('../app/general/Cobranza');
    process.stdout.write(JSON.stringify({
      hilo: dibujar(createElement(CobranzaHilo, { b: bloque })),
      viva: dibujar(createElement(Cobranza, { filas: bloque.filas, tz: bloque.tz, error: null, limite: 5, alCambiar: () => {} })),
    }));
    return;
  }
  if (bloque.t === 'estado_cuenta') {
    const { ComprobanteDelChatCtx } = await import('../app/crm/lead-view/ficha/pagos/comprobante-del-chat');
    function BloquesDePagos(p: { leadId: number; lista: unknown; que: string }) {
      const c = useContext(ComprobanteDelChatCtx);
      return createElement('div', { 'data-pieza': 'BloquesDePagos', 'data-props': JSON.stringify({ leadId: p.leadId, lista: p.lista, que: p.que, comprobante: c ? { nombre: c.nombre, pagoId: c.pagoId } : null }) });
    }
    mock.module(url('app/customer-success/PagosCliente.tsx'), { namedExports: { BloquesDePagos } });
    const { default: EstadoCuentaHilo } = await import('../app/_chat/bloques/EstadoCuentaHilo');
    process.stdout.write(JSON.stringify({ hilo: dibujar(createElement(EstadoCuentaHilo, { b: bloque })) }));
    return;
  }
  throw new Error(`no sé dibujar «${bloque.t}»`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
