'use server';

// =============================================================================
// ficha/resumen/charla-actions — lo que leen los bloques del Resumen que hablan de la CHARLA con el lead (17/10/2026)
// =============================================================================
// Siete bloques del catálogo estaban en las plantillas y no tenían componente, así que el armador los salteaba en
// silencio (docs/relevo/crm.md §0-Ω9): la charla de WhatsApp, la de DM, el pase a humano, los cambios que MaKo espera
// que alguien confirme, el mensaje listo, las automatizaciones en curso y lo que le mandamos. Los datos existían
// (docs/diseno-ficha-bloques.md §3, «De dónde sale cada dato») y nadie los leía desde la ficha.
//
// La regla del armador (../tipos.ts, punto 3): lo que no viene en `LeadFullData` lo pide el bloque con SU acción, al
// montarse. Así nadie paga la lectura de un bloque que no está puesto, y `getLeadFullAction` no crece.
//
// ⚠️ SÓLO LEEN. Mandar, contestar o confirmar sigue en su pantalla (la bandeja de WhatsApp, «A revisar»): un bloque de
//    la ficha que manda un mensaje es una puerta nueva a un envío a un cliente, y eso pide su propia revisión.
// ⚠️ SIN SESIÓN NO SE LEE NADA: sin cookie, `getWorkspaceActual()` cae al ws1, que es un cliente (AGENTS.md). Cada
//    consulta va por `getTenantDb`, así que un lead de otro negocio no devuelve nada.
// ⚠️ NUNCA TIRAN: `null` = no se pudo leer (el bloque lo dice); `[]` = no hay nada (el bloque se calla).
// =============================================================================

import { getUsuarioActual } from '@/lib/auth';
import { getTenantDb } from '@/lib/workspace';
import { hiloWhatsApp } from '@/lib/crm-movil';
import { conversacionesSocialesDe, mensajesSociales } from '@/lib/canal-zernio';

const idValido = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x > 0;
const haySesion = async (): Promise<boolean> => { try { return Boolean(await getUsuarioActual()); } catch { return false; } };

/** Un mensaje, como lo dibuja un bloque: de quién (nosotros o el lead), el texto y cuándo. */
export type MensajeCorto = { deMi: boolean; texto: string; cuando: string | null };

/** Los últimos mensajes del WhatsApp de la empresa con este lead (`hiloWhatsApp`, el del teléfono). */
export async function charlaWhatsAppAction(leadId: number): Promise<{ mensajes: MensajeCorto[]; chatJid: string | null } | null> {
  if (!(await haySesion())) return null;
  if (!idValido(leadId)) return null;
  try {
    const h = await hiloWhatsApp(leadId);
    if (!h) return null;
    return { chatJid: h.chat?.chatJid ?? null, mensajes: h.mensajes.slice(-10).map((m) => ({ deMi: m.deMi, texto: m.texto, cuando: m.cuando })) };
  } catch {
    return null;
  }
}

/**
 * La charla por DM (Instagram o Messenger): el usuario, si hoy se le puede escribir y los últimos mensajes.
 * Lee por EL CANAL (lib/canal-zernio.ts, la misma puerta que la bandeja de Chats): las tablas de Instagram sólo las
 * nombra el canal (tests/sin-instagram.test.ts), y «se le puede escribir» es SU regla (`escrituraDe`), no una cuenta
 * de horas hecha acá.
 */
export type CharlaPorDm = { usuario: string | null; red: 'Instagram' | 'Messenger'; puedeEscribir: boolean; motivoNoEscribir: string | null; mensajes: MensajeCorto[] };
export async function charlaDmAction(leadId: number): Promise<CharlaPorDm | null | 'sin-charla'> {
  if (!(await haySesion())) return null;
  if (!idValido(leadId)) return null;
  try {
    const ms = (iso: string | null) => Date.parse(iso ?? '') || 0;
    const c = [...(await conversacionesSocialesDe({ leadId }))].sort((a, b) => ms(b.ultimaFecha) - ms(a.ultimaFecha))[0];
    if (!c) return 'sin-charla';
    const mensajes = (await mensajesSociales([c.id])).slice(-10)
      .map((m) => ({ deMi: m.saliente, texto: m.texto?.trim() || '(sin texto)', cuando: m.fecha }));
    return { usuario: c.username, red: c.canal === 'messenger' ? 'Messenger' : 'Instagram', puedeEscribir: c.puedeEscribir, motivoNoEscribir: c.motivoNoEscribir, mensajes };
  } catch {
    return null;
  }
}

