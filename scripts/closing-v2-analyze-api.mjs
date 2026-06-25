// =============================================================================
// Closing v2 — ANALYZE vía API de Anthropic (fallback al workflow de agentes).
// Para las grabaciones que NO tienen aún _closing_work_out/<rid>.json: lee el
// .txt prepado, lo manda a Opus con el SYSTEM v2 y escribe el JSON de salida.
//   node scripts/closing-v2-analyze-api.mjs [--limit N]
// =============================================================================

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });

const KEY = process.env.ANTHROPIC_API_KEY;
const WORK = resolve(process.cwd(), 'scripts/_closing_work');
const OUT = resolve(process.cwd(), 'scripts/_closing_work_out');
const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i >= 0 ? Number(process.argv[i + 1]) : Infinity; })();

const SYSTEM = `Sos un analista experto en llamadas de VENTA CONSULTIVA. El cliente es Mauricio Bustos: vende un programa de mentoría/consultoría a dueños de negocio (metodología SPIN + manejo de objeciones + cierre). Te paso los metadatos + contexto del lead + resumen de Fathom + transcript completo de una llamada (con marcas [segundos · mm:ss]).

PASO 1 — CLASIFICÁ:
- "venta": vender el programa a un prospecto que TODAVÍA NO es cliente. tipo "R1" = diagnóstico/calificación; tipo "R2" = propuesta/cierre.
- "entrega_servicio": trabajo CON un cliente que YA compró (coaching, accountability, 4DX, OKRs, sprints, seguimiento). Aunque el título diga "Junta X" o "Primera sesión", si el contenido es ejecutar/acompañar, es servicio.
- "interna" / "otro": equipo, estrategia interna, demo, prueba.
Pistas: si el lead figura 'ganado' o con fecha de cierre/inicio de servicio ANTERIOR a esta llamada → casi seguro entrega_servicio. Si se negocia precio/condiciones y la persona aún decide contratar → venta.
Si el archivo dice "SIN TRANSCRIPT": has_transcript:false, clasificá por metadatos y NO inventes análisis.

PASO 2 — Si es "venta" y hay transcript, hacé un análisis PROFUNDO, específico y CITADO (nada genérico). Cada evidencia cita el transcript con su t_seconds real (el número de [Ns]).
Devolvés EXCLUSIVAMENTE este JSON (sin texto fuera del JSON):
{
  "recording_id": number,
  "es_venta": boolean,
  "categoria": "venta" | "entrega_servicio" | "interna" | "otro",
  "razon": string,
  "tipo": "R1" | "R2" | null,
  "has_transcript": boolean,
  "score": number,                  // de 0 a 10 con UNA décima (p.ej. 7.5). NUNCA escala 0-100.
  "outcome": string,
  "outcome_tone": "good" | "warn" | "bad",
  "summary": string,
  "next_step": string,
  "dims": [ { "g":"spin"|"exec", "label": string, "score": number, "note": string, "quote": string, "t_seconds": number } ],
  "strengths": [ { "title": string, "quote": string, "t_seconds": number, "note": string } ],
  "weaknesses": [ { "title": string, "quote": string, "t_seconds": number, "note": string } ],
  "objections": [ { "quote": string, "t_seconds": number, "handled": boolean, "note": string } ],
  "moments": [ { "t_seconds": number, "tone":"good"|"bad"|"neutral", "tag": string, "quote": string } ],
  "annotations": [ { "t_seconds": number, "tone":"good"|"bad", "label": string } ],
  "recs": [ string ]
}
TODOS los score (global y por dimensión) van de 0 a 10 con una décima (ej. 7.5), NUNCA de 0 a 100.
dims: 7 items (Situación, Problema, Implicación, Necesidad / beneficio, Presentación de la propuesta, Manejo de objeciones, CTA / siguientes pasos). strengths/weaknesses 2-4, moments 6-12, annotations 8-20, recs 3-5. Para entrega_servicio/interna/otro: completá categoria, razon, summary (1-2 frases), arrays vacíos y score null. Español rioplatense (voseo), concreto. Los t_seconds salen de los [Ns].`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function parseJson(text) {
  const c = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const s = c.indexOf('{'), e = c.lastIndexOf('}');
  if (s < 0 || e <= s) throw new Error('sin JSON');
  return JSON.parse(c.slice(s, e + 1));
}
async function claude(user, tries = 5) {
  for (let i = 0; i < tries; i++) {
    let r;
    try {
      r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 8000, system: SYSTEM, messages: [{ role: 'user', content: user }], output_config: { effort: 'high' }, thinking: { type: 'adaptive' } }),
        signal: AbortSignal.timeout(180000),
      });
    } catch (e) { await sleep(2000 * (i + 1)); continue; }
    if (r.status === 429 || r.status === 529 || r.status >= 500) { await sleep(3000 * (i + 1)); continue; }
    const b = await r.json();
    if (b.error) {
      if (/overloaded|rate/i.test(b.error.message || '')) { await sleep(3000 * (i + 1)); continue; }
      throw new Error(b.error.message);
    }
    return (b.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
  }
  throw new Error('agotados los reintentos');
}

async function main() {
  const rids = JSON.parse(readFileSync(resolve(process.cwd(), 'scripts/_closing_rids.json'), 'utf8'));
  const done = new Set(readdirSync(OUT).filter((f) => f.endsWith('.json')).map((f) => Number(f.replace('.json', ''))));
  let pending = rids.filter((r) => !done.has(r));
  if (Number.isFinite(LIMIT)) pending = pending.slice(0, LIMIT);
  console.log(`Pendientes de analizar: ${pending.length} (ya hechas: ${done.size})`);

  let ok = 0, err = 0, idx = 0;
  const CONC = 3;
  async function worker() {
    while (idx < pending.length) {
      const rid = pending[idx++];
      const txtPath = resolve(WORK, `${rid}.txt`);
      if (!existsSync(txtPath)) { console.log(`  [${rid}] sin .txt`); err++; continue; }
      try {
        const a = parseJson(await claude(readFileSync(txtPath, 'utf8')));
        if (!a.recording_id) a.recording_id = rid;
        writeFileSync(resolve(OUT, `${rid}.json`), JSON.stringify(a));
        ok++;
        console.log(`  [${ok + err}/${pending.length}] ${String(a.categoria).padEnd(16)} ${a.tipo || ''} score=${a.score ?? '-'} · ${rid}`);
      } catch (e) {
        err++;
        console.log(`  [${ok + err}/${pending.length}] ERROR ${rid} — ${e.message}`);
        if (/credit balance|billing/i.test(e.message)) { console.log('  ⛔ Sin créditos en la API — abortando.'); idx = pending.length; }
      }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  console.log(`\nListo: ${ok} analizadas · ${err} con error`);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
