// =============================================================================
// Evolution API — WhatsApp NO oficial (número por QR, texto libre)
// =============================================================================
// Cuenta única de MaKo (env EVOLUTION_BASE_URL / EVOLUTION_API_KEY), UNA
// instancia por workspace (instance_name = 'mako_ws<id>'). El estado y el
// mapeo instancia↔workspace viven en evolution_instancias; el QR se pide en
// vivo (efímero). Contrato verificado contra Evolution v2.3.7.
//
// Reglas del PDF: a leads calientes NUNCA se dispara automático (F2.3, cola de
// borradores). Acá viven el cliente HTTP, la conexión (QR) y los helpers.

import 'server-only';
import { getTenantDb, getWorkspaceActual } from '@/lib/workspace';

// Workspace del request, ESTRICTO: si es null (admin de agencia sin impersonar)
// cortamos — nunca operar sobre la instancia del dueño por un fallback silencioso.
async function wsEstricto(): Promise<number> {
  const ws = await getWorkspaceActual();
  if (ws == null) throw new Error('Seleccioná un cliente (impersoná un workspace) para conectar su WhatsApp.');
  return ws;
}

const BASE = (process.env.EVOLUTION_BASE_URL || '').replace(/\/$/, '');
const KEY = process.env.EVOLUTION_API_KEY || '';
// URL base del dashboard para el webhook (Evolution → nuestra app). En prod es
// el dominio de Vercel; en local el webhook no llega (se usa polling de estado).
const APP_BASE_URL = (process.env.APP_BASE_URL || 'https://dashboard-marketing-six.vercel.app').replace(/\/$/, '');
const WEBHOOK_SECRET = process.env.EVOLUTION_WEBHOOK_SECRET || '';

export function evolutionConfigurado(): boolean {
  return !!BASE && !!KEY;
}

// instance_name estable por workspace. Único en la cuenta de Evolution.
export function instanceNameDeWs(ws: number): string {
  return `mako_ws${ws}`;
}

export type EstadoConexion = 'desconectado' | 'conectando' | 'conectado' | 'error';

type EvResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

async function evFetch<T = unknown>(path: string, init?: RequestInit): Promise<EvResult<T>> {
  if (!evolutionConfigurado()) return { ok: false, error: 'Evolution no configurado', status: 0 };
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { apikey: KEY, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      cache: 'no-store',
      // Tope de 30s: cubre el 'delay' de tipeo de sendText (~≤11s) y evita que
      // un Evolution colgado bloquee el cron hasta el maxDuration.
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    let body: unknown = text;
    try { body = text ? JSON.parse(text) : {}; } catch { /* deja texto */ }
    if (!res.ok) {
      const msg = typeof body === 'object' && body && 'message' in body
        ? JSON.stringify((body as { message: unknown }).message)
        : (typeof body === 'string' ? body.slice(0, 200) : `Evolution ${res.status}`);
      return { ok: false, error: msg, status: res.status };
    }
    return { ok: true, data: body as T };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), status: 0 };
  }
}

// ── URL del webhook para una instancia ────────────────────────────────────────
function webhookUrl(): string {
  const qs = WEBHOOK_SECRET ? `?secret=${encodeURIComponent(WEBHOOK_SECRET)}` : '';
  return `${APP_BASE_URL}/api/webhooks/evolution${qs}`;
}

// Eventos que nos importan (F2.1: conexión + QR; F2.2 sumará mensajes).
const EVENTOS_WEBHOOK = ['QRCODE_UPDATED', 'CONNECTION_UPDATE', 'MESSAGES_UPSERT'];

// Configura (best-effort) el webhook de la instancia hacia nuestra app. No es
// fatal: el webhook solo da tiempo real en prod; la UI igual pollea el estado.
// Sin secret configurado NO registramos el webhook (registraría un endpoint sin
// auth end-to-end; con el fail-closed del route, además, esos eventos darían 401).
async function setWebhook(instance: string): Promise<void> {
  if (!WEBHOOK_SECRET) return;
  await evFetch(`/webhook/set/${encodeURIComponent(instance)}`, {
    method: 'POST',
    body: JSON.stringify({
      webhook: { enabled: true, url: webhookUrl(), byEvents: false, base64: true, events: EVENTOS_WEBHOOK },
    }),
  });
}

