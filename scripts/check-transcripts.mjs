import { resolve } from 'node:path'; import { config } from 'dotenv'; import postgres from 'postgres';
config({ path: resolve(process.cwd(), '.env.local') });
const sql = postgres(process.env.DATABASE_URL, { ssl:'require', max:1 });
const rows = await sql`SELECT status, count(*)::int n FROM ad_transcripts GROUP BY status ORDER BY n DESC`;
console.log('Por status:', rows.map(r=>`${r.status}=${r.n}`).join(' · '));
const [d] = await sql`SELECT idioma, duracion_s, left(transcript,120) t FROM ad_transcripts WHERE ad_id='120237960510320570'`;
console.log('Ejemplo (Delegar):', d.idioma, Math.round(d.duracion_s)+'s ·', d.t+'…');
await sql.end();
