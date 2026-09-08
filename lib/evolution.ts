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
import { APP_BASE_URL } from '@/lib/app-url';

// Workspace del request, ESTRICTO: si es null (admin de agencia sin impersonar)
// cortamos — nunca operar sobre la instancia del dueño por un fallback silencioso.
async function wsEstricto(): Promise<number> {
  const ws = await getWorkspaceActual();
  if (ws == null) throw new Error('Selecciona un cliente (impersona un workspace) para conectar su WhatsApp.');
  return ws;
}

const BASE = (process.env.EVOLUTION_BASE_URL || '').replace(/\/$/, '');
const KEY = process.env.EVOLUTION_API_KEY || '';
// La URL base del dashboard para el webhook (Evolution → nuestra app) sale de
// lib/app-url. En local el webhook no llega (se usa polling de estado).
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

async function evFetch<T = unknown>(path: string, init?: RequestInit, topeMs?: number): Promise<EvResult<T>> {
  if (!evolutionConfigurado()) return { ok: false, error: 'Evolution no configurado', status: 0 };
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { apikey: KEY, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      cache: 'no-store',
      // Tope de 30s por default: cubre el 'delay' de tipeo de sendText (~<=11s) y
      // evita que un Evolution colgado bloquee el cron hasta el maxDuration.
      // `topeMs` lo baja para las llamadas que corren DENTRO de una pantalla:
      // ahi 30s no es una espera, es una pagina colgada.
      signal: AbortSignal.timeout(topeMs ?? 30000),
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

// Eventos que nos importan: conexión/QR + mensajes (nuevo/estado/borrado/editado)
// + contactos (nombre/foto) + etiquetas (catálogo + asociación).
const EVENTOS_WEBHOOK = [
  'QRCODE_UPDATED', 'CONNECTION_UPDATE',
  'MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'MESSAGES_DELETE', 'MESSAGES_EDITED',
  'CONTACTS_UPSERT', 'CONTACTS_UPDATE',
  'LABELS_EDIT', 'LABELS_ASSOCIATION',
];

// Configura (best-effort en la conexión) el webhook de la instancia hacia nuestra
// app. Sin secret configurado NO registramos el webhook (registraría un endpoint
// sin auth end-to-end; con el fail-closed del route, además, esos eventos darían
// 401). Devuelve el resultado para que "reparar" pueda superficiar el error (antes
// era void → si fallaba, la conexión quedaba "ok" pero el espejo muerto en silencio).
async function setWebhook(instance: string): Promise<{ ok: boolean; error?: string }> {
  if (!WEBHOOK_SECRET) return { ok: false, error: 'Falta EVOLUTION_WEBHOOK_SECRET en el servidor.' };
  const r = await evFetch(`/webhook/set/${encodeURIComponent(instance)}`, {
    method: 'POST',
    body: JSON.stringify({
      webhook: { enabled: true, url: webhookUrl(), byEvents: false, base64: true, events: EVENTOS_WEBHOOK },
    }),
  });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** Registra el webhook de una instancia hacia nuestra app (wrapper público de
 *  setWebhook). Lo usa el canal de voz de MaKo (mako_superadmin), que se crea sin
 *  webhook, para que los entrantes de grupo (Hola MaKo) lleguen al doer. */
export async function registrarWebhookInstancia(instance: string): Promise<{ ok: boolean; error?: string }> {
  return setWebhook(instance);
}

// Ajustes anti-baneo / de comportamiento humano (PDF): no leer recibos de forma
// automática, ignorar grupos, no forzar "en línea" siempre.
async function setSettings(instance: string): Promise<void> {
  await evFetch(`/settings/set/${encodeURIComponent(instance)}`, {
    method: 'POST',
    body: JSON.stringify({
      rejectCall: false, msgCall: '', groupsIgnore: true,
      alwaysOnline: false, readMessages: false, readStatus: false,
      // El producto entero se apoya en leer el historial: aprender la forma de
      // escribir del dueño, reconocer a los contactos por su nombre, y no
      // arrancar una nutrición sobre un contacto con el que ya se venía
      // hablando. Con `false`, Baileys guarda apenas lo que llega desde que se
      // vincula, y el paso "Tu forma de escribir" se queda sin material.
      //
      // OJO: solo aplica al VINCULAR. Un número ya conectado no recupera su
      // historial con este cambio — hay que desconectarlo y escanear de nuevo.
      syncFullHistory: true,
    }),
  });
}

// Habilita la RECEPCIÓN de mensajes de grupo (groupsIgnore:false) para una
// instancia — necesario para el doer "Hola MaKo", que escucha en los grupos de
// MaKo. Por defecto las instancias ignoran grupos (regla anti-ban del PDF); esto
// se activa a propósito solo en la línea que le da voz a MaKo. Mantiene el resto
// de los ajustes anti-ban igual.
export async function permitirGruposEnInstancia(instance: string): Promise<{ ok: boolean; error?: string }> {
  const r = await evFetch(`/settings/set/${encodeURIComponent(instance)}`, {
    method: 'POST',
    body: JSON.stringify({
      rejectCall: false, msgCall: '', groupsIgnore: false,
      // Mismo valor que setSettings: este endpoint PISA los ajustes enteros,
      // así que dejarlo en false acá apagaría el historial por la ventana.
      alwaysOnline: false, readMessages: false, readStatus: false, syncFullHistory: true,
    }),
  });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
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
  // Los settings se re-aplican también acá, no solo al crear: una instancia
  // vieja se quedaba para siempre con los ajustes del día que nació, y cualquier
  // cambio posterior era mudo para todos los clientes que ya existían.
  await setSettings(instance).catch(() => {});
  const c = await evFetch<ConnectResp>(`/instance/connect/${encodeURIComponent(instance)}`);
  if (!c.ok) return { ok: false, error: c.error };
  await upsertInstancia({ estado: 'conectando' });
  return {
    ok: true,
    estado: 'conectando',
    qr: { base64: c.data.base64 ?? null, code: c.data.code ?? null, pairingCode: c.data.pairingCode ?? null },
  };
}

/**
 * ¿El socket de WhatsApp está VIVO? No lo que dice la máquina de estados: lo que contesta
 * WhatsApp.
 *
 * ⚠️ `connectionState` MIENTE, Y ESTE ES EL CASO QUE LO PROBÓ (16/08). La instancia de la
 * voz de MaKo devolvía `state: "open"` mientras toda operación real fallaba con «Connection
 * Closed». Medido, endpoint por endpoint:
 *
 *   connectionState   -> 200 open      (lee la BASE de Evolution)
 *   findContacts      -> 200           (lee la BASE de Evolution)
 *   fetchAllGroups    -> 500 Closed    (habla con WHATSAPP)
 *   whatsappNumbers   -> 428 Closed    (habla con WHATSAPP)
 *
 * O sea: `open` describe la FILA en la base de Evolution, no la sesión. Un `restart` no lo
 * arregla — se probó y siguió diciendo open con el socket muerto: hace falta re-escanear el
 * QR. Mientras tanto el panel decía «conectado» y el onboarding intentaba crear un grupo
 * que nunca iba a existir.
 *
 * Es la regla de la casa: un indicador que afirma la mitad verdadera de un proceso de dos
 * pasos es peor que uno roto, porque nadie lo audita. La pregunta completa no es ¿la
 * instancia existe? sino ¿WhatsApp le contesta?
 *
 * Se usa `fetchAllGroups` con `getParticipants=false` porque es la operación de LECTURA más
 * barata que igual obliga a hablar con WhatsApp. No manda nada ni toca ningún chat.
 */
export async function socketVivo(instance: string): Promise<boolean> {
  return (await sondearSocket(instance)) === 'vivo';
}

/**
 * Lo que contesta WhatsApp cuando se le habla de verdad. TRES respuestas.
 *
 * ⚠️ `socketVivo` devuelve un booleano, y ahí se pierde la distinción que más
 * caro sale en este repo: **«no pude preguntar» no es «está muerto»**. Las dos
 * daban `false`, así que un Evolution inalcanzable (DNS, timeout, la API caída)
 * se leía igual que una sesión cerrada — y con el chip nuevo, que grita
 * DESCONECTADA en ámbar y ofrece re-escanear, eso manda a re-vincular un número
 * que puede estar perfecto. Re-escanear TUMBA la sesión viva.
 *
 * El discriminador ya estaba y nadie lo miraba: `evFetch` devuelve `status: 0`
 * cuando ni siquiera llegó a Evolution, y el status HTTP real cuando Evolution
 * contestó. Un 500 con «Connection Closed» adentro es una MEDICIÓN —la sesión
 * está cerrada—; un status 0 es la ausencia de una.
 *
 * Medido el 08/09/2026 sobre las tres instancias del servidor:
 *     mako_ws1         connectionState=close  → operación real 500 «Connection Closed»
 *     mako_ws11        connectionState=open   → operación real 200 (grupos reales)
 *     mako_superadmin  connectionState=open   → operación real 500 «Connection Closed»
 * O sea que `open` no prueba que ande. Y ese mismo día la instancia del ws1
 * había contestado bien con `close`, así que `close` tampoco prueba que no.
 * La única pregunta que se puede contestar es la que se hace HABLANDO.
 */
export type Sondeo = 'vivo' | 'muerto' | 'sin_respuesta';

export async function sondearSocket(instance: string, topeMs?: number): Promise<Sondeo> {
  // ⚠️ ES CARO, Y NO HAY UNO BARATO QUE SIRVA. Medido el 08/09/2026 buscando
  // reemplazo: `whatsappNumbers` y `fetchProfile` contestan **200 en la
  // instancia MUERTA** —el segundo con todos los campos en null, que es el
  // «200 con el fallo adentro» de siempre— asi que dan vivo sobre una sesion
  // cerrada. El unico que de verdad exige el socket es traer los grupos, y en
  // una cuenta con muchos tarda: `mako_ws11` TIMEOUTEO a los 30s.
  // Por eso quien lo llame desde una pantalla le pasa su propio tope y trata
  // el `sin_respuesta` como lo que es: no sabemos.
  const r = await evFetch(`/group/fetchAllGroups/${encodeURIComponent(instance)}?getParticipants=false`, undefined, topeMs);
  if (r.ok) return 'vivo';
  // status 0 = no llegamos a Evolution: eso no es un dato sobre la sesión.
  return r.status === 0 ? 'sin_respuesta' : 'muerto';
}

/**
 * Un error de Evolution que significa «la sesión de WhatsApp está caída», no «tu dato está
 * mal». Los dos llegan como 500 y hay que poder distinguirlos: de quién es el problema
 * cambia el mensaje entero.
 */
export function esSesionCaida(e: string): boolean {
  return /connection closed|precondition required|\b428\b/i.test(e || '');
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
  // ⚠️ «open» NO ALCANZA PARA DECIR «conectado»: la instancia de la voz de MaKo devolvía
  // exactamente eso mientras WhatsApp contestaba «Connection Closed» a todo. Antes de
  // pintar el verde se confirma con una lectura que SÍ habla con WhatsApp (`socketVivo`).
  // Cuesta una llamada más, y es la diferencia entre un panel que informa y uno que miente.
  //
  // ⚠️ Y LA CONFIRMACIÓN ERA DE UN SOLO LADO, QUE ES MEDIA CONFIRMACIÓN. Se
  // confirmaba el `open` y se aceptaba el `close` a ciegas — sobre un campo del
  // que este mismo repo tiene MEDIDO que miente en las DOS direcciones el
  // 08/09/2026 (`lib/canal-vigilante.ts`: `mako_ws1 state=close → funciona`).
  // Un chequeo que sólo desconfía cuando la respuesta le gusta no es un
  // chequeo: es un sesgo. Y el precio del lado que faltaba es el caro — con el
  // chip nuevo, un `close` falso le dice al dueño que re-escanee un QR, y
  // re-escanear TUMBA la sesión que estaba viva.
  //
  // Ahora manda el sondeo en los dos sentidos, y `sin_respuesta` no decide
  // nada: cae en 'error', que es «no pude comprobarlo» y no acusa a nadie.
  // `conectando` se respeta tal cual — es el QR en pantalla, y ahí la operación
  // real todavía tiene que fallar.
  let estado = mapEstado(r.data.instance?.state);
  if (estado !== 'conectando') {
    const sondeo = await sondearSocket(instance);
    estado = sondeo === 'vivo' ? 'conectado' : sondeo === 'muerto' ? 'desconectado' : 'error';
  }
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
  // ⚠️ «NO PUDE PREGUNTAR» NO SE GUARDA COMO ESTADO. La fila la lee el MOTOR
  // (`procesarEnvios` decide con `estado === 'conectado'`) y la pintan los
  // paneles, así que escribir 'error' ahí convierte un corte de red de dos
  // segundos en una desconexión persistida que nadie va a volver a mirar hasta
  // que alguien abra esta pantalla. Es la regla de la casa: «no poder leer un
  // dato no es un valor del dato».
  // Lo que sí se guarda es lo MEDIDO: vivo o muerto.
  if (estado !== 'error') {
    await upsertInstancia({
      estado,
      ...(numero ? { numero } : {}),
      ...(perfil ? { perfil_nombre: perfil } : {}),
      ...(estado === 'conectado' ? { ultima_conexion_at: new Date().toISOString() } : {}),
    });
  }
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
  // Desvincular vuelve TODO atrás, no solo la fila. Sin esto, el onboarding
  // seguía diciendo "conectado" para siempre y el motor seguía creyendo que
  // tenía por dónde mandar.
  await revertirEstadoNoOficial(ws).catch(() => {});
  // Idempotente: borrar algo que ya no existe (404) es el resultado deseado.
  return del.ok || del.status === 404 ? { ok: true } : { ok: false, error: del.error };
}

/**
 * Suelta el estado que quedó como consecuencia de haber vinculado un número.
 *
 * Se llama SOLO desde la acción explícita de desvincular, nunca desde el
 * webhook: Baileys emite `close` ante cualquier corte de red o reinicio del
 * celular, y colgar la reversión de ese evento haría que un parpadeo de
 * conexión reabra el onboarding del cliente.
 *
 * NO toca el paso de verificación por código: ese OTP sale por la línea de MaKo,
 * no por el número del cliente, así que re-pedirlo sería fricción sin motivo.
 */
export async function revertirEstadoNoOficial(ws: number): Promise<void> {
  // Imports dinámicos: evitan el ciclo evolution ↔ onboarding ↔ credenciales.
  const { runWithWorkspace } = await import('./workspace');
  const { desmarcarPasoEnTodasLasTabs } = await import('./tab-onboarding-state');
  const { setEnvioWhatsapp } = await import('./envio-flags');
  const { integracionConectada } = await import('./credenciales');
  await runWithWorkspace(ws, async () => {
    await desmarcarPasoEnTodasLasTabs('wa_no_oficial').catch(() => {});
    // Si tampoco hay canal oficial no queda por dónde enviar: el flag baja, en
    // vez de dejar la nutrición marcando "habilitado" contra un canal muerto.
    try { if (!(await integracionConectada('whatsapp'))) await setEnvioWhatsapp(false); } catch { /* no fatal */ }
  });
}

// ── Salud del "espejo de mensajes" (webhook) ─────────────────────────────────
// El síntoma clásico: WhatsApp CONECTA pero no aparece ningún chat, porque el
// webhook (Evolution → app) nunca se registró o apunta a otro deploy. Esto lo
// hace VISIBLE y reparable en vez de un fallo silencioso.
//   ok            → webhook activo Y el receiver responde 200 a nuestro secret.
//   sin_secret    → falta EVOLUTION_WEBHOOK_SECRET en ESTE server (no se puede activar).
//   secret_prod   → el deploy (APP_BASE_URL) rechaza nuestro secret (401): env de Vercel
//                   desalineado — NO lo arregla "reparar", hay que corregir Vercel.
//   url_distinta  → APP_BASE_URL no responde donde debería (dominio mal / caído).
//   no_registrado → el receiver acepta el secret, pero el webhook no está puesto en la
//                   instancia (o sin MESSAGES_UPSERT) → "reparar" lo registra y funciona.
//   error         → Evolution no respondió.
export type WebhookEstado = 'ok' | 'sin_secret' | 'secret_prod' | 'no_registrado' | 'url_distinta' | 'error';
export type WebhookSalud = { estado: WebhookEstado; urlActual: string | null; urlEsperada: string };

const sinQuery = (u: string) => u.split('?')[0];

/**
 * La URL del webhook lleva el secreto EN LA QUERY (webhookUrl()), y
 * EVOLUTION_WEBHOOK_SECRET es de PLATAFORMA: lo comparten todos los clientes.
 * Devolverla tal cual en WebhookSalud se la entregaba en claro a cualquier admin
 * de workspace —el guard de /api/whatsapp/evolution es 'admin del workspace', o
 * sea cualquier cliente— y con ese secreto se forjan webhooks de CUALQUIER otro.
 *
 * La UI solo usa `estado` (app/whatsapp/EvolutionConnect.tsx): las URLs viajaban
 * al browser sin que nadie las mirara. Se recortan acá, en el origen.
 */
const sinSecreto = (u: string | null): string | null => (u == null ? null : sinQuery(u));

// Verificación REAL de extremo a extremo: pingeamos NUESTRO propio receiver con el
// secret actual. Detecta lo que la comparación interna no ve — drift de secret entre
// deploys, o APP_BASE_URL apuntando a un dominio que no sirve esta app. El receiver
// responde 200 a un evento benigno con secret válido, 401 si el secret no coincide.
async function pingReceiver(url: string): Promise<number> {
  try {
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'webhook.health', instance: '__health__' }),
      signal: AbortSignal.timeout(6000),
    });
    return r.status;
  } catch { return 0; }
}

