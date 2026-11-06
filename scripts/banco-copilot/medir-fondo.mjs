// =============================================================================
// El banco del Marketing CoPilot, medido con un navegador (6/11/2026): un solo fondo, nada que se salga, la caja entera.
// =============================================================================
// Martín, 6/11/2026: «el background no es igual en toda la tab de copilot, es blanco y crema en algunos lados». Por cada pantalla, en
// claro y en oscuro, a 390, 768, 1024 y 1440, con la barra de la app abierta y plegada:
//   · el FONDO: en una grilla de puntos sobre toda la ventana (también con la página scrolleada hasta abajo), el primer ancestro con
//     fondo de cada punto; si es un contenedor de página (no una tarjeta), su color. Tiene que haber UNO, el del body;
//   · que nada se salga a lo ancho (scrollWidth del documento);
//   · la caja de la charla: el campo mide al menos 160 px (a 390 los botones de la caja de la casa dejan 188) y su texto de ayuda entra
//     en un renglón;
//   · las tarjetas de los referentes no se pisan entre sí ni se les sale el texto.
// Uso: node scripts/banco-copilot/build.mjs && node scripts/banco-copilot/servir.cjs (otra consola) y
//      node scripts/banco-copilot/medir-fondo.mjs [carpeta-de-capturas]
// Sale con 1 si algo no se cumple. Usa el Playwright de la máquina (en la nube viene instalado).
// =============================================================================
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:4591';
const carpeta = process.argv[2] ?? null;
if (carpeta) fs.mkdirSync(carpeta, { recursive: true });

const P = (o) => `perfil=${encodeURIComponent(JSON.stringify(o))}`;
const PANTALLAS = [
  { id: 'entrada', url: '/?' },
  { id: 'referentes', url: `/?${P({ entrada: 'referente' })}` },
  { id: 'doglio', url: `/?${P({ entrada: 'referente', referente: 'francisco-doglio' })}` },
  { id: 'propuesta', url: `/?${P({ entrada: 'funnel', funnel: 'vsl-llamada', ticket: 5000, presupuestoMes: 3000, llamadas: 'yo', competencia: 'si' })}` },
  { id: 'hoy', url: '/?pantalla=mb&vista=hoy' },
  { id: 'campanas', url: '/?pantalla=mb&vista=campanas' },
  { id: 'plan', url: '/?pantalla=mb&vista=plan' },
  { id: 'biblioteca', url: '/?pantalla=mb&vista=biblioteca' },
  { id: 'semana', url: `/?pantalla=sin&${P({ entrada: 'funnel', funnel: 'organico', ticket: 1000, objetivo: 'ventas', ritmo: 3, formato: 'reels', competencia: 'luego' })}` },
  { id: 'ajustes', url: `/?pantalla=ajustes&${P({ entrada: 'funnel', funnel: 'vsl-llamada', ticket: 5000, presupuestoMes: 3000, llamadas: 'yo' })}` },
];
const ANCHOS = [390, 768, 1024, 1440];
const BARRAS = ['plegada', 'abierta'];
const TEMAS = ['claro', 'oscuro'];
const PAGINA = /(^|\s)(aa|aa-arranque|aa-copiloto|aa-hoy|aa-pagina|aa-ajustes|aa-sinanuncios|aa-hoja|mb)(\s|$)/;

