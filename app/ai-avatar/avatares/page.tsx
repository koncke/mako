// =============================================================================
// /ai-avatar/avatares — DEPRECADA el 29/10/2026: redirige al estudio
// =============================================================================
// Era «Avatars»: tus looks y crear uno con un tema (una de las cuatro secciones copiadas de HeyGen el 17/10). Martín, 29/10: «replica a higgsfield tal
// cual» y, para Create, «no quiero otras tabs... prefiero deprecar antes que conservar». AI Avatar es UNA pantalla
// (../Estudio.tsx); la ruta queda para que un link viejo no dé 404, y lleva su query (`?plantilla=` abre «Nueva» con ese preset).

import { redirect } from 'next/navigation';
import { requireAiAvatar } from '../acceso';
import { rutaConWs } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export default async function AvataresPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAiAvatar();
  const sp = await searchParams;
  const plantilla = typeof sp.plantilla === 'string' ? sp.plantilla.slice(0, 120) : '';
  redirect(await rutaConWs(plantilla ? `/ai-avatar?plantilla=${encodeURIComponent(plantilla)}` : '/ai-avatar'));
}
