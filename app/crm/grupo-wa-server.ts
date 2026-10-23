// =============================================================================
// Traer los contactos de un grupo de WhatsApp al CRM — lo que habla con Evolution y con la base (23/10/2026)
// =============================================================================
// Martín, en la llamada del 23/10 (min 37:27): «una automatización que te agrega de un grupo de WhatsApp, te pone todos los
// números y los contactos en tu CRM de manera automática». Lo puro (leer lo que contesta Evolution, qué etapas mandan algo)
// vive en lib/grupo-wa-reglas.ts; lo usan las acciones del CRM (./grupo-wa-actions.ts) y la API de MaKo.
//
// ⚠️ NO LE MANDA NADA A NADIE: sólo LEE el grupo (`fetchAllGroups` sin participantes, `participants`, y `findChats` de la base de
//    Evolution) y crea o suma leads. Nunca a una etapa que mande sola (`etapasQueDisparan`), y la etiqueta de origen (la elige la persona) se pone en
//    lote, que no dispara (lib/etiquetas-motor.ts, `ponerLoteCon`).
// ⚠️ LOS NÚMEROS DE UN GRUPO SON DATOS PERSONALES: la línea tiene que ser una del negocio que pregunta (`listarLineas`, que
//    sólo lista las suyas: NUNCA la de MaKo), el funnel también (`listarFunnels`), todo se escribe con `getTenantDb` (su workspace) y los participantes
//    se vuelven a leer de Evolution al importar: lo que manda el navegador sólo ELIGE entre ellos.
// ⚠️ NUNCA DUPLICAR: el teléfono se busca en el índice de TODO el CRM (`indiceContactos`, como la importación de archivos). Si ya
//    es un lead, se lo SUMA a este funnel (`agregarAProducto`) en vez de crear otro; si lo comparten dos leads, se saltea.

import 'server-only';
import { getWorkspaceActual, getTenantDb } from '@/lib/workspace';
import { listarLineas } from '@/lib/evolution';
import { createLead, LeadDuplicadoError, logLeadEvent } from '@/lib/leads';
import { agregarAProducto, etapasDeProducto } from '@/lib/lead-funnel';
import { idDelFunnelDefault, listarFunnels } from '@/lib/funnels';
import { secuenciasDeEtiqueta } from '@/lib/nutricion-etapa';
import { getSecuenciasActivas } from '@/lib/nutricion';
import { vistasPorDisparador } from '@/lib/disparadores';
import { crearEtiqueta, listarEtiquetas, ponerEtiquetaLote } from '@/lib/etiquetas';
import { claveNombre } from '@/lib/etiquetas-reglas';
import { etapaDeEntrada } from '@/lib/lead-funnel-reglas';
import { terminalEstadoFor } from '@/lib/pipeline';
import {
  TOPE_GRUPOS_MS, TOPE_PARTICIPANTES_MS, esJidDeGrupo, etapasQueDisparan, etiquetaDeGrupo, gruposDeChats, gruposDeFetchAll,
  participantesDe, type GrupoWA, type ParticipanteWA,
} from '@/lib/grupo-wa-reglas';
import { ORIGEN_LEAD } from './origen-lead';
import { indiceContactos } from './importar-server';
import { buscarTelefono } from './leads-importar';

