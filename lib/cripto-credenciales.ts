// =============================================================================
// cripto-credenciales — el cifrado de las credenciales BYOK, y nada más
// =============================================================================
// Vive aparte de lib/credenciales.ts a propósito: acá NO se importa 'server-only'
// ni nada de Next, así que se puede correr suelto y testear de verdad
// (scripts/test-cripto.mjs). Es el código donde un error se paga más caro; que
// solo se pueda probar levantando la app entera era parte del problema.
//
// Dos formatos conviviendo (migración sin downtime). El criptograma es
// autodescriptivo, así que se puede LEER los dos y ESCRIBIR uno solo:
//
//   gcm1.<iv>.<tag>.<ct>          — viejo. Clave = sha256(secreto), una sola para
//                                   toda la plataforma, sin sal ni AAD.
//   gcm2.<salt>.<iv>.<tag>.<ct>   — nuevo. Clave = HKDF-SHA256 por (workspace,
//                                   clave) con sal por fila, y AAD que ata el
//                                   criptograma a SU fila.
//
// Qué compra v2, concretamente:
//  · Clave por workspace: reventar la de un cliente no da las de los demás.
//  · AAD: un criptograma copiado a otra fila/workspace NO abre. Antes era
//    portable — nada lo ataba a su lugar.
//  · Sal por fila: dos filas con el mismo valor no comparten clave derivada.
//  · Secreto propio: deja de ser el mismo que firma las sesiones.

import crypto from 'node:crypto';

export type VersionCripto = 'gcm1' | 'gcm2' | 'otro';

const V2_INFO = (ws: number, clave: string) => `mako:cred:v2|ws=${ws}|k=${clave}`;
const V2_AAD = (ws: number, clave: string) => Buffer.from(`${ws}:${clave}`, 'utf8');

/**
 * Clave del formato VIEJO. CONGELADA a propósito: NO mira CREDENCIALES_SECRET.
 * Si lo mirara, el día que se setee las filas gcm1 dejarían de abrir EN SILENCIO
 * — que es justo el accidente que esta migración existe para evitar. Su único
 * trabajo es leer lo que ya está escrito.
 *
 * OJO — POR QUÉ ESTO URGE: AUTH_COOKIE_VALUE no es un secreto de servidor. El
 * login compartido compara la cookie CONTRA ESE VALOR TAL CUAL (lib/auth.ts), o
 * sea que está en el browser de cualquiera que haya entrado con la contraseña
 * maestra. Todo lo cifrado en v1 está protegido por un secreto repartido. Por eso
 * v1 es una rampa de salida, no un formato: cuanto antes quede en cero, mejor.
 */
function claveV1(): Buffer | null {
  const sec = process.env.AUTH_COOKIE_VALUE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sec || !sec.trim()) return null;
  return crypto.createHash('sha256').update(sec).digest();
}

/**
 * '1' → el lector RECHAZA gcm1. Es el paso final de la migración, pero como flag
 * y no como borrado de código: se prende apenas el backfill da cero y se apaga
 * en dos minutos si algo salió mal.
 *
 * No es cosmético. Mientras v1 se acepte, el AAD de v2 NO garantiza nada: el
 * formato lo elige el criptograma, así que a una fila ya migrada se le puede
 * plantar un blob gcm1 forjado (sin AAD, sin clave por workspace) y el lector lo
 * toma. La promesa "un criptograma no se puede mover de fila" recién es cierta
 * con esto prendido.
 */
function v1Apagado(): boolean {
  return process.env.CREDENCIALES_V1_OFF === '1';
}

/** Secreto del formato nuevo. SOLO CREDENCIALES_SECRET: sin cadena de fallbacks. */
function secretoV2(): string | null {
  const sec = process.env.CREDENCIALES_SECRET;
  return sec && sec.trim() ? sec.trim() : null;
}

function claveV2(salt: Buffer, ws: number, clave: string): Buffer | null {
  const sec = secretoV2();
  if (!sec) return null;
  return Buffer.from(crypto.hkdfSync('sha256', Buffer.from(sec, 'utf8'), salt, Buffer.from(V2_INFO(ws, clave), 'utf8'), 32));
}

/**
 * true → los guardados nuevos nacen v2. El flag va SEPARADO del secreto para que
 * el rollback sea apagarlo y listo: el secreto se queda, así lo ya escrito en v2
 * se sigue leyendo. Si estuvieran juntos, "revertir" volvería ilegible todo lo
 * guardado en el medio.
 */
export function escribeV2(): boolean {
  return process.env.CREDENCIALES_V2 === '1' && secretoV2() !== null;
}

/** ¿Con qué formato está escrita esta fila? Lo usa el backfill. */
export function versionCripto(valorEnc: string): VersionCripto {
  const v = valorEnc.split('.')[0];
  return v === 'gcm1' || v === 'gcm2' ? v : 'otro';
}

export function cifrarV2(valor: string, ws: number, clave: string): string {
  const salt = crypto.randomBytes(16);
  const key = claveV2(salt, ws, clave);
  if (!key) throw new Error('credenciales: CREDENCIALES_V2=1 pero falta CREDENCIALES_SECRET');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(V2_AAD(ws, clave));
  const enc = Buffer.concat([cipher.update(valor, 'utf8'), cipher.final()]);
  return `gcm2.${salt.toString('base64url')}.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${enc.toString('base64url')}`;
}

export function cifrarV1(valor: string): string {
  const key = claveV1();
  if (!key) throw new Error('credenciales: sin secret de cifrado (AUTH_COOKIE_VALUE)');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(valor, 'utf8'), cipher.final()]);
  return `gcm1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${enc.toString('base64url')}`;
}

/**
 * Cifra para la fila (ws, clave). El (ws, clave) NO es decorativo: en v2 entra en
 * la derivación de la clave y en el AAD, así que el criptograma solo abre en su
 * propia fila.
 */
export function cifrar(valor: string, ws: number, clave: string): string {
  if (escribeV2()) return cifrarV2(valor, ws, clave);
  // Fail-closed: con v1 apagado, escribir v1 sería escribir algo que este mismo
  // proceso no puede volver a leer. Mejor explotar acá que guardar basura.
  if (v1Apagado()) throw new Error('credenciales: CREDENCIALES_V1_OFF=1 pero no se puede escribir v2 (¿falta CREDENCIALES_SECRET o CREDENCIALES_V2=1?)');
  return cifrarV1(valor);
}

/** Lector DUAL: entiende los dos formatos. null = no se pudo abrir. */
export function descifrar(valorEnc: string, ws: number, clave: string): string | null {
  const partes = valorEnc.split('.');
  try {
    if (partes[0] === 'gcm2') {
      if (partes.length !== 5) return null;
      const [, salt, iv, tag, cuerpo] = partes;
      const key = claveV2(Buffer.from(salt, 'base64url'), ws, clave);
      if (!key) return null;
      const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
      d.setAAD(V2_AAD(ws, clave));
      d.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([d.update(Buffer.from(cuerpo, 'base64url')), d.final()]).toString('utf8');
    }
    if (partes[0] === 'gcm1') {
      // Con v1 apagado no hay downgrade posible: un gcm1 forjado no entra.
      if (v1Apagado() || partes.length !== 4) return null;
      const key = claveV1();
      if (!key) return null;
      const [, iv, tag, cuerpo] = partes;
      const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
      d.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([d.update(Buffer.from(cuerpo, 'base64url')), d.final()]).toString('utf8');
    }
    return null;
  } catch {
    return null; // secret rotado, fila corrupta, o criptograma movido de fila (AAD)
  }
}
