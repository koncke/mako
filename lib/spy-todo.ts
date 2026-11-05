import 'server-only';

// =============================================================================
// spy-todo — las corridas LARGAS de Competitors Spy: todo lo que publica y todos sus anuncios (4/11/2026)
// =============================================================================
// Martín, 4/11 (puntos 8 y 10): «que traiga muchos más, si puede, todos directamente» y «todos los anuncios de la
// biblioteca de anuncios... Que los traiga para analizarlos».
//
// Un paso por llamada, como la caricatura: `avanzarTodo` EMPIEZA una corrida de Apify (`/runs`, contesta en el acto) o
// MIRA la que está en marcha y, si terminó, guarda su dataset con el mismo camino que la lectura de siempre
// (`guardarVistas`). Lo llama /api/competitor-spy/todo; la pantalla vuelve a preguntar mientras haya algo en marcha. Qué
// se pide, cuánto y cada cuánto: lib/spy-todo-reglas.ts.
//
// ⚠️ LA CLAVE ES LA DE SPY DEL NEGOCIO (`APIFY_CLAVE_DE_SPY`), como el resto de Spy, y va en la cabecera, nunca en la url.
// ⚠️ CON VARIAS CLAVES (5/11/2026, `clavesApifyDeSpy`): una corrida se EMPIEZA con la primera que tenga crédito (lib/spy-claves.ts)
// y se anota con qué clave (`TareaLarga.clave`, su huella): lo que empezó una cuenta de Apify sólo lo lee esa cuenta. La reserva
// de Spy se cuenta sobre el crédito libre de TODAS (`ajustarAlCredito` con el total).
// ⚠️ LOS ANUNCIOS VAN POR APIFY Y NO POR LA EXTENSIÓN, a propósito (docs/diseno-competitors-spy.md §14): el actor lee la
// Biblioteca pública desde sus servidores, sin la sesión de Facebook de nadie. Recorrerla «toda» con la extensión sería
// automatizar la cuenta de Facebook DEL CLIENTE, y eso es lo que pone en riesgo su cuenta.
// =============================================================================

import { piezasDeApify } from './instagram-perfil';
import { clavesApifyDeSpy } from './instagram-perfil-server';
import { claveDeHuella, conLaPrimeraConCredito, type ClaveApify } from './spy-claves';
import { cambiarSettingSi, getSettingEstricto } from './settings';
import { guardarVistas, leerCompetidor, vistaDeInstagram } from './spy';
import { rellenarMiniaturas } from './spy-miniaturas-relleno';
import { anunciosDeQuien, piezaDeAnuncio } from './spy-captura';
import { busquedasDeSusAnuncios, enlaceSusAnuncios } from './spy-funnel';
import {
  ANUNCIOS_POR_APIFY, ANUNCIOS_POR_CORRIDA, APIFY_ACTOR_ANUNCIOS, ajustarAlCredito, creditoDeApify, creditoTotal, esFaltaDeCredito, APIFY_ACTOR_PUBLICACIONES, CLAVE_DIA, CLAVE_DIA_TRANSCRIPCIONES,
  CLAVE_TAREAS, CORRIDAS_LARGAS_POR_DIA, TRANSCRIPCIONES_POR_DIA, USD_POR_ANUNCIO, USD_POR_PUBLICACION, anuncioDeApify,
  entradaDeAnuncios, entradaDePublicaciones, entradaDeUnaPublicacion, estadoDeCorrida, leerTareas, paginaDeSusAnuncios, pedidoDePublicaciones,
  siguienteDeAnuncios, tocaPedir, usadasHoy, videoDelItem, type CreditoApify, type TareaLarga, type TareasDeCompetidor,
} from './spy-todo-reglas';
import { getTenantDb } from './workspace';

const API = 'https://api.apify.com/v2';
const TOPE_MS = 20_000;
/** Cuántos ítems se leen del dataset como mucho: los mismos que se pidieron, con margen. */
const ITEMS_DEL_DATASET = 1_000;

