/* ═══════════════════════════════════════════════════════════════════════════════════════
   Lo que el CSS no puede hacer solo, copiado del fuente de los demos (1/11/2026):
     1. partir el título en PALABRAS y después en letras, cada una en su máscara
     2. ponerle el índice --i a cada hijo de un grupo, que es el stagger de GSAP
     3. los números CONTANDO desde cero (es de lo más visible de la entrada)
     4. el cambio de tema con el círculo que se abre desde el botón
     5. el flash del número que cambió, y el número que flota y se va
   ═══════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  const raiz = document.documentElement;
  const g = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } };
  const p = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  raiz.dataset.tema = g('mk-tema', raiz.dataset.temaInicial || 'claro');
  raiz.dataset.entrada = g('mk-entrada', 'si');
  raiz.dataset.hovercard = g('mk-hovercard', 'si');

  const quieto = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 1. EL TÍTULO ──────────────────────────────────────────────────────────────
     Coffer parte primero por palabra y después por letra:
       innerHTML = palabras.map(p => `<span class="word">${[...p].map(c =>
                     `<span class="ch">${c}</span>`).join('')}</span>`).join(' ')
     ⚠️ Partir sólo por letra deja que el salto de línea corte una palabra al medio.
     La máscara con overflow:hidden es obligatoria: sin ella se ven todas las letras
     desde el primer cuadro y el gesto se pierde. */
  function partirTitulo() {
    document.querySelectorAll('.h1').forEach((h) => {
      if (h.dataset.partido) return;
      const texto = h.textContent;
      h.setAttribute('aria-label', texto);
      h.textContent = '';
      let i = 0;
      texto.split(' ').forEach((palabra, np, todas) => {
        const w = document.createElement('span');
        w.className = 'mk-palabra';
        w.setAttribute('aria-hidden', 'true');
        [...palabra].forEach((c) => {
          const m = document.createElement('span');
          m.className = 'mk-mascara';
          const s = document.createElement('span');
          s.className = 'mk-ch';
          s.textContent = c;
          s.style.animationDelay = (0.04 + i++ * 0.022).toFixed(3) + 's';
          m.appendChild(s);
          w.appendChild(m);
        });
        h.appendChild(w);
        if (np < todas.length - 1) h.appendChild(document.createTextNode(' '));
      });
      h.dataset.partido = '1';
    });
  }

  /* ── 2. EL ESCALONADO ──────────────────────────────────────────────────────────
     GSAP escalona solo. En CSS hace falta el índice, y ponerlo a mano en el HTML
     lo ensucia y se desincroniza al agregar un bloque. Acá se calcula: el índice
     es la posición entre los hermanos que comparten el MISMO data-mk. */
  /* ⚠️ El índice se cuenta dentro del CONTENEDOR DEL GRUPO ([data-grupo]), no dentro
     del padre inmediato. Una barra suele ser hija única de su columna, así que
     agrupar por padre le da índice 0 a las doce: el escalonado desaparece y las
     barras entran todas juntas. El delay se lee bien en el CSS y mal en la pantalla. */
  function indexar() {
    const grupos = new Map();
    document.querySelectorAll('[data-mk]').forEach((el) => {
      const cont = el.closest('[data-grupo]') || el.parentElement;
      const clave = el.dataset.mk + '\u0000' + (cont ? nodoId(cont) : 'raiz');
      const n = grupos.get(clave) || 0;
      el.style.setProperty('--i', n);
      grupos.set(clave, n + 1);
    });
  }
  let contadorId = 0;
  function nodoId(el) {
    if (!el.dataset.mkId) el.dataset.mkId = 'g' + contadorId++;
    return el.dataset.mkId;
  }

  /* ── 3. LOS NÚMEROS CUENTAN DESDE CERO ────────────────────────────────────────
     Del bundle: contar(el, valor, {from:0, duration:1.3, delay:i*.06}), power3.out.
     Corbel usa duraciones distintas según qué sea el número, y eso se nota:
       total 1.3 · porcentaje del anillo 1.4 · leyenda 1.1 · los chicos .6
     El puntaje del medidor va a 1.7, que es el más lento de todos. */
  function contar() {
    if (raiz.dataset.entrada !== 'si' || quieto()) return;
    const nodos = [...document.querySelectorAll('[data-cuenta]')];
    nodos.forEach((el, i) => {
      const txt = el.dataset.fin || el.textContent;
      el.dataset.fin = txt;
      const m = txt.match(/-?[\d][\d.,]*/);
      if (!m) return;
      const crudo = m[0];
      const destino = parseFloat(crudo.replace(/\./g, '').replace(',', '.'));
      if (!isFinite(destino)) return;
      const dec = (crudo.split(',')[1] || '').length;
      const miles = crudo.includes('.') && dec === 0;
      const dur = parseFloat(el.dataset.cuenta) > 0 ? parseFloat(el.dataset.cuenta) * 1000 : 1300;
      const t0 = performance.now() + (parseFloat(el.dataset.cuentaDelay) || i * 0.06) * 1000;
      const paso = (ahora) => {
        const t = Math.min(1, Math.max(0, (ahora - t0) / dur));
        const e = 1 - Math.pow(1 - t, 3);                  // power3.out
        const v = destino * e;
        const s = dec ? v.toFixed(dec).replace('.', ',')
          : (miles ? Math.round(v).toLocaleString('es-AR') : String(Math.round(v)));
        el.textContent = txt.replace(crudo, s);
        if (t < 1) requestAnimationFrame(paso);
      };
      el.textContent = txt.replace(crudo, dec ? (0).toFixed(dec).replace('.', ',') : '0');
      requestAnimationFrame(paso);
    });
  }

  /* ── 4. EL TEMA: el círculo que se abre desde el botón que tocaste ────────────
     Medido en fitlo y merrin (450 ms) y en corbel (620 ms). El radio llega a la
     esquina MÁS LEJANA, por eso nunca queda un borde sin pintar.
     Y el ícono gira: {rotation:-90, scale:.6} → .6s back.out(2). */
  function cambiarTema(boton) {
    const r = boton.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const radio = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const aplicar = () => {
      raiz.dataset.tema = raiz.dataset.tema === 'oscuro' ? 'claro' : 'oscuro';
      p('mk-tema', raiz.dataset.tema);
      pintar();
      const svg = boton.querySelector('svg');
      if (svg && !quieto()) {
        svg.animate([{ transform: 'rotate(-90deg) scale(.6)' }, { transform: 'none' }],
          { duration: 600, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      }
    };
    if (!document.startViewTransition || quieto()) return aplicar();
    document.startViewTransition(aplicar).ready.then(() => {
      raiz.animate(
        { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)',
                     'circle(' + radio + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 620, easing: 'cubic-bezier(.65,0,.35,1)',
          pseudoElement: '::view-transition-new(root)' });
    });
  }

  /* ── 5. EL NÚMERO QUE FLOTA Y SE VA (Corbel) ──────────────────────────────── */
  window.mkFlota = function (el, texto, color) {
    if (quieto()) return;
    const r = el.getBoundingClientRect();
    const s = document.createElement('span');
    s.className = 'mk-flota';
    s.textContent = texto;
    s.style.left = (r.left + r.width / 2) + 'px';
    s.style.top = r.top + 'px';
    if (color) s.style.color = color;
    s.setAttribute('aria-hidden', 'true');
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1200);
  };

  /* ── la barra de control del mockup ──────────────────────────────────────── */
  const SOL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>';
  const LUNA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z"/></svg>';
  const ctl = document.createElement('div');
  ctl.className = 'mk-ctl';
  ctl.innerHTML =
    '<button class="mk-b" id="mk-tema" title="Claro / oscuro: el círculo se abre desde este botón"></button>' +
    '<button class="mk-b" id="mk-entrada" title="La entrada, leída del bundle de la referencia">Entrada</button>' +
    '<button class="mk-b" id="mk-hovercard" title="Levantar la tarjeta al pasar el cursor: [data-lift] de Corbel">Levantar</button>' +
    '<button class="mk-b" id="mk-otra" title="Volver a dibujar la entrada">Repetir</button>';
  document.body.appendChild(ctl);

  function pintar() {
    const osc = raiz.dataset.tema === 'oscuro';
    ctl.querySelector('#mk-tema').innerHTML = (osc ? SOL : LUNA) + (osc ? 'Claro' : 'Oscuro');
    ctl.querySelector('#mk-entrada').setAttribute('aria-pressed', raiz.dataset.entrada === 'si');
    ctl.querySelector('#mk-hovercard').setAttribute('aria-pressed', raiz.dataset.hovercard === 'si');
  }

  ctl.querySelector('#mk-tema').addEventListener('click', (e) => cambiarTema(e.currentTarget));
  const alternar = (id, clave) => ctl.querySelector('#' + id).addEventListener('click', () => {
    raiz.dataset[clave] = raiz.dataset[clave] === 'si' ? 'no' : 'si';
    p('mk-' + clave, raiz.dataset[clave]);
    pintar();
    if (clave === 'entrada' && raiz.dataset.entrada === 'si') repetir();
  });
  alternar('mk-entrada', 'entrada');
  alternar('mk-hovercard', 'hovercard');

  /* ⚠️ Esto NO puede hacer style.animation = '': ese atajo borra el animation-delay
     que cada letra lleva en línea y al repetir entran todas juntas, distinto que al
     recargar. Se replaya la animación declarada, sin tocar ningún estilo. */
  function repetir() {
    contar();
    document.getAnimations().forEach((a) => {
      if (a.constructor.name !== 'CSSAnimation') return;
      try { a.cancel(); a.play(); } catch (e) {}
    });
  }
  ctl.querySelector('#mk-otra').addEventListener('click', repetir);

  /* ⚠️ LA PESTAÑA EN SEGUNDO PLANO.
     Una entrada hecha con CSS arranca en opacity:0 y, si la pestaña se abrió en
     segundo plano, el navegador congela las animaciones en el primer fotograma:
     la persona vuelve y encuentra la pantalla VACÍA, no una pantalla que entra.
     GSAP lo disimula porque su ticker se pone al día al volver; el CSS no.
     Acá se posterga la entrada hasta que la pantalla se mire de verdad. */
  function arrancar() {
    partirTitulo();
    indexar();
    pintar();
    contar();
  }
  if (document.hidden) {
    raiz.dataset.entrada = 'no';          // sin entrada: el contenido se ve ya
    const alVolver = () => {
      if (document.hidden) return;
      document.removeEventListener('visibilitychange', alVolver);
      raiz.dataset.entrada = g('mk-entrada', 'si');
      arrancar();
      if (raiz.dataset.entrada === 'si') repetir();
    };
    document.addEventListener('visibilitychange', alVolver);
    arrancar();
  } else {
    arrancar();
  }

  /* el flash del número que cambió: se dispara solo cada 7 s para que se vea el gesto */
  const candidatos = [...document.querySelectorAll('[data-cuenta]')];
  if (candidatos.length) setInterval(() => {
    const e = candidatos[Math.floor(Date.now() / 7000) % candidatos.length];
    e.classList.remove('mk-flash'); void e.offsetWidth; e.classList.add('mk-flash');
  }, 7000);

  /* los recortes de tiempo DENTRO del bloque (no un filtro global) */
  document.querySelectorAll('.seg').forEach((s) => s.addEventListener('click', (ev) => {
    const b = ev.target.closest('b');
    if (!b) return;
    s.querySelectorAll('b').forEach((x) => x.classList.toggle('on', x === b));
  }));
})();
