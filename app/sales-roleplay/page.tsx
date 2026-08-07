// Sales Machine · Sales Roleplay. Todavía sin backend: sale con el chip «pronto».
import { ComingSoon } from '../_components/ComingSoon';
import { requireRolWs } from '@/lib/tab-access';

export default async function Page() {
  await requireRolWs([], { nav: 'sales-roleplay' });
  return <ComingSoon title="Sales Roleplay" icon="roleplay" />;
}
