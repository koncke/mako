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
import { reclamarEspaciado } from './espaciado';
import { estadoAviso } from './perfil';
import { frecuenciaEfectiva, idDeMensaje } from './disparador-mensaje';
import { getWorkspaceActual, OWNER_WS } from './workspace';
import { destinosDelReporte } from './reporte-destino';


export type ResultadoDespacho = {
  notifId: number | null;
  wa: 'enviado' | 'pendiente' | 'no';
  email: boolean;
  /** a cuántos destinatarios salió por cada canal (un negocio puede tener varios). */
  destinos?: { wa: number; email: number };
  /** no salió porque el negocio lo espació en el detalle del mensaje. */
  espaciado?: boolean;
};

export async function despacharReporte(rep: Reporte, canal: CanalPrefs, perfil: ContactoReportes): Promise<ResultadoDespacho> {
  // Un negocio puede tener varios destinatarios (el dueño, la asistente, el
  // ⚠️ CADA CUÁNTO, COMO MÁXIMO — el mismo control que los avisos, aplicado acá.
  //
  // Va en `despacharReporte` y no en los tres crons por la regla de la casa: lo que vale
  // para todos se escribe donde pasan todos. Puesto en cada route serían tres copias y
  // la tercera —o el reporte que se agregue mañana— nacería sin la protección.
  //
  // ⚠️ Y VA ANTES DEL FEED, al revés que en los avisos, porque para un reporte el feed ES
  // el mensaje: no hay un hecho aparte que valga la pena registrar. Un aviso espaciado
  // deja su fila (el evento pasó igual); un reporte espaciado no ocurrió.
  //
  // El reclamo es ATÓMICO por lo mismo que el de los avisos, y el `Math.max` de
  // `frecuenciaEfectiva` con el piso en 0 deja el comportamiento de hoy cuando nadie
  // eligió nada: los crons ya cortan por `canal.activo` y por su propia cadencia.
  const wsRep = (await getWorkspaceActual()) ?? OWNER_WS;
  const idMsg = idDeMensaje(rep.tipo);
  const minutos = frecuenciaEfectiva(0, (await estadoAviso(wsRep, idMsg)).frecuenciaMin);
  if (minutos && !(await reclamarEspaciado(wsRep, idMsg, minutos))) {
    return { notifId: null, wa: 'no', email: false, destinos: { wa: 0, email: 0 }, espaciado: true };
  }

  // contador). `perfil` sigue trayendo el principal porque lo usan el nombre del
  // saludo y la apertura de la ventana de 24h; el reparto sale de la lista.
  //
  // ⚠️ `wsRep` y `getDestinatarios()` resuelven el workspace del CONTEXTO, y el `?? OWNER_WS`
  // sólo vale fuera de todo `runWithWorkspace`. Desde el 06/10/2026 el cron semanal llama
  // esto adentro del workspace de CADA cliente: ahí los dos son del cliente, nunca del ws1.
  // La regla de «la lista y, si está vacía, el contacto suelto» vive en lib/reporte-destino.ts
  // porque el cron la necesita ANTES, para decidir si saltear al que no tiene a quién.
  const { telefonos, emails } = destinosDelReporte(await getDestinatarios(), perfil);
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
//
// ⚠️ MEDIDO EL 06/10/2026: la tabla `notificaciones` (mig 0048) NO EXISTE en producción
// (PGRST205), así que `crearNotificacion` devuelve null y esta cola está vacía siempre. Y
// la 0048 no le pone `workspace_id` ni la tabla está en TENANT_TABLES: aplicada tal cual,
// `pendientesWhatsapp()` traería los semanales pendientes de TODOS los clientes, y este
// flush —que corre en el contexto del dueño— se los mandaría a los teléfonos del ws1.
// Antes de aplicarla: `workspace_id` en la tabla y el filtro en la lectura.
export async function flushPendientesWhatsapp(perfil: ContactoReportes): Promise<{ enviados: number; pendientes: number }> {
  const { telefonos } = destinosDelReporte(await getDestinatarios(), perfil);
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
