// =============================================================================
// sw.js — el service worker de MaKo: los avisos push y MaKo sin conexión
// =============================================================================
// Scope '/', lo registra lib/push-cliente.ts (los avisos del teléfono, y la computadora donde la persona activó MaKo sin
// conexión: app/_components/CopiaSinConexion.tsx). Lo sirve next.config.ts con Content-Type JavaScript, Cache-Control
// no-store y una CSP propia (guía de PWA de Next 16, §8).
//
// ⛔ NUNCA GUARDA UNA RESPUESTA DEL SERVIDOR (docs/diseno-mako-mobile.md, «Service worker»): un caché puede servirle el HTML
// de una cuenta a OTRA en el mismo navegador (hay admins que impersonan clientes y gente con dos cuentas). Hasta el 28/10/2026
// no había handler 'fetch' por eso. MaKo sin conexión (docs/diseno-mako-desktop-sin-conexion.md) lo suma SIN romper la regla:
//   · intercepta SÓLO las navegaciones de la app y los archivos de /sin-conexion/;
//   · una navegación va a la red, siempre. Si la red no contesta (sin conexión, más de ESPERA_MS, o un 502/503/504), devuelve
//     el CASCARÓN: public/sin-conexion/index.html, igual para todos y sin un dato de nadie. Lo de cada persona está cifrado
//     en su IndexedDB y abre sólo con su clave (lib/sin-conexion/local.ts);
//   · lo único que entra al caché es la lista fija ARCHIVOS_CASCARON, pedida SIN cookies (`credentials: 'omit'`).
// En el teléfono no hay cascarón todavía (T3): ahí sigue sin tocar ningún pedido.
//
// ⚠️ TODO 'push' MUESTRA UNA NOTIFICACIÓN, siempre: la suscripción es `userVisibleOnly`, y
// Safari REVOCA la suscripción de un sitio que recibe un push y no muestra nada. Un payload
// ilegible igual dibuja una genérica.
//
// El payload lo arma lib/push-payload.ts: { titulo, cuerpo, url, tag, badge? }.
// =============================================================================

// ── MaKo sin conexión ─────────────────────────────────────────────────────────

/** El caché del cascarón. Cambiar el número cuando cambia la LISTA; lo de adentro se renueva solo. */
const CASCARON = 'mako-sin-conexion-v1';
const PAGINA_CASCARON = '/sin-conexion/index.html';
/** Lo ÚNICO que este service worker guarda: archivos estáticos sin datos de nadie. */
const ARCHIVOS_CASCARON = [PAGINA_CASCARON, '/sin-conexion/app.js', '/sin-conexion/estilos.css', '/icon-192.png'];
/**
 * Cuánto se espera la respuesta de una navegación antes de mostrar lo guardado. Generoso a propósito: una página sin
 * `loading.tsx` no manda nada hasta terminar de armarse, y una lenta no es un MaKo caído (un MaKo caído contesta rápido:
 * conexión rechazada o un 502/503/504).
 */
const ESPERA_MS = 25000;
/** Cada cuánto, con conexión, se vuelve a bajar el cascarón (cambia con cada deploy que lo toque). */
const RENOVAR_CADA_MS = 30 * 60 * 1000;
/** Las navegaciones que nunca reciben el cascarón: la API y las páginas públicas que abre gente sin cuenta. */
const FUERA_DEL_CASCARON = [/^\/api\//, /^\/sin-conexion\//, /^\/_next\//, /^\/l\//, /^\/compartido\//, /^\/r\//];
/** El teléfono todavía no tiene MaKo sin conexión (T3). La misma regla que lib/app-escritorio-reglas.ts → esTelefono. */
const ES_TELEFONO = /Android|iPhone|iPad|iPod|Mobile/i.test((self.navigator && self.navigator.userAgent) || '');
/** Lo que el cascarón dibuja según el motivo. Conjunto cerrado: va adentro del HTML. */
const MOTIVOS = ['sin-red', 'no-responde'];

/**
 * Cuándo se bajó el cascarón por última vez. ⚠️ NO alcanza una variable: el navegador apaga el service worker a los ~30 s
 * sin eventos y la variable vuelve a 0, así que se renovaba en cada arranque (4 pedidos por carga; verificación de
 * 90d6410eb). La hora queda también en el caché, al lado de la lista (es un número, no un dato de nadie).
 */
const MARCA_RENOVADO = '/sin-conexion/.renovado';
let ultimaRenovacion = 0;

/** Baja la lista fija SIN cookies y la guarda. Lo que no llega bien (o llega redirigido, como un login) no se guarda. */
async function guardarCascaron() {
  const cache = await caches.open(CASCARON);
  await Promise.all(ARCHIVOS_CASCARON.map(async (url) => {
    const r = await fetch(url, { cache: 'no-cache', credentials: 'omit', redirect: 'follow' });
    if (r.ok && !r.redirected) await cache.put(url, r);
  }));
  ultimaRenovacion = Date.now();
  await cache.put(MARCA_RENOVADO, new Response(String(ultimaRenovacion)));
}

async function renovarSiToca() {
  // Sin el caché (nunca se activó, o «Borrar lo guardado» lo sacó), nada que renovar.
  if (!(await caches.has(CASCARON))) return;
  if (!ultimaRenovacion) {
    const marca = await (await caches.open(CASCARON)).match(MARCA_RENOVADO);
    ultimaRenovacion = Number(marca ? await marca.text() : 0) || 0;
  }
  if (Date.now() - ultimaRenovacion < RENOVAR_CADA_MS) return;
  ultimaRenovacion = Date.now();
  await guardarCascaron().catch(() => undefined);
}

/** El cascarón con su motivo, o null si nunca se guardó (el navegador muestra su página de sin conexión). */
async function cascaron(motivo) {
  const cache = await caches.open(CASCARON);
  const r = await cache.match(PAGINA_CASCARON);
  if (!r) return null;
  const m = MOTIVOS.includes(motivo) ? motivo : 'no-responde';
  const html = (await r.text()).replace('<meta name="mako-motivo" content="">', '<meta name="mako-motivo" content="' + m + '">');
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'; object-src 'none'",
      'X-MaKo-Sin-Conexion': m,
    },
  });
}

