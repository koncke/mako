// =============================================================================
// /partners/referidos — el tablero de MaKo Partners: tu link, tus referidos, lo acumulado y los meses gratis (23/10/2026)
// =============================================================================
// Pedido de Martín (22/10/2026): «las bienvenidas de las personas que vos referiste con el dashboard de cuánto dinero
// tenés acumulado... y también si es que te ganaste meses gratuitos». Lo ve el ADMIN de cualquier negocio (no sólo las
// agencias: cualquiera con un plan puede recomendar MaKo). Las reglas, en lib/partners-reglas.ts; los datos, en
// lib/partners-programa.ts (`tableroDe`, sólo el del negocio de la sesión).
// =============================================================================

import { redirect } from 'next/navigation';
import { requireSesion, guardOnboarding } from '@/lib/tab-access';
import { adminDeWorkspaceActual, getWorkspaceActual, rutaConWs, wsSuperAdmin } from '@/lib/workspace';
import { esAgencia } from '@/lib/agencia';
import { tableroDe } from '@/lib/partners-programa';
import { ofertasDeLosPlanes } from '@/lib/compra-plan';
import { EMAIL_MAKO } from '@/lib/app-url';
import { Referidos } from './Referidos';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { title: 'MaKo Partners' };

export default async function ReferidosPage() {
  await requireSesion();
  const ws = await getWorkspaceActual();
  if (ws == null || ws === (await wsSuperAdmin())) redirect(await rutaConWs('/partners'));
  if ((await adminDeWorkspaceActual()) == null) redirect(await rutaConWs('/clients'));
  await guardOnboarding();
  // ¿MaKo cobra en línea? (24/10/2026). Un referido se registra con la COMPRA en línea (el cobro con su código, el único
  // que lee `acreditarReferidos`); sin pasarela no nace ninguno, y el tablero en cero tiene que decir por qué.
  const [tablero, agencia, cobraEnLinea] = await Promise.all([
    tableroDe(ws).catch(() => null),
    esAgencia(ws).catch(() => false),
    ofertasDeLosPlanes().then((o) => o.some((x) => x.cobrable)).catch(() => true),
  ]);
  return <Referidos tablero={tablero} agencia={agencia} cobraEnLinea={cobraEnLinea} emailMako={EMAIL_MAKO} />;
}
