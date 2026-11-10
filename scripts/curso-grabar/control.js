// Control de la grabación, se pega en la pestaña de THE NET LAB con javascript_tool.
// Reemplazar __COLA__ por cola-compacta.json y __OPC__ por las opciones, p. ej. {"desde":0,"soloN":null,"maxSeg":null}.
// - Tapa la página con un contenedor (que va a pantalla completa con el primer clic real) y carga cada lección adentro.
// - El video de Spotlightr se lleva al frente y a pantalla llena; se maneja por su API de postMessage.
// - Marca de sincronía al empezar y al terminar cada video: destello MAGENTA + pitido de 1 kHz (0,25 s).
// - Apaga las capas programadas de Spotlightr, destraba un video quieto y lo reinicia desde 0 ya con sonido.
// - Un oscilador casi mudo (-80 dB) deja abierta la salida de audio de Chrome para que el loopback no tenga huecos.
// - El primer video de la tanda espera un clic real del operador en el centro (Chrome no deja sonar sin eso).
(() => {
const P = 'https://thenet-lab.com/courses/meta-ads/lessons/';
const Q = __COLA__;
const OPC = Object.assign({ desde: 0, soloN: null, lista: null, maxSeg: null, clicSiempre: false, clave: '__grabarLog2' }, __OPC__);
if (window.__g && window.__g.running) return 'ya corre';
if (window.__ctl) { try { window.__ctl.running = false; window.__ctl.fr.remove(); } catch (e) {} }
const g = window.__g = { running: true, estado: 'arrancando', log: [], ev: [], opc: OPC, clicHecho: false };
const ev = (m) => { g.ev.push([Date.now(), m]); if (g.ev.length > 400) g.ev.shift(); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const guardar = () => { try { localStorage[OPC.clave] = JSON.stringify(g.log); } catch (e) {} };
try { g.log = JSON.parse(localStorage[OPC.clave] || '[]'); } catch (e) {}

document.title = 'MaKo grabando clases';
setInterval(() => { if (document.title !== 'MaKo grabando clases') document.title = 'MaKo grabando clases'; }, 2000);
document.documentElement.style.overflow = 'hidden';
const wrap = document.createElement('div');
wrap.id = '__grabarWrap';
wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:#000';
const fr = document.createElement('iframe');
fr.allow = 'autoplay; fullscreen';
fr.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;background:#000';
const blanco = document.createElement('div');
blanco.style.cssText = 'position:absolute;inset:0;background:#ff00ff;display:none;z-index:5';
wrap.append(fr, blanco);
document.body.appendChild(wrap);
g.fr = fr; g.wrap = wrap;
const latido = document.createElement('div');
latido.style.cssText = 'position:absolute;right:0;bottom:0;width:2px;height:2px;z-index:10;background:#000';
wrap.appendChild(latido);
let lk = 0; g.latido = setInterval(() => { lk ^= 1; latido.style.background = lk ? '#020202' : '#000'; }, 33);
// pantalla completa: el primer clic cae en esta capa transparente (la página de arriba), que pide la pantalla completa
const capa = document.createElement('div');
capa.style.cssText = 'position:absolute;inset:0;z-index:20;background:transparent;cursor:pointer';
capa.addEventListener('click', () => { wrap.requestFullscreen().then(() => ev('pantalla completa')).catch((e) => ev('fs: ' + e.message)); capa.remove(); g.capaFuera = true; });
wrap.appendChild(capa);


const audio = async () => {
  if (!g.ac) g.ac = new AudioContext();
  if (g.ac.state !== 'running') { try { await g.ac.resume(); } catch (e) {} }
  if (g.ac.state === 'running' && !g.vivo) {
    const o = g.ac.createOscillator(); const ga = g.ac.createGain();
    o.frequency.value = 40; ga.gain.value = 0.0001; o.connect(ga).connect(g.ac.destination); o.start();
    g.vivo = o; ev('salida de audio abierta');
  }
  return g.ac.state;
};
const marcar = async (tipo, n, j) => {
  const st = await audio();
  blanco.style.display = 'block';
  const o = g.ac.createOscillator(); const ga = g.ac.createGain();
  o.frequency.value = 1000; ga.gain.value = 0.08; o.connect(ga).connect(g.ac.destination);
  o.start(); o.stop(g.ac.currentTime + 0.25);
  const t = Date.now();
  await sleep(500);
  blanco.style.display = 'none';
  ev('marca ' + tipo + ' ' + n + '.' + j + ' audio=' + st);
  return t;
};

const cargar = (url) => new Promise((res) => {
  const t = setTimeout(() => res(false), 90000);
  fr.onload = () => { clearTimeout(t); res(true); };
  fr.src = url;
});

(async () => {
  g.estado = 'esperando-listo';   // primero: clic en la capa (pantalla completa), arrancar ffmpeg y poner g.listo = true
  while (!g.listo && g.running) await sleep(300);
  for (let qi = OPC.desde; qi < Q.length && g.running; qi++) {
    const [n, path, ids, secs] = Q[qi];
    if (OPC.soloN && n !== OPC.soloN) continue;
    if (OPC.lista && !OPC.lista.includes(n)) continue;
    if (ids.every((_, j) => g.log.some((x) => x.n === n && x.j === j && x.ok))) continue;
    g.qi = qi; g.estado = 'cargando ' + n;
    await cargar(P + path);
    await sleep(2500);
    let doc = null; let vids = [];
    for (let k = 0; k < 20 && !vids.length; k++) {
      try { doc = fr.contentDocument; vids = [...doc.querySelectorAll('iframe[src*="spotlightr"]')]; } catch (e) {}
      if (!vids.length) await sleep(1000);
    }
    if (!vids.length) { g.log.push({ n, j: 0, ok: false, motivo: 'sin video en la página' }); guardar(); ev('sin video ' + n); continue; }
    if (vids.length !== ids.length) ev('lección ' + n + ': ' + vids.length + ' videos en la página, el plan dice ' + ids.length);
    const srcs = vids.map((v) => v.src);
    for (let j = 0; j < srcs.length && g.running; j++) {
      if (g.log.some((x) => x.n === n && x.j === j && x.ok)) continue;
      // el video al frente y a pantalla llena (un iframe nuevo, limpio, en el body de la lección)
      doc.querySelectorAll('iframe.__grabarVideo').forEach((x) => x.remove());
      vids.forEach((v) => { try { v.src = 'about:blank'; } catch (e) {} });
      const vf = doc.createElement('iframe');
      vf.className = '__grabarVideo';
      vf.allow = 'autoplay; fullscreen';
      vf.setAttribute('allowfullscreen', '');
      vf.style.cssText = 'position:fixed;left:50%;bottom:0;top:auto;width:1152px;height:648px;transform:translateX(-50%);border:0;z-index:2147483647;background:#000';
      try { doc.documentElement.style.overflow = 'hidden'; if (doc.body) doc.body.style.overflow = 'hidden'; } catch (e) {}
      vf.src = srcs[j];
      doc.body.appendChild(vf);
      const id = decodeURIComponent((srcs[j].match(/watch\/([^?&#]+)/) || [])[1] || '');
      await new Promise((r) => { vf.onload = r; setTimeout(r, 20000); });
      const w = vf.contentWindow;
      const st = { ct: 0, tick: Date.now(), first: null, ended: false, rate: null, dur: null, api: false, muted: null };
      const onmsg = (e) => {
        if (e.source !== w) return;
        const d = e.data && e.data.data; if (!d || typeof d !== 'object') return;
        if (d.name === 'getVideoCurrentTime') {
          const c = Number(d.currentTime);
          if (Math.abs(c - st.ct) > 0.01) st.tick = Date.now();
          st.ct = c; if (st.first === null && st.armado && c > 0) st.first = Date.now();
        }
        if (d.callbackId) {
          st.api = true; const cb = String(d.callbackId);
          if (cb.endsWith('-onEnded')) st.ended = true;
          if (cb.endsWith('-playbackRate')) st.rate = Number(d.returnValue);
          if (cb.endsWith('-muted')) st.muted = d.returnValue;
          if (cb.endsWith('-getDuration')) { const v = Number(d.returnValue); if (v > 0) st.dur = v; }
        }
      };
      const lw = fr.contentWindow; lw.addEventListener('message', onmsg);
      const send = (method, params) => { try { w.postMessage({ videoId: id, api: true, method, params }, '*'); } catch (e) {} };
      g.send = send;
      for (let k = 0; k < 40 && !st.api; k++) { send('getDuration'); await sleep(500); }
      send('onEnded');
      const ent = { n, j, id };
      ent.marcaIni = await marcar('inicio', n, j);
      st.armado = true;
      if (!g.clicHecho || OPC.clicSiempre || g.opc.clicSiempre) {
        g.estado = 'esperando-clic ' + n + '.' + j;      // el operador hace un clic real en el centro
        const t = Date.now();
        while (st.first === null && g.running && Date.now() - t < 3600000) await sleep(300);
        if (st.first !== null) g.clicHecho = true;
      } else {
        send('currentTime', [0.01]); send('playbackRate', [2]); send('play'); await sleep(800); send('volume', [1]);
        const t = Date.now();
        while (st.first === null && Date.now() - t < 15000) await sleep(300);
        if (st.first === null) {
          g.estado = 'esperando-clic ' + n + '.' + j;
          const t2 = Date.now();
          while (st.first === null && g.running && Date.now() - t2 < 3600000) await sleep(300);
        }
      }
      if (st.first === null) { ent.ok = false; ent.motivo = 'no arrancó'; g.log.push(ent); guardar(); lw.removeEventListener('message', onmsg); continue; }
      g.estado = 'reproduciendo ' + n + '.' + j;
      ent.inicio = st.first;
      send('pause'); send('volume', [1]); send('currentTime', [0.01]); await sleep(400);
      send('volume', [1]); send('playbackRate', [2]); send('play'); ent.reinicio = Date.now();
      ev('reinicio con sonido desde 0 (estaba en ' + st.ct.toFixed(2) + ')');
      await sleep(600); send('playbackRate'); send('muted'); send('getDuration');
      let trabas = 0; let chequeo = Date.now(); let apagar = 0; let ultimoIntento = 0;
      while (!st.ended && g.running && !g.saltar) {
        await sleep(500);
        if (Date.now() - apagar > 5000) { apagar = Date.now(); send('showOverlays', [0]); send('showLocks', [0]); }
        if (OPC.maxSeg && Date.now() - st.first > OPC.maxSeg * 1000) { ev('corte de prueba ' + n); break; }
        if (Date.now() - chequeo > 15000) {
          chequeo = Date.now(); send('playbackRate'); send('muted');
          if (st.rate && st.rate !== 2) { send('playbackRate', [2]); ev('velocidad corregida ' + st.rate + ' en ' + n); }
        }
        const dur = st.dur || secs[j] || 0;
        if (dur && st.ct >= dur - 0.4 && Date.now() - st.tick > 3000) { ev('fin por tiempo ' + n + '.' + j); break; }
        if (Date.now() - st.tick > 8000 && Date.now() - ultimoIntento > 8000) {
          trabas++; ultimoIntento = Date.now();
          if (trabas === 1) { send('showOverlays', [0]); send('play'); }
          else if (trabas === 2) { send('currentTime', [st.ct + 0.2]); send('play'); }
          else if (trabas <= 6) { send('currentTime', [st.ct + 1]); send('play'); }
          else { ent.motivo = 'quieta en ' + st.ct.toFixed(1); break; }
          ev('quieta ' + n + '.' + j + ' en ' + st.ct.toFixed(1) + ' (intento ' + trabas + ')');
        }
        if (trabas && Date.now() - st.tick < 1000 && st.ct > 1) { ev('destrabada en ' + st.ct.toFixed(1)); trabas = 0; }
      }
      if (g.saltar) { ent.motivo = 'repetir: ' + g.saltar; g.saltar = null; }
      send('pause');
      ent.fin = Date.now(); ent.ctFin = st.ct; ent.dur = st.dur; ent.rate = st.rate; ent.muted = st.muted; ent.trabas = trabas;
      ent.marcaFin = await marcar('fin', n, j);
      ent.ok = !ent.motivo && g.running && !OPC.maxSeg;
      g.log.push(ent); guardar();
      lw.removeEventListener('message', onmsg);
      vf.remove();
      await sleep(1500);
      if (!ent.ok && g.running && ent.motivo && ent.motivo.startsWith('repetir')) j--;
    }
  }
  g.estado = g.running ? 'terminado' : 'detenido'; g.running = false; ev(g.estado);
})().catch((e) => { g.estado = 'error: ' + e.message; g.running = false; ev('error ' + e.message); });
return 'arrancó · opciones ' + JSON.stringify(OPC) + ' · ya grabadas ' + g.log.filter((x) => x.ok).length;
})()
