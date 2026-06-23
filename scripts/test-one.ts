import { config } from 'dotenv'; import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });
import { transcribeAd } from '../lib/transcribe';
async function main(){
  const r = await transcribeAd('120240215335300570');
  console.log('status:', r.status, '| tipo:', r.tipo, '| model:', r.model);
  console.log('transcript:', (r.transcript||'').slice(0,300));
  console.log('secciones:', (r.secciones||[]).map(s=>s.titulo).join(' | '));
}
main();
