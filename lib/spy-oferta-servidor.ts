import 'server-only';

// =============================================================================
// spy-oferta-servidor — la oferta de un competidor: sus webs, el analista de Offer y la clave donde queda (4/11/2026)
// =============================================================================
// El lado del servidor de lib/spy-oferta.ts. Lo llaman la ruta /api/competitor-spy/oferta (la pantalla, sin botón) y la
// API de MaKo (`ver_oferta_competidor`, sólo lectura). Todo con el negocio YA resuelto en el contexto del pedido.
//
// ⚠️ SUS WEBS SE BAJAN COMO EN OFFER (`leerLink`, app/api/offer/route.ts): `extraerLanding(url, { talCual: true })`, que es
// la única puerta SSRF-segura a una URL de afuera, y si un antibots frena a los servidores o la página casi no tiene texto,
// el lector de afuera (lib/offer-lector-externo.ts, sólo con una URL pública). No hay otro `fetch` de URLs acá.
//
// ⚠️ LA IA ES LA DEL NEGOCIO (`soloDelNegocio`): sin crédito de Claude de la plataforma y sin red de plataforma. Quien
// llama corre esto adentro de `conSuIADelNegocio` (D6b).
// =============================================================================

import { randomUUID } from 'node:crypto';
import { cambiarSettingSi, getSettingEstricto } from './settings';
import { getTenantDb } from './workspace';
import { bloqueaLaLectura, extraerLanding } from './landing-fetch';
import { leerConLectorExterno } from './offer-lector-externo';
import { diagnosticoOffer } from './offer-ia';
import { fetchSeguro } from './fetch-seguro';
import { enlacesDeHtml, paginasQueEnlaza } from './spy-otras-redes-reglas';
import {
  MAX_ENLACES,
  claveOfertaSpy, leerOferta, leerSuOferta, reclamarLectura, vistaDeOferta, websDelCompetidor,
  type DepsOferta, type PaginaLeida, type VistaOferta,
} from './spy-oferta';

const hostDe = (u: string): string => { try { return new URL(u).host; } catch { return u; } };

/** Baja UNA web y le saca el texto, como Offer baja la del dueño. Tira si no pudo. */
async function bajarWeb(url: string): Promise<PaginaLeida> {
  let pagina: { urlFinal: string; titulo: string; descripcion: string; texto: string; bloqueada: boolean };
  try {
    pagina = await extraerLanding(url, { talCual: true });
  } catch (e) {
    const otra = bloqueaLaLectura(e) ? await leerConLectorExterno(url) : null;
    if (!otra) throw e;
    pagina = otra;
  }
  if (pagina.bloqueada || !pagina.texto.trim()) {
    const otra = await leerConLectorExterno(url);
    if (otra) pagina = otra;
  }
  const texto = [`Página: ${pagina.urlFinal}`, pagina.titulo ? `# ${pagina.titulo}` : '', pagina.descripcion, pagina.texto].filter(Boolean).join('\n\n');
  // Sin el texto de la página (sólo su dirección y su título) no hay oferta que leer.
  return { url: pagina.urlFinal || url, titulo: pagina.titulo, texto: pagina.texto.trim() ? texto : '' };
}

