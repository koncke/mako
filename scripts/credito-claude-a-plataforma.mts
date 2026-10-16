// =============================================================================
// credito-claude-a-plataforma — guarda las dos claves del crédito de Claude Max en la base
// =============================================================================
// Uso (desde la raíz del CLON, donde está el .env.local; ESCRIBE en la base de .env.local, que
// es PRODUCCIÓN):
//   npx tsx --conditions=react-server scripts/credito-claude-a-plataforma.mts
//
// Para qué: Martín vinculó el crédito de API de dos planes Max suyos (16/10/2026, «Vinculalas a
// MaKo»). Las claves están validadas y viven en el .env.local del clon como
// ANTHROPIC_CREDITO_CUENTA1 y ANTHROPIC_CREDITO_CUENTA2, pero en Vercel no se pueden cargar sin el
// rol de dueño. `conCreditoDeLaPlataforma` (lib/anthropic.ts) las lee del entorno O de la fila del
// workspace de la plataforma con esos mismos nombres: esto las deja en la fila, cifradas.
//
// Qué hace, en orden (el molde es scripts/push-vapid-generar.mts):
//   1. Lee cada clave del .env.local. NUNCA la imprime: sólo el largo y los últimos 4.
//   2. Si la fila ya existe y se lee IGUAL → no toca nada. Si existe DISTINTA o no se lee → ABORTA
//      esa clave: pisar una clave buena con otra es una decisión, no un efecto de correr esto.
//   3. Si no existe → cifra con el MISMO `cifrarSecreto(valor, ws, clave)` que lee `credWsEstricta`
//      e INSERTA SI NO EXISTE (ON CONFLICT DO NOTHING), y deja la auditoría.
//   4. RELEE con `credWsEstricta` y compara: lo que manda es la base.
// =============================================================================
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = process.cwd();
const imp = (rel: string) => import(pathToFileURL(path.join(REPO, rel)).href);
const dotenv = await import(pathToFileURL(path.join(REPO, 'node_modules', 'dotenv', 'lib', 'main.js')).href);
(dotenv.default ?? dotenv).config({ path: path.join(REPO, '.env.local'), quiet: true });

const { credWsEstricta, cifrarSecreto, auditarCredencial } = await imp('lib/credenciales.ts');
const { wsSuperAdmin } = await imp('lib/workspace.ts');
const { getSupabaseServer } = await imp('lib/supabase.ts');
const { CLAVES_CREDITO_PLATAFORMA } = await imp('lib/veto-claude.ts');

const huella = (v: string) => `${v.length} caracteres, termina en …${v.slice(-4)}`;
const ws: number = await wsSuperAdmin();
console.log(`workspace de plataforma: ${ws}`);
const db = getSupabaseServer();
let fallas = 0;

for (const clave of CLAVES_CREDITO_PLATAFORMA as readonly string[]) {
  const valor = (process.env[clave] ?? '').trim();
  if (!valor.startsWith('sk-ant-')) { console.error(`⛔ ${clave}: no está en .env.local (o no empieza con sk-ant-). No se toca.`); fallas++; continue; }

  let ya: string | null = null;
  try { ya = await credWsEstricta(clave, ws); } catch (e) { console.error(`⛔ ${clave}: no pude leer la fila: ${e instanceof Error ? e.message : String(e)}`); fallas++; continue; }
  if (ya) {
    if (ya.trim() === valor) { console.log(`✓ ${clave}: ya estaba en la base, igual (${huella(valor)}). No se toca.`); continue; }
    console.error(`⛔ ${clave}: en la base hay OTRA clave (${huella(ya)}). No se pisa: si hay que cambiarla, es una decisión aparte.`);
    fallas++;
    continue;
  }
  const { data: fila, error: errFila } = await db.from('credenciales').select('clave').eq('workspace_id', ws).eq('clave', clave).maybeSingle();
  if (errFila) { console.error(`⛔ ${clave}: no pude mirar la fila: ${errFila.message}`); fallas++; continue; }
  if (fila) { console.error(`⛔ ${clave}: hay una fila que NO se puede leer (otro CREDENCIALES_SECRET). No se pisa.`); fallas++; continue; }

  const { error: errIns } = await db.from('credenciales').upsert(
    { workspace_id: ws, clave, valor_enc: cifrarSecreto(valor, ws, clave), servicio: 'anthropic', updated_by: 'sistema:credito-claude', updated_at: new Date().toISOString() },
    { onConflict: 'workspace_id,clave', ignoreDuplicates: true },
  );
  if (errIns) { console.error(`⛔ ${clave}: no pude insertar: ${errIns.message}`); fallas++; continue; }
  await auditarCredencial(ws, clave, 'guardar', 'sistema:credito-claude');

  const releido = await credWsEstricta(clave, ws);
  if (releido?.trim() === valor) console.log(`✓ ${clave}: guardada y releída igual (${huella(valor)}).`);
  else { console.error(`⛔ ${clave}: la relectura no coincide${releido ? ` (${huella(releido)})` : ' (vacía)'}.`); fallas++; }
}
process.exit(fallas ? 1 : 0);
