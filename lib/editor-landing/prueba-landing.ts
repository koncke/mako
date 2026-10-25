// =============================================================================
// prueba-landing — las reglas PURAS para servir una prueba A/B de una landing (Landing AI, L2; 25/10/2026)
// =============================================================================
// docs/diseno-pruebas-ab.md, L2: servir el A/B desde `responderPublico` (lib/editor-landing/pagina-publica.ts), con el
// motor de lib/pruebas/ que arma Automations (A1/A2: `asignar`, el store, `prueba_variantes.contenido` con la foto de B).
// Esto es lo que NO depende del motor, y lo fija la crítica (Anexo 2 §E), que manda sobre el diseño:
//
//   1. B TIENE LA MISMA ESTRUCTURA QUE A, o se rechaza (§E.22). Las rutas laterales leen la foto de A: el iframe de un
//      bloque `htmlLibre` (/l/html/<docId>/<bloque>) y el pago (`publicado.pagos`). Una B con otro botón de pago u otro
//      formulario cobraría o capturaría contra lo que A declara. Y el Landing AI nunca toca precio, oferta, links,
//      formularios, pagos ni Pixel (decisión 8). Se compara lo que la foto GUARDA (config, pagos, htmlLibre, título y
//      descripción de cada página) y lo que el HTML de cada página LLEVA: destinos, formularios, iframes, scripts y las
//      marcas de precio. Como multiconjuntos: subir una sección cambia el ORDEN, no qué hay.
//   2. QUIÉN VA SIEMPRE A A (§E.25): sólo lo de MaKo. El lector (`?mako_leer`) y la vigilancia y el análisis (que piden
//      con el User-Agent `MaKoPixel/`). NUNCA una regla por User-Agent para terceros: con Google es cloaking, y con Meta el
//      anuncio se aprobaría mirando A mientras la gente ve B. Los bots igual quedan fuera de la cuenta: no corren el Pixel.
//   3. LA RAMA VIVE EN UNA COOKIE PROPIA DEL SERVIDOR (§E.26): `mko_ab_<prueba>`, HttpOnly, que se renueva en cada
//      respuesta. La del visitante la reescribe el Pixel por JavaScript, y Safari corta esas a los 7 días.
//   4. CON PRUEBA, la respuesta es privada y varía por cookie (`private, no-cache` + `Vary: Cookie`): hoy es `public`.
//
// ⚠️ PURO (sin base, sin Next): lo prueba tests/prueba-landing.test.ts.
// =============================================================================

/** La marca del User-Agent con que pide MaKo (lib/landing-analisis.ts, `UA_COMO_NAVEGADOR` y `UA_BOT`). */
export const MARCA_UA_MAKO = 'MaKoPixel/';
/** El parámetro del lector (lib/editor-landing/lector.ts, `PARAM_LEER`). */
export const PARAM_LECTOR = 'mako_leer';

/** Lo que una foto publicada tiene (`FotoPublicada`, publicar.ts), en lo que la guarda mira. */
export type FotoComparable = {
  paginas: ReadonlyArray<{ ruta: string; titulo?: string | null; descripcion?: string | null; html: string }>;
  config?: unknown;
  pagos?: unknown;
  htmlLibre?: unknown;
};

/** JSON estable (claves ordenadas): dos objetos iguales dan el mismo texto aunque sus claves vengan en otro orden. */
function estable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(estable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as Record<string, unknown>).sort().map((k) => `${JSON.stringify(k)}:${estable((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

const atributo = (etiqueta: string, nombre: string): string | null =>
  new RegExp(`\\s${nombre}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(etiqueta)?.slice(1).find((x) => x !== undefined) ?? null;

/** Lo que una página LLEVA y B no puede cambiar, como lista ordenada (un multiconjunto): destinos, formularios, iframes, scripts y precios. */
export function piezasDeHtml(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<(a|area)\b[^>]*>/gi)) {
    const href = atributo(m[0], 'href');
    if (href !== null) out.push(`enlace ${href}`);
  }
  for (const m of html.matchAll(/<form\b[^>]*>/gi)) out.push(`formulario ${atributo(m[0], 'action') ?? ''} ${atributo(m[0], 'method') ?? ''}`.trim());
  for (const m of html.matchAll(/<(input|select|textarea|button)\b[^>]*>/gi)) {
    const nombre = atributo(m[0], 'name');
    const tipo = m[1].toLowerCase() === 'input' || m[1].toLowerCase() === 'button' ? atributo(m[0], 'type') ?? '' : m[1].toLowerCase();
    if (nombre !== null || m[1].toLowerCase() !== 'button') out.push(`campo ${m[1].toLowerCase()} ${nombre ?? ''} ${tipo}`.trim());
  }
  for (const m of html.matchAll(/<(iframe|script|embed|object)\b[^>]*>/gi)) {
    const src = atributo(m[0], 'src') ?? atributo(m[0], 'data');
    out.push(`${m[1].toLowerCase()} ${src ?? '(en línea)'}`);
  }
  // Las marcas de precio y de prueba gratis (precios-en-landing.ts): «Nunca toca precio ni oferta».
  for (const m of html.matchAll(/\sdata-mako-(desde|precio|planes|prueba)(?:\s*=\s*"([^"]*)")?/gi)) out.push(`precio ${m[1]}=${m[2] ?? ''}`);
  return out.sort();
}

