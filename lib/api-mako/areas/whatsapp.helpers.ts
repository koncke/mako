// =============================================================================
// api-mako/areas/whatsapp.helpers — lógica que vivía SOLO en rutas de /api/whatsapp
// =============================================================================
// Cada función de aquí es la versión para el registro de algo que hoy está inline
// en una ruta (no existía como export de lib/). Deuda: el día que la lib lo
// exporte, el runner llama a la lib y esto se borra. De dónde sale cada una está
// en su comentario.
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { listConversations, getApprovedTemplates } from '@/lib/chatwoot';
import { listMetaTemplates } from '@/lib/meta-templates';
import { envioWhatsappHabilitado } from '@/lib/envio-flags';
import { integracionConectada } from '@/lib/credenciales';
import { getInstanciaRow, evolutionConfigurado, sondearSocket, motivoCaida } from '@/lib/evolution';
import { derivarEtapa, type LeadEtapaFields } from '@/lib/wa-etapas';
import { leerPorPaginas } from '@/lib/supabase-paginado';

export const ultimos10 = (tel: string | null | undefined): string => (tel || '').replace(/\D/g, '').slice(-10);

/** chatJid del número de empresa a partir de un jid o de un teléfono pelado. */
export const jidDe = (chatOTel: string): string =>
  chatOTel.includes('@') ? chatOTel.trim() : `${chatOTel.replace(/\D/g, '')}@s.whatsapp.net`;

type LeadInbox = { id: number; nombre: string | null; empresa: string | null; telefono_normalizado: string | null; estado_lead: string | null } & LeadEtapaFields;

/**
 * La bandeja oficial agrupada por persona. Sale de app/api/whatsapp/conversations
 * (GET): mismo agrupado por últimos 10 dígitos, misma suma de no leídos y misma
 * ventana. Diferencias a propósito: lee `paginas` páginas (no 200), no suma los
 * leads sin chat, y los leads se leen PAGINADOS (la ruta hace un select sin
 * `.range`, que PostgREST corta en 1000 filas sin avisar).
 */
export async function bandejaOficial(paginas: number) {
  const convs = await listConversations(paginas);
  type G = { contactId: number; contacto: string; telefono: string | null; convs: number; sinLeer: number; ventanaAbierta: boolean; bloqueado: boolean; ultimoMensaje: string | null; ultimaActividad: number; ultimoEntrante: boolean };
  const grupos = new Map<string, G>();
  for (const c of convs) {
    const d = ultimos10(c.telefono);
    const key = d.length >= 10 ? `p${d}` : c.contactId ? `c${c.contactId}` : `x${c.id}`;
    const act = c.ultimaActividad ?? 0;
    const g = grupos.get(key);
    if (!g) { grupos.set(key, { contactId: c.contactId, contacto: c.contacto, telefono: c.telefono, convs: 1, sinLeer: c.sinLeer, ventanaAbierta: c.puedeResponder, bloqueado: c.bloqueado, ultimoMensaje: c.ultimoMensaje, ultimaActividad: act, ultimoEntrante: c.ultimoEntrante }); continue; }
    g.convs += 1; g.sinLeer += c.sinLeer; g.ventanaAbierta ||= c.puedeResponder; g.bloqueado ||= c.bloqueado;
    if (act >= g.ultimaActividad) { g.ultimaActividad = act; g.ultimoMensaje = c.ultimoMensaje; g.ultimoEntrante = c.ultimoEntrante; g.contactId = c.contactId || g.contactId; }
  }
  const porTel = new Map<string, LeadInbox>();
  if (grupos.size) {
    await leerPorPaginas<LeadInbox>(await getTenantDb(), 'leads',
      'id, nombre, empresa, telefono_normalizado, estado_lead, fecha_primer_pago, fecha_confirmacion, cerro, asistio_j1, asistio_j2, fecha_junta_2, fecha_agenda, visitor_id, meta_lead_id',
      (filas) => { for (const l of filas) { const d = ultimos10(l.telefono_normalizado); if (d.length >= 10) porTel.set(d, l); } },
      { filtros: (q) => q.not('telefono_normalizado', 'is', null) });
  }
  return { conversacionesLeidas: convs.length, grupos: [...grupos.entries()].map(([groupId, g]) => ({ groupId, ...g, lead: porTel.get(ultimos10(g.telefono)) ?? null })).sort((a, b) => b.ultimaActividad - a.ultimaActividad) };
}

