// =============================================================================
// arreglar-leila — poda + recategorización + minutos, sobre ws11/ws9 (one-off)
// =============================================================================
// Sin --apply solo IMPRIME lo que haría. Con --apply escribe, y antes deja backup
// en app_settings bajo mako.backup.* (el patrón que ya usa el repo).
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/arreglar-leila.ts
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/arreglar-leila.ts --apply
//
// Qué hace:
//  1. PODA (ws11): borra el proyecto "Escalar la campaña ganadora" y sus 5 tareas.
//     Es lo único que el seed NUEVO no le habría creado: faseMin 3 y ella está en
//     fase 1. Las 5 están en 0%, sin checklist tildada y sin historial humano.
//  2. RECATEGORIZA (ws11): las 19 tareas de su reunión cayeron TODAS en "Setup
//     inicial de MaKo" por el fallback al primer proyecto (ya arreglado en e3aabc3).
//     Van al proyecto que les corresponde, con la corrección en el historial.
//  3. MINUTOS (ws11): el borrador pendiente perdió el minuto de cada tarea camino
//     al borrador (bug de reunion-auto, ya arreglado). Se rellenan desde el cache
//     de Fathom para que las tarjetas que cree Leila abran la grabación en su punto.
//  4. MINUTOS (ws9): mismo backfill sobre las 25 tareas #294-#318 ya creadas.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import postgres from 'postgres';

const APLICAR = process.argv.includes('--apply');
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });
const log = (s = '') => console.log(s);

