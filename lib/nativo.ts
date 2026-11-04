// =============================================================================
// nativo — lo que la app de iPhone hace con el aparato (Capacitor) y un navegador no puede (3/11/2026)
// =============================================================================
// Plan: docs/tiendas-play-appstore.md, pasos 8 y 9. La app es hola-mako.com dentro de Capacitor (`server.url`), así que la web NO importa
// los plugins (no hay bundle propio): Capacitor los inyecta en `window.Capacitor.Plugins` adentro de la app, y afuera no existen.
//   · GUARDAR Y COMPARTIR: en WKWebView `<a download>` no hace nada. `instalarDescargas` lo ataja para TODA la app, sin tocar los
//     treinta lugares que lo usan: el archivo va a la hoja de compartir de iOS, que tiene «Guardar en Fotos» y «Guardar en Archivos».
//   · LINKS UNIVERSALES: un link de hola-mako.com abre la app, y la app tiene que ir a esa pantalla (`appUrlOpen`).
//   · HÁPTICOS: `lib/haptico.ts` los pide acá primero.
//   · PUSH: Web Push no existe adentro de una app con WebView: acá es APNs (`lib/push-cliente.ts` pregunta primero por esto).
//
// ⚠️ MÓDULO DE NAVEGADOR: nada toca `window` al importarse. Afuera de la app, `esAppNativa()` es false y todo lo de acá no hace nada.
// ⚠️ LA TWA DE ANDROID NO PASA POR ACÁ: es Chrome, y `<a download>`, los hápticos y el Web Push andan como siempre.
// =============================================================================

import { rutaDeLinkDeLaApp } from './tienda';

type PluginesCap = {
  Filesystem?: {
    writeFile(o: { path: string; data: string; directory: string; recursive?: boolean }): Promise<{ uri: string }>;
    appendFile(o: { path: string; data: string; directory: string }): Promise<void>;
  };
  Share?: { share(o: { title?: string; text?: string; url?: string; files?: string[]; dialogTitle?: string }): Promise<unknown> };
  Haptics?: { notification(o: { type: 'SUCCESS' | 'ERROR' | 'WARNING' }): Promise<void>; impact(o: { style: 'LIGHT' | 'MEDIUM' | 'HEAVY' }): Promise<void> };
  App?: { addListener(ev: 'appUrlOpen', fn: (e: { url: string }) => void): Promise<unknown> };
  PushNotifications?: {
    checkPermissions(): Promise<{ receive: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' }>;
    requestPermissions(): Promise<{ receive: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' }>;
    register(): Promise<void>;
    unregister?(): Promise<void>;
    addListener(ev: 'registration', fn: (t: { value: string }) => void): Promise<unknown>;
    addListener(ev: 'registrationError', fn: (e: { error: string }) => void): Promise<unknown>;
    addListener(ev: 'pushNotificationActionPerformed', fn: (a: { notification?: { data?: { url?: string } } }) => void): Promise<unknown>;
  };
};

function plugines(): PluginesCap | null {
  if (typeof window === 'undefined') return null;
  const c = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: PluginesCap } }).Capacitor;
  return c?.isNativePlatform?.() ? (c.Plugins ?? null) : null;
}

/** ¿Corre adentro de la app de iPhone? Del lado del navegador: el servidor pregunta por la marca del user agent (lib/tienda.ts). */
export const esAppNativa = (): boolean => plugines() != null;

// ── Guardar y compartir ─────────────────────────────────────────────────────────

/** De a cuánto se escribe un archivo. Un video son cientos de MB: en base64 de una, el WebView se queda sin memoria y se cierra. */
const TROZO = 3 * 1024 * 1024; // múltiplo de 3: cada trozo es base64 válido por sí solo, sin relleno en el medio.
const DIRECTORIO = 'CACHE';

function aBase64(trozo: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error ?? new Error('no pude leer el archivo'));
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.readAsDataURL(trozo);
  });
}

