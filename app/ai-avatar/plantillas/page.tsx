// =============================================================================
// /ai-avatar/plantillas — DEPRECADA el 29/10/2026: redirige al estudio
// =============================================================================
// Era «Templates»: la galería de temas (hoy, los presets de «Nueva») (una de las cuatro secciones copiadas de HeyGen el 17/10). Martín, 29/10: «replica a higgsfield tal
// cual» y, para Create, «no quiero otras tabs... prefiero deprecar antes que conservar». AI Avatar es UNA pantalla
// (../Estudio.tsx); la ruta queda para que un link viejo no dé 404, y lleva su query.

import { redirect } from 'next/navigation';
import { requireAiAvatar } from '../acceso';
import { rutaConWs } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export default async function PlantillasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAiAvatar();
  await searchParams;
  redirect(await rutaConWs('/ai-avatar'));
}
