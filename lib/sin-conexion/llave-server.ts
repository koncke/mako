// =============================================================================
// MaKo sin conexión — la llave de una persona en una computadora (servidor, 28/10/2026)
// =============================================================================
// La DEK de lo guardado en la computadora (lib/sin-conexion/cifra.ts) no se guarda en ninguna tabla: se DERIVA, con HKDF de
// `CREDENCIALES_SECRET` y una etiqueta propia, del id de la PERSONA (su fila de `usuarios`, no la sesión: ignora la
// impersonación) y del id de la computadora. La misma persona en la misma computadora recibe siempre la misma llave; otra
// persona, u otra computadora, otra.
//
// ⚠️ Si se rota `CREDENCIALES_SECRET`, las copias guardadas dejan de renovarse con la llave vieja: la app ve que no abre y la
// persona vuelve a elegir su clave (docs/hallazgos-sin-conexion.md). Lo de abrir sin conexión sigue andando hasta entonces.
// =============================================================================

import 'server-only';
import crypto from 'node:crypto';
import { RE_DISPOSITIVO } from './reglas';

const INFO = (usuario: number) => `mako:sin-conexion:v1|u=${usuario}`;

/** null = sin el secreto configurado (no se inventa una llave de respaldo) o con un id de computadora inválido. */
export function llaveDeLaComputadora(usuario: number, dispositivo: string, secreto: string | undefined = process.env.CREDENCIALES_SECRET): Uint8Array | null {
  const sec = secreto?.trim();
  if (!sec || !Number.isInteger(usuario) || usuario <= 0 || !RE_DISPOSITIVO.test(dispositivo)) return null;
  return new Uint8Array(crypto.hkdfSync('sha256', Buffer.from(sec, 'utf8'), Buffer.from(dispositivo, 'utf8'), Buffer.from(INFO(usuario), 'utf8'), 32));
}
