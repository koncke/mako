// Baja los DESCARGABLES de cada clase (de los cursos de /curso/).
//
// El problema: los links del plan son /Reader?type=resource&id=<uuid>, que es una
// PÁGINA, no el archivo. Y el archivo real vive detrás de la sesión.
//
// La solución que evita extraer cookies: se navega la página en el Chrome dedicado
// (ya logueado) y se mira lo que la página descarga — el navegador ya autenticó y
// resolvió la URL real. No hace falta ni fetch en la página ni pelearse con las
// cookies v20.
//
// ⚠️ NO son todos PDF, y el nombre de este script miente por historia. La primera
// versión filtraba `application/pdf`, ponía `.pdf` en el nombre y validaba los
// bytes contra `%PDF-`. Los 3 descargables de «Inteligencia Viral 2026» son ZIP
// servidos desde un bucket R2, así que los tres chequeos los descartaban y el
// script reportaba «no apareció ningún PDF en 25s» — un archivo que SÍ estaba
// pasando por la red, informado como si no existiera. El formato ahora sale del
// `Content-Disposition`/mime/URL reales y la validación es por familia.
//
//   node <abs>\scripts\curso-pdfs.mjs --plan C:\cursos\<slug>\plan.json

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const PORT = Number(arg('port', 9333));
const POR_POSICION = process.argv.includes('--por-posicion');
const PLAN = arg('plan', '');
const ESPERA = Number(arg('espera', 25)) * 1000;

if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }
// El BOM: si el plan lo escribió PowerShell con -Encoding utf8, JSON.parse revienta
// con un mensaje que no menciona al BOM por ningún lado. Ver docs/hallazgos-conocimiento.md.
const plan = JSON.parse(readFileSync(PLAN, 'utf8').replace(/^\uFEFF/, ''));
const destino = join(dirname(PLAN), 'pdfs');

// El peso que la plataforma declara para cada recurso, si el pipeline lo guard\u00F3 al lado.
// Es lo que despu\u00E9s desempata entre las decenas de respuestas que pasan por la red.
const tamPorId = new Map();
{
  const f = join(dirname(PLAN), 'recursos-api.json');
  if (existsSync(f)) {
    for (const r of JSON.parse(readFileSync(f, 'utf8').replace(/^\uFEFF/, ''))) {
      if (r?.id && r?.file_size) tamPorId.set(r.id, r.file_size);
    }
  }
}

const limpio = (s) => s.normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
  .replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 120) || 'recurso';

// ── Qué es un archivo descargable y cómo se llama ────────────────────────────
// Cómo se baja un archivo y cómo se sabe si sirve vive en UN lugar: `curso-descarga.mjs`.
// Estas seis funciones estaban acá y ahora las necesita también `curso-recursos-vip.mjs`
// para el área /curso/. Copiarlas era garantizar que la segunda copia quedara vieja —
// y las cuatro reglas que encierran (la extensión es un HECHO, el cuerpo vacío de CDP,
// la página de error vestida de 200, excluir por familia) se pagaron con un bug cada una.
import { extDe, nombreDisp, valido, puedeSerArchivo, cuerpoCdp, cuerpoDirecto } from './curso-descarga.mjs';

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
  enviar(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    return new Promise((ok, no) => {
      this.pend.set(id, { ok, no });
      setTimeout(() => this.pend.has(id) && (this.pend.delete(id), no(new Error(`timeout ${method}`))), 30000);
    });
  }
}

