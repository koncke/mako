// =============================================================================
// api-mako/areas/plan.run — los cuerpos del área `plan`
// =============================================================================
// Un runner por id de plan.def.ts. Lecturas: { leer }. Acciones: { preparar, ejecutar }
// y { proponer } para las que dejan un borrador en /plan/revisar. Todo corre adentro
// de runWithWorkspace(ctx.ws): las libs que ya scopean con getTenantDb scopean solas.
// Nunca se escribe directo desde leer() ni preparar().
//
// ⚠️ NINGUNA LECTURA devuelve `link` en el primer nivel apuntando a /plan/revisar/: el
// doer de WhatsApp (lib/mako-doer-in.ts, runTool) captura CUALQUIER salida de tool con
// `/plan/revisar/` y un `link` string arriba, y reemplaza la respuesta entera por «Listo,
// te armé el borrador». Una lectura con esa forma hace que MaKo diga que CREÓ un borrador
// cuando solo lo leyó. En las lecturas va `link_revision`, o anidado.
//
// Las dos HEREDADAS (`ver_plan`, `proponer_tareas_plan`) se ENVUELVEN: sus cuerpos
// siguen en lib/mako-tools.ts y lib/mako-doer-acciones.ts, que leen tests por regex.
//
// ⚠️ NINGUNA acción de acá crea, cierra o borra una tarea: eso pasa SOLO por un
// borrador (crearPropuesta) que la persona confirma, y al aplicarlo corre el Perro.
// crearPlanTarea / agregarTareasPlanOwner / crearTarea no se importan a propósito.
//
// ⚠️ EL TABLERO DEL SUPER-ADMIN NO TIENE PATCH POR COLUMNA: guardarPlanTarea es un
// upsert de la FILA ENTERA. Las dos escrituras chicas que lo usan (tildar un paso,
// cambiar el avance) releen la fila EN ejecutar(), inmediatamente antes de guardar,
// nunca desde el payload que se preparó hace hasta 2 h.
// =============================================================================

import 'server-only';
import type { Ctx, Ejecutado, Runners, SalidaLectura } from '../tipos';
import { runMakoTool } from '@/lib/mako-tools';
import { crearRunnerAcciones } from '@/lib/mako-doer-acciones';
import { listPlanBoard, guardarPlanTarea, agregarDependencia, borrarDependencia, listDependencias } from '@/lib/plan-board';
import { listTareas, editarTarea } from '@/lib/todo';
import {
  getPropuesta, getPropuestaPorRef, listPropuestasPendientes, estadoDePropuesta, resumenPropuestasPorRefs,
  descartarPropuesta, crearPropuesta,
} from '@/lib/plan-propuesta';
import { matchTarea, CAMPOS_POR_DEFECTO, type CampoBusqueda } from '@/lib/buscar-tareas';
import { resolverDeps, estaBloqueada, puedeDepender, type EntidadDep, type ClaseDep, type EstadoDeps } from '@/app/plan/board/dependencias';
// «¿Qué hago ahora?» tiene UNA definición, la de la vista Prioridades del tablero.
import { prioridadesDelTablero, type FiltroPrioridades } from '@/app/plan/board/prioridades';
import { cruzarCandidatas, buscarDuplicados } from '@/lib/mako-guardian';
import { proponerProyecto } from '@/lib/checklist-coach';
import { proyectosSinTareas, proponerTareasParaProyecto } from '@/lib/plan-proyecto-vacio';
import { leerSenales, contextoDelNegocio } from '@/lib/plan-senales';
import { listReunionesRecientes } from '@/lib/plan-fathom';
import { AREA_GLOSARIO } from '@/lib/glosario';
import { createKnowledge, updateKnowledge } from '@/lib/mako-knowledge';
import { hoyEnWorkspace } from '@/lib/timezone';
// «Se repite para siempre» (mig 0163). Mismo módulo que usan el reparto, los avisos y las
// pantallas: una lectura no puede tener su propia definición de qué compite.
import { esRecurrente, sinRecurrentes, soloRecurrentes } from '@/lib/plan-recurrentes';
import {
  leerTablero, usaPlanBoard, buscarTarea, buscarProyecto, tareaCompacta, nombresDeProyectos,
  linkTarea, linkProyecto, linkBorrador, soloFueraDeHttp, fuenteParaCanal, terminosDelGlosario,
  diasParada, DIAS_PARADA_NOTORIA,
  type Tablero, type TareaPlan,
} from './plan.helpers';

// ── utilidades ───────────────────────────────────────────────────────────────

