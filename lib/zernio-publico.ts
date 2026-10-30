// =============================================================================
// zernio-publico — el PÚBLICO de un conjunto, en la forma que recibe Zernio (PURO: lo prueban los tests) (29/10/2026)
// =============================================================================
// Hasta hoy, editar el público de un conjunto exigía el token de Meta (deprecado desde el 25/10): por la conexión de Facebook
// (Zernio) la API de MaKo contestaba «edítalo en el Administrador de anuncios» (docs/hallazgos-ads.md, «Editar el público por
// Zernio NO está hecho»). Lo que lo hacía difícil: `PUT /ads/ad-sets/{id}` no recibe el `targeting` crudo de Meta sino SU forma
// (`TargetingSpec`, camelCase), y lo que armaba lib/publico-cambios.ts era el crudo ENTERO con los cambios encima.
//
// Lo que dice la OpenAPI de Zernio (v1.416.0, leída el 29/10/2026), y por qué alcanza con mandar SÓLO lo que cambió:
//   · «Only the keys you send change. Zernio reads the ad set's live targeting, merges your keys over it and writes the full
//     spec back»: intereses, idiomas, comportamientos y `targeting_automation` que no se nombran, se conservan.
//   · ⚠️ «Setting any location replaces every location list»: si cambia UN lugar, van TODOS (incluidos y excluidos). Por eso
//     un tipo que Zernio no recibe (barrio, localidad, partido, una dirección sin coordenadas) frena el cambio de lugares
//     entero: mandar los otros borraría ése en silencio.
//   · `gender: 'all'` y una lista vacía SACAN esa clave. La edad no se puede «sacar»: se manda la de Meta por defecto (18 y 65).
//   · `placements` (aparte del targeting) REEMPLAZA el set entero de ubicaciones: una lista de posiciones que no se manda se
//     borra. Por eso se reenvían las posiciones que el conjunto ya tenía para las plataformas que quedan.
//   · Advantage+ (`advantageAudience`) existe sólo al CREAR: en la edición no hay campo. Cambiarlo por acá no se puede.
// =============================================================================

import { EDAD_META, type CambiosDePublico } from './publico-cambios';
import { RADIO_CIUDAD_KM, RADIO_DIRECCION_KM, RADIO_DIRECCION_DEFAULT_KM, kmDeRadio, type LugarMeta } from './meta-geo';

type Radio = { radius: number; distanceUnit: 'mile' | 'kilometer' };

/** El radio de un lugar como lo manda Zernio: el de Meta tal cual si nadie lo cambió; si no, en km dentro de los topes. */
function radioDe(l: LugarMeta, topes: { min: number; max: number }, defecto?: number): Radio | null {
  if (l.radioMeta && l.radioKm != null && Math.abs(kmDeRadio(l.radioMeta) - l.radioKm) < 1e-6) {
    return { radius: l.radioMeta.radius, distanceUnit: l.radioMeta.distance_unit };
  }
  const km = l.radioKm ?? defecto;
  if (km == null) return null;
  return { radius: Math.min(topes.max, Math.max(topes.min, km)), distanceUnit: 'kilometer' };
}

/** Los lugares de un lado (incluidos o excluidos) en la forma de Zernio. Tira con el lugar que no se puede mandar. */
function geoDe(lugares: readonly LugarMeta[]): Record<string, unknown[]> {
  const g: Record<string, unknown[]> = {};
  const push = (k: string, v: unknown) => { (g[k] ??= []).push(v); };
  for (const l of lugares) {
    switch (l.tipo) {
      case 'country': push('countries', l.key.toUpperCase()); break;
      case 'region': push('regions', { key: l.key }); break;
      case 'city': { const r = l.radioKm ? radioDe(l, RADIO_CIUDAD_KM) : null; push('cities', r ? { key: l.key, ...r } : { key: l.key }); break; }
      case 'zip': push('zips', { key: l.key }); break;
      case 'geo_market': push('metros', { key: l.key }); break;
      case 'pin': {
        if (!Number.isFinite(l.lat) || !Number.isFinite(l.lng)) throw new Error(`«${l.nombre}» no trae sus coordenadas: cámbialo en Meta.`);
        push('customLocations', { latitude: l.lat, longitude: l.lng, ...radioDe(l, RADIO_DIRECCION_KM, RADIO_DIRECCION_DEFAULT_KM)! });
        break;
      }
      default:
        // Barrio, localidad, partido y una dirección sin coordenadas: Zernio no los recibe en un conjunto.
        throw new Error(`Por la conexión de Facebook (Zernio) no se puede mandar «${l.nombre}» (${l.tipo}): cambia los lugares de este conjunto en Meta.`);
    }
  }
  return g;
}

