/* La barra de control del mockup + el cambio de tema con el círculo.
   El círculo está copiado de la medición del 31/10 sobre fitlo y merrin:
     clipPath: circle(0px at X Y) → circle(R at X Y), 450 ms, cubic-bezier(.65,0,.35,1)
   donde X,Y es el CENTRO DEL BOTÓN que tocaste y R la distancia a la esquina más lejana
   (por eso nunca queda un borde sin pintar). */
(function () {
  const raiz = document.documentElement;
  const g = (k, d) => localStorage.getItem(k) ?? d;
  raiz.dataset.tema = g('mk-tema', raiz.dataset.temaInicial || 'oscuro');
  raiz.dataset.entrada = g('mk-entrada', 'no');
  raiz.dataset.hovercard = g('mk-hovercard', 'si');

  const SOL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>';
  const LUNA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z"/></svg>';

  const ctl = document.createElement('div');
  ctl.className = 'mk-ctl';
  ctl.innerHTML =
    '<button class="mk-b" id="mk-tema" title="Claro / oscuro"></button>' +
    '<button class="mk-b" id="mk-entrada" title="La animación de entrada NO existe en las referencias: es un agregado nuestro">Entrada</button>' +
    '<button class="mk-b" id="mk-hovercard" title="Levantar la tarjeta al pasar el cursor: agregado nuestro">Hover tarjeta</button>' +
    '<button class="mk-b" id="mk-otra" title="Volver a dibujar, para ver la entrada">Repetir</button>';
  document.body.appendChild(ctl);

  const pintar = () => {
    const osc = raiz.dataset.tema === 'oscuro';
    const b = ctl.querySelector('#mk-tema');
    b.innerHTML = (osc ? SOL : LUNA) + (osc ? 'Claro' : 'Oscuro');
    ctl.querySelector('#mk-entrada').setAttribute('aria-pressed', raiz.dataset.entrada === 'si');
    ctl.querySelector('#mk-hovercard').setAttribute('aria-pressed', raiz.dataset.hovercard === 'si');
  };
  pintar();

  ctl.querySelector('#mk-tema').addEventListener('click', (e) => {
    const b = e.currentTarget;
    const r = b.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const radio = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const aplicar = () => {
      raiz.dataset.tema = raiz.dataset.tema === 'oscuro' ? 'claro' : 'oscuro';
      localStorage.setItem('mk-tema', raiz.dataset.tema);
      pintar();
    };
    const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || quieto) return aplicar();
    document.startViewTransition(aplicar).ready.then(() => {
      raiz.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radio}px at ${x}px ${y}px)`] },
        { duration: 450, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' });
    });
  });

  const alternar = (id, clave) => ctl.querySelector('#' + id).addEventListener('click', () => {
    raiz.dataset[clave] = raiz.dataset[clave] === 'si' ? 'no' : 'si';
    localStorage.setItem('mk-' + clave, raiz.dataset[clave]);
    pintar();
    if (clave === 'entrada' && raiz.dataset.entrada === 'si') repetir();
  });
  alternar('mk-entrada', 'entrada');
  alternar('mk-hovercard', 'hovercard');

  /* El título letra por letra, como Pane: cada carácter es un <span> con su desfase.
     Medido: desde translate(0,115%) rotate(6deg); el escalonado va de a ~18 ms. */
  function partirTitulo() {
    document.querySelectorAll('.h1').forEach((h) => {
      if (h.dataset.partido) return;
      const txt = h.textContent;
      h.textContent = '';
      [...txt].forEach((c, i) => {
        const m = document.createElement('span');   // la máscara que recorta
        m.className = 'mk-mascara';
        const s = document.createElement('span');   // la letra que sube
        s.className = 'mk-ch';
        s.textContent = c === ' ' ? ' ' : c;
        s.style.animationDelay = (0.04 + i * 0.022).toFixed(3) + 's';
        m.appendChild(s);
        h.appendChild(m);
      });
      h.dataset.partido = '1';
    });
  }
  partirTitulo();

  /* Los numeros SUBEN CONTANDO desde cero. Del bundle:
       $$('[data-count]').forEach((el,i) => contar(el, valor, {from:0, duration:1.3, delay:i*.06}))
     Es una de las partes mas visibles de la entrada y no la tenia. */
  function contarNumeros() {
    if (raiz.dataset.entrada !== 'si') return;
    const nodos = [...document.querySelectorAll('.num,.val,.big,.tl b,.tile .num')];
    nodos.forEach((el, i) => {
      const txt = el.dataset.fin || el.textContent;
      el.dataset.fin = txt;
      const m = txt.match(/-?[\d.,]+/);
      if (!m) return;
      const crudo = m[0];
      const destino = parseFloat(crudo.replace(/\./g, '').replace(',', '.'));
      if (!isFinite(destino)) return;
      const dec = (crudo.split(',')[1] || '').length;
      const miles = crudo.includes('.') && dec === 0;
      const t0 = performance.now() + i * 60;
      const dur = 1300;
      const paso = (ahora) => {
        const p = Math.min(1, Math.max(0, (ahora - t0) / dur));
        const e = 1 - Math.pow(1 - p, 3);               // power3.out
        const v = destino * e;
        const txtV = dec ? v.toFixed(dec).replace('.', ',')
                         : (miles ? Math.round(v).toLocaleString('es-AR') : String(Math.round(v)));
        el.textContent = txt.replace(crudo, txtV);
        if (p < 1) requestAnimationFrame(paso);
      };
      el.textContent = txt.replace(crudo, dec ? (0).toFixed(dec).replace('.', ',') : '0');
      requestAnimationFrame(paso);
    });
  }
  contarNumeros();


  /* ⚠️ Antes esto hacía `style.animation = ''`, y ese atajo BORRA el `animation-delay`
     que cada letra lleva en línea: al repetir entraban todas juntas, distinto que al
     recargar. Ahora se replaya la animación declarada, sin tocar ningún estilo. */
  function repetir() {
    contarNumeros();
    document.getAnimations().forEach((a) => {
      const n = a.animationName || (a.effect && a.effect.getKeyframes && '');
      if (a.constructor.name !== 'CSSAnimation') return;
      try { a.cancel(); a.play(); } catch (e) {}
    });
  }

  ctl.querySelector('#mk-otra').addEventListener('click', repetir);

  /* El flash del número que cambió, como `.is-flash` de Lumora (.9 s).
     Acá se dispara solo cada 6 s sobre un número, para que se vea el gesto. */
  const candidatos = [...document.querySelectorAll('.num,.val,.reloj,.tl b,.big')];
  if (candidatos.length) setInterval(() => {
    const e = candidatos[Math.floor(Date.now() / 6000) % candidatos.length];
    e.classList.remove('mk-flash'); void e.offsetWidth; e.classList.add('mk-flash');
  }, 6000);
})();
