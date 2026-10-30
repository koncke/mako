// =============================================================================
// /copywriter/<id> — una página abierta: MaKo a la izquierda y la página al lado (docs/diseno-copywriter.md, D15)
// =============================================================================
// LA PUERTA son dos (las de app/ai-avatar): `requireRolWs([], { nav: 'copywriter' })` (el admin del negocio, la tab en su
// capa) y `requireCopywriter()` (desde el 29/10/2026, toda persona con sesión: ./acceso.ts).
// EL GUION se lee con `abrir` (lib/copywriter/server.ts), que mira el negocio de la pestaña: uno de OTRO negocio contesta
// «No existe» y acá es un 404 de verdad. Un fallo de lectura (la base) NO es un 404: la pantalla lo dice.
// Sin loading.tsx: el shell de Create mide el alto de la <Pagina>.
// =============================================================================

import { notFound } from 'next/navigation';
import { requireRolWs } from '@/lib/tab-access';
import { getWorkspaceActual } from '@/lib/workspace';
import { abrir, listar } from '@/lib/copywriter/server';
import { catalogosDelCopywriter, ofertasDelCopywriter } from '@/lib/copywriter/catalogos-server';
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
  const [rAbrir, rListar, catalogos, ws, ofertas] = await Promise.all([abrir(id), listar(), catalogosDelCopywriter(), getWorkspaceActual().catch(() => null), ofertasDelCopywriter()]);
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
        ofertas={ofertas}
      />
    </Pagina>
  );
}
