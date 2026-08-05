// Backfill #2: setter/closer = el ÚNICO vendedor, por workspace con 1 solo vendedor.
import postgres from 'postgres';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', connect_timeout: 10, max: 1 });
try {
  // Vendedores por workspace (no admin, no suspendido, no MaKo).
  const rows = await sql`
    select workspace_id, coalesce(nullif(trim(nombre),''), email) nombre
    from usuarios
    where estado <> 'suspendido' and rol <> 'admin'
      and coalesce(nullif(trim(nombre),''), email) is not null
      and coalesce(trim(nombre),'') <> 'MaKo'`;
  const porWs = new Map();
  for (const r of rows) { const a = porWs.get(r.workspace_id) ?? []; a.push(r.nombre); porWs.set(r.workspace_id, a); }
  let totalWs = 0, totalLeads = 0;
  for (const [ws, vend] of porWs) {
    if (vend.length !== 1) continue; // solo workspaces con UN vendedor
    const nombre = vend[0];
    const r = await sql`
      update leads set setter = coalesce(nullif(trim(setter),''), ${nombre}),
                       closer = coalesce(nullif(trim(closer),''), ${nombre})
      where workspace_id = ${ws}
        and (setter is null or trim(setter) = '' or closer is null or trim(closer) = '')
      returning id`;
    totalWs++; totalLeads += r.length;
    console.log(`ws${ws} (${nombre}): ${r.length} leads actualizados`);
  }
  console.log(`\nListo: ${totalWs} workspace(s) de 1 vendedor, ${totalLeads} leads con setter/closer completados.`);
} catch(e){ console.log('ERR', e.message); } finally { await sql.end({timeout:5}); }
