// =============================================================================
// chats — los DATOS de la tab Chats: la lista unificada, el hilo de un contacto y su estado
// =============================================================================
// Pedido de Martín (14/10/2026), literal: «Implementar la tab "Chats" algo como "https://respond.io" para
// tener en UNA sola tab centralizado absolutamente todos los chats, WhatsApp, Instagram, Messenger, etc...».
// El plano (contratos, decisiones) es docs/diseno-chats.md; lo puro (claves, contactos, estado efectivo,
// filtros, contadores) vive en lib/chats-reglas.ts; los tipos en lib/chats-tipos.ts.
//
// Lo usan las rutas de app/api/chats/** y la API de MaKo. NO lee nada nuevo pesado: es el mismo costo que la
// bandeja de /whatsapp (que la pantalla sondea cada 15 s), más tres lecturas chicas (estado, leídos,
// borradores) y la de Instagram/Messenger.
//
// ⚠️ LAS TRES REGLAS QUE ESTE ARCHIVO NO PUEDE ROMPER:
//   1. WHATSAPP SE LEE POR LÍNEA, NUNCA SIN LÍNEA: `getConversacionesNoOficial` no devuelve la línea, y pedida
//      sin `linea` funde los hilos de dos números en uno (agrupa por los últimos 10 dígitos). Acá se pide UNA
//      VEZ POR LÍNEA y la etiqueta la pone este archivo. Si la lista de líneas no se pudo leer, WhatsApp queda
//      afuera con su falla — no se lee «sin línea» de respaldo.
//   2. «NO PUDE LEER» ES UN TERCER ESTADO: cada fuente que falla va a `fallas` ('whatsapp:<linea>', 'instagram',
//      'estado'…) y la pantalla lo dice, en vez de dibujar «no hay chats».
//   3. INSTAGRAM Y MESSENGER SÓLO POR lib/canal-zernio.ts (tests/sin-instagram.test.ts): este archivo no nombra
//      sus tablas ni importa el cliente de Zernio.
// =============================================================================

import 'server-only';
import { getTenantDb, getWorkspaceActual, getRolWsEfectivo, getCapaActual } from './workspace';
import { getUsuarioActual } from './auth';
import { tabEnCapa } from './capas';
import { getSupabaseServer } from './supabase';
import { buscarUsuarioPorEmail } from './usuarios';
import { getLead } from './leads';
import { etiquetasDeLead, type EtiquetaDelLead } from './etiquetas';
import { listarLineas, type LineaRow } from './evolution';
import { getConversacionesNoOficial, getMensajesDeChat, type WaConversacion, type WaMensaje } from './evolution-mensajes';
import { telefonosBloqueados } from './evolution-block';
import { instanceNameDeWs, lineaPorDefault, rotuloLinea } from './lineas-whatsapp';
import { getFunnelDefault } from './funnels';
import { etapaVigenteDe } from './funnel-etapas';
import type { Stage, StageDerivable } from './pipeline';
import { leerTodo } from './supabase-paginado';
import { enTandas } from './ids-con-filas';
import { tzActual } from './timezone';
import {
  listarConversacionesSociales, conversacionesSocialesDe, buscarConversacionesSociales, mensajesSociales,
  type ConversacionSocialChat,
} from './canal-zernio';
import {
  agruparPorContacto, claveLead, claveSocial, claveWhatsapp, claveCuenta, parsearClave, formatoDe, statusDe,
  destinoTelefono, rotuloWhatsapp, ultimos10, partesDeEvento, partesDeAudit, textoDePartes, autorLegible,
  CAMPOS_AUDIT_DEL_HILO,
  type FuenteChat, type LeadDelChat, type FilaEstadoChat, type ContextoContactos, type TipoEventoChat,
} from './chats-reglas';
import type {
  BorradorChat, CanalChat, ChatResumen, CuentaSocial, EtapaChat, IdentidadCanal, LineaChat, MensajeChat,
} from './chats-tipos';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Quién mira: el id de `usuarios` (0 = una sesión sin fila: dev, legacy) y su NOMBRE (el que guarda el CRM). */
export type YoChats = { id: number; nombre: string };

// ── La puerta de las rutas ──────────────────────────────────────────────────────

export type PuertaChats =
  | { ok: true; yo: YoChats; ws: number }
  | { ok: false; status: 401 | 403 | 404; error: string };

/**
 * La puerta de app/api/chats/** (molde app/api/calendario/ia/route.ts): sesión, la tab en la capa del
 * negocio y un workspace concreto. Sin rol mínimo: Chats es de closer y setter además del admin
 * (`rolesWs` del nav), como /whatsapp. ⚠️ Esconder la tab no protege: cada ruta pasa por acá.
 *
 * El NOMBRE de quien mira sale de la fila de `usuarios` (no del token firmado, que puede ser viejo): es el que
 * el CRM escribe en `leads.setter` / `leads.closer` (`getEquipoAction`: el nombre, o el email si no tiene), y
 * con el que «Míos» compara.
 */
export async function puertaChats(): Promise<PuertaChats> {
  const [sesion, rol] = await Promise.all([getUsuarioActual(), getRolWsEfectivo()]);
  if (!sesion || rol == null) return { ok: false, status: 401, error: 'Inicia sesión.' };
  if (!tabEnCapa('chats', await getCapaActual())) return { ok: false, status: 404, error: 'No existe' };
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, status: 403, error: 'Elige una cuenta primero.' };
  const id = /^\d+$/.test(sesion.sub) ? Number(sesion.sub) : 0;
  let nombre = sesion.nombre?.trim() || sesion.email || 'Equipo';
  if (id > 0 && sesion.email) {
    try {
      const u = await buscarUsuarioPorEmail(sesion.email);
      if (u) nombre = u.nombre?.trim() || u.email;
    } catch { /* sin la fila, el nombre del token: «Míos» puede quedar corto, nada más */ }
  }
  return { ok: true, yo: { id, nombre }, ws };
}

// ── Lecturas chicas (cada una con su falla) ─────────────────────────────────────

