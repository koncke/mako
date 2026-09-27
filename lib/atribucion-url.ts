// =============================================================================
// atribucion-url — de qué anuncio vino una visita, leído de su propia URL
// =============================================================================
// Sin `server-only` a propósito: lo importa la ruta del opt-in y lo importa un
// test. No toca la base ni el entorno — es una función pura sobre un string.
//
// ⚠️ POR QUÉ EXISTE, Y ES UNA MEDICIÓN. El snippet de la landing manda al opt-in
// `nombre, email, telefono, empresa, origen_captura, pagina, prueba` — y NO manda
// los UTM. La ruta, en cambio, los lee (`utm_source: txt(body.utm_source)`, …) y
// se los pasa a `createLead`. O sea: cuatro campos escritos en el server que el
// cliente nunca alimentó. Es «escribir la salida no es ofrecerla», del lado del
// que recibe.
//
// Medido el 27/09/2026 sobre producción:
//
//   ws 13 (Código Inmobiliario) ·   21 leads · anuncio 0 · campaña 0 · UTM 0
//                                   21 de 21 AGENDADOS sin un solo dato de origen
//   ws  1 (Mauricio)            · 1000 leads · anuncio 951 · campaña 995
//
// La diferencia no es el CRM: es POR DÓNDE ENTRA el lead. Los de Mauricio vienen
// del instant form de Meta, que entrega el `ad_id` en el webhook. Los de Código
// Inmobiliario vienen de un FORMULARIO DE LANDING, y ese camino no llevaba nada.
// Por eso «parecía que ya estaba bien»: estaba bien para el único cliente que se
// miraba.
//
// ⚠️ Y SE LEE DE `pagina`, NO SÓLO DE CAMPOS PROPIOS, y eso es deliberado. El
// snippet vive PEGADO en la página del cliente: cambiarlo obliga a que cada uno
// vuelva a copiar el código, y este repo ya tiene un cron que persigue a los que
// quedaron en una versión vieja. `pagina` es `location.href` y YA viaja desde la
// v1 — así que leer los UTM de ahí le devuelve el origen a todos los clientes que
// ya están instalados, hoy, sin que nadie toque su landing. El snippet nuevo los
// manda explícitos porque es más robusto (sobrevive a un form en otra página);
// esto es el piso que no depende de nadie.

/** Lo que una URL de aterrizaje puede contar sobre de dónde vino la persona. */
export type Atribucion = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  /** El clic de Meta. Es lo único que identifica el anuncio cuando no hay UTM. */
  fbclid: string | null;
};

export const ATRIBUCION_VACIA: Atribucion = {
  utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, fbclid: null,
};

/** Un valor de query que sirve: recortado, no vacío y con un techo. */
function valor(v: string | null): string | null {
  if (!v) return null;
  const t = v.trim();
  // 200 es holgado para un nombre de campaña y corta un querystring envenenado.
  return t && t.length <= 200 ? t : t ? t.slice(0, 200) : null;
}

/**
 * Los parámetros de atribución de una URL.
 *
 * Tolera basura: si `href` no es una URL, devuelve todo en null en vez de tirar.
 * Una atribución que no se pudo leer no puede romper el alta de un lead — el lead
 * vale mucho más que saber de dónde vino.
 */
export function atribucionDeUrl(href: string | null | undefined): Atribucion {
  if (!href) return { ...ATRIBUCION_VACIA };
  let q: URLSearchParams;
  try {
    q = new URL(href).searchParams;
  } catch {
    // Puede venir sólo el querystring, o una URL relativa.
    const i = href.indexOf('?');
    if (i < 0) return { ...ATRIBUCION_VACIA };
    q = new URLSearchParams(href.slice(i + 1));
  }
  return {
    utm_source: valor(q.get('utm_source')),
    utm_medium: valor(q.get('utm_medium')),
    utm_campaign: valor(q.get('utm_campaign')),
    utm_content: valor(q.get('utm_content')),
    fbclid: valor(q.get('fbclid')),
  };
}

/**
 * Lo que mandó el cliente, completado con lo que diga la URL.
 *
 * ⚠️ EL BODY GANA, SIEMPRE. Lo que el snippet manda explícito es lo que capturó en
 * la PRIMERA página; la URL del opt-in puede ser la de un paso posterior, donde
 * los parámetros ya se perdieron. Esto RELLENA huecos, no corrige — un campo que
 * el cliente mandó no se pisa nunca.
 */
export function conAtribucion(
  delBody: Partial<Atribucion>,
  pagina: string | null | undefined,
): Atribucion {
  const url = atribucionDeUrl(pagina);
  return {
    utm_source: valor(delBody.utm_source ?? null) ?? url.utm_source,
    utm_medium: valor(delBody.utm_medium ?? null) ?? url.utm_medium,
    utm_campaign: valor(delBody.utm_campaign ?? null) ?? url.utm_campaign,
    utm_content: valor(delBody.utm_content ?? null) ?? url.utm_content,
    fbclid: valor(delBody.fbclid ?? null) ?? url.fbclid,
  };
}

/** ¿Sabemos de dónde vino? Para decidir si vale la pena contarlo. */
export const hayAtribucion = (a: Atribucion): boolean =>
  !!(a.utm_source || a.utm_medium || a.utm_campaign || a.utm_content || a.fbclid);
