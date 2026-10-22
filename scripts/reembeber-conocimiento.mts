// =============================================================================
// reembeber-conocimiento — pasar el buscador de conocimiento al embedding de Gemini (IA16, 22/10/2026)
// =============================================================================
// Uso, desde la raíz de este repo:
//   npx tsx --conditions=react-server scripts/reembeber-conocimiento.mts --env <.env.local>             ← en seco
//   npx tsx --conditions=react-server scripts/reembeber-conocimiento.mts --env <.env.local> --aplicar   ← escribe
//
// ⚠️ ESCRIBE EN LA BASE de .env.local (PRODUCCIÓN) sólo con --aplicar: el `embedding` de cada fila de `mako_knowledge`.
// ⚠️ SE NIEGA sin la marca del Gemini PAGO de la plataforma (lib/gemini-pago.ts): con el plan gratis, el conocimiento de
//    los negocios iría a entrenar, y cada fila quedaría marcada `error`.
//
// En seco dice cuántas filas hay, cuántas ya están en Gemini (768) y cuántas en OpenAI (1536), y cuánto texto se manda.
// Con --aplicar re-embebe una por una (por su workspace, con `reindexKnowledge`) y mide el tiempo; al final relee.
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
const { geminiDeLaPlataformaPaga } = await imp('lib/gemini-pago.ts');
const { DIMENSIONES } = await imp('lib/embeddings.ts');
const { reindexKnowledge } = await imp('lib/mako-knowledge.ts');

type Fila = { id: number; workspace_id: number; titulo: string; cuerpo: string; embedding: unknown; estado: string };
async function leer(): Promise<Fila[]> {
  const out: Fila[] = [];
  for (let de = 0; ; de += 500) {
    const { data, error } = await getSupabaseServer().from('mako_knowledge').select('id, workspace_id, titulo, cuerpo, embedding, estado').order('id').range(de, de + 499);
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
const conCuerpo = filas.filter((f) => (f.cuerpo ?? '').trim());
const caracteres = conCuerpo.reduce((a, f) => a + Math.min(8000, f.cuerpo.trim().length), 0);
console.log(`Hoy: ${resumen(filas)}`);
console.log(`A embeber: ${conCuerpo.length} filas · ${caracteres} caracteres (≈ ${Math.round(caracteres / 4)} tokens)`);

const paga = await geminiDeLaPlataformaPaga();
if (!paga) {
  console.log('⛔ El Gemini de la plataforma NO está marcado como pago (ia.gemini.plataforma_paga): no se embebe nada.');
  process.exitCode = APLICAR ? 2 : 0;
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