/** Corre en la página: lo que se mide. */
function medir(PAGINA_SRC) {
  const PAG = new RegExp(PAGINA_SRC);
  const opaco = (c) => c && c !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(c);
  const fondos = new Map();
  const fondoDe = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const c = getComputedStyle(e).backgroundColor;
      if (opaco(c)) return { e, c };
    }
    return { e: document.documentElement, c: getComputedStyle(document.body).backgroundColor };
  };
  const pasada = () => {
    const W = innerWidth, H = innerHeight;
    for (let x = 4; x < W; x += Math.max(24, W / 24)) for (let y = 4; y < H; y += Math.max(24, H / 20)) {
      const el = document.elementFromPoint(x, y);
      if (!el || el.closest('aside[data-sidebar]')) continue;
      const { e, c } = fondoDe(el);
      const esPagina = e === document.body || e === document.documentElement || e.tagName === 'MAIN' || PAG.test(e.className || '');
      if (esPagina) fondos.set(c, (fondos.get(c) ?? 0) + 1);
    }
  };
  pasada();
  window.scrollTo(0, document.documentElement.scrollHeight);
  pasada();
  window.scrollTo(0, 0);
  const body = getComputedStyle(document.body).backgroundColor;
  const sale = document.documentElement.scrollWidth - innerWidth;
  // La caja de la charla.
  const campo = document.querySelector('.aa-arranque textarea');
  let caja = null;
  if (campo) {
    const r = campo.getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(campo).lineHeight) || 20;
    const prev = campo.value; campo.value = '';
    caja = { ancho: Math.round(r.width), renglones: Math.round((campo.scrollHeight - parseFloat(getComputedStyle(campo).paddingTop) - parseFloat(getComputedStyle(campo).paddingBottom)) / lh), placeholder: campo.placeholder };
    campo.value = prev;
  }
  // Las tarjetas de los referentes.
  const tarjetas = [...document.querySelectorAll('.aa-ref')].map((b) => ({ r: b.getBoundingClientRect(), sale: b.scrollWidth - b.clientWidth }));
  let pisadas = 0, cortadas = 0;
  for (let i = 0; i < tarjetas.length; i++) {
    if (tarjetas[i].sale > 1) cortadas++;
    for (let j = i + 1; j < tarjetas.length; j++) {
      const a = tarjetas[i].r, b = tarjetas[j].r;
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) pisadas++;
    }
  }
  return { fondos: [...fondos.entries()], body, sale, caja, tarjetas: tarjetas.length, pisadas, cortadas };
}

const browser = await chromium.launch();
const fallas = [];
let filas = 0;
try {
  for (const tema of TEMAS) for (const barra of BARRAS) for (const ancho of ANCHOS) {
    const ctx = await browser.newContext({ viewport: { width: ancho, height: ancho <= 390 ? 844 : 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    for (const s of PANTALLAS) {
      await page.goto(`${BASE}${s.url}&tema=${tema}&barra=${ancho <= 390 ? 'ninguna' : barra}`);
      await page.waitForTimeout(500);
      const m = await page.evaluate(medir, PAGINA.source);
      filas++;
      const id = `${s.id} · ${tema} · ${ancho} · barra ${ancho <= 390 ? 'ninguna' : barra}`;
      const colores = m.fondos.map(([c]) => c);
      if (colores.length !== 1 || colores[0] !== m.body) fallas.push(`${id}: el fondo de la página no es uno solo: ${JSON.stringify(m.fondos)} (body ${m.body})`);
      if (m.sale > 1) fallas.push(`${id}: se sale ${m.sale} px a lo ancho`);
      if (m.caja && (m.caja.ancho < 160 || m.caja.renglones > 1)) fallas.push(`${id}: la caja mide ${m.caja.ancho} px y su ayuda ocupa ${m.caja.renglones} renglones`);
      if (m.pisadas || m.cortadas) fallas.push(`${id}: ${m.pisadas} tarjetas pisadas y ${m.cortadas} cortadas de ${m.tarjetas}`);
      if (carpeta && ((tema === 'claro' && (barra === 'plegada' || ancho === 1440)) || (tema === 'oscuro' && barra === 'plegada' && (ancho === 1440 || ancho === 390)))) {
        if (ancho > 390 || barra === 'plegada') await page.screenshot({ path: path.join(carpeta, `banco-${s.id}-${tema}-${ancho}${ancho > 390 ? `-barra-${barra}` : ''}.png`), fullPage: false });
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(`${filas} pantallas medidas (${PANTALLAS.length} × ${TEMAS.length} temas × ${BARRAS.length} barras × ${ANCHOS.length} anchos).`);
if (fallas.length) { console.log(`✖ ${fallas.length}:\n  ${fallas.join('\n  ')}`); process.exit(1); }
console.log('✓ un solo fondo, nada se sale a lo ancho, la caja entera y las tarjetas sin pisarse.');
