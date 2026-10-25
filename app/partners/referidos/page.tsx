// =============================================================================
// /partners/referidos — MaKo Partners del negocio: la landing hasta que se une, y después su tablero (23/10/2026)
// =============================================================================
// Pedido de Martín (22/10/2026): «las bienvenidas de las personas que vos referiste con el dashboard de cuánto dinero
// tenés acumulado... y también si es que te ganaste meses gratuitos». Lo ve el ADMIN de cualquier negocio (no sólo las
// agencias: cualquiera con un plan puede recomendar MaKo). Las reglas, en lib/partners-reglas.ts; los datos, en
// lib/partners-programa.ts (`tableroDe`, sólo el del negocio de la sesión).
//
// LA LANDING PRIMERO (24/10/2026, Martín: «La pagina de MaKo Partners DEBE ser siempre la landing al menos que el usuario ya
// se haya registrado como partner, solo cuando se registre ahi aparece el dashboard»). Registrado = tiene su código
// (`codigoSiExiste`, que sólo lee). Mientras no, la MISMA landing de la página pública con los colores de la app y el botón
// «Unirme» (`unirmeAPartnersAction`, que le crea el código). Si no se pudo leer, la landing: unirse otra vez no duplica.
// =============================================================================

import { redirect } from 'next/navigation';
import { requireSesion, guardOnboarding } from '@/lib/tab-access';
import { adminDeWorkspaceActual, getWorkspaceActual, rutaConWs, wsSuperAdmin } from '@/lib/workspace';
import { esAgencia } from '@/lib/agencia';
import { codigoSiExiste, tableroDe } from '@/lib/partners-programa';
import { ofertasDeLosPlanes } from '@/lib/compra-plan';
import { EMAIL_MAKO } from '@/lib/app-url';
import { Pagina, PageHeader } from '@/app/_ui';
import { LandingPartners } from '@/app/mako-partners/LandingPartners';
import { unirmeAPartnersAction } from '../actions';
import { PestanasDeAgencia, Referidos } from './Referidos';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { title: 'MaKo Partners' };

export default async function ReferidosPage({ searchParams }: { searchParams: Promise<{ unirme?: string }> }) {
  await requireSesion();
  const ws = await getWorkspaceActual();
  if (ws == null || ws === (await wsSuperAdmin())) redirect(await rutaConWs('/partners'));
  if ((await adminDeWorkspaceActual()) == null) redirect(await rutaConWs('/clients'));
  await guardOnboarding();
  const sp = await searchParams;
  // ¿MaKo cobra en línea? (24/10/2026). Un referido se registra con la COMPRA en línea (el cobro con su código, el único
  // que lee `acreditarReferidos`); sin pasarela no nace ninguno, y el tablero en cero tiene que decir por qué.
  const [codigo, agencia, cobraEnLinea] = await Promise.all([
    codigoSiExiste(ws).catch((e) => { console.warn('[partners] no pude leer si el negocio se unió:', e instanceof Error ? e.message : e); return null; }),
    esAgencia(ws).catch(() => false),
    ofertasDeLosPlanes().then((o) => o.some((x) => x.cobrable)).catch(() => true),
  ]);
  if (!codigo) {
    return (
      <Pagina>
        <PageHeader titulo="MaKo Partners" />
        {agencia && <PestanasDeAgencia />}
        <LandingPartners modo="app" cobraEnLinea={cobraEnLinea} emailMako={EMAIL_MAKO}
          unirme={unirmeAPartnersAction} volver="/partners/referidos" error={sp.unirme === 'error'} />
      </Pagina>
    );
  }
  const tablero = await tableroDe(ws).catch(() => null);
  return <Referidos tablero={tablero} agencia={agencia} cobraEnLinea={cobraEnLinea} emailMako={EMAIL_MAKO} />;
}
