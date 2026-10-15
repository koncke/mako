// =============================================================================
// chats-reglas — lo PURO de la tab Chats: claves, contactos, estado, no leídos, filtros y contadores
// =============================================================================
// Sin `server-only` ni `'use client'`: lo importan la pantalla (app/chats/, para filtrar y contar en
// memoria lo que ya bajó), el servidor (lib/chats.ts, para armar la lista) y los tests
// (tests/chats-datos.test.ts). Todo lo que decide QUÉ se ve vive acá, una vez: si la pantalla y el
// servidor contaran cada uno a su manera, el contador del panel diría 12 y la lista mostraría 11.
//
// Lo que NO vive acá: leer la base (lib/chats.ts) ni hablar con Zernio (lib/canal-zernio.ts).
//
// El modelo (docs/diseno-chats.md §1) es el de respond.io: una conversación es un CONTACTO.
//   · Con lead: `lead:<id>` junta todas sus identidades (WhatsApp en cada línea donde hay historial y
//     sus filas de Instagram/Messenger con ese `lead_id`).
//   · Sin lead: cada identidad es su contacto — `wa:<linea>:<tel10 o jid>`, `ig:<conv>`, `fb:<conv>`.
//   ⚠️ La clave de un contacto sin lead CAMBIA cuando se agrega al CRM (pasa a `lead:<id>`): su
//   estado (cerrada/pospuesta) y su marca de leído quedan en la clave vieja. Aceptado en el plano.
// =============================================================================

import { MAKO_SETTER } from './pipeline';
import type { CanalChat, ChatResumen, EstadoChat, FormatoMsg, IdentidadCanal, ParteTexto } from './chats-tipos';

// ── Claves ──────────────────────────────────────────────────────────────────────

export const PREFIJO_CLAVE = { lead: 'lead:', whatsapp: 'wa:', instagram: 'ig:', messenger: 'fb:' } as const;

/** Los últimos 10 dígitos de un teléfono (o '' si no hay dígitos). */
export const ultimos10 = (tel: string | null | undefined): string => String(tel ?? '').replace(/\D/g, '').slice(-10);

/**
 * El id de un contacto de WhatsApp DENTRO de una línea: los últimos 10 dígitos si hay al menos 8, y si
 * no el jid crudo (un grupo, un @lid sin número). ⚠️ ES LA MISMA REGLA que `claveTel`
 * (lib/evolution-mensajes.ts), con la que la bandeja agrupa los mensajes: si fueran distintas, la
 * clave de la lista no encontraría su hilo. No se importa porque ese módulo es `server-only`; lo
 * ata tests/chats-datos.test.ts leyendo el fuente de `claveTel`.
 */
export function idWhatsapp(telefono: string | null | undefined, jid: string): string {
  const d = ultimos10(telefono);
  return d.length >= 8 ? d : jid;
}

export const claveLead = (leadId: number): string => `${PREFIJO_CLAVE.lead}${leadId}`;
export const claveWhatsapp = (linea: string, telefono: string | null | undefined, jid: string): string =>
  `${PREFIJO_CLAVE.whatsapp}${linea}:${idWhatsapp(telefono, jid)}`;
export const claveSocial = (canal: 'instagram' | 'messenger', convId: number): string =>
  `${canal === 'instagram' ? PREFIJO_CLAVE.instagram : PREFIJO_CLAVE.messenger}${convId}`;

export type ClaveChat =
  | { tipo: 'lead'; leadId: number }
  | { tipo: 'whatsapp'; linea: string; id: string }
  | { tipo: 'instagram' | 'messenger'; convId: number };

/** Tope de largo de una clave: viaja en la URL y es PK de `chat_estado` / `chat_leidos`. */
export const TOPE_CLAVE = 200;

const entero = (s: string): number | null => (/^\d{1,15}$/.test(s) ? Number(s) : null);

/**
 * Lee una clave. null = no es una clave válida (viene del navegador: se valida antes de tocar nada).
 * La línea de `wa:` es un `instance_name` (`mako_ws13`, `mako_ws13_k3x9qa`): sin `:` adentro, así
 * que el primer `:` después del prefijo la separa del id (que sí puede traer `@` y `.`).
 */
