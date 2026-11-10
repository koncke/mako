// =============================================================================
// curso-recibir.mjs — recibe en la PC lo que recolecta una página del Chrome de Martín (9/11/2026)
// =============================================================================
// El puente entre un recolector que corre ADENTRO de una página con sesión (por ejemplo
// scripts/thenet-lab-pagina.js) y el disco. Escucha SÓLO en 127.0.0.1 y escribe cada POST a
// `<carpeta>/recv-NNN.json`. Acepta un formulario (`data=<json>`) o un cuerpo crudo.
//
// ⚠️ Por qué existe: la herramienta de JavaScript de la extensión corta la respuesta a ~1.000
// caracteres, así que el material de un curso (~1 MB) no puede volver por ahí. Ver el
// encabezado de thenet-lab-pagina.js.
//
//   node scripts/curso-recibir.mjs C:\cursos\<slug>\export          (Ctrl+C para cortar)
//   node scripts/curso-recibir.mjs <carpeta> --port 8799
// =============================================================================
import http from 'node:http';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = process.argv[2];
if (!DIR || DIR.startsWith('--')) { console.error('\n  ✖ Falta la carpeta de destino\n'); process.exit(1); }
const i = process.argv.indexOf('--port');
const PORT = i > -1 ? Number(process.argv[i + 1]) : 8799;
mkdirSync(DIR, { recursive: true });

let n = 0;
http.createServer((req, res) => {
  if (req.method !== 'POST') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('vivo'); }
  const partes = [];
  req.on('data', (c) => partes.push(c));
  req.on('end', () => {
    let cuerpo = Buffer.concat(partes).toString('utf8');
    if ((req.headers['content-type'] || '').includes('x-www-form-urlencoded')) cuerpo = new URLSearchParams(cuerpo).get('data') ?? cuerpo;
    const f = join(DIR, `recv-${String(++n).padStart(3, '0')}.json`);
    writeFileSync(f, cuerpo);
    // El largo se imprime para compararlo con el que dijo la página: un envío cortado se ve acá.
    console.log(new Date().toLocaleTimeString(), f, cuerpo.length);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<html><body><h1>recibido ${n}: ${cuerpo.length} caracteres</h1></body></html>`);
  });
}).listen(PORT, '127.0.0.1', () => console.log(`escuchando en 127.0.0.1:${PORT} → ${DIR}`));
