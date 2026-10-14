// =============================================================================
// sw.js — el service worker de MaKo Mobile: SÓLO push y click
// =============================================================================
// Scope '/', lo registra lib/push-cliente.ts. Lo sirve next.config.ts con Content-Type
// JavaScript, Cache-Control no-store y una CSP propia (guía de PWA de Next 16, §8).
//
// ⛔ SIN handler 'fetch', a propósito (docs/diseno-mako-mobile.md, «Service worker»): un
// caché offline puede servirle el HTML de una cuenta a OTRA en el mismo teléfono (hay admins
// que impersonan clientes y gente con dos cuentas). Este archivo no intercepta ningún pedido.
//
// ⚠️ TODO 'push' MUESTRA UNA NOTIFICACIÓN, siempre: la suscripción es `userVisibleOnly`, y
// Safari REVOCA la suscripción de un sitio que recibe un push y no muestra nada. Un payload
// ilegible igual dibuja una genérica.
//
// El payload lo arma lib/push-payload.ts: { titulo, cuerpo, url, tag, badge? }.
// =============================================================================

self.addEventListener('install', () => {
  // Un sw.js nuevo toma el control sin esperar a que se cierren las pestañas viejas.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch (e) {
    try { datos = { cuerpo: event.data ? event.data.text() : '' }; } catch (e2) { datos = {}; }
  }
  const titulo = typeof datos.titulo === 'string' && datos.titulo ? datos.titulo : 'MaKo';
  const cuerpo = typeof datos.cuerpo === 'string' ? datos.cuerpo : '';
  // `renotify` exige un tag: sin tag, Chrome tira TypeError y no muestra NADA.
  const tag = typeof datos.tag === 'string' && datos.tag ? datos.tag : 'mako';
  const url = typeof datos.url === 'string' && datos.url ? datos.url : '/general';

  const tareas = [
    self.registration.showNotification(titulo, {
      body: cuerpo,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag,
      renotify: true,
      data: { url },
    }),
  ];
  // El número en el ícono de la app, donde exista (Chrome de Android/escritorio, iOS 16.4+ instalada).
  if (typeof datos.badge === 'number' && datos.badge >= 0 && self.navigator && 'setAppBadge' in self.navigator) {
    tareas.push(
      (datos.badge > 0 ? self.navigator.setAppBadge(datos.badge) : self.navigator.clearAppBadge()).catch(() => undefined),
    );
  }
  event.waitUntil(Promise.all(tareas));
});

/**
 * El link del push, siempre en ESTE origen. Lo arma el server con su dominio canónico; si el
 * service worker vive en otro (un preview, el dominio viejo), se abre la MISMA ruta acá: la app
 * instalada es la de este origen, y un link a otro abriría el navegador afuera de la app.
 */
function urlPropia(cruda) {
  try {
    const u = new URL(cruda, self.location.origin);
    if (u.origin === self.location.origin) return u.href;
    return new URL(u.pathname + u.search + u.hash, self.location.origin).href;
  } catch (e) {
    return new URL('/general', self.location.origin).href;
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = urlPropia(event.notification.data && event.notification.data.url);
  event.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Primero una ventana de la app que ya esté abierta: se enfoca y se lleva al destino.
    for (const v of ventanas) {
      if (!v.url || new URL(v.url).origin !== self.location.origin) continue;
      try {
        const enfocada = 'focus' in v ? await v.focus() : v;
        if ('navigate' in enfocada) {
          // `navigate` sólo anda sobre una ventana CONTROLADA por este SW; si falla, se abre otra.
          const navegada = await enfocada.navigate(destino).catch(() => null);
          if (navegada) return;
        }
      } catch (e) { /* sigue con la próxima, o abre una */ }
    }
    if (self.clients.openWindow) await self.clients.openWindow(destino);
  })());
});

/**
 * El navegador rotó la suscripción (la venció, cambió el servicio de push): se rehace con la
 * clave pública de /api/push/clave y se registra de nuevo. Los pedidos salen con la cookie de
 * sesión (mismo origen) y con el header Origin del sitio, que es lo que pide el proxy en un POST.
 * Sin sesión no hay a quién atarla: queda sin registrar hasta que la persona vuelva a la app.
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      let sub = event.newSubscription || null;
      if (!sub) {
        const r = await fetch('/api/push/clave', { credentials: 'same-origin', cache: 'no-store' });
        const j = await r.json().catch(() => null);
        if (!r.ok || !j || !j.publicKey) return;
        const relleno = '='.repeat((4 - (j.publicKey.length % 4)) % 4);
        const crudo = atob((j.publicKey + relleno).replace(/-/g, '+').replace(/_/g, '/'));
        const bytes = new Uint8Array(crudo.length);
        for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);
        sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
      }
      await fetch('/api/push/suscripcion', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suscripcion: sub.toJSON() }),
      });
    } catch (e) { /* sin red o sin sesión: se reintenta cuando la persona abra la app */ }
  })());
});
