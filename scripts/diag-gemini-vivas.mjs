// SOLO LECTURA de METADATOS. GET /v1beta/models?key=… no genera tokens, no gasta
// creditos y no consume cuota de generacion: solo dice si la key EXISTE y si la API
// esta habilitada en su proyecto. No se llama a generateContent en ningun caso.
import postgres from 'postgres';
import crypto from 'node:crypto';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { descifrar } from '../lib/cripto-credenciales.ts';
config({ path: resolve(process.cwd(), '.env.local') });
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
const creds = await sql`
  select workspace_id, clave, valor_enc from credenciales
  where clave in ('GEMINI_API_KEY','GEMINI_API_KEY_2','GEMINI_API_KEY_3')
    and workspace_id in (1,9) order by workspace_id, clave`;
await sql.end();
for (const c of creds) {
  const k = descifrar(c.valor_enc, c.workspace_id, c.clave);
  if (!k) { console.log(`  ws${c.workspace_id} ${c.clave}: ILEGIBLE`); continue; }
  let out;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(k)}&pageSize=1`);
    const t = await r.text();
    let det = '';
    try { const j = JSON.parse(t); det = j.error ? `${j.error.status ?? ''} · ${String(j.error.message).slice(0,140)}` : `OK · ${(j.models ?? []).length} modelo(s)`; }
    catch { det = t.slice(0, 120); }
    out = `HTTP ${r.status} · ${det}`;
  } catch (e) { out = `EXCEPCION: ${e.message}`; }
  console.log(`  ws${String(c.workspace_id).padEnd(3)} ${c.clave.padEnd(18)} sha=${sha(k)} …${k.slice(-4)}  →  ${out}`);
}
