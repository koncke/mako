// =============================================================================
// agente-token-nucleo — el token CLÁSICO de la API de MaKo, sin guardarlo en claro
// =============================================================================
// Decisión de Martín (09/10/2026, «terminalo todo»): el token principal (`agente_token`,
// el de la skill de Claude) se guarda como ya se guardan los tokens con nombre de
// /api/v1 (lib/api-mako/tokens.ts): sólo su HASH (sha256) y una PISTA no secreta para
// reconocerlo (`mkoag_e_…a1b2`). El valor se muestra UNA vez, en la respuesta del POST
// que lo acuña, y nunca más sale de ningún lado.
//
// Qué guarda cada lugar:
//   · el setting `agente_token` del workspace: `{"hash":"<64 hex>","pista":"mkoag_e_…a1b2"}`.
//     Es la fuente de verdad de cuál está VIGENTE: revocar es vaciarlo, rotar es pisarlo.
//   · el índice `webhook_routing('agente', <hash>, ws)`: de un bearer al workspace. Es
//     append-only (el primer reclamante gana), así que un token rotado sigue teniendo su
//     fila ahí; lo que decide si vale es el setting — sin ese segundo chequeo, rotar no
//     revocaría nada.
//   · el ALCANCE no se guarda aparte: viaja en el prefijo del token (lib/api-mako/alcance.ts),
//     y por eso se lee del token presentado al verificar y de la pista para mostrar.
//
// COMPATIBILIDAD, y el orden de despliegue que la exige: el deploy sale ANTES de convertir
// las filas que ya existen (scripts/agente-token-a-hash.ts). Mientras tanto un setting en
// claro (el formato viejo: el token tal cual) sigue autenticando, buscando su fila de
// routing en claro. Al rotar o revocar, las filas en claro de ese workspace se borran.
//
// SIN `server-only`: puro, con test (tests/agente-token-hash.test.ts). Lo que toca la base
// entra por un `AlmacenAgente`; lib/agente-token.ts arma el de verdad. Un componente
// cliente sólo importa TIPOS de acá (node:crypto no existe en el navegador).
// =============================================================================

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { hashDeToken, pistaDe } from './api-mako/tokens-lista';
import { alcanceDePista, prefijoDeAlcance } from './api-mako/alcance';
import type { Alcance } from './api-mako/tipos';

/** Key en app_settings (por workspace). */
export const AGENTE_TOKEN_KEY = 'agente_token';

/** Servicio bajo el que se indexa el token en webhook_routing. */
export const AGENTE_SERVICIO = 'agente';

/** Todo token principal arranca así; un HASH (64 hex) no puede. Es lo que separa, en el
 *  índice, una fila del formato viejo (el token en claro) de una nueva. */
export const PREFIJO_PRINCIPAL = 'mkoag_';

/** Lo que dice el setting, ya leído. `claro` es el formato viejo (anterior al 09/10/2026). */
export type AgenteGuardado =
  | { forma: 'hash'; hash: string; pista: string }
  | { forma: 'claro'; token: string };

/** Lo que se puede mostrar de un token: nada secreto. */
export type TokenAgenteVisible = { pista: string; alcance: Alcance };

const HEX64 = /^[0-9a-f]{64}$/;

/**
 * El setting, leído con tolerancia y FAIL-CLOSED: vacío o con una forma que no se reconoce
 * es `null`, o sea «no hay token» — un valor raro no autentica nada.
 */
export function leerGuardado(raw: string | null | undefined): AgenteGuardado | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  if (s.startsWith('{')) {
    let j: unknown;
    try { j = JSON.parse(s); } catch { return null; }
    if (!j || typeof j !== 'object') return null;
    const o = j as Record<string, unknown>;
    if (typeof o.hash !== 'string' || !HEX64.test(o.hash)) return null;
    if (typeof o.pista !== 'string' || !o.pista.startsWith(PREFIJO_PRINCIPAL) || o.pista.length > 40) return null;
    return { forma: 'hash', hash: o.hash, pista: o.pista };
  }
  if (s.startsWith(PREFIJO_PRINCIPAL)) return { forma: 'claro', token: s };
  return null;
}

/** El valor del setting para un token nuevo: el hash y la pista, nunca el token. */
export function guardadoDeToken(token: string): string {
  return JSON.stringify({ hash: hashDeToken(token), pista: pistaDe(token) });
}

/**
 * ¿El token presentado es el vigente? Timing-safe en las dos formas: se comparan los
 * sha256 (32 bytes los dos), así que el largo del presentado no se filtra por el tiempo.
 */
