// =============================================================================
// meta-conexion-zernio — la conexión de Meta de un negocio POR ZERNIO: guardarla, mirarla y probarla (25/10/2026)
// =============================================================================
// El gemelo de lib/meta-conexion.ts (que guarda lo que sale de un token pegado). Acá la conexión es la de anuncios de Zernio
// (`metaads`) que el negocio hizo con «Conectar con Facebook» (la ventana de Zernio, `<ConectarViaZernio red="metaads">`):
// se guarda su `_id` (`META_ZERNIO_CUENTA`) y lo inequívoco que se lee por ella (la cuenta publicitaria y el píxel si hay
// UNO solo). Con varios, elige la persona en el modal de Meta.
//
// ⚠️ Lee y escribe sólo con Zernio ACTIVO para el negocio (`zernioMetaActivo`: con la prueba pasada, todos; antes, sólo
// el de la plataforma). Apagado, no escribe nada: un cliente no queda a medio pasar a un camino sin probar.
// ⚠️ La conexión tiene que ser de la Zernio DEL NEGOCIO: se busca su `_id` entre las cuentas que lista SU clave. Una tipeada
// o la de otro negocio no se guarda (por eso el campo es `derivado`: ningún «guardar» de la pantalla lo acepta).

import 'server-only';
import { auditarCredencial, credWs, guardarCredencial, IdentificadorOcupadoError } from './credenciales';
import { claveZernioAnuncios } from './zernio-ads';
import { zFetch, ZernioError, avisoDeLeadsZernio } from './zernio';
import type { AvisoLeads } from './zernio-leads-estado';
import { normalizarCuentaMeta } from './meta-cuenta-id';
import { errorDeLecturaZernio } from './zernio-redes';
import { canalMeta, zernioMetaActivo } from './meta-via';
import {
  ENV_CUENTA_ZERNIO, cuentasDeZernio, eleccionInicial, paginaParaConectar, paginasDeZernio, pixelesDeZernio, unirPaginas,
  type CuentaPublicitariaZernio, type PaginaFacebook, type PixelZernio,
} from './zernio-meta-cuerpo';

const ID_ZERNIO = /^[A-Za-z0-9_-]{6,64}$/;
const ID_PAGINA_FB = /^\d{5,20}$/;

export class MetaZernioError extends Error {
  constructor(mensaje: string) { super(mensaje); this.name = 'MetaZernioError'; }
}

/** ¿El `_id` es una conexión `metaads` de la Zernio de ESTE negocio? */
async function esConexionDelNegocio(clave: string, accountId: string): Promise<boolean> {
  const r = await zFetch<{ accounts?: Array<{ _id?: string; platform?: string }> }>(clave, '/accounts?platform=metaads');
  return (r.accounts ?? []).some((a) => a._id === accountId && a.platform === 'metaads');
}

/** Las cuentas publicitarias que ve la conexión. Tira si Zernio falla o contesta sin lista. */
export async function cuentasPorZernio(clave: string, accountId: string): Promise<CuentaPublicitariaZernio[]> {
  const body = await zFetch<unknown>(clave, `/ads/accounts?${new URLSearchParams({ accountId }).toString()}`, undefined, 30_000);
  const cuentas = cuentasDeZernio(body);
  if (!cuentas) throw new MetaZernioError('Zernio contestó sin la lista de cuentas publicitarias.');
  return cuentas;
}

/** Los píxeles que ve la conexión (los destinos de la Conversions API). Tira si Zernio falla o contesta sin lista. */
export async function pixelesPorZernio(clave: string, accountId: string): Promise<PixelZernio[]> {
  const body = await zFetch<unknown>(clave, `/accounts/${encodeURIComponent(accountId)}/conversion-destinations`, undefined, 30_000);
  const pixeles = pixelesDeZernio(body);
  if (!pixeles) throw new MetaZernioError('Zernio contestó sin la lista de píxeles.');
  return pixeles;
}

/**
 * Las páginas de Facebook que MaKo conoce del negocio ANTES de abrir la ventana, para mandar `pageId` (con varias concedidas
 * y sin él, Zernio no crea la conexión: lib/zernio-meta-cuerpo.ts → `paginaParaConectar`). Salen de tres lados: la que ya
 * tenía de la conexión vieja (`META_PAGE_ID`), las de su Facebook en Zernio (la conexión `facebook` de los mensajes) y las de
 * una conexión de anuncios que ya exista (al volver a conectar). Nunca tira: una fuente que falla no aporta.
 */
