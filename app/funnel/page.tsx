// =============================================================================
// /funnel — editor del funnel (etapas + transiciones) que alimenta el CRM
// =============================================================================

import { getFunnel } from '@/lib/leads';
import { FunnelEditor } from './FunnelEditor';
import { EntradasCard } from './EntradasCard';
import { requireRolWs } from '@/lib/tab-access';
import { getDiagnosticoFase } from '@/lib/fase-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function FunnelPage() {
  await requireRolWs([], { nav: 'crm' });
  // La declaración de cómo ENTRA la gente va ARRIBA del editor, no abajo: es el
  // dato del que dependen los audios, el ensayo, las secuencias y el copy de las
  // landings, y es el que nadie sabía que faltaba. El recorrido (las etapas) se
  // edita después, y es lo que ya se sabía editar.
  const [{ pipeline, suppressed, entradas, evento }, diag] = await Promise.all([
    getFunnel(),
    getDiagnosticoFase().catch(() => null),
  ]);
  return (
    <FunnelEditor
      initialPipeline={pipeline}
      initialSuppressed={suppressed}
      encabezado={<EntradasCard initial={entradas} initialEvento={evento} canal={diag?.canal ?? null} />}
    />
  );
}
