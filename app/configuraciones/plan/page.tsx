// =============================================================================
// /configuraciones/plan — «Configuración del negocio» › Tu plan (15/10/2026)
// =============================================================================
// El plan de MaKo del negocio y el botón «Darme de baja», como todo SaaS (lo decidió Estrategia el 15/10, y
// /reembolsos y /terminos remiten acá). Sólo el admin: es lo que la plataforma le cobra al negocio. La suscripción se
// lee por `alta_ws` (lib/cobros.ts, `suscripcionDeMakoDe`); sin una, el plan se acordó a mano y se dice a quién escribir.

import { redirect } from 'next/navigation';
import { requireRolWs } from '@/lib/tab-access';
import { TITULO_NEGOCIO } from '@/lib/ajustes-secciones';
import { seccionesNegocioActuales } from '@/lib/ajustes-negocio';
import { getCapaActual, getWorkspaceActual, wsSuperAdmin } from '@/lib/workspace';
import { capaDef } from '@/lib/capas';
import { suscripcionDeMakoDe } from '@/lib/cobros';
import { esBajaPedida } from '@/lib/cobros-reglas';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { EMAIL_MAKO } from '@/lib/app-url';
import { AjustesPagina, TituloAjustes } from '../../_ui/Ajustes';
import { PlanPanel, type SuscripcionVisible } from './PlanPanel';
import { planesMako } from '@/lib/compra-plan';
import { precioEn } from '@/lib/planes-mako';
import { PLAN_PRO, proPorLlamada } from '@/lib/subir-plan-reglas';
import { AGENDA_MAKO } from '@/lib/compra-plan-reglas';
import { estadoDeRetencion, ofertaDeRetencion } from '@/lib/retencion-plan';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PlanPage() {
  await requireRolWs([], { nav: 'configuraciones' });
  const ws = await getWorkspaceActual();
  // La plataforma no tiene un plan de MaKo (el índice ya no ofrece la sección ahí): un link viejo vuelve al índice.
  if (ws == null || ws === (await wsSuperAdmin())) redirect('/configuraciones');
  const [capa, sus, oferta, retencion] = await Promise.all([
    getCapaActual(),
    ws != null ? suscripcionDeMakoDe(ws).catch(() => null) : Promise.resolve(null),
    ofertaDeRetencion(ws).catch(() => null),
    // Lo que «Tu plan» dice de una oferta aceptada (segunda revisión, R10): «En pausa…», «Con 50%…».
    estadoDeRetencion(ws).catch(() => null),
  ]);
  // La pantalla no ve el cobro entero (ni el token, ni los ids del proveedor): sólo lo que dibuja.
  const suscripcion: SuscripcionVisible = sus
    ? { proveedor: sus.proveedor, monto: formatoMonto(sus.monto, sus.moneda), cancelada: sus.suscripcion_estado === 'cancelada', baja: esBajaPedida(sus.motivo) ? sus.motivo : null }
    : null;
  // «Pasar a Pro»: a quien paga MaKo Esencial por la pasarela (capa `completo`), con el precio de Pro en SU moneda.
  const pro = capa === 'completo' ? (await planesMako().catch(() => [])).find((p) => p.id === PLAN_PRO && p.activo) ?? null : null;
  const precioPro = pro && sus ? precioEn(pro, sus.moneda) : null;
  const subir = pro && sus && precioPro != null ? { nombre: pro.nombre, monto: formatoMonto(precioPro, sus.moneda) } : null;
  // Sin esa subida en línea (hoy, todos: la pasarela de MaKo no está conectada), la agenda. Es a donde llevan los carteles
  // de tope, y antes no ofrecía ninguna forma de pasar a Pro (lib/subir-plan-reglas.ts, `proPorLlamada`).
  const porLlamada = pro && proPorLlamada({ capa, subidaEnLinea: subir != null })
    ? { titulo: `Pasar a ${pro.nombre}`, detalle: `US$ ${pro.precioUsd} por mes. Agenda una llamada y te lo activamos.`, href: AGENDA_MAKO }
    : null;
  return (
    <AjustesPagina lugar={TITULO_NEGOCIO} secciones={await seccionesNegocioActuales()} activa="plan">
      <TituloAjustes titulo="Tu plan" bajada="Tu plan de MaKo y cómo darte de baja." />
      <PlanPanel plan={capaDef(capa).nombre} suscripcion={suscripcion} emailMako={EMAIL_MAKO} oferta={oferta} retencion={retencion} subir={subir} porLlamada={porLlamada} />
    </AjustesPagina>
  );
}
