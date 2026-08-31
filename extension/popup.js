// El popup informa; no configura. Ver el porqué en popup.html.
//
// ⚠️ Y la línea tiene que ser HONESTA sobre qué habilita cada cosa: «conectada»
// no significa que se pueda generar — significa que tiene la llave de MaKo. Lo
// que habilita a generar es la sesión de Flow abierta. Son dos hechos y por eso
// hay dos mensajes distintos, cada uno con el único link que lo arregla.

const MAKO = 'https://hola-mako.com/video-generator';
const FLOW = 'https://labs.google/fx/tools/flow';

const $ = (id) => document.getElementById(id);

function pintar(tono, txt, link) {
  $('punto').dataset.tono = tono;
  $('txt').textContent = txt;
  // `textContent` primero: lo que se dibuja acá no viene de ningún lado ajeno,
  // pero armar HTML por concatenación es el hábito que después sí muerde.
  $('sec').textContent = '';
  if (link) {
    const a = document.createElement('a');
    a.href = link.href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = link.txt;
    $('sec').appendChild(a);
  }
}

chrome.storage.local.get('token', ({ token }) => {
  if (!token) {
    pintar('falta', 'Sin conectar', { href: MAKO, txt: 'Conéctala desde MaKo →' });
    return;
  }
  chrome.runtime.sendMessage({ tipo: 'ESTADO' }, (r) => {
    // Leer `lastError` NO es cosmetico: si el service worker estaba dormido y no
    // contesta, Chrome lo escupe como error sin capturar en la consola. Leerlo lo
    // da por atendido, y la respuesta ausente ya esta contemplada abajo.
    void chrome.runtime.lastError;
    if (r && r.conectado) {
      pintar('ok', 'Listo');
      $('sec').textContent = `v${chrome.runtime.getManifest().version}`;
      return;
    }
    pintar('falta', 'Falta abrir Flow', { href: FLOW, txt: 'Abrir Google Flow →' });
  });
});
