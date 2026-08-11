// Escucha por CDP lo que el player pide de verdad, y decide si se puede seguir.
//
// Contesta las dos unicas preguntas que importan antes de escribir un descargador:
//   1. Que hay abajo del player: HLS (.m3u8), MP4 directo, o DASH/DRM.
//   2. Con que headers lo pide (Referer + User-Agent), que es lo que suele faltar
//      en players embebidos y da 403 cuando le pasas la URL pelada a yt-dlp.
//
// Si encuentra DRM real (EME / requestMediaKeySystemAccess / un license server)
// FRENA con codigo 2. No hay camino que rodee eso y no se va a intentar.
//
// ⚠️ Lo que hace que esto funcione de verdad: Target.setAutoAttach con flatten.
// El player de un curso casi siempre vive en un iframe CROSS-ORIGIN, y un iframe
// cross-origin es un target aparte (OOPIF): Network.enable sobre la pagina de
// arriba NO ve sus requests. Sin auto-attach este script reporta "no capture
// nada" con el player funcionando delante — el peor de los falsos negativos.
//
// Sin dependencias: usa el WebSocket nativo de Node 22+ (aca hay v24).
//
//   node scripts/curso-sniff.mjs                 # 30s de captura
//   node scripts/curso-sniff.mjs --segundos 60
//   node scripts/curso-sniff.mjs --tab cursoselite

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const PORT = Number(arg('port', 9333));
const SEGUNDOS = Number(arg('segundos', 30));
const FILTRO = arg('tab', '');
const RAIZ = arg('raiz', 'C:\\cursos');

// ── Como se reconoce cada plataforma por el trafico ────────────────────────────
const HOSTS = [
  [/iframe\.mediadelivery\.net|vz-[a-z0-9-]+\.b-cdn\.net/i, 'Bunny Stream'],
  [/b-vz-.*pandavideo|player.*pandavideo|pandavideo\.com/i, 'Panda Video'],
  [/player\.vimeo\.com|vimeocdn\.com|vod-progressive/i, 'Vimeo'],
  [/fast\.wistia\.(net|com)|embed-ssl\.wistia/i, 'Wistia'],
  [/cdn\.jwplayer\.com|content\.jwplatform\.com/i, 'JW Player'],
  [/stream\.mux\.com/i, 'Mux'],
  [/customer-[a-z0-9]+\.cloudflarestream\.com|videodelivery\.net/i, 'Cloudflare Stream'],
  [/youtube\.com\/embed|youtu\.be|googlevideo\.com/i, 'YouTube'],
  [/drive\.google\.com|googleusercontent\.com.*videoplayback/i, 'Google Drive'],
  [/hotmart|hls\.hotmart/i, 'Hotmart'],
  [/vdocipher/i, 'VdoCipher — DRM por diseño'],
  [/\.vhx\.tv|vimeo-ott/i, 'Vimeo OTT'],
  [/bunnycdn|b-cdn\.net/i, 'BunnyCDN (genérico)'],
];

const TIPOS = [
  [/licen[sc]e|widevine|playready|fairplay|\/wv\/|certificate/i, 'LICENCIA'],
  [/\.m3u8(\?|$)/i, 'HLS'],
  [/\.mpd(\?|$)/i, 'DASH'],
  [/\.mp4(\?|$)/i, 'MP4'],
  [/\.(ts|m4s|m4a)(\?|$)/i, 'SEGMENTO'],
];

const clasificar = (url, tabla) => tabla.find(([re]) => re.test(url))?.[1] ?? null;

// ── Hook de EME: la unica deteccion de DRM que no se puede falsear ─────────────
// Se instala ANTES de que cargue el documento (y en cada iframe), asi que agarra
// al player en su primer intento. Un .mpd sin esto puede ser DASH en claro.
const HOOK_DRM = `
(() => {
  if (window.__drm) return;
  window.__drm = { eme: [], sesiones: [] };
  const rq = navigator.requestMediaKeySystemAccess;
  if (rq) navigator.requestMediaKeySystemAccess = function (ks) {
    try { window.__drm.eme.push(String(ks)); } catch (e) {}
    return rq.apply(this, arguments);
  };
  if (window.MediaKeySession && MediaKeySession.prototype.generateRequest) {
    const g = MediaKeySession.prototype.generateRequest;
    MediaKeySession.prototype.generateRequest = function (tipo) {
      try { window.__drm.sesiones.push(String(tipo)); } catch (e) {}
      return g.apply(this, arguments);
    };
  }
})();
`;

