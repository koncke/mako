// Baja los RECURSOS de un curso de /vip/ (PDFs, workbooks, plantillas).
//
// Por qué existe: curso-plan-vip.mjs saca las lecciones del RPC get_vip_lessons_secure
// y deja `pdfs: []`. Pero los cursos de /vip/ tienen material aparte, y son bastantes:
// el de ATV Advantage tiene 71 archivos que no se estaban bajando. El curso quedaba
// "completo" con 247 videos y sin un solo PDF, y nada lo avisaba.
//
// Dos endpoints, y hacen falta los dos:
//   vip_course_resources   -> metadata (título, módulo, file_type, file_size)
//   rpc/get_vip_resource_urls -> la URL FIRMADA de cada archivo
// Se juntan por id. Las URLs firmadas no necesitan sesión, así que la descarga es
// un fetch pelado — pero caducan, así que se capturan y se usan en la misma corrida.
//
// Igual que el resto: se lee lo que el navegador YA pidió con la sesión del usuario,
// no se le pega a la API por fuera.
//
//   node <abs>\scripts\curso-recursos-vip.mjs --plan C:\cursos\<slug>\plan.json

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const PLAN = arg('plan', '');
const PORT = Number(arg('port', 9333));
const SEGUNDOS = Number(arg('segundos', 20));

if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }
const base = dirname(PLAN);
const plan = JSON.parse(readFileSync(PLAN, 'utf8').replace(/^﻿/, ''));
const destino = join(base, 'recursos');

const limpio = (s) => String(s).normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
  .replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 110) || 'recurso';