export function parsearClave(clave: unknown): ClaveChat | null {
  if (typeof clave !== 'string' || !clave || clave.length > TOPE_CLAVE) return null;
  if (clave.startsWith(PREFIJO_CLAVE.lead)) {
    const id = entero(clave.slice(PREFIJO_CLAVE.lead.length));
    return id != null && id > 0 ? { tipo: 'lead', leadId: id } : null;
  }
  if (clave.startsWith(PREFIJO_CLAVE.instagram) || clave.startsWith(PREFIJO_CLAVE.messenger)) {
    const id = entero(clave.slice(3));
    if (id == null || id <= 0) return null;
    return { tipo: clave.startsWith(PREFIJO_CLAVE.instagram) ? 'instagram' : 'messenger', convId: id };
  }
  if (clave.startsWith(PREFIJO_CLAVE.whatsapp)) {
    const resto = clave.slice(PREFIJO_CLAVE.whatsapp.length);
    const i = resto.indexOf(':');
    if (i <= 0) return null;
    const linea = resto.slice(0, i);
    const id = resto.slice(i + 1);
    if (!/^[a-z0-9_]+$/i.test(linea) || !id || !/^[A-Za-z0-9@._:-]+$/.test(id)) return null;
    return { tipo: 'whatsapp', linea, id };
  }
  return null;
}

/** La clave de una cuenta para los filtros y contadores del panel: `whatsapp:<linea>`, `instagram:<cuenta>`. */
export const claveCuenta = (canal: CanalChat, cuenta: string | null | undefined): string => `${canal}:${cuenta ?? ''}`;

// ── Formatos ────────────────────────────────────────────────────────────────────

const FORMATOS: ReadonlySet<string> = new Set(['text', 'image', 'audio', 'video', 'document', 'sticker', 'otro']);

/** El tipo del espejo de WhatsApp (`wa_mensajes.tipo`) en el del contrato. Sin tipo = texto. */
export function formatoDe(tipo: string | null | undefined): FormatoMsg {
  if (!tipo) return 'text';
  return FORMATOS.has(tipo) ? (tipo as FormatoMsg) : 'otro';
}

/** El tipo de un adjunto de Instagram/Messenger (`ig_mensajes.adjuntos[].type`) en el del contrato. */
export function formatoDeAdjunto(tipo: string | null | undefined): FormatoMsg {
  switch ((tipo ?? '').toLowerCase()) {
    case 'image': case 'photo': case 'gif': return 'image';
    case 'video': case 'reel': case 'ig_reel': return 'video';
    case 'audio': return 'audio';
    case 'file': case 'document': return 'document';
    case 'sticker': return 'sticker';
    default: return 'otro';
  }
}

export function statusDe(s: string | null | undefined): 'sent' | 'delivered' | 'read' | 'failed' | null {
  return s === 'sent' || s === 'delivered' || s === 'read' || s === 'failed' ? s : null;
}

// ── Cómo se escribe un destino ──────────────────────────────────────────────────

/** `+<dígitos>`, sin formato por país: no sabemos de dónde es (la regla de `rotuloLinea`). */
export const destinoTelefono = (tel: string | null | undefined): string | null => {
  const d = String(tel ?? '').replace(/\D/g, '');
  return d ? `+${d}` : null;
};

/** 'WhatsApp' con una sola línea; 'WhatsApp (Ventas)' con varias, para que el selector las distinga. */
export const rotuloWhatsapp = (rotuloDeLaLinea: string, variasLineas: boolean): string =>
  (variasLineas ? `WhatsApp (${rotuloDeLaLinea})` : 'WhatsApp');

// ── Estado efectivo y no leídos (§2.5) ──────────────────────────────────────────

/** La fila de `chat_estado` que importa para decidir. Una pospuesta se guarda como 'abierta' + `pospuesta_hasta`. */
export type FilaEstadoChat = {
  estado: 'abierta' | 'cerrada';
  cerrada_at: string | null;
  pospuesta_hasta: string | null;
  pospuesta_at: string | null;
};

const ms = (iso: string | null | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : NaN;
};

