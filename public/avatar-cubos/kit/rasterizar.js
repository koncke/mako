/* RASTER — el cuadro del segundo T, sacado del MISMO navegador, sin servidor (19/11/2026).
 * El DOM de #stage en ese segundo pasa a un SVG con <foreignObject> que lleva adentro su CSS y sus fuentes como data:. La
 * pantalla dibuja ese SVG en su canvas y lo codifica (app/ai-avatar/cubos/mp4.ts). Medido contra la captura de Playwright de
 * la galería: diferencia media 0,03-0,17 sobre 255, sin un píxel distinto (docs/hallazgos-video-pipeline.md).
 *
 * EL PERSONAJE VA POR CAPAS: pasar su <canvas> de Three.js a PNG en cada cuadro costaba ~0,58 s de los ~0,6 s del cuadro
 * (medido en Chromium sin GPU). Ahora salen DOS SVG —lo que está debajo del personaje y lo que está encima— y la pantalla
 * pega el canvas en el medio con drawImage, sin codificarlo. Si el canvas está bajo una opacidad, un filtro o una rotación
 * (no se puede pegar igual), vuelve al PNG adentro del SVG.
 *   await RASTER.preparar()   → junta el CSS y mete las fuentes (sólo «latin»: el español entra entero) como data:
 *   RASTER.capas(t)           → { abajo: svg, lienzo: <canvas>|null, caja: {x,y,w,h}, arriba: svg|null } del segundo t
 * ⚠️ El SVG se dibuja desde data: y NO desde blob: — con blob: Chrome marca el canvas como «tainted» y no deja sacar el cuadro.
 */
