// =============================================================================
// /tickets/decisiones/lista — la Ticketera en lista (la vista SECUNDARIA; la de entrada es el mazo)
// =============================================================================
// Todas las decisiones a la vista, por urgencia, y las contestadas plegadas al final para
// cambiarlas. Es la que fue /admin/runway hasta el 14/10/2026: Martín pidió que el mazo fuera LA
// vista y que la lista quedara como opción. En el teléfono la misma URL la sirve /m/decisiones,
// con el MISMO componente (app/admin/runway/Tablero.tsx).
//
// ⚠️ Sólo el super admin: /tickets no lo cierra el proxy. 404 para el resto.

import { notFound } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { leerDecisiones } from '@/lib/admin-decisiones';
import { Pagina, PageHeader } from '@/app/_ui';
import { TableroDecisiones } from '@/app/admin/runway/Tablero';
import { responderDecision } from '@/app/admin/runway/acciones';
import '@/app/admin/runway/decisiones.css';
import '@/app/tickets/decisiones/vistas.css';

export const dynamic = 'force-dynamic';

export default async function TicketeraLista() {
  const admin = await getSesionAdmin();
  if (!admin) notFound();
  const lectura = await leerDecisiones();
  return (
    <Pagina>
      <PageHeader titulo="Ticketera" />
      <TableroDecisiones lectura={lectura} responder={responderDecision} />
    </Pagina>
  );
}