/**
 * EL ESTADO QUE SE VE, calculado al leer (nada escribe en el webhook):
 *   · una CERRADA se reabre sola si entró un mensaje del contacto después de `cerrada_at`
 *     (respond.io: «Conversation opened by Contact»);
 *   · una POSPUESTA vuelve a abierta al vencer `pospuesta_hasta`, o si entró un mensaje del contacto
 *     después de `pospuesta_at` (respond.io: «Reply to unsnooze»).
 * `ultimaEntrante` = el último mensaje DEL CONTACTO que se conoce (null = ninguno, o no se sabe).
 */
export function estadoEfectivo(
  fila: FilaEstadoChat | null | undefined,
  ultimaEntrante: string | null,
  ahoraMs: number,
): { estado: EstadoChat; pospuestaHasta: string | null } {
  if (!fila) return { estado: 'abierta', pospuestaHasta: null };
  const entro = ms(ultimaEntrante);
  if (fila.estado === 'cerrada') {
    const cerro = ms(fila.cerrada_at);
    if (Number.isFinite(entro) && Number.isFinite(cerro) && entro > cerro) return { estado: 'abierta', pospuestaHasta: null };
    return { estado: 'cerrada', pospuestaHasta: null };
  }
  const hasta = ms(fila.pospuesta_hasta);
  if (!Number.isFinite(hasta) || hasta <= ahoraMs) return { estado: 'abierta', pospuestaHasta: null };
  const desde = ms(fila.pospuesta_at);
  if (Number.isFinite(entro) && Number.isFinite(desde) && entro > desde) return { estado: 'abierta', pospuestaHasta: null };
  return { estado: 'pospuesta', pospuestaHasta: fila.pospuesta_hasta };
}

/**
 * ¿Hay algo del contacto que YO no vi? Por persona y en el servidor (`chat_leidos`), no en el
 * navegador. Sin marca, cuenta como no leído todo lo que el contacto escribió último: es lo mismo
 * que «Sin responder» hasta que la persona abre la conversación por primera vez.
 */
export function sinLeer(ultimaEntrante: string | null, leidoAt: string | null | undefined): boolean {
  const entro = ms(ultimaEntrante);
  if (!Number.isFinite(entro)) return false;
  const leyo = ms(leidoAt ?? null);
  return !Number.isFinite(leyo) || entro > leyo;
}

// ── Agrupar por contacto ────────────────────────────────────────────────────────

/**
 * UNA IDENTIDAD con su última actividad, como la arma el servidor por fuente (una conversación de
 * WhatsApp de una línea, una fila de Instagram o de Messenger).
 */
export type FuenteChat = {
  identidad: IdentidadCanal;
  leadId: number | null;
  /** La clave del contacto si NO tiene lead (`wa:…`, `ig:…`, `fb:…`). */
  claveSinLead: string;
  /** El nombre que trae la fuente (push_name, @usuario): el del lead gana. */
  nombre: string;
  empresa: string | null;
  ultimoTexto: string | null;
  ultimoTipo: FormatoMsg | null;
  ultimaFecha: string | null;
  ultimoEntrante: boolean;
  /** El último mensaje DEL CONTACTO que se conoce (null = ninguno, o no se sabe). */
  ultimaEntrante: string | null;
  /** Cuántos mensajes leyó la fuente. 0 = un contacto sin historial (el placeholder de «Nutrición - Manual»). */
  total: number;
};

/** Lo que el contacto toma del lead del CRM. */
export type LeadDelChat = {
  id: number;
  nombre: string | null;
  empresa: string | null;
  telefono: string | null;
  setter: string | null;
  closer: string | null;
  etapaKey: string | null;
  etapaLabel: string | null;
};

export type ContextoContactos = {
  leads: ReadonlyMap<number, LeadDelChat>;
  estados: ReadonlyMap<string, FilaEstadoChat>;
  /** clave → `leido_at` de ESTA persona. */
  leidos: ReadonlyMap<string, string>;
  /** Los borradores de MaKo pendientes: por lead y por los últimos 10 dígitos del teléfono. */
  borradores: { leadIds: ReadonlySet<number>; tels: ReadonlySet<string> };
  /** La línea por default: un placeholder sin historial se queda en ésa y no en cada línea. */
  lineaDefault: string | null;
  ahoraMs: number;
};

const desc = (a: string | null, b: string | null): number => {
  const x = ms(a); const y = ms(b);
  if (!Number.isFinite(x) && !Number.isFinite(y)) return 0;
  if (!Number.isFinite(x)) return 1;
  if (!Number.isFinite(y)) return -1;
  return y - x;
};

