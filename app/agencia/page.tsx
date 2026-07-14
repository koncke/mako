// =============================================================================
// /agencia — panel de la AGENCIA (SuperAdmin): el canal propio de MaKo
// =============================================================================
// Solo admin. Por ahora monta el panel del canal de WhatsApp de MaKo (instancia
// dedicada por QR). Es el primer paso de las tabs nativas de SuperAdmin.

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { AgenciaTabs } from './AgenciaTabs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AgenciaPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  if (!(await getSesionAdmin())) redirect('/login');
  const { tab } = await searchParams;
  const inicial = tab === 'plantillas' ? 'plantillas' : 'chat';
  return <AgenciaTabs inicial={inicial} />;
}
