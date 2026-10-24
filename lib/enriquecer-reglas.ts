// =============================================================================
// Completar un lead por su NOMBRE: la web y el Instagram, sólo si se puede afirmar (puro)
// =============================================================================
// Pedido de Martín (24/10/2026, por el Cerebro), textual: «con el motor de búsqueda que tenemos, con el nombre o el de la
// empresa podemos extraer su web y su IG. Quiero que busques la manera de hacerlo». El caso: 221 participantes de un
// grupo de WhatsApp entraron al CRM como teléfonos pelados. El escalón 1 (el perfil de empresa de WhatsApp) lo hace el
// chat del CRM; esto es el escalón 2, para los que no tienen perfil de empresa.
//
// Cómo: una corrida del actor de Google Maps de la prospección (`compass~crawler-google-places`, con los contactos de la
// web: ahí sale el Instagram), una búsqueda por lead con hasta POR_CONSULTA lugares, y después se empareja cada lugar
// con su lead. Lo hace lib/enriquecer-por-nombre.ts; acá vive todo lo que no toca la red, para que un test lo ejecute.
//
// ⚠️ NUNCA SE INVENTA (el pedido lo dice: «un Instagram equivocado en la ficha es peor que ninguno»). Un lugar sólo es
// del lead si:
//   · su TELÉFONO coincide con el del lead (los últimos 10 dígitos, `telefonoComparable`) → confianza 'telefono'; o
//   · su NOMBRE es el mismo, normalizado (sin acentos, mayúsculas ni puntuación), y es el ÚNICO así → 'nombre'.
// Con dos lugares que califican y dicen cosas distintas, no hay respuesta: vacío. Nunca el primero de la lista.
// 'nombre' es más flojo que 'telefono': quien lo use decide si lo escribe solo o lo propone (el CRM).
//
// SIN `server-only`: lo prueba tests/enriquecer-por-nombre.test.ts.

import { telefonoComparable } from './leads-duplicados';
import { prospectoDeGoogleMaps } from './prospectos-reglas';

/** El actor: el mismo de la prospección por Google Maps (lib/prospectos-reglas.ts). */
export const ACTOR_ENRIQUECER = 'compass~crawler-google-places';
/** Cuántos lugares se miran por nombre: de más, para que el teléfono encuentre al correcto aunque no sea el primero. */
export const POR_CONSULTA = 3;
/** Tope de leads por corrida: la plata y el tiempo de una corrida se acotan acá. */
export const TOPE_PEDIDOS = 300;
/**
 * Lo que puede costar UN lead, con margen (precio publicado del actor el 24/10/2026, NO medido: no había una clave de
 * Apify en ningún negocio): hasta US$4 por 1.000 lugares y US$2 por 1.000 contactos de la web, por POR_CONSULTA lugares.
 */
export const USD_POR_PEDIDO = POR_CONSULTA * (4 + 2) / 1000;

export type PedidoEnriquecer = {
  /** Lo elige quien llama (el id del lead): viaja tal cual al resultado. */
  id: string;
  nombre: string;
  telefono?: string | null;
  ciudad?: string | null;
  rubro?: string | null;
};

export type Confianza = 'telefono' | 'nombre';

export type Hallazgo = {
  id: string;
  web: string | null;
  /** Sin la @, como lo guarda `leads.instagram`. */
  instagram: string | null;
  confianza: Confianza | null;
  /** Cómo se llama el lugar en Google Maps: para que una persona lo pueda mirar antes de creerle. */
  lugar: string | null;
};

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
/** El nombre comparable: minúsculas, sin acentos ni puntuación, espacios simples. */
export function nombreComparable(s: string | null | undefined): string {
  return sinAcentos(String(s ?? '').toLowerCase()).replace(/[^a-z0-9ñ]+/g, ' ').trim();
}

