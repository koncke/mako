// =============================================================================
// capturar.mjs — la FOTO y los VALORES de una página de referencia, para copiarla tal cual
// =============================================================================
// Martín, 4/11/2026: «que te centres en que sea primero la copia, es decir, que se vea exactamente igual que la copia,
// y después la adaptación con MaKo… copiarlo todo, desde las animaciones de entrada, las animaciones de hover, las
// animaciones de clic». El movimiento de ENTRADA lo lee medir-demo.py del bundle (GSAP no se ve en el estilo
// computado). Esto mide lo que se ve QUIETO y lo que pasa al pasar el cursor y al apretar:
//
//   · una captura de página entera a 1440 (y a 390 con --telefono), después de que terminó la entrada;
//   · las variables CSS de :root y de <body>, la tipografía (familias, la escala de tamaños, pesos, interlineado);
//   · cada PANEL (lo que tiene fondo, borde o sombra y un tamaño de panel): su rectángulo, radio, sombra, padding;
//   · cada control (botón, link, fila, pestaña, celda clicable): su transición declarada, y lo que CAMBIA al pasarle
//     el cursor y al apretarlo (estilo antes, durante y después), con una captura recortada de cada estado.
//
// Uso (desde esta carpeta):
//   node capturar.mjs <url> <carpeta-de-salida> [--telefono] [--max-controles 40] [--espera 4000]
//   node capturar.mjs https://demo.codeandchill.store/halden/ ../demos/halden/captura
//
// Sale `valores.json`, `pagina-1440.png` (y `pagina-390.png`) y `estados/<n>-{reposo,hover,activo}.png`.
// ⚠️ La pestaña tiene que estar VISIBLE: con la ventana oculta `requestAnimationFrame` no corre y GSAP queda en el
//    primer fotograma (opacity 0). Playwright sin cabeza corre igual; un navegador real con el panel tapado, no.
// ⚠️ Es una herramienta de MEDIR: no copia HTML, CSS ni JS de la referencia. Lo que se lleva son números.
// =============================================================================

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Playwright NO es dependencia del repo (AGENTS.md: se instala fuera, en una carpeta aparte). Se busca con `require`, que
// respeta NODE_PATH: `npm i playwright` en una carpeta temporal y `NODE_PATH=<esa carpeta>/node_modules node capturar.mjs …`.
let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  console.error('No encuentro Playwright. En una carpeta aparte: npm i playwright && npx playwright install chromium; después NODE_PATH=<carpeta>/node_modules node capturar.mjs …');
  process.exit(2);
}

const args = process.argv.slice(2);
const url = args[0];
const salida = args[1];
if (!url || !salida) {
  console.error('Uso: node capturar.mjs <url> <carpeta-de-salida> [--telefono] [--max-controles N] [--espera ms]');
  process.exit(2);
}
const opcion = (nombre, def) => {
  const i = args.indexOf(nombre);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : def;
};
const conTelefono = args.includes('--telefono');
const maxControles = opcion('--max-controles', 40);
const espera = opcion('--espera', 4000);
mkdirSync(join(salida, 'estados'), { recursive: true });

