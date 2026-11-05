// =============================================================================
// /m/cobros — «Billing» en el teléfono (17/10/2026). En la URL, /admin/cobros. Sólo el super admin.
// =============================================================================
// Lo que se vendió de MaKo: una fila por cobro, con quién, qué plan, cuánto y en qué quedó, y en la hoja el estado de
// la CUENTA que ese cobro da de alta, que es un segundo estado y no el mismo. Referencia: la lista de pagos de la app de
// Stripe (y la de Mercado Pago) en el celular, con el monto a la derecha, el estado en una pastilla y el detalle en una
// hoja con «Copiar el link». Lee lo MISMO que la computadora (`cobrosDeMakoAction`, que pregunta `getSesionAdmin`).
//
// ⚠️ LO QUE MUEVE PLATA QUEDA EN LA COMPUTADORA, dicho en su fila: vender un plan (arma un link de pago), anular un link
// y reembolsar. Son acciones con confirmación y con un motivo de la pasarela que hay que leer entero. El teléfono
// copia el link de un cobro pendiente, que no mueve nada.
// =============================================================================

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { requireMovil } from '@/lib/movil-guard';
import { HOME_MOVIL } from '@/lib/movil-rutas';
import { rutaConWs } from '@/lib/workspace';
import { cobrosDeMakoAction } from '@/app/admin/cobros/actions';
import { recibosAction } from '@/app/admin/cobros/recibos-actions';
import { ErrorM, PantallaM } from '@/app/m/_ui';
import { CobrosM } from './CobrosM';

export const dynamic = 'force-dynamic';

export default async function CobrosMovil() {
  if (!(await getSesionAdmin())) redirect(await rutaConWs(HOME_MOVIL));
  await requireMovil();
  const [datos, recibos] = await Promise.all([cobrosDeMakoAction(), recibosAction({ limite: 50 })]);
  if (!datos.ok) return <PantallaM><ErrorM frase={datos.error} /></PantallaM>;
  // Los recibos (5/11/2026): la lista con «Bajar». Cargar un pago queda en la computadora, dicho en su fila.
  const listaRecibos = recibos.ok && !recibos.faltaLaMigracion
    ? recibos.recibos.map((r) => ({ id: r.id, numero: r.numero, aNombre: r.a_nombre, totales: r.totales_recibido, fecha: r.fecha_pago, estado: r.estado }))
    : null;
  return (
    <PantallaM>
      <CobrosM cobros={datos.cobros} truncado={datos.truncado} conPasarela={datos.pasarelas.length > 0} recibos={listaRecibos} />
    </PantallaM>
  );
}
