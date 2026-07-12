'use client';

// =============================================================================
// PlanBoard — plan de ejecución de MaKo (super-admin, en /todo)
// =============================================================================
// Board privado de Martín, estilo Trello/CRM adaptado al tema CLARO de la app.
// COLUMNAS DINÁMICAS (agregar/renombrar/color/borrar) con drag & drop nativo (el
// patrón del CRM). La PRIORIDAD es una etiqueta en la tarjeta (no la columna).
// Proyectos editables (color+emoji). Detalle en MODAL con checklist. Toast de
// guardado + deshacer 5s. Vista "Prioridades" = solo el Foco (★).
// Persistencia: localStorage (mako_plan_v3*). El cliente verá el MISMO componente
// cableado a la DB (próximo commit). Adjuntos → fase de Storage.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type MouseEvent as RME, type DragEvent as RDragEvent } from 'react';
import { useUndoToast, UndoToast } from '../_components/UndoToast';

const MONO = "'Geist Mono', monospace";

type Prio = 'alta' | 'media' | 'baja' | 'futuro';
type Check = { id: string; text: string; done: boolean };
type Task = { id: string; n: number; text: string; project: string; priority: Prio; col: string; prog: number; detalle: string; foco: boolean; deadline: string; checklist: Check[] };
type Col = { id: string; name: string; color: string };
type Proj = { id: string; emoji: string; name: string; color: string };

const PRIOS: Prio[] = ['alta', 'media', 'baja', 'futuro'];
const PLABEL: Record<Prio, string> = { alta: 'Alta', media: 'Media', baja: 'Baja', futuro: 'A futuro' };
const PCOLOR: Record<Prio, string> = { alta: '#D0504A', media: '#C8870C', baja: '#1E9E57', futuro: '#98A0AC' };
const SWATCHES = ['#98A0AC', '#2F6FED', '#1E9E57', '#C8870C', '#D0504A', '#7C5CFB', '#0E9B8E', '#D6489B'];

const COLS_DEFAULT: Col[] = [
  { id: 'todo', name: 'Por hacer', color: '#98A0AC' },
  { id: 'doing', name: 'En curso', color: '#2F6FED' },
  { id: 'done', name: 'Hecho', color: '#1E9E57' },
];
const colFromStatus = (s: string) => (s === 'hecho' ? 'done' : s === 'parcial' ? 'doing' : 'todo');

const PROJS_DEFAULT: Proj[] = [
  { id: 'doer', emoji: '🔴', name: 'Hacer MaKo DOER', color: '#D0504A' },
  { id: 'plat', emoji: '🧱', name: 'Plataforma & Núcleo', color: '#2F6FED' },
  { id: 'canales', emoji: '💬', name: 'Canales & Mensajería', color: '#7C5CFB' },
  { id: 'analy', emoji: '🔍', name: 'Analysts & Generadores', color: '#0E9B8E' },
  { id: 'growth', emoji: '📈', name: 'Growth · Vender MaKo', color: '#C8870C' },
  { id: 'ux', emoji: '✨', name: 'UX & Diseño', color: '#D6489B' },
];

