// =============================================================================
// GENERADO por scripts/sync-replica-extension.mjs desde lib/editor-landing/replica-extension-script.ts — NO EDITAR A MANO
// =============================================================================
// «Replicar esta página» (0.79.0): la foto de la copia idéntica, en la pestaña real. El pre-push falla si quedó vieja.
// La regla de esta lectura (la única que baja por una página ajena, y vuelve a donde estaba) está en el fuente.
// =============================================================================

var MakoReplicaLeer = function (op) {
  var NONCE = String((op && op.nonce) || '');
  // Una lectura en curso (la persona volvió a tocar el ícono y el worker no la oía hacía rato): sigue la que ya corre, con el
  // nonce nuevo. Contestar «ocupada» dejaba la foto con el nonce viejo, que el worker ya no acepta.
  if (window.__mkReplica) { window.__mkReplicaNonce = NONCE; return { ok: true, empezo: false, adoptada: true }; }
  window.__mkReplica = 1;
  window.__mkReplicaNonce = NONCE;
  var mandar = function (m) {
    m.nonce = String(window.__mkReplicaNonce || NONCE);
    try { chrome.runtime.sendMessage(m, function () { void chrome.runtime.lastError; }); } catch (e) {}
  };
  // El latido: cada 3 s dice cómo va, también mientras espera que la página cargue (hasta ~18 s sin otro aviso). Sin él, un
  // segundo toque en el ícono a los 20 s acuñaba otro nonce y la foto se perdía.
  var cuenta = { fase: 'cargando', hecho: 0 };
  var avance = function (fase, hecho) { cuenta.fase = fase; cuenta.hecho = hecho; mandar({ tipo: 'REPLICA_AVANCE', fase: fase, hecho: hecho }); };
  var latido = setInterval(function () { mandar({ tipo: 'REPLICA_AVANCE', fase: cuenta.fase, hecho: cuenta.hecho }); }, 3000);
  var T0 = Date.now();
  var tarde = function () { return Date.now() - T0 > 60000; };
  var esperar = function (ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); };
  var irA = function (x, y) { try { window.scrollTo({ left: x, top: y, behavior: 'instant' }); } catch (e) { try { window.scrollTo(x, y); } catch (z) {} } };
  var cargado = function (tope) {
    return new Promise(function (ok) {
      if (document.readyState === 'complete') return ok();
      var t = setTimeout(ok, Math.max(0, tope));
      window.addEventListener('load', function () { clearTimeout(t); ok(); }, { once: true });
    });
  };
  var esperarQuieto = function (quieto, tope) {
    return new Promise(function (ok) {
      var ini = Date.now(), ultimo = Date.now(), mo = null;
      try {
        mo = new MutationObserver(function () { ultimo = Date.now(); });
        mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
      } catch (e) {}
      (function mirar() {
        var t = Date.now();
        if (t - ultimo >= quieto || t - ini >= tope || tarde()) { if (mo) mo.disconnect(); ok(); return; }
        setTimeout(mirar, 80);
      })();
    });
  };
  // Una dirección sin su consulta ni su ancla: ahí viajan los datos de quien la visita (un utm, un correo, un fbclid).
  var sinConsulta = function (u) { try { var x = new URL(String(u)); return x.origin + x.pathname; } catch (e) { return ''; } };
  // El texto que se ve, sin lo que escribió la persona: lo de un textarea y lo de una caja editable se saca.
  var textoVisible = function () {
    try {
      var t = String((document.body && document.body.innerText) || '');
      var escrito = document.querySelectorAll('textarea, [contenteditable]');
      for (var q = 0; q < escrito.length; q++) {
        var v = String((escrito[q].tagName === 'TEXTAREA' ? escrito[q].value : escrito[q].innerText) || '').trim();
        if (v.length >= 3) t = t.split(v).join(' ');
      }
      return t.replace(/[ \t ]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim().slice(0, 60000);
    } catch (e) { return ''; }
  };
  var alto = function () { return Math.max(document.documentElement.scrollHeight || 0, document.body ? document.body.scrollHeight || 0 : 0); };
  var antesDeBajar = function () {
  try {
    var m = new Map();
    var todos = document.querySelectorAll('*');
    for (var i = 0; i < todos.length; i++) m.set(todos[i], [todos[i].getAttribute('class'), todos[i].getAttribute('style')]);
    window.__mkAntes = m;
  } catch (e) {}
};
  var mirarVisibles = function () {
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
};
  var instantanea = function (op) {
  var d = document;
  var base = d.baseURI;
  var soloDeLaPagina = !!(op && op.soloDeLaPagina);
  // Lo que se copia de un campo: el texto de un botón siempre; de lo demás, con soloDeLaPagina, nada (queda el placeholder).
  var valorDe = function (o, tag, tipo) {
    if (tipo === 'submit' || tipo === 'button' || tipo === 'reset') return o.value || o.getAttribute('value') || '';
    if (soloDeLaPagina) return '';
    return o.value || '';
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
  var esJunta = function (el) {
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
};

  var copia = d.body.cloneNode(true);
  var orig = d.body.querySelectorAll('*');
  var cop = copia.querySelectorAll('*');
  var cambios = [];
  for (var i = 0; i < orig.length && i < cop.length; i++) {
    var o = orig[i], c = cop[i];
    var tag = o.tagName.toLowerCase();
    // Una caja editable de la pestaña real (un chat, un editor) puede traer lo que escribió la persona: sale vacía.
    if (soloDeLaPagina && o.isContentEditable && o.hasAttribute('contenteditable')) {
      while (c.firstChild) c.removeChild(c.firstChild);
      c.removeAttribute('contenteditable');
    }
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
};

  (async function () {
    var x0 = window.scrollX || 0, y0 = window.scrollY || 0;
    var final = { tipo: 'REPLICA_FOTO', ok: false };
    try {
      avance('cargando', 0);
      await cargado(10000);
      await esperarQuieto(800, 8000);
      // Lo de una vuelta anterior (la persona tocó el ícono otra vez) no cuenta para esta.
      window.__mkVistos = new Map();
      window.__mkAntes = null;
      try { antesDeBajar(); } catch (e) {}
      // La bajada del lector con la foto pedida (lector-script.ts → bajarYSubir): lo que se arma al verse mete SU hoja recién
      // ahí. Sin clics: sólo bajar, mirar la cara visible en cada paso y volver arriba.
      var paso = Math.max(300, Math.floor((window.innerHeight || 800) * 0.7)), y = 0;
      try { mirarVisibles(); } catch (e) {}
      for (var n = 0; n < 90 && !tarde(); n++) {
        y += paso;
        var h = alto();
        if (y >= h) break;
        irA(0, y);
        await esperar(250);
        try { mirarVisibles(); } catch (e) {}
        if (n % 4 === 3) avance('bajando', Math.min(95, Math.round((y / Math.max(1, h)) * 100)));
      }
      await esperar(1000);
      irA(0, 0);
      await esperarQuieto(300, 1500);
      avance('foto', 98);
      var url = sinConsulta(location.href);
      var foto = instantanea({ soloDeLaPagina: true });
      final.url = url;
      final.titulo = String(document.title || '').slice(0, 300);
      final.parcial = tarde();
      if (!foto || !/\S/.test(String(foto.cuerpo || ''))) {
        final.motivo = 'vacia';
      } else {
        var crudo = String(location.href).split('#')[0];
        foto.url = url;
        if (String(foto.base || '').split('#')[0] === crudo) foto.base = url;
        for (var k = 0; k < foto.hojas.length; k++) if (foto.hojas[k].base && String(foto.hojas[k].base).split('#')[0] === crudo) foto.hojas[k].base = url;
        var peso = JSON.stringify(foto).length;
        final.peso = peso;
        if (peso > 4150000) final.motivo = 'pesada';
        else { final.ok = true; final.foto = foto; final.texto = textoVisible(); }
      }
    } catch (e) {
      final.ok = false;
      final.motivo = 'excepcion';
      final.detalle = String((e && e.message) || e).slice(0, 200);
    }
    clearInterval(latido);
    irA(x0, y0);
    window.__mkReplica = 0;
    mandar(final);
  })();
  return { ok: true, empezo: true };
};
