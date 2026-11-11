// Mide la memoria del Chrome (sin ventana, muteado) mientras corre el código real del editor.
// Un Chrome nuevo por escenario. Se corta solo si la PC baja de 1.250 MB libres.
// Informe y números: docs/editor-video/memoria-del-editor.md.
//
// Uso (Windows): node scripts/banco-memoria-editor/armar.mjs
//                node scripts/banco-memoria-editor/medir.mjs [escenario ...]
// Los videos van en videos/ (no se versionan). Con ffmpeg:
//   testsrc2=s=1080x1920:r=30:d=60 + sine 48 kHz estéreo, noise=alls=12:allf=t, x264 10 Mb/s  -> v1080-60.mp4 (y d=30 -> v1080-30.mp4)
//   testsrc2=s=3840x2160:r=30:d=20, x264 30 Mb/s                                              -> v4k-20.mp4
//   copias livianas: scale=540:960 (p540-60.mp4) y scale=960:540 (p4k-20.mp4), x264 2 Mb/s
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '../..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const WEB = 8791, CDP = 9347;
const MINIMO_PARA_EMPEZAR = 1500, CORTE = 1250;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.mp4': 'video/mp4', '.wasm': 'application/wasm' };
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const f = p.startsWith('/ve/') ? path.join(raiz, 'public', p) : p.endsWith('.mp4') ? path.join(aqui, 'videos', p) : path.join(aqui, p);
  if (!f.startsWith(raiz) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': tipos[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
}).listen(WEB, '127.0.0.1');

const eventos = [];
function conectar(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const esperando = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') eventos.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') eventos.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
    if (m.id && esperando.has(m.id)) {
      const { ok, mal } = esperando.get(m.id);
      esperando.delete(m.id);
      m.error ? mal(new Error(m.error.message)) : ok(m.result);
    }
  };
  return new Promise((ok, mal) => {
    ws.onopen = () => ok({
      // Con tope: si Chrome se cae, la llamada no queda esperando para siempre.
      send: (method, params = {}, sessionId) => new Promise((ok2, mal2) => {
        const i = ++id;
        const tope = setTimeout(() => { esperando.delete(i); mal2(new Error(`${method}: sin respuesta en 300 s (¿se cayó Chrome?)`)); }, 300000);
        esperando.set(i, { ok: (v) => { clearTimeout(tope); ok2(v); }, mal: (e) => { clearTimeout(tope); mal2(e); } });
        ws.send(JSON.stringify({ id: i, method, params, sessionId }));
      }),
      cerrar: () => ws.close(),
    });
    ws.onerror = mal;
    ws.onclose = () => { for (const { mal: m } of esperando.values()) m(new Error('se cerró la conexión con Chrome')); esperando.clear(); };
  });
}

function libreAhora() {
  return new Promise((ok) => {
    const p = spawn('powershell', ['-NoProfile', '-Command', '[int]((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1KB)']);
    let s = '';
    p.stdout.on('data', (d) => (s += d));
    p.on('close', () => ok(Number(s.trim())));
  });
}

function matarArbol(pid) {
  return new Promise((ok) => {
    const p = spawn('powershell', ['-NoProfile', '-Command',
      `Get-CimInstance Win32_Process -Filter "ParentProcessId=${pid}" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue`]);
    p.on('close', ok);
  });
}

