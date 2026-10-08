// =============================================================================
// api-mako/tokens — los tokens detallados: crear, editar, regenerar, revocar, listar y resolver
// =============================================================================
// El porqué de la forma (lista en un setting, hash en vez del valor, índice por hash,
// permisos por área, expiración, y que valgan SOLO para /api/v1) está arriba de
// tokens-lista.ts y de permisos.ts.
//
// `resolverTokenApi` es el resolvedor de /api/v1 (lib/api-mako/http.ts): prueba primero los
// tokens detallados y, si no es uno de ésos, el principal de siempre (`wsPorAgenteToken`),
// que es el «clásico». /api/agente/* NO lo usa y no tiene que usarlo: ver tokens-lista.ts —
// y tests/api-mako-tokens.test.ts lo fija.
//
// «No pude leer» TIRA, igual que `wsPorAgenteToken` (07/10/2026): quien autentica lo
// contesta 503. Si se tragara el error, un corte de la base respondería «token inválido»
// sobre uno bueno y mandaría a la persona a rotarlo.
// =============================================================================

import 'server-only';
import { randomBytes } from 'node:crypto';
import { cambiarSettingSi, getSetting, getSettingEstricto } from '@/lib/settings';
import { runWithWorkspace } from '@/lib/workspace';
import { upsertRouting, wsPorIdentificadorEstricto } from '@/lib/webhook-routing';
import { conReintentoTransitorio } from '@/lib/webhook-ruteo-huella';
import { getAgenteToken, revocarAgenteToken, wsPorAgenteToken } from '@/lib/agente-token';
import { alcanceDeToken } from './alcance';
import { AREAS } from './tipos';
import type { Permisos } from './permisos';
import { marcarUso, olvidarUso } from './tokens-uso';
import {
  API_TOKENS_KEY, API_TOKENS_USO_KEY, ID_PRINCIPAL, PREFIJO_DETALLADO, SERVICIO_API,
  agregarALista, aPublico, cambiarEnLista, hashDeToken, parsearLista, parsearUsos, pistaDe, quitarDeLista,
  validarDescripcion, validarNombre, validarPermisos, vencido, vencimientoDe,
  type TokenGuardado, type TokenPrincipal, type TokenPublico,
} from './tokens-lista';

const leerLista = (raw: string | null) => parsearLista(raw, AREAS);

/** Lo que /api/v1 necesita saber de un bearer. */
export type TokenResuelto =
  | { ws: number; clase: 'detallado'; id: string; nombre: string; permisos: Permisos; expira: string | null; vencido: boolean }
  | { ws: number; clase: 'clasico' };

/**
 * El token de un bearer para /api/v1: un detallado (con sus permisos y si venció) o el
 * principal (clásico). `null` = no es de nadie o fue revocado. Uno VENCIDO vuelve con
 * `vencido: true` —no como null—, para que el 401 diga «venció el …» en vez de «inválido».
 */
export async function resolverTokenApi(token: string): Promise<TokenResuelto | null> {
  const t = (token ?? '').trim();
  if (!t) return null;
  if (t.startsWith(PREFIJO_DETALLADO)) {
    const hash = hashDeToken(t);
    const r = await conReintentoTransitorio(async () => {
      const ws = await wsPorIdentificadorEstricto(SERVICIO_API, hash);
      if (ws == null) return null;
      // El índice es append-only: un token revocado o regenerado sigue teniendo su fila ahí.
      // Lo que decide si vale es la LISTA del workspace, igual que el setting en el principal.
      const lista = leerLista(await runWithWorkspace(ws, () => getSettingEstricto(API_TOKENS_KEY)));
      const g = lista.find((x) => x.hash === hash);
      return g ? { ws, g } : null;
    });
    if (!r) return null;
    const venc = vencido(r.g, Date.now());
    if (!venc) marcarUso(r.ws, r.g.id);
    return { ws: r.ws, clase: 'detallado', id: r.g.id, nombre: r.g.nombre, permisos: r.g.permisos, expira: r.g.expira, vencido: venc };
  }
  // El principal anota su propio uso adentro de wsPorAgenteToken (lo usa también /api/agente).
  const ws = await wsPorAgenteToken(t);
  return ws == null ? null : { ws, clase: 'clasico' };
}

