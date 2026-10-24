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
import { cambiarSettingSi, getSetting, getSettingEstricto, setSetting } from '@/lib/settings';
import { hoyEnWorkspace } from '@/lib/timezone';
import { fetchContactosEvolution, listarLineas } from '@/lib/evolution';
import { getNombresContacto } from '@/lib/evolution-contactos';
import { completarCamposVacios, completarNombreDeRelleno, createLead, logLeadEvent } from '@/lib/leads';
// LeadDuplicadoError vive en leads-duplicados: lib/leads la importa pero NO la reexporta (importada de ahí llegaba undefined y el
// `instanceof` tiraba TypeError con cada participante que ya era lead).
import { LeadDuplicadoError } from '@/lib/leads-duplicados';
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
  CAMPOS_DEL_PERFIL, TANDA_FICHAS, TOPE_GRUPOS_MS, TOPE_PARTICIPANTES_MS, TOPE_PERFILES_CORRIDA, conNombresConocidos,
  cuantosEstaCorrida, cupoDeHoy, esJidDeGrupo, esNombreDeRelleno, etapasQueDisparan, etiquetaDeGrupo, fichaLimpia,
  gruposDeChats, gruposDeFetchAll, lineaDeGrupos, lineaDePerfil, nombreDeFicha, parcheDePerfil, participantesDe,
  perfilDeEmpresa, quedanHoy, vistosConNuevos, vistosDe, type CampoDelPerfil, type FichaWa, type GrupoWA, type ParticipanteWA,
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
  const { participantes, sinNumero } = participantesDe(r, l.numero);
  return { ok: true, linea: l.linea, participantes: await nombresConocidos(l.linea, participantes), sinNumero };
}

/**
 * LOS NOMBRES QUE WHATSAPP YA CONOCE (el listado del grupo no trae ninguno: lib/grupo-wa-reglas.ts). Dos lecturas que NO le
 * suman tráfico a la red de la línea: la agenda de la línea en la base de Evolution (`fetchContactosEvolution`, UNA request)
 * y nuestra tabla de contactos (`getNombresContacto`). Si una falla, sin esos nombres: traer nunca se frena por esto.
 */
async function nombresConocidos(linea: string, participantes: ParticipanteWA[]): Promise<ParticipanteWA[]> {
  const [agenda, guardados] = await Promise.all([
    fetchContactosEvolution(linea).catch(() => []),
    getNombresContacto().catch(() => new Map<string, string>()),
  ]);
  return conNombresConocidos(participantes, agenda, guardados);
}

export type ResultadoCompletar = { ok: true; completados: number; yaTenian: number; sinNombre: number; fuera: number; quedan: number; errores: number }
  | { ok: false; error: string };

/**
 * «COMPLETAR NOMBRES» (24/10/2026, el Cerebro: «traer ahora no puede impedir completar los nombres después»). Los traídos
 * nacen con su número por nombre cuando WhatsApp no lo conoce, y volver a traer el grupo no los toca (nunca duplica). Esto
 * recorre los participantes del grupo que YA son leads y les pone el nombre que WhatsApp conozca HOY, sólo si el que tienen es
 * de relleno (`esNombreDeRelleno`). No crea a nadie, no mueve a nadie, no le manda nada a nadie. Se puede correr de nuevo:
 * quien escriba más adelante deja su nombre en la agenda de la línea, y la próxima pasada lo completa.
 * `soloContar`: cuántos se completarían, sin escribir (la propuesta de la API de MaKo).
 */
export async function completarNombresDelGrupo(p: { linea: string | null; jid: string; autor: string; hasta?: number; soloContar?: boolean }): Promise<ResultadoCompletar> {
  const leidos = await participantesDelGrupo(p.linea, p.jid);
  if (!leidos.ok) return leidos;
  const idx = await indiceContactos();
  const telIdx = { exactos: idx.tels, sufijos: idx.telsSufijo };
  // Sólo un lead por teléfono: con dos (`null`), no se adivina cuál es.
  const porLead = new Map<number, string | null>();
  let fuera = 0;
  for (const x of leidos.participantes) {
    const id = buscarTelefono(telIdx, x.telefono);
    if (typeof id === 'number') porLead.set(id, x.nombre); else fuera++;
  }
  const db = await getTenantDb();
  const ids = [...porLead.keys()];
  const actuales = new Map<number, string | null>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from('leads').select('id, nombre').in('id', ids.slice(i, i + 200));
    if (error) return { ok: false, error: `No pude leer los leads: ${error.message}` };
    for (const f of (data ?? []) as Array<{ id: number; nombre: string | null }>) actuales.set(Number(f.id), f.nombre ?? null);
  }
  let completados = 0, yaTenian = 0, sinNombre = 0, quedan = 0, errores = 0;
  for (const [id, nombre] of porLead) {
    if (!actuales.has(id)) { fuera++; continue; }
    const antes = actuales.get(id) ?? null;
    if (!esNombreDeRelleno(antes)) { yaTenian++; continue; }
    if (!nombre) { sinNombre++; continue; }
    if (p.soloContar) { completados++; continue; }
    if (p.hasta != null && Date.now() > p.hasta) { quedan++; continue; }
    try {
      if (await completarNombreDeRelleno(id, antes, nombre, p.autor)) completados++; else yaTenian++;
    } catch (e) {
      console.error('[grupo-wa] no pude completar un nombre:', msg(e));
      errores++;
    }
  }
  return { ok: true, completados, yaTenian, sinNombre, fuera, quedan, errores };
}

