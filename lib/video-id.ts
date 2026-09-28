// =============================================================================
// video-id — UN video, UN id
// =============================================================================
// Sin `server-only`: lo llama el beacon, lo llama el catálogo, lo llama el
// analizador y lo llaman los tests. Si viviera detrás de `server-only` la regla
// quedaría sin red justo donde más duele, igual que `exigirClienteDePrueba`.
//
// ⚠️ POR QUÉ EXISTE ESTE MÓDULO. El snippet tiene OCHO ramas que paren un
// `video_id`, cada una con su propio prefijo, y ninguna comparte código con otra.
// Dos de ellas pueden ver el MISMO elemento: la rama propia de Wistia lo reconoce
// por su FORMA (`mediaId` + `percentWatched`) y emite `w:<id>`, y el enganche
// genérico acepta a cualquier custom element con API de media y emite
// `<etiqueta>:<id>`, o sea `wistia-player:<id>`. Las dos escuchan los mismos
// play/pause/time-update en captura sobre `document`.
//
// Medido en producción el 27/09/2026 sobre el VSL de un cliente: 348 plays con un
// id y 348 con el otro, los 348 pares dentro de 2 segundos (uno de ellos con 6 ms
// de diferencia, tráfico pago real de Instagram y dos visitantes distintos). Las
// reproducciones salían al doble y la curva de retención quedaba partida entre dos
// videos que ninguna pantalla sabía que eran el mismo.
//
// Y hay un TERCER id para la misma media, que no sale de ningún evento: el
// analizador del HTML (`videosDeHtml`) emite `wistia:<id>` para el embed clásico.
// Ese fue el que terminó guardado en `landing.videos` como EL VSL de ese cliente,
// apuntando a un id que jamás apareció en un evento: cero cruces, curva vacía.
//
// ⚠️ Y POR QUÉ LA CANONICALIZACIÓN VA EN EL SERVIDOR Y NO (SÓLO) EN EL SNIPPET.
// El snippet va PEGADO en la página del cliente, así que arreglarlo no arregla a
// nadie hasta que cada uno repegue el código. Medido el 27/09/2026 en
// `landing_visits.sv`: el ws1 corre la v14 con 3.304 visitas, el ws13 la v16 con
// 607, el ws14 la v15 — y CERO clientes en v17 o v18. La v16 es justamente la que
// introdujo las dos ramas que chocan (commit 3319ab20), así que cada
// reproducción de ese VSL seguía pariendo el id duplicado DESPUÉS de arreglar el
// snippet y DESPUÉS de borrar el histórico. El servidor es el único punto que
// alcanza a los clientes con código viejo.
//
// Decisión de Martín, 27/09/2026: «es error nuestro permitir que un mismo video
// pueda tener varios ID, eso debemos controlarlo para que esto no pase».
// =============================================================================

/**
 * Los alias que se colapsan, EN POSITIVO y con el porqué de cada uno.
 *
 * ⚠️ Lista blanca, y es la regla de la casa. La alternativa —«normalizá cualquier
 * `<algo>-player:` al prefijo del proveedor»— adivina: el día que aparezca un
 * `<mi-player>` que envuelva a otro player, colapsar por patrón fundiría dos
 * videos DISTINTOS en una sola curva, que es peor que partir uno en dos. Un alias
 * se agrega cuando alguien comprobó que las dos formas nombran la misma media.
 *
 * ⚠️ Y EL ORDEN IMPORTA: se prueba el más largo primero. Sin eso, `wistia:` nunca
 * se alcanzaría si algún día entrara un alias que lo tenga como prefijo.
 */
export const ALIAS_VIDEO_ID: ReadonlyArray<{ de: string; a: string; porque: string }> = [
  {
    de: 'wistia-player:',
    a: 'w:',
    porque:
      'El enganche genérico por custom element arma el id con el NOMBRE DE LA ETIQUETA, y el ' +
      'de Wistia es <wistia-player>. La rama propia de Wistia mide el mismo elemento por su ' +
      'forma y emite w:. La clave que va después de los dos puntos es el mismo mediaId, medido.',
  },
  {
    de: 'wistia:',
    a: 'w:',
    porque:
      'El analizador del HTML emite wistia: para el embed clásico y el iframe, y w: para el ' +
      'custom element — el mismo hashedId de la misma media. Era una decisión deliberada ' +
      '(estaba fijada en un test) y es la que Martín revirtió el 27/09/2026.',
  },
];

