// =============================================================================
// «Guardar en MaKo»: lee el perfil que la pestaña YA dibujó y lo devuelve. Nada más.
// =============================================================================
// Lo inyecta el desplegable (`chrome.scripting.executeScript`, sólo `activeTab`) cuando la persona toca «Guardar en MaKo»
// sobre el perfil de Instagram o de LinkedIn que tiene abierto. No es un content script: no corre en ningún sitio hasta ese
// clic, y corre una vez.
//
// ⚠️ NO INTERPRETA. Acá no se decide cuál es el nombre ni el usuario: eso vive en el servidor (lib/perfil-captura.ts). Instagram
// y LinkedIn cambian su página sin avisar, y arreglar la lectura con un deploy son minutos; con una versión de la extensión es
// otra revisión de Chrome.
//
// LO QUE NO HACE, y lo mira tests/perfil-extension.test.ts:
//   · no mueve la página: ni scroll, ni clics, ni foco. Lee lo que ya está dibujado;
//   · no lee valores de formularios, cookies ni almacenamiento;
//   · no pide nada a la red y no escribe en la página;
//   · no corre en MAIN: el mundo aislado no ve las variables de la página;
//   · no lee los mensajes, las publicaciones ni la lista de seguidores: el título, las etiquetas que la página publica de sí
//     misma (las de «og:») y los encabezados del perfil.
//
// Script clásico y sin barra-asterisco dentro de un texto (AGENTS.md). La última expresión es lo que recibe quien lo inyectó.
// =============================================================================

(() => {
  const host = location.hostname.toLowerCase().replace(/^(www|m)\./, '');
  const esLinkedin = host === 'linkedin.com' || host.endsWith('.linkedin.com');
  if (host !== 'instagram.com' && !esLinkedin) return { modo: 'prohibido' };

  const corto = (s, n) => String(s || '').replace(/[\s\p{Cf}]+/gu, ' ').trim().slice(0, n);
  const meta = (prop) => {
    const m = document.querySelector('meta[property="' + prop + '"]');
    return m ? corto(m.getAttribute('content'), 600) : '';
  };
  // Los encabezados del perfil: en LinkedIn el nombre es el primer h1 de la página; en Instagram, el usuario y el nombre van
  // en el encabezado del perfil. Pocos y cortos.
  const encabezados = [];
  for (const h of document.querySelectorAll('main h1, main h2, header h1, header h2')) {
    const t = corto(h.textContent, 200);
    if (t && !encabezados.includes(t)) encabezados.push(t);
    if (encabezados.length >= 6) break;
  }

  return {
    modo: 'perfil',
    red: esLinkedin ? 'linkedin' : 'instagram',
    url: location.origin + location.pathname,
    titulo: corto(document.title, 300),
    ogTitulo: meta('og:title'),
    ogDescripcion: meta('og:description'),
    ogImagen: meta('og:image'),
    encabezados,
  };
})();
