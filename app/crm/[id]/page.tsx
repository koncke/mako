// =============================================================================
// /crm/[id] — detalle del lead en tabs: Resumen / Tracking / Reuniones / …
// =============================================================================
// Header fijo (etapa, nombre, acciones rápidas) + tabs. ⚠️ YA NO HAY MODO EDICIÓN:
// cada dato se corrige donde se lee (ver `app/crm/campo-inline.ts`). `?edit=1` abre
// el editor del DEAL, que es lo único que sigue teniendo pantalla propia.
//
// ⚠️ ESTA PANTALLA ES LA MISMA FICHA QUE EL POP-UP DEL TABLERO, Y DESDE EL 14/10/2026 LEE LO MISMO:
// `getLeadFullAction`, la lectura del pop-up, y monta las MISMAS tabs (`FichaPorBloques`, adentro de
// LeadDetailBody). Hasta ese día armaba todo a mano —las tabs, las tarjetas y los datos— y ya se había
// separado: «N sin marcar» se contaba sin `grabable` y con el plan como `true | undefined`, así que el
// Fathom y el plan podían dar distinto que en el tablero. No es una pantalla muerta: se llega desde el
// WhatsApp que avisa de un lead nuevo de la landing (`app/api/track/optin/route.ts`), desde el Closing
// Analyst y desde «Solucionar». Lo fija tests/ficha-armador.test.ts.

import { notFound } from 'next/navigation';
import { guardOnboarding, requireCapa } from '@/lib/tab-access';
import { LeadDetailBody, BackButton } from './LeadDetailBody';
import { ANCHO_FICHA_LEAD } from '../lead-view/ficha-medidas';
import { getLeadFullAction } from '../actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LeadDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; edit?: string; solucionar?: string }> }) {
  await requireCapa('crm');
  await guardOnboarding();
  const [{ id: idStr }, { tab, edit, solucionar }] = await Promise.all([params, searchParams]);
  const idNum = Number(idStr);
  if (!Number.isFinite(idNum)) notFound();

  const data = await getLeadFullAction(idNum);
  if (!data) notFound();

  return (
    <main className="crm-hover" style={{ minHeight: '100vh', width: '100%', background: 'var(--bg)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", padding: 'clamp(20px,4vw,44px)' }}>
      {/* El mismo ancho que el pop-up del tablero (punto 14, lead-view/ficha-medidas.ts): es la misma
          ficha por otra puerta. */}
      <div style={{ maxWidth: ANCHO_FICHA_LEAD, margin: '0 auto' }}>
        <BackButton />
        <LeadDetailBody data={data} initialTab={tab} initialEdit={edit === '1'} initialSolucionar={solucionar === '1'} />
      </div>
    </main>
  );
}
