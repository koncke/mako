// =============================================================================
// ¿Lo que se ve de una página ajena es la página de verdad? (4/11/2026)
// =============================================================================
// El Cerebro, con «Sus páginas» de Competitors Spy: «`viralidad.com` muestra un 500 enorme adentro del iframe, y la página está
// viva» y, con `linktw.in/pywydg`, «el iframe muestra el archivo triste gris de Chrome. Ese iframe roto se dibuja como si fuera la
// página… no se muestra hasta confirmar que abrió bien, y un acortador se resuelve primero a su destino final… Dejá de mostrar
// iframes que no se puedan verificar».
//
// Dos preguntas, y cada una tiene su lado:
//  · el SERVIDOR, antes de mostrar nada: ¿la dirección es un acortador que manda a otra? Un acortador que redirige por HTTP ya lo
//    sigue la lectura de siempre (lib/landing-fetch.ts); éste es el que redirige con una etiqueta o con JavaScript, que adentro del
//    marco se va a una página que no se deja mostrar y Chrome pinta su error (`redireccionDelCliente`);
//  · la PANTALLA, mientras abre: el marco avisa cuánto texto pintó, el principio de ese texto y su título (el protocolo del
//    Diagnóstico, lib/editor-landing/diagnostico.ts). Sólo con ese aviso, y con algo que no sea una página de error, se muestra
//    (`marcoVerificado`). Si la página se va a otra parte, ese aviso no llega: no se verifica y no se muestra.
//
// Sin `server-only` y sin imports: la usan la ruta, la pantalla y los tests.
// =============================================================================

/**
 * ¿Lo que se PINTÓ es la página de error de la página, y no la página? Mira el título y el principio del texto visible, que es lo
 * único que dice una página de error. Corta a propósito: una página que habla de errores en su texto (un blog sobre el «error 404»)
 * tiene más texto que esto.
 */
