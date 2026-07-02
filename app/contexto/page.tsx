// =============================================================================
// /contexto — editar el contexto de MaKo (Conocimiento, Fases, Prompts)
// =============================================================================
// Solo SUPER ADMIN: el contexto de MaKo es del sistema (prompts, RAG), no algo
// que un admin-cliente deba tocar. El link del menú también se oculta (nav.ts).

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { ContextoTabs } from './ContextoTabs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ContextoPage() {
  if (!(await getSesionAdmin())) redirect('/');
  return <ContextoTabs />;
}
