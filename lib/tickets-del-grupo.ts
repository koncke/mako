import 'server-only';

// =============================================================================
// tickets-del-grupo — el TICKET que pide alguien en el grupo de WhatsApp lo abre el CÓDIGO (29/10/2026)
// =============================================================================
// Martín, en el grupo de SuperAdmin: «Corrige todo esto». MaKo abrió el #28, pero le contestó con relleno («Seamos honestos: tienes
// razón… te agradezco… Ya tomé nota para barrer…»). Y con Leandro, cada reporte de la automatización 680 salió como una respuesta
// del modelo que hablaba por el equipo. La clase TICKET (lib/mako-intencion-ia.ts) no pasa por el modelo: el ticket se abre acá y la
// respuesta es FIJA, con el número que escribe el código (nunca el modelo).
//
// El contrato es el de `startHitl` de Botpress (plugin HITL, MIT): título y descripción obligatorios, más los PASOS de la persona
// (lo que escribió, lo que MaKo había dicho antes) y lo que decidió el clasificador, para que se vea por qué se abrió.
// =============================================================================

import { createHash } from 'node:crypto';
import { crearTicket, identidadDelActor, sumarAlPedidoDelNegocio } from './tickets-db';

export type TicketDelGrupo = {
  ws: number;
  /** `whatsapp:…` de quien lo pidió (lib/doer-ticket.ts, `actorDeWhatsApp`). */
  actor: string | null;
  jid: string;
  /** El id del mensaje: la misma re-entrega no abre dos. */
  msgId: string;
  /** Lo que pide, en una oración (el resumen del clasificador). */
  resumen: string;
  /** Lo que escribió, tal cual (el lote entero, con sus marcas). */
  pedido: string;
  /** Lo último que dijo MaKo en el grupo: si nombra un ticket, esto es la continuación de ése. */
  ultimoDeMaKo: string | null;
  clasificacion: { clase: string; porque: string; fuente: string };
};

export type TicketAbierto = { id: number; sumado: boolean };

/** El ticket que MaKo acaba de nombrar en el grupo («Abrí el ticket #31: …»): lo que sigue de la misma persona se suma a ése. */
export function ticketQueAcabaDeNombrar(ultimoDeMaKo: string | null): number | null {
  const m = /\bticket\s+#(\d{1,9})\b/i.exec(ultimoDeMaKo ?? '');
  return m ? Number(m[1]) : null;
}

/** Lo que dice MaKo: el número, el resumen y qué va a pasar. Lo arma el código. */
export function respuestaDelTicket(t: TicketAbierto, resumen: string): string {
  const que = resumen.trim().replace(/[.\s]+$/u, '');
  return t.sumado
    ? `Lo sumé al ticket #${t.id}${que ? `: ${que}` : ''}. Lo toma el equipo y te aviso por acá cuando esté.`
    : `Abrí el ticket #${t.id}${que ? `: ${que}` : ''}. Lo toma el equipo y te aviso por acá cuando esté.`;
}

/** Abre el ticket (o lo suma al que MaKo acaba de nombrar). null si no se pudo: quien llama lo dice, no inventa un número. */
export async function abrirTicketDelGrupo(t: TicketDelGrupo): Promise<TicketAbierto | null> {
  const previo = ticketQueAcabaDeNombrar(t.ultimoDeMaKo);
  if (previo && (await sumarAlPedidoDelNegocio(t.ws, previo, `${t.pedido}\n\n(lo sumó MaKo: ${t.clasificacion.porque})`).catch(() => false))) {
    return { id: previo, sumado: true };
  }
  const identidad = await identidadDelActor(t.ws, t.actor).catch(() => null);
  if (!identidad) return null;
  const titulo = t.resumen.trim() || t.pedido.trim().slice(0, 120);
  const descripcion = [
    `Lo que escribió en el grupo de WhatsApp, tal cual: «${t.pedido.trim().slice(0, 2500)}»`,
    t.ultimoDeMaKo ? `Lo que MaKo había dicho justo antes: «${t.ultimoDeMaKo.trim().slice(0, 800)}»` : '',
    `Por qué es un ticket: ${t.clasificacion.porque}`,
  ].filter(Boolean).join('\n\n');
  const ref = `wa:${t.ws}:${createHash('sha256').update(`${t.jid}|${t.msgId}`).digest('hex').slice(0, 16)}`;
  const creado = await crearTicket({
    identidad, tipo: null, declaradoPor: 'persona', titulo, descripcion, canal: 'whatsapp', ref,
    contexto: { superficie: 'whatsapp', pedido: t.pedido.slice(0, 1000), clasificacion: t.clasificacion },
  }).catch(() => null);
  if (!creado || !creado.ok) return null;
  return { id: creado.id, sumado: false };
}
