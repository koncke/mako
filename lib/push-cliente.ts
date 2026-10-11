// =============================================================================
// push-cliente — el lado del NAVEGADOR de los Web Push de MaKo Mobile
// =============================================================================
// Sin dependencias y sin `'use client'` (no es un componente: es un módulo que llaman los
// componentes cliente de /m/cuenta y del shell de /m). Todo lo que toca `window` o
// `navigator` lo toca al LLAMARSE, nunca al importarse, así que importarlo no rompe un render
// del server. NO importa lib/push.ts (server-only): las claves y el envío viven allá.
//
// Las piezas del otro lado:
//   GET    /api/push/clave        → { publicKey }            (con sesión)
//   POST   /api/push/suscripcion  → upsert de ESTE teléfono  (atado a la PERSONA)
//   DELETE /api/push/suscripcion  → baja de ESTE teléfono
//   POST   /api/push/prueba       → una notificación de prueba a la propia persona
//   public/sw.js                  → muestra el push y abre el link al tocarlo
//
// ⚠️ iOS: Web Push existe SÓLO con la app INSTALADA (16.4+, «Agregar a inicio»). En una
// pestaña de Safari `PushManager` ni existe: eso es `instalar-primero`, no `no-soportado`.
// ⚠️ El permiso se pide DENTRO del gesto: `activarAvisos()` llama a `requestPermission()`
// antes de su primer `await`, así que hay que llamarla DIRECTO desde el `onClick`, sin un
// `await` antes (Safari pierde el gesto en la primera espera y contesta `denied` solo).
// =============================================================================

/** Lo que la pantalla necesita saber para dibujar el interruptor de «Avisos». */
export type EstadoAvisos =
  | 'no-soportado'      // este navegador no tiene Web Push (Firefox de iOS, un navegador viejo)
  | 'instalar-primero'  // iPhone/iPad en una pestaña de Safari: hay que instalar la app
  | 'bloqueado'         // la persona negó el permiso: sólo se destraba desde los ajustes del teléfono
  | 'apagado'           // se puede activar
  | 'activo';           // este teléfono está suscripto

export type ResultadoActivar =
  | { ok: true; estado: 'activo' }
  | { ok: false; estado: EstadoAvisos | 'sin-cuenta' | 'sin-claves' | 'error'; detalle?: string };

export type ResultadoPrueba = { ok: boolean; enviados: number; fallidos: number; sinSuscripciones: number; motivo?: string };

const SW_URL = '/sw.js';

const hayVentana = (): boolean => typeof window !== 'undefined' && typeof navigator !== 'undefined';

/** iPhone o iPad (el iPad moderno se presenta como Mac con pantalla táctil). */
function esIOS(): boolean {
  if (!hayVentana()) return false;
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
}

/** ¿Corre como app instalada? (iOS lo dice en `navigator.standalone`, el resto por media query). */
export function esAppInstalada(): boolean {
  if (!hayVentana()) return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  try { return window.matchMedia('(display-mode: standalone)').matches; } catch { return false; }
}

/** ¿Este navegador puede recibir Web Push AHORA (sin instalar nada más)? */
export function soportaPush(): boolean {
  return hayVentana() && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** El permiso de notificaciones, o `no-soportado`. */
export function permiso(): NotificationPermission | 'no-soportado' {
  if (!hayVentana() || !('Notification' in window)) return 'no-soportado';
  return Notification.permission;
}

/**
 * Registra el service worker (scope '/'). Lo llama el shell de /m al montar y `activarAvisos`
 * antes de suscribir. `updateViaCache: 'none'` para que un sw.js nuevo se tome en la próxima
 * visita (el server lo sirve además con Cache-Control no-store, ver next.config.ts).
 */
export async function registrarServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!hayVentana() || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(SW_URL, { scope: '/', updateViaCache: 'none' });
  } catch {
    return null;
  }
}

async function registro(): Promise<ServiceWorkerRegistration | null> {
  if (!hayVentana() || !('serviceWorker' in navigator)) return null;
  const ya = await navigator.serviceWorker.getRegistration('/').catch(() => undefined);
  if (ya) return ya;
  return registrarServiceWorker();
}

/** La clave pública VAPID en base64url → los bytes que pide `pushManager.subscribe`. */
function claveABytes(base64url: string): Uint8Array<ArrayBuffer> {
  const relleno = '='.repeat((4 - (base64url.length % 4)) % 4);
  const b64 = (base64url + relleno).replace(/-/g, '+').replace(/_/g, '/');
  const crudo = window.atob(b64);
  const out = new Uint8Array(new ArrayBuffer(crudo.length));
  for (let i = 0; i < crudo.length; i++) out[i] = crudo.charCodeAt(i);
  return out;
}

function mismosBytes(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const x = new Uint8Array(a);
  if (x.length !== b.length) return false;
  for (let i = 0; i < x.length; i++) if (x[i] !== b[i]) return false;
  return true;
}

async function clavePublica(): Promise<string | null> {
  try {
    const r = await fetch('/api/push/clave', { cache: 'no-store' });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; publicKey?: string } | null;
    return r.ok && j?.publicKey ? j.publicKey : null;
  } catch {
    return null;
  }
}

async function registrarEnServidor(sub: PushSubscription): Promise<{ ok: boolean; guardado: boolean }> {
  try {
    const r = await fetch('/api/push/suscripcion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suscripcion: sub.toJSON() }),
    });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; guardado?: boolean } | null;
    return { ok: r.ok && j?.ok === true, guardado: j?.guardado === true };
  } catch {
    return { ok: false, guardado: false };
  }
}