// Ajustes anti-baneo / de comportamiento humano (PDF): no leer recibos de forma
// automática, ignorar grupos, no forzar "en línea" siempre.
async function setSettings(instance: string): Promise<void> {
  await evFetch(`/settings/set/${encodeURIComponent(instance)}`, {
    method: 'POST',
    body: JSON.stringify({
      rejectCall: false, msgCall: '', groupsIgnore: true,
      alwaysOnline: false, readMessages: false, readStatus: false, syncFullHistory: false,
    }),
  });
}

// ── Tipos de respuesta que consumimos ────────────────────────────────────────
export type QrData = { base64: string | null; code: string | null; pairingCode: string | null };

type CreateResp = {
  instance?: { instanceName?: string; instanceId?: string; status?: string };
  qrcode?: { base64?: string; code?: string; pairingCode?: string | null };
};
type ConnectResp = { base64?: string; code?: string; pairingCode?: string | null; instance?: unknown; count?: number };
type StateResp = { instance?: { instanceName?: string; state?: string } };

function mapEstado(state: string | undefined): EstadoConexion {
  switch ((state ?? '').toLowerCase()) {
    case 'open': return 'conectado';
    case 'connecting': return 'conectando';
    case 'close': case 'closed': return 'desconectado';
    default: return 'desconectado';
  }
}

// ── Fila de la instancia del workspace (DB) ──────────────────────────────────
export type InstanciaRow = {
  id: number; instance_name: string; instance_id: string | null;
  estado: EstadoConexion; numero: string | null; perfil_nombre: string | null;
  ultima_conexion_at: string | null;
};

export async function getInstanciaRow(): Promise<InstanciaRow | null> {
  const supabase = await getTenantDb();
  const { data } = await supabase
    .from('evolution_instancias')
    .select('id, instance_name, instance_id, estado, numero, perfil_nombre, ultima_conexion_at')
    .maybeSingle();
  return (data as InstanciaRow | null) ?? null;
}

async function upsertInstancia(patch: Record<string, unknown>): Promise<void> {
  const ws = await wsEstricto();
  const supabase = await getTenantDb();
  const name = instanceNameDeWs(ws);
  // getTenantDb estampa workspace_id; onConflict por workspace_id (único).
  await supabase.from('evolution_instancias').upsert(
    { instance_name: name, updated_at: new Date().toISOString(), ...patch },
    { onConflict: 'workspace_id' },
  );
}

// ── Acciones de conexión ─────────────────────────────────────────────────────

// Crea (si no existe) la instancia del workspace y devuelve el QR para escanear.
// Idempotente: si ya existe, pide un QR nuevo con /instance/connect.
export async function conectar(): Promise<{ ok: true; qr: QrData; estado: EstadoConexion } | { ok: false; error: string }> {
  const ws = await wsEstricto();
  const instance = instanceNameDeWs(ws);

  // ¿Ya existe en Evolution? Matcheamos por NOMBRE exacto (no length>0): si una
  // versión ignorara el filtro y devolviera todas, no adoptamos la equivocada.
  const existe = await evFetch<Array<Record<string, unknown>>>(`/instance/fetchInstances?instanceName=${encodeURIComponent(instance)}`);
  const yaExiste = existe.ok && Array.isArray(existe.data)
    && existe.data.some((i) => (i.name ?? i.instanceName) === instance);

  if (!yaExiste) {
    const r = await evFetch<CreateResp>('/instance/create', {
      method: 'POST',
      body: JSON.stringify({ instanceName: instance, integration: 'WHATSAPP-BAILEYS', qrcode: true }),
    });
    if (!r.ok) return { ok: false, error: r.error };
    // Config best-effort (no fatal).
    await setWebhook(instance);
    await setSettings(instance);
    await upsertInstancia({ instance_id: r.data.instance?.instanceId ?? null, estado: 'conectando' });
    return {
      ok: true,
      estado: 'conectando',
      qr: { base64: r.data.qrcode?.base64 ?? null, code: r.data.qrcode?.code ?? null, pairingCode: r.data.qrcode?.pairingCode ?? null },
    };
  }

  // Ya existe → pedir un QR fresco (re-vincular).
  await setWebhook(instance);
  const c = await evFetch<ConnectResp>(`/instance/connect/${encodeURIComponent(instance)}`);
  if (!c.ok) return { ok: false, error: c.error };
  await upsertInstancia({ estado: 'conectando' });
  return {
    ok: true,
    estado: 'conectando',
    qr: { base64: c.data.base64 ?? null, code: c.data.code ?? null, pairingCode: c.data.pairingCode ?? null },
  };
}