const BASE = (process.env.EVOLUTION_BASE_URL || '').replace(/\/$/, '');
const KEY = process.env.EVOLUTION_API_KEY || '';
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Un GET (o POST) a Evolution con tope. Nunca tira: `null` = no contestó o contestó un error. */
async function ev(ruta: string, topeMs: number, init?: RequestInit): Promise<unknown | null> {
  if (!BASE || !KEY) return null;
  try {
    const r = await fetch(`${BASE}${ruta}`, {
      ...init, headers: { apikey: KEY, 'Content-Type': 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(topeMs),
    });
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch { return null; }
}

/** Una línea de WhatsApp del negocio: su instancia, cómo se llama en pantalla y su número (para no traerla a ella misma). */
export type LineaGrupos = { linea: string; etiqueta: string; numero: string | null; conectada: boolean };

/** Las líneas del negocio que pregunta. La primera, la de por defecto. */
// ⚠️ SIN LA LÍNEA DE MAKO (la revisión de privacidad, 23/10/2026): en la plataforma, `lineasParaMandar` la pone primera, y esa
// línea está en el grupo de MaKo de CADA cliente: listarla dejaba traer a los dueños y equipos de los clientes al CRM de la
// plataforma. Sólo las líneas propias del negocio (`listarLineas`, por `getTenantDb`).
export async function lineasDelNegocio(): Promise<LineaGrupos[]> {
  const ws = await getWorkspaceActual();
  if (ws == null) return [];
  const lineas = await listarLineas();
  return lineas.map((l) => ({
    linea: l.instance_name, etiqueta: l.etiqueta || l.perfil_nombre || (l.numero ? `+${l.numero}` : l.instance_name),
    numero: l.numero ?? null, conectada: l.estado === 'conectado',
  }));
}

/** La línea pedida, SÓLO si es del negocio. null = no es suya (o no hay ninguna). */
async function lineaDelNegocio(linea: string | null | undefined): Promise<LineaGrupos | null> {
  const lineas = await lineasDelNegocio();
  if (!linea) return lineas[0] ?? null;
  return lineas.find((l) => l.linea === linea) ?? null;
}

/**
 * Los grupos de la línea. Primero preguntándole a WhatsApp (`fetchAllGroups` sin participantes, con tope: en una línea con muchos
 * grupos no terminaba); si no contesta, los de la base de Evolution (`findChats`), que son los grupos con los que habló.
 */
export async function gruposDeLinea(linea: string | null): Promise<{ ok: true; linea: string; grupos: GrupoWA[]; deLaBase: boolean } | { ok: false; error: string }> {
  const l = await lineaDelNegocio(linea);
  if (!l) return { ok: false, error: 'Conecta una línea de WhatsApp para traer los contactos de un grupo.' };
  const inst = encodeURIComponent(l.linea);
  const vivos = await ev(`/group/fetchAllGroups/${inst}?getParticipants=false`, TOPE_GRUPOS_MS);
  if (Array.isArray(vivos)) return { ok: true, linea: l.linea, grupos: gruposDeFetchAll(vivos), deLaBase: false };
  const guardados = await ev(`/chat/findChats/${inst}`, 10_000, { method: 'POST', body: '{}' });
  if (Array.isArray(guardados)) return { ok: true, linea: l.linea, grupos: gruposDeChats(guardados), deLaBase: true };
  return { ok: false, error: 'WhatsApp no contestó. Revisa que la línea esté conectada.' };
}

/** Los participantes de un grupo de la línea (los que se pueden traer) y cuántos no dejan ver su número. */
export async function participantesDelGrupo(linea: string | null, jid: string): Promise<{ ok: true; linea: string; participantes: ParticipanteWA[]; sinNumero: number } | { ok: false; error: string }> {
  if (!esJidDeGrupo(jid)) return { ok: false, error: 'Ese grupo no existe.' };
  const l = await lineaDelNegocio(linea);
  if (!l) return { ok: false, error: 'Esa línea no es de este negocio.' };
  const r = await ev(`/group/participants/${encodeURIComponent(l.linea)}?groupJid=${encodeURIComponent(jid)}`, TOPE_PARTICIPANTES_MS);
  if (r == null) return { ok: false, error: 'No pude leer el grupo. Revisa que la línea siga en él.' };
  return { ok: true, linea: l.linea, ...participantesDe(r, l.numero) };
}

/** Cuáles ya son un lead del CRM (de cualquier funnel): la pantalla lo marca, y al traerlos se SUMAN, no se crean de nuevo. */
export async function marcarEnElCrm(participantes: readonly ParticipanteWA[]): Promise<Array<ParticipanteWA & { enElCrm: boolean }>> {
  const idx = await indiceContactos();
  const telIdx = { exactos: idx.tels, sufijos: idx.telsSufijo };
  return participantes.map((x) => ({ ...x, enElCrm: buscarTelefono(telIdx, x.telefono) !== undefined }));
}

/** Las etapas del funnel y cuáles mandan algo solas (no se ofrecen). `entrada`: la primera que se puede usar. */
export async function etapasParaTraer(funnelId: number): Promise<{ etapas: Array<{ key: string; label: string; manda: boolean }>; entrada: string | null }> {
  // Un funnel que no es de este negocio no se usa (la revisión de privacidad: `etapasDeProducto` devolvía el de por defecto y
  // `createLead` caía al del negocio en silencio, con el chequeo de lo que manda hecho sobre OTRO funnel).
  if (!(await listarFunnels()).some((f) => f.id === funnelId)) throw new Error('Ese funnel no es de este negocio.');
  const [etapas, def, secuencias, etiquetas] = await Promise.all([
    etapasDeProducto(funnelId), idDelFunnelDefault(), getSecuenciasActivas(), listarEtiquetas(),
  ]);
  const db = await getTenantDb();
  const { data } = await db.from('funnels').select('id, es_default');
  const defaults = new Map(((data ?? []) as Array<{ id: number; es_default: boolean | null }>).map((f) => [Number(f.id), f.es_default === true]));
  const manda = etapasQueDisparan(
    secuencias.flatMap((s) => vistasPorDisparador(s)), etiquetas,
    { id: funnelId, esDefault: def != null && funnelId === def }, (id) => defaults.get(id) ?? null,
  );
  // ⚠️ Y LAS TERMINALES TAMPOCO (la revisión de privacidad, 23/10/2026): con «Ganado» el grupo entero quedaba como venta y como
  // cliente de Customer Success, y el barrido de la entrega les mandaba el onboarding. Perdido, Descalificado y No responde
  // escriben su estado (y pueden pedir un motivo). Para la pantalla y el servidor, «manda» es «no se puede usar al traer».
  const lista = etapas.map((e) => ({ key: e.key, label: e.label, manda: manda.has(e.key) || terminalEstadoFor(e.key) !== 'abierto' }));
  const primera = etapaDeEntrada(etapas);
  const entrada = lista.find((e) => e.key === primera && !e.manda)?.key ?? lista.find((e) => !e.manda)?.key ?? null;
  return { etapas: lista, entrada };
}

/**
 * `quedan`: los que no se llegaron a traer porque se acabó el tiempo (`hasta`): pedirlo de nuevo sigue (los traídos ya están).
 * `pendientes`: sus teléfonos, para que la pantalla los vuelva a pedir (son de los que ELLA mandó: no suma ningún dato).
 */
export type ResultadoTraer = { ok: true; creados: number; sumados: number; yaEstaban: number; salteados: number; quedan: number; pendientes: string[]; etiqueta: string | null; errores: string[] }
  | { ok: false; error: string };

/**
 * Trae al funnel `funnelId`, en la etapa `etapa`, a los participantes del grupo cuyos teléfonos pide `telefonos` (o a todos).
 * De a tandas (lo llama la pantalla, o la API de MaKo): cada lead son varias lecturas y escrituras.
 */
export async function traerDelGrupo(p: {
  linea: string | null; jid: string; nombreGrupo: string; funnelId: number; etapa: string; telefonos: readonly string[] | 'todos'; autor: string;
  /** La etiqueta de origen que eligió la persona; sin esto, el nombre del grupo. */
  etiqueta?: string | null;
  /** Hasta cuándo (ms epoch): pasado, corta y cuenta los que quedan (la API de MaKo, que no se puede partir en tandas). */
  hasta?: number;
}): Promise<ResultadoTraer> {
  const leidos = await participantesDelGrupo(p.linea, p.jid);
  if (!leidos.ok) return leidos;
  const pedidos = new Set(p.telefonos === 'todos' ? [] : p.telefonos.map((t) => t.replace(/\D/g, '')));
  const quienes = p.telefonos === 'todos' ? leidos.participantes : leidos.participantes.filter((x) => pedidos.has(x.telefono));
  if (!quienes.length) return { ok: true, creados: 0, sumados: 0, yaEstaban: 0, salteados: 0, quedan: 0, pendientes: [], etiqueta: null, errores: [] };
  // La etiqueta se mira ANTES de traer a nadie: una que ya tiene una automatización no se usa (ver `etiquetaDeOrigen`).
  const origen = await etiquetaDeOrigen(p.etiqueta?.trim() || p.nombreGrupo);
  if (!origen.ok) return origen;

  const { etapas } = await etapasParaTraer(p.funnelId);
  const destino = etapas.find((e) => e.key === p.etapa);
  if (!destino) return { ok: false, error: 'Esa etapa no existe en este funnel.' };
  if (destino.manda) return { ok: false, error: `«${destino.label}» no se puede usar al traer (tiene una automatización o cierra el trato): elige otra etapa.` };

  const idx = await indiceContactos();
  const telIdx = { exactos: idx.tels, sufijos: idx.telsSufijo };
  const traidos: number[] = [];
  const errores: string[] = [];
  let creados = 0, sumados = 0, yaEstaban = 0, salteados = 0;
  let pendientes: string[] = [];
  for (const [i, x] of quienes.entries()) {
    if (p.hasta != null && Date.now() > p.hasta) { pendientes = quienes.slice(i).map((q) => q.telefono); break; }
    const existente = buscarTelefono(telIdx, x.telefono);
    if (existente === null) { salteados++; continue; }
    try {
      if (existente !== undefined) {
        const r = await agregarAProducto(existente, p.funnelId, { autor: p.autor, etapa: p.etapa });
        if (r.agregado) sumados++; else yaEstaban++;
        // El que ya estaba también se etiqueta: con dos grupos seguidos, quien está en los dos queda con las DOS etiquetas
        // (el Cerebro, 23/10/2026: «Si un teléfono está en dos grupos, se le suman las dos etiquetas»).
        traidos.push(existente);
        continue;
      }
      // ⚠️ NACE EN LA ETAPA ELEGIDA, nunca en la de entrada y movido después (la revisión de privacidad, 23/10/2026): entre el
      // alta y el movimiento, el barrido de la hora lo inscribía en «Un Lead Entró», y si el movimiento fallaba quedaba ahí.
      // La etapa ya se verificó: no manda nada (`destino.manda`) y no es terminal (`etapasParaTraer`).
      const lead = await createLead({
        nombre: x.nombre ?? `+${x.telefono}`, telefono: x.telefono, funnel_id: p.funnelId, origen_lead: ORIGEN_LEAD.grupo_whatsapp.id,
        pipeline_stage: p.etapa,
      });
      creados++;
      traidos.push(lead.id);
      await logLeadEvent(lead.id, 'Traído de un grupo de WhatsApp', `«${p.nombreGrupo}», a «${destino.label}»`, p.autor).catch(() => {});
    } catch (e) {
      if (e instanceof LeadDuplicadoError) { yaEstaban++; continue; }
      // A la pantalla, el NOMBRE del que no se pudo y un texto llano; el detalle de la base, sólo al log (sin datos de la persona).
      console.error('[grupo-wa] no pude traer a un participante:', msg(e));
      errores.push(x.nombre ?? `+${x.telefono}`);
    }
  }
  const etiqueta = traidos.length ? await etiquetarDelGrupo(traidos, origen, p.autor).catch((e) => { errores.push(`La etiqueta: ${msg(e)}`); return null; }) : null;
  return { ok: true, creados, sumados, yaEstaban, salteados, quedan: pendientes.length, pendientes: p.telefonos === 'todos' ? [] : pendientes, etiqueta, errores };
}

/**
 * La etiqueta de origen: la que ya existe con ese nombre, o una nueva (sin vínculo a ninguna etapa).
 * ⚠️ UNA QUE YA TIENE UNA AUTOMATIZACIÓN («Etiqueta puesta») NO SE USA (la revisión de privacidad, 23/10/2026): el lote no
 *    dispara, pero el BARRIDO de la hora (`leadsConEtiqueta`, lib/nutricion.ts) inscribe a todo lead que la tenga, y el grupo
 *    entero recibía esa secuencia al rato. Se rechaza antes de traer a nadie. Una nueva no tiene ninguna.
 */
export async function etiquetaDeOrigen(elegida: string): Promise<{ ok: true; nombre: string; id: number | null } | { ok: false; error: string }> {
  const nombre = etiquetaDeGrupo(elegida);
  const todas = await listarEtiquetas({ incluirArchivadas: true });
  const e = todas.find((t) => claveNombre(t.nombre) === claveNombre(nombre)) ?? null;
  if (!e) return { ok: true, nombre, id: null };
  if (e.archivada_at) return { ok: false, error: `«${e.nombre}» está archivada: elige otra etiqueta.` };
  const vistas = (await getSecuenciasActivas()).flatMap((s) => vistasPorDisparador(s));
  if (secuenciasDeEtiqueta(vistas, e.id).length) return { ok: false, error: `«${e.nombre}» tiene una automatización activa: elige otra etiqueta.` };
  return { ok: true, nombre: e.nombre, id: e.id };
}

/** Pone la etiqueta de origen a los traídos (la crea si es nueva) en LOTE, que no dispara. */
async function etiquetarDelGrupo(ids: number[], origen: { nombre: string; id: number | null }, autor: string): Promise<string> {
  const id = origen.id ?? (await crearEtiqueta({ nombre: origen.nombre })).etiqueta.id;
  const r = await ponerEtiquetaLote(ids, id, { autor });
  if (!r.ok) throw new Error(r.error);
  return origen.nombre;
}