/** Una navegación: la red siempre; lo guardado sólo si la red no contesta. Nunca se guarda lo que vuelve. */
async function navegar(event) {
  const red = (async () => (await event.preloadResponse) || fetch(event.request))();
  let plazo;
  const tarde = new Promise((_, mal) => { plazo = setTimeout(() => mal(new Error('plazo')), ESPERA_MS); });
  try {
    const r = await Promise.race([red, tarde]);
    if (r.status === 502 || r.status === 503 || r.status === 504) {
      const c = await cascaron('no-responde');
      if (c) return c;
    }
    event.waitUntil(renovarSiToca().catch(() => undefined));
    return r;
  } catch (e) {
    const c = await cascaron(self.navigator && self.navigator.onLine === false ? 'sin-red' : 'no-responde');
    if (c) return c;
    return Response.error();
  } finally {
    clearTimeout(plazo);
  }
}

/**
 * Un archivo del cascarón: la red primero (está al día), lo guardado si no hay red. Lo que viene de la red no se guarda acá.
 * La página abierta a mano («Probar») es una navegación: con la precarga prendida, se usa ESA (si no, sale dos veces).
 */
async function archivoDelCascaron(event) {
  const req = event.request;
  try {
    const r = (req.mode === 'navigate' && (await event.preloadResponse)) || (await fetch(req));
    if (r.ok) return r;
    const c = await caches.match(new URL(req.url).pathname, { cacheName: CASCARON });
    return c || r;
  } catch (e) {
    const c = await caches.match(new URL(req.url).pathname, { cacheName: CASCARON });
    return c || Response.error();
  }
}

/**
 * ⚠️ En el TELÉFONO no hay escucha de pedidos: con sólo registrarla, el navegador despierta al service worker en CADA
 * pedido y navegación aunque no los conteste (medido: 0 de 6 navegaciones antes, 6 de 6 con la escucha y un `return`
 * adentro; verificación de 90d6410eb). El teléfono sigue sin tocar ningún pedido, como dice el diseño.
 */
function alPedir(event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Los archivos del cascarón, y la página misma abierta a mano («Probar», Perfil › Instalar la app).
  if (ARCHIVOS_CASCARON.includes(url.pathname)) {
    event.respondWith(archivoDelCascaron(event));
    return;
  }
  if (req.mode !== 'navigate') return;
  // ⚠️ Con navigationPreload prendido, una navegación que el service worker no contesta sale DOS veces (la precarga se tira
  // y el navegador pide de nuevo). Las de afuera del cascarón se contestan con la precarga, igual que la red.
  if (FUERA_DEL_CASCARON.some((re) => re.test(url.pathname))) {
    event.respondWith((async () => (await event.preloadResponse) || fetch(req))());
    return;
  }
  event.respondWith(navegar(event));
}
if (!ES_TELEFONO) self.addEventListener('fetch', alPedir);

self.addEventListener('install', (event) => {
  // Un sw.js nuevo toma el control sin esperar a que se cierren las pestañas viejas.
  self.skipWaiting();
  // El cascarón, ya: sin él, el primer corte de red muestra la página del navegador. Si falla, se reintenta al navegar.
  if (!ES_TELEFONO) event.waitUntil(guardarCascaron().catch(() => undefined));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Los cachés de una lista vieja se borran. Nunca hubo otros: éste es el único que guarda algo.
    const nombres = await caches.keys();
    await Promise.all(nombres.filter((n) => n.startsWith('mako-sin-conexion-') && n !== CASCARON).map((n) => caches.delete(n)));
    // La navegación arranca a la vez que el service worker: sin esto, cada página esperaría a que despierte.
    if (!ES_TELEFONO && self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => undefined);
    await self.clients.claim();
  })());
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
