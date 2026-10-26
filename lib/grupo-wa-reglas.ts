// =============================================================================
// Traer los contactos de un grupo de WhatsApp al CRM — lo PURO (23/10/2026)
// =============================================================================
// Martín, en la llamada del 23/10 (Fathom 195591907, min 37:27): «una automatización que te agrega de un grupo de WhatsApp,
// te pone todos los números y los contactos en tu CRM de manera automática... sí o sí lo tengo que tener para mañana porque
// lo voy a usar para mí mismo». Lo que habla con Evolution vive en lib/grupo-wa.ts; acá, leer lo que contesta.
//
// MEDIDO el 23/10/2026 en Evolution v2.3.7, sobre la línea viva de la plataforma (11 grupos):
//   · `GET /group/fetchAllGroups/{inst}?getParticipants=false` → 200 en 2 s: [{ id: '…@g.us', subject, size, … }];
//   · `POST /chat/findChats/{inst}` → 200 en 0,2 s (lee la BASE de Evolution, no a WhatsApp): los grupos con los que la línea
//     habló, `remoteJid` '…@g.us' y su nombre en `pushName`;
//   · `GET /group/participants/{inst}?groupJid=` → 200 en 0,4 s: { participants: [{ id: '…@lid', phoneNumber:
//     '…@s.whatsapp.net', name?, admin, imgUrl }] }.
// ⚠️ EL `id` DE UN PARTICIPANTE ES UN `@lid`, NO UN TELÉFONO: un alias interno de WhatsApp (lib/evolution-contactos.ts ya lo
//    dice). El número sale de `phoneNumber`. Uno sin `phoneNumber` (WhatsApp no lo muestra) NO se importa: se cuenta y se dice.
// ⚠️ `fetchAllGroups` en una línea con muchos grupos llegó a no terminar (90 s en el ws11, 11/09/2026: lib/evolution.ts,
//    `sondearSocketDetalle`). Por eso va con tope, y si no contesta, los grupos de la base (`findChats`). Medido otra vez el
//    24/10/2026 en la línea de Martín (61 grupos): no contestó en 90 s; `findChats`, en 1,2 s.
// ⚠️ EL LISTADO NO TRAE NOMBRES (medido el 24/10/2026, línea de Martín, 247 y 41 participantes): cada uno viene sólo con `id`
//    (su `@lid`), `phoneNumber` y `admin`. El nombre sale de lo que WhatsApp YA conoce sin preguntarle a la red
//    (`conNombresConocidos`): la agenda de la línea en la base de Evolution (por teléfono o por `@lid`) y la nuestra
//    (`evolution_contactos`). De quien nunca escribió no hay nombre: se trae igual y se completa después, cuando aparece
//    («Completar nombres», app/crm/grupo-wa-server.ts). Preguntarle el perfil a WhatsApp número por número sí lo da a
//    veces (empresas), pero es tráfico en la red de una línea no oficial, la que se expone a un baneo (lib/fotos-contacto.ts).

import { limpiarNombreEtiqueta } from './etiquetas-reglas';
import { ambitoDeSecuencia, leadEnAmbito } from './nutricion-ambito';
import { TRIGGER_ETAPA, etapasDe } from './nutricion-etapa';

/** Un grupo de la línea. `tamano`: cuántos son (null si no se sabe: los de la base no lo traen). */
export type GrupoWA = { jid: string; nombre: string; tamano: number | null };
/**
 * Un participante que se puede traer: su teléfono (sólo dígitos, con el código de país), su nombre si se conoce, y su `@lid`
 * (el alias interno de WhatsApp: con él la agenda de la línea guarda a muchos contactos, y por ahí también sale el nombre).
 */
export type ParticipanteWA = {
  telefono: string; nombre: string | null; lid?: string | null;
  /** Admin del grupo (Evolution: `admin: 'admin' | 'superadmin'`). «Ignorar admins» (Martín, 26/10/2026) los destilda. */
  admin?: boolean;
};

