// Saca { html, css } del documento publicado que dibuja una landing de MaKo, del HTML que sirve producción, para mirarlo en el banco.
// Se baja con un pedido sin navegador (sin JS no corre el Pixel: no suma una visita). Nunca abrir la portada real en un navegador para medir.
//   curl -s https://hola-mako.com/ -o /tmp/portada.html
//   node scripts/banco-editor-web/extraer-landing.mjs /tmp/portada.html scripts/banco-editor-web/doc-actual.json
// ⚠️ El texto largo va en una fila aparte del payload de Next: `"html":"$1f"` apunta a `1f:T<largo en hex>,<texto>`, y el largo es en BYTES.
import fs from 'node:fs';

const [entrada, salida] = process.argv.slice(2);
if (!entrada || !salida) { console.error('Uso: node extraer-landing.mjs <portada.html> <salida.json>'); process.exit(1); }
const h = fs.readFileSync(entrada, 'utf8');
const rsc = [...h.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map((m) => JSON.parse(`"${m[1]}"`)).join('');
const ini = rsc.indexOf('"diseno":{');
if (ini < 0) { console.error('Esta página no trae documento publicado: dibuja la landing de respaldo.'); process.exit(1); }
let hondo = 0, enTexto = false, fin = -1;
for (let k = ini + 9; k < rsc.length; k++) {
  const c = rsc[k];
  if (enTexto) { if (c === '\\') k++; else if (c === '"') enTexto = false; continue; }
  if (c === '"') enTexto = true;
  else if (c === '{') hondo++;
  else if (c === '}' && --hondo === 0) { fin = k + 1; break; }
}
const diseno = JSON.parse(rsc.slice(ini + 9, fin));
const fila = (v) => {
  if (typeof v !== 'string' || !v.startsWith('$')) return v;
  const m = new RegExp(`${v.slice(1)}:T([0-9a-f]+),`).exec(rsc);
  if (!m) throw new Error(`No está la fila ${v}`);
  return Buffer.from(rsc.slice(m.index + m[0].length), 'utf8').subarray(0, parseInt(m[1], 16)).toString('utf8');
};
fs.writeFileSync(salida, JSON.stringify({ html: fila(diseno.html), css: fila(diseno.css) }));
console.log('listo', salida);
