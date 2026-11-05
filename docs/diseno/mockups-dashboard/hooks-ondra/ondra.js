// La copia de Ondra (Overview): dibuja las piezas con los datos del demo y anima la entrada. Código nuestro (5/11/2026).
// De las RECETAS del INFORME: la barra de la izquierda entra desde x −40 con opacidad 0 y escala .97 (.9 s, power3.out); sus renglones
// desde x −12, cada .035 s, a .15 s; la barra de la meta crece desde 0 (1,2 s, power3.out) a .5 s; el embudo mide cada barra como
// max(.035, (valor / el primero) ^ .42) y marca la caída más grande; el medidor es un arco de radio 86 con centro (110, 104), 21 marcas
// cada 9° (la mayor cada cinco, más larga) y la marca de «hoy» en −90 + 180 × la parte.
// ⚠️ SUPUESTO (el INFORME corta la receta): la barra de arriba baja desde −8 px (.5 s); las tarjetas suben desde 18 px (.7 s, power3.out,
// desde .3 s, cada .06 s); la curva se dibuja en 1,2 s; las barras de los canales, las de las campañas y las del embudo crecen en .9 s;
// los anillos de los leads en 1 s; la aguja del medidor gira desde la izquierda en 1,1 s; los números cuentan en .9 s.
(function () {
  const P3 = 'cubic-bezier(.215,.61,.355,1)', P2 = 'cubic-bezier(.25,.46,.45,.94)', P3IO = 'cubic-bezier(.645,.045,.355,1)';
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ns = 'http://www.w3.org/2000/svg';
  const anim = (el, kf, o) => { if (!el || quieto) return; el.animate(kf, { fill: 'backwards', ...o }); };
  const usar = (id) => `<svg class="i"><use href="#i-${id}"/></svg>`;

  // ── Performance: los 30 días, contra los 30 de antes ──────────────────────────────────────────────────────────────
  // Los valores, en miles, leídos de la captura (la altura de cada curva en cada día): la forma es la del demo.
  const esta = [10.0, 10.0, 9.8, 10.9, 11.3, 12.2, 10.7, 9.7, 11.1, 11.4, 11.8, 13.8, 11.2, 11.1, 10.9, 12.1, 11.4, 12.2, 12.9, 13.8, 11.1, 11.4, 11.8, 12.5, 12.8, 13.1, 12.6, 10.2, 11.7, 11.3];
  const antes = [10.6, 9.3, 8.9, 9.1, 9.7, 9.6, 10.4, 10.9, 9.2, 10.2, 10.0, 10.0, 12.2, 11.3, 11.2, 9.5, 9.5, 9.6, 10.4, 10.8, 10.9, 12.0, 9.3, 9.5, 10.0, 11.0, 10.0, 12.6, 10.8, 10.8];
  const dias = Array.from({ length: 30 }, (_, i) => { const d = new Date(Date.UTC(2026, 8, 22 + i)); return d; });
  const MES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const lanz = [{ i: 6, c: 'var(--steel)' }, { i: 12, c: 'var(--rose)' }, { i: 18, c: 'var(--slate)' }];
  function curva() {
    const el = $('[data-chart]'); if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;
    // En el teléfono la curva va desde los 40 px, y la caja mide 224: los rótulos de abajo salen de ella (pisan la leyenda, como en el demo).
    const tel = W < 520, x0 = tel ? 40 : 47, x1 = W - (tel ? 6 : 4), yT = 17, yB = 222, top = 20;
    const X = (i) => x0 + (i / 29) * (x1 - x0), Y = (v) => yB - (v / top) * (yB - yT);
    // Una curva monótona (las tangentes de Fritsch–Carlson): pasa por cada punto sin pasarse de los picos, como la del demo.
    const liso = (vs) => {
      const xs = vs.map((_, i) => X(i)), ys = vs.map(Y), n = vs.length;
      const d = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]));
      const m = ys.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i])));
      return ys.map((y, i) => {
        if (!i) return `M${xs[0]},${y}`;
        const h = (xs[i] - xs[i - 1]) / 3;
        return `C${xs[i - 1] + h},${ys[i - 1] + m[i - 1] * h} ${xs[i] - h},${y - m[i] * h} ${xs[i]},${y}`;
      }).join(' ');
    };
    // ⚠️ En el teléfono se leen Sep 22, Sep 30 y Oct 8 (cada 8 días); el resto lo tapa el cartel de la tienda: el cuarto es supuesto.
    const marcas = tel ? [0, 8, 16, 24] : [0, 3, 6, 9, 12, 15, 18, 21, 24, 29];
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Revenue, this period against the period before">
      <defs><linearGradient id="g-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--ember)" stop-opacity=".2"/><stop offset="1" stop-color="var(--ember)" stop-opacity="0"/></linearGradient>
      <clipPath id="c-rev"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath></defs>
      ${[20, 15, 10, 5, 0].map((v) => `<line x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line-2)" stroke-dasharray="1 5" stroke-linecap="round"/>`).join('')}
      ${[20, 10, 0].map((v) => `<text class="chart__ax" x="${x0 - 10}" y="${Y(v) + 4}" text-anchor="end">${v ? `$${v.toFixed(1)}k` : '$0'}</text>`).join('')}
      <g clip-path="url(#c-rev)" class="chart__rev">
        <path d="${liso(esta)} L${X(29)},${yB} L${X(0)},${yB}Z" fill="url(#g-area)"/>
        <path d="${liso(antes)}" fill="none" stroke="var(--muted)" stroke-width="2" stroke-dasharray="6 5"/>
        <path class="chart__line" d="${liso(esta)}" fill="none" stroke="var(--ember)" stroke-width="2.4" stroke-linejoin="round"/>
      </g>
      ${lanz.map((l) => `<line x1="${X(l.i)}" x2="${X(l.i)}" y1="${Y(esta[l.i])}" y2="${yB}" stroke="${l.c}" stroke-width="1.6" stroke-dasharray="0 4" stroke-linecap="round"/><g class="chart__pin" style="--c:${l.c}"><circle cx="${X(l.i)}" cy="${yB}" r="6" stroke="${l.c}"/></g>`).join('')}
      ${marcas.map((i) => `<text class="chart__x" x="${X(i)}" y="${yB + 22}" text-anchor="${i === 0 ? 'start' : i === 29 ? 'end' : 'middle'}">${MES[dias[i].getUTCMonth()]} ${dias[i].getUTCDate()}</text>`).join('')}
    </svg>`;
    const ln = $('.chart__line', el);
    if (ln && !quieto) { const L = ln.getTotalLength(); ln.style.strokeDasharray = `${L}`; ln.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 1200, delay: 450, easing: P3IO, fill: 'backwards' }); }
    anim($('.chart__rev path', el), [{ opacity: 0 }, { opacity: 1 }], { duration: 900, delay: 700, easing: P2 });
  }

  // ── Where it came from ────────────────────────────────────────────────────────────────────────────────────────────
  const canales = [['Paid search', '2.8% conv.', 83368, 24, 'gold'], ['Organic', '2.0% conv.', 80633, 23, 'moss'], ['Email', '3.6% conv.', 75859, 22, 'sea'], ['Paid social', '1.7% conv.', 65200, 19, 'steel'], ['Referral', '2.3% conv.', 22571, 7, 'slate'], ['Creators', '1.4% conv.', 18752, 5, 'rose']];
  function mezcla() {
    const max = canales[0][2], tot = canales.reduce((a, c) => a + c[2], 0);
    $('[data-mixbar]').innerHTML = canales.map((c) => `<span class="t-${c[4]}" style="flex:${c[2] / tot};background:var(--c)"></span>`).join('');
    $('[data-mix]').innerHTML = canales.map((c) => `<div class="mix__row t-${c[4]}"><span class="mix__n">${c[0]} <small>${c[1]}</small></span><span class="mix__v">$${c[2].toLocaleString('en-US')}</span><span class="mix__p">${c[3]}%</span><span class="mix__track"><i style="width:${(c[2] / max) * 100}%"></i></span></div>`).join('');
  }

  // ── Running now ───────────────────────────────────────────────────────────────────────────────────────────────────
  const campanas = [
    ['search', 'gold', 'Brand Search — Highmoor', 'Paid search · 71 days left', 46058, 73300, '5.42×', 'ROAS', '$249,512'],
    ['mail', 'sea', 'Weekly Trail Notes', 'Email · 61 days left', 555, 900, '660', 'orders', '$87,760'],
    ['mail', 'sea', 'Cart Rescue Flow', 'Email · 91 days left', 494, 900, '589', 'orders', '$78,234'],
    ['share', 'steel', 'Trail Runner Retargeting', 'Paid social · 21 days left', 11179, 19000, '4.08×', 'ROAS', '$45,645'],
    ['search', 'gold', 'Tents & Shelters Shopping', 'Paid search · 31 days left', 5748, 12200, '5.47×', 'ROAS', '$31,422'],
    ['share', 'steel', 'Fall Layering Drop', 'Paid social · 10 days left', 6761, 9900, '4.11×', 'ROAS', '$27,777'],
  ];
  function enCurso() {
    $('[data-live]').innerHTML = campanas.map((c) => `<div class="live__row t-${c[1]}">
      <span class="live__ic">${usar(c[0])}</span>
      <a class="live__name" href="#"><b>${c[2]}</b><small>${c[3]}</small></a>
      <span class="live__bud"><i><span style="width:${(c[4] / c[5]) * 100}%"></span></i><span><b style="color:var(--text);font-weight:600">$${c[4].toLocaleString('en-US')}</b> of $${c[5].toLocaleString('en-US')}</span></span>
      <span class="live__fig"><b>${c[6]}</b><small>${c[7]}</small></span>
      <span class="live__fig live__fig--rev"><b>${c[8]}</b><small>revenue</small></span>
      <button class="switch" role="switch" aria-checked="true" aria-label="Pause ${c[2]}"></button>
    </div>`).join('');
    $$('.switch').forEach((b) => b.addEventListener('click', () => b.setAttribute('aria-checked', b.getAttribute('aria-checked') === 'true' ? 'false' : 'true')));
  }

  // ── Checkout funnel ───────────────────────────────────────────────────────────────────────────────────────────────
  const pasos = [['Sessions', 122200], ['Viewed a product', 72600], ['Added to cart', 9201], ['Reached checkout', 4892], ['Ordered', 2705]];
  const corto = (v) => (v >= 1e4 ? `${(v / 1e3).toFixed(v >= 1e5 ? 0 : 1)}k` : v.toLocaleString('en-US'));
  function embudo() {
    const r = pasos.map((p) => p[1]), t = r[0];
    const tasa = r.map((v, i) => (i ? v / r[i - 1] : 1));
    const fuga = tasa.slice(1).reduce((m, v, i) => (v < tasa[m] ? i + 1 : m), 1);
    $('[data-fun]').innerHTML = pasos.map((p, i) => `<div class="fun__step${i === fuga ? ' is-leak' : ''}" style="--k:${i}">
      <span class="fun__l">${p[0]}${i === fuga ? '<small>Biggest drop</small>' : ''}</span>
      <span class="fun__track"><span class="fun__bar" style="width:${Math.max(0.035, (p[1] / t) ** 0.42) * 100}%"></span></span>
      <span class="fun__v"><b>${corto(p[1])}</b><small>${i ? `${(tasa[i] * 100).toFixed(1)}%` : 'start'}</small></span>
    </div>`).join('');
  }

  // ── Hottest leads ─────────────────────────────────────────────────────────────────────────────────────────────────
  const leads = [['GL', 'rose', 'Northfork Outfitters', 'Grace Liang · Missoula, MT', '$41,200', 77], ['RS', 'rose', 'Silvercreek Engineering', 'Rachel Stein · Boise, ID', '$9,800', 71], ['NF', 'clay', 'Brightline Software', 'Noah Fischer · Seattle, WA', '$18,900', 70], ['HO', 'rose', 'Cascade Basecamp Supply', 'Hannah Okafor · Bend, OR', '$28,400', 68], ['FL', 'sea', 'Alder & Ash Mercantile', 'Freya Lindqvist · Ketchum, ID', '$17,400', 65]];
  function calientes() {
    const R = 15, C = 2 * Math.PI * R;
    $('[data-hot]').innerHTML = leads.map((l) => `<a class="hot__row" href="#"><span class="av t-${l[1]}">${l[0]}</span><span class="hot__n"><b>${l[2]}</b><small>${l[3]}</small></span>
      <span class="hot__v"><b>${l[4]}</b><span class="tag">Proposal</span></span>
      <span class="ring"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="${R}" fill="none" stroke="var(--well)" stroke-width="3"/><circle class="ring__arc" cx="18" cy="18" r="${R}" fill="none" stroke="${l[5] >= 75 ? 'var(--good)' : 'var(--gold)'}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - l[5] / 100)}" style="--C:${C}"/></svg>${l[5]}</span></a>`).join('');
  }

  // ── October budget ────────────────────────────────────────────────────────────────────────────────────────────────
  function medidor() {
    const el = $('[data-gauge]'); if (!el) return;
    const p = (a, r = 86) => [110 + r * Math.sin((a * Math.PI) / 180), 104 - r * Math.cos((a * Math.PI) / 180)];
    const [ax, ay] = p(-90), [bx, by] = p(90);
    const arco = `M${ax},${ay} A86,86 0 0 1 ${bx},${by}`;
    const parte = 28495 / 41300, hoy = 22 / 31, ang = -90 + 180 * parte, angHoy = -90 + 180 * hoy;
    const marcas = Array.from({ length: 21 }, (_, t) => { const n = -90 + t * 9, [x1, y1] = p(n, 70), [x2, y2] = p(n, 86 - (t % 5 === 0 ? 26 : 21)); return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${t % 5 === 0 ? 'var(--text)' : 'var(--line-2)'}" stroke-width="${t % 5 === 0 ? 2 : 1.5}" stroke-linecap="round"/>`; }).join('');
    const [hx1, hy1] = p(angHoy, 78), [hx2, hy2] = p(angHoy, 98);
    const L = Math.PI * 86;
    el.innerHTML = `<svg viewBox="0 0 220 122" role="img" aria-label="69% of the month's budget spent">
      <path d="${arco}" fill="none" stroke="var(--well)" stroke-width="14" stroke-linecap="round"/>
      <path class="gauge__fill" d="${arco}" fill="none" stroke="var(--ember)" stroke-width="14" stroke-linecap="round" stroke-dasharray="${L}" stroke-dashoffset="${L * (1 - parte)}" style="--L:${L}"/>
      ${marcas}
      <line x1="${hx1}" y1="${hy1}" x2="${hx2}" y2="${hy2}" stroke="var(--text)" stroke-width="3" stroke-linecap="round"/>
      <g class="gauge__needle" style="transform-origin:110px 104px;transform:rotate(${ang}deg)"><path d="M107.6,104 L109.2,34 L110.8,34 L112.4,104Z" fill="var(--text)"/><circle cx="110" cy="104" r="6.5" fill="var(--surface)" stroke="var(--text)" stroke-width="4"/></g>
    </svg>`;
    anim($('.gauge__needle', el), [{ transform: 'rotate(-90deg)' }, { transform: `rotate(${ang}deg)` }], { duration: 1100, delay: 650, easing: P3 });
    anim($('.gauge__fill', el), [{ strokeDashoffset: L }, { strokeDashoffset: L * (1 - parte) }], { duration: 1100, delay: 650, easing: P3 });
  }

  // ── Team activity ─────────────────────────────────────────────────────────────────────────────────────────────────
  const feed = [['DR', 'moss', 'Diego moved Cascade Basecamp Supply to Proposal', 'inbox', '17 min ago'], ['MO', 'gold', "Marcus raised Fall Layering Drop's daily cap to $260", 'cash', '53 min ago'], ['AT', 'clay', 'Aiko added 4 new field-test videos to Creator Field Tests', 'mega', '2 h ago'], ['IS', 'sea', 'Ingrid scheduled Winter Sleep System Preview for Sun 25 Oct', 'mega', '16 h ago'], ['SA', 'ember', 'Selin built the audience “Bought tents, never sleep”', 'users', '19 h ago'], ['TK', 'sea', 'Tomás closed Puget Sound Rowing — $5,100 a year', 'cup', '22 h ago']];
  function actividad() {
    $('[data-feed]').innerHTML = feed.map((f) => `<li><span class="av t-${f[1]}">${f[0]}</span><div><p>${f[2]}</p><small>${usar(f[3])}${f[4]}</small></div></li>`).join('');
  }

  // ── la pastilla del segmento y la de los números (corren al tocar) ─────────────────────────────────────────────────
  function pastilla(seg, animar) {
    const pill = $('.seg__pill', seg), on = $('[aria-pressed="true"]', seg); if (!pill || !on) return;
    const x = on.offsetLeft - 3, w = on.offsetWidth;
    pill.style.width = `${w}px`;
    if (animar && !quieto) pill.animate([{ transform: pill.style.transform || 'none' }, { transform: `translateX(${x}px)` }], { duration: 350, easing: 'cubic-bezier(.2,.8,.2,1)' });
    pill.style.transform = `translateX(${x}px)`;
  }
  function segmentos() {
    $$('[data-seg]').forEach((seg) => {
      pastilla(seg, false);
      $$('.seg__btn', seg).forEach((b) => b.addEventListener('click', () => { $$('.seg__btn', seg).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); pastilla(seg, true); }));
    });
    const k = $('[data-kpis]'), bar = $('.kpis__bar', k);
    const mover = (animar) => { const on = $('.kpi[aria-pressed="true"]', k); const x = on.offsetLeft - 6; if (animar && !quieto) bar.animate([{ transform: bar.style.transform || 'none' }, { transform: `translateX(${x}px)` }], { duration: 350, easing: 'cubic-bezier(.2,.8,.2,1)' }); bar.style.transform = `translateX(${x}px)`; };
    mover(false);
    $$('.kpi', k).forEach((b) => b.addEventListener('click', () => { $$('.kpi', k).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); mover(true); }));
  }

  // ── los números cuentan ───────────────────────────────────────────────────────────────────────────────────────────
  function contar(el, delay) {
    if (quieto) return;
    const txt = el.textContent, m = txt.match(/[\d,.]+/); if (!m) return;
    const fin = Number(m[0].replace(/,/g, '')), dec = (m[0].split('.')[1] || '').length, coma = m[0].includes(',');
    const t0 = performance.now() + delay;
    const paso = (t) => {
      const k = Math.min(1, Math.max(0, (t - t0) / 900)), e = 1 - Math.pow(1 - k, 3);
      const v = (fin * e).toFixed(dec);
      el.textContent = txt.replace(m[0], coma ? Number(v).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v);
      if (k < 1) requestAnimationFrame(paso); else el.textContent = txt;
    };
    requestAnimationFrame(paso);
  }

  // ── la entrada ────────────────────────────────────────────────────────────────────────────────────────────────────
  function entrada() {
    const tel = matchMedia('(max-width: 760px)').matches;
    anim($('.side'), [{ transform: 'translateX(-40px) scale(.97)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 900, easing: P3 });
    $$('.side__top, .nav__label, .nav__item, .goal-card, .me').forEach((el, i) => anim(el, [{ transform: 'translateX(-12px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 600, delay: 150 + i * 35, easing: P3 }));
    anim($('.goal-card__bar span'), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 1200, delay: 500, easing: P3 });
    $$('.top > *').filter((e) => e.offsetParent).forEach((el, i) => anim(el, [{ transform: 'translateY(-8px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 500, delay: 100 + i * 40, easing: P3 }));
    $$('.ov__head > div > *, .ov__actions > *').forEach((el, i) => anim(el, [{ transform: 'translateY(12px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 650, delay: 180 + i * 50, easing: P3 }));
    $$('.card').forEach((el, i) => anim(el, [{ transform: 'translateY(18px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 700, delay: 300 + i * 60, easing: P3 }));
    $$('.mix__bar span').forEach((el, i) => anim(el, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 900, delay: 600 + i * 50, easing: P3 }));
    $$('.mix__track i').forEach((el, i) => anim(el, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 900, delay: 650 + i * 60, easing: P3 }));
    $$('.live__bud i span').forEach((el, i) => anim(el, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 900, delay: 750 + i * 60, easing: P3 }));
    $$('.fun__bar').forEach((el, i) => anim(el, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 900, delay: 800 + i * 80, easing: P3 }));
    $$('.ring__arc').forEach((el, i) => { const C = Number(el.style.getPropertyValue('--C')); anim(el, [{ strokeDashoffset: C }, { strokeDashoffset: el.getAttribute('stroke-dashoffset') }], { duration: 1000, delay: 850 + i * 60, easing: P3 }); });
    $$('[data-cuenta]').forEach((el) => contar(el, tel ? 300 : 450));
  }

  curva(); mezcla(); enCurso(); embudo(); calientes(); medidor(); actividad(); segmentos(); entrada();
  let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { curva(); $$('[data-seg]').forEach((s) => pastilla(s, false)); }, 120); });
})();
