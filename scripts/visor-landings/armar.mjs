// =============================================================================
// El visor de las landings de /vsl («Landings de MaKo»): fotografía cada página y arma la carpeta que se publica como artifact
// =============================================================================
// Martín da su feedback de las landings mirando un visor: la lista de páginas, «Copiado» / «Diseño MaKo», claro / oscuro y
// computadora / teléfono (docs/relevo/landings-vsl.md). Este script lo rearma desde cero, para que cualquier chat pueda
// publicar la versión nueva cuando cambie algo:
//
//   node scripts/visor-landings/armar.mjs <carpeta-de-salida> [https://hola-mako.com] [slug,slug,…]
//
// Abre cada página en Chromium headless y MUDO, a 1440 y a 390 px, espera que hidrate, la recorre para que aparezca lo que
// entra al hacer scroll, y guarda una FOTO del DOM: sin scripts, con las hojas de estilo y las imágenes copiadas a
// <salida>/assets/ (mismas rutas que en el sitio) y los links a ellas reescritos. El visor (./visor.html) muestra
// paginas/<slug>.html (computadora) o paginas/<slug>-tel.html (teléfono) en un iframe.
//
// ⚠️ La base es PRODUCCIÓN: lo que se fotografía es lo desplegado, no main. Antes de publicar, mirar que el commit esté en
// el aire (docs/hallazgos-landing.md → «Cuarta vuelta»).
// ⚠️ No suma visitas: se cortan TODOS los pedidos a otro dominio (Pixel, Clarity, Meta, Panda, Calendly) salvo las fuentes de
// Google, y los de /api/ del propio sitio. Un iframe de video (Panda) queda como una caja negra que lo dice.
// Necesita playwright-core: lo toma del repo si está, si no de PLAYWRIGHT_CORE (en la PC de Martín,
// C:/dev/playwright-medidor/node_modules/playwright-core) con el Chromium de ~/AppData/Local/ms-playwright.
// =============================================================================

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const [salida, base = 'https://hola-mako.com', soloArg] = process.argv.slice(2);
if (!salida) { console.error('Uso: node scripts/visor-landings/armar.mjs <salida> [base] [slug,slug]'); process.exit(1); }

/** Las páginas del visor, en el orden y los grupos en que Martín las mira. `ref` y `url`: la referencia que copia. */
export const PAGINAS = [
  { slug: 'sitio', nombre: 'La portada nueva', grupo: 'Portada nueva · vista previa', ref: 'beehiiv', url: 'https://www.beehiiv.com/', que: 'la estructura y el diseño' },
  { slug: 'comparaciones', nombre: 'Comparaciones', grupo: 'Portada nueva · vista previa', ref: 'beehiiv', url: 'https://www.beehiiv.com/comparisons', que: 'la estructura y el diseño' },
  { slug: 'video', nombre: 'Video', grupo: 'Las que pediste', ref: 'Cherry Studio', url: 'https://cherrysweet.app/' },
  { slug: 'competitor-spy', nombre: 'Competitor Spy', grupo: 'Las que pediste', ref: 'Foreplay', url: 'https://www.foreplay.co/' },
  { slug: 'ads', nombre: 'Marketing CoPilot', grupo: 'Las que pediste', ref: 'Master Ads', url: 'https://masterads.ai/' },
  { slug: 'ai-avatar', nombre: 'AI Avatar', grupo: 'Crear', ref: 'HeyGen', url: 'https://www.heygen.com/es-mx/business/marketing/ugc-video-ads' },
  { slug: 'image', nombre: 'Image', grupo: 'Crear', ref: 'PostNitro', url: 'https://postnitro.ai/es' },
  { slug: 'copywriting', nombre: 'Copywriting', grupo: 'Crear', ref: 'The Copy Machine', url: 'https://theoperatorstack.io/copy-machine' },
  { slug: 'web-generator', nombre: 'Web Generator', grupo: 'Crear', ref: 'HighLevel AI Studio', url: 'https://www.gohighlevel.com/ai-studio' },
  { slug: 'offer', nombre: 'Offer', grupo: 'Crear', ref: 'Atlas AI de Done For You', url: 'https://go.doneforyou.com/offer-formula' },
  { slug: 'whatsapp', nombre: 'Chats', grupo: 'Vender', ref: 'Leadsales', url: 'https://leadsales.io/' },
  { slug: 'crm', nombre: 'CRM', grupo: 'Vender', ref: 'GoHighLevel', url: 'https://www.gohighlevel.com/' },
  { slug: 'seguimiento', nombre: 'Automations', grupo: 'Vender', ref: 'SetSmart', url: 'https://setsmart.io/es' },
  { slug: 'agenda', nombre: 'Agenda', grupo: 'Vender', ref: 'iClosed', url: 'https://www.iclosed.io/' },
  { slug: 'cobranza', nombre: 'Cobranza', grupo: 'Vender', ref: 'Rebill', url: 'https://www.rebill.com/es' },
  { slug: 'email', nombre: 'Email', grupo: 'Vender', ref: 'beehiiv', url: 'https://www.beehiiv.com/' },
  { slug: 'dashboard', nombre: 'Dashboard', grupo: 'Medir y ordenar', ref: 'Reportei', url: 'https://reportei.com/es/' },
  { slug: 'script', nombre: 'Ads Analyst', grupo: 'Medir y ordenar', ref: 'Gethookd', url: 'https://www.gethookd.ai/' },
  { slug: 'funnel', nombre: 'Funnels', grupo: 'Medir y ordenar', ref: 'Hyros', url: 'https://hyros.com/' },
  { slug: 'mako', nombre: 'Ops Center', grupo: 'Medir y ordenar', ref: 'Holo', url: 'https://tryholo.ai/' },
  { slug: 'prioridades', nombre: 'Plan', grupo: 'Medir y ordenar', ref: 'Motion', url: 'https://www.usemotion.com/' },
].map((p) => ({ que: 'el diseño y los textos', ruta: `/vsl/${p.slug}`, ...p }));

