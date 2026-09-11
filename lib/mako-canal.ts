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
import { sondearSocket, motivoCaida, registrarWebhookInstancia, permitirGruposEnInstancia } from './evolution';
import { mensajeEvolution } from './evolution-sonda';
import { instanciaVoz, setInstanciaVoz, INSTANCIA_VOZ_DEFAULT } from './mako-grupo';
import { getSettingEstricto, cambiarSettingSi } from './settings';
import { runWithWorkspace, OWNER_WS } from './workspace';

const BASE = (process.env.EVOLUTION_BASE_URL || '').replace(/\/$/, '');
const KEY = process.env.EVOLUTION_API_KEY || '';

/** Nombre BASE de la instancia del canal. Las rotadas se llaman `${base}_<sufijo>`. */
export const INSTANCIA_SUPERADMIN = 'mako_superadmin';
/** Qué instancia ES hoy el canal de MaKo. Cambia cuando se rota una trabada. */
export const KEY_CANAL_INSTANCIA = 'mako.canal.instancia';

/**
 * El valor CRUDO del setting del canal: null si la fila no existe.
 *
 * ⚠️ ESTRICTO: si la base falla, TIRA. Con `getSetting`, un 5xx de Supabase se leía como «no
 * existe», el `||` de `instanciaCanal` lo completaba con la zombi `mako_superadmin`, y
 * «Conectar por QR» verificaba —bien— que ESA estaba muerta y rotaba encima de la línea viva,
 * que quedaba sorda (revisión adversarial del 11/09/2026). Acá «no pude leer» corta todo.
 */
async function instanciaCanalCruda(): Promise<string | null> {
  return runWithWorkspace(OWNER_WS, () => getSettingEstricto(KEY_CANAL_INSTANCIA));
}

