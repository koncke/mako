// =============================================================================
// /agency — Agency Dashboard: la landing para sumarse como Agency y, ya sumada, las cuentas de MaKo de sus clientes
// =============================================================================
// Martín, 25/10/2026 (docs/feedback-25-10-tarde.md punto 9): «crees otra tab abajo de "Partners" que sea "Agency
// Dashboard". Que sea la misma metodología que este, que tengas la "landing" y que te puedas sumar como "Agency", solo
// para los que tengan su plan de 97 activo... Pon el dashboard de "Agencia" allí, con todos los clientes de Codigo allí
// también... Y que salga de la vista de "clientes" actuales». La cartera vivía en /partners (PartnersApp); Partners quedó
// para los referidos. Las reglas, en lib/agency-reglas.ts; el núcleo, en lib/agency.ts y lib/partners.ts.
//
// QUIÉN VE QUÉ:
//   · el super admin sin cliente: TODAS las agencias, y entra a cada una con su `?ws=` (`?landing=1`: la landing);
//   · el ADMIN de un negocio que no se sumó (o con `?landing=1`, el botón «Ver la landing» del dashboard): la landing,
//     con «Sumarme como Agency» si tiene el plan Pro activo, y si no, por qué no;
//   · el admin de una Agency (y el super admin parado en ella): su dashboard;
//   · un CLIENTE de una agencia no la ve («MaKo no les va a enviar promociones»): va a /inicio, como el closer y el setter.
// ⚠️ TODO VIENE CON EL HTML (la regla de Clients): la cartera, el cobro y el equipo de cada cuenta. La ficha es un modal
//    sin estado de carga.

import { redirect } from 'next/navigation';
import { requireSesion, guardOnboarding } from '@/lib/tab-access';
import { getWorkspaceActual, adminDeWorkspaceActual, estaImpersonando, rutaConWs } from '@/lib/workspace';
import { getSesionAdmin } from '@/lib/auth';
import { esClienteDeAgencia } from '@/lib/agencia';
import { cuentasDePartner, partnersDeLaPlataforma } from '@/lib/partners';
import { estadoAgency } from '@/lib/agency';
import { precioClienteDeAgencia } from '@/lib/agencia-cobro';
import { mensualidadDeAgencia, mensualidadPrendida, paraLaPantalla } from '@/lib/agencia-mes';
import { AgencyApp, AgencyPlataforma } from './AgencyApp';
import { LandingAgency } from './LandingAgency';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = { title: 'Agency Dashboard' };

const ID = /^[1-9]\d{0,11}$/;

export default async function AgencyPage({ searchParams }: { searchParams: Promise<{ landing?: string; cuenta?: string; nuevo?: string; vista?: string }> }) {
  await requireSesion();
  const sp = await searchParams;
  const esSuper = (await getSesionAdmin()) != null;
  const verLanding = sp.landing === '1';
  const precio = await precioClienteDeAgencia().catch(() => ({ usd: 47, mp: null }));

  // El super admin sin cliente: todas las agencias (y la landing, como la ven los clientes, con su botón).
  if (esSuper && !(await estaImpersonando())) {
    if (verLanding) return <LandingAgency estado={null} usd={precio.usd} volver="/agency" />;
    const agencias = await partnersDeLaPlataforma().catch(() => null);
    return <AgencyPlataforma agencias={agencias} usd={precio.usd} />;
  }

  const ws = await getWorkspaceActual();
  if (ws == null) redirect('/inicio');
  const admin = (await adminDeWorkspaceActual()) != null;
  if (!admin && !esSuper) redirect(await rutaConWs('/inicio'));
  // Como toda tab: con el onboarding sin terminar, primero el onboarding (lib/tab-access.ts).
  await guardOnboarding();
  // El cliente de una agencia no ve el programa: sus cuentas las maneja su agencia, y MaKo no le ofrece nada.
  // ⚠️ `esClienteDeAgencia` Y NO `agenciaDeCliente` (P15, 30/10/2026). La segunda contesta QUIÉN es el dueño, así que
  //    necesita que haya exactamente uno: con DOS dueños aprobados devuelve null a propósito, y acá ese null se leía
  //    como «no es cliente de ninguna agencia» — o sea que el cliente con dos agencias era el único que entraba.
  // ⚠️ Y SE COMPARA CONTRA `false`, no por verdad: `null` es «no pude leer la cartera», que no es «no». Fail-closed,
  //    como todo este módulo (lib/agencia.ts): si no se puede preguntar, acá no se entra. Un `if (deAgencia)` vuelve a
  //    leer el «no sé» como «no», que es el molde exacto del bug.
  const deAgencia = await esClienteDeAgencia(ws);
  if (!esSuper && deAgencia !== false) redirect(await rutaConWs('/inicio'));

  const estado = await estadoAgency(ws);
  if (!estado.esAgency || verLanding) {
    return <LandingAgency estado={estado} usd={precio.usd} volver="/agency" />;
  }

  // LA MENSUALIDAD (Martín, 5/11/2026, lib/agencia-mes.ts): la agencia la ve si está prendida; el super admin parado
  // en ella, siempre (desde ahí la prende). Apagada, la agencia sigue con el cobro por pasarela de siempre.
  // `null` de `mensualidadPrendida` es «no pude leer»: se muestra la mensualidad, que dice el error, en vez de esconderla.
  // Arranca antes que la cartera y corre a la par (ninguna de las dos tira).
  const mensualidadP = (esSuper ? Promise.resolve(true) : mensualidadPrendida(ws)).then((ver) => (ver !== false ? mensualidadDeAgencia(ws).then(paraLaPantalla) : null));
  const cartera = await cuentasDePartner(ws);
  const mensualidad = await mensualidadP;
  const cuenta = ID.test(sp.cuenta ?? '') ? Number(sp.cuenta) : null;
  // `?nuevo=<leadId>`: el link que deja MaKo cuando propone llevar a un lead (la API, `llevar_a_partners`).
  const nuevo = ID.test(sp.nuevo ?? '') ? Number(sp.nuevo) : null;
  return (
    <AgencyApp
      cartera={cartera}
      cuentaInicial={cuenta}
      leadNuevo={nuevo}
      puedeAbrir={admin}
      superAdmin={esSuper}
      perfil={estado.perfil}
      mensualidad={mensualidad}
      verMensualidad={sp.vista === 'mensualidad'}
    />
  );
}
