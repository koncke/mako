// =============================================================================
// unir-proyectos-de-cliente — un cliente, un proyecto (#870, 17/10/2026)
// =============================================================================
// En el tablero de un CLIENTE (experimento_tareas / tarea_categorias), une los proyectos que son del
// mismo cliente del CRM y reacomoda las tareas de una reunión con cliente que cayeron en «Sin
// proyecto». Es la reparación de los datos que dejó la regla vieja; la regla nueva vive en
// lib/reunion-cliente-reglas.ts y este script la usa tal cual (`proyectoDelCliente`, `clientePorTitulo`).
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/unir-proyectos-de-cliente.ts            ← sólo mira
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/unir-proyectos-de-cliente.ts --aplicar  ← escribe
//
// Qué hace, por workspace (no toca el del super admin, que no usa estas tablas):
//   1. Por cada cliente (lead GANADO), los proyectos que son suyos: los atados a su lead y los que su
//      nombre reconoce. Si son dos o más, se queda el MÁS VIEJO (el primero que armó el dueño), lo ata
//      al lead, le pasa las tareas de los otros —con su renglón en el historial— y borra los vacíos.
//   2. Las tareas de un borrador de reunión que quedaron en «Sin proyecto» cuando el título nombraba al
//      cliente («Junta Monserrat HMO»): van al proyecto de ese cliente, con su renglón.
// Antes de escribir guarda la foto de lo que toca en C:/dev/backup-unir-proyectos-<ws>.json.
//
// Corrido el 17/10/2026: ws1 unió «Cliente: Congelados HMO» (#151, 17 tareas) y «Cliente: Macario
// Romero» (#153, 3) en «Cliente: Macario Romero — HMO» (#47), y movió las 7 de «Junta Monserrat HMO»
// que estaban en «Sin proyecto». El resto de los workspaces no tenía duplicados.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) config({ path: 'C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/.env.local' });

import { writeFileSync } from 'node:fs';
import { runWithWorkspace, getTenantDb, listarWorkspaces } from '../lib/workspace';
import { proyectoDelCliente, clientePorTitulo, esDelCliente } from '../lib/reunion-cliente-reglas';
import { esProyectoBandeja } from '../lib/plan-bandeja';

const APLICAR = process.argv.includes('--aplicar');
type Cat = { id: number; nombre: string; cliente_lead_id: number | null; cliente_nombre: string | null; created_at: string; detalle: string | null; historial: unknown[] };
type Lead = { id: number; nombre: string | null; empresa: string | null };
type Tarea = { id: number; titulo: string; categorias: number[]; historial: unknown[] };

const hist = (text: string) => ({ id: `h870${Math.random().toString(36).slice(2, 10)}`, ts: Date.now(), actor: 'ia', text });

