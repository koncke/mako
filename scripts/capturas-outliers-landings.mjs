// =============================================================================
// Las capturas LARGAS de la portada de Web Generator: public/web-generator/outliers/largas/<id>.webp (11/11/2026)
// =============================================================================
// La portada «Encuentra tu siguiente OUTLIER» (app/web-generator/OutliersLandings.tsx) muestra cada landing con la captura de
// la página ENTERA, y al pasar el cursor se scrollea adentro. El manifiesto es lib/landing-outliers-capturas.json (una
// entrada por landing que sirve) y las que quedaron afuera, con su motivo, están en docs/web-generator/outliers-capturas-afuera.md.
//
// CORRER (desde la raíz del repo; la base sólo se LEE, en una transacción `read only`):
//   node --env-file=<.env con DATABASE_URL> --import tsx scripts/capturas-outliers-landings.mjs
//       → las que FALTAN: las landings de docs/competencia/landings-por-funcion.md y las de los competidores que siguen los
//         negocios en Competitors Spy (`spy_competidores.landing_url`, de todos los workspaces) que no están ni en el manifiesto
//         ni en «afuera». Para cuando un negocio suma competidores en Spy. Sin `DATABASE_URL` busca `.env.local` en la carpeta.
//   … --seco                  → sólo dice cuáles faltan; no abre nada
//   … --sin-spy               → sin la base: sólo el documento
//   … --url <url> [--id <id>] → esa página (nueva, o de nuevo si ya está: conserva sus textos y actualiza alto y kb)
//   … --vistas <carpeta>      → además deja, por página, <carpeta>/vistas/<id>.jpg (la tira cortada en columnas, para MIRARLA)
//                               y <carpeta>/resultados/<id>.json (titular, textos, alto)
//   … --lista <archivo.json>  → [{ id, url, tramos?, espera? }]: esas, sin tocar el manifiesto (tandas a mano; con --vistas)
//   … --tramos                → todas por tramos (ver abajo). Con `--url` o en `--lista` (`tramos: true`) para una sola.
//   DEBUG_CAPTURA=1           → cuánto tarda cada paso dentro de la página
//
// ⚠️ UNA ENTRADA NUEVA ENTRA CON `"revisar": true`, y la portada no la muestra: el script no sabe mirar. Alguien abre su hoja de
// --vistas y decide (Martín, 11/11/2026: «viralidad.com, que es un recuadro negro con un logo» y «la de Leila Hormozi, que es
// sólo texto» no sirven). Si SIRVE (se ve la landing de verdad: titular, imágenes, secciones): completa `nicho`, `tipo` y
// `porque` (una frase de 15 a 35 palabras, en español neutro con tú) y le saca `revisar`. Si NO sirve (en blanco, negra, un logo
// solo, sólo texto, login, bloqueo, tapada): borra la entrada y la imagen, y suma la URL a «afuera» con el motivo concreto.
// Lo que el script descarta solo va directo a «afuera»: link en la bio, bloqueo anti-robots, captura lisa (en blanco o negra).
// Una que falla dos veces (no abre, se cuelga) no se anota en ningún lado: la próxima corrida la vuelve a intentar. Un bloqueo
// puede ser de un día: motionads.impultienda.ar estaba tapada por Cloudflare a la mañana y a la tarde abrió sin desafío.
//
// CÓMO SE CAPTURA (lo que anduvo en la casa; ver scripts/banco-editor-web/capturar.mjs): Chrome SIN ventana por CDP con un perfil
// descartable (nunca el Chrome de Martín ni su sesión), UNO por vez, ventana FIJA de 1280×800 (no se estira la página: un hero
// de 100vh queda de 800), se recorre bajando de a 600 px para que carguen imágenes y animaciones, se vuelve arriba, se esconden
// los carteles de cookies, popups, modales y chats flotantes que TAPAN, y `Page.captureScreenshot` con `captureBeyondViewport`,
// un clip del alto de la página (tope: los primeros 9000 px) y escala 0.5 → 640 de ancho → WEBP calidad 62. Si esa captura se
// cuelga (páginas con video o animación pesada), se saca por TRAMOS de 800 px y se pegan. Se bloquean el video de venta y los
// medidores (mirar no suma visitas). PROHIBIDO esquivar controles anti-robots: no se cambia el agente del navegador ni se pasa
// Cloudflare ni un CAPTCHA; la página bloqueada queda afuera.
// ⚠️ La captura de una sola vez dibuja la página como quedó DESPUÉS de recorrerla: lo que se anima al entrar en vista y se
// vuelve a esconder al salir (secciones que aparecen, se desvanecen o se «pinchan» al scrollear) sale como un hueco en blanco o
// negro. Esas páginas van por tramos (`--tramos`): cada tramo se fotografía mientras está en pantalla. Mirar la hoja de --vistas.
// =============================================================================

