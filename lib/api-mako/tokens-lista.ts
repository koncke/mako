// =============================================================================
// api-mako/tokens-lista — los tokens DETALLADOS de un workspace, la parte pura
// =============================================================================
// Copiados de los «fine-grained personal access tokens» de GitHub (decisión de Martín,
// 08/10/2026: «copialo todo, tal cual»). Cada token tiene nombre, descripción, una
// EXPIRACIÓN y permisos POR ÁREA (Sin acceso / Solo lectura / Lectura y escritura,
// lib/api-mako/permisos.ts). Con escritura en un área, ESCRIBE DIRECTO, como en GitHub.
// El token principal de la skill de Claude (`agente_token`, prefijo `mkoag_`) es el
// «clásico»: alcance global en el prefijo, y propone en vez de escribir.
//
// Cómo se guardan, y por qué así:
//   · la LISTA vive en el setting `api_tokens` del workspace (JSON). Es la fuente de verdad
//     de qué token está vigente: revocar es sacarlo de ahí.
//   · del token se guarda el HASH (sha256), nunca el valor: se muestra UNA vez al crearlo o
//     regenerarlo, como en GitHub.
//   · el índice token → workspace es `webhook_routing('api_token', <hash>, ws)`; es
//     append-only, así que un token revocado sigue teniendo su fila ahí y lo que decide es
//     la lista.
//
// ⚠️ Un token detallado vale SOLO para /api/v1. `/api/agente/*` resuelve con
// `wsPorAgenteToken`, que mira únicamente el principal, y es a propósito: la ruta de la
// skill (`/api/agente/skill`) le devuelve al que pide el token PRINCIPAL metido en el
// archivo, y el reporte del plugin (`/hook`, `/telemetria`) tiene su consentimiento atado
// a ese token. tests/api-mako-tokens.test.ts lo fija.
//
// SIN `server-only`: puro, con test. Un componente cliente sólo importa TIPOS de acá
// (node:crypto no existe en el navegador).
// =============================================================================

import { createHash } from 'node:crypto';
import type { Permisos } from './permisos';
import { sanearPermisos } from './permisos';

/** El setting (por workspace) con la lista de tokens detallados. */
export const API_TOKENS_KEY = 'api_tokens';
/** El setting con el último uso de cada token, por id. Aparte de la lista a propósito: se
 *  escribe al autenticar (con freno) y una escritura de uso que corriera contra la lista
 *  podía revivir un token recién revocado. */
export const API_TOKENS_USO_KEY = 'api_tokens_uso';
/** El servicio de `webhook_routing` donde se indexa el hash. NO es `agente`: ese índice
 *  resuelve el principal. */
export const SERVICIO_API = 'api_token';
/** El id con el que se anota el uso del token principal (el de la skill). */
export const ID_PRINCIPAL = 'principal';
/** El prefijo de un token detallado, como `github_pat_` en GitHub: dice a simple vista que
 *  es un token de MaKo (y deja que un escáner de secretos lo reconozca). */
export const PREFIJO_DETALLADO = 'mako_pat_';
// Los topes y las opciones del formulario viven en tokens-forma.ts (sin node:crypto, para que
// los lea la pantalla); se re-exportan acá para el resto del servidor.
export {
  MAX_TOKENS, MAX_NOMBRE, MAX_DESCRIPCION, MAX_DIAS_EXPIRACION,
  OPCIONES_EXPIRACION, EXPIRACION_POR_DEFECTO, TEXTO_EXPIRACION, type OpcionExpiracion,
} from './tokens-forma';
import { MAX_TOKENS, MAX_NOMBRE, MAX_DESCRIPCION, MAX_DIAS_EXPIRACION } from './tokens-forma';

export type TokenGuardado = {
  id: string;
  nombre: string;
  descripcion: string;
  permisos: Permisos;
  /** sha256 hex del token. El valor no se guarda en ningún lado. */
  hash: string;
  /** cómo se lo reconoce sin mostrarlo: `mako_pat_…9f3a` */
  pista: string;
  creado: string;
  creadoPor: string;
  /** ISO del vencimiento; null = sin vencimiento */
  expira: string | null;
  /** la última vez que se regeneró (valor nuevo, mismos permisos) */
  regenerado?: string;
};

