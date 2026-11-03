// =============================================================================
// tickets-avance — cuándo se le manda un email de avance a quien levantó el ticket (2/11/2026)
// =============================================================================
// Joan, por WhatsApp: «¿cómo van esos tickets?». No tenía forma de saberlo.
//
// Martín: «crea diferentes estados como para ir avisándole al usuario de cómo está avanzando su
// ticket… y también sería bueno de que se le envíe por email los avances. Y solamente cuando ya
// esté 100 % finalizado, ahí sí el mensaje de WhatsApp que ya tenemos».
//
// ⚠️ LO QUE YA EXISTÍA Y NO HUBO QUE CONSTRUIR: los estados de cara al cliente (`EstadoCliente`,
// lib/tickets-reglas.ts) y la línea de tiempo con fechas (`pasosDelTicket`). Y el WhatsApp YA sale
// sólo al final. Lo único que faltaba era avisar del avance en el medio.
//
// ⚠️ ESTE ARCHIVO ES PURO y no manda nada: decide. Lo que toca la base y Resend va aparte, para que
// la regla —que es lo que se puede equivocar— se pueda EJECUTAR en un test.
// =============================================================================

import type { EstadoCliente } from './tickets-reglas';

/** El orden en que un ticket avanza de cara a quien lo levantó. Un email sólo sale hacia ADELANTE. */
export const ORDEN_AVANCE: readonly EstadoCliente[] = ['recibido', 'en_curso', 'tu_respuesta', 'resuelto', 'cerrado'];

/**
 * Qué hitos merecen un correo.
 *
 * ⚠️ 'cerrado' NO manda correo: el cierre ya se avisa por push, por el chat y por WhatsApp
 * (`avisarPendientes`, lib/tickets-cierre.ts). Un correo más sería el cuarto aviso de lo mismo, y
 * Martín pidió explícitamente que el final siga siendo el WhatsApp que ya existe.
 */
export const HITOS_QUE_AVISAN: ReadonlySet<EstadoCliente> = new Set(['recibido', 'en_curso', 'tu_respuesta', 'resuelto']);

/** Lo que dice el asunto de cada hito. Son las palabras del pedido de Martín. */
export const ASUNTO_DEL_HITO: Record<EstadoCliente, string> = {
  recibido: 'Recibimos tu ticket',
  en_curso: 'Ya lo estamos desarrollando',
  tu_respuesta: 'Necesitamos un dato tuyo',
  resuelto: 'Tu ticket está resuelto',
  cerrado: 'Tu ticket se cerró',
};

/**
 * ¿Le toca un email de avance a este ticket?
 *
 * `ahora` es el hito de hoy; `avisado` es el último que YA se le mandó (la columna `avance_email`,
 * migración 0364).
 *
 * ⚠️ SÓLO HACIA ADELANTE, y es la regla que evita el correo por rebote. Un ticket que vuelve de
 * «esperando cliente» a «en curso» NO manda otro «ya lo estamos desarrollando»: ese hito ya se
 * avisó. Sin esto, un ticket que rebota tres veces manda tres correos iguales y el próximo lo
 * manda a spam.
 */
export function tocaAvisarAvance(ahora: EstadoCliente, avisado: EstadoCliente | null | undefined): boolean {
  if (!HITOS_QUE_AVISAN.has(ahora)) return false;
  if (!avisado) return true;
  const i = ORDEN_AVANCE.indexOf(ahora);
  const j = ORDEN_AVANCE.indexOf(avisado);
  // Un hito desconocido en la base (un valor viejo, o escrito a mano) no habilita nada: se prefiere
  // no mandar a mandar de más.
  if (i < 0 || j < 0) return false;
  return i > j;
}

/**
 * El cuerpo del correo, en palabras y sin jerga. Lleva el link, que es lo que Joan no tenía.
 *
 * ⚠️ NADA DE ESTO LO ESCRIBE UN MODELO: es texto fijo con el número que pone el código, igual que
 * la respuesta del grupo (lib/despacho-grupo.ts). Un ticket es la relación con un cliente y no se
 * la deja improvisar.
 */
export function cuerpoDelAvance(hito: EstadoCliente, t: { id: number; titulo: string }, base: string): string {
  const link = `${base.replace(/\/+$/u, '')}/tickets?t=${t.id}`;
  const linea: Record<EstadoCliente, string> = {
    recibido: 'Lo recibimos y ya está en la lista del equipo.',
    en_curso: 'El equipo lo revisó y ya lo está desarrollando.',
    tu_respuesta: 'Necesitamos que nos contestes algo para poder seguir.',
    resuelto: 'Ya está resuelto.',
    cerrado: 'Se cerró.',
  };
  return [
    `Tu ticket #${t.id}: ${t.titulo}`,
    '',
    linea[hito],
    '',
    `Puedes ver cómo va aquí: ${link}`,
  ].join('\n');
}