type FilaLeadChat = StageDerivable & {
  id: number; nombre: string | null; empresa: string | null; telefono_normalizado: string | null;
  setter: string | null; closer: string | null;
};
const COLS_LEAD_CHAT = 'id, nombre, empresa, telefono_normalizado, setter, closer, estado_lead, pipeline_stage, fecha_agenda, fecha_junta_1, fecha_junta_2, asistio_j1, asistio_j2, nutricion_realizada';

/** La etapa del CRM de un lead (la que pinta el tablero) y su nombre en el embudo del negocio. */
function etapaDe(l: FilaLeadChat, stages: readonly Stage[], labels: Readonly<Record<string, string>>): { key: string; label: string } {
  const key = etapaVigenteDe(l, stages);
  return { key, label: stages.find((s) => s.key === key)?.label ?? labels[key] ?? key };
}

function leadDelChat(l: FilaLeadChat, stages: readonly Stage[], labels: Readonly<Record<string, string>>): LeadDelChat {
  const e = etapaDe(l, stages, labels);
  return {
    id: Number(l.id), nombre: l.nombre ?? null, empresa: l.empresa ?? null, telefono: l.telefono_normalizado ?? null,
    setter: l.setter ?? null, closer: l.closer ?? null, etapaKey: e.key, etapaLabel: e.label,
  };
}

/** Los leads de esos ids, de a 200. Tira si no pudo leer. */
async function leerLeads(ids: readonly number[]): Promise<FilaLeadChat[]> {
  const unicos = [...new Set(ids.filter((n) => Number.isSafeInteger(n) && n > 0))];
  if (!unicos.length) return [];
  const db = await getTenantDb();
  const out: FilaLeadChat[] = [];
  for (const tanda of enTandas(unicos, 200)) {
    const { data, error } = await db.from('leads').select(COLS_LEAD_CHAT).in('id', tanda);
    if (error) throw new Error(`leads: ${error.message}`);
    out.push(...((data ?? []) as unknown as FilaLeadChat[]));
  }
  return out;
}

/** `chat_estado` del negocio (todas, o las de esas claves). Tira si no pudo leer. */
async function leerEstados(claves?: readonly string[]): Promise<Map<string, FilaEstadoChat>> {
  const db = await getTenantDb();
  type Fila = FilaEstadoChat & { clave: string };
  const cols = 'clave, estado, cerrada_at, pospuesta_hasta, pospuesta_at';
  let filas: Fila[];
  if (claves) {
    if (!claves.length) return new Map();
    const { data, error } = await db.from('chat_estado').select(cols).in('clave', [...claves].slice(0, 500));
    if (error) throw new Error(`chat_estado: ${error.message}`);
    filas = (data ?? []) as Fila[];
  } else {
    filas = await leerTodo<Fila>(db, 'chat_estado', cols, { orden: 'clave' });
  }
  return new Map(filas.map((f) => [f.clave, f]));
}

/** Las marcas de leído de ESTA persona (todas, o las de esas claves). Tira si no pudo leer. */
async function leerLeidos(usuarioId: number, claves?: readonly string[]): Promise<Map<string, string>> {
  if (!(usuarioId > 0)) return new Map();
  const db = await getTenantDb();
  type Fila = { clave: string; leido_at: string };
  let filas: Fila[];
  if (claves) {
    if (!claves.length) return new Map();
    const { data, error } = await db.from('chat_leidos').select('clave, leido_at').eq('usuario_id', usuarioId).in('clave', [...claves].slice(0, 500));
    if (error) throw new Error(`chat_leidos: ${error.message}`);
    filas = (data ?? []) as Fila[];
  } else {
    filas = await leerTodo<Fila>(db, 'chat_leidos', 'clave, leido_at', { orden: 'clave', eq: { usuario_id: usuarioId } });
  }
  return new Map(filas.map((f) => [f.clave, f.leido_at]));
}

type FilaBorrador = { id: number; lead_id: number | null; telefono: string | null; texto: string | null; origen: string | null; created_at: string; instance_name: string | null };

/**
 * Los borradores de MaKo PENDIENTES (todos los del negocio, o los de un contacto). Una lectura propia y no
 * `listBorradores` (lib/evolution-envio.ts) porque ésa se traga el error y devuelve `[]`: acá «no pude leer»
 * tiene que llegar como falla, no como «no hay borradores».
 */
async function leerBorradores(de?: { leadId: number | null; tel10: string | null }): Promise<FilaBorrador[]> {
  const db = await getTenantDb();
  let q = db.from('wa_borradores').select('id, lead_id, telefono, texto, origen, created_at, instance_name').eq('estado', 'pendiente');
  if (de) {
    const conds = [
      ...(de.leadId != null ? [`lead_id.eq.${de.leadId}`] : []),
      ...(de.tel10 && de.tel10.length >= 8 ? [`telefono.like.%${de.tel10}%`] : []),
    ];
    if (!conds.length) return [];
    q = q.or(conds.join(','));
  }
  // Los MÁS NUEVOS, y recién después del más viejo al más nuevo: «ascendente + límite» se queda con lo más viejo
  // y escondería el borrador de la conversación que acaba de moverse (tests/lecturas-sin-corte.test.ts).
  const { data, error } = await q.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(500);
  if (error) throw new Error(`wa_borradores: ${error.message}`);
  return ((data ?? []) as FilaBorrador[]).reverse();
}

const borradoresIndice = (filas: readonly FilaBorrador[]) => ({
  leadIds: new Set(filas.map((b) => b.lead_id).filter((x): x is number => x != null).map(Number)),
  tels: new Set(filas.map((b) => ultimos10(b.telefono)).filter((t) => t.length >= 8)),
});

// ── Las fuentes ─────────────────────────────────────────────────────────────────

/** Una línea de WhatsApp como la lee la bandeja: su nombre interno y cómo se rotula. */
type LineaLeida = { linea: string; rotulo: string };

