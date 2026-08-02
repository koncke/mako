// =============================================================================
// mako-grupo — el grupo de WhatsApp "MaKo <> {cliente}" por workspace
// =============================================================================
// Cada cliente tiene UN grupo de WhatsApp donde MaKo deja recordatorios, el
// pulso y las alertas. Convención de nombre SIEMPRE: "MaKo <> {Nombre del
// cliente}". El JID del grupo se guarda en app_settings (key mako.grupo_jid) por
// workspace, para que el ruteo de avisos sepa a dónde mandar.
//
// VOZ de MaKo: la instancia de Evolution desde la que MaKo habla (grupos +
// avisos). Se resuelve en runtime con instanciaVoz() (setting mako.voz.instancia):
// hoy por defecto es el número de Martín en ws1, y al conectar el canal propio de
// SuperAdmin (mako_superadmin) por QR se cambia a esa línea dedicada. El cliente
// es un participante más del grupo, así que a él sí le NOTIFICA.

import 'server-only';
import sharp from 'sharp';
import { getSetting, setSetting } from './settings';
import { runWithWorkspace, OWNER_WS } from './workspace';

const BASE = (process.env.EVOLUTION_BASE_URL || '').replace(/\/$/, '');
const KEY = process.env.EVOLUTION_API_KEY || '';

/** Instancia de Evolution que le pone la voz a MaKo por defecto (número de Martín
 *  cargado en ws1). El canal propio de SuperAdmin (mako_superadmin) la reemplaza
 *  al conectarse por QR — se elige en runtime con la setting mako.voz.instancia. */
export const INSTANCIA_VOZ_DEFAULT = 'mako_ws1';
export const KEY_VOZ_INSTANCIA = 'mako.voz.instancia';

/** Instancia que MaKo usa para hablar (grupos + avisos). Configurable en runtime. */
export async function instanciaVoz(): Promise<string> {
  return runWithWorkspace(OWNER_WS, async () => (await getSetting(KEY_VOZ_INSTANCIA)) || INSTANCIA_VOZ_DEFAULT);
}
/** Fija qué instancia usa la voz de MaKo (ej. al conectar el canal SuperAdmin). */
export async function setInstanciaVoz(instancia: string): Promise<void> {
  await runWithWorkspace(OWNER_WS, () => setSetting(KEY_VOZ_INSTANCIA, instancia));
}

/** Key de app_settings donde vive el JID del grupo de cada workspace (cliente). */
export const KEY_GRUPO_JID = 'mako.grupo_jid';
/** Número del dueño del cliente (destinatario del grupo), por workspace. */
export const KEY_NUMERO_DUENO = 'mako.numero_dueno';
/** JID del grupo de SuperAdmin (global, guardado en OWNER_WS). */
export const KEY_GRUPO_SUPERADMIN = 'mako.superadmin.grupo_jid';

export function grupoConfigurado(): boolean {
  return !!BASE && !!KEY;
}

// La estrella de MaKo (SPARK sobre badge oscuro) — mismo vector que
// app/_components/MakoBrand.tsx. NO usar /public/mako.svg (logo viejo).
//   'gold' → grupos con clientes (marca dorada de MaKo).
//   'blue' → grupo del SuperAdmin (azul de acción #2F6FED, para distinguirlo).
const SPARK = 'M0 -11 C1 -4 4 -1 11 0 C4 1 1 4 0 11 C-1 4 -4 1 -11 0 C-4 -1 -1 -4 0 -11 Z';
export type VarianteEstrella = 'gold' | 'blue';
const PALETA: Record<VarianteEstrella, { a: string; b: string; glow: string }> = {
  gold: { a: '#F6D365', b: '#EF9F27', glow: '#EF9F27' },
  blue: { a: '#6BA0FF', b: '#2F6FED', glow: '#2F6FED' },
};
function estrellaSvg(v: VarianteEstrella): string {
  const p = PALETA[v];
  return `<svg width="640" height="640" viewBox="0 0 640 640" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#2A251C"/><stop offset="100%" stop-color="#171511"/></linearGradient>
    <linearGradient id="spark" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${p.a}"/><stop offset="100%" stop-color="${p.b}"/></linearGradient>
    <radialGradient id="glow" cx="50%" cy="46%" r="52%"><stop offset="0%" stop-color="${p.glow}" stop-opacity="0.38"/><stop offset="62%" stop-color="${p.glow}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="640" height="640" fill="url(#bg)"/>
  <rect width="640" height="640" fill="url(#glow)"/>
  <g transform="translate(320 320) scale(19)"><path d="${SPARK}" fill="url(#spark)"/></g>
</svg>`;
}