const main = async () => {
  let lista;
  try { lista = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()); }
  catch { console.error(`\n  ✖ No hay CDP en ${PORT}.\n`); process.exit(1); }

  // Nombre por archivo: se lee del curso, asociando cada link Reader a su clase.
  // Sin esto quedarían 20 archivos llamados por uuid.
  const cursoTab = lista.find((t) => t.type === 'page' && /\/curso\//i.test(t.url));
  const etiquetas = new Map();
  if (cursoTab) {
    const wsC = new WebSocket(cursoTab.webSocketDebuggerUrl);
    await new Promise((ok) => wsC.addEventListener('open', ok, { once: true }));
    const c = new Cdp(wsC);
    await c.enviar('Runtime.enable');
    const { result } = await c.enviar('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const dur = /\\b\\d{1,2}:\\d{2}\\b/;
        const out = [];
        // Recorrido en orden de documento: la clase precede a su(s) archivo(s).
        const nodos = [...document.querySelectorAll('button, a[href*="Reader?type=resource"]')];
        let clase = null, n = 0;
        for (const el of nodos) {
          const txt = (el.innerText || '').replace(/\\s+/g, ' ').trim();
          if (el.tagName === 'BUTTON') {
            if (dur.test(txt) && !/\\d+\\/\\d+\\s*$/.test(txt)) {
              n++;
              clase = txt.replace(/^\\s*\\d{1,3}\\s+/, '').replace(dur, '').replace(/^\\s*\\d{1,3}[.)]\\s*/, '').trim();
            }
            continue;
          }
          const id = new URL(el.href).searchParams.get('id');
          // Del texto del link se saca el peso ("1,2 MB") y el badge de formato
          // ("ZIP", "PDF"): los dos ya viajan en el archivo, y repetirlos deja
          // nombres como "… Subtitulaje_avanzado ZIP.zip".
          if (id) out.push({ id, n, clase, label: txt
            .replace(/\\s*\\d+([.,]\\d+)?\\s*(KB|MB|GB)\\s*$/i, '')
            .replace(/\\s+(ZIP|PDF|DOCX?|XLSX?|PPTX?|CSV|RTF|MP4|MP3)\\s*$/i, '')
            .trim() });
        }
        return out;
      })()`,
    });
    for (const e of result?.value ?? []) etiquetas.set(e.id, e);
    wsC.close();
    console.log(`  Asocié ${etiquetas.size} archivo(s) a su clase.\n`);
  }

  // Una sola pestaña de trabajo, reusada para todos.
  const wsB = new WebSocket(lista.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((ok) => wsB.addEventListener('open', ok, { once: true }));
  const raiz = new Cdp(wsB);
  const { targetId } = await raiz.enviar('Target.createTarget', { url: 'about:blank', background: true });
  const { sessionId } = await raiz.enviar('Target.attachToTarget', { targetId, flatten: true });

  const cands = new Map(); // requestId -> {url, mime, disp}
  let listos = [];
  raiz.oye.push((m) => {
    if (m.sessionId !== sessionId) return;
    // ⚠️ ACÁ HABÍA UNA COPIA INLINE de `puedeSerArchivo`, y se quedó vieja exactamente
    // como la cabecera de este archivo advertía que iba a pasar. La compartida fue
    // sumando extensiones —`png`, `jpe?g`, `cube`, `txt`— y la copia se quedó con la
    // lista del día que se escribió.
    //
    // Lo que costó: los DOS únicos recursos de imagen de la Certificación en Marketing
    // Digital («2.2 Mapa mental - Email Marketing» .jpg y «2.2 Mind Map» .png) no se
    // bajaron NUNCA. Y el modo de falla es el peor: el mensaje decía «nada descargable
    // en 25s» sobre un archivo que estaba pasando por la red, así que se leyó como un
    // problema de sesión y se persiguió por ahí durante toda una tanda.
    if (m.method === 'Network.responseReceived') {
      const c = puedeSerArchivo(m.params.response);
      if (c) cands.set(m.params.requestId, c);
    }
    if (m.method === 'Network.loadingFinished' && cands.has(m.params.requestId)) {
      listos.push(m.params.requestId);
    }
  });

  await raiz.enviar('Network.enable', {}, sessionId);
  await raiz.enviar('Page.enable', {}, sessionId);
  mkdirSync(destino, { recursive: true });

  const enlaces = (plan.pdfs ?? []);
  let ok = 0;
  const fallos = [];
  const bajados = [];

  for (const [i, url] of enlaces.entries()) {
    const id = new URL(url).searchParams.get('id');
    const meta = etiquetas.get(id);
    // El nombre se arma SIN extensión y se completa cuando se sabe qué llegó: la
    // extensión es un HECHO del archivo, no una suposición del script.
    //
    // ⚠️ `--por-posicion` FUERZA el nombre de respaldo aunque la pestaña del curso esté
    // abierta. Es para RETOMAR una tanda a medias: si los que ya se bajaron quedaron como
    // `recurso-NN` —porque esa vez no había pestaña— y ahora sí la hay, los que faltan
    // saldrían con el nombre bueno y el lote quedaría con DOS esquemas de nombre a la vez.
    // Eso rompe el cruce por posición de `curso-recursos-indice.mjs` y deja media tanda
    // huérfana en Drive. Consistencia con lo ya publicado le gana a un nombre más lindo.
    const raizNombre = (!POR_POSICION && meta?.clase)
      ? `${String(meta.n).padStart(2, '0')} - ${limpio(meta.clase)}${meta.label ? ` - ${limpio(meta.label)}` : ''}`
      : null;

    // Si ya está bajado con cualquier extensión, se saltea.
    //
    // ⚠️ Se prueban LOS DOS nombres, no solo el que toca hoy. Antes el `yaEsta` exigía
    // `raizNombre`, así que cuando la asociación con las clases salía vacía —el caso
    // «Asocié 0 archivo(s)»— la guarda se apagaba entera y cada corrida volvía a bajar
    // los 130 desde cero. Reanudable en el papel y no en los hechos.
    const posicional = `recurso-${String(i + 1).padStart(2, '0')}`;
    const yaEsta = [raizNombre, posicional].filter(Boolean).flatMap((r) =>
      ['pdf', 'zip', 'docx', 'xlsx', 'pptx', 'doc', 'xls', 'csv', 'rtf', 'jpg', 'png', 'bin']
        .map((e) => join(destino, `${r}.${e}`))).find((p) => existsSync(p));
    if (yaEsta) { console.log(`  = ${basename(yaEsta)}`); ok++; bajados.push(yaEsta); continue; }

    const esperado = tamPorId.get(id) ?? null;

    cands.clear(); listos = [];
    await raiz.enviar('Page.navigate', { url }, sessionId).catch(() => {});

    const t0 = Date.now();
    let guardado = null;
    const descartes = [];
    while (Date.now() - t0 < ESPERA && !guardado) {
      await new Promise((r) => setTimeout(r, 400));
      for (const rid of [...listos]) {
        const c = cands.get(rid);
        if (!c) continue;
        try {
          // ⚠️ Dos caminos, y hacen falta los dos. `getResponseBody` sirve cuando
          // Chrome retuvo el cuerpo, pero para lo que el renderer trata como
          // DESCARGA devuelve 0 bytes sin error — que es lo que pasa con estos
          // ZIP. Ahí se baja la URL ya resuelta de frente: el bucket de R2
          // (`pub-*.r2.dev`) es público, la sesión hizo falta solo para AVERIGUAR
          // la URL, no para leerla.
          let buf = await cuerpoCdp(raiz, rid, sessionId);
          if (!buf || buf.length < 64) buf = await cuerpoDirecto(c.url, plan.referer, plan.userAgent);
          if (!buf) continue;
          // ⚠️ EL TAMAÑO DECLARADO DECIDE, cuando lo sabemos. Una página trae DECENAS de
          // respuestas que pasan el filtro de «esto puede ser un archivo» —empezando por
          // las portadas de cursos, que son imágenes de verdad— y quedarse con la primera
          // es elegir por orden de llegada.
          //
          // Costó dos archivos: al aceptar imágenes, los dos recursos .jpg/.png de este
          // curso se guardaron con la MINIATURA de la portada, 19.424 B los dos, mientras
          // la API declaraba 118.052 y 92.839. Se ve como un éxito —✓ verde, un JPG que
          // abre— y sólo lo delata cruzar el peso. Es la misma trampa del `[0]` sobre una
          // lista ambigua que ya está escrita en AGENTS.md.
          if (esperado && Math.abs(buf.length - esperado) > 2) {
            descartes.push(`${c.mime || '?'} ${buf.length}B → la API declara ${esperado}B`);
            continue;
          }
          const ext = extDe(c.url, c.mime, c.disp);
          if (!valido(buf, ext)) { descartes.push(`${c.mime || '?'} ${buf.length}B → no valida como .${ext}`); continue; }
          const nombre = `${raizNombre ?? limpio(nombreDisp(c.disp) ?? `recurso-${String(i + 1).padStart(2, '0')}`)}.${ext}`;
          const salida = join(destino, nombre);
          writeFileSync(salida, buf);
          console.log(`  ✓ ${nombre}  (${(buf.length / 1024).toFixed(0)} KB · ${c.mime || 'sin mime'})`);
          guardado = salida; ok++; bajados.push(salida);
          break;
        } catch { /* el body puede no estar más en el buffer */ }
      }
    }
    if (!guardado) {
      const et = raizNombre ?? `recurso-${String(i + 1).padStart(2, '0')}`;
      console.log(`  ✖ ${et} — nada descargable en ${ESPERA / 1000}s`);
      // ⚠️ Decir QUÉ se descartó y por qué. La versión anterior solo decía «no
      // apareció ningún PDF», y el archivo estaba ahí: era ZIP.
      for (const d of descartes.slice(0, 4)) console.log(`      descartado: ${d}`);
      fallos.push({ url, nombre: et });
    }
  }

  await raiz.enviar('Target.closeTarget', { targetId }).catch(() => {});
  wsB.close();

  console.log('\n' + '─'.repeat(70));
  console.log(`  ${ok}/${enlaces.length} descargable(s) · ${fallos.length} sin bajar`);
  console.log(`  → ${destino}`);
  console.log('─'.repeat(70));
  if (fallos.length) {
    console.log('\n  Sin bajar (volver a correr los reintenta; los que están se saltean):');
    for (const f of fallos.slice(0, 8)) console.log(`    ${f.nombre}\n      ${f.url}`);
  }
  console.log('');
  process.exit(fallos.length && !ok ? 1 : 0);
};

main().catch((e) => { console.error(`\n  ✖ ${e.message}\n`); process.exit(1); });
