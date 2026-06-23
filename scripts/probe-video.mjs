import { resolve } from 'node:path'; import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });
const ver = process.env.META_API_VERSION, token = process.env.META_ACCESS_TOKEN;
const ad = '120237960510320570'; // Delegar resultados es diseño
// 1) video_id desde el creativo
const cu = new URL(`https://graph.facebook.com/${ver}/${ad}`);
cu.searchParams.set('fields','creative{object_story_spec{video_data{video_id}},video_id}');
cu.searchParams.set('access_token', token);
const c = await (await fetch(cu)).json();
const vid = c?.creative?.object_story_spec?.video_data?.video_id || c?.creative?.video_id;
console.log('video_id:', vid || '(no encontrado)', c.error?'ERR '+c.error.message:'');
if(!vid) process.exit(0);
// 2) source mp4
const vu = new URL(`https://graph.facebook.com/${ver}/${vid}`);
vu.searchParams.set('fields','source,length'); vu.searchParams.set('access_token', token);
const vbody = await (await fetch(vu)).json();
console.log('length(seg):', vbody.length, vbody.error?('ERR '+vbody.error.message):'');
const src = vbody.source;
if(!src){ console.log('sin source'); process.exit(0); }
// 3) tamaño del mp4 (HEAD; si no, GET con Range 0-0)
let size = null;
try { const h = await fetch(src, { method:'HEAD' }); size = h.headers.get('content-length'); } catch {}
if(!size){ const g = await fetch(src, { headers:{ Range:'bytes=0-0' } }); size = (g.headers.get('content-range')||'').split('/')[1] || g.headers.get('content-length'); }
console.log('mp4 bytes:', size, size?`(~${(Number(size)/1048576).toFixed(1)} MB)`:'');