// ── CDP minimo sobre WebSocket, con soporte de sesiones (flatten) ─────────────
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pend = new Map();
    this.oye = [];
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pend.has(m.id)) {
        const { ok, no } = this.pend.get(m.id);
        this.pend.delete(m.id);
        m.error ? no(new Error(m.error.message)) : ok(m.result);
      } else if (m.method) {
        for (const f of this.oye) f(m);
      }
    });
  }
  enviar(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    return new Promise((ok, no) => {
      this.pend.set(id, { ok, no });
      setTimeout(() => this.pend.has(id) && (this.pend.delete(id), no(new Error(`timeout ${method}`))), 15000);
    });
  }
  al(f) { this.oye.push(f); }
}

const main = async () => {
  let lista;
  try {
    lista = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
  } catch {
    console.error(`\n  ✖ No hay CDP en 127.0.0.1:${PORT}.`);
    console.error(`    Corré primero:  powershell -File scripts/curso-perfil.ps1\n`);
    process.exit(1);
  }

  const paginas = lista.filter((t) => t.type === 'page' && !t.url.startsWith('devtools://'));
  const objetivo = FILTRO
    ? paginas.find((t) => t.url.includes(FILTRO) || (t.title || '').includes(FILTRO))
    : paginas.find((t) => t.url !== 'about:blank') ?? paginas[0];

  if (!objetivo) {
    console.error('  ✖ No hay ninguna pestaña abierta en ese Chrome.');
    process.exit(1);
  }

  console.log(`\n  Pestaña : ${objetivo.title || '(sin título)'}`);
  console.log(`  URL     : ${objetivo.url}\n`);

  const ws = new WebSocket(objetivo.webSocketDebuggerUrl);
  await new Promise((ok, no) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', () => no(new Error('no pude conectar al WebSocket de CDP')), { once: true });
  });
  const cdp = new Cdp(ws);

  const pedidos = new Map(); // url -> { tipo, plataforma, referer, status, mime }
  const sesiones = new Set(); // sessionIds de iframes/targets hijos
  const origenes = new Set(); // de que documento salio cada pedido

  // Configura un target (la pagina raiz o un iframe cross-origin) para que
  // reporte red y tenga el detector de DRM puesto antes de ejecutar nada.
  const preparar = async (sessionId) => {
    try {
      await cdp.enviar('Runtime.enable', {}, sessionId);
      await cdp.enviar('Network.enable', {}, sessionId);
      await cdp.enviar('Page.enable', {}, sessionId).catch(() => {});
      await cdp.enviar('Page.addScriptToEvaluateOnNewDocument', { source: HOOK_DRM }, sessionId).catch(() => {});
      // Recursivo: un iframe puede anidar otro iframe cross-origin.
      await cdp.enviar('Target.setAutoAttach', {
        autoAttach: true, waitForDebuggerOnStart: true, flatten: true,
      }, sessionId).catch(() => {});
    } catch { /* un target puede morir mientras lo configuramos */ }
  };

  cdp.al(async (m) => {
    if (m.method === 'Target.attachedToTarget') {
      const { sessionId, targetInfo } = m.params;
      sesiones.add(sessionId);
      if (targetInfo.url && targetInfo.url !== 'about:blank') {
        origenes.add(targetInfo.url);
        const p = clasificar(targetInfo.url, HOSTS);
        console.log(`  → iframe: ${p ? `[${p}] ` : ''}${targetInfo.url.slice(0, 110)}`);
      }
      await preparar(sessionId);
      // Estaba esperando al depurador por waitForDebuggerOnStart: soltarlo.
      await cdp.enviar('Runtime.runIfWaitingForDebugger', {}, sessionId).catch(() => {});
      return;
    }
    if (m.method === 'Target.detachedFromTarget') { sesiones.delete(m.params.sessionId); return; }

    if (m.method === 'Network.requestWillBeSent') {
      const { request } = m.params;
      const tipo = clasificar(request.url, TIPOS);
      if (!tipo) return;
      const previo = pedidos.get(request.url) ?? {};
      pedidos.set(request.url, {
        ...previo,
        tipo,
        plataforma: clasificar(request.url, HOSTS),
        referer: request.headers?.Referer ?? request.headers?.referer ?? previo.referer ?? null,
        metodo: request.method,
        documento: m.params.documentURL ?? previo.documento ?? null,
      });
      if (tipo !== 'SEGMENTO') {
        const p = pedidos.get(request.url);
        console.log(`  [${tipo}]${p.plataforma ? ` ${p.plataforma}` : ''} ${request.url.slice(0, 130)}`);
      }
    }
    if (m.method === 'Network.responseReceived') {
      const p = pedidos.get(m.params.response.url);
      if (p) { p.status = m.params.response.status; p.mime = m.params.response.mimeType; }
    }
  });

  // La pagina raiz primero, y auto-attach para agarrar los iframes del player.
  await preparar(undefined);

  const { result: ua } = await cdp.enviar('Runtime.evaluate', {
    expression: 'navigator.userAgent', returnByValue: true,
  });

  console.log('  Recargando con el detector de DRM puesto…');
  console.log(`  Dale PLAY a la lección. Capturando ${SEGUNDOS}s.\n`);
  await cdp.enviar('Page.reload', { ignoreCache: false });

  await new Promise((r) => setTimeout(r, SEGUNDOS * 1000));

  // El hook vive en cada documento: hay que preguntarle a TODOS, porque el
  // player (y por lo tanto el EME) casi nunca está en la página de arriba.
  const eme = { eme: [], sesiones: [] };
  for (const sid of [undefined, ...sesiones]) {
    try {
      const { result } = await cdp.enviar('Runtime.evaluate', {
        expression: 'JSON.stringify(window.__drm || {})', returnByValue: true,
      }, sid);
      const d = JSON.parse(result?.value || '{}');
      eme.eme.push(...(d.eme ?? []));
      eme.sesiones.push(...(d.sesiones ?? []));
    } catch { /* target cerrado o sin Runtime */ }
  }

  const todo = [...pedidos.entries()].map(([url, d]) => ({ url, ...d }));
  const licencias = todo.filter((p) => p.tipo === 'LICENCIA');
  const dash = todo.filter((p) => p.tipo === 'DASH');
  const hls = todo.filter((p) => p.tipo === 'HLS');
  const mp4 = todo.filter((p) => p.tipo === 'MP4');
  const segs = todo.filter((p) => p.tipo === 'SEGMENTO').length;

  const plataformas = [...new Set([
    ...todo.map((p) => p.plataforma),
    ...[...origenes].map((u) => clasificar(u, HOSTS)),
  ].filter(Boolean))];
  const hayDrm = eme.eme.length > 0 || eme.sesiones.length > 0 || licencias.length > 0;

  mkdirSync(RAIZ, { recursive: true });
  const salida = join(RAIZ, 'diagnostico.json');
  writeFileSync(salida, JSON.stringify({
    pagina: objetivo.url,
    userAgent: ua.value,
    plataformas,
    iframes: [...origenes],
    drm: { eme: [...new Set(eme.eme)], sesiones: eme.sesiones, licencias: licencias.map((l) => l.url) },
    hls: hls.map(({ url, referer, documento, status }) => ({ url, referer, documento, status })),
    dash: dash.map(({ url, referer, documento, status }) => ({ url, referer, documento, status })),
    mp4: mp4.map(({ url, referer, documento, status }) => ({ url, referer, documento, status })),
    segmentos: segs,
  }, null, 2), 'utf8');

  console.log('\n' + '─'.repeat(72));
  console.log(`  Plataforma : ${plataformas.join(', ') || '(no reconocida — mirá el JSON)'}`);
  console.log(`  User-Agent : ${ua.value}`);
  console.log(`  Targets    : ${sesiones.size} iframe(s) enganchado(s)`);
  console.log(`  Capturado  : ${hls.length} HLS · ${dash.length} DASH · ${mp4.length} MP4 · ${segs} segmentos`);
  console.log(`  Diagnóstico: ${salida}`);
  console.log('─'.repeat(72) + '\n');

  ws.close();

  if (hayDrm) {
    console.error('  ✖ HAY DRM. Acá se frena.\n');
    if (eme.eme.length) console.error(`    EME pedido: ${[...new Set(eme.eme)].join(', ')}`);
    if (eme.sesiones.length) console.error(`    Sesiones de licencia: ${eme.sesiones.length}`);
    for (const l of licencias.slice(0, 3)) console.error(`    Licencia: ${l.url.slice(0, 120)}`);
    console.error('\n    El contenido está protegido por una medida técnica. No hay');
    console.error('    configuración ni header que lo rodee, y no se va a intentar.\n');
    process.exit(2);
  }

  if (hls.length) {
    console.log('  ✓ HLS en claro. Camino: yt-dlp con las cookies del perfil dedicado.');
    console.log('    (un #EXT-X-KEY:METHOD=AES-128 acá NO es DRM: es HLS estándar, y el');
    console.log('     downloader nativo de yt-dlp lo descifra pidiendo la key con tus cookies)\n');
  } else if (mp4.length) {
    console.log('  ✓ MP4 progresivo. Es el caso más simple.\n');
  } else if (dash.length) {
    console.log('  ⚠ DASH sin señal de EME. Puede ser DASH en claro (yt-dlp lo maneja),');
    console.log('    pero repetí dándole play de verdad para confirmar.\n');
  } else {
    console.log('  ⚠ No se capturó ningún manifest ni video.');
    console.log('    Casi siempre es que no se le dio PLAY. Repetí con --segundos 60.');
    console.log(`    Si SÍ le diste play y ves ${sesiones.size} iframes enganchados, mandame`);
    console.log('    el diagnostico.json: el player usa un transporte que no está en la tabla.\n');
  }
};

main().catch((e) => { console.error(`\n  ✖ ${e.message}\n`); process.exit(1); });
