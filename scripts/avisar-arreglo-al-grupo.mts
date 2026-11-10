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
//   2. que hola-mako.com SIRVA un despliegue de un commit de main que lo CONTIENE (24/10/2026: antes bastaba con que
//      hubiera uno «Ready»). Se pregunta qué despliegue sirve el dominio (`vercel inspect hola-mako.com`) y de qué commit es
//      (`vercel ls --environment production --meta githubCommitSha=<sha ENTERO>`), entre los commits de main que
//      contienen el arreglo (hasta 20, sin `--first-parent`): «pushear no es desplegar» — un build fallado o una vuelta
//      atrás dejan producción con el código viejo, sin avisar.
//   Sin las dos, no sale nada: «no pude verificar» no es «está en producción».
//   ⚠️ El sha va ENTERO: con el corto, Vercel contesta «No deployments found» para un despliegue vivo (lib/vercel-salida.ts).
// =============================================================================
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { esShaEntero, filaDeProduccion, urlQueSirve } from '../lib/vercel-salida';

const arg = (n: string): string | null => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] ?? null : null; };
const flag = (n: string): boolean => process.argv.includes(n);
const REPO = process.cwd();
const ENV = arg('--env') ?? 'C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/.env.local';
const SCOPE = 'mbustos-4239s-projects';
const DOMINIO = 'hola-mako.com';
const VERSION_VERCEL = '65.3.1';

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

/** Una llamada al CLI de Vercel, con stdout y stderr juntos. */
function vercel(...a: string[]): string {
  // ⚠️ LA TABLA SALE POR STDERR. El CLI de Vercel imprime por stdout sólo las URLs sueltas y la tabla (con «Ready» y
  // «Production») por stderr: leyendo stdout, el primer aviso real (18/10/2026) contestó «ningún despliegue Ready
  // contiene el arreglo» con el despliegue de producción en Ready. Se leen las dos.
  // ⚠️ LA VERSIÓN VA FIJA. Con `vercel` a secas, npx busca la ÚLTIMA publicada: el 27/10/2026 salió la 65.4.0, que no
  // estaba en la caché, `--no-install` la rechazó sin decir nada por stdout, y el aviso Meta → Zernio dio «no pude saber
  // qué despliegue sirve» en 4 de 5 negocios con el despliegue sano.
  const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['--yes', `vercel@${VERSION_VERCEL}`, ...a, '--scope', SCOPE],
    { cwd: REPO, encoding: 'utf8', timeout: 90_000, shell: process.platform === 'win32' });
  const salida = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
  return salida;
}

/** La prueba de producción, o null con el motivo impreso. */
function pruebaDeProduccion(): string | null {
  git('fetch', '-q', 'origin', 'main');
  if (!contiene(commit, 'origin/main')) {
    console.error(`NO: ${commit} todavía no está en origin/main.`);
    return null;
  }
  // El que SIRVE el dominio, no el último «Ready»: una vuelta atrás en Vercel deja servido uno más viejo.
  // `inspect` no acepta `--yes` (lo rechaza y no da nada); `ls` sí lo necesita para no preguntar.
  const sirve = urlQueSirve(vercel('inspect', DOMINIO));
  if (!sirve) {
    console.error(`NO: no pude saber qué despliegue sirve ${DOMINIO} (vercel inspect no dio su url).`);
    return null;
  }
  // Los candidatos son los commits de main que CONTIENEN el arreglo (`--ancestry-path`), de los más nuevos a los más viejos,
  // y el arreglo mismo. ⚠️ NO `--first-parent` (10/11/2026): una punta que se trae origin/main con un merge y después main
  // avanza hasta ella deja el commit DESPLEGADO como segundo padre. Producción servía 082a832c4 (con el arreglo, en main), y la
  // primera línea de padres de main lo salteaba, así que el aviso de Leandro dio «no es de ningún commit de main».
  const candidatos = [
    ...git('rev-list', '--ancestry-path', '-n', '20', `${commit}..origin/main`).split('\n').filter(Boolean),
    git('rev-parse', `${commit}^{commit}`),
  ];
  for (const sha of candidatos) {
    if (!esShaEntero(sha)) { console.error(`NO: ${sha} no es un sha entero (Vercel no lo encontraría).`); return null; }
    const fila = filaDeProduccion(vercel('ls', '--environment', 'production', '--yes', '--meta', `githubCommitSha=${sha}`));
    if (fila && fila.url === sirve) {
      if (!fila.lista) { console.error(`NO: ${DOMINIO} sirve ${sirve} pero Vercel no lo da por Ready.`); return null; }
      return `${DOMINIO} sirve ${sirve} (Ready), de main ${sha.slice(0, 9)}, que contiene ${commit.slice(0, 9)}`;
    }
  }
  // El que sirve no es de ningún commit con el arreglo: es uno anterior (no se desplegó, falló el build o hubo una vuelta atrás).
  console.error(`NO: ${DOMINIO} sirve ${sirve}, que no es de ninguno de los ${candidatos.length} commits más nuevos de main con ${commit.slice(0, 9)} (todavía no se desplegó, o falló el build).`);
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
