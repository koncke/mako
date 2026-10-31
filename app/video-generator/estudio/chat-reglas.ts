// =============================================================================
// El chat del estudio de video — desde dónde escribe, el saludo y los arranques (puro, con test)
// =============================================================================
// SIN 'use client' y sin server-only: lo usan el chat (ChatVideo.tsx) y tests/video-estudio-chat.test.ts.
// =============================================================================

import type { Desde } from '@/lib/chat-desde';
import { ORIGEN_VIDEO_GENERATOR } from '@/lib/chat-mako-reglas';

type Abierto = { id: string; titulo: string } | null;

/**
 * Desde dónde le escriben a MaKo: la tab y el anuncio abierto (lib/chat-desde.ts → `anuncio`, que mete su `planId` en las
 * herramientas que lo piden). Siempre `editar`: el estudio es donde se arma el anuncio; nada de acá es una vista de sólo
 * mirar (la regla de AGENTS.md, «sólo edita quien está editando», la cumple la PANTALLA: este chat vive en el editor).
 */
export function desdeDelEstudio(abierto: Abierto): Desde {
  const titulo = abierto?.titulo.trim().slice(0, 80) || 'Anuncio';
  return { tab: ORIGEN_VIDEO_GENERATOR, entidad: abierto ? { tipo: 'anuncio', id: abierto.id, titulo } : null, modo: 'editar' };
}

/** El saludo del chat vacío (no se guarda: es la portada). Dice qué se le puede pedir, en una frase. */
export function saludoDelEstudio(abierto: Abierto): string {
  return abierto
    ? 'Pídeme lo que harías con los botones de este anuncio: cambiar una toma, el escenario o filmar.'
    : 'Pídeme un anuncio con uno de tus guiones, o lo que harías con los botones.';
}

/** Lo que se ofrece debajo del saludo: pedidos que MaKo resuelve con las operaciones del registro. */
export function arranquesDelEstudio(abierto: Abierto): string[] {
  return abierto
    ? ['¿En qué anda este anuncio?', 'Filma la próxima toma', 'Reescribe la toma 1 más corta']
    : ['Arma un anuncio con mi último guion', '¿Qué formatos tengo?', '¿Cuántos créditos me quedan?'];
}
