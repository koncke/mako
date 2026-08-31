// Puente entre el service worker y la PÁGINA de Flow.
//
// Este script corre en un mundo aislado: ve el DOM pero no el `window` de la
// página. El que sí lo ve es `injected.js`, declarado en el manifest con
// `world: MAIN`. Acá solo se traduce entre los dos canales:
//
//   service worker  ──chrome.runtime.sendMessage──▶  este script
//   este script     ──CustomEvent──▶  injected.js (mundo de la página)
//
// ⚠️ Antes `injected.js` se metía creando un <script src="chrome-extension://…">
// en el DOM. **La CSP de labs.google lo bloquea**, y falla de la peor manera: sin
// error visible acá, sin nadie escuchando del otro lado, y con el síntoma
// apareciendo 25 s más tarde como un CAPTCHA_TIMEOUT — que hace buscar el
// problema en el captcha cuando estaba en la inyección. La pista que lo delata es
// que el error sea el timeout de este script y NO `SIN_GRECAPTCHA`: si el script
// del mundo principal estuviera vivo, contestaría algo a los 10 s.

/**
 * Manda un pedido al mundo de la página y espera SU respuesta.
 *
 * El `id` no es decorativo: los eventos son globales, así que sin él dos pedidos
 * en vuelo se resuelven con la respuesta del otro. Y el timeout tampoco — sin
 * cortar, un `injected.js` que no contesta deja el trabajo tomado y la cola
 * bloqueada hasta que el rescate de 10 minutos lo suelte.
 */
function pedirALaPagina(evPido, evOk, detalle, ms, errorTimeout, responder) {
  const id = `m${Date.now()}${Math.random()}`;
  let cerrado = false;

  const alRecibir = (ev) => {
    if (ev.detail?.id !== id || cerrado) return;
    cerrado = true;
    window.removeEventListener(evOk, alRecibir);
    clearTimeout(reloj);
    responder(ev.detail);
  };

  const reloj = setTimeout(() => {
    if (cerrado) return;
    cerrado = true;
    window.removeEventListener(evOk, alRecibir);
    responder({ error: errorTimeout });
  }, ms);

  window.addEventListener(evOk, alRecibir);
  window.dispatchEvent(new CustomEvent(evPido, { detail: { id, ...detalle } }));
}

chrome.runtime.onMessage.addListener((msg, _sender, responder) => {
  // La UNICA forma de distinguir «no hay content script en esta pestana» de «lo
  // hay y esta ocupado». Sin esto, las dos se ven igual desde el service worker:
  // un `sendMessage` que rechaza. Y no cuesta un viaje a la pagina.
  if (msg?.tipo === 'PING') { responder({ ok: true }); return false; }

  if (msg?.tipo === 'GET_CAPTCHA') {
    pedirALaPagina(
      'MAKO_CAPTCHA_PIDO', 'MAKO_CAPTCHA_OK',
      { action: msg.action, siteKey: msg.siteKey, medida: msg.medida }, 25000, 'CAPTCHA_TIMEOUT',
      (d) => responder({ token: d.token, error: d.error, siteKeyUsado: d.siteKeyUsado, accionUsada: d.accionUsada, accionesDeFlow: d.accionesDeFlow }),
    );
    return true; // respuesta asíncrona
  }

  if (msg?.tipo === 'HACER_FETCH') {
    // Los pedidos de Flow son asíncronos (devuelven un id de operación, no el
    // video), así que 60 s es holgado. Lo que no puede pasar es quedarse esperando
    // para siempre.
    pedirALaPagina(
      'MAKO_FETCH_PIDO', 'MAKO_FETCH_OK',
      { clase: msg.clase, path: msg.path, cuerpo: msg.cuerpo, parches: msg.parches, soloLectura: msg.soloLectura, bearer: msg.bearer, respaldo: msg.respaldo },
      60000, 'FETCH_TIMEOUT',
      (d) => responder(d),
    );
    return true;
  }

  if (msg?.tipo === 'GUARDAR_PLANTILLAS') {
    // Las plantillas enteras, para que sobrevivan al próximo F5.
    pedirALaPagina('MAKO_GUARDAR_PIDO', 'MAKO_GUARDAR_OK', {}, 5000, 'GUARDAR_TIMEOUT',
      (d) => responder(d));
    return true;
  }

  if (msg?.tipo === 'SONDA_MEDIO') {
    // Cual variante de la url trae el video. Tarda: 12 s por candidato.
    pedirALaPagina('MAKO_SONDA_PIDO', 'MAKO_SONDA_OK',
      { mediaId: msg.mediaId, variantes: msg.variantes }, 20000, 'SONDA_TIMEOUT',
      (d) => responder(d));
    return true;
  }

  if (msg?.tipo === 'VER_RESPUESTAS') {
    // Lo que Flow YA recibio. Canal propio: el del espia tiene tope y se llena.
    pedirALaPagina('MAKO_RESPUESTAS_PIDO', 'MAKO_RESPUESTAS_OK', {}, 5000, 'RESPUESTAS_TIMEOUT',
      (d) => responder(d));
    return true;
  }

  if (msg?.tipo === 'VER_ESPIA') {
    // Qué pedidos vio la página. Es lo que permite diagnosticar sin pedirle otra
    // captura de pantalla a nadie.
    pedirALaPagina('MAKO_ESPIA_PIDO', 'MAKO_ESPIA_OK', {}, 5000, 'ESPIA_TIMEOUT',
      (d) => responder(d));
    return true;
  }

  return false;
});
