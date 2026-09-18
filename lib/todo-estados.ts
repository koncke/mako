// =============================================================================
// todo-estados — los estados de una tarea del tablero del CLIENTE (experimento_tareas)
// =============================================================================
// Sin `server-only` a propósito: lo lee el tablero para dibujar las columnas y lo
// importa el test. La base tiene el mismo juego en un CHECK (mig 0159); si se agrega
// uno acá y no allá, el insert falla — que es lo que tiene que pasar.
//
// Las CLAVES no se renombraron cuando Mauricio pidió columnas por estado (08-T49):
// cambió la ETIQUETA. `por_hacer` sigue siendo `por_hacer` y se muestra «Nuevas».
// =============================================================================

export type EstadoTarea = 'no_cumple' | 'por_hacer' | 'en_curso' | 'en_seguimiento' | 'hecho';

/** En el orden en que se dibujan las columnas, de izquierda a derecha. */
export const ESTADOS: ReadonlyArray<{ key: EstadoTarea; label: string }> = [
  { key: 'no_cumple', label: 'No cumplen criterio' },
  { key: 'por_hacer', label: 'Nuevas' },
  { key: 'en_curso', label: 'En proceso' },
  { key: 'en_seguimiento', label: 'En seguimiento' },
  { key: 'hecho', label: 'Concluidas' },
];

export const esEstado = (e: unknown): e is EstadoTarea => ESTADOS.some((s) => s.key === e);

/**
 * ¿Es trabajo que alguien tiene que hacer? Es lo que antes se preguntaba con
 * `estado !== 'hecho'`, y con `no_cumple` esa pregunta dejó de alcanzar: una tarea
 * que el criterio no dejó pasar NO es un pendiente. Si se contara, el Perro la
 * puntuaría, el agente la listaría como abierta y el contador de /general la sumaría
 * — justo lo que el criterio existe para evitar.
 * `en_seguimiento` SÍ es pendiente: lo está haciendo otro, pero no está terminada.
 */
export const estaPendiente = (e: EstadoTarea): boolean => e !== 'hecho' && e !== 'no_cumple';

/** Los que NO son pendientes, para filtrar en la base: `.not('estado', 'in', …)`. */
export const NO_PENDIENTES_SQL = '(hecho,no_cumple)';

/**
 * El estado después de tocar el avance. El tablero no muestra «Estado» aparte: se
 * deriva del % (100→hecho, >0→en_curso, 0→por_hacer). Pero esa derivación solo sabe
 * de los tres estados de siempre, y aplicada a ciegas se come los otros dos:
 *
 *  · `no_cumple` + avance al 40% → saldría a «En proceso». Sería PROMOVER una tarea
 *    que el criterio no dejó pasar sin que nadie lo decida — y Mauricio pidió que
 *    promover pida un motivo. Se queda donde está.
 *  · `en_seguimiento` + avance → saldría a «En proceso» y se perdería que se espera
 *    a otro. Se queda.
 *
 * El 100% sí manda desde cualquier lado: terminada es un HECHO, no una decisión de
 * criterio. (Es lo que hace el cierre automático por señales, lib/todo-seeds.ts.)
 */
export function estadoTrasProgreso(actual: EstadoTarea, progreso: number): EstadoTarea {
  if (progreso >= 100) return 'hecho';
  if (actual === 'no_cumple' || actual === 'en_seguimiento') return actual;
  return progreso > 0 ? 'en_curso' : 'por_hacer';
}

/** De quién es la tarea, RELATIVO al dueño del tablero. null = no se sabe (≠ 'mio'). */
export type ResponsableTipo = 'mio' | 'cliente' | 'tercero';
export const esResponsableTipo = (t: unknown): t is ResponsableTipo => t === 'mio' || t === 'cliente' || t === 'tercero';

export type CriterioVeredicto = 'cumple' | 'no_cumple';
