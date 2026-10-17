// =============================================================================
// _demo — tareas y categorías de demostración para /plan SÓLO en desarrollo
// =============================================================================
// En local sin claves de Supabase la lectura falla y la página arrancaría vacía. Esto da datos realistas para ver el
// tablero en preview. La página SÓLO lo usa con NODE_ENV !== 'production' y la lectura real caída.
// Vivía en app/experimentos/_demo.ts; se mudó el 17/10/2026, cuando /experimentos se retiró (su parte, al Dashboard).
// =============================================================================

import type { Tarea, Categoria } from '@/lib/todo';

const tarea = (p: Partial<Tarea>): Tarea => ({
  id: 0, titulo: '', detalle: null, estado: 'por_hacer', motivo_atorada: null, prioridad: 'media', progreso: 0,
  deadline: null, quarter: null, recurrente: false, recurrencia: null, categorias: [], checklist: [], historial: [], en_prioridad: false, score: 62, score_razon: null, score_manual: false, origen: 'manual', fuente: null,
  experimento_id: null, retro_id: null, orden: 0, hecho_at: null,
  created_at: '2026-06-20T12:00:00Z', updated_at: '2026-06-20T12:00:00Z',
  responsable: null, responsable_email: null, responsable_tipo: null, cliente_nombre: null, cliente_lead_id: null, tema: null,
  criterio_veredicto: null, criterio_regla: null, criterio_razon: null, cita: null,
  notas: '', deadline_razon: null, hacelo_en: null, impacto: null, esfuerzo: null, ...p,
});

export const demoCategorias: Categoria[] = [
  { id: 1, nombre: 'Marketing', color: '#3b82f6', emoji: '📈', prioridad: 9, score_razon: null, deadline: null, quarter: null, recurrente: false, recurrencia: null, cliente_lead_id: null, cliente_nombre: null, portada: null, portada_y: null, icono: null, notas: '', impacto: null, esfuerzo: null, detalle: '', historial: [], created_at: '2026-06-01T12:00:00Z' },
  { id: 2, nombre: 'Producto', color: '#46a758', emoji: '🧱', prioridad: 6, score_razon: null, deadline: null, quarter: null, recurrente: false, recurrencia: null, cliente_lead_id: null, cliente_nombre: null, portada: null, portada_y: null, icono: null, notas: '', impacto: null, esfuerzo: null, detalle: '', historial: [], created_at: '2026-06-01T12:00:00Z' },
  { id: 3, nombre: 'Ventas', color: '#f0a818', emoji: '🤝', prioridad: 8, score_razon: null, deadline: null, quarter: null, recurrente: false, recurrencia: null, cliente_lead_id: null, cliente_nombre: null, portada: null, portada_y: null, icono: null, notas: '', impacto: null, esfuerzo: null, detalle: '', historial: [], created_at: '2026-06-01T12:00:00Z' },
];

export const demoTareas: Tarea[] = [
  tarea({ id: 1, titulo: 'Revisar por qué cayó la agenda semana 3', detalle: 'Cruzar Calendly con los adsets nuevos.', prioridad: 'alta', progreso: 20, deadline: '2026-07-05', categorias: [1], origen: 'retro', retro_id: 1, orden: -3 }),
  tarea({ id: 2, titulo: 'Reeditar apertura del VSL', detalle: 'Promesa numérica en los primeros 15s.', prioridad: 'alta', progreso: 0, categorias: [1, 2], origen: 'experimento', experimento_id: 2, orden: -2 }),
  tarea({ id: 3, titulo: 'Documentar retargeting como estándar', prioridad: 'media', progreso: 0, categorias: [2], origen: 'retro', retro_id: 1, orden: -1 }),
  tarea({ id: 4, titulo: 'Pedir a diseño 3 variantes del creativo ganador', prioridad: 'media', progreso: 45, deadline: '2026-07-02', categorias: [1], origen: 'manual', estado: 'en_curso', orden: 0 }),
  tarea({ id: 5, titulo: 'Configurar umbral de facturación en el form', detalle: 'Instant form de Meta.', prioridad: 'alta', progreso: 70, categorias: [3], origen: 'experimento', experimento_id: 1, estado: 'en_curso', orden: 1 }),
  tarea({ id: 6, titulo: 'Subir presupuesto del ganador 20%', prioridad: 'baja', progreso: 100, categorias: [1], origen: 'experimento', experimento_id: 3, estado: 'hecho', hecho_at: '2026-06-15T12:00:00Z', orden: 0 }),
];
