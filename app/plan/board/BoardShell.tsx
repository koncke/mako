'use client';

// =============================================================================
// BoardShell — la ÚNICA vista del tablero /todo (admin y cliente idénticos)
// =============================================================================
// Recibe un `Board` (useBoard) y pinta todo: header con avance promedio, toggle
// Prioridades/Kanban, 4 columnas de prioridad a ancho completo con DnD, tarjetas
// cuadradas (estilo CRM) con avance editable inline, modal con checklist + coach
// de MaKo + Change history (avatar + deshacer por entrada), editor de proyectos
// con emoji, y el form bloqueante para tareas Alta sin deadline/checklist.

import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { UndoToast } from '../../_components/UndoToast';
import { ConfirmModal } from '../../_components/ConfirmModal';
import { EmojiPickerMini } from './EmojiPicker';
import { MakoChecklistModal } from './MakoChecklist';
import { pasosComoBullets } from '@/lib/detalle-fusion';
import { CrearTareaModal } from './CrearTareaModal';
import { CrearProyectoModal } from './CrearProyecto';
import { EliminarModal } from './EliminarModal';
import { AsignarProyectoModal } from './AsignarProyecto';
import { AudienciaModal } from './AudienciaModal';
import { LapizPrioridad, MoverPrioridadModal } from './PrioridadAMano';
import { MakoProyectoModal } from './MakoProyecto';
import { useVerMas } from './VerMas';
import { useCapaModal } from '@/app/_components/pila-modales';
import { ImportarModal } from './ImportarModal';
import { ReunionExtractModal } from './ReunionExtractModal';
import { TareasRecibidasModal, type PropuestaPendiente } from './TareasRecibidasModal';
import { DatosModal, type FaltanteItem } from './DatosModal';
import { TareasCreadasModal } from './TareasCreadasModal';
import { GraphicsView } from './Graphics';
import { MakoStar } from '../../_components/MakoBrand';
import { GuardianIcon } from './GuardianIcon';
import { GRAMATICA } from '@/lib/mako-gramatica';
import { SvcIcon, BrandDefs } from '../../_components/ServicioVisual';
import { ScoreIcon } from './guardian-form';
import { BuscadorTareas } from './BuscadorTareas';
import { matchTarea, coincide, CAMPOS_POR_DEFECTO, type CampoBusqueda } from '@/lib/buscar-tareas';
import { RichText, stripHtml } from './RichText';
import type { Board } from './useBoard';
import { separarRepetidas, textoRepetidas } from '@/lib/tareas-dedup';
import { type BoardTask, type Label, type Prio, type Check, type Actor, type Fuente, type FuenteTipo, ACTOR_LABEL, PRIOS, PLABEL, PCOLOR, SWATCHES, MAX_PRIORIDAD, scoreFromPrio, uid, relTime, fechaHora, fuenteEfectiva, prioFromScore, displayPrio } from './types';
import { resolverDeps, estaBloqueada, type EstadoDeps, type Dep } from './dependencias';
import { ESCALERA } from './types';
import { DependenciasBloque } from './DependenciasBloque';
import { apiPlan } from './repo-plan';
// El Link propio, NUNCA next/link: preserva el ?ws= de la pestaña (AGENTS.md).
import Link from '@/app/_ui/Link';
import { diasQuieta, diasAlDeadline, ajusteTemporal } from './envejecer';
import { ExportarModal } from './ExportarModal';
import { NotasLista } from './NotasLista';
import { capacidad } from '@/lib/mako-capacidades';
import { cuandoDe, quartersElegibles, quarterDeFecha, esCuando, CUANDO_LABEL, CUANDO_OPS, type Cuando } from './cuando';
import { usePref, usePrefSet, esUnoDe, esBool, setScopePrefs } from './prefs';
import { useArrastreTactil, type ArrastreTactil } from './arrastre-tactil';
import { WarnMark, projProgress, fechaConDia, diasHasta, plazoTexto } from './piezas';
import { TablaProyectos, TablaTareas } from './Tablas';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

/**
 * El «hoy» del navegador, `YYYY-MM-DD`.
 *
 * ⚠️ ES LA ZONA DE QUIEN MIRA, no la del workspace, y acá está bien: lo único que
 * decide es qué se ve —en qué ventana cae una tarea y qué Quarters se ofrecen—,
 * nunca qué se guarda. Lo que se persiste es la clave `2026-Q3`, que no depende de
 * ninguna zona. Si esto decidiera un valor a escribir, tendría que venir del server:
 * una detección automática mide TU máquina y no la del cliente.
 */
const hoyISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ⚠️ «tareas», NO «kanban», y la ruta también: «cambia el nombre y la ruta de kanban por
// tareas, que es más preciso» (23/09/2026). Kanban es CÓMO se dibuja —y desde que existe la
// vista de tabla ya ni siquiera es siempre un kanban—; lo que hay ahí son las tareas.
const VISTAS = ['prioridades', 'tareas', 'proyectos', 'graphics'] as const;
type Vista = (typeof VISTAS)[number];
// ⚠️ `kanban` SIGUE RESOLVIENDO, para siempre. Es el nombre que tuvo la vista hasta el
// 23/09/2026 y vive en links compartidos, en favoritos y en la barra de direcciones de
// cualquiera que la haya usado. Renombrar sin redirigir es romperlos en silencio (AGENTS.md:
// «sacar algo de un catálogo no es borrarlo: hay gente apuntándole»).
const ALIAS_VISTA: Record<string, Vista> = { kanban: 'tareas' };
const vistaValida = (v: unknown): Vista | null => {
  const k = String(v);
  if ((VISTAS as readonly string[]).includes(k)) return k as Vista;
  return ALIAS_VISTA[k] ?? null;
};

