// =============================================================================
// landing-analisis — qué tiene ESTA landing, para no pedirle lo que no tiene
// =============================================================================
// El snippet ya lleva TODOS los detectores: video nativo, iframes de Panda,
// clics, formularios. Lo que faltaba es que la app sepa CUÁLES aplican a cada
// página, y hasta ahora lo adivinaba por los eventos que habían llegado — o sea,
// después de la prueba, que es justo cuando ya no sirve.
//
// Acá se lee el HTML de la landing ANTES de probar. Con eso los pasos de la
// prueba se arman a medida: a quien tiene un Calendly embebido y ningún botón
// propio no se le pide que haga clic en un botón, y a quien no tiene video no se
// le pide que reproduzca uno. Un paso que en esa página no se puede cumplir se
// queda en rojo para siempre y entrena a ignorar la lista entera.
//
// ⚠️ Sin `server-only` a propósito: lo que se puede equivocar es la DETECCIÓN
// sobre el HTML, y tiene que poder testearse con un string en vez de con una
// página real. El fetch vive afuera.
// =============================================================================

export type PiezaLanding =
  | 'video-nativo' | 'video-panda' | 'video-youtube' | 'video-vimeo'
  | 'formulario' | 'embed-agenda' | 'link-whatsapp' | 'botones' | 'pixel';

/**
 * Un video que está EN la página, con dónde verlo.
 *
 * ⚠️ EXISTE PARA QUE VER UN VIDEO NO DEPENDA DE QUE ALGUIEN LO REPRODUZCA. La URL
 * de un video llegaba en el evento `play` y en ningún otro lado, así que la
 * pantalla que pide NOMBRAR los videos no podía mostrarlos hasta que un visitante
 * mirara uno — la pregunta al revés. Panda resolvió su caso por API; esto resuelve
 * el resto (un <video> puesto a mano, un YouTube, un Vimeo), que no tienen API ni
 * la necesitan: el dato está en el HTML de la página.
 */
export type VideoEnPagina = {
  /** El MISMO id que manda el snippet, para poder casarlos. Ver `idNativo`. */
  id: string;
  /** Dónde se mira. Absoluta. */
  url: string;
  tipo: 'nativo' | 'panda' | 'youtube' | 'vimeo';
};

export type AnalisisLanding = {
  url: string;
  piezas: Set<PiezaLanding>;
  /** Los videos que la página TIENE, con su URL. Independiente de los eventos. */
  videos: VideoEnPagina[];
  /** El token del Pixel que trae la página, si lo trae. Es lo que permite decir
   *  «esta landing tiene el código de OTRO workspace», que pasa al copiar y pegar
   *  entre clientes y es invisible de cualquier otra forma. */
  tokenPixel: string | null;
  /** La versión del snippet instalada EN ESTA PÁGINA. */
  versionPixel: number | null;
  /** El proyecto de Clarity que trae la página, si lo trae. */
  clarityProjectId: string | null;
  ok: boolean;
  error: string | null;
};

const VACIO = (url: string, error: string | null): AnalisisLanding =>
  ({ url, piezas: new Set(), videos: [], tokenPixel: null, versionPixel: null, clarityProjectId: null, ok: false, error });

/**
 * El id que el snippet le pone a un <video> nativo.
 *
 * ⚠️ ESTA REGLA VIVE DOS VECES y no se puede evitar: acá en TypeScript, y adentro
 * del snippet, que es un string de JavaScript que corre en la página del cliente y
 * por lo tanto no puede importar nada de este módulo. Si las dos se separan, los
 * videos de la página dejan de casar con los eventos EN SILENCIO — la lista queda
 * con dos filas para el mismo video y ninguna con URL. Lo único que lo impide es
 * el test que corre las dos derivaciones sobre los mismos casos.
 *
 * La regla, textual: el `id` del elemento si lo tiene; si no, el nombre del
 * archivo del `src` (sin query, hasta 80 caracteres).
 */
