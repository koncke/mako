// =============================================================================
// agente-token — token por workspace para que un AGENTE externo hable con MaKo
// =============================================================================
// Caso de uso: el dueño (o un cliente) tiene Claude Code en su compu y quiere que
// su agente le PROPONGA tareas al plan. El agente no tiene sesión de browser ni
// acceso a la base, así que se autentica con un bearer token por workspace.
//
// A diferencia del token de la landing, ESTE SÍ ES UN SECRETO: autoriza a LEER el
// plan del workspace y a dejar borradores. Por eso:
//   · se acuña SOLO a pedido (botón en /integraciones), nunca de oficio;
//   · es aleatorio (no derivable), no determinista como el de la landing;
//   · rotarlo INVALIDA el anterior (ver wsPorAgenteToken).
// Lo que NO habilita: escribir tareas directo. El único write es crear una
// PROPUESTA — un borrador que el humano revisa en /plan/revisar y que recién ahí
// puntúa el Perro. Un token filtrado no puede ensuciar el board sin que alguien
// apriete "aplicar".
//
// El mapeo token → workspace vive en webhook_routing('agente', <hash del token>, ws), el
// mismo índice de plataforma que ya usan Meta/Calendly/Fathom/landing.
//
// ⚠️ DESDE EL 09/10/2026 EL TOKEN NO SE GUARDA EN CLARO (decisión de Martín): en el setting
// va su hash y una pista, y en el índice su hash. Se muestra UNA vez, en la respuesta de
// `rotarAgenteToken`; ninguna función de acá lo devuelve después. Qué guarda cada lugar, la
// compatibilidad con las filas viejas y el porqué del orden, en lib/agente-token-nucleo.ts.
// =============================================================================

import 'server-only';
import { cambiarSettingSi, getSetting, getSettingEstricto, setSetting } from './settings';
import { runWithWorkspace } from './workspace';
import { borrarRoutingConPrefijo, upsertRouting, wsPorIdentificadorEstricto } from './webhook-routing';
import { conReintentoTransitorio } from './webhook-ruteo-huella';
import { mensajeDeError } from './calendly-error';
import { getSupabaseServer } from './supabase';
import { marcarUso } from './api-mako/tokens-uso';
import { ID_PRINCIPAL } from './api-mako/tokens-lista';
import { creadorVigente } from './api-mako/tokens-creador-vigente';
import {
  AGENTE_SERVICIO, AGENTE_TOKEN_KEY, PREFIJO_PRINCIPAL,
  acunarCon, leerGuardado, revocarCon, revocarSiCreadorSinAcceso, visibleDe, wsDeTokenCon,
  type AlmacenAgente, type TokenAgenteVisible,
} from './agente-token-nucleo';
import type { Alcance as AlcanceToken } from './api-mako/tipos';
export type { AlcanceToken, TokenAgenteVisible };
export { AGENTE_SERVICIO, AGENTE_TOKEN_KEY };

/**
 * La base de verdad para el núcleo. Las lecturas que AUTENTICAN son estrictas: con
 * `wsPorIdentificador` y `getSetting`, que no leen el `error` de supabase-js, la base caída
 * daba null y el pedido se contestaba 401 sobre un token BUENO (07/10/2026).
 */
const almacen: AlmacenAgente = {
  leerSetting: (ws) => runWithWorkspace(ws, () => getSettingEstricto(AGENTE_TOKEN_KEY)),
  escribirSetting: (ws, valor) => runWithWorkspace(ws, () => setSetting(AGENTE_TOKEN_KEY, valor)),
  wsPorIndice: (identificador) => wsPorIdentificadorEstricto(AGENTE_SERVICIO, identificador),
  indexar: (identificador, ws) => upsertRouting(AGENTE_SERVICIO, identificador, ws),
  // Sin el guion bajo: va a un LIKE, donde `_` es comodín (ver borrarRoutingConPrefijo).
  borrarIndicesEnClaro: (ws) => borrarRoutingConPrefijo(AGENTE_SERVICIO, ws, PREFIJO_PRINCIPAL.replace(/_$/, '')),
  // La MISMA regla y la misma caché de un minuto que los tokens detallados (14/10/2026): el
  // token deja de valer cuando quien lo acuñó ya no administra el workspace. Estricta: tira.
  creadorVigente: (ws, email, fresco) => creadorVigente(ws, email, fresco),
  cambiarSettingSi: (ws, antes, despues) => runWithWorkspace(ws, () => cambiarSettingSi(AGENTE_TOKEN_KEY, antes, despues)),
};

/**
 * Lo que se puede MOSTRAR del token del workspace —la pista y el alcance—, o null si nunca
 * acuñó uno (o lo revocó). Nunca el token: no está guardado. Lectura TOLERANTE: es para
 * dibujar (la tarjeta, el tutorial, la pantalla de API), no para decidir.
 */
export async function tokenAgenteVisible(ws: number): Promise<TokenAgenteVisible | null> {
  return visibleDe(leerGuardado(await runWithWorkspace(ws, () => getSetting(AGENTE_TOKEN_KEY))));
}