/**
 * Las páginas de la app a las que llevan los links de las landings (la barra, «Precios», el pie, «Industrias»). Se fotografían
 * igual, para que el visor se navegue «tal cual como quedaría» (Martín, 12/11/2026). No tienen referencia: son de MaKo.
 */
export const DE_LA_APP = [
  { slug: 'planes', nombre: 'Precios', ruta: '/planes' },
  { slug: 'planes-pro', nombre: 'Checkout · MaKo Pro', ruta: '/planes/pro' },
  { slug: 'planes-esencial', nombre: 'Checkout · MaKo Esencial', ruta: '/planes/esencial' },
  { slug: 'login', nombre: 'Iniciar sesión', ruta: '/login' },
  { slug: 'coaches', nombre: 'Industrias · Coaches', ruta: '/vsl/coaches' },
  { slug: 'infoproductores', nombre: 'Industrias · Infoproductores', ruta: '/vsl/infoproductores' },
  { slug: 'inmobiliarias', nombre: 'Industrias · Inmobiliarias', ruta: '/vsl/inmobiliarias' },
  // Las mini landings por funnel (13/11/2026, la llamada con Leila): app/vsl/funnels/[funnel] con app/vsl/_sitio/funnels-datos.ts.
  { slug: 'funnel-vsl', nombre: 'Funnels · VSL con llamada', ruta: '/vsl/funnels/vsl' },
  { slug: 'funnel-whatsapp', nombre: 'Funnels · Anuncios a WhatsApp', ruta: '/vsl/funnels/whatsapp' },
  { slug: 'funnel-instagram', nombre: 'Funnels · Instagram con lead magnet', ruta: '/vsl/funnels/instagram' },
  { slug: 'funnel-youtube', nombre: 'Funnels · YouTube orgánico', ruta: '/vsl/funnels/youtube' },
  { slug: 'terminos', nombre: 'Términos', ruta: '/terminos' },
  { slug: 'privacidad', nombre: 'Privacidad', ruta: '/privacidad' },
  { slug: 'aup', nombre: 'Uso aceptable', ruta: '/aup' },
  { slug: 'soporte', nombre: 'Soporte', ruta: '/soporte' },
];

/** Los links que llevan a la portada: el logo (`/`) y `/vsl` (que redirige a `/`). En el visor, la portada es la nueva. */
export const ALIAS = { '/': 'sitio', '/vsl': 'sitio' };

const ANCHOS = [{ sufijo: '', ancho: 1440, alto: 900 }, { sufijo: '-tel', ancho: 390, alto: 844 }];
const ORIGEN = new URL(base).origin;

async function cargarPlaywright() {
  for (const c of ['playwright-core', process.env.PLAYWRIGHT_CORE, 'C:/dev/playwright-medidor/node_modules/playwright-core']) {
    if (!c) continue;
    try { return await import(c.includes('/') ? pathToFileURL(join(c, 'index.mjs')).href : c); } catch { /* el siguiente */ }
  }
  throw new Error('No encuentro playwright-core (ver la cabecera).');
}