import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { esLinkEnBio, urlLimpia } from '../lib/landing-outliers.ts';

const RAIZ = process.cwd();
const MANIFIESTO = path.join(RAIZ, 'lib/landing-outliers-capturas.json');
const AFUERA_MD = path.join(RAIZ, 'docs/web-generator/outliers-capturas-afuera.md');
const DOCUMENTO = path.join(RAIZ, 'docs/competencia/landings-por-funcion.md');
const DESTINO = path.join(RAIZ, 'public/web-generator/outliers/largas');
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ANCHO = 1280;
const ALTO = 800;
const TOPE = 9000;
const ESPERA = 3500;

const args = process.argv.slice(2);
const opcion = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const SECO = args.includes('--seco');
const SIN_SPY = args.includes('--sin-spy');
const TRAMOS = args.includes('--tramos'); // fuerza la captura por tramos (la de respaldo)
const VISTAS = opcion('--vistas') ? path.resolve(opcion('--vistas')) : null;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** La misma página con otro `utm_`, con o sin `www.` o barra final, es la misma. */
const clave = (u) => urlLimpia(u).replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '').toLowerCase();
const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ── Lo que ya hay ────────────────────────────────────────────────────────────
const leerManifiesto = () => (fs.existsSync(MANIFIESTO) ? JSON.parse(fs.readFileSync(MANIFIESTO, 'utf8')) : []);
const urlsAfuera = () => (fs.existsSync(AFUERA_MD) ? [...fs.readFileSync(AFUERA_MD, 'utf8').matchAll(/^\| (https?:\/\/\S+) \|/gm)].map((m) => m[1]) : []);

function sumarAfuera(url, fuente, motivo) {
  const md = fs.existsSync(AFUERA_MD) ? fs.readFileSync(AFUERA_MD, 'utf8').replace(/\s*$/, '') : '| URL | Fuente | Motivo |\n|---|---|---|';
  fs.writeFileSync(AFUERA_MD, `${md}\n| ${url} | ${fuente} | ${motivo.replace(/\|/g, '\\|')} |\n`);
  console.log(`  → afuera: ${url} (${motivo})`);
}

// ── De dónde salen ───────────────────────────────────────────────────────────
/** Las del documento de competencia: los links https y los dominios entre comillas invertidas, con su nombre si se lee. */
function delDocumento() {
  const md = fs.readFileSync(DOCUMENTO, 'utf8');
  const out = [];
  const sueltos = []; // los dominios entre comillas invertidas van después: si la misma página está como link, gana el link
  for (const linea of md.split('\n')) {
    const celdas = linea.startsWith('|') ? linea.split('|').slice(1, -1).map((c) => c.trim()) : [];
    for (const m of linea.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)) {
      // en las tablas de competidores el nombre es la primera celda; si el link ES la primera celda, su texto
      const primera = celdas[0] ?? '';
      const nombre = (primera && !primera.includes('](') ? primera : m[1]).replace(/\*\*/g, '').replace(/\s*\(.*$/, '').trim();
      out.push({ url: m[2], nombre: /\./.test(nombre) && nombre === m[1] ? null : nombre });
    }
    for (const m of linea.matchAll(/`((?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^`\s]*)?)`/gi)) {
      if (/\.(ts|tsx|md|mjs|json|css)$/i.test(m[1])) continue;
      sueltos.push({ url: `https://${m[1]}`, nombre: null });
    }
  }
  return [...out, ...sueltos].map((x) => ({ ...x, fuente: 'documento' }));
}

