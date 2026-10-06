// =============================================================================
// El aviso FIJO de «tu Pixel quedó viejo»: cuándo sale, a dónde lleva y qué dice
// =============================================================================
// Pedido de Martín (06/10/2026): «dentro de MaKo que siempre aparezca una
// notificación que no se pueda cerrar, pero que sea sutil, como lo tenemos en el
// CRM de "Revisar" que aparece abajo a la derecha». El motivo: los clientes tienen
// que volver a pegar el código para que se graben sus visitas y para el mapa de
// calor, y un WhatsApp solo se lee una vez.
//
// SIN `server-only`, a propósito: la decisión es lo único de esta pieza que se
// puede equivocar, y adentro de un módulo de servidor ningún test la podría
// importar. La comparten la ruta que contesta y el componente que dibuja.
// =============================================================================

/**
 * Desde qué versión del Pixel el aviso se apaga.
 *
 * ⚠️ NO SE DERIVA DE `SNIPPET_VERSION`. Esa sube con cualquier mejora del código, y
 * un aviso que NO SE PUEDE CERRAR que se prende con cada subida le pediría a todos
 * los negocios que repeguen por cosas que no les cambian nada — que es como se
 * aprende a no leerlo. Se sube A MANO, sólo cuando una versión justifica pedirle a
 * todo el mundo que vuelva a pegar el código.
 *
 * Hoy es 22: el código que graba las visitas, ancla el mapa de calor y ya no trae el
 * tag de Clarity. Medido el 06/10/2026: los ws 11 y 13 están en la 18, el 14 en la 15,
 * y la página principal del ws1 se repegó con una 21 que todavía traía Clarity.
 */
export const PIXEL_MINIMO_AVISO = 22;

/** El lugar exacto donde se resuelve: abre el modal del Pixel (IntegracionesBoard). */
export const RUTA_PIXEL = '/integraciones?abrir=landing';

/** Lo que dice el aviso. Es el mismo rótulo del chip del modal del Pixel. */
export const ROTULO_PIXEL_VIEJO = 'Actualiza el Pixel';

/**
 * ¿Hay que mostrar el aviso, mirando la versión que anotó el beacon?
 *
 * ⚠️ SIN FILA NO HAY AVISO. La versión la escribe el beacon con el PRIMER evento que
 * llega de la página, así que su ausencia quiere decir «este negocio nunca pegó el
 * Pixel»: medido el 06/10/2026, los ws 9, 10, 15 y 17 tienen el token acuñado (se
 * acuña con sólo abrir Integraciones), ninguna fila de versión y cero visitas en toda
 * su historia. `snippetDesactualizado()` los cuenta como v1 y les diría «actualiza»
 * sobre algo que nunca instalaron.
 */
export function pixelParaActualizar(guardada: string | null | undefined): { viejo: boolean; instalada: number | null } {
  if (guardada == null || String(guardada).trim() === '') return { viejo: false, instalada: null };
  const n = Number(guardada);
  if (!Number.isFinite(n) || n <= 0) return { viejo: false, instalada: null };
  const instalada = Math.floor(n);
  return { viejo: instalada < PIXEL_MINIMO_AVISO, instalada };
}

// ── La versión de CADA página, y la que SIRVE la página hoy ─────────────────
//
// Pedido de Martín (06/10/2026), con la captura de la landing ya republicada:
// «Ya publiqué y sigue apareciendo que falta publicar el pixel». La página servía
// `var SV = 22` y MaKo seguía diciendo 21, porque la versión sólo se enteraba por las
// VISITAS: hasta que no entra alguien con el código nuevo, el número no cambia. Y era
// del workspace entero, con el último evento ganando, así que con dos páginas en
// versiones distintas el aviso se prendía y se apagaba solo (revisión del mismo día).
//
// Dos arreglos, y los dos viven acá para que tengan test:
//   · la versión se lleva POR PÁGINA (`clavePagina` + el mapa que escribe el beacon);
//   · cuando las visitas dicen «viejo», se mira lo que SIRVE la página
//     (`versionEnHtml`): es lo que va a recibir el próximo visitante.

/**
 * La clave de una página para comparar versiones: host sin `www.` y camino sin la
 * barra final, sin query ni hash. La usan las DOS puntas —el beacon que anota y el
 * aviso que lee—; con dos normalizaciones, el cruce falla en silencio y se lee como
 * «esta página nunca mandó nada».
 */
