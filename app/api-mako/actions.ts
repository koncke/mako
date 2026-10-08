'use server';

// =============================================================================
// /api-mako — las acciones de la pantalla de API
// =============================================================================
// Una server action es un endpoint público: cada una vuelve a mirar sesión, rol,
// capa y workspace, aunque la página ya los haya mirado. Es la misma puerta que
// `/api/agente/token`: sólo el ADMIN del workspace (o el super admin mirándolo)
// acuña o revoca credenciales.
//
// Lo que NO hace esta pantalla, a propósito:
//   · no muestra un token después de crearlo (sólo se guarda su hash);
//   · no «prueba» acciones ni lecturas que gastan IA (ver `sePuedeProbar`);
//   · no acuña el token PRINCIPAL de la skill: ése tiene su trato de consentimiento
//     y vive en Integraciones → Claude. Acá sólo se lo puede revocar.
// =============================================================================

import { getUsuarioActual } from '@/lib/auth';
import { getCapaActual, getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { rateLimit } from '@/lib/rate-limit';
import { APP_BASE_URL } from '@/lib/app-url';
import { crearToken, listarTokens, revocarToken, type TokensDelWorkspace } from '@/lib/api-mako/tokens';
import { ejecutarOperacion } from '@/lib/api-mako/ejecutar';
import { canalKeyDe } from '@/lib/api-mako/canal';
import { porId } from '@/lib/api-mako/registro';
import { referenciaMarkdown } from '@/lib/api-mako/docs';
import type { TokenPublico } from '@/lib/api-mako/tokens-lista';
import { detalleDe, sePuedeProbar, usoDe, vistaDeLaTab, type DetalleOp, type Prueba, type UsoApi } from './datos';

type Puerta = { ws: number; email: string } | { error: string };

async function puerta(): Promise<Puerta> {
  const [sesion, rol] = await Promise.all([getUsuarioActual(), getRolWsEfectivo()]);
  if (!sesion || rol == null) return { error: 'Tu sesión venció. Vuelve a entrar.' };
  if (rol !== 'admin') return { error: 'Solo el administrador.' };
  if (!tabEnCapa('api-mako', await getCapaActual())) return { error: 'Tu plan no incluye la API.' };
  const ws = await getWorkspaceActual();
  if (ws == null) return { error: 'Entra a un cliente primero.' };
  return { ws, email: sesion.email ?? '' };
}

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export async function detalleOperacion(id: string): Promise<{ detalle: DetalleOp } | { error: string }> {
  const p = await puerta();
  if ('error' in p) return p;
  const detalle = detalleDe(String(id ?? ''), await vistaDeLaTab(p.ws), APP_BASE_URL);
  return detalle ? { detalle } : { error: 'Esa operación no existe para tu cuenta.' };
}

export async function tokensApi(): Promise<TokensDelWorkspace | { error: string }> {
  const p = await puerta();
  if ('error' in p) return p;
  try { return await listarTokens(p.ws); }
  catch (e) { console.error(`[api-mako] listar tokens: ${msg(e)}`); return { error: 'No se pudieron leer los tokens.' }; }
}

export async function crearTokenApi(x: { nombre: string; alcance: string }): Promise<{ token: string; publico: TokenPublico } | { error: string }> {
  const p = await puerta();
  if ('error' in p) return p;
  if (!rateLimit(`api-mako:token:${p.ws}`, 10, 60_000)) return { error: 'Demasiados intentos. Espera un minuto.' };
  try { return await crearToken(p.ws, { nombre: x?.nombre, alcance: x?.alcance, actor: p.email }); }
  catch (e) { console.error(`[api-mako] crear token (ws ${p.ws}): ${msg(e)}`); return { error: 'No se pudo crear. Prueba de nuevo.' }; }
}

export async function revocarTokenApi(id: string): Promise<{ ok: true } | { error: string }> {
  const p = await puerta();
  if ('error' in p) return p;
  try { return await revocarToken(p.ws, String(id ?? '')); }
  catch (e) { console.error(`[api-mako] revocar token (ws ${p.ws}): ${msg(e)}`); return { error: 'No se pudo revocar. Prueba de nuevo.' }; }
}

export async function usoApi(): Promise<UsoApi | { error: string }> {
  const p = await puerta();
  if ('error' in p) return p;
  return usoDe(p.ws);
}

const TOPE_PRUEBA = 30_000;

/**
 * Corre una LECTURA como la correría un token de alcance `lectura` por HTTP: mismo
 * canal, mismo gating, misma validación. Lo único distinto es que no deja fila en
 * `api_llamadas` — esa bitácora contesta «¿qué pidió un TOKEN?», y esto no es uno.
 */
export async function probarOperacion(id: string, input: Record<string, string>): Promise<Prueba> {
  const p = await puerta();
  if ('error' in p) return { ok: false, error: p.error };
  const def = porId(String(id ?? ''));
  if (!def || def.id !== id || !sePuedeProbar(def)) return { ok: false, error: 'Esta operación no se puede probar desde aquí.' };
  if (!rateLimit(`api-mako:probar:${p.ws}`, 20, 60_000)) return { ok: false, error: 'Demasiadas pruebas. Espera un minuto.' };
  const limpio: Record<string, string> = {};
  for (const [k, v] of Object.entries(input ?? {})) if (typeof v === 'string' && v.trim()) limpio[k] = v.trim();
  const t0 = Date.now();
  try {
    const r = await ejecutarOperacion(def.id, limpio, {
      ws: p.ws, canal: 'http', canalKey: canalKeyDe('http', p.ws), alcance: 'lectura', rol: 'admin', actor: p.email,
    }, 'query');
    if (!r.ok) return { ok: false, error: r.error, ...(r.faltan ? { faltan: r.faltan } : {}) };
    if (r.tipo !== 'lectura') return { ok: false, error: 'Esta operación no es una lectura.' };
    let texto = r.resultado;
    const formato = r.formato ?? r.salida;
    if (formato === 'json') { try { texto = JSON.stringify(JSON.parse(texto), null, 2); } catch { /* va tal cual */ } }
    return { ok: true, formato, texto: texto.slice(0, TOPE_PRUEBA), ms: Date.now() - t0, recortado: texto.length > TOPE_PRUEBA };
  } catch (e) {
    console.error(`[api-mako] probar ${def.id} (ws ${p.ws}): ${msg(e)}`);
    return { ok: false, error: 'Falló de nuestro lado. Prueba de nuevo.' };
  }
}

/** La referencia en markdown (la misma de GET /api/v1/docs), para bajarla. */
export async function referenciaApi(): Promise<{ markdown: string } | { error: string }> {
  const p = await puerta();
  if ('error' in p) return p;
  return { markdown: referenciaMarkdown(APP_BASE_URL) };
}