/** Entre una consulta de perfil y la siguiente: cada una es tráfico en la red de una línea no oficial (lib/fotos-contacto.ts). */
export const ESPERA_PERFIL_MS = 2_000;
/** El tope para el perfil de UN número (medido: ~0,6 s). */
const TOPE_PERFIL_MS = 15_000;

export type ResultadoPerfiles = {
  ok: true;
  /** Los participantes que ya son UN lead, y de ésos cuántos falta consultar (los ya consultados en esta línea no se repiten). */
  total: number; pendientes: number;
  /** Las consultas que quedan HOY en esta línea, y cuántas hace esta corrida: lo que se le dice a la persona ANTES de arrancar. */
  quedanHoy: number; estaCorrida: number;
  revisados: number; empresas: number; completados: number; campos: number; errores: number;
  /** Los que no contestaron en esta llamada: la pantalla los manda en `saltear` (si no, la llamada siguiente empieza por ellos). */
  sinRespuesta: string[];
  /** true = cortó por TIEMPO y a esta corrida le quedan: la pantalla vuelve a llamar sumando `hechas`. */
  sigue: boolean;
  /** Por qué no siguió con los que faltan: el tope del día o el de la corrida (se dice). null = terminó, o sigue. */
  corte: 'dia' | 'corrida' | null;
} | { ok: false; error: string };

const claveCupo = (linea: string) => `perfiles_wa.cupo.${linea}`;
const claveVistos = (linea: string) => `perfiles_wa.vistos.${linea}`;

/**
 * Reserva UNA consulta del cupo de hoy de esta línea ANTES de hacerla. Compare-and-set: dos corridas a la vez (dos pestañas,
 * dos personas del equipo) no se pasan del tope. false = no queda, o perdió la carrera cinco veces (mejor no consultar).
 */
async function reservarPerfil(linea: string, hoy: string): Promise<boolean> {
  for (let intento = 0; intento < 5; intento++) {
    const raw = await getSettingEstricto(claveCupo(linea));
    const c = cupoDeHoy(raw, hoy);
    if (quedanHoy(c) <= 0) return false;
    if (await cambiarSettingSi(claveCupo(linea), raw, JSON.stringify({ dia: hoy, usadas: c.usadas + 1 }))) return true;
  }
  return false;
}

/**
 * «DATOS DE EMPRESA» (24/10/2026, Martín: «muchos no sólo tienen nombre, sino que incluso links»). A los participantes del grupo
 * que YA son leads, lo que dice su perfil de empresa de WhatsApp (web, Instagram, correo, dirección), SÓLO en los campos vacíos
 * (`parcheDePerfil`); el rubro y la descripción van al historial. No crea, no mueve, no le manda nada a nadie: consultar un
 * perfil no le avisa a la persona. No trae el nombre: la respuesta no lo tiene (lib/grupo-wa-reglas.ts).
 * ⚠️ CADA CONSULTA ES TRÁFICO EN LA RED DE LA LÍNEA (el Cerebro, 24/10: «tope duro por corrida y por día; la cuenta real y el
 * tiempo antes de arrancar»):
 *   · de a UNO y despacio (`ESPERA_PERFIL_MS`);
 *   · a lo sumo `TOPE_PERFILES_CORRIDA` por corrida (la pantalla suma `hechas` entre llamadas) y `TOPE_PERFILES_DIA` por día y
 *     por línea, reservado ANTES de cada consulta (`reservarPerfil`): el del día lo hace cumplir el server, no la pantalla;
 *   · el que ya contestó no se vuelve a consultar (`perfiles_wa.vistos.<línea>`): la corrida de mañana sigue con los que faltan.
 *     El que no contestó es «no sé», no «no»: no queda como consultado (pero gastó cupo: fue tráfico igual).
 *   · `soloContar`: la cuenta de la pregunta (cuántos faltan, cuántos hace esta corrida, cuántos quedan hoy), sin consultar.
 */