const estrellaCache: Partial<Record<VarianteEstrella, string>> = {};
/** La estrella de MaKo como base64 CRUDO de PNG (sin prefijo data:). Cacheada por variante. */
async function estrellaPngBase64(v: VarianteEstrella = 'gold'): Promise<string> {
  if (estrellaCache[v]) return estrellaCache[v]!;
  const png = await sharp(Buffer.from(estrellaSvg(v))).png().toBuffer();
  estrellaCache[v] = png.toString('base64');
  return estrellaCache[v]!;
}

export function descripcionGrupoMaKo(nombreCliente: string): string {
  const quien = nombreCliente?.trim() ? ` con ${nombreCliente.trim()}` : '';
  return (
    `Soy MaKo, tu copiloto de marketing${quien}. Acá te dejo los recordatorios de ` +
    `reuniones, el pulso del día, las alertas y todo lo que necesites saber para no ` +
    `perderte nada. Escribime cuando quieras.`
  );
}

/** Mensaje de bienvenida que MaKo manda al crear el grupo de un cliente. */
export function mensajeBienvenidaMaKo(nombreCliente: string): string {
  const quien = nombreCliente?.trim() ? `, ${nombreCliente.trim().split(/\s+/)[0]}` : '';
  return (
    `¡Hola${quien}! 🌟 Soy MaKo, tu copiloto de marketing. Desde este grupo te voy a ` +
    `dejar los recordatorios de tus reuniones, el pulso del día, las alertas de tus ` +
    `anuncios y todo lo importante para que no se te escape nada. Cuando te avise algo, ` +
    `me podés responder acá mismo. ¡Arrancamos! 🚀`
  );
}

const DESC_SUPERADMIN =
  'Panel del dueño de la agencia. Acá MaKo te resume el estado de todos tus clientes, ' +
  'te avisa lo urgente (semáforo en rojo, cuotas, fatiga de ads) y te deja tus pendientes. ' +
  'Es tu vista de comando: lo importante de toda la operación, en un solo lugar.';

// ── Fetch mínimo a Evolution (self-contained: usa la instancia de voz de MaKo,
//    no la del request, así que no depende de wsEstricto) ─────────────────────
type EvOut = { ok: boolean; status: number; body: unknown };
async function ev(path: string, init?: RequestInit): Promise<EvOut> {
  if (!grupoConfigurado()) return { ok: false, status: 0, body: 'Evolution no configurado' };
  try {
    const r = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { apikey: KEY, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });
    const txt = await r.text();
    let body: unknown = txt;
    try { body = txt ? JSON.parse(txt) : {}; } catch { /* deja texto */ }
    return { ok: r.ok, status: r.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: e instanceof Error ? e.message : String(e) };
  }
}

const soloDigitos = (s: string) => (s || '').replace(/\D/g, '');
// Extrae el JID de grupo (…@g.us) de las varias formas que devuelve Evolution.
function extraerJid(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const cand = b.id ?? b.groupJid ?? b.jid ?? (b.key as Record<string, unknown> | undefined)?.remoteJid;
  return typeof cand === 'string' && cand.includes('@g.us') ? cand : null;
}

// ── JID del grupo por workspace (app_settings) ───────────────────────────────
export async function getGrupoJidMaKo(ws: number): Promise<string | null> {
  return runWithWorkspace(ws, () => getSetting(KEY_GRUPO_JID));
}
async function guardarGrupoJid(ws: number, jid: string): Promise<void> {
  await runWithWorkspace(ws, () => setSetting(KEY_GRUPO_JID, jid));
}