export function idNativo(idAttr: string | null, src: string | null): string | null {
  const i = idAttr?.trim();
  if (i) return `v:${i}`;
  const s = src?.trim();
  if (!s) return null;
  return `v:${(s.split('/').pop() ?? '').split('?')[0].slice(0, 80)}`;
}

const atrib = (tag: string, nombre: string): string | null => {
  const m = new RegExp(`${nombre}\\s*=\\s*["']([^"']+)["']`, 'i').exec(tag);
  return m ? m[1] : null;
};

/** Relativa → absoluta. Un `src="/videos/x.mp4"` no se puede abrir por sí solo. */
function absoluta(base: string, u: string): string | null {
  try { return new URL(u, base).toString(); } catch { return null; }
}

/**
 * Los videos que hay en el HTML, con su URL, sin ejecutar la página.
 *
 * Mismo límite honesto que el resto del analizador: una landing que monta el video
 * por JavaScript puede no traerlo en el HTML inicial. Devolver de menos es correcto
 * —el botón simplemente no aparece—; devolver mal sería peor.
 */
export function videosDeHtml(base: string, html: string): VideoEnPagina[] {
  const out: VideoEnPagina[] = [];
  const visto = new Set<string>();
  const push = (v: VideoEnPagina) => { if (!visto.has(v.id)) { visto.add(v.id); out.push(v); } };

  // ── <video> nativo ─────────────────────────────────────────────────────────
  for (const m of html.matchAll(/<video\b([^>]*)>([\s\S]{0,600}?)<\/video>|<video\b([^>]*)\/?>/gi)) {
    const attrs = m[1] ?? m[3] ?? '';
    const dentro = m[2] ?? '';
    const src = atrib(attrs, 'src') ?? atrib(dentro.match(/<source\b[^>]*>/i)?.[0] ?? '', 'src');
    const id = idNativo(atrib(attrs, 'id'), src);
    const url = src ? absoluta(base, src) : null;
    // Sin URL no sirve de nada: el punto entero es poder abrirlo.
    if (id && url) push({ id, url, tipo: 'nativo' });
  }

  // ── Panda ──────────────────────────────────────────────────────────────────
  // El id que manda el snippet es el `v=` del embed, así que casan directo.
  for (const m of html.matchAll(/https?:\/\/[^"'\s]*player-vz-[^"'\s]*[?&]v=([0-9a-fA-F-]{36})/g)) {
    push({ id: m[1], url: m[0].replace(/&amp;/g, '&'), tipo: 'panda' });
  }

  // ── YouTube y Vimeo ────────────────────────────────────────────────────────
  for (const m of html.matchAll(/https?:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([\w-]{6,20})/g)) {
    push({ id: m[1], url: `https://www.youtube.com/watch?v=${m[1]}`, tipo: 'youtube' });
  }
  for (const m of html.matchAll(/https?:\/\/player\.vimeo\.com\/video\/(\d{6,12})/g)) {
    push({ id: m[1], url: `https://vimeo.com/${m[1]}`, tipo: 'vimeo' });
  }

  return out;
}

/**
 * Qué hay en este HTML.
 *
 * ⚠️ Se buscan las piezas por su MARCA en el HTML servido, no ejecutando la
 * página. Eso tiene un límite honesto que hay que decir en pantalla: una landing
 * armada con un builder que monta todo por JavaScript puede no traer nada de esto
 * en el HTML inicial. Por eso la ausencia de una pieza NUNCA apaga su chequeo del
 * todo — lo baja a «no parece que tengas esto», que es lo que sabemos.
 */
/**
 * Las piezas que se pueden buscar en JAVASCRIPT MINIFICADO sin equivocarse.
 *
 * ⚠️ NO son las mismas que en el HTML, y la diferencia es la precisión. Los
 * detectores de HTML buscan etiquetas —`<video`, `<button`— y en un bundle esas
 * cadenas aparecen por cualquier motivo: un componente de librería que nadie
 * renderiza, un string de ayuda, una plantilla muerta. Medido acá: escanear el
 * bundle marcaba `video-nativo` y `botones` en una landing que no tiene ninguno
 * de los dos — su único CTA es un Calendly embebido, y sus botones son piezas de
 * shadcn que ni se montan.
 *
 * Lo que SÍ sobrevive a la minificación es una URL de tercero: `calendly.com`,
 * `wa.me`, `player-vz-`. Esas no se escriben por casualidad. Por eso del bundle
 * solo se leen las piezas que se identifican por un DOMINIO, y las que dependen
 * de una etiqueta se siguen leyendo únicamente del HTML.
 */
const DEL_BUNDLE: Array<[PiezaLanding, RegExp]> = [
  // `app.cal.com/embed` y `data-cal-link` van explícitos: son las marcas que deja
  // @calcom/embed-react, que es como se embebe Cal.com de verdad en una app de
  // React. `cal\.com` a secas las cubre, pero nombrarlas dice DÓNDE mirar cuando
  // esto vuelva a fallar — y ya falló una vez, por el tope de scripts de arriba.
  ['embed-agenda', /calendly\.com|typeform\.com|hubspot\.com\/meetings|savvycal\.com|cal\.com|data-cal-link|cal-inline/i],
  ['link-whatsapp', /wa\.me\/|api\.whatsapp\.com/i],
  ['video-panda', /pandavideo|player-vz-/i],
  ['video-youtube', /youtube\.com\/embed|youtu\.be\//i],
  ['video-vimeo', /player\.vimeo\.com/i],
];

/**
 * El HTML sin lo que NO es la página del cliente.
 *
 * ⚠️ EL ANALIZADOR SE ESTABA LEYENDO A SÍ MISMO. Medido el 2026-08-16 sobre una
 * landing real: decía que tenía un `<video>` nativo y botones propios, y no tiene
 * ninguno de los dos. El `<video>` salía de los COMENTARIOS de nuestro propio
 * snippet —que va inline en la página y explica, en castellano, cómo mide un
 * `<video controls>`— y el `<button>` era el botón de cerrar del badge de
 * Lovable, que es chrome del hosting y no un CTA.
 *
 * Las consecuencias no eran cosméticas: con `botones` en true, el chequeo «hacé
 * clic en tus botones» se le pedía para siempre a una página cuyo único CTA es un
 * Calendly embebido —0 clics en 7 días, y con razón—, y ese renglón en rojo
 * permanente es exactamente lo que entrena a ignorar la lista entera.
 *
 * Se saca, en este orden y por este motivo:
 *   · `<script>` y `<style>` — una etiqueta escrita ADENTRO de código o de CSS
 *     nunca es un elemento de la página. Es de donde salía el `<video>`.
 *   · el badge del hosting — es del proveedor, no del negocio.
 * Se hace DESPUÉS de leer el token y la versión del Pixel, que justamente viven
 * en un `<script>`.
 */
function sinRuido(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[a-z-]+\b[^>]*id=["']lovable-badge[^"']*["'][\s\S]{0,4000}?<\/[a-z-]+>/gi, ' ');
}

export function analizarHtml(url: string, html: string, bundle = ''): AnalisisLanding {
  const a = VACIO(url, null);
  a.ok = true;
  const h = html;
  // ⚠️ TODOS los detectores de la PÁGINA miran el HTML limpio. `bajo` quedaba
  // matcheando nuestro propio snippet: la línea `/pandavideo/i.test(...)` del
  // código hacía que cualquier landing con el Pixel puesto —incluida una cuyo
  // video es un <video> común— apareciera con «video de Panda».
  const bajo = sinRuido(h).toLowerCase();
  const add = (p: PiezaLanding) => a.piezas.add(p);

  // ── Video ──────────────────────────────────────────────────────────────────
  a.videos = videosDeHtml(url, h);
  // Sobre el HTML LIMPIO: un `<video` escrito adentro de un comentario de
  // JavaScript no es un video de la página. Ver `sinRuido`.
  const limpio = sinRuido(h);
  if (/<video[\s>]/i.test(limpio)) add('video-nativo');
  if (/pandavideo|player-vz-/i.test(bajo)) add('video-panda');
  if (/youtube\.com\/embed|youtu\.be\//i.test(bajo)) add('video-youtube');
  if (/player\.vimeo\.com/i.test(bajo)) add('video-vimeo');

  // ── Cómo capta ─────────────────────────────────────────────────────────────
  if (/<form[\s>]/i.test(limpio)) add('formulario');
  // El CTA embebido es la pieza que MÁS cambia la prueba: lo que la persona hace
  // dentro de ese iframe es de otro dominio y ningún pixel del mundo lo ve.
  // ⚠️ Sin exigir el dominio: Calendly se embebe con `class="calendly-inline-widget"`
  // y su script, no siempre con un iframe a calendly.com. Buscar el dominio dejaba
  // fuera justo la forma más común de embeberlo — la que usa la landing que
  // destapó esto.
  // ⚠️ `data-cal-link` y `cal-inline` van en el detector de HTML, no solo en el del
  // bundle: son las marcas que deja el embed de Cal en el propio markup, y sin
  // ellas una landing que lo monta así solo se detectaba de casualidad —cuando el
  // chunk que lo carga resulta ser del mismo origen y entra en los que se bajan.
  if (/calendly|cal\.com\/|data-cal-link|cal-inline|hubspot|typeform|tally\.so/i.test(bajo)) add('embed-agenda');
  if (/wa\.me\/|api\.whatsapp\.com|web\.whatsapp\.com/i.test(bajo)) add('link-whatsapp');

  // Botones propios: se excluyen los que son parte del chrome del navegador o de
  // un iframe. Un <a> con href cuenta; uno sin href, no — no navega a ningún lado.
  // Sobre el HTML LIMPIO: el boton de cerrar del badge del hosting no es un CTA
  // del negocio, y el `<button` de un ejemplo dentro de un script tampoco.
  const botones = (limpio.match(/<button[\s>]/gi) ?? []).length + (limpio.match(/<a\s[^>]*href=/gi) ?? []).length;
  if (botones > 0) add('botones');

  // ── El Pixel ───────────────────────────────────────────────────────────────
  const tok = /var TOKEN = '([^']+)'/.exec(h);
  if (tok) { a.tokenPixel = tok[1]; add('pixel'); }
  const sv = /var SV = (\d+)/.exec(h);
  if (sv) a.versionPixel = Number(sv[1]);
  // Los espacios del snippet son opcionales: un minificador los saca, y el
  // regex con espacios fijos no encontraba nada en una página comprimida.
  const cl = /clarity\.ms\/tag\/([a-z0-9]+)|"clarity"\s*,\s*"script"\s*,\s*"([a-z0-9]+)"/i.exec(h);
  if (cl) a.clarityProjectId = (cl[1] || cl[2] || '').toLowerCase() || null;

  // Lo del bundle se suma DESPUÉS y solo con los detectores de arriba: nunca
  // puede quitar una pieza que el HTML sí tenía.
  for (const [pieza, re] of DEL_BUNDLE) if (bundle && re.test(bundle)) add(pieza);

  return a;
}

/**
 * Baja la landing y la analiza.
 *
 * Falla hacia «no sé», nunca hacia «no tiene»: si la página no se puede leer
 * —está caída, bloquea a los bots, tarda demasiado— la prueba tiene que ofrecer
 * TODOS los pasos, no ninguno. Un análisis fallido que apaga chequeos esconde
 * justo los problemas que la prueba viene a encontrar.
 */
/**
 * El JavaScript propio de la página, concatenado.
 *
 * Solo scripts del MISMO origen y con extensión .js: no se baja el SDK de nadie
 * —no aporta marcas de esta landing y son megas— ni nada de otro dominio.
 */
async function bundlesDe(url: string, html: string, fetchImpl: typeof fetch): Promise<string> {
  const base = new URL(url);
  const srcs: string[] = [];
  for (const m of html.matchAll(/<script[^>]+src\s*=\s*["']([^"']+)["']/gi)) {
    let abs: URL;
    try { abs = new URL(m[1], base); } catch { continue; }
    if (abs.origin !== base.origin) continue;
    if (!/\.[mc]?js(\?|$)/i.test(abs.pathname + abs.search)) continue;
    srcs.push(abs.toString());
    // ⚠️ ERAN 3, Y EL TOPE SE COMÍA JUSTO LA PIEZA QUE IMPORTABA. La landing del
    // ws13 sirve OCHO chunks y el que monta su agenda de Cal.com es el quinto:
    // con el corte en 3 no se bajaba nunca, así que el analizador informaba «no
    // tiene agenda» sobre la página cuyo único CTA es agendar. El costo real de
    // subirlo, medido en esa misma landing: los 8 chunks suman 621 KB — el tope
    // estaba cuidando un gasto que no existe. Cada uno sigue cortado a 3 MB y con
    // 8 s de timeout, que es lo que de verdad acota esto.
    if (srcs.length >= 8) break;
  }
  if (!srcs.length) return '';
  const partes = await Promise.all(srcs.map(async (u) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetchImpl(u, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MaKoPixel/1.0)' } });
      return r.ok ? (await r.text()).slice(0, 3_000_000) : '';
    } catch { return ''; } finally { clearTimeout(t); }
  }));
  return partes.join('\n');
}

