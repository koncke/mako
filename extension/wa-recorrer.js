// =============================================================================
// El grupo, RECORRIDO A LA VISTA en WhatsApp Web (26/10/2026, 0.72.0)
// =============================================================================
// Martín (26/10): «Quiero que el scraper, con la extensión me redirija a la tab de whatsapp y se vea que está interactuando o
// buscando, que se vea que entra al grupo y ve los contactos». Y no es sólo para que se vea. MEDIDO en su WhatsApp Web el
// 26/10 (el grupo de los 221, sólo cantidades): la lista de miembros dibuja el «~nombre» de 53 personas que en `model-storage`
// no tienen ninguno (ahí, 1 `pushname` de 247), 39 de ellas con el teléfono al lado. WhatsApp los tiene en memoria al abrir
// la lista y no los guarda: sólo se leen mirando (`nombresDeFilas`, wa-fichas-reglas.js).
// Lo que hace, con los clics que haría una persona: escribe el nombre del grupo en «Buscar un chat», abre el grupo
// (⚠️ ESO MARCA COMO LEÍDOS LOS MENSAJES DEL GRUPO, no los de cada persona), abre su información, «Ver todos», y baja la lista
// de miembros hasta el final leyendo cada fila. Al terminar cierra la lista y la información y borra la búsqueda. No escribe
// en ningún chat. Mientras tanto, arriba de WhatsApp, un cartel de MaKo dice qué está haciendo.
// Las piezas de la pantalla, en `pantallaWhatsapp()` (por `data-testid`, `role`, `aria-label` y el texto en español, inglés y
// portugués; nunca por las clases, que WhatsApp cambia en cada versión). El recorrido, en `recorrerGrupo`, que no sabe de la
// pantalla: lo prueba tests/wa-extraer-072.test.ts con una pantalla de mentira.
// Script clásico (los content scripts de MV3 no son módulos): en node exporta para los tests.

