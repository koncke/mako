import { ComingSoon } from '../_components/ComingSoon';
import { requireRolWs } from '@/lib/tab-access';

export default async function MarketAnalystPage() {
  await requireRolWs([]);
  return <ComingSoon title="Market Analyst" icon="search" />;
}