export async function paginasCandidatas(ws: number, clave: string | null, conexion: string | null): Promise<{ paginas: PaginaFacebook[]; delNegocio: string | null; sugeridaDeZernio: string | null }> {
  const delNegocio = await credWs('META_PAGE_ID', ws).catch(() => null);
  const listas: PaginaFacebook[][] = [];
  let sugeridaDeZernio: string | null = null;
  if (clave) {
    const ids = new Set<string>(conexion ? [conexion] : []);
    try {
      const r = await zFetch<{ accounts?: Array<{ _id?: string; platform?: string }> }>(clave, '/accounts?platform=facebook');
      for (const a of r.accounts ?? []) if (a._id && a.platform === 'facebook') ids.add(a._id);
    } catch { /* sin Facebook en Zernio: no aporta */ }
    for (const id of [...ids].slice(0, 5)) {
      const body = await zFetch<unknown>(clave, `/accounts/${encodeURIComponent(id)}/facebook-page`, undefined, 20_000).catch(() => null);
      const p = paginasDeZernio(body);
      if (!p) continue;
      listas.push(p.paginas);
      sugeridaDeZernio = sugeridaDeZernio ?? p.elegida;
    }
  }
  const conNombre = unirPaginas(...listas);
  const paginas = delNegocio && !conNombre.some((p) => p.id === delNegocio) ? [...conNombre, { id: delNegocio, nombre: null }] : conNombre;
  return { paginas, delNegocio, sugeridaDeZernio };
}

export type EstadoMetaZernio = {
  activo: boolean;
  /** Las páginas que MaKo conoce y la decisión de con cuál abrir la ventana (`paginaParaConectar`). */
  paginas: PaginaFacebook[];
  pagina: { pageId: string | null; preguntar: boolean; sugerida: string | null };
  /** El `_id` guardado de la conexión, o null. */
  conexion: string | null;
  cuentas: CuentaPublicitariaZernio[];
  pixeles: PixelZernio[];
  cuenta: string | null;
  pixel: string | null;
  /** Lo que no se pudo leer (Zernio caído, la conexión vencida): la pantalla lo dice, no lo esconde. */
  error: string | null;
  /**
   * ¿Le llegan a MaKo los leads de los formularios? (`avisoDeLeads`, lib/zernio-leads-estado.ts; 5/11/2026): `si` al instante (el
   * webhook los escucha); `tarde` cada media hora (el webhook no los escucha, pero el barrido los lee por la API: «Volver a conectar»
   * los trae al instante); `sin-permiso` no llegan (la API de Zernio contesta 403: falta su complemento de anuncios); null = sin
   * conexión, o no se pudo saber (no se afirma nada). Hasta el 5/11 decía «no recibe» con sólo mirar el webhook, y era falso.
   */
  leads?: AvisoLeads;
  /** Con un 429 de Zernio (su tope por minuto): en cuánto se vuelve a leer sola (ticket #34). null = no se relee. */
  reintentarEnMs?: number | null;
};

/** Lo que muestra el modal de Meta: si está activo, la conexión guardada, las cuentas y los píxeles que ve, y los elegidos. */
export async function estadoMetaZernio(ws: number): Promise<EstadoMetaZernio> {
  const activo = await zernioMetaActivo(ws);
  const [conexion, cuenta, pixel] = await Promise.all([credWs(ENV_CUENTA_ZERNIO, ws), credWs('META_AD_ACCOUNT_ID', ws), credWs('META_PIXEL_ID', ws)]);
  const sinPagina = { pageId: null, preguntar: false, sugerida: null };
  const base: EstadoMetaZernio = { activo, paginas: [], pagina: sinPagina, conexion, cuentas: [], pixeles: [], cuenta: cuenta ? normalizarCuentaMeta(cuenta) : null, pixel, error: null };
  if (!activo) return base;
  const clave = await claveZernioAnuncios(ws);
  const cand = await paginasCandidatas(ws, clave, conexion);
  const conPaginas: EstadoMetaZernio = {
    ...base, paginas: cand.paginas,
    pagina: paginaParaConectar({ elegida: null, delNegocio: cand.delNegocio, candidatas: cand.paginas, sugeridaDeZernio: cand.sugeridaDeZernio }),
  };
  if (!conexion) return conPaginas;
  if (!clave) return { ...conPaginas, error: 'Falta tu clave de Zernio.' };
  try {
    const [cuentas, pixeles, leads] = await Promise.all([
      cuentasPorZernio(clave, conexion), pixelesPorZernio(clave, conexion).catch(() => [] as PixelZernio[]),
      avisoDeLeadsZernio(ws, conexion).catch(() => null),
    ]);
    return { ...conPaginas, cuentas, pixeles, leads };
  } catch (e) {
    if (e instanceof ZernioError) return { ...conPaginas, ...errorDeLecturaZernio(e.status, e.esperaMs) };
    return { ...conPaginas, error: e instanceof Error ? e.message : String(e) };
  }
}