// [n, texto, proyecto, prioridad, status, prog, detalle, foco]  (status → col)
type Row = [number, string, string, Prio, string, number, string, boolean];
const SEED: Row[] = [
  [42, 'Retro & Planning: la tab-cerebro', 'doer', 'alta', 'hecho', 100, 'Base hecha. Casa del programa DOER: reportes + plan, ligada a Experiments.', false],
  [55, 'Catálogo de fugas: que Retro detecte los patrones', 'doer', 'alta', 'abierto', 0, 'Catálogo (la IA juzga): escalar no-ganadores, gasto↑/resultados↓, poca variedad, huecos del funnel, escalado incorrecto, muchos cambios, cobranza recurrente. Metodología Recon (2 señales). Spec: docs/superpowers/specs/2026-07-10-retro-doer-accountability-design.md', true],
  [56, 'Rendición de cuentas: verificar ejecución + reclamo', 'doer', 'alta', 'abierto', 0, 'MaKo joinea experimento_tareas por retro_id, distingue aceptado-vs-HECHO, reclama. Spec S1 · Sección 2.', true],
  [54, 'El pulso: que la app te diga QUÉ HACER (vista Hoy)', 'doer', 'alta', 'abierto', 0, 'Chequeo diario barato que reclama/avisa por campanita+WhatsApp y surfacea en el semáforo. Spec S1 · Sección 3.', true],
  [53, 'Modo Simple por default + Avanzado', 'doer', 'alta', 'abierto', 0, 'Default SIMPLE (3 tareas + experimentos). El kanban va a Avanzado.', false],
  [4, 'Onboarding progresivo por tab (SIMPLE)', 'doer', 'alta', 'parcial', 55, 'Onboarding inicial: lo básico (Meta) + veredicto con Experiments. Después MaKo te manda a la tab cuando detecta una fuga. Base hecha; falta el modelo progresivo.', false],
  [57, 'Atribución de cash por anuncio', 'doer', 'alta', 'abierto', 0, 'meta_ad_id × pagos, granular. Hoy solo ROAS agregado. Combustible del cerebro.', false],
  [58, 'Minería de objeciones (closing_analyses)', 'doer', 'media', 'abierto', 0, 'Objeciones recurrentes que matan cierres. La data ya se guarda.', false],
  [59, 'Semáforo vivo (alertas con IA)', 'doer', 'media', 'abierto', 0, 'Junta señales + tendencia + Claude razona alertas nuevas. Donde surfacea el pulso.', false],
  [18, 'MaKo embebido en todas las tabs', 'doer', 'media', 'parcial', 30, 'WhatsApp ya tiene MaKo. Falta funnel, leads, experimentos, email, closing.', false],
  [14, 'CRM Automático (leads que avanzan solos)', 'doer', 'alta', 'parcial', 40, 'Motor T1-T6 hecho pero APAGADO. Backlog: esquema de cuándo mover un lead, pop-up de confirmación, Datos sin Marcar auto-completados, etapa Reactivación. Terminar Onboarding + FUNNEL.', false],

  [3, 'Perfil de Usuario', 'plat', 'alta', 'hecho', 100, 'Hecho: /perfil.', false],
  [5, 'Usuarios + vista de Admin', 'plat', 'alta', 'hecho', 100, 'Hecho: /admin.', false],
  [6, 'Método: tokens + tutorial', 'plat', 'alta', 'hecho', 100, 'Hecho: /metodo.', false],
  [28, 'Panel de Equipo (Closers/Setters)', 'plat', 'media', 'hecho', 100, 'Hecho: /equipo.', false],
  [2, 'Ficha del lead (CRM)', 'plat', 'alta', 'hecho', 100, 'Hecho: 7 tabs. La tab Chat es solo lectura.', false],
  [12, 'Ads Manager: crear/editar campañas + USD', 'plat', 'media', 'hecho', 100, 'Hecho (12+40+50). Todo en PAUSA. CREATE de Meta no probado en vivo.', false],
  [33, "API 'Analizar' de Meta", 'plat', 'baja', 'hecho', 100, 'Código completo. Recos nativas vacías por bloqueo de pago, no del código.', false],
  [7, 'Ciberseguridad + eficiencia', 'plat', 'alta', 'parcial', 80, 'Auditoría hecha, HIGH+MEDIUM fixeados. Falta performance (LOW) + depurar (continuo).', false],
  [30, 'Protocolo de Beta y versiones', 'plat', 'media', 'abierto', 0, 'Mejorar sin interrumpir a los usuarios.', false],
  [52, 'Usar SKILLS en todo el código', 'plat', 'baja', 'parcial', 25, 'Instaladas brainstorming/plans/grill/decision-maker + repo. Falta aplicarlas.', false],
  [17, 'Traspaso de cuentas Mauricio → mías', 'plat', 'baja', 'abierto', 0, 'Supabase/Vercel/dominio. No prioridad.', false],
  [32, 'Dominio propio + ruteo', 'plat', 'baja', 'abierto', 0, 'Landing en la raíz, no en /vsl.', false],

  [8, 'Email Marketing (Resend)', 'canales', 'media', 'parcial', 90, 'Código completo. Falta go-live: dominio + RESEND_WEBHOOK_SECRET.', false],
  [9, 'Nutrición Automática', 'canales', 'media', 'parcial', 70, 'Motor completo (3 canales, anti-baneo), APAGADO. Falta go-live: flags + dominio + templates WA.', false],
  [20, 'Reportes por WhatsApp', 'canales', 'media', 'parcial', 90, 'Hecho para el dueño. Falta que los crons iteren workspaces.', false],
  [41, 'WhatsApp + Email NO oficial dentro de MaKo', 'canales', 'media', 'parcial', 30, 'Evolution existe. Falta que ambos vivan cómodos en MaKo.', false],
  [43, "Responder 'Datos sin Marcar' desde WhatsApp", 'canales', 'media', 'abierto', 0, '', false],
  [51, 'Listas de Difusión', 'canales', 'media', 'abierto', 0, '', false],
  [19, 'Importar/exportar leads (→ nutrición)', 'canales', 'media', 'abierto', 0, 'No existe bulk. Falta parser + mapeo + enrolar en nutrición.', false],
  [16, 'Calendly + back-end multi-tenant', 'canales', 'futuro', 'parcial', 60, 'UTM/UUID ok. Falta config multi-tenant (hoy hardcoded a Mauricio).', false],
  [21, 'Reportes a leads/clientes post-reunión', 'canales', 'futuro', 'abierto', 0, '', false],

  [24, 'Landing Analyst', 'analy', 'futuro', 'abierto', 0, 'PostHog/Clarity: session replay + heatmaps. Stub comingSoon.', false],
  [25, 'VSL Analyst', 'analy', 'futuro', 'abierto', 0, 'Telemetría VSL ya existe; el analista no. Stub.', false],
  [13, 'CS Analyst (Customer Success)', 'analy', 'futuro', 'abierto', 0, 'Closing ya distingue servicio; falta analista de churn. Stub.', false],
  [34, 'Market Analyst (competencia)', 'analy', 'futuro', 'abierto', 0, 'Proceso recurrente + aviso por WhatsApp cuando un competidor saca algo. Stub.', false],
  [39, 'Offer Analyst', 'analy', 'futuro', 'abierto', 0, 'Que audite/mejore la oferta en el onboarding, no solo la guarde.', false],
  [26, 'Ads Writer / GhostWriter', 'analy', 'baja', 'hecho', 100, 'Cubierto por Ads Writer (lib/ad-copy.ts).', false],
  [29, 'Generador de creativos (masa)', 'analy', 'futuro', 'abierto', 0, 'Estilo Claudio Conde.', false],
  [49, 'Generador de Landing Pages', 'analy', 'futuro', 'abierto', 0, '', false],
  [47, 'Generador de Contratos', 'analy', 'baja', 'abierto', 0, '', false],
  [31, 'Cursos en Conocimiento (RAG)', 'analy', 'baja', 'parcial', 80, 'Pipeline funcional. Solo Levanta Muertos pre-seedeado.', false],

  [46, 'Oferta Cebolla (planes por nivel)', 'growth', 'futuro', 'abierto', 0, 'Venderle a TODO el que corra VSL Funnel limitando acceso por planes según la situación del lead.', false],
  [45, 'Ads por cada funcionalidad', 'growth', 'futuro', 'abierto', 0, 'Claudio Conde 60k con 1 feature. Miles de ads por cada feature.', false],
  [1, 'Copy de features en la landing (/vsl)', 'growth', 'futuro', 'abierto', 0, 'Marketing, no feature. Cuando vuelva a Baires.', false],
  [22, 'Thank You Page (post-agenda)', 'growth', 'futuro', 'abierto', 0, 'Página que fuerza instrucciones o se cancela la llamada (estilo confirmar.lovable.app).', false],
  [15, 'Testimonios', 'growth', 'futuro', 'abierto', 0, '', false],
  [27, 'Costos internos + cliente', 'growth', 'futuro', 'abierto', 0, 'Cuando vuelva a Baires.', false],
  [23, 'Loom demo por feature', 'growth', 'futuro', 'abierto', 0, '', false],
  [35, 'Mapa de calor de uso', 'growth', 'futuro', 'abierto', 0, '', false],

  [36, 'Rediseño completo de la app', 'ux', 'alta', 'parcial', 70, 'Falta: Script/Closing Analyst + Experiments + Perfil + Onboarding.', false],
  [37, 'UX SIMPLE (la experiencia)', 'ux', 'alta', 'parcial', 60, 'El norte de UX. Falta: Closing/Script Analyst + Funnel + Onboarding.', false],
  [44, 'Administrador de Eventos', 'ux', 'baja', 'abierto', 0, '', false],
];

