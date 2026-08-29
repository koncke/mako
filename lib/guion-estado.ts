// =============================================================================
// guion-estado — el shape de un GUION y su pipeline de producción
// =============================================================================
// Vive APARTE de lib/razones.ts a propósito: razones.ts es 'server-only' (habla
// con la IA y con settings), y estas constantes las necesitan también los
// componentes de cliente (la matriz y la vista global de guiones). Duplicarlas
// del lado del cliente sería una bomba: el día que se agregue un estado, la UI
// mostraría uno menos sin que el compilador diga nada.
// =============================================================================

/** El ESTADO de producción de un guion: dónde está entre "MaKo lo escribió" y
 *  "hay un anuncio corriendo con esto". El ORDEN del array ES el avance del
 *  pipeline (lo usa la UI para dibujar el paso siguiente). */
export const ESTADOS_GUION = ['borrador', 'aprobado', 'grabado', 'publicado'] as const;
export type EstadoGuion = (typeof ESTADOS_GUION)[number];

export const ESTADO_GUION_LABEL: Record<EstadoGuion, string> = {
  borrador: 'Borrador', aprobado: 'Aprobado', grabado: 'Grabado', publicado: 'Publicado',
};

/**
 * El TONO semántico de cada estado (los seis de app/_ui/tokens.ts). Es lo que
 * consume `<Status>`, así que el estado de un guion se ve igual que cualquier
 * otro estado de la app.
 *
 * Ojo con el dorado: `aprobado` era `var(--accent)` y eso está mal según la
 * regla de color de globals.css — el dorado significa «acá intervino MaKo», no
 * «esto avanzó». Aprobar es un acto del dueño, así que va en azul (`info`).
 */
export const TONO_ESTADO_GUION: Record<EstadoGuion, 'neutral' | 'info' | 'warn' | 'good'> = {
  borrador: 'neutral', aprobado: 'info', grabado: 'warn', publicado: 'good',
};

/** El color crudo del punto, para donde no llega `<Status>`. Derivado del tono. */
export const COLOR_ESTADO_GUION: Record<EstadoGuion, string> = {
  borrador: 'var(--faint)', aprobado: 'var(--primary)', grabado: 'var(--warn)', publicado: 'var(--good)',
};

/** El estado más avanzado de un conjunto — «¿cómo viene este anuncio?» de un
 *  vistazo. Sin guiones no hay estado: devuelve null y la UI muestra el vacío. */
export function estadoMasAvanzado(estados: EstadoGuion[]): EstadoGuion | null {
  let mejor = -1;
  for (const e of estados) mejor = Math.max(mejor, ESTADOS_GUION.indexOf(e));
  return mejor < 0 ? null : ESTADOS_GUION[mejor];
}

export const esEstadoGuion = (v: unknown): v is EstadoGuion => (ESTADOS_GUION as readonly unknown[]).includes(v);

/** Un guion de video de una celda de la matriz. Una celda puede tener VARIOS —
 *  uno por ángulo — y cada uno se testea por separado.
 *  · creadoEn = epoch ms. 0 = guion viejo, anterior al campo: se muestra "sin
 *    fecha", NUNCA se le inventa una (falsearía el filtro por fecha).
 *  · estructuraId/Nombre = con qué estructura se escribió (PAS, AIDA, BAB…),
 *    para poder agrupar y comparar por estructura y no solo por ángulo. */
export type GuionItem = {
  id: string; anguloId: string; anguloNombre: string; texto: string;
  creadoEn: number; estado: EstadoGuion; estructuraId: string; estructuraNombre: string;
  /**
   * Los formatos con los que este guion YA se grabó, por id de puesta
   * (lib/puestas-data.ts). Ausente = no se grabó, o se grabó antes de que este
   * campo existiera.
   *
   * Va aquí y no en el historial del Video Generator porque el historial guarda
   * 10 entradas y se recorta solo: sirve para «recuperar el de ayer», no para
   * contestar «¿este guion ya lo grabé?». Un guion grabado hace tres meses tiene
   * que seguir figurando como grabado.
   *
   * Un mismo guion puede tener VARIOS: el primer anuncio de Mauricio se grabó dos
   * veces, en Car Talks y en The Office, y son dos anuncios distintos con el
   * mismo texto.
   */
  grabadoComo?: string[];
};

/** La fecha de un guion, lista para mostrar. Los guiones viejos no tienen: se
 *  dice, no se disimula con la fecha de hoy. */
export function fechaGuion(creadoEn: number): string {
  if (!creadoEn) return 'sin fecha';
  return new Date(creadoEn).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Clave YYYY-MM-DD local, para comparar contra los <input type="date"> de los
 *  filtros. `toISOString()` no sirve: pasa a UTC y un guion de la noche cae en
 *  el día siguiente, así que el filtro "hasta hoy" lo dejaba afuera. */
export function diaGuion(creadoEn: number): string {
  if (!creadoEn) return '';
  const d = new Date(creadoEn);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
