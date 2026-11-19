/* KIT — motor común de los formatos de la galería de animaciones de MaKo.
 *
 * COPIA DE LA APP (public/avatar-cubos/, 19/11/2026): es C:/dev/artefactos-animaciones/reels/kit/kit.js con tres cambios,
 * marcados «APP»: el texto de la persona entra escapado (el iframe es del mismo origen que MaKo), en captura no espera un
 * requestAnimationFrame que un iframe fuera de la pantalla puede no dar nunca, y deja `window.__dur`.
 *
 * Un formato es una página reels/<id>.html con su #stage (1080×1920) y esto al final:
 *   <script src="t-<id>.js"></script>        ← window.TIEMPOS = {anchors, words}: lo escribe tools/voz_formato.sh
 *   <script src="kit/kit.js"></script>
 *   <script> KIT.arrancar({ voz:'voz-<id>.mp3', fuentes:['400 100px Anton'], cuadro(T, K){ ... } }) </script>
 *
 * REGLA: todo lo que se ve sale de T (el segundo). cuadro(T) pinta ese segundo desde cero, sin acordarse del anterior:
 * así el mismo segundo da siempre la misma imagen (capturas, MP4) y la voz manda el reloj.
 *   ?cap&t=12  → arranca congelado en el segundo 12 y pone window.__ready (para capturar y renderizar)
 *   ?t=12      → muestra el segundo 12 con el botón de play
 *   window.__seek(t) → pinta el segundo t
 *
 * Herramientas (K):
 *   K.A anchors {escena: segundo, end}, K.W palabras [texto, ini, fin, escena], K.DUR
 *   K.pal(escena, palabra, n=1) → {t0, t1, i} de esa palabra (minúsculas, sin tildes ni signos) o null
 *   K.ini(escena) → segundo en que arranca la escena
 *   K.p(T, t0, dur, curva='expo') → 0..1 con curva (expo, cubic, back, sine, elastic, lin, inout)
 *   K.mix(a, b, q), K.clamp(x, a=0, b=1), K.rnd(semilla) → función random 0..1 repetible
 *   K.habla(T) → 0..1 cuánto abre la boca (sale de las palabras)
 *   K.trozos({max:3, car:16, corte:/[.,:;?!]$/}) → [{ws:[índices], t0, t1, esc}] agrupa palabras para subtítulos
 *   K.cual(T, trozos) → índice del trozo que va (o -1)
 *   K.limpia(txt), K.ver(txt) (Máko → MaKo)
 *   K.subs.punch(el, opts) / K.subs.karaoke(el, opts) → función (T) que pinta los subtítulos
 *   K.$('id'), K.set(el, {estilos})
 */
