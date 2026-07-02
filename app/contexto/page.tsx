// =============================================================================
// /contexto — editar el contexto de MaKo (Conocimiento, Fases, Prompts)
// =============================================================================

import { ContextoTabs } from './ContextoTabs';
import { requireRolWs } from '@/lib/tab-access';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ContextoPage() {
  await requireRolWs([]);
  return <ContextoTabs />;
}
