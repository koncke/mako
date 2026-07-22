'use client';

// =============================================================================
// BoardShell — la ÚNICA vista del tablero /todo (admin y cliente idénticos)
// =============================================================================
// Recibe un `Board` (useBoard) y pinta todo: header con avance promedio, toggle
// Prioridades/Kanban, 4 columnas de prioridad a ancho completo con DnD, tarjetas
// cuadradas (estilo CRM) con avance editable inline, modal con checklist + coach
// de MaKo + Change history (avatar + deshacer por entrada), editor de proyectos
// con emoji, y el form bloqueante para tareas Alta sin deadline/checklist.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { UndoToast } from '../../_components/UndoToast';
import { ConfirmModal } from '../../_components/ConfirmModal';
import { EmojiPickerMini } from './EmojiPicker';
import { MakoChecklistModal } from './MakoChecklist';
import { DebateModal } from './DebateModal';
import { CrearTareaModal } from './CrearTareaModal';
import { CrearProyectoModal } from './CrearProyecto';
import { EliminarModal } from './EliminarModal';
import { AsignarProyectoModal } from './AsignarProyecto';
import { ProyectoDebateModal } from './ProyectoDebateModal';
import { MakoProyectoModal } from './MakoProyecto';
import { ReunionExtractModal } from './ReunionExtractModal';
import { DatosModal, DatosConfirm, type FaltanteItem } from './DatosModal';
import { TareasCreadasModal } from './TareasCreadasModal';
import { GraphicsView } from './Graphics';
import { MakoStar } from '../../_components/MakoBrand';
import { SvcIcon, BrandDefs } from '../../_components/ServicioVisual';
import { ScoreIcon } from './guardian-form';
import { RichText, stripHtml } from './RichText';
import type { Board } from './useBoard';
import { type BoardTask, type Label, type Prio, type Check, type Actor, type Fuente, type FuenteTipo, ACTOR_LABEL, PRIOS, PLABEL, PCOLOR, SWATCHES, MAX_PRIORIDAD, uid, relTime, fechaHora, fuenteEfectiva, prioFromScore, displayPrio } from './types';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