/** El tope para listar los grupos hablando con WhatsApp; pasado, los de la base de Evolution. */
export const TOPE_GRUPOS_MS = 15_000;
/**
 * ⚠️ LA LISTA COMPLETA TARDA MÁS QUE ESE TOPE (medido el 25/10/2026 en la línea de la plataforma, 285 grupos: `fetchAllGroups`
 * contestó en 33 s, y `findChats` en 0,5 s con sólo 61). Martín: «el cargar los grupos, tarda muchísimo». Con el tope de 15 s
 * la persona esperaba 15 s para terminar con 61 de 285. Ahora: al abrir, lo GUARDADO de la última vez (o, la primera vez, los
 * de la base, al instante), y la lista completa se pide APARTE, con este tope, y se guarda para la próxima.
 */
export const TOPE_GRUPOS_COMPLETO_MS = 50_000;
/** Pasado esto, la lista guardada se muestra igual pero se vuelve a pedir completa por detrás (un grupo nuevo aparece solo). */
export const VIEJA_GRUPOS_MS = 10 * 60_000;

/** La lista de grupos guardada de una línea (`app_settings`), leída como texto ajeno. null = no hay, o no se entiende. */
export function gruposGuardados(raw: string | null): { at: number; grupos: GrupoWA[] } | null {
  if (!raw) return null;
  let o: unknown;
  try { o = JSON.parse(raw); } catch { return null; }
  if (!o || typeof o !== 'object') return null;
  const x = o as { at?: unknown; grupos?: unknown };
  const at = typeof x.at === 'number' ? x.at : Date.parse(String(x.at ?? ''));
  if (!Number.isFinite(at) || !Array.isArray(x.grupos)) return null;
  const grupos = x.grupos.filter((g): g is GrupoWA => !!g && typeof g === 'object' && esJidDeGrupo((g as GrupoWA).jid) && typeof (g as GrupoWA).nombre === 'string')
    .map((g) => ({ jid: g.jid, nombre: g.nombre, tamano: typeof g.tamano === 'number' ? g.tamano : null }));
  return grupos.length ? { at, grupos } : null;
}
/** El tope para los participantes de UN grupo (medido: 0,4 s). */
export const TOPE_PARTICIPANTES_MS = 30_000;
/** De a cuántos los trae la pantalla: cada lead son varias lecturas y escrituras, y una acción del server tiene 60 s. */
export const TANDA_GRUPO = 40;

const JID_GRUPO = /^[0-9]+(-[0-9]+)?@g\.us$/;
/** ¿Es el id de un grupo? (Lo que llega del navegador se valida antes de ir a Evolution.) */
export const esJidDeGrupo = (s: unknown): s is string => typeof s === 'string' && JID_GRUPO.test(s);

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const porNombre = (a: GrupoWA, b: GrupoWA) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });

/** Los grupos de `fetchAllGroups`. Sin nombre, «Grupo sin nombre». Las comunidades (su «anuncios» sí es un grupo) se dejan. */
export function gruposDeFetchAll(json: unknown): GrupoWA[] {
  if (!Array.isArray(json)) return [];
  const out: GrupoWA[] = [];
  for (const g of json) {
    if (!g || typeof g !== 'object') continue;
    const o = g as Record<string, unknown>;
    if (!esJidDeGrupo(o.id) || o.isCommunity === true) continue;
    out.push({ jid: o.id, nombre: texto(o.subject) ?? 'Grupo sin nombre', tamano: typeof o.size === 'number' && o.size >= 0 ? o.size : null });
  }
  return out.sort(porNombre);
}

