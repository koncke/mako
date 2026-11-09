// =============================================================================
// editor-landing/copia-identica-script — la FOTO de una página ya armada, desde adentro (28/10/2026)
// =============================================================================
// Pedido de Martín (28/10/2026, ~09:40), sobre la réplica de respond.io: «esta horriblemente mal, no solo el diseño no se
// parece en nada, sino que tampoco los copy, no tiene sentido... Enfocate primero en replicar tal cual, tanto en diseño
// como copy y luego vemos de personalizarlo».
//
// Cómo lo resuelven los que clonan páginas, y qué se copió (docs/hallazgos-editor-landing.md, «La copia idéntica»):
//   · SingleFile guarda el DOM YA ARMADO (lo que dejó el JavaScript de la página, no el HTML que mandó el server), sin
//     scripts, con sus hojas y sacando las reglas que no usa nada. Eso es lo que hace esta foto + copia-identica.ts.
//   · html.to.design (y html-to-figma) leen el estilo CALCULADO de cada elemento a UN ancho: pierden las media queries
//     (por eso importan el teléfono aparte), las animaciones y los ::before. Acá NO: la copia lleva las hojas de la
//     página con sus media queries, así la misma copia se ve bien a 1440 y a 390.
//
// Lo que hace, sobre la página ya quieta y recorrida de arriba abajo (lo hace el lector antes):
//   1. clona el <body> y, elemento por elemento contra el original (mismo orden), deja lo que ve un visitante: la imagen
//      que eligió el navegador (`currentSrc`, la perezosa ya cargada), las direcciones absolutas, un <canvas> como la
//      imagen que muestra, el ícono de un `<use>` con su dibujo adentro, y un campo de formulario como una caja con su
//      texto (la copia no envía nada: un formulario copiado tal cual en nuestro dominio sería phishing);
//   2. saca lo que no se ve o no se copia: scripts, <style> y <link> (sus reglas viajan en `hojas`), plantillas;
//   3. junta las HOJAS en su orden, con las reglas que el navegador tiene en memoria (las que un CSS-in-JS mete con
//      `insertRule` no están en el texto del <style>). Una hoja de otro origen no se deja leer: va su dirección y la baja
//      el server (`bajarHoja`).
//
// ⚠️ ES JAVASCRIPT PLANO ADENTRO DE UN `String.raw` (las reglas de lector-script.ts: sin backticks, sin el signo de pesos
//    con llave, sin «menor que» seguido de barra). Una expresión de función sin argumentos que devuelve la foto.
// =============================================================================

/** Lo que vuelve de la foto (lo sanea `sanearInstantanea`, copia-identica.ts: viene de una página de afuera). */
export type InstantaneaCruda = {
  url: string;
  base: string;
  titulo: string;
  html: { clase: string; estilo: string; lang: string };
  body: { clase: string; estilo: string; fondo: string };
  cuerpo: string;
  hojas: { css?: string; href?: string; base?: string; media?: string }[];
  ancho: number;
  medidas: { imagenes: number; lienzos: number; usos: number; campos: number; marcos: number };
};

/**
 * ANTES de bajar por la página: la clase y el estilo de cada elemento. Al bajar, un header fijo o pegajoso cambia de cara
 * (Astra le pone `ast-header-sticked`, el de respond.io se corre con su transición) y la foto, que sale después de bajar y
 * volver, se lo traía: en la copia el menú quedaba debajo del título (28/10/2026). La foto le devuelve a lo fijo o pegajoso
 * la cara de arriba de todo; lo demás queda como quedó al bajar (lo que aparece al bajar tiene que aparecer).
 */
export const JS_ANTES_DE_BAJAR = String.raw`function () {
  try {
    var m = new Map();
    var todos = document.querySelectorAll('*');
    for (var i = 0; i < todos.length; i++) m.set(todos[i], [todos[i].getAttribute('class'), todos[i].getAttribute('style')]);
    window.__mkAntes = m;
  } catch (e) {}
}`;

/**
 * EN CADA PASO de la bajada: la cara VISIBLE de lo que está en pantalla (su opacidad, su transform y su visibilidad, la más
 * visible que tuvo). Una animación de aparición que se DESHACE al salir de pantalla (tryholo.ai, 28/10/2026) dejaba
 * escondida media página en la foto, que sale arriba de todo: la foto le devuelve a lo que se vio la cara con que se vio.
 * Lo que nunca se vio (un menú cerrado, un tooltip) queda como está.
 */
