// =============================================================================
// Billing — lo que vendió MaKo y el link para vender un plan (la pestaña Billing de Customers, 25/10/2026)
// =============================================================================
// Era la página /admin/cobros (11/10/2026: «Lo voy a utilizar yo como superadmin para vender MaKo»). Desde el 25/10 vive
// adentro de Customers (docs/feedback-25-10-tarde.md punto 12: «Elimina la tab de /admin/cobros... para eso ya vamos a
// tener la nueva vista»), con lo mismo: vender un plan, los precios en la moneda de la Mercado Pago de MaKo, el precio
// del cliente de agencia y la lista de lo cobrado. /admin/cobros redirige acá.
//
// ⚠️ NO ES UNA MÁQUINA DE COBRO APARTE. Los cobros son los del workspace de la plataforma (`wsSuperAdmin()`), creados
// con la MISMA pasarela que conecta cualquier cliente en /integraciones (BYOK, lib/cobros.ts).
// ⚠️ EL GUARD LO PONE QUIEN LA MONTA (app/customers/page.tsx: `getSesionAdmin`, el super admin), y cada action vuelve a
// preguntar: el `rol_ws` vale 'admin' para el dueño de CADA workspace y abriría esto a todos los clientes.

import { EmptyState, ErrorState } from '@/app/_ui';
// La grilla de precios VIGENTE (la de /admin/estrategia): los montos sugeridos salen de acá y no de una cuarta grilla.
import { PRECIO_GROWTH, PRECIO_GRUPAL, PRECIO_PRO } from '@/app/admin/estrategia/datos';
import { cobrosDeMakoAction, precioClienteAgenciaAction, preciosLocalesAction } from './actions';
import VenderPlan from './VenderPlan';
import ListaCobrosMako from './ListaCobrosMako';
import PrecioClienteAgencia from './PrecioClienteAgencia';
import PreciosPlanesMp from './PreciosPlanesMp';
import RecibosMako from './RecibosMako';

export async function ContenidoCobros() {
  const datos = await cobrosDeMakoAction();
  if (!datos.ok) {
    return <ErrorState titulo="No pude leer los cobros" detalle={datos.error} accion={{ label: 'Volver a cargar los cobros', href: '/customers?tab=billing' }} />;
  }
  const conPasarela = datos.pasarelas.length > 0;
  const [precio, locales] = await Promise.all([precioClienteAgenciaAction(), preciosLocalesAction()]);
  return (
    <>
      {conPasarela ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>Lo que vendiste de MaKo. Al pagar un plan, MaKo crea su cuenta y le manda el acceso.</span>
          <VenderPlan pasarelas={datos.pasarelas} sugeridos={[PRECIO_PRO, PRECIO_GROWTH, PRECIO_GRUPAL]} />
        </div>
      ) : (
        <EmptyState
          titulo="Conecta Stripe o Mercado Pago en Integraciones"
          detalle="Es la cuenta de MaKo: con ella se cobran los planes."
          // El `?ws=` explícito: la pestaña del super admin puede estar mirando a un cliente, y conectar ahí la cuenta de
          // MaKo la dejaría en el workspace equivocado.
          accion={{ label: 'Ir a Integraciones', href: `/integraciones?ws=${datos.ws}` }}
        />
      )}
      {/* El precio de cada plan en la moneda de la Mercado Pago de MaKo: sin él, /planes no la ofrece (revisión del 23/10/2026). */}
      {locales.ok && locales.moneda && <PreciosPlanesMp moneda={locales.moneda} planes={locales.planes} />}
      {/* El precio de un cliente de agencia (#866): con él, «Abrir cuenta» de una agencia muestra el link del primer mes. */}
      {precio.ok && <PrecioClienteAgencia inicial={precio.precio} conMercadoPago={datos.pasarelas.includes('mercadopago')} />}
      {(conPasarela || datos.cobros.length > 0) && <ListaCobrosMako cobros={datos.cobros} truncado={datos.truncado} />}
      {/* El libro de recibos (5/11/2026): también de lo que entra por fuera de la pasarela (Binance), así que no depende de ella. */}
      <RecibosMako />
    </>
  );
}
