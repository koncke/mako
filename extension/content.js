// Puente entre el service worker y la PÁGINA de Flow.
//
// El grecaptcha vive en el `window` de la página, y este script corre en un
// mundo aislado que no lo ve. El que sí lo ve es `injected.js`, declarado en el
// manifest con `world: MAIN`; acá solo se habla con él por CustomEvent.
//
// ⚠️ Antes `injected.js` se metía creando un <script src="chrome-extension://…">
// en el DOM. **La CSP de labs.google lo bloquea**, y falla de la peor manera: sin
// error visible acá, sin nadie escuchando del otro lado, y con el síntoma
// apareciendo 25 s más tarde como un CAPTCHA_TIMEOUT — que hace buscar el
// problema en el captcha cuando estaba en la inyección. La pista que lo delata es
// que el error sea el timeout del content script y NO `SIN_GRECAPTCHA`: si el
// script del mundo principal estuviera vivo, contestaría algo a los 10 s.

chrome.runtime.onMessage.addListener((msg, _sender, responder) => {
  if (msg?.tipo !== 'GET_CAPTCHA') return false;

  const id = `c${Date.now()}${Math.random()}`;
  const alRecibir = (ev) => {
    if (ev.detail?.id !== id) return;
    window.removeEventListener('MAKO_CAPTCHA_OK', alRecibir);
    responder({ token: ev.detail.token, error: ev.detail.error });
  };
  window.addEventListener('MAKO_CAPTCHA_OK', alRecibir);
  window.dispatchEvent(new CustomEvent('MAKO_CAPTCHA_PIDO', {
    detail: { id, action: msg.action, siteKey: msg.siteKey },
  }));

  // Sin este corte, un grecaptcha que nunca contesta deja el trabajo tomado y
  // la cola bloqueada hasta que el rescate de 10 minutos lo suelte.
  setTimeout(() => {
    window.removeEventListener('MAKO_CAPTCHA_OK', alRecibir);
    responder({ error: 'CAPTCHA_TIMEOUT' });
  }, 25000);

  return true; // respuesta asíncrona
});
