// =============================================================================
// ai-step-v2 — los AI Step GUARDADOS a la forma v2: una tarjeta por caso (décima tanda)
// =============================================================================
// Pedido de Martín (11/10/2026, FEEDBACK AI STEP 7): «sería mejor solo permitir 1 caso por tarjeta de AI Step,
// y si quieren pueden crear otra tarjeta». Y CRON 2: «Siempre que se hacen modificaciones las automatizaciones ya
// creadas deben acompañar eso. Nunca nada debe quedar en una versión vieja». El diseño, en
// docs/diseno-ai-step-v2.md §8; la decisión de cada fila, en lib/ai-step-migrar.ts (pura, con test).
//
// Qué hace, en TODOS los workspaces (lo creado desde la galería desde el 10/10 también), sobre cada automatización
// NO archivada que tiene un AI Step en `pasos` o en su borrador vigente (mig 0240):
//   · parte cada AI Step de N casos en N tarjetas (las nuevas AL FINAL: la 202 de la #213 sigue en `o1`), pliega
//     el tono adentro de cada respuesta (si no entra en `TOPE_RESPONDER`, la fila se FRENA: no se corta);
//   · ⛔ NO le pone objetivo a ningún caso (revisión del 11/10/2026, lib/ai-step-migrar.ts): el objetivo viaja al
//     redactor y cambiaría lo que se les contesta a los leads. Lo que la tabla de §8.4 sugeriría se IMPRIME;
//   · comprueba que el clasificador vea los MISMOS casos, con el mismo «cuándo», la misma guía y el mismo «sale
//     sola», y el mismo «Otra cosa» (`loQueContesta`): cualquier diferencia FRENA;
//   · convierte también el borrador VIGENTE y lo re-firma (si no, la pestaña abierta queda «desactualizada»);
//   · pone las tarjetas nuevas debajo de la original si ésa tenía una posición guardada.
//
//   npx tsx scripts/ai-step-v2.mts              → SIMULACRO (default): sólo lee e imprime
//   npx tsx scripts/ai-step-v2.mts --simular    → lo mismo, dicho explícito
//   npx tsx scripts/ai-step-v2.mts --aplicar    → escribe (lo decide quien cierra la tanda)
//   opciones: --env=<ruta del .env.local> (default ./.env.local) · --ws=<n> (sólo ese workspace)
//
// ⚠️ PRIMERO EL DEPLOY, DESPUÉS --aplicar. El motor de hoy (novena tanda) toma el PRIMER AI Step como el único
// «Si responde»: con las tarjetas partidas, los demás casos dejarían de contestar sin un error. El código v2 lee
// las dos formas (la expansión cuenta cada caso de una tarjeta vieja como una tarjeta), así que el orden es:
// desplegar → simulacro → --aplicar.
//
// ⚠️ VOLVER A UN DEPLOY ANTERIOR DESPUÉS DE --aplicar ES DESTRUCTIVO (§8.5): el motor de antes lee sólo la
// primera tarjeta y los demás casos dejan de contestar sin error. Lo único que devuelve la forma de antes es el
// RESPALDO: con --aplicar, ANTES de escribir nada, se guardan las filas enteras en `backups/` y se releen; si el
// respaldo no sirve, no se escribe nada.
//
// ⚠️ ESCRIBE CON LA SERVICE ROLE, sin `server-only` (el patrón de scripts/novena-tanda-ws1.mts): cada escritura
// filtra `workspace_id` y es compare-and-set sobre `updated_at`. Si alguien guardó en el medio, no se pisa.
//
// ⚠️ IDEMPOTENTE: una fila ya convertida (un caso por tarjeta, sin tono) no cambia y se
// saltea. Los ids nuevos salen de un sorteo de semilla fija por fila (`sorteoDe(20261011 + id)`) y no chocan con
// los de la historia (`nodo_actual` y `hilos` de sus inscripciones, `nodo_id` de sus envíos).
// =============================================================================

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { config } from 'dotenv';

const arg = (n: string): string | null => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : null;
};
const aplicar = process.argv.includes('--aplicar');
if (aplicar && process.argv.includes('--simular')) throw new Error('--aplicar y --simular a la vez: elige uno');
config({ path: arg('env') ?? '.env.local' });
const soloWs = arg('ws') ? Number(arg('ws')) : null;

