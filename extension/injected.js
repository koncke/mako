// Corre en el mundo de la PÁGINA, donde existe `window.grecaptcha`.
//
// Lo único que hace es pedirle un token al widget que labs.google ya cargó, con
// la misma site key y el mismo método que usa el botón de generar. No resuelve
// ningún desafío: reCAPTCHA v3 Enterprise no plantea uno — emite un score que
// calcula Google mirando la sesión. Si el comportamiento parece automatizado,
// Google devuelve 403 y hay que bajar el ritmo, que es lo correcto.

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

  window.addEventListener('MAKO_CAPTCHA_PIDO', async (ev) => {
    const { id, action, siteKey } = ev.detail || {};
    const responder = (detail) =>
      window.dispatchEvent(new CustomEvent('MAKO_CAPTCHA_OK', { detail: { id, ...detail } }));
    try {
      const g = await esperarGrecaptcha(10000);
      if (!g) return responder({ error: 'SIN_GRECAPTCHA' });
      responder({ token: await g.execute(siteKey, { action: action || 'generate' }) });
    } catch (e) {
      responder({ error: String(e?.message || e) });
    }
  });
})();
