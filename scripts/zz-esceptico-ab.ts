// READ-ONLY (solo llama a la IA). Experimento decisivo: ¿el ruteo del caso Mindset
// se arregla con el DETALLE, con el PROMPT, o hacen falta los dos?
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });
import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { getSupabaseServer } from '../lib/supabase';
import { chatClaude } from '../lib/anthropic';
import { brandSystem, parseJsonObject } from '../lib/campaign-structurer';
import { renderPrompt, contenidoNoConfiable } from '../lib/prompt-render';
import { RUTEAR_JSON_SHAPE, RUTEAR_SYSTEM_TEMPLATE, RUTEAR_USER_TEMPLATE } from '../lib/mako-guardian';
import { CATALOGO_PROYECTOS, delCatalogo } from '../lib/plan-proyectos-catalogo';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Los parches propuestos ────────────────────────────────────────────────────
const SHAPE_PARCHE = RUTEAR_JSON_SHAPE
  .replace('"nombre": "<1 a 3 palabras>"', '"nombre": "<1 a 4 palabras>"')
  .replace('Una entrada de "asign" por CADA tarea. "nuevos" casi siempre va VACÍO ([]).',
    'Una entrada de "asign" por CADA tarea. "nuevos" es la EXCEPCIÓN: revisá las cuatro condiciones antes de darlo por vacío. Si proponés uno, el mismo nombre tiene que aparecer en el "destino" de sus tareas dentro de "asign".');

const SYS_PARCHE = RUTEAR_SYSTEM_TEMPLATE
  .replace(
    '  3. Es un ÁREA PERMANENTE del negocio, no un proyecto puntual. "Legal y fiscal" sí; "Migrar a Deepseek" no (eso va a Infraestructura). Preguntate: ¿dentro de un año va a seguir cayendo trabajo acá? Si la respuesta es no, entra en uno existente.',
    '  3. Es un LUGAR PERMANENTE donde va a seguir cayendo trabajo: un área del negocio (Legal y fiscal, Soporte) O UNA PANTALLA/FEATURE NUEVA del producto que hoy no existe en la app. Ojo: CASI TODOS los proyectos de la lista son features — CRM, Ads Manager, Onboarding, Closing Analyst nacieron así. Si lo que te piden es CONSTRUIR una pantalla o un módulo nuevo de MaKo, ESE es su proyecto: no lo metas en la tab que más se le parece. Lo que NO abre proyecto es un trabajo puntual DENTRO de una pantalla que ya existe ("migrar a Deepseek" → Infraestructura).')
  .replace(
    'Si dudás, NO lo propongas: la tarea entra en el mejor de la lista y listo. Un proyecto nuevo mal abierto tarda meses en notarse.',
    'Si dudás entre dos proyectos DE LA LISTA, elegí el mejor de la lista. Pero si la duda es si esa pantalla/módulo existe o no, mirá la lista: si NINGUNA de las descripciones lo nombra, es nuevo. Lo que JAMÁS podés hacer es partir en tres proyectos distintos un grupo de tareas que son del mismo tema.')
  .replace(
    '4. El nombre del grupo que propuso el asistente es una PISTA, no una orden: si mezcla temas, repartí cada tarea por su cuenta.',
    '4. El grupo que propuso el asistente es una PISTA si mezcla temas. Pero si TRES O MÁS tareas comparten el mismo grupo y ese grupo describe UN solo tema coherente, es señal FUERTE de que hay un área nueva: evaluá "nuevos" ANTES de repartirlas.\n4b. LEÉ EL DETALLE, NO SOLO EL TÍTULO. El título dice el verbo; el detalle dice qué se construye y dónde.');

