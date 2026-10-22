// =============================================================================
// verificar-binarios — ¿está en el bucket la versión del programa que pide el instalador? (IA2, 22/10/2026). SÓLO LEE.
// =============================================================================
// Uso, desde la raíz de un worktree (el código que se va a subir):
//   npx tsx --conditions=react-server scripts/ia-pc/verificar-binarios.mts --env <.env.local> [--version 0.9.9]
//
// Integración lo corre ANTES de subir un cambio de lib/ia-pc-reglas.ts (VERSION_PC): la 0.3.2 se desplegó sin sus
// ejecutables y el instalador le contestó «No pude preparar la descarga» a todo cliente nuevo, con un 200. Lista el
// bucket privado `ia-pc` y FIRMA cada archivo de la versión (lo mismo que hace el instalador). Sale con 0 si la versión
// está completa y con 1 si falta algo, diciendo qué. No escribe nada.
// =============================================================================
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const imp = (rel: string) => import(pathToFileURL(path.join(REPO, rel)).href);
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const ENV = arg('--env') ?? path.join(process.cwd(), '.env.local');
if (!existsSync(ENV)) {
  console.error(`⛔ no está ${ENV}: un worktree no trae .env.local. Pásale el del clon con --env <ruta>.`);
  process.exit(1);
}
const dotenv = await import(pathToFileURL(path.join(REPO, 'node_modules', 'dotenv', 'lib', 'main.js')).href);
(dotenv.default ?? dotenv).config({ path: ENV, quiet: true });

const { VERSION_PC, faltanEnElBucket, informeDeBinarios } = await imp('lib/ia-pc-reglas.ts');
const version: string = arg('--version') ?? VERSION_PC;

/** Sin `process.exit()` después de los pedidos: en Windows Node revienta así (hallazgos-ia, «async.c line 94»). */
async function verificar(): Promise<number> {
  const { getSupabaseServer } = await imp('lib/supabase.ts');
  const storage = getSupabaseServer().storage.from('ia-pc');
  const { data, error } = await storage.list('', { limit: 1000 });
  if (error) { console.error(`⛔ no pude leer el bucket: ${error.message}`); return 1; }
  const nombres = (data ?? []).map((f: { name: string }) => f.name);
  const { faltan } = faltanEnElBucket(nombres, version);
  // Que esté listado no alcanza: se firma, como el instalador.
  const noFirman: string[] = [];
  for (const n of faltanEnElBucket([], version).faltan.filter((x: string) => !faltan.includes(x))) {
    const { data: f, error: e } = await storage.createSignedUrl(n, 60);
    if (e || !f?.signedUrl) noFirman.push(n);
  }
  const r = informeDeBinarios(nombres, version, noFirman);
  console.log(r.texto);
  return r.completa ? 0 : 1;
}
process.exitCode = await verificar();
setTimeout(() => process.exit(), 10_000).unref();
