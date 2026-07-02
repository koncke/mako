import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
