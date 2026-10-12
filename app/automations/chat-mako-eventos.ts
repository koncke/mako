'use client';
// =============================================================================
// chat-mako-eventos — «algo entró al chat de MaKo de una automatización»
// =============================================================================
// Decimotercera tanda (12/10/2026, punto 7): lo que propone «MaKo te ayuda a escribirlo» en una tarjeta entra al chat
// de MaKo de esa automatización (lo guarda la ruta del ✦, app/api/chat-agent/redactar/route.ts, y lo devuelve en
// `chat`). Si el chat está montado (abierto, o escondido detrás de la tarjeta abierta), lo suma al momento, sin releer.
//
// Vive aparte de ChatMako.tsx a propósito: lo importa el panel del ✦ (MakoRedacta.tsx), que va en cada editor, y no
// tiene por qué arrastrar el hilo de WhatsApp entero.

import { useEffect, useRef } from 'react';
import { sanearChat, type MensajeChatMako } from '@/lib/automatizacion-chat';

const EVENTO_CHAT = 'mako:chat-automatizacion';

/** Lo llama quien guardó mensajes en el chat de `secuenciaId` (MakoRedacta, con lo que contestó la ruta). */
export function avisarChatMako(secuenciaId: number, mensajes: unknown): void {
  if (typeof window === 'undefined' || !Array.isArray(mensajes) || !mensajes.length) return;
  window.dispatchEvent(new CustomEvent(EVENTO_CHAT, { detail: { secuenciaId, mensajes } }));
}

/** El chat de `secuenciaId` se entera de lo que entró (ya saneado: lo que no se entiende se descarta). */
export function useEscucharChatMako(secuenciaId: number, alLlegar: (ms: MensajeChatMako[]) => void): void {
  const ref = useRef(alLlegar);
  useEffect(() => { ref.current = alLlegar; });
  useEffect(() => {
    const f = (e: Event) => {
      const d = (e as CustomEvent<{ secuenciaId?: unknown; mensajes?: unknown }>).detail;
      if (!d || d.secuenciaId !== secuenciaId) return;
      const ms = sanearChat({ v: 1, mensajes: d.mensajes }).mensajes;
      if (ms.length) ref.current(ms);
    };
    window.addEventListener(EVENTO_CHAT, f);
    return () => window.removeEventListener(EVENTO_CHAT, f);
  }, [secuenciaId]);
}
