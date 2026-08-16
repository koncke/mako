// Baja un curso de HOTMART CLUB desde el plan.json que armó hotmart-plan.mjs.
//
// ── Por qué no alcanza curso-bajar.mjs ───────────────────────────────────────
// yt-dlp NO tiene extractor de Hotmart, así que no hay una URL que se le pueda pasar
// directo. Hay que llegar al `.m3u8` a mano, y recién ahí yt-dlp lo baja como HLS
// común. Los tres saltos, ninguno adivinado (ver hotmart-plan.mjs):
//
//   /v1/lesson/<hash>  →  mediaSrcUrl (embed firmado, JWT de ~24 h)
//   embed + Referer    →  master .m3u8 en vod-akm.play.hotmart.com
//   yt-dlp + Referer   →  el archivo
//
// ⚠️ EL TOKEN DEL MASTER DURA ~500 SEGUNDOS. Por eso se resuelve UNA clase por vez y
//    se baja en el momento: resolver las 62 primero y bajar después significa que las
//    últimas cincuenta empiezan con la URL ya vencida. Es la misma razón por la que el
//    plan guarda el `hash` y nunca una URL firmada.
//
// ⚠️ El embed exige Referer de hotmart.com. Sin él responde 401 — mismo mecanismo que
//    la restricción por dominio de Vimeo en cursoselite. Se inyecta con CDP para la
//    captura, y se le pasa a yt-dlp con --referer para la descarga.
//
// ⚠️ DRM: si aparece un `.mpd` o un license server, se FRENA y se avisa, sin bajar
//    nada. Hoy no aplica (el JWT declara `playDrm:false` y la red muestra solo HLS),
//    pero la guarda va igual: es la regla escrita para cualquier curso.
//
//   node <abs>\scripts\hotmart-bajar.mjs --plan C:\cursos\creator-club\plan.json
//   node <abs>\scripts\hotmart-bajar.mjs --plan … --solo 3,7,12

import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PLAN = arg('plan', '');
const PORT = Number(arg('port', 9333));
const SOLO = arg('solo', '');
const FFDIR = arg('ffmpeg', join(process.env.LOCALAPPDATA ?? '', 'ffmpeg-full', 'ffmpeg-master-latest-win64-gpl', 'bin'));
const ESPERA = Number(arg('espera', 22));   // segundos que se le dan al player por clase

if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }
const plan = JSON.parse(readFileSync(PLAN, 'utf8').replace(/^\uFEFF/, ''));
if (plan.fuente !== 'hotmart:club') {
  console.error(`\n  ✖ Este plan no es de Hotmart (fuente: ${plan.fuente}). Usá curso-bajar.mjs.\n`);
  process.exit(1);
}
const base = dirname(PLAN);
const dirVideo = join(base, 'video');
mkdirSync(dirVideo, { recursive: true });

const resolverYtdlp = () => {
  for (const c of ['yt-dlp', 'yt-dlp.exe']) {
    const p = spawnSync(c, ['--version'], { encoding: 'utf8' });
    if (p.status === 0) return { cmd: c, pre: [], version: p.stdout.trim() };
  }
  for (const py of ['python', 'py']) {
    const p = spawnSync(py, ['-m', 'yt_dlp', '--version'], { encoding: 'utf8' });
    if (p.status === 0) return { cmd: py, pre: ['-m', 'yt_dlp'], version: p.stdout.trim() };
  }
  return null;
};
const yt = resolverYtdlp();
if (!yt) { console.error('\n  ✖ No encuentro yt-dlp (python -m pip install -U yt-dlp)\n'); process.exit(1); }

// ── CDP ──────────────────────────────────────────────────────────────────────
const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const club = tabs.find((t) => t.type === 'page' && new RegExp(`club/${plan.club.slug}`, 'i').test(t.url));
if (!club) {
  console.error(`\n  ✖ No hay pestaña abierta en el club «${plan.club.slug}».`);
  console.error('    Abrila en el Chrome dedicado y reintentá.\n');
  process.exit(1);
}

const conectar = async (wsUrl) => {
  const s = new WebSocket(wsUrl);
  await new Promise((res, rej) => { s.onopen = res; s.onerror = () => rej(new Error('CDP no conecta')); });
  let id = 0; const pend = new Map(); const oyentes = [];
  s.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); return; }
    for (const f of oyentes) f(d);
  };
  return {
    cmd: (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); s.send(JSON.stringify({ id: i, method, params })); }),
    oye: (f) => oyentes.push(f),
    cerrar: () => s.close(),
  };
};

