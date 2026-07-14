// =============================================================================
// mako-canal — el canal PROPIO de MaKo (SuperAdmin): instancia Evolution dedicada
// =============================================================================
// Línea de WhatsApp exclusiva de MaKo (NO oficial, por QR), separada del número
// del cliente. Desde acá MaKo le habla al dueño (avisos, reportes) sin depender
// de la ventana de 24h de la API oficial. Es una instancia Evolution fija
// (mako_superadmin), sin scoping por workspace (no es de ningún cliente).
//
// Al conectarse, se fija como la "voz" de MaKo con setInstanciaVoz() para que los
// grupos y avisos salgan de esta línea dedicada.

import 'server-only';
import { setInstanciaVoz, INSTANCIA_VOZ_DEFAULT } from './mako-grupo';

const BASE = (process.env.EVOLUTION_BASE_URL || '').replace(/\/$/, '');
const KEY = process.env.EVOLUTION_API_KEY || '';

/** Instancia Evolution dedicada a la voz de MaKo (canal SuperAdmin). */
export const INSTANCIA_SUPERADMIN = 'mako_superadmin';

export function canalConfigurado(): boolean {
  return !!BASE && !!KEY;
}

export type EstadoCanal = 'desconectado' | 'conectando' | 'conectado' | 'error';
export type CanalInfo = { estado: EstadoCanal; numero: string | null; perfil: string | null; esVozActiva: boolean };
export type QrCanal = { base64: string | null; code: string | null; pairingCode: string | null };

type EvOut = { ok: boolean; status: number; body: unknown };
async function ev(path: string, init?: RequestInit): Promise<EvOut> {
  if (!canalConfigurado()) return { ok: false, status: 0, body: 'Evolution no configurado' };
  try {
    const r = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { apikey: KEY, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      cache: 'no-store', signal: AbortSignal.timeout(30000),
    });
    const txt = await r.text();
    let body: unknown = txt;
    try { body = txt ? JSON.parse(txt) : {}; } catch { /* deja texto */ }
    return { ok: r.ok, status: r.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: e instanceof Error ? e.message : String(e) };
  }
}

function mapEstado(state: string | undefined): EstadoCanal {
  switch ((state ?? '').toLowerCase()) {
    case 'open': return 'conectado';
    case 'connecting': return 'conectando';
    case 'close': case 'closed': return 'desconectado';
    default: return 'desconectado';
  }
}
const jidNum = (jid: string | null): string | null => (jid ? jid.replace(/@.*/, '').replace(/:.*/, '') || null : null);

async function existeInstancia(): Promise<boolean> {
  const r = await ev(`/instance/fetchInstances?instanceName=${INSTANCIA_SUPERADMIN}`);
  return r.ok && Array.isArray(r.body) && (r.body as Array<Record<string, unknown>>).some(
    (i) => (i.name ?? i.instanceName) === INSTANCIA_SUPERADMIN,
  );
}

/** ¿mako_superadmin es la voz activa de MaKo? (setting mako.voz.instancia) */
async function esVozActiva(): Promise<boolean> {
  // Import perezoso para evitar ciclo con mako-grupo en el tope del módulo.
  const { instanciaVoz } = await import('./mako-grupo');
  return (await instanciaVoz()) === INSTANCIA_SUPERADMIN;
}

/** Estado en vivo del canal SuperAdmin (para el panel). */
export async function estadoCanalMaKo(): Promise<CanalInfo> {
  const r = await ev(`/instance/connectionState/${INSTANCIA_SUPERADMIN}`);
  const vozActiva = await esVozActiva();
  if (!r.ok) {
    if (r.status === 404) return { estado: 'desconectado', numero: null, perfil: null, esVozActiva: vozActiva };
    return { estado: 'error', numero: null, perfil: null, esVozActiva: vozActiva };
  }
  const estado = mapEstado((r.body as { instance?: { state?: string } })?.instance?.state);
  let numero: string | null = null, perfil: string | null = null;
  if (estado === 'conectado') {
    const info = await ev(`/instance/fetchInstances?instanceName=${INSTANCIA_SUPERADMIN}`);
    const it = Array.isArray(info.body) ? (info.body as Array<Record<string, unknown>>)[0] : undefined;
    if (it) {
      numero = jidNum((it.ownerJid as string) || (it.owner as string) || (it.number as string) || null);
      perfil = (it.profileName as string) || (it.profilePicName as string) || null;
    }
  }
  return { estado, numero, perfil, esVozActiva: vozActiva };
}

/** Crea (si hace falta) la instancia del canal y devuelve el QR para escanear. */
export async function conectarCanalMaKo(): Promise<{ ok: true; qr: QrCanal; estado: EstadoCanal } | { ok: false; error: string }> {
  if (!canalConfigurado()) return { ok: false, error: 'Evolution no configurado' };
  if (!(await existeInstancia())) {
    const r = await ev('/instance/create', {
      method: 'POST',
      body: JSON.stringify({ instanceName: INSTANCIA_SUPERADMIN, integration: 'WHATSAPP-BAILEYS', qrcode: true }),
    });
    if (!r.ok) return { ok: false, error: `Evolution ${r.status}: ${typeof r.body === 'string' ? r.body : JSON.stringify(r.body).slice(0, 160)}` };
    const q = (r.body as { qrcode?: { base64?: string; code?: string; pairingCode?: string | null } }).qrcode ?? {};
    return { ok: true, estado: 'conectando', qr: { base64: q.base64 ?? null, code: q.code ?? null, pairingCode: q.pairingCode ?? null } };
  }
  const c = await ev(`/instance/connect/${INSTANCIA_SUPERADMIN}`);
  if (!c.ok) return { ok: false, error: `Evolution ${c.status}` };
  const b = c.body as { base64?: string; code?: string; pairingCode?: string | null };
  return { ok: true, estado: 'conectando', qr: { base64: b.base64 ?? null, code: b.code ?? null, pairingCode: b.pairingCode ?? null } };
}

/** Fija (o saca) mako_superadmin como la voz activa de MaKo. Al fijarla, agrega
 *  el número del canal nuevo a TODOS los grupos (con la voz ACTUAL, que es admin),
 *  así la línea nueva puede mandar en cada grupo. */
export async function usarCanalComoVoz(usar: boolean): Promise<void> {
  if (usar) {
    try {
      const info = await estadoCanalMaKo();
      if (info.numero) {
        const { agregarNumeroATodosLosGrupos } = await import('./mako-chat');
        await agregarNumeroATodosLosGrupos(info.numero);
      }
    } catch (e) {
      console.error('[mako-canal] no se pudo sincronizar el número en los grupos:', e);
    }
    await setInstanciaVoz(INSTANCIA_SUPERADMIN);
  } else {
    await setInstanciaVoz(INSTANCIA_VOZ_DEFAULT);
  }
}

/** Cierra sesión y elimina la instancia del canal. */
export async function desconectarCanalMaKo(): Promise<{ ok: boolean }> {
  await ev(`/instance/logout/${INSTANCIA_SUPERADMIN}`, { method: 'DELETE' });
  const d = await ev(`/instance/delete/${INSTANCIA_SUPERADMIN}`, { method: 'DELETE' });
  await usarCanalComoVoz(false); // vuelve la voz al default
  return { ok: d.ok || d.status === 404 };
}
