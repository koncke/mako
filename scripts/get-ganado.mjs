import { resolve } from 'node:path'; import { config } from 'dotenv'; import postgres from 'postgres';
import { urlDeLaBase } from './url-de-la-base.mjs';
config({ path: resolve(process.cwd(), '.env.local') });
const sql = postgres(urlDeLaBase(), { ssl:'require', max:1 });
const r = await sql`SELECT id, nombre, estado_lead FROM leads WHERE estado_lead='ganado' ORDER BY id DESC LIMIT 3`;
console.log(r.map(x=>`${x.id} ${x.nombre}`).join(' | '));
await sql.end();
