import { resolve } from 'node:path'; import { config } from 'dotenv'; import postgres from 'postgres';
config({ path: resolve(process.cwd(), '.env.local') });
const sql = postgres(process.env.DATABASE_URL, { ssl:'require', max:1 });
const [r] = await sql`SELECT tipo, model, status, jsonb_array_length(secciones) secs, left(transcript,260) t FROM ad_transcripts WHERE ad_id='120240215335300570'`;
console.log('tipo:', r.tipo, '| model:', r.model, '| status:', r.status, '| secciones:', r.secs);
console.log('transcript:\n', r.t);
await sql.end();
