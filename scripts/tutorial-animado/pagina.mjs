// The gallery (an artifact): every video in public/tutoriales/manifiesto.json — the SAME 720p files the app serves — as cards
// grouped by the app's sections. A card plays right there when tapped, «Siguiente» goes to the next one (and it moves on by
// itself when one ends), and the script is folded under each card. Martín watches it on his phone: one column there.
//   node motor/pagina.mjs [key…]  → writes <scratchpad>/pub-tutoriales/index.html, videos/<key>.mp4 and posters/<key>.jpg
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
const RAIZ = 'C:/dev/tutoriales-video';
const MAN = JSON.parse(readFileSync(`${RAIZ}/public-tutoriales/manifiesto.json`, 'utf8'));
const SOLO = process.argv.slice(2);
const G = JSON.parse(readFileSync(`${RAIZ}/guiones.json`, 'utf8'));
// where it is published FROM: the scratchpad of the session that publishes (19/11: an artifact is the account's that publishes it; the
// gallery of claude2 does not open from claude5, so each account publishes its own). PUB=<dir> node motor/pagina.mjs
const PUB = process.env.PUB || 'C:/Users/marti/AppData/Local/Temp/claude/fb1d94a1aca5ced3/d2ccfb79-8556-4d00-a688-f5e3244f614b/scratchpad/pub-tutoriales';
mkdirSync(`${PUB}/videos`, { recursive: true }); mkdirSync(`${PUB}/posters`, { recursive: true });

// the groups follow the app's side menu (app/_components/nav.ts): Today, Sales, Marketing, Create; Classroom lives in Sales but
// has six videos of its own; the rest is in the menu of your photo
const GRUPOS = [
  { id: 'onboarding', nombre: 'Onboarding', bajada: 'Lo primero que ve cada cliente, en este orden', keys: ['onboarding-bienvenida', 'onboarding-whatsapp', 'onboarding-seguir-pc', 'recorrido', 'offer-coach', 'funnel-coach'] },
  { id: 'clases', nombre: 'Clases', bajada: 'La de la oferta (después de armarla) y una por funnel (al elegirlo)', keys: ['offer-coach-clase', 'funnel-clase-anuncios', 'funnel-clase-organico', 'funnel-clase-youtube', 'funnel-clase-anuncios-a-whatsapp', 'funnel-clase-anuncios-a-vsl', 'funnel-clase-prospeccion-en-frio'] },
  { id: 'reto', nombre: 'Reto de 7 días', bajada: 'Un video arriba de cada día, en el chat del reto', keys: ['reto-dia-1', 'reto-dia-2', 'reto-dia-3', 'reto-dia-4', 'reto-dia-5', 'reto-dia-6', 'reto-dia-7'] },
  { id: 'today', nombre: 'Today', keys: ['ops-center', 'ticketera', 'plan', 'chats', 'dashboard'] },
  { id: 'sales', nombre: 'Sales', keys: ['crm', 'calendar', 'automations'] },
  { id: 'classroom', nombre: 'Classroom', bajada: 'Curso, comunidad y clientes', keys: ['classroom', 'classroom-community', 'classroom-clients', 'classroom-calendar', 'classroom-leaderboards', 'classroom-about'] },
  { id: 'marketing', nombre: 'Marketing', keys: ['offer', 'copilot', 'spy'] },
  { id: 'create', nombre: 'Create', keys: ['copywriting', 'web', 'avatar', 'video', 'image'] },
  { id: 'configuracion', nombre: 'Configuración', keys: ['settings', 'settings-integraciones', 'settings-seguridad', 'settings-notificaciones', 'settings-instalar', 'settings-equipo', 'settings-fiscal', 'settings-plan'] },
  { id: 'cuenta', nombre: 'Cuenta y soporte', keys: ['partners', 'agency', 'api', 'report-problem'] },
];
let videos = MAN.videos.filter((v) => v.formato === 4 && (!SOLO.length || SOLO.includes(v.key)));
const sinGrupo = videos.filter((v) => !GRUPOS.some((g) => g.keys.includes(v.key))).map((v) => v.key);
if (sinGrupo.length) GRUPOS.push({ id: 'otros', nombre: 'Otros', keys: sinGrupo });
const porKey = Object.fromEntries(videos.map((v) => [v.key, v]));
for (const v of videos) {
  copyFileSync(`${RAIZ}/public-tutoriales/${v.key}.mp4`, `${PUB}/videos/${v.key}.mp4`);
  copyFileSync(`${RAIZ}/public-tutoriales/${v.key}.jpg`, `${PUB}/posters/${v.key}.jpg`);
}
const guionDe = (k) => G.find((g) => g.id === k) || {};
const grupos = GRUPOS.map((g) => ({ ...g, items: g.keys.filter((k) => porKey[k]).map((k) => {
  const v = porKey[k], gu = guionDe(k);
  return { k, n: v.pestana, r: v.ruta, d: v.duracion_s, g: v.guion, pro: !!(v.solo_pro || gu.soloPro), reto: gu.tanda === 1 };
}) })).filter((g) => g.items.length);
const todos = grupos.flatMap((g) => g.items);
const total = todos.reduce((a, v) => a + v.d, 0);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (s) => { const m = Math.floor(s / 60), x = Math.round(s % 60); return m + ':' + String(x).padStart(2, '0'); };

