import { ComingSoon } from '../_components/ComingSoon';
import { requireRolWs } from '@/lib/tab-access';

export default async function CsAnalystPage() {
  await requireRolWs([], { nav: 'cs-analyst' });
  return <ComingSoon title="CS Analyst" icon="cs" />;
}
