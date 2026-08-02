// ¿Siguen llegando eventos de tracking? (recencia). Solo LEE.
import postgres from 'postgres';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', connect_timeout: 10, max: 1 });
try {
  for (const t of ['vsl_events', 'landing_visits']) {
    const [r] = await sql.unsafe(`select count(*)::int n, max(created_at) ult, min(created_at) prim from ${t}`);
    console.log(`${t}: n=${r.n}  primero=${r.prim}  ULTIMO=${r.ult}`);
    const dias = await sql.unsafe(`select to_char(date_trunc('day', created_at),'YYYY-MM-DD') d, count(*)::int n from ${t} group by d order by d desc limit 8`);
    console.log('   últimos días:', dias.map(x => `${x.d}=${x.n}`).join(' '));
  }
  // Los 7 leads que SÍ cruzan: ¿viejos o nuevos?
  console.log('\nLeads con visitor_id que SÍ cruzan (id, created, origen):');
  const ok = await sql`
    select l.id, to_char(l.created_at,'YYYY-MM-DD') creado, l.origen_lead
    from leads l where l.visitor_id is not null and l.visitor_id<>''
      and exists (select 1 from vsl_events e where e.visitor_id=l.visitor_id)
    order by l.created_at desc`;
  for (const r of ok) console.log(`   #${r.id} creado=${r.creado} origen=${r.origen_lead}`);
  console.log('\nLeads con visitor_id que NO cruzan (id, created, origen):');
  const no = await sql`
    select l.id, to_char(l.created_at,'YYYY-MM-DD') creado, l.origen_lead
    from leads l where l.visitor_id is not null and l.visitor_id<>''
      and not exists (select 1 from vsl_events e where e.visitor_id=l.visitor_id)
    order by l.created_at desc`;
  for (const r of no) console.log(`   #${r.id} creado=${r.creado} origen=${r.origen_lead}`);
} catch (e) { console.error('Error:', e.message); }
finally { await sql.end({ timeout: 5 }); }
