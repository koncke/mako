// El servidor del banco del onboarding: la página, lo compilado y un manifiesto de tutoriales con dos videos de prueba (con sonido).
// Lo demás de /api lo contesta la página (entrada.tsx). node scripts/banco-onboarding/servir.cjs → http://127.0.0.1:4591
const http = require('http');
const fs = require('fs');
const path = require('path');
const sal = path.join(__dirname, 'salida');
const PUERTO = Number(process.env.PUERTO_BANCO || 4591);
const tipos = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.webm': 'video/webm', '.json': 'application/json', '.jpg': 'image/jpeg' };
const pagina = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/casa.css"><link rel="stylesheet" href="/entrada.css"><style>body{margin:0;font-family:Inter,system-ui,sans-serif;background:var(--bg);color:var(--ink)}</style></head><body><div id="raiz"></div><script type="module" src="/entrada.js"></script></body></html>';
const video = (key, titulo) => ({ key, pestana: titulo, ruta: '/second-brain', archivo: '/tutoriales/prueba.webm', poster: '/tutoriales/poster.jpg', duracion_s: 20, peso_kb: 540 });
// El del recorrido, para la llegada y su «dale play» (sin frases: el banco no prueba el recorrido con video).
const manifiesto = JSON.stringify({ videos: [video('banco-arriba', 'El de arriba'), video('banco-abajo', 'El de abajo'), video('recorrido', 'Tu recorrido por MaKo')] });
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x').pathname;
  if (u === '/') { res.setHeader('content-type', 'text/html'); return res.end(pagina); }
  if (u === '/tutoriales/manifiesto.json') { res.setHeader('content-type', 'application/json'); return res.end(manifiesto); }
  const f = path.join(sal, path.basename(u));
  if (!fs.existsSync(f)) { res.statusCode = 404; return res.end('no'); }
  const datos = fs.readFileSync(f);
  // El video, con rangos: sin eso Chromium no deja saltar ni a veces arrancar.
  const rango = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
  res.setHeader('content-type', tipos[path.extname(f)] || 'application/octet-stream');
  res.setHeader('accept-ranges', 'bytes');
  if (rango) {
    const a = Number(rango[1]), b = rango[2] ? Number(rango[2]) : datos.length - 1;
    res.statusCode = 206;
    res.setHeader('content-range', `bytes ${a}-${b}/${datos.length}`);
    return res.end(datos.subarray(a, b + 1));
  }
  res.end(datos);
}).listen(PUERTO, '127.0.0.1', () => console.log(`http://127.0.0.1:${PUERTO}`));
