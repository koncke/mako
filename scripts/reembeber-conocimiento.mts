// =============================================================================
// reembeber-conocimiento — pasar el buscador de conocimiento al embedding de Gemini (IA16, 22/10/2026)
// =============================================================================
// Uso, desde la raíz de este repo:
//   npx tsx --conditions=react-server scripts/reembeber-conocimiento.mts --env <.env.local>             ← en seco
//   npx tsx --conditions=react-server scripts/reembeber-conocimiento.mts --env <.env.local> --aplicar   ← escribe
//
// ⚠️ ESCRIBE EN LA BASE de .env.local (PRODUCCIÓN) sólo con --aplicar: el `embedding` de cada fila de `mako_knowledge`.
// ⚠️ CADA NEGOCIO CON SU GEMINI (lib/embeddings.ts): las filas de un workspace sin su Gemini conectado NO se tocan (se
//    quedarían marcadas `error`). Se re-embeben solas cuando lo conecte (/integraciones). Las del ws9 y el MÉTODO DE MAKO
//    (`fuente` que se presta, que vive en el ws1) van con la de la plataforma: es contenido de MaKo.
//
// En seco dice, por workspace, cuántas filas hay, cuántas ya están en Gemini (768) y cuántas con el vector viejo, si tiene
// su Gemini y cuánto texto se le manda. Con --aplicar re-embebe una por una (en su workspace, con `reindexKnowledge`) las de
// los que lo tienen; al final relee.
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
const { clavesDeSuGemini } = await imp('lib/ai-cheap.ts');
const { sePresta } = await imp('lib/rag-prestamo.ts');
const { DIMENSIONES } = await imp('lib/embeddings.ts');
const { reindexKnowledge } = await imp('lib/mako-knowledge.ts');

type Fila = { id: number; workspace_id: number; titulo: string; cuerpo: string; fuente: string | null; embedding: unknown; estado: string };
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
const largo = (f: Fila) => (Array.isArray(f.embedding) ? f.embedding.length : 0);
const resumen = (fs: Fila[]) => {
  const gemini = fs.filter((f) => largo(f) === DIMENSIONES).length;
  const otros = fs.filter((f) => largo(f) && largo(f) !== DIMENSIONES).length;
  return `${fs.length} filas · ${gemini} en Gemini (${DIMENSIONES}) · ${otros} con el vector viejo · ${fs.length - gemini - otros} sin vector`;
};

const filas = await leer();
console.log(`Hoy: ${resumen(filas)}`);
// Por workspace: ¿tiene su Gemini? (lee sus filas de credenciales; no llama a Google).
const conCuerpo: Fila[] = [];
for (const ws of [...new Set(filas.map((f) => f.workspace_id))].sort((a, b) => a - b)) {
  const suyas = filas.filter((f) => f.workspace_id === ws);
  const conTexto = suyas.filter((f) => (f.cuerpo ?? '').trim());
  const cuentas = (await runWithWorkspace(ws, () => clavesDeSuGemini()).catch(() => [])).length;
  // El método de MaKo se embebe con la de la plataforma aunque el negocio no tenga su Gemini.
  const van = conTexto.filter((f) => cuentas || sePresta(f.fuente));
  const caracteres = van.reduce((a, f) => a + Math.min(8000, f.cuerpo.trim().length), 0);
  const deMako = van.filter((f) => sePresta(f.fuente)).length;
  console.log(`  ws${ws}: ${resumen(suyas)} · ${cuentas ? `su Gemini (${cuentas} cuenta${cuentas > 1 ? 's' : ''})` : 'SIN su Gemini'} · van ${van.length}${deMako ? ` (${deMako} del método de MaKo)` : ''} · ${caracteres} caracteres (≈ ${Math.round(caracteres / 4)} tokens)`);
  conCuerpo.push(...van);
}
console.log(`A embeber: ${conCuerpo.length} filas`);

if (!conCuerpo.length) {
  console.log('Nada para embeber: ningún workspace con filas tiene su Gemini.');
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