/** El workspace de un bearer válido y vigente (para quien sólo necesita eso). */
export async function wsPorTokenApi(token: string): Promise<number | null> {
  const r = await resolverTokenApi(token);
  return r && !(r.clase === 'detallado' && r.vencido) ? r.ws : null;
}

export type TokensDelWorkspace = { principal: TokenPrincipal | null; tokens: TokenPublico[] };

/** Lo que la pantalla muestra: el principal (si hay) y los detallados, sin secretos. */
export async function listarTokens(ws: number): Promise<TokensDelWorkspace> {
  return runWithWorkspace(ws, async () => {
    const [raw, rawUsos, principal] = await Promise.all([
      getSettingEstricto(API_TOKENS_KEY),
      getSetting(API_TOKENS_USO_KEY),
      getAgenteToken(ws),
    ]);
    const usos = parsearUsos(rawUsos);
    return {
      principal: principal ? { alcance: alcanceDeToken(principal), pista: pistaDe(principal), ultimoUso: usos[ID_PRINCIPAL] ?? null } : null,
      tokens: aPublico(leerLista(raw), usos, Date.now()),
    };
  });
}

/**
 * Cambia la lista con compare-and-set: dos pestañas creando o revocando a la vez no se
 * pisan (la segunda relee y reintenta). `f` devuelve la lista nueva o un error.
 */
async function cambiarLista(ws: number, f: (lista: TokenGuardado[]) => TokenGuardado[] | { error: string }): Promise<{ ok: true } | { error: string }> {
  for (let i = 0; i < 4; i++) {
    const raw = await runWithWorkspace(ws, () => getSettingEstricto(API_TOKENS_KEY));
    const nueva = f(leerLista(raw));
    if ('error' in nueva) return nueva;
    const gano = await runWithWorkspace(ws, () => cambiarSettingSi(API_TOKENS_KEY, raw, JSON.stringify(nueva)));
    if (gano) return { ok: true };
  }
  return { error: 'Otro cambio se cruzó. Prueba de nuevo.' };
}

const acunar = (): { token: string; hash: string; pista: string } => {
  const token = `${PREFIJO_DETALLADO}${randomBytes(30).toString('hex')}`;
  return { token, hash: hashDeToken(token), pista: pistaDe(token) };
};

const publico = (g: TokenGuardado): TokenPublico => {
  const { hash: _hash, ...resto } = g;
  return { ...resto, ultimoUso: null, vencido: vencido(g, Date.now()) };
};

export type DatosToken = { nombre: unknown; descripcion: unknown; permisos: unknown; expiracion: unknown; fecha?: unknown };

/**
 * Acuña un token detallado. Devuelve el VALOR una sola vez: después sólo existe su hash.
 * El índice se escribe ANTES que la lista: si la lista falla queda una fila huérfana en el
 * índice que no autentica nada (la lista manda); al revés, quedaría un token listado que no
 * resuelve a ningún workspace.
 */
