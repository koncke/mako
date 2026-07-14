// =============================================================================
// mako-grupo — el grupo de WhatsApp "MaKo <> {cliente}" por workspace
// =============================================================================
// Cada cliente tiene UN grupo de WhatsApp donde MaKo deja recordatorios, el
// pulso y las alertas. Convención de nombre SIEMPRE: "MaKo <> {Nombre del
// cliente}". El JID del grupo se guarda en app_settings (key mako.grupo_jid) por
// workspace, para que el ruteo de avisos sepa a dónde mandar.
//
// VOZ de MaKo: por decisión de Martín (jul-2026), MaKo habla desde SU número
// (Martin Koncke) para todos los clientes — no hay línea dedicada todavía. Ese
// número es la instancia INSTANCIA_VOZ_MAKO. El cliente es un participante más
// del grupo, así que a él sí le NOTIFICA (no es su propio número). El día que
// MaKo tenga su línea propia, se cambia esta constante por esa instancia.

import 'server-only';
import sharp from 'sharp';
import { getSetting, setSetting } from './settings';
import { runWithWorkspace } from './workspace';

const BASE = (process.env.EVOLUTION_BASE_URL || '').replace(/\/$/, '');
const KEY = process.env.EVOLUTION_API_KEY || '';

/** Instancia de Evolution que le pone la voz a MaKo (hoy = el número de Martín). */
export const INSTANCIA_VOZ_MAKO = 'mako_ws1';

/** Key de app_settings donde vive el JID del grupo de cada workspace. */
export const KEY_GRUPO_JID = 'mako.grupo_jid';

export function grupoConfigurado(): boolean {
  return !!BASE && !!KEY;
}

// La estrella de MaKo (SPARK dorada sobre badge oscuro) — mismo vector que
// app/_components/MakoBrand.tsx. NO usar /public/mako.svg (logo viejo).
const SPARK = 'M0 -11 C1 -4 4 -1 11 0 C4 1 1 4 0 11 C-1 4 -4 1 -11 0 C-4 -1 -1 -4 0 -11 Z';
const ESTRELLA_SVG = `<svg width="640" height="640" viewBox="0 0 640 640" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#2A251C"/><stop offset="100%" stop-color="#171511"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#F6D365"/><stop offset="100%" stop-color="#EF9F27"/></linearGradient>
    <radialGradient id="glow" cx="50%" cy="46%" r="52%"><stop offset="0%" stop-color="#EF9F27" stop-opacity="0.38"/><stop offset="62%" stop-color="#EF9F27" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="640" height="640" fill="url(#bg)"/>
  <rect width="640" height="640" fill="url(#glow)"/>
  <g transform="translate(320 320) scale(19)"><path d="${SPARK}" fill="url(#gold)"/></g>
</svg>`;

let estrellaCache: string | null = null;
/** La estrella de MaKo como base64 CRUDO de PNG (sin prefijo data:). Cacheada. */
async function estrellaPngBase64(): Promise<string> {
  if (estrellaCache) return estrellaCache;
  const png = await sharp(Buffer.from(ESTRELLA_SVG)).png().toBuffer();
  estrellaCache = png.toString('base64');
  return estrellaCache;
}

export function descripcionGrupoMaKo(nombreCliente: string): string {
  const quien = nombreCliente?.trim() ? ` con ${nombreCliente.trim()}` : '';
  return (
    `Soy MaKo, tu copiloto de marketing${quien}. Acá te dejo los recordatorios de ` +
    `reuniones, el pulso del día, las alertas y todo lo que necesites saber para no ` +
    `perderte nada. Escribime cuando quieras.`
  );
}

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
async function ponerFoto(jid: string): Promise<void> {
  const image = await estrellaPngBase64();
  await ev(`/group/updateGroupPicture/${INSTANCIA_VOZ_MAKO}?groupJid=${encodeURIComponent(jid)}`, {
    method: 'POST', body: JSON.stringify({ image }),
  });
}
async function ponerNombre(jid: string, subject: string): Promise<void> {
  await ev(`/group/updateGroupSubject/${INSTANCIA_VOZ_MAKO}?groupJid=${encodeURIComponent(jid)}`, {
    method: 'POST', body: JSON.stringify({ subject }),
  });
}
async function ponerDescripcion(jid: string, description: string): Promise<void> {
  await ev(`/group/updateGroupDescription/${INSTANCIA_VOZ_MAKO}?groupJid=${encodeURIComponent(jid)}`, {
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
  opts: { nombre: string; participantes?: string[]; adoptarJid?: string },
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
  const r = await ev(`/group/create/${INSTANCIA_VOZ_MAKO}`, {
    method: 'POST',
    body: JSON.stringify({ subject, description: desc, participants }),
  });
  if (!r.ok) return { ok: false, error: `Evolution ${r.status}: ${typeof r.body === 'string' ? r.body : JSON.stringify(r.body).slice(0, 200)}` };
  jid = extraerJid(r.body);
  if (!jid) return { ok: false, error: 'grupo creado pero sin JID en la respuesta' };
  await ponerFoto(jid);
  await guardarGrupoJid(ws, jid);
  return { ok: true, jid, creado: true };
}

export type EnvioGrupo = { ok: true; id: string } | { ok: false; error: string };

/** Manda un texto al grupo de MaKo del workspace (para el ruteo de avisos). */
export async function enviarAlGrupoMaKo(ws: number, texto: string): Promise<EnvioGrupo> {
  if (!texto.trim()) return { ok: false, error: 'texto vacío' };
  const jid = await getGrupoJidMaKo(ws);
  if (!jid) return { ok: false, error: 'el workspace no tiene grupo de MaKo todavía' };
  const delay = Math.round(Math.min(1500 + texto.length * 45, 9000) * (0.8 + Math.random() * 0.4));
  const r = await ev(`/message/sendText/${INSTANCIA_VOZ_MAKO}`, {
    method: 'POST', body: JSON.stringify({ number: jid, text: texto, delay }),
  });
  if (!r.ok) return { ok: false, error: `Evolution ${r.status}` };
  const id = (r.body as { key?: { id?: string } })?.key?.id ?? '';
  return { ok: true, id };
}
