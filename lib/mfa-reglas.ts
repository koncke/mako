// =============================================================================
// mfa-reglas — las reglas del segundo factor, PURAS (sin base, sin red, sin env)
// =============================================================================
// Vive aparte de lib/mfa.ts por la misma razón que `exigirClienteDePrueba`: sin
// `server-only` y sin Supabase, un test la puede importar. Es el código donde un error
// abre la puerta de toda la app, así que es el que más necesita red.
//
// Lo usan lib/auth-session.ts (y con él el proxy), lib/mfa.ts y los tests.

import crypto from 'node:crypto';

/** Cómo se probó el segundo factor de una sesión. Viaja FIRMADO en el token. */
export type Factor = 'totp' | 'passkey' | 'whatsapp' | 'email' | 'recuperacion';
export type Amr = Factor | 'dispositivo' | 'dev';
export const AMRS: readonly Amr[] = ['totp', 'passkey', 'whatsapp', 'email', 'recuperacion', 'dispositivo', 'dev'];

// ── La política ──────────────────────────────────────────────────────────────

/**
 * ¿Este usuario necesita segundo factor para tener sesión?
 *
 * El super admin SIEMPRE (pedido de Martín: «si me llegan a entrar en la cuenta de
 * email, toda la app está en riesgo»). Los demás, sólo si lo activaron: para ellos es
 * opcional y recomendado.
 */
export function requiereSegundoFactor(rol: string, mfaActivo: boolean): boolean {
  return rol === 'admin' || mfaActivo === true;
}

export type DecisionGoogle = 'sesion' | 'segundo-factor' | 'bloquear';

/**
 * Qué hacer cuando Google ya dijo quién es.
 *
 * ⚠️ `tieneFila: false` es el usuario de emergencia que el callback arma cuando la BASE
 * está caída (`allowlist-fallback`, id 0). Antes entraba como admin directo — era el
 * «break-glass». Con segundo factor obligatorio ese atajo es exactamente una puerta sin
 * segundo factor: sin base no hay con qué comprobarlo, así que se BLOQUEA. Que el login
 * del super admin dependa de la base es el precio, y es el correcto: sin base la app no
 * sirve igual.
 */
export function decidirTrasGoogle(x: {
  rol: string; mfaActivo: boolean; tieneFila: boolean; dispositivoValido: boolean;
}): DecisionGoogle {
  if (!requiereSegundoFactor(x.rol, x.mfaActivo)) return 'sesion';
  if (!x.tieneFila) return 'bloquear';
  if (x.dispositivoValido) return 'sesion';
  return 'segundo-factor';
}

/**
 * ¿Se puede ENROLAR un factor sin sesión completa (desde la pantalla del segundo paso)?
 *
 * Sólo cuando no hay NINGUNO: es el arranque del super admin, que no puede entrar sin
 * segundo factor y no tiene uno todavía. Con uno ya cargado, sumar otro exige la sesión
 * completa — si no, quien tuviera la cuenta de Google se enrolaba el suyo y entraba.
 */
export function puedeEnrolarSinSesion(cantFactores: number): boolean {
  return cantFactores === 0;
}

// ── Freno contra la fuerza bruta ─────────────────────────────────────────────

/** Fallos tolerados en la ventana. Con TOTP valen 3 códigos a la vez (±1 paso), así que 8
 *  intentos cada 15 min dan ~1 en 41.000 por ventana: suficiente, y no castiga al que se
 *  equivocó dos veces. ⚠️ Eso vale sólo si el freno no se puede saltear en paralelo: ver
 *  `debeFrenar` y `intentar` (lib/mfa.ts). */
export const MAX_FALLOS = 8;
export const VENTANA_FALLOS_MIN = 15;
export function bloqueadoPorFallos(fallosRecientes: number): boolean {
  return fallosRecientes >= MAX_FALLOS;
}

/**
 * ¿Se frena ESTE intento? `contados` son los intentos fallidos o en vuelo de la ventana,
 * INCLUIDO éste: se cuenta DESPUÉS de anotarlo.
 *
 * ⚠️ El orden es el freno. Contar primero y anotar el fallo después de verificar dejaba
 * pasar una ráfaga entera: 500 pedidos en paralelo leían «0 fallos» antes de que ninguno
 * escribiera el suyo (revisión del 14/10/2026). Anotando primero, el k-ésimo pedido ve al
 * menos k filas, así que como mucho MAX_FALLOS llegan a verificar.
 */
export function debeFrenar(contados: number): boolean {
  return contados > MAX_FALLOS;
}

