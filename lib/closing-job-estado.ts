// =============================================================================
// closing-job-estado — QUÉ estado se pinta y CUÁNDO se puede arrancar otra vez
// =============================================================================
// Separado de `closing-job.ts` (que lleva `server-only`) a propósito, por la
// misma razón que `exigirClienteDePrueba` vive fuera del módulo que hace el
// trabajo sucio: un módulo con `server-only` no lo puede importar ningún test, y
// esta decisión —la del candado— es justo la que no puede quedarse sin red.
//
// Acá no se lee ni se escribe nada: entra la fila cruda y sale la decisión.
// =============================================================================

export type EstadoJob = 'corriendo' | 'listo' | 'error';

/** La fila tal cual sale de `closing_jobs`. */
export type FilaJob = { estado: string; detalle: string | null; started_at: string; finished_at: string | null };

/** Lo que la pantalla necesita saber. */
export type ClosingJob = { estado: EstadoJob; detalle: string | null; startedAt: string; finishedAt: string | null };

/**
 * Cuánto puede estar «corriendo» una fila antes de darla por muerta.
 *
 * Un candado sin vencimiento es peor que no tener candado: si la función se cae
 * —timeout, un deploy en el medio, un throw fuera del try— la fila queda en
 * `corriendo` PARA SIEMPRE. El usuario ve «Revisando» eternamente sobre algo que
 * ya nadie está haciendo, y no tiene ningún botón para salir de ahí.
 *
 * El techo real es el `maxDuration` de la ruta (300 s); 15 minutos deja margen
 * de sobra para el caso lento y destraba rápido el caído.
 */
export const VENCE_MS = 15 * 60_000;

const venció = (fila: FilaJob, ahoraMs: number) =>
  fila.estado === 'corriendo' && ahoraMs - Date.parse(fila.started_at) > VENCE_MS;

/**
 * El estado a PINTAR. Un `corriendo` vencido se reporta como `error` con el
 * motivo dicho: seguir mostrando «Revisando» sobre un trabajo muerto es la peor
 * de las tres opciones, porque es la única que no deja nada para hacer.
 */
export function estadoAPintar(fila: FilaJob | null, ahoraMs: number): ClosingJob | null {
  if (!fila) return null;
  if (venció(fila, ahoraMs)) {
    return { estado: 'error', detalle: 'El análisis se cortó por el camino. Prueba de nuevo.', startedAt: fila.started_at, finishedAt: null };
  }
  const estado: EstadoJob = fila.estado === 'corriendo' || fila.estado === 'listo' ? fila.estado : 'error';
  return { estado, detalle: fila.detalle, startedAt: fila.started_at, finishedAt: fila.finished_at };
}

/**
 * ¿Se puede arrancar una corrida? Solo si no hay una viva.
 *
 * Es una función aparte de `estadoAPintar` y no `estado !== 'corriendo'` sobre
 * su resultado, porque son dos preguntas distintas sobre la misma fila: una es
 * qué le muestro a la persona y la otra si le puedo pagar otra vez a Claude.
 * Atarlas hace que un cambio de copy mueva el candado sin que nadie lo note.
 */
export function puedeArrancar(fila: FilaJob | null, ahoraMs: number): boolean {
  if (!fila) return true;
  return fila.estado !== 'corriendo' || venció(fila, ahoraMs);
}

/** Lo que devuelve `analizarLlamadasDeLead`. */
export type Corrida = { encontradas: number; analizadas: number; relinkeadas: number; yaEstaban: number; fallidas: number; error: string | null };

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Cómo termina una corrida, en castellano y listo para pintar.
 *
 * ⚠️ SON TRES DESENLACES, NO DOS. «No la encontré» y «la encontré pero no pude
 * analizarla» mandan a la persona a lugares distintos —a revisar el link de
 * Fathom, o a mirar por qué falló el modelo— y confundirlos cuesta una tarde: la
 * primera versión de esto decía «no encontré la llamada en Fathom» cuando la
 * grabación estaba ahí, con sus 540 turnos, y lo que faltaba era saldo en la API
 * de Anthropic. Cuatro contadores en cero se ven iguales para las dos cosas.
 *
 * Vive acá y no en la ruta para que el mensaje sea uno solo: es el texto que ve
 * el usuario y el que hay que poder testear sin levantar nada.
 */
export function resumenDeCorrida(r: Corrida): { estado: 'listo' | 'error'; detalle: string } {
  const hecho = r.analizadas + r.relinkeadas + r.yaEstaban;
  if (hecho > 0) {
    return {
      estado: 'listo',
      detalle: [
        r.analizadas ? plural(r.analizadas, 'llamada analizada', 'llamadas analizadas') : null,
        r.relinkeadas ? `${plural(r.relinkeadas, 'llamada', 'llamadas')} que ya estaban analizadas quedaron enganchadas a este lead` : null,
        r.yaEstaban ? `${plural(r.yaEstaban, 'llamada', 'llamadas')} ya estaba${r.yaEstaban === 1 ? '' : 'n'} al día` : null,
      ].filter(Boolean).join(' · '),
    };
  }
  if (r.fallidas > 0) {
    // El error del proveedor va TEXTUAL: es lo único que dice qué hacer, y
    // resumirlo a «falló el análisis» obliga a buscarlo en los logs de Vercel,
    // que a los 60 minutos no existen.
    return { estado: 'error', detalle: `Encontré la grabación pero no pude analizarla: ${r.error ?? 'falló el análisis'}` };
  }
  return { estado: 'error', detalle: 'No encontré esa llamada en Fathom. Revisa que el link de la grabación o el email del lead coincidan con la reunión.' };
}
