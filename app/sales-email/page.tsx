// Sales Machine · Sales Email. Todavía sin backend: sale con el chip «pronto».
import { ComingSoon } from '../_components/ComingSoon';
import { requireRolWs } from '@/lib/tab-access';

export default async function Page() {
  await requireRolWs([], { nav: 'sales-email' });
  return <ComingSoon title="Sales Email" icon="salesemail" />;
}
