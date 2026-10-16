// =============================================================================
// claude-propio-de-un-negocio — una clave del crédito de Claude Max, como la key PROPIA de un negocio
// =============================================================================
// Uso (desde la raíz del CLON, donde está el .env.local; ESCRIBE en la base de .env.local, que es
// PRODUCCIÓN):
//   npx tsx --conditions=react-server scripts/claude-propio-de-un-negocio.mts --ws 10 --desde ANTHROPIC_CREDITO_CUENTA2
//
// Para qué: Martín, 16/10/2026: «es importante que implementemos que cada usuario traiga sus cuentas de GPT o
// Claude... Vinculalo para el caso de Leandro también, que tenga la suya». Leandro es el ws10 y su Claude es la
// cuenta 2. Esto la deja como la ANTHROPIC_API_KEY del negocio: la MISMA credencial que carga un cliente en
// /integraciones (BYOK), guardada con el MISMO setter (`guardarCredencial`). Desde ahí la usan la segunda puerta
// del veto (la clave del negocio, en sus funciones de texto) y el análisis de llamadas de cierre.
//
// Las guardas, y por qué cada una:
//   · `--desde` sólo puede ser una de las claves del crédito (`CLAVES_CREDITO_PLATAFORMA`): copiarle a un cliente
//     la ANTHROPIC_API_KEY de la plataforma sería darle el gasto de MaKo por la puerta del negocio.
//   · `--ws` va explícito y no puede ser el workspace de la plataforma ni el del dueño (`OWNER_WS`): ahí esa
//     credencial ya significa otra cosa.
//   · Si el negocio ya tiene una ANTHROPIC_API_KEY DISTINTA, no la pisa: cambiar la clave de un cliente es una
//     decisión aparte. Si es la misma, no toca nada.
//   · Nunca imprime la clave: sólo el largo y los últimos 4. Y RELEE con `credWsEstricta` y compara.
// =============================================================================
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = process.cwd();
const imp = (rel: string) => import(pathToFileURL(path.join(REPO, rel)).href);
const dotenv = await import(pathToFileURL(path.join(REPO, 'node_modules', 'dotenv', 'lib', 'main.js')).href);
(dotenv.default ?? dotenv).config({ path: path.join(REPO, '.env.local'), quiet: true });

const { credWsEstricta, guardarCredencial } = await imp('lib/credenciales.ts');
const { wsSuperAdmin, OWNER_WS } = await imp('lib/workspace.ts');
const { CLAVES_CREDITO_PLATAFORMA } = await imp('lib/veto-claude.ts');

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const ws = Number(arg('--ws'));
const desde = String(arg('--desde') ?? '');
const huella = (v: string) => `${v.length} caracteres, termina en …${v.slice(-4)}`;
const CLAVE = 'ANTHROPIC_API_KEY';

if (!Number.isInteger(ws) || ws <= 0) { console.error('⛔ falta --ws <número del negocio>.'); process.exit(1); }
if (!(CLAVES_CREDITO_PLATAFORMA as readonly string[]).includes(desde)) {
  console.error(`⛔ --desde tiene que ser una de las claves del crédito (${(CLAVES_CREDITO_PLATAFORMA as readonly string[]).join(', ')}).`);
  process.exit(1);
}
const wsSA: number = await wsSuperAdmin();
if (ws === wsSA || ws === OWNER_WS) { console.error(`⛔ el ws ${ws} es el de la plataforma o el del dueño: ahí ${CLAVE} ya significa otra cosa.`); process.exit(1); }

const valor = (process.env[desde] ?? '').trim();
if (!valor.startsWith('sk-ant-')) { console.error(`⛔ ${desde} no está en .env.local (o no empieza con sk-ant-).`); process.exit(1); }

let ya: string | null = null;
try { ya = await credWsEstricta(CLAVE, ws); } catch (e) { console.error(`⛔ no pude leer la ${CLAVE} del ws ${ws}: ${e instanceof Error ? e.message : String(e)}`); process.exit(1); }
if (ya && ya.trim() === valor) { console.log(`✓ el ws ${ws} ya tenía esa ${CLAVE} (${huella(valor)}). No se toca.`); process.exit(0); }
if (ya) { console.error(`⛔ el ws ${ws} ya tiene OTRA ${CLAVE} (${huella(ya)}). No se pisa: cambiarla es una decisión aparte.`); process.exit(1); }

await guardarCredencial(ws, CLAVE, valor, 'anthropic', 'sistema:claude-propio');
const releido = await credWsEstricta(CLAVE, ws);
if (releido?.trim() === valor) { console.log(`✓ ${CLAVE} del ws ${ws} guardada (desde ${desde}) y releída igual (${huella(valor)}).`); process.exit(0); }
console.error(`⛔ la relectura no coincide${releido ? ` (${huella(releido)})` : ' (vacía)'}.`);
process.exit(1);
