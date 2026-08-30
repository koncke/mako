// =============================================================================
// curso-drive-comparar — ¿este curso YA está en Drive, y qué le falta?
// =============================================================================
// Se corre ANTES de bajar. Pedido de Martín (30/08/2026): «siempre revisá el Drive, porque
// estoy seguro de que hay algunos que ya están allí. Claro que comparalo, por si el de
// cursoselite tiene nuevas clases o módulos o directamente son diferentes».
//
// Tenía razón: de los 18 cursos que quedaban en la cola, DOS ya estaban en Drive a medias.
// «The Perfect Launch» tenía 196 de sus 237 clases subidas —bajarlo entero era rebajar el
// 83%— y «Growth Partner», 55 de 106.
//
//   node scripts/curso-drive-comparar.mjs --plan C:/cursos/<slug>/plan.json
//   node scripts/curso-drive-comparar.mjs --cola          # todo lo que queda en _cola.txt
//
// ⚠️ ESTE SCRIPT NO DECIDE NI BORRA NI BAJA NADA: informa. La razón es el costo del error.
//    Un match equivocado publica un curso con los videos de OTRO, y eso no da 404 ni
//    error: da un curso plausible y falso. Ya pasó con recursos que abrían el PDF de otro
//    curso. Así que ante la duda dice «ambiguo» y no elige.
//
// ⚠️ Y NO COMPARA CANTIDADES. «106 contra 86» invita a restar y llamar «faltan 20» a la
//    diferencia. Este repo pagó ese error dos veces: 183 archivos cubrían 283 filas porque
//    varias compartían título, y otro curso figuraba con «39 faltantes» estando bajados.
//    Dos números sirven para SOSPECHAR; lo que decide es el cruce por NOMBRE, en las dos
//    direcciones.
// =============================================================================
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DRIVE = 'G:/My Drive/MARKETING KONCEPT/CURSOS';
const CURSOS = 'C:/cursos';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const tiene = (n) => process.argv.includes(`--${n}`);

if (!existsSync(DRIVE)) {
  // ⚠️ Drive desmontado y «no hay nada parecido» se ven IGUAL desde acá, y la conclusión
  //    equivocada cuesta bajar un curso entero que ya estaba. Se dice y se sale distinto.
  console.error(`\n  ✖ No veo ${DRIVE}. ¿Está Drive for Desktop montado en G:?`);
  console.error('    NO es lo mismo que «no está en Drive»: sin el montaje no se puede saber.\n');
  process.exit(2);
}

// ── Normalizar, que acá es todo ────────────────────────────────────────────────────────
/**
 * ⚠️ CADA COSA QUE ESTA FUNCIÓN NO SACA SE CONVIERTE EN UN FALSO FALTANTE, y la cuenta
 *    resultante parece un dato. Al construirla, los números fueron: 170 faltantes → 56 al
 *    sacar «Copia de » → 41 al sacarlo cuando viene DOBLE («Copia de Copia de»). Tres
 *    mediciones, dos de ellas convincentes y equivocadas.
 */
const norm = (s) => (s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\.[a-z0-9]{2,4}$/i, '')          // la extensión
  .replace(/^(\s*copia de\s*)+/i, '')        // «Copia de Copia de …», que pone el origen
  .replace(/^\s*\d{1,3}\s*[-._)]\s*/, '')    // la numeración de adelante
  .replace(/\s*\(\d+\)\s*$/, '')             // el «(1)» que agrega el bajador al duplicar
  .replace(/\.f?hls[^.]*$/i, '')             // el sufijo de formato de yt-dlp
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const RUIDO = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'con', 'en', 'para', 'por',
  'un', 'una', 'al', 'su', 'tu', 'lo', 'que', 'como', 'curso', 'cursos', 'academia']);
/**
 * ⚠️ CON RAÍZ, o el singular y el plural son dos palabras distintas. «Academia de
 *    Lanzamiento» (cursoselite) contra «Academia de Lanzamientos - David Turu» (Drive) son
 *    el mismo curso —52 de sus 104 clases ya estaban subidas— y sin esto no cruzaban por
 *    UNA LETRA. El match anterior lo salvaba por accidente, porque metía el autor en la
 *    bolsa; al sacar el autor (que traía falsos positivos peores) apareció el agujero.
 */