async function escenario(nombre, pasos) {
  for (let i = 0; i < 24; i++) {
    const libre = await libreAhora();
    if (libre >= MINIMO_PARA_EMPEZAR) break;
    if (i === 23) return { nombre, salteado: `sólo ${libre} MB libres` };
    await dormir(5000);
  }
  const perfil = path.join(aqui, 'perfiles', nombre);
  try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {}
  const chrome = spawn(CHROME, ['--headless=new', '--mute-audio', `--remote-debugging-port=${CDP}`, `--user-data-dir=${perfil}`,
    '--no-first-run', '--no-default-browser-check', '--enable-precise-memory-info', '--js-flags=--expose-gc', `http://127.0.0.1:${WEB}/`], { stdio: 'ignore' });
  const muestras = [];
  let pico = null, cortado = null;
  const muestreo = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(aqui, 'muestreo.ps1'), '-raiz', String(chrome.pid)]);
  let resto = '';
  muestreo.stdout.on('data', (d) => {
    resto += d;
    const lineas = resto.split(/\r?\n/);
    resto = lineas.pop();
    for (const l of lineas) {
      const [tot, ren, gpu, libre, pren, pgpu] = l.trim().split(/\s+/).map(Number);
      if (!Number.isFinite(tot)) continue;
      const m = { tot, ren, gpu, libre, pren, pgpu };
      muestras.push(m);
      if (pico && tot > pico.tot) Object.assign(pico, m);
      if (libre < CORTE && !cortado) { cortado = `la PC bajó a ${libre} MB libres`; matarArbol(chrome.pid); }
    }
  });
  let cayo = false;
  chrome.on('exit', () => { cayo = true; });
  const foto = async () => {
    const n = muestras.length;
    for (let i = 0; muestras.length < n + 3; i++) { if (cayo || i > 100) throw new Error('Chrome se cerró en plena medición'); await dormir(100); } const u = muestras.slice(-3); return { tot: Math.round(u.reduce((a, m) => a + m.tot, 0) / 3), ren: u[2].ren, gpu: u[2].gpu, pren: u[2].pren, pgpu: u[2].pgpu }; };
  const res = { nombre, fases: [] };
  try {
    let ver;
    for (let i = 0; i < 50 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${CDP}/json/version`)).json(); } catch { await dormir(200); } }
    const c = await conectar(ver.webSocketDebuggerUrl);
    const { targetInfos } = await c.send('Target.getTargets'); const { targetId } = targetInfos.find((t) => t.type === 'page');
    const { sessionId } = await c.send('Target.attachToTarget', { targetId, flatten: true });
    await c.send('Runtime.enable', {}, sessionId);
    await c.send('Page.reload', {}, sessionId).catch(() => {});
    const ev = async (expr) => {
      const r = await c.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    };
    for (let i = 0; i < 100 && !(await ev('window.listo === true')); i++) await dormir(100);
    const gc = () => c.send('HeapProfiler.collectGarbage', {}, sessionId).catch(() => {});
    await dormir(1500); await gc(); await dormir(500);
    const base = await foto();
    res.base = base;
    for (const [etiqueta, expr] of pasos) {
      if (cortado) break;
      pico = { ...base };
      const t0 = Date.now();
      const salida = await ev(expr);
      const durante = { ...pico };
      pico = null;
      const alTerminar = await foto();
      await gc(); await dormir(1500);
      const despues = await foto();
      const heap = await c.send('Runtime.getHeapUsage', {}, sessionId);
      res.fases.push({ etiqueta, ms: Date.now() - t0, salida, picoRenVida: alTerminar.pren - base.ren, picoGpuVida: alTerminar.pgpu - base.gpu, picoMB: durante.tot - base.tot,
        quedaMB: despues.tot - base.tot, quedaRen: despues.ren - base.ren, quedaGpu: despues.gpu - base.gpu, heapJsMB: Math.round(heap.usedSize / 1048576), libreMin: durante.libre });
    }
    await c.send('Browser.close').catch(() => {});
    c.cerrar();
  } catch (e) {
    res.error = String(e.message ?? e);
    res.consola = eventos.slice(0, 8);
  }
  await dormir(1000);
  await matarArbol(chrome.pid);
  muestreo.kill();
  if (cortado) res.cortado = cortado;
  return res;
}

const A1 = 'v1080-30.mp4', A2 = 'v1080-60.mp4', K = 'v4k-20.mp4';
const ESCENARIOS = [
  ['onda-30s', [['cargar 38 MB', `prueba.cargar('${A1}')`], ['forma de onda', `prueba.onda('${A1}')`]]],
  ['onda-60s', [['cargar 76 MB', `prueba.cargar('${A2}')`], ['forma de onda', `prueba.onda('${A2}')`]]],
  ['onda-igual-30s', [['cargar 38 MB', `prueba.cargar('${A1}')`], ['comparar con la de antes', `prueba.ondaComparar('${A1}')`]]],
  // DESPUÉS del lienzo por capa (compositor/lienzo-de-subida.ts): lo mismo que repro-1080-subida y repro-4k.
  ['subida-reusada-1080', [['cargar', `prueba.cargar('${A2}')`], ['reproducir 5 s con la subida de cada cuadro', `prueba.reproducir({nombres:['${A2}'],segundos:5,subir:'reusado'})`]]],
  ['subida-reusada-4k', [['cargar', `prueba.cargar('${K}')`], ['reproducir 5 s', `prueba.reproducir({nombres:['${K}'],segundos:5})`],
    ['con la subida de cada cuadro', `prueba.reproducir({nombres:['${K}'],segundos:5,subir:'reusado'})`]]],
  ['repro-1080', [['cargar', `prueba.cargar('${A2}')`], ['reproducir 5 s', `prueba.reproducir({nombres:['${A2}'],segundos:5})`],
    ['2º clip', `prueba.reproducir({nombres:['${A2}'],segundos:2})`], ['3º clip', `prueba.reproducir({nombres:['${A2}'],segundos:2})`]]],
  ['repro-1080-liviano', [['cargar', `prueba.cargar('${A2}')`], ['reproducir 5 s', `prueba.reproducir({nombres:['${A2}'],segundos:5,liviano:[540,960]})`],
    ['2º clip', `prueba.reproducir({nombres:['${A2}'],segundos:2,liviano:[540,960]})`], ['3º clip', `prueba.reproducir({nombres:['${A2}'],segundos:2,liviano:[540,960]})`]]],
  ['repro-1080-subida', [['cargar', `prueba.cargar('${A2}')`], ['reproducir 5 s con la subida de cada cuadro', `prueba.reproducir({nombres:['${A2}'],segundos:5,subir:true})`]]],
  ['repro-4k', [['cargar', `prueba.cargar('${K}')`], ['reproducir 5 s', `prueba.reproducir({nombres:['${K}'],segundos:5})`],
    ['con la subida de cada cuadro', `prueba.reproducir({nombres:['${K}'],segundos:5,subir:true})`]]],
  ['repro-4k-liviano', [['cargar', `prueba.cargar('${K}')`], ['reproducir 5 s', `prueba.reproducir({nombres:['${K}'],segundos:5,liviano:[960,540]})`],
    ['con la subida de cada cuadro', `prueba.reproducir({nombres:['${K}'],segundos:5,liviano:[960,540],subir:true})`]]],
  ['repro-proxy-1080', [['cargar', `prueba.cargar('p540-60.mp4')`], ['reproducir 5 s', `prueba.reproducir({nombres:['p540-60.mp4'],segundos:5})`],
    ['2º clip', `prueba.reproducir({nombres:['p540-60.mp4'],segundos:2})`], ['3º clip', `prueba.reproducir({nombres:['p540-60.mp4'],segundos:2})`]]],
  // DESPUÉS: la copia que arma el editor (media/copia-liviana.ts), con lo que cuesta armarla y si respeta los tiempos.
  ['copia-1080', [['cargar', `prueba.cargar('${A2}')`], ['armar la copia', `prueba.copia('${A2}')`],
    ['reproducir 5 s', `prueba.reproducir({nombres:['${A2}.liviana'],segundos:5})`],
    ['2º clip', `prueba.reproducir({nombres:['${A2}.liviana'],segundos:2})`], ['3º clip', `prueba.reproducir({nombres:['${A2}.liviana'],segundos:2})`]]],
  ['copia-4k', [['cargar', `prueba.cargar('${K}')`], ['armar la copia', `prueba.copia('${K}')`],
    ['reproducir 5 s', `prueba.reproducir({nombres:['${K}.liviana'],segundos:5})`],
    ['con la subida de cada cuadro', `prueba.reproducir({nombres:['${K}.liviana'],segundos:5,subir:true})`]]],
  ['repro-proxy-4k', [['cargar', `prueba.cargar('p4k-20.mp4')`], ['reproducir 5 s', `prueba.reproducir({nombres:['p4k-20.mp4'],segundos:5})`],
    ['con la subida de cada cuadro', `prueba.reproducir({nombres:['p4k-20.mp4'],segundos:5,subir:true})`]]],
];

const solo = process.argv.slice(2);
const todos = [];
for (const [nombre, pasos] of ESCENARIOS) {
  if (solo.length && !solo.includes(nombre)) continue;
  const r = await escenario(nombre, pasos);
  todos.push(r);
  console.log(JSON.stringify(r));
}
fs.writeFileSync(path.join(aqui, `resultado-${new Date().toISOString().slice(0, 16).replace(':', '')}.json`), JSON.stringify({ cuando: new Date().toISOString(), todos }, null, 1));
srv.close();
try { fs.rmSync(path.join(aqui, 'perfiles'), { recursive: true, force: true }); } catch {}
process.exit(0);
