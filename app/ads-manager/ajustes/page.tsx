// =============================================================================
// /ads-manager/ajustes — los Ajustes del Media Buyer (la página «AI Marketer settings» de Madgicx)
// =============================================================================
// La pantalla: app/ads-manager/Ajustes.tsx. Las mismas guardas que /ads-manager (la tab, el negocio elegido).
// =============================================================================

import '../mb-paleta.css';
import '../mb.css';
import { requireRolWs } from '@/lib/tab-access';
import { adsSinNegocio, wsDeAdsManager } from '@/lib/ads-guard';
import { Pagina } from '@/app/_ui/Pagina';
import { EmptyState, PermissionState } from '@/app/_ui/Estados';
import { leerConfig, cupoDe } from '@/lib/media-buyer/store';
import { modoEfectivo } from '@/lib/media-buyer/plan';
import { Ajustes } from '../Ajustes';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AjustesPage() {
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
  const [guardada, cupo] = await Promise.all([leerConfig(ws), cupoDe(ws)]);
  const config = { ...guardada, modo: modoEfectivo(guardada.modo, cupo) };
  return (
    <Pagina ancho="completo" style={{ padding: 0 }}>
      <Ajustes config={config} cupo={cupo} />
    </Pagina>
  );
}
