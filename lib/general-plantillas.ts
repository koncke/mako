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

/** Un bloque de General como pieza de plantilla, con su tamaño de siempre (o el que se le pida) y sus opciones. */
const bloque = (pieza: PiezaGeneral, extra: { w?: number; h?: number; titulo?: string; opciones?: Record<string, string> } = {}): PiezaPlantilla => {
  const info = piezaGeneral(pieza);
  const general = extra.opciones ? { pieza, opciones: extra.opciones } : { pieza };
  return { local: pieza, elemento: { tipo: 'general', texto: extra.titulo ?? '', general, w: extra.w ?? info.w, h: extra.h ?? info.h } };
};
/** Un texto (un título grande, una línea) con variables. */
const texto = (local: string, t: string, tamano: 's' | 'm' | 'l' | 'xl' = 'l'): PiezaPlantilla =>
  ({ local, elemento: { tipo: 'texto', texto: t, tamano } });
/**
 * El título de una parte de la hoja: una SECCIÓN (lib/graficos-catalogo.ts) sin fondo ni pliegue, que es un título con
 * su línea debajo. Martín, 14/10/2026: «No tienen títulos, no tienen separaciones claras, no se entienden».
 */
const parte = (local: string, t: string): PiezaPlantilla =>
  ({ local, elemento: { tipo: 'seccion', texto: t, tamano: 'l', seccion: { fondo: null, plegable: false, abierto: true }, w: 12, h: 2 } });
/** Un número del período, comparado con el anterior. */
const numero = (local: string, fuente: string, metrica: string, titulo: string, extra: Record<string, unknown> = {}): PiezaPlantilla =>
  ({ local, tipo: 'numero', fuente, metricas: [metrica], dimension: null, titulo, comparar: true, ...extra });

/**
 * La tercera vuelta (14/10/2026). Martín, con las capturas de una hoja recién creada: «Mucho espacio en blanco en el
 * template, bloques que no se ven, los gráficos no tienen sentido... Y pusiste ese dato 2 veces en diferentes
 * gráficos... elegiste mostrar "Leads por origen" y "Pendientes del CRM" cuando hay datos mucho más interesantes que se
 * pueden mostrar, como datos de facturación, de Meta, etc... Tiene que tener criterio y preguntarse ¿Qué gráfico es el
 * más importante?», «todos nacen con bloques que ocupan todo el ancho y quedan feos... No tienen títulos, no tienen
 * separaciones claras» y «Los templates deben ser simples, mientras menos tenga y más claro esté de que trata ese
 * template, mejor». Las reglas con que se arman, y valen para la próxima:
 *   · UNA PREGUNTA POR PLANTILLA, y el nombre la dice. Pocas piezas: lo que no contesta esa pregunta no va.
 *   · CADA DATO UNA VEZ: si un bloque ya lo muestra (el mes, el funnel), no va también como gráfico.
 *   · LO MÁS IMPORTANTE ARRIBA y en número: la plata (lo cobrado y lo vendido) y lo que cuesta conseguirla (la inversión
 *     en anuncios y el costo por lead) le ganan a un desglose por origen.
 *   · DE A DOS: los bloques van en pares de media hoja con el MISMO alto (`acomodar` estira la fila al más alto, y un
 *     bloque estirado es espacio en blanco); a lo ancho sólo lo que se lee mejor así (una tabla, una serie, el mes).
 *   · TÍTULOS DE PARTE (`parte`) cuando la hoja tiene más de un tema.
 * Y la quinta vuelta (14/10/2026, Martín: «que las plantillas de GENERAL, no se parezcan tanto a un dashboard... Está bien
 * que tengan algún que otro gráfico, pero aquí en general todo tiene que ser más minimalista, textos enormes, cosas
 * grandes... Ya si quiere profundizar entra a dashboard»):
 *   · BLOQUES ANTES QUE GRÁFICOS: un bloque de General dice una cosa en grande; los gráficos quedan para lo que un bloque
 *     no tiene (los números de Meta, los alumnos), y sin tablas ni series que se leen como un Dashboard.
 */
