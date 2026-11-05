// =============================================================================
// /admin/approvals — «Approvals»: en qué está cada aprobación que MaKo espera de otra empresa (5/11/2026)
// =============================================================================
// Martín, 5/11/2026: «todo deberías poder revisarlo tú, no hay nada que debería hacerlo yo a mano». El vigía
// (lib/vigia-aprobaciones-server.ts) revisa solo cada hora y avisa sólo cuando algo cambia; esta pantalla es la lista entera
// cuando él la quiere mirar: la app de iPhone, la de Android, la extensión, Meta, Google, Resend, Creem y el certificado de
// Windows. Se entra desde el menú de la foto (nav.ts → SUPERADMIN_MENU). En el teléfono, /m/approvals.
//
// ⚠️ LEE LO GUARDADO, nunca las fuentes: abrir la pantalla no le pregunta nada a Apple ni a Google (eso lo hace el cron, con
//    su compare-and-set y sus avisos). Lo mismo que devuelve `ver_aprobaciones_pendientes` en la API de MaKo.
// ⚠️ SÓLO EL SUPER ADMIN, en la primera línea y antes de leer nada (`getSesionAdmin`, no `rol_ws`: ése vale 'admin' para el
//    dueño de cada negocio). /admin está además en `SOLO_ADMIN` del proxy.
// =============================================================================

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { requireSesion } from '@/lib/tab-access';
import { listaGuardadaDeAprobaciones } from '@/lib/vigia-aprobaciones-server';
import { haceTxtCorto } from '@/lib/admin-errores-reglas';
import { ErrorState, Pagina, PageHeader } from '@/app/_ui';
import { ListaApprovals } from './ListaApprovals';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { title: 'Approvals' };

export default async function ApprovalsPage() {
  await requireSesion();
  if (!(await getSesionAdmin())) redirect('/inicio');
  const ahoraMs = Date.now();
  let datos: Awaited<ReturnType<typeof listaGuardadaDeAprobaciones>>;
  try {
    datos = await listaGuardadaDeAprobaciones(ahoraMs);
  } catch {
    return (
      <Pagina>
        <PageHeader titulo="Approvals" />
        <ErrorState titulo="No pude leer las aprobaciones" detalle="La base no contestó. Vuelve a abrir la pantalla en un momento." />
      </Pagina>
    );
  }
  return (
    <Pagina>
      <PageHeader
        titulo="Approvals"
        estado={datos.ultimaVuelta ? `Revisado ${haceTxtCorto(datos.ultimaVuelta, ahoraMs)}` : 'Todavía no se revisó'}
      />
      <ListaApprovals filas={datos.filas} ahoraMs={ahoraMs} />
    </Pagina>
  );
}
