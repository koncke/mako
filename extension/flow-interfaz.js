// =============================================================================
// El motor por INTERFAZ: MaKo aprieta los botones reales de Flow
// =============================================================================
// Content script (mundo aislado) de la pestaña de flow.google.com. Reemplaza al
// replay de BOQ para generar video e imagen y para subir la foto.
//
// ⚠️ POR QUÉ SE DEJÓ DE REPETIR LAS LLAMADAS DE BOQ. El replay copiaba el pedido
// que la persona enseñó y le cambiaba el texto. Cada rechazo de Google destapó
// una pieza efímera más que había que reponer a mano (el `at`, el token de
// reCAPTCHA de un solo uso, los ids de cliente en mayúsculas), y las dos que
// quedaron sin resolver eran las que hacían falta para el producto: la CARA (el
// replay reproduce el tipo de generación que se enseñó, así que sin referencia
// salía otra persona) y el sondeo del video (el payload es posicional y el
// `rpcid` rota con cada bundle de Google). Era mantenimiento continuo contra un
// protocolo privado que Google reescribe sin avisar.
//
// La interfaz no rota con el bundle: «Start generation», «Settings trigger» y el
// selector de ingredientes son los mismos botones que aprieta una persona, y la
// propia página acuña su captcha, sus ids y su `at` como siempre. Nada de esto
// imita a un humano ni fabrica señales: es la página real, con la sesión real,
// a ritmo de persona (una generación por vez, pausas de segundos entre pasos).
//
// El MÉTODO se estudió de flow-mcp (github.com/GTAI-1/flow-mcp, que maneja Flow
// por CDP desde un Chrome propio). Ese repo no tiene licencia, así que su código
// no se copia: esto es una reescritura propia, para correr ADENTRO de la pestaña
// del cliente y no desde afuera. Los rótulos que usa son los que flow-mcp midió
// en la interfaz en inglés (16/10/2026); por eso la pestaña se maneja con `hl=en`.
//
// ⚠️ LA PLATA: el crédito se gasta cuando se aprieta «Start generation». Todo lo
// anterior se puede repetir; eso no. `salio` se escribe en storage ANTES del clic
// y un trabajo con `salio: true` no vuelve a apretar nunca, aunque el service
// worker se reinicie o el servidor lo reparta de nuevo. Lo peor de este default
// es que alguien tenga que apretar «filmar» otra vez; lo peor del otro es cobrarle
// dos veces el mismo clip.