/** Un nombre que sirve de ruta: sin barras ni nada que salga de la carpeta. */
export function nombreSeguro(nombre: string): string {
  const limpio = String(nombre ?? '').replace(/[/\\:*?"<>|\u0000-\u001f]/g, '-').replace(/^\.+/, '').trim().slice(0, 120);
  return limpio || 'archivo-de-mako';
}

/** Lleva un archivo a la hoja de compartir de iOS. `false` = no estamos en la app, o no se pudo. Cerrar la hoja sin elegir no es un error. */
export async function guardarEnElAparato(archivo: Blob, nombre: string): Promise<boolean> {
  const p = plugines();
  if (!p?.Filesystem || !p.Share) return false;
  const path = nombreSeguro(nombre);
  try {
    let uri = '';
    for (let i = 0; i < Math.max(archivo.size, 1); i += TROZO) {
      const data = await aBase64(archivo.slice(i, i + TROZO));
      if (i === 0) uri = (await p.Filesystem.writeFile({ path, data, directory: DIRECTORIO, recursive: true })).uri;
      else await p.Filesystem.appendFile({ path, data, directory: DIRECTORIO });
    }
    await p.Share.share({ title: path, files: [uri], dialogTitle: path }).catch(() => {});
    return true;
  } catch (e) {
    console.error('[nativo] no pude guardar el archivo:', e instanceof Error ? e.message : String(e));
    return false;
  }
}

/**
 * Ataja `<a download>` en TODA la app: el `a.click()` de quien arma un blob (el video, los códigos de recuperación, un CSV) y el toque en un
 * link con `download`. Devuelve cómo sacarlo.
 *
 * ⚠️ EL BLOB SE GUARDA AL CREARLO, y no se pide por su URL: casi todos hacen `a.click(); URL.revokeObjectURL(url);` en la misma línea,
 * así que para cuando el trabajo asíncrono empieza la URL ya no existe. Por eso `createObjectURL` queda envuelto y `click` lo busca
 * en el acto. La memoria se ata a las últimas 8: un blob retenido es un video entero en memoria.
 */
export function instalarDescargas(): () => void {
  if (!esAppNativa()) return () => {};
  const blobs = new Map<string, Blob>();
  const crearOriginal = URL.createObjectURL.bind(URL);
  const revocarOriginal = URL.revokeObjectURL.bind(URL);
  const clickOriginal = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (o: Blob | MediaSource) => {
    const u = crearOriginal(o);
    if (o instanceof Blob) {
      blobs.set(u, o);
      if (blobs.size > 8) blobs.delete(blobs.keys().next().value as string);
    }
    return u;
  };
  URL.revokeObjectURL = (u: string) => { blobs.delete(u); revocarOriginal(u); };

  const llevar = (a: HTMLAnchorElement): boolean => {
    const enMemoria = blobs.get(a.href);
    const nombre = a.download || decodeURIComponent(a.pathname.split('/').pop() ?? '') || 'archivo-de-mako';
    if (enMemoria) { void guardarEnElAparato(enMemoria, nombre); return true; }
    // Un `<a download href="#">` no baja nada: bajaría la página.
    const crudo = a.getAttribute('href') ?? '';
    if (!crudo || crudo.startsWith('#')) return false;
    if (/^(blob|data):/.test(a.href) || new URL(a.href, location.href).origin === location.origin) {
      // Un 401 o un 500 no es un archivo: compartir su JSON con el nombre del PDF es peor que no hacer nada.
      void fetch(a.href).then((r) => (r.ok ? r.blob() : null)).then((b) => (b ? guardarEnElAparato(b, nombre) : false)).catch(() => {});
      return true;
    }
    return false;
  };

  HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
    if (this.hasAttribute('download') && llevar(this)) return;
    clickOriginal.call(this);
  };
  const alTocar = (e: MouseEvent) => {
    const a = (e.target as Element | null)?.closest?.('a[download]') as HTMLAnchorElement | null;
    if (a && llevar(a)) e.preventDefault();
  };
  document.addEventListener('click', alTocar, true);
  return () => {
    URL.createObjectURL = crearOriginal;
    URL.revokeObjectURL = revocarOriginal;
    HTMLAnchorElement.prototype.click = clickOriginal;
    document.removeEventListener('click', alTocar, true);
  };
}

// ── Hápticos ────────────────────────────────────────────────────────────────────

/** `true` = lo hizo el aparato, y `lib/haptico.ts` no sigue. */
export function hapticoNativo(tipo: 'success' | 'error' | 'light' | 'medium'): boolean {
  const h = plugines()?.Haptics;
  if (!h) return false;
  const pedido = tipo === 'success' ? h.notification({ type: 'SUCCESS' })
    : tipo === 'error' ? h.notification({ type: 'ERROR' })
      : h.impact({ style: tipo === 'light' ? 'LIGHT' : 'MEDIUM' });
  pedido.catch(() => {});
  return true;
}

// ── Los links que abren la app ──────────────────────────────────────────────────

/** Un link universal, o el toque en un aviso: va a esa pantalla, si es de MaKo. Lo demás no se abre. */
function irALaRuta(url: string | undefined): void {
  const ruta = rutaDeLinkDeLaApp(url);
  if (ruta) window.location.assign(ruta);
}

// ── Push por APNs ───────────────────────────────────────────────────────────────

const CLAVE_TOKEN = 'mako-apns-token';
const leerToken = (): string | null => { try { return localStorage.getItem(CLAVE_TOKEN); } catch { return null; } };
const guardarToken = (t: string | null) => { try { if (t) localStorage.setItem(CLAVE_TOKEN, t); else localStorage.removeItem(CLAVE_TOKEN); } catch { /* sin storage: se vuelve a pedir */ } };

let esperando: Array<(t: string | null) => void> = [];
const avisarToken = (t: string | null) => { const v = esperando; esperando = []; v.forEach((f) => f(t)); };

async function mandarToken(token: string): Promise<{ ok: boolean; guardado: boolean }> {
  try {
    const r = await fetch('/api/push/suscripcion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apns: { token } }) });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; guardado?: boolean } | null;
    return { ok: r.ok && j?.ok === true, guardado: j?.guardado === true };
  } catch {
    return { ok: false, guardado: false };
  }
}

/** En qué estado están los avisos de ESTE iPhone. Lee: no pide nada. */
export async function estadoAvisosNativo(): Promise<'bloqueado' | 'apagado' | 'activo' | 'no-soportado'> {
  const pn = plugines()?.PushNotifications;
  if (!pn) return 'no-soportado';
  const { receive } = await pn.checkPermissions();
  if (receive === 'denied') return 'bloqueado';
  return receive === 'granted' && leerToken() ? 'activo' : 'apagado';
}

/** Pide el permiso y el token, y lo ata a la persona en el servidor. El token llega por un evento: se espera con un techo. */
export async function activarAvisosNativo(): Promise<{ ok: true } | { ok: false; estado: 'bloqueado' | 'apagado' | 'no-soportado' | 'sin-cuenta' | 'error'; detalle?: string }> {
  const pn = plugines()?.PushNotifications;
  if (!pn) return { ok: false, estado: 'no-soportado' };
  const { receive } = await pn.requestPermissions();
  if (receive !== 'granted') return { ok: false, estado: receive === 'denied' ? 'bloqueado' : 'apagado' };
  const token = await new Promise<string | null>((resolve) => {
    const t = setTimeout(() => resolve(null), 15_000);
    esperando.push((v) => { clearTimeout(t); resolve(v); });
    pn.register().catch(() => avisarToken(null));
  });
  if (!token) return { ok: false, estado: 'error', detalle: 'el iPhone no dio un token' };
  const r = await mandarToken(token);
  if (!r.ok) return { ok: false, estado: 'error', detalle: 'registro' };
  if (!r.guardado) return { ok: false, estado: 'sin-cuenta' };
  guardarToken(token);
  return { ok: true };
}

async function borrarToken(token: string, opts: { timeoutMs?: number } = {}): Promise<boolean> {
  try {
    const r = await fetch('/api/push/suscripcion', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apns: { token } }),
      ...(opts.timeoutMs ? { signal: AbortSignal.timeout(opts.timeoutMs) } : {}),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Apaga los avisos de ESTE iPhone. */
export async function desactivarAvisosNativo(): Promise<boolean> {
  const token = leerToken();
  if (!token) return true;
  const ok = await borrarToken(token);
  if (ok) guardarToken(null);
  return ok;
}

/** Al cerrar sesión: suelta la fila para que no sigan llegando los avisos de quien salió. El permiso y el token del iPhone quedan. */
export async function soltarAvisosNativo(): Promise<void> {
  const token = leerToken();
  if (token) await borrarToken(token, { timeoutMs: 4_000 });
}

/** Si ya estaba activo: vuelve a atarlo a quien entró (otra cuenta en el mismo iPhone mueve la fila, como `asegurarRegistro`). */
export async function asegurarAvisosNativo(): Promise<boolean> {
  const token = leerToken();
  return token ? (await mandarToken(token)).guardado : false;
}

// ── Lo que se engancha una vez, al abrir la app ─────────────────────────────────

/** Lo llama `PuenteNativo`. Devuelve cómo soltar lo que se pueda. */
export function engancharApp(): () => void {
  const p = plugines();
  if (!p) return () => {};
  const soltar = instalarDescargas();
  void p.App?.addListener('appUrlOpen', (e) => irALaRuta(e.url));
  const pn = p.PushNotifications;
  if (pn) {
    void pn.addListener('registration', (t) => avisarToken(t.value));
    void pn.addListener('registrationError', () => avisarToken(null));
    void pn.addListener('pushNotificationActionPerformed', (a) => irALaRuta(a.notification?.data?.url));
  }
  return soltar;
}