/** Cuánto vive un código mandado por WhatsApp o correo, y cuántas veces se puede probar. */
export const CODIGO_MINUTOS = 10;
export const CODIGO_INTENTOS = 5;

/** «Recordar este dispositivo»: cuánto. */
export const DISPOSITIVO_DIAS = 30;

// ── Por dónde sale un código ─────────────────────────────────────────────────

export type Canal = 'whatsapp' | 'email';

/**
 * Los canales por los que HOY sale un código. Vacío a propósito (tanda 1, 14/10/2026).
 *
 * ⛔ El código por WhatsApp y por correo sale en la tanda 2 por una automatización del
 * SuperAdmin («aprovechando Automations de SuperAdmin», pedido de Martín), nunca por un
 * emisor propio: si saliera uno ahora, después nadie lo saca. Y el motor todavía no le
 * puede escribir a una persona de `usuarios` (docs/hallazgos-seguridad.md → «El 2FA del
 * login YA está escrito a medias»). Con la lista vacía la pantalla no los ofrece y el
 * server los rechaza: las dos puertas preguntan acá.
 */
export const CANALES_CODIGO: readonly Canal[] = [];

export function canalDisponible(canal: Canal, disponibles: readonly Canal[] = CANALES_CODIGO): boolean {
  return disponibles.includes(canal);
}

export const CANAL_NO_DISPONIBLE = 'Ese método todavía no está disponible.';