const tarjeta = (it) => `
      <article class="card" id="t-${it.k}" data-k="${it.k}">
        <div class="media">
          <button class="poster" type="button" aria-label="Reproducir ${esc(it.n)}">
            <img src="posters/${it.k}.jpg" alt="" loading="lazy" width="1280" height="720">
            <span class="play"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>${fmt(it.d)}</span>
          </button>
        </div>
        <div class="info">
          <div class="fila"><h3>${esc(it.n)}</h3>${it.pro ? '<span class="tag tag--pro">Sólo Pro</span>' : ''}${it.reto ? '<span class="tag">Reto · días 1 a 3</span>' : ''}</div>
          <p class="ruta">${esc(it.r)}</p>
        </div>
        <div class="mando" hidden></div>
        <details><summary>Guion</summary><p>${esc(it.g)}</p></details>
      </article>`;

const html = `<title>Tutoriales de MaKo</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
/* Layout: a gallery of the 35 posters, grouped like the app's side menu; the tapped card plays in place (one column on the
   phone, two from tablet up so the video stays big enough to watch). Same type and blue as the videos. */
:root {
  --bg:#F2F3F5; --surface:#FFFFFF; --ink:#15171C; --muted:#5B606B; --line:#DFE2E8;
  --blue:#2F6FED; --blue-soft:#E8EFFD; --gold:#B87708; --scrim:rgba(12,14,18,.74); --on-scrim:#FFFFFF;
  --sans:'Geist',system-ui,-apple-system,'Segoe UI',sans-serif; --mono:'Geist Mono',ui-monospace,Consolas,monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg:#0F1115; --surface:#181B21; --ink:#F2F3F5; --muted:#A0A6B2; --line:#2A2F38; --blue:#6E9DFF; --blue-soft:#1B2540; --gold:#F2B33D; color-scheme:dark; } }
:root[data-theme="dark"] { --bg:#0F1115; --surface:#181B21; --ink:#F2F3F5; --muted:#A0A6B2; --line:#2A2F38; --blue:#6E9DFF; --blue-soft:#1B2540; --gold:#F2B33D; color-scheme:dark; }
body { background:var(--bg); color:var(--ink); font-family:var(--sans); font-size:16px; line-height:1.5; }
body::before { content:""; position:fixed; inset:0 0 auto; height:env(safe-area-inset-top, 0px); z-index:10; background:var(--bg); }
.wrap { max-width:1200px; margin:0 auto; padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px)); padding-block:28px 64px; display:grid; gap:28px; }
.wrap > * { min-width:0; }
header { display:grid; gap:10px; }
h1 { font-weight:800; letter-spacing:-0.025em; font-size:clamp(28px,5vw,44px); line-height:1.05; margin:0; text-wrap:balance; }
.sub { color:var(--muted); margin:0; max-width:62ch; }
.acciones { display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
.btn { font:inherit; font-weight:600; font-size:15px; border-radius:999px; padding:9px 16px; cursor:pointer; border:1px solid var(--line); background:var(--surface); color:var(--ink); display:inline-flex; align-items:center; gap:8px; }
.btn--azul { background:var(--blue); border-color:var(--blue); color:#FFFFFF; }
.btn:hover { border-color:var(--blue); }
.btn:focus-visible, .poster:focus-visible, .indice a:focus-visible, summary:focus-visible { outline:2px solid var(--blue); outline-offset:2px; }
.indice { position:sticky; top:env(safe-area-inset-top, 0px); z-index:5; background:var(--bg); margin-inline:calc(-1 * max(16px, env(safe-area-inset-left, 0px))); padding:10px max(16px, env(safe-area-inset-left, 0px)); border-bottom:1px solid var(--line); }
.indice ul { list-style:none; margin:0; padding:0; display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; }
.indice ul::-webkit-scrollbar { display:none; }
.indice a { display:block; white-space:nowrap; text-decoration:none; color:var(--ink); font-size:14px; font-weight:600; padding:6px 12px; border-radius:999px; background:var(--surface); border:1px solid var(--line); }
.indice a span { font-family:var(--mono); font-weight:400; color:var(--muted); margin-left:6px; font-size:12.5px; }
section.grupo { display:grid; gap:14px; scroll-margin-top:72px; }
.grupo-cab { display:flex; flex-wrap:wrap; align-items:baseline; gap:4px 12px; }
.grupo-cab h2 { margin:0; font-size:24px; font-weight:800; letter-spacing:-0.015em; }
.grupo-cab p { margin:0; color:var(--muted); font-size:14.5px; }
.grupo-cab .cuenta { font-family:var(--mono); font-size:13px; color:var(--muted); font-variant-numeric:tabular-nums; }
.grid { display:grid; grid-template-columns:minmax(0,1fr); gap:18px; }
@media (min-width:720px) { .grid { grid-template-columns:repeat(2, minmax(0,1fr)); } }
.card { background:var(--surface); border:1px solid var(--line); border-radius:16px; overflow:hidden; display:grid; align-content:start; min-width:0; scroll-margin-top:72px; transition:border-color .2s, box-shadow .2s; }
.card.activa { border-color:var(--blue); box-shadow:0 0 0 3px var(--blue-soft); }
.media { position:relative; aspect-ratio:16/9; max-width:100%; background:#000; }
.poster { all:unset; position:absolute; inset:0; cursor:pointer; display:block; }
.poster img { width:100%; height:100%; object-fit:cover; display:block; }
/* play + duration in one pill at the bottom right: the hook sentence of the poster stays readable */
.play { position:absolute; right:10px; bottom:10px; display:inline-flex; align-items:center; gap:6px; padding:6px 12px 6px 10px; border-radius:999px; background:var(--blue); color:#FFFFFF; font-family:var(--mono); font-size:13px; font-weight:500; font-variant-numeric:tabular-nums; box-shadow:0 4px 14px rgba(20,40,90,.28); transition:transform .18s ease; }
.poster:hover .play { transform:scale(1.06); }
.media video { position:absolute; inset:0; width:100%; height:100%; background:#000; display:block; }
.info { padding:12px 16px 4px; display:grid; gap:2px; min-width:0; }
.fila { display:flex; flex-wrap:wrap; align-items:center; gap:6px 10px; }
.info h3 { margin:0; font-size:18px; font-weight:700; letter-spacing:-0.01em; }
.ruta { margin:0; font-family:var(--mono); font-size:12.5px; color:var(--muted); overflow-wrap:anywhere; }
.tag { font-size:12px; font-weight:600; padding:2px 8px; border-radius:999px; background:var(--blue-soft); color:var(--blue); white-space:nowrap; }
.tag--pro { background:transparent; border:1px solid var(--gold); color:var(--gold); }
.mando { display:flex; flex-wrap:wrap; gap:8px; align-items:center; padding:8px 16px 2px; }
.mando .btn { font-size:14px; padding:7px 14px; }
.mando .sig { min-width:0; }
.mando .sig b { font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:22ch; }
.mando .aviso { font-size:14px; color:var(--muted); }
details { padding:4px 16px 14px; }
summary { cursor:pointer; color:var(--blue); font-weight:600; font-size:14.5px; width:max-content; padding:6px 0; }
details p { margin:4px 0 0; font-size:15px; color:var(--ink); max-width:65ch; }
@media (prefers-reduced-motion: reduce) { .play, .card { transition:none; } }
</style>
<div class="wrap">
  <header>
    <h1>Tutoriales de MaKo</h1>
    <p class="sub">${todos.length} videos, ${Math.round(total / 60)} minutos en total, con la voz de Martín. Toca uno para verlo ahí mismo; cuando termina, sigue el próximo.</p>
    <div class="acciones"><button class="btn btn--azul" type="button" id="todos"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>Reproducir todos</button></div>
  </header>
  <nav class="indice" aria-label="Secciones"><ul>${grupos.map((g) => `<li><a href="#g-${g.id}">${esc(g.nombre)}<span>${g.items.length}</span></a></li>`).join('')}</ul></nav>
${grupos.map((g) => `  <section class="grupo" id="g-${g.id}" aria-labelledby="h-${g.id}">
    <div class="grupo-cab"><h2 id="h-${g.id}">${esc(g.nombre)}</h2>${g.bajada ? `<p>${esc(g.bajada)}</p>` : ''}<span class="cuenta">${g.items.length} ${g.items.length === 1 ? 'video' : 'videos'} · ${fmt(g.items.reduce((a, v) => a + v.d, 0))}</span></div>
    <div class="grid">${g.items.map(tarjeta).join('')}
    </div>
  </section>`).join('\n')}
</div>
<script>
(function () {
  var ORDEN = ${JSON.stringify(todos.map((v) => ({ k: v.k, n: v.n })))};
  var v = document.createElement('video');
  v.controls = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'metadata';
  var actual = -1, cuenta = null, quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function card(i) { return document.getElementById('t-' + ORDEN[i].k); }
  function cortar() { if (cuenta) { clearInterval(cuenta); cuenta = null; } }
  function mando(i, terminado) {
    var m = card(i).querySelector('.mando'); m.hidden = false; m.innerHTML = '';
    if (i > 0) m.appendChild(boton('Anterior', function () { ir(i - 1, true); }));
    if (i < ORDEN.length - 1) {
      var b = boton('', function () { ir(i + 1, true); }); b.classList.add('btn--azul', 'sig');
      b.innerHTML = 'Siguiente:<b></b>'; b.querySelector('b').textContent = ORDEN[i + 1].n; m.appendChild(b);
      if (terminado) {
        var s = 4, aviso = document.createElement('span'); aviso.className = 'aviso'; aviso.setAttribute('aria-live', 'polite');
        aviso.textContent = 'Sigue en ' + s + ' s'; m.appendChild(aviso);
        m.appendChild(boton('Quedarme acá', function () { cortar(); aviso.remove(); this.remove(); }));
        cuenta = setInterval(function () { s--; if (s <= 0) { cortar(); ir(i + 1, true); } else aviso.textContent = 'Sigue en ' + s + ' s'; }, 1000);
      }
    } else if (terminado) { var fin = document.createElement('span'); fin.className = 'aviso'; fin.textContent = 'Fue el último.'; m.appendChild(fin); }
  }
  function boton(txt, fn) { var b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = txt; b.addEventListener('click', fn); return b; }
  function ir(i, jugar) {
    cortar(); if (i < 0 || i >= ORDEN.length) return;
    if (actual >= 0) { var a = card(actual); a.classList.remove('activa'); a.querySelector('.poster').hidden = false; a.querySelector('.mando').hidden = true; }
    actual = i; var c = card(i);
    c.classList.add('activa'); c.querySelector('.poster').hidden = true;
    v.poster = 'posters/' + ORDEN[i].k + '.jpg'; v.src = 'videos/' + ORDEN[i].k + '.mp4';
    c.querySelector('.media').appendChild(v); mando(i, false);
    if (jugar) { var p = v.play(); if (p && p.catch) p.catch(function () {}); c.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'center' }); }
    try { history.replaceState(null, '', '#t-' + ORDEN[i].k); } catch (e) {}
  }
  v.addEventListener('ended', function () { if (actual >= 0) mando(actual, true); });
  v.addEventListener('play', function () { if (cuenta && actual >= 0) { cortar(); mando(actual, false); } });
  ORDEN.forEach(function (o, i) { card(i).querySelector('.poster').addEventListener('click', function () { ir(i, true); }); });
  document.getElementById('todos').addEventListener('click', function () { ir(0, true); });
  var h = (location.hash || '').replace('#t-', ''), j = ORDEN.map(function (o) { return o.k; }).indexOf(h);
  if (j >= 0) { ir(j, false); card(j).scrollIntoView({ block: 'center' }); }
})();
</script>
`;
writeFileSync(`${PUB}/index.html`, html);
const files = {};
for (const v of videos) { files[`videos/${v.key}.mp4`] = `${PUB}/videos/${v.key}.mp4`; files[`posters/${v.key}.jpg`] = `${PUB}/posters/${v.key}.jpg`; }
writeFileSync(`${RAIZ}/_files.json`, JSON.stringify(files));
console.log('galería:', `${PUB}/index.html`, '·', todos.length, 'videos en', grupos.length, 'grupos ·', Math.round(total / 60), 'min');
