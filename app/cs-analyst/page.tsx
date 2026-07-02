import { ComingSoon } from '../_components/ComingSoon';
import { requireRolWs } from '@/lib/tab-access';

export default async function CsAnalystPage() {
  await requireRolWs([]);
  return <ComingSoon title="CS Analyst" icon="cs" />;
}
