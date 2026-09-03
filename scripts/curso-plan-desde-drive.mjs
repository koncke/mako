// Arma el plan de un curso que YA ESTA EN DRIVE y nunca paso por cursoselite.
//
//   node scripts/curso-plan-desde-drive.mjs --carpeta "ADS - Felipe Vergara"
//   node scripts/curso-plan-desde-drive.mjs --carpeta "..." --autor "Felipe Vergara" --slug ads-felipe
//
// Por que existe: todo el pipeline arranca en `curso-plan.mjs` / `curso-plan-vip.mjs`, que
// leen la plataforma de origen. Hay 13 cursos en Drive que nunca estuvieron ahi —los
// compro o los armo Martin por otro lado— y para esos no habia ningun camino: el material
// esta, y el portal no los podia mostrar.
//
// Lo que cambia respecto de un curso normal: NO HAY NADA QUE BAJAR. El video ya vive en
// Drive y el portal lo reproduce desde ahi (DRIVE_PREVIEW), asi que este plan nace con el
// `videoId` de Drive puesto y el bajador no tiene trabajo. Lo que si hay que hacer es
// sacarle el audio (`curso-audio-desde-drive.mjs`) para poder transcribirlo.
//
// ⚠️ EL ID DE DRIVE SE RESUELVE CON EL MODULO COMPARTIDO, acotando por la carpeta del
//    curso. Buscar por nombre en TODO el Drive ya publico, en tres cursos, un recurso que
//    abria el PDF de otro: hay cinco `recurso-01.pdf` distintos. El scope es lo que hace
//    que la respuesta sea unica.
import { readdirSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { idsDeDrive } from './curso-drive-ids.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const CARPETA = arg('carpeta', '');
const RAIZ = arg('drive', 'G:\\My Drive\\MARKETING KONCEPT\\CURSOS');
const DESTINO = arg('raiz', 'C:\\cursos');
const AUTOR_ARG = arg('autor', '');
const SLUG_ARG = arg('slug', '');

if (!CARPETA) { console.error('\n  ✖ Falta --carpeta "<nombre de la carpeta en Drive>"\n'); process.exit(1); }
const dir = join(RAIZ, CARPETA);
if (!existsSync(dir)) { console.error(`\n  ✖ No existe ${dir}\n`); process.exit(1); }

const slugDe = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 80);

// La convencion de Drive es «<Curso> - <Autor>». Si no la respeta, el autor queda vacio y
// se avisa: sin el, la carpeta y el titulo desentonan con los otros 120.
const corte = CARPETA.lastIndexOf(' - ');
const CURSO = corte > 0 ? CARPETA.slice(0, corte).trim() : CARPETA.trim();
const AUTOR = AUTOR_ARG || (corte > 0 ? CARPETA.slice(corte + 3).trim() : '');
const SLUG = SLUG_ARG || slugDe(CURSO);

/**
 * Recorre la carpeta y devuelve los videos EN ORDEN, con su modulo.
 *
 * ⚠️ EL ORDEN ES EL QUE VE EL LECTOR, asi que se ordena como ordena una persona: por el
 *    numero que abre el nombre, no alfabeticamente. Sin esto «10 - …» va antes que «2 - …»
 *    y el curso queda con el temario barajado, que no da error y se nota recien al abrirlo.
 */
const NUM = /^\s*(\d{1,3})\b/;
const porNumero = (a, b) => {
  const na = NUM.exec(a)?.[1], nb = NUM.exec(b)?.[1];
  if (na && nb && Number(na) !== Number(nb)) return Number(na) - Number(nb);
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
};

