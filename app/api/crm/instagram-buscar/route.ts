// =============================================================================
// /api/crm/instagram-buscar — el buscador de Instagram del alta de un lead (punto 28, 12/10/2026)
// =============================================================================
// GET ?estado=1 → { ok, conexion: ConexionMeta } (22/10/2026): ¿el negocio puede buscar en Meta? Sin buscar a nadie
//   (`conexionDeMeta`, abajo). El buscador lo pregunta al enfocar el campo, para ofrecer «Conectar Meta» ANTES de que se
//   escriba el @ a ciegas. `&fresco=1` (después de conectar) olvida lo guardado en la caché de ese negocio.
// GET ?q=<texto> → { ok, perfiles: PerfilIg[], porNombre, meta, limite }
//   · perfiles   — lo que contestaron Meta y Google, sin repetidos, Meta primero (hasta 8).
//   · porNombre  — true si Google contestó: el buscador por NOMBRE está andando. Con false (sin las
//                  claves de la plataforma, sin cuota o caído) la pantalla pide el @ exacto cuando
//                  no hay resultados. null = no hizo falta preguntarle (Meta ya encontró el @).
//   · meta       — qué pasó con Meta (`EstadoMeta`, #844): sin resultados, la pantalla dice POR QUÉ (cuenta personal,
//                  el negocio sin Meta conectado, sin permiso, Meta no contestó) en vez de «Sin resultados».
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
//   3. APIFY — con un @ EXACTO que Meta y Google no trajeron: el scraper de perfiles por usuario (cuentas personales
//      también), por LA función de Instagram (`leerPerfilInstagram` de lib/instagram-perfil-server.ts, la misma que lee el
//      perfil en el onboarding y en Offer). La paga la plataforma; si no tiene key, el negocio. Medido el 22/10/2026: ni
//      Google ni Apify tienen claves en ningún negocio, y sólo 1 de 11 conexiones de Meta tiene permisos de Instagram.
//      ⚠️ 2/11/2026 — SE PRUEBAN LAS DOS CLAVES DE APIFY, no una. `apify` lee `APIFY_TOKEN`; la clave que Martín pegó
//      el 1/11 es `APIFY_CLAVE_DE_SPY` (del negocio) y sólo la prueba la fuente `apify-spy`. Este buscador pedía la
//      primera, que no está en ninguna parte, así que el respaldo por @ exacto nunca corría aunque hubiera con qué.
//      Lo cuida `tests/crm-instagram-clave-de-spy.test.ts`.
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
  motivoDeErrorGraph, normalizarBusqueda, usuarioDeTexto, usuariosCandidatos, type ConexionMeta, type EstadoMeta, type PerfilIg,
  clavesQueOlvida, tocaRefrescar, type AnotadoFresco,
} from '@/lib/instagram-buscar';
import { leerPerfilInstagram } from '@/lib/instagram-perfil-server';
import { gastarBusquedaDeSpy, topeDeSpyAgotado } from '@/lib/instagram-perfil-server';

export const dynamic = 'force-dynamic';
/**
 * Meta (6 s), Google (6 s) y después Apify, que busca por nombre y tarda ~20 s (tope 45 s). Con 15 s Vercel cortaba
 * antes de que Apify contestara y el desplegable no salía nunca (3/11/2026). tests/instagram-buscar-tiempos.test.ts.
 */
export const maxDuration = 60;

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
//                             Meta la está limitando: no se le pregunta en cada tecla. Guarda el motivo
//                             ('sin-permiso' o 'limite'): la pantalla dice cuál (#844).
// Un FALLO («no pude») no se guarda nunca: el próximo pedido vuelve a preguntar.
const TTL_MS = 10 * 60_000;
const TTL_SIN_CUOTA_MS = 15 * 60_000;
const TOPE_CACHE = 500;
type Entrada = { hasta: number; valor: unknown };
const g = globalThis as typeof globalThis & { __makoIgBuscar?: Map<string, Entrada>; __makoIgFresco?: Map<number, AnotadoFresco> };
const cache = (g.__makoIgBuscar ??= new Map<string, Entrada>());
/** Lo anotado de cada negocio para el tope de `fresco` (fuera de `cache`: el tope de 500 no lo tiene que poder echar). */
const frescos = (g.__makoIgFresco ??= new Map<number, AnotadoFresco>());

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

