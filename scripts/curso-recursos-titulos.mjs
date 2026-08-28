// Le pregunta a CADA recurso descargado cómo se llama, y lo escribe en el manifiesto.
//
//   node scripts/curso-recursos-titulos.mjs --plan C:/cursos/<slug>/plan.json
//   node scripts/curso-recursos-titulos.mjs --plan … --ver     # no escribe, solo muestra
//
// ⚠️ POR QUÉ HACE FALTA: NINGUNO de los otros dos nombres es el título del documento.
//
//   nombre de archivo  →  «Oferta Especializada - 1BsAB3OL.pdf»   (lo fabricó el bajador:
//                         título de la SECCIÓN + 8 chars del id del Google Doc, para que
//                         dos materiales homónimos no se pisaran en disco)
//   label del manifiesto → «Oferta Especializada»                 (es el nombre de la
//                         SECCIÓN donde está colgado, no del archivo)
//   título interno      →  «MB | Psicologia de ventas»            ← el bueno
//
// Medido en MasteryHaus el 28/08/2026: SIETE recursos distintos —tamaños y hashes
// distintos— se publicaban los siete como «Por qué hablamos de G. del Tiempo», con la
// misma descripción («Material de 27 clases»). Eran «ACTIVIDAD #2», «3. Futuro poco
// feliz», «7. Tracker extra», «Define tus no negociables»… Imposibles de distinguir, y
// el usuario no tenía forma de saber cuál abrir.
//
// Es la regla de AGENTS.md: **lo que un material dice DE SÍ MISMO le gana a la etiqueta
// que le puso el sistema**. Acá el sistema puso dos etiquetas y las dos eran de otra cosa.
//
// ⚠️ Y OJO CON EL UTF-16: los títulos de un PDF son cadenas de texto PDF, que van en
//    UTF-16BE con BOM `FE FF`. Leídas como bytes se ven con un espacio entre cada letra
//    («5 .   D e f i n e   t u   s i s t e m a») — se leen como un título raro pero
//    válido, así que pasan cualquier revisión visual y llegan a la pantalla así.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { join, dirname, extname } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const tiene = (n) => process.argv.includes(`--${n}`);
const PLAN = arg('plan', '');
if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }
const base = dirname(PLAN);
const MANIFIESTO = join(base, 'recursos-manifiesto.json');
const DIR = join(base, 'recursos');

/** Un título de PDF puede venir en UTF-16BE con BOM. Sin esto llega con un espacio entre letras. */
const textoPdf = (buf) => {
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return buf.subarray(2).toString('utf16le').split('').reverse().join('') === '' ? '' : Buffer.from(buf.subarray(2)).swap16().toString('utf16le');
  return buf.toString('latin1');
};

const limpiar = (s) => String(s || '')
  .replace(/\u0000/g, '')
  .replace(/^[\uFEFF\uFFFD\s\-_·|]+/, '')          // BOM, reemplazos y separadores sueltos al principio
  .replace(/\.(docx?|xlsx?|pptx?|pdf|html?|txt)$/i, '')  // el título suele ser el nombre del original
  .replace(/\s+/g, ' ')
  .trim();

// ⚠️ xlsx/docx/pptx son ZIPS, y su título vive en `docProps/core.xml`. Node no trae
//    lector de zip, y por UN archivo XML no vale la pena una dependencia: se lee el
//    directorio central a mano y se infla la entrada con `inflateRawSync`.
//
//    Sin esto, los 6 .xlsx de MasteryHaus se publicaban con el nombre de su SECCIÓN
//    —dos de ellos como «¿Por qué hablamos de Marketing Perpetuo», idénticos entre sí—.
const entradaZip = (buf, nombre) => {
  // Fin del directorio central (EOCD): se busca desde el final, la firma es PK\x05\x06.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  let p = buf.readUInt32LE(eocd + 16);          // offset del directorio central
  const n = buf.readUInt16LE(eocd + 10);        // cuántas entradas
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) return null;
    const metodo = buf.readUInt16LE(p + 10);
    const comp = buf.readUInt32LE(p + 20);
    const lenN = buf.readUInt16LE(p + 28);
    const lenE = buf.readUInt16LE(p + 30);
    const lenC = buf.readUInt16LE(p + 32);
    const off = buf.readUInt32LE(p + 42);
    const nom = buf.subarray(p + 46, p + 46 + lenN).toString('latin1');
    if (nom === nombre) {
      // La cabecera local repite los largos: hay que saltearla para llegar a los datos.
      const lN = buf.readUInt16LE(off + 26);
      const lE = buf.readUInt16LE(off + 28);
      const datos = buf.subarray(off + 30 + lN + lE, off + 30 + lN + lE + comp);
      try { return metodo === 0 ? datos : inflateRawSync(datos); } catch { return null; }
    }
    p += 46 + lenN + lenE + lenC;
  }
  return null;
};

