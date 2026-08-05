// =============================================================================
// probe-perro-gemini — ¿el Perro sigue siendo el Perro corriendo en Gemini?
// =============================================================================
// SOLO LEE del tablero. Hace 2 llamadas reales a la IA con tareas REALES del plan y
// muestra el resultado para poder juzgarlo, en vez de confiar en que "va a andar".
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/probe-perro-gemini.ts
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { getSupabaseServer } from '../lib/supabase';
import { modeloDeFeature } from '../lib/model-registry';
import { asignarTareasAProyectos, puntuarNuevas } from '../lib/mako-guardian';
import { checklistsParaTareas } from '../lib/checklist-coach';
import { CATALOGO_PROYECTOS } from '../lib/plan-proyectos-catalogo';

// Tareas de mentira PERO del estilo real del tablero, para no depender de qué haya
// cargado hoy. Cada una tiene un destino evidente: si el Perro las manda a otro lado,
// se ve al toque.
const CASOS: Array<{ titulo: string; espera: string }> = [
  { titulo: 'Arreglar el filtro por fecha del tablero de guiones', espera: 'Ads Analyst' },
  { titulo: 'Reescribir la biografía de Instagram apuntando al nicho', espera: 'Vender MaKo: Orgánico Instagram' },
  { titulo: 'Que el lead avance solo de etapa cuando contesta el WhatsApp', espera: 'CRM' },
  { titulo: 'Integrar la pasarela de pago con Stripe', espera: 'Cobros y planes' },
  { titulo: 'Que un cliente no pueda ver las campañas de otro', espera: 'Seguridad y multi-inquilino' },
];

async function main() {
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id').eq('capa', 'superadmin');
  const ws = ((wss ?? [])[0] as { id: number } | undefined)?.id;
  if (!ws) throw new Error('sin workspace superadmin');

  await runWithWorkspace(ws, async () => {
    const g = await modeloDeFeature('mako-guardian');
    const c = await modeloDeFeature('checklist-coach');
    console.log(`mako-guardian  → ${g?.provider}/${g?.model}`);
    console.log(`checklist-coach → ${c?.provider}/${c?.model}\n`);

    const db = await getTenantDb();
    const { data: proys } = await db.from('plan_proyectos').select('name, detalle');
    const destinos = ((proys ?? []) as Array<{ name: string; detalle: string | null }>)
      .map((p) => ({ nombre: p.name, que: p.detalle || CATALOGO_PROYECTOS.find((x) => x.nombre === p.name)?.que || '' }));

    // ── 1. Rutear: ¿manda cada tarea al proyecto que corresponde? ──────────────
    const t0 = Date.now();
    const r = await asignarTareasAProyectos(CASOS.map((x) => ({ titulo: x.titulo })), destinos, 'Probe: rutear con Gemini');
    let bien = 0;
    console.log(`RUTEO (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    for (const [i, caso] of CASOS.entries()) {
      const dio = r.asign.find((a) => a.i === i)?.destino ?? '(no ruteó)';
      const ok = dio === caso.espera;
      if (ok) bien++;
      console.log(`  ${ok ? '✓' : '✗'} ${caso.titulo.slice(0, 52).padEnd(52)} → ${dio}${ok ? '' : `   (esperaba «${caso.espera}»)`}`);
    }
    console.log(`  ${bien}/${CASOS.length}\n`);

    // ── 2. Puntuar: ¿reparte los scores o los amontona? ────────────────────────
    const t1 = Date.now();
    const sc = await puntuarNuevas(
      CASOS.map((x, i) => ({ id: `t${i}`, titulo: x.titulo, detalle: '', proyecto: x.espera })),
      [{ titulo: 'Cerrar la auditoría de seguridad', score: 92 }, { titulo: 'Reskin de la app', score: 27 }],
      'Tablero del dueño de MaKo, producto en fase de primeros clientes.',
      'Probe: puntuar con Gemini',
    );
    console.log(`SCORES (${((Date.now() - t1) / 1000).toFixed(1)}s)`);
    for (const s of sc.tareas) console.log(`  ${String(s.score).padStart(3)}  ${CASOS[Number(s.id.slice(1))]?.titulo.slice(0, 46).padEnd(46)}  ${s.razon.slice(0, 70)}`);
    const scores = sc.tareas.map((s) => s.score);
    console.log(`  rango ${Math.min(...scores)}-${Math.max(...scores)}   ${Math.max(...scores) - Math.min(...scores) >= 20 ? '✓ reparte' : '✗ los amontona'}\n`);

    // ── 3. Descripción + checklist: ¿amplía lo que dijo el dueño? ─────────────
    const t2 = Date.now();
    const enr = await checklistsParaTareas(
      [{ id: 'x1', titulo: 'Arreglar el filtro por fecha del tablero de guiones', detalle: 'Lo pidió Mau el jueves: cuando elegís "últimos 30 días" el tablero sigue mostrando todo, y encima el orden por retención se rompe. Dijo que sin esto no puede comparar guiones de una semana contra otra, que es para lo que lo usa.' }],
      'El dueño aclaró que no hay deadline duro pero que lo usa todas las semanas.',
      'Probe: descripción + checklist con Gemini',
    );
    const e = enr.x1;
    console.log(`DESCRIPCIÓN + CHECKLIST (${((Date.now() - t2) / 1000).toFixed(1)}s)`);
    console.log(`  detalle (${e?.detalle.length ?? 0} car): ${(e?.detalle ?? '(vacío)').slice(0, 400)}`);
    console.log(`  conserva lo que dijo el dueño: ${/mau/i.test(e?.detalle ?? '') ? '✓ lo nombra' : '⚠ no lo nombra'}`);
    for (const it of e?.items ?? []) console.log(`   · ${it}`);
  });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
