// =============================================================================
// /ads-manager/ajustes — los Ajustes del Media Buyer, con la densidad de «Hoy» y el molde de Settings de la casa
// =============================================================================
// La pantalla: app/ads-manager/Ajustes.tsx. Las mismas guardas que /ads-manager (la tab, el negocio elegido). El estilo es el de
// la tab (aa.css) y el molde de Settings (app/_ui/ajustes.css, global): mb.css se borró el 27/10/2026.
// =============================================================================

import '../aa.css';
import { requireRolWs } from '@/lib/tab-access';
import { adsSinNegocio, wsDeAdsManager } from '@/lib/ads-guard';
import { Pagina } from '@/app/_ui/Pagina';
import { EmptyState, PermissionState } from '@/app/_ui/Estados';
import { leerConfig, cupoDe } from '@/lib/media-buyer/store';
import { modoEfectivo } from '@/lib/media-buyer/plan';
import { leerPerfilCopiloto } from '@/lib/media-buyer/copiloto-store';
import { copilotoListo } from '@/lib/media-buyer/copiloto';
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
  const [guardada, cupo, perfil] = await Promise.all([leerConfig(ws), cupoDe(ws), leerPerfilCopiloto(ws)]);
  const config = { ...guardada, modo: modoEfectivo(guardada.modo, cupo) };
  return (
    <Pagina ancho="completo" style={{ padding: 0 }}>
      <Ajustes config={config} cupo={cupo} perfil={copilotoListo(perfil) ? perfil : null} />
    </Pagina>
  );
}