const kb = (b) => `${(Number(b) / 1024).toFixed(0)} KB`;

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pend = new Map(); this.oye = [];
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pend.has(m.id)) {
        const { ok, no } = this.pend.get(m.id); this.pend.delete(m.id);
        m.error ? no(new Error(m.error.message)) : ok(m.result);
      } else if (m.method) for (const f of this.oye) f(m);
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

  // ⚠️ Puede haber varias pestañas /watch (una por curso). Sin filtrar por el slug
  // del plan se capturan los recursos del curso EQUIVOCADO, y el error es silencioso.
  const slugPagina = String(plan.pagina ?? '').split('/').filter(Boolean).slice(-2, -1)[0] ?? plan.slug;
  const t = lista.find((x) => x.type === 'page' && /\/watch/.test(x.url) && x.url.includes(slugPagina));
  if (!t) {
    console.error(`\n  ✖ Necesito la pestaña /watch de ESTE curso abierta (busco "${slugPagina}").`);
    console.error(`    Abiertas:`);
    for (const x of lista.filter((y) => y.type === 'page')) console.error(`      ${x.url}`);
    process.exit(1);
  }
  console.log(`\n  Curso   : ${plan.curso}`);
  console.log(`  Pestaña : ${t.url}`);

  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((ok, no) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', () => no(new Error('no pude conectar a CDP')), { once: true });
  });
  const cdp = new Cdp(ws);

  const cap = new Map();
  cdp.oye.push((m) => {
    if (m.method !== 'Network.responseReceived') return;
    const u = m.params.response.url;
    if (/vip_course_resources/.test(u)) cap.set(m.params.requestId, 'meta');
    else if (/get_vip_resource_urls/.test(u)) cap.set(m.params.requestId, 'urls');
    else if (/vip_modules/.test(u)) cap.set(m.params.requestId, 'modules');
  });

  await cdp.enviar('Network.enable');
  await cdp.enviar('Page.enable');
  console.log(`  Recargando y capturando (${SEGUNDOS}s)…`);
  await cdp.enviar('Page.reload', { ignoreCache: true });
  await new Promise((r) => setTimeout(r, SEGUNDOS * 1000));

  const datos = {};
  for (const [rid, clave] of cap) {
    try {
      const { body } = await cdp.enviar('Network.getResponseBody', { requestId: rid });
      const j = JSON.parse(body);
      const n = Array.isArray(j) ? j.length : 1;
      if (!datos[clave] || n > (Array.isArray(datos[clave]) ? datos[clave].length : 1)) datos[clave] = j;
    } catch { /* el body pudo salir del buffer */ }
  }
  ws.close();

  const meta = Array.isArray(datos.meta) ? datos.meta : [];
  const urls = new Map((Array.isArray(datos.urls) ? datos.urls : []).map((r) => [r.id, r.file_url]));
  const mods = new Map((Array.isArray(datos.modules) ? datos.modules : []).map((m) => [m.id, m]));

  if (!meta.length) {
    console.error(`\n  ✖ No capturé vip_course_resources.`);
    console.error(`    Suele ser que salió de caché. Reintentá con --segundos 30.\n`);
    process.exit(1);
  }

  const raizDe = (id) => {
    let c = mods.get(id), visto = new Set();
    while (c?.parent_module_id && mods.has(c.parent_module_id) && !visto.has(c.id)) { visto.add(c.id); c = mods.get(c.parent_module_id); }
    return c ?? null;
  };
  const raices = [...mods.values()].filter((m) => !m.parent_module_id || !mods.has(m.parent_module_id))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const ordenRaiz = new Map(raices.map((m, i) => [m.id, i + 1]));

  mkdirSync(destino, { recursive: true });
  console.log(`  Recursos: ${meta.length} · con URL firmada: ${urls.size}\n`);

  let ok = 0, ya = 0, sinUrl = 0;
  const fallos = [];
  const indice = [];

  // ⚠️ Los títulos NO son únicos: en este curso hay 7 recursos distintos llamados
  // «Miro» dentro del mismo módulo. La primera versión los nombraba igual y se
  // sobrescribían: reportó «71 bajado(s) · 0 con error» con 64 archivos en disco.
  // Un fallo que se presenta como éxito, otra vez. El nombre se hace único de
  // forma DETERMINISTA (sort_order y, si aún choca, los 6 primeros del id) para
  // que una segunda corrida produzca los mismos nombres y el skip funcione.
  const usados = new Set();
  const nombreUnico = (r, pref, ext) => {
    const t = limpio(r.title);
    for (const cand of [
      `${pref} - ${t}.${ext}`,
      `${pref}.${String(r.sort_order ?? 0).padStart(2, '0')} - ${t}.${ext}`,
      `${pref}.${String(r.sort_order ?? 0).padStart(2, '0')} - ${t} (${String(r.id).slice(0, 6)}).${ext}`,
    ]) if (!usados.has(cand)) { usados.add(cand); return cand; }
    const forzado = `${pref} - ${t} (${String(r.id).slice(0, 12)}).${ext}`;
    usados.add(forzado);
    return forzado;
  };

  for (const r of meta) {
    const raiz = raizDe(r.vip_module_id);
    const pref = raiz ? String(ordenRaiz.get(raiz.id) ?? 0).padStart(2, '0') : '00';
    const ext = String(r.file_type ?? 'bin').replace(/^\./, '').toLowerCase();
    const nombre = nombreUnico(r, pref, ext);
    const salida = join(destino, nombre);
    indice.push({ nombre, modulo: raiz?.title ?? null, bytes: r.file_size ?? null });

    if (existsSync(salida) && Number(r.file_size) && statSync(salida).size === Number(r.file_size)) {
      console.log(`  = ${nombre}`);
      ya++; continue;
    }
    const url = urls.get(r.id);
    if (!url) { console.log(`  ⚠ ${nombre} — sin URL firmada`); sinUrl++; continue; }

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      // Un endpoint que contesta HTML con 200 dejaría un PDF roto "bajado": ya
      // pasó con Drive. Si dice PDF, tiene que empezar con %PDF-.
      if (ext === 'pdf' && buf.subarray(0, 5).toString('latin1') !== '%PDF-') {
        throw new Error(`no es un PDF (empieza con ${JSON.stringify(buf.subarray(0, 12).toString('latin1'))})`);
      }
      writeFileSync(salida, buf);
      console.log(`  ✓ ${nombre}  (${kb(buf.length)})`);
      ok++;
    } catch (e) {
      console.error(`  ✖ ${nombre} — ${e.message}`);
      fallos.push({ nombre, error: e.message });
    }
  }

  writeFileSync(join(base, 'recursos.json'), JSON.stringify({ curso: plan.curso, total: meta.length, items: indice }, null, 2), 'utf8');

  // El conteo se verifica contra el DISCO, no contra el bucle: la versión anterior
  // decía «71 bajado(s)» con 64 archivos, porque contaba intentos y no resultados.
  const enDisco = readdirSync(destino).length;
  console.log('\n' + '─'.repeat(70));
  console.log(`  ${ok} bajado(s) · ${ya} ya estaban · ${sinUrl} sin URL · ${fallos.length} con error`);
  console.log(`  archivos en disco: ${enDisco} / ${meta.length} recursos del curso`);
  if (enDisco < meta.length - sinUrl - fallos.length) {
    console.log(`  ⚠ FALTAN ${meta.length - sinUrl - fallos.length - enDisco}: hay nombres que se pisaron.`);
  }
  console.log(`  → ${destino}`);
  console.log('─'.repeat(70) + '\n');
  process.exit(fallos.length && !ok ? 1 : 0);
};

main().catch((e) => { console.error(`\n  ✖ ${e.message}\n`); process.exit(1); });
