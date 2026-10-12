// =============================================================================
// /api/crm/instagram-buscar — el buscador de Instagram del alta de un lead (punto 28, 12/10/2026)
// =============================================================================
// GET ?q=<texto> → { ok, perfiles: PerfilIg[], porNombre }
//   · perfiles   — lo que contestaron Meta y Google, sin repetidos, Meta primero (hasta 8).
//   · porNombre  — true si Google contestó: el buscador por NOMBRE está andando. Con false (sin las
//                  claves de la plataforma, sin cuota o caído) la pantalla pide el @ exacto cuando
//                  no hay resultados. null = no hizo falta preguntarle (Meta ya encontró el @).
//
// Las dos fuentes y por qué, en lib/instagram-buscar.ts (lo puro, con test). Acá viven la red, las
// credenciales y la caché:
//   1. META — Business Discovery con la conexión de Meta del NEGOCIO de la sesión: su token de
//      usuario (`META_ACCESS_TOKEN`, el que la doc de Meta pide para Business Discovery) y la cuenta
//      de Instagram profesional de su página (`META_PAGE_ID` → `instagram_business_account{id}`, como
//      `resolveInstagramActorId` en lib/meta-ads-create.ts). ⚠️ No lee `META_PAGE_ACCESS_TOKEN`:
//      AGENTS.md («La conexión de Meta de un cliente son DOS tokens») prohíbe un cuarto lector de esa
//      fila. Sin conexión, sin cuenta de Instagram o sin el permiso, no es un error: sigue Google.
//   2. GOOGLE — Custom Search JSON API con las claves de la PLATAFORMA (`GOOGLE_CSE_KEY` y
//      `GOOGLE_CSE_CX` en el workspace `wsSuperAdmin()`, leídas con `credDelCliente` como la clave de
//      la pasarela de MaKo: nunca `credWs`/`envCred`, que caen al ws1, que es un cliente). Gratis
//      hasta 100 búsquedas por día: el componente espera 500 ms y pide 3 letras, y acá hay caché.
//      ⚠️ Google cerró esa API a clientes nuevos y la apaga el 1/1/2027 (lib/instagram-buscar.ts).
//
// ⚠️ LA SESIÓN SE CHEQUEA ACÁ y no sólo en el gate de proxy.ts: sin AUTH_SECRET el gate queda inactivo
// (local) y `getWorkspaceActual()` sin cookie cae al ws 1, que es un cliente. La ruta NO va en
// `lib/rutas-publicas.ts`: es privada. Rol: el del alta (cualquiera con sesión en el CRM, como
// `crearLeadEnTableroAction`).
//
// ⚠️ UN RESULTADO NUNCA SE INVENTA: si ninguna fuente contestó, la lista va vacía y la pantalla deja
// escribir el @ a mano. Y la foto que viaja es una URL del CDN de Meta que VENCE: es para la lista,
// no se guarda como foto del lead.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual, wsSuperAdmin } from '@/lib/workspace';
import { credDelCliente, credWs } from '@/lib/credenciales';
import {
  MAX_LARGO, alcanzaParaBuscar, combinarPerfiles, leerRespuestaGoogle, leerRespuestaMeta,
  motivoDeErrorGraph, normalizarBusqueda, usuarioDeTexto, usuariosCandidatos, type PerfilIg,
} from '@/lib/instagram-buscar';

export const dynamic = 'force-dynamic';
/** Meta (6 s) y después Google (6 s) en el peor caso; el componente corta a los 17 s. */
export const maxDuration = 15;

const GRAPH = 'https://graph.facebook.com';
const ver = () => process.env.META_API_VERSION || 'v24.0';
const CSE = 'https://www.googleapis.com/customsearch/v1';
const TOPE_PEDIDO_MS = 6000;
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ── Caché corta en el proceso ─────────────────────────────────────────────────
// En globalThis y no en una variable de módulo, por lo mismo que lib/credenciales.ts: Turbopack puede
// emitir una copia del módulo por capa. Lo que se guarda y por cuánto:
//   · g:<texto normalizado> → la lista de Google (es lo que cuesta cuota: ésa es la razón de la caché).
//   · g:sin-cuota           → Google contestó 429: no se le vuelve a preguntar por 15 minutos.
//   · m:<ws>:<usuario>      → lo que dijo Meta de ese @ (perfil o null = «no está»), POR NEGOCIO.
//                             ⚠️ Revisión del 12/10/2026: sin el ws en la clave, la caché era global y se
//                             leía antes de mirar si este negocio tiene conexión de Meta. Un negocio sin
//                             Meta recibía el perfil que otro cliente había buscado diez minutos antes:
//                             se filtraba la prospección de otro inquilino, y con datos leídos con SU token.
//   · ig:<ws>               → la cuenta de Instagram de la página del negocio (o null = no tiene).
//   · mx:<ws>               → la conexión de Meta del negocio no sirve para esto (token o permiso), o
//                             Meta la está limitando: no se le pregunta en cada tecla.
// Un FALLO («no pude») no se guarda nunca: el próximo pedido vuelve a preguntar.
const TTL_MS = 10 * 60_000;
const TTL_SIN_CUOTA_MS = 15 * 60_000;
const TOPE_CACHE = 500;
type Entrada = { hasta: number; valor: unknown };
const g = globalThis as typeof globalThis & { __makoIgBuscar?: Map<string, Entrada> };
const cache = (g.__makoIgBuscar ??= new Map<string, Entrada>());

