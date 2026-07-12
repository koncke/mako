'use client';

// =============================================================================
// PlanBoard — adapter del board /todo para el super-admin (localStorage)
// =============================================================================
// Toda la UI vive en board/BoardShell (compartida con el cliente). Acá solo:
// el SEED (fuente de verdad del backlog), la carga/persistencia en localStorage,
// y el Repo que implementa create/save/delete sobre el array local.

import { useEffect, useState } from 'react';
import { BoardShell } from './board/BoardShell';
import { useBoard } from './board/useBoard';
import { type BoardTask, type Label, type Repo, type BoardUser, type Prio, type Hist, scoreFromPrio, prioFromScore, clampScore } from './board/types';

const K5 = 'mako_plan_v5', K4 = 'mako_plan_v4', K_PROJS = 'mako_plan_projs_v3';
const SEED_TS = Date.parse('2026-07-01T12:00:00Z');
const uid = () => 'x' + Math.random().toString(36).slice(2, 9);

const PROJS_DEFAULT: Label[] = [
  { id: 'doer', emoji: '🔴', name: 'Hacer MaKo DOER', color: '#D0504A', score: 5 },
  { id: 'plat', emoji: '🧱', name: 'Plataforma & Núcleo', color: '#2F6FED', score: 4 },
  { id: 'canales', emoji: '💬', name: 'Canales & Mensajería', color: '#7C5CFB', score: 3 },
  { id: 'analy', emoji: '🔍', name: 'Analysts & Generadores', color: '#0E9B8E', score: 3 },
  { id: 'growth', emoji: '📈', name: 'Growth · Vender MaKo', color: '#C8870C', score: 2 },
  { id: 'ux', emoji: '✨', name: 'UX & Diseño', color: '#D6489B', score: 2 },
];

