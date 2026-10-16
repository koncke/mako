'use client';

// =============================================================================
// TodoBoard — adapter del board /todo para el CLIENTE (DB, vía /api/todo)
// =============================================================================
// Misma UI que el super-admin (board/BoardShell). Acá solo el mapeo
// Tarea↔BoardTask / Categoria↔Label y el Repo que persiste contra la API.
// En demo (local sin Supabase) el Repo muta en memoria.

import { useEffect, useRef, type ReactNode } from 'react';
import { BoardShell } from './board/BoardShell';
import { hacerLugar, type Corrimiento } from './board/lugar-al-soltar';
import { esRecurrente } from '@/lib/plan-recurrentes';
import { useBoard } from './board/useBoard';
import { type BoardTask, type Label, type Repo, type BoardUser, type GuardPatch, type Prio, prioFromScore } from './board/types';
// Los dos mappers de ENTRADA viven en un `.ts` para que también los pueda importar el
// SERVER (/productivity-analyst). Ver el encabezado de ese archivo.
import { toBoard, toLabel } from './board/desde-todo';
import type { Tarea, Categoria } from '@/lib/todo';
import { CATALOGO_TODO } from '@/lib/todo-proyectos-catalogo';
import type { ClienteRef } from '@/lib/plan-clientes';
import { avanceSiCambio } from '@/lib/todo-estados';


