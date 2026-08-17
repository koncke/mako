// Captura el CONTENIDO de cada lección de Avatar Hype Academy: el documento, sus
// tabs, sus imágenes y sus links. Es lo que falta para replicar el curso y no solo
// mostrar el video.
//
// ── Qué hay adentro de una lección, y por qué no alcanza con el texto ────────
// El documento no es prosa: es una estructura con significado.
//
//   .ugc-paper-title                 el título del documento
//   <section> .ugc-sec-h + .ugc-sec-sub    una sección numerada
//   .ugc-card                        un bloque con etiqueta, badge y botón «copiar»
//     .ugc-media                     imagen de referencia (webp)
//     .ugc-pre                       el prompt, que es lo que se copia
//     .ugc-clip-part                 las PARTES de un prompt de clip, cada una con
//                                    su clase: camara · guion · voz · acento · rec · edit
//   .ugc-legend-row                  la leyenda que explica qué es cada parte
//
// Guardar solo `innerText` perdería justo eso: qué parte del prompt es la cámara y
// cuál el guion, que es la mitad de lo que el curso enseña.
//
// ⚠️ Las imágenes se sirven desde `/api/doc-media/<...>.webp`, o sea detrás de la
//    sesión. Se listan acá y se bajan aparte (avatarhype-media.mjs), porque un HTML
//    con esas rutas adentro se ve roto para cualquiera que no esté logueado allá.
//
//   node <abs>\scripts\avatarhype-doc.mjs --plan C:\cursos\creativos-ugc-realistas\plan.json
//   node <abs>\scripts\avatarhype-doc.mjs --plan … --solo ugc-sin-producto
//
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PLAN = arg('plan', '');
const PORT = Number(arg('port', 9333));
const SOLO = arg('solo', '');
const BASE = 'https://app.avatarhype.online';

if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }
const plan = JSON.parse(readFileSync(PLAN, 'utf8').replace(/^\uFEFF/, ''));
const dirDocs = join(dirname(PLAN), 'docs');
mkdirSync(dirDocs, { recursive: true });

// Las LECCIONES, no las clases: el documento es de la lección, y una lección con dos
// partes de video tiene un solo documento.
const lecciones = (plan.lecciones ?? []).filter((l) => !SOLO || l.slug === SOLO);
if (!lecciones.length) { console.error('\n  ✖ El plan no trae `lecciones`. Volvé a correr avatarhype-plan.mjs.\n'); process.exit(1); }