/** En qué estado está ESTE teléfono. Sólo lee: no pide permiso ni escribe nada. */
export async function estadoSuscripcion(): Promise<EstadoAvisos> {
  if (!soportaPush()) return esIOS() && !esAppInstalada() ? 'instalar-primero' : 'no-soportado';
  if (Notification.permission === 'denied') return 'bloqueado';
  const reg = await navigator.serviceWorker.getRegistration('/').catch(() => undefined);
  const sub = reg ? await reg.pushManager.getSubscription().catch(() => null) : null;
  return sub && Notification.permission === 'granted' ? 'activo' : 'apagado';
}

/**
 * Vuelve a registrar en el server la suscripción que ESTE teléfono ya tiene (upsert, sin
 * pedir permiso). Para el shell de /m al abrir: si la fila se borró (un 410 viejo) o el
 * teléfono pasó a otra cuenta, la vuelve a atar a quien está logueado ahora.
 */
export async function asegurarRegistro(): Promise<boolean> {
  if (!soportaPush() || Notification.permission !== 'granted') return false;
  const reg = await registro();
  const sub = reg ? await reg.pushManager.getSubscription().catch(() => null) : null;
  if (!sub) return false;
  return (await registrarEnServidor(sub)).guardado;
}

/**
 * Activa los avisos en ESTE teléfono: pide el permiso (DENTRO del gesto: llamarla directo
 * desde el onClick), se suscribe con la clave de /api/push/clave y registra la suscripción.
 */
export async function activarAvisos(): Promise<ResultadoActivar> {
  if (!soportaPush()) return { ok: false, estado: esIOS() && !esAppInstalada() ? 'instalar-primero' : 'no-soportado' };
  // ⚠️ PRIMERA línea con efecto: el pedido de permiso sale antes de cualquier `await`.
  const pedido: Promise<NotificationPermission> = Notification.permission === 'granted'
    ? Promise.resolve('granted')
    : new Promise((resolve) => {
      // Safari viejo sólo acepta el callback; los nuevos devuelven una promesa. Se cubren los dos.
      const r = Notification.requestPermission((p) => resolve(p));
      if (r && typeof (r as Promise<NotificationPermission>).then === 'function') (r as Promise<NotificationPermission>).then(resolve, () => resolve('default'));
    });
  const claveP = clavePublica();
  const regP = registro();
  const p = await pedido;
  if (p !== 'granted') return { ok: false, estado: p === 'denied' ? 'bloqueado' : 'apagado' };
  const [clave, reg0] = await Promise.all([claveP, regP]);
  if (!clave) return { ok: false, estado: 'sin-claves' };
  if (!reg0) return { ok: false, estado: 'error', detalle: 'service worker' };
  try {
    const reg = await navigator.serviceWorker.ready;
    const bytes = claveABytes(clave);
    let sub = await reg.pushManager.getSubscription();
    // Una suscripción hecha con OTRA clave (un par regenerado) no recibe nada: se rehace.
    if (sub && !mismosBytes(sub.options?.applicationServerKey, bytes)) {
      await sub.unsubscribe().catch(() => false);
      sub = null;
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
    const r = await registrarEnServidor(sub);
    if (!r.ok) return { ok: false, estado: 'error', detalle: 'registro' };
    if (!r.guardado) return { ok: false, estado: 'sin-cuenta' };
    return { ok: true, estado: 'activo' };
  } catch (e) {
    return { ok: false, estado: 'error', detalle: e instanceof Error ? e.message : String(e) };
  }
}

/** Apaga los avisos en ESTE teléfono (los otros teléfonos de la persona siguen). */
export async function desactivarAvisos(): Promise<boolean> {
  if (!soportaPush()) return false;
  const reg = await navigator.serviceWorker.getRegistration('/').catch(() => undefined);
  const sub = reg ? await reg.pushManager.getSubscription().catch(() => null) : null;
  if (!sub) return true;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => false);
  try {
    const r = await fetch('/api/push/suscripcion', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Al CERRAR SESIÓN: suelta la fila del server de ESTE teléfono (DELETE por endpoint, sólo si
 * es de quien está saliendo) SIN desuscribir el navegador. Sin esto, un teléfono que quedó
 * deslogueado seguía mostrando en la pantalla bloqueada los avisos de la persona que salió
 * —y del negocio de esa persona— hasta que otra entrara a /m. Quien entre después recupera
 * la suscripción sola (`asegurarRegistro`, en el shell de /m), sin volver a pedir permiso.
 *
 * Se llama ANTES del logout (el DELETE necesita la sesión), con techo corto: cerrar sesión
 * no espera a la red. Nunca tira.
 */
export async function soltarDeEstaCuenta(): Promise<void> {
  try {
    if (!soportaPush()) return;
    const reg = await navigator.serviceWorker.getRegistration('/').catch(() => undefined);
    const sub = reg ? await reg.pushManager.getSubscription().catch(() => null) : null;
    if (!sub) return;
    await fetch('/api/push/suscripcion', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
      signal: AbortSignal.timeout(4_000),
    });
  } catch { /* sin red: el próximo que entre la vuelve a atar a su cuenta */ }
}

/** Manda una notificación de prueba a la propia persona (a todos sus teléfonos). */
export async function probar(): Promise<ResultadoPrueba> {
  try {
    const r = await fetch('/api/push/prueba', { method: 'POST' });
    const j = (await r.json().catch(() => null)) as Partial<ResultadoPrueba> & { ok?: boolean } | null;
    return {
      ok: r.ok && j?.ok === true,
      enviados: Number(j?.enviados ?? 0),
      fallidos: Number(j?.fallidos ?? 0),
      sinSuscripciones: Number(j?.sinSuscripciones ?? 0),
      ...(j?.motivo ? { motivo: String(j.motivo) } : {}),
    };
  } catch {
    return { ok: false, enviados: 0, fallidos: 0, sinSuscripciones: 0, motivo: 'red' };
  }
}
