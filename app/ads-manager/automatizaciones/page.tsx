// =============================================================================
// /ads-manager/automatizaciones — las tácticas del Media Buyer como automatizaciones (el «Automation Overview» de Madgicx)
// =============================================================================
// La pantalla: app/ads-manager/Automatizaciones.tsx. Las mismas guardas que /ads-manager (la tab, el negocio elegido).
// =============================================================================

import '../mb-paleta.css';
import '../mb.css';
import { requireRolWs } from '@/lib/tab-access';
import { adsSinNegocio, wsDeAdsManager } from '@/lib/ads-guard';
import { Pagina } from '@/app/_ui/Pagina';
import { EmptyState, PermissionState } from '@/app/_ui/Estados';
import { leerConfig, leerDecisiones, cupoDe } from '@/lib/media-buyer/store';
import { modoEfectivo } from '@/lib/media-buyer/plan';
import { Automatizaciones } from '../Automatizaciones';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AutomatizacionesPage() {
  await requireRolWs([], { nav: 'ads-manager' });
  if (await adsSinNegocio()) {
    return (
      <Pagina>
        <EmptyState titulo="Elige un negocio" detalle="Las automatizaciones operan la cuenta de Meta de un negocio. Entra a uno desde el panel y vuelve aquí."
          accion={{ label: 'Ir al panel', href: '/admin' }} />
      </Pagina>
    );
  }
  const ws = await wsDeAdsManager();
  if (ws instanceof Response) return <Pagina><PermissionState motivo="rol" /></Pagina>;
  const [guardada, dec, cupo] = await Promise.all([leerConfig(ws), leerDecisiones(ws, 30), cupoDe(ws)]);
  const config = { ...guardada, modo: modoEfectivo(guardada.modo, cupo) };
  return (
    <Pagina ancho="completo" style={{ padding: 0 }}>
      <Automatizaciones config={config} decisiones={dec.decisiones} cupo={cupo} />
    </Pagina>
  );
}
