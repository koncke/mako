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
import { AMRS, type Amr } from './mfa-reglas';

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
  /**
   * Cómo se probó el SEGUNDO factor de esta sesión. Va FIRMADO: no se puede agregar a
   * mano sin la llave. Ausente = la sesión nació sin segundo factor, y eso para un
   * admin quiere decir que NO es una sesión (ver `verificarToken`).
   */
  mfa?: Amr;
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
 * El workspace de PRUEBA de la agencia — «Cliente de Prueba».
 *
 * Es el único donde se pueden usar los controles destructivos de la barra de
 * impersonación: traer los datos de Mauricio y el Reset que vacía el workspace
 * entero (50+ tablas y 4 buckets de storage).
 *
 * ⚠️ Existe porque la condición anterior era «cualquier workspace que no sea el
 * del dueño». Eso protegía a Mauricio y a NADIE MÁS: el botón de vaciar aparecía
 * también en los workspaces de los clientes reales. La función que lo decidía se
 * llamaba `wsDePrueba()`, que es exactamente lo que alguien creyó que hacía.
 *
 * Si algún día el cliente de prueba es otro, se cambia acá y en ningún lado más.
 */
export const WS_PRUEBA = 3;

/**
 * El workspace de prueba de DISEÑO — «Cliente de Diseño».
 *
 * Hermano del anterior, y separado a propósito: en el 3 se prueba que las cosas
 * FUNCIONEN y en éste se prueba cómo se VEN. Compartirlos significaba que un
 * reset a mitad de una prueba de tema te dejaba sin datos, y que un cambio de
 * tema te ensuciaba la prueba funcional.
 *
 * Es el único workspace donde la barra de la agencia ofrece cambiar el tema del
 * rebrand: así se puede mirar el rediseño sobre datos reales sin tocarle el
 * color a ningún cliente de verdad hasta que esté decidido.
 *
 * El id es explícito y bajo (el 4 estaba libre y la secuencia ya pasó por ahí,
 * así que no colisiona con un `crearWorkspace` futuro). Si algún día cambia, se
 * cambia acá y en ningún lado más.
 */
export const WS_DISENO = 4;

/**
 * Los workspaces donde se puede romper. **Lista blanca, en positivo.**
 *
 * ⚠️ Que sean dos y no uno es exactamente el momento en que este guard se puede
 * degradar sin que nadie lo note. La forma peligrosa sería volver a preguntar
 * «¿no es el del dueño?»; la forma correcta sigue siendo enumerar. Un cliente
 * nuevo NO entra acá solo, que es todo el punto.
 */
export const WS_PRUEBAS: readonly number[] = [WS_PRUEBA, WS_DISENO];

/** ¿Este workspace es uno de los de prueba? Sin tirar, para decidir qué pintar. */
export function esClienteDePrueba(ws: number | null | undefined): boolean {
  return typeof ws === 'number' && WS_PRUEBAS.includes(ws);
}

/**
 * Tira si `ws` no es el cliente de prueba. La usa todo lo que borra en masa.
 *
 * Está acá, en un módulo SIN `server-only`, y no adentro de `reset-workspace.ts`,
 * por una razón concreta: así se puede TESTEAR. El módulo del reset no se puede
 * importar desde un test —`server-only` lo corta— así que mientras la condición
 * viviera adentro, la guarda más peligrosa de la app era la única sin red.
 */
export function exigirClienteDePrueba(ws: number): void {
  if (!Number.isInteger(ws)) throw new Error('Workspace inválido.');
  // El del dueño tiene su propio mensaje: es el error que más asusta y conviene
  // que se lea distinto del genérico.
  if (ws === OWNER_WS) throw new Error('El workspace del dueño no se resetea. Nunca.');
  // Lista blanca explícita, nunca «distinto de». Ver WS_PRUEBAS.
  if (!WS_PRUEBAS.includes(ws)) {
    throw new Error(`Solo se puede vaciar un cliente de prueba (workspaces ${WS_PRUEBAS.join(' y ')}). Este es el ${ws}, que es de un cliente real.`);
  }
}

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

