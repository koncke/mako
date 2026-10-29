// =============================================================================
// /m/ai-avatar/avatares — DEPRECADA el 29/10/2026: redirige al estudio
// =============================================================================
// Era «Avatars» en el teléfono (una de las cuatro secciones de HeyGen). Como en escritorio (app/ai-avatar/avatares/page.tsx),
// AI Avatar es UNA pantalla (../EstudioM.tsx): la ruta queda para que un link viejo no dé 404, y lleva su `?plantilla=`. La puerta es la de
// siempre (su key y la del super admin) ANTES de redirigir: el redirect no le cuenta a nadie que la tab existe.

import { redirect } from 'next/navigation';
import { requireMovil } from '@/lib/movil-guard';
import { rutaConWs } from '@/lib/workspace';
import { requireAiAvatarM } from '../puerta';

export const dynamic = 'force-dynamic';

export default async function AvataresPagina({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireMovil({ navKey: 'ai-avatar' });
  await requireAiAvatarM();
  const sp = await searchParams;
  const plantilla = typeof sp.plantilla === 'string' ? sp.plantilla.slice(0, 120) : '';
  redirect(await rutaConWs(plantilla ? `/m/ai-avatar?plantilla=${encodeURIComponent(plantilla)}` : '/m/ai-avatar'));
}
