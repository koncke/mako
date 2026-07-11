'use client';

// =============================================================================
// PlanBoard — plan de ejecución de MaKo (solo super-admin, en /todo)
// =============================================================================
// Tablero privado de Martín, estilo Trello, con el tema CLARO de la app. Dos
// vistas: "Prioridades" (lista simple, para escanear qué hacer) y "Kanban"
// (columnas por prioridad, para gestionar). Proyecto = etiqueta de color por
// tarjeta. Persistencia en localStorage (keys mako_plan_v2 / mako_plan_ui_v2);
// el SEED de abajo es la fuente de verdad. El cliente ve otra cosa en /todo
// (TodoBoard) — el ruteo por rol vive en app/todo/page.tsx.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type Dispatch, type SetStateAction } from 'react';

const MONO = "'Geist Mono', monospace";

type Prio = 'alta' | 'media' | 'baja' | 'futuro';
type Estado = 'hecho' | 'parcial' | 'abierto';
type Task = { id: string; n: number; text: string; project: string; priority: Prio; status: Estado; prog: number; detalle: string; foco: boolean; deadline: string };
type Proj = { id: string; emoji: string; name: string; color: string };

const PRIOS: Prio[] = ['alta', 'media', 'baja', 'futuro'];
const PLABEL: Record<Prio, string> = { alta: 'Alta', media: 'Media', baja: 'Baja', futuro: 'A futuro' };
const PCOLOR: Record<Prio, string> = { alta: 'var(--bad)', media: 'var(--warn-fill)', baja: 'var(--good)', futuro: 'var(--faint)' };
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
const prioRank = (p: Prio) => PRIOS.indexOf(p);
const statRank = (s: Estado) => ({ abierto: 0, parcial: 1, hecho: 2 }[s]);

