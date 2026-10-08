// =============================================================================
// api-mako/tokens-lista — los tokens CON NOMBRE de un workspace, la parte pura
// =============================================================================
// Hasta el 08/10/2026 un workspace tenía UN token (`agente_token`, el de la skill de
// Claude) y rotarlo reemplazaba el anterior: darle a un n8n un token de solo lectura
// le apagaba las propuestas a la skill, y al revés. Martín decidió (08/10) «varios,
// con nombre»: cada integración el suyo, con su alcance, y se revoca uno sin tocar los
// otros.
//
// Cómo se guardan, y por qué así:
//   · la LISTA vive en el setting `api_tokens` del workspace (JSON). Es la fuente de
//     verdad de qué token está vigente: revocar es sacarlo de ahí.
//   · del token se guarda el HASH (sha256), nunca el valor: se muestra UNA vez al
//     crearlo. El principal (`agente_token`) sigue en claro porque la skill lo vuelve
//     a pedir y el tutorial de Integraciones lo muestra; ése no se toca.
//   · el índice token → workspace es `webhook_routing('api_token', <hash>, ws)`, el
//     mismo índice de plataforma que usa el principal, pero por el hash.
//
// ⚠️ Un token con nombre vale SOLO para /api/v1. `/api/agente/*` resuelve con
// `wsPorAgenteToken`, que mira únicamente el principal, y es a propósito: la ruta de
// la skill (`/api/agente/skill`) le devuelve al que pide el token PRINCIPAL metido en
// el archivo, así que un token «Solo leer» que pasara por ahí se llevaba el de la
// skill. Y el reporte del plugin (`/hook`, `/telemetria`) tiene su consentimiento
// atado a ese token: un token con nombre no puede abrir esa puerta sin el trato.
//
// SIN `server-only`: puro, con test (tests/api-mako-tokens.test.ts). Un componente
// cliente sólo puede importar TIPOS de acá (node:crypto no existe en el navegador, y
// el test del registro lo vigila).
// =============================================================================

import { createHash } from 'node:crypto';
import { ALCANCES, type Alcance } from './tipos';

/** El setting (por workspace) con la lista de tokens con nombre. */
export const API_TOKENS_KEY = 'api_tokens';
/** El setting con el último uso de cada token, por id. Aparte de la lista a
 *  propósito: se escribe en cada pedido (con freno) y una escritura de uso que
 *  corriera contra la lista podía revivir un token recién revocado. */
export const API_TOKENS_USO_KEY = 'api_tokens_uso';
/** El servicio de `webhook_routing` donde se indexa el hash. NO es `agente`: ese
 *  índice resuelve el principal, y un hash ahí no le serviría a nadie. */
export const SERVICIO_API = 'api_token';
/** El id con el que se anota el uso del token principal (el de la skill). */
export const ID_PRINCIPAL = 'principal';
/** Más de diez es otra cosa (tokens por persona, por cliente de una agencia): se
 *  decide, no se acumula. */
export const MAX_TOKENS = 10;
export const MAX_NOMBRE = 40;

export type TokenGuardado = {
  id: string;
  nombre: string;
  alcance: Alcance;
  /** sha256 hex del token. El valor no se guarda en ningún lado. */
  hash: string;
  /** cómo se lo reconoce sin mostrarlo: `mkoag_l_…9f3a` */
  pista: string;
  creado: string;
  creadoPor: string;
};

/** Lo que baja a la pantalla: sin el hash. */
export type TokenPublico = Omit<TokenGuardado, 'hash'> & { ultimoUso: string | null };

/** El principal (la skill de Claude), tal como lo ve la pantalla. */
export type TokenPrincipal = { alcance: Alcance; pista: string; ultimoUso: string | null };

export const hashDeToken = (token: string): string => createHash('sha256').update((token ?? '').trim()).digest('hex');

/** `mkoag_l_…9f3a`: el prefijo dice el alcance y los cuatro últimos lo distinguen. */
export function pistaDe(token: string): string {
  const t = (token ?? '').trim();
  const m = /^(mkoag_(?:[lpe]_)?)/i.exec(t);
  return `${m ? m[1] : ''}…${t.slice(-4)}`;
}

const esAlcance = (s: unknown): s is Alcance => typeof s === 'string' && (ALCANCES as readonly string[]).includes(s);

/** La lista guardada, tolerante: lo que no tiene forma de token se descarta (y se
 *  borra en la próxima escritura) en vez de tumbar la autenticación de todos. */
export function parsearLista(raw: string | null | undefined): TokenGuardado[] {
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
    if (!esAlcance(t.alcance) || typeof t.nombre !== 'string') continue;
    ids.add(t.id);
    out.push({
      id: t.id, nombre: t.nombre, alcance: t.alcance, hash: t.hash,
      pista: typeof t.pista === 'string' ? t.pista : '…',
      creado: typeof t.creado === 'string' ? t.creado : '',
      creadoPor: typeof t.creadoPor === 'string' ? t.creadoPor : '',
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

/** El nombre de un token nuevo: recortado, con largo y sin repetir (sin mirar
 *  mayúsculas). Dos «n8n» en la lista son una adivinanza el día que hay que revocar. */
export function validarNombre(nombre: unknown, lista: readonly TokenGuardado[]): { nombre: string } | { error: string } {
  const n = typeof nombre === 'string' ? nombre.trim().replace(/\s+/g, ' ') : '';
  if (!n) return { error: 'Ponle un nombre.' };
  if (n.length > MAX_NOMBRE) return { error: `Hasta ${MAX_NOMBRE} caracteres.` };
  if (lista.some((t) => t.nombre.toLowerCase() === n.toLowerCase())) return { error: 'Ya hay uno con ese nombre.' };
  return { nombre: n };
}

/** La lista con un token más, o por qué no entra. */
export function agregarALista(lista: readonly TokenGuardado[], nuevo: TokenGuardado): TokenGuardado[] | { error: string } {
  if (lista.length >= MAX_TOKENS) return { error: `Ya tienes ${MAX_TOKENS} tokens. Revoca uno antes.` };
  const v = validarNombre(nuevo.nombre, lista);
  if ('error' in v) return v;
  return [...lista, { ...nuevo, nombre: v.nombre }];
}

/** La lista sin ese id, o el error si no estaba (otra pestaña ya lo revocó). */
export function quitarDeLista(lista: readonly TokenGuardado[], id: string): TokenGuardado[] | { error: string } {
  if (!lista.some((t) => t.id === id)) return { error: 'Ese token ya no existe.' };
  return lista.filter((t) => t.id !== id);
}

/** Lo que baja a la pantalla, en el orden en que se crearon. */
export const aPublico = (lista: readonly TokenGuardado[], usos: Record<string, string>): TokenPublico[] =>
  lista.map(({ hash: _hash, ...t }) => ({ ...t, ultimoUso: usos[t.id] ?? null }));