// [num, title, project, prioridad, prog, detalle, enPrioridad]
type Row = [number, string, string, Prio, number, string, boolean];
const SEED: Row[] = [
  [42, 'Retro & Planning: la tab-cerebro', 'doer', 'alta', 100, 'Base hecha. Casa del programa DOER: reportes + plan, ligada a Experiments.', false],
  [55, 'Catálogo de fugas: que Retro detecte los patrones', 'doer', 'alta', 0, 'Catálogo (la IA juzga): escalar no-ganadores, gasto↑/resultados↓, poca variedad, huecos del funnel, escalado incorrecto, muchos cambios, cobranza recurrente. Metodología Recon (2 señales). Spec: docs/superpowers/specs/2026-07-10-retro-doer-accountability-design.md', true],
  [56, 'Rendición de cuentas: verificar ejecución + reclamo', 'doer', 'alta', 0, 'MaKo joinea experimento_tareas por retro_id, distingue aceptado-vs-HECHO, reclama. Spec S1 · Sección 2.', true],
  [54, 'El pulso: que la app te diga QUÉ HACER (vista Hoy)', 'doer', 'alta', 0, 'Chequeo diario barato que reclama/avisa por campanita+WhatsApp y surfacea en el semáforo. Spec S1 · Sección 3.', true],
  [53, 'Modo Simple por default + Avanzado', 'doer', 'alta', 0, 'Default SIMPLE (3 tareas + experimentos). El kanban va a Avanzado.', false],
  [4, 'Onboarding progresivo por tab (SIMPLE)', 'doer', 'alta', 55, 'Onboarding inicial: lo básico (Meta) + veredicto con Experiments. Después MaKo te manda a la tab cuando detecta una fuga. Base hecha; falta el modelo progresivo.', false],
  [57, 'Atribución de cash por anuncio', 'doer', 'alta', 0, 'meta_ad_id × pagos, granular. Hoy solo ROAS agregado. Combustible del cerebro.', false],
  [58, 'Minería de objeciones (closing_analyses)', 'doer', 'media', 0, 'Objeciones recurrentes que matan cierres. La data ya se guarda.', false],
  [59, 'Semáforo vivo (alertas con IA)', 'doer', 'media', 0, 'Junta señales + tendencia + Claude razona alertas nuevas. Donde surfacea el pulso.', false],
  [18, 'MaKo embebido en todas las tabs', 'doer', 'media', 30, 'WhatsApp ya tiene MaKo. Falta funnel, leads, experimentos, email, closing.', false],
  [14, 'CRM Automático (leads que avanzan solos)', 'doer', 'alta', 40, 'Motor T1-T6 hecho pero APAGADO. Backlog: esquema de cuándo mover un lead, pop-up de confirmación, Datos sin Marcar auto-completados, etapa Reactivación. Terminar Onboarding + FUNNEL.', false],

  [3, 'Perfil de Usuario', 'plat', 'alta', 100, 'Hecho: /perfil.', false],
  [5, 'Usuarios + vista de Admin', 'plat', 'alta', 100, 'Hecho: /admin.', false],
  [6, 'Método: tokens + tutorial', 'plat', 'alta', 100, 'Hecho: /metodo.', false],
  [28, 'Panel de Equipo (Closers/Setters)', 'plat', 'media', 100, 'Hecho: /equipo.', false],
  [2, 'Ficha del lead (CRM)', 'plat', 'alta', 100, 'Hecho: 7 tabs. La tab Chat es solo lectura.', false],
  [12, 'Ads Manager: crear/editar campañas + USD', 'plat', 'media', 100, 'Hecho (12+40+50). Todo en PAUSA. CREATE de Meta no probado en vivo.', false],
  [33, "API 'Analizar' de Meta", 'plat', 'baja', 100, 'Código completo. Recos nativas vacías por bloqueo de pago, no del código.', false],
  [7, 'Ciberseguridad + eficiencia', 'plat', 'alta', 80, 'Auditoría hecha, HIGH+MEDIUM fixeados. Falta performance (LOW) + depurar (continuo).', false],
  [30, 'Protocolo de Beta y versiones', 'plat', 'media', 0, 'Mejorar sin interrumpir a los usuarios.', false],
  [52, 'Usar SKILLS en todo el código', 'plat', 'baja', 25, 'Instaladas brainstorming/plans/grill/decision-maker + repo. Falta aplicarlas.', false],
  [17, 'Traspaso de cuentas Mauricio → mías', 'plat', 'baja', 0, 'Supabase/Vercel/dominio. No prioridad.', false],
  [32, 'Dominio propio + ruteo', 'plat', 'baja', 0, 'Landing en la raíz, no en /vsl.', false],

  [8, 'Email Marketing (Resend)', 'canales', 'media', 90, 'Código completo. Falta go-live: dominio + RESEND_WEBHOOK_SECRET.', false],
  [9, 'Nutrición Automática', 'canales', 'media', 70, 'Motor completo (3 canales, anti-baneo), APAGADO. Falta go-live: flags + dominio + templates WA.', false],
  [20, 'Reportes por WhatsApp', 'canales', 'media', 90, 'Hecho para el dueño. Falta que los crons iteren workspaces.', false],
  [41, 'WhatsApp + Email NO oficial dentro de MaKo', 'canales', 'media', 30, 'Evolution existe. Falta que ambos vivan cómodos en MaKo.', false],
  [43, "Responder 'Datos sin Marcar' desde WhatsApp", 'canales', 'media', 0, '', false],
  [51, 'Listas de Difusión', 'canales', 'media', 0, '', false],
  [19, 'Importar/exportar leads (→ nutrición)', 'canales', 'media', 0, 'No existe bulk. Falta parser + mapeo + enrolar en nutrición.', false],
  [16, 'Calendly + back-end multi-tenant', 'canales', 'futuro', 60, 'UTM/UUID ok. Falta config multi-tenant (hoy hardcoded a Mauricio).', false],
  [21, 'Reportes a leads/clientes post-reunión', 'canales', 'futuro', 0, '', false],

  [24, 'Landing Analyst', 'analy', 'futuro', 0, 'PostHog/Clarity: session replay + heatmaps. Stub comingSoon.', false],
  [25, 'VSL Analyst', 'analy', 'futuro', 0, 'Telemetría VSL ya existe; el analista no. Stub.', false],
  [13, 'CS Analyst (Customer Success)', 'analy', 'futuro', 0, 'Closing ya distingue servicio; falta analista de churn. Stub.', false],
  [34, 'Market Analyst (competencia)', 'analy', 'futuro', 0, 'Proceso recurrente + aviso por WhatsApp cuando un competidor saca algo. Stub.', false],
  [39, 'Offer Analyst', 'analy', 'futuro', 0, 'Que audite/mejore la oferta en el onboarding, no solo la guarde.', false],
  [26, 'Ads Writer / GhostWriter', 'analy', 'baja', 100, 'Cubierto por Ads Writer (lib/ad-copy.ts).', false],
  [29, 'Generador de creativos (masa)', 'analy', 'futuro', 0, 'Estilo Claudio Conde.', false],
  [49, 'Generador de Landing Pages', 'analy', 'futuro', 0, '', false],
  [47, 'Generador de Contratos', 'analy', 'baja', 0, '', false],
  [31, 'Cursos en Conocimiento (RAG)', 'analy', 'baja', 80, 'Pipeline funcional. Solo Levanta Muertos pre-seedeado.', false],

  [46, 'Oferta Cebolla (planes por nivel)', 'growth', 'futuro', 0, 'Venderle a TODO el que corra VSL Funnel limitando acceso por planes según la situación del lead.', false],
  [45, 'Ads por cada funcionalidad', 'growth', 'futuro', 0, 'Claudio Conde 60k con 1 feature. Miles de ads por cada feature.', false],
  [1, 'Copy de features en la landing (/vsl)', 'growth', 'futuro', 0, 'Marketing, no feature. Cuando vuelva a Baires.', false],
  [22, 'Thank You Page (post-agenda)', 'growth', 'futuro', 0, 'Página que fuerza instrucciones o se cancela la llamada (estilo confirmar.lovable.app).', false],
  [15, 'Testimonios', 'growth', 'futuro', 0, '', false],
  [27, 'Costos internos + cliente', 'growth', 'futuro', 0, 'Cuando vuelva a Baires.', false],
  [23, 'Loom demo por feature', 'growth', 'futuro', 0, '', false],
  [35, 'Mapa de calor de uso', 'growth', 'futuro', 0, '', false],

  [36, 'Rediseño completo de la app', 'ux', 'alta', 70, 'Falta: Script/Closing Analyst + Experiments + Perfil + Onboarding.', false],
  [37, 'UX SIMPLE (la experiencia)', 'ux', 'alta', 60, 'El norte de UX. Falta: Closing/Script Analyst + Funnel + Onboarding.', false],
  [44, 'Administrador de Eventos', 'ux', 'baja', 0, '', false],
];

