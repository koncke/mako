// Siembra el curso "Buenas prácticas para construir una App" en Conocimientos
// (área 'producto', workspace del dueño). Idempotente: si el curso ya existe, no
// hace nada. El contenido vive en lib/curso-producto.ts (fuente única).
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: resolve(process.cwd(), '.env.local') });
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });

const CURSO = 'Buenas prácticas para construir una App';
const AREA = 'producto';
const OWNER_WS = 1;

// Extrae el array de lecciones del lib (data pura: template strings sin interpolación).
const src = readFileSync(resolve(process.cwd(), 'lib/curso-producto.ts'), 'utf8');
const ini = src.indexOf('export const CURSO_PRODUCTO_LECCIONES: LeccionProducto[] = [');
const fin = src.indexOf('\n];', ini);
if (ini === -1 || fin === -1) { console.error('No encontré CURSO_PRODUCTO_LECCIONES en lib/curso-producto.ts'); process.exit(1); }
const LECCIONES = eval(src.slice(src.indexOf('[', ini), fin + 2));
console.log(`Lecciones: ${LECCIONES.length}`);

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
for (const l of LECCIONES) {
  try {
    const v = await embed(`${l.titulo}\n\n${l.cuerpo}`);
    const hash = createHash('sha256').update(l.cuerpo).digest('hex');
    await sql`INSERT INTO mako_knowledge (workspace_id, titulo, categoria, cuerpo, curso, autor, area, fuente, activo, estado, embedding, content_hash)
      VALUES (${OWNER_WS}, ${l.titulo}, ${l.categoria}, ${l.cuerpo}, ${CURSO}, 'MaKo · aprendizajes de construcción', ${AREA}, 'mako', true, 'indexado', ${JSON.stringify(v)}, ${hash})`;
    creadas += 1;
    console.log(`  ✓ ${l.titulo}`);
  } catch (e) {
    console.error(`  ✗ ${l.titulo}: ${e.message}`);
  }
}
console.log(`Listo: ${creadas}/${LECCIONES.length} lecciones en el curso "${CURSO}" (ws ${OWNER_WS}, área ${AREA}).`);
await sql.end();
