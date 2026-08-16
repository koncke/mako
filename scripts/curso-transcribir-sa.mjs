// Transcribe un curso con ScreenApp (gratis: ya está pago) en vez de whisper-1.
//
// Por qué esta ruta y no la de OpenAI: 249 clases × 13,7 min son US$20 con
// whisper-1 y US$0 acá. La de OpenAI (curso-transcribir.ts) queda como respaldo.
//
// El flujo, ya verificado contra la API:
//   POST /v2/folders/{team}                          -> carpeta del curso
//   POST /v2/files/upload/urls/{team}/{folder}       -> { fileId, uploadUrl }
//   PUT  <uploadUrl>                                 -> los bytes (GCS firmado)
//   POST /v2/files/upload/finalize/{team}/{folder}   -> queda encolado
//   GET  /v2/files/{fileId}                          -> transcript.text + segments
//
// Dos cosas que hacen esto mejor que la ruta de OpenAI, aparte del precio:
//   · `transcript.segments[]` trae cortes naturales con timestamps, así que los
//     párrafos salen de la fuente y no de una heurística de partir por oraciones.
//   · No hay tope de 25 MB, así que no hace falta trocear.
//
// ⚠️ El gotcha histórico de ScreenApp (ver docs/hallazgos-conocimiento.md): la
// plataforma AUTO-RENOMBRA lo que se sube y no guarda el id de origen, así que
// matchear por nombre después es inservible. Acá no aplica porque el fileId lo
// devuelve el propio upload — y se PERSISTE en sa-fileids.json, así que un
// reintento poletea lo ya subido en vez de volver a subirlo.
//
//   node <abs>\scripts\curso-transcribir-sa.mjs --plan C:\cursos\<slug>\plan.json
//   node <abs>\scripts\curso-transcribir-sa.mjs --plan … --paralelo 4

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname, basename } from 'node:path';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const PLAN = arg('plan', '');
const REPO = arg('repo', 'C:\\Users\\marti\\OneDrive\\Escritorio\\dashboard-marketing-main\\dashboard-marketing');
const PARALELO = Math.max(1, Math.min(6, Number(arg('paralelo', 3))));
const TOPE_MIN = Number(arg('tope-min', 25)); // minutos de espera por clase
const BASE = 'https://api.screenapp.io/v2';

if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }
const base = dirname(PLAN);
// Ver la nota del BOM en curso-bajar.mjs: PowerShell 5.1 lo mete y JSON.parse muere.
const plan = JSON.parse(readFileSync(PLAN, 'utf8').replace(/^﻿/, ''));
const dirAudio = arg('de', join(base, 'audio'));
const dirTexto = arg('a', join(base, 'texto'));

// Credenciales del .env.local del repo (nunca en el código ni en el plan).
const env = Object.fromEntries(
  readFileSync(join(REPO, '.env.local'), 'utf8').split(/\r?\n/)
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]),
);
const TOKEN = env.SCREENAPP_TOKEN, TEAM = env.SCREENAPP_TEAM_ID;
if (!TOKEN || !TEAM) {
  console.error('\n  ✖ Faltan SCREENAPP_TOKEN / SCREENAPP_TEAM_ID en .env.local\n');
  process.exit(1);
}
const H = { Authorization: `Bearer ${TOKEN}`, 'X-Team-ID': TEAM };

const api = async (ruta, init) => {
  const r = await fetch(`${BASE}${ruta}`, init);
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  if (!r.ok) throw new Error(`${init?.method ?? 'GET'} ${ruta} -> ${r.status} ${t.slice(0, 160)}`);
  return j;
};
const hhmm = (s) => (s == null ? '?' : `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, '0')}s`);
const mimeDe = (f) => ({ '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.mp4': 'video/mp4', '.webm': 'audio/webm' })[extname(f).toLowerCase()] ?? 'application/octet-stream';

