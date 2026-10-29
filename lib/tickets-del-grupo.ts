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
import { WS_CON_CUIDADO, ticketQueAcabaDeNombrar, type TicketAbierto } from './despacho-grupo';

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
  /** Una ACCIÓN que MaKo no hace sola y DELEGA al Cerebro (lib/despacho-grupo.ts): es un «pedido», y el Runner se lo lleva como
   *  «Pedido delegado #N». */
  delegado?: boolean;
  /** Lo que MaKo ya leyó para el DEBUG (`diagnosticar_negocio`): la evidencia, para que el Cerebro no tenga que volver a mirarlo. */
  evidencia?: string;
  /** Lo que el turno YA hizo o propuso de un pedido compuesto (los nombres de las herramientas): lo demás es lo delegado. */
  hecho?: readonly string[];
};

// Las piezas puras (el número que acaba de nombrar, la respuesta fija) viven en lib/despacho-grupo.ts, sin `server-only`: sus tests
// corren también sin `--conditions=react-server` (tests-afectados).
export { respuestaDelTicket, ticketQueAcabaDeNombrar, type TicketAbierto } from './despacho-grupo';

/** Abre el ticket (o lo suma al que MaKo acaba de nombrar). null si no se pudo: quien llama lo dice, no inventa un número. */
export async function abrirTicketDelGrupo(t: TicketDelGrupo): Promise<TicketAbierto | null> {
  // Un pedido delegado es otra cosa que el ticket recién nombrado: no se suma.
  const previo = t.delegado ? null : ticketQueAcabaDeNombrar(t.ultimoDeMaKo);
  if (previo && (await sumarAlPedidoDelNegocio(t.ws, previo, `${t.pedido}\n\n(lo sumó MaKo: ${t.clasificacion.porque})`).catch(() => false))) {
    return { id: previo, sumado: true };
  }
  const identidad = await identidadDelActor(t.ws, t.actor).catch(() => null);
  if (!identidad) return null;
  const titulo = t.resumen.trim() || t.pedido.trim().slice(0, 120);
  const descripcion = [
    t.delegado ? 'ACCIÓN DELEGADA: la pidieron en el grupo y MaKo no la hace sola (no es una de sus escrituras simples). Elige el jefe, el modelo y el esfuerzo; al terminar, cierra el ticket con la respuesta: qué quedó hecho y el link de MaKo donde verlo (le llega al grupo).' : '',
    t.ws === WS_CON_CUIDADO ? '⚠️ Es del ws1 (Mauricio): se ejecuta con el cuidado del ws1.' : '',
    `Lo que escribió en el grupo de WhatsApp, tal cual: «${t.pedido.trim().slice(0, 2500)}»`,
    t.ultimoDeMaKo ? `Lo que MaKo había dicho justo antes: «${t.ultimoDeMaKo.trim().slice(0, 800)}»` : '',
    t.evidencia ? `Lo que MaKo ya miró (diagnosticar_negocio):\n${t.evidencia.slice(0, 3000)}` : '',
    t.hecho?.length ? `Lo que MaKo YA hizo o dejó propuesto en el grupo (no lo repitas): ${t.hecho.join(', ')}. Lo que falta es el resto del pedido.` : '',
    `Por qué ${t.delegado ? 'se delega' : 'es un ticket'}: ${t.clasificacion.porque}`,
  ].filter(Boolean).join('\n\n');
  // El pedido delegado lleva su propia referencia: el mismo mensaje puede dejar además un ticket (la secundaria TICKET).
  const ref = `wa:${t.ws}:${createHash('sha256').update(`${t.jid}|${t.msgId}${t.delegado ? '|delegado' : ''}`).digest('hex').slice(0, 16)}`;
  const creado = await crearTicket({
    identidad, tipo: t.delegado ? 'pedido' : null, declaradoPor: 'persona', titulo, descripcion, canal: 'whatsapp', ref,
    contexto: { superficie: 'whatsapp', pedido: t.pedido.slice(0, 1000), clasificacion: t.clasificacion, ...(t.delegado ? { delegado: true } : {}) },
  }).catch(() => null);
  if (!creado || !creado.ok) return null;
  return { id: creado.id, sumado: false };
}
