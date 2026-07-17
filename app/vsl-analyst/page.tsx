import { ComingSoon } from '../_components/ComingSoon';
import { requireRolWs } from '@/lib/tab-access';

export default async function VslAnalystPage() {
  await requireRolWs([], { nav: 'vsl-an' });
  return <ComingSoon title="VSL Analyst" icon="video" />;
}
