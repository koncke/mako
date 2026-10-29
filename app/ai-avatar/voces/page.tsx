// =============================================================================
// /ai-avatar/voces — DEPRECADA el 29/10/2026: redirige al estudio
// =============================================================================
// Era «Voices»: la galería pública de ElevenLabs y las voces de tu cuenta; la voz elegida no llegaba al video (una de las cuatro secciones copiadas de HeyGen el 17/10). Martín, 29/10: «replica a higgsfield tal
// cual» y, para Create, «no quiero otras tabs... prefiero deprecar antes que conservar». AI Avatar es UNA pantalla
// (../Estudio.tsx); la ruta queda para que un link viejo no dé 404, y lleva su query.

import { redirect } from 'next/navigation';
import { requireAiAvatar } from '../acceso';
import { rutaConWs } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export default async function VocesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAiAvatar();
  await searchParams;
  redirect(await rutaConWs('/ai-avatar'));
}
