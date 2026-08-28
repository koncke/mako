import type { NextConfig } from "next";
import { EXTENSION_EN_TIENDA, EXTENSION_URL_TIENDA, EXTENSION_URL_ZIP } from "./lib/extension-tienda";

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
  },
  experimental: {
    // El middleware (proxy) bufferea el body con tope 10MB por defecto y, si se
    // pasa, TRUNCA el archivo en silencio (no falla) → un adjunto >10MB llegaría
    // corrupto a Chatwoot. Subimos a 20MB para cubrir el tope real de subida del
    // inbox (route /api/whatsapp/.../attachments cap a 16MB).
    proxyClientMaxBodySize: '20mb',
  },
  // /vsl/mako-cs sirve tal cual el HTML exportado de Claude Design (bundle
  // autocontenido en public/vsl-assets). No es una page de Next a propósito:
  // así el archivo queda byte-a-byte igual al original.
  async rewrites() {
    return [
      { source: '/vsl/mako-cs', destination: '/vsl-assets/mako-cs.html' },
    ];
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
      // No hace falta sumarlo a `PUBLICOS`: los redirects de next.config corren
      // ANTES del proxy (doc de Next, «Execution order»), así que el gate de auth
      // ni se entera. Es lo correcto — este link se comparte con gente que no
      // tiene cuenta.
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
    ];
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
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          // Sin default-src: no restringe script/img/etc. (para no romper Next/Panda/
          // Supabase). Solo endurece los vectores seguros de bloquear.
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