(() => {
  const VERSION = '0.69.0';
  const previo = globalThis.__makoInterfaz;
  if (previo && previo.version === VERSION) return;
  if (previo && typeof previo.apagar === 'function') {
    try { previo.apagar(); } catch { /* el viejo puede estar huérfano */ }
  }

  // ── Los rótulos de la interfaz en inglés ──────────────────────────────────
  // Una sola tabla: si Google renombra un botón, se cambia acá y la sonda lo dice.
  const R = Object.freeze({
    ajustes: 'Settings trigger',
    generar: 'Start generation',
    ingredientes: 'Add ingredients to the prompt box',
    limpiar: 'Clear prompt',
    agente: 'Agent',
    modelo: 'Select model family',
    agregarAlPrompt: 'Add to prompt',
    menuMedios: 'Add media menu',
    subir: 'Upload',
    listaAssets: 'Asset list',
    pestanaTodo: 'All',
    volver: 'Back button to go to previous page',
  });

  const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const CLAVE = (id) => `interfaz:${id}`;

  /** Cuánto se espera, como mucho, a que Flow termine. */
  const TOPE_MS = { imagen: 4 * 60 * 1000, video: 9 * 60 * 1000, subida: 2 * 60 * 1000 };

  // ── Utilidades de DOM ─────────────────────────────────────────────────────

  /**
   * Esperar, con el reloj del service worker.
   *
   * ⚠️ UNA PESTAÑA DE FONDO NO TIENE RELOJ CONFIABLE. Chrome frena los timers de
   * una pestaña oculta, y pasados cinco minutos oculta los encadenados se alinean
   * a UN MINUTO. La pestaña de Flow casi siempre está de fondo —la persona mira
   * MaKo—, así que con `setTimeout` cada paso de la receta podía tardar un minuto.
   * Un mensaje al service worker no es un timer de la página: vuelve cuando el
   * worker contesta. Si el canal no está (extensión recargada), cae al timer.
   */
  const dormir = (ms) => new Promise((resolve) => {
    let hecho = false;
    const listo = () => { if (!hecho) { hecho = true; resolve(); } };
    try {
      chrome.runtime.sendMessage({ tipo: 'INTERFAZ_DORMIR', ms }, () => { void chrome.runtime.lastError; listo(); });
    } catch { /* sin canal */ }
    setTimeout(listo, ms + 1500);
  });
  /** Una pausa de persona: ni fija ni instantánea. */
  const pausa = (min = 350, max = 900) => dormir(min + Math.random() * (max - min));

  async function esperarHasta(fn, ms, cada = 250) {
    const fin = Date.now() + ms;
    for (;;) {
      let v;
      try { v = fn(); } catch { v = null; }
      if (v) return v;
      if (Date.now() > fin) return null;
      await dormir(cada);
    }
  }

  function visible(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  }

  /** El nombre accesible, como lo calcula un lector de pantalla (lo suficiente). */
  function nombreDe(el) {
    const al = el.getAttribute('aria-label');
    if (al && al.trim()) return al.replace(/\s+/g, ' ').trim();
    const lb = el.getAttribute('aria-labelledby');
    if (lb) {
      const t = lb.split(/\s+/).map((id) => document.getElementById(id)?.innerText || '').join(' ').trim();
      if (t) return t.replace(/\s+/g, ' ');
    }
    if (el.labels && el.labels[0]) return el.labels[0].innerText.replace(/\s+/g, ' ').trim();
    return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  const SELECTOR_ROL = {
    button: 'button, [role="button"]',
    radio: '[role="radio"], input[type="radio"]',
    menuitem: '[role="menuitem"]',
    option: '[role="option"]',
    listbox: '[role="listbox"]',
    tab: '[role="tab"]',
    link: 'a, [role="link"]',
  };

  /** Los elementos visibles con ese rol y ese nombre. */
  function porRol(rol, nombre, { raiz = document, exacto = true } = {}) {
    const coincide = (n) => (nombre instanceof RegExp ? nombre.test(n) : exacto ? n === nombre : n.includes(nombre));
    return [...raiz.querySelectorAll(SELECTOR_ROL[rol])].filter((el) => visible(el) && coincide(nombreDe(el)));
  }
  const uno = (rol, nombre, op) => porRol(rol, nombre, op)[0] || null;

  /**
   * Un clic completo. `el.click()` solo no alcanza para todos los componentes:
   * algunos abren con `pointerdown`. Son los mismos eventos que manda un clic de
   * mouse, en el mismo orden, sobre el centro del elemento.
   */
  function clic(el) {
    const r = el.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, composed: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 };
    try {
      el.dispatchEvent(new PointerEvent('pointerover', o));
      el.dispatchEvent(new MouseEvent('mouseover', o));
      el.dispatchEvent(new PointerEvent('pointerdown', { ...o, pointerType: 'mouse', isPrimary: true }));
      el.dispatchEvent(new MouseEvent('mousedown', o));
      if (typeof el.focus === 'function') el.focus({ preventScroll: true });
      el.dispatchEvent(new PointerEvent('pointerup', { ...o, pointerType: 'mouse', isPrimary: true }));
      el.dispatchEvent(new MouseEvent('mouseup', o));
    } catch { /* algunos elementos no aceptan PointerEvent: el click igual va */ }
    el.click();
  }

  function tecla(key) {
    const t = document.activeElement || document.body;
    const o = { key, code: key, bubbles: true, cancelable: true, composed: true, keyCode: key === 'Escape' ? 27 : 0 };
    t.dispatchEvent(new KeyboardEvent('keydown', o));
    t.dispatchEvent(new KeyboardEvent('keyup', o));
  }

  /** Cierra menús y popovers. Algunos menús de Flow ignoran Escape: el fondo los cierra. */
  async function cerrarCapas() {
    tecla('Escape');
    await dormir(250);
    for (let i = 0; i < 4; i++) {
      const fondos = [...document.querySelectorAll('.cdk-overlay-backdrop.cdk-overlay-backdrop-showing')];
      if (!fondos.length) break;
      clic(fondos[fondos.length - 1]);
      await dormir(400);
    }
  }

  /** La grilla es virtual y la barra de arriba se esconde al bajar: todo empieza arriba. */
  async function alPrincipio() {
    document.querySelectorAll('.page-container').forEach((e) => { e.scrollTop = 0; });
    await dormir(350);
  }

  // ── Dónde está la persona ─────────────────────────────────────────────────

  function enProyecto() {
    return /\/project\/[0-9a-f-]{36}/i.test(location.pathname);
  }
  function enEdicion() {
    return /\/edit\/[0-9a-f-]{36}/i.test(location.pathname);
  }
  function idioma() {
    return (document.documentElement.lang || '').toLowerCase();
  }

  /**
   * ¿Se puede generar ahora mismo? Es la pregunta del latido.
   *
   * ⚠️ NO MIRA EL IDIOMA. Una pestaña en español se pone en inglés antes de
   * generar (lo hace el service worker con `hl=en`); un idioma distinto no es
   * «no puede», es un paso más.
   */
  function estado() {
    // `ocupado` es el id del trabajo que esta pestaña está siguiendo: el service
    // worker lo compara para saber si un registro en curso todavía tiene dueño.
    if (ocupado) return { puede: true, porQue: '', ocupado, idioma: idioma() };
    if (!enProyecto()) return { puede: false, porQue: 'INTERFAZ_FUERA_DE_PROYECTO', ocupado: null };
    const caja = document.querySelector('.ProseMirror');
    if (!caja) return { puede: false, porQue: 'INTERFAZ_SIN_COMPOSITOR', ocupado: null };
    return { puede: true, porQue: '', ocupado: null, idioma: idioma() };
  }

  // ── La grilla ─────────────────────────────────────────────────────────────

  /**
   * Lo que se sabe de cada baldosa.
   *
   * ⚠️ UN VIDEO EN REPOSO NO TIENE ID EN EL DOM: sólo su miniatura, con una url
   * firmada que Google vuelve a firmar con el tiempo. Por eso un video no se
   * identifica por su `src` (una baldosa vieja parecería nueva) sino por
   * POSICIÓN: las nuevas aparecen arriba, y se genera de a una.
   */
  function baldosas() {
    return [...document.querySelectorAll('flow-grid-tile-container')].map((t) => {
      const conId = t.querySelector('[data-media-id]');
      const conSrc = t.querySelector('img[src], video[src]');
      const src = conSrc ? conSrc.getAttribute('src') || '' : '';
      const id = (conId && conId.getAttribute('data-media-id')) || (UUID.exec(src) || [])[0] || '';
      const tipo = t.querySelector('flow-video-tile') ? 'video' : t.querySelector('flow-image-tile') ? 'imagen' : 'otro';
      const texto = t.innerText || '';
      const error = !!t.querySelector('flow-error-tile');
      // Un video recién pedido primero se titula con el prompt y no tiene miniatura,
      // después muestra «NN%», y terminado tiene miniatura. Sin miniatura = ocupado.
      const ocupadoT = /\d+\s*%/.test(texto)
        || (tipo === 'video' && !t.querySelector('img[alt="Generated video thumbnail"], video'));
      return { el: t, id, tipo, titulo: t.getAttribute('aria-label') || '', error, ocupado: ocupadoT };
    });
  }

  // ── Los ajustes ───────────────────────────────────────────────────────────

  async function abrirAjustes() {
    for (let i = 0; i < 3; i++) {
      if (uno('radio', 'Image')) return;
      const t = uno('button', R.ajustes);
      if (!t) throw falla('SIN_AJUSTES', 'No encontré los ajustes de generación de Flow.');
      clic(t);
      await esperarHasta(() => uno('radio', 'Image'), 3000);
    }
    if (!uno('radio', 'Image')) throw falla('SIN_AJUSTES', 'Los ajustes de generación de Flow no abrieron.');
  }

  function marcado(el) {
    return el.getAttribute('aria-checked') === 'true' || el.checked === true || el.getAttribute('aria-pressed') === 'true';
  }

  async function elegirRadio(nombre) {
    const r = uno('radio', nombre);
    if (!r) throw falla('SIN_OPCION', `Flow no ofrece «${nombre}» con este modo.`);
    if (!marcado(r)) { clic(r); await pausa(350, 650); }
  }

  /** De los Nano Banana, el de versión más alta que no sea Lite. */
  function nanoBananaMasNuevo(nombres) {
    const ver = (n) => ((/nano banana\s+(\d+(?:\.\d+)*)/i.exec(n) || [])[1] || '').split('.').filter(Boolean).map(Number);
    let mejor = -1;
    let vMejor = [];
    nombres.forEach((n, i) => {
      const v = ver(n);
      if (!v.length || /\blite\b/i.test(n)) return;
      const largo = Math.max(v.length, vMejor.length);
      for (let k = 0; k < largo; k++) {
        const a = v[k] || 0;
        const b = vMejor[k] || 0;
        if (a > b || mejor < 0) { mejor = i; vMejor = v; return; }
        if (a < b) return;
      }
    });
    return mejor;
  }

  async function elegirModelo(quiero) {
    const b = uno('button', R.modelo);
    if (!b) return; // sin selector: Flow usa el suyo, y el costo de abajo lo vigila
    // El modelo puesto se lee del TEXTO del botón: su nombre accesible es el rótulo
    // fijo («Select model family») y nunca coincidiría con ningún modelo.
    const actual = (b.innerText || b.textContent || '').replace(/\s+/g, ' ').trim();
    clic(b);
    await esperarHasta(() => porRol('menuitem', /./).length, 4000);
    const items = porRol('menuitem', /./);
    const nombres = items.map((i) => nombreDe(i));
    const idx = quiero === 'nano' ? nanoBananaMasNuevo(nombres) : nombres.findIndex((n) => n.toLowerCase().includes(quiero.toLowerCase()));
    if (idx < 0 || actual.includes(nombres[idx])) {
      await cerrarCapas();
      if (idx < 0 && quiero !== 'nano') throw falla('SIN_MODELO', `Flow no ofrece el modelo «${quiero}» (hay: ${nombres.join(', ')}).`);
      return;
    }
    clic(items[idx]);
    await pausa(500, 900);
  }

  /** El costo que Flow cotiza para estos ajustes, en créditos. */
  function costo() {
    const l = uno('link', /\d+\s*credits?$/i, { exacto: false }) || uno('button', /\d+\s*credits?$/i, { exacto: false });
    if (!l) return NaN;
    return Number((/(\d+)\s*credits?$/i.exec(nombreDe(l)) || [])[1]);
  }

  async function aplicarAjustes(p) {
    await abrirAjustes();
    await elegirRadio(p.tipo === 'imagen' ? 'Image' : 'Video');
    if (p.tipo === 'video') await elegirRadio('Ingredients');
    await elegirRadio(p.vertical === false ? '16:9' : '9:16');
    if (p.tipo === 'imagen') await elegirModelo('nano');
    else if (p.modelo) await elegirModelo(p.modelo);
    if (p.tipo === 'video') {
      if (uno('radio', /^720p/)) await elegirRadio(/^720p/);
      if (p.segundos && uno('radio', `${p.segundos}s`)) await elegirRadio(`${p.segundos}s`);
    }
    if (uno('radio', 'x1')) await elegirRadio('x1');
    await pausa(500, 800);
    const c = costo();
    await cerrarCapas();
    return c;
  }

  // ── La referencia (la cara) ───────────────────────────────────────────────

  function chipsDeIngredientes() {
    // Los adjuntos se ven como botones «Ingredient …» dentro del compositor. El
    // abridor también dice «ingredients», así que se excluye por nombre exacto.
    return porRol('button', /\bingredient\b/i).filter((b) => nombreDe(b) !== R.ingredientes).length;
  }

  function opcionConMedio(lista, mediaId) {
    return [...lista.querySelectorAll('[role="option"]')].find((o) =>
      o.querySelector(`[data-media-id="${mediaId}"]`) || (o.innerHTML || '').includes(mediaId)) || null;
  }

  /**
   * Adjunta como ingrediente un medio que YA está en el proyecto, por su id.
   * Sin la cara no se genera: una persona distinta cuesta el clip entero.
   */
  async function adjuntar(mediaId) {
    const antes = chipsDeIngredientes();
    const abridor = uno('button', R.ingredientes);
    if (!abridor) throw falla('SIN_INGREDIENTES', 'No encontré dónde adjuntar la foto en Flow.');
    let lista = null;
    for (let i = 0; i < 3 && !lista; i++) {
      if (i) { await cerrarCapas(); await pausa(600, 900); }
      clic(abridor);
      lista = await esperarHasta(() => uno('listbox', R.listaAssets) || (uno('tab', R.pestanaTodo) && uno('listbox', /./)), 5000);
    }
    if (!lista) throw falla('SIN_SELECTOR', 'El selector de medios de Flow no abrió.');
    const todo = uno('tab', R.pestanaTodo);
    if (todo && todo.getAttribute('aria-selected') !== 'true') { clic(todo); await pausa(800, 1200); }
    lista = uno('listbox', R.listaAssets) || lista;

    let op = opcionConMedio(lista, mediaId);
    // La lista puede ser virtual: se baja de a pantallas buscando el medio.
    for (let paso = 0; paso < 25 && !op; paso++) {
      const antesTop = lista.scrollTop;
      lista.scrollTop = antesTop + lista.clientHeight * 0.8;
      await dormir(450);
      op = opcionConMedio(lista, mediaId);
      if (lista.scrollTop === antesTop) break;
    }
    for (const nombre of ['Images', 'Uploads']) {
      if (op) break;
      const t = uno('tab', nombre);
      if (!t) continue;
      clic(t);
      await pausa(900, 1300);
      lista = uno('listbox', R.listaAssets) || lista;
      op = opcionConMedio(lista, mediaId);
    }
    if (!op) {
      await cerrarCapas();
      throw falla('SIN_REFERENCIA', 'Tu foto no está en este proyecto de Flow.');
    }
    op.scrollIntoView({ block: 'center' });
    await pausa(300, 600);
    clic(op);
    const agregar = await esperarHasta(() => uno('button', R.agregarAlPrompt), 1500);
    if (agregar) clic(agregar);
    await esperarHasta(() => !uno('listbox', R.listaAssets), 8000);
    await pausa(400, 700);
    if (chipsDeIngredientes() <= antes) throw falla('SIN_REFERENCIA', 'Flow no tomó la foto como referencia.');
  }

  // ── El prompt ─────────────────────────────────────────────────────────────

  async function escribir(texto) {
    const cajas = [...document.querySelectorAll('.ProseMirror')].filter(visible);
    const caja = cajas[0] || document.querySelector('.ProseMirror');
    if (!caja) throw falla('SIN_COMPOSITOR', 'No encontré la caja de texto de Flow.');
    caja.focus();
    document.execCommand('selectAll', false);
    document.execCommand('delete', false);
    // Enter manda en Flow: el prompt va en una sola línea.
    const limpio = String(texto).replace(/\s*\n+\s*/g, ' ').trim();
    document.execCommand('insertText', false, limpio);
    await pausa(400, 700);
    const quedo = (caja.innerText || '').replace(/\s+/g, ' ').trim();
    if (!quedo.startsWith(limpio.slice(0, 40))) throw falla('PROMPT_NO_ENTRO', 'Flow no tomó el texto del pedido.');
  }

  // ── Fallas ────────────────────────────────────────────────────────────────

  /** Una falla ANTES de apretar «Start generation»: no gastó nada. */
  function falla(codigo, mensaje) {
    const e = new Error(mensaje);
    e.codigo = codigo;
    return e;
  }

  async function guardar(id, cambios) {
    const k = CLAVE(id);
    const actual = (await chrome.storage.local.get(k))[k] || {};
    const nuevo = { ...actual, ...cambios, cuando: Date.now() };
    await chrome.storage.local.set({ [k]: nuevo });
    return nuevo;
  }

  // ── Generar ───────────────────────────────────────────────────────────────

  let ocupado = null;

  async function prepararCompositor() {
    await cerrarCapas();
    if (enEdicion()) {
      const v = uno('button', R.volver);
      if (v) { clic(v); await esperarHasta(() => !enEdicion(), 5000); }
    }
    await alPrincipio();
    const agente = uno('button', R.agente);
    if (agente && agente.getAttribute('aria-pressed') === 'true') { clic(agente); await pausa(); }
    const limpiar = uno('button', R.limpiar);
    if (limpiar) { clic(limpiar); await pausa(); }
  }

  /**
   * Una generación de punta a punta. Escribe su avance en storage para que el
   * service worker —que puede reiniciarse en el medio— lo lea sin depender de
   * tener abierto el canal de mensajes.
   */
  async function generar(p) {
    const id = p.trabajoId;
    const previo = (await chrome.storage.local.get(CLAVE(id)))[CLAVE(id)];
    if (previo && previo.fase === 'listo') return previo;
    // ⚠️ LA GUARDA DE LA PLATA. Si este trabajo ya apretó «Start generation» y
    // llegó acá, es que la pestaña se recargó en el medio: el script que lo seguía
    // murió con ella. Lo pedido está pagado y va a aparecer en el proyecto de
    // Flow; volver a apretar sería cobrarlo dos veces. Y sin el script de antes no
    // hay forma segura de saber cuál de las baldosas es la nuestra.
    if (previo && previo.salio) {
      return guardar(id, {
        fase: 'fallo',
        motivo: 'permanente',
        codigo: 'RECARGADA',
        error: 'La pestaña de Flow se recargó mientras generaba. Lo pedido quedó en tu proyecto de Flow y MaKo no lo volvió a pedir.',
      });
    }

    await guardar(id, { tipo: p.tipo, fase: 'preparando', salio: false, desde: Date.now() });
    await prepararCompositor();
    const cotizado = await aplicarAjustes(p);
    const tope = Number(p.maxCreditos);
    if (Number.isFinite(tope) && (!Number.isFinite(cotizado) || cotizado > tope)) {
      throw falla('CARO', Number.isFinite(cotizado)
        ? `Flow pide ${cotizado} créditos y el tope es ${tope}.`
        : 'No pude leer cuántos créditos cuesta en Flow.');
    }
    for (const ref of p.referencias || []) await adjuntar(ref);
    await escribir(p.prompt);

    const boton = uno('button', R.generar);
    if (!boton || boton.disabled || boton.getAttribute('aria-disabled') === 'true') {
      throw falla('GENERAR_APAGADO', 'Flow no habilitó el botón de generar.');
    }
    await alPrincipio();
    const antes = baldosas();
    const idsAntes = antes.map((b) => b.id).filter(Boolean);
    const primeroAntes = antes[0] ? antes[0].el : null;

    // ⚠️ `salio` SE ESCRIBE ANTES DEL CLIC. Si algo muere entre esta línea y la
    // siguiente, el trabajo queda como «salió» sin haber salido: alguien tendrá
    // que apretar de nuevo. Al revés, se cobraría dos veces.
    await guardar(id, { fase: 'enviado', salio: true, enviadoEn: Date.now(), cotizado, idsAntes });
    clic(boton);
    return seguir(p, { idsAntes, primeroAntes, enviadoEn: Date.now() });
  }

  /** Espera la baldosa nueva y saca de ella lo que MaKo necesita. */
  async function seguir(p, ctx) {
    const id = p.trabajoId;
    const tope = TOPE_MS[p.tipo] || TOPE_MS.video;
    const fin = (ctx.enviadoEn || Date.now()) + tope;
    const idsAntes = new Set(ctx.idsAntes || []);
    const inicioPrompt = String(p.prompt || '').replace(/\s+/g, ' ').trim().slice(0, 30).toLowerCase();
    // ⚠️ EL VIDEO NUEVO SE RECONOCE POR HABERLO VISTO NACER. Un video en reposo no
    // tiene id en el DOM y Angular puede rehacer los nodos de la grilla, así que
    // «la de arriba es otra» no prueba nada: con eso se entregaba el último video
    // TERMINADO, el de antes, como si fuera el nuevo. Primero hay que ver arriba
    // una baldosa trabajando (con el prompt de título o contando %), y recién
    // cuando ESA termina, es la nuestra.
    let vistoNacer = false;

    while (Date.now() < fin) {
      await dormir(2000);
      await alPrincipio();
      const bs = baldosas();
      if (p.tipo === 'imagen') {
        // Una imagen terminada trae su id en `data-media-id`, que es estable.
        const nueva = bs.find((b) => b.tipo === 'imagen' && b.id && !idsAntes.has(b.id) && !b.ocupado && !b.titulo.startsWith('mako-'));
        if (nueva) return terminar(p, nueva);
      } else {
        const top = bs[0];
        if (!top) continue;
        const conPrompt = !!inicioPrompt && (top.titulo || '').toLowerCase().startsWith(inicioPrompt);
        if (!vistoNacer) {
          if (top.error && (conPrompt || top.el !== ctx.primeroAntes)) return fallaDeFlow(p, top);
          vistoNacer = conPrompt || (top.ocupado && top.el !== ctx.primeroAntes);
          if (vistoNacer) await guardar(id, { fase: 'generando' });
          continue;
        }
        if (top.error) return fallaDeFlow(p, top);
        if (top.tipo === 'video' && !top.ocupado) return terminar(p, top);
      }
      const err = bs.slice(0, 3).find((b) => b.error && !idsAntes.has(b.id));
      if (err && p.tipo === 'imagen') return fallaDeFlow(p, err);
    }
    return guardar(id, {
      fase: 'fallo',
      error: 'Flow tardó demasiado. Si termina, va a aparecer en tu proyecto de Flow.',
      motivo: 'permanente',
    });
  }

  async function fallaDeFlow(p, b) {
    const texto = (b.el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    // Flow dice «You have not been charged» en esta baldosa: no gastó.
    return guardar(p.trabajoId, { fase: 'fallo', motivo: 'contenido', error: 'Flow no pudo generarlo.', crudo: texto });
  }

  /** La url del medio terminado, desde la baldosa o desde su vista de edición. */
  async function terminar(p, b) {
    let mediaId = b.id;
    let url = '';
    const img = b.el.querySelector('img[data-media-id], img[src]');
    if (p.tipo === 'imagen' && img) url = img.currentSrc || img.src || '';
    if (p.tipo === 'video') {
      // Abrir la baldosa lleva a /edit/<id>: ahí está el id del medio y el <video>.
      clic(b.el.querySelector('flow-video-tile') || b.el);
      await esperarHasta(() => enEdicion(), 8000);
      // ⚠️ EL ID QUE VA DESPUÉS DE /edit/, NO EL PRIMERO DE LA RUTA: la ruta es
      // /project/<proyecto>/edit/<medio>, y el primer uuid es el del PROYECTO.
      mediaId = (/\/edit\/([0-9a-f-]{36})/i.exec(location.pathname) || [])[1] || mediaId;
      const v = await esperarHasta(() => [...document.querySelectorAll('video')].find((x) => x.currentSrc || x.src), 8000);
      if (v) url = v.currentSrc || v.src || '';
      const volver = uno('button', R.volver);
      if (volver) { clic(volver); await esperarHasta(() => !enEdicion(), 6000); }
    }
    const medio = await bajarYEntregar(p, url).catch((e) => ({ error: String((e && e.message) || e) }));
    return guardar(p.trabajoId, {
      fase: 'listo',
      mediaId,
      url: medio.url || url,
      propio: !!medio.url,
      errorSubida: medio.error || '',
    });
  }

  /**
   * Baja el archivo CON la sesión de la pestaña y lo sube a MaKo.
   *
   * La url que muestra Flow puede pedir las cookies de Google: el servidor de
   * MaKo no las tiene. La pestaña sí, así que los bytes salen de acá.
   */
  async function bajarYEntregar(p, url) {
    if (!url || !p.subida || !p.subida.url) return {};
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) throw new Error(`bajar ${r.status}`);
    const blob = await r.blob();
    if (blob.size < 1000) throw new Error('archivo vacío');
    // La misma forma que usa la app para subir a una url firmada de Storage.
    const tipo = blob.type || (p.tipo === 'video' ? 'video/mp4' : 'image/jpeg');
    const fd = new FormData();
    fd.append('cacheControl', '3600');
    fd.append('', new File([blob], p.subida.nombre || 'medio', { type: tipo }));
    const headers = { 'x-upsert': 'true' };
    if (p.subida.apikey) { headers.apikey = p.subida.apikey; headers.authorization = `Bearer ${p.subida.apikey}`; }
    const s = await fetch(p.subida.url, { method: 'PUT', headers, body: fd });
    if (!s.ok) throw new Error(`subir ${s.status}`);
    return { url: p.subida.publica || '' };
  }

  // ── Subir la foto ─────────────────────────────────────────────────────────

  function archivoDe(b64, nombre, tipo) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], nombre, { type: tipo || 'image/jpeg' });
  }

  /**
   * Sube la foto al proyecto por el menú real de Flow. El archivo se entrega al
   * `<input type=file>` que abre «Upload», sin abrir el diálogo del sistema.
   */
  async function subir(p) {
    const id = p.trabajoId;
    const nombre = `mako-${id}.${/png/i.test(p.mime || '') ? 'png' : 'jpg'}`;
    await guardar(id, { tipo: 'subida', fase: 'preparando', salio: false, desde: Date.now() });
    await prepararCompositor();
    const archivo = archivoDe(p.imagenB64, nombre, p.mime);

    let input = [...document.querySelectorAll('input[type="file"]')][0] || null;
    if (!input) {
      const menu = uno('button', R.menuMedios);
      if (!menu) throw falla('SIN_SUBIR', 'No encontré dónde subir la foto en Flow.');
      // El mundo de la página atrapa el `input.click()` que dispara «Upload» y le
      // entrega el archivo: lo instala el service worker antes de este mensaje.
      window.postMessage({ makoArchivo: { nombre, tipo: archivo.type, b64: p.imagenB64 } }, location.origin);
      clic(menu);
      const item = await esperarHasta(() => uno('menuitem', R.subir), 4000);
      if (!item) throw falla('SIN_SUBIR', 'Flow no mostró la opción de subir.');
      clic(item);
    } else {
      const dt = new DataTransfer();
      dt.items.add(archivo);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const listo = await esperarHasta(() => {
      const t = document.querySelector(`flow-grid-tile-container[aria-label="${nombre}"] [data-media-id]`);
      return t && t.getAttribute('data-media-id');
    }, TOPE_MS.subida, 1000);
    await cerrarCapas();
    if (!listo) return guardar(id, { fase: 'fallo', motivo: 'transitorio', error: 'Flow no terminó de procesar la foto.' });
    return guardar(id, { fase: 'listo', mediaId: listo });
  }

  // ── La sonda: lo que hace falta medir, en una sola llamada ────────────────

  function sonda() {
    const resumen = (el) => ({
      tag: el.tagName.toLowerCase(),
      nombre: nombreDe(el).slice(0, 80),
      rol: el.getAttribute('role') || '',
      attrs: [...el.attributes].map((a) => `${a.name}=${String(a.value).slice(0, 60)}`).slice(0, 8),
    });
    const botones = [...document.querySelectorAll(SELECTOR_ROL.button)].filter(visible).map(resumen).slice(0, 60);
    const radios = [...document.querySelectorAll(SELECTOR_ROL.radio)].filter(visible).map(resumen);
    const opciones = [...document.querySelectorAll(SELECTOR_ROL.option)].filter(visible).slice(0, 5)
      .map((o) => ({ ...resumen(o), html: o.outerHTML.slice(0, 600) }));
    const tiles = baldosas().slice(0, 6).map((b) => ({
      id: b.id, tipo: b.tipo, titulo: b.titulo.slice(0, 60), error: b.error, ocupado: b.ocupado,
      html: b.el.outerHTML.replace(/(Signature|Expires|KeyName)=[^"&]+/g, '$1=…').slice(0, 900),
    }));
    const videos = [...document.querySelectorAll('video')].map((v) => (v.currentSrc || v.src || '').replace(/\?.*$/, '?…'));
    return {
      version: VERSION,
      url: location.pathname,
      idioma: idioma(),
      oculta: document.visibilityState,
      estado: estado(),
      rotulos: Object.fromEntries(Object.entries(R).map(([k, v]) => [k, porRol(k === 'listaAssets' ? 'listbox' : k === 'pestanaTodo' ? 'tab' : 'button', v).length])),
      inputsArchivo: document.querySelectorAll('input[type="file"]').length,
      cajas: document.querySelectorAll('.ProseMirror').length,
      costo: costo(),
      botones, radios, opciones, tiles, videos,
    };
  }

  // ── El canal con el service worker ────────────────────────────────────────

  const SIN_REMEDIO = ['CARO', 'SIN_MODELO', 'SIN_OPCION', 'SIN_REFERENCIA', 'SIN_SUBIR'];

  async function correr(p) {
    if (ocupado) throw falla('OCUPADO', 'Flow está generando otra cosa de MaKo.');
    ocupado = p.trabajoId;
    try {
      return p.tipo === 'subida' ? await subir(p) : await generar(p);
    } catch (e) {
      const yaSalio = ((await chrome.storage.local.get(CLAVE(p.trabajoId)))[CLAVE(p.trabajoId)] || {}).salio === true;
      await cerrarCapas().catch(() => {});
      const codigo = (e && e.codigo) || 'INTERFAZ';
      return guardar(p.trabajoId, {
        fase: 'fallo',
        // Una falla antes del clic no gastó nada y se puede repetir; una después, no.
        salio: yaSalio,
        motivo: yaSalio ? 'permanente' : 'transitorio',
        // Repetir no cambia estas: la foto no va a aparecer sola en el proyecto, ni
        // Flow va a cobrar menos. Se dicen una vez y no se queman cinco intentos.
        noReintentar: SIN_REMEDIO.includes(codigo),
        codigo,
        error: String((e && e.message) || e).slice(0, 300),
      });
    } finally {
      ocupado = null;
    }
  }

  function alMensaje(msg, _s, responder) {
    if (msg?.tipo === 'INTERFAZ_ESTADO') { responder({ version: VERSION, ...estado() }); return false; }
    if (msg?.tipo === 'INTERFAZ_SONDA') { try { responder(sonda()); } catch (e) { responder({ error: String(e) }); } return false; }
    if (msg?.tipo === 'INTERFAZ_CORRER') {
      // Se contesta EN EL ACTO y se trabaja después: una generación tarda minutos
      // y el service worker no puede quedarse colgado de este canal. El resultado
      // viaja por storage.
      if (ocupado && ocupado !== msg.pedido?.trabajoId) { responder({ aceptado: false, ocupado }); return false; }
      responder({ aceptado: true });
      if (ocupado !== msg.pedido?.trabajoId) void correr(msg.pedido);
      return false;
    }
    return false;
  }

  chrome.runtime.onMessage.addListener(alMensaje);
  globalThis.__makoInterfaz = {
    version: VERSION,
    apagar: () => chrome.runtime.onMessage.removeListener(alMensaje),
  };
})();