/** Una conversación de WhatsApp de UNA línea → la fuente del contacto. */
function fuenteWhatsapp(c: WaConversacion, l: LineaLeida, variasLineas: boolean): FuenteChat {
  const tel = (c.telefono ?? '').replace(/\D/g, '') || null;
  const grupo = c.chatJid.endsWith('@g.us');
  // ⚠️ UN GRUPO NO SE ESCRIBE DESDE CHATS: el envío manual saca «el número» del jid, y el de un grupo no es
  // un teléfono (trampa 16 del relevamiento de la bandeja vieja). Se lee, no se contesta.
  const puede = !c.bloqueado && !grupo;
  const identidad: IdentidadCanal = {
    canal: 'whatsapp',
    cuenta: l.linea,
    rotulo: rotuloWhatsapp(l.rotulo, variasLineas),
    destino: grupo ? 'Grupo' : destinoTelefono(tel),
    ref: c.chatJid,
    telefono: tel,
    ultimaFecha: c.ultimaFecha,
    puedeEscribir: puede,
    motivoNoEscribir: c.bloqueado ? 'Bloqueado' : grupo ? 'Grupo' : null,
    bloqueado: c.bloqueado,
  };
  return {
    identidad,
    leadId: c.leadId ?? null,
    claveSinLead: claveWhatsapp(l.linea, c.telefono, c.chatJid),
    nombre: c.nombre,
    empresa: c.empresa,
    ultimoTexto: c.ultimoTexto,
    ultimoTipo: c.ultimoTipo == null && c.ultimoTexto == null ? null : formatoDe(c.ultimoTipo),
    ultimaFecha: c.ultimaFecha,
    ultimoEntrante: c.ultimoEntrante,
    // La lista sólo sabe la fecha del ÚLTIMO mensaje: si fue nuestro, la del último del contacto no se conoce
    // (null). Es la misma aproximación que el «sin leer» de /whatsapp; alcanza porque contestar es haber leído.
    ultimaEntrante: c.ultimoEntrante ? c.ultimaFecha : null,
    total: c.total,
  };
}

/** Cómo se llama cada cuenta social en el selector: 'Instagram', o 'Instagram 2' si el negocio tiene varias. */
function rotulosSociales(convs: readonly ConversacionSocialChat[]): { cuentas: CuentaSocial[]; rotulo: (canal: CanalChat, cuenta: string | null) => string } {
  const porCanal = new Map<'instagram' | 'messenger', string[]>();
  for (const c of convs) {
    if (!c.cuenta) continue;
    const l = porCanal.get(c.canal) ?? [];
    if (!l.includes(c.cuenta)) l.push(c.cuenta);
    porCanal.set(c.canal, l);
  }
  const nombre = (canal: 'instagram' | 'messenger') => (canal === 'instagram' ? 'Instagram' : 'Messenger');
  const rot = new Map<string, string>();
  const cuentas: CuentaSocial[] = [];
  for (const [canal, lista] of porCanal) {
    [...lista].sort().forEach((cuenta, i) => {
      const r = lista.length > 1 ? `${nombre(canal)} ${i + 1}` : nombre(canal);
      rot.set(claveCuenta(canal, cuenta), r);
      cuentas.push({ canal, cuenta, rotulo: r });
    });
  }
  return {
    cuentas,
    rotulo: (canal, cuenta) => rot.get(claveCuenta(canal, cuenta)) ?? (canal === 'messenger' ? 'Messenger' : canal === 'instagram' ? 'Instagram' : 'WhatsApp'),
  };
}

/** Una persona de Instagram/Messenger → la fuente del contacto. */
function fuenteSocial(s: ConversacionSocialChat, rotulo: string): FuenteChat {
  return {
    identidad: {
      canal: s.canal, cuenta: s.cuenta, rotulo, destino: s.destino, ref: String(s.id), telefono: null,
      ultimaFecha: s.ultimaFecha, puedeEscribir: s.puedeEscribir, motivoNoEscribir: s.motivoNoEscribir, bloqueado: false,
    },
    leadId: s.leadId,
    claveSinLead: claveSocial(s.canal, s.id),
    nombre: s.nombre,
    empresa: null,
    ultimoTexto: s.ultimoTexto,
    ultimoTipo: s.ultimoTipo,
    ultimaFecha: s.ultimaFecha,
    ultimoEntrante: s.ultimoEntrante,
    ultimaEntrante: s.ultimaEntrante,
    total: s.total,
  };
}

/** Las líneas del negocio, para leer y para rotular. null = no se pudieron leer (y WhatsApp queda afuera). */
async function lineasDelNegocio(ws: number): Promise<{ filas: LineaRow[]; leidas: LineaLeida[]; lineas: LineaChat[]; porDefault: string } | null> {
  let filas: LineaRow[];
  try { filas = await listarLineas(); } catch (e) {
    console.error(`[chats] líneas de WhatsApp: ${msg(e)}`);
    return null;
  }
  const leidas = filas.map((l, i) => ({ linea: l.instance_name, rotulo: rotuloLinea(l, i) }));
  return {
    filas,
    leidas,
    lineas: filas.map((l, i) => ({ linea: l.instance_name, rotulo: leidas[i].rotulo, estado: String(l.estado ?? ''), esDefault: l.es_default === true })),
    // Sin ninguna fila, la única línea posible es la de siempre (`elegirLinea` hace lo mismo).
    porDefault: lineaPorDefault(filas)?.instance_name ?? instanceNameDeWs(ws),
  };
}

/** Las etapas del embudo del negocio (las del tablero del CRM), con su color. */
async function etapasDelNegocio(): Promise<{ stages: Stage[]; labels: Record<string, string>; etapas: EtapaChat[]; falla: boolean }> {
  const f = await getFunnelDefault();
  return {
    stages: f.stages,
    labels: f.labels ?? {},
    etapas: f.stages.map((s) => ({ key: s.key, label: s.label, color: s.dot })),
    // Leído en ERROR, getFunnelDefault devuelve la plantilla: las etapas existen, pero no son las del negocio.
    falla: f.origen === 'error',
  };
}

// ── La lista ────────────────────────────────────────────────────────────────────

export type ListaChats = {
  chats: ChatResumen[];
  lineas: LineaChat[];
  cuentasSociales: CuentaSocial[];
  etapas: EtapaChat[];
  /** Las fuentes que NO se pudieron leer: 'whatsapp', 'whatsapp:<linea>', 'instagram', 'messenger', 'crm', 'etapas', 'estado', 'leidos', 'borradores'. */
  fallas: string[];
};

