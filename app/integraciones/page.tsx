// =============================================================================
// /integraciones — estado de todas las integraciones (antes "Estado de Meta")
// =============================================================================
// Overview de conexión de cada servicio + el detalle en vivo de Meta + el Saldo
// de IA. El detalle por campaña/conjunto/anuncio vive en Ads Manager.

import { getMetaHealth, type MetaHealth } from '@/lib/meta-health';
import { getIntegraciones } from '@/lib/integraciones';
import { IntegracionesBoard } from './IntegracionesBoard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function IntegracionesPage() {
  const integraciones = getIntegraciones();
  let health: MetaHealth | null = null;
  let metaError: string | null = null;
  try {
    health = await getMetaHealth();
  } catch (err) {
    metaError = err instanceof Error ? err.message : String(err);
  }
  return <IntegracionesBoard integraciones={integraciones} health={health} metaError={metaError} />;
}
