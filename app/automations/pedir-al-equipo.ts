// =============================================================================
// pedir-al-equipo — el ticket de «eso no está en MaKo» del chat del lienzo (puro: lo leen la ruta y el test)
// =============================================================================
// 24/10/2026, f23 de la llamada con Leandro (./PedirAlEquipo.tsx). El ticket sale del chat GUARDADO de la automatización:
// el mensaje de MaKo que dijo que faltaba (`falta`) y lo que la persona le había pedido justo antes. Del navegador sólo
// viaja CUÁL es (la automatización y el texto de la falta, para encontrarlo): nada de lo que se escribe en el ticket.
// =============================================================================

import type { MensajeChatMako } from '@/lib/automatizacion-chat';

export const RUTA_FALTA = '/api/chat-agent/secuencias/ia/falta';

/** El ticket de una falta: un PEDIDO de algo que MaKo no tiene, con lo que pidió y lo que contestó MaKo. null = no está. */
export function ticketDeLaFalta(mensajes: readonly MensajeChatMako[], falta: string, automatizacion: { id: number; nombre: string }): {
  titulo: string; descripcion: string; contexto: { pedido: string; respuestaMako: string; noExiste: true; ruta: string; chat: { donde: string } };
} | null {
  const buscada = falta.replace(/\s+/g, ' ').trim();
  if (!buscada) return null;
  // La ÚLTIMA vez que MaKo lo dijo, y lo que la persona pidió antes de eso.
  let i = -1;
  for (let k = mensajes.length - 1; k >= 0; k--) if (mensajes[k].de === 'mako' && mensajes[k].falta === buscada) { i = k; break; }
  if (i < 0) return null;
  let pedido = '';
  for (let k = i - 1; k >= 0; k--) if (mensajes[k].de === 'yo') { pedido = mensajes[k].texto.trim(); break; }
  const donde = `la automatización «${automatizacion.nombre.trim() || `#${automatizacion.id}`}»`;
  return {
    titulo: buscada,
    descripcion: [`Lo pidió en el chat de MaKo de ${donde}.`, pedido ? `Pidió: «${pedido}»` : '', `MaKo contestó: «${mensajes[i].texto.trim()}»`].filter(Boolean).join('\n'),
    contexto: { pedido, respuestaMako: mensajes[i].texto, noExiste: true, ruta: `/automations?sec=${automatizacion.id}`, chat: { donde: 'automations' } },
  };
}

/** La clave de idempotencia: la misma falta de la misma automatización es UN ticket aunque se toque dos veces. */
export function refDeLaFalta(ws: number, secuenciaId: number, falta: string): string {
  let h = 0;
  for (const c of falta.replace(/\s+/g, ' ').trim().toLowerCase()) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return `automations-falta:${ws}:${secuenciaId}:${(h >>> 0).toString(36)}`;
}
