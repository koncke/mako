// =============================================================================
// thenet-lab-plan.mjs — un curso de THE NET LAB (LearnDash + Spotlightr) al pipeline de cursos (9/11/2026)
// =============================================================================
// Toma lo que mandó scripts/thenet-lab-pagina.js (vía curso-recibir.mjs) y deja la carpeta del curso
// lista para los pasos de siempre (docs/hallazgos-conocimiento.md → «La secuencia completa»):
//
//   C:\cursos\<slug>\plan.json         las clases, en el orden del curso, con `soloTexto: true`
//   C:\cursos\<slug>\texto\NN - X.md    la lección escrita + la transcripción, para el archivo en Drive
//   C:\cursos\<slug>\recursos\          los materiales bajados (Drive, Docs, Sheets) + recursos.json
//   <repo>\public\cono-doc\<slug>__<lección>.json   lo que abre el portal: pestañas «Lección» y «Transcripción»
//
// Después: curso-a-drive.mjs (sube recursos/ y texto/ y trae los ids) → curso-a-portal.mjs → catalogo.ts.
//
// ⚠️ EL VIDEO NO SE BAJA, Y ES A PROPÓSITO. Spotlightr sirve HLS cifrado (AES-128) con una clave
// OFUSCADA: el archivo `.key` trae 64 caracteres hex en vez de los 16 bytes que pide el estándar, y
// la convierte el reproductor. Sacarla sería romper una protección de contenido de un curso pago, y
// no se hace. Lo que sí está publicado, sin sesión, es lo que el propio reproductor pide:
//   · `api.spotlightr.com/video/playerSettings?videoID=<id>` → nombre, duración y `translations`,
//     con la URL del SUBTÍTULO en español (.vtt) que la plataforma generó para cada video.
//   · ese .vtt, que es la transcripción completa con tiempos (medido: 675 líneas para 27:35 min).
// Con eso cada lección queda como DOCUMENTO (`soloTexto`) con la transcripción como pestaña, y un
// link a la lección original para quien quiera ver el video con su cuenta.
//
// ⚠️ `omitViewGenerate=true` en cada consulta: sin eso cada lectura suma una «vista» en las métricas
// del dueño del curso.
//
//   node scripts/thenet-lab-plan.mjs --export C:\cursos\<slug>\export\recv-001.json
//   node scripts/thenet-lab-plan.mjs --export … --repo C:\dev\wt-x --sin-red   (re-arma sin volver a bajar)
// =============================================================================
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const tiene = (n) => process.argv.includes(`--${n}`);

const EXPORT = arg('export', '');
const REPO = arg('repo', join(dirname(fileURLToPath(import.meta.url)), '..'));
const RAIZ = arg('raiz', 'C:\\cursos');
const CURSO = arg('curso', 'Programa de Meta Ads 2026');
const AUTOR = arg('autor', 'THE NET LAB');
const SLUG = arg('slug', 'programa-meta-ads-the-net-lab');
const ORIGEN = 'https://thenet-lab.com';
const SIN_RED = tiene('sin-red');

if (!EXPORT || !existsSync(EXPORT)) { console.error('\n  ✖ Falta --export <recv-NNN.json>\n'); process.exit(1); }
const exp = JSON.parse(readFileSync(EXPORT, 'utf8'));
const base = join(RAIZ, SLUG);
for (const d of ['texto', 'recursos', 'spotlightr', 'vtt']) mkdirSync(join(base, d), { recursive: true });
const dirDoc = join(REPO, 'public', 'cono-doc');
mkdirSync(dirDoc, { recursive: true });

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const limpioArchivo = (s) => String(s).normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
  .replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 110) || 'sin-titulo';