const ES_VIDEO = /\.(mp4|mkv|webm|mov|m4v)$/i;
const recorrer = (base, rel = '', prof = 0, out = []) => {
  if (prof > 3) return out;
  let e = [];
  try { e = readdirSync(base, { withFileTypes: true }); } catch { return out; }
  const carpetas = e.filter((x) => x.isDirectory()).map((x) => x.name).sort(porNumero);
  const archivos = e.filter((x) => !x.isDirectory() && ES_VIDEO.test(x.name)).map((x) => x.name).sort(porNumero);
  // Los sueltos de este nivel primero, despues cada subcarpeta: es como se lee un temario.
  for (const f of archivos) out.push({ rel, archivo: f });
  for (const c of carpetas) recorrer(join(base, c), rel ? `${rel}/${c}` : c, prof + 1, out);
  return out;
};

const crudos = recorrer(dir);
if (!crudos.length) { console.error(`\n  ✖ No hay videos en ${dir}\n`); process.exit(1); }

// ⚠️ NO SE INVENTA DURACION. El resto del pipeline usa `duracion` vacia como senal de «el
//    origen no lo sabe» —y resulto ser el mejor predictor de que una clase no se va a poder
//    bajar—. Aca el origen es el archivo, asi que se deja vacia: medirla con ffprobe sobre
//    el montaje de Drive son 600 lecturas de red por curso, y nadie la necesita todavia.
/**
 * ⚠️ UN NOMBRE DE ARCHIVO NO ES UN TITULO: trae BASURA DEL NOMBRE DE ARCHIVO.
 *
 * Lo que en Drive se llama «Hotmart Club - 4. Configurando mi Facebook y Fanpage -
 * 1920x1080 934K.mp4» en el portal tiene que decir «4. Configurando mi Facebook y
 * Fanpage». El prefijo de la plataforma de origen, la resolucion y el bitrate son datos
 * del ARCHIVO, no de la leccion, y en pantalla se leen como si el curso estuviera mal
 * armado.
 *
 * Medido el 03/09/2026 en «Metodologia JADS»: 97 de 109 clases con el prefijo de la
 * plataforma y 71 con la resolucion pegada al final.
 *
 * ⚠️ NO se toca la numeracion de adelante: ordena, y sacarla deja al lector sin saber
 *    cual va primero.
 */
const limpio = (s) => String(s)
  .replace(/\.[^.]+$/, '')                                  // la extension
  .replace(/^(hotmart club|kajabi|teachable|thinkific)\s*[-–—:]\s*/i, '')  // el prefijo del origen
  // ⚠️ LA RESOLUCION Y EL BITRATE VAN JUNTOS Y AL FINAL: «… - 1920x1080 934K». Sacar
  //    cualquier «NNNK» suelto convertia «37. Chichito llego a 100K y todo» en «llego a y
  //    todo»: ese 100K son cien mil seguidores, o sea el TEMA de la clase. Un limpiador
  //    que borra contenido es peor que no limpiar — el titulo feo se ve feo, el mutilado
  //    se lee como si el curso estuviera mal armado.
  .replace(/\s*[-–—]?\s*\d{3,4}x\d{3,4}(\s+\d{2,5}\s?K)?\s*$/gi, '')
  .replace(/\s*\((?:\d{3,4}p|hd|full ?hd)\)\s*$/gi, '')
  .replace(/\s*[-–—]\s*$/, '')                               // el guion que queda colgando
  .replace(/\s+/g, ' ').trim();
const clases = crudos.map((x, i) => ({
  n: i + 1,
  titulo: limpio(x.archivo),
  duracion: '',
  modulo: x.rel ? x.rel.split('/').pop() : '',
  plataforma: 'drive',
  videoId: null,          // lo llena la resolucion de abajo
  url: '',
  archivo: `${String(i + 1).padStart(3, '0')} - ${limpio(x.archivo)}`.slice(0, 110),
  sinFuente: false,
  rel: x.rel,
  archivoDrive: x.archivo,
}));

console.log(`\n  Curso  : ${CURSO}${AUTOR ? ` — ${AUTOR}` : ''}`);
console.log(`  Carpeta: ${dir}`);
console.log(`  Clases : ${clases.length} · módulos: ${new Set(clases.map((c) => c.modulo).filter(Boolean)).size}`);
if (!AUTOR) console.log(`  ⚠ sin autor: la carpeta no sigue «<Curso> - <Autor>». Pasá --autor si corresponde.`);

