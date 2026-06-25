// =============================================================================
// Closing v2 — PREP: baja transcript+summary de cada llamada claude-clasificada
// y escribe un archivo de trabajo por grabación para los agentes de análisis.
// =============================================================================
// Secuencial + retry (el bug del v1 fue bajar transcripts en paralelo → rate
// limit → .catch([]) silencioso → Claude analizó vacío → score 0 falso). Acá
// vamos de a uno con backoff; si un transcript no se puede bajar, se marca
// has_transcript=false y NO se manda a analizar como venta con score 0.
//   node scripts/closing-v2-prep.mjs
// =============================================================================

import postgres from 'postgres';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });

const KEY = process.env.FATHOM_API_KEY;
const CONN = process.env.DATABASE_URL;
const OUT = resolve(process.cwd(), 'scripts/_closing_work');
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fathom(path, tries = 8) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch('https://api.fathom.ai/external/v1' + path, { headers: { 'X-Api-Key': KEY }, signal: AbortSignal.timeout(20000) });
      if (r.status === 429 || r.status >= 500) { await sleep(1200 * (i + 1)); continue; }
      if (!r.ok) return { _err: r.status };
      return r.json();
    } catch (e) { await sleep(1200 * (i + 1)); }
  }
  return { _err: 'timeout' };
}
// Idempotente: si ya hay work file CON transcript, no re-bajar.
function alreadyGood(rid) {
  const f = resolve(OUT, `${rid}.json`);
  if (!existsSync(f)) return false;
  try { return JSON.parse(readFileSync(f, 'utf8')).has_transcript === true; } catch { return false; }
}
const tokenFromShare = (u) => { const m = (u || '').match(/\/share\/([^/?]+)/); return m ? m[1] : null; };

async function main() {
  const sql = postgres(CONN, { ssl: 'require', max: 1 });
  const rows = await sql`
    select recording_id, title, call_date, duration_min, closer, lead_id, lead_nombre, lead_empresa, share_url, started_at
    from closing_analyses where origen_clasif='claude' order by call_date desc nulls last`;
  const leadIds = [...new Set(rows.map((r) => r.lead_id).filter(Boolean))];
  const leads = leadIds.length
    ? await sql`select id, estado_lead, fecha_junta_1, fecha_junta_2, fecha_cierre, fecha_inicio_servicio from leads where id in ${sql(leadIds)}`
    : [];
  const leadById = new Map(leads.map((l) => [Number(l.id), l]));
  console.log(`A preparar: ${rows.length} grabaciones`);

  let ok = 0, sinTr = 0, i = 0, skip = 0;
  for (const r of rows) {
    i++;
    if (alreadyGood(r.recording_id)) { skip++; ok++; continue; }
    await sleep(300); // gentil con el rate limit de Fathom
    const tr = await fathom(`/recordings/${r.recording_id}/transcript`);
    const su = await fathom(`/recordings/${r.recording_id}/summary`);
    const transcript = Array.isArray(tr.transcript) ? tr.transcript : [];
    const summary_md = su?.summary?.markdown_formatted || (su?.markdown_formatted) || null;
    const lc = r.lead_id ? leadById.get(Number(r.lead_id)) : null;
    const work = {
      recording_id: Number(r.recording_id),
      title: r.title,
      call_date: r.call_date ? new Date(r.call_date).toISOString().slice(0, 10) : null,
      duration_min: r.duration_min,
      closer: r.closer,
      share_url: r.share_url,
      embed_token: tokenFromShare(r.share_url),
      lead: lc ? {
        nombre: r.lead_nombre, empresa: r.lead_empresa, estado_lead: lc.estado_lead,
        fecha_junta_1: lc.fecha_junta_1, fecha_junta_2: lc.fecha_junta_2,
        fecha_cierre: lc.fecha_cierre, fecha_inicio_servicio: lc.fecha_inicio_servicio,
      } : (r.lead_nombre ? { nombre: r.lead_nombre, empresa: r.lead_empresa } : null),
      transcript_items: transcript.length,
      has_transcript: transcript.length > 0,
      transcript,
      summary_md,
    };
    writeFileSync(resolve(OUT, `${r.recording_id}.json`), JSON.stringify(work));
    if (transcript.length > 0) ok++; else { sinTr++; console.log(`  ⚠ sin transcript: ${r.recording_id} ${(r.title||'').slice(0,40)} (tr_err=${tr._err||'-'})`); }
    if (i % 20 === 0) console.log(`  ${i}/${rows.length} (con_transcript=${ok} sin=${sinTr})`);
  }
  console.log(`\nListo: ${ok} con transcript · ${sinTr} sin transcript · escritos en scripts/_closing_work/`);
  await sql.end();
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
