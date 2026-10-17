// =============================================================================
// /ai-avatar/voces — la galería de voces en español y las de tu cuenta
// =============================================================================
// Copiado de la Voice Library de HeyGen: filtros por acento y género, escuchar,
// sumar a tu cuenta. La cuenta es la de ElevenLabs del cliente (su key).

import { requireAiAvatar } from '../acceso';
import { Pagina, PageHeader } from '@/app/_ui';
import { Voces } from '../AiAvatarCliente';

export const dynamic = 'force-dynamic';

export default async function VocesPage() {
  await requireAiAvatar();
  return (
    <Pagina>
      <PageHeader titulo="Voces" proposito="Escucha y elige cómo suena tu avatar." />
      <Voces />
    </Pagina>
  );
}
