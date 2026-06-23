import { resolve } from 'node:path'; import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });
const ver=process.env.META_API_VERSION, token=process.env.META_ACCESS_TOKEN, acct=process.env.META_AD_ACCOUNT_ID;
const ad='120240215335300570';
const u=new URL(`https://graph.facebook.com/${ver}/${ad}`);
u.searchParams.set('fields','creative{asset_feed_spec{images{url,hash,url_128},bodies{text},titles{text}},image_hash,object_story_id}');
u.searchParams.set('access_token',token);
const c=await (await fetch(u)).json();
const cr=c.creative||{};
const afs=cr.asset_feed_spec||{};
console.log('image_hash:', cr.image_hash);
console.log('asset_feed images:', JSON.stringify((afs.images||[]).map(i=>({hash:i.hash, url:(i.url||'').slice(0,90)})),null,1));
console.log('bodies:', (afs.bodies||[]).map(b=>b.text));
console.log('titles:', (afs.titles||[]).map(t=>t.text));
// Resolver hash → adimages (url full res)
const hashes=[...new Set([cr.image_hash, ...((afs.images||[]).map(i=>i.hash))].filter(Boolean))];
if(hashes.length){
  const iu=new URL(`https://graph.facebook.com/${ver}/${acct}/adimages`);
  iu.searchParams.set('hashes', JSON.stringify(hashes)); iu.searchParams.set('fields','hash,url,width,height'); iu.searchParams.set('access_token',token);
  const ib=await (await fetch(iu)).json();
  console.log('\nadimages:', JSON.stringify(ib.data||ib.error||ib,null,1));
  const url=ib.data?.[0]?.url;
  if(url){ const h=await fetch(url,{method:'HEAD'}); console.log('full img size:', h.headers.get('content-length'), h.headers.get('content-type')); }
}
