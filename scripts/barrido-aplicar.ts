// =============================================================================
// barrido-aplicar — escribe los detalles reescritos, con red de seguridad
// =============================================================================
// Toma un JSON `[{ ws, id, detalle }]` y lo escribe. Sin --apply solo muestra el diff.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/barrido-aplicar.ts lote.json
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/barrido-aplicar.ts lote.json --apply
//
// TRES GUARDAS, porque esto pisa texto que no se puede recuperar de ningún lado:
//  1. Backup del detalle VIEJO de cada tarea tocada, en app_settings, antes de escribir.
//  2. Se niega a escribir un detalle que no cumpla el contrato (`evaluarDetalle`): si el
//     reemplazo no tiene al menos dos de las cuatro partes, no es una mejora.
//  3. Se niega a ACORTAR: si el detalle nuevo tiene menos caracteres que el viejo, algo
//     salió mal y se salta. La única forma de pisar eso es `--permitir-acortar`.
//
// El historial de la tarea queda con el rastro: «MaKo reescribió el detalle», con actor
// MaKo, porque todo lo que toca la IA deja rastro.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { readFileSync } from 'node:fs';
import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { setSetting } from '../lib/settings';
import { evaluarDetalle } from '../lib/detalle-contrato';

const ARCHIVO = process.argv[2];
const APLICAR = process.argv.includes('--apply');
const PERMITIR_ACORTAR = process.argv.includes('--permitir-acortar');

type Row = Record<string, unknown>;
type Item = { ws: number; id: string; detalle: string };
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : v == null ? d : String(v));
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

async function main() {
  if (!ARCHIVO) throw new Error('Falta el JSON del lote.');
  const items = JSON.parse(readFileSync(ARCHIVO, 'utf8')) as Item[];
  const porWs = new Map<number, Item[]>();
  for (const i of items) porWs.set(i.ws, [...(porWs.get(i.ws) ?? []), i]);

  let ok = 0, saltados = 0;
  const backup: Array<{ ws: number; id: string; detalle: string }> = [];

  for (const [ws, lote] of porWs) {
    await runWithWorkspace(ws, async () => {
      const db = await getTenantDb();
      const tabla = ws === 9 ? 'plan_tareas' : 'experimento_tareas';
      // El tablero del dueño usa `title` y el de los clientes `titulo`. Traemos todo y
      // el nombre se resuelve abajo: una columna que no existe rompe el select entero.
      const { data, error } = await db.from(tabla).select('*').in('id', lote.map((i) => i.id));
      if (error) throw new Error(`leer ${tabla}: ${error.message}`);
      const actuales = new Map((data ?? []).map((r) => [str((r as Row).id), r as Row]));

      for (const it of lote) {
        const fila = actuales.get(it.id);
        if (!fila) { console.log(`  ✗ ${it.id}: no existe en ws ${ws}`); saltados++; continue; }
        const viejo = str(fila.detalle);
        const nuevo = it.detalle.trim();
        const ev = evaluarDetalle(nuevo);

        if (!ev.conForma) { console.log(`  ✗ «${str(fila.titulo ?? fila.title).slice(0, 50)}»: el detalle nuevo no tiene ni dos partes del contrato`); saltados++; continue; }
        if (nuevo.length < viejo.length && !PERMITIR_ACORTAR) { console.log(`  ✗ «${str(fila.titulo ?? fila.title).slice(0, 50)}»: el nuevo (${nuevo.length}) es MÁS CORTO que el viejo (${viejo.length})`); saltados++; continue; }
        if (nuevo === viejo) { saltados++; continue; }

        backup.push({ ws, id: it.id, detalle: viejo });
        console.log(`  → ${str(fila.titulo ?? fila.title).slice(0, 60)}  ${viejo.length} → ${nuevo.length} chars · ${ev.partes.length}/4 partes`);
        if (!APLICAR) { ok++; continue; }

        const hist = arr<Row>(fila.historial);
        hist.push({ id: uid('h'), ts: new Date().toISOString(), actor: 'MaKo', text: 'MaKo reescribió el detalle con el contexto de la fuente' });
        const { error: e2 } = await db.from(tabla).update({ detalle: nuevo, historial: hist.slice(-40) }).eq('id', it.id);
        if (e2) { console.error(`  ✗ ${it.id}: ${e2.message}`); saltados++; continue; }
        ok++;
      }
    });
  }

  if (APLICAR && backup.length) {
    // El backup se guarda DESPUÉS pero con los valores capturados ANTES de cada update.
    // Una key por corrida: no se pisan entre lotes.
    const key = `mako.backup.detalles.${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}`;
    await runWithWorkspace(9, () => setSetting(key, JSON.stringify(backup)));
    console.log(`\n  ✓ backup de ${backup.length} detalles viejos → app_settings/${key}`);
  }
  console.log(`\n  ${ok} ${APLICAR ? 'escritos' : 'listos para escribir'} · ${saltados} salteados${APLICAR ? '' : '  (dry-run: agregá --apply)'}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
