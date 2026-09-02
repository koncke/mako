(() => {
  // ── Contraste WCAG, sobre lo que de verdad se pinta ──────────────────────
  const lum = (c) => {
    const p = (c || '').match(/[\d.]+/g);
    if (!p) return null;
    const [r, g, b] = p.slice(0, 3).map(Number).map((v) => {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const x = lum(a), y = lum(b);
    if (x == null || y == null) return null;
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  // El fondo REAL: el primer ancestro con un background no transparente.
  const fondo = (el) => {
    let e = el;
    while (e && e !== document.documentElement) {
      const bg = getComputedStyle(e).backgroundColor;
      if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg;
      e = e.parentElement;
    }
    return getComputedStyle(document.documentElement).backgroundColor || 'rgb(255, 255, 255)';
  };

  const visible = (el) => {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  };

  const contraste = [];
  for (const el of document.querySelectorAll('body *')) {
    const propio = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!propio || !visible(el)) continue;
    const cs = getComputedStyle(el);
    const px = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const min = (px >= 24 || (px >= 18.66 && bold)) ? 3 : 4.5;
    const rt = ratio(cs.color, fondo(el));
    if (rt != null && rt < min) {
      contraste.push({
        txt: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 46),
        px: +px.toFixed(1), ratio: +rt.toFixed(2), min,
        color: cs.color, fondo: fondo(el),
      });
    }
  }

  // ── Blancos de toque chicos (WCAG 2.5.8 / 2.5.5) ────────────────────────
  const chicos = [];
  for (const el of document.querySelectorAll('button, a, [role=button], input, select, summary')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 24 || r.height < 24) {
      chicos.push({
        tag: el.tagName.toLowerCase(),
        txt: (el.textContent || el.getAttribute('aria-label') || el.title || '').trim().slice(0, 34),
        w: Math.round(r.width), h: Math.round(r.height),
      });
    }
  }

  // ── Nombre accesible ausente ────────────────────────────────────────────
  const sinNombre = [];
  for (const el of document.querySelectorAll('button, a[href], [role=button]')) {
    if (!visible(el)) continue;
    const n = (el.innerText || '').trim() || el.getAttribute('aria-label') || el.title || el.getAttribute('aria-labelledby');
    if (!n) sinNombre.push({ tag: el.tagName.toLowerCase(), html: el.outerHTML.slice(0, 90) });
  }
  const imgSinAlt = [...document.querySelectorAll('img')].filter((i) => visible(i) && i.alt == null).length;

  // ── Scroll escondido y desborde ─────────────────────────────────────────
  const scrollOculto = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.scrollbarWidth === 'none' && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2)) {
      scrollOculto.push({ clase: (el.className || '').toString().slice(0, 40), tag: el.tagName.toLowerCase() });
    }
  }

  // ── Alto colapsado: el bug de Safari que ya costo tres reportes ──────────
  const colapsados = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.height !== '0px') continue;
    const r = el.getBoundingClientRect();
    if (r.width > 100 && el.children.length > 0) {
      const p = el.parentElement && getComputedStyle(el.parentElement);
      colapsados.push({
        tag: el.tagName.toLowerCase(), clase: (el.className || '').toString().slice(0, 36),
        w: Math.round(r.width), hijos: el.children.length,
        padreFlex: p ? p.display : '?',
      });
    }
  }

  // ── El foco: ¿se ve? ────────────────────────────────────────────────────
  let focoInvisible = 0, focoTotal = 0;
  for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')) {
    if (!visible(el)) continue;
    focoTotal++;
    const cs = getComputedStyle(el);
    // Sin :focus-visible no se puede leer desde acá, pero un `outline:none` en el
    // estado base con `box-shadow:none` es la señal fuerte.
    if (cs.outlineStyle === 'none' && cs.boxShadow === 'none') focoInvisible++;
  }

  const d = document.documentElement;
  return JSON.stringify({
    ruta: location.pathname,
    viewport: { w: innerWidth, h: innerHeight },
    desbordeX: d.scrollWidth - d.clientWidth,
    contraste: { cuantos: contraste.length, peores: contraste.sort((a, b) => a.ratio - b.ratio).slice(0, 10) },
    toqueChico: { cuantos: chicos.length, ejemplos: chicos.slice(0, 8) },
    sinNombreAccesible: { cuantos: sinNombre.length, ejemplos: sinNombre.slice(0, 5) },
    imgSinAlt,
    scrollOculto,
    altoColapsado: { cuantos: colapsados.length, ejemplos: colapsados.slice(0, 6) },
    foco: { total: focoTotal, sinIndicadorBase: focoInvisible },
  }, null, 1);
})()
