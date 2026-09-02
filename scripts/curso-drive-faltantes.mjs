// Que carpetas de Drive NO estan cargadas en MaKo.
//
//   node --import tsx scripts/curso-drive-faltantes.mjs
//   node --import tsx scripts/curso-drive-faltantes.mjs --min-videos 5
//
// La convencion de Drive es «<Curso> - <Autor>», y en el portal el titulo se arma igual
// (`conAutor`), asi que el cruce va por titulo normalizado. No por slug: el slug de la
// carpeta no existe.
//
// ⚠️ SE NORMALIZA ANTES DE COMPARAR. «Sofia» y «Sofía» se ven identicos en cualquier
//    listado y son strings distintos: ese error ya costo una carpeta duplicada de 60 GB en
//    Drive. Se compara sin acentos, sin mayusculas y con los espacios colapsados.
//
// ⚠️ Y DRIVE TIENE CASI-DUPLICADOS PROPIOS —«Academia de Lanzamiento» y «...Lanzamientos»,
//    «Automatizatube - Carlota» y «- Carlotta»—. Se agrupan por su forma normalizada SIN
//    el autor, para no reportar dos veces el mismo curso ni contarlo como faltante cuando
//    su gemelo si esta cargado.
import { readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const MIN_VIDEOS = Number(arg('min-videos', 1));
const RAIZ = arg('drive', 'G:/My Drive/MARKETING KONCEPT/CURSOS');

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
if (!existsSync(RAIZ)) { console.error(`\n  ✖ No veo ${RAIZ} — ¿está montado Drive?\n`); process.exit(2); }

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/gi, ' ').toLowerCase().trim();
// Sin el autor: lo que va despues del ultimo « - ». Sirve para agrupar los casi-duplicados
// de Drive y para cruzar contra un titulo del portal que quiza no lo lleve.
const sinAutor = (s) => {
  const i = String(s).lastIndexOf(' - ');
  return norm(i > 0 ? String(s).slice(0, i) : s);
};

const { CURSOS_TODOS } = await import(pathToFileURL(join(REPO, 'app/conocimientos/catalogo.ts')).href);

/**
 * ⚠️ EL CRUCE EXACTO NO ALCANZA, Y EQUIVOCARSE HACIA «FALTA» ES LO CARO.
 *
 * La primera version comparaba titulos normalizados y declaro sin cargar a NUEVE cursos
 * que ya estan, porque la carpeta y la ficha se llaman parecido y no igual:
 *
 *   «Ecom Growth Partner - Jaime Higuera»                    →  Growth Partner
 *   «Superior Universitario en IA Generativa UDIA - Anas…»    →  UDIA
 *   «Instituto Marca Personal - Sergio Begueira»              →  Instituto DE Marca Personal - Begueria
 *   «Universidad del Closer 2.0 - Tino Mossu»                 →  La universidad del Closer
 *   «Jan - Anuncio Ganador»                                   →  Anuncio Ganador - Jan Schroeder
 *
 * Con eso, el informe mandaba a bajar 494 GB de material que ya tenemos. Un cruce que se
 * equivoca hacia «esta» pierde un curso; uno que se equivoca hacia «falta» hace trabajo de
 * dias sobre lo mismo, y encima lo publica duplicado.
 *
 * Asi que se cruza por SOLAPAMIENTO DE PALABRAS, pesando cada una por lo rara que es: las
 * que se repiten en medio catalogo —«curso», «academia», «de», «ia»— no dicen nada, y una
 * sola palabra propia («belikethealgo», «arcadia») identifica sin ayuda.
 */
const PALABRAS_VACIAS = new Set(['curso', 'cursos', 'de', 'del', 'la', 'el', 'los', 'las', 'y', 'con', 'en', 'para', 'a', 'tu', 'tus', 'mi', 'por', 'academia', 'master', 'programa', 'formacion', 'completo', 'online', 'pro', 'vip']);
const fichas = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 2 && !PALABRAS_VACIAS.has(w)));

// Cuantos titulos del portal contienen cada palabra: una que aparece en 40 no distingue.
const frecuencia = new Map();
for (const c of CURSOS_TODOS) for (const w of fichas(c.titulo)) frecuencia.set(w, (frecuencia.get(w) ?? 0) + 1);
const peso = (w) => 1 / Math.log2(2 + (frecuencia.get(w) ?? 0));

