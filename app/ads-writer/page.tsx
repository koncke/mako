import { ComingSoon } from '../_components/ComingSoon';
import { requireRolWs } from '@/lib/tab-access';

export default async function AdsWriterPage() {
  await requireRolWs([]);
  return <ComingSoon title="Ads Writer" icon="pen" />;
}
