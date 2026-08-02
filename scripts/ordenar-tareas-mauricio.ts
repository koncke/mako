// =============================================================================
// ordenar-tareas-mauricio — cada tarea al proyecto del CLIENTE de su reunión (ws1)
// =============================================================================
// Sin --apply solo IMPRIME. Con --apply escribe, y antes deja backup completo en
// app_settings (mako.backup.orden.*).
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/ordenar-tareas-mauricio.ts
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/ordenar-tareas-mauricio.ts --apply
//
// La regla (la dictó Mauricio): el proyecto lo define LA REUNIÓN de origen, no el
// tema de la tarea. Una llamada con Sergio Esquer deja tareas de Grupo Esquer,
// hablen de sistemas, de capacitación o de cobranza.
//
// CADA movimiento se verifica contra la fuente ANTES de escribir: si la tarea no
// salió de la reunión que dice el mapeo, NO se mueve. El mapeo entero se apoya en
// esa evidencia; sin ella sería adivinar, y mandar trabajo al cliente equivocado
// ensucia el plan de dos clientes a la vez.
//
// NO se tocan las tareas que Mauricio reasignó A MANO (historial actor 'user' con
// "Asignó a"): son decisiones suyas, con motivo escrito.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

// Todo por el cliente de la app (HTTPS), NO por conexión directa a Postgres: el
// host `db.<ref>.supabase.co` no resuelve desde acá, y el script moría en el backup.
import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { editarTarea, listTareas, listCategorias, borrarCategoria } from '../lib/todo';
import { setSetting } from '../lib/settings';

const APLICAR = process.argv.includes('--apply');
const WS = 1;

