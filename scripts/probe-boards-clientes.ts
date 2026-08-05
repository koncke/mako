// =============================================================================
// probe-boards-clientes — foto completa de los tableros de CLIENTE. SOLO LEE.
// =============================================================================
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/probe-boards-clientes.ts
//   ... 1 11        → solo esos workspaces (default: 1 y 11)
//   ... --json      → JSON crudo para analizar con agentes
//
// Mide lo que hay que medir ANTES de reordenar nada (mismo enfoque que
// scripts/reordenar-plan-superadmin.ts, pero sobre experimento_tareas +
// tarea_categorias, que es el board del cliente).
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { getSupabaseServer } from '../lib/supabase';
import { listTareas, listCategorias, type Tarea, type Categoria } from '../lib/todo';
import { delCatalogoTodo, PREFIJO_CLIENTE, NOMBRES_TODO } from '../lib/todo-proyectos-catalogo';
import { getDiagnosticoFase } from '../lib/fase-store';

/** El MISMO norm que usa lib/todo-rutear.ts:29 — NO borra puntuación. Con este se
 *  decide si un proyecto queda FUERA del menú de destinos por ser de un cliente. */
const normRutear = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const JSONOUT = process.argv.includes('--json');
const WSS = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
const WORKSPACES = WSS.length ? WSS : [1, 11];

// score de fábrica: lib/todo.ts scoreDePrioridad — alta 85, media 62, baja 37, futuro 12
const FABRICA = new Set([85, 62, 37, 12]);

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['para', 'como', 'este', 'esta', 'esto', 'todo', 'toda', 'desde', 'hasta', 'sobre', 'entre', 'cada', 'donde', 'cual', 'sus', 'los', 'las', 'del', 'con', 'por', 'que', 'una', 'uno']);
const palabras = (s: string) => new Set(norm(s).split(' ').filter((w) => w.length > 3 && !STOP.has(w)));
/** Jaccard sobre palabras significativas del título + primeras del detalle. */
const parecido = (a: string, b: string) => {
  const A = palabras(a), B = palabras(b);
  if (!A.size || !B.size) return 0;
  const c = [...A].filter((w) => B.has(w)).length;
  return c / (A.size + B.size - c);
};

type Lead = { id: number; nombre: string | null; empresa: string | null; email: string | null };
type Foto = {
  ws: number; nombre: string;
  proyectos: Categoria[]; tareas: Tarea[];
  leads: Lead[]; fase: unknown;
};

async function foto(ws: number, nombre: string): Promise<Foto> {
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const { data } = await db.from('leads').select('id, nombre, empresa, email').eq('estado_lead', 'ganado').limit(200);
    return {
      ws, nombre,
      proyectos: await listCategorias(),
      tareas: await listTareas(),
      leads: (data ?? []) as Lead[],
      fase: await getDiagnosticoFase().catch(() => null),
    };
  });
}

