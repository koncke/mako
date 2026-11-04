// =============================================================================
// spy-foto-hash — el dHash de una foto de perfil, para saber si dos redes son de la misma persona (4/11/2026)
// =============================================================================
// Lo usa `buscarOtrasRedes` (lib/spy-otras-redes.ts): «Por la foto, o que razone» (Martín, 4/11). Sin `server-only` para
// que el test lo corra con imágenes de verdad (tests/spy-otras-redes.test.ts).
//
// Una foto PNG con transparencia (muchos avatares lo son) también da su hash: medido el 4/11/2026, `grayscale().raw()`
// devuelve un solo canal aunque la imagen tenga alfa (72 bytes). El test lo cuida.
// =============================================================================

import sharp from 'sharp';
import { dHash } from './spy-otras-redes-reglas';

/** El dHash de 64 bits de una imagen (cualquier formato que lea sharp), o null si no es una imagen. Nunca tira. */
export async function hashDeImagen(buf: Buffer | Uint8Array): Promise<string | null> {
  try {
    const grises = await sharp(buf).resize(9, 8, { fit: 'fill' }).grayscale().raw().toBuffer();
    return dHash(grises);
  } catch {
    return null;
  }
}