/** Lo que baja a la pantalla: sin el hash. */
export type TokenPublico = Omit<TokenGuardado, 'hash'> & { ultimoUso: string | null; vencido: boolean };

/** El principal (la skill de Claude), tal como lo ve la pantalla: el «clásico». */
export type TokenPrincipal = { alcance: 'lectura' | 'proponer' | 'ejecutar'; pista: string; ultimoUso: string | null };

export const hashDeToken = (token: string): string => createHash('sha256').update((token ?? '').trim()).digest('hex');

/** `mako_pat_…9f3a` / `mkoag_l_…9f3a`: el prefijo dice qué es y los cuatro últimos lo distinguen. */
export function pistaDe(token: string): string {
  const t = (token ?? '').trim();
  const m = /^(mako_pat_|mkoag_(?:[lpe]_)?)/i.exec(t);
  return `${m ? m[1] : ''}…${t.slice(-4)}`;
}

/** ¿Venció? Un token sin vencimiento no vence nunca. */
export const vencido = (t: Pick<TokenGuardado, 'expira'>, ahora: number): boolean =>
  !!t.expira && Date.parse(t.expira) <= ahora;

/**
 * El vencimiento de una opción de expiración. Las relativas cuentan desde AHORA; la
 * personalizada vence al FINAL del día elegido (UTC) y tiene que caer entre mañana y un
 * año. Devuelve el ISO, `null` (sin vencimiento) o por qué no.
 */
export function vencimientoDe(opcion: unknown, fecha: unknown, ahora: number): { expira: string | null } | { error: string } {
  if (opcion === 'sin') return { expira: null };
  if (opcion === '7' || opcion === '30' || opcion === '60' || opcion === '90') {
    return { expira: new Date(ahora + Number(opcion) * 86_400_000).toISOString() };
  }
  if (opcion === 'personalizada') {
    const f = typeof fecha === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha.trim()) : null;
    if (!f) return { error: 'Elige una fecha.' };
    const fin = Date.UTC(Number(f[1]), Number(f[2]) - 1, Number(f[3]), 23, 59, 59);
    if (!Number.isFinite(fin) || fin <= ahora) return { error: 'La fecha tiene que ser futura.' };
    if (fin > ahora + MAX_DIAS_EXPIRACION * 86_400_000) return { error: 'Hasta un año.' };
    return { expira: new Date(fin).toISOString() };
  }
  return { error: 'Elige una expiración.' };
}

/** La lista guardada, tolerante: lo que no tiene forma de token se descarta (y se borra en
 *  la próxima escritura) en vez de tumbar la autenticación de todos. */
export function parsearLista(raw: string | null | undefined, areas: readonly string[]): TokenGuardado[] {
  if (!raw) return [];
  let j: unknown;
  try { j = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(j)) return [];
  const out: TokenGuardado[] = [];
  const ids = new Set<string>();
  for (const x of j) {
    if (!x || typeof x !== 'object') continue;
    const t = x as Record<string, unknown>;
    if (typeof t.id !== 'string' || !t.id || ids.has(t.id)) continue;
    if (typeof t.hash !== 'string' || !/^[0-9a-f]{64}$/.test(t.hash)) continue;
    if (typeof t.nombre !== 'string') continue;
    // Un token sin el campo `permisos` es de la primera versión (alcance global, 08/10 a
    // la mañana): no hay ninguno guardado, y si apareciera NO puede ganar acceso por un
    // default. Se descarta.
    if (!t.permisos || typeof t.permisos !== 'object') continue;
    ids.add(t.id);
    out.push({
      id: t.id, nombre: t.nombre, hash: t.hash,
      descripcion: typeof t.descripcion === 'string' ? t.descripcion : '',
      permisos: sanearPermisos(t.permisos, areas),
      pista: typeof t.pista === 'string' ? t.pista : '…',
      creado: typeof t.creado === 'string' ? t.creado : '',
      creadoPor: typeof t.creadoPor === 'string' ? t.creadoPor : '',
      expira: typeof t.expira === 'string' ? t.expira : null,
      ...(typeof t.regenerado === 'string' ? { regenerado: t.regenerado } : {}),
    });
  }
  return out;
}