if (!existsSync(dirAudio)) { console.error(`\n  ✖ No existe ${dirAudio}. Corré curso-audio.mjs antes.\n`); process.exit(1); }
mkdirSync(dirTexto, { recursive: true });

// ── Agrupar audio por clase (las partes de un troceo son UNA clase) ──────────
const grupos = new Map();
for (const f of readdirSync(dirAudio).sort()) {
  if (!mimeDe(f).startsWith('audio') && !f.endsWith('.mp4')) continue;
  const m = /^(.*)\.parte\d+$/.exec(basename(f, extname(f)));
  const clave = m ? m[1] : basename(f, extname(f));
  grupos.set(clave, [...(grupos.get(clave) ?? []), f]);
}
if (!grupos.size) { console.error(`\n  ✖ No hay audio en ${dirAudio}\n`); process.exit(1); }

// ── Carpeta del curso en ScreenApp (se reusa por nombre) ─────────────────────
const nombreCarpeta = `MaKo · ${plan.curso}`.slice(0, 90);
const mapaPath = join(base, 'sa-fileids.json');
const mapa = existsSync(mapaPath) ? JSON.parse(readFileSync(mapaPath, 'utf8')) : { carpeta: null, files: {} };

const carpetas = new Map();
const juntar = (o, prof = 0) => {
  if (!o || prof > 5) return;
  if (Array.isArray(o)) return o.forEach((x) => juntar(x, prof + 1));
  if (typeof o === 'object') {
    const id = o._id ?? o.id, nom = o.name ?? o.title;
    if (typeof id === 'string' && typeof nom === 'string') carpetas.set(nom, id);
    Object.values(o).forEach((x) => juntar(x, prof + 1));
  }
};
juntar(await api(`/folders/${TEAM}`, { headers: H }));

// El id no viene siempre en la misma rama de la respuesta (data._id, data.folder._id,
// _id…), así que se busca el primer uuid bajo una clave de id en vez de asumir la ruta.
// Asumirla fue lo que hizo fallar la primera versión con un «no pude crear la carpeta»
// cuando la carpeta SÍ se había creado.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idDeRespuesta = (o, prof = 0) => {
  if (!o || typeof o !== 'object' || prof > 6) return null;
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string' && /^(_id|id|folderId)$/i.test(k) && UUID.test(v)) return v;
  }
  for (const v of Object.values(o)) {
    const r = idDeRespuesta(v, prof + 1);
    if (r) return r;
  }
  return null;
};

const CARPETA_ARG = arg('carpeta', '');
if (!mapa.carpeta) {
  mapa.carpeta = CARPETA_ARG || carpetas.get(nombreCarpeta) || null;
  if (!mapa.carpeta) {
    const creada = await api(`/folders/${TEAM}`, {
      method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nombreCarpeta }),
    });
    mapa.carpeta = idDeRespuesta(creada);
    if (!mapa.carpeta) {
      console.error(`\n  ✖ Creé la carpeta pero no encontré su id en la respuesta.`);
      console.error(`    claves devueltas: ${Object.keys(creada ?? {}).join(', ')}`);
      console.error(`    Pasá una carpeta existente con --carpeta <uuid>.\n`);
      process.exit(1);
    }
  }
  writeFileSync(mapaPath, JSON.stringify(mapa, null, 2), 'utf8');
}

console.log(`\n  Curso    : ${plan.curso}`);
console.log(`  Carpeta  : ${nombreCarpeta} (${mapa.carpeta})`);
console.log(`  Clases   : ${grupos.size} con audio · paralelo ${PARALELO}`);
console.log(`  Motor    : ScreenApp (sin costo por minuto)\n`);