export function BoardShell({ board, scope, vistaInicial }: {
  board: Board;
  /** scope de las preferencias locales (por workspace): no se mezclan entre impersonaciones. */
  scope?: string;
  /**
   * La vista con la que arranca, LEÍDA EN EL SERVER desde `?vista=` (app/plan/agencia/page.tsx).
   * No se lee acá de `window`: el server renderiza «prioridades», el cliente corregiría después
   * de hidratar, y eso son dos cosas malas a la vez — un parpadeo en cada refresh y un aviso
   * de hidratación desalineada. Opcional porque el board del CLIENTE todavía no la pasa.
   */
  vistaInicial?: string;
}) {
  
  // G1/G2 guardián: score→columna, restricción al proyecto top, debate.
  const { tasks, labels, repo } = board;
  const [view, setView] = useState<Vista>(vistaValida(vistaInicial) ?? 'prioridades');
  const [openProj, setOpenProj] = useState<string | null>(null);
  const [peekProjId, setPeekProjId] = useState<string | null>(null); // proyecto abierto DESDE una tarea (encima de ella; feedback jul-19)
  const [nuevoProj, setNuevoProj] = useState(false);
  const [nuevaTareaProj, setNuevaTareaProj] = useState<string | null>(null); // proyecto donde crear la tarea nueva
  const [nuevaTareaPrio, setNuevaTareaPrio] = useState<Prio | null>(null);   // columna desde la que se creó (precompleta la prioridad)
  const [eliminarTaskId, setEliminarTaskId] = useState<string | null>(null);
  const [eliminarProjId, setEliminarProjId] = useState<string | null>(null);
  const [asignarTaskId, setAsignarTaskId] = useState<string | null>(null);
  const [debateProjId, setDebateProjId] = useState<string | null>(null);
  const [makoHintId, setMakoHintId] = useState<string | null>(null); // tarea recién creada → sugerir "MaKo te ayuda"
  const [makoProjId, setMakoProjId] = useState<string | null>(null); // "MaKo te ayuda" para un proyecto
  const [q, setQ] = useState('');
  // DÓNDE busca la barra. Por defecto SOLO el título: buscar una palabra y recibir media
  // lista porque la palabra estaba en el detalle de treinta tareas es lo que hacía antes.
  const [campos, setCampos] = useState<CampoBusqueda[]>(CAMPOS_POR_DEFECTO);
  // La búsqueda con MaKo devuelve IDS, no un texto: se filtra por pertenencia, no por
  // coincidencia. `ids === null` = no hay búsqueda con IA activa.
  const [ia, setIa] = useState<{ pensando: boolean; ids: string[] | null; explico: string }>({ pensando: false, ids: null, explico: '' });
  const idsIA = useMemo(() => (ia.ids ? new Set(ia.ids) : null), [ia.ids]);

  const buscarConIA = async (texto: string) => {
    setIa({ pensando: true, ids: null, explico: '' });
    const j = await fetch('/api/plan-buscar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: texto }), signal: AbortSignal.timeout(60_000) })
      .then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
    if (!j.ok) { setIa({ pensando: false, ids: null, explico: '' }); alert(j.error || 'No pude buscar.'); return; }
    setIa({ pensando: false, ids: (j.ids ?? []).map(String), explico: String(j.explico ?? '') });
  };
  // El scope va ANTES de cualquier usePref: la lectura ocurre en el primer efecto de cada
  // hook, y esto corre en el render. Sin esto, las preferencias del tablero del dueño se
  // aplicaban dentro del tablero de un cliente (ids de proyecto que allá no existen).
  setScopePrefs(scope);
  // ⚠️ LOS FILTROS Y EL ORDEN SE RECUERDAN (usePref): «se resetean al recargar y al cambiar
  // de pestaña» era el reporte. Lo que NO se recuerda es la BÚSQUEDA (`q`): un texto viejo
  // restaurado esconde el tablero entero y se lee como que no hay nada cargado.
  const [fLabels, setFLabels] = usePrefSet('tablero.proyectos');
  // ⚠️ UN SOLO FILTRO DE ESTADO Y UNA SOLA VISTA DE TABLA PARA LAS DOS TABS. «Tanto la vista
  // de tabla como los filtros, haz que se mantengan igual tanto para la tab de proyectos
  // como kanban» (23/09/2026). Eran dos pares de preferencias con la misma pregunta adentro
  // («¿muestro lo hecho?», «¿tabla o tarjetas?»), así que cambiar de tab deshacía lo que
  // acababas de elegir — y no se leía como dos estados: se leía como que el filtro no
  // funciona. Los rótulos siguen siendo distintos (Activas/Activos) porque el sustantivo
  // cambia; la elección es la misma.
  const [doneFilter, setDoneFilter] = usePref<DoneFilter>('tablero.estado', 'all', esUnoDe('all', 'activas', 'comenzadas', 'hechas'));
  const [fOrigen, setFOrigen] = usePrefSet('tablero.origen');  // filtrar por ORIGEN (fuente: WhatsApp/Fathom/…)
  // CUANDO cae la tarea: hoy / esta semana / este Quarter / sin planificar (tarea #635).
  // Es un Set y no un valor unico porque «hoy Y esta semana» es una pregunta legitima
  // —lo urgente mas lo que se viene— y con un radio habria que elegir una.
  const [fCuando, setFCuando] = usePrefSet<Cuando>('tablero.cuando', esCuando);
  const [sortMode, setSortMode] = usePref<'score' | 'creacion'>('orden.modo', 'score', esUnoDe('score', 'creacion')); // orden de tareas/proyectos
  const [sortDir, setSortDir] = usePref<'desc' | 'asc'>('orden.dir', 'desc', esUnoDe('desc', 'asc')); // dirección: desc = mayor/más nuevo primero
  // TARJETAS o TABLA, una preferencia por vista. «Sí me parece bien que haya una vista
  // tabla tanto para proyectos como para el kanban, pero NO reemplaces lo que hay ahora,
  // es otra opción de verlo» — así que el default sigue siendo lo de siempre.
  const [tabla, setTabla] = usePref<boolean>('tablero.tabla', false, esBool);
  // La tarjeta que acabás de soltar en otra columna: abre el pop-up del 1 al 100.
  // Qué prioridad se está editando, y por qué camino se llegó. UNO para los dos caminos:
  // el ARRASTRE (que trae la columna de destino) y el LÁPIZ del panel (que no trae ninguna,
  // porque no se movió de columna). Antes era sólo del arrastre y sólo de tareas.
  const [soltada, setSoltada] = useState<{ entidad: 'proyecto' | 'tarea'; id: string; destino?: Prio } | null>(null);
  /**
   * SOBRE QUÉ está trabajando el Perro AHORA mismo (ids de tarea o de proyecto).
   *
   * «Cuando se cree un proyecto o tarea me lo tiene que abrir el detail inmediatamente… y en
   * el proceso, obvio el loader» (23/09/2026). Crear ya no espera al modelo —la tarjeta
   * nace y el detalle se abre— así que hay una ventana de 10-20 segundos en la que la
   * tarjeta está VACÍA: sin proyecto, sin detalle y con el score de fábrica. Sin decirlo,
   * eso se lee como que la creación salió mal.
   */
  const [trabajandoIA, setTrabajandoIA] = useState<ReadonlySet<string>>(new Set());
  const marcarTrabajando = useCallback((ids: string[], on: boolean) => {
    setTrabajandoIA((prev) => {
      const n = new Set(prev);
      for (const id of ids) { if (on) n.add(id); else n.delete(id); }
      return n;
    });
  }, []);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ msg: string; onOk: () => void } | null>(null);
  const [debateId, setDebateId] = useState<string | null>(null);
  const [nuevaTarea, setNuevaTarea] = useState(false);
  const [extraerReunion, setExtraerReunion] = useState(false); // G3: extraer de una reunión de Fathom
  const [exportar, setExportar] = useState(false);             // bajarse el tablero (modal de a 1 pregunta)
  const [reunionArchivo, setReunionArchivo] = useState<File[] | null>(null); // los archivos elegidos en la bandeja → entran al modal de extracción
  const [importar, setImportar] = useState(false);                           // la bandeja de importación
  // "Datos sin marcar" (feedback jul-19): UN modal batch para las tareas sin fecha, en
  // vez del gauntlet card-by-card. Ver DatosModal.
  // ⚠️ SOLO A PEDIDO, desde el ⚠ del header (08-T46, 17/9). Antes se abría SOLO al entrar
  // a la tab y, al cerrarlo, salía un segundo pop-up («¿seguir recordándote?»). Mauricio,
  // en la llamada del 8/9: «me da miedo picarle a Maco» — no entendía qué le pedía ni qué
  // le preguntaba después, y eligió «recordármelo más tarde» para sacárselo de encima. Es
  // la regla de la casa: nada de auto-abrir modales al entrar a una pantalla (para avisar
  // está el badge), y nunca pedir datos en plena operación (AGENTS.md). Cerrar = «más tarde».
  const [datosOpen, setDatosOpen] = useState(false);
  const [dlDismiss, setDlDismiss] = useState<Set<string>>(new Set()); // deadline ignorado por tarea
  const [dlLoaded, setDlLoaded] = useState(false);                    // ya leí localStorage
  // "MaKo cargó tareas" (bienvenida): tareas creadas por una FUENTE (WhatsApp/Fathom/MaKo)
  // que el dueño todavía no vio en este device. Se muestran ANTES que el DatosModal.
  const [welcomeTasks, setWelcomeTasks] = useState<BoardTask[]>([]);
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const welcomeDetectRef = useRef(false);
  const welcomeAutoRef = useRef(false);
  const guardianNuevasRef = useRef(false); // el Perro re-puntúa las tareas nuevas UNA vez al entrar
  // Borradores PENDIENTES (plan_propuestas): las tareas que MaKo sacó sola de tu última
  // reunión de equipo, o las que te mandó otra persona. Se muestran de a una.
  const [pendientes, setPendientes] = useState<PropuestaPendiente[]>([]);
  /** El hueco elástico del header: es el METRO de cuánto lugar sobra. */
  // Cerrar el modal con la ✕ NO descarta nada: solo lo esconde. Los borradores siguen
  // vivos y el botón de Fathom (que late) los vuelve a abrir.
  // (ya no hace falta un flag de "lo cerré": el modal solo se abre a pedido)
  /** el borrador de UNA reunión, abierto desde el selector de Fathom ("ver lo que sacó"). */
  const [borradorReunion, setBorradorReunion] = useState<PropuestaPendiente | null>(null);
    // Lo que se sabe de la reunión MIENTRAS viaja el request: título y cuántas tareas.
  // Los dos salen del conteo que el server ya mandó con la lista, así que el esqueleto
  // no inventa nada. null = no hay nada abriéndose.
  const [cargandoBorrador, setCargandoBorrador] = useState<{ titulo: string; fecha: string | null; n: number } | null>(null);
  // Lo que ESPERA ALGO TUYO. Es lo que hace esperar a los otros pop-ups — y tiene que ser
  // esto y no "hay borrador": un borrador al que solo le quedan tareas de otras personas
  // se queda abierto para siempre, y con él se quedaba tapado el resto de la cola.
  // Los CIERRES cuentan igual que las tareas: «revisá si estas 10 ya están hechas» es
  // trabajo tuyo y de nadie más. Sin sumarlos, un borrador de puros cierres entraba a la
  // lista y el badge seguía en cero — visible en el código, invisible en la pantalla.
  const nPendientes = pendientes.reduce((s, p) => s + (p.tareas?.filter((t) => !t.esDeOtro).length ?? 0) + (p.cerrar?.length ?? 0), 0);
  // Lo que espera algo de OTRA persona (repartir o mandárselo). No hace esperar a los
  // demás pop-ups —no es trabajo tuyo— pero TIENE que verse: un borrador que solo
  // conserva tareas ajenas quedaba completamente invisible (el modal nunca se abría
  // y el botón no mostraba badge), y ahí murieron los 15 compromisos que Mauricio
  // asumió en su reunión: existían en la base y nadie podía llegar a ellos.
  const nDeOtros = pendientes.reduce((s, p) => s + (p.tareas?.filter((t) => t.esDeOtro).length ?? 0), 0);
  const pendientesRef = useRef(false);

  const ask = (msg: string, onOk: () => void) => setConfirm({ msg, onOk });
  // El aviso de gasto de IA lo muestra el toast GLOBAL <IaUsageToast> (app/layout.tsx),
  // que sale ante CUALQUIER operación de IA. Antes el board tenía SU PROPIO cartel →
  // salían DOS avisos apilados por la misma operación (feedback jul-19). showUsage queda
  // como no-op para no tocar los ~8 call-sites que lo pasan como onUsage.
  const showUsage = (_u: unknown, _feature: string) => { /* dedup: lo muestra IaUsageToast */ };

  // El guardián es dueño de la ubicación: la columna respeta la restricción
  // (Alta solo para el proyecto top / sin proyecto / emergencia).
  //
  // El Objetivo Principal es el proyecto de mayor score QUE TODAVÍA TIENE TRABAJO.
  // Antes era, sin más, el de mayor score: cuando lo terminabas, el norte se quedaba
  // clavado en un proyecto 100% hecho y la vista Prioridades se vaciaba en vez de
  // pasar al siguiente. Si ya está TODO hecho, se muestra igual el de mayor score
  // (para no dejar la card vacía), pero no hay nada que priorizar.
  //
  // El score del proyecto lo DERIVA el Perro de sus tareas (`recurvarProyectosOwner`), así
  // que dos proyectos empatan cuando su mejor trabajo vale lo mismo — y eso pasa seguido en
  // la punta. El desempate NO puede quedar en `orden`, que es el orden en que se crearon:
  // el norte del tablero cambiaría de proyecto por un motivo que no significa nada. Empata
  // el que tiene MÁS trabajo abierto: si dos cosas importan igual, se ataca donde hay más.
  const pendientesPorProy = new Map<string, number>();
  for (const t of tasks) if (t.progress < 100) for (const id of t.labels) pendientesPorProy.set(id, (pendientesPorProy.get(id) ?? 0) + 1);

  // ── Dependencias (mig 0140) ──
  // Se resuelven ACÁ, en el render, y NO se persiste ni un número. Es la decisión de
  // diseño más importante de la feature: `curveTaskScores` reasigna los scores por ranking
  // a bandas fijas, así que un orden horneado en la base es IRREVERSIBLE —borrar la arista
  // no devuelve los scores viejos, que ya no existen—. Como lente, una arista equivocada
  // se arregla borrándola y el tablero vuelve exacto al instante.
  // El otro motivo es de cableado: `recurvarPlanOwner` tiene UN solo llamador (adentro de
  // `priorizarNuevasOwner`), o sea que el tablero solo se re-reparte cuando ENTRAN TAREAS
  // NUEVAS. Una propagación enchufada ahí sería invisible hasta la próxima reunión: el
  // dueño declara la dependencia, no pasa nada, y parece que la feature no funciona.
  const estDeps = useMemo(() => resolverDeps({ tareas: tasks, deps: board.deps }), [tasks, board.deps]);
  const nombreDe = (id: string) => board.labelById(id)?.name ?? tasks.find((t) => t.id === id)?.title ?? id;
  const frenanA = (id: string): string[] => [
    ...(estDeps.bloqueantes[id] ?? []).map(nombreDe),
    ...(estDeps.bloqueantesProy[id] ?? []).map(nombreDe),
  ];

  // Un proyecto está frenado cuando NINGUNA de sus tareas abiertas se puede empezar. Ojo
  // con el matiz: alcanza con que UNA sea arrancable para que el proyecto lo sea, porque
  // el norte del tablero tiene que ser algo en lo que hoy se puede poner una hora.
  const proyArrancable = (id: string) => tasks.some((t) => t.progress < 100 && t.labels.includes(id) && !estaBloqueada(t.id, estDeps));

  const porScore = labels.slice().sort((a, b) => b.score - a.score || (pendientesPorProy.get(b.id) ?? 0) - (pendientesPorProy.get(a.id) ?? 0));
  const tienePendientes = (id: string) => (pendientesPorProy.get(id) ?? 0) > 0;
  // El Objetivo Principal exige trabajo ARRANCABLE, no solo pendiente: un norte en el que
  // no se puede empezar nada hoy es un norte que no sirve. Si todo está frenado se cae al
  // criterio de siempre en vez de dejar la card vacía — y ahí el tablero ya está diciendo
  // otra cosa (que la cadena está trabada), que se ve en los candados.
  const objetivoPrincipal = porScore.find((l) => proyArrancable(l.id)) ?? porScore.find((l) => tienePendientes(l.id)) ?? porScore[0] ?? null;
  const topProjectId = objetivoPrincipal?.id ?? null;
  // ── "Datos sin marcar" (feedback jul-19): el deadline (opcional), en UN modal batch.
  // Reemplaza al gauntlet card-by-card que auto-popeaba de a una. Persistimos qué se ignoró. (El «no volver a pedir» de
  // `mako_plan_datos_off` se fue con el auto-open: sin pop-up solo, no hay nada que apagar.) ──
  // Las keys se scopean por workspace (scope): impersonando distintos clientes,
  // las preferencias NO se mezclan en el mismo navegador.
  const dlKey = (base: string) => `${base}${scope ? '_' + scope : ''}`;
  useEffect(() => {
    try {
      const dl = localStorage.getItem(dlKey('mako_plan_dl_dismiss'));
      if (dl) setDlDismiss(new Set(JSON.parse(dl) as string[]));
    } catch { /* localStorage no disponible */ }
    setDlLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);
  // Bienvenida "MaKo cargó tareas": detectamos UNA vez las tareas con FUENTE recientes que
  // este device no vio. NO se auto-abren acá: el auto-open está más abajo. El botón ✨ del
  // header las reabre cuando quieras (ya no se pierden al tocar una tarea).
  useEffect(() => {
    if (welcomeDetectRef.current || !dlLoaded || tasks.length === 0) return;
    welcomeDetectRef.current = true;
    try {
      const raw = localStorage.getItem(dlKey('mako_plan_welcome_seen'));
      const seen = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
      const reciente = Date.now() - 3 * 86400000; // últimas 72h → no floodear con viejas
      const nuevas = tasks.filter((t) => t.progress < 100 && !seen.has(t.id)
        && fuenteEfectiva(t).tipo !== 'manual'
        && (t.historial?.length ? Math.min(...t.historial.map((h) => h.ts)) : 0) >= reciente);
      if (nuevas.length) setWelcomeTasks(nuevas);
    } catch { /* localStorage no disponible */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dlLoaded, tasks.length]);
  const hayWelcome = welcomeTasks.length > 0;
  // Los proyectos que tocan esas tareas nuevas (para la tab "Proyectos" del modal).
  const welcomeProjIds = new Set(welcomeTasks.flatMap((t) => t.labels));
  const welcomeProjects = labels.filter((l) => welcomeProjIds.has(l.id));
  // Cuáles se CREARON en esta carga vs se REUTILIZARON: un proyecto nuevo nace junto
  // con las tareas del lote (su alta en el historial es de ~el mismo momento); uno
  // reutilizado es viejo. Ventana holgada (5 min) porque el lote entra en segundos.
  const welcomeTs = welcomeTasks.reduce((min, t) => { const ts = t.historial.length ? t.historial[t.historial.length - 1].ts : 0; return ts && ts < min ? ts : min; }, Infinity);
  const proyNuevoIds = new Set(welcomeProjects.filter((l) => { const cre = l.historial.length ? Math.min(...l.historial.map((h) => h.ts)) : 0; return cre >= welcomeTs - 300000; }).map((l) => l.id));
  const marcarWelcomeVisto = () => {
    try {
      const raw = localStorage.getItem(dlKey('mako_plan_welcome_seen'));
      const seen = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
      welcomeTasks.forEach((t) => seen.add(t.id));
      localStorage.setItem(dlKey('mako_plan_welcome_seen'), JSON.stringify([...seen]));
    } catch { /* ignore */ }
  };
  // Lo único que queda sin marcar es la FECHA: la checklist se fue del producto el
  // 22/09/2026 y con ella la mitad de este modal.
  const faltantes: FaltanteItem[] = tasks
    .filter((t) => t.progress < 100)
    .map((t) => ({ task: t, needDl: !t.deadline && !dlDismiss.has(t.id) }))
    .filter((x) => x.needDl)
    .sort((a, b) => b.task.score - a.task.score);
  const persistSet = (key: string, s: Set<string>) => { try { localStorage.setItem(dlKey(key), JSON.stringify([...s])); } catch { /* ignore */ } };
  const ignorarDl = (id: string) => setDlDismiss((s) => { const n = new Set(s).add(id); persistSet('mako_plan_dl_dismiss', n); return n; });
  // Cerrar = «más tarde». Sin segundo pop-up: el ⚠ sigue ahí con el número.
  const cerrarDatos = () => setDatosOpen(false);
  const abrirDatosManual = () => setDatosOpen(true);
  // Auto-abrir la bienvenida UNA vez, sin apilar sobre un detalle abierto ni sobre «Datos»
  // abierto a mano. Antes esperaba a que Datos se abriera solo primero: con el auto-open de
  // Datos fuera (08-T46), esa espera la habría dejado sin abrirse nunca, de costado.
  useEffect(() => {
    if (!hayWelcome || welcomeAutoRef.current) return;
    if (openId || openProj || peekProjId) return;
    if (nPendientes > 0) return;                  // el borrador por confirmar va primero
    if (datosOpen) return;
    welcomeAutoRef.current = true;
    marcarWelcomeVisto();
    setWelcomeVisible(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayWelcome, datosOpen, openId, openProj, peekProjId, nPendientes]);

  // Traer los borradores pendientes UNA vez por montaje. No los creó nadie en el board:
  // los dejó el cron de reuniones (MaKo leyó tu reunión) o los mandó otra persona.
  useEffect(() => {
    if (pendientesRef.current) return;
    pendientesRef.current = true;
    void fetch('/api/plan-propuesta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pendientes' }) })
      .then((r) => r.json())
      .then((j) => { if (j?.ok && Array.isArray(j.propuestas)) setPendientes(j.propuestas as PropuestaPendiente[]); })
      .catch(() => { /* silencioso: es un extra al entrar */ });
  }, []);
  // Los borradores van PRIMEROS de la cola de pop-ups, no últimos. Antes cedían ante
  // Datos y la bienvenida: con el tablero lleno, "faltan datos" salta siempre y el
  // borrador no se veía nunca — MaKo decía "entrá al plan a confirmarlas" y no había
  // nada. Lo que alguien está esperando confirmar le gana a un recordatorio.
  // Espera a que NO haya otro pop-up: si el de "datos que faltan" está abierto (lo
  // abrió el ⚠ a mano), este se muestra recién cuando se cierre — no atrás de él.
  // SOLO se abre solo si hay algo TUYO esperando. Un borrador al que solo le quedan
  // tareas de otras personas sigue vivo (para repartirlas), pero saltarte encima en cada
  // entrada al plan sería un recordatorio de algo que ya resolviste: queda a un click,
  // dentro del selector de Fathom.
  // SOLO a pedido. Antes se abría solo al entrar al plan y era lo primero que veías
  // cada vez, tapando el tablero por algo que ya sabías: el botón de Fathom late y
  // lleva el número. Ahora se llega desde ahí — el selector muestra cuántas esperan
  // por reunión y al entrar a una se abre su borrador.
  const hayRecibidas = !!borradorReunion;
  // Espera su turno detrás de cualquier otro pop-up (y del detalle de una tarjeta), pero
  // SE ESCONDE, no se desmonta. Desmontarlo tiraba a la basura media revisión: los
  // destildes, las reasignaciones y las respuestas viven en su estado, y abrir una
  // tarjeta ya cargada —ahora una grilla de tarjetas clickeables— lo desmontaba.
  // …salvo cuando el borrador se abrió DESDE el selector: ahí va encima de él, para
  // poder volver a la lista al cerrarlo en vez de perder los dos de un saque.
  const recibidasOculto = !!(openId || openProj || peekProjId || datosOpen || cargandoBorrador
    || (extraerReunion && !borradorReunion));

  // ── el perro guardián re-puntúa el plan (score 1-100 / 1-10) ──
  // Sin botón: corre solo EN BACKGROUND, pero SOLO cuando el plan cambió de forma
  // ESTRUCTURAL (se agregó/quitó/completó una tarea, o cambió un proyecto). Si nada
  // cambió, NO gasta tokens (feedback #1/#14). La "firma" ignora los scores para no
  // re-dispararse a sí misma cuando el guardián aplica los suyos.
  const repriorizando = useRef(false);
  const lastReprioSig = useRef(''); // dedup: no re-puntuar dos veces la misma firma
  const planSignature = () => {
    const t = tasks.filter((x) => x.progress < 100).map((x) => x.id).sort().join(',');
    const p = labels.map((l) => l.id).sort().join(',');
    return `${t}|${p}`;
  };
  const rePriorizar = async (sig?: string) => {
    if (repriorizando.current) return;
    const sigNow = sig ?? planSignature();
    if (lastReprioSig.current === sigNow) return; // ya se corrió para esta firma
    repriorizando.current = true;
    // ⚠️ LOS PROYECTOS NO VIAJAN ACÁ, y es a propósito. Los juzga `priorizarProyectosOwner`
    // (server-side) con la metodología completa y con datos para juzgar. Mandarlos también
    // desde acá —como `{ id, nombre }`, dos palabras— era el SEGUNDO productor del mismo
    // número, y el que producía el peor: el modelo decidía si «Feature: Closing Analyst»
    // mueve la aguja sin ver ni una de sus tareas.
    const proyectos: Array<{ id: string; nombre: string }> = [];
    // scoreActual: el guardián mantiene el score previo salvo razón concreta (estabilidad).
    //
    // ⚠️ EL `detalle` VA RECORTADO A 1500, igual que en `puntuarNuevas`. Sin el recorte este
    // payload medía 990.903 caracteres ≈ 275.000 tokens sobre el tablero real (550 tareas ×
    // detalle de hasta 6.000 chars, el 87% del total) — y el límite diario de una cuenta de
    // Gemini son 250.000. O sea: una sola corrida se comía el día entero, y como esta feature
    // tiene `fallback: []` la llamada no degradaba, FALLABA. Colgada de un setTimeout que
    // dispara con solo tener el board abierto y cambiar una tarea.
    const tareasIn = tasks.filter((t) => t.progress < 100).map((t) => ({ id: t.id, titulo: t.title, detalle: (t.detalle ?? '').slice(0, 1500), proyecto: board.labelById(t.labels[0])?.name ?? '', deadline: t.deadline, avance: t.progress, origen: t.origen, scoreActual: t.score }));
    if (tareasIn.length < 2) { repriorizando.current = false; return; }
    try {
      const j = await fetch('/api/mako-guardian', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proyectos, tareas: tareasIn }) }).then((r) => r.json());
      // `ok:true` con listas vacías NO es éxito: es el Perro que no pudo puntuar (se le
      // cortó la respuesta). Marcar esa firma como "ya corrida" la quemaba para toda la
      // sesión: el foco y las prioridades se quedaban clavados y nadie se enteraba —
      // exactamente lo que se veía como "las 3 prioridades no se actualizan solas".
      const hubo = (j.tareas?.length ?? 0) + (j.proyectos?.length ?? 0) > 0;
      if (j.ok && hubo) {
        board.applyGuardian(j.tareas || [], j.proyectos || []);
        showUsage(j.usage, 're-priorización del plan');
        lastReprioSig.current = sigNow; // recién ACÁ se da por atendida
      } else {
        console.error('[board] el Perro no devolvió prioridades:', j.error ?? '(sin error explícito)');
      }
    } catch (e) { console.error('[board] falló la re-priorización:', e instanceof Error ? e.message : String(e)); }
    repriorizando.current = false;
  };
  // Re-priorización: SOLO cuando el plan cambia DE VERDAD MIENTRAS lo usás (agregar/
  // borrar/completar una tarea, o cambiar un proyecto). NUNCA al entrar a la tab ni al
  // refrescar (feedback: no debe correr en cada refresh). Para eso guardamos la firma
  // de ARRANQUE como línea base en un ref (por sesión): la primera firma con la que
  // hidrata el board NO dispara nada; solo disparan las divergencias posteriores.
  const planSig = planSignature();
  const baseSig = useRef<string | null>(null);
  // Cuando la ruta de reunión/archivo del DUEÑO puntúa server-side (repo.priorizarNuevas),
  // suprimimos el re-scoreo client-side de ese cambio para no correr el Perro dos veces.
  const skipRePrio = useRef(false);
  useEffect(() => {
    if (tasks.length < 2 || !planSig) return;
    // primer render con datos → fijamos la línea base y NO corremos (es "entrar a la tab").
    if (baseSig.current === null) { baseSig.current = planSig; return; }
    if (planSig === baseSig.current) return; // sin cambios estructurales reales
    const id = setTimeout(() => { baseSig.current = planSig; if (skipRePrio.current) return; void rePriorizar(planSig); }, 2500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planSig]);
  // PUNTO 4: las tareas que carga MaKo (WhatsApp/Fathom) las puntúa el Perro Guardián
  // SERVER-SIDE al crearlas (ver priorizarNuevasOwner) → llegan ya con score + razón. Este
  // disparador queda solo como FALLBACK: si alguna tarea nueva NO tiene razón (el server no
  // llegó a puntuarla), corremos la re-priorización client-side una vez. Si ya están
  // puntuadas, NO re-puntuamos todo el plan (era caro y redundante).
  useEffect(() => {
    if (guardianNuevasRef.current || !hayWelcome) return;
    guardianNuevasRef.current = true;
    if (!welcomeTasks.some((t) => !t.scoreRazon)) return; // ya las puntuó el server
    // Igual que el disparador de arriba: si el Perro SERVER-SIDE está corriendo sobre
    // estas mismas tareas, no lo pisamos con una corrida client-side (puntuaba dos veces
    // y la segunda le ganaba a la del server).
    const id = setTimeout(() => { if (skipRePrio.current) return; void rePriorizar(); }, 1500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayWelcome]);
  const passes = (t: BoardTask) => (idsIA ? idsIA.has(t.id) : (!q || matchTarea(t, q, campos))) && (fLabels.size === 0 || t.labels.some((l) => fLabels.has(l))) && (fOrigen.size === 0 || fOrigen.has(fuenteEfectiva(t).tipo)) && (fCuando.size === 0 || fCuando.has(cuandoDe(t, hoyISO()))) && pasaEstado(t.progress, doneFilter);
  const visibles = tasks.filter(passes);
  // ── El header: SIEMPRE PLEGADO ───────────────────────────────────────────────
  //
  // Acá vivían ~90 líneas que medían el header para decidir si plegar los botones, y se
  // reescribieron TRES veces en dos días. Las tres fallaron con el zoom puesto, y la tercera
  // —la de `anchoNatural`, que era correcta como medición— falló igual. El pedido, textual
  // (23/09/2026): «se sigue bugeando cuando tiene zoom, y se pone en doble línea. Haz que
  // todo se colapse independientemente del zoom que tenga, así evitamos esto. Que siempre
  // esté colapsado».
  //
  // ⚠️ LA LECCIÓN ES LA MEDICIÓN, NO LA FÓRMULA. Un layout que se decide midiéndose a sí
  // mismo tiene que acertar en TODAS las combinaciones de ancho, zoom, tipografía cargada o
  // no, cantidad de botones (que cambia sola: ⚠ y ✦ aparecen y desaparecen) y vista abierta.
  // Cada arreglo tapaba un caso y destapaba otro, y el modo de falla es el peor posible: los
  // botones bajan a un segundo renglón pegado al borde izquierdo, que se lee como una
  // pantalla rota. Plegado siempre no tiene ningún caso: es UN renglón, con cualquier zoom,
  // en cualquier pantalla.
  //
  // Lo que se pierde es la palabra «Plan» y el chip de progreso en el header — y el progreso
  // NO se pierde: viaja arriba de todo en el menú, que es donde ya iba cuando se plegaba.
  const compacto = true;
  // `?diag=1`: el tablero contando qué está viendo, en el navegador de quien lo reporta.
  const [diag, setDiag] = useState(false);
  useEffect(() => { try { setDiag(new URLSearchParams(window.location.search).get('diag') === '1'); } catch { /* no-op */ } }, []);

  const avg = tasks.length ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length) : 0;
  const hechas = tasks.filter((t) => t.progress >= 100).length;
  // "En prioridad" = AUTOMÁTICO: las 3 tareas de mayor score del Objetivo Principal
  // (no lo elige el usuario). NUNCA se queda corta: si al proyecto top le quedan menos
  // de 3 pendientes, se completa con lo mejor del resto del plan (por score del
  // proyecto y después por score de la tarea). Antes, con el norte al 86%, la vista
  // mostraba UNA sola tarjeta y el resto del plan quedaba invisible: el tablero decía
  // "no hay nada más que hacer" con 20 tareas abiertas.
  const scoreProy = (t: BoardTask) => Math.max(0, ...t.labels.map((id) => board.labelById(id)?.score ?? 0));
  // ⚠️ Prioridades responde «¿qué hago AHORA?», así que lo BLOQUEADO no entra. No es que
  // valga menos —su score no se toca, y en el Kanban sigue donde estaba—: es que hoy no se
  // puede empezar, y una lista de «hacé esto» con cosas que no se pueden hacer es peor que
  // una lista corta. Lo que sí sube es lo que las DESTRABA, por la urgencia heredada.
  const pendientesTodas = tasks.filter((t) => t.progress < 100 && !estaBloqueada(t.id, estDeps));
  const delTop = topProjectId ? pendientesTodas.filter((t) => t.labels.includes(topProjectId)) : [];
  const resto = pendientesTodas
    .filter((t) => !topProjectId || !t.labels.includes(topProjectId))
    .sort((a, b) => scoreProy(b) - scoreProy(a) || (estDeps.urgencia[b.id] ?? b.score) - (estDeps.urgencia[a.id] ?? a.score));
  const enPrio = [...delTop.sort((a, b) => (estDeps.urgencia[b.id] ?? b.score) - (estDeps.urgencia[a.id] ?? a.score)), ...resto].slice(0, MAX_PRIORIDAD);
  const bloqueadasN = tasks.filter((t) => t.progress < 100 && estaBloqueada(t.id, estDeps)).length;
  const prioAvg = enPrio.length ? Math.round(enPrio.reduce((s, t) => s + t.progress, 0) / enPrio.length) : 0;
  // agregado de proyectos (para el chip del header en la vista Proyectos)
  const projAgg = labels.map((l) => projProgress(tasks, l.id));
  const projConTareas = projAgg.filter((p) => p.total > 0);
  const avgProj = projConTareas.length ? Math.round(projConTareas.reduce((s, p) => s + p.pct, 0) / projConTareas.length) : 0;
  const hechosProj = projAgg.filter((p) => p.total > 0 && p.done === p.total).length;

  // El avance de LA VISTA que se está mirando, en un solo lugar. Los tres chips del
  // header lo pintaban cada uno por su lado; cuando el header se pliega, este mismo dato
  // es el que viaja al menú — copiarlo allá era garantizar que uno de los dos mintiera.
  const progresoDeLaVista = view === 'tareas' ? { pct: avg, hechas, total: tasks.length, label: 'del plan' }
    : view === 'prioridades' ? { pct: prioAvg, hechas: enPrio.length, total: MAX_PRIORIDAD, label: 'en prioridad' }
      : view === 'proyectos' ? { pct: avgProj, hechas: hechosProj, total: labels.length, label: 'proyectos ✓' }
        : undefined;
  const openTask = tasks.find((t) => t.id === openId) ?? null;
  const debateTask = tasks.find((t) => t.id === debateId) ?? null;
  const soltadaItem = soltada
    ? (soltada.entidad === 'tarea'
        ? (() => { const t = tasks.find((x) => x.id === soltada.id); return t ? { titulo: t.title, score: t.score } : null; })()
        : (() => { const l = labels.find((x) => x.id === soltada.id); return l ? { titulo: l.name, score: l.score } : null; })())
    : null;
  const openProjLabel = labels.find((l) => l.id === openProj) ?? null;
  const peekProj = labels.find((l) => l.id === peekProjId) ?? null;

  // Deep-link (punto 9): ?tarea=<id> / ?proyecto=<id> abre ese detalle al entrar —
  // lo usa MaKo por WhatsApp para linkear lo que creó. Después limpia el query.
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const tId = sp.get('tarea'); const pId = sp.get('proyecto');
      // `?reunion=<recordingId>`: el link que manda MaKo por WhatsApp cuando leyó una
      // reunión. Abre EL BORRADOR DE ESA REUNIÓN —pendiente o ya cargado—, en vez de
      // dejarte parado en el tablero esperando que salte un modal que quizá no salta.
      const rId = Number(sp.get('reunion'));
      if (Number.isFinite(rId) && rId > 0) {
        // El cartel de carga sin título todavía: el nombre de la reunión lo trae la
        // respuesta, y hasta entonces dice «Abriendo lo que sacó MaKo…».
        setCargandoBorrador({ titulo: '', fecha: null, n: 0 });
        void fetch('/api/plan-propuesta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'por-reunion', recordingId: rId }) })
          .then((r) => r.json())
          .then((j) => { if (j?.ok && j.propuesta) setBorradorReunion(j.propuesta as PropuestaPendiente); })
          .catch(() => { /* si falla, queda el tablero: nunca una pantalla trabada */ })
          .finally(() => setCargandoBorrador(null));
      }
      if (tId && tasks.some((t) => t.id === tId)) setOpenId(tId);
      else if (pId && labels.some((l) => l.id === pId)) setOpenProj(pId);
      // ⚠️ SOLO SE LIMPIA `?reunion=`. `?tarea=` y `?proyecto=` YA NO: dejaron de ser un
      // link de una sola vez y pasaron a ser el ESTADO de la pantalla — si se borran, un
      // refresh te deja el tablero pelado aunque tuvieras una tarjeta abierta. `reunion` sí
      // se limpia porque es un EVENTO (abrir un borrador), no un estado que sobreviva.
      if (sp.get('reunion')) { sp.delete('reunion'); const qs = sp.toString(); window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '')); }
    } catch { /* no-op */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── LA URL ES EL ESTADO DE LA PANTALLA ───────────────────────────────────────
  // Antes el board arrancaba SIEMPRE en Prioridades y el deep-link se borraba apenas abría
  // el modal: refrescar te devolvía a otra tab, sin la tarjeta que estabas mirando. Con esto
  // el link que copiás es la pantalla que estás viendo, y F5 no te mueve de lugar.
  //
  // No usa `push` para no llenar el historial: el Atrás tiene que sacarte del tablero, no
  // recorrer las cuatro tabs que miraste.
  //
  // ⚠️ Y VA CON `history.replaceState`, NO con `router.replace`, apartándose de la
  // convención de tabs de AGENTS.md — con el motivo escrito: `router.replace` sobre la misma
  // ruta con otro query ES una navegación, y esta página es `force-dynamic`, así que Next
  // vuelve a pedir el RSC. Serían 550 tareas y 71 proyectos por cada click en una tab. Acá
  // la URL no es un destino: es un marcador para el próximo F5.
  //
  // El `?ws=` se conserva solo porque se parte de `window.location.search`, que ya lo trae.
  // La query NO se arma de cero, justamente por eso: armarla de cero es como se pierde la
  // pestaña del cliente y terminás mirando otra cuenta.
  const urlEstado = `${view}|${openId ?? ''}|${openProj ?? ''}`;
  const urlPrev = useRef<string | null>(null);
  useEffect(() => {
    if (urlPrev.current === urlEstado) return;
    const primera = urlPrev.current === null;
    urlPrev.current = urlEstado;
    // El primer render solo fija la línea base: escribir en el montaje pisaría el `?tarea=`
    // con el que acabás de entrar, justo antes de que el efecto de deep-link lo lea.
    if (primera) return;
    try {
      const sp = new URLSearchParams(window.location.search);
      // «prioridades» es el default: no se escribe, para que la URL limpia siga andando.
      if (view === 'prioridades') sp.delete('vista'); else sp.set('vista', view);
      if (openId) sp.set('tarea', openId); else sp.delete('tarea');
      if (openProj) sp.set('proyecto', openProj); else sp.delete('proyecto');
      const qs = sp.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
    } catch { /* sin URL no se pierde nada: el estado vive en React igual */ }
  }, [urlEstado, view, openId, openProj]);

  const eliminarTask = tasks.find((t) => t.id === eliminarTaskId) ?? null;
  const eliminarProj = labels.find((l) => l.id === eliminarProjId) ?? null;
  const asignarTask = tasks.find((t) => t.id === asignarTaskId) ?? null;
  const debateProj = labels.find((l) => l.id === debateProjId) ?? null;
  const makoProj = labels.find((l) => l.id === makoProjId) ?? null;
  /**
   * Después de una cascada se RECARGA, no se parchea.
   *
   * La escritura la hizo el server sobre decenas de filas por id; el estado del navegador
   * quedó viejo en todas ellas. Reconstruirlo a mano acá sería mantener una segunda copia
   * de la misma decisión —y la que se quedaría vieja es la que se ve—. Recargar es barato
   * y honesto, y desde que la vista, el proyecto y la tarea abiertos viajan en la URL, se
   * vuelve exactamente a la misma pantalla.
   */
  const recargarTrasCascada = () => window.location.reload();
  /**
   * Crear un proyecto. El Perro lo PUNTÚA después, no la persona al crearlo.
   *
   * El alta preguntaba la prioridad con un slider del 1 al 100 —comparando contra los 70 que
   * ya hay— y ésa era la mitad de la fricción del wizard. Ahora nace en 50 y la corrida que
   * ya existe (`priorizarNuevas` con `proyectoIds`) le pone score, razón, emoji y detalle,
   * exactamente igual que a un proyecto que abre una reunión. Corre en segundo plano: crear
   * no espera a un modelo.
   */
  const crearProyecto = async (nombre: string, emoji: string, detalle: string, score = 50) => {
    const l = await board.createLabel({ id: uid(), emoji: emoji || '🏷', name: nombre, color: SWATCHES[labels.length % SWATCHES.length], score, detalle, historial: [] });
    // El detalle se abre EN EL ACTO, como con una tarea: lo que se acaba de crear es lo que
    // se quiere mirar, y además es donde se ve trabajar al Perro.
    if (l?.id) setOpenProj(l.id);
    if (board.repo?.priorizarNuevas && l?.id) {
      marcarTrabajando([l.id], true);
      void (async () => {
        try {
          const r = await board.repo!.priorizarNuevas!([], [l.id], 'Proyecto nuevo creado a mano desde el tablero.');
          if (r) board.aplicarPerroServer(r.patches, r.proyectosPatch);
        } catch (e) { console.warn('[alta proyecto] priorizarNuevas', e); }
        finally { marcarTrabajando([l.id], false); }
      })();
    }
    return l;
  };
  // resumen del plan para que el guardián compare al debatir/crear
  const planResumen = tasks.filter((t) => t.progress < 100).map((t) => `- [${t.score}] ${t.title} (${board.labelById(t.labels[0])?.name ?? 'sin proyecto'})`).join('\n');

  // crear una tarea: el usuario propone proyecto(s) + prioridad; el GUARDIÁN la puntúa
  // (arrancando de la sugerencia del usuario) y decide su columna final (#10).
  const crearConGuardian = async (d: { title: string; detalle: string; labelIds: string[]; userScore: number; motivoNinguno: string; nuevoProyecto: string; nuevoProyEmoji: string; argumento: string; deadline: string; fijarPrioridad: boolean }) => {
    let labelIds = d.labelIds;
    const proyIds: string[] = [];
    // Si el usuario dijo que el proyecto todavía no existe, lo creamos inline. Nace en 50
    // (la escala es 1-100; el 5 viejo lo dejaba último siempre) y con alta en el historial,
    // igual que un proyecto creado desde WhatsApp.
    if (d.nuevoProyecto.trim()) {
      // Se ESPERA el id canónico del server: con el temporal (`uid()`, alfanumérico) la
      // tarea nacía sin proyecto, porque el board del cliente convierte los ids a número
      // y descarta los NaN. Era la causa de las tareas huérfanas.
      const canon = await board.createLabel({ id: uid(), emoji: d.nuevoProyEmoji || '🏷', name: d.nuevoProyecto.trim(), color: SWATCHES[labels.length % SWATCHES.length], score: 50, detalle: '', historial: [{ id: uid(), ts: Date.now(), actor: 'user', text: 'Creó el proyecto — alta manual' }] });
      labelIds = [canon.id];
      proyIds.push(canon.id);
    }
    const starter = d.userScore || 50;
    const t = await board.create(d.title, prioFromScore(starter), labelIds.length ? labelIds : undefined, { detalle: d.detalle });
    if (!t) return null;
    // La FECHA que puso la persona, antes que nada: el Perro propone una solo si no hay.
    if (d.deadline) board.setDeadline(t.id, d.deadline, '');
    // ⚠️ Y SI LA PRIORIDAD LA PUSO ELLA, SE FIJA ANTES DE LLAMAR AL PERRO. «Si el usuario
    // ya puso la prioridad, el Perro no la pisa»: el que la respeta es
    // `priorizarNuevasOwner`, que mira `score_manual` — o sea que el candado tiene que
    // estar puesto cuando la corrida lee la fila, no después.
    if (d.fijarPrioridad && board.repo.prioridadManual) {
      try {
        const r = await board.repo.prioridadManual('tarea', t.id, starter);
        board.aplicarCascadaManual('tarea', { id: t.id, score: r.score, razon: 'Prioridad fijada a mano', texto: `La creaste con prioridad ${r.score}` }, r.movidos);
      } catch (e) { console.warn('[alta] fijar prioridad', e); }
    }
    // Los HECHOS que aportó el usuario (no su número: la prioridad la decide el Perro).
    const partes: string[] = [];
    if (d.argumento) partes.push(d.argumento);
    if (!labelIds.length && d.motivoNinguno) partes.push(`Sin proyecto: ${d.motivoNinguno}.`);
    // El número que movió el dueño en el slider viaja como SUGERENCIA declarada, no como
    // ancla: el Perro tiene que puntuarla contra la pirámide del plan y puede ignorarla
    // por completo. Decírselo explícito es lo que evita que la tome de punto de partida
    // — un modelo al que le mostrás un número tiende a quedarse cerca de ese número.
    partes.push(d.fijarPrioridad
      ? `(El dueño YA FIJÓ la prioridad en ${starter}/100 a mano: no la discutas ni la cambies. Escríbele la descripción y nada más.)`
      : `(El dueño SUGIRIÓ ${starter}/100 al crearla. Es una sugerencia, no un dato: puntúala tú contra el resto del plan y, si no se sostiene, corrígela sin problema.)`);
    const contexto = partes.join(' ');

    // UNIFICACIÓN: una tarea cargada a mano recibe EXACTAMENTE el mismo trato que una de
    // WhatsApp o de una reunión → el Perro server-side, que la ancla contra la pirámide del
    // plan (no contra el número que propuso el usuario), le arma la checklist y le describe
    // el proyecto nuevo. El debate 1-a-1 quedaba de rubber-stamp: su veredicto más duro
    // ("rechaza") dejaba la tarea justo donde el usuario la había puesto.
    if (board.repo?.priorizarNuevas) {
      // ⚠️ EL PERRO CORRE EN SEGUNDO PLANO, Y ESO ES EL CAMBIO. Antes el modal se quedaba
      // en «El Perro Guardián está priorizando la tarea…» hasta que volvían TRES llamadas
      // a un modelo: entre 10 y 20 segundos mirando un cartel para cargar una línea. Se
      // crea, se cierra, y cuando el Perro contesta el tablero se actualiza solo.
      skipRePrio.current = true;
      marcarTrabajando([t.id, ...proyIds], true);
      void (async () => {
        try {
          const r = await board.repo!.priorizarNuevas!([t.id], proyIds, contexto || '(sin argumento del usuario: puntúala por impacto objetivo contra el resto del plan)');
          if (r) board.aplicarPerroServer(r.patches, r.proyectosPatch);
        } catch (e) { console.warn('[alta] priorizarNuevas', e); }
        finally {
          marcarTrabajando([t.id, ...proyIds], false);
          setTimeout(() => { skipRePrio.current = false; }, 3500);
        }
      })();
      return { id: t.id, score: t.score, razon: '', respuesta: '', prio: displayPrio(t, topProjectId) };
    } else {
      // Board del cliente (sin Perro server-side): debate client-side, como antes.
      const argFinal = contexto || '(sin argumento: puntúalo por impacto objetivo comparándolo con el resto del plan)';
      try {
        const j = await fetch('/api/mako-guardian', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'debatir', tarea: d.title + (d.detalle ? `\n\n${d.detalle}` : ''), scoreActual: starter, argumento: argFinal, plan: planResumen, uso: 'Nueva tarea' }) }).then((r) => r.json());
        if (j.ok && typeof j.score === 'number') {
          board.setScore(t.id, j.score, `Priorizada al crear · score ${j.score}`, 'ia', j.razon);
          showUsage(j.usage, 'nueva tarea');
          return { id: t.id, score: j.score, razon: j.razon ?? '', respuesta: j.respuesta ?? '', prio: displayPrio({ ...t, score: j.score }, topProjectId) };
        }
      } catch { /* fallback abajo */ }
    }
    // Sin veredicto: devolvemos el score REAL con el que quedó la fila (antes se mostraba
    // el número que había tipeado el usuario, que no era el guardado).
    return { id: t.id, score: t.score, razon: '', respuesta: 'No pude priorizar ahora; quedó con una prioridad provisoria. Puedes debatirla después.', prio: displayPrio(t, topProjectId) };
  };

  // G3: crear en lote las tareas que MaKo sacó de una reunión. Entran con la prioridad
  // sugerida; al cambiar la firma del plan, el guardián las re-puntúa solo (una corrida).
  // Deshacer = borrar las que se acaban de crear (fue una acción revisada, no un click suelto).
  type CandReunion = { titulo: string; detalle: string; prioridad: Prio; proyectoId: string | null; proyectoNombre?: string; minuto?: number; minutos?: number[] };
  /**
   * Las que YA estaban: en vez de crear una segunda tarjeta igual, se le SUMA a la que
   * existe el contexto que trajo esta reunión (detalle + los pasos que dijo). Es lo
   * que faltaba para poder cargar reuniones en serie: el mismo tema se habla en tres
   * llamadas y antes la segunda y la tercera se descartaban enteras — con sus números
   * y sus frases textuales adentro.
   */
  const ampliarDesdeReunion = async (items: Array<{ id: string; detalle: string; titulo: string }>, fuente?: Fuente) => {
    const utiles = items.filter((it) => it.id && it.detalle.trim());
    if (!utiles.length || !board.repo?.ampliarTareas) return;
    try {
      const patches = await board.repo.ampliarTareas(utiles.map(({ id, detalle }) => ({ id, detalle })), fuente);
      if (patches.length) board.aplicarPerroServer(patches);
      const n = patches.length;
      if (n) board.showUndo(`${n === 1 ? 'Le sumé' : `Les sumé a ${n}`} el contexto de la reunión a ${n === 1 ? 'la tarjeta que ya estaba' : 'las tarjetas que ya estaban'}`);
      else board.showUndo('Esas tareas ya tenían este contexto: no cambié nada.');
    } catch (e) { console.warn('[reunion] ampliarTareas', e); }
  };

  const crearDesdeReunion = async (candsIn: CandReunion[], fuente?: Fuente) => {
    // ÚLTIMA RED contra el duplicado, y ahora sin salidas: lo que ya está en el tablero
    // NO se vuelve a crear NUNCA — se le suma el contexto a la tarjeta que existe.
    // Antes acá había un «Deshacer» que la creaba igual (forzar=true): esa era la puerta
    // por la que entraban los duplicados que después había que fundir a mano.
    const enTablero = tasks.map((t) => ({ id: t.id, titulo: t.title, hecha: t.progress >= 100 }));
    const { nuevas, repetidas } = separarRepetidas(candsIn, enTablero);
    const cands = nuevas;
    // Las repetidas se amplían SIEMPRE (tengan o no tarea que crear al lado): el
    // contexto de esta reunión —los números y las frases que se dijeron— entra igual.
    const ampliables = repetidas
      .filter((r) => r.existente.id && (r.tarea.detalle ?? '').trim())
      .map((r) => ({ id: r.existente.id, detalle: (r.tarea.detalle ?? '').trim(), titulo: r.tarea.titulo }));
    if (ampliables.length) await ampliarDesdeReunion(ampliables, fuente);
    if (!cands.length) {
      // Nada nuevo que crear. Si tampoco se pudo ampliar (repetidas dentro del mismo
      // lote, que no traen id), al menos se dice — antes esto salía sin una palabra.
      if (repetidas.length && !ampliables.length) board.showUndo(`${textoRepetidas(repetidas.length)}: no las dupliqué.`);
      return;
    }
    // origen = MaKo (la IA extrajo estas tarjetas) + fuente (Fathom/archivo) + un alta
    // que deja rastro de DE DÓNDE salió (feedback jul-19 / regla del historial).
    const altaText = fuente?.tipo === 'fathom' ? `Creó la tarjeta — de la reunión «${fuente.etiqueta ?? ''}» (Fathom)`
      : fuente?.tipo === 'archivo' ? `Creó la tarjeta — del archivo «${fuente.etiqueta ?? ''}»`
        : undefined;
    // Si el board del dueño puede correr el Perro server-side, lo hace ÉL (mismo trato
    // que WhatsApp) y suprimimos el re-scoreo client-side para no puntuar dos veces.
    const usaServerPerro = !!board.repo?.priorizarNuevas;
    if (usaServerPerro) skipRePrio.current = true;
    // El MINUTO en que se dijo, por tarjeta: el mismo chip que traen las que vienen del
    // borrador. Sin esto, las creadas por el botón manual nacían sin forma de volver al
    // momento de la grabación — dos tarjetas de la misma reunión, una con contexto y la
    // otra no, conviviendo en la misma pantalla.
    const reloj = (seg: number): string => (seg >= 3600
      ? `${Math.floor(seg / 3600)}:${String(Math.floor((seg % 3600) / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`
      : `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`);
    const fuenteDe = (c: { minuto?: number; minutos?: number[] }): Fuente | undefined => {
      if (!fuente) return undefined;
      const todos = c.minutos?.length ? c.minutos : (c.minuto != null ? [c.minuto] : []);
      if (!todos.length) return fuente;
      const url = fuente.url ? `${fuente.url}${fuente.url.includes('?') ? '&' : '?'}timestamp=${todos[0]}` : undefined;
      return { ...fuente, etiqueta: [fuente.etiqueta, todos.map(reloj).join(', ')].filter(Boolean).join(' · '), url };
    };
    // Proyectos que la reunión pidió y que NO existen: se crean UNA vez y todas sus
    // tareas cuelgan de ahí. Antes el modelo no podía proponerlos (o elegía de la
    // lista, o null), así que un tema nuevo se repartía entre proyectos que no le
    // correspondían — o caía entero en el primero.
    const nuevosProy = new Map<string, string>(); // nombre normalizado → id creado
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    // `cat:<nombre>` = un proyecto DEL CATÁLOGO que todavía no está en el tablero. Se
    // pasa a proyectoNombre para que siga UN solo camino de creación, y así el nombre
    // y el emoji salen del catálogo y no de lo que se le ocurrió al modelo.
    const delCat = (n: string) => repo.catalogo?.find((c) => norm(c.nombre) === norm(n));
    for (const c of cands) {
      if (c.proyectoId?.startsWith('cat:')) { c.proyectoNombre = c.proyectoId.slice(4); c.proyectoId = null; }
    }
    for (const c of cands) {
      const nom = (c.proyectoNombre ?? '').trim();
      if (!nom || c.proyectoId || nuevosProy.has(norm(nom))) continue;
      const yaEsta = labels.find((l) => norm(l.name) === norm(nom));
      if (yaEsta) { nuevosProy.set(norm(nom), yaEsta.id); continue; }
      // El id que vale es el CANÓNICO (el del server). Guardar el temporal acá era lo
      // que dejaba las tareas de ese proyecto sin proyecto: viajaban con un id que
      // `Number()` vuelve NaN y el board lo filtra sin decir nada.
      const cat = delCat(nom);
      const canon = await board.createLabel({
        id: uid(), emoji: cat?.emoji ?? '🏷', name: cat?.nombre ?? nom, color: SWATCHES[(labels.length + nuevosProy.size) % SWATCHES.length],
        score: 50, detalle: cat?.que ?? '', historial: [{ id: uid(), ts: Date.now(), actor: 'ia', text: `Creó el proyecto — de la reunión «${fuente?.etiqueta ?? ''}»` }],
      });
      nuevosProy.set(norm(nom), canon.id);
    }

    const ids: string[] = [];
    for (const c of cands) {
      // el detalle va DENTRO del alta: si se escribiera después, el Perro server-side
      // podría leer la fila antes de que llegue y puntuar solo con el título.
      // `[]` explícito, NO undefined: si la IA no le encontró proyecto, la tarea queda
      // suelta y se ve como tal. Con undefined heredaba el primer proyecto del tablero.
      const proy = c.proyectoId ?? (c.proyectoNombre ? nuevosProy.get(norm(c.proyectoNombre)) ?? null : null);
      const t = await board.create(c.titulo, c.prioridad, proy ? [proy] : [], { origen: 'ia', fuente: fuenteDe(c), altaText, detalle: c.detalle });
      if (!t) continue;
      ids.push(t.id);
    }
    if (ids.length) {
      const extra = repetidas.length ? ` · ${textoRepetidas(repetidas.length)}, no las dupliqué` : '';
      board.showUndo(`${ids.length} tarea${ids.length > 1 ? 's' : ''} de la reunión al plan${extra}`, () => ids.forEach((id) => board.removeSilent(id)));
    }
    // UNIFICACIÓN (#1): el Perro server-side puntúa/describe estas tareas nuevas y les arma
    // checklist, igual que las de WhatsApp — y con el MISMO contexto (de dónde salieron),
    // que antes no le pasábamos: puntuaba "(sin brief adicional)".
    if (usaServerPerro && ids.length) {
      const contexto = fuente?.tipo === 'fathom' ? `Salieron de la reunión «${fuente.etiqueta ?? ''}» (Fathom): son compromisos que se asumieron ahí.`
        : fuente?.tipo === 'archivo' ? `Salieron del archivo «${fuente.etiqueta ?? ''}» que subió el dueño.`
          : '';
      const proyIds = [...new Set(cands.map((c) => c.proyectoId).filter((x): x is string => !!x))];
      try {
        const r = await board.repo!.priorizarNuevas!(ids, proyIds, contexto);
        // Traer el veredicto a la pantalla. Sin esto la UI mostraba el score adivinado por
        // la extracción y el próximo guardado del board le pisaba encima al Perro.
        if (r) board.aplicarPerroServer(r.patches, r.proyectosPatch);
      } catch (e) { console.warn('[reunion] priorizarNuevas', e); skipRePrio.current = false; }
    }
    if (usaServerPerro) setTimeout(() => { skipRePrio.current = false; }, 3500);
  };

  return (
    // `100vh` MENOS la barra de agencia: mirando el tablero de un cliente, con `100vh` a
    // secas el board mide 50px más que el hueco que le queda —la barra empuja el body
    // (globals.css: `[data-barra-agencia] body{padding-top:…}`)— y se come la franja de
    // abajo del kanban. La sidebar ya lo compensaba; este `<main>` era el único que no.
    // La variable vale 0px cuando no hay barra, así que fuera del modo agencia no cambia.
    // ⚠️ ESTE LAYOUT NO PUEDE DEJAR EL TABLERO INVISIBLE, y eso es un requisito, no un
    // detalle: un cliente lo reportó tres veces como «el plan está vacío» desde Safari
    // mientras en Chrome se veía perfecto, con los mismos datos y el mismo servidor.
    //
    // Tres decisiones, y las tres son para lo mismo:
    //   · GRID con filas `auto 1fr` en vez de columna flex: la fila del cuerpo tiene un
    //     alto DEFINIDO que cualquier motor resuelve igual. Con flex, ese alto sale de
    //     `flex: 1` —indefinido para el modelo— y de ahí para abajo cada versión de cada
    //     navegador decide distinto qué hacer con un hijo que quiere estirar.
    //   · `minHeight` en vez de `height`: si algo mide de menos, el tablero CRECE. Con
    //     `height` clavado, todo lo que no entraba quedaba fuera de la caja.
    //   · El `var()` va CON fallback (`, 0px`): si el token no resolviera, un `calc()`
    //     con una variable vacía es inválido en tiempo de cómputo y se cae la
    //     declaración entera — o sea, el alto desaparece. El fallback lo hace imposible.
    //   · SIN `overflow: hidden` acá: era lo que convertía «midió mal» en «no se ve
    //     nada». Sin él, en el peor caso la página scrollea, que es un defecto que se
    //     entiende y se puede contar por teléfono.
    //
    // La regla, corta: en el camino del contenido principal, nada de altos fijos con
    // recorte. Un layout puede quedar feo; no puede desaparecer.
    <main style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateRows: 'auto 1fr', minHeight: 'calc(100vh - var(--barra-agencia, 0px))', fontFamily: SANS }}>
      {/* símbolos de marca (para el logo de Fathom del toolbar/modal) — una vez por página */}
      <BrandDefs />
      {/* UNA SOLA LÍNEA, siempre. Antes tenía flexWrap:'wrap' y los botones de acción se
          caían a un segundo renglón, que además quedaba pegado al borde izquierdo y no
          se leía como parte del header. Lo que hace que entre: nada crece de más
          (flex:'none' en cada control) y lo único elástico es el buscador, que se
          achica hasta 90px antes que empujar a nadie. */}
      {/* ⚠️ ENVUELVE, NO SE SALE. Achicando la ventana (o con el zoom al 150%, que para la
          página es lo mismo) llega un punto en que ni plegando los botones entra todo: el
          logo, las cuatro tabs y el buscador ya no caben en un renglón de 700px. Con
          `nowrap` eso se dibujaba UNO ENCIMA DEL OTRO —medido: 108px de desborde a 780 y
          148 a 740—. La regla de la casa para una barra de navegación es que baje de
          renglón, nunca que scrollee ni que se pise (AGENTS.md). */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, rowGap: 10, padding: '20px 30px 16px', flexWrap: 'wrap', minWidth: 0 }}>
        {/* logo (checklist) + Plan — mismo ícono que la sidebar (feedback #2) */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, flex: 'none' }}>
          <PlanIcon size={38} />
          {/* La PALABRA cede cuando no entra; el ícono no. Son ~110px que valen más como
              buscador que como rótulo de una pantalla en la que ya estás. */}
          {!compacto && <span style={{ fontSize: 40, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.025em', lineHeight: 1 }}>Plan</span>}
        </div>
        {/* tabs */}
        <div style={{ display: 'inline-flex', flex: 'none', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: 3 }}>
          {VISTAS.map((v) => (
            <button key={v} onClick={() => setView(v)} style={{ border: 'none', background: view === v ? 'var(--surface)' : 'transparent', color: view === v ? 'var(--ink)' : 'var(--dim)', fontWeight: view === v ? 600 : 500, fontSize: 13.5, padding: '7px 15px', borderRadius: 999, cursor: 'pointer', boxShadow: view === v ? '0 1px 2px rgba(18,21,27,.08)' : 'none', fontFamily: 'inherit', textTransform: 'capitalize' }}>{v === 'proyectos' ? repo.labelPlural : v}</button>
          ))}
        </div>
        {/* De acá a la derecha. DOS grupos, y el orden importa:
            · el VARIABLE (progreso + buscar + filtrar) cambia según la vista;
            · el FIJO (avisos, MaKo, Fathom, subir, exportar) va SIEMPRE último y en el
              mismo orden, así ningún botón se te mueve de lugar al cambiar de tab.
            Antes estaban todos mezclados: al pasar de Kanban a Prioridades desaparecían
            el buscador y el filtro y los cuatro botones saltaban 250px a la izquierda. */}
        {/* El hueco elástico. Además de empujar, es el METRO: lo que mida acá es el
            lugar que hay para volver a desplegar los botones. */}
        {/* El hueco elástico: empuja el grupo de la derecha contra el borde. Tenía un ref
            porque era el METRO de la medición del header; esa medición ya no existe. */}
        <span style={{ flex: 1 }} />
        {/* El grupo VARIABLE (progreso + buscador + filtro). Lleva marca porque es el que
            se achica: el header entero puede entrar perfecto y ser ESTE el que se queda
            sin lugar — su contenido se sale y se dibuja encima de los botones. */}
        <div data-grupo-vista style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {/* El progreso es un DATO, no un control: cuando no entra todo, es lo primero que
            cede el lugar (los botones hacen algo; este solo informa). */}
        {!compacto && view === 'tareas' && <AvgChip avg={avg} hechas={hechas} total={tasks.length} label="del plan" />}
        {!compacto && view === 'prioridades' && <AvgChip avg={prioAvg} hechas={enPrio.length} total={MAX_PRIORIDAD} label="en prioridad" />}
        {!compacto && view === 'proyectos' && <AvgChip avg={avgProj} hechas={hechosProj} total={labels.length} label="proyectos ✓" />}
        {(view === 'tareas' || view === 'proyectos') && <>
          <BuscadorTareas
            q={q} onQ={setQ}
            campos={campos} onCampos={setCampos}
            ia={ia}
            onBuscarIA={buscarConIA}
            onLimpiarIA={() => setIa({ pensando: false, ids: null, explico: '' })}
          />
          <VistaToggle tabla={tabla} onSet={setTabla} />
          {view === 'tareas'
            ? <FilterMenu soloIcono={compacto} labels={labels} fLabels={fLabels} setFLabels={setFLabels} doneFilter={doneFilter} setDoneFilter={setDoneFilter} fOrigen={fOrigen} setFOrigen={setFOrigen} fCuando={fCuando} setFCuando={setFCuando} sortMode={sortMode} setSortMode={setSortMode} sortDir={sortDir} setSortDir={setSortDir} />
            : <FilterMenu soloIcono={compacto} doneFilter={doneFilter} setDoneFilter={setDoneFilter} estadoLabels={[['all', 'Todos'], ['activas', 'Activos'], ['comenzadas', 'Comenzados'], ['hechas', 'Completados']]} fOrigen={fOrigen} setFOrigen={setFOrigen} sortMode={sortMode} setSortMode={setSortMode} sortDir={sortDir} setSortDir={setSortDir} />}
        </>}
        </div>
        {/* Los botones de acción, PLEGABLES: cuando no entran se esconden detrás de un
            «+» que los despliega al costado. Antes se dibujaban encima de «Filtrar». */}
        {/* El progreso NO se pierde al plegarse: viaja al menú, arriba de todo. Un dato
            que desaparece porque no hay lugar es esconder sin pista. */}
        <BarraAcciones compacto={compacto} progreso={progresoDeLaVista} acciones={[
          /* ⚠ en TODAS las vistas (no solo kanban): es la ÚNICA puerta al modal, que ya no se
             abre solo (08-T46). Avisa con el NÚMERO, como el ✨ de al lado, y no titila: un
             ícono que late en cada entrada es el mismo «picarle» con otra forma. */
          ...(faltantes.length > 0 ? [{ key: 'datos', nodo: (
          <button type="button" onClick={abrirDatosManual} title={`${faltantes.length} tarea${faltantes.length === 1 ? '' : 's'} sin fecha`} aria-label="Tareas sin fecha"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', cursor: 'pointer', flex: 'none', padding: '0 11px' }}>
            <WarnMark title="" size={16} blink={false} />
            <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: 'var(--dim)' }}>{faltantes.length}</span>
          </button>
          ), menu: { icono: <WarnMark title="" size={15} blink={false} />, label: 'Tareas sin fecha', badge: faltantes.length,
            desc: 'Las tareas a las que les falta la fecha', onClick: abrirDatosManual } }] : []),
          ...(hayWelcome ? [{ key: 'welcome', nodo: (
          <button type="button" onClick={() => setWelcomeVisible(true)} title={`${welcomeTasks.length} tarea${welcomeTasks.length === 1 ? '' : 's'} que cargó MaKo — ver`} aria-label="Tareas que cargó MaKo"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, borderRadius: 9, border: '1px solid var(--primary-weak)', background: 'var(--surface)', cursor: 'pointer', flex: 'none', padding: '0 11px' }}>
            <MakoStar size={15} color="var(--primary)" />
            <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{welcomeTasks.length}</span>
          </button>
          ), menu: { icono: <MakoStar size={15} color="currentColor" />, label: 'Lo que cargó MaKo', badge: welcomeTasks.length,
            desc: 'Las tareas que entraron solas, para revisarlas', onClick: () => setWelcomeVisible(true) } }] : []),
          ...(repo.fathomExtract ? [{ key: 'fathom', nodo: (<>
          {/* El botón ES el logo de Fathom (feedback jul-18): sin contenedor blanco. Mismo 38×38 que el de subir. */}
          {/* Con borradores esperando, este botón ABRE ESOS BORRADORES (y late para que
              se vea que hay algo). El selector de reuniones de siempre vuelve recién
              cuando no queda nada pendiente: o las cargaste, o las descartaste. Antes,
              cerrar el modal era perderlo de vista sin forma de volver. */}
          {/* El badge cuenta TODO lo que espera (tuyo + de otros). El latido queda solo
              para lo tuyo: lo ajeno se ve, pero no te apura. */}
          {/* SIEMPRE abre el selector de reuniones. Antes, si había un borrador
              esperando, el botón te devolvía a ese borrador y no había forma de llegar
              a la lista: con tareas pendientes quedabas encerrado en ellas, sin poder
              mirar el resto de tus reuniones. El badge ya avisa cuántas esperan, y en
              la lista cada reunión muestra las suyas: no hace falta bloquear nada. */}
          <button type="button" onClick={() => { setReunionArchivo(null); setExtraerReunion(true); }}
            aria-label={nPendientes + nDeOtros > 0 ? `Tus reuniones — ${pendientes.length} borrador(es) esperando` : 'Tus reuniones de Fathom'}
            title={nPendientes > 0 ? `Tus reuniones — ${nPendientes} tarea${nPendientes === 1 ? '' : 's'} esperando que las confirmes${nDeOtros ? ` (y ${nDeOtros} de otras personas para repartir)` : ''}`
              : nDeOtros > 0 ? `Tus reuniones — quedan ${nDeOtros} tarea${nDeOtros === 1 ? '' : 's'} de otras personas para repartir`
              : 'Extraer tareas de una reunión de Fathom (MaKo lee la transcripción)'}
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', flex: 'none', padding: 0, lineHeight: 0, borderRadius: 9, transition: 'opacity .12s', animation: nPendientes > 0 ? 'makoLatido 1.6s ease-in-out infinite' : undefined }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.82'; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}>
            <SvcIcon k="fathom" size={22} box={38} radius={9} />
            {nPendientes + nDeOtros > 0 && (
              <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 999, background: nPendientes > 0 ? 'var(--primary)' : 'var(--dim)', color: '#fff', fontFamily: MONO, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{nPendientes + nDeOtros}</span>
            )}
          </button>
          {nPendientes > 0 && <style>{'@keyframes makoLatido{0%,100%{transform:scale(1);filter:drop-shadow(0 0 0 rgba(47,111,237,0))}50%{transform:scale(1.09);filter:drop-shadow(0 0 6px rgba(47,111,237,.65))}}'}</style>}
          </>), menu: { icono: <SvcIcon k="fathom" size={15} box={20} radius={5} />, label: 'Tus reuniones', badge: nPendientes + nDeOtros,
            desc: 'MaKo lee la grabación y saca los compromisos', onClick: () => { setReunionArchivo(null); setExtraerReunion(true); } } },
          { key: 'importar', nodo: (<>          {/* Abre la BANDEJA, no el buscador de archivos del sistema. Elegir el
              archivo es el paso 2, no el 1: así se ve qué se está por mandar, entran
              varios y el que falla dice por qué sin llevarse a los otros. */}
          <button type="button" aria-label="Importar archivos al plan" title="Importar: notas, transcripciones, PDFs, capturas o audios — MaKo saca las tareas"
            onClick={() => setImportar(true)}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', cursor: 'pointer', flex: 'none', color: 'var(--dim)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--dim)'; }}>
            <UploadIcon />
          </button>
          </>), menu: { icono: <UploadIcon />, label: 'Importar archivos',
            desc: 'Notas, transcripciones, PDFs, capturas o audios', onClick: () => setImportar(true) } }] : []),
          /* Bajarse el tablero. Sale del estado que ya está en memoria, así que anda
             igual en el tablero del dueño que en el del cliente, y baja al instante. */
          { key: 'exportar', nodo: <ExportarBoton onAbrir={() => setExportar(true)} />,
            menu: { icono: <DescargarIcon />, label: 'Exportar el tablero',
              desc: 'Baja las tareas y los proyectos a un archivo', onClick: () => setExportar(true) } },
        ]} />

      </header>

      {/* ⚠️ COLUMNA FLEX, no un bloque a secas. Las vistas colgaban de acá con
          `height: 100%`, y eso en SAFARI da CERO: su padre saca el alto de `flex: 1`,
          que para el motor es un alto INDEFINIDO, así que el porcentaje no resuelve
          (Chrome sí lo resuelve, y por eso pasó meses sin verse). Con el `overflow:
          hidden` de acá, cero de alto es una PANTALLA EN BLANCO: header dibujado y
          debajo nada. Se reportó tres veces como «el plan está vacío» desde una Mac.
          El patrón que sí funciona en los dos: el padre es columna y el hijo estira
          con `flex: 1` + `minHeight: 0`. Ninguna vista vuelve a pedir `height: 100%`. */}
      <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {view === 'prioridades' && <Prioridades tasks={enPrio} board={board} objetivo={objetivoPrincipal} bloqueadas={bloqueadasN} onOpen={setOpenId} onOpenProj={setOpenProj} />}
        {view === 'tareas' && (tabla
          ? <div style={{ flex: '1 0 auto', padding: '18px 30px 40px' }}><TablaTareas tareas={visibles} board={board} hoy={hoyISO()} onOpen={setOpenId} onOpenProj={setOpenProj} ask={ask} /></div>
          : <Kanban tasks={visibles} board={board} topProjectId={topProjectId} sortMode={sortMode} sortDir={sortDir} frenanA={frenanA} onOpen={setOpenId} onNew={(p) => { setNuevaTareaPrio(p ?? null); setNuevaTarea(true); }} onWarn={setOpenId} onOpenProj={setOpenProj} onSoltar={(id, destino) => setSoltada({ entidad: 'tarea', id, destino })} />)}
        {view === 'proyectos' && <ProyectosView board={board} topProjectId={topProjectId} onOpen={setOpenProj} onNew={() => setNuevoProj(true)} projFilter={doneFilter} q={q} fOrigen={fOrigen} sortMode={sortMode} sortDir={sortDir} tabla={tabla} />}
        {view === 'graphics' && <GraphicsView board={board} />}
      </div>

      {openTask && <TaskModal key={openTask.id} t={openTask} board={board} topProjectId={topProjectId} suggestMako={openTask.id === makoHintId} trabajando={trabajandoIA.has(openTask.id)} onDebate={() => setDebateId(openTask.id)} onPrioridad={() => setSoltada({ entidad: 'tarea', id: openTask.id })} onDelete={() => setEliminarTaskId(openTask.id)} onAsignar={() => setAsignarTaskId(openTask.id)} onOpenProj={(id) => setPeekProjId(id)} escDisabled={!!peekProjId} ask={ask}
        onBack={(openProjLabel || welcomeVisible) ? () => { setOpenId(null); setMakoHintId(null); } : undefined}
        onClose={() => { setOpenId(null); setOpenProj(null); setPeekProjId(null); setMakoHintId(null); }} />}
      {peekProj && openTask && <ProjectDetailModal proj={peekProj} board={board} topProjectId={topProjectId} trabajando={trabajandoIA.has(peekProj.id)} z={130} onBack={() => setPeekProjId(null)}
        onOpenTask={(id) => { setPeekProjId(null); setOpenId(id); }} onNewTask={() => { setNuevaTareaProj(peekProj.id); setNuevaTarea(true); }}
        onPrioridad={() => setSoltada({ entidad: 'proyecto', id: peekProj.id })} onMako={() => setMakoProjId(peekProj.id)} onDelete={() => setEliminarProjId(peekProj.id)}
        onClose={() => setPeekProjId(null)} />}
      {/* LA AUDIENCIA. Reemplaza a `DebateModal` en el camino del SCORE (la FECHA se sigue
          debatiendo aparte: es otra pregunta). Tres cosas cambian y las tres importan: la
          exigencia se ve antes de argumentar, el rechazo NO escribe nada, y aceptar muestra
          la cascada antes de tocar la base. */}
      {debateTask && <AudienciaModal entidad="tarea"
        item={{ id: debateTask.id, titulo: debateTask.title, score: debateTask.score, emoji: debateTask.emoji }}
        otros={tasks.filter((t) => t.id !== debateTask.id && t.progress < 100).map((t) => ({ id: t.id, titulo: t.title, score: t.score, emoji: t.emoji }))}
        tareas={[]}
        onUsage={(u) => showUsage(u, 'prioridad de tarea')}
        onAplicado={recargarTrasCascada}
        onClose={() => setDebateId(null)} />}
      {/* EL POP-UP DEL 1 AL 100 — la única forma de fijar un número a mano, para los dos
          caminos (arrastrar y el lápiz del panel) y las dos entidades. «Para eso teníamos
          el pop-up» (23/09/2026): el slider del panel se fue. */}
      {soltada && soltadaItem && (
        <MoverPrioridadModal
          titulo={soltadaItem.titulo} score={soltadaItem.score}
          sugerido={soltada.destino ? scoreFromPrio[soltada.destino] : soltadaItem.score}
          vecinos={soltada.entidad === 'tarea'
            ? tasks.filter((x) => x.id !== soltada.id && x.progress < 100).map((x) => ({ id: x.id, titulo: x.title, score: x.score }))
            : labels.filter((x) => x.id !== soltada.id).map((x) => ({ id: x.id, titulo: x.name, score: x.score }))}
          onDebate={board.repo.debatePrioridad
            ? () => (soltada.entidad === 'tarea' ? setDebateId(soltada.id) : setDebateProjId(soltada.id))
            : undefined}
          onAplicado={async (n) => {
            const r = await board.repo.prioridadManual!(soltada.entidad, soltada.id, n);
            board.aplicarCascadaManual(soltada.entidad, { id: soltada.id, score: r.score, razon: 'Prioridad fijada a mano', texto: `Fijaste la prioridad en ${r.score} a mano` }, r.movidos);
          }}
          onClose={() => setSoltada(null)} />
      )}
      {nuevaTarea && <CrearTareaModal proyectoInicial={nuevaTareaProj} prioInicial={nuevaTareaPrio} ejemplos={tasks.filter((t) => t.progress < 100).map((t) => ({ title: t.title, score: t.score }))} onCrear={crearConGuardian} onDone={(id) => { setNuevaTarea(false); setNuevaTareaProj(null); setNuevaTareaPrio(null); setOpenId(id); setMakoHintId(id); }} onClose={() => { setNuevaTarea(false); setNuevaTareaProj(null); setNuevaTareaPrio(null); }} />}
      {openProjLabel && <ProjectDetailModal proj={openProjLabel} board={board} topProjectId={topProjectId} taskAbierta={!!openTask} trabajando={trabajandoIA.has(openProjLabel.id)}
        onBack={welcomeVisible ? () => setOpenProj(null) : undefined} backLabel="Volver"
        onOpenTask={setOpenId} onNewTask={() => { setNuevaTareaProj(openProjLabel.id); setNuevaTarea(true); }} onPrioridad={() => setSoltada({ entidad: 'proyecto', id: openProjLabel.id })} onMako={() => setMakoProjId(openProjLabel.id)} onDelete={() => setEliminarProjId(openProjLabel.id)} onClose={() => setOpenProj(null)} />}
      {makoProj && <MakoProyectoModal proj={{ name: makoProj.name, emoji: makoProj.emoji, detalle: makoProj.detalle }} onApply={(nombre, emoji, det) => board.patchLabelLog(makoProj.id, { name: nombre, emoji, detalle: det }, 'MaKo mejoró el proyecto', 'ia')} onClose={() => setMakoProjId(null)} />}
      {/* ⛔ ACÁ SE MONTABA `FechaDebateModal`, y se fue el 23/09/2026 con el botón que lo
          abría: la fecha se cambia en el selector y listo. El archivo queda en el repo —el
          Perro sigue PROPONIENDO la fecha al crear la tarjeta, que es cuando sirve— pero ya
          no hay ninguna pantalla que mande a discutírsela. */}
      {debateProj && <AudienciaModal entidad="proyecto"
        item={{ id: debateProj.id, titulo: debateProj.name, score: debateProj.score, emoji: debateProj.emoji }}
        otros={labels.filter((l) => l.id !== debateProj.id).map((l) => ({ id: l.id, titulo: l.name, score: l.score, emoji: l.emoji }))}
        tareas={tasks.filter((t) => t.progress < 100).slice().sort((a, b) => b.score - a.score).map((t) => ({ id: t.id, titulo: t.title, score: t.score, emoji: t.emoji }))}
        onUsage={(u) => showUsage(u, 'prioridad de proyecto')}
        onAplicado={recargarTrasCascada}
        onClose={() => setDebateProjId(null)} />}
      {nuevoProj && <CrearProyectoModal onCrear={crearProyecto} onClose={() => setNuevoProj(false)} />}
      {/* Lo que MaKo dejó esperando: tareas de una reunión tuya que leyó sola, o que te
          mandó otra persona. Nunca se crearon: se confirman acá. Van DESPUÉS de Datos
          y de la bienvenida para no apilar modales. */}
      {hayRecibidas && (
        <TareasRecibidasModal
          oculto={recibidasOculto}
          // HUELLA, no solo el id: `filas` se inicializa perezoso adentro del modal, así
          // que un objeto nuevo con el mismo id no re-inicializaría nada y la
          // revalidación no entraría nunca.
          key={borradorReunion
            ? `${borradorReunion.id}:${borradorReunion.estado ?? 'pendiente'}:${borradorReunion.tareas.length}:${borradorReunion.aplicadas?.length ?? 0}`
            : pendientes.map((p) => p.id).join('|')}
          props={borradorReunion ? [borradorReunion] : pendientes}
          labels={labels}
          // Lo que YA está en el plan, para que el modal no vuelva a ofrecer lo que
          // ya existe: la misma reunión leída dos veces (o el mismo compromiso en dos
          // juntas) traía las tarjetas repetidas y el botón decía "Agregar 48" sin
          // avisar que varias ya estaban.
          existentes={tasks.map((t) => ({ id: t.id, titulo: t.title, hecha: t.progress >= 100 }))}
          onListo={() => window.location.reload()}
          onClose={() => setBorradorReunion(null)}
          onDescartadas={() => { setBorradorReunion(null); setPendientes([]); }}
          // Abrir una que ya cargaste: el detalle se pone adelante y este modal espera
          // atrás (la condición de arriba lo apaga mientras haya una tarea abierta).
          onAbrirTarea={(id) => setOpenId(id)}
          // La MISMA tarjeta del kanban para lo que ya está en el plan (no una lista de
          // texto): si ya es una tarea de verdad, tiene que verse como una tarea.
          renderTaskCard={(id) => { const t = tasks.find((x) => x.id === id); return t ? <CardTile t={t} board={board} warn={false} onOpen={setOpenId} onWarn={setOpenId} onOpenProj={setOpenProj} /> : null; }}
        />
      )}
      {/* El caso frío (una reunión vieja, ya aplicada) igual va al server. Mientras
          viaja se pinta LA MISMA caja del modal con el título real de la reunión y la
          cantidad exacta de tareas —los dos salen del conteo que el server ya mandó con
          la lista, así que no se inventa nada— y filas fantasma del alto de una tarjeta.
          Antes acá había un scrim negro con un spinner centrado y nada más: no decías ni
          a qué reunión habías entrado. */}
      {cargandoBorrador && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 133, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
          <div style={{ width: '100%', maxWidth: 620, height: 'min(86vh, 760px)', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: '1px solid var(--border)', flex: 'none' }}>
              <span style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid var(--border-strong)', borderTopColor: 'var(--primary)', display: 'inline-block', animation: 'makoSpinBS .7s linear infinite', flex: 'none' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: 'var(--accent)' }}>✦ MAKO · REUNIÓN → PLAN</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {cargandoBorrador.titulo || 'Abriendo lo que sacó MaKo…'}
                </div>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {cargandoBorrador.n > 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>{cargandoBorrador.n} {cargandoBorrador.n === 1 ? 'tarea' : 'tareas'} de esta reunión</div>
              )}
              {Array.from({ length: Math.max(3, Math.min(6, cargandoBorrador.n || 3)) }).map((_, i) => (
                <div key={i} style={{ height: 62, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', opacity: 0.65 - i * 0.08 }} />
              ))}
            </div>
          </div>
          <style>{'@keyframes makoSpinBS{to{transform:rotate(360deg)}}'}</style>
        </div>
      )}
      {importar && <ImportarModal onClose={() => setImportar(false)}
        onListo={(files) => { setImportar(false); setReunionArchivo(files); setExtraerReunion(true); }} />}
      {diag && <Diagnostico />}
      {extraerReunion && <ReunionExtractModal catalogo={repo.catalogo} labels={labels} archivoInicial={reunionArchivo}
        // Los borradores que te MANDÓ otra persona no tienen una reunión tuya en la
        // lista de Fathom (esa grabación es de su cuenta), así que sin esta sección
        // quedaban sin puerta desde que el modal dejó de abrirse solo.
        recibidos={pendientes.filter((p) => !!p.enviadoPor).map((p) => ({
          id: p.id, de: p.enviadoPor ?? '',
          titulo: p.fuenteTitulo || p.resumen || 'Tareas para confirmar',
          n: p.tareas?.filter((t) => !t.esDeOtro).length ?? 0,
        })).filter((r) => r.n > 0)}
        onAbrirRecibido={(id) => {
          const p = pendientes.find((x) => x.id === id);
          if (p) { setReunionArchivo(null); setBorradorReunion(p); }
        }}
        onAbrirBorrador={(rid, meta) => {
          // El selector NO se cierra: queda abierto DEBAJO. Cerrar el borrador te
          // devuelve a la lista de reuniones, que es de donde entraste — cerrar un paso
          // no puede cerrarte los dos. Y como no se desmonta, la lista no se vuelve a
          // pedir a Fathom ni pierde el buscador y el filtro de fecha.
          setReunionArchivo(null);
          // EL BORRADOR YA ESTÁ ACÁ, casi siempre: `pendientes` se pide una vez al montar
          // el board y trae las propuestas ENTERAS, con su `ref`. Fetchear igual era pagar
          // ~300-800 ms de pantalla muerta para volver a traer lo que ya teníamos. Es el
          // mismo atajo que usa onAbrirRecibido dos líneas más arriba.
          const ya = pendientes.find((p) => p.ref === `fathom:${rid}`);
          if (ya) setBorradorReunion(ya);
          else { setCargandoBorrador(meta ?? { titulo: '', fecha: null, n: 0 }); }
          // El fetch SIGUE, siempre: es la revalidación. Si alguien cargó las tareas en
          // otra pestaña, el objeto de memoria diría 'pendiente' y el modal ofrecería
          // «Agregar al plan» sobre tareas que ya están. La `key` de abajo lleva la huella
          // del borrador, así que si la respuesta difiere el modal se remonta con lo
          // fresco, y si es igual React no toca nada y no se ve ni un parpadeo.
          void fetch('/api/plan-propuesta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'por-reunion', recordingId: rid }) })
            .then((r) => r.json())
            .then((j) => { if (j?.ok && j.propuesta) setBorradorReunion(j.propuesta as PropuestaPendiente); })
            .catch(() => { /* si falla, queda lo que ya habíamos pintado */ })
            .finally(() => setCargandoBorrador(null));
        }}
        existentes={tasks.filter((t) => t.progress < 100).map((t) => ({ id: t.id, titulo: t.title, detalle: t.detalle }))}
        onUsage={(u) => showUsage(u, 'extraer tareas de reunión')} onCrear={crearDesdeReunion} onAmpliar={ampliarDesdeReunion} onClose={() => { setExtraerReunion(false); setReunionArchivo(null); }} />}
      {exportar && <ExportarModal tasks={tasks} labels={labels} titulo={repo.labelPlural === 'Proyectos' ? 'Plan' : repo.labelPlural} onClose={() => setExportar(false)} />}
      {/* Borrar es UNA pregunta con dos botones: ya no se le pide permiso al Perro. La
          tarea que no está terminada y el motivo, que ahora es opcional, van al historial
          del proyecto igual que antes. */}
      {eliminarTask && <EliminarModal tipo="tarea" nombre={eliminarTask.title}
        onCompletar={eliminarTask.progress >= 100 ? undefined : () => board.toggleDone(eliminarTask.id)}
        onDebate={board.repo.debatePrioridad ? () => setDebateId(eliminarTask.id) : undefined}
        onBorrar={(motivo) => { board.remove(eliminarTask.id, motivo); setOpenId(null); }} onClose={() => setEliminarTaskId(null)} />}
      {eliminarProj && <EliminarModal tipo="proyecto" nombre={eliminarProj.name} nTareas={tasks.filter((t) => t.labels.includes(eliminarProj.id)).length}
        onBorrar={() => { board.deleteLabelYTareas(eliminarProj.id); setOpenProj(null); }} onClose={() => setEliminarProjId(null)} />}
      {asignarTask && <AsignarProyectoModal task={asignarTask} labels={labels}
        onAsignar={(ids, motivo) => { const snap = asignarTask; board.setTaskLabels(asignarTask.id, ids, `${ids.length ? `Asignó a ${ids.map((id) => board.labelById(id)?.name).filter(Boolean).join(', ')}` : 'Quitó el proyecto'}${motivo ? ` — ${motivo.slice(0, 80)}` : ''}`); board.showUndo('Proyecto actualizado', () => board.replaceTask(snap)); }}
        onClose={() => setAsignarTaskId(null)} />}
      {datosOpen && <DatosModal items={faltantes}
        onSetDeadline={(id, fecha) => board.setDeadline(id, fecha, '')}
        onAbrir={(id) => { setDatosOpen(false); setOpenId(id); }}
        onIgnorarDl={ignorarDl}
        onClose={cerrarDatos} />}
      {/* Bienvenida "MaKo cargó tareas": se abre sola UNA vez al entrar (Datos ya no). No se
          apila sobre un detalle abierto por deep-link (?tarea=): ahí espera a que se cierre. */}
      {welcomeVisible && !openId && !openProj && !peekProjId && <TareasCreadasModal tasks={welcomeTasks} projects={welcomeProjects} proyNuevoIds={proyNuevoIds}
        renderTaskCard={(t) => <CardTile t={t} board={board} warn={false} onOpen={setOpenId} onWarn={setOpenId} onOpenProj={setOpenProj} />}
        renderProjCard={(l) => <ProyectoCardTile l={l} prog={projProgress(tasks, l.id)} isTop={l.id === topProjectId} onOpen={() => setOpenProj(l.id)} />}
        onClose={() => setWelcomeVisible(false)} />}
      {confirm && <ConfirmModal msg={confirm.msg} onOk={() => { confirm.onOk(); setConfirm(null); }} onCancel={() => setConfirm(null)} />}
      <UndoToast state={board.undo} onClose={board.clearUndo} />
    </main>
  );
}