export async function completarPerfilesDelGrupo(p: {
  linea: string | null; jid: string; autor: string; hechas?: number; saltear?: readonly string[]; hasta?: number; soloContar?: boolean;
}): Promise<ResultadoPerfiles> {
  const leidos = await participantesDelGrupo(p.linea, p.jid);
  if (!leidos.ok) return leidos;
  const idx = await indiceContactos();
  const telIdx = { exactos: idx.tels, sufijos: idx.telsSufijo };
  // Sólo los que ya son UN lead (con dos, no se adivina).
  const conLead = leidos.participantes.flatMap((x) => { const id = buscarTelefono(telIdx, x.telefono); return typeof id === 'number' ? [{ telefono: x.telefono, id }] : []; });
  const hoy = await hoyEnWorkspace();
  const [rawVistos, rawCupo] = await Promise.all([getSettingEstricto(claveVistos(leidos.linea)), getSettingEstricto(claveCupo(leidos.linea))]);
  const vistos = vistosDe(rawVistos);
  const faltan = conLead.filter((x) => !vistos.has(x.telefono.slice(-10)));
  const saltear = new Set((p.saltear ?? []).slice(0, TOPE_PERFILES_CORRIDA).map((t) => String(t).replace(/\D/g, '').slice(-10)));
  const ahora = faltan.filter((x) => !saltear.has(x.telefono.slice(-10)));
  const hechas = Math.max(0, Math.floor(Number(p.hechas) || 0));
  const quedan = quedanHoy(cupoDeHoy(rawCupo, hoy));
  const estaCorrida = cuantosEstaCorrida({ pendientes: ahora.length, quedanHoy: quedan, hechas });
  const cuenta = { total: conLead.length, pendientes: faltan.length, quedanHoy: quedan, estaCorrida };
  if (p.soloContar) return { ok: true, ...cuenta, revisados: 0, empresas: 0, completados: 0, campos: 0, errores: 0, sinRespuesta: [], sigue: false, corte: null };

  const db = await getTenantDb();
  let revisados = 0, empresas = 0, completados = 0, campos = 0, errores = 0;
  let sigue = false, corte: 'dia' | 'corrida' | null = null;
  const nuevos: string[] = [];
  const sinRespuesta: string[] = [];
  try {
    for (let i = 0; i < estaCorrida; i++) {
      if (p.hasta != null && Date.now() > p.hasta) { sigue = true; break; }
      if (i > 0) await new Promise((r) => setTimeout(r, ESPERA_PERFIL_MS));
      if (!(await reservarPerfil(leidos.linea, hoy))) { corte = 'dia'; break; }
      const { telefono, id } = ahora[i];
      revisados++;
      const r = await ev(`/chat/fetchBusinessProfile/${encodeURIComponent(leidos.linea)}`, TOPE_PERFIL_MS, { method: 'POST', body: JSON.stringify({ number: telefono }) });
      if (r == null) { sinRespuesta.push(telefono.slice(-10)); continue; }
      nuevos.push(telefono.slice(-10));
      const perfil = perfilDeEmpresa(r);
      if (!perfil) continue;
      empresas++;
      try {
        const { data, error } = await db.from('leads').select(`id, ${CAMPOS_DEL_PERFIL.join(', ')}`).eq('id', id).maybeSingle();
        if (error || !data) { errores++; continue; }
        const escritos = await completarCamposVacios(id, parcheDePerfil(data as Partial<Record<CampoDelPerfil, string | null>>, perfil), p.autor);
        if (escritos.length) {
          completados++;
          campos += escritos.length;
          // El rubro y la descripción, una vez: sólo cuando el perfil sumó algo (volver a correr no repite la línea).
          const linea = lineaDePerfil(perfil);
          if (linea) await logLeadEvent(id, 'Perfil de WhatsApp', linea, p.autor);
        }
      } catch (e) {
        console.error('[grupo-wa] no pude completar el perfil de un participante:', msg(e));
        errores++;
      }
    }
  } finally {
    // Se relee antes de escribir: otra corrida pudo sumar los suyos mientras tanto.
    if (nuevos.length) {
      await setSetting(claveVistos(leidos.linea), vistosConNuevos(await getSetting(claveVistos(leidos.linea)), nuevos))
        .catch((e) => console.error('[grupo-wa] no pude guardar los perfiles ya consultados:', msg(e)));
    }
  }
  // Terminó lo de esta llamada sin cortar por tiempo, y quedan: ¿por qué no siguió? Se dice.
  if (!sigue && !corte && revisados === estaCorrida && ahora.length > estaCorrida) {
    corte = hechas + revisados >= TOPE_PERFILES_CORRIDA ? 'corrida' : 'dia';
  }
  return { ok: true, ...cuenta, revisados, empresas, completados, campos, errores, sinRespuesta, sigue, corte };
}