// ── CDP, con timeout en todo (ver la nota de avatarhype-plan.mjs) ────────────
const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const tab = tabs.find((t) => t.type === 'page' && /app\.avatarhype\.online/i.test(t.url));
if (!tab) { console.error('\n  ✖ No hay pestaña en app.avatarhype.online (corré scripts/curso-perfil.ps1)\n'); process.exit(1); }
const sock = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => { sock.onopen = res; sock.onerror = () => rej(new Error('CDP no conecta')); });
let id = 0; const pend = new Map();
sock.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } };
const cmd = (method, params = {}) => new Promise((r) => {
  const i = ++id;
  const t = setTimeout(() => { if (pend.has(i)) { pend.delete(i); console.error(`  ⚠ CDP sin respuesta: ${method}`); r(null); } }, 30000);
  pend.set(i, (res) => { clearTimeout(t); r(res); });
  sock.send(JSON.stringify({ id: i, method, params }));
});
const ev = async (e) => (await cmd('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

await cmd('Page.enable');
await cmd('Emulation.setFocusEmulationEnabled', { enabled: true });   // sin esto no renderiza
await dormir(300);
if ((await ev('document.visibilityState')) !== 'visible') {
  console.error('\n  ✖ La pestaña sigue `hidden`: nada va a renderizar.\n');
  process.exit(1);
}

// Lee el panel de una tab: se clickea la tab y se saca su HTML. Las tabs son
// `role="tab"` con `aria-controls`, así que se enganchan por eso y no por su texto.
const leerTab = async (idTab) => ev(`(async () => {
  const t = document.getElementById(${JSON.stringify(idTab)});
  if (!t) return null;
  t.click();
  await new Promise((r) => setTimeout(r, 700));
  const p = document.getElementById(t.getAttribute('aria-controls'));
  if (!p) return null;
  const caja = p.querySelector('.ugc-paper') || p;
  const limpio = caja.cloneNode(true);
  // Los agujeros del papel son decoración pura (22 <i> vacíos) y el sr-only son
  // rótulos de accesibilidad del botón copiar: no son contenido del curso.
  limpio.querySelectorAll('.ugc-paper-holes, .sr-only').forEach((e) => e.remove());
  return { html: limpio.innerHTML, texto: (caja.innerText || '').trim() };
})()`);

const salida = [];
for (const [i, l] of lecciones.entries()) {
  await cmd('Emulation.setFocusEmulationEnabled', { enabled: true });
  await cmd('Page.navigate', { url: BASE + l.ruta });
  let listo = false;
  for (let k = 0; k < 30; k++) {
    await dormir(1000);
    if ((await ev(`!!document.querySelector('.ugc-paper') || !!document.querySelector('.ugc-vcard')`)) === true) { listo = true; break; }
  }
  if (!listo) {
    console.error(`\n  ⛔ ${l.slug} NO RENDERIZÓ. Corto: un documento vacío se lee como «esta lección no tiene contenido».\n`);
    sock.close(); process.exit(1);
  }
  // El documento carga imágenes por lazy-load: sin bajar la página se capturan de menos.
  await ev(`(async () => { for (let y = 0; y < 20; y++) { window.scrollBy(0, window.innerHeight); await new Promise(r => setTimeout(r, 180)); } window.scrollTo(0, 0); })()`);
  await dormir(1200);

  const tabsDisponibles = await ev(`[...document.querySelectorAll('[role="tab"]')].map((t) => ({ id: t.id, label: (t.innerText||'').trim() }))`);
  const paneles = {};
  for (const t of tabsDisponibles ?? []) {
    // El feedback es un formulario para MANDARLE algo a la plataforma de origen: no
    // es contenido del curso y replicarlo sería replicar un botón que no hace nada.
    if (/feedback/i.test(t.label)) continue;
    const p = await leerTab(t.id);
    if (p?.html) paneles[t.label] = p;
  }

  const activos = await ev(`(() => {
    const abs = (u) => u && u.startsWith('/') ? ${JSON.stringify(BASE)} + u : u;
    return {
      imagenes: [...new Set([...document.querySelectorAll('.ugc-paper img')].map((i) => i.getAttribute('src')).filter(Boolean))],
      links: [...new Set([...document.querySelectorAll('.ugc-paper a')].map((a) => a.getAttribute('href')).filter(Boolean))],
      medios: [...new Set([...document.querySelectorAll('.ugc-paper video, .ugc-paper source')].map((v) => v.getAttribute('src')).filter(Boolean))],
      titulo: (document.querySelector('.ugc-paper-title') || {}).textContent || null,
    };
  })()`);

  const ficha = {
    slug: l.slug, codigo: l.codigo, titulo: l.titulo, ruta: l.ruta,
    tituloDocumento: activos?.titulo ?? null,
    paneles,
    imagenes: activos?.imagenes ?? [],
    medios: activos?.medios ?? [],
    links: activos?.links ?? [],
  };
  writeFileSync(join(dirDocs, `${l.slug}.json`), JSON.stringify(ficha, null, 2), 'utf8');
  salida.push(ficha);

  const kb = Object.values(paneles).reduce((t, p) => t + p.html.length, 0);
  console.log(`  ${String(i + 1).padStart(2)}/${lecciones.length}  ${(l.codigo ?? '—').padEnd(7)} ${String(l.slug).padEnd(28)} tabs:${Object.keys(paneles).join('+') || '—'}  ${Math.round(kb / 1024)} KB  img:${ficha.imagenes.length}  links:${ficha.links.length}`);
}

const totalImg = new Set(salida.flatMap((s) => s.imagenes)).size;
const externos = new Set(salida.flatMap((s) => s.links).filter((h) => /^https?:/i.test(h)));
const internos = new Set(salida.flatMap((s) => s.links).filter((h) => h.startsWith('/')));
console.log('\n' + '─'.repeat(70));
console.log(`  lecciones capturadas: ${salida.length}`);
console.log(`  imágenes distintas  : ${totalImg}`);
console.log(`  links internos      : ${internos.size}  ${[...internos].slice(0, 4).join(' · ')}`);
console.log(`  links externos      : ${externos.size}  ${[...externos].slice(0, 4).join(' · ')}`);
console.log(`  → ${dirDocs}`);
console.log('─'.repeat(70));
console.log(`\n  Siguiente: bajar las imágenes (viven detrás de la sesión, no se pueden linkear).\n`);
sock.close();
