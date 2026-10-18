// =============================================================================
// ia-del-ws1-a-la-plataforma — copia las keys de IA de la PLATAFORMA que viven en la fila del ws1 a la de la plataforma
// =============================================================================
// Uso (el .env.local sale del directorio desde donde se corre; ESCRIBE en esa base, que es PRODUCCIÓN, sólo con
// `--aplicar`):
//   npx tsx --conditions=react-server <este repo>/scripts/ia-del-ws1-a-la-plataforma.mts            ← en seco
//   npx tsx --conditions=react-server <este repo>/scripts/ia-del-ws1-a-la-plataforma.mts --aplicar  ← escribe
//
// Para qué (18/10/2026, Martín: «Sí: separá el ws1 de las claves de la plataforma (que salgan del ws9 o del entorno)
// para que Mauricio pueda conectar su propia IA»): hasta ese día la hidratación del arranque copiaba la fila del ws1 a
// `process.env`, así que las keys de IA de esa fila eran LAS de la plataforma en producción. El código nuevo hidrata la
// IA desde el workspace de la plataforma (lib/credenciales.ts → `wsDelEntorno`). Esto corre ANTES de que ese código
// arranque, para que la plataforma tenga esas mismas keys, y para que en la fila del ws1 sigan siendo «la de MaKo»
// (`soloLasPropias` compara contra las filas de la plataforma).
//
// Las reglas, y por qué cada una:
//   · ADITIVO: no borra ni cambia nada del ws1. Mauricio pega la suya encima cuando quiera.
//   · NO PISA: si la plataforma ya tiene esa clave con otro valor, va al primer casillero libre del mismo proveedor
//     (GEMINI_API_KEY_4…); si el proveedor admite una sola cuenta, no se copia y se dice.
//   · IDEMPOTENTE: un valor que la plataforma ya tiene (en cualquier fila de IA) no se vuelve a copiar.
//   · Descifra con el AAD del ws1 y `guardarCredencial` vuelve a cifrar con el de la plataforma; después RELEE y compara.
//   · Nunca imprime un valor: sólo los nombres de las claves.
// =============================================================================
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel: string) => import(pathToFileURL(path.join(REPO, rel)).href);
const dotenv = await import(pathToFileURL(path.join(REPO, 'node_modules', 'dotenv', 'lib', 'main.js')).href);
(dotenv.default ?? dotenv).config({ path: path.join(process.cwd(), '.env.local'), quiet: true });

const { descifrarSecreto, guardarCredencial, credWsEstricta } = await imp('lib/credenciales.ts');
const { wsSuperAdmin, OWNER_WS } = await imp('lib/workspace.ts');
const { getSupabaseServer } = await imp('lib/supabase.ts');
const { esClaveDeIA, esClaveDeCuenta, claveBaseDe, clavesDe, PROVS_MULTIKEY, ENV_BASE } = await imp('lib/ia-keys.ts');

const APLICAR = process.argv.includes('--aplicar');
const huella = (v: string) => createHash('sha256').update(v.trim()).digest('hex');
type Fila = { clave: string; servicio: string; valor: string | null };

async function filasDeIA(ws: number): Promise<Fila[]> {
  const { data, error } = await getSupabaseServer().from('credenciales').select('clave, servicio, valor_enc').eq('workspace_id', ws);
  if (error) throw new Error(`no pude leer las credenciales del ws ${ws}: ${error.message}`);
  return ((data ?? []) as Array<{ clave: string; servicio: string; valor_enc: string }>)
    .filter((r) => esClaveDeIA(r.clave))
    .map((r) => ({ clave: r.clave, servicio: r.servicio, valor: descifrarSecreto(r.valor_enc, ws, r.clave) }));
}

/** El proveedor multicuenta de una clave (`GEMINI_API_KEY_3` → 'gemini'), o null si admite una sola cuenta. */
function provMulti(clave: string): string | null {
  const base = claveBaseDe(clave);
  return (PROVS_MULTIKEY as readonly string[]).find((p) => (ENV_BASE as Record<string, string>)[p] === base) ?? null;
}

const plataforma: number = await wsSuperAdmin();
if (plataforma === OWNER_WS) { console.error(`⛔ la plataforma resolvió al ws ${OWNER_WS}: no hay a dónde mover nada.`); process.exit(1); }
const delWs1 = await filasDeIA(OWNER_WS);
const deLaPlataforma = await filasDeIA(plataforma);
const ocupadas = new Set(deLaPlataforma.map((f) => f.clave));
const yaTiene = new Set(deLaPlataforma.filter((f) => f.valor?.trim()).map((f) => huella(f.valor!)));

console.log(`${APLICAR ? 'APLICAR' : 'EN SECO'} · ws${OWNER_WS} tiene ${delWs1.length} filas de IA · la plataforma (ws${plataforma}) tiene ${deLaPlataforma.length}`);
const plan: Array<{ desde: string; hacia: string; servicio: string; valor: string }> = [];
for (const f of delWs1.sort((a, b) => a.clave.localeCompare(b.clave))) {
  if (esClaveDeCuenta(f.clave)) { console.log(`  · ${f.clave}: es un rótulo de cuenta, no una key: no se copia`); continue; }
  if (!f.valor?.trim()) { console.log(`  · ${f.clave}: ilegible o vacía en el ws${OWNER_WS}: no se copia`); continue; }
  if (yaTiene.has(huella(f.valor))) { console.log(`  · ${f.clave}: la plataforma ya la tiene (mismo valor): nada que hacer`); continue; }
  let hacia: string | null = ocupadas.has(f.clave) ? null : f.clave;
  const prov = provMulti(f.clave);
  if (!hacia && prov) hacia = (clavesDe(prov) as string[]).find((c) => !ocupadas.has(c)) ?? null;
  if (!hacia) {
    console.log(`  ⚠️ ${f.clave}: la plataforma ya tiene OTRA ${f.clave} y ${prov ? 'no quedan casilleros' : 'el proveedor admite una sola cuenta'}: NO se copia`);
    continue;
  }
  ocupadas.add(hacia);
  yaTiene.add(huella(f.valor));
  plan.push({ desde: f.clave, hacia, servicio: f.servicio, valor: f.valor });
  console.log(`  → ${f.clave} (ws${OWNER_WS}) ⇒ ${hacia} (ws${plataforma})`);
}
console.log(`${plan.length} fila(s) para copiar.`);
if (!APLICAR) { console.log('En seco: no se escribió nada. Con --aplicar se copian.'); process.exit(0); }

let ok = 0;
for (const p of plan) {
  await guardarCredencial(plataforma, p.hacia, p.valor, p.servicio, 'sistema:ia-del-ws1-a-la-plataforma');
  const releida = await credWsEstricta(p.hacia, plataforma);
  if (releida && huella(releida) === huella(p.valor)) { ok++; console.log(`  ✓ ${p.hacia} (ws${plataforma}) guardada y releída igual`); }
  else console.error(`  ⛔ ${p.hacia} (ws${plataforma}): la relectura no coincide`);
}
console.log(`${ok} / ${plan.length} copiadas. El ws${OWNER_WS} no se tocó.`);
process.exit(ok === plan.length ? 0 : 1);
