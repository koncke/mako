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

/** Rol GLOBAL de la app: admin = agencia, usuario = lado cliente. */
export type Rol = 'admin' | 'usuario';

/**
 * Rol DENTRO del negocio de un cliente (eje distinto de `Rol`). 'admin' acá =
 * dueño del cliente (ve todas las tabs de SU negocio, NO es admin de la app).
 */
export type RolWorkspace = 'admin' | 'closer' | 'setter';

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
  /** workspace del usuario (multi-inquilino). null = admin sin workspace propio. */
  ws?: number | null;
  /** rol dentro del workspace (equipo del cliente). Se resuelve de la base, no se firma. */
  rolWs?: RolWorkspace | null;
};

export const SESSION_COOKIE = 'mako_session';
export const LEGACY_COOKIE = 'mako_auth';
export const EMAIL_COOKIE = 'mako_email';
/** Cookie de impersonación: workspace que un admin está "viendo como". Firmada. */
export const IMPERSONATE_COOKIE = 'mako_ws';
export const SESSION_DIAS = 30;
/** Workspace dueño: contiene todos los datos previos al multi-inquilino. */
export const OWNER_WS = 1;

/**
 * Secret de firma de las sesiones. SOLO AUTH_SECRET, sin cadena de fallbacks.
 *
 * Antes era `AUTH_SECRET || AUTH_COOKIE_VALUE || DASHBOARD_PASSWORD`, y eso era
 * una vulnerabilidad, no un detalle: AUTH_SECRET no estaba seteado, así que
 * firmaba con AUTH_COOKIE_VALUE — que es el valor que se compara CONTRA la cookie
 * del browser, o sea que viajaba al cliente. Cualquiera con esa cookie conocía la
 * llave HMAC y se forjaba un token con rol:'admin' (y con sub:'password', que
 * ademas saltea el re-chequeo contra la base en lib/auth.ts). Un secreto de firma
 * no puede tener un fallback hacia algo que el cliente ve.
 */
function secret(): string | null {
  const s = process.env.AUTH_SECRET;
  return s && s.trim() ? s : null;
}

/**
 * ¿Se puede verificar una sesión? Es lo ÚNICO que el gate necesita saber.
 *
 * Antes preguntaba por DASHBOARD_PASSWORD && AUTH_COOKIE_VALUE, que era mirar el
 * login viejo: borrar cualquiera de las dos dejaba afuera a TODOS —incluso con
 * Google— porque el proxy es fail-closed. Las credenciales de Google solo hacen
 * falta para EMITIR una sesión, y esas rutas son públicas; para VERIFICARLA
 * alcanza con el secreto de firma. Si algún día falta, sigue cerrando (no abre).
 */
export function gateConfigurado(): boolean {
  return secret() !== null;
}

/**
 * Destino interno seguro para redirigir post-login. Rechaza URLs absolutas y
 * protocol-relative (//evil.com, /\evil.com) que de otro modo `new URL(next,
 * origin)` resolvería a un host externo (open redirect). Devuelve una ruta que
 * SIEMPRE empieza con una sola '/'.
 */
export function destinoSeguro(next: string | undefined | null): string {
  if (!next || typeof next !== 'string') return '/inicio';
  // Rechazar caracteres de control (tab/LF/CR y demás C0 + DEL): el parser
  // WHATWG los strippea, así que '/\t//evil.com' evadiría el check de '//' pero
  // new URL(next, origin) lo resolvería a un host externo (open redirect).
  if (/[\x00-\x1f\x7f]/.test(next)) return '/inicio';
  // Normalizar backslashes (Node los trata como '/' al parsear URLs).
  const limpio = next.replace(/\\/g, '/');
  // Debe empezar con '/' pero no con '//' (protocol-relative).
  if (!limpio.startsWith('/') || limpio.startsWith('//')) return '/inicio';
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

// ── Impersonación (admin "entra como" un cliente) ────────────────────────────
// Valor firmado `w1.<wsId>.<firma>` en la cookie mako_ws. Solo lo setea un
// endpoint admin; getWorkspaceActual lo honra únicamente para sesiones admin.

export function firmarImpersonacion(wsId: number): string | null {
  const sec = secret();
  if (!sec) return null;
  const body = String(wsId);
  return `w1.${body}.${firmar(body, sec)}`;
}

export function leerImpersonacion(cookie: string | undefined | null): number | null {
  if (!cookie) return null;
  const sec = secret();
  if (!sec) return null;
  const partes = cookie.split('.');
  if (partes.length !== 3 || partes[0] !== 'w1') return null;
  const [, body, firma] = partes;
  const a = Buffer.from(firma);
  const b = Buffer.from(firmar(body, sec));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const ws = Number(body);
  return Number.isInteger(ws) && ws > 0 ? ws : null;
}
