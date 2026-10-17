// =============================================================================
// /ai-avatar/avatares — tus avatares y crear un look (tu foto + un tema)
// =============================================================================
// Copiado de «My Avatars» + «Looks» de HeyGen: un look es personaje + escena.

import { requireAiAvatar } from '../acceso';
import { Pagina, PageHeader } from '@/app/_ui';
import { Avatares } from '../AiAvatarCliente';

export const dynamic = 'force-dynamic';

export default async function AvataresPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAiAvatar();
  const sp = await searchParams;
  return (
    <Pagina>
      <PageHeader titulo="Avatares" proposito="Tu cara, en las escenas que elijas." />
      <Avatares plantillaInicial={typeof sp.plantilla === 'string' ? sp.plantilla.slice(0, 80) : undefined} />
    </Pagina>
  );
}
