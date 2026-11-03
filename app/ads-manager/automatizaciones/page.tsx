// =============================================================================
// /ads-manager/automatizaciones — las tácticas del Media Buyer como automatizaciones, con la densidad de «Hoy» (27/10/2026)
// =============================================================================
// La pantalla: app/ads-manager/Automatizaciones.tsx. Las mismas guardas que /ads-manager (la tab, el negocio elegido). El estilo
// es el de la tab (aa.css) y el molde de Settings (app/_ui/ajustes.css, global): mb.css se borró el 27/10.
// `?t=<táctica>` abre su detalle (el lápiz del panel de agentes y la tuerca de una recomendación llevan ahí).
// =============================================================================

import '../aa.css';
import { requireRolWs } from '@/lib/tab-access';
import { adsSinNegocio, wsDeAdsManager } from '@/lib/ads-guard';
import { Pagina } from '@/app/_ui/Pagina';
import { EmptyState, PermissionState } from '@/app/_ui/Estados';
import { leerConfig, leerDecisiones, cupoDe } from '@/lib/media-buyer/store';
import { modoEfectivo } from '@/lib/media-buyer/plan';
import { ORDEN_TACTICAS, type TacticaAuto } from '@/lib/media-buyer/tacticas';
import { Automatizaciones } from '../Automatizaciones';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AutomatizacionesPage({ searchParams }: { searchParams: Promise<{ t?: string | string[] }> }) {
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
  const [guardada, dec, cupo, sp] = await Promise.all([leerConfig(ws), leerDecisiones(ws, 30), cupoDe(ws), searchParams]);
  const config = { ...guardada, modo: modoEfectivo(guardada.modo, cupo) };
  const abrir = typeof sp.t === 'string' && (ORDEN_TACTICAS as string[]).includes(sp.t) ? sp.t as TacticaAuto : null;
  return (
    <Pagina ancho="completo" style={{ padding: 0 }}>
      <Automatizaciones config={config} decisiones={dec.decisiones} cupo={cupo} abrir={abrir} />
    </Pagina>
  );
}
