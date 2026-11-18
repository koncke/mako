// The review page (an artifact): every video in public/tutoriales/manifiesto.json — the SAME 720p files the app serves —
// with its script, duration and weight.
//   node motor/pagina.mjs  → writes <scratchpad>/pub-tutoriales/index.html and copies videos/<key>.mp4
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
const RAIZ = 'C:/dev/tutoriales-video';
const MAN = JSON.parse(readFileSync(`${RAIZ}/public-tutoriales/manifiesto.json`, 'utf8'));
const SOLO = process.argv.slice(2);                                      // only these keys (the ones already in the new form)
if (SOLO.length) MAN.videos = MAN.videos.filter((v) => SOLO.includes(v.key));
const G = JSON.parse(readFileSync(`${RAIZ}/guiones.json`, 'utf8'));
const PUB = 'C:/Users/marti/AppData/Local/Temp/claude/fb1d94a1aca5ced3/d2ccfb79-8556-4d00-a688-f5e3244f614b/scratchpad/pub-tutoriales';
mkdirSync(`${PUB}/videos`, { recursive: true });
for (const v of MAN.videos) copyFileSync(`${RAIZ}/public-tutoriales/${v.key}.mp4`, `${PUB}/videos/${v.key}.mp4`);
const tandaDe = (id) => (G.find((g) => g.id === id) || {}).tanda || 4;
const items = MAN.videos.map((v) => ({ ...v, id: v.key, tanda: tandaDe(v.key), marcados: (v.pantallas || []).filter((p) => p.marcado).length }));
const total = items.reduce((a, v) => a + v.duracion_s, 0);
const datos = JSON.stringify(items.map((v) => ({ id: v.id, pestana: v.pestana, ruta: v.ruta, dur: v.duracion_s, guion: v.guion, marcados: v.marcados, tanda: v.tanda, kb: v.peso_kb })));
const html = `<title>Tutoriales de MaKo</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
/* Layout: the player and its script on the left, the list of tabs on the right (stacked on the phone). */
:root { --bg:#F7F7F5; --surface:#FFFFFF; --ink:#171310; --muted:#5E5A55; --line:#E4E2DD; --blue:#2F6FED; --blue-soft:#EAF1FE; --gold:#E39A12;
  --sans:'Geist',system-ui,-apple-system,'Segoe UI',sans-serif; --mono:'Geist Mono',ui-monospace,Consolas,monospace; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#0E0E11; --surface:#17171C; --ink:#F3F2EF; --muted:#A3A09A; --line:#2A2A31; --blue:#6E9DFF; --blue-soft:#1A2440; --gold:#F2B33D; color-scheme:dark; } }
:root[data-theme="dark"] { --bg:#0E0E11; --surface:#17171C; --ink:#F3F2EF; --muted:#A3A09A; --line:#2A2A31; --blue:#6E9DFF; --blue-soft:#1A2440; --gold:#F2B33D; color-scheme:dark; }
body { background:var(--bg); color:var(--ink); font-family:var(--sans); font-size:16px; line-height:1.5; }
.wrap { max-width:1240px; margin:0 auto; padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px)); padding-block:28px 56px; display:grid; gap:20px; }
header { display:grid; gap:6px; }
h1 { font-weight:800; letter-spacing:-0.02em; font-size:clamp(26px,4vw,38px); line-height:1.1; margin:0; text-wrap:balance; }
.sub { color:var(--muted); max-width:72ch; margin:0; }
.grid { display:grid; grid-template-columns:minmax(0,1.8fr) minmax(0,1fr); gap:20px; align-items:start; }
.player { display:grid; gap:12px; min-width:0; position:sticky; top:12px; }
video { width:100%; aspect-ratio:16/9; display:block; background:#000; border-radius:12px; border:1px solid var(--line); }
.meta { display:flex; flex-wrap:wrap; gap:8px; align-items:baseline; }
.meta h2 { margin:0; font-size:22px; font-weight:800; letter-spacing:-0.01em; }
.chip { font-family:var(--mono); font-size:12px; padding:3px 9px; border-radius:999px; background:var(--surface); border:1px solid var(--line); color:var(--muted); }
.guion { background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:14px 16px; margin:0; font-size:15.5px; }
.lista { list-style:none; margin:0; padding:0; display:grid; gap:6px; min-width:0; }
.lista h3 { font-family:var(--mono); font-size:11.5px; letter-spacing:0.07em; text-transform:uppercase; color:var(--muted); font-weight:500; margin:10px 0 2px; }
.lista button { width:100%; display:flex; justify-content:space-between; gap:10px; align-items:center; text-align:left; font:inherit; color:var(--ink); background:var(--surface); border:1px solid var(--line); border-radius:10px; padding:10px 12px; cursor:pointer; }
.lista button:hover { border-color:var(--blue); }
.lista button:focus-visible { outline:2px solid var(--blue); outline-offset:2px; }
.lista button[aria-current="true"] { border-color:var(--blue); background:var(--blue-soft); }
.lista .d { font-family:var(--mono); font-size:12.5px; color:var(--muted); font-variant-numeric:tabular-nums; white-space:nowrap; }
.lista .n { font-weight:600; min-width:0; overflow-wrap:anywhere; }
.lista .r { display:block; font-family:var(--mono); font-size:11.5px; color:var(--muted); font-weight:400; }
@media (max-width:860px) { .grid { grid-template-columns:minmax(0,1fr); } .player { position:static; } }
</style>
<div class="wrap">
  <header>
    <h1>Tutoriales de MaKo</h1>
    <p class="sub">${items.length} videos, ${Math.round(total / 60)} min en total, en 720p: los mismos archivos que sirve la app (public/tutoriales). Texto al ritmo de la voz de Martín (su clon, ElevenLabs v4), la música baja, y cada «toca», «aquí» o «este» con la pestaña dibujada y lo que se toca marcado. Las pestañas sin dibujo van con texto y con dónde están.</p>
  </header>
  <div class="grid">
    <section class="player" aria-label="Video">
      <video id="v" controls playsinline preload="metadata"></video>
      <div class="meta"><h2 id="t"></h2><span class="chip" id="r"></span><span class="chip" id="du"></span><span class="chip" id="m"></span></div>
      <p class="guion" id="g"></p>
    </section>
    <nav aria-label="Pestañas"><ul class="lista" id="l"></ul></nav>
  </div>
</div>
<script>
var V = ${datos};
var TANDAS = { 1: 'Días 1 a 3 del reto', 2: 'Recorrido y Sales', 3: 'Marketing y Create', 4: 'Sin pestaña dibujada (sólo texto)' };
var l = document.getElementById('l'), v = document.getElementById('v'), tActual = null;
function fmt(s) { var m = Math.floor(s / 60), x = Math.round(s % 60); return m + ':' + (x < 10 ? '0' : '') + x; }
function elegir(id, jugar) {
  var it = V.filter(function (x) { return x.id === id; })[0] || V[0]; if (!it) return;
  v.src = 'videos/' + it.id + '.mp4#t=1.6'; if (jugar) v.play().catch(function () {});
  document.getElementById('t').textContent = it.pestana;
  document.getElementById('r').textContent = it.ruta;
  document.getElementById('du').textContent = fmt(it.dur) + (it.kb ? ' · ' + (it.kb / 1024).toFixed(2).replace('.', ',') + ' MB' : '');
  document.getElementById('m').textContent = it.marcados ? it.marcados + (it.marcados === 1 ? ' pantalla marcada' : ' pantallas marcadas') : 'sólo texto';
  document.getElementById('g').textContent = it.guion;
  [].forEach.call(l.querySelectorAll('button'), function (b) { b.setAttribute('aria-current', b.dataset.id === it.id ? 'true' : 'false'); });
  try { history.replaceState(null, '', '#' + it.id); } catch (e) {}
}
V.forEach(function (it) {
  if (it.tanda !== tActual) { tActual = it.tanda; var h = document.createElement('li'); h.innerHTML = '<h3>' + (TANDAS[it.tanda] || ('Tanda ' + it.tanda)) + '</h3>'; l.appendChild(h); }
  var li = document.createElement('li'), b = document.createElement('button');
  b.type = 'button'; b.dataset.id = it.id;
  b.innerHTML = '<span class="n"></span><span class="d">' + fmt(it.dur) + '</span>';
  b.querySelector('.n').textContent = it.pestana; var r = document.createElement('span'); r.className = 'r'; r.textContent = it.ruta; b.querySelector('.n').appendChild(r);
  b.addEventListener('click', function () { elegir(it.id, true); });
  li.appendChild(b); l.appendChild(li);
});
elegir((location.hash || '').slice(1), false);
</script>
`;
writeFileSync(`${PUB}/index.html`, html);
console.log('página:', `${PUB}/index.html`, '·', items.length, 'videos');