/** Los grupos de la base de Evolution (`findChats`): los que la línea tiene en sus chats, con el nombre que guardó. */
export function gruposDeChats(json: unknown): GrupoWA[] {
  if (!Array.isArray(json)) return [];
  const vistos = new Set<string>();
  const out: GrupoWA[] = [];
  for (const c of json) {
    if (!c || typeof c !== 'object') continue;
    const o = c as Record<string, unknown>;
    const jid = esJidDeGrupo(o.remoteJid) ? o.remoteJid : esJidDeGrupo(o.id) ? o.id : null;
    if (!jid || vistos.has(jid)) continue;
    vistos.add(jid);
    out.push({ jid, nombre: texto(o.pushName) ?? texto(o.name) ?? 'Grupo sin nombre', tamano: null });
  }
  return out.sort(porNombre);
}

/** El teléfono de un jid de persona (`549…@s.whatsapp.net`), en dígitos; null si no es uno (un `@lid`, un grupo). */
export function telefonoDeJid(jid: unknown): string | null {
  if (typeof jid !== 'string') return null;
  const m = /^(\d{8,15})(?::\d+)?@s\.whatsapp\.net$/.exec(jid.trim());
  return m ? m[1] : null;
}

/**
 * Los participantes que se pueden traer, sin repetidos y sin la línea misma (`propio`, el número conectado: no es un
 * contacto). `sinNumero`: los que WhatsApp no deja ver (sólo un `@lid`).
 */
export function participantesDe(json: unknown, propio?: string | null): { participantes: ParticipanteWA[]; sinNumero: number } {
  const lista = Array.isArray(json) ? json
    : json && typeof json === 'object' && Array.isArray((json as { participants?: unknown }).participants) ? (json as { participants: unknown[] }).participants
      : [];
  const propioDig = (propio ?? '').replace(/\D/g, '');
  const vistos = new Set<string>();
  const participantes: ParticipanteWA[] = [];
  let sinNumero = 0;
  for (const p of lista) {
    if (!p || typeof p !== 'object') continue;
    const o = p as Record<string, unknown>;
    const telefono = telefonoDeJid(o.phoneNumber) ?? telefonoDeJid(o.id) ?? telefonoDeJid(o.jid);
    if (!telefono) { sinNumero++; continue; }
    if (vistos.has(telefono) || (propioDig && telefono === propioDig)) continue;
    vistos.add(telefono);
    const lid = typeof o.id === 'string' && o.id.endsWith('@lid') ? o.id : typeof o.lid === 'string' && o.lid.endsWith('@lid') ? o.lid : null;
    const admin = o.admin === 'admin' || o.admin === 'superadmin' || o.admin === true;
    participantes.push({ telefono, nombre: nombreUtil(o.name) ?? nombreUtil(o.notify) ?? nombreUtil(o.pushName), lid, ...(admin ? { admin: true } : {}) });
  }
  return { participantes, sinNumero };
}

/**
 * Un nombre que sirve: texto con alguna letra (no un número, ni «.», ni un emoji solo), sin el «Você» que WhatsApp pone a la
 * línea misma (lib/evolution-contactos.ts), y con un tope de cordura.
 */
export function nombreUtil(v: unknown): string | null {
  const t = texto(v);
  if (!t || t === 'Você' || !/\p{L}/u.test(t)) return null;
  return t.slice(0, 80);
}

/** Los últimos 10 dígitos: así cruza un teléfono el resto del CRM (con o sin el 9 de Argentina o el 1 de México). */
const sufijo = (tel: string) => tel.replace(/\D/g, '').slice(-10);

/**
 * LOS NOMBRES QUE WHATSAPP YA CONOCE, sin preguntarle a la red: el que trae el listado, si no el de la agenda de la línea en
 * Evolution (por su teléfono o por su `@lid`), y si no el de nuestra tabla de contactos (por los últimos 10 dígitos). Copia.
 */
