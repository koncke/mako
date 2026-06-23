import postgres from 'postgres';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', connect_timeout: 10, max: 1 });
try {
  const [p] = await sql`SELECT count(*)::int dias, sum(youtube_views)::int total, min(fecha)::text desde, max(fecha)::text hasta
    FROM marketing_metrics_daily WHERE plataforma='youtube' AND youtube_video_id='vsl-prueba-dos'`;
  console.log('VSL prueba seed:', JSON.stringify(p));
  // El funnel cuenta solo type='vsl' → este marcador NO debe entrar:
  const [v] = await sql`SELECT count(*)::int filas, sum(youtube_views)::int views
    FROM marketing_metrics_daily WHERE plataforma='youtube' AND youtube_video_type='vsl'`;
  console.log("VSL real (type='vsl', lo que cuenta el funnel):", JSON.stringify(v));
  const [bad] = await sql`SELECT count(*)::int n FROM marketing_metrics_daily
    WHERE youtube_video_id='vsl-prueba-dos' AND youtube_video_type IS NOT NULL`;
  console.log('Filas prueba con type != NULL (debe ser 0):', bad.n);
} finally { await sql.end({ timeout: 5 }); }
