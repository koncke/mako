// Baja las imágenes de los documentos de Avatar Hype y las deja en
// public/cono-ugc/, para que la réplica no dependa de la sesión del origen.
//
// ⚠️ POR QUÉ NO SE PUEDEN LINKEAR: viven en `/api/doc-media/…`, detrás del login de
//    la academia. Un HTML copiado con esas rutas adentro se ve PERFECTO mientras vos
//    estás logueado allá y roto para todos los demás — el peor modo de falla posible,
//    porque el que lo publica es justamente el único que no lo ve.
//
// ⚠️ Y POR QUÉ SE BAJAN DESDE LA PÁGINA Y NO CON `fetch` DE NODE: la cookie de sesión
//    es del navegador. Es el mismo motivo por el que el plan se arma con CDP.
//
// ⚠️ PERO TAMPOCO SE PUEDEN PEDIR CON `fetch` DESDE LA PÁGINA. El origen las sirve
//    según el DESTINO de la request: un `<img src>` las devuelve (medido: 1152×2048),
//    y el MISMO string por `fetch()` —relativo o absoluto, con `credentials:'include'`—
//    da «TypeError: Failed to fetch». Los 107 archivos fallaron así, todos iguales, y
//    el error no dice nada: no es 401 ni 403, es la request que no llega a hacerse.
//
//    Por eso no se piden: se deja que la PÁGINA las cargue —que es lo que hace sola al
//    renderizar el documento— y se cosechan los bytes de la capa de red con
//    `Network.getResponseBody`. Son los bytes ORIGINALES: pasar por un <canvas> también
//    funcionaría para las imágenes, pero recodifica (y para un mp4 no sirve).
//
// El nombre en destino conserva el hash del origen (`<id>-<hash>.webp`): es estable,
// único, y permite reencontrar de dónde salió cada imagen sin guardar un mapa aparte.
//
//   node <abs>\scripts\avatarhype-media.mjs --plan C:\cursos\creativos-ugc-realistas\plan.json
//
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PLAN = arg('plan', '');
const PORT = Number(arg('port', 9333));
const REPO = arg('repo', 'C:\\Users\\marti\\OneDrive\\Escritorio\\dashboard-marketing-main\\dashboard-marketing');
const DESTINO = join(REPO, 'public', 'cono-ugc');
const BASE_ORIGEN = 'https://app.avatarhype.online';

if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }
const dirDocs = join(dirname(PLAN), 'docs');
if (!existsSync(dirDocs)) { console.error(`\n  ✖ No hay documentos capturados en ${dirDocs} (corré avatarhype-doc.mjs)\n`); process.exit(1); }
mkdirSync(DESTINO, { recursive: true });

const fichas = readdirSync(dirDocs).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dirDocs, f), 'utf8')));
const urls = [...new Set(fichas.flatMap((f) => [...(f.imagenes ?? []), ...(f.medios ?? [])]))]
  .filter((u) => u.startsWith('/api/doc-media/'));

