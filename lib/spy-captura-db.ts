// =============================================================================
// «Guardar en Spy»: lo interpretado, a la ficha de un negocio
// =============================================================================
// Las reglas viven en lib/spy-captura.ts. Corre adentro de `runWithWorkspace`, con el negocio que sale del
// token de la extensión (app/api/competitor-spy/extension/route.ts).
//
// ⚠️ DOS COSAS QUE ESTE ARCHIVO NO HACE, Y SON A PROPÓSITO:
//   · **No llama a `marcarDejadas`.** Lo que se ve en una pestaña es lo que la página dibujó hasta ahí: que
//     un anuncio no esté no quiere decir que lo bajó. Sólo se escribe «dejó de verse» cuando la Biblioteca
//     dice la fecha en que terminó.
//   · **No toca `spy_lecturas_canal`.** Lo leído de Meta es de quien lo leyó: compartirlo entre negocios es
//     justo la transferencia a terceros que prohíben sus términos (§9.1 del diseño).

import 'server-only';
import { agregarCompetidor, guardarFunnel, guardarVistas, leerCompetidor, type Competidor } from './spy';
import {
  anunciosDe, anunciosDeQuien, esRedSocial, paginaMasVista, piezaDeAnuncio, sitioDe,
  type Captura, type CapturaBiblioteca, type CapturaSitio,
} from './spy-captura';
import { funnelEnPalabras } from './spy-funnel';
import { dominioComparable, TOPES } from './spy-reglas';
import { marcarActosSpy } from './spy-actos';
import { getTenantDb } from './workspace';

export type ResultadoCaptura =
  | { ok: true; tipo: 'alta'; competidor: { id: number; nombre: string } }
  | { ok: true; tipo: 'sitio'; competidor: { id: number; nombre: string }; lineas: string[] }
  /** `sinGuardar`: cuantos de los SUYOS no entraron por el tope de una captura. Ausente = entraron todos. */
  | { ok: true; tipo: 'anuncios'; competidor: { id: number; nombre: string }; guardados: number; nuevos: number; otros: number; sinGuardar?: number }
  | { ok: false; motivo: 'sin-anuncios' | 'de-otro' | 'sin-competidor' | 'falla'; error: string };

const quien = (c: Competidor) => ({ id: c.id, nombre: c.nombre });

/** Lo que el desplegable necesita para decir «Guardar en la ficha de X», sin mandar a qué sitio está mirando. */
export async function fichasParaLaExtension(): Promise<Array<{ id: number; nombre: string; dominio: string | null; pagina: string | null }>> {
  const db = await getTenantDb();
  const { data, error } = await db.from('spy_competidores').select('id, nombre, landing_url, pagina_anuncios').order('nombre').limit(TOPES.competidores);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ id: number; nombre: string; landing_url: string | null; pagina_anuncios: string | null }>).map((c) => ({
    id: c.id, nombre: c.nombre, dominio: c.landing_url ? dominioComparable(c.landing_url) : null, pagina: c.pagina_anuncios,
  }));
}

async function suCompetidor(competidorId: number | null, pegado: string | null): Promise<Competidor | { error: string }> {
  if (competidorId != null) return (await leerCompetidor(competidorId)) ?? { error: 'No encontré ese competidor en tu negocio.' };
  if (!pegado) return { error: 'No pude saber de quién es esto.' };
  const r = await agregarCompetidor(pegado);
  if (!r.ok) return { error: r.error };
  await marcarActosSpy(['spy_primero', 'spy_canales']);
  return r.competidor;
}