/**
 * LA LISTA DE CHATS: todas las conversaciones del negocio, una por contacto, con su estado, sus no leídos (los
 * de `usuario`) y su borrador. Con `buscar` (≥ 2 caracteres) devuelve en cambio lo que matchea en el servidor
 * — leads del CRM y personas de Instagram/Messenger, aunque no tengan mensajes — para que la pantalla lo sume
 * a lo que ya filtró en memoria (ver `buscarChats`).
 */
export async function listarChats(opts?: { buscar?: string; usuario?: YoChats }): Promise<ListaChats> {
  const ws = await getWorkspaceActual();
  if (ws == null) return { chats: [], lineas: [], cuentasSociales: [], etapas: [], fallas: ['workspace'] };
  const yo = opts?.usuario ?? { id: 0, nombre: '' };
  if (opts?.buscar != null) return buscarChats(opts.buscar, ws, yo);
  const fallas: string[] = [];
  const falla = (fuente: string) => (e: unknown) => { console.error(`[chats] ${fuente}: ${msg(e)}`); fallas.push(fuente); return null; };

  // Las líneas primero: sin ellas no se sabe cómo leer WhatsApp. Lo demás corre a la par.
  const [lns, embudo, social, estados, leidos, borradores] = await Promise.all([
    lineasDelNegocio(ws),
    etapasDelNegocio(),
    listarConversacionesSociales().catch(falla('instagram')),
    leerEstados().catch(falla('estado')),
    leerLeidos(yo.id).catch(falla('leidos')),
    leerBorradores().catch(falla('borradores')),
  ]);
  if (social == null && fallas.includes('instagram')) fallas.push('messenger');
  if (embudo.falla) fallas.push('etapas');

  // WhatsApp: UNA lectura por línea, etiquetada acá (regla 1 de la cabecera).
  const fuentes: FuenteChat[] = [];
  let lineas: LineaChat[] = [];
  if (!lns) {
    fallas.push('whatsapp');
  } else {
    lineas = lns.lineas;
    const aLeer: LineaLeida[] = lns.leidas.length ? lns.leidas : [{ linea: instanceNameDeWs(ws), rotulo: 'WhatsApp' }];
    const varias = aLeer.length > 1;
    const porLinea = await Promise.all(aLeer.map((l) =>
      // Sin ninguna fila de línea, el espejo es de una sola (la de siempre): se lee sin filtro, que es lo mismo.
      getConversacionesNoOficial(600, false, lns.leidas.length ? l.linea : null)
        .then((convs) => ({ l, convs }))
        .catch((e) => { console.error(`[chats] whatsapp ${l.linea}: ${msg(e)}`); fallas.push(`whatsapp:${l.linea}`); return { l, convs: [] as WaConversacion[] }; })));
    for (const { l, convs } of porLinea) for (const c of convs) fuentes.push(fuenteWhatsapp(c, l, varias));
    // La línea de siempre sin fila: se nombra en `lineas` sólo si trajo conversaciones (es la que les contesta).
    if (!lns.leidas.length && fuentes.length) lineas = [{ linea: instanceNameDeWs(ws), rotulo: 'WhatsApp', estado: 'desconectado', esDefault: true }];
  }

  const rs = rotulosSociales(social ?? []);
  for (const s of social ?? []) fuentes.push(fuenteSocial(s, rs.rotulo(s.canal, s.cuenta)));

  // Los leads de todas las fuentes, en una lectura (el nombre, el asignado, el closer y la etapa del CRM).
  const leadIds = fuentes.map((f) => f.leadId).filter((x): x is number => x != null);
  const filasLead = await leerLeads(leadIds).catch(falla('crm'));
  const leads = new Map((filasLead ?? []).map((l) => [Number(l.id), leadDelChat(l, embudo.stages, embudo.labels)]));

  const ctx: ContextoContactos = {
    leads,
    estados: estados ?? new Map(),
    leidos: leidos ?? new Map(),
    borradores: borradoresIndice(borradores ?? []),
    lineaDefault: lns?.porDefault ?? instanceNameDeWs(ws),
    ahoraMs: Date.now(),
  };
  return { chats: agruparPorContacto(fuentes, ctx), lineas, cuentasSociales: rs.cuentas, etapas: embudo.etapas, fallas: [...new Set(fallas)] };
}

/**
 * EL BUSCADOR del servidor: leads del CRM (nombre, empresa, teléfono o usuario de Instagram) y personas de
 * Instagram/Messenger (@usuario), aunque no tengan mensajes. Un lead con teléfono trae su WhatsApp por la línea
 * por default (para escribirle por primera vez, como el buscador de /whatsapp); uno sin teléfono ni Instagram no
 * vuelve (no hay por dónde escribirle). La pantalla filtra la lista que ya tiene y SUMA lo que esto trae y
 * no estaba (por `clave`).
 *
 * Una lectura propia de leads, y no `buscarLeadsComoPlaceholders` (lib/evolution-mensajes.ts), porque ésa se
 * traga el error (devolvería «no hay» con la base caída) y no trae lo que el contacto necesita del CRM.
 */
