import { ComingSoon } from '../_components/ComingSoon';
import { requireRolWs } from '@/lib/tab-access';

export default async function VslWriterPage() {
  await requireRolWs([], { nav: 'vsl-writer' });
  return <ComingSoon title="VSL Writer" icon="pen" />;
}
