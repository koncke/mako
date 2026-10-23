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
  const [tablero, agencia] = await Promise.all([tableroDe(ws).catch(() => null), esAgencia(ws).catch(() => false)]);
  return <Referidos tablero={tablero} agencia={agencia} />;
}
