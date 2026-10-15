// =============================================================================
// contrasena-reglas — la contraseña de MaKo, PURA (sin base, sin red, sin env)
// =============================================================================
// Decisión de Martín (15/10/2026), textual: «Si, para mí también debería ser obligatorio tenerlo,
// como todos. Pero si inicio con Google no debería pedirme la contraseña también.» Y la fecha: la
// MISMA que el 2FA obligatorio (21/10). O sea: tener contraseña es obligatorio para todos, y es un
// camino de entrada ALTERNATIVO a Google (para el día que Google no esté), nunca un paso más.
// El diseño, en docs/diseno-login-contrasena.md.
//
// Aparte de lib/contrasena.ts por lo de siempre: sin `server-only`, un test la puede importar.

import crypto from 'node:crypto';
import { exigidoYa } from './mfa-reglas';

// ── La política ──────────────────────────────────────────────────────────────

export const MIN_CONTRASENA = 12;
/** Tope de largo: scrypt sobre un cuerpo de megas es una forma barata de tirar el server. */
export const MAX_CONTRASENA = 128;

/** ¿Sirve como contraseña? El error es una frase corta: se dibuja debajo del campo. */
export function problemaDeContrasena(contrasena: unknown, email: string): string | null {
  if (typeof contrasena !== 'string') return 'Escribe una contraseña.';
  const largo = [...contrasena].length;
  if (largo < MIN_CONTRASENA) return `Usa ${MIN_CONTRASENA} caracteres o más.`;
  if (largo > MAX_CONTRASENA) return `Usa ${MAX_CONTRASENA} caracteres o menos.`;
  const p = contrasena.trim().toLowerCase();
  const e = String(email ?? '').trim().toLowerCase();
  const usuarioDelCorreo = e.split('@')[0] ?? '';
  if (p === e || (usuarioDelCorreo.length >= 4 && p.includes(usuarioDelCorreo))) return 'No uses tu correo.';
  if (new Set([...contrasena]).size <= 2) return 'Elige algo menos predecible.';
  return null;
}

// ── Cuándo se exige ─────────────────────────────────────────────────────────

/**
 * ¿El login tiene que pedirle CREARLA antes de dejarlo pasar? Desde la misma fecha que el 2FA
 * obligatorio (`workspaces.mfa_obligatorio_desde`, decisión de Martín: el 21/10 las dos cosas) y
 * sólo a quien no la tiene. Se pide DESPUÉS del segundo factor, que en ese momento es fresco.
 *
 * ⚠️ `tiene` null = «no pude leer»: no se exige. Un error NUESTRO no deja a nadie afuera; el
 * pendiente sigue y se le vuelve a pedir en el próximo login.
 */
export function requiereCrearContrasena(tiene: boolean | null, obligatorioDesde: string | null | undefined, ahora: number = Date.now()): boolean {
  return tiene === false && exigidoYa(obligatorioDesde, ahora);
}

// ── El hash: scrypt de node:crypto, con los parámetros guardados al lado ─────
//
// `scrypt$<log2N>$<r>$<p>$<sal>$<hash>` (base64url). Guardar los parámetros deja subirlos después
// sin romper las contraseñas viejas: cada una se verifica con los suyos.

const N_LOG2 = 15;   // N = 32768
const R = 8;
const P = 1;
const LARGO = 32;
const MAXMEM = 64 * 1024 * 1024;

function scrypt(contrasena: string, sal: Buffer, nLog2: number, r: number, p: number): Promise<Buffer> {
  return new Promise((ok, mal) => {
    crypto.scrypt(contrasena.normalize('NFKC'), sal, LARGO, { N: 2 ** nLog2, r, p, maxmem: MAXMEM }, (err, k) => (err ? mal(err) : ok(k)));
  });
}

export async function hashContrasena(contrasena: string): Promise<string> {
  const sal = crypto.randomBytes(16);
  const k = await scrypt(contrasena, sal, N_LOG2, R, P);
  return ['scrypt', N_LOG2, R, P, sal.toString('base64url'), k.toString('base64url')].join('$');
}

/** ¿Coincide? En tiempo constante. Un hash con otra forma no coincide nunca (no tira). */
export async function verificarContrasena(contrasena: string, guardado: string | null | undefined): Promise<boolean> {
  const partes = String(guardado ?? '').split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [nLog2, r, p] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  if (![nLog2, r, p].every((x) => Number.isInteger(x) && x > 0) || nLog2 > 20 || r > 32 || p > 4) return false;
  const esperado = Buffer.from(partes[5], 'base64url');
  if (esperado.length !== LARGO || typeof contrasena !== 'string' || [...contrasena].length > MAX_CONTRASENA) return false;
  try {
    const k = await scrypt(contrasena, Buffer.from(partes[4], 'base64url'), nLog2, r, p);
    return crypto.timingSafeEqual(k, esperado);
  } catch {
    return false;
  }
}

/**
 * Un hash de mentira, ya calculado una vez, para comprobar contra él cuando el correo no existe o no
 * tiene contraseña: la respuesta tarda lo mismo y no cuenta qué correos hay. Se arma perezoso.
 */
let falso: Promise<string> | null = null;
export function hashDeRelleno(): Promise<string> {
  falso ??= hashContrasena(crypto.randomBytes(24).toString('base64url'));
  return falso;
}

/** El correo como lo escribe una persona: sin espacios y en minúsculas. */
export function correoNormalizado(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}