const texto = async (p: Promise<string | { content: string; isError?: boolean }>): Promise<string> => {
  const r = await p;
  return typeof r === 'string' ? r : r.content;
};
const json = (o: unknown): string => JSON.stringify(o);
const error = (msg: string): SalidaLectura => ({ content: msg, isError: true });
const str = (input: Record<string, unknown>, k: string): string => (typeof input[k] === 'string' ? (input[k] as string).trim() : '');
const num = (input: Record<string, unknown>, k: string): number | null => {
  const v = input[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};
const lista = (input: Record<string, unknown>, k: string): Record<string, unknown>[] =>
  Array.isArray(input[k]) ? (input[k] as unknown[]).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [];
const recortar = (s: string | null | undefined, n: number): string => {
  const t = (s ?? '').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};
/**
 * ⚠️ DOS PREGUNTAS, NO UNA (mig 0163). `abierta` = «¿queda algo pasando?»; `compite` =
 * «¿esto tiene un fin, y por lo tanto rankea, vence y cuenta para el avance?». Todo lo que
 * ordene por score, cuente trabajo pendiente o persiga una fecha usa `compite`; lo que
 * pregunta «¿esto ya existe en el plan?» usa `abierta`, porque una recurrente EXISTE y
 * proponerla de nuevo es el error que la marca en el payload viene a evitar.
 */
const abierta = (t: TareaPlan): boolean => t.avance < 100;
const compite = (t: TareaPlan): boolean => abierta(t) && !esRecurrente(t);
const genHistId = (): string => 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const aviso = (tab: Tablero): Record<string, string> =>
  tab.recortado ? { advertencia: 'El tablero llegó al tope de 1000 filas por lectura: puede haber tareas o proyectos que no se vieron.' } : {};

/** Origen del borrador según el canal. `mako` para app y API: no sabemos qué agente
 *  llama por HTTP, y firmar `claude-code` sería inventarlo. */
const origenBorrador = (ctx: Ctx): string => (ctx.canal === 'whatsapp' ? 'whatsapp' : 'mako');

/** El estado de dependencias del tablero del super-admin (en el de un cliente, nada). */
const estadoDeps = (tab: Tablero): EstadoDeps | null => {
  if (tab.board !== 'plan' || !tab.deps.length) return null;
  return resolverDeps({
    // `recurrente` VA: es lo que le dice al grafo que una tarea sin fin no frena a nadie y
    // que un proyecto de puras recurrentes no está pendiente para siempre.
    tareas: tab.tareas.map((t) => ({ id: t.id, num: t.num ?? 0, score: t.score, progress: t.avance, labels: t.labels, recurrente: t.recurrente })),
    deps: tab.deps,
  });
};

/**
 * El tablero normalizado en la forma que lee `prioridadesDelTablero` (la del grafo de
 * dependencias: `progress`, no `avance`), con la tarea original colgada en `t` para
 * devolverla tal cual. Es el mismo mapeo que `estadoDeps`, arriba.
 */
type TareaPrioApi = { id: string; num: number; score: number; progress: number; labels: string[]; recurrente: boolean; t: TareaPlan };
type ProyectoPrioApi = { id: string; score: number; recurrente: boolean };
const tareasPrio = (tab: Tablero): TareaPrioApi[] =>
  tab.tareas.map((t) => ({ id: t.id, num: t.num ?? 0, score: t.score, progress: t.avance, labels: t.labels, recurrente: t.recurrente, t }));
const proyectosPrio = (tab: Tablero): ProyectoPrioApi[] =>
  tab.proyectos.map((p) => ({ id: p.id, score: p.score, recurrente: p.recurrente }));

/**
 * El avance de un proyecto: promedio del avance de sus tareas CON FIN.
 *
 * ⚠️ LAS RECURRENTES NO ENTRAN, Y ES LA MISMA DECISIÓN QUE `projProgress` (piezas.tsx).
 * Una tarea que se repite está clavada en 0% por definición: contarla baja el avance del
 * proyecto de forma PERMANENTE y el número nunca puede volver a 100 — un cliente al que se
 * le atiende todas las semanas se vería peor cuanto más se lo atiende. Contarlas como
 * hechas sería la mentira simétrica. `null` (sin tareas con fin) es la tercera respuesta y
 * la correcta para un proyecto que sólo tiene trabajo que se repite: no es 0%, es que la
 * pregunta no aplica. Quien lo lea tiene `se_repiten` al lado para decir qué sí hay.
 */
const promedioAvance = (ts: TareaPlan[]): number | null => {
  const conFin = sinRecurrentes(ts);
  return conFin.length ? Math.round(conFin.reduce((a, t) => a + t.avance, 0) / conFin.length) : null;
};

const TOPE_LISTA = 300;

// ── runners ──────────────────────────────────────────────────────────────────

export const RUNNERS: Runners = {
  // ── Lecturas ──────────────────────────────────────────────────────────────

  // Heredada: el cuerpo vive en lib/mako-tools.ts y es el MISMO que usa el doer de
  // WhatsApp. Ese cuerpo decidía el tablero por `ws === OWNER_WS` (el ws 1, un cliente)
  // y acá había una segunda implementación para tapar el caso; desde que la heredada
  // decide por CAPA, hay una sola.
  ver_plan: {
    leer: (input) => runMakoTool('ver_plan', input),
  },

  listar_tareas_plan: {
    leer: async (_input, ctx) => {
      const tab = await leerTablero(ctx.ws);
      const nombres = nombresDeProyectos(tab);
      // ⚠️ LAS QUE SE REPITEN VAN EN SU PROPIA LISTA, NI ADENTRO NI AFUERA (mig 0163).
      // Adentro ocupan lugares de una lista ORDENADA POR SCORE, que es el recurso escaso de
      // esta lectura (el tope son 300): una recurrente con score 85 desplaza trabajo real.
      // Afuera, un agente que no las ve propone crearlas otra vez. Y `total_abiertas` cuenta
      // sólo lo que se puede terminar, porque es el número con el que después se dice
      // «tenés N cosas pendientes».
      const abiertas = tab.tareas.filter(compite).sort((a, b) => b.score - a.score);
      const repiten = soloRecurrentes(tab.tareas.filter(abierta));
      return json({
        board: tab.board,
        total_abiertas: abiertas.length,
        mostradas: Math.min(abiertas.length, TOPE_LISTA),
        ...(abiertas.length > TOPE_LISTA ? { afuera: `${abiertas.length - TOPE_LISTA} tareas de menor score no se muestran` } : {}),
        tareas: abiertas.slice(0, TOPE_LISTA).map((t) => tareaCompacta(t, nombres)),
        ...(repiten.length ? {
          se_repiten: repiten.length,
          recurrentes: repiten.slice(0, 50).map((t) => tareaCompacta(t, nombres)),
          recurrentes_nota: 'Tareas que se repiten para siempre. NO están en `tareas` ni en `total_abiertas` porque no compiten por un puesto ni se pueden terminar, pero EXISTEN: no propongas crearlas de nuevo.',
        } : {}),
        // El `score` de un recurrente no es un puesto, así que va marcado: esta lista es de
        // dónde el modelo saca a qué proyecto mandar una tarea nueva, y sin la marca elige
        // por número (mig 0164).
        proyectos: tab.proyectos.map((p) => ({ id: p.id, ...(p.pid ? { pid: p.pid } : {}), nombre: p.nombre, score: p.score, ...(esRecurrente(p) ? { se_repite: true, repeticion: p.repeticion } : {}) })),
        ...aviso(tab),
      });
    },
  },

  ver_tarea_plan: {
    leer: async (input, ctx) => {
      const id = str(input, 'id');
      const n = num(input, 'num');
      if (!id && n == null) return error('Pasa el id de la tarea o su número visible (num).');
      const tab = await leerTablero(ctx.ws);
      const t = buscarTarea(tab, id || null, n);
      if (!t) return error(`No encuentro la tarea ${id || `#${n}`} en el plan de este negocio. Búscala con ver_plan o buscar_tareas_plan.`);
      const nombres = nombresDeProyectos(tab);
      const titulo = new Map(tab.tareas.map((x) => [x.id, x.titulo]));
      const est = estadoDeps(tab);
      const bloqueadaPor = est
        ? [
            ...(est.bloqueantes[t.id] ?? []).map((x) => ({ tipo: 'tarea', id: x, titulo: titulo.get(x) ?? null })),
            ...(est.bloqueantesProy[t.id] ?? []).map((x) => ({ tipo: 'proyecto', id: x, titulo: nombres.get(x) ?? null })),
          ]
        : [];
      return json({
        board: tab.board,
        id: t.id, ...(t.num != null ? { num: t.num } : {}), titulo: t.titulo, link: linkTarea(t.id),
        proyecto: t.proyectoId ? { id: t.proyectoId, nombre: nombres.get(t.proyectoId) ?? null } : null,
        score: t.score, score_razon: t.scoreRazon, prioridad: t.prioridad, avance_pct: t.avance,
        deadline: t.deadline, deadline_razon: t.deadlineRazon, quarter: t.quarter, en_prioridad: t.enPrioridad,
        // ⚠️ ACÁ NO ALCANZA CON `tareaCompacta` (mig 0165): esta lectura arma su propio JSON
        // campo por campo, así que la marca y el ritmo se escriben otra vez o el detalle de
        // una tarea es la ÚNICA vista donde no se ven. Van juntos y sólo cuando se repite:
        // sin `deadline` ni `quarter`, esto es lo único temporal que tiene.
        ...(esRecurrente(t) ? { se_repite: true, repeticion: t.repeticion, se_repite_nota: 'Se repite para siempre: no compite en el ranking y no lleva deadline ni quarter. `repeticion` es la frase de cuándo se repite («Cada semana, los lunes y miércoles»), la misma que se lee en la tarjeta; null = todavía no se dijo.' } : {}),
        detalle: t.detalle, notas: t.notas || null,
        checklist: t.checklist,
        // Por HTTP la fuente sale sin su url (un link de Fathom con ?timestamp).
        fuente: fuenteParaCanal(ctx.canal, t.fuente),
        bloqueada_por: bloqueadaPor,
        historial_reciente: t.historial.slice(0, 15).map((h) => ({ cuando: h.ts ? new Date(h.ts).toISOString() : null, actor: h.actor, texto: h.text })),
        historial_total: t.historial.length,
      });
    },
  },

  ver_proyecto_plan: {
    leer: async (input, ctx) => {
      const tab = await leerTablero(ctx.ws);
      const p = buscarProyecto(tab, str(input, 'proyectoId'));
      if (!p) return error(`No encuentro el proyecto «${str(input, 'proyectoId')}». Lista los que hay con listar_proyectos_plan.`);
      const nombres = nombresDeProyectos(tab);
      const suyas = tab.tareas.filter((t) => t.proyectoId === p.id);
      // `compite` y no `abierta`: las que se repiten no son trabajo pendiente ni trabajo
      // hecho — están en marcha, y van contadas aparte para que el proyecto de puras
      // recurrentes no le llegue al modelo como uno abandonado.
      const abiertas = suyas.filter(compite).sort((a, b) => b.score - a.score);
      const hechas = sinRecurrentes(suyas).filter((t) => !abierta(t));
      const repiten = soloRecurrentes(suyas.filter(abierta));
      return json({
        board: tab.board,
        id: p.id, ...(p.pid ? { pid: p.pid } : {}), nombre: p.nombre, emoji: p.emoji, link: linkProyecto(p.id),
        score: p.score, score_razon: p.scoreRazon, score_fijado_por_el_dueno: p.scoreManual, deadline: p.deadline,
        // Mismo contrato que en la lista: la marca viaja con su nota, y sólo cuando es true.
        ...(esRecurrente(p) ? { se_repite: true, repeticion: p.repeticion, se_repite_nota: 'Este proyecto se repite para siempre (mig 0164): no entra al ranking, no lleva deadline ni quarter y su score no es un puesto. No propongas cerrarlo ni volver a crearlo. Sus tareas con fin SÍ compiten. `repeticion` es la frase de cuándo se repite («Cada semana, los lunes y miércoles»), la misma que se lee en la tarjeta; null = todavía no se dijo.' } : {}),
        ...(p.scoreManual == null ? { score_fijado_nota: 'null = el tablero de este negocio no registra si el dueño fijó el score; no significa que no lo haya fijado.' } : {}),
        detalle: p.detalle,
        tareas_abiertas: abiertas.length, tareas_hechas: hechas.length,
        ...(repiten.length ? { se_repiten: repiten.length, recurrentes: repiten.slice(0, 30).map((t) => tareaCompacta(t, nombres)) } : {}),
        avance_pct: promedioAvance(suyas),
        avance_nota: 'promedio del avance de sus tareas CON FIN; null = no tiene ninguna. null con `se_repiten` > 0 NO es «abandonado»: es un proyecto cuyo trabajo se repite y por eso no tiene porcentaje.',
        abiertas: abiertas.slice(0, 100).map((t) => tareaCompacta(t, nombres)),
        hechas: hechas.slice(0, 30).map((t) => ({ id: t.id, ...(t.num != null ? { num: t.num } : {}), titulo: t.titulo })),
        ...(abiertas.length > 100 || hechas.length > 30 ? { recorte: 'se muestran hasta 100 abiertas y 30 hechas' } : {}),
      });
    },
  },

  listar_proyectos_plan: {
    leer: async (_input, ctx) => {
      const tab = await leerTablero(ctx.ws);
      const ordenados = [...tab.proyectos].sort((a, b) => b.score - a.score);
      const proyectos = ordenados.map((p) => {
        const suyas = tab.tareas.filter((t) => t.proyectoId === p.id);
        return {
          id: p.id, ...(p.pid ? { pid: p.pid } : {}), nombre: p.nombre, emoji: p.emoji, score: p.score,
          score_razon: recortar(p.scoreRazon, 300) || null, score_fijado_por_el_dueno: p.scoreManual,
          abiertas: suyas.filter(compite).length, hechas: sinRecurrentes(suyas).filter((t) => !abierta(t)).length,
          se_repiten: soloRecurrentes(suyas.filter(abierta)).length,
          avance_pct: promedioAvance(suyas),
          // ⚠️ LA MARCA VIAJA CON SU EXPLICACIÓN, igual que en `tareaCompacta`. Lo único que
          // un modelo sabe de este proyecto es este JSON: sin la nota ve `score: 88` en el
          // renglón de arriba de una lista ordenada por score y concluye —con toda razón—
          // que es el foco del negocio. El campo sólo aparece cuando es true: una clave
          // `se_repite: false` en los otros 70 es ruido en el prompt.
          ...(esRecurrente(p) ? { se_repite: true, repeticion: p.repeticion, se_repite_nota: 'Este proyecto se repite para siempre: no entra al ranking, no puede ser el objetivo principal y su score NO es un puesto. Sus tareas con fin SÍ compiten normalmente. `repeticion` es la frase de cuándo se repite («Cada semana, los lunes y miércoles»), la misma que se lee en la tarjeta; null = todavía no se dijo.' } : {}),
        };
      });
      // ⚠️ EL NORTE SALE DE LO QUE COMPITE (mig 0164), Y SE CALCULA SOBRE `ordenados`, NO
      // sobre el array ya mapeado: ahí `recurrente` se convirtió en `se_repite` y
      // `sinRecurrentes` no lo vería — contestaría que ninguno se repite y el filtro sería
      // decorativo. El de mayor score es el primero, y un recurrente conserva el score que
      // tenía de antes de marcarse: sin esto, el día que alguien marca Customer Success el
      // objetivo principal del negocio pasa a ser una rutina, y eso es lo que lee el doer
      // de WhatsApp para contestar «¿cuál es mi foco ahora?».
      const norte = sinRecurrentes(ordenados)[0] ?? null;
      return json({
        board: tab.board,
        objetivo_principal: norte ? { id: norte.id, nombre: norte.nombre } : null,
        proyectos,
        tareas_abiertas_sin_proyecto: tab.tareas.filter((t) => compite(t) && !t.proyectoId).length,
        nota: 'avance_pct = promedio del avance de sus tareas CON FIN (null = no tiene ninguna; con se_repiten > 0 eso NO es «abandonado»). `abiertas` y `hechas` tampoco cuentan las que se repiten. Los proyectos con `se_repite: true` están en la lista pero NO en objetivo_principal: no compiten. score_fijado_por_el_dueno null = este tablero no registra ese dato (no es «no lo fijó»).',
        ...aviso(tab),
      });
    },
  },

  ver_prioridades_plan: {
    leer: async (input, ctx) => {
      const limite = num(input, 'limite') ?? 10;
      const tab = await leerTablero(ctx.ws);
      // «¿Qué hago hoy?» — y una tarea que se repite NO es una respuesta a eso: se hace
      // cuando toca, no cuando la lista la pone arriba.
      let abiertas = tab.tareas.filter(compite);
      const ref = str(input, 'proyectoId');
      let filtro: FiltroPrioridades<TareaPrioApi, ProyectoPrioApi> | null = null;
      if (ref) {
        const p = buscarProyecto(tab, ref);
        if (!p) return error(`No encuentro el proyecto «${ref}». Lista los que hay con listar_proyectos_plan.`);
        abiertas = abiertas.filter((t) => t.proyectoId === p.id);
        filtro = { tarea: (x) => x.t.proyectoId === p.id, proyecto: (x) => x.id === p.id };
      }
      // ⚠️ EL ORDEN ES EL DE LA VISTA PRIORIDADES DEL TABLERO, CON LA MISMA FUNCIÓN
      // (`prioridadesDelTablero`, app/plan/board/prioridades.ts): banda con la urgencia
      // heredada → las del objetivo principal → score del proyecto → urgencia. Acá había un
      // orden propio sólo por score, con un comentario que decía «es el mismo criterio» y no
      // lo era: MaKo contestaba «¿qué hago hoy?» con otra lista que la pantalla y el teléfono.
      const r = prioridadesDelTablero({ tareas: tareasPrio(tab), proyectos: proyectosPrio(tab), deps: tab.deps, filtro, max: limite });
      const libres = abiertas.filter((t) => !estaBloqueada(t.id, r.estDeps));
      const nombres = nombresDeProyectos(tab);
      // Si TODAS las abiertas están bloqueadas, no se devuelve una lista vacía: se dan las
      // primeras en el mismo orden, marcadas, para decidir qué destrabar.
      const todasBloqueadas = !libres.length && abiertas.length > 0;
      const elegidas = todasBloqueadas
        ? prioridadesDelTablero({ tareas: tareasPrio(tab), proyectos: proyectosPrio(tab), estDeps: r.estDeps, filtro, max: limite, incluirBloqueadas: true }).prioridades
        : r.prioridades;
      return json({
        board: tab.board,
        total_abiertas: abiertas.length,
        excluidas_por_bloqueo: abiertas.length - libres.length,
        tareas: elegidas.map((x) => ({ ...tareaCompacta(x.t, nombres), ...(todasBloqueadas ? { bloqueada: true } : {}) })),
        orden: 'El mismo de la vista Prioridades del tablero: primero la banda (alta, media, baja, a futuro, contando la urgencia que hereda de lo que destraba), adentro de la banda las del objetivo principal, después el score del proyecto y la urgencia. Las primeras 5 son las tarjetas que ve la persona.',
        ...(todasBloqueadas ? { nota: 'Todas las tareas abiertas están bloqueadas por una dependencia abierta: estas son las primeras en el orden de Prioridades, marcadas bloqueada: true. Qué las frena está en ver_tarea_plan.' } : {}),
        ...aviso(tab),
      });
    },
  },

  listar_tareas_paradas: {
    leer: async (input, ctx) => {
      const dias = num(input, 'dias') ?? DIAS_PARADA_NOTORIA;
      const tab = await leerTablero(ctx.ws);
      const ahora = Date.now();
      const nombres = nombresDeProyectos(tab);
      const hits = tab.tareas
        // `compite` saca las hechas y las recurrentes. Una recurrente no se puede
        // «trabar»: no se completa, se repite — y saldría siempre primera, porque su
        // historial no se toca entre una vuelta y la otra.
        .filter(compite)
        .map((t) => ({ t, parada: diasParada(t, ahora) }))
        .filter((x) => x.parada >= dias)
        .sort((a, b) => b.parada - a.parada);
      return json({
        board: tab.board,
        desde_dias: dias,
        total: hits.length,
        tareas: hits.slice(0, 100).map(({ t, parada }) => ({
          ...tareaCompacta(t, nombres),
          dias_sin_moverse: parada,
          nacio: t.creadaEn ? new Date(t.creadaEn).toISOString().slice(0, 10) : null,
        })),
        ...(hits.length > 100 ? { afuera: `${hits.length - 100} tareas más no se muestran` } : {}),
        nota: 'Los días se cuentan desde el último cambio de una PERSONA; lo que escribe MaKo no cuenta. Desde los 30 el ranking le baja el score de a un punto por día (tope 20), así que una tarea muy parada está abajo en el ranking POR eso y no porque no importe.',
      });
    },
  },

  listar_tareas_vencidas: {
    leer: async (input, ctx) => {
      const dias = num(input, 'dias') ?? 7;
      const tab = await leerTablero(ctx.ws);
      // Días de CALENDARIO contra la fecha de hoy en la zona del negocio. No se usa
      // diasAlDeadline (app/plan/board/envejecer.ts): compara contra el deadline a las
      // 12:00 UTC con Math.ceil, y entre 00:00 y 12:00 UTC una tarea de AYER da 0.
      const hoy = await hoyEnWorkspace();
      const base = Date.parse(`${hoy}T00:00:00Z`);
      const faltanDe = (d: string | null): number | null => {
        if (!d) return null;
        const t = Date.parse(`${d.slice(0, 10)}T00:00:00Z`);
        return Number.isFinite(t) && Number.isFinite(base) ? Math.round((t - base) / 864e5) : null;
      };
      const nombres = nombresDeProyectos(tab);
      const hits = tab.tareas
        // `compite`: una recurrente no puede estar vencida. Hoy además nace sin fecha
        // (`taskToRow` la corta), pero una fila vieja marcada después puede conservar una
        // — y aparecería acá como «vencida hace 40 días», que es falso y además urgente.
        .filter(compite)
        .map((t) => ({ t, faltan: faltanDe(t.deadline) }))
        .filter((x): x is { t: TareaPlan; faltan: number } => x.faltan != null && x.faltan <= dias)
        .sort((a, b) => a.faltan - b.faltan);
      return json({
        board: tab.board,
        ventana: { hoy, hasta_dias: dias },
        vencidas: hits.filter((x) => x.faltan < 0).length,
        tareas: hits.slice(0, 100).map(({ t, faltan }) => ({ ...tareaCompacta(t, nombres), dias_restantes: faltan, deadline_razon: t.deadlineRazon })),
        ...(hits.length > 100 ? { afuera: `${hits.length - 100} tareas más no se muestran` } : {}),
        nota: 'dias_restantes negativo = vencida hace esos días; 0 = vence hoy.',
        ...aviso(tab),
      });
    },
  },

  listar_tareas_sin_datos: {
    leer: async (_input, ctx) => {
      const tab = await leerTablero(ctx.ws);
      const nombres = nombresDeProyectos(tab);
      // ⚠️ ES EL BUG DE `sin_checklist` OTRA VEZ, y el comentario que lo explica está tres
      // líneas más abajo. A una recurrente NO le falta el deadline: no lleva. Dejándolas
      // acá, esta lectura contesta «faltan completar N tareas» sobre tareas a las que no
      // les falta nada, y el número CRECE SOLO con cada recurrente nueva.
      const abiertas = tab.tareas.filter(compite).sort((a, b) => b.score - a.score);
      const sinDeadline = abiertas.filter((t) => !t.deadline);
      // ⛔ ACÁ SE DEVOLVÍA TAMBIÉN `sin_checklist`, y desde que las checklists salieron del
      // producto (22/09/2026) esa lista era TODAS las tareas abiertas: un agente que
      // preguntaba «¿qué falta completar?» recibía las 241 marcadas como incompletas. Un
      // contador definido por la ausencia de algo que ya no existe no devuelve cero:
      // devuelve el universo entero, y con cara de diagnóstico.
      return json({
        board: tab.board,
        sin_deadline: { total: sinDeadline.length, tareas: sinDeadline.slice(0, 100).map((t) => tareaCompacta(t, nombres)) },
        nota: 'la lista muestra hasta 100, las de mayor score; `total` es el número real.',
        ...aviso(tab),
      });
    },
  },

  buscar_tareas_plan: {
    leer: async (input, ctx) => {
      const q = str(input, 'q');
      if (!q) return error('Pasa un texto para buscar.');
      const campos = (Array.isArray(input.campos) && input.campos.length ? input.campos : CAMPOS_POR_DEFECTO) as CampoBusqueda[];
      const tab = await leerTablero(ctx.ws);
      const nombres = nombresDeProyectos(tab);
      const universo = input.incluirHechas === true ? tab.tareas : tab.tareas.filter(abierta);
      const hits = universo.filter((t) => matchTarea({
        titulo: t.titulo, num: t.num ?? undefined, detalle: t.detalle, notas: t.notas,
        scoreRazon: t.scoreRazon ?? undefined, deadlineRazon: t.deadlineRazon ?? undefined, checklist: t.checklist,
      }, q, campos)).sort((a, b) => b.score - a.score);
      return json({
        board: tab.board, q, campos, incluye_hechas: input.incluirHechas === true,
        total: hits.length,
        tareas: hits.slice(0, 50).map((t) => ({ ...tareaCompacta(t, nombres), avance_pct: t.avance })),
        ...(hits.length > 50 ? { afuera: `${hits.length - 50} coincidencias más no se muestran; afina la búsqueda` } : {}),
      });
    },
  },

  listar_dependencias_plan: {
    leer: async (_input, ctx) => {
      if (!(await usaPlanBoard(ctx.ws))) return json({ board: 'todo', dependencias: [], nota: 'El tablero de este negocio no maneja dependencias.' });
      const tab = await leerTablero(ctx.ws);
      const tareas = new Map(tab.tareas.map((t) => [t.id, t.titulo]));
      const proyectos = nombresDeProyectos(tab);
      const nombre = (entidad: string, id: string) => (entidad === 'proyecto' ? proyectos.get(id) : tareas.get(id)) ?? null;
      return json({
        board: 'plan',
        total: tab.deps.length,
        dependencias: tab.deps.map((d) => ({
          entidad: d.entidad, clase: d.clase,
          espera: { id: d.deId, titulo: nombre(d.entidad, d.deId) },
          va_primero: { id: d.aId, titulo: nombre(d.entidad, d.aId) },
          razon: d.razon, origen: d.origen,
        })),
        nota: 'titulo null = la punta ya no existe (arista colgada, se ignora al calcular).',
      });
    },
  },

  listar_borradores_plan: {
    leer: async (input, ctx) => {
      const limite = num(input, 'limite') ?? 30;
      // Diez de más para poder decir si quedaron otros afuera (el default de la lib, 8,
      // escondía 72 de 80 sin avisar). No uno: listPropuestasPendientes aplica el .limit()
      // ANTES de filtrar los borradores vacíos, así que uno vacío se comía el «de más».
      const props = await listPropuestasPendientes(limite + 10);
      return json({
        mostrados: Math.min(props.length, limite),
        hay_mas: props.length > limite,
        nota: 'hay_mas puede decir false aunque haya otros si entre los siguientes había más de 10 borradores vacíos (la lista los descarta después de pedirlos).',
        borradores: props.slice(0, limite).map((p) => ({
          id: p.id, link: linkBorrador(p.id), resumen: p.resumen, origen: p.origen ?? null,
          enviado_por: soloFueraDeHttp(ctx.canal, p.enviadoPor ?? null), fuente: p.fuenteTitulo ?? null, fuente_fecha: p.fuenteFecha ?? null,
          creado: p.createdAt,
          tareas: p.tareas.length, cierres: p.cerrar.length, bajas_sugeridas: p.eliminar.length,
        })),
      });
    },
  },

  ver_borrador_plan: {
    leer: async (input, ctx) => {
      const id = str(input, 'id');
      const p = await getPropuesta(id);
      // Sin `duenoDePropuesta` a propósito: por la API no se revela si un id existe en
      // OTRO negocio.
      if (!p) return error(`No hay un borrador «${id}» en este negocio. Copia el id tal cual de listar_borradores_plan.`);
      return json({
        // `link_revision`, NUNCA `link`: ver el comentario del principio (el doer lo toma por un borrador creado).
        id: p.id, link_revision: linkBorrador(p.id), estado: p.estado, resumen: p.resumen, origen: p.origen ?? null,
        // Por HTTP (un token en la máquina de un tercero) no salen nombres de personas
        // ni el link a la grabación: la lectura sirve igual para decidir.
        enviado_por: soloFueraDeHttp(ctx.canal, p.enviadoPor ?? null), fuente: p.fuenteTitulo ?? null,
        fuente_url: soloFueraDeHttp(ctx.canal, p.fuenteUrl ?? null), fuente_fecha: p.fuenteFecha ?? null,
        creado: p.createdAt,
        tareas: p.tareas.map((t) => ({
          titulo: t.titulo, proyecto: t.proyecto ?? null, deadline: t.deadline ?? null,
          detalle: recortar(t.detalle, 600) || null,
          // el email del responsable NO sale nunca; el nombre, solo fuera de HTTP
          responsable: soloFueraDeHttp(ctx.canal, t.dueno ?? null), es_de_otra_persona: !!t.esDeOtro,
          minutos_grabacion_seg: t.minutos ?? (t.minuto != null ? [t.minuto] : []),
          amplia_tarea: t.enriquece ? { id: t.enriquece.id, razon: t.enriquece.razon } : null,
          destildada: t.incluir === false,
        })),
        cierres: p.cerrar.map((c) => ({ id: c.id, titulo: c.titulo ?? null, evidencia: c.evidencia, confianza: c.confianza ?? 'media' })),
        bajas_sugeridas: p.eliminar.map((e) => ({ id: e.id, titulo: e.titulo ?? null, motivo: e.motivo ?? null })),
        ya_cargadas: (p.aplicadas ?? []).map((a) => ({ titulo: a.titulo, tarea_id: a.tareaId })),
        nota: 'detalle recortado a 600 caracteres; el completo se ve en el link.',
      });
    },
  },

  ver_estado_borrador: {
    leer: async (input) => {
      const id = str(input, 'id');
      const e = await estadoDePropuesta(id);
      if (!e) return error(`No hay un borrador «${id}» en este negocio.`);
      return json({ id, link_revision: linkBorrador(id), estado: e.estado, tareas: e.n, resumen: e.resumen });
    },
  },

  ver_borrador_de_reunion: {
    leer: async (input) => {
      const rid = num(input, 'recordingId');
      const p = await getPropuestaPorRef(`fathom:${rid}`);
      if (!p) return json({ recordingId: rid, borrador: null, nota: 'Esa reunión todavía no dejó ningún borrador en este negocio.' });
      return json({
        recordingId: rid,
        borrador: {
          id: p.id, link: linkBorrador(p.id), estado: p.estado, resumen: p.resumen,
          ya_cargadas: (p.aplicadas ?? []).length,
          pendientes_propias: p.tareas.filter((t) => !t.esDeOtro).length,
          pendientes_de_otras_personas: p.tareas.filter((t) => t.esDeOtro).length,
          cierres: p.cerrar.length,
        },
      });
    },
  },

  listar_reuniones_fathom: {
    leer: async (input) => {
      const pagina = await listReunionesRecientes({
        limit: num(input, 'limit') ?? 15,
        cursor: str(input, 'cursor') || null,
        recordedAfter: str(input, 'recordedAfter') || undefined,
      });
      const refs = pagina.reuniones.map((r) => `fathom:${r.recordingId}`);
      const borr = await resumenPropuestasPorRefs(refs);
      return json({
        reuniones: pagina.reuniones.map((r) => {
          const b = borr[`fathom:${r.recordingId}`];
          return {
            recordingId: r.recordingId, titulo: r.titulo, fecha: r.fecha, dur_min: r.durMin, url: r.url, tipo: r.tipo,
            participantes: r.participantes.length,
            borrador: b ? { id: b.id, estado: b.estado, ya_cargadas: b.creadas, pendientes_propias: b.pendientesMias, pendientes_de_otras_personas: b.pendientesOtros } : null,
          };
        }),
        siguiente_cursor: pagina.nextCursor,
        nota: 'tipo ventas = sus compromisos son del lead, no van al plan. borrador null = la reunión no se leyó todavía.',
      });
    },
  },

  cruzar_tareas_con_plan: {
    leer: async (input, ctx) => {
      const candidatas = lista(input, 'candidatas').map((c) => ({ titulo: str(c, 'titulo'), detalle: str(c, 'detalle') || undefined })).filter((c) => c.titulo);
      if (!candidatas.length) return error('Pasa al menos una candidata con título.');
      const tab = await leerTablero(ctx.ws);
      const abiertas = tab.tareas.filter(abierta);
      if (!abiertas.length) return json({ board: tab.board, cruces: candidatas.map((c, i) => ({ i, titulo: c.titulo, accion: 'nueva' })), nota: 'El plan no tiene tareas abiertas: todas son nuevas.' });
      const titulo = new Map(abiertas.map((t) => [t.id, t.titulo]));
      const out = await cruzarCandidatas(candidatas, abiertas.map((t) => ({ id: t.id, titulo: t.titulo, detalle: t.detalle })), 'API MaKo: cruzar candidatas con el plan');
      const porIndice = new Map(out.cruces.map((c) => [c.i, c]));
      return json({
        board: tab.board,
        cruces: candidatas.map((c, i) => {
          const x = porIndice.get(i);
          if (!x || x.accion !== 'enriquece' || !x.idExistente) return { i, titulo: c.titulo, accion: 'nueva', ...(x ? { razon: x.razon } : {}) };
          return { i, titulo: c.titulo, accion: 'enriquece', id_existente: x.idExistente, titulo_existente: titulo.get(x.idExistente) ?? null, razon: x.razon, confianza: x.confianza };
        }),
        ...(out.cruces.length === 0 ? { advertencia: 'El modelo no devolvió ningún cruce: puede que no haya duplicados o que la respuesta haya venido vacía. Ante la duda, revisa con buscar_tareas_plan.' } : {}),
      });
    },
  },

  buscar_duplicados_tarea: {
    leer: async (input, ctx) => {
      const tab = await leerTablero(ctx.ws);
      const t = buscarTarea(tab, str(input, 'id'), null);
      if (!t) return error(`No encuentro la tarea «${str(input, 'id')}» en el plan de este negocio.`);
      const otras = tab.tareas.filter((x) => abierta(x) && x.id !== t.id);
      if (!otras.length) return json({ tarea: { id: t.id, titulo: t.titulo }, duplicados: [] });
      const titulo = new Map(otras.map((x) => [x.id, x.titulo]));
      const out = await buscarDuplicados(`${t.titulo}${t.detalle ? ` — ${recortar(t.detalle, 600)}` : ''}`, otras.map((x) => ({ id: x.id, titulo: x.titulo, detalle: x.detalle })), 'API MaKo: buscar duplicados');
      return json({
        tarea: { id: t.id, titulo: t.titulo },
        duplicados: out.duplicados.filter((d) => titulo.has(d.id)).map((d) => ({ id: d.id, titulo: titulo.get(d.id), razon: d.razon, link: linkTarea(d.id) })),
        // buscarDuplicados falla abierto (JSON ilegible o veto → []): vacío no prueba nada.
        ...(out.duplicados.length === 0 ? { advertencia: 'El modelo no devolvió ningún duplicado: puede que no haya o que la respuesta haya venido vacía. Ante la duda, revisa con buscar_tareas_plan.' } : {}),
      });
    },
  },

  listar_proyectos_vacios: {
    leer: async (_input, ctx) => {
      if (!(await usaPlanBoard(ctx.ws))) return json({ board: 'todo', proyectos: [], nota: 'Esta lectura solo existe en el tablero del super-admin.' });
      const vacios = await proyectosSinTareas();
      return json({
        board: 'plan', total: vacios.length,
        proyectos: vacios.sort((a, b) => b.score - a.score).map((p) => ({ id: p.id, nombre: p.nombre, emoji: p.emoji, score: p.score, detalle: recortar(p.detalle, 300) || null, link: linkProyecto(p.id) })),
      });
    },
  },

  ver_senales_negocio: {
    leer: async () => {
      const [senales, negocio] = await Promise.all([leerSenales(), contextoDelNegocio()]);
      return json({
        senales,
        fase: negocio.fase, canal: negocio.canal,
        nota: 'true = hay evidencia positiva. false = no se encontró evidencia (o la lectura falló), no prueba que falte. fase null = sin diagnóstico.',
      });
    },
  },

  sugerir_proyecto_plan: {
    leer: async (input) => {
      const s = await proponerProyecto(str(input, 'descripcion'), 'API MaKo: sugerir proyecto');
      if (!s.nombre) return error('MaKo no pudo sugerir un nombre para ese proyecto. Reformula la descripción.');
      return json({ nombre: s.nombre, emoji: s.emoji, detalle: s.detalle, nota: 'Es una sugerencia: no se creó nada. Pásalo en `proyecto` de proponer_tareas_plan.' });
    },
  },

  // ── Acciones por chat ─────────────────────────────────────────────────────

  descartar_borrador_plan: {
    preparar: async (input) => {
      const id = str(input, 'id');
      const p = await getPropuesta(id);
      if (!p) return { error: `No hay un borrador «${id}» en este negocio. Copia el id de listar_borradores_plan.` };
      if (p.estado !== 'pendiente') return { error: `Ese borrador ya está ${p.estado}: no hay nada que descartar.` };
      const deOtros = p.tareas.filter((t) => t.esDeOtro).length;
      const partes = [`Descartar el borrador «${recortar(p.resumen, 120) || id}» (${p.tareas.length} tareas, ${p.cerrar.length} cierres)`];
      if (deOtros) partes.push(`${deOtros} de esas tareas son compromisos de otras personas y también salen del reparto`);
      // Solo un borrador con `ref` (reunión, archivo) revive: crearPropuesta lo busca por ref.
      partes.push(p.ref ? 'Se puede revivir volviendo a leer la misma reunión o archivo' : 'No se puede deshacer');
      return { payload: { id }, resumen: `${partes.join('. ')}.` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const id = String(payload.id ?? '');
      const antes = await estadoDePropuesta(id);
      if (!antes) return { ok: false, resumen: 'El borrador ya no existe.' };
      if (antes.estado !== 'pendiente') return { ok: false, resumen: `El borrador ya estaba ${antes.estado}.` };
      await descartarPropuesta(id);
      // descartarPropuesta devuelve true aunque no haya tocado ninguna fila: se relee.
      const despues = await estadoDePropuesta(id);
      return despues?.estado === 'descartada'
        ? { ok: true, resumen: 'Borrador descartado.' }
        : { ok: false, resumen: 'No se pudo descartar el borrador.' };
    },
  },

  actualizar_avance_tarea: {
    preparar: async (input, ctx) => {
      const tab = await leerTablero(ctx.ws);
      const t = buscarTarea(tab, str(input, 'id'), null);
      if (!t) return { error: `No encuentro la tarea «${str(input, 'id')}» en el plan de este negocio.` };
      const avance = num(input, 'progreso') ?? 0;
      if (t.avance === avance) return { error: `La tarea «${t.titulo}» ya está en ${avance}%.` };
      return { payload: { id: t.id, progreso: avance }, resumen: `Cambiar el avance de «${recortar(t.titulo, 120)}» de ${t.avance}% a ${avance}%` };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const id = String(payload.id ?? '');
      const avance = Math.max(0, Math.min(99, Math.round(Number(payload.progreso) || 0)));
      if (await usaPlanBoard(ctx.ws)) {
        const t = (await listPlanBoard()).tareas.find((x) => x.id === id);
        if (!t) return { ok: false, resumen: 'La tarea ya no existe.' };
        const texto = `MaKo cambió el avance de ${t.progress}% a ${avance}%`;
        await guardarPlanTarea({ ...t, progress: avance, historial: [{ id: genHistId(), ts: Date.now(), actor: 'ia' as const, text: texto }, ...(t.historial ?? [])].slice(0, 40) });
        return { ok: true, resumen: `«${t.title}»: ${texto}` };
      }
      const t = (await listTareas()).find((x) => x.id === Number(id));
      if (!t) return { ok: false, resumen: 'La tarea ya no existe.' };
      const texto = `MaKo cambió el avance de ${t.progreso}% a ${avance}%`;
      await editarTarea(t.id, { progreso: avance, historial: [{ id: genHistId(), ts: Date.now(), actor: 'ia' as const, text: texto }, ...t.historial].slice(0, 40) });
      return { ok: true, resumen: `«${t.titulo}»: ${texto}` };
    },
  },

  agregar_dependencia_plan: {
    preparar: async (input, ctx) => {
      if (!(await usaPlanBoard(ctx.ws))) return { error: 'El tablero de este negocio no maneja dependencias.' };
      const tab = await leerTablero(ctx.ws);
      const entidad = str(input, 'entidad') as EntidadDep;
      const punta = (ref: string): { id: string; nombre: string } | null => {
        if (entidad === 'proyecto') { const p = buscarProyecto(tab, ref); return p ? { id: p.id, nombre: p.nombre } : null; }
        const t = buscarTarea(tab, ref, null);
        return t ? { id: t.id, nombre: t.titulo } : null;
      };
      const de = punta(str(input, 'deId'));
      const a = punta(str(input, 'aId'));
      if (!de || !a) return { error: `No encuentro ${!de ? `«${str(input, 'deId')}»` : `«${str(input, 'aId')}»`} entre los ${entidad === 'proyecto' ? 'proyectos' : 'tareas'} del plan.` };
      if (de.id === a.id) return { error: 'Las dos puntas son la misma.' };
      const ver = puedeDepender(tab.deps, entidad, de.id, a.id);
      if (!ver.ok) {
        const nombres = entidad === 'proyecto' ? nombresDeProyectos(tab) : new Map(tab.tareas.map((t) => [t.id, t.titulo]));
        return { error: 'Sería un círculo: eso ya espera a esto.', disponibles: { camino: ver.camino.map((x) => nombres.get(x) ?? x) } };
      }
      const clase: ClaseDep = str(input, 'clase') === 'ordena' ? 'ordena' : 'bloquea';
      const razon = str(input, 'razon');
      return {
        payload: { entidad, deId: de.id, aId: a.id, clase, razon },
        resumen: clase === 'bloquea'
          ? `«${recortar(de.nombre, 200)}» no puede empezar hasta que termine «${recortar(a.nombre, 200)}»: ${razon}`
          : `«${recortar(a.nombre, 200)}» va antes que «${recortar(de.nombre, 200)}» (sin frenarla): ${razon}`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const r = await agregarDependencia({
        entidad: payload.entidad as EntidadDep, deId: String(payload.deId), aId: String(payload.aId),
        clase: payload.clase as ClaseDep, razon: String(payload.razon ?? ''), origen: 'ia',
      });
      if (!r.ok) return { ok: false, resumen: r.error };
      return { ok: true, resumen: 'Dependencia agregada.' };
    },
  },

  quitar_dependencia_plan: {
    preparar: async (input, ctx) => {
      if (!(await usaPlanBoard(ctx.ws))) return { error: 'El tablero de este negocio no maneja dependencias.' };
      const entidad = str(input, 'entidad');
      const deId = str(input, 'deId');
      const aId = str(input, 'aId');
      const tab = await leerTablero(ctx.ws);
      const d = tab.deps.find((x) => x.entidad === entidad && x.deId === deId && x.aId === aId);
      if (!d) return { error: 'No existe esa dependencia. Mira las que hay con listar_dependencias_plan.' };
      const nombres = entidad === 'proyecto' ? nombresDeProyectos(tab) : new Map(tab.tareas.map((t) => [t.id, t.titulo]));
      return { payload: { entidad, deId, aId }, resumen: `Quitar la dependencia: «${recortar(nombres.get(deId) ?? deId, 80)}» espera a «${recortar(nombres.get(aId) ?? aId, 80)}»` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const entidad = payload.entidad as EntidadDep;
      const deId = String(payload.deId);
      const aId = String(payload.aId);
      await borrarDependencia(entidad, deId, aId);
      // borrarDependencia no mira el error de la base: se verifica releyendo.
      const sigue = (await listDependencias()).some((x) => x.entidad === entidad && x.deId === deId && x.aId === aId);
      return sigue ? { ok: false, resumen: 'No se pudo quitar la dependencia.' } : { ok: true, resumen: 'Dependencia quitada.' };
    },
  },

  guardar_termino_glosario: {
    // No usa guardarTermino (lib/glosario.ts): se traga el error, no devuelve la fila y
    // duplica el término en cada guardado. La verificación vieja releía glosarioTexto(),
    // que también ve los términos del ws 1: decía «quedó» aunque el insert fallara.
    preparar: async (input) => {
      const termino = str(input, 'termino').slice(0, 80);
      const definicion = str(input, 'definicion').slice(0, 400);
      if (!termino || !definicion) return { error: 'Faltan el término o su definición.', faltan: [!termino ? 'termino' : 'definicion'] };
      let ya: { id: number; cuerpo: string } | undefined;
      try {
        ya = (await terminosDelGlosario()).find((k) => k.titulo.trim().toLowerCase() === termino.toLowerCase());
      } catch {
        return { error: 'No pude leer el glosario de este negocio para ver si el término ya estaba. Intenta de nuevo en un momento.' };
      }
      if (ya && ya.cuerpo.trim() === definicion) return { error: `«${termino}» ya está en el glosario con esa misma definición.` };
      // El resumen lleva la definición COMPLETA: lo que se confirma es lo que se escribe.
      if (ya) return { payload: { termino, definicion }, resumen: `Cambiar en el glosario la definición de «${termino}». Antes: ${ya.cuerpo.trim()} · Ahora: ${definicion}` };
      return { payload: { termino, definicion }, resumen: `Guardar en el glosario: «${termino}» = ${definicion}` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const termino = String(payload.termino ?? '').trim().slice(0, 80);
      const definicion = String(payload.definicion ?? '').trim().slice(0, 400);
      if (!termino || !definicion) return { ok: false, resumen: 'Faltan el término o su definición.' };
      try {
        // Se vuelve a buscar AL ESCRIBIR: entre el «sí» y la propuesta pueden pasar 2 h.
        const ya = (await terminosDelGlosario()).find((k) => k.titulo.trim().toLowerCase() === termino.toLowerCase());
        const fila = ya
          ? await updateKnowledge(ya.id, { cuerpo: definicion, activo: true })
          : await createKnowledge({ titulo: termino, cuerpo: definicion, area: AREA_GLOSARIO, fuente: 'reunión' });
        return fila ? { ok: true, resumen: `«${termino}» quedó en el glosario.` } : { ok: false, resumen: 'No se pudo guardar el término.' };
      } catch (e) {
        return { ok: false, resumen: `No se pudo guardar el término: ${e instanceof Error ? e.message : String(e)}` };
      }
    },
  },

  // ── Acciones por pantalla (borrador en /plan/revisar) ─────────────────────

  // Heredada: la tool vieja valida, arma el borrador y devuelve { ok, link, borrador,
  // tareas, eliminar, instruccion }. `eliminar` ya no se declara como
  // parámetro (las bajas no se ejecutan: /plan/revisar no tiene paso de bajas y
  // aplicarPropuestas no borra sin eliminarIds), así que tampoco se devuelve.
  // ⚠️ La tool vieja firma el borrador con origen 'whatsapp' venga de donde venga (por
  // HTTP y por la app también): al mudar el cuerpo, pasar origenBorrador(ctx). Se niega si `mensajeUsuario` parece un
  // «sí» pelado; por HTTP no hay mensaje, así que se le pasa uno que no lo parezca.
  proponer_tareas_plan: {
    proponer: async (input, ctx) => {
      const runner = crearRunnerAcciones(ctx.ws, ctx.canalKey, ctx.turnStart ?? 0, ctx.mensajeUsuario ?? '(pedido por la API)');
      const crudo = await texto(runner('proponer_tareas_plan', input));
      let j: Record<string, unknown>;
      try { j = JSON.parse(crudo) as Record<string, unknown>; } catch { return { error: crudo }; }
      if (j.ok !== true || typeof j.link !== 'string') return { error: String(j.error ?? 'No se pudo armar el borrador.') };
      return {
        // ⚠️ Sin la query: el link lleva `?ws=N` (linkApp) y con él pegado el id no existe en
        // plan_propuestas. Medido por la revisión del 08/10: desde un flujo, «El borrador del plan ya
        // no existe» en cada corrida, con el borrador real colgado en /plan/revisar.
        id: j.link.split(/[?#]/)[0].split('/').pop() ?? '', url: j.link, nueva: true,
        extra: { borrador: j.borrador, tareas: j.tareas },
      };
    },
    ejecutar: async () => ({ ok: false, resumen: 'Este borrador se confirma en su pantalla de revisión (/plan/revisar), no por aquí.' }),
  },

  proponer_cierre_tareas: {
    proponer: async (input, ctx) => {
      const items = lista(input, 'cerrar');
      const tab = await leerTablero(ctx.ws);
      const cerrar: Array<{ id: string; evidencia: string; confianza: 'alta' | 'media'; titulo: string }> = [];
      const noEstan: string[] = [];
      const cortas: string[] = [];
      for (const c of items) {
        const t = buscarTarea(tab, str(c, 'id'), null);
        if (!t || !abierta(t)) { noEstan.push(str(c, 'id')); continue; }
        const evidencia = str(c, 'evidencia');
        if (evidencia.length < 10) { cortas.push(t.titulo); continue; }
        cerrar.push({ id: t.id, evidencia, confianza: str(c, 'confianza') === 'alta' ? 'alta' : 'media', titulo: t.titulo });
      }
      if (noEstan.length) return { error: `Estas tareas no existen o ya están hechas en el plan de este negocio: ${noEstan.join(', ')}. Revisa los ids con ver_plan.` };
      if (cortas.length) return { error: `Falta evidencia (mínimo 10 caracteres) para: ${cortas.map((x) => `«${recortar(x, 60)}»`).join(', ')}.` };
      if (!cerrar.length) return { error: 'Pasa al menos una tarea en `cerrar`.' };
      const id = await crearPropuesta({
        tareas: [], cerrar, origen: origenBorrador(ctx),
        resumen: str(input, 'resumen') || `Cerrar ${cerrar.length} tarea${cerrar.length === 1 ? '' : 's'} ya hecha${cerrar.length === 1 ? '' : 's'}`,
      });
      return { id, url: linkBorrador(id), nueva: true, extra: { cierres: cerrar.length } };
    },
    ejecutar: async () => ({ ok: false, resumen: 'Los cierres se confirman de a uno en la pantalla de revisión (/plan/revisar), no por aquí.' }),
  },

  proponer_ampliar_tareas: {
    proponer: async (input, ctx) => {
      const items = lista(input, 'items');
      const tab = await leerTablero(ctx.ws);
      const tareas: Array<{ titulo: string; detalle: string; enriquece: { id: string; razon: string; confianza: 'alta' } }> = [];
      const noEstan: string[] = [];
      for (const it of items) {
        const t = buscarTarea(tab, str(it, 'id'), null);
        // Solo ABIERTAS: al aplicar, el borrador busca la tarea a ampliar entre las
        // abiertas; una hecha no la encontraría y crearía una tarea nueva.
        if (!t || !abierta(t)) { noEstan.push(str(it, 'id')); continue; }
        const detalle = str(it, 'detalle');
        if (!detalle) continue;
        tareas.push({ titulo: t.titulo, detalle, enriquece: { id: t.id, razon: str(it, 'razon'), confianza: 'alta' } });
      }
      if (noEstan.length) return { error: `Estas tareas no existen o ya están hechas en el plan de este negocio: ${noEstan.join(', ')}. Solo se amplían tareas abiertas.` };
      if (!tareas.length) return { error: 'Pasa al menos un ítem con id y detalle.' };
      const id = await crearPropuesta({
        tareas, origen: origenBorrador(ctx),
        resumen: str(input, 'resumen') || `Sumar contexto a ${tareas.length} tarea${tareas.length === 1 ? '' : 's'} que ya existe${tareas.length === 1 ? '' : 'n'}`,
      });
      return { id, url: linkBorrador(id), nueva: true, extra: { ampliaciones: tareas.length } };
    },
    ejecutar: async () => ({ ok: false, resumen: 'Las ampliaciones se confirman en la pantalla de revisión (/plan/revisar), no por aquí.' }),
  },

  proponer_tareas_proyecto_vacio: {
    proponer: async (input, ctx) => {
      if (!(await usaPlanBoard(ctx.ws))) return { error: 'Esta acción solo existe en el tablero del super-admin.' };
      const r = await proponerTareasParaProyecto(str(input, 'projId'));
      if ('error' in r) return { error: r.error };
      return { id: r.id, url: linkBorrador(r.id), nueva: true, extra: { tareas: r.n } };
    },
    ejecutar: async () => ({ ok: false, resumen: 'Este borrador se confirma en su pantalla de revisión (/plan/revisar), no por aquí.' }),
  },
};
