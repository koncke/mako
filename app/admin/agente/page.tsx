// =============================================================================
// /admin/agente — se fue a Admin › Agents (25/10/2026; era Customers), que desde el 5/11/2026 vive al pie de Activity
// =============================================================================
// Martín (docs/feedback-25-10-tarde.md punto 12): «Elimina la tab de "/admin/agente"... para eso ya vamos a tener la
// nueva vista». Lo que mostraba vive en app/admin/agente/Contenido.tsx y lo monta Admin › Agents (/admin?tab=agents). La ruta queda
// como redirect: hay links viejos en marcadores y en el teléfono (/m/agente sigue siendo su versión del teléfono).
// El guard va igual primero: la ruta no le cuenta a nadie que existe la pestaña.

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AgenteAdminPage() {
  if (!(await getSesionAdmin())) redirect('/inicio');
  redirect('/admin?tab=agents');
}
