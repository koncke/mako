// =============================================================================
// /m/agency — el panel de AGENCIA en el teléfono (la URL que se ve es /agency: LAS MISMAS RUTAS)
// =============================================================================
// Salió de /m/partners el 25/10/2026, como en la computadora (app/agency/page.tsx): MaKo Partners es el programa de
// referidos, y la cartera de la agencia es otra cosa (Martín: «Ser Agencia es muy diferente a Partner»). Destila el panel
// de escritorio (app/partners/PartnersApp.tsx, docs/diseno-clients.md D7): la lista de las cuentas de MaKo de los clientes de
// la agencia, cada una con su estado y lo que espera de la agencia, y «+ Nuevo cliente». La pantalla es la de siempre
// (app/m/partners/PartnersM.tsx, con su css): el Agency Dashboard nuevo lo arma el chat «Agencias y clientes».
//
// ⚠️ La puerta: la key `partners` de la fila de More (la misma de antes) y el rol (admin). Sólo una agencia del programa.

import '../partners/partners.css';
import { redirect } from 'next/navigation';
import { requireMovil } from '@/lib/movil-guard';
import { adminDeWorkspaceActual, getWorkspaceActual, rutaConWs } from '@/lib/workspace';
import { getSesionAdmin } from '@/lib/auth';
import { esAgencia } from '@/lib/agencia';
import { cuentasDePartner } from '@/lib/partners';
import { ComputadoraM, ErrorM, PantallaM } from '@/app/m/_ui';
import { PartnersM } from '../partners/PartnersM';

export const dynamic = 'force-dynamic';

export default async function AgencyPagina() {
  await requireMovil({ navKey: 'partners' });
  const ws = await getWorkspaceActual();
  if (ws == null) redirect(await rutaConWs('/m/cs'));
  if ((await adminDeWorkspaceActual()) == null && (await getSesionAdmin()) == null) redirect(await rutaConWs('/m/cs'));
  if (!(await esAgencia(ws).catch(() => false))) redirect(await rutaConWs('/m/partners'));
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
