// ═══════════════════════════════════════════════════════════════════════════════════════════
// CLOSING — el movimiento de la hoja, copiado de la entrada del Dashboard de Halden.
// 4/11/2026. Código nuestro: la RECETA (qué se mueve, desde dónde, cuánto tarda, con qué curva y
// en qué momento de la línea de tiempo) sale de demos/halden/INFORME.txt, que la leyó del bundle.
// Se escribe con Element.animate, sin GSAP: lo que se copia es el resultado, no la librería.
//
// La línea de tiempo medida (la función de entrada del Dashboard, en segundos):
//   0     el título                         ← «bo($)»: su cuerpo NO está en el informe (ver abajo)
//   0.10  las tarjetas                      opacity 0→1, y 36→0, scale .985→1 · .85s power3.out · stagger .06
//   0.35  el héroe                          las cifras cuentan desde 0 (1.3s power3.out) y la meta crece
//                                           (scaleX 0→avance · 1.4s power3.out · demora .15)
//   0.45  la barra del pipeline             scaleX 0→1 · 1.1s power3.inOut
//   0.50  las barras de la semana           yPercent 101→0 · 1s power4.out · stagger .07
//   1.05  la etiqueta de la barra           opacity 0, scale .8 → 1 · .4s back.out(2)
//   0.60  la leyenda del pipeline           opacity 0, y 8 → 0 · .55s power3.out · stagger .05
//   0.60  las filas de la lista             opacity 0, x 14 → 0 · .55s power3.out · stagger .045
//   0.75  lo que propone el asistente       opacity 0, y 10 → 0 · .55s power3.out · stagger .07
//
// ⚠️ LO QUE NO SE PUDO COPIAR, y no se inventa (anotado en docs/relevo/nube-dashboards.md):
//   - «bo($)», el que hace entrar el título: no está entre los helpers del informe. Acá entra con «io»,
//     el ÚNICO helper de título de la librería de Halden (yPercent 115→0 · .85s power4.out · stagger
//     .024 por letra). Es una inferencia hasta medir bo.
//   - lo que sigue después de .75 (el informe corta la línea): la cuota y el reloj no tienen entrada medida.
//   - a qué elementos se les pone [data-lift] (el hover que sube 4px): el informe tiene la receta, no los
//     elementos. No se aplica a nada.
// ═══════════════════════════════════════════════════════════════════════════════════════════
(() => {
  const P4O = 'cubic-bezier(.165,.84,.44,1)';
  const P3O = 'cubic-bezier(.215,.61,.355,1)';
  const P3IO = 'cubic-bezier(.645,.045,.355,1)';
  const B2 = 'cubic-bezier(.34,1.56,.64,1)';
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /** Una animación de entrada: `desde` es el estado de partida; el de llegada es el de reposo (CSS). */
  function entra(el, desde, { dur, ease, delay = 0 }) {
    return el.animate([desde, {}], { duration: dur * 1000, easing: ease, delay: delay * 1000, fill: 'backwards' });
  }
  const escalonado = (els, desde, o, paso) => els.forEach((el, i) => entra(el, desde, { ...o, delay: (o.delay || 0) + i * paso }));

  // ── los números que cuentan («lo»: 1.3s power3.out, con prefijo, sufijo y decimales del data-*) ──
  function formato(el, v) {
    const d = +(el.dataset.decimals || 0);
    const n = v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    return (el.dataset.prefix || '') + n + (el.dataset.suffix || '');
  }
  // power3.out como función para el contador (la misma curva que las demás)
  const p3 = (t) => 1 - Math.pow(1 - t, 3);
  function cuenta(el, { dur = 1.3, delay = 0 } = {}) {
    const fin = parseFloat(el.dataset.value) || 0;
    if (quieto) { el.textContent = formato(el, fin); return; }
    el.textContent = formato(el, 0);
    const t0 = performance.now() + delay * 1000;
    const paso = (ahora) => {
      const t = Math.min(1, Math.max(0, (ahora - t0) / (dur * 1000)));
      el.textContent = formato(el, fin * p3(t));
      if (t < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }

  // ── el título, letra por letra («io») ──
  function partirTitulo(el) {
    const txt = el.textContent;
    el.textContent = '';
    for (const ch of txt) {
      const s = document.createElement('span');
      s.className = 'l';
      s.textContent = ch;
      el.appendChild(s);
    }
    return $$('.l', el);
  }

  // ── la etiqueta de las barras: sigue a la barra que se señala (Bs: .45s power3.out) ──
  function etiqueta() {
    const caja = $('.bars');
    const tip = $('.tip', caja?.parentElement || document);
    if (!caja || !tip) return null;
    const barras = $$('.bar', caja);
    let actual = barras.find((b) => b.dataset.tip === '1') || barras[0];
    const lugar = (b, anim) => {
      const fill = $('.bar__fill', b);
      tip.textContent = b.dataset.v;
      // Con offsetLeft/offsetTop, que no ven los transform: la etiqueta se ubica sobre la barra YA crecida
      // aunque la barra y la tarjeta todavía estén entrando.
      const x = caja.offsetLeft + fill.offsetLeft + fill.offsetWidth / 2 - tip.offsetWidth / 2;
      const y = caja.offsetTop + fill.offsetTop - tip.offsetHeight - 10;
      if (!anim || quieto) { tip.style.transform = `translate(${x}px,${y}px)`; return; }
      const de = getComputedStyle(tip).transform;
      tip.style.transform = `translate(${x}px,${y}px)`;
      tip.animate([{ transform: de }, { transform: `translate(${x}px,${y}px)` }], { duration: 450, easing: P3O });
    };
    barras.forEach((b) => b.addEventListener('pointerenter', () => { actual = b; lugar(b, true); }));
    addEventListener('resize', () => lugar(actual, false));
    return { lugar: () => lugar(actual, false), tip };
  }

  // ── el reloj: cada dígito es una columna 0-9 que rueda (sc: yPercent −10·n · .55s power3.out) ──
  // Al entrar, Halden pone los dígitos en 0 (K.set(oc,{yPercent:0})) y el primer tic del reloj, al segundo, los hace
  // rodar hasta la hora. La copia corre como el demo ([data-corre]); la adaptación muestra un número quieto
  // ([data-rueda]) y rueda una sola vez, en ese mismo segundo.
  function reloj() {
    const cols = $$('.dg__col');
    if (!cols.length) return;
    const caja = cols[0].closest('.dialer__clock');
    let s = +(caja?.dataset.segundos || 0);
    const pinta = (anim, cero) => {
      const h = String(Math.floor(s / 3600)).padStart(2, '0');
      const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      const dig = cero ? [0, 0, 0, 0, 0, 0] : (h + m + ss).split('').map(Number);
      cols.forEach((c, i) => {
        const y = `translateY(${-10 * dig[i]}%)`;
        if (c.style.transform === y) return;
        if (anim && !quieto) c.animate([{ transform: c.style.transform || 'translateY(0%)' }, { transform: y }], { duration: 550, easing: P3O });
        c.style.transform = y;
      });
    };
    // ?captura: el número final, sin esperar (la comparación contra la captura de Halden se hace en el mismo segundo)
    const captura = new URLSearchParams(location.search).has('captura');
    if (captura || quieto) { pinta(false); return; }
    pinta(false, true);
    if (caja.hasAttribute('data-corre')) setInterval(() => { s += 1; pinta(true); }, 1000);
    else setTimeout(() => pinta(true), 1000);
  }

  // ── la píldora de las pestañas: se corre y se estira en el medio (Dd: .55s power3.inOut) ──
  function pestanas() {
    const tabs = $('.tabs');
    if (!tabs) return;
    const pill = $('.tabs__pill', tabs);
    const pon = (t, anim) => {
      const x = t.offsetLeft, w = t.offsetWidth;
      if (!anim || quieto) { pill.style.transform = `translateX(${x}px)`; pill.style.width = w + 'px'; return; }
      const x0 = new DOMMatrix(getComputedStyle(pill).transform).m41, w0 = pill.offsetWidth;
      const estira = Math.max(w, w0) + Math.abs(x - x0) * 0.3;
      pill.animate([{ transform: `translateX(${x0}px)`, width: w0 + 'px' }, { width: estira + 'px', offset: 0.5 },
        { transform: `translateX(${x}px)`, width: w + 'px' }], { duration: 550, easing: P3IO });
      pill.style.transform = `translateX(${x}px)`; pill.style.width = w + 'px';
    };
    const activa = () => $('.tab[aria-current=page]', tabs);
    $$('.tab', tabs).forEach((t) => t.addEventListener('click', (e) => {
      e.preventDefault();
      $$('.tab', tabs).forEach((o) => o.removeAttribute('aria-current'));
      t.setAttribute('aria-current', 'page');
      pon(t, true);
    }));
    pon(activa(), false);
    document.fonts?.ready.then(() => pon(activa(), false));
  }

  function entrada() {
    const vista = $('.vista');
    const tip = etiqueta();
    const cards = $$('[data-card]', vista);
    const letras = partirTitulo($('.titulo', vista));
    $$('[data-count]', vista).forEach((el) => { el.textContent = formato(el, quieto ? +el.dataset.value : 0); });
    document.documentElement.classList.remove('antes');
    if (quieto) { $$('[data-count]').forEach((el) => cuenta(el)); tip?.lugar(); return; }

    // 0: el título (io)
    escalonado(letras, { transform: 'translateY(115%)' }, { dur: 0.85, ease: P4O }, 0.024);
    // .10: las tarjetas (oo, stagger .06)
    escalonado(cards, { opacity: 0, transform: 'translateY(36px) scale(.985)' }, { dur: 0.85, ease: P3O, delay: 0.1 }, 0.06);
    // .35: el héroe — las cifras y la meta (Ts con t=true: demora .15, 1.4s)
    $$('[data-count]', $('.hero')).forEach((el) => cuenta(el, { delay: 0.35 }));
    const meta = $('.goal__fill');
    if (meta) entra(meta, { transform: 'scaleX(0)' }, { dur: 1.4, ease: P3O, delay: 0.35 + 0.15 });
    $$('[data-count]').filter((el) => !el.closest('.hero')).forEach((el) => cuenta(el, { delay: 0.35 }));
    // .45: la barra del pipeline (Es)
    const st = $('.stages');
    if (st) entra(st, { transform: 'scaleX(0)' }, { dur: 1.1, ease: P3IO, delay: 0.45 });
    // .50: las barras (Vs) y su etiqueta a los .55 de Vs
    $$('.bar__fill').forEach((f, i) => entra(f, { transform: 'translateY(101%)' }, { dur: 1, ease: P4O, delay: 0.5 + i * 0.07 }));
    if (tip) {
      tip.lugar();
      entra(tip.tip, { opacity: 0, scale: '.8' }, { dur: 0.4, ease: B2, delay: 0.5 + 0.55 });
    }
    // .60: la leyenda del pipeline (so, y 8, stagger .05)
    escalonado($$('[data-leg]'), { opacity: 0, transform: 'translateY(8px)' }, { dur: 0.55, ease: P3O, delay: 0.6 }, 0.05);
    // .60: las filas (so, x 14, stagger .045)
    escalonado($$('.ditem'), { opacity: 0, transform: 'translateX(14px)' }, { dur: 0.55, ease: P3O, delay: 0.6 }, 0.045);
    // .75: el asistente (so, y 10, stagger .07)
    escalonado($$('.aitem'), { opacity: 0, transform: 'translateY(10px)' }, { dur: 0.55, ease: P3O, delay: 0.75 }, 0.07);
  }

  const arranca = () => { pestanas(); reloj(); entrada(); };
  if (document.fonts?.status === 'loaded') arranca();
  else (document.fonts?.ready || Promise.resolve()).then(arranca);
})();
