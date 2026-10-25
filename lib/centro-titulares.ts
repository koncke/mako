// =============================================================================
// El nombre y el email de cada cuenta de Claude, para el Uso del Ops Center (17/10/2026, la G; puro, con test)
// =============================================================================
// Martín (feedback del 17/10, su punto 8): «"Cuenta 1" trae su NOMBRE, editable, y debajo el email de esa cuenta». Los
// titulares viven en la PC, en ~/.claude/cuentas.tsv («claude1<TAB>Nombre <email>», el gmail con que se compró cada
// suscripción: las cuatro son de Martín). La vuelta de cada Runner sube el de SU cuenta; el nombre que Martín le pone en
// la pantalla gana (`alias`).
// ⚠️ SIN `server-only`: lo leen el servidor, la pantalla y los tests (y la PC, con el mismo molde, en cartero.mjs).

import { CUENTA_RE } from './operaciones-reglas';

export type Titular = { nombre: string | null; email: string | null };
export type DatosDeCuenta = Titular & { alias: string | null };
export type CuentasConNombre = Record<string, DatosDeCuenta>;

export const TOPE_NOMBRE_CUENTA = 40;
const EMAIL_RE = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[a-z]{2,24}$/i;

/**
 * Una NOTA entre paréntesis al final no es el nombre (25/10/2026). El renglón de la cuenta 5 es «Ananda (asi la llamo Martin el
 * 24/10/2026; gmail de la suscripcion sin declarar)», y el Uso habría dicho «Ananda (asi la llamo Martin el 24/10/202»: el tope de
 * 40 cortaba la nota y no el nombre. La PC (cartero.mjs → titularDe) la manda cortada y SIN el «)», así que se saca igual.
 */
export function sinNota(nombre: string): string {
  return nombre.replace(/\s*\([^)]*\)?\s*$/, '').trim();
}

/** Un renglón de cuentas.tsv: «Nombre <email>», o sólo el nombre. */
export function titularDeRenglon(texto: string): Titular {
  const t = texto.replace(/\s+/g, ' ').trim();
  const m = /^(.*?)\s*<([^>]+)>\s*$/.exec(t);
  const nombre = sinNota((m ? m[1] : t).trim()).slice(0, TOPE_NOMBRE_CUENTA) || null;
  const email = m && EMAIL_RE.test(m[2].trim()) ? m[2].trim().toLowerCase() : null;
  return { nombre, email };
}

/** Lo que subió una PC (o lo guardado), validado. null = no vale. */
export function sanearTitular(x: unknown): Titular | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const nombre = typeof o.nombre === 'string' ? sinNota(o.nombre.replace(/\s+/g, ' ').trim()).slice(0, TOPE_NOMBRE_CUENTA) || null : null;
  const email = typeof o.email === 'string' && EMAIL_RE.test(o.email.trim()) ? o.email.trim().toLowerCase() : null;
  return nombre || email ? { nombre, email } : null;
}

/** Un nombre que Martín le pone a una cuenta: un renglón, con texto y corto (se rechaza, no se recorta). */
export function aliasValido(v: string): { ok: true; alias: string | null } | { ok: false; error: string } {
  const a = v.replace(/\s+/g, ' ').trim();
  if (a.length > TOPE_NOMBRE_CUENTA) return { ok: false, error: `Acórtalo a ${TOPE_NOMBRE_CUENTA} caracteres.` };
  return { ok: true, alias: a || null };
}

/** El mapa guardado, validado (sólo cuentas claudeN). */
export function sanearCuentasConNombre(x: unknown): CuentasConNombre {
  const out: CuentasConNombre = {};
  if (!x || typeof x !== 'object' || Array.isArray(x)) return out;
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    if (!CUENTA_RE.test(k) || !v || typeof v !== 'object') continue;
    const t = sanearTitular(v) ?? { nombre: null, email: null };
    const a = typeof (v as Record<string, unknown>).alias === 'string' ? aliasValido((v as Record<string, string>).alias) : null;
    out[k] = { ...t, alias: a && a.ok ? a.alias : null };
  }
  return out;
}

/** Cómo se llama una cuenta en pantalla: lo que le puso Martín, el titular, o «Cuenta N». */
export function nombreDeLaCuenta(cuenta: string, d: DatosDeCuenta | null | undefined): string {
  return d?.alias || d?.nombre || `Cuenta ${cuenta.replace(/^claude/, '')}`;
}