function reportar(f: Foto) {
  const { proyectos: P, tareas: T } = f;
  const abiertas = T.filter((t) => t.estado !== 'hecho');
  const nom = (id: number) => P.find((c) => c.id === id)?.nombre ?? `?${id}`;

  console.log(`\n${'='.repeat(78)}`);
  console.log(`ws${f.ws} — ${f.nombre}`);
  console.log('='.repeat(78));

  // (a)
  console.log(`\n(a) ${P.length} proyectos · ${T.length} tareas · ${abiertas.length} abiertas (${T.length - abiertas.length} hechas)`);
  console.log(`    fase del negocio: ${JSON.stringify(f.fase)}`);
  console.log(`    clientes en el CRM (leads ganados): ${f.leads.length} → ${f.leads.map((l) => `«${l.empresa ?? l.nombre}»`).join(', ') || '—'}`);

  // El guard de lib/todo-rutear.ts:66 saca del menú a los proyectos de cliente. Si no
  // dispara, una tarea que no nombra a NADIE puede caer en el proyecto de un cliente.
  const noExcluidos = P.filter((c) => !normRutear(c.nombre).startsWith(normRutear(PREFIJO_CLIENTE)));
  console.log(`\n    ¿el filtro de clientes de todo-rutear:66 excluye a alguno? ${P.length - noExcluidos.length}/${P.length}`);
  for (const c of P) {
    const ex = normRutear(c.nombre).startsWith(normRutear(PREFIJO_CLIENTE));
    console.log(`      ${ex ? '✓ excluido' : '✗ EN EL MENÚ'}  ${JSON.stringify(c.nombre)}`);
  }

  // (b)
  console.log(`\n(b) PROYECTOS  [1] = una sola tarea · [∅] = vacío · [X] = fuera del catálogo nuevo`);
  const conteo = P.map((c) => {
    const suyas = T.filter((t) => t.categorias.includes(c.id));
    return { c, n: suyas.length, ab: suyas.filter((t) => t.estado !== 'hecho').length, suyas };
  }).sort((a, b) => b.n - a.n);
  for (const { c, n, ab, suyas } of conteo) {
    const esCliente = norm(c.nombre).startsWith(norm(PREFIJO_CLIENTE));
    const enCat = !!delCatalogoTodo(c.nombre);
    const marca = n === 0 ? '[∅]' : n === 1 ? '[1]' : '   ';
    const cat = enCat ? '   ' : esCliente ? '[C]' : '[X]';
    console.log(`  ${marca}${cat} id=${String(c.id).padStart(3)} ${c.emoji} ${c.nombre.padEnd(40).slice(0, 40)} ${String(n).padStart(3)} tareas (${ab} abiertas)  prio=${c.prioridad} det=${(c.detalle ?? '').length}`);
    const fuentes = new Set(suyas.map((t) => (t.fuente as { etiqueta?: string } | null)?.etiqueta).filter(Boolean));
    if (fuentes.size) console.log(`            de: ${[...fuentes].map((x) => `«${String(x).slice(0, 46)}»`).join(' · ')}`);
  }
  const fueraCat = conteo.filter(({ c }) => !delCatalogoTodo(c.nombre) && !norm(c.nombre).startsWith(norm(PREFIJO_CLIENTE)));
  console.log(`\n    fuera del catálogo: ${fueraCat.length}/${P.length} → ${fueraCat.map(({ c, n }) => `«${c.nombre}»(${n})`).join(', ') || '—'}`);
  const unaSola = conteo.filter((x) => x.n === 1);
  console.log(`    de UNA sola tarea: ${unaSola.length} → ${unaSola.map(({ c }) => `«${c.nombre}»`).join(', ') || '—'}`);
  const vacios = conteo.filter((x) => x.n === 0);
  console.log(`    VACÍOS: ${vacios.length} → ${vacios.map(({ c }) => `«${c.nombre}»`).join(', ') || '—'}`);

  // proyectos con nombre parecido entre sí (candidatos a fundir)
  const parPro: string[] = [];
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const s = parecido(P[i].nombre, P[j].nombre);
    if (s >= 0.3) parPro.push(`«${P[i].nombre}» ~ «${P[j].nombre}» (${s.toFixed(2)})`);
  }
  console.log(`    proyectos de nombre parecido: ${parPro.length}${parPro.length ? `\n      ${parPro.join('\n      ')}` : ''}`);

  // (c) tareas duplicadas entre sí
  console.log(`\n(c) TAREAS PARECIDAS (jaccard ≥ 0.34 sobre título+detalle; revisar a ojo)`);
  const pares: Array<{ a: Tarea; b: Tarea; s: number }> = [];
  const txt = (t: Tarea) => `${t.titulo} ${(t.detalle ?? '').slice(0, 240)}`;
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
    const sT = parecido(T[i].titulo, T[j].titulo);
    const sD = parecido(txt(T[i]), txt(T[j]));
    const s = Math.max(sT, sD * 0.9);
    if (s >= 0.34) pares.push({ a: T[i], b: T[j], s });
  }
  pares.sort((x, y) => y.s - x.s);
  for (const p of pares) {
    console.log(`  ${p.s.toFixed(2)}  #${p.a.id} [${nom(p.a.categorias[0] ?? -1)}|${p.a.progreso}%] ${p.a.titulo.slice(0, 58)}`);
    console.log(`        #${p.b.id} [${nom(p.b.categorias[0] ?? -1)}|${p.b.progreso}%] ${p.b.titulo.slice(0, 58)}`);
  }
  if (!pares.length) console.log('  — ninguno —');

  // (d) score del Perro
  const conRazon = T.filter((t) => (t.score_razon ?? '').trim().length > 0);
  const deFabrica = T.filter((t) => !(t.score_razon ?? '').trim() && FABRICA.has(t.score));
  const raro = T.filter((t) => !(t.score_razon ?? '').trim() && !FABRICA.has(t.score));
  console.log(`\n(d) PERRO: ${conRazon.length}/${T.length} con score + razón · ${deFabrica.length} con score de fábrica (sin razón) · ${raro.length} sin razón y score fuera de fábrica`);
  console.log(`    de fábrica: ${deFabrica.map((t) => `#${t.id}(${t.score})`).join(' ') || '—'}`);
  if (raro.length) console.log(`    raros: ${raro.map((t) => `#${t.id}(${t.score})`).join(' ')}`);

  // (e) detalle pobre + sin proyecto
  const pobre = T.filter((t) => (t.detalle ?? '').trim().length < 200);
  const pobreAbierta = pobre.filter((t) => t.estado !== 'hecho');
  const sinProy = T.filter((t) => !t.categorias.length);
  const sinChecklist = T.filter((t) => !t.checklist.length && t.estado !== 'hecho');
  console.log(`\n(e) detalle < 200 car: ${pobre.length}/${T.length} (${pobreAbierta.length} abiertas) · sin proyecto: ${sinProy.length} · abiertas sin checklist: ${sinChecklist.length}`);
  console.log(`    sin proyecto: ${sinProy.map((t) => `#${t.id}`).join(' ') || '—'}`);

  // (f) hechas / posiblemente obsoletas
  const hechas = T.filter((t) => t.estado === 'hecho');
  const vencidas = abiertas.filter((t) => t.deadline && t.deadline < new Date().toISOString().slice(0, 10));
  const viejas = abiertas.filter((t) => t.progreso === 0 && Date.now() - new Date(t.created_at).getTime() > 45 * 864e5);
  console.log(`\n(f) HECHAS: ${hechas.length} → ${hechas.map((t) => `#${t.id}`).join(' ') || '—'}`);
  console.log(`    deadline VENCIDO y abiertas: ${vencidas.length} → ${vencidas.map((t) => `#${t.id}(${t.deadline})`).join(' ') || '—'}`);
  console.log(`    abiertas en 0% con +45 días: ${viejas.length} → ${viejas.map((t) => `#${t.id}`).join(' ') || '—'}`);

  // Volcado tarea por tarea
  console.log(`\n--- TAREAS (${T.length}) ---`);
  for (const t of [...T].sort((a, b) => a.id - b.id)) {
    const fu = t.fuente as { tipo?: string; etiqueta?: string } | null;
    const det = (t.detalle ?? '').replace(/\s+/g, ' ').trim();
    const hUser = t.historial.filter((h) => h.actor === 'user').length;
    console.log(`\n  #${String(t.id).padStart(3)} [${String(t.score).padStart(3)}|${t.prioridad}|${t.progreso}%|${t.estado}] ${t.titulo}`);
    console.log(`       proy: ${t.categorias.map(nom).join(', ') || '— SIN PROYECTO —'}  origen: ${t.origen}  fuente: ${fu?.tipo ?? '—'}${fu?.etiqueta ? ` «${fu.etiqueta.slice(0, 46)}»` : ''}`);
    console.log(`       creada: ${t.created_at.slice(0, 10)}  deadline: ${t.deadline ?? '—'}  checklist: ${t.checklist.length}  hist(user): ${hUser}  razón: ${t.score_razon ? `«${t.score_razon.slice(0, 90)}»` : '— NINGUNA —'}`);
    console.log(`       detalle (${det.length} car): ${det.slice(0, 260)}${det.length > 260 ? '…' : ''}`);
  }
}

async function main() {
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id, nombre, capa').in('id', WORKSPACES);
  const meta = new Map(((wss ?? []) as Array<{ id: number; nombre: string; capa: string }>).map((w) => [w.id, w]));

  const fotos: Foto[] = [];
  for (const ws of WORKSPACES) {
    const m = meta.get(ws);
    fotos.push(await foto(ws, m ? `${m.nombre} (capa ${m.capa})` : '¿?'));
  }

  if (JSONOUT) { console.log(JSON.stringify(fotos, null, 1)); return; }
  console.log(`CATÁLOGO NUEVO: ${NOMBRES_TODO.join(' · ')} + «${PREFIJO_CLIENTE}NOMBRE»`);
  for (const f of fotos) reportar(f);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
