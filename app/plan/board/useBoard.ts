'use client';

// useBoard — estado + toda la lógica del tablero (optimista, change history, undo).
// La persistencia la inyecta el `Repo` (localStorage en admin, API en cliente).

import { useEffect, useRef, useState } from 'react';
import { useUndoToast } from '../../_components/UndoToast';
import { quarterDeFecha } from './cuando';
import { type BoardTask, type Label, type BoardUser, type Repo, type Hist, type Actor, type Fuente, type Prio, type EstadoTarea, type Check, type GuardPatch, type GuardProjPatch, PLABEL, MAX_PRIORIDAD, HIST_CAP, uid, clampPct, clampScore, clampProj, prioFromScore, scoreFromPrio, estadoDe, conPatchDelServer } from './types';
import { type Dep, type ClaseDep, type EntidadDep, puedeDepender } from './dependencias';
import { baseCorrida } from './lugar-al-soltar';
// «Se repite para siempre» (mig 0163). El predicado, la regla de la fecha y los porqués
// salen del módulo de datos: una pantalla no escribe `t.recurrente === true` ni redacta de
// nuevo por qué algo no compite.
import { esRecurrente, llevaDeadline, recurrenciaOk, textoRepeticionCorto } from '@/lib/plan-recurrentes';
// DE QUIÉN es una tarjeta (mig 0172). Mismo criterio que arriba: el predicado y los
// textos salen del módulo compartido, que también leen los dos pickers y Customer Success.
import { clienteDe, SIN_CLIENTE } from '@/lib/plan-clientes';
import { alCrear, trasMover, motivoParaNoMover, etiquetaEstado } from '@/lib/todo-estados';
// EL KANBAN POR ESTADO (16/10/2026): la columna que le toca a un avance nuevo y el lugar de
// «arriba de todo», con la misma regla que el server. Ver app/plan/board/kanban.ts.
import { avanceLocal, ordenTopeLocal } from './kanban';

export type GuardScore = { id: string; score: number; razon: string; impacto?: number; esfuerzo?: number };

const now = () => Date.now();

