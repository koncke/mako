// =============================================================================
// grabadores/zoom — Zoom (grabaciones en la nube) en la forma común (developers.zoom.us, API v2)
// =============================================================================
// Se conecta con una app «Server-to-Server OAuth» que el negocio crea en el Marketplace de Zoom (Account ID, Client ID y
// Client Secret): el token sale de POST zoom.us/oauth/token y dura 1 hora, sin refresh (se pide otro). Scopes:
// cloud_recording:read:list_user_recordings, cloud_recording:read:list_recording_files, meeting:read:summary,
// meeting:read:list_past_participants.
// · El listado va por rango de FECHAS de a un mes como máximo (`from`/`to`, AAAA-MM-DD): sin fechas devuelve sólo hoy.
// · La transcripción es un ARCHIVO VTT (recording_files con file_type TRANSCRIPT) que se baja con el token.
// · El correo de un participante de AFUERA viene vacío (lo dice su doc): el CRM no puede matchear la llamada por email.
// =============================================================================

import 'server-only';
import { credDelCliente } from '../credenciales';
import { getWorkspaceActual } from '../workspace';
import { pedirAlGrabador } from './http';
import { deZoom, turnosDeVtt } from './formas';
import { GrabadorSinConectarError, GrabadorSinRespuestaError } from './errores';
import type { Lector } from './lector';
import type { Reunion, TurnoReunion } from './reunion';

const API = 'https://api.zoom.us/v2';
const ESPERA_TRANSCRIPCION_MS = 24 * 3600_000;

type Credenciales = { cuenta: string; id: string; secreto: string };

async function credenciales(): Promise<Credenciales> {
  const [cuenta, id, secreto] = await Promise.all(['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'].map((k) => credDelCliente(k)));
  if (!cuenta || !id || !secreto) throw new GrabadorSinConectarError('zoom', 'Faltan ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID o ZOOM_CLIENT_SECRET');
  return { cuenta, id, secreto };
}

/**
 * El token de la app S2S. ⚠️ La caché en memoria es de TODOS los negocios del proceso (AGENTS.md): va por negocio Y por
 * Client ID, así un token nunca se le sirve a otro negocio ni sobrevive a que cambien la app.
 */
const gTokens = globalThis as typeof globalThis & { __makoTokensZoom?: Map<string, { token: string; vence: number }> };
const tokens = (gTokens.__makoTokensZoom ??= new Map());

export async function tokenZoom(c: Credenciales, ws: number | null): Promise<string> {
  const k = `${ws ?? '-'}:${c.id}`;
  const ya = tokens.get(k);
  if (ya && ya.vence > Date.now() + 60_000) return ya.token;
  const r = await pedirAlGrabador<{ access_token?: string; expires_in?: number; reason?: string }>({
    grabador: 'zoom',
    url: `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(c.cuenta)}`,
    init: { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${c.id}:${c.secreto}`).toString('base64')}` } },
    // Medido el 26/10/2026: credenciales malas = 400 «Invalid client_id or client_secret».
    esAuth: (status) => status === 400 || status === 401,
  });
  if (!r?.access_token) throw new Error('Zoom 401 en /oauth/token: no devolvió el token');
  tokens.set(k, { token: r.access_token, vence: Date.now() + (r.expires_in ?? 3600) * 1000 });
  return r.access_token;
}

async function conToken() { return tokenZoom(await credenciales(), await getWorkspaceActual().catch(() => null)); }

async function get<T>(ruta: string, json = true): Promise<T> {
  const token = await conToken();
  const url = ruta.startsWith('http') ? ruta : `${API}${ruta}`;
  return pedirAlGrabador<T>({ grabador: 'zoom', url, json, init: { headers: { Authorization: `Bearer ${token}` } } });
}

/** El UUID de una reunión va DOBLE-codificado si empieza con «/» o tiene «//» (su doc). */
const uuidEnRuta = (uuid: string): string => (uuid.startsWith('/') || uuid.includes('//') ? encodeURIComponent(encodeURIComponent(uuid)) : encodeURIComponent(uuid));

const dia = (t: number): string => new Date(t).toISOString().slice(0, 10);
type PaginaZoom = { meetings?: Array<Record<string, unknown>>; next_page_token?: string };

async function unaVentana(from: string, to: string, limite: number, cursor: string | null): Promise<{ reuniones: Reunion[]; cursor: string | null }> {
  const q = new URLSearchParams({ from, to, page_size: String(Math.min(300, Math.max(1, limite))) });
  if (cursor) q.set('next_page_token', cursor);
  const r = await get<PaginaZoom>(`/users/me/recordings?${q}`);
  if (!Array.isArray(r?.meetings)) throw new Error('Zoom devolvió una lista que MaKo no conoce');
  return { reuniones: r.meetings.map((m) => deZoom(m)).filter((x) => x.id), cursor: r.next_page_token || null };
}

