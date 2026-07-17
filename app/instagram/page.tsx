import { ComingSoon } from '../_components/ComingSoon';
import { requireRolWs } from '@/lib/tab-access';

export default async function InstagramPage() {
  await requireRolWs([], { nav: 'instagram' });
  return <ComingSoon title="Instagram" icon="instagram" />;
}
