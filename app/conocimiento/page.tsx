// =============================================================================
// /conocimiento — cursos y metodologías que MaKo tiene bajados a tierra
// =============================================================================

import { ConocimientoView } from './ConocimientoView';
import { requireRolWs } from '@/lib/tab-access';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ConocimientoPage() {
  await requireRolWs([]);
  return <ConocimientoView />;
}
