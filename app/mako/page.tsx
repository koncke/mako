// =============================================================================
// /mako — "Preguntale a MaKo": chat general + historial de todos los chats
// =============================================================================

import { MakoTab } from './MakoTab';
import { guardOnboarding, requireCapa } from '@/lib/tab-access';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MakoPage() {
  await requireCapa('mako');
  await guardOnboarding();
  return <MakoTab />;
}