export const DEFINICIONES_GENERAL: readonly DefinicionGeneral[] = [
  {
    // La General de siempre, y la hoja con que arranca quien nunca armó la suya: el norte arriba (la meta y la acción
    // del día, cada una su bloque), la plata del mes en números, y lo que hay que atender hoy.
    id: 'general', nombre: 'General', emoji: '🧭',
    linea: 'Tu meta, la acción del día, la plata del mes y lo que hay que atender hoy.',
    subtitulo: '', periodo: 'este_mes',
    piezas: [
      bloque('cabecera'), bloque('accion'),
      bloque('mes'),
      parte('hoy', 'Hoy'),
      bloque('llamadas'), bloque('cobranza'),
    ],
  },
  {
    id: 'bienvenida', nombre: 'Bienvenida', emoji: '👋',
    linea: 'Te saluda por tu nombre y te deja lo de hoy: qué hacer, tu día y tus compromisos.',
    subtitulo: '', periodo: 'este_mes',
    piezas: [
      texto('hola', '{{saludo}}, {{nombre}}', 'xl'),
      texto('hoy', 'Hoy es {{fecha}} · {{trimestre}}', 'm'),
      bloque('accion', { h: 8 }), bloque('agenda'),
      bloque('kpis'),
    ],
  },
  {
    id: 'foco', nombre: 'Foco de la semana', emoji: '🎯',
    linea: 'Tus OKRs y lo que hay que hacer para cumplirlos: las tareas, los deadlines y los proyectos.',
    subtitulo: '', periodo: 'este_mes',
    piezas: [
      bloque('objetivos'),
      parte('hacer', 'Lo que hay que hacer'),
      bloque('tareas'), bloque('deadlines'),
      bloque('proyectos'),
    ],
  },
  {
    // El caso de la reunión del 12/10 (el Plan, la cobranza y el CRM en la pantalla de lo que se hace hoy).
    id: 'operacion', nombre: 'Operación diaria', emoji: '⚡',
    linea: 'Las prioridades del Plan, a quién cobrarle, las llamadas y cómo está el funnel.',
    subtitulo: '', periodo: 'ult30',
    piezas: [
      bloque('prioridades'),
      parte('clientes', 'Clientes'),
      bloque('cobranza'), bloque('llamadas'),
      bloque('funnel', { w: 12, h: 6, opciones: { estilo: 'barras' } }),
    ],
  },
  {
    id: 'ventas', nombre: 'Ventas del mes', emoji: '📈',
    linea: 'El mes contra el anterior, el funnel de hoy y lo que está en rojo.',
    subtitulo: '', periodo: 'este_mes',
    piezas: [
      bloque('mes'),
      bloque('funnel', { h: 7, opciones: { estilo: 'barras' } }), bloque('semaforo', { h: 7 }),
    ],
  },
  {
    id: 'cobros', nombre: 'Cobros', emoji: '💳',
    linea: 'Lo cobrado y lo pendiente del mes, y a quién cobrarle primero.',
    subtitulo: '', periodo: 'este_mes_completo',
    piezas: [
      numero('cobrado', 'pagos', 'cobrado', 'Cobrado', { fecha: 'pago' }),
      numero('pendiente', 'pagos', 'pendiente', 'Por cobrar', { comparar: false }),
      numero('vence', 'pagos', 'monto', 'Vence en el mes', { comparar: false }),
      bloque('cobranza'),
      { local: 'semanas', tipo: 'columnas', fuente: 'pagos', dimension: 'semana', metricas: ['cobrado', 'pendiente'], titulo: 'Cobrado y por cobrar, por semana' },
    ],
  },
  {
    id: 'anuncios', nombre: 'Anuncios', emoji: '📣',
    linea: 'Cuánto inviertes en Meta, cuántos leads te trae y dónde están.',
    subtitulo: '', periodo: 'ult30',
    piezas: [
      numero('gasto', 'meta', 'gasto', 'Inversión'),
      numero('leads', 'meta', 'leads', 'Leads'),
      numero('cpl', 'meta', 'cpl', 'Costo por lead'),
      numero('ctr', 'meta', 'ctr', 'CTR'),
      bloque('funnel', { w: 12, h: 6, opciones: { estilo: 'barras' } }),
    ],
  },
  // ── Una por tipo de funnel (lo que mira cada negocio, según cómo vende) ──
  {
    id: 'funnel-llamadas', nombre: 'Funnel de llamadas', emoji: '📞',
    linea: 'Tus llamadas de la semana y cuánto agendas, asisten y cierras.',
    subtitulo: '', periodo: 'ult30',
    piezas: [
      bloque('llamadas'), bloque('agenda'),
      parte('cierre', 'Cómo cierras'),
      numero('agendas', 'leads', 'agendas', 'Agendaron'),
      numero('asistencia', 'leads', 'tasa_asistencia', 'Tasa de asistencia', { fecha: 'agenda' }),
      numero('cierre', 'leads', 'tasa_cierre', 'Tasa de cierre', { fecha: 'agenda' }),
      numero('vendido', 'leads', 'vendido', 'Vendido', { fecha: 'cierre' }),
    ],
  },
  {
    id: 'funnel-whatsapp', nombre: 'Ventas por WhatsApp', emoji: '💬',
    linea: 'Cuántos escriben, qué tan rápido respondes y cuántos compran.',
    subtitulo: '', periodo: 'ult30',
    piezas: [
      numero('chats', 'conversaciones', 'chats', 'Chats'),
      numero('sin-responder', 'conversaciones', 'sin_responder', 'Esperando respuesta', { fecha: 'actual', comparar: false }),
      numero('respuesta', 'conversaciones', 'mediana_respuesta', 'Tiempo de respuesta'),
      numero('ventas', 'leads', 'cierres', 'Ventas'),
      bloque('funnel', { h: 6, opciones: { estilo: 'barras' } }), bloque('pendientes', { h: 6 }),
    ],
  },
  {
    id: 'lanzamiento', nombre: 'Contenido y lanzamiento', emoji: '🚀',
    linea: 'Lo que publicas esta semana, y cuántos ven tu página y tu video y se registran.',
    subtitulo: '', periodo: 'ult7',
    piezas: [
      bloque('publicaciones'),
      parte('atencion', 'La atención'),
      numero('visitas', 'visitas', 'visitantes', 'Visitantes'),
      numero('play', 'vsl', 'play_rate', 'Le dan play al video'),
      numero('leads', 'leads', 'leads', 'Registros'),
      numero('gasto', 'negocio', 'gasto', 'Inversión en anuncios'),
    ],
  },
  {
    id: 'servicio', nombre: 'Agencia o servicio', emoji: '🤝',
    linea: 'Tus clientes en cada etapa de la entrega y lo que te deben.',
    subtitulo: '', periodo: 'este_mes',
    piezas: [
      numero('clientes', 'cartera', 'clientes', 'Clientes activos', { comparar: false }),
      numero('atencion', 'cartera', 'atencion', 'Piden atención', { comparar: false }),
      numero('deuda', 'cartera', 'deuda_vencida_usd', 'Deuda vencida', { comparar: false }),
      { local: 'etapas', tipo: 'barras', fuente: 'entrega', fecha: 'actual', dimension: 'etapa', metricas: ['clientes'], titulo: 'Clientes por etapa de la entrega' },
      bloque('cobranza'),
    ],
  },
  {
    id: 'curso', nombre: 'Curso o comunidad', emoji: '🎓',
    linea: 'Cuántos alumnos avanzan y qué tanto, junto a lo que vendes.',
    subtitulo: '', periodo: 'ult30',
    piezas: [
      numero('alumnos', 'avance_cursos', 'alumnos', 'Alumnos activos', { comparar: false }),
      numero('clases', 'avance_cursos', 'clases', 'Clases vistas'),
      numero('avance', 'avance_cursos', 'pct', 'Avance promedio', { comparar: false }),
      numero('ventas', 'leads', 'cierres', 'Ventas'),
      bloque('publicaciones'),
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