export function conNombresConocidos(
  participantes: readonly ParticipanteWA[],
  agenda: ReadonlyArray<{ remoteJid: string; nombre: string | null }>,
  guardados: ReadonlyMap<string, string>,
): ParticipanteWA[] {
  const porJid = new Map<string, string>();
  for (const c of agenda) { const n = nombreUtil(c.nombre); if (n && c.remoteJid && !porJid.has(c.remoteJid)) porJid.set(c.remoteJid, n); }
  return participantes.map((p) => ({
    ...p,
    nombre: p.nombre ?? porJid.get(`${p.telefono}@s.whatsapp.net`) ?? (p.lid ? porJid.get(p.lid) : undefined) ?? nombreUtil(guardados.get(sufijo(p.telefono))) ?? null,
  }));
}

/**
 * ¿Es un nombre DE RELLENO? Vacío, o sin ninguna letra: el número (así nace un traído de un grupo sin nombre, `+<teléfono>`),
 * un «.», un emoji solo. Es lo único que «Completar nombres» pisa: un nombre que escribió una persona no se toca nunca.
 */
export function esNombreDeRelleno(nombre: string | null | undefined): boolean {
  const n = (nombre ?? '').trim();
  return !n || !/\p{L}/u.test(n);
}

/**
 * La etiqueta de ORIGEN de los que se traen: EL NOMBRE DEL GRUPO, tal cual (Martín, 26/10/2026: «al agregarse al CRM siempre
 * con una etiqueta con el nombre del grupo donde vinieron. Con las etiquetas que ya existen... y tampoco quiero cambiar el
 * nombre del grupo, que se llame exactamente igual»). Hasta el 26/10 la pantalla la dejaba editar. Entra entera en el tope de
 * una etiqueta (`TOPE_NOMBRE_ETIQUETA`, 100 desde la mig 0338: el asunto de un grupo de WhatsApp llega a 100); sólo se le
 * sacan los espacios de más.
 */
export function etiquetaDeGrupo(nombre: string): string {
  return limpiarNombreEtiqueta(nombre) || 'Grupo de WhatsApp';
}

/** El funnel por defecto: el CRM «Prospección» si el negocio lo tiene (el de la base de venta); si no, el que se mira. */
export function funnelPorDefecto(funnels: ReadonlyArray<{ id: number; nombre: string }>, activo: number | null): number | null {
  return funnels.find((f) => /prospecci[oó]n/i.test(f.nombre))?.id ?? activo;
}

/** La etapa por defecto: «Tibio» si se puede usar (no manda nada); si no, la primera que no manda. */
export function etapaPorDefecto(etapas: ReadonlyArray<{ key: string; label: string; manda: boolean }>, entrada: string | null): string {
  return etapas.find((e) => !e.manda && /tibio/i.test(e.label))?.key ?? entrada ?? '';
}

// ── A qué etapa se pueden traer SIN mandarle nada a nadie ────────────────────────────────────────────────────────────
// Pedido: «No le manda NADA a nadie: sólo trae contactos». Y una etapa puede mandar sola, por dos caminos:
//   1. una automatización ACTIVA que cuelga de esa etapa (`etapa_actual`): la inscribe el movimiento y, aunque no, el BARRIDO
//      de la hora (`leadsDeCohorte`, lib/nutricion.ts) inscribe a todo lead abierto parado ahí con un hito de 90 días, y un
//      lead recién creado lo tiene. «Un Lead Entró» cuelga de la etapa de entrada: importar ahí era darle la bienvenida a
//      todo el grupo;
//   2. una etiqueta VINCULADA a la etapa (mig 0224): al caer ahí el lead la recibe (`espejarEtiquetasDeEtapa`), y poner una
//      etiqueta dispara las automatizaciones de esa etiqueta.
// Esas etapas no se ofrecen (y el servidor las rechaza). Moverlos después, a mano, sí dispara: es lo que quiere quien mueve.

/** Una vista de disparo de una automatización activa (`vistasPorDisparador`, lib/disparadores.ts): lo que hace falta. */
export type VistaDeEtapa = { trigger_tipo: string; etapa: string | null; etapas?: readonly string[] | null; funnel_id: number | string | null };
/** Una etiqueta del CRM con su vínculo a una etapa (`funnel_id` null = el funnel del negocio). */
export type EtiquetaDeEtapa = { etapa_key: string | null; funnel_id: number | string | null; archivada_at?: string | null };