// ── Retoques de un grupo existente (best-effort) ─────────────────────────────
async function ponerFoto(jid: string, v: VarianteEstrella = 'gold'): Promise<void> {
  const image = await estrellaPngBase64(v);
  await ev(`/group/updateGroupPicture/${await instanciaVoz()}?groupJid=${encodeURIComponent(jid)}`, {
    method: 'POST', body: JSON.stringify({ image }),
  });
}
// Envía texto a un JID (grupo o número) por la voz de MaKo. Best-effort.
// delayMs: override del "escribiendo…" (default = anti-ban proporcional al texto).
async function enviarTextoVozMaKo(jidONumero: string, texto: string, delayMs?: number): Promise<{ ok: boolean; id: string }> {
  const delay = delayMs ?? Math.round(Math.min(1500 + texto.length * 45, 9000) * (0.8 + Math.random() * 0.4));
  const r = await ev(`/message/sendText/${await instanciaVoz()}`, {
    method: 'POST', body: JSON.stringify({ number: jidONumero, text: texto, delay }),
  });
  const id = (r.body as { key?: { id?: string } })?.key?.id ?? '';
  return { ok: r.ok, id };
}
async function ponerNombre(jid: string, subject: string): Promise<void> {
  await ev(`/group/updateGroupSubject/${await instanciaVoz()}?groupJid=${encodeURIComponent(jid)}`, {
    method: 'POST', body: JSON.stringify({ subject }),
  });
}
async function ponerDescripcion(jid: string, description: string): Promise<void> {
  await ev(`/group/updateGroupDescription/${await instanciaVoz()}?groupJid=${encodeURIComponent(jid)}`, {
    method: 'POST', body: JSON.stringify({ description }),
  });
}

export type AsegurarResult =
  | { ok: true; jid: string; creado: boolean }
  | { ok: false; error: string };

/**
 * Deja listo el grupo "MaKo <> {nombre}" del workspace: lo crea si no existe (o
 * adopta uno ya creado), le pone la estrella + descripción, y guarda el JID.
 * Idempotente: si ya hay JID guardado (o `adoptarJid`), solo refresca marca.
 *   participantes: números del cliente a sumar (la voz de MaKo ya es el creador).
 */
export async function asegurarGrupoMaKo(
  ws: number,
  opts: { nombre: string; participantes?: string[]; adoptarJid?: string; bienvenida?: boolean },
): Promise<AsegurarResult> {
  if (!grupoConfigurado()) return { ok: false, error: 'Evolution no configurado' };
  const subject = `MaKo <> ${opts.nombre.trim()}`;
  const desc = descripcionGrupoMaKo(opts.nombre);

  let jid = opts.adoptarJid?.trim() || (await getGrupoJidMaKo(ws));

  if (jid) {
    // Ya existe → refrescar marca (nombre + foto + descripción), best-effort.
    await ponerNombre(jid, subject);
    await ponerDescripcion(jid, desc);
    await ponerFoto(jid);
    await guardarGrupoJid(ws, jid);
    return { ok: true, jid, creado: false };
  }

  // Crear el grupo desde la voz de MaKo.
  const participants = (opts.participantes ?? []).map(soloDigitos).filter(Boolean);
  const r = await ev(`/group/create/${await instanciaVoz()}`, {
    method: 'POST',
    body: JSON.stringify({ subject, description: desc, participants }),
  });
  if (!r.ok) return { ok: false, error: `Evolution ${r.status}: ${typeof r.body === 'string' ? r.body : JSON.stringify(r.body).slice(0, 200)}` };
  jid = extraerJid(r.body);
  if (!jid) return { ok: false, error: 'grupo creado pero sin JID en la respuesta' };
  await ponerFoto(jid, 'gold');
  await guardarGrupoJid(ws, jid);
  // Mensaje de bienvenida (best-effort: no rompe si el envío falla).
  if (opts.bienvenida !== false) await enviarTextoVozMaKo(jid, mensajeBienvenidaMaKo(opts.nombre));
  return { ok: true, jid, creado: true };
}

