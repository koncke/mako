import { resolve } from 'node:path'; import { config } from 'dotenv'; import postgres from 'postgres';
config({ path: resolve(process.cwd(), '.env.local') });
const sql = postgres(process.env.DATABASE_URL, { ssl:'require', max:1 });
// Sincronizar leads que están en columna Ganado pero con estado/cerro desincronizado.
const fixed = await sql`
  UPDATE leads
  SET estado_lead='ganado', cerro=true,
      fecha_cierre = COALESCE(fecha_cierre, fecha_junta_1, (created_at AT TIME ZONE 'America/Tijuana')::date)
  WHERE pipeline_stage='ganado' AND estado_lead IS DISTINCT FROM 'ganado'
  RETURNING id, nombre, fecha_cierre, fecha_junta_1`;
console.log('Leads sincronizados a ganado:', fixed.length);
for (const r of fixed) console.log(`  #${r.id} ${r.nombre} | fecha_cierre=${r.fecha_cierre} J1=${r.fecha_junta_1}`);
const [sold] = await sql`SELECT count(*)::int n, sum(monto_cierre_usd)::int total FROM leads WHERE cerro=true AND fecha_cierre IS NOT NULL`;
console.log('\nSold ahora: n=', sold.n, 'total=', sold.total);
const [vw] = await sql`SELECT sum(cierres)::int cierres FROM v_cohortes_semanales WHERE estado_madurez='madura'`;
console.log('Cierres maduros (vista):', vw.cierres);
await sql.end();