/**
 * La búsqueda por nombre de Apify (~20 s, US$0,012), con la clave de Spy del negocio. Lo encontrado se guarda: seguir
 * tipeando y volver a la misma palabra no se paga dos veces. Sin clave o sin resultados, lista vacía.
 */
async function buscarConApify(texto: string, ws: number): Promise<PerfilIg[]> {
  const clave = `ax:${ws}:${texto.toLowerCase()}`;
  const ya = leerCache<PerfilIg[]>(clave);
  if (ya) return ya;
  const { buscarPerfilesApify } = await import('@/lib/instagram-buscar-apify');
  const { APIFY_CLAVE_DE_SPY } = await import('@/lib/instagram-perfil');
  const token = await credDelCliente(APIFY_CLAVE_DE_SPY, ws).catch(() => null);
  if (!token) return [];
  if (!gastarBusquedaDeSpy(ws)) return [];
  const hallados = await buscarPerfilesApify(texto, token);
  if (hallados.length) guardarCache(clave, hallados);
  return hallados;
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

/** El estado cuando no encontró: lo peor que pasó gana (no poder preguntar dice más que «no está»). */
const estadoDe = (encontrados: PerfilIg[], peor: EstadoMeta): EstadoMeta => (encontrados.length ? 'encontro' : peor);
/** Lo que guarda `mx:<ws>`: por qué la conexión del negocio no sirve ahora. */
const pausaDe = (motivo: unknown): EstadoMeta => (motivo === 'limite' ? 'no-pude' : 'sin-permiso');

/**
 * Los perfiles que Meta encontró entre estos @ (cada uno, una consulta; en paralelo), y QUÉ PASÓ (#844): la pantalla
 * lo dice en vez de un «Sin resultados» que miente. Nunca tira.
 */
async function buscarEnMeta(usuarios: string[], ws: number): Promise<{ perfiles: PerfilIg[]; estado: EstadoMeta }> {
  const encontrados: PerfilIg[] = [];
  const pendientes: string[] = [];
  for (const u of usuarios) {
    const ya = leerCache<PerfilIg | null>(`m:${ws}:${u}`);
    if (ya === undefined) pendientes.push(u);
    else if (ya) encontrados.push(ya);
  }
  if (!pendientes.length) return { perfiles: encontrados, estado: estadoDe(encontrados, 'no-esta') };
  const pausa = leerCache<string>(`mx:${ws}`);
  if (pausa) return { perfiles: encontrados, estado: estadoDe(encontrados, pausaDe(pausa)) };

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
    if (motivo === 'sin-permiso' || motivo === 'limite') guardarCache(`mx:${ws}`, motivo);
    console.error(`[api:crm/instagram-buscar] la cuenta de Instagram del ws ${ws}: ${msg(e)}`);
    return { perfiles: encontrados, estado: estadoDe(encontrados, motivo === 'sin-permiso' ? 'sin-permiso' : 'no-pude') };
  }
  // Sin conexión de Meta, o conectada sin Instagram profesional en la página: no es un error, sigue Google. Y son DOS
  // cosas (24/10/2026): con token, la pantalla no pide «Conectar Meta» (`sin-instagram`).
  if (!token || !ig) return { perfiles: encontrados, estado: estadoDe(encontrados, token ? 'sin-instagram' : 'sin-conexion') };
  const tk = token;
  const cuenta = ig;

  let peor: EstadoMeta = 'no-esta';
  const peorQue = (e: EstadoMeta) => { if (e === 'sin-permiso' || (e === 'no-pude' && peor === 'no-esta')) peor = e; };
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
        if (!leerCache<string>(`mx:${ws}`)) console.error(`[api:crm/instagram-buscar] la conexión de Meta del ws ${ws} no sirve para Business Discovery (${lectura.motivo}): ${lectura.detalle}`);
        guardarCache(`mx:${ws}`, lectura.motivo);
        peorQue(pausaDe(lectura.motivo));
      } else {
        console.error(`[api:crm/instagram-buscar] Meta sobre @${u}: ${lectura.detalle}`);
        peorQue('no-pude');
      }
    } catch (e) {
      console.error(`[api:crm/instagram-buscar] Meta sobre @${u}: ${msg(e)}`);
      peorQue('no-pude');
    }
  }));
  // El orden de los candidatos (el usuario, el nombre pegado, con punto, con guion bajo) es el de la lista.
  encontrados.sort((a, b) => usuarios.indexOf(a.usuario) - usuarios.indexOf(b.usuario));
  return { perfiles: encontrados, estado: estadoDe(encontrados, peor) };
}