export function coincide(g: AgenteGuardado | null, presentado: string): boolean {
  const t = (presentado ?? '').trim();
  if (!g || !t) return false;
  const vigente = g.forma === 'hash' ? g.hash : hashDeToken(g.token);
  return timingSafeEqual(Buffer.from(hashDeToken(t), 'hex'), Buffer.from(vigente, 'hex'));
}

/** Lo que la pantalla puede dibujar del token guardado. El formato viejo también: se le
 *  saca la pista al vuelo, y el texto plano no sale de esta función. */
export function visibleDe(g: AgenteGuardado | null): TokenAgenteVisible | null {
  if (!g) return null;
  const pista = g.forma === 'hash' ? g.pista : pistaDe(g.token);
  return { pista, alcance: alcanceDePista(pista) };
}

/** ¿Esta fila del índice es del formato viejo (el token en claro)? */
export const esIndiceEnClaro = (identificador: string): boolean => identificador.trim().startsWith(PREFIJO_PRINCIPAL);

/** Lo que el núcleo necesita de la base. Las lecturas son ESTRICTAS: «no pude leer» tira. */
export type AlmacenAgente = {
  /** El setting del workspace (estricto). */
  leerSetting(ws: number): Promise<string | null>;
  escribirSetting(ws: number, valor: string): Promise<void>;
  /** El workspace de una fila del índice (estricto), o null si no hay. */
  wsPorIndice(identificador: string): Promise<number | null>;
  /** Reclama una fila del índice. */
  indexar(identificador: string, ws: number): Promise<'ok' | 'ocupado' | 'error'>;
  /** Borra las filas en claro (formato viejo) de ese workspace. Best-effort. */
  borrarIndicesEnClaro(ws: number): Promise<void>;
};

/**
 * Acuña un token nuevo para el workspace (o lo ROTA). Devuelve el VALOR una sola vez.
 *
 * El índice se escribe ANTES que el setting (como en crearToken de lib/api-mako/tokens.ts):
 * si el setting falla, queda una fila huérfana que no autentica nada; al revés, quedaría un
 * token vigente que no resuelve a ningún workspace, entregado a una persona que lo va a
 * pegar en su máquina y recibir 401.
 *
 * Después del setting se borran las filas en claro de ese workspace: con el setting ya en
 * hash, ninguna de ellas puede autenticar, así que borrarlas no tiene carrera posible
 * (dos rotaciones a la vez no se pisan: las dos escriben hashes).
 */
export async function acunarCon(
  alm: AlmacenAgente,
  ws: number,
  alcance: Alcance,
  azar: () => string = () => randomBytes(24).toString('hex'),
): Promise<{ token: string; pista: string }> {
  // El alcance viaja en el PREFIJO (lib/api-mako/alcance.ts): rotar el token resetea el
  // alcance junto con él.
  const token = `${prefijoDeAlcance(alcance)}${azar()}`;
  const indice = await alm.indexar(hashDeToken(token), ws);
  if (indice !== 'ok') throw new Error('No se pudo guardar el token. Prueba de nuevo.');
  await alm.escribirSetting(ws, guardadoDeToken(token));
  await alm.borrarIndicesEnClaro(ws);
  return { token, pista: pistaDe(token) };
}

/**
 * Revoca sin acuñar otro: el setting queda vacío (no borrado), que no autentica nada, y la
 * tarjeta de Integraciones vuelve a «Genera tu token».
 */
export async function revocarCon(alm: AlmacenAgente, ws: number): Promise<void> {
  await alm.escribirSetting(ws, '');
  await alm.borrarIndicesEnClaro(ws);
}

/**
 * El workspace de un bearer, o null (no autorizado, fail-closed). Dos pasos a propósito:
 * el índice dice de quién PODRÍA ser, y el setting dice si es el vigente.
 *
 * Primero por HASH (lo nuevo). Si no hay fila, por el TOKEN EN CLARO: es el formato viejo,
 * que tiene que seguir andando mientras las filas existentes no se conviertan. Con el
 * setting ya en hash, esa fila en claro no autentica (el hash no coincide), así que un
 * token rotado no vuelve por esta puerta.
 */
export async function wsDeTokenCon(alm: AlmacenAgente, token: string): Promise<number | null> {
  const t = (token ?? '').trim();
  if (!t) return null;
  // La búsqueda en claro sólo para lo que tiene forma de token: un bearer que sea un HASH
  // copiado del índice encontraría su fila por acá (y después no coincidiría, porque el hash
  // de un hash es otro), pero no tiene sentido ni gastar la consulta.
  const ws = (await alm.wsPorIndice(hashDeToken(t))) ?? (esIndiceEnClaro(t) ? await alm.wsPorIndice(t) : null);
  if (ws == null) return null;
  return coincide(leerGuardado(await alm.leerSetting(ws)), t) ? ws : null;
}
