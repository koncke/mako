// Puente entre el service worker y la PÁGINA de Flow.
//
// El grecaptcha vive en el `window` de la página, y un content script corre en
// un mundo aislado que no lo ve. Por eso se inyecta `injected.js` en el mundo
// principal y se habla con él por CustomEvent: es la única forma de pedirle un
// token al widget que la página ya tiene cargado.

const s = document.createElement('script');
s.src = chrome.runtime.getURL('injected.js');
(document.head || document.documentElement).appendChild(s);
s.remove();

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
