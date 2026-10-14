import 'server-only';

// =============================================================================
// datos-aviso-config — qué tipos de «dato sin marcar» le avisa MaKo a ESTE negocio
// =============================================================================
// Martín (13/10/2026): «es importante poder configurar que datos quiero que MaKo me notifique
// que estan sin marcar... donde el usuario pueda elegir que datos le parecen importante».
//
// Se guarda lo APAGADO, no lo prendido: un tipo de dato nuevo avisa a todos sin que nadie se
// acuerde de sumarlo a su lista. Vive en `app_settings` del workspace (es del negocio: el
// worklist, «A revisar» y los avisos de MaKo cuentan con esto, y son de todos).
//
// ⚠️ SI LA LECTURA FALLA, NO SE APAGA NADA. Leer mal y devolver «todo apagado» callaría los
// avisos de un negocio entero sin que nadie lo decida; devolver [] avisa de más, que se nota y
// no se pierde nada.
// =============================================================================

import { getSetting, setSetting } from './settings';
import { sanearApagados, partirDatos, type EstadoDatos } from './datos-aviso';
import { resueltosDeLead, type Lead } from './leads';
import type { Step, StepId } from './stage-requirements';

export const KEY_DATOS_APAGADOS = 'crm.datos_aviso.apagados';

export async function apagadosDelNegocio(): Promise<StepId[]> {
  try {
    const crudo = await getSetting(KEY_DATOS_APAGADOS);
    return crudo ? sanearApagados(JSON.parse(crudo)) : [];
  } catch (e) {
    console.warn('[datos-aviso] no se pudo leer qué avisa el negocio:', e instanceof Error ? e.message : e);
    return [];
  }
}

export async function guardarApagados(ids: unknown): Promise<StepId[]> {
  const limpios = sanearApagados(ids);
  await setSetting(KEY_DATOS_APAGADOS, JSON.stringify(limpios));
  return limpios;
}

/**
 * El desplegable de la ficha: lo que falta (ya calculado por quien llama, `faltantesDeLead`),
 * partido en lo que avisa y lo escondido, con lo resuelto de la MISMA etapa y los mismos valores.
 * Una función para las dos puertas de la ficha (el pop-up del tablero y /crm/[id]).
 */
export async function estadoDatosDeLead(
  lead: Lead,
  faltan: Step[],
  tienePlan: boolean | undefined,
  extra: Parameters<typeof resueltosDeLead>[2],
): Promise<EstadoDatos> {
  const apagados = await apagadosDelNegocio();
  return partirDatos(faltan, resueltosDeLead(lead, tienePlan, extra), lead.datos_ignorados, apagados);
}
