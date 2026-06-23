// Solo-lectura: ¿existen las columnas de creativo (0022)? ¿tienen datos?
import postgres from 'postgres';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', connect_timeout: 10, max: 1 });
try {
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='marketing_metrics_daily'
      AND column_name IN ('ad_thumbnail_url','ad_permalink','ad_creative_sin_enlace')
    ORDER BY column_name`;
  console.log('Columnas 0022 presentes:', cols.map(c => c.column_name).join(', ') || '(ninguna)');

  // ¿La última fila meta cuándo se creó? (¿el cron escribió hoy?)
  const last = await sql`
    SELECT max(created_at) AS ult_created, max(fecha)::text AS ult_fecha
    FROM marketing_metrics_daily WHERE plataforma='meta'`;
  console.log('Meta: última fecha =', last[0].ult_fecha, '| último created_at =', last[0].ult_created?.toISOString?.() ?? last[0].ult_created);

  // Si las columnas existen, ¿cuántas filas con thumbnail/permalink en 14d?
  if (cols.length === 3) {
    const filled = await sql`
      SELECT
        count(*) FILTER (WHERE ad_thumbnail_url IS NOT NULL)::int AS con_thumb,
        count(*) FILTER (WHERE ad_permalink IS NOT NULL)::int AS con_link,
        count(*) FILTER (WHERE ad_creative_sin_enlace IS TRUE)::int AS sin_enlace,
        count(*)::int AS total
      FROM marketing_metrics_daily
      WHERE plataforma='meta' AND ad_id IS NOT NULL AND fecha >= current_date - 14`;
    console.log('En 14d:', JSON.stringify(filled[0]));
  }
} catch (e) { console.error('Error:', e.message); process.exitCode = 1; }
finally { await sql.end({ timeout: 5 }); }