const hoy = () => new Date().toISOString().slice(0, 10);
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export type EstadoTodo = {
  enMarcha: boolean; nuevas: number; porque?: string;
  /** Sus anuncios: 'no-pauta' = se probaron todas sus búsquedas y no pauta (un dato, no un error); con la fecha en que se miró. */
  anuncios?: 'no-pauta';
  anunciosMirados?: string;
};

type Canal = keyof TareasDeCompetidor;

async function apify(token: string, ruta: string, init?: { method: 'POST'; cuerpo: unknown }): Promise<{ status: number; cuerpo: unknown }> {
  const r = await fetch(`${API}${ruta}`, {
    method: init?.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(init ? { 'Content-Type': 'application/json' } : {}) },
    ...(init ? { body: JSON.stringify(init.cuerpo) } : {}),
    signal: AbortSignal.timeout(TOPE_MS), cache: 'no-store',
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

/** Escribe la tarea de UN canal de UN competidor sin pisar las demás (compare-and-set, un reintento). */
async function anotar(id: number, canal: Canal, t: TareaLarga): Promise<void> {
  for (let vuelta = 0; vuelta < 2; vuelta += 1) {
    const crudo = await getSettingEstricto(CLAVE_TAREAS);
    const r = leerTareas(crudo);
    r[String(id)] = { ...(r[String(id)] ?? {}), [canal]: t };
    if (await cambiarSettingSi(CLAVE_TAREAS, crudo, JSON.stringify(r))) return;
  }
}

/**
 * Reserva una corrida larga del día del negocio. ⚠️ LA CUENTA VIVE EN LA BASE (`spy.todo.dia`), NO EN LA MEMORIA DEL PROCESO
 * (4/11/2026): con el cron de cada hora, cada vuelta puede caer en una instancia nueva, y un contador en memoria arrancaba en
 * cero en cada una — el tope de 6 por día dejaba de ser un tope sobre la clave del negocio. Compare-and-set: de dos que
 * compiten por la última, gana una. «No pude leer» tira (lo ataja `avanzarTodo`) y no gasta.
 */
async function reservarCorrida(clave = CLAVE_DIA, tope = CORRIDAS_LARGAS_POR_DIA): Promise<boolean> {
  for (let vuelta = 0; vuelta < 3; vuelta += 1) {
    const crudo = await getSettingEstricto(clave);
    const usadas = usadasHoy(crudo, hoy());
    if (usadas >= tope) return false;
    if (await cambiarSettingSi(clave, crudo, JSON.stringify({ fecha: hoy(), usadas: usadas + 1 }))) return true;
  }
  return false;
}

/** Una del tope del día de `clave` (el guion de un video de YouTube: `CLAVE_DIA_GUIONES_YT`). Compare-and-set en la base. */
export const reservarDelDia = (clave: string, tope: number): Promise<boolean> => reservarCorrida(clave, tope);

/** El crédito del mes de UNA cuenta de Apify del negocio. null = no se pudo saber (no es «sin crédito»). */
async function creditoDelMes(token: string): Promise<CreditoApify | null> {
  const r = await apify(token, '/users/me/limits').catch(() => null);
  return r && r.status === 200 ? creditoDeApify(r.cuerpo) : null;
}

/** El crédito de cada clave, en el mismo orden (`/users/me/limits` no corre ningún actor: no gasta). */
const creditosDelMes = (claves: readonly ClaveApify[]): Promise<Array<CreditoApify | null>> => Promise.all(claves.map((k) => creditoDelMes(k.token)));

type Pedido = { cuantas: number; desde: string | null; techoUsd: number };
type Corrida = { run: string; dataset: string; clave: string };

/** El pedido de EMPEZAR una corrida, crudo (estado y cuerpo): lo mira la rotación de claves. Un corte de red vuelve con estado 0. */
async function pedirCorrida(token: string, actor: string, entrada: unknown, maxItems: number, techoUsd: number): Promise<{ status: number; cuerpo: unknown }> {
  const q = new URLSearchParams({ maxItems: String(maxItems), maxTotalChargeUsd: String(techoUsd) });
  return apify(token, `/acts/${actor}/runs?${q}`, { method: 'POST', cuerpo: entrada }).catch(() => ({ status: 0, cuerpo: null }));
}

/**
 * Lo que dejó el intento de empezar, con la primera clave que tenía crédito (lib/spy-claves.ts). null = no se pudo (sin
 * permiso, Apify caído): se vuelve a intentar otro día. 'sin-credito' = TODAS las claves dijeron que no tienen crédito: tampoco
 * se insiste, y la pantalla se lo dice sólo al admin. La corrida lleva la HUELLA de la clave que la empezó: sólo ésa la lee.
 */
function corridaDe(actor: string, r: { status: number; cuerpo: unknown; clave: ClaveApify } | null): Corrida | 'sin-credito' | null {
  const d = (r?.cuerpo as { data?: { id?: unknown; defaultDatasetId?: unknown } } | null)?.data;
  if (!r || r.status < 200 || r.status >= 300 || typeof d?.id !== 'string' || typeof d?.defaultDatasetId !== 'string') {
    console.error(`[spy-todo] no pude empezar ${actor}: HTTP ${r?.status ?? '—'} (clave ${r?.clave.slot ?? '—'})`);
    return r && esFaltaDeCredito(r.status, r.cuerpo) ? 'sin-credito' : null;
  }
  return { run: d.id, dataset: d.defaultDatasetId, clave: r.clave.huella };
}

/** Lo que cada clave puede pedir: la reserva de Spy va sobre el crédito de TODAS; las que no alcanzan, afuera. */
function pedidosConCredito(claves: readonly ClaveApify[], pedidos: ReadonlyArray<Pedido | null>): { conCredito: ClaveApify[]; pedidoDe: (k: ClaveApify) => Pedido } {
  const por = new Map<string, Pedido>();
  claves.forEach((k, i) => { const p = pedidos[i]; if (p) por.set(k.huella, p); });
  return { conCredito: claves.filter((k) => por.has(k.huella)), pedidoDe: (k) => por.get(k.huella) as Pedido };
}

/** Una corrida en marcha cuya clave ya no está (la quitaron): no se puede leer. Se olvida y se vuelve a pedir mañana. */
const SIN_SU_CLAVE = 'La clave de Apify con que lo pedí ya no está: vuelvo a intentar mañana';

/** Lo que una corrida dejó en su dataset. null si no se pudo leer. */
async function leerDataset(token: string, dataset: string): Promise<unknown[] | null> {
  const r = await apify(token, `/datasets/${dataset}/items?clean=true&format=json&limit=${ITEMS_DEL_DATASET}`).catch(() => null);
  return r && r.status === 200 && Array.isArray(r.cuerpo) ? r.cuerpo : null;
}

/** Guarda lo que trajo una corrida de Instagram. Devuelve cuántas piezas eran nuevas. (Los anuncios van por `pasoDeAnuncios`.) */
async function guardarLoTraido(id: number, items: unknown[]): Promise<number> {
  const vistas = piezasDeApify(items).map(vistaDeInstagram);
  if (!vistas.length) return 0;
  const gv = await guardarVistas(id, vistas);
  return gv.error ? 0 : gv.nuevas;
}

type CompetidorLeido = NonNullable<Awaited<ReturnType<typeof leerCompetidor>>>;

/**
 * Un paso de sus ANUNCIOS (4/11/2026, prendido con la medición del Cerebro): mirar la corrida en marcha o empezar una.
 *
 * ⚠️ NADA SE GUARDA SIN VERIFICAR DE QUIÉN ES. Buscar por palabra trae a quien lo menciona (por «Alex Hormozi», el primero era de la
 * Página «Skool»): cada anuncio pasa por `anunciosDeQuien`. Sólo una corrida que fue por SU Página (`view_all_page_id`, con el id
 * que tiene hoy) se toma entera. Y su Página se APRENDE de los verificados (`paginaDeSusAnuncios`): la próxima va directo.
 * Si no hay ninguno suyo, se prueba su otra búsqueda (su @, su web: `busquedasDeSusAnuncios`); probadas todas, no pauta, y eso
 * se dice en su lugar. Una corrida vacía cuesta US$0.
 */
async function pasoDeAnuncios(claves: readonly ClaveApify[], c: CompetidorLeido, t: TareaLarga | undefined): Promise<EstadoTodo> {
  const busquedas = busquedasDeSusAnuncios(c);
  const suPagina = /^\d{5,25}$/.test(c.pagina_anuncios ?? '') ? (c.pagina_anuncios as string) : null;
  const ahora = () => new Date().toISOString();
  const noPauta = (cuando?: string) => (cuando ? { anuncios: 'no-pauta' as const, anunciosMirados: cuando } : {});
  if (t?.run && t.dataset) {
    // La lee la clave que la empezó (varias claves, 5/11/2026). Si la quitaron, se olvida y se vuelve a pedir mañana.
    const token = claveDeHuella(claves, t.clave)?.token;
    if (!token) {
      await anotar(c.id, 'anuncios', { ...(t.sinAnuncios ? { sinAnuncios: t.sinAnuncios } : {}), ultima: new Date(Date.now() - 6 * 86_400_000).toISOString() });
      return { enMarcha: false, nuevas: 0, porque: SIN_SU_CLAVE, ...noPauta(t.sinAnuncios) };
    }
    const r = await apify(token, `/actor-runs/${t.run}`).catch(() => null);
    const status = String((r?.cuerpo as { data?: { status?: unknown } } | null)?.data?.status ?? '');
    if (!r || r.status !== 200 || !status) return { enMarcha: true, nuevas: 0 };
    if (estadoDeCorrida(status) === 'corre') return { enMarcha: true, nuevas: 0 };
    const items = await leerDataset(token, t.dataset);
    if (items == null) return { enMarcha: true, nuevas: 0 };
    const leidos = items.map(anuncioDeApify).filter((a): a is NonNullable<typeof a> => !!a);
    const porSuPagina = !!t.pagina && t.pagina === suPagina;
    const { suyos, otros } = anunciosDeQuien(leidos, c, porSuPagina);
    if (otros) console.info(`[spy-todo] competidor=${c.id} anuncios: ${otros} de otras Páginas no se guardaron`);
    const sigue = siguienteDeAnuncios({ suyos: suyos.length, busqueda: t.busqueda ?? 0, busquedas: busquedas.length, porPagina: !!t.pagina });
    if (sigue.que === 'guardar') {
      const gv = await guardarVistas(c.id, suyos.map(piezaDeAnuncio));
      const aprendida = suPagina ? null : paginaDeSusAnuncios(suyos);
      if (aprendida) {
        await (await getTenantDb()).from('spy_competidores').update({ pagina_anuncios: aprendida, updated_at: ahora() }).eq('id', c.id);
      }
      await anotar(c.id, 'anuncios', { ultima: ahora() });
      return { enMarcha: false, nuevas: gv.error ? 0 : gv.nuevas };
    }
    if (sigue.que === 'probar') {
      // Sin `ultima`: la próxima vuelta (la pantalla pregunta cada 20 s) la empieza con su otra búsqueda.
      await anotar(c.id, 'anuncios', { busqueda: sigue.busqueda, ...(t.sinAnuncios ? { sinAnuncios: t.sinAnuncios } : {}) });
      return { enMarcha: true, nuevas: 0 };
    }
    const hoyMirado = ahora();
    await anotar(c.id, 'anuncios', { ultima: hoyMirado, sinAnuncios: hoyMirado });
    return { enMarcha: false, nuevas: 0, ...noPauta(hoyMirado) };
  }
  if (!tocaPedir(t, Date.now())) return { enMarcha: false, nuevas: 0, ...noPauta(t?.sinAnuncios) };
  if (!suPagina && !busquedas.length) return { enMarcha: false, nuevas: 0 };
  // ⚠️ EL CRÉDITO DEL MES MANDA (plan FREE: US$5): la corrida se achica a lo que deja libre, o espera. Con varias claves, la reserva
  // va sobre el crédito de TODAS y la corrida corre en UNA: la primera que alcanza.
  const creditos = await creditosDelMes(claves);
  const total = creditoTotal(creditos);
  const base: Pedido = { cuantas: ANUNCIOS_POR_CORRIDA, desde: null, techoUsd: Math.max(0.1, Math.round(ANUNCIOS_POR_CORRIDA * USD_POR_ANUNCIO * 100) / 100) };
  const { conCredito, pedidoDe } = pedidosConCredito(claves, claves.map((_, k) => ajustarAlCredito(base, creditos[k], total)));
  if (!conCredito.length) return { enMarcha: false, nuevas: 0, porque: 'sin-credito', ...noPauta(t?.sinAnuncios) };
  if (!(await reservarCorrida())) return { enMarcha: false, nuevas: 0, porque: 'limite', ...noPauta(t?.sinAnuncios) };
  const i = Math.min(t?.busqueda ?? 0, Math.max(0, busquedas.length - 1));
  const enlace = enlaceSusAnuncios(c, suPagina ? undefined : busquedas[i]);
  // ⚠️ LO QUE DEJA EL CRÉDITO, no `ANUNCIOS_POR_CORRIDA`: `ajustarAlCredito` achica `cuantas` y el techo juntos.
  const corrida = corridaDe(APIFY_ACTOR_ANUNCIOS, await conLaPrimeraConCredito(conCredito, (k) => {
    const pedido = pedidoDe(k);
    return pedirCorrida(k.token, APIFY_ACTOR_ANUNCIOS, entradaDeAnuncios(enlace, pedido.cuantas), pedido.cuantas, pedido.techoUsd);
  }));
  if (corrida === 'sin-credito') return { enMarcha: false, nuevas: 0, porque: 'sin-credito', ...noPauta(t?.sinAnuncios) };
  if (!corrida) {
    await anotar(c.id, 'anuncios', { ...(t ?? {}), ultima: new Date(Date.now() - 6 * 86_400_000).toISOString() });
    return { enMarcha: false, nuevas: 0, ...noPauta(t?.sinAnuncios) };
  }
  await anotar(c.id, 'anuncios', {
    ...corrida, pedidaEn: ahora(), busqueda: i,
    ...(suPagina ? { pagina: suPagina } : {}),
    ...(t?.ultima ? { ultima: t.ultima } : {}),
    ...(t?.sinAnuncios ? { sinAnuncios: t.sinAnuncios } : {}),
  });
  return { enMarcha: true, nuevas: 0, ...noPauta(t?.sinAnuncios) };
}

/** Un paso de un canal: mirar la corrida en marcha, o empezar una si toca. */
async function pasoDeCanal(claves: readonly ClaveApify[], c: CompetidorLeido, canal: Canal, t: TareaLarga | undefined): Promise<EstadoTodo> {
  if (canal === 'anuncios') return pasoDeAnuncios(claves, c, t);
  if (t?.run && t.dataset) {
    // La lee la clave que la empezó (varias claves, 5/11/2026). Si la quitaron, se olvida y se vuelve a pedir mañana.
    const token = claveDeHuella(claves, t.clave)?.token;
    if (!token) {
      await anotar(c.id, canal, { ultima: new Date(Date.now() - 6 * 86_400_000).toISOString() });
      return { enMarcha: false, nuevas: 0, porque: SIN_SU_CLAVE };
    }
    const r = await apify(token, `/actor-runs/${t.run}`).catch(() => null);
    const status = String((r?.cuerpo as { data?: { status?: unknown } } | null)?.data?.status ?? '');
    // No poder preguntar no es «terminó»: se vuelve a preguntar.
    if (!r || r.status !== 200 || !status) return { enMarcha: true, nuevas: 0 };
    const e = estadoDeCorrida(status);
    if (e === 'corre') return { enMarcha: true, nuevas: 0 };
    // Terminada (bien o cortada por tiempo o por el techo): se guarda lo que haya, y la próxima es en una semana.
    const items = await leerDataset(token, t.dataset);
    if (items == null) return { enMarcha: true, nuevas: 0, porque: 'No pude leer lo que trajo: vuelvo a intentar' };
    const nuevas = await guardarLoTraido(c.id, items);
    // ⚠️ UNA CORRIDA QUE TERMINA SIN NADA NO CUENTA COMO HECHA (4/11/2026). Apify contesta «terminé» también cuando
    // Instagram no le dio nada (los ítems vienen como `{ error, errorDescription }`): anotarla como la de la semana dejaba
    // al competidor con lo de la lectura de siempre (12) por siete días, sin que nada lo dijera. Se vuelve a pedir mañana.
    const trajo = piezasDeApify(items).length;
    if (!trajo) {
      const primero = items[0] as { error?: unknown; errorDescription?: unknown } | undefined;
      console.error(`[spy-todo] competidor=${c.id} ${canal}: la corrida ${t.run} terminó (${status}) sin nada: ${String(primero?.errorDescription ?? primero?.error ?? 'vacía')}`);
      await anotar(c.id, canal, { ultima: new Date(Date.now() - 6 * 86_400_000).toISOString() });
      return { enMarcha: false, nuevas: 0, porque: 'Apify no trajo sus publicaciones: vuelvo a intentar mañana' };
    }
    await anotar(c.id, canal, { ultima: new Date().toISOString() });
    return { enMarcha: false, nuevas };
  }
  if (!tocaPedir(t, Date.now())) return { enMarcha: false, nuevas: 0 };
  // ⚠️ EL CRÉDITO DEL MES MANDA (4/11/2026): la traída larga se achica a lo que deja libre, o espera. Antes de gastar la
  // corrida del día: sin crédito no se reserva nada. Con varias claves (5/11/2026), la reserva sobre el crédito de TODAS.
  const creditos = await creditosDelMes(claves);
  const total = creditoTotal(creditos);
  const { conCredito, pedidoDe } = pedidosConCredito(claves, claves.map((_, k) => ajustarAlCredito(pedidoDePublicaciones(t), creditos[k], total)));
  if (!conCredito.length) return { enMarcha: false, nuevas: 0, porque: 'sin-credito' };
  if (!(await reservarCorrida())) return { enMarcha: false, nuevas: 0, porque: 'limite' };

  const corrida = corridaDe(APIFY_ACTOR_PUBLICACIONES, await conLaPrimeraConCredito(conCredito, (k) => {
    const pedido = pedidoDe(k);
    return pedirCorrida(k.token, APIFY_ACTOR_PUBLICACIONES, entradaDePublicaciones(c.instagram as string, pedido), pedido.cuantas, pedido.techoUsd);
  }));
  if (corrida === 'sin-credito') return { enMarcha: false, nuevas: 0, porque: 'sin-credito' };
  if (!corrida) {
    // Sin poder empezar (sin saldo, sin permiso): no se insiste hasta mañana.
    await anotar(c.id, canal, { ...(t ?? {}), ultima: new Date(Date.now() - 6 * 86_400_000).toISOString() });
    return { enMarcha: false, nuevas: 0, porque: 'No pude pedírselo a Apify' };
  }
  await anotar(c.id, canal, { ...corrida, pedidaEn: new Date().toISOString(), ...(t?.ultima ? { ultima: t.ultima } : {}) });
  return { enMarcha: true, nuevas: 0 };
}

/** ¿El negocio tiene alguna clave de Spy? Sin ninguna no se pide nada a Apify, y la pantalla lo dice. «No pude leer» es que sí. */
export async function tieneClaveDeSpy(ws: number): Promise<boolean> {
  const claves = await clavesApifyDeSpy(ws).catch(() => null);
  return claves == null || claves.length > 0;
}

/**
 * El video FRESCO de UNA publicación, para transcribir su guion (4/11/2026, lib/spy-transcripcion.ts). El enlace del CDN de
 * Instagram vence en días, así que no se guarda al leer: se pide al abrir el detalle. Con la clave de Spy del negocio, su
 * tope del día (`TRANSCRIPCIONES_POR_DIA`, contado en la base) y el techo de una publicación. Nunca tira.
 */
export async function videoDeUnaPublicacion(ws: number, enlace: string): Promise<{ ok: true; url: string } | { ok: false; motivo: 'sin-clave' | 'limite' | 'no-esta' | 'fallo' }> {
  try {
    const claves = await clavesApifyDeSpy(ws);
    if (!claves.length) return { ok: false, motivo: 'sin-clave' };
    if (!(await reservarCorrida(CLAVE_DIA_TRANSCRIPCIONES, TRANSCRIPCIONES_POR_DIA))) return { ok: false, motivo: 'limite' };
    const techo = Math.max(0.01, Math.ceil(USD_POR_PUBLICACION * 3 * 100) / 100);
    const q = new URLSearchParams({ maxItems: '1', maxTotalChargeUsd: String(techo), timeout: '90' });
    // Varias claves (5/11/2026): la primera con crédito; un «sin crédito» pasa a la siguiente (lib/spy-claves.ts).
    const r = await conLaPrimeraConCredito(claves, async ({ token }) => {
      const res = await fetch(`${API}/acts/${APIFY_ACTOR_PUBLICACIONES}/run-sync-get-dataset-items?${q}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(entradaDeUnaPublicacion(enlace)), signal: AbortSignal.timeout(100_000), cache: 'no-store',
      });
      return { status: res.status, cuerpo: await res.json().catch(() => null) };
    });
    if (!r || r.status < 200 || r.status >= 300) {
      console.error(`[spy-todo] no pude traer el video de ${enlace}: HTTP ${r?.status ?? '—'} (clave ${r?.clave.slot ?? '—'})`);
      return { ok: false, motivo: 'fallo' };
    }
    const url = videoDelItem(r.cuerpo);
    return url ? { ok: true, url } : { ok: false, motivo: 'no-esta' };
  } catch (e) {
    console.error(`[spy-todo] no pude traer el video de ${enlace}: ${msg(e)}`);
    return { ok: false, motivo: 'fallo' };
  }
}

/**
 * Anota que la historia de su Instagram ya está, sin pedirla: la trajo otro camino (un sugerido de la plataforma copia
 * lo que ella ya leyó, lib/spy-sugeridos.ts). Así la traída larga no arranca ya con la clave del cliente; lo nuevo, a la
 * semana, como siempre.
 */
export async function marcarTraidaHoy(id: number): Promise<void> {
  await anotar(id, 'instagram', { ultima: new Date().toISOString() });
}

/**
 * Un paso de las corridas largas de un competidor. Nunca tira: si algo falla, la lectura de siempre sigue andando.
 * Lo llama /api/competitor-spy/todo, con la sesión y el negocio ya resueltos.
 */
export async function avanzarTodo(ws: number, id: number): Promise<EstadoTodo> {
  try {
    const c = await leerCompetidor(id);
    if (!c) return { enMarcha: false, nuevas: 0 };
    // Las miniaturas que la traída anterior no alcanzó a bajar, mientras su URL sirve (no gasta la clave de Spy: es el CDN de la red).
    await rellenarMiniaturas(id);
    // Las claves de Spy del negocio, en orden (5/11/2026): la corrida nueva, con la primera con crédito; la que está en marcha,
    // con la que la empezó.
    const claves = await clavesApifyDeSpy(ws);
    if (!claves.length) return { enMarcha: false, nuevas: 0, porque: 'sin-clave' };
    const tareas = leerTareas(await getSettingEstricto(CLAVE_TAREAS))[String(id)] ?? {};
    const canales: Canal[] = [...(c.instagram ? ['instagram' as const] : []), ...(ANUNCIOS_POR_APIFY ? ['anuncios' as const] : [])];
    let enMarcha = false;
    let nuevas = 0;
    let porque: string | undefined;
    let anuncios: Pick<EstadoTodo, 'anuncios' | 'anunciosMirados'> = {};
    for (const canal of canales) {
      const r = await pasoDeCanal(claves, c, canal, tareas[canal]);
      enMarcha ||= r.enMarcha;
      nuevas += r.nuevas;
      porque ??= r.porque;
      if (r.anuncios) anuncios = { anuncios: r.anuncios, anunciosMirados: r.anunciosMirados };
    }
    return { enMarcha, nuevas, ...(porque ? { porque } : {}), ...anuncios };
  } catch (e) {
    console.error(`[spy-todo] ws=${ws} competidor=${id}: ${msg(e)}`);
    return { enMarcha: false, nuevas: 0 };
  }
}
