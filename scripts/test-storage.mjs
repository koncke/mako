import { resolve } from 'node:path'; import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });
import { createClient } from '@supabase/supabase-js';
// Reusar las env que usa getSupabaseServer
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY;
console.log('url?', !!url, 'key?', !!key);
if(!url||!key){ console.log('Faltan SUPABASE_URL / SERVICE_ROLE en .env.local — el server las toma de Vercel.'); process.exit(0); }
const sb = createClient(url, key);
const path = `test/${Date.now()}.txt`;
const up = await sb.storage.from('contratos').upload(path, Buffer.from('hola contrato'), { contentType:'text/plain', upsert:true });
console.log('upload:', up.error?up.error.message:'ok');
const su = await sb.storage.from('contratos').createSignedUrl(path, 60);
console.log('signed:', su.error?su.error.message:su.data.signedUrl.slice(0,80)+'…');
await sb.storage.from('contratos').remove([path]);
console.log('cleanup ok');
