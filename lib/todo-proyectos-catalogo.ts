// =============================================================================
// todo-proyectos-catalogo — la lista CERRADA de proyectos del tablero del CLIENTE
// =============================================================================
// Hermano de lib/plan-proyectos-catalogo.ts (el del dueño), con el mismo problema
// detrás y otra respuesta: en el tablero del dueño los proyectos grandes son las tabs
// del producto; en el de un cliente son las ÁREAS de su marketing y sus CLIENTES.
//
// El pedido, textual: «sería bueno que MaKo también tenga el mismo criterio a la hora
// de crear los proyectos… En lugar de crear cientos de proyectos, que los englobe».
// Sin lista cerrada, cada tarea que entra por WhatsApp o por una reunión se lleva su
// propio proyecto: "Optimización de creativos", "Creativos nuevos", "Ads de agosto" —
// tres nombres para el mismo trabajo, y un tablero de 60 proyectos de una tarea cada
// uno que no se puede priorizar.
//
// DOS familias, nada más:
//   · ÁREA     → el trabajo de marketing y venta, por área (Anuncios, Landing y web,
//                Mensajes de seguimiento…). Son POCAS y grandes a propósito.
//   · CLIENTE  → si la tarea es sobre un cliente suyo, va a «Cliente: NOMBRE».
//                Lo detecta lib/reunion-cliente.ts con el CRM (el email del invitado
//                o el nombre de la empresa en el texto), no adivinando.
//
// ⚠️ Esto NO renombra lo que ya existe. Los proyectos que el cliente ya tiene siempre
// ganan: el catálogo solo aporta destinos cuando ninguno de los suyos encaja.
// =============================================================================

export type ProyectoTodo = {
  /** El nombre EXACTO con el que se crea. */
  nombre: string;
  emoji: string;
  color: string;
  /** Qué entra acá, en una línea. Es lo que lee el modelo para rutear. */
  que: string;
};

/** El prefijo de los proyectos que son un cliente. Que se lea de un vistazo qué es. */
export const PREFIJO_CLIENTE = 'Cliente: ';

export const CATALOGO_TODO: ProyectoTodo[] = [
  { nombre: 'Anuncios', emoji: '🎯', color: '#2F6FED', que: 'La publicidad paga: campañas, públicos, presupuesto, creativos que se prueban y qué hay que cambiar para que traiga más.' },
  { nombre: 'Contenido orgánico', emoji: '📸', color: '#D6489B', que: 'Lo que se publica sin pagar: reels, historias, videos, posteos y el calendario de publicación.' },
  { nombre: 'Landing y web', emoji: '🌐', color: '#7C5CFB', que: 'La página donde caen los leads: copy, estructura, formularios, el VSL y que cargue rápido.' },
  { nombre: 'Mensajes de seguimiento', emoji: '💬', color: '#C8870C', que: 'WhatsApp y email: secuencias de nutrición, plantillas, recordatorios y respuestas a los que no contestaron.' },
  { nombre: 'Llamadas y cierre', emoji: '📞', color: '#0E9B8E', que: 'La venta en sí: la agenda, los que no asisten, el guion de la llamada, las objeciones y las propuestas.' },
  { nombre: 'Oferta y precios', emoji: '🧅', color: '#D0504A', que: 'Qué se vende y a cuánto: los planes, la promesa, los bonus, la garantía y el posicionamiento.' },
  { nombre: 'Números y reportes', emoji: '📊', color: '#1E9E57', que: 'Medir: el tablero de métricas, los objetivos del mes, de dónde viene cada lead y cuánto cuesta.' },
  { nombre: 'Entrega y clientes', emoji: '🤝', color: '#0E9B8E', que: 'Después de la venta: el arranque del cliente, la entrega del servicio, la retención y los referidos.' },
  { nombre: 'Equipo y procesos', emoji: '🧰', color: '#98A0AC', que: 'Cómo trabaja el equipo: quién hace qué, capacitación, plantillas internas, herramientas y automatizaciones.' },
];

export const NOMBRES_TODO: string[] = CATALOGO_TODO.map((p) => p.nombre);

const norm = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const PORNOMBRE = new Map(CATALOGO_TODO.map((p) => [norm(p.nombre), p]));

/** ¿Este nombre es uno del catálogo del cliente? (sin acentos ni mayúsculas). */
export const delCatalogoTodo = (nombre: string): ProyectoTodo | undefined => PORNOMBRE.get(norm(nombre));

/** El catálogo como se lo pasamos a un modelo: nombre + qué entra en cada uno. */
export function catalogoTodoParaPrompt(): string {
  return `ÁREAS DEL NEGOCIO (cada una es un proyecto grande):\n${CATALOGO_TODO.map((p) => `· ${p.nombre} — ${p.que}`).join('\n')}`;
}
