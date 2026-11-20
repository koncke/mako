// =============================================================================
// doc-a-laminas — dibuja cada página de un diseño de «Editar» (doc.json) como un HTML de su tamaño, para capturarlo y MIRARLO
// al lado del original (19/11/2026, la prueba de hacer dentro de MaKo los carruseles de ventas).
// =============================================================================
// Lo que deja `scripts/carruseles-probar-editar.mts --salida <carpeta>` (en seco, sin guardar nada) se dibuja acá como lo haría
// el editor: el fondo (la plancha: la lámina original sin sus letras), cada texto con su caja, su letra, su interlineado de
// Fabric (× 1,13), su espaciado y las palabras de acento, y los recuadros (el lugar de la persona, punteado). Es una
// aproximación del lienzo, no el lienzo: sirve para juzgar la réplica, no para medir píxeles.
//
// Uso: node scripts/banco-carruseles/doc-a-laminas.mjs <carpeta>
//   → <carpeta>/html/NN.html y <carpeta>/lista.json, y después, por el turno del navegador:
//   node C:/dev/artefactos-animaciones/tools/turno.mjs node scripts/banco-carruseles/capturar.mjs <carpeta>/lista.json <carpeta>/laminas
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';

const carpeta = path.resolve(process.argv[2] ?? '');
const doc = JSON.parse(fs.readFileSync(path.join(carpeta, 'doc.json'), 'utf8'));
const W = doc.width;
const H = doc.height;
const FUENTES = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Montserrat:wght@400;700;800;900&family=Archivo+Black&family=Anton&family=Playfair+Display:ital,wght@0,500;0,700;0,800;1,500&family=Caveat:wght@500;700&family=Roboto+Mono:wght@500;700&display=block';

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Un texto de Fabric: los estilos van por renglón ESCRITO (el `\n`) y por letra. */
function textoHtml(o) {
  const lineas = String(o.text ?? '').split('\n');
  const estilos = o.styles && !Array.isArray(o.styles) ? o.styles : {};
  const fondo = o.textBackgroundColor || '';
  const cuerpo = lineas.map((linea, i) => {
    const deLinea = estilos[i] ?? {};
    const letras = Array.from(linea);
    let html = '';
    let actual = null;
    let tramo = '';
    const cerrar = () => { if (!tramo) return; html += actual ? `<span style="color:${actual}">${esc(tramo)}</span>` : esc(tramo); tramo = ''; };
    letras.forEach((ch, k) => {
      const c = deLinea[k]?.fill ?? null;
      if (c !== actual) { cerrar(); actual = c; }
      tramo += ch;
    });
    cerrar();
    return fondo ? `<span style="background:${fondo};box-decoration-break:clone;-webkit-box-decoration-break:clone">${html || '&nbsp;'}</span>` : html || '&nbsp;';
  }).join('<br>');
  const fam = String(o.fontFamily ?? 'Inter, sans-serif').split('"').join("'");
  return `<div title="${esc(String(o.name ?? ''))}" style="position:absolute;left:${o.left}px;top:${o.top}px;width:${o.width}px;`
    + `font-family:${fam};font-size:${o.fontSize}px;font-weight:${o.fontWeight};font-style:${o.fontStyle ?? 'normal'};`
    + `line-height:${(o.lineHeight ?? 1.16) * 1.13};letter-spacing:${(o.charSpacing ?? 0) / 1000}em;color:${o.fill};text-align:${o.textAlign ?? 'left'};`
    + `white-space:pre-wrap;overflow-wrap:break-word">${cuerpo}</div>`;
}

function objetoHtml(o) {
  if (o.type === 'textbox') return textoHtml(o);
  if (o.type === 'rect') {
    const borde = o.stroke ? `border:${o.strokeWidth ?? 1}px ${o.strokeDashArray ? 'dashed' : 'solid'} ${o.stroke};` : '';
    const rotulo = o.name ? `<span style="position:absolute;left:12px;top:10px;font:600 22px Inter,sans-serif;color:#80868B">${esc(o.name)}</span>` : '';
    return `<div style="position:absolute;left:${o.left}px;top:${o.top}px;width:${o.width}px;height:${o.height}px;background:${o.fill};border-radius:${o.rx ?? 0}px;${borde}box-sizing:border-box">${o.strokeDashArray ? rotulo : ''}</div>`;
  }
  if (o.type === 'ellipse') return `<div style="position:absolute;left:${o.left - o.width / 2}px;top:${o.top - o.height / 2}px;width:${o.width}px;height:${o.height}px;border-radius:50%;background:${o.fill}"></div>`;
  if (o.type === 'image') {
    const w = (o.width ?? 0) * (o.scaleX ?? 1);
    const h = (o.height ?? 0) * (o.scaleY ?? 1);
    return `<img src="${o.src}" style="position:absolute;left:${o.left}px;top:${o.top}px;width:${w}px;height:${h}px;object-fit:cover">`;
  }
  return '';
}

const dirHtml = path.join(carpeta, 'html');
fs.mkdirSync(dirHtml, { recursive: true });
const lista = [];
doc.pages.forEach((p, i) => {
  const n = String(i + 1).padStart(2, '0');
  // En seco, la plancha viene como data URL adentro del doc; el script también la deja como plancha-N.jpg al lado.
  const fondoSrc = p.background?.type === 'image' ? p.background.src : null;
  const fondo = fondoSrc ? `background:url('${fondoSrc}') center/cover no-repeat` : `background:${p.background?.color ?? '#fff'}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${FUENTES}">
<style>html,body{margin:0;padding:0;width:${W}px;height:${H}px;overflow:hidden}</style></head><body>
<div style="position:relative;width:${W}px;height:${H}px;overflow:hidden;${fondo}">${(p.objects ?? []).map(objetoHtml).join('')}</div></body></html>`;
  const archivo = path.join(dirHtml, `${n}.html`);
  fs.writeFileSync(archivo, html);
  lista.push({ url: 'file:///' + archivo.split(path.sep).join('/'), salida: `${n}.png`, ancho: W, alto: H, espera: 2500 });
});
fs.writeFileSync(path.join(carpeta, 'lista.json'), JSON.stringify(lista, null, 1));
console.log(`${doc.pages.length} láminas en ${dirHtml}`);
