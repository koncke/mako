// Sales Machine · Closing Script. Todavía sin backend: sale con el chip «pronto».
import { ComingSoon } from '../_components/ComingSoon';
import { requireRolWs } from '@/lib/tab-access';

export default async function Page() {
  await requireRolWs([], { nav: 'closing-script' });
  return <ComingSoon title="Closing Script" icon="closingscript" />;
}
