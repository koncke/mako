import { resolve } from 'node:path'; import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });
const ver=process.env.META_API_VERSION, token=process.env.META_ACCESS_TOKEN;
const story='282881742134130_1422093616598283';
const su=new URL(`https://graph.facebook.com/${ver}/${story}`);
su.searchParams.set('fields','full_picture'); su.searchParams.set('access_token',token);
const fp=(await (await fetch(su)).json()).full_picture;
console.log('full_picture:', fp.slice(0,140));
// GET directo del proxy
const g=await fetch(fp); const b=Buffer.from(await g.arrayBuffer());
console.log('GET full_picture →', g.status, g.headers.get('content-type'), b.length, 'bytes');
// decodificar ?url=
const real=new URL(fp).searchParams.get('url');
console.log('url= real:', (real||'—').slice(0,140));
if(real){ const g2=await fetch(real); const b2=Buffer.from(await g2.arrayBuffer()); console.log('GET real →', g2.status, g2.headers.get('content-type'), b2.length, 'bytes'); }