/** Cuándo y por qué MaKo le pasó la charla a una persona (`chat_agent_handoffs`). Primero lo que sigue sin resolver. */
export type PaseAHumano = { motivo: string | null; mensaje: string | null; escenario: string | null; cuando: string; resuelto: string | null };
export async function paseAHumanoAction(leadId: number): Promise<PaseAHumano[] | null> {
  if (!(await haySesion())) return null;
  if (!idValido(leadId)) return null;
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from('chat_agent_handoffs').select('motivo, mensaje, escenario, created_at, resuelto_at')
      .eq('lead_id', leadId).order('created_at', { ascending: false }).limit(5);
    if (error) return null;
    const filas = ((data ?? []) as Array<{ motivo: string | null; mensaje: string | null; escenario: string | null; created_at: string; resuelto_at: string | null }>)
      .map((f) => ({ motivo: f.motivo, mensaje: f.mensaje, escenario: f.escenario, cuando: f.created_at, resuelto: f.resuelto_at }));
    // Lo pendiente arriba: es lo que hay que atender.
    return [...filas.filter((f) => !f.resuelto), ...filas.filter((f) => f.resuelto)];
  } catch {
    return null;
  }
}

/** Lo que MaKo quiere cambiar en este lead y espera que alguien confirme (`mako_confirmaciones` pendientes). */
export type CambioDeMako = { id: number; titulo: string; detalle: string | null; cuando: string };
export async function cambiosDeMakoAction(leadId: number): Promise<CambioDeMako[] | null> {
  if (!(await haySesion())) return null;
  if (!idValido(leadId)) return null;
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from('mako_confirmaciones').select('id, titulo, detalle, created_at')
      .eq('lead_id', leadId).eq('estado', 'pendiente').order('created_at', { ascending: false }).limit(10);
    if (error) return null;
    return ((data ?? []) as Array<{ id: number; titulo: string | null; detalle: string | null; created_at: string }>)
      .map((f) => ({ id: Number(f.id), titulo: f.titulo?.trim() || 'Un cambio sin título', detalle: f.detalle?.trim() || null, cuando: f.created_at }));
  } catch {
    return null;
  }
}

/** Los mensajes que quedaron escritos y nadie mandó (`wa_borradores` pendientes: nutrición, MaKo, la llamada). */
export type MensajeListo = { id: number; texto: string; origen: string | null; cuando: string; chatJid: string | null };
export async function mensajesListosAction(leadId: number): Promise<MensajeListo[] | null> {
  if (!(await haySesion())) return null;
  if (!idValido(leadId)) return null;
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from('wa_borradores').select('id, texto, origen, created_at, chat_jid')
      .eq('lead_id', leadId).eq('estado', 'pendiente').order('created_at', { ascending: false }).limit(5);
    if (error) return null;
    return ((data ?? []) as Array<{ id: number; texto: string | null; origen: string | null; created_at: string; chat_jid: string | null }>)
      .filter((f) => f.texto?.trim())
      .map((f) => ({ id: Number(f.id), texto: f.texto!.trim(), origen: f.origen, cuando: f.created_at, chatJid: f.chat_jid }));
  } catch {
    return null;
  }
}

// «En qué automatizaciones está el lead» se fue de acá el 22/10/2026: el bloque de la ficha lee la de Automations
// (app/automations/automatizaciones-del-lead-actions.ts → automatizacionesDelLeadAction, con el paso y «Frenar»).

/** Lo que le mandaron las automatizaciones: cuántos toques, por canal, y cuántos abrió, clickeó o respondió. */
export type LoQueLeMandamos = { toques: number; porCanal: Record<string, number>; abiertos: number; clics: number; respuestas: number; ultimo: string | null };
export async function loQueLeMandamosAction(leadId: number): Promise<LoQueLeMandamos | null> {
  if (!(await haySesion())) return null;
  if (!idValido(leadId)) return null;
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from('nutricion_envios').select('canal, abierto_at, clic_at, respondio_at, created_at')
      .eq('lead_id', leadId).eq('estado', 'enviado').order('created_at', { ascending: false }).limit(500);
    if (error) return null;
    const filas = (data ?? []) as Array<{ canal: string | null; abierto_at: string | null; clic_at: string | null; respondio_at: string | null; created_at: string }>;
    const porCanal: Record<string, number> = {};
    for (const f of filas) porCanal[f.canal ?? 'otro'] = (porCanal[f.canal ?? 'otro'] ?? 0) + 1;
    return {
      toques: filas.length, porCanal,
      abiertos: filas.filter((f) => f.abierto_at).length, clics: filas.filter((f) => f.clic_at).length,
      respuestas: filas.filter((f) => f.respondio_at).length, ultimo: filas[0]?.created_at ?? null,
    };
  } catch {
    return null;
  }
}
