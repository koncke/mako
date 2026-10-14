// =============================================================================
// general-piezas — los bloques de General que se insertan en el editor como un elemento más
// =============================================================================
// Martín, 14/10/2026: «Tenemos un constructor de landing y gráficos para poder personalizar la tab general... Que
// todo sea personalizable, intenta replicar lo que tenemos en dashboard... Los bloques también deberían ser
// editables». La tab General es desde ese día el MISMO editor que el Dashboard (app/dashboard/EditorInforme.tsx con
// `informe: 'general'`): cada hoja se arma con gráficos del catálogo, textos, imágenes, secciones… y con ESTOS
// bloques, que son los de la General de siempre (el diseño que Martín fijó el 08/09/2026: el hero oscuro con la
// acción del día, el semáforo dibujado, los KPIs que se editan en el lugar).
//
// Un bloque es un ELEMENTO (`tipo: 'general'`, lib/graficos-catalogo.ts): se mueve, se agranda, se duplica, se borra y
// se le cambia el título como cualquier otro. Lo que dibuja lo arma el server de /general (app/general/page.tsx) con
// las mismas lecturas de siempre y llega por contexto (app/dashboard/ElementoGeneral.tsx): fuera de General (en el
// Dashboard, en un link compartido) no hay de dónde sacarlo, y lo dice.
//
// Lo que se puede medir con el catálogo (cobrado, agendas, cierres, leads por etapa) va como GRÁFICO, que se edita
// entero: tipo, métricas, período y filtros. Estos bloques son lo que el catálogo no tiene (el objetivo del trimestre,
// los KPIs con su registro, el semáforo, las prioridades del Plan) o lo que General dibuja a su manera.
//
// Puro y sin imports: lo leen el catálogo, la pantalla, las plantillas y los tests.
// =============================================================================

/**
 * El catálogo, pensado desde lo que alguien quiere ver al entrar (Martín, el mismo día: «Piensa en todos los bloques que
 * un usuario, con los diferentes funnels que tenemos y en general, todo lo que un usuario podría llegar a querer ver en
 * una tab general»). Cuatro preguntas, cuatro grupos:
 *   · EL NORTE — ¿voy bien? El objetivo del trimestre con la acción del día, los objetivos, los KPIs y el semáforo.
 *   · HOY — ¿qué hago ahora? Mi día (el Calendario de hoy), las próximas llamadas, las prioridades del Plan y lo que
 *     falta marcar en el CRM. Sirve a cualquier funnel: el de llamadas vive de la agenda, el de WhatsApp de lo pendiente.
 *   · LA PLATA Y EL FUNNEL — ¿cómo viene? El funnel de hoy (cuántos hay en cada etapa), a quién cobrarle y el mes.
 *   · EL CONTENIDO — ¿qué sale esta semana? Las próximas publicaciones del Calendario.
 * El resto de lo que un negocio puede querer (anuncios, landing, VSL, WhatsApp, automatizaciones, entrega, cursos) ya
 * está en el catálogo de gráficos del Dashboard y se inserta como gráfico: las plantillas por tipo de funnel
 * (lib/general-plantillas.ts) lo combinan.
 */
export const GRUPOS_PIEZAS = ['El norte', 'Hoy', 'La plata y el funnel', 'El contenido'] as const;

