// =============================================================================
// meta-descubrir — con UN token, MaKo completa el resto de los campos de Meta
// =============================================================================
// El onboarding pedía SEIS credenciales de Meta y el cliente tenía que ir a buscar
// cada una a una pantalla distinta de Business Manager (una de ellas, el token de
// la página, le pedía literalmente abrir el Explorador de la API Graph y hacer un
// GET a /me/accounts a mano). De las seis, CINCO salen solas del token principal:
//
//   · META_AD_ACCOUNT_ID     → GET /me/adaccounts
//   · META_PAGE_ID           → GET /me/accounts
//   · META_PAGE_ACCESS_TOKEN → viene DENTRO de esa misma respuesta (campo access_token)
//   · META_PIXEL_ID          → GET /{act_id}/adspixels
//   · META_CAPI_TOKEN        → ya no hace falta: lib/meta-capi.ts cae al token principal
//
// Verificado contra la API real (2026-07-31) con un token de usuario de sistema:
// las cuatro llamadas responden 200 y /me/accounts SÍ trae el access_token de cada
// página. Lo único que no se puede adivinar es CUÁL elegir cuando hay varias — ahí
// la UI muestra la lista (opciones) en vez de inventar.
//
// Nada de esto escribe en Meta: son cuatro GET.

import 'server-only';
import { normalizarCuentaMeta } from './meta-cuenta-id';

const GRAPH = 'https://graph.facebook.com';
const ver = () => process.env.META_API_VERSION || 'v24.0';

/** Los permisos que el token TIENE que traer para que el descubrimiento sirve. */
export const SCOPES_NECESARIOS = [
  'ads_read',
  'ads_management',
  'business_management',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_ads',
  'leads_retrieval',
] as const;

export type OpcionCuenta = { id: string; nombre: string; activa: boolean; moneda?: string };
export type OpcionPagina = { id: string; nombre: string; token: string };
export type OpcionPixel = { id: string; nombre: string };

export type Descubrimiento = {
  ok: true;
  /** Nombre del usuario/sistema dueño del token (para que el cliente se reconozca). */
  titular: string;
  tipoToken: string;
  /** Permisos que le FALTAN al token, del set necesario. Vacío = está completo. */
  faltanScopes: string[];
  /** true si el token no vence (usuario de sistema). */
  permanente: boolean;
  cuentas: OpcionCuenta[];
  paginas: OpcionPagina[];
  pixeles: OpcionPixel[];
  /** Avisos legibles: qué no se pudo traer y por qué (nunca corta el flujo). */
  avisos: string[];
} | { ok: false; error: string };

type Json = Record<string, unknown>;

async function get(path: string, token: string, params: Record<string, string> = {}): Promise<{ body: Json; error?: string }> {
  const url = new URL(`${GRAPH}/${ver()}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', token);
  try {
    const r = await fetch(url.toString(), { cache: 'no-store', signal: AbortSignal.timeout(12000) });
    const body = (await r.json().catch(() => ({}))) as Json;
    const e = body.error as { message?: string; code?: number } | undefined;
    if (e) return { body, error: e.code === 190 ? 'Token inválido o vencido. Genera uno nuevo de usuario de sistema.' : (e.message ?? 'error de Meta') };
    return { body };
  } catch (err) {
    return { body: {}, error: err instanceof Error ? err.message : String(err) };
  }
}

const arr = (b: Json): Json[] => (Array.isArray(b.data) ? (b.data as Json[]) : []);
const s = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

/**
 * Con el token pegado por el cliente, trae TODO lo que la app puede completar sola.
 * Nunca lanza: si una parte falla (p.ej. no tiene páginas asignadas), devuelve el
 * resto + un aviso explicando qué le falta hacer en Business Manager.
 */
export async function descubrirMeta(token: string): Promise<Descubrimiento> {
  const limpio = token.trim();
  if (!limpio || limpio.startsWith('PENDING')) return { ok: false, error: 'Pega primero tu access token de Meta.' };

  // 1. ¿Quién es y qué permisos trae? debug_token es la única forma de saber los
  //    scopes REALES: si faltan, el error tiene que decir CUÁL falta, no "error 100".
  const [yo, dbg] = await Promise.all([
    get('/me', limpio, { fields: 'id,name' }),
    get('/debug_token', limpio, { input_token: limpio }),
  ]);
  if (yo.error) return { ok: false, error: yo.error };

  const data = (dbg.body.data ?? {}) as Json;
  const scopes = Array.isArray(data.scopes) ? (data.scopes as string[]) : [];
  const faltanScopes = scopes.length ? SCOPES_NECESARIOS.filter((sc) => !scopes.includes(sc)) : [];
  const permanente = data.expires_at === 0;

  const avisos: string[] = [];

  // 2. Cuentas publicitarias, páginas (con su token) y píxeles.
  const [ctas, pags] = await Promise.all([
    get('/me/adaccounts', limpio, { fields: 'id,name,account_status,currency', limit: '50' }),
    get('/me/accounts', limpio, { fields: 'id,name,access_token', limit: '50' }),
  ]);

  const cuentas: OpcionCuenta[] = ctas.error ? [] : arr(ctas.body).map((c) => ({
    id: s(c.id), nombre: s(c.name) || s(c.id), activa: Number(c.account_status) === 1, moneda: s(c.currency) || undefined,
  })).filter((c) => c.id);
  if (ctas.error) avisos.push(`No pudimos listar tus cuentas publicitarias (${ctas.error}).`);
  else if (!cuentas.length) avisos.push('Tu usuario de sistema no tiene ninguna cuenta publicitaria asignada: agrégala en Configuración del negocio → Agregar activos.');

  const paginas: OpcionPagina[] = pags.error ? [] : arr(pags.body).map((p) => ({
    id: s(p.id), nombre: s(p.name) || s(p.id), token: s(p.access_token),
  })).filter((p) => p.id);
  if (pags.error) avisos.push(`No pudimos listar tus páginas (${pags.error}).`);
  else if (!paginas.length) avisos.push('No vemos ninguna página asignada a tu usuario de sistema. Sin eso no podemos traer los leads de tus formularios: asignala en Configuración del negocio → Agregar activos.');

  // 3. Los píxeles cuelgan de la cuenta publicitaria: solo se pueden pedir si ya
  //    sabemos cuál es (si hay varias, la UI vuelve a preguntar tras elegir).
  let pixeles: OpcionPixel[] = [];
  if (cuentas.length === 1) {
    const px = await get(`/${cuentas[0].id}/adspixels`, limpio, { fields: 'id,name', limit: '50' });
    if (px.error) avisos.push(`No pudimos listar los píxeles de ${cuentas[0].nombre} (${px.error}).`);
    else pixeles = arr(px.body).map((p) => ({ id: s(p.id), nombre: s(p.name) || s(p.id) })).filter((p) => p.id);
  }

  return {
    ok: true,
    titular: s(yo.body.name) || s(yo.body.id) || 'tu cuenta',
    tipoToken: s(data.type) || 'desconocido',
    faltanScopes,
    permanente,
    cuentas,
    paginas,
    pixeles,
    avisos,
  };
}

/** Los píxeles de UNA cuenta (cuando el cliente eligió entre varias). */
export async function pixelesDeCuenta(token: string, cuentaId: string): Promise<OpcionPixel[]> {
  const id = normalizarCuentaMeta(cuentaId);
  const px = await get(`/${id}/adspixels`, token.trim(), { fields: 'id,name', limit: '50' });
  if (px.error) return [];
  return arr(px.body).map((p) => ({ id: s(p.id), nombre: s(p.name) || s(p.id) })).filter((p) => p.id);
}
