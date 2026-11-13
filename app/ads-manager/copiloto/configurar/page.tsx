// =============================================================================
// /ads-manager/copiloto/configurar — el piloto automático se configura la primera vez, en su pantalla (13/11/2026)
// =============================================================================
// Martín (13/11, vuelta 20): «el piloto se configura la primera vez, en la pantalla de configuraciones», con textos que se entiendan
// («¿cuánto subo por vez?», en cada campaña) y el costo por agenda ESCRITO. Lo de Anuncios es la configuración de verdad del Media
// Buyer (/api/media-buyer → `config`): el gasto del mes, el costo por resultado, cuánto sube por vez y qué hace solo cada táctica.
// La misma puerta que /ads-manager.
// =============================================================================

import '../../aa.css';
import { requireRolWs } from '@/lib/tab-access';
import { adsSinNegocio, wsDeAdsManager } from '@/lib/ads-guard';
import { Pagina } from '@/app/_ui/Pagina';
import { EmptyState, PermissionState } from '@/app/_ui/Estados';
import { leerConfig, cupoDe } from '@/lib/media-buyer/store';
import { resolverTacticas } from '@/lib/media-buyer/tacticas';
import { ConfigurarPiloto, type InicialPiloto } from './ConfigurarPiloto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ConfigurarPilotoPage() {
  await requireRolWs([], { nav: 'ads-manager' });
  if (await adsSinNegocio()) {
    return <Pagina><EmptyState titulo="Elige un negocio" detalle="El piloto trabaja sobre un negocio. Entra a uno desde el panel y vuelve aquí." accion={{ label: 'Ir al panel', href: '/admin' }} /></Pagina>;
  }
  const ws = await wsDeAdsManager();
  if (ws instanceof Response) return <Pagina><PermissionState motivo="rol" /></Pagina>;
  const [config, cupo] = await Promise.all([leerConfig(ws), cupoDe(ws)]);
  // Lo que vale hoy de cada táctica (el motor no viaja al navegador: se resuelve acá).
  const t = resolverTacticas(config.tacticas, { piloto: config.modo === 'piloto', pilotoPermitido: cupo.piloto });
  const inicial: InicialPiloto = {
    encendido: config.encendido, kpi: config.kpi, objetivo: config.objetivo, metaGastoMes: config.metaGastoMes, tacticas: config.tacticas,
    subida: Math.round(t.surf.p.subidaPct ?? config.subidaMaxPctDia),
    solo: { stop_loss: t.stop_loss.estado === 'automatica', surf: t.surf.estado === 'automatica', sunsetting: t.sunsetting.estado === 'automatica', ganador: t.ganador.estado === 'automatica' },
  };
  return (
    <Pagina ancho="completo" style={{ padding: 0 }}>
      <ConfigurarPiloto inicial={inicial} pilotoPermitido={cupo.piloto} />
    </Pagina>
  );
}
