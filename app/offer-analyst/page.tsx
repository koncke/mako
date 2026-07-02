import { ComingSoon } from '../_components/ComingSoon';
import { requireRolWs } from '@/lib/tab-access';

export default async function OfferAnalystPage() {
  await requireRolWs([]);
  return <ComingSoon title="Offer Analyst" icon="tag" />;
}
