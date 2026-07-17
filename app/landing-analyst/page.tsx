import { ComingSoon } from '../_components/ComingSoon';
import { requireRolWs } from '@/lib/tab-access';

export default async function LandingAnalystPage() {
  await requireRolWs([], { nav: 'landing-an' });
  return <ComingSoon title="Landing Analyst" icon="web" />;
}
