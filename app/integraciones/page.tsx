// =============================================================================
// /integraciones — estado de todas las integraciones (antes "Estado de Meta")
// =============================================================================
// Overview de conexión de cada servicio + el detalle en vivo de Meta + el
// historial de estados negativos + el Saldo de IA.

import { Suspense } from 'react';
import { getMetaHealth, type MetaHealth } from '@/lib/meta-health';
import { getIntegraciones } from '@/lib/integraciones';
import { getHistorialMeta, registrarEstadoMeta, type MetaEstadoHist } from '@/lib/meta-health-history';
import { integracionConectada } from '@/lib/credenciales';
import { IntegracionesBoard } from './IntegracionesBoard';
import { GoogleCalendarPanel } from '../configuraciones/GoogleCalendarPanel';
import { requireRolWs } from '@/lib/tab-access';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function IntegracionesPage() {
  await requireRolWs([]);
  const integraciones = await getIntegraciones();
  let health: MetaHealth | null = null;
  let metaError: string | null = null;
  try {
    // No pegarle a Meta en vivo si el workspace no tiene Meta conectado: para un
    // cliente sin Meta tiraría "META_ACCESS_TOKEN no definida" y para un admin sin
    // impersonar mostraría el Meta del dueño. health=null → estado "sin conexión".
    const metaConectado = await integracionConectada('meta');
    health = metaConectado ? await getMetaHealth() : null;
    if (health) await registrarEstadoMeta(health.account); // registra si está negativo
  } catch (err) {
    metaError = err instanceof Error ? err.message : String(err);
  }
  const historial: MetaEstadoHist[] = await getHistorialMeta(20);
  return (
    <IntegracionesBoard
      integraciones={integraciones}
      health={health}
      metaError={metaError}
      historial={historial}
      // Google Calendar (OAuth propio) se renderiza dentro del board, al pie.
      googlePanel={<Suspense fallback={null}><GoogleCalendarPanel /></Suspense>}
    />
  );
}