async function unWorkspace(ws: number): Promise<void> {
  await runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const [{ data: cRows }, { data: lRows }] = await Promise.all([
      db.from('tarea_categorias').select('id, nombre, cliente_lead_id, cliente_nombre, created_at, detalle, historial').order('created_at', { ascending: true }),
      db.from('leads').select('id, nombre, empresa').eq('estado_lead', 'ganado').limit(500),
    ]);
    const cats = (cRows ?? []) as Cat[];
    const leads = (lRows ?? []) as Lead[];
    if (!cats.length) return;

    // ── 1. Los proyectos de cada cliente.
    const uniones: Array<{ lead: Lead; queda: Cat; van: Cat[] }> = [];
    const yaUsadas = new Set<number>();
    for (const l of leads) {
      const c = { leadId: l.id, empresa: l.empresa, nombre: l.nombre ?? '' };
      const suyas = cats.filter((x) => !yaUsadas.has(x.id) && !esProyectoBandeja(x.nombre) && esDelCliente(x, c));
      if (suyas.length < 2) continue;
      const queda = suyas[0];   // la más vieja (vienen por created_at)
      suyas.forEach((x) => yaUsadas.add(x.id));
      uniones.push({ lead: l, queda, van: suyas.slice(1) });
    }

    // ── 2. Lo de una reunión con cliente que cayó en la bandeja.
    const bandeja = cats.find((x) => esProyectoBandeja(x.nombre));
    const aMover: Array<{ tareaId: number; leadId: number; reunion: string }> = [];
    if (bandeja) {
      const { data: pRows } = await db.from('plan_propuestas').select('fuente_titulo, aplicadas, cliente_lead_id').eq('origen', 'fathom').eq('estado', 'aplicada');
      for (const p of (pRows ?? []) as Array<{ fuente_titulo: string | null; aplicadas: Array<{ tareaId?: string }> | null; cliente_lead_id: number | null }>) {
        const l = p.cliente_lead_id ? leads.find((x) => x.id === p.cliente_lead_id) ?? null : clientePorTitulo(p.fuente_titulo ?? '', leads);
        if (!l) continue;
        for (const a of p.aplicadas ?? []) if (Number(a.tareaId) > 0) aMover.push({ tareaId: Number(a.tareaId), leadId: l.id, reunion: p.fuente_titulo ?? '' });
      }
    }

    const idsTareas = new Set<number>();
    const { data: tRows } = await db.from('experimento_tareas').select('id, titulo, categorias, historial');
    const tareas = ((tRows ?? []) as Tarea[]).map((t) => ({ ...t, categorias: (t.categorias ?? []).map(Number) }));
    const destinoDeLead = (leadId: number): Cat | undefined => {
      const u = uniones.find((x) => x.lead.id === leadId);
      if (u) return u.queda;
      const l = leads.find((x) => x.id === leadId);
      return l ? proyectoDelCliente(cats.filter((x) => !esProyectoBandeja(x.nombre)), { leadId, empresa: l.empresa, nombre: l.nombre ?? '' }) : undefined;
    };
    const movidasBandeja = aMover
      .map((m) => ({ ...m, t: tareas.find((t) => t.id === m.tareaId), dest: destinoDeLead(m.leadId) }))
      .filter((m) => m.t && m.dest && bandeja && m.t.categorias.includes(bandeja.id) && !m.t.categorias.includes(m.dest.id));

    if (!uniones.length && !movidasBandeja.length) return;
    console.log(`\nws ${ws}:`);
    for (const u of uniones) {
      const n = (c: Cat) => tareas.filter((t) => t.categorias.includes(c.id)).length;
      console.log(`  ${u.lead.empresa ?? u.lead.nombre} (lead ${u.lead.id}) → queda «${u.queda.nombre}» #${u.queda.id} (${n(u.queda)}); se le unen ${u.van.map((v) => `«${v.nombre}» #${v.id} (${n(v)})`).join(', ')}`);
    }
    for (const m of movidasBandeja) console.log(`  bandeja → «${m.dest!.nombre}»: #${m.t!.id} «${m.t!.titulo.slice(0, 60)}» (de «${m.reunion}»)`);
    if (!APLICAR) return;

    // La foto, antes de tocar nada.
    for (const u of uniones) for (const c of [u.queda, ...u.van]) for (const t of tareas) if (t.categorias.includes(c.id)) idsTareas.add(t.id);
    for (const m of movidasBandeja) idsTareas.add(m.t!.id);
    writeFileSync(`C:/dev/backup-unir-proyectos-${ws}.json`, JSON.stringify({
      ts: new Date().toISOString(),
      categorias: cats.filter((c) => uniones.some((u) => u.queda.id === c.id || u.van.some((v) => v.id === c.id))),
      tareas: tareas.filter((t) => idsTareas.has(t.id)),
    }, null, 1));

    for (const u of uniones) {
      for (const v of u.van) {
        for (const t of tareas.filter((x) => x.categorias.includes(v.id))) {
          const cats2 = [...new Set(t.categorias.map((c) => (c === v.id ? u.queda.id : c)))];
          const { error } = await db.from('experimento_tareas').update({
            categorias: cats2, updated_at: new Date().toISOString(),
            historial: [hist(`Proyecto: de «${v.nombre}» a «${u.queda.nombre}». Eran dos proyectos del mismo cliente (${u.lead.empresa ?? u.lead.nombre}); quedó uno (#870).`), ...(t.historial ?? [])],
          }).eq('id', t.id);
          if (error) throw new Error(`tarea ${t.id}: ${error.message}`);
          t.categorias = cats2;
        }
        const { error } = await db.from('tarea_categorias').delete().eq('id', v.id);
        if (error) throw new Error(`borrar #${v.id}: ${error.message}`);
      }
      const { error } = await db.from('tarea_categorias').update({
        cliente_lead_id: u.lead.id, cliente_nombre: u.lead.nombre ?? u.lead.empresa,
        detalle: u.queda.detalle || u.van.find((v) => v.detalle)?.detalle || '',
        historial: [hist(`Se le unieron ${u.van.map((v) => `«${v.nombre}»`).join(' y ')}: eran del mismo cliente (#870).`), ...(u.queda.historial ?? [])],
      }).eq('id', u.queda.id);
      if (error) throw new Error(`atar #${u.queda.id}: ${error.message}`);
    }
    for (const m of movidasBandeja) {
      const t = m.t!;
      const cats2 = [...new Set(t.categorias.filter((c) => c !== bandeja!.id).concat(m.dest!.id))];
      const { error } = await db.from('experimento_tareas').update({
        categorias: cats2, updated_at: new Date().toISOString(),
        historial: [hist(`Proyecto: de «${bandeja!.nombre}» a «${m.dest!.nombre}». La reunión «${m.reunion}» es con ese cliente (#870).`), ...(t.historial ?? [])],
      }).eq('id', t.id);
      if (error) throw new Error(`tarea ${t.id}: ${error.message}`);
    }
    console.log(`  ✓ aplicado (foto en C:/dev/backup-unir-proyectos-${ws}.json)`);
  });
}

async function main() {
  const wss = (await listarWorkspaces()).filter((w) => (w as { capa?: string }).capa !== 'superadmin');
  for (const w of wss) await unWorkspace(w.id).catch((e) => console.error(`ws ${w.id}: ${e instanceof Error ? e.message : String(e)}`));
  console.log(APLICAR ? '\nListo.' : '\n(sólo miré: con --aplicar escribe)');
}
main().then(() => process.exit(0));