// El proyecto DOER es la iniciativa impulsada por MaKo → esas tarjetas se
// atribuyen a MaKo (ícono IA + "MaKo" en el change history).
const seedTasks = (): BoardTask[] => SEED.map((d) => {
  const esIA = d[2] === 'doer';
  return {
    id: 't' + d[0], num: d[0], title: d[1], detalle: d[5], priority: d[3], score: scoreFromPrio[d[3]], progress: d[4],
    deadline: '', labels: [d[2]], checklist: [], enPrioridad: d[6],
    origen: esIA ? 'ia' as const : 'user' as const,
    historial: [{ id: 'seed' + d[0], ts: SEED_TS, actor: esIA ? 'ia' : 'user', text: 'Creó la tarjeta' } as Hist],
  };
});

// Asegura que cada entrada de historial tenga id (localStorage viejo puede no tenerlo).
const normHist = (h: unknown[]): Hist[] => (Array.isArray(h) ? h : []).map((e) => {
  const o = (e ?? {}) as Record<string, unknown>;
  return { ...o, id: typeof o.id === 'string' && o.id ? o.id : 'h' + (Number(o.ts) || 0) } as Hist;
});
const normTask = (t: BoardTask): BoardTask => {
  // score = fuente de verdad; si el localStorage viejo no lo tiene, se deriva de la columna.
  const s = typeof t.score === 'number' && t.score > 0 ? clampScore(t.score) : scoreFromPrio[t.priority] ?? 62;
  return { ...t, score: s, priority: prioFromScore(s), historial: normHist(t.historial as unknown[]) };
};
const normLabel = (l: Label): Label => ({ ...l, score: typeof l.score === 'number' && l.score >= 1 ? Math.min(5, Math.round(l.score)) : 3 });

type OldV4 = { id: string; n: number; text: string; project: string; priority: Prio; prog?: number; detalle?: string; foco?: boolean; deadline?: string; checklist?: unknown; origen?: string; historial?: unknown };
const fromV4 = (t: OldV4): BoardTask => {
  const priority = (['alta', 'media', 'baja', 'futuro'] as string[]).includes(t.priority) ? t.priority : 'media';
  return {
    id: t.id ?? 't' + uid(), num: typeof t.n === 'number' ? t.n : 0, title: t.text ?? '', detalle: t.detalle ?? '',
    priority, score: scoreFromPrio[priority],
    progress: Math.max(0, Math.min(100, Math.round(t.prog ?? 0))), deadline: t.deadline ?? '',
    labels: t.project ? [t.project] : [], checklist: Array.isArray(t.checklist) ? t.checklist as BoardTask['checklist'] : [],
    historial: Array.isArray(t.historial) ? t.historial as Hist[] : [], origen: t.origen === 'ia' ? 'ia' : 'user', enPrioridad: !!t.foco,
  };
};

function loadTasks(): BoardTask[] {
  try {
    const v5 = localStorage.getItem(K5);
    if (v5) return (JSON.parse(v5) as BoardTask[]).map(normTask);
    const v4 = localStorage.getItem(K4);
    if (v4) return (JSON.parse(v4) as OldV4[]).map(fromV4).map(normTask);
  } catch { /* seed */ }
  return seedTasks();
}
function loadLabels(): Label[] {
  try { const p = localStorage.getItem(K_PROJS); if (p) return (JSON.parse(p) as Label[]).map(normLabel); } catch { /* default */ }
  return PROJS_DEFAULT;
}

export function PlanBoard({ user }: { user: BoardUser }) {
  const repo: Repo = {
    labelMode: 'single', labelSingular: 'Proyecto', labelPlural: 'Proyectos',
    dismissableGauntlet: true, // TEMPORAL (solo super-admin, mientras se desarrolla)
    createTask: async (d) => d, saveTask: async () => {}, deleteTask: async () => {},
    createLabel: async (l) => l, saveLabel: async () => {}, deleteLabel: async () => {},
  };
  const board = useBoard([], [], user, repo);
  const [hydrated, setHydrated] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { board.reset(loadTasks(), loadLabels()); setHydrated(true); }, []);
  useEffect(() => { if (hydrated) try { localStorage.setItem(K5, JSON.stringify(board.tasks)); } catch { /* no-op */ } }, [board.tasks, hydrated]);
  useEffect(() => { if (hydrated) try { localStorage.setItem(K_PROJS, JSON.stringify(board.labels)); } catch { /* no-op */ } }, [board.labels, hydrated]);

  if (!hydrated) return <main style={{ flex: 1 }} />;
  return <BoardShell board={board} />;
}