/** Lo que se lee de la página quieta. Corre ADENTRO del navegador: no puede usar nada de afuera. */
function leerPagina() {
  const css = (el) => getComputedStyle(el);
  const raiz = css(document.documentElement);
  const variables = {};
  for (const hoja of [...document.styleSheets]) {
    let reglas;
    try { reglas = [...hoja.cssRules]; } catch { continue; }
    for (const r of reglas) {
      if (!r.style || !/^(:root|html|body)/.test(r.selectorText ?? '')) continue;
      for (const prop of r.style) if (prop.startsWith('--')) variables[prop] = raiz.getPropertyValue(prop).trim();
    }
  }
  const visibles = [...document.querySelectorAll('body *')].filter((el) => {
    const r = el.getBoundingClientRect();
    const s = css(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.01;
  });
  const conTexto = visibles.filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
  const tipos = new Map();
  for (const el of conTexto) {
    const s = css(el);
    const clave = `${s.fontFamily} | ${s.fontSize} | ${s.fontWeight} | ${s.lineHeight} | ${s.letterSpacing} | ${s.color}`;
    const t = tipos.get(clave) ?? { familia: s.fontFamily, tamano: s.fontSize, peso: s.fontWeight, interlineado: s.lineHeight, espaciado: s.letterSpacing, color: s.color, veces: 0, ejemplo: '' };
    t.veces++;
    if (!t.ejemplo) t.ejemplo = el.textContent.trim().slice(0, 40);
    tipos.set(clave, t);
  }
  const transparente = (c) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
  const paneles = visibles.filter((el) => {
    const r = el.getBoundingClientRect();
    const s = css(el);
    const marca = !transparente(s.backgroundColor) || s.boxShadow !== 'none' || s.borderTopWidth !== '0px';
    return marca && r.width >= 140 && r.height >= 70 && r.width < innerWidth * 0.99;
  }).map((el) => {
    const r = el.getBoundingClientRect();
    const s = css(el);
    return {
      etiqueta: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''),
      x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height),
      fondo: s.backgroundColor, borde: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`, radio: s.borderRadius,
      sombra: s.boxShadow, padding: s.padding, gap: s.gap, grilla: s.display === 'grid' ? s.gridTemplateColumns : null,
      texto: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 60),
    };
  });
  return {
    url: location.href, ancho: innerWidth, alto: document.documentElement.scrollHeight,
    fondo: css(document.body).backgroundColor, letra: css(document.body).fontFamily,
    variables, tipografia: [...tipos.values()].sort((a, b) => b.veces - a.veces), paneles,
  };
}

/** Los controles a probar: lo que se puede tocar. */
function marcarControles(max) {
  const css = (el) => getComputedStyle(el);
  // Lo tocable: lo que es un control por su etiqueta o su rol, o lo que pone el cursor de mano (muchas referencias arman
  // filas y tarjetas con <div>). De un anidado de manos se queda el de AFUERA: el de adentro hereda el cursor.
  const esControl = (el) => el.matches('a, button, [role="button"], [role="tab"], [role="row"], [onclick], [tabindex]') || css(el).cursor === 'pointer';
  const candidatos = [...document.querySelectorAll('body *')]
    .filter((el) => esControl(el) && !(el.parentElement && el.parentElement !== document.body && esControl(el.parentElement)))
    .filter((el) => {
      const r = el.getBoundingClientRect();
      const tocable = css(el).cursor === 'pointer' || el.tagName === 'BUTTON' || el.tagName === 'A';
      return r.width > 8 && r.height > 8 && r.top + scrollY >= 0 && tocable;
    });
  const vistos = new Set();
  const elegidos = [];
  for (const el of candidatos) {
    const firma = el.tagName + '|' + (typeof el.className === 'string' ? el.className : '') + '|' + css(el).transition;
    if (vistos.has(firma)) continue;
    vistos.add(firma);
    el.setAttribute('data-mk-medir', String(elegidos.length));
    elegidos.push(el);
    if (elegidos.length >= max) break;
  }
  return elegidos.length;
}

/** El estilo de un control, lo que importa para comparar estados. */
function estiloDe(n) {
  const el = document.querySelector(`[data-mk-medir="${n}"]`);
  if (!el) return null;
  const s = getComputedStyle(el);
  const props = ['color', 'backgroundColor', 'borderColor', 'boxShadow', 'transform', 'opacity', 'outline', 'textDecorationLine', 'filter', 'scale', 'translate'];
  const r = el.getBoundingClientRect();
  return {
    etiqueta: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''),
    texto: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40),
    transicion: { propiedad: s.transitionProperty, duracion: s.transitionDuration, curva: s.transitionTimingFunction, demora: s.transitionDelay },
    cursor: s.cursor, rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
    estilo: Object.fromEntries(props.map((p) => [p, s[p]])),
  };
}

const diferencias = (a, b) => {
  if (!a || !b) return {};
  const out = {};
  for (const k of Object.keys(a.estilo)) if (a.estilo[k] !== b.estilo[k]) out[k] = [a.estilo[k], b.estilo[k]];
  return out;
};

const navegador = await chromium.launch();
try {
  const anchos = conTelefono ? [1440, 390] : [1440];
  const resultado = { medido: new Date().toISOString(), url, vistas: {} };
  for (const ancho of anchos) {
    const pagina = await navegador.newPage({ viewport: { width: ancho, height: 900 }, deviceScaleFactor: 1 });
    await pagina.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    await pagina.waitForTimeout(espera);
    await pagina.screenshot({ path: join(salida, `pagina-${ancho}.png`), fullPage: true });
    const vista = await pagina.evaluate(leerPagina);
    if (ancho === 1440) {
      const cuantos = await pagina.evaluate(marcarControles, maxControles);
      vista.controles = [];
      for (let n = 0; n < cuantos; n++) {
        const loc = pagina.locator(`[data-mk-medir="${n}"]`);
        try {
          await loc.scrollIntoViewIfNeeded({ timeout: 2000 });
          await pagina.mouse.move(0, 0);
          await pagina.waitForTimeout(400);
          const reposo = await pagina.evaluate(estiloDe, n);
          await loc.screenshot({ path: join(salida, 'estados', `${n}-reposo.png`), timeout: 2000 }).catch(() => {});
          await loc.hover({ timeout: 2000 });
          await pagina.waitForTimeout(600);
          const hover = await pagina.evaluate(estiloDe, n);
          await loc.screenshot({ path: join(salida, 'estados', `${n}-hover.png`), timeout: 2000 }).catch(() => {});
          const caja = await loc.boundingBox();
          let activo = null;
          if (caja) {
            await pagina.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
            await pagina.mouse.down();
            await pagina.waitForTimeout(120);
            activo = await pagina.evaluate(estiloDe, n);
            await loc.screenshot({ path: join(salida, 'estados', `${n}-activo.png`), timeout: 2000 }).catch(() => {});
            await pagina.mouse.up();
          }
          vista.controles.push({ n, ...reposo, alPasar: diferencias(reposo, hover), alApretar: diferencias(reposo, activo) });
          // Un clic puede navegar o abrir algo: se vuelve a la página y se vuelve a marcar.
          if (pagina.url() !== url) {
            await pagina.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
            await pagina.waitForTimeout(espera);
            await pagina.evaluate(marcarControles, maxControles);
          }
        } catch (e) {
          vista.controles.push({ n, error: String(e).slice(0, 160) });
        }
      }
    }
    resultado.vistas[ancho] = vista;
    await pagina.close();
  }
  writeFileSync(join(salida, 'valores.json'), JSON.stringify(resultado, null, 2));
  const v = resultado.vistas[1440];
  console.log(`Listo: ${salida} · ${v.paneles.length} paneles · ${v.tipografia.length} estilos de letra · ${v.controles?.length ?? 0} controles · ${Object.keys(v.variables).length} variables`);
} finally {
  await navegador.close();
}
