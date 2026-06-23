import { resolve } from 'node:path'; import { config } from 'dotenv'; import postgres from 'postgres';
config({ path: resolve(process.cwd(), '.env.local') });
const sql = postgres(process.env.DATABASE_URL, { ssl:'require', max:1 });
const r = await sql`SELECT id, nombre, estado_lead FROM leads WHERE estado_lead='ganado' ORDER BY id DESC LIMIT 3`;
console.log(r.map(x=>`${x.id} ${x.nombre}`).join(' | '));
await sql.end();