// ── El servidor de desarrollo: un admin SIN login sólo en la máquina ──────────
//
// ⚠️ EL CASO (15/10/2026, lo encontró el chat del Centro de Operaciones y se amplió acá). `next
// dev` escucha en TODA la red (0.0.0.0) y el `.env.local` trae la service_role de PRODUCCIÓN. Dos
// puertas daban un admin global sin login a cualquiera que llegara al puerto: `/api/auth/dev-login`
// (activa en todo checkout con AUTH_SECRET, o sea en todos) y la sesión «dev» de `getUsuarioActual`
// cuando falta AUTH_SECRET (latente: hoy ningún checkout está así). Alguien en la misma WiFi —o una
// página web cualquiera, por DNS rebinding— salía con escritura en la base de producción.
//
// Las tres capas, y lo que cubre cada una:
//   1. `next dev -H 127.0.0.1` (package.json): desde la red ya no se llega al puerto. Es la que
//      importa; las otras dos son para cuando alguien levanta `next dev` a mano, sin el script.
//   2. `esHostLocal`: el pedido tiene que nombrar a la máquina. Frena el DNS rebinding (el Host
//      es el dominio del atacante) y el navegador de otro en la red. NO frena un `curl` con el
//      Host falseado a mano: eso lo frena la capa 1.
//   3. La sesión sin AUTH_SECRET exige además un permiso explícito, `MAKO_DEV_SIN_LOGIN=1`: un
//      `.env.local` armado a mano, o un `vercel env pull` de un entorno sin el secreto, ya no la
//      abre solo.

/** ¿Está corriendo en un deploy (Vercel, o un build de producción)? Ahí nada de esto existe. */
export function esEntornoDesplegado(): boolean {
  return !!process.env.VERCEL || process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

/** ¿El pedido nombra a ESTA máquina? Mira el Host, sin el puerto. En positivo: sólo loopback. */
export function esHostLocal(host: string | null | undefined): boolean {
  const h = String(host ?? '').trim().toLowerCase();
  if (!h) return false;
  const sinPuerto = h.startsWith('[') ? h.slice(0, h.indexOf(']') + 1) : h.split(':')[0];
  return sinPuerto === 'localhost' || sinPuerto === '127.0.0.1' || sinPuerto === '[::1]';
}

/** `/api/auth/dev-login`: fuera de un deploy y sólo desde la máquina. */
export function devLoginPermitido(host: string | null | undefined): boolean {
  return !esEntornoDesplegado() && esHostLocal(host);
}

/** La sesión «dev» sin login (sin AUTH_SECRET): con el permiso explícito, fuera de un deploy y
 *  desde la máquina. Sin el permiso, sin secreto no hay sesión: el proxy lo dice y no deja pasar. */
export function sinLoginPermitido(host: string | null | undefined): boolean {
  return !gateConfigurado() && !esEntornoDesplegado() && process.env.MAKO_DEV_SIN_LOGIN === '1' && esHostLocal(host);
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
    // ⛔ EL SUPER ADMIN NO TIENE SESIÓN SIN SEGUNDO FACTOR. Acá y no en cada pantalla:
    // por esta función pasan el proxy (que decide si una ruta abre) y `getUsuarioActual`
    // (que decide qué ve el server), así que no queda una puerta que la saltee. Un token
    // de admin emitido ANTES del 2FA no lo trae y deja de valer: hay que volver a entrar
    // con Google, y ahí se pide el segundo paso. Un valor desconocido tampoco vale.
    if (s.mfa !== undefined && !AMRS.includes(s.mfa)) return null;
    if (s.rol === 'admin' && !s.mfa) return null;
    return s;
  } catch {
    return null;
  }
}

// ── El paso intermedio: Google ya dijo quién es, falta el segundo factor ─────
// Un token APARTE, con su propio prefijo (`p1.`) y firmado con separación de dominio
// (`preauth:` adelante de lo firmado): `verificarToken` no lo acepta ni aunque alguien
// le cambie el prefijo a mano, porque la firma no le cierra. Así una ruta que pregunta
// «¿hay sesión?» contesta que NO para quien está a mitad del login, sin que esa ruta
// tenga que saber que el paso intermedio existe.
//
// Vive 15 minutos: es lo que tarda alguien en abrir su app de autenticación o esperar
// un WhatsApp, y no más. Pasado eso, se vuelve a entrar con Google.

export const PREAUTH_COOKIE = 'mako_preauth';
export const PREAUTH_MINUTOS = 15;

export type Preauth = {
  sub: string; email: string; nombre: string; rol: Rol;
  /** Adónde va después del segundo paso. Ya pasó por `destinoSeguro`. */
  next: string;
  /** La foto de Google, para `registrarLogin` cuando el login se COMPLETE (no antes). */
  foto?: string;
  /**
   * El segundo factor YA PASÓ, y con cuál (15/10/2026). Lo pone la ruta del segundo paso cuando
   * falta crear la contraseña obligatoria: el paso intermedio sigue, pero la pantalla que queda es
   * la de la contraseña, y al guardarla la sesión se abre con ESTE factor, sin pedir otro código.
   */
  mfa?: Amr;
  /** «Recordar este dispositivo», elegido en el segundo paso: se aplica al terminar. */
  recordar?: boolean;
  exp: number;
};

export function crearPreauth(p: Omit<Preauth, 'exp'>, minutos: number = PREAUTH_MINUTOS): string | null {
  const sec = secret();
  if (!sec) return null;
  const cuerpo: Preauth = { ...p, next: destinoSeguro(p.next), exp: Math.floor(Date.now() / 1000) + minutos * 60 };
  const payload = b64url(Buffer.from(JSON.stringify(cuerpo), 'utf8'));
  return `p1.${payload}.${firmar(`preauth:${payload}`, sec)}`;
}

