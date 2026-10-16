// =============================================================================
// /configuraciones/plan — «Configuración del negocio» › Tu plan (15/10/2026)
// =============================================================================
// El plan de MaKo del negocio y el botón «Darme de baja», como todo SaaS (lo decidió Estrategia el 15/10, y
// /reembolsos y /terminos remiten acá). Sólo el admin: es lo que la plataforma le cobra al negocio. La suscripción se
// lee por `alta_ws` (lib/cobros.ts, `suscripcionDeMakoDe`); sin una, el plan se acordó a mano y se dice a quién escribir.

import { requireRolWs } from '@/lib/tab-access';
import { TITULO_NEGOCIO } from '@/lib/ajustes-secciones';
import { seccionesNegocioActuales } from '@/lib/ajustes-negocio';
import { getCapaActual, getWorkspaceActual } from '@/lib/workspace';
import { capaDef } from '@/lib/capas';
import { suscripcionDeMakoDe } from '@/lib/cobros';
import { esBajaPedida } from '@/lib/cobros-reglas';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { EMAIL_MAKO } from '@/lib/app-url';
import { AjustesPagina, TituloAjustes } from '../../_ui/Ajustes';
import { PlanPanel, type SuscripcionVisible } from './PlanPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PlanPage() {
  await requireRolWs([], { nav: 'configuraciones' });
  const ws = await getWorkspaceActual();
  const [capa, sus] = await Promise.all([
    getCapaActual(),
    ws != null ? suscripcionDeMakoDe(ws).catch(() => null) : Promise.resolve(null),
  ]);
  // La pantalla no ve el cobro entero (ni el token, ni los ids del proveedor): sólo lo que dibuja.
  const suscripcion: SuscripcionVisible = sus
    ? { proveedor: sus.proveedor, monto: formatoMonto(sus.monto, sus.moneda), cancelada: sus.suscripcion_estado === 'cancelada', baja: esBajaPedida(sus.motivo) ? sus.motivo : null }
    : null;
  return (
    <AjustesPagina lugar={TITULO_NEGOCIO} secciones={await seccionesNegocioActuales()} activa="plan">
      <TituloAjustes titulo="Tu plan" bajada="Tu plan de MaKo y cómo darte de baja." />
      <PlanPanel plan={capaDef(capa).nombre} suscripcion={suscripcion} emailMako={EMAIL_MAKO} />
    </AjustesPagina>
  );
}