/** Los lugares enteros (incluidos y excluidos) como los recibe Zernio: van todos juntos o ninguno. */
export function lugaresParaZernio(lugares: readonly LugarMeta[]): Record<string, unknown> {
  const incluidos = lugares.filter((l) => !l.excluir);
  if (!incluidos.length) throw new Error('Elige al menos un lugar donde mostrar los anuncios.');
  const excluidos = lugares.filter((l) => l.excluir);
  return { ...geoDe(incluidos), ...(excluidos.length ? { excludedLocations: geoDe(excluidos) } : {}) };
}

const POSICIONES: Record<string, string> = {
  facebook: 'facebook_positions', instagram: 'instagram_positions', messenger: 'messenger_positions', audience_network: 'audience_network_positions',
};
const CAMEL: Record<string, string> = {
  facebook_positions: 'facebookPositions', instagram_positions: 'instagramPositions', messenger_positions: 'messengerPositions', audience_network_positions: 'audienceNetworkPositions',
};

export type CuerpoPublicoZernio = { targeting?: Record<string, unknown>; placements?: Record<string, unknown> | null };

/**
 * Los cambios del público (lib/publico-cambios.ts) sobre ESTE crudo → el cuerpo de `PUT /ads/ad-sets/{id}` (sin `platform`).
 * Sólo lo que vino. Tira con un mensaje para la persona si algo no se puede mandar por Zernio.
 */
export function publicoParaZernio(crudo: Record<string, unknown>, c: CambiosDePublico): CuerpoPublicoZernio {
  if (c.advantage !== undefined) {
    const ta = (crudo.targeting_automation ?? {}) as Record<string, unknown>;
    if ((Number(ta.advantage_audience) === 1 ? 1 : 0) !== c.advantage) throw new Error('Advantage+ no se puede cambiar por la conexión de Facebook (Zernio): cámbialo en Meta.');
  }
  const t: Record<string, unknown> = {};
  if (c.genero !== undefined) t.gender = c.genero === 'h' ? 'male' : c.genero === 'm' ? 'female' : 'all';
  if (c.edadMin !== undefined) t.ageMin = c.edadMin ?? EDAD_META.min;
  if (c.edadMax !== undefined) t.ageMax = c.edadMax ?? EDAD_META.max;
  if (c.publicos !== undefined) t.audienceInclude = c.publicos ?? [];
  if (c.lugares) {
    // Lo que MaKo no entendió del público vivo se BORRARÍA (Zernio reemplaza todas las listas de lugares): no se manda nada
    // (revisión adversarial del 29/10, hallazgo 7). Y `location_types` no tiene campo en Zernio: sólo pasa el de Meta por defecto.
    if (c.lugares.lectura.noEntiendo.length) throw new Error('Este conjunto tiene lugares que MaKo no sabe editar: cámbialos en Meta.');
    const tipos = c.lugares.lectura.conservar.geo.location_types;
    if (Array.isArray(tipos) && [...tipos].map(String).sort().join() !== 'home,recent') throw new Error('Este conjunto filtra a quién vive o viaja ahí de una forma que la conexión de Facebook (Zernio) no puede mandar: cambia los lugares en Meta.');
    Object.assign(t, lugaresParaZernio(c.lugares.lista));
  }
  const out: CuerpoPublicoZernio = {};
  if (Object.keys(t).length) out.targeting = t;
  if (c.ubicaciones !== undefined) {
    if (!c.ubicaciones || !c.ubicaciones.length) out.placements = null;
    else {
      // Las posiciones que ya tenía cada plataforma que QUEDA (Zernio borra la lista que no se manda).
      const p: Record<string, unknown> = { publisherPlatforms: c.ubicaciones };
      for (const u of c.ubicaciones) {
        const k = POSICIONES[u];
        const v = k ? crudo[k] : undefined;
        if (k && Array.isArray(v) && v.length) p[CAMEL[k]] = v;
      }
      if (Array.isArray(crudo.device_platforms) && crudo.device_platforms.length) p.devicePlatforms = crudo.device_platforms;
      out.placements = p;
    }
  }
  if (!out.targeting && out.placements === undefined) throw new Error('No hay nada que cambiar en el público.');
  return out;
}
