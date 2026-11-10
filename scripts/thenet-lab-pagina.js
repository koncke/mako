// =============================================================================
// thenet-lab-pagina.js — el recolector que corre ADENTRO de la pestaña de THE NET LAB (9/11/2026)
// =============================================================================
// THE NET LAB (thenet-lab.com) es WordPress + LearnDash + Elementor, con los videos en Spotlightr.
// Las lecciones están detrás del login, y la sesión vive en el Chrome de Martín: no hay CDP ahí
// (no se puede prender en un Chrome que ya corre, ver docs/hallazgos-conocimiento.md) y las cookies
// no se pueden sacar de Chrome en Windows. Así que el recolector corre DENTRO de la página, con la
// extensión de Claude in Chrome: un `fetch` same-origin ya lleva la sesión.
//
// Cómo se usa (desde la extensión, en una pestaña abierta en https://thenet-lab.com/courses/<curso>/):
//   1. Correr este archivo entero con la herramienta de JavaScript de la página. Deja
//      `window.__tnL` (el orden) y empieza a llenar `window.__tnD` (una entrada por página).
//      Tarda ~80 s para 109 páginas; la herramienta corta a los 45 s pero el trabajo sigue
//      corriendo en la página: se consulta `window.__tnD.filter(Boolean).length` hasta que da el total.
//   2. Levantar `node scripts/curso-recibir.mjs <carpeta>` en la PC.
//   3. Correr `__tnEnviar()` en la página: manda todo con un POST de formulario a 127.0.0.1:8799.
//
// ⚠️ POR QUÉ UN POST DE FORMULARIO y no devolver el resultado: la herramienta de JavaScript de la
// extensión CORTA la respuesta a ~1.000 caracteres sin avisar más que con «[TRUNCATED]», y un curso
// pesa ~1 MB de HTML. Un `fetch` a 127.0.0.1 desde una página pública choca con el permiso de «red
// local» de Chrome (un cartel en la pantalla de Martín); una NAVEGACIÓN de formulario no.
// Antes de enviar se guarda en `sessionStorage` por si el envío falla: no hay que recolectar dos veces.
// =============================================================================
(async () => {
  const curso = location.pathname.replace(/\/$/, '');
  window.__tnL = [...document.querySelectorAll('a')].map((a) => a.pathname)
    .filter((p) => p.startsWith(`${curso}/lessons/`) || p.startsWith(`${curso}/quizzes/`))
    .filter((v, i, s) => s.indexOf(v) === i);
  window.__tnD = []; window.__tnErr = [];
  const urls = window.__tnL.slice();
  const una = async (u, i) => {
    const r = await fetch(u, { credentials: 'include' });
    const d = new DOMParser().parseFromString(await r.text(), 'text/html');
    const c = d.querySelector('.ld-tab-content') || d.querySelector('.ld-focus-content') || d.querySelector('.learndash-wrapper');
    const tabs = [...d.querySelectorAll('.ld-tabs-navigation .ld-tab')].map((t) => t.textContent.trim());
    // Una lección con pestaña «Materiales» la trae en un segundo .ld-tab-content.
    const mats = [...d.querySelectorAll('.ld-tab-content')].slice(1).map((e) => {
      e.querySelectorAll('script,style,noscript,svg').forEach((x) => x.remove()); return e.innerHTML;
    });
    if (c) c.querySelectorAll('script,style,noscript,svg').forEach((x) => x.remove());
    window.__tnD[i] = {
      i, u, status: r.status,
      title: (d.querySelector('.ld-focus-content h1, h1') || {}).textContent?.trim() || '',
      crumbs: [...d.querySelectorAll('.ld-breadcrumbs a, .ld-breadcrumbs-segments a')].map((a) => a.textContent.trim()),
      tabs,
      iframes: [...d.querySelectorAll('iframe')].map((f) => f.getAttribute('src') || f.getAttribute('data-src') || '').filter(Boolean),
      html: c ? c.innerHTML : '',
      mats,
    };
  };
  let k = 0;
  const obrero = async () => {
    while (k < urls.length) {
      const i = k++;
      try { await una(urls[i], i); } catch (e) { window.__tnErr.push(`${urls[i]} ${e.message}`); }
      await new Promise((r) => setTimeout(r, 250)); // de a tres y con pausa: es el sitio de otro
    }
  };
  window.__tnEnviar = () => {
    const w = document.querySelector('.learndash-wrapper')?.cloneNode(true);
    w?.querySelectorAll('script,style,noscript,svg').forEach((x) => x.remove());
    const intro = document.querySelector('.elementor, .entry-content, main')?.cloneNode(true);
    intro?.querySelectorAll('script,style,noscript,svg').forEach((x) => x.remove());
    const og = document.querySelector('meta[property="og:image"]')?.content || '';
    const payload = JSON.stringify({
      curso: { u: location.pathname, title: document.title, og, listaHtml: w ? w.innerHTML : '',
        introTexto: intro ? intro.textContent.replace(/\s+/g, ' ').trim().slice(0, 20000) : '' },
      orden: window.__tnL, paginas: window.__tnD,
    });
    try { sessionStorage.setItem('__tnPayload', payload); } catch { /* sin lugar: se envía igual */ }
    const f = document.createElement('form');
    f.method = 'POST'; f.action = 'http://127.0.0.1:8799/recv'; f.enctype = 'application/x-www-form-urlencoded';
    const t = document.createElement('textarea'); t.name = 'data'; t.value = payload;
    f.appendChild(t); f.style.display = 'none'; document.body.appendChild(f);
    setTimeout(() => f.submit(), 50);
    return `enviando ${payload.length}`;
  };
  await Promise.all([obrero(), obrero(), obrero()]);
  return `${window.__tnD.filter(Boolean).length}/${urls.length} páginas, ${window.__tnErr.length} errores`;
})();
