// =============================================================================
// mensaje-canales — de dónde sale «por dónde llega» CADA mensaje
// =============================================================================
// Hay dos tiendas y no es un descuido: son dos cosas con dueños distintos.
//
//   · Los tres REPORTES tienen su canal en `notification_prefs` (`CanalPrefs.wa`
//     y `.email`), que es lo que leen sus crons desde antes de que existiera el
//     store de plantillas.
//   · Los AVISOS lo tienen en su propia entrada del store (`canales`), que es lo
//     que lee el choke point de `lib/avisos.ts` al despachar.
//
// Moverlos a una sola tienda sería el cambio correcto y no es éste: los crons de
// reporte no iteran inquilinos, así que migrarlos es tocar un camino que hoy sólo
// corre para el dueño. Lo que NO se puede es que cada pantalla decida por su
// cuenta de dónde leer — ahí es donde nacen los dos interruptores que dicen cosas
// distintas sobre el mismo mensaje, que esta tab ya pagó una vez.
//
// Sin `server-only`: lo importan la bandeja de email y el detalle de un mensaje,
// que son componentes del navegador, y también puede leerlo el server.

/** Los mensajes cuyo canal vive en `notification_prefs`, y bajo qué clave. */
export const REPORTES_CON_PREFS: Record<string, 'horario' | 'diario' | 'semanal'> = {
  'reporte-horario': 'horario',
  'reporte-diario': 'diario',
  'reporte-semanal': 'semanal',
};

export function claveDeReporte(id: string): 'horario' | 'diario' | 'semanal' | null {
  return REPORTES_CON_PREFS[id] ?? null;
}

/** Forma mínima de lo que cada tienda devuelve, para no importar los tipos del server. */
type CanalesLeidos = { wa: boolean; email: boolean };
type PrefsLeidas = { horario?: CanalesLeidos; diario?: CanalesLeidos; semanal?: CanalesLeidos };

/**
 * Por dónde sale este mensaje, mire quien mire.
 *
 * `prefs` puede llegar en null (todavía cargando, o la lectura falló): en ese caso
 * un reporte contesta lo que dice su plantilla, que para un reporte es el default
 * —y no se inventa un «sí» sobre un canal que no se pudo leer.
 */
export function canalesDeMensaje(
  id: string,
  plantilla: { canales?: CanalesLeidos } | null | undefined,
  prefs: PrefsLeidas | null | undefined,
): CanalesLeidos {
  const k = claveDeReporte(id);
  if (k && prefs?.[k]) return { wa: prefs[k]!.wa, email: prefs[k]!.email };
  return { wa: plantilla?.canales?.wa ?? true, email: plantilla?.canales?.email ?? false };
}
