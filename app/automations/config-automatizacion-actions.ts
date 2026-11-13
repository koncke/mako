'use server';

// =============================================================================
// La configuración de UNA automatización — leer y guardar (la tuerca del título y «Configuraciones» del «⋯»)
// =============================================================================
// Martín, 16/10/2026 (punto 5) y 20/10/2026: «"configuraciones" ya no viva para todo Automations, sino para cada chat».
// Las reglas, en lib/config-automatizacion.ts; la base, en lib/config-automatizacion-db.ts; lo lee el motor
// (lib/nutricion.ts, `procesarEnvios`) y el tick (app/api/cron/nutricion-tick).
//
// ⚠️ ADMIN, NO CUALQUIERA: decide cuándo le llega un mensaje a cada lead de esa automatización. Como el horario del
// negocio (app/configuraciones/horario-actions.ts): el setter LEE.
//
// ⚠️ EN UN ARCHIVO `'use server'` SÓLO SE EXPORTAN FUNCIONES ASYNC (AGENTS.md).

import { requireSesion } from '@/lib/tab-access';
import { getSettingEstricto } from '@/lib/settings';
import { getWorkspaceActual } from '@/lib/workspace';
import { zonaDelNegocioDetalle } from '@/lib/timezone';
import { ZONA_POR_DEFECTO } from '@/lib/zona-negocio-reglas';
import { KEY_HORARIO_ENVIO, horarioVigente, type HorarioEnvio } from '@/lib/horario-envio';
import { KEY_LIMITES_ENVIO, limitesDeFabrica, limitesVigentes } from '@/lib/limites-envio';
import { opcionesDeRango } from '@/lib/limites-envio-cuenta';
import { leerConfigAutomatizacion, guardarConfigAutomatizacion } from '@/lib/config-automatizacion-db';
import { rangosGoteo, type ConfigAutomatizacion } from '@/lib/config-automatizacion';

export async function getConfigAutomatizacionAction(secuenciaId: number): Promise<{
  config: ConfigAutomatizacion;
  /** El horario del negocio (el que vale sin uno propio). null = sin horario. */
  horarioNegocio: HorarioEnvio | null;
  /** Los topes de WhatsApp de la LÍNEA (el techo del goteo, lib/goteo.ts). */
  lineaWa: { dia: number; hora: number };
  /** El tope por día de email de la LÍNEA (el techo del goteo del email). */
  lineaEmailDia: number;
  /** Los rangos del goteo de ESTE negocio (#93): el tope por día llega a 2.000 con su Resend y su dominio. */
  rangosGoteo: ReturnType<typeof rangosGoteo>;
  zona: string;
  puedeEditar: boolean;
}> {
  const rol = await requireSesion();
  const ws = await getWorkspaceActual();
  // Estricto: si no se puede leer, la pantalla dice que no pudo, no que «es como el negocio».
  const [config, rawHorario, rawLimites, zona] = await Promise.all([
    leerConfigAutomatizacion(secuenciaId),
    getSettingEstricto(KEY_HORARIO_ENVIO),
    getSettingEstricto(KEY_LIMITES_ENVIO),
    ws == null ? Promise.resolve(ZONA_POR_DEFECTO) : zonaDelNegocioDetalle(ws).then((d) => d.tz),
  ]);
  const cuenta = await opcionesDeRango();
  const limites = limitesVigentes(rawLimites, limitesDeFabrica(process.env), cuenta);
  return {
    config, horarioNegocio: horarioVigente(rawHorario),
    lineaWa: { dia: limites.wa.dia, hora: limites.wa.hora },
    lineaEmailDia: limites.email.dia,
    rangosGoteo: rangosGoteo(cuenta),
    zona, puedeEditar: rol === 'admin',
  };
}

/**
 * Un cambio: `{ horario }` (`null` = el del negocio) y/o `{ goteo: { minutos?, dia? } }` (uno solo para todos los canales)
 * (`null` = sin goteo).
 */
export async function saveConfigAutomatizacionAction(secuenciaId: number, cambio: unknown): Promise<{ ok: boolean; error?: string; config?: ConfigAutomatizacion }> {
  const rol = await requireSesion();
  if (rol !== 'admin') return { ok: false, error: 'Solo un admin puede cambiar la configuración.' };
  try {
    const r = await guardarConfigAutomatizacion(secuenciaId, cambio);
    return r.ok ? { ok: true, config: r.config } : { ok: false, error: r.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
}
