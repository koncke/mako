// =============================================================================
// mako-canal — el canal PROPIO de MaKo (SuperAdmin): instancia Evolution dedicada
// =============================================================================
// Línea de WhatsApp exclusiva de MaKo (NO oficial, por QR), separada del número
// del cliente. Desde acá MaKo le habla al dueño (avisos, reportes) sin depender
// de la ventana de 24h de la API oficial. Es una instancia Evolution propia, sin
// scoping por workspace (no es de ningún cliente).
//
// Al conectarse, se fija como la "voz" de MaKo con setInstanciaVoz() para que los
// grupos y avisos salgan de esta línea dedicada.
//
// ⚠️ EL NOMBRE DE LA INSTANCIA NO ES FIJO. Nace como `mako_superadmin`, pero si
// Evolution la deja trabada (ver `conectarCanalMaKo`) se rota a una línea nueva
// `mako_superadmin_<sufijo>`, y la vigente vive en el setting `mako.canal.instancia`.
// Quien necesite saber «¿esta instancia es el canal?» pregunta `instanciaCanal()`.

import 'server-only';
import { socketVivo, sondearSocket, registrarWebhookInstancia, permitirGruposEnInstancia } from './evolution';
import { setInstanciaVoz, INSTANCIA_VOZ_DEFAULT } from './mako-grupo';
import { getSetting, setSetting } from './settings';
import { runWithWorkspace, OWNER_WS } from './workspace';

const BASE = (process.env.EVOLUTION_BASE_URL || '').replace(/\/$/, '');
const KEY = process.env.EVOLUTION_API_KEY || '';

/** Nombre BASE de la instancia del canal. Las rotadas se llaman `${base}_<sufijo>`. */
export const INSTANCIA_SUPERADMIN = 'mako_superadmin';
/** Qué instancia ES hoy el canal de MaKo. Cambia cuando se rota una trabada. */
export const KEY_CANAL_INSTANCIA = 'mako.canal.instancia';

/** La instancia vigente del canal de MaKo. */
export async function instanciaCanal(): Promise<string> {
  return runWithWorkspace(OWNER_WS, async () => (await getSetting(KEY_CANAL_INSTANCIA)) || INSTANCIA_SUPERADMIN);
}

/** ¿Este nombre es una línea del canal de MaKo, la vigente o una rotada? Sin DB. */
export function esNombreDeCanal(instance: string): boolean {
  return instance === INSTANCIA_SUPERADMIN || instance.startsWith(`${INSTANCIA_SUPERADMIN}_`);
}

function nombreInstanciaNueva(): string {
  return `${INSTANCIA_SUPERADMIN}_${Date.now().toString(36)}`;
}

export function canalConfigurado(): boolean {
  return !!BASE && !!KEY;
}

export type EstadoCanal = 'desconectado' | 'conectando' | 'conectado' | 'error';
export type CanalInfo = { estado: EstadoCanal; numero: string | null; perfil: string | null; esVozActiva: boolean };
export type QrCanal = { base64: string | null; code: string | null; pairingCode: string | null };
type Conexion = { ok: true; qr: QrCanal; estado: EstadoCanal } | { ok: false; error: string };

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

async function existeInstancia(inst: string): Promise<boolean> {
  const r = await ev(`/instance/fetchInstances?instanceName=${inst}`);
  return r.ok && Array.isArray(r.body) && (r.body as Array<Record<string, unknown>>).some(
    (i) => (i.name ?? i.instanceName) === inst,
  );
}

/** ¿La instancia vigente del canal es la voz activa de MaKo? (setting mako.voz.instancia) */
async function esVozActiva(inst: string): Promise<boolean> {
  // Import perezoso para evitar ciclo con mako-grupo en el tope del módulo.
  const { instanciaVoz } = await import('./mako-grupo');
  return (await instanciaVoz()) === inst;
}

