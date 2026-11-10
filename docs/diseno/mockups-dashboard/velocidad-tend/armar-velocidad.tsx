// Arma velocidad.html (la ADAPTACIÓN de la copia de Tend a MaKo) desde el componente del producto. 10/11/2026.
//   npx tsx docs/diseno/mockups-dashboard/velocidad-tend/armar-velocidad.tsx
// La adaptación tiene que ser la copia con otros datos y otros textos: la misma hoja de estilos (tend.css) y el mismo movimiento
// (tend.js), sin una pieza que la copia no tenga. Para que la maqueta y la hoja del Dashboard no puedan decir cosas distintas, no se
// escribe a mano: se dibuja HojaVelocidad (app/dashboard/disenos/HojaVelocidad.tsx) con los datos de ejemplo de la miniatura
// (lib/velocidad-diseno-muestra.ts), se le saca el prefijo vt- a cada clase (así calza con tend.css, que es de donde salió
// velocidad-css.ts) y se le ponen los datos que dibuja tend.js (la curva de «Leads por día» y la línea de «Llamadas de hoy»).
// Lo único que no es de la copia es lo que el Dashboard no lleva: la barra de la izquierda y la de arriba de Tend (su ARMAZÓN).

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VELOCIDAD_LLAMADA, instanciarPlantilla } from '../../../../lib/graficos-plantillas';
import { DIAS_CORTO, pct, vistaVelocidad } from '../../../../lib/velocidad-diseno';
import { datosVelocidadMuestra } from '../../../../lib/velocidad-diseno-muestra';
import { HojaVelocidad } from '../../../../app/dashboard/disenos/HojaVelocidad';

const AQUI = dirname(fileURLToPath(import.meta.url));
const HOY = '2026-11-10';
const PERIODO = 'Últimos 30 días';
const AHORA = 11 + 12 / 60;

const hoja = instanciarPlantilla(VELOCIDAD_LLAMADA);
const vista = vistaVelocidad(hoja, datosVelocidadMuestra(hoja, HOY), PERIODO);
let html = renderToStaticMarkup(createElement(HojaVelocidad, {
  hoja, vista, saludo: 'Buenos días, Ana', negocio: 'Inmobiliaria del Valle', hoy: HOY, periodo: PERIODO, ahora: AHORA,
}));

// La raíz (.vt y .vt-cuerpo) es la del Dashboard: en la maqueta, la página.
html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/, '');
const raiz = /^<div class="vt"[^>]*><div class="vt-cuerpo">([\s\S]*)<\/div><\/div>$/.exec(html);
if (!raiz) throw new Error('la hoja no empieza con .vt > .vt-cuerpo: el armador quedó viejo');
html = raiz[1];
html = html.replace(/class="([^"]*)"/g, (_, c: string) => `class="${c.split(/\s+/).map((x) => x.replace(/^vt-/, '')).filter(Boolean).join(' ')}"`);
html = html.replace(/ data-parte="[a-z-]+"/g, '');
// Lo que dibuja tend.js: la curva (en el componente la dibuja React a su tamaño; en el servidor no hay tamaño) y la línea.
html = html.replace('<div class="td-chart"></div>', '<div class="td-chart" id="td-chart"></div>');
html = html.replace('aria-pressed="true">2S</button>', 'data-r="2w" aria-pressed="true">2S</button>').replace('aria-pressed="false">30D</button>', 'data-r="30d" aria-pressed="false">30D</button>');
html = html.replace('<p class="td-trend__big">', '<p class="td-trend__big" id="td-trend-big">');
html = html.replace('<div class="td-tl">', '<div class="td-tl" id="td-tl">');
for (const pedazo of ['id="td-chart"', 'data-r="2w"', 'data-r="30d"', 'id="td-trend-big"', 'id="td-tl"']) {
  if (!html.includes(pedazo)) throw new Error(`no encontré dónde poner ${pedazo}: el componente cambió`);
}

const dias = vista.dias ?? [];
const max = Math.max(1, ...dias.map((d) => Math.max(d.contactados, d.sinContactar)));
const tope = [2, 4, 10, 20, 40, 50, 100, 200, 500, 1000, 2000, 5000].find((p) => p >= max) ?? Math.ceil(max);
const resumen = (ds: typeof dias, cuando: string) => {
  const a = ds.reduce((s, d) => s + d.contactados, 0), b = ds.reduce((s, d) => s + d.sinContactar, 0);
  return `<b>${a.toLocaleString('en-US')}</b><span>contactados ${cuando}${a + b ? ` · ${pct((b / (a + b)) * 100)} sin contactar` : ''}</span>`;
};
const datos = {
  linea: vista.linea && {
    desde: vista.linea.desde, hasta: vista.linea.hasta, ahora: AHORA, ahoraTxt: '11:12', almuerzo: null,
    filas: vista.linea.filas.map((f) => ({ nombre: f.quien, bloques: f.bloques.map((b) => ({ h: b.desde, d: b.dura, c: b.color })) })),
  },
  visitas: {
    tope, corto: DIAS_CORTO, aria: 'Contactados y sin contactar, día por día',
    dias: dias.map((d) => ({ r: d.rotulo, a: d.contactados, b: d.sinContactar })),
  },
};
const resumenes = { corto: resumen(dias.slice(-DIAS_CORTO), `en los últimos ${DIAS_CORTO} días`), todo: resumen(dias, PERIODO.toLowerCase()) };

const pagina = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Velocidad de llamada — la adaptación (Tend)</title>
<!-- GENERADA por armar-velocidad.tsx desde app/dashboard/disenos/HojaVelocidad.tsx con los datos de ejemplo: no se edita a mano.
     La copia de Tend con los datos y los textos de MaKo, con su misma hoja (tend.css) y su mismo movimiento (tend.js). -->
<link rel="stylesheet" href="tend.css">
<!-- Sin el ARMAZÓN de Tend (la barra de la izquierda y la de arriba): en el Dashboard la hoja va adentro de la pantalla de MaKo. -->
<style>.main { margin-left: 0; }</style>
</head>
<body>
<main class="main">
${html}
</main>
<script>
window.TEND_DATOS = ${JSON.stringify(datos)};
window.TEND_DATOS.linea && (window.TEND_DATOS.linea.rotulo = (h) => String(h));
window.TEND_DATOS.visitas.resumen = (r) => (r === '2w' ? ${JSON.stringify(resumenes.corto)} : ${JSON.stringify(resumenes.todo)});
</script>
<script src="tend.js"></script>
</body>
</html>
`;
writeFileSync(join(AQUI, 'velocidad.html'), pagina, 'utf8');
console.log('ok', pagina.length);