const raiz = (w) => w.replace(/(es|s)$/, '');
const pal = (s) => norm(s).split(' ').filter((w) => w.length > 2 && !RUIDO.has(w)).map(raiz);

const carpetas = readdirSync(DRIVE, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

/** Los videos de una carpeta de Drive, recursivo: van repartidos por módulo. */
const videosDe = (carpeta) => {
  const out = [];
  const ver = (d, mod) => {
    let e = [];
    try { e = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const x of e) {
      const p = join(d, x.name);
      if (x.isDirectory()) ver(p, x.name);
      else if (/\.(mp4|mkv|webm|mov|m4v)$/i.test(x.name)) {
        let bytes = 0; try { bytes = statSync(p).size; } catch {}
        out.push({ mod, nombre: x.name, k: norm(x.name), bytes });
      }
    }
  };
  ver(join(DRIVE, carpeta), '(raíz)');
  return out;
};

/**
 * Candidatas en Drive para un curso. Devuelve TODAS las que pasan el piso, ordenadas.
 *
 * ⚠️ EL AUTOR CONFIRMA, NUNCA DECIDE. La primera versión metía el nombre del autor en la
 *    misma bolsa que el del curso, y con eso «ACADEMIA ESTRATEGA - Juan ADS» matcheó
 *    «M5 -95 - Juan ADS» con puntaje 1: son dos cursos DISTINTOS del mismo autor, y lo
 *    único en común era su nombre. Publicar eso habría puesto los videos de un curso en
 *    otro, sin ningún error de por medio.
 *
 *    Ahora tiene que solaparse el NOMBRE DEL CURSO. El autor solo suma para desempatar
 *    entre dos candidatas que ya se parecen por el curso.
 */
const candidatas = (slug, nombreCurso, autor) => {
  const mias = new Set([...pal(slug), ...pal(nombreCurso)]);
  const mioAutor = new Set(pal(autor));
  if (!mias.size) return [];
  const out = [];
  for (const d of carpetas) {
    // La carpeta es «<Curso> - <Autor>»: se parte para no mezclar las dos cosas.
    const corte = d.lastIndexOf(' - ');
    const suCurso = new Set(pal(corte > 0 ? d.slice(0, corte) : d));
    const suAutor = new Set(pal(corte > 0 ? d.slice(corte + 3) : ''));
    if (!suCurso.size) continue;
    let comun = 0;
    for (const w of mias) if (suCurso.has(w)) comun++;
    if (!comun) continue;
    const score = comun / Math.min(mias.size, suCurso.size);
    if (score < 0.6) continue;
    let mismoAutor = 0;
    for (const w of mioAutor) if (suAutor.has(w)) mismoAutor++;
    out.push({ carpeta: d, score: +score.toFixed(2), autorOk: mismoAutor >= 1 });
  }
  return out.sort((a, b) => (b.autorOk - a.autorOk) || (b.score - a.score));
};

const comparar = (planPath) => {
  const plan = JSON.parse(readFileSync(planPath, 'utf8').replace(/^\uFEFF/, ''));
  const slug = planPath.split(/[\\/]/).slice(-2)[0];
  const clases = plan.clases ?? plan.lecciones ?? [];
  const cand = candidatas(slug, plan.curso ?? '', plan.autor ?? '');

  console.log(`\n══ ${slug}`);
  console.log(`   cursoselite: ${clases.length} clases · «${plan.curso ?? '?'}${plan.autor ? ' - ' + plan.autor : ''}»`);

  if (!cand.length) { console.log('   Drive: nada parecido — hay que bajarlo entero.'); return { slug, estado: 'nuevo' }; }
  if (cand.length > 1 && cand[0].score - cand[1].score < 0.2) {
    console.log(`   ⚠️ AMBIGUO: ${cand.length} carpetas parecidas y ninguna despegada. NO elijo:`);
    for (const c of cand.slice(0, 4)) console.log(`      · (${c.score}) ${c.carpeta}`);
    console.log('      Mirá cuál es y pasala con --carpeta "<nombre>".');
    return { slug, estado: 'ambiguo' };
  }

  const elegida = arg('carpeta', cand[0].carpeta);
  const videos = videosDe(elegida);
  const idx = new Map();
  for (const v of videos) if (!idx.has(v.k)) idx.set(v.k, v);

  const enPlan = new Set(clases.map((c) => norm(c.titulo ?? c.title ?? c.nombre ?? '')));
  const faltan = clases.filter((c) => !idx.has(norm(c.titulo ?? c.title ?? c.nombre ?? '')));
  const soloDrive = videos.filter((v) => !enPlan.has(v.k));
  const gb = +(videos.reduce((a, v) => a + v.bytes, 0) / 1e9).toFixed(1);

  console.log(`   Drive: «${elegida}» (parecido ${cand[0].score}) → ${videos.length} videos · ${gb} GB`);
  console.log(`   ya están: ${clases.length - faltan.length}/${clases.length}   ·   faltan: ${faltan.length}   ·   en Drive y no en el plan: ${soloDrive.length}`);

  if (faltan.length) {
    const porMod = new Map();
    for (const f of faltan) { const m = f.modulo ?? f.grupo ?? '(sin módulo)'; porMod.set(m, (porMod.get(m) ?? 0) + 1); }
    console.log('   lo que falta, por módulo:');
    for (const [m, n] of [...porMod].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`      ${String(n).padStart(3)}  ${m}`);
  }
  // ⚠️ Que Drive tenga cosas que el plan no tiene NO es ruido: puede ser otra versión del
  //    curso, o directamente otro curso con nombre parecido. Se muestra siempre.
  if (soloDrive.length) {
    console.log(`   ⚠️ ${soloDrive.length} videos en Drive que el plan NO tiene. Si son muchos, mirá si es OTRA versión:`);
    for (const v of soloDrive.slice(0, 4)) console.log(`      · [${v.mod}] ${v.nombre.slice(0, 66)}`);
  }
  // ⚠️ CERO COINCIDENCIAS NO ES «A MEDIAS»: es la firma de que la carpeta es de OTRO
  //    curso. Llamarlo parcial invita a bajar «lo que falta», que es todo, contra una
  //    carpeta ajena — y a creer que el trabajo estaba medio hecho.
  if (clases.length && faltan.length === clases.length) {
    console.log('   ⛔ NINGUNA clase coincide por nombre: casi seguro es OTRO curso, no una copia a medias.');
    return { slug, estado: 'otro-curso', total: clases.length, faltan: faltan.length, carpeta: elegida };
  }
  return { slug, estado: faltan.length === 0 ? 'completo' : 'parcial', total: clases.length, faltan: faltan.length, carpeta: elegida };
};

// ── Qué comparar ──────────────────────────────────────────────────────────────────────
let planes = [];
if (tiene('cola')) {
  const lista = readFileSync(join(CURSOS, '_cola.txt'), 'utf8')
    .split('\n').map((l) => l.replace(/\r/g, '').trim()).filter((l) => l && !l.startsWith('#'));
  // Sólo lo que la cola todavía no abrió: lo anterior ya está bajado.
  let desde = 0;
  try {
    const log = readFileSync(join(CURSOS, 'cola.log'), 'utf8');
    const abiertos = [...log.matchAll(/^════ (\S+) · /gm)].map((m) => m[1]);
    const i = lista.indexOf(abiertos[abiertos.length - 1]);
    if (i >= 0) desde = i + 1;
  } catch { /* sin log: se comparan todos */ }
  planes = lista.slice(desde).map((c) => join(CURSOS, c, 'plan.json')).filter(existsSync);
} else {
  const p = arg('plan');
  if (!p || !existsSync(p)) { console.error('\n  ✖ Falta --plan <plan.json>  (o --cola)\n'); process.exit(1); }
  planes = [p];
}

const res = planes.map(comparar);
const parciales = res.filter((r) => r.estado === 'parcial');
const completos = res.filter((r) => r.estado === 'completo');
console.log(`\n  ${res.length} comparado(s): ${completos.length} ya completos en Drive · ${parciales.length} a medias · ${res.filter((r) => r.estado === 'nuevo').length} nuevos · ${res.filter((r) => r.estado === 'ambiguo').length} ambiguos · ${res.filter((r) => r.estado === 'otro-curso').length} que matchearon OTRO curso`);
if (parciales.length) {
  const ahorro = parciales.reduce((a, r) => a + (r.total - r.faltan), 0);
  console.log(`  ${ahorro} clases de los parciales YA están subidas: bajarlas de nuevo es trabajo repetido.\n`);
}