async function api(body: Record<string, unknown>): Promise<{ ok: boolean; tarea?: Tarea; categoria?: Categoria; patches?: GuardPatch[]; error?: string }> {
  return fetch('/api/todo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
}

// patch completo de una tarea → payload de editar
//
// ⚠️ EL AVANCE VIAJA SÓLO SI CAMBIÓ (16/10/2026, decisión 10). `progresoGuardado` es el último
// avance que la base confirmó para esta tarjeta; si es el mismo, `progreso` no va. Mandarlo
// siempre era el retroceso del kanban: `editarTarea` recalculaba la columna desde el avance en
// cada guardado, y corregirle el título a una tarjeta arrastrada a «En proceso» al 0% la
// devolvía a «Por iniciar». El server ahora también lo compara contra la fila
// (`estadoAlGuardar`) — esto es la primera capa, y la que evita la lectura extra.
// `undefined` (no se sabe qué hay guardado) manda el avance: el server decide.
//
// ⚠️ Y EL ESTADO NO VA, NUNCA: lo escribe `mover`. Este objeto es lo que viaja en cada
// guardado; con el estado adentro, una pestaña vieja devolvería de columna lo que se movió
// desde otra.
const editPatch = (d: BoardTask, progresoGuardado?: number) => ({
  titulo: d.title, detalle: d.detalle || null, prioridad: d.priority, ...avanceSiCambio(d.progress, progresoGuardado),
  // Los ids de proyecto del cliente son NUMÉRICOS. Si llega uno que no lo es, es el id
  // TEMPORAL de un proyecto recién creado que alguien no esperó — antes se descartaba en
  // silencio y la tarea nacía huérfana. Se sigue filtrando (mandarlo rompería el insert)
  // pero ahora deja rastro en consola en vez de desaparecer sin explicación.
  // ⚠️ `recurrencia` VA ACÁ AUNQUE NINGÚN OTRO CAMPO DEL PATCH LO NECESITE (mig 0167):
  // este objeto es lo ÚNICO que viaja en un `editar`, así que un campo que falte no es un
  // campo que no cambia — es un campo que se queda en el valor que tenía la fila. El
  // `?? null` manda «no se dijo cada cuánto» como `null`, que es un estado real y que el
  // server distingue de `undefined` («no lo toques»).
  deadline: d.deadline || null, quarter: d.quarter || null, recurrente: !!d.recurrente, recurrencia: d.recurrencia ?? null, categorias: catsNum(d.labels, d.title),
  checklist: d.checklist, historial: d.historial, en_prioridad: d.enPrioridad, score: d.score, score_razon: d.scoreRazon ?? null, fuente: d.fuente ?? null,
  // DE QUIÉN es (mig 0172). Este objeto es lo ÚNICO que viaja en un `editar`, así que un
  // campo que falte no es «no cambia»: la columna se queda como estaba. El `?? null`
  // manda «no es de nadie» explícito, que es lo que hace falta para poder DESasignar.
  cliente_lead_id: d.clienteLeadId ?? null, cliente_nombre: d.clienteNombre ?? null,
  // Los cinco de #157. Mismo motivo que los dos de arriba: este objeto es lo ÚNICO que
  // viaja en un `editar`, así que un campo que falta no es «no cambia» — es un campo
  // que nunca se guarda. El `?? null` es lo que permite BORRARLOS.
  notas: d.notas ?? '', deadline_razon: d.deadlineRazon ?? null, hacelo_en: d.haceloEn ?? null,
  impacto: d.impacto ?? null, esfuerzo: d.esfuerzo ?? null,
});

const catsNum = (labels: string[], titulo: string): number[] => {
  const ok = labels.map(Number).filter(Number.isFinite);
  if (ok.length !== labels.length) console.warn(`[todo] "${titulo}": ${labels.length - ok.length} proyecto(s) con id no numérico — se descartan (¿id temporal sin esperar al server?)`, labels);
  return ok;
};

export function TodoBoard({ tareas, categorias, demo, user, wsId, vistaInicial, clientes = [], clienteFijo, embebido = false, vistaExtra, onRecargar, soloVista, clienteInicial, accionEnLugarDelMenu }: { tareas: Tarea[]; categorias: Categoria[]; demo: boolean; user: BoardUser; wsId?: number | null; vistaInicial?: string;
  /** Sólo esa vista y sin el selector de vistas. Ver `soloVista` en `BoardShell`. */
  soloVista?: 'prioridades';
  /** Va en el lugar del «⋮» con `soloVista`. Ver `accionEnLugarDelMenu` en `BoardShell`. */
  accionEnLugarDelMenu?: ReactNode;
  /** El cliente del filtro, leído en el server desde `?cliente=`. Ver `clienteInicial` en `BoardShell`. */
  clienteInicial?: number | null;
  /**
   * ⚠️ ESTE TABLERO VIVE ADENTRO DE OTRA PANTALLA (hoy, la ficha de un cliente). Apaga el
   * uso de la URL como estado: ver `embebido` en `BoardShell`. Es una prop y no se deduce
   * de `clienteFijo` a propósito — «es de este cliente» y «no soy la ruta» son dos hechos
   * distintos, y el día que uno valga sin el otro, deducirlo miente.
   */
  embebido?: boolean;
  /** Una vista más al final del selector del board. Ver `vistaExtra` en `BoardShell`. */
  vistaExtra?: { id: string; label: string; contenido: React.ReactNode };
  /** Cómo recargar después de una escritura grande del server. Ver `onRecargar` en
   *  `BoardShell`: embebido, un `reload()` cierra la pantalla que lo contiene. */
  onRecargar?: () => void;
  /**
   * ⚠️ EL TABLERO ESTÁ FILTRADO A UN CLIENTE, así que lo que se cree adentro nace SUYO.
   * Sin esto, una tarea creada desde la página de un cliente aparecería… y desaparecería
   * al recargar, porque la página sólo lee lo que tiene ese cliente escrito. Un alta que
   * se borra sola al refrescar es peor que un botón deshabilitado.
   */
  clienteFijo?: { leadId: number; nombre: string };

  /** Los leads ganados del workspace, leídos en el server (mig 0172). */
  clientes?: ClienteRef[] }) {
  // Las tareas como las ve la pantalla AHORA, para que `prioridadManual` sepa a quién correr
  // al soltar en el Kanban. Acá no hay server que relea el tablero (este tablero persiste
  // desde el navegador), así que la foto es el estado del board — no las `tareas` con las
  // que se montó, que envejecen con el primer cambio.
  const tareasVivas = useRef<BoardTask[]>([]);
  // EL ÚLTIMO AVANCE QUE CONFIRMÓ LA BASE, por tarea (16/10/2026). Es lo que le dice a
  // `editPatch` si el avance cambió: si no, no viaja, y la columna no se recalcula. Se siembra
  // con lo que se leyó al montar y se actualiza con cada respuesta del server (alta, editar,
  // mover). No es estado de React a propósito: no dibuja nada.
  const progresoGuardado = useRef<Map<string, number> | null>(null);
  if (progresoGuardado.current === null) progresoGuardado.current = new Map(tareas.map((t) => [String(t.id), t.progreso]));
  const confirmar = (t: Tarea | undefined) => { if (t) progresoGuardado.current!.set(String(t.id), t.progreso); };
  const repo: Repo = {
    // MISMA config que el board del super-admin (PlanBoard): la única diferencia real
    // es la persistencia (DB vs localStorage). Proyectos 1-a-1, mismo naming.
    labelMode: 'single', labelSingular: 'Proyecto', labelPlural: 'Proyectos',
    fathomExtract: true, // extraer tareas de una reunión (usa la Fathom key del propio workspace)
    // Las ÁREAS del negocio (lib/todo-proyectos-catalogo). Igual que en el tablero del
    // dueño, la extracción de una reunión solo puede proponer proyectos de acá o los
    // que ya existen — el proyecto de un CLIENTE lo resuelve aparte el server, contra
    // el CRM. Sin esto, cada reunión abría un proyecto con el nombre de su tema.
    catalogo: CATALOGO_TODO.map((c) => ({ nombre: c.nombre, emoji: c.emoji, que: c.que })),
    createTask: async (d) => {
      if (demo) return d;
      // origen preservado (al restaurar un borrado de una tarea de MaKo mantiene el ✦).
      // Todo lo que no escribió el usuario cae a 'mako': la base solo distingue
      // manual/mako/retro/experimento, y 'manual' diría que la creó el cliente.
      // `fuente` va en el ALTA (no en el editar de abajo): así la tarjeta nace con su
      // chip de origen y su link al minuto de la grabación. Antes se perdía entera —
      // la ruta ni siquiera aceptaba el campo — y las tareas de una reunión quedaban
      // indistinguibles de una escrita a mano.
      // `recurrente` va en el ALTA: el server ya lo acepta, y sin esto la capacidad queda
      // abierta y sin un solo call site — la tarea nace compitiendo y sólo se arregla si
      // alguien la vuelve a editar.
      // El cliente va en el ALTA: `responsableDe` de /api/todo ya lo acepta (mig 0159), y
      // el `editar` de abajo sólo corre si la tarjeta trae contenido — un alta pelada se lo
      // saltearía y la tarea nacería sin dueño en la pantalla de su propio cliente.
      // LA COLUMNA, EL LUGAR Y EL SCORE VAN EN EL ALTA (16/10/2026). El «＋» de una columna crea
      // la tarea con ese estado; restaurar un borrado la devuelve con su estado, su motivo y su
      // lugar; y `score: 0` es «Sin priorizar» — sin él, el server sacaría el número de
      // `prioridad` y la tarea libre nacería «Media».
      const j = await api({ action: 'crear', tarea: { titulo: d.title, prioridad: d.priority, score: d.score, estado: d.estado, motivo_atorada: d.motivoAtorada ?? null, orden: d.orden, origen: d.origen === 'user' ? 'manual' : 'mako', fuente: d.fuente ?? null, recurrente: !!d.recurrente, recurrencia: d.recurrencia ?? null, cliente_lead_id: clienteFijo?.leadId ?? null, cliente_nombre: clienteFijo?.nombre ?? null } });
      if (!j.ok || !j.tarea) throw new Error(j.error || 'no se pudo crear');
      let t = j.tarea;
      confirmar(t);
      // si la tarjeta ya traía contenido (p.ej. restaurar un borrado), aplicá el resto
      //
      // ⚠️ Y EL CLIENTE VIAJA EN ESE PATCH, o el `editar` BORRA lo que el alta de arriba
      // acaba de escribir: `editPatch` manda `cliente_lead_id: d.clienteLeadId ?? null` y
      // `d` es el borrador LOCAL, que no conoce `clienteFijo`. El `?? null` está bien y no
      // se toca (es lo que permite desasignar); lo que faltaba es que el borrador llegue
      // acá con el cliente puesto. Medido el 27/09/2026.
      if (d.detalle || d.checklist.length || d.deadline || d.labels.length || d.enPrioridad || d.progress) {
        const conCli = clienteFijo
          ? { ...d, clienteLeadId: clienteFijo.leadId, clienteNombre: clienteFijo.nombre }
          : d;
        const j2 = await api({ action: 'editar', id: t.id, patch: editPatch(conCli) });
        if (j2.ok && j2.tarea) { t = j2.tarea; confirmar(t); }
      }
      return toBoard(t);
    },
    saveTask: async (d) => {
      if (demo) return;
      const j = await api({ action: 'editar', id: Number(d.id), patch: editPatch(d, progresoGuardado.current!.get(d.id)) });
      if (j.ok) confirmar(j.tarea);
    },
    /**
     * MOVER EN EL KANBAN (16/10/2026): la acción `mover` de /api/todo, que existía desde la mig
     * 0051 sin un solo llamador. Escribe el estado, el lugar y lo que se acomoda solo
     * (`trasMover`: el avance al completar o reabrir, el motivo de «Atorada»).
     */
    mover: async (id, estado, orden, opts) => {
      // Sin base no hay canónica: la pantalla se queda con su estado optimista (`trasMover`).
      if (demo) return null;
      const j = await api({ action: 'mover', id: Number(id), estado, orden, motivo: opts?.motivo, historial: opts?.historial });
      if (!j.ok || !j.tarea) throw new Error(j.error || 'No se pudo mover.');
      confirmar(j.tarea);
      return toBoard(j.tarea);
    },
    /**
     * LA PRIORIDAD A MANO, TAMBIÉN ACÁ. El slider del detalle, el pop-up del arrastre y la
     * casilla del alta salen de esta capacidad: sin ella el tablero de un cliente dibuja el
     * número que puso MaKo y NO LE DA NINGUNA FORMA DE CAMBIARLO. Es la regla de AGENTS.md
     * escrita el 23/09 con el pedido del dueño adentro: «toda prioridad que pone la IA tiene
     * que poder cambiarse a mano en la pantalla, sin debate previo y sin fricción».
     *
     * ⚠️ NO ES LA MISMA IMPLEMENTACIÓN QUE LA DEL DUEÑO, Y NO PUEDE SERLO. Allá
     * `/api/plan-board` corre la cascada del método (desempatar, auditar, mover a los
     * vecinos) y clava `score_manual` (mig 0143). Acá no hay cascada ni candado:
     * `experimento_tareas` no tiene esa columna y su Perro no re-puntúa lo que ya existe
     * —sólo lo que NACE—, así que no hay nada de lo que haya que protegerse. Escribir el
     * número alcanza; inventarle un candado que nada respeta sería peor.
     */
    prioridadManual: async (entidad, id, score, opts) => {
      const n = Math.max(1, Math.min(100, Math.round(score)));
      if (demo) return { score: n, movidos: [] };
      // `score_razon` viaja con el número: sin eso, la tarjeta queda mostrando la razón que
      // escribió MaKo al lado de un score que ya no es el suyo.
      const j = entidad === 'tarea'
        ? await api({ action: 'editar', id: Number(id), patch: { score: n, prioridad: prioFromScore(n), score_razon: 'La fijaste a mano' } })
        : await api({ action: 'categoria-editar', id: Number(id), patch: { prioridad: n, score_razon: 'La fijaste a mano' } });
      if (!j.ok) throw new Error(j.error || 'No se pudo cambiar la prioridad.');
      if (entidad !== 'tarea') return { score: n, movidos: [] };
      // Sin cascada, pero CON LAS DE ABAJO cuando se soltó en el Kanban: la misma regla que el
      // tablero del dueño (`hacerLugar`), porque acá también empatan y el Kanban desempata por
      // `num`. Y el camino de vuelta de un deshacer, sólo sobre las que nadie movió después.
      const todas = tareasVivas.current;
      const yo = todas.find((t) => t.id === id);
      const compiten = todas.filter((t) => t.id !== id && t.progress < 100 && !esRecurrente(t));
      const corridas: Corrimiento[] = opts?.lugar && yo
        ? (hacerLugar(compiten.map((t) => ({ id: t.id, score: t.score, num: t.num })), { id, score: n, num: yo.num }, opts.lugar) ?? [])
        : [];
      const devueltas: Corrimiento[] = (opts?.deshacer ?? [])
        .filter((c) => todas.find((t) => t.id === c.id)?.score === c.despues)
        .map((c) => ({ id: c.id, antes: c.despues, despues: c.antes }));
      // Vuelven SÓLO las que se escribieron: la pantalla las corre con esto, y una que falló
      // pintada como corrida miente hasta el F5.
      const movidos: Array<{ id: string; nombre: string; antes: number; despues: number }> = [];
      for (const c of [...corridas, ...devueltas]) {
        const jv = await api({ action: 'editar', id: Number(c.id), patch: { score: c.despues, prioridad: prioFromScore(c.despues) } });
        if (jv.ok) movidos.push({ id: c.id, nombre: todas.find((t) => t.id === c.id)?.title ?? c.id, antes: c.antes, despues: c.despues });
      }
      return { score: n, movidos };
    },
    deleteTask: async (id) => { if (demo) return; await api({ action: 'borrar', id: Number(id) }); },
    createLabel: async (l) => {
      if (demo) return l;
      const j = await api({ action: 'categoria-crear', nombre: l.name, color: l.color, emoji: l.emoji, prioridad: l.score, detalle: l.detalle, historial: l.historial, score_razon: l.scoreRazon ?? null, deadline: l.deadline ?? null, quarter: l.quarter ?? null, recurrente: !!l.recurrente, recurrencia: l.recurrencia ?? null, cliente_lead_id: l.clienteLeadId ?? clienteFijo?.leadId ?? null, cliente_nombre: l.clienteNombre ?? clienteFijo?.nombre ?? null, portada: l.portada ?? null, portada_y: l.portadaY ?? null, icono: l.icono ?? null, notas: l.notas ?? '', impacto: l.impacto ?? null, esfuerzo: l.esfuerzo ?? null });
      return j.ok && j.categoria ? toLabel(j.categoria) : l;
    },
    saveLabel: async (l) => { if (demo) return; await api({ action: 'categoria-editar', id: Number(l.id), patch: { nombre: l.name, color: l.color, emoji: l.emoji, prioridad: l.score, detalle: l.detalle, historial: l.historial, score_razon: l.scoreRazon ?? null, deadline: l.deadline ?? null, quarter: l.quarter ?? null, recurrente: !!l.recurrente, recurrencia: l.recurrencia ?? null, cliente_lead_id: l.clienteLeadId ?? null, cliente_nombre: l.clienteNombre ?? null, portada: l.portada ?? null, portada_y: l.portadaY ?? null, icono: l.icono ?? null,
      // Los tres de #157 del lado del proyecto. Mismo motivo que arriba: este objeto
      // es lo UNICO que viaja, asi que un campo que falta nunca se guarda.
      notas: l.notas ?? '', impacto: l.impacto ?? null, esfuerzo: l.esfuerzo ?? null } }); },
    deleteLabel: async (id) => { if (demo) return; await api({ action: 'categoria-borrar', id: Number(id) }); },
    // El Perro server-side, igual que en el board del dueño. Sin esto, `usaServerPerro`
    // era false y TODO lo que entraba por el tablero del cliente (reunión, archivo,
    // alta manual) se quedaba con el score que adivinó la extracción: sin razón, sin
    // detalle y sin checklist — y encima dependiendo de que dejara la pestaña abierta.
    priorizarNuevas: async (ids, _proyectoIds, contexto) => {
      if (demo) return null;
      const j = await api({ action: 'priorizar-nuevas', ids: ids.map(Number), contexto: contexto ?? '' });
      if (!j.ok) throw new Error(j.error || 'no se pudo priorizar');
      const patches = (j.patches ?? []) as GuardPatch[];
      // El conteo por columna sale de los propios patches (el board lo usa para el aviso).
      const tareas: Record<Prio, number> = { alta: 0, media: 0, baja: 0, futuro: 0 };
      for (const p of patches) if (p.priority) tareas[p.priority] += 1;
      return { tareas, proyectos: 0, patches, proyectosPatch: [] };
    },
  };
  const board = useBoard(tareas.map(toBoard), categorias.map(toLabel), user, repo);
  useEffect(() => { tareasVivas.current = board.tasks; });
  // Scope del auto-load POR workspace: la preferencia del cliente X no se comparte con
  // el board de la agencia ni con otro workspace en la misma impersonación/origin.
  // El cliente entra en el scope por lo mismo que en `PlanBoard`: un filtro dejado en el
  // tablero general esconde el tablero de la ficha sin decir por qué.
  const scope = `${wsId != null ? `ws:${wsId}` : 'ws'}${clienteFijo ? `:cli${clienteFijo.leadId}` : ''}`;
  return <BoardShell board={board} scope={scope} vistaInicial={vistaInicial} clientes={clientes} embebido={embebido} vistaExtra={vistaExtra} onRecargar={onRecargar} soloVista={soloVista} clienteInicial={clienteInicial} nombreCliente={clienteFijo?.nombre} accionEnLugarDelMenu={accionEnLugarDelMenu} />;
}
