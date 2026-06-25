// =============================================================================
// Backfill del Closing Analyst — siembra closing_analyses desde Fathom
// =============================================================================
// Trae las llamadas históricas de Fathom, las matchea con los leads del CRM,
// clasifica venta vs entrega de servicio y analiza las de venta con Claude.
// Escribe directo a Postgres (DATABASE_URL), igual que el resto de los backfills.
//
// La lógica (regex de clasificación + SYSTEM prompt + parseo) es COPIA de
// lib/closing.ts — mantener en sync. El runtime canónico para el sync continuo
// es lib/closing.ts (/api/closing/sync + cron closing-sync).
//
// Uso:
//   node scripts/backfill-closing.mjs            # procesa TODAS las candidatas
//   node scripts/backfill-closing.mjs --limit 5  # solo 5 candidatas (prueba)
//   node scripts/backfill-closing.mjs --dry      # no escribe, solo reporta
//   node scripts/backfill-closing.mjs --force    # reanaliza aunque ya existan
// =============================================================================

import postgres from 'postgres';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });

const FATHOM = process.env.FATHOM_API_KEY;
const ANTHROPIC = process.env.ANTHROPIC_API_KEY;
const CONN = process.env.DATABASE_URL;
if (!FATHOM || !ANTHROPIC || !CONN) { console.error('Faltan FATHOM_API_KEY / ANTHROPIC_API_KEY / DATABASE_URL'); process.exit(1); }

const args = process.argv.slice(2);
const LIMIT = (() => { const i = args.indexOf('--limit'); return i >= 0 ? Number(args[i + 1]) : Infinity; })();
const DRY = args.includes('--dry');
const FORCE = args.includes('--force');

