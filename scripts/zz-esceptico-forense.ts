// READ-ONLY. Verifica las afirmaciones de los 3 informes contra prod.
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });
import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { getSupabaseServer } from '../lib/supabase';

/* eslint-disable @typescript-eslint/no-explicit-any */
async function main() {
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id, nombre, capa').eq('capa', 'superadmin');
  const ws = (wss ?? [])[0] as any;
  console.log(`WS superadmin = ${ws?.id} (${ws?.nombre})`);

  await runWithWorkspace(ws.id, async () => {
    const db = await getTenantDb();

    // ── 1. Modelos pineados + prompts override ────────────────────────────
    const { data: st } = await db.from('app_settings').select('key, value')
      .in('key', ['mako.modelos', 'mako.prompts']);
    for (const r of (st ?? []) as any[]) {
      if (r.key === 'mako.modelos') {
        const v = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
        console.log(`\nPINES de modelo:`);
        for (const [k, m] of Object.entries(v ?? {})) console.log(`   ${k} → ${JSON.stringify(m)}`);
      } else {
        const v = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
        const keys = Object.keys(v ?? {});
        console.log(`\nPROMPTS override: ${keys.length ? keys.join(', ') : '(VACÍO)'}`);
        console.log(`   guardian.rutear.* override: ${keys.filter((k) => k.includes('rutear')).join(',') || 'NINGUNO (corre el default del código)'}`);
      }
    }

    // ── 2. Proyectos del tablero ──────────────────────────────────────────
    const { data: proys } = await db.from('plan_proyectos').select('id, pid, name, detalle, historial, created_at').order('created_at', { ascending: false });
    const nom = new Map((proys ?? []).map((p: any) => [p.id, p.name]));
    console.log(`\nPROYECTOS EN EL TABLERO: ${(proys ?? []).length}`);
    console.log(`   los 6 más nuevos: ${(proys ?? []).slice(0, 6).map((p: any) => `${p.name} (${String(p.created_at).slice(0, 10)})`).join(' · ')}`);

    // ── 3. Las tareas del caso (nums 550-565) ─────────────────────────────
    const { data: ts } = await db.from('plan_tareas').select('id, num, title, detalle, labels, created_at, fuente, historial')
      .gte('num', 545).lte('num', 570).order('num');
    console.log(`\nTAREAS #545-570 (${(ts ?? []).length}):`);
    for (const t of (ts ?? []) as any[]) {
      const pr = (t.labels ?? []).map((id: string) => nom.get(id) ?? id).join(' + ') || '(sin proyecto)';
      console.log(`  #${t.num} ${String(t.title).slice(0, 58).padEnd(60)} → ${pr}`);
      console.log(`        detalle=${(t.detalle ?? '').length}c  fuente=${JSON.stringify(t.fuente)?.slice(0, 60)}  ${String(t.created_at).slice(0, 16)}`);
    }

    // ── 4. Borradores de hoy: origen, notas, tareas con su detalle ────────
    const { data: props } = await db.from('plan_propuestas').select('id, origen, estado, tareas, notas, resumen, created_at, applied_at')
      .order('created_at', { ascending: false }).limit(14);
    console.log(`\nBORRADORES (últimos ${(props ?? []).length}):`);
    for (const p of (props ?? []) as any[]) {
      const tar = Array.isArray(p.tareas) ? p.tareas : [];
      const notas = Array.isArray(p.notas) ? p.notas : [];
      const dets = tar.map((t: any) => (t.detalle ?? '').length);
      const grupos = [...new Set(tar.map((t: any) => t.proyecto || '(sin)'))];
      console.log(`  ${p.id}  ${String(p.origen).padEnd(12)} ${String(p.estado).padEnd(10)} ${String(p.created_at).slice(5, 16)}  tareas=${tar.length} notas=${notas.length}`);
      console.log(`        detalles(c)=[${dets.join(',')}]  proyectos propuestos=${JSON.stringify(grupos)}`);
    }

    // ── 5. El borrador del caso, completo ─────────────────────────────────
    const { data: uno } = await db.from('plan_propuestas').select('*').eq('id', 'propmsgl4cd8byg35').maybeSingle();
    if (uno) {
      const u = uno as any;
      console.log(`\n═══ BORRADOR propmsgl4cd8byg35 ═══ estado=${u.estado} origen=${u.origen} applied=${u.applied_at}`);
      for (const t of (u.tareas ?? []) as any[]) {
        console.log(`  · «${t.titulo}»  proyecto=«${t.proyecto ?? ''}»  detalle(${(t.detalle ?? '').length}c): ${(t.detalle ?? '').slice(0, 220)}`);
      }
      console.log(`  notas: ${JSON.stringify(u.notas)}`);
      console.log(`  aplicadas: ${(u.aplicadas ?? []).length}`);
    } else {
      console.log(`\n⚠ NO EXISTE el borrador propmsgl4cd8byg35`);
    }

    // ── 6. El buffer de WhatsApp ──────────────────────────────────────────
    const { data: buf } = await svc.from('mako_doer_buffer').select('id, workspace_id, grupo_jid, texto, estado, created_at')
      .order('created_at', { ascending: false }).limit(8);
    console.log(`\nBUFFER WhatsApp (${(buf ?? []).length}):`);
    for (const b of (buf ?? []) as any[]) {
      console.log(`  id=${b.id} ws=${b.workspace_id} ${String(b.estado).padEnd(10)} ${String(b.created_at).slice(5, 16)} texto=${(b.texto ?? '').length}c`);
      console.log(`        «${(b.texto ?? '').slice(0, 300).replace(/\n/g, ' ⏎ ')}»`);
    }

    // ── 7. Historial de los proyectos que recibieron el lote ──────────────
    console.log(`\nHISTORIAL "ruteó" en proyectos:`);
    for (const p of (proys ?? []) as any[]) {
      for (const h of (p.historial ?? []) as any[]) {
        if (/rute/i.test(h.text ?? '')) console.log(`  [${p.name}] ${new Date(h.ts).toISOString().slice(5, 16)} ${String(h.text).slice(0, 150)}`);
      }
    }
  });
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
