// =============================================================================
// Sembrar los cursos curados de conocimiento (Levanta Muertos, etc.) — idempotente
// =============================================================================
// Uso:  npx tsx scripts/seed-levanta-muertos.ts
// Lee DATABASE_URL + OPENAI_API_KEY de .env.local. Replica lo que hace el botón
// "Bajar a tierra" de /conocimiento (createKnowledge): inserta cada entrada y la
// embebe (text-embedding-3-small). Si el curso ya existe, lo saltea.
// =============================================================================

import postgres from 'postgres';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { config } from 'dotenv';
import { CURATED_CURSOS } from '../lib/mako-knowledge-seed';

config({ path: resolve(process.cwd(), '.env.local') });

const CONN = process.env.DATABASE_URL;
const OAI = process.env.OPENAI_API_KEY;
if (!CONN) { console.error('Falta DATABASE_URL en .env.local'); process.exit(1); }
if (!OAI) { console.error('Falta OPENAI_API_KEY en .env.local'); process.exit(1); }

async function embed(text: string): Promise<number[]> {
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OAI}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text.trim().slice(0, 8000) }),
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(`embeddings: ${j?.error?.message ?? r.status}`);
  return j.data[0].embedding as number[];
}

const sql = postgres(CONN, { ssl: 'require', connect_timeout: 15, max: 1 });

async function main() {
  try {
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from leads`;
    console.log(`Proyecto OK — leads=${n}`);
    if (n < 50) { console.error('⚠️ leads<50 — proyecto sospechoso, abortando'); process.exit(1); }

    for (const curso of CURATED_CURSOS) {
      const [{ c }] = await sql<{ c: number }[]>`select count(*)::int as c from mako_knowledge where curso = ${curso.curso}`;
      if (c > 0) { console.log(`↷ "${curso.curso}" ya estaba (${c} entradas) — salteo`); continue; }
      let ok = 0;
      for (const e of curso.entradas) {
        const v = await embed(e.cuerpo);
        const hash = createHash('sha256').update(e.cuerpo).digest('hex');
        await sql`
          insert into mako_knowledge (titulo, categoria, cuerpo, curso, autor, area, fuente, activo, embedding, content_hash, estado)
          values (${e.titulo}, ${e.categoria}, ${e.cuerpo}, ${curso.curso}, ${curso.autor}, ${curso.area}, 'manual', true, ${sql.json(v)}, ${hash}, 'indexado')
        `;
        ok++;
        console.log(`  ✓ ${e.titulo}`);
      }
      console.log(`✅ "${curso.curso}" sembrado — ${ok} entradas`);
    }
    await sql`NOTIFY pgrst, 'reload schema'`;
    process.exit(0);
  } catch (e) {
    console.error('Error:', e instanceof Error ? e.message : String(e));
    process.exit(1);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

void main();
