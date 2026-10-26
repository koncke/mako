// =============================================================================
// reembeber-conocimiento — embeber el conocimiento con la IA de cada negocio, de una vez (IA16, 22/10/2026; 25/10/2026)
// =============================================================================
// Uso, desde la raíz de este repo:
//   npx tsx --conditions=react-server scripts/reembeber-conocimiento.mts --env <.env.local>             ← en seco
//   npx tsx --conditions=react-server scripts/reembeber-conocimiento.mts --env <.env.local> --aplicar   ← escribe
//
// ⚠️ ESCRIBE EN LA BASE de .env.local (PRODUCCIÓN) sólo con --aplicar: el `embedding` de cada fila de `mako_knowledge`.
// ⚠️ CADA NEGOCIO CON SU IA (lib/embeddings.ts, 25/10/2026): su OpenAI primero, su Gemini si es lo único. Las filas de un
//    workspace sin ninguna NO se tocan: se buscan por palabras y se embeben solas cuando la conecte (/integraciones) o de a
//    poco desde la búsqueda (el goteo, lib/mako-knowledge.ts). Las del ws9 y el MÉTODO DE MAKO (`fuente` que se presta, que
//    vive en el ws1) van con la de la plataforma (Gemini): es contenido de MaKo.
//    No hace falta correrlo: el goteo hace lo mismo solo. Sirve para no esperar.
//
// En seco dice, por workspace, cuántas filas hay y con qué modelo está cada una, con qué embebe el negocio y cuánto texto se
// le manda. Con --aplicar re-embebe una por una (en su workspace, con `reindexKnowledge`) las que no están con el modelo que
// les toca; al final relee.
// =============================================================================
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const dotenv = await import(pathToFileURL(path.join(REPO, 'node_modules', 'dotenv', 'lib', 'main.js')).href);
const ENV = arg('--env');
if (!ENV) { console.error('⛔ falta --env <.env.local>'); process.exit(1); }
(dotenv.default ?? dotenv).config({ path: ENV, quiet: true });
const APLICAR = process.argv.includes('--aplicar');

const imp = (rel: string) => import(pathToFileURL(path.join(REPO, rel)).href);
const { getSupabaseServer } = await imp('lib/supabase.ts');
const { runWithWorkspace } = await imp('lib/workspace.ts');
const { sePresta } = await imp('lib/rag-prestamo.ts');
const { embebedorDelNegocio, modeloDelVector } = await imp('lib/embeddings.ts');
const { reindexKnowledge } = await imp('lib/mako-knowledge.ts');

type Fila = { id: number; workspace_id: number; titulo: string; cuerpo: string; fuente: string | null; embedding: unknown; estado: string };
const GEMINI = 'gemini-embedding-001';
const OPENAI = 'text-embedding-3-small';
async function leer(): Promise<Fila[]> {
  const out: Fila[] = [];
  for (let de = 0; ; de += 500) {
    const { data, error } = await getSupabaseServer().from('mako_knowledge').select('id, workspace_id, titulo, cuerpo, fuente, embedding, estado').order('id').range(de, de + 499);
    if (error) throw new Error(error.message);
    out.push(...(data as Fila[]));
    if ((data ?? []).length < 500) break;
  }
  return out;
}
// El modelo sale del largo del vector (`modeloDelVector`), con o sin la columna `embedding_modelo`.
const resumen = (fs: Fila[]) => {
  const de = (m: string | null) => fs.filter((f) => modeloDelVector(f) === m).length;
  return `${fs.length} filas · ${de(OPENAI)} en OpenAI · ${de(GEMINI)} en Gemini · ${de(null)} sin vector`;
};

const filas = await leer();
console.log(`Hoy: ${resumen(filas)}`);
// Por workspace: ¿con qué embebe? (lee sus filas de credenciales; no llama a ninguna IA).
const conCuerpo: Fila[] = [];
for (const ws of [...new Set(filas.map((f) => f.workspace_id))].sort((a, b) => a - b)) {
  const suyas = filas.filter((f) => f.workspace_id === ws);
  const conTexto = suyas.filter((f) => (f.cuerpo ?? '').trim());
  const suIA = await runWithWorkspace(ws, () => embebedorDelNegocio()).catch(() => null) as { modelo: string; claves: string[] } | null;
  // El método de MaKo, con la de la plataforma (Gemini) aunque el negocio no tenga su IA; lo suyo, con su IA.
  const van = conTexto.filter((f) => (sePresta(f.fuente) ? modeloDelVector(f) !== GEMINI : !!suIA && modeloDelVector(f) !== suIA.modelo));
  const caracteres = van.reduce((a, f) => a + Math.min(8000, f.cuerpo.trim().length), 0);
  const deMako = van.filter((f) => sePresta(f.fuente)).length;
  const conQue = suIA ? `su ${suIA.modelo === OPENAI ? 'OpenAI' : 'Gemini'} (${suIA.claves.length} cuenta${suIA.claves.length > 1 ? 's' : ''})` : 'SIN su IA (por palabras)';
  console.log(`  ws${ws}: ${resumen(suyas)} · ${conQue} · van ${van.length}${deMako ? ` (${deMako} del método de MaKo)` : ''} · ${caracteres} caracteres (≈ ${Math.round(caracteres / 4)} tokens)`);
  conCuerpo.push(...van);
}
console.log(`A embeber: ${conCuerpo.length} filas`);

if (!conCuerpo.length) {
  console.log('Nada para embeber: todo está con el modelo que le toca (o el negocio no tiene su IA).');
} else if (!APLICAR) {
  console.log('En seco: no se escribió nada. Con --aplicar, se re-embebe.');
} else {
  const inicio = Date.now();
  let ok = 0;
  const errores: string[] = [];
  for (const f of conCuerpo) {
    const r = await runWithWorkspace(f.workspace_id, () => reindexKnowledge(f.id)).catch((e: unknown) => ({ estado: 'error', error: e instanceof Error ? e.message : String(e) }));
    if (r && (r as { estado?: string }).estado === 'indexado') ok++;
    else errores.push(`#${f.id}: ${(r as { error?: string } | null)?.error ?? 'sin respuesta'}`);
  }
  const ms = Date.now() - inicio;
  console.log(`Re-embebidas ${ok}/${conCuerpo.length} en ${(ms / 1000).toFixed(1)} s (${Math.round(ms / Math.max(1, conCuerpo.length))} ms por fila).`);
  if (errores.length) console.log(`Errores (${errores.length}): ${errores.slice(0, 5).join(' | ')}`);
  console.log(`Releído: ${resumen(await leer())}`);
  process.exitCode = errores.length ? 1 : 0;
}
setTimeout(() => process.exit(process.exitCode ?? 0), 10_000).unref();