const parecido = (a, b) => {
  const A = fichas(a), B = fichas(b);
  if (!A.size || !B.size) return 0;
  let comun = 0, total = 0;
  for (const w of A) { total += peso(w); if (B.has(w)) comun += peso(w); }
  let comunB = 0, totalB = 0;
  for (const w of B) { totalB += peso(w); if (A.has(w)) comunB += peso(w); }
  // El MAYOR de los dos lados: «Ecom Growth Partner» contiene entero a «Growth Partner»,
  // y mirar solo desde el lado largo lo penalizaria por las palabras que le sobran.
  return Math.max(comun / total, comunB / totalB);
};

const enPortal = new Set();
for (const c of CURSOS_TODOS) {
  enPortal.add(norm(c.titulo));
  enPortal.add(sinAutor(c.titulo));
  if (c.tituloCorto) enPortal.add(norm(c.tituloCorto));
}

// Umbrales: por encima de ALTO se da por cargado; en el medio se REPORTA APARTE para que
// lo mire una persona, que es lo que hay que hacer cuando el cruce no esta seguro.
const ALTO = 0.72;
const DUDOSO = 0.45;
/**
 * ⚠️ EL AUTOR NO DECIDE, CONFIRMA.
 *
 * Comparando el titulo entero, el nombre del autor era lo que mas pesaba —es la palabra
 * mas rara de la cadena— y emparejaba cursos DISTINTOS del mismo instructor:
 *
 *   «Agencia MiniGrowing - Agustín Nievas»   vs  «Growing Setters 3.0 - Agustín Nievas»
 *   «AGENCIA 6 CIFRAS V2 - Marcos Razzetti»  vs  «BlueHacker 2.0 - Marcos Razzetti»
 *   «Fórmula Ventas Ilimitadas - Otálora»    vs  «Protocolo IA - Julián Otálora»
 *
 * Nueve de once «parecidos» eran eso. Asi que el parecido se calcula sobre el TITULO SIN
 * AUTOR, y el autor solo suma un poco cuando ademas coincide.
 */
const autorDe = (s) => { const i = String(s).lastIndexOf(' - '); return i > 0 ? norm(String(s).slice(i + 3)) : ''; };

/**
 * Y un typo no comparte NINGUN token: «Seel Your Knowlegde» contra «Sell Your Knowledge»
 * da cero por palabras y es obviamente el mismo curso. Para eso, parecido por caracteres
 * (bigramas), que es ciego al orden y tolera letras cambiadas.
 */
const bigramas = (s) => { const x = norm(s).replace(/ /g, ''); const g = new Set(); for (let i = 0; i < x.length - 1; i++) g.add(x.slice(i, i + 2)); return g; };
const parecidoLetras = (a, b) => {
  const A = bigramas(a), B = bigramas(b);
  if (!A.size || !B.size) return 0;
  let c = 0; for (const g of A) if (B.has(g)) c++;
  return (2 * c) / (A.size + B.size);
};

const mejorEnPortal = (nombre) => {
  // ⚠️ `sinAutor` asume que el autor va al FINAL, y la convencion no siempre se respeta:
  //    «Jan - Anuncio Ganador» tiene el autor primero, asi que recortar por el ultimo « - »
  //    deja «jan» y no matchea nada. Se prueban las dos mitades y el nombre entero.
  const partes = String(nombre).split(' - ');
  const candidatos = [sinAutor(nombre), norm(nombre), norm(partes[partes.length - 1]), norm(partes[0])];
  const tituloDrive = sinAutor(nombre);
  const autorDrive = autorDe(nombre);
  let mejor = null, score = 0;
  for (const c of CURSOS_TODOS) {
    const tituloPortal = sinAutor(c.titulo);
    const base = Math.max(
      ...candidatos.flatMap((cand) => [
        parecido(cand, tituloPortal),
        parecido(cand, norm(c.tituloCorto ?? '')),
        parecidoLetras(cand, tituloPortal),
      ]),
    );
    // El autor no puede levantar un titulo que no se parece: suma poco y solo si ya hay algo.
    const s = base >= 0.35 && autorDrive && autorDrive === autorDe(c.titulo) ? Math.min(1, base + 0.12) : base;
    if (s > score) { score = s; mejor = c; }
  }
  return { mejor, score };
};