/**
 * Las etapas del funnel `destino` donde caer manda algo. `esDefaultDe` dice si un funnel es el del negocio (null = no se
 * sabe: entonces la automatización se toma como de TODOS, que bloquea de más y nunca de menos).
 */
export function etapasQueDisparan(
  vistas: readonly VistaDeEtapa[], etiquetas: readonly EtiquetaDeEtapa[],
  destino: { id: number; esDefault: boolean }, esDefaultDe: (funnelId: number) => boolean | null,
): Set<string> {
  // El lead nuevo vive en el destino: con el del negocio, `funnel_id` NULL (como lo guarda `createLead`).
  const delLead = destino.esDefault ? null : destino.id;
  const out = new Set<string>();
  for (const v of vistas) {
    if (v.trigger_tipo !== TRIGGER_ETAPA) continue;
    const id = v.funnel_id == null || v.funnel_id === '' ? null : Number(v.funnel_id);
    const ambito = ambitoDeSecuencia(id, id == null ? null : esDefaultDe(id));
    if (leadEnAmbito(ambito, delLead)) for (const k of etapasDe(v)) out.add(k);
  }
  for (const e of etiquetas) {
    if (!e.etapa_key || e.archivada_at) continue;
    const id = e.funnel_id == null || e.funnel_id === '' ? null : Number(e.funnel_id);
    if ((id == null && destino.esDefault) || id === destino.id) out.add(e.etapa_key);
  }
  return out;
}

// ── El PERFIL DE EMPRESA de WhatsApp (24/10/2026) ───────────────────────────────────────────────────────────────────────
// Martín, con la ficha de un participante abierta en WhatsApp: «muchos no sólo tienen nombre, sino que incluso links». MEDIDO
// el 24/10/2026 en su línea (`POST /chat/fetchBusinessProfile/{inst}` { number }, ~0,6 s, 15 participantes del grupo de 221):
// 6 con cuenta de empresa. Siempre trae `category` (el rubro) y `business_hours`; a veces `website` (una LISTA), `email`,
// `address` y `description`. ⚠️ NUNCA el nombre del negocio (el que se ve en WhatsApp no viaja en esta respuesta). Y cada
// consulta es tráfico en la RED de una línea no oficial (lib/fotos-contacto.ts): se hace de a una y despacio.

/** Lo que sirve del perfil de empresa de un número. null = no es una cuenta de empresa (o no contestó). */
export type PerfilEmpresa = {
  rubro: string | null; descripcion: string | null; web: string | null; instagram: string | null; email: string | null; direccion: string | null;
  /** Las otras redes que no tienen columna en el lead («facebook: https://…»), leídas del perfil en WhatsApp Web (0.73.0). */
  redes?: string[];
};

/** La cuenta de Instagram de un link (`instagram.com/<usuario>`), sin las rutas que no son una cuenta. */
function instagramDe(s: string | null | undefined): string | null {
  const m = /instagram\.com\/([A-Za-z0-9._]{1,30})/i.exec(s ?? '');
  return m && !['p', 'reel', 'reels', 'stories', 'explore', 'tv'].includes(m[1].toLowerCase()) ? m[1] : null;
}

/** El perfil que contesta Evolution, leído. La web es la primera que no es Instagram, Facebook ni un link de WhatsApp. */
export function perfilDeEmpresa(json: unknown): PerfilEmpresa | null {
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  if (o.isBusiness !== true) return null;
  const sitios = (Array.isArray(o.website) ? o.website : [o.website]).map(texto).filter((s): s is string => !!s);
  const descripcion = texto(o.description);
  const email = texto(o.email);
  return {
    rubro: texto(o.category),
    descripcion: descripcion ? descripcion.slice(0, 300) : null,
    web: sitios.find((s) => !instagramDe(s) && !/facebook\.com|wa\.me|whatsapp\.com/i.test(s)) ?? null,
    instagram: sitios.map(instagramDe).find((x) => !!x) ?? instagramDe(descripcion),
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    direccion: texto(o.address),
  };
}

