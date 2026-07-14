// =============================================================================
// /agencia — panel de la AGENCIA (SuperAdmin): el canal propio de MaKo
// =============================================================================
// Solo admin. Por ahora monta el panel del canal de WhatsApp de MaKo (instancia
// dedicada por QR). Es el primer paso de las tabs nativas de SuperAdmin.

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { CanalMaKoPanel } from './CanalMaKoPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AgenciaPage() {
  if (!(await getSesionAdmin())) redirect('/login');
  return <CanalMaKoPanel />;
}