(function () {
  var CSS = null;
  function b64(buf) { var s = '', b = new Uint8Array(buf); for (var i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
  // Google Fonts parte cada familia por alfabeto con un comentario arriba: queda sólo «latin» (tiene á é í ó ú ñ ¿ ¡)
  function soloLatin(css) { return css.replace(/\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{[^}]*\}/g, function (m, sub) { return sub === 'latin' ? m : ''; }); }
  async function adentro(css, base) {
    var urls = [], re = /url\((['"]?)([^'")]+)\1\)/g, m;
    while ((m = re.exec(css))) if (m[2].indexOf('data:') !== 0 && urls.indexOf(m[2]) < 0) urls.push(m[2]);
    for (var i = 0; i < urls.length; i++) {
      var abs = new URL(urls[i], base).href, r = await fetch(abs), buf = await r.arrayBuffer();
      var tipo = /\.woff2(\?|$)/.test(abs) ? 'font/woff2' : (r.headers.get('content-type') || 'application/octet-stream');
      css = css.split(urls[i]).join('data:' + tipo + ';base64,' + b64(buf));
    }
    return css;
  }
  async function preparar() {
    if (CSS) return CSS.length;
    var partes = [], links = document.querySelectorAll('link[rel=stylesheet]'), estilos = document.querySelectorAll('style');
    for (var i = 0; i < links.length; i++) {
      var css = await (await fetch(links[i].href)).text();
      if (/fonts\.googleapis/.test(links[i].href)) css = soloLatin(css);
      partes.push(await adentro(css, links[i].href));
    }
    for (var j = 0; j < estilos.length; j++) partes.push(await adentro(estilos[j].textContent, location.href));
    CSS = partes.join('\n');
    return CSS.length;
  }
  function envolver(html, fondo) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><foreignObject x="0" y="0" width="1080" height="1920">'
      + '<div xmlns="http://www.w3.org/1999/xhtml" class="' + document.body.className + '" style="position:relative;width:1080px;height:1920px;overflow:hidden;background:' + fondo + '">'
      + '<style><![CDATA[' + CSS.split(']]>').join(']]]]><![CDATA[>') + ']]></style>' + html + '</div></foreignObject></svg>';
  }
  function sinPosicion(c) { c.style.transform = 'none'; c.style.left = '0px'; c.style.top = '0px'; return c; }
  // ¿se puede pegar el canvas con drawImage y que quede igual? sólo si lo que lo envuelve es traslado y escala
  function pegable(cv, st) {
    for (var el = cv; el && el !== st.parentNode; el = el.parentElement) {
      var cs = getComputedStyle(el);
      if (cs.opacity !== '1' || cs.filter !== 'none' || cs.mixBlendMode !== 'normal' || cs.clipPath !== 'none') return false;
      if (el !== st && cs.transform !== 'none') { var mt = new DOMMatrix(cs.transform); if (Math.abs(mt.b) > 1e-6 || Math.abs(mt.c) > 1e-6 || !mt.is2D) return false; }
    }
    return true;
  }
  function conPng(st) {
    var copia = sinPosicion(st.cloneNode(true)), orig = st.querySelectorAll('canvas'), dest = copia.querySelectorAll('canvas');
    for (var i = 0; i < orig.length; i++) {
      var im = document.createElement('img');
      for (var a = 0; a < orig[i].attributes.length; a++) im.setAttribute(orig[i].attributes[a].name, orig[i].attributes[a].value);
      im.setAttribute('src', orig[i].toDataURL('image/png'));
      dest[i].replaceWith(im);
    }
    return { abajo: envolver(new XMLSerializer().serializeToString(copia), '#0b0b0d'), lienzo: null, caja: null, arriba: null };
  }
  function capas(t) {
    if (!CSS) throw new Error('RASTER.preparar() antes de sacar cuadros');
    window.__seek(t);
    var st = document.getElementById('stage'), cvs = st.querySelectorAll('canvas');
    if (cvs.length === 0) return { abajo: envolver(new XMLSerializer().serializeToString(sinPosicion(st.cloneNode(true))), '#0b0b0d'), lienzo: null, caja: null, arriba: null };
    if (cvs.length > 1 || !pegable(cvs[0], st)) return conPng(st);
    var cv = cvs[0];
    // marca lo que va DEBAJO del canvas («a», antes en el árbol) y lo que va ENCIMA («d», después), en cada nivel hasta #stage
    var marcados = [];
    for (var anc = cv.parentElement; anc; anc = anc === st ? null : anc.parentElement) {
      for (var h = anc.firstElementChild; h; h = h.nextElementSibling) {
        if (h === cv || h.contains(cv)) continue;
        h.setAttribute('data-ras', cv.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING ? 'd' : 'a');
        if (h.getAttribute('data-ras') === 'd' && getComputedStyle(h).visibility !== 'visible') h.setAttribute('data-ras', 'dx');
        marcados.push(h);
      }
    }
    cv.setAttribute('data-ras', 'c');
    var c1 = sinPosicion(st.cloneNode(true)), c2 = sinPosicion(st.cloneNode(true));
    marcados.forEach(function (h) { h.removeAttribute('data-ras'); }); cv.removeAttribute('data-ras');
    // abajo: todo menos lo de encima y el canvas
    c1.querySelectorAll('[data-ras="d"],[data-ras="dx"],[data-ras="c"]').forEach(function (e) { e.style.visibility = 'hidden'; });
    // encima: sólo lo de encima (lo demás, incluidos los fondos de los que envuelven al canvas, escondido)
    c2.style.visibility = 'hidden';
    c2.querySelectorAll('[data-ras="d"]').forEach(function (e) { e.style.visibility = 'visible'; });
    c2.querySelectorAll('[data-ras="c"]').forEach(function (e) { e.style.visibility = 'hidden'; });
    var hay = c2.querySelector('[data-ras="d"]') !== null;
    var r = cv.getBoundingClientRect(), s = st.getBoundingClientRect(), k = s.width / 1080;
    return {
      abajo: envolver(new XMLSerializer().serializeToString(c1), '#0b0b0d'),
      lienzo: cv,
      caja: { x: (r.left - s.left) / k, y: (r.top - s.top) / k, w: r.width / k, h: r.height / k },
      arriba: hay ? envolver(new XMLSerializer().serializeToString(c2), 'transparent') : null,
    };
  }
  window.RASTER = { preparar: preparar, capas: capas };
})();
