// =============================================================================
// /m/partners — MaKo Partners en el teléfono (la URL que se ve es /partners: LAS MISMAS RUTAS)
// =============================================================================
// Destila la tab de escritorio (app/partners/PartnersApp.tsx, docs/diseno-clients.md D7): la lista de las cuentas de
// MaKo de los clientes de la agencia, cada una con su estado y lo que espera de la agencia (pagar su primer mes,
// activar la renovación), y «+ Nuevo cliente». Pedir sumar gente a un equipo queda en la computadora.
//
// ⚠️ La puerta: la key `partners` de la fila de More (desde el 24/10/2026, el admin de CUALQUIER negocio, la misma regla
//    que la barra) y el rol (admin), que se pregunta acá igual que en la página de escritorio. Después reparte el
//    PROGRAMA (`esAgencia`): la agencia ve su cartera; el resto, su tablero de referidos (ReferidosM.tsx).

import './partners.css';
import { redirect } from 'next/navigation';
import { requireMovil } from '@/lib/movil-guard';
import { adminDeWorkspaceActual, getWorkspaceActual, rutaConWs } from '@/lib/workspace';
import { getSesionAdmin } from '@/lib/auth';
import { esAgencia } from '@/lib/agencia';
import { cuentasDePartner } from '@/lib/partners';
import { ComputadoraM, ErrorM, PantallaM } from '@/app/m/_ui';
import { PartnersM } from './PartnersM';
import { ReferidosM } from './ReferidosM';
import { tableroDe } from '@/lib/partners-programa';

export const dynamic = 'force-dynamic';

export default async function PartnersPagina() {
  // La key de la fila de More (17/10/2026, jefe «Sidebar»): el admin de un workspace agencia, la misma regla que la barra.
  await requireMovil({ navKey: 'partners' });
  const ws = await getWorkspaceActual();
  if (ws == null) redirect(await rutaConWs('/m/cs'));
  // Sólo el admin, como en la computadora (app/partners/page.tsx).
  if ((await adminDeWorkspaceActual()) == null && (await getSesionAdmin()) == null) redirect(await rutaConWs('/m/cs'));
  // El negocio que NO es agencia (24/10/2026: la fila la ve el admin de cualquier negocio): su tablero de referidos,
  // como /partners/referidos en la computadora. La agencia sigue con su cartera.
  if (!(await esAgencia(ws))) {
    const tablero = await tableroDe(ws).catch(() => null);
    return (
      <PantallaM>
        {tablero ? <ReferidosM tablero={tablero} /> : <ErrorM frase="No pudimos leer tu tablero. No es nada tuyo." />}
      </PantallaM>
    );
  }
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
