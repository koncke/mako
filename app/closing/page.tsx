// =============================================================================
// /closing — Closing Analyst
// =============================================================================
// Trae las llamadas históricas de Fathom (vía el sync), las matchea con los
// leads del CRM y analiza el desempeño del closer en las de VENTA (R1/R2) —
// Método SPIN, propuesta, objeciones y CTA. Las llamadas de ENTREGA DE SERVICIO
// (coaching/accountability con clientes ya cerrados), internas y de prueba se
// detectan y se EXCLUYEN del análisis (se cuentan aparte).
//
// La data vive en closing_analyses (la llena /api/closing/sync + el cron). Esta
// página solo lee; el componente cliente dispara el sync y muestra el detalle.
// =============================================================================

import { getClosingViewData, type ClosingViewData } from '@/lib/closing';
import { ClosingBrowser } from './ClosingBrowser';
import { requireRolWs } from '@/lib/tab-access';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const EMPTY: ClosingViewData = {
  calls: [],
  counts: { ventas: 0, servicio: 0, internas: 0, test: 0, errores: 0, pendientes: 0, total: 0 },
  kpis: { scorePromedio: null, conScore: 0, ganadas: 0, r1Prom: null, r2Prom: null },
  lastSync: null,
};

export default async function ClosingPage() {
  await requireRolWs(['closer']);
  let data: ClosingViewData = EMPTY;
  let errorMsg: string | null = null;
  try {
    data = await getClosingViewData();
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  return <ClosingBrowser data={data} errorMsg={errorMsg} />;
}