// ── Subir una pieza y devolver su fileId ─────────────────────────────────────
const subir = async (ruta) => {
  const nombre = basename(ruta);
  const ct = mimeDe(nombre);
  const u = await api(`/files/upload/urls/${TEAM}/${mapa.carpeta}`, {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: [{ contentType: ct, name: nombre }] }),
  });
  const p = u?.data?.uploadParams?.[0];
  if (!p?.fileId || !p?.uploadUrl) throw new Error('la respuesta de upload/urls no trajo fileId+uploadUrl');
  const put = await fetch(p.uploadUrl, { method: 'PUT', headers: { 'Content-Type': ct }, body: readFileSync(ruta) });
  if (!put.ok) throw new Error(`PUT a la URL firmada -> ${put.status}`);
  await api(`/files/upload/finalize/${TEAM}/${mapa.carpeta}`, {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ file: { fileId: p.fileId, contentType: ct, name: nombre } }),
  });
  return p.fileId;
};

// ── Esperar la transcripción de un fileId ────────────────────────────────────
const esperar = async (fileId) => {
  const hasta = Date.now() + TOPE_MIN * 60000;
  let espera = 6000;
  while (Date.now() < hasta) {
    await new Promise((r) => setTimeout(r, espera));
    espera = Math.min(20000, espera * 1.25); // backoff suave
    let d;
    try { d = await api(`/files/${fileId}`, { headers: H }); } catch { continue; }
    const tx = (d?.data ?? d)?.transcript;
    if (tx?.text && tx.text.trim().length > 20) return tx;
  }
  throw new Error(`no llegó la transcripción en ${TOPE_MIN} min`);
};

// Los párrafos salen de los segmentos de la fuente, con sus cortes naturales.
// Si no vinieran, se cae al texto plano entero (mejor eso que perderlo).
const parrafos = (tx) => {
  const segs = (tx.compact_segments?.length ? tx.compact_segments : tx.segments) ?? [];
  const ps = segs.map((s) => String(s.text ?? '').trim()).filter(Boolean);
  return ps.length ? ps : [String(tx.text ?? '').trim()].filter(Boolean);
};

// ── Trabajar las clases, con paralelismo acotado ─────────────────────────────
// texto/ puede estar plano u organizado en «<NN Módulo>/» (ver curso-organizar.mjs).
// El .md existente se busca EN LOS DOS layouts: si solo se mirara la raíz, un curso ya
// organizado se re-transcribiría entero (247 clases) creyendo que falta todo.
const listarUnNivel = (dir) => !existsSync(dir) ? [] : readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => e.isDirectory()
    ? readdirSync(join(dir, e.name)).map((f) => join(e.name, f))
    : [e.name]);
