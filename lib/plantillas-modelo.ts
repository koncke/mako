// =============================================================================
// plantillas-modelo — aplicar la plantilla de un modelo de negocio a una cuenta (MAU-01, 27/10/2026)
// =============================================================================
// Las plantillas y el porqué, en lib/plantillas-modelo-reglas.ts. Acá está lo que escribe:
//   · `aplicarPlantillaModelo`: en el workspace ACTUAL (la API de MaKo, parada en la cuenta del cliente);
//   · `aplicarPlantillaACliente`: la agencia sobre un cliente de su cartera (o el super admin sobre cualquiera), desde
//     la ficha del Agency Dashboard. Corre lo mismo adentro de `runWithWorkspace(clienteWs)`.
//
// Lo que no se ve:
//   · ⚠️ «NO PUDE LEER LO QUE HAY» NO ES «NO HAY NADA». Se lee todo ANTES de escribir, y si una lectura falla no se crea
//     nada: con una lista vacía por error, aplicarla duplicaría el funnel, el objetivo y la guía.
//   · ⚠️ EL PROYECTO DEL PLAN SE CREA ANTES QUE SUS TAREAS. `agregarTareasPlanOwner` sin IA manda a «Sin proyecto» toda
//     tarea cuyo proyecto no existe ni es del catálogo (`destinoSinIA`, lib/plan-bandeja.ts): la guía habría quedado
//     desparramada en la bandeja.
//   · El funnel nace como el PRINCIPAL sólo si la cuenta no tiene uno; si no, se suma al lado (`esDefault` lo cuida un
//     índice único: un segundo principal tiraría).
//   · Sin IA y sin números: la meta del objetivo y el compromiso de cada KPI quedan en 0 («sin datos», nunca un rojo
//     inventado) hasta que el cliente pone los suyos, que es el primer paso de la guía.
// =============================================================================

import 'server-only';
import { getWorkspaceActual, runWithWorkspace } from './workspace';
import { crearFunnel, leerFunnels } from './funnels';
import { listKpis, listObjectives, quarterActual, upsertKpi, upsertObjective } from './objectives';
import { agregarTareasPlanOwner, crearPlanProyecto, listPlanBoard } from './plan-board';
import { esAgencia, puedeEntrarAhora } from './agencia';
import {
  PLANTILLAS_MODELO, nombreComparable, queFalta, resumenDePlantilla, type ModeloCliente, type ResumenPlantilla,
} from './plantillas-modelo-reglas';