export function BoardShell({ board, autoloadScope }: { board: Board; autoloadScope?: string }) {
  // G1/G2 guardián: score→columna, restricción al proyecto top, debate.
  const { tasks, labels, repo } = board;
  const [view, setView] = useState<'prioridades' | 'kanban' | 'proyectos' | 'graphics'>('prioridades');
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
  const [fLabels, setFLabels] = useState<Set<string>>(new Set());
  const [doneFilter, setDoneFilter] = useState<DoneFilter>('all'); // #16: filtrar por estado (kanban)
  const [fOrigen, setFOrigen] = useState<Set<string>>(new Set());  // filtrar por ORIGEN (fuente: WhatsApp/Fathom/…)
  const [sortMode, setSortMode] = useState<'score' | 'creacion'>('score'); // orden de tareas/proyectos
  const [projFilter, setProjFilter] = useState<DoneFilter>('all');  // filtrar por estado (proyectos)
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ msg: string; onOk: () => void } | null>(null);
  const [debateId, setDebateId] = useState<string | null>(null);
  const [nuevaTarea, setNuevaTarea] = useState(false);
  const [extraerReunion, setExtraerReunion] = useState(false); // G3: extraer de una reunión de Fathom
  const [reunionArchivo, setReunionArchivo] = useState<File | null>(null); // subir archivo (punto 7): entra al mismo modal
  // "Datos sin marcar" (feedback jul-19): UN modal batch para deadline + checklist, en
  // vez del gauntlet card-by-card. Ver DatosModal. El 2do pop-up (DatosConfirm) decide
  // si seguir recordándolo; aparece al CERRARSE este (nunca apilados).
  const [datosOpen, setDatosOpen] = useState(false);
  const [datosAuto, setDatosAuto] = useState(false);   // ¿se abrió solo? (define si al cerrar sale el 2do pop-up)
  const [datosConfirm, setDatosConfirm] = useState(false);
  const [dlDismiss, setDlDismiss] = useState<Set<string>>(new Set()); // deadline ignorado por tarea
  const [clDismiss, setClDismiss] = useState<Set<string>>(new Set()); // checklist ignorada por tarea
  const [datosOff, setDatosOff] = useState(false);                    // "no volver a pedir todos"
  const [dlLoaded, setDlLoaded] = useState(false);                    // ya leí localStorage
  const datosAutoRef = useRef(false);                                 // auto-abrir una sola vez por MONTAJE (no por sesión)
  // "MaKo cargó tareas" (bienvenida): tareas creadas por una FUENTE (WhatsApp/Fathom/MaKo)
  // que el dueño todavía no vio en este device. Se muestran ANTES que el DatosModal.
  const [welcomeTasks, setWelcomeTasks] = useState<BoardTask[]>([]);
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const welcomeDetectRef = useRef(false);
  const welcomeAutoRef = useRef(false);
  const guardianNuevasRef = useRef(false); // el Perro re-puntúa las tareas nuevas UNA vez al entrar

  const ask = (msg: string, onOk: () => void) => setConfirm({ msg, onOk });
  // El aviso de gasto de IA lo muestra el toast GLOBAL <IaUsageToast> (app/layout.tsx),
  // que sale ante CUALQUIER operación de IA. Antes el board tenía SU PROPIO cartel →
  // salían DOS avisos apilados por la misma operación (feedback jul-19). showUsage queda
  // como no-op para no tocar los ~8 call-sites que lo pasan como onUsage.
  const showUsage = (_u: unknown, _feature: string) => { /* dedup: lo muestra IaUsageToast */ };

  // El guardián es dueño de la ubicación: la columna respeta la restricción
  // (Alta solo para el proyecto top / sin proyecto / emergencia).
  const objetivoPrincipal = labels.length ? labels.slice().sort((a, b) => b.score - a.score)[0] : null;
  const topProjectId = objetivoPrincipal?.id ?? null;
  // ── "Datos sin marcar" (feedback jul-19): deadline (opcional) + checklist (la ARMA
  // MaKo), en UN modal batch. Reemplaza al gauntlet card-by-card que auto-popeaba de a
  // una y pedía los pasos a mano. Persistimos qué se ignoró y el "no volver a pedir". ──
  // Las keys se scopean por workspace (autoloadScope): impersonando distintos clientes,
  // las preferencias NO se mezclan en el mismo navegador.
  const dlKey = (base: string) => `${base}${autoloadScope ? '_' + autoloadScope : ''}`;
  useEffect(() => {
    try {
      const dl = localStorage.getItem(dlKey('mako_plan_dl_dismiss'));
      if (dl) setDlDismiss(new Set(JSON.parse(dl) as string[]));
      const cl = localStorage.getItem(dlKey('mako_plan_cl_dismiss'));
      if (cl) setClDismiss(new Set(JSON.parse(cl) as string[]));
      setDatosOff(localStorage.getItem(dlKey('mako_plan_datos_off')) === '1');
    } catch { /* localStorage no disponible */ }
    setDlLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoloadScope]);
  // Bienvenida "MaKo cargó tareas": detectamos UNA vez las tareas con FUENTE recientes que
  // este device no vio. NO se auto-abren acá: el auto-open (más abajo) ESPERA a que el
  // DatosModal + su confirm terminen (Datos PRIMERO, pedido de Martín). El botón ✨ del
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
  const marcarWelcomeVisto = () => {
    try {
      const raw = localStorage.getItem(dlKey('mako_plan_welcome_seen'));
      const seen = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
      welcomeTasks.forEach((t) => seen.add(t.id));
      localStorage.setItem(dlKey('mako_plan_welcome_seen'), JSON.stringify([...seen]));
    } catch { /* ignore */ }
  };
  const faltantes: FaltanteItem[] = tasks
    .filter((t) => t.progress < 100)
    .map((t) => ({
      task: t,
      needDl: !t.deadline && !dlDismiss.has(t.id),
      // Solo ofrecemos armar checklist en tareas SIN empezar: en una tarea con avance
      // manual (>0%) crear la checklist pisaría el progreso a 0 (lo deriva la checklist).
      needCl: displayPrio(t, topProjectId) === 'alta' && t.checklist.length === 0 && t.progress === 0 && !clDismiss.has(t.id),
    }))
    .filter((x) => x.needDl || x.needCl)
    .sort((a, b) => b.task.score - a.task.score);
  const hayImportante = faltantes.some((x) => x.task.score >= 50); // dispara el auto-open
  const persistSet = (key: string, s: Set<string>) => { try { localStorage.setItem(dlKey(key), JSON.stringify([...s])); } catch { /* ignore */ } };
  const ignorarDl = (id: string) => setDlDismiss((s) => { const n = new Set(s).add(id); persistSet('mako_plan_dl_dismiss', n); return n; });
  const ignorarCl = (id: string) => setClDismiss((s) => { const n = new Set(s).add(id); persistSet('mako_plan_cl_dismiss', n); return n; });
  const apagarDatos = () => { setDatosOff(true); try { localStorage.setItem(dlKey('mako_plan_datos_off'), '1'); } catch { /* ignore */ } };
  // MaKo ARMA la checklist (sin preguntarle los pasos al usuario; solo si NO puede, se
  // hace a mano). Historial firmado como actor 'ia' (regla: la IA siempre deja rastro).
  const generarChecklist = async (id: string): Promise<boolean> => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return false;
    const tarea = (t.title + (t.detalle ? `\n\n${stripHtml(t.detalle)}` : '')).trim();
    try {
      const r = await fetch('/api/checklist-coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'propose', tarea, respuestas: '', uso: 'plan' }) });
      const j = await r.json();
      const items: string[] = Array.isArray(j?.items) ? j.items.map((x: { texto?: string } | string) => (typeof x === 'string' ? x : x?.texto || '')).filter(Boolean) : [];
      if (!items.length) return false;
      if (j.usage) showUsage(j.usage, 'MaKo arma la checklist');
      board.setChecklist(id, items.map((text) => ({ id: uid(), text, done: false })), `MaKo armó la checklist (${items.length})`, 'ia');
      return true;
    } catch { return false; }
  };
  // Cerrar el DatosModal: si se abrió SOLO y todavía faltan datos, disparamos el 2do
  // pop-up (DESPUÉS de cerrar este → nunca apilados). Si lo abrí yo con el ⚠, no molesta.
  const cerrarDatos = () => { setDatosOpen(false); if (datosAuto && faltantes.length > 0) setDatosConfirm(true); };
  // Abrir a mano (⚠) consume el "una vez por montaje" para que el auto-open no reaparezca
  // después y nague con el 2do pop-up algo que ya revisaste vos.
  const abrirDatosManual = () => { datosAutoRef.current = true; setDatosAuto(false); setDatosOpen(true); };
  // Auto-abrir UNA vez por MONTAJE (no por sesión → reaparece al reentrar a la tab, que
  // es lo que se espera si no apretaste "no volver a pedir"), si hay algo importante y NO
  // hay ya otro modal abierto (deep-link ?tarea=/?proyecto= → nunca apilar dos).
  useEffect(() => {
    if (!dlLoaded || datosAutoRef.current || datosOff || datosOpen || datosConfirm) return;
    if (openId || openProj || peekProjId) return; // hay un detalle abierto: no apilar
    if (hayImportante) {
      datosAutoRef.current = true;
      setDatosAuto(true);
      setDatosOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dlLoaded, hayImportante, datosOff, openId, openProj, peekProjId]);
  // Auto-abrir la bienvenida UNA vez, DESPUÉS de que la secuencia del DatosModal (deadline +
  // su "no volver a pedir") termine — y sin apilar sobre un detalle abierto. Datos va PRIMERO.
  useEffect(() => {
    if (!hayWelcome || welcomeAutoRef.current) return;
    if (openId || openProj || peekProjId) return;
    const datosPendiente = hayImportante && !datosOff && !datosAutoRef.current;
    if (datosPendiente || datosOpen || datosConfirm) return; // datos (y su confirm) van PRIMERO
    welcomeAutoRef.current = true;
    marcarWelcomeVisto();
    setWelcomeVisible(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayWelcome, hayImportante, datosOff, datosOpen, datosConfirm, openId, openProj, peekProjId]);

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
    const proyectos = labels.map((l) => ({ id: l.id, nombre: l.name }));
    // scoreActual: el guardián mantiene el score previo salvo razón concreta (estabilidad).
    const tareasIn = tasks.filter((t) => t.progress < 100).map((t) => ({ id: t.id, titulo: t.title, detalle: t.detalle, proyecto: board.labelById(t.labels[0])?.name ?? '', deadline: t.deadline, avance: t.progress, origen: t.origen, scoreActual: t.score }));
    if (tareasIn.length < 2) { repriorizando.current = false; return; }
    try {
      const j = await fetch('/api/mako-guardian', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proyectos, tareas: tareasIn }) }).then((r) => r.json());
      if (j.ok) {
        board.applyGuardian(j.tareas || [], j.proyectos || []);
        showUsage(j.usage, 're-priorización del plan');
        lastReprioSig.current = sigNow;
      }
    } catch { /* silencioso, es automático */ }
    repriorizando.current = false;
  };
  // Re-priorización: SOLO cuando el plan cambia DE VERDAD MIENTRAS lo usás (agregar/
  // borrar/completar una tarea, o cambiar un proyecto). NUNCA al entrar a la tab ni al
  // refrescar (feedback: no debe correr en cada refresh). Para eso guardamos la firma
  // de ARRANQUE como línea base en un ref (por sesión): la primera firma con la que
  // hidrata el board NO dispara nada; solo disparan las divergencias posteriores.
  const planSig = planSignature();
  const baseSig = useRef<string | null>(null);
  useEffect(() => {
    if (tasks.length < 2 || !planSig) return;
    // primer render con datos → fijamos la línea base y NO corremos (es "entrar a la tab").
    if (baseSig.current === null) { baseSig.current = planSig; return; }
    if (planSig === baseSig.current) return; // sin cambios estructurales reales
    const id = setTimeout(() => { baseSig.current = planSig; void rePriorizar(planSig); }, 2500);
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
    const id = setTimeout(() => { void rePriorizar(); }, 1500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayWelcome]);
  const passes = (t: BoardTask) => (!q || matchTexto(t, q)) && (fLabels.size === 0 || t.labels.some((l) => fLabels.has(l))) && (fOrigen.size === 0 || fOrigen.has(fuenteEfectiva(t).tipo)) && pasaEstado(t.progress, doneFilter);
  const visibles = tasks.filter(passes);
  const avg = tasks.length ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length) : 0;
  const hechas = tasks.filter((t) => t.progress >= 100).length;
  // "En prioridad" = AUTOMÁTICO: las 3 tareas de mayor score del Objetivo Principal
  // (no lo elige el usuario). Sin proyecto top, cae a las 3 de mayor score del plan.
  const enPrio = tasks
    .filter((t) => t.progress < 100 && (topProjectId ? t.labels.includes(topProjectId) : true))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PRIORIDAD);
  const prioAvg = enPrio.length ? Math.round(enPrio.reduce((s, t) => s + t.progress, 0) / enPrio.length) : 0;
  // agregado de proyectos (para el chip del header en la vista Proyectos)
  const projAgg = labels.map((l) => projProgress(tasks, l.id));
  const projConTareas = projAgg.filter((p) => p.total > 0);
  const avgProj = projConTareas.length ? Math.round(projConTareas.reduce((s, p) => s + p.pct, 0) / projConTareas.length) : 0;
  const hechosProj = projAgg.filter((p) => p.total > 0 && p.done === p.total).length;
  const openTask = tasks.find((t) => t.id === openId) ?? null;
  const debateTask = tasks.find((t) => t.id === debateId) ?? null;
  const openProjLabel = labels.find((l) => l.id === openProj) ?? null;
  const peekProj = labels.find((l) => l.id === peekProjId) ?? null;

  // Deep-link (punto 9): ?tarea=<id> / ?proyecto=<id> abre ese detalle al entrar —
  // lo usa MaKo por WhatsApp para linkear lo que creó. Después limpia el query.
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const tId = sp.get('tarea'); const pId = sp.get('proyecto');
      if (tId && tasks.some((t) => t.id === tId)) setOpenId(tId);
      else if (pId && labels.some((l) => l.id === pId)) setOpenProj(pId);
      if (tId || pId) { sp.delete('tarea'); sp.delete('proyecto'); const qs = sp.toString(); window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '')); }
    } catch { /* no-op */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eliminarTask = tasks.find((t) => t.id === eliminarTaskId) ?? null;
  const eliminarProj = labels.find((l) => l.id === eliminarProjId) ?? null;
  const asignarTask = tasks.find((t) => t.id === asignarTaskId) ?? null;
  const debateProj = labels.find((l) => l.id === debateProjId) ?? null;
  const makoProj = labels.find((l) => l.id === makoProjId) ?? null;
  const crearProyecto = (nombre: string, emoji: string, detalle: string, score = 5) => board.createLabel({ id: uid(), emoji: emoji || '🏷', name: nombre, color: SWATCHES[labels.length % SWATCHES.length], score, detalle, historial: [] });
  // resumen del plan para que el guardián compare al debatir/crear
  const planResumen = tasks.filter((t) => t.progress < 100).map((t) => `- [${t.score}] ${t.title} (${board.labelById(t.labels[0])?.name ?? 'sin proyecto'})`).join('\n');

  // crear una tarea: el usuario propone proyecto(s) + prioridad; el GUARDIÁN la puntúa
  // (arrancando de la sugerencia del usuario) y decide su columna final (#10).
  const crearConGuardian = async (d: { title: string; detalle: string; labelIds: string[]; userScore: number; motivoNinguno: string; nuevoProyecto: string; nuevoProyEmoji: string; argumento: string }) => {
    let labelIds = d.labelIds;
    // Si el usuario dijo que el proyecto todavía no existe, lo creamos inline.
    if (d.nuevoProyecto.trim()) {
      const newId = uid();
      void board.createLabel({ id: newId, emoji: d.nuevoProyEmoji || '🏷', name: d.nuevoProyecto.trim(), color: SWATCHES[labels.length % SWATCHES.length], score: 5, detalle: '', historial: [] });
      labelIds = [newId];
    }
    const starter = d.userScore || 50;
    const t = await board.create(d.title, prioFromScore(starter), labelIds.length ? labelIds : undefined);
    if (!t) return null;
    if (d.detalle) board.setDetalle(t.id, d.detalle, '');
    const partes: string[] = [];
    if (d.argumento) partes.push(d.argumento);
    partes.push(`El usuario la propone en ${d.userScore} (${PLABEL[prioFromScore(starter)]}) — podés corregirlo si no corresponde.`);
    if (!labelIds.length && d.motivoNinguno) partes.push(`Sin proyecto: ${d.motivoNinguno}.`);
    const argFinal = partes.join(' ') || '(sin argumento: puntualo por impacto objetivo comparándolo con el resto del plan)';
    try {
      const j = await fetch('/api/mako-guardian', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'debatir', tarea: d.title + (d.detalle ? `\n\n${d.detalle}` : ''), scoreActual: starter, argumento: argFinal, plan: planResumen, uso: 'Nueva tarea' }) }).then((r) => r.json());
      if (j.ok && typeof j.score === 'number') {
        board.setScore(t.id, j.score, `Priorizada al crear · score ${j.score}`, 'ia', j.razon);
        showUsage(j.usage, 'nueva tarea');
        return { id: t.id, score: j.score, razon: j.razon ?? '', respuesta: j.respuesta ?? '', prio: displayPrio({ ...t, score: j.score }, topProjectId) };
      }
    } catch { /* fallback abajo */ }
    return { id: t.id, score: starter, razon: '', respuesta: 'No pude priorizar ahora; quedó donde la propusiste. Podés debatirla después.', prio: displayPrio({ ...t, score: starter }, topProjectId) };
  };

  // G3: crear en lote las tareas que MaKo sacó de una reunión. Entran con la prioridad
  // sugerida; al cambiar la firma del plan, el guardián las re-puntúa solo (una corrida).
  // Deshacer = borrar las que se acaban de crear (fue una acción revisada, no un click suelto).
  const crearDesdeReunion = async (cands: Array<{ titulo: string; detalle: string; prioridad: Prio; proyectoId: string | null }>, fuente?: Fuente) => {
    // origen = MaKo (la IA extrajo estas tarjetas) + fuente (Fathom/archivo) + un alta
    // que deja rastro de DE DÓNDE salió (feedback jul-19 / regla del historial).
    const altaText = fuente?.tipo === 'fathom' ? `Creó la tarjeta — de la reunión «${fuente.etiqueta ?? ''}» (Fathom)`
      : fuente?.tipo === 'archivo' ? `Creó la tarjeta — del archivo «${fuente.etiqueta ?? ''}»`
        : undefined;
    const ids: string[] = [];
    for (const c of cands) {
      const t = await board.create(c.titulo, c.prioridad, c.proyectoId ? [c.proyectoId] : undefined, { origen: 'ia', fuente, altaText });
      if (!t) continue;
      if (c.detalle) board.setDetalle(t.id, c.detalle, '');
      ids.push(t.id);
    }
    if (ids.length) board.showUndo(`${ids.length} tarea${ids.length > 1 ? 's' : ''} de la reunión al plan`, () => ids.forEach((id) => board.removeSilent(id)));
  };

  return (
    <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', fontFamily: SANS }}>
      {/* símbolos de marca (para el logo de Fathom del toolbar/modal) — una vez por página */}
      <BrandDefs />
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 30px 16px', flexWrap: 'wrap' }}>
        {/* logo (checklist) + Plan — mismo ícono que la sidebar (feedback #2) */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          <PlanIcon size={38} />
          <span style={{ fontSize: 40, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.025em', lineHeight: 1 }}>Plan</span>
        </div>
        {/* tabs */}
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: 3 }}>
          {(['prioridades', 'kanban', 'proyectos', 'graphics'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} style={{ border: 'none', background: view === v ? 'var(--surface)' : 'transparent', color: view === v ? 'var(--ink)' : 'var(--dim)', fontWeight: view === v ? 600 : 500, fontSize: 13.5, padding: '7px 15px', borderRadius: 999, cursor: 'pointer', boxShadow: view === v ? '0 1px 2px rgba(18,21,27,.08)' : 'none', fontFamily: 'inherit', textTransform: 'capitalize' }}>{v === 'proyectos' ? repo.labelPlural : v}</button>
          ))}
        </div>
        {/* de acá para la derecha, todo alineado a la derecha */}
        <span style={{ flex: 1 }} />
        {view === 'kanban' && <AvgChip avg={avg} hechas={hechas} total={tasks.length} label="del plan" />}
        {view === 'prioridades' && <AvgChip avg={prioAvg} hechas={enPrio.length} total={MAX_PRIORIDAD} label="en prioridad" />}
        {view === 'proyectos' && <AvgChip avg={avgProj} hechas={hechosProj} total={labels.length} label="proyectos ✓" />}
        {view === 'kanban' && <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" style={{ minWidth: 120, maxWidth: 200, padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, outline: 'none' }} />
          <FilterMenu labels={labels} fLabels={fLabels} setFLabels={setFLabels} doneFilter={doneFilter} setDoneFilter={setDoneFilter} fOrigen={fOrigen} setFOrigen={setFOrigen} sortMode={sortMode} setSortMode={setSortMode} />
        </>}
        {/* ⚠ en TODAS las vistas (no solo kanban) y también con "no volver a pedir todos"
            activo: es el único modo de REABRIR el modal (lo promete el 2do pop-up). Cuando
            está apagado no titila (queda gris), para no naguear. */}
        {faltantes.length > 0 && (
          <button type="button" onClick={abrirDatosManual} title={`${faltantes.length} tarea${faltantes.length === 1 ? '' : 's'} con datos sin marcar (deadline / checklist)`} aria-label="Datos sin marcar"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', cursor: 'pointer', flex: 'none', padding: 0 }}>
            <WarnMark title="" size={18} blink={!datosOff} />
          </button>
        )}
        {/* Botón ✨ para RE-ABRIR la bienvenida "MaKo cargó tareas" (punto 3: ya no se pierde
            al tocar una tarea). Solo aparece si hay tareas nuevas de una fuente esta sesión. */}
        {hayWelcome && (
          <button type="button" onClick={() => setWelcomeVisible(true)} title={`${welcomeTasks.length} tarea${welcomeTasks.length === 1 ? '' : 's'} que cargó MaKo — ver`} aria-label="Tareas que cargó MaKo"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, borderRadius: 9, border: '1px solid var(--primary-weak)', background: 'var(--surface)', cursor: 'pointer', flex: 'none', padding: '0 11px' }}>
            <MakoStar size={15} color="var(--primary)" />
            <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{welcomeTasks.length}</span>
          </button>
        )}
        {view === 'proyectos' && <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" style={{ minWidth: 120, maxWidth: 200, padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, outline: 'none' }} />
          <FilterMenu doneFilter={projFilter} setDoneFilter={setProjFilter} estadoLabels={[['all', 'Todos'], ['activas', 'Activos'], ['comenzadas', 'Comenzados'], ['hechas', 'Completados']]} fOrigen={fOrigen} setFOrigen={setFOrigen} sortMode={sortMode} setSortMode={setSortMode} />
        </>}
        {/* Dos botones (feedback jul-18): el logo de Fathom (punto 6) abre la lista de
            reuniones; al lado, subir un archivo (punto 7) con ícono propio. */}
        {repo.fathomExtract && <>
          {/* El botón ES el logo de Fathom (feedback jul-18): sin contenedor blanco. Mismo 38×38 que el de subir. */}
          <button type="button" onClick={() => { setReunionArchivo(null); setExtraerReunion(true); }} aria-label="Extraer tareas de una reunión de Fathom" title="Extraer tareas de una reunión de Fathom (MaKo lee la transcripción)"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', flex: 'none', padding: 0, lineHeight: 0, borderRadius: 9, transition: 'opacity .12s' }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.82'; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}>
            <SvcIcon k="fathom" size={22} box={38} radius={9} />
          </button>
          <label aria-label="Subir un archivo de reunión (.md, .txt, transcript)" title="Subir un archivo de reunión (.md, .txt, transcript) y extraer tareas"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', cursor: 'pointer', flex: 'none', color: 'var(--dim)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--dim)'; }}>
            <UploadIcon />
            <input type="file" accept=".md,.txt,.vtt,.srt" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setReunionArchivo(f); setExtraerReunion(true); } e.currentTarget.value = ''; }} />
          </label>
        </>}
      </header>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {view === 'prioridades' && <Prioridades tasks={enPrio} board={board} objetivo={objetivoPrincipal} onOpen={setOpenId} onOpenProj={setOpenProj} />}
        {view === 'kanban' && <Kanban tasks={visibles} board={board} topProjectId={topProjectId} sortMode={sortMode} onOpen={setOpenId} onNew={(p) => { setNuevaTareaPrio(p ?? null); setNuevaTarea(true); }} onWarn={setOpenId} />}
        {view === 'proyectos' && <ProyectosView board={board} topProjectId={topProjectId} onOpen={setOpenProj} onNew={() => setNuevoProj(true)} projFilter={projFilter} q={q} fOrigen={fOrigen} sortMode={sortMode} />}
        {view === 'graphics' && <GraphicsView board={board} />}
      </div>

      {openTask && <TaskModal key={openTask.id} t={openTask} board={board} topProjectId={topProjectId} suggestMako={openTask.id === makoHintId} onDebate={() => setDebateId(openTask.id)} onDelete={() => setEliminarTaskId(openTask.id)} onAsignar={() => setAsignarTaskId(openTask.id)} onOpenProj={(id) => setPeekProjId(id)} escDisabled={!!peekProjId} ask={ask}
        onBack={(openProjLabel || welcomeVisible) ? () => { setOpenId(null); setMakoHintId(null); } : undefined}
        onClose={() => { setOpenId(null); setOpenProj(null); setPeekProjId(null); setMakoHintId(null); }} />}
      {peekProj && openTask && <ProjectDetailModal proj={peekProj} board={board} topProjectId={topProjectId} z={130} onBack={() => setPeekProjId(null)}
        onOpenTask={(id) => { setPeekProjId(null); setOpenId(id); }} onNewTask={() => { setNuevaTareaProj(peekProj.id); setNuevaTarea(true); }}
        onDebatePrio={() => setDebateProjId(peekProj.id)} onMako={() => setMakoProjId(peekProj.id)} onDelete={() => setEliminarProjId(peekProj.id)}
        onClose={() => setPeekProjId(null)} />}
      {debateTask && <DebateModal task={debateTask} planResumen={planResumen}
        otras={tasks.filter((t) => t.id !== debateTask.id && t.progress < 100).map((t) => { const l = board.labelById(t.labels[0]); return { id: t.id, title: t.title, score: t.score, projId: l?.id, projName: l?.name, projColor: l?.color, projEmoji: l?.emoji }; })}
        onUsage={(u) => showUsage(u, 'debate de prioridad')}
        onApply={(score, razon) => { const snap = debateTask; board.setScore(debateTask.id, score, `Debate con el Perro Guardián · score ${score}`, 'ia', razon); board.showUndo('Prioridad actualizada', () => board.replaceTask(snap)); }} onClose={() => setDebateId(null)} />}
      {nuevaTarea && <CrearTareaModal labels={labels} proyectoInicial={nuevaTareaProj} prioInicial={nuevaTareaPrio} ejemplos={tasks.filter((t) => t.progress < 100).map((t) => ({ title: t.title, score: t.score }))} onCrear={crearConGuardian} onDone={(id) => { setNuevaTarea(false); setNuevaTareaProj(null); setNuevaTareaPrio(null); setOpenId(id); setMakoHintId(id); }} onClose={() => { setNuevaTarea(false); setNuevaTareaProj(null); setNuevaTareaPrio(null); }} />}
      {openProjLabel && <ProjectDetailModal proj={openProjLabel} board={board} topProjectId={topProjectId} taskAbierta={!!openTask} onOpenTask={setOpenId} onNewTask={() => { setNuevaTareaProj(openProjLabel.id); setNuevaTarea(true); }} onDebatePrio={() => setDebateProjId(openProjLabel.id)} onMako={() => setMakoProjId(openProjLabel.id)} onDelete={() => setEliminarProjId(openProjLabel.id)} onClose={() => setOpenProj(null)} />}
      {makoProj && <MakoProyectoModal proj={{ name: makoProj.name, emoji: makoProj.emoji, detalle: makoProj.detalle }} onApply={(nombre, emoji, det) => board.patchLabelLog(makoProj.id, { name: nombre, emoji, detalle: det }, 'MaKo mejoró el proyecto', 'ia')} onClose={() => setMakoProjId(null)} />}
      {debateProj && <ProyectoDebateModal proj={debateProj} otros={labels.filter((l) => l.id !== debateProj.id).map((l) => ({ id: l.id, name: l.name, emoji: l.emoji, color: l.color, score: l.score }))} onUsage={(u) => showUsage(u, 'prioridad de proyecto')} onApply={(score, razon) => { const snap = debateProj; board.patchLabelLog(debateProj.id, { score, scoreRazon: razon || debateProj.scoreRazon }, `El Perro Guardián ajustó la prioridad → ${score}/10`, 'ia'); board.showUndo('Prioridad del proyecto actualizada', () => board.patchLabel(snap.id, snap)); }} onClose={() => setDebateProjId(null)} />}
      {nuevoProj && <CrearProyectoModal otros={labels.map((l) => ({ name: l.name, emoji: l.emoji, score: l.score, color: l.color }))} onCrear={crearProyecto} onClose={() => setNuevoProj(false)} />}
      {extraerReunion && <ReunionExtractModal labels={labels} archivoInicial={reunionArchivo} autoloadScope={autoloadScope}
        existentes={tasks.filter((t) => t.progress < 100).map((t) => ({ id: t.id, titulo: t.title, detalle: t.detalle }))}
        onUsage={(u) => showUsage(u, 'extraer tareas de reunión')} onCrear={crearDesdeReunion} onClose={() => { setExtraerReunion(false); setReunionArchivo(null); }} />}
      {eliminarTask && <EliminarModal tipo="tarea" nombre={eliminarTask.title} task={{ id: eliminarTask.id, title: eliminarTask.title, detalle: eliminarTask.detalle }}
        otras={tasks.filter((t) => t.id !== eliminarTask.id && t.progress < 100).map((t) => { const l = board.labelById(t.labels[0]); return { id: t.id, titulo: t.title, detalle: t.detalle, projColor: l?.color, projEmoji: l?.emoji }; })}
        plan={planResumen} onUsage={(u) => showUsage(u, 'eliminar tarea')}
        onCompletar={() => board.toggleDone(eliminarTask.id)}
        onDebate={() => setDebateId(eliminarTask.id)}
        onBorrar={(motivo) => { board.remove(eliminarTask.id, motivo); setOpenId(null); }} onClose={() => setEliminarTaskId(null)} />}
      {eliminarProj && <EliminarModal tipo="proyecto" nombre={eliminarProj.name} nTareas={tasks.filter((t) => t.labels.includes(eliminarProj.id)).length}
        plan={planResumen} onUsage={(u) => showUsage(u, 'eliminar proyecto')}
        onBorrar={() => { board.deleteLabelYTareas(eliminarProj.id); setOpenProj(null); }} onClose={() => setEliminarProjId(null)} />}
      {asignarTask && <AsignarProyectoModal task={asignarTask} labels={labels}
        onAsignar={(ids, motivo) => { const snap = asignarTask; board.setTaskLabels(asignarTask.id, ids, `${ids.length ? `Asignó a ${ids.map((id) => board.labelById(id)?.name).filter(Boolean).join(', ')}` : 'Quitó el proyecto'}${motivo ? ` — ${motivo.slice(0, 80)}` : ''}`); board.showUndo('Proyecto actualizado', () => board.replaceTask(snap)); }}
        onClose={() => setAsignarTaskId(null)} />}
      {datosOpen && <DatosModal items={faltantes}
        onSetDeadline={(id, fecha) => board.setDeadline(id, fecha, '')}
        onGenChecklist={generarChecklist}
        onAbrir={(id) => { setDatosOpen(false); setDatosConfirm(false); setOpenId(id); }}
        onIgnorarDl={ignorarDl}
        onIgnorarCl={ignorarCl}
        onClose={cerrarDatos} />}
      {datosConfirm && <DatosConfirm
        onNoPreguntar={() => { setDatosConfirm(false); apagarDatos(); }}
        onLuego={() => setDatosConfirm(false)} />}
      {/* Bienvenida "MaKo cargó tareas": PRIMERO al entrar (gatea el DatosModal). No se
          apila sobre un detalle abierto por deep-link (?tarea=): ahí espera a que se cierre. */}
      {welcomeVisible && !openId && !openProj && !peekProjId && <TareasCreadasModal tasks={welcomeTasks} projects={welcomeProjects}
        renderTaskCard={(t) => <CardTile t={t} board={board} warn={false} onOpen={setOpenId} onWarn={setOpenId} />}
        renderProjCard={(l) => <ProyectoCardTile l={l} prog={projProgress(tasks, l.id)} isTop={l.id === topProjectId} verDetalle onOpen={() => setOpenProj(l.id)} />}
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

function FunnelIcon({ color = 'currentColor' }: { color?: string }) { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>; }
// Ícono de subir archivo (bandeja + flecha hacia arriba) para el botón del toolbar (punto 7).
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
function matchTexto(t: BoardTask, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const soloNum = /^#\s*(\d+)$/.exec(s);
  if (soloNum) return t.num === Number(soloNum[1]);
  if (/^\d+$/.test(s) && t.num === Number(s)) return true;
  return (t.title + ' ' + t.detalle).toLowerCase().includes(s);
}

// filtro por estado (2ª capa del botón Filtrar): Todas / Activas / Comenzadas / Completadas
type DoneFilter = 'all' | 'activas' | 'comenzadas' | 'hechas';
const ESTADO_OPS: Array<[DoneFilter, string]> = [['all', 'Todas'], ['activas', 'Activas'], ['comenzadas', 'Comenzadas'], ['hechas', 'Completadas']];
function pasaEstado(progress: number, f: DoneFilter): boolean {
  if (f === 'all') return true;
  if (f === 'hechas') return progress >= 100;
  if (f === 'comenzadas') return progress > 0 && progress < 100;
  return progress < 100; // activas
}
// progreso agregado de un proyecto (promedio del avance de sus tareas)
function projProgress(tasks: BoardTask[], labelId: string): { pct: number; total: number; done: number } {
  const suyas = tasks.filter((t) => t.labels.includes(labelId));
  if (!suyas.length) return { pct: 0, total: 0, done: 0 };
  return { pct: Math.round(suyas.reduce((s, t) => s + t.progress, 0) / suyas.length), total: suyas.length, done: suyas.filter((t) => t.progress >= 100).length };
}

function AvgChip({ avg, hechas, total, label }: { avg: number; hechas: number; total: number; label: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 12px' }}>
      <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{avg}%</span>
      <span style={{ display: 'block', width: 74, height: 6, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: avg + '%', background: 'var(--primary)' }} /></span>
      <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>{hechas}/{total} {label}</span>
    </div>
  );
}

// Chip de proyecto. Si trae onOpen, es CLICKEABLE (feedback jul-19: el chip del header
// del detalle también debe abrir el proyecto, igual que los del sidebar).
function LabelChip({ l, cap = 190, onOpen }: { l: Label; cap?: number; onOpen?: (id: string) => void }) {
  const style: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: l.color, background: l.color + '14', border: `1px solid ${l.color}33`, padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap', maxWidth: cap, overflow: 'hidden', textOverflow: 'ellipsis', flex: 'none', fontFamily: SANS };
  const inner = <><span style={{ flex: 'none' }}>{l.emoji}</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</span></>;
  if (onOpen) return <button type="button" title={`Abrir «${l.name}»`} onClick={() => onOpen(l.id)} style={{ ...style, cursor: 'pointer' }}>{inner}</button>;
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
  return (
    <span ref={ref} style={{ flex: 'none', display: 'inline-flex' }} onMouseEnter={abrir} onMouseLeave={cerrarPronto}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--dim)', background: 'var(--surface)', border: `1px solid ${pos ? 'var(--primary)' : 'var(--border-strong)'}`, borderRadius: 6, padding: '2px 6px', cursor: 'default' }}>+{extra.length}</span>
      {pos && createPortal(
        <span onMouseEnter={abrir} onMouseLeave={cerrarPronto} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 5, width: 300, maxWidth: '92vw', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11, boxShadow: '0 16px 40px rgba(18,21,27,.24)', padding: 8, fontFamily: SANS }}>
          <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700, padding: '0 2px 2px' }}>También en</span>
          {extra.map((l) => {
            const est: CSSProperties = { display: 'inline-flex', alignItems: 'flex-start', gap: 6, fontSize: 12, fontWeight: 600, color: l.color, background: l.color + '14', border: `1px solid ${l.color}33`, borderRadius: 7, padding: '4px 9px', lineHeight: 1.35, textAlign: 'left', fontFamily: SANS };
            const cont = <><span style={{ flex: 'none' }}>{l.emoji}</span><span>{l.name}</span></>;
            return onOpen
              ? <button key={l.id} type="button" onClick={() => { setPos(null); onOpen(l.id); }} title={`Abrir «${l.name}»`} style={{ ...est, cursor: 'pointer', width: '100%' }}>{cont}</button>
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
      : `Cread${genero} por ${nombre || 'vos'}`;

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

// Aviso rojo tintineante (falta deadline/checklist). En la preview va al lado de la
// prioridad y es clickeable (abre el wizard); en el detalle, al lado del label.
function WarnMark({ title, onClick, size = 15, blink = true }: { title: string; onClick?: (e: import('react').MouseEvent) => void; size?: number; blink?: boolean }) {
  return (
    <span title={title} aria-label={title} role={onClick ? 'button' : undefined} onClick={onClick}
      style={{ display: 'inline-flex', flex: 'none', color: blink ? 'var(--bad)' : 'var(--faint)', cursor: onClick ? 'pointer' : 'default', animation: blink ? 'makoWarnBlink 1s ease-in-out infinite' : 'none' }}>
      <style>{'@keyframes makoWarnBlink{0%,100%{opacity:1}50%{opacity:.2}}'}</style>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
    </span>
  );
}

// Tarjeta de tarea: ALTURA FIJA para que todas midan igual (feedback jul-18). El
// título se recorta a 2 líneas; el toggle de completar es compacto (inline), no una
// píldora que agrandaba unas cards más que otras.
function CardTile({ t, board, warn, onOpen, onWarn }: {
  t: BoardTask; board: Board; warn: boolean; onOpen: (id: string) => void; onWarn: (id: string) => void;
}) {
  const done = t.progress >= 100;
  const clDone = t.checklist.filter((c) => c.done).length;
  return (
    <div onClick={() => onOpen(t.id)}
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '12px 14px', cursor: 'pointer', opacity: done ? 0.62 : 1, height: 138, display: 'flex', flexDirection: 'column', transition: 'border-color .12s' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')} onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}>
      {/* header: emoji (del proyecto) + #id + [aviso] + prioridad */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
        <span style={{ fontSize: 17, lineHeight: 1, flex: 'none' }}>{emojiTarea(board, t)}</span>
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', flex: 'none' }}>#{t.num}</span>
        <span style={{ flex: 1 }} />
        {warn && <WarnMark title={`Falta ${!t.deadline ? 'el deadline' : 'la checklist'}`} onClick={(e) => { e.stopPropagation(); onWarn(t.id); }} />}
        <ScoreBadge score={t.score} />
      </div>
      {/* título a 2 líneas máx (recortado) → todas las cards miden igual */}
      <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, color: 'var(--ink)', textDecoration: done ? 'line-through' : 'none', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>{t.title}</div>
      <span style={{ flex: 1 }} />
      {/* footer fijo: deadline + (checklist o completar) a la izquierda; % a la derecha */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, minHeight: 16 }}>
        {t.deadline && <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--dim)' }}>◷ {t.deadline.slice(5)}</span>}
        {t.checklist.length > 0
          ? <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>☑ {clDone}/{t.checklist.length}</span>
          : <button onClick={(e) => { e.stopPropagation(); board.toggleDone(t.id); }} title={done ? 'Marcar sin completar' : 'Marcar completada'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: SANS, fontSize: 10.5, fontWeight: 700, color: done ? 'var(--good)' : 'var(--faint)' }}>
              <span style={{ width: 13, height: 13, borderRadius: 4, border: `1px solid ${done ? 'var(--good)' : 'var(--border-strong)'}`, background: done ? 'var(--good)' : 'transparent', color: '#fff', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{done ? '✓' : ''}</span>
              {done ? 'Hecha' : 'Completar'}
            </button>}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--dim)' }}>{t.progress}%</span>
      </div>
      {/* avance SIEMPRE derivado (feedback #17): con checklist sale de ella; sin ella, el toggle de arriba */}
      <MiniBar v={t.progress} />
    </div>
  );
}

// ── vista Kanban (4 columnas por prioridad derivada del score; ancho completo) ──
function Kanban({ tasks, board, topProjectId, sortMode, onOpen, onNew, onWarn }: {
  tasks: BoardTask[]; board: Board; topProjectId: string | null; sortMode: 'score' | 'creacion'; onOpen: (id: string) => void; onNew: (p?: Prio) => void; onWarn: (id: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, padding: '18px 30px 30px', height: '100%', alignItems: 'flex-start' }} className="mako-board">
      <style>{`@media (max-width:1000px){.mako-board{grid-template-columns:repeat(2,1fr)!important}}@media (max-width:560px){.mako-board{grid-template-columns:1fr!important}}`}</style>
      {PRIOS.map((p) => {
        const items = tasks.filter((t) => displayPrio(t, topProjectId) === p).sort((a, b) => (a.progress >= 100 ? 1 : 0) - (b.progress >= 100 ? 1 : 0) || (sortMode === 'creacion' ? a.num - b.num : (b.score - a.score || a.num - b.num)));
        return (
          <section key={p} style={{ display: 'flex', flexDirection: 'column', maxHeight: '100%', minWidth: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderTop: '3px solid ' + PCOLOR[p], borderRadius: 14, padding: 10 }}>
            <ColHeader p={p} count={items.length} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, overflowY: 'auto', minHeight: 30, paddingRight: 2 }}>
              {/* card gris translúcida para crear (arriba de todo, más bajita que las tarjetas) */}
              <button onClick={() => onNew(p)} style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1.5px dashed var(--border-strong)', background: 'transparent', borderRadius: 10, padding: '9px 10px', cursor: 'pointer', color: 'var(--faint)', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, opacity: 0.8, transition: 'border-color .12s, color .12s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--faint)'; }}>＋ Nueva tarea</button>
              {items.length === 0 && <div style={{ fontSize: 12, color: 'var(--faint)', textAlign: 'center', padding: '10px 0' }}>—</div>}
              {items.map((t) => <CardTile key={t.id} t={t} board={board} warn={displayPrio(t, topProjectId) === 'alta' && t.progress < 100 && (!t.deadline || t.checklist.length === 0)} onOpen={onOpen} onWarn={onWarn} />)}
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
function Prioridades({ tasks, board, objetivo, onOpen, onOpenProj }: { tasks: BoardTask[]; board: Board; objetivo: Label | null; onOpen: (id: string) => void; onOpenProj: (id: string) => void }) {
  const [expand, setExpand] = useState<Set<string>>(new Set());
  const toggleExp = (id: string) => setExpand((s) => { const c = new Set(s); if (c.has(id)) c.delete(id); else c.add(id); return c; });
  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '18px 30px 40px' }}>
      <div className="mako-prio" style={{ width: '100%', maxWidth: 1060, display: 'flex', gap: 20, alignItems: 'stretch' }}>
        <style>{`@media (max-width:840px){.mako-prio{flex-direction:column!important}.mako-prio-obj{flex:none!important;width:auto!important}}`}</style>
        {/* IZQUIERDA — Objetivo Principal (card alto, clickeable) */}
        <div className="mako-prio-obj" style={{ flex: '0 0 336px', display: 'flex' }}>
          {objetivo ? <ObjetivoCard objetivo={objetivo} prog={projProgress(board.tasks, objetivo.id)} onOpen={() => onOpenProj(objetivo.id)} /> : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--faint)', fontSize: 13.5, border: '1px dashed var(--border-strong)', borderRadius: 16, padding: 24 }}>Todavía no hay un Objetivo Principal. Creá un proyecto y el perro elige el norte.</div>
          )}
        </div>
        {/* DERECHA — las 3 tareas en prioridad */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 700 }}>🎯 Tareas prioritarias · {tasks.length}/{MAX_PRIORIDAD}</div>
          {tasks.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--faint)', textAlign: 'center', padding: '24px 20px', border: '1px dashed var(--border-strong)', borderRadius: 14 }}>
              <div style={{ fontSize: 14, maxWidth: 400, lineHeight: 1.5 }}>MaKo pone acá, solo, las {MAX_PRIORIDAD} tareas de mayor prioridad del Objetivo Principal. Todavía no hay ninguna.</div>
            </div>
          )}
          {tasks.map((t, i) => {
            const clDone = t.checklist.filter((c) => c.done).length;
            const open = expand.has(t.id);
            return (
              <div key={t.id} onClick={() => onOpen(t.id)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px', boxShadow: '0 1px 2px rgba(18,21,27,.05)', cursor: 'pointer', transition: 'border-color .12s' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')} onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}>
                {/* Como el proyecto de al lado (feedback jul-18): arriba ranking + emoji +
                    #id + prioridad; el título abajo, en su línea. Sin tag de proyecto. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span title={`Prioridad ${i + 1}`} style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', fontFamily: MONO }}>{i + 1}</span>
                  <span style={{ fontSize: 22, lineHeight: 1, flex: 'none' }}>{emojiTarea(board, t)}</span>
                  <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)', flex: 'none' }}>#{t.num}</span>
                  <span style={{ flex: 1 }} />
                  {(!t.deadline || t.checklist.length === 0) && <WarnMark title={`Falta ${!t.deadline ? 'el deadline' : 'la checklist'}`} size={16} />}
                  <ScoreBadge score={t.score} />
                </div>
                <div style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.3, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 12 }}>{t.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: t.checklist.length ? 12 : 0 }}>
                  <span style={{ flex: 1 }}><MiniBar v={t.progress} /></span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--dim)' }}>{t.progress}%</span>
                  {t.checklist.length > 0 && <button onClick={(e) => { e.stopPropagation(); toggleExp(t.id); }} style={{ border: 'none', background: 'transparent', color: 'var(--dim)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>{open ? '▾' : '▸'} checklist {clDone}/{t.checklist.length}</button>}
                </div>
                {open && t.checklist.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    {t.checklist.map((c) => (
                      <label key={c.id} onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', padding: '3px 0' }}>
                        <button onClick={(e) => { e.stopPropagation(); board.setChecklist(t.id, t.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)), c.done ? undefined : `Completó "${c.text.slice(0, 30)}"`); }} style={{ width: 16, height: 16, borderRadius: 4, border: `1px solid ${c.done ? 'var(--good)' : 'var(--border-strong)'}`, background: c.done ? 'var(--good)' : 'transparent', color: '#fff', fontSize: 11, cursor: 'pointer', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.done ? '✓' : ''}</button>
                        <span style={{ fontSize: 13.5, color: c.done ? 'var(--faint)' : 'var(--ink)', textDecoration: c.done ? 'line-through' : 'none' }}>{c.text}</span>
                      </label>
                    ))}
                  </div>
                )}
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
    <div onClick={onOpen} style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: `1px solid ${objetivo.color}59`, borderTop: `4px solid ${objetivo.color}`, borderRadius: 16, padding: '20px 22px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(18,21,27,.05)', transition: 'border-color .12s' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = objetivo.color; e.currentTarget.style.borderTopColor = objetivo.color; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = objetivo.color + '59'; e.currentTarget.style.borderTopColor = objetivo.color; }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: objetivo.color, fontWeight: 700 }}>🎯 Objetivo Principal</span>
        <span style={{ flex: 1 }} />
        <ProjScore score={objetivo.score} color={objetivo.color} />
      </div>
      {/* emoji + id (mismo tamaño/color que en el kanban) antes del nombre */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 26, lineHeight: 1 }}>{objetivo.emoji}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{objetivo.pid}</span>
      </div>
      <div style={{ fontSize: 21, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1.25 }}>{objetivo.name}</div>
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
function FilterMenu({ labels, fLabels, setFLabels, doneFilter, setDoneFilter, estadoLabels, fOrigen, setFOrigen, sortMode, setSortMode }: {
  labels?: Label[]; fLabels?: Set<string>; setFLabels?: (s: Set<string>) => void;
  doneFilter: DoneFilter; setDoneFilter: (f: DoneFilter) => void; estadoLabels?: Array<[DoneFilter, string]>;
  fOrigen?: Set<string>; setFOrigen?: (s: Set<string>) => void;
  sortMode?: 'score' | 'creacion'; setSortMode?: (m: 'score' | 'creacion') => void;
}) {
  const [open, setOpen] = useState(false);
  const n = (fLabels?.size ?? 0) + (fOrigen?.size ?? 0) + (doneFilter !== 'all' ? 1 : 0);
  const toggle = (id: string) => { if (!fLabels || !setFLabels) return; const c = new Set(fLabels); if (c.has(id)) c.delete(id); else c.add(id); setFLabels(c); };
  const toggleOrigen = (tipo: string) => { if (!fOrigen || !setFOrigen) return; const c = new Set(fOrigen); if (c.has(tipo)) c.delete(tipo); else c.add(tipo); setFOrigen(c); };
  const ops = estadoLabels ?? ESTADO_OPS;
  const secLabel: CSSProperties = { fontFamily: MONO, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700, padding: '2px 4px 6px' };
  const sepLabel: CSSProperties = { ...secLabel, marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 10 };
  const check = (on: boolean): CSSProperties => ({ width: 14, height: 14, borderRadius: 4, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' });
  const radio = (on: boolean): CSSProperties => ({ width: 13, height: 13, borderRadius: '50%', border: `2px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', flex: 'none', boxShadow: on ? 'inset 0 0 0 2px var(--surface)' : 'none' });
  const rowBtn: CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 9px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12.5, color: 'var(--ink)', textAlign: 'left', fontFamily: SANS };
  return (
    <span style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} style={{ position: 'relative', ...ghostBtn, display: 'inline-flex', alignItems: 'center', gap: 7, background: open ? 'var(--surface-2)' : 'var(--surface)', color: n > 0 ? 'var(--primary)' : 'var(--dim)', borderColor: n > 0 ? 'var(--primary-weak)' : 'var(--border-strong)' }}>
        <FunnelIcon color="var(--primary)" />Filtrar
        {n > 0 && <span onClick={(e) => { e.stopPropagation(); setFLabels?.(new Set()); setFOrigen?.(new Set()); setDoneFilter('all'); }} title="Limpiar" style={{ position: 'absolute', top: -7, right: -7, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: 'var(--primary)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)' }}>{n}</span>}
      </button>
      {open && <>
        <span onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
        <div style={{ position: 'absolute', top: 40, right: 0, zIndex: 41, width: 234, maxHeight: 460, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 16px 40px rgba(18,21,27,.16)', padding: 8 }}>
          {/* CAPA 1: estado */}
          <div style={secLabel}>Estado</div>
          {ops.map(([v, label]) => (
            <button key={v} onClick={() => setDoneFilter(v)} style={{ ...rowBtn, background: doneFilter === v ? 'var(--primary-bg)' : 'transparent', fontWeight: doneFilter === v ? 700 : 500 }}>
              <span style={radio(doneFilter === v)} />
              <span>{label}</span>
            </button>
          ))}
          {/* CAPA 2: etiquetas (solo si hay labels) */}
          {labels && labels.length > 0 && (
            <>
              <div style={sepLabel}>Proyecto</div>
              {labels.map((l) => (
                <button key={l.id} onClick={() => toggle(l.id)} style={rowBtn}>
                  <span style={check(!!fLabels?.has(l.id))}>{fLabels?.has(l.id) ? '✓' : ''}</span>
                  <span>{l.emoji} {l.name}</span>
                </button>
              ))}
            </>
          )}
          {/* CAPA 3: origen (fuente de creación) */}
          {fOrigen && setFOrigen && (
            <>
              <div style={sepLabel}>Origen</div>
              {ORIGEN_OPS.map(([tipo, label]) => (
                <button key={tipo} onClick={() => toggleOrigen(tipo)} style={rowBtn}>
                  <span style={check(fOrigen.has(tipo))}>{fOrigen.has(tipo) ? '✓' : ''}</span>
                  <span>{label}</span>
                </button>
              ))}
            </>
          )}
          {/* CAPA 4: orden */}
          {sortMode && setSortMode && (
            <>
              <div style={sepLabel}>Ordenar</div>
              {([['score', 'Por prioridad'], ['creacion', 'Por creación']] as Array<['score' | 'creacion', string]>).map(([v, label]) => (
                <button key={v} onClick={() => setSortMode(v)} style={{ ...rowBtn, background: sortMode === v ? 'var(--primary-bg)' : 'transparent', fontWeight: sortMode === v ? 700 : 500 }}>
                  <span style={radio(sortMode === v)} />
                  <span>{label}</span>
                </button>
              ))}
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
  if (t.historial.length === 0) return <div style={{ fontSize: 12.5, color: 'var(--faint)', fontStyle: 'italic' }}>Sin actividad todavía. Los cambios van a aparecer acá.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {t.historial.map((h, i) => {
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
    </div>
  );
}

// ── modal de detalle ────────────────────────────────────────────────────────────
function TaskModal({ t, board, topProjectId, suggestMako = false, onDebate, onDelete, onAsignar, onOpenProj, ask, onBack, escDisabled = false, onClose }: {
  t: BoardTask; board: Board; topProjectId: string | null; suggestMako?: boolean; onDebate: () => void; onDelete: () => void; onAsignar: () => void; onOpenProj?: (id: string) => void; ask: (msg: string, onOk: () => void) => void; onBack?: () => void; escDisabled?: boolean; onClose: () => void;
}) {
  const prioEfectiva = displayPrio(t, topProjectId);
  const topeada = prioEfectiva !== prioFromScore(t.score);
  const [newItem, setNewItem] = useState('');
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !mako && !escDisabled) { (document.activeElement as HTMLElement)?.blur?.(); salir(); } };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [mako, escDisabled, salir]);
  const chips = t.labels.map((id) => board.labelById(id)).filter((l): l is Label => l != null);
  const cl = t.checklist; const clDone = cl.filter((c) => c.done).length;
  const setCl = (next: Check[], log?: string) => board.setChecklist(t.id, next, log);
  const optimizada = t.historial.some((h) => h.text.startsWith('MaKo'));
  const rowLabel: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6, display: 'block' };

  return (
    <div onClick={salir} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(18,21,27,.35)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '7vh 16px 16px', fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 820, maxHeight: '85vh', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 24px 60px rgba(18,21,27,.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px', borderBottom: '1px solid var(--border)', flex: 'none' }}>
          {onBack && <button onClick={onBack} title="Volver al proyecto" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 8, padding: '5px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>← Volver</button>}
          <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', fontWeight: 600, flex: 'none' }}>#{t.num}</span>
          {/* en el header, compacto (la lista completa está en el sidebar "Proyectos") */}
          <LabelChips chips={chips} max={1} cap={230} onOpen={onOpenProj} />
          <FuenteChip fuente={fuenteEfectiva(t)} />
          <span style={{ flex: 1 }} />
          <button onClick={() => setMako(true)} title={optimizada ? 'Ya optimizada por MaKo — podés volver a pedirle ayuda' : 'MaKo te ayuda a mejorar título, detalle y checklist'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${optimizada ? 'var(--good)' : 'var(--primary-weak)'}`, background: optimizada ? 'var(--good-bg, var(--surface))' : 'var(--primary-bg)', color: optimizada ? 'var(--good)' : 'var(--primary)', borderRadius: 8, padding: '5px 11px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', boxShadow: suggestMako && !optimizada ? '0 0 0 3px var(--primary-weak)' : 'none', animation: suggestMako && !optimizada ? 'makoPulse 1.4s ease-in-out infinite' : 'none' }}>
            <style>{`@keyframes makoPulse{0%,100%{box-shadow:0 0 0 2px var(--primary-weak)}50%{box-shadow:0 0 0 5px transparent}}`}</style>
            {optimizada ? '✦ MaKo ✓ optimizada' : suggestMako ? '✦ Optimizala con MaKo' : '✦ MaKo te ayuda'}
          </button>
          <button aria-label="Cerrar" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 22, lineHeight: 1, color: 'var(--faint)', padding: '2px 6px' }}>×</button>
        </div>
        <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '20px 22px' }}>
            <textarea value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} onBlur={() => board.setTitle(t.id, titleDraft, t.title)} rows={2} style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 22, fontWeight: 600, lineHeight: 1.3, fontFamily: SANS, letterSpacing: '-0.01em', marginBottom: 16 }} />
            <label style={rowLabel}>Detalle · doc</label>
            <div style={{ marginBottom: 22 }}><RichText value={t.detalle} onChange={(html) => board.setDetalle(t.id, html, t.detalle)} placeholder="El doc de esta tarea…" /></div>

            {/* Avance ARRIBA de la checklist (feedback #6). Siempre derivado (#17):
                con checklist sale de ella; sin checklist, botón Completada (0↔100). */}
            <label style={rowLabel}>Avance · {t.progress}%{cl.length > 0 ? ' · lo maneja la checklist' : ''}</label>
            <span style={{ display: 'block', marginBottom: 10 }}><MiniBar v={t.progress} /></span>
            {cl.length === 0 && (
              <button onClick={() => board.toggleDone(t.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: `1px solid ${t.progress >= 100 ? 'var(--good)' : 'var(--border-strong)'}`, background: t.progress >= 100 ? 'var(--good-bg, var(--surface))' : 'var(--surface)', color: t.progress >= 100 ? 'var(--good)' : 'var(--dim)', borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, marginBottom: 22 }}>
                <span style={{ width: 16, height: 16, borderRadius: 5, border: `1px solid ${t.progress >= 100 ? 'var(--good)' : 'var(--border-strong)'}`, background: t.progress >= 100 ? 'var(--good)' : 'transparent', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{t.progress >= 100 ? '✓' : ''}</span>
                {t.progress >= 100 ? 'Completada' : 'Marcar como completada'}
              </button>
            )}

            <label style={rowLabel}>Checklist {cl.length > 0 && `· ${clDone}/${cl.length} · manda el avance`}</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {cl.map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 2px' }}>
                  <button onClick={() => setCl(cl.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)), c.done ? undefined : `Completó "${c.text.slice(0, 30)}"`)} style={{ width: 16, height: 16, borderRadius: 4, border: `1px solid ${c.done ? 'var(--good)' : 'var(--border-strong)'}`, background: c.done ? 'var(--good)' : 'transparent', color: '#fff', fontSize: 11, cursor: 'pointer', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.done ? '✓' : ''}</button>
                  <input value={c.text} onChange={(e) => setCl(cl.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)))} style={{ flex: 1, border: 'none', background: 'transparent', color: c.done ? 'var(--faint)' : 'var(--ink)', fontSize: 13.5, outline: 'none', fontFamily: SANS, textDecoration: c.done ? 'line-through' : 'none' }} />
                  <button aria-label="Quitar" onClick={() => setCl(cl.filter((x) => x.id !== c.id))} style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
            <input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newItem.trim()) { setCl([...cl, { id: uid(), text: newItem.trim(), done: false }], `Agregó "${newItem.trim().slice(0, 30)}" al checklist`); setNewItem(''); } }} placeholder="+ ítem de checklist (Enter)" style={{ width: '100%', padding: '8px 11px', borderRadius: 8, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--ink)', fontSize: 13, outline: 'none', marginBottom: 24 }} />

            <label style={rowLabel}>Change history</label>
            <ChangeHistory t={t} board={board} ask={ask} />
          </div>
          <div style={{ width: 236, flex: 'none', borderLeft: '1px solid var(--border)', background: 'var(--surface-2)', padding: '20px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 15 }}>
            <div>
              {/* #5: "Prioridad: ALTA — 90" directo y grande, sin subtítulo, con ícono sofisticado */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: t.scoreRazon || topeada ? 8 : 10 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Prioridad:</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: PCOLOR[prioEfectiva], letterSpacing: '.01em' }}>{PLABEL[prioEfectiva].toUpperCase()}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontSize: 15, fontWeight: 700, color: PCOLOR[prioEfectiva] }}><ScoreIcon size={15} color={PCOLOR[prioEfectiva]} />{t.score}</span>
              </div>
              {t.scoreRazon && <div style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.4, marginBottom: 8, fontStyle: 'italic' }}>“{t.scoreRazon}”</div>}
              {(t.impacto != null || t.esfuerzo != null) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10 }}>
                  {t.impacto != null && <IEMeter label="Impacto" v={t.impacto} color="#1E9E57" />}
                  {t.esfuerzo != null && <IEMeter label="Esfuerzo" v={t.esfuerzo} color="#C8870C" />}
                </div>
              )}
              <button onClick={onDebate} style={cambiarBtn}><MakoStar size={15} color="var(--primary)" /> Cambiar prioridad</button>
            </div>
            {/* #5: deadline en el sidebar */}
            <div><label style={{ ...rowLabel, display: 'inline-flex', alignItems: 'center', gap: 6 }}>Deadline {!t.deadline && <WarnMark title="Falta el deadline" size={13} />}</label><input type="date" value={t.deadline} onChange={(e) => board.setDeadline(t.id, e.target.value, t.deadline)} style={selStyle} /></div>
            <div>
              <label style={rowLabel}>{board.repo.labelPlural}</label>
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
              <button onClick={onAsignar} style={cambiarBtn}><MakoStar size={15} color="var(--primary)" /> {chips.length ? 'Cambiar proyecto' : 'Asignar proyecto'}</button>
            </div>
            <span style={{ flex: 1 }} />
            <button onClick={onDelete} style={{ border: 'none', background: 'transparent', color: 'var(--bad)', fontSize: 12.5, cursor: 'pointer', textAlign: 'left', padding: '4px 0' }}>Eliminar tarea</button>
          </div>
        </div>
      </div>
      {mako && <MakoChecklistModal title={t.title} detalle={t.detalle} yaOptimizada={optimizada} onApply={(r) => {
        if (r.titulo) board.setTitle(t.id, r.titulo, t.title);
        if (r.detalle) board.setDetalle(t.id, r.detalle, t.detalle);
        if (r.items.length) setCl([...cl, ...r.items.map((x) => ({ id: uid(), text: x, done: false }))], `MaKo optimizó la tarea (+${r.items.length} ítem${r.items.length === 1 ? '' : 's'})`);
      }} onClose={() => setMako(false)} />}
    </div>
  );
}