export const JS_MIRAR_VISIBLES = String.raw`function () {
  try {
    var m = window.__mkVistos instanceof Map ? window.__mkVistos : (window.__mkVistos = new Map());
    var alto = window.innerHeight;
    var todos = document.body.querySelectorAll('*');
    for (var i = 0; i < todos.length; i++) {
      var el = todos[i];
      var r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > alto || (r.width < 1 && r.height < 1)) continue;
      var cs = getComputedStyle(el);
      var op = parseFloat(cs.opacity);
      if (!(op >= 0.5) || cs.visibility === 'hidden' || cs.display === 'none') continue;
      var antes = m.get(el);
      if (!antes || op >= antes.o) m.set(el, { o: op, t: cs.transform, v: cs.visibility });
    }
  } catch (e) {}
}`;

/**
 * ¿Los hijos de esta caja van JUNTOS? (29/10/2026, Martín: «las páginas clonadas se desfasaron todas»). El server parte la
 * copia en secciones y el editor dibuja cada una SOLA en su iframe: una caja con columnas lado a lado (el hero de
 * tryholo.ai, el texto a la izquierda y las tarjetas a la derecha), con piezas encimadas o con un hijo absoluto, partida
 * así queda apilada y corrida. Lo dice la geometría de la página armada, no el HTML: sí cuando un hijo visible empieza
 * antes de que termine lo de arriba (2 px de tolerancia) o está en `absolute`. Lo fijo no cuenta (es de la ventana), lo
 * escondido o sin tamaño tampoco, y lo `contents` cuenta por sus hijos. Una expresión de función `(el) → boolean`, aparte
 * para que el test la corra con cajas de mentira; la usa JS_INSTANTANEA (la marca `data-gm-junto`, copia-identica.ts).
 */
export const JS_HIJOS_JUNTOS = String.raw`function (el) {
  var enFlujo = function (caja, out) {
    for (var k = 0; k < caja.children.length; k++) {
      var h = caja.children[k], hcs = null;
      try { hcs = getComputedStyle(h); } catch (e) {}
      if (!hcs || hcs.display === 'none' || hcs.position === 'fixed') continue;
      if (hcs.display === 'contents') { enFlujo(h, out); continue; }
      out.push([h, hcs.position]);
    }
    return out;
  };
  if (!el || !el.children || el.children.length < 2) return false;
  var hs = enFlujo(el, []), fin = -Infinity, vistos = 0;
  for (var k = 0; k < hs.length; k++) {
    var r = hs[k][0].getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (hs[k][1] === 'absolute') return true;
    if (vistos && r.top < fin - 2) return true;
    fin = Math.max(fin, r.bottom);
    vistos++;
  }
  return false;
}`;

/**
 * La foto. `op.soloDeLaPagina` (9/11/2026, «Replicar con la extensión»): la foto sale en la PESTAÑA REAL de la persona, donde
 * un campo puede traer lo que ella escribió. Ahí de un campo se copia sólo lo que trae la PÁGINA (su atributo `value`, la
 * opción marcada de fábrica, el texto de un botón), nunca lo tipeado. En la ventana del lector (sin `op`) nadie escribió nada.
 */
