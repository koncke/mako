// =============================================================================
// wipe-chart-chats — borra TODAS las conversaciones de MaKo (sesiones + mensajes)
// =============================================================================
// Uso: node scripts/wipe-chart-chats.mjs
// Limpia chart_chats y chart_sessions para poder probar el chat desde cero.

import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL en .env.local');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });

// Primero los mensajes (FK a sesiones), después las sesiones.
const msgs = await sql`DELETE FROM chart_chats`;
const sesiones = await sql`DELETE FROM chart_sessions`;
await sql.end();

console.log(`OK — borrados ${msgs.count} mensajes y ${sesiones.count} sesiones.`);