const DIA_MS = 86_400_000;
/** Hasta dónde para atrás se mira sin una ventana pedida (el selector del Plan, «cargar más»). */
const HISTORIA_MS = 180 * DIA_MS;

async function transcripcion(uuid: string, inicio: string | null): Promise<TurnoReunion[]> {
  const r = await get<{ recording_files?: Array<Record<string, unknown>> }>(`/meetings/${uuidEnRuta(uuid)}/recordings`);
  const archivo = (r?.recording_files ?? []).find((f) => f.file_type === 'TRANSCRIPT' && f.status !== 'processing');
  if (!archivo || typeof archivo.download_url !== 'string') {
    // Sin transcripción: en una reunión reciente es que todavía no está (se reintenta); en una vieja, que no hay.
    if (!inicio || Date.now() - Date.parse(inicio) < ESPERA_TRANSCRIPCION_MS) throw new GrabadorSinRespuestaError('zoom', `Zoom todavía no tiene la transcripción de ${uuid}`);
    return [];
  }
  return turnosDeVtt(await get<string>(archivo.download_url, false));
}

export const lectorZoom: Lector = {
  grabador: 'zoom',

  /**
   * El cursor es «desde|hasta|token»: la ventana de fechas que se está leyendo (de a un mes, el máximo de Zoom) y su
   * página. Las fechas viajan en el cursor porque el `next_page_token` vale para ESA consulta y no para otra. Sin `desde`
   * se mira hasta seis meses para atrás, de a un mes por página.
   */
  async listar({ desde, limite, cursor }) {
    const ahora = Date.now();
    const piso = desde ? Date.parse(desde) : ahora - HISTORIA_MS;
    let [from, to, token] = (cursor ?? '').split('|');
    if (!from || !to) { to = dia(ahora); from = dia(Math.max(piso, ahora - 29 * DIA_MS)); token = ''; }
    const p = await unaVentana(from, to, limite ?? 15, token || null);
    let sigue: string | null = null;
    if (p.cursor) sigue = `${from}|${to}|${p.cursor}`;
    else if (Date.parse(from) > piso) {
      const to2 = Date.parse(from) - DIA_MS;
      sigue = `${dia(Math.max(piso, to2 - 29 * DIA_MS))}|${dia(to2)}|`;
    }
    return { reuniones: p.reuniones, cursor: sigue };
  },

  /** Seis meses para atrás, de a un mes (el máximo que Zoom deja pedir de una vez). */
  async listarTodas({ maxPaginas } = {}) {
    const out: Reunion[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < (maxPaginas ?? 40); i++) {
      const p = await this.listar({ limite: 300, cursor });
      out.push(...p.reuniones);
      cursor = p.cursor;
      if (!cursor) break;
    }
    return out;
  },

  async leer(id, meta) {
    const base = meta ?? deZoom(await get<Record<string, unknown>>(`/meetings/${uuidEnRuta(id)}/recordings`));
    const [turnos, resumen, participantes] = await Promise.all([
      transcripcion(id, base.inicio),
      // El resumen de AI Companion es opcional (pide su plan y que esté prendido): sin él, se sigue.
      get<{ summary_content?: string }>(`/meetings/${uuidEnRuta(id)}/meeting_summary`).then((r) => r?.summary_content?.trim() || null).catch(() => null),
      get<{ participants?: Array<Record<string, unknown>> }>(`/past_meetings/${uuidEnRuta(id)}/participants?page_size=300`).then((r) => r?.participants ?? []).catch(() => [] as Array<Record<string, unknown>>),
    ]);
    const conGente = participantes.length ? deZoom({ uuid: id, topic: base.titulo, start_time: base.inicio, host_email: base.anfitrion?.email }, participantes).invitados : base.invitados;
    return { ...base, invitados: conGente, transcripcion: turnos, resumen };
  },

  async leerTranscripcion(id) {
    return transcripcion(id, null);
  },

  async meta(id) {
    const [m, participantes] = await Promise.all([
      get<Record<string, unknown>>(`/meetings/${uuidEnRuta(id)}/recordings`),
      get<{ participants?: Array<Record<string, unknown>> }>(`/past_meetings/${uuidEnRuta(id)}/participants?page_size=300`).then((r) => r?.participants ?? []).catch(() => [] as Array<Record<string, unknown>>),
    ]);
    return deZoom(m, participantes);
  },
};
