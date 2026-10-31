// =============================================================================
// estudio/filmar — por qué una toma NO se puede filmar ahora (módulo PURO, con test)
// =============================================================================
// Filmar gasta créditos de la cuenta de Google Flow del cliente, y `generarTomaAction` contesta `ok: true` SIN filmar sobre
// una toma ya filmada o en vuelo (su freno de plata). Por eso la operación del chat (lib/api-mako/areas/video-estudio.run.ts →
// filmar_toma_anuncio) hace esta pregunta ANTES de proponer y otra vez al confirmar: lo que se sabe sin escribir no puede
// quemar la confirmación ni volver como un «listo» que no filmó nada.
// El orden es el de la pantalla: primero la toma, después su escenario, después el navegador.
// =============================================================================

import type { PlanGuardado } from '../video-datos';

/** El estado de la toma, tal como lo lee video.helpers.ts (`estadoDeToma`). */
export type EstadoTomaParaFilmar = 'filmada' | 'con_error' | 'sin_poder_leer' | 'generando' | 'sin_texto' | 'sin_filmar';

export const SIN_PUENTE = 'Conecta tu navegador con Google Flow para seguir (en el estudio sale el aviso para hacerlo).';
export const PUENTE_VIEJO = 'Actualiza la extensión de MaKo para seguir.';

export function porQueNoFilmar(
  item: Pick<PlanGuardado, 'escenas' | 'imagenes'>,
  n: number,
  estado: EstadoTomaParaFilmar,
  puente: { anda: boolean; vieja: boolean },
): string | null {
  if (estado === 'filmada') return `La toma ${n} ya está filmada. Para volver a filmarla, primero descártala.`;
  if (estado === 'generando' || estado === 'sin_poder_leer') return `La toma ${n} ya se está filmando.`;
  if (estado === 'sin_texto') return `La toma ${n} no tiene texto: escríbele qué dice antes de filmarla.`;
  // ⚠️ `confirmada`, no `elegida`: la primera imagen se preselecciona sola; aprobarla la hace una persona (el mismo guard
  // de generarTomaAction, que lo pregunta en positivo).
  const escena = item.escenas?.find((s) => n >= s.desde && n <= s.hasta);
  if (!escena || !item.imagenes?.[String(escena.n)]?.confirmada) return `Antes de filmar la toma ${n}, aprueba la imagen de su escenario.`;
  if (puente.vieja) return PUENTE_VIEJO;
  if (!puente.anda) return SIN_PUENTE;
  return null;
}
