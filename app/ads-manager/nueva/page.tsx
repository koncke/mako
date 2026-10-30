// =============================================================================
// /ads-manager/nueva — «Nueva campaña» del Media Buyer (29/10/2026)
// =============================================================================
// La pantalla: app/ads-manager/NuevaCampana.tsx. Las mismas guardas que /ads-manager/ajustes (la tab, el negocio elegido, el
// admin del negocio: `wsDeAdsManager`).
// =============================================================================

import '../mb-paleta.css';
import '../mb.css';
import { requireRolWs } from '@/lib/tab-access';
import { adsSinNegocio, wsDeAdsManager } from '@/lib/ads-guard';
import { Pagina } from '@/app/_ui/Pagina';
import { EmptyState, PermissionState } from '@/app/_ui/Estados';
import { NuevaCampana } from '../NuevaCampana';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function NuevaCampanaPage() {
  await requireRolWs([], { nav: 'ads-manager' });
  if (await adsSinNegocio()) {
    return (
      <Pagina>
        <EmptyState titulo="Elige un negocio" detalle="El Media Buyer opera la cuenta de Meta de un negocio. Entra a uno desde el panel y vuelve aquí."
          accion={{ label: 'Ir al panel', href: '/admin' }} />
      </Pagina>
    );
  }
  const ws = await wsDeAdsManager();
  if (ws instanceof Response) return <Pagina><PermissionState motivo="rol" /></Pagina>;
  return (
    <Pagina ancho="completo" style={{ padding: 0 }}>
      <NuevaCampana />
    </Pagina>
  );
}
