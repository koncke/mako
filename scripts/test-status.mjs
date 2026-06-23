import { resolve } from 'node:path'; import { config } from 'dotenv'; import postgres from 'postgres';
config({ path: resolve(process.cwd(), '.env.local') });
const sql = postgres(process.env.DATABASE_URL, { ssl:'require', max:1 });
const id = 81; // lead ganado
try {
  await sql.begin(async (tx) => {
    const a = await tx`UPDATE leads SET pipeline_stage='agenda' WHERE id=${id} RETURNING id`;
    console.log('update pipeline_stage OK:', a.length);
    const b = await tx`UPDATE leads SET estado_lead='abierto', cerro=null, monto_cierre_usd=null, fecha_cierre=null WHERE id=${id} RETURNING id`;
    console.log('update estado/cerro OK:', b.length);
    throw new Error('ROLLBACK intencional');
  });
} catch (e) { console.log('resultado:', e.message); }
await sql.end();
