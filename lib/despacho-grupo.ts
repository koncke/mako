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

/**
 * Las escrituras SIMPLES: una sola fila o un solo evento, reversibles, con su confirmación de siempre. Lo que no está aquí se delega.
 * Afuera a propósito: lo que mueve plata (links de pago, reembolsos, bajas, suscripciones), lo que cancela, lo de las campañas y las
 * automatizaciones, y lo que cambia varias cosas a la vez.
 */
export const ACCIONES_SIMPLES: ReadonlySet<string> = new Set([
  // El CRM: una ficha, una etapa, una nota, una etiqueta, quién la atiende.
  'proponer_lead', 'proponer_cambio_etapa', 'agregar_nota_lead', 'marcar_calificado', 'asignar_closer_setter', 'poner_etiqueta_lead', 'sacar_etiqueta_lead',
  'editar_dato_deal', 'editar_venta_lead', 'editar_cuota', 'marcar_pago_cobrado',
  // La agenda: agendar, mover o cambiar UNA reunión, marcar si vino.
  'proponer_agendar_reunion', 'proponer_agendar_agenda', 'proponer_mover_reunion', 'proponer_cambiar_reunion', 'marcar_asistencia_reunion',
  'crear_evento_calendario', 'crear_evento_google',
  // El Plan: una tarea.
  'proponer_tareas_plan', 'mover_tarea_plan', 'cambiar_fecha_tarea_plan', 'actualizar_avance_tarea',
  // El «sí» y el «no» a lo que MaKo ya propuso.
  'confirmar_accion', 'cancelar_accion',
]);

export const esAccionSimple = (nombre: string): boolean => ACCIONES_SIMPLES.has(nombre);

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
export function respuestaDelTicket(t: TicketAbierto, resumen: string): string {
  const que = resumen.trim().replace(/[.\s]+$/u, '');
  return t.sumado
    ? `Lo sumé al ticket #${t.id}${que ? `: ${que}` : ''}. Lo toma el equipo y te aviso por aquí cuando esté.`
    : `Abrí el ticket #${t.id}${que ? `: ${que}` : ''}. Lo toma el equipo y te aviso por aquí cuando esté.`;
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
  if (!nombre) return `No pude mirar ${p.pedido} ahora${p.crudo && !p.leido ? ` (${p.crudo.slice(0, 120)})` : ''}.`;
  const loQueVeo = p.hechos.length ? `: ${p.hechos.join('; ')}` : '';
  return p.ticket
    ? `Lo pasé al Cerebro (ticket #${p.ticket}) con lo que veo de ${nombre}${loQueVeo}.`
    : `Miré ${nombre}${loQueVeo}. No pude abrir el ticket ahora: pásaselo al Cerebro a mano.`;
}

/** El ws del dueño de la agencia (Mauricio): lo suyo se ejecuta con cuidado (AGENTS.md, «el ws1»). */
export const WS_CON_CUIDADO = 1;
