import 'server-only';

// =============================================================================
// todo-seeds — board /plan por defecto para clientes nuevos (G4, proyectos finitos)
// =============================================================================
// Un PROYECTO es una INICIATIVA FINITA (inicio y fin), NO un área infinita:
//   MAL: "Adquisición & Ads" · BIEN: "Encontrar el primer anuncio ganador".
// Los DATOS viven en todo-seeds-data.ts (sin server-only, compartido con el script
// de reseed de Mauricio). Acá solo el insert tenant-scoped (getTenantDb).
// Idempotente: solo siembra si el cliente todavía no tiene ni proyectos ni tareas.
// =============================================================================

import { getCapaActual, getTenantDb } from './workspace';
import { capaDef } from './capas';
import type { Categoria, Tarea } from './todo';
import { editarTarea } from './todo';
import { buildCatRows, buildTarRows, seedRelevante, senalesCumplidas, SEED_TAREAS, EVIDENCIA_SENAL } from './todo-seeds-data';
import { estadoParaSeed, leerSenales } from './plan-senales';

export { SEED_CATEGORIAS } from './todo-seeds-data';

/**
 * Siembra el board por defecto (proyectos finitos + tareas) SOLO si el cliente todavía
 * no tiene ninguno. Idempotente: re-chequea antes de insertar. Devuelve las categorías
 * creadas.
 *
 * El seed NO es igual para todos: se recorta a la FASE y al CANAL del negocio
 * (lib/plan-senales.ts) y las tareas que las señales dan por resueltas nacen
 * completadas con su evidencia. Antes esto era un `if (slug === 'mauricio')`
 * hardcodeado y a todo cliente nuevo le caían 34 tareas iguales, varias de cosas que
 * ya había resuelto en el onboarding.
 *
 * OJO — el seed es el de un negocio que vende con ads + funnel VSL ("Conectar Meta
 * Ads", "Encontrar el primer anuncio ganador"…). Para una capa que NO compró eso,
 * son proyectos y tareas del negocio de otro: le dicen que su trabajo es algo que no
 * hace. Esas capas arrancan con el board limpio y crean sus proyectos con MaKo (que
 * ya sabe proponerlos). Lo decide capas.ts, no un `if` acá.
 */
export async function seedTodoBoardSiVacio(): Promise<Categoria[]> {
  if (!capaDef(await getCapaActual()).seedBoardVsl) return [];
  const supabase = await getTenantDb();
  const [{ data: cats0, error: e1 }, { data: tar0, error: e2 }] = await Promise.all([
    supabase.from('tarea_categorias').select('id').limit(1),
    supabase.from('experimento_tareas').select('id').limit(1),
  ]);
  if (e1) throw new Error(`seedTodoBoard(select cat): ${e1.message}`);
  if (e2) throw new Error(`seedTodoBoard(select tar): ${e2.message}`);
  if ((cats0 && cats0.length) || (tar0 && tar0.length)) return []; // ya arrancó su plan → no tocar

  // Lo que MaKo ya sabe del negocio: en qué fase está, por qué canal vende y qué
  // tiene resuelto. Con eso se recorta el seed ANTES de insertar nada.
  const { senales, ctx } = await estadoParaSeed();
  const { proyectos, tareas } = seedRelevante(ctx);
  if (!proyectos.length) return [];
  // Un proyecto cuyas tareas están TODAS resueltas nace completo (y sin ser el norte).
  const yaHechos = new Set(proyectos.map((p) => p.key).filter((k) => {
    const suyas = tareas.filter((t) => t.cat === k);
    return suyas.length > 0 && suyas.every((t) => senalesCumplidas(t, senales));
  }));

  const now = Date.now();
  const { filas: filasCat, deadlinePorKey } = buildCatRows(now, proyectos, yaHechos);
  const { data: catsIns, error: eIns } = await supabase.from('tarea_categorias').insert(filasCat).select('*');
  if (eIns) throw new Error(`seedTodoBoard(insert cat): ${eIns.message}`);
  const creadas = (catsIns ?? []) as unknown as Categoria[];
  const idPorKey = new Map<string, number>();
  proyectos.forEach((c, i) => { const row = creadas[i]; if (row) idPorKey.set(c.key, row.id); });

  const filasTar = buildTarRows(now, idPorKey, deadlinePorKey, tareas, senales);
  const { error: eTar } = await supabase.from('experimento_tareas').insert(filasTar);
  if (eTar) throw new Error(`seedTodoBoard(insert tar): ${eTar.message}`);
  console.log(`[plan-seed] sembrados ${filasCat.length} proyectos y ${filasTar.length} tareas (${filasTar.filter((t) => t.progreso >= 100).length} ya hechas)`);
  return creadas;
}

// ── Auto-completado vivo ─────────────────────────────────────────────────────
// Marcar hecho al sembrar no alcanza: el cliente conecta Meta el martes y la
// tarjeta "Conectar la cuenta de Meta Ads" le queda pendiente para siempre,
// pidiéndole algo que ya hizo. Cada vez que abre su plan se re-chequean las
// señales de las tarjetas del seed que siguen pendientes y las que ya están
// resueltas se cierran solas, con la evidencia en el historial.

const MARCA_AUTO = 'MaKo la marcó hecha';

/** Las tarjetas del seed que siguen pendientes y podrían cerrarse por señal.
 *  Se saltea las que MaKo YA cerró alguna vez: si el cliente la reabrió es porque
 *  no está de acuerdo, y volvérsela a cerrar en cada carga sería pisarle la decisión. */
const candidatasAutocompletar = (tareas: Tarea[]) => {
  const porTitulo = new Map(SEED_TAREAS.filter((t) => t.listo?.length).map((t) => [t.titulo, t] as const));
  return tareas
    .filter((t) => t.origen === 'mako' && t.progreso < 100 && !t.historial.some((h) => h.text.startsWith(MARCA_AUTO)))
    .map((t) => ({ tarea: t, seed: porTitulo.get(t.titulo) }))
    .filter((x): x is { tarea: Tarea; seed: NonNullable<ReturnType<typeof porTitulo.get>> } => !!x.seed);
};

/**
 * Cierra las tareas del plan que las señales del negocio ya dan por resueltas.
 * Se apoya en las tareas YA cargadas por la página: si ninguna es candidata, no
 * consulta nada. Best-effort — nunca rompe el render del board. Devuelve cuántas
 * cerró (0 = no hizo falta tocar la DB).
 */
export async function autocompletarPorSenales(tareas: Tarea[]): Promise<number> {
  const candidatas = candidatasAutocompletar(tareas);
  if (!candidatas.length) return 0;
  const senales = await leerSenales();
  const cerrar = candidatas.filter((c) => senalesCumplidas(c.seed, senales));
  if (!cerrar.length) return 0;

  let n = 0;
  for (const { tarea, seed } of cerrar) {
    const porQue = (seed.listo ?? []).map((k) => EVIDENCIA_SENAL[k]).join(' y ');
    try {
      await editarTarea(tarea.id, {
        progreso: 100,
        checklist: tarea.checklist.map((c) => ({ ...c, done: true })),
        historial: [{ id: `auto${Date.now()}${tarea.id}`, ts: Date.now(), actor: 'ia', text: `MaKo la marcó hecha: ${porQue}` }, ...tarea.historial],
      });
      n++;
    } catch (e) { console.error(`[plan-auto] no pude cerrar "${tarea.titulo}"`, e); }
  }
  if (n) console.log(`[plan-auto] ${n} tarea(s) cerradas solas por señales del negocio`);
  return n;
}