const K_TASKS = 'mako_plan_v3', K_COLS = 'mako_plan_cols_v3', K_PROJS = 'mako_plan_projs_v3', K_UI = 'mako_plan_ui_v3', K_V2 = 'mako_plan_v2';
const uid = () => 'x' + Math.random().toString(36).slice(2, 9);
const clamp = (v: number) => Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));
const seedTasks = (): Task[] => SEED.map((d) => ({ id: 't' + d[0], n: d[0], text: d[1], project: d[2], priority: d[3], col: colFromStatus(d[4]), prog: d[5], detalle: d[6], foco: d[7], deadline: '', checklist: [] }));
type V2Task = { id: string; n: number; text: string; project: string; priority: Prio; status: string; prog: number; detalle: string; foco: boolean; deadline: string };
const migrateV2 = (arr: V2Task[]): Task[] => arr.map((t) => ({ id: t.id, n: t.n, text: t.text, project: t.project, priority: t.priority, col: colFromStatus(t.status), prog: t.prog, detalle: t.detalle, foco: t.foco, deadline: t.deadline || '', checklist: [] }));

export function PlanBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [cols, setCols] = useState<Col[]>(COLS_DEFAULT);
  const [projs, setProjs] = useState<Proj[]>(PROJS_DEFAULT);
  const [view, setView] = useState<'prioridades' | 'kanban'>('prioridades');
  const [q, setQ] = useState('');
  const [fProj, setFProj] = useState<Set<string>>(new Set());
  const [fPrio, setFPrio] = useState<Set<Prio>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [projMgr, setProjMgr] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const { undo, show, clear } = useUndoToast();

  const projOf = (id: string) => projs.find((p) => p.id === id) ?? projs[0] ?? PROJS_DEFAULT[0];

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(K_TASKS);
      if (raw) setTasks(JSON.parse(raw) as Task[]);
      else { const v2 = localStorage.getItem(K_V2); setTasks(v2 ? migrateV2(JSON.parse(v2) as V2Task[]) : seedTasks()); }
    } catch { setTasks(seedTasks()); }
    try { const c = localStorage.getItem(K_COLS); if (c) setCols(JSON.parse(c) as Col[]); } catch { /* default */ }
    try { const p = localStorage.getItem(K_PROJS); if (p) setProjs(JSON.parse(p) as Proj[]); } catch { /* default */ }
    try { const ui = JSON.parse(localStorage.getItem(K_UI) || '{}'); if (ui.view === 'prioridades' || ui.view === 'kanban') setView(ui.view); } catch { /* default */ }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => { if (hydrated) try { localStorage.setItem(K_TASKS, JSON.stringify(tasks)); } catch { /* no-op */ } }, [tasks, hydrated]);
  useEffect(() => { if (hydrated) try { localStorage.setItem(K_COLS, JSON.stringify(cols)); } catch { /* no-op */ } }, [cols, hydrated]);
  useEffect(() => { if (hydrated) try { localStorage.setItem(K_PROJS, JSON.stringify(projs)); } catch { /* no-op */ } }, [projs, hydrated]);
  useEffect(() => { if (hydrated) try { localStorage.setItem(K_UI, JSON.stringify({ view })); } catch { /* no-op */ } }, [view, hydrated]);
  useEffect(() => {
    if (!openId && !projMgr) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpenId(null); setProjMgr(false); } };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [openId, projMgr]);

  const patch = (id: string, f: Partial<Task>) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...f } : t)));
  const remove = (id: string) => { const snap = tasks; setTasks((ts) => ts.filter((t) => t.id !== id)); setOpenId(null); show('Tarea eliminada', () => setTasks(snap)); };
  const addTask = (text: string, col: string) => {
    const v = text.trim(); if (!v) return;
    const maxN = tasks.reduce((m, t) => Math.max(m, t.n), 0);
    setTasks((ts) => [{ id: 't' + Date.now(), n: maxN + 1, text: v, project: projs[0]?.id ?? 'doer', priority: 'media', col, prog: 0, detalle: '', foco: false, deadline: '', checklist: [] }, ...ts]);
  };
  const moveTo = (id: string, col: string) => {
    const t = tasks.find((x) => x.id === id); if (!t || t.col === col) return;
    const from = t.col; patch(id, { col });
    const cn = cols.find((c) => c.id === col)?.name ?? col;
    show(`"${t.text.slice(0, 30)}" → ${cn}`, () => patch(id, { col: from }));
  };

  const nFilters = fProj.size + fPrio.size;
  const passes = (t: Task) => (!q || (t.text + ' ' + t.detalle).toLowerCase().includes(q.toLowerCase())) && (fProj.size === 0 || fProj.has(t.project)) && (fPrio.size === 0 || fPrio.has(t.priority));
  const focos = tasks.filter((t) => t.foco && t.col !== 'done');
  const openTask = tasks.find((t) => t.id === openId) ?? null;

  return (
    <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 30px 12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 600 }}>Plan de ejecución</div>
          <h1 style={{ fontSize: 25, fontWeight: 700, letterSpacing: '-0.02em', margin: '3px 0 0', color: 'var(--ink)' }}>Qué construir</h1>
        </div>
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: 3, marginLeft: 6 }}>
          {(['prioridades', 'kanban'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} style={{ border: 'none', background: view === v ? 'var(--surface)' : 'transparent', color: view === v ? 'var(--ink)' : 'var(--dim)', fontWeight: view === v ? 600 : 500, fontSize: 13.5, padding: '7px 15px', borderRadius: 999, cursor: 'pointer', boxShadow: view === v ? '0 1px 2px rgba(18,21,27,.08)' : 'none', fontFamily: 'inherit', textTransform: 'capitalize' }}>{v}</button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        {view === 'kanban' && <>
          <FilterMenu projs={projs} fProj={fProj} setFProj={setFProj} fPrio={fPrio} setFPrio={setFPrio} n={nFilters} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" style={{ width: 160, padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, outline: 'none' }} />
          <button onClick={() => setProjMgr(true)} style={ghostBtn}>Proyectos</button>
        </>}
      </header>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {view === 'prioridades'
          ? <Prioridades focos={focos} projOf={projOf} onOpen={setOpenId} patch={patch} />
          : <Kanban tasks={tasks.filter(passes)} cols={cols} setCols={setCols} projOf={projOf} onOpen={setOpenId} onAdd={addTask} onMove={moveTo}
              dragId={dragId} setDragId={setDragId} overCol={overCol} setOverCol={setOverCol} patch={patch} />}
      </div>

      {openTask && <TaskModal t={openTask} cols={cols} projs={projs} projOf={projOf} patch={patch} remove={remove} onClose={() => setOpenId(null)} />}
      {projMgr && <ProjectsManager projs={projs} setProjs={setProjs} onClose={() => setProjMgr(false)} />}
      <UndoToast state={undo} onClose={clear} />
    </main>
  );
}