/** Agrega un número al grupo de MaKo del workspace (cambio de número del dueño). */
export async function agregarParticipanteGrupo(ws: number, numero: string): Promise<{ ok: boolean; error?: string }> {
  const num = soloDigitos(numero);
  if (!num) return { ok: false, error: 'número inválido' };
  const jid = await getGrupoJidMaKo(ws);
  if (!jid) return { ok: false, error: 'el workspace no tiene grupo todavía' };
  const r = await ev(`/group/updateParticipant/${await instanciaVoz()}?groupJid=${encodeURIComponent(jid)}`, {
    method: 'POST', body: JSON.stringify({ action: 'add', participants: [num] }),
  });
  return r.ok ? { ok: true } : { ok: false, error: `Evolution ${r.status}` };
}

// ── Número del dueño por workspace (destinatario del grupo) ───────────────────
export async function getNumeroDueno(ws: number): Promise<string | null> {
  return runWithWorkspace(ws, () => getSetting(KEY_NUMERO_DUENO));
}
async function guardarNumeroDueno(ws: number, numero: string): Promise<void> {
  await runWithWorkspace(ws, () => setSetting(KEY_NUMERO_DUENO, numero));
}

/**
 * Setea/cambia el número del dueño de un workspace y sincroniza el grupo:
 *   · sin grupo aún  → crea el grupo "MaKo <> {cliente}" con ese número + bienvenida.
 *   · grupo ya hecho → agrega el nuevo número al grupo (no recrea).
 * Guarda el número en app_settings. Devuelve qué hizo.
 */
export async function setNumeroDuenoYSync(
  ws: number, numero: string, nombreCliente: string,
): Promise<{ ok: true; accion: 'grupo_creado' | 'numero_agregado' | 'sin_cambios'; jid?: string } | { ok: false; error: string }> {
  const num = soloDigitos(numero);
  if (!num) return { ok: false, error: 'número inválido' };
  const anterior = soloDigitos((await getNumeroDueno(ws)) ?? '');
  await guardarNumeroDueno(ws, num);

  const jid = await getGrupoJidMaKo(ws);
  if (!jid) {
    const r = await asegurarGrupoMaKo(ws, { nombre: nombreCliente, participantes: [num] });
    return r.ok ? { ok: true, accion: 'grupo_creado', jid: r.jid } : { ok: false, error: r.error };
  }
  if (num !== anterior) {
    const a = await agregarParticipanteGrupo(ws, num);
    return a.ok ? { ok: true, accion: 'numero_agregado', jid } : { ok: false, error: a.error ?? 'no se pudo agregar' };
  }
  return { ok: true, accion: 'sin_cambios', jid };
}

// ── Verificación del teléfono de reportes (código por WhatsApp) ──────────────
// El onboarding no deja pasar a conectar Meta sin que el dueño confirme que ESE
// número recibe de verdad los mensajes de MaKo: se le manda un código de 6
// dígitos al grupo recién creado/sincronizado y tiene que cargarlo de vuelta.
const KEY_VERIFICACION = 'mako.contacto.verificacion';
const MINUTOS_EXPIRA_CODIGO = 15;
type EstadoVerificacion = { telefono: string; codigo: string; expira: number; verificado: boolean };

async function getVerificacion(ws: number): Promise<EstadoVerificacion | null> {
  const raw = await runWithWorkspace(ws, () => getSetting(KEY_VERIFICACION));
  if (!raw) return null;
  try { return JSON.parse(raw) as EstadoVerificacion; } catch { return null; }
}
async function guardarVerificacion(ws: number, v: EstadoVerificacion): Promise<void> {
  await runWithWorkspace(ws, () => setSetting(KEY_VERIFICACION, JSON.stringify(v)));
}

/** Estado actual (para hidratar el wizard: si ya está verificado no hay que re-pedir). */
export async function getEstadoVerificacionContacto(ws: number): Promise<{ telefono: string; verificado: boolean }> {
  const v = await getVerificacion(ws);
  return v ? { telefono: v.telefono, verificado: v.verificado } : { telefono: '', verificado: false };
}

