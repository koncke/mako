// =============================================================================
// Los valores de las plantillas que Martín mandó copiar, sobre una landing de MaKo hecha en Web Generator (31/10/2026)
// =============================================================================
// La portada y las de cada funnel son DOCUMENTOS publicados (`div.gm-libre`, lib/editor-landing/landing-mako.ts): sus colores
// viven en el style de cada elemento, en la base, no en el código. Por eso cambiar app/vsl/* no les hace nada, y esto trabaja
// sobre el HTML y la hoja del documento. PURO: no lee ni escribe la base. Lo prueba tests/landing-valores-tilvo.test.ts.
//
// De dónde sale cada número (docs/diseno/, leídos con getComputedStyle):
//   · la paleta y las sombras: Tilvo, la azul; el azul es el acento de la landing por pedido de Martín (29/10, «fondo claro de
//     la app; el azul, sólo de acento»);
//   · las tarjetas teñidas, el radio de 26, los títulos (37,44 y 26 a 600, -0,025em y -0,02em) y las píldoras: Fitlo, la tienda;
//   · `--now` (#e2603a): Fitlo, reservado para «esto es ahora». Acá lo usan el punto vivo de los cupos y el reloj del cartel.
//
// El copy, los enlaces, las imágenes y el orden no se tocan: si un texto cambia, esto está mal (el test lo vigila).
// Uso: node scripts/landing-valores-tilvo.mjs <doc.json> <salida.json>   (doc.json = { html, css })
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VALORES = {
  bg: '#eef1f5', card: '#fbfcfd', card2: '#f3f5f8', card3: '#e3e7ee',
  ink: '#121826', ink2: '#2f3747', muted: '#5a6477', tenue: '#6c7a94',
  line: '#12182614', line2: '#12182626',
  accent: '#1f55d6', accentHi: '#1946b8', accentSuave: '#dbe6fb', accentTexto: '#1a49bf',
  good: '#176a3d', goodSuave: '#1d7a481f', bad: '#b42a26', badSuave: '#b42a261a', now: '#e2603a',
  tiles: ['#dbe6fb', '#d5eee8', '#f3e6c8', '#f5dde3'],
  sombra: 'inset 0 0 0 1px #12182614, 0 1px 2px #1218260d, 0 10px 26px -16px #12182638',
  sombraLg: '0 2px 6px #12182612, 0 28px 60px -24px #12182657',
  sombraBoton: '0 6px 16px -8px #1f55d6',
  curva: 'cubic-bezier(.22, 1, .36, 1)',
  fuente: "'Urbanist', system-ui, -apple-system, 'Segoe UI', sans-serif",
};
const V = VALORES;

/** Los colores que no dependen de dónde estén. Los blancos y el #F5F7FA van aparte: son fondo de página o de tarjeta. */
const COLORES = {
  '#12151b': V.ink, '#171a21': V.ink, '#101319': V.ink, '#475467': V.ink2, '#2b313c': V.ink2,
  '#3a4250': V.ink2, '#4a515e': V.muted, '#5b6472': V.muted, '#6b7280': V.muted, '#98a0ac': V.tenue, '#8a92a1': V.tenue,
  '#eef0f3': V.line, '#eaecf1': V.line, '#edeff3': V.line, '#e6e9ee': V.line, '#e3eaf6': V.line,
  '#2f6fed': V.accent, '#9dbbf5': '#1f55d64d', '#d7e3fb': V.accentSuave, '#eaf1fe': V.accentSuave, '#eff4fe': V.accentSuave,
  '#f8fafd': V.card2, '#fafbfc': V.card2,
  '#d0504a': V.bad, '#dc2626': V.bad, '#fbeaea': V.badSuave, '#fef2f2': V.badSuave, '#fdecec': V.badSuave, '#fecaca': '#b42a2633',
  '#1e9e57': V.good, '#e7f5ec': V.goodSuave,
  '#e5484d': V.now,
};
const ALFA = (x) => Math.round(Number(x) * 255).toString(16).padStart(2, '0');

const TAMANOS = {
  '44px': '37.44px', '38px': '34px', '36px': '34px', '33px': '34px', '27px': '26px', '25px': '26px',
  '18.5px': '17px', '18px': '17px', '17px': '15px', '16.5px': '15px', '16px': '15px', '15.5px': '14px', '14.5px': '14px',
  '14px': '13.5px', '13.5px': '12.5px', '13px': '12.5px', '11.5px': '11px', '10px': '11px',
};
const RADIOS = { '8px': '10px', '11px': '10px', '12px': '14px', '16px': '18px', '20px': '24px', '22px': '24px' };