export const PIEZAS_GENERAL = [
  { id: 'cabecera', grupo: 'El norte', nombre: 'Objetivo y acción del día', linea: 'El avance del trimestre y lo que conviene hacer hoy.', w: 12, h: 10 },
  { id: 'objetivos', grupo: 'El norte', nombre: 'Objetivos del trimestre', linea: 'Cada objetivo con su avance, contra el tiempo que pasó.', w: 6, h: 8 },
  { id: 'kpis', grupo: 'El norte', nombre: 'KPIs', linea: 'Los compromisos de la semana, con su registro.', w: 12, h: 10 },
  { id: 'semaforo', grupo: 'El norte', nombre: 'Semáforo del negocio', linea: 'Lo que está en rojo, en ámbar y en verde.', w: 12, h: 10 },
  { id: 'agenda', grupo: 'Hoy', nombre: 'Mi día', linea: 'Lo de hoy en el Calendario: llamadas, bloques, publicaciones y tu Google.', w: 6, h: 9 },
  { id: 'llamadas', grupo: 'Hoy', nombre: 'Próximas llamadas', linea: 'Las reuniones del CRM de los próximos 7 días, con su closer.', w: 6, h: 9 },
  { id: 'prioridades', grupo: 'Hoy', nombre: 'Prioridades del Plan', linea: 'Las tareas que más mueven el objetivo.', w: 6, h: 10 },
  { id: 'pendientes', grupo: 'Hoy', nombre: 'Pendientes del CRM', linea: 'Los leads que falta marcar.', w: 12, h: 7 },
  { id: 'funnel', grupo: 'La plata y el funnel', nombre: 'Tu funnel hoy', linea: 'Cuántos leads hay ahora en cada etapa de tu funnel.', w: 12, h: 7, porFunnel: true },
  { id: 'cobranza', grupo: 'La plata y el funnel', nombre: 'A quién cobrarle', linea: 'La próxima cuota de cada cliente, con «Marcar cobrada».', w: 6, h: 10, porFunnel: true },
  { id: 'mes', grupo: 'La plata y el funnel', nombre: 'El mes', linea: 'Ad Spend, agendas, cierres y lo cobrado contra el mes anterior.', w: 12, h: 8 },
  { id: 'publicaciones', grupo: 'El contenido', nombre: 'Próximas publicaciones', linea: 'Lo que tienes planeado publicar en los próximos 7 días.', w: 6, h: 8 },
] as const;

export type PiezaGeneral = (typeof PIEZAS_GENERAL)[number]['id'];

export const esPiezaGeneral = (x: unknown): x is PiezaGeneral => PIEZAS_GENERAL.some((p) => p.id === x);
export const piezaGeneral = (id: PiezaGeneral) => PIEZAS_GENERAL.find((p) => p.id === id)!;

/**
 * Los bloques que se atan a UN funnel (el pedido del 13/10: «e incluso asignarles ofertas y/o funnels»). Sin funnel
 * elegido, «Tu funnel hoy» cuenta el principal y «A quién cobrarle» todo el negocio. El resto mide el negocio entero.
 */
export const piezaPorFunnel = (id: PiezaGeneral): boolean => 'porFunnel' in piezaGeneral(id);
/** Cómo se llama un bloque ya dibujado en el contexto de /general: la pieza, y el funnel si eligió uno. */
export const clavePieza = (pieza: PiezaGeneral, funnel?: number | null): string => (funnel ? `${pieza}:${funnel}` : pieza);

// ── Las variables de un Texto ────────────────────────────────────────────────────────────────────────────────────

/**
 * Lo que un Texto puede nombrar entre llaves dobles («{{saludo}}, {{nombre}}»): la plantilla «Bienvenida» de General
 * (Martín: «Me imagino una que diga "Bienvenido NOMBRE..."»). Se resuelve AL DIBUJAR, nunca se guarda resuelto: el
 * mismo texto le dice su nombre a cada persona que abre la hoja. Editando se ve el texto con sus llaves.
 */
export const VARIABLES_TEXTO = [
  { id: 'saludo', nombre: 'Saludo', ejemplo: 'Buenos días' },
  { id: 'nombre', nombre: 'Tu nombre', ejemplo: 'Ana' },
  { id: 'negocio', nombre: 'El negocio', ejemplo: 'Tu negocio' },
  { id: 'fecha', nombre: 'La fecha de hoy', ejemplo: 'miércoles 14 de octubre' },
  { id: 'trimestre', nombre: 'El trimestre', ejemplo: 'Q4 2026' },
] as const;
export type VariableTexto = (typeof VARIABLES_TEXTO)[number]['id'];
export type ValoresVariables = Partial<Record<VariableTexto, string>>;

/**
 * Reemplaza las variables que tienen valor. Las que no (fuera de General, o sin dato) quedan como están: crudo se
 * nota y se arregla; borrado deja la frase coja sin que nadie se entere.
 */
export function conVariables(texto: string, valores: ValoresVariables | null | undefined): string {
  if (!valores) return texto;
  return texto.replace(/\{\{\s*([a-z]+)\s*\}\}/g, (todo, k: string) => {
    const v = (valores as Record<string, string | undefined>)[k];
    return typeof v === 'string' && v ? v : todo;
  });
}

/** El saludo de la hora (en la zona del negocio): «Buenos días» hasta las 12, «Buenas tardes» hasta las 20. */
export function saludoDeHora(hora: number): string {
  return hora < 12 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';
}
