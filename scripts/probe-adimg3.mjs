import { resolve } from 'node:path'; import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });
const ver=process.env.META_API_VERSION, token=process.env.META_ACCESS_TOKEN;
const ad='120240215335300570';
const u=new URL(`https://graph.facebook.com/${ver}/${ad}`);
u.searchParams.set('fields','creative{effective_object_story_id,object_story_id,thumbnail_url}');
u.searchParams.set('thumbnail_width','1920'); u.searchParams.set('thumbnail_height','1920');
u.searchParams.set('access_token',token);
const c=await (await fetch(u)).json();
const cr=c.creative||{};
const story=cr.effective_object_story_id||cr.object_story_id;
console.log('story_id:', story);
console.log('thumbnail_url@1920:', (cr.thumbnail_url||'').slice(0,100));
if(cr.thumbnail_url){const h=await fetch(cr.thumbnail_url,{method:'HEAD'});console.log('  thumb@1920 size:',h.headers.get('content-length'));}
if(story){
  const su=new URL(`https://graph.facebook.com/${ver}/${story}`);
  su.searchParams.set('fields','full_picture,message,attachments{media,subattachments}'); su.searchParams.set('access_token',token);
  const sb=await (await fetch(su)).json();
  if(sb.error){console.log('story ERR',sb.error.message)}
  else{
    console.log('full_picture:', (sb.full_picture||'—').slice(0,100));
    if(sb.full_picture){const h=await fetch(sb.full_picture,{method:'HEAD'});console.log('  full_picture size:',h.headers.get('content-length'),h.headers.get('content-type'));}
    const media=sb.attachments?.data?.[0]?.media?.image?.src;
    console.log('attachment media src:', (media||'—').slice(0,100));
    if(media){const h=await fetch(media,{method:'HEAD'});console.log('  media size:',h.headers.get('content-length'));}
  }
}
