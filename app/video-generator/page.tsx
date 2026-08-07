// Content Machine · video de anuncios. Todavía sin backend: sale con el chip «pronto».
import { ComingSoon } from '../_components/ComingSoon';
import { requireRolWs } from '@/lib/tab-access';

export default async function Page() {
  await requireRolWs([], { nav: 'video-generator' });
  return <ComingSoon title="Video Generator" icon="video" />;
}