// ── átomos ────────────────────────────────────────────────────────────────────
const ghostBtn: CSSProperties = { padding: '8px 13px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 500, fontSize: 13.5, cursor: 'pointer', fontFamily: SANS };
const selStyle: CSSProperties = { appearance: 'none', WebkitAppearance: 'none', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, fontWeight: 500, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: SANS, width: '100%' };
// botón "Cambiar prioridad/proyecto" — mismo diseño en toda la app: estrella de IA + texto azul
const cambiarBtn: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', border: '1px solid var(--primary-weak)', background: 'var(--surface)', color: 'var(--primary)', fontWeight: 700, fontSize: 13, padding: '9px 12px', borderRadius: 9, cursor: 'pointer', fontFamily: SANS };

function FunnelIcon({ color = 'currentColor', size = 17 }: { color?: string; size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>; }
/**
 * Exportar el tablero. Era un desplegable con tres salidas fijas —o te llevabas todo
 * o nada, y sin el P# del proyecto, sin la justificación de prioridad y sin las notas—.
 * Ahora abre el mismo formulario que el resto de la app: una pregunta por pantalla
 * (qué · de qué proyectos · qué tareas · qué datos · qué formato) en ExportarModal.
 */
/**
 * BarraAcciones — los botones del header, plegados detrás de un «+» cuando no entran.
 *
 * El header es de UNA sola línea a propósito (que nada salte de renglón al cambiar de
 * tab), y eso tiene un costo: cuando la ventana se angosta, el grupo de la derecha no
 * se achica —sus botones son de 38px fijos— y termina DIBUJÁNDOSE ENCIMA de "Filtrar".
 * Medido: a 700px de ancho, el grupo se salía 290px del contenedor.
 *
 * Quién decide es el header (mide si entra o no); acá solo se pinta. El «+» abre los
 * mismos botones, hacia la izquierda —vive pegado al borde derecho, así que hacia el
 * otro lado se irían de la pantalla.
 */
/** Tres puntos: en esta app ES el simbolo de «hay mas acciones aca». Ya lo usa el CRM
 *  (app/crm/CrmToolbar.tsx) con el mismo significado. */
function KebabIcon({ size = 17 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="12" cy="5" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="12" cy="19" r="1.9" /></svg>;
}

/** Una fila del menu plegado: icono, NOMBRE y una linea de que hace. */
function FilaAccion({ icono, label, desc, badge, onClick }: {
  icono: React.ReactNode; label: string; desc: string; badge?: number; onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button type="button" role="menuitem" onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', background: hover ? 'var(--surface-2)' : 'transparent', fontFamily: SANS }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, flex: 'none', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: hover ? 'var(--primary)' : 'var(--dim)' }}>{icono}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--faint)', lineHeight: 1.35, marginTop: 1 }}>{desc}</span>
      </span>
      {badge != null && badge > 0 && (
        <span style={{ flex: 'none', minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, background: 'var(--primary)', color: '#fff', fontFamily: MONO, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>
      )}
    </button>
  );
}

/** Lo que hace falta saber de una accion cuando NO entra en la barra. */
export type AccionPlegable = {
  key: string;
  /** el boton tal cual, para cuando SI entra */
  nodo: React.ReactNode;
  /** como se llama y que hace, para cuando hay que plegarla */
  menu: { icono: React.ReactNode; label: string; desc: string; badge?: number; onClick: () => void };
};

/**
 * Los botones de accion del header, plegables.
 *
 * TRES DECISIONES QUE NO SON DE GUSTO, y las tres salieron de que el dueño no entendiera
 * la primera version («el boton de + no me gusta mucho, no se entiende que es un
 * desplegable»):
 *
 *  1. TRES PUNTOS, NO «+». Un «+» significa CREAR en toda la industria y en esta misma
 *     app; usarlo para «hay mas cosas» promete una tarea nueva y entrega un menu. Los
 *     tres puntos son el simbolo de overflow, y el CRM ya lo usa asi
 *     (app/crm/CrmToolbar.tsx): el precedente estaba en casa y esto lo ignoraba.
 *  2. EL MENU ES VERTICAL Y CON TEXTO. La version anterior desplegaba los MISMOS iconos
 *     mudos en una tira horizontal: cambiaba un icono ambiguo por cinco. Un menu se lee.
 *  3. EL PROGRESO DEL PLAN VA ARRIBA DEL MENU. Es un DATO, no una accion: cuando no
 *     entra en la barra tiene que seguir estando en algun lado. La regla de la casa es
 *     «plegar si, esconder no», y un numero que desaparece es esconder.
 */
function BarraAcciones({ acciones, compacto, progreso }: {
  acciones: AccionPlegable[];
  /** no entran: se pliegan detras de los tres puntos. Lo decide el header, que es quien mide. */
  compacto: boolean;
  /** el avance del plan, para que no desaparezca al plegarse */
  progreso?: { pct: number; hechas: number; total: number; label: string };
}) {
  const [abierto, setAbierto] = useState(false);
  const n = acciones.length;
  const esperando = acciones.reduce((t, a) => t + (a.menu.badge ?? 0), 0);

  // Al desplegarse la ventana, cerrar el panel: si no, queda flotando sobre el tablero.
  useEffect(() => { if (!compacto) setAbierto(false); }, [compacto]);
  // Escape cierra, como todo lo que se abre en esta app.
  useEffect(() => {
    if (!abierto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [abierto]);

  if (!compacto) return <div data-barra-acciones style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>{acciones.map((a) => <Fragment key={a.key}>{a.nodo}</Fragment>)}</div>;

  return (
    <div data-barra-menu style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 'none' }}>
      <button type="button" onClick={() => setAbierto((v) => !v)}
        aria-label={abierto ? 'Cerrar las acciones' : 'Mas acciones del plan (' + n + ')'} aria-expanded={abierto} aria-haspopup="menu"
        title="Mas acciones del plan"
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 9, border: '1px solid ' + (abierto ? 'var(--primary)' : 'var(--border-strong)'), background: abierto ? 'var(--surface-2)' : 'var(--surface)', color: abierto ? 'var(--primary)' : 'var(--dim)', cursor: 'pointer', flex: 'none', padding: 0 }}>
        <KebabIcon />
        {/* Que hay algo esperando se ve SIN abrir: un menu cerrado que esconde sus avisos
            es esconder sin pista, que es justo lo que la regla prohibe.
            Un PUNTO, no un numero: sumar los badges de las acciones daba «507» —429 tareas
            sin datos + 19 de MaKo + 59 de reuniones—, un total que no significa nada porque
            no son la misma cosa. El numero de cada una vive en su fila, adentro. */}
        {esperando > 0 && (
          <span aria-hidden style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: 999, background: 'var(--primary)', border: '2px solid var(--surface)' }} />
        )}
      </button>
      {abierto && (
        <>
          <div onClick={() => setAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div role="menu" style={{ position: 'absolute', top: 44, right: 0, zIndex: 41, width: 312, maxWidth: 'calc(100vw - 32px)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 13, boxShadow: '0 16px 40px rgba(18,21,27,.18)', padding: 7, display: 'flex', flexDirection: 'column', gap: 2, animation: 'makoDesplegar .14s ease-out both' }}>
            {progreso && (
              <div style={{ padding: '8px 10px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{progreso.pct}%</span>
                  <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)' }}>{progreso.hechas}/{progreso.total} {progreso.label}</span>
                </div>
                <span style={{ display: 'block', height: 4, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden', marginTop: 6 }}>
                  <span style={{ display: 'block', height: '100%', width: Math.min(100, progreso.pct) + '%', background: 'var(--primary)' }} />
                </span>
              </div>
            )}
            {progreso && <span style={{ height: 1, background: 'var(--border)', margin: '3px 6px 5px' }} />}
            {acciones.map((a) => (
              <FilaAccion key={a.key} icono={a.menu.icono} label={a.menu.label} desc={a.menu.desc} badge={a.menu.badge}
                onClick={() => { setAbierto(false); a.menu.onClick(); }} />
            ))}
          </div>
          <style>{'@keyframes makoDesplegar{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}'}</style>
        </>
      )}
    </div>
  );
}

function ExportarBoton({ onAbrir }: { onAbrir: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button type="button" onClick={onAbrir} aria-label="Exportar el tablero" title="Exportar las tareas y los proyectos"
      style={{ display: 'inline-flex', flex: 'none', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 9, border: `1px solid ${hover ? 'var(--primary)' : 'var(--border-strong)'}`, background: 'var(--surface)', cursor: 'pointer', color: hover ? 'var(--primary)' : 'var(--dim)', padding: 0 }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <DownloadIcon />
    </button>
  );
}
/**
 * NOTAS — el cuaderno del dueño. El `detalle` dice QUÉ hay que hacer y lo escribe (o
 * lo amplía) el Perro; esto es de él y no lo toca nadie: dónde quedó, con quién habló,
 * el link que le pasaron, por qué lo frenó. Antes todo eso terminaba metido en el
 * detalle, donde la IA lo reescribe en la siguiente pasada.
 *
 * Guarda al salir del campo, no en cada tecla: escribir una nota larga son cien
 * escrituras a la base y cien líneas de historial.
 */
/**
 * Línea entre secciones del detalle. Antes el modal apilaba título, detalle, avance,
 * checklist e historial con un margin y nada más: se leía como UNA sola sección larga.
 * Una línea y aire alcanzan — no hacen falta cajas.
 */
function Separador() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '26px 0 22px' }} />;
}

function NotasBox({ valor, onGuardar }: { valor: string; onGuardar: (v: string) => void }) {
  const rowLabel: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6, display: 'block' };
  // `key` en vez de un efecto que sincroniza: cuando cambia la nota de afuera (otra
  // pestaña, el undo), el textarea se re-monta con el valor nuevo. Con un efecto había
  // que decidir "¿piso lo que está escribiendo?" y la respuesta siempre era frágil.
  const [txt, setTxt] = useState(valor);
  const guardar = () => { if (txt !== valor) onGuardar(txt); };
  return (
    <div>
      <label style={{ ...rowLabel, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Notas</span>
        {txt !== valor && <span style={{ fontSize: 10.5, color: 'var(--faint)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>sin guardar</span>}
      </label>
      <textarea value={txt} onChange={(e) => setTxt(e.target.value)} onBlur={guardar} rows={3}
        placeholder="Lo tuyo: dónde quedaste, con quién hablaste, un link…"
        style={{ width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13, lineHeight: 1.5, outline: 'none', resize: 'vertical' }} />
    </div>
  );
}
/**
 * "Esto se hace acá adentro". Cuando el Perro reconoció que la tarea se resuelve en una
 * tab de MaKo, la tarjeta deja de ser un deber y pasa a ser un botón: el nombre de la
 * pantalla, los pasos, y el link. La lista de capacidades es cerrada y está escrita a
 * mano (lib/mako-capacidades) — mandar a alguien a una pantalla que no hace lo que
 * promete es peor que no decirle nada.
 */
function HaceloEnMaKo({ id }: { id?: string }) {
  const cap = id ? capacidad(id) : undefined;
  if (!cap) return null;
  return (
    <div style={{ border: '1px solid var(--accent-soft, var(--border-strong))', background: 'var(--surface-2)', borderRadius: 12, padding: '12px 13px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
        <MakoStar size={14} color="var(--accent)" />
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 700 }}>Esto se hace en MaKo</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, marginBottom: 8 }}>{cap.que}</div>
      <ol style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.6 }}>
        {cap.como.map((paso) => <li key={paso}>{paso}</li>)}
      </ol>
      <a href={cap.ruta} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', fontFamily: SANS }}>
        Ir a {cap.tab} →
      </a>
    </div>
  );
}
function DownloadIcon() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>; }

// Ícono de subir archivo (bandeja + flecha hacia arriba) para el botón del toolbar (punto 7).
function DescargarIcon() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>; }
function UploadIcon() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></svg>; }
// Logo del Plan: checklist relleno (mismo motivo que el ícono de la sidebar). Los
// checks/líneas usan --surface para invertir bien en claro/oscuro.
function PlanIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flex: 'none' }}>
      <rect x="3.4" y="2.4" width="17.2" height="19.2" rx="3.4" fill="var(--ink)" />
      <g stroke="var(--surface)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M6.6 8l1.3 1.3 2.4-2.9" /><path d="M6.6 12.4l1.3 1.3 2.4-2.9" /><path d="M6.6 16.8l1.3 1.3 2.4-2.9" />
        <path d="M13 8h4.3M13 12.4h4.3M13 16.8h4.3" strokeWidth="1.9" />
      </g>
    </svg>
  );
}
// formatea tokens (12300 → "12,3k") para el toast de consumo de IA
// Búsqueda: texto libre sobre título/detalle + por NÚMERO de tarjeta. El #num es
// cómo se referencian las tareas entre sí (y como las nombra MaKo cuando marca un
// duplicado), así que tiene que ser buscable: sin esto el id no sirve para nada.
// "#132" busca SOLO por número (exacto); "132" busca por número o por texto.
// El buscador de proyectos usa el MISMO `coincide` que el de tareas (lib/buscar-tareas).
// Acá vivía una segunda copia, con su propio `paraBuscar`: la de la barra sacaba la
// puntuación y ésta no, la de acá sacaba las etiquetas HTML y la otra no, y las dos
// buscaban por subcadena. Dos buscadores en la misma pantalla que no se parecían.


