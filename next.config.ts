import type { NextConfig } from "next";
import { EXTENSION_EN_TIENDA, EXTENSION_URL_TIENDA, EXTENSION_URL_ZIP } from "./lib/extension-tienda";
import { CABECERAS_HTML_LIBRE, CABECERAS_PAGINA_AFUERA } from "./lib/editor-landing/html-libre";
import { PATRON_HOSTS_DE_LA_APP, PATRON_HOSTS_DE_MAKO } from "./lib/editor-landing/dominios-reglas";

// Las redirecciones y reescrituras de abajo son de la APP, y corren ANTES del proxy sin mirar el host
// (tanda 4, 14/10/2026). Medido en producción ese día: hola-mako.site/leads → 307 a hola-mako.site/crm y
// /extension → 307 al zip de la extensión. En hola-mako.site `/todo`, `/leads` o `/extension` son slugs
// VÁLIDOS: la landing con esa dirección quedaba tapada por la redirección antes de que el proxy la
// leyera; y en el dominio de un cliente llevaban a pantallas de MaKo. Por eso TODAS van con el host de
// la app en positivo (`PATRON_HOSTS_DE_LA_APP`: MaKo, los previews, localhost y una IP), puesto por
// `enLaApp` a la lista entera: una redirección nueva lo hereda sin que nadie se acuerde.
// tests/editor-landing-origen.test.ts evalúa esta configuración y lee el fuente.
const EN_LA_APP = [{ type: 'host' as const, value: PATRON_HOSTS_DE_LA_APP }];
const enLaApp = <T extends object>(r: T) => ({ ...r, has: EN_LA_APP });