/** Dentro de la página: la foto del DOM. Las hojas de estilo quedan como <link>, con la ruta ABSOLUTA del sitio. */
function fotoDelDom() {
  const abs = (u) => { try { const x = new URL(u, location.href); return x.origin === location.origin ? x.pathname + x.search : x.href; } catch { return u; } };
  // Un <style> que se llenó con insertRule (CSS-in-JS) tiene el texto vacío: se le escriben sus reglas.
  const estilos = [...document.querySelectorAll('style')].map((s) => {
    try { return s.textContent.trim() ? null : [...s.sheet.cssRules].map((r) => r.cssText).join('\n'); } catch { return null; }
  });
  const doc = document.documentElement.cloneNode(true);
  [...doc.querySelectorAll('style')].forEach((s, i) => { if (estilos[i]) s.textContent = estilos[i]; });
  doc.querySelectorAll('script:not([data-tema-sitio]), noscript, link[rel="preload"], link[rel="modulepreload"], link[rel="prefetch"], link[rel="preconnect"], link[rel="dns-prefetch"], next-route-announcer, nextjs-portal').forEach((n) => n.remove());
  doc.querySelectorAll('link[rel="stylesheet"]').forEach((l) => l.setAttribute('href', abs(l.getAttribute('href'))));
  // next/image: la imagen original, sin el srcset del optimizador.
  doc.querySelectorAll('img').forEach((im) => {
    const src = im.getAttribute('src') || '';
    if (src.includes('/_next/image')) { const u = new URL(src, location.href).searchParams.get('url'); if (u) im.setAttribute('src', u); }
    im.removeAttribute('srcset'); im.removeAttribute('sizes'); im.setAttribute('loading', 'eager');
  });
  doc.querySelectorAll('source[srcset]').forEach((s) => s.remove());
  // Un video de otro sitio (Panda) no se trae: queda una caja negra que lo dice, del mismo tamaño.
  const reales = [...document.querySelectorAll('iframe')];
  [...doc.querySelectorAll('iframe')].forEach((f, i) => {
    const r = reales[i]?.getBoundingClientRect();
    const caja = document.createElement('div');
    caja.setAttribute('style', `width:100%;height:${Math.round(r?.height || 300)}px;background:#0B0D12;color:#C9D1DE;display:flex;align-items:center;justify-content:center;font:600 14px system-ui,sans-serif;border-radius:inherit`);
    caja.textContent = '▶ Video (se reproduce en la página real)';
    f.replaceWith(caja);
  });
  doc.querySelectorAll('[src], [poster]').forEach((n) => { for (const a of ['src', 'poster']) { const v = n.getAttribute(a); if (v && !v.startsWith('data:')) n.setAttribute(a, abs(v)); } });
  // Los <details> que el usuario no abrió quedan cerrados, como en la página.
  return '<!doctype html>\n' + doc.outerHTML;
}

const enSitio = (u) => u.startsWith('/') && !u.startsWith('//');
const sinQuery = (u) => u.split('#')[0].split('?')[0];

/** El visor: la plantilla con las páginas, las de la app y los alias. `armar.mjs <salida> <base> indice` escribe sólo esto. */
function escribirIndice() {
  const plantilla = readFileSync(join(AQUI, 'visor.html'), 'utf8');
  const nuevas = (process.env.VISOR_NUEVAS || '').split(',').filter(Boolean);
  mkdirSync(salida, { recursive: true });
  writeFileSync(join(salida, 'index.html'), plantilla
    .replace('/*PAGINAS*/[]', JSON.stringify(PAGINAS.map((p) => ({ ...p, nueva: nuevas.includes(p.slug) }))))
    .replace('/*DE_LA_APP*/[]', JSON.stringify(DE_LA_APP))
    .replace('/*ALIAS*/{}', JSON.stringify(ALIAS)));
}