// ── átomos ────────────────────────────────────────────────────────────────────
const ghostBtn: CSSProperties = { padding: '8px 13px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 500, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' };
const selStyle: CSSProperties = { appearance: 'none', WebkitAppearance: 'none', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, fontWeight: 500, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', width: '100%' };

function ProjLabel({ p }: { p: Proj }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: p.color, background: p.color + '14', border: `1px solid ${p.color}33`, padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}><span style={{ width: 7, height: 7, borderRadius: 2, background: p.color }} />{p.emoji} {p.name}</span>;
}
function PrioBadge({ p }: { p: Prio }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 600, color: PCOLOR[p] }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: PCOLOR[p] }} />{PLABEL[p]}</span>;
}
function Star({ on, onClick, size = 15 }: { on: boolean; onClick: (e: RME) => void; size?: number }) {
  return <button onClick={onClick} title="Foco" aria-pressed={on} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: size, lineHeight: 1, color: on ? 'var(--accent-soft)' : 'var(--faint)', padding: 2 }}>{on ? '★' : '☆'}</button>;
}
function MiniBar({ v }: { v: number }) {
  return <span style={{ display: 'block', height: 4, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: v + '%', background: 'var(--primary)' }} /></span>;
}

// ── tarjeta (cuadrada, estilo CRM) ─────────────────────────────────────────────
function CardTile({ t, projOf, onOpen, patch, onDragStart, onDragEnd }: { t: Task; projOf: (id: string) => Proj; onOpen: (id: string) => void; patch: (id: string, f: Partial<Task>) => void; onDragStart: () => void; onDragEnd: () => void }) {
  const done = t.checklist.filter((c) => c.done).length;
  return (
    <div draggable onDragStart={(e) => { onDragStart(); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={onDragEnd} onClick={() => onOpen(t.id)}
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '12px 13px', cursor: 'grab', transition: 'border-color .12s, box-shadow .12s' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')} onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7, flexWrap: 'wrap' }}>
        <ProjLabel p={projOf(t.project)} />
        <PrioBadge p={t.priority} />
        <span style={{ flex: 1 }} />
        <Star on={t.foco} onClick={(e) => { e.stopPropagation(); patch(t.id, { foco: !t.foco }); }} size={14} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.35, color: 'var(--ink)', marginBottom: 9 }}>{t.text}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--faint)' }}>#{t.n}</span>
        {t.detalle && <span title="doc" style={{ color: 'var(--faint)', fontSize: 11.5 }}>📄</span>}
        {t.checklist.length > 0 && <span title="checklist" style={{ fontSize: 10.5, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>☑ {done}/{t.checklist.length}</span>}
        <span style={{ flex: 1 }}><MiniBar v={t.prog} /></span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{t.prog}%</span>
      </div>
    </div>
  );
}

// ── vista Kanban (columnas dinámicas + DnD + auto-scroll) ──────────────────────
function Kanban({ tasks, cols, setCols, projOf, onOpen, onAdd, onMove, dragId, setDragId, overCol, setOverCol, patch }: {
  tasks: Task[]; cols: Col[]; setCols: (c: Col[] | ((c: Col[]) => Col[])) => void; projOf: (id: string) => Proj; onOpen: (id: string) => void;
  onAdd: (text: string, col: string) => void; onMove: (id: string, col: string) => void; dragId: string | null; setDragId: (v: string | null) => void; overCol: string | null; setOverCol: (v: string | null) => void; patch: (id: string, f: Partial<Task>) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const raf = useRef<number | null>(null);
  const stopScroll = () => { if (raf.current) { cancelAnimationFrame(raf.current); raf.current = null; } };
  const onBoardDragOver = (e: RDragEvent) => {
    const el = scrollRef.current; if (!el) return;
    const r = el.getBoundingClientRect(); const EDGE = 90;
    const dir = e.clientX < r.left + EDGE ? -1 : e.clientX > r.right - EDGE ? 1 : 0;
    stopScroll();
    if (dir !== 0) { const tick = () => { el.scrollLeft += dir * 16; raf.current = requestAnimationFrame(tick); }; raf.current = requestAnimationFrame(tick); }
  };
  useEffect(() => () => stopScroll(), []);

  const addCol = () => setCols((c) => [...c, { id: uid(), name: 'Nueva columna', color: SWATCHES[0] }]);
  const renameCol = (id: string, name: string) => setCols((c) => c.map((x) => (x.id === id ? { ...x, name } : x)));
  const colorCol = (id: string, color: string) => setCols((c) => c.map((x) => (x.id === id ? { ...x, color } : x)));
  const delCol = (id: string) => {
    if (cols.length <= 1) return;
    const fallback = cols.find((c) => c.id !== id)!.id;
    tasks.filter((t) => t.col === id).forEach((t) => patch(t.id, { col: fallback }));
    setCols((c) => c.filter((x) => x.id !== id));
  };

  return (
    <div ref={scrollRef} onDragOver={onBoardDragOver} onDrop={stopScroll} style={{ display: 'flex', gap: 14, padding: '4px 30px 30px', height: '100%', overflowX: 'auto', overflowY: 'hidden', alignItems: 'flex-start' }}>
      {cols.map((c) => {
        const items = tasks.filter((t) => t.col === c.id).sort((a, b) => a.n - b.n);
        const isOver = overCol === c.id && dragId != null;
        return (
          <section key={c.id}
            onDragOver={(e) => { e.preventDefault(); if (dragId != null && overCol !== c.id) setOverCol(c.id); }}
            onDrop={(e) => { e.preventDefault(); if (dragId != null) onMove(dragId, c.id); setOverCol(null); setDragId(null); stopScroll(); }}
            style={{ width: 288, flex: 'none', display: 'flex', flexDirection: 'column', maxHeight: '100%', background: isOver ? 'var(--primary-bg)' : 'var(--surface)', border: '1px solid ' + (isOver ? 'var(--primary-weak)' : 'var(--border)'), borderTop: '3px solid ' + c.color, borderRadius: 14, padding: 10, boxShadow: isOver ? '0 0 0 3px var(--primary-weak)' : 'none', transition: 'background .12s, box-shadow .12s' }}>
            <ColHeader c={c} count={items.length} onRename={renameCol} onColor={colorCol} onDelete={() => delCol(c.id)} onAdd={onAdd} canDelete={cols.length > 1} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', minHeight: 30, paddingRight: 2 }}>
              {items.map((t) => (
                <CardTile key={t.id} t={t} projOf={projOf} onOpen={onOpen} patch={patch} onDragStart={() => setDragId(t.id)} onDragEnd={() => { setDragId(null); setOverCol(null); stopScroll(); }} />
              ))}
            </div>
          </section>
        );
      })}
      <button onClick={addCol} style={{ width: 200, flex: 'none', border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', borderRadius: 14, padding: '12px', cursor: 'pointer', fontSize: 13.5, fontFamily: 'inherit', height: 'fit-content' }}>+ Columna</button>
    </div>
  );
}

function ColHeader({ c, count, onRename, onColor, onDelete, onAdd, canDelete }: { c: Col; count: number; onRename: (id: string, n: string) => void; onColor: (id: string, col: string) => void; onDelete: () => void; onAdd: (text: string, col: string) => void; canDelete: boolean }) {
  const [menu, setMenu] = useState(false);
  const [adding, setAdding] = useState(false);
  const [v, setV] = useState('');
  return (
    <div style={{ flex: 'none', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '2px 2px 8px' }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.color, flex: 'none' }} />
        <input value={c.name} onChange={(e) => onRename(c.id, e.target.value)} style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', color: 'var(--ink)', fontWeight: 600, fontSize: 13.5, outline: 'none', fontFamily: 'inherit' }} />
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', background: 'var(--surface-2)', borderRadius: 999, padding: '1px 8px' }}>{count}</span>
        <button onClick={() => setAdding((a) => !a)} title="Nueva tarea" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--dim)', fontSize: 18, lineHeight: 1, padding: '0 3px' }}>+</button>
        <span style={{ position: 'relative' }}>
          <button onClick={() => setMenu((m) => !m)} title="Columna" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--dim)', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>⋯</button>
          {menu && <>
            <span onClick={() => setMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <div style={{ position: 'absolute', top: 22, right: 0, zIndex: 41, width: 168, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 12px 30px rgba(18,21,27,.16)', padding: 10 }}>
              <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 8 }}>Color</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {SWATCHES.map((s) => <button key={s} onClick={() => onColor(c.id, s)} style={{ width: 20, height: 20, borderRadius: 6, background: s, border: c.color === s ? '2px solid var(--ink)' : '2px solid transparent', cursor: 'pointer' }} />)}
              </div>
              {canDelete && <button onClick={() => { if (confirm('¿Borrar la columna? Sus tarjetas pasan a otra.')) { onDelete(); setMenu(false); } }} style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', color: 'var(--bad)', fontSize: 12.5, cursor: 'pointer', padding: '6px 0 0', borderTop: '1px solid var(--border)' }}>Borrar columna</button>}
            </div>
          </>}
        </span>
      </div>
      {adding && <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { onAdd(v, c.id); setV(''); } if (e.key === 'Escape') setAdding(false); }} onBlur={() => setAdding(false)} placeholder="Nueva tarea… (Enter)" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--primary)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, outline: 'none', marginBottom: 4 }} />}
    </div>
  );
}

