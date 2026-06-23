import { resolve } from 'node:path'; import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });
const ver = process.env.META_API_VERSION, token = process.env.META_ACCESS_TOKEN;
const ad = '120237960510320570'; // Delegar resultados es diseño (el grande)
const u = new URL(`https://graph.facebook.com/${ver}/${ad}/insights`);
u.searchParams.set('fields', 'ad_name,impressions,reach,frequency,inline_link_clicks,ctr,spend,actions');
u.searchParams.set('action_breakdowns','action_type');
u.searchParams.set('time_range', JSON.stringify({since:'2025-11-01', until:'2026-06-19'}));
u.searchParams.set('access_token', token);
const b = await (await fetch(u)).json();
const p = b.error ? b : b.data?.[0];
if (b.error) { console.log('error', b.error.message); }
else console.log(JSON.stringify({ad_name:p.ad_name, impressions:p.impressions, reach:p.reach, frequency:p.frequency, link_clicks:p.inline_link_clicks, ctr:p.ctr, spend:p.spend, agendas:(p.actions||[]).find(a=>a.action_type==='offsite_conversion.fb_pixel_custom')?.value}, null, 2));
