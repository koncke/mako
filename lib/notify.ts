// =============================================================================
// notify — dispatcher: reparte un reporte a los canales según las preferencias
// =============================================================================
// El centro de notificaciones in-app (tabla notificaciones) SIEMPRE registra el
// reporte. Además, según prefs, lo empuja por Telegram / email / WhatsApp.
//
// WhatsApp: se manda como TEXTO LIBRE (multilínea), que solo llega dentro de la
// ventana de 24h. Si la ventana está cerrada, el reporte queda con canal_wa =
// 'pendiente' y el cron horario lo reintenta al reabrirse (ver flushPendientesWhatsapp).
// =============================================================================

import 'server-only';
import type { Reporte } from './reportes';
import type { CanalPrefs, Perfil } from './perfil';
import { crearNotificacion, setCanalWa, pendientesWhatsapp } from './notificaciones';
import { notificarTelegram } from './telegram';
import { sendEmail, renderEmailHtml } from './resend';
import { sendTextToPhone } from './chatwoot';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// El texto usa *negrita* estilo WhatsApp; para Telegram/email/feed quitamos los *.
function sinMarcas(s: string): string {
  return s.replace(/\*(.+?)\*/g, '$1');
}

export type ResultadoDespacho = {
  notifId: number | null;
  wa: 'enviado' | 'pendiente' | 'no';
  telegram: boolean;
  email: boolean;
};

export async function despacharReporte(rep: Reporte, canal: CanalPrefs, perfil: Perfil): Promise<ResultadoDespacho> {
  const waQuiere = canal.wa && !!perfil.telefono;

  // 1) Feed in-app (bitácora durable + cola de reintento de WhatsApp).
  const notifId = await crearNotificacion({
    tipo: rep.tipo,
    severidad: rep.severidad,
    titulo: rep.titulo,
    descripcion: rep.descripcion,
    link: '/perfil?tab=notificaciones',
    entityType: 'reporte',
    payload: { texto: rep.texto },
    canalWa: waQuiere ? 'pendiente' : 'no',
    origen: `cron:${rep.tipo}`,
  });

  const res: ResultadoDespacho = { notifId, wa: waQuiere ? 'pendiente' : 'no', telegram: false, email: false };

  // 2) Telegram.
  if (canal.telegram) {
    res.telegram = await notificarTelegram(`<b>${escapeHtml(rep.titulo)}</b>\n${escapeHtml(sinMarcas(rep.texto))}`);
  }

  // 3) Email.
  if (canal.email && perfil.email) {
    const r = await sendEmail({
      to: perfil.email,
      subject: rep.titulo,
      html: renderEmailHtml({ subject: rep.titulo, bodyText: sinMarcas(rep.texto), fromName: perfil.nombre }),
    });
    res.email = r.ok;
  }

  // 4) WhatsApp texto libre (solo dentro de la ventana de 24h).
  if (waQuiere) {
    const r = await sendTextToPhone(perfil.telefono, perfil.nombre, rep.texto);
    if (r.ok) {
      res.wa = 'enviado';
      if (notifId) await setCanalWa(notifId, 'enviado');
    }
    // si falla, queda 'pendiente' → flushPendientesWhatsapp lo reintenta.
  }

  return res;
}

// Reintenta los reportes que quedaron con canal_wa='pendiente' (ventana cerrada
// al generarlos). Se llama desde el cron horario tras mandar la apertura del día.
export async function flushPendientesWhatsapp(perfil: Perfil): Promise<{ enviados: number; pendientes: number }> {
  if (!perfil.telefono) return { enviados: 0, pendientes: 0 };
  const pend = await pendientesWhatsapp();
  let enviados = 0;
  for (const n of pend) {
    const texto = typeof n.payload.texto === 'string' ? n.payload.texto : `${n.titulo}\n${n.descripcion ?? ''}`;
    const r = await sendTextToPhone(perfil.telefono, perfil.nombre, texto);
    if (r.ok) { await setCanalWa(n.id, 'enviado'); enviados += 1; }
    else break; // sigue cerrada la ventana → dejamos el resto pendiente
  }
  return { enviados, pendientes: pend.length - enviados };
}
