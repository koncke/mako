'use client';

// =============================================================================
// PlanBoard — plan de ejecución de MaKo (super-admin, en /todo)
// =============================================================================
// Board privado de Martín, estilo Trello/Kan (plano, monocromo, tarjetas blancas
// sobre columnas gris claro), adaptado al tema CLARO de la app. Dos vistas:
// "Prioridades" (solo el Foco, grande y minimalista) y "Kanban" (columnas por
// prioridad). El detalle de cada tarea se abre en un MODAL (pop-up), como Kan.
// Filtros por proyecto/estado/prioridad + búsqueda. Persistencia en localStorage
// (mako_plan_v2 / mako_plan_ui_v2); el SEED de abajo es la fuente de verdad.

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react';

const MONO = "'Geist Mono', monospace";

type Prio = 'alta' | 'media' | 'baja' | 'futuro';
type Estado = 'hecho' | 'parcial' | 'abierto';
type Task = { id: string; n: number; text: string; project: string; priority: Prio; status: Estado; prog: number; detalle: string; foco: boolean; deadline: string };
type Proj = { id: string; emoji: string; name: string; color: string };

const PRIOS: Prio[] = ['alta', 'media', 'baja', 'futuro'];
const PLABEL: Record<Prio, string> = { alta: 'Alta', media: 'Media', baja: 'Baja', futuro: 'A futuro' };
const PCOLOR: Record<Prio, string> = { alta: '#D0504A', media: '#C8870C', baja: '#1E9E57', futuro: '#98A0AC' };
const ESTADOS: Estado[] = ['abierto', 'parcial', 'hecho'];
const SLABEL: Record<Estado, string> = { hecho: 'Hecho', parcial: 'Parcial', abierto: 'Abierto' };
const SCOLOR: Record<Estado, string> = { hecho: 'var(--good)', parcial: 'var(--warn)', abierto: 'var(--faint)' };

const PROJECTS: Proj[] = [
  { id: 'doer', emoji: '🔴', name: 'Hacer MaKo DOER', color: '#D0504A' },
  { id: 'plat', emoji: '🧱', name: 'Plataforma & Núcleo', color: '#2F6FED' },
  { id: 'canales', emoji: '💬', name: 'Canales & Mensajería', color: '#7C5CFB' },
  { id: 'analy', emoji: '🔍', name: 'Analysts & Generadores', color: '#0E9B8E' },
  { id: 'growth', emoji: '📈', name: 'Growth · Vender MaKo', color: '#C8870C' },
  { id: 'ux', emoji: '✨', name: 'UX & Diseño', color: '#D6489B' },
];
const projOf = (id: string) => PROJECTS.find((p) => p.id === id) ?? PROJECTS[PROJECTS.length - 1];

