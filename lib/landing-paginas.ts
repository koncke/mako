// =============================================================================
// landing-paginas — las páginas del workspace, guardadas
// =============================================================================
// Hasta el 14/08/2026 la lista de landings salía de `landing_visits.landing_url`:
// las páginas que se habían OBSERVADO, no las que el negocio dice tener. Eso
// alcanzaba para ofrecerlas en la prueba, pero no se podía corregir una URL mal
// escrita, ni borrar una que se dio de baja, ni agregar la que todavía no
// recibió una sola visita — que es justo la que uno quiere probar.
//
// Guardadas en `app_settings` y no en una tabla propia: son un puñado de URLs
// por workspace, sin relaciones ni historial, y el patrón ya existe acá al lado
// (`landing_token`, `landing.snippet_version`). Una tabla para esto sería una
// migración y un modelo nuevo para guardar una lista de strings.
//
// El módulo NO lleva `server-only`: la normalización y el dedupe son la parte
// que se puede equivocar (dos URLs que son la misma con distinta barra final) y
// tiene que poder testearse.
// =============================================================================

export const PAGINAS_KEY = 'landing.paginas';

/** Tope: si alguien tiene más de esto, el desplegable dejó de ser un desplegable. */
export const MAX_PAGINAS = 12;

/**
 * Normaliza una URL para poder compararlas.
 *
 * Sin esto, `https://x.com/` y `https://x.com` son dos entradas distintas en la
 * lista y el mismo lugar aparece dos veces. Se saca la barra final, se baja el
 * host a minúsculas (el path NO: hay servidores que distinguen) y se tira el
 * hash, que nunca identifica una página distinta para lo que hacemos acá.
 */
/**
 * Colapsa el host de un PREVIEW DE DEPLOY al de la página de verdad.
 *
 * ⚠️ EL CASO QUE LO OBLIGÓ. Netlify le da a cada deploy una URL inmutable con el
 * id del deploy adelante — `6a7f350eb436ad1a599d0dcb--que-es-lidermente.netlify.app`
 * — y el snippet mide en todas. Una clienta que publicaba varias veces por día
 * terminó con SIETE renglones en el desplegable, todos la misma página, y con la
 * medición repartida entre ellos: la retención de su landing quedaba dividida en
 * siete pedazos sin que nada lo dijera.
 *
 * Se colapsa solo cuando el prefijo es inconfundiblemente un id de deploy: 20+
 * caracteres hexadecimales (los de Netlify son 24). Eso deja intactos los deploys
 * por rama —`staging--sitio.netlify.app`, `preview--sitio.netlify.app`— que SÍ son
 * lugares distintos y no hay que fundir. Vercel también arma previews con hash
 * pero los pega con guiones simples, sin separador propio: ahí no se puede
 * distinguir un preview de un proyecto que se llama así, y adivinar sería peor
 * que dejarlos separados.
 */
/**
 * Parámetros que hablan de la VISITA, no de la página.
 *
 * Se sacan antes de comparar dos URLs. Sin esto, la misma landing aparece una vez
 * por cada campaña que le manda tráfico — y una vez por cada prueba nuestra, que
 * fue como se descubrió: `mko_test` cambia en cada corrida del probador.
 *
 * Lo que NO va acá: un parámetro que cambia el CONTENIDO (`?plan=pro`, `?v=2`).
 * Ese sí hace que sean dos páginas distintas, y borrarlo las fundiría.
 */
const PARAMS_DE_MEDICION = [
  'mko_test',                                        // el nuestro, el del probador
  'l',                                               // el token de lead del snippet
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'gclid', 'fbclid', 'msclkid', 'ttclid', 'twclid',  // click-ids de las plataformas
  'gad_source', 'gbraid', 'wbraid', 'igshid', 'mc_cid', 'mc_eid', 'ref', '_ga',
  // Los del editor de Lovable: el sha del build que estás viendo, el id de esa
  // carga y el flag que esconde su badge. Los tres cambian en cada recarga del
  // editor, así que sin esto una tarde de edición deja veinte renglones.
  '__lovable_sha', '__lovable_load_id', 'forceHideBadge',
];

function hostCanonico(hostname: string): string {
  const h = hostname.toLowerCase();
  const m = /^([0-9a-f]{20,})--(.+)$/.exec(h);
  return m ? m[2] : h;
}