/** id de tarea → { proyecto destino, la reunión que lo justifica }. */
type Bloque = { destino: number; nombre: string; call: string; ids: number[] };
const BLOQUES: Bloque[] = [
  { destino: 76, nombre: 'Cliente Baja Teriyaki', call: '764886266',
    ids: [216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 229, 230] },
  { destino: 77, nombre: 'Cuenta Grupo Esquer', call: '760170818',
    ids: [231, 232, 233, 234, 235, 236, 239, 240, 242, 244, 245, 247, 250, 251, 253] },
  { destino: 47, nombre: 'Macario Romero', call: 'macario',
    ids: [173, 174, 175, 176, 177, 178] },
];
/** Proyectos temáticos que inventó la IA: se borran SOLO si quedan en 0 tareas. */
const TEMATICOS = [72, 73, 74, 81];
/** El renombre va DESPUÉS de evacuar las 4 de Baja Teriyaki que están acá. */
const RENOMBRE = { id: 47, de: 'Macario Romero', a: 'Macario Romero — HMO Congelados' };

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function main() {
  console.log(APLICAR ? '=== APLICANDO ===\n' : '=== SIMULACIÓN (sin --apply no escribe nada) ===\n');

  await runWithWorkspace(WS, async () => {
    const cats = await listCategorias();
    const tareas = await listTareas();
    const porId = new Map(tareas.map((t) => [t.id, t]));
    const nomCat = (id: number) => cats.find((c) => c.id === id)?.nombre ?? `#${id}`;

    type Mov = { id: number; titulo: string; de: string; a: string; destino: number };
    const mover: Mov[] = [];
    const saltadas: string[] = [];

    for (const b of BLOQUES) {
      if (!cats.some((c) => c.id === b.destino)) { saltadas.push(`proyecto destino ${b.destino} («${b.nombre}») no existe — bloque entero saltado`); continue; }
      // BARRIDO, no lista a mano: TODA tarea cuya fuente sea esa reunión entra al
      // bloque. La lista de ids es el piso (viene de la auditoría); el barrido agarra
      // las que se colaron después, que si no quedan contradiciendo la misma regla.
      const delaReunion = tareas.filter((t) => {
        const f = t.fuente as { url?: string; etiqueta?: string } | null;
        return norm(`${f?.url ?? ''} ${f?.etiqueta ?? ''}`).includes(norm(b.call));
      }).map((t) => t.id);
      for (const id of [...new Set([...b.ids, ...delaReunion])]) {
        const t = porId.get(id);
        if (!t) { saltadas.push(`#${id}: no existe`); continue; }
        // EVIDENCIA: la tarea tiene que venir de la reunión que justifica el movimiento.
        const f = t.fuente as { url?: string; etiqueta?: string } | null;
        const marca = `${f?.url ?? ''} ${f?.etiqueta ?? ''}`;
        if (!norm(marca).includes(norm(b.call))) { saltadas.push(`#${id}: su fuente («${f?.etiqueta ?? 'sin fuente'}») no es la reunión de ${b.nombre} — NO la muevo`); continue; }
        // No pisar una reasignación hecha a mano por el dueño.
        const aMano = t.historial.some((h) => h.actor === 'user' && /asign/i.test(h.text));
        if (aMano) { saltadas.push(`#${id}: la reasignó ${t.historial.find((h) => h.actor === 'user' && /asign/i.test(h.text))?.text.slice(0, 60)} — la dejo`); continue; }
        const actual = t.categorias[0];
        if (actual === b.destino) continue; // ya está donde va
        mover.push({ id, titulo: t.titulo, de: t.categorias.length ? nomCat(actual) : '(sin proyecto)', a: b.nombre, destino: b.destino });
      }
    }

    for (const b of BLOQUES) {
      const suyas = mover.filter((m) => m.destino === b.destino);
      console.log(`\n→ ${b.nombre} (${suyas.length} tareas)`);
      for (const m of suyas) console.log(`   #${m.id}  ${m.de.padEnd(34).slice(0, 34)} → ${m.titulo.slice(0, 54)}`);
    }
    if (saltadas.length) { console.log(`\n⚠ ${saltadas.length} saltada(s):`); for (const s of saltadas) console.log(`   ${s}`); }
    console.log(`\nTOTAL A MOVER: ${mover.length}`);

    if (!APLICAR) { console.log('\n(simulación — nada se escribió)'); return; }

    // Backup de TODO lo que se toca, antes de tocarlo.
    const backup = mover.map((m) => ({ id: m.id, categorias: porId.get(m.id)!.categorias }));
    await setSetting('mako.backup.orden.categorias', JSON.stringify({ tareas: backup, ts: new Date().toISOString() }));
    console.log(`\nbackup → ws${WS} mako.backup.orden.categorias (${backup.length} tareas)`);

    let ok = 0;
    for (const m of mover) {
      const t = porId.get(m.id)!;
      const hist = [{ id: `orden${m.id}`, ts: Date.now(), actor: 'ia' as const,
        text: `MaKo la movió a «${m.a}»: salió de la reunión con ese cliente, y el proyecto lo define la reunión (estaba en «${m.de}»)` },
        ...t.historial].slice(0, 40);
      try { await editarTarea(m.id, { categorias: [m.destino], historial: hist }); ok++; }
      catch (e) { console.error(`   ✗ #${m.id}`, e); }
    }
    console.log(`✓ ${ok}/${mover.length} tareas movidas`);

    // Recién ahora el renombre: si se hacía antes, las 4 de Baja Teriyaki quedaban
    // archivadas bajo el nombre de HMO Congelados — dos clientes ensuciados a la vez.
    const tras = await listTareas();
    const enMacario = tras.filter((t) => t.categorias.includes(RENOMBRE.id));
    const ajenas = enMacario.filter((t) => { const f = t.fuente as { etiqueta?: string } | null; return f?.etiqueta && !norm(f.etiqueta).includes('macario'); });
    if (ajenas.length) console.log(`\n⚠ NO renombro el proyecto ${RENOMBRE.id}: todavía tiene ${ajenas.length} tarea(s) de otra reunión (${ajenas.map((t) => `#${t.id}`).join(', ')})`);
    else {
      const db = await getTenantDb();
      const { error } = await db.from('tarea_categorias').update({ nombre: RENOMBRE.a }).eq('id', RENOMBRE.id);
      if (error) throw new Error(`renombrar ${RENOMBRE.id}: ${error.message}`);
      console.log(`\n✓ proyecto ${RENOMBRE.id} renombrado: «${RENOMBRE.de}» → «${RENOMBRE.a}»`);
    }

    // Los temáticos que inventó la IA, SOLO si quedaron vacíos. Con guarda: borrarlos
    // desde la UI se lleva puestas también todas sus tareas.
    for (const id of TEMATICOS) {
      const n = tras.filter((t) => t.categorias.includes(id)).length;
      if (n > 0) { console.log(`   proyecto ${id} («${nomCat(id)}») todavía tiene ${n} tarea(s) — NO lo borro`); continue; }
      // borrarCategoria limpia además las referencias sueltas; el guard de arriba ya
      // garantizó que no se lleva ninguna tarea puesta.
      await borrarCategoria(id);
      console.log(`   ✓ borrado el proyecto temático ${id} («${nomCat(id)}»), estaba vacío`);
    }

    const huerfanas = tras.filter((t) => !t.categorias.length);
    console.log(`\nTareas sin proyecto: ${huerfanas.length}${huerfanas.length ? ` (${huerfanas.map((t) => `#${t.id}`).join(', ')})` : ' ✓'}`);
  });
}

main().then(() => { console.log('\nLISTO'); process.exit(0); })
  .catch((e) => { console.error('ERROR:', e); process.exit(1); });
