// =============================================================================
// /agencia — panel de la AGENCIA (SuperAdmin): el canal propio de MaKo
// =============================================================================
// Solo admin. Por ahora monta el panel del canal de WhatsApp de MaKo (instancia
// dedicada por QR). Es el primer paso de las tabs nativas de SuperAdmin.

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { AgenciaTabs } from './AgenciaTabs';
import { rutaConWs } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AgenciaPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  if (!(await getSesionAdmin())) redirect('/login');
  // Las plantillas se mudaron a /mensajes, y «MaKo Messages» salió el 26/10/2026 (app/_components/nav.ts): los links
  // guardados de `?tab=plantillas` caen en Automations.
  const { tab } = await searchParams;
  if (tab === 'plantillas') redirect(await rutaConWs('/automations'));
  return <AgenciaTabs />;
}