(function () {
  const Q = new URLSearchParams(location.search), CAP = Q.has('cap');
  if (CAP) document.body.classList.add('kit-cap');   // 18/11: era «cap» y chocaba con reglas .cap{} de los formatos (sólo en captura y MP4)
  const $ = (id) => document.getElementById(id);
  const TT = window.TIEMPOS || { anchors: { end: 10 }, words: [] };
  const A = TT.anchors, W = TT.words, DUR = A.end;

  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const C = {
    lin: (q) => q,
    expo: (q) => (q >= 1 ? 1 : 1 - Math.pow(2, -10 * q)),
    cubic: (q) => 1 - Math.pow(1 - q, 3),
    quart: (q) => 1 - Math.pow(1 - q, 4),
    sine: (q) => Math.sin((q * Math.PI) / 2),
    inout: (q) => (q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2),
    back: (q) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(q - 1, 3) + c1 * Math.pow(q - 1, 2); },
    elastic: (q) => (q === 0 || q === 1 ? q : Math.pow(2, -10 * q) * Math.sin((q * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
    in: (q) => q * q * q,
  };
  // 0 exacto antes de t0 y 1 exacto después (back(0) da 2e-16 y un «> 0» se disparaba antes de tiempo)
  const p = (T, t0, dur, curva = 'expo') => { if (dur <= 0) return T >= t0 ? 1 : 0; const q = (T - t0) / dur; return q <= 0 ? 0 : q >= 1 ? 1 : C[curva](q); };
  const mix = (a, b, q) => a + (b - a) * q;
  const limpia = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ$%]/g, '');
  const ver = (s) => s.replace(/Máko/g, 'MaKo').replace(/máko/g, 'MaKo');
  const pal = (esc, palabra, n = 1) => { let k = 0; const b = limpia(palabra);
    for (let i = 0; i < W.length; i++) if ((!esc || W[i][3] === esc) && limpia(W[i][0]) === b) { k++; if (k === n) return { t0: W[i][1], t1: W[i][2], i }; }
    console.warn('KIT.pal: no está', esc, palabra); return null; };
  const ini = (esc) => (esc in A ? A[esc] : (console.warn('KIT.ini: no está', esc), 0));
  const rnd = (s) => { let x = s >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; };
  // boca: abierta mientras suena una palabra, con un vaivén por sílaba
  const habla = (T) => { for (const w of W) { if (T >= w[1] - 0.02 && T <= w[2] + 0.02) { const d = Math.max(0.12, w[2] - w[1]); const sil = Math.max(1, Math.round(d / 0.16));
        return 0.3 + 0.7 * Math.abs(Math.sin(((T - w[1]) / d) * Math.PI * sil)); } if (w[1] > T) break; } return 0; };
  // Palabras que nunca cierran un trozo (quedarían colgando: «ES LA», «HACE LAS») y pares que van juntos.
  const DEBIL = /^(a|al|de|del|el|la|las|los|lo|un|una|unos|unas|y|o|que|te|tu|tus|tú|es|en|con|para|por|se|su|sus|mi|me|no|sin|más|muy|como|cada|ese|esa|este|esta|le|les|ni|e|u|ya|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|cien|mil|\d+)$/;
  const JUNTOS = [['high', 'ticket']];
  const trozos = (o = {}) => { const max = o.max || 3, car = o.car || 16, corte = o.corte || /[.,:;?!]$/; const out = []; let cur = null;
    const lim = (s) => s.toLowerCase().replace(/[^a-záéíóúñü]/g, '');
    W.forEach((w, i) => { const largo = cur ? cur.ws.reduce((s, j) => s + W[j][0].length + 1, 0) + w[0].length : 0;
      const pegado = cur && cur.ws.length && JUNTOS.some(([x, y]) => lim(W[cur.ws[cur.ws.length - 1]][0]) === x && lim(w[0]) === y);
      if (!cur || cur.esc !== w[3] || cur.cierra || (!pegado && (cur.ws.length >= max || largo > car))) {
        const nuevo = { ws: [], esc: w[3], cierra: false };
        // si el trozo que se cierra termina en una palabra débil, esa palabra pasa al trozo nuevo
        if (cur && !cur.cierra && cur.esc === w[3] && cur.ws.length > 1 && DEBIL.test(lim(W[cur.ws[cur.ws.length - 1]][0]))) nuevo.ws.push(cur.ws.pop());
        cur = nuevo; out.push(cur); }
      cur.ws.push(i); if (corte.test(w[0])) cur.cierra = true; });
    out.forEach((t, j) => { t.t0 = W[t.ws[0]][1] - 0.06; t.t1 = j < out.length - 1 ? W[out[j + 1].ws[0]][1] - 0.06 : DUR; });
    return out; };
  const cual = (T, tr) => { for (let k = tr.length - 1; k >= 0; k--) if (T >= tr[k].t0) return T < tr[k].t1 ? k : -1; return -1; };
  const set = (el, st) => { for (const k in st) el.style[k] = st[k]; return el; };
  // APP: todo texto que viene de la persona pasa por acá antes de un innerHTML
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // Subtítulos «punch»: 1-3 palabras gigantes; la palabra clave en color; entra con un golpe de escala.
  function punch(el, o = {}) {
    const tr = trozos({ max: o.max || 3, car: o.car || 15 }); const clave = o.clave || /^$/; let hecho = -1;
    el.classList.add('k-punch');
    return (T) => { const k = cual(T, tr); if (k !== hecho) { hecho = k;
        el.innerHTML = k < 0 ? '' : tr[k].ws.map((i) => { const t = ver(W[i][0]).replace(/[¿¡]/g, '');
          const st = (clave.test(limpia(W[i][0])) ? 'color:' + (o.color || '#ffd400') + ';' : '') + (/MaKo/.test(t) ? 'text-transform:none;' : '');
          return '<span' + (st ? ' style="' + st + '"' : '') + '>' + esc(t) + '</span>'; }).join(''); }
      if (k < 0) return; const q = p(T, tr[k].t0, 0.16, 'back'); el.style.transform = 'scale(' + mix(0.82, 1, q) + ')'; el.style.opacity = clamp(q * 3); };
  }
  // Subtítulos «karaoke»: dos líneas en vidrio oscuro; la palabra que suena, con píldora de color.
  function karaoke(el, o = {}) {
    const tr = trozos({ max: o.max || 7, car: o.car || 30 }); let hecho = -1;
    el.classList.add('k-kara');
    return (T) => { const k = cual(T, tr); if (k !== hecho) { hecho = k;
        el.innerHTML = k < 0 ? '' : tr[k].ws.map((i) => '<span data-i="' + i + '">' + esc(ver(W[i][0])) + '</span>').join(' '); }
      el.style.opacity = k < 0 ? 0 : 1; if (k < 0) return;
      for (const s of el.children) { const w = W[+s.dataset.i]; s.classList.toggle('on', T >= w[1] - 0.04 && T < (W[+s.dataset.i + 1] ? W[+s.dataset.i + 1][1] - 0.04 : w[2] + 0.2)); } };
  }

  const K = { A, W, DUR, CAP, $, p, C, mix, clamp, rnd, pal, ini, habla, trozos, cual, limpia, ver, set, esc, subs: { punch, karaoke } };
  window.__dur = DUR;   // APP

  function arrancar(o) {
    const stage = $('stage'); const ancho = 1080, alto = 1920;
    const fit = () => { const s = Math.min(innerWidth / ancho, innerHeight / alto); stage.style.transform = 'scale(' + s + ')';
      stage.style.left = (innerWidth - ancho * s) / 2 + 'px'; stage.style.top = (innerHeight - alto * s) / 2 + 'px'; };
    fit(); addEventListener('resize', fit);
    if (o.color) document.documentElement.style.setProperty('--kit-go', o.color);
    const vo = document.createElement('audio'); vo.src = o.voz; vo.preload = 'auto'; document.body.appendChild(vo);
    const go = document.createElement('button'); go.id = 'kit-go'; go.setAttribute('aria-label', 'Ver con la voz');
    go.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 4 L20 12 L7 20 Z" fill="currentColor"/></svg>Ver con la voz'; document.body.appendChild(go);
    const ctl = document.createElement('div'); ctl.id = 'kit-ctl';
    ctl.innerHTML = '<button id="kit-bp" aria-label="Pausa">▶</button><button id="kit-br" aria-label="Reiniciar">↺</button><div class="tl"><i id="kit-tlb"></i></div><span id="kit-tt">0,0 s</span>';
    document.body.appendChild(ctl);
    let T = 0, corre = false, empezo = false, base = 0, desde = 0;
    const pinta = () => { o.cuadro(T, K); if (!CAP) { $('kit-tlb').style.width = (T / DUR) * 100 + '%'; $('kit-tt').textContent = T.toFixed(1).replace('.', ',') + ' s'; } };
    window.__seek = (t) => { corre = false; T = clamp(+t, 0, DUR - 0.001); pinta(); return true; };
    // reloj: mientras suena la voz, manda la voz; después, el reloj de la página hasta el final; y vuelve a empezar
    const tic = (now) => { if (corre) { if (!vo.paused && !vo.ended && vo.currentTime > 0) { T = vo.currentTime; base = now; desde = T; }
        else T = desde + (now - base) / 1000;
        if (T >= DUR) { T = 0; desde = 0; base = now; vo.currentTime = 0; vo.play().catch(() => {}); } pinta(); }
      requestAnimationFrame(tic); };
    const play = (t0) => { empezo = true; go.style.display = 'none'; T = t0; desde = t0; base = performance.now(); corre = true;
      vo.currentTime = Math.min(t0, (vo.duration || 99) - 0.05); vo.play().catch(() => {}); $('kit-bp').textContent = '❚❚'; };
    const pausa = () => { corre = false; vo.pause(); $('kit-bp').textContent = '▶'; };
    go.onclick = () => play(0);
    $('kit-bp').onclick = () => { if (!empezo) return play(0); if (corre) pausa(); else play(T); };
    $('kit-br').onclick = () => play(0);
    stage.addEventListener('click', () => { if (empezo) $('kit-bp').click(); });
    (async () => {
      const espera = [];
      for (const f of o.fuentes || []) espera.push(document.fonts.load(f).catch(() => {}));
      for (const src of o.imagenes || []) espera.push(new Promise((r) => { const im = new Image(); im.onload = im.onerror = r; im.src = src; }));
      if (o.listo) espera.push(o.listo);
      for (const e of (window.KIT && KIT._esperas) || []) espera.push(e);   // el Martín en cubos (Three.js) de kit/toma.js
      await Promise.race([Promise.all(espera), new Promise((r) => setTimeout(r, 15000))]);
      if (o.alArrancar) await o.alArrancar(K);
      const t = +(Q.get('t') || o.poster || 1.2);
      // APP: un iframe fuera de la pantalla puede no dar nunca un requestAnimationFrame: no se espera más de 100 ms
      window.__seek(t); await Promise.race([new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))), new Promise((r) => setTimeout(r, 100))]); window.__seek(t);
      if (CAP) window.__ready = true; else requestAnimationFrame(tic);
    })();
    return K;
  }
  window.KIT = Object.assign(K, { arrancar });
})();