export { derivarEtapa };

/**
 * Estado MEDIDO del número de empresa. Sale de app/api/whatsapp/evolution (GET):
 * sondeo con tope de 4 s, «conectando» en la fila gana a «muerto», y sin
 * respuesta no se afirma nada (confirmado:false).
 */
export async function estadoEmpresaMedido() {
  const row = await getInstanciaRow();
  const sondeo = row && evolutionConfigurado() ? await sondearSocket(row.instance_name, 4000) : 'sin_respuesta';
  const medido = sondeo === 'vivo' ? 'conectado' : sondeo === 'muerto' ? 'desconectado' : null;
  const caida = medido === 'desconectado' && row ? await motivoCaida(row.instance_name, 4000).catch(() => null) : null;
  return {
    configurado: evolutionConfigurado(),
    vinculado: !!row,
    estado: row?.estado === 'conectando' ? 'conectando' : (medido ?? row?.estado ?? 'desconectado'),
    confirmado: medido != null || row?.estado === 'conectando',
    numero: row?.numero ?? null,
    perfil: row?.perfil_nombre ?? null,
    caida,
  };
}

/** Sale de app/api/whatsapp/templates (GET): Meta es la fuente; si falla, Chatwoot. */
export async function plantillasAprobadas() {
  try {
    const metas = await listMetaTemplates();
    return { fuente: 'meta' as const, plantillas: metas.filter((m) => m.status === 'approved').map((m) => ({ name: m.name, category: m.category, language: m.language, params: m.params, body: m.body })) };
  } catch {
    return { fuente: 'chatwoot (Meta no respondió; puede faltar lo recién aprobado)' as const, plantillas: await getApprovedTemplates() };
  }
}

/** Sale de app/api/whatsapp/envio (estadoActual). ⚠️ `evolutionConectado` es la FILA. */
export async function estadoEnvio() {
  const [habilitado, oficial, inst] = await Promise.all([envioWhatsappHabilitado(), integracionConectada('whatsapp'), getInstanciaRow()]);
  return { envioHabilitado: habilitado, oficialConectado: oficial, evolutionConectadoSegunFila: inst?.estado === 'conectado' };
}

// ── Número de empresa: resolver por los ÚLTIMOS 10 dígitos ────────────────────
// ⚠️ Las libs del número de empresa comparan teléfonos de TRES formas distintas:
//   · el motor de nutrición: estaBloqueado(lead.telefono) → igualdad EXACTA de dígitos
//     (lib/nutricion.ts, rama whatsapp);
//   · el inbox: bloq.has(c.telefono) / ocultos.has(c.telefono) → igualdad EXACTA con
//     el teléfono del espejo (wa_mensajes.telefono, que sale del jid);
//   · borrarChat / getMensajesDeChat: `telefono LIKE %x%` → SUBCADENA, no sufijo.
// Un número que transcribe el modelo («5512345678» contra «5215512345678») no calza
// en ninguna, y la escritura igual «sale bien». Deuda: el arreglo de fondo es que
// lib/evolution-block.ts y lib/evolution-mensajes.ts comparen por sufijo de 10
// dígitos. Mientras tanto estas lecturas devuelven los números EXACTOS que mira cada
// consumidor, y el runner escribe esos.

const JID_SIMPLE = /^[A-Za-z0-9@._:-]+$/;

