// =============================================================================
// Backfill de Scripts Analyst — analiza TODOS los guiones de video de una corrida
// =============================================================================
// Conexión directa a Postgres (DATABASE_URL) + API de Anthropic. Replica la
// lógica de lib/script-analyst.ts (mismo prompt, vocab, sanitizeBeats y forma de
// fila) porque la lib persiste vía supabase-js, que en local no tiene claves.
// Secuencial con reintentos (evita rate-limit). Salta los ya 'analizada' salvo
// --force. Imágenes y sin-transcript → 'descartada'.
//
// Uso:
//   node scripts/backfill-script-analyst.mjs            # analiza los pendientes
//   node scripts/backfill-script-analyst.mjs --force    # re-analiza todos
//   node scripts/backfill-script-analyst.mjs --limit 10
// =============================================================================

import postgres from 'postgres';
import { resolve } from 'node:path';
import { config } from 'dotenv';

config({ path: resolve(process.cwd(), '.env.local') });

const FORCE = process.argv.includes('--force');
const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i >= 0 ? Number(process.argv[i + 1]) : Infinity; })();

const conn = process.env.DATABASE_URL;
const KEY = process.env.ANTHROPIC_API_KEY;
if (!conn) { console.error('Falta DATABASE_URL en .env.local'); process.exit(1); }
if (!KEY) { console.error('Falta ANTHROPIC_API_KEY en .env.local'); process.exit(1); }

const MODEL = 'claude-opus-4-8';
const ANGLES = ['visionario', 'capataz', 'dolor', 'testimonio', 'oferta'];
const HOOK_TYPES = ['promesa', 'testimonio', 'pregunta', 'dolor', 'resultado', 'recordatorio'];
const BEAT_KINDS = ['gancho', 'contexto', 'problema', 'mecanismo', 'prueba', 'objecion', 'recordatorio', 'oferta', 'cta'];
const TAG_VOCAB = ['sistema', 'sin-frio', 'caso-exito', 'dashboard', 'testimonio', 'pregunta-hook', 'cifra-hook', 'dolor', 'cupos', 'recordatorio', 'implementacion'];

const SYSTEM = `Sos MaKo, analista de guiones publicitarios de Mauricio Bustos (consultoría/coaching ejecutivo que le vende un programa de mentoría a dueños de negocio mediante video ads en Meta). Te paso el TRANSCRIPT de un video ad y tenés que leer el GUION y devolver su anatomía.

NO tenés métricas de performance: no inventes números de spend, hook rate ni retención. Tu trabajo es puramente sobre el guion: clasificarlo, partirlo en bloques y diagnosticar su ESTRUCTURA (qué promete el gancho, si el cuerpo cumple, dónde probablemente se aburre la audiencia, si el CTA cierra). El dashboard le pone los números al lado.

Clasificá con estos vocabularios CERRADOS (elegí exactamente uno donde corresponda):

• angle (el ángulo del mensaje):
  - visionario: pinta el futuro/transformación, "esto es lo que pasa cuando…".
  - capataz: directo, instructivo, "te implemento / te explico cómo".
  - dolor: arranca por el problema/fricción ("otra mañana persiguiendo leads…").
  - testimonio: cliente o dueño contando su experiencia en primera persona.
  - oferta: foco en la oferta/urgencia/cupos (retargeting tibio).

• hook_type (qué hace el PRIMER bloque para frenar el scroll):
  - promesa, testimonio, pregunta, dolor, resultado (abre con una cifra concreta), recordatorio.

• tags (0 a 5, SOLO de esta lista, las que apliquen de verdad):
  sistema, sin-frio, caso-exito, dashboard, testimonio, pregunta-hook, cifra-hook, dolor, cupos, recordatorio, implementacion.
  ("dashboard" = menciona o muestra un panel/tablero; "implementacion" = muestra cómo se implementa/el setup; "cifra-hook" = abre con un número; "pregunta-hook" = abre con una pregunta; "sin-frio" = promete dejar de prospectar en frío; "cupos" = urgencia por lugares).

• beats: partí el guion en 3 a 7 bloques EN ORDEN. Cada bloque:
  - kind: gancho | contexto | problema | mecanismo | prueba | objecion | recordatorio | oferta | cta.
  - t0: segundo estimado de inicio (entero). El primero SIEMPRE 0; estrictamente creciente; basate en el ritmo de lectura (~2.5 palabras/seg en español). Que el último t0 sea menor que la duración del video.
  - text: la línea/idea del guion, parafraseada corta y fiel (podés citar el original).

format: describí el formato del creativo en 2-4 palabras (ej. "UGC · talking head", "Testimonio en cámara", "Screen-recording", "B-roll + voz en off"). Inferilo del transcript/tipo.
short: etiqueta de 1 a 3 palabras para identificarlo en tablas/mapa (ej. "Hook pregunta", "Caso Indubel", "Demo panel").
note.title: 4-7 palabras, el veredicto estructural (ej. "Gran gancho, cuerpo que no paga").
note.text: 2-4 frases, concreto y sin relleno: qué hace bien el guion y dónde está su freno estructural. NADA de cifras de spend/retención (esas las muestra el dashboard).
suggestion: si el problema está en la ENTRADA (gancho flojo), proponé un gancho nuevo para probar (1 frase, en voz del anuncio). Si el gancho ya funciona, devolvé null.

Devolvé EXCLUSIVAMENTE un objeto JSON válido (sin texto fuera del JSON, sin markdown), con este esquema:
{
  "angle": "visionario|capataz|dolor|testimonio|oferta",
  "hook_type": "promesa|testimonio|pregunta|dolor|resultado|recordatorio",
  "format": string,
  "short": string,
  "tags": [string],
  "beats": [ { "kind": string, "t0": number, "text": string } ],
  "note": { "title": string, "text": string },
  "suggestion": string | null
}
Todo en español rioplatense (voseo), concreto. Si el transcript es muy pobre o no parece un guion de video (ej. solo una imagen con texto), devolvé igual la mejor clasificación posible y beats mínimos.`;

