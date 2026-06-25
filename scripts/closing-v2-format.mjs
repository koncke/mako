// =============================================================================
// Closing v2 — FORMAT: convierte cada _closing_work/<rid>.json en un <rid>.txt
// legible para que el agente de análisis lo lea con la tool Read.
// =============================================================================
// El .txt trae: metadatos + contexto del lead + resumen de Fathom + transcript
// completo con timestamp Y segundos precomputados ([1234s · MM:SS]), para que el
// agente referencie t_seconds exactos (deep-link al clip en el player embebido).
//   node scripts/closing-v2-format.mjs
// =============================================================================

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIR = resolve(process.cwd(), 'scripts/_closing_work');

function toSeconds(ts) {
  if (!ts) return 0;
  const p = String(ts).split(':').map(Number);
  if (p.some((n) => Number.isNaN(n))) return 0;
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  if (p.length === 2) return p[0] * 60 + p[1];
  return p[0] || 0;
}
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const files = readdirSync(DIR).filter((f) => f.endsWith('.json') && !f.endsWith('.out.json'));
let n = 0;
for (const f of files) {
  const w = JSON.parse(readFileSync(resolve(DIR, f), 'utf8'));
  const L = [];
  L.push(`# Llamada: ${w.title || '(sin título)'}`);
  L.push(`recording_id: ${w.recording_id}`);
  L.push(`Fecha: ${w.call_date || '?'} · Duración: ${w.duration_min ?? '?'} min · Closer/host: ${w.closer || '?'}`);
  L.push(`Transcript: ${w.transcript_items} líneas${w.has_transcript ? '' : ' (⚠ SIN TRANSCRIPT)'}`);
  L.push('');
  L.push('## Contexto del lead (CRM)');
  if (w.lead) {
    L.push(`Nombre: ${w.lead.nombre || '?'}${w.lead.empresa ? ' · ' + w.lead.empresa : ''}`);
    if (w.lead.estado_lead) L.push(`Estado del lead: ${w.lead.estado_lead}`);
    if (w.lead.fecha_junta_1) L.push(`Fecha Reunión 1 agendada: ${w.lead.fecha_junta_1}`);
    if (w.lead.fecha_junta_2) L.push(`Fecha Reunión 2 agendada: ${w.lead.fecha_junta_2}`);
    if (w.lead.fecha_cierre) L.push(`Fecha de cierre (YA compró): ${w.lead.fecha_cierre}`);
    if (w.lead.fecha_inicio_servicio) L.push(`Inicio de servicio: ${w.lead.fecha_inicio_servicio}`);
  } else {
    L.push('Sin lead matcheado en el CRM con este email.');
  }
  L.push('');
  L.push('## Resumen de Fathom');
  L.push(w.summary_md || '(sin resumen)');
  L.push('');
  L.push('## Transcript completo  [segundos · mm:ss] Hablante: texto');
  if (w.has_transcript) {
    for (const it of w.transcript) {
      const s = toSeconds(it.timestamp);
      const sp = it.speaker?.display_name || '—';
      const tx = (it.text || '').trim();
      if (tx) L.push(`[${s}s · ${mmss(s)}] ${sp}: ${tx}`);
    }
  } else {
    L.push('(NO HAY TRANSCRIPT — no inventes análisis; marcá has_transcript=false)');
  }
  writeFileSync(resolve(DIR, `${w.recording_id}.txt`), L.join('\n'));
  n++;
}
console.log(`Formateados ${n} transcripts → scripts/_closing_work/<rid>.txt`);