/** Las páginas suyas que enlaza una página de enlaces (beacons, linktree): se baja su HTML, nunca se ejecuta. Vacío si no pudo. */
async function enlacesDe(url: string): Promise<string[]> {
  try {
    const r = await fetchSeguro(url, { signal: AbortSignal.timeout(8_000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; MaKoBot/1.0; +https://hola-mako.com)' } });
    if (r.status < 200 || r.status >= 300) return [];
    const html = (await r.text()).slice(0, 1_500_000);
    return paginasQueEnlaza(enlacesDeHtml(html, url), url, MAX_ENLACES);
  } catch (e) {
    console.warn(`[spy-oferta] la página de enlaces ${url}: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

function depsDe(competidorId: number, inicio: number): DepsOferta {
  const clave = claveOfertaSpy(competidorId);
  return {
    leer: async () => { const crudo = await getSettingEstricto(clave); return { crudo, version: crudo }; },
    cambiarSi: (version, nuevo) => cambiarSettingSi(clave, version, nuevo),
    bajar: bajarWeb,
    enlacesDe,
    diagnosticar: async ({ nombre, paginas }) => {
      const at = new Date().toISOString();
      const r = await diagnosticoOffer({
        mensajes: [], piezas: {}, contexto: '', embudo: '', alertas: [], inicio,
        docs: paginas.map((p, i) => ({ id: `web-${i + 1}`, nombre: p.titulo ? `${p.titulo} (${hostDe(p.url)})` : hostDe(p.url), texto: p.texto, at })),
        deOtro: { nombre }, soloDelNegocio: true,
      });
      return r.ok ? { ok: true, valor: r.valor } : { ok: false, error: r.error };
    },
    nuevoIntento: () => randomUUID(),
  };
}

/** El competidor y sus webs: la principal y las otras que se guardaron de él (lo que leyó la extensión, otra página). */
async function competidorYWebs(competidorId: number): Promise<{ nombre: string; webs: string[] } | null> {
  const db = await getTenantDb();
  const { data: c, error } = await db.from('spy_competidores').select('id, nombre, landing_url').eq('id', competidorId).maybeSingle();
  if (error) throw new Error(`No pude leer al competidor: ${error.message}`);
  if (!c) return null;
  const { data: piezas, error: e2 } = await db.from('spy_piezas').select('ref').eq('competidor_id', competidorId).eq('canal', 'landing').limit(20);
  if (e2) throw new Error(`No pude leer sus webs: ${e2.message}`);
  const fila = c as { nombre: string; landing_url: string | null };
  return { nombre: fila.nombre, webs: websDelCompetidor(fila.landing_url, (piezas ?? []).map((p) => (p as { ref: string }).ref)) };
}

/** Lo que hay guardado de su oferta, sin leer nada (la API de MaKo, la primera pintada). */
export async function ofertaGuardada(competidorId: number): Promise<VistaOferta | null> {
  const c = await competidorYWebs(competidorId);
  if (!c) return null;
  return vistaDeOferta(leerOferta(await getSettingEstricto(claveOfertaSpy(competidorId))), c.webs);
}

/**
 * Lo que hay, y si hace falta leerla, el trabajo para correr en segundo plano (la ruta lo pone en un `after()`). Con
 * `hayIA: false` no se reclama nada: la pantalla dice que conecte su IA y no queda un «leyendo» colgado.
 */
export async function asegurarOferta(competidorId: number, opts: { hayIA: boolean; inicio?: number }): Promise<{ vista: VistaOferta; trabajo: (() => Promise<void>) | null } | null> {
  const c = await competidorYWebs(competidorId);
  if (!c) return null;
  const inicio = opts.inicio ?? Date.now();
  const deps = depsDe(competidorId, inicio);
  if (!opts.hayIA) return { vista: vistaDeOferta(leerOferta((await deps.leer()).crudo), c.webs, { sinIA: true }), trabajo: null };
  const r = await reclamarLectura(deps, c.webs);
  if (!r.corre) return { vista: vistaDeOferta(r.actual, c.webs), trabajo: null };
  const trabajo = async () => {
    try {
      const fin = await leerSuOferta(deps, { nombre: c.nombre }, r);
      if (fin.estado !== 'lista') console.warn(`[spy-oferta] competidor=${competidorId}: ${fin.motivo ?? fin.estado}`);
    } catch (e) {
      console.error(`[spy-oferta] competidor=${competidorId}:`, e instanceof Error ? e.message : String(e));
    }
  };
  return { vista: vistaDeOferta(r.actual, c.webs), trabajo };
}
