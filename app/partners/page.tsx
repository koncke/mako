// =============================================================================
// /partners — MaKo Partners: el programa de referidos (la landing, el alta corta y el panel), en UNA ruta (25/10/2026)
// =============================================================================
// Martín (25/10): «Revisa que la url es "https://hola-mako.com/partners/referidos" cuando solo basta "partners"... si alguien
// no se hizo "Partner", no le debe saltar abajo nada de "Todavía no tienes referidos" o del dashboard... Solo los CTA para
// que se haga Partner, posterior a apretar eso, un pequeño onboarding... Luego de eso, en la misma url, ahora si ven el
// dashboard, con un botón arriba para ver la landing nuevamente por si quieren... En SuperAdmin, directo ver el dashboard».
//
// QUIÉN VE QUÉ:
//   · el super admin sin cliente: el panel del programa (ProgramaPartners), y la landing con `?landing=1`;
//   · el ADMIN de un negocio que NO se hizo partner (`altaDePartner` null): la landing, con «Hacerme partner» → `?alta=1`,
//     el onboarding corto (AltaPartner) que termina dándole su link;
//   · el que ya es partner: su panel (PanelPartner), y la landing con `?landing=1`;
//   · cualquier otro rol: a /clients (una tab que no le toca no es un 404, es «acá no»).
// LO DE AGENCIA SALIÓ DE ACÁ (Martín: «Ser Agencia es muy diferente a Partner»): su cartera vive en /agency. Los links
// viejos de una agencia (`?cuenta=`, `?nuevo=` de la API `llevar_a_partners`, `?tab=clients|program`) llevan allá.
// =============================================================================

import { redirect } from 'next/navigation';
import { requireSesion, guardOnboarding } from '@/lib/tab-access';
import { getWorkspaceActual, adminDeWorkspaceActual, estaImpersonando, rutaConWs, wsSuperAdmin } from '@/lib/workspace';
import { getSesionAdmin } from '@/lib/auth';
import { esAgencia } from '@/lib/agencia';
import { getSupabaseServer } from '@/lib/supabase';
import { altaDePartner, resumenDelPrograma, tableroDe } from '@/lib/partners-programa';
import { RUTA_ALTA_PARTNERS, RUTA_PARTNERS } from '@/lib/partners-reglas';
import { esEsencialDeLaSesion } from '@/lib/plan-esencial';
import { ROTULO_PASAR_A_PRO } from '@/lib/plan-esencial-reglas';
import { RUTA_CAMBIAR_PLAN, textoSoloPro } from '@/lib/topes-plan';
import { ofertasDeLosPlanes } from '@/lib/compra-plan';
import { EMAIL_MAKO } from '@/lib/app-url';
import { Pagina, PageHeader } from '@/app/_ui';
import { LandingPartners } from '@/app/mako-partners/LandingPartners';
import { AltaPartner } from './AltaPartner';
import { PanelPartner } from './PanelPartner';
import { ProgramaPartners } from './ProgramaPartners';
import { RotuloLanding } from './RotuloLanding';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = { title: 'MaKo Partners' };

/** Los parámetros del panel de AGENCIA que llegan por links viejos (el CRM, Clients, la API): van a /agency. */
const DE_AGENCIA = ['cuenta', 'nuevo'] as const;
const VISTAS_DE_AGENCIA = ['clients', 'program'];

/** ¿MaKo cobra en línea? Sin pasarela no se registra ningún referido solo, y el panel en cero lo dice. No pude leer = sí. */
const cobraEnLinea = () => ofertasDeLosPlanes().then((o) => o.some((x) => x.cobrable)).catch(() => true);