// [n, texto, proyecto, prioridad, estado, prog, detalle, foco]
type Row = [number, string, string, Prio, Estado, number, string, boolean];
const SEED: Row[] = [
  [42, 'Retro & Planning: la tab-cerebro', 'doer', 'alta', 'hecho', 100, 'Base hecha (100%). Es la casa del programa DOER: reportes de rendimiento + plan personalizado, ligada a Experiments. Todo lo de abajo la potencia.', false],
  [55, 'Catálogo de fugas: que Retro detecte los patrones', 'doer', 'alta', 'abierto', 0, 'Que Retro corra un catálogo (la IA juzga, no es regla rígida): escalar no-ganadores, gasto↑/resultados↓, poca variedad (razones de compra), huecos del funnel, escalado incorrecto, muchos cambios de golpe, cobranza recurrente. Metodología Recon de Jan (las 2 señales: intención + ritmo). getSenalesRecon ya calcula las 2 señales. Spec: docs/superpowers/specs/2026-07-10-retro-doer-accountability-design.md', true],
  [56, 'Rendición de cuentas: verificar ejecución real + reclamo', 'doer', 'alta', 'abierto', 0, "MaKo joinea experimento_tareas por retro_id, distingue aceptado-vs-HECHO, y reclama con base ('no es magia, andá a grabar los creativos'). 4 estados; el retro_id ya se guarda, solo falta leerlo. Spec S1 · Sección 2.", true],
  [54, 'El pulso: que la app te diga QUÉ HACER (vista Hoy)', 'doer', 'alta', 'abierto', 0, "Chequeo diario barato (no el retro de 13 min) que reclama/avisa por campanita (con sonido) + WhatsApp y surfacea en el SEMÁFORO. To-do semanal / vista Hoy simple. Solo avisa cuando hay motivo (nunca 'todo bien'); también wins definidas. Spec S1 · Sección 3.", true],
  [53, 'Modo Simple por default + Avanzado', 'doer', 'alta', 'abierto', 0, 'Default SIMPLE (las 3 tareas + experimentos a correr). El kanban/detalle va a modo Avanzado.', false],
  [4, 'Onboarding progresivo por tab (SIMPLE)', 'doer', 'alta', 'parcial', 55, "Onboarding INICIAL apenas entran: solo lo básico (Meta) + veredicto impactante corriendo Experiments. Después, a demanda, MaKo detecta una fuga y te manda a la tab correspondiente ('no estás nutriendo, se te van $X'). Conocimiento por tab. Base del wizard hecha; falta el modelo progresivo.", false],
  [57, 'Atribución de cash por anuncio (combustible del cerebro)', 'doer', 'alta', 'abierto', 0, 'meta_ad_id × pagos, granular por anuncio/campaña. Hoy solo hay ROAS agregado. Es EL número de toda decisión de ads y alimenta a Retro.', false],
  [58, 'Minería de objeciones (de closing_analyses)', 'doer', 'media', 'abierto', 0, 'Objeciones recurrentes que matan cierres. La data ya se guarda con handled+quote.', false],
  [59, 'Semáforo vivo (alertas con IA + accionables)', 'doer', 'media', 'abierto', 0, 'Junta señales ya calculadas + tendencia (meta_health_history se escribe y no se lee) + Claude razona alertas nuevas más allá de las hardcodeadas. Es donde surfacea el pulso.', false],
  [18, 'MaKo embebido en todas las tabs', 'doer', 'media', 'parcial', 30, 'WhatsApp ya tiene MaKo. Falta embeberlo en: funnel, leads/CRM, experimentos, email, closing.', false],
  [14, 'CRM Automático (leads que avanzan solos)', 'doer', 'alta', 'parcial', 40, "Motor T1-T6 hecho pero APAGADO (dry-run, falta CRM_AUTO_ENABLED). Tu backlog: esquema completo de cuándo mover un lead (R1→esperar 3h→buscar en Fathom→asistió/no), pop-up bloqueante para confirmar cambios de MaKo, Instant Form→Nutrición, Nutrición Manual vencida→revisar WhatsApp, R2 confirmó→Facturando, Datos sin Marcar→MaKo intenta completarlos solo, nueva etapa 'Nutrición-Reactivación'. Templates de nutrición automáticos. Terminar Onboarding + tab FUNNEL.", false],

  [3, 'Perfil de Usuario', 'plat', 'alta', 'hecho', 100, 'Hecho: /perfil (datos, avatar, zona horaria). Las prefs de notificaciones se movieron a /configuraciones.', false],
  [5, 'Usuarios + vista de Admin', 'plat', 'alta', 'hecho', 100, 'Hecho: /admin (crear cliente, roles, entrar-como). Migraciones 0053/0054.', false],
  [6, 'Método: tokens + tutorial', 'plat', 'alta', 'hecho', 100, 'Hecho: /metodo (un servicio por pantalla, creds cifradas por workspace, tutorial por token).', false],
  [28, 'Panel de Equipo (Closers/Setters)', 'plat', 'media', 'hecho', 100, 'Hecho: /equipo (roles rol_ws, visibilidad por tab). Migración 0058.', false],
  [2, 'Ficha del lead (CRM)', 'plat', 'alta', 'hecho', 100, 'Hecho: 7 tabs (Overview, Tracking, Meetings, Chat, Insights, Deal Details, Historial). Único límite: la tab Chat es solo LECTURA (responder deriva a /whatsapp).', false],
  [12, 'Ads Manager: crear/editar campañas + USD', 'plat', 'media', 'hecho', 100, 'Hecho: crear (12), editar (40) y normalizar a USD (50). Todo en PAUSA. Caveat: gateado al dueño; el CREATE de Meta no se probó en vivo (bloqueo de pago).', false],
  [33, "API 'Analizar' de Meta (recomendaciones)", 'plat', 'baja', 'hecho', 100, 'Código completo (recos nativas de Meta + sugerencias derivadas por MaKo + análisis con Claude). Las nativas vuelven vacías por bloqueo externo de pago (account_status=3), no del código.', false],
  [7, 'Ciberseguridad + eficiencia', 'plat', 'alta', 'parcial', 80, 'Auditoría hecha (13 seguridad + 14 performance). Los 3 HIGH y los MEDIUM clave fixeados. Falta: hallazgos de performance (LOW) y depurar código (continuo).', false],
  [30, 'Protocolo de Beta y versiones', 'plat', 'media', 'abierto', 0, 'Mejorar la app sin interrumpir a los usuarios.', false],
  [52, 'Usar SKILLS en todo el código', 'plat', 'baja', 'parcial', 25, 'Ya instalamos brainstorming/writing-plans/grilling/decision-maker + las del repo. Falta aplicarlas de forma sistemática. github.com/vercel-labs/skills', false],
  [17, 'Traspaso de cuentas Mauricio → mías (infra)', 'plat', 'baja', 'abierto', 0, 'Supabase, Vercel, dominio, etc. viven en cuentas de Mauricio. No es prioridad.', false],
  [32, 'Dominio propio + ruteo (landing en la raíz)', 'plat', 'baja', 'abierto', 0, 'Landing en la raíz, no en /vsl.', false],

  [8, 'Email Marketing (Resend)', 'canales', 'media', 'parcial', 90, 'Código completo (broadcasts, tracking open/click, dominio DKIM/SPF, unsubscribe). Falta go-live: verificar dominio + configurar RESEND_WEBHOOK_SECRET. Envío real gateado por workspace (off por default).', false],
  [9, 'Nutrición Automática', 'canales', 'media', 'parcial', 70, 'Motor completo: 14 cohortes, 3 canales (email, WA oficial, WA no-oficial), anti-baneo. APAGADO por default. Falta go-live: prender flags + dominio + templates WA aprobados por Meta.', false],
  [20, 'Reportes por WhatsApp (semáforo/ads/wins)', 'canales', 'media', 'parcial', 90, 'Hecho para el dueño (crons diario/horario/semanal + dispatcher WA/Telegram/email + ventana 24h). Falta: que los crons iteren workspaces (hoy single-tenant).', false],
  [41, 'WhatsApp + Email NO oficial dentro de MaKo', 'canales', 'media', 'parcial', 30, 'Evolution (WhatsApp no-oficial por QR) ya existe. Falta que AMBOS sistemas vivan cómodos dentro de MaKo.', false],
  [43, "Responder 'Datos sin Marcar' desde WhatsApp", 'canales', 'media', 'abierto', 0, '', false],
  [51, 'Listas de Difusión (nutrición y otros casos)', 'canales', 'media', 'abierto', 0, '', false],
  [19, 'Importar/exportar leads (importados → nutrición)', 'canales', 'media', 'abierto', 0, 'No existe import/export bulk (solo alta individual). Falta: parser + mapeo de columnas + enrolar los importados en la máquina de nutrición.', false],
  [16, 'Calendly + back-end (UTM/UUID) multi-tenant', 'canales', 'futuro', 'parcial', 60, 'UTM/UUID ya se capturan bien en el webhook. Falta la config multi-tenant: hoy las URLs están hardcodeadas a la cuenta de Mauricio. Cuando vuelva a Baires.', false],
  [21, 'Reportes a leads/clientes post-reunión', 'canales', 'futuro', 'abierto', 0, '', false],

  [24, 'Landing Analyst', 'analy', 'futuro', 'abierto', 0, 'PostHog / MS Clarity en landing y VSL del cliente → session replay + heatmaps de dónde exactamente se cae la gente. Empalma con "dónde sangra el embudo". Hoy solo stub comingSoon.', false],
  [25, 'VSL Analyst', 'analy', 'futuro', 'abierto', 0, 'La telemetría de VSL (retención por cuartiles) ya existe como insumo, pero el analista como feature no. Stub.', false],
  [13, 'CS Analyst (Customer Success)', 'analy', 'futuro', 'abierto', 0, 'Closing ya distingue llamadas de entrega de servicio; falta el analista de salud del cliente / churn. Stub.', false],
  [34, 'Market Analyst (análisis de competencia)', 'analy', 'futuro', 'abierto', 0, 'Los competidores sacan ads/funnels todo el tiempo → proceso RECURRENTE + aviso por WhatsApp cuando alguien saca algo nuevo. Stub.', false],
  [39, 'Offer Analyst (auditar/mejorar la oferta)', 'analy', 'futuro', 'abierto', 0, 'Que dentro del onboarding no solo tome los docs de la oferta y los guarde — que la audite, analice y mejore.', false],
  [26, 'Ads Writer / GhostWriter', 'analy', 'baja', 'hecho', 100, 'El copy de anuncios ya lo escribe Ads Writer (lib/ad-copy.ts, /ads-writer). GhostWriter apunta al mismo objetivo → cubierto.', false],
  [29, 'Generador de creativos estáticos + video (en masa)', 'analy', 'futuro', 'abierto', 0, 'Estilo app de Claudio Conde. (Fusión de 29+48.)', false],
  [49, 'Generador de Landing Pages (templates)', 'analy', 'futuro', 'abierto', 0, '', false],
  [47, 'Generador de Contratos', 'analy', 'baja', 'abierto', 0, '', false],
  [31, 'Cursos en tab Conocimiento (RAG)', 'analy', 'baja', 'parcial', 80, 'Pipeline transcribir→ordenar por curso/área→cargar y embeber en RAG, funcional. Solo "Levanta Muertos" viene pre-seedeado; el resto se sube a mano.', false],

  [46, 'Oferta Cebolla (planes por nivel de acceso)', 'growth', 'futuro', 'abierto', 0, 'MaKo hoy se vende a infoproductores +20k, pero PODRÍA venderse a TODO el que corra VSL Funnel limitando el acceso por planes según la situación del lead. El que recién empieza no necesita Experimentos ni CRM; sí WhatsApp, seguimientos, generación de creativos/guiones.', false],
  [45, 'Plan de Marketing: ads por cada funcionalidad', 'growth', 'futuro', 'abierto', 0, 'Claudio Conde hizo 60k SOLO con la feature de creativos estáticos, con cientos de ads atacando ESE ángulo. Yo puedo crear miles de ads atacando CADA funcionalidad de la app.', false],
  [1, 'Copy/detalle de cada feature en la landing (/vsl)', 'growth', 'futuro', 'abierto', 0, 'Tarea de MARKETING (contenido para la ruta /vsl), no una feature de la app. Cuando vuelva a Baires.', false],
  [22, 'Thank You Page (post-agenda con instrucciones)', 'growth', 'futuro', 'abierto', 0, 'Página post-agenda que fuerza ver/seguir instrucciones o se cancela la llamada (estilo confirmar.lovable.app). Hoy no existe.', false],
  [15, 'Testimonios (Lucre, Gabi, otros + Infra)', 'growth', 'futuro', 'abierto', 0, '', false],
  [27, 'Evaluar costos internos + para el cliente', 'growth', 'futuro', 'abierto', 0, 'Cuando vuelva a Baires.', false],
  [23, 'Loom tutorial/demo por feature', 'growth', 'futuro', 'abierto', 0, '', false],
  [35, 'Mapa de calor de uso (qué tabs usan más)', 'growth', 'futuro', 'abierto', 0, '', false],

  [36, 'Rediseño completo de la app', 'ux', 'alta', 'parcial', 70, 'Falta: Script/Closing Analyst + Experiments + tabs de Perfil + Onboarding.', false],
  [37, 'UX SIMPLE (la experiencia entera)', 'ux', 'alta', 'parcial', 60, 'El norte de UX: que todo sea SIMPLE. Falta: Closing/Script Analyst + Funnel + Onboarding.', false],
  [44, 'Administrador de Eventos en MaKo', 'ux', 'baja', 'abierto', 0, '', false],
];

