// =============================================================================
// El apretón de manos con MaKo — corre en hola-mako.com
// =============================================================================
// Existe para que el usuario NO tenga que copiar y pegar un código.
//
// Hace dos cosas, las dos por el DOM y no por `externally_connectable`: ese
// mecanismo necesita el ID de la extensión, y el ID CAMBIA cuando se publica en
// la Chrome Web Store (Google asigna el suyo). Marcando el DOM funciona igual
// instalada a mano o desde la tienda, sin tocar una línea.
//
//   1. Avisa que está instalada, poniendo un atributo en <html>. La página lo
//      mira y por eso puede decir «Conectar» en vez de «Descargá un zip».
//   2. Recibe el token cuando la persona aprieta el botón, y lo guarda.
//
// Solo escucha en el origen de MaKo, que es el único declarado en el manifest.

document.documentElement.setAttribute('data-mako-puente', chrome.runtime.getManifest().version);

window.addEventListener('MAKO_PUENTE_TOKEN', (ev) => {
  const token = ev.detail && ev.detail.token;
  if (typeof token !== 'string' || !token.startsWith('flow_')) return;
  chrome.storage.local.set({ token }, () => {
    // El acuse va de vuelta por el mismo camino: sin esto la página no puede
    // distinguir «lo guardó» de «la extensión no escuchó», y terminaría
    // diciendo que conectó sobre algo que no pasó.
    window.dispatchEvent(new CustomEvent('MAKO_PUENTE_TOKEN_OK'));
  });
});
