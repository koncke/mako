// =============================================================================
// closing-job — el estado de "estoy analizando la llamada de este lead"
// =============================================================================
// El análisis corre en background (`after()` en la ruta) y tarda minutos: barre
// las meetings de Fathom y le paga a Claude una llamada por grabación. Que el
// trabajo sobreviva a que el usuario cierre la pestaña es la mitad; la otra es
// que al VOLVER la pantalla sepa que sigue corriendo. Sin fila persistida, la
// pantalla mostraría el botón otra vez y un segundo click pagaría dos veces la
// misma grabación.
//
// Por eso la fila es a la vez el estado que se pinta y el CANDADO que evita la
// corrida doble. Las dos decisiones viven en `closing-job-estado.ts` (sin
// `server-only`, para que se puedan testear); acá queda solo el acceso a datos.
//
// Una fila por lead (unique `workspace_id, lead_id`): es un ESTADO, no un log.
// El historial de lo que se analizó ya vive en `closing_analyses`.
// =============================================================================

import 'server-only';

import { getTenantDb } from './workspace';
import { estadoAPintar, puedeArrancar, type ClosingJob, type FilaJob } from './closing-job-estado';

export type { ClosingJob, EstadoJob } from './closing-job-estado';

const COLS = 'estado, detalle, started_at, finished_at';

async function filaDe(leadId: number): Promise<FilaJob | null> {
  const { data, error } = await (await getTenantDb())
    .from('closing_jobs')
    .select(COLS)
    .eq('lead_id', leadId)
    .maybeSingle();
  if (error || !data) return null;
  return data as FilaJob;
}

/** El estado a pintar en la pantalla (o null si nunca se pidió un análisis). */
export async function estadoDelAnalisis(leadId: number): Promise<ClosingJob | null> {
  return estadoAPintar(await filaDe(leadId), Date.now());
}

/**
 * Toma el trabajo, o dice que ya lo tiene otro. `false` = no arrancar nada.
 *
 * ⚠️ Hay una ventana entre leer la fila y escribirla: dos clicks simultáneos
 * podrían pasar los dos. La red REAL contra eso es el unique `(workspace_id,
 * lead_id)` — el segundo upsert pisa la misma fila en vez de crear una segunda,
 * así que a lo sumo se duplica una corrida, nunca se acumulan. Y
 * `analizarLlamadasDeLead` saltea lo ya analizado, con lo cual la corrida
 * repetida no vuelve a pagar las grabaciones que ya están.
 */
export async function arrancarAnalisis(leadId: number): Promise<boolean> {
  if (!puedeArrancar(await filaDe(leadId), Date.now())) return false;

  const { error } = await (await getTenantDb())
    .from('closing_jobs')
    .upsert(
      { lead_id: leadId, estado: 'corriendo', detalle: null, started_at: new Date().toISOString(), finished_at: null },
      { onConflict: 'workspace_id,lead_id' },
    );
  if (error) {
    console.error(`[closing-job] no pude tomar el trabajo del lead ${leadId}: ${error.message}`);
    return false;
  }
  return true;
}

/** Cierra el trabajo: `listo` con lo que encontró, o `error` con el porqué. */
export async function cerrarAnalisis(leadId: number, estado: 'listo' | 'error', detalle: string): Promise<void> {
  const { error } = await (await getTenantDb())
    .from('closing_jobs')
    .update({ estado, detalle, finished_at: new Date().toISOString() })
    .eq('lead_id', leadId);
  if (error) console.error(`[closing-job] no pude cerrar el trabajo del lead ${leadId}: ${error.message}`);
}
