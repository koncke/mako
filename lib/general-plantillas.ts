// =============================================================================
// general-plantillas — la galería de «Nueva hoja» de la tab General, y el informe con que arranca
// =============================================================================
// Martín, 14/10/2026: «Teniendo eso en cuenta, también crea templates... Me imagino una que diga "Bienvenido
// NOMBRE..."». General es el editor del Dashboard con otro objetivo («aquí no hace falta tantos gráficos»): lo que se
// HACE hoy. Por eso sus plantillas son pocas y mezclan los bloques de General (lib/general-piezas.ts) con algunos
// gráficos del catálogo, y la primera de todas es la General de siempre, que es también la hoja con que arranca quien
// nunca armó la suya (el diseño que Martín fijó el 08/09/2026: no se le muestra una pantalla en blanco).
//
// Se escriben con el MISMO armador que las del Dashboard (`plantilla`, lib/graficos-plantillas-generales.ts): los
// gráficos en la forma de la IA, los títulos como `seccion`, y los bloques y los textos con variables como `elemento`.
// ⚠️ SIN DATOS DE NINGÚN CLIENTE: los títulos nombran métricas, nunca un negocio ni una persona (el nombre de quien
//    mira lo pone la variable {{nombre}}, al dibujar).
//
// Puro y sin server-only: lo leen la pantalla, la ruta de las plantillas, el almacenamiento y los tests.
// =============================================================================

import { sanearHoja, type Hoja, type Tablero } from './graficos-catalogo';
import { plantilla, type DefinicionGeneral, type PiezaPlantilla } from './graficos-plantillas-generales';
import type { PlantillaHoja } from './graficos-plantillas';
import { piezaGeneral, type PiezaGeneral } from './general-piezas';

/** Un bloque de General como pieza de plantilla, con su tamaño de siempre (o el que se le pida). */
const bloque = (pieza: PiezaGeneral, extra: { w?: number; h?: number; titulo?: string } = {}): PiezaPlantilla => {
  const info = piezaGeneral(pieza);
  return { local: pieza, elemento: { tipo: 'general', texto: extra.titulo ?? '', general: { pieza }, w: extra.w ?? info.w, h: extra.h ?? info.h } };
};
/** Un texto (un título grande, una línea) con variables. */
const texto = (local: string, t: string, tamano: 's' | 'm' | 'l' | 'xl' = 'l'): PiezaPlantilla =>
  ({ local, elemento: { tipo: 'texto', texto: t, tamano } });

