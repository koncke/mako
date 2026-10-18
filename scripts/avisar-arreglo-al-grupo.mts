// =============================================================================
// avisar-arreglo-al-grupo — el aviso «ya quedó arreglado» de un jefe al grupo de MaKo de UN cliente
// =============================================================================
// Uso (desde un worktree, con el .env.local del clon, que es PRODUCCIÓN):
//   NODE_OPTIONS=--conditions=react-server npx tsx scripts/avisar-arreglo-al-grupo.mts --ws 13 --clave conv:12345 --commit 618c79c45 \
//       --texto "Ya quedó arreglado: …" --origen "MaKo en WhatsApp" [--ws1-seguro] [--enviar]
//
// SIN `--enviar` NO MANDA NADA: prueba la producción y muestra el texto que saldría. Así se mira antes de mandar.
//
// Qué prueba, antes de llamar a lib/aviso-arreglo.ts (que reserva, manda, registra y no repite):
//   1. que `--commit` esté en `origin/main` (`git merge-base --is-ancestor`, después de un fetch): main sólo avanza
//      con el run de GitHub Actions en verde;
//   2. que haya un despliegue de PRODUCCIÓN en «Ready» de un commit de main que lo CONTIENE. Se mira con el CLI de
//      Vercel por commit (`vercel ls --prod --meta githubCommitSha=<sha>`), de la punta de main hacia atrás (hasta 6):
//      «pushear no es desplegar» — un build fallado deja producción con el código viejo, sin avisar.
//   Sin las dos, no sale nada: «no pude verificar» no es «está en producción».
// =============================================================================
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const arg = (n: string): string | null => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] ?? null : null; };
const flag = (n: string): boolean => process.argv.includes(n);
const REPO = process.cwd();
const ENV = arg('--env') ?? 'C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/.env.local';
const SCOPE = 'mbustos-4239s-projects';

const ws = Number(arg('--ws'));
const clave = arg('--clave') ?? '';
const commit = (arg('--commit') ?? '').trim();
const texto = arg('--texto') ?? '';
const origen = arg('--origen') ?? '';
const enviar = flag('--enviar');
const ws1Seguro = flag('--ws1-seguro');
if (!ws || !clave || !commit || !texto || !origen) {
  console.error('Faltan datos: --ws, --clave, --commit, --texto y --origen son obligatorios.');
  process.exit(2);
}

const git = (...a: string[]) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' }).trim();
const contiene = (base: string, punta: string): boolean => {
  try { execFileSync('git', ['merge-base', '--is-ancestor', base, punta], { cwd: REPO }); return true; } catch { return false; }
};

/** La prueba de producción, o null con el motivo impreso. */
function pruebaDeProduccion(): string | null {
  git('fetch', '-q', 'origin', 'main');
  if (!contiene(commit, 'origin/main')) {
    console.error(`NO: ${commit} todavía no está en origin/main.`);
    return null;
  }
  const candidatos = git('rev-list', '--first-parent', '-n', '6', 'origin/main').split('\n').filter(Boolean);
  for (const sha of candidatos) {
    if (!contiene(commit, sha)) break; // de acá para atrás ya no lo contiene
    // ⚠️ LA TABLA SALE POR STDERR. El CLI de Vercel imprime por stdout sólo las URLs sueltas y la tabla (con «Ready» y
    // «Production») por stderr: leyendo stdout, el primer aviso real (18/10/2026) contestó «ningún despliegue Ready
    // contiene el arreglo» con el despliegue de producción en Ready. Se leen las dos.
    const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['--no-install', 'vercel', 'ls', '--prod', '--yes', '--scope', SCOPE, '--meta', `githubCommitSha=${sha}`],
      { cwd: REPO, encoding: 'utf8', timeout: 90_000, shell: process.platform === 'win32' });
    const salida = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
    const fila = salida.split('\n').find((l) => /https:\/\/\S+\.vercel\.app/.test(l) && /Production/.test(l));
    if (fila && /●\s*Ready/.test(fila)) {
      const url = /https:\/\/\S+\.vercel\.app/.exec(fila)?.[0] ?? '?';
      return `deploy ${url} Ready en producción, main ${sha.slice(0, 9)} contiene ${commit.slice(0, 9)}`;
    }
    if (fila) console.error(`  ${sha.slice(0, 9)}: su despliegue no está Ready (${fila.replace(/\s+/g, ' ').trim().slice(0, 120)})`);
  }
  console.error(`NO: ningún despliegue de producción Ready contiene ${commit} (se miraron los últimos ${candidatos.length} de main).`);
  return null;
}

const imp = (rel: string) => import(pathToFileURL(path.join(REPO, rel)).href);
const dotenv = await imp('node_modules/dotenv/lib/main.js');
(dotenv.default ?? dotenv).config({ path: ENV, quiet: true });
const { vistaPrevia, avisarArregloAlGrupo } = await imp('lib/aviso-arreglo.ts');

const vista = vistaPrevia(texto) as { ok: true; texto: string } | { ok: false; error: string };
if (!vista.ok) { console.error(`NO: ${vista.error}`); process.exit(2); }
const prueba = pruebaDeProduccion();
if (!prueba) process.exit(2);
console.log(`Prueba: ${prueba}\n\nSaldría al grupo de MaKo del ws${ws}:\n${vista.texto}\n`);
if (!enviar) { console.log('(sin --enviar: no se mandó nada)'); process.exit(0); }

const r = await avisarArregloAlGrupo({ ws, clave, texto, prueba, origen, ws1Seguro });
if (r.ok) console.log(`Salió (${r.id}).`);
else { console.error(`NO salió (${r.motivo}): ${r.detalle}`); process.exit(1); }
