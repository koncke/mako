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

  const api = { recorrerGrupo, pantallaWhatsapp, esperar, estadoDeSesion };
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