// filtro por estado (2ª capa del botón Filtrar): Todas / Activas / Comenzadas / Completadas
type DoneFilter = 'all' | 'activas' | 'comenzadas' | 'hechas';
const ESTADO_OPS: Array<[DoneFilter, string]> = [['all', 'Todas'], ['activas', 'Activas'], ['comenzadas', 'Comenzadas'], ['hechas', 'Completadas']];
function pasaEstado(progress: number, f: DoneFilter): boolean {
  if (f === 'all') return true;
  if (f === 'hechas') return progress >= 100;
  if (f === 'comenzadas') return progress > 0 && progress < 100;
  return progress < 100; // activas
}

function AvgChip({ avg, hechas, total, label }: { avg: number; hechas: number; total: number; label: string }) {
  // `flex: 'none'` + `whiteSpace: 'nowrap'`: el chip vive en un contenedor con
  // `minWidth: 0` que lo deja encogerse, y cuando el tablero llegó a «89/527 del plan»
  // el texto partió en dos renglones y estiró todo el header. Un contador que cambia de
  // alto según cuántas tareas tengas no es un contador, es un salto.
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, flex: 'none', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 12px', whiteSpace: 'nowrap' }}>
      <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{avg}%</span>
      <span style={{ display: 'block', width: 74, height: 6, flex: 'none', borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: avg + '%', background: 'var(--primary)' }} /></span>
      <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', whiteSpace: 'nowrap' }}>{hechas}/{total} {label}</span>
    </div>
  );
}

