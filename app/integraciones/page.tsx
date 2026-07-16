// =============================================================================
// /integraciones — estado de todas las integraciones (antes "Estado de Meta")
// =============================================================================
// Overview de conexión de cada servicio + el detalle en vivo de Meta + el
// historial de estados negativos + el Saldo de IA.

import { getMetaHealth, type MetaHealth } from '@/lib/meta-health';
import { getIntegraciones } from '@/lib/integraciones';
import { reconciliarIncidentes, problemaMeta, getIncidentes, type ProblemaActual, type Incidente } from '@/lib/meta-health-history';
import { integracionConectada } from '@/lib/credenciales';
import { IntegracionesBoard } from './IntegracionesBoard';
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
  } catch (err) {
    metaError = err instanceof Error ? err.message : String(err);
  }

  // Reconciliar los incidentes (con inicio/fin) contra el estado actual: Meta
  // (estado en vivo) + los servicios que están en 'falta' de configuración. El
  // scope cubre todos esos servicios para que se cierren los que ya se resolvieron.
  const problemas: ProblemaActual[] = [];
  const pMeta = problemaMeta(health?.account ?? null, metaError);
  if (pMeta) problemas.push(pMeta);
  for (const i of integraciones) {
    if (i.key === 'meta') continue; // Meta lo cubre problemaMeta (estado en vivo)
    if (i.estado === 'falta') problemas.push({ service: i.key, severidad: 'ambar', statusLabel: 'Por configurar', disableReason: null, entregaFrenada: false, balanceMxn: null, detalle: i.detalle });
  }
  const scope = ['meta', ...integraciones.filter((i) => i.key !== 'meta').map((i) => i.key)];
  await reconciliarIncidentes(problemas, scope);
  const incidentes: Incidente[] = await getIncidentes(30);

  return (
    <IntegracionesBoard
      integraciones={integraciones}
      health={health}
      metaError={metaError}
      incidentes={incidentes}
    />
  );
}
