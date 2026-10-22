// =============================================================================
// gemini-pago — ¿la clave de Gemini de la plataforma ya es PAGA? Y recién ahí, la marca (IA16, 22/10/2026)
// =============================================================================
// Uso, desde la raíz de este repo:
//   npx tsx --conditions=react-server scripts/gemini-pago.mts --env <.env.local>            ← mide, no escribe nada
//   npx tsx --conditions=react-server scripts/gemini-pago.mts --env <.env.local> --marcar   ← mide y, si TODAS pasan, prende
//                                                                                              `ia.gemini.plataforma_paga`
//
// Martín, 22/10/2026: «¿Activo el pago por uso de Gemini?» → «Sí, sin tope». La prueba de que una clave es paga: una
// ráfaga más grande que el tope por minuto del plan gratis, sin ningún 429 del plan gratis (…FreeTier). Un 503 («high
// demand») no dice nada del plan: se cuenta aparte.
//
// ⚠️ LA MARCA SE PRENDE SÓLO SI TODAS LAS CLAVES DE GEMINI DE LA PLATAFORMA PASAN. Con la marca, los datos de los clientes
// van a la red de la plataforma, y la red rota entre TODAS sus claves de Gemini: una sola gratis los mandaría a entrenar.
// Las claves gratis se sacan antes (con backup), y esto lo vuelve a comprobar.
// ⚠️ ESCRIBE en la base de .env.local (PRODUCCIÓN) sólo con --marcar, y sólo esa fila de `app_settings` del ws9.
// =============================================================================
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const dotenv = await import(pathToFileURL(path.join(REPO, 'node_modules', 'dotenv', 'lib', 'main.js')).href);
const ENV = arg('--env');
if (!ENV) { console.error('⛔ falta --env <.env.local>'); process.exit(1); }
(dotenv.default ?? dotenv).config({ path: ENV, quiet: true });
const MARCAR = process.argv.includes('--marcar');
const RAFAGA = 20; // el plan gratis de Flash permite ~10 por minuto

const imp = (rel: string) => import(pathToFileURL(path.join(REPO, rel)).href);
const { getSupabaseServer } = await imp('lib/supabase.ts');
const { credWsEstricta } = await imp('lib/credenciales.ts');
const { runWithWorkspace, wsSuperAdmin } = await imp('lib/workspace.ts');
const { setSetting } = await imp('lib/settings.ts');
const { CLAVE_GEMINI_PAGO } = await imp('lib/gemini-pago.ts');

type Golpe = { status: number; gratis: boolean };
async function golpe(key: string): Promise<Golpe> {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent', {
    method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Contesta sólo: ok' }] }], generationConfig: { maxOutputTokens: 4, temperature: 0 } }),
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null);
  if (!r) return { status: 0, gratis: false };
  const txt = await r.text().catch(() => '');
  return { status: r.status, gratis: r.status === 429 && /FreeTier/i.test(txt) };
}

const ws = await wsSuperAdmin();
const { data, error } = await getSupabaseServer().from('credenciales').select('clave').eq('workspace_id', ws).like('clave', 'GEMINI_API_KEY%');
if (error) { console.error(error.message); process.exit(1); }
const nombres = (data ?? []).map((f: { clave: string }) => f.clave).filter((c: string) => /^GEMINI_API_KEY(_\d+)?$/.test(c)).sort();
let todas = nombres.length > 0;
for (const nombre of nombres) {
  const key = (await credWsEstricta(nombre, ws, { ilegibleTira: true }))?.trim();
  if (!key) { console.log(`${nombre}: vacía`); todas = false; continue; }
  const golpes = await Promise.all(Array.from({ length: RAFAGA }, () => golpe(key)));
  const ok = golpes.filter((g) => g.status === 200).length;
  const gratis = golpes.filter((g) => g.gratis).length;
  const saturado = golpes.filter((g) => g.status === 503).length;
  const otros = golpes.filter((g) => g.status !== 200 && g.status !== 503 && !g.gratis).map((g) => g.status);
  const paga = gratis === 0 && ok >= RAFAGA / 2;
  console.log(`${nombre} (…${key.slice(-4)}): ${RAFAGA} pedidos a la vez → ${ok} ok · ${gratis} con el tope GRATIS · ${saturado} saturados (503)${otros.length ? ` · otros ${otros.join(',')}` : ''} → ${paga ? 'PAGA' : gratis ? 'GRATIS' : 'no se sabe'}`);
  if (!paga) todas = false;
}
const env = process.env.GEMINI_API_KEY?.trim();
if (env) console.log(`El GEMINI_API_KEY del entorno de este .env.local termina en …${env.slice(-4)} (el de Vercel lo hidrata la fila del ws9).`);

if (!todas) {
  console.log('⛔ No todas las claves de Gemini de la plataforma son pagas: la marca NO se prende. Sacá las gratis (con backup) y volvé a medir.');
  process.exitCode = MARCAR ? 2 : 0;
} else if (!MARCAR) {
  console.log('✓ Todas pagas. Con --marcar, se prende la marca.');
} else {
  await runWithWorkspace(ws, () => setSetting(CLAVE_GEMINI_PAGO, '1'));
  console.log(`✓ Marca prendida: ${CLAVE_GEMINI_PAGO} = '1' en el ws ${ws}. La red de la plataforma ya acepta datos de clientes con Gemini (en ≤60 s).`);
}
setTimeout(() => process.exit(process.exitCode ?? 0), 10_000).unref();
