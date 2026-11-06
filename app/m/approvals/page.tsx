// =============================================================================
// /m/approvals — «Approvals» en el teléfono (5/11/2026). En la URL, /admin/approvals. Sólo el super admin.
// =============================================================================
// La misma lista que la computadora (`listaGuardadaDeAprobaciones`, lo GUARDADO por el vigía: abrirla no le pregunta nada a
// las tiendas), con la forma de una lista del teléfono: una fila por aprobación con su estado en una pastilla, y el detalle
// en una hoja con el link a la plataforma. Lo que pide algo va arriba (lo ordena lib/vigia-aprobaciones.ts).
//
// ⚠️ CARGAR UNA CLAVE QUEDA EN LA COMPUTADORA, dicho en su fila: es pegar un archivo .p8 o un JSON de Google, que en el
//    teléfono es un lugar para equivocarse. El teléfono dice qué falta.
// =============================================================================

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { requireMovil } from '@/lib/movil-guard';
import { HOME_MOVIL } from '@/lib/movil-rutas';
import { rutaConWs } from '@/lib/workspace';
import { listaGuardadaDeAprobaciones } from '@/lib/vigia-aprobaciones-server';
import { ErrorM, PantallaM } from '@/app/m/_ui';
import { ApprovalsM } from './ApprovalsM';

export const dynamic = 'force-dynamic';

export default async function ApprovalsMovil() {
  if (!(await getSesionAdmin())) redirect(await rutaConWs(HOME_MOVIL));
  await requireMovil();
  const ahoraMs = Date.now();
  let datos: Awaited<ReturnType<typeof listaGuardadaDeAprobaciones>>;
  try {
    datos = await listaGuardadaDeAprobaciones(ahoraMs);
  } catch {
    return <PantallaM><ErrorM frase="No pude leer las aprobaciones. Vuelve a abrir la pantalla en un momento." /></PantallaM>;
  }
  return (
    <PantallaM>
      <ApprovalsM filas={datos.filas} ahoraMs={ahoraMs} />
    </PantallaM>
  );
}
