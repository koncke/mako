// =============================================================================
// /copywriter/<id> — un guion abierto: MaKo, el árbol y el documento (docs/diseno-copywriter.md)
// =============================================================================
// LA PUERTA son dos (las de app/ai-avatar): `requireRolWs([], { nav: 'copywriter' })` (el admin del negocio, la tab en su
// capa, el onboarding) y `requireCopywriter()` (hoy, sólo el super admin: ./acceso.ts).
// EL GUION se lee con `abrir` (lib/copywriter/server.ts), que mira el negocio de la pestaña: uno de OTRO negocio contesta
// «No existe» y acá es un 404 de verdad. Un fallo de lectura (la base) NO es un 404: la pantalla lo dice.
// Sin `Pagina` y sin loading.tsx: el editor ocupa todo el alto (como /web-generator/<id>).
// =============================================================================

import { notFound } from 'next/navigation';
import { requireRolWs } from '@/lib/tab-access';
import { getWorkspaceActual } from '@/lib/workspace';
import { abrir, listar } from '@/lib/copywriter/server';
import { catalogosDelCopywriter } from '@/lib/copywriter/catalogos-server';
import { esIdPagina } from '@/lib/copywriter/tipos';
import { requireCopywriter } from '../acceso';
import { Copywriter } from '../Copywriter';
import { Pagina } from '@/app/_ui';
import { ESTILO_PAGINA_CREAR } from '@/app/_crear/reglas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function GuionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRolWs([], { nav: 'copywriter' });
  await requireCopywriter();
  const { id } = await params;
  if (!esIdPagina(id)) notFound();
  const [rAbrir, rListar, catalogos, ws] = await Promise.all([abrir(id), listar(), catalogosDelCopywriter(), getWorkspaceActual().catch(() => null)]);
  if (!rAbrir.ok && rAbrir.status === 404) notFound();
  // El shell único de Create (app/_crear/PantallaCrear.tsx) mide el alto de la <Pagina>, como Video y Offer.
  return (
    <Pagina ancho="completo" densidad="compacta" style={ESTILO_PAGINA_CREAR}>
      <Copywriter
        ws={ws}
        paginas={rListar.ok ? rListar.paginas : []}
        guion={rAbrir.ok ? { pagina: rAbrir.pagina, doc: rAbrir.doc } : null}
        error={rAbrir.ok ? null : rAbrir.error}
        catalogos={catalogos}
      />
    </Pagina>
  );
}
