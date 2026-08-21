import 'server-only';

// =============================================================================
// plan-proyecto-vacio — un proyecto sin tareas no es poco importante, está VACÍO
// =============================================================================
// La corrección del dueño, textual: *«Un proyecto vacío NO debe tener una puntuación de 1.
// Todo lo contrario. Si se creó un proyecto es por algo… Lo que se debe hacer es cargarle
// tareas. Y para ello, MaKo debería primero intuir posibles tareas y hacer el mismo form
// que ya usamos de preguntas cuando un proyecto esté vacío.»*
//
// Tenía razón y el error era de categoría: la primera versión de `scoreProyectoDerivado`
// los mandaba al fondo, o sea trataba «no sé» como «no importa». Un proyecto sin tareas no
// es de baja prioridad: es DESCONOCIDO. Lo que le falta es TRABAJO, no puntaje — y eso se
// arregla llenándolo, no hundiéndolo. Hoy `scoreProyectoDerivado` devuelve `null` para esos
// y el caller le deja el score que le puso el Perro.
//
// ⚠️ NO ESCRIBE NINGUNA TAREA. Deja un BORRADOR en `plan_propuestas` y devuelve el link a
// `/plan/revisar/<id>`, que es la regla de la casa: un canal PROPONE, una persona confirma.
// Acá pesa doble, porque lo que se propone salió de una intuición sobre un nombre de
// proyecto — es lo más especulativo que produce MaKo en todo el tablero.
//
// Y reusa el MISMO form de preguntas que el resto (`preguntasParaCargar`), tal cual lo
// pidió: no hay una segunda pantalla de revisión ni un segundo contrato de preguntas.
// =============================================================================

import { getTenantDb, runWithWorkspace, getWorkspaceActual, OWNER_WS } from '@/lib/workspace';
import { chatCheapCascade, errorDeCascada } from '@/lib/ai-cheap';
import { parseJsonObject } from '@/lib/campaign-structurer';
import { crearPropuesta, preguntasParaCargar, type PropuestaTarea } from '@/lib/plan-propuesta';
import { faseNegocioTexto } from '@/lib/fase-store';
import { contenidoNoConfiable } from '@/lib/prompt-render-pure';
import { MOLDE_DETALLE } from '@/lib/detalle-contrato';

type Row = Record<string, unknown>;
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const asArr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

const enPlan = async <T,>(fn: () => Promise<T>): Promise<T> =>
  runWithWorkspace((await getWorkspaceActual()) ?? OWNER_WS, fn);

export type ProyectoVacio = { id: string; nombre: string; emoji: string; detalle: string; score: number };

/**
 * Los proyectos del tablero del dueño que no tienen NI UNA tarea abierta.
 *
 * Incluye a propósito los que tienen todas sus tareas terminadas: un proyecto cerrado sin
 * cerrar es también algo que hay que resolver, y la pantalla los distingue por el avance.
 */
export async function proyectosSinTareas(): Promise<ProyectoVacio[]> {
  return enPlan(async () => {
    const db = await getTenantDb();
    const [t, p] = await Promise.all([
      db.from('plan_tareas').select('progress, labels'),
      db.from('plan_proyectos').select('id, name, emoji, detalle, score'),
    ]);
    const conTrabajo = new Set<string>();
    for (const r of t.data ?? []) {
      const row = r as Row;
      if (Number(row.progress ?? 0) >= 100) continue;
      for (const l of asArr<unknown>(row.labels).map(String)) conTrabajo.add(l);
    }
    return (p.data ?? [])
      .map((r) => ({ id: str((r as Row).id), nombre: str((r as Row).name, 'Proyecto'), emoji: str((r as Row).emoji, '📁'), detalle: str((r as Row).detalle), score: Number((r as Row).score ?? 50) }))
      .filter((x) => !conTrabajo.has(x.id));
  });
}

const SYSTEM = `Sos MaKo, el asistente de un negocio. Te paso UN PROYECTO del plan que está VACÍO: existe, tiene nombre y a veces una descripción, pero nadie le cargó ni una tarea. Tu trabajo es INTUIR qué tareas concretas harían falta para que ese proyecto avance, para que el dueño las revise y las corrija.

QUÉ ES UNA BUENA TAREA ACÁ:
- Es un ENTREGABLE, no un tema. "Definir los 3 planes y sus precios" sí; "Trabajar en precios" no.
- La puede empezar una persona sola, hoy, sin esperar una reunión.
- Se sabe cuándo está terminada.
- Cinco a ocho tareas alcanzan. Si el proyecto es chico, tres. NUNCA rellenes para llegar a un número: una tarea inventada le cuesta al dueño más tiempo del que le ahorra.

QUÉ NO HACER:
- No inventes datos del negocio que no te di (nombres de clientes, montos, fechas, herramientas). Si algo hace falta saberlo, va como PREGUNTA, no como tarea.
- No repitas, con otras palabras, tareas que ya existen en otros proyectos del plan — te paso una muestra.
- No pongas prioridades ni fechas: de eso se ocupa el Perro Guardián después.

EL DETALLE de cada tarea sigue este molde:
{{moldeTarea}}

⛔ EN «Por qué» NO PONGAS NINGUNA CITA. El molde pide la frase textual de quien lo pidió, pero acá NADIE pidió nada: estas tareas las estás intuyendo vos a partir del NOMBRE de un proyecto vacío. Escribir «El dueño necesita…» entre comillas es inventarle una frase que nunca dijo, y después queda en el tablero como si fuera un dato. Escribí el porqué en tus palabras, sin comillas y sin atribuírselo a nadie.

Español rioplatense, directo, sin adjetivos de más.

Devolvé EXCLUSIVAMENTE un objeto JSON (sin markdown) con esta forma EXACTA:
{ "tareas": [ { "titulo": "<máx 200, un entregable>", "detalle": "<el molde de arriba>" } ], "nota": "<1 frase: qué asumiste sobre este proyecto para proponer esto. Si no entendiste de qué se trata, decilo acá en vez de inventar tareas.>" }`;

