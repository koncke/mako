// =============================================================================
// api-mako/tokens — los tokens con nombre: crear, revocar, listar y resolver
// =============================================================================
// El porqué de la forma (lista en un setting, hash en vez del valor, índice por
// hash, y que valgan SOLO para /api/v1) está arriba de tokens-lista.ts.
//
// `wsPorTokenApi` es el resolvedor de /api/v1 (lib/api-mako/http.ts): prueba primero
// los tokens con nombre y, si no es uno de ésos, el principal de siempre
// (`wsPorAgenteToken`). /api/agente/* NO lo usa y no tiene que usarlo: ver la
// advertencia de tokens-lista.ts — y tests/api-mako-tokens.test.ts lo fija.
//
// «No pude leer» TIRA, igual que `wsPorAgenteToken` (07/10/2026): quien autentica lo
// contesta 503. Si se tragara el error, un corte de la base respondería «token
// inválido» sobre uno bueno y mandaría a la persona a rotarlo.
// =============================================================================

import 'server-only';
import { randomBytes } from 'node:crypto';
import { cambiarSettingSi, getSetting, getSettingEstricto } from '@/lib/settings';
import { runWithWorkspace } from '@/lib/workspace';
import { upsertRouting, wsPorIdentificadorEstricto } from '@/lib/webhook-routing';
import { conReintentoTransitorio } from '@/lib/webhook-ruteo-huella';
import { getAgenteToken, revocarAgenteToken, wsPorAgenteToken } from '@/lib/agente-token';
import { alcanceDeToken, esAlcance, prefijoDeAlcance } from './alcance';
import { marcarUso, olvidarUso } from './tokens-uso';
import {
  API_TOKENS_KEY, API_TOKENS_USO_KEY, ID_PRINCIPAL, SERVICIO_API,
  agregarALista, aPublico, hashDeToken, parsearLista, parsearUsos, pistaDe, quitarDeLista,
  type TokenGuardado, type TokenPrincipal, type TokenPublico,
} from './tokens-lista';
import type { Alcance } from './tipos';

/** El workspace de un bearer para /api/v1: un token con nombre o el principal. */
export async function wsPorTokenApi(token: string): Promise<number | null> {
  const t = (token ?? '').trim();
  if (!t) return null;
  const hash = hashDeToken(t);
  const conNombre = await conReintentoTransitorio(async () => {
    const ws = await wsPorIdentificadorEstricto(SERVICIO_API, hash);
    if (ws == null) return null;
    // El índice es append-only: un token revocado sigue teniendo su fila ahí. Lo que
    // decide si vale es la LISTA del workspace, igual que el setting en el principal.
    const lista = parsearLista(await runWithWorkspace(ws, () => getSettingEstricto(API_TOKENS_KEY)));
    const vigente = lista.find((x) => x.hash === hash);
    return vigente ? { ws, id: vigente.id } : null;
  });
  if (conNombre) {
    marcarUso(conNombre.ws, conNombre.id);
    return conNombre.ws;
  }
  // El principal anota su propio uso adentro de wsPorAgenteToken (lo usa también /api/agente).
  return wsPorAgenteToken(t);
}

export type TokensDelWorkspace = { principal: TokenPrincipal | null; tokens: TokenPublico[] };

/** Lo que la pantalla muestra: el principal (si hay) y los con nombre, sin secretos. */
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
      tokens: aPublico(parsearLista(raw), usos),
    };
  });
}

/**
 * Cambia la lista con compare-and-set: dos pestañas creando o revocando a la vez no
 * se pisan (la segunda relee y reintenta). `f` devuelve la lista nueva o un error.
 */
async function cambiarLista(ws: number, f: (lista: TokenGuardado[]) => TokenGuardado[] | { error: string }): Promise<{ ok: true } | { error: string }> {
  for (let i = 0; i < 4; i++) {
    const raw = await runWithWorkspace(ws, () => getSettingEstricto(API_TOKENS_KEY));
    const nueva = f(parsearLista(raw));
    if ('error' in nueva) return nueva;
    const gano = await runWithWorkspace(ws, () => cambiarSettingSi(API_TOKENS_KEY, raw, JSON.stringify(nueva)));
    if (gano) return { ok: true };
  }
  return { error: 'Otro cambio se cruzó. Prueba de nuevo.' };
}

/**
 * Acuña un token con nombre. Devuelve el VALOR una sola vez: después sólo existe su
 * hash. El índice se escribe ANTES que la lista: si la lista falla queda una fila
 * huérfana en el índice que no autentica nada (la lista manda); al revés, quedaría
 * un token listado que no resuelve a ningún workspace.
 */
export async function crearToken(
  ws: number,
  x: { nombre: unknown; alcance: unknown; actor: string },
): Promise<{ token: string; publico: TokenPublico } | { error: string }> {
  if (!esAlcance(x.alcance)) return { error: 'Elige qué puede hacer.' };
  const alcance: Alcance = x.alcance;
  const token = `${prefijoDeAlcance(alcance)}${randomBytes(24).toString('hex')}`;
  const hash = hashDeToken(token);
  const nuevo: TokenGuardado = {
    id: `t_${randomBytes(5).toString('hex')}`,
    nombre: typeof x.nombre === 'string' ? x.nombre : '',
    alcance, hash, pista: pistaDe(token),
    creado: new Date().toISOString(),
    creadoPor: x.actor,
  };
  // Se valida el nombre ANTES de tocar el índice: un nombre repetido no deja filas.
  const previa = agregarALista(parsearLista(await runWithWorkspace(ws, () => getSettingEstricto(API_TOKENS_KEY))), nuevo);
  if ('error' in previa) return previa;
  nuevo.nombre = previa[previa.length - 1].nombre;

  const ruteo = await upsertRouting(SERVICIO_API, hash, ws);
  if (ruteo !== 'ok') return { error: 'No se pudo guardar el token. Prueba de nuevo.' };

  const r = await cambiarLista(ws, (lista) => agregarALista(lista, nuevo));
  if ('error' in r) return r;
  const { hash: _hash, ...resto } = nuevo;
  return { token, publico: { ...resto, ultimoUso: null } };
}

/** Revoca un token con nombre, o el principal (`id === 'principal'`). En el acto. */
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