/** El proyecto correcto de cada tarea de la reunión (hoy están todas en el 39). */
const DESTINO: Record<number, number> = {
  152: 41, 153: 42, 154: 42, 155: 41, 156: 43, 157: 40, 158: 42, 159: 41, 160: 41,
  161: 41, 162: 41, 163: 40, 164: 42, 165: 45, 166: 42, 167: 43, 168: 40, 169: 45, 170: 40,
};
const PODA_PROY = 44;

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const palabras = (s: string) => new Set(norm(s).split(' ').filter((w) => w.length > 3));
const parecido = (a: string, b: string) => {
  const A = palabras(a), B = palabras(b);
  if (!A.size || !B.size) return 0;
  const c = [...A].filter((w) => B.has(w)).length;
  return c / (A.size + B.size - c);
};
const seg = (t: string | number | undefined | null): number | undefined => {
  if (typeof t === 'number') return t;
  if (typeof t !== 'string' || !t.trim()) return undefined;
  const p = t.split(':').map(Number);
  if (p.some(Number.isNaN)) return undefined;
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0];
};
const reloj = (s: number) => (s >= 3600
  ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

async function backup(ws: number, key: string, valor: unknown) {
  if (!APLICAR) return;
  await sql`insert into app_settings (workspace_id, key, value) values (${ws}, ${key}, ${JSON.stringify(valor)})
            on conflict (workspace_id, key) do update set value = excluded.value`;
  log(`   backup → ws${ws} ${key}`);
}

/** Los minutos por título, leídos del cache de Fathom de esa grabación. */
async function minutosDelCache(ws: number, rec: number): Promise<Array<{ titulo: string; minuto?: number; minutos?: number[] }>> {
  const [row] = await sql`select value from app_settings where workspace_id=${ws} and key=${`mako.fathom.cache.${rec}`}`;
  if (!row) return [];
  const v = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
  const arr = Array.isArray(v?.tareas) ? v.tareas : Array.isArray(v) ? v : [];
  return arr.map((t: Record<string, unknown>) => ({
    titulo: String(t.titulo ?? ''),
    minuto: seg(t.minuto as string) ?? (Array.isArray(t.minutos) ? (t.minutos as number[])[0] : undefined),
    minutos: Array.isArray(t.minutos) ? (t.minutos as number[]) : (seg(t.minuto as string) != null ? [seg(t.minuto as string)!] : undefined),
  })).filter((t: { titulo: string }) => t.titulo);
}

async function main() {
  log(APLICAR ? '=== APLICANDO ===\n' : '=== SIMULACIÓN (sin --apply no escribe nada) ===\n');

  // ── 1. PODA ────────────────────────────────────────────────────────────────
  const podar = await sql`select id, titulo, progreso, checklist, historial from experimento_tareas
                          where workspace_id=11 and categorias @> ${sql.json([PODA_PROY])}`;
  const [proy] = await sql`select id, nombre from tarea_categorias where workspace_id=11 and id=${PODA_PROY}`;
  const tocadas = podar.filter((t) => t.progreso > 0
    || (t.checklist as Array<{ done: boolean }>).some((c) => c.done)
    || (t.historial as Array<{ actor: string }>).some((h) => h.actor === 'user'));
  log(`1. PODA — proyecto ${PODA_PROY} "${proy?.nombre}" + ${podar.length} tareas`);
  for (const t of podar) log(`   #${t.id} ${t.titulo}`);
  if (tocadas.length) { log(`   ⚠ ${tocadas.length} tienen trabajo encima — ABORTO la poda`); }
  else if (APLICAR) {
    await backup(11, 'mako.backup.poda.escalar', { proyecto: proy, tareas: podar, ts: new Date().toISOString() });
    const dt = await sql`delete from experimento_tareas where workspace_id=11 and id in ${sql(podar.map((t) => Number(t.id)))}`;
    const dc = await sql`delete from tarea_categorias where workspace_id=11 and id=${PODA_PROY}`;
    log(`   ✓ borradas ${dt.count} tareas y ${dc.count} proyecto`);
  }

  // ── 2. RECATEGORIZAR ───────────────────────────────────────────────────────
  const reu = await sql`select id, titulo, categorias, historial from experimento_tareas
                        where workspace_id=11 and id in ${sql(Object.keys(DESTINO).map(Number))} order by id`;
  const cats = await sql`select id, nombre from tarea_categorias where workspace_id=11`;
  const nom = (id: number) => cats.find((c) => Number(c.id) === id)?.nombre ?? `#${id}`;
  log(`\n2. RECATEGORIZAR — ${reu.length} tareas de la reunión, hoy todas en "${nom(39)}"`);
  const cambios = reu.filter((t) => (t.categorias as number[])[0] !== DESTINO[Number(t.id)]);
  for (const t of cambios) log(`   #${t.id} → ${nom(DESTINO[Number(t.id)])}  · ${String(t.titulo).slice(0, 58)}`);
  if (APLICAR && cambios.length) {
    await backup(11, 'mako.backup.recat.reunion', { tareas: reu.map((t) => ({ id: t.id, categorias: t.categorias })), ts: new Date().toISOString() });
    for (const t of cambios) {
      const dest = DESTINO[Number(t.id)];
      const hist = [{ id: `recat${t.id}`, ts: Date.now(), actor: 'ia', text: `MaKo la movió a «${nom(dest)}»: había caído en «${nom(39)}» por un error al cargar la reunión` },
        ...(t.historial as unknown[])].slice(0, 40);
      await sql`update experimento_tareas set categorias=${sql.json([dest])}, historial=${sql.json(hist as never)}, updated_at=now()
                where workspace_id=11 and id=${t.id}`;
    }
    log(`   ✓ ${cambios.length} tareas movidas`);
  }

  // ── 3. MINUTOS DEL BORRADOR PENDIENTE (ws11) ───────────────────────────────
  const [prop] = await sql`select id, tareas, ref from plan_propuestas where workspace_id=11 and estado='pendiente'`;
  const rec11 = Number(String(prop?.ref ?? '').split(':')[1] || 0);
  const cache11 = await minutosDelCache(11, rec11);
  const tareas11 = (typeof prop.tareas === 'string' ? JSON.parse(prop.tareas) : prop.tareas) as Array<Record<string, unknown>>;
  let con11 = 0;
  const nuevas11 = tareas11.map((t) => {
    if (t.minuto != null) return t;
    const m = cache11.map((c) => ({ c, s: parecido(String(t.titulo), c.titulo) })).sort((a, b) => b.s - a.s)[0];
    if (!m || m.s < 0.6 || m.c.minuto == null) return t;
    con11++;
    return { ...t, minuto: m.c.minuto, minutos: m.c.minutos };
  });
  log(`\n3. MINUTOS del borrador ${prop?.id} (grabación ${rec11}) — ${con11}/${tareas11.length} recuperados del cache`);
  if (APLICAR && con11) {
    await backup(11, 'mako.backup.borrador.sinminutos', { id: prop.id, tareas: tareas11, ts: new Date().toISOString() });
    await sql`update plan_propuestas set tareas=${sql.json(nuevas11 as never)} where workspace_id=11 and id=${prop.id}`;
    log(`   ✓ borrador actualizado`);
  }

  // ── 4. MINUTOS DE LAS 25 TAREAS YA CREADAS (ws9) ───────────────────────────
  const t9 = await sql`select id, num, title, fuente from plan_tareas
                       where workspace_id=9 and fuente->>'etiqueta' = 'Leila con Martin Konke' order by num`;
  const cache9 = await minutosDelCache(9, 169308217);
  const conMin = t9.map((t) => {
    const m = cache9.map((c) => ({ c, s: parecido(String(t.title), c.titulo) })).sort((a, b) => b.s - a.s)[0];
    return { t, min: m && m.s >= 0.6 ? m.c : null, score: m?.s ?? 0 };
  });
  const arreglables = conMin.filter((x) => x.min?.minuto != null);
  log(`\n4. MINUTOS de ws9 — ${t9.length} tareas de esa reunión sin timestamp · ${arreglables.length} recuperables (cache: ${cache9.length} tareas)`);
  for (const x of arreglables.slice(0, 6)) log(`   #${x.t.num} ${reloj(x.min!.minuto!)}  ${String(x.t.title).slice(0, 54)}`);
  if (arreglables.length > 6) log(`   … y ${arreglables.length - 6} más`);
  if (APLICAR && arreglables.length) {
    await backup(9, 'mako.backup.fuente.sinminutos', { tareas: t9.map((t) => ({ id: t.id, fuente: t.fuente })), ts: new Date().toISOString() });
    const url = 'https://fathom.video/calls/767032531';
    for (const x of arreglables) {
      const s = x.min!.minuto!;
      const f = { ...(x.t.fuente as Record<string, unknown>), etiqueta: `Leila con Martin Konke · ${reloj(s)}`, url: `${url}?timestamp=${s}` };
      await sql`update plan_tareas set fuente=${sql.json(f)}, updated_at=now() where workspace_id=9 and id=${x.t.id}`;
    }
    log(`   ✓ ${arreglables.length} tareas con su minuto`);
  }

  // ── 5. RESCATE: los compromisos de Martín que no quedaron en ningún tablero ──
  // La misma llamada se grabó dos veces (un notetaker por participante) y cada
  // lectura se comió compromisos distintos. Estos los capturó SOLO la lectura de
  // Leila, así que hoy no están en el plan de nadie. Van como BORRADOR a ws9: los
  // confirma Martín desde su plan, con el Perro puntuándolos.
  const FALTAN = [
    'Investigar error de API en la generación de checklists de tareas',
    'Consultar con Lea y el equipo cercano sobre la estructura de precios de la app',
    'Calcular el Costo de Adquisición de Cliente (CAC) objetivo para la app',
  ];
  const yaEnWs9 = (await sql`select title from plan_tareas where workspace_id=9`).map((t) => String(t.title));
  const rescatar = FALTAN
    .map((titulo) => ({ titulo, orig: nuevas11.find((t) => parecido(String(t.titulo), titulo) >= 0.7) }))
    .filter((x) => !yaEnWs9.some((t) => parecido(t, x.titulo) >= 0.55));
  log(`\n5. RESCATE a ws9 — ${rescatar.length}/${FALTAN.length} compromisos de Martín que hoy no están en ningún tablero`);
  for (const r of rescatar) log(`   + ${r.titulo}${r.orig?.minuto != null ? ` (min ${reloj(Number(r.orig.minuto))})` : ''}`);
  if (APLICAR && rescatar.length) {
    const { runWithWorkspace } = await import('../lib/workspace');
    const { crearPropuesta } = await import('../lib/plan-propuesta');
    await runWithWorkspace(9, async () => {
      const id = await crearPropuesta({
        ws: 9,
        tareas: rescatar.map((r) => ({
          titulo: r.titulo,
          detalle: r.orig?.detalle ? String(r.orig.detalle) : undefined,
          prioridad: 'media' as const,
          minuto: r.orig?.minuto as number | undefined,
          minutos: r.orig?.minutos as number[] | undefined,
        })),
        origen: 'fathom',
        fuenteTitulo: 'Leila con Martin Konke',
        fuenteUrl: 'https://fathom.video/calls/767103839',
        ref: 'fathom:169308247-rescate',
        resumen: `MaKo encontró ${rescatar.length} compromisos tuyos de «Leila con Martin Konke» que se habían perdido: la misma llamada se grabó dos veces y cada lectura se comió tareas distintas.`,
      });
      log(`   ✓ borrador ${id} creado en tu plan`);
    });
  }

  log(APLICAR ? '\nLISTO' : '\n(simulación — nada se escribió)');
}

main().then(() => sql.end()).then(() => process.exit(0)).catch(async (e) => { console.error('ERROR:', e); await sql.end(); process.exit(1); });
