import { ComingSoon } from '../_components/ComingSoon';
import { requireRolWs } from '@/lib/tab-access';

export default async function LandingWriterPage() {
  await requireRolWs([], { nav: 'landing-writer' });
  return <ComingSoon title="Landing Writer" icon="pen" />;
}
