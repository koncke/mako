import type { NextConfig } from "next";
import { EXTENSION_URL_TIENDA } from "./lib/extension-tienda";
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
// El build de Vercel corre con NODE_OPTIONS=--max-old-space-size=4096, y esa variable vive en el
// PROYECTO de Vercel (Production y Preview), NO en este repo (15/10/2026). Sin ella el build muere por
// memoria (`out_of_memory` a los ~7 min) y el push sale verde sin llegar a producción. Si alguien la
// borra, que la primera pantalla del log lo diga. Por qué ese número y no otro: AGENTS.md → «El build
// de Vercel tiene un tope de memoria que NO está en el repo». tests/build-tope-memoria.test.ts.
if (process.env.VERCEL && !/max[-_]old[-_]space[-_]size/.test(process.env.NODE_OPTIONS ?? '')) {
  console.warn('\n⚠️  [MaKo] Build en Vercel SIN NODE_OPTIONS=--max-old-space-size=4096 en el proyecto: va a morir por memoria. Ver AGENTS.md.\n');
}

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
  // El motor de IA que corre SOLO en el navegador, fuera de todas las funciones (3/11/2026).
  //
  // Esa noche el deploy falló cinco veces por el tope de 250MB de una función y, al habilitar
  // `VERCEL_SUPPORT_LARGE_FUNCTIONS=1`, el error cambió a otro peor: el build TERMINA bien
  // («Build Completed in /vercel/output [4m]») y muere en «Deploying outputs...» con ENOSPC —
  // el contenedor se queda sin disco. Medido en ese log: salida 2001 MB, node_modules 1847 MB,
  // y el archivo más grande del contenedor es
  //     327 MB  node_modules/onnxruntime-node/bin/napi-v3/linux/x64/libonnxruntime_providers_cuda.so
  // El paquete trae los binarios de TODAS las plataformas (208 MB en Windows, sin el de CUDA)
  // y en Linux le suma el proveedor de CUDA, que en Vercel no se puede usar: no hay GPU.
  //
  // Y no hace falta NADA de eso en el servidor: `@huggingface/transformers` lo importa un solo
  // archivo, app/video-editor/_opencut/services/transcription/worker.ts, que es un Web Worker
  // (Whisper transcribe en la máquina del usuario), más un `.d.ts` del editor de imágenes que
  // sólo declara tipos. `onnxruntime-node` entra al bundle como dependencia de transformers,
  // nunca porque alguien lo use.
  //
  // ⚠️ LAS CLAVES SON GLOBS DE RUTA y las compara picomatch con `{ contains: true }`
  // (next/dist/build/collect-build-traces.js), así que `'/**'` alcanza a `/admin/docs`: no es que
  // `*` cruce la barra, es que basta con estar contenido.
  //
  // ⚠️ Y VA `'/**'`, NO `'/*'`, que es la clave que la doc de Next presenta como «global». Medido
  // con su propio picomatch: `'/*'` NO empareja la ruta `'/'` —la raíz— porque exige algo después
  // de la barra. Con esa clave la home seguía empaquetando los 500 MB y el resto de la app no, que
  // es la peor versión: el deploy falla igual y el patrón parece correcto. Lo encontró el test.
  //
  // ⚠️ EN WINDOWS ESTA EXCLUSIÓN NO HACE NADA, en silencio. Next normaliza las barras de los
  // INCLUDES (`include.replace(/\\/g, '/')`) y NO las de los EXCLUDES: el patrón queda
  // `C:\...\node_modules\onnxruntime-node\**` y picomatch nunca lo empareja. Corre donde
  // importa —el contenedor de Vercel es Linux—, pero un build local no sirve para comprobarla.
  outputFileTracingExcludes: {
    '/**': [
      './node_modules/onnxruntime-node/**',
      './node_modules/onnxruntime-web/**',
      // 164 MB de transcripciones (9.719 archivos): lib/cerebro-referente-server.ts las lee con
      // readFile y el trazado las metía en TODAS las funciones. En producción se leen del CDN.
      './public/cono-tx/**',
      './node_modules/@huggingface/transformers/**',
    ],
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
    // La investigación financiera, con su entrada desde Strategy (app/admin/estrategia/cobrar).
    '/admin/estrategia/cobrar': ['./docs/estrategia-financiera-mako.md'],
    // Offer Playbook renderiza el marco de oferta partido en tabs (app/admin/offer-playbook).
    '/admin/offer-playbook': ['./docs/offer-marco.md'],
    // El cron de la cola de montaje (app/api/cron/montaje) corre ffmpeg y los
    // scripts del montaje como procesos aparte: nadie los importa, así que el
    // trazado no los ve y la función llegaría sin ellos. Sin la Anton, libass no
    // falla: pone los subtítulos con otra fuente, sin avisar.
    '/api/cron/montaje': [
      './node_modules/ffmpeg-static/ffmpeg',
      './scripts/plan-cortes-anuncio.mjs',
      './scripts/gen-filtros-anuncio.mjs',
      './scripts/subs-anuncio.mjs',
      './scripts/loudnorm-json.mjs',
      './worker/fuentes/*.ttf',
    ],
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
      // /clients se renombró a /classroom (25/10/2026, Martín: «La tab de "clients" pasa a llamarse "Classroom". También
      // su ruta.»). La tab abre en el curso; el kanban de la entrega es /classroom/clients. Lo más largo primero (gana el
      // primero que coincide). La tabla es la de `rutaNuevaDeVieja` (lib/clients-rutas.ts), que la fija su test.
      { source: '/clients', destination: '/classroom/clients', permanent: false },
      { source: '/clients/classroom', destination: '/classroom', permanent: false },
      { source: '/clients/classroom/:path*', destination: '/classroom/:path*', permanent: false },
      // Members es la vista «Miembros» de Clients desde el 29/10/2026 (Martín: «unificar la tab de clientes con la tab de
      // miembros… Son lo mismo, no deberían ser dos tabs»). La query del pedido viaja sola y se suma a la del destino.
      { source: '/clients/members', destination: '/classroom/clients?vista=miembros', permanent: false },
      { source: '/clients/:path*', destination: '/classroom/:path*', permanent: false },
      { source: '/classroom/members', destination: '/classroom/clients?vista=miembros', permanent: false },
      // MaKo Context, AI Models y Dev se fueron el 25/10/2026 (Martín, puntos 13 a 15). Lo que sabe MaKo (el Conocimiento,
      // y /conocimiento, su editor completo) está en Classroom › Methodology; los prompts, en Settings › Prompts; los modelos
      // los elige cada negocio con su IA y el Ops Center. Los links viejos caen en su lugar nuevo, no en un 404.
      { source: '/contexto', destination: '/classroom/methodology', permanent: false },
      { source: '/conocimiento', destination: '/classroom/methodology', permanent: false },
      { source: '/modelos-ia', destination: '/admin/operaciones', permanent: false },
      { source: '/admin/dev', destination: '/admin/operaciones', permanent: false },
      { source: '/admin/dev/:path*', destination: '/admin/operaciones', permanent: false },
      // «MaKo Messages» salió de Automations el 26/10/2026 (Martín: «elimina eso»; app/_components/nav.ts dice por qué). Sus
      // links caen en Automations, en la computadora y en el teléfono.
      { source: '/mensajes', destination: '/automations', permanent: false },
      { source: '/m/mensajes', destination: '/m/automations', permanent: false },
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
      // ⚠️ SIEMPRE LA TIENDA (Martín, 3/11/2026: «ya no se descarga nada»), también con la tienda
      // una versión atrás del repo. Acá el destino seguía a un flag y caía en el zip, y este link se
      // comparte por mail y por WhatsApp. El zip quedó para desarrollo, en /mako-puente.zip, y sigue
      // detrás del login a propósito (lo fija `tests/redirects-gate.test.ts`).
      {
        source: '/extension',
        destination: EXTENSION_URL_TIENDA,
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
        headers: [
          // `preload` (01/11/2026, auditoría de seguridad): deja anotar hola-mako.com en la lista de HSTS de los
          // navegadores (hstspreload.org, lo anota Martín). Con eso ni la PRIMERA visita viaja por http.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Lo que la APP no usa nunca, apagado también para lo que se cuele en ella (una extensión, un iframe ajeno,
          // un XSS). Sólo en los hosts de MaKo, como el HSTS: una landing de un cliente enmarca reproductores y
          // pasarelas que piden permisos propios. Cámara, micrófono, ubicación y compartir pantalla quedan para la app
          // misma (las notas de voz, el Video Editor); pantalla completa y reproducción automática no se tocan.
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=(self), display-capture=(self), usb=(), serial=(), hid=(), bluetooth=(), midi=(), magnetometer=(), gyroscope=(), browsing-topics=(), interest-cohort=()',
          },
        ],
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
      // Los links de la app de las tiendas (docs/hallazgos-mobile.md, 22/10/2026). El de Apple va SIN extensión (así lo
      // pide iOS) y Next lo serviría como `application/octet-stream`: iOS lo quiere como JSON. Los dos sin pasar por el
      // proxy (su matcher saltea `.well-known/`) y en cualquier host, como todo public/.
      { source: '/.well-known/apple-app-site-association', headers: [{ key: 'Content-Type', value: 'application/json' }] },
      { source: '/.well-known/assetlinks.json', headers: [{ key: 'Content-Type', value: 'application/json' }] },
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
      // El cascarón de MaKo sin conexión (public/sin-conexion/, 28/10/2026): estático e igual para todos. `no-cache` para que el
      // service worker lo renueve al día (public/sw.js → guardarCascaron); la CSP, la misma que el service worker le pone al
      // devolverlo sin red: sólo lo propio, sin scripts en línea ni nada de afuera. El bloque global de arriba sigue aplicando.
      {
        source: '/sin-conexion/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'none'" },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ];
  },
};

export default nextConfig;
