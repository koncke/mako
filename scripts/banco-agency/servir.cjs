// El servidor del banco del Agency Dashboard. Los datos (de producción, con nombres reales) vienen de DATOS=<json>, fuera del repo.
const http = require('http');
const fs = require('fs');
const path = require('path');
const sal = path.join(__dirname, 'salida');
const tipos = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' };
const pagina = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/casa.css"><link rel="stylesheet" href="/entrada.css"><style>body{margin:0;font-family:Inter,system-ui,sans-serif;background:var(--bg);color:var(--ink)}</style></head><body><div id="raiz"></div><script type="module" src="/entrada.js"></script></body></html>';
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x').pathname;
  if (u === '/') { res.setHeader('content-type', 'text/html'); return res.end(pagina); }
  if (u === '/telefono') { res.setHeader('content-type', 'text/html'); return res.end(pagina.replace(/entrada\./g, 'telefono.')); }
  if (u === '/datos.json') { res.setHeader('content-type', 'application/json'); return res.end(fs.readFileSync(process.env.DATOS)); }
  const f = path.join(sal, path.basename(u));
  if (!fs.existsSync(f)) { res.statusCode = 404; return res.end('no'); }
  res.setHeader('content-type', tipos[path.extname(f)] || 'application/octet-stream');
  res.end(fs.readFileSync(f));
}).listen(4597, '127.0.0.1', () => console.log('http://127.0.0.1:4597'));
