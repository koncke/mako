// Cliente CDP a nivel BROWSER (Chrome 150 headless=new no lista page targets por HTTP).
// Se conecta al webSocketDebuggerUrl del browser, adjunta al page target (flatten+sessionId),
// renderiza renderFn(t) y captura N frames -> outDir/frame_XXXX.png
const http = require('http'), net = require('net'), crypto = require('crypto'), fs = require('fs'), path = require('path');
const [, , port, renderFn, outDir, Ns, Durs, Ws, Hs, pageUrlArg, startArg, endArg] = process.argv;
const N = +Ns, DUR = +Durs, W = +Ws, H = +Hs;
const START = startArg != null ? +startArg : 0;
const END = endArg != null ? +endArg : N - 1;

function encodeFrame(str) {
  const payload = Buffer.from(str, 'utf8'), len = payload.length, mask = crypto.randomBytes(4);
  let header;
  if (len < 126) header = Buffer.from([0x81, 0x80 | len]);
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(len), 2); }
  const masked = Buffer.alloc(len);
  for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i & 3];
  return Buffer.concat([header, mask, masked]);
}

http.get('http://127.0.0.1:' + port + '/json/version', res => {
  let d = ''; res.on('data', c => d += c); res.on('end', () => {
    const wsUrl = JSON.parse(d).webSocketDebuggerUrl;
    if (!wsUrl) { console.error('sin webSocketDebuggerUrl'); process.exit(1); }
    run(new URL(wsUrl));
  });
}).on('error', e => { console.error('http err', e.message); process.exit(1); });

function run(u) {
  const key = crypto.randomBytes(16).toString('base64');
  const sock = net.connect(+u.port, u.hostname, () => {
    sock.write('GET ' + u.pathname + u.search + ' HTTP/1.1\r\nHost: ' + u.host +
      '\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ' + key +
      '\r\nSec-WebSocket-Version: 13\r\n\r\n');
  });
  let handshaken = false, frameBuf = Buffer.alloc(0);
  let idc = 0; const pending = new Map(); let sessionId = null;
  function send(method, params, sess) {
    idc++; const id = idc; const msg = { id, method, params: params || {} };
    if (sess) msg.sessionId = sess;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      sock.write(encodeFrame(JSON.stringify(msg)));
    });
  }
  sock.on('data', chunk => {
    if (!handshaken) {
      const s = chunk.indexOf('\r\n\r\n'); if (s < 0) return;
      handshaken = true; frameBuf = chunk.slice(s + 4); onReady();
    } else frameBuf = Buffer.concat([frameBuf, chunk]);
    while (frameBuf.length >= 2) {
      const op = frameBuf[0] & 0x0f; let len = frameBuf[1] & 0x7f, off = 2;
      if (len === 126) { if (frameBuf.length < 4) return; len = frameBuf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (frameBuf.length < 10) return; len = Number(frameBuf.readBigUInt64BE(2)); off = 10; }
      if (frameBuf.length < off + len) return;
      const payload = frameBuf.slice(off, off + len); frameBuf = frameBuf.slice(off + len);
      if (op === 8) { console.error('ws close'); process.exit(1); }
      if (op !== 1) continue;
      let msg; try { msg = JSON.parse(payload.toString('utf8')); } catch (e) { continue; }
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id); pending.delete(msg.id);
        if (msg.error) p.reject(new Error(JSON.stringify(msg.error))); else p.resolve(msg.result);
      }
    }
  });
  sock.on('error', e => { console.error('ws err', e.message); process.exit(1); });

  async function onReady() {
    try {
      const { targetInfos } = await send('Target.getTargets');
      let page = targetInfos.find(t => t.type === 'page');
      if (!page) {
        const cr = await send('Target.createTarget', { url: pageUrlArg || 'about:blank' });
        page = { targetId: cr.targetId };
      }
      const at = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
      sessionId = at.sessionId;
      await send('Page.enable', {}, sessionId);
      await send('Runtime.enable', {}, sessionId);
      if (pageUrlArg) { await send('Page.navigate', { url: pageUrlArg }, sessionId); await sleep(600); }
      // esperar fuentes + logos
      await send('Runtime.evaluate', { expression: "Promise.all([document.fonts.load(\"700 120px Geist\").then(function(){return document.fonts.ready;}),(window.assetsReady||Promise.resolve())]).then(function(){return true;})", awaitPromise: true }, sessionId);
      await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false }, sessionId);
      await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } }, sessionId);
      fs.mkdirSync(outDir, { recursive: true });
      for (let i = START; i <= END; i++) {
        const t = Math.round(i * DUR / N);
        await send('Runtime.evaluate', { expression: '(function(){' + renderFn + '(' + t + ');return new Promise(function(r){requestAnimationFrame(function(){requestAnimationFrame(r);});});})()', awaitPromise: true }, sessionId);
        const res = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
        fs.writeFileSync(path.join(outDir, 'frame_' + String(i).padStart(4, '0') + '.png'), Buffer.from(res.data, 'base64'));
        if (i % 20 === 0) console.log('frame', i, '/', N);
      }
      console.log('OK', N, 'frames ->', outDir);
      process.exit(0);
    } catch (e) { console.error('render err', e.message); process.exit(1); }
  }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}
