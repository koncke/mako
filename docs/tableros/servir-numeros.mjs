// Servidor estático mínimo: para mirar numeros-mako.html en el panel del costado,
// igual que servir-pendientes.mjs pero en otro puerto para que convivan.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
const PUERTO = 4179;
// Dos páginas en el mismo servidor: los números y el plan de lanzamiento, que se miran juntas.
const PAGINAS = {
  '/': './numeros-mako.html',
  '/plan': './plan-lanzamiento.html',
  '/estrategia': './estrategia-adquisicion.html',
  '/l/setter': './landing-setter.html',
};
createServer((req, res) => {
  const ruta = (req.url || '/').split('?')[0].replace(/\/+$/, '') || '/';
  const cual = PAGINAS[ruta];
  if (!cual) {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<p>No existe. Hay <a href="/">los números</a> y <a href="/plan">el plan de lanzamiento</a>.');
    return;
  }
  try {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(readFileSync(new URL(cual, import.meta.url)));
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('no pude leer numeros-mako.html: ' + (e instanceof Error ? e.message : String(e)));
  }
}).listen(PUERTO, '127.0.0.1', () => console.log('numeros en http://localhost:' + PUERTO));