async function guardar(ws: number, env: string, valor: string, autor: string | null, conflictos: string[], guardadas: string[]): Promise<void> {
  try {
    await guardarCredencial(ws, env, valor, 'meta', autor);
    await auditarCredencial(ws, env, 'guardar', autor);
    guardadas.push(env);
  } catch (e) {
    if (e instanceof IdentificadorOcupadoError) {
      await auditarCredencial(ws, env, 'guardar', autor, { permitido: false, motivo: 'identificador ya reclamado por otro workspace' });
      conflictos.push(e.message);
      return;
    }
    throw e;
  }
}

/**
 * Al quedar conectada la ventana de Zernio: guarda la conexión y lo inequívoco. Nunca escribe en Meta. Tira
 * `MetaZernioError` con un mensaje para la pantalla si no está activo o la conexión no es del negocio.
 */
export async function guardarConexionMetaPorZernio(ws: number, accountId: string, autor: string | null): Promise<{ guardadas: string[]; conflictos: string[]; estado: EstadoMetaZernio }> {
  if (!(await zernioMetaActivo(ws))) throw new MetaZernioError('Conectar Meta por Zernio todavía no está abierto.');
  const id = accountId.trim();
  if (!ID_ZERNIO.test(id)) throw new MetaZernioError('Esa conexión no vale.');
  const clave = await claveZernioAnuncios(ws);
  if (!clave) throw new MetaZernioError('Falta tu clave de Zernio.');
  if (!(await esConexionDelNegocio(clave, id))) throw new MetaZernioError('Esa conexión no es de tu cuenta de Zernio.');

  const [cuentas, pixeles, cuentaActual, pixelActual] = await Promise.all([
    cuentasPorZernio(clave, id),
    pixelesPorZernio(clave, id).catch(() => [] as PixelZernio[]),
    credWs('META_AD_ACCOUNT_ID', ws),
    credWs('META_PIXEL_ID', ws),
  ]);
  const elegido = eleccionInicial({ cuentas, pixeles, cuentaActual: cuentaActual ? normalizarCuentaMeta(cuentaActual) : null, pixelActual });

  const guardadas: string[] = [];
  const conflictos: string[] = [];
  await guardar(ws, ENV_CUENTA_ZERNIO, id, autor, conflictos, guardadas);
  // La página con la que quedó (la de los creativos y los formularios), si el negocio no tenía una: así la próxima vez que
  // se conecte no hay que preguntarla (`paginaParaConectar` la toma como elegida). No pisa una que ya estaba.
  const paginaActual = await credWs('META_PAGE_ID', ws);
  if (!paginaActual) {
    const p = paginasDeZernio(await zFetch<unknown>(clave, `/accounts/${encodeURIComponent(id)}/facebook-page`, undefined, 20_000).catch(() => null));
    if (p?.elegida) await guardar(ws, 'META_PAGE_ID', p.elegida, autor, conflictos, guardadas);
  }
  if (elegido.cuenta && elegido.cuenta !== cuentaActual) await guardar(ws, 'META_AD_ACCOUNT_ID', elegido.cuenta, autor, conflictos, guardadas);
  if (elegido.pixel && elegido.pixel !== pixelActual) await guardar(ws, 'META_PIXEL_ID', elegido.pixel, autor, conflictos, guardadas);

  // Con Meta conectado arranca el histórico de métricas, una sola vez y en segundo plano (lo mismo que con el token).
  if (elegido.cuenta) {
    const { arrancarHistoricoEnSegundoPlano } = await import('./onboarding-extract');
    await arrancarHistoricoEnSegundoPlano(ws, 'meta');
  }
  return { guardadas, conflictos, estado: await estadoMetaZernio(ws) };
}

