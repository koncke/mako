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
export function analizarHtml(url: string, html: string): AnalisisLanding {
  const a = VACIO(url, null);
  a.ok = true;
  const h = html;
  const bajo = h.toLowerCase();
  const add = (p: PiezaLanding) => a.piezas.add(p);

  // ── Video ──────────────────────────────────────────────────────────────────
  a.videos = videosDeHtml(url, h);
  if (/<video[\s>]/i.test(h)) add('video-nativo');
  if (/pandavideo|player-vz-/i.test(bajo)) add('video-panda');
  if (/youtube\.com\/embed|youtu\.be\//i.test(bajo)) add('video-youtube');
  if (/player\.vimeo\.com/i.test(bajo)) add('video-vimeo');

  // ── Cómo capta ─────────────────────────────────────────────────────────────
  if (/<form[\s>]/i.test(h)) add('formulario');
  // El CTA embebido es la pieza que MÁS cambia la prueba: lo que la persona hace
  // dentro de ese iframe es de otro dominio y ningún pixel del mundo lo ve.
  // ⚠️ Sin exigir el dominio: Calendly se embebe con `class="calendly-inline-widget"`
  // y su script, no siempre con un iframe a calendly.com. Buscar el dominio dejaba
  // fuera justo la forma más común de embeberlo — la que usa la landing que
  // destapó esto.
  if (/calendly|cal\.com\/|hubspot|typeform|tally\.so/i.test(bajo)) add('embed-agenda');
  if (/wa\.me\/|api\.whatsapp\.com|web\.whatsapp\.com/i.test(bajo)) add('link-whatsapp');

  // Botones propios: se excluyen los que son parte del chrome del navegador o de
  // un iframe. Un <a> con href cuenta; uno sin href, no — no navega a ningún lado.
  const botones = (h.match(/<button[\s>]/gi) ?? []).length + (h.match(/<a\s[^>]*href=/gi) ?? []).length;
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
    return analizarHtml(url, html);
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
