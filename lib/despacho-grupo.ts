// =============================================================================
// despacho-grupo — MaKo en el grupo es un DESPACHANTE: qué hace él y qué delega (29/10/2026; sin base: puro)
// =============================================================================
// Martín, 29/10/2026, textual: «Si al fin y al cabo sólo tiene que DELEGAR todo... Si quiere una Acción dentro de MaKo, está la API,
// se la delega al Ops Center, al cerebro, y ya el cerebro decide según lo difícil de la petición a qué jefe enviarle y a qué esfuerzo
// o modelo... Y luego le avisa cuando está listo... A menos que sea una tarea muy simple, como cambiar algo del CRM, agendar una reu o
// algo así, que lo haga directamente, eso también lo puede hacer Haiku».
//
// LA REGLA ES EN CÓDIGO, NO EN EL PROMPT (el Cerebro, 29/10): una lista CERRADA de escrituras simples —una sola fila o un solo evento,
// reversibles—. La ACCIÓN corre con ésas y las lecturas; si el turno termina sin proponer ninguna (y no está preguntando un dato que
// falta), no se manda su texto: se DELEGA. En la duda, se delega.
//
// DELEGAR es la Ticketera (medido el 29/10: no existe otra cola para el Ops Center de un negocio cliente; `operaciones_pedidos` exige
// la firma del dispositivo de Martín): un ticket «pedido» marcado `delegado`, que el Runner le lleva al Cerebro con su texto fijo
// («Pedido delegado #N»); el Cerebro elige el jefe, el modelo y el esfuerzo, y al cerrarlo el aviso le llega al grupo (el «listo»).
// =============================================================================

import { SE_APRUEBAN_EN_LA_APP } from './confirmacion-pura';
import { taparClaves } from './claves-en-el-chat';

/**
 * Las escrituras SIMPLES: una sola fila o un solo evento, reversibles, con su confirmación de siempre. Lo que no está aquí se delega.
 * Afuera a propósito: lo que mueve plata (links de pago, reembolsos, bajas, suscripciones; el presupuesto va por pantalla), lo que
 * cancela, crear o editar campañas y automatizaciones, y lo que cambia varias cosas a la vez.
 */
export const ACCIONES_SIMPLES: ReadonlySet<string> = new Set([
  // El CRM: una ficha, una etapa, una nota, una etiqueta, quién la atiende.
  'proponer_lead', 'proponer_cambio_etapa', 'agregar_nota_lead', 'marcar_calificado', 'asignar_closer_setter', 'poner_etiqueta_lead', 'sacar_etiqueta_lead',
  'editar_dato_deal', 'editar_venta_lead', 'editar_cuota', 'marcar_pago_cobrado',
  // El pago de la mensualidad de una agencia o de la entrada de un cliente (12/11/2026, Martín: «Si perfecto, dalo de alta» al
  // comprobante de Código Inmobiliario que MaKo le mandó para revisar). Sólo la plataforma (`soloPlataforma`) y con el «sí» del chat
  // (`confirmacion: 'chat'`). Sin estas, la acción se delegaba al equipo: justo lo que MaKo le acababa de preguntar a Martín.
  'marcar_entrada_pagada', 'marcar_mensualidad_pagada',
  // La agenda: agendar, mover o cambiar UNA reunión, marcar si vino.
  'proponer_agendar_reunion', 'proponer_agendar_agenda', 'proponer_mover_reunion', 'proponer_cambiar_reunion', 'marcar_asistencia_reunion',
  'crear_evento_calendario', 'crear_evento_google',
  // El Plan: una tarea.
  'proponer_tareas_plan', 'mover_tarea_plan', 'cambiar_fecha_tarea_plan', 'actualizar_avance_tarea',
  // El «sí» y el «no» a lo que MaKo ya propuso.
  'confirmar_accion', 'cancelar_accion',
  // LO QUE MARTÍN MOSTRÓ EN LA LLAMADA CON THIAGO (29/10/2026, el Cerebro: docs/promesas/2910-llamada-thiago.md, «desde el grupo, lo
  // que quieras»): replicar y analizar una landing (deja un borrador en el Web Generator, se puede borrar) y pausar o prender una
  // campaña o un anuncio (reversible; mueve plata, así que el «sí» es el puro de quien la pidió). El estado de las campañas es lectura
  // y ya viaja.
  'replicar_landing', 'analizar_landing', 'proponer_estado_campana', 'proponer_estado_anuncio',
]);

