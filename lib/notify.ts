// =============================================================================
// notify — dispatcher: reparte un reporte a los canales según las preferencias
// =============================================================================
// El centro de notificaciones in-app (tabla notificaciones) SIEMPRE registra el
// reporte. Además, según prefs, lo empuja por email / WhatsApp.
//
// WhatsApp: se manda como TEXTO LIBRE (multilínea), que solo llega dentro de la
// ventana de 24h. Si la ventana está cerrada, el reporte queda con canal_wa =
// 'pendiente' y el cron horario lo reintenta al reabrirse (ver flushPendientesWhatsapp).
// =============================================================================

import 'server-only';
import type { Reporte } from './reportes';
import type { CanalPrefs, ContactoReportes } from './perfil';
import { getDestinatarios } from './notif-destinatarios';
import { crearNotificacion, setCanalWa, pendientesWhatsapp } from './notificaciones';
import { sendEmail, renderEmailHtml } from './resend';
import { REMITENTE_MAKO, EMAIL_MAKO } from './app-url';
import { sendTextToPhone } from './chatwoot';


export type ResultadoDespacho = {
  notifId: number | null;
  wa: 'enviado' | 'pendiente' | 'no';
  email: boolean;
  /** a cuántos destinatarios salió por cada canal (un negocio puede tener varios). */
  destinos?: { wa: number; email: number };
};

export async function despacharReporte(rep: Reporte, canal: CanalPrefs, perfil: ContactoReportes): Promise<ResultadoDespacho> {
  // Un negocio puede tener varios destinatarios (el dueño, la asistente, el
  // contador). `perfil` sigue trayendo el principal porque lo usan el nombre del
  // saludo y la apertura de la ventana de 24h; el reparto sale de la lista.
  const dest = await getDestinatarios();
  const telefonos = dest.telefonos.length > 0 ? dest.telefonos : (perfil.telefono ? [perfil.telefono] : []);
  const emails = dest.emails.length > 0 ? dest.emails : (perfil.email ? [perfil.email] : []);
  const waQuiere = canal.wa && telefonos.length > 0;

  // 1) Feed in-app (bitácora durable + cola de reintento de WhatsApp).
  const notifId = await crearNotificacion({
    tipo: rep.tipo,
    severidad: rep.severidad,
    titulo: rep.titulo,
    descripcion: rep.descripcion,
    // /configuraciones abre en Notificaciones (es la tab por default de
    // ConfigInnerTabs). Apuntaba a /perfil?tab=notificaciones, que se quedó viejo
    // cuando el panel se mudó: /perfil ya no tiene esa tab y aterrizaba en una
    // pantalla que dice «las notificaciones se configuran en Configuraciones».
    link: '/configuraciones',
    entityType: 'reporte',
    payload: { texto: rep.texto },
    canalWa: waQuiere ? 'pendiente' : 'no',
    origen: `cron:${rep.tipo}`,
  });

  const res: ResultadoDespacho = {
    notifId, wa: waQuiere ? 'pendiente' : 'no', email: false, destinos: { wa: 0, email: 0 },
  };

  // 2) Email — a cada destinatario por separado, no en copia: son personas
  // distintas del mismo negocio y no tienen por qué verse los mails entre sí.
  if (canal.email) {
    for (const to of emails) {
      const r = await sendEmail({
        to,
        // ⚠️ EL REPORTE LO MANDA MAKO, NO EL NEGOCIO DEL CLIENTE. Sin `from` esto
        // resolvía el `resend_from` DEL WORKSPACE, y un cliente que todavía no conectó
        // su dominio —casi todos— cae en el remitente SANDBOX de Resend, que entrega
        // sólo al dueño de la cuenta: el reporte no llegaba y nada lo decía. Es además
        // la regla de la casa (AGENTS.md, `OWNER_WS` no es la plataforma): lo que manda
        // MaKo se firma en el código. El molde es lib/canal-vigilante.ts.
        from: REMITENTE_MAKO,
        replyTo: EMAIL_MAKO,
        subject: rep.titulo,
        // El cuerpo va CON sus marcas: `renderEmailHtml` convierte *negrita* en
        // <strong>. Antes pasaba por un `sinMarcas` que las borraba, así que el mismo
        // reporte salía con énfasis por WhatsApp y plano por mail.
        html: renderEmailHtml({
          subject: rep.titulo, titulo: rep.titulo, bodyText: rep.texto,
          marca: 'mako', fromName: perfil.nombre,
        }),
      });
      if (r.ok) { res.email = true; res.destinos!.email += 1; }
    }
  }

  // 4) WhatsApp texto libre (solo dentro de la ventana de 24h).
  // Alcanza con que UNO llegue para no dejarlo en la cola de reintento: los que
  // fallaron tienen su propia ventana de 24h y reintentarlos a todos volvería a
  // mandarle el mismo reporte dos veces a quien ya lo recibió.
  if (waQuiere) {
    for (const tel of telefonos) {
      const r = await sendTextToPhone(tel, perfil.nombre, rep.texto);
      if (r.ok) res.destinos!.wa += 1;
    }
    if (res.destinos!.wa > 0) {
      res.wa = 'enviado';
      if (notifId) await setCanalWa(notifId, 'enviado');
    }
    // si no llegó a nadie, queda 'pendiente' → flushPendientesWhatsapp lo reintenta.
  }

  return res;
}

// Reintenta los reportes que quedaron con canal_wa='pendiente' (ventana cerrada
// al generarlos). Se llama desde el cron horario tras mandar la apertura del día.
export async function flushPendientesWhatsapp(perfil: ContactoReportes): Promise<{ enviados: number; pendientes: number }> {
  const dest = await getDestinatarios();
  const telefonos = dest.telefonos.length > 0 ? dest.telefonos : (perfil.telefono ? [perfil.telefono] : []);
  if (telefonos.length === 0) return { enviados: 0, pendientes: 0 };
  const pend = await pendientesWhatsapp();
  let enviados = 0;
  for (const n of pend) {
    const texto = typeof n.payload.texto === 'string' ? n.payload.texto : `${n.titulo}\n${n.descripcion ?? ''}`;
    let alguno = false;
    for (const tel of telefonos) {
      const r = await sendTextToPhone(tel, perfil.nombre, texto);
      if (r.ok) alguno = true;
    }
    if (alguno) { await setCanalWa(n.id, 'enviado'); enviados += 1; }
    else break; // sigue cerrada la ventana para todos → dejamos el resto pendiente
  }
  return { enviados, pendientes: pend.length - enviados };
}