// ── vista Prioridades (solo foco) ──────────────────────────────────────────────
function Prioridades({ focos, projOf, onOpen, patch }: { focos: Task[]; projOf: (id: string) => Proj; onOpen: (id: string) => void; patch: (id: string, f: Partial<Task>) => void }) {
  if (focos.length === 0) return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--faint)', textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 40 }}>🎯</div>
      <div style={{ fontSize: 17, color: 'var(--dim)', fontWeight: 600 }}>Tu foco está vacío</div>
      <div style={{ fontSize: 14, maxWidth: 380, lineHeight: 1.5 }}>Marcá tareas con la <span style={{ color: 'var(--accent-soft)' }}>★</span> para tener adelante lo poco que importa ahora.</div>
    </div>
  );
  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '18px 30px 40px' }}>
      <div style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 700, textAlign: 'center' }}>🎯 Foco ahora · {focos.length}</div>
        {focos.slice().sort((a, b) => a.prog - b.prog).map((t) => (
          <div key={t.id} onClick={() => onOpen(t.id)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 26px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(18,21,27,.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <ProjLabel p={projOf(t.project)} /><PrioBadge p={t.priority} />
              <span style={{ flex: 1 }} /><Star on onClick={(e) => { e.stopPropagation(); patch(t.id, { foco: false }); }} size={18} />
            </div>
            <div style={{ fontSize: 21, fontWeight: 600, lineHeight: 1.3, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: t.detalle ? 12 : 14 }}>{t.text}</div>
            {t.detalle && <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.55, marginBottom: 16, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.detalle}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ flex: 1 }}><MiniBar v={t.prog} /></span><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{t.prog}%</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── filtros (dropdown de 2 niveles: grupo → ítems) ─────────────────────────────
function FilterMenu({ projs, fProj, setFProj, fPrio, setFPrio, n }: { projs: Proj[]; fProj: Set<string>; setFProj: (s: Set<string>) => void; fPrio: Set<Prio>; setFPrio: (s: Set<Prio>) => void; n: number }) {
  const [open, setOpen] = useState(false);
  const [grp, setGrp] = useState<'root' | 'proj' | 'prio'>('root');
  const toggle = <T,>(set: Set<T>, val: T, apply: (s: Set<T>) => void) => { const c = new Set(set); if (c.has(val)) c.delete(val); else c.add(val); apply(c); };
  const clearAll = (e: RME) => { e.stopPropagation(); setFProj(new Set()); setFPrio(new Set()); };
  const grpRow = (label: string, on: () => void) => <button onClick={on} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 10px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--ink)', textAlign: 'left', fontFamily: 'inherit' }}>{label}<span style={{ marginLeft: 'auto', color: 'var(--faint)' }}>›</span></button>;
  return (
    <span style={{ position: 'relative' }}>
      <button onClick={() => { setOpen((o) => !o); setGrp('root'); }} style={{ position: 'relative', ...ghostBtn, background: open ? 'var(--surface-2)' : 'var(--surface)' }}>
        Filtrar
        {n > 0 && <span onClick={clearAll} title="Limpiar" style={{ position: 'absolute', top: -7, right: -7, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: 'var(--ink)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)' }}>{n}</span>}
      </button>
      {open && <>
        <span onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
        <div style={{ position: 'absolute', top: 40, right: 0, zIndex: 41, width: 244, maxHeight: 420, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 16px 40px rgba(18,21,27,.16)', padding: 8 }}>
          {grp === 'root' && <>{grpRow('🏷  Proyecto', () => setGrp('proj'))}{grpRow('⚑  Prioridad', () => setGrp('prio'))}</>}
          {grp !== 'root' && <button onClick={() => setGrp('root')} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--dim)', fontSize: 12, padding: '4px 8px 8px', fontFamily: 'inherit' }}>‹ volver</button>}
          {grp === 'proj' && projs.map((p) => <FRow key={p.id} on={fProj.has(p.id)} onClick={() => toggle(fProj, p.id, setFProj as (s: Set<string>) => void)} icon={<span style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />}>{p.emoji} {p.name}</FRow>)}
          {grp === 'prio' && PRIOS.map((p) => <FRow key={p} on={fPrio.has(p)} onClick={() => toggle(fPrio, p, setFPrio as (s: Set<Prio>) => void)} icon={<span style={{ width: 8, height: 8, borderRadius: '50%', background: PCOLOR[p] }} />}>{PLABEL[p]}</FRow>)}
        </div>
      </>}
    </span>
  );
}
function FRow({ on, onClick, icon, children }: { on: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 9px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12.5, color: 'var(--ink)', textAlign: 'left', fontFamily: 'inherit' }}>
    <span style={{ width: 14, height: 14, borderRadius: 4, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{on ? '✓' : ''}</span>
    {icon}<span style={{ flex: 1 }}>{children}</span>
  </button>;
}

// ── modal de detalle (con checklist) ───────────────────────────────────────────
function TaskModal({ t, cols, projs, projOf, patch, remove, onClose }: { t: Task; cols: Col[]; projs: Proj[]; projOf: (id: string) => Proj; patch: (id: string, f: Partial<Task>) => void; remove: (id: string) => void; onClose: () => void }) {
  const [newItem, setNewItem] = useState('');
  const p = projOf(t.project);
  const rowLabel: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6, display: 'block' };
  const cl = t.checklist;
  const setCl = (next: Check[]) => patch(t.id, { checklist: next });
  const clDone = cl.filter((c) => c.done).length;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(18,21,27,.35)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '7vh 16px 16px' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 800, maxHeight: '85vh', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 24px 60px rgba(18,21,27,.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px', borderBottom: '1px solid var(--border)', flex: 'none' }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', fontWeight: 600 }}>#{t.n}</span><ProjLabel p={p} />
          <span style={{ flex: 1 }} /><button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 22, lineHeight: 1, color: 'var(--faint)', padding: '2px 6px' }}>×</button>
        </div>
        <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '20px 22px' }}>
            <textarea value={t.text} onChange={(e) => patch(t.id, { text: e.target.value })} rows={2} style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 22, fontWeight: 600, lineHeight: 1.3, fontFamily: 'inherit', letterSpacing: '-0.01em', marginBottom: 16 }} />
            <label style={rowLabel}>Detalle · doc</label>
            <textarea value={t.detalle} onChange={(e) => patch(t.id, { detalle: e.target.value })} placeholder="Escribí el doc de esta tarea (lo que te llevás a una sesión nueva)…" style={{ width: '100%', minHeight: 150, border: '1px solid var(--border)', borderRadius: 10, outline: 'none', resize: 'vertical', background: 'var(--surface-2)', color: 'var(--dim)', fontSize: 13.5, lineHeight: 1.6, padding: '12px 14px', fontFamily: 'inherit', marginBottom: 20 }} />
            <label style={rowLabel}>Checklist {cl.length > 0 && `· ${clDone}/${cl.length}`}</label>
            {cl.length > 0 && <span style={{ display: 'block', marginBottom: 10 }}><MiniBar v={cl.length ? Math.round((clDone / cl.length) * 100) : 0} /></span>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {cl.map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 2px' }}>
                  <button onClick={() => setCl(cl.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)))} style={{ width: 16, height: 16, borderRadius: 4, border: `1px solid ${c.done ? 'var(--good)' : 'var(--border-strong)'}`, background: c.done ? 'var(--good)' : 'transparent', color: '#fff', fontSize: 11, cursor: 'pointer', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.done ? '✓' : ''}</button>
                  <input value={c.text} onChange={(e) => setCl(cl.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)))} style={{ flex: 1, border: 'none', background: 'transparent', color: c.done ? 'var(--faint)' : 'var(--ink)', fontSize: 13.5, outline: 'none', fontFamily: 'inherit', textDecoration: c.done ? 'line-through' : 'none' }} />
                  <button onClick={() => setCl(cl.filter((x) => x.id !== c.id))} style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
            <input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newItem.trim()) { setCl([...cl, { id: uid(), text: newItem.trim(), done: false }]); setNewItem(''); } }} placeholder="+ ítem de checklist (Enter)" style={{ width: '100%', padding: '8px 11px', borderRadius: 8, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--ink)', fontSize: 13, outline: 'none' }} />
          </div>
          <div style={{ width: 228, flex: 'none', borderLeft: '1px solid var(--border)', background: 'var(--surface-2)', padding: '20px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 15 }}>
            <div><label style={rowLabel}>Columna</label><select value={t.col} onChange={(e) => patch(t.id, { col: e.target.value })} style={selStyle}>{cols.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label style={rowLabel}>Proyecto</label><select value={t.project} onChange={(e) => patch(t.id, { project: e.target.value })} style={{ ...selStyle, color: p.color, fontWeight: 600 }}>{projs.map((x) => <option key={x.id} value={x.id}>{x.emoji} {x.name}</option>)}</select></div>
            <div><label style={rowLabel}>Prioridad</label><select value={t.priority} onChange={(e) => patch(t.id, { priority: e.target.value as Prio })} style={{ ...selStyle, color: PCOLOR[t.priority], fontWeight: 600 }}>{PRIOS.map((x) => <option key={x} value={x}>{PLABEL[x]}</option>)}</select></div>
            <div><label style={rowLabel}>Avance · {t.prog}%</label><input type="range" min={0} max={100} step={5} value={t.prog} onChange={(e) => patch(t.id, { prog: clamp(+e.target.value) })} style={{ width: '100%', accentColor: 'var(--primary)' }} /></div>
            <div><label style={rowLabel}>Deadline</label><input type="date" value={t.deadline} onChange={(e) => patch(t.id, { deadline: e.target.value })} style={selStyle} /></div>
            <button onClick={() => patch(t.id, { foco: !t.foco })} style={{ ...selStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: t.foco ? 'var(--primary-bg)' : 'var(--surface)', color: t.foco ? 'var(--primary)' : 'var(--dim)', fontWeight: 600 }}>{t.foco ? '★ En foco' : '☆ Agregar al foco'}</button>
            <span style={{ flex: 1 }} />
            <button onClick={() => { if (confirm('¿Eliminar esta tarea?')) remove(t.id); }} style={{ border: 'none', background: 'transparent', color: 'var(--bad)', fontSize: 12.5, cursor: 'pointer', textAlign: 'left', padding: '4px 0' }}>Eliminar tarea</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── gestor de proyectos (labels editables) ─────────────────────────────────────
function ProjectsManager({ projs, setProjs, onClose }: { projs: Proj[]; setProjs: (p: Proj[] | ((p: Proj[]) => Proj[])) => void; onClose: () => void }) {
  const up = (id: string, f: Partial<Proj>) => setProjs((ps) => ps.map((p) => (p.id === id ? { ...p, ...f } : p)));
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(18,21,27,.35)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '10vh 16px 16px' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, maxHeight: '78vh', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 24px 60px rgba(18,21,27,.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Proyectos</h2><span style={{ flex: 1 }} />
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 22, lineHeight: 1, color: 'var(--faint)' }}>×</button>
        </div>
        <div style={{ padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {projs.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 11px' }}>
              <input value={p.emoji} onChange={(e) => up(p.id, { emoji: e.target.value.slice(0, 2) })} style={{ width: 34, textAlign: 'center', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', fontSize: 15, padding: '5px 0', outline: 'none' }} />
              <input value={p.name} onChange={(e) => up(p.id, { name: e.target.value })} style={{ flex: 1, minWidth: 0, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, padding: '6px 9px', outline: 'none', fontFamily: 'inherit' }} />
              <span style={{ display: 'flex', gap: 3 }}>{SWATCHES.map((s) => <button key={s} onClick={() => up(p.id, { color: s })} title={s} style={{ width: 16, height: 16, borderRadius: 5, background: s, border: p.color === s ? '2px solid var(--ink)' : '2px solid transparent', cursor: 'pointer' }} />)}</span>
              <button onClick={() => { if (confirm(`¿Borrar el proyecto "${p.name}"?`)) setProjs((ps) => ps.filter((x) => x.id !== p.id)); }} style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
            </div>
          ))}
          <button onClick={() => setProjs((ps) => [...ps, { id: uid(), emoji: '🏷', name: 'Nuevo proyecto', color: SWATCHES[1] }])} style={{ ...ghostBtn, textAlign: 'center' }}>+ Proyecto</button>
        </div>
      </div>
    </div>
  );
}
