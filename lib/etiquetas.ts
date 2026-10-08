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
import { getTenantDb, getWorkspaceActual } from './workspace';
import { leerTodo } from './supabase-paginado';
import { logLeadEvent, autorDelMovimiento, setBoardStageOverride } from './leads';
import { idDelFunnelDefault, listarFunnels } from './funnels';
import { etapasDeProducto, moverEtapaEnProducto } from './lead-funnel';
import { casaReal, nombreVisible } from './lead-funnel-reglas';
import { terminalEstadoFor, pipelineStageOf, type StageDerivable } from './pipeline';
import { reclamarEspaciado } from './espaciado';
import { etiquetarChatWhatsApp, getInstanciaRow } from './evolution';
import { catalogoParaMapear } from './evolution-labels';
import { chatwootConfigurado, asegurarEtiquetaChatwoot, contactoChatwootEstricto, etiquetarContactoChatwoot } from './chatwoot';
import {
  limpiarNombreEtiqueta, claveNombre, colorValido, emojiValido, slugChatwoot, usoEnPasos,
  COLOR_ETIQUETA_DEFAULT, type LabelCelular,
} from './etiquetas-reglas';
import {
  ponerEtiquetaCon, sacarEtiquetaCon, espejarEtapaCon, ponerLoteCon, sacarLoteCon,
  type PuertosEtiquetas, type ResultadoPoner, type ResultadoLote, type ResultadoSync,
} from './etiquetas-motor';

export type { ResultadoPoner, ResultadoLote, LabelCelular };

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
  /** El slug con el que se creó en Chatwoot (se guarda, no se recalcula). */
  chatwoot_label: string | null;
  orden: number;
  archivada_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Un error que se le puede mostrar a la persona tal cual (400, no 500). */
export class EtiquetaError extends Error {}
export const esEtiquetaError = (e: unknown): e is EtiquetaError => e instanceof EtiquetaError;

const COLS = 'id, nombre, color, emoji, funnel_id, etapa_key, wa_instance, wa_label_id, chatwoot_label, orden, archivada_at, created_at, updated_at';
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
    chatwoot_label: (r.chatwoot_label as string | null) ?? null,
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

/** Crea la etiqueta en Chatwoot si el negocio lo tiene, y guarda el slug. Nunca tira: devuelve el aviso. */
async function alChatwoot(e: Etiqueta): Promise<string | null> {
  try {
    if (!(await chatwootConfigurado())) return null;
    const slug = await asegurarEtiquetaChatwoot(slugChatwoot(e.nombre, e.id), e.color, `MaKo · ${e.nombre}`);
    if (slug !== e.chatwoot_label) await guardarSlug(e.id, slug);
    e.chatwoot_label = slug;
    return null;
  } catch (err) {
    console.error(`[etiquetas] Chatwoot, etiqueta ${e.id}:`, msg(err));
    return `No se creó en Chatwoot: ${msg(err)}`.slice(0, 200);
  }
}

