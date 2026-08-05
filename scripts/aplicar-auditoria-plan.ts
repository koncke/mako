// =============================================================================
// aplicar-auditoria-plan — lo que salió de la auditoría, al tablero del dueño
// =============================================================================
// Sin --apply solo IMPRIME. Con --apply escribe, con backup en app_settings.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/aplicar-auditoria-plan.ts
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/aplicar-auditoria-plan.ts --apply
//
// Tres cosas, todas con rastro en el historial de la tarjeta:
//   1. HECHAS — tareas cuyo trabajo YA está en el código. Solo las 8 que sobrevivieron
//      al verificador adversarial (de 27 candidatas: 9 rechazadas por estar a medias y
//      10 reportadas como parciales de entrada). Marcar como hecha algo que no lo está
//      le borra trabajo real al dueño, así que acá se es conservador a propósito.
//   2. DESCRIPCIONES — las 34 de los proyectos, escritas cruzando las tareas reales,
//      el código y los commits: qué es · qué hay hoy · qué falta · por qué importa.
//   3. PRIORIDADES — los scores que estaban mal, en los dos sentidos.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { getSupabaseServer } from '../lib/supabase';
import { setSetting } from '../lib/settings';
import { prioFromScore } from '../app/plan/board/types';

const APLICAR = process.argv.includes('--apply');
const DATOS = process.argv.find((a) => a.startsWith('--datos='))?.slice(8)
  ?? 'C:/Users/marti/AppData/Local/Temp/claude/C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main/e8ba820e-b085-4a3d-bc19-1cf12e7cacb0/scratchpad/audit2-final.json';

type Hallazgo = { titulo: string; archivo: string; evidencia: string; porque: string; arreglo: string };
type Veredicto = { real: boolean; razon: string; correccion?: string };
type Desc = { pid: string; nombre: string; detalle: string };
type PrioT = { num: number; titulo: string; scoreActual: number; scorePropuesto: number; porque: string };
type PrioP = { pid: string; nombre: string; scoreActual: number; scorePropuesto: number; porque: string };
type Auditoria = { hechas: Hallazgo[]; veredictos: Record<string, Veredicto>; descripciones: Desc[]; prioridades: { tareas: PrioT[]; proyectos: PrioP[] } };

const A = JSON.parse(readFileSync(DATOS, 'utf8')) as Auditoria;
const num = (s: string): number => Number(s.replace('#', '').trim());

type TarRow = { id: string; num: number; title: string; score: number; progress: number; historial: Array<{ id: string; ts: number; actor: string; text: string }> | null };
type ProyRow = { id: string; pid: string | null; name: string; score: number; detalle: string | null; historial: Array<{ id: string; ts: number; actor: string; text: string }> | null };