/** Teléfonos EXACTOS (solo dígitos) de wa_bloqueados / wa_ocultos que terminan en esos 10 dígitos. Sin el tope de 1000 filas de telefonosBloqueados(). */
export async function registrosPorUltimos10(tabla: 'wa_bloqueados' | 'wa_ocultos', ult10: string): Promise<string[]> {
  if (ult10.length !== 10) return [];
  const { data, error } = await (await getTenantDb()).from(tabla).select('telefono').like('telefono', `%${ult10}`).limit(50);
  if (error) throw new Error(`No pude leer ${tabla}: ${error.message}`);
  return [...new Set(((data ?? []) as Array<{ telefono: string | null }>).map((r) => (r.telefono ?? '').replace(/\D/g, '')).filter((t) => t.slice(-10) === ult10))];
}

export type LeadTel = { id: number; nombre: string | null; telefono: string | null; telefono_normalizado: string | null };

/** Leads cuyo teléfono termina en esos 10 dígitos, con `telefono` (lo que mira el motor) y `telefono_normalizado`. */
export async function leadsPorUltimos10(ult10: string): Promise<LeadTel[]> {
  if (ult10.length !== 10) return [];
  const { data, error } = await (await getTenantDb()).from('leads').select('id, nombre, telefono, telefono_normalizado').like('telefono_normalizado', `%${ult10}`).limit(20);
  if (error) throw new Error(`No pude leer los leads: ${error.message}`);
  return ((data ?? []) as LeadTel[]).filter((l) => ultimos10(l.telefono_normalizado) === ult10 || ultimos10(l.telefono) === ult10);
}

export type ChatEmpresa = { chatJid: string; telefonos: string[]; nombre: string | null; mensajes: number; /** La línea del mensaje más reciente (mig 0198): por la que se le contesta. */ linea: string | null };

/**
 * La conversación del espejo para esos 10 dígitos: el jid del mensaje más reciente
 * (el mismo representante que elige getConversacionesNoOficial, que también agrupa
 * por los últimos 10), los teléfonos EXACTOS con que está guardada (52 y 521
 * conviven) y cuántos mensajes tiene por SUFIJO. null si el espejo no tiene nada.
 * No usa getConversacionesNoOficial(600, true): con `true` esa función devuelve SOLO
 * los ocultos, no «también los ocultos».
 */
export async function chatEmpresaPorUltimos10(ult10: string): Promise<ChatEmpresa | null> {
  if (ult10.length !== 10) return null;
  const db = await getTenantDb();
  const { data, error } = await db.from('wa_mensajes').select('chat_jid, telefono, push_name, from_me, instance_name')
    .like('telefono', `%${ult10}`).neq('tipo', 'evento').order('wa_timestamp', { ascending: false }).limit(200);
  if (error) throw new Error(`No pude leer el espejo: ${error.message}`);
  const filas = ((data ?? []) as Array<{ chat_jid: string; telefono: string | null; push_name: string | null; from_me: boolean; instance_name: string | null }>)
    .filter((r) => ultimos10(r.telefono) === ult10);
  if (!filas.length) return null;
  const { count } = await db.from('wa_mensajes').select('id', { count: 'exact', head: true }).like('telefono', `%${ult10}`);
  return {
    chatJid: filas[0].chat_jid,
    telefonos: [...new Set(filas.map((r) => (r.telefono ?? '').replace(/\D/g, '')).filter(Boolean))],
    nombre: filas.find((r) => !r.from_me && r.push_name && r.push_name !== 'Você')?.push_name ?? null,
    mensajes: count ?? filas.length,
    linea: filas[0].instance_name || null,
  };
}

/**
 * Cuántas filas toca borrarChat (que filtra por SUBCADENA `%x%`) contra las que son de
 * verdad de ese número (SUFIJO `%x`). Si difieren, el DELETE se llevaría mensajes de
 * otra persona cuyo teléfono contiene esos dígitos en el medio.
 */