async function guardarSlug(id: number, slug: string): Promise<void> {
  const db = await getTenantDb();
  const { error } = await db.from('crm_etiquetas').update({ chatwoot_label: slug, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(`No pude guardar la etiqueta de Chatwoot: ${error.message}`);
}

/** Crea una etiqueta. Devuelve la etiqueta y, si algo de afuera no salió, el aviso. */
export async function crearEtiqueta(input: EntradaEtiqueta): Promise<{ etiqueta: Etiqueta; aviso: string | null }> {
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
  const etiqueta = aEtiqueta(data as Record<string, unknown>);
  return { etiqueta, aviso: await alChatwoot(etiqueta) };
}

/**
 * Edita nombre, color, emoji, el vínculo a una etapa o la etiqueta del celular. Cambiar el vínculo
 * vale DE ACÁ EN ADELANTE: no les pone ni les saca la etiqueta a los que ya están en esa etapa.
 * Renombrar no renombra en Chatwoot (el slug guardado sigue valiendo, a propósito).
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

/** Pone o saca la etiqueta en WhatsApp (si está mapeada) y en Chatwoot (si el negocio lo tiene). */
async function sincronizarAfuera(leadId: number, e: Etiqueta, accion: 'poner' | 'sacar'): Promise<ResultadoSync[]> {
  const out: ResultadoSync[] = [];
  const quiereWa = Boolean(e.wa_label_id && e.wa_instance);
  let cw = false;
  try { cw = await chatwootConfigurado(); } catch { cw = false; }
  if (!quiereWa && !cw) return out;
  let tel: string | null;
  try { tel = await telefonoDelLead(leadId); } catch (err) { return [{ destino: quiereWa ? 'WhatsApp' : 'Chatwoot', ok: false, error: msg(err) }]; }
  // Sin teléfono no hay chat que etiquetar: no es un fallo.
  if (!tel) return out;
  if (quiereWa) {
    try {
      // El jid del espejo, que es el que dio WhatsApp; si no hay chat, el número como jid
      // completo (así `createJid` de Evolution no le borra el 9 a un argentino).
      const jid = (await jidDelChat(tel)) ?? `${tel}@s.whatsapp.net`;
      const r = await etiquetarChatWhatsApp(jid, String(e.wa_label_id), accion === 'poner' ? 'add' : 'remove', e.wa_instance);
      out.push(r.ok ? { destino: 'WhatsApp', ok: true } : { destino: 'WhatsApp', ok: false, error: r.error });
    } catch (err) { out.push({ destino: 'WhatsApp', ok: false, error: msg(err) }); }
  }
  if (cw) {
    try {
      let slug = e.chatwoot_label;
      // Sacar una que nunca se creó allá no tiene nada que sacar.
      if (!slug && accion === 'poner') {
        slug = await asegurarEtiquetaChatwoot(slugChatwoot(e.nombre, e.id), e.color, `MaKo · ${e.nombre}`);
        await guardarSlug(e.id, slug);
      }
      if (slug) {
        const contacto = await contactoChatwootEstricto(tel);
        // Sin contacto en Chatwoot no se crea uno: etiquetar no es dar de alta.
        if (contacto != null) { await etiquetarContactoChatwoot(contacto, slug, accion); out.push({ destino: 'Chatwoot', ok: true }); }
      }
    } catch (err) { out.push({ destino: 'Chatwoot', ok: false, error: msg(err) }); }
  }
  return out;
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
    // veces. El barrido del cron (el cohorte del disparador) lo levanta en la próxima corrida.
    reclamarDisparo: async (etiquetaId, leadId, minutos) => {
      const ws = await getWorkspaceActual();
      if (ws == null) return false;
      try { return await reclamarEspaciado(ws, `etiqueta:${etiquetaId}`, minutos, String(leadId)); } catch (e) {
        console.error(`[etiquetas] espaciado del lead ${leadId}:`, msg(e));
        return false;
      }
    },
    // ⚠️ IMPORT DINÁMICO: lib/nutricion.ts importa lib/leads.ts, que importa éste por sus ganchos.
    // El evento 'etiqueta' y su `etiquetaId` los suma la parte M (diseño §2): hasta que su
    // nutricion.ts llegue, `TRIGGERS_POR_EVENTO['etiqueta']` no existe y esto enrola en cero. El
    // tipo se declara acá para compilar en los dos árboles; `enrolarPorEvento` nunca tira.
    disparar: async (leadId, etiquetaId) => {
      try {
        const mod = (await import('./nutricion')) as unknown as {
          enrolarPorEvento: (leadId: number, evento: string, ctx?: { etiquetaId?: number }) => Promise<number>;
        };
        await mod.enrolarPorEvento(leadId, 'etiqueta', { etiquetaId });
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
    destinos: async (e) => {
      const out: Array<ResultadoSync['destino']> = [];
      if (e.wa_label_id && e.wa_instance) out.push('WhatsApp');
      try { if (await chatwootConfigurado()) out.push('Chatwoot'); } catch { /* sin Chatwoot */ }
      return out;
    },
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

/** Saca una etiqueta a un lead. Idempotente (`yaEstaba` si no la tenía). No dispara nada. Nunca tira. */
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
 * `setBoardStageOverride`, `setPipelineStage` (lib/leads.ts) y `moverEtapaEnProducto`
 * (lib/lead-funnel.ts), con import dinámico. Nunca tira: mover un lead tiene que funcionar aunque
 * las etiquetas fallen, y el fallo queda en el log.
 */
export async function espejarEtapa(leadId: number, funnelId: number | null, desde: string | null, hacia: string | null, opts?: { autor?: string }): Promise<void> {
  try {
    if (desde === hacia) return;
    const autor = await autorDelMovimiento(opts?.autor);
    await espejarEtapaCon(puertos(), leadId, funnelId, desde, hacia, autor);
  } catch (e) {
    console.error(`[etiquetas] el espejo de la etapa del lead ${leadId} falló:`, msg(e));
  }
}
