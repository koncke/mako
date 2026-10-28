import { resolve } from 'node:path'; import { config } from 'dotenv'; import postgres from 'postgres';
import { urlDeLaBase } from './url-de-la-base.mjs';
config({ path: resolve(process.cwd(), '.env.local') });
const sql = postgres(urlDeLaBase(), { ssl:'require', max:1 });
await sql`NOTIFY pgrst, 'reload schema'`;
console.log('NOTIFY pgrst reload schema enviado');
await sql.end();