// El sitio marca módulos con «[NUEVO]» y algunos títulos abren con un emoji de color: es vidriera, no el nombre.
const tituloLimpio = (s) => String(s ?? '').replace(/\[\s*nuevo\s*\]/gi, '').replace(/^[^\p{L}\p{N}¿¡"“(]+/u, '')
  .replace(/\s+/g, ' ').trim();
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 1. La estructura: módulos y temas, en el orden en que los muestra el curso ───────────────
const paginas = new Map(exp.paginas.filter(Boolean).map((p) => [p.u, p]));
const curso = exp.curso.u.replace(/\/$/, '');
const modulos = exp.orden.filter((u) => u.startsWith(`${curso}/lessons/`) && !u.includes('/topic/'));
const temasDe = (m) => exp.orden.filter((u) => u.startsWith(m) && u !== m && u.includes('/topic/'));
const fuera = exp.orden.filter((u) => !modulos.includes(u) && !modulos.some((m) => u.startsWith(m)));

// ⚠️ EL PATRÓN: la página del curso publica «0/N pasos» por módulo. Es un número ajeno a cómo
// enumeramos, así que si no coincide con lo que se juntó, se corta (ver «La página publica cuántas
// lecciones tiene», docs/hallazgos-conocimiento.md).
const publicados = [...String(exp.curso.introTexto).matchAll(/\d+\/(\d+) pasos/g)].map((m) => Number(m[1]));
const contados = modulos.map((m) => temasDe(m).length);
if (publicados.length !== modulos.length || publicados.some((n, i) => n !== contados[i])) {
  console.error(`\n  ✖ El curso publica ${JSON.stringify(publicados)} temas por módulo y se juntaron ${JSON.stringify(contados)}.\n`);
  process.exit(2);
}
const faltan = exp.orden.filter((u) => !paginas.has(u) || paginas.get(u).status !== 200 || !paginas.get(u).html);
// Las páginas de MÓDULO no traen contenido propio (sólo la lista de temas): vacías es lo esperable.
const faltanTemas = faltan.filter((u) => u.includes('/topic/'));
if (faltanTemas.length) { console.error(`\n  ✖ ${faltanTemas.length} tema(s) sin página:\n    ${faltanTemas.join('\n    ')}\n`); process.exit(2); }

const nombreModulo = (m, i) => {
  const p = paginas.get(temasDe(m)[0]);
  const t = tituloLimpio(p?.crumbs?.[1] || paginas.get(m)?.title || m.split('/').filter(Boolean).pop());
  return `${i + 1}. ${t}`;
};

// ── 2. Spotlightr: nombre, duración y subtítulo de cada video ────────────────────────────────
const idDeIframe = (src) => {
  const m = /spotlightr\.com\/(?:watch|publish)\/([A-Za-z0-9+/=]+)/.exec(src);
  if (!m) return null;
  const id = Buffer.from(m[1], 'base64').toString('utf8');
  return /^\d+$/.test(id) ? id : null;
};
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36';
const metaVideo = async (id) => {
  const f = join(base, 'spotlightr', `${id}.json`);
  if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'));
  if (SIN_RED) return null;
  const url = `https://api.spotlightr.com/video/playerSettings?videoID=${id}&browser=Chrome&device=Desktop&domain=videos.cdn.spotlightr.com&omitViewGenerate=true`;
  const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://videos.cdn.spotlightr.com/' } });
  if (!r.ok) throw new Error(`playerSettings ${id}: HTTP ${r.status}`);
  const v = (await r.json())?.insertView?.video;
  if (!v) throw new Error(`playerSettings ${id}: sin «video» en la respuesta`);
  // Se guarda SÓLO lo que se usa: la respuesta trae la configuración entera de la cuenta del dueño.
  // ⚠️ `translations` llega como OBJETO (`{ spanish: 'https://…vtt' }`), no como string. La primera
  // versión le pasaba una regex a `String(v.translations)`, que es «[object Object]», y dio 97 de 97
  // videos «sin subtítulo» sin ningún error. Se acepta igual la forma serializada, por si cambia.
  const trRaw = v.translations;
  const vtts = trRaw && typeof trRaw === 'object'
    ? Object.entries(trRaw).filter(([, u]) => /^https?:\/\/.+\.vtt$/i.test(String(u))).map(([idioma, url]) => ({ idioma, url: String(url) }))
    : [...String(trRaw ?? '').replace(/\\\//g, '/').matchAll(/["']([a-z]+)["']\s*:\s*["'](https?:\/\/[^"']+?\.vtt)["']/gi)]
      .map((x) => ({ idioma: x[1], url: x[2] }));
  const out = { id, nombre: v.name, segundos: Number(v.duration) || 0, idioma: v.sourceLanguage ?? null, translations: v.translations ?? null, vtts };
  writeFileSync(f, JSON.stringify(out, null, 1));
  await espera(300);
  return out;
};
const textoVtt = async (id, meta) => {
  const f = join(base, 'vtt', `${id}.vtt`);
  if (!existsSync(f)) {
    const v = meta?.vtts?.find((x) => /spanish|espa/i.test(x.idioma)) ?? meta?.vtts?.[0];
    if (!v || SIN_RED) return '';
    const r = await fetch(v.url, { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error(`vtt ${id}: HTTP ${r.status}`);
    writeFileSync(f, await r.text());
    await espera(200);
  }
  // Un .vtt: «WEBVTT», número de cue, línea de tiempos, texto. Sólo se queda el texto.
  const lineas = readFileSync(f, 'utf8').replace(/\r/g, '').split('\n');
  const txt = [];
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i].trim();
    if (!l || l === 'WEBVTT' || /-->/.test(l) || (/^\d+$/.test(l) && /-->/.test(lineas[i + 1] ?? ''))) continue;
    // El último cue viene pegado a su número («…diferencial.675»): se le saca.
    txt.push(i === lineas.length - 1 || !lineas.slice(i + 1).some((x) => x.trim()) ? l.replace(/(?<=[.!?…])\d+$/, '') : l);
  }
  return txt.join(' ').replace(/\s+/g, ' ').trim();
};
// Igual criterio que curso-a-portal.mjs: párrafos por oraciones, no por largo fijo. El subtítulo
// automático a veces no puntúa: una «oración» de más de 700 caracteres se corta en un espacio.
const enParrafos = (texto, porParrafo = 4) => {
  const oraciones = texto.split(/(?<=[.!?…])\s+(?=[¿¡"“'(A-ZÁÉÍÓÚÑ0-9])/g).flatMap((o) => {
    const out = []; let s = o.trim();
    while (s.length > 700) { const k = s.lastIndexOf(' ', 600); out.push(s.slice(0, k > 0 ? k : 600)); s = s.slice(k > 0 ? k + 1 : 600); }
    if (s) out.push(s);
    return out;
  });
  const out = [];
  for (let i = 0; i < oraciones.length; i += porParrafo) out.push(oraciones.slice(i, i + porParrafo).join(' ').trim());
  return out.filter(Boolean);
};
const hms = (s) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };

// ── 3. El HTML de la lección → el papel del portal ───────────────────────────────────────────
// Se reconstruye con una lista BLANCA de etiquetas y las clases del papel (`ugc-*`, de
// public/cono-doc/ugc.css), en vez de pegar el HTML de Elementor: trae miles de divs anidados,
// estilos inline y el formulario «Marcar como completado», y el portal lo inyecta con
// dangerouslySetInnerHTML (ver la nota del saneo en avatarhype-doc-portal.mjs).
const RE_MATERIAL = /^https:\/\/(drive\.google\.com\/file\/d\/|docs\.google\.com\/(document|spreadsheets|presentation)\/d\/|www\.canva\.com\/design\/)/;
const BLOQUE = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TABLE', 'PRE', 'HR', 'BLOCKQUOTE', 'FIGURE', 'IFRAME', 'NAV', 'FORM']);

const convertir = (html, ctx) => {
  const doc = new JSDOM(`<body>${html}</body>`).window.document;
  // Lo que es de LearnDash y no de la lección: migas, progreso, «Anterior / Siguiente», el formulario.
  doc.querySelectorAll('.learndash-wrapper, form, input, button, script, style, noscript, svg, nav').forEach((e) => e.remove());

  const inline = (n) => {
    if (n.nodeType === 3) return esc(n.textContent);
    if (n.nodeType !== 1) return '';
    const t = n.tagName;
    const hijos = () => [...n.childNodes].map(inline).join('');
    if (t === 'BR') return '<br>';
    if (t === 'IMG') {
      // Los emoji de WordPress llegan como <img class="emoji" alt="🔵">: vuelven a ser el carácter.
      if (/emoji/.test(n.className) || /s\.w\.org\/images\/core\/emoji/.test(n.getAttribute('src') || '')) return esc(n.getAttribute('alt') || '');
      const src = n.getAttribute('src') || '';
      if (src) ctx.imagenes.push(src);
      return src ? `<img src="${esc(src)}" alt="${esc(n.getAttribute('alt') || '')}" style="max-width:100%;height:auto;border-radius:8px">` : '';
    }
    if (t === 'A') {
      const href = n.getAttribute('href') || '';
      const txt = n.textContent.replace(/\s+/g, ' ').trim();
      if (!/^https?:\/\//.test(href)) return hijos();
      if (RE_MATERIAL.test(href)) ctx.materiales.push({ url: href, texto: txt });
      return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${hijos() || esc(href)}</a>`;
    }
    if (t === 'STRONG' || t === 'B') return `<strong>${hijos()}</strong>`;
    if (t === 'EM' || t === 'I') return n.className && /icon|fa-|eicon/.test(n.className) ? '' : `<em>${hijos()}</em>`;
    if (t === 'U') return `<u>${hijos()}</u>`;
    if (t === 'CODE') return `<code>${hijos()}</code>`;
    if (BLOQUE.has(t)) return ` ${[...n.childNodes].map(inline).join('')} `;
    return hijos();
  };
  const vacio = (s) => !s.replace(/<br>/g, '').replace(/&nbsp;|\u00a0/g, ' ').trim();

  const lista = (n) => {
    const tag = n.tagName === 'OL' ? 'ol' : 'ul';
    const items = [...n.children].filter((c) => c.tagName === 'LI').map((li) => {
      const sub = [...li.children].filter((c) => c.tagName === 'UL' || c.tagName === 'OL');
      sub.forEach((s) => s.remove());
      const txt = inline(li).replace(/\s+/g, ' ').trim();
      return `<li>${txt}${sub.map(lista).join('')}</li>`;
    }).filter((x) => x !== '<li></li>');
    return items.length ? `<${tag} class="ugc-doc-ul">${items.join('')}</${tag}>` : '';
  };

  const bloques = (n, out) => {
    let corrida = [];
    const cerrar = () => {
      const s = corrida.join('').replace(/\s+/g, ' ').trim();
      if (!vacio(s)) out.push(`<p class="ugc-doc-p">${s}</p>`);
      corrida = [];
    };
    for (const c of n.childNodes) {
      if (c.nodeType === 3) { corrida.push(esc(c.textContent)); continue; }
      if (c.nodeType !== 1) continue;
      const t = c.tagName;
      if (!BLOQUE.has(t) && !c.querySelector?.([...BLOQUE].join(','))) { corrida.push(inline(c)); continue; }
      cerrar();
      if (t === 'P') { const s = inline(c).replace(/\s+/g, ' ').trim(); if (!vacio(s)) out.push(`<p class="ugc-doc-p">${s}</p>`); }
      else if (/^H[1-3]$/.test(t)) { const s = c.textContent.replace(/\s+/g, ' ').trim(); if (s) out.push(`<div class="ugc-sec-h"><h3>${esc(s)}</h3></div>`); }
      else if (/^H[4-6]$/.test(t)) { const s = inline(c).replace(/\s+/g, ' ').trim(); if (!vacio(s)) out.push(`<p class="ugc-doc-p"><strong>${s}</strong></p>`); }
      else if (t === 'UL' || t === 'OL') { const s = lista(c); if (s) out.push(s); }
      else if (t === 'HR') out.push('<hr>');
      else if (t === 'PRE') { const s = c.textContent.trim(); if (s) out.push(`<pre class="ugc-doc-p">${esc(s)}</pre>`); }
      else if (t === 'BLOCKQUOTE') { const s = inline(c).replace(/\s+/g, ' ').trim(); if (!vacio(s)) out.push(`<p class="ugc-doc-note">${s}</p>`); }
      else if (t === 'TABLE') {
        const filas = [...c.querySelectorAll('tr')].map((tr) => `<tr>${[...tr.children].map((td) => {
          const k = td.tagName === 'TH' ? 'th' : 'td';
          return `<${k}>${inline(td).replace(/\s+/g, ' ').trim()}</${k}>`;
        }).join('')}</tr>`).join('');
        if (filas) out.push(`<table class="ugc-doc-table">${filas}</table>`);
      } else if (t === 'IFRAME') {
        const src = c.getAttribute('src') || '';
        const id = idDeIframe(src);
        if (id) { ctx.videos.push(id); out.push(`@@VIDEO:${id}@@`); }
        else if (/youtube\.com|youtu\.be|vimeo\.com/.test(src)) out.push(`<p class="ugc-doc-note">Video externo: <a href="${esc(src)}" target="_blank" rel="noopener noreferrer">${esc(src)}</a></p>`);
      } else {
        // Un botón de Elementor (a.elementor-button) es un bloque con UN link: va como renglón propio.
        if (c.matches?.('.elementor-widget-button')) {
          const a = c.querySelector('a[href]');
          if (a) { const s = inline(a).replace(/\s+/g, ' ').trim(); if (!vacio(s)) out.push(`<p class="ugc-doc-p">📎 ${s}</p>`); }
          continue;
        }
        bloques(c, out);
      }
    }
    cerrar();
  };
  const out = [];
  bloques(doc.body, out);
  // Dos <hr> seguidos, o uno al principio o al final, son restos de la maqueta.
  return out.filter((b, i, a) => !(b === '<hr>' && (i === 0 || i === a.length - 1 || a[i - 1] === '<hr>')));
};

// ── 4. Recorrer ───────────────────────────────────────────────────────────────────────────────
const clases = [];
const materiales = [];   // { n, url, texto, modulo }
const sinVtt = [];
let n = 0;
for (const [mi, m] of modulos.entries()) {
  const modulo = nombreModulo(m, mi);
  for (const u of temasDe(m)) {
    n++;
    const p = paginas.get(u);
    const titulo = tituloLimpio(p.crumbs?.at(-1) || p.title);
    // ⚠️ El slug de WordPress puede traer un emoji CODIFICADO («%f0%9f%9f%a2-auditoria…»). Usado tal cual
    // como nombre de archivo, el navegador pide `/cono-doc/…%f0%9f…json`, el server lo decodifica a «🟢»
    // y no encuentra el archivo: 404 sólo en esas lecciones. Se reduce a [a-z0-9-].
    const slugLeccion = u.split('/').filter(Boolean).pop().replace(/%[0-9a-f]{2}/gi, '-').replace(/^nan\d*-*/i, '')
      .toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 90);
    const ctx = { videos: [], materiales: [], imagenes: [] };
    const cuerpo = convertir(p.html, ctx);
    // Los iframes que no aparecieron en el cuerpo (raro, pero el DOM de Elementor anida) igual cuentan.
    for (const s of p.iframes) { const id = idDeIframe(s); if (id && !ctx.videos.includes(id)) ctx.videos.push(id); }

    const videos = [];
    for (const id of ctx.videos) {
      const meta = await metaVideo(id);
      const texto = await textoVtt(id, meta);
      if (!texto) sinVtt.push(`${n} ${titulo} (video ${id})`);
      videos.push({ id, segundos: meta?.segundos ?? 0, texto });
    }
    const segundos = videos.reduce((t, v) => t + v.segundos, 0);
    const urlOriginal = `${ORIGEN}${u}`;
    const nVid = videos.length;
    const html = cuerpo.map((b) => {
      const mm = /^@@VIDEO:(\d+)@@$/.exec(b);
      if (!mm) return b;
      const k = videos.findIndex((v) => v.id === mm[1]) + 1;
      const v = videos[k - 1];
      return `<p class="ugc-doc-note">🎬 ${nVid > 1 ? `Video ${k} de ${nVid}` : 'Video de la lección'}${v?.segundos ? ` · ${hms(v.segundos)}` : ''} — ${v?.texto ? 'su transcripción está en la pestaña «Transcripción»' : 'sin transcripción en la plataforma'}.</p>`;
    }).join('');
    const nota = nVid
      ? `<p class="ugc-doc-note">El video vive en THE NET LAB y no se copia (va cifrado). <a href="${esc(urlOriginal)}" target="_blank" rel="noopener noreferrer">Abrir la lección original</a> con la cuenta del curso.</p>`
      : '';
    const paneles = { 'Lección': `<h2 class="ugc-paper-title">${esc(titulo)}</h2>${nota}${html}` };
    const conTexto = videos.filter((v) => v.texto);
    if (conTexto.length) {
      paneles['Transcripción'] = `<h2 class="ugc-paper-title">Transcripción</h2>`
        + '<p class="ugc-doc-note">Transcripción automática que publica la plataforma del curso, sin corregir: puede confundir nombres propios y términos técnicos.</p>'
        + conTexto.map((v) => (conTexto.length > 1 ? `<div class="ugc-sec-h"><h3>Video ${videos.indexOf(v) + 1}${v.segundos ? ` · ${hms(v.segundos)}` : ''}</h3></div>` : '')
          + enParrafos(v.texto).map((x) => `<p class="ugc-doc-p">${esc(x)}</p>`).join('')).join('');
    }
    // Las imágenes de la lección se traen al repo (public/cono-ugc/): apuntando al sitio de origen, el
    // documento se rompe el día que el dueño las borre o bloquee el hotlink. Son capturas públicas.
    for (const src of ctx.imagenes) {
      const nombreImg = `${SLUG}__${decodeURIComponent(src.split('/').pop().split('?')[0]).replace(/[^A-Za-z0-9._-]+/g, '-')}`;
      const destino = join(REPO, 'public', 'cono-ugc', nombreImg);
      if (!existsSync(destino) && !SIN_RED) {
        const r = await fetch(src, { headers: { 'User-Agent': UA } });
        if (r.ok && /^image\//.test(r.headers.get('content-type') || '')) {
          mkdirSync(dirname(destino), { recursive: true });
          writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
        }
      }
      if (existsSync(destino)) for (const k of Object.keys(paneles)) paneles[k] = paneles[k].split(`src="${esc(src)}"`).join(`src="/cono-ugc/${nombreImg}"`);
      else console.log(`  ⚠ no se pudo traer la imagen ${src}: queda apuntando al origen`);
    }
    writeFileSync(join(dirDoc, `${SLUG}__${slugLeccion}.json`), JSON.stringify({ slug: slugLeccion, titulo, tituloDocumento: 'Lección', paneles }));

    // El .md para el archivo en Drive (texto/): la lección en texto plano y la transcripción.
    const plano = (h) => h.replace(/<li>/g, '\n- ').replace(/<\/(p|h3|pre|table|tr|ul|ol)>/g, '\n').replace(/<hr>/g, '\n---\n')
      .replace(/<br>/g, '\n').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
      .replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
    const archivo = `${String(n).padStart(2, '0')} - ${limpioArchivo(titulo)}`;
    writeFileSync(join(base, 'texto', `${archivo}.md`), [
      `# ${archivo}`, '',
      `> ${modulo} · ${nVid} video(s)${segundos ? ` · ${hms(segundos)}` : ''} · ${urlOriginal}`,
      '> Transcripción: subtítulo automático de la plataforma (Spotlightr), sin corregir.', '',
      '## Apuntes', '', '',
      '## Lección', plano(html), '',
      '## Transcripción', conTexto.map((v) => enParrafos(v.texto).join('\n\n')).join('\n\n---\n\n'), '',
    ].join('\n'));

    for (const x of ctx.materiales) materiales.push({ n, modulo, ...x });
    clases.push({
      n, titulo, modulo, slug: slugLeccion, soloTexto: true, sinFuente: false,
      duracion: segundos ? hms(segundos) : null, segundos,
      url: urlOriginal, videos: videos.map((v) => ({ id: v.id, segundos: v.segundos, tx: Boolean(v.texto) })),
      imagenes: ctx.imagenes.length ? ctx.imagenes : undefined, archivo,
    });
    process.stdout.write(`\r  ${n} clases…`);
  }
}
console.log('');

// ── 5. Los materiales: se bajan los archivos; Canva queda como link ──────────────────────────
// Un recurso es un archivo con NOMBRE «NN - <título>.<ext>» (NN = la clase) y su entrada en
// recursos.json con `clases: [n]` y `tituloReal`: así curso-a-drive.mjs y curso-a-portal.mjs lo
// cuelgan de SU clase en vez de deducirlo del nombre (ver «el vínculo recurso ↔ clase»).
const GENERICO = /^(descargar|descarga|material|aqu[ií]|ac[aá]|link|clic|click)(\s|$)/i;
const items = [];
const vistos = new Set();
const bajar = async (url) => {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  const tipo = r.headers.get('content-type') || '';
  const disp = r.headers.get('content-disposition') || '';
  const buf = Buffer.from(await r.arrayBuffer());
  // ⚠️ Un archivo NO público de Drive no da 403: da 200 con la página de login en HTML.
  if (!r.ok || /text\/html/.test(tipo)) return { ok: false, motivo: `HTTP ${r.status} ${tipo.split(';')[0]}` };
  const nombre = decodeURIComponent((/filename\*=UTF-8''([^;]+)/i.exec(disp) || [])[1] || '')
    // ⚠️ fetch entrega los headers como latin1: un `filename="Auditoría.pdf"` en UTF-8 llega «AuditorÃ­a».
    || Buffer.from(((/filename="([^"]+)"/i.exec(disp) || [])[1] || ''), 'latin1').toString('utf8');
  return { ok: true, buf, nombre, tipo };
};
const EXT_EXPORT = { document: 'docx', spreadsheets: 'xlsx', presentation: 'pptx' };
for (const mt of materiales) {
  const clave = `${mt.n}|${mt.url.replace(/[?#].*$/, '')}`;
  if (vistos.has(clave)) continue;
  vistos.add(clave);
  const nn = String(mt.n).padStart(2, '0');
  const texto = mt.texto.replace(/^📎\s*/, '').trim();
  if (/canva\.com/.test(mt.url)) {
    const titulo = GENERICO.test(texto) ? 'Workbook en Canva' : texto;
    items.push({ nombre: `${nn} - ${limpioArchivo(titulo)}.link`, tipo: 'link', url: mt.url, nivel: 'clase', clases: [mt.n], modulo: mt.modulo, tituloReal: titulo });
    continue;
  }
  const id = (/\/d\/([A-Za-z0-9_-]{20,})/.exec(mt.url) || [])[1];
  const clase = (/docs\.google\.com\/(document|spreadsheets|presentation)\//.exec(mt.url) || [])[1];
  // Un id de 44 es un Doc/Sheet NATIVO (se exporta); uno de 33 es un archivo de Office subido a
  // Drive y abierto en el editor (se baja tal cual). Se prueban los dos caminos en ese orden.
  const caminos = [];
  if (clase && id.length > 40) caminos.push(`https://docs.google.com/${clase}/d/${id}/export?format=${EXT_EXPORT[clase]}`);
  caminos.push(`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`);
  if (clase && id.length <= 40) caminos.push(`https://docs.google.com/${clase}/d/${id}/export?format=${EXT_EXPORT[clase]}`);
  let res = null;
  if (SIN_RED) {
    const ya = readdirSync(join(base, 'recursos')).find((f) => f.startsWith(`${nn} - `) && f.includes(id.slice(0, 6)));
    if (ya) items.push({ nombre: ya, nivel: 'clase', clases: [mt.n], modulo: mt.modulo, tituloReal: ya.replace(/^\d+ - /, '').replace(/ \[[^\]]+\]\.[^.]+$/, ''), url: mt.url });
    // Sin archivo en disco es porque no se pudo bajar (no es público): sigue siendo un LINK, no se pierde.
    else items.push({ nombre: `${nn} - ${limpioArchivo(texto)}.link`, tipo: 'link', url: mt.url, nivel: 'clase', clases: [mt.n], modulo: mt.modulo, tituloReal: texto });
    continue;
  }
  for (const c of caminos) { res = await bajar(c); if (res.ok) break; await espera(300); }
  if (!res?.ok) { console.log(`  ⚠ no se pudo bajar (clase ${mt.n}) «${texto}»: ${res?.motivo}`); items.push({ nombre: `${nn} - ${limpioArchivo(texto)}.link`, tipo: 'link', url: mt.url, nivel: 'clase', clases: [mt.n], modulo: mt.modulo, tituloReal: texto }); continue; }
  const extDe = (res.nombre.match(/\.([A-Za-z0-9]{2,5})$/) || [])[1]
    || (/pdf/.test(res.tipo) ? 'pdf' : /spreadsheet|excel/.test(res.tipo) ? 'xlsx' : /wordprocessing|msword/.test(res.tipo) ? 'docx' : /presentation/.test(res.tipo) ? 'pptx' : 'bin');
  const titulo = GENERICO.test(texto) && res.nombre ? res.nombre.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim() : texto;
  // El id corto en el nombre desambigua dos materiales homónimos de la misma clase. El título real viaja aparte.
  const nombre = `${nn} - ${limpioArchivo(titulo)} [${id.slice(0, 6)}].${extDe.toLowerCase()}`;
  writeFileSync(join(base, 'recursos', nombre), res.buf);
  items.push({ nombre, nivel: 'clase', clases: [mt.n], modulo: mt.modulo, tituloReal: titulo, url: mt.url });
  console.log(`  ↓ ${nombre} (${(res.buf.length / 1024).toFixed(0)} KB)`);
  await espera(300);
}
writeFileSync(join(base, 'recursos.json'), JSON.stringify({ items }, null, 1));

// ── 6. El plan ───────────────────────────────────────────────────────────────────────────────
const plan = {
  curso: CURSO, autor: AUTOR, slug: SLUG, fuente: 'thenet-lab', academy: 'THE NET LAB', referer: `${ORIGEN}/`,
  url: `${ORIGEN}${curso}/`, portadaOrigen: exp.curso.og || undefined,
  ordenModulos: modulos.map((m, i) => nombreModulo(m, i)),
  fuera: fuera.map((u) => `${ORIGEN}${u}`),
  clases,
};
writeFileSync(join(base, 'plan.json'), JSON.stringify(plan, null, 1));

const segTot = clases.reduce((t, c) => t + c.segundos, 0);
const nVideos = clases.reduce((t, c) => t + c.videos.length, 0);
console.log(`\n  Curso   : ${CURSO} — ${AUTOR}`);
console.log(`  Módulos : ${modulos.length} · temas ${clases.length} (patrón de la página: ${publicados.reduce((a, b) => a + b, 0)})`);
console.log(`  Videos  : ${nVideos} · ${hms(segTot)} · ${nVideos - sinVtt.length} con transcripción`);
if (sinVtt.length) console.log(`  ⚠ sin transcripción en la plataforma:\n      ${sinVtt.join('\n      ')}`);
console.log(`  Recursos: ${items.filter((i) => !i.tipo).length} archivo(s) + ${items.filter((i) => i.tipo === 'link').length} link(s)`);
const imgs = clases.flatMap((c) => c.imagenes ?? []);
if (imgs.length) console.log(`  Imágenes: ${imgs.length}, traídas a public/cono-ugc/ (las que no, avisadas arriba)`);
if (fuera.length) console.log(`  Fuera del curso publicado: ${fuera.join(', ')}`);
console.log(`\n  → ${join(base, 'plan.json')}\n  → ${dirDoc}\\${SLUG}__*.json (${clases.length})\n`);
