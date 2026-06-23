// =============================================================================
// Telegram — notificaciones a Mauricio (bot "Setter Mauricio Bustos")
// =============================================================================
// La app le pega directo a la API de Telegram. Token en TELEGRAM_MB_BOT_TOKEN;
// chat destino en TELEGRAM_MB_CHAT_ID (default: el grupo que ya usaba n8n).
// Silencioso por diseño: un fallo de notificación no debe romper nada.
// =============================================================================

import 'server-only';

export async function notificarTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_MB_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_MB_CHAT_ID || '-5153581800';
  if (!token) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    return r.ok;
  } catch (err) {
    console.error(`[telegram] ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}
