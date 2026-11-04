// =============================================================================
// /m/partners — MaKo Partners en el teléfono (la URL que se ve es /partners: LAS MISMAS RUTAS)
// =============================================================================
// Lo mismo que la computadora (app/partners/page.tsx, 25/10/2026): el programa de referidos.
//   · el super admin sin cliente: el programa (ProgramaM; «Marcar pagado», en la computadora);
//   · el ADMIN de un negocio que no se hizo partner: la landing (la misma, que en el teléfono se apila) con «Hacerme
//     partner», y con `?alta=1` el onboarding corto (AltaPartner, el mismo);
//   · el partner: su panel (ReferidosM), y la landing con `?landing=1`.
// La cartera de una AGENCIA salió de acá: es /m/agency (app/m/agency). Un `?cuenta=` viejo lleva allá.
//
// ⚠️ La puerta: la key `partners` de la fila de More (el admin de CUALQUIER negocio, la misma regla que la barra) y el rol
//    (admin), que se pregunta acá igual que en la página de escritorio.
//
// ⚠️ HOY NO SE DIBUJA EN NINGÚN TELÉFONO (4/11/2026, Martín): vuelve a More antes de leer nada (`esTabQueVende`,
//    lib/tienda.ts). En la clasificación de edad de Google Play se contestó que la app no da premios en dinero, y este panel
//    dice «Ya cobraste». Android no se distingue de Chrome, así que sale de todos (hasta ese día, sólo de la app de iPhone).
//    Lo de abajo queda para el día que vuelva: sacar `partners` de `TABS_QUE_VENDEN` la devuelve. La computadora no cambia.

import './partners.css';
import { redirect } from 'next/navigation';
import { requireMovil } from '@/lib/movil-guard';
import { adminDeWorkspaceActual, estaImpersonando, getWorkspaceActual, rutaConWs, wsSuperAdmin } from '@/lib/workspace';
import { esClienteDeAgencia } from '@/lib/agencia';
import { getSesionAdmin } from '@/lib/auth';
import { esAgencia } from '@/lib/agencia';
import { getSupabaseServer } from '@/lib/supabase';
import { CabeceraM, ErrorM, PantallaM } from '@/app/m/_ui';
import { ProgramaM, ReferidosM } from './ReferidosM';
import { altaDePartner, resumenDelPrograma, tableroDe } from '@/lib/partners-programa';
import { RUTA_ALTA_PARTNERS, RUTA_PARTNERS } from '@/lib/partners-reglas';
import { RUTA_MAS } from '@/lib/movil-rutas';
import { esTabQueVende } from '@/lib/tienda';
import { LandingPartners } from '@/app/mako-partners/LandingPartners';
import { AltaPartner } from '@/app/partners/AltaPartner';
import { ofertasDeLosPlanes } from '@/lib/compra-plan';
import { EMAIL_MAKO } from '@/lib/app-url';

export const dynamic = 'force-dynamic';

const cobraEnLinea = () => ofertasDeLosPlanes().then((o) => o.some((x) => x.cobrable)).catch(() => true);

export default async function PartnersPagina({ searchParams }: { searchParams: Promise<{ alta?: string; landing?: string; cuenta?: string }> }) {
  await requireMovil({ navKey: 'partners' });
  // En ningún teléfono: es un programa para vender MaKo a otros (T5, lib/tienda.ts). Esta página sólo la ve un teléfono.
  if (esTabQueVende('partners')) redirect(await rutaConWs(RUTA_MAS));
  const sp = await searchParams;
  const ws = await getWorkspaceActual();
  if (ws == null) redirect(await rutaConWs('/m/cs'));
  const esSuper = (await getSesionAdmin()) != null;
  // Sólo el admin, como en la computadora (app/partners/page.tsx).
  if ((await adminDeWorkspaceActual()) == null && !esSuper) redirect(await rutaConWs('/m/cs'));
  // El cliente de una AGENCIA no ve MaKo Partners (29/10/2026), como en la computadora.
  // ⚠️ Comparado contra `false` (P15, 30/10/2026): es una PUERTA, y el `null` («no pude leer la cartera») no entra.
  const deAgencia = await esClienteDeAgencia(ws);
  if (!esSuper && deAgencia !== false) redirect(await rutaConWs('/m'));
  // Un link viejo de la cartera de una agencia: a su pantalla (/m/agency).
  if (sp.cuenta) redirect(await rutaConWs('/m/agency'));
  const cabecera = <CabeceraM titulo="MaKo Partners" padre={{ href: RUTA_MAS, label: 'More' }} />;

  // El super admin sin cliente (o parado en la plataforma): el programa, y la landing con «Ver la landing».
  if ((esSuper && !(await estaImpersonando())) || ws === (await wsSuperAdmin().catch(() => null))) {
    if (sp.landing === '1') return <PantallaM>{cabecera}<LandingPartners modo="app" accion={{ href: RUTA_PARTNERS, texto: 'Volver al panel del programa' }} /></PantallaM>;
    const [programa, enLinea] = await Promise.all([resumenDelPrograma().catch(() => null), cobraEnLinea()]);
    return <PantallaM>{programa ? <ProgramaM programa={programa} cobraEnLinea={enLinea} /> : <>{cabecera}<ErrorM frase="No pudimos leer el programa. No es nada tuyo." /></>}</PantallaM>;
  }

  const [alta, agencia, nombre] = await Promise.all([
    altaDePartner(ws).catch(() => null),
    esAgencia(ws).catch(() => false),
    getSupabaseServer().from('workspaces').select('nombre').eq('id', ws).maybeSingle().then((r) => (r.data as { nombre?: string } | null)?.nombre ?? null, () => null),
  ]);
  if (!alta) {
    // Cualquier plan es partner (29/10/2026), como en la computadora (app/partners/page.tsx).
    if (sp.alta === '1') return <PantallaM>{cabecera}<AltaPartner nombreNegocio={nombre} /></PantallaM>;
    return <PantallaM>{cabecera}<LandingPartners modo="app" accion={{ href: RUTA_ALTA_PARTNERS, texto: 'Hacerme partner' }} /></PantallaM>;
  }
  if (sp.landing === '1') return <PantallaM>{cabecera}<LandingPartners modo="app" accion={{ href: RUTA_PARTNERS, texto: 'Ir a mi panel' }} /></PantallaM>;
  const [tablero, enLinea] = await Promise.all([tableroDe(ws).catch(() => null), cobraEnLinea()]);
  return (
    <PantallaM>
      {tablero ? <ReferidosM tablero={tablero} agencia={agencia} cobraEnLinea={enLinea} emailMako={EMAIL_MAKO} nombreNegocio={nombre} /> :<>{cabecera}<ErrorM frase="No pudimos leer tu panel. No es nada tuyo." /></>}
    </PantallaM>
  );
}
