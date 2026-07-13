import 'server-only';

// =============================================================================
// todo-seeds — proyectos (categorías) por defecto para clientes nuevos (G4)
// =============================================================================
// Un cliente que recién arranca tiene el board /plan vacío. En vez de una hoja en
// blanco, le sembramos un set de PROYECTOS base pensados para un negocio que corre
// ads + funnel con MaKo (adquisición, ventas, nutrición, contenido, retención,
// operación). Cada uno con prioridad DISTINTA (1-10) y un detalle corto que explica
// para qué sirve. Idempotente: solo siembra si el cliente todavía no tiene ninguna.
//
// El super-admin (PlanBoard, localStorage) tiene su propio SEED aparte; esto es
// solo para el board de cliente (tenant-scoped por DB).
// =============================================================================

import { getTenantDb } from './workspace';
import type { Categoria, HistEntry } from './todo';

type SeedProy = { nombre: string; emoji: string; color: string; prioridad: number; detalle: string };

// Prioridades DISTINTAS (sin empatar) — el orden = qué mueve más la aguja de un
// negocio que vende con ads. El guardián después las re-puntúa si el cliente arma
// su plan, pero de arranque quedan ordenadas con criterio.
export const SEED_CATEGORIAS: SeedProy[] = [
  { nombre: 'Adquisición & Ads', emoji: '🎯', color: '#D0504A', prioridad: 9, detalle: 'Todo lo que trae leads nuevos: campañas, creativos, presupuesto y optimización de la pauta. Es la boca del embudo — sin esto no entra nadie.' },
  { nombre: 'Seguimiento & Ventas', emoji: '📞', color: '#2F6FED', prioridad: 8, detalle: 'Setters y closers: agendar, presentarse, cerrar. El CRM y el estado de cada lead viven acá. Es donde el tráfico se transforma en plata.' },
  { nombre: 'Nutrición & Mensajería', emoji: '💬', color: '#7C5CFB', prioridad: 6, detalle: 'WhatsApp, email y los recordatorios que mantienen vivo al lead entre el primer contacto y el cierre. Recupera lo que se enfría.' },
  { nombre: 'Contenido & Creativos', emoji: '✍️', color: '#0E9B8E', prioridad: 5, detalle: 'La materia prima de los ads y del funnel: guiones, VSL, imágenes, copys. Alimenta a Adquisición con ángulos nuevos.' },
  { nombre: 'Clientes & Retención', emoji: '🤝', color: '#C8870C', prioridad: 4, detalle: 'Onboarding, cumplimiento y que el cliente se quede (y refiera). Cuidar la cartera cuesta menos que salir a buscar leads nuevos.' },
  { nombre: 'Operación & Métricas', emoji: '⚙️', color: '#98A0AC', prioridad: 2, detalle: 'La trastienda: procesos, cobranzas, tablero de números y todo lo administrativo que sostiene al resto sin ser la punta de lanza.' },
];

/**
 * Siembra los proyectos por defecto SOLO si el cliente todavía no tiene ninguno.
 * Idempotente y seguro ante recargas: re-chequea el conteo antes de insertar.
 * Devuelve las categorías creadas (o [] si ya había o si falló el chequeo).
 */
export async function seedTodoCategoriasSiVacio(): Promise<Categoria[]> {
  const supabase = await getTenantDb();
  const { data: existentes, error: errSel } = await supabase.from('tarea_categorias').select('id').limit(1);
  if (errSel) throw new Error(`seedTodoCategorias(select): ${errSel.message}`);
  if (existentes && existentes.length) return []; // ya tiene proyectos → no tocar

  const hist: HistEntry[] = [{ id: 'seedcat', ts: 0, actor: 'ia', text: 'MaKo creó el proyecto' }];
  const filas = SEED_CATEGORIAS.map((c) => ({
    nombre: c.nombre, color: c.color, emoji: c.emoji, prioridad: c.prioridad, detalle: c.detalle, historial: hist,
  }));
  const { data, error } = await supabase.from('tarea_categorias').insert(filas).select('*');
  if (error) throw new Error(`seedTodoCategorias(insert): ${error.message}`);
  return (data ?? []) as unknown as Categoria[];
}