const nextConfig: NextConfig = {
  // El chequeo de tipos NO corre en el build: es ~65 de los ~99 segundos de cada
  // compilación y en Vercel se factura como Build CPU (medido: 6.540 min = 109 h en
  // una semana, el 95% del gasto variable de la cuenta). El mismo chequeo corre
  // LOCAL en 7 segundos y gratis.
  //
  // La red de seguridad NO se elimina, se mueve: `.git/hooks/pre-push` corre
  // `npm run typecheck` y BLOQUEA el push si falla. Al vivir en .git aplica a
  // cualquier sesión que pushee desde este clon, sin que tenga que saberlo.
  //
  // OJO si el hook se pierde (los hooks no se versionan: reclonar el repo se lo
  // lleva): sin él, un error de tipos llega a producción en vez de frenar el build.
  // Reinstalarlo con las instrucciones de AGENTS.md.
  typescript: { ignoreBuildErrors: true },
  // Fija la raíz del workspace de Turbopack al directorio del proyecto.
  // Evita que Next infiera mal la raíz cuando hay otro lockfile en un ancestro
  // (p.ej. un package-lock.json suelto en el home). Hace la build determinística
  // local, en CI y en Vercel.
  turbopack: {
    root: __dirname,
  },
  // /admin/docs renderiza los .md del repo (AGENTS.md + docs/*.md) en vez de
  // tener una copia propia. Para que la función serverless los encuentre, los
  // archivos tienen que viajar en SU bundle: el tracing automático solo sigue
  // imports, y un readFileSync no es un import.
  //
  // Sin esto la pantalla anda en local y aparece vacía en producción, que es
  // justo lo que le pasa a /api/admin/graph. Si alguna vez se agrega un .md a
  // docs/, entra solo: el patrón es un glob.
  outputFileTracingIncludes: {
    '/admin/docs': ['./docs/**/*.md', './AGENTS.md'],
    // Offer Playbook renderiza el marco de oferta partido en tabs (app/admin/offer-playbook).
    '/admin/offer-playbook': ['./docs/offer-marco.md'],
  },
  experimental: {
    // El middleware (proxy) bufferea el body con tope 10MB por defecto y, si se
    // pasa, TRUNCA el archivo en silencio (no falla) → un adjunto >10MB llegaría
    // corrupto. Se subió a 20MB para el inbox oficial (Chatwoot, borrado el 09/10/2026,
    // topeaba en 16MB) y se deja: el tope sirve igual para cualquier subida.
    proxyClientMaxBodySize: '20mb',
  },
  // /vsl/mako-cs sirve tal cual el HTML exportado de Claude Design (bundle
  // autocontenido en public/vsl-assets). No es una page de Next a propósito:
  // así el archivo queda byte-a-byte igual al original.
  async rewrites() {
    return [
      { source: '/vsl/mako-cs', destination: '/vsl-assets/mako-cs.html' },
    ].map(enLaApp);
  },
  // /todo se renombró a /plan (el "Plan de ejecución"). Mantenemos el redirect
  // para links viejos.
  async redirects() {
    return [
      { source: '/todo', destination: '/plan', permanent: false },
      { source: '/todo/:path*', destination: '/plan/:path*', permanent: false },
      // /graphics se renombró a /dashboard (así lo llama todo el mundo) y
      // /script-analyst a /ads-analyst. Los links viejos siguen andando.
      { source: '/graphics', destination: '/dashboard', permanent: false },
      { source: '/graphics/:path*', destination: '/dashboard/:path*', permanent: false },
      { source: '/vsl/graphics', destination: '/vsl/dashboard', permanent: false },
      { source: '/script-analyst', destination: '/ads-analyst', permanent: false },
      { source: '/script-analyst/:path*', destination: '/ads-analyst/:path*', permanent: false },
      // /leads se renombró a /crm. Deep-links ya enviados (WhatsApp del doer, cola
      // de acción, notificaciones, bookmarks) siguen andando con este redirect.
      { source: '/leads', destination: '/crm', permanent: false },
      { source: '/leads/:path*', destination: '/crm/:path*', permanent: false },
      // hola-mako.com/extension → la ficha en la Chrome Web Store.
      //
      // El link de Google no se puede acortar: el id (`gapbem…`) es un hash de la
      // clave pública que asigna al publicar y es INMUTABLE — cambiarlo sería
      // publicar otra extensión, con otro id, perdiendo instalados y reseñas.
      //
      // Así que el link corto es NUESTRO, y de paso deja de ser un dato ajeno
      // pegado en mails y mensajes: el día que Google cambie la forma de sus URLs,
      // o que haya que mandar a otro lado, se toca acá y todo lo ya compartido
      // sigue funcionando.
      //
      // ⚠️ `permanent: false` (307) y NO 308. Un permanente lo cachea el navegador
      // para siempre: quien lo abrió una vez nunca volvería a preguntar, y el
      // control que este redirect existe para tener se pierde justo con la gente
      // que ya lo usó.
      //
      // ⚠️ EL DESTINO SÍ PASA POR EL GATE, aunque el redirect corra antes.
      //
      // Acá decía lo contrario, y ESE COMENTARIO es lo que hizo que nadie lo
      // mirara: «no hace falta sumarlo a PUBLICOS, los redirects corren ANTES del
      // proxy, así que el gate ni se entera». La premisa es cierta (doc de Next,
      // «Execution order») y la conclusión es falsa. El redirect no sirve el
      // archivo: manda un 307 y el navegador PIDE EL DESTINO DE NUEVO. Ese segundo
      // pedido es un request nuevo y entra al proxy como cualquier otro.
      //
      // Medido en producción el 30/08/2026:
      //     /extension        → 307 a /mako-puente.zip
      //     /mako-puente.zip  → 307 a /login?next=%2Fmako-puente.zip
      //
      // CONSECUENCIA VIGENTE, elegida a propósito: el zip no está en `PUBLICOS` ni
      // exento del matcher, así que quien abra este link SIN SESIÓN cae en el
      // login. No es un olvido — se evaluó abrirlo (el zip no lleva secretos y la
      // extensión ya está publicada en la Chrome Web Store, o sea que su código ya
      // es distribuible) y se decidió que no.
      //
      // Y el link no queda roto: `destinoSeguro` conserva el `?next`, así que
      // después de entrar el archivo se baja solo. Sirve para gente CON cuenta,
      // que es toda la que puede usar la extensión —sin token de MaKo no hace
      // nada—; para alguien sin cuenta es un login, no una descarga.
      //
      // Si alguna vez se abre: `'/mako-puente.zip'` a `PUBLICOS`, ruta EXACTA.
      // NUNCA sumar `zip` a las extensiones exentas del matcher de proxy.ts, que
      // abriría también cualquier .zip que caiga en public/ después.
      // Lo fija `tests/redirects-gate.test.ts`.
      //
      // ⚠️ El destino SIGUE AL FLAG, no es la tienda a secas. Mientras se itera, la
      // tienda tiene una versión vieja —cada subida pasa por revisión— y este link
      // se comparte por mail y por WhatsApp: si apuntara siempre a la tienda,
      // sería el único camino que lleva a la rota, y encima el que no se puede
      // corregir después de mandado.
      {
        source: '/extension',
        destination: EXTENSION_EN_TIENDA ? EXTENSION_URL_TIENDA : EXTENSION_URL_ZIP,
        permanent: false,
      },
    ].map(enLaApp);
  },
  // Cabeceras de seguridad globales (defense-in-depth). Subset SEGURO: no toca
  // script-src/style-src (eso requiere nonces + testeo en browser), pero corta
  // clickjacking, sniffing, fuga de referrer, plugins y base-tag injection.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Sin default-src: no restringe script/img/etc. (para no romper Next/Panda/
          // Supabase). Solo endurece los vectores seguros de bloquear.
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
        ],
      },
      // HSTS SÓLO en los hosts de MaKo (revisión de la tanda 2, 12/10/2026). Estaba en el bloque de
      // arriba, que no mira el host: el dominio propio de una landing (proxy.ts la sirve en el host
      // del cliente) también recibía `max-age=63072000; includeSubDomains`, y si el cliente conectaba
      // su dominio RAÍZ, los navegadores de sus visitantes le forzaban HTTPS por dos años a TODOS sus
      // subdominios — rompiendo cualquiera que sólo ande por HTTP. En positivo: los dominios de MaKo
      // y sus subdominios (`PATRON_HOSTS_DE_MAKO`, de `DOMINIOS_DE_MAKO`); Next lo compila `^(…)$`
      // contra el host sin puerto. Medido en producción el 14/10/2026: hola-mako.com la trae con
      // `includeSubDomains` y hola-mako.site NO (sólo el `max-age=63072000` que Vercel pone solo).
      // hola-mako.site no está en `DOMINIOS_DE_MAKO` a propósito: es de MaKo, pero no es la app.
      // Las redirecciones de arriba ya van con el host de la app (tanda 4); los archivos de public/ y
      // /_next siguen sirviéndose en cualquier host (docs/hallazgos-editor-landing.md, «Tanda 4»).
      {
        source: '/:path*',
        has: [{ type: 'host', value: PATRON_HOSTS_DE_MAKO }],
        headers: [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }],
      },
      // Lo que se sirve ADENTRO de un iframe de una página nuestra (editor de landings, tanda 2):
      // el «HTML personalizado» de una landing (/l/html/<docId>/<bloque>, T6) y la página de afuera
      // del Diagnóstico (T5). Las dos necesitan que su propio origen las enmarque (SAMEORIGIN, no
      // DENY) y la política `sandbox` (origen opaco: el HTML del cliente o de un tercero no ve la
      // sesión de hola-mako.com). VAN DESPUÉS del bloque '/:path*' A PROPÓSITO: con dos bloques que
      // ponen la misma cabecera gana el último, y Next descarta la que ponga la ruta si next.config
      // ya puso una (por eso no alcanza con que la ruta las mande). Las dos rutas además se niegan a
      // contestar si no las pide un iframe (`Sec-Fetch-Dest`): abiertas como pestaña, sin sandbox,
      // correrían con el origen de MaKo. Fuente única de las cabeceras: lib/editor-landing/html-libre.ts.
      // Desde la tanda 4 /l/html se sirve en hola-mako.site y en el dominio de un cliente (donde vive la
      // página que lo enmarca); en hola-mako.com, en producción, el proxy contesta 404. Por eso este
      // bloque NO lleva `has`: tiene que valer en todos los hosts.
      { source: '/l/html/:path*', headers: [...CABECERAS_HTML_LIBRE] },
      // La página de afuera NO lleva la política del bloque (verificación de la tanda 7): el bloque deja salir sus
      // ventanas del sandbox porque vive en hola-mako.site; ésta se sirve en el origen de la APP (el iframe del
      // Diagnóstico y la ventana del lector, que tiene de opener la pestaña de MaKo) y sólo corre scripts.
      { source: '/api/landing-generator/diagnostico/pagina', headers: [...CABECERAS_PAGINA_AFUERA] },
      // El service worker de MaKo Mobile (public/sw.js: sólo push y click, SIN 'fetch'). Lo
      // que pide la guía de PWA de Next 16 (§8): servido como JavaScript, SIN caché —un sw.js
      // viejo cacheado deja a todos los teléfonos con el comportamiento anterior hasta que el
      // navegador decida revalidar— y con una CSP propia que sólo deja cargar scripts del
      // mismo origen. El bloque global de arriba sigue aplicando (los dos se suman).
      // Scope '/' con el script en la raíz: NO hace falta `Service-Worker-Allowed`.
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
