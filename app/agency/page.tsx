// =============================================================================
// /agency — el panel de AGENCIA: las cuentas de MaKo de los clientes de una agencia (salió de /partners el 25/10/2026)
// =============================================================================
// Martín (25/10/2026): «Ser Agencia es muy diferente a Partner. Las agencias no ganan dinero con MaKo, porque sus clientes
// son suyos... quiero que crees otra tab abajo de "Partners" que sea "Agency Dashboard"». Esto es el panel que vivía en
// /partners (app/partners/PartnersApp.tsx, docs/diseno-clients.md D7-D9), mudado tal cual: el Agency Dashboard nuevo lo arma
// el chat «Agencias y clientes» encima de esta ruta. /partners es sólo el programa de referidos, y sus links viejos de
// agencia (`?cuenta=`, `?nuevo=` de la API `llevar_a_partners`, `?tab=`) llegan acá.
//
// QUIÉN ENTRA: el ADMIN de un workspace del programa (`esAgencia`: el super admin le puso el plan Agencia) y el super
// admin. Sin cliente, el super admin ve la lista de agencias y entra a cada una con su `?ws=`. Cualquier otro va a /clients.
//
// ⚠️ TODO VIENE CON EL HTML (la regla de Clients): la cartera, el cobro de cada cuenta y su equipo. La ficha de una cuenta es
//    un modal sin estado de carga.
// =============================================================================

import { redirect } from 'next/navigation';
import { requireSesion, guardOnboarding } from '@/lib/tab-access';
import { getWorkspaceActual, adminDeWorkspaceActual, estaImpersonando, rutaConWs } from '@/lib/workspace';
import { getSesionAdmin } from '@/lib/auth';
import { esAgencia } from '@/lib/agencia';
import { cuentasDePartner, partnersDeLaPlataforma } from '@/lib/partners';
import { AgenciasDeLaPlataforma, PartnersApp } from '@/app/partners/PartnersApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = { title: 'Agency Dashboard' };

const VISTAS = ['clients', 'program'] as const;

export default async function AgencyPage({ searchParams }: { searchParams: Promise<{ tab?: string; cuenta?: string; nuevo?: string }> }) {
  await requireSesion();
  const sp = await searchParams;
  const esSuper = (await getSesionAdmin()) != null;
  const ws = await getWorkspaceActual();

  // El super admin sin cliente: las agencias del programa.
  if (esSuper && !(await estaImpersonando())) {
    return <AgenciasDeLaPlataforma partners={await partnersDeLaPlataforma().catch(() => null)} />;
  }
  if (ws == null || !(await esAgencia(ws))) redirect(await rutaConWs('/clients'));
  const admin = (await adminDeWorkspaceActual()) != null;
  if (!admin && !esSuper) redirect(await rutaConWs('/clients'));
  // Como toda tab: con el onboarding sin terminar, primero el onboarding (lib/tab-access.ts).
  await guardOnboarding();

  const cartera = await cuentasDePartner(ws);
  const vista = (VISTAS as readonly string[]).includes(sp.tab ?? '') ? (sp.tab as (typeof VISTAS)[number]) : 'clients';
  const cuenta = /^[1-9]\d{0,11}$/.test(sp.cuenta ?? '') ? Number(sp.cuenta) : null;
  // `?nuevo=<leadId>`: el link que deja MaKo cuando propone llevar a un lead (la API, `llevar_a_partners`).
  const nuevo = /^[1-9]\d{0,11}$/.test(sp.nuevo ?? '') ? Number(sp.nuevo) : null;
  return (
    <PartnersApp
      cartera={cartera}
      vistaInicial={vista}
      cuentaInicial={cuenta}
      leadNuevo={nuevo}
      puedeAbrir={admin}
      superAdmin={esSuper}
    />
  );
}
