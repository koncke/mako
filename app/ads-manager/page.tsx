// =============================================================================
// /ads-manager — el Media Buyer de MaKo (25/10/2026)
// =============================================================================
// Martín, 25/10/2026: «Implementalo end-to-end reemplazando lo que tenemos hoy en día en "ads manager", no tengas miedo
// en eliminar toda la vista actual... Quiero que sea una app de IA, como un media buyer de MaKo». La réplica de Meta Ads
// Manager que vivía acá (CampanasBrowser, NuevaCampanaModal y sus modales) se borró; lo que la reemplaza se copió de
// Madgicx · AI Marketer (docs/media-buyer/referencia.md). La pantalla es app/ads-manager/MediaBuyer.tsx.
//
// Quién: el admin del negocio, o el super admin mirándolo (`wsDeAdsManager`, el mismo guard que las escrituras).
// =============================================================================

import './mb.css';
import { requireRolWs } from '@/lib/tab-access';
import { adsSinNegocio, wsDeAdsManager } from '@/lib/ads-guard';
import { getUsuarioActual } from '@/lib/auth';
import { credWs } from '@/lib/credenciales';
import { Pagina } from '@/app/_ui/Pagina';
import { EmptyState, PermissionState } from '@/app/_ui/Estados';
import { leerConfig, leerDecisiones, cupoDe } from '@/lib/media-buyer/store';
import { modoEfectivo } from '@/lib/media-buyer/plan';
import { metasDelMes } from '@/lib/media-buyer/datos';
import { MediaBuyer } from './MediaBuyer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// El padding IZQUIERDO deja el lugar del chat de MaKo abierto (`--ancho-panel-mako`, como en el CRM).
const MARGEN_MAKO = { paddingLeft: 'calc(44px + var(--ancho-panel-mako, 0px))' } as const;

export default async function MediaBuyerPage({ searchParams }: { searchParams: Promise<{ decision?: string | string[] }> }) {
  await requireRolWs([], { nav: 'ads-manager' });
  // El super admin sin un negocio elegido no opera NINGUNA cuenta (17/10/2026): antes caía a la de Mauricio (ws1).
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

  const [yo, guardada, dec, metas, token, cupo] = await Promise.all([
    getUsuarioActual().catch(() => null),
    leerConfig(ws),
    leerDecisiones(ws, 30),
    metasDelMes(ws).catch(() => null),
    credWs('META_ACCESS_TOKEN', ws).catch(() => null),
    cupoDe(ws),
  ]);
  // El modo que VALE: un negocio en Esencial nunca ve el piloto prendido (lib/media-buyer/plan.ts → modoEfectivo).
  const config = { ...guardada, modo: modoEfectivo(guardada.modo, cupo) };
  const nombre = (yo?.nombre ?? '').trim().split(/\s+/)[0] || 'equipo';
  const sp = await searchParams;

  return (
    <Pagina style={MARGEN_MAKO}>
      <MediaBuyer nombre={nombre} inicial={{ config, decisiones: dec.decisiones, existeTabla: dec.existeTabla && config.existeTabla, cupo }} metas={metas} tieneMeta={!!token}
        decisionInicial={typeof sp.decision === 'string' && /^[0-9a-f-]{36}$/i.test(sp.decision) ? sp.decision : null} />
    </Pagina>
  );
}
