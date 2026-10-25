// =============================================================================
// recolector — el recolector del Second Brain: lo que el negocio ya vivió en WhatsApp, a su conocimiento (25/10/2026)
// =============================================================================
// Pedido de Martín (24/10/2026): «Quiero que implementes en el Second Brain un "recolector de información" de TODOS
// lados... De los mensajes de WhatsApp... Esto para todos los ws». El diseño: docs/diseno-second-brain-recolector.md
// (§8, el primer paso: WhatsApp, de punta a punta). Lo puro (qué conversaciones, el pedido, la respuesta, el cuerpo), en
// lib/recolector-reglas.ts.
//
// UNA VUELTA POR NEGOCIO (la llama el cron, app/api/cron/second-brain-recolector, adentro de `runWithWorkspace` y de
// «sólo su IA» del negocio):
//   1. Apagado por el negocio → nada. Sin SU IA (un cliente) → nada: «no corre con la nuestra» (§5). El espacio de MaKo
//      usa la de la plataforma, que es la suya.
//   2. Lee su libro (`second_brain_recolectado`: qué conversación leyó y hasta dónde) y los mensajes de los últimos 14 días
//      (`wa_mensajes`), y elige las conversaciones con algo nuevo (`conversacionesPendientes`: personas, con un lead).
//   3. Por cada una: lee lo nuevo, lo que ya se sabía (su entrada), le pide los HECHOS a la IA del negocio y los guarda en
//      `mako_knowledge` (fuente 'whatsapp', que es lo que consulta el chat del Second Brain), con su procedencia.
//   4. La marca (`hasta`) avanza DESPUÉS de guardar: si algo falla, esa conversación se vuelve a leer la próxima vez.
//
// ⚠️ SÓLO LEE (§5): ningún mensaje sale, nada se marca leído, ningún lead cambia. Escribe en el conocimiento del negocio,
//    en su libro y en su setting. Nada cruza de negocio: todo con `getTenantDb` adentro de su `runWithWorkspace`, y lo
//    recolectado no se presta (lib/rag-prestamo.ts sólo presta la fuente `mako`).
// ⚠️ UN «NO PUDE LEER» NO ES «NO HABÍA NADA»: cada lectura mira su error y corta la vuelta (la marca no avanza).
// =============================================================================

import 'server-only';
import { getTenantDb, wsSuperAdmin } from './workspace';
import { getSetting, setSetting } from './settings';
import { leerTodo } from './supabase-paginado';
import { claveDeIAPropia } from './ia-del-negocio';
import { chatCheapCascade } from './ai-cheap';
import { createKnowledge, updateKnowledge } from './mako-knowledge';
import { tzDeWorkspace } from './timezone';
import {
  CLAVE_RECOLECTOR, DIAS_PRIMERA_VEZ, FUENTE_WHATSAPP, MAX_MENSAJES_POR_CONVERSACION,
  conversacionesPendientes, cuerpoDeLaEntrada, hechosDeLaEntrada, leerEstadoRecolector, leerRespuesta, pedidoAlaIA, tituloDeLaEntrada, transcripcion,
  type EstadoRecolector, type MensajeWa, type ResultadoVuelta, type ResumenRecolector,
} from './recolector-reglas';

export const FEATURE_RECOLECTOR = 'second-brain-recolector';
const TABLA = 'second_brain_recolectado';

/** El interruptor de la plataforma (env `RECOLECTOR_SECOND_BRAIN`): `off` no corre, `seco` cuenta sin IA ni escribir. */
export type ModoRecolector = 'off' | 'seco' | 'on';
export const modoRecolector = (v = process.env.RECOLECTOR_SECOND_BRAIN): ModoRecolector => (v === 'off' ? 'off' : v === 'seco' ? 'seco' : 'on');

export type VueltaNegocio = {
  ws: number;
  resultado: ResultadoVuelta;
  motivo?: string;
  pendientes: number;
  nuevas: number;
  actualizadas: number;
  /** Mensajes leídos en esta vuelta. */
  leidas: number;
};

