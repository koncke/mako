// =============================================================================
// editor-landing/dominios — el dominio propio de una landing: Vercel, el DNS y la base (T7)
// =============================================================================
// Pedido de Martín (11/10/2026), punto 10 de la tanda 2: publicar «con una URL creada por MaKo,
// como lo hace Gamma, o la opción de traer tu dominio». Diseño: docs/diseno-editor-landing.md → T7.
// Lo puro (validar, armar registros, el veredicto, la decisión del proxy) está en
// ./dominios-reglas.ts, con test; acá queda lo que habla con afuera.
//
// CÓMO ANDA. Todas las landings viven en UN proyecto de Vercel (el de MaKo). Conectar un dominio es
// agregarlo a ese proyecto por la API de Vercel; la persona carga en su DNS el A (raíz) o el CNAME
// (subdominio) que Vercel recomienda, más un TXT `_mako` con un valor propio de ESTA landing; y
// cuando las tres cosas están, la fila pasa a 'verificado' y proxy.ts empieza a servir la landing
// en ese host (sólo la landing: nada de la app ni de /api).
//
// ⚠️ POR QUÉ EL TXT DE MAKO, si Vercel ya verifica. Vercel verifica que el DNS apunte a Vercel, no
// QUIÉN agregó el dominio. Con un solo proyecto para todas las cuentas, un dominio cuyo DNS ya
// apunta acá —el de un cliente que lo quitó de su landing y dejó el registro— quedaría verificado
// para la PRIMERA otra cuenta de MaKo que lo escriba, y su página se serviría en el dominio ajeno.
// El TXT lleva un HMAC de (workspace, landing, dominio): sólo quien controla el DNS lo puede cargar.
//
// ⚠️ SÓLO SERVER. El token de Vercel (VERCEL_API_TOKEN) administra el proyecto entero: puede quitar
// hola-mako.com. Nunca viaja al navegador, y lo único que esta lib le pide a Vercel que SUELTE es el
// dominio que la fila de la landing guarda Y que MaKo agregó (`puedeSoltarseDeVercel`, en positivo, con
// la marca `dominio_agregado_por_mako`: lo que ya estaba en el proyecto no se suelta nunca).
//
// ⚠️ EL RECLAMO PENDIENTE VENCE (revisión de la tanda 2): a las 72 h, o antes si quien lo pide prueba
// el DNS con SU TXT, otra landing se lo puede quedar; y un negocio no tiene más de 5 sin verificar
// (`reclamar`, con lo puro en dominios-reglas.ts). Antes, cualquier admin podía reservar el dominio de
// otro para siempre.
//
// Variables del entorno: VERCEL_API_TOKEN (obligatoria), VERCEL_TEAM_SLUG (el equipo; sin él la API
// mira la cuenta personal y no encuentra el proyecto), VERCEL_PROJECT_ID (opcional: Vercel la pone
// sola en sus funciones; si no está, se usa el nombre del proyecto, 'mako', que la API acepta igual).
// =============================================================================

import 'server-only';
import { createHmac } from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';
import { getTenantDb, getWorkspaceActual } from '../workspace';
import { getSupabaseServer } from '../supabase';
import {
  CLAVE_TXT_MAKO, PREFIJO_TXT_MAKO, TOPE_PENDIENTES, estaVerificado, motivoDominioInvalido, motivoParaQuitarReclamo,
  normalizarDominio, pendienteVencido, pendientesVigentes, puedeSoltarseDeVercel, queFalta, registrosDns, slugServible,
  textoDominioOcupado,
  type Comprobacion, type EstadoDominio, type EstadoDominioPublico, type RespuestaDominio,
} from './dominios-reglas';

export type FallaDominio = { ok: false; error: string; status: number };
export type ResultadoDominio = RespuestaDominio | FallaDominio;

const falla = (error: string, status = 400): FallaDominio => ({ ok: false, error, status });
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Un error que ya trae el texto que se dibuja y el código HTTP. */
class ErrorDominio extends Error {
  /** `detalle`: lo que va al log y NO a la pantalla (el nombre de una variable de entorno no le dice nada al cliente). */
  constructor(mensaje: string, readonly status: number, readonly detalle?: string) { super(mensaje); }
}