// ── TOTP (RFC 6238 sobre HOTP, RFC 4226) ─────────────────────────────────────

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0, valor = 0, out = '';
  for (const byte of buf) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(valor << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const limpio = s.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0, valor = 0;
  const out: number[] = [];
  for (const c of limpio) {
    const i = B32.indexOf(c);
    if (i < 0) throw new Error('base32 inválido');
    valor = (valor << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const TOTP_PASO_S = 30;
export const TOTP_DIGITOS = 6;
/** Pasos de tolerancia a cada lado: ±30 s por el reloj del teléfono. */
export const TOTP_VENTANA = 1;

/** 160 bits, el tamaño que recomienda la RFC 4226 para HMAC-SHA1. */
export function generarSecretoTotp(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function pasoTotp(ahoraMs: number = Date.now()): number {
  return Math.floor(ahoraMs / 1000 / TOTP_PASO_S);
}

/** HOTP del paso dado. SHA-1 porque es lo que leen TODAS las apps de autenticación. */
export function codigoTotp(secretoB32: string, paso: number, digitos: number = TOTP_DIGITOS): string {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(paso));
  const h = crypto.createHmac('sha1', base32Decode(secretoB32)).update(contador).digest();
  const o = h[h.length - 1] & 0x0f;
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(bin % 10 ** digitos).padStart(digitos, '0');
}

export type ResultadoTotp = { ok: true; paso: number } | { ok: false; motivo: 'formato' | 'invalido' | 'repetido' };

/**
 * Verifica un código TOTP.
 *
 * ⚠️ `ultimoPaso` frena la REPETICIÓN: un código que ya se aceptó no vale otra vez,
 * aunque siga dentro de su ventana. Sin esto, quien mirara la pantalla por encima del
 * hombro tenía 90 segundos para reusarlo.
 */
export function verificarTotp(
  secretoB32: string, codigo: string, opts: { ahoraMs?: number; ultimoPaso?: number | null } = {},
): ResultadoTotp {
  const c = String(codigo ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return { ok: false, motivo: 'formato' };
  const actual = pasoTotp(opts.ahoraMs ?? Date.now());
  for (let d = -TOTP_VENTANA; d <= TOTP_VENTANA; d++) {
    const paso = actual + d;
    if (igualSeguro(codigoTotp(secretoB32, paso), c)) {
      if (opts.ultimoPaso != null && paso <= opts.ultimoPaso) return { ok: false, motivo: 'repetido' };
      return { ok: true, paso };
    }
  }
  return { ok: false, motivo: 'invalido' };
}

/** El link que lee la app de autenticación (y el QR que se dibuja con él). */
export function uriOtpauth(secretoB32: string, cuenta: string, emisor: string = 'MaKo'): string {
  const etiqueta = encodeURIComponent(`${emisor}:${cuenta}`);
  const q = new URLSearchParams({
    secret: secretoB32, issuer: emisor, algorithm: 'SHA1', digits: String(TOTP_DIGITOS), period: String(TOTP_PASO_S),
  });
  return `otpauth://totp/${etiqueta}?${q.toString()}`;
}

// ── Códigos sueltos ──────────────────────────────────────────────────────────

/** Un código numérico para WhatsApp o correo. `randomInt` y no Math.random. */
export function generarCodigoNumerico(digitos: number = 6): string {
  return String(crypto.randomInt(0, 10 ** digitos)).padStart(digitos, '0');
}

/**
 * Lo que se GUARDA de un código: un HMAC con un secreto del server, nunca el código ni
 * un hash pelado. Un código de 6 dígitos tiene un millón de valores: con un sha256 sin
 * llave, quien leyera la tabla los recorría todos en un segundo.
 */
export function hmacCodigo(codigo: string, llave: string): string {
  return crypto.createHmac('sha256', llave).update(`mfa:${codigo}`).digest('hex');
}

/** Códigos de recuperación: `xxxxx-xxxxx` en minúscula, 50 bits cada uno. */
export function generarCodigosRecuperacion(n: number = 10): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const s = base32Encode(crypto.randomBytes(7)).slice(0, 10).toLowerCase();
    out.push(`${s.slice(0, 5)}-${s.slice(5)}`);
  }
  return out;
}

/** Para comparar lo que la persona tipeó: sin espacios ni guiones, en minúscula. */
export function normalizarCodigoRecuperacion(s: string): string {
  return String(s ?? '').toLowerCase().replace(/[\s-]/g, '');
}

export function igualSeguro(a: string, b: string): boolean {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ── Validaciones de los destinos ─────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * El correo de respaldo tiene que ser OTRO que el de entrar.
 *
 * ⚠️ El login de MaKo ES la cuenta de Google. Si el código llegara a ese mismo correo, el
 * que se robó la cuenta de Google recibe el código también: dos «factores» que son el
 * mismo. Es exactamente el riesgo que Martín describió al pedirlo.
 */
export function validarEmailRespaldo(respaldo: string, emailLogin: string):
  { ok: true; email: string } | { ok: false; error: string } {
  const e = String(respaldo ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return { ok: false, error: 'Ese correo no es válido.' };
  if (e === String(emailLogin ?? '').trim().toLowerCase()) {
    return { ok: false, error: 'Tiene que ser otro correo que el de entrar: si te roban ése, el código llegaría al mismo lugar.' };
  }
  return { ok: true, email: e };
}

/** Un teléfono en dígitos con código de país (8 a 15, E.164 sin el +). */
export function validarTelefono(tel: string): { ok: true; digitos: string } | { ok: false; error: string } {
  const d = String(tel ?? '').replace(/\D/g, '');
  if (d.length < 8 || d.length > 15) return { ok: false, error: 'Pon el número con código de país.' };
  return { ok: true, digitos: d };
}

/** Lo que se muestra de un destino sin revelarlo entero: `•••• 2605`, `ma•••@gmail.com`. */
export function enmascarar(destino: string): string {
  const s = String(destino ?? '');
  if (s.includes('@')) {
    const [u, dom] = s.split('@');
    return `${u.slice(0, 2)}•••@${dom}`;
  }
  return `•••• ${s.slice(-4)}`;
}

// ── Passkeys: para qué dominio valen ─────────────────────────────────────────

export type RelyingParty = { rpID: string; origenes: string[] };

/**
 * El dominio (RP ID) y los orígenes contra los que se registra y se verifica una passkey.
 *
 * ⚠️ Es una lista FIJA, no el host que llegó en el pedido. Una passkey queda atada a su
 * RP ID para siempre: si se tomara del pedido, una registrada desde un dominio viejo o un
 * preview no serviría en producción, y un host falso en la cabecera podría pedir una
 * firma para otro sitio. `www.` entra porque una passkey de `hola-mako.com` vale en sus
 * subdominios. En local vale `localhost` y nada más: WebAuthn no acepta una IP como RP ID.
 * Cualquier otro host (un preview de Vercel) contesta null: ahí no hay passkeys.
 */
export function relyingParty(hostPedido: string, hostCanonico: string): RelyingParty | null {
  const h = String(hostPedido ?? '').toLowerCase().trim();
  const sinPuerto = h.split(':')[0];
  if (sinPuerto === 'localhost') return { rpID: 'localhost', origenes: [`http://${h}`] };
  const c = String(hostCanonico ?? '').toLowerCase().trim();
  if (c && (sinPuerto === c || sinPuerto === `www.${c}`)) {
    return { rpID: c, origenes: [`https://${c}`, `https://www.${c}`] };
  }
  return null;
}
