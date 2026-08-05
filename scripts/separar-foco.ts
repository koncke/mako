// =============================================================================
// separar-foco — «General» eran dos proyectos metidos en uno
// =============================================================================
// Sin --apply solo IMPRIME.
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/separar-foco.ts
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/separar-foco.ts --apply
//
// General mezclaba el semáforo que DIAGNOSTICA (cómo estás) con el foco que MANDA
// (qué hacer ahora). Son dos trabajos distintos y compiten entre sí: mientras el
// diagnóstico crecía, la acción de la semana quedaba enterrada entre métricas — que
// es exactamente el problema que la acción de la semana venía a resolver.
//
// Nada se borra: las tareas cambian de proyecto y queda el rastro en su historial.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { getSupabaseServer } from '../lib/supabase';
import { delCatalogo } from '../lib/plan-proyectos-catalogo';

const APLICAR = process.argv.includes('--apply');

/** Qué se va de General y a dónde. El resto de General se queda como está. */
const MUDANZA: Array<{ num: number; a: string; porque: string }> = [
  { num: 28, a: 'Foco', porque: 'la vista Hoy y el latido que te reclama son la acción del día, no el diagnóstico' },
  { num: 30, a: 'Foco', porque: 'a quién llamar hoy es una orden de trabajo, no una métrica' },
  { num: 31, a: 'Foco', porque: 'el briefing de la mañana y el cuello del funnel son el foco del día' },
  { num: 285, a: 'Foco', porque: 'es literalmente el módulo de Acción Semanal / Foco' },
  { num: 326, a: 'Foco', porque: 'el tablero operativo diario y semanal es la vista de foco, no la de salud' },
  { num: 319, a: 'Dashboard', porque: 'la capacidad instalada y los clientes activos son analítica del negocio, no la pantalla de inicio' },
];

const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

type ProyRow = { id: string; pid: string | null; name: string; emoji: string | null; score: number | null; detalle: string | null; orden: number | null };
type TarRow = { id: string; num: number; title: string; labels: string[] | null; historial: Array<{ id: string; ts: number; actor: string; text: string }> | null };

async function main() {
  console.log(APLICAR ? '=== APLICANDO ===\n' : '=== SIMULACIÓN (sin --apply no escribe nada) ===\n');
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id, nombre, capa').eq('capa', 'superadmin');
  const ws = (wss ?? [])[0] as { id: number; nombre: string } | undefined;
  if (!ws) throw new Error('no encontré el workspace con capa=superadmin');
  console.log(`workspace: #${ws.id} «${ws.nombre}»\n`);

  await runWithWorkspace(ws.id, async () => {
    const db = await getTenantDb();
    const { data: pRows } = await db.from('plan_proyectos').select('*');
    const { data: tRows } = await db.from('plan_tareas').select('*');
    const proys = (pRows ?? []) as unknown as ProyRow[];
    const tareas = (tRows ?? []) as unknown as TarRow[];
    const porNum = new Map(tareas.map((t) => [t.num, t]));
    const porId = new Map(proys.map((p) => [p.id, p]));
    const ahora = Date.now();

    // ── El proyecto Foco: se reusa si ya existe ─────────────────────────────
    const cat = delCatalogo('Foco');
    if (!cat) throw new Error('«Foco» no está en el catálogo — agregalo primero en lib/plan-proyectos-catalogo.ts');
    let foco = proys.find((p) => norm(p.name) === norm('Foco'));
    const general = proys.find((p) => norm(p.name) === norm('General'));

    console.log('MUDANZA:');
    for (const m of MUDANZA) {
      const t = porNum.get(m.num);
      if (!t) { console.log(`  ⚠ #${m.num}: no existe`); continue; }
      const antes = (t.labels ?? []).map((l) => porId.get(l)?.name ?? '?').join(', ') || 'sin proyecto';
      console.log(`  #${m.num} «${t.title.slice(0, 52)}»  ${antes} → ${m.a}`);
    }
    const quedan = tareas.filter((t) => general && (t.labels ?? []).includes(general.id) && !MUDANZA.some((m) => m.num === t.num));
    console.log(`\nEn General quedan ${quedan.length}: ${quedan.map((t) => `#${t.num}`).join(' ')}`);
    console.log(`Foco: ${foco ? `ya existe (${foco.pid})` : 'se crea'}`);

    if (!APLICAR) { console.log('\n(simulación — nada se escribió)'); return; }

    if (!foco) {
      const id = `p${ahora.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      const siguientePid = proys.reduce((m, p) => Math.max(m, Number(/^P(\d+)$/i.exec(p.pid ?? '')?.[1] ?? 0)), 0) + 1;
      // Hereda el score de General: es el mismo pedazo del plan, partido en dos.
      const score = general?.score ?? 50;
      const { error } = await db.from('plan_proyectos').insert({
        id, pid: `P${siguientePid}`, name: 'Foco', emoji: cat.emoji, color: '#0E9B8E',
        score, detalle: cat.que, orden: (general?.orden ?? 0) + 1,
        historial: [{ id: `h${id}`, ts: ahora, actor: 'ia', text: 'MaKo lo separó de «General»: el semáforo diagnostica y el foco manda — no son el mismo trabajo' }],
      });
      if (error) throw new Error(`crear «Foco»: ${error.message}`);
      foco = { id, pid: `P${siguientePid}`, name: 'Foco', emoji: cat.emoji, score, detalle: cat.que, orden: null };
      console.log(`✓ proyecto «Foco» creado (${foco.pid})`);
    }

    // General se queda solo con el diagnóstico: que su descripción lo diga.
    if (general) {
      const g = delCatalogo('General');
      await db.from('plan_proyectos').update({ detalle: g?.que ?? general.detalle, updated_at: new Date().toISOString() }).eq('id', general.id);
    }

    const idDe = (nombre: string): string | undefined =>
      nombre === 'Foco' ? foco?.id : proys.find((p) => norm(p.name) === norm(nombre))?.id;

    let movidas = 0;
    for (const m of MUDANZA) {
      const t = porNum.get(m.num);
      const nid = idDe(m.a);
      if (!t || !nid) { console.log(`  ✗ #${m.num}: ${!t ? 'no existe' : `no encontré el proyecto «${m.a}»`}`); continue; }
      if ((t.labels ?? []).join() === nid) continue;
      const antes = (t.labels ?? []).map((l) => porId.get(l)?.name ?? '?').join(', ') || 'sin proyecto';
      const hist = [{ id: `h${t.id}${ahora}`, ts: ahora, actor: 'ia' as const, text: `MaKo la movió a «${m.a}» (estaba en «${antes}»): ${m.porque}`.slice(0, 220) }, ...(t.historial ?? [])].slice(0, 40);
      const { error } = await db.from('plan_tareas').update({ labels: [nid], historial: hist, updated_at: new Date().toISOString() }).eq('id', t.id);
      if (error) console.error(`  ✗ #${m.num}: ${error.message}`);
      else movidas++;
    }
    console.log(`✓ ${movidas}/${MUDANZA.length} tareas movidas`);
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