export const DEFINICIONES_GENERAL: readonly DefinicionGeneral[] = [
  {
    // La General de siempre: el objetivo y la acción del día arriba, después el compromiso (los KPIs y la cobranza),
    // el diagnóstico (el semáforo) y la consecuencia (el mes y los pendientes). Es el orden que pensó Martín.
    id: 'general', nombre: 'General', emoji: '🧭',
    linea: 'El objetivo del trimestre, la acción del día, los KPIs, el semáforo y el mes.',
    subtitulo: '', periodo: 'este_mes',
    piezas: [bloque('cabecera'), bloque('kpis'), bloque('cobranza', { w: 12 }), bloque('semaforo'), bloque('mes'), bloque('pendientes')],
  },
  {
    id: 'bienvenida', nombre: 'Bienvenida', emoji: '👋',
    linea: 'Te saluda por tu nombre y te deja a mano lo de hoy: el objetivo, las prioridades y a quién cobrarle.',
    subtitulo: '', periodo: 'este_mes',
    piezas: [
      texto('hola', '{{saludo}}, {{nombre}}', 'xl'),
      texto('hoy', 'Hoy es {{fecha}} · {{trimestre}}', 'm'),
      bloque('cabecera'),
      bloque('prioridades'), bloque('cobranza'),
      bloque('kpis'),
    ],
  },
  {
    // El caso de Mauricio (reunión del 12/10: el Plan, la cobranza y el CRM en la pantalla de lo que se hace hoy).
    id: 'operacion', nombre: 'Operación diaria', emoji: '⚡',
    linea: 'Las prioridades del Plan, a quién cobrarle y cómo viene el CRM.',
    subtitulo: 'Lo que se hace hoy.', periodo: 'ult30',
    piezas: [
      bloque('prioridades'), bloque('cobranza'),
      { local: 'leads', tipo: 'numero', fuente: 'leads', metricas: ['leads'], dimension: null, titulo: 'Leads nuevos', comparar: true },
      { local: 'agendas', tipo: 'numero', fuente: 'leads', metricas: ['agendas'], dimension: null, titulo: 'Agendaron' },
      { local: 'cierres', tipo: 'numero', fuente: 'leads', metricas: ['cierres'], dimension: null, titulo: 'Cierres' },
      { local: 'tasa', tipo: 'numero', fuente: 'leads', metricas: ['tasa_cierre'], dimension: null, titulo: 'Tasa de cierre' },
      { local: 'etapas', tipo: 'barras', fuente: 'leads', dimension: 'etapa', metricas: ['leads'], titulo: 'Leads por etapa' },
      bloque('pendientes'),
    ],
  },
  {
    id: 'cobros', nombre: 'Cobros', emoji: '💳',
    linea: 'Lo cobrado y lo pendiente del mes, y a quién cobrarle primero.',
    subtitulo: 'Las cuotas de tus clientes.', periodo: 'este_mes_completo',
    piezas: [
      { local: 'cobrado', tipo: 'numero', fuente: 'pagos', fecha: 'pago', metricas: ['cobrado'], dimension: null, titulo: 'Cobrado', comparar: true },
      { local: 'pendiente', tipo: 'numero', fuente: 'pagos', metricas: ['pendiente'], dimension: null, titulo: 'Pendiente' },
      { local: 'vence', tipo: 'numero', fuente: 'pagos', metricas: ['monto'], dimension: null, titulo: 'Vence en el período' },
      bloque('cobranza', { w: 12 }),
      { local: 'semanas', tipo: 'columnas', fuente: 'pagos', dimension: 'semana', metricas: ['cobrado', 'pendiente'], titulo: 'Cobrado y pendiente por semana' },
    ],
  },
  {
    id: 'foco', nombre: 'Foco de la semana', emoji: '🎯',
    linea: 'Tus OKRs, las prioridades y los proyectos del Plan, los KPIs y lo que está en rojo.',
    subtitulo: '', periodo: 'este_mes',
    piezas: [bloque('objetivos'), bloque('prioridades'), bloque('proyectos'), bloque('kpis'), bloque('semaforo')],
  },
  // ── Una por tipo de funnel (lo que mira cada negocio, según cómo vende) ──
  {
    id: 'funnel-llamadas', nombre: 'Funnel de llamadas', emoji: '📞',
    linea: 'Anuncio, landing o VSL, agenda y llamada: tus llamadas, el funnel y cuánto cierras.',
    subtitulo: 'Del anuncio al cierre.', periodo: 'ult30',
    piezas: [
      bloque('llamadas'), bloque('agenda'),
      { local: 'cpl', tipo: 'numero', fuente: 'negocio', metricas: ['cpl'], dimension: null, titulo: 'Costo por lead' },
      { local: 'agendas', tipo: 'numero', fuente: 'leads', metricas: ['agendas'], dimension: null, titulo: 'Agendaron', comparar: true },
      { local: 'asistencia', tipo: 'numero', fuente: 'leads', fecha: 'agenda', metricas: ['tasa_asistencia'], dimension: null, titulo: 'Tasa de asistencia' },
      { local: 'cierre', tipo: 'numero', fuente: 'leads', fecha: 'agenda', metricas: ['tasa_cierre'], dimension: null, titulo: 'Tasa de cierre' },
      bloque('funnel'),
      { local: 'closers', tipo: 'tabla_barras', fuente: 'llamadas_venta', dimension: 'closer', metricas: ['llamadas', 'ganadas', 'tasa_cierre', 'puntaje'], titulo: 'Tus closers' },
      bloque('cobranza', { w: 12 }),
    ],
  },
  {
    id: 'funnel-whatsapp', nombre: 'Ventas por WhatsApp', emoji: '💬',
    linea: 'El anuncio lleva al chat: cuántos escriben, qué tan rápido respondes y cuántos compran.',
    subtitulo: 'Del chat a la venta.', periodo: 'ult30',
    piezas: [
      { local: 'chats', tipo: 'numero', fuente: 'conversaciones', metricas: ['chats'], dimension: null, titulo: 'Chats', comparar: true },
      { local: 'sin-responder', tipo: 'numero', fuente: 'conversaciones', fecha: 'actual', metricas: ['sin_responder'], dimension: null, titulo: 'Sin responder' },
      { local: 'respuesta', tipo: 'numero', fuente: 'conversaciones', metricas: ['mediana_respuesta'], dimension: null, titulo: 'Tiempo de respuesta' },
      { local: 'cierres', tipo: 'numero', fuente: 'leads', metricas: ['cierres'], dimension: null, titulo: 'Ventas', comparar: true },
      bloque('pendientes'),
      bloque('funnel'),
      { local: 'por-dia', tipo: 'serie', fuente: 'whatsapp', dimension: 'dia', metricas: ['recibidos', 'enviados'], titulo: 'Mensajes por día' },
      { local: 'setters', tipo: 'tabla_barras', fuente: 'conversaciones', dimension: 'setter', metricas: ['chats', 'pct_rapidos', 'mediana_respuesta'], titulo: 'Tu equipo en el chat' },
    ],
  },
  {
    id: 'lanzamiento', nombre: 'Contenido y lanzamiento', emoji: '🚀',
    linea: 'Lo que publicas esta semana, quién ve tu página y tu video, y cuántos se registran.',
    subtitulo: 'La atención, antes de la venta.', periodo: 'ult7',
    piezas: [
      bloque('publicaciones'), bloque('agenda'),
      { local: 'visitas', tipo: 'numero', fuente: 'visitas', metricas: ['visitantes'], dimension: null, titulo: 'Visitantes', comparar: true },
      { local: 'play', tipo: 'numero', fuente: 'vsl', metricas: ['play_rate'], dimension: null, titulo: 'Le dan play al video' },
      { local: 'leads', tipo: 'numero', fuente: 'leads', metricas: ['leads'], dimension: null, titulo: 'Registros', comparar: true },
      { local: 'gasto', tipo: 'numero', fuente: 'negocio', metricas: ['gasto'], dimension: null, titulo: 'Inversión en anuncios' },
      { local: 'origen', tipo: 'tabla_barras', fuente: 'visitas', dimension: 'origen', metricas: ['visitantes'], titulo: 'De dónde llegan' },
    ],
  },
  {
    id: 'servicio', nombre: 'Agencia o servicio', emoji: '🤝',
    linea: 'Tus clientes en cada etapa de la entrega, las sesiones de la semana y lo que te deben.',
    subtitulo: 'La entrega y la cartera.', periodo: 'este_mes',
    piezas: [
      bloque('agenda'), bloque('llamadas'),
      { local: 'clientes', tipo: 'numero', fuente: 'cartera', metricas: ['clientes'], dimension: null, titulo: 'Clientes activos' },
      { local: 'atencion', tipo: 'numero', fuente: 'cartera', metricas: ['atencion'], dimension: null, titulo: 'Piden atención' },
      { local: 'deuda', tipo: 'numero', fuente: 'cartera', metricas: ['deuda_vencida_usd'], dimension: null, titulo: 'Deuda vencida' },
      { local: 'etapas', tipo: 'barras', fuente: 'entrega', fecha: 'actual', dimension: 'etapa', metricas: ['clientes'], titulo: 'Clientes por etapa de la entrega' },
      bloque('cobranza', { w: 12 }),
    ],
  },
  {
    id: 'curso', nombre: 'Curso o comunidad', emoji: '🎓',
    linea: 'Cuántos alumnos avanzan, qué tanto y quién se quedó, junto a lo que vendes.',
    subtitulo: 'Tus alumnos.', periodo: 'ult30',
    piezas: [
      { local: 'alumnos', tipo: 'numero', fuente: 'avance_cursos', metricas: ['alumnos'], dimension: null, titulo: 'Alumnos activos' },
      { local: 'clases', tipo: 'numero', fuente: 'avance_cursos', metricas: ['clases'], dimension: null, titulo: 'Clases vistas', comparar: true },
      { local: 'avance', tipo: 'numero', fuente: 'avance_cursos', metricas: ['pct'], dimension: null, titulo: 'Avance promedio' },
      { local: 'ventas', tipo: 'numero', fuente: 'leads', metricas: ['cierres'], dimension: null, titulo: 'Ventas', comparar: true },
      { local: 'por-dia', tipo: 'serie', fuente: 'avance_cursos', dimension: 'dia', metricas: ['clases'], titulo: 'Clases vistas por día' },
      bloque('publicaciones'), bloque('cobranza'),
    ],
  },
  {
    id: 'ventas', nombre: 'Ventas del mes', emoji: '📈',
    linea: 'Leads, agendas, cierres y lo cobrado, contra el mes anterior.',
    subtitulo: 'El mes, comparado.', periodo: 'este_mes',
    piezas: [
      { local: 'leads', tipo: 'numero', fuente: 'leads', metricas: ['leads'], dimension: null, titulo: 'Leads', comparar: true },
      { local: 'agendas', tipo: 'numero', fuente: 'leads', metricas: ['agendas'], dimension: null, titulo: 'Agendas', comparar: true },
      { local: 'cierres', tipo: 'numero', fuente: 'leads', metricas: ['cierres'], dimension: null, titulo: 'Cierres', comparar: true },
      { local: 'cobrado', tipo: 'numero', fuente: 'pagos', fecha: 'pago', metricas: ['cobrado'], dimension: null, titulo: 'Cobrado', comparar: true },
      bloque('mes'),
      { local: 'origen', tipo: 'tabla_barras', fuente: 'leads', dimension: 'origen', metricas: ['leads', 'agendas', 'cierres', 'tasa_cierre'], titulo: 'De dónde vienen' },
    ],
  },
];

