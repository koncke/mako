// Rehace la portada de uno o varios cursos con el molde de `curso-portada-disenar.py`.
//
//   node --import tsx scripts/curso-portada-rehacer.mjs --elecciones C:/cursos/_elecciones.json
//   node --import tsx scripts/curso-portada-rehacer.mjs --slug metolodogia-jads --frame 7
//   node --import tsx scripts/curso-portada-rehacer.mjs --slug higher-levels-ae-mastery   (sin foto)
//
// El archivo de `--elecciones` es `{ "<slug>": <n° de candidata> | null }`, o sea lo que
// devuelve la corrida que MIRA las hojas de contacto de `curso-portada-candidatas.mjs`.
//
// ── Por qué el título y el autor salen del CATÁLOGO y no del plan ────────────────────────
// `plan.json` trae el título tal como vino de la carpeta de Drive, y ahí es donde estaban
// los cuatro autores mal partidos (en-dash, un año de cola, un producto leído como persona).
// El catálogo ya resuelve eso: `tituloCorto` es el título sin el autor pegado y `titulo` los
// trae a los dos, así que el autor es la diferencia. Leer el plan sería volver a la fuente
// que se acaba de corregir — y publicaría la portada con el nombre equivocado mientras la
// ficha muestra el bueno.
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const ELECCIONES = arg('elecciones', '');
const SLUG = arg('slug', '');
const FRAME = arg('frame', '');
const CAND = arg('candidatas', 'C:\\cursos\\_candidatas');

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const { CURSOS_TODOS } = await import(pathToFileURL(join(REPO, 'app/conocimientos/catalogo.ts')).href);

let plan = {};
if (ELECCIONES) {
  if (!existsSync(ELECCIONES)) { console.error(`\n  ✖ No existe ${ELECCIONES}\n`); process.exit(1); }
  plan = JSON.parse(readFileSync(ELECCIONES, 'utf8'));
} else if (SLUG) {
  plan = { [SLUG]: FRAME ? Number(FRAME) : null };
} else {
  console.error('\n  ✖ Pasá --elecciones <json> o --slug <slug> [--frame N]\n'); process.exit(1);
}

let hechas = 0, conFoto = 0, fallidas = 0;
for (const [slug, frame] of Object.entries(plan)) {
  const c = CURSOS_TODOS.find((x) => x.slug === slug);
  if (!c) { console.log(`  ✖ ${slug}: no está en el catálogo`); fallidas++; continue; }

  const corto = c.tituloCorto ?? c.titulo;
  // El autor es lo que le sobra al título completo después del título corto. Si no encaja,
  // se deja vacío: es mejor una portada sin firma que una firmada con un pedazo de título.
  const autor = c.titulo.startsWith(corto)
    ? c.titulo.slice(corto.length).replace(/^\s*[-–—]\s*/, '').trim()
    : '';

  /**
   * ⚠️ La foto se comprueba en DISCO antes de pasarla. El diseñador trata «--foto que no
   *    existe» como «sin foto» y dibuja la variante tipográfica sin decir nada — o sea que
   *    un número de candidata equivocado no da error, da una portada distinta de la que se
   *    eligió mirando. Acá se convierte en un fallo ruidoso.
   */
  let foto = '';
  if (frame != null && frame !== '') {
    const nn = String(frame).padStart(2, '0');
    const ruta = join(CAND, slug, `${nn}.jpg`);
    if (!existsSync(ruta)) {
      console.log(`  ✖ ${slug}: se eligió la candidata ${frame} y no existe ${ruta}`);
      fallidas++; continue;
    }
    foto = ruta;
  }

  const args = ['scripts/curso-portada-disenar.py', '--slug', slug, '--titulo', corto,
    '--autor', autor, '--cejilla', c.categoria ?? ''];
  if (foto) args.push('--foto', foto);

  const r = spawnSync('python', args, {
    encoding: 'utf8', cwd: REPO,
    // ⚠️ La consola de Windows es cp1252 y un `print` con un carácter no-ASCII mata al
    //    script DESPUÉS de haber escrito el .jpg: sale con código 1 y se lee como que no
    //    hizo nada. Se fuerza utf-8 en el hijo.
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  if (r.status !== 0) {
    console.log(`  ✖ ${slug}: ${String(r.stderr ?? '').trim().split('\n').slice(-3).join(' | ').slice(0, 160)}`);
    fallidas++; continue;
  }
  hechas++; if (foto) conFoto++;
  console.log(`  ✓ ${slug.padEnd(44)} ${foto ? `foto #${frame}` : 'tipográfica'}`);
}

console.log(`\n  ${hechas} portada(s): ${conFoto} con foto del autor · ${hechas - conFoto} tipográficas${fallidas ? ` · ${fallidas} FALLARON` : ''}\n`);
process.exit(fallidas ? 1 : 0);
