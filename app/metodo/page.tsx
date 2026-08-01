// =============================================================================
// /metodo — conexión guiada de integraciones: tokens + tutorial por servicio
// =============================================================================
// Solo admin: gestiona las credenciales del workspace (tokens globales). El
// proxy ya bloquea la ruta, este guard es defensa en profundidad + redirect
// limpio.

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { MetodoWizard } from './MetodoWizard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MetodoPage() {
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');
  return <MetodoWizard />;
}