type FilaLibro = { ref: string; etiqueta: string; knowledge_id: number | null; mensajes: number; hasta: string };
type MensajeCompleto = MensajeWa & { push_name: string | null; telefono: string | null };

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** ¿El error es «la tabla no existe» (la migración 0332 todavía no se aplicó)? */
const faltaLaTabla = (e: unknown) => /second_brain_recolectado/.test(msg(e)) && /does not exist|relation|schema cache|not find/i.test(msg(e));

async function anotar(estado: EstadoRecolector, v: VueltaNegocio): Promise<void> {
  const ultima = { at: new Date().toISOString(), resultado: v.resultado, ...(v.motivo ? { motivo: v.motivo.slice(0, 300) } : {}), nuevas: v.nuevas, actualizadas: v.actualizadas, leidas: v.leidas };
  await setSetting(CLAVE_RECOLECTOR, JSON.stringify({ prendido: estado.prendido, ultima })).catch((e) => console.error(`[recolector] ws=${v.ws}: no pude anotar la vuelta: ${msg(e)}`));
}

/** Con quién es la conversación: el lead del CRM, el nombre que puso en WhatsApp, o el número. */
async function etiquetaDe(mensajes: readonly MensajeCompleto[], previa: string | null): Promise<string> {
  const leadId = mensajes.find((m) => m.lead_id != null)?.lead_id ?? null;
  if (leadId != null) {
    const { data, error } = await (await getTenantDb()).from('leads').select('nombre').eq('id', leadId).maybeSingle();
    if (error) throw new Error(`no pude leer el lead ${leadId}: ${error.message}`);
    const n = String((data as { nombre?: string | null } | null)?.nombre ?? '').trim();
    if (n) return n.slice(0, 120);
  }
  const push = mensajes.find((m) => !m.from_me && m.push_name?.trim())?.push_name?.trim();
  if (push) return push.slice(0, 120);
  if (previa?.trim()) return previa.trim();
  const tel = mensajes.find((m) => m.telefono)?.telefono;
  return tel ? `+${tel.replace(/\D/g, '')}` : 'un contacto';
}

/**
 * UNA vuelta del recolector de WhatsApp para el negocio en curso (adentro de su `runWithWorkspace`). Nunca tira: lo que
 * pasó vuelve en `resultado` y queda anotado en su setting (lo que ve la pantalla).
 */
