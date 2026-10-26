// =============================================================================
// grabadores/lector — lo que cada grabador sabe hacer, con UNA forma (tipos, puro)
// =============================================================================
// Cada grabador (lib/grabadores/<grabador>.ts) es un `Lector`. El que lee reuniones no llama a un grabador: llama a
// lib/grabadores/index.ts, que junta los que el negocio tiene conectados.
// =============================================================================

import type { GrabadorId, Reunion, TurnoReunion } from './reunion';

export type PaginaGrabador = { reuniones: Reunion[]; cursor: string | null };

export type Lector = {
  grabador: GrabadorId;
  /**
   * Una página de reuniones (metadata, SIN transcripción: es lo liviano). `desde` = ISO de cuándo APARECIERON en el
   * grabador (la ventana del cron: una charla de ayer subida hoy también es nueva). `conAcciones` = traer los
   * compromisos que el grabador ya detectó, si los da en el listado.
   */
  listar(opts: { desde?: string; limite?: number; cursor?: string | null; conAcciones?: boolean }): Promise<PaginaGrabador>;
  /** TODO el histórico (metadata): el Closing y el enganche al CRM lo barren entero. */
  listarTodas(opts?: { maxPaginas?: number }): Promise<Reunion[]>;
  /**
   * UNA reunión con su transcripción y su resumen. `meta` = la que ya vino del listado (para no volver a pedirla).
   * La transcripción NO se traga: si el grabador no contesta, tira `GrabadorSinRespuestaError`.
   */
  leer(id: string, meta?: Reunion): Promise<Reunion>;
  /** Sólo la transcripción (lo que piden el Closing y los gráficos con IA). */
  leerTranscripcion(id: string): Promise<TurnoReunion[]>;
  /**
   * Sólo la ficha de UNA reunión (sin transcripción). La usa el aviso de un grabador cuando la transcripción todavía no
   * está: el CRM igual engancha el link y la asistencia, y el Plan la lee cuando esté (la reintenta el cron).
   */
  meta?(id: string): Promise<Reunion>;
};
