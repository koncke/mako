// =============================================================================
// /crm/revisar/[id] — confirmar los contactos que propuso un canal (mig 0128)
// =============================================================================
// La otra punta de la regla: Claude (o cualquier canal) deja una propuesta y manda el
// link acá. El dueño ve la MISMA tabla que cuando importa un archivo, corrige lo que
// haga falta y confirma → recién ahí entran al CRM.
//
// Guard = cualquier sesión, y `getPropuesta` scopea al workspace del que mira. Cuando
// devuelve null hay DOS casos que se resuelven distinto y por eso se distinguen:
// el link vino mal escrito, o es de otra cuenta. Un 404 mudo los junta y deja al que
// mira sin saber qué hacer.

import { redirect } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { getPropuesta, duenoDePropuesta } from '@/lib/propuestas';
import { RevisarLead } from './RevisarLead';
import { NoEsTuyo } from './NoEsTuyo';
import { rutaConWs } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function RevisarLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await getUsuarioActual();
  if (!sesion) redirect(await rutaConWs('/inicio'));

  const { id } = await params;
  const prop = await getPropuesta(id);
  if (prop && prop.tipo === 'lead') return <RevisarLead prop={prop} />;

  // No es de este workspace (o no existe). Solo al super-admin se le dice de quién es y
  // se le ofrece pasar: para cualquier otro, saber que existe el borrador de otro
  // cliente ya sería más de lo que le corresponde.
  const dueno = await duenoDePropuesta(id);
  const esAdmin = sesion.rol === 'admin';
  return (
    <NoEsTuyo
      existe={!!dueno}
      deQuien={esAdmin ? (dueno?.nombre ?? '') : ''}
      wsDestino={esAdmin ? (dueno?.workspaceId ?? null) : null}
    />
  );
}