// ── Clasificación (copia de lib/closing.ts) ──
const INTERNAL_EMAILS = new Set(['martinkoncke@gmail.com', 'tejadomartin@gmail.com']);
const INTERNAL_DOMAINS = new Set(['elevate.com.mx']);
const RE_TEST = /\b(test call|fathom demo|prueba)\b|^test\b|impromptu (google meet|zoom) meeting/i;
const RE_SERVICIO = /^\s*servicio:|^\s*coaching:|paddock\s*&\s*pit|programa\s+via|sesiones\s+programa|reporte\s+semanal|scaling\s*up|mesa\s+de\s+trabajo/i;
const RE_VENTA = /\bpropuesta\b|diagn[oó]stico|calificaci[oó]n|primera\s+(junta|sesi[oó]n|llamada|reuni[oó]n)|junta\s*[12]\b|reuni[oó]n\s*[12]\b/i;
const isInternal = (e) => { e = (e || '').trim().toLowerCase(); return INTERNAL_EMAILS.has(e) || INTERNAL_DOMAINS.has(e.split('@')[1] || ''); };
const externals = (m) => (m.calendar_invitees || []).filter((i) => i.is_external && i.email).map((i) => i.email.trim().toLowerCase());
const title = (m) => (m.title || m.meeting_title || '').trim();
const durMin = (m) => (m.recording_start_time && m.recording_end_time) ? Math.round((new Date(m.recording_end_time) - new Date(m.recording_start_time)) / 60000) : null;
const startIso = (m) => m.recording_start_time || m.scheduled_start_time || null;
function preClassify(m) {
  const t = title(m), d = durMin(m), ext = externals(m).filter((e) => !isInternal(e));
  if (RE_TEST.test(t)) return 'test';
  if (d != null && d < 4) return 'test';
  if (RE_SERVICIO.test(t)) return 'entrega_servicio';
  if (ext.length > 0) return null;
  if (RE_VENTA.test(t)) return null;
  return 'interna';
}
function fechaTijuana(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Tijuana', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

// ── SYSTEM prompt (copia VERBATIM de lib/closing.ts) ──
const SYSTEM = `Sos MaKo, analista de cierres de Mauricio Bustos (consultoría/coaching ejecutivo que vende un programa de mentoría a dueños de negocio). Analizás grabaciones de reuniones para evaluar el desempeño del closer.

Tu primera tarea es CLASIFICAR la llamada. Distinguí con cuidado:

• VENTA — el objetivo es vender el programa a un prospecto que todavía NO es cliente:
  - R1 (Reunión 1 / diagnóstico / calificación): primera llamada. Se mapea la situación, se detecta el dolor, se califica fit (presupuesto, decisor, timing). Aún no se presenta precio formal (o recién al final).
  - R2 (Reunión 2 / propuesta / cierre): se presenta la propuesta y el precio, se manejan objeciones y se busca el cierre / primer pago.

• ENTREGA DE SERVICIO — NO es venta. Es trabajo CON un cliente que YA compró: sesiones de coaching/mentoría, accountability, 4DX, OKRs, tableros, planeación estratégica, sprints, seguimiento de compromisos, "Sesión 2/3/4", "Programa", etc. Aunque el título diga "Junta X", si el contenido es ejecutar/acompañar (no vender), es entrega de servicio.

• INTERNA / OTRO — reunión de equipo, estrategia interna, demo, prueba, o algo que no es ni venta ni entrega a un cliente.

Pistas fuertes:
- Si el lead ya está 'ganado' / tiene fecha de cierre o de inicio de servicio ANTERIOR a esta llamada → casi seguro es ENTREGA DE SERVICIO.
- Si se discute precio/propuesta/condiciones y la persona aún decide si contratar → VENTA.
- Si se ejecutan tareas, OKRs, métricas, accountability de un negocio ya en programa → ENTREGA DE SERVICIO.

Si es VENTA, además puntuás (0-10) estas dimensiones:
SPIN (g="spin"): "Situación", "Problema", "Implicación", "Necesidad / beneficio".
Ejecución (g="exec"): "Presentación de la propuesta", "Manejo de objeciones", "CTA / siguientes pasos".
En R1 puede no haber propuesta formal: puntuá esa dimensión por cómo encaminó hacia la R2.

Devolvés EXCLUSIVAMENTE un objeto JSON válido (sin texto fuera del JSON, sin markdown), con este esquema:
{
  "es_venta": boolean,
  "categoria": "venta" | "entrega_servicio" | "interna" | "otro",
  "razon": string,
  "tipo": "R1" | "R2" | null,
  "score": number,
  "outcome": string,
  "outcome_tone": "good" | "warn" | "bad",
  "summary": string,
  "dims": [ { "g": "spin"|"exec", "label": string, "score": number, "note": string } ],
  "moments": [ { "t": "MM:SS", "tone": "good"|"bad"|"neutral", "tag": string, "quote": string } ],
  "recs": [ string ]
}
Las notas, summary, tags, quotes y recs van en español rioplatense (voseo), concretas y sin relleno. Los timestamps deben salir del transcript.`;

// ── HTTP ──
const fathom = async (p, q = {}) => {
  const u = new URL('https://api.fathom.ai/external/v1' + p);
  for (const [k, v] of Object.entries(q)) if (v != null) u.searchParams.set(k, String(v));
  const r = await fetch(u, { headers: { 'X-Api-Key': FATHOM } });
  if (!r.ok) throw new Error('fathom ' + r.status + ' ' + p);
  return r.json();
};
const claude = async (user) => {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 8000, system: SYSTEM, messages: [{ role: 'user', content: user }], output_config: { effort: 'high' }, thinking: { type: 'adaptive' } }),
  });
  const b = await r.json();
  if (!r.ok || b.error) throw new Error(b?.error?.message || ('anthropic ' + r.status));
  return (b.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
};
function transcriptText(items, max = 16000) {
  if (!items) return '';
  let out = '', len = 0;
  for (const it of items) {
    const line = `[${it.timestamp || '00:00:00'}] ${it.speaker?.display_name || '—'}: ${(it.text || '').trim()}`;
    if (len + line.length > max) { out += '\n… (transcript recortado)'; break; }
    out += line + '\n'; len += line.length + 1;
  }
  return out;
}
function parseJson(text) {
  const c = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const s = c.indexOf('{'), e = c.lastIndexOf('}');
  if (s < 0 || e <= s) throw new Error('sin JSON');
  return JSON.parse(c.slice(s, e + 1));
}
const clampScore = (n) => { const v = Number(n); return Number.isFinite(v) ? Math.max(0, Math.min(10, Math.round(v * 10) / 10)) : 0; };
const normTone = (t) => (t === 'good' || t === 'bad' ? t : 'warn');

