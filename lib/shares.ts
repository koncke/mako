// =============================================================================
// Compartir por link, estilo Google Drive — mecanismo genérico y reusable
// =============================================================================
// Nace para "Branding MaKo" (recurso='branding') pero no sabe nada de branding:
// mañana se reusa para una Retro o un reporte. Por eso vive acá y no en
// lib/branding.ts.
//
// DOS MODOS, como Drive:
//   'link'      → cualquiera con el enlace entra.
//   'invitados' → el link del share NO alcanza; solo sirven los links
//                 personales que recibió cada invitado por mail.
//
// REGLAS DE SEGURIDAD (las 5 que sostienen todo esto):
//  1. Del token se guarda SOLO el sha256. Un dump de la base no entrega los
//     links vivos, y por eso el link se muestra una única vez.
//  2. Cada request revalida contra la FILA VIVA (revocado_at / expira_at). Sin
//     caché: revocar tiene que cortar el acceso al instante.
//  3. Fail-closed: cualquier duda devuelve null, y el que llama responde 404.
//  4. `puedeVer` es el ÚNICO punto de autorización, y lo usan TANTO la página
//     como el endpoint de archivos. Si solo lo usara la página, cualquiera
//     pediría por id un archivo fuera del alcance (IDOR).
//  5. Un share NO es una identidad: no emite cookie ni sesión. Es una fila en
//     base y una validación en la ruta.
//
// ⚠️ `shares` NO está en TENANT_TABLES a propósito (ver mig 0098): la
// resolución token→workspace es cross-workspace por diseño.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { getSupabaseServer } from './supabase';

export type ShareAlcance = 'todo' | 'seccion' | 'grupo' | 'item';
export type ShareModo = 'link' | 'invitados';
/** Qué se puede HACER dentro de lo que el alcance ya deja ver (mig 0126). */
export type SharePermiso = 'ver' | 'editar';

export type Share = {
  id: number;
  workspace_id: number;
  recurso: string;
  alcance: ShareAlcance;
  recurso_id: string | null;
  modo: ShareModo;
  /** Ausente en filas viejas. `permisoDe()` lo lee: nunca se usa crudo. */
  permiso?: SharePermiso | null;
  etiqueta: string | null;
  expira_at: string | null;
  revocado_at: string | null;
};

export type Invitado = {
  id: number; share_id: number; email: string; nombre: string | null; token_prefijo: string;
  enviado_at: string | null; visitas: number; ultima_visita: string | null; revocado_at: string | null;
};

/** Resultado de resolver un token: el share + quién es (si vino por invitación). */
export type Acceso = { share: Share; invitado: Invitado | null };

const hash = (t: string) => createHash('sha256').update(t).digest('hex');
/** 256 bits de aleatoriedad real. NUNCA derivado/determinista: eso no se puede
 *  revocar de a uno sin romper todos los links a la vez. */
export function nuevoToken(): string { return randomBytes(32).toString('base64url'); }
export const prefijoDe = (t: string) => t.slice(0, 8);

function vigente(row: { revocado_at: string | null; expira_at?: string | null }): boolean {
  if (row.revocado_at) return false;
  if (row.expira_at && new Date(row.expira_at).getTime() < Date.now()) return false;
  return true;
}

// ── Resolver un token entrante (lo llama la ruta pública) ───────────────────
/** Devuelve el acceso si el token es válido AHORA, o null. Fail-closed.
 *  Acepta tanto el token de un share 'link' como el token personal de un invitado. */
