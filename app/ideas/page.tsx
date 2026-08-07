// El primer paso de la fábrica: de qué hablar, antes de que haya pieza.
import { ComingSoon } from '../_components/ComingSoon';
import { requireRolWs } from '@/lib/tab-access';

export default async function IdeasPage() {
  await requireRolWs([], { nav: 'ideas' });
  return <ComingSoon title="Ideas" icon="idea" />;
}
