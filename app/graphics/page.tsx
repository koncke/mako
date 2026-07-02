import { redirect } from 'next/navigation';
import { requireRolWs } from '@/lib/tab-access';

// "Graphics" en el sidebar entra por Marketing; Comercial es la otra sub-tab.
export default async function GraphicsPage() {
  await requireRolWs([]);
  redirect('/marketing');
}
