// Content Machine · imágenes de anuncios. Todavía sin backend: sale con el chip «pronto».
import { ComingSoon } from '../_components/ComingSoon';
import { requireRolWs } from '@/lib/tab-access';

export default async function Page() {
  await requireRolWs([], { nav: 'image-generator' });
  return <ComingSoon title="Image Generator" icon="creativos" />;
}