const { esPasoIA, idDe } = await import('../lib/flujo-grafo');
const { planDeFila, estable } = await import('../lib/ai-step-migrar');
const { createClient } = await import('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !key) throw new Error('faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (pasa --env=<ruta del .env.local>)');
const db = createClient(url, key, { auth: { persistSession: false } });

type Fila = {
  id: number; workspace_id: number; nombre: string; trigger_tipo: string; activa: boolean; archivada_at: string | null;
  updated_at: string | null; pasos: unknown; pasos_borrador: unknown; posiciones: unknown;
};
type Insc = { id: number; secuencia_id: number; estado: string; paso_actual: number; nodo_actual: string | null; hilos: unknown };

const VIVAS = ['activa', 'pendiente', 'respondio', 'pausada', 'handoff'];
const corto = (t: unknown, n = 70): string => { const s = String(t ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n)}…` : s; };

/** Un sorteo con semilla (mulberry32): el simulacro y --aplicar sacan los MISMOS ids. */
function sorteoDe(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Todas las filas (paginado por id: PostgREST corta en 1000 sin decirlo). */
async function leerFilas(): Promise<Fila[]> {
  const out: Fila[] = [];
  for (let desde = 0; ; desde += 1000) {
    let q = db.from('nutricion_secuencias')
      .select('id, workspace_id, nombre, trigger_tipo, activa, archivada_at, updated_at, pasos, pasos_borrador, posiciones')
      .order('id', { ascending: true }).range(desde, desde + 999);
    if (soloWs != null) q = q.eq('workspace_id', soloWs);
    const { data, error } = await q;
    if (error) throw new Error(`nutricion_secuencias: ${error.message}`);
    out.push(...((data ?? []) as unknown as Fila[]));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

/** Las inscripciones vivas de una secuencia, y los ids de tarjeta que su historia ya vio. */
async function historiaDe(f: Fila): Promise<{ inscs: Insc[]; evitar: Set<string> }> {
  const { data, error } = await db.from('nutricion_inscripciones')
    .select('id, secuencia_id, estado, paso_actual, nodo_actual, hilos')
    .eq('workspace_id', f.workspace_id).eq('secuencia_id', f.id).order('id', { ascending: true }).range(0, 9999);
  if (error) throw new Error(`nutricion_inscripciones #${f.id}: ${error.message}`);
  const todas = (data ?? []) as Insc[];
  const evitar = new Set<string>();
  for (const i of todas) {
    if (i.nodo_actual) evitar.add(i.nodo_actual);
    if (Array.isArray(i.hilos)) for (const h of i.hilos as Array<{ nodo?: unknown }>) if (typeof h?.nodo === 'string') evitar.add(h.nodo);
  }
  for (let desde = 0; ; desde += 1000) {
    const r = await db.from('nutricion_envios').select('id, nodo_id')
      .eq('workspace_id', f.workspace_id).eq('secuencia_id', f.id).not('nodo_id', 'is', null)
      .order('id', { ascending: true }).range(desde, desde + 999);
    if (r.error) throw new Error(`nutricion_envios #${f.id}: ${r.error.message}`);
    for (const x of (r.data ?? []) as Array<{ nodo_id: string }>) evitar.add(x.nodo_id);
    if ((r.data ?? []).length < 1000) break;
  }
  return { inscs: todas.filter((i) => VIVAS.includes(i.estado)), evitar };
}

const tieneIA = (x: unknown): boolean => Array.isArray(x) && x.some((p) => esPasoIA(p as never));
const borradorTieneIA = (x: unknown): boolean => !!x && typeof x === 'object' && tieneIA((x as { pasos?: unknown }).pasos);

// ═════════════════════════════════════════════════════════════════════════════════════════════════

console.log(`\n══ AI STEP v2${soloWs != null ? ` · ws${soloWs}` : ' · todos los workspaces'} — ${aplicar ? 'APLICANDO' : 'SIMULACRO (sólo lee, no escribe nada)'} · ${new Date().toISOString()} ══`);

const filas = await leerFilas();
const conIA = filas.filter((f) => tieneIA(f.pasos) || borradorTieneIA(f.pasos_borrador));
const archivadas = conIA.filter((f) => f.archivada_at);
const candidatas = conIA.filter((f) => !f.archivada_at);
console.log(`\n${filas.length} automatizaciones leídas · ${conIA.length} con AI Step (${archivadas.length} archivadas: no se tocan)`);

