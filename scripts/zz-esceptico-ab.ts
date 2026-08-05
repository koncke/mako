// READ-ONLY (solo llama a la IA). Dos preguntas:
//  1) ¿El caso "feature nueva" (Mindset) se arregla con DETALLE, con PROMPT, o con los dos?
//  2) REGRESIÓN: ¿el prompt parcheado vuelve a inventar proyectos donde el catálogo YA
//     cubría (el lote legal/fiscal, que el Perro ruteó BIEN)?
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
type T = { titulo: string; grupo?: string; detalle?: string };

// ── CASO 1: la tanda del dueño (títulos y grupos verbatim; los detalles RICOS son una
// reconstrucción del nivel que produciría el schema arreglado). Las 3 primeras son UN tema.
const MINDSET: T[] = [
  { titulo: 'Diseñar módulo de Diagnóstico de Mindset (Test LOT-R)', grupo: 'Feature Mindset en MaKo',
    detalle: 'Nueva sección DENTRO de la app de MaKo: un test de optimismo disposicional (LOT-R) que el dueño del negocio responde y que devuelve su perfil — optimista extremo, moderado o pesimista. La idea salió de un video de YouTube que mandó Martín. Tiene que ser una pantalla propia con su cuestionario, su scoring y su resultado guardado por workspace, no un texto suelto. Listo cuando el usuario puede responder el test en la app y ve su perfil.' },
  { titulo: 'Crear matriz de impacto Mindset vs Negocio', grupo: 'Feature Mindset en MaKo',
    detalle: 'Cruce entre el perfil de mindset que devuelve el test y las decisiones del negocio: qué hace un optimista extremo con el pricing, con la contratación, con el gasto en ads. Es la segunda pantalla del mismo módulo nuevo de Mindset. Referencia mencionada: Tony Robbins y el calendario de la vida. Listo cuando cada perfil tiene su matriz y se puede leer desde el resultado del test.' },
  { titulo: 'Armar herramientas prácticas de Mindset en la app', grupo: 'Feature Mindset en MaKo',
    detalle: 'Los ejercicios accionables del módulo de Mindset: el calendario de la vida, los recordatorios y las prácticas que salen del perfil del test. Van adentro de la misma pantalla nueva. Decisión estratégica del dueño: validar primero el módulo de Mindset como contenido de Marca Personal antes de construirlo entero.' },
  { titulo: 'Diseñar arquitectura de la Content Machine para Marca Personal', grupo: 'Marca Personal Martín',
    detalle: 'El sistema de producción de contenido de la marca personal de Martín (no del producto): de dónde salen las ideas, cómo se convierten en guiones y cómo se publican. Ejemplos que dio: Fer y Marco de ElevenLabs. Es trabajo de VENDER, no de construir la app.' },
  { titulo: 'Crear repositorio de ideas y referencias de contenido', grupo: 'Marca Personal Martín',
    detalle: 'Un lugar donde juntar las referencias e ideas de contenido de la marca personal: cuentas que sigue, ganchos que le funcionaron a otros, videos guardados. Alimenta a la Content Machine.' },
];

// ── CASO 2 (REGRESIÓN): el lote legal/fiscal REAL del borrador propmsgf6onybim73.
// MaKo propuso DOS proyectos nuevos y el Perro los rechazó BIEN: «Legal y fiscal» los cubre.
// Si el parche hace que acá aparezca un "nuevo", el parche rompe lo que hoy funciona.
const LEGAL: T[] = [
  { titulo: 'Investigar marco legal y exención de responsabilidad sobre scraping y automatizaciones', grupo: 'Legal y Términos de Servicio',
    detalle: 'Analizar responsabilidades legales por uso de web scraping y automatización de mensajes (WhatsApp/Ads/IG). Definir clausulado para liberar a MaKo de responsabilidad por uso indebido o SPAM de los usuarios.' },
  { titulo: 'Redactar e integrar Términos de Servicio, Política de Privacidad y Disclaimer de MaKo', grupo: 'Legal y Términos de Servicio',
    detalle: 'Definir el flujo de aceptación de Términos y Condiciones, Política de Privacidad y Descargo de Responsabilidad en el onboarding de la plataforma.' },
  { titulo: 'Investigar estructura fiscal y apertura de LLC para cobros y pago de comisiones', grupo: 'Estructura Fiscal y Legales MaKo',
    detalle: 'Analizar la apertura de una LLC en EE.UU., optimización impositiva, repatriación de fondos y el circuito legal para emitir pagos de comisiones a partners.' },
  { titulo: 'Definir modelo contractual y fiscal para el programa de partners y referidos', grupo: 'Estructura Fiscal y Legales MaKo',
    detalle: 'Analizar la figura legal y exigencias fiscales (facturación, contratista independiente, retenciones) para el programa de referidos/partners imitando modelos tipo Mercado Pago.' },
  { titulo: 'Establecer mapa de riesgos y umbrales de escala para la ejecución legal y fiscal', grupo: 'Estructura Fiscal y Legales MaKo',
    detalle: 'Determinar en qué punto de usuarios activos o facturación mensual (MRR) se activan las distintas etapas de formalización legal y tributaria sin sobre-costear el inicio.' },
];

