import type { MetadataRoute } from 'next';

// El robots.txt del dominio. Hasta el 08/10/2026 no existía: /robots.txt caía en el gate
// de sesión y redirigía a /login, así que un crawler que lo respeta (meta-externalagent,
// por ejemplo) recibía una página de login donde esperaba reglas. Se vio mientras Meta
// rechazaba la verificación del negocio por no encontrar la razón social en el sitio.
//
// Deja leer TODO a propósito: lo privado ya está detrás del login, y un `disallow` de
// /api/ le cerraría a los crawlers de las vistas previas la imagen de /api/og. Está en
// PUBLICOS (lib/rutas-publicas.ts), o el gate lo vuelve a mandar al login.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', allow: '/' }] };
}