type Resultado = { f: Fila; plan: ReturnType<typeof planDeFila> };
const resultados: Resultado[] = [];
for (const f of candidatas) {
  const h = await historiaDe(f);
  const plan = planDeFila(f, { rnd: sorteoDe(20261011 + f.id), evitar: h.evitar, inscs: h.inscs });
  resultados.push({ f, plan });
  const pasos = Array.isArray(f.pasos) ? f.pasos as never[] : [];
  const ias = pasos.filter((p) => esPasoIA(p));
  const casos = ias.reduce((s, p) => s + ((p as { casos?: unknown[] }).casos?.length ?? 0), 0);
  console.log(`\n── #${f.id} · ws${f.workspace_id} · «${corto(f.nombre, 50)}» · ${f.activa ? 'activa' : 'pausada'} · ${ias.length} AI Step con ${casos} caso(s) · ${h.inscs.length} inscripción(es) viva(s)`);
  if (!plan.cambia) { console.log('  · ya está en la forma v2: nada que hacer'); continue; }
  for (const p of plan.pasos) {
    if (!esPasoIA(p)) continue;
    const c = p.casos?.[0];
    console.log(`  · ${p.id}${plan.nuevas.includes(p.id!) ? ' (nueva)' : ''}: «${corto(c?.titulo, 40)}»${c?.cualquiera ? ' · cualquier respuesta' : ''} → ${c?.objetivo ? `objetivo «${corto(c.objetivo, 50)}»` : 'sin objetivo'}${p.instrucciones ? ' · ⚠ conserva el tono (no entraba)' : ''}`);
  }
  if (plan.borrador) console.log(`  · borrador vigente: también se convierte (${plan.borrador.pasos.length} tarjetas) y se re-firma`);
  if (plan.posiciones) console.log(`  · posiciones: ${plan.nuevas.length} tarjeta(s) nueva(s) debajo de la original`);
  for (const t of plan.sugeridos) console.log(`  · objetivo sugerido para «${corto(t.titulo, 40)}»: «${corto(t.objetivo, 60)}» (NO se escribe: §10-A; se pone a mano en el panel)`);
  for (const t of plan.sinObjetivo) console.log(`  ⚠ «${corto(t, 50)}» no está en la tabla de §8.4: queda sin objetivo (no frena)`);
  for (const a of plan.avisos) console.log(`  ⚠ ${a}`);
  for (const fr of plan.frenos) console.log(`  ✖ ${fr}`);
}

const aEscribir = resultados.filter((r) => r.plan.cambia && !r.plan.frenos.length);
const frenadas = resultados.filter((r) => r.plan.cambia && r.plan.frenos.length);
console.log(`\n══ Resumen: ${aEscribir.length} a escribir · ${frenadas.length} frenada(s) · ${resultados.length - aEscribir.length - frenadas.length} sin cambios ══`);
for (const r of frenadas) console.log(`  ✖ #${r.f.id} (ws${r.f.workspace_id}): ${r.plan.frenos.join(' · ')}`);

if (!aplicar) {
  console.log('\nSIMULACRO: no se escribió nada. Con --aplicar (DESPUÉS de desplegar el motor v2) se escriben las filas «a escribir», con respaldo antes.');
  process.exit(0);
}

// ── Con --aplicar: el respaldo primero, releído; si no sirve, nada se escribe ─────────────────────
const RESPALDO = `backups/ai-step-v2-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
mkdirSync('backups', { recursive: true });
writeFileSync(RESPALDO, JSON.stringify({ hecho_at: new Date().toISOString(), filas: aEscribir.map((r) => r.f) }, null, 1), 'utf8');
const vuelta = JSON.parse(readFileSync(RESPALDO, 'utf8')) as { filas?: Fila[] };
const malas = aEscribir.filter((r) => {
  const x = (vuelta.filas ?? []).find((y) => y?.id === r.f.id);
  return !x || !Array.isArray(x.pasos) || estable(x.pasos) !== estable(r.f.pasos) || x.updated_at !== r.f.updated_at;
});
if (malas.length) throw new Error(`el respaldo ${RESPALDO} no sirve (${malas.map((r) => `#${r.f.id}`).join(', ')}): no se escribió nada`);
console.log(`\n✓ respaldo de ${aEscribir.length} fila(s) enteras: ${RESPALDO}`);

let ok = 0;
for (const { f, plan } of aEscribir) {
  const cambios: Record<string, unknown> = { pasos: plan.pasos, updated_at: new Date().toISOString() };
  if (plan.borrador) cambios.pasos_borrador = plan.borrador;
  if (plan.posiciones) cambios.posiciones = plan.posiciones;
  let q = db.from('nutricion_secuencias').update(cambios).eq('id', f.id).eq('workspace_id', f.workspace_id);
  q = f.updated_at ? q.eq('updated_at', f.updated_at) : q.is('updated_at', null);
  const { data, error } = await q.select('id, pasos');
  if (error) { console.log(`  ✖ #${f.id}: ${error.message}`); continue; }
  const fila = ((data ?? []) as Array<{ id: number; pasos: unknown }>)[0];
  if (!fila) { console.log(`  ✖ #${f.id}: cambió mientras tanto (updated_at): no se pisó. Vuelve a correr el simulacro.`); continue; }
  // Se relee lo que quedó: una LISTA con las mismas tarjetas (no un texto con el JSON adentro: AGENTS.md, «el
  // respaldo corrompió lo que venía a proteger»).
  if (!Array.isArray(fila.pasos) || estable((fila.pasos as never[]).map((p, i) => idDe(p, i))) !== estable(plan.pasos.map((p, i) => idDe(p, i)))) {
    console.log(`  ✖ #${f.id}: lo escrito no es lo planeado — revisar a mano con el respaldo ${RESPALDO}`);
    continue;
  }
  ok++;
  console.log(`  ✓ #${f.id} (ws${f.workspace_id}): ${plan.nuevas.length} tarjeta(s) nueva(s)${plan.borrador ? ' · borrador re-firmado' : ''}`);
}
console.log(`\n══ ${ok} de ${aEscribir.length} escritas ══`);
