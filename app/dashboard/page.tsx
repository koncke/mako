import { redirect } from 'next/navigation';
import { requireRolWs } from '@/lib/tab-access';
import { rutaConWs } from '@/lib/workspace';

// "Graphics" en el sidebar entra por Marketing; Comercial es la otra sub-tab.
export default async function GraphicsPage() {
  await requireRolWs([], { nav: 'graphics' });
  redirect(await rutaConWs('/marketing'));
}
