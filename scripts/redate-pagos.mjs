import { resolve } from 'node:path'; import { config } from 'dotenv'; import postgres from 'postgres';
config({ path: resolve(process.cwd(), '.env.local') });
const sql = postgres(process.env.DATABASE_URL, { ssl:'require', max:1 });

console.log('Antes — cash por mes:');
for (const r of await sql`SELECT to_char(fecha_pago,'YYYY-MM') m, count(*)::int n, sum(monto_usd)::int t FROM pagos WHERE pagado=true GROUP BY 1 ORDER BY 1`) console.log(`  ${r.m}: ${r.n} pagos $${r.t}`);

// Re-fechar los pagos marcados en junio → fecha de la reunión (J1 de Calendly; fallback cierre).
const upd = await sql`
  UPDATE pagos p
  SET fecha_pago = COALESCE(l.fecha_junta_1, l.fecha_cierre, p.fecha_pago)
  FROM leads l
  WHERE p.lead_id = l.id AND p.pagado = true
    AND p.fecha_pago >= '2026-06-01' AND p.fecha_pago <= '2026-06-30'
  RETURNING p.id`;
console.log(`\nPagos re-fechados: ${upd.length}`);

// Resincronizar fecha_primer_pago de los leads afectados.
await sql`
  UPDATE leads l SET fecha_primer_pago = sub.minf
  FROM (SELECT lead_id, min(fecha_pago) minf FROM pagos WHERE pagado=true GROUP BY lead_id) sub
  WHERE l.id = sub.lead_id`;

console.log('\nDespués — cash por mes:');
for (const r of await sql`SELECT to_char(fecha_pago,'YYYY-MM') m, count(*)::int n, sum(monto_usd)::int t FROM pagos WHERE pagado=true GROUP BY 1 ORDER BY 1`) console.log(`  ${r.m}: ${r.n} pagos $${r.t}`);
await sql.end();