const masTarde = (a: string | null, b: string | null): string | null => {
  const x = ms(a); const y = ms(b);
  if (!Number.isFinite(y)) return Number.isFinite(x) ? a : null;
  if (!Number.isFinite(x)) return b;
  return y > x ? b : a;
};

/**
 * Las identidades de un contacto, sin repetidas y sin placeholders de más:
 *   · un WhatsApp SIN historial (total 0) se descarta si el contacto ya tiene un WhatsApp con
 *     mensajes — la bandeja lee POR LÍNEA y cada lectura agrega los placeholders de «Nutrición -
 *     Manual» sin mirar la línea (docs/hallazgos-comunicacion.md, la trampa 2 de la bandeja vieja);
 *   · de varios placeholders queda uno: el de la línea por default (o el primero).
 */
function identidadesDe(fuentes: readonly FuenteChat[], lineaDefault: string | null): FuenteChat[] {
  const visto = new Set<string>();
  const unicas = fuentes.filter((f) => {
    const k = `${f.identidad.canal}|${f.identidad.cuenta ?? ''}|${f.identidad.ref}`;
    if (visto.has(k)) return false;
    visto.add(k);
    return true;
  });
  const wa = unicas.filter((f) => f.identidad.canal === 'whatsapp');
  const conHistoria = wa.some((f) => f.total > 0);
  const placeholders = wa.filter((f) => f.total === 0);
  const queda = conHistoria ? null : (placeholders.find((f) => f.identidad.cuenta === lineaDefault) ?? placeholders[0] ?? null);
  return unicas
    .filter((f) => f.identidad.canal !== 'whatsapp' || f.total > 0 || f === queda)
    .sort((a, b) => desc(a.ultimaFecha, b.ultimaFecha));
}

/**
 * LAS FUENTES → LOS CONTACTOS de la lista, con su estado, sus no leídos y su borrador. Las fuentes de
 * un mismo lead van juntas (`lead:<id>`); sin lead, cada una es su contacto. La lista sale ordenada
 * por la última actividad, la más reciente primero.
 */
export function agruparPorContacto(fuentes: readonly FuenteChat[], ctx: ContextoContactos): ChatResumen[] {
  const grupos = new Map<string, FuenteChat[]>();
  for (const f of fuentes) {
    const k = f.leadId != null ? claveLead(f.leadId) : f.claveSinLead;
    const g = grupos.get(k);
    if (g) g.push(f); else grupos.set(k, [f]);
  }
  const out: ChatResumen[] = [];
  for (const [clave, todas] of grupos) {
    const suyas = identidadesDe(todas, ctx.lineaDefault);
    if (!suyas.length) continue;
    const ultima = suyas[0];
    const leadId = ultima.leadId;
    const lead = leadId != null ? ctx.leads.get(leadId) ?? null : null;
    const ultimaEntrante = suyas.reduce<string | null>((acc, f) => masTarde(acc, f.ultimaEntrante), null);
    const { estado, pospuestaHasta } = estadoEfectivo(ctx.estados.get(clave), ultimaEntrante, ctx.ahoraMs);
    const telWa = suyas.find((f) => f.identidad.canal === 'whatsapp' && f.identidad.telefono)?.identidad.telefono ?? null;
    const telLead = lead?.telefono ? lead.telefono.replace(/\D/g, '') || null : null;
    const borrador = (leadId != null && ctx.borradores.leadIds.has(leadId))
      || suyas.some((f) => f.identidad.canal === 'whatsapp' && ctx.borradores.tels.has(ultimos10(f.identidad.telefono)) && ultimos10(f.identidad.telefono).length >= 8);
    out.push({
      clave,
      leadId,
      nombre: lead?.nombre?.trim() || suyas.map((f) => f.nombre.trim()).find(Boolean) || 'Sin nombre',
      empresa: lead?.empresa ?? suyas.map((f) => f.empresa).find((e) => !!e) ?? null,
      avatarTel: telWa ?? telLead,
      canales: suyas.map((f) => f.identidad),
      canalUltimo: ultima.identidad.canal,
      ultimoTexto: ultima.ultimoTexto,
      ultimoTipo: ultima.ultimoTipo,
      ultimaFecha: ultima.ultimaFecha,
      ultimoEntrante: ultima.ultimoEntrante,
      etapaKey: lead?.etapaKey ?? null,
      etapaLabel: lead?.etapaLabel ?? null,
      asignado: lead?.setter?.trim() || null,
      closer: lead?.closer?.trim() || null,
      estado,
      pospuestaHasta,
      sinLeer: sinLeer(ultimaEntrante, ctx.leidos.get(clave)),
      borrador,
      bloqueado: suyas.some((f) => f.identidad.bloqueado),
    });
  }
  return out.sort((a, b) => desc(a.ultimaFecha, b.ultimaFecha));
}

