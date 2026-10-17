// =============================================================================
// /m/partners — MaKo Partners en el teléfono (la URL que se ve es /partners: LAS MISMAS RUTAS)
// =============================================================================
// Destila la tab de escritorio (app/partners/PartnersApp.tsx, docs/diseno-clients.md D7): la lista de las cuentas de
// MaKo de los clientes de la agencia, cada una con su estado y lo que espera de la agencia (pagar su primer mes,
// activar la renovación), y «+ Nuevo cliente». Pedir sumar gente a un equipo queda en la computadora.
//
// ⚠️ SIN `navKey`: la tab no la gatea una key de la barra sino el PROGRAMA (`esAgencia`), y lo pregunta acá, igual que
//    la página de escritorio. Quien no es agencia vuelve a Clients.

import './partners.css';
import { redirect } from 'next/navigation';
import { requireMovil } from '@/lib/movil-guard';
import { getWorkspaceActual, rutaConWs } from '@/lib/workspace';
import { esAgencia } from '@/lib/agencia';
import { cuentasDePartner } from '@/lib/partners';
import { ComputadoraM, ErrorM, PantallaM } from '@/app/m/_ui';
import { PartnersM } from './PartnersM';

export const dynamic = 'force-dynamic';

export default async function PartnersPagina() {
  await requireMovil();
  const ws = await getWorkspaceActual();
  if (ws == null || !(await esAgencia(ws))) redirect(await rutaConWs('/m/cs'));
  const cartera = await cuentasDePartner(ws);
  if (!cartera.ok) {
    return (
      <PantallaM>
        <ErrorM frase="No pudimos leer tus clientes. No es nada tuyo." />
      </PantallaM>
    );
  }
  return (
    <PantallaM>
      <PartnersM cuentas={cartera.cuentas} usd={cartera.precio.usd} />
      <ComputadoraM que="Sumar personas al equipo de una cuenta" />
    </PantallaM>
  );
}
