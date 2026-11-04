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

/**
 * Por dónde se DIBUJA esa foto en el navegador: por nuestra ruta (app/api/crm/instagram-foto), nunca directo.
 *
 * ⚠️ DIRECTO NO CARGA, Y NO DA NINGÚN ERROR QUE SE VEA. Medido en producción el 3/11/2026 buscando @leilahormozi: el `<img>` le pide
 * la foto a scontent-*.cdninstagram.com y el navegador la descarta (`net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`, sólo en la consola).
 * El `onError` dibuja las iniciales y todo parece «una cuenta sin foto». O sea que la foto del buscador NUNCA se vio, ni en el alta de
 * un lead ni en Spy, desde el 12/10. Lo que no es de Meta (una foto ya en nuestro bucket) se devuelve tal cual: ésa sí carga.
 */
export function fotoPorNosotros(url: string | null | undefined): string | null {
  if (!url) return null;
  return esFotoDeInstagram(url) ? `/api/crm/instagram-foto?url=${encodeURIComponent(url)}` : url;
}

/** Lo que esa ruta acepta devolver: una imagen, y no un SVG (lleva scripts, y se serviría desde nuestro dominio). */
export const esImagenServible = (tipo: string): boolean => /^image\/(jpeg|png|webp|gif|avif|heic)\b/i.test(tipo);
