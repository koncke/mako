// =============================================================================
// Auditoría de links de Fathom mal atribuidos (venta vs entrega de servicio)
// =============================================================================
// Los fathom_links de un lead deberían ser SOLO llamadas de VENTA (R1/R2). La
// entrega de servicio / coaching también matchea por email y a veces se coló
// como R1/R2. Este script cruza cada link con closing_analyses:
//   - category='venta'          → OK, se queda
//   - category != 'venta'        → MAL (entrega/interna/test) → se saca
//   - sin match en closing        → manual/no verificable → se deja (se avisa)
// También reporta labels duplicados (ej. 2 "Reunión 2").
//
// Uso:
//   node scripts/audit-fathom-links.mjs          (dry-run: solo reporta)
//   node scripts/audit-fathom-links.mjs --apply  (aplica: reescribe fathom_links)
// =============================================================================

import postgres from 'postgres';
import { resolve } from 'node:path';
import { config } from 'dotenv';

config({ path: resolve(process.cwd(), '.env.local') });

const APPLY = process.argv.includes('--apply');
const conn = process.env.DATABASE_URL;
if (!conn) { console.error('Falta DATABASE_URL en .env.local'); process.exit(1); }

const normUrl = (u) => (u ?? '').trim().replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();

const sql = postgres(conn, { ssl: 'require', connect_timeout: 10, max: 1 });
try {
  const [{ n }] = await sql`select count(*)::int as n from leads`;
  console.log(`Proyecto OK — leads=${n}\n`);
  if (n < 50) { console.error('⚠️ leads<50 — proyecto sospechoso, abortando'); process.exit(1); }

  // Mapa: URL normalizada → { category, tipo } de closing_analyses.
  // Y ventas por lead (para re-linkear la R1/R2 correcta si quedó sin link).
  const analyses = await sql`select lead_id, share_url, call_url, category, tipo, started_at from closing_analyses`;
  const porUrl = new Map();
  const ventasPorLead = new Map();
  for (const a of analyses) {
    for (const u of [a.share_url, a.call_url]) {
      const k = normUrl(u);
      if (k) porUrl.set(k, { category: a.category, tipo: a.tipo, started_at: a.started_at });
    }
    if (a.category === 'venta' && a.lead_id != null) {
      const url = a.share_url || a.call_url;
      if (url) { const arr = ventasPorLead.get(a.lead_id) ?? []; arr.push({ tipo: a.tipo, started_at: a.started_at, url }); ventasPorLead.set(a.lead_id, arr); }
    }
  }
  console.log(`closing_analyses indexadas por URL: ${porUrl.size}\n`);

  // R1/R2 correctas de VENTA de un lead: tipo explícito → orden por fecha.
  const ventaLinksDe = (leadId) => {
    const v = (ventasPorLead.get(leadId) ?? []).slice().sort((a, b) => new Date(a.started_at ?? 0).getTime() - new Date(b.started_at ?? 0).getTime());
    const r1 = v.find((x) => x.tipo === 'R1') ?? v.find((x) => x.tipo !== 'R2');
    const r2 = v.find((x) => x.tipo === 'R2' && x.url !== r1?.url) ?? v.find((x) => x.url !== r1?.url && x.tipo !== 'R1');
    const out = [];
    if (r1) out.push({ label: 'Reunión 1', url: r1.url });
    if (r2) out.push({ label: 'Reunión 2', url: r2.url });
    return out;
  };

  // Leads con links cargados O con llamadas de venta analizadas (para poblar la
  // R1/R2 correcta también donde el link quedó vacío o nunca se puso).
  const idsConVenta = [...ventasPorLead.keys()];
  const leads = await sql`
    select id, nombre, fathom_links from leads
    where (fathom_links is not null and jsonb_array_length(fathom_links) > 0)
       or id = any(${idsConVenta.length ? idsConVenta : [-1]})
    order by id`;

  let leadsConProblema = 0, linksSacados = 0, linksAgregados = 0, linksSinMatch = 0;
  const key = (arr) => arr.map((x) => `${x?.label ?? ''}|${normUrl(x?.url)}`).join(';');

  for (const l of leads) {
    const links = Array.isArray(l.fathom_links) ? l.fathom_links : [];
    // Los links manuales (sin match en closing) se preservan; los de closing se
    // reconstruyen con las VENTAS correctas del lead (R1/R2). Las de entrega/
    // interna quedan afuera solas (no son venta).
    const manual = links.filter((link) => !porUrl.get(normUrl(link?.url)));
    linksSinMatch += manual.length;
    const finalLinks = [];
    const seen = new Set();
    for (const link of [...manual, ...ventaLinksDe(l.id)]) {
      const k = normUrl(link?.url);
      if (!k || seen.has(k)) continue;
      seen.add(k); finalLinks.push(link);
    }
    if (key(links) === key(finalLinks)) continue; // ya estaba bien

    leadsConProblema++;
    const despues = new Set(finalLinks.map((x) => normUrl(x?.url)));
    const antes = new Set(links.map((x) => normUrl(x?.url)));
    const sacados = links.filter((x) => !despues.has(normUrl(x?.url)));
    const agregados = finalLinks.filter((x) => !antes.has(normUrl(x?.url)));
    console.log(`Lead #${l.id} — ${l.nombre}`);
    for (const s of sacados) console.log(`  ✗ sacar (${porUrl.get(normUrl(s?.url))?.category ?? '¿?'}): ${s?.label ?? ''} · ${s?.url ?? ''}`);
    for (const a of agregados) console.log(`  ✓ linkear venta: ${a?.label ?? ''} · ${a?.url ?? ''}`);
    for (const f of finalLinks) { const prev = links.find((x) => normUrl(x?.url) === normUrl(f?.url)); if (prev && prev.label !== f.label) console.log(`  ↻ re-etiquetar: ${prev.label} → ${f.label}`); }
    linksSacados += sacados.length; linksAgregados += agregados.length;
    if (APPLY) { await sql`update leads set fathom_links = ${sql.json(finalLinks)} where id = ${l.id}`; console.log(`  ✅ actualizado (${finalLinks.length} links)`); }
  }

  console.log('\n──────── RESUMEN ────────');
  console.log(`Leads con fathom_links      : ${leads.length}`);
  console.log(`Leads corregidos            : ${leadsConProblema}`);
  console.log(`Links de NO-venta sacados   : ${linksSacados}`);
  console.log(`Links de venta re-linkeados : ${linksAgregados}`);
  console.log(`Links manuales preservados  : ${linksSinMatch}`);
  console.log(APPLY ? '\nMODO APPLY — cambios escritos.' : '\nDRY-RUN — nada se escribió. Corré con --apply para aplicar.');
} finally {
  await sql.end({ timeout: 5 });
}
