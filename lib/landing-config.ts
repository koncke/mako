// =============================================================================
// landing-config — la configuración ES POR LANDING, no por workspace
// =============================================================================
// El modelo viejo guardaba todo a nivel workspace: un `landing.snippet_version`,
// un `CLARITY_PROJECT_ID`, un semáforo. Y eso funciona exactamente mientras el
// cliente tenga UNA página.
//
// Con dos, todo lo que la pantalla afirma pasa a ser mentira la mitad de las
// veces: el código puede estar al día en la de ventas y viejo en la de webinar, y
// le decimos lo mismo de las dos; Clarity puede estar conectado en una y no en la
// otra, y le ofrecemos el mismo botón. El dueño lo dijo con estas palabras: «tal
// vez en una landing aún no pegue el token y el ID de Clarity y en otra sí» (el
// 06/10/2026 Clarity salió del producto; la regla quedó, y hoy lo que es de cada
// página son sus productos).
//
// Así que la landing deja de ser un string en una lista y pasa a ser la ENTIDAD
// que lleva su propio estado. Lo que se elige en el paso 1 gobierna todo lo que
// viene después.
//
// ⚠️ Sin `server-only`: lo que se puede equivocar es el saneo y la MIGRACIÓN del
// formato viejo, y tiene que poder testearse sin base de datos.
// =============================================================================

import { normalizarUrl } from './landing-paginas';
import { urlLandingVigente } from './editor-landing/dominios-reglas';

/** Una landing del cliente, con lo que le pertenece solo a ella. */
export type LandingConfig = {
  /** URL normalizada. Es la identidad: no puede haber dos con la misma. */
  url: string;
  // ⚠️ ACÁ VIVÍA `clarityProjectId`, el proyecto de Microsoft Clarity de cada
  // página, y se fue el 06/10/2026 con Clarity entero: la grabación de las visitas
  // la hace MaKo (lib/replay-*). Una fila guardada que todavía lo traiga se lee
  // igual —`parsearConfig` reconstruye campo por campo y lo que no conoce lo
  // ignora—, así que no hizo falta migrar nada.
  /**
   * Los EMBUDOS a los que entran los leads de ESTA pagina — o sea, los PRODUCTOS
   * que vende. Vacio o ausente = no asignado, y entonces el lead cae donde cae
   * hoy: el embudo del negocio (`leads.funnel_id = null`).
   *
   * ⚠️ ES UNA LISTA desde el 06/10/2026, y el lead entra a TODOS. Pedido de
   * Martin: «no solo se deberia poder seleccionar 1 producto, si quiero puedo
   * seleccionar mas de 1». Hasta la mig 0207 eso creaba TRES fichas de la misma
   * persona (un lead vivia en UN embudo); desde el 06/10/2026 el lead es UNO: su
   * casa es el primer producto y entra a los otros como filas de `lead_funnel`
   * (`agregarAProducto`), cada una moviendose por las etapas de su tablero.
   *
   * ⚠️ POR QUE CUELGA DE LA URL Y NO DEL TOKEN. El token es UNO por workspace y
   * es determinista —`tokenDeterminista(ws)` es un HMAC de `landing:<ws>` y se
   * guarda en el unico setting `landing_token` (lib/landing-token.ts)—, asi que
   * colgar el producto de el seria decir «todas mis landings venden lo mismo»:
   * no hay un segundo token que asignar. La pagina si distingue, y esta tabla ya
   * existe POR PAGINA (ver la cabecera).
   *
   * ⚠️ NO es la fuente de verdad de que el embudo exista: el numero se guarda
   * tal cual y quien lo USA lo valida contra los embudos vivos del workspace. Un
   * embudo archivado o borrado tiene que caer al del negocio, no romper el alta
   * con una violacion de clave ajena.
   *
   * ⚠️ Y puede llegar como STRING: `funnels.id` es `bigint`, y en este repo ya
   * se midio que segun el driver eso vuelve como texto. Se sanea al parsear.
   */
  funnelIds?: number[];
  /**
   * Es la página de GRACIAS (la «TKY page»): quien llega acá ya compró, y MaKo lo pasa a Ganado
   * en los productos de esta página (lib/landing-gracias.ts). Ausente = no lo es.
   *
   * Pedido de Martín (07/10/2026): «si alguien cae en una TKY Page, se pueda automatizar pasar
   * al lead a Ganado directamente, así por ejemplo, si alguien tiene compra carrito o lo que
   * sea». ⚠️ Se guarda SÓLO cuando es `true`: una fila sin el campo se lee igual que antes, así
   * que las configs de hoy no cambian ni un byte.
   */
  gracias?: boolean;
};

