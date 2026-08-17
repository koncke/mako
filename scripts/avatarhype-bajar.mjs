// Baja un curso de AVATAR HYPE ACADEMY desde el plan.json que armó avatarhype-plan.mjs.
//
// ── Por qué esto es MUCHO más simple que hotmart-bajar.mjs ───────────────────
// Ahí había que resolver una URL firmada por clase, con un token de ~500 s, así que
// el navegador tenía que estar vivo durante toda la descarga. Acá no: el manifiesto
// de Bunny Stream se sirve SIN token —lo único que exige es el Referer— y el `guid`
// que guarda el plan es estable. Verificado el 2026-08-16 sobre varias clases:
//
//   https://<pullzone>.b-cdn.net/<guid>/playlist.m3u8   → 200 con Referer, 403 sin él
//
// O sea: **el navegador hace falta para ARMAR el plan, no para bajar.** Se puede
// cerrar el Chrome y esto sigue.
//
// ⚠️ El `?token=…&expires=…` que devuelve `/api/video/<id>` es del EMBED (dura 1 h),
//    no del manifiesto. No se guarda y no se usa acá: un plan con URLs firmadas nace
//    vencido.
//
// ⚠️ DRM: si el master trae `EXT-X-KEY` o aparece un `.mpd`, se FRENA y se avisa sin
//    bajar nada. Hoy no aplica —los 30 videos del curso UGC dan HLS en claro, hasta
//    1080p— pero la guarda va igual: es la regla escrita para cualquier curso.
//
//   node <abs>\scripts\avatarhype-bajar.mjs --plan C:\cursos\creativos-ugc-realistas\plan.json
//   node <abs>\scripts\avatarhype-bajar.mjs --plan … --solo 3,7,12
//
import { readFileSync, existsSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PLAN = arg('plan', '');
const SOLO = arg('solo', '');
// La pull zone de la librería 683445, medida. Es un argumento y no una constante
// escondida: si algún día la cambian, esto tiene que poder arreglarse sin tocar código
// — y sobre todo tiene que FALLAR RUIDOSO, que es lo que hace el chequeo de abajo.
const ZONA = arg('pullzone', 'vz-e3242c91-fe8');
const REFERER = 'https://iframe.mediadelivery.net/';
const FFDIR = arg('ffmpeg', join(process.env.LOCALAPPDATA ?? '', 'ffmpeg-full', 'ffmpeg-master-latest-win64-gpl', 'bin'));

if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }
const plan = JSON.parse(readFileSync(PLAN, 'utf8').replace(/^\uFEFF/, ''));
if (plan.fuente !== 'avatarhype:academy') {
  console.error(`\n  ✖ Este plan no es de AvatarHype (fuente: ${plan.fuente}).\n`);
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

const manifiesto = (guid) => `https://${ZONA}.b-cdn.net/${guid}/playlist.m3u8`;

const traerMaster = async (guid) => {
  const r = await fetch(manifiesto(guid), { headers: { Referer: REFERER } });
  if (!r.ok) return { error: r.status };
  return { texto: await r.text() };
};

const solo = SOLO ? new Set(SOLO.split(',').map((x) => Number(x.trim())).filter(Boolean)) : null;
const clases = plan.clases.filter((c) => c.guid && (!solo || solo.has(c.n)));
const sinGuid = plan.clases.filter((c) => !c.guid);

console.log(`\n  Curso   : ${plan.curso}`);
console.log(`  Clases  : ${clases.length}${solo ? ` (de ${plan.clases.length}, filtradas por --solo)` : ''}`);
console.log(`  yt-dlp  : ${yt.version}`);
console.log(`  Zona    : ${ZONA}.b-cdn.net`);
console.log(`  Referer : ${REFERER}`);
console.log(`  Destino : ${dirVideo}\n`);
if (sinGuid.length) console.log(`  ⚠ ${sinGuid.length} clase(s) sin guid en el plan: no se pueden bajar. Volvé a correr avatarhype-plan.mjs.\n`);

// ── Chequeo de puerta: la primera clase, ANTES de largar la descarga entera ───
// Si la pull zone está mal, TODAS fallan igual; verificarlo una vez cuesta un
// request y evita 30 errores idénticos que parecen un problema de red.
if (clases.length) {
  const m = await traerMaster(clases[0].guid);
  if (m.error) {
    console.error(`  ✖ El manifiesto de la primera clase da HTTP ${m.error}.`);
    console.error(`    URL: ${manifiesto(clases[0].guid)}`);
    console.error(`    Si da 403, el Referer cambió. Si da 404, la pull zone no es «${ZONA}»:`);
    console.error(`    sale de la URL que pide el reproductor (…b-cdn.net/<guid>/playlist.m3u8).\n`);
    process.exit(1);
  }
  console.log(`  ✓ Manifiesto accesible (${(m.texto.match(/RESOLUTION=(\d+x\d+)/g) ?? []).length} calidades)\n`);
}

const existente = (archivo) => {
  const f = join(dirVideo, `${archivo}.mp4`);
  return existsSync(f) ? statSync(f).size : 0;
};

let bajadas = 0, saltadas = 0, fallidas = 0;
for (const [i, c] of clases.entries()) {
  const etiqueta = `${String(i + 1).padStart(2, '0')}/${clases.length} · ${c.archivo}`;
  const ya = existente(c.archivo);
  // Idempotente: lo que ya está no se vuelve a bajar. Es lo que hace que un corte de
  // luz o un Ctrl-C cuesten una clase y no el curso.
  if (ya > 0) { console.log(`  ⏭  ${etiqueta} — ya está (${(ya / 1048576).toFixed(1)} MB)`); saltadas++; continue; }

  console.log(`\n  ── ${etiqueta} ──`);
  const m = await traerMaster(c.guid);
  if (m.error) { console.log(`  ✖ manifiesto HTTP ${m.error}`); fallidas++; continue; }

  // ⚠️ La guarda de DRM se corre POR CLASE, no una vez: un curso puede tener una
  //    lección protegida entre 29 abiertas, y descubrirlo al final es descubrirlo tarde.
  if (/EXT-X-KEY/i.test(m.texto)) {
    console.error(`  ⛔ El manifiesto declara EXT-X-KEY (cifrado). NO se baja y NO se sigue.`);
    console.error(`     Esto no estaba cuando se hizo el plan: revisá antes de tocar nada.\n`);
    process.exit(2);
  }

  const args = [
    ...yt.pre,
    '--referer', REFERER,
    '--ffmpeg-location', FFDIR,
    '-f', 'bv*+ba/b',
    '--no-warnings',
    '--newline',
    '-o', join(dirVideo, `${c.archivo}.mp4`),
    manifiesto(c.guid),
  ];
  const p = spawnSync(yt.cmd, args, { encoding: 'utf8', stdio: 'inherit' });
  if (p.status !== 0 || !existente(c.archivo)) { console.log(`  ✖ falló`); fallidas++; continue; }
  console.log(`  ✓ ${(existente(c.archivo) / 1048576).toFixed(1)} MB`);
  bajadas++;
}

console.log('\n' + '─'.repeat(70));
console.log(`  bajadas: ${bajadas} · ya estaban: ${saltadas} · fallidas: ${fallidas}`);
// Se compara contra el PLAN, no contra lo que se intentó: si el plan trae clases sin
// guid, «10 de 10 intentadas» suena a completo y no lo es.
const enDisco = readdirSync(dirVideo).filter((f) => /\.mp4$/i.test(f) && !/\.(f[^.]*|temp)\.mp4$/i.test(f)).length;
console.log(`  en disco: ${enDisco}/${plan.clases.length} clases del plan`);
if (enDisco < plan.clases.length) console.log(`  ⚠ Faltan ${plan.clases.length - enDisco}.`);
console.log('─'.repeat(70));
console.log(`\n  Siguiente:  node <abs>\\scripts\\curso-pipeline.mjs --plan "${PLAN}" --drive\n`);