/**
 * Acuña un token nuevo para el workspace (o lo ROTA, si ya tenía) y lo devuelve UNA vez,
 * con su pista. El anterior deja de servir en el acto: `wsPorAgenteToken` valida contra el
 * setting, no contra el índice.
 *
 * `creadoPor`: el email de la sesión que lo pide. El token vale mientras esa persona siga
 * administrando el workspace (ver lib/agente-token-nucleo.ts, QUIÉN LO ACUÑÓ). Vacío = una
 * sesión sin email (desarrollo, emergencia): no hay a quién revisar, como en los detallados.
 */
export async function rotarAgenteToken(ws: number, alcance: AlcanceToken = 'proponer', creadoPor = ''): Promise<{ token: string; pista: string }> {
  return acunarCon(almacen, ws, alcance, undefined, creadoPor);
}

/**
 * Resuelve el workspace de un bearer token. null = no autorizado (fail-closed).
 *
 * Dos pasos a propósito (ver `wsDeTokenCon`): el índice es append-only, así que un token
 * ROTADO seguiría teniendo su fila ahí; la fuente de verdad de cuál está vigente es el
 * setting del workspace.
 */
export async function wsPorAgenteToken(token: string): Promise<number | null> {
  const t = (token ?? '').trim();
  if (!t) return null;
  // ⚠️ ESTRICTAS LAS DOS, Y CON REINTENTO (07/10/2026): «no pude leer» TIRA, y quien llama lo
  // contesta 503 (`wsDelBearer`). Rotar sigue revocando: el segundo chequeo es contra el setting.
  const ws = await conReintentoTransitorio(() => wsDeTokenCon(almacen, t));
  // «¿Este token se usa?», para la pantalla de API (lib/api-mako/tokens-uso.ts). Con
  // freno y sin esperar: no demora ni puede tumbar la autenticación.
  if (ws != null) marcarUso(ws, ID_PRINCIPAL);
  return ws;
}

/**
 * Revoca el token principal SIN acuñar otro (la pantalla de API, «me lo filtraron»).
 * Queda vacío, no borrado: un vacío no autentica nada, y la tarjeta de Integraciones
 * vuelve a «Genera tu token». Rotar sigue siendo `rotarAgenteToken`.
 */
export async function revocarAgenteToken(ws: number): Promise<void> {
  await revocarCon(almacen, ws);
}

/**
 * Después de sacarle el acceso a alguien: borra el token clásico de `ws` si su creador ya no lo
 * administra (`revocarSiCreadorSinAcceso`). Lo llama /api/admin/agencia al revocar una agencia
 * sobre ese cliente.
 *
 * BEST-EFFORT A PROPÓSITO: la decisión que se acaba de tomar (revocar, suspender) ya está
 * escrita y no se deshace porque esto falle. El token tampoco queda vivo si falla: lo corta el
 * chequeo por pedido (`wsDeTokenCon`) en menos de un minuto. Esto es la limpieza.
 */
export async function revocarAgenteTokenSiPerdioAcceso(ws: number): Promise<void> {
  try {
    await revocarSiCreadorSinAcceso(almacen, ws);
  } catch (e) {
    console.error(`[agente-token] no pude revisar el token del ws ${ws}: ${mensajeDeError(e)}`);
  }
}

/**
 * Lo mismo, para los tokens que acuñó UNA persona, estén en el workspace que estén: un admin de
 * agencia acuña desde la vista de cada cliente, así que su token vive en el workspace del
 * cliente y no en el suyo. Lo llaman los caminos que suspenden, eliminan o le bajan el rol a
 * alguien (/api/admin/usuarios y /api/equipo).
 *
 * Se buscan las filas del setting que nombran a esa persona (son pocas: una por workspace con
 * token) y a cada una se le aplica la misma revisión fresca. Best-effort, como la de arriba.
 */
export async function revocarAgenteTokensDe(email: string): Promise<void> {
  const e = (email ?? '').trim().toLowerCase();
  if (!e) return;
  try {
    const { data, error } = await getSupabaseServer()
      .from('app_settings').select('workspace_id, value').eq('key', AGENTE_TOKEN_KEY);
    if (error) throw new Error(error.message);
    for (const fila of (data ?? []) as Array<{ workspace_id: number; value: string | null }>) {
      const g = leerGuardado(fila.value);
      if (g?.forma !== 'hash' || g.creadoPor !== e) continue;
      // Uno que falla no frena a los demás.
      await revocarAgenteTokenSiPerdioAcceso(Number(fila.workspace_id));
    }
  } catch (err) {
    console.error(`[agente-token] no pude revisar los tokens de ${e}: ${mensajeDeError(err)}`);
  }
}

/**
 * `wsPorAgenteToken` para una ruta: el workspace, `null` (no autorizado → 401), o la respuesta
 * 503 lista para devolver cuando la base no dejó verificar el token. Que no se pudo verificar no
 * es que el token sea malo: decírselo así a un agente es mandarlo a rotar uno bueno.
 */
export async function wsDelBearer(token: string): Promise<number | null | Response> {
  try {
    return await wsPorAgenteToken(token);
  } catch (e) {
    console.error(`[agente-token] no pude verificar el token (la base no contestó): ${mensajeDeError(e)}`);
    return Response.json(
      { ok: false, error: 'No pude verificar el token: la base de datos no contestó. Reintenta en un momento.', reintentar: true },
      { status: 503 },
    );
  }
}

/** Lee el bearer de un request. Acepta `Authorization: Bearer <token>`. */
export function bearerDe(req: Request): string {
  const h = req.headers.get('authorization') ?? '';
  const m = /^bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : '';
}
