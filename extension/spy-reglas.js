// =============================================================================
// «Guardar en Spy» en el desplegable: qué se ofrece en esta pestaña. Sólo mira la DIRECCIÓN
// =============================================================================
// Se compara acá, y no en el servidor, para que abrir el desplegable no le cuente a MaKo qué sitio estás
// mirando: la lista de competidores viene entera y la pestaña no sale de este navegador hasta el clic.
//
// Script clásico, como wa-fichas-reglas.js: lo prueba tests/spy-captura.test.ts cargándolo como lo carga
// Chrome. Sin barra-asterisco dentro de un texto (AGENTS.md).

var MakoSpy = (() => {
  const PROHIBIDOS = ['web.whatsapp.com', 'hola-mako.com', 'labs.google', 'flow.google.com'];
  // Una red no es «su sitio»: de un perfil se suma el canal, y el píxel de instagram.com es de Instagram.
  const REDES = ['instagram.com', 'youtube.com', 'youtu.be', 'tiktok.com', 'x.com', 'twitter.com', 'threads.net', 'linkedin.com'];

  const hostDe = (u) => u.hostname.toLowerCase().replace(/^www\./, '');
  const esDe = (host, dominio) => host === dominio || host.endsWith('.' + dominio);

  /** Lo que hay en la pestaña: `null` si acá no se ofrece nada. `undefined` es que Chrome no da la dirección: sin permiso. */
  function queHay(url) {
    let u;
    try { u = new URL(url); } catch { return null; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const host = hostDe(u);
    if (PROHIBIDOS.some((d) => esDe(host, d)) || host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
    if (esDe(host, 'facebook.com')) {
      if (!u.pathname.startsWith('/ads/library')) return null;
      return {
        tipo: 'anuncios',
        pagina: u.searchParams.get('view_all_page_id') || '',
        busqueda: (u.searchParams.get('q') || '').replace(/"/g, '').trim(),
      };
    }
    return { tipo: REDES.some((d) => esDe(host, d)) ? 'red' : 'sitio', dominio: host };
  }

  const comparable = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');

  /** La ficha que ya existe para esta pestaña, o null. Sólo se dice «la ficha de X» si es seguro que es de X. */
  function fichaDe(hay, competidores) {
    const lista = Array.isArray(competidores) ? competidores : [];
    if (!hay) return null;
    if (hay.tipo === 'red') return null;
    if (hay.tipo === 'sitio') {
      return lista.find((c) => c.dominio && (hay.dominio === c.dominio || hay.dominio.endsWith('.' + c.dominio))) || null;
    }
    if (hay.pagina) {
      const suya = lista.find((c) => c.pagina === hay.pagina);
      if (suya) return suya;
    }
    const buscado = hay.busqueda.toLowerCase().replace(/^www\./, '');
    if (!buscado) return null;
    return lista.find((c) => c.dominio && c.dominio === buscado)
      || lista.find((c) => comparable(c.nombre) === comparable(buscado))
      || null;
  }

  /** El botón. Los dos textos son decisión de Martín (3/11/2026). */
  const rotulo = (ficha) => (ficha ? 'Guardar en la ficha de ' + ficha.nombre : 'Agregar como competidor');
  const detalle = (hay) => (hay.tipo === 'anuncios' ? 'Los anuncios que ves en esta pestaña'
    : hay.tipo === 'red' ? 'Suma este perfil a tu lista'
      : 'Sus píxeles, su checkout y su video');

  return { queHay, fichaDe, rotulo, detalle };
})();
