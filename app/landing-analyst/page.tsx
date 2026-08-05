// =============================================================================
// /landing-analyst — Landing Analyst
// =============================================================================
// MaKo baja la landing del cliente, le lee el copy y lo cruza con el
// comportamiento real de esa misma URL (visitas y retención del beacon, agendas
// del CRM) para decir qué cambiar y por qué. La data vive en landing_analyses
// (la llenan /api/landing-analyst/{analyze,sync}); esta página solo lee.
//
// A diferencia de Closing (que sin Fathom no tiene NADA que mostrar), acá no se
// gatea por integración: con pegar una URL alcanza para tener el diagnóstico del
// copy. El seguimiento agrega el cruce con comportamiento, y cuando falta, la
// tab lo dice adentro, en el bloque que lo necesita.
// =============================================================================

import { getLandingViewData, type LandingViewData } from '@/lib/landing-analyst';
import { LandingAnalystApp } from './LandingAnalystApp';
import { requireRolWs } from '@/lib/tab-access';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const EMPTY: LandingViewData = {
  landings: [],
  sinAnalizar: [],
  kpis: { total: 0, conError: 0, scorePromedio: null, hallazgosAltos: 0 },
  lastSync: null,
};

export default async function LandingAnalystPage() {
  await requireRolWs([], { nav: 'landing-an' });

  let data: LandingViewData = EMPTY;
  let errorMsg: string | null = null;
  try {
    data = await getLandingViewData();
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  return <LandingAnalystApp data={data} errorMsg={errorMsg} />;
}