/**
 * ¿El negocio puede buscar en Meta? (22/10/2026) Martín: «La búsqueda de Instagram: no funciona porque tengo que
 * conectar Meta. No entiendo eso». Lee LO MISMO que `buscarEnMeta` (el token del negocio y la cuenta de Instagram de su
 * página, con la caché de `igDelNegocio`) y no busca ningún perfil: no gasta Business Discovery, Google ni Apify.
 *
 * ⚠️ `fresco` OLVIDA LA CACHÉ DE ESTE NEGOCIO (la cuenta de la página y la pausa): el buscador lo manda después de
 * conectar. Sin eso, `ig:<ws>` (null = «la página no tiene Instagram») o la pausa por permiso seguían diciendo «sin
 * conexión» diez minutos después de haber conectado. Nada de acá escribe en la caché por su cuenta.
 * ⚠️ CON TOPE Y SIN TOCAR LA PAUSA DE UN LÍMITE (23/10/2026, revisión de Integración): `refrescar`, abajo.
 */
async function conexionDeMeta(ws: number, fresco: boolean): Promise<ConexionMeta> {
  if (fresco) refrescar(ws);
  const pausa = leerCache<string>(`mx:${ws}`);
  if (pausa) return pausa === 'limite' ? 'no-pude' : 'sin-permiso';
  try {
    const token = await credWs('META_ACCESS_TOKEN', ws);
    const ig = token ? await igDelNegocio(ws, token) : null;
    // Con token y sin la cuenta de Instagram de la página, Meta ESTÁ conectada (24/10/2026): `sin-instagram`, no «conectá».
    return token && ig ? 'conectado' : token ? 'sin-instagram' : 'sin-conexion';
  } catch (e) {
    // Lo que no se pudo leer NO es «sin conexión»: no se manda a conectar lo que quizá ya está conectado.
    console.error(`[api:crm/instagram-buscar] el estado de Meta del ws ${ws}: ${msg(e)}`);
    return (e as { motivo?: unknown } | null)?.motivo === 'sin-permiso' ? 'sin-permiso' : 'no-pude';
  }
}

/**
 * `fresco` con tope (lib/instagram-buscar.ts: `tocaRefrescar` y `clavesQueOlvida`): una vez cada 10 minutos por negocio y
 * 20 por día, y la pausa por un límite de Meta queda. El tope vive en la memoria del proceso, como la caché: cada
 * instancia del server lleva el suyo.
 */