export function clavePagina(url: string | null | undefined): string | null {
  const s = (url ?? '').trim();
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (!host.includes('.')) return null;
    return host + u.pathname.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

/**
 * La versión del Pixel que trae el HTML que SIRVE la página; `null` si el código no
 * está en el HTML.
 *
 * ⚠️ Se busca el ENDPOINT nuestro antes que el número: `SV` solo es un nombre corto
 * que puede aparecer en cualquier script. Con el endpoint y sin `var SV`, es un código
 * anterior al versionado: v1, igual que en el beacon.
 *
 * ⚠️ Y SI HAY DOS COPIAS, GANA LA MÁS VIEJA. Pegar el código nuevo sin sacar el viejo
 * deja los dos corriendo: el viejo sigue mandando sus eventos (y la v21 trae el tag de
 * Clarity). Eso no es «al día».
 *
 * `null` no es «viejo»: el código puede entrar por un administrador de etiquetas y no
 * estar en el HTML. Quien llama cae a lo que dicen las visitas.
 */
export function versionEnHtml(html: string | null | undefined): number | null {
  const h = html ?? '';
  if (!/\/api\/track\/vsl/.test(h)) return null;
  const vs = [...h.matchAll(/\bvar SV\s*=\s*(\d+)\s*;/g)]
    .map((m) => Number(m[1]))
    .filter((n) => Number.isFinite(n) && n > 0);
  return vs.length ? Math.min(...vs) : 1;
}

/**
 * La clave en app_settings del mapa página → versión. La escribe SÓLO el beacon
 * (`app/api/track/vsl/route.ts`), con la versión de cada pageview. Es una clave aparte
 * de `landing.snippet_version` a propósito: aquélla la leen el WhatsApp, el pulso y la
 * API, y cambiarle el formato le rompía el número a todos.
 */
export const VERSIONES_POR_PAGINA_KEY = 'landing.snippet_versiones';

/** El mapa página → versión que escribe el beacon (`VERSIONES_POR_PAGINA_KEY`). */
export type MapaVersiones = Record<string, { v: number; t: string }>;

/** Cuántas páginas guarda el mapa. Lo escribe un endpoint PÚBLICO: no puede crecer sin techo. */
export const MAPA_VERSIONES_TOPE = 30;

export function parsearMapaVersiones(crudo: string | null | undefined): MapaVersiones {
  if (!crudo?.trim()) return {};
  let x: unknown;
  try { x = JSON.parse(crudo); } catch { return {}; }
  if (!x || typeof x !== 'object' || Array.isArray(x)) return {};
  const out: MapaVersiones = {};
  for (const [k, e] of Object.entries(x as Record<string, unknown>)) {
    const v = Number((e as { v?: unknown })?.v);
    const t = String((e as { t?: unknown })?.t ?? '');
    if (k && Number.isFinite(v) && v > 0) out[k] = { v: Math.floor(v), t };
  }
  return out;
}

/**
 * El mapa con la versión de ESTA página anotada, o `null` si no cambió nada (el
 * beacon corre en cada visita: escribir sólo cuando cambia).
 *
 * ⚠️ CON TOPE, y se van las que hace más que no mandan nada. La clave sale de la URL
 * que manda la página, y esa URL la escribe un endpoint público con un token que viaja
 * en el HTML: sin techo, cualquiera que lea el código fuente infla el mapa.
 */
export function anotarVersionDePagina(
  mapa: MapaVersiones, clave: string, version: number, ahoraISO: string, tope = MAPA_VERSIONES_TOPE,
): MapaVersiones | null {
  if (!clave || !(version > 0)) return null;
  if (mapa[clave]?.v === version) return null;
  const nuevo: MapaVersiones = { ...mapa, [clave]: { v: version, t: ahoraISO } };
  const claves = Object.keys(nuevo);
  if (claves.length > tope) {
    claves.sort((a, b) => (nuevo[a].t < nuevo[b].t ? -1 : nuevo[a].t > nuevo[b].t ? 1 : 0));
    for (const k of claves.slice(0, claves.length - tope)) if (k !== clave) delete nuevo[k];
  }
  return nuevo;
}

export type PaginaPixel = { url: string; version: number | null; fuente: 'pagina' | 'visitas' | 'negocio' };

/**
 * ¿Hay que pedir que repeguen el Pixel? Mira cada página declarada.
 *
 *   · sin fila de versión del negocio → no hay aviso (nunca pegó el Pixel; ver
 *     `pixelParaActualizar`);
 *   · sin páginas declaradas → decide la versión del negocio, que es lo único que hay;
 *   · por página: lo que SIRVE la página si se pudo leer (`servidas`), si no lo que
 *     mandaron sus visitas (`mapa`), y si todavía no mandó nada, la del negocio.
 *
 * `servidas` sólo trae las páginas que se fueron a mirar: quien llama mira las que las
 * visitas dan por viejas (`paraMirar`), que son las únicas donde el HTML puede cambiar
 * la respuesta.
 */
export function veredictoPixel(e: {
  guardada: string | null | undefined;
  mapa: MapaVersiones;
  paginas: string[];
  servidas?: Record<string, number | null>;
  minimo?: number;
}): { viejo: boolean; instalada: number | null; paginas: PaginaPixel[] } {
  const minimo = e.minimo ?? PIXEL_MINIMO_AVISO;
  const delNegocio = pixelParaActualizar(e.guardada);
  if (delNegocio.instalada == null) return { viejo: false, instalada: null, paginas: [] };
  if (!e.paginas.length) return { viejo: delNegocio.instalada < minimo, instalada: delNegocio.instalada, paginas: [] };
  const paginas: PaginaPixel[] = e.paginas.map((url) => {
    const k = clavePagina(url);
    const servida = k ? e.servidas?.[k] : undefined;
    if (typeof servida === 'number') return { url, version: servida, fuente: 'pagina' };
    const vis = k ? e.mapa[k]?.v : undefined;
    if (typeof vis === 'number') return { url, version: vis, fuente: 'visitas' };
    return { url, version: delNegocio.instalada, fuente: 'negocio' };
  });
  const viejo = paginas.some((p) => p.version != null && p.version < minimo);
  const instalada = Math.min(...paginas.map((p) => p.version ?? Infinity));
  return { viejo, instalada: Number.isFinite(instalada) ? instalada : delNegocio.instalada, paginas };
}

/** Las páginas que conviene ir a mirar: las que, sin mirarlas, darían «vieja». */
export function paraMirar(e: { guardada: string | null | undefined; mapa: MapaVersiones; paginas: string[]; minimo?: number }): string[] {
  const v = veredictoPixel({ ...e, servidas: {} });
  return v.paginas.filter((p) => p.version != null && p.version < (e.minimo ?? PIXEL_MINIMO_AVISO)).map((p) => p.url);
}
