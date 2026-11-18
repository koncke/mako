// =============================================================================
// Bloqueo de contactos del WhatsApp no oficial (F4) — a nivel app/CRM.
// Evolution v2.3.7 no expone endpoint de bloqueo, así que bloqueamos por teléfono
// en wa_bloqueados: el motor de nutrición NO le manda y el inbox lo muestra.
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { leerTodo } from '@/lib/supabase-paginado';
import { TelefonosDe, sufijoDeBusqueda } from '@/lib/numero-whatsapp';

const norm = (t: string) => (t || '').replace(/\D/g, '');

// ⚠️ LA IDENTIDAD DE UN BLOQUEO ES UNA SOLA REGLA (21/10/2026, cuarta revisión de la 2.1): `TelefonosDe` /
// `mismoContacto` (lib/numero-whatsapp.ts). Se guardaba un formato y se preguntaba por otro con igualdad EXACTA: un
// contacto bloqueado desde /chats (542233550684) seguía recibiendo la secuencia, el AI Step, la rama y los recordatorios
// (el CRM tiene 2233550684), y desde el 20/10 el mensaje le LLEGA porque el envío completa el país. Con la regla acá, la
// heredan todos los caminos que preguntan `estaBloqueado`, sin tocar cada llamada. Desbloquear borra TODAS las formas, y
// las listas (/whatsapp, /chats) marcan con la misma regla.

/** Las filas de `tabla` que son ESE contacto, en cualquier forma del número. */
async function filasDelContacto(tabla: 'wa_bloqueados' | 'wa_ocultos', telefono: string | null | undefined): Promise<string[]> {
  const tel = norm(String(telefono ?? ''));
  if (!tel) return [];
  const sufijo = sufijoDeBusqueda(tel);
  const db = await getTenantDb();
  const q = db.from(tabla).select('telefono');
  const { data, error } = await (sufijo ? q.like('telefono', `%${sufijo}`) : q.eq('telefono', tel)).limit(200);
  if (error) throw new Error(`No pude leer ${tabla}: ${error.message}`);
  const este = new TelefonosDe([tel]);
  return [...new Set(((data ?? []) as Array<{ telefono: string | null }>).map((r) => norm(r.telefono ?? '')).filter((t) => t && este.has(t)))];
}

export async function bloquearContacto(telefono: string, opts: { leadId?: number | null; motivo?: string; por?: string } = {}): Promise<void> {
  const tel = norm(telefono);
  if (!tel) return;
  const supabase = await getTenantDb();
  await supabase.from('wa_bloqueados').upsert(
    { telefono: tel, lead_id: opts.leadId ?? null, motivo: opts.motivo ?? null, created_by: opts.por ?? null },
    { onConflict: 'workspace_id,telefono', ignoreDuplicates: true },
  );
}

/**
 * Desbloquea al CONTACTO: borra todas las formas de su número. ⚠️ Borraba sólo la exacta: bloqueado con dos formatos (MaKo
 * guarda el del CRM y el del espejo) y desbloqueado desde /whatsapp o /chats, quedaba la otra fila; la pantalla lo
 * mostraba desbloqueado y la puerta lo seguía frenando, y desbloquear otra vez no lo destrababa.
 */
export async function desbloquearContacto(telefono: string): Promise<void> {
  const filas = await filasDelContacto('wa_bloqueados', telefono);
  if (!filas.length) return;
  const { error } = await (await getTenantDb()).from('wa_bloqueados').delete().in('telefono', filas);
  if (error) throw new Error(`No pude desbloquear: ${error.message}`);
}

/**
 * ¿Está bloqueado, en CUALQUIER forma del número? La pregunta de los caminos AUTOMÁTICOS: la secuencia, el AI Step, la
 * rama, los recordatorios de reunión y los cursos. NO tira, como siempre: si no puede leer, lo dice en el log y contesta
 * «no» (esos caminos corren en un bucle sin `try` por contacto, y un error cortaría la vuelta de todos).
 */
export async function estaBloqueado(telefono: string | null | undefined): Promise<boolean> {
  try {
    return await estaBloqueadoEstricto(telefono);
  } catch (e) {
    console.error('[evolution-block] no pude leer los bloqueados:', e instanceof Error ? e.message : e);
    return false;
  }
}

/** Lo mismo, para un envío que aprueba una PERSONA (la puerta de los borradores, MaKo): si no puede leer, tira y no sale. */
export async function estaBloqueadoEstricto(telefono: string | null | undefined): Promise<boolean> {
  return (await filasDelContacto('wa_bloqueados', telefono)).length > 0;
}

/**
 * Los teléfonos de `tabla` ENTEROS, paginados (P20, 18/11/2026). Un `.select()` plano cortaba en 1000 filas sin error:
 * pasado ese número, un bloqueado no salía marcado en /whatsapp ni en /chats, y un oculto volvía a aparecer en la
 * bandeja y en MaKo. Orden por `id` (PK). Si la lectura falla, la lista vacía, como el `.select()` de antes (que no
 * miraba el error), pero lo deja en el log. Lo que DECIDE un envío no pasa por aquí: pregunta `estaBloqueado`.
 */
async function telefonosDe(tabla: 'wa_bloqueados' | 'wa_ocultos'): Promise<TelefonosDe> {
  const db = await getTenantDb();
  try {
    const filas = await leerTodo<{ telefono: string | null }>(db, tabla, 'id, telefono', { orden: 'id' });
    return new TelefonosDe(filas.map((r) => r.telefono));
  } catch (e) {
    console.error(`[evolution-block] no pude leer ${tabla}: ${e instanceof Error ? e.message : String(e)}`);
    return new TelefonosDe([]);
  }
}

/** Los bloqueados del workspace, para marcar una lista de una: `has` responde con la regla de identidad. */
export async function telefonosBloqueados(): Promise<TelefonosDe> {
  return telefonosDe('wa_bloqueados');
}

// ── Ocultar/mostrar (distinto de bloquear: NO corta el envío; solo saca la
//    conversación del inbox y de MaKo, para chats personales) ─────────────────
export async function ocultarContacto(telefono: string, opts: { leadId?: number | null; por?: string } = {}): Promise<void> {
  const tel = norm(telefono);
  if (!tel) return;
  await (await getTenantDb()).from('wa_ocultos').upsert(
    { telefono: tel, lead_id: opts.leadId ?? null, created_by: opts.por ?? null },
    { onConflict: 'workspace_id,telefono', ignoreDuplicates: true },
  );
}

/** Vuelve a mostrar al CONTACTO: todas las formas de su número, con la misma regla que el bloqueo. */
export async function mostrarContacto(telefono: string): Promise<void> {
  const filas = await filasDelContacto('wa_ocultos', telefono);
  if (!filas.length) return;
  const { error } = await (await getTenantDb()).from('wa_ocultos').delete().in('telefono', filas);
  if (error) throw new Error(`No pude volver a mostrarlo: ${error.message}`);
}

/** Los ocultos del workspace, para filtrar una lista de una: `has` responde con la regla de identidad. */
export async function telefonosOcultos(): Promise<TelefonosDe> {
  return telefonosDe('wa_ocultos');
}