const C = await conectar(club.webSocketDebuggerUrl);
const evClub = async (e) => (await C.cmd('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value;

// Los headers de la app, releídos de una request real (no se guardan en disco).
let H = null;
C.oye((d) => {
  if (d.method === 'Network.requestWillBeSent' && /\/v1\/(navigation|lesson)/.test(d.params.request.url) && !H) {
    H = Object.fromEntries(Object.entries(d.params.request.headers).filter(([k]) => /^(authorization|x-hot-club-http|x-product-id)$/i.test(k)));
  }
});
console.log('\n  Leyendo los headers de la app…');
await C.cmd('Network.enable');
await C.cmd('Page.reload', { ignoreCache: true });
for (let i = 0; i < 30 && !H; i++) await new Promise((r) => setTimeout(r, 1000));
console.log(H ? `  Headers: ${Object.keys(H).join(', ')}` : '  (sin headers)');
if (!H) { console.error('\n  ✖ No pude leer los headers de la app. Recargá la pestaña del club y reintentá.\n'); process.exit(1); }

const GW = 'https://api-club-course-consumption-gateway-ga.cb.hotmart.com';
const embedDe = async (hash) => evClub(`(async () => {
  const r = await fetch('${GW}/v1/lesson/${hash}', { headers: ${JSON.stringify(H)}, credentials: 'include' });
  if (!r.ok) return null;
  const j = await r.json();
  const m = (j.mediasSrc || []).find(x => x.mediaType === 'VIDEO');
  return m ? m.mediaSrcUrl : null;
})()`);

// Pestaña dedicada al player, con el Referer inyectado.
//
// ⚠️ NO se usa `PUT /json/new`: en este Chrome se cuelga sin devolver nada, y el script
// quedaba esperando para siempre ANTES de imprimir la primera línea — o sea, sin ningún
// síntoma que dijera dónde estaba trabado. Se reusa una pestaña de player ya abierta y,
// si no hay, se crea por CDP (`Target.createTarget`), que sí responde.
const listaAhora = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
let tPlayer = listaAhora.find((x) => x.type === 'page' && /cf-embed\.play\.hotmart|about:blank/.test(x.url));
if (!tPlayer) {
  const B = await conectar((await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl);
  await B.cmd('Target.createTarget', { url: 'about:blank' });
  B.cerrar();
  await new Promise((r) => setTimeout(r, 1500));
  const l2 = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  tPlayer = l2.find((x) => x.type === 'page' && /about:blank/.test(x.url));
}
if (!tPlayer) { console.error('\n  ✖ No pude conseguir una pestaña para el player\n'); process.exit(1); }
console.log(`  Player en: ${tPlayer.url.slice(0, 60)}`);
const P = await conectar(tPlayer.webSocketDebuggerUrl);
let capturadas = [];
P.oye((d) => { if (d.method === 'Network.requestWillBeSent') capturadas.push(d.params.request.url); });
await P.cmd('Network.enable');
await P.cmd('Network.setExtraHTTPHeaders', { headers: { Referer: plan.referer } });
const evPlayer = async (e) => (await P.cmd('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value;

const masterDe = async (embed) => {
  capturadas = [];
  await P.cmd('Page.navigate', { url: embed });
  await new Promise((r) => setTimeout(r, 6000));
  await evPlayer(`(() => { const v=document.querySelector('video'); if(v){v.muted=true; v.play().catch(()=>{});}
    document.querySelectorAll('button,[class*=play]').forEach(b=>{ try{b.click()}catch{} }); return 1; })()`);
  for (let i = 0; i < ESPERA && !capturadas.some((u) => /\.m3u8/i.test(u)); i++) await new Promise((r) => setTimeout(r, 1000));
  const mpd = capturadas.filter((u) => /\.mpd/i.test(u));
  const lic = capturadas.filter((u) => /widevine|playready|fairplay|\/license/i.test(u));
  if (mpd.length && lic.length) return { drm: true };
  // El MASTER, no una variante: yt-dlp elige la mejor calidad desde ahí.
  const master = capturadas.filter((u) => /\.m3u8/i.test(u)).find((u) => /master/i.test(u))
    ?? capturadas.find((u) => /\.m3u8/i.test(u));
  return { master: master ?? null };
};

// ── Bajar ────────────────────────────────────────────────────────────────────
let clases = (plan.clases ?? []).filter((c) => !c.sinFuente);
if (SOLO) { const n = new Set(SOLO.split(',').map((x) => Number(x.trim())).filter(Boolean)); clases = clases.filter((c) => n.has(c.n)); }

console.log(`\n  Curso  : ${plan.curso}`);
console.log(`  Clases : ${clases.length} con video  ·  yt-dlp ${yt.version}`);
console.log(`  ffmpeg : ${existsSync(join(FFDIR, 'ffmpeg.exe')) ? FFDIR : '⚠ no está en ' + FFDIR}`);
console.log(`  Destino: ${dirVideo}\n`);

let ok = 0; const fallidas = [];
for (const c of clases) {
  const destino = join(dirVideo, `${c.archivo}.mp4`);
  if (existsSync(destino) && statSync(destino).size > 1024) { console.log(`  = ${c.n}/${clases.length} ${c.titulo.slice(0, 50)} (ya estaba)`); ok++; continue; }

  console.log(`\n  ── ${c.n}/${clases.length} · ${c.titulo.slice(0, 58)} (${c.duracion}) ──`);
  const embed = await embedDe(c.hash);
  if (!embed) { console.log('     ✖ la API no devolvió el embed'); fallidas.push(c.n); continue; }

  const { master, drm } = await masterDe(embed);
  if (drm) {
    console.error('\n  ✖ DRM detectado (.mpd + license server). Freno acá y no bajo nada.');
    console.error('    Es la regla de la casa: contenido protegido no se descarga.\n');
    break;
  }
  if (!master) { console.log('     ✖ no capturé el manifiesto (probá --espera 40)'); fallidas.push(c.n); continue; }

  const args = [...yt.pre, master, '--referer', plan.referer, '-o', destino, '--no-part', '--quiet', '--progress',
    '--retries', '5', '--fragment-retries', '10'];
  if (existsSync(join(FFDIR, 'ffmpeg.exe'))) args.push('--ffmpeg-location', FFDIR);
  const r = spawnSync(yt.cmd, args, { stdio: 'inherit' });
  if (r.status === 0 && existsSync(destino)) {
    const mb = statSync(destino).size / 1048576;
    console.log(`     ✓ ${mb.toFixed(1)} MB`);
    ok++;
  } else { console.log('     ✖ yt-dlp falló'); fallidas.push(c.n); }
}

console.log(`\n  ${'─'.repeat(66)}`);
console.log(`  ${ok}/${clases.length} clases OK · ${fallidas.length} con error`);
if (fallidas.length) console.log(`  Reintentá con: --solo ${fallidas.join(',')}`);
C.cerrar(); P.cerrar();