export const esAccionSimple = (nombre: string): boolean => ACCIONES_SIMPLES.has(nombre);

/**
 * LO QUE SE CONFIRMA EN UNA PANTALLA: cambiar un presupuesto (es plata). MaKo lo propone desde el grupo y el link lleva a
 * /mako/revisar, donde se aprueba (`confirmacion: 'pantalla'` en lib/api-mako/areas/ads.def.ts): no se delega, y por WhatsApp no
 * se confirma.
 */
export const ACCIONES_CON_PANTALLA: ReadonlySet<string> = new Set([
  'proponer_presupuesto_campana', 'proponer_presupuesto_conjunto',
  // «Súbeme este anuncio» con un Drive, un video o una imagen (29/10/2026; lib/anuncio-desde-archivo.ts): el anuncio queda EN PAUSA
  // y se aprueba en /mako/revisar. Detrás de ZERNIO_ANUNCIOS_PROBADO: apagada, la operación lo dice; MaKo no lo delega igual.
  'proponer_anuncio_desde_archivo',
]);

/** ¿Viaja en el turno de una ACCIÓN? Las simples, las de pantalla y el WhatsApp a un lead (que se aprueba en la app). */
export const viajaEnLaAccion = (nombre: string): boolean =>
  ACCIONES_SIMPLES.has(nombre) || ACCIONES_CON_PANTALLA.has(nombre) || SE_APRUEBAN_EN_LA_APP.has(nombre);

/** La línea que va cuando quedó propuesto un WhatsApp a un lead: sale con un toque en la app, nunca con un «sí» por aquí. */
export const lineaApruebaEnLaApp = (link: string): string => `Ese WhatsApp sale cuando lo apruebas con un toque aquí 👉 ${link}`;

// ── EL PEDIDO COMPUESTO («moveme la reunión y mandale un WhatsApp», la llamada con Thiago) ─────────────────────────────────────────
// La IA lista las PARTES de lo que pide (`partes`, lib/mako-intencion-ia.ts). El turno hace lo que puede; si hizo menos escrituras o
// propuestas que partes, lo demás va al equipo como pedido delegado. Nunca se pierde una parte en silencio. Por cantidad, a propósito:
// no se adivina qué parte fue cuál, y delegar de más cuesta un ticket; perder una parte cuesta la promesa.

/** ¿Quedó alguna parte sin hacer ni proponer? `hechas`: las escrituras o propuestas que corrieron en el turno. */
export function faltaAlgunaParte(partes: readonly string[], hechas: number): boolean {
  return partes.length >= 2 && hechas > 0 && hechas < partes.length;
}

/** La línea que dice que lo demás se delegó. El número lo escribe el código. */
export const lineaDeLoQueFalta = (id: number): string => `Lo demás que me pediste lo pasé al equipo de MaKo (pedido #${id}). Te aviso por aquí cuando esté.`;

// ── EL PEDIDO DELEGADO QUE NADIE TOMÓ (el Cerebro, 29/10/2026: «si un pedido delegado no se toma en 30 minutos, MaKo avisa») ──────────

export const MIN_SIN_TOMAR = 30;
/** Sólo los de hoy: un delegado de hace días ya no se avisa (y en el primer deploy no sale una tanda de viejos). */
export const HORAS_MAX_SIN_TOMAR = 6;

export type DelegadoSinTomar = { id: number; workspace_id: number; titulo: string; estado: string; created_at: string; canal: string | null; contexto: unknown };