/**
 * Sincroniza el grupo de MaKo con este número (crea/agrega, vía setNumeroDuenoYSync)
 * y le manda un código de 6 dígitos para verificarlo. Si el número YA está
 * verificado (revisita de la pantalla con el mismo teléfono), no reenvía nada.
 */
export async function enviarCodigoVerificacion(
  ws: number, telefono: string, nombreCliente: string,
): Promise<{ ok: true; yaVerificado: boolean } | { ok: false; error: string }> {
  const num = soloDigitos(telefono);
  if (!num) return { ok: false, error: 'El número no es válido.' };

  const actual = await getVerificacion(ws);
  if (actual?.verificado && soloDigitos(actual.telefono) === num) return { ok: true, yaVerificado: true };

  const sync = await setNumeroDuenoYSync(ws, telefono, nombreCliente);
  if (!sync.ok) return { ok: false, error: `No se pudo preparar tu grupo de WhatsApp: ${sync.error}` };

  const codigo = String(Math.floor(100000 + Math.random() * 900000));
  await guardarVerificacion(ws, { telefono: num, codigo, expira: Date.now() + MINUTOS_EXPIRA_CODIGO * 60_000, verificado: false });

  const mensaje = `Tu código de verificación de MaKo es *${codigo}*. Vence en ${MINUTOS_EXPIRA_CODIGO} minutos — introdúcelo en la configuración para confirmar este número.`;
  const envio = await enviarAlGrupoMaKo(ws, mensaje);
  if (!envio.ok) return { ok: false, error: `No se pudo enviar el código por WhatsApp: ${envio.error}` };
  return { ok: true, yaVerificado: false };
}

/** Compara el código cargado contra el vigente; marca verificado si coincide y no venció. */
export async function verificarCodigoContacto(ws: number, codigo: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const v = await getVerificacion(ws);
  if (!v) return { ok: false, error: 'Todavía no se envió ningún código.' };
  if (Date.now() > v.expira) return { ok: false, error: 'El código expiró. Solicita uno nuevo.' };
  if (codigo.trim() !== v.codigo) return { ok: false, error: 'El código no coincide.' };
  await guardarVerificacion(ws, { ...v, verificado: true });
  return { ok: true };
}

// ── Grupo del SuperAdmin (global, estrella AZUL) ──────────────────────────────
export async function getGrupoSuperAdminJid(): Promise<string | null> {
  return runWithWorkspace(OWNER_WS, () => getSetting(KEY_GRUPO_SUPERADMIN));
}
async function guardarGrupoSuperAdmin(jid: string): Promise<void> {
  await runWithWorkspace(OWNER_WS, () => setSetting(KEY_GRUPO_SUPERADMIN, jid));
}

/** Deja listo el grupo del SuperAdmin: nombre + estrella AZUL + descripción + JID. */
export async function asegurarGrupoSuperAdmin(
  opts: { nombre?: string; adoptarJid?: string } = {},
): Promise<AsegurarResult> {
  if (!grupoConfigurado()) return { ok: false, error: 'Evolution no configurado' };
  const subject = opts.nombre?.trim() || 'MaKo · SuperAdmin';
  const jid = opts.adoptarJid?.trim() || (await getGrupoSuperAdminJid());
  if (!jid) return { ok: false, error: 'no hay grupo de SuperAdmin para adoptar (pasá adoptarJid)' };
  await ponerNombre(jid, subject);
  await ponerDescripcion(jid, DESC_SUPERADMIN);
  await ponerFoto(jid, 'blue');
  await guardarGrupoSuperAdmin(jid);
  return { ok: true, jid, creado: false };
}

/** Manda un texto al grupo del SuperAdmin. */
export async function enviarAlGrupoSuperAdmin(texto: string): Promise<EnvioGrupo> {
  if (!texto.trim()) return { ok: false, error: 'texto vacío' };
  const jid = await getGrupoSuperAdminJid();
  if (!jid) return { ok: false, error: 'no hay grupo de SuperAdmin todavía' };
  const r = await enviarTextoVozMaKo(jid, texto);
  return r.ok ? { ok: true, id: r.id } : { ok: false, error: 'no se pudo enviar' };
}