/** Lo que lee el cliente cuando falta una credencial NUESTRA: qué pasa y de quién es, sin nombres internos. */
const NO_ACTIVADO = 'El dominio propio todavía no está activado en MaKo. No es nada tuyo.';

// ─────────────────────────────────────────────────────────────────────────────
// La API de Vercel
// ─────────────────────────────────────────────────────────────────────────────

const API_VERCEL = 'https://api.vercel.com';
const PLAZO_VERCEL_MS = 15_000;
const PROYECTO_POR_NOMBRE = 'mako';

type ConfigVercel = { token: string; equipo: string; proyecto: string };

/** Las credenciales de Vercel del entorno, o un error que dice cuál falta (es nuestro, no del cliente). */
function configVercel(): ConfigVercel {
  const token = process.env.VERCEL_API_TOKEN?.trim();
  const equipo = process.env.VERCEL_TEAM_SLUG?.trim();
  if (!token) throw new ErrorDominio(NO_ACTIVADO, 503, 'falta VERCEL_API_TOKEN');
  if (!equipo) throw new ErrorDominio(NO_ACTIVADO, 503, 'falta VERCEL_TEAM_SLUG');
  return { token, equipo, proyecto: process.env.VERCEL_PROJECT_ID?.trim() || PROYECTO_POR_NOMBRE };
}

type RespVercel = { status: number; json: Record<string, unknown> | null };