/** Los campos de contacto que el perfil puede completar (los del lead: lib/leads.ts). */
export const CAMPOS_DEL_PERFIL = ['web', 'instagram', 'email', 'direccion'] as const;
export type CampoDelPerfil = typeof CAMPOS_DEL_PERFIL[number];

/** Lo que se le escribe a un lead: SÓLO los campos vacíos que el perfil trae. Nunca pisa lo que escribió una persona. */
export function parcheDePerfil(lead: Partial<Record<CampoDelPerfil, string | null>>, p: PerfilEmpresa): Partial<Record<CampoDelPerfil, string>> {
  const out: Partial<Record<CampoDelPerfil, string>> = {};
  for (const k of CAMPOS_DEL_PERFIL) {
    const v = p[k];
    if (v && !(lead[k] ?? '').trim()) out[k] = v;
  }
  return out;
}

/** El renglón del historial con lo que no tiene columna: el rubro y la descripción. null si no trae ninguno. */
export function lineaDePerfil(p: PerfilEmpresa): string | null {
  const partes = [p.rubro, p.descripcion, ...(p.redes ?? [])].filter((x): x is string => !!x);
  return partes.length ? `Perfil de empresa en WhatsApp: ${partes.join(' · ')}` : null;
}

// ── Las fichas de SU WhatsApp Web, por la extensión de MaKo (24/10/2026) ───────────────────────────────────────────────
// Martín: «lo que yo te pido es con la extensión de MaKo... que se extraiga los nombres y la información pública». La
// extensión (extension/wa-fichas.js) lee lo que su WhatsApp Web ya guardó en su navegador —sin clics, sin red, sin marcar nada
// como leído— y devuelve, SÓLO de los teléfonos que MaKo le pidió, el nombre de su agenda, el que la persona se puso, el de su
// empresa si es una cuenta de empresa, y en qué grupos suyos está.

/** Una ficha como la manda la extensión. Viene del NAVEGADOR: entrada no confiable, se limpia con `fichaLimpia`. */
export type FichaWa = {
  telefono: string; agenda: string | null; pushname: string | null; empresa: string | null; esEmpresa: boolean; grupos: string[];
  /** Lo que dijo SU PERFIL al abrirlo en WhatsApp Web (0.73.0, «Extraer»): links, redes, correo. Limpio (`perfilLimpio`). */
  perfil?: PerfilEmpresa | null;
};

/**
 * El perfil que mandó el NAVEGADOR (no confiable): cada campo, un texto útil y con forma (la web un http(s), el correo un
 * correo, el Instagram una cuenta), y a lo sumo 6 redes. null si no queda nada: un perfil vacío no inventa datos.
 */
export function perfilLimpio(x: unknown): PerfilEmpresa | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const corto = (v: unknown, tope: number) => { const t = texto(v); return t && [...t].length <= tope ? t : null; };
  const web = corto(o.web, 300);
  const email = corto(o.email, 200);
  const instagram = corto(o.instagram, 30);
  const p: PerfilEmpresa = {
    rubro: corto(o.rubro, 120),
    descripcion: corto(o.descripcion, 600),
    web: web && /^https?:\/\/[^\s]+$/i.test(web) ? web : null,
    instagram: instagram && /^[A-Za-z0-9._]{1,30}$/.test(instagram) ? instagram : null,
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    direccion: corto(o.direccion, 300),
    redes: (Array.isArray(o.redes) ? o.redes : []).map((r) => corto(r, 300)).filter((r): r is string => !!r && /^[a-z]+: https?:\/\//.test(r)).slice(0, 6),
  };
  return p.rubro || p.descripcion || p.web || p.instagram || p.email || p.direccion || p.redes?.length ? p : null;
}