export async function resolverToken(token: string): Promise<Acceso | null> {
  if (!token || token.length < 20 || token.length > 200) return null;
  const sb = getSupabaseServer();
  const h = hash(token);

  // 1. ¿Es el token personal de un invitado?
  const inv = await sb.from('share_invitados')
    .select('id,share_id,email,nombre,token_prefijo,enviado_at,visitas,ultima_visita,revocado_at,token_hash')
    .eq('token_hash', h).maybeSingle();
  if (inv.data) {
    if (!vigente(inv.data)) return null;
    const s = await sb.from('shares')
      .select('id,workspace_id,recurso,alcance,recurso_id,modo,permiso,etiqueta,expira_at,revocado_at')
      .eq('id', inv.data.share_id).maybeSingle();
    if (!s.data || !vigente(s.data)) return null;
    return { share: s.data as Share, invitado: inv.data as Invitado };
  }

  // 2. ¿Es el token del share? Solo vale si el modo es 'link'.
  const s = await sb.from('shares')
    .select('id,workspace_id,recurso,alcance,recurso_id,modo,permiso,etiqueta,expira_at,revocado_at,token_hash')
    .eq('token_hash', h).maybeSingle();
  if (!s.data || !vigente(s.data)) return null;
  if ((s.data as Share).modo !== 'link') return null;   // es de invitados: el link solo no entra
  return { share: s.data as Share, invitado: null };
}