function colores(t) {
  return t
    .replace(/rgba\(\s*47\s*,\s*111\s*,\s*237\s*,\s*([.\d]+)\s*\)/g, (_, a) => `${V.accent}${ALFA(a)}`)
    .replace(/rgba\(\s*16\s*,\s*19\s*,\s*25\s*,\s*([.\d]+)\s*\)/g, (_, a) => `${V.ink}${ALFA(a)}`)
    .replace(/rgba\(\s*229\s*,\s*72\s*,\s*77\s*,\s*([.\d]+)\s*\)/g, (_, a) => `${V.now}${ALFA(a)}`)
    .replace(/rgba\(\s*236\s*,\s*239\s*,\s*244\s*,\s*([.\d]+)\s*\)/g, (_, a) => `#eef1f5${ALFA(a)}`)
    .replace(/rgb\(\s*91\s*,\s*100\s*,\s*114\s*\)/g, V.muted)
    .replace(/rgb\(\s*18\s*,\s*21\s*,\s*27\s*\)/g, V.ink)
    .replace(/#[0-9a-fA-F]{6}\b/g, (c) => COLORES[c.toLowerCase()] ?? c);
}

function sombras(t) {
  return t
    .replace(/0 1px 2px #121826(08|0a)/g, V.sombra)
    .replace(/0 (?:22|24|30)px (?:46|50|70)px -(?:26|28|30)px #121826[0-9a-f]{2}/g, V.sombraLg)
    .replace(/0 (?:12|14|16)px (?:26|34|40)px -(?:14|22|26)px #1f55d6[0-9a-f]{2}/g, V.sombraBoton);
}

function escala(t) {
  return t
    .replace(/font-size:\s*([\d.]+px)/g, (m, v) => (TAMANOS[v] ? `font-size:${TAMANOS[v]}` : m))
    .replace(/font-size:\s*clamp\(28px,\s*3\.4vw,\s*38px\)/g, 'font-size:clamp(22px,2.6vw,26px)')
    .replace(/border-radius:\s*(\d+px)(?![\d ])/g, (m, v) => (RADIOS[v] ? `border-radius:${RADIOS[v]}` : m))
    .replace(/border-radius:\s*(?:99|999)px/g, 'border-radius:99px')
    .replace(/font-weight:\s*(?:700|800|900)(?! !)/g, 'font-weight:600')
    .replace(/'Geist Mono',\s*monospace/g, V.fuente.replace(/'/g, "'"))
    .replace(/'Geist',\s*(?:system-ui,\s*)?sans-serif/g, V.fuente);
}

/** El fondo de la página no es blanco: una sección con fondo propio se vuelve transparente, una tarjeta queda un tono arriba. */
function fondos(html) {
  return html
    .replace(/<(?:section|footer)\b[^>]*>/g, (s) => s
      .replace(/background:\s*#(?:fff|ffffff|f5f7fa)\b;?/gi, 'background:transparent;')
      .replace(/border-(?:top|bottom):\s*1px solid #[0-9a-f]{6};?/gi, ''))
    .replace(/background(-color)?:\s*#(?:fff|ffffff)\b/gi, `background$1:${V.card}`)
    .replace(/background(-color)?:\s*#f5f7fa\b/gi, `background$1:${V.card2}`);
}

/**
 * «Solo 5 cupos»: el aviso de que esto es AHORA. Era rojo de error (fondo, borde y letra), que acá ya significa otra cosa
 * (lo que NO es para ti). Queda una píldora de tarjeta con la letra en tinta y sólo el signo en `--now`: #e2603a como letra chica
 * no llega al contraste sobre el fondo claro. Fitlo también lo usa de marca, no de texto.
 */
function cupos(html) {
  return html
    .replace(/background:#FEF2F2;border:1\.5px solid #FECACA;border-radius:10px/gi, `background:${V.card};box-shadow:${V.sombra};border-radius:99px`)
    .replace(/color:#DC2626;flex:none;animation:mkLive 1\.5s ease-in-out infinite/gi, `color:${V.now};flex:none;animation:mkLive 2.2s ease-in-out infinite`)
    .replace(/color:#DC2626(">Solo \d+ cupos)/gi, `color:${V.ink}$1`)
    .replace(/(class="mk-hdr-cupos" style="[^"]*)color:#DC2626/gi, `$1color:${V.ink2}`);
}

/** Lo que el style de cada elemento no alcanza: el fondo, los títulos, el encabezado, las tarjetas teñidas y el movimiento. */
export const HOJA = `
.gm-libre { background: ${V.bg}; color: ${V.ink}; font-family: ${V.fuente}; font-size: 14px; line-height: 1.45; font-weight: 500; font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }
.gm-libre h1 { letter-spacing: -.025em !important; font-weight: 600 !important; }
.gm-libre h2 { letter-spacing: -.02em !important; font-weight: 600 !important; }
.gm-libre h3 { letter-spacing: -.005em !important; font-weight: 600 !important; }
.gm-libre [data-seccion="t01header"] header { background: ${V.bg} !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; border-bottom: 0 !important; }
.gm-libre #top a[href*="planes"], .gm-libre a.mk-cta, .gm-libre a[style*="background:${V.accent}"] { border-radius: 14px !important; font-weight: 600 !important; }
.gm-libre a[style*="background:${V.accent}"]:hover { background: ${V.accentHi} !important; }
.gm-libre .mk-feature-grid { gap: 18px !important; }
.gm-libre .mk-feature-grid > a { border-radius: 26px !important; border: 0 !important; box-shadow: none !important; background: ${V.tiles[0]} !important; transition: transform .18s ease-out, box-shadow .2s !important; }
.gm-libre .mk-feature-grid > a:nth-child(4n+2) { background: ${V.tiles[1]} !important; }
.gm-libre .mk-feature-grid > a:nth-child(4n+3) { background: ${V.tiles[2]} !important; }
.gm-libre .mk-feature-grid > a:nth-child(4n+4) { background: ${V.tiles[3]} !important; }
.gm-libre .mk-feature-grid > a:hover { transform: translateY(-2px) !important; box-shadow: ${V.sombra} !important; }
.gm-libre .mk-hdr-cupos::before { content: ''; display: inline-block; width: 7px; height: 7px; margin-right: 6px; border-radius: 50%; background: ${V.now}; vertical-align: 1px; animation: mkLive 2.2s ease-in-out infinite; }
.vsl-root { background: ${V.bg} !important; font-family: ${V.fuente} !important; }
.gm-libre .mk-feature-grid > a > div:nth-child(3) { color: #121826a8 !important; }
.gm-libre .mkpl-card { border: 0; border-radius: 24px; box-shadow: ${V.sombra}; }
.gm-libre .mkpl-card:not(.mkpl-programa) { background: ${V.card}; }
.gm-libre .mkpl-card.destacado { box-shadow: 0 0 0 2px ${V.accent}, ${V.sombraLg}; }
.gm-libre .mkpl-insignia { background: ${V.accent}; }
.gm-libre .mkpl-btn { background: ${V.accent}; border-radius: 14px; box-shadow: ${V.sombraBoton}; font-weight: 600; }
.gm-libre .mkpl-btn.borde { background: ${V.card}; color: ${V.accent} !important; box-shadow: inset 0 0 0 1.5px ${V.accent}; }
.gm-libre .mk-precios { color: ${V.ink}; }
.gm-libre .mk-precios-titulo { font-size: 26px; font-weight: 600; letter-spacing: -.02em; }
.gm-libre .mk-precios-sub, .gm-libre .mk-precios-pie { color: ${V.muted}; }
.gm-libre .mk-precios-pie a { color: ${V.accent}; }
@media (max-width: 480px) {
  .gm-libre .mk-feature-grid { gap: 12px !important; }
}
`;

/** La landing con los valores. Devuelve otro { html, css }: no toca textos, enlaces, imágenes ni el orden. */
export function conValores({ html, css }) {
  const h = escala(sombras(colores(fondos(cupos(html)))));
  const c = escala(sombras(colores(css)))
    .replace(/@import url\('https:\/\/fonts\.googleapis\.com\/css2\?family=Geist[^']*'\);/, `@import url('https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700&display=swap');`);
  return { html: h, css: c + HOJA };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [entrada, salida] = process.argv.slice(2);
  if (!entrada || !salida) { console.error('Uso: node scripts/landing-valores-tilvo.mjs <doc.json> <salida.json>'); process.exit(1); }
  fs.writeFileSync(salida, JSON.stringify(conValores(JSON.parse(fs.readFileSync(entrada, 'utf8')))));
  console.log('listo', salida);
}