async function buscarChats(q: string, ws: number, yo: YoChats): Promise<ListaChats> {
  const term = String(q ?? '').trim().slice(0, 80);
  const fallas: string[] = [];
  if (term.length < 2) return { chats: [], lineas: [], cuentasSociales: [], etapas: [], fallas };
  const falla = (fuente: string) => (e: unknown) => { console.error(`[chats] buscar ${fuente}: ${msg(e)}`); fallas.push(fuente); return null; };
  const [lns, embudo] = await Promise.all([lineasDelNegocio(ws), etapasDelNegocio()]);
  if (!lns) fallas.push('whatsapp');

  // Los leads que matchean (sanitizado para el `.or` de PostgREST, igual que el buscador de /whatsapp).
  const limpio = term.replace(/[(),%*]/g, ' ').trim();
  const digitos = term.replace(/\D/g, '');
  let leadsQ: FilaLeadChat[] | null = [];
  if (limpio) {
    const conds = [`nombre.ilike.%${limpio}%`, `empresa.ilike.%${limpio}%`, `instagram.ilike.%${limpio.replace(/^@/, '')}%`];
    if (digitos.length >= 4) conds.push(`telefono_normalizado.like.%${digitos}%`);
    const db = await getTenantDb();
    const { data, error } = await db.from('leads').select(COLS_LEAD_CHAT).or(conds.join(',')).limit(25);
    if (error) { falla('crm')(new Error(error.message)); leadsQ = null; } else leadsQ = (data ?? []) as unknown as FilaLeadChat[];
  }
  const social = await buscarConversacionesSociales(term, (leadsQ ?? []).map((l) => Number(l.id))).catch(falla('instagram'));
  if (social == null) fallas.push('messenger');

  // Los leads de las personas sociales que no vinieron en la búsqueda (matchearon por @usuario).
  const yaLeidos = new Set((leadsQ ?? []).map((l) => Number(l.id)));
  const faltan = (social ?? []).map((s) => s.leadId).filter((x): x is number => x != null && !yaLeidos.has(x));
  const extra = await leerLeads(faltan).catch(falla('crm'));
  const filas = [...(leadsQ ?? []), ...(extra ?? [])];
  const leads = new Map(filas.map((l) => [Number(l.id), leadDelChat(l, embudo.stages, embudo.labels)]));

  const fuentes: FuenteChat[] = [];
  if (lns) {
    const def = lns.leidas.find((l) => l.linea === lns.porDefault) ?? { linea: lns.porDefault, rotulo: 'WhatsApp' };
    const varias = lns.leidas.length > 1;
    const bloqueados = await telefonosBloqueados().catch(() => new Set<string>());
    for (const l of leadsQ ?? []) {
      const tel = (l.telefono_normalizado ?? '').replace(/\D/g, '');
      if (!tel) continue;
      const bloqueado = bloqueados.has(tel);
      fuentes.push(fuenteWhatsapp({
        chatJid: `${tel}@s.whatsapp.net`, telefono: tel, nombre: l.nombre || tel, leadId: Number(l.id), empresa: l.empresa ?? null,
        etapaKey: null, etapaLabel: null, ultimoTexto: null, ultimoTipo: null, ultimaFecha: null, ultimoEntrante: false, total: 0, bloqueado,
      }, def, varias));
    }
  }
  const rs = rotulosSociales(social ?? []);
  for (const s of social ?? []) fuentes.push(fuenteSocial(s, rs.rotulo(s.canal, s.cuenta)));

  // Estado y leídos SÓLO de lo encontrado (no la tabla entera por cada tecla).
  const claves = [...new Set(fuentes.map((f) => (f.leadId != null ? claveLead(f.leadId) : f.claveSinLead)))];
  const [estados, leidos] = await Promise.all([
    leerEstados(claves).catch(falla('estado')),
    leerLeidos(yo.id, claves).catch(falla('leidos')),
  ]);
  const ctx: ContextoContactos = {
    leads, estados: estados ?? new Map(), leidos: leidos ?? new Map(),
    // Los borradores no se leen al buscar: lo encontrado que ya estaba en la lista conserva el suyo.
    borradores: { leadIds: new Set(), tels: new Set() },
    lineaDefault: lns?.porDefault ?? instanceNameDeWs(ws), ahoraMs: Date.now(),
  };
  return { chats: agruparPorContacto(fuentes, ctx), lineas: lns?.lineas ?? [], cuentasSociales: rs.cuentas, etapas: embudo.etapas, fallas: [...new Set(fallas)] };
}

// ── El hilo ─────────────────────────────────────────────────────────────────────

export type HiloChat = {
  chat: ChatResumen | null;
  mensajes: MensajeChat[];
  borradores: BorradorChat[];
  /** Extensión del contrato (§2.4): las fuentes del hilo que NO se pudieron leer ('whatsapp:<linea>', 'instagram', 'notas', 'eventos', 'borradores', 'crm'). */
  fallas: string[];
};

/** Un mensaje del espejo de WhatsApp en el formato del hilo. */
function mensajeWhatsapp(m: WaMensaje, linea: string): MensajeChat {
  return {
    id: `wa:${m.id}`, tipo: 'mensaje', canal: 'whatsapp', cuenta: linea, saliente: m.fromMe, autor: null,
    texto: m.texto, formato: formatoDe(m.tipo), mediaUrl: m.mediaUrl, mediaMime: m.mediaMime,
    fecha: m.fecha ?? new Date(0).toISOString(), status: statusDe(m.status), error: null,
  };
}

/** Los mensajes de WhatsApp de UNA línea → la fuente del contacto en esa línea (para el `chat` del hilo). */
function fuenteDeHilo(
  msgs: readonly WaMensaje[], l: LineaLeida, varias: boolean,
  base: { jid: string; tel: string | null; leadId: number | null; nombre: string; bloqueado: boolean },
): FuenteChat {
  const ultimo = msgs.length ? msgs[msgs.length - 1] : null;
  let entrante: WaMensaje | null = null;
  for (let i = msgs.length - 1; i >= 0; i--) if (!msgs[i].fromMe) { entrante = msgs[i]; break; }
  const f = fuenteWhatsapp({
    chatJid: base.jid, telefono: base.tel, nombre: base.nombre, leadId: base.leadId, empresa: null, etapaKey: null, etapaLabel: null,
    ultimoTexto: ultimo?.texto ?? null, ultimoTipo: ultimo?.tipo ?? null, ultimaFecha: ultimo?.fecha ?? null,
    ultimoEntrante: ultimo ? !ultimo.fromMe : false, total: msgs.length, bloqueado: base.bloqueado,
  }, l, varias);
  // En el hilo SÍ se conoce el último mensaje del contacto aunque el último sea nuestro.
  return { ...f, ultimaEntrante: entrante?.fecha ?? null };
}

