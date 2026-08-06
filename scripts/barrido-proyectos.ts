// =============================================================================
// barrido-proyectos — el detalle de los PROYECTOS, que el otro script no tocaba
// =============================================================================
// Sin --apply solo muestra el diff. Con --apply escribe, con backup.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/barrido-proyectos.ts lote.json
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/barrido-proyectos.ts lote.json --apply
//
// POR QUÉ EXISTE APARTE de `barrido-aplicar`: aquel escribe `plan_tareas.detalle` y
// nunca miró `plan_proyectos.detalle`. El dueño lo vio antes que yo: «lo que falta es el
// formateo del detalle del proyecto, se lee muy feo. E incluso creo que en el anterior
// script eso no lo estás corrigiendo». No lo estaba.
//
// Las partes son OTRAS que las de una tarea (ver PARTES_PROYECTO en detalle-contrato):
// nadie termina un proyecto, así que un «Listo cuando» ahí no significa nada.
//
// Las mismas tres guardas que el otro: backup antes de escribir, se niega a escribir un
// detalle sin al menos dos partes, y se niega a ACORTAR — acá importa el doble, porque
// el contenido de estos textos es rico y lo único que hay que cambiarles es la forma.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { readFileSync } from 'node:fs';
import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { setSetting } from '../lib/settings';
import { evaluarDetalleProyecto } from '../lib/detalle-contrato';

const ARCHIVO = process.argv[2];
const APLICAR = process.argv.includes('--apply');
const PERMITIR_ACORTAR = process.argv.includes('--permitir-acortar');

type Row = Record<string, unknown>;
/** `ws` opcional: sin él se asume el tablero del dueño. Los dos tableros guardan sus
 *  proyectos en tablas distintas —`plan_proyectos` el del dueño, `tarea_categorias` el
 *  de los clientes— y con nombres de columna distintos (`name` vs `nombre`). */
type Item = { ws?: number; id: string; detalle: string };
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : v == null ? d : String(v));
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Solo el texto: comparar largos con los `**` adentro premiaría poner asteriscos. */
const soloTexto = (s: string) => s.replace(/[*#\-\s]+/g, ' ').trim();

async function main() {
  if (!ARCHIVO) throw new Error('Falta el JSON del lote.');
  const items = JSON.parse(readFileSync(ARCHIVO, 'utf8')) as Item[];

  let ok = 0, saltados = 0;
  const backup: Array<{ ws: number; id: string; detalle: string }> = [];

  const porWs = new Map<number, Item[]>();
  for (const i of items) { const w = i.ws ?? 9; porWs.set(w, [...(porWs.get(w) ?? []), i]); }

  for (const [ws, lote] of porWs) {
  await runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const tabla = ws === 9 ? 'plan_proyectos' : 'tarea_categorias';
    const { data, error } = await db.from(tabla).select('*').in('id', lote.map((i) => i.id));
    if (error) throw new Error(`leer ${tabla}: ${error.message}`);
    const actuales = new Map((data ?? []).map((r) => [str((r as Row).id), r as Row]));

    for (const it of lote) {
      const fila = actuales.get(it.id);
      if (!fila) { console.log(`  ✗ ${it.id}: no existe`); saltados++; continue; }
      const viejo = str(fila.detalle);
      const nuevo = it.detalle.trim();
      const ev = evaluarDetalleProyecto(nuevo);
      const nombre = str(fila.name ?? fila.nombre).slice(0, 40);

      if (!ev.conForma) { console.log(`  ✗ «${nombre}»: el detalle nuevo no tiene ni dos de las partes del proyecto`); saltados++; continue; }
      // Comparación por TEXTO, sin los asteriscos: lo que no puede perderse es contenido.
      if (soloTexto(nuevo).length < soloTexto(viejo).length * 0.95 && !PERMITIR_ACORTAR) {
        console.log(`  ✗ «${nombre}»: perdió contenido (${soloTexto(viejo).length} → ${soloTexto(nuevo).length} chars de texto)`); saltados++; continue;
      }
      if (nuevo === viejo) { saltados++; continue; }

      backup.push({ ws, id: it.id, detalle: viejo });
      console.log(`  → ${nombre.padEnd(42)} ${viejo.length} → ${nuevo.length} chars · ${ev.partes.length}/4 partes`);
      if (!APLICAR) { ok++; continue; }

      const hist = arr<Row>(fila.historial);
      hist.push({ id: uid('h'), ts: new Date().toISOString(), actor: 'MaKo', text: 'MaKo le dio forma al detalle del proyecto' });
      const { error: e2 } = await db.from(tabla).update({ detalle: nuevo, historial: hist.slice(-40) }).eq('id', it.id);
      if (e2) { console.error(`  ✗ ${it.id}: ${e2.message}`); saltados++; continue; }
      ok++;
    }
  });
  }

  if (APLICAR && backup.length) {
    const key = `mako.backup.proyectos.${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}`;
    await runWithWorkspace(9, () => setSetting(key, JSON.stringify(backup)));
    console.log(`\n  ✓ backup de ${backup.length} detalles viejos → app_settings/${key}`);
  }
  console.log(`\n  ${ok} ${APLICAR ? 'escritos' : 'listos'} · ${saltados} salteados${APLICAR ? '' : '  (dry-run: agregá --apply)'}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
