import { resolve } from 'node:path'; import { config } from 'dotenv'; import postgres from 'postgres';
config({ path: resolve(process.cwd(), '.env.local') });
const ver=process.env.META_API_VERSION, token=process.env.META_ACCESS_TOKEN;
const ad='120240215335300570';
const sql=postgres(process.env.DATABASE_URL,{ssl:'require',max:1});
const [r]=await sql`SELECT ad_name, ad_thumbnail_url, ad_permalink FROM marketing_metrics_daily WHERE plataforma='meta' AND ad_id=${ad} AND ad_thumbnail_url IS NOT NULL ORDER BY fecha DESC LIMIT 1`;
console.log('ad_name:', r?.ad_name);
console.log('thumbnail_url (DB):', (r?.ad_thumbnail_url||'').slice(0,110));
console.log('permalink:', r?.ad_permalink);
await sql.end();
// creative completo
const u=new URL(`https://graph.facebook.com/${ver}/${ad}`);
u.searchParams.set('fields','name,creative{id,name,image_url,thumbnail_url,object_story_spec{video_data{video_id},link_data{picture,message,name},photo_data{url}},asset_feed_spec{images{url},bodies{text},titles{text}}}');
u.searchParams.set('access_token',token);
const c=await (await fetch(u)).json();
if(c.error){console.log('ERR',c.error.message);process.exit()}
const cr=c.creative||{};
console.log('\ncreative.name:', cr.name);
console.log('image_url:', (cr.image_url||'—').slice(0,110));
console.log('link_data.picture:', (cr.object_story_spec?.link_data?.picture||'—').slice(0,110));
console.log('link_data.message:', cr.object_story_spec?.link_data?.message);
console.log('photo_data.url:', (cr.object_story_spec?.photo_data?.url||'—').slice(0,110));
// tamaño de la imagen que usamos (thumbnail DB)
if(r?.ad_thumbnail_url){ const h=await fetch(r.ad_thumbnail_url,{method:'HEAD'}); console.log('\nthumbnail size:', h.headers.get('content-length'), h.headers.get('content-type')); }