(function (raiz) {
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  /** Repite `fn` hasta que devuelva algo, con tope. null si no llegó. */
  async function esperar(fn, ms, cada) {
    const hasta = Date.now() + ms;
    let v = fn();
    while (!v && Date.now() < hasta) { await dormir(cada || 200); v = fn(); }
    return v || null;
  }

  /**
   * EL RECORRIDO. `p` es la pantalla (abajo, `pantallaWhatsapp`); `avisar(paso, datos)` cuenta cada paso; `parado()` lo corta
   * entre un paso y el siguiente. Devuelve las filas que vio (`{ titulo, secundario }`) y si encontró el grupo; nunca tira.
   */
  async function recorrerGrupo(nombre, p, avisar, parado, o) {
    const t = Object.assign({ espera: 8000, paso: 420, tope: 240000 }, o || {});
    const hasta = Date.now() + t.tope;
    const filas = new Map();
    const fin = (r) => { try { p.cerrar(); } catch { /* nada */ } return Object.assign({ filas: Array.from(filas.values()) }, r); };
    try {
      avisar('buscando', { texto: `Buscando «${nombre}»…` });
      if (!(await p.escribirBusqueda(nombre))) return fin({ ok: false, encontrado: false, motivo: 'sin_busqueda' });
      const fila = await esperar(() => p.filaDelGrupo(nombre), t.espera);
      if (!fila) return fin({ ok: false, encontrado: false, motivo: 'no_encontrado' });
      if (parado()) return fin({ ok: false, encontrado: true, motivo: 'parado' });

      avisar('entrando', { texto: `Entrando a «${nombre}»…` });
      p.abrir(fila);
      if (!(await esperar(() => p.grupoAbierto(nombre), t.espera))) return fin({ ok: false, encontrado: true, motivo: 'no_abrio' });
      await dormir(t.paso);
      p.abrirInfo();
      const info = await esperar(() => p.info(), t.espera);
      if (!info) return fin({ ok: false, encontrado: true, motivo: 'sin_info' });
      const total = p.miembros(info);
      avisar('miembros', { texto: total ? `Abriendo los ${total} miembros…` : 'Abriendo los miembros…', total });

      // Con más de diez, la información muestra unos pocos y un «Ver todos»; con menos, están todos ahí mismo.
      const verTodos = p.verTodos(info);
      if (verTodos) p.abrir(verTodos);
      const lista = await esperar(() => p.lista(!!verTodos, info), t.espera);
      if (!lista) return fin({ ok: false, encontrado: true, motivo: 'sin_lista', total });

      // BAJA DE A MEDIA PANTALLA: la lista es virtual (sólo dibuja lo que se ve) y tarda en dibujar. Medido el 26/10: de a
      // 500 px cada 250 ms se veían 98 de 247; de a 250 px cada 300 ms, 234.
      const leer = () => { for (const f of p.filasVisibles(lista)) if (f && f.titulo) filas.set(`${f.titulo}|${f.secundario || ''}`, f); };
      const conNombre = () => { let n = 0; for (const f of filas.values()) if (/^~/.test(f.titulo) || /^~/.test(f.secundario || '')) n++; return n; };
      leer();
      avisar('recorriendo', { vistos: filas.size, total, conNombre: conNombre() });
      let quietas = 0;
      while (Date.now() < hasta) {
        if (parado()) return fin({ ok: false, encontrado: true, motivo: 'parado', total });
        const antes = p.posicion(lista);
        p.bajar(lista);
        await dormir(t.paso);
        leer();
        avisar('recorriendo', { vistos: filas.size, total, conNombre: conNombre() });
        if (p.alFinal(lista)) { await dormir(t.paso); leer(); break; }
        // Sin moverse dos veces seguidas: no hay más para bajar (o la persona la está sosteniendo).
        quietas = p.posicion(lista) === antes ? quietas + 1 : 0;
        if (quietas >= 2) break;
      }
      avisar('recorriendo', { vistos: filas.size, total, conNombre: conNombre() });
      return fin({ ok: true, encontrado: true, total });
    } catch (e) {
      return fin({ ok: false, encontrado: false, motivo: 'error', error: String((e && e.message) || e) });
    }
  }


  // ── LOS PERFILES, de a uno (0.73.0) ────────────────────────────────────────────────────────────────────────────────────
  // Martín, 26/10/2026: «podría entrar a cada perfil y fijarse si tiene links, redes sociales, email, etc...». Para cada
  // teléfono que MaKo pidió (sólo esos: la agenda de Martín es suya), busca a la persona en la lista de miembros, abre su
  // información, lee lo que se ve (textos y links; `perfilDeInfo` lo clasifica) y vuelve. De a uno, con una pausa de persona
  // entre cada uno (1,2 a 2,6 s), y con tope por corrida: a WhatsApp no le gusta que alguien abra cien perfiles en un minuto.
  // `diag` dice qué paso falló, y la FORMA del primer panel abierto (sin datos de nadie), para ajustar los selectores.
  async function leerPerfiles(nombreGrupo, candidatos, p, avisar, parado, o) {
    const t = Object.assign({ tope: 60, espera: 5000, pausaMin: 1200, pausaMax: 2600 }, o || {});
    const lista = (Array.isArray(candidatos) ? candidatos : []).filter((c) => c && String(c.telefono || '').replace(/\D/g, '').length >= 8).slice(0, t.tope);
    const perfiles = [];
    const diag = { intentados: 0, abiertos: 0, conDatos: 0, fallos: {}, forma: null, menu: null, busqueda: null };
    const fallo = (m) => { diag.fallos[m] = (diag.fallos[m] || 0) + 1; };
    for (let i = 0; i < lista.length; i++) {
      if (parado()) break;
      const c = lista[i];
      diag.intentados++;
      avisar('perfiles', { texto: `Leyendo el perfil de ${c.nombre || `+${String(c.telefono).replace(/\D/g, '')}`}…`, hechos: i, total: lista.length });
      try {
        const r = await p.abrirPerfil(nombreGrupo, c.telefono, t.espera);
        if (r.busqueda && !diag.busqueda) diag.busqueda = r.busqueda;
        if (r.menu && !diag.menu) diag.menu = r.menu;
        if (!r.ok) { fallo(r.motivo || 'no_abrio'); await p.volverDelPerfil(); continue; }
        diag.abiertos++;
        if (!diag.forma) diag.forma = p.forma(r.info);
        const perfil = raiz.MakoWaFichas.perfilDeInfo(p.leerPerfil(r.info));
        if (perfil) { perfiles.push({ telefono: String(c.telefono).replace(/\D/g, ''), perfil }); diag.conDatos++; }
        await p.volverDelPerfil();
      } catch (e) {
        fallo('error');
      }
      await dormir(t.pausaMin + Math.round(Math.random() * (t.pausaMax - t.pausaMin)));
    }
    avisar('perfiles', { texto: `Leí ${diag.abiertos} perfiles`, hechos: lista.length, total: lista.length });
    try { p.cerrar(); } catch { /* nada */ }
    return { perfiles, diag };
  }

  // ── La pantalla de WhatsApp Web ──────────────────────────────────────────────────────────────────────────────────────
  // ⚠️ MEDIDO el 26/10/2026 en el WhatsApp Web (Business) de Martín, en español: la búsqueda es un `input[data-tab="3"]`; la
  // fila de un chat, `[role="row"]` con `[data-testid="cell-frame-title"] span[title]`; el grupo abre con pointerdown/mousedown/
  // pointerup/mouseup/click sobre `[data-testid="cell-frame-container"]`; la info es `[role="complementary"]` con «N miembros»
  // y «Ver todos (N más)»; la lista completa, un `[role="dialog"]` con UN elemento que scrollea y filas de 72 px.
  function pantallaWhatsapp(doc) {
    const d = doc || document;
    const VER_TODOS = /^(ver todos|ver todas|view all|see all|ver tudo|mostrar todos)/i;
    const MIEMBROS = /(\d[\d.,]*)\s*(miembros|members|membros|participantes|participants)/i;
    const CERRAR = /^(cerrar|close|fechar)$/i;
    const BUSCAR = /buscar|search|pesquis/i;

    const VER_PERFIL = /^(ver|view|info|informaci[oó]n|dados)\b/i;
    const INFO_CONTACTO = /info\.? (del contacto|de (la )?empresa|comercial)|contact info|business info|dados (do contato|comerciais)/i;
    // Las palabras de la interfaz que se dejan ver en la forma del panel (todo lo demás, tapado: puede ser de una persona).
    const UI = new Set('info info. del de la contacto empresa grupo grupos en común comun archivos enlaces y documentos mensajes destacados silenciar notificaciones temporales cifrado cifrados bloquear reportar añadir favoritos eliminar ver todo todos más mas llamar video buscar atrás atras cerrar correo electrónico sitio web dirección direccion categoría categoria horario catálogo catalogo descripción descripcion sobre mí mi negocio cuenta de empresa enviar mensaje a editar perfil foto compartir contactos contacto info. business account contact profile about email website address category'.split(' '));
    const enmascararTexto = (s) => String(s || '').slice(0, 80).split(/\s+/).map((w) => (UI.has(w.toLowerCase()) ? w : w.replace(/[\p{L}]/gu, 'a').replace(/\d/g, '#'))).join(' ');
    const enmascarar = (el) => enmascararTexto((el.textContent || '').trim());
    const dialogoMiembros = () => Array.from(d.querySelectorAll('[role="dialog"]')).find((x) => x.querySelector('[data-testid="cell-frame-title"]')) || null;
    /** La fila de la lista cuyo teléfono (en cualquiera de sus dos renglones) termina como el pedido. */
    const filaConTelefono = (dlg, dig) => {
      const fin = dig.slice(-8);
      const filas = Array.from(dlg.querySelectorAll('[data-testid="cell-frame-container"]'));
      const conTel = filas.find((c) => (c.textContent || '').replace(/\D/g, '').endsWith(fin) || (c.textContent || '').replace(/\D/g, '').includes(fin));
      return conTel || (filas.length === 1 ? filas[0] : null);
    };
    const opcionesDeMenu = () => Array.from(d.querySelectorAll('[role="application"] [role="button"], [role="menu"] [role="menuitem"], [role="menu"] li, ul[role="listbox"] li, div[data-animate-dropdown-item] , li[role="button"]'))
      .filter((x) => (x.textContent || '').trim()).slice(0, 12);
    const panelDeContacto = () => Array.from(d.querySelectorAll('[role="complementary"], section')).find((e) => INFO_CONTACTO.test(e.getAttribute('aria-label') || '') || INFO_CONTACTO.test((e.textContent || '').slice(0, 300))) || null;
    const clic = (el) => {
      const o = { bubbles: true, cancelable: true, view: window, button: 0 };
      for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
        el.dispatchEvent(t.startsWith('pointer') && typeof PointerEvent === 'function' ? new PointerEvent(t, o) : new MouseEvent(t, o));
      }
    };
    const lado = () => d.querySelector('#side') || d;
    const caja = () => {
      const s = lado();
      return s.querySelector('input[data-tab="3"]') || s.querySelector('[contenteditable="true"][data-tab="3"]')
        || Array.from(s.querySelectorAll('input, [contenteditable="true"]')).find((e) => BUSCAR.test(e.getAttribute('aria-label') || e.getAttribute('placeholder') || '')) || null;
    };
    const tituloDe = (fila) => {
      const t = fila.querySelector('[data-testid="cell-frame-title"] span[title]') || fila.querySelector('span[title]');
      return t ? t.getAttribute('title') || t.textContent || '' : '';
    };
    const iguales = (a, b) => raiz.MakoWaFichas.asuntoComparable(a) === raiz.MakoWaFichas.asuntoComparable(b);
    const scrolleable = (el) => Array.from(el.querySelectorAll('*')).find((e) => e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY)) || null;
    const botonPorTexto = (el, re) => Array.from(el.querySelectorAll('[role="button"], button')).find((b) => re.test((b.textContent || '').trim())) || null;
    const botonPorNombre = (el, re) => Array.from(el.querySelectorAll('[aria-label]')).find((b) => re.test((b.getAttribute('aria-label') || '').trim())) || null;

    // EL CARTEL DE MaKo arriba de WhatsApp: dice qué hace y pide no tocar. No recibe clics (no tapa nada) y vive en su sombra.
    let cartel = null;
    const decir = (texto) => {
      try {
        if (!cartel) {
          const host = d.createElement('div');
          host.setAttribute('data-mako-cartel', '');
          host.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483647;pointer-events:none';
          const sombra = host.attachShadow({ mode: 'closed' });
          sombra.innerHTML = '<style>.c{display:flex;align-items:center;gap:10px;padding:10px 16px 10px 12px;border-radius:999px;'
            + 'background:#16181d;color:#fff;font:600 13.5px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.28)}'
            + '.p{width:9px;height:9px;border-radius:50%;background:#2f6df6;box-shadow:0 0 0 0 rgba(47,109,246,.7);animation:l 1.2s infinite}'
            + '@keyframes l{0%{box-shadow:0 0 0 0 rgba(47,109,246,.7)}70%{box-shadow:0 0 0 9px rgba(47,109,246,0)}100%{box-shadow:0 0 0 0 rgba(47,109,246,0)}}'
            + '.m{opacity:.62;font-weight:500}@media (prefers-reduced-motion:reduce){.p{animation:none}}</style>'
            + '<div class="c"><span class="p"></span><span class="m">MaKo</span><span class="t"></span></div>';
          (d.body || d.documentElement).appendChild(host);
          cartel = { host, t: sombra.querySelector('.t') };
        }
        cartel.t.textContent = texto;
      } catch { /* sin cartel, sigue igual */ }
    };

    return {
      decir,
      sacarCartel(ms) { const c = cartel; cartel = null; if (c) setTimeout(() => c.host.remove(), ms || 0); },
      async escribirBusqueda(texto) {
        let c = caja();
        if (!c) {
          // Otra columna abierta a la izquierda (Estados, Ajustes): primero «Chats».
          const chats = botonPorNombre(d, /^chats$/i);
          if (chats) { clic(chats); c = await esperar(caja, 3000); }
        }
        if (!c) return false;
        c.focus();
        if (c.tagName === 'INPUT') c.select(); else d.execCommand('selectAll', false);
        d.execCommand('delete', false);
        // Letra por letra, como quien escribe: se ve que busca.
        for (const ch of Array.from(texto)) { d.execCommand('insertText', false, ch); await dormir(28); }
        return true;
      },
      filaDelGrupo(nombre) {
        for (const f of lado().querySelectorAll('[role="row"], [role="listitem"]')) if (iguales(tituloDe(f), nombre)) return f;
        return null;
      },
      abrir(el) { clic(el.querySelector('[data-testid="cell-frame-container"]') || el); },
      grupoAbierto(nombre) {
        const h = d.querySelector('#main header');
        return !!h && Array.from(h.querySelectorAll('span[title], span[dir="auto"]')).some((t) => iguales(t.getAttribute('title') || t.textContent || '', nombre));
      },
      abrirInfo() {
        const h = d.querySelector('#main header');
        const b = h && (botonPorNombre(h, /perfil|profile|info/i) || h.querySelector('[role="button"]'));
        if (b) clic(b);
      },
      info() {
        // Sólo el panel de la derecha: un mensaje del chat que diga «247 miembros» no es la información del grupo.
        return Array.from(d.querySelectorAll('[role="complementary"]')).find((e) => MIEMBROS.test(e.textContent || '')) || null;
      },
      miembros(info) {
        const m = MIEMBROS.exec(info.textContent || '');
        return m ? Number(m[1].replace(/\D/g, '')) || null : null;
      },
      verTodos(info) { return botonPorTexto(info, VER_TODOS); },
      lista(conDialogo, info) {
        const caja = conDialogo ? Array.from(d.querySelectorAll('[role="dialog"]')).find((x) => x.querySelector('[data-testid="cell-frame-title"]')) : info;
        if (!caja) return null;
        return { caja, sc: scrolleable(caja) || caja };
      },
      filasVisibles(l) {
        return Array.from(l.caja.querySelectorAll('[data-testid="cell-frame-container"]')).map((c) => ({
          titulo: ((c.querySelector('[data-testid="cell-frame-title"]') || {}).textContent || '').trim(),
          secundario: ((c.querySelector('[data-testid="cell-frame-secondary"]') || {}).textContent || '').trim(),
        }));
      },
      posicion(l) { return l.sc.scrollTop; },
      bajar(l) {
        const paso = Math.max(150, Math.round(l.sc.clientHeight * 0.45));
        try { l.sc.scrollBy({ top: paso, behavior: 'smooth' }); } catch { l.sc.scrollTop += paso; }
      },
      alFinal(l) { return l.sc.scrollTop + l.sc.clientHeight >= l.sc.scrollHeight - 4; },
      // ⚠️ LO DEL PERFIL, NO MEDIDO TODAVÍA (0.73.0): la lista de miembros se abre igual que en el recorrido (medido); de ahí,
      // escribir el teléfono en su buscador, tocar la fila, y en el menú que abre, «Ver»/«Info». `diag` dice qué paso falla.
      async abrirPerfil(nombreGrupo, telefono, espera) {
        const dig = String(telefono || '').replace(/\D/g, '');
        if (!this.grupoAbierto(nombreGrupo)) return { ok: false, motivo: 'sin_grupo' };
        let dlg = dialogoMiembros();
        if (!dlg) {
          let inf = this.info();
          if (!inf) { this.abrirInfo(); inf = await esperar(() => this.info(), espera); }
          if (!inf) return { ok: false, motivo: 'sin_info' };
          const ver = this.verTodos(inf);
          if (ver) { this.abrir(ver); dlg = await esperar(dialogoMiembros, espera); }
          if (!dlg) return { ok: false, motivo: 'sin_lista' };
        }
        const caja = dlg.querySelector('input, [contenteditable="true"]');
        if (!caja) return { ok: false, motivo: 'sin_buscador' };
        // El número como lo escribiría una persona; si no aparece, sin el + y después los últimos 10.
        let fila = null;
        let busqueda = null;
        for (const variante of [`+${dig}`, dig, dig.slice(-10)]) {
          caja.focus();
          if (caja.tagName === 'INPUT') caja.select(); else d.execCommand('selectAll', false);
          d.execCommand('delete', false);
          d.execCommand('insertText', false, variante);
          fila = await esperar(() => filaConTelefono(dlg, dig), 2500, 250);
          if (fila) { busqueda = variante === dig ? 'digitos' : variante.startsWith('+') ? 'con_mas' : 'ultimos_10'; break; }
        }
        if (!fila) return { ok: false, motivo: 'sin_fila', busqueda: 'ninguna' };
        this.abrir(fila);
        await dormir(500);
        // Un menú («Mensaje a…», «Ver…»), o directamente el panel del contacto.
        let panel = panelDeContacto();
        let menu = null;
        if (!panel) {
          const opciones = opcionesDeMenu();
          menu = opciones.map(enmascarar).slice(0, 8);
          const ver = opciones.find((x) => VER_PERFIL.test((x.textContent || '').trim()));
          if (!ver) return { ok: false, motivo: opciones.length ? 'sin_ver' : 'sin_menu', busqueda, menu };
          clic(ver);
          panel = await esperar(panelDeContacto, espera);
        }
        if (!panel) return { ok: false, motivo: 'sin_panel', busqueda, menu };
        return { ok: true, info: panel, busqueda, menu };
      },
      leerPerfil(panel) {
        const textos = String(panel.innerText || panel.textContent || '').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 200);
        const links = Array.from(panel.querySelectorAll('a[href]')).map((a) => a.getAttribute('href') || '').filter(Boolean).slice(0, 50);
        return { textos, links };
      },
      async volverDelPerfil() {
        const panel = panelDeContacto();
        const b = panel && (botonPorNombre(panel, /^(atr[aá]s|back|voltar)$/i) || botonPorNombre(panel, CERRAR));
        if (b) clic(b);
        else d.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
        await dormir(450);
      },
      // La FORMA del panel, sin datos de nadie: cada renglón con sus letras tapadas salvo las palabras de la interfaz, los
      // botones igual, y los DOMINIOS de los links (instagram.com no es de nadie).
      forma(panel) {
        const lineas = String(panel.innerText || '').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 40).map(enmascararTexto);
        const botones = Array.from(panel.querySelectorAll('[aria-label]')).map((b) => enmascararTexto(b.getAttribute('aria-label') || '')).slice(0, 30);
        const dominios = Array.from(new Set(Array.from(panel.querySelectorAll('a[href]')).map((a) => { try { return new URL(a.href).hostname; } catch { return '?'; } }))).slice(0, 20);
        return { rol: panel.getAttribute('role'), aria: enmascararTexto(panel.getAttribute('aria-label') || ''), lineas, botones, dominios };
      },
      // Deja WhatsApp como estaba: cierra la lista y la información, y borra la búsqueda. El grupo queda abierto.
      cerrar() {
        const dlg = Array.from(d.querySelectorAll('[role="dialog"]')).find((x) => x.querySelector('[data-testid="cell-frame-title"]'));
        const x1 = dlg && botonPorNombre(dlg, CERRAR);
        if (x1) clic(x1);
        setTimeout(() => {
          const inf = Array.from(d.querySelectorAll('[role="complementary"]')).find((e) => MIEMBROS.test(e.textContent || ''));
          const x2 = inf && botonPorNombre(inf, CERRAR);
          if (x2) clic(x2);
          const c = caja();
          if (c && (c.value || c.textContent)) { c.focus(); if (c.tagName === 'INPUT') c.select(); else d.execCommand('selectAll', false); d.execCommand('delete', false); c.blur(); }
        }, 500);
      },
    };
  }

  /**
   * ¿EN QUÉ ESTÁ WHATSAPP WEB? 'lista' (con la columna de chats), 'qr' (pide escanear el código para vincular), 'cargando' (ni
   * una ni otra: sincronizando) o null si no se pudo mirar. Martín, 26/10/2026: «si el usuario no escaneó el QR, que la
   * extensión le diga y se quede esperando unos minutos». Lo mismo que el desplegable ya hace con Google Flow («Inicia sesión
   * en Google Flow»). Por la PANTALLA y no por la base: con la sesión cerrada, `model-storage` puede seguir ahí.
   * ⚠️ No medido en vivo (la sesión de Martín está abierta y cerrarla no se hace): la pantalla del QR se reconoce por su
   * lienzo, su `data-ref` o su texto en español, inglés y portugués.
   */
  function estadoDeSesion(doc) {
    try {
      if (!doc || typeof doc.querySelector !== 'function') return null;
      if (doc.querySelector('#side, #pane-side')) return 'lista';
      if (doc.querySelector('canvas[aria-label], [data-ref] canvas, [data-testid="qrcode"], div[data-ref]')) return 'qr';
      const texto = String((doc.body && (doc.body.innerText || doc.body.textContent)) || '').slice(0, 4000);
      if (/c[oó]digo QR|QR code|c[oó]digo de vinculaci[oó]n|vincular (un )?dispositivo|link (a |with )?device|log ?in with phone|iniciar sesi[oó]n con (tu |el )?n[uú]mero|escane(a|ie) o c[oó]digo/i.test(texto)) return 'qr';
      return 'cargando';
    } catch { return null; }
  }

  const api = { recorrerGrupo, leerPerfiles, pantallaWhatsapp, esperar, estadoDeSesion };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  if (raiz.__makoWaRecorrer) return;
  raiz.__makoWaRecorrer = true;
  // El ping de wa-fichas.js lo pregunta (ese archivo no toca la pantalla: lo que mira la pantalla vive acá).
  raiz.__makoWaSesion = () => estadoDeSesion(document);


  // El worker pide el recorrido (`WA_RECORRER`, con el nombre del grupo) y puede pedir que pare (`WA_RECORRER_PARAR`). Cada
  // paso vuelve como `WA_RECORRER_AVANCE` con el mismo `id`.
  const parados = new Set();
  let enCurso = null;
  chrome.runtime.onMessage.addListener((msg, _s, responder) => {
    if (msg && msg.tipo === 'WA_RECORRER_PARAR') { parados.add(msg.id); return false; }
    // LOS PERFILES (0.73.0): los candidatos los elige el worker (los teléfonos que MaKo pidió, empresas primero).
    if (msg && msg.tipo === 'WA_PERFILES' && typeof msg.grupo === 'string') {
      if (enCurso) { responder({ ok: false, motivo: 'ocupado', perfiles: [], diag: null }); return false; }
      const id = msg.id;
      const p = pantallaWhatsapp(document);
      const avisar = (paso, datos) => {
        const n = datos || {};
        p.decir(`${n.texto || 'Leyendo perfiles…'} · no toques nada`);
        try { chrome.runtime.sendMessage(Object.assign({ tipo: 'WA_RECORRER_AVANCE', id, paso }, n), () => void chrome.runtime.lastError); } catch { /* nada */ }
      };
      const tope = Math.max(0, Math.min(Number(msg.tope) || 60, 200));
      enCurso = leerPerfiles(msg.grupo.slice(0, 120), Array.isArray(msg.candidatos) ? msg.candidatos.slice(0, 500) : [], p, avisar, () => parados.has(id), { tope })
        .then((r) => { p.decir('Listo'); p.sacarCartel(1600); responder({ ok: true, ...r }); })
        .catch((e) => responder({ ok: false, motivo: 'error', error: String((e && e.message) || e), perfiles: [], diag: null }))
        .finally(() => { enCurso = null; });
      return true;
    }
    if (!msg || msg.tipo !== 'WA_RECORRER' || typeof msg.grupo !== 'string') return false;
    if (enCurso) { responder({ ok: false, motivo: 'ocupado', filas: [] }); return false; }
    const id = msg.id;
    const p = pantallaWhatsapp(document);
    const avisar = (paso, datos) => {
      const n = datos || {};
      p.decir(paso === 'recorriendo'
        ? `Leyendo los miembros${n.total ? `: ${Math.min(n.vistos, n.total)} de ${n.total}` : `: ${n.vistos}`} · no toques nada`
        : `${n.texto || 'Trabajando…'} · no toques nada`);
      try { chrome.runtime.sendMessage(Object.assign({ tipo: 'WA_RECORRER_AVANCE', id, paso }, n), () => void chrome.runtime.lastError); } catch { /* nada */ }
    };
    enCurso = recorrerGrupo(msg.grupo.slice(0, 120), p, avisar, () => parados.has(id))
      .then((r) => { p.decir(r.ok ? 'Listo' : 'Terminé'); p.sacarCartel(1600); responder(r); })
      .finally(() => { enCurso = null; parados.delete(id); });
    return true;
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
