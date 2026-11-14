// =============================================================================
// /ads-manager/copiloto/configurar — el piloto automático se configura la primera vez, en su pantalla (13/11/2026)
// =============================================================================
// Martín (13/11, vuelta 20): «el piloto se configura la primera vez, en la pantalla de configuraciones», con textos que se entiendan
// («¿cuánto subo por vez?», en cada campaña) y el costo por agenda ESCRITO. Lo de Anuncios es la configuración de verdad del Media
// Buyer (/api/media-buyer → `config`): el gasto del mes, el costo por resultado, cuánto sube por vez y qué hace solo cada táctica.
// Instagram y YouTube, desde el 14/11 (lib/copiloto/piloto-redes.ts). Lo que lee está en ./cargar.ts, que comparte con el teléfono.
// La misma puerta que /ads-manager.
// =============================================================================

import '../../aa.css';
import { requireRolWs } from '@/lib/tab-access';
import { adsSinNegocio, wsDeAdsManager } from '@/lib/ads-guard';
import { Pagina } from '@/app/_ui/Pagina';
import { EmptyState, PermissionState } from '@/app/_ui/Estados';
import { ConfigurarPiloto } from './ConfigurarPiloto';
import { cargarConfigurar } from './cargar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ConfigurarPilotoPage({ searchParams }: { searchParams: Promise<{ red?: string }> }) {
  await requireRolWs([], { nav: 'ads-manager' });
  if (await adsSinNegocio()) {
    return <Pagina><EmptyState titulo="Elige un negocio" detalle="El piloto trabaja sobre un negocio. Entra a uno desde el panel y vuelve aquí." accion={{ label: 'Ir al panel', href: '/admin' }} /></Pagina>;
  }
  const ws = await wsDeAdsManager();
  if (ws instanceof Response) return <Pagina><PermissionState motivo="rol" /></Pagina>;
  const props = await cargarConfigurar(ws, (await searchParams).red);
  return (
    <Pagina ancho="completo" style={{ padding: 0 }}>
      <ConfigurarPiloto {...props} />
    </Pagina>
  );
}