const SHAPE_PARCHE = RUTEAR_JSON_SHAPE
  .replace('"nombre": "<1 a 3 palabras>"', '"nombre": "<1 a 4 palabras>"')
  .replace('Una entrada de "asign" por CADA tarea. "nuevos" casi siempre va VACÍO ([]).',
    'Una entrada de "asign" por CADA tarea. "nuevos" es la EXCEPCIÓN, no el default: revisá las CUATRO condiciones antes de darlo por vacío. ⚠️ Si proponés uno en "nuevos", el MISMO nombre TIENE que aparecer como "destino" de esas tareas en "asign" — si no, el proyecto no se crea y las tareas quedan mal ruteadas.');

const SYS_PARCHE = RUTEAR_SYSTEM_TEMPLATE
  .replace(
    '  3. Es un ÁREA PERMANENTE del negocio, no un proyecto puntual. "Legal y fiscal" sí; "Migrar a Deepseek" no (eso va a Infraestructura). Preguntate: ¿dentro de un año va a seguir cayendo trabajo acá? Si la respuesta es no, entra en uno existente.',
    '  3. Es un LUGAR PERMANENTE donde va a seguir cayendo trabajo: un área del negocio (Legal y fiscal, Soporte) O UNA PANTALLA / MÓDULO NUEVO del producto que hoy no existe en la app. Ojo: CASI TODOS los proyectos de la lista son features — CRM, Ads Manager, Onboarding y Closing Analyst nacieron así. Si lo que te piden es CONSTRUIR una pantalla o un módulo nuevo de MaKo, ESE es su proyecto: no lo metas en la tab que más se le parece. Lo que NO abre proyecto es un trabajo puntual DENTRO de una pantalla que ya existe ("migrar a Deepseek" → Infraestructura), ni un tema que un proyecto de la lista YA nombra en su descripción.')
  .replace(
    'Si dudás, NO lo propongas: la tarea entra en el mejor de la lista y listo. Un proyecto nuevo mal abierto tarda meses en notarse.',
    'Si dudás entre dos proyectos DE LA LISTA, elegí el mejor de la lista. Pero si la duda es si esa pantalla o ese módulo YA existe, mirá la lista: si NINGUNA de las descripciones lo nombra, es nuevo. Y lo que JAMÁS podés hacer es PARTIR en tres proyectos distintos un grupo de tareas que son del mismo tema: si no abrís el proyecto, mandalas TODAS al mismo destino.')
  .replace(
    '4. El nombre del grupo que propuso el asistente es una PISTA, no una orden: si mezcla temas, repartí cada tarea por su cuenta.',
    '4. El grupo que propuso el asistente es una PISTA si mezcla temas. Pero si TRES O MÁS tareas comparten el MISMO grupo y ese grupo describe UN solo tema coherente, es una señal FUERTE de que hay un área nueva: evaluá "nuevos" ANTES de repartirlas. (Ojo: que el grupo tenga nombre propio no lo hace nuevo — si un proyecto de la lista ya cubre ese tema, va ahí.)\n4b. LEÉ EL DETALLE, NO SOLO EL TÍTULO. El título dice el verbo; el detalle dice QUÉ se construye y DÓNDE.');

async function rutear(tareas: T[], destinos: any[], conDetalle: boolean, conParche: boolean) {
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
  try { obj = parseJsonObject(raw); } catch { console.log(`    ⚠ JSON ROTO (${raw.length}c): ${raw.slice(-200)}`); }
  return { obj, rawLen: raw.length };
}

async function main() {
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id').eq('capa', 'superadmin');
  const ws = ((wss ?? [])[0] as any).id;

  await runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
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
    console.log(`DESTINOS: ${destinos.length} (tablero ${proyectos.length} + catálogo)\n`);

    const corridas: Array<[string, T[], boolean, boolean, number]> = [
      ['A · MINDSET · solo título+grupo (HOY)        ', MINDSET, false, false, 3],
      ['B · MINDSET · +detalle, prompt actual        ', MINDSET, true, false, 3],
      ['C · MINDSET · +detalle +prompt PARCHEADO     ', MINDSET, true, true, 3],
      ['R1· LEGAL(regresión) · +detalle, prompt actual', LEGAL, true, false, 5],
      ['R2· LEGAL(regresión) · +detalle +PARCHEADO   ', LEGAL, true, true, 5],
    ];
    for (const [nombre, tareas, det, par, nCoh] of corridas) {
      const { obj, rawLen } = await rutear(tareas, destinos, det, par);
      const asign = Array.isArray(obj.asign) ? obj.asign : [];
      const nuevos = Array.isArray(obj.nuevos) ? obj.nuevos : [];
      const dest = tareas.map((_, i) => asign.find((a: any) => Number(a.i) === i)?.destino ?? '(sin)');
      const grupo1 = new Set(dest.slice(0, nCoh));
      console.log(`\n${nombre}  [salida ${rawLen}c]`);
      for (const [i, t] of tareas.entries()) console.log(`   [${i}] ${t.titulo.slice(0, 46).padEnd(48)} → ${dest[i]}`);
      console.log(`   nuevos: ${nuevos.length ? JSON.stringify(nuevos.map((n: any) => ({ nombre: n.nombre, tareas: n.tareas, porQue: String(n.porQue ?? '').slice(0, 80) }))) : '[]'}`);
      console.log(`   ⇒ las ${nCoh} del mismo tema quedaron en ${grupo1.size} proyecto(s): ${[...grupo1].join(' | ')}`);
    }
  });
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