/** Los delegados por WhatsApp que siguen sin tomar (nuevos o esperando la decisión) entre 30 minutos y 6 horas, y sin avisar. */
export function delegadosParaAvisar(filas: readonly DelegadoSinTomar[], yaAvisados: ReadonlySet<number>, ahoraMs: number): DelegadoSinTomar[] {
  return filas.filter((f) => {
    const edad = ahoraMs - Date.parse(f.created_at);
    const delegado = !!f.contexto && typeof f.contexto === 'object' && (f.contexto as { delegado?: unknown }).delegado === true;
    return delegado && f.canal === 'whatsapp' && ['nuevo', 'esperando_decision'].includes(f.estado) && !yaAvisados.has(f.id)
      && edad >= MIN_SIN_TOMAR * 60_000 && edad <= HORAS_MAX_SIN_TOMAR * 3600_000;
  });
}

/** Lo que dice MaKo en el grupo. Sin promesas de hora: dice dónde está. */
export const textoDelegadoSinTomar = (id: number, titulo: string): string =>
  `Tu pedido #${id} («${titulo.trim().replace(/[.\s]+$/u, '').slice(0, 120)}») todavía no lo tomó nadie del equipo: sigue en la fila. Cuando esté, te aviso por aquí.`;

/** ¿La respuesta termina pidiendo un dato que falta («¿a qué hora?»)? Entonces la acción simple sigue: no se delega todavía. */
export function preguntaUnDato(respuesta: string): boolean {
  const t = (respuesta || '').trim();
  return /\?\s*$/.test(t) || /¿[^?]{3,200}\?\s*$/.test(t.split('\n').filter(Boolean).pop() ?? '');
}

/**
 * ¿Se DELEGA la acción? Sí, si el turno terminó sin proponer ni hacer una escritura simple y no está preguntando un dato. Una
 * escritura que no es simple ni siquiera viaja (el turno de la ACCIÓN lleva sólo las simples), así que no hay otra forma de hacerla.
 * Salvo que haya LEÍDO y contestado sin decir que algo quedó hecho (`afirmaHecho`, el saneo del grupo): era un pedido de datos
 * tomado por acción («pásame la misma lista con el teléfono», conv:1563 del banco), y su respuesta es la lista.
 */
export function delegaLaAccion(t: { propuso: boolean; escribio: boolean; respuesta: string; leyo?: boolean; afirmaHecho?: boolean }): boolean {
  if (t.leyo && !t.afirmaHecho) return false;
  return !t.propuso && !t.escribio && !preguntaUnDato(t.respuesta);
}

// ── EL TICKET del grupo (lib/tickets-del-grupo.ts lo abre; esto es lo puro) ──────────────────────────────────────────────────────

export type TicketAbierto = { id: number; sumado: boolean };

/** El ticket que MaKo acaba de nombrar en el grupo («Abrí el ticket #31: …»): lo que sigue de la misma persona se suma a ése. */
export function ticketQueAcabaDeNombrar(ultimoDeMaKo: string | null): number | null {
  const m = /\bticket\s+#(\d{1,9})\b/i.exec(ultimoDeMaKo ?? '');
  return m ? Number(m[1]) : null;
}

/** Lo que dice MaKo: el número, el resumen y qué va a pasar. Lo arma el código. */
/**
 * ⚠️ LLEVA EL LINK PARA MIRAR CÓMO VA, y es un pedido de Martín del 2/11/2026 después de que Joan
 * preguntara por WhatsApp «¿cómo van esos tickets?»: «que le diga, mira el progreso de tu ticket
 * aquí, y que él pueda ir viendo: tu ticket fue levantado, el equipo lo revisó, ya lo están
 * desarrollando».
 *
 * La pantalla y los estados YA existían —`/tickets?t=<id>` dibuja la línea de tiempo del ticket
 * (`pasosDelTicket`, lib/tickets-reglas.ts: recibido → en curso → arreglado → resuelto)—. Lo que
 * faltaba era decirle que existe: la respuesta terminaba en «te aviso por aquí cuando esté», así
 * que la única forma de saber algo era esperar o preguntar, que es exactamente lo que hizo Joan.
 *
 * ⚠️ `base` ES UN PARÁMETRO Y NO UN IMPORT a propósito: este módulo es PURO (sin base de datos, sin
 * `server-only`) y sus tests lo ejecutan directo. Importar `APP_BASE_URL` arrastraría `ws-tab` y las
 * landings acá adentro. Sin `base` la frase es la de antes, palabra por palabra.
 */
