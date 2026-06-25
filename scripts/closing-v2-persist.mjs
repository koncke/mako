// =============================================================================
// Closing v2 — PERSIST: vuelca los análisis de los agentes a closing_analyses.
// Lee scripts/_closing_work_out/<rid>.json (análisis) + scripts/_closing_work/
// <rid>.json (has_transcript / transcript_items / embed_token) y hace upsert.
//   node scripts/closing-v2-persist.mjs [--dry]
// =============================================================================

import postgres from 'postgres';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });

const DRY = process.argv.includes('--dry');
const WORK = resolve(process.cwd(), 'scripts/_closing_work');
const OUT = resolve(process.cwd(), 'scripts/_closing_work_out');

const clamp = (n) => { let v = Number(n); if (!Number.isFinite(v)) return null; if (v > 10) v = v / 10; return Math.max(0, Math.min(10, Math.round(v * 10) / 10)); };
const tone = (t) => (t === 'good' || t === 'bad' ? t : 'warn');
const mtone = (t) => (t === 'good' || t === 'bad' ? t : 'neutral');
const sec = (n) => { const v = Math.round(Number(n)); return Number.isFinite(v) && v >= 0 ? v : 0; };
const arr = (x) => (Array.isArray(x) ? x : []);
const str = (x) => (x == null ? '' : String(x));

