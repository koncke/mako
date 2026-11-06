// =============================================================================
// «Guardar en MaKo» en el desplegable: ¿esta pestaña es el perfil de una persona? Sólo mira la DIRECCIÓN
// =============================================================================
// Lo prometido a la agencia de Thiago (docs/promesas/2910-llamada-thiago.md): sobre el perfil abierto de Instagram o de
// LinkedIn, un botón que guarda a esa persona como lead del CRM. De a uno, a la vista y con el toque de la persona: el
// desplegable lo ofrece sólo cuando Chrome le dio la pestaña (`activeTab`, o sea el clic en el ícono), y la página se lee
// recién al tocar el botón (perfil-leer.js). Nada de esto corre en segundo plano.
//
// Se decide acá, con la dirección, para que abrir el desplegable no le cuente a MaKo qué perfil se está mirando.
//
// Script clásico, como spy-reglas.js: lo prueba tests/perfil-extension.test.ts cargándolo como lo carga Chrome. Sin
// barra-asterisco dentro de un texto (AGENTS.md, «La extensión en el sitio de un tercero»).

var MakoPerfil = (() => {
  // Las rutas de instagram.com que NO son un perfil (la misma lista que `RUTAS_NO_PERFIL` de lib/leads-duplicados.ts, más
  // las páginas de la app que no son de nadie).
  const NO_ES_PERFIL_IG = new Set([
    'p', 'reel', 'reels', 'tv', 'explore', 'stories', 'accounts', 'direct', 'about', 'legal', 'developer',
    'web', 'challenge', 'emails', 'privacy', 'session', 'oauth', 'api', 'graphql', 'static', 'ar', 'data', 'help', 'press',
  ]);
  // Lo que puede seguir al usuario en la dirección y sigue siendo su perfil.
  const PESTANAS_IG = new Set(['reels', 'tagged', 'saved', 'followers', 'following', 'guide', 'guides']);
  const USUARIO_IG = /^[A-Za-z0-9._]{1,30}$/;
  const SLUG_LI = /^[A-Za-z0-9][A-Za-z0-9_-]{1,99}$/;

  const hostDe = (u) => u.hostname.toLowerCase().replace(/^(www|m)\./, '');
  const esDe = (host, dominio) => host === dominio || host.endsWith('.' + dominio);

  /** El perfil de esta pestaña, o null. `{ red: 'instagram', usuario }` o `{ red: 'linkedin', slug }`. */
  function queHay(url) {
    let u;
    try { u = new URL(url); } catch { return null; }
    if (u.protocol !== 'https:') return null;
    const host = hostDe(u);
    const partes = u.pathname.split('/').filter(Boolean);
    if (host === 'instagram.com') {
      const [usuario, pestana, ...resto] = partes;
      if (!usuario || resto.length || !USUARIO_IG.test(usuario) || NO_ES_PERFIL_IG.has(usuario.toLowerCase())) return null;
      if (pestana && !PESTANAS_IG.has(pestana.toLowerCase())) return null;
      return { red: 'instagram', usuario: usuario.toLowerCase() };
    }
    if (esDe(host, 'linkedin.com')) {
      if (partes[0] !== 'in' || !partes[1]) return null;
      let slug;
      try { slug = decodeURIComponent(partes[1]); } catch { return null; }
      if (!SLUG_LI.test(slug)) return null;
      return { red: 'linkedin', slug: slug.toLowerCase() };
    }
    return null;
  }

  /** El botón y su línea. */
  const rotulo = () => 'Guardar en MaKo';
  const detalle = (hay) => (hay.red === 'instagram' ? 'Crea el lead de @' + hay.usuario + ' en tu CRM' : 'Crea el lead de este perfil de LinkedIn en tu CRM');

  return { queHay, rotulo, detalle };
})();
