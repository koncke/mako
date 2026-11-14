// =============================================================================
// /ads-manager/copiloto — el Marketing CoPilot nuevo: los dos pasos sobre las cinco tarjetas (12/11/2026)
// =============================================================================
// Martín (12/11, mirando la vuelta 18): «evidentemente que esté todo preparado para que en producción funcione, no solamente el
// frontend, sino que el backend se conecte perfecto con todo y que funcione realmente. Que el piloto automático funcione». Es la
// maqueta (docs/marketing-copilot/rediseno/maqueta-diecinueve.html) con los datos de verdad del negocio:
//   · Oferta y comunicación: las piezas de Offer, y Ángulos y Tu voz (lib/copiloto/comunicacion*.ts);
//   · Anuncios: los anuncios que más resultados trajeron, las tareas de la semana de su funnel, su VSL y el piloto del Media Buyer
//     (sus decisiones de verdad: aprobar, «No» y deshacer, por /api/media-buyer);
//   · Web, Instagram y YouTube: el análisis de la web y de la cuenta propia, la nevera y el piloto de cada red.
// Lo que lee está en ./cargar.ts, que comparte con el teléfono (app/m/ads/page.tsx). Desde el 14/11 el menú abre esta pantalla;
// /ads-manager (el Media Buyer de siempre) sigue abriendo. La misma puerta que /ads-manager.
// =============================================================================

import '../aa.css';
import { requireRolWs } from '@/lib/tab-access';
import { adsSinNegocio, wsDeAdsManager } from '@/lib/ads-guard';
import { Pagina } from '@/app/_ui/Pagina';
import { EmptyState, PermissionState } from '@/app/_ui/Estados';
import { CoPilot } from './CoPilot';
import { Entrada } from './Entrada';
import { cargarCoPilot, type PedidoCoPilot } from './cargar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CoPilotPage({ searchParams }: { searchParams: Promise<PedidoCoPilot> }) {
  await requireRolWs([], { nav: 'ads-manager' });
  if (await adsSinNegocio()) {
    return <Pagina><EmptyState titulo="Elige un negocio" detalle="El Marketing CoPilot trabaja sobre un negocio. Entra a uno desde el panel y vuelve aquí." accion={{ label: 'Ir al panel', href: '/admin' }} /></Pagina>;
  }
  const ws = await wsDeAdsManager();
  if (ws instanceof Response) return <Pagina><PermissionState motivo="rol" /></Pagina>;
  const c = await cargarCoPilot(ws, await searchParams);
  return (
    <Pagina ancho="completo" style={{ padding: 0 }}>
      {'entrada' in c
        ? <Entrada inicial={c.entrada.inicial} conexiones={c.entrada.conexiones} />
        : <CoPilot datos={c.copilot.datos} pasoInicial={c.copilot.paso} tarjetaInicial={c.copilot.tarjeta} />}
    </Pagina>
  );
}
