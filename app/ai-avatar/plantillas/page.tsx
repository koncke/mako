// =============================================================================
// /ai-avatar/plantillas — la galería de temas por tipo de anuncio
// =============================================================================
// Copiado de la galería de Templates de HeyGen (categorías de sus anuncios UGC).

import { requireAiAvatar } from '../acceso';
import { Pagina, PageHeader } from '@/app/_ui';
import { Plantillas } from '../AiAvatarCliente';

export const dynamic = 'force-dynamic';

export default async function PlantillasPage() {
  await requireAiAvatar();
  return (
    <Pagina>
      <PageHeader titulo="Plantillas" proposito="Elige un tema y úsalo con tu cara." />
      <Plantillas />
    </Pagina>
  );
}
