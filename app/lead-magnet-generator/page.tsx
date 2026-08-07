// Sales Machine · Lead Magnet Generator. Todavía sin backend: sale con el chip «pronto».
import { ComingSoon } from '../_components/ComingSoon';
import { requireRolWs } from '@/lib/tab-access';

export default async function Page() {
  await requireRolWs([], { nav: 'lead-magnet-generator' });
  return <ComingSoon title="Lead Magnet Generator" icon="leadmagnet" />;
}
