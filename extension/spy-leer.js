// =============================================================================
// «Guardar en Spy»: lee lo que la pestaña YA dibujó y lo devuelve. Nada más.
// =============================================================================
// Lo inyecta el desplegable (`chrome.scripting.executeScript`, sólo `activeTab`) cuando la persona toca
// «Guardar en la ficha de X» o «Agregar como competidor». No es un content script: no corre en ningún
// sitio hasta ese clic, y corre una vez.
//
// ⚠️ NO INTERPRETA. Acá no se decide qué es un anuncio, un píxel ni un checkout: eso vive en el servidor
// (lib/spy-captura.ts). Una página ajena cambia su diseño sin avisar, y arreglar la lectura con un deploy
// son minutos; con una versión de la extensión es otra revisión de Chrome.
//
// LO QUE NO HACE, y lo mira tests/spy-captura.test.ts:
//   · no mueve la página: ni scroll, ni clics, ni foco. Lee lo que ya está dibujado;
//   · no lee valores de formularios, cookies ni almacenamiento;
//   · no pide nada a la red y no escribe en la página;
//   · no corre en MAIN: el mundo aislado no ve las variables de la página.
//
// De un sitio cualquiera sólo salen DIRECCIONES y su título: nada del texto. La persona puede tocar el
// botón con una sesión abierta, y lo que ese sitio le muestra a ella no es asunto de MaKo.
//
// Script clásico y sin barra-asterisco dentro de un texto (AGENTS.md, «La extensión en el sitio de un
// tercero»). La última expresión es lo que recibe quien lo inyectó.
// =============================================================================

(() => {
  // Los únicos parámetros que salen. El resto de una consulta es donde viajan el correo del visitante,
  // su identificador de cliente y los tokens de sesión.
  const PARAMS_QUE_DICEN_QUE_ES = ['id', 'tid', 'sdkid', 'u', 'view_all_page_id'];
  const TOPE = { direcciones: 500, nodos: 12000, textoPorNodo: 4000, textoDeEnlace: 400, textoTotal: 600000 };

  /** La dirección con sólo los parámetros de arriba. Lo que no es http(s) no sale. */
  const limpia = (crudo) => {
    let u;
    try { u = new URL(crudo, location.href); } catch { return null; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const params = new URLSearchParams();
    for (const p of PARAMS_QUE_DICEN_QUE_ES) if (u.searchParams.has(p)) params.set(p, u.searchParams.get(p));
    const q = params.toString();
    return `${u.origin}${u.pathname}${q ? `?${q}` : ''}`;
  };

  /** Una lista de direcciones sin repetidos y con tope. */
  const direcciones = (lista) => {
    const out = new Set();
    for (const d of lista) {
      const l = d ? limpia(d) : null;
      if (l) out.add(l);
      if (out.size >= TOPE.direcciones) break;
    }
    return [...out];
  };

  const leerSitio = () => ({
    modo: 'sitio',
    url: limpia(location.href),
    titulo: (document.title || '').slice(0, 300),
    recursos: direcciones((performance.getEntriesByType('resource') || []).map((r) => r.name)),
    scripts: direcciones([...document.scripts].map((s) => s.src)),
    enlaces: direcciones([...document.querySelectorAll('a[href]')].map((a) => a.href)),
    iframes: direcciones([...document.querySelectorAll('iframe[src]')].map((f) => f.src)),
    formularios: direcciones([...document.forms].map((f) => f.getAttribute('action'))),
  });

  // ── La Biblioteca: lo dibujado, en orden y sin decidir qué es qué ──────────────────────────
  // Etiquetas que no son la página, o que guardan lo que escribió la persona.
  const NO_SE_LEE = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION']);
  const ES_CDN = (src) => { try { return /(^|\.)fbcdn\.net$/.test(new URL(src).hostname); } catch { return false; } };

  const leerBiblioteca = () => {
    const tokens = [];
    let nodos = 0;
    let texto = 0;
    const raya = (s) => s.replace(/[\s\p{Cf}]+/gu, ' ').trim();
    const visita = (n, adentroDeEnlace) => {
      if (nodos++ > TOPE.nodos || texto > TOPE.textoTotal) return;
      if (n.nodeType === Node.TEXT_NODE) {
        if (adentroDeEnlace) return;
        const t = raya(n.nodeValue || '');
        if (t) { texto += t.length; tokens.push(['t', t.slice(0, TOPE.textoPorNodo)]); }
        return;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      const tag = n.tagName.toUpperCase();
      if (NO_SE_LEE.has(tag) || n.isContentEditable) return;
      if (n.checkVisibility && !n.checkVisibility()) return;
      if (tag === 'A' && n.href && !adentroDeEnlace) {
        // Con sus renglones: dominio, titular, descripción y botón. El servidor los necesita separados.
        const t = (n.innerText || '').split('\n').map(raya).filter(Boolean).join('\n').slice(0, TOPE.textoDeEnlace);
        texto += t.length;
        tokens.push(['a', limpia(n.href), t]);
        for (const h of n.childNodes) visita(h, true);
        return;
      }
      if (tag === 'IMG') {
        const src = n.currentSrc || n.src;
        // La firma del CDN está en la consulta y sin ella la imagen no abre. Es de la imagen, no de la persona.
        if (src && ES_CDN(src)) tokens.push(['i', src, n.naturalWidth || 0, n.naturalHeight || 0, (n.alt || '').slice(0, 200)]);
        return;
      }
      if (tag === 'VIDEO') {
        // Sólo la imagen de portada. El video no se baja ni se apunta.
        if (n.poster && ES_CDN(n.poster)) tokens.push(['v', n.poster]);
        return;
      }
      for (const h of n.childNodes) visita(h, adentroDeEnlace);
    };
    visita(document.body, false);
    // De la dirección de la Biblioteca también sirve lo que se buscó: dice de quién es lo que se ve.
    const aca = new URL(location.href);
    return {
      modo: 'biblioteca',
      url: limpia(location.href),
      busqueda: (aca.searchParams.get('q') || '').slice(0, 200),
      pagina: (aca.searchParams.get('view_all_page_id') || '').slice(0, 30),
      id: (aca.searchParams.get('id') || '').slice(0, 30),
      tokens,
      cortado: nodos > TOPE.nodos || texto > TOPE.textoTotal,
    };
  };

  const host = location.hostname.replace(/^www\./, '');
  // Dos veces, y a propósito: el desplegable no ofrece el botón en estos sitios, y si un día lo ofreciera
  // por error, acá no sale nada. Un chat de WhatsApp no se manda a ningún lado por un bug de una pantalla.
  if (/(^|\.)(web\.whatsapp\.com|hola-mako\.com|labs\.google|flow\.google\.com)$/.test(host)) return { modo: 'prohibido' };
  return /^(?:[\w-]+\.)?facebook\.com$/.test(host) && location.pathname.startsWith('/ads/library') ? leerBiblioteca() : leerSitio();
})();
