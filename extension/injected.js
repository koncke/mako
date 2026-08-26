// Corre en el mundo de la PÁGINA de Flow (declarado con `world: MAIN` en el
// manifest), que es donde existen `window.grecaptcha` y el contexto real del sitio.
//
// Hace dos cosas, y la segunda es la que hace que todo esto funcione:
//
//   1. Pide el token de reCAPTCHA al widget que labs.google ya tiene cargado.
//   2. **Hace el pedido a la API de Flow desde acá.**
//
// ── Por qué el fetch sale de la PÁGINA y no del service worker ──────────────
// Al principio lo hacía el service worker, y Google contestaba su página de
// bloqueo («Sorry… unusual traffic») mientras la misma persona, en la misma
// pestaña y con la misma cuenta, generaba videos a mano sin problema. La sesión
// no estaba bloqueada: lo que Google rechazaba era ESE pedido.
//
// Un `fetch` desde un service worker de extensión viaja con
// `Origin: chrome-extension://<id>`, sin las cookies del sitio y sin los headers
// que la app real manda. Para Google es un pedido de un tercero que dice tener un
// bearer de Flow — que es exactamente la forma de un token robado.
//
// Hecho desde acá **es** un pedido de la página: mismo origin, mismas cookies,
// misma sesión. No hay nada que disimular porque no hay nada distinto, y eso es
// justamente lo que nos permite no replicar la telemetría falsa de useapi: ellos
// tienen que fingir el contexto porque piden desde afuera.

(function () {
  async function esperarGrecaptcha(ms) {
    const hasta = Date.now() + ms;
    while (Date.now() < hasta) {
      const g = window.grecaptcha;
      if (g?.enterprise?.execute) return g.enterprise;
      await new Promise((r) => setTimeout(r, 200));
    }
    return null;
  }

  const responder = (evento, id, detail) =>
    window.dispatchEvent(new CustomEvent(evento, { detail: { id, ...detail } }));

  window.addEventListener('MAKO_CAPTCHA_PIDO', async (ev) => {
    const { id, action, siteKey } = ev.detail || {};
    try {
      const g = await esperarGrecaptcha(10000);
      if (!g) return responder('MAKO_CAPTCHA_OK', id, { error: 'SIN_GRECAPTCHA' });
      responder('MAKO_CAPTCHA_OK', id, { token: await g.execute(siteKey, { action: action || 'generate' }) });
    } catch (e) {
      responder('MAKO_CAPTCHA_OK', id, { error: String(e?.message || e) });
    }
  });

  window.addEventListener('MAKO_FETCH_PIDO', async (ev) => {
    const { id, url, cuerpo, bearer } = ev.detail || {};
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer}` },
        // La página ya está autenticada: las cookies viajan porque el pedido sale
        // del mismo origen que las puso.
        credentials: 'include',
        body: JSON.stringify(cuerpo),
      });
      // El texto crudo viaja tal cual: si Google contesta HTML en vez de JSON, eso
      // ES el dato — es lo que delata un bloqueo, y parsearlo acá lo perdería.
      responder('MAKO_FETCH_OK', id, { status: res.status, texto: (await res.text()).slice(0, 20000) });
    } catch (e) {
      responder('MAKO_FETCH_OK', id, { error: String(e?.message || e) });
    }
  });
})();
