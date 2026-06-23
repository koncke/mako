import { resolve } from 'node:path'; import { config } from 'dotenv'; import postgres from 'postgres';
config({ path: resolve(process.cwd(), '.env.local') });
const sql = postgres(process.env.DATABASE_URL, { ssl:'require', max:1 });
const ps = await sql`SELECT id, nombre, monto_cierre_usd, cerro, fecha_cierre, estado_lead FROM leads WHERE pipeline_stage='ganado' ORDER BY id`;
console.log(`pipeline_stage='ganado': ${ps.length} leads`);
for (const r of ps) console.log(`  #${r.id} ${r.nombre} | estado=${r.estado_lead} cerro=${r.cerro} monto=${r.monto_cierre_usd} fecha_cierre=${r.fecha_cierre}`);
const [mismatch] = await sql`SELECT count(*)::int n, sum(monto_cierre_usd)::int total FROM leads WHERE pipeline_stage='ganado' AND estado_lead IS DISTINCT FROM 'ganado'`;
console.log('\npipeline=ganado pero estado!=ganado:', mismatch.n, 'sum=', mismatch.total);
await sql.end();