/** Los prefijos que quedan después de canonizar. Un id sin prefijo es de Panda. */
export const PREFIJOS_CANONICOS = ['v:', 'w:', 'yt:', 'vimeo:', 'drive:'] as const;

const ALIAS_ORDENADOS = [...ALIAS_VIDEO_ID].sort((a, b) => b.de.length - a.de.length);

/** Tope de la columna `vsl_events.video_id` y de los ids del catálogo. */
export const MAX_VIDEO_ID = 120;

/**
 * El id con el que ESE video se conoce en todo el producto.
 *
 * Devuelve null cuando no hay id, que es distinto de un id vacío: un evento sin
 * video (un `pageview`, un `click`) no tiene que inventarse uno.
 *
 * ⚠️ NO TOCA LA CLAVE, sólo el prefijo. La parte de después de los dos puntos es
 * el id del proveedor y ahí no hay nada que normalizar — bajarla a minúsculas
 * rompería los hashedId de Wistia y los ids de YouTube, que distinguen caso.
 */
export function canonizarVideoId(raw: unknown, max = MAX_VIDEO_ID): string | null {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return null;
  for (const al of ALIAS_ORDENADOS) {
    // El prefijo se compara sin distinguir caso (una etiqueta HTML puede llegar en
    // mayúsculas); la clave se conserva tal cual.
    if (s.toLowerCase().startsWith(al.de)) return (al.a + s.slice(al.de.length)).slice(0, max);
  }
  return s.slice(0, max);
}

/**
 * ¿Este id nombra un video, o es un relleno por POSICIÓN?
 *
 * Cinco de las ocho ramas del snippet caen a un fallback posicional cuando no
 * encuentran clave: `iframe0`, `v:pos0`, `<etiqueta>:pos0`, `wistia:iframe0` y el
 * literal `vimeo:iframe`. Ninguno es una identidad — dos videos anónimos en dos
 * páginas distintas son ambos `iframe0`, reordenar la página cambia el número, y
 * el de Vimeo no tiene ni índice, así que TODOS los Vimeo no identificados de una
 * página son el mismo id.
 *
 * No se descartan: son la prueba de que alguien reprodujo algo. Lo que no pueden
 * es ofrecerse como un video NOMBRABLE ni sostener una curva de retención, porque
 * la fila de mañana puede ser de otro video.
 */
export function esIdPosicional(id: string | null | undefined): boolean {
  const v = canonizarVideoId(id) ?? '';
  if (!v) return false;
  const clave = v.includes(':') ? v.slice(v.indexOf(':') + 1) : v;
  return /^(pos\d*|iframe\d*)$/i.test(clave);
}

/**
 * ¿El id declara de qué host viene?
 *
 * Reemplaza al `/^[a-z]{1,6}:/i` que vivía en `lib/leads.ts`, que contestaba
 * **false** para toda la familia por etiqueta —`wistia-player:`, `mux-player:`,
 * `lite-youtube:`— medido el 27/09/2026. La consecuencia no era cosmética: con la
 * respuesta en false, esos ids caían al respaldo «la única duración conocida», que
 * es la de Panda, y se les calculaba el porcentaje de avance con la duración de
 * OTRO video.
 *
 * Después de canonizar, un id con prefijo es cualquiera que traiga `:` con algo a
 * los dos lados. Un UUID pelado (Panda) no lo trae, y eso es exactamente lo que
 * esta función tiene que distinguir.
 */
export function idDeclaraHost(id: string | null | undefined): boolean {
  const v = canonizarVideoId(id) ?? '';
  const i = v.indexOf(':');
  return i > 0 && i < v.length - 1;
}
