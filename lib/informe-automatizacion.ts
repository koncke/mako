// =============================================================================
// informe-automatizacion — el nombre del informe de las Métricas de UNA automatización (puro, sin imports)
// =============================================================================
// Aparte de lib/automatizacion-metricas.ts a propósito: lo importa el EDITOR del Dashboard (app/dashboard/EditorInforme.tsx,
// cliente), y aquél trae el flujo (lib/flujo-conversacion.ts), que no tiene por qué viajar en el bundle del Dashboard.
// =============================================================================

/** `?informe=automatizacion:<id>`: las Métricas de la automatización `id`. */
export type InformeAutomatizacion = `automatizacion:${number}`;
export const informeDeAutomatizacion = (id: number): InformeAutomatizacion => `automatizacion:${id}`;

/** El id de la automatización de un `?informe=` (`automatizacion:<id>`), o null si no es uno de éstos. */
export function idDeInformeAutomatizacion(x: unknown): number | null {
  const m = typeof x === 'string' ? /^automatizacion:(\d{1,9})$/.exec(x) : null;
  const id = m ? Number(m[1]) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** La clave del informe en `app_settings`: por automatización y por persona, como el de General (`general.informe.<sub>`). */
export const claveInformeAutomatizacion = (id: number, sub: string) => `automatizacion.informe.${id}.${sub}`;
