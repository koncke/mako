// =============================================================================
// Media Buyer — ¿esto muestra anuncios DENTRO de la zona del negocio? (el servidor)
// =============================================================================
// La regla es pura (lib/media-buyer/zona.ts); acá se lee el público de cada conjunto EN VIVO, por el mismo canal con que
// escribe el Media Buyer: su Zernio (`GET /ads/ad-sets/{id}?fields=targeting`, el paso directo) o, sin Zernio, el token de
// respaldo del negocio (`getAdsetTargeting`). El árbol de la cuenta no trae el público (ni el de Meta ni `/ads/tree`), así
// que se pregunta SÓLO por lo que se va a prender o subir: unas pocas lecturas por corrida, nunca la cuenta entera.
//
// ⚠️ Un conjunto que no se pudo leer es «no sé», y «no sé» no se prende ni se sube (zona.ts).
// =============================================================================

import 'server-only';
import { runWithWorkspace } from '@/lib/workspace';
import { getAdsetTargeting, searchLugares } from '@/lib/meta-ads-create';
import { conjuntoMetaPorZernio } from '@/lib/zernio-ads';
import { lugarPais, lugaresDesdeMeta } from '@/lib/meta-geo';
import { juntarVeredictos, veredictoDeLugares, type LugarZona, type VeredictoZona } from './zona';
import { BORRADO } from './senales';
import type { DatosCuenta } from './datos';
import type { NivelMeta } from './tipos';

/** Más conjuntos que esto en una campaña: no se leen todos, y la campaña es «no sé». */
const CONJUNTOS_MAX = 40;

async function targetingDe(ws: number, datos: DatosCuenta, adSetId: string): Promise<Record<string, unknown> | null> {
  try {
    if (datos.conexion) {
      const o = await conjuntoMetaPorZernio(ws, datos.conexion, adSetId, 'targeting');
      return o.targeting && typeof o.targeting === 'object' ? (o.targeting as Record<string, unknown>) : null;
    }
    return (await runWithWorkspace(ws, () => getAdsetTargeting(adSetId))).targeting;
  } catch (e) {
    console.warn(`[media-buyer/publico] no pude leer el público del conjunto ${adSetId}:`, e instanceof Error ? e.message : String(e));
    return null;
  }
}

export type LectorZona = (nivel: NivelMeta, id: string) => Promise<VeredictoZona>;

/**
 * Un lector para UNA corrida o un lanzamiento: cada conjunto se lee una vez. Una campaña es lo que digan sus conjuntos
 * PRENDIDOS (los que entregarían al subirla o prenderla); si no tiene ninguno prendido, todos los que no están borrados.
 */
export function lectorDeZona(ws: number, datos: DatosCuenta, zona: readonly LugarZona[]): LectorZona {
  const cache = new Map<string, Promise<VeredictoZona>>();
  const deConjunto = (id: string): Promise<VeredictoZona> => {
    let p = cache.get(id);
    if (!p) {
      p = targetingDe(ws, datos, id).then((t) => {
        if (!t) return 'no_se' as const;
        const lec = lugaresDesdeMeta(t.geo_locations, t.excluded_geo_locations);
        return veredictoDeLugares(zona, lec.lugares, lec.noEntiendo).veredicto;
      });
      cache.set(id, p);
    }
    return p;
  };
  return async (nivel, id) => {
    if (!zona.length) return 'dentro';
    if (nivel === 'adset') return deConjunto(id);
    if (nivel === 'ad') {
      const ad = datos.arbol.find((n) => n.id === id);
      return ad?.parentId ? deConjunto(ad.parentId) : 'no_se';
    }
    const conjuntos = datos.arbol.filter((n) => n.nivel === 'adset' && n.parentId === id && n.configurado !== BORRADO);
    const prendidos = conjuntos.filter((n) => n.configurado === 'ACTIVE');
    const mirar = prendidos.length ? prendidos : conjuntos;
    if (!mirar.length || mirar.length > CONJUNTOS_MAX) return 'no_se';
    return juntarVeredictos(await Promise.all(mirar.map((c) => deConjunto(c.id))));
  };
}

/**
 * Los lugares que llegan de afuera (la API de MaKo, el navegador), confirmados contra la búsqueda de Meta: cada id tiene que
 * aparecer buscando su nombre, y lo que vale (nombre, país, provincia) es lo que dice META, no lo que mandó quien llama. Sin
 * esto, `{ ciudad: <id de Rosario>, nombre: 'Madrid', regionId: <la de Madrid> }` pasaba por adentro de una zona «Madrid» y
 * la confirmación mostraba «Madrid» (revisión adversarial del 29/10, hallazgo 3). Un país es su código ISO: no se busca.
 */
export async function resolverLugares(ws: number, lugares: readonly LugarZona[]): Promise<{ ok: true; lugares: LugarZona[] } | { ok: false; error: string }> {
  const out: LugarZona[] = [];
  for (const l of lugares) {
    if (l.tipo === 'country') {
      if (!/^[A-Z]{2}$/.test(l.key)) return { ok: false, error: `«${l.key}» no es un código de país.` };
      const p = lugarPais(l.key);
      out.push({ tipo: 'country', key: p.key, nombre: p.nombre, pais: p.key });
      continue;
    }
    const encontrados = await runWithWorkspace(ws, () => searchLugares(l.nombre, l.pais ?? null)).catch(() => null);
    if (!encontrados) return { ok: false, error: `No pude confirmar «${l.nombre}» en Meta: prueba de nuevo en un momento.` };
    const m = encontrados.find((r) => r.tipo === l.tipo && r.key === l.key);
    if (!m) return { ok: false, error: `No encontré «${l.nombre}» con ese id en Meta: búscalo de nuevo (buscar_lugares_meta) y elígelo de la lista.` };
    out.push({ tipo: m.tipo, key: m.key, nombre: m.nombre, pais: m.pais ?? null, region: m.region ?? null, regionId: m.regionId ?? null });
  }
  return { ok: true, lugares: out };
}