// ── Los ids de Drive ────────────────────────────────────────────────────────────────
console.log(`\n  Resolviendo ids de Drive (acotado a la carpeta del curso)…`);
const r = idsDeDrive(clases.map((c) => c.archivoDrive), CARPETA);
if (r.error) { console.error(`\n  ✖ ${r.error}\n`); process.exit(1); }

let conId = 0;
for (const c of clases) {
  const hit = r.ids.get(c.archivoDrive);
  const id = typeof hit === 'string' ? hit : hit?.id;
  if (id) { c.videoId = id; c.url = `https://drive.google.com/file/d/${id}/preview`; conId++; }
}
console.log(`  ${conId} de ${clases.length} con id de Drive`);

/**
 * ⚠️ SI FALTA UN ID, SE FRENA. Una clase sin id no se puede reproducir ni transcribir: el
 *    curso saldria publicado con huecos que en la pantalla se ven como clases que no
 *    arrancan. Es preferible no publicarlo y decir cuáles faltan — Drive puede estar a
 *    mitad de sincronizar, y en ese caso alcanza con reintentar en un rato.
 */
if (conId < clases.length) {
  const faltan = clases.filter((c) => !c.videoId);
  console.error(`\n  ✖ ${faltan.length} clase(s) sin id de Drive. NO escribo el plan.`);
  for (const c of faltan.slice(0, 8)) console.error(`      ${c.archivoDrive}`);
  if (faltan.length > 8) console.error(`      … y ${faltan.length - 8} más`);
  console.error(`\n    Si Drive está sincronizando, reintentá en unos minutos.\n`);
  process.exit(1);
}

// ── Escribir ────────────────────────────────────────────────────────────────────────
const base = join(DESTINO, SLUG);
mkdirSync(base, { recursive: true });

const plan = {
  curso: CURSO,
  autor: AUTOR,
  slug: SLUG,
  pagina: '',
  origen: 'drive',        // deja escrito que este curso NO vino de una plataforma
  carpetaDrive: CARPETA,
  referer: '',
  clases: clases.map(({ rel, archivoDrive, ...c }) => c),
  pdfs: [],
};
writeFileSync(join(base, 'plan.json'), JSON.stringify(plan, null, 2), 'utf8');

// `drive.json` con la MISMA forma que deja `curso-drive-fusionar.mjs`, que es la que leen
// `curso-audio-desde-drive.mjs` (rel + archivo, para encontrar el video en el montaje) y
// el portal (videoId).
writeFileSync(join(base, 'drive.json'), JSON.stringify({
  curso: CURSO,
  carpeta: dir,
  clases: clases.map((c) => ({ n: c.n, titulo: c.titulo, videoId: c.videoId, rel: c.rel, archivo: c.archivoDrive })),
  recursos: [],
}, null, 2), 'utf8');

/**
 * Y el registro del bajador, con TODAS las clases marcadas.
 *
 * ⚠️ Acá marcar es correcto y en el caso normal no lo sería: la regla es que sólo se marca
 *    lo que tiene id de Drive, y acá las 100% lo tienen porque el video ES el de Drive. Sin
 *    esto, `curso-bajar.mjs` intentaría bajar de una `url` de Drive que no es descargable y
 *    fallaría clase por clase.
 */
writeFileSync(join(base, 'bajados.txt'), clases.map((c) => `drive ${c.videoId}`).join('\n') + '\n', 'utf8');

console.log(`\n  → ${join(base, 'plan.json')}`);
console.log(`  → ${join(base, 'drive.json')}`);
console.log(`  → ${join(base, 'bajados.txt')}  (todas marcadas: no hay nada que bajar)`);
console.log(`\n  Siguiente:`);
console.log(`    node scripts/curso-audio-desde-drive.mjs --plan ${join(base, 'plan.json')}`);
console.log(`    node scripts/curso-pipeline.mjs --plan ${join(base, 'plan.json')} --tope-horas 6\n`);
