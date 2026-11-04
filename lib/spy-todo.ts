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
// ⚠️ LOS ANUNCIOS VAN POR APIFY Y NO POR LA EXTENSIÓN, a propósito (docs/diseno-competitors-spy.md §14): el actor lee la
// Biblioteca pública desde sus servidores, sin la sesión de Facebook de nadie. Recorrerla «toda» con la extensión sería
// automatizar la cuenta de Facebook DEL CLIENTE, y eso es lo que pone en riesgo su cuenta.
// =============================================================================

import { credDelCliente } from './credenciales';
import { APIFY_CLAVE_DE_SPY, piezasDeApify } from './instagram-perfil';
import { cambiarSettingSi, getSettingEstricto } from './settings';
import { guardarVistas, leerCompetidor, vistaDeInstagram } from './spy';
import { anunciosDeQuien, piezaDeAnuncio } from './spy-captura';
import { enlaceSusAnuncios } from './spy-funnel';
import {
  ANUNCIOS_POR_APIFY, ANUNCIOS_POR_CORRIDA, APIFY_ACTOR_ANUNCIOS, APIFY_ACTOR_PUBLICACIONES, CLAVE_DIA, CLAVE_TAREAS,
  CORRIDAS_LARGAS_POR_DIA, USD_POR_ANUNCIO, anuncioDeApify, entradaDeAnuncios, entradaDePublicaciones, estadoDeCorrida,
  leerTareas, pedidoDePublicaciones, tocaPedir, usadasHoy, type TareaLarga, type TareasDeCompetidor,
} from './spy-todo-reglas';

const API = 'https://api.apify.com/v2';
const TOPE_MS = 20_000;
/** Cuántos ítems se leen del dataset como mucho: los mismos que se pidieron, con margen. */
const ITEMS_DEL_DATASET = 1_000;

const hoy = () => new Date().toISOString().slice(0, 10);
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export type EstadoTodo = { enMarcha: boolean; nuevas: number; porque?: string };

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
async function reservarCorrida(): Promise<boolean> {
  for (let vuelta = 0; vuelta < 3; vuelta += 1) {
    const crudo = await getSettingEstricto(CLAVE_DIA);
    const usadas = usadasHoy(crudo, hoy());
    if (usadas >= CORRIDAS_LARGAS_POR_DIA) return false;
    if (await cambiarSettingSi(CLAVE_DIA, crudo, JSON.stringify({ fecha: hoy(), usadas: usadas + 1 }))) return true;
  }
  return false;
}

/** Empieza una corrida. null = no se pudo (sin saldo, sin permiso, Apify caído): se vuelve a intentar otro día. */
async function empezar(token: string, actor: string, entrada: unknown, maxItems: number, techoUsd: number): Promise<{ run: string; dataset: string } | null> {
  const q = new URLSearchParams({ maxItems: String(maxItems), maxTotalChargeUsd: String(techoUsd) });
  const r = await apify(token, `/acts/${actor}/runs?${q}`, { method: 'POST', cuerpo: entrada }).catch(() => null);
  const d = (r?.cuerpo as { data?: { id?: unknown; defaultDatasetId?: unknown } } | null)?.data;
  if (!r || r.status < 200 || r.status >= 300 || typeof d?.id !== 'string' || typeof d?.defaultDatasetId !== 'string') {
    console.error(`[spy-todo] no pude empezar ${actor}: HTTP ${r?.status ?? '—'}`);
    return null;
  }
  return { run: d.id, dataset: d.defaultDatasetId };
}

/** Lo que una corrida dejó en su dataset. null si no se pudo leer. */
async function leerDataset(token: string, dataset: string): Promise<unknown[] | null> {
  const r = await apify(token, `/datasets/${dataset}/items?clean=true&format=json&limit=${ITEMS_DEL_DATASET}`).catch(() => null);
  return r && r.status === 200 && Array.isArray(r.cuerpo) ? r.cuerpo : null;
}

/** Guarda lo que trajo una corrida, por canal. Devuelve cuántas piezas eran nuevas. */
async function guardarLoTraido(id: number, canal: Canal, items: unknown[], c: NonNullable<Awaited<ReturnType<typeof leerCompetidor>>>): Promise<number> {
  if (canal === 'instagram') {
    const vistas = piezasDeApify(items).map(vistaDeInstagram);
    if (!vistas.length) return 0;
    const gv = await guardarVistas(id, vistas);
    return gv.error ? 0 : gv.nuevas;
  }
  // Los anuncios: sólo los de SU página (la búsqueda por nombre o dominio trae también de otros), como la extensión.
  const anuncios = items.map(anuncioDeApify).filter((a): a is NonNullable<typeof a> => !!a);
  const { suyos } = anunciosDeQuien(anuncios, c, /^\d+$/.test(c.pagina_anuncios ?? ''));
  if (!suyos.length) return 0;
  const gv = await guardarVistas(id, suyos.map(piezaDeAnuncio));
  return gv.error ? 0 : gv.nuevas;
}