/** Las de Competitors Spy, de todos los workspaces: SÓLO LECTURA. */
async function deSpy() {
  if (!process.env.DATABASE_URL && fs.existsSync(path.join(RAIZ, '.env.local'))) process.loadEnvFile(path.join(RAIZ, '.env.local'));
  const { urlDeLaBase } = await import('./url-de-la-base.mjs');
  const conn = urlDeLaBase();
  if (!conn) throw new Error('Falta DATABASE_URL (--env-file=<.env> o .env.local), o corré con --sin-spy');
  const { default: postgres } = await import('postgres');
  const sql = postgres(conn, { ssl: 'require', max: 1, connect_timeout: 20, idle_timeout: 5 });
  try {
    const filas = await sql.begin('read only', (tx) => tx`
      select nombre, landing_url from spy_competidores where landing_url is not null and landing_url ~* '^https?://' order by id`);
    return filas.map((f) => ({ url: f.landing_url, nombre: f.nombre, fuente: 'spy' }));
  } finally { await sql.end(); }
}

function idNuevo(x, usados) {
  let base;
  const u = new URL(urlLimpia(x.url));
  const host = u.hostname.replace(/^www\./, '').split('.').slice(0, -1).join('-');
  if (x.fuente === 'spy' && x.nombre) base = `spy-${slug(x.nombre).slice(0, 24).replace(/-$/, '')}`;
  else {
    const partes = u.pathname.split('/').filter((p) => p && !/^[a-z]{2}(-[a-z]{2})?$/i.test(p));
    base = slug([host, partes.at(-1) ?? ''].join('-')).slice(0, 40).replace(/-$/, '');
    if (x.fuente === 'spy') base = `spy-${base}`;
  }
  let id = base; let i = 2;
  while (usados.has(id)) id = `${base}-${i++}`;
  usados.add(id);
  return id;
}