const mdExistente = new Map(
  listarUnNivel(dirTexto).filter((r) => basename(r).endsWith('.md') && basename(r) !== '_indice.md')
    .map((r) => [basename(r, '.md'), r]),
);
// Y el nuevo se ESCRIBE en la carpeta de su módulo, para no desarmar lo organizado.
const nDeClave = (s) => { const m = /^(\d{1,3})\s*-\s*/.exec(s); return m ? Number(m[1]) : null; };
const limpioMod = (s) => String(s).normalize('NFC').replace(/[<>:"/\\|?*\u0000-]/g, '')
  .replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 120);
const carpetaDeClase = new Map(plan.clases.map((c) => [c.n,
  limpioMod(c.modulo ?? '').replace(/^(\d+)\.\s*/, (_, n) => `${String(n).padStart(2, '0')} `)]));
// Solo se usa subcarpeta si el curso YA está organizado; si está plano, se respeta plano.
const organizado = listarUnNivel(dirTexto).some((r) => r.includes('\\')) ||
  listarUnNivel(join(base, 'video')).some((r) => r.includes('\\'));
const destinoMd = (clave) => {
  const carpeta = organizado ? (carpetaDeClase.get(nDeClave(clave)) || '') : '';
  return carpeta ? join(dirTexto, carpeta, `${clave}.md`) : join(dirTexto, `${clave}.md`);
};

const pendientes = [...grupos.entries()].sort().filter(([clave]) => !mdExistente.has(clave));
const yaEstaban = grupos.size - pendientes.length;
if (yaEstaban) console.log(`  (${yaEstaban} ya tenían .md, se saltean)\n`);

let hechas = 0, fallidas = 0;
const errores = [];

// ⚠️ Un clip demasiado corto NO se manda a transcribir: ScreenApp lo acepta y no
// devuelve nada NUNCA, y cada intento cuesta 25 minutos de espera más una subida.
// Medido en «Master Marca Personal 5.0»: la clase «2. Así funciona la formación» dura
// 6 segundos —la plataforma misma publica 00:06— y falló cuatro veces seguidas, cada
// una con su re-subida. Las clases sanas del mismo curso van de 80 a 170 segundos.
//
// El piso mira el TAMAÑO del audio y no su duración, para no depender de ffprobe acá:
// a 32 kbps mono, 8 KB son ~2 segundos de audio. Es un piso deliberadamente bajo —
// solo descarta lo que no puede tener contenido, no lo que es corto.
// Y la segunda forma de «nada que transcribir», que el tamaño solo NO ve: una clase
// de duración normal con el audio en SILENCIO. «7. Introducción a Calendly» dura 4:55
// y su audio pesa 38 KB — 129 bytes por segundo, contra ~4.100 de una clase hablada.
// Es una grabación de pantalla sin narración. Pasa el piso absoluto y falla igual.
//
// La señal es la TASA, no el peso. El umbral está al 10% de lo normal: no descarta una
// clase de audio flojo, solo una que no tiene voz. La duración sale del plan.
// ⚠️ El piso de TASA (B/s) se midió mal la primera vez y hay que dejar escrito por qué.
// Nació con 400 B/s para atajar un clip de Heras de 4:55 con audio mudo (129 B/s contra
// ~4100 de uno normal). En «Creator Club» rechazó DIEZ clases sanas de hasta 87 minutos:
// son tutoriales de pantalla con voz a bitrate muy bajo, y la #16 da 104 B/s.
//
// O sea que la tasa **ya no separa**: el clip mudo (129 B/s) está POR ENCIMA de clases
// perfectamente buenas. Lo que sí separa es el TAMAÑO ABSOLUTO — el mudo pesaba 38 KB y
// éstas pesan de 126 KB a 1,4 MB. Es la regla de AGENTS.md sobre umbrales: un proxy hay
// que medirlo contra los datos reales, y el que hoy tiene aire mañana no.
//
// Por eso el piso de tasa baja a 60 B/s (queda solo como red contra un archivo casi
// vacío y largo) y el trabajo pesado lo hace el piso de bytes, que sube a 64 KB.
const MINIMO_BYTES = Number(arg('min-bytes', 65536));
const MINIMO_BPS = Number(arg('min-bytes-seg', 60));
const segundosDeClase = new Map(plan.clases.map((c) => [c.archivo, Number(c.segundos) || 0]));
const saltadas = [];

const unaClase = async ([clave, piezas]) => {
  const total = piezas.reduce((t, f) => { try { return t + statSync(join(dirAudio, f)).size; } catch { return t; } }, 0);
  const dur = segundosDeClase.get(clave) ?? 0;
  const motivo = total > 0 && total < MINIMO_BYTES ? `${(total / 1024).toFixed(1)} KB: clip demasiado corto`
    : (total > 0 && dur > 30 && total / dur < MINIMO_BPS) ? `${Math.round(total / dur)} B/s en ${dur}s: audio sin voz`
      : null;
  if (motivo) {
    saltadas.push({ clave, motivo });
    console.log(`  – ${clave} — ${motivo}, la salteo`);
    return;
  }
  const trozos = [];
  let segundos = 0, idioma = null;
  for (const [i, f] of piezas.entries()) {
    const ruta = join(dirAudio, f);
    const etiqueta = piezas.length > 1 ? `${clave} [${i + 1}/${piezas.length}]` : clave;
    try {
      // Reanudable: si ya se subió, se poletea en vez de volver a subir.
      let fid = mapa.files[f];
      if (!fid) {
        fid = await subir(ruta);
        mapa.files[f] = fid;
        writeFileSync(mapaPath, JSON.stringify(mapa, null, 2), 'utf8');
      }
      let tx;
      try { tx = await esperar(fid); }
      catch (e) {
        // ⚠️ Si venció la espera, el fileId persistido queda INSERVIBLE y hay que
        // soltarlo. ScreenApp puede aceptar un archivo y no transcribirlo NUNCA:
        // la clase 191 de «Vender Por FB E IG ADS» quedó allá con su nombre y su
        // duración exactas, sin campo `transcript`, sin campo de estado y sin
        // error. Como el id seguía en el mapa, cada reintento poleteaba el MISMO
        // trabajo muerto — o sea que el reintento no podía funcionar nunca, y el
        // síntoma era idéntico a «tarda mucho». Soltándolo, el próximo intento
        // sube una copia nueva, que es lo único que puede destrabarlo.
        delete mapa.files[f];
        writeFileSync(mapaPath, JSON.stringify(mapa, null, 2), 'utf8');
        throw e;
      }
      trozos.push(...parrafos(tx));
      segundos += Number(tx.duration) || 0;
      idioma ??= tx.language ?? null;
      console.log(`  ✓ ${etiqueta}  ${hhmm(Number(tx.duration) || null)}  (${(statSync(ruta).size / 1048576).toFixed(1)} MB)`);
    } catch (e) {
      errores.push({ clave, archivo: f, error: e.message });
      console.error(`  ✖ ${etiqueta} — ${e.message}`);
      return void fallidas++;
    }
  }
  if (!trozos.length) { errores.push({ clave, error: 'transcripción vacía' }); return void fallidas++; }

  // Mismo formato que curso-transcribir.ts, así curso-a-portal.mjs no cambia.
  const cabecera = [
    `# ${clave}`, '',
    `> ${hhmm(segundos)}${idioma ? ` · ${idioma}` : ''}${piezas.length > 1 ? ` · ${piezas.length} partes` : ''} · transcripción automática (ScreenApp), sin corregir.`,
    '>', '> Tus apuntes van acá arriba. Lo de abajo es materia prima para leer, no para',
    '> mandar al RAG tal cual.', '', '## Apuntes', '', '', '## Transcripción', '',
  ].join('\n');
  const salidaMd = destinoMd(clave);
  mkdirSync(dirname(salidaMd), { recursive: true });
  writeFileSync(salidaMd, cabecera + trozos.join('\n\n') + '\n', 'utf8');
  hechas++;
};

const cola = [...pendientes];
await Promise.all(Array.from({ length: PARALELO }, async () => {
  while (cola.length) await unaClase(cola.shift());
}));

// El índice se arma con las rutas RELATIVAS, así los links funcionan igual esté el
// curso plano u organizado por módulo.
const md = listarUnNivel(dirTexto).filter((r) => basename(r).endsWith('.md') && basename(r) !== '_indice.md').sort();
writeFileSync(join(dirTexto, '_indice.md'),
  `# Clases transcriptas\n\n${md.map((r) => `- [${basename(r, '.md')}](${r.split('\\').map(encodeURIComponent).join('/')})`).join('\n')}\n`, 'utf8');

console.log(`\n  ${hechas} transcripta(s) · ${yaEstaban} ya estaban · ${fallidas} fallada(s)` +
  (saltadas.length ? ` · ${saltadas.length} salteada(s) por muy corta(s)` : ''));
console.log(`  Índice: ${join(dirTexto, '_indice.md')}`);
if (errores.length) {
  console.log(`\n  Fallaron (volver a correr reintenta; lo subido NO se re-sube):`);
  for (const e of errores.slice(0, 10)) console.log(`    ${e.clave} — ${e.error}`);
}
console.log('');
process.exit(fallidas && !hechas ? 1 : 0);
