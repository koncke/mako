// =============================================================================
// /crm/revisar/[id] — confirmar un lead que propuso un canal (mig 0128)
// =============================================================================
// La otra punta de la regla: Claude (o cualquier canal) deja una propuesta y manda el
// link acá. El dueño mira el dato, lo corrige si hace falta y confirma → recién ahí
// entra al CRM.
//
// Guard = cualquier sesión, y `getPropuesta` scopea al workspace del que mira: un
// cliente solo puede abrir SUS propuestas, y el id de otro simplemente no existe para
// él. Es el mismo criterio que /plan/revisar.
// =============================================================================

import { redirect } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { getPropuesta } from '@/lib/propuestas';
import { Pagina, PageHeader, Section } from '@/app/_ui';
import { RevisarLead } from './RevisarLead';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function RevisarLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await getUsuarioActual();
  if (!sesion) redirect('/inicio');

  const { id } = await params;
  const prop = await getPropuesta(id);

  // ── EL LINK LO TRANSCRIBE UN MODELO, ASÍ QUE PUEDE VENIR MAL ────────────────
  // No se muestra un 404 mudo: el que llega acá venía a confirmar algo y merece saber
  // si el link está mal escrito o si ya lo confirmó. Es la misma pantalla que
  // /plan/revisar tuvo que aprender.
  if (!prop || prop.tipo !== 'lead') {
    return (
      <Pagina>
        <PageHeader titulo="No encontramos esa propuesta" proposito="El link puede estar incompleto." />
        <Section titulo="Qué hacer">
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            Fijate que el link esté entero — a veces se corta al copiarlo de un chat. Si ya lo
            confirmaste, el lead está en tu <a href="/crm">CRM</a>.
          </p>
        </Section>
      </Pagina>
    );
  }

  return <RevisarLead prop={prop} />;
}
