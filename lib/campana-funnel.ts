// =============================================================================
// campana-funnel — a qué EMBUDO entra un lead según su campaña de Meta
// =============================================================================
// El gemelo de `lib/landing-funnel.ts`, con sus dos reglas no obvias copiadas tal
// cual porque fallan igual acá:
//
//   1. SE VALIDA CONTRA LOS EMBUDOS VIVOS. `leads.funnel_id` referencia `funnels(id)`,
//      así que un id de un embudo borrado haría FALLAR el insert — y en el webhook de
//      Meta un insert que falla es un lead que se pierde (el webhook contesta 200 y
//      Meta no reintenta).
//   2. EL EMBUDO DEL NEGOCIO SE ESCRIBE COMO `null`, NUNCA CON SU ID. El tablero por
//      defecto pide sus leads con `.is('funnel_id', null)`: un lead nacido con el id
//      del default DESAPARECE del único tablero que el cliente mira, con el producto
//      correcto escrito en la fila y sin un solo error.
//
// ⚠️ LO QUE ESTO NO HACE: MOVER a un lead que ya existe. Si la misma persona vuelve a
// entrar por una campaña de OTRO producto, se queda en su tablero y queda escrito en su
// historial por dónde volvió (lo hace `upsertLeadFromMeta`). El lead tiene un solo
// `funnel_id`, y sacarlo del tablero donde lo están trabajando —con su etapa, su
// closer, quizás ya Ganado— porque vio otro anuncio es destructivo y nadie lo pidió.
// Que una persona esté en dos productos a la vez es otro modelo (una fila por
// participación), y está anotado como lo que falta en docs/hallazgos-crm.md.
// =============================================================================

import 'server-only';
import { getSetting, getSettingEstricto, setSetting } from './settings';
import { getTenantDb } from './workspace';
import { productosAsignables } from './landing-funnel';
import {
  CONFIG_KEY, parsearCampanas, funnelIdDeCampana, esIdMeta, conCampana, sinCampana, funnelsDeAsignada, MAX_TAMBIEN,
  type CampanaAsignada,
} from './campana-config';

/** Lectura TOLERANTE: un error da `[]`. Es la del RUTEO, donde no poder leer tiene que
 *  dejar entrar al lead como entraría sin asignaciones. */
export async function leerCampanasAsignadas(): Promise<CampanaAsignada[]> {
  return parsearCampanas(await getSetting(CONFIG_KEY));
}

/**
 * Lectura ESTRICTA: un error TIRA. Es la de las ESCRITURAS, y la diferencia no es de
 * estilo: asignar es leer-modificar-escribir el setting entero, así que una lectura
 * caída leída como `[]` guardaría `[la nueva]` y BORRARÍA todas las demás asignaciones
 * del workspace — con sus leads cayendo desde ese momento al tablero equivocado y sin
 * un error en pantalla. Lo encontró la revisión adversarial del 05/10/2026, y la
 * función que lo evita ya existía para exactamente esto (lib/settings.ts).
 */
export async function leerCampanasAsignadasEstricto(): Promise<CampanaAsignada[]> {
  return parsearCampanas(await getSettingEstricto(CONFIG_KEY));
}

export async function guardarCampanasAsignadas(lista: CampanaAsignada[]): Promise<void> {
  await setSetting(CONFIG_KEY, JSON.stringify(lista));
}

/**
 * El conjunto de un anuncio, sacado de las métricas que ya están en la base.
 *
 * Existe por el opt-in de la landing: ahí no viaja el conjunto, viaja el ANUNCIO (en
 * `utm_content`). Sin esto, asignar un conjunto enrutaba los leads del formulario de
 * Meta y no los de la landing de esa misma campaña — el mismo conjunto mandando a dos
 * productos según la puerta (revisión adversarial del 05/10/2026).
 *
 * `marketing_metrics_daily` tiene `ad_id` y `adset_id` en la misma fila desde la 0009,
 * así que no hace falta llamar a Meta en una ruta pública. El límite, dicho: un
 * anuncio que todavía no tiene un día de métricas no está, y ese lead se enruta por
 * la campaña.
 */