// Chip de proyecto. Si trae onOpen, es CLICKEABLE (feedback jul-19: el chip del header
// del detalle también debe abrir el proyecto, igual que los del sidebar).
function LabelChip({ l, cap = 190, onOpen }: { l: Label; cap?: number; onOpen?: (id: string) => void }) {
  const style: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: l.color, background: l.color + '14', border: `1px solid ${l.color}33`, padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap', maxWidth: cap, overflow: 'hidden', textOverflow: 'ellipsis', flex: 'none', fontFamily: SANS };
  const inner = <><span style={{ flex: 'none' }}>{l.emoji}</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</span></>;
  // stopPropagation: el chip vive dentro de contenedores que TAMBIÉN son clickeables
  // (la tarjeta abre la tarea). Sin esto, un click abría el proyecto y la tarea a la vez.
  if (onOpen) return <button type="button" title={`Abrir «${l.name}»`} onClick={(e) => { e.stopPropagation(); onOpen(l.id); }} style={{ ...style, cursor: 'pointer' }}>{inner}</button>;
  return <span title={l.name} style={style}>{inner}</span>;
}
// Chips de proyecto con tope: muestra `max` (truncados) + un "+N" si hay más. Evita
// que las tareas con varios proyectos rompan el layout o le coman protagonismo al título.
function LabelChips({ chips, max = 2, cap = 190, onOpen }: { chips: Label[]; max?: number; cap?: number; onOpen?: (id: string) => void }) {
  const shown = chips.slice(0, max);
  const rest = chips.slice(max);
  return <>{shown.map((l) => <LabelChip key={l.id} l={l} cap={cap} onOpen={onOpen} />)}{rest.length > 0 && <MasChip extra={rest} onOpen={onOpen} />}</>;
}
// "+N" con desplegable HOVER (diseño nuestro): muestra los proyectos ocultos con su
// color + emoji. Se renderiza en un PORTAL (fixed) para que NO lo tape ni lo recorte
// ninguna card/columna con overflow, y muestra el NOMBRE COMPLETO (sin cortar).
function MasChip({ extra, onOpen }: { extra: Label[]; onOpen?: (id: string) => void }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Abrir cancela el cierre pendiente; cerrar espera ~2s (feedback jul-19: el desplegable
  // no debe cerrarse solo — te da tiempo a moverte hasta él y leerlo). El propio panel
  // comparte los handlers, así hovering el panel lo mantiene abierto.
  const abrir = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } const r = ref.current?.getBoundingClientRect(); if (r) setPos({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 320) }); };
  const cerrarPronto = () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setPos(null), 2000); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  // El mouseleave NO alcanza: vive en un PORTAL fijo fuera de la card, así que si el
  // puntero nunca sale (se abrió una tarea encima, la columna scrolleó, la card se
  // desmontó) el panel quedaba flotando para siempre — encima del detalle, incluido.
  // Cualquier gesto que cambie lo que estás mirando lo cierra.
  useEffect(() => {
    if (!pos) return;
    const cerrar = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } setPos(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
    // capture: el scroll de una columna del kanban no burbujea hasta window.
    document.addEventListener('mousedown', cerrar);
    document.addEventListener('scroll', cerrar, true);
    document.addEventListener('keydown', esc);
    window.addEventListener('resize', cerrar);
    window.addEventListener('blur', cerrar);
    return () => {
      document.removeEventListener('mousedown', cerrar);
      document.removeEventListener('scroll', cerrar, true);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('resize', cerrar);
      window.removeEventListener('blur', cerrar);
    };
  }, [pos]);
  return (
    <span ref={ref} style={{ flex: 'none', display: 'inline-flex' }} onMouseEnter={abrir} onMouseLeave={cerrarPronto}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--dim)', background: 'var(--surface)', border: `1px solid ${pos ? 'var(--primary)' : 'var(--border-strong)'}`, borderRadius: 6, padding: '2px 6px', cursor: 'default' }}>+{extra.length}</span>
      {pos && createPortal(
        <span onMouseEnter={abrir} onMouseLeave={cerrarPronto} onMouseDown={(e) => e.stopPropagation()} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 5, width: 300, maxWidth: '92vw', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11, boxShadow: '0 16px 40px rgba(18,21,27,.24)', padding: 8, fontFamily: SANS }}>
          <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700, padding: '0 2px 2px' }}>También en</span>
          {extra.map((l) => {
            const est: CSSProperties = { display: 'inline-flex', alignItems: 'flex-start', gap: 6, fontSize: 12, fontWeight: 600, color: l.color, background: l.color + '14', border: `1px solid ${l.color}33`, borderRadius: 7, padding: '4px 9px', lineHeight: 1.35, textAlign: 'left', fontFamily: SANS };
            const cont = <><span style={{ flex: 'none' }}>{l.emoji}</span><span>{l.name}</span></>;
            return onOpen
              ? <button key={l.id} type="button" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setPos(null); onOpen(l.id); }} title={`Abrir «${l.name}»`} style={{ ...est, cursor: 'pointer', width: '100%' }}>{cont}</button>
              : <span key={l.id} style={est}>{cont}</span>;
          })}
        </span>,
        document.body,
      )}
    </span>
  );
}
function MiniBar({ v }: { v: number }) {
  return <span style={{ display: 'block', height: 4, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: v + '%', background: 'var(--primary)' }} /></span>;
}
// barra Impacto/Esfuerzo (1-100): las variables con las que el guardián arma la prioridad.
function IEMeter({ label, v, color }: { label: string; v: number; color: string }) {
  const w = Math.max(0, Math.min(100, v));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700, width: 52, flex: 'none' }}>{label}</span>
      <span style={{ flex: 1, height: 5, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: w + '%', background: color }} /></span>
      <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color, width: 22, textAlign: 'right', flex: 'none' }}>{v}</span>
    </div>
  );
}
// prioridad del proyecto (1-100) — mismo sistema gauge + número que las tareas

function ProjScore({ score, color, big }: { score: number; color: string; big?: boolean }) {
  return <span title="Prioridad del proyecto" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontSize: big ? 15 : 11, fontWeight: 700, color, background: color + '18', border: `1px solid ${color}33`, borderRadius: 6, padding: big ? '3px 10px' : '2px 6px 2px 5px' }}><ScoreIcon size={big ? 15 : 11} color={color} />{score}</span>;
}
// TARJETAS o TABLA. Vive al lado de «Filtrar» porque es lo mismo que un filtro: cambia
// cómo mirás lo que ya está, no lo que hay. Se recuerda por navegador y por vista.
function VistaToggle({ tabla, onSet }: { tabla: boolean; onSet: (v: boolean) => void }) {
  const btn = (activo: boolean): CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 30, borderRadius: 7,
    border: 'none', background: activo ? 'var(--surface)' : 'transparent', color: activo ? 'var(--primary)' : 'var(--faint)',
    boxShadow: activo ? '0 1px 2px rgba(18,21,27,.08)' : 'none', cursor: 'pointer', flex: 'none',
  });
  return (
    <div style={{ display: 'inline-flex', flex: 'none', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: 2 }}>
      <button type="button" onClick={() => onSet(false)} aria-pressed={!tabla} title="Ver en tarjetas" aria-label="Ver en tarjetas" style={btn(!tabla)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
      </button>
      <button type="button" onClick={() => onSet(true)} aria-pressed={tabla} title="Ver en tabla — con deadline, días que faltan y atraso" aria-label="Ver en tabla" style={btn(tabla)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
      </button>
    </div>
  );
}
// LA RAZÓN DEL NÚMERO, PLEGADA. Estaba suelta arriba de todo en las dos sidebars y son
// dos o tres renglones de itálica que nadie lee dos veces: «eso está bien que exista, ya
// que el perro seguirá funcionando, pero es mucho texto suelto, entonces mejor que sea un
// desplegable» (22/09). Sigue existiendo y sigue a un click.
/**
 * EL PERRO TRABAJANDO sobre esta tarjeta, en el panel abierto.
 *
 * Crear ya no espera al modelo: la tarjeta nace, el detalle se abre, y durante 10-20
 * segundos la tarjeta está VACÍA —sin proyecto, sin descripción y con el score de fábrica—
 * mientras el Perro la puntúa, la rutea y le escribe el detalle. Sin decirlo, eso se lee
 * como que la creación salió mal.
 *
 * ⚠️ EL RÓTULO SALE DE `GRAMATICA`, NO DE ACÁ (AGENTS.md: «el rótulo de un estado de MaKo no
 * es un prop»). Y el estado `analizando` EXIGE nombrar la fuente: «no usar animación
 * decorativa indefinida» — un spinner sin objeto a los diez segundos es indistinguible de
 * una pantalla colgada.
 */
function PerroTrabajando({ que }: { que: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--mako-weak, var(--border))', background: 'color-mix(in srgb, var(--mako, #C8870C) 8%, transparent)' }}>
      <span style={{ display: 'inline-flex', flex: 'none', animation: 'mkLatido 1.4s ease-in-out infinite' }}><GuardianIcon size={18} /></span>
      <span style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.35 }}>
        <b style={{ fontWeight: 700 }}>{GRAMATICA.analizando.rotulo}</b> · {que}
      </span>
      <style>{'@keyframes mkLatido{0%,100%{opacity:.45}50%{opacity:1}}'}</style>
    </div>
  );
}

/**
 * EL BLOQUE DE PRIORIDAD del panel del detalle. UNO solo para tareas y para proyectos.
 *
 * El pedido del 23/09/2026, mirando la pantalla, son cuatro cosas y las cuatro están acá:
 *  1. Nada de slider ni de botón de ancho completo: «para eso teníamos el pop-up».
 *  2. Fuera «La fijaste a mano: MaKo ya no la toca. Devolvérsela.».
 *  3. UN desplegable, en el TÍTULO, que abre todo — no uno por sección. Antes eran dos
 *     `<details>` anidados en la misma columna («Por qué este número» e «Impacto y
 *     esfuerzo»), o sea tres clicks para ver tres renglones.
 *  4. El lápiz, minimalista y PEGADO AL NÚMERO. Un ícono suelto al final de la columna no
 *     se lee como «editá esto».
 *
 * ⚠️ ES COMPARTIDO A PROPÓSITO: «revisá que funcione igualmente para tareas como para
 * proyecto». Eran dos copias del mismo bloque, con dos `<details>` cada una, y ya habían
 * divergido (el de proyectos no mostraba el ajuste por tiempo).
 */
function BloquePrioridad({ etiqueta, chip, color, score, titulo, razon, impacto, esfuerzo, extra, tiempo, puedeEditar, onEditar }: {
  /** «BAJA», «ALTA»… Sólo las tareas tienen banda; un proyecto es su número. */
  etiqueta?: string;
  chip: ReactNode;
  color: string;
  score: number;
  titulo: string;
  razon?: string;
  impacto?: number | null;
  esfuerzo?: number | null;
  /** lo propio de cada entidad (el escalón de un proyecto) */
  extra?: ReactNode;
  /** el ajuste por tiempo (sólo tareas) */
  tiempo?: ReactNode;
  puedeEditar: boolean;
  onEditar: () => void;
}) {
  const hayQueAbrir = !!razon || impacto != null || esfuerzo != null;
  const cabecera = (
    <>
      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Prioridad:</span>
      {etiqueta && <span style={{ fontSize: 15, fontWeight: 800, color, letterSpacing: '.01em' }}>{etiqueta}</span>}
      {chip}
      <span style={{ flex: 1 }} />
      {/* ⚠️ `preventDefault` + `stopPropagation`: adentro de un `<summary>`, cualquier click
          pliega o despliega. Sin esto, tocar el lápiz abría el pop-up Y cerraba el bloque. */}
      {puedeEditar && <LapizPrioridad onClick={onEditar} titulo={`Cambiar la prioridad de «${titulo.slice(0, 40)}»`} />}
    </>
  );
  const cuerpo = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 9 }}>
      {razon && <div style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.4, fontStyle: 'italic' }}>“{razon}”</div>}
      {tiempo}
      {impacto != null && <IEMeter label="Impacto" v={impacto} color="#1E9E57" />}
      {esfuerzo != null && <IEMeter label="Esfuerzo" v={esfuerzo} color="#C8870C" />}
    </div>
  );
  if (!hayQueAbrir) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }} onClick={(e) => e.stopPropagation()}>{cabecera}</div>
        {tiempo}
        {extra}
      </div>
    );
  }
  return (
    <div>
      <details className="mk-det">
        <summary style={{ userSelect: 'none' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, width: 'calc(100% - 18px)', verticalAlign: 'middle' }}
            onClick={(e) => { const t = e.target as HTMLElement; if (t.closest('button')) { e.preventDefault(); e.stopPropagation(); } }}>
            {cabecera}
          </span>
        </summary>
        {cuerpo}
      </details>
      {extra}
    </div>
  );
}

function RazonPrio({ razon }: { razon?: string }) {
  if (!razon) return null;
  return (
    <details style={{ marginBottom: 8 }}>
      <summary style={{ cursor: 'pointer', fontSize: 11.5, color: 'var(--faint)', userSelect: 'none' }}>Por qué este número</summary>
      <div style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.4, marginTop: 5, fontStyle: 'italic' }}>“{razon}”</div>
    </details>
  );
}
// score del guardián (1-100), coloreado por la columna que define.
function ScoreBadge({ score }: { score: number }) {
  const c = PCOLOR[prioFromScore(score)];
  return <span title="Prioridad del guardián (1-100)" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontSize: 10, fontWeight: 700, color: c, background: c + '18', border: `1px solid ${c}33`, borderRadius: 5, padding: '1px 5px 1px 4px' }}><ScoreIcon size={10} color={c} />{score}</span>;
}
// Chip de FUENTE (feedback jul-19): DE DÓNDE salió la tarjeta — Fathom (reunión),
// WhatsApp, un archivo, Claude Code (con nombre + link del chat), o MaKo. Distinto de
// "quién": una tarjeta que sacó MaKo de una reunión de Fathom no es lo mismo que una
// que escribió un dev en el SEED. Si trae url, el chip es un link.
const FUENTE_META: Record<FuenteTipo, { label: string; icon: () => ReactNode; accent: boolean } | null> = {
  manual: null,
  mako: { label: 'MaKo', icon: () => <span style={{ color: 'var(--accent)' }}>✦</span>, accent: true },
  fathom: { label: 'Fathom', icon: () => <SvcIcon k="fathom" size={11} box={16} radius={4} />, accent: true },
  whatsapp: { label: 'WhatsApp', icon: () => <SvcIcon k="whatsapp" size={11} box={16} radius={4} />, accent: true },
  archivo: { label: 'Archivo', icon: () => <span>📄</span>, accent: false },
  'claude-code': { label: 'Claude Code', icon: () => <span style={{ fontFamily: MONO, fontWeight: 700 }}>‹╱›</span>, accent: false },
  retro: { label: 'Retro', icon: () => <span>🔎</span>, accent: true },
  experimento: { label: 'Experimento', icon: () => <span>🧪</span>, accent: true },
};
function FuenteChip({ fuente }: { fuente: Fuente }) {
  const m = FUENTE_META[fuente.tipo];
  if (!m) return null; // manual (del usuario) → sin chip
  const clickable = !!fuente.url;
  const style: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700,
    color: m.accent ? 'var(--accent)' : 'var(--dim)', background: 'var(--surface)',
    border: `1px solid ${m.accent ? 'var(--primary-weak)' : 'var(--border-strong)'}`,
    borderRadius: 6, padding: '2px 7px', maxWidth: 250, minWidth: 0, textDecoration: 'none',
    cursor: clickable ? 'pointer' : 'default',
  };
  const cuerpo = <>
    <span style={{ flex: 'none', display: 'inline-flex', lineHeight: 0 }}>{m.icon()}</span>
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.label}{fuente.etiqueta ? ` · ${fuente.etiqueta}` : ''}</span>
    {clickable && <span style={{ flex: 'none', opacity: 0.7 }}>↗</span>}
  </>;
  const title = `${m.label}${fuente.etiqueta ? ` · ${fuente.etiqueta}` : ''}${clickable ? ' — abrir' : ''}`;
  return clickable
    ? <a href={fuente.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title={title} style={style}>{cuerpo}</a>
    : <span title={title} style={style}>{cuerpo}</span>;
}
// El alta se muestra con una frase que nombra al autor ("Creada por MaKo") en vez
// del texto crudo. Pero cuando MaKo además dejó asentado QUÉ hizo (todo lo que va
// después del " — "), ese porqué tiene que sobrevivir: si no, una tanda entera de
// tarjetas creadas por la IA queda sin rastro de dónde salió.
function partirCreacion(text: string, prefijo: string): { esCreacion: boolean; porque: string } {
  if (!text.startsWith(prefijo)) return { esCreacion: false, porque: '' };
  return { esCreacion: true, porque: text.slice(prefijo.length).replace(/^\s*—\s*/, '').trim() };
}

// Quién figura como autor de una entrada del historial.
const autorDe = (actor: Actor, nombre: string) => ACTOR_LABEL[actor] || nombre || 'Usuario';
// La frase del alta. 'code' se nombra distinto A PROPÓSITO: que una tarjeta la haya
// escrito un dev en el SEED no es lo mismo que la haya sacado MaKo de tus datos.
const frasePorAlta = (actor: Actor, nombre: string, genero: 'a' | 'o') =>
  actor === 'ia' ? `Cread${genero} por MaKo`
    : actor === 'code' ? `Cread desde el código`
      : `Cread${genero} por ${nombre || 'ti'}`;

// Avatar para el change history: MaKo → ✦; Claude Code → ‹╱›; usuario → foto o inicial.
function ActorAvatar({ actor, nombre, avatarUrl, size = 24 }: { actor: Actor; nombre: string; avatarUrl: string; size?: number }) {
  if (actor === 'ia') return <span title="MaKo" style={{ width: size, height: size, borderRadius: '50%', background: 'var(--accent)' + '1f', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.55, flex: 'none' }}>✦</span>;
  if (actor === 'code') return <span title="Claude Code" style={{ width: size, height: size, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontFamily: MONO, fontWeight: 700, flex: 'none' }}>╱</span>;
  if (avatarUrl) /* eslint-disable-next-line @next/next/no-img-element */
    return <img src={avatarUrl} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />;
  const ini = (nombre || 'U').trim().slice(0, 1).toUpperCase();
  return <span style={{ width: size, height: size, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45, fontWeight: 700, flex: 'none' }}>{ini}</span>;
}

// ── tarjeta (cuadrada, estilo CRM; la columna la decide el guardián, no se arrastra) ─
// El emoji de una tarea = el de su proyecto principal (feedback jul-18): más simple
// y coherente que un emoji propio por tarea. Sin proyecto → 📌.
const emojiTarea = (board: Board, t: BoardTask): string => board.labelById(t.labels[0])?.emoji || t.emoji || '📌';


// Tarjeta de tarea: ALTURA FIJA para que todas midan igual (feedback jul-18). El
// título se recorta a 2 líneas; el toggle de completar es compacto (inline), no una
// píldora que agrandaba unas cards más que otras.
function CardTile({ t, board, warn, frenanA = [], onOpen, onWarn, onOpenProj, tactil }: {
  t: BoardTask; board: Board; warn: boolean; frenanA?: string[]; onOpen: (id: string) => void; onWarn: (id: string) => void; onOpenProj?: (id: string) => void;
  /** el arrastre con el dedo (sólo en el Kanban; en el resto de las vistas no existe) */
  tactil?: ArrastreTactil;
}) {
  const done = t.progress >= 100;
  const levantada = tactil?.arrastrando === t.id;
  // ⚠️ EL ARRASTRE CON MOUSE NO TENÍA NINGÚN FEEDBACK. `levantada` es del camino TÁCTIL
  // (pointer events); el de mouse es HTML5 drag-and-drop, que no avisa nada por su cuenta:
  // la tarjeta se quedaba quieta mientras el cursor se llevaba una miniatura fantasma del
  // navegador. «Al intentar agarrar una tarea del kanban, debería tener la misma animación
  // que tenemos hoy en día en el CRM» (23/09/2026) — y son los mismos tres valores que usa
  // `CrmBoard.tsx`: se atenúa, se achica un poco y se despega con una sombra.
  const [agarrada, setAgarrada] = useState(false);
  const enMano = levantada || agarrada;
  // A qué proyecto pertenece. El kanban agrupa por PRIORIDAD, así que sin esto una
  // columna es una lista de tareas sueltas y hay que abrir cada una para saber de qué
  // parte del plan es. Va en el lugar del emoji —que ya era el del proyecto, solo que
  // mudo— para no gastar una fila: la card mide 138px fijos y el título necesita sus
  // dos líneas. Mismo chip que el detalle (color del proyecto), no un estilo nuevo.
  const proys = t.labels.map((id) => board.labelById(id)).filter((l): l is Label => l != null);
  return (
    <div
      // ⚠️ El click se traga si el gesto anterior fue un arrastre: el navegador sintetiza un
      // `click` sobre donde empezó el toque, y sin esto se soltaba la tarjeta, salía el
      // pop-up de la prioridad y DETRÁS se abría el detalle.
      onClick={() => { if (!tactil?.huboArrastre()) onOpen(t.id); }}
      onPointerDown={(e) => tactil?.alTocar(e, t.id)}
      draggable={!!board.repo.prioridadManual}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; setAgarrada(true); }}
      onDragEnd={() => setAgarrada(false)}
      style={{ background: 'var(--surface-2)', border: `1px solid ${enMano ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 11, padding: '12px 14px', cursor: board.repo.prioridadManual ? (agarrada ? 'grabbing' : 'grab') : 'pointer', opacity: agarrada ? 0.5 : done ? 0.62 : 1, height: 138, display: 'flex', flexDirection: 'column', transition: 'border-color .12s, transform .15s, box-shadow .15s, opacity .15s',
        // `manipulation` saca el retardo del doble-tap sin tocar el scroll. `none` NO va:
        // es CSS, decide antes de que exista el listener y apagaría el scroll de la página
        // sobre cada tarjeta.
        touchAction: 'manipulation',
        // Con el dedo la tarjeta se LEVANTA (crece): el dedo la tapa y hay que verla salir.
        // Con el mouse se HUNDE (se achica y se atenúa), igual que en el CRM: lo que se
        // mueve es la miniatura que dibuja el navegador, y la tarjeta de abajo es el hueco
        // que dejó.
        ...(levantada ? { transform: 'scale(1.03)', boxShadow: '0 10px 24px rgba(18,21,27,.22)' }
          : agarrada ? { transform: 'scale(0.97)', boxShadow: '0 10px 26px rgba(18,21,27,.20)' } : {}) }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')} onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}>
      {/* header: proyecto + #id + [aviso] + prioridad */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7, minWidth: 0 }}>
        {proys.length > 0
          ? <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, overflow: 'hidden' }}>
              {/* Con más de un proyecto entra también el "+N": el chip cede ancho para
                  que #id, el aviso y el score no queden sin lugar en una card de 249px. */}
              <LabelChips chips={proys} max={1} cap={proys.length > 1 ? 74 : 96} onOpen={onOpenProj} />
            </span>
          : <span style={{ fontSize: 17, lineHeight: 1, flex: 'none' }}>{emojiTarea(board, t)}</span>}
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', flex: 'none' }}>#{t.num}</span>
        <span style={{ flex: 1, minWidth: 0 }} />
        {/* El candado va COMPACTO en la tarjeta: la card mide 138px fijos y el título
            necesita sus dos líneas. El nombre de lo que la frena vive en el tooltip y en
            el detalle, que es donde hay lugar para decirlo entero. */}
        <BloqueoChip porQue={frenanA} compacto />
        <TiempoChip t={t} />
        {warn && <WarnMark title="Falta el deadline" onClick={(e) => { e.stopPropagation(); onWarn(t.id); }} />}
        <ScoreBadge score={t.score} />
      </div>
      {/* título a 2 líneas máx (recortado) → todas las cards miden igual */}
      <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, color: 'var(--ink)', textDecoration: done ? 'line-through' : 'none', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>{t.title}</div>
      <span style={{ flex: 1 }} />
      {/* footer fijo: deadline a la izquierda, el CHECK a la derecha.
          Sin el % y sin la barra: «una tarea se completa o no se completa», y el check
          está siempre a la vista porque el estado tenía que verse sin entrar al detalle
          («no me dice si está terminado o no»). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22 }}>
        {t.deadline && <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--dim)' }}>◷ {t.deadline.slice(5)}</span>}
        <span style={{ flex: 1 }} />
        <button onClick={(e) => { e.stopPropagation(); board.toggleDone(t.id); }} title={done ? 'Marcar sin completar' : 'Marcar completada'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: SANS, fontSize: 10.5, fontWeight: 700, color: done ? 'var(--good)' : 'var(--faint)' }}>
          <span style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${done ? 'var(--good)' : 'var(--border-strong)'}`, background: done ? 'var(--good)' : 'transparent', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{done ? '✓' : ''}</span>
          {done ? 'Hecha' : 'Completar'}
        </button>
      </div>
    </div>
  );
}

