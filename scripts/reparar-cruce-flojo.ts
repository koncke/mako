// =============================================================================
// Los cruces «alta» que no se sostienen, degradados EN SU LUGAR
// =============================================================================
// Un cruce con confianza «alta» hace que la tarea llegue DESTILDADA, así que un falso
// positivo esconde un pedido real de una reunión sin que nadie lo mire. Medido sobre
// «Mau <> Martin: CUSTOMER SUCCESS»: 8 de las 11 tareas propias llegaron así y las OCHO
// eran falsas (cinco sin compartir una sola palabra con la tarjeta). El botón decía
// «Agregar 3 al plan».
//
// El arreglo del código está en lib/cruce-confianza.ts. Esto aplica la MISMA regla a los
// borradores que ya estaban guardados.
//
// ⚠️ NO RE-CRUZA NADA y no toca `cruzado_at`. Poner `cruzado_at` en null no es
// «recalcular»: es hacer que el dueño vuelva a esperar, volver a pagar la llamada y
// pisarle las decisiones que ya tomó. Acá solo se baja la confianza de lo que ya está
// guardado — la marca y su razón se conservan enteras, la tarea sigue avisando «ojo, se
// parece a esta», y lo único que cambia es que entra TILDADA.
//
// SEGURO DE CORRER DOS VECES: sin `--aplicar` no escribe, y lo ya degradado no vuelve a
// aparecer porque la regla mira `confianza === 'alta'`.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/reparar-cruce-flojo.ts
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/reparar-cruce-flojo.ts --aplicar
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

const APLICAR = process.argv.includes('--aplicar');

type Tarea = {
  titulo?: string; esDeOtro?: boolean; incluir?: boolean; ampliar?: boolean;
  enriquece?: { id?: string; razon?: string; confianza?: string };
};

async function main() {
  const { runWithWorkspace, getTenantDb } = await import('../lib/workspace');
  const { getSupabaseServer } = await import('../lib/supabase');
  const { degradarConfianza } = await import('../lib/cruce-confianza');
  const { listPlanBoard } = await import('../lib/plan-board');

  const admin = getSupabaseServer();
  const { data: props } = await admin.from('plan_propuestas')
    .select('id, workspace_id, fuente_titulo, tareas').eq('estado', 'pendiente');

  for (const p of (props ?? []) as Array<{ id: string; workspace_id: string; fuente_titulo: string | null; tareas: Tarea[] }>) {
    const ts = p.tareas ?? [];
    const altas = ts.filter((t) => !t.esDeOtro && t.enriquece?.confianza === 'alta');
    if (!altas.length) continue;

    await runWithWorkspace(Number(p.workspace_id), async () => {
      const board = await listPlanBoard();
      const porId = new Map(board.tareas.map((t) => [t.id, t.title]));

      // Se reconstruye la forma que espera `degradarConfianza` a partir de lo guardado.
      // El `id` vacío es el cruce contra OTRO borrador de la misma llamada, que la regla
      // trata distinto a propósito.
      const idx = ts.map((t, i) => ({ t, i })).filter(({ t }) => !t.esDeOtro && t.enriquece?.confianza === 'alta');
      const cruces = idx.map(({ t }, k) => ({
        i: k,
        idExistente: t.enriquece?.id || `borrador:${k}`,
        razon: t.enriquece?.razon ?? '',
        confianza: 'alta' as const,
      }));
      const candidatas = idx.map(({ t }) => ({ titulo: t.titulo ?? '' }));
      const existentes = cruces.map((c) => ({ id: c.idExistente, titulo: porId.get(c.idExistente) ?? '' }));

      const { degradados } = degradarConfianza(cruces, candidatas, existentes);
      if (!degradados.length) { console.log(`\n· ${p.id} (ws ${p.workspace_id}) «${p.fuente_titulo}» — sus ${altas.length} cruces «alta» se sostienen`); return; }

      console.log(`\n· ${p.id} (ws ${p.workspace_id}) «${p.fuente_titulo}»`);
      console.log(`    ${degradados.length} de ${altas.length} cruces «alta» NO se sostienen → pasan a «media» y la tarea vuelve TILDADA`);
      const bajan = new Set(degradados.map((d) => idx[d.i]?.i));
      for (const d of degradados) {
        const t = idx[d.i]?.t;
        console.log(`      «${String(t?.titulo).slice(0, 54)}»`);
        console.log(`         vs «${String(porId.get(t?.enriquece?.id ?? '') ?? '(otro borrador)').slice(0, 54)}» — ${d.porQue}`);
      }
      if (!APLICAR) return;
      const nuevas = ts.map((t, i) => (bajan.has(i) && t.enriquece
        // `incluir` vuelve a undefined (= tildada por default). Si el dueño la había
        // destildado A MANO no se toca: eso es una decisión suya, no del cruce — pero no
        // hay forma de distinguirlas en lo guardado, así que se respeta `ampliar`, que sí
        // es explícito, y se reabre el resto. Un falso destildado esconde trabajo; un
        // tildado de más se destilda con un click.
        ? { ...t, enriquece: { ...t.enriquece, confianza: 'media' }, incluir: t.ampliar === false ? t.incluir : undefined }
        : t));
      const db = await getTenantDb();
      const { error } = await db.from('plan_propuestas').update({ tareas: nuevas })
        .eq('id', p.id).eq('estado', 'pendiente');
      console.log(error ? `    ✗ ${error.message}` : '    ✓ degradados');
    });
  }
  if (!APLICAR) console.log('\n(dry run — con --aplicar se ejecuta)\n');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