export function esPaginaDeError(muestra: string, titulo = ''): boolean {
  const t = (muestra ?? '').replace(/\s+/g, ' ').trim();
  const cab = (titulo ?? '').replace(/\s+/g, ' ').trim();
  if (/^(?:error\s*)?(?:4\d\d|5\d\d)\b(?:\s*[:|·-]|\s*$)|^(?:internal server error|bad gateway|service unavailable|page not found|not found|application error)\b/i.test(cab)) return true;
  if (t.length > 220) return false;
  // El número solo, o seguido de lo que dice un error («500 Internal…», «404: …»): «500 personas compraron» es una página.
  // «This page couldn’t load · Reload to try again, or go back» es el error de cliente de Next.js nuevo (11/11/2026, mirado con
  // capturas): acquisition.com pinta bien, avisa que pintó, y su propio JavaScript se rompe en el marco aislado y deja eso.
  return /^(?:error\s*)?(?:4\d\d|5\d\d)(?:\s*$|\s*[:|·-]|\s+(?:internal|server|error|not found|bad|service|this page|page|página))|internal server error|application error: a (?:client|server)-side exception|this page could not be found|this page couldn['’]?t load|reload to try again, or go back|something went wrong|bad gateway|service unavailable|página no encontrada|algo salió mal/i.test(t);
}

/** Lo que una página sin contenido propio puede tener como texto y seguir siendo «sólo una redirección». */
const TEXTO_DE_UN_ACORTADOR = 300;

/**
 * Las veces que el JS de una página se manda a otra parte: `location = …`, `location.href = …`, `location.replace(…)` o
 * `location.assign(…)`. Cuenta las ASIGNACIONES, también las que mandan a una variable: `location.search` o
 * `locationTargeting` no son mandarse a ninguna parte.
 */
const MANDA_A_OTRA_PARTE = /\blocation(?:\.href)?\s*=(?!=)|\blocation\.(?:replace|assign)\s*\(/gi;

/** El texto que se ve de un HTML, sin scripts, estilos ni etiquetas. Aproximado a propósito: sólo decide «tiene contenido o no». */
function textoVisible(html: string): string {
  return html
    .replace(/<(script|style|noscript|template)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function absoluta(destino: string, base: string): string | null {
  try {
    const u = new URL(destino.trim().replace(/&amp;/g, '&'), base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const b = new URL(base);
    // La misma página (con o sin la barra del final) no es una redirección.
    if (u.origin === b.origin && u.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, '') && u.search === b.search) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * ¿Esta página es sólo una redirección hecha en el navegador (un acortador, un «cargando…»)? Devuelve a dónde manda, o `null`.
 *
 *  · `<meta http-equiv="refresh" content="0;url=…">` con una espera de hasta 5 s;
 *  · `location.href = "…"`, `location = "…"`, `location.replace("…")` o `location.assign("…")` con la dirección escrita;
 *
 * y SÓLO en una página casi sin texto propio: en una página de verdad, un `location.href = "…"` es un botón o un menú, y seguirlo
 * mostraría otra página que la que es. La dirección tiene que ser http o https y distinta de la misma página.
 */
export function redireccionDelCliente(html: string, base: string): string | null {
  if (!html) return null;
  const visible = textoVisible(html);
  if (visible.length > TEXTO_DE_UN_ACORTADOR) return null;

  for (const etiqueta of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (!/http-equiv\s*=\s*["']?refresh["']?/i.test(etiqueta)) continue;
    const contenido = etiqueta.match(/content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i);
    const c = contenido?.[1] ?? contenido?.[2] ?? '';
    const m = c.match(/^\s*(\d+(?:\.\d+)?)?\s*[;,]?\s*url\s*=\s*['"]?([^'"]+)['"]?\s*$/i);
    if (m && Number(m[1] ?? 0) <= 5) {
      const a = absoluta(m[2], base);
      if (a) return a;
    }
  }

  const js = (html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/gi) ?? []).join('\n');
  // ⚠️ MEDIDO contra `linktw.in/pywydg` el 6/11/2026, el acortador de verdad: su JS se manda a DIEZ lugares distintos (la app
  // de Android, la de iOS, Chrome por `googlechrome://`, el destino calculado) y el ÚNICO escrito con la dirección a la vista es
  // su rama de error, `location.replace('/expired')`. Seguir el primero literal devolvía `linktw.in/expired` —su página de «link
  // expirado»— como si fuera la página del competidor. Una página que puede mandar a más de un lado no se sigue: no se sabe
  // cuál corre, y acá «no sé» se dibuja «Abrir», nunca un destino inventado.
  if ((js.match(MANDA_A_OTRA_PARTE) ?? []).length > 1) return null;
  const patrones = [
    /\blocation(?:\.href)?\s*=\s*(["'])(https?:\/\/[^"']+|\/[^"']*)\1/i,
    /\blocation\.(?:replace|assign)\(\s*(["'])(https?:\/\/[^"']+|\/[^"']*)\1\s*\)/i,
  ];
  for (const re of patrones) {
    const m = js.match(re);
    if (m) {
      const a = absoluta(m[2], base);
      if (a) return a;
    }
  }
  return null;
}

/**
 * ¿Esta página no tiene contenido propio y sólo manda a otra parte, sin que se pueda saber a dónde? Es un acortador o un
 * «continuar en…»: NO es la página que se quería ver, así que no se muestra en un marco (queda «Abrir»). `redireccionDelCliente`
 * responde la otra mitad: a dónde manda, cuando se puede saber.
 */
export function soloRedirige(html: string): boolean {
  if (!html) return false;
  if (textoVisible(html).length > TEXTO_DE_UN_ACORTADOR) return false;
  if ((html.match(/<meta\b[^>]*>/gi) ?? []).some((e) => /http-equiv\s*=\s*["']?refresh["']?/i.test(e))) return true;
  const js = (html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/gi) ?? []).join('\n');
  return (js.match(MANDA_A_OTRA_PARTE) ?? []).length > 0;
}

/** Cuántas redirecciones hechas en el navegador se siguen: un acortador que manda a otro acortador, y no más. */
export const SALTOS_DEL_CLIENTE = 3;

/**
 * La página a la que manda una dirección, siguiendo las redirecciones hechas en el navegador (las de HTTP ya las sigue `bajar`).
 * Se corta a los `SALTOS_DEL_CLIENTE`: dos páginas que se mandan una a la otra no son un bucle infinito. Si bajar falla, tira.
 */
export async function paginaFinal(
  url: string,
  bajar: (u: string) => Promise<{ html: string; final: string }>,
): Promise<{ html: string; final: string }> {
  let pagina = await bajar(url);
  for (let i = 0; i < SALTOS_DEL_CLIENTE; i++) {
    const destino = redireccionDelCliente(pagina.html, pagina.final);
    if (!destino) break;
    pagina = await bajar(destino);
  }
  return pagina;
}

/** Lo mínimo que tiene que pintar una página para contar como «abrió»: menos que esto es una página en blanco o un «cargando…». */
export const TEXTO_MINIMO_PINTADO = 60;

/** Un aviso del marco del Diagnóstico (`gmDg: 1`): cuánto texto pintó, el principio y el título. */
export type AvisoDelMarco = { tipo?: unknown; texto?: unknown; muestra?: unknown; titulo?: unknown };

/**
 * ¿Con este aviso del marco, lo que se ve es la página de verdad? `'si'` = mostrarla; `'no'` = es su página de error, no se
 * muestra; `'espera'` = todavía no pintó lo suficiente (sigue la espera, y si no llega a tiempo, no se muestra).
 */
export function marcoVerificado(a: AvisoDelMarco): 'si' | 'no' | 'espera' {
  // El documento de error de la ruta del Diagnóstico (no pudo bajar la página) avisa así.
  if (a.tipo === 'error') return 'no';
  if (a.tipo !== 'pinto' && a.tipo !== 'listo') return 'espera';
  const muestra = typeof a.muestra === 'string' ? a.muestra : '';
  const titulo = typeof a.titulo === 'string' ? a.titulo : '';
  if (esPaginaDeError(muestra, titulo)) return 'no';
  const texto = typeof a.texto === 'number' ? a.texto : -1;
  return texto >= TEXTO_MINIMO_PINTADO ? 'si' : 'espera';
}