export async function recolectarWhatsApp(ws: number, o: { deadline: number; seco?: boolean; ahora?: Date }): Promise<VueltaNegocio> {
  const v: VueltaNegocio = { ws, resultado: 'ok', pendientes: 0, nuevas: 0, actualizadas: 0, leidas: 0 };
  const estado = leerEstadoRecolector(await getSetting(CLAVE_RECOLECTOR));
  if (!estado.prendido) return { ...v, resultado: 'apagado' };
  const ahora = o.ahora ?? new Date();
  try {
    // Sin SU IA, un cliente no corre (§5). La plataforma (el espacio de MaKo) usa la suya, que es la de la plataforma.
    const esPlataforma = ws === (await wsSuperAdmin());
    if (!esPlataforma && (await claveDeIAPropia(ws)) !== true) {
      const r = { ...v, resultado: 'sin-ia' as const };
      if (!o.seco) await anotar(estado, r);
      return r;
    }
    const db = await getTenantDb();
    let libro: FilaLibro[];
    try {
      libro = await leerTodo<FilaLibro>(db, TABLA, 'ref, etiqueta, knowledge_id, mensajes, hasta', { orden: 'id', filtros: (q) => q.eq('fuente', FUENTE_WHATSAPP) });
    } catch (e) {
      if (faltaLaTabla(e)) return { ...v, resultado: 'sin-tabla', motivo: 'falta la migración 0332' };
      throw e;
    }
    const porRef = new Map(libro.map((f) => [f.ref, f]));
    const desdeIso = new Date(ahora.getTime() - DIAS_PRIMERA_VEZ * 86_400_000).toISOString();
    const recientes = await db.from('wa_mensajes').select('chat_jid, wa_timestamp, from_me, tipo, texto, lead_id')
      .gte('wa_timestamp', desdeIso).order('wa_timestamp', { ascending: false }).limit(3000);
    if (recientes.error) throw new Error(`no pude leer los mensajes: ${recientes.error.message}`);
    const pendientes = conversacionesPendientes((recientes.data ?? []) as MensajeWa[], new Map(libro.map((f) => [f.ref, f.hasta])));
    v.pendientes = pendientes.length;
    if (o.seco || pendientes.length === 0) {
      if (!o.seco) await anotar(estado, v);
      return v;
    }
    const tz = await tzDeWorkspace(ws);
    for (const p of pendientes) {
      // Lo que no entra en esta vuelta, entra en la próxima (corre cada hora): nunca se corta una a la mitad.
      if (Date.now() > o.deadline - 50_000) break;
      const fila = porRef.get(p.jid) ?? null;
      const leidos = await db.from('wa_mensajes').select('chat_jid, wa_timestamp, from_me, tipo, texto, lead_id, push_name, telefono')
        .eq('chat_jid', p.jid).gt('wa_timestamp', fila?.hasta ?? desdeIso).order('wa_timestamp', { ascending: false }).limit(MAX_MENSAJES_POR_CONVERSACION);
      if (leidos.error) throw new Error(`no pude leer la conversación: ${leidos.error.message}`);
      const mensajes = ((leidos.data ?? []) as MensajeCompleto[]).reverse();
      if (!mensajes.length) continue;
      const etiqueta = await etiquetaDe(mensajes, fila?.etiqueta ?? null);
      let previo: string[] = [];
      if (fila?.knowledge_id != null) {
        const k = await db.from('mako_knowledge').select('cuerpo').eq('id', fila.knowledge_id).maybeSingle();
        if (k.error) throw new Error(`no pude leer lo que ya sabía: ${k.error.message}`);
        previo = k.data ? hechosDeLaEntrada(String((k.data as { cuerpo?: string }).cuerpo ?? '')) : [];
      }
      const { system, user } = pedidoAlaIA({ etiqueta, previo, transcripcion: transcripcion(mensajes, tz) });
      const errores: string[] = [];
      const texto = await chatCheapCascade({
        system, user, feature: FEATURE_RECOLECTOR, maxTokens: 900, temperature: 0.2, pii: true, erroresOut: errores,
        hastaMs: Math.min(o.deadline - 20_000, Date.now() + 60_000),
      });
      if (!texto.trim()) {
        // Sin respuesta y sin errores: no hay IA para probar (la clave se fue). Con errores: la IA falló. En los dos casos la
        // vuelta para acá y la marca de esta conversación NO avanza.
        v.resultado = errores.length ? 'error' : 'sin-ia';
        if (errores.length) v.motivo = `la IA no respondió (${errores[0].slice(0, 120)})`;
        break;
      }
      const r = leerRespuesta(texto);
      const ultimo = mensajes[mensajes.length - 1].wa_timestamp;
      let knowledgeId = fila?.knowledge_id ?? null;
      if (!r.nada) {
        const cuerpo = cuerpoDeLaEntrada({ etiqueta, hechos: r.hechos, desde: knowledgeId != null ? null : mensajes[0].wa_timestamp, hasta: ultimo, ahora: ahora.toISOString(), tz });
        const titulo = tituloDeLaEntrada(etiqueta);
        const actualizada = knowledgeId != null ? await updateKnowledge(knowledgeId, { titulo, cuerpo }) : null;
        if (actualizada) v.actualizadas += 1;
        else {
          // Sin entrada (la primera vez, o el negocio la borró): una nueva.
          const nueva = await createKnowledge({ titulo, categoria: 'WhatsApp', cuerpo, area: 'general', fuente: FUENTE_WHATSAPP, autor: 'MaKo' });
          if (!nueva) throw new Error('no pude guardar lo aprendido en el conocimiento');
          knowledgeId = nueva.id;
          v.nuevas += 1;
        }
      }
      // La marca, AL FINAL: sólo con lo aprendido ya guardado.
      const { error } = await db.from(TABLA).upsert({
        fuente: FUENTE_WHATSAPP, ref: p.jid, etiqueta, knowledge_id: knowledgeId, mensajes: (fila?.mensajes ?? 0) + mensajes.length,
        hasta: ultimo, updated_at: new Date().toISOString(),
      }, { onConflict: 'workspace_id,fuente,ref' });
      if (error) throw new Error(`no pude anotar hasta dónde leyó: ${error.message}`);
      v.leidas += mensajes.length;
    }
  } catch (e) {
    v.resultado = 'error';
    v.motivo = msg(e).slice(0, 200);
    console.error(`[recolector] ws=${ws}: ${v.motivo}`);
  }
  if (!o.seco) await anotar(estado, v);
  return v;
}