// ── change history para proyectos — con deshacer (solo la última entrada del usuario) ──
function HistList({ historial, nombre, avatarUrl, onUndo }: { historial: BoardTask['historial']; nombre: string; avatarUrl: string; onUndo?: (h: import('./types').Hist) => void }) {
  const [nowMs, setNowMs] = useState(0);
  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => { setNowMs(Date.now()); }, []);
  if (historial.length === 0) return <div style={{ fontSize: 12.5, color: 'var(--faint)', fontStyle: 'italic' }}>Sin actividad todavía.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {historial.map((h, i) => {
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
    </div>
  );
}

// ── change history de la TAB Proyectos: agrega los eventos de CADA proyecto
// (creación/rename/detalle/score…), NO los de tareas (esos viven en el detalle). ──
function ProjTabHist({ labels, nombre, avatarUrl }: { labels: Label[]; nombre: string; avatarUrl: string }) {
  const [nowMs, setNowMs] = useState(0);
  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => { setNowMs(Date.now()); }, []);
  const rows = labels
    .flatMap((l) => l.historial.filter((h) => h.kind !== 'task').map((h) => ({ h, l })))
    .sort((a, b) => b.h.ts - a.h.ts)
    .slice(0, 40);
  if (rows.length === 0) return <div style={{ fontSize: 12.5, color: 'var(--faint)', fontStyle: 'italic' }}>Sin actividad de proyectos todavía.</div>;
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
      {verDetalle && l.scoreRazon && <div style={{ fontSize: 11.5, color: 'var(--faint)', fontStyle: 'italic', lineHeight: 1.45 }}>🐕 {l.scoreRazon}</div>}
      <span style={{ flex: 1 }} />
      {prog.total > 0 && <span style={{ display: 'block' }}><MiniBar v={prog.pct} /></span>}
      <div style={{ display: 'flex', alignItems: 'center', fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>
        {prog.total ? <><span>{prog.done}/{prog.total}</span><span style={{ flex: 1 }} /><span style={{ fontWeight: 700, color: 'var(--dim)' }}>{prog.pct}%</span></> : <span>sin tareas</span>}
      </div>
    </div>
  );
}

// ── vista Proyectos (tab): cards ordenadas por prioridad ────────────────────────
function ProyectosView({ board, topProjectId, onOpen, onNew, projFilter, q, fOrigen, sortMode }: { board: Board; topProjectId: string | null; onOpen: (id: string) => void; onNew: () => void; projFilter: DoneFilter; q: string; fOrigen: Set<string>; sortMode: 'score' | 'creacion' }) {
  const { labels, tasks, repo } = board;
  const [verTodos, setVerTodos] = useState(false);
  const TOPE = 6; // feedback jul-18: al arranque, el "+" (cuenta como 1) + 5 proyectos reales; el resto tras "Ver más"
  const REALES = TOPE - 1;
  const needle = q.trim().toLowerCase();
  // Orden por PRIORIDAD (score, default) o por CREACIÓN (ts más viejo del historial).
  const creTs = (l: Label) => (l.historial?.length ? Math.min(...l.historial.map((h) => h.ts)) : 0);
  const ordenados = labels.slice().sort((a, b) => (sortMode === 'creacion' ? creTs(a) - creTs(b) : b.score - a.score));
  const origenDe = (l: Label) => fuenteEfectiva({ origen: l.historial[l.historial.length - 1]?.actor ?? 'user', fuente: l.fuente }).tipo;
  const withProg = ordenados.map((l) => ({ l, prog: projProgress(tasks, l.id) }));
  const shown = withProg
    .filter(({ l }) => !needle || `${l.name} ${stripHtml(l.detalle ?? '')}`.toLowerCase().includes(needle))
    .filter(({ l }) => fOrigen.size === 0 || fOrigen.has(origenDe(l)))
    .filter(({ prog }) => pasaEstado(prog.pct, projFilter));
  const visibles = (verTodos || needle) ? shown : shown.slice(0, REALES);
  const resto = shown.length - visibles.length;
  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '18px 30px 40px' }}>
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
        <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700, marginBottom: 12 }}>Change history · proyectos</div>
          <ProjTabHist labels={labels} nombre={board.user.nombre} avatarUrl={board.user.avatarUrl} />
        </div>
      </div>
    </div>
  );
}