export function useBoard(initialTasks: BoardTask[], initialLabels: Label[], user: BoardUser, repo: Repo, initialDeps: Dep[] = []) {
  const [tasks, setTasks] = useState<BoardTask[]>(initialTasks);
  const [labels, setLabels] = useState<Label[]>(initialLabels);
  // Las dependencias NO viven adentro de la tarea (mig 0140: tabla propia). El autosave de
  // acá abajo upsertea la FILA ENTERA desde el estado del navegador, así que un campo
  // dentro de la tarea lo pisaría una pestaña con estado viejo, sin error y sin build roto.
  // Con la relación afuera, ese modo de falla no existe.
  const [deps, setDeps] = useState<Dep[]>(initialDeps);
  const { undo, show, clear } = useUndoToast();

  const byId = (id: string) => tasks.find((t) => t.id === id) ?? null;

  // ── persistencia por "dirty set": marcamos ids cambiados y un efecto los
  // guarda con el estado FRESCO (evita el clobber de precomputar `next`). ──
  const dirty = useRef<Set<string>>(new Set());
  const markDirty = (id: string) => { dirty.current.add(id); };
  // EL ÚLTIMO AVANCE QUE LA BASE CONFIRMÓ, por tarea (16/10/2026): viaja con cada guardado
  // (`progresoGuardado`) para que el server sepa si ESTA pestaña tocó el avance. Sin eso, el del
  // dueño comparaba el avance viejo de la pestaña contra la fila: una tarea completada desde el
  // teléfono (100%) volvía a «En proceso» al 40% en cuanto la pestaña vieja le corregía el título.
  // Es la misma primera capa que el cliente tiene en TodoBoard (`progresoGuardado`). No es estado
  // de React: no dibuja nada.
  const avanceGuardado = useRef<Map<string, number> | null>(null);
  if (avanceGuardado.current === null) avanceGuardado.current = new Map(initialTasks.map((t) => [t.id, t.progress]));
  const confirmarAvance = (t: { id: string; progress: number } | null | undefined) => { if (t) avanceGuardado.current!.set(t.id, t.progress); };
  useEffect(() => {
    if (dirty.current.size === 0) return;
    const ids = [...dirty.current]; dirty.current.clear();
    for (const id of ids) {
      const t = tasks.find((x) => x.id === id);
      if (t) void repo.saveTask(t, { progresoGuardado: avanceGuardado.current!.get(t.id) }).then(() => confirmarAvance(t)).catch((e) => console.error('[board] saveTask', e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  /**
   * ⚠️ LOS PROYECTOS TAMBIÉN VAN POR DIRTY SET, Y ANTES NO. Las cuatro funciones que
   * guardan un proyecto sacaban el objeto a escribir de ADENTRO del updater de `setLabels`
   * (`let next = null` … `if (next) repo.saveLabel(next)`), y eso funciona **sólo cuando la
   * cola de actualizaciones está vacía**: React evalúa el updater de forma anticipada para
   * ver si el estado cambió, pero únicamente en ese caso. Con la cola ya cargada —que es
   * exactamente lo que pasa al tocar N proyectos en el mismo handler— el updater corre
   * DESPUÉS, `next` sigue en `null` y la llamada a `repo.saveLabel` no ocurre nunca.
   *
   * O sea: el primero del lote se guardaba y los N-1 restantes se pintaban en pantalla y
   * volvían solos al F5, sin un error. Medido sobre la barra de selección múltiple de
   * proyectos, que escribía **1 de N**.
   *
   * La cura no es nueva: es la MISMA que las tareas usan desde siempre acá arriba, con su
   * porqué ya escrito («evita el clobber de precomputar `next`»). Un efecto sobre el estado
   * ya commiteado guarda lo FRESCO, así que no depende de cuándo React corra el updater ni
   * de cuántas llamadas haya en el mismo evento.
   */
  const dirtyL = useRef<Set<string>>(new Set());
  const markDirtyLabel = (id: string) => { dirtyL.current.add(id); };
  useEffect(() => {
    if (dirtyL.current.size === 0) return;
    const ids = [...dirtyL.current]; dirtyL.current.clear();
    for (const id of ids) { const l = labels.find((x) => x.id === id); if (l) void repo.saveLabel(l).catch((e) => console.error('[board] saveLabel', e)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labels]);

  const mkEntry = (actor: Actor, text: string, field: string, prev: unknown): Hist => ({ id: uid(), ts: now(), actor, text, undo: { field, prev } });

  /**
   * LA COLUMNA SIGUE AL AVANCE EN LA PANTALLA, como en el server (16/10/2026). Las columnas del
   * kanban son el ESTADO, y el server lo mueve cuando el avance CAMBIA (`estadoAlGuardar`):
   * completar desde «En proceso» la pasa a «Completada», reabrir la devuelve. Sin esto la
   * tarjeta tachada se quedaba en su columna hasta el F5 — la base decía una cosa y la pantalla
   * otra. Si el MISMO cambio trae un estado explícito (mover, deshacer un mover), manda ése.
   */
  const conAvance = (antes: BoardTask, despues: BoardTask): BoardTask =>
    despues.progress === antes.progress || despues.estado !== antes.estado ? despues : { ...despues, ...avanceLocal(antes, despues.progress) };

  // patch sin log (acumula en el updater con el task fresco)
  const patch = (id: string, fields: Partial<BoardTask>) => {
    setTasks((ts) => ts.map((x) => (x.id === id ? conAvance(x, { ...x, ...fields }) : x)));
    markDirty(id);
  };

  // patch + entrada en el change history. El `prev` para el undo se lee del task
  // ACTUAL (correcto para campos distintos); el nuevo valor se aplica DENTRO del
  // updater sobre el task fresco, así dos cambios encadenados no se pisan.
  function patchLog<K extends keyof BoardTask>(id: string, field: K, value: BoardTask[K], text: string, actor: Actor = 'user') {
    const t = byId(id); if (!t) return;
    const entry = mkEntry(actor, text, field, t[field]);
    setTasks((ts) => ts.map((x) => (x.id === id ? conAvance(x, { ...x, [field]: value, historial: [entry, ...x.historial].slice(0, HIST_CAP) }) : x)));
    markDirty(id);
    ofrecerDeshacer(id, entry, actor);
  }
  // igual pero con `prev` explícito (para valores que ya venían editándose en vivo)
  function patchLogExplicit<K extends keyof BoardTask>(id: string, field: K, value: BoardTask[K], prev: unknown, text: string, actor: Actor = 'user') {
    const entry = mkEntry(actor, text, field, prev);
    setTasks((ts) => ts.map((x) => (x.id === id ? conAvance(x, { ...x, [field]: value, historial: [entry, ...x.historial].slice(0, HIST_CAP) }) : x)));
    markDirty(id);
    ofrecerDeshacer(id, entry, actor);
  }

  /**
   * Un cambio que toca VARIOS campos de una tarea pero es UNA decisión: una entrada en el
   * change history, un solo toast de deshacer, y el `prev` de todos los campos juntos.
   *
   * Es la gemela de `patchLabelLog`, que ya hacía esto para un proyecto. Sin ella, asignar
   * un cliente serían dos `patchLogExplicit` —id y nombre— o sea dos renglones idénticos en
   * el historial y dos botones de deshacer, de los cuales apretar uno solo deja la tarjeta
   * con el id de un cliente y el nombre de otro.
   */
  function patchLogFields(id: string, fields: Partial<BoardTask>, text: string, actor: Actor = 'user') {
    const t = byId(id); if (!t) return;
    const prev: Record<string, unknown> = {};
    for (const k of Object.keys(fields)) prev[k] = (t as unknown as Record<string, unknown>)[k];
    const entry = mkEntry(actor, text, '__task__', prev);
    setTasks((ts) => ts.map((x) => (x.id === id ? conAvance(x, { ...x, ...fields, historial: [entry, ...x.historial].slice(0, HIST_CAP) }) : x)));
    markDirty(id);
    ofrecerDeshacer(id, entry, actor);
  }

  /**
   * EL BOTÓN DE ARREPENTIMIENTO, PARA TODOS LOS CAMBIOS.
   *
   * «A TODOS los cambios, absolutamente todos, debería saltar el pequeño botón de
   * arrepentimiento que dura 5 segundos… TODOS los cambios, sea cual sea» (23/09/2026).
   *
   * ⚠️ VA EN EL CHOKE POINT, NO EN CADA LLAMADOR. Antes lo pedían tres call sites a mano
   * (borrar, mover de columna y completar) y los otros ~20 campos —título, detalle, fecha,
   * quarter, avance, notas, proyecto— cambiaban sin red. Ponerlo en cada uno es la garantía
   * de que el próximo campo nazca sin él: acá pasan TODOS los cambios logueados de una
   * tarea, así que un campo nuevo lo hereda sin que nadie se acuerde.
   *
   * Sólo para `actor === 'user'`: lo que hizo MaKo no se deshace con un toast —queda en el
   * historial, que es donde se audita— y un toast por cada tarjeta que toca el Perro sería
   * un toast permanente.
   */
  function ofrecerDeshacer(id: string, entry: Hist, actor: Actor) {
    if (actor !== 'user' || !entry.undo) return;
    show(entry.text, () => undoHist(id, entry));
  }

  const create = async (title: string, priority: Prio, labelsIn?: string[], meta?: { origen?: Actor; fuente?: Fuente; altaText?: string; detalle?: string; score?: number; estado?: EstadoTarea }): Promise<BoardTask | null> => {
    const v = title.trim(); if (!v) return null;
    const maxN = tasks.reduce((m, t) => Math.max(m, t.num), 0);
    // `labelsIn` undefined = "no me dijeron proyecto" → hereda el primero (alta manual
    // dentro de un tablero de un solo proyecto). `labelsIn` = [] es DISTINTO: es "esta
    // tarea NO va a ningún proyecto", y hay que respetarlo. Sin esa diferencia, toda
    // tarea que la IA dejó sin proyecto se apilaba en el primero de la lista — por eso
    // terminaba TODO dentro de «Setup inicial de Maco», incluidas tareas de otras
    // personas y de temas que no tenían nada que ver.
    const labels0 = labelsIn ? labelsIn : (repo.labelMode === 'single' && labels[0] ? [labels[0].id] : []);
    // El emoji nace heredado del proyecto elegido (o 📌); editable después.
    const emoji0 = labels.find((l) => l.id === labels0[0])?.emoji || '📌';
    // origen + fuente + texto del alta: por default es una tarjeta del usuario, pero
    // quien la crea desde otra fuente (Fathom/WhatsApp/archivo) los pasa por `meta`.
    const actor: Actor = meta?.origen ?? 'user';
    // El SCORE y la COLUMNA con que nace (16/10/2026): `meta.score` 0 = «Sin priorizar» (la tarea
    // libre que no puntúa nadie hasta «Re-priorizar todo»); sin él, el número representativo de
    // la banda, como siempre. `meta.estado` = el «＋» de una columna; el avance se acomoda a él.
    const score0 = meta?.score != null ? clampScore(meta.score) : scoreFromPrio[priority];
    const nace = alCrear(meta?.estado, 0);
    const draft: BoardTask = { id: 'tmp' + uid(), num: maxN + 1, emoji: emoji0, title: v, detalle: meta?.detalle ?? '', priority: meta?.score != null ? prioFromScore(score0) : priority, score: score0, estado: nace.estado, progress: nace.progreso, deadline: '', labels: labels0, checklist: [], historial: [{ id: uid(), ts: now(), actor, text: meta?.altaText || 'Creó la tarjeta' }], origen: actor, fuente: meta?.fuente, enPrioridad: false, recurrente: false };
    setTasks((ts) => [draft, ...ts]);
    try {
      const canon = await repo.createTask(draft);
      // preservar ediciones en vuelo: mantenemos el task local y solo fijamos el id real
      //
      // ⚠️ Y EL CLIENTE, QUE LO PONE EL REPO Y NO EL BORRADOR. Cuando el tablero está
      // filtrado a un cliente (la ficha de Customer Success), `clienteFijo` envuelve
      // `repo.createTask` e inyecta el lead: el borrador local NO lo conoce. Si no se
      // copia de vuelta acá, el `markDirty` de la línea siguiente dispara un `saveTask`
      // con el task LOCAL —que no lo tiene— y el upsert de la fila entera lo manda como
      // `null`: la tarea nace con dueño y lo pierde milisegundos después, sin un solo
      // error. Al recargar ya no está en la ficha, que es exactamente el modo de falla que
      // el docstring de `clienteFijo` dice estar evitando. Medido el 27/09/2026.
      //
      // `?? x.clienteLeadId` y no a secas: un repo que NO inyecta nada (el tablero normal)
      // devuelve el borrador tal cual, y ahí lo que vale es lo que ya tenía el local.
      setTasks((ts) => ts.map((x) => (x.id === draft.id ? { ...x, id: canon.id, num: canon.num || x.num, origen: canon.origen, clienteLeadId: canon.clienteLeadId ?? x.clienteLeadId, clienteNombre: canon.clienteNombre ?? x.clienteNombre,
        // La columna y el LUGAR los decide el server (`ordenTope`: arriba de la columna). Sin esto
        // la tarjeta local no tiene `orden` y el kanban no sabe dónde dibujarla hasta el F5.
        estado: canon.estado ?? x.estado, orden: canon.orden ?? x.orden } : x)));
      confirmarAvance(canon);
      markDirty(canon.id);
      draft.labels.forEach((lid) => logProject(lid, `Agregó la tarea «${v.slice(0, 38)}»`));
      return { ...draft, id: canon.id };
    } catch (e) {
      console.error('[board] createTask', e);
      setTasks((ts) => ts.filter((x) => x.id !== draft.id)); // revertir la tarjeta optimista
      return null;
    }
  };

  // Borra sin toast propio (para deshacer un alta en lote: el toast lo maneja el caller).
  const removeSilent = (id: string) => {
    if (!byId(id)) return;
    setTasks((ts) => ts.filter((t) => t.id !== id));
    void repo.deleteTask(id).catch((e) => console.error('[board] deleteTask', e));
  };
  const remove = (id: string, motivo?: string) => {
    const snap = byId(id); if (!snap) return;
    setTasks((ts) => ts.filter((t) => t.id !== id));
    void repo.deleteTask(id).catch((e) => console.error('[board] deleteTask', e));
    snap.labels.forEach((lid) => logProject(lid, `Eliminó la tarea «${snap.title.slice(0, 34)}»${motivo ? ` — ${motivo.slice(0, 60)}` : ''}`));
    show('Tarea eliminada', async () => {
      setTasks((ts) => [snap, ...ts]);
      try { const canon = await repo.createTask(snap); setTasks((ts) => ts.map((t) => (t.id === snap.id ? canon : t))); }
      catch (e) { console.error('[board] restore', e); }
    });
  };

  // El SCORE es la fuente de verdad; la columna (priority) se DERIVA de él.
  //
  // ⚠️ Escribe TAMBIÉN `scoreBase` (mig 0141), y es lo que hace que arrastrar una tarjeta
  // signifique algo. Sin esto, el reparto determinista la devolvía a su lugar en la
  // siguiente corrida: arrastro, rebota, arrastro, rebota, sin nada que lo explique.
  // Mover una tarjeta a mano ES un juicio, y un juicio se guarda donde viven los juicios.
  const setScore = (id: string, score: number, text: string, actor: Actor = 'user', razon?: string) => {
    const t = byId(id); if (!t) return;
    const s = clampScore(score);
    const entry = mkEntry(actor, text, 'score', t.score);
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, score: s, scoreBase: s, priority: prioFromScore(s), scoreRazon: razon ?? x.scoreRazon, historial: [entry, ...x.historial].slice(0, HIST_CAP) } : x)));
    markDirty(id);
    // El score no pasa por `patchLog` (toca tres campos a la vez), así que pide el
    // arrepentimiento por su cuenta — la regla es la misma: todo cambio de una persona.
    ofrecerDeshacer(id, entry, actor);
  };
  const moveTo = (id: string, priority: Prio) => {
    const t = byId(id); if (!t || t.priority === priority) return;
    // El toast sale de `setScore`, que ya ofrece deshacer (y revierte el score exacto, no
    // el representativo de la columna). Acá había uno propio y con el arrepentimiento
    // general salían dos, uno encima del otro.
    setScore(id, scoreFromPrio[priority], `Movió a ${PLABEL[priority]}`);
  };
  /**
   * MOVER UNA TARJETA EN EL KANBAN (16/10/2026, «hacer el kanban un kanban»): a otra columna
   * (`estado`) y/o a otro lugar dentro de la columna (`orden`). Sin `orden`, arriba de la columna
   * (el dedo, el detalle). `motivo` sólo dice algo yendo a «Atorada» (`undefined` lo conserva).
   *
   * Optimista: la tarjeta cambia ya (`trasMover`, la MISMA regla del server: Completada = 100%,
   * sacarla de ahí la reabre en 0%), escribe por `repo.mover` y se queda con lo que contesta la
   * base. Si la base dice que no, vuelve a su lugar y el toast dice por qué.
   *
   * ⚠️ NO PREGUNTA LA PRIORIDAD, y es la decisión entera: «cuando tú muevas una tarjeta, yo no
   * debería preguntarte cuál es la nueva prioridad» → «Es correcto» (Mauricio, 12/10/2026). Hasta
   * el 16/10 soltar en una columna abría el pop-up del 1 al 100 (decisión del 23/09, reemplazada).
   *
   * ⚠️ NO PASA POR EL GUARDADO DE LA TARJETA (`markDirty`): el estado y el lugar no viajan en el
   * upsert de la fila entera (ver `BoardTask.estado`). La entrada del historial va en el MISMO
   * pedido (`opts.historial`). Reordenar dentro de la columna no deja historial: es acomodar, no
   * un cambio de la tarea — pero sí ofrece deshacer, como todo cambio de una persona.
   */
  const tasksVivas = useRef<BoardTask[]>(tasks);
  useEffect(() => { tasksVivas.current = tasks; });
  type AntesDeMover = { estado: EstadoTarea; progress: number; motivoAtorada: string | null; orden: number | undefined };
  const mover = async (id: string, estado: EstadoTarea, orden?: number, motivo?: string | null): Promise<boolean> => {
    const t = byId(id); if (!t || !repo.mover) return false;
    const no = motivoParaNoMover(t, estado);
    if (no) { show(no); return false; }
    const desde = estadoDe(t);
    const lugar = orden ?? (desde === estado ? t.orden : undefined) ?? ordenTopeLocal(tasks, estado, id);
    const r = trasMover({ estado: desde, progreso: t.progress, motivo: t.motivoAtorada ?? null }, estado, motivo);
    const cambiaCol = desde !== estado;
    const cambiaMotivo = !cambiaCol && r.motivo !== (t.motivoAtorada ?? null);
    if (!cambiaCol && !cambiaMotivo && lugar === t.orden) return true;
    const texto = cambiaCol ? `Movió a ${etiquetaEstado(estado)}${r.motivo ? ` — ${r.motivo}` : ''}`
      : cambiaMotivo ? (r.motivo ? `Atorada: ${r.motivo}` : 'Le quitó el motivo') : null;
    const entry: Hist | null = texto ? { id: uid(), ts: now(), actor: 'user', text: texto.slice(0, 220) } : null;
    const historial = entry ? [entry, ...t.historial].slice(0, HIST_CAP) : undefined;
    const antes: AntesDeMover = { estado: desde, progress: t.progress, motivoAtorada: t.motivoAtorada ?? null, orden: t.orden };
    setTasks((ts) => ts.map((x) => (x.id === id
      ? { ...x, estado: r.estado, progress: r.progreso, motivoAtorada: r.motivo, orden: lugar, ...(entry ? { historial: [entry, ...x.historial].slice(0, HIST_CAP) } : {}) }
      : x)));
    // El TOAST es corto (3-4 palabras, la regla de la casa): el motivo va al historial, no acá.
    show(cambiaCol ? `Movió a ${etiquetaEstado(estado)}` : cambiaMotivo ? 'Motivo guardado' : 'Cambió el lugar', () => { void deshacerMover(id, antes, entry?.id); });
    try {
      const canon = await repo.mover(id, estado, lugar, { motivo, historial });
      if (canon) { confirmarAvance({ id, progress: canon.progress }); setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, estado: canon.estado ?? x.estado, progress: canon.progress, motivoAtorada: canon.motivoAtorada ?? null, orden: canon.orden ?? x.orden } : x))); }
      return true;
    } catch (e) {
      console.error('[board] mover', e);
      setTasks((ts) => ts.map((x) => (x.id === id
        ? { ...x, ...antes, historial: entry ? x.historial.filter((h) => h.id !== entry.id) : x.historial }
        : x)));
      show(e instanceof Error && e.message ? e.message.slice(0, 80) : 'No se pudo mover');
      return false;
    }
  };
  /** El «Deshacer» del toast de mover: vuelve a la columna, al lugar y al motivo de antes, y saca la entrada. */
  const deshacerMover = async (id: string, antes: AntesDeMover, entryId?: string) => {
    if (!repo.mover) return;
    // El toast se aprieta DESPUÉS: la tarjeta de este closure es vieja. Se lee la viva.
    const vivo = tasksVivas.current.find((x) => x.id === id);
    if (!vivo) return;
    const historial = entryId ? vivo.historial.filter((h) => h.id !== entryId) : undefined;
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, ...antes, ...(entryId ? { historial: x.historial.filter((h) => h.id !== entryId) } : {}) } : x)));
    try {
      // EL AVANCE DE ANTES VIAJA EN EL MISMO MOVER (`progreso`, 16/10/2026). Hasta ese día volvía
      // por un SEGUNDO guardado de la tarjeta, y el server lo leía como «cambió el avance»
      // (`estadoAlGuardar`): una tarjeta en «Por iniciar» al 40%, completada y deshecha, quedaba en
      // «Por iniciar» en la pantalla y en «En proceso» en la base hasta el F5.
      const canon = await repo.mover(id, antes.estado, antes.orden, { motivo: antes.motivoAtorada, historial, progreso: antes.progress });
      if (canon) { confirmarAvance({ id, progress: canon.progress }); setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, estado: canon.estado ?? x.estado, progress: canon.progress, motivoAtorada: canon.motivoAtorada ?? null, orden: canon.orden ?? x.orden } : x))); }
    } catch (e) {
      console.error('[board] deshacer mover', e);
      show('No se pudo deshacer');
    }
  };
  /** El motivo de «Atorada», sin moverla de lugar (el campo chico que sale al soltar ahí). */
  const setMotivoAtorada = (id: string, motivo: string | null) => {
    const t = byId(id); if (!t || estadoDe(t) !== 'en_seguimiento') return;
    void mover(id, 'en_seguimiento', t.orden, motivo);
  };
  // aplica la puntuación del guardián: score → columna derivada, 1 entrada por tarea.
  const applyGuardian = (tareas: GuardScore[], proyectos: GuardScore[]) => {
    setTasks((ts) => ts.map((x) => {
      const g = tareas.find((t) => t.id === x.id); if (!g) return x;
      const s = clampScore(g.score);
      const entry = mkEntry('ia', `Priorizó · score ${s}`, 'score', x.score);
      return { ...x, score: s, scoreBase: s, priority: prioFromScore(s), scoreRazon: g.razon, impacto: g.impacto ?? x.impacto, esfuerzo: g.esfuerzo ?? x.esfuerzo, historial: [entry, ...x.historial].slice(0, HIST_CAP) };
    }));
    tareas.forEach((t) => markDirty(t.id));
    setLabels((ls) => ls.map((l) => { const g = proyectos.find((p) => p.id === l.id); return g ? { ...l, score: clampProj(g.score), scoreRazon: g.razon || l.scoreRazon } : l; }));
    proyectos.forEach((p) => { const l = labels.find((x) => x.id === p.id); if (l) void repo.saveLabel({ ...l, score: clampProj(p.score), scoreRazon: p.razon || l.scoreRazon }).catch((e) => console.error('[board] saveLabel', e)); });
  };

  // Igual que applyGuardian pero para el Perro SERVER-SIDE: la DB ya quedó escrita, así
  // que acá solo sincronizamos la pantalla. NADA de markDirty/saveTask: volver a guardar
  // desde el navegador es justo lo que borraba el trabajo del Perro (upsert de fila
  // completa con el estado viejo). Trae también detalle y checklist, que el path client
  // no tiene.
  const aplicarPerroServer = (patches: GuardPatch[], proys: GuardProjPatch[] = []) => {
    if (patches.length) {
      setTasks((ts) => ts.map((x) => {
        const p = patches.find((q) => q.id === x.id);
        // La regla campo por campo vive en `conPatchDelServer` (types.ts), pura y con test.
        return p ? conPatchDelServer(x, p) : x;
      }));
    }
    if (proys.length) {
      setLabels((ls) => ls.map((l) => {
        const p = proys.find((q) => q.id === l.id); if (!p) return l;
        return { ...l, score: clampProj(p.score), scoreRazon: p.scoreRazon || l.scoreRazon, impacto: p.impacto ?? l.impacto, esfuerzo: p.esfuerzo ?? l.esfuerzo, emoji: p.emoji || l.emoji, detalle: p.detalle || l.detalle };
      }));
    }
  };

  // La PRIORIDAD A MANO ya la escribió el server (`fijarPrioridadAMano`): columna por
  // columna, por id, con su cascada. Acá solo se sincroniza la pantalla — sin markDirty y
  // sin saveLabel, porque volver a guardar desde el navegador es cómo una pestaña con
  // estado viejo pisa lo que el server acaba de decidir.
  //
  // ⚠️ `scoreBase` y `scoreManual` se actualizan TAMBIÉN acá aunque no se vean. Si el
  // estado local se queda con el viejo, el próximo autosave de esa tarea (cambiarle el
  // título, tildar algo) upsertea la fila entera y devuelve `score_base` al número de
  // antes y `score_manual` a false: el candado se abre solo, sin que nadie lo toque.
  const aplicarCascadaManual = (
    entidad: 'proyecto' | 'tarea',
    fijado: { id: string; score: number; razon: string; texto: string },
    /**
     * Lo que se corrió para hacerle lugar. En un PROYECTO es la cascada del método; en una
     * TAREA son las de abajo que corrió un arrastre del Kanban (`hacerLugar`). Con `antes`, el
     * deshacer las puede devolver.
     */
    movidos: Array<{ id: string; despues: number; antes?: number }> = [],
    /**
     * ⚠️ EN FALSE PARA UNA ACCIÓN EN LOTE, y es la Única razón por la que existe el
     * parámetro. El toast vive en UN solo casillero (`useToast`: `show` pisa al anterior),
     * así que fijarle la prioridad a cuatro tarjetas dispara cuatro carteles seguidos y el
     * que queda arriba deshace UNA — exactamente lo que la regla de la casa prohíbe. Quien
     * hace el lote saca su propia foto de las N y pisa con un deshacer que las revierte
     * juntas.
     *
     * ⚠️ Y `fijado.texto` VACÍO NO ESCRIBE ENTRADA DE HISTORIAL. Es para el camino de
     * VUELTA de ese deshacer: un cambio deshecho no es historia, que es el mismo criterio
     * que usa el deshacer de acá abajo cuando le saca su entrada a la tarjeta.
     */
    conDeshacer = true,
  ) => {
    const otros = new Map(movidos.filter((m) => m.id !== fijado.id).map((m) => [m.id, m.despues]));
    const entry: Hist | null = fijado.texto ? { id: uid(), ts: now(), actor: 'user', text: fijado.texto } : null;

    // ⚠️ ESTE CAMINO NO PASA POR `patchLog`, ASÍ QUE NO HEREDABA EL DESHACER. Y es el único
    // que escribe el score a mano: el slider, el lápiz y el arrastre terminan todos acá.
    // Reportado el 23/09/2026 — «acabo de cambiar la prioridad de una tarea, no recuerdo
    // cuál fue y NO me apareció el botón de deshacer» —, que es el peor caso posible: un
    // cambio de una persona, sin red, sobre el número que ordena el tablero entero.
    //
    // ⚠️ Y DESHACER ACÁ TIENE QUE ESCRIBIR EN EL SERVER. El `undo` de los demás campos es
    // local porque el board persiste solo; éste ya se guardó por `repo.prioridadManual`, así
    // que revertir sólo la pantalla sería mentir hasta el próximo F5. Se vuelve a llamar al
    // mismo camino con el número anterior — y, si la tarjeta NO estaba fijada a mano antes,
    // se le devuelve la decisión al Perro: el candado lo puso este cambio, no la persona.
    const previoT = entidad === 'tarea' ? byId(fijado.id) : null;
    const previoL = entidad === 'proyecto' ? labels.find((l) => l.id === fijado.id) ?? null : null;
    const scorePrevio = previoT?.score ?? previoL?.score ?? null;
    const manualPrevio = !!(previoT?.scoreManual ?? previoL?.scoreManual);
    // ⚠️ LAS VECINAS QUE CORRIÓ UN ARRASTRE TAMBIÉN VUELVEN. Sin esto, deshacer devolvía la
    // tarjeta a su lugar y dejaba a las de abajo un punto más abajo, que es un cambio que nadie
    // pidió y que ya no tiene motivo. Viajan al server para que las devuelva él, y sólo a las
    // que nadie movió en el medio (`OpcionesPrioridadManual.deshacer`).
    const corridas = entidad === 'tarea'
      ? movidos.filter((m) => m.id !== fijado.id && m.antes != null).map((m) => ({ id: m.id, antes: m.antes as number, despues: m.despues }))
      : [];
    if (conDeshacer && scorePrevio != null && (scorePrevio !== clampScore(fijado.score) || corridas.length > 0)) {
      show(`Prioridad ${scorePrevio} → ${clampScore(fijado.score)}`, async () => {
        try {
          await repo.prioridadManual?.(entidad, fijado.id, scorePrevio, corridas.length ? { deshacer: corridas } : undefined);
          if (!manualPrevio) await repo.prioridadAlPerro?.(entidad, fijado.id);
        } catch (e) { console.error('[board] deshacer prioridad', e); }
        if (corridas.length) {
          const vuelta = new Map(corridas.map((c) => [c.id, c]));
          setTasks((ts) => ts.map((x) => {
            const c = vuelta.get(x.id);
            if (!c || x.score !== c.despues) return x;
            return { ...x, score: c.antes, scoreBase: baseCorrida(x.scoreBase, { id: c.id, antes: c.despues, despues: c.antes }), priority: prioFromScore(c.antes) };
          }));
        }
        // La pantalla, después de que el server confirmó: el número vuelve, el candado
        // vuelve a como estaba, y la entrada del historial se va (un cambio deshecho no es
        // historia, mismo criterio que `undoHist`).
        if (entidad === 'tarea') {
          setTasks((ts) => ts.map((x) => (x.id === fijado.id
            ? { ...x, score: scorePrevio, scoreBase: scorePrevio, priority: prioFromScore(scorePrevio), scoreManual: manualPrevio, scoreRazon: previoT?.scoreRazon, historial: x.historial.filter((h) => h.id !== entry?.id) }
            : x)));
        } else {
          setLabels((ls) => ls.map((l) => (l.id === fijado.id
            ? { ...l, score: clampProj(scorePrevio), scoreManual: manualPrevio, scoreRazon: previoL?.scoreRazon, historial: l.historial.filter((h) => h.id !== entry?.id) }
            : l)));
        }
      });
    }

    if (entidad === 'tarea') {
      setTasks((ts) => ts.map((x) => {
        if (x.id === fijado.id) {
          const s = clampScore(fijado.score);
          return { ...x, score: s, scoreBase: s, priority: prioFromScore(s), scoreRazon: fijado.razon || x.scoreRazon, scoreManual: true, historial: entry ? [entry, ...x.historial].slice(0, HIST_CAP) : x.historial };
        }
        const s = otros.get(x.id);
        if (s == null) return x;
        // La BASE se corre igual que el número, como la corre el server: el próximo autosave de
        // esta tarjeta upsertea la fila ENTERA, y con la base vieja en memoria le devolvería el
        // juicio de antes — y el Perro, que re-curva desde la base, la volvería a empatar.
        const n = clampScore(s);
        return { ...x, score: n, scoreBase: baseCorrida(x.scoreBase, { id: x.id, antes: x.score, despues: n }), priority: prioFromScore(n) };
      }));
      return;
    }
    setLabels((ls) => ls.map((l) => {
      if (l.id === fijado.id) return { ...l, score: clampProj(fijado.score), scoreRazon: fijado.razon || l.scoreRazon, scoreManual: true, historial: entry ? [entry, ...l.historial].slice(0, HIST_CAP) : l.historial };
      const s = otros.get(l.id);
      return s == null ? l : { ...l, score: clampProj(s) };
    }));
  };

  /** El inverso: le devolvés la decisión a MaKo y el candado se saca en pantalla también. */
  const soltarCandadoManual = (entidad: 'proyecto' | 'tarea', id: string) => {
    const entry: Hist = { id: uid(), ts: now(), actor: 'user', text: 'Le devolviste la prioridad a MaKo' };
    if (entidad === 'tarea') setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, scoreManual: false, scoreRazon: undefined, historial: [entry, ...x.historial].slice(0, HIST_CAP) } : x)));
    else setLabels((ls) => ls.map((l) => (l.id === id ? { ...l, scoreManual: false, scoreRazon: undefined, historial: [entry, ...l.historial].slice(0, HIST_CAP) } : l)));
  };

  // tope de "En prioridad": cuenta solo las NO completadas (consistente con la vista)
  const toggleEnPrioridad = (id: string): boolean => {
    const t = byId(id); if (!t) return false;
    if (!t.enPrioridad && tasks.filter((x) => x.enPrioridad && x.progress < 100).length >= MAX_PRIORIDAD) return false;
    patchLog(id, 'enPrioridad', !t.enPrioridad, t.enPrioridad ? 'Quitó de prioridad' : 'Puso en prioridad');
    return true;
  };

  // El avance de una tarea CON checklist se deriva del % de ítems completados
  // (marcar/agregar/quitar mueve la barra proporcionalmente).
  const setChecklist = (id: string, next: Check[], text?: string, actor: Actor = 'user') => {
    const t = byId(id); if (!t) return;
    const derived = next.length ? Math.round((next.filter((c) => c.done).length / next.length) * 100) : null;
    const entry = text ? mkEntry(actor, text, 'checklist', t.checklist) : null;
    setTasks((ts) => ts.map((x) => (x.id === id
      ? conAvance(x, { ...x, checklist: next, ...(derived != null ? { progress: derived } : {}), ...(entry ? { historial: [entry, ...x.historial].slice(0, HIST_CAP) } : {}) })
      : x)));
    markDirty(id);
  };
  // reemplaza una tarea entera (para el "deshacer todo" del pase a Alta)
  const replaceTask = (task: BoardTask) => { setTasks((ts) => ts.map((x) => (x.id === task.id ? task : x))); markDirty(task.id); };
  const setTitle = (id: string, title: string, prev: string) => {
    if (title.trim() === prev.trim()) return;
    patchLogExplicit(id, 'title', title, prev, 'Editó el título');
    (byId(id)?.labels ?? []).forEach((lid) => logProject(lid, `Renombró una tarea → «${title.slice(0, 34)}»`));
  };
  const setDetalle = (id: string, detalle: string, prev: string) => { if (detalle !== prev) patchLogExplicit(id, 'detalle', detalle, prev, 'Editó el detalle'); };
  const setProgress = (id: string, value: number, prev: number) => { const w = clampPct(value); if (w !== prev) patchLogExplicit(id, 'progress', w, prev, `Avance ${w}%`); };
  // Marcar "Completada" (0 → 100) o reabrir (→ 0). Si la tarea TIENE checklist, marca
  // TODOS sus ítems (el avance deriva). Salta el undo-toast de 5s (feedback #7/#33).
  const toggleDone = (id: string) => {
    const t = byId(id); if (!t) return;
    const snap = t;
    const done = t.progress >= 100;
    if (t.checklist.length > 0) {
      setChecklist(id, t.checklist.map((c) => ({ ...c, done: !done })), done ? 'Reabrió la tarea' : 'Marcó como completada');
    } else {
      patchLogExplicit(id, 'progress', done ? 0 : 100, t.progress, done ? 'Reabrió la tarea' : 'Marcó como completada');
    }
    // El toast lo dispara `patchLogExplicit`/`setChecklist` por el choke point. Acá había
    // un `show` propio y desde que el arrepentimiento es general salían DOS.
  };
  /**
   * La fecha de vencimiento. Y, si la tarea no tenía Quarter, el Quarter que le corresponde.
   *
   * ⚠️ SÓLO CUANDO ESTÁ VACÍO. Si alguien ya eligió un Quarter, esto NO lo pisa: son dos
   * preguntas distintas —cuándo vence y para cuándo se planificó— y hay casos legítimos en
   * que no coinciden (una entrega de Q3 que se planificó para Q2). Lo que la pantalla hace
   * en ese caso es AVISAR, no corregir: «si intento cambiar el quarter o la fecha a otro
   * fuera de la relación del otro, y no coincide, que me dé un aviso» (23/09/2026).
   */
  const setDeadline = (id: string, deadline: string, prev: string) => {
    if (deadline === prev) return;
    // ⚠️ UNA RECURRENTE NO LLEVA FECHA (mig 0163), Y EL CORTE VA TAMBIÉN ACÁ. El choke point
    // de verdad es `taskToRow` (lib/plan-board.ts), que es por donde pasan TODAS las
    // escrituras — pero sin este guard el estado optimista pintaría la fecha, el server la
    // borraría al guardar, y al recargar habría desaparecido: un éxito falso, que es peor
    // que un control deshabilitado. La pantalla además no dibuja el control (`Tablas.tsx`
    // pone un «—» con el porqué en el `title`); esto es la red por si aparece otro camino.
    const actual = byId(id);
    if (actual && !llevaDeadline(actual)) return;
    patchLogExplicit(id, 'deadline', deadline, prev, deadline ? `Deadline ${deadline}` : 'Quitó el deadline');
    const t = byId(id);
    const q = quarterDeFecha(deadline);
    if (q && t && !t.quarter) patchLogExplicit(id, 'quarter', q, undefined, `Quedó en el ${q.replace('-', ' ')} por su fecha`, 'ia');
  };
  /**
   * El Quarter planificado (`2026-Q3`), o vacío para sacarlo.
   *
   * Va por `patchLogExplicit` como el deadline —y no por un patch pelado— porque eso
   * es lo que guarda el valor ANTERIOR en el historial, que es de donde sale el
   * deshacer. Un campo que se escribe sin `prev` no se puede revertir, y en un
   * tablero donde la IA también escribe eso no es un lujo.
   */
  const setQuarter = (id: string, quarter: string, prev: string) => {
    if (quarter === prev) return;
    // El Quarter dice «para cuándo se planificó HACERLO». En algo que se repite para
    // siempre eso no tiene respuesta, y el server lo escribe `null` igual (`taskToRow`).
    const actual = byId(id);
    if (actual && !llevaDeadline(actual)) return;
    patchLogExplicit(id, 'quarter', quarter || undefined, prev, quarter ? `La planificó para el ${quarter.replace('-', ' ')}` : 'Le sacó el Quarter');
  };
  /**
   * «SE REPITE PARA SIEMPRE»: marcarla y desmarcarla (mig 0163).
   *
   * ⚠️ VA POR `patchLogExplicit` Y NO POR UN `patch` PELADO, que es lo que la vuelve
   * reversible. Por ese choke point pasan las tres cosas que la casa exige de TODO cambio:
   * la entrada en el change history con el valor anterior, el toast de arrepentimiento de 5
   * segundos, y el guardado. Escrito con `patch(id, { recurrente })` se guardaría igual y
   * sería el único campo del tablero sin red — justo el que hace desaparecer una tarjeta
   * del ranking.
   *
   * ⚠️ Y AL MARCARLA SE LE VA LA FECHA, en su propia entrada. No es un efecto colateral
   * escondido: `taskToRow` la borra igual del lado del server, así que si acá no se
   * escribiera, la pantalla seguiría mostrando un deadline que en la base ya no existe
   * hasta el próximo F5. Con dos entradas separadas, deshacer «se repite» y deshacer «le
   * saqué la fecha» son dos botones distintos y ninguno de los dos miente. La segunda va
   * como `'ia'` a propósito: la decisión de la persona fue UNA, y dos toasts encima del
   * mismo click son dos oportunidades de deshacer la mitad equivocada.
   */
  const setRecurrente = (id: string, v: boolean) => {
    const t = byId(id);
    if (!t || esRecurrente(t) === v) return;
    // ⚠️ TRES PALABRAS, NO UNA EXPLICACIÓN. El texto de un cambio sale en el toast del
    // deshacer, que es una barra de 5 segundos encima de la pantalla: ahí sólo entra QUÉ
    // pasó. El PORQUÉ ya vive en `PORQUE_NO_COMPITE` y en los comentarios del código, que
    // es donde se busca. Acá llegó a ser «Se repite para siempre: sale del ranking de
    // proyectos · Lo que se repite no vence: una fecha ahí es la del próximo ciclo, no un
    // deadline» — dos renglones tapando el modal que la persona estaba mirando.
    patchLogExplicit(id, 'recurrente', v, t.recurrente ?? false, v ? 'Se repite' : 'Ya no se repite');
    /**
     * ⚠️ MARCAR UNA TAREA ARRASTRA A SU PROYECTO, Y SOLO EN ESE SENTIDO. «Si una tarea se
     * vuelve recurrente, su proyecto automáticamente debe convertirse también… pero no al
     * revés, ya que un proyecto recurrente SÍ puede tener tareas con deadline»
     * (26/09/2026).
     *
     * La asimetría no es un capricho y es lo que hace que la regla cierre: un proyecto que
     * contiene algo que no termina tampoco termina —la junta semanal vive adentro de
     * «Customer Success», y ese proyecto no se cierra nunca—, así que dejarlo compitiendo
     * en el ranking es el mismo problema un nivel más arriba. Al revés no vale: «armar el
     * documento de onboarding de Vertice» cuelga de un proyecto recurrente, tiene un
     * entregable y se cierra una sola vez, y sacarla del ranking la volvería invisible
     * justo cuando hay que hacerla.
     *
     * ⚠️ Y NO CASCADEA AL DESMARCAR. Que esta tarea deje de repetirse no dice nada de las
     * otras que cuelgan del mismo proyecto, ni de si alguien lo marcó a mano por otro
     * motivo. Apagar por inferencia es lo que borra una decisión que nadie tomó.
     */
    if (v) {
      for (const lid of t.labels) {
        const l = labels.find((x) => x.id === lid);
        if (l && !esRecurrente(l)) setLabelRecurrente(lid, true);
      }
    }
    if (!v) {
      // ⚠️ AL DEJAR DE REPETIRSE SE VA LA RECURRENCIA, y es la contracara exacta de las dos
      // líneas de abajo (mig 0167). El server la borra igual —`taskToRow` pasa por
      // `recurrenciaDe`—, así que sin esto la pantalla seguiría mostrando «Cada semana»
      // sobre una tarea que ya vence, hasta el próximo F5: el éxito falso de siempre.
      if (t.recurrencia) patchLogExplicit(id, 'recurrencia', null, t.recurrencia, 'Sin repetición', 'ia');
      return;
    }
    if (t.deadline) patchLogExplicit(id, 'deadline', '', t.deadline, 'Sin deadline', 'ia');
    if (t.quarter) patchLogExplicit(id, 'quarter', undefined, t.quarter, 'Sin quarter', 'ia');
  };
  /**
   * CÓMO SE REPITE (mig 0167): la RRULE que reemplaza a «Cuándo» en una recurrente.
   *
   * ⚠️ VA POR `patchLogExplicit`, como el deadline y como `setRecurrente`: de ese choke
   * point salen la entrada del change history con el valor anterior, el toast de deshacer
   * de 5 segundos y el guardado. Un `patch` pelado guardaría igual y sería el único campo
   * del tablero sin red.
   *
   * ⚠️ SANEA ACÁ TAMBIÉN, aunque el desplegable sólo ofrezca `PRESETS` y el diálogo
   * personalizado arme la suya con `escribirRRule`: esta función es pública en el `Board` y
   * la puede llamar cualquier pantalla futura. Lo que no sea una RRULE que este producto
   * sepa leer entra como `null` —«se repite y no se dijo cada cuánto»—, nunca como texto
   * libre. Y `recurrenciaOk` además CANONIZA (orden de las partes, `INTERVAL=1` implícito),
   * que es lo que hace que el `next === prev` de abajo no vea cambios donde no los hay.
   *
   * ⚠️ Y NO SE LE PONE UNA REPETICIÓN A ALGO QUE NO SE REPITE. La invariante vive en
   * `recurrenciaDe` (el mapper la aplica en toda escritura); acá está la red de la pantalla,
   * por lo mismo que `setDeadline` tiene la suya: sin ella el estado optimista pintaría un
   * valor que el server descarta al guardar.
   *
   * El texto del cambio sale de `textoRepeticionCorto` y no de `textoRepeticion`: el toast
   * tiene 3-4 palabras escritas como regla de la casa y «Cada 2 semanas, los lunes y
   * miércoles» son siete. Las dos comparten la misma traducción.
   */
  const setRecurrencia = (id: string, rrule: string | null) => {
    const t = byId(id);
    if (!t || !esRecurrente(t)) return;
    const next = recurrenciaOk(rrule);
    const prev = recurrenciaOk(t.recurrencia);
    if (next === prev) return;
    patchLogExplicit(id, 'recurrencia', next, prev, textoRepeticionCorto(next) ?? 'Sin repetición');
  };
  const setTaskLabels = (id: string, next: string[], text: string) => patchLogExplicit(id, 'labels', next, byId(id)?.labels ?? [], text);

  // deshacer una entrada del historial: revierte el campo Y borra la entrada
  // (mismo criterio que Lead Details: "un cambio deshecho no es historia").
  const undoHist = (id: string, entry: Hist) => {
    if (!entry.undo) return;
    const field = entry.undo.field, prev = entry.undo.prev;
    setTasks((ts) => ts.map((x) => {
      if (x.id !== id) return x;
      const next = { ...x, historial: x.historial.filter((h) => h.id !== entry.id) } as BoardTask;
      // ⚠️ `__task__` ES UN SNAPSHOT DE VARIOS CAMPOS, no un campo que se llame así. Lo usa
      // todo cambio que es UNA decisión escrita en más de una columna — hoy el cliente
      // (`clienteLeadId` + `clienteNombre`, mig 0172). Es la gemela exacta de `__label__`
      // en `patchLabelLog`, y existe por la misma razón: con dos entradas separadas, el
      // historial diría dos veces lo mismo y deshacer una sola dejaría la tarjeta con el
      // id de un cliente y el nombre de otro.
      if (field === '__task__' && prev && typeof prev === 'object') Object.assign(next, prev as Partial<BoardTask>);
      else (next as unknown as Record<string, unknown>)[field] = prev;
      if (field === 'score') next.priority = prioFromScore(clampScore(Number(prev))); // la banda deriva del score
      // Deshacer un avance también devuelve la columna (el server hace lo mismo al guardarlo).
      return conAvance(x, next);
    }));
    markDirty(id);
  };

  // ── etiquetas / PROYECTOS (con su propio change history) ──
  // DEVUELVE la canónica (la del server), no void. El id que pone la UI es temporal
  // (`uid()`, alfanumérico) y el del server es NUMÉRICO: quien creaba un proyecto y le
  // colgaba tareas usando el temporal las mandaba con un id que `Number()` convierte en
  // NaN, se filtraba, y la tarea nacía SIN PROYECTO. Es la causa exacta de las tareas
  // huérfanas del tablero. Quien crea un proyecto para usarlo tiene que esperar esto.
  const createLabel = async (draft: Label): Promise<Label> => {
    const d: Label = { ...draft, historial: draft.historial?.length ? draft.historial : [{ id: uid(), ts: now(), actor: draft.score >= 1 ? 'user' : 'user', text: 'Creó el proyecto' }] };
    setLabels((ls) => [...ls, d]);
    try { const canon = await repo.createLabel(d); setLabels((ls) => ls.map((l) => (l.id === d.id ? canon : l))); return canon; }
    catch (e) { console.error('[board] createLabel', e); return d; }
  };
  const patchLabel = (id: string, fields: Partial<Label>) => {
    setLabels((ls) => ls.map((l) => (l.id === id ? { ...l, ...fields } : l)));
    markDirtyLabel(id);
  };
  // patch de proyecto + entrada en SU change history (rename, detalle, score…).
  // Guarda el `undo` (snapshot de los campos que cambian) SOLO para cambios del usuario.
  const patchLabelLog = (id: string, fields: Partial<Label>, text: string, actor: Actor = 'user') => {
    let entradaUsuario: Hist | null = null;
    setLabels((ls) => ls.map((l) => {
      if (l.id !== id) return l;
      const prev: Record<string, unknown> = {};
      for (const k of Object.keys(fields)) prev[k] = (l as unknown as Record<string, unknown>)[k];
      const entry: Hist = { id: uid(), ts: now(), actor, text, ...(actor === 'user' ? { undo: { field: '__label__', prev } } : {}) };
      entradaUsuario = actor === 'user' ? entry : null;
      return { ...l, ...fields, historial: [entry, ...l.historial].slice(0, HIST_CAP) };
    }));
    markDirtyLabel(id);
    // Mismo arrepentimiento que en una tarea, y por el mismo motivo: acá pasan el rename,
    // el emoji, el color, el detalle, la fecha y las notas de un proyecto.
    if (actor === 'user') { const e = entradaUsuario; if (e) show(text, () => undoLabelHist(id, e)); }
  };
  // deshacer una entrada del change history de un proyecto (solo cambios del usuario)
  const undoLabelHist = (labelId: string, entry: Hist) => {
    if (!entry.undo) return;
    const prev = entry.undo.prev as Partial<Label>;
    setLabels((ls) => ls.map((l) => (l.id === labelId ? { ...l, ...prev, historial: l.historial.filter((h) => h.id !== entry.id) } : l)));
    markDirtyLabel(labelId);
  };
  // registra un evento en el change history de un proyecto (tarea creada/borrada/renombrada).
  // kind:'task' → queda en el detalle del proyecto pero NO en el change history de la tab.
  const logProject = (labelId: string, text: string, actor: Actor = 'user') => {
    setLabels((ls) => ls.map((l) => (l.id === labelId ? { ...l, historial: [{ id: uid(), ts: now(), actor, text, kind: 'task' as const }, ...l.historial].slice(0, HIST_CAP) } : l)));
    markDirtyLabel(labelId);
  };
  const deleteLabel = (id: string) => {
    setLabels((ls) => ls.filter((l) => l.id !== id));
    setTasks((ts) => ts.map((t) => (t.labels.includes(id) ? { ...t, labels: t.labels.filter((x) => x !== id) } : t)));
    void repo.deleteLabel(id).catch((e) => console.error('[board] deleteLabel', e));
  };
  // borra un proyecto Y todas sus tareas (fricción alta: se debate antes).
  const deleteLabelYTareas = (id: string) => {
    const suyas = tasks.filter((t) => t.labels.includes(id));
    suyas.forEach((t) => { void repo.deleteTask(t.id).catch((e) => console.error('[board] deleteTask', e)); });
    setTasks((ts) => ts.filter((t) => !t.labels.includes(id)));
    setLabels((ls) => ls.filter((l) => l.id !== id));
    void repo.deleteLabel(id).catch((e) => console.error('[board] deleteLabel', e));
  };

  const reset = (t: BoardTask[], l: Label[]) => { setTasks(t); setLabels(l); };

  // ── Dependencias ──
  // El estado local se actualiza con lo que devuelve el SERVER, no con lo que el cliente
  // creía: el guard de ciclo corre allá (es la única puerta que comparten el modal,
  // /api/agente/plan, WhatsApp y los scripts), así que la lista buena es siempre la suya.
  const addDep = async (d: { entidad: EntidadDep; deId: string; aId: string; clase?: ClaseDep; razon?: string }): Promise<{ ok: boolean; error?: string; camino?: string[] }> => {
    // Chequeo local ANTES de pegarle al server: es el que le permite a la pantalla
    // deshabilitar la opción con el motivo al lado en vez de dejar clickear y fallar.
    const ver = puedeDepender(deps, d.entidad, d.deId, d.aId);
    if (!ver.ok) return { ok: false, error: 'Sería un círculo: eso ya espera a esto.', camino: ver.camino };
    const r = await repo.addDep?.(d);
    if (r?.ok && r.deps) setDeps(r.deps);
    return r ?? { ok: false, error: 'Este tablero no guarda dependencias.' };
  };
  const delDep = async (entidad: EntidadDep, deId: string, aId: string) => {
    const r = await repo.delDep?.(entidad, deId, aId);
    if (r?.ok && r.deps) setDeps(r.deps);
  };

  /**
   * EL DEADLINE DE UN PROYECTO, Y SU QUARTER. Igual que en una tarea, y por el mismo
   * motivo: «si ya tiene deadline con fecha, que se ponga automáticamente el Quarter»
   * (23 y 24/09/2026). Existe como función y no como dos `patchLabelLog` en cada
   * pantalla porque hay DOS lugares que ponen la fecha de un proyecto —la tabla y el
   * detalle— y el tercero que aparezca la hereda sin que nadie se acuerde.
   *
   * ⚠️ SÓLO SI ESTÁ VACÍO: un Quarter elegido a mano no se pisa.
   */
  const setLabelDeadline = (id: string, deadline: string) => {
    const l = labels.find((x) => x.id === id);
    if (!l || (l.deadline ?? '') === deadline) return;
    // Mismo guard que `setDeadline` en una tarea, un nivel más arriba (mig 0164): el choke
    // point de verdad es `labelToRow`, y sin esto la pantalla pintaría una fecha que el
    // server borra al guardar — un éxito falso, que es peor que un control apagado.
    if (!llevaDeadline(l)) return;
    const q = quarterDeFecha(deadline);
    const ponerQ = !!q && !l.quarter;
    patchLabelLog(id, ponerQ ? { deadline, quarter: q } : { deadline }, deadline ? `Deadline ${deadline}` : 'Quitó el deadline');
  };
  const setLabelQuarter = (id: string, quarter: string) => {
    const l = labels.find((x) => x.id === id);
    if (!l || (l.quarter ?? '') === quarter) return;
    if (!llevaDeadline(l)) return;
    patchLabelLog(id, { quarter: quarter || undefined }, quarter ? `Lo planificó para el ${quarter.replace('-', ' ')}` : 'Le sacó el Quarter');
  };
  /**
   * «SE REPITE PARA SIEMPRE», A NIVEL PROYECTO (mig 0164). La gemela de `setRecurrente`.
   *
   * ⚠️ VA POR `patchLabelLog`, que es el choke point de todo cambio de un proyecto: de ahí
   * salen la entrada en el change history con el valor anterior, el toast de deshacer de 5
   * segundos y el `repo.saveLabel`. Escrito con `patchLabel` pelado se guardaría igual y
   * sería el único campo de un proyecto sin red — justo el que lo saca del ranking entero.
   *
   * ⚠️ Y AL MARCARLO SE LE VAN LA FECHA Y EL TRIMESTRE, EN LA MISMA ESCRITURA. Acá va UNA
   * sola llamada y no tres como en una tarea, y la diferencia es del choke point, no del
   * criterio: `patchLabelLog` guarda en `prev` TODOS los campos que cambian, así que un solo
   * deshacer los devuelve los tres juntos. Con tres llamadas habría tres entradas y tres
   * toasts encima del mismo click, y el que queda arriba deshace la mitad equivocada.
   * `labelToRow` los borra igual del lado del server; si acá no se escribieran, la pantalla
   * seguiría mostrando un deadline que en la base ya no existe hasta el próximo F5.
   */
  const setLabelRecurrente = (id: string, v: boolean) => {
    const l = labels.find((x) => x.id === id);
    if (!l || esRecurrente(l) === v) return;
    // Ver el porqué del largo en `setRecurrente`, acá arriba.
    const texto = v ? 'Se repite' : 'Ya no se repite';
    // Al dejar de repetirse se va la recurrencia (mig 0167), en la MISMA escritura que el
    // flag: `patchLabelLog` guarda en `prev` todos los campos que cambian, así que un solo
    // deshacer devuelve las dos cosas. Del lado del server lo hace `labelToRow`.
    if (!v) { patchLabelLog(id, { recurrente: false, recurrencia: null }, texto); return; }
    patchLabelLog(id, { recurrente: true, deadline: '', quarter: undefined }, texto);
  };
  /** Cómo se repite un PROYECTO (mig 0167). Gemela de `setRecurrencia`, con el mismo saneo
   *  y la misma invariante; el choke point acá es `patchLabelLog`. */
  const setLabelRecurrencia = (id: string, rrule: string | null) => {
    const l = labels.find((x) => x.id === id);
    if (!l || !esRecurrente(l)) return;
    const next = recurrenciaOk(rrule);
    if (next === recurrenciaOk(l.recurrencia)) return;
    patchLabelLog(id, { recurrencia: next }, textoRepeticionCorto(next) ?? 'Sin repetición');
  };

  /**
   * DE QUIÉN es una TAREA (mig 0172). `null` la desasigna.
   *
   * ⚠️ VA POR `patchLogFields` Y NO POR DOS `patchLogExplicit`. El id y el nombre son UNA
   * decisión escrita en dos columnas: con dos entradas, el historial diría dos veces lo
   * mismo y deshacer una sola dejaría la tarjeta con el id de un cliente y el nombre de
   * otro — o sea un chip que miente sin que nada falle.
   *
   * ⚠️ Y SE COMPARA POR ID. Dos clientes se pueden llamar igual; el nombre acá es una
   * etiqueta para pintar y nada más (ver `lib/plan-clientes.ts`).
   */
  const setCliente = (id: string, c: { leadId: number; nombre: string } | null) => {
    const t = byId(id); if (!t) return;
    if ((clienteDe(t)?.leadId ?? null) === (c?.leadId ?? null)) return;
    patchLogFields(id, { clienteLeadId: c?.leadId ?? null, clienteNombre: c?.nombre ?? null },
      c ? `Cliente: ${c.nombre}` : SIN_CLIENTE);
  };

  /**
   * DE QUIÉN es un PROYECTO (mig 0172). El choke point acá es `patchLabelLog`, que ya sabe
   * guardar el `prev` de varios campos juntos.
   *
   * ⚠️ NO ARRASTRA A SUS TAREAS, Y ES LA DECISIÓN. Un proyecto del cliente X ata a X TODAS
   * sus tareas a través del cruce (`app/customer-success/cruce.ts` las ata por proyecto),
   * así que copiar el id en las 53 filas no agregaría un solo dato: agregaría 53 escrituras
   * por un click y, peor, desasignar el proyecto dejaría las 53 marcadas. Es el mismo
   * criterio que `setLabelRecurrente`, y por el mismo motivo.
   */
  const setLabelCliente = (id: string, c: { leadId: number; nombre: string } | null) => {
    const l = labels.find((x) => x.id === id); if (!l) return;
    if ((clienteDe(l)?.leadId ?? null) === (c?.leadId ?? null)) return;
    patchLabelLog(id, { clienteLeadId: c?.leadId ?? null, clienteNombre: c?.nombre ?? null },
      c ? `Cliente: ${c.nombre}` : SIN_CLIENTE);
  };

  return {
    tasks, labels, user, repo, deps, addDep, delDep,
    labelById: (id: string) => labels.find((l) => l.id === id) ?? null,
    create, remove, removeSilent, patch, moveTo, setScore, applyGuardian, aplicarPerroServer, aplicarCascadaManual, soltarCandadoManual, toggleEnPrioridad, setChecklist, replaceTask,
    // ⚠️ `mover` Y `setMotivoAtorada` (16/10/2026): el kanban por estado. Misma advertencia que
    // las de abajo — si no están en este `return`, el arrastre no tiene con qué escribir.
    mover, setMotivoAtorada,
    // ⚠️ `setRecurrente` Y `setLabelRecurrente` VAN EN ESTE `return` O NO EXISTEN. Es el
    // modo de falla que este repo ya pagó dos veces el 25/09/2026: la capacidad queda
    // escrita, el typecheck pasa, los tests pasan, y en pantalla no hay nada que tocar
    // porque el board nunca lo recibió.
    // ⚠️ Y LO MISMO VALE PARA `setRecurrencia` / `setLabelRecurrencia` (mig 0167): una
    // acción que no está en este objeto no existe para ninguna pantalla, con el typecheck
    // en verde.
    // ⚠️ Y LO MISMO PARA `setCliente` / `setLabelCliente` (mig 0172). Tercera vez que se
    // escribe esta advertencia en el mismo objeto: si no está acá, el modal importa un
    // `board` que no tiene la función, `board.setCliente` es `undefined`, y el click no
    // hace nada. El typecheck no lo caza porque el board se tipa por inferencia de ESTE
    // objeto — o sea que el error se manifiesta en la pantalla y en ningún otro lado.
    setTitle, setDetalle, setProgress, toggleDone, setDeadline, setQuarter, setRecurrente, setRecurrencia, setTaskLabels, setCliente, undoHist,
    createLabel, patchLabel, patchLabelLog, setLabelDeadline, setLabelQuarter, setLabelRecurrente, setLabelRecurrencia, setLabelCliente, undoLabelHist, deleteLabel, deleteLabelYTareas, reset,
    undo, showUndo: show, clearUndo: clear,
  };
}

export type Board = ReturnType<typeof useBoard>;