/** Una fecha en la zona del negocio, corta («mié 15/10, 10:00»), para el «Pospuesta hasta…» del hilo. */
function fechaCorta(tz: string): (iso: string) => string {
  return (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    try {
      return new Intl.DateTimeFormat('es-MX', { timeZone: tz, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
    } catch {
      return d.toISOString().slice(0, 16).replace('T', ' ');
    }
  };
}

type FilaAudit = { id: number; campo: string; valor_nuevo: string | null; autor: string | null; created_at: string; archivo_nombre: string | null };

/**
 * Las notas del lead (`campo = 'Nota'`, comentarios del hilo) y sus cambios de etapa, asignado y closer
 * (eventos), los más recientes. La MISMA fuente que `getLeadNotasAction` del CRM (`lead_audit`), con el filtro
 * de campo en la base y el `.error` mirado: `getLeadAudit` corta en 100 filas de CUALQUIER campo (una ficha
 * movida muchas veces se comería las notas) y devuelve `[]` si no pudo leer.
 */
async function leerAuditDelHilo(leadId: number): Promise<FilaAudit[]> {
  const db = await getTenantDb();
  const { data, error } = await db.from('lead_audit')
    .select('id, campo, valor_nuevo, autor, created_at, archivo_nombre')
    .eq('lead_id', leadId).in('campo', [...CAMPOS_AUDIT_DEL_HILO])
    .order('created_at', { ascending: false }).limit(300);
  if (error) throw new Error(`lead_audit: ${error.message}`);
  return (data ?? []) as FilaAudit[];
}

/**
 * El autor del historial como se lee: el CRM firma con el EMAIL (`autorActual`) y lo resuelve al leer contra
 * `usuarios` — lo mismo que `getLeadAuditAction`. Sin fila (o con la lectura caída), la parte de antes de la @.
 */
async function nombresDeAutores(autores: readonly (string | null)[]): Promise<(a: string | null) => string | null> {
  const emails = [...new Set(autores.filter((a): a is string => !!a && a.includes('@')))];
  const porEmail = new Map<string, string>();
  if (emails.length) {
    // `usuarios` no es de inquilino: se busca SÓLO por los emails que firmaron este historial.
    const { data, error } = await getSupabaseServer().from('usuarios').select('email, nombre').in('email', emails);
    if (error) console.error(`[chats] autores del historial: ${error.message}`);
    for (const u of (data ?? []) as Array<{ email: string; nombre: string | null }>) porEmail.set(u.email, u.nombre?.trim() || u.email);
  }
  return (a) => (a && porEmail.get(a)) || autorLegible(a);
}

type FilaEvento = { id: number; tipo: string; actor: string | null; detalle: Record<string, unknown> | null; created_at: string };

/**
 * EL HILO DE UN CONTACTO: los mensajes de TODAS sus identidades (WhatsApp en cada línea, Instagram,
 * Messenger), sus notas como comentarios y los eventos (los de `chat_eventos` y los cambios de etapa, asignado
 * y closer del historial del lead), del más viejo al más nuevo. Más sus borradores de MaKo pendientes.
 *
 * ⚠️ La clave PUEDE CAMBIAR: una persona de Instagram que ya tiene lead devuelve el contacto `lead:<id>` (lo
 * agregaron al CRM desde otro lado); la pantalla lo nota por `chat.clave` (`onClaveCambio`).
 */
export async function hiloDeChat(clave: string, opts?: { usuario?: YoChats }): Promise<HiloChat> {
  const vacio: HiloChat = { chat: null, mensajes: [], borradores: [], fallas: [] };
  const p = parsearClave(clave);
  const ws = await getWorkspaceActual();
  if (!p || ws == null) return vacio;
  const fallas: string[] = [];
  const falla = (fuente: string) => (e: unknown) => { console.error(`[chats] hilo ${clave} ${fuente}: ${msg(e)}`); fallas.push(fuente); return null; };
  const yo = opts?.usuario ?? { id: 0, nombre: '' };

  // ¿De qué lead es? Una persona social con lead pasa a ser el contacto del lead.
  let leadId: number | null = p.tipo === 'lead' ? p.leadId : null;
  let socialPedida: ConversacionSocialChat[] | null = [];
  if (p.tipo === 'instagram' || p.tipo === 'messenger') {
    socialPedida = await conversacionesSocialesDe({ ids: [p.convId] }).catch(falla('instagram'));
    const suya = socialPedida?.find((s) => s.id === p.convId) ?? null;
    if (suya?.leadId != null) leadId = suya.leadId;
  }

  const [lns, embudo] = await Promise.all([lineasDelNegocio(ws), etapasDelNegocio()]);
  if (!lns) fallas.push('whatsapp');
  let lead: FilaLeadChat | null = null;
  if (leadId != null) {
    const r = await leerLeads([leadId]).catch(falla('crm'));
    lead = r?.[0] ?? null;
    // Un lead que no es de este negocio (o se borró) no tiene hilo: no se muestra nada de otro.
    if (r && !lead) return { ...vacio, fallas };
  }
  const claveFinal = leadId != null ? claveLead(leadId) : clave;
  const tel = leadId != null ? ((lead?.telefono_normalizado ?? '').replace(/\D/g, '') || null) : null;

  // WhatsApp: con lead, su teléfono en CADA línea; sin lead, la línea y el contacto de la clave.
  const fuentes: FuenteChat[] = [];
  const mensajes: MensajeChat[] = [];
  if (lns) {
    const varias = lns.leidas.length > 1;
    const todas: LineaLeida[] = lns.leidas.length ? lns.leidas : [{ linea: instanceNameDeWs(ws), rotulo: 'WhatsApp' }];
    const bloqueados = await telefonosBloqueados().catch(() => new Set<string>());
    let pedidos: Array<{ l: LineaLeida; jid: string; tel: string | null }> = [];
    if (p.tipo === 'whatsapp') {
      // La línea de la clave TIENE que ser del negocio (la clave viene del navegador).
      const l = todas.find((x) => x.linea === p.linea);
      if (l) {
        const telWa = /^\d{8,}$/.test(p.id) ? p.id : null;
        pedidos = [{ l, jid: telWa ? `${telWa}@s.whatsapp.net` : p.id, tel: telWa }];
      }
    } else if (tel) {
      pedidos = todas.map((l) => ({ l, jid: `${tel}@s.whatsapp.net`, tel }));
    }
    const leidas = await Promise.all(pedidos.map((x) =>
      getMensajesDeChat(x.jid, 300, lns.leidas.length ? x.l.linea : null)
        .then((ms) => ({ ...x, ms }))
        .catch((e) => { falla(`whatsapp:${x.l.linea}`)(e); return { ...x, ms: [] as WaMensaje[] }; })));
    for (const x of leidas) {
      for (const m of x.ms) mensajes.push(mensajeWhatsapp(m, x.l.linea));
      const bloqueado = !!x.tel && bloqueados.has(x.tel);
      fuentes.push(fuenteDeHilo(x.ms, x.l, varias, { jid: x.jid, tel: x.tel, leadId, nombre: lead?.nombre || (x.tel ?? x.jid), bloqueado }));
    }
  }

  // Instagram y Messenger: las personas del lead (y la pedida), con sus mensajes.
  const social = leadId != null
    ? await conversacionesSocialesDe({ leadId, ids: p.tipo === 'instagram' || p.tipo === 'messenger' ? [p.convId] : [] }).catch(falla('instagram'))
    : socialPedida;
  const rs = rotulosSociales(social ?? []);
  for (const s of social ?? []) fuentes.push(fuenteSocial(s, rs.rotulo(s.canal, s.cuenta)));
  if (social?.length) {
    const deSocial = await mensajesSociales(social.map((s) => s.id)).catch(falla('instagram'));
    mensajes.push(...(deSocial ?? []));
  }

  // Notas y cambios del lead, y los eventos de la conversación.
  const tz = await tzActual();
  const fecha = fechaCorta(tz);
  const etiquetaDeEtapa = (k: string) => embudo.stages.find((s) => s.key === k)?.label ?? embudo.labels[k] ?? k;
  const [audit, eventos, borr, estados, leidos] = await Promise.all([
    leadId != null ? leerAuditDelHilo(leadId).catch(falla('notas')) : Promise.resolve([] as FilaAudit[]),
    (async () => {
      const db = await getTenantDb();
      const { data, error } = await db.from('chat_eventos').select('id, tipo, actor, detalle, created_at')
        .eq('clave', claveFinal).order('created_at', { ascending: false }).limit(200);
      if (error) throw new Error(`chat_eventos: ${error.message}`);
      return (data ?? []) as FilaEvento[];
    })().catch(falla('eventos')),
    leerBorradores({ leadId, tel10: tel ? ultimos10(tel) : p.tipo === 'whatsapp' ? ultimos10(p.id) : null }).catch(falla('borradores')),
    leerEstados([claveFinal]).catch(falla('estado')),
    leerLeidos(yo.id, [claveFinal]).catch(falla('leidos')),
  ]);
  const autor = await nombresDeAutores((audit ?? []).map((a) => a.autor));
  for (const a of audit ?? []) {
    if (a.campo === 'Nota') {
      const texto = (a.valor_nuevo ?? '').trim() || (a.archivo_nombre ? `Archivo: ${a.archivo_nombre}` : '');
      if (!texto) continue;
      mensajes.push({
        id: `nota:${a.id}`, tipo: 'comentario', canal: null, cuenta: null, saliente: true, autor: autor(a.autor),
        texto, formato: 'text', mediaUrl: null, mediaMime: null, fecha: a.created_at, status: null, error: null,
      });
      continue;
    }
    const partes = partesDeAudit(a.campo, a.valor_nuevo, autor(a.autor), etiquetaDeEtapa);
    if (!partes) continue;
    mensajes.push({
      id: `audit:${a.id}`, tipo: 'evento', canal: null, cuenta: null, saliente: false, autor: autor(a.autor),
      texto: textoDePartes(partes), formato: 'text', mediaUrl: null, mediaMime: null, fecha: a.created_at, status: null, error: null, partes,
    });
  }
  for (const e of eventos ?? []) {
    const partes = partesDeEvento(e.tipo, e.actor, e.detalle, fecha);
    mensajes.push({
      id: `ev:${e.id}`, tipo: 'evento', canal: null, cuenta: null, saliente: false, autor: e.actor,
      texto: textoDePartes(partes), formato: 'text', mediaUrl: null, mediaMime: null, fecha: e.created_at, status: null, error: null, partes,
    });
  }
  const ms = (iso: string) => { const t = Date.parse(iso); return Number.isFinite(t) ? t : 0; };
  mensajes.sort((a, b) => ms(a.fecha) - ms(b.fecha) || a.id.localeCompare(b.id));

  const borradores: BorradorChat[] = (borr ?? []).map((b) => ({
    id: Number(b.id), texto: b.texto ?? '', linea: b.instance_name ?? null, createdAt: b.created_at, origen: b.origen ?? null,
  }));
  const leads = new Map<number, LeadDelChat>(lead ? [[Number(lead.id), leadDelChat(lead, embudo.stages, embudo.labels)]] : []);
  const [chat] = agruparPorContacto(fuentes, {
    leads, estados: estados ?? new Map(), leidos: leidos ?? new Map(), borradores: borradoresIndice(borr ?? []),
    lineaDefault: lns?.porDefault ?? instanceNameDeWs(ws), ahoraMs: Date.now(),
  });
  // Sin ninguna identidad (un lead sin teléfono ni Instagram) no hay contacto que dibujar: sólo sus notas.
  return { chat: chat ? { ...chat, clave: claveFinal } : null, mensajes, borradores, fallas: [...new Set(fallas)] };
}

// ── El estado y los leídos ──────────────────────────────────────────────────────

export type AccionEstadoChat = 'cerrar' | 'reabrir' | 'posponer' | 'reanudar';
export const ACCIONES_ESTADO_CHAT: readonly AccionEstadoChat[] = ['cerrar', 'reabrir', 'posponer', 'reanudar'];

/** Hasta cuándo se puede posponer: un año (respond.io ofrece hasta «Próxima semana» y una fecha elegida). */
export const POSPONER_MAX_MS = 366 * 24 * 3600_000;
/** El tope de la nota de cierre (el mismo `check` de la mig 0284). */
export const TOPE_NOTA_CIERRE = 2000;

const EVENTO_DE: Record<AccionEstadoChat, TipoEventoChat> = { cerrar: 'cerrada', reabrir: 'reabierta', posponer: 'pospuesta', reanudar: 'reanudada' };

/**
 * Cerrar, reabrir, posponer o reanudar una conversación: escribe `chat_estado` y deja el evento en
 * `chat_eventos` con el NOMBRE de quien lo hizo. Tira con un motivo corto si algo no va (la ruta lo devuelve).
 *
 * Una pospuesta se guarda como 'abierta' + `pospuesta_hasta` (la mig 0284): cerrar la des-pospone, y posponer
 * una cerrada la abre. El estado que se ve lo calcula `estadoEfectivo` al leer.
 */
export async function cambiarEstadoChat(
  clave: string,
  accion: AccionEstadoChat,
  opts: { actor: string; hasta?: string; nota?: string },
): Promise<void> {
  if (!parsearClave(clave)) throw new Error('Conversación inválida.');
  if (!ACCIONES_ESTADO_CHAT.includes(accion)) throw new Error('Acción inválida.');
  const ahora = new Date();
  const nota = (opts.nota ?? '').trim().slice(0, TOPE_NOTA_CIERRE) || null;
  const actor = (opts.actor ?? '').trim().slice(0, 200) || null;
  let fila: Record<string, unknown>;
  let detalle: Record<string, unknown> = {};
  switch (accion) {
    case 'cerrar':
      fila = { estado: 'cerrada', cerrada_at: ahora.toISOString(), cerrada_por: actor, nota_cierre: nota, pospuesta_hasta: null, pospuesta_at: null };
      if (nota) detalle = { nota };
      break;
    case 'reabrir':
      fila = { estado: 'abierta', cerrada_at: null, cerrada_por: null, nota_cierre: null, pospuesta_hasta: null, pospuesta_at: null };
      break;
    case 'posponer': {
      const t = opts.hasta ? Date.parse(opts.hasta) : NaN;
      if (!Number.isFinite(t) || t <= ahora.getTime()) throw new Error('Elige una fecha futura.');
      if (t - ahora.getTime() > POSPONER_MAX_MS) throw new Error('Hasta un año, como mucho.');
      const hasta = new Date(t).toISOString();
      fila = { estado: 'abierta', cerrada_at: null, cerrada_por: null, nota_cierre: null, pospuesta_hasta: hasta, pospuesta_at: ahora.toISOString() };
      detalle = { hasta };
      break;
    }
    case 'reanudar':
      fila = { estado: 'abierta', pospuesta_hasta: null, pospuesta_at: null };
      break;
  }
  const db = await getTenantDb();
  const { error } = await db.from('chat_estado').upsert({ clave, ...fila, updated_at: ahora.toISOString() }, { onConflict: 'workspace_id,clave' });
  if (error) throw new Error(`No se guardó: ${error.message}`);
  const { error: eEv } = await db.from('chat_eventos').insert({ clave, tipo: EVENTO_DE[accion], actor, detalle });
  // El estado ya cambió: un evento que no se escribió es una línea menos en el hilo, no un estado a medias.
  if (eEv) console.error(`[chats] evento ${EVENTO_DE[accion]} de ${clave}: ${eEv.message}`);
}

/**
 * «Leí esta conversación»: la marca de ESTA persona, en el servidor (`chat_leidos`). Una sesión sin fila en
 * `usuarios` (dev, legacy) no marca: no hay a quién atarla (la FK de la mig 0284).
 */
export async function marcarChatLeido(clave: string, usuarioId: number): Promise<void> {
  if (!parsearClave(clave)) throw new Error('Conversación inválida.');
  if (!(Number.isSafeInteger(usuarioId) && usuarioId > 0)) return;
  const db = await getTenantDb();
  const { error } = await db.from('chat_leidos').upsert(
    { usuario_id: usuarioId, clave, leido_at: new Date().toISOString() },
    { onConflict: 'workspace_id,usuario_id,clave' },
  );
  if (error) throw new Error(`No se marcó: ${error.message}`);
}

// ── El contacto (el drawer) ─────────────────────────────────────────────────────

export type ContactoChat = {
  id: number; nombre: string; telefono: string | null; email: string | null; empresa: string | null; instagram: string | null;
  etapaKey: string | null; etapaLabel: string | null; setter: string | null; closer: string | null;
  origen: string | null; createdAt: string | null; etiquetas: { nombre: string; color: string }[];
};

/**
 * Los datos del lead para el drawer «Contacto». null = no es un lead de este negocio. Tira si no pudo leer el
 * lead; las etiquetas son un adorno: si fallan, vuelven vacías y se loguea.
 */
export async function contactoDeLead(leadId: number): Promise<ContactoChat | null> {
  const l = await getLead(leadId);
  if (!l) return null;
  const [embudo, etiquetas] = await Promise.all([
    etapasDelNegocio(),
    etiquetasDeLead(leadId).catch((e): EtiquetaDelLead[] => { console.error(`[chats] etiquetas del lead ${leadId}: ${msg(e)}`); return []; }),
  ]);
  const e = etapaDe(l as unknown as FilaLeadChat, embudo.stages, embudo.labels);
  return {
    id: l.id, nombre: l.nombre, telefono: l.telefono ?? null, email: l.email ?? null, empresa: l.empresa ?? null,
    instagram: l.instagram ?? null, etapaKey: e.key, etapaLabel: e.label, setter: l.setter ?? null, closer: l.closer ?? null,
    origen: l.origen_lead ?? null, createdAt: l.created_at ?? null,
    etiquetas: etiquetas.map((t) => ({ nombre: t.nombre, color: t.color })),
  };
}

/** Las etapas del embudo del negocio (para validar `POST /api/chats/etapa` contra el mismo catálogo que la lista). */
export async function etapasDeChats(): Promise<{ stages: Stage[]; falla: boolean }> {
  const e = await etapasDelNegocio();
  return { stages: e.stages, falla: e.falla };
}