async function rutear(tareas: Array<{ titulo: string; grupo?: string; detalle?: string }>, destinos: any[], conDetalle: boolean, conParche: boolean) {
  const tope = tareas.length > 10 ? 200 : 400;
  const tareasStr = tareas.map((t, i) => {
    const det = conDetalle ? (t.detalle ?? '').trim().replace(/\s+/g, ' ').slice(0, tope) : '';
    return `[${i}] ${t.titulo}${t.grupo ? `  (grupo propuesto: "${t.grupo}")` : ''}${det ? `\n     ${det}` : ''}`;
  }).join('\n');
  const plan = destinos.map((o) => `· ${o.nombre}${o.que ? ` — ${o.que}` : ''}${o.n ? ` (${o.n} tareas)` : ''}`).join('\n');
  const sys = await brandSystem(await renderPrompt('guardian.rutear.system', conParche ? SYS_PARCHE : RUTEAR_SYSTEM_TEMPLATE, { jsonShape: conParche ? SHAPE_PARCHE : RUTEAR_JSON_SHAPE }));
  const user = await renderPrompt('guardian.rutear.user', RUTEAR_USER_TEMPLATE, { tareas: contenidoNoConfiable(tareasStr, 'tareas'), plan });
  const raw = await chatClaude(sys, [{ role: 'user', content: user }], { effort: 'medium', maxTokens: 4000, feature: 'mako-guardian', motivo: 'PROBE esceptico ruteo' });
  let obj: any = {};
  try { obj = parseJsonObject(raw); } catch { console.log(`    ⚠ JSON ROTO (${raw.length}c): ${raw.slice(-160)}`); }
  return { obj, rawLen: raw.length, promptLen: sys.length + user.length };
}

async function main() {
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id').eq('capa', 'superadmin');
  const ws = ((wss ?? [])[0] as any).id;

  await runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const { data: prop } = await db.from('plan_propuestas').select('tareas').eq('id', 'propmsgl4cd8byg35').maybeSingle();
    const tareas = ((prop as any)?.tareas ?? []).map((t: any) => ({ titulo: t.titulo, grupo: t.proyecto, detalle: t.detalle }));
    console.log('CASO REAL (borrador propmsgl4cd8byg35):');
    for (const [i, t] of tareas.entries()) console.log(`  [${i}] ${t.titulo}\n      grupo=«${t.grupo}»  detalle(${(t.detalle ?? '').length}c): ${t.detalle}`);

    // destinos EXACTAMENTE como los arma plan-board.ts:271-274
    const { data: projRows } = await db.from('plan_proyectos').select('*');
    const proyectos = (projRows ?? []).map((r: any) => ({ id: r.id, name: r.name, detalle: r.detalle }));
    const cuenta = new Map<string, number>();
    const { data: tRows } = await db.from('plan_tareas').select('labels');
    for (const r of (tRows ?? []) as any[]) for (const l of (r.labels ?? [])) cuenta.set(String(l), (cuenta.get(String(l)) ?? 0) + 1);
    const yaEn = new Set(proyectos.map((p: any) => p.name.trim().toLowerCase()));
    const destinos = [
      ...proyectos.map((p: any) => ({ nombre: p.name, que: delCatalogo(p.name)?.que || p.detalle || '', n: cuenta.get(p.id) ?? 0 })),
      ...CATALOGO_PROYECTOS.filter((c) => !yaEn.has(c.nombre.toLowerCase())).map((c) => ({ nombre: c.nombre, que: c.que })),
    ];
    console.log(`\nDESTINOS: ${destinos.length}\n`);

    const casos: Array<[string, boolean, boolean]> = [
      ['A · HOY (solo título+grupo, prompt actual)', false, false],
      ['B · +DETALLE (prompt actual)            ', true, false],
      ['C · +DETALLE +PROMPT PARCHEADO          ', true, true],
    ];
    for (const [nombre, det, par] of casos) {
      const { obj, rawLen, promptLen } = await rutear(tareas, destinos, det, par);
      const asign = Array.isArray(obj.asign) ? obj.asign : [];
      const nuevos = Array.isArray(obj.nuevos) ? obj.nuevos : [];
      const dest = tareas.map((_: any, i: number) => asign.find((a: any) => Number(a.i) === i)?.destino ?? '(sin)');
      const distintos = new Set(dest.slice(0, 3));
      console.log(`\n${nombre}  [prompt ${promptLen}c → salida ${rawLen}c]`);
      for (const [i, t] of tareas.entries()) console.log(`   [${i}] ${String(t.titulo).slice(0, 46).padEnd(48)} → ${dest[i]}`);
      console.log(`   nuevos: ${nuevos.length ? JSON.stringify(nuevos.map((n: any) => ({ n: n.nombre, t: n.tareas, pq: String(n.porQue ?? '').slice(0, 60) }))) : '[]'}`);
      console.log(`   ⇒ las 3 de Mindset quedaron en ${distintos.size} proyecto(s): ${[...distintos].join(' | ')}`);
    }
  });
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
