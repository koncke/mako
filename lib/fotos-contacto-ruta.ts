// =============================================================================
// fotos-contacto-ruta — dónde se guarda la cara de un lead, y que no se pueda adivinar
// =============================================================================
// Las fotos de WhatsApp de los leads se copian al bucket `avatars`, que es PÚBLICO (lo crea
// app/api/perfil/avatar con `{ public: true }`: ahí viven también las fotos de perfil de las
// personas del equipo). Hasta el 17/10/2026 la ruta era `leads/<ws>/<lead>.jpg`: dos enteros
// chicos. Cualquiera, sin credencial, recorría `leads/1/1.jpg`, `leads/1/2.jpg`… y se bajaba las
// caras de las personas que le escribieron a un cliente (106 en producción ese día, de cinco
// negocios). No es un cruce entre negocios: es un dato personal de un tercero a la vista.
//
// La decisión (relevo de seguridad §6.1, opción c): el bucket sigue público y el NOMBRE deja de
// ser adivinable — 128 bits al azar por copia. Es la más barata y cierra lo único que la hacía
// peligrosa, la enumeración (Supabase no lista un bucket con la clave pública: hay que saber el
// nombre). La URL completa sigue guardada en `leads.foto_auto_url`, que es lo único que leen las
// pantallas, así que no cambia nada para nadie más.
//
// SIN `server-only`: puro, con test (tests/fotos-contacto-ruta.test.ts).
// =============================================================================

import { randomBytes } from 'node:crypto';

/** La ruta de una copia NUEVA: `leads/<ws>/<lead>-<32 hex al azar>.jpg`. */
export function rutaNuevaDeFoto(ws: number, leadId: number, azar: () => string = () => randomBytes(16).toString('hex')): string {
  return `leads/${ws}/${leadId}-${azar()}.jpg`;
}

/** ¿Es una ruta del formato viejo, adivinable (`leads/<ws>/<lead>.jpg`)? */
export function esRutaAdivinable(ruta: string): boolean {
  return /^leads\/\d+\/\d+\.jpg$/.test(ruta);
}

/**
 * La ruta dentro del bucket `avatars` de una URL pública de Supabase Storage, o null si la URL
 * no es una copia nuestra de la foto de un lead de ESTE workspace y ESTE lead. Se exige el
 * prefijo `leads/<ws>/<lead>` para que una fila editada a mano nunca haga borrar otro objeto.
 */
export function rutaDeFotoGuardada(url: string | null | undefined, ws: number, leadId: number): string | null {
  if (!url) return null;
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const m = /\/storage\/v1\/object\/public\/avatars\/(leads\/(\d+)\/(\d+)(?:-[0-9a-f]{32})?\.jpg)$/.exec(u.pathname);
  if (!m) return null;
  if (Number(m[2]) !== ws || Number(m[3]) !== leadId) return null;
  return m[1];
}
