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
};
// Las landings NO se enumeran: /l/<slug> sirve landing-<slug>.html. Son ocho y van a cambiar, y una
// lista a mano se desincroniza (el slug tiene que ser un slug: nada de ../ ni rutas).
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
function archivoDe(ruta) {
  if (PAGINAS[ruta]) return PAGINAS[ruta];
  const m = /^\/l\/([^/]+)$/.exec(ruta);
  return m && SLUG.test(m[1]) ? './landing-' + m[1] + '.html' : null;
}
createServer((req, res) => {
  const ruta = (req.url || '/').split('?')[0].replace(/\/+$/, '') || '/';
  const cual = archivoDe(ruta);
  if (!cual) {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<p>No existe. Hay <a href="/">los números</a>, <a href="/plan">el plan</a> y las landings en <code>/l/&lt;slug&gt;</code>.');
    return;
  }
  // ⚠️ SE LEE ANTES DE MANDAR LA CABECERA. Al revés, un archivo que no existe tiraba DESPUÉS del
  // writeHead(200), el catch intentaba un writeHead(500), eso daba ERR_HTTP_HEADERS_SENT y el proceso
  // se moría entero: /l/avatar (que todavía no existe) tumbaba el servidor para todas las páginas.
  let cuerpo;
  try {
    cuerpo = readFileSync(new URL(cual, import.meta.url));
  } catch (e) {
    const falta = e && e.code === 'ENOENT';
    res.writeHead(falta ? 404 : 500, { 'content-type': 'text/html; charset=utf-8' });
    res.end(falta
      ? '<p>Todavía no existe <code>' + cual + '</code>.'
      : '<p>No pude leer ' + cual + ': ' + (e instanceof Error ? e.message : String(e)));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(cuerpo);
}).listen(PUERTO, '127.0.0.1', () => console.log('numeros en http://localhost:' + PUERTO));