export type ResultadoFichas = {
  ok: true; recibidas: number; deLeads: number; nombres: number; empresas: number; grupos: number; errores: number;
  /** Los teléfonos que no se llegaron a guardar porque se acabó el tiempo: la pantalla los vuelve a mandar. */
  pendientes: string[];
} | { ok: false; error: string };

/**
 * LAS FICHAS DE SU WHATSAPP WEB, por la extensión de MaKo (24/10/2026, extension/wa-fichas.js). La pantalla le pide a la
 * extensión lo que el WhatsApp Web de la persona ya guardó sobre los participantes del grupo que YA son leads, y manda acá lo
 * que volvió, de a tandas. Se escribe por los caminos de completar: el nombre sólo donde es de relleno, la empresa sólo si
 * está vacía, y sus grupos en común como una línea del historial (sólo si cambió). No crea, no mueve, no manda nada.
 * ⚠️ Las fichas vienen del NAVEGADOR: se limpian, y sólo cuentan las de un teléfono que es UN lead del CRM (las demás se
 * ignoran: nunca se trae a nadie ni se guarda la agenda de nadie).
 * ⚠️ NO RELEE EL GRUPO EN EVOLUTION, y es a propósito: la primera versión lo hacía en cada tanda para quedarse sólo con los
 * participantes, y eso era una consulta a la red de la línea por tanda (el Cerebro, 24/10: «nada de consultas a la red de su
 * línea»). El límite que importa es «sólo leads que ya existen», no la pertenencia al grupo: un admin ya puede editar cualquier
 * lead de su negocio, y los teléfonos los arma la pantalla con los participantes que ya leyó.
 * Corta por TIEMPO (`hasta`): lo que no entra vuelve en `pendientes` y la pantalla lo manda de nuevo (AGENTS.md, «lote de a
 * tandas»). Una acción del server tiene 60 s y cada ficha son varias escrituras.
 */
export async function completarFichasDelGrupo(p: { linea: string | null; jid: string; fichas: unknown[]; autor: string; hasta: number }): Promise<ResultadoFichas> {
  if (!esJidDeGrupo(p.jid)) return { ok: false, error: 'Ese grupo no existe.' };
  if (!(await lineaDelNegocio(p.linea))) return { ok: false, error: 'Esa línea no es de este negocio.' };
  const fichas = (Array.isArray(p.fichas) ? p.fichas : []).slice(0, TANDA_FICHAS).map(fichaLimpia).filter((f): f is FichaWa => !!f);
  const idx = await indiceContactos();
  const telIdx = { exactos: idx.tels, sufijos: idx.telsSufijo };
  const conLead = fichas.flatMap((f) => { const id = buscarTelefono(telIdx, f.telefono); return typeof id === 'number' ? [{ f, id }] : []; });
  const db = await getTenantDb();
  const actuales = new Map<number, { nombre: string | null }>();
  const ids = conLead.map((x) => x.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from('leads').select('id, nombre').in('id', ids.slice(i, i + 200));
    if (error) return { ok: false, error: `No pude leer los leads: ${error.message}` };
    for (const r of (data ?? []) as Array<{ id: number; nombre: string | null }>) actuales.set(Number(r.id), { nombre: r.nombre ?? null });
  }
  let nombres = 0, empresas = 0, grupos = 0, errores = 0;
  const pendientes: string[] = [];
  for (const { f, id } of conLead) {
    if (Date.now() > p.hasta) { pendientes.push(f.telefono); continue; }
    const lead = actuales.get(id);
    if (!lead) continue;
    try {
      const nombre = nombreDeFicha(f);
      if (nombre && esNombreDeRelleno(lead.nombre) && await completarNombreDeRelleno(id, lead.nombre, nombre, p.autor)) nombres++;
      if (f.empresa && (await completarCamposVacios(id, { empresa: f.empresa }, p.autor)).length) empresas++;
      const linea = lineaDeGrupos(f.grupos);
      if (linea) {
        // Una vez por cambio: si la última línea de grupos de este lead dice lo mismo, no se repite.
        const { data: ultima } = await db.from('lead_audit').select('valor_nuevo').eq('lead_id', id).eq('campo', 'Grupos de WhatsApp').order('created_at', { ascending: false }).limit(1);
        if ((ultima?.[0] as { valor_nuevo?: string } | undefined)?.valor_nuevo !== linea) { await logLeadEvent(id, 'Grupos de WhatsApp', linea, p.autor); grupos++; }
      }
    } catch (e) {
      console.error('[grupo-wa] no pude completar la ficha de un participante:', msg(e));
      errores++;
    }
  }
  return { ok: true, recibidas: fichas.length, deLeads: conLead.length, nombres, empresas, grupos, errores, pendientes };
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