export function PlanBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<'prioridades' | 'kanban'>('prioridades');
  const [q, setQ] = useState('');
  const [hideDone, setHideDone] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState('');
  const [hydrated, setHydrated] = useState(false);

  // Cargar de localStorage (o SEED) tras montar: patrón de hidratación correcto
  // (el server render usa el estado inicial vacío, el cliente actualiza acá; sin
  // mismatch). El lint de set-state-in-effect es falso positivo para este caso.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TASKS_KEY);
      setTasks(raw ? (JSON.parse(raw) as Task[]) : seedTasks());
    } catch { setTasks(seedTasks()); }
    try {
      const ui = JSON.parse(localStorage.getItem(UI_KEY) || '{}');
      if (ui.view === 'prioridades' || ui.view === 'kanban') setView(ui.view);
      if (typeof ui.hideDone === 'boolean') setHideDone(ui.hideDone);
    } catch { /* defaults */ }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persistir.
  useEffect(() => { if (hydrated) try { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); } catch { /* no-op */ } }, [tasks, hydrated]);
  useEffect(() => { if (hydrated) try { localStorage.setItem(UI_KEY, JSON.stringify({ view, hideDone })); } catch { /* no-op */ } }, [view, hideDone, hydrated]);

  const patch = (id: string, fields: Partial<Task>) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...fields } : t)));
  const remove = (id: string) => setTasks((ts) => ts.filter((t) => t.id !== id));
  const addTask = () => {
    const v = adding.trim(); if (!v) return;
    const maxN = tasks.reduce((m, t) => Math.max(m, t.n), 0);
    setTasks((ts) => [{ id: 't' + Date.now(), n: maxN + 1, text: v, project: 'doer', priority: 'media', status: 'abierto', prog: 0, detalle: '', foco: false, deadline: '' }, ...ts]);
    setAdding('');
  };

  const counts = useMemo(() => {
    const c = { hecho: 0, parcial: 0, abierto: 0 };
    tasks.forEach((t) => { c[t.status] += 1; });
    return c;
  }, [tasks]);

  const passes = (t: Task) => (!q || (t.text + ' ' + t.detalle).toLowerCase().includes(q.toLowerCase())) && !(hideDone && t.status === 'hecho');
  const focos = tasks.filter((t) => t.foco && t.status !== 'hecho').sort((a, b) => prioRank(a.priority) - prioRank(b.priority) || a.n - b.n);

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '32px 40px 80px', maxWidth: 1180 }}>
      {/* Encabezado */}
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 600, marginBottom: 5 }}>Plan de ejecución</div>
          <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, color: 'var(--ink)' }}>Qué construir</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Stat n={counts.abierto} label="Abiertas" color="var(--faint)" />
          <Stat n={counts.parcial} label="Parciales" color="var(--warn)" />
          <Stat n={counts.hecho} label="Hechas" color="var(--good)" />
        </div>
      </header>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: 3 }}>
          {(['prioridades', 'kanban'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} style={{
              border: 'none', background: view === v ? 'var(--surface)' : 'transparent', color: view === v ? 'var(--ink)' : 'var(--dim)',
              fontWeight: view === v ? 600 : 500, fontSize: 13.5, padding: '7px 16px', borderRadius: 999, cursor: 'pointer',
              boxShadow: view === v ? '0 1px 2px rgba(18,21,27,.08)' : 'none', fontFamily: 'inherit', textTransform: 'capitalize',
            }}>{v}</button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" style={{ flex: 1, minWidth: 160, padding: '9px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, outline: 'none' }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={adding} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addTask(); }} placeholder="Nueva tarea…" style={{ padding: '9px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, outline: 'none', width: 170 }} />
          <button onClick={addTask} style={{ padding: '9px 15px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>Agregar</button>
        </div>
        <button onClick={() => setHideDone((v) => !v)} style={{ padding: '8px 13px', borderRadius: 999, border: '1px solid var(--border-strong)', background: hideDone ? 'var(--primary-bg)' : 'var(--surface)', color: hideDone ? 'var(--primary)' : 'var(--dim)', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>{hideDone ? 'Mostrar hechas' : 'Ocultar hechas'}</button>
      </div>

      {/* Foco */}
      {focos.length > 0 && (
        <section style={{ marginBottom: 26 }}>
          <SecLabel>🎯 Foco ahora · {focos.length}</SecLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
            {focos.map((t) => (
              <div key={t.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: '3px solid var(--accent-soft)', borderRadius: 12, padding: '13px 15px', boxShadow: '0 1px 2px rgba(18,21,27,.05)' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4, marginBottom: 9 }}>{t.text}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <StatusBadge s={t.status} />
                  <ProjLabel id={t.project} />
                  <span style={{ flex: 1 }} />
                  <Star on onClick={() => patch(t.id, { foco: false })} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {view === 'prioridades'
        ? <Prioridades tasks={tasks.filter(passes)} open={open} setOpen={setOpen} patch={patch} />
        : <Kanban tasks={tasks.filter(passes)} open={open} setOpen={setOpen} patch={patch} remove={remove} />}
    </main>
  );
}

// ── átomos ────────────────────────────────────────────────────────────────────

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 999, padding: '5px 12px', fontSize: 12.5, color: 'var(--dim)' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      <b style={{ color: 'var(--ink)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{n}</b> {label}
    </span>
  );
}
function SecLabel({ children }: { children: ReactNode }) {
  return <div style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 700, marginBottom: 12 }}>{children}</div>;
}
function StatusBadge({ s }: { s: Estado }) {
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: SCOLOR[s], background: s === 'hecho' ? 'var(--good-bg)' : s === 'parcial' ? 'var(--warn-bg)' : 'var(--surface-2)', border: `1px solid ${s === 'abierto' ? 'var(--border)' : 'transparent'}`, padding: '2px 8px', borderRadius: 999 }}>{SLABEL[s]}</span>;
}
function ProjLabel({ id }: { id: string }) {
  const p = projOf(id);
  return <span style={{ fontSize: 10.5, fontWeight: 600, color: p.color, background: p.color + '18', border: `1px solid ${p.color}44`, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{p.emoji} {p.name}</span>;
}
function Star({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <button onClick={onClick} title="Foco" aria-pressed={on} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15, lineHeight: 1, color: on ? 'var(--accent-soft)' : 'var(--faint)', padding: 2 }}>{on ? '★' : '☆'}</button>;
}
const selStyle: CSSProperties = { appearance: 'none', WebkitAppearance: 'none', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 11.5, fontWeight: 600, padding: '4px 9px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' };

// ── detalle expandible (compartido) ────────────────────────────────────────────
function Detalle({ t, isOpen, toggle, patch }: { t: Task; isOpen: boolean; toggle: () => void; patch: (id: string, f: Partial<Task>) => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={toggle} style={{ border: 'none', background: 'transparent', color: 'var(--faint)', fontSize: 11.5, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        {isOpen ? '▾' : '▸'} Detalle {t.detalle && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>• doc</span>}
      </button>
      {isOpen && (editing
        ? <textarea autoFocus defaultValue={t.detalle} onBlur={(e) => { patch(t.id, { detalle: e.target.value.trim() }); setEditing(false); }} style={{ width: '100%', marginTop: 7, minHeight: 130, background: 'var(--surface-2)', border: '1px solid var(--primary)', borderRadius: 9, color: 'var(--ink)', fontSize: 12.5, padding: '9px 11px', lineHeight: 1.55, outline: 'none', fontFamily: 'inherit', resize: 'vertical' }} />
        : <div onClick={() => setEditing(true)} style={{ marginTop: 7, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 12px', fontSize: 12.5, color: 'var(--dim)', whiteSpace: 'pre-wrap', lineHeight: 1.55, cursor: 'text' }}>{t.detalle || <span style={{ fontStyle: 'italic', color: 'var(--faint)' }}>Sin detalle. Clic para escribir el doc.</span>}</div>)}
    </div>
  );
}

// ── vista Prioridades (simple, minimalista) ────────────────────────────────────
function Prioridades({ tasks, open, setOpen, patch }: { tasks: Task[]; open: Record<string, boolean>; setOpen: Dispatch<SetStateAction<Record<string, boolean>>>; patch: (id: string, f: Partial<Task>) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {PRIOS.map((p) => {
        const items = tasks.filter((t) => t.priority === p).sort((a, b) => statRank(a.status) - statRank(b.status) || a.n - b.n);
        if (!items.length) return null;
        return (
          <section key={p}>
            <SecLabel><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: PCOLOR[p], marginRight: 8, verticalAlign: 'middle' }} />{PLABEL[p]} · {items.length}</SecLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {items.map((t) => {
                const isOpen = !!open[t.id];
                return (
                  <div key={t.id} style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)', opacity: t.status === 'hecho' ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: SCOLOR[t.status], flex: 'none' }} title={SLABEL[t.status]} />
                      <span style={{ flex: 1, fontSize: 14.5, color: 'var(--ink)', fontWeight: 500, textDecoration: t.status === 'hecho' ? 'line-through' : 'none' }}>{t.text}</span>
                      <ProjLabel id={t.project} />
                      <Star on={t.foco} onClick={() => patch(t.id, { foco: !t.foco })} />
                    </div>
                    <div style={{ paddingLeft: 20 }}>
                      <Detalle t={t} isOpen={isOpen} toggle={() => setOpen((o) => ({ ...o, [t.id]: !o[t.id] }))} patch={patch} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ── vista Kanban (columnas por prioridad, estilo Trello) ───────────────────────
function Kanban({ tasks, open, setOpen, patch, remove }: { tasks: Task[]; open: Record<string, boolean>; setOpen: Dispatch<SetStateAction<Record<string, boolean>>>; patch: (id: string, f: Partial<Task>) => void; remove: (id: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 14, alignItems: 'start' }}>
      {PRIOS.map((p) => {
        const items = tasks.filter((t) => t.priority === p).sort((a, b) => statRank(a.status) - statRank(b.status) || a.n - b.n);
        return (
          <section key={p} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 14, padding: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px 12px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: PCOLOR[p] }} />
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)' }}>{PLABEL[p]}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{items.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {items.length === 0 && <div style={{ fontSize: 12, color: 'var(--faint)', textAlign: 'center', padding: '10px 0' }}>—</div>}
              {items.map((t) => (
                <div key={t.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 12px', boxShadow: '0 1px 2px rgba(18,21,27,.06)', opacity: t.status === 'hecho' ? 0.62 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                    <ProjLabel id={t.project} />
                    <StatusBadge s={t.status} />
                    <span style={{ flex: 1 }} />
                    <Star on={t.foco} onClick={() => patch(t.id, { foco: !t.foco })} />
                    <button onClick={() => { if (confirm('¿Eliminar "' + t.text.slice(0, 46) + '"?')) remove(t.id); }} title="Eliminar" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--faint)', fontSize: 16, lineHeight: 1, padding: 2 }}>×</button>
                  </div>
                  <EditableTitle t={t} patch={patch} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
                    <select value={t.priority} onChange={(e) => patch(t.id, { priority: e.target.value as Prio })} style={{ ...selStyle, color: PCOLOR[t.priority] }} aria-label="Prioridad">
                      {PRIOS.map((x) => <option key={x} value={x}>{PLABEL[x]}</option>)}
                    </select>
                    <select value={t.status} onChange={(e) => { const s = e.target.value as Estado; patch(t.id, { status: s, ...(s === 'hecho' && t.prog < 100 ? { prog: 100 } : {}) }); }} style={selStyle} aria-label="Estado">
                      {(['abierto', 'parcial', 'hecho'] as const).map((x) => <option key={x} value={x}>{SLABEL[x]}</option>)}
                    </select>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 110 }}>
                      <input type="range" min={0} max={100} step={5} value={t.prog} onChange={(e) => patch(t.id, { prog: clamp(+e.target.value) })} style={{ flex: 1, accentColor: 'var(--primary)' }} aria-label="Progreso" />
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--dim)', minWidth: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{t.prog}%</span>
                    </span>
                  </div>
                  <Detalle t={t} isOpen={!!open[t.id]} toggle={() => setOpen((o) => ({ ...o, [t.id]: !o[t.id] }))} patch={patch} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function EditableTitle({ t, patch }: { t: Task; patch: (id: string, f: Partial<Task>) => void }) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  if (editing) {
    return <textarea ref={ref} autoFocus defaultValue={t.text} rows={2}
      onBlur={(e) => { const v = e.target.value.trim(); if (v) patch(t.id, { text: v }); setEditing(false); }}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } if (e.key === 'Escape') setEditing(false); }}
      style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--primary)', borderRadius: 8, color: 'var(--ink)', fontSize: 13.5, padding: '7px 9px', lineHeight: 1.4, outline: 'none', fontFamily: 'inherit', resize: 'vertical' }} />;
  }
  return <div onClick={() => setEditing(true)} title="Editar" style={{ fontSize: 13.5, lineHeight: 1.42, color: 'var(--ink)', cursor: 'text', textDecoration: t.status === 'hecho' ? 'line-through' : 'none' }}>{t.text}</div>;
}