/** Un paso de un canal: mirar la corrida en marcha, o empezar una si toca. */
async function pasoDeCanal(token: string, c: NonNullable<Awaited<ReturnType<typeof leerCompetidor>>>, canal: Canal, t: TareaLarga | undefined): Promise<EstadoTodo> {
  if (t?.run && t.dataset) {
    const r = await apify(token, `/actor-runs/${t.run}`).catch(() => null);
    const status = String((r?.cuerpo as { data?: { status?: unknown } } | null)?.data?.status ?? '');
    // No poder preguntar no es «terminó»: se vuelve a preguntar.
    if (!r || r.status !== 200 || !status) return { enMarcha: true, nuevas: 0 };
    const e = estadoDeCorrida(status);
    if (e === 'corre') return { enMarcha: true, nuevas: 0 };
    // Terminada (bien o cortada por tiempo o por el techo): se guarda lo que haya, y la próxima es en una semana.
    const items = await leerDataset(token, t.dataset);
    if (items == null) return { enMarcha: true, nuevas: 0, porque: 'No pude leer lo que trajo: vuelvo a intentar' };
    const nuevas = await guardarLoTraido(c.id, canal, items, c);
    // ⚠️ UNA CORRIDA QUE TERMINA SIN NADA NO CUENTA COMO HECHA (4/11/2026). Apify contesta «terminé» también cuando
    // Instagram no le dio nada (los ítems vienen como `{ error, errorDescription }`): anotarla como la de la semana dejaba
    // al competidor con lo de la lectura de siempre (12) por siete días, sin que nada lo dijera. Se vuelve a pedir mañana.
    const trajo = canal === 'instagram' ? piezasDeApify(items).length : items.length;
    if (!trajo) {
      const primero = items[0] as { error?: unknown; errorDescription?: unknown } | undefined;
      console.error(`[spy-todo] competidor=${c.id} ${canal}: la corrida ${t.run} terminó (${status}) sin nada: ${String(primero?.errorDescription ?? primero?.error ?? 'vacía')}`);
      await anotar(c.id, canal, { ultima: new Date(Date.now() - 6 * 86_400_000).toISOString() });
      return { enMarcha: false, nuevas: 0, porque: canal === 'instagram' ? 'Apify no trajo sus publicaciones: vuelvo a intentar mañana' : 'Apify no trajo sus anuncios: vuelvo a intentar mañana' };
    }
    await anotar(c.id, canal, { ultima: new Date().toISOString() });
    return { enMarcha: false, nuevas };
  }
  if (!tocaPedir(t, Date.now())) return { enMarcha: false, nuevas: 0 };
  if (!(await reservarCorrida())) return { enMarcha: false, nuevas: 0, porque: 'limite' };

  let corrida: { run: string; dataset: string } | null;
  if (canal === 'instagram') {
    const p = pedidoDePublicaciones(t);
    corrida = await empezar(token, APIFY_ACTOR_PUBLICACIONES, entradaDePublicaciones(c.instagram as string, p), p.cuantas, p.techoUsd);
  } else {
    const techo = Math.max(0.1, Math.round(ANUNCIOS_POR_CORRIDA * USD_POR_ANUNCIO * 100) / 100);
    corrida = await empezar(token, APIFY_ACTOR_ANUNCIOS, entradaDeAnuncios(enlaceSusAnuncios(c)), ANUNCIOS_POR_CORRIDA, techo);
  }
  if (!corrida) {
    // Sin poder empezar (sin saldo, sin permiso): no se insiste hasta mañana.
    await anotar(c.id, canal, { ...(t ?? {}), ultima: new Date(Date.now() - 6 * 86_400_000).toISOString() });
    return { enMarcha: false, nuevas: 0, porque: 'No pude pedírselo a Apify' };
  }
  await anotar(c.id, canal, { ...corrida, pedidaEn: new Date().toISOString(), ...(t?.ultima ? { ultima: t.ultima } : {}) });
  return { enMarcha: true, nuevas: 0 };
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
    const token = await credDelCliente(APIFY_CLAVE_DE_SPY, ws).catch(() => null);
    if (!token) return { enMarcha: false, nuevas: 0, porque: 'sin-clave' };
    const tareas = leerTareas(await getSettingEstricto(CLAVE_TAREAS))[String(id)] ?? {};
    const canales: Canal[] = [...(c.instagram ? ['instagram' as const] : []), ...(ANUNCIOS_POR_APIFY ? ['anuncios' as const] : [])];
    let enMarcha = false;
    let nuevas = 0;
    let porque: string | undefined;
    for (const canal of canales) {
      const r = await pasoDeCanal(token, c, canal, tareas[canal]);
      enMarcha ||= r.enMarcha;
      nuevas += r.nuevas;
      porque ??= r.porque;
    }
    return { enMarcha, nuevas, ...(porque ? { porque } : {}) };
  } catch (e) {
    console.error(`[spy-todo] ws=${ws} competidor=${id}: ${msg(e)}`);
    return { enMarcha: false, nuevas: 0 };
  }
}