export async function contarParaBorrar(ult10: string): Promise<{ sufijo: number; subcadena: number }> {
  const db = await getTenantDb();
  const [a, b] = await Promise.all([
    db.from('wa_mensajes').select('id', { count: 'exact', head: true }).like('telefono', `%${ult10}`),
    db.from('wa_mensajes').select('id', { count: 'exact', head: true }).like('telefono', `%${ult10}%`),
  ]);
  if (a.error || b.error) throw new Error(`No pude contar los mensajes: ${(a.error ?? b.error)?.message}`);
  return { sufijo: a.count ?? 0, subcadena: b.count ?? 0 };
}

/**
 * Los mensajes MÁS RECIENTES de un chat del espejo, en orden cronológico. Sale de
 * lib/evolution-mensajes.ts#getMensajesDeChat con dos diferencias a propósito (la
 * tercera, ordenar descendente antes de cortar, ya la tiene también la lib desde el
 * 17/09 — antes devolvía los MÁS VIEJOS): coincide por SUFIJO de
 * 10 dígitos (la lib usa subcadena y mezcla personas) y no firma URLs de media (la lib
 * firma hasta 1000 con un tope de 8 s y el runner las tiraba).
 */
export async function mensajesEspejoRecientes(chatJid: string, ult10: string | null, limite: number) {
  const db = await getTenantDb();
  const filtro = ult10 && JID_SIMPLE.test(chatJid) ? `chat_jid.eq.${chatJid},telefono.like.%${ult10}` : null;
  let q = db.from('wa_mensajes').select('id, from_me, tipo, texto, wa_timestamp, status').neq('tipo', 'evento');
  let c = db.from('wa_mensajes').select('id', { count: 'exact', head: true }).neq('tipo', 'evento');
  if (filtro) { q = q.or(filtro); c = c.or(filtro); }
  else if (ult10) { q = q.like('telefono', `%${ult10}`); c = c.like('telefono', `%${ult10}`); }
  else { q = q.eq('chat_jid', chatJid); c = c.eq('chat_jid', chatJid); }
  const [{ data, error }, { count }] = await Promise.all([
    q.order('wa_timestamp', { ascending: false }).order('id', { ascending: false }).limit(limite),
    c,
  ]);
  if (error) throw new Error(`No pude leer el espejo: ${error.message}`);
  const filas = ((data ?? []) as Array<{ id: number; from_me: boolean; tipo: string | null; texto: string | null; wa_timestamp: string | null; status: string | null }>).reverse();
  return { total: count ?? filas.length, filas };
}

/** Un borrador PENDIENTE por id, sin el tope de 200 de listBorradores(). */
export async function borradorPendiente(id: number): Promise<{ id: number; telefono: string; texto: string; leadNombre: string | null } | null> {
  const { data, error } = await (await getTenantDb()).from('wa_borradores').select('id, telefono, texto, leads(nombre)').eq('id', id).eq('estado', 'pendiente').maybeSingle();
  if (error) throw new Error(`No pude leer el borrador: ${error.message}`);
  if (!data) return null;
  const r = data as unknown as { id: number; telefono: string | null; texto: string | null; leads: { nombre?: string } | null };
  return { id: r.id, telefono: r.telefono ?? '', texto: r.texto ?? '', leadNombre: r.leads?.nombre ?? null };
}

/** El borrador pendiente más nuevo con ese teléfono (por sufijo) y ese texto exacto, sin el tope de 200 de listBorradores(). */
export async function borradorPendienteIgual(ult10: string, texto: string): Promise<number | null> {
  const { data, error } = await (await getTenantDb()).from('wa_borradores').select('id, telefono')
    .eq('estado', 'pendiente').eq('texto', texto).like('telefono', `%${ult10}`).order('created_at', { ascending: false }).limit(5);
  if (error) throw new Error(`No pude leer la cola de borradores: ${error.message}`);
  return ((data ?? []) as Array<{ id: number; telefono: string | null }>).find((r) => ultimos10(r.telefono) === ult10)?.id ?? null;
}