/**
 * La persona elige la cuenta publicitaria o el píxel entre los que ve SU conexión (nunca uno tipeado que no esté en la lista).
 */
export async function elegirMetaPorZernio(ws: number, p: { cuenta?: string | null; pixel?: string | null }, autor: string | null): Promise<EstadoMetaZernio> {
  const est = await estadoMetaZernio(ws);
  if (!est.activo || !est.conexion) throw new MetaZernioError('Primero conecta con Facebook.');
  if (est.error) throw new MetaZernioError(est.error);
  const guardadas: string[] = [];
  const conflictos: string[] = [];
  if (p.cuenta) {
    const act = normalizarCuentaMeta(p.cuenta);
    if (!est.cuentas.some((c) => c.id === act)) throw new MetaZernioError('Esa cuenta publicitaria no está en tu conexión.');
    await guardar(ws, 'META_AD_ACCOUNT_ID', act, autor, conflictos, guardadas);
  }
  if (p.pixel) {
    if (!est.pixeles.some((x) => x.id === p.pixel)) throw new MetaZernioError('Ese píxel no está en tu conexión.');
    await guardar(ws, 'META_PIXEL_ID', p.pixel, autor, conflictos, guardadas);
  }
  if (conflictos.length) throw new MetaZernioError(conflictos.join(' '));
  if (guardadas.includes('META_AD_ACCOUNT_ID')) {
    const { arrancarHistoricoEnSegundoPlano } = await import('./onboarding-extract');
    await arrancarHistoricoEnSegundoPlano(ws, 'meta');
  }
  return estadoMetaZernio(ws);
}

/**
 * El «Probar» de Meta para un negocio conectado por Zernio (lo llama `PINGS.meta`, lib/metodo-verificar.ts, cuando no hay
 * token y sí conexión). La misma forma que el ping por token: la cuenta y su estado, y el píxel con el token del píxel si
 * el negocio lo pegó (ése es el que CAPI usa si Zernio no alcanza).
 */
export async function pingMetaPorZernio(v: Record<string, string>): Promise<
  { ok: true; detalle: string; facts: Array<{ k: string; v: string; c?: string }> } | { ok: false; error: string }
> {
  const canal = await canalMeta();
  if (canal.via !== 'zernio') return { ok: false, error: 'MaKo no encuentra tu conexión de Facebook por Zernio. Vuelve a conectar con Facebook.' };
  let cuentas: CuentaPublicitariaZernio[];
  try { cuentas = await cuentasPorZernio(canal.clave, canal.accountId); } catch (e) {
    // Un 429 es una pausa de Zernio, no una conexión rota (ticket #34): no se manda a reconectar.
    return { ok: false, error: e instanceof ZernioError ? errorDeLecturaZernio(e.status, e.esperaMs).error : 'Zernio no contestó.' };
  }
  const cuenta = cuentas.find((c) => c.id === canal.adAccountId);
  if (!cuenta) return { ok: false, error: `Tu conexión de Facebook no ve la cuenta publicitaria ${canal.adAccountId}. Elige otra o vuelve a conectar.` };
  const activa = cuenta.estado === 1;
  const facts: Array<{ k: string; v: string; c?: string }> = [
    { k: 'Tu cuenta de ads', v: cuenta.nombre ?? cuenta.id },
    { k: 'Estado', v: activa ? 'Activa' : 'Con restricción', c: activa ? 'var(--good)' : 'var(--warn)' },
    { k: 'Conectada por', v: 'Zernio' },
  ];
  const avisos: string[] = [];
  if (v.META_PIXEL_ID) {
    const pixeles = await pixelesPorZernio(canal.clave, canal.accountId).catch(() => null);
    const px = pixeles?.find((x) => x.id === v.META_PIXEL_ID);
    if (px) facts.push({ k: 'Tu píxel', v: px.nombre ?? px.id });
    else if (pixeles) avisos.push(`tu conexión de Facebook no ve el píxel ${v.META_PIXEL_ID}: dale acceso en Meta y vuelve a conectar en Zernio`);
    if (v.META_CAPI_TOKEN) {
      const ver = process.env.META_API_VERSION || 'v24.0';
      const u = new URL(`https://graph.facebook.com/${ver}/${v.META_PIXEL_ID}`);
      u.searchParams.set('fields', 'name');
      u.searchParams.set('access_token', v.META_CAPI_TOKEN);
      const r = await fetch(u.toString(), { signal: AbortSignal.timeout(15_000) }).then((x) => x.json()).catch(() => null) as { error?: { message?: string } } | null;
      if (!r || r.error) avisos.push(`la conexión anterior del píxel ya no llega a tu píxel${r?.error?.message ? ` (${r.error.message})` : ''}`);
      else facts.push({ k: 'Conexión anterior del píxel', v: 'Llega a tu píxel', c: 'var(--good)' });
    }
  }
  return {
    ok: true,
    detalle: avisos.length ? `Cuenta "${cuenta.nombre ?? cuenta.id}" conectada por Zernio, pero ${avisos.join(' y ')}.` : `Cuenta "${cuenta.nombre ?? cuenta.id}" conectada por Zernio.`,
    facts,
  };
}

