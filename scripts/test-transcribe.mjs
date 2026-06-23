import { resolve } from 'node:path'; import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });
const ver = process.env.META_API_VERSION, token = process.env.META_ACCESS_TOKEN, oai = process.env.OPENAI_API_KEY;
const ad = '120237960510320570';
// video_id + source
const cu = new URL(`https://graph.facebook.com/${ver}/${ad}`);
cu.searchParams.set('fields','creative{object_story_spec{video_data{video_id}},video_id}'); cu.searchParams.set('access_token', token);
const c = await (await fetch(cu)).json();
const vid = c?.creative?.object_story_spec?.video_data?.video_id || c?.creative?.video_id;
const vu = new URL(`https://graph.facebook.com/${ver}/${vid}`); vu.searchParams.set('fields','source'); vu.searchParams.set('access_token', token);
const src = (await (await fetch(vu)).json()).source;
console.log('descargando mp4…');
const buf = Buffer.from(await (await fetch(src)).arrayBuffer());
console.log('mp4 MB:', (buf.length/1048576).toFixed(1));
const form = new FormData();
form.append('file', new Blob([buf], { type:'video/mp4' }), 'ad.mp4');
form.append('model','whisper-1');
form.append('response_format','verbose_json');
console.log('transcribiendo con OpenAI…');
const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method:'POST', headers:{ Authorization:`Bearer ${oai}` }, body: form });
const j = await r.json();
if (j.error) { console.log('OPENAI ERROR:', j.error.message); process.exit(1); }
console.log('idioma:', j.language, '| duracion:', j.duration);
console.log('TRANSCRIPT (primeros 400):\n', (j.text||'').slice(0,400));
