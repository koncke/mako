// =============================================================================
// «Capturar» desde «Sus páginas» de Competitors Spy: lee la página que ya se ve. Nada más. (0.76.0, 4/11/2026)
// =============================================================================
// Lo inyecta el desplegable (`chrome.scripting.executeScript`, sólo `activeTab`) cuando la persona toca el ícono de MaKo en la
// pestaña que la extensión abrió para ESA página (la pidió Spy con «Capturar»; el worker la anotó). No es un content script: no
// corre en ningún sitio hasta ese toque, y corre una vez.
//
// ⚠️ NO INTERPRETA. Si lo que se ve es la página, su error o el desafío de un antibots lo decide el servidor
// (lib/spy-pagina-capturada.ts), como en «Guardar en Spy» (spy-leer.js).
//
// LO QUE NO HACE, y lo mira tests/spy-captura-pagina.test.ts:
//   · no mueve la página: ni scroll, ni clics, ni foco. Lee lo que ya está dibujado;
//   · no lee valores de formularios, cookies ni almacenamiento;
//   · no pide nada a la red y no escribe en la página;
//   · no corre en MAIN: el mundo aislado no ve las variables de la página.
//
// A diferencia de «Guardar en Spy» en un sitio cualquiera, acá SÍ sale su texto: es la página de un competidor que la persona
// eligió capturar desde Spy, y su texto es lo que se quiere mirar. Sólo corre en la pestaña que la extensión abrió para eso.
//
// Script clásico y sin barra-asterisco dentro de un texto (AGENTS.md, «La extensión en el sitio de un tercero»). La última
// expresión es lo que recibe quien lo inyectó.
// =============================================================================

(() => {
  const TOPE = { texto: 60000, html: 30000, titulo: 300, enlaces: 500 };

  /** Una dirección de una página, sin su consulta ni su ancla: ahí viajan los datos de quien la visita. */
  const limpia = (crudo) => {
    let u;
    try { u = new URL(crudo, location.href); } catch { return null; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return `${u.origin}${u.pathname}`;
  };

  const enlaces = () => {
    const out = new Set();
    for (const a of document.querySelectorAll('a[href]')) {
      const l = limpia(a.href);
      if (l) out.add(l);
      if (out.size >= TOPE.enlaces) break;
    }
    return [...out];
  };

  // El texto que se ve: `innerText` respeta lo escondido y no trae lo que está escrito en un campo.
  const texto = () => {
    try { return String((document.body && document.body.innerText) || '').replace(/\s+/g, ' ').trim().slice(0, TOPE.texto); } catch { return ''; }
  };

  // Sólo el principio, para que el servidor reconozca el desafío de un antibots. No se guarda.
  const principio = () => {
    try { return String(document.documentElement.outerHTML || '').slice(0, TOPE.html); } catch { return ''; }
  };

  return {
    modo: 'pagina',
    final: limpia(location.href),
    titulo: (document.title || '').slice(0, TOPE.titulo),
    texto: texto(),
    enlaces: enlaces(),
    html: principio(),
  };
})();