/**
 * El bloque de un proyecto sin tareas abiertas.
 *
 * La corrección del dueño fue de categoría: *«Un proyecto vacío NO debe tener una
 * puntuación de 1. Todo lo contrario. Si se creó un proyecto es por algo… lo que se debe
 * hacer es cargarle tareas»*. La primera versión los hundía, o sea trataba «no sé» como «no
 * importa». Acá no se dice cuánto valen: se ofrece la única acción que los saca del limbo.
 *
 * ⚠️ No escribe ninguna tarea: deja un BORRADOR y devuelve el link para revisarlo, con el
 * mismo form de preguntas que el resto del tablero. Un canal PROPONE, una persona confirma
 * — y acá pesa doble, porque lo propuesto sale de una intuición sobre un nombre de proyecto.
 */
function ProyectoVacioBloque({ proj }: { proj: Label }) {
  const [estado, setEstado] = useState<'quieto' | 'pensando' | 'listo' | 'error'>('quieto');
  const [msg, setMsg] = useState('');
  const [link, setLink] = useState('');
  const pedir = async () => {
    setEstado('pensando'); setMsg('');
    const j = await apiPlan({ action: 'proponer-tareas-proyecto', id: proj.id }) as { ok: boolean; error?: string; propuestaId?: string; n?: number };
    if (!j.ok || !j.propuestaId) { setEstado('error'); setMsg(j.error || 'No se pudo.'); return; }
    setLink(`/plan/revisar/${j.propuestaId}`);
    setMsg(`${j.n} ${j.n === 1 ? 'tarea propuesta' : 'tareas propuestas'} para revisar.`);
    setEstado('listo');
  };
  return (
    <div style={{ border: '1px solid var(--border-strong)', borderRadius: 12, padding: 14, background: 'var(--surface-2)', marginBottom: 4 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Este proyecto no tiene ninguna tarea abierta.</div>
      <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 10 }}>
        No es que valga poco: le falta el trabajo. MaKo puede intuir qué tareas tendría y dejártelas en un borrador para que las corrijas antes de que entren al plan.
      </div>
      {estado === 'listo' ? (
        <div style={{ fontSize: 13, color: 'var(--ink)' }}>
          ✓ {msg} <Link href={link} style={{ color: 'var(--primary)', fontWeight: 700 }}>Abrir la revisión →</Link>
        </div>
      ) : (
        <>
          <button onClick={() => void pedir()} disabled={estado === 'pensando'}
            style={{ border: 'none', background: 'var(--primary)', color: '#fff', borderRadius: 9, padding: '8px 14px', cursor: estado === 'pensando' ? 'wait' : 'pointer', fontFamily: SANS, fontSize: 13, fontWeight: 700 }}>
            {estado === 'pensando' ? 'MaKo está pensando…' : `Que MaKo proponga tareas para «${proj.name.slice(0, 28)}»`}
          </button>
          {estado === 'error' && <div style={{ fontSize: 12.5, color: 'var(--bad, #C0392B)', marginTop: 8 }}>{msg}</div>}
        </>
      )}
    </div>
  );
}

/**
 * EN QUÉ ESCALÓN DE LA ESCALERA DEL DINERO cae este proyecto (mig 0142).
 *
 * Es lo que contesta la pregunta del dueño —«¿en qué me acerca eso a lo que configuramos en
 * el perro?»— sin tener que leer la razón entera: 1 cobrar · 2 traer una conversación nueva ·
 * 3 no perder a un cliente que ya está adentro · 4 convertir mejor · 5 construir capacidad.
 *
 * Hasta que existió esta columna, el escalón se decidía en cada corrida, se escribía adentro
 * de una frase y ahí moría. Ahora se ve, y por eso se puede discutir.
 */
function EscalonChip({ l }: { l: Label }) {
  const e = l.escalon ? ESCALERA[l.escalon] : null;
  if (!e) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
      <span title={e.largo} style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mako-ink, var(--primary))', background: 'color-mix(in srgb, var(--primary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)', borderRadius: 5, padding: '2px 7px' }}>
        💰 {l.escalon} · {e.corto}
      </span>
      {/* Un escalón 5 solo puede ganarle a los de arriba si dice A CUÁL habilita. Sin esa
          frase no es una excepción justificada: es «construir» disfrazado de prioridad. */}
      {l.escalon === 5 && l.desbloquea && <span style={{ fontSize: 11, color: 'var(--dim)' }}>desbloquea: {l.desbloquea}</span>}
    </div>
  );
}

/** La versión larga del `TiempoChip`, para el detalle: acá sí hay lugar para la frase. */
function TiempoLinea({ t }: { t: BoardTask }) {
  const ahora = Date.now();
  const aj = ajusteTemporal({ quieta: diasQuieta(t.historial, t.creadaEn, ahora), alDeadline: diasAlDeadline(t.deadline || undefined, ahora) });
  if (aj.delta === 0) return null;
  const sube = aj.delta > 0;
  return (
    <div style={{ fontSize: 11.5, color: sube ? 'var(--warn, #B4762A)' : 'var(--dim)', lineHeight: 1.4, marginBottom: 8 }}>
      {/* Antes decía «debatila y el Perro la vuelve a fijar», y esa era la única salida.
          Desde que el número se mueve acá arriba, mandar a debatir es mandar por el camino
          largo: el debate queda para cuando querés que te discutan el número. */}
      {sube ? '◷' : '💤'} {sube ? 'Subió' : 'Bajó'} de prioridad porque {aj.razon}. Si no corresponde, cámbiala arriba.
    </div>
  );
}

/**
 * Por qué el tiempo movió esta tarjeta. Sale de las MISMAS funciones puras que usa el
 * reparto del servidor (`envejecer.ts`), no de una copia: un chip que dice una cosa y un
 * ranking que hace otra es el bug que este tablero ya pagó dos veces.
 *
 * Existe porque un score que se mueve solo y no dice por qué es exactamente lo que el
 * dueño reportó del tablero entero. Si baja, tiene que poder discutirlo.
 */
function TiempoChip({ t }: { t: BoardTask }) {
  const ahora = Date.now();
  const aj = ajusteTemporal({ quieta: diasQuieta(t.historial, t.creadaEn, ahora), alDeadline: diasAlDeadline(t.deadline || undefined, ahora) });
  if (aj.delta === 0) return null;
  const sube = aj.delta > 0;
  return (
    <span title={`${sube ? 'Subió' : 'Bajó'} de prioridad: ${aj.razon}`}
      style={{ flex: 'none', fontFamily: MONO, fontSize: 10, fontWeight: 700, color: sube ? 'var(--warn, #B4762A)' : 'var(--faint)' }}>
      {sube ? '◷' : '💤'}
    </span>
  );
}

/**
 * El candado. UNA pieza, usada en la tarjeta del Kanban, en la fila de Prioridades y en el
 * detalle — porque el chip y el ranking tienen que decir lo mismo, y cinco copias de un
 * chip son cinco lugares donde eso deja de pasar.
 *
 * El `title` NOMBRA lo que frena. Un candado que solo dice «bloqueada» obliga a abrir la
 * tarjeta para saber qué esperar, que es justo lo que el candado venía a evitar.
 */
