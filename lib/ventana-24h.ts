// =============================================================================
// ventana-24h — la ventana de 24 horas del WhatsApp oficial, en función pura
// =============================================================================
// Fuera de esa ventana Meta SOLO acepta plantillas aprobadas. Un botón que
// manda texto libre a las 25 horas falla del lado de Meta, no del nuestro, y
// el cliente lee «la app está rota». Por eso el gate se calcula ANTES de
// dibujar el botón, y el servidor lo vuelve a calcular al enviar (la ventana se
// cierra sola con el reloj, sin que nadie toque nada).
//
// LA SEÑAL YA EXISTÍA EN EL REPO, no se inventa acá: `can_reply` de Chatwoot,
// mapeado en lib/chatwoot.ts como `puedeResponder`, más `last_activity_at`
// (epoch en SEGUNDOS). Es la misma señal con la que el inbox oficial decide si
// dibuja el compositor o la lista de plantillas (app/whatsapp/WhatsAppApp.tsx,
// rama `ventanaAbierta`), y la que expone /api/whatsapp/conversations.
//
// Se exigen LAS DOS, y el guard está EN POSITIVO: solo habilita un
// `puedeResponder` verdadero con una actividad parseable de hace menos de 24 h.
// Sin dato, con basura o con la actividad vieja, la ventana se trata como
// CERRADA — el modo de falla seguro es no mandar nada.
//
// ⚠️ Por qué el AND y no solo `can_reply`: `puedeResponder` nace de
// `can_reply !== false`, así que un Chatwoot que NO manda el campo se lee como
// `true`. Solo con eso, un inbox que no reporta `can_reply` dibujaría el botón
// para siempre. El AND con la actividad es lo que lo cierra, y nunca abre nada
// que `can_reply` haya cerrado: solo puede apretar el gate, nunca aflojarlo.
//
// Vive SIN `import 'server-only'` a propósito: lo importan el servidor (para
// decidir) y el test (para probarlo). Con server-only, `node --test` explota al
// importarlo y el gate se quedaría sin prueba.
// =============================================================================

export const VENTANA_24H_MS = 24 * 60 * 60 * 1000;
export const VENTANA_24H_SEG = 24 * 60 * 60;

export type SenalVentana24h = {
  /** `can_reply` de Chatwoot ya mapeado (lib/chatwoot.ts → `puedeResponder`). */
  puedeResponder: boolean;
  /** `last_activity_at` de Chatwoot: epoch en SEGUNDOS, no en ms. */
  ultimaActividadSeg: number | null | undefined;
};

/** ¿Se puede mandar texto libre por el WhatsApp oficial a esta conversación? */
export function ventanaAbierta24h(senal: SenalVentana24h, ahoraMs: number = Date.now()): boolean {
  if (!senal.puedeResponder) return false;
  const seg = senal.ultimaActividadSeg;
  if (typeof seg !== 'number' || !Number.isFinite(seg) || seg <= 0) return false;
  return ahoraMs - seg * 1000 < VENTANA_24H_MS;
}

/**
 * Cuándo vence la ventana, en epoch de SEGUNDOS (misma unidad que
 * `ventanaVenceAt` de /api/whatsapp/conversations). null si no hay con qué
 * calcularlo.
 */
export function venceVentana24h(ultimaActividadSeg: number | null | undefined): number | null {
  if (typeof ultimaActividadSeg !== 'number' || !Number.isFinite(ultimaActividadSeg) || ultimaActividadSeg <= 0) return null;
  return ultimaActividadSeg + VENTANA_24H_SEG;
}

/**
 * La frase que ve la persona cuando el borrador no tiene por dónde salir por el
 * oficial. Es el PORQUÉ del botón que no está, no un mensaje para el lead.
 */
export const MOTIVO_FUERA_DE_VENTANA = 'Fuera de la ventana de 24 h: solo salen plantillas aprobadas.';
