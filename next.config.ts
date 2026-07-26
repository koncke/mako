import type { NextConfig } from "next";

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