export const CONFIG_KEY = 'landing.config';
export const MAX_LANDINGS = 12;
/**
 * Tope de productos por landing. NO es una regla de producto: es una cota contra
 * un setting corrompido —esto es texto libre en `app_settings`— y esta puesta muy
 * por encima de cualquier catalogo real (medido el 06/10/2026: el workspace con
 * mas embudos tiene TRES, y nueve de diez tienen uno). Un tope cerca de lo real
 * descartaria en silencio una eleccion de la persona, que es justo lo que no
 * puede pasar aca.
 */
export const MAX_PRODUCTOS = 50;

const limpio = (v: unknown, max: number): string =>
  (typeof v === 'string' ? v : '').trim().slice(0, max);

/** Un id de fila: entero positivo, venga como numero o como texto (bigint). */
const idFila = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
};

/** Una lista de ids, saneada: sin basura, sin repetidos y con tope. */
const idsLimpios = (v: unknown): number[] => {
  const out: number[] = [];
  for (const x of Array.isArray(v) ? v : []) {
    const n = idFila(x);
    if (n && !out.includes(n)) out.push(n);
  }
  return out.slice(0, MAX_PRODUCTOS);
};

/**
 * Los productos de una fila guardada, aceptando el formato de UN solo producto.
 *
 * ⚠️ LA COMPATIBILIDAD NO ES OPCIONAL aunque hoy no haya ninguna fila con
 * `funnelId` (medido contra produccion el 06/10/2026: cuatro workspaces tienen
 * `landing.config` y ninguna de sus seis paginas trae producto asignado). Entre
 * medir y desplegar hay un rato, y lo que se perderia es exactamente a que CRM
 * entran los leads de esa pagina — en silencio, porque un lead que cae al embudo
 * del negocio no da ningun error.
 */
const idsDeFila = (x: Record<string, unknown>): number[] => {
  const lista = idsLimpios(x.funnelIds);
  if (lista.length) return lista;
  const uno = idFila(x.funnelId);
  return uno ? [uno] : [];
};

/**
 * Lee la configuración, y MIGRA el formato viejo sin perder nada.
 *
 * ⚠️ Acepta las dos formas a propósito: `["https://a.com"]` (la lista de strings
 * que se guardó hasta hoy) y `[{url, …}]`. Una migración que exija
 * convertir la base primero es una migración que deja a alguien sin sus páginas
 * el día que se despliega — y acá el costo de tolerar las dos formas es una
 * línea.
 */
export function parsearConfig(crudo: string | null): LandingConfig[] {
  if (!crudo?.trim()) return [];
  let lista: unknown;
  try { lista = JSON.parse(crudo); } catch { return []; }
  if (!Array.isArray(lista)) return [];
  const out: LandingConfig[] = [];
  for (const x of lista) {
    // Formato viejo: un string suelto.
    const url = normalizarUrl(typeof x === 'string' ? x : limpio((x as Record<string, unknown>)?.url, 500));
    if (!url || out.some((c) => c.url === url)) continue;
    const fids = typeof x === 'object' && x ? idsDeFila(x as Record<string, unknown>) : [];
    // Sólo un `true` literal: un «"true"» o un 1 de un setting editado a mano no prende algo que
    // mueve leads a Ganado.
    const gracias = typeof x === 'object' && x != null && (x as Record<string, unknown>).gracias === true;
    out.push({ url, ...(fids.length ? { funnelIds: fids } : {}), ...(gracias ? { gracias: true } : {}) });
  }
  return out.slice(0, MAX_LANDINGS);
}