function leerCache<T>(clave: string): T | undefined {
  const e = cache.get(clave);
  if (!e) return undefined;
  if (e.hasta <= Date.now()) { cache.delete(clave); return undefined; }
  return e.valor as T;
}
function guardarCache(clave: string, valor: unknown, ttl = TTL_MS): void {
  // Map conserva el orden de inserción: el primero es el más viejo.
  if (cache.size >= TOPE_CACHE) cache.delete(cache.keys().next().value as string);
  cache.set(clave, { hasta: Date.now() + ttl, valor });
}

// ── 1. Meta: Business Discovery ───────────────────────────────────────────────

/** La cuenta de Instagram profesional de la página del negocio, o null si no tiene. Tira si Meta no contesta. */
async function igDelNegocio(ws: number, token: string): Promise<string | null> {
  const clave = `ig:${ws}`;
  const ya = leerCache<string | null>(clave);
  if (ya !== undefined) return ya;
  const pagina = await credWs('META_PAGE_ID', ws);
  if (!pagina) { guardarCache(clave, null); return null; }
  const url = new URL(`${GRAPH}/${ver()}/${pagina}`);
  url.searchParams.set('fields', 'instagram_business_account{id}');
  url.searchParams.set('access_token', token);
  const r = await fetch(url, { signal: AbortSignal.timeout(TOPE_PEDIDO_MS), cache: 'no-store' });
  const j = (await r.json().catch(() => null)) as { error?: { message?: string }; instagram_business_account?: { id?: string } } | null;
  // Meta manda el fallo ADENTRO de un 200 (AGENTS.md): `error` se mira antes que el dato. El error
  // viaja con su motivo: un token vencido o un límite de Meta se cachean en `mx:<ws>` (abajo).
  if (!r.ok || !j || j.error) throw Object.assign(new Error(j?.error?.message ?? `HTTP ${r.status}`), { motivo: motivoDeErrorGraph(j?.error) });
  const id = j.instagram_business_account?.id ? String(j.instagram_business_account.id) : null;
  guardarCache(clave, id);
  return id;
}

/** Los perfiles que Meta encontró entre estos @ (cada uno, una consulta; en paralelo). Nunca tira. */
async function buscarEnMeta(usuarios: string[], ws: number): Promise<PerfilIg[]> {
  const encontrados: PerfilIg[] = [];
  const pendientes: string[] = [];
  for (const u of usuarios) {
    const ya = leerCache<PerfilIg | null>(`m:${ws}:${u}`);
    if (ya === undefined) pendientes.push(u);
    else if (ya) encontrados.push(ya);
  }
  if (!pendientes.length || leerCache<boolean>(`mx:${ws}`)) return encontrados;

  let token: string | null = null;
  let ig: string | null = null;
  try {
    token = await credWs('META_ACCESS_TOKEN', ws);
    ig = token ? await igDelNegocio(ws, token) : null;
  } catch (e) {
    // ⚠️ REVISIÓN DEL 12/10/2026: un token vencido, un permiso que falta o un límite de Meta contestan
    // igual en cada tecla, y la pausa de abajo sólo se alcanzaba si ESTA lectura salía bien. Se pausa
    // acá también; una caída de la base o de la red (sin motivo) no se cachea.
    const motivo = (e as { motivo?: unknown } | null)?.motivo;
    if (motivo === 'sin-permiso' || motivo === 'limite') guardarCache(`mx:${ws}`, true);
    console.error(`[api:crm/instagram-buscar] la cuenta de Instagram del ws ${ws}: ${msg(e)}`);
    return encontrados;
  }
  // Sin conexión de Meta o sin Instagram profesional en la página: no es un error, sigue Google.
  if (!token || !ig) return encontrados;
  const tk = token;
  const cuenta = ig;

  await Promise.all(pendientes.map(async (u) => {
    try {
      const url = new URL(`${GRAPH}/${ver()}/${cuenta}`);
      // `u` pasó por la regex de usuario (letras, números, punto y guion bajo): no puede cerrar la
      // expansión de campos con un `)` o un `}`.
      url.searchParams.set('fields', `business_discovery.username(${u}){username,name,profile_picture_url}`);
      url.searchParams.set('access_token', tk);
      const r = await fetch(url, { signal: AbortSignal.timeout(TOPE_PEDIDO_MS), cache: 'no-store' });
      const lectura = leerRespuestaMeta(r.status, await r.json().catch(() => null));
      if (lectura.ok) {
        guardarCache(`m:${ws}:${u}`, lectura.perfil);
        encontrados.push(lectura.perfil);
      } else if (lectura.motivo === 'no-esta') {
        guardarCache(`m:${ws}:${u}`, null);
      } else if (lectura.motivo === 'sin-permiso' || lectura.motivo === 'limite') {
        // Un token vencido, sin el permiso o limitado por Meta va a contestar igual en cada tecla: se
        // deja de preguntar un rato y queda UNA línea en el log, no una por búsqueda.
        if (!leerCache<boolean>(`mx:${ws}`)) console.error(`[api:crm/instagram-buscar] la conexión de Meta del ws ${ws} no sirve para Business Discovery (${lectura.motivo}): ${lectura.detalle}`);
        guardarCache(`mx:${ws}`, true);
      } else {
        console.error(`[api:crm/instagram-buscar] Meta sobre @${u}: ${lectura.detalle}`);
      }
    } catch (e) {
      console.error(`[api:crm/instagram-buscar] Meta sobre @${u}: ${msg(e)}`);
    }
  }));
  // El orden de los candidatos (el usuario, el nombre pegado, con punto, con guion bajo) es el de la lista.
  encontrados.sort((a, b) => usuarios.indexOf(a.usuario) - usuarios.indexOf(b.usuario));
  return encontrados;
}

