// =============================================================================
// /m/ai-avatar/voces — DEPRECADA el 29/10/2026: redirige al estudio
// =============================================================================
// Era «Voices» en el teléfono (una de las cuatro secciones de HeyGen). Como en escritorio (app/ai-avatar/voces/page.tsx),
// AI Avatar es UNA pantalla (../EstudioM.tsx): la ruta queda para que un link viejo no dé 404. La puerta es la de
// siempre (su key y la del super admin) ANTES de redirigir: el redirect no le cuenta a nadie que la tab existe.

import { redirect } from 'next/navigation';
import { requireMovil } from '@/lib/movil-guard';
import { rutaConWs } from '@/lib/workspace';
import { requireAiAvatarM } from '../puerta';

export const dynamic = 'force-dynamic';

export default async function VocesPagina({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireMovil({ navKey: 'ai-avatar' });
  await requireAiAvatarM();
  await searchParams;
  redirect(await rutaConWs('/m/ai-avatar'));
}