const oneOf = (v, allowed, fb) => (typeof v === 'string' && allowed.includes(v) ? v : fb);

function buildUserPrompt(t) {
  const secciones = Array.isArray(t.secciones) && t.secciones.length
    ? t.secciones.map((s) => `[${s.titulo ?? 'Sección'}] ${s.texto ?? ''}`).join('\n')
    : '';
  const cuerpo = secciones || (t.transcript ?? '(sin transcript)');
  return `## Anuncio
Nombre: ${t.ad_name ?? '(sin nombre)'}
Tipo de creativo: ${t.tipo ?? 'video'}
Idioma: ${t.idioma ?? 'es'}
Duración del video: ${t.duracion_s != null ? `${Math.round(t.duracion_s)}s` : 'desconocida'}

## Transcript del guion
${cuerpo}

Analizá el guion y devolvé el JSON pedido.`;
}

function parseJsonObject(text) {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('Respuesta sin JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function sanitizeBeats(raw, dur) {
  if (!Array.isArray(raw)) return [];
  const ceil = dur && dur > 0 ? Math.max(1, Math.floor(dur)) : Infinity;
  let prev = -1; const out = [];
  for (const b of raw) {
    if (!b || !b.text) continue;
    const kind = oneOf(b.kind, BEAT_KINDS, 'mecanismo');
    const first = out.length === 0;
    let t0 = Number(b.t0);
    if (!Number.isFinite(t0) || t0 < 0) t0 = first ? 0 : prev + 4;
    if (first) t0 = 0;
    else if (t0 <= prev) t0 = prev + 2;
    if (Number.isFinite(ceil) && t0 >= ceil) t0 = Math.max(first ? 0 : prev, ceil - 1);
    t0 = Math.round(t0); prev = t0;
    out.push({ kind, t0, text: String(b.text).trim() });
  }
  return out;
}

async function callClaude(userPrompt) {
  const payload = { model: MODEL, max_tokens: 6000, system: SYSTEM, messages: [{ role: 'user', content: userPrompt }], output_config: { effort: 'high' }, thinking: { type: 'adaptive' } };
  let lastErr = '';
  for (let attempt = 1; attempt <= 4; attempt++) {
    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) { lastErr = String(e); await sleep(2000 * attempt); continue; }
    const body = await res.json().catch(() => ({}));
    if (res.ok && !body.error) {
      const text = (body.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n').trim();
      return { ok: true, text };
    }
    lastErr = body?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 429 || res.status >= 500) { await sleep(3000 * attempt); continue; }
    return { ok: false, error: lastErr }; // 4xx no recuperable
  }
  return { ok: false, error: lastErr || 'sin respuesta tras reintentos' };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sql = postgres(conn, { ssl: 'require', connect_timeout: 15, max: 1 });

async function upsert(sql, row) {
  await sql`
    insert into script_analyses
      (ad_id, ad_name, short, angle, hook_type, format, tags, beats, note_title, note_text, suggestion, dur, transcript_chars, status, origen_clasif, error, model, analysis_version, analyzed_at, updated_at)
    values
      (${row.ad_id}, ${row.ad_name}, ${row.short}, ${row.angle}, ${row.hook_type}, ${row.format}, ${sql.json(row.tags)}, ${sql.json(row.beats)}, ${row.note_title}, ${row.note_text}, ${row.suggestion}, ${row.dur}, ${row.transcript_chars}, ${row.status}, ${row.origen_clasif}, ${row.error}, ${row.model}, 1, ${row.analyzed_at}, now())
    on conflict (ad_id) do update set
      ad_name = excluded.ad_name, short = excluded.short, angle = excluded.angle, hook_type = excluded.hook_type, format = excluded.format,
      tags = excluded.tags, beats = excluded.beats, note_title = excluded.note_title, note_text = excluded.note_text, suggestion = excluded.suggestion,
      dur = excluded.dur, transcript_chars = excluded.transcript_chars, status = excluded.status, origen_clasif = excluded.origen_clasif,
      error = excluded.error, model = excluded.model, analysis_version = excluded.analysis_version, analyzed_at = excluded.analyzed_at, updated_at = now()`;
}

try {
  const [{ n }] = await sql`select count(*)::int as n from leads`;
  if (n < 50) { console.error(`⚠️ leads=${n} (<50) — proyecto sospechoso, abortando`); process.exit(1); }
  console.log(`Proyecto OK — leads=${n}`);

  // Candidatos: transcripts de video con texto.
  const transcripts = await sql`
    select t.ad_id, t.tipo, t.idioma, t.duracion_s, t.transcript, t.secciones,
           (select m.ad_name from marketing_metrics_daily m where m.ad_id = t.ad_id and m.plataforma='meta' and m.ad_name is not null order by m.fecha desc limit 1) as ad_name
    from ad_transcripts t
    where t.status = 'ok' and coalesce(t.tipo,'video') <> 'imagen' and t.transcript is not null and length(trim(t.transcript)) > 0
    order by t.ad_id`;

  const done = new Set((await sql`select ad_id from script_analyses where status='analizada'`).map((r) => r.ad_id));
  const pendientes = transcripts.filter((t) => FORCE || !done.has(t.ad_id));
  console.log(`Transcripts de video: ${transcripts.length} · ya analizados: ${done.size} · a procesar: ${Math.min(pendientes.length, LIMIT)}${FORCE ? ' (--force)' : ''}`);

  let ok = 0, desc = 0, err = 0, i = 0;
  for (const t of pendientes) {
    if (i >= LIMIT) break;
    i++;
    const dur = t.duracion_s != null ? Math.round(Number(t.duracion_s)) : null;
    const adName = t.ad_name ?? t.ad_id;
    const label = `[${i}/${Math.min(pendientes.length, LIMIT)}] ${adName.slice(0, 40)}`;
    const res = await callClaude(buildUserPrompt(t));
    if (!res.ok) {
      err++;
      console.log(`${label} → ERROR: ${res.error}`);
      await upsert(sql, { ad_id: t.ad_id, ad_name: adName, short: adName.slice(0, 24), angle: null, hook_type: null, format: null, tags: [], beats: [], note_title: null, note_text: null, suggestion: null, dur, transcript_chars: t.transcript.length, status: 'error', origen_clasif: 'claude', error: res.error, model: MODEL, analyzed_at: null });
      continue;
    }
    let a;
    try { a = parseJsonObject(res.text); } catch (e) {
      err++; console.log(`${label} → JSON inválido: ${e.message}`);
      await upsert(sql, { ad_id: t.ad_id, ad_name: adName, short: adName.slice(0, 24), angle: null, hook_type: null, format: null, tags: [], beats: [], note_title: null, note_text: null, suggestion: null, dur, transcript_chars: t.transcript.length, status: 'error', origen_clasif: 'claude', error: 'JSON inválido', model: MODEL, analyzed_at: null });
      continue;
    }
    const tags = Array.isArray(a.tags) ? [...new Set(a.tags.map(String).filter((x) => TAG_VOCAB.includes(x)))] : [];
    const beats = sanitizeBeats(a.beats, dur);
    const suggestion = typeof a.suggestion === 'string' && a.suggestion.trim() ? a.suggestion.trim() : null;
    const status = beats.length > 0 ? 'analizada' : 'descartada';
    await upsert(sql, {
      ad_id: t.ad_id, ad_name: adName,
      short: a.short ? String(a.short).trim().slice(0, 40) : adName.slice(0, 24),
      angle: oneOf(a.angle, ANGLES, 'capataz'), hook_type: oneOf(a.hook_type, HOOK_TYPES, 'promesa'),
      format: a.format ? String(a.format).trim().slice(0, 60) : 'Video',
      tags, beats,
      note_title: a.note?.title ? String(a.note.title).trim() : null,
      note_text: a.note?.text ? String(a.note.text).trim() : null,
      suggestion, dur, transcript_chars: t.transcript.length,
      status, origen_clasif: 'claude', error: null, model: MODEL, analyzed_at: new Date().toISOString(),
    });
    if (status === 'analizada') ok++; else desc++;
    console.log(`${label} → ${status} · ${oneOf(a.angle, ANGLES, 'capataz')} · ${beats.length} beats · tags: ${tags.join(',') || '—'}`);
  }
  console.log(`\n✅ Listo — analizados: ${ok} · descartados: ${desc} · errores: ${err}`);
  process.exit(0);
} catch (e) {
  console.error('Error fatal:', e.message);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
