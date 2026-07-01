// =============================================================================
// auth-session — sesión firmada por usuario (token HMAC en cookie)
// =============================================================================
// Reemplaza a la cookie compartida (mako_auth === AUTH_COOKIE_VALUE) por un
// token POR USUARIO: v1.<payload>.<firma>, con payload JSON en base64url y
// firma HMAC-SHA256. Así la cookie dice QUIÉN es (email, rol) y no solo "tiene
// la contraseña". La legacy sigue aceptándose para no desloguear a nadie.
//
// Este módulo lo importa proxy.ts (corre en runtime Node en Next 16, así que
// node:crypto está disponible) — NO importar acá nada con 'server-only' ni
// Supabase: la verificación es crypto pura, sin base de datos.

import crypto from 'node:crypto';

export type Rol = 'admin' | 'usuario';

export type Sesion = {
  /** id del usuario en la tabla, o 'password' | 'legacy' | 'dev' para sesiones sin fila. */
  sub: string;
  email: string;
  nombre: string;
  rol: Rol;
  /** epoch segundos de expiración. */
  exp: number;
  /** true si vino de la cookie compartida vieja o del gate sin configurar. */
  legacy?: boolean;
};

export const SESSION_COOKIE = 'mako_session';
export const LEGACY_COOKIE = 'mako_auth';
export const EMAIL_COOKIE = 'mako_email';
export const SESSION_DIAS = 30;

/** Secret de firma. En prod existe AUTH_COOKIE_VALUE (el gate lo exige). */
function secret(): string | null {
  const s = process.env.AUTH_SECRET || process.env.AUTH_COOKIE_VALUE || process.env.DASHBOARD_PASSWORD;
  return s && s.trim() ? s : null;
}

/** Mismo criterio que el gate viejo: sin estas envs, el login está inactivo. */
export function gateConfigurado(): boolean {
  return Boolean(process.env.DASHBOARD_PASSWORD && process.env.AUTH_COOKIE_VALUE);
}

/**
 * Destino interno seguro para redirigir post-login. Rechaza URLs absolutas y
 * protocol-relative (//evil.com, /\evil.com) que de otro modo `new URL(next,
 * origin)` resolvería a un host externo (open redirect). Devuelve una ruta que
 * SIEMPRE empieza con una sola '/'.
 */
export function destinoSeguro(next: string | undefined | null): string {
  if (!next || typeof next !== 'string') return '/';
  // Rechazar caracteres de control (tab/LF/CR y demás C0 + DEL): el parser
  // WHATWG los strippea, así que '/\t//evil.com' evadiría el check de '//' pero
  // new URL(next, origin) lo resolvería a un host externo (open redirect).
  if (/[\x00-\x1f\x7f]/.test(next)) return '/';
  // Normalizar backslashes (Node los trata como '/' al parsear URLs).
  const limpio = next.replace(/\\/g, '/');
  // Debe empezar con '/' pero no con '//' (protocol-relative).
  if (!limpio.startsWith('/') || limpio.startsWith('//')) return '/';
  return limpio;
}

const b64url = (buf: Buffer) => buf.toString('base64url');

function firmar(payload: string, sec: string): string {
  return b64url(crypto.createHmac('sha256', sec).update(payload).digest());
}

/** Crea el token de sesión. Devuelve null si no hay secret configurado. */
export function crearToken(s: Omit<Sesion, 'exp'>, dias: number = SESSION_DIAS): string | null {
  const sec = secret();
  if (!sec) return null;
  const sesion: Sesion = { ...s, exp: Math.floor(Date.now() / 1000) + dias * 24 * 60 * 60 };
  const payload = b64url(Buffer.from(JSON.stringify(sesion), 'utf8'));
  return `v1.${payload}.${firmar(payload, sec)}`;
}

/** Verifica firma + expiración. Devuelve la sesión o null (nunca tira). */
export function verificarToken(token: string | undefined | null): Sesion | null {
  if (!token) return null;
  const sec = secret();
  if (!sec) return null;
  const partes = token.split('.');
  if (partes.length !== 3 || partes[0] !== 'v1') return null;
  const [, payload, firma] = partes;
  const esperada = firmar(payload, sec);
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Sesion;
    if (typeof s.exp !== 'number' || s.exp * 1000 < Date.now()) return null;
    if (s.rol !== 'admin' && s.rol !== 'usuario') return null;
    return s;
  } catch {
    return null;
  }
}
