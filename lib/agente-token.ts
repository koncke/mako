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
import { getSetting, setSetting } from './settings';
import { runWithWorkspace } from './workspace';
import { upsertRouting, wsPorIdentificador } from './webhook-routing';

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
export async function rotarAgenteToken(ws: number): Promise<string> {
  const token = `mkoag_${randomBytes(24).toString('hex')}`;
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
  const ws = await wsPorIdentificador(AGENTE_SERVICIO, t);
  if (ws == null) return null;
  const vigente = await getAgenteToken(ws);
  return vigente && vigente === t ? ws : null;
}

/** Lee el bearer de un request. Acepta `Authorization: Bearer <token>`. */
export function bearerDe(req: Request): string {
  const h = req.headers.get('authorization') ?? '';
  const m = /^bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : '';
}