/** Comparación en tiempo constante, por si en algún flujo se compara a mano. */
export function mismoToken(a: string, b: string): boolean {
  const x = Buffer.from(hash(a), 'hex'), y = Buffer.from(hash(b), 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}

// ── EL punto de autorización ────────────────────────────────────────────────
/** ¿Este share alcanza para ver esta pieza? Lo usan la página Y el endpoint de
 *  archivos: si solo lo usara la página, se podría pedir cualquier id por URL. */
export function puedeVer(share: Share, asset: { id: string; seccion: string; grupo: string }): boolean {
  switch (share.alcance) {
    case 'todo': return true;
    case 'seccion': return !!share.recurso_id && asset.seccion === share.recurso_id;
    case 'grupo': return !!share.recurso_id && asset.grupo === share.recurso_id;
    case 'item': return !!share.recurso_id && asset.id === share.recurso_id;
    default: return false;                                  // alcance desconocido = no
  }
}

/** Filtra una lista entera con la misma regla. */
export function filtrarPorShare<T extends { id: string; seccion: string; grupo: string }>(share: Share, assets: T[]): T[] {
  return assets.filter((a) => puedeVer(share, a));
}

// ── El punto de autorización de ESCRITURA ───────────────────────────────────
// Mismo criterio que `puedeVer`: uno solo, y lo llaman TODOS los que escriben.
// Si lo llamara la página y no el endpoint, cualquiera mandaría un POST con otro
// id y escribiría sobre datos ajenos — el IDOR que `puedeVer` ya cerró del lado
// de la lectura.

/** El permiso efectivo. Una fila vieja, un valor desconocido o un null son
 *  'ver': lo que no se declaró explícitamente NO escribe. */
export function permisoDe(share: Share): SharePermiso {
  return share.permiso === 'editar' ? 'editar' : 'ver';
}

/**
 * ¿Este share alcanza para ESCRIBIR este recurso concreto?
 *
 * Escrito en POSITIVO a propósito (AGENTS.md → «Un guard sobre algo destructivo
 * se escribe en POSITIVO»): enumera las cuatro condiciones que tienen que darse
 * TODAS, en vez de listar qué se prohíbe. Un recurso nuevo que nadie contempló
 * no entra solo; hay que agregarlo acá a mano, que es exactamente lo que se
 * quiere.
 *
 * Las cuatro:
 *   1. el share declara permiso 'editar';
 *   2. es del recurso que se está escribiendo;
 *   3. su alcance es 'item' — nunca 'todo', 'seccion' ni 'grupo': un link que
 *      escribe tiene que apuntar a UNA cosa, no a una familia;
 *   4. el id del share es EXACTAMENTE el que se quiere escribir.
 */
export function puedeEditar(share: Share, recurso: string, recursoId: string): boolean {
  if (permisoDe(share) !== 'editar') return false;
  if (share.recurso !== recurso) return false;
  if (share.alcance !== 'item') return false;
  if (!share.recurso_id) return false;
  return share.recurso_id === recursoId;
}

// ── Administración (solo desde el panel, con guard de super-admin) ───────────
export async function crearShare(input: {
  ws: number; recurso: string; alcance: ShareAlcance; recursoId: string | null;
  modo: ShareModo; permiso?: SharePermiso; etiqueta?: string | null; expiraAt?: string | null; creadoPor?: string | null;
}): Promise<{ id: number; token: string }> {
  // Escribir se pide EXPLÍCITO. Sin el campo, el share es de lectura, igual que
  // los cientos que ya existen. Y 'editar' solo tiene sentido con alcance
  // 'item': un link que escribe apunta a UNA cosa (ver `puedeEditar`), así que
  // pedirlo con cualquier otro alcance es un error de programación, no una
  // configuración rara que valga la pena tolerar.
  const permiso: SharePermiso = input.permiso === 'editar' ? 'editar' : 'ver';
  if (permiso === 'editar' && (input.alcance !== 'item' || !input.recursoId)) {
    throw new Error('Un share que edita tiene que apuntar a un item concreto (alcance "item" + recursoId).');
  }
  const token = nuevoToken();
  const { data, error } = await getSupabaseServer().from('shares').insert({
    workspace_id: input.ws, recurso: input.recurso, alcance: input.alcance, recurso_id: input.recursoId,
    modo: input.modo, permiso, etiqueta: input.etiqueta ?? null, expira_at: input.expiraAt ?? null,
    token_hash: hash(token), token_prefijo: prefijoDe(token), creado_por: input.creadoPor ?? null,
  }).select('id').single();
  if (error) throw new Error(error.message);
  return { id: data.id as number, token };            // el token se devuelve UNA sola vez
}

/** Un share PROPIO del workspace, o null. Lo usa todo lo que recibe un id por
 *  request: sin este chequeo se podrían tocar invitados de otro inquilino (IDOR). */
export async function getShare(ws: number, id: number): Promise<Share | null> {
  const { data } = await getSupabaseServer().from('shares')
    .select('id,workspace_id,recurso,alcance,recurso_id,modo,permiso,etiqueta,expira_at,revocado_at')
    .eq('workspace_id', ws).eq('id', id).maybeSingle();
  return (data as Share) ?? null;
}

export async function listarShares(ws: number, recurso: string) {
  const { data, error } = await getSupabaseServer().from('shares')
    .select('id,recurso,alcance,recurso_id,modo,permiso,etiqueta,token_prefijo,expira_at,revocado_at,visitas,ultima_visita,created_at')
    .eq('workspace_id', ws).eq('recurso', recurso).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function revocarShare(ws: number, id: number): Promise<void> {
  const { error } = await getSupabaseServer().from('shares')
    .update({ revocado_at: new Date().toISOString() }).eq('workspace_id', ws).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Suma la visita. Best-effort: si falla, no rompe el acceso. */
export async function registrarVisita(acceso: Acceso): Promise<void> {
  const sb = getSupabaseServer(), ahora = new Date().toISOString();
  try {
    if (acceso.invitado) {
      await sb.from('share_invitados')
        .update({ visitas: acceso.invitado.visitas + 1, ultima_visita: ahora })
        .eq('id', acceso.invitado.id);
    }
    // Leer-y-sumar: puede perder alguna visita si dos entran en el mismo
    // instante, y está bien — es un contador para mostrar, no una métrica dura.
    const { data } = await sb.from('shares').select('visitas').eq('id', acceso.share.id).maybeSingle();
    await sb.from('shares')
      .update({ visitas: ((data?.visitas as number) ?? 0) + 1, ultima_visita: ahora })
      .eq('id', acceso.share.id);
  } catch { /* ídem */ }
}

// ── Invitados ───────────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const emailValido = (e: string) => EMAIL_RE.test(e.trim());

export type Destinatario = { nombre: string | null; email: string };

/** Parsea un renglón escrito a mano: `Martín Tejado <martin@gmail.com>` o
 *  `martin@gmail.com` a secas. Devuelve null si el email no es válido — quien
 *  llama decide si eso es un error o simplemente se saltea. */
export function parseDestinatario(raw: string): Destinatario | null {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  const m = t.match(/^(.*?)\s*<\s*([^<>\s]+)\s*>$/);
  const email = (m ? m[2] : t).trim().toLowerCase();
  if (!emailValido(email)) return null;
  const nombre = m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
  return { nombre: nombre || null, email };
}

/** Parte una lista escrita a mano en destinatarios. Corta por coma, punto y coma
 *  o salto de línea — NUNCA por espacio: `Martín Tejado <m@x.com>` es UN renglón. */
export function parseDestinatarios(raw: string): { ok: Destinatario[]; malos: string[] } {
  const ok: Destinatario[] = [], malos: string[] = [];
  for (const parte of String(raw ?? '').split(/[,;\n]+/)) {
    const t = parte.trim();
    if (!t) continue;
    const d = parseDestinatario(t);
    if (d) ok.push(d); else malos.push(t);
  }
  return { ok, malos };
}

/** Crea el invitado y devuelve SU token personal (para mandarlo por mail). */
export async function agregarInvitado(shareId: number, email: string, nombre?: string | null): Promise<{ id: number; token: string }> {
  const limpio = email.trim().toLowerCase();
  if (!emailValido(limpio)) throw new Error('email inválido');
  const token = nuevoToken();
  const { data, error } = await getSupabaseServer().from('share_invitados').insert({
    share_id: shareId, email: limpio, nombre: nombre?.trim() || null,
    token_hash: hash(token), token_prefijo: prefijoDe(token),
  }).select('id').single();
  // El índice único (share_id, lower(email)) hace que reinvitar sea un error de
  // base y no un duplicado silencioso. Lo traducimos a algo legible.
  if (error) throw new Error(/duplicate key|unique/i.test(error.message) ? 'ya está invitado a este enlace' : error.message);
  return { id: data.id as number, token };
}

export async function listarInvitados(shareId: number): Promise<Invitado[]> {
  const { data, error } = await getSupabaseServer().from('share_invitados')
    .select('id,share_id,email,nombre,token_prefijo,enviado_at,visitas,ultima_visita,revocado_at')
    .eq('share_id', shareId).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Invitado[];
}

/** Le da a un invitado un token NUEVO y devuelve el link, o null si no es de
 *  este workspace. Es la única forma de recuperar el acceso de alguien: del
 *  token viejo solo hay un sha256, así que "mostrámelo de nuevo" no existe —
 *  se emite otro. Efecto buscado: el link anterior deja de servir en el acto.
 *  Sirve para dos cosas: pasar el link a mano cuando el mail no sale, y rotarlo
 *  si se filtró. */
export async function regenerarTokenInvitado(ws: number, id: number): Promise<string | null> {
  const sb = getSupabaseServer();
  const { data } = await sb.from('share_invitados').select('id,share_id,revocado_at').eq('id', id).maybeSingle();
  if (!data || data.revocado_at) return null;                 // revocado no se resucita por acá
  const share = await getShare(ws, data.share_id as number);
  if (!share || !vigente(share)) return null;
  const token = nuevoToken();
  const { error } = await sb.from('share_invitados')
    .update({ token_hash: hash(token), token_prefijo: prefijoDe(token) }).eq('id', id);
  if (error) throw new Error(error.message);
  return token;
}

/** Revoca un invitado, verificando ANTES que su share sea de este workspace.
 *  Sin el join contra `shares` alcanzaría con adivinar un id para cortarle el
 *  acceso a alguien de otro inquilino. */
export async function revocarInvitado(ws: number, id: number): Promise<boolean> {
  const sb = getSupabaseServer();
  const { data } = await sb.from('share_invitados').select('id,share_id').eq('id', id).maybeSingle();
  if (!data) return false;
  if (!(await getShare(ws, data.share_id as number))) return false;
  const { error } = await sb.from('share_invitados')
    .update({ revocado_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

export async function marcarEnviado(id: number): Promise<void> {
  await getSupabaseServer().from('share_invitados').update({ enviado_at: new Date().toISOString() }).eq('id', id).then(() => {}, () => {});
}