/** Estado en vivo del canal SuperAdmin (para el panel). */
export async function estadoCanalMaKo(): Promise<CanalInfo> {
  const inst = await instanciaCanal();
  const r = await ev(`/instance/connectionState/${inst}`);
  const vozActiva = await esVozActiva(inst);
  if (!r.ok) {
    if (r.status === 404) return { estado: 'desconectado', numero: null, perfil: null, esVozActiva: vozActiva };
    return { estado: 'error', numero: null, perfil: null, esVozActiva: vozActiva };
  }
  // Igual que en estadoEnVivo: «open» es la fila en la base de Evolution, no la sesión.
  // Sin esta confirmación el panel dice «conectado» con el socket muerto — medido el 16/08.
  let estado = mapEstado((r.body as { instance?: { state?: string } })?.instance?.state);
  if (estado === 'conectado' && !(await socketVivo(inst))) estado = 'error';
  let numero: string | null = null, perfil: string | null = null;
  if (estado === 'conectado') {
    const info = await ev(`/instance/fetchInstances?instanceName=${inst}`);
    const it = Array.isArray(info.body) ? (info.body as Array<Record<string, unknown>>)[0] : undefined;
    if (it) {
      numero = jidNum((it.ownerJid as string) || (it.owner as string) || (it.number as string) || null);
      perfil = (it.profileName as string) || (it.profilePicName as string) || null;
    }
  }
  return { estado, numero, perfil, esVozActiva: vozActiva };
}

const sinQr = (b: unknown): boolean => {
  const x = b as { base64?: string; code?: string } | null;
  return !x?.base64 && !x?.code;
};
const conQr = (b: unknown): Conexion => {
  const x = b as { base64?: string; code?: string; pairingCode?: string | null };
  return { ok: true, estado: 'conectando', qr: { base64: x.base64 ?? null, code: x.code ?? null, pairingCode: x.pairingCode ?? null } };
};

/** Pide el QR unas veces: Evolution tarda un instante en tenerlo después de crear o soltar. */
async function qrConEspera(inst: string, intentos: number): Promise<Conexion | null> {
  for (let i = 0; i < intentos; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const c = await ev(`/instance/connect/${inst}`);
    if (c.ok && !sinQr(c.body)) return conQr(c.body);
  }
  return null;
}

/**
 * Webhook + escucha de grupos. Sin cualquiera de los dos la línea conecta, el panel dice
 * «conectado», y MaKo no oye un solo «Hola MaKo»: por eso el error se devuelve, no se traga.
 * Se re-aplica en cada conexión (es idempotente) para que un fallo de una vez no quede
 * pegado a la instancia para siempre.
 */
async function prepararInstancia(inst: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const wh = await registrarWebhookInstancia(inst);
  if (!wh.ok) return { ok: false, error: `No pude registrar el webhook de la línea ${inst} (${wh.error}): sin eso MaKo no escucha los grupos.` };
  const gr = await permitirGruposEnInstancia(inst);
  if (!gr.ok) return { ok: false, error: `No pude habilitar los grupos en la línea ${inst} (${gr.error}).` };
  return { ok: true };
}

