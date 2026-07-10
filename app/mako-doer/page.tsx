// =============================================================================
// /mako-doer — MaKo "doer": chat con herramientas de lectura de datos reales
// =============================================================================

import { MakoDoerTab } from './MakoDoerTab';
import { guardOnboarding } from '@/lib/tab-access';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MakoDoerPage() {
  await guardOnboarding();
  return <MakoDoerTab />;
}