async function guardarSitio(c: CapturaSitio, competidorId: number | null): Promise<ResultadoCaptura> {
  const { ref, lectura, piezas } = sitioDe(c);
  const yo = await suCompetidor(competidorId, ref);
  if ('error' in yo) return { ok: false, motivo: 'sin-competidor', error: yo.error };
  // Una red no es «su sitio»: se suma como canal, y no tiene funnel que leer (el píxel de instagram.com es de Instagram).
  if (esRedSocial(c.url)) return { ok: true, tipo: 'alta', competidor: quien(yo) };
  const db = await getTenantDb();
  if (!yo.landing_url) await db.from('spy_competidores').update({ landing_url: ref.slice(0, 500), updated_at: new Date().toISOString() }).eq('id', yo.id);
  // La misma página que ya se lee desde el servidor cae en SU fila, aunque difieran en la barra final.
  const sinBarra = (s: string) => s.replace(/\/+$/, '');
  const fila = yo.landing_url && sinBarra(yo.landing_url.split(/[?#]/)[0]) === sinBarra(ref) ? yo.landing_url : ref;
  const g = await guardarVistas(yo.id, [{
    canal: 'landing', tipo: 'landing', ref: fila, fuente: 'recorrido', url: fila.slice(0, 1000),
    titulo: c.titulo || dominioComparable(ref), etiquetas: piezas.length ? piezas : null,
  }]);
  if (g.error) return { ok: false, motivo: 'falla', error: g.error };
  await guardarFunnel(yo.id, fila, 'navegador', lectura);
  return { ok: true, tipo: 'sitio', competidor: quien(yo), lineas: funnelEnPalabras({ pagina: null, navegador: lectura }) };
}

async function guardarBiblioteca(c: CapturaBiblioteca, competidorId: number | null): Promise<ResultadoCaptura> {
  const anuncios = anunciosDe(c.tokens);
  if (!anuncios.length) return { ok: false, motivo: 'sin-anuncios', error: 'No vi anuncios en esta pestaña. Espera a que carguen y vuelve a tocar.' };
  const yo = await suCompetidor(competidorId, paginaMasVista(anuncios)?.nombre ?? (c.busqueda.replace(/"/g, '') || null));
  if ('error' in yo) return { ok: false, motivo: 'sin-competidor', error: yo.error };
  const { suyos, otros } = anunciosDeQuien(anuncios, yo, !!c.pagina || !!c.id);
  if (!suyos.length) return { ok: false, motivo: 'de-otro', error: `Estos anuncios no son de ${yo.nombre}. Abre su Página en la Biblioteca y vuelve a tocar.` };
  // ⚠️ LO CAPTURADO NO SE CORTA CON EL TOPE DE LAS LECTURAS DE AFUERA (6/11/2026). Acá los anuncios ya están bajados en
  // la pestaña de la persona: cortar en 50 era pérdida pura, y además silenciosa (el desplegable decía «50 anuncios» sin
  // decir «de 213»). Con su tope propio, y si igual sobran, se dice cuántos quedaron afuera.
  const aGuardar = suyos.slice(0, TOPES.piezasDeUnaCaptura);
  const sinGuardar = suyos.length - aGuardar.length;
  const g = await guardarVistas(yo.id, aGuardar.map(piezaDeAnuncio));
  if (g.error) return { ok: false, motivo: 'falla', error: g.error };
  // Su Página: el id si la pestaña lo dice, y si no, el nombre que tiene en la dirección. Un id nunca se
  // cambia por un nombre: con el id, «Ver sus anuncios» va directo a ella.
  const pagina = c.pagina || paginaMasVista(suyos)?.handle || null;
  if (pagina && (!yo.pagina_anuncios || (/^\d+$/.test(pagina) && !/^\d+$/.test(yo.pagina_anuncios)))) {
    const db = await getTenantDb();
    await db.from('spy_competidores').update({ pagina_anuncios: pagina.slice(0, 200), updated_at: new Date().toISOString() }).eq('id', yo.id);
  }
  return { ok: true, tipo: 'anuncios', competidor: quien(yo), guardados: aGuardar.length, nuevos: g.nuevas, otros, ...(sinGuardar > 0 ? { sinGuardar } : {}) };
}

export function guardarCaptura(c: Captura, competidorId: number | null): Promise<ResultadoCaptura> {
  return c.modo === 'sitio' ? guardarSitio(c, competidorId) : guardarBiblioteca(c, competidorId);
}