// ── Filtros de la pantalla ──────────────────────────────────────────────────────

/** Las bandejas del panel: Todos · Míos · Sin asignar · MaKo (Atiende MaKo · Borradores) · Bloqueados. */
export type VistaChats = 'todos' | 'mios' | 'sin-asignar' | 'mako' | 'borradores' | 'bloqueados';
/** «Mostrar»: Todas · Abiertas · Cerradas · Pospuestas. */
export type MostrarChats = 'todas' | 'abiertas' | 'cerradas' | 'pospuestas';
/** «Orden»: Más recientes · Más antiguas. */
export type OrdenChats = 'recientes' | 'antiguas';

export type FiltroChats = {
  vista: VistaChats;
  /** Un canal entero (todas sus cuentas), o null = todos. */
  canal: CanalChat | null;
  /** Una cuenta de ese canal (la línea o la cuenta de Zernio), o null = todas las del canal. */
  cuenta: string | null;
  /** Una etapa del CRM (`leads` → `etapaVigenteDe`), o null = todas. */
  etapa: string | null;
  mostrar: MostrarChats;
  orden: OrdenChats;
  /** «Sin responder»: el último mensaje es del contacto. */
  sinResponder: boolean;
};

/** Lo que la pantalla muestra al entrar: la copia de «All, Newest» de respond.io con «Abiertas». */
export const FILTRO_INICIAL: FiltroChats = {
  vista: 'todos', canal: null, cuenta: null, etapa: null, mostrar: 'abiertas', orden: 'recientes', sinResponder: false,
};

const igual = (a: string | null | undefined, b: string | null | undefined): boolean => {
  const x = (a ?? '').trim(); const y = (b ?? '').trim();
  return !!x && x === y;
};

/**
 * «Míos» = soy el asignado (el setter) o el closer, por NOMBRE: el CRM guarda el nombre del miembro
 * en `leads.setter` / `leads.closer`, no un id (el filtro «persona» del CRM, app/crm/actions.ts).
 */
export const esMio = (c: Pick<ChatResumen, 'asignado' | 'closer'>, yo: { nombre: string }): boolean =>
  igual(c.asignado, yo.nombre) || igual(c.closer, yo.nombre);

/** «Sin asignar» = ni setter ni closer, como el `SIN_ASIGNAR` del CRM. Un contacto sin lead también. */
export const estaSinAsignar = (c: Pick<ChatResumen, 'asignado' | 'closer'>): boolean => !c.asignado?.trim() && !c.closer?.trim();

/** «Atiende MaKo» = MaKo es el setter (lo pone el motor al pasar a una nutrición automática). */
export const atiendeMako = (c: Pick<ChatResumen, 'asignado'>): boolean => (c.asignado ?? '').trim() === MAKO_SETTER;

/** ¿El contacto está en esta bandeja? Un bloqueado vive SÓLO en «Bloqueados» (respond.io: Blocked Contacts). */
export function enVista(c: ChatResumen, vista: VistaChats, yo: { nombre: string }): boolean {
  if (vista === 'bloqueados') return c.bloqueado;
  if (c.bloqueado) return false;
  switch (vista) {
    case 'todos': return true;
    case 'mios': return esMio(c, yo);
    case 'sin-asignar': return estaSinAsignar(c);
    case 'mako': return atiendeMako(c);
    case 'borradores': return c.borrador;
  }
}

/** ¿Alguna de sus identidades es de ese canal (y de esa cuenta, si se pidió)? */
export function enCanal(c: Pick<ChatResumen, 'canales'>, canal: CanalChat | null, cuenta: string | null): boolean {
  if (!canal) return true;
  return c.canales.some((i) => i.canal === canal && (cuenta == null || i.cuenta === cuenta));
}

