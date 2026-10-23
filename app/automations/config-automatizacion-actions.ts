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
import { leerConfigAutomatizacion, guardarConfigAutomatizacion } from '@/lib/config-automatizacion-db';
import type { ConfigAutomatizacion } from '@/lib/config-automatizacion';

export async function getConfigAutomatizacionAction(secuenciaId: number): Promise<{
  config: ConfigAutomatizacion;
  /** El horario del negocio (el que vale sin uno propio). null = sin horario. */
  horarioNegocio: HorarioEnvio | null;
  /** Las horas entre dos mensajes a la misma persona del negocio, por canal. */
  personaNegocio: { whatsapp: number; email: number };
  /** Los topes de WhatsApp de la LÍNEA (el techo del goteo, lib/goteo.ts). */
  lineaWa: { dia: number; hora: number };
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
  const limites = limitesVigentes(rawLimites, limitesDeFabrica(process.env));
  return {
    config, horarioNegocio: horarioVigente(rawHorario),
    personaNegocio: { whatsapp: limites.wa.personaHoras, email: limites.email.personaHoras },
    lineaWa: { dia: limites.wa.dia, hora: limites.wa.hora },
    zona, puedeEditar: rol === 'admin',
  };
}

/**
 * Un cambio: `{ horario }` (`null` = el del negocio), `{ personaHoras: { whatsapp?, email? } }` (`null` = los del negocio)
 * y/o `{ goteo: { minutos?, dia? } }` (`null` = sin goteo).
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
