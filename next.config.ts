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
};

export default nextConfig;