export const JS_INSTANTANEA = String.raw`function (op) {
  var d = document;
  var base = d.baseURI;
  var soloDeLaPagina = !!(op && op.soloDeLaPagina);
  // Lo que se copia de un campo: el texto de un botón siempre; de lo demás, con soloDeLaPagina, lo que trae el HTML.
  var valorDe = function (o, tag, tipo) {
    if (tipo === 'submit' || tipo === 'button' || tipo === 'reset') return o.value || o.getAttribute('value') || '';
    if (!soloDeLaPagina) return o.value || '';
    if (tag === 'textarea') return o.defaultValue || '';
    return o.getAttribute('value') || '';
  };
  var opcionDe = function (o) {
    if (!o.options || !o.options.length) return null;
    if (!soloDeLaPagina) return o.options[o.selectedIndex] || null;
    for (var q = 0; q < o.options.length; q++) if (o.options[q].defaultSelected) return o.options[q];
    return o.options[0];
  };
  // La cara de arriba de todo de lo fijo o pegajoso (JS_ANTES_DE_BAJAR): esos elementos y lo que tienen adentro.
  var antes = window.__mkAntes instanceof Map ? window.__mkAntes : null;
  var enFijo = new Set();
  if (antes) {
    Array.prototype.forEach.call(d.body.querySelectorAll('*'), function (el) {
      if (enFijo.has(el)) return;
      var p = '';
      try { p = getComputedStyle(el).position; } catch (e) {}
      if (p === 'fixed' || p === 'sticky') { enFijo.add(el); Array.prototype.forEach.call(el.querySelectorAll('*'), function (x) { enFijo.add(x); }); }
    });
  }
  var volver = function (o, c) {
    var a = antes ? antes.get(o) : null;
    if (!a) return;
    if (a[0] === null) c.removeAttribute('class'); else c.setAttribute('class', a[0]);
    if (a[1] === null) c.removeAttribute('style'); else c.setAttribute('style', a[1]);
  };
  var deAntes = function (el, i) { var a = antes ? antes.get(el) : null; return a ? a[i] : el.getAttribute(i === 0 ? 'class' : 'style'); };
  // Lo que se vio al bajar y quedó escondido (JS_MIRAR_VISIBLES): vuelve a la cara con que se vio, por encima de su hoja.
  var vistos = window.__mkVistos instanceof Map ? window.__mkVistos : null;
  var reaparecer = function (o, c) {
    var v = vistos ? vistos.get(o) : null;
    if (!v) return;
    var cs = getComputedStyle(o);
    if (parseFloat(cs.opacity) >= v.o - 0.3 && cs.visibility !== 'hidden') return;
    var extra = 'opacity:' + v.o + ' !important;visibility:visible !important;transform:' + v.t + ' !important';
    var st = c.getAttribute('style');
    c.setAttribute('style', (st ? st.replace(/;?\s*$/, ';') : '') + extra);
  };
  var abs = function (u, b) {
    if (!u) return u;
    var t = String(u).trim();
    if (/^(?:data:|blob:|mailto:|tel:|javascript:|#)/i.test(t)) return t;
    try { return new URL(t, b || base).href; } catch (e) { return t; }
  };
  var absSrcset = function (s) {
    // Los candidatos van separados por «coma y espacio»: una coma pegada puede ser de la dirección (Cloudinary: w_100,h_100).
    var t = String(s || '');
    return t.split(/,\s/.test(t) ? /,\s+/ : /,/).map(function (c) {
      var p = c.trim().split(/\s+/);
      if (!p[0]) return '';
      p[0] = abs(p[0]);
      return p.join(' ');
    }).filter(Boolean).join(', ');
  };
  var urlsDeEstilo = function (s) {
    return String(s || '').replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, function (m, q, u) { return 'url("' + abs(u) + '")'; });
  };
  var medidas = { imagenes: 0, lienzos: 0, usos: 0, campos: 0, marcos: 0 };
  // Las cajas cuyos hijos van JUNTOS (JS_HIJOS_JUNTOS, arriba): llevan «data-gm-junto» y partirParaCopia no las abre.
  var esJunta = ` + JS_HIJOS_JUNTOS + String.raw`;

  var copia = d.body.cloneNode(true);
  var orig = d.body.querySelectorAll('*');
  var cop = copia.querySelectorAll('*');
  var cambios = [];
  for (var i = 0; i < orig.length && i < cop.length; i++) {
    var o = orig[i], c = cop[i];
    var tag = o.tagName.toLowerCase();
    try { if (esJunta(o)) c.setAttribute('data-gm-junto', ''); } catch (e) {}
    // Lo FIJO (el aviso de cookies, un encabezado fijo): el server lo pega a la primera sección (partirParaCopia).
    try { if (getComputedStyle(o).position === 'fixed') c.setAttribute('data-gm-fijo', ''); } catch (e) {}
    if (enFijo.has(o)) volver(o, c);
    else reaparecer(o, c);
    if (c.hasAttribute('style')) c.setAttribute('style', urlsDeEstilo(c.getAttribute('style')));
    // Un atributo enorme que no dibuja nada (los props de una isla de Astro, el JSON de un componente) se va: medido el
    // 28/10/2026, respond.io llevaba 477 KB en UN atributo.
    for (var at = c.attributes.length - 1; at >= 0; at--) {
      var na = c.attributes[at].name;
      if (c.attributes[at].value.length > 2000 && !/^(style|d|points|src|srcset|href|viewbox|transform|poster|path)$/i.test(na)) c.removeAttribute(na);
    }
    // Un elemento propio de la página (astro-island, my-card): sin caja se suelta (sus hijos quedan en su lugar); con
    // caja pasa a ser un <div> con sus clases y su estilo (el saneo no deja pasar etiquetas que no conoce).
    if (tag.indexOf('-') > 0 && tag !== 'font-face') {
      var disp = '';
      try { disp = getComputedStyle(o).display; } catch (e) {}
      cambios.push([c, disp === 'contents' ? 'soltar' : 'div']);
    }
    if (tag === 'img') {
      // Del ATRIBUTO, no de o.src: un src vacío da la dirección de la PÁGINA (respond.io: seis imágenes rotas en la copia).
      var src = o.currentSrc || o.getAttribute('src') || o.getAttribute('data-src') || '';
      if (src) c.setAttribute('src', abs(src));
      ['srcset', 'data-srcset'].forEach(function (k) { if (c.hasAttribute(k)) c.setAttribute(k, absSrcset(c.getAttribute(k))); });
      if (!c.getAttribute('srcset') && c.getAttribute('data-srcset')) c.setAttribute('srcset', c.getAttribute('data-srcset'));
      medidas.imagenes++;
    } else if (tag === 'source') {
      if (c.hasAttribute('srcset')) c.setAttribute('srcset', absSrcset(c.getAttribute('srcset')));
      if (c.hasAttribute('src')) c.setAttribute('src', abs(c.getAttribute('src')));
    } else if (tag === 'video') {
      if (o.currentSrc && !/^blob:/i.test(o.currentSrc)) c.setAttribute('src', o.currentSrc);
      if (c.hasAttribute('poster')) c.setAttribute('poster', abs(c.getAttribute('poster')));
      if (o.autoplay || o.muted) { c.setAttribute('muted', ''); c.setAttribute('playsinline', ''); }
    } else if (tag === 'a' || tag === 'area') {
      if (c.hasAttribute('href')) c.setAttribute('href', abs(c.getAttribute('href')));
    } else if (tag === 'iframe') {
      if (c.hasAttribute('src')) c.setAttribute('src', abs(c.getAttribute('src')));
      medidas.marcos++;
    } else if (tag === 'canvas') {
      try {
        // En WebP: el fondo animado de closermood.com en PNG medía ~700 KB y dejaba su sección fuera del tope (200 KB).
        var dato = o.toDataURL('image/webp', 0.8);
        if (!/^data:image\/webp/.test(dato)) dato = o.toDataURL('image/jpeg', 0.8);
        if (dato && dato.length > 200 && dato.length < 150000) {
          var im = d.createElement('img');
          for (var a = 0; a < c.attributes.length; a++) im.setAttribute(c.attributes[a].name, c.attributes[a].value);
          im.setAttribute('src', dato);
          if (!im.style.width) im.style.width = o.getBoundingClientRect().width + 'px';
          if (!im.style.height) im.style.height = o.getBoundingClientRect().height + 'px';
          cambios.push([c, im]);
          medidas.lienzos++;
        }
      } catch (e) {}
    } else if (tag === 'use') {
      var ref = c.getAttribute('href') || c.getAttribute('xlink:href') || '';
      var obj = ref.charAt(0) === '#' ? d.getElementById(ref.slice(1)) : null;
      if (obj) {
        var g = d.createElementNS('http://www.w3.org/2000/svg', 'g');
        Array.prototype.forEach.call(obj.childNodes, function (n) { g.appendChild(n.cloneNode(true)); });
        ['x', 'y'].forEach(function (k) { if (c.getAttribute(k)) g.setAttribute('transform', 'translate(' + (c.getAttribute('x') || 0) + ',' + (c.getAttribute('y') || 0) + ')'); });
        if (c.getAttribute('class')) g.setAttribute('class', c.getAttribute('class'));
        cambios.push([c, g]);
        medidas.usos++;
      }
    } else if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      var tipo = (o.getAttribute('type') || '').toLowerCase();
      if (tag === 'input' && tipo === 'hidden') { cambios.push([c, null]); continue; }
      var cs = getComputedStyle(o);
      var caja = d.createElement(tipo === 'submit' || tipo === 'button' ? 'button' : 'div');
      if (c.getAttribute('class')) caja.setAttribute('class', c.getAttribute('class'));
      if (c.getAttribute('id')) caja.setAttribute('id', c.getAttribute('id'));
      caja.setAttribute('data-gm-campo', tag + (tipo ? ':' + tipo : ''));
      var props = ['display', 'box-sizing', 'width', 'height', 'min-height', 'padding', 'border', 'border-radius', 'background', 'color', 'font', 'letter-spacing', 'text-align', 'box-shadow', 'margin', 'line-height', 'flex', 'align-self'];
      var est = props.map(function (p) { return p + ':' + cs.getPropertyValue(p); }).join(';');
      var r = o.getBoundingClientRect();
      var padre = o.parentElement ? o.parentElement.getBoundingClientRect() : null;
      if (padre && padre.width && Math.abs(r.width - padre.width) < 2) est += ';width:100%';
      est += ';overflow:hidden;white-space:nowrap;text-overflow:ellipsis';
      caja.setAttribute('style', est);
      var opcion = tag === 'select' ? opcionDe(o) : null;
      var valor = tag === 'select' ? '' : valorDe(o, tag, tipo);
      var texto = tag === 'select' ? (opcion ? opcion.text : '') : (valor || o.getAttribute('placeholder') || '');
      if (tipo === 'checkbox' || tipo === 'radio') texto = '';
      caja.textContent = texto;
      if (!valor && tag !== 'select' && o.getAttribute('placeholder')) caja.style.color = getComputedStyle(o, '::placeholder').color || cs.color;
      cambios.push([c, caja]);
      medidas.campos++;
    } else if (tag === 'form') {
      var div = d.createElement('div');
      for (var b = 0; b < c.attributes.length; b++) { var nom = c.attributes[b].name; if (!/^(action|method|target|enctype|novalidate|onsubmit)$/i.test(nom)) div.setAttribute(nom, c.attributes[b].value); }
      while (c.firstChild) div.appendChild(c.firstChild);
      cambios.push([c, div]);
    }
  }
  cambios.forEach(function (x) {
    var el = x[0], por = x[1];
    if (!el.parentNode) return;
    if (por === null) { el.parentNode.removeChild(el); return; }
    if (por === 'soltar') {
      while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
      el.parentNode.removeChild(el);
      return;
    }
    if (por === 'div') {
      var caja = d.createElement('div');
      for (var k = 0; k < el.attributes.length; k++) caja.setAttribute(el.attributes[k].name, el.attributes[k].value);
      while (el.firstChild) caja.appendChild(el.firstChild);
      por = caja;
    }
    el.parentNode.replaceChild(por, el);
  });
  var fuera = copia.querySelectorAll('script, noscript, template, style, link, meta, object, embed, [data-mako-lector], [id^="mk-lector"]');
  Array.prototype.forEach.call(fuera, function (n) { if (n.parentNode) n.parentNode.removeChild(n); });

  var hojas = [];
  var reglasDe = function (s, baseHoja, media) {
    var rs;
    try { rs = s.cssRules; } catch (e) { rs = null; }
    if (!rs) { if (s.href) hojas.push({ href: abs(s.href), media: media }); return; }
    var trozo = [];
    var soltar = function () { if (trozo.length) { hojas.push({ css: trozo.join('\n'), base: baseHoja, media: media }); trozo = []; } };
    for (var j = 0; j < rs.length; j++) {
      var r = rs[j];
      if (r.type === 3) {
        soltar();
        var m = r.media && r.media.mediaText ? r.media.mediaText : '';
        var hi = null;
        try { hi = r.styleSheet; } catch (e) { hi = null; }
        if (hi) reglasDe(hi, abs(r.href, baseHoja), m || media);
        else hojas.push({ href: abs(r.href, baseHoja), media: m || media });
        continue;
      }
      trozo.push(r.cssText);
    }
    soltar();
  };
  Array.prototype.forEach.call(d.styleSheets, function (s) {
    if (s.disabled) return;
    var media = s.media && s.media.mediaText ? s.media.mediaText : '';
    reglasDe(s, s.href ? abs(s.href) : base, media);
  });
  try { Array.prototype.forEach.call(d.adoptedStyleSheets || [], function (s) { reglasDe(s, base, ''); }); } catch (e) {}

  var bcs = getComputedStyle(d.body), hcs = getComputedStyle(d.documentElement);
  var fondo = function (cs) { return [cs.backgroundColor, cs.backgroundImage !== 'none' ? urlsDeEstilo(cs.backgroundImage) : ''].filter(Boolean).join(' '); };
  return {
    url: location.href, base: base, titulo: d.title,
    // El <html> y el <body> con su cara de arriba de todo (un body.scrolled o un html.header-sticky de la bajada no viajan).
    html: { clase: deAntes(d.documentElement, 0) || '', estilo: urlsDeEstilo(deAntes(d.documentElement, 1) || ''), lang: d.documentElement.getAttribute('lang') || '' },
    body: { clase: deAntes(d.body, 0) || '', estilo: urlsDeEstilo(deAntes(d.body, 1) || ''), fondo: fondo(bcs) || fondo(hcs) },
    cuerpo: copia.innerHTML,
    hojas: hojas,
    ancho: window.innerWidth,
    medidas: medidas,
  };
}`;
