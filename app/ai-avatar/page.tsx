// =============================================================================
// /ai-avatar — Crear video: elegir el avatar, escribir el guion, generar
// =============================================================================
// La tab tipo HeyGen (pedido de Martín, 17/10/2026). Estructura copiada de HeyGen
// por su documentación (ver docs/hallazgos-ai-avatar.md); la generación es la del
// Video Generator. Hoy la ve sólo el super admin (./acceso.ts).
//
// Onboarding: la tab ES la herramienta, así que su onboarding es su estado vacío
// («Primero crea tu avatar»), sin entrada en el catálogo — la regla del 05/10 que
// ya siguen el Video Editor, /api-mako y el Dashboard.

import { requireAiAvatar } from './acceso';
import { Pagina, PageHeader } from '@/app/_ui';
import { CrearVideo } from './AiAvatarCliente';
import { FranjaPrueba } from '@/app/_ui/FranjaPrueba';

export const dynamic = 'force-dynamic';

export default async function AiAvatarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAiAvatar();
  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (typeof v === 'string' ? v.slice(0, 120) : undefined);
  return (
    <Pagina>
      <PageHeader titulo="Create video" proposito="Tu avatar dice tu guion." />
      <FranjaPrueba cosas={['prueba.avatares', 'prueba.tomas']} />
      <CrearVideo avatarInicial={uno(sp.avatar)} plantillaInicial={uno(sp.plantilla)} />
    </Pagina>
  );
}