function refrescar(ws: number): void {
  const t = tocaRefrescar(frescos.get(ws), Date.now());
  if (!t.si) return;
  frescos.set(ws, t.anotado);
  for (const k of clavesQueOlvida(ws, leerCache<string>(`mx:${ws}`))) cache.delete(k);
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

  // El estado de la conexión, sin buscar (22/10/2026): lo pregunta el buscador al enfocar el campo.
  const sp = req.nextUrl.searchParams;
  if (sp.get('estado') === '1') return Response.json({ ok: true, conexion: await conexionDeMeta(ws, sp.get('fresco') === '1') });

  const texto = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, MAX_LARGO);
  if (!alcanzaParaBuscar(texto)) return Response.json({ ok: true, perfiles: [], porNombre: false, meta: null });

  // Lo escrito es un @ → Meta primero, y Google sólo si Meta no lo encontró (cada búsqueda de Google
  // es una de las 100 del día). Es un nombre → las dos a la vez: Meta con el nombre pegado, Google
  // con el nombre.
  const candidatos = usuariosCandidatos(texto);
  let meta: { perfiles: PerfilIg[]; estado: EstadoMeta };
  let google: EstadoGoogle | null;   // null = no hizo falta preguntarle
  if (usuarioDeTexto(texto) != null) {
    meta = await buscarEnMeta(candidatos, ws);
    google = meta.perfiles.length ? null : await buscarEnGoogle(texto);
    // Ni la Meta del negocio ni Google: la Meta de la PLATAFORMA (30/10/2026: el día que su página tenga el Instagram de MaKo
    // vinculado y su token `instagram_basic`, anda sin tocar nada, con foto, para el negocio sin Instagram propio) y, si no, el @
    // exacto por Apify (cuentas personales también). Con caché y tope por día.
    // ⚠️ `apify-spy` VA ACÁ, Y ES EL ARREGLO DEL 2/11/2026. Martín: «ya con Apify debería funcionar el traer el perfil
    // escribiendo el @, eso también en el CRM». No faltaba código: faltaba pedir la clave que EXISTE. `apify` lee
    // `APIFY_TOKEN` —que el 22/10 no estaba en ningún negocio ni en la plataforma—, y la clave que Martín pegó el
    // 1/11 es `APIFY_CLAVE_DE_SPY`, del negocio, que sólo se prueba con la fuente `apify-spy`. O sea que este
    // respaldo pedía una llave que nadie tenía teniendo la otra al lado. Va ÚLTIMA a propósito: primero la de la
    // plataforma (gratis para el negocio) y recién después la suya, como manda el resto del lector.
    if (!meta.perfiles.length && !google?.perfiles.length) {
      const u = usuarioDeTexto(texto) as string;
      // ⚠️ UNA PALABRA TAMBIÉN ES UNA BÚSQUEDA (3/11/2026). Martín: «no me trae el desplegable al buscar». «leila» y
      // «@leila» parecen un usuario y venían por acá: se pedía sólo el @ EXACTO, y la búsqueda de Apify corría únicamente
      // con dos o más palabras. Las dos a la vez: el exacto, si existe, va primero.
      // CON «@» ES SÓLO EL EXACTO (Martín: «si busco el @ exacto, no me puede traer sin tardar esos 20 segundos directamente la
      // foto?»): quien escribe el @ ya sabe a quién busca, y esperar la búsqueda por nombre era el tiempo de sobra.
      const [l, hallados] = await Promise.all([
        leerPerfilInstagram(u, { ws, fuentes: ['meta-plataforma', 'apify', 'apify-spy'] }),
        texto.startsWith('@') ? Promise.resolve<PerfilIg[]>([]) : buscarConApify(u, ws),
      ]);
      const exacto: PerfilIg[] = l.ok ? [{ usuario: l.perfil.usuario, nombre: l.perfil.nombre, foto: l.perfil.foto }] : [];
      const perfiles = combinarPerfiles(exacto, hallados);
      if (perfiles.length) meta = { ...meta, perfiles, ...(hallados.length ? { estado: 'encontro' as const } : {}) };
    }
  } else {
    [meta, google] = await Promise.all([buscarEnMeta(candidatos, ws), buscarEnGoogle(texto)]);
    // ── BUSCAR POR NOMBRE, SIN @ (3/11/2026) ──────────────────────────────────────────────────
    // Martín: «si yo busco sin arroba, también debería empezar a salir resultados».
    //
    // ⚠️ ESTA ES LA RAMA DEL NOMBRE y antes se quedaba sin salida: Meta sólo adivina handles a
    // partir del texto, y Google **no tiene claves en ningún negocio** (medido el 3/11 contra
    // producción: `GOOGLE_CSE_KEY` y `GOOGLE_CSE_CX` no están cargadas en ninguno). Así que
    // escribir «leila» no traía nada y la lista salía vacía.
    //
    // ⚠️ Es OTRO actor que el de la lectura por @ —`apify~instagram-scraper`, no
    // `instagram-profile-scraper`— porque aquél no busca. Cuesta US$1,50 por 1.000 resultados:
    // **US$0,012 la búsqueda** (lib/instagram-buscar-apify.ts). Va al final, sólo si las otras dos
    // no trajeron nada, y con el mismo tope por corrida.
    if (!meta.perfiles.length && !google.perfiles.length) {
      const hallados = await buscarConApify(texto, ws);
      if (hallados.length) meta = { ...meta, perfiles: hallados, estado: 'encontro' };
    }
  }

  return Response.json({
    ok: true,
    perfiles: combinarPerfiles(meta.perfiles, google?.perfiles ?? []),
    meta: meta.estado,
    // Sin resultados porque se acabó el tope de hoy: la pantalla lo dice en vez de «no encontré a nadie».
    limite: !meta.perfiles.length && !google?.perfiles.length && topeDeSpyAgotado(ws),
    // false = Google no pudo contestar (sin claves, sin cuota, caído): sin resultados, la pantalla
    // pide el @ exacto. null = no se le preguntó.
    porNombre: google ? google.respondio : null,
  });
}
