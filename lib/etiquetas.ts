// =============================================================================
// etiquetas — las etiquetas del CRM: el catálogo, las de cada lead, y la ÚNICA puerta de escritura
// =============================================================================
// Pedido de Martín (08/10/2026, punto 12 del rediseño de /chatbot), textual: «Deberías agregar
// todo un sistema de ETIQUETAS... si no respondió, se le pone la etiqueta de seguimiento. Si
// respondió y está cualificado, se le pone la etiqueta de "Cualificado"... esas etiquetas debería
// poder editarse, como un CRUD... y si están vinculadas a etapas del CRM... esas mismas etiquetas
// que se asignan en MaKo, se pongan en esas ambas plataformas». Contrato: docs/chatbot-flujo-ramas-diseno.md.
//
// Las tablas son de la mig 0224 (`crm_etiquetas`, `crm_lead_etiquetas`). Lo que se decide sin base
// vive en lib/etiquetas-reglas.ts; el ORDEN de poner y sacar (idempotencia, historial, espejo con
// la etapa, disparo, sincronización) vive en lib/etiquetas-motor.ts, con puertos. Acá se arman
// los puertos reales y se exponen las funciones que llaman la API de MaKo, la ruta de las
// pantallas y los ganchos de etapa de lib/leads.ts y lib/lead-funnel.ts.
//
// ⚠️ NADIE MÁS ESCRIBE `crm_lead_etiquetas`. Un `.from('crm_lead_etiquetas').insert` en otro
// archivo se saltea el historial, el disparo y WhatsApp: es una segunda implementación. Lo fija
// tests/etiquetas-motor.test.ts barriendo `lib/` y `app/`.
//
// ⚠️ TODO APUNTA AL ID. Condiciones, disparadores, el segmento de email y el paso «⚡ Acción»
// guardan `etiqueta_id`; el nombre es para mostrar. ManyChat referencia por nombre y se rompe al
// renombrar (docs/hallazgos-comunicacion.md).
// =============================================================================

import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import { getTenantDb, getWorkspaceActual, listarWorkspaces, runWithWorkspace } from './workspace';
import { leerTodo } from './supabase-paginado';
import { getSettingEstricto, setSetting } from './settings';
import { logLeadEvent, autorDelMovimiento, setBoardStageOverride } from './leads';
import { idDelFunnelDefault, listarFunnels } from './funnels';
import { etapasDeProducto, moverEtapaEnProducto } from './lead-funnel';
import { casaReal, nombreVisible } from './lead-funnel-reglas';
import { terminalEstadoFor, pipelineStageOf, MAKO_SETTER, type StageDerivable } from './pipeline';
import { reclamarEspaciado } from './espaciado';
import { etiquetarChatWhatsApp, getInstanciaRow } from './evolution';
import { catalogoParaMapear } from './evolution-labels';
import {
  limpiarNombreEtiqueta, claveNombre, colorValido, emojiValido, usoEnPasos,
  leerFotoEspejo, planEspejo, COLOR_ETIQUETA_DEFAULT, type LabelCelular, type EtapaActual,
} from './etiquetas-reglas';
import {
  ponerEtiquetaCon, sacarEtiquetaCon, espejarEtapaCon, ponerLoteCon, sacarLoteCon, sincronizarDiferidos,
  type PuertosEtiquetas, type ResultadoPoner, type ResultadoLote, type ResultadoSync, type CambioEtiqueta,
} from './etiquetas-motor';

export type { ResultadoPoner, ResultadoLote, LabelCelular, CambioEtiqueta };