function userPrompt(m, lead) {
  const leadCtx = lead
    ? [`Nombre: ${lead.nombre}`, lead.empresa && `Empresa: ${lead.empresa}`, `Estado del lead: ${lead.estado_lead || 'desconocido'}`,
       lead.fecha_junta_1 && `Fecha Reunión 1: ${lead.fecha_junta_1}`, lead.fecha_junta_2 && `Fecha Reunión 2: ${lead.fecha_junta_2}`,
       lead.fecha_cierre && `Fecha de cierre (ya compró): ${lead.fecha_cierre}`, lead.fecha_inicio_servicio && `Inicio de servicio: ${lead.fecha_inicio_servicio}`].filter(Boolean).join('\n')
    : 'No hay lead matcheado en el CRM con este email.';
  return `## Metadatos de la llamada
Título: ${title(m)}
Fecha de la grabación: ${startIso(m)}
Duración: ${durMin(m)} min
Invitados externos: ${externals(m).join(', ') || '(ninguno)'}
Host (closer): ${m.recorded_by?.name || '?'}

## Contexto del lead en el CRM
${leadCtx}

## Resumen de Fathom
${m.default_summary?.markdown_formatted || '(sin resumen)'}

## Transcript (extracto, con timestamps)
${transcriptText(m.transcript) || '(sin transcript)'}

Analizá la llamada y devolvé el JSON pedido.`;
}

function deriveCloser(m, lead) { return (lead?.closer && lead.closer.trim()) || m.recorded_by?.name?.trim() || null; }
function primaryEmail(m, lead) {
  const ext = externals(m);
  if (lead?.email && ext.includes(lead.email.trim().toLowerCase())) return lead.email.trim().toLowerCase();
  return ext.find((e) => !isInternal(e)) || ext[0] || null;
}

function baseRow(m, lead) {
  const s = startIso(m);
  return {
    recording_id: m.recording_id, call_url: m.url || null, share_url: m.share_url || null, title: title(m) || null,
    call_date: fechaTijuana(s), started_at: s, duration_min: durMin(m), closer: deriveCloser(m, lead),
    invitee_email: primaryEmail(m, lead), lead_id: lead?.id ?? null, lead_nombre: lead?.nombre ?? null, lead_empresa: lead?.empresa ?? null,
  };
}

