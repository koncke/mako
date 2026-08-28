// Convierte a PDF los recursos que Drive NO sabe previsualizar.
//
//   node scripts/curso-recursos-a-pdf.mjs --plan C:/cursos/<slug>/plan.json
//   node scripts/curso-recursos-a-pdf.mjs --plan … --ver     # lista y no toca nada
//
// Requiere el Chrome dedicado abierto (scripts/curso-perfil.ps1). Usa su `Page.printToPDF`.
//
// ⚠️ POR QUÉ: un `.html` en Drive NO abre en el visor — se ofrece para DESCARGAR. El portal
// lo dibuja honestamente como «archivo del curso» con un link, pero desde el lado del
// alumno eso es hacer clic y que no pase nada visible: baja un .html que después tiene que
// abrir a mano. Los 6 de MasteryHaus eran exportaciones de Google Docs, o sea documentos
// para LEER, no descargables.
//
// El PDF sí previsualiza, así que el material queda a un clic en vez de a tres.
//
// ⚠️ Y EL ORIGINAL NO SE BORRA HASTA QUE EL PDF EXISTE Y PESA. Un printToPDF que falla
//    devuelve una cadena vacía sin tirar error: borrar antes de comprobar dejaría al curso
//    sin el recurso y sin forma de recuperarlo salvo rebajarlo.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, dirname, extname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const tiene = (n) => process.argv.includes(`--${n}`);
const PORT = Number(arg('port', 9333));
const PLAN = arg('plan', '');
if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }
const base = dirname(PLAN);
const DIR = join(base, 'recursos');
// Drive previsualiza pdf, imágenes, office y texto. Lo que sigue es lo que NO.
const CONVERTIBLES = new Set(['.html', '.htm']);

const cdp = async (ruta, metodo = 'GET') => {
  const r = await fetch(`http://127.0.0.1:${PORT}${ruta}`, { method: metodo });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return t; }
};

/** Una sesión CDP mínima sobre una pestaña: abrir, mandar comandos, cerrar. */
const conPestana = async (fn) => {
  const tab = await cdp('/json/new?about:blank', 'PUT');
  if (!tab || !tab.webSocketDebuggerUrl) throw new Error('no pude abrir una pestaña con CDP');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('no conecta el WebSocket')); });

  let id = 0;
  const pend = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  };
  const enviar = (method, params = {}) => new Promise((res, rej) => {
    const n = ++id;
    pend.set(n, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result)));
    ws.send(JSON.stringify({ id: n, method, params }));
    setTimeout(() => { if (pend.has(n)) { pend.delete(n); rej(new Error(`${method}: sin respuesta`)); } }, 60000);
  });

  try { return await fn(enviar); }
  finally { try { ws.close(); } catch { /* ya estaba */ } try { await cdp(`/json/close/${tab.id}`); } catch { /* la cierra el usuario */ } }
};

const aConvertir = existsSync(DIR)
  ? readdirSync(DIR).filter((f) => CONVERTIBLES.has(extname(f).toLowerCase()))
  : [];

console.log(`\n  ${aConvertir.length} recurso(s) que Drive no previsualiza\n`);
for (const f of aConvertir) console.log(`     · ${f.slice(0, 66)}`);
if (!aConvertir.length) { console.log(''); process.exit(0); }
if (tiene('ver')) { console.log('\n  (--ver: no toqué nada)\n'); process.exit(0); }

const hechos = [];
await conPestana(async (enviar) => {
  await enviar('Page.enable');
  for (const f of aConvertir) {
    const origen = join(DIR, f);
    const destino = join(DIR, `${basename(f, extname(f))}.pdf`);
    process.stdout.write(`\n  → ${f.slice(0, 58)}`);
    try {
      await enviar('Page.navigate', { url: pathToFileURL(origen).href });
      await new Promise((r) => setTimeout(r, 2500));   // que termine de pintar
      const { data } = await enviar('Page.printToPDF', {
        printBackground: true, marginTop: 0.4, marginBottom: 0.4, marginLeft: 0.4, marginRight: 0.4,
      });
      const buf = Buffer.from(data, 'base64');
      // El guard: printToPDF puede devolver vacío sin tirar error.
      if (buf.length < 1000 || buf.subarray(0, 4).toString() !== '%PDF') throw new Error(`salió un PDF de ${buf.length} B`);
      writeFileSync(destino, buf);
      unlinkSync(origen);                               // recién ACÁ, con el PDF en disco
      hechos.push([f, basename(destino), buf.length]);
      process.stdout.write(`  ✓ ${(buf.length / 1024).toFixed(0)} KB`);
    } catch (e) {
      process.stdout.write(`  ✖ ${e.message}`);
    }
  }
});

console.log(`\n\n  ${hechos.length}/${aConvertir.length} convertido(s)\n`);

// ⚠️ Los índices apuntan al nombre VIEJO. Sin esto el recurso pierde su vínculo con las
// clases y queda como «Material del curso» — pasó al renombrar los .bin el 28/08/2026.
for (const archivo of ['recursos.json', 'recursos-manifiesto.json']) {
  const p = join(base, archivo);
  if (!existsSync(p)) continue;
  const j = JSON.parse(readFileSync(p, 'utf8'));
  const items = Array.isArray(j) ? j : (j.items ?? []);
  let n = 0;
  for (const it of items) {
    for (const campo of ['archivo', 'nombre']) {
      const v = it[campo];
      if (!v) continue;
      const m = hechos.find(([viejo]) => viejo === v);
      if (m) { it[campo] = m[1]; n++; }
    }
  }
  if (n) { writeFileSync(p, JSON.stringify(j, null, 1), 'utf8'); console.log(`  ${archivo}: ${n} entrada(s) al día`); }
}

console.log(`\n  Seguí con:`);
console.log(`    node scripts/curso-recursos-titulos.mjs --plan ${PLAN}`);
console.log(`    node scripts/curso-a-drive.mjs   --plan ${PLAN} --solo-ids`);
console.log(`    node scripts/curso-a-portal.mjs  --plan ${PLAN}\n`);