/** Crea (si hace falta) la instancia del canal y devuelve el QR para escanear. */
export async function conectarCanalMaKo(): Promise<Conexion> {
  if (!canalConfigurado()) return { ok: false, error: 'Evolution no configurado' };
  const inst = await instanciaCanal();
  if (!(await existeInstancia(inst))) return crearInstanciaCanal(inst);

  const prep = await prepararInstancia(inst);
  if (!prep.ok) return prep;

  // ⚠️ EL BOTÓN DE RECUPERAR ESTABA ROTO JUSTO EN EL CASO PARA EL QUE EXISTE.
  //
  // EL CASO (2026-09-08). La línea de voz llevaba seis días ZOMBI: `state: open`
  // con el socket muerto (428 Connection Closed en cualquier operación real).
  // Evolution NO emite QR si cree que la instancia ya está conectada:
  // `/instance/connect/` devuelve `{"instance":{"state":"open"}}`, sin `base64` ni `code`.
  const c = await ev(`/instance/connect/${inst}`);
  if (!c.ok) return { ok: false, error: `Evolution ${c.status}` };
  if (!sinQr(c.body)) return conQr(c.body);

  // ⛔ SOLO SE TOCA LA SESIÓN SI ESTÁ VERIFICABLEMENTE MUERTA. Un `logout` sobre una sesión
  // viva desvincula el número y deja a todos los clientes sin MaKo. El guard va en positivo
  // sobre una operación REAL, jamás sobre el `state`, que miente en las dos direcciones. Y
  // «no pude preguntar» NO es «está muerta»: con `sin_respuesta` no se toca nada.
  const sondeo = await sondearSocket(inst, 15000);
  if (sondeo === 'vivo') {
    return { ok: false, error: 'La línea ya está conectada y respondiendo: no hace falta reconectarla.' };
  }
  if (sondeo === 'sin_respuesta') {
    return { ok: false, error: 'WhatsApp no contestó a tiempo y no puedo confirmar que la línea esté caída, así que no toqué nada. Reintenta en un minuto.' };
  }

  // Muerta. Primero se intenta soltarla por las buenas, que conserva la instancia.
  const lo = await ev(`/instance/logout/${inst}`, { method: 'DELETE' });
  if (lo.ok) {
    const qr = await qrConEspera(inst, 4);
    if (qr) return qr;
  }

  // ⚠️ Y EVOLUTION PUEDE NO SOLTARLA NUNCA. Medido el 11/09/2026 sobre la instancia trabada:
  //
  //   DELETE /instance/logout ..... 500 «Error: Connection Closed»   (state sigue open)
  //   POST   /instance/restart .... 200 {"state":"open"}   (a los 30 s el socket sigue muerto)
  //   GET    /instance/connect .... {"instance":{"state":"open"}}   (nunca un QR)
  //
  // Evolution 2.3.7 guarda el estado EN MEMORIA y solo lo cambia el evento del socket,
  // que está muerto y no emite. `logout` y `delete` le avisan a WhatsApp por ese mismo
  // socket y se caen; `restart` lo cierra y vuelve a `connect`, que ve `open` y no hace
  // nada. Ninguna de las 8 rutas de instancia la saca de ahí: lo único que la libera es
  // reiniciar el servidor de Evolution. Este código leía el 500 del logout como éxito y
  // le decía a Martín «reintenta», que no iba a funcionar nunca.
  //
  // La salida que no pasa por el socket muerto es una línea NUEVA. Nunca `delete` de la
  // vieja: tampoco funciona (hace logout adentro) y, si funcionara, se lleva el historial.
  console.warn(`[mako-canal] ${inst} trabada en Evolution (logout ${lo.status}) → línea nueva`);
  return crearInstanciaCanal(nombreInstanciaNueva());
}

async function crearInstanciaCanal(nombre: string): Promise<Conexion> {
  const r = await ev('/instance/create', {
    method: 'POST',
    body: JSON.stringify({ instanceName: nombre, integration: 'WHATSAPP-BAILEYS', qrcode: true }),
  });
  if (!r.ok) {
    return { ok: false, error: `Evolution no pudo crear la línea (${r.status}): ${typeof r.body === 'string' ? r.body : JSON.stringify(r.body).slice(0, 160)}` };
  }
  // Desde acá ESTA es la instancia del canal: el panel la sigue y el webhook la reconoce.
  // La voz recién se muda cuando escanean (ver el `connection.update` del webhook).
  try {
    await runWithWorkspace(OWNER_WS, () => setSetting(KEY_CANAL_INSTANCIA, nombre));
  } catch (e) {
    return { ok: false, error: `Creé la línea ${nombre} pero no pude guardarla como canal (${e instanceof Error ? e.message : String(e)}).` };
  }
  const prep = await prepararInstancia(nombre);
  if (!prep.ok) return prep;
  const q = (r.body as { qrcode?: unknown }).qrcode;
  if (!sinQr(q)) return conQr(q);
  return (await qrConEspera(nombre, 4))
    ?? { ok: false, error: `La línea nueva (${nombre}) ya existe pero Evolution todavía no armó el QR. Toca «Conectar por QR» otra vez en unos segundos.` };
}

/** Fija (o saca) la instancia vigente del canal como la voz activa de MaKo. Al fijarla,
 *  agrega el número del canal a TODOS los grupos (con la voz ACTUAL, que es admin),
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
    await setInstanciaVoz(await instanciaCanal());
  } else {
    await setInstanciaVoz(INSTANCIA_VOZ_DEFAULT);
  }
}

/** Cierra sesión y elimina la instancia del canal. */
export async function desconectarCanalMaKo(): Promise<{ ok: boolean }> {
  const inst = await instanciaCanal();
  await ev(`/instance/logout/${inst}`, { method: 'DELETE' });
  const d = await ev(`/instance/delete/${inst}`, { method: 'DELETE' });
  await usarCanalComoVoz(false); // vuelve la voz al default
  return { ok: d.ok || d.status === 404 };
}
