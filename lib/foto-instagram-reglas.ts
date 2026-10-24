// =============================================================================
// La foto de Instagram de un lead — lo puro (24/10/2026)
// =============================================================================
// Pedido del 17/10 (la tarjeta «coherencia-1710»): la foto de Instagram en la tarjeta del lead. El buscador del alta ya la
// muestra (app/crm/new/InstagramBuscador.tsx), pero es una URL del CDN de Meta que VENCE: se copia a nuestro bucket al crear
// el lead (lib/foto-instagram.ts). La URL llega del NAVEGADOR, así que sólo se acepta si es de un CDN de Meta y por https: el
// server no baja cualquier cosa que le manden. Sin `server-only`: lo prueban los tests.

/** ¿Es la URL de una foto de perfil de Instagram (CDN de Meta, https)? Lo demás no se baja. */
export function esFotoDeInstagram(url: unknown): url is string {
  if (typeof url !== 'string' || !url || url.length > 2000) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && (u.hostname.endsWith('.cdninstagram.com') || u.hostname.endsWith('.fbcdn.net'));
  } catch {
    return false;
  }
}