export async function estadoWebhook(): Promise<WebhookSalud> {
  const ws = await wsEstricto();
  const instance = instanceNameDeWs(ws);
  const esperada = webhookUrl();
  if (!WEBHOOK_SECRET) return { estado: 'sin_secret', urlActual: null, urlEsperada: sinQuery(esperada) };

  // 1) ¿El deploy en APP_BASE_URL acepta nuestro secret? (test real de reachability)
  //    Si esto falla, "reparar" no sirve: el problema está en el env de Vercel.
  const ping = await pingReceiver(esperada);
  if (ping === 401) return { estado: 'secret_prod', urlActual: null, urlEsperada: sinQuery(esperada) };
  if (ping !== 200) return { estado: 'url_distinta', urlActual: null, urlEsperada: sinQuery(esperada) };

  // 2) El receiver está OK; ahora chequeamos que el webhook esté puesto en la instancia.
  const r = await evFetch<{ enabled?: boolean; url?: string; events?: string[] } | null>(`/webhook/find/${encodeURIComponent(instance)}`);
  if (!r.ok) return { estado: 'error', urlActual: null, urlEsperada: sinQuery(esperada) };
  const cfg = r.data;
  if (!cfg || !cfg.enabled || !cfg.url) return { estado: 'no_registrado', urlActual: sinSecreto(cfg?.url ?? null), urlEsperada: sinQuery(esperada) };
  if (sinQuery(cfg.url) !== sinQuery(esperada)) return { estado: 'no_registrado', urlActual: sinSecreto(cfg.url), urlEsperada: sinQuery(esperada) };
  const events = (cfg.events ?? []).map((e) => String(e).toUpperCase());
  if (!events.includes('MESSAGES_UPSERT')) return { estado: 'no_registrado', urlActual: sinSecreto(cfg.url), urlEsperada: sinQuery(esperada) };
  return { estado: 'ok', urlActual: sinSecreto(cfg.url), urlEsperada: sinQuery(esperada) };
}

