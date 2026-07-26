// TEMP — leer el board del super-admin (read-only). Borrar después.
import postgres from 'postgres';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', connect_timeout: 10, max: 1 });
try {
  const [{ id: ws }] = await sql`select id from workspaces where capa = 'superadmin' limit 1`;
  console.log('WS superadmin =', ws);

  const proys = await sql`select pid, name, score from plan_proyectos where workspace_id = ${ws} order by score desc`;
  console.log(`\n=== PROYECTOS (${proys.length}) ===`);
  for (const p of proys) console.log(`${String(p.score).padStart(3)}  ${p.pid}  ::  ${p.name}`);

  const rel = await sql`select num, title, score, progress from plan_tareas
    where workspace_id = ${ws}
    and (title ilike '%meta%' or title ilike '%oauth%' or title ilike '%token%'
      or title ilike '%facebook%' or title ilike '%desvincul%' or title ilike '%mauricio%'
      or title ilike '%integrac%' or title ilike '%independiente%')
    order by score desc`;
  console.log(`\n=== TAREAS relacionadas (Meta/OAuth/token/desvincul/integrac) (${rel.length}) ===`);
  for (const t of rel) console.log(`${String(t.score).padStart(3)}  #${t.num}  prog${t.progress}  ${t.title}`);

  const alta = await sql`select num, title, score, priority, deadline from plan_tareas
    where workspace_id = ${ws} and progress < 100 and score >= 75 order by score desc limit 15`;
  console.log(`\n=== TAREAS ALTA abiertas (score>=75) (${alta.length}) ===`);
  for (const t of alta) console.log(`${String(t.score).padStart(3)}  ${t.priority}  #${t.num}  ${t.title}  ${t.deadline ?? ''}`);
} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