export async function crearToken(ws: number, x: DatosToken & { actor: string }): Promise<{ token: string; publico: TokenPublico } | { error: string }> {
  const d = validarDescripcion(x.descripcion);
  if ('error' in d) return d;
  const p = validarPermisos(x.permisos, AREAS);
  if ('error' in p) return p;
  const v = vencimientoDe(x.expiracion, x.fecha, Date.now());
  if ('error' in v) return v;
  const { token, hash, pista } = acunar();
  const nuevo: TokenGuardado = {
    id: `t_${randomBytes(5).toString('hex')}`,
    nombre: typeof x.nombre === 'string' ? x.nombre : '',
    descripcion: d.descripcion, permisos: p.permisos, hash, pista,
    creado: new Date().toISOString(), creadoPor: x.actor, expira: v.expira,
  };
  // Se valida el nombre ANTES de tocar el índice: un nombre repetido no deja filas.
  const previa = agregarALista(leerLista(await runWithWorkspace(ws, () => getSettingEstricto(API_TOKENS_KEY))), nuevo);
  if ('error' in previa) return previa;
  nuevo.nombre = previa[previa.length - 1].nombre;

  const ruteo = await upsertRouting(SERVICIO_API, hash, ws);
  if (ruteo !== 'ok') return { error: 'No se pudo guardar el token. Prueba de nuevo.' };

  const r = await cambiarLista(ws, (lista) => agregarALista(lista, nuevo));
  if ('error' in r) return r;
  return { token, publico: publico(nuevo) };
}

/** Edita nombre, descripción y permisos. La expiración no se edita: se regenera (como en GitHub). */
export async function editarToken(ws: number, id: string, x: Omit<DatosToken, 'expiracion' | 'fecha'>): Promise<{ publico: TokenPublico } | { error: string }> {
  const d = validarDescripcion(x.descripcion);
  if ('error' in d) return d;
  const p = validarPermisos(x.permisos, AREAS);
  if ('error' in p) return p;
  // Un objeto y no un `let`: TS no sigue la asignación adentro del callback.
  const out: { t?: TokenGuardado } = {};
  const r = await cambiarLista(ws, (lista) => cambiarEnLista(lista, id, (t) => {
    const n = validarNombre(x.nombre, lista, id);
    if ('error' in n) return n;
    out.t = { ...t, nombre: n.nombre, descripcion: d.descripcion, permisos: p.permisos };
    return out.t;
  }));
  if ('error' in r) return r;
  return { publico: publico(out.t!) };
}

/**
 * Regenera: un VALOR nuevo con los mismos permisos y una expiración nueva. El valor viejo
 * deja de servir en el acto (la lista ya no tiene su hash), como el «Regenerate token» de
 * GitHub. El índice del hash nuevo se escribe ANTES, por la misma razón que al crear.
 */
export async function regenerarToken(ws: number, id: string, x: { expiracion: unknown; fecha?: unknown }): Promise<{ token: string; publico: TokenPublico } | { error: string }> {
  const v = vencimientoDe(x.expiracion, x.fecha, Date.now());
  if ('error' in v) return v;
  const actual = leerLista(await runWithWorkspace(ws, () => getSettingEstricto(API_TOKENS_KEY))).find((t) => t.id === id);
  if (!actual) return { error: 'Ese token ya no existe.' };
  const { token, hash, pista } = acunar();
  const ruteo = await upsertRouting(SERVICIO_API, hash, ws);
  if (ruteo !== 'ok') return { error: 'No se pudo regenerar el token. Prueba de nuevo.' };
  const out: { t?: TokenGuardado } = {};
  const r = await cambiarLista(ws, (lista) => cambiarEnLista(lista, id, (t) => {
    out.t = { ...t, hash, pista, expira: v.expira, regenerado: new Date().toISOString() };
    return out.t;
  }));
  if ('error' in r) return r;
  return { token, publico: publico(out.t!) };
}

/** Revoca un token detallado, o el principal (`id === 'principal'`). En el acto. */
export async function revocarToken(ws: number, id: string): Promise<{ ok: true } | { error: string }> {
  if (id === ID_PRINCIPAL) {
    await revocarAgenteToken(ws);
    await olvidarUso(ws, ID_PRINCIPAL);
    return { ok: true };
  }
  const r = await cambiarLista(ws, (lista) => quitarDeLista(lista, id));
  if ('ok' in r) await olvidarUso(ws, id);
  return r;
}