export async function analizarLanding(url: string, fetchImpl: typeof fetch = fetch): Promise<AnalisisLanding> {
  if (!url) return VACIO(url, 'Sin dirección');
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetchImpl(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      // Se pide como un navegador: varios hosts devuelven un HTML distinto (o un
      // 403) a un user-agent que no reconocen, y ahí el análisis diría que la
      // página no tiene nada.
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MaKoPixel/1.0; +https://hola-mako.com)' },
    });
    clearTimeout(t);
    if (!r.ok) return VACIO(url, `La página respondió ${r.status}.`);
    const html = (await r.text()).slice(0, 2_000_000);

    // ⚠️ EN UNA SPA EL HTML NO TIENE NADA, Y ESO NO ES «no tiene nada». La landing
    // de un cliente hecha con React trae un `<div id="root">` vacío: el video, el
    // Calendly y los botones los monta el JavaScript. Analizando solo el HTML, el
    // resultado era «no encontré ninguna pieza» — y como «no sé» y «no tiene» se
    // trataban igual río abajo, los chequeos salían al revés: se le pedía «hacé
    // clic en tus botones» a una página cuyo único CTA es un Calendly embebido, y
    // se le ofrecía el chequeo del formulario a un negocio que vende por agenda.
    //
    // El bundle SÍ lo tiene todo. Es el mismo texto y los mismos detectores; lo
    // único que cambia es de dónde sale. Se bajan como máximo 3 scripts propios y
    // se corta a 3 MB: el punto es encontrar marcas, no leer el programa.
    const extra = await bundlesDe(url, html, fetchImpl).catch(() => '');
    return analizarHtml(url, html, extra);
  } catch (e) {
    const msg = e instanceof Error && e.name === 'AbortError'
      ? 'La página tardó demasiado en responder.'
      : 'No se pudo leer la página.';
    return VACIO(url, msg);
  }
}

/** ¿Esta landing tiene algún video que el Pixel pueda medir? */
export function tieneVideoMedible(a: AnalisisLanding): boolean {
  return a.piezas.has('video-nativo') || a.piezas.has('video-panda');
}

/**
 * Los videos que el Pixel NO puede medir, para poder DECIRLO.
 *
 * YouTube y Vimeo no emiten los eventos que escuchamos: sin su API propia, un
 * video ahí es invisible. Callarlo deja al cliente esperando una retención que no
 * va a llegar nunca.
 */
export function videosNoMedibles(a: AnalisisLanding): string[] {
  const out: string[] = [];
  if (a.piezas.has('video-youtube')) out.push('YouTube');
  if (a.piezas.has('video-vimeo')) out.push('Vimeo');
  return out;
}
