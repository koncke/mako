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
//
// ⚠️ DESDE EL 14/10/2026 LOS AVISOS SON POR FUNNEL (decisión 1 de docs/diseno-ficha-bloques.md): un
// lead avisa según la ficha de SU funnel (lib/ficha/config-server.ts). Lo de acá queda como RESPALDO:
// se suma a los apagados de la plantilla de cada funnel, y es lo que vale si los funnels no se leen.
// =============================================================================

import { getSetting, setSetting } from './settings';
import { getTenantDb } from './workspace';
import {
  sanearApagados, partirDatosDelLead, cambioDeIgnorados, sanearIds, DATOS_AVISABLES, IGNORABLES,
  type EstadoDatos, type CambioIgnorados,
} from './datos-aviso';
import { resueltosDeLead, logLeadEvent, type Lead } from './leads';
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
 *
 * Los apagados son los de la ficha del funnel del lead (su casa), y lo ignorado es TODO lo del lead
 * (`partirDatosDelLead`): el mismo número que su fila en «A revisar» y en el worklist.
 *
 * ⚠️ El import de lib/ficha/config-server.ts es DINÁMICO a propósito: ese módulo lee el respaldo del
 * negocio de acá (`apagadosDelNegocio`), y con los dos imports estáticos quedaba un ciclo.
 */
export async function estadoDatosDeLead(
  lead: Lead,
  faltan: Step[],
  tienePlan: boolean | undefined,
  extra: Parameters<typeof resueltosDeLead>[2],
): Promise<EstadoDatos> {
  const { apagadosDeFunnel } = await import('./ficha/config-server');
  const apagados = await apagadosDeFunnel(lead.funnel_id ?? null);
  return partirDatosDelLead(faltan, resueltosDeLead(lead, tienePlan, extra), lead, apagados);
}

export type ResultadoIgnorados = { ok: true; ignorados: StepId[]; cambio: boolean } | { ok: false; error: string };

/**
 * LA escritura de lo ignorado de UN lead, una sola para la ficha, la ✕ de «A revisar»
 * (app/crm/datos-sin-marcar-actions.ts) y la API de MaKo (`ignorar_datos_sin_marcar`): todo queda en
 * `leads.datos_ignorados` (mig 0270), que es de donde salen el «Ver más» y su «volver a avisar». No
 * completa nada: el dato sigue faltando y mover de etapa lo sigue pidiendo. Deja su línea en el
 * historial del lead con el autor. La caché la vence quien llama (una server action no invalida igual
 * que la API).
 *
 * Quien llama ya cortó sin sesión (o corre adentro de runWithWorkspace) y la tabla la scopea getTenantDb.
 * `cambio: false` = ya estaba así: no se escribe ni se deja historial.
 *
 * ⚠️ READ-MODIFY-WRITE de un array chico, por lead: dos pestañas ignorando dos datos del mismo lead en
 * el mismo instante pueden pisarse una a la otra. Es una preferencia de aviso, se ve en pantalla y se
 * vuelve a ignorar en un clic: no justifica una función de base.
 */
export async function escribirDatosIgnorados(leadId: number, pasos: readonly StepId[], ignorar: boolean, autor: string): Promise<ResultadoIgnorados> {
  const db = await getTenantDb();
  const { data, error } = await db.from('leads').select('datos_ignorados, pendientes_ignorados, empresa_omitido').eq('id', leadId).limit(1);
  if (error) return { ok: false, error: 'No se pudo leer el lead.' };
  const fila = ((data ?? []) as Array<{ datos_ignorados: unknown; pendientes_ignorados: string | null; empresa_omitido: boolean | null }>)[0];
  if (!fila) return { ok: false, error: 'Ese lead no es de esta cuenta.' };
  const antes = { datos_ignorados: sanearIds(fila.datos_ignorados), pendientes_ignorados: fila.pendientes_ignorados, empresa_omitido: fila.empresa_omitido };
  const upd: CambioIgnorados = cambioDeIgnorados(antes, pasos, ignorar);
  const igual = JSON.stringify(upd.datos_ignorados) === JSON.stringify(antes.datos_ignorados)
    && upd.pendientes_ignorados === undefined && upd.empresa_omitido === undefined;
  if (igual) return { ok: true, ignorados: upd.datos_ignorados, cambio: false };
  const { error: e2 } = await db.from('leads').update(upd).eq('id', leadId);
  if (e2) return { ok: false, error: 'No se pudo guardar.' };
  const limpios = sanearIds(pasos).filter((p) => IGNORABLES.includes(p));
  const nombres = limpios.length >= IGNORABLES.length ? 'todos sus datos'
    : limpios.map((p) => DATOS_AVISABLES.find((d) => d.id === p)?.label ?? p).join(' · ');
  await logLeadEvent(leadId, 'Datos sin marcar', `${ignorar ? 'ignorado' : 'vuelve a avisar'}: ${nombres}`, autor).catch(() => {});
  return { ok: true, ignorados: upd.datos_ignorados, cambio: true };
}