async function upsert(sql, row) {
  if (DRY) return;
  await sql`
    INSERT INTO closing_analyses (
      recording_id, call_url, share_url, title, call_date, started_at, duration_min, closer, invitee_email,
      lead_id, lead_nombre, lead_empresa, category, origen_clasif, tipo, score, outcome, outcome_tone, summary,
      dims, moments, recs, status, error, model, analyzed_at, updated_at
    ) VALUES (
      ${row.recording_id}, ${row.call_url}, ${row.share_url}, ${row.title}, ${row.call_date}, ${row.started_at},
      ${row.duration_min}, ${row.closer}, ${row.invitee_email}, ${row.lead_id}, ${row.lead_nombre}, ${row.lead_empresa},
      ${row.category}, ${row.origen_clasif}, ${row.tipo}, ${row.score}, ${row.outcome}, ${row.outcome_tone}, ${row.summary},
      ${row.dims == null ? null : sql.json(row.dims)}, ${row.moments == null ? null : sql.json(row.moments)},
      ${row.recs == null ? null : sql.json(row.recs)}, ${row.status}, ${row.error}, ${row.model}, ${row.analyzed_at}, now()
    )
    ON CONFLICT (recording_id) DO UPDATE SET
      call_url = EXCLUDED.call_url, share_url = EXCLUDED.share_url, title = EXCLUDED.title, call_date = EXCLUDED.call_date,
      started_at = EXCLUDED.started_at, duration_min = EXCLUDED.duration_min, closer = EXCLUDED.closer, invitee_email = EXCLUDED.invitee_email,
      lead_id = EXCLUDED.lead_id, lead_nombre = EXCLUDED.lead_nombre, lead_empresa = EXCLUDED.lead_empresa, category = EXCLUDED.category,
      origen_clasif = EXCLUDED.origen_clasif, tipo = EXCLUDED.tipo, score = EXCLUDED.score, outcome = EXCLUDED.outcome,
      outcome_tone = EXCLUDED.outcome_tone, summary = EXCLUDED.summary, dims = EXCLUDED.dims, moments = EXCLUDED.moments,
      recs = EXCLUDED.recs, status = EXCLUDED.status, error = EXCLUDED.error, model = EXCLUDED.model, analyzed_at = EXCLUDED.analyzed_at, updated_at = now()
  `;
}

function analyzedRow(m, lead, a) {
  const esVenta = a.es_venta === true && a.categoria === 'venta';
  const category = esVenta ? 'venta' : a.categoria === 'entrega_servicio' ? 'entrega_servicio' : a.categoria === 'interna' ? 'interna' : 'sin_clasificar';
  const dims = Array.isArray(a.dims) ? a.dims.filter((d) => d && (d.g === 'spin' || d.g === 'exec') && d.label).map((d) => ({ g: d.g, label: String(d.label), score: clampScore(d.score), note: String(d.note || '') })) : [];
  const moments = Array.isArray(a.moments) ? a.moments.filter((mo) => mo && mo.quote).map((mo) => ({ t: String(mo.t || ''), tone: (mo.tone === 'good' || mo.tone === 'bad' ? mo.tone : 'neutral'), tag: String(mo.tag || ''), quote: String(mo.quote || '') })) : [];
  const recs = Array.isArray(a.recs) ? a.recs.map(String).filter(Boolean) : [];
  return {
    ...baseRow(m, lead), category, origen_clasif: 'claude',
    tipo: esVenta ? (a.tipo === 'R1' || a.tipo === 'R2' ? a.tipo : 'R1') : null,
    score: esVenta ? clampScore(a.score) : null, outcome: esVenta ? (a.outcome || 'Sin definir') : null,
    outcome_tone: esVenta ? normTone(a.outcome_tone) : null, summary: a.summary || null,
    dims: esVenta ? dims : null, moments: esVenta ? moments : null, recs: esVenta ? recs : null,
    status: esVenta ? 'analizada' : 'descartada', error: null, model: 'claude-opus-4-8', analyzed_at: new Date().toISOString(),
  };
}