// Estado en vivo (para el polling de la UI). Reconcilia la fila en DB.
export async function estadoEnVivo(): Promise<{ estado: EstadoConexion; numero: string | null; perfil: string | null }> {
  const ws = await wsEstricto();
  const instance = instanceNameDeWs(ws);
  const r = await evFetch<StateResp>(`/instance/connectionState/${encodeURIComponent(instance)}`);
  if (!r.ok) {
    // 404 = instancia no creada aún → desconectado (sin ruido).
    if (r.status === 404) return { estado: 'desconectado', numero: null, perfil: null };
    return { estado: 'error', numero: null, perfil: null };
  }
  const estado = mapEstado(r.data.instance?.state);
  let numero: string | null = null;
  let perfil: string | null = null;
  if (estado === 'conectado') {
    // Traer el número/perfil conectado desde fetchInstances.
    const info = await evFetch<Array<Record<string, unknown>>>(`/instance/fetchInstances?instanceName=${encodeURIComponent(instance)}`);
    if (info.ok && Array.isArray(info.data) && info.data[0]) {
      const it = info.data[0];
      numero = jidToNumero((it.ownerJid as string) || (it.owner as string) || (it.number as string) || null);
      perfil = (it.profileName as string) || (it.profilePicName as string) || null;
    }
  }
  await upsertInstancia({
    estado,
    ...(numero ? { numero } : {}),
    ...(perfil ? { perfil_nombre: perfil } : {}),
    ...(estado === 'conectado' ? { ultima_conexion_at: new Date().toISOString() } : {}),
  });
  return { estado, numero, perfil };
}

// Refresca el QR (nuevo código) sin recrear la instancia.
export async function refrescarQr(): Promise<{ ok: true; qr: QrData } | { ok: false; error: string }> {
  const ws = await wsEstricto();
  const instance = instanceNameDeWs(ws);
  const c = await evFetch<ConnectResp>(`/instance/connect/${encodeURIComponent(instance)}`);
  if (!c.ok) return { ok: false, error: c.error };
  return { ok: true, qr: { base64: c.data.base64 ?? null, code: c.data.code ?? null, pairingCode: c.data.pairingCode ?? null } };
}

// Cierra sesión y elimina la instancia (chip nuevo → volver a conectar).
export async function desconectar(): Promise<{ ok: boolean; error?: string }> {
  const ws = await wsEstricto();
  const instance = instanceNameDeWs(ws);
  await evFetch(`/instance/logout/${encodeURIComponent(instance)}`, { method: 'DELETE' });
  const del = await evFetch(`/instance/delete/${encodeURIComponent(instance)}`, { method: 'DELETE' });
  await upsertInstancia({ estado: 'desconectado', numero: null, perfil_nombre: null, instance_id: null });
  // Idempotente: borrar algo que ya no existe (404) es el resultado deseado.
  return del.ok || del.status === 404 ? { ok: true } : { ok: false, error: del.error };
}

// ── Envío de texto (anti-ban: "escribiendo…" proporcional al texto) ──────────
export type EnvioResult = { ok: true; id: string; chatJid: string } | { ok: false; error: string };

// Envía un texto libre por el número no oficial del workspace. El `delay` hace
// que Evolution muestre "escribiendo…" ese tiempo antes de soltar el mensaje
// (nativo) — proporcional al largo + jitter, para no parecer un bot.
export async function enviarTexto(telefono: string, texto: string): Promise<EnvioResult> {
  const ws = await wsEstricto();
  const instance = instanceNameDeWs(ws);
  const num = (telefono || '').replace(/\D/g, '');
  if (!num) return { ok: false, error: 'teléfono inválido' };
  if (!texto.trim()) return { ok: false, error: 'texto vacío' };
  const base = Math.min(1500 + texto.length * 45, 9000);
  const delay = Math.round(base * (0.8 + Math.random() * 0.4)); // ±20% jitter
  const r = await evFetch<{ key?: { id?: string; remoteJid?: string } }>(
    `/message/sendText/${encodeURIComponent(instance)}`,
    { method: 'POST', body: JSON.stringify({ number: num, text: texto, delay }) },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, id: r.data.key?.id ?? '', chatJid: r.data.key?.remoteJid ?? `${num}@s.whatsapp.net` };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
// '5216863996369@s.whatsapp.net' → '5216863996369'
export function jidToNumero(jid: string | null): string | null {
  if (!jid) return null;
  return jid.replace(/@.*/, '').replace(/:.*/, '') || null;
}