export default async function PartnersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSesion();
  const sp = await searchParams;
  const esSuper = (await getSesionAdmin()) != null;
  const ws = await getWorkspaceActual();

  // Un link viejo del panel de agencia: a /agency con lo mismo (25/10/2026).
  if (DE_AGENCIA.some((k) => sp[k]) || VISTAS_DE_AGENCIA.includes(sp.tab ?? '')) {
    const q = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v != null && k !== 'ws') as Array<[string, string]>);
    redirect(await rutaConWs(`/agency${q.size ? `?${q}` : ''}`));
  }

  // El super admin sin cliente: directo el panel del programa (y la landing, como la ve un cliente, con «Ver la landing»).
  if (esSuper && !(await estaImpersonando())) {
    if (sp.landing === '1') {
      return (
        <Pagina>
          <PageHeader titulo="MaKo Partners" />
          <LandingPartners modo="app" accion={null} rotulo={<RotuloLanding texto="Así ven tus clientes MaKo Partners antes de hacerse partner." volver="Volver al panel del programa" />} />
        </Pagina>
      );
    }
    const [programa, enLinea] = await Promise.all([
      resumenDelPrograma().catch((e) => { console.warn('[partners] no pude leer el programa:', e instanceof Error ? e.message : e); return null; }),
      cobraEnLinea(),
    ]);
    return <ProgramaPartners programa={programa} cobraEnLinea={enLinea} />;
  }

  if (ws == null || ws === (await wsSuperAdmin())) redirect(await rutaConWs('/clients'));
  if ((await adminDeWorkspaceActual()) == null) redirect(await rutaConWs('/clients'));
  // Como toda tab: con el onboarding sin terminar, primero el onboarding (lib/tab-access.ts).
  await guardOnboarding();

  const [alta, agencia, nombre] = await Promise.all([
    // No pude leer = la landing (hacerse partner otra vez no duplica nada: `hacermePartner`).
    altaDePartner(ws).catch((e) => { console.warn('[partners] no pude leer si el negocio es partner:', e instanceof Error ? e.message : e); return null; }),
    esAgencia(ws).catch(() => false),
    getSupabaseServer().from('workspaces').select('nombre').eq('id', ws).maybeSingle().then((r) => (r.data as { nombre?: string } | null)?.nombre ?? null, () => null),
  ]);

  // Todavía no es partner: la landing; y al tocar «Hacerme partner», el onboarding corto.
  if (!alta) {
    // SÓLO MaKo Pro (27/10/2026, Martín en la llamada con Leila): un Esencial ve la landing con «Pasar a Pro» en lugar de
    // «Hacerme partner», y el alta corta no se abre (`hacermePartner` lo frena igual, también por la API).
    if (await esEsencialDeLaSesion()) {
      return (
        <Pagina>
          <PageHeader titulo="MaKo Partners" />
          <p style={{ margin: '0 0 12px', fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>{textoSoloPro('partners')}</p>
          <LandingPartners modo="app" accion={{ href: await rutaConWs(RUTA_CAMBIAR_PLAN), texto: ROTULO_PASAR_A_PRO }} />
        </Pagina>
      );
    }
    if (sp.alta === '1') {
      return (
        <Pagina>
          <PageHeader titulo="MaKo Partners" />
          <AltaPartner nombreNegocio={nombre} />
        </Pagina>
      );
    }
    return (
      <Pagina>
        <PageHeader titulo="MaKo Partners" />
        <LandingPartners modo="app" accion={{ href: RUTA_ALTA_PARTNERS, texto: 'Hacerme partner' }} />
      </Pagina>
    );
  }

  // Ya es partner y quiere ver la landing otra vez.
  if (sp.landing === '1') {
    return (
      <Pagina>
        <PageHeader titulo="MaKo Partners" />
        <LandingPartners modo="app" accion={{ href: RUTA_PARTNERS, texto: 'Ir a mi panel' }}
          rotulo={<RotuloLanding texto="Ya eres partner: así se ve MaKo Partners para quien todavía no lo es." volver="Volver a mi panel" />} />
      </Pagina>
    );
  }

  const [tablero, enLinea] = await Promise.all([
    tableroDe(ws).catch((e) => { console.warn('[partners] no pude leer el panel:', e instanceof Error ? e.message : e); return null; }),
    cobraEnLinea(),
  ]);
  return <PanelPartner tablero={tablero} nombreNegocio={nombre} agencia={agencia} cobraEnLinea={enLinea} emailMako={EMAIL_MAKO} />;
}