/** La galería de General, en orden. «Hoja en blanco» va primera siempre (la pone el modal). */
export const PLANTILLAS_GENERAL: readonly PlantillaHoja[] = DEFINICIONES_GENERAL.map(plantilla);

/** Lo que /general tiene de propio en la galería (la de su «Nueva hoja»): éstas, nunca las del Dashboard. */
export const esPlantillaGeneral = (id: string): boolean => PLANTILLAS_GENERAL.some((p) => p.id === id);

// ── De quién es el informe (la API de MaKo) ────────────────────────────────────────────────────────────────────────

/** Una persona admin de la cuenta: el informe de General es POR PERSONA. */
export type PersonaGeneral = { sub: string; email: string; nombre: string };

const normalizarTexto = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * De quién es el informe que pide la API: la persona que se nombra (email o nombre), o la única persona admin. Dos
 * personas con el mismo nombre: se pide el email. (Era `elegirPersonaVista` de las vistas del 13/10, la misma regla.)
 */
export function elegirPersona(admins: readonly PersonaGeneral[], pedido: string | null | undefined): { ok: true; persona: PersonaGeneral } | { ok: false; error: string } {
  const p = (pedido ?? '').trim();
  if (p) {
    const n = normalizarTexto(p);
    const calza = p.includes('@')
      ? (x: PersonaGeneral) => normalizarTexto(x.email) === n
      : (x: PersonaGeneral) => !!x.nombre && normalizarTexto(x.nombre) === n;
    const hay = admins.filter(calza);
    if (hay.length > 1) return { ok: false, error: `Hay ${hay.length} personas que se llaman «${p}»: nómbrala con su email.` };
    if (!hay.length) return { ok: false, error: `No encontré a «${p}» entre las personas admin de la cuenta (General es sólo del admin).` };
    return { ok: true, persona: hay[0] };
  }
  if (admins.length === 1) return { ok: true, persona: admins[0] };
  return { ok: false, error: admins.length ? `La cuenta tiene ${admins.length} personas admin: di de quién es (su email).` : 'La cuenta no tiene una persona admin con cuenta en MaKo.' };
}

/** El nombre del informe de General. */
export const NOMBRE_INFORME_GENERAL = 'General';

/**
 * El informe de quien nunca armó el suyo: UNA hoja, la General de siempre, con ids FIJOS (así la pantalla lo pide igual
 * cada vez y el primer cambio lo guarda tal cual). No se guarda al abrir: mirar no escribe.
 */
export function informeGeneralInicial(): Tablero {
  const p = PLANTILLAS_GENERAL[0];
  const hoja = sanearHoja({ ...p.armar((local) => local), plantilla: p.id }, 0) as Hoja;
  return { v: 3, nombre: NOMBRE_INFORME_GENERAL, hojas: [hoja] };
}