/** El título que el archivo declara de sí mismo, o null si no declara ninguno. */
const tituloInterno = (ruta) => {
  let b;
  try { b = readFileSync(ruta); } catch { return null; }
  const ext = extname(ruta).toLowerCase();

  if (ext === '.xlsx' || ext === '.docx' || ext === '.pptx') {
    const core = entradaZip(b, 'docProps/core.xml');
    if (!core) return null;
    const m = /<dc:title>([\s\S]*?)<\/dc:title>/i.exec(core.toString('utf8'));
    return m ? (limpiar(m[1]) || null) : null;
  }

  if (ext === '.html' || ext === '.htm') {
    const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(b.toString('utf8'));
    return m ? limpiar(m[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')) : null;
  }

  // PDF: primero el XMP (texto plano, UTF-8), que es el más fiable; después /Title del Info.
  const s = b.toString('latin1');
  const xmp = /<dc:title>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/i.exec(b.toString('utf8'));
  if (xmp) { const t = limpiar(xmp[1].replace(/<[^>]+>/g, '')); if (t) return t; }

  const m = /\/Title\s*\(((?:\\.|[^\\)])*)\)/.exec(s);
  if (!m) return null;
  const crudo = Buffer.from(m[1].replace(/\\([()\\])/g, '$1'), 'latin1');
  const t = limpiar(textoPdf(crudo));
  return t || null;
};

if (!existsSync(MANIFIESTO)) { console.error(`\n  ✖ No hay ${MANIFIESTO}\n`); process.exit(1); }
const man = JSON.parse(readFileSync(MANIFIESTO, 'utf8'));

let con = 0, sin = 0, cambian = 0;
for (const r of man) {
  if (r.tipo !== 'archivo' || !r.archivo) continue;
  const t = tituloInterno(join(DIR, r.archivo));
  if (!t) { sin++; continue; }
  con++;
  if (t !== r.label) cambian++;
  r.tituloReal = t;
}

console.log(`\n  ${con} recurso(s) declaran su título · ${sin} no lo declaran · ${cambian} difieren del label\n`);
const muestra = man.filter((r) => r.tituloReal && r.tituloReal !== r.label).slice(0, 14);
for (const r of muestra) {
  console.log(`     ${String(r.label || '').slice(0, 40).padEnd(40)} → ${r.tituloReal.slice(0, 46)}`);
}

// ⚠️ Los que NO declaran título se quedan con el label de la sección, que es lo que había:
// inventar uno sería peor. Se listan para que se vean.
const huerfanos = man.filter((r) => r.tipo === 'archivo' && r.archivo && !r.tituloReal);
if (huerfanos.length) {
  console.log(`\n  Sin título interno (se quedan con el label de la sección):`);
  for (const r of huerfanos.slice(0, 12)) console.log(`     · ${String(r.archivo).slice(0, 62)}`);
}

if (tiene('ver')) { console.log('\n  (--ver: no escribí nada)\n'); process.exit(0); }
writeFileSync(MANIFIESTO, JSON.stringify(man, null, 1), 'utf8');
console.log(`\n  → ${MANIFIESTO}`);
console.log(`  Seguí con:  node scripts/curso-a-portal.mjs --plan ${PLAN}\n`);