/** La ficha limpia: teléfono en dígitos, textos útiles y cortos, a lo sumo 50 grupos. null si no sirve. */
export function fichaLimpia(x: unknown): FichaWa | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const telefono = String(o.telefono ?? '').replace(/\D/g, '');
  if (telefono.length < 8 || telefono.length > 15) return null;
  const grupos = (Array.isArray(o.grupos) ? o.grupos : []).map((g) => texto(g)?.slice(0, 120) ?? null).filter((g): g is string => !!g).slice(0, 50);
  const perfil = perfilLimpio(o.perfil);
  return { telefono, agenda: nombreUtil(o.agenda), pushname: nombreUtil(o.pushname), empresa: nombreUtil(o.empresa), esEmpresa: o.esEmpresa === true, grupos, ...(perfil ? { perfil } : {}) };
}

/**
 * EL NOMBRE DE UNA FICHA: el de su agenda (como Martín lo llama), si no el de su empresa (el nombre grande de la ficha), si no
 * el que la persona se puso en WhatsApp. null si no hay ninguno.
 */
export function nombreDeFicha(f: FichaWa): string | null {
  return f.agenda ?? f.empresa ?? f.pushname ?? null;
}

// ── De qué grupo vino cada lead (25/10/2026, «Completar desde mi WhatsApp» del lote) ──────────────────────────────────────
// Martín: «Si ya sabe el nombre del grupo debería buscarlos dentro». El nombre queda en el historial del lead al traerlo
// (`traerDelGrupo`, app/crm/grupo-wa-server.ts): `«Formación de Jan», a «Prospección › Tibio»`.

/** El campo del historial que deja traer a alguien de un grupo. Lo escribe `traerDelGrupo` y lo lee el lote. */
export const EVENTO_TRAIDO_DE_GRUPO = 'Traído de un grupo de WhatsApp';

/** El grupo de ese evento; null si el texto no tiene esa forma. */
export function grupoDelEvento(valor: string | null | undefined): string | null {
  const m = /^«(.+?)», a «/.exec(String(valor ?? ''));
  const g = m ? m[1].trim().slice(0, 120) : '';
  return g || null;
}

