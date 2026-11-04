// Estático del banco, sólo en 127.0.0.1. Las rutas sin extensión devuelven la página.
const http = require('http');
const fs = require('fs');
const path = require('path');
const AQUI = __dirname;
const TIPOS = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html', '.wasm': 'application/wasm', '.png': 'image/png' };
const HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/salida/entrada.css"><style>:root{--fs-meta:12px;--fs-sm:13px;--fs-md:14px;--fs-card:15.5px}button,input,select,textarea{font-family:inherit}html,body{margin:0;height:100%}#app{height:100%}</style></head><body><div id="app"></div><script type="module" src="/salida/entrada.js"></script></body></html>`;
http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(AQUI, u);
  if (f.startsWith(AQUI) && path.extname(u) && fs.existsSync(f)) {
    res.writeHead(200, { 'content-type': TIPOS[path.extname(u)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(req.url.startsWith('/foto') ? HTML.replace('/salida/entrada.js', '/salida/foto.js')
    : req.url.startsWith('/landing') ? HTML.replace('/salida/entrada.js', '/salida/landing.js').replace('/salida/entrada.css', '/salida/landing.css')
    : HTML);
}).listen(4577, '127.0.0.1', () => console.log('banco en 127.0.0.1:4577'));