// ── Grupo suelto (pruebas): crear sin persistir + postear a un JID cualquiera ──
/** Crea un grupo (estrella dorada) SIN guardarlo como grupo de ningún workspace. */
export async function crearGrupoSuelto(
  subject: string, participantes: string[], descripcion?: string,
): Promise<{ ok: true; jid: string } | { ok: false; error: string }> {
  if (!grupoConfigurado()) return { ok: false, error: 'Evolution no configurado' };
  const participants = (participantes ?? []).map(soloDigitos).filter(Boolean);
  const r = await ev(`/group/create/${await instanciaVoz()}`, {
    method: 'POST', body: JSON.stringify({ subject, description: descripcion ?? '', participants }),
  });
  if (!r.ok) return { ok: false, error: `Evolution ${r.status}: ${typeof r.body === 'string' ? r.body : JSON.stringify(r.body).slice(0, 200)}` };
  const jid = extraerJid(r.body);
  if (!jid) return { ok: false, error: 'grupo creado pero sin JID en la respuesta' };
  await ponerFoto(jid, 'gold');
  return { ok: true, jid };
}

/**
 * Manda un texto a UNA PERSONA (su número), con la voz de MaKo. Se usa para pasarle a
 * un colaborador las tareas que asumió en una reunión: le llega de MaKo, no del número
 * de ventas del negocio.
 */
export async function enviarAPersonaMaKo(telefono: string, texto: string): Promise<EnvioGrupo> {
  const num = soloDigitos(telefono);
  if (!num) return { ok: false, error: 'teléfono inválido' };
  if (!texto.trim()) return { ok: false, error: 'texto vacío' };
  const r = await enviarTextoVozMaKo(num, texto);
  return r.ok ? { ok: true, id: r.id } : { ok: false, error: 'no se pudo enviar' };
}

/** Manda un texto a un JID de grupo cualquiera. delayMs opcional (demo = chico). */
export async function enviarAGrupoJid(jid: string, texto: string, delayMs?: number): Promise<EnvioGrupo> {
  if (!jid || !texto.trim()) return { ok: false, error: 'faltan jid o texto' };
  const r = await enviarTextoVozMaKo(jid, texto, delayMs);
  return r.ok ? { ok: true, id: r.id } : { ok: false, error: 'no se pudo enviar' };
}

export type EnvioGrupo = { ok: true; id: string } | { ok: false; error: string };

/** Saca el mensaje útil del body de error de Evolution (viene anidado y variado). */
function detalleEv(body: unknown): string {
  if (typeof body === 'string') return body.slice(0, 200);
  const b = (body ?? {}) as { response?: { message?: unknown }; message?: unknown; error?: unknown };
  const m = b.response?.message ?? b.message ?? b.error ?? body;
  const txt = Array.isArray(m) ? m.join(' · ') : typeof m === 'string' ? m : JSON.stringify(m);
  return (txt || 'sin detalle').slice(0, 200);
}

/** Manda un texto al grupo de MaKo del workspace (para el ruteo de avisos). */
export async function enviarAlGrupoMaKo(ws: number, texto: string): Promise<EnvioGrupo> {
  if (!texto.trim()) return { ok: false, error: 'texto vacío' };
  const jid = await getGrupoJidMaKo(ws);
  if (!jid) return { ok: false, error: 'el workspace no tiene grupo de MaKo todavía' };
  const delay = Math.round(Math.min(1500 + texto.length * 45, 9000) * (0.8 + Math.random() * 0.4));
  const instancia = await instanciaVoz();
  const r = await ev(`/message/sendText/${instancia}`, {
    method: 'POST', body: JSON.stringify({ number: jid, text: texto, delay }),
  });
  // El motivo, no solo el número: un 400 acá casi siempre es "la sesión de esa
  // instancia está caída" y con "Evolution 400" a secas eso no se deduce.
  if (!r.ok) return { ok: false, error: `Evolution ${r.status} en ${instancia}: ${detalleEv(r.body)}` };
  const id = (r.body as { key?: { id?: string } })?.key?.id ?? '';
  return { ok: true, id };
}