export function respuestaDelTicket(t: TicketAbierto, resumen: string, base?: string): string {
  const que = resumen.trim().replace(/[.\s]+$/u, '');
  const donde = base ? ` Mira el progreso de tu ticket aquí: ${base.replace(/\/+$/u, '')}/tickets?t=${t.id}` : '';
  return t.sumado
    ? `Lo sumé al ticket #${t.id}${que ? `: ${que}` : ''}. Lo toma el equipo y te aviso por aquí cuando esté.${donde}`
    : `Abrí el ticket #${t.id}${que ? `: ${que}` : ''}. Lo toma el equipo y te aviso por aquí cuando esté.${donde}`;
}

/** Lo que dice MaKo al delegar. El número lo escribe el código. */
export function respuestaDeLaDelegacion(id: number, resumen: string): string {
  const que = resumen.trim().replace(/[.\s]+$/u, '');
  return `Lo pasé al equipo de MaKo (pedido #${id})${que ? `: ${que}` : ''}. Te aviso por aquí cuando esté.`;
}

// ── EL DEBUG (sólo el grupo de SuperAdmin): lo mira el código con `diagnosticar_negocio` y lo delega al Cerebro con la evidencia ──

/** El nombre del negocio que leyó `diagnosticar_negocio`, si lo encontró (uno solo). */
export function negocioLeido(leido: Record<string, unknown> | null): string | null {
  const n = leido?.negocio as { nombre?: unknown } | undefined;
  return leido && leido.encontrado !== false && n && typeof n.nombre === 'string' && n.nombre.trim() ? n.nombre.trim() : null;
}

/**
 * Lo que dice MaKo en un DEBUG, armado por el código: sin el negocio, lo pregunta; con varios, nombra los candidatos; encontrado, el
 * número del ticket y 2 o 3 hechos de la lectura (`hechosDelDiagnostico`). `ticket`: el número, o null si no se pudo abrir.
 */
export function respuestaDelDebug(p: { pedido: string; leido: Record<string, unknown> | null; crudo: string; hechos: readonly string[]; ticket?: number | null }): string {
  if (!p.pedido.trim()) return '¿De qué negocio es? Dime su nombre y lo miro.';
  if (p.leido && p.leido.encontrado === false) {
    const cand = Array.isArray(p.leido.candidatos) ? (p.leido.candidatos as Array<{ ws: number; nombre: string }>) : [];
    return cand.length
      ? `«${p.pedido}» calza con más de un negocio: ${cand.slice(0, 4).map((c) => `${c.nombre} (${c.ws})`).join(', ')}. ¿Cuál es?`
      : `No encontré un negocio que se llame «${p.pedido}». ¿Cuál es?`;
  }
  const nombre = negocioLeido(p.leido);
  // El texto crudo de la lectura, sin claves (la revisión de privacidad, B3).
  if (!nombre) return `No pude mirar ${p.pedido} ahora${p.crudo && !p.leido ? ` (${taparClaves(p.crudo).texto.slice(0, 120)})` : ''}.`;
  const loQueVeo = p.hechos.length ? `: ${p.hechos.join('; ')}` : '';
  return p.ticket
    ? `Lo pasé al Cerebro (ticket #${p.ticket}) con lo que veo de ${nombre}${loQueVeo}.`
    : `Miré ${nombre}${loQueVeo}. No pude abrir el ticket ahora: pásaselo al Cerebro a mano.`;
}

/** El ws del dueño de la agencia (Mauricio): lo suyo se ejecuta con cuidado (AGENTS.md, «el ws1»). */
export const WS_CON_CUIDADO = 1;
