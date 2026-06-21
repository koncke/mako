// =============================================================================
// /contexto — editar el contexto de MaKo (Conocimiento, Fases, Prompts)
// =============================================================================

import { ContextoTabs } from './ContextoTabs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function ContextoPage() {
  return <ContextoTabs />;
}