/** La instancia vigente del canal de MaKo. Tira si no se pudo leer (ver `instanciaCanalCruda`). */
export async function instanciaCanal(): Promise<string> {
  return (await instanciaCanalCruda()) || INSTANCIA_SUPERADMIN;
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

export type EstadoCanal = 'desconectado' | 'conectando' | 'conectado' | 'sin_confirmar' | 'error';
/** `esVozActiva: null` = no se pudo leer cuál es la voz. No es «no»: no autoriza a escribirla. */
export type CanalInfo = { estado: EstadoCanal; numero: string | null; perfil: string | null; esVozActiva: boolean | null };
export type QrCanal = { base64: string | null; code: string | null; pairingCode: string | null };
/** `sinCrear`: Evolution contestó que NO creó la línea (no un timeout, donde pudo haberla creado). */
type Conexion = { ok: true; qr: QrCanal; estado: EstadoCanal } | { ok: false; error: string; sinCrear?: boolean };

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

/** La fila de Evolution de una instancia, buscada por NOMBRE (si ignora el filtro, no adopta otra). */
async function filaDe(inst: string): Promise<Record<string, unknown> | undefined> {
  const r = await ev(`/instance/fetchInstances?instanceName=${inst}`);
  return Array.isArray(r.body)
    ? (r.body as Array<Record<string, unknown>>).find((i) => (i.name ?? i.instanceName) === inst)
    : undefined;
}

/** El número vinculado a una instancia (su ownerJid), o null. */
async function numeroDe(inst: string): Promise<string | null> {
  const it = await filaDe(inst);
  return it ? jidNum((it.ownerJid as string) || (it.owner as string) || (it.number as string) || null) : null;
}

/** Estado en vivo del canal SuperAdmin (para el panel). */
export async function estadoCanalMaKo(): Promise<CanalInfo> {
  let inst: string;
  try {
    inst = await instanciaCanal();
  } catch {
    // No saber cuál es la línea no es un estado de la línea.
    return { estado: 'sin_confirmar', numero: null, perfil: null, esVozActiva: null };
  }
  const r = await ev(`/instance/connectionState/${inst}`);
  // La voz se lee ESTRICTA: con la tolerante, un 5xx de la base daba «la voz es mako_ws1»,
  // esVozActiva:false, y el panel disparaba solo el «usar» sobre la línea de un cliente
  // (segunda revisión adversarial del 11/09/2026).
  const voz = await instanciaVoz({ estricto: true }).catch(() => null);
  const vozActiva = voz === null ? null : voz === inst;
  if (!r.ok) {
    // Misma regla que la sonda: el único error que es un DATO sobre la línea es «la instancia no
    // existe». Un 401 (key rotada), un 502 (Evolution reiniciando) o un 500 no dicen nada de la
    // línea, y pintarlos «con error» ofrecía re-escanear justo cuando la alerta ámbar dice que no
    // (segunda revisión del 11/09/2026).
    const noExiste = r.status === 404 && /does not exist/i.test(mensajeEvolution(r.body, r.status));
    return { estado: noExiste ? 'desconectado' : 'sin_confirmar', numero: null, perfil: null, esVozActiva: vozActiva };
  }
  // Igual que en estadoEnVivo: «open» es la fila en la base de Evolution, no la sesión.
  // Sin esta confirmación el panel dice «conectado» con el socket muerto — medido el 16/08.
  // ⚠️ Y «no pude medir» NO es «con error» (revisión del 11/09/2026): pintaba rojo, con
  // «Conectar por QR», sobre una línea que solo tardó en contestar.
  let estado = mapEstado((r.body as { instance?: { state?: string } })?.instance?.state);
  if (estado === 'conectado') {
    const sondeo = await sondearSocket(inst, 8000);
    estado = sondeo === 'vivo' ? 'conectado' : sondeo === 'muerto' ? 'error' : 'sin_confirmar';
  }
  let numero: string | null = null, perfil: string | null = null;
  if (estado === 'conectado') {
    const it = await filaDe(inst);
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
    // Si mientras se espera pasó a `open`, no hay QR que esperar. Qué significa ese `open`
    // (conectó, o es otra zombi) lo decide el sondeo de afuera, no esta espera.
    if ((c.body as { instance?: { state?: string } } | null)?.instance?.state === 'open') return null;
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
  let crudo: string | null;
  try {
    crudo = await instanciaCanalCruda();
  } catch {
    return { ok: false, error: 'No pude leer cuál es la línea de MaKo (falló la base de datos), así que no toqué nada. Reintenta en unos segundos.' };
  }
  const inst = crudo || INSTANCIA_SUPERADMIN;
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

  const dice = (c.body as { instance?: { state?: string } } | null)?.instance?.state;
  if (dice !== 'open') {
    // Sin QR y SIN `open`: casi siempre es lentitud (recién creada, o esperando escaneo), y
    // eso se espera, no se arregla. ⚠️ Tocar la sesión acá crearía una línea nueva POR CLIC:
    // una instancia que todavía no conectó también da «Connection Closed» al sondearla.
    const qr = await qrConEspera(inst, 4);
    if (qr) return qr;
    // Salvo que WhatsApp la haya CERRADO (401/403): esa se queda en `connecting` para
    // siempre y no va a dar QR por más que se espere (medido en mako_ws1 el 08/09).
    const motivo = await motivoCaida(inst, 10000);
    if (!motivo?.desvinculado) {
      return { ok: false, error: 'Evolution todavía no armó el QR de la línea. Toca «Conectar por QR» otra vez en unos segundos.' };
    }
  }

  // ⛔ JUSTO ANTES DE TOCAR LA SESIÓN SE SONDEA, EN LAS DOS RAMAS. Un `logout` sobre una sesión
  // viva desvincula el número y deja a todos los clientes sin MaKo. El guard va en positivo
  // sobre una operación REAL, jamás sobre el `state`, que miente en las dos direcciones. Y
  // «no pude preguntar» NO es «está muerta»: con `sin_respuesta` no se toca nada.
  // Sin `open` también hace falta: el 401/403 de `motivoCaida` es la ÚLTIMA caída guardada,
  // no una medición de ahora, y la línea pudo re-escanearse después sobre la misma instancia
  // (revisión del 11/09/2026).
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
    // Evolution la soltó: la instancia sirve, se espera su QR. Rotar acá abriría una línea de
    // más solo porque Evolution tardó en armarlo (revisión del 11/09/2026).
    return (await qrConEspera(inst, 4))
      ?? { ok: false, error: 'Solté la sesión muerta y Evolution todavía está armando el QR. Toca «Conectar por QR» otra vez en unos segundos.' };
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
  return rotarCanal(inst, crudo);
}

/**
 * Abre una línea NUEVA en reemplazo de `inst`, que Evolution no suelta.
 *
 * ⚠️ DOS CLICS A LA VEZ NO PUEDEN ABRIR DOS LÍNEAS (revisión adversarial del 11/09/2026). La
 * barra roja sale en todas las pestañas y para todos los admins. Cada request veía la zombi,
 * creaba su línea y pisaba el setting: ganaba la última, y el QR de la otra quedaba huérfano y
 * sordo. Ahora la línea se RESERVA en la base con compare-and-set ANTES de crearla: una sola
 * request logra cambiar `mako.canal.instancia` de `inst` a la nueva.
 */
async function rotarCanal(inst: string, crudo: string | null): Promise<Conexion> {
  const nueva = nombreInstanciaNueva();
  let gane: boolean;
  try {
    gane = await runWithWorkspace(OWNER_WS, () => cambiarSettingSi(KEY_CANAL_INSTANCIA, crudo, nueva));
  } catch (e) {
    return { ok: false, error: `No pude reservar la línea nueva (${e instanceof Error ? e.message : String(e)}), así que no toqué nada.` };
  }
  if (!gane) {
    // ⚠️ EL QUE PIERDE NO DEVUELVE UN QR (segunda revisión del 11/09/2026). Devolvía el de la
    // línea ganadora, pero a esa la PREPARA (webhook + grupos) la otra request, y si esa se caía
    // a mitad de camino quedaba un QR escaneable de una línea sorda: conectaba, el panel decía
    // «conectado», y MaKo no oía un solo «Hola MaKo». El próximo clic entra por el camino
    // normal, que sí la prepara.
    return { ok: false, error: 'Otra pestaña ya está abriendo la línea nueva. Espera unos segundos y toca «Conectar por QR».' };
  }
  const creada = await crearInstanciaCanal(nueva);
  if (!creada.ok && creada.sinCrear) {
    // Evolution contestó que NO la creó: se devuelve la reserva, o el próximo clic buscaría una
    // línea que no existe. Con un timeout no se devuelve: pudo haberse creado, y el próximo
    // clic la encuentra y pide su QR.
    await runWithWorkspace(OWNER_WS, () => cambiarSettingSi(KEY_CANAL_INSTANCIA, nueva, crudo ?? '')).catch(() => {});
  }
  return creada;
}

async function crearInstanciaCanal(nombre: string): Promise<Conexion> {
  const r = await ev('/instance/create', {
    method: 'POST',
    body: JSON.stringify({ instanceName: nombre, integration: 'WHATSAPP-BAILEYS', qrcode: true }),
  });
  if (!r.ok) {
    return {
      ok: false,
      sinCrear: r.status > 0,
      error: `Evolution no pudo crear la línea (${r.status}): ${typeof r.body === 'string' ? r.body : JSON.stringify(r.body).slice(0, 160)}`,
    };
  }
  const prep = await prepararInstancia(nombre);
  if (!prep.ok) return prep;
  const q = (r.body as { qrcode?: unknown }).qrcode;
  if (!sinQr(q)) return conQr(q);
  return (await qrConEspera(nombre, 4))
    ?? { ok: false, error: `La línea nueva (${nombre}) ya existe pero Evolution todavía no armó el QR. Toca «Conectar por QR» otra vez en unos segundos.` };
}

/** Fija (o saca) una línea del canal como la voz activa de MaKo. `instancia`: la que ya se
 *  verificó (el webhook pasa la que acaba de abrir); sin ella, la vigente. Al fijarla, si es
 *  OTRO número, lo agrega a todos los grupos con la voz actual. */
export async function usarCanalComoVoz(usar: boolean, instancia?: string): Promise<void> {
  if (!usar) {
    await setInstanciaVoz(INSTANCIA_VOZ_DEFAULT);
    return;
  }
  const inst = instancia ?? (await instanciaCanal());
  // Red de seguridad: la línea que pasa a ser la voz se PREPARA (webhook + grupos; es
  // idempotente). Una línea conectada sin webhook habla pero no oye, y ningún otro camino la
  // repara después (segunda revisión del 11/09/2026). Si falla se muda igual —la línea está
  // viva—, pero queda escrito.
  const prep = await prepararInstancia(inst);
  if (!prep.ok) console.error(`[mako-canal] ${prep.error}`);
  try {
    const numero = await numeroDe(inst);
    // La voz actual se lee ESTRICTA: con la tolerante, un 5xx daba «mako_ws1» (un cliente) y se
    // le pedía a esa línea que agregara el número a los grupos. Si no se puede leer, no se agrega.
    const actual = await instanciaVoz({ estricto: true }).catch(() => null);
    const numeroActual = actual === null ? null : actual === inst ? numero : await numeroDe(actual);
    // La misma cuenta (otro dispositivo del mismo número, que es el caso de una rotación) ya
    // está en todos los grupos. Pedirle a la voz vieja —muerta— que la agregue era una vuelta
    // de errores por grupo, y el resultado se tiraba (revisión del 11/09/2026).
    if (actual !== null && numero && numero !== numeroActual) {
      const { agregarNumeroATodosLosGrupos } = await import('./mako-chat');
      const r = await agregarNumeroATodosLosGrupos(numero);
      if (r.ok < r.grupos) {
        // Se muda igual: quedarse en una voz muerta es MaKo muda en TODOS los grupos. Pero
        // queda escrito dónde no va a poder hablar.
        console.error(`[mako-canal] el número +${numero} de la línea ${inst} no quedó en ${r.grupos - r.ok} de ${r.grupos} grupos: hay que agregarlo desde el teléfono admin`);
      }
    }
  } catch (e) {
    console.error('[mako-canal] no se pudo sincronizar el número en los grupos:', e);
  }
  await setInstanciaVoz(inst);
}

/** Cierra sesión y elimina la instancia del canal. */
export async function desconectarCanalMaKo(): Promise<{ ok: boolean }> {
  const inst = await instanciaCanal();
  await ev(`/instance/logout/${inst}`, { method: 'DELETE' });
  const d = await ev(`/instance/delete/${inst}`, { method: 'DELETE' });
  await usarCanalComoVoz(false); // vuelve la voz al default
  return { ok: d.ok || d.status === 404 };
}
