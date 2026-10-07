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
// El mapeo token → workspace vive en webhook_routing('agente', token, ws), el
// mismo índice de plataforma que ya usan Meta/Chatwoot/Calendly/Fathom/landing.
// =============================================================================

import 'server-only';
import { randomBytes } from 'node:crypto';
import { getSetting, getSettingEstricto, setSetting } from './settings';
import { runWithWorkspace } from './workspace';
import { upsertRouting, wsPorIdentificadorEstricto } from './webhook-routing';
import { conReintentoTransitorio } from './webhook-ruteo-huella';
import { mensajeDeError } from './calendly-error';
import { prefijoDeAlcance } from './api-mako/alcance';
import type { Alcance as AlcanceToken } from './api-mako/tipos';
export type { AlcanceToken };

/** Key en app_settings (por workspace). */
export const AGENTE_TOKEN_KEY = 'agente_token';

/** Servicio bajo el que se indexa el token en webhook_routing. */
export const AGENTE_SERVICIO = 'agente';

/** Token vigente del workspace, o null si nunca acuñó uno. */
export async function getAgenteToken(ws: number): Promise<string | null> {
  return runWithWorkspace(ws, () => getSetting(AGENTE_TOKEN_KEY));
}

/**
 * Acuña un token nuevo para el workspace (o lo ROTA, si ya tenía).
 * El anterior deja de servir en el acto: `wsPorAgenteToken` valida contra el
 * setting, no contra el índice.
 */
export async function rotarAgenteToken(ws: number, alcance: AlcanceToken = 'proponer'): Promise<string> {
  // El alcance viaja en el PREFIJO (lib/api-mako/alcance.ts): rotar el token resetea
  // el alcance junto con él. Los tokens sin letra —los de antes— son `proponer`.
  const token = `${prefijoDeAlcance(alcance)}${randomBytes(24).toString('hex')}`;
  await runWithWorkspace(ws, () => setSetting(AGENTE_TOKEN_KEY, token));
  await upsertRouting(AGENTE_SERVICIO, token, ws);
  return token;
}

/**
 * Resuelve el workspace de un bearer token. null = no autorizado (fail-closed).
 *
 * Dos pasos a propósito: el índice de routing es append-only (`upsertRouting`
 * usa ignoreDuplicates para que la carrera la decida la base), así que un token
 * ROTADO seguiría teniendo su fila ahí. La fuente de verdad de cuál está vigente
 * es el setting del workspace — sin este segundo chequeo, rotar no revocaría nada.
 */
export async function wsPorAgenteToken(token: string): Promise<number | null> {
  const t = (token ?? '').trim();
  if (!t) return null;
  // ⚠️ ESTRICTAS LAS DOS, Y CON REINTENTO (07/10/2026). Con `wsPorIdentificador` y `getSetting`,
  // que no leen el `error` de supabase-js, la base caída daba null y el pedido se contestaba 401
  // «token inválido o revocado» sobre un token BUENO — lo que manda a la persona a rotarlo y a
  // reconfigurar su skill por un corte de segundos. Ahora «no pude leer» TIRA, y quien llama lo
  // contesta 503 (`wsDelBearer`). Rotar sigue revocando: el segundo chequeo es contra el setting.
  return conReintentoTransitorio(async () => {
    const ws = await wsPorIdentificadorEstricto(AGENTE_SERVICIO, t);
    if (ws == null) return null;
    const vigente = await runWithWorkspace(ws, () => getSettingEstricto(AGENTE_TOKEN_KEY));
    return vigente && vigente === t ? ws : null;
  });
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