/** Lo que cambia entre dos multiconjuntos, para decirlo (las primeras diferencias de cada lado). */
function diferencia(a: readonly string[], b: readonly string[]): { faltan: string[]; sobran: string[] } {
  const cuenta = new Map<string, number>();
  for (const x of a) cuenta.set(x, (cuenta.get(x) ?? 0) + 1);
  const sobran: string[] = [];
  for (const x of b) {
    const n = cuenta.get(x) ?? 0;
    if (n > 0) cuenta.set(x, n - 1); else sobran.push(x);
  }
  const faltan = [...cuenta.entries()].flatMap(([x, n]) => Array<string>(n).fill(x));
  return { faltan, sobran };
}

/**
 * Por qué B NO puede servirse junto a A (vacío = puede). Cada motivo dice qué cambió, para que la propuesta del
 * Landing AI se corrija o se descarte con el porqué a la vista.
 */
export function diferenciasDeEstructura(a: FotoComparable, b: FotoComparable): string[] {
  const motivos: string[] = [];
  if (estable(a.config) !== estable(b.config)) motivos.push('cambia la configuración de la landing (el sitio, el Pixel o el Píxel de Meta)');
  if (estable(a.pagos) !== estable(b.pagos)) motivos.push('cambian los productos que cobran sus botones de pago');
  if (estable(a.htmlLibre) !== estable(b.htmlLibre)) motivos.push('cambia un bloque de HTML personalizado');
  const rutasA = a.paginas.map((p) => p.ruta).join('|');
  const rutasB = b.paginas.map((p) => p.ruta).join('|');
  if (rutasA !== rutasB) {
    motivos.push('cambian las páginas de la landing');
    return motivos;
  }
  a.paginas.forEach((pa, i) => {
    const pb = b.paginas[i];
    const nombre = pa.ruta ? `la página «${pa.ruta}»` : 'la página de inicio';
    if ((pa.titulo ?? '') !== (pb.titulo ?? '') || (pa.descripcion ?? '') !== (pb.descripcion ?? '')) motivos.push(`cambia el título o la descripción de ${nombre} (lo que muestran Google y los anuncios)`);
    const d = diferencia(piezasDeHtml(pa.html), piezasDeHtml(pb.html));
    if (d.faltan.length || d.sobran.length) {
      const muestra = [...d.faltan.slice(0, 2).map((x) => `sin «${x}»`), ...d.sobran.slice(0, 2).map((x) => `con «${x}» de más`)].join(', ');
      motivos.push(`cambia lo que ${nombre} lleva (enlaces, formularios, pagos, videos o precios): ${muestra}`);
    }
  });
  return motivos;
}

/** ¿Este pedido lo hace MaKo (el lector, la vigilancia o el análisis)? Esos ven SIEMPRE A, sin cookie ni asignación. */
export function vaFijoEnA(p: { url: string; userAgent: string | null | undefined }): boolean {
  if ((p.userAgent ?? '').includes(MARCA_UA_MAKO)) return true;
  try { return new URL(p.url).searchParams.has(PARAM_LECTOR); } catch { return false; }
}

/** El nombre de la cookie de la rama de una prueba (sólo letras, números, «_» y «-» del id: nunca un `;` adentro). */
export function nombreCookiePrueba(pruebaId: string | number): string {
  return `mko_ab_${String(pruebaId).replace(/[^A-Za-z0-9_-]/g, '')}`;
}

/** Cuánto vive la cookie de la rama: se renueva en cada respuesta, así que es desde la última visita. */
export const VIDA_COOKIE_PRUEBA_S = 90 * 86_400;

/** La cabecera `Set-Cookie` de la rama: del servidor, HttpOnly (el Pixel no la toca), Lax y del host. */
export function cookieDePrueba(pruebaId: string | number, rama: string, segura: boolean): string {
  const valor = rama.replace(/[^A-Za-z0-9_-]/g, '');
  return `${nombreCookiePrueba(pruebaId)}=${valor}; Path=/; Max-Age=${VIDA_COOKIE_PRUEBA_S}; HttpOnly; SameSite=Lax${segura ? '; Secure' : ''}`;
}

/** La rama que dice la cookie, si es una de las que la prueba tiene activas; si no, null (se asigna de nuevo). */
export function ramaDeCookie(cabeceraCookie: string | null | undefined, pruebaId: string | number, activas: readonly string[]): string | null {
  const nombre = nombreCookiePrueba(pruebaId);
  for (const parte of String(cabeceraCookie ?? '').split(';')) {
    const i = parte.indexOf('=');
    if (i < 0 || parte.slice(0, i).trim() !== nombre) continue;
    const v = parte.slice(i + 1).trim();
    return activas.includes(v) ? v : null;
  }
  return null;
}

/** Las cabeceras de caché de una página CON prueba corriendo: privada y por cookie (sin prueba, todo sigue como hoy). */
export const CABECERAS_CON_PRUEBA: Readonly<Record<string, string>> = { 'Cache-Control': 'private, no-cache', Vary: 'Cookie' };