/**
 * ¿Es la vista previa del EDITOR (no del sitio publicado)?
 *
 * ⚠️ POR QUÉ ESTO NO SE COLAPSA COMO NETLIFY, que es la parte que no es obvia.
 * Un preview de deploy de Netlify **es el sitio real** congelado en una versión:
 * quien entra ahí es un visitante, así que fundirlo con producción suma tráfico
 * de verdad. El preview del editor de Lovable no es eso — es el iframe donde el
 * dueño está construyendo la página, recargando decenas de veces por tarde.
 * Colapsarlo metería esas sesiones de desarrollo adentro del denominador de la
 * tasa de conversión de su landing, y la tasa se hundiría sin que nada lo diga.
 * Por eso se EXCLUYE de lo que se ofrece, igual que una página escondida, y sus
 * visitas quedan bajo su propio host en vez de sumarse a las del negocio.
 *
 * Medido el 15/08/2026 en `landing_visits` del ws 1, en UN día, para una sola
 * landing (`multiplicatusresultados.com`):
 *
 *     id-preview--<uuid>.lovable.app?__lovable_sha=…
 *     id-preview-734641ee--<uuid>.lovable.app?forceHideBadge=true
 *     <uuid>.lovableproject.com?__lovable_load_id=…
 *
 * Ninguno matchea `^[0-9a-f]{20,}--`: el primero tiene un prefijo con letras, el
 * segundo tampoco es hexadecimal puro y el tercero ni siquiera lleva `--`.
 *
 * ⚠️ Y NO alcanza con «es de Lovable». Un cliente sin dominio propio publica de
 * verdad en `<proyecto>.lovable.app`, y esa SÍ es su landing: excluirla lo
 * dejaría sin nada que elegir. Lo que se excluye es solo lo inconfundiblemente
 * del editor — el prefijo `id-preview`, y `lovableproject.com` entero, que es el
 * sandbox del proyecto y nunca la dirección que se publica.
 */
export function esPreviewDeEditor(crudo: string): boolean {
  const u = normalizarUrl(crudo);
  if (!u) return false;
  let h: string;
  try { h = new URL(u).hostname; } catch { return false; }
  return h === 'lovableproject.com'
    || h.endsWith('.lovableproject.com')
    || /^id-preview[-.].+\.lovable\.app$/.test(h);
}

/**
 * LA `normalizarUrl` del repo (hay UNA desde el 15/10/2026): «¿qué PÁGINA es ésta?». Es la llave de
 * `landing.paginas`, `landing.config`, `landing.snapshot` y del cruce con `landing_visits`. La del Landing
 * Analyst se llamaba igual y contesta otra pregunta: es `claveDeLanding` (lib/landing-url.ts, la cabecera
 * dice por qué no se deriva de ésta). La forma no cambia sin migrar lo guardado: tests/landing-url-unica.test.ts.
 */
export function normalizarUrl(crudo: string): string | null {
  const s = (crudo ?? '').trim();
  if (!s) return null;
  // Sin esquema no se puede rutear ni abrir: se asume https en vez de rechazar,
  // porque «tu-pagina.com» es lo que la gente escribe.
  const conEsquema = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(conEsquema);
    if (!u.hostname.includes('.')) return null;
    u.hash = '';
    // ⚠️ LOS PARÁMETROS DE MEDICIÓN NO IDENTIFICAN UNA PÁGINA. El primero de la
    // lista es NUESTRO: cada prueba abre la landing con `?mko_test=<id>` distinto,
    // así que el propio probador llenaba la lista de páginas con copias de la
    // misma — «se están creando duplicados por el tema de pruebas de MaKo». Los
    // UTM y los click-ids de las plataformas son el mismo caso: dicen de dónde
    // vino esta VISITA, no qué página es.
    for (const p of PARAMS_DE_MEDICION) u.searchParams.delete(p);
    const path = u.pathname.replace(/\/+$/, '');
    return `${u.protocol}//${hostCanonico(u.hostname)}${u.port ? `:${u.port}` : ''}${path}${u.search}`;
  } catch {
    return null;
  }
}

/**
 * La dirección con la que se ABRE la landing en la prueba (app/integraciones/ProbarTracking.tsx), o null
 * si no es una página web.
 *
 * ⚠️ SEGURIDAD (verificación de la tanda 6, 15/10/2026). Desde la tanda 6 la pestaña de la landing se abre
 * VACÍA en el clic (`window.open('about:blank')`, para detectar el bloqueo de las emergentes), y un
 * `about:blank` abierto por MaKo es DEL MISMO ORIGEN que hola-mako.com. Se navegaba con lo escrito tal
 * cual, y el chequeo del botón sólo pide «un punto»: `javascript:alert(1)//.xx` lo pasa y corría con
 * nuestro origen (y la ventana de la prueba recibe la landing por `?l=`, así que un link armado lo
 * dejaba a un clic de «Probar»). Sólo http(s), validado con `new URL`, y se navega con lo validado.
 * Sin esquema se asume https, como en `normalizarUrl` («tu-pagina.com» es lo que la gente escribe; antes
 * se resolvía RELATIVA a MaKo y abría un 404 nuestro). A diferencia de `normalizarUrl`, la query y el
 * hash quedan: son los de la persona, y la prueba los necesita.
 */
