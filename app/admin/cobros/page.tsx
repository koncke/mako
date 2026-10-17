// =============================================================================
// /admin/cobros — Martín vendiendo MaKo, sólo super admin
// =============================================================================
// Pedido de Martín (11/10/2026): «Lo voy a utilizar yo como superadmin para vender MaKo». Dos cosas
// en una pantalla: «Vender un plan» (el link de pago de un plan; al pagarse, la cuenta se crea sola —
// decisión suya del mismo día) y la lista de lo que se cobró, con el estado del alta de cada uno.
//
// ⚠️ NO ES UNA MÁQUINA DE COBRO APARTE. Los cobros son los del workspace de la plataforma
// (`wsSuperAdmin()`), creados con la MISMA pasarela que conecta cualquier cliente en /integraciones
// (BYOK, lib/cobros.ts). Si la plataforma no conectó ninguna, la pantalla lo dice y manda ahí.
//
// ⚠️ EL GUARD ES EL DE /admin/estrategia: el rol de AGENCIA (getSesionAdmin), no `rol_ws` —que vale
// 'admin' para el dueño de CADA workspace y abriría esto a todos los clientes—. El proxy ya cierra
// /admin/* (SOLO_ADMIN en proxy.ts) y cada action vuelve a preguntar: son tres cerrojos.

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { EmptyState, ErrorState, Pagina, PageHeader } from '@/app/_ui';
// La grilla de precios VIGENTE (la de /admin/estrategia): los montos sugeridos salen de acá y no de
// una cuarta grilla escrita en esta pantalla (docs/hallazgos-planes-y-cobro.md, «tres grillas»).
import { PRECIO_GROWTH, PRECIO_GRUPAL, PRECIO_PRO } from '@/app/admin/estrategia/datos';
import { cobrosDeMakoAction } from './actions';
import VenderPlan from './VenderPlan';
import ListaCobrosMako from './ListaCobrosMako';
import PrecioClienteAgencia from './PrecioClienteAgencia';
import { precioClienteAgenciaAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function CobrosPage() {
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');

  const datos = await cobrosDeMakoAction();
  if (!datos.ok) {
    return (
      <Pagina>
        <PageHeader titulo="Cobros" />
        <ErrorState titulo="No pude leer los cobros" detalle={datos.error} accion={{ label: 'Volver a cargar los cobros', href: '/admin/cobros' }} />
      </Pagina>
    );
  }

  const conPasarela = datos.pasarelas.length > 0;
  const precio = await precioClienteAgenciaAction();
  return (
    <Pagina>
      <PageHeader
        titulo="Cobros"
        proposito="Lo que vendiste de MaKo, y el link para vender un plan."
        accion={conPasarela ? <VenderPlan pasarelas={datos.pasarelas} sugeridos={[PRECIO_PRO, PRECIO_GROWTH, PRECIO_GRUPAL]} /> : undefined}
        consecuencia={conPasarela ? 'Al pagar, MaKo crea su cuenta y le manda el acceso.' : undefined}
      />
      {!conPasarela && (
        <EmptyState
          titulo="Conecta Stripe o Mercado Pago en Integraciones"
          detalle="Es la cuenta de MaKo: con ella se cobran los planes."
          // El `?ws=` explícito: la pestaña del super admin puede estar mirando a un cliente, y
          // conectar ahí la cuenta de MaKo la dejaría en el workspace equivocado.
          accion={{ label: 'Ir a Integraciones', href: `/integraciones?ws=${datos.ws}` }}
        />
      )}
      {/* El precio de un cliente de agencia (#866): con él, «Abrir cuenta» de una agencia muestra el link del primer mes. */}
      {precio.ok && <PrecioClienteAgencia inicial={precio.precio} conMercadoPago={datos.pasarelas.includes('mercadopago')} />}
      {(conPasarela || datos.cobros.length > 0) && <ListaCobrosMako cobros={datos.cobros} truncado={datos.truncado} />}
    </Pagina>
  );
}
