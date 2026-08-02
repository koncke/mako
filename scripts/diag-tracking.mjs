// Forense del tracking de VSL: por qué muchos leads no traen el % visto.
// Solo LEE. node scripts/diag-tracking.mjs
import postgres from 'postgres';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', connect_timeout: 10, max: 1 });
const p = (label, v) => console.log(label.padEnd(52), v);
try {
  const [{ n: totalLeads }] = await sql`select count(*)::int n from leads`;
  const [{ n: conVid }] = await sql`select count(*)::int n from leads where visitor_id is not null and visitor_id <> ''`;
  p('Leads totales:', totalLeads);
  p('Leads con visitor_id:', `${conVid} (${(100*conVid/totalLeads).toFixed(1)}%)`);
  p('Leads SIN visitor_id:', totalLeads - conVid);

  // Eventos por tabla
  const [{ n: vslRows }] = await sql`select count(*)::int n from vsl_events`;
  const [{ n: lvRows }] = await sql`select count(*)::int n from landing_visits`;
  const [{ n: vslVids }] = await sql`select count(distinct visitor_id)::int n from vsl_events`;
  const [{ n: lvVids }] = await sql`select count(distinct visitor_id)::int n from landing_visits`;
  p('vsl_events filas / visitors distintos:', `${vslRows} / ${vslVids}`);
  p('landing_visits filas / visitors distintos:', `${lvRows} / ${lvVids}`);

  // Overlap lead.visitor_id ↔ eventos
  const [{ n: matchVsl }] = await sql`
    select count(*)::int n from leads l
    where l.visitor_id is not null and l.visitor_id <> ''
      and exists (select 1 from vsl_events e where e.visitor_id = l.visitor_id)`;
  const [{ n: matchLv }] = await sql`
    select count(*)::int n from leads l
    where l.visitor_id is not null and l.visitor_id <> ''
      and exists (select 1 from landing_visits v where v.visitor_id = l.visitor_id)`;
  const [{ n: conPct }] = await sql`
    select count(*)::int n from leads l
    where l.visitor_id is not null and l.visitor_id <> ''
      and exists (select 1 from vsl_events e where e.visitor_id = l.visitor_id and e.porcentaje is not null)`;
  console.log('\n── De los leads CON visitor_id ──');
  p('  … con ≥1 vsl_event (matchea):', `${matchVsl} (${conVid?(100*matchVsl/conVid).toFixed(1):0}%)`);
  p('  … con ≥1 landing_visit:', `${matchLv} (${conVid?(100*matchLv/conVid).toFixed(1):0}%)`);
  p('  … con % de retención real:', `${conPct} (${conVid?(100*conPct/conVid).toFixed(1):0}%)`);
  p('  … con visitor_id pero SIN vsl_event:', `${conVid - matchVsl} ← se ven como "no vio"`);

  // Workspace distribution
  console.log('\n── workspace_id en eventos ──');
  const wsVsl = await sql`select workspace_id, count(*)::int n from vsl_events group by workspace_id order by n desc`;
  console.log('  vsl_events:', wsVsl.map(r => `ws${r.workspace_id}=${r.n}`).join(' '));
  const wsLv = await sql`select workspace_id, count(*)::int n from landing_visits group by workspace_id order by n desc`;
  console.log('  landing_visits:', wsLv.map(r => `ws${r.workspace_id}=${r.n}`).join(' '));
  const wsLeads = await sql`select workspace_id, count(*)::int n from leads group by workspace_id order by n desc`;
  console.log('  leads:', wsLeads.map(r => `ws${r.workspace_id}=${r.n}`).join(' '));

  // Formato del visitor_id: longitudes
  console.log('\n── Formato visitor_id (longitud) ──');
  const lenLeads = await sql`select length(visitor_id) len, count(*)::int n from leads where visitor_id is not null and visitor_id<>'' group by len order by n desc limit 6`;
  console.log('  leads:', lenLeads.map(r => `${r.len}c×${r.n}`).join(' '));
  const lenVsl = await sql`select length(visitor_id) len, count(distinct visitor_id)::int n from vsl_events group by len order by n desc limit 6`;
  console.log('  vsl_events:', lenVsl.map(r => `${r.len}c×${r.n}`).join(' '));

  // Muestras
  console.log('\n── Muestra: leads con visitor_id pero SIN vsl_event ──');
  const muestra = await sql`
    select l.id, l.nombre, l.origen_lead, l.visitor_id,
           exists(select 1 from landing_visits v where v.visitor_id=l.visitor_id) tiene_visita
    from leads l
    where l.visitor_id is not null and l.visitor_id<>''
      and not exists (select 1 from vsl_events e where e.visitor_id=l.visitor_id)
    order by l.id desc limit 12`;
  for (const r of muestra) console.log(`   #${r.id} ${(r.nombre||'').slice(0,22).padEnd(22)} origen=${(r.origen_lead||'—').padEnd(13)} visita_landing=${r.tiene_visita} vid=${r.visitor_id.slice(0,20)}`);

  console.log('\n── Muestra: visitor_id que SÍ tienen vsl_events (para comparar formato) ──');
  const ev = await sql`select visitor_id, count(*)::int n, max(porcentaje) maxp from vsl_events group by visitor_id order by n desc limit 6`;
  for (const r of ev) console.log(`   vid=${r.visitor_id.slice(0,24).padEnd(24)} eventos=${r.n} max%=${r.maxp}`);

  // ¿origen_lead se correlaciona con tener tracking?
  console.log('\n── Match de VSL por origen del lead ──');
  const porOrigen = await sql`
    select coalesce(origen_lead,'(null)') origen,
           count(*)::int total,
           count(*) filter (where exists(select 1 from vsl_events e where e.visitor_id=l.visitor_id))::int con_vsl
    from leads l where visitor_id is not null and visitor_id<>''
    group by origen order by total desc`;
  for (const r of porOrigen) p(`  ${r.origen}:`, `${r.con_vsl}/${r.total} con VSL`);
} catch (e) {
  console.error('Error:', e.message);
} finally {
  await sql.end({ timeout: 5 });
}