export type ResultadoPlantilla = { ok: true; resumen: string; hecho: ResumenPlantilla } | { ok: false; error: string };

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Aplica la plantilla en el workspace ACTUAL. Lo que ya existe con el mismo nombre no se toca. */
export async function aplicarPlantillaModelo(modelo: ModeloCliente, quien: 'user' | 'ia' = 'user'): Promise<ResultadoPlantilla> {
  const p = PLANTILLAS_MODELO[modelo];
  const ws = await getWorkspaceActual();
  if (!ws) return { ok: false, error: 'No hay un negocio abierto.' };

  // 1. LO QUE HAY, entero, antes de escribir nada.
  let hay: { funnels: Array<{ nombre: string; esDefault: boolean }>; objetivos: Array<{ id: string; titulo: string }>; kpis: string[]; tareas: string[]; proyectos: string[] };
  let qt: { anio: number; q: number };
  try {
    const [funnels, q, kpis, board] = await Promise.all([leerFunnels(), quarterActual(), listKpis(false), listPlanBoard()]);
    if (!funnels) return { ok: false, error: 'No pude leer sus funnels: no apliqué nada para no duplicar. Vuelve a intentarlo.' };
    qt = q.qt;
    const objetivos = await listObjectives(qt);
    hay = {
      funnels, objetivos: objetivos.map((o) => ({ id: o.id, titulo: o.titulo })), kpis: kpis.map((k) => k.nombre),
      tareas: board.tareas.map((t) => t.title), proyectos: board.proyectos.map((x) => x.name),
    };
  } catch (e) {
    return { ok: false, error: `No pude leer lo que ya tiene: no apliqué nada para no duplicar (${msg(e)}).` };
  }
  const falta = queFalta(p, { funnels: hay.funnels.map((f) => f.nombre), objetivos: hay.objetivos.map((o) => o.titulo), kpis: hay.kpis, tareas: hay.tareas });

  // 2. Lo que falta, en orden. Si algo se corta a la mitad, aplicarla de nuevo completa lo que quedó.
  const hecho: ResumenPlantilla = { funnel: false, objetivo: false, kpis: 0, pasos: 0 };
  try {
    if (falta.funnel) {
      await crearFunnel({ nombre: p.funnel.nombre, pipeline: p.funnel.pipeline, plantilla: `modelo:${p.id}`, esDefault: !hay.funnels.some((f) => f.esDefault) });
      hecho.funnel = true;
    }
    let objetivoId = hay.objetivos.find((o) => nombreComparable(o.titulo) === nombreComparable(p.objetivo.titulo))?.id ?? null;
    if (falta.objetivo) {
      objetivoId = await upsertObjective({
        anio: qt.anio, quarter: qt.q, titulo: p.objetivo.titulo, metrica: p.objetivo.metrica, metaValor: 0, unidad: p.objetivo.unidad, origen: 'plantilla',
      });
      hecho.objetivo = true;
    }
    const base = Date.now();
    for (const [i, k] of falta.kpis.entries()) {
      await upsertKpi({
        objectiveId: objetivoId, nombre: k.nombre, cadencia: 'semanal', compromiso: 0, unidad: k.unidad,
        fuente: k.fuente, fuenteId: k.fuente === 'auto' ? k.fuenteId : null, orden: base + i, origen: 'plantilla',
      });
      hecho.kpis++;
    }
    if (falta.guia.length) {
      if (!hay.proyectos.some((n) => nombreComparable(n) === nombreComparable(p.proyecto))) {
        await crearPlanProyecto({
          id: 'tmp', emoji: '🧭', name: p.proyecto, color: '#2F6DDB', score: 50,
          detalle: `La guía para cargar los datos de la plantilla ${p.nombre}: un paso por tarea.`,
          historial: [{ id: `h${base.toString(36)}`, ts: base, actor: quien, text: `Lo creó la plantilla ${p.nombre}` }],
        });
      }
      const r = await agregarTareasPlanOwner(
        falta.guia.map((g) => ({ titulo: g.titulo, detalle: g.detalle, proyecto: p.proyecto, ...(g.recurrente ? { recurrente: true } : {}) })),
        { tipo: quien === 'ia' ? 'mako' : 'manual', etiqueta: `Plantilla ${p.nombre}` },
        { sinIA: true },
      );
      hecho.pasos = r.ids.length;
    }
  } catch (e) {
    const a_medias = hecho.funnel || hecho.objetivo || hecho.kpis || hecho.pasos;
    return { ok: false, error: `${a_medias ? `${resumenDePlantilla(p, hecho)} Y después ` : ''}se cortó: ${msg(e)}. Aplicarla otra vez completa lo que faltó sin duplicar.` };
  }
  return { ok: true, resumen: resumenDePlantilla(p, hecho), hecho };
}

/**
 * La agencia aplica la plantilla a un cliente de SU cartera, o el super admin a cualquiera. Quien llama ya resolvió la
 * puerta de la persona (el admin de la agencia, `adminDeWorkspaceActual`, o el super admin, `getSesionAdmin`); acá se
 * repregunta lo del negocio contra la base: que sea Agency y que ese cliente sea de su cartera. El botón no es la puerta.
 */
export async function aplicarPlantillaACliente(
  quien: { agenciaWs: number | null; superAdmin: boolean }, clienteWs: number, modelo: ModeloCliente, actor: 'user' | 'ia' = 'user',
): Promise<ResultadoPlantilla> {
  if (!Number.isSafeInteger(clienteWs) || clienteWs <= 0) return { ok: false, error: 'Ese cliente no está en tu cartera.' };
  if (!quien.superAdmin) {
    if (quien.agenciaWs == null) return { ok: false, error: 'Sólo el admin de la agencia aplica plantillas.' };
    if (!(await esAgencia(quien.agenciaWs))) return { ok: false, error: 'Este negocio no es Agency: se suma desde Agency Dashboard.' };
    // Lo mismo que /api/agencia/entrar: a quien no le corresponde, ese cliente no existe (mismo texto en las dos ramas).
    if (!(await puedeEntrarAhora(quien.agenciaWs, clienteWs))) return { ok: false, error: 'Ese cliente no está en tu cartera.' };
  }
  return runWithWorkspace(clienteWs, () => aplicarPlantillaModelo(modelo, actor));
}
