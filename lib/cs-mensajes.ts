// =============================================================================
// cs-mensajes — lo que MaKo le escribe al cliente, y quién aprieta enviar
// =============================================================================
// EL BUCLE TENÍA IDA Y NO TENÍA VUELTA. El cliente contestaba, se hacía la
// sesión, MaKo reescribía su respuesta… y el bloque quedaba esperando su ok para
// siempre, porque nadie le avisaba. Y el link se lo mandaba Mauricio a mano,
// copiando el token de la pantalla y pegándolo en WhatsApp.
//
// ⚠️ MAKO NO LE ESCRIBE A UN CLIENTE SOLO. Deja un BORRADOR en la cola y lo manda
// un humano con un click. No es prudencia genérica: es la regla que el propio
// repo escribió en la migración 0074 —«a leads calientes la app NUNCA dispara
// automático directo por el número no oficial»— y acá pesa el doble, porque el
// destinatario es un cliente que paga y el remitente es el consultor, no la app.
//
// La única excepción es cuando MAURICIO APRIETA EL BOTÓN: ahí el click ES la
// aprobación y el mensaje sale derecho. Esa distinción está en el nombre de cada
// función y no se mezcla.
//
// LOS TEXTOS SON DE MAURICIO, NO DE MAKO. Le habla a un empresario mexicano de
// cincuenta y pico, así que van en tuteo y sin una sola palabra de metodología.
// MaKo no firma ni se nombra: el que escribe es su consultor.

import 'server-only';
import { crearBorrador } from './evolution-envio';
import { getTenantDb } from './workspace';
import { rotuloDe } from './programa-catalogo';
import { APP_BASE_URL } from './app-url';

/** El primer nombre. «Estimado Rosina Patricia Muñoz López» no lo escribe nadie. */
export const primerNombre = (n: string): string => (n.trim().split(/\s+/)[0] ?? n).trim();

async function telefonoDe(leadId: number): Promise<string | null> {
  const db = await getTenantDb();
  const { data } = await db.from('leads').select('telefono, nombre').eq('id', leadId).maybeSingle();
  const t = (data as { telefono?: string | null } | null)?.telefono?.replace(/\D/g, '') ?? '';
  return t.length >= 8 ? t : null;
}

export type Resultado = { ok: true } | { ok: false; error: string };

const SIN_TEL = 'Ese cliente no tiene teléfono cargado en el CRM.';

// ── Lo que MaKo deja como borrador ──────────────────────────────────────────

/**
 * «Te dejé mejorada la respuesta de X, fijate si te gusta».
 *
 * Se llama cuando un bloque queda en `revisada_ia`: es el aviso que faltaba y
 * sin el cual el bucle no cierra. Un borrador por CLIENTE y por corrida, no uno
 * por bloque — si la junta tocó cinco bloques, cinco WhatsApp seguidos es spam.
 */
export async function borradorHayQueAprobar(input: {
  leadId: number; nombre: string; clases: string[];
}): Promise<Resultado> {
  const tel = await telefonoDe(input.leadId);
  if (!tel) return { ok: false, error: SIN_TEL };
  if (!input.clases.length) return { ok: false, error: 'No hay bloques para avisar.' };

  const lista = input.clases.map(id => `• ${rotuloDe(id)}`).join('\n');
  const uno = input.clases.length === 1;
  const texto = [
    `Hola ${primerNombre(input.nombre)}, te dejé ${uno ? 'mejorada la respuesta' : 'mejoradas las respuestas'} de lo que hablamos en la sesión:`,
    lista,
    `Entrá al mismo link de siempre, comparalas con lo que habías escrito y quedate con la que prefieras. Si te gusta cómo quedó, aprobala y ese bloque queda cerrado.`,
  ].join('\n\n');

  await crearBorrador({ leadId: input.leadId, telefono: tel, texto, origen: 'mako' });
  return { ok: true };
}

/**
 * «Viste la clase y quedó sin contestar».
 *
 * Es el recordatorio que justifica que `visto_at` exista separado de
 * `contestada_at`: al que ni la abrió hay que decirle otra cosa.
 */
export async function borradorVioYNoContesto(input: {
  leadId: number; nombre: string; clases: string[];
}): Promise<Resultado> {
  const tel = await telefonoDe(input.leadId);
  if (!tel) return { ok: false, error: SIN_TEL };
  if (!input.clases.length) return { ok: false, error: 'No hay bloques para recordar.' };

  const uno = input.clases.length === 1;
  const texto = [
    `Hola ${primerNombre(input.nombre)}, vi que ${uno ? 'miraste la clase' : 'miraste las clases'}:`,
    input.clases.map(id => `• ${rotuloDe(id)}`).join('\n'),
    `${uno ? 'La tarea' : 'Las tareas'} todavía ${uno ? 'está' : 'están'} sin contestar. Es la parte que hace que la sesión sirva: sin eso llegamos a debatir sobre nada.`,
    `Está en el mismo link de siempre. Si algo no lo tenés, escribí «no lo tengo» y quién debería tenerlo — un hueco identificado vale más que una cifra inventada.`,
  ].join('\n\n');

  await crearBorrador({ leadId: input.leadId, telefono: tel, texto, origen: 'mako' });
  return { ok: true };
}

// ── Lo que sale derecho porque Mauricio apretó el botón ─────────────────────

/**
 * Le manda el link. Acá NO hay borrador: el click de Mauricio es la aprobación,
 * y hacerle aprobar dos veces lo mismo es ruido.
 *
 * ⚠️ El token lo pone el CÓDIGO y no pasa por ningún modelo. Un link es 43
 * caracteres al azar sin ninguna redundancia: si lo transporta un LLM, falla de
 * dos formas y la silenciosa es peor —un link que resuelve a otra cosa—. Es la
 * regla de AGENTS.md sobre los datos exactos.
 */
export async function mandarElLink(input: {
  leadId: number; nombre: string; token: string;
}): Promise<Resultado> {
  const tel = await telefonoDe(input.leadId);
  if (!tel) return { ok: false, error: SIN_TEL };

  const texto = [
    `Hola ${primerNombre(input.nombre)}, acá va tu link para las tareas del programa:`,
    `${APP_BASE_URL}/compartido/${input.token}`,
    `No hace falta usuario ni contraseña, se abre directo. Guardalo: es el mismo para todo el programa.`,
    `Cada bloque tiene un video y una tarea. Dejá la tarea contestada antes de la sesión: ahí la debatimos y la afinamos.`,
  ].join('\n\n');

  const { enviarYEspejar } = await import('./evolution-envio');
  const r = await enviarYEspejar({ telefono: tel, texto, leadId: input.leadId });
  return r.ok ? { ok: true } : { ok: false, error: r.error ?? 'No se pudo enviar.' };
}
