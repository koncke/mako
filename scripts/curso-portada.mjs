// Baja la MINIATURA del curso y la deja en public/cono-portadas/<slug>.<ext>.
//
// El portal la muestra en la tarjeta de la grilla de cursos y arriba del título al
// entrar. Va como archivo estático del repo y no como id de Drive porque se pinta en
// la grilla de TODOS los cursos: una miniatura de Drive por tarjeta son N requests a
// un dominio externo, y encima exige que cada archivo esté compartido.
//
// De dónde sale: de la tarjeta del catálogo, que es donde vive de forma determinista.
// Buscar «la imagen más grande de la landing» sería una heurística que agarra
// cualquier cosa; el <img> de la tarjeta cuyo <a> apunta a ESTE curso es un dato.
//
//   node <abs>\scripts\curso-portada.mjs --plan C:\cursos\<slug>\plan.json

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const PLAN = arg('plan', '');
const PORT = Number(arg('port', 9333));
const REPO = arg('repo', 'C:\\Users\\marti\\OneDrive\\Escritorio\\dashboard-marketing-main\\dashboard-marketing');
const ORIGEN = arg('origen', 'https://cursoselite.com.mx');
const CATALOGOS = (arg('catalogos', '/Catalog,/vip/') || '').split(',').filter(Boolean);

if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }
const plan = JSON.parse(readFileSync(PLAN, 'utf8').replace(/^﻿/, ''));

// El slug del PORTAL (el que usa curso-a-portal para nombrar el archivo del curso),
// no el de la carpeta: si no coinciden, la portada queda huérfana y no se muestra.
const slugPortal = (plan.slug ?? '').replace(/^curso-(de-)?/, '');
// El slug de la PLATAFORMA, para encontrar la tarjeta en el catálogo.
const slugPlataforma = String(plan.pagina ?? '').split('/').filter(Boolean).slice(-2, -1)[0] ?? plan.slug;

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pend = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pend.has(m.id)) {
        const { ok, no } = this.pend.get(m.id); this.pend.delete(m.id);
        m.error ? no(new Error(m.error.message)) : ok(m.result);
      }
    });
  }
  enviar(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((ok, no) => {
      this.pend.set(id, { ok, no });
      setTimeout(() => this.pend.has(id) && (this.pend.delete(id), no(new Error(`timeout ${method}`))), 25000);
    });
  }
}

const main = async () => {
  let lista;
  try { lista = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()); }
  catch { console.error(`\n  ✖ No hay CDP en ${PORT}. Corré curso-perfil.ps1.\n`); process.exit(1); }
  const t = lista.find((x) => x.type === 'page' && !x.url.startsWith('devtools://'));
  if (!t) { console.error('  ✖ No hay pestañas.\n'); process.exit(1); }

  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((ok, no) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', () => no(new Error('no pude conectar a CDP')), { once: true });
  });
  const cdp = new Cdp(ws);
  await cdp.enviar('Runtime.enable');
  await cdp.enviar('Page.enable');
  const ev = async (expr) => (await cdp.enviar('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;

  console.log(`\n  Curso     : ${plan.curso}`);
  console.log(`  Plataforma: ${slugPlataforma}`);
  console.log(`  Portal    : ${slugPortal}`);

  let url = null;
  for (const ruta of CATALOGOS) {
    if (url) break;
    process.stdout.write(`  buscando en ${ORIGEN}${ruta} … `);
    await cdp.enviar('Page.navigate', { url: ORIGEN + ruta });
    for (let i = 0; i < 30 && !url; i++) {
      await new Promise((r) => setTimeout(r, 400));
      url = await ev(`(() => {
        const a = [...document.querySelectorAll('a[href]')].find(x => x.href.includes(${JSON.stringify(slugPlataforma)}));
        if (!a) return null;
        // La imagen puede estar en el <a> o en la tarjeta que lo contiene.
        const cont = a.closest('article,li,div') || a;
        const img = a.querySelector('img') || cont.querySelector('img');
        if (img?.currentSrc || img?.src) return img.currentSrc || img.src;
        // Algunas tarjetas la ponen como background-image.
        for (const el of [a, cont, ...cont.querySelectorAll('*')].slice(0, 40)) {
          const bg = getComputedStyle(el).backgroundImage;
          const m = bg && bg.match(/url\\(["']?(https?:[^"')]+)["']?\\)/);
          if (m) return m[1];
        }
        return null;
      })()`);
    }
    console.log(url ? 'encontrada' : 'no está acá');
  }
  ws.close();

  if (!url) {
    console.error(`\n  ✖ No encontré la miniatura de este curso en el catálogo.`);
    console.error(`    Sin portada el portal muestra la tarjeta sin imagen (no se rompe nada).\n`);
    process.exit(3);
  }
  console.log(`  imagen    : ${url.slice(0, 100)}`);

  const res = await fetch(url);
  if (!res.ok) { console.error(`\n  ✖ La imagen dio HTTP ${res.status}\n`); process.exit(1); }
  const buf = Buffer.from(await res.arrayBuffer());

  // La extensión sale de los BYTES, no de la URL: muchas CDN sirven webp desde una
  // ruta que dice .jpg, y un archivo con extensión mentida no lo pinta el navegador.
  const firma = buf.subarray(0, 12);
  const ext = firma.subarray(0, 3).toString('hex') === 'ffd8ff' ? 'jpg'
    : firma.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' ? 'png'
    : firma.subarray(8, 12).toString('latin1') === 'WEBP' ? 'webp'
    : firma.subarray(0, 6).toString('latin1').startsWith('GIF8') ? 'gif'
    : null;
  if (!ext) {
    console.error(`\n  ✖ Lo que bajó no es una imagen (empieza con ${JSON.stringify(firma.toString('latin1').slice(0, 12))}).\n`);
    process.exit(1);
  }

  const dir = join(REPO, 'public', 'cono-portadas');
  mkdirSync(dir, { recursive: true });
  // Una sola portada por curso: si había otra con distinta extensión, se reemplaza.
  for (const f of readdirSync(dir)) {
    if (f.replace(/\.[^.]+$/, '') === slugPortal && f !== `${slugPortal}.${ext}`) unlinkSync(join(dir, f));
  }
  const salida = join(dir, `${slugPortal}.${ext}`);
  writeFileSync(salida, buf);

  console.log(`\n  ✓ ${(buf.length / 1024).toFixed(0)} KB · ${ext}`);
  console.log(`  → ${salida}`);
  console.log(`\n  Volvé a correr curso-a-portal.mjs para que la ficha la declare.\n`);
};

main().catch((e) => { console.error(`\n  ✖ ${e.message}\n`); process.exit(1); });
