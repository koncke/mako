// =============================================================================
// /partners — MaKo Partners: las cuentas de MaKo de los clientes de una agencia
// =============================================================================
// Martín, 17/10/2026: «diseña la tab de "MaKo Partners" con todo lo que habíamos dicho y planeado... Y ahí deberían
// vivir los clientes de agencia, que no son los mismos que "client": podrían serlo como no». El diseño, en
// docs/diseno-clients.md (D7-D9); el núcleo, en lib/partners.ts.
//
// QUIÉN ENTRA: el ADMIN de un workspace del programa (`esAgencia`: el super admin le puso el plan Agencia) y el super
// admin. Sin cliente, el super admin ve la lista de agencias del programa y entra a cada una con su `?ws=`. Cualquier
// otro va a /clients: una tab que no le toca no es un 404, es «acá no». Sólo el admin porque son los links de pago y la
// puerta a las cuentas de sus clientes; antes vivían en Clients, que la barra muestra sólo al admin.
//
// ⚠️ TODO VIENE CON EL HTML (la regla de Clients): la cartera, el cobro de cada cuenta y su equipo. La ficha de una
//    cuenta es un modal sin estado de carga.

import { redirect } from 'next/navigation';
import { requireSesion, guardOnboarding } from '@/lib/tab-access';
import { getWorkspaceActual, adminDeWorkspaceActual, estaImpersonando, rutaConWs } from '@/lib/workspace';
import { getSesionAdmin } from '@/lib/auth';
import { esAgencia } from '@/lib/agencia';
import { cuentasDePartner, partnersDeLaPlataforma } from '@/lib/partners';
import { PartnersApp, PartnersPlataforma } from './PartnersApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = { title: 'MaKo Partners' };

const VISTAS = ['clients', 'program'] as const;

export default async function PartnersPage({ searchParams }: { searchParams: Promise<{ tab?: string; cuenta?: string; nuevo?: string }> }) {
  await requireSesion();
  const sp = await searchParams;
  const esSuper = (await getSesionAdmin()) != null;
  const ws = await getWorkspaceActual();

  // El super admin sin cliente: la lista de agencias del programa.
  if (esSuper && !(await estaImpersonando())) {
    const partners = await partnersDeLaPlataforma().catch(() => null);
    return <PartnersPlataforma partners={partners} />;
  }
  // Cualquier negocio puede recomendar MaKo (23/10/2026): el admin que no es agencia va a su tablero de referidos.
  if (ws != null && !(await esAgencia(ws)) && (await adminDeWorkspaceActual()) != null) redirect(await rutaConWs('/partners/referidos'));
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
