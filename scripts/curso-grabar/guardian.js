// Guardián de la página de grabación (vive en la ventana que reproduce, junto a control.js).
// Apaga las capas programadas de Spotlightr, destraba un video quieto (play → salto 0,2 s → recarga del reproductor,
// hasta 3 recargas) y mide los cuadros por segundo que dibuja la ventana (__g.fps): si cae a ~1, Chrome dejó de
// dibujarla (otra ventana la tapa entera o quedó en segundo plano) y la captura de video se congela.
// Antes vivía sólo pegado en la página (10/11/2026): se guarda acá para poder reponerlo.
(() => {
  const g = window.__g; if (!g) return 'sin __g: primero el control';
  if (g.guardia) clearInterval(g.guardia);
  if (g.fpsInt) clearInterval(g.fpsInt);
  g.gx = { vf: null, ct: 0, tick: Date.now(), intento: 0, ultimoIntento: 0, ultimoApagar: 0, log: [], recargas: 0 };
  const glog = (m) => { g.gx.log.push([Date.now(), m]); if (g.gx.log.length > 300) g.gx.log.shift(); try { localStorage.__grabarGuardia = JSON.stringify(g.gx.log.slice(-100)); } catch (e) {} };
  // cuadros por segundo de la ventana
  let cuadros = 0; g.fps = null; g.fpsLog = [];
  const contar = () => { cuadros++; requestAnimationFrame(contar); }; requestAnimationFrame(contar);
  g.fpsInt = setInterval(() => { g.fps = cuadros; cuadros = 0; g.fpsLog.push([Date.now(), g.fps]); if (g.fpsLog.length > 600) g.fpsLog.shift(); }, 1000);
  g.recargar = async () => {
    const gx = g.gx; const d = g.fr.contentDocument; const vf = d.querySelector('iframe.__grabarVideo'); if (!vf) return;
    const punto = gx.ct; const src = vf.src; gx.recargando = true; glog('recargo el reproductor en ' + punto.toFixed(1));
    vf.src = 'about:blank'; await new Promise(r => setTimeout(r, 500)); vf.src = src;
    await new Promise(r => { vf.onload = r; setTimeout(r, 15000); });
    let listo = false; const h = (e) => { if (e.source === vf.contentWindow && e.data && e.data.data && e.data.data.callbackId) listo = true; };
    g.fr.contentWindow.addEventListener('message', h);
    for (let k = 0; k < 30 && !listo; k++) { gx.send('getDuration'); await new Promise(r => setTimeout(r, 500)); }
    g.fr.contentWindow.removeEventListener('message', h);
    gx.send('currentTime', [punto + 0.5]); gx.send('playbackRate', [2]); gx.send('play');
    await new Promise(r => setTimeout(r, 900)); gx.send('volume', [1]); gx.send('playbackRate', [2]);
    gx.recargando = false; gx.intento = 0; gx.tick = Date.now(); gx.recargas = (gx.recargas || 0) + 1;
  };
  g.guardia = setInterval(() => {
    try {
      const gx = g.gx; const d = g.fr.contentDocument; const vf = d && d.querySelector('iframe.__grabarVideo');
      if (vf !== gx.vf) {
        if (gx.onmsg && gx.lw) { try { gx.lw.removeEventListener('message', gx.onmsg); } catch (e) {} }
        gx.vf = vf; gx.ct = 0; gx.tick = Date.now(); gx.intento = 0; gx.ultimoIntento = 0; gx.ultimoApagar = 0; gx.recargas = 0;
        if (vf) {
          const id = decodeURIComponent((vf.src.match(/watch\/([^?&#]+)/) || [])[1] || '');
          gx.send = (m, p) => { try { vf.contentWindow.postMessage({ videoId: id, api: true, method: m, params: p }, '*'); } catch (e) {} };
          gx.lw = g.fr.contentWindow;
          gx.onmsg = (e) => { if (e.source !== vf.contentWindow) return; const dd = e.data && e.data.data; if (dd && dd.name === 'getVideoCurrentTime') { const c = Number(dd.currentTime); if (Math.abs(c - gx.ct) > 0.3) { gx.tick = Date.now(); if (gx.intento) { glog('destrabado en ' + c.toFixed(1) + ' tras ' + gx.intento + ' intento(s)'); gx.intento = 0; } } gx.ct = c; } };
          gx.lw.addEventListener('message', gx.onmsg);
          glog('video nuevo ' + id);
        }
      }
      if (!vf || !gx.send || gx.recargando) return;
      if (Date.now() - gx.ultimoApagar > 5000) { gx.ultimoApagar = Date.now(); gx.send('showOverlays', [0]); gx.send('showLocks', [0]); }
      if (!/^reproduciendo/.test(g.estado) || gx.ct < 1) return;
      if (Date.now() - gx.tick > 8000 && Date.now() - gx.ultimoIntento > 8000) {
        gx.intento++; gx.ultimoIntento = Date.now();
        if (gx.intento === 1) { gx.send('showOverlays', [0]); gx.send('play'); glog('quieto en ' + gx.ct.toFixed(1) + ': play'); }
        else if (gx.intento === 2) { gx.send('currentTime', [gx.ct + 0.2]); gx.send('play'); glog('quieto en ' + gx.ct.toFixed(1) + ': salto 0,2 s'); }
        else if (gx.intento >= 3 && (gx.recargas || 0) < 3) { g.recargar(); }
      }
    } catch (e) {}
  }, 1000);
  return 'guardián puesto';
})()