async function main() {
  const sql = postgres(CONN, { ssl: 'require', connect_timeout: 15, max: 6 });
  try {
    const [{ n }] = await sql`select count(*)::int as n from leads`;
    console.log(`Proyecto OK — leads=${n}`);

    // leads → map por email
    const leads = await sql`select id, nombre, empresa, email, closer, estado_lead, fecha_junta_1, fecha_junta_2, fecha_cierre, fecha_inicio_servicio from leads where email is not null`;
    const byEmail = new Map();
    for (const l of leads) { const e = (l.email || '').trim().toLowerCase(); if (e && !byEmail.has(e)) byEmail.set(e, l); }
    console.log(`Leads con email: ${byEmail.size}`);

    // ya procesadas
    const doneRows = FORCE ? [] : await sql`select recording_id from closing_analyses where status <> 'error'`;
    const done = new Set(doneRows.map((r) => Number(r.recording_id)));

    // fathom meetings (metadata)
    let all = [], cursor = null, pages = 0;
    do { const d = await fathom('/meetings', { limit: 50, cursor: cursor || undefined }); all.push(...d.items); cursor = d.next_cursor; pages++; } while (cursor && pages < 30);
    console.log(`Fathom meetings: ${all.length}`);

    const matchLead = (m) => { for (const e of externals(m)) { const l = byEmail.get(e); if (l) return l; } return null; };

    let descartadas = 0, candidatas = 0, ventas = 0, servicio = 0, errores = 0, analizadas = 0;
    const pend = [];
    for (const m of all) {
      if (!m.recording_id) continue;
      if (done.has(Number(m.recording_id))) continue;
      const cat = preClassify(m);
      if (cat !== null) {
        const lead = matchLead(m);
        await upsert(sql, { ...baseRow(m, lead), category: cat, origen_clasif: 'heuristica', tipo: null, score: null, outcome: null, outcome_tone: null, summary: null, dims: null, moments: null, recs: null, status: 'descartada', error: null, model: null, analyzed_at: null });
        descartadas++; if (cat === 'entrega_servicio') servicio++;
      } else pend.push(m);
    }
    candidatas = pend.length;
    // Priorizar títulos con señal fuerte de venta (propuesta/diagnóstico/etc.) y
    // los que matchean un lead — así un drenado parcial llena primero lo que más
    // importa (las llamadas de venta).
    pend.sort((a, b) => {
      const sa = (RE_VENTA.test(title(a)) ? 2 : 0) + (matchLead(a) ? 1 : 0);
      const sb = (RE_VENTA.test(title(b)) ? 2 : 0) + (matchLead(b) ? 1 : 0);
      return sb - sa;
    });
    console.log(`Triage: ${descartadas} descartadas por heurística · ${candidatas} candidatas a venta`);

    const toProcess = pend.slice(0, Number.isFinite(LIMIT) ? LIMIT : pend.length);
    if (toProcess.length < candidatas) console.log(`(procesando ${toProcess.length} de ${candidatas} candidatas; quedan ${candidatas - toProcess.length})`);
    const CONC = 4;
    let idx = 0, hechas = 0;
    async function worker() {
      while (idx < toProcess.length) {
        const m = toProcess[idx++];
        const lead = matchLead(m);
        try {
          const [tr, su] = await Promise.all([
            fathom(`/recordings/${m.recording_id}/transcript`).then((r) => r.transcript || []).catch(() => []),
            fathom(`/recordings/${m.recording_id}/summary`).then((r) => r.summary || null).catch(() => null),
          ]);
          const full = { ...m, transcript: tr, default_summary: su };
          const a = parseJson(await claude(userPrompt(full, lead)));
          const row = analyzedRow(full, lead, a);
          await upsert(sql, row);
          analizadas++; if (row.category === 'venta') ventas++; else servicio++;
          console.log(`  [${++hechas}/${toProcess.length}] ${row.category.padEnd(16)} ${row.tipo || '  '} ${fmt(row.score)} · ${title(m).slice(0, 44)}`);
        } catch (e) {
          errores++;
          await upsert(sql, { ...baseRow(m, lead), category: 'sin_clasificar', origen_clasif: 'claude', tipo: null, score: null, outcome: null, outcome_tone: null, summary: null, dims: null, moments: null, recs: null, status: 'error', error: String(e.message || e), model: 'claude-opus-4-8', analyzed_at: null });
          console.log(`  [${++hechas}/${toProcess.length}] ERROR · ${title(m).slice(0, 44)} — ${e.message}`);
        }
      }
    }
    await Promise.all(Array.from({ length: CONC }, worker));
    console.log(`\nResumen: ventas=${ventas} servicio=${servicio} errores=${errores} analizadas=${analizadas} descartadas=${descartadas}${DRY ? ' (DRY: nada escrito)' : ''}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
const fmt = (s) => (s == null ? '   ' : String(s).padStart(3));
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