console.log(`\n  fichas   : ${fichas.length}`);
console.log(`  a bajar  : ${urls.length} archivo(s)`);
console.log(`  destino  : ${DESTINO}\n`);

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const tab = tabs.find((t) => t.type === 'page' && /app\.avatarhype\.online/i.test(t.url));
if (!tab) { console.error('  ✖ No hay pestaña en app.avatarhype.online (corré scripts/curso-perfil.ps1)\n'); process.exit(1); }
const sock = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => { sock.onopen = res; sock.onerror = () => rej(new Error('CDP no conecta')); });
let id = 0; const pend = new Map();
sock.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } };
const cmd = (method, params = {}) => new Promise((r) => {
  const i = ++id;
  const t = setTimeout(() => { if (pend.has(i)) { pend.delete(i); console.error(`  ⚠ CDP sin respuesta: ${method}`); r(null); } }, 60000);
  pend.set(i, (res) => { clearTimeout(t); r(res); });
  sock.send(JSON.stringify({ id: i, method, params }));
});
const ev = async (e) => {
  const r = await cmd('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
  if (r?.exceptionDetails) return { __error: r.exceptionDetails.text ?? 'excepción' };
  return r?.result?.value;
};

// Las IMÁGENES van al repo (se muestran inline en el documento y pesan poco). Los
// .mp4 —los clips de ejemplo— van a Drive como las clases: se bajan a la carpeta del
// curso y de ahí los sube `curso-a-drive.mjs`.
const imagenes = urls.filter((u) => /\.(webp|jpe?g|png|gif|avif)$/i.test(u.split('?')[0]));
const videos = urls.filter((u) => !/\.(webp|jpe?g|png|gif|avif)$/i.test(u.split('?')[0]));
const dirClips = join(dirname(PLAN), 'doc-clips');
mkdirSync(dirClips, { recursive: true });
const pendientes = new Map(imagenes.map((u) => [basename(u.split('?')[0]), u]));
for (const n of [...pendientes.keys()]) {
  const dst = join(DESTINO, n);
  if (existsSync(dst) && statSync(dst).size > 0) pendientes.delete(n);
}
const saltadas = imagenes.length - pendientes.size;
console.log(`  imágenes: ${imagenes.length} (${saltadas} ya estaban) · videos del documento: ${videos.length} (NO van al repo)\n`);

// La cosecha: se escucha la red y se guarda el cuerpo de cada respuesta que sea una
// de las que faltan. `getResponseBody` hay que pedirlo al terminar la carga y antes
// de que el navegador desaloje el buffer, por eso va enganchado a loadingFinished.
let bajadas = 0, fallidas = 0;
const porRequest = new Map();
const guardadas = new Set();
// ⚠️ LOS CLIPS NO SE COSECHAN DE LA RED: se anota su URL FIRMADA y se bajan aparte.
// `getResponseBody` sobre un mp4 que el navegador reproduce en streaming devuelve un
// pedazo o nada. Pero el reproductor los pide a `…b-cdn.net/ugc-docs/<archivo>?token=`
// —la misma firma que las clases— y ESA sí se puede bajar desde node, sin sesión.
const firmadas = new Map();
sock.addEventListener('message', async (m) => {
  const d = JSON.parse(m.data);
  if (d.method === 'Network.requestWillBeSent') {
    const u = String(d.params.request.url);
    if (/b-cdn\.net\/.*\.(mp4|webm)/i.test(u)) firmadas.set(basename(u.split('?')[0]), u);
  }
  if (d.method === 'Network.responseReceived') {
    const n = basename(String(d.params.response.url).split('?')[0]);
    if (pendientes.has(n) && !guardadas.has(n)) porRequest.set(d.params.requestId, n);
  }
  if (d.method === 'Network.loadingFinished' && porRequest.has(d.params.requestId)) {
    const n = porRequest.get(d.params.requestId);
    porRequest.delete(d.params.requestId);
    if (guardadas.has(n)) return;
    const r = await cmd('Network.getResponseBody', { requestId: d.params.requestId });
    if (!r?.body) { return; }
    writeFileSync(join(DESTINO, n), Buffer.from(r.body, r.base64Encoded ? 'base64' : 'utf8'));
    guardadas.add(n);
    bajadas++;
    process.stdout.write(`\r  cosechadas… ${bajadas}/${pendientes.size}   `);
  }
});
await cmd('Network.enable');
// ⚠️ SIN CACHÉ, o las que el navegador ya tiene NO generan request y no hay nada que
//    cosechar. Es el punto ciego de este método: cuantas más veces se corre, MENOS
//    baja — al revés de lo que uno esperaría. La primera corrida dejó 5 afuera
//    justamente por eso, y el informe las contó como «fallidas» sin más explicación.
await cmd('Network.setCacheDisabled', { cacheDisabled: true });

// Se recorren TODAS las lecciones y, en cada una, TODAS sus tabs.
// ⚠️ Recorrer solo el Documento deja afuera las imágenes de «Biblioteca» y
//    «Recursos»: esos paneles no existen en el DOM hasta que se clickea su tab, así
//    que su media nunca se pide y el informe las cuenta como «fallidas» sin decir por
//    qué. Fueron 5 de 56, y las cinco vivían ahí.
for (const f of fichas) {
  await cmd('Emulation.setFocusEmulationEnabled', { enabled: true });
  await cmd('Page.navigate', { url: BASE_ORIGEN + f.ruta });
  for (let k = 0; k < 25; k++) {
    await new Promise((r) => setTimeout(r, 1000));
    if ((await ev(`!!document.querySelector('.ugc-paper') || !!document.querySelector('.ugc-vcard')`)) === true) break;
  }
  const tabsIds = await ev(`[...document.querySelectorAll('[role="tab"]')].map((t) => t.id)`);
  for (const t of tabsIds ?? []) {
    if (/feedback/i.test(t)) continue;
    await ev(`(() => { const b = document.getElementById(${JSON.stringify(t)}); if (b) b.click(); return true; })()`);
    await new Promise((r) => setTimeout(r, 800));
    await ev(`(async () => { for (let y = 0; y < 20; y++) { window.scrollBy(0, window.innerHeight); await new Promise(r => setTimeout(r, 200)); } window.scrollTo(0, 0); })()`);
    await new Promise((r) => setTimeout(r, 1200));
  }
}
process.stdout.write('\n');
fallidas = pendientes.size - guardadas.size;

// ── Los clips, con su URL firmada ────────────────────────────────────────────
let clips = 0, clipsFallados = 0;
if (firmadas.size) {
  console.log(`\n  clips con URL firmada capturada: ${firmadas.size} de ${videos.length}`);
  for (const [nombre, url] of firmadas) {
    const dst = join(dirClips, nombre);
    if (existsSync(dst) && statSync(dst).size > 0) { clips++; continue; }
    try {
      const r = await fetch(url, { headers: { Referer: 'https://app.avatarhype.online/' } });
      if (!r.ok) { console.log(`  ✖ ${nombre} — HTTP ${r.status}`); clipsFallados++; continue; }
      writeFileSync(dst, Buffer.from(await r.arrayBuffer()));
      clips++;
      process.stdout.write(`\r  clips… ${clips}/${firmadas.size}   `);
    } catch (e) { console.log(`  ✖ ${nombre} — ${e.message}`); clipsFallados++; }
  }
  process.stdout.write('\n');
}

const enDisco = readdirSync(DESTINO).filter((f) => !f.startsWith('.'));
const pesoMb = enDisco.reduce((t, f) => t + statSync(join(DESTINO, f)).size, 0) / 1048576;
const clipsEnDisco = existsSync(dirClips) ? readdirSync(dirClips) : [];
const clipsMb = clipsEnDisco.reduce((t, f) => t + statSync(join(dirClips, f)).size, 0) / 1048576;
console.log('\n' + '─'.repeat(70));
console.log(`  imágenes cosechadas: ${bajadas} · ya estaban: ${saltadas} · sin bajar: ${fallidas}`);
console.log(`  public/cono-ugc : ${enDisco.length}/${imagenes.length} archivo(s) · ${pesoMb.toFixed(1)} MB`);
console.log(`  doc-clips (Drive): ${clipsEnDisco.length}/${videos.length} archivo(s) · ${clipsMb.toFixed(1)} MB`);
if (fallidas) console.log(`  ⚠ ${fallidas} imagen(es) sin bajar: la réplica las mostraría rotas.`);
if (clipsFallados) console.log(`  ⚠ ${clipsFallados} clip(s) sin bajar.`);
console.log('─'.repeat(70));
sock.close();