/** Lo que se busca en Google Maps por cada lead: nombre, rubro y ciudad. */
export function consultaDe(p: PedidoEnriquecer): string {
  return [p.nombre, p.rubro, p.ciudad].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ').slice(0, 120);
}

/** Los pedidos que se pueden buscar: con nombre, sin repetir id, hasta el tope. */
export function pedidosValidos(pedidos: readonly PedidoEnriquecer[]): PedidoEnriquecer[] {
  const vistos = new Set<string>();
  const out: PedidoEnriquecer[] = [];
  for (const p of pedidos) {
    if (!p || typeof p.id !== 'string' || !p.id || vistos.has(p.id) || !nombreComparable(p.nombre)) continue;
    vistos.add(p.id);
    out.push(p);
    if (out.length >= TOPE_PEDIDOS) break;
  }
  return out;
}

/** El input del actor para una tanda. */
export function inputEnriquecer(pedidos: readonly PedidoEnriquecer[]): Record<string, unknown> {
  return {
    searchStringsArray: [...new Set(pedidos.map(consultaDe))],
    maxCrawledPlacesPerSearch: POR_CONSULTA,
    language: 'es',
    scrapeContacts: true,
    skipClosedPlaces: false,
  };
}

/** Cuánto puede costar como mucho una tanda (el techo que se le pasa a Apify). */
export function techoEnriquecer(cantidad: number): number {
  return Math.max(0.5, Math.ceil(cantidad * USD_POR_PEDIDO * 100) / 100);
}

type Lugar = { busqueda: string; nombre: string; telefono: string | null; web: string | null; instagram: string | null };

function lugarDe(item: unknown): Lugar | null {
  const p = prospectoDeGoogleMaps(item);
  if (!p) return null;
  const busqueda = typeof (item as { searchString?: unknown })?.searchString === 'string' ? (item as { searchString: string }).searchString : '';
  return { busqueda: busqueda.trim(), nombre: p.nombre, telefono: telefonoComparable(p.telefono), web: p.web, instagram: p.instagram };
}

/** La respuesta de un grupo de lugares que califican: si dicen cosas distintas, no hay respuesta. */
function unica(lugares: Lugar[]): Lugar | null {
  if (!lugares.length) return null;
  const firma = (l: Lugar) => `${l.web ?? ''}|${l.instagram ?? ''}`;
  return lugares.every((l) => firma(l) === firma(lugares[0])) ? lugares[0] : null;
}

/** Empareja los lugares de la corrida con cada lead. Un lead sin lugar que se pueda afirmar vuelve VACÍO. */
export function emparejar(pedidos: readonly PedidoEnriquecer[], items: readonly unknown[]): Hallazgo[] {
  const lugares = items.map(lugarDe).filter((l): l is Lugar => l != null);
  return pedidos.map((p) => {
    const vacio: Hallazgo = { id: p.id, web: null, instagram: null, confianza: null, lugar: null };
    const tel = telefonoComparable(p.telefono);
    // 1) Por teléfono, entre TODOS los lugares (Google puede haberlo traído por la búsqueda de otro).
    const porTel = tel ? unica(lugares.filter((l) => l.telefono === tel)) : null;
    const elegido = porTel
      ?? (() => {
        // 2) Por nombre, sólo entre los de SU búsqueda, y el nombre igual. Un lugar con OTRO teléfono que el del lead
        //    no es el lead aunque se llame igual (otra sucursal, otro negocio con el mismo nombre).
        const q = consultaDe(p);
        const nombre = nombreComparable(p.nombre);
        const suyos = lugares.filter((l) => l.busqueda === q && nombreComparable(l.nombre) === nombre && !(tel && l.telefono && l.telefono !== tel));
        return unica(suyos);
      })();
    if (!elegido || (!elegido.web && !elegido.instagram)) return vacio;
    return { id: p.id, web: elegido.web, instagram: elegido.instagram, confianza: porTel ? 'telefono' : 'nombre', lugar: elegido.nombre };
  });
}