export function enMostrar(c: Pick<ChatResumen, 'estado'>, mostrar: MostrarChats): boolean {
  switch (mostrar) {
    case 'todas': return true;
    case 'abiertas': return c.estado === 'abierta';
    case 'cerradas': return c.estado === 'cerrada';
    case 'pospuestas': return c.estado === 'pospuesta';
  }
}

/** Ordena una copia: por la última actividad; lo que no tiene fecha va siempre al final. */
export function ordenarChats(chats: readonly ChatResumen[], orden: OrdenChats): ChatResumen[] {
  return [...chats].sort((a, b) => {
    const x = ms(a.ultimaFecha); const y = ms(b.ultimaFecha);
    if (!Number.isFinite(x) && !Number.isFinite(y)) return 0;
    if (!Number.isFinite(x)) return 1;
    if (!Number.isFinite(y)) return -1;
    return orden === 'recientes' ? y - x : x - y;
  });
}

/** La lista de la pantalla: bandeja + canal/cuenta + etapa + Mostrar + Sin responder, en el orden pedido. */
export function filtrarChats(chats: readonly ChatResumen[], f: FiltroChats, yo: { nombre: string }): ChatResumen[] {
  return ordenarChats(chats.filter((c) =>
    enVista(c, f.vista, yo)
    && enCanal(c, f.canal, f.cuenta)
    && (!f.etapa || c.etapaKey === f.etapa)
    && enMostrar(c, f.mostrar)
    && (!f.sinResponder || c.ultimoEntrante)), f.orden);
}

/** El buscador local (sobre la lista que ya bajó): nombre, empresa, teléfono o @usuario. */
export function coincideBusqueda(c: Pick<ChatResumen, 'nombre' | 'empresa' | 'canales'>, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  if (c.nombre.toLowerCase().includes(t) || (c.empresa ?? '').toLowerCase().includes(t)) return true;
  const dig = t.replace(/\D/g, '');
  return c.canales.some((i) =>
    (i.destino ?? '').toLowerCase().includes(t)
    || (dig.length >= 4 && (i.telefono ?? '').includes(dig)));
}

// ── Contadores del panel ────────────────────────────────────────────────────────

/** respond.io: el número gris = conversaciones ABIERTAS; la píldora azul = las que tienen algo nuevo. */
export type Conteo = { abiertas: number; nuevos: number };

export type ConteosBandeja = {
  todos: Conteo;
  mios: Conteo;
  sinAsignar: Conteo;
  mako: Conteo;
  borradores: Conteo;
  /** En «Bloqueados» `abiertas` es el TOTAL de bloqueados (no tienen estado que importe). */
  bloqueados: Conteo;
  porCanal: Record<CanalChat, Conteo>;
  /** Por `claveCuenta(canal, cuenta)`. */
  porCuenta: Record<string, Conteo>;
  /** Por `etapaKey`. */
  porEtapa: Record<string, Conteo>;
};

const cero = (): Conteo => ({ abiertas: 0, nuevos: 0 });

/**
 * Los contadores del panel. Cuentan lo que la vista mostraría con «Abiertas» (sin bloqueados), y
 * «nuevos» las que tienen algo sin leer. Un contacto con dos cuentas suma en las dos.
 */
export function contarBandejas(chats: readonly ChatResumen[], yo: { nombre: string }): ConteosBandeja {
  const r: ConteosBandeja = {
    todos: cero(), mios: cero(), sinAsignar: cero(), mako: cero(), borradores: cero(), bloqueados: cero(),
    porCanal: { whatsapp: cero(), instagram: cero(), messenger: cero() }, porCuenta: {}, porEtapa: {},
  };
  const sumar = (k: Conteo, c: ChatResumen) => {
    if (c.estado === 'abierta') k.abiertas++;
    if (c.sinLeer) k.nuevos++;
  };
  for (const c of chats) {
    if (c.bloqueado) { r.bloqueados.abiertas++; continue; }
    sumar(r.todos, c);
    if (esMio(c, yo)) sumar(r.mios, c);
    if (estaSinAsignar(c)) sumar(r.sinAsignar, c);
    if (atiendeMako(c)) sumar(r.mako, c);
    if (c.borrador) sumar(r.borradores, c);
    if (c.etapaKey) sumar((r.porEtapa[c.etapaKey] ??= cero()), c);
    const canales = new Set<CanalChat>();
    const cuentas = new Set<string>();
    for (const i of c.canales) { canales.add(i.canal); cuentas.add(claveCuenta(i.canal, i.cuenta)); }
    for (const k of canales) sumar(r.porCanal[k], c);
    for (const k of cuentas) sumar((r.porCuenta[k] ??= cero()), c);
  }
  return r;
}