/** Un nombre de grupo para comparar: la MISMA regla que la extensión (`asuntoComparable`, extension/wa-fichas-reglas.js). */
export function asuntoComparable(s: string | null | undefined): string {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** Los grupos de un lote, del que trajo más leads al que menos, a lo sumo `tope`. */
export function gruposDelLote(valores: ReadonlyArray<string | null | undefined>, tope = 5): string[] {
  const cuenta = new Map<string, { nombre: string; n: number }>();
  for (const v of valores) {
    const g = grupoDelEvento(v);
    if (!g) continue;
    const k = asuntoComparable(g);
    if (!k) continue;
    const prev = cuenta.get(k);
    cuenta.set(k, { nombre: prev?.nombre ?? g, n: (prev?.n ?? 0) + 1 });
  }
  return [...cuenta.values()].sort((a, b) => b.n - a.n).slice(0, tope).map((x) => x.nombre);
}

/** El renglón del historial con sus grupos en común (señal de interés). null si no está en ninguno. */
export function lineaDeGrupos(grupos: readonly string[]): string | null {
  if (!grupos.length) return null;
  const n = grupos.length;
  return `Está en ${n} ${n === 1 ? 'grupo tuyo' : 'grupos tuyos'} de WhatsApp: ${grupos.join(' · ')}`.slice(0, 600);
}

/** De a cuántas fichas manda la pantalla: cada una son unas pocas escrituras (~0,3 s), lejos de los 60 s de una acción. */
export const TANDA_FICHAS = 40;

// ── «Datos de empresa» con TOPE POR DÍA (24/10/2026, el Cerebro: «tope duro por corrida y por día; la cuenta real y el tiempo
// antes de arrancar») ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Cada consulta de perfil es tráfico en la RED de una línea no oficial (riesgo de baneo, docs/hallazgos-comunicacion.md).
// El cupo del día y los teléfonos ya consultados viven en `app_settings`, por línea (app/crm/grupo-wa-server.ts).
// ⚠️ SIN TOPE POR CORRIDA desde el 25/10/2026. Martín en la llamada con Leandro (24/10, f14): «no debería volver a tocar nada,
// o sea, debería extraerte todo». El de 40 por corrida sólo partía el trabajo en toques: lo que cuida la línea es la espera
// entre consultas (`ESPERA_PERFIL_MS`) y el tope del DÍA, que siguen. NO era por el costo de Apify (eso fue otra cosa, que se
// revirtió el 24/10): era por el baneo. Un toque consulta todo lo que falta hasta el tope del día.

/** Cuántos leads toma un lote de «Completar» del tablero: lo mismo que la extensión lee de una vez (extension/wa-fichas.js). */
export const TOPE_LOTE_COMPLETAR = 5000;

/** Cuántos por DÍA y por línea, sumando todas las corridas de todas las pantallas. Cuida la línea de un baneo. */
export const TOPE_PERFILES_DIA = 120;
/** Lo que tarda cada consulta, medido: ~0,6 s de respuesta más la espera de 2 s entre una y otra. */
export const SEGUNDOS_POR_PERFIL = 2.6;
/** Cuántos teléfonos ya consultados se recuerdan por línea (los más viejos se olvidan y se pueden volver a consultar). */
export const TOPE_VISTOS = 5000;

export type CupoPerfiles = { dia: string; usadas: number };

/** El cupo de HOY, del valor guardado. De otro día, o ilegible, arranca en cero (nunca tira). */
export function cupoDeHoy(raw: string | null, hoy: string): CupoPerfiles {
  try {
    const o = JSON.parse(raw ?? 'null') as { dia?: unknown; usadas?: unknown } | null;
    if (o && o.dia === hoy && Number.isInteger(o.usadas) && (o.usadas as number) >= 0) return { dia: hoy, usadas: o.usadas as number };
  } catch { /* ilegible: cero */ }
  return { dia: hoy, usadas: 0 };
}

/** Las consultas que quedan hoy. */
export function quedanHoy(c: CupoPerfiles): number {
  return Math.max(0, TOPE_PERFILES_DIA - c.usadas);
}

/** Los últimos 10 dígitos de los teléfonos ya consultados en esta línea (los que contestaron: el que no, es «no sé»). */
export function vistosDe(raw: string | null): Set<string> {
  try {
    const a = JSON.parse(raw ?? '[]') as unknown;
    return new Set(Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string' && /^\d{8,10}$/.test(x)) : []);
  } catch { return new Set(); }
}

/** Lo guardado más los nuevos, sin repetir, recortado a los `TOPE_VISTOS` más recientes (los nuevos, al final). */
export function vistosConNuevos(raw: string | null, nuevos: readonly string[]): string {
  const todos = [...vistosDe(raw)].filter((x) => !nuevos.includes(x)).concat([...new Set(nuevos)]);
  return JSON.stringify(todos.slice(-TOPE_VISTOS));
}

/** Cuántos consulta ESTA corrida: todo lo que falta, hasta lo que queda hoy (sin tope por corrida desde el 25/10, f14). */
export function cuantosEstaCorrida(p: { pendientes: number; quedanHoy: number }): number {
  return Math.max(0, Math.min(p.pendientes, p.quedanHoy));
}

/** Los minutos que se le dicen a la persona antes de arrancar (redondeado para arriba: mejor que sobre a que falte). */
export function minutosDePerfiles(n: number): number {
  return Math.max(1, Math.ceil((n * SEGUNDOS_POR_PERFIL) / 60));
}