/**
 * MaKo propone tareas para un proyecto vacío y deja el borrador para revisar.
 *
 * Devuelve el id de la propuesta (link `/plan/revisar/<id>`) y cuántas tareas propuso.
 * `null` si el proyecto no existe, si ya tiene trabajo abierto, o si el modelo no produjo
 * nada usable — y eso ÚLTIMO se distingue del resto con `motivo`, porque «no pude» y «no
 * hacía falta» no son lo mismo y el que mira la pantalla tiene que poder saber cuál fue.
 */
export async function proponerTareasParaProyecto(projId: string): Promise<{ id: string; n: number } | { error: string }> {
  return enPlan(async () => {
    const db = await getTenantDb();
    const { data: fila } = await db.from('plan_proyectos').select('id, name, detalle').eq('id', projId).maybeSingle();
    if (!fila) return { error: 'Ese proyecto no existe.' };
    const nombre = str((fila as Row).name, 'Proyecto');
    const detalle = str((fila as Row).detalle);

    const { data: tRows } = await db.from('plan_tareas').select('title, progress, labels');
    const todas = (tRows ?? []).map((r) => ({ titulo: str((r as Row).title), progress: Number((r as Row).progress ?? 0), labels: asArr<unknown>((r as Row).labels).map(String) }));
    if (todas.some((t) => t.progress < 100 && t.labels.includes(projId))) {
      return { error: 'Ese proyecto ya tiene tareas abiertas.' };
    }

    // La muestra del plan es contra qué NO repetirse. Va acotada y salteada a lo largo de
    // todo el tablero, no las primeras 60: las primeras 60 son un solo proyecto.
    const titulos = todas.filter((t) => t.progress < 100).map((t) => t.titulo).filter(Boolean);
    const paso = Math.max(1, Math.ceil(titulos.length / 60));
    const muestra = titulos.filter((_, i) => i % paso === 0).slice(0, 60);

    const norte = await faseNegocioTexto().catch(() => '');
    const user = [
      norte ? `EL NEGOCIO, HOY:\n${contenidoNoConfiable(norte, 'negocio')}` : '',
      `EL PROYECTO VACÍO:\n${contenidoNoConfiable(`${nombre}${detalle ? `\n${detalle}` : ''}`, 'proyecto')}`,
      `LO QUE YA ESTÁ EN EL PLAN (muestra, para no repetir):\n${contenidoNoConfiable(muestra.join('\n') || '(el plan está vacío)', 'plan')}`,
      'Proponé las tareas de ESTE proyecto. JSON.',
    ].filter(Boolean).join('\n\n');

    // `erroresOut` NO es opcional acá aunque la firma lo permita: abajo se le ESCRIBE UN
    // MOTIVO al dueño, y un motivo sin haber pedido los errores es un motivo inventado.
    // Hay un test del repo que lo exige (tests/ia-mensajes.test.ts) — «MaKo no pudo
    // contestar» y «no tenés ninguna IA conectada» son dos problemas distintos con dos
    // soluciones distintas, y el mensaje genérico manda a buscar en el lugar equivocado.
    const errores: string[] = [];
    const raw = await chatCheapCascade({
      system: SYSTEM.replace('{{moldeTarea}}', MOLDE_DETALLE),
      user, maxTokens: 4000, feature: 'mako-guardian',
      motivo: `Intuir tareas para el proyecto vacío «${nombre}»`,
      erroresOut: errores,
    }).catch((e) => { errores.push(e instanceof Error ? e.message : String(e)); return ''; });
    if (!raw) return { error: await errorDeCascada(errores, `proponer tareas para «${nombre}»`) };

    let obj: Record<string, unknown>;
    try { obj = parseJsonObject(raw); } catch { return { error: 'MaKo contestó algo que no pude leer. Probá de nuevo.' }; }

    const tareas: PropuestaTarea[] = asArr<Record<string, unknown>>(obj.tareas)
      .map((t) => ({ titulo: str(t.titulo).trim().slice(0, 200), detalle: str(t.detalle).trim().slice(0, 6000), proyecto: nombre }))
      .filter((t) => t.titulo.length > 3)
      .slice(0, 10);
    if (!tareas.length) return { error: `MaKo no supo qué tareas tendría «${nombre}». Escribile una descripción al proyecto y probá de nuevo.` };

    // EL MISMO form de preguntas que el resto del tablero, tal cual lo pidió el dueño. Si
    // falla, se sigue igual: un borrador sin preguntas es peor que uno con preguntas, pero
    // muchísimo mejor que ningún borrador.
    const preguntas = await preguntasParaCargar(tareas.map((t) => ({ titulo: t.titulo, detalle: t.detalle, proyecto: nombre }))).catch(() => []);

    const nota = str(obj.nota).trim().slice(0, 300);
    const id = await crearPropuesta({
      tareas, preguntas, origen: 'proyecto-vacio',
      resumen: `Tareas para «${nombre}», que estaba sin ninguna${nota ? ` · ${nota}` : ''}`,
      // Anti-duplicado: si ya hay un borrador pendiente para este proyecto, devuelve ese en
      // vez de dejar cinco borradores idénticos porque alguien tocó el botón cinco veces.
      ref: `proyecto-vacio:${projId}`,
      fuenteTitulo: nombre,
    });
    return { id, n: tareas.length };
  });
}