export function urlParaAbrir(crudo: string | null | undefined): string | null {
  const s = (crudo ?? '').trim();
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if ((u.protocol !== 'https:' && u.protocol !== 'http:') || !u.hostname.includes('.')) return null;
    return u.href;
  } catch {
    return null;
  }
}

/**
 * Las páginas que la persona ESCONDIÓ de la lista.
 *
 * Existe porque «borrar» una página detectada era una promesa que no se podía
 * cumplir: las detectadas salen de los eventos, así que la próxima visita la
 * vuelve a traer y el botón queda como si no hubiera hecho nada. O se guarda que
 * la escondieron, o no se ofrece borrarlas — y no ofrecerlas dejaba la lista de
 * Leila SIN un solo botón, porque todas sus páginas eran detectadas.
 *
 * El tope es más alto que el de guardadas: cada deploy preview de Netlify es una
 * URL nueva, y son justo las que uno quiere sacar de encima.
 */
export const OCULTAS_KEY = 'landing.paginas_ocultas';
export const MAX_OCULTAS = 60;

function parsearLista(crudo: string | null, max: number): string[] {
  if (!crudo?.trim()) return [];
  let lista: unknown;
  try { lista = JSON.parse(crudo); } catch { return []; }
  if (!Array.isArray(lista)) return [];
  const out: string[] = [];
  for (const x of lista) {
    const u = typeof x === 'string' ? normalizarUrl(x) : null;
    if (u && !out.includes(u)) out.push(u);
  }
  return out.slice(0, max);
}

/** Las páginas guardadas, saneadas y sin repetidos. Tolera un JSON roto. */
export function parsearPaginas(crudo: string | null): string[] {
  return parsearLista(crudo, MAX_PAGINAS);
}

export function parsearOcultas(crudo: string | null): string[] {
  return parsearLista(crudo, MAX_OCULTAS);
}

/** Agrega una a las escondidas. Las más nuevas primero: si se llena el tope, lo
 *  que se pierde es lo más viejo, que es lo que menos probable que vuelva. */
export function conOculta(actuales: string[], url: string): string[] {
  const u = normalizarUrl(url);
  if (!u) return actuales;
  return [u, ...actuales.filter((x) => x !== u)].slice(0, MAX_OCULTAS);
}

/**
 * ¿Son la misma página? Compara NORMALIZADO.
 *
 * Comparar los strings crudos parecía alcanzar y no alcanzaba: la lista guardada
 * está normalizada y lo que la persona tipeó, no. Al guardar «tu-pagina.com» la
 * lista pasaba a tener «https://tu-pagina.com» y el `includes` daba false, así
 * que los botones de editar y borrar DESAPARECÍAN justo después de guardar.
 */
export function mismaPagina(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = a ? normalizarUrl(a) : null;
  const y = b ? normalizarUrl(b) : null;
  return !!x && !!y && x === y;
}

/**
 * Agrega o REEMPLAZA una página. `anterior` es lo que convierte «guardar» en
 * «editar»: sin eso, corregir una URL mal escrita deja las dos en la lista.
 *
 * Devuelve la lista nueva, o null si la URL no es válida — el caller decide qué
 * decirle a la persona; acá no se inventa un valor para no fallar.
 */
export function conPagina(actuales: string[], url: string, anterior?: string | null): string[] | null {
  const nueva = normalizarUrl(url);
  if (!nueva) return null;
  const prev = anterior ? normalizarUrl(anterior) : null;
  // Se conserva la POSICIÓN al editar: la lista es un desplegable y que un
  // renglón salte al final porque le corregiste una letra es desconcertante.
  const base = prev ? actuales.map((u) => (u === prev ? nueva : u)) : [...actuales, nueva];
  const sinRepetir: string[] = [];
  for (const u of base) if (!sinRepetir.includes(u)) sinRepetir.push(u);
  return sinRepetir.slice(0, MAX_PAGINAS);
}

/** Saca una página de la lista. */
export function sinPagina(actuales: string[], url: string): string[] {
  const u = normalizarUrl(url);
  return u ? actuales.filter((x) => x !== u) : actuales;
}