/** Una etiqueta tal como sale de la base. */
export type Etiqueta = {
  id: number;
  nombre: string;
  color: string;
  emoji: string | null;
  /** NULL = el producto del negocio (como `leads.funnel_id`). Sólo vale junto con `etapa_key`. */
  funnel_id: number | null;
  etapa_key: string | null;
  /** La etiqueta del celular a la que corresponde, por la línea donde existe. */
  wa_instance: string | null;
  wa_label_id: string | null;
  orden: number;
  archivada_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Un error que se le puede mostrar a la persona tal cual (400, no 500). */
export class EtiquetaError extends Error {}
export const esEtiquetaError = (e: unknown): e is EtiquetaError => e instanceof EtiquetaError;

// ⚠️ `crm_etiquetas.chatwoot_label` sigue en la base (mig 0224) y no se lee: era el espejo de la
// etiqueta en Chatwoot, que se borró el 09/10/2026 con toda la integración.
const COLS = 'id, nombre, color, emoji, funnel_id, etapa_key, wa_instance, wa_label_id, orden, archivada_at, created_at, updated_at';
const CAMPO_HISTORIAL = 'Etiqueta';
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function aEtiqueta(r: Record<string, unknown>): Etiqueta {
  return {
    id: Number(r.id),
    nombre: String(r.nombre ?? ''),
    color: String(r.color ?? COLOR_ETIQUETA_DEFAULT),
    emoji: (r.emoji as string | null) ?? null,
    funnel_id: r.funnel_id == null ? null : Number(r.funnel_id),
    etapa_key: (r.etapa_key as string | null) ?? null,
    wa_instance: (r.wa_instance as string | null) ?? null,
    wa_label_id: r.wa_label_id == null ? null : String(r.wa_label_id),
    orden: Number(r.orden ?? 0),
    archivada_at: (r.archivada_at as string | null) ?? null,
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
  };
}

// ── Lecturas ─────────────────────────────────────────────────────────────────

/** El catálogo, en orden. Tira si no puede leer: «no pude» no es «no hay ninguna». */
export async function listarEtiquetas(opts?: { incluirArchivadas?: boolean }): Promise<Etiqueta[]> {
  const db = await getTenantDb();
  let q = db.from('crm_etiquetas').select(COLS);
  if (!opts?.incluirArchivadas) q = q.is('archivada_at', null);
  const { data, error } = await q.order('orden', { ascending: true }).order('id', { ascending: true });
  if (error) throw new Error(`No pude leer las etiquetas: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map(aEtiqueta);
}

/** UNA etiqueta de este negocio (archivada o no), o null. Tira si no puede leer. */
export async function etiquetaPorId(id: number): Promise<Etiqueta | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const db = await getTenantDb();
  const { data, error } = await db.from('crm_etiquetas').select(COLS).eq('id', id).limit(1);
  if (error) throw new Error(`No pude leer la etiqueta: ${error.message}`);
  const r = ((data ?? []) as Array<Record<string, unknown>>)[0];
  return r ? aEtiqueta(r) : null;
}

/** Cuántos leads tiene cada etiqueta. Paginado: la tabla crece con el uso (AGENTS.md, el techo de 1000). */
export async function conteoPorEtiqueta(): Promise<Map<number, number>> {
  const db = await getTenantDb();
  const filas = await leerTodo<{ id: number; etiqueta_id: number }>(db, 'crm_lead_etiquetas', 'id, etiqueta_id', { orden: 'id' });
  const out = new Map<number, number>();
  for (const f of filas) out.set(Number(f.etiqueta_id), (out.get(Number(f.etiqueta_id)) ?? 0) + 1);
  return out;
}

export type EtiquetaDelLead = Etiqueta & { puesta_at: string; puesta_por: string };

/** Las etiquetas de UN lead (incluidas las archivadas que todavía tiene), en el orden del catálogo. */
export async function etiquetasDeLead(leadId: number): Promise<EtiquetaDelLead[]> {
  const db = await getTenantDb();
  const { data, error } = await db.from('crm_lead_etiquetas').select('etiqueta_id, puesta_at, puesta_por').eq('lead_id', leadId);
  if (error) throw new Error(`No pude leer las etiquetas del lead: ${error.message}`);
  const filas = (data ?? []) as Array<{ etiqueta_id: number; puesta_at: string; puesta_por: string }>;
  if (!filas.length) return [];
  const ids = [...new Set(filas.map((f) => Number(f.etiqueta_id)))];
  const { data: cat, error: e2 } = await db.from('crm_etiquetas').select(COLS).in('id', ids);
  if (e2) throw new Error(`No pude leer las etiquetas del lead: ${e2.message}`);
  const porId = new Map(((cat ?? []) as Array<Record<string, unknown>>).map((r) => { const e = aEtiqueta(r); return [e.id, e] as const; }));
  return filas
    .map((f) => { const e = porId.get(Number(f.etiqueta_id)); return e ? { ...e, puesta_at: f.puesta_at, puesta_por: f.puesta_por } : null; })
    .filter((x): x is EtiquetaDelLead => x != null)
    .sort((a, b) => a.orden - b.orden || a.id - b.id);
}

/** Los ids de los leads que tienen la etiqueta (el segmento de email, el cohorte). Paginado. */
export async function leadsConEtiqueta(etiquetaId: number): Promise<number[]> {
  const db = await getTenantDb();
  const filas = await leerTodo<{ id: number; lead_id: number }>(db, 'crm_lead_etiquetas', 'id, lead_id', { orden: 'id', eq: { etiqueta_id: etiquetaId } });
  return filas.map((f) => Number(f.lead_id));
}

/** Las etiquetas del celular que se pueden mapear (sin las listas del sistema). */
export async function catalogoWhatsApp(): Promise<LabelCelular[]> {
  return catalogoParaMapear();
}

/**
 * QUIÉN APUNTA a una etiqueta, para avisar antes de archivarla (AGENTS.md: «sacar algo de un
 * catálogo no es borrarlo: hay gente APUNTÁNDOLE»). Cada número es `null` si no se pudo leer,
 * que NO es «ninguno».
 *   · disparadores: secuencias con `etiqueta_id` (la columna la suma la mig 0223 de la parte M;
 *     mientras no esté aplicada, esa lectura falla y el número es null);
 *   · condiciones y acciones: dentro de los `pasos` de cada secuencia (`usoEnPasos`);
 *   · leads: cuántos la tienen puesta.
 * ⚠️ NO MIRA los flujos de /mensajes (viven en el store de plantillas): un paso «⚡ Acción» de un
 * aviso que pone esta etiqueta no se cuenta. Queda escrito como pendiente.
 */
export async function usoDeEtiqueta(id: number): Promise<{ disparadores: number | null; condiciones: number | null; acciones: number | null; leads: number | null }> {
  const db = await getTenantDb();
  const out = { disparadores: null as number | null, condiciones: null as number | null, acciones: null as number | null, leads: null as number | null };
  try {
    const secs = await leerTodo<{ id: number; pasos: unknown }>(db, 'nutricion_secuencias', 'id, pasos', { orden: 'id' });
    let c = 0; let a = 0;
    for (const s of secs) { const u = usoEnPasos(s.pasos, id); c += u.condiciones; a += u.acciones; }
    out.condiciones = c; out.acciones = a;
  } catch (e) { console.error('[etiquetas] uso en pasos:', msg(e)); }
  {
    const { count, error } = await db.from('nutricion_secuencias').select('id', { count: 'exact', head: true }).eq('etiqueta_id', id);
    if (!error && typeof count === 'number') out.disparadores = count;
  }
  {
    const { count, error } = await db.from('crm_lead_etiquetas').select('id', { count: 'exact', head: true }).eq('etiqueta_id', id);
    if (!error && typeof count === 'number') out.leads = count;
  }
  return out;
}

// ── El CRUD ──────────────────────────────────────────────────────────────────

export type EntradaEtiqueta = {
  nombre?: unknown;
  color?: unknown;
  emoji?: unknown;
  /** El vínculo a una etapa: `null` = sin vínculo; `undefined` = no cambia. funnelId null = el producto del negocio. */
  vinculo?: { funnelId: number | null; etapaKey: string } | null;
  /** La etiqueta del celular: `null` = ninguna; `undefined` = no cambia. */
  waLabelId?: string | null;
};

/** El par (funnel_id, etapa_key) validado contra las etapas REALES del producto. */
async function validarVinculo(v: { funnelId: number | null; etapaKey: string }): Promise<{ funnel_id: number | null; etapa_key: string }> {
  const key = String(v.etapaKey ?? '').trim();
  if (!key) throw new EtiquetaError('Falta la etapa.');
  const def = await idDelFunnelDefault();
  const pedido = v.funnelId == null ? null : Number(v.funnelId);
  const destino = pedido ?? def;
  if (destino == null) throw new EtiquetaError('No encontré el producto del negocio.');
  if (pedido != null && !(await listarFunnels()).some((f) => f.id === pedido)) throw new EtiquetaError('Ese producto no existe.');
  if (!(await etapasDeProducto(destino)).some((s) => s.key === key)) throw new EtiquetaError(`«${key}» no es una etapa de ese producto.`);
  // El producto del negocio se guarda como NULL, la misma convención que `leads.funnel_id`.
  return { funnel_id: pedido == null || pedido === def ? null : pedido, etapa_key: key };
}

/** La etiqueta del celular, contra el catálogo guardado, por la línea de por default. */
async function validarWhatsApp(labelId: string): Promise<{ wa_instance: string; wa_label_id: string }> {
  const id = labelId.trim();
  if (!(await catalogoParaMapear()).some((l) => l.labelId === id)) throw new EtiquetaError('Esa etiqueta no está en el WhatsApp del celular.');
  // ⚠️ `evolution_labels` no guarda de qué LÍNEA es cada etiqueta (mig 0077, sin instance_name)
  // y el webhook la carga sin decirlo: con una sola línea —el caso de todos al 08/10/2026— es la
  // de por default. Con dos, el id podría ser de la otra; queda escrito como pendiente.
  const linea = await getInstanciaRow();
  if (!linea?.instance_name) throw new EtiquetaError('No hay un WhatsApp conectado.');
  return { wa_instance: linea.instance_name, wa_label_id: id };
}

async function nombreLibre(nombre: string, salvo?: number): Promise<void> {
  const clave = claveNombre(nombre);
  const otra = (await listarEtiquetas()).find((e) => e.id !== salvo && claveNombre(e.nombre) === clave);
  if (otra) throw new EtiquetaError(`Ya hay una etiqueta «${otra.nombre}».`);
}

/**
 * Crea una etiqueta. (Hasta el 09/10/2026 devolvía además un `aviso` cuando no se podía crear
 * en Chatwoot; se fue con la integración. La del celular se pone al etiquetar a un lead.)
 */
export async function crearEtiqueta(input: EntradaEtiqueta): Promise<{ etiqueta: Etiqueta }> {
  const nombre = limpiarNombreEtiqueta(input.nombre);
  if (!nombre) throw new EtiquetaError('Falta el nombre.');
  await nombreLibre(nombre);
  const vinculo = input.vinculo ? await validarVinculo(input.vinculo) : { funnel_id: null, etapa_key: null };
  const wa = typeof input.waLabelId === 'string' && input.waLabelId.trim() ? await validarWhatsApp(input.waLabelId) : { wa_instance: null, wa_label_id: null };
  const todas = await listarEtiquetas({ incluirArchivadas: true });
  const orden = todas.reduce((m, e) => Math.max(m, e.orden), -1) + 1;
  const db = await getTenantDb();
  const { data, error } = await db.from('crm_etiquetas').insert({
    nombre,
    color: colorValido(input.color) ?? COLOR_ETIQUETA_DEFAULT,
    emoji: emojiValido(input.emoji),
    ...vinculo,
    ...wa,
    orden,
  }).select(COLS).single();
  if (error) {
    if (error.code === '23505') throw new EtiquetaError(`Ya hay una etiqueta «${nombre}».`);
    throw new Error(`No se pudo crear la etiqueta: ${error.message}`);
  }
  return { etiqueta: aEtiqueta(data as Record<string, unknown>) };
}

/**
 * Edita nombre, color, emoji, el vínculo a una etapa o la etiqueta del celular. Cambiar el vínculo
 * vale DE ACÁ EN ADELANTE: no les pone ni les saca la etiqueta a los que ya están en esa etapa.
 */
export async function editarEtiqueta(id: number, input: EntradaEtiqueta): Promise<Etiqueta> {
  const actual = await etiquetaPorId(id);
  if (!actual) throw new EtiquetaError('Esa etiqueta no existe en este negocio.');
  const upd: Record<string, unknown> = {};
  if (input.nombre !== undefined) {
    const nombre = limpiarNombreEtiqueta(input.nombre);
    if (!nombre) throw new EtiquetaError('Falta el nombre.');
    if (claveNombre(nombre) !== claveNombre(actual.nombre) && !actual.archivada_at) await nombreLibre(nombre, id);
    upd.nombre = nombre;
  }
  if (input.color !== undefined) {
    const c = colorValido(input.color);
    if (!c) throw new EtiquetaError('Ese color no vale.');
    upd.color = c;
  }
  if (input.emoji !== undefined) upd.emoji = emojiValido(input.emoji);
  if (input.vinculo !== undefined) Object.assign(upd, input.vinculo ? await validarVinculo(input.vinculo) : { funnel_id: null, etapa_key: null });
  if (input.waLabelId !== undefined) {
    Object.assign(upd, typeof input.waLabelId === 'string' && input.waLabelId.trim() ? await validarWhatsApp(input.waLabelId) : { wa_instance: null, wa_label_id: null });
  }
  if (!Object.keys(upd).length) return actual;
  upd.updated_at = new Date().toISOString();
  const db = await getTenantDb();
  const { data, error } = await db.from('crm_etiquetas').update(upd).eq('id', id).select(COLS).single();
  if (error) {
    if (error.code === '23505') throw new EtiquetaError('Ya hay una etiqueta con ese nombre.');
    throw new Error(`No se pudo guardar la etiqueta: ${error.message}`);
  }
  return aEtiqueta(data as Record<string, unknown>);
}

/**
 * Archiva (o, con `archivar = false`, devuelve) una etiqueta. ⚠️ NUNCA SE BORRA: lo que la nombra
 * (una condición, un disparador, un paso de acción, las fichas que la tienen) apunta a su id, y un
 * id borrado no dice nada. Archivada, deja de ofrecerse y no se puede poner; lo que ya la tiene la
 * conserva. Devuelve quién la usa, para que la pantalla lo diga.
 */
export async function archivarEtiqueta(id: number, archivar = true): Promise<{ etiqueta: Etiqueta; uso: Awaited<ReturnType<typeof usoDeEtiqueta>> }> {
  const actual = await etiquetaPorId(id);
  if (!actual) throw new EtiquetaError('Esa etiqueta no existe en este negocio.');
  const uso = await usoDeEtiqueta(id);
  if (Boolean(actual.archivada_at) === archivar) return { etiqueta: actual, uso };
  if (!archivar) await nombreLibre(actual.nombre, id);
  const db = await getTenantDb();
  const ahora = new Date().toISOString();
  const { data, error } = await db.from('crm_etiquetas').update({ archivada_at: archivar ? ahora : null, updated_at: ahora }).eq('id', id).select(COLS).single();
  if (error) {
    if (error.code === '23505') throw new EtiquetaError(`Ya hay otra etiqueta «${actual.nombre}».`);
    throw new Error(`No se pudo ${archivar ? 'archivar' : 'recuperar'} la etiqueta: ${error.message}`);
  }
  return { etiqueta: aEtiqueta(data as Record<string, unknown>), uso };
}

// ── Los puertos reales del motor ─────────────────────────────────────────────

/** El jid del chat del lead en el espejo (el que dio WhatsApp), por los últimos 10 dígitos. */
async function jidDelChat(telefono: string): Promise<string | null> {
  const ult10 = telefono.replace(/\D/g, '').slice(-10);
  if (ult10.length !== 10) return null;
  const db = await getTenantDb();
  const { data, error } = await db.from('wa_mensajes').select('chat_jid, telefono')
    .like('telefono', `%${ult10}`).neq('tipo', 'evento').order('wa_timestamp', { ascending: false }).limit(20);
  if (error) throw new Error(`No pude leer el espejo de WhatsApp: ${error.message}`);
  const fila = ((data ?? []) as Array<{ chat_jid: string | null; telefono: string | null }>)
    .find((r) => (r.telefono ?? '').replace(/\D/g, '').slice(-10) === ult10 && r.chat_jid && !r.chat_jid.endsWith('@g.us'));
  return fila?.chat_jid ?? null;
}

async function telefonoDelLead(leadId: number): Promise<string | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('leads').select('telefono, telefono_normalizado').eq('id', leadId).limit(1);
  if (error) throw new Error(`No pude leer el teléfono del lead: ${error.message}`);
  const l = ((data ?? []) as Array<{ telefono: string | null; telefono_normalizado: string | null }>)[0];
  const d = (l?.telefono_normalizado || l?.telefono || '').replace(/\D/g, '');
  return d.length >= 8 ? d : null;
}

/**
 * Pone o saca la etiqueta en el WhatsApp del celular, si está mapeada. (Hasta el 09/10/2026
 * también en Chatwoot, que se borró con toda la integración.)
 */
async function sincronizarAfuera(leadId: number, e: Etiqueta, accion: 'poner' | 'sacar'): Promise<ResultadoSync[]> {
  if (!e.wa_label_id || !e.wa_instance) return [];
  let tel: string | null;
  try { tel = await telefonoDelLead(leadId); } catch (err) { return [{ destino: 'WhatsApp', ok: false, error: msg(err) }]; }
  // Sin teléfono no hay chat que etiquetar: no es un fallo.
  if (!tel) return [];
  try {
    // El jid del espejo, que es el que dio WhatsApp; si no hay chat, el número como jid
    // completo (así `createJid` de Evolution no le borra el 9 a un argentino).
    const jid = (await jidDelChat(tel)) ?? `${tel}@s.whatsapp.net`;
    const r = await etiquetarChatWhatsApp(jid, String(e.wa_label_id), accion === 'poner' ? 'add' : 'remove', e.wa_instance);
    return [r.ok ? { destino: 'WhatsApp', ok: true } : { destino: 'WhatsApp', ok: false, error: r.error }];
  } catch (err) { return [{ destino: 'WhatsApp', ok: false, error: msg(err) }]; }
}

/**
 * El espejo hacia la etapa: mover al lead a la etapa vinculada. En su CASA va por
 * `setBoardStageOverride` (el choke point del tablero, que además dispara las secuencias de
 * etapa); en otro producto, por `moverEtapaEnProducto`. Los dos llaman al espejo de vuelta desde su
 * gancho, y ahí la idempotencia corta el bucle.
 *
 * ⚠️ TRES CASOS NO MUEVEN, a propósito, y cada uno lo deja escrito:
 *   · la etapa es un CIERRE (ganado, perdido, descalificado, no responde): cerrar un deal pide
 *     monto o motivo y es una decisión de una persona, no de una etiqueta;
 *   · el lead ya está CERRADO en su casa: una etiqueta no reabre una venta (setBoardStageOverride
 *     no toca `estado_lead`, así que quedaría «Ganado» en una columna abierta);
 *   · el lead no está en ese producto: agregarlo a un producto es otra decisión.
 */
async function moverPorEtiqueta(leadId: number, funnelId: number | null, etapaKey: string, autor: string): Promise<{ movio: boolean; etapa?: string; motivo?: string }> {
  const def = await idDelFunnelDefault();
  const destino = funnelId ?? def;
  if (destino == null) return { movio: false, motivo: 'no encontré el producto del negocio' };
  const etapa = (await etapasDeProducto(destino)).find((s) => s.key === etapaKey);
  if (!etapa) return { movio: false, motivo: `la etapa «${etapaKey}» ya no existe en ese producto` };
  if (terminalEstadoFor(etapaKey) !== 'abierto') return { movio: false, motivo: `«${etapa.label}» es un cierre y se mueve a mano` };
  const db = await getTenantDb();
  const { data, error } = await db.from('leads')
    .select('funnel_id, pipeline_stage, estado_lead, fecha_agenda, fecha_junta_1, fecha_junta_2, asistio_j1, asistio_j2, nutricion_realizada')
    .eq('id', leadId).limit(1);
  if (error) throw new Error(`No pude leer el lead: ${error.message}`);
  const lead = ((data ?? []) as Array<StageDerivable & { funnel_id: number | null }>)[0];
  if (!lead) return { movio: false, motivo: 'no encontré el lead' };
  if (casaReal(lead.funnel_id == null ? null : Number(lead.funnel_id), def) === destino) {
    if (lead.estado_lead !== 'abierto') return { movio: false, motivo: 'ya está cerrado' };
    if (pipelineStageOf(lead) === etapaKey) return { movio: false };
    await setBoardStageOverride(leadId, etapaKey, null);
    return { movio: true, etapa: etapa.label };
  }
  const { data: filas, error: ef } = await db.from('lead_funnel').select('etapa').eq('lead_id', leadId).eq('funnel_id', destino).limit(1);
  if (ef) throw new Error(`No pude leer sus productos: ${ef.message}`);
  const fila = ((filas ?? []) as Array<{ etapa: string }>)[0];
  if (!fila) {
    const f = (await listarFunnels()).find((x) => x.id === destino);
    return { movio: false, motivo: `no está en «${f ? nombreVisible(f) : 'ese producto'}»` };
  }
  if (fila.etapa === etapaKey) return { movio: false };
  await moverEtapaEnProducto(leadId, destino, etapaKey, { autor });
  return { movio: true, etapa: etapa.label };
}

function puertos(): PuertosEtiquetas<Etiqueta> {
  return {
    etiqueta: etiquetaPorId,
    leadExiste: async (leadId) => {
      const db = await getTenantDb();
      const { data, error } = await db.from('leads').select('id').eq('id', leadId).limit(1);
      if (error) throw new Error(`No pude leer el lead: ${error.message}`);
      return ((data ?? []) as unknown[]).length > 0;
    },
    // ⚠️ LA IDEMPOTENCIA ES ATÓMICA: el insert con ignore-duplicates no devuelve la fila si ya
    // estaba, así que de dos pedidos en paralelo (dos pestañas, el eco de WhatsApp, un reintento)
    // gana UNO — y el otro contesta `yaEstaba` sin disparar nada.
    insertar: async (leadId, etiquetaId, autor) => {
      const db = await getTenantDb();
      const { data, error } = await db.from('crm_lead_etiquetas')
        .upsert([{ lead_id: leadId, etiqueta_id: etiquetaId, puesta_por: autor, puesta_at: new Date().toISOString() }], { onConflict: 'lead_id,etiqueta_id', ignoreDuplicates: true })
        .select('id');
      if (error) throw new Error(`No se pudo poner la etiqueta: ${error.message}`);
      return ((data ?? []) as unknown[]).length > 0;
    },
    insertarLote: async (leadIds, etiquetaId, autor) => {
      const db = await getTenantDb();
      const out: number[] = [];
      for (let i = 0; i < leadIds.length; i += 200) {
        const tanda = leadIds.slice(i, i + 200);
        // Sólo los leads de ESTE negocio: la FK a `leads(id)` no mira el workspace.
        const { data: propios, error: e1 } = await db.from('leads').select('id').in('id', tanda);
        if (e1) throw new Error(`No pude leer los leads: ${e1.message}`);
        const ids = ((propios ?? []) as Array<{ id: number }>).map((r) => Number(r.id));
        if (!ids.length) continue;
        const ahora = new Date().toISOString();
        const { data, error } = await db.from('crm_lead_etiquetas')
          .upsert(ids.map((lead_id) => ({ lead_id, etiqueta_id: etiquetaId, puesta_por: autor, puesta_at: ahora })), { onConflict: 'lead_id,etiqueta_id', ignoreDuplicates: true })
          .select('lead_id');
        if (error) throw new Error(`No se pudo poner la etiqueta: ${error.message}`);
        out.push(...((data ?? []) as Array<{ lead_id: number }>).map((r) => Number(r.lead_id)));
      }
      return out;
    },
    borrar: async (leadId, etiquetaId) => {
      const db = await getTenantDb();
      const { data, error } = await db.from('crm_lead_etiquetas').delete().eq('lead_id', leadId).eq('etiqueta_id', etiquetaId).select('id');
      if (error) throw new Error(`No se pudo sacar la etiqueta: ${error.message}`);
      return ((data ?? []) as unknown[]).length > 0;
    },
    borrarLote: async (leadIds, etiquetaId) => {
      const db = await getTenantDb();
      const out: number[] = [];
      for (let i = 0; i < leadIds.length; i += 200) {
        const { data, error } = await db.from('crm_lead_etiquetas').delete().eq('etiqueta_id', etiquetaId).in('lead_id', leadIds.slice(i, i + 200)).select('lead_id');
        if (error) throw new Error(`No se pudo sacar la etiqueta: ${error.message}`);
        out.push(...((data ?? []) as Array<{ lead_id: number }>).map((r) => Number(r.lead_id)));
      }
      return out;
    },
    historial: (leadId, texto, autor) => logLeadEvent(leadId, CAMPO_HISTORIAL, texto, autor),
    historialLote: async (leadIds, texto, autor) => {
      const db = await getTenantDb();
      for (let i = 0; i < leadIds.length; i += 200) {
        const filas = leadIds.slice(i, i + 200).map((lead_id) => ({ lead_id, campo: CAMPO_HISTORIAL, valor_anterior: null, valor_nuevo: texto, autor }));
        const { error } = await db.from('lead_audit').insert(filas);
        if (error) console.error('[etiquetas] historial del lote:', error.message);
      }
    },
    // Si el reclamo no se puede leer, NO se dispara: «no pude leer» no autoriza a mandar dos
    // veces. ⚠️ Y NADIE LO LEVANTA DESPUÉS: el disparador «se le puso X» sin horario es SÓLO por
    // evento (decisión del 08/10/2026: el barrido horario no inscribe por etiqueta). Por eso queda
    // escrito en el historial del lead, que es donde se puede ver.
    // Poner y sacar tienen su PROPIA clave (sexta tanda): sacar una etiqueta a los 10 s de ponerla es
    // otro evento, no el mismo disparo repetido.
    reclamarDisparo: async (etiquetaId, leadId, minutos, accion = 'poner') => {
      const ws = await getWorkspaceActual();
      if (ws == null) return false;
      try { return await reclamarEspaciado(ws, accion === 'sacar' ? `etiqueta-quitada:${etiquetaId}` : `etiqueta:${etiquetaId}`, minutos, String(leadId)); } catch (e) {
        console.error(`[etiquetas] espaciado del lead ${leadId}:`, msg(e));
        await logLeadEvent(leadId, CAMPO_HISTORIAL, `No se dispararon las automatizaciones de la etiqueta: ${msg(e)}`.slice(0, 300), MAKO_SETTER);
        return false;
      }
    },
    // ⚠️ IMPORT DINÁMICO: lib/nutricion.ts importa lib/leads.ts, que importa éste por sus ganchos.
    // El tipo se declara acá para compilar en los dos árboles; `enrolarPorEvento` nunca tira.
    // Sacar dispara 'etiqueta_quitada' (sexta tanda, CRON punto 3: «Se elimina etiqueta a un lead»);
    // el «Ignorar» de cada automatización lo mira el motor (`disparaPorEvento`, lib/disparadores.ts).
    disparar: async (leadId, etiquetaId, accion = 'poner') => {
      try {
        const mod = (await import('./nutricion')) as unknown as {
          enrolarPorEvento: (leadId: number, evento: string, ctx?: { etiquetaId?: number }) => Promise<number>;
        };
        if (accion === 'sacar') await mod.enrolarPorEvento(leadId, 'etiqueta_quitada', { etiquetaId });
        else await mod.enrolarPorEvento(leadId, 'etiqueta', { etiquetaId });
      } catch (e) {
        console.error(`[etiquetas] no pude disparar las automatizaciones del lead ${leadId}:`, msg(e));
      }
    },
    moverAEtapa: moverPorEtiqueta,
    etiquetasDeEtapa: async (funnelId, etapaKey) => {
      const def = await idDelFunnelDefault();
      const destino = funnelId ?? def;
      const db = await getTenantDb();
      const { data, error } = await db.from('crm_etiquetas').select(COLS).eq('etapa_key', etapaKey).is('archivada_at', null);
      if (error) throw new Error(`No pude leer las etiquetas de la etapa: ${error.message}`);
      return ((data ?? []) as Array<Record<string, unknown>>).map(aEtiqueta).filter((e) => (e.funnel_id ?? def) === destino);
    },
    destinos: async (e) => (e.wa_label_id && e.wa_instance ? ['WhatsApp'] : []),
    sincronizar: sincronizarAfuera,
  };
}

// ── La puerta de escritura ───────────────────────────────────────────────────

type OpcionesEscritura = { autor?: string; origen?: 'etapa' | 'directo' };

const envolver = async (fn: () => Promise<ResultadoPoner>): Promise<ResultadoPoner> => {
  try { return await fn(); } catch (e) {
    console.error('[etiquetas]', msg(e));
    return { ok: false, error: msg(e) };
  }
};

/**
 * Pone una etiqueta a un lead. Idempotente: si ya la tenía, `yaEstaba` y no pasa nada más. Nunca
 * tira. Ver el orden y los cortes en lib/etiquetas-motor.ts.
 */
export async function ponerEtiqueta(leadId: number, etiquetaId: number, opts?: OpcionesEscritura): Promise<ResultadoPoner> {
  const autor = await autorDelMovimiento(opts?.autor);
  return envolver(() => ponerEtiquetaCon(puertos(), leadId, etiquetaId, { autor, origen: opts?.origen }));
}

/**
 * Saca una etiqueta a un lead. Idempotente (`yaEstaba` si no la tenía). Dispara «Se elimina etiqueta
 * a un lead» (sexta tanda), salvo que la saque salir de la etapa vinculada. Nunca tira.
 */
export async function sacarEtiqueta(leadId: number, etiquetaId: number, opts?: OpcionesEscritura): Promise<ResultadoPoner> {
  const autor = await autorDelMovimiento(opts?.autor);
  return envolver(() => sacarEtiquetaCon(puertos(), leadId, etiquetaId, { autor, origen: opts?.origen }));
}

/** El lote de la barra del CRM: NO dispara automatizaciones ni mueve de etapa. Nunca tira. */
export async function ponerEtiquetaLote(leadIds: number[], etiquetaId: number, opts?: { autor?: string }): Promise<ResultadoLote> {
  const autor = await autorDelMovimiento(opts?.autor);
  try { return await ponerLoteCon(puertos(), leadIds, etiquetaId, autor); } catch (e) { return { ok: false, error: msg(e) }; }
}

/** El inverso del lote, y su Deshacer. Nunca tira. */
export async function sacarEtiquetaLote(leadIds: number[], etiquetaId: number, opts?: { autor?: string }): Promise<ResultadoLote> {
  const autor = await autorDelMovimiento(opts?.autor);
  try { return await sacarLoteCon(puertos(), leadIds, etiquetaId, autor); } catch (e) { return { ok: false, error: msg(e) }; }
}

/**
 * El gancho de ETAPA: el lead pasó de `desde` a `hacia` en el producto `funnelId` (NULL = el del
 * negocio). Saca las etiquetas vinculadas a la que deja y pone las de la que entra. Lo llaman
 * `setBoardStageOverride`, `setPipelineStage`, `updateLead` y `upsertLeadFromCalendly`
 * (lib/leads.ts) y `moverEtapaEnProducto` (lib/lead-funnel.ts), con import dinámico. Nunca tira:
 * mover un lead tiene que funcionar aunque las etiquetas fallen, y el fallo queda en el log.
 *
 * Adentro de un LOTE (`conLoteDeEtiquetas`), escribe la base y deja lo que cambió para el final,
 * sin pegarle a WhatsApp en cada vuelta.
 */
export async function espejarEtapa(
  leadId: number,
  funnelId: number | null,
  desde: string | null,
  hacia: string | null,
  opts?: { autor?: string },
): Promise<void> {
  try {
    if (desde === hacia) return;
    const autor = await autorDelMovimiento(opts?.autor);
    const lote = loteStore.getStore();
    const r = await espejarEtapaCon(puertos(), leadId, funnelId, desde, hacia, autor, { sincronizar: !lote });
    if (lote) lote.cambios.push(...r.cambios);
  } catch (e) {
    console.error(`[etiquetas] el espejo de la etapa del lead ${leadId} falló:`, msg(e));
  }
}

/**
 * EL FLAG DE LOTE HASTA EL ESPEJO (revisión del 08/10/2026, etiquetas-4/datos-3). Mover 200 leads
 * de etapa desde la barra del CRM (`moverLeadsDeEtapaAction`, que llama de a uno al MISMO camino que
 * el tablero) esperaba, lead por lead, la sincronización de cada etiqueta espejada (entonces WhatsApp
 * y tres llamadas a Chatwoot por etiqueta): cientos de viajes HTTP adentro de una server action de
 * 60 s, y el lote cortado a la mitad sin poder devolver el conteo.
 *
 * Adentro de `fn`, todo espejo (`espejarEtapa`, lo llame setPipelineStage, updateLead o quien sea)
 * escribe la base y anota lo que cambió; al terminar `fn` —también si tira— se sincroniza con el
 * MISMO tope que el lote de etiquetas y el rastro de los que no se pasaron.
 *
 * ⚠️ VA POR CONTEXTO Y NO POR PARÁMETRO, a propósito: el camino de a uno es una server action
 * EXPORTADA (`setLeadStageAction`), y un parámetro suyo lo manda el navegador — quién sincroniza
 * qué lo decide el server. Y así lo hereda todo lo que el lote toque, sin que cada firma lo lleve.
 */
const loteStore = new AsyncLocalStorage<{ cambios: CambioEtiqueta[] }>();

export async function conLoteDeEtiquetas<T>(fn: () => Promise<T>): Promise<{ resultado: T; sinSincronizar: number }> {
  const lote = { cambios: [] as CambioEtiqueta[] };
  let resultado: T;
  try {
    resultado = await loteStore.run(lote, fn);
  } catch (e) {
    // Lo que ya se movió también se sincroniza (o deja su rastro) aunque el lote se haya cortado.
    await sincronizarEtiquetasDiferidas(lote.cambios);
    throw e;
  }
  const { sinSincronizar } = await sincronizarEtiquetasDiferidas(lote.cambios);
  return { resultado, sinSincronizar };
}

/**
 * El final de un lote: pasa a WhatsApp lo que el espejo dejó sin sincronizar, con el
 * MISMO tope que el lote de etiquetas (`SYNC_LOTE_MAX`) y una línea en el historial de los que no
 * se pasaron. Nunca tira: los leads ya se movieron y sus etiquetas ya están en la base.
 */
export async function sincronizarEtiquetasDiferidas(cambios: ReadonlyArray<CambioEtiqueta>): Promise<{ sincronizados: number; sinSincronizar: number }> {
  if (!cambios.length) return { sincronizados: 0, sinSincronizar: 0 };
  try {
    return await sincronizarDiferidos(puertos(), cambios);
  } catch (e) {
    console.error('[etiquetas] la sincronización del lote falló:', msg(e));
    return { sincronizados: 0, sinSincronizar: cambios.length };
  }
}

// ── El barrido del espejo etapa → etiqueta (cron horario) ────────────────────
//
// Revisión del 08/10/2026 (etiquetas-3, datos-2): el espejo sólo corría en los movimientos
// EXPLÍCITOS. Un lead que reserva por Calendly cambia de etapa EFECTIVA (`pipelineStageOf` deriva
// «Agenda R1» de la fecha) sin que nadie escriba `pipeline_stage`, y en el ws1 ése es el camino de
// la mayoría. Ahora `updateLead`, `upsertLeadFromCalendly` y el «volver a la derivación» llaman al
// espejo; este barrido es la RED para lo que escriba la etapa por otro lado (un alta, un agregado
// a otro producto, un UPDATE directo). Va en el cron del CRM automático, no en el de nutrición: no
// inscribe ni manda nada, sólo pone y saca etiquetas con `origen: 'etapa'` (sin disparo, sin mover).
// El porqué de comparar contra una FOTO y no contra el estado, en lib/etiquetas-reglas.ts.

const KEY_FOTO_ESPEJO = 'etiquetas.espejo.etapas';
/** Cuántas transiciones aplica UNA corrida por negocio. Las demás quedan para la próxima (planEspejo). */
const TOPE_TRANSICIONES = 100;
const COLS_ETAPA_LEAD = 'id, funnel_id, pipeline_stage, estado_lead, fecha_agenda, fecha_junta_1, fecha_junta_2, asistio_j1, asistio_j2, nutricion_realizada';

export type ResultadoConciliacion = {
  /** true = primera corrida (o foto ilegible): se guardó la línea de base sin tocar nada. */
  lineaBase: boolean;
  transiciones: number;
  /** Las que quedaron para la próxima corrida por el tope. */
  diferidas: number;
  puestas: number;
  sacadas: number;
  /** Etiquetas que se dejaron como estaban porque una persona (o un gancho) las tocó desde la foto. */
  respetadas: number;
  fallaron: number;
  sinSincronizar: number;
};

/**
 * Por lead, las etiquetas (por su clave de nombre) que alguien tocó desde `desde`: el historial
 * del lead dice «Se puso «X»», «Se sacó «X»», ««X» no se puso en WhatsApp…». El barrido no las
 * vuelve a poner ni a sacar: o el gancho del movimiento ya lo hizo, o una PERSONA decidió otra cosa
 * después — y una red no deshace una decisión. Por NOMBRE porque es lo que el historial guarda:
 * una etiqueta renombrada en el medio no se reconoce y el barrido la espeja igual.
 */
async function etiquetasTocadas(leadIds: number[], desde: string): Promise<Map<number, Set<string>>> {
  const out = new Map<number, Set<string>>();
  const ids = [...new Set(leadIds)];
  const db = await getTenantDb();
  for (let i = 0; i < ids.length; i += 200) {
    const filas = await leerTodo<{ id: number; lead_id: number; valor_nuevo: string | null }>(db, 'lead_audit', 'id, lead_id, valor_nuevo', {
      orden: 'id', eq: { campo: CAMPO_HISTORIAL },
      filtros: (q) => q.in('lead_id', ids.slice(i, i + 200)).gte('created_at', desde),
    });
    for (const f of filas) {
      const nombre = /«([^»]+)»/.exec(f.valor_nuevo ?? '')?.[1];
      if (!nombre) continue;
      const set = out.get(Number(f.lead_id)) ?? new Set<string>();
      set.add(claveNombre(nombre));
      out.set(Number(f.lead_id), set);
    }
  }
  return out;
}

/**
 * El barrido de UN negocio (corre adentro de `runWithWorkspace`). Tira si no puede leer: una foto
 * que no se pudo leer NO es «no hay foto» — tratarla así haría de esta corrida la línea de base y
 * taparía las transiciones de la última hora.
 */
export async function conciliarEspejoEtapas(): Promise<ResultadoConciliacion> {
  const out: ResultadoConciliacion = { lineaBase: false, transiciones: 0, diferidas: 0, puestas: 0, sacadas: 0, respetadas: 0, fallaron: 0, sinSincronizar: 0 };
  const db = await getTenantDb();
  const { data, error } = await db.from('crm_etiquetas').select(COLS).not('etapa_key', 'is', null).is('archivada_at', null);
  if (error) throw new Error(`No pude leer las etiquetas vinculadas: ${error.message}`);
  const vinculadas = ((data ?? []) as Array<Record<string, unknown>>).map(aEtiqueta);
  // Sin ninguna vinculada no hay nada que espejar. La foto vieja (si hay) queda: un producto que
  // vuelva a tener una vinculada arranca como línea de base, porque no está en sus `productos`.
  if (!vinculadas.length) return out;
  const def = await idDelFunnelDefault();
  if (def == null) throw new Error('No encontré el producto del negocio.');
  const productos = [...new Set(vinculadas.map((e) => e.funnel_id ?? def))];
  const foto = leerFotoEspejo(await getSettingEstricto(KEY_FOTO_ESPEJO));

  // Dónde está HOY cada lead en cada producto mirado: la casa por su etapa efectiva (la misma que
  // dibuja el tablero), los agregados por su fila de `lead_funnel`.
  const leads = await leerTodo<StageDerivable & { id: number; funnel_id: number | null }>(db, 'leads', COLS_ETAPA_LEAD, { orden: 'id' });
  const mirados = new Set(productos);
  const vivos = new Set<number>();
  const casaDe = new Map<number, number | null>();
  const actuales: EtapaActual[] = [];
  for (const l of leads) {
    const id = Number(l.id);
    const casa = casaReal(l.funnel_id == null ? null : Number(l.funnel_id), def);
    vivos.add(id);
    casaDe.set(id, casa);
    if (casa != null && mirados.has(casa)) actuales.push({ leadId: id, productoId: casa, etapa: pipelineStageOf(l) });
  }
  const filas = await leerTodo<{ id: number; lead_id: number; funnel_id: number; etapa: string }>(db, 'lead_funnel', 'id, lead_id, funnel_id, etapa', {
    orden: 'id', filtros: (q) => q.in('funnel_id', productos),
  });
  for (const f of filas) {
    const id = Number(f.lead_id);
    // Una fila que nombra a la casa no debería existir (lib/lead-funnel-reglas.ts): manda la casa.
    if (vivos.has(id) && casaDe.get(id) !== Number(f.funnel_id)) actuales.push({ leadId: id, productoId: Number(f.funnel_id), etapa: String(f.etapa) });
  }

  const plan = planEspejo(foto, actuales, vivos, productos, { ahora: new Date().toISOString(), tope: TOPE_TRANSICIONES });
  out.diferidas = plan.diferidas;
  if (!foto) {
    await setSetting(KEY_FOTO_ESPEJO, JSON.stringify(plan.foto));
    out.lineaBase = true;
    return out;
  }

  const tocadas = plan.transiciones.length ? await etiquetasTocadas(plan.transiciones.map((t) => t.leadId), foto.at) : new Map<number, Set<string>>();
  const base = puertos();
  const delProducto = (funnelId: number | null, etapaKey: string) => vinculadas.filter((e) => e.etapa_key === etapaKey && (e.funnel_id ?? def) === (funnelId ?? def));
  const porSincronizar: CambioEtiqueta[] = [];
  for (const t of plan.transiciones) {
    const suyas = tocadas.get(t.leadId);
    const p: PuertosEtiquetas<Etiqueta> = {
      ...base,
      etiqueta: async (id) => vinculadas.find((e) => e.id === id) ?? base.etiqueta(id),
      etiquetasDeEtapa: async (funnelId, etapaKey) => delProducto(funnelId, etapaKey).filter((e) => {
        const tocada = suyas?.has(claveNombre(e.nombre)) ?? false;
        if (tocada) out.respetadas++;
        return !tocada;
      }),
    };
    try {
      const r = await espejarEtapaCon(p, t.leadId, t.productoId, t.desde, t.hacia, MAKO_SETTER, { sincronizar: false });
      out.transiciones++;
      out.puestas += r.puestas;
      out.sacadas += r.sacadas;
      porSincronizar.push(...r.cambios);
    } catch (e) {
      // Se reintenta en la próxima corrida: la foto vuelve a su etapa vieja para este lead.
      out.fallaron++;
      const k = `${t.leadId}:${t.productoId}`;
      if (t.desde == null) delete plan.foto.etapas[k]; else plan.foto.etapas[k] = t.desde;
      console.error(`[etiquetas] barrido del espejo, lead ${t.leadId}:`, msg(e));
    }
  }
  out.sinSincronizar = (await sincronizarEtiquetasDiferidas(porSincronizar)).sinSincronizar;
  // La foto se fecha DESPUÉS de aplicar: si no, el historial que escribió este mismo barrido
  // quedaría «después de la foto» y la corrida siguiente lo leería como una persona que tocó.
  plan.foto.at = new Date().toISOString();
  await setSetting(KEY_FOTO_ESPEJO, JSON.stringify(plan.foto));
  return out;
}

/**
 * El barrido en cada negocio activo, de a uno. Lo corre el cron horario del CRM automático
 * (app/api/cron/crm-automatico). `hastaMs` corta la tanda: lo que no entró se hace la hora que
 * viene (la foto de cada negocio guarda dónde quedó). Nunca tira.
 */
export async function conciliarEspejoEtapasTodos(opts?: { soloWs?: number; hastaMs?: number }): Promise<Array<{ ws: number; ok: boolean; error?: string; pospuesto?: boolean } & Partial<ResultadoConciliacion>>> {
  let workspaces: Array<{ id: number; estado?: string }>;
  try {
    workspaces = (await listarWorkspaces()).filter((w) => w.estado === 'activo');
  } catch (e) {
    return [{ ws: 0, ok: false, error: `No pude leer los negocios: ${msg(e)}` }];
  }
  if (opts?.soloWs != null) workspaces = workspaces.filter((w) => w.id === opts.soloWs);
  const out: Array<{ ws: number; ok: boolean; error?: string; pospuesto?: boolean } & Partial<ResultadoConciliacion>> = [];
  for (const w of workspaces) {
    if (opts?.hastaMs != null && Date.now() > opts.hastaMs) { out.push({ ws: w.id, ok: true, pospuesto: true }); continue; }
    try {
      out.push({ ws: w.id, ok: true, ...(await runWithWorkspace(w.id, () => conciliarEspejoEtapas())) });
    } catch (e) {
      console.error(`[etiquetas] barrido del espejo, ws ${w.id}:`, msg(e));
      out.push({ ws: w.id, ok: false, error: msg(e) });
    }
  }
  return out;
}
