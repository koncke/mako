// =============================================================================
// /m/configuraciones/plan — «Configuración del negocio» › Tu plan en el teléfono (17/10/2026)
// =============================================================================
// En la URL, /configuraciones/plan. Referencia: Ajustes › Suscripciones de iOS. El plan y su estado, sin precio (el teléfono
// no vende, T5), y abajo, en rojo, «Darme de baja», que pide una confirmación que dice qué pasa antes de cortar. Es la
// pantalla de la computadora (app/configuraciones/plan/PlanPanel.tsx) con los mismos datos, leídos igual, y la misma acción
// (`darmeDeBajaAction`, que sólo deja al admin de ESTE negocio y manda el código por email).
// =============================================================================

import '../configuraciones.css';
import { redirect } from 'next/navigation';
import { requireMovil } from '@/lib/movil-guard';
import { getCapaActual, getWorkspaceActual, rutaConWs, wsSuperAdmin } from '@/lib/workspace';
import { RUTA_CONFIG_M } from '@/lib/movil-rutas';
import { capaDef } from '@/lib/capas';
import { inicioDeLaPrueba, suscripcionDeMakoDe } from '@/lib/cobros';
import { diaDelCobro, esPruebaDePlan } from '@/lib/prueba-plan-reglas';
import { gratisHastaDe } from '@/lib/plan-a-mano';
import { lineaDelPrimerMes } from '@/lib/primer-mes-reglas';
import { esBajaPedida } from '@/lib/cobros-reglas';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { EMAIL_MAKO } from '@/lib/app-url';
import type { SuscripcionVisible } from '@/app/configuraciones/plan/PlanPanel';
import { CabeceraM, PantallaM } from '@/app/m/_ui';
import { PlanM } from './PlanM';

export const dynamic = 'force-dynamic';

export default async function PlanMovil() {
  await requireMovil({ navKey: 'configuraciones' });
  const ws = await getWorkspaceActual();
  // La plataforma no tiene un plan de MaKo (el índice no ofrece la sección ahí): un link viejo vuelve al índice.
  if (ws == null || ws === (await wsSuperAdmin())) redirect(await rutaConWs(RUTA_CONFIG_M));
  const [capa, sus, gratisHasta] = await Promise.all([getCapaActual(), suscripcionDeMakoDe(ws).catch(() => null), gratisHastaDe(ws).catch(() => null)]);
  // LA PRUEBA GRATIS (25/10/2026): hasta cuándo va.
  const enPrueba = !!sus && esPruebaDePlan(sus) && sus.estado === 'pendiente';
  const hasta = enPrueba ? await inicioDeLaPrueba(sus!).catch(() => null) : null;
  // La pantalla no ve el cobro entero (ni el token, ni los ids del proveedor): sólo lo que dibuja. Igual que escritorio.
  const suscripcion: SuscripcionVisible = sus
    ? {
      proveedor: sus.proveedor, monto: formatoMonto(sus.monto, sus.moneda), cancelada: sus.suscripcion_estado === 'cancelada', baja: esBajaPedida(sus.motivo) ? sus.motivo : null,
      prueba: enPrueba ? { hasta: hasta ? diaDelCobro(hasta) : 'el fin de la prueba' } : null,
      primerMes: lineaDelPrimerMes(sus, formatoMonto),
    }
    : null;
  return (
    <PantallaM>
      <CabeceraM titulo="Tu plan" />
      <PlanM plan={capaDef(capa).nombre} suscripcion={suscripcion} emailMako={EMAIL_MAKO} gratisHasta={gratisHasta} />
    </PantallaM>
  );
}