/**
 * A que embudos entran los leads de esta pagina. Vacio = no se asigno ninguno.
 *
 * Es la parte que se puede equivocar —comparar dos URLs que son la misma con
 * distinta barra final— y por eso vive aca, sin `server-only` y con test. Quien
 * la llama todavia tiene que validar que esos embudos existan y esten activos.
 */
export function funnelIdsDeLanding(configs: LandingConfig[], url: string | null | undefined): number[] {
  return landingDe(configs, url)?.funnelIds ?? [];
}

/**
 * La landing elegida, o null. Compara normalizado en las dos puntas.
 *
 * ⚠️ Y con la dirección de HOY en las dos puntas (`urlLandingVigente`, integración de la tanda 4): una
 * landing del editor declarada antes de la mudanza (`hola-mako.com/l/<slug>`) y la que manda el Pixel
 * desde el 14/10 (`hola-mako.site/<slug>`) son la MISMA página. Sin esto el producto de la landing no
 * se encontraba y el lead caía en el embudo del negocio, sin un error.
 */
export function landingDe(configs: LandingConfig[], url: string | null | undefined): LandingConfig | null {
  const u = url ? normalizarUrl(url) : null;
  if (!u) return null;
  const k = urlLandingVigente(u);
  return configs.find((c) => c.url === u || urlLandingVigente(c.url) === k) ?? null;
}

/**
 * Agrega o actualiza una landing. `parcial` solo pisa lo que trae.
 *
 * ⚠️ `funnelIds: undefined` significa «no los toques», no «borralos». Es la
 * misma regla que ya mordió con `esVsl` en los videos: guardar la URL corregida
 * de una landing no puede desasignarle los productos, porque renombrar no contesta
 * esa pregunta. Lo que DESASIGNA es la lista vacia. (Con un solo producto eso se escribia con un `0`
 * explicito, que era un centinela; una lista vacia dice lo mismo sin inventar un
 * valor que significa otra cosa.)
 */
export function conLanding(
  actuales: LandingConfig[],
  url: string,
  parcial: Partial<Omit<LandingConfig, 'url'>> = {},
  anterior?: string | null,
): LandingConfig[] | null {
  const nueva = normalizarUrl(url);
  if (!nueva) return null;
  const prev = anterior ? normalizarUrl(anterior) : null;
  const base = actuales.find((c) => c.url === (prev ?? nueva));
  // `undefined` es «no los toques». Lo que BORRA la asignacion es la lista VACIA — corregirle la URL a una landing no
  // puede desasignarle los productos, que es la trampa de un mapper que
  // reconstruye la fila campo por campo.
  const fids = parcial.funnelIds !== undefined
    ? idsLimpios(parcial.funnelIds)
    : base?.funnelIds ?? [];
  // La MISMA regla que los productos: `undefined` es «no lo toques». Sin esto, guardar los
  // productos de la página de gracias la dejaría de ser — la trampa del mapper que reconstruye la
  // fila campo por campo.
  const gracias = parcial.gracias !== undefined ? parcial.gracias === true : base?.gracias === true;
  const fila: LandingConfig = {
    url: nueva,
    ...(fids.length ? { funnelIds: fids } : {}),
    ...(gracias ? { gracias: true } : {}),
  };
  // Se conserva la POSICIÓN al editar: en un desplegable, que un renglón salte al
  // final porque le corregiste una letra es desconcertante.
  const lista = base
    ? actuales.map((c) => (c.url === (prev ?? nueva) ? fila : c))
    : [...actuales, fila];
  const sinRepetir: LandingConfig[] = [];
  for (const c of lista) if (!sinRepetir.some((x) => x.url === c.url)) sinRepetir.push(c);
  return sinRepetir.slice(0, MAX_LANDINGS);
}

export function sinLanding(actuales: LandingConfig[], url: string): LandingConfig[] {
  const u = normalizarUrl(url);
  return u ? actuales.filter((c) => c.url !== u) : actuales;
}

/** Las URLs, para lo que todavía razona con la lista vieja. */
export const urlsDe = (configs: LandingConfig[]): string[] => configs.map((c) => c.url);