export function verificarPreauth(token: string | undefined | null): Preauth | null {
  if (!token) return null;
  const sec = secret();
  if (!sec) return null;
  const partes = token.split('.');
  if (partes.length !== 3 || partes[0] !== 'p1') return null;
  const [, payload, firma] = partes;
  const a = Buffer.from(firma);
  const b = Buffer.from(firmar(`preauth:${payload}`, sec));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Preauth;
    if (typeof p.exp !== 'number' || p.exp * 1000 < Date.now()) return null;
    if (p.rol !== 'admin' && p.rol !== 'usuario') return null;
    if (typeof p.sub !== 'string' || typeof p.email !== 'string') return null;
    if (p.mfa !== undefined && !AMRS.includes(p.mfa)) return null;
    return { ...p, next: destinoSeguro(p.next) };
  } catch {
    return null;
  }
}

/** «Recordar este dispositivo»: la cookie lleva un token al azar; la base, su HMAC. */
export const DISPOSITIVO_COOKIE = 'mako_disp';

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

// ── Vista de agencia (una agencia "entra como" un cliente SUYO) ──────────────
// Valor firmado `a1.<agenciaWs>.<clienteWs>.<exp>.<firma>` en la cookie
// mako_agencia.
//
// ⚠️ LA DIFERENCIA CON `firmarImpersonacion`, Y ES LA RAZÓN DE QUE SEA OTRO
// TOKEN: éste dice QUIÉN. El viejo firma sólo el número del workspace
// (`w1.<wsId>.<firma>`), así que la cookie es PORTABLE entre sesiones — hoy da
// igual porque sólo la honra un admin global, que ya podía entrar a cualquier
// lado igual. Acá no da igual: si el token no nombrara a la agencia, la cookie
// de Juanfran pegada en el navegador de otro cliente le abriría los datos del
// cliente de Juanfran. Con el sujeto adentro, `resolverDesdeCookies` la descarta
// porque `agenciaWs` no coincide con el workspace de esa sesión.
//
// ⚠️ Y LLEVA VENCIMIENTO. El de impersonación lo delega en la cookie (12 h), que
// es una promesa del navegador y no del servidor: una cookie sin `max-age`
// copiada a mano vale para siempre. Acá el `exp` va FIRMADO, así que reescribir
// la cookie no lo estira.
//
// Lo que este token NO contesta es si la cartera sigue aprobada: eso cambia
// después de firmarlo (el super-admin revoca) y se vuelve a preguntar en cada
// request. Ver `contextoDeAgencia` en lib/agencia.ts.

export const AGENCIA_COOKIE = 'mako_agencia';

/** Cuánto vale el token. Corto a propósito: es la ventana en la que una
 *  revocación todavía no se aplicó si la consulta a la base fallara. */
export const AGENCIA_HORAS = 8;

export type ContextoAgencia = { agenciaWs: number; clienteWs: number };

export function firmarAgencia(agenciaWs: number, clienteWs: number, horas = AGENCIA_HORAS): string | null {
  const sec = secret();
  if (!sec) return null;
  if (!enteroPositivo(agenciaWs) || !enteroPositivo(clienteWs)) return null;
  // Una agencia no se mira a sí misma: su propio workspace ya sale de sesion.ws,
  // y un token así haría que el cartel de «estás viendo a otro» se dibujara
  // sobre la cuenta propia. Mismo corte que el CHECK de la mig 0175.
  if (agenciaWs === clienteWs) return null;
  const exp = Math.floor(Date.now() / 1000) + horas * 3600;
  const body = `${agenciaWs}.${clienteWs}.${exp}`;
  return `a1.${body}.${firmar(body, sec)}`;
}

export function leerAgencia(cookie: string | undefined | null): ContextoAgencia | null {
  if (!cookie) return null;
  const sec = secret();
  if (!sec) return null;
  const partes = cookie.split('.');
  if (partes.length !== 5 || partes[0] !== 'a1') return null;
  const [, ag, cl, exp, firmaRecibida] = partes;
  const body = `${ag}.${cl}.${exp}`;
  const a = Buffer.from(firmaRecibida);
  const b = Buffer.from(firmar(body, sec));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const vence = Number(exp);
  if (!Number.isInteger(vence) || vence * 1000 < Date.now()) return null;
  const agenciaWs = Number(ag);
  const clienteWs = Number(cl);
  if (!enteroPositivo(agenciaWs) || !enteroPositivo(clienteWs)) return null;
  if (agenciaWs === clienteWs) return null;
  return { agenciaWs, clienteWs };
}

function enteroPositivo(v: number): boolean {
  return Number.isInteger(v) && v > 0;
}