// Cuantos videos tiene una carpeta, recursivo y acotado: sin esto un directorio con dos
// PDFs se reporta como «curso faltante».
const cuentaVideos = (dir, prof = 0) => {
  if (prof > 4) return { n: 0, mb: 0 };
  let n = 0, mb = 0;
  let e = [];
  try { e = readdirSync(dir, { withFileTypes: true }); } catch { return { n, mb }; }
  for (const x of e) {
    const p = join(dir, x.name);
    if (x.isDirectory()) { const r = cuentaVideos(p, prof + 1); n += r.n; mb += r.mb; }
    else if (/\.(mp4|mkv|webm|mov|m4v)$/i.test(x.name)) {
      n++;
      try { mb += statSync(p).size / 1e6; } catch { /* se lo llevaron entre el listado y el stat */ }
    }
  }
  return { n, mb };
};

const carpetas = readdirSync(RAIZ, { withFileTypes: true }).filter((x) => x.isDirectory()).map((x) => x.name);

const faltan = [];
const estan = [];
const chicas = [];
const dudosos = [];
for (const nombre of carpetas) {
  const clave = norm(nombre);
  const claveSin = sinAutor(nombre);
  if (enPortal.has(clave) || enPortal.has(claveSin)) { estan.push(nombre); continue; }
  const { mejor, score } = mejorEnPortal(nombre);
  if (score >= ALTO) { estan.push(nombre); continue; }
  const { n, mb } = cuentaVideos(join(RAIZ, nombre));
  if (n < MIN_VIDEOS) { chicas.push({ nombre, n, mb }); continue; }
  if (score >= DUDOSO) { dudosos.push({ nombre, n, mb, mejor, score }); continue; }
  faltan.push({ nombre, n, mb, claveSin, mejor, score });
}

// Agrupar los casi-duplicados: mismo curso, dos carpetas.
const grupos = new Map();
for (const f of faltan) grupos.set(f.claveSin, [...(grupos.get(f.claveSin) ?? []), f]);

console.log(`\n  ${carpetas.length} carpetas en Drive · ${estan.length} ya en MaKo · ${faltan.length} sin cargar · ${chicas.length} con menos de ${MIN_VIDEOS} video(s)\n`);

if (grupos.size) {
  console.log('  ── sin cargar en MaKo ──');
  const orden = [...grupos.values()].sort((a, b) => b[0].n - a[0].n);
  let totalV = 0, totalGb = 0;
  for (const g of orden) {
    for (const f of g) {
      console.log(`     ${String(f.n).padStart(4)} videos · ${String(Math.round(f.mb / 1000)).padStart(3)} GB   ${f.nombre}`);
      if (f.mejor) console.log(`                                    lo mas parecido que hay: «${f.mejor.titulo}» (${f.score.toFixed(2)})`);
      totalV += f.n; totalGb += f.mb / 1000;
    }
    if (g.length > 1) console.log(`        ↑ ${g.length} carpetas del MISMO curso (mirar cuál está completa antes de cargar)`);
  }
  console.log(`\n     ${grupos.size} curso(s) distintos · ${totalV} videos · ${Math.round(totalGb)} GB`);
}
if (dudosos.length) {
  // ⚠️ NO SE DECIDE SOLO. Un parecido a medias es justo donde el cruce se equivoca, y
  //    equivocarse acá cuesta o un curso duplicado o dias de descarga al pedo.
  console.log('\n  ── PARECIDOS a algo que ya está: mirar antes de cargar ──');
  for (const d of dudosos) {
    console.log(`     ${String(d.n).padStart(4)} videos   ${d.nombre}`);
    console.log(`                   ¿es «${d.mejor.titulo}»?  (parecido ${d.score.toFixed(2)})`);
  }
}
if (chicas.length) {
  console.log(`\n  ── con menos de ${MIN_VIDEOS} video(s): probablemente no son cursos ──`);
  for (const c of chicas) console.log(`     ${String(c.n).padStart(4)} videos   ${c.nombre}`);
}
console.log('');