async function main() {
  console.log(APLICAR ? '=== APLICANDO ===\n' : '=== SIMULACIÓN (sin --apply no escribe nada) ===\n');
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id').eq('capa', 'superadmin');
  const ws = ((wss ?? [])[0] as { id: number } | undefined)?.id;
  if (!ws) throw new Error('sin workspace superadmin');

  await runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const { data: tRows } = await db.from('plan_tareas').select('id, num, title, score, progress, historial');
    const { data: pRows } = await db.from('plan_proyectos').select('id, pid, name, score, detalle, historial');
    const tareas = (tRows ?? []) as unknown as TarRow[];
    const proys = (pRows ?? []) as unknown as ProyRow[];
    const porNum = new Map(tareas.map((t) => [t.num, t]));
    const porPid = new Map(proys.filter((p) => p.pid).map((p) => [p.pid as string, p]));
    const ahora = Date.now();
    const hist = (prev: TarRow['historial'], text: string) =>
      [{ id: `h${ahora}${Math.random().toString(36).slice(2, 6)}`, ts: ahora, actor: 'ia' as const, text: text.slice(0, 220) }, ...(prev ?? [])].slice(0, 40);

    // ── 1. HECHAS ─────────────────────────────────────────────────────────
    const hechas = A.hechas.filter((h) => A.veredictos[h.archivo]?.real === true);
    const aCerrar = hechas.map((h) => ({ h, t: porNum.get(num(h.archivo)) })).filter((x) => x.t && x.t.progress < 100);
    console.log(`HECHAS: ${aCerrar.length} de ${A.hechas.length} candidatas (el verificador tiró ${A.hechas.length - hechas.length})`);
    for (const { h, t } of aCerrar) console.log(`  ✓ #${t!.num} ${t!.title.slice(0, 58)}\n      ${h.evidencia.slice(0, 110)}`);

    // ── 2. DESCRIPCIONES ──────────────────────────────────────────────────
    const aDescribir = A.descripciones.map((d) => ({ d, p: porPid.get(d.pid) })).filter((x) => x.p && x.d.detalle.trim().length > 120);
    const largos = aDescribir.map((x) => x.d.detalle.length);
    console.log(`\nDESCRIPCIONES: ${aDescribir.length}/34 · ${Math.round(largos.reduce((a, b) => a + b, 0) / (largos.length || 1))} caracteres promedio (antes ~90)`);
    for (const { d, p } of aDescribir.slice(0, 3)) console.log(`  ${d.pid} ${p!.name}: ${d.detalle.slice(0, 130)}…`);

    // ── 3. PRIORIDADES ────────────────────────────────────────────────────
    // Guarda: solo se mueve si el cambio es sustantivo (≥8 puntos). Mover un score 3
    // puntos no cambia la columna y ensucia el historial de la tarjeta.
    // Y no se re-prioriza lo que en esta misma corrida se está cerrando: bajarle el
    // score a una tarea que acaba de quedar hecha es ruido en su historial.
    const cerrando = new Set(aCerrar.map((c) => c.t!.num));
    const movT = A.prioridades.tareas.map((x) => ({ x, t: porNum.get(x.num) }))
      .filter((y) => y.t && y.t.progress < 100 && !cerrando.has(y.x.num) && Math.abs(y.t.score - y.x.scorePropuesto) >= 8);
    const movP = A.prioridades.proyectos.map((x) => ({ x, p: porPid.get(x.pid) }))
      .filter((y) => y.p && Math.abs(y.p.score - y.x.scorePropuesto) >= 8);
    console.log(`\nPRIORIDADES: ${movT.length} tareas · ${movP.length} proyectos`);
    for (const { x, t } of movT) console.log(`  #${x.num} ${String(t!.score).padStart(3)}→${String(x.scorePropuesto).padStart(3)}  ${x.titulo.slice(0, 46).padEnd(46)} ${x.porque.slice(0, 60)}`);
    for (const { x, p } of movP) console.log(`  ${x.pid} ${String(p!.score).padStart(3)}→${String(x.scorePropuesto).padStart(3)}  ${x.nombre.slice(0, 46)}`);

    if (!APLICAR) { console.log('\n(simulación — nada se escribió)'); return; }

    await setSetting('mako.backup.auditoria.tareas', JSON.stringify(tareas.map((t) => ({ id: t.id, num: t.num, score: t.score, progress: t.progress }))));
    await setSetting('mako.backup.auditoria.proyectos', JSON.stringify(proys.map((p) => ({ id: p.id, pid: p.pid, score: p.score, detalle: p.detalle }))));
    console.log('\nbackup → mako.backup.auditoria.{tareas,proyectos}');

    let n = 0;
    for (const { h, t } of aCerrar) {
      const { error } = await db.from('plan_tareas').update({
        progress: 100,
        historial: hist(t!.historial, `MaKo la marcó hecha: el trabajo ya está en el código — ${h.evidencia}`),
        updated_at: new Date().toISOString(),
      }).eq('id', t!.id);
      if (error) console.error(`   ✗ #${t!.num}: ${error.message}`); else n++;
    }
    console.log(`✓ ${n} tareas marcadas como hechas`);

    let nd = 0;
    for (const { d, p } of aDescribir) {
      const { error } = await db.from('plan_proyectos').update({
        detalle: d.detalle,
        historial: [{ id: `h${ahora}${d.pid}`, ts: ahora, actor: 'ia' as const, text: 'MaKo le reescribió la descripción cruzando sus tareas, el código y los commits' }, ...(p!.historial ?? [])].slice(0, 40),
        updated_at: new Date().toISOString(),
      }).eq('id', p!.id);
      if (error) console.error(`   ✗ ${d.pid}: ${error.message}`); else nd++;
    }
    console.log(`✓ ${nd} descripciones reescritas`);

    let np = 0;
    for (const { x, t } of movT) {
      const { error } = await db.from('plan_tareas').update({
        score: x.scorePropuesto, priority: prioFromScore(x.scorePropuesto), score_razon: x.porque.slice(0, 400),
        historial: hist(t!.historial, `MaKo la re-priorizó ${t!.score} → ${x.scorePropuesto}: ${x.porque}`),
        updated_at: new Date().toISOString(),
      }).eq('id', t!.id);
      if (error) console.error(`   ✗ #${x.num}: ${error.message}`); else np++;
    }
    for (const { x, p } of movP) {
      const { error } = await db.from('plan_proyectos').update({
        score: x.scorePropuesto, score_razon: x.porque.slice(0, 400),
        historial: [{ id: `h${ahora}p${x.pid}`, ts: ahora, actor: 'ia' as const, text: `MaKo lo re-priorizó ${p!.score} → ${x.scorePropuesto}: ${x.porque}`.slice(0, 220) }, ...(p!.historial ?? [])].slice(0, 40),
        updated_at: new Date().toISOString(),
      }).eq('id', p!.id);
      if (error) console.error(`   ✗ ${x.pid}: ${error.message}`); else np++;
    }
    console.log(`✓ ${np} prioridades corregidas`);
  });
}

main().then(() => { console.log('\nLISTO'); process.exit(0); })
  .catch((e) => { console.error('ERROR:', e); process.exit(1); });