async function main() {
  if (soloArg === 'indice') { escribirIndice(); return; }
  const { chromium } = await cargarPlaywright();
  const solo = soloArg ? soloArg.split(',') : null;
  const paginas = [...PAGINAS, ...DE_LA_APP].filter((p) => !solo || solo.includes(p.slug));
  mkdirSync(join(salida, 'paginas'), { recursive: true });
  const assets = new Set();
  const nav = await chromium.launch({ headless: true, args: ['--mute-audio'] });
  for (const p of paginas) {
    for (const a of ANCHOS) {
      const ctx = await nav.newContext({ viewport: { width: a.ancho, height: a.alto }, deviceScaleFactor: 1, isMobile: a.ancho < 768, hasTouch: a.ancho < 768 });
      await ctx.route('**/*', (r) => {
        const u = new URL(r.request().url());
        const fuente = /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
        if (u.origin === ORIGEN ? u.pathname.startsWith('/api/') : !fuente) return r.abort();
        return r.continue();
      });
      const pag = await ctx.newPage();
      await pag.goto(`${base}${p.ruta}`, { waitUntil: 'load', timeout: 90_000 });
      await pag.waitForTimeout(1500);
      // El recorrido: hacia abajo de a una pantalla (la ventana o el contenedor que scrollea), y de vuelta arriba.
      await pag.evaluate(async () => {
        const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
        const cajas = [document.scrollingElement, ...[...document.querySelectorAll('*')].filter((n) => n.scrollHeight > n.clientHeight + 200 && /(auto|scroll)/.test(getComputedStyle(n).overflowY))];
        for (const c of cajas) { for (let y = 0; y < c.scrollHeight; y += Math.round(innerHeight * 0.8)) { c.scrollTop = y; await esperar(140); } c.scrollTop = 0; }
      });
      await pag.waitForTimeout(1200);
      let html = await pag.evaluate(fotoDelDom);
      // Las rutas del sitio pasan a ../assets/<ruta>, y se anotan para bajarlas.
      const local = (u) => { const r = sinQuery(u).replace(/^\//, ''); assets.add('/' + r); return `../assets/${r}`; };
      html = html.replace(/(\s(?:src|poster|href)=")(\/[^"]*)"/g, (m, a1, u) => {
        if (!enSitio(u)) return m;
        if (a1.includes('href') && !/\.(css|woff2?|png|jpe?g|webp|svg|ico)(\?|$)/.test(u)) return m;  // un link a otra página queda: el visor lo intercepta
        return `${a1}${local(u)}"`;
      });
      html = html.replace(/url\((["']?)(\/[^)"']+)\1\)/g, (m, q, u) => (enSitio(u) ? `url(${q}${local(u)}${q})` : m));
      writeFileSync(join(salida, 'paginas', `${p.slug}${a.sufijo}.html`), html);
      console.log(`${p.slug}${a.sufijo}: ${(html.length / 1024).toFixed(0)} KB`);
      await ctx.close();
    }
  }
  await nav.close();
  // Bajar lo que piden las páginas, y lo que piden sus hojas de estilo (fuentes, imágenes), con las rutas relativas a la hoja.
  const pendientes = [...assets];
  const hechos = new Set();
  while (pendientes.length) {
    const ruta = pendientes.shift();
    if (hechos.has(ruta)) continue;
    hechos.add(ruta);
    const destino = join(salida, 'assets', ruta.replace(/^\//, ''));
    const res = await fetch(base + ruta);
    if (!res.ok) { console.warn(`⚠️ ${ruta}: ${res.status}`); continue; }
    mkdirSync(dirname(destino), { recursive: true });
    if (ruta.endsWith('.css')) {
      const carpeta = posix.dirname(ruta);
      const css = (await res.text()).replace(/url\((["']?)([^)"']+)\1\)/g, (m, q, u) => {
        if (u.startsWith('data:') || /^https?:/.test(u)) return m;
        const abs = sinQuery(u.startsWith('/') ? u : posix.normalize(posix.join(carpeta, u)));
        pendientes.push(abs);
        return `url(${q}${posix.relative(carpeta, abs)}${q})`;
      });
      writeFileSync(destino, css);
    } else {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 15 * 1024 * 1024) { console.warn(`⚠️ ${ruta}: ${(buf.length / 1048576).toFixed(1)} MB, no entra`); continue; }
      writeFileSync(destino, buf);
    }
  }
  console.log(`assets: ${hechos.size}`);
  // Las letras de «Diseño MaKo» (Urbanist y Geist Mono, OFL), del subconjunto latino de Google Fonts.
  mkdirSync(join(salida, 'assets', 'fuentes-mako'), { recursive: true });
  for (const [familia, archivo] of [['Urbanist', 'urbanist'], ['Geist+Mono', 'geist-mono']]) {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${familia}:wght@100..900&display=swap`, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' } })).text();
    const latino = css.split('/* latin */')[1] ?? css;
    const url = latino.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
    if (!url) { console.warn(`⚠️ ${familia}: no encontré su woff2`); continue; }
    writeFileSync(join(salida, 'assets', 'fuentes-mako', `${archivo}.woff2`), Buffer.from(await (await fetch(url)).arrayBuffer()));
  }
  escribirIndice();
  if (!existsSync(join(salida, 'assets', 'fuentes-mako', 'urbanist.woff2'))) console.warn('⚠️ Faltan las letras de «Diseño MaKo» en assets/fuentes-mako/.');
}

main().catch((e) => { console.error(e); process.exit(1); });