// ── 2. Google: Custom Search JSON API ─────────────────────────────────────────

type EstadoGoogle = { perfiles: PerfilIg[]; respondio: boolean };

/** Lo que Google encuentra en instagram.com para este texto. Nunca tira. */
async function buscarEnGoogle(texto: string): Promise<EstadoGoogle> {
  const clave = `g:${normalizarBusqueda(texto)}`;
  const ya = leerCache<PerfilIg[]>(clave);
  if (ya) return { perfiles: ya, respondio: true };
  if (leerCache<boolean>('g:sin-cuota')) return { perfiles: [], respondio: false };

  let key: string | null = null;
  let cx: string | null = null;
  try {
    const ws = await wsSuperAdmin();
    [key, cx] = await Promise.all([credDelCliente('GOOGLE_CSE_KEY', ws), credDelCliente('GOOGLE_CSE_CX', ws)]);
  } catch (e) {
    console.error(`[api:crm/instagram-buscar] las claves de Google de la plataforma: ${msg(e)}`);
    return { perfiles: [], respondio: false };
  }
  // Todavía no existen (12/10/2026): sin ellas el buscador usa sólo Meta y pide el @. No es un error.
  if (!key || !cx) return { perfiles: [], respondio: false };

  try {
    const url = new URL(CSE);
    url.searchParams.set('key', key);
    url.searchParams.set('cx', cx);
    url.searchParams.set('q', texto.trim().replace(/^@+/, ''));
    url.searchParams.set('num', '10');
    // Restringido a instagram.com aunque el buscador (cx) no lo esté: lo que no es de ahí no sirve.
    url.searchParams.set('siteSearch', 'instagram.com');
    url.searchParams.set('siteSearchFilter', 'i');
    const r = await fetch(url, { signal: AbortSignal.timeout(TOPE_PEDIDO_MS), cache: 'no-store' });
    const lectura = leerRespuestaGoogle(r.status, await r.json().catch(() => null));
    if (lectura.ok) {
      guardarCache(clave, lectura.perfiles);
      return { perfiles: lectura.perfiles, respondio: true };
    }
    if (lectura.motivo === 'sin-cuota') guardarCache('g:sin-cuota', true, TTL_SIN_CUOTA_MS);
    // El detalle es el mensaje de Google: no trae la clave.
    console.error(`[api:crm/instagram-buscar] Google (${lectura.motivo}): ${lectura.detalle}`);
  } catch (e) {
    console.error(`[api:crm/instagram-buscar] Google: ${msg(e)}`);
  }
  return { perfiles: [], respondio: false };
}

// ── La ruta ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const s = await getUsuarioActual();
  const ws = s ? await getWorkspaceActual() : null;
  if (!s || ws == null) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const texto = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, MAX_LARGO);
  if (!alcanzaParaBuscar(texto)) return Response.json({ ok: true, perfiles: [], porNombre: false });

  // Lo escrito es un @ → Meta primero, y Google sólo si Meta no lo encontró (cada búsqueda de Google
  // es una de las 100 del día). Es un nombre → las dos a la vez: Meta con el nombre pegado, Google
  // con el nombre.
  const candidatos = usuariosCandidatos(texto);
  let meta: PerfilIg[];
  let google: EstadoGoogle | null;   // null = no hizo falta preguntarle
  if (usuarioDeTexto(texto) != null) {
    meta = await buscarEnMeta(candidatos, ws);
    google = meta.length ? null : await buscarEnGoogle(texto);
  } else {
    [meta, google] = await Promise.all([buscarEnMeta(candidatos, ws), buscarEnGoogle(texto)]);
  }

  return Response.json({
    ok: true,
    perfiles: combinarPerfiles(meta, google?.perfiles ?? []),
    // false = Google no pudo contestar (sin claves, sin cuota, caído): sin resultados, la pantalla
    // pide el @ exacto. null = no se le preguntó.
    porNombre: google ? google.respondio : null,
  });
}