async function vercel(c: ConfigVercel, ruta: string, init: { method?: string; body?: unknown } = {}): Promise<RespVercel> {
  const u = new URL(API_VERCEL + ruta);
  u.searchParams.set('slug', c.equipo);
  let res: Response;
  try {
    res = await fetch(u, {
      method: init.method ?? 'GET',
      headers: { Authorization: `Bearer ${c.token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(PLAZO_VERCEL_MS),
      cache: 'no-store',
    });
  } catch (e) {
    throw new ErrorDominio(`Vercel no contestó (${msg(e)}). Vuelve a intentar.`, 502);
  }
  let json: Record<string, unknown> | null = null;
  try { json = (await res.json()) as Record<string, unknown>; } catch { /* un DELETE puede venir vacío */ }
  return { status: res.status, json };
}

/** El mensaje de error que mandó Vercel, para nombrarlo (AGENTS.md: cuando el que dice que no es un tercero, se lo nombra). */
function errorDeVercel(r: RespVercel): { codigo: string; texto: string } {
  const e = (r.json?.error ?? null) as { code?: unknown; message?: unknown } | null;
  return { codigo: typeof e?.code === 'string' ? e.code : '', texto: typeof e?.message === 'string' ? e.message : `HTTP ${r.status}` };
}

/** Lo que vino mal de Vercel, como un error para la pantalla. Un 401/403 es la credencial de MaKo: no es del cliente. */
function fallaDeVercel(r: RespVercel, que: string): ErrorDominio {
  const { texto } = errorDeVercel(r);
  if (r.status === 401 || r.status === 403) return new ErrorDominio(`Vercel rechazó la credencial de MaKo al ${que}. No es nada tuyo.`, 502);
  if (r.status >= 500) return new ErrorDominio(`Vercel falló al ${que} (${texto}). Vuelve a intentar.`, 502);
  return new ErrorDominio(`Vercel no aceptó el dominio: ${texto}`, r.status === 409 ? 409 : 400);
}

type DominioDeProyecto = {
  name: string;
  apexName: string | null;
  verified: boolean;
  verification: { tipo: string; dominio: string; valor: string }[];
};

function leerDominioDeProyecto(j: Record<string, unknown> | null): DominioDeProyecto | null {
  if (!j || typeof j.name !== 'string') return null;
  const ver = Array.isArray(j.verification) ? j.verification : [];
  return {
    name: j.name,
    apexName: typeof j.apexName === 'string' ? j.apexName : null,
    verified: j.verified === true,
    verification: ver
      .map((v) => v as { type?: unknown; domain?: unknown; value?: unknown })
      .filter((v) => typeof v.type === 'string' && typeof v.domain === 'string' && typeof v.value === 'string')
      .map((v) => ({ tipo: v.type as string, dominio: v.domain as string, valor: v.value as string })),
  };
}

const rutaDominio = (c: ConfigVercel, d: string) => `/v9/projects/${encodeURIComponent(c.proyecto)}/domains/${encodeURIComponent(d)}`;

/** El dominio tal como lo tiene el proyecto, o null si no está (404). Otro error TIRA. */
async function leerEnVercel(c: ConfigVercel, d: string): Promise<DominioDeProyecto | null> {
  const r = await vercel(c, rutaDominio(c, d));
  if (r.status === 404) return null;
  if (r.status !== 200) throw fallaDeVercel(r, 'leer el dominio');
  return leerDominioDeProyecto(r.json);
}

/**
 * Agrega el dominio al proyecto y dice QUIÉN lo puso ahí: `true` = lo agregó ESTE pedido (Vercel
 * contestó 2xx a nuestro POST), `false` = ya estaba. Sólo el `true` pone la marca que permite soltarlo
 * después (`puedeSoltarseDeVercel`). Se LEE antes de agregar: si Vercel contestara 200 a un dominio que
 * ya estaba (idempotente), la marca se pondría sobre algo que no agregamos. Un 409 después de leer «no
 * está» es una carrera (otro pedido lo agregó en el medio): ya estaba, sin marca. Si está en otro
 * proyecto o cuenta, Vercel lo dice y se nombra.
 */
async function agregarAVercel(c: ConfigVercel, d: string): Promise<boolean> {
  if (await leerEnVercel(c, d)) return false;
  const r = await vercel(c, `/v10/projects/${encodeURIComponent(c.proyecto)}/domains`, { method: 'POST', body: { name: d } });
  if ((r.status === 200 || r.status === 201) && leerDominioDeProyecto(r.json)) return true;
  if (r.status === 409 && (await leerEnVercel(c, d))) return false;
  throw fallaDeVercel(r, 'agregar el dominio');
}

/** Le pide a Vercel que vuelva a mirar el TXT `_vercel` (sólo si lo pide). null = todavía no. */
async function verificarEnVercel(c: ConfigVercel, d: string): Promise<DominioDeProyecto | null> {
  const r = await vercel(c, `${rutaDominio(c, d)}/verify`, { method: 'POST' });
  return r.status === 200 ? leerDominioDeProyecto(r.json) : null;
}

type ConfigDns = { apunta: boolean; ipv4: string[]; cname: string | null };

/** Si el DNS apunta a Vercel y qué valores recomienda. null = no se pudo leer (no es un «no»). */
async function configDns(c: ConfigVercel, d: string): Promise<ConfigDns | null> {
  const r = await vercel(c, `/v6/domains/${encodeURIComponent(d)}/config`);
  if (r.status !== 200 || !r.json) return null;
  const j = r.json as { misconfigured?: unknown; recommendedIPv4?: unknown; recommendedCNAME?: unknown };
  const primero = (v: unknown): unknown => {
    if (!Array.isArray(v)) return null;
    const ord = [...v].sort((a, b) => Number((a as { rank?: unknown }).rank ?? 99) - Number((b as { rank?: unknown }).rank ?? 99));
    return (ord[0] as { value?: unknown } | undefined)?.value ?? null;
  };
  const ip = primero(j.recommendedIPv4);
  const cn = primero(j.recommendedCNAME);
  return {
    apunta: j.misconfigured === false,
    ipv4: Array.isArray(ip) ? ip.filter((x): x is string => typeof x === 'string') : typeof ip === 'string' ? [ip] : [],
    cname: typeof cn === 'string' ? cn : null,
  };
}

/**
 * Suelta el dominio del proyecto. Un 404 es «ya no estaba», que es lo que se quería. Es el ÚNICO
 * DELETE a Vercel de esta lib, y el guard va ACÁ y en positivo (`puedeSoltarseDeVercel`): sólo un
 * dominio de cliente que MaKo agregó, nunca uno de MaKo ni uno que ya estaba en el proyecto. Quien
 * llama le pasa lo que guarda la FILA (el dominio y su marca), no lo que pidió la pantalla.
 */
async function quitarDeVercel(c: ConfigVercel, d: string, agregadoPorMako: boolean): Promise<void> {
  if (!puedeSoltarseDeVercel(d, agregadoPorMako)) throw new ErrorDominio('Ese dominio no se puede quitar', 400);
  const r = await vercel(c, rutaDominio(c, d), { method: 'DELETE' });
  if (r.status === 200 || r.status === 204 || r.status === 404) return;
  throw fallaDeVercel(r, 'quitar el dominio');
}

/**
 * Para quien borre una landing de verdad (o vacíe un workspace): suelta su dominio del proyecto de
 * Vercel, ANTES de borrar la fila (si no, en el hueco otra cuenta lo reclama y el DELETE se lo saca).
 * Con lo que guarda la fila: sin la marca de MaKo no se le pide nada a Vercel. TIRA si Vercel falla:
 * quien llama decide (borrar no sigue; vaciar un workspace lo avisa).
 */
export async function soltarDominioDeVercel(dominioGuardado: string | null | undefined, agregadoPorMako: boolean | null | undefined): Promise<void> {
  if (!puedeSoltarseDeVercel(dominioGuardado, agregadoPorMako)) return;
  await quitarDeVercel(configVercel(), dominioGuardado, agregadoPorMako === true);
}

// ─────────────────────────────────────────────────────────────────────────────
// El TXT de MaKo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El valor del TXT `_mako.<dominio>` para ESTA landing: un HMAC de (workspace, landing, dominio)
 * con AUTH_SECRET y un prefijo propio (otro uso de la misma clave no puede producir el mismo valor).
 * Determinista, así no hace falta guardarlo: si AUTH_SECRET rota, sólo cambia el valor que se le
 * pide a un dominio TODAVÍA pendiente (uno verificado no se vuelve a probar).
 */
function valorTxtMako(ws: number, id: number, dominio: string): string {
  const secreto = process.env.AUTH_SECRET;
  if (!secreto) throw new ErrorDominio(NO_ACTIVADO, 503, 'falta AUTH_SECRET');
  const h = createHmac('sha256', secreto).update(`landing-dominio|${ws}|${id}|${dominio}`).digest('base64url').slice(0, 32);
  return CLAVE_TXT_MAKO + h;
}

/** ¿El TXT `_mako.<dominio>` tiene ese valor? null = el DNS no contestó (no es un «no»). */
async function txtTiene(dominio: string, valor: string): Promise<boolean | null> {
  try {
    const registros = await resolveTxt(`${PREFIJO_TXT_MAKO}.${dominio}`);
    return registros.some((partes) => partes.join('').trim() === valor);
  } catch (e) {
    const codigo = (e as { code?: unknown }).code;
    return codigo === 'ENOTFOUND' || codigo === 'ENODATA' ? false : null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo de la landing (con sesión: el workspace de la pestaña)
// ─────────────────────────────────────────────────────────────────────────────

type FilaDominio = {
  id: number;
  dominio: string | null;
  dominio_estado: EstadoDominioPublico | null;
  dominio_verificado_at: string | null;
  /** Cuándo se reclamó (un pendiente vence a las 72 h). */
  dominio_reclamado_at: string | null;
  /** MaKo lo agregó al proyecto de Vercel: sólo así se lo puede soltar. */
  dominio_agregado_por_mako: boolean | null;
  papelera_at: string | null;
};

const COLS = 'id, dominio, dominio_estado, dominio_verificado_at, dominio_reclamado_at, dominio_agregado_por_mako, papelera_at';

/** Lo que se escribe para dejar una landing SIN dominio (las cinco columnas juntas: el CHECK de la 0263 las ata). */
const SIN_DOMINIO = { dominio: null, dominio_estado: null, dominio_verificado_at: null, dominio_reclamado_at: null, dominio_agregado_por_mako: false } as const;

/** Lo que lee quien ve un error nuestro (de la base o del código): de quién es y qué hacer, sin el texto crudo. */
const FALLA_NUESTRA = 'No pude completar el cambio del dominio (es un problema nuestro). Vuelve a intentar.';

function idDe(raw: unknown): number | null {
  const n = typeof raw === 'string' && /^[0-9]{1,15}$/.test(raw) ? Number(raw) : raw;
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 ? n : null;
}

async function leerFila(ws: number, id: number): Promise<FilaDominio | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('landing_docs').select(COLS).eq('workspace_id', ws).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as FilaDominio | null) ?? null;
}

async function contexto(idRaw: unknown): Promise<{ ws: number; id: number; fila: FilaDominio } | FallaDominio> {
  const ws = await getWorkspaceActual();
  if (ws == null) return falla('No hay un negocio abierto', 403);
  const id = idDe(idRaw);
  if (!id) return falla('Falta la landing');
  const fila = await leerFila(ws, id);
  if (!fila) return falla('No existe', 404);
  return { ws, id, fila };
}

function deError(e: unknown, que: string): FallaDominio {
  if (e instanceof ErrorDominio) {
    if (e.status >= 500) console.error(`[editor-landing:dominio] ${que}: ${e.message}${e.detalle ? ` (${e.detalle})` : ''}`);
    return falla(e.message, e.status);
  }
  console.error(`[editor-landing:dominio] ${que}: ${msg(e)}`);
  return falla(FALLA_NUESTRA, 500);
}

/**
 * El estado del dominio de la landing, mirando Vercel y el DNS EN ESTE MOMENTO. Si las cuatro cosas
 * están (`estaVerificado`), la fila pasa a 'verificado' (compare-and-set sobre 'pendiente'). Nunca
 * vuelve atrás: un verificado al que se le cae el DNS sólo lo avisa (`queFalta`).
 * `verificar` = el botón «Verificar de nuevo»: además le pide a Vercel que vuelva a mirar su TXT.
 */
export async function estadoDominio(idRaw: unknown, op: { verificar?: boolean } = {}): Promise<ResultadoDominio> {
  try {
    const cx = await contexto(idRaw);
    if (!('fila' in cx)) return cx;
    const { ws, id, fila } = cx;
    if (!fila.dominio || !fila.dominio_estado) return { ok: true, dominio: null };
    return { ok: true, dominio: await comprobar(ws, id, fila.dominio, fila.dominio_estado, fila.dominio_verificado_at, !!op.verificar) };
  } catch (e) {
    return deError(e, 'estado');
  }
}

async function comprobar(ws: number, id: number, d: string, estado: EstadoDominioPublico, verificadoAt: string | null, verificar: boolean): Promise<EstadoDominio> {
  const c = configVercel();
  const valorTxt = valorTxtMako(ws, id, d);
  let pd = await leerEnVercel(c, d);
  if (pd && !pd.verified && verificar && pd.verification.length) pd = (await verificarEnVercel(c, d)) ?? pd;
  const [dns, mako] = await Promise.all([
    pd ? configDns(c, d) : Promise.resolve(null),
    estado === 'verificado' ? Promise.resolve(true) : txtTiene(d, valorTxt),
  ]);
  const comp: Comprobacion = { enVercel: !!pd, vercel: pd ? pd.verified : null, apunta: dns ? dns.apunta : null, mako };

  let estadoFinal = estado;
  let fecha = verificadoAt;
  if (estado === 'pendiente' && estaVerificado(comp)) {
    const ahora = new Date().toISOString();
    const db = await getTenantDb();
    const { data, error } = await db.from('landing_docs')
      .update({ dominio_estado: 'verificado', dominio_verificado_at: ahora })
      .eq('workspace_id', ws).eq('id', id).eq('dominio', d).eq('dominio_estado', 'pendiente')
      .select('id');
    if (error) throw new Error(error.message);
    if ((data ?? []).length) {
      estadoFinal = 'verificado';
      fecha = ahora;
      olvidarDominio(d);
      console.log(`[editor-landing:dominio] #${id} (ws ${ws}) verificado en ${d}`);
    }
  }

  return {
    dominio: d,
    estado: estadoFinal,
    verificadoAt: fecha,
    enVercel: comp.enVercel,
    registros: registrosDns({
      dominio: d, apex: pd?.apexName, ipv4: dns?.ipv4, cname: dns?.cname, verificacionVercel: pd?.verified ? [] : pd?.verification,
      valorTxtMako: valorTxt, apunta: comp.apunta, vercel: comp.vercel, mako: estadoFinal === 'verificado' ? true : comp.mako,
    }),
    falta: queFalta({ ...comp, mako: estadoFinal === 'verificado' ? true : comp.mako }, estadoFinal === 'verificado'),
  };
}

/**
 * Conecta un dominio a la landing: primero lo RECLAMA en la base (`reclamar`: el índice único global
 * hace que gane el primero, como el slug, salvo un pendiente ajeno vencido o probado por el TXT),
 * después lo agrega a Vercel; si Vercel dice que no, el reclamo se deshace. Al revés quedaría un
 * dominio en Vercel que ninguna fila nombra. Si la landing ya tiene ESE dominio, es un reintento (lo
 * vuelve a agregar a Vercel si alguien lo sacó de allá).
 *
 * La marca `dominio_agregado_por_mako` (la que permite soltarlo después) se pone SÓLO si Vercel lo
 * agregó por este pedido, o se HEREDA del reclamo vencido que esta landing reemplazó (ése lo había
 * agregado MaKo: la responsabilidad de soltarlo pasa a ésta).
 */
export async function conectarDominio(idRaw: unknown, dominioRaw: unknown): Promise<ResultadoDominio> {
  try {
    const d = normalizarDominio(typeof dominioRaw === 'string' ? dominioRaw : '');
    const motivo = motivoDominioInvalido(d);
    if (motivo || !d) return falla(motivo ?? 'No es un dominio válido');
    const c = configVercel();   // sin credenciales no se reclama nada
    const cx = await contexto(idRaw);
    if (!('fila' in cx)) return cx;
    const { ws, id, fila } = cx;
    if (fila.papelera_at) return falla('Está en la papelera', 409);
    if (fila.dominio && fila.dominio !== d) return falla('Quita el dominio actual primero', 409);

    const reclamado = !fila.dominio;
    let marca = fila.dominio_agregado_por_mako === true;
    let heredada = false;
    if (reclamado) {
      const r = await reclamar(ws, id, d);
      if (!r.ok) return r;
      marca = heredada = r.marcaHeredada;
    }

    let agrego: boolean;
    try {
      agrego = await agregarAVercel(c, d);
    } catch (e) {
      // Con la marca heredada el dominio YA está en el proyecto por MaKo: deshacer el reclamo dejaría
      // ese dominio sin nadie que lo suelte. Queda pendiente en esta landing y se reintenta.
      if (reclamado && !heredada) {
        const db = await getTenantDb();
        const { error } = await db.from('landing_docs').update(SIN_DOMINIO)
          .eq('workspace_id', ws).eq('id', id).eq('dominio', d).eq('dominio_estado', 'pendiente');
        if (error) console.error(`[editor-landing:dominio] #${id}: no pude soltar el reclamo de ${d} tras el rechazo de Vercel: ${error.message}`);
      }
      throw e;
    }
    if (agrego && !marca) {
      const db = await getTenantDb();
      const { error } = await db.from('landing_docs').update({ dominio_agregado_por_mako: true })
        .eq('workspace_id', ws).eq('id', id).eq('dominio', d);
      // Sin la marca el dominio no se suelta nunca de Vercel: queda colgado, que es la dirección segura.
      if (error) console.error(`[editor-landing:dominio] #${id}: Vercel agregó ${d} y no pude guardar la marca (no se soltará solo): ${error.message}`);
    }
    console.log(`[editor-landing:dominio] #${id} (ws ${ws}) conectó ${d}${agrego ? '' : ' (ya estaba en el proyecto)'}`);
    const estado = reclamado ? 'pendiente' : (fila.dominio_estado ?? 'pendiente');
    return { ok: true, dominio: await comprobar(ws, id, d, estado, reclamado ? null : fila.dominio_verificado_at, false) };
  } catch (e) {
    return deError(e, 'conectar');
  }
}

/**
 * Reclama el dominio para la landing en la base. Antes, el tope: un negocio no tiene más de
 * `TOPE_PENDIENTES` dominios sin verificar y sin vencer. Si otra landing lo tiene (23505), se le quita
 * SÓLO si es un pendiente vencido o si quien pide ya cargó el TXT `_mako` de SU landing
 * (`motivoParaQuitarReclamo`), con compare-and-set sobre ESE reclamo, y se reintenta UNA vez.
 */
async function reclamar(ws: number, id: number, d: string): Promise<{ ok: true; marcaHeredada: boolean } | FallaDominio> {
  const db = await getTenantDb();
  const ahora = Date.now();
  const { data: pend, error: ePend } = await db.from('landing_docs').select('dominio_estado, dominio_reclamado_at')
    .eq('workspace_id', ws).eq('dominio_estado', 'pendiente');
  if (ePend) throw new Error(ePend.message);
  const vigentes = pendientesVigentes((pend ?? []) as { dominio_estado: string | null; dominio_reclamado_at: string | null }[], ahora);
  if (vigentes >= TOPE_PENDIENTES) return falla(`Ya tienes ${TOPE_PENDIENTES} dominios sin verificar. Verifica o quita uno antes de añadir otro.`, 409);

  let marcaHeredada = false;
  for (let intento = 0; intento < 2; intento++) {
    const { data, error } = await db.from('landing_docs')
      .update({ dominio: d, dominio_estado: 'pendiente', dominio_verificado_at: null, dominio_reclamado_at: new Date().toISOString(), dominio_agregado_por_mako: marcaHeredada })
      .eq('workspace_id', ws).eq('id', id).is('dominio', null)
      .select('id');
    if (!error) return (data ?? []).length ? { ok: true, marcaHeredada } : falla('Otra pestaña cambió el dominio. Vuelve a abrir.', 409);
    if ((error as { code?: string }).code !== '23505') throw new Error(error.message);
    if (intento > 0) break;
    const r = await quitarReclamoAjeno(ws, id, d, ahora);
    if (!r.ok) return r;
    marcaHeredada = r.marca;
  }
  return falla('Ese dominio ya está en otra landing.', 409);
}

/**
 * La landing (de este negocio o de otro) que tiene el dominio, y si se le puede quitar. Lee y escribe
 * con el cliente CRUDO a propósito: el dominio es una clave GLOBAL única y la fila puede ser de otro
 * workspace (`getTenantDb` la acotaría al de la sesión y no la vería). La escritura es un
 * compare-and-set sobre ESE reclamo (mismo dominio, pendiente y misma fecha): si en el medio se
 * verificó o lo reclamó otro, no se toca nada.
 */
async function quitarReclamoAjeno(ws: number, id: number, d: string, ahora: number): Promise<{ ok: true; marca: boolean } | FallaDominio> {
  const sb = getSupabaseServer();
  const { data, error } = await sb.from('landing_docs')
    .select('id, workspace_id, dominio_estado, dominio_reclamado_at, dominio_agregado_por_mako').eq('dominio', d).maybeSingle();
  if (error) throw new Error(error.message);
  const ajeno = data as { id: number; workspace_id: number; dominio_estado: string | null; dominio_reclamado_at: string | null; dominio_agregado_por_mako: boolean | null } | null;
  if (!ajeno) return { ok: true, marca: false };   // se soltó en el medio: el reintento lo toma
  const valorTxt = valorTxtMako(ws, id, d);
  const txt = ajeno.dominio_estado === 'pendiente' && !pendienteVencido(ajeno.dominio_reclamado_at, ahora) ? await txtTiene(d, valorTxt) : null;
  const motivo = motivoParaQuitarReclamo({ estado: ajeno.dominio_estado, reclamadoAt: ajeno.dominio_reclamado_at }, ahora, txt);
  if (!motivo) return falla(textoDominioOcupado(d, ajeno.dominio_estado, valorTxt), 409);

  let q = sb.from('landing_docs').update(SIN_DOMINIO).eq('id', ajeno.id).eq('dominio', d).eq('dominio_estado', 'pendiente');
  q = ajeno.dominio_reclamado_at ? q.eq('dominio_reclamado_at', ajeno.dominio_reclamado_at) : q.is('dominio_reclamado_at', null);
  const { data: soltado, error: e2 } = await q.select('id');
  if (e2) throw new Error(e2.message);
  if (!(soltado ?? []).length) return falla('Ese dominio cambió de manos recién. Vuelve a intentar.', 409);
  console.log(`[editor-landing:dominio] #${id} (ws ${ws}) le quitó ${d} al reclamo pendiente de #${ajeno.id} (ws ${ajeno.workspace_id}): ${motivo === 'vencido' ? 'venció' : 'TXT propio en el DNS'}`);
  return { ok: true, marca: ajeno.dominio_agregado_por_mako === true };
}

/**
 * Quita el dominio: lo suelta de Vercel y limpia la fila. Primero Vercel: si falla, la fila sigue
 * diciendo la verdad (el dominio sigue conectado) y se puede reintentar. Si la fila guarda algo que no
 * es un dominio de cliente válido, o uno que MaKo no agregó (ya estaba en el proyecto), a Vercel no se
 * le pide nada (`puedeSoltarseDeVercel`): sólo se limpia la fila.
 */
export async function quitarDominio(idRaw: unknown): Promise<ResultadoDominio> {
  try {
    const cx = await contexto(idRaw);
    if (!('fila' in cx)) return cx;
    const { ws, id, fila } = cx;
    const d = fila.dominio;
    if (!d) return { ok: true, dominio: null };
    const marca = fila.dominio_agregado_por_mako === true;
    if (puedeSoltarseDeVercel(d, marca)) await quitarDeVercel(configVercel(), d, marca);
    else console.warn(`[editor-landing:dominio] #${id}: «${d}» no lo agregó MaKo al proyecto (o no es un dominio de cliente): no se le pidió nada a Vercel`);
    const db = await getTenantDb();
    const { error } = await db.from('landing_docs').update(SIN_DOMINIO)
      .eq('workspace_id', ws).eq('id', id).eq('dominio', d);
    if (error) {
      console.error(`[editor-landing:dominio] #${id}: no pude limpiar ${d} de la fila: ${error.message}`);
      return falla(FALLA_NUESTRA, 500);
    }
    olvidarDominio(d);
    console.log(`[editor-landing:dominio] #${id} (ws ${ws}) quitó ${d}`);
    return { ok: true, dominio: null };
  } catch (e) {
    return deError(e, 'quitar');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// La lectura SIN sesión: host → slug (cada visita a un dominio propio)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Caché corta por instancia. Encontrado: 60 s (quitar el dominio lo saca de Vercel, que deja de
 * mandar tráfico; despublicar se respeta en el acto porque `leerPublicado` mira la fila en cada
 * visita). No encontrado: 20 s, para que un dominio recién verificado empiece a andar rápido.
 * Un ERROR no se guarda: la próxima visita vuelve a preguntar.
 */
export type LandingDeDominio = { docId: number; slug: string };

const CACHE = new Map<string, { landing: LandingDeDominio | null; vence: number }>();
const TTL_ENCONTRADO_MS = 60_000;
const TTL_NO_ENCONTRADO_MS = 20_000;
const TOPE_CACHE = 500;

function olvidarDominio(d: string): void { CACHE.delete(d); }

/**
 * La landing que sirve ese host (su id y su slug), o null si ninguna (no verificado, no existe o sin
 * slug). Lee con el cliente crudo por una clave GLOBAL única (como `leerPublicado`): sin cookie,
 * `getTenantDb` caería al ws1, que es un cliente. Y ESTRICTA: un error de base TIRA — «no pude leer»
 * no es «no existe», y un 404 por un parpadeo le diría a Google que la página murió.
 *
 * El `docId` es para /l/html en un dominio propio: ahí sólo se deberían servir los bloques de ESTA
 * landing (pedido a app/l/html en el informe de la tanda), no los de cualquier otra.
 */
export async function landingDeDominio(host: string): Promise<LandingDeDominio | null> {
  const ahora = Date.now();
  const c = CACHE.get(host);
  if (c && c.vence > ahora) return c.landing;
  const { data, error } = await getSupabaseServer().from('landing_docs')
    .select('id, slug').eq('dominio', host).eq('dominio_estado', 'verificado').maybeSingle();
  if (error) throw new Error(error.message);
  const f = data as { id?: unknown; slug?: unknown } | null;
  const id = Number(f?.id);
  const landing = f && slugServible(f.slug) && Number.isSafeInteger(id) && id > 0 ? { docId: id, slug: f.slug } : null;
  if (CACHE.size >= TOPE_CACHE) CACHE.clear();
  CACHE.set(host, { landing, vence: ahora + (landing ? TTL_ENCONTRADO_MS : TTL_NO_ENCONTRADO_MS) });
  return landing;
}