/**
 * La página que se manda sola al abrir la ventana de anuncios cuando nadie eligió una (`urlConectarViaZernio`, lib/zernio-conectar.ts):
 * SÓLO si MaKo conoce una única página del negocio. Con varias o ninguna, null (con varias, la elige la persona en el modal de Meta).
 * Así el botón del Media Buyer y el de Integraciones no abren sin página a un negocio cuya página ya se sabe. Nunca tira.
 */
export async function paginaDeducida(ws: number, clave: string): Promise<string | null> {
  try {
    const cand = await paginasCandidatas(ws, clave, null);
    const d = paginaParaConectar({ elegida: null, delNegocio: cand.delNegocio, candidatas: cand.paginas, sugeridaDeZernio: cand.sugeridaDeZernio });
    return d.preguntar ? null : d.pageId;
  } catch {
    return null;
  }
}

/**
 * La persona elige la página de sus anuncios (la API de MaKo, `elegir_pagina_meta`). Con la conexión hecha, se cambia en Zernio
 * (`PUT /v1/accounts/{id}/facebook-page`: la página con la que corren los anuncios y los formularios) y sólo entre las que la
 * conexión ve; sin conexión, queda como la página del negocio (`META_PAGE_ID`) y la próxima «Conectar con Facebook» abre con ella.
 * Tira `MetaZernioError` con un mensaje para la persona.
 */
export async function elegirPaginaMeta(ws: number, pagina: string, autor: string | null): Promise<{ pagina: string; enZernio: boolean }> {
  const id = pagina.trim();
  if (!ID_PAGINA_FB.test(id)) throw new MetaZernioError('Ese no es un ID de página de Facebook (son sólo números).');
  if (!(await zernioMetaActivo(ws))) throw new MetaZernioError('Conectar Meta por Zernio todavía no está abierto.');
  const [clave, conexion] = await Promise.all([claveZernioAnuncios(ws), credWs(ENV_CUENTA_ZERNIO, ws)]);
  let enZernio = false;
  if (conexion && clave) {
    const p = paginasDeZernio(await zFetch<unknown>(clave, `/accounts/${encodeURIComponent(conexion)}/facebook-page`, undefined, 20_000));
    if (!p) throw new MetaZernioError('Zernio contestó sin la lista de páginas de tu conexión.');
    if (!p.paginas.some((x) => x.id === id)) {
      throw new MetaZernioError(`Tu conexión de Facebook no ve esa página. Las que ve: ${p.paginas.map((x) => `${x.nombre ?? 'sin nombre'} (${x.id})`).join(', ') || 'ninguna'}.`);
    }
    if (p.elegida !== id) {
      await zFetch<unknown>(clave, `/accounts/${encodeURIComponent(conexion)}/facebook-page`, { method: 'PUT', body: JSON.stringify({ selectedPageId: id }) }, 20_000);
      enZernio = true;
    }
  }
  const conflictos: string[] = [];
  await guardar(ws, 'META_PAGE_ID', id, autor, conflictos, []);
  if (conflictos.length) throw new MetaZernioError(conflictos.join(' '));
  return { pagina: id, enZernio };
}
