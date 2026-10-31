// =============================================================================
// /m/agency — Agency Dashboard en el teléfono (la URL que se ve es /agency: LAS MISMAS RUTAS)
// =============================================================================
// Destila la tab de escritorio (app/agency/page.tsx, 25/10/2026): la landing hasta que el negocio se suma (la misma, que
// en el teléfono se apila), y después las cuentas de MaKo de sus clientes con lo que espera cada una y «Nuevo cliente»
// con quién paga. Pedir sumar gente a un equipo queda en la computadora. Reemplaza el /m/agency provisorio de Planes
// (que montaba la cartera vieja de /m/partners).
//
// ⚠️ La puerta: la key `agency` de More (el admin de cualquier negocio, la misma regla que el menú de la foto) y el rol
//    (admin), que se pregunta acá igual que en escritorio. El cliente de una agencia no la ve (no hay promociones para él).

import './agency.css';
import { redirect } from 'next/navigation';
import { requireMovil } from '@/lib/movil-guard';
import { adminDeWorkspaceActual, estaImpersonando, getWorkspaceActual, rutaConWs } from '@/lib/workspace';
import { getSesionAdmin } from '@/lib/auth';
import { esClienteDeAgencia } from '@/lib/agencia';
import { cuentasDePartner, partnersDeLaPlataforma } from '@/lib/partners';
import { estadoAgency } from '@/lib/agency';
import { precioClienteDeAgencia } from '@/lib/agencia-cobro';
import { quienPagaSugerido } from '@/lib/agency-reglas';
import { CabeceraM, ComputadoraM, ErrorM, PantallaM } from '@/app/m/_ui';
import { RUTA_MAS } from '@/lib/movil-rutas';
import { LandingAgency } from '@/app/agency/LandingAgency';
import { AgencyM, AgenciasM } from './AgencyM';

export const dynamic = 'force-dynamic';

export default async function AgencyPagina({ searchParams }: { searchParams: Promise<{ landing?: string; cuenta?: string }> }) {
  await requireMovil({ navKey: 'agency' });
  const sp = await searchParams;
  const esSuper = (await getSesionAdmin()) != null;
  const precio = await precioClienteDeAgencia().catch(() => ({ usd: 47, mp: null }));

  // El super admin sin cliente: todas las agencias, como en la computadora.
  if (esSuper && !(await estaImpersonando())) {
    const agencias = await partnersDeLaPlataforma().catch(() => null);
    return (
      <PantallaM>
        <CabeceraM titulo="Agency Dashboard" padre={{ href: RUTA_MAS, label: 'More' }} />
        {agencias ? <AgenciasM agencias={agencias} /> : <ErrorM frase="No pudimos leer las agencias. No es nada tuyo." />}
      </PantallaM>
    );
  }

  const ws = await getWorkspaceActual();
  if (ws == null) redirect('/m');
  const admin = (await adminDeWorkspaceActual()) != null;
  if (!admin && !esSuper) redirect(await rutaConWs('/m'));
  // ⚠️ La misma puerta que en escritorio, y con la misma función: `esClienteDeAgencia`, no `agenciaDeCliente` (P15,
  //    30/10/2026 — ésa devuelve null con DOS dueños y dejaba entrar justo a ese cliente). El `!== false` es el que
  //    trata el «no pude leer» como «no entra»; ver app/agency/page.tsx.
  const deAgencia = await esClienteDeAgencia(ws);
  if (!esSuper && deAgencia !== false) redirect(await rutaConWs('/m'));

  const estado = await estadoAgency(ws);
  if (!estado.esAgency || sp.landing === '1') {
    return (
      <PantallaM>
        <CabeceraM titulo="Agency Dashboard" padre={{ href: RUTA_MAS, label: 'More' }} />
        <LandingAgency estado={estado} usd={precio.usd} volver="/agency" sinMarco />
      </PantallaM>
    );
  }

  const cartera = await cuentasDePartner(ws);
  if (!cartera.ok) {
    return (
      <PantallaM>
        <CabeceraM titulo="Agency Dashboard" padre={{ href: RUTA_MAS, label: 'More' }} />
        <ErrorM frase="No pudimos leer tus clientes. No es nada tuyo." />
      </PantallaM>
    );
  }
  const cuenta = /^[1-9]\d{0,11}$/.test(sp.cuenta ?? '') ? Number(sp.cuenta) : null;
  return (
    <PantallaM>
      <AgencyM cuentas={cartera.cuentas} usd={cartera.precio.usd} pagaSugerida={quienPagaSugerido(estado.perfil)}
        puedeAbrir={admin} superAdmin={esSuper} cuentaInicial={cuenta} />
      <ComputadoraM que="Sumar personas al equipo de una cuenta" />
    </PantallaM>
  );
}