// ── Lo que ve la pantalla (el Mapa del Second Brain) ─────────────────────────────────────────────────────────────────

/** El resumen del recolector del negocio en curso. null = no se pudo leer (no se afirma nada). */
export async function resumenDelRecolector(): Promise<ResumenRecolector | null> {
  try {
    const estado = leerEstadoRecolector(await getSetting(CLAVE_RECOLECTOR));
    const db = await getTenantDb();
    const libro = await db.from(TABLA).select('etiqueta, knowledge_id, updated_at').eq('fuente', FUENTE_WHATSAPP).order('updated_at', { ascending: false }).limit(500);
    if (libro.error) {
      if (faltaLaTabla(libro.error.message)) return { estado, conversaciones: 0, conEntrada: 0, sinIndice: 0, ultimas: [], sinTabla: true };
      throw new Error(libro.error.message);
    }
    const filas = (libro.data ?? []) as Array<{ etiqueta: string; knowledge_id: number | null; updated_at: string }>;
    const ultimas = filas.filter((f) => f.knowledge_id != null).slice(0, 6);
    const [sin, entradas] = await Promise.all([
      db.from('mako_knowledge').select('id', { count: 'exact', head: true }).eq('fuente', FUENTE_WHATSAPP).neq('estado', 'indexado'),
      ultimas.length ? db.from('mako_knowledge').select('id, cuerpo').in('id', ultimas.map((f) => f.knowledge_id!)) : Promise.resolve({ data: [], error: null }),
    ]);
    const cuerpoDe = new Map(((entradas.data ?? []) as Array<{ id: number; cuerpo: string }>).map((k) => [Number(k.id), k.cuerpo]));
    return {
      estado,
      conversaciones: filas.length,
      conEntrada: filas.filter((f) => f.knowledge_id != null).length,
      sinIndice: sin.error ? 0 : sin.count ?? 0,
      ultimas: ultimas.map((f) => ({ etiqueta: f.etiqueta || 'Un contacto', cuando: f.updated_at, hechos: hechosDeLaEntrada(cuerpoDe.get(Number(f.knowledge_id)) ?? '') })),
    };
  } catch (e) {
    console.error(`[recolector] no pude leer el resumen: ${msg(e)}`);
    return null;
  }
}

/** El interruptor del negocio en curso (lo escribe la pantalla, con su guarda). Conserva la última vuelta. */
export async function cambiarRecolector(prendido: boolean): Promise<void> {
  const estado = leerEstadoRecolector(await getSetting(CLAVE_RECOLECTOR));
  await setSetting(CLAVE_RECOLECTOR, JSON.stringify({ prendido, ultima: estado.ultima }));
}
