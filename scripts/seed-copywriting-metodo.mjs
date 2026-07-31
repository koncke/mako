// Siembra la metodología curada de copywriting (CURSO_COPY) en el workspace del
// dueño — el equivalente por script de seedCopywritingMetodo (lib/copywriting-
// metodo.ts), que nunca corrió en prod: el generador de nutrición operaba solo
// con el curso "Levanta Muertos". Idempotente: si el curso ya existe, no toca.
// Fuente de verdad del contenido: el array METODO del propio lib (se extrae del
// archivo para no duplicar el texto acá).
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: resolve(process.cwd(), '.env.local') });
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });

const CURSO = 'Copywriting & Psicología (MaKo)';
const OWNER_WS = 1;

// Extrae el literal METODO del lib (data pura: strings template sin interpolación).
const src = readFileSync(resolve(process.cwd(), 'lib/copywriting-metodo.ts'), 'utf8');
const ini = src.indexOf('const METODO: MetodoEntry[] = [');
const fin = src.indexOf('\n];', ini);
if (ini === -1 || fin === -1) { console.error('No encontré el array METODO en lib/copywriting-metodo.ts'); process.exit(1); }
const literal = src.slice(src.indexOf('[', ini), fin + 2);
const METODO = eval(literal);
console.log(`METODO extraído: ${METODO.length} entradas`);

const [ya] = await sql`SELECT 1 FROM mako_knowledge WHERE curso = ${CURSO} AND workspace_id = ${OWNER_WS} LIMIT 1`;
if (ya) { console.log('El curso ya está sembrado — nada que hacer.'); await sql.end(); process.exit(0); }

async function embed(text) {
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text.trim().slice(0, 8000) }),
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(`embeddings: ${j?.error?.message ?? r.status}`);
  return j.data[0].embedding;
}

let creadas = 0;
for (const m of METODO) {
  try {
    const v = await embed(m.cuerpo);
    const hash = createHash('sha256').update(m.cuerpo).digest('hex');
    await sql`INSERT INTO mako_knowledge (workspace_id, titulo, categoria, cuerpo, curso, autor, area, fuente, activo, estado, embedding, content_hash)
      VALUES (${OWNER_WS}, ${m.titulo}, ${m.categoria}, ${m.cuerpo}, ${CURSO}, 'MaKo', 'mensajes', 'mako', true, 'indexado', ${JSON.stringify(v)}, ${hash})`;
    creadas += 1;
    console.log(`  ✓ ${m.titulo}`);
  } catch (e) {
    console.error(`  ✗ ${m.titulo}: ${e.message}`);
  }
}
console.log(`Listo: ${creadas}/${METODO.length} entradas sembradas en ws ${OWNER_WS}.`);
await sql.end();