// ── El Chrome (uno por vez; si se cuelga, se cierra por SU pid y se abre otro) ──
let chrome = null;
async function abrirChrome() {
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'captura-larga-'));
  const puerto = 9400 + Math.floor(Math.random() * 400);
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${puerto}`, `--user-data-dir=${perfil}`, '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking', '--mute-audio', '--hide-scrollbars', `--window-size=${ANCHO},${ALTO}`,
    '--autoplay-policy=user-gesture-required', 'about:blank',
  ], { stdio: 'ignore' });
  let wsUrl;
  for (let i = 0; i < 40 && !wsUrl; i++) {
    await esperar(500);
    try { wsUrl = (await fetch(`http://127.0.0.1:${puerto}/json/version`).then((r) => r.json())).webSocketDebuggerUrl; } catch { /* todavía no */ }
  }
  if (!wsUrl) { matar(proc); throw new Error('Chrome no levantó'); }
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let n = 0;
  const pendientes = new Map();
  const oyentes = new Set();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); return; }
    for (const o of oyentes) o(m);
  };
  const cdp = (method, params = {}, sessionId, ms = 45000) => new Promise((res, rej) => {
    const id = ++n;
    const t = setTimeout(() => { pendientes.delete(id); rej(new Error(`timeout ${method}`)); }, ms);
    pendientes.set(id, (m) => { clearTimeout(t); if (m.error) rej(new Error(`${method}: ${m.error.message}`)); else res(m.result); });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  chrome = { proc, ws, cdp, oyentes, perfil };
}
function matar(proc) {
  try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { try { proc.kill(); } catch { /* ya no está */ } }
}
async function cerrarChrome() {
  if (!chrome) return;
  try { chrome.ws.close(); } catch { /* ya cerrado */ }
  matar(chrome.proc);
  await esperar(1000);
  try { fs.rmSync(chrome.perfil, { recursive: true, force: true }); } catch { /* lo limpia el sistema */ }
  chrome = null;
}

// ── Lo que corre adentro de la página ────────────────────────────────────────
const BLOQUEO = /just a moment|attention required|you have been blocked|verify you are human|checking your browser|confirma que eres humano|verifica que eres un ser humano|access denied|captcha|cf-chl|security check/i;

/** Esconde lo que TAPA: carteles de cookies, popups, modales, newsletter, chats y botones flotantes de WhatsApp. */
const ESCONDER = `(() => {
  const RE = /cookie|consent|gdpr|onetrust|cookiebot|privacy-banner|popup|pop-up|modal|newsletter|subscribe|suscri|lightbox|overlay|chat|intercom|drift|crisp|tawk|zendesk|hubspot-messages|livechat|whatsapp|wa-widget|tidio|klaviyo|optin|exit-intent|userway|accessibe|truste|didomi|usercentrics|termly|iubenda|osano|quantcast|sp_message|fc-consent/i;
  const TXT = /cookie|consent|acepto|aceptar|accept all|aceptar todas|rechazar|we use cookies|usamos cookies|utilizamos cookies|privacy|privacidad|subscribe|suscr[ií]bete|newsletter|chat with us|habla con|how can we help|¿en qué podemos/i;
  const FLOTANTE = /wa\\.me|api\\.whatsapp|whatsapp|messenger|intercom|chat/i;
  let n = 0;
  const vh = innerHeight, vw = innerWidth;
  // también adentro de los shadow roots: ahí viven los chats (el de LeadConnector/HighLevel, entre otros)
  const todos = [];
  const recorrer = (raiz) => { for (const el of raiz.querySelectorAll('*')) { todos.push(el); if (el.shadowRoot) recorrer(el.shadowRoot); } };
  recorrer(document.body);
  for (const el of todos) {
    const cs = getComputedStyle(el);
    const esDialogo = el.getAttribute('role') === 'dialog' || el.getAttribute('aria-modal') === 'true' || el.tagName === 'DIALOG';
    if (cs.position !== 'fixed' && cs.position !== 'sticky' && !esDialogo) continue;
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const ident = (el.id + ' ' + (typeof el.className === 'string' ? el.className : (el.className?.baseVal ?? '')) + ' ' + (el.getAttribute('aria-label') ?? '') + ' ' + (el.getAttribute('data-testid') ?? '') + ' ' + (el.tagName === 'IFRAME' ? (el.src + ' ' + el.title) : '')).slice(0, 600);
    const texto = (el.innerText ?? '').slice(0, 400);
    const tapaTodo = cs.position === 'fixed' && r.width * r.height > vw * vh * 0.55 && Number(cs.zIndex || 0) > 0;
    const header = r.top <= 2 && r.height < 200 && r.width > vw * 0.8;
    if (header && !RE.test(ident)) continue;
    const botonFlotante = cs.position === 'fixed' && r.width < 420 && r.height < 420 && r.bottom > vh - 260 && FLOTANTE.test(ident + ' ' + el.innerHTML.slice(0, 1500));
    // en la captura larga lo fijo queda pegado arriba de la página, encima del contenido: la barra pegada abajo (avisos, «compra
    // ya») y los botoncitos flotantes que no están en la cabecera (chat, «subir», insignias) tapan y no son la landing
    const barraDeAbajo = cs.position === 'fixed' && r.bottom > vh - 40 && r.top > vh * 0.55 && r.width > vw * 0.6 && r.height < 170;
    const flotanteChico = cs.position === 'fixed' && r.top > 90 && r.width < 260 && r.height < 170;
    // lo fijo que una página mete adentro de un shadow root (widgets de chat de terceros) y no es la cabecera
    const widgetEnSombra = el.getRootNode() !== document && cs.position === 'fixed' && r.top > 90 && r.width < 450 && r.height < 600;
    if (RE.test(ident) || botonFlotante || barraDeAbajo || flotanteChico || widgetEnSombra || (cs.position === 'fixed' && TXT.test(texto) && texto.length < 1500) || esDialogo || (tapaTodo && texto.length < 2000)) {
      if (tapaTodo && !RE.test(ident) && !esDialogo && !TXT.test(texto) && el.querySelector('main, section h1')) continue;
      el.style.setProperty('display', 'none', 'important'); n++;
    }
  }
  for (const f of document.querySelectorAll('iframe')) {
    if (/intercom|drift|crisp|tawk|zendesk|hubspot|livechat|tidio|chat|consent|cookie|recaptcha\\/api2\\/bframe/i.test(f.src + ' ' + f.title + ' ' + f.id)) {
      const cs = getComputedStyle(f); if (cs.position === 'fixed' || f.closest('[style*="fixed"]')) { f.style.setProperty('display', 'none', 'important'); n++; }
    }
  }
  if (n) for (const x of [document.documentElement, document.body]) { if (getComputedStyle(x).overflowY === 'hidden') x.style.setProperty('overflow-y', 'visible', 'important'); }
  document.body.classList.remove('modal-open', 'no-scroll', 'noscroll', 'overflow-hidden');
  return n;
})()`;

/** El alto de la página; si scrollea por dentro de un contenedor, el de ese contenedor. */
/** Por tramos: lo fijo y lo pegajoso (también en shadow roots) sale una sola vez, en el primer tramo. */
const OCULTAR_FIJOS = `(() => {
  const recorrer = (raiz) => { for (const el of raiz.querySelectorAll('*')) {
    const p = getComputedStyle(el).position;
    if (p === 'fixed' || p === 'sticky') el.style.setProperty('visibility', 'hidden', 'important');
    if (el.shadowRoot) recorrer(el.shadowRoot);
  } };
  recorrer(document.body);
})()`;

const ALTURA = `(() => {
  const d = document.documentElement, b = document.body;
  let h = Math.max(d.scrollHeight, b ? b.scrollHeight : 0, d.offsetHeight);
  let scroller = false;
  if (h <= innerHeight + 60) {
    let mejor = null;
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (!/(auto|scroll)/.test(cs.overflowY)) continue;
      if (el.scrollHeight > el.clientHeight + 100 && el.clientHeight > innerHeight * 0.6 && (!mejor || el.scrollHeight > mejor.scrollHeight)) mejor = el;
    }
    if (mejor) { scroller = true; window.__scroller = mejor; h = mejor.scrollHeight; }
  }
  return { h, scroller };
})()`;

/** Lo que se lee para el manifiesto: el titular (h1 visible o el texto más grande de arriba), idioma y un trozo del texto. */
const DATOS = `(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05; };
  const h1 = [...document.querySelectorAll('h1')].filter(vis).map((e) => e.innerText.replace(/\\s+/g, ' ').trim()).filter(Boolean).slice(0, 3);
  const grandes = [];
  for (const el of document.querySelectorAll('h1,h2,h3,p,span,div,a,strong,b')) {
    const propio = [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join(' ').replace(/\\s+/g, ' ').trim();
    if (propio.length < 6) continue;
    const r = el.getBoundingClientRect();
    if (r.top + scrollY > 1100 || !vis(el)) continue;
    grandes.push({ t: el.innerText.replace(/\\s+/g, ' ').trim().slice(0, 200), fs: parseFloat(getComputedStyle(el).fontSize), y: Math.round(r.top + scrollY) });
  }
  grandes.sort((a, b) => b.fs - a.fs);
  return { titulo: document.title, og: document.querySelector('meta[property="og:title"]')?.content ?? null, h1, grandes: grandes.slice(0, 6),
    lang: document.documentElement.lang, url: location.href, texto: (document.body?.innerText ?? '').replace(/\\n{2,}/g, '\\n').slice(0, 3500) };
})()`;

async function hojaParaMirar(png, id) {
  const meta = await sharp(png).metadata();
  const colAlto = 1500;
  const cols = Math.max(1, Math.ceil(meta.height / colAlto));
  const partes = [];
  for (let i = 0; i < cols; i++) {
    const top = i * colAlto;
    partes.push({ input: await sharp(png).extract({ left: 0, top, width: meta.width, height: Math.min(colAlto, meta.height - top) }).toBuffer(), left: i * (meta.width + 12), top: 0 });
  }
  fs.mkdirSync(path.join(VISTAS, 'vistas'), { recursive: true });
  await sharp({ create: { width: cols * (meta.width + 12) - 12, height: Math.min(colAlto, meta.height), channels: 3, background: '#ff00ff' } })
    .composite(partes).jpeg({ quality: 70 }).toFile(path.join(VISTAS, 'vistas', `${id}.jpg`));
}

// Un Chrome NUEVO por página, y la pestaña del frente (la que abre Chrome): con varias páginas en el mismo Chrome, o en una
// pestaña creada con `Target.createTarget` (queda de fondo), con poca RAM el renderer se colgaba y `Runtime.evaluate` no volvía.
/** Una página: abre, recorre, esconde lo que tapa y captura. Devuelve { estado: ok|bloqueada|lisa|error, png, alto, datos, motivo }. */
async function capturar(c) {
  const r = { id: c.id, url: c.url, estado: 'ok' };
  let oyente = null;
  try {
    await cerrarChrome();
    await abrirChrome();
    const { cdp, oyentes } = chrome;
    const { targetInfos } = await cdp('Target.getTargets');
    const pagina = targetInfos.find((t) => t.type === 'page');
    if (!pagina) throw new Error('Chrome sin pestaña');
    const { sessionId } = await cdp('Target.attachToTarget', { targetId: pagina.targetId, flatten: true });
    const s = (m, p, ms) => cdp(m, p, sessionId, ms);
    let cargo = false;
    oyente = (m) => {
      if (m.sessionId !== sessionId) return;
      if (m.method === 'Page.loadEventFired') cargo = true;
      if (m.method === 'Page.javascriptDialogOpening') s('Page.handleJavaScriptDialog', { accept: false }).catch(() => {});
    };
    oyentes.add(oyente);
    await s('Page.enable'); await s('Runtime.enable'); await s('Network.enable');
    await s('Network.setBlockedURLs', { urls: ['*pandavideo*', '*connect.facebook.net*', '*facebook.com/tr*', '*clarity.ms*', '*googletagmanager*', '*google-analytics*', '*hotjar*', '*/m.js*'] });
    await s('Emulation.setDeviceMetricsOverride', { width: ANCHO, height: ALTO, deviceScaleFactor: 1, mobile: false });
    await s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
    const nav = await s('Page.navigate', { url: c.url }, 40000);
    if (nav.errorText) throw new Error(`no abre: ${nav.errorText}`);
    for (let i = 0; i < 50 && !cargo; i++) await esperar(500);
    await esperar(c.espera ?? ESPERA);
    const ev = async (expr, ms) => {
      const t0 = Date.now();
      const v = (await s('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, ms)).result?.value;
      if (process.env.DEBUG_CAPTURA) console.log(`    ev ${Date.now() - t0} ms  ${expr.slice(0, 50).replace(/\s+/g, ' ')}`);
      return v;
    };
    const pre = (await ev(`document.title + '\\n' + (document.body?.innerText ?? '').slice(0, 1500)`)) ?? '';
    if (BLOQUEO.test(pre) && pre.length < 1400) { r.estado = 'bloqueada'; r.motivo = pre.replace(/\s+/g, ' ').slice(0, 160); }
    await ev(ESCONDER);
    let alt = await ev(ALTURA);
    const scrollA = (y) => (alt.scroller ? `window.__scroller.scrollTo(0, ${y})` : `window.scrollTo(0, ${y})`);
    for (let y = 0; y <= Math.min(alt.h, TOPE) + 600; y += 600) {
      await ev(scrollA(y)); await esperar(c.paso ?? 350);
      alt = { ...alt, h: (await ev(ALTURA)).h }; // cada paso: hay páginas que agregan secciones a medida que bajas
    }
    await ev(scrollA(0)); await esperar(1800);
    await ev(ESCONDER);
    alt = await ev(ALTURA);
    if (alt.scroller) {
      // la página scrollea por dentro: se suelta el contenedor para que la captura lo vea entero
      await ev(`(() => { let x = window.__scroller; while (x && x !== document.documentElement) { x.style.setProperty('height', 'auto', 'important'); x.style.setProperty('max-height', 'none', 'important'); x.style.setProperty('overflow', 'visible', 'important'); x = x.parentElement; } document.documentElement.style.setProperty('overflow', 'visible', 'important'); })()`);
      await esperar(800);
      alt = await ev(ALTURA);
    }
    r.datos = await ev(DATOS);
    r.altoPagina = alt.h;
    const alto = Math.min(Math.max(alt.h, ALTO), TOPE);
    try {
      if (TRAMOS || c.tramos) throw new Error('por tramos (pedido)');
      const shot = await s('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true, clip: { x: 0, y: 0, width: ANCHO, height: alto, scale: 0.5 } }, 60000);
      r.png = Buffer.from(shot.data, 'base64');
    } catch (e) {
      // se colgó (video o animación pesada): por TRAMOS de una ventana, escondiendo lo fijo después del primero
      r.porTramos = String(e.message ?? e);
      // ⚠️ el `clip` va en coordenadas del DOCUMENTO: con la página bajada, `y: 0` cae fuera de la ventana y sale gris
      const partes = [];
      for (let y = 0; y < alto; y += ALTO) {
        await ev(`window.scrollTo(0, ${y})`); await esperar(1100); // lo que aparece al entrar en vista necesita su segundo
        // del segundo en adelante, lo fijo (cabecera, chats) se esconde JUSTO antes de la foto: hay sitios que lo vuelven a montar al scrollear
        if (y > 0) await ev(OCULTAR_FIJOS);
        const sy = (await ev('Math.round(window.scrollY)')) ?? y; // al final de la página el navegador no baja más
        const t = await s('Page.captureScreenshot', { format: 'png', fromSurface: true, clip: { x: 0, y: sy, width: ANCHO, height: ALTO, scale: 0.5 } }, 30000);
        const desde = Math.round((y - sy) / 2);
        const alto2 = Math.min(ALTO / 2 - desde, Math.round(alto / 2) - y / 2);
        if (alto2 > 0) partes.push({ input: await sharp(Buffer.from(t.data, 'base64')).extract({ left: 0, top: desde, width: ANCHO / 2, height: alto2 }).toBuffer(), left: 0, top: y / 2 });
      }
      r.png = await sharp({ create: { width: ANCHO / 2, height: Math.round(alto / 2), channels: 3, background: '#ffffff' } }).composite(partes).png().toBuffer();
    }
    const st = await sharp(r.png).stats();
    const desvio = Math.max(...st.channels.slice(0, 3).map((x) => x.stdev));
    if (r.estado === 'ok' && desvio < 6) { r.estado = 'lisa'; r.motivo = 'la captura salió lisa (en blanco o negra)'; }
  } catch (e) {
    r.estado = 'error'; r.motivo = e instanceof Error ? e.message : String(e);
  } finally {
    if (oyente) chrome?.oyentes.delete(oyente);
    await cerrarChrome();
  }
  return r;
}

/** El titular tal cual: el h1 visible, o el texto más grande de arriba, o el título de la pestaña. */
const titularDe = (d) => d?.h1?.[0] ?? d?.grandes?.[0]?.t ?? d?.og ?? d?.titulo ?? '';
const idiomaDe = (d) => (/^es/i.test(d?.lang ?? '') || (!/^en/i.test(d?.lang ?? '') && (d?.texto ?? '').match(/\b(que|para|con|tu|los|las|una)\b/gi)?.length > 20) ? 'es' : 'en');

async function guardar(c, r) {
  const webp = await sharp(r.png).webp({ quality: 62 }).toBuffer();
  const meta = await sharp(webp).metadata();
  fs.mkdirSync(DESTINO, { recursive: true });
  fs.writeFileSync(path.join(DESTINO, `${c.id}.webp`), webp);
  return { alto: meta.height, kb: Math.round(webp.length / 1024) };
}

async function informe(c, r, extra = {}) {
  if (!VISTAS) return;
  fs.mkdirSync(path.join(VISTAS, 'resultados'), { recursive: true });
  const { png, ...sinPng } = r;
  fs.writeFileSync(path.join(VISTAS, 'resultados', `${c.id}.json`), JSON.stringify({ ...sinPng, ...extra }, null, 2));
  if (png) await hojaParaMirar(png, c.id);
}

// ── Main ─────────────────────────────────────────────────────────────────────
const manifiesto = leerManifiesto();
let tanda;
if (opcion('--lista')) {
  tanda = JSON.parse(fs.readFileSync(opcion('--lista'), 'utf8')).map((x) => ({ ...x, url: urlLimpia(x.url), soloImagen: true }));
} else if (opcion('--url')) {
  const url = urlLimpia(opcion('--url'));
  const ya = manifiesto.find((e) => clave(e.url) === clave(url));
  const usados = new Set(manifiesto.map((e) => e.id));
  tanda = [{ id: opcion('--id') ?? ya?.id ?? idNuevo({ url, fuente: 'documento' }, usados), url, fuente: ya?.fuente ?? 'documento', nombre: ya?.nombre ?? null }];
} else {
  const conocidas = new Set([...manifiesto.map((e) => clave(e.url)), ...urlsAfuera().map(clave)]);
  const candidatas = [...delDocumento(), ...(SIN_SPY ? [] : await deSpy())];
  const usados = new Set(manifiesto.map((e) => e.id));
  tanda = [];
  for (const x of candidatas) {
    const k = clave(x.url);
    if (conocidas.has(k)) continue;
    conocidas.add(k);
    if (esLinkEnBio(x.url)) {
      if (!SECO) sumarAfuera(urlLimpia(x.url), x.fuente, `link en la bio (${new URL(x.url).hostname}), no es una landing`);
      continue;
    }
    tanda.push({ ...x, url: urlLimpia(x.url), id: idNuevo(x, usados) });
  }
}

console.log(`${tanda.length} para capturar${SECO ? ' (en seco: no se abre nada)' : ''}`);
for (const c of tanda) console.log(`  ${c.id}  ${c.url}`);
if (SECO || !tanda.length) process.exit(0);

let bien = 0;
try {
  for (const c of tanda) {
    let r = await capturar(c);
    if (r.estado === 'error') { console.log(`  … ${c.id}: ${r.motivo}; otra vez`); r = await capturar(c); }
    if (r.estado !== 'ok') {
      console.log(`✗ ${c.id}  ${c.url}  [${r.estado}] ${r.motivo ?? ''}`);
      await informe(c, r);
      if (!c.soloImagen && r.estado === 'bloqueada') sumarAfuera(c.url, c.fuente, `bloqueada por una verificación anti-robots («${r.motivo.slice(0, 60)}»); no se evade`);
      if (!c.soloImagen && r.estado === 'lisa') sumarAfuera(c.url, c.fuente, r.motivo);
      continue;
    }
    const { alto, kb } = await guardar(c, r);
    await informe(c, r, { alto, kb });
    bien++;
    console.log(`✓ ${c.id}  ${alto} px  ${kb} KB  «${titularDe(r.datos).slice(0, 70)}»`);
    if (c.soloImagen) continue;
    const lista = leerManifiesto();
    const i = lista.findIndex((e) => e.id === c.id || clave(e.url) === clave(c.url));
    if (i >= 0) Object.assign(lista[i], { alto, kb });
    else lista.push({
      id: c.id, url: c.url, fuente: c.fuente, nombre: c.nombre ?? new URL(c.url).hostname.replace(/^www\./, ''), nicho: '', tipo: 'sitio',
      idioma: idiomaDe(r.datos), titulo: titularDe(r.datos), porque: '', alto, kb, revisar: true,
    });
    fs.mkdirSync(path.dirname(MANIFIESTO), { recursive: true });
    fs.writeFileSync(MANIFIESTO, `${JSON.stringify(lista, null, 2)}\n`);
  }
} finally {
  await cerrarChrome();
}
console.log(`${bien} de ${tanda.length} capturadas en ${path.relative(RAIZ, DESTINO)}${tanda.some((c) => !c.soloImagen) ? '; las nuevas quedan con "revisar": true (ver la cabecera)' : ''}`);
