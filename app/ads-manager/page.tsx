// =============================================================================
// /ads-manager — el Media Buyer de MaKo (25/10/2026)
// =============================================================================
// Martín, 25/10/2026: «Implementalo end-to-end reemplazando lo que tenemos hoy en día en "ads manager", no tengas miedo
// en eliminar toda la vista actual... Quiero que sea una app de IA, como un media buyer de MaKo». La réplica de Meta Ads
// Manager que vivía acá (CampanasBrowser, NuevaCampanaModal y sus modales) se borró. Desde el 25/10 ~18:50 la estructura es
// la de AdAmigo (Martín: «Me gusta el de "AdAmigo" implementalo de punta en punta»; docs/media-buyer/referencias/adamigo/).
// La pantalla es app/ads-manager/MediaBuyer.tsx.
//
// Quién: el admin del negocio, o el super admin mirándolo (`wsDeAdsManager`, el mismo guard que las escrituras).
// =============================================================================

import './aa.css';
import { requireRolWs } from '@/lib/tab-access';
import { adsSinNegocio, wsDeAdsManager } from '@/lib/ads-guard';
import { getUsuarioActual } from '@/lib/auth';
import { credWs } from '@/lib/credenciales';
import { Pagina } from '@/app/_ui/Pagina';
import { EmptyState, PermissionState } from '@/app/_ui/Estados';
import { leerConfig, leerDecisiones, cupoDe } from '@/lib/media-buyer/store';
import { modoEfectivo } from '@/lib/media-buyer/plan';
import { metasDelMes } from '@/lib/media-buyer/datos';
import { vistaMediaBuyer } from '@/lib/media-buyer/vista';
import { leerPerfilCopiloto } from '@/lib/media-buyer/copiloto-store';
import { copilotoListo, aplicarCambio } from '@/lib/media-buyer/copiloto';
import { MediaBuyer } from './MediaBuyer';
import { PrimeraEntrada } from './PrimeraEntrada';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// La página no pone su aire ni su ancho máximo: los pone aa.css (también el lugar del chat de MaKo abierto, `--ancho-panel-mako`).
const A_SANGRE = { padding: 0 } as const;

export default async function MediaBuyerPage({ searchParams }: { searchParams: Promise<{ estrategia?: string | string[]; decision?: string | string[]; producto?: string | string[]; vista?: string | string[] }> }) {
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

  const [yo, guardada, dec, metas, token, cupo, perfil] = await Promise.all([
    getUsuarioActual().catch(() => null),
    leerConfig(ws),
    leerDecisiones(ws, 30),
    metasDelMes(ws).catch(() => null),
    credWs('META_ACCESS_TOKEN', ws).catch(() => null),
    cupoDe(ws),
    leerPerfilCopiloto(ws),
  ]);
  // El modo que VALE: un negocio en Esencial nunca ve el piloto prendido (lib/media-buyer/plan.ts → modoEfectivo).
  const config = { ...guardada, modo: modoEfectivo(guardada.modo, cupo) };
  const nombre = (yo?.nombre ?? '').trim().split(/\s+/)[0] || 'equipo';
  // LA PRIMERA ENTRADA (6/11/2026): quien nunca trabajó con el Media Buyer (sin corrida, sin decisiones, sin piloto) y no terminó
  // la charla ve SÓLO esa charla. Quien ya operaba no la ve: su pantalla no cambia (se la ofrece Ajustes → «Tu estrategia»).
  const sp = await searchParams;
  const primera = !copilotoListo(perfil) && !guardada.encendido && !guardada.ultimaCorrida && dec.decisiones.length === 0;
  // `?estrategia=1` (Ajustes → «Tu estrategia»): vuelve a la propuesta con lo ya respondido, para discutirla o cambiarla.
  if (primera || sp.estrategia === '1') {
    return <Pagina ancho="completo" style={A_SANGRE}><PrimeraEntrada nombre={nombre} inicial={aplicarCambio(perfil, { aceptado: undefined })} /></Pagina>;
  }
  const vista = await vistaMediaBuyer(ws, config.kpi, config.objetivo);

  return (
    <Pagina ancho="completo" style={A_SANGRE}>
      <MediaBuyer nombre={nombre} inicial={{ config, decisiones: dec.decisiones, existeTabla: dec.existeTabla && config.existeTabla, cupo }} metas={metas} tieneMeta={!!token}
        arranque={vista.arranque} productoDe={vista.productoDe} mejores={vista.mejores} agentes={vista.agentes}
        decisionInicial={typeof sp.decision === 'string' && /^[0-9a-f-]{36}$/i.test(sp.decision) ? sp.decision : null}
        vistaInicial={sp.vista === 'campanas' || sp.vista === 'biblioteca' ? sp.vista : sp.vista === 'hoy' || sp.vista === 'autopilot' || sp.vista === 'resumen' ? 'hoy' : null}
        productoInicial={typeof sp.producto === 'string' && /^(\d{1,12}|sin)$/.test(sp.producto) ? sp.producto : null} />
    </Pagina>
  );
}
