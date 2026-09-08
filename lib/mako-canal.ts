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
import { socketVivo } from './evolution';
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
  // Igual que en estadoEnVivo: «open» es la fila en la base de Evolution, no la sesión.
  // Sin esta confirmación el panel dice «conectado» con el socket muerto — medido el 16/08.
  let estado = mapEstado((r.body as { instance?: { state?: string } })?.instance?.state);
  if (estado === 'conectado' && !(await socketVivo(INSTANCIA_SUPERADMIN))) estado = 'error';
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
  // ⚠️ EL BOTÓN DE RECUPERAR ESTABA ROTO JUSTO EN EL CASO PARA EL QUE EXISTE.
  //
  // EL CASO (2026-09-08). La línea de voz llevaba seis días ZOMBI: `state: open`
  // con el socket muerto (428 Connection Closed en cualquier operación real).
  // Martín fue a reconectar y le salió «No se pudo generar el QR».
  //
  // El porqué: Evolution NO emite QR si cree que la instancia ya está conectada.
  // `/instance/connect/` devolvía `{"instance":{"state":"open"}}` —sin `base64` ni
  // `code`— y acá se leía `b.base64 ?? null`, o sea null, o sea «no se pudo».
  // El mismo campo mentiroso que causó la caída bloqueaba la salida de la caída.
  //
  // Para que Evolution vuelva a dar un QR hay que soltar la sesión muerta primero.
  // Se hace SOLO `logout`, nunca `delete`: `desconectarCanalMaKo` borra la
  // instancia entera (y con ella su webhook) y devuelve la voz al default — eso es
  // para desconectar a propósito, no para recuperarse de una caída.
  //
  // ⛔ Y SOLO SI EL SOCKET ESTÁ VERIFICABLEMENTE MUERTO. Un `logout` sobre una
  // sesión viva desvincula el número y deja a todos los clientes sin MaKo: el
  // guard va en positivo sobre `socketVivo()`, que es una operación REAL, jamás
  // sobre el `state` que ya sabemos que miente en las dos direcciones.
  let c = await ev(`/instance/connect/${INSTANCIA_SUPERADMIN}`);
  const sinQr = (b: unknown) => {
    const x = b as { base64?: string; code?: string } | null;
    return !x?.base64 && !x?.code;
  };
  if (c.ok && sinQr(c.body) && !(await socketVivo(INSTANCIA_SUPERADMIN))) {
    console.warn('[mako-canal] instancia ZOMBI (dice conectada, socket muerto) → logout y QR nuevo');
    await ev(`/instance/logout/${INSTANCIA_SUPERADMIN}`, { method: 'DELETE' });
    // Evolution tarda un instante en soltar la sesión antes de poder ofrecer el QR.
    await new Promise((r) => setTimeout(r, 1500));
    c = await ev(`/instance/connect/${INSTANCIA_SUPERADMIN}`);
  }
  if (!c.ok) return { ok: false, error: `Evolution ${c.status}` };
  const b = c.body as { base64?: string; code?: string; pairingCode?: string | null };
  if (sinQr(b)) {
    // Decir QUÉ pasó, no «no se pudo». Si llegamos acá con el socket vivo, la
    // instancia está sana y no hay nada que reconectar.
    const viva = await socketVivo(INSTANCIA_SUPERADMIN);
    return {
      ok: false,
      error: viva
        ? 'La línea ya está conectada y respondiendo: no hace falta reconectarla.'
        : 'Evolution no devolvió el QR. Reintenta en unos segundos; si sigue igual, desconecta la línea y vuelve a vincularla.',
    };
  }
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