/** El mapa id → último uso (ISO). Tolerante como la lista. */
export function parsearUsos(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const j = JSON.parse(raw);
    if (!j || typeof j !== 'object' || Array.isArray(j)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(j as Record<string, unknown>)) if (typeof v === 'string') out[k] = v;
    return out;
  } catch { return {}; }
}

/** El nombre de un token: recortado, con largo y sin repetir (sin mirar mayúsculas). Dos
 *  «n8n» en la lista son una adivinanza el día que hay que revocar. `salvo` = el id que se
 *  está editando, que no choca consigo mismo. */
export function validarNombre(nombre: unknown, lista: readonly TokenGuardado[], salvo?: string): { nombre: string } | { error: string } {
  const n = typeof nombre === 'string' ? nombre.trim().replace(/\s+/g, ' ') : '';
  if (!n) return { error: 'Ponle un nombre.' };
  if (n.length > MAX_NOMBRE) return { error: `Hasta ${MAX_NOMBRE} caracteres.` };
  if (lista.some((t) => t.id !== salvo && t.nombre.toLowerCase() === n.toLowerCase())) return { error: 'Ya hay uno con ese nombre.' };
  return { nombre: n };
}

/** La descripción: opcional, con tope. */
export function validarDescripcion(d: unknown): { descripcion: string } | { error: string } {
  const s = typeof d === 'string' ? d.trim() : '';
  if (s.length > MAX_DESCRIPCION) return { error: `Hasta ${MAX_DESCRIPCION} caracteres.` };
  return { descripcion: s };
}

/** Los permisos de un token nuevo o editado: al menos un área con acceso. */
export function validarPermisos(p: unknown, areas: readonly string[]): { permisos: Permisos } | { error: string } {
  const permisos = sanearPermisos(p, areas);
  if (!Object.keys(permisos).length) return { error: 'Dale acceso a al menos un área.' };
  return { permisos };
}

/** La lista con un token más, o por qué no entra. */
export function agregarALista(lista: readonly TokenGuardado[], nuevo: TokenGuardado): TokenGuardado[] | { error: string } {
  if (lista.length >= MAX_TOKENS) return { error: `Ya tienes ${MAX_TOKENS} tokens. Elimina uno antes.` };
  const v = validarNombre(nuevo.nombre, lista);
  if ('error' in v) return v;
  return [...lista, { ...nuevo, nombre: v.nombre }];
}

/** La lista con un token cambiado (nombre, descripción, permisos, hash), o por qué no. */
export function cambiarEnLista(
  lista: readonly TokenGuardado[], id: string,
  f: (t: TokenGuardado) => TokenGuardado | { error: string },
): TokenGuardado[] | { error: string } {
  const i = lista.findIndex((t) => t.id === id);
  if (i < 0) return { error: 'Ese token ya no existe.' };
  const nuevo = f(lista[i]);
  if ('error' in nuevo) return nuevo;
  return lista.map((t, j) => (j === i ? nuevo : t));
}

/** La lista sin ese id, o el error si no estaba (otra pestaña ya lo revocó). */
export function quitarDeLista(lista: readonly TokenGuardado[], id: string): TokenGuardado[] | { error: string } {
  if (!lista.some((t) => t.id === id)) return { error: 'Ese token ya no existe.' };
  return lista.filter((t) => t.id !== id);
}

/** Lo que baja a la pantalla, en el orden en que se crearon. */
export const aPublico = (lista: readonly TokenGuardado[], usos: Record<string, string>, ahora: number): TokenPublico[] =>
  lista.map(({ hash: _hash, ...t }) => ({ ...t, ultimoUso: usos[t.id] ?? null, vencido: vencido(t, ahora) }));