function BloqueoChip({ porQue, compacto = false }: { porQue: string[]; compacto?: boolean }) {
  if (!porQue.length) return null;
  const t = porQue.length === 1 ? `Espera a «${porQue[0]}»` : `Espera a ${porQue.length} cosas: ${porQue.join(' · ')}`;
  return (
    <span title={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none', fontFamily: MONO, fontSize: 10, fontWeight: 700, color: 'var(--warn, #B4762A)', background: 'color-mix(in srgb, var(--warn, #B4762A) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--warn, #B4762A) 30%, transparent)', borderRadius: 5, padding: '1px 5px', maxWidth: compacto ? 22 : 150, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
      🔒{compacto ? '' : ` ${porQue.length > 1 ? `${porQue.length} pendientes` : porQue[0]}`}
    </span>
  );
}

// ── vista Kanban (4 columnas por prioridad derivada del score; ancho completo) ──
function Kanban({ tasks, board, topProjectId, sortMode, sortDir, frenanA, onOpen, onNew, onWarn, onOpenProj, onSoltar }: {
  tasks: BoardTask[]; board: Board; topProjectId: string | null; sortMode: 'score' | 'creacion'; sortDir: 'desc' | 'asc'; frenanA: (id: string) => string[]; onOpen: (id: string) => void; onNew: (p?: Prio) => void; onWarn: (id: string) => void; onOpenProj: (id: string) => void;
  /** soltaste una tarjeta en otra columna: NO se fija sola, se pregunta el número */
  onSoltar: (id: string, destino: Prio) => void;
}) {
  // dir = -1 → desc (mayor score / #num más alto = más nuevo, primero); +1 → asc (al revés).
  const dir = sortDir === 'asc' ? 1 : -1;
  // EL ARRASTRE CON EL DEDO. El mouse sigue por HTML5 drag-and-drop (ya funciona y ya está
  // probado); esto corre sólo cuando el puntero NO es un mouse. Ver arrastre-tactil.ts: ahí
  // están las cuatro trampas que hacen que un arrastre táctil se pelee con el scroll, con
  // los clicks de adentro de la tarjeta y con el click fantasma del final.
  const prioDe = useCallback((id: string) => {
    const t = tasks.find((x) => x.id === id);
    return t ? displayPrio(t, topProjectId) : null;
  }, [tasks, topProjectId]);
  const tactil = useArrastreTactil(onSoltar, prioDe, !!board.repo.prioridadManual);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, padding: '18px 30px 30px', flex: '1 0 auto', alignItems: 'flex-start' }} className="mako-board">
      <style>{`@media (max-width:1000px){.mako-board{grid-template-columns:repeat(2,1fr)!important}}@media (max-width:560px){.mako-board{grid-template-columns:1fr!important}}`}</style>
      {PRIOS.map((p) => {
        const items = tasks.filter((t) => displayPrio(t, topProjectId) === p).sort((a, b) => (a.progress >= 100 ? 1 : 0) - (b.progress >= 100 ? 1 : 0) || (sortMode === 'creacion' ? dir * (a.num - b.num) : (dir * (a.score - b.score) || b.num - a.num)));
        return (
          <section key={p}
            // Soltar una tarjeta acá ABRE EL POP-UP del 1 al 100; la columna solo dice la
            // banda. `preventDefault` en dragOver es lo que habilita el drop (sin él, el
            // navegador lo rechaza y no pasa nada, que se lee como que el arrastre no anda).
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.currentTarget.style.background = 'var(--surface-2)'; }}
            onDragLeave={(e) => { e.currentTarget.style.background = 'var(--surface)'; }}
            onDrop={(e) => { e.preventDefault(); e.currentTarget.style.background = 'var(--surface)'; const id = e.dataTransfer.getData('text/plain'); if (id) onSoltar(id, p); }}
            // `data-prio` es cómo el arrastre táctil sabe dónde está cada columna: al armarse
            // el gesto mide estos cuatro rectángulos UNA vez y después no vuelve a leer layout.
            data-prio={p}
            style={{ display: 'flex', flexDirection: 'column', minWidth: 0, background: tactil.sobre === p ? 'var(--surface-2)' : 'var(--surface)', border: '1px solid ' + (tactil.sobre === p ? PCOLOR[p] : 'var(--border)'), borderTop: '3px solid ' + PCOLOR[p], borderRadius: 14, padding: 10, transition: 'background .12s, border-color .12s' }}>
            <ColHeader p={p} count={items.length} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, minHeight: 30, paddingRight: 2 }}>
              {/* card gris translúcida para crear (arriba de todo, más bajita que las tarjetas) */}
              <button onClick={() => onNew(p)} style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1.5px dashed var(--border-strong)', background: 'transparent', borderRadius: 10, padding: '9px 10px', cursor: 'pointer', color: 'var(--faint)', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, opacity: 0.8, transition: 'border-color .12s, color .12s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--faint)'; }}>＋ Nueva tarea</button>
              {items.length === 0 && <div style={{ fontSize: 12, color: 'var(--faint)', textAlign: 'center', padding: '10px 0' }}>—</div>}
              {items.map((t) => <CardTile key={t.id} t={t} board={board} frenanA={frenanA(t.id)} warn={displayPrio(t, topProjectId) === 'alta' && t.progress < 100 && !t.deadline} onOpen={onOpen} onWarn={onWarn} onOpenProj={onOpenProj} tactil={tactil} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
function ColHeader({ p, count }: { p: Prio; count: number }) {
  return (
    <div style={{ flex: 'none', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 3px 8px' }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: PCOLOR[p], flex: 'none' }} />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--dim)' }}>{PLABEL[p]}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', background: 'var(--surface-2)', borderRadius: 999, padding: '1px 8px' }}>{count}</span>
      </div>
    </div>
  );
}

// ── vista Prioridades: Objetivo Principal a la IZQUIERDA (alto, clickeable) + las
// 3 tareas a la DERECHA (feedback #11 y #3). ─────────────────────────────────────
function Prioridades({ tasks, board, objetivo, bloqueadas = 0, onOpen, onOpenProj }: { tasks: BoardTask[]; board: Board; objetivo: Label | null; bloqueadas?: number; onOpen: (id: string) => void; onOpenProj: (id: string) => void }) {
  return (
    // FLUIDA, no de ancho fijo. Antes era `maxWidth: 1060` + una columna clavada en
    // 336px y una media query a 840: con el zoom del navegador (que cambia el ancho en
    // píxeles CSS) quedaba una isla del mismo tamaño en el medio de la pantalla —
    // achicando el zoom sobraba medio monitor vacío, y agrandándolo saltaba de golpe a
    // una sola columna. Ahora las dos columnas son elásticas con un mínimo y el corte
    // lo hace el propio `flex-wrap` cuando de verdad no entran: acompaña cualquier zoom
    // sin escalones.
    <div style={{ flex: '1 0 auto', display: 'flex', justifyContent: 'center', padding: 'clamp(12px,1.6vw,18px) clamp(14px,2.4vw,30px) 40px' }}>
      <div className="mako-prio" style={{ width: '100%', maxWidth: 'min(1400px, 100%)', display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'stretch' }}>
        {/* IZQUIERDA — Objetivo Principal (card alto, clickeable) */}
        {/* El objetivo es UN PROYECTO, así que ocupa lo mismo que un proyecto: la grilla
            de Proyectos usa tarjetas de ~240-300px y esta se estiraba hasta 440, con lo
            que en pantalla ancha parecía otra cosa. Se tiene que reconocer por el diseño
            —borde de color arriba, emoji, P#, avance— sin leer una palabra. */}
        <div className="mako-prio-obj" style={{ flex: '0 1 300px', maxWidth: 320, minWidth: 240, display: 'flex' }}>
          {objetivo ? <ObjetivoCard objetivo={objetivo} prog={projProgress(board.tasks, objetivo.id)} onOpen={() => onOpenProj(objetivo.id)} /> : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--faint)', fontSize: 13.5, border: '1px dashed var(--border-strong)', borderRadius: 16, padding: 24 }}>Todavía no hay un Objetivo Principal. Crea un proyecto y el perro elige el norte.</div>
          )}
        </div>
        {/* DERECHA — las 3 tareas en prioridad. `flex: 2 1 380px`: crece el doble que
            el objetivo cuando sobra lugar y se va abajo sola cuando no entra. */}
        <div style={{ flex: '2 1 380px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 700 }}>🎯 Tareas prioritarias · {tasks.length}/{MAX_PRIORIDAD}</div>
            {/* Una lista más corta de lo esperado sin explicación se lee como «no hay nada
                más que hacer», que es lo contrario de lo que pasa. Si algo quedó afuera por
                estar frenado, se dice acá — el número es el aviso de que la cadena está
                trabada y de que lo que conviene atacar es lo que la destraba. */}
            {bloqueadas > 0 && <span style={{ fontSize: 12, color: 'var(--dim)' }}>🔒 {bloqueadas} {bloqueadas === 1 ? 'frenada' : 'frenadas'} por otra cosa · no entran aquí hasta que se destraben</span>}
          </div>
          {tasks.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--faint)', textAlign: 'center', padding: '24px 20px', border: '1px dashed var(--border-strong)', borderRadius: 14 }}>
              {/* Acá SOLO se llega con el plan entero terminado: la lista se completa con
                  lo mejor del resto de los proyectos, así que si está vacía es que no
                  queda ni una tarea abierta. Decirlo así y no "todavía no hay ninguna". */}
              <div style={{ fontSize: 14, maxWidth: 400, lineHeight: 1.5 }}>No queda ninguna tarea abierta en todo el plan. Crea una nueva o saca los pendientes de tu última reunión.</div>
            </div>
          )}
          {tasks.map((t, i) => {
            // A qué proyecto pertenece. Antes solo se decía cuando la tarjeta NO era del
            // Objetivo Principal (entraba para completar las 3); ahora se dice siempre,
            // porque saber de qué parte del plan es una tarea no debería depender de
            // abrirla. El chip es el mismo del detalle: color del proyecto. UNO solo +
            // "+N" (con su desplegable al pasar el mouse): con dos chips largos, el
            // proyecto le ganaba en peso visual al título, que es lo que hay que leer.
            const proys = t.labels.map((id) => board.labelById(id)).filter((l): l is Label => l != null);
            return (
              <div key={t.id} onClick={() => onOpen(t.id)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px', boxShadow: '0 1px 2px rgba(18,21,27,.05)', cursor: 'pointer', transition: 'border-color .12s' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')} onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}>
                {/* Como el proyecto de al lado (feedback jul-18): arriba ranking + proyecto
                    + #id + prioridad; el título abajo, en su línea. El emoji suelto se fue:
                    era el del proyecto, y ahora va DENTRO del chip en vez de repetido. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, minWidth: 0 }}>
                  <span title={`Prioridad ${i + 1}`} style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', fontFamily: MONO }}>{i + 1}</span>
                  {proys.length > 0
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><LabelChips chips={proys} max={1} cap={240} onOpen={onOpenProj} /></span>
                    : <span style={{ fontSize: 22, lineHeight: 1, flex: 'none' }}>{emojiTarea(board, t)}</span>}
                  <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)', flex: 'none' }}>#{t.num}</span>
                  <span style={{ flex: 1, minWidth: 0 }} />
                  {!t.deadline && <WarnMark title="Falta el deadline" size={16} />}
                  <ScoreBadge score={t.score} />
                </div>
                <div style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.3, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 12 }}>{t.title}</div>
                {/* El DEADLINE a la vista y el check para completar. Antes acá vivían la
                    barra de avance, el % y la checklist plegable: los tres se fueron con
                    la checklist («una tarea se completa o no se completa»), y lo que
                    faltaba era justamente cuándo vence y cuánto falta. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {t.deadline && (() => {
                    const p = plazoTexto(diasHasta(t.deadline, hoyISO()));
                    return <span style={{ fontSize: 13, color: 'var(--dim)' }}>◷ {fechaConDia(t.deadline)} <span style={{ color: p.color, fontWeight: p.fuerte ? 700 : 500 }}>· {p.texto}</span></span>;
                  })()}
                  <span style={{ flex: 1 }} />
                  <button onClick={(e) => { e.stopPropagation(); board.toggleDone(t.id); }} title="Marcar como completada"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>
                    <span style={{ width: 15, height: 15, borderRadius: 4, border: '1.5px solid var(--border-strong)', flex: 'none' }} />
                    Completar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Card del Objetivo Principal (izquierda de Prioridades). Alto, clickeable → abre el
// proyecto. Solo emoji + nombre + score: el detalle y el porqué viven adentro.
function ObjetivoCard({ objetivo, onOpen, prog }: { objetivo: Label; onOpen: () => void; prog: { total: number; done: number; pct: number } }) {
  return (
    <div onClick={onOpen} style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: `1px solid ${objetivo.color}59`, borderTop: `4px solid ${objetivo.color}`, borderRadius: 14, padding: '16px 17px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(18,21,27,.05)', transition: 'border-color .12s' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = objetivo.color; e.currentTarget.style.borderTopColor = objetivo.color; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = objetivo.color + '59'; e.currentTarget.style.borderTopColor = objetivo.color; }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: objetivo.color, fontWeight: 700 }}>🎯 Objetivo Principal</span>
        <span style={{ flex: 1 }} />
        <ProjScore score={objetivo.score} color={objetivo.color} />
      </div>
      {/* emoji + id (mismo tamaño/color que en el kanban) antes del nombre */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>{objetivo.emoji}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{objetivo.pid}</span>
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1.3 }}>{objetivo.name}</div>
      <span style={{ flex: 1 }} />
      {/* Barra de progreso del proyecto (feedback jul-17): igual que en la grilla. */}
      <div style={{ marginTop: 16 }}>
        <MiniBar v={prog.pct} />
        {/* avance/porcentaje en cada extremo, como en la grilla de proyectos (feedback jul-18) */}
        <div style={{ display: 'flex', alignItems: 'center', fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', marginTop: 6 }}>
          {prog.total ? <><span>{prog.done}/{prog.total} tareas</span><span style={{ flex: 1 }} /><span style={{ fontWeight: 700, color: 'var(--dim)' }}>{prog.pct}%</span></> : <span>sin tareas</span>}
        </div>
      </div>
    </div>
  );
}

// ── filtro por etiqueta ─────────────────────────────────────────────────────────
// Botón "Filtrar" de CAPAS (#13): estado + etiquetas + ORIGEN (fuente) + ORDEN.
// `labels` opcional: en Proyectos solo va la capa de estado. `fOrigen`/`sortMode`
// opcionales: si vienen, se muestran esas capas (aplican a tareas y a proyectos).
const ORIGEN_OPS: Array<[string, string]> = [
  ['whatsapp', '💬 WhatsApp'], ['fathom', '🎙️ Reunión · Fathom'], ['claude-code', '⌨️ Claude Code'],
  ['archivo', '📄 Archivos subidos'], ['mako', '✨ MaKo'], ['manual', '✍️ Manual'],
];
type FiltroVista = 'root' | 'estado' | 'proyecto' | 'origen' | 'orden' | 'cuando';
function FilterMenu({ labels, fLabels, setFLabels, doneFilter, setDoneFilter, estadoLabels, fOrigen, setFOrigen, fCuando, setFCuando, sortMode, setSortMode, sortDir, setSortDir, soloIcono }: {
  /** sin lugar: queda el embudo solo (la palabra son ~55px). */
  soloIcono?: boolean;
  labels?: Label[]; fLabels?: Set<string>; setFLabels?: (s: Set<string>) => void;
  doneFilter: DoneFilter; setDoneFilter: (f: DoneFilter) => void; estadoLabels?: Array<[DoneFilter, string]>;
  fOrigen?: Set<string>; setFOrigen?: (s: Set<string>) => void;
  fCuando?: Set<Cuando>; setFCuando?: (s: Set<Cuando>) => void;
  sortMode?: 'score' | 'creacion'; setSortMode?: (m: 'score' | 'creacion') => void;
  sortDir?: 'desc' | 'asc'; setSortDir?: (d: 'desc' | 'asc') => void;
}) {
  const [open, setOpen] = useState(false);
  // Drill-down (feedback: la lista apilada obligaba a un scroll gigante). En 'root' se
  // ven las 4 categorías; al tocar una, su contenido reemplaza el panel EN EL MISMO
  // lugar, con un "‹ volver". Así nunca hay más de una categoría en pantalla a la vez.
  const [vista, setVista] = useState<FiltroVista>('root');
  const cerrar = () => { setOpen(false); setVista('root'); };
  const n = (fLabels?.size ?? 0) + (fOrigen?.size ?? 0) + (fCuando?.size ?? 0) + (doneFilter !== 'all' ? 1 : 0);
  const toggle = (id: string) => { if (!fLabels || !setFLabels) return; const c = new Set(fLabels); if (c.has(id)) c.delete(id); else c.add(id); setFLabels(c); };
  const toggleOrigen = (tipo: string) => { if (!fOrigen || !setFOrigen) return; const c = new Set(fOrigen); if (c.has(tipo)) c.delete(tipo); else c.add(tipo); setFOrigen(c); };
  const toggleCuando = (v: Cuando) => { if (!fCuando || !setFCuando) return; const c = new Set(fCuando); if (c.has(v)) c.delete(v); else c.add(v); setFCuando(c); };
  const ops = estadoLabels ?? ESTADO_OPS;
  const check = (on: boolean): CSSProperties => ({ width: 14, height: 14, borderRadius: 4, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' });
  const radio = (on: boolean): CSSProperties => ({ width: 13, height: 13, borderRadius: '50%', border: `2px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', flex: 'none', boxShadow: on ? 'inset 0 0 0 2px var(--surface)' : 'none' });
  const rowBtn: CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 9px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12.5, color: 'var(--ink)', textAlign: 'left', fontFamily: SANS };

  // Resúmenes que se muestran en la fila de cada categoría (el valor actual, a la derecha).
  const estadoLabel = ops.find(([v]) => v === doneFilter)?.[1] ?? ops[0][1];
  const proyResumen = fLabels?.size ? `${fLabels.size} elegido${fLabels.size > 1 ? 's' : ''}` : 'Todos';
  const origenResumen = !fOrigen?.size ? 'Todos' : (fOrigen.size === 1 ? (ORIGEN_OPS.find(([t]) => fOrigen.has(t))?.[1].replace(/^\S+\s/, '') ?? '1') : `${fOrigen.size} elegidos`);
  const cuandoResumen = !fCuando?.size ? 'Todas'
    : fCuando.size === 1 ? CUANDO_LABEL[[...fCuando][0]] : `${fCuando.size} ventanas`;
  const modeLabel = sortMode === 'creacion' ? 'Por creación' : 'Por prioridad';
  const ordenResumen = `${modeLabel} ${sortDir === 'asc' ? '↑' : '↓'}`;

  // Categorías del menú. ORDENAR va PRIMERO (pedido de Martín). El resto: las que
  // apliquen (en la vista Proyectos no va "Proyecto", etc.).
  const cats: Array<{ key: FiltroVista; label: string; resumen: string; activo: boolean }> = [];
  if (sortMode && setSortMode) cats.push({ key: 'orden', label: 'Ordenar', resumen: ordenResumen, activo: false });
  // «Cuando» va ARRIBA de «Estado»: la pregunta de quien abre el tablero a la manana
  // es que le toca HOY, no en que estado esta cada cosa.
  if (fCuando && setFCuando) cats.push({ key: 'cuando', label: 'Cuando', resumen: cuandoResumen, activo: !!fCuando.size });
  cats.push({ key: 'estado', label: 'Estado', resumen: estadoLabel, activo: doneFilter !== 'all' });
  if (labels && labels.length > 0) cats.push({ key: 'proyecto', label: 'Proyecto', resumen: proyResumen, activo: !!fLabels?.size });
  if (fOrigen && setFOrigen) cats.push({ key: 'origen', label: 'Origen', resumen: origenResumen, activo: !!fOrigen.size });

  const catRow: CSSProperties = { ...rowBtn, justifyContent: 'space-between', padding: '10px 9px' };
  const resumenTxt = (activo: boolean): CSSProperties => ({ fontSize: 12, color: activo ? 'var(--primary)' : 'var(--faint)', fontWeight: activo ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 });
  const backBtn: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 6px 10px', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 700, marginBottom: 4 };

  return (
    // ⚠️ `flex: none` VA ACÁ, no solo en el botón de adentro. Este span es el flex item que
    // ve el header, y el grupo que lo contiene tiene `minWidth: 0` para poder achicarse: sin
    // esto el span se comprimía y el botón quedaba CORTADO por su propio borde, con la
    // palabra «Filtrar» saliéndose. Poner `flex: none` en el hijo no sirve — el que se
    // achica es el padre.
    <span style={{ position: 'relative', flex: 'none' }}>
      <button onClick={() => { setOpen((o) => !o); setVista('root'); }} aria-label="Filtrar" title="Filtrar" aria-expanded={open}
        style={{ position: 'relative', ...ghostBtn, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          // Sin la palabra, el alto lo fijaba el texto y el botón quedaba en 41x31 al lado
          // de los de 38x38: tres alturas en la misma fila. La caja es la MISMA siempre.
          height: 38, width: soloIcono ? 38 : undefined, padding: soloIcono ? 0 : '0 13px', flex: 'none', whiteSpace: 'nowrap', background: open ? 'var(--surface-2)' : 'var(--surface)', color: n > 0 ? 'var(--primary)' : 'var(--dim)', borderColor: n > 0 ? 'var(--primary-weak)' : 'var(--border-strong)' }}>
        <FunnelIcon color="var(--primary)" />{!soloIcono && 'Filtrar'}
        {n > 0 && <span onClick={(e) => { e.stopPropagation(); setFLabels?.(new Set()); setFOrigen?.(new Set()); setFCuando?.(new Set()); setDoneFilter('all'); }} title="Limpiar" style={{ position: 'absolute', top: -7, right: -7, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: 'var(--primary)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)' }}>{n}</span>}
      </button>
      {open && <>
        <span onClick={cerrar} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
        <div style={{ position: 'absolute', top: 40, right: 0, zIndex: 41, width: 244, maxHeight: 460, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 16px 40px rgba(18,21,27,.16)', padding: 8 }}>
          {vista === 'root' ? (
            <>
              {cats.map((c) => (
                <button key={c.key} onClick={() => setVista(c.key)} style={catRow}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ fontWeight: 600 }}>{c.label}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={resumenTxt(c.activo)}>{c.resumen}</span>
                    <span style={{ color: 'var(--faint)', fontSize: 16, lineHeight: 1 }}>›</span>
                  </span>
                </button>
              ))}
              {n > 0 && (
                <button onClick={() => { setFLabels?.(new Set()); setFOrigen?.(new Set()); setFCuando?.(new Set()); setDoneFilter('all'); }}
                  style={{ ...rowBtn, justifyContent: 'center', marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 10, color: 'var(--primary)', fontWeight: 600 }}>
                  Limpiar filtros ({n})
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={() => setVista('root')} style={backBtn}>
                <span style={{ fontSize: 15, lineHeight: 1 }}>‹</span>
                {cats.find((c) => c.key === vista)?.label ?? 'Volver'}
              </button>
              {vista === 'estado' && ops.map(([v, label]) => (
                <button key={v} onClick={() => setDoneFilter(v)} style={{ ...rowBtn, background: doneFilter === v ? 'var(--primary-bg)' : 'transparent', fontWeight: doneFilter === v ? 700 : 500 }}>
                  <span style={radio(doneFilter === v)} /><span>{label}</span>
                </button>
              ))}
              {vista === 'proyecto' && labels && labels.map((l) => (
                <button key={l.id} onClick={() => toggle(l.id)} style={rowBtn}>
                  <span style={check(!!fLabels?.has(l.id))}>{fLabels?.has(l.id) ? '✓' : ''}</span>
                  <span>{l.emoji} {l.name}</span>
                </button>
              ))}
              {vista === 'cuando' && CUANDO_OPS.map((v) => (
                <button key={v} onClick={() => toggleCuando(v)} style={rowBtn}>
                  <span style={check(!!fCuando?.has(v))}>{fCuando?.has(v) ? '✓' : ''}</span>
                  <span>{CUANDO_LABEL[v]}</span>
                </button>
              ))}
              {vista === 'origen' && ORIGEN_OPS.map(([tipo, label]) => (
                <button key={tipo} onClick={() => toggleOrigen(tipo)} style={rowBtn}>
                  <span style={check(!!fOrigen?.has(tipo))}>{fOrigen?.has(tipo) ? '✓' : ''}</span>
                  <span>{label}</span>
                </button>
              ))}
              {vista === 'orden' && (
                // Toggle clásico: 1 clic ordena, otro clic sobre el MISMO invierte la
                // dirección (flecha ↓/↑). Clic en el otro criterio arranca en ↓ (desc).
                ([['score', 'Por prioridad'], ['creacion', 'Por creación']] as Array<['score' | 'creacion', string]>).map(([v, label]) => {
                  const activo = sortMode === v;
                  return (
                    <button key={v} onClick={() => { if (activo) setSortDir?.(sortDir === 'desc' ? 'asc' : 'desc'); else { setSortMode?.(v); setSortDir?.('desc'); } }}
                      style={{ ...rowBtn, justifyContent: 'space-between', background: activo ? 'var(--primary-bg)' : 'transparent', fontWeight: activo ? 700 : 500 }}>
                      <span>{label}</span>
                      <span style={{ fontSize: 15, lineHeight: 1, color: activo ? 'var(--primary)' : 'var(--faint)', width: 14, textAlign: 'center' }}>{activo ? (sortDir === 'asc' ? '↑' : '↓') : ''}</span>
                    </button>
                  );
                })
              )}
            </>
          )}
        </div>
      </>}
    </span>
  );
}

// ── change history (avatar + nombre + deshacer por entrada) ─────────────────────
function ChangeHistory({ t, board, ask }: { t: BoardTask; board: Board; ask: (msg: string, onOk: () => void) => void }) {
  const [nowMs, setNowMs] = useState(0);
  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => { setNowMs(Date.now()); }, []);
  const { nombre, avatarUrl } = board.user;
  // Mismo criterio que el historial de un proyecto: una tarea que pasó por el Perro, por
  // una reunión y por dos scripts junta veinte entradas, y abajo del historial está el
  // resto del detalle.
  const { visibles, boton } = useVerMas(t.historial, { inicial: 8, tanda: 8, estilo: 'texto' });
  if (t.historial.length === 0) return <div style={{ fontSize: 12.5, color: 'var(--faint)', fontStyle: 'italic' }}>Sin actividad todavía. Los cambios van a aparecer aquí.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {visibles.map((h, i) => {
        const { esCreacion, porque } = partirCreacion(h.text, 'Creó la tarjeta');
        return (
          <div key={h.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <ActorAvatar actor={h.actor} nombre={nombre} avatarUrl={avatarUrl} size={26} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.4 }}><strong style={{ fontWeight: 600 }}>{autorDe(h.actor, nombre)}</strong> · {esCreacion ? frasePorAlta(h.actor, nombre, "a") : h.text}{esCreacion && porque && <span style={{ color: 'var(--dim)' }}> — {porque}</span>}</div>
              <div title={nowMs ? relTime(h.ts, nowMs) : ''} style={{ fontSize: 11.5, color: 'var(--faint)' }}>{fechaHora(h.ts)}</div>
            </div>
            {/* solo el ÚLTIMO cambio se puede deshacer (1 en 1, tipo ctrl-z) */}
            {/* #10: no se puede deshacer un cambio de MaKo / el perro — sería saltearse el sistema */}
            {i === 0 && h.undo && h.actor === 'user' && <button onClick={() => ask('Se revierte este cambio y se borra del historial. ¿Seguir?', () => board.undoHist(t.id, h))} title="Deshacer el último cambio" style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 8, padding: '4px 9px', fontSize: 12, cursor: 'pointer', flex: 'none', fontFamily: SANS }}>↶ Deshacer</button>}
          </div>
        );
      })}
      {boton}
    </div>
  );
}

// ── modal de detalle ────────────────────────────────────────────────────────────
export function TaskModal({ t, board, topProjectId, suggestMako = false, trabajando = false, onDebate, onPrioridad, onDelete, onAsignar, onOpenProj, ask, onBack, escDisabled = false, onClose }: {
  t: BoardTask; board: Board; topProjectId: string | null; suggestMako?: boolean;
  /** el Perro está trabajando sobre ESTA tarjeta ahora mismo (recién creada) */
  trabajando?: boolean;
  onDebate: () => void; onPrioridad: () => void; onDelete: () => void; onAsignar: () => void; onOpenProj?: (id: string) => void; ask: (msg: string, onOk: () => void) => void; onBack?: () => void; escDisabled?: boolean; onClose: () => void;
}) {
  const prioEfectiva = displayPrio(t, topProjectId);
  const topeada = prioEfectiva !== prioFromScore(t.score);
  const [mako, setMako] = useState(false);
  const [titleDraft, setTitleDraft] = useState(t.title);

  // commit del título al DESMONTAR (Escape/cierre no dispara onBlur). El detalle lo
  // maneja RichText (commit onBlur).
  const tRef = useRef(t);
  const tdRef = useRef(titleDraft);
  useEffect(() => { tRef.current = t; tdRef.current = titleDraft; });
  useEffect(() => () => { board.setTitle(tRef.current.id, tdRef.current, tRef.current.title); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Escape: si vino de un proyecto, VUELVE al proyecto; si no, cierra. (Blurea primero
  // para commitear el detalle.) No dispara con el submodal de MaKo abierto.
  const salir = onBack ?? onClose;
  // Pila de modales: si esta tarjeta se abrió DESDE otro modal (la revisión de una
  // reunión, por ejemplo), ese otro se esconde mientras esta está arriba y vuelve —con
  // su scroll— al cerrarla. Antes esta se abría DETRÁS y no se veía.
  const capa = useCapaModal(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !mako && !escDisabled) { (document.activeElement as HTMLElement)?.blur?.(); salir(); } };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [mako, escDisabled, salir]);
  const chips = t.labels.map((id) => board.labelById(id)).filter((l): l is Label => l != null);
  const optimizada = t.historial.some((h) => h.text.startsWith('MaKo'));
  const rowLabel: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6, display: 'block' };

  return (
    <div onClick={salir} style={{ position: 'fixed', inset: 0, zIndex: capa.z, background: 'rgba(18,21,27,.35)', backdropFilter: 'blur(2px)', display: capa.visible ? 'flex' : 'none', alignItems: 'flex-start', justifyContent: 'center', padding: '7vh 16px 16px', fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 820, maxHeight: '85vh', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 24px 60px rgba(18,21,27,.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px', borderBottom: '1px solid var(--border)', flex: 'none' }}>
          {onBack && <button onClick={onBack} title="Volver al proyecto" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 8, padding: '5px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>← Volver</button>}
          <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', fontWeight: 600, flex: 'none' }}>#{t.num}</span>
          {/* en el header, compacto (la lista completa está en el sidebar "Proyectos") */}
          <LabelChips chips={chips} max={1} cap={230} onOpen={onOpenProj} />
          <FuenteChip fuente={fuenteEfectiva(t)} />
          <span style={{ flex: 1 }} />
          {/* ⚠️ COMPLETAR VIVE ACÁ, en el lugar más caro del modal. «Que "Marcar como
              completada" esté donde hoy está "✦ MaKo ✓ optimizada"» (23/09/2026).
              Y el chip de MaKo se fue: «ya no tiene sentido». Decía que una tarjeta había
              pasado por el Perro —que hoy es TODAS, porque pasa en el alta— así que había
              dejado de distinguir nada. Pedirle ayuda a MaKo sigue estando, en el ✦ de al
              lado del título, que es donde se edita el texto que MaKo mejora. */}
          <button onClick={() => board.toggleDone(t.id)}
            title={t.progress >= 100 ? 'Reabrir la tarea' : 'Marcar como completada'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: `1px solid ${t.progress >= 100 ? 'var(--good)' : 'var(--border-strong)'}`, background: t.progress >= 100 ? 'var(--good-bg, var(--surface))' : 'var(--surface)', color: t.progress >= 100 ? 'var(--good)' : 'var(--ink)', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, whiteSpace: 'nowrap', flex: 'none' }}>
            <span style={{ width: 16, height: 16, borderRadius: 5, border: `1.5px solid ${t.progress >= 100 ? 'var(--good)' : 'var(--border-strong)'}`, background: t.progress >= 100 ? 'var(--good)' : 'transparent', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{t.progress >= 100 ? '✓' : ''}</span>
            {t.progress >= 100 ? 'Completada' : 'Marcar completada'}
          </button>
          <button aria-label="Cerrar" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 22, lineHeight: 1, color: 'var(--faint)', padding: '2px 6px' }}>×</button>
        </div>
        <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '20px 22px' }}>
            {/* El título SE EDITA, y ahora se nota. Se reportó como «no se puede cambiar
                el nombre de una tarea»: se podía desde siempre, pero un textarea sin
                borde ni fondo se lee como un título impreso y nadie le hace click. */}
            <textarea value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; board.setTitle(t.id, titleDraft, t.title); }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--surface)'; }}
              onMouseEnter={(e) => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
              onMouseLeave={(e) => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderColor = 'transparent'; }}
              title="Edita el título" aria-label="Título de la tarea" placeholder="Título de la tarea…" rows={2}
              style={{ width: '100%', border: '1px solid transparent', borderRadius: 9, outline: 'none', resize: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 22, fontWeight: 600, lineHeight: 1.3, fontFamily: SANS, letterSpacing: '-0.01em', marginBottom: 16, padding: '4px 8px', marginLeft: -8, transition: 'border-color .12s, background .12s' }} />
            <label style={rowLabel}>Detalle · doc</label>
            <div style={{ marginBottom: 22 }}><RichText value={t.detalle} onChange={(html) => board.setDetalle(t.id, html, t.detalle)} placeholder="El doc de esta tarea…" /></div>

            {/* ⚠️ ACÁ VIVÍAN EL AVANCE Y LA CHECKLIST, y se fueron los dos el 22/09/2026.
                Textual: «que no existan checklists, quitan mucho tiempo, son incómodas e
                imprácticas. De última un bullet point». Y con ellas el % por tarea: «una
                tarea se completa o no se completa».
                · Los pasos ahora son viñetas del detalle, que es lo que un agente lee
                  para ejecutar la tarea (lib/detalle-fusion.ts → pasosComoBullets).
                · El check de completar subió al tope de la barra derecha: «es re
                  invisible… tan incómodo» era que viviera acá abajo, entre el doc y el
                  historial. */}

            {/* NOTAS y «se hace en MaKo» viven ACÁ, en la columna principal y ARRIBA del
                historial. Estaban en la barra lateral, apretadas contra la prioridad y
                el deadline: el cuaderno de la tarea es contenido, no metadata. */}
            {/* Las dependencias van ARRIBA de las notas y del historial, en la columna
                principal: «qué me frena» y «qué destrabo» son contenido de la tarea, no
                metadata — cambian qué se hace hoy. */}
            <Separador />
            <DependenciasBloque
              entidad="tarea" id={t.id} deps={board.deps}
              candidatos={board.tasks.filter((x) => x.id !== t.id).map((x) => ({
                id: x.id, titulo: `#${x.num} ${x.title}`,
                sub: x.labels.map((l) => board.labelById(l)?.name).filter(Boolean).join(' · '),
                terminado: x.progress >= 100,
              }))}
              onAdd={board.addDep} onDel={board.delDep} />
            <Separador />
            <NotasLista valor={t.notas ?? ''} onGuardar={(v) => board.patch(t.id, { notas: v })} />

            {t.haceloEn && <><Separador /><HaceloEnMaKo id={t.haceloEn} /></>}

            <Separador />
            <label style={rowLabel}>Historial</label>
            <ChangeHistory t={t} board={board} ask={ask} />
          </div>
          <div style={{ width: 236, flex: 'none', borderLeft: '1px solid var(--border)', background: 'var(--surface-2)', padding: '20px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 15 }}>
            {trabajando && <PerroTrabajando que="tu plan, para ponerle proyecto, prioridad y detalle" />}
            <BloquePrioridad
              etiqueta={PLABEL[prioEfectiva].toUpperCase()} color={PCOLOR[prioEfectiva]} score={t.score} titulo={t.title}
              chip={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontSize: 15, fontWeight: 700, color: PCOLOR[prioEfectiva] }}><ScoreIcon size={15} color={PCOLOR[prioEfectiva]} />{t.score}</span>}
              razon={t.scoreRazon} impacto={t.impacto} esfuerzo={t.esfuerzo}
              tiempo={<TiempoLinea t={t} />}
              puedeEditar={!!board.repo.prioridadManual} onEditar={onPrioridad} />
            {/* La FECHA la decide el Perro igual que la prioridad: la propone al crear la
                tarea, deja escrito por qué, y para moverla hay que discutírsela. */}
            <div>
              <label style={{ ...rowLabel, display: 'inline-flex', alignItems: 'center', gap: 6 }}>Deadline {!t.deadline && <WarnMark title="Falta el deadline" size={13} />}</label>
              <input type="date" value={t.deadline} onChange={(e) => board.setDeadline(t.id, e.target.value, t.deadline)} style={selStyle} />
              {t.deadlineRazon && <div style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.4, margin: '6px 0 0', fontStyle: 'italic' }}>“{t.deadlineRazon}”</div>}
              {/* ⛔ ACÁ VIVÍA «Cambiar la fecha», que abría el debate con el Perro. «No tiene
                  sentido el botón si dijimos que ya no hay fricción: solo el desplegable para
                  seleccionar fechas» (23/09/2026). El selector escribe directo, y la fecha la
                  sigue proponiendo el Perro al crear la tarjeta — que es cuando sirve. */}
            </div>
            {/* EL QUARTER ES OTRA COSA QUE EL DEADLINE, y por eso es otro campo.
                El deadline dice cuándo VENCE —lo propone el Perro y se le discute—;
                el Quarter dice cuándo decidiste HACERLO, y eso no lo decide nadie
                más que vos. Sin fecha todavía, el Quarter alcanza para que la tarea
                aparezca en «este Quarter» y no se caiga de todas las vistas. */}
            <div>
              <label style={rowLabel}>Quarter</label>
              <select
                value={t.quarter ?? ''}
                onChange={(e) => board.setQuarter(t.id, e.target.value, t.quarter ?? '')}
                style={selStyle}
              >
                <option value="">Sin asignar</option>
                {quartersElegibles(hoyISO()).map((q) => <option key={q.key} value={q.key}>{q.label}</option>)}
              </select>
              {/* ⚠️ AVISA, NO CORRIGE. Que el deadline caiga en otro trimestre que el
                  planificado puede ser un error de tipeo o una decisión (una entrega de Q3
                  que se planificó para Q2). Quien sabe cuál de las dos es, es la persona;
                  lo único que el código puede afirmar es que no coinciden. */}
              {t.quarter && t.deadline && quarterDeFecha(t.deadline) !== t.quarter && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11.5, color: 'var(--warn, #B4762A)', lineHeight: 1.35, marginTop: 6 }}>
                  <WarnMark title="El Quarter y la fecha no coinciden" size={13} blink={false} />
                  <span>La fecha cae en el {quarterDeFecha(t.deadline).replace('-', ' ')}, no en el {t.quarter.replace('-', ' ')}.</span>
                </div>
              )}
            </div>
            <div>
              <label style={{ ...rowLabel, display: 'flex', alignItems: 'center', gap: 4 }}>
                {board.repo.labelPlural}
                <span style={{ flex: 1 }} />
                {/* Mismo lápiz que la prioridad, por la misma razón: un botón de ancho
                    completo para cambiar un chip es más grande que el chip. */}
                <LapizPrioridad onClick={onAsignar} titulo={chips.length ? 'Cambiar de proyecto' : 'Asignar un proyecto'} />
              </label>
              {/* Los chips ya no se sacan con una × acá: cambiar de proyecto pasa por el
                  Perro Guardián (feedback #7). */}
              {/* Chips cuadrados y clickeables (feedback jul-19): mismo diseño que el header
                  (LabelChip), con ellipsis; al tocarlos abrís el proyecto (y volvés a la tarea). */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                {chips.length === 0
                  ? <span style={{ fontSize: 12, color: 'var(--faint)', fontStyle: 'italic' }}>Sin proyecto</span>
                  : chips.map((l) => (
                    <button key={l.id} type="button" onClick={() => onOpenProj?.(l.id)} title={`Abrir «${l.name}»`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: 200, fontSize: 11, fontWeight: 600, color: l.color, background: l.color + '1f', border: `1px solid ${l.color}59`, padding: '3px 8px', borderRadius: 6, cursor: onOpenProj ? 'pointer' : 'default', fontFamily: SANS, overflow: 'hidden' }}>
                      <span style={{ flex: 'none' }}>{l.emoji}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                    </button>
                  ))}
              </div>
            </div>

            <span style={{ flex: 1 }} />
            <button onClick={onDelete} style={{ border: 'none', background: 'transparent', color: 'var(--bad)', fontSize: 12.5, cursor: 'pointer', textAlign: 'left', padding: '4px 0' }}>Eliminar tarea</button>
          </div>
        </div>
      </div>
      {mako && <MakoChecklistModal title={t.title} detalle={t.detalle} yaOptimizada={optimizada} onApply={(r) => {
        if (r.titulo) board.setTitle(t.id, r.titulo, t.title);
        // Los PASOS entran como viñetas del detalle, no como checklist (se fueron el
        // 22/09/2026). `pasosComoBullets` no repite lo que ya está escrito.
        const base = r.detalle || t.detalle;
        const conPasos = pasosComoBullets(base, r.items);
        if (conPasos && conPasos !== t.detalle) board.setDetalle(t.id, conPasos, t.detalle);
      }} onClose={() => setMako(false)} />}
    </div>
  );
}

// ── change history para proyectos — con deshacer (solo la última entrada del usuario) ──
function HistList({ historial, nombre, avatarUrl, onUndo }: { historial: BoardTask['historial']; nombre: string; avatarUrl: string; onUndo?: (h: import('./types').Hist) => void }) {
  const [nowMs, setNowMs] = useState(0);
  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => { setNowMs(Date.now()); }, []);
  // Sin tope de ningún tipo: renderizaba el historial entero, y los proyectos que pasaron
  // por varios scripts de reordenamiento tienen decenas de entradas.
  const { visibles, boton } = useVerMas(historial, { inicial: 8, tanda: 8, estilo: 'texto' });
  if (historial.length === 0) return <div style={{ fontSize: 12.5, color: 'var(--faint)', fontStyle: 'italic' }}>Sin actividad todavía.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {visibles.map((h, i) => {
        const { esCreacion, porque } = partirCreacion(h.text, 'Creó el proyecto');
        return (
          <div key={h.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <ActorAvatar actor={h.actor} nombre={nombre} avatarUrl={avatarUrl} size={24} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.4 }}><strong style={{ fontWeight: 600 }}>{autorDe(h.actor, nombre)}</strong> · {esCreacion ? frasePorAlta(h.actor, nombre, "o") : h.text}{esCreacion && porque && <span style={{ color: 'var(--dim)' }}> — {porque}</span>}</div>
              <div title={nowMs ? relTime(h.ts, nowMs) : ''} style={{ fontSize: 11.5, color: 'var(--faint)' }}>{fechaHora(h.ts)}</div>
            </div>
            {/* solo el último cambio del usuario se puede deshacer (nunca los de MaKo) */}
            {i === 0 && h.undo && h.actor === 'user' && onUndo && <button onClick={() => onUndo(h)} title="Deshacer" style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 8, padding: '3px 9px', fontSize: 12, cursor: 'pointer', flex: 'none', fontFamily: SANS }}>↶</button>}
          </div>
        );
      })}
      {boton}
    </div>
  );
}

// ── change history de la TAB Proyectos: agrega los eventos de CADA proyecto
// (creación/rename/detalle/score…), NO los de tareas (esos viven en el detalle). ──
function ProjTabHist({ labels, nombre, avatarUrl }: { labels: Label[]; nombre: string; avatarUrl: string }) {
  const [nowMs, setNowMs] = useState(0);
  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => { setNowMs(Date.now()); }, []);
  // Es el historial de TODOS los proyectos junto: con 36 proyectos y hasta 40 entradas
  // cada uno, el `.slice(0, 40)` de antes seguía dejando una tira de 40 filas con avatar
  // y chip, y para llegar a lo que está debajo había que scrollear un rato largo. Ahora
  // se muestran las últimas 8 y el resto queda detrás de un botón que dice cuántas son.
  const todas = labels
    .flatMap((l) => l.historial.filter((h) => h.kind !== 'task').map((h) => ({ h, l })))
    .sort((a, b) => b.h.ts - a.h.ts)
    .slice(0, 200);
  const { visibles: rows, boton } = useVerMas(todas, { inicial: 10, tanda: 10, estilo: 'texto' });
  if (todas.length === 0) return <div style={{ fontSize: 12.5, color: 'var(--faint)', fontStyle: 'italic' }}>Sin actividad de proyectos todavía.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {rows.map(({ h, l }) => {
        const { esCreacion, porque } = partirCreacion(h.text, 'Creó el proyecto');
        return (
          <div key={h.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <ActorAvatar actor={h.actor} nombre={nombre} avatarUrl={avatarUrl} size={24} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.4 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '1px 7px 1px 5px', borderRadius: 999, border: `1px solid ${l.color}59`, background: `${l.color}1f`, color: l.color, marginRight: 6, verticalAlign: 'middle' }}>{l.emoji} {l.name}</span>
                <strong style={{ fontWeight: 600 }}>{autorDe(h.actor, nombre)}</strong> · {esCreacion ? frasePorAlta(h.actor, nombre, "o") : h.text}{esCreacion && porque && <span style={{ color: 'var(--dim)' }}> — {porque}</span>}
              </div>
              <div title={nowMs ? relTime(h.ts, nowMs) : ''} style={{ fontSize: 11.5, color: 'var(--faint)' }}>{fechaHora(h.ts)}</div>
            </div>
          </div>
        );
      })}
      {boton}
    </div>
  );
}