// ── Los eventos del hilo, en partes (las negritas marcadas) ─────────────────────

export type TipoEventoChat = 'cerrada' | 'reabierta' | 'pospuesta' | 'reanudada';
export const TIPOS_EVENTO_CHAT: readonly TipoEventoChat[] = ['cerrada', 'reabierta', 'pospuesta', 'reanudada'];

const conActor = (base: ParteTexto[], actor: string | null): ParteTexto[] =>
  (actor?.trim() ? [...base, { t: ' por ' }, { t: actor.trim(), b: true }] : base);

/**
 * Un evento de `chat_eventos` en partes: «Cerrada por **Martín**», «Pospuesta hasta **mié 15/10,
 * 10:00** por **Martín**». `fecha` formatea el `hasta` (en la zona del negocio, la pone el servidor).
 */
export function partesDeEvento(
  tipo: string,
  actor: string | null,
  detalle: { hasta?: unknown; nota?: unknown } | null | undefined,
  fecha: (iso: string) => string = (iso) => iso,
): ParteTexto[] {
  const nota = typeof detalle?.nota === 'string' && detalle.nota.trim() ? detalle.nota.trim() : null;
  const hasta = typeof detalle?.hasta === 'string' && detalle.hasta ? detalle.hasta : null;
  let p: ParteTexto[];
  switch (tipo) {
    case 'cerrada': p = conActor([{ t: 'Cerrada' }], actor); break;
    case 'reabierta': p = conActor([{ t: 'Reabierta' }], actor); break;
    case 'pospuesta': p = conActor(hasta ? [{ t: 'Pospuesta hasta ' }, { t: fecha(hasta), b: true }] : [{ t: 'Pospuesta' }], actor); break;
    case 'reanudada': p = conActor([{ t: 'Reanudada' }], actor); break;
    default: p = conActor([{ t: tipo }], actor);
  }
  return nota ? [...p, { t: `: ${nota}` }] : p;
}

/**
 * Un cambio del historial del lead (`lead_audit`) que el hilo muestra como evento: la etapa, el
 * asignado (setter) y el closer. null = ese campo no se muestra en el hilo.
 */
export function partesDeAudit(
  campo: string,
  nuevo: string | null,
  actor: string | null,
  etiquetaDeEtapa: (key: string) => string = (k) => k,
): ParteTexto[] | null {
  const v = (nuevo ?? '').trim();
  switch (campo) {
    case 'Etapa': return v ? conActor([{ t: 'Etapa cambiada a ' }, { t: etiquetaDeEtapa(v), b: true }], actor) : null;
    case 'Setter': return conActor(v ? [{ t: 'Asignada a ' }, { t: v, b: true }] : [{ t: 'Asignación quitada' }], actor);
    case 'Closer': return conActor(v ? [{ t: 'Closer: ' }, { t: v, b: true }] : [{ t: 'Closer quitado' }], actor);
    default: return null;
  }
}

/** Los campos del historial del lead que entran al hilo: las notas como comentarios, el resto como eventos. */
export const CAMPOS_AUDIT_DEL_HILO = ['Nota', 'Etapa', 'Setter', 'Closer'] as const;

/** El texto plano de unas partes (para `MensajeChat.texto` y para la API de MaKo). */
export const textoDePartes = (p: readonly ParteTexto[]): string => p.map((x) => x.t).join('');

/** El autor del historial (un email, 'CRM', 'MaKo') como se lee, cuando no hay nombre del equipo. */
export const autorLegible = (a: string | null | undefined): string | null => {
  const s = (a ?? '').trim();
  if (!s) return null;
  return s.includes('@') ? s.split('@')[0] : s;
};