const TASKS_KEY = 'mako_plan_v2';
const UI_KEY = 'mako_plan_ui_v2';
const seedTasks = (): Task[] => SEED.map((d) => ({ id: 't' + d[0], n: d[0], text: d[1], project: d[2], priority: d[3], status: d[4], prog: d[5], detalle: d[6], foco: d[7], deadline: '' }));
const clamp = (v: number) => Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));
const statRank = (s: Estado) => ({ abierto: 0, parcial: 1, hecho: 2 }[s]);

export function PlanBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<'prioridades' | 'kanban'>('prioridades');
  const [q, setQ] = useState('');
  const [fProj, setFProj] = useState<Set<string>>(new Set());
  const [fEst, setFEst] = useState<Set<Estado>>(new Set());
  const [fPrio, setFPrio] = useState<Set<Prio>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try { const raw = localStorage.getItem(TASKS_KEY); setTasks(raw ? (JSON.parse(raw) as Task[]) : seedTasks()); } catch { setTasks(seedTasks()); }
    try { const ui = JSON.parse(localStorage.getItem(UI_KEY) || '{}'); if (ui.view === 'prioridades' || ui.view === 'kanban') setView(ui.view); } catch { /* default */ }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => { if (hydrated) try { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); } catch { /* no-op */ } }, [tasks, hydrated]);
  useEffect(() => { if (hydrated) try { localStorage.setItem(UI_KEY, JSON.stringify({ view })); } catch { /* no-op */ } }, [view, hydrated]);
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenId(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openId]);

  const patch = (id: string, f: Partial<Task>) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...f } : t)));
  const remove = (id: string) => { setTasks((ts) => ts.filter((t) => t.id !== id)); setOpenId(null); };
  const addTask = (text: string) => {
    const v = text.trim(); if (!v) return;
    const maxN = tasks.reduce((m, t) => Math.max(m, t.n), 0);
    setTasks((ts) => [{ id: 't' + Date.now(), n: maxN + 1, text: v, project: 'doer', priority: 'media', status: 'abierto', prog: 0, detalle: '', foco: false, deadline: '' }, ...ts]);
  };

  const counts = useMemo(() => { const c = { hecho: 0, parcial: 0, abierto: 0 }; tasks.forEach((t) => { c[t.status] += 1; }); return c; }, [tasks]);
  const nFilters = fProj.size + fEst.size + fPrio.size;
  const passes = (t: Task) =>
    (!q || (t.text + ' ' + t.detalle).toLowerCase().includes(q.toLowerCase())) &&
    (fProj.size === 0 || fProj.has(t.project)) &&
    (fEst.size === 0 || fEst.has(t.status)) &&
    (fPrio.size === 0 || fPrio.has(t.priority));

  const filtered = tasks.filter(passes);
  const focos = tasks.filter((t) => t.foco && t.status !== 'hecho');
  const openTask = tasks.find((t) => t.id === openId) ?? null;

  return (
    <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Toolbar */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '22px 32px 14px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 600 }}>Plan de ejecución</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', margin: '3px 0 0', color: 'var(--ink)' }}>Qué construir</h1>
        </div>
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: 3, marginLeft: 8 }}>
          {(['prioridades', 'kanban'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} style={{ border: 'none', background: view === v ? 'var(--surface)' : 'transparent', color: view === v ? 'var(--ink)' : 'var(--dim)', fontWeight: view === v ? 600 : 500, fontSize: 13.5, padding: '7px 16px', borderRadius: 999, cursor: 'pointer', boxShadow: view === v ? '0 1px 2px rgba(18,21,27,.08)' : 'none', fontFamily: 'inherit', textTransform: 'capitalize' }}>{v}</button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {view === 'kanban' && <FilterMenu fProj={fProj} setFProj={setFProj} fEst={fEst} setFEst={setFEst} fPrio={fPrio} setFPrio={setFPrio} n={nFilters} />}
          {view === 'kanban' && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" style={{ width: 180, padding: '8px 13px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, outline: 'none' }} />}
          <AddButton onAdd={addTask} />
          <span style={{ display: 'flex', gap: 6, marginLeft: 4 }}>
            <Stat n={counts.abierto} c="var(--faint)" />
            <Stat n={counts.parcial} c="var(--warn)" />
            <Stat n={counts.hecho} c="var(--good)" />
          </span>
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {view === 'prioridades'
          ? <Prioridades focos={focos} onOpen={setOpenId} patch={patch} />
          : <Kanban tasks={filtered} onOpen={setOpenId} patch={patch} />}
      </div>

      {openTask && <TaskModal t={openTask} patch={patch} remove={remove} onClose={() => setOpenId(null)} />}
    </main>
  );
}

// ── átomos ────────────────────────────────────────────────────────────────────
function Stat({ n, c }: { n: number; c: string }) {
  return <span title="tareas" style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 999, padding: '5px 9px', fontSize: 12, color: 'var(--ink)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />{n}</span>;
}
function ProjDot({ id, name = true }: { id: string; name?: boolean }) {
  const p = projOf(id);
  if (!name) return <span style={{ width: 9, height: 9, borderRadius: 3, background: p.color, flex: 'none' }} title={p.name} />;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: p.color, background: p.color + '14', border: `1px solid ${p.color}33`, padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}><span style={{ width: 7, height: 7, borderRadius: 2, background: p.color }} />{p.name}</span>;
}
function StatusBadge({ s }: { s: Estado }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 600, color: SCOLOR[s], padding: '2px 4px' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: SCOLOR[s] }} />{SLABEL[s]}</span>;
}
function Star({ on, onClick, size = 15 }: { on: boolean; onClick: (e: ReactMouseEvent) => void; size?: number }) {
  return <button onClick={onClick} title="Foco" aria-pressed={on} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: size, lineHeight: 1, color: on ? 'var(--accent-soft)' : 'var(--faint)', padding: 2 }}>{on ? '★' : '☆'}</button>;
}
function MiniBar({ v }: { v: number }) {
  return <span style={{ display: 'block', height: 4, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: v + '%', background: 'var(--primary)' }} /></span>;
}
const selStyle: CSSProperties = { appearance: 'none', WebkitAppearance: 'none', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, fontWeight: 500, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', width: '100%' };

function AddButton({ onAdd }: { onAdd: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState('');
  if (!open) return <button onClick={() => setOpen(true)} style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>+ Tarea</button>;
  return (
    <span style={{ display: 'flex', gap: 6 }}>
      <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { onAdd(v); setV(''); setOpen(false); } if (e.key === 'Escape') setOpen(false); }} onBlur={() => { if (!v.trim()) setOpen(false); }} placeholder="Nueva tarea…" style={{ width: 190, padding: '8px 12px', borderRadius: 9, border: '1px solid var(--primary)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, outline: 'none' }} />
      <button onClick={() => { onAdd(v); setV(''); setOpen(false); }} style={{ padding: '8px 12px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>Add</button>
    </span>
  );
}

// ── filtros (dropdown, estilo Kan) ─────────────────────────────────────────────
function FilterMenu({ fProj, setFProj, fEst, setFEst, fPrio, setFPrio, n }: {
  fProj: Set<string>; setFProj: (s: Set<string>) => void; fEst: Set<Estado>; setFEst: (s: Set<Estado>) => void; fPrio: Set<Prio>; setFPrio: (s: Set<Prio>) => void; n: number;
}) {
  const [open, setOpen] = useState(false);
  const toggle = <T,>(set: Set<T>, val: T, apply: (s: Set<T>) => void) => { const c = new Set(set); if (c.has(val)) c.delete(val); else c.add(val); apply(c); };
  const clear = (e: ReactMouseEvent) => { e.stopPropagation(); setFProj(new Set()); setFEst(new Set()); setFPrio(new Set()); };
  return (
    <span style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} style={{ position: 'relative', padding: '8px 13px', borderRadius: 9, border: '1px solid var(--border-strong)', background: open ? 'var(--surface-2)' : 'var(--surface)', color: 'var(--dim)', fontWeight: 500, fontSize: 13.5, cursor: 'pointer' }}>
        Filtrar
        {n > 0 && (
          <span onClick={clear} title="Limpiar filtros" style={{ position: 'absolute', top: -7, right: -7, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: 'var(--ink)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)' }}>{n}</span>
        )}
      </button>
      {open && (
        <>
          <span onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{ position: 'absolute', top: 40, right: 0, zIndex: 41, width: 250, maxHeight: 420, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 16px 40px rgba(18,21,27,.16)', padding: 8 }}>
            <FGroup label="Proyecto">
              {PROJECTS.map((p) => <FRow key={p.id} on={fProj.has(p.id)} onClick={() => toggle(fProj, p.id, setFProj as (s: Set<string>) => void)} icon={<span style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />}>{p.name}</FRow>)}
            </FGroup>
            <FGroup label="Estado">
              {ESTADOS.map((s) => <FRow key={s} on={fEst.has(s)} onClick={() => toggle(fEst, s, setFEst as (x: Set<Estado>) => void)} icon={<span style={{ width: 8, height: 8, borderRadius: '50%', background: SCOLOR[s] }} />}>{SLABEL[s]}</FRow>)}
            </FGroup>
            <FGroup label="Prioridad">
              {PRIOS.map((p) => <FRow key={p} on={fPrio.has(p)} onClick={() => toggle(fPrio, p, setFPrio as (x: Set<Prio>) => void)} icon={<span style={{ width: 8, height: 8, borderRadius: '50%', background: PCOLOR[p] }} />}>{PLABEL[p]}</FRow>)}
            </FGroup>
          </div>
        </>
      )}
    </span>
  );
}
function FGroup({ label, children }: { label: string; children: ReactNode }) {
  return <div style={{ marginBottom: 4 }}><div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', padding: '6px 8px 3px' }}>{label}</div>{children}</div>;
}
function FRow({ on, onClick, icon, children }: { on: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '6px 8px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12.5, color: 'var(--ink)', textAlign: 'left', fontFamily: 'inherit' }}>
      <span style={{ width: 14, height: 14, borderRadius: 4, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{on ? '✓' : ''}</span>
      {icon}<span style={{ flex: 1 }}>{children}</span>
    </button>
  );
}

// ── tarjeta plana (estilo Kan) ─────────────────────────────────────────────────
function CardTile({ t, onOpen, patch }: { t: Task; onOpen: (id: string) => void; patch: (id: string, f: Partial<Task>) => void }) {
  return (
    <div onClick={() => onOpen(t.id)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', opacity: t.status === 'hecho' ? 0.6 : 1, transition: 'border-color .12s' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')} onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--faint)', fontWeight: 600 }}>#{t.n}</span>
        <ProjDot id={t.project} />
        <span style={{ flex: 1 }} />
        <Star on={t.foco} onClick={(e) => { e.stopPropagation(); patch(t.id, { foco: !t.foco }); }} size={14} />
      </div>
      <div style={{ fontSize: 13.5, lineHeight: 1.4, color: 'var(--ink)', textDecoration: t.status === 'hecho' ? 'line-through' : 'none', marginBottom: 9 }}>{t.text}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <StatusBadge s={t.status} />
        {t.detalle && <span title="tiene detalle" style={{ color: 'var(--faint)', fontSize: 12 }}>📄</span>}
        <span style={{ flex: 1 }}><MiniBar v={t.prog} /></span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{t.prog}%</span>
      </div>
    </div>
  );
}

// ── vista Kanban (columnas por prioridad, ancho completo) ──────────────────────
function Kanban({ tasks, onOpen, patch }: { tasks: Task[]; onOpen: (id: string) => void; patch: (id: string, f: Partial<Task>) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(240px, 1fr))', gap: 14, padding: '4px 32px 32px', height: '100%', overflowX: 'auto', overflowY: 'hidden', alignItems: 'start' }}>
      {PRIOS.map((p) => {
        const items = tasks.filter((t) => t.priority === p).sort((a, b) => statRank(a.status) - statRank(b.status) || a.n - b.n);
        return (
          <section key={p} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px 10px', flex: 'none' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: PCOLOR[p] }} />
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--dim)' }}>{PLABEL[p]}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{items.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', paddingRight: 3, minHeight: 0 }}>
              {items.length === 0 && <div style={{ fontSize: 12, color: 'var(--faint)', textAlign: 'center', padding: '14px 0' }}>—</div>}
              {items.map((t) => <CardTile key={t.id} t={t} onOpen={onOpen} patch={patch} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ── vista Prioridades (SOLO el foco, grande y minimalista) ─────────────────────
function Prioridades({ focos, onOpen, patch }: { focos: Task[]; onOpen: (id: string) => void; patch: (id: string, f: Partial<Task>) => void }) {
  if (focos.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--faint)', textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 40 }}>🎯</div>
        <div style={{ fontSize: 17, color: 'var(--dim)', fontWeight: 600 }}>Tu foco está vacío</div>
        <div style={{ fontSize: 14, maxWidth: 380, lineHeight: 1.5 }}>Marcá tareas con la <span style={{ color: 'var(--accent-soft)' }}>★</span> (en Kanban o acá) para tener adelante lo poco que importa ahora.</div>
      </div>
    );
  }
  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '18px 32px 40px' }}>
      <div style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 700, textAlign: 'center' }}>🎯 Foco ahora · {focos.length}</div>
        {focos.sort((a, b) => a.prog - b.prog).map((t) => (
          <div key={t.id} onClick={() => onOpen(t.id)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 26px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(18,21,27,.05)', transition: 'border-color .12s' }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')} onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <ProjDot id={t.project} />
              <StatusBadge s={t.status} />
              <span style={{ flex: 1 }} />
              <Star on onClick={(e) => { e.stopPropagation(); patch(t.id, { foco: false }); }} size={18} />
            </div>
            <div style={{ fontSize: 21, fontWeight: 600, lineHeight: 1.3, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: t.detalle ? 12 : 14 }}>{t.text}</div>
            {t.detalle && <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.55, marginBottom: 16, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.detalle}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ flex: 1 }}><MiniBar v={t.prog} /></span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{t.prog}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── modal de detalle (pop-up, estilo Kan de 2 columnas) ────────────────────────
function TaskModal({ t, patch, remove, onClose }: { t: Task; patch: (id: string, f: Partial<Task>) => void; remove: (id: string) => void; onClose: () => void }) {
  const p = projOf(t.project);
  const rowLabel: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6, display: 'block' };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(18,21,27,.35)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '8vh 16px 16px' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 780, maxHeight: '84vh', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 24px 60px rgba(18,21,27,.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderBottom: '1px solid var(--border)', flex: 'none' }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', fontWeight: 600 }}>#{t.n}</span>
          <ProjDot id={t.project} />
          <span style={{ flex: 1 }} />
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 22, lineHeight: 1, color: 'var(--faint)', padding: '2px 6px' }}>×</button>
        </div>
        <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
          {/* Izquierda: título + detalle */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '20px 22px' }}>
            <textarea value={t.text} onChange={(e) => patch(t.id, { text: e.target.value })} rows={2} style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 22, fontWeight: 600, lineHeight: 1.3, fontFamily: 'inherit', letterSpacing: '-0.01em', marginBottom: 16 }} />
            <label style={rowLabel}>Detalle · doc</label>
            <textarea value={t.detalle} onChange={(e) => patch(t.id, { detalle: e.target.value })} placeholder="Escribí el doc de esta tarea: qué es, por qué, cómo, links… (lo que te llevás a una sesión nueva)" style={{ width: '100%', minHeight: 240, border: '1px solid var(--border)', borderRadius: 10, outline: 'none', resize: 'vertical', background: 'var(--surface-2)', color: 'var(--dim)', fontSize: 13.5, lineHeight: 1.6, padding: '12px 14px', fontFamily: 'inherit' }} />
          </div>
          {/* Derecha: metadatos */}
          <div style={{ width: 230, flex: 'none', borderLeft: '1px solid var(--border)', background: 'var(--surface-2)', padding: '20px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div><label style={rowLabel}>Proyecto</label>
              <select value={t.project} onChange={(e) => patch(t.id, { project: e.target.value })} style={{ ...selStyle, color: p.color, fontWeight: 600 }}>
                {PROJECTS.map((x) => <option key={x.id} value={x.id}>{x.emoji} {x.name}</option>)}
              </select>
            </div>
            <div><label style={rowLabel}>Estado</label>
              <select value={t.status} onChange={(e) => { const s = e.target.value as Estado; patch(t.id, { status: s, ...(s === 'hecho' && t.prog < 100 ? { prog: 100 } : {}) }); }} style={selStyle}>
                {ESTADOS.map((s) => <option key={s} value={s}>{SLABEL[s]}</option>)}
              </select>
            </div>
            <div><label style={rowLabel}>Prioridad</label>
              <select value={t.priority} onChange={(e) => patch(t.id, { priority: e.target.value as Prio })} style={{ ...selStyle, color: PCOLOR[t.priority], fontWeight: 600 }}>
                {PRIOS.map((x) => <option key={x} value={x}>{PLABEL[x]}</option>)}
              </select>
            </div>
            <div><label style={rowLabel}>Avance · {t.prog}%</label>
              <input type="range" min={0} max={100} step={5} value={t.prog} onChange={(e) => patch(t.id, { prog: clamp(+e.target.value) })} style={{ width: '100%', accentColor: 'var(--primary)' }} />
            </div>
            <div><label style={rowLabel}>Deadline</label>
              <input type="date" value={t.deadline} onChange={(e) => patch(t.id, { deadline: e.target.value })} style={selStyle} />
            </div>
            <button onClick={() => patch(t.id, { foco: !t.foco })} style={{ ...selStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: t.foco ? 'var(--primary-bg)' : 'var(--surface)', color: t.foco ? 'var(--primary)' : 'var(--dim)', fontWeight: 600 }}>{t.foco ? '★ En foco' : '☆ Agregar al foco'}</button>
            <span style={{ flex: 1 }} />
            <button onClick={() => { if (confirm('¿Eliminar esta tarea?')) remove(t.id); }} style={{ border: 'none', background: 'transparent', color: 'var(--bad)', fontSize: 12.5, cursor: 'pointer', textAlign: 'left', padding: '4px 0' }}>Eliminar tarea</button>
          </div>
        </div>
      </div>
    </div>
  );
}