// La card de proyecto (misma en la vista Proyectos y en el modal "MaKo cargó", así son
// IDÉNTICAS). `verDetalle` muestra descripción + razón del Perro (para el modal); en la
// grilla queda apagado (es para barrer de un vistazo).
export function ProyectoCardTile({ l, prog, isTop, verDetalle = false, onOpen }: { l: Label; prog: { total: number; done: number; pct: number }; isTop: boolean; verDetalle?: boolean; onOpen: () => void }) {
  const completo = prog.total > 0 && prog.done === prog.total;
  return (
    <div onClick={onOpen} style={{ background: 'var(--surface)', border: `1px solid ${isTop ? l.color + '80' : 'var(--border)'}`, borderTop: `3px solid ${l.color}`, borderRadius: 14, padding: '16px 16px 15px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 360, transition: 'border-color .12s' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.borderTopColor = l.color; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = isTop ? l.color + '80' : 'var(--border)'; e.currentTarget.style.borderTopColor = l.color; }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 22 }}>{l.emoji}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{l.pid}</span>
        <span style={{ flex: 1 }} />
        {completo && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--good)', background: 'var(--good-bg, var(--surface))', border: '1px solid var(--good)', borderRadius: 6, padding: '1px 6px' }}>✓ Completo</span>}
        <ProjScore score={l.score} color={l.color} />
      </div>
      <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>{l.name}</div>
      {isTop && <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: l.color, fontWeight: 700 }}>🎯 Objetivo Principal</span>}
      {verDetalle && l.detalle && <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>{stripHtml(l.detalle)}</div>}
      {verDetalle && <EscalonChip l={l} />}
      {verDetalle && l.scoreRazon && <div style={{ fontSize: 11.5, color: 'var(--faint)', fontStyle: 'italic', lineHeight: 1.45 }}>🐕 {l.scoreRazon}</div>}
      <span style={{ flex: 1 }} />
      {/* EL DEADLINE, EN LA PREVIEW. «Aún no sale el deadline en la preview de las cards de
          los proyectos» (23/09/2026). Estaba sólo en la tabla y en el detalle, así que la
          vista por defecto —la de tarjetas— era la única que no decía para cuándo es. Va con
          el plazo al lado y no sólo la fecha: «12 oct» no dice si ya se venció. */}
      {l.deadline && (() => {
        const p = plazoTexto(diasHasta(l.deadline, hoyISO()));
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>
            <span>◷ {fechaConDia(l.deadline)}</span>
            <span style={{ color: p.color, fontWeight: p.fuerte ? 700 : 500 }}>· {p.texto}</span>
          </div>
        );
      })()}
      {prog.total > 0 && <span style={{ display: 'block' }}><MiniBar v={prog.pct} /></span>}
      <div style={{ display: 'flex', alignItems: 'center', fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>
        {prog.total ? <><span>{prog.done}/{prog.total}</span><span style={{ flex: 1 }} /><span style={{ fontWeight: 700, color: 'var(--dim)' }}>{prog.pct}%</span></> : <span>sin tareas</span>}
      </div>
    </div>
  );
}

/**
 * El historial de la tab de proyectos, PLEGADO.
 *
 * «Revisa la captura de "Change history · proyectos": tiene mucho protagonismo en la tab de
 * proyecto» (23/09/2026). Y lo tenía: abierto y a ancho completo debajo de las tarjetas, con
 * diez renglones de «fijaste la prioridad / se la devolviste» que son el rastro de UNA
 * sesión de ajustes, no lo que alguien viene a ver cuando abre sus proyectos.
 *
 * No se borra —es la bitácora de quién movió qué, y sin ella un número que cambió solo no se
 * puede explicar—: se pliega, con el conteo a la vista para que se sepa que está.
 */
function HistorialDeLaTab({ labels, board }: { labels: Label[]; board: Board }) {
  const n = labels.reduce((acc, l) => acc + (l.historial?.length ?? 0), 0);
  if (!n) return null;
  return (
    <details className="mk-det" style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
      <summary style={{ userSelect: 'none', fontFamily: MONO, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700 }}>
        Historial · {n} cambio{n === 1 ? '' : 's'}
      </summary>
      <div style={{ marginTop: 12 }}>
        <ProjTabHist labels={labels} nombre={board.user.nombre} avatarUrl={board.user.avatarUrl} />
      </div>
    </details>
  );
}

// ── vista Proyectos (tab): cards ordenadas por prioridad ────────────────────────
function ProyectosView({ board, topProjectId, onOpen, onNew, projFilter, q, fOrigen, sortMode, sortDir, tabla }: { board: Board; topProjectId: string | null; onOpen: (id: string) => void; onNew: () => void; projFilter: DoneFilter; q: string; fOrigen: Set<string>; sortMode: 'score' | 'creacion'; sortDir: 'desc' | 'asc'; tabla: boolean }) {
  const { labels, tasks, repo } = board;
  const [verTodos, setVerTodos] = useState(false);
  const TOPE = 6; // feedback jul-18: al arranque, el "+" (cuenta como 1) + 5 proyectos reales; el resto tras "Ver más"
  const REALES = TOPE - 1;
  const needle = q.trim();
  // Orden por PRIORIDAD (score) o por CREACIÓN (ts más viejo del historial), en la
  // dirección elegida. dir=-1 → desc (mayor score / más nuevo primero); +1 → asc.
  const dir = sortDir === 'asc' ? 1 : -1;
  const creTs = (l: Label) => (l.historial?.length ? Math.min(...l.historial.map((h) => h.ts)) : 0);
  const ordenados = labels.slice().sort((a, b) => (sortMode === 'creacion' ? dir * (creTs(a) - creTs(b)) : dir * (a.score - b.score)));
  const origenDe = (l: Label) => fuenteEfectiva({ origen: l.historial[l.historial.length - 1]?.actor ?? 'user', fuente: l.fuente }).tipo;
  // Un proyecto pasa el filtro de ORIGEN si lo creó esa fuente O si TIENE tareas de
  // esa fuente. Antes solo miraba el origen del proyecto en sí, y como los proyectos
  // los crea uno a mano, filtrar por "Reunión · Fathom" devolvía la pantalla vacía
  // aunque las tareas de la reunión estuvieran cargadas adentro — el motivo por el
  // que pareció que una reunión entera no se había cargado.
  const tieneTareasDe = (id: string) => tasks.some((t) => t.labels.includes(id) && fOrigen.has(fuenteEfectiva(t).tipo));
  const withProg = ordenados.map((l) => ({ l, prog: projProgress(tasks, l.id), ts: tasks.filter((t) => t.labels.includes(l.id)) }));
  const shown = withProg
    // El pid (P11) es el ID VISIBLE del proyecto y es como el dueño lo nombra: buscar
    // "11", "P11" o "#11" tiene que encontrarlo. Antes el heno era solo nombre +
    // detalle, así que el identificador que la propia UI muestra no servía para buscar.
    // Mismo criterio que las tareas: sin acentos, por palabras, y adentro del detalle.
    // Se suman las tareas del proyecto al heno — buscar «landing» tiene que traer el
    // proyecto donde vive esa tarea, aunque el nombre del proyecto no la nombre.
    .filter(({ l, ts }) => !needle || coincide(
      `${l.pid ?? ''} ${(l.pid ?? '').replace(/^P/i, '')} ${l.name} ${l.detalle ?? ''} ${l.notas ?? ''} ${ts.map((t) => t.title).join(' ')}`,
      needle.replace(/^#/, ''),
    ))
    .filter(({ l }) => fOrigen.size === 0 || fOrigen.has(origenDe(l)) || tieneTareasDe(l.id))
    .filter(({ prog }) => pasaEstado(prog.pct, projFilter));
  const visibles = (verTodos || needle) ? shown : shown.slice(0, REALES);
  const resto = shown.length - visibles.length;
  // En TABLA entran todos de una: el «Ver más…» existe porque una tarjeta ocupa media
  // pantalla, que es justo lo que la tabla viene a resolver.
  if (tabla) {
    return (
      <div style={{ flex: '1 0 auto', display: 'flex', justifyContent: 'center', padding: '18px 30px 40px' }}>
        <div style={{ width: '100%', maxWidth: 1180, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={onNew} style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 9, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>＋ Crear {repo.labelSingular.toLowerCase()}</button>
          </div>
          <TablaProyectos
            filas={shown} topProjectId={topProjectId} hoy={hoyISO()} labelPlural={repo.labelPlural}
            onOpen={onOpen}
            onDeadline={(id, v) => board.patchLabelLog(id, { deadline: v }, v ? `Deadline ${v}` : 'Quitó el deadline')} />
          <HistorialDeLaTab labels={labels} board={board} />
        </div>
      </div>
    );
  }
  return (
    <div style={{ flex: '1 0 auto', display: 'flex', justifyContent: 'center', padding: '18px 30px 40px' }}>
      <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {/* #1: "Crear proyecto" PRIMERO y del mismo tamaño que el resto (cuenta como 1 celda) */}
          <button onClick={onNew} style={{ border: '1.5px dashed var(--border-strong)', background: 'transparent', borderRadius: 14, padding: '15px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 360, color: 'var(--faint)', fontFamily: SANS, opacity: 0.85, transition: 'border-color .12s, color .12s' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--faint)'; }}>
            <span style={{ fontSize: 26, lineHeight: 1 }}>＋</span>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>Crear nuevo {repo.labelSingular.toLowerCase()}…</span>
          </button>
          {visibles.map(({ l, prog }) => (
            <ProyectoCardTile key={l.id} l={l} prog={prog} isTop={l.id === topProjectId} onOpen={() => onOpen(l.id)} />
          ))}
          {shown.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--faint)', fontSize: 13, padding: '10px 0 0' }}>No hay {repo.labelPlural.toLowerCase()} para este filtro.</div>}
        </div>
        {shown.length > REALES && (
          <button onClick={() => setVerTodos((v) => !v)}
            style={{ alignSelf: 'center', marginTop: -4, padding: '9px 20px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--dim)'; }}>
            {resto > 0 ? `Ver más… (${resto} ${repo.labelPlural.toLowerCase()} más)` : 'Ver menos'}
          </button>
        )}
        <HistorialDeLaTab labels={labels} board={board} />
      </div>
    </div>
  );
}

// ── detalle de un proyecto — MISMO layout de 2 columnas que la ficha de tarea (#25) ─
function ProjectDetailModal({ proj, board, topProjectId, taskAbierta = false, trabajando = false, z = 90, onBack, backLabel = 'Volver a la tarea', onOpenTask, onNewTask, onPrioridad, onMako, onDelete, onClose }: { proj: Label; board: Board; topProjectId: string | null; taskAbierta?: boolean; trabajando?: boolean; z?: number; onBack?: () => void; backLabel?: string; onOpenTask: (id: string) => void; onNewTask: () => void; onPrioridad: () => void; onMako: () => void; onDelete: () => void; onClose: () => void }) {
  const [nameDraft, setNameDraft] = useState(proj.name);
  // No cerrar con Escape cuando hay una tarea abierta ENCIMA (esa maneja su propio Escape).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !taskAbierta) { (document.activeElement as HTMLElement)?.blur?.(); onClose(); } };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [onClose, taskAbierta]);
  const suyas = board.tasks.filter((t) => t.labels.includes(proj.id)).sort((a, b) => (a.progress >= 100 ? 1 : 0) - (b.progress >= 100 ? 1 : 0) || b.score - a.score);
  const abiertas = suyas.filter((t) => t.progress < 100);
  const hechas = suyas.filter((t) => t.progress >= 100);
  const prog = projProgress(board.tasks, proj.id);
  const isTop = proj.id === topProjectId;
  const rowLabel: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6, display: 'block' };
  const capa = useCapaModal(true);
  return (
    // `z` sigue existiendo como piso para el caso proyecto-debajo-de-tarea, pero quien
    // manda es la pila: el de arriba se ve, los de abajo se esconden.
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: Math.max(z, capa.z), background: 'rgba(18,21,27,.35)', backdropFilter: 'blur(2px)', display: capa.visible || taskAbierta ? 'flex' : 'none', alignItems: 'flex-start', justifyContent: 'center', padding: '7vh 16px 16px', fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 820, maxHeight: '85vh', background: 'var(--surface)', border: '1px solid var(--border)', borderTop: `4px solid ${proj.color}`, borderRadius: 16, boxShadow: '0 24px 60px rgba(18,21,27,.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* header teñido con el color del proyecto (punto 3): distingue el detalle de cada uno */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px', borderBottom: `1px solid ${proj.color}33`, background: `${proj.color}12`, flex: 'none' }}>
          {onBack && <button onClick={onBack} title={backLabel} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 8, padding: '5px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS, flex: 'none' }}>← {backLabel}</button>}
          <EmojiPickerMini value={proj.emoji} onPick={(em) => board.patchLabelLog(proj.id, { emoji: em }, 'Cambió el emoji')} />
          <span style={{ fontFamily: MONO, fontSize: 11, color: proj.color, fontWeight: 700 }}>{proj.pid}</span>
          {isTop && <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: proj.color, fontWeight: 700 }}>🎯 Objetivo Principal</span>}
          {/* origen del proyecto (feedback jul-19): igual que en las tareas. La fuente sale
              de proj.fuente o se deriva del autor del alta (Claude Code, MaKo, vos). */}
          <FuenteChip fuente={fuenteEfectiva({ origen: proj.historial[proj.historial.length - 1]?.actor ?? 'user', fuente: proj.fuente })} />
          <span style={{ flex: 1 }} />
          <button onClick={onMako} title="MaKo te ayuda a mejorar el nombre y el detalle" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--primary-weak)', background: 'var(--primary-bg)', color: 'var(--primary)', borderRadius: 8, padding: '5px 11px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>✦ MaKo te ayuda</button>
          <button aria-label="Cerrar" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 22, lineHeight: 1, color: 'var(--faint)', padding: '2px 6px' }}>×</button>
        </div>
        <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
          {/* columna principal */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '20px 22px' }}>
            <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onBlur={() => { if (nameDraft.trim() && nameDraft !== proj.name) board.patchLabelLog(proj.id, { name: nameDraft.trim() }, `Renombró el proyecto → «${nameDraft.trim()}»`); }}
              style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 22, fontWeight: 600, fontFamily: SANS, letterSpacing: '-0.01em', marginBottom: 16 }} />
            <label style={rowLabel}>Detalle · doc</label>
            <div style={{ marginBottom: 22 }}><RichText value={proj.detalle} onChange={(html) => { if (html !== proj.detalle) board.patchLabelLog(proj.id, { detalle: html }, 'Editó el detalle'); }} placeholder="¿De qué se trata este proyecto?" /></div>

            {/* AVANCE arriba de las tareas (#4) */}
            <Separador />
            <label style={rowLabel}>Avance · {prog.pct}%{prog.total ? ` · ${prog.done}/${prog.total} tareas` : ''}</label>
            <span style={{ display: 'block', marginBottom: 20 }}><MiniBar v={prog.pct} /></span>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
              <label style={{ ...rowLabel, marginBottom: 0 }}>Tareas del proyecto · {abiertas.length}{hechas.length ? ` + ${hechas.length} hecha${hechas.length === 1 ? '' : 's'}` : ''}</label>
              <span style={{ flex: 1 }} />
              <button onClick={onNewTask} style={{ border: '1px solid var(--primary-weak)', background: 'var(--primary-bg)', color: 'var(--primary)', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>+ Nueva Tarea</button>
            </div>
            {/* ⚠️ LAS TERMINADAS VAN PLEGADAS. «En proyecto, en el detail, oculta las tareas
                terminadas con un desplegable» (23/09/2026): un proyecto al 80% mostraba
                cuatro tarjetas tachadas arriba de la única que queda por hacer. No se
                esconden sin pista —el desplegable dice cuántas son— porque la lista de lo
                hecho es la evidencia de que el proyecto avanzó. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {suyas.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--faint)', fontStyle: 'italic' }}>Sin tareas todavía.</div>}
              {abiertas.map((t) => (
                <div key={t.id} onClick={() => onOpenTask(t.id)} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '11px 13px', cursor: 'pointer', opacity: t.progress >= 100 ? 0.62 : 1, transition: 'border-color .12s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')} onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}>
                  {/* Sin % ni barra: el estado es el CHECK, y el deadline es el dato que
                      hay que ver sin abrir la tarea. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <button onClick={(e) => { e.stopPropagation(); board.toggleDone(t.id); }} title={t.progress >= 100 ? 'Reabrir' : 'Marcar como completada'}
                      style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${t.progress >= 100 ? 'var(--good)' : 'var(--border-strong)'}`, background: t.progress >= 100 ? 'var(--good)' : 'transparent', color: '#fff', fontSize: 10, cursor: 'pointer', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>{t.progress >= 100 ? '✓' : ''}</button>
                    <ScoreBadge score={t.score} />
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', textDecoration: t.progress >= 100 ? 'line-through' : 'none', minWidth: 0 }}>{t.title}</span>
                    {t.deadline
                      ? <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--dim)', flex: 'none' }}>◷ {fechaConDia(t.deadline)}</span>
                      : t.progress < 100 && <WarnMark title="Falta el deadline" size={13} />}
                  </div>
                </div>
              ))}
              {hechas.length > 0 && (
                <details className="mk-det" style={{ marginTop: 2 }}>
                  <summary style={{ userSelect: 'none', fontSize: 12.5, color: 'var(--faint)', fontWeight: 600 }}>
                    {hechas.length} {hechas.length === 1 ? 'tarea terminada' : 'tareas terminadas'}
                  </summary>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    {hechas.map((t) => (
                      <div key={t.id} onClick={() => onOpenTask(t.id)} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '11px 13px', cursor: 'pointer', opacity: 0.62 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <button onClick={(e) => { e.stopPropagation(); board.toggleDone(t.id); }} title="Reabrir"
                            style={{ width: 16, height: 16, borderRadius: 4, border: '1.5px solid var(--good)', background: 'var(--good)', color: '#fff', fontSize: 10, cursor: 'pointer', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✓</button>
                          <ScoreBadge score={t.score} />
                          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', textDecoration: 'line-through', minWidth: 0 }}>{t.title}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>

            {/* Un proyecto SIN tareas abiertas: lo que le falta es TRABAJO, no prioridad.
                Va ARRIBA de todo en su detalle porque es la única acción que tiene sentido
                acá — dejarlo como una fila más entre las notas y el historial es esconderlo. */}
            {abiertas.length === 0 && <ProyectoVacioBloque proj={proj} />}

            {/* Una dependencia de PROYECTO frena todas sus tareas abiertas de un saque: es
                la escritura de mayor palanca del tablero, y por eso el radio se dice antes
                del click y no después. */}
            <Separador />
            <DependenciasBloque
              entidad="proyecto" id={proj.id} deps={board.deps}
              candidatos={board.labels.filter((l) => l.id !== proj.id).map((l) => {
                const abiertas = board.tasks.filter((t) => t.progress < 100 && t.labels.includes(l.id)).length;
                const total = board.tasks.filter((t) => t.labels.includes(l.id)).length;
                return {
                  id: l.id, titulo: `${l.emoji} ${l.name}`,
                  sub: total === 0 ? 'todavía sin tareas cargadas' : `${abiertas} de ${total} abiertas`,
                  // Un proyecto SIN tareas NO cuenta como terminado: tratar «vacío» como
                  // «listo» destrabaría media cadena sin que nadie hiciera el trabajo.
                  terminado: total > 0 && abiertas === 0,
                };
              })}
              impacto={(aId) => {
                const n = board.tasks.filter((t) => t.progress < 100 && t.labels.includes(proj.id)).length;
                const otro = board.labelById(aId);
                const sinTareas = board.tasks.filter((t) => t.labels.includes(aId)).length === 0;
                return `Esto frena ${n === 1 ? 'la tarea abierta' : `las ${n} tareas abiertas`} de «${proj.name}» hasta que «${otro?.name ?? aId}» esté terminado.${sinTareas ? ' Y ojo: ese proyecto todavía no tiene ninguna tarea cargada, así que no se va a destrabar solo.' : ''}`;
              }}
              onAdd={board.addDep} onDel={board.delDep} />

            <Separador />
            <NotasLista valor={proj.notas ?? ''} onGuardar={(v) => board.patchLabelLog(proj.id, { notas: v }, 'Escribió una nota', 'user')} />

            <Separador />
            <label style={rowLabel}>Historial del proyecto</label>
            <HistList historial={proj.historial} nombre={board.user.nombre} avatarUrl={board.user.avatarUrl} onUndo={(h) => board.undoLabelHist(proj.id, h)} />
          </div>
          {/* sidebar */}
          <div style={{ width: 236, flex: 'none', borderLeft: '1px solid var(--border)', background: 'var(--surface-2)', padding: '20px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 15 }}>
            {trabajando && <PerroTrabajando que="el resto de tus proyectos, para ubicarlo y describirlo" />}
            <BloquePrioridad
              color={proj.color} score={proj.score} titulo={proj.name}
              chip={<ProjScore score={proj.score} color={proj.color} big />}
              razon={proj.scoreRazon} impacto={proj.impacto} esfuerzo={proj.esfuerzo}
              extra={<EscalonChip l={proj} />}
              puedeEditar={!!board.repo.prioridadManual} onEditar={onPrioridad} />
            <div><label style={rowLabel}>Deadline</label><input type="date" value={proj.deadline || ''} onChange={(e) => board.patchLabelLog(proj.id, { deadline: e.target.value }, e.target.value ? `Deadline ${e.target.value}` : 'Quitó el deadline')} style={selStyle} /></div>

            <div><label style={rowLabel}>Color</label><ColorDropdown color={proj.color} onPick={(c) => board.patchLabel(proj.id, { color: c })} /></div>
            <span style={{ flex: 1 }} />
            <button onClick={onDelete} style={{ border: 'none', background: 'transparent', color: 'var(--bad)', fontSize: 12.5, cursor: 'pointer', textAlign: 'left', padding: '4px 0' }}>Eliminar el proyecto y sus {suyas.length} tarea{suyas.length === 1 ? '' : 's'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// nombres de los colores por defecto (en vez del hex)
const COLOR_NAMES: Record<string, string> = { '#98A0AC': 'Gris', '#2F6FED': 'Azul', '#1E9E57': 'Verde', '#C8870C': 'Ámbar', '#D0504A': 'Rojo', '#7C5CFB': 'Violeta', '#0E9B8E': 'Turquesa', '#D6489B': 'Rosa' };
const colorName = (c: string) => COLOR_NAMES[c.toUpperCase()] || COLOR_NAMES[c] || 'Personalizado';
// Color como DESPLEGABLE (#29): swatches en CÍRCULOS + botón "+" con anillo rainbow que
// abre el selector RGB nativo. Muestra el NOMBRE del color, no el hex.
function ColorDropdown({ color, onPick }: { color: string; onPick: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const rainbow = 'conic-gradient(from 90deg, #ff0000, #ffea00, #21d24a, #00c2ff, #2b5cff, #c000ff, #ff0090, #ff0000)';
  return (
    <span style={{ position: 'relative', display: 'block' }}>
      <button onClick={() => setOpen((o) => !o)} style={{ ...selStyle, display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
        <span style={{ width: 18, height: 18, borderRadius: '50%', background: color, border: '1px solid rgba(0,0,0,.15)', flex: 'none' }} />
        <span style={{ flex: 1, textAlign: 'left', fontSize: 13 }}>{colorName(color)}</span>
        <span style={{ color: 'var(--faint)' }}>▾</span>
      </button>
      {open && <>
        <span onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 95 }} />
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 96, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 16px 40px rgba(18,21,27,.2)', padding: 14 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* "+" con anillo rainbow → selector RGB nativo */}
            <label title="Elegir cualquier color" style={{ position: 'relative', width: 30, height: 30, borderRadius: '50%', background: rainbow, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: 'var(--ink)', lineHeight: 1 }}>＋</span>
              <input type="color" value={color} onChange={(e) => onPick(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
            </label>
            {SWATCHES.map((s) => {
              const on = color.toUpperCase() === s.toUpperCase();
              return <button key={s} onClick={() => { onPick(s); setOpen(false); }} title={colorName(s)} style={{ width: 30, height: 30, borderRadius: '50%', background: s, border: on ? '2px solid var(--ink)' : '2px solid transparent', boxShadow: on ? '0 0 0 2px var(--surface), 0 0 0 3px var(--ink)' : 'inset 0 0 0 1px rgba(0,0,0,.1)', cursor: 'pointer', flex: 'none' }} />;
            })}
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--dim)' }}>Color actual: <b style={{ color: 'var(--ink)' }}>{colorName(color)}</b></div>
        </div>
      </>}
    </span>
  );
}

/**
 * `?diag=1` — el tablero contándote qué midió, en el navegador de quien lo está viendo.
 *
 * Existe porque hay una clase de bug que NO SE PUEDE reproducir del otro lado: depende
 * de la versión del motor, de una extensión o de un ajuste del navegador de esa persona.
 * Se perdieron dos días con «el plan está vacío» desde una Mac —header dibujado, cuerpo
 * en blanco— probando en Chrome, donde nunca falló, y hasta con WebKit headless, que es
 * varias versiones más nuevo que el Safari del cliente y tampoco lo reproduce.
 *
 * Pedirle a alguien la consola de su Mac no es una opción real. Esto sí: abre un link,
 * saca una foto. Lo que hay que mirar es el primer alto que dé 0 — ese es el que se comió
 * la pantalla.
 */
function Diagnostico() {
  const [txt, setTxt] = useState('');
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    const medir = () => {
      const de = (sel: string, el?: Element | null) => {
        const e = el ?? document.querySelector(sel);
        if (!e) return `${sel}: (no está)`;
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        return `${sel}: alto=${Math.round(r.height)} ancho=${Math.round(r.width)} display=${cs.display} overflow=${cs.overflow} pos=${cs.position}`;
      };
      const main = document.querySelector('main');
      const header = main?.querySelector('header');
      const cuerpo = main ? [...main.children].find((e) => e !== header && e.tagName === 'DIV') : null;
      setTxt([
        `MaKo diag · ${new Date().toISOString().slice(0, 19)}`,
        `UA: ${navigator.userAgent}`,
        `ventana: ${window.innerWidth}x${window.innerHeight} · dpr=${window.devicePixelRatio} · zoom≈${Math.round((window.outerWidth / window.innerWidth) * 100) / 100}`,
        de('html', document.documentElement), de('body', document.body), de('main', main),
        de('header', header), de('cuerpo', cuerpo), de('vista', cuerpo?.firstElementChild),
        `tema: ${document.documentElement.getAttribute('data-tema') || '(ninguno)'} · candidato: ${document.documentElement.getAttribute('data-tema-candidato') || '(ninguno)'}`,
      ].join(String.fromCharCode(10)));
    };
    medir();
    const t = setTimeout(medir, 1200);
    window.addEventListener('resize', medir);
    return () => { clearTimeout(t); window.removeEventListener('resize', medir); };
  }, []);
  return (
    <div style={{ position: 'fixed', left: 12, bottom: 12, zIndex: 9999, maxWidth: 'min(92vw, 560px)', background: '#12151b', color: '#e8eaed', border: '1px solid #3a4150', borderRadius: 12, padding: 12, fontFamily: MONO, fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', boxShadow: '0 18px 44px rgba(0,0,0,.35)' }}>
      {txt}
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => { void navigator.clipboard?.writeText(txt).then(() => setCopiado(true)).catch(() => setCopiado(false)); }}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #3a4150', background: '#1b1f27', color: '#e8eaed', fontFamily: MONO, fontSize: 11, cursor: 'pointer' }}>
          {copiado ? '✓ copiado' : 'copiar'}
        </button>
      </div>
    </div>
  );
}