// Canonicaliza los 7 labels de dimensión (algunos análisis vienen sin acentos).
const CANON = {
  'situacion': 'Situación', 'problema': 'Problema', 'implicacion': 'Implicación',
  'necesidad / beneficio': 'Necesidad / beneficio', 'necesidad/beneficio': 'Necesidad / beneficio',
  'presentacion de la propuesta': 'Presentación de la propuesta',
  'manejo de objeciones': 'Manejo de objeciones',
  'cta / siguientes pasos': 'CTA / siguientes pasos', 'cta/siguientes pasos': 'CTA / siguientes pasos',
};
const canonLabel = (s) => {
  const k = str(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return CANON[k] || str(s);
};

function clean(a) {
  const dims = arr(a.dims).filter((d) => d && (d.g === 'spin' || d.g === 'exec') && d.label)
    .map((d) => ({ g: d.g, label: canonLabel(d.label), score: clamp(d.score) ?? 0, note: str(d.note), quote: str(d.quote), t_seconds: sec(d.t_seconds) }));
  const moments = arr(a.moments).filter((m) => m && m.quote)
    .map((m) => ({ t_seconds: sec(m.t_seconds), t: mmss(sec(m.t_seconds)), tone: mtone(m.tone), tag: str(m.tag), quote: str(m.quote) }))
    .sort((x, y) => x.t_seconds - y.t_seconds);
  const ev = (x) => ({ title: str(x.title), quote: str(x.quote), t_seconds: sec(x.t_seconds), note: str(x.note) });
  const strengths = arr(a.strengths).filter((x) => x && (x.title || x.quote)).map(ev);
  const weaknesses = arr(a.weaknesses).filter((x) => x && (x.title || x.quote)).map(ev);
  const objections = arr(a.objections).filter((x) => x && x.quote)
    .map((x) => ({ quote: str(x.quote), t_seconds: sec(x.t_seconds), handled: !!x.handled, note: str(x.note) }))
    .sort((x, y) => x.t_seconds - y.t_seconds);
  const annotations = arr(a.annotations).filter((x) => x && Number.isFinite(Number(x.t_seconds)))
    .map((x) => ({ t_seconds: sec(x.t_seconds), tone: x.tone === 'bad' ? 'bad' : 'good', label: str(x.label) }))
    .sort((x, y) => x.t_seconds - y.t_seconds);
  const recs = arr(a.recs).map(str).filter(Boolean);
  return { dims, moments, strengths, weaknesses, objections, annotations, recs };
}
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 6 });
  const files = existsSync(OUT) ? readdirSync(OUT).filter((f) => f.endsWith('.json')) : [];
  console.log(`Análisis a persistir: ${files.length}`);
  let venta = 0, servicio = 0, otras = 0, pendientes = 0, errs = 0;

  for (const f of files) {
    let a, w = {};
    try { a = JSON.parse(readFileSync(resolve(OUT, f), 'utf8')); } catch (e) { console.log('  parse err', f, e.message); errs++; continue; }
    const rid = Number(a.recording_id) || Number(f.replace('.json', ''));
    const wf = resolve(WORK, `${rid}.json`);
    if (existsSync(wf)) { try { w = JSON.parse(readFileSync(wf, 'utf8')); } catch { /* */ } }

    const hasTr = a.has_transcript !== false && (w.has_transcript !== false);
    const esVenta = a.es_venta === true && a.categoria === 'venta';
    const category = esVenta ? 'venta' : a.categoria === 'entrega_servicio' ? 'entrega_servicio' : a.categoria === 'interna' ? 'interna' : 'sin_clasificar';
    const c = clean(a);
    const status = esVenta ? (hasTr ? 'analizada' : 'pendiente') : 'descartada';
    if (esVenta && hasTr) venta++; else if (category === 'entrega_servicio') servicio++; else if (esVenta && !hasTr) pendientes++; else otras++;

    const row = {
      recording_id: rid,
      category, origen_clasif: 'claude_v2', analysis_version: 2,
      tipo: esVenta ? (a.tipo === 'R1' || a.tipo === 'R2' ? a.tipo : null) : null,
      score: esVenta && hasTr ? clamp(a.score) : null,
      outcome: esVenta ? str(a.outcome) || 'Sin definir' : null,
      outcome_tone: esVenta ? tone(a.outcome_tone) : null,
      summary: str(a.summary) || null,
      next_step: esVenta ? (str(a.next_step) || null) : null,
      dims: esVenta ? c.dims : null,
      moments: esVenta ? c.moments : null,
      recs: esVenta ? c.recs : null,
      strengths: esVenta ? c.strengths : null,
      weaknesses: esVenta ? c.weaknesses : null,
      objections: esVenta ? c.objections : null,
      annotations: esVenta ? c.annotations : null,
      has_transcript: hasTr,
      transcript_items: Number(w.transcript_items) || null,
      embed_token: w.embed_token || null,
      status,
      analyzed_at: new Date().toISOString(),
      model: 'claude-code-workflow',
    };
    if (DRY) { console.log(`  [dry] ${rid} ${category} ${row.tipo || ''} score=${row.score ?? '-'} hasTr=${hasTr}`); continue; }
    try {
      await sql`
        update closing_analyses set
          category=${row.category}, origen_clasif=${row.origen_clasif}, analysis_version=${row.analysis_version},
          tipo=${row.tipo}, score=${row.score}, outcome=${row.outcome}, outcome_tone=${row.outcome_tone},
          summary=${row.summary}, next_step=${row.next_step},
          dims=${row.dims == null ? null : sql.json(row.dims)}, moments=${row.moments == null ? null : sql.json(row.moments)},
          recs=${row.recs == null ? null : sql.json(row.recs)}, strengths=${row.strengths == null ? null : sql.json(row.strengths)},
          weaknesses=${row.weaknesses == null ? null : sql.json(row.weaknesses)}, objections=${row.objections == null ? null : sql.json(row.objections)},
          annotations=${row.annotations == null ? null : sql.json(row.annotations)},
          has_transcript=${row.has_transcript}, transcript_items=${row.transcript_items}, embed_token=${row.embed_token},
          status=${row.status}, analyzed_at=${row.analyzed_at}, model=${row.model}, error=null, updated_at=now()
        where recording_id=${rid}`;
    } catch (e) { console.log('  upsert err', rid, e.message); errs++; }
  }
  console.log(`\nPersistido: venta=${venta} servicio=${servicio} otras=${otras} pendientes_sin_transcript=${pendientes} errores=${errs}${DRY ? ' (DRY)' : ''}`);
  await sql.end();
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