// ── detalle de un proyecto — MISMO layout de 2 columnas que la ficha de tarea (#25) ─
function ProjectDetailModal({ proj, board, topProjectId, taskAbierta = false, z = 90, onBack, onOpenTask, onNewTask, onDebatePrio, onMako, onDelete, onClose }: { proj: Label; board: Board; topProjectId: string | null; taskAbierta?: boolean; z?: number; onBack?: () => void; onOpenTask: (id: string) => void; onNewTask: () => void; onDebatePrio: () => void; onMako: () => void; onDelete: () => void; onClose: () => void }) {
  const [nameDraft, setNameDraft] = useState(proj.name);
  // No cerrar con Escape cuando hay una tarea abierta ENCIMA (esa maneja su propio Escape).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !taskAbierta) { (document.activeElement as HTMLElement)?.blur?.(); onClose(); } };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [onClose, taskAbierta]);
  const suyas = board.tasks.filter((t) => t.labels.includes(proj.id)).sort((a, b) => (a.progress >= 100 ? 1 : 0) - (b.progress >= 100 ? 1 : 0) || b.score - a.score);
  const prog = projProgress(board.tasks, proj.id);
  const isTop = proj.id === topProjectId;
  const rowLabel: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6, display: 'block' };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: z, background: 'rgba(18,21,27,.35)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '7vh 16px 16px', fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 820, maxHeight: '85vh', background: 'var(--surface)', border: '1px solid var(--border)', borderTop: `4px solid ${proj.color}`, borderRadius: 16, boxShadow: '0 24px 60px rgba(18,21,27,.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* header teñido con el color del proyecto (punto 3): distingue el detalle de cada uno */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px', borderBottom: `1px solid ${proj.color}33`, background: `${proj.color}12`, flex: 'none' }}>
          {onBack && <button onClick={onBack} title="Volver a la tarea" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 8, padding: '5px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS, flex: 'none' }}>← Volver a la tarea</button>}
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
            <label style={rowLabel}>Avance · {prog.pct}%{prog.total ? ` · ${prog.done}/${prog.total} tareas` : ''}</label>
            <span style={{ display: 'block', marginBottom: 20 }}><MiniBar v={prog.pct} /></span>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
              <label style={{ ...rowLabel, marginBottom: 0 }}>Tareas del proyecto · {suyas.length}</label>
              <span style={{ flex: 1 }} />
              <button onClick={onNewTask} style={{ border: '1px solid var(--primary-weak)', background: 'var(--primary-bg)', color: 'var(--primary)', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>+ Nueva Tarea</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {suyas.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--faint)', fontStyle: 'italic' }}>Sin tareas todavía.</div>}
              {suyas.map((t) => (
                <div key={t.id} onClick={() => onOpenTask(t.id)} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '11px 13px', cursor: 'pointer', opacity: t.progress >= 100 ? 0.62 : 1, transition: 'border-color .12s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')} onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                    <ScoreBadge score={t.score} />
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', textDecoration: t.progress >= 100 ? 'line-through' : 'none', minWidth: 0 }}>{t.title}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--dim)' }}>{t.progress}%</span>
                  </div>
                  <MiniBar v={t.progress} />
                </div>
              ))}
            </div>

            <label style={rowLabel}>Change history del proyecto</label>
            <HistList historial={proj.historial} nombre={board.user.nombre} avatarUrl={board.user.avatarUrl} onUndo={(h) => board.undoLabelHist(proj.id, h)} />
          </div>
          {/* sidebar */}
          <div style={{ width: 236, flex: 'none', borderLeft: '1px solid var(--border)', background: 'var(--surface-2)', padding: '20px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 15 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: proj.scoreRazon ? 8 : 10 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Prioridad</span>
                <ProjScore score={proj.score} color={proj.color} big />
              </div>
              {proj.scoreRazon && <div style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.4, marginBottom: 8, fontStyle: 'italic' }}>“{proj.scoreRazon}”</div>}
              {(proj.impacto != null || proj.esfuerzo != null) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10 }}>
                  {proj.impacto != null && <IEMeter label="Impacto" v={proj.impacto} color="#1E9E57" />}
                  {proj.esfuerzo != null && <IEMeter label="Esfuerzo" v={proj.esfuerzo} color="#C8870C" />}
                </div>
              )}
              <button onClick={onDebatePrio} style={cambiarBtn}><MakoStar size={15} color="var(--primary)" /> Cambiar prioridad</button>
            </div>
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