async function conjuntoDeAnuncio(adId: string): Promise<string | null> {
  try {
    const db = await getTenantDb();
    const { data } = await db.from('marketing_metrics_daily')
      .select('adset_id').eq('ad_id', adId).not('adset_id', 'is', null).limit(1);
    const id = (data?.[0] as { adset_id?: string | null } | undefined)?.adset_id;
    return esIdMeta(id) ? id : null;
  } catch {
    return null;
  }
}

/**
 * El embudo de un lead que vino de esta campaña, conjunto y/o anuncio.
 *
 * ⚠️ LEE EL WORKSPACE DEL CONTEXTO, y es a propósito: sus llamadores
 * (`upsertLeadFromMeta` y el opt-in de la landing) corren adentro de
 * `runWithWorkspace(ws)` y escriben el lead con `getTenantDb()`, que resuelve ESE MISMO
 * contexto. Pasar un `ws` aparte sería abrir la posibilidad de que el ruteo pregunte
 * por un inquilino y el insert escriba en otro.
 *
 * Devuelve `asignada: false` si nadie asignó nada que toque estos ids, para que quien
 * llama pueda dejar decidir a otra regla.
 */
export async function funnelDeCampana(origen: {
  campaignId?: string | null;
  adsetId?: string | null;
  /** El anuncio, para derivar el conjunto cuando no viene (el opt-in de la landing). */
  adId?: string | null;
}): Promise<{ asignada: false } | { asignada: true; funnelId: number | null; otros: number[]; nombre: string; producto: string }> {
  // Sin ningún id de Meta no hay nada que buscar: ni se lee el setting. Es el caso de
  // casi todo lead que no viene de Meta, y no tiene por qué pagar una consulta.
  const campaignId = esIdMeta(origen.campaignId) ? origen.campaignId.trim() : null;
  let adsetId = esIdMeta(origen.adsetId) ? origen.adsetId.trim() : null;
  const adId = esIdMeta(origen.adId) ? origen.adId.trim() : null;
  if (!campaignId && !adsetId && !adId) return { asignada: false };
  try {
    const asignadas = await leerCampanasAsignadas();
    if (!asignadas.length) return { asignada: false };

    // El conjunto desde el anuncio, SÓLO si hay un conjunto asignado que pueda ser éste.
    // Sin esa condición, cada opt-in pagaría una consulta para no encontrar nada.
    if (!adsetId && adId && asignadas.some((c) => c.tipo === 'conjunto' && (!campaignId || c.campanaId === campaignId))) {
      adsetId = await conjuntoDeAnuncio(adId);
    }

    // Chequeo barato, sin consultar embudos: si nada asignado toca estos ids, listo.
    if (!funnelIdDeCampana(asignadas, { campaignId, adsetId }).asignada) return { asignada: false };

    // Recién acá se consultan los embudos, y se filtra ANTES de la precedencia: una
    // asignación a un producto archivado no decide, y tampoco tapa a la de su campaña.
    const vivos = await productosAsignables();
    const def = vivos.find((f) => f.esDefault) ?? null;
    const esViva = (id: number | null) => (id == null ? def != null : vivos.some((f) => f.id === id));
    const r = funnelIdDeCampana(asignadas, { campaignId, adsetId }, esViva);
    if (!r.asignada) return { asignada: false };
    const elegido = r.funnelId == null ? def : vivos.find((f) => f.id === r.funnelId) ?? null;
    if (!elegido) return { asignada: false };
    // Los otros funnels (#893) con su id REAL, que es como los guarda `lead_funnel` (el del
    // negocio también): quien llama los AGREGA con `agregarAProducto`, nunca los escribe en la casa.
    const otros = [...new Set(r.tambien
      .map((f) => (f == null ? def?.id ?? null : f))
      .filter((f): f is number => f != null && f !== elegido.id))];
    return {
      asignada: true,
      funnelId: elegido.esDefault ? null : elegido.id,
      otros,
      nombre: r.por.nombre,
      producto: elegido.nombre,
    };
  } catch (e) {
    // Tolerante, como `funnelDeLanding`: sin poder leer la configuración, el lead entra
    // donde entraría sin ella. Un lead en el tablero equivocado se mueve; uno perdido no.
    console.error('[campana-funnel] no se pudo resolver el producto de la campaña:', e instanceof Error ? e.message : e);
    return { asignada: false };
  }
}

