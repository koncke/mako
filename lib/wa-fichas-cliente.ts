// =============================================================================
// Pedirle a la extensión de MaKo las fichas de SU WhatsApp Web (24/10/2026) — lado de la página
// =============================================================================
// Martín: «lo que yo te pido es con la extensión de MaKo... que se extraiga los nombres y la información pública». La
// extensión (extension/wa-fichas.js) lee lo que el WhatsApp Web de la persona ya guardó en su navegador, sin clics ni red. Esto
// es el pedido desde la página de MaKo: un evento con los teléfonos (sólo los de leads que ya están en su CRM), y la respuesta
// por evento con el mismo `id` (extension/mako-puente.js hace de mensajero). Sin `server-only`: lo usa un client component.

import { esMasVieja } from './version-comparar';

/** La primera versión de la extensión que lee las fichas de WhatsApp Web. */
export const VERSION_FICHAS = '0.70.0';

/** ¿La extensión de ESTE navegador lee fichas? 'no' = no está; 'vieja' = está, sin esto (hay que actualizarla). */
export function extensionLeeFichas(): 'si' | 'vieja' | 'no' {
  if (typeof document === 'undefined') return 'no';
  const v = document.documentElement.getAttribute('data-mako-puente');
  if (!v) return 'no';
  return esMasVieja(v, VERSION_FICHAS) ? 'vieja' : 'si';
}

export type DiagnosticoFichas = { base: boolean; stores?: string[]; contactos?: number; grupos?: number; participantes?: number; pedidos?: number; conFicha?: number };
export type RespuestaFichas = { ok: true; fichas: unknown[]; diagnostico: DiagnosticoFichas | null } | { ok: false; motivo: string; error?: string };

/** Le pide a la extensión las fichas de esos teléfonos. Nunca tira: sin respuesta en `esperaMs`, `{ ok: false }`. */
export function pedirFichasDeWhatsappWeb(telefonos: readonly string[], esperaMs = 20_000): Promise<RespuestaFichas> {
  return new Promise((resolve) => {
    const id = `w${Date.now()}${Math.random()}`;
    const al = (ev: Event) => {
      const d = ((ev as CustomEvent).detail ?? {}) as Record<string, unknown>;
      if (d.id !== id) return;
      clearTimeout(reloj);
      window.removeEventListener('MAKO_WA_FICHAS', al);
      resolve(d.ok === true
        ? { ok: true, fichas: Array.isArray(d.fichas) ? d.fichas : [], diagnostico: (d.diagnostico as DiagnosticoFichas) ?? null }
        : { ok: false, motivo: typeof d.motivo === 'string' ? d.motivo : 'error', ...(typeof d.error === 'string' ? { error: d.error } : {}) });
    };
    const reloj = setTimeout(() => { window.removeEventListener('MAKO_WA_FICHAS', al); resolve({ ok: false, motivo: 'sin_respuesta' }); }, esperaMs);
    window.addEventListener('MAKO_WA_FICHAS', al);
    window.dispatchEvent(new CustomEvent('MAKO_WA_FICHAS_PIDO', { detail: { id, telefonos: [...telefonos] } }));
  });
}

/** Qué hacer, dicho, para cada motivo de la extensión. */
export function motivoDeFichas(motivo: string): string {
  switch (motivo) {
    case 'sin_whatsapp_web': return 'Abre WhatsApp Web en otra pestaña de este navegador y vuelve a tocar.';
    case 'recargar_whatsapp_web': return 'Recarga la pestaña de WhatsApp Web (la extensión se actualizó) y vuelve a tocar.';
    case 'sin_base': return 'WhatsApp Web todavía no terminó de cargar tus chats: espera un momento y vuelve a tocar.';
    case 'extension': return 'No encontré la extensión de MaKo en este navegador.';
    case 'sin_respuesta': return 'La extensión no contestó: revisa que esté activa y que WhatsApp Web esté abierto.';
    default: return 'No pude leer tu WhatsApp Web.';
  }
}