// (Re)registra el webhook y verifica que quedó. Lo usa el botón "Reparar espejo".
export async function repararWebhook(): Promise<{ ok: boolean; estado: WebhookEstado; error?: string }> {
  const ws = await wsEstricto();
  const instance = instanceNameDeWs(ws);
  if (!WEBHOOK_SECRET) return { ok: false, estado: 'sin_secret', error: 'Falta el secret del webhook de Evolution en la configuración de la plataforma — avisa al equipo técnico.' };
  const set = await setWebhook(instance);
  if (!set.ok) return { ok: false, estado: 'error', error: set.error };
  const v = await estadoWebhook();
  return { ok: v.estado === 'ok', estado: v.estado, error: v.estado === 'ok' ? undefined : 'El webhook se registró pero la verificación no dio OK.' };
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

const soloB64 = (s: string): string => (s.includes(',') ? s.split(',').pop()! : s); // saca el prefijo data:*;base64,

// Envía media (imagen/video/documento) por el no oficial. base64 PURO (sin prefijo
// data:). document exige fileName. `delay` simula un envío humano (anti-ban).
export async function enviarMedia(
  telefono: string,
  media: { base64: string; mimetype: string; fileName?: string; tipo: 'image' | 'video' | 'document' },
  caption?: string,
): Promise<EnvioResult> {
  const ws = await wsEstricto();
  const instance = instanceNameDeWs(ws);
  const num = (telefono || '').replace(/\D/g, '');
  if (!num) return { ok: false, error: 'teléfono inválido' };
  const media64 = soloB64(media.base64);
  if (!media64) return { ok: false, error: 'archivo vacío' };
  const delay = Math.round(Math.min(1200 + Math.floor(media64.length / 120), 6000) * (0.8 + Math.random() * 0.4));
  const body: Record<string, unknown> = { number: num, mediatype: media.tipo, mimetype: media.mimetype, media: media64, delay };
  if (media.fileName) body.fileName = media.fileName;
  if (caption) body.caption = caption;
  const r = await evFetch<{ key?: { id?: string; remoteJid?: string } }>(
    `/message/sendMedia/${encodeURIComponent(instance)}`,
    { method: 'POST', body: JSON.stringify(body) },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, id: r.data.key?.id ?? '', chatJid: r.data.key?.remoteJid ?? `${num}@s.whatsapp.net` };
}

// Envía una NOTA DE VOZ (PTT) por el no oficial. sendWhatsAppAudio (no sendMedia)
// para que salga como nota de voz; el delay muestra "grabando audio…" nativo.
export async function enviarAudio(telefono: string, base64: string): Promise<EnvioResult> {
  const ws = await wsEstricto();
  const instance = instanceNameDeWs(ws);
  const num = (telefono || '').replace(/\D/g, '');
  if (!num) return { ok: false, error: 'teléfono inválido' };
  const audio64 = soloB64(base64);
  if (!audio64) return { ok: false, error: 'audio vacío' };
  const delay = Math.round(Math.min(2000 + Math.floor(audio64.length / 90), 8000) * (0.8 + Math.random() * 0.4));
  const r = await evFetch<{ key?: { id?: string; remoteJid?: string } }>(
    `/message/sendWhatsAppAudio/${encodeURIComponent(instance)}`,
    { method: 'POST', body: JSON.stringify({ number: num, audio: audio64, delay, encoding: true }) },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, id: r.data.key?.id ?? '', chatJid: r.data.key?.remoteJid ?? `${num}@s.whatsapp.net` };
}

// Foto de perfil de WhatsApp de un número (URL efímera del CDN, o null si no tiene
// / es privada / no está en WhatsApp). Best-effort: no lanza.
export async function fetchProfilePic(telefono: string): Promise<string | null> {
  const num = (telefono || '').replace(/\D/g, '');
  if (!num) return null;
  const ws = await wsEstricto();
  const instance = instanceNameDeWs(ws);

  // PRIMERO la que ya tenemos guardada. El importador la trae en lote junto con
  // la agenda, así que para el que la tiene está a una query de distancia.
  // Antes se empezaba por el endpoint en vivo, que —medido contra la instancia
  // real— devolvió null en 15 de 15 contactos, incluidos 10 que SÍ tenían foto
  // en el cache: o sea, una request perdida por avatar y, cuando tardaba, el
  // <img> fallaba y quedaban las iniciales de alguien que sí tiene foto.
  try {
    const { getFotoContacto } = await import('./evolution-contactos');
    const guardada = await getFotoContacto(num);
    if (guardada) return guardada;
  } catch { /* seguimos por Evolution */ }

  const r = await evFetch<{ profilePictureUrl?: string | null }>(
    `/chat/fetchProfilePictureUrl/${encodeURIComponent(instance)}`,
    { method: 'POST', body: JSON.stringify({ number: num }) },
  );
  if (r.ok && r.data.profilePictureUrl) return r.data.profilePictureUrl;
  // Fallback: el profilePicUrl CACHEADO de findContacts (lo que muestra la UI de
  // Evolution). fetchProfilePictureUrl (en vivo) devuelve null seguido si el
  // contacto no está agendado; el cache suele tenerla igual.
  return fetchContactoPicUrl(num);
}

// Foto de perfil cacheada (tabla Contact de Evolution) vía findContacts. Best-effort.
export async function fetchContactoPicUrl(telefono: string): Promise<string | null> {
  const num = (telefono || '').replace(/\D/g, '');
  const ws = await getWorkspaceActual();
  if (ws == null || !num || !evolutionConfigurado()) return null;
  const instance = instanceNameDeWs(ws);
  const r = await evFetch<Array<{ remoteJid?: string; profilePicUrl?: string | null }>>(
    `/chat/findContacts/${encodeURIComponent(instance)}`,
    { method: 'POST', body: JSON.stringify({ where: { remoteJid: `${num}@s.whatsapp.net` } }) },
  );
  if (!r.ok || !Array.isArray(r.data)) return null;
  return r.data.find((c) => c.profilePicUrl)?.profilePicUrl ?? null;
}

/**
 * La AGENDA completa, en UNA request. findChats devuelve `pushName` solo cuando
 * el contacto se puso un nombre a sí mismo, que es la minoría — por eso la lista
 * se veía llena de números. findContacts, en cambio, devuelve la libreta que el
 * teléfono sincronizó, con el nombre que el dueño le puso a cada uno.
 * Best-effort: [] ante cualquier fallo.
 */
export async function fetchContactosEvolution(): Promise<Array<{ remoteJid: string; nombre: string | null; fotoUrl: string | null }>> {
  const ws = await getWorkspaceActual();
  if (ws == null || !evolutionConfigurado()) return [];
  const instance = instanceNameDeWs(ws);
  const r = await evFetch<Array<{ remoteJid?: string; pushName?: string | null; name?: string | null; profilePicUrl?: string | null }>>(
    `/chat/findContacts/${encodeURIComponent(instance)}`,
    { method: 'POST', body: JSON.stringify({}) },
  );
  if (!r.ok || !Array.isArray(r.data)) return [];
  return r.data
    .filter((c) => c.remoteJid && !c.remoteJid.endsWith('@g.us'))
    .map((c) => ({ remoteJid: c.remoteJid as string, nombre: c.name ?? c.pushName ?? null, fotoUrl: c.profilePicUrl ?? null }));
}

// ── Lectura EN VIVO desde Evolution (no depende del webhook) ─────────────────
// El espejo en DB se llena SOLO con el webhook; si no está registrado, el inbox
// sale vacío aunque Evolution SÍ tenga los mensajes. Estas funciones leen directo
// del store de Evolution (findMessages/findChats) para mostrar la conversación
// real con o sin webhook. Best-effort: [] ante cualquier fallo (NUNCA lanzan, así
// el inbox del admin sin impersonar o un Evolution caído no rompen la lectura).

// Record crudo de un mensaje de Evolution (mismo shape que el messages.upsert del
// webhook → se parsea con el mismo extraerContenido). OJO: findMessages NO trae la
// media en base64, sólo metadata (tipo/caption); los bytes los llena el webhook.
export type EvRecord = {
  key?: { id?: string; fromMe?: boolean; remoteJid?: string };
  pushName?: string; message?: Record<string, unknown>; messageType?: string;
  messageTimestamp?: number | string; MessageUpdate?: Array<{ status?: string }>;
};

// Mensajes de un chat, del más viejo al más nuevo (Evolution los da desc → los
// invertimos). limite = tamaño de página (en findMessages, `offset` es el take).
type PaginaMensajes = { records: EvRecord[]; total: number; pages: number };

/**
 * Una página cruda de findMessages. Devuelve además el TOTAL que informa
 * Evolution, que es el dato que faltaba: sin él no había forma de saber que a
 * un chat con 2.139 mensajes le estábamos pidiendo 60.
 *
 * Contrato verificado en vivo contra Evolution v2.3.7: `offset` es el tamaño de
 * página y `page` avanza de verdad (page=2 devuelve ids distintos de page=1).
 * Los records vienen del más nuevo al más viejo.
 */
async function paginaMensajes(instance: string, chatJid: string, offset: number, page: number): Promise<PaginaMensajes> {
  const r = await evFetch<{ messages?: { records?: EvRecord[]; total?: number; pages?: number } } | EvRecord[]>(
    `/chat/findMessages/${encodeURIComponent(instance)}`,
    { method: 'POST', body: JSON.stringify({ where: { key: { remoteJid: chatJid } }, page, offset }) },
  );
  if (!r.ok) return { records: [], total: 0, pages: 0 };
  const d = r.data as { messages?: { records?: EvRecord[]; total?: number; pages?: number } } | EvRecord[];
  if (Array.isArray(d)) return { records: d, total: d.length, pages: 1 };
  return {
    records: Array.isArray(d?.messages?.records) ? d.messages.records : [],
    total: Number(d?.messages?.total ?? 0),
    pages: Number(d?.messages?.pages ?? 0),
  };
}

export async function fetchMensajesEvolution(chatJid: string, limite = 300): Promise<EvRecord[]> {
  const ws = await getWorkspaceActual();
  if (ws == null || !evolutionConfigurado() || !chatJid) return [];
  const { records } = await paginaMensajes(instanceNameDeWs(ws), chatJid, limite, 1);
  return records.slice().reverse(); // desc → asc
}

/**
 * Los mensajes que importan de una conversación: los ÚLTIMOS `recientes` y —si
 * la charla es más larga— los PRIMEROS `arranque`.
 *
 * El arranque no es un capricho: es el tramo donde el contacto todavía era un
 * desconocido y se le escribía vendiendo y calificando. Meses después el mismo
 * chat es de un cliente (a veces un amigo) y el tono no se parece en nada, así
 * que aprender solo de la cola enseña a escribirle a un lead nuevo como a un
 * conocido. Antes era inalcanzable: findMessages devuelve del más nuevo al más
 * viejo, y sin pedir la ÚLTIMA página el principio no existía.
 *
 * Devuelve en orden cronológico y sin repetidos.
 */
export async function fetchConversacionEvolution(
  chatJid: string,
  { recientes = 300, arranque = 100 }: { recientes?: number; arranque?: number } = {},
): Promise<{ mensajes: EvRecord[]; total: number }> {
  const ws = await getWorkspaceActual();
  if (ws == null || !evolutionConfigurado() || !chatJid) return { mensajes: [], total: 0 };
  const instance = instanceNameDeWs(ws);

  const p1 = await paginaMensajes(instance, chatJid, recientes, 1);
  const vistos = new Set<string>();
  const out: EvRecord[] = [];
  const sumar = (rs: EvRecord[]) => {
    for (const r of rs) {
      const id = String(r?.key?.id ?? '');
      if (!id || vistos.has(id)) continue;
      vistos.add(id);
      out.push(r);
    }
  };
  sumar(p1.records);

  // Solo si de verdad quedó historia afuera. La última página con tamaño
  // `arranque` son los mensajes más viejos de la conversación.
  if (p1.total > recientes) {
    const ultima = Math.max(1, Math.ceil(p1.total / arranque));
    const pn = await paginaMensajes(instance, chatJid, arranque, ultima);
    sumar(pn.records);
  }

  // Vienen del más nuevo al más viejo: se ordena por timestamp ascendente.
  out.sort((a, b) => Number(a?.messageTimestamp ?? 0) - Number(b?.messageTimestamp ?? 0));
  return { mensajes: out, total: p1.total };
}

// Resuelve el @lid asociado a un número (WhatsApp direcciona a los contactos no
// agendados por ese alias). POST /chat/whatsappNumbers → [{ jid, exists, lid }].
// Sólo funciona si Evolution ya "aprendió" el mapeo. null si no hay. Best-effort.
export async function fetchLidDeNumero(telefono: string): Promise<string | null> {
  const num = (telefono || '').replace(/\D/g, '');
  const ws = await getWorkspaceActual();
  if (ws == null || !num || !evolutionConfigurado()) return null;
  const instance = instanceNameDeWs(ws);
  const r = await evFetch<Array<{ jid?: string; lid?: string | null; exists?: boolean }>>(
    `/chat/whatsappNumbers/${encodeURIComponent(instance)}`,
    { method: 'POST', body: JSON.stringify({ numbers: [num] }) },
  );
  if (!r.ok || !Array.isArray(r.data)) return null;
  const lid = r.data[0]?.lid;
  if (!lid) return null;
  return lid.includes('@lid') ? lid : `${lid.replace(/\D/g, '')}@lid`;
}

// ── Etiquetas (labels) de WhatsApp Business ──────────────────────────────────
// No se pueden CREAR por API (se crean en el celular y llegan por labels.edit);
// sólo se listan y se asignan/quitan a un número. Best-effort.
export type EvLabel = { id: string; name: string | null; color: number | null };
export async function listarLabelsEvolution(): Promise<EvLabel[]> {
  const ws = await getWorkspaceActual();
  if (ws == null || !evolutionConfigurado()) return [];
  const instance = instanceNameDeWs(ws);
  const r = await evFetch<Array<{ id?: string; labelId?: string; name?: string; color?: number | string }>>(`/label/findLabels/${encodeURIComponent(instance)}`);
  if (!r.ok || !Array.isArray(r.data)) return [];
  return r.data.map((l) => ({ id: String(l.id ?? l.labelId ?? ''), name: l.name ?? null, color: l.color != null ? Number(l.color) : null })).filter((l) => l.id);
}

// Asigna/quita una etiqueta a un número. action: 'add' | 'remove'. Best-effort.
export async function asignarLabel(telefono: string, labelId: string, action: 'add' | 'remove'): Promise<boolean> {
  const num = (telefono || '').replace(/\D/g, '');
  const ws = await getWorkspaceActual();
  if (ws == null || !num || !labelId || !evolutionConfigurado()) return false;
  const instance = instanceNameDeWs(ws);
  const r = await evFetch(`/label/handleLabel/${encodeURIComponent(instance)}`, {
    method: 'POST', body: JSON.stringify({ number: num, labelId, action }),
  });
  return r.ok;
}

export type EvChat = { remoteJid?: string; pushName?: string; profilePicUrl?: string | null; unreadCount?: number; updatedAt?: string; lastMessage?: EvRecord };

// Lista de chats del store de Evolution (los que tienen al menos un mensaje).
export async function fetchChatsEvolution(): Promise<EvChat[]> {
  const ws = await getWorkspaceActual();
  if (ws == null || !evolutionConfigurado()) return [];
  const instance = instanceNameDeWs(ws);
  const r = await evFetch<EvChat[] | { chats?: EvChat[] }>(
    `/chat/findChats/${encodeURIComponent(instance)}`,
    { method: 'POST', body: JSON.stringify({}) },
  );
  if (!r.ok) return [];
  const d = r.data;
  const arr = Array.isArray(d) ? d : ((d as { chats?: EvChat[] } | null)?.chats ?? []);
  return Array.isArray(arr) ? arr : [];
}

// Bytes de la media de un mensaje EN UNA INSTANCIA DADA (el webhook con base64:true
// no siempre adjunta el audio inline → se pide aparte a la MISMA línea que lo
// recibió). POST /chat/getBase64FromMediaMessage. Best-effort: null si falla.
export async function fetchMediaBase64EnInstancia(instance: string, chatJid: string, waMessageId: string, fromMe: boolean): Promise<{ base64: string; mimetype: string } | null> {
  if (!instance || !waMessageId || !evolutionConfigurado()) return null;
  const r = await evFetch<{ base64?: string; mimetype?: string; message?: { base64?: string } }>(
    `/chat/getBase64FromMediaMessage/${encodeURIComponent(instance)}`,
    { method: 'POST', body: JSON.stringify({ message: { key: { id: waMessageId, remoteJid: chatJid, fromMe } }, convertToMp4: false }) },
  );
  if (!r.ok) return null;
  const b64 = r.data?.base64 || r.data?.message?.base64;
  if (!b64) return null;
  return { base64: soloB64(b64), mimetype: r.data?.mimetype || 'application/octet-stream' };
}

// Bytes de la media de un mensaje (findMessages NO trae base64 → se pide aparte).
// Usa la instancia del workspace actual. Best-effort: null si falla.
export async function fetchMediaBase64(chatJid: string, waMessageId: string, fromMe: boolean): Promise<{ base64: string; mimetype: string } | null> {
  const ws = await getWorkspaceActual();
  if (ws == null) return null;
  return fetchMediaBase64EnInstancia(instanceNameDeWs(ws), chatJid, waMessageId, fromMe);
}

// Muestra "escribiendo…"/"grabando…" en el chat mientras MaKo razona (feedback al
// dueño de que sí está trabajando). Best-effort, no bloquea. delay = ms que dura.
export async function enviarPresencia(instance: string, jid: string, presence: 'composing' | 'recording' | 'paused' = 'composing', delayMs = 3000): Promise<void> {
  if (!instance || !jid || !evolutionConfigurado()) return;
  await evFetch(`/chat/sendPresence/${encodeURIComponent(instance)}`, {
    method: 'POST', body: JSON.stringify({ number: jid, delay: delayMs, presence }),
  }).catch(() => {});
}

// Estado (tick) de un record de Evolution → nuestro status (0-5 de Baileys / string).
export function statusDeRecord(rec: EvRecord): string | null {
  const s = rec.MessageUpdate?.[rec.MessageUpdate.length - 1]?.status;
  if (!s) return rec.key?.fromMe ? 'sent' : null;
  const up = String(s).toUpperCase();
  if (up.includes('READ')) return 'read';
  if (up.includes('DELIV')) return 'delivered';
  if (up.includes('SERVER') || up.includes('SENT')) return 'sent';
  if (up.includes('ERROR') || up.includes('FAIL')) return 'failed';
  return rec.key?.fromMe ? 'sent' : null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
// '5216863996369@s.whatsapp.net' → '5216863996369'
export function jidToNumero(jid: string | null): string | null {
  if (!jid) return null;
  return jid.replace(/@.*/, '').replace(/:.*/, '') || null;
}