/** Una asignación como la lee MaKo: cada funnel con su id REAL de embudo y su nombre, la casa primero. */
export type CampanaParaMaKo = { tipo: 'campana' | 'conjunto'; id: string; nombre: string; campanaId?: string; funnels: Array<{ embudoId: number; crm: string }> };

/** Las asignaciones con sus funnels por nombre (la API de MaKo, `ver_campanas_funnels`). Estricta: un error tira. */
export async function campanasParaMaKo(): Promise<{ asignadas: CampanaParaMaKo[]; funnels: Array<{ embudoId: number; crm: string }> }> {
  const [asignadas, vivos] = await Promise.all([leerCampanasAsignadasEstricto(), productosAsignables()]);
  const def = vivos.find((f) => f.esDefault) ?? null;
  const de = (id: number | null) => (id == null ? def : vivos.find((f) => f.id === id) ?? null);
  return {
    asignadas: asignadas.map((c) => ({
      tipo: c.tipo, id: c.id, nombre: c.nombre, ...(c.campanaId ? { campanaId: c.campanaId } : {}),
      funnels: funnelsDeAsignada(c).map(de).filter((f): f is NonNullable<typeof f> => !!f).map((f) => ({ embudoId: f.id, crm: f.nombre })),
    })),
    funnels: vivos.map((f) => ({ embudoId: f.id, crm: f.nombre })),
  };
}

/**
 * Deja una campaña o un conjunto yendo a ESTOS funnels (#893), por su id REAL de embudo: el primero es la casa del
 * lead y los demás lo suman. Vacío = sin asignar. Es lo que hace la API de MaKo (`asignar_campana_funnels`); la
 * pantalla va casilla por casilla (app/crm/campanas-actions.ts). No trae a los leads que ya entraron: sólo cambia a
 * dónde van los nuevos. Devuelve cómo estaba, para deshacer.
 */
export async function asignarCampanaAFunnels(
  item: { tipo: 'campana' | 'conjunto'; id: string; nombre?: string; campanaId?: string },
  embudoIds: readonly number[],
): Promise<{ ok: true; antes: CampanaAsignada | null; despues: CampanaAsignada | null } | { ok: false; error: string }> {
  if (!esIdMeta(item.id)) return { ok: false, error: 'Ese id no es de Meta.' };
  if (item.tipo === 'conjunto' && item.campanaId != null && !esIdMeta(item.campanaId)) return { ok: false, error: 'El id de la campaña madre no es de Meta.' };
  const ids = [...new Set(embudoIds)];
  if (ids.length > MAX_TAMBIEN + 1) return { ok: false, error: `Como mucho ${MAX_TAMBIEN + 1} funnels.` };
  const vivos = await productosAsignables();
  const faltan = ids.filter((id) => !vivos.some((f) => f.id === id));
  if (faltan.length) return { ok: false, error: `No existe el embudo ${faltan.join(', ')}. Pide ver_campanas_funnels.` };
  // El del negocio se guarda como `null`, como en la casa del lead (ver la cabecera).
  const comoSeGuarda = (id: number) => (vivos.find((f) => f.id === id)?.esDefault ? null : id);
  const actuales = await leerCampanasAsignadasEstricto();
  const antes = actuales.find((c) => c.id === item.id.trim()) ?? null;
  if (!ids.length) {
    await guardarCampanasAsignadas(sinCampana(actuales, item.id.trim()));
    return { ok: true, antes, despues: null };
  }
  const [casa, ...resto] = ids.map(comoSeGuarda);
  const nueva = conCampana(actuales, {
    tipo: item.tipo, id: item.id.trim(), nombre: item.nombre?.trim() || antes?.nombre || item.id.trim(),
    ...(item.tipo === 'conjunto' && (item.campanaId ?? antes?.campanaId) ? { campanaId: (item.campanaId ?? antes?.campanaId)!.trim() } : {}),
    funnelId: casa, ...(resto.length ? { tambien: resto } : {}),
  });
  if (!nueva) return { ok: false, error: 'No se pudo armar la asignación.' };
  await guardarCampanasAsignadas(nueva);
  return { ok: true, antes, despues: nueva.find((c) => c.id === item.id.trim()) ?? null };
}
