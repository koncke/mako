import { resolve } from 'node:path'; import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });
const ver = process.env.META_API_VERSION, token = process.env.META_ACCESS_TOKEN;
const ad = '120237960510320570';
const tr = JSON.stringify({since:'2025-11-01', until:'2026-06-20'});
async function bd(name, breakdowns){
  const u = new URL(`https://graph.facebook.com/${ver}/${ad}/insights`);
  u.searchParams.set('fields','impressions,reach,spend,actions');
  u.searchParams.set('action_breakdowns','action_type');
  u.searchParams.set('breakdowns', breakdowns);
  u.searchParams.set('time_range', tr); u.searchParams.set('limit','500');
  u.searchParams.set('access_token', token);
  const b = await (await fetch(u)).json();
  if (b.error) { console.log(name, 'ERROR', b.error.message); return; }
  const rows = b.data ?? [];
  console.log(`\n${name}: ${rows.length} filas`);
  for (const r of rows.slice(0,4)) console.log('  ', JSON.stringify({age:r.age,gender:r.gender,platform:r.publisher_platform,region:r.region,imp:r.impressions,reach:r.reach}));
}
await bd('age,gender','age,gender');
await bd('publisher_platform','publisher_platform');
await bd('region','region');
