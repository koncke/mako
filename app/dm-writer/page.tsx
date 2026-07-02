import { ComingSoon } from '../_components/ComingSoon';
import { requireRolWs } from '@/lib/tab-access';

export default async function DmWriterPage() {
  await requireRolWs([]);
  return <ComingSoon title="DM Writer" icon="pen" />;
}
