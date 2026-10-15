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
import { conPortada, type DefinicionPortada } from './graficos-portadas';
import { COLOR_GENERAL } from './graficos-identidad';

/** Un bloque de General como pieza de plantilla, con su tamaño de siempre (o el que se le pida) y sus opciones. */
const bloque = (pieza: PiezaGeneral, extra: { w?: number; h?: number; titulo?: string; opciones?: Record<string, string> } = {}): PiezaPlantilla => {
  const info = piezaGeneral(pieza);
  const general = extra.opciones ? { pieza, opciones: extra.opciones } : { pieza };
  return { local: pieza, elemento: { tipo: 'general', texto: extra.titulo ?? '', general, w: extra.w ?? info.w, h: extra.h ?? info.h } };
};
/**
 * El título de una parte de la hoja: una SECCIÓN (lib/graficos-catalogo.ts) sin fondo ni pliegue, que es un título con
 * su línea debajo. Martín, 14/10/2026: «No tienen títulos, no tienen separaciones claras, no se entienden».
 */
const parte = (local: string, t: string): PiezaPlantilla =>
  ({ local, elemento: { tipo: 'seccion', texto: t, tamano: 'l', seccion: { fondo: null, plegable: false, abierto: true }, w: 12, h: 1 } });
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
 *   · CON EL TEMA «General» (lib/graficos-temas.ts): tarjetas que flotan sin borde ni filete, el título y el número más
 *     grandes y la etiqueta en la letra de la hoja. Es lo que hace que la hoja se lea como la tab General y no como el
 *     Dashboard aunque traiga un número del catálogo; el tema se cambia como en cualquier hoja.
 * Y la séptima, ÉPICA (14/10/2026, Martín: «Lo mismo que hicimos en mobile, que sea EPICO la vista General... pocas
 * cosas, textos gigantes, bloques grandes»):
 *   · TRES NÚMEROS COMO MUCHO por plantilla (eran cuatro): cuatro de 3 columnas son la fila de un Dashboard.
 *   · LOS NÚMEROS MÁS ALTOS (`ALTO_NUMERO`, `conNumerosAltos`): a 3 filas la escala épica del número (lib/graficos-gordo.ts)
 *     se queda sin alto y el número sale como antes.
 *   · LAS PARTES («Hoy», «Clientes») PEGADAS a lo suyo: una fila de alto, no dos (eran un hueco del alto de una tarjeta).
 *   · LA BIENVENIDA ES EL SALUDO solo: la línea de la fecha era la segunda línea que el teléfono saca.
 */
const TEMA = 'general';
/** Lo que define a los números de la plantilla Instagram: la audiencia de Meta sólo de Instagram (un filtro FIJO). */
const SOLO_INSTAGRAM = { tipo: 'lista', campo: 'audiencia.plataforma', valores: ['Instagram'], fijo: true };

export const DEFINICIONES_GENERAL: readonly DefinicionGeneral[] = [
  {
    // La General de siempre, y la hoja con que arranca quien nunca armó la suya: el norte arriba (la meta y la acción
    // del día, cada una su bloque), la plata del mes en números, y lo que hay que atender hoy.
    id: 'general', nombre: 'General', emoji: '🧭',
    linea: 'Tu meta, la acción del día, la plata del mes y lo que hay que atender hoy.',
    subtitulo: '', tema: TEMA, periodo: 'este_mes',
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
    subtitulo: '', tema: TEMA, periodo: 'este_mes',
    // Desde el 15/10/2026 el saludo es el TITULAR de la portada (la acción del día, `PORTADAS_GENERAL`), no un texto aparte.
    piezas: [
      bloque('accion', { w: 12, h: 8, titulo: '{{saludo}}, {{nombre}}' }),
      bloque('agenda', { h: 8 }), bloque('kpis', { w: 6, h: 8 }),
    ],
  },
  {
    id: 'foco', nombre: 'Foco de la semana', emoji: '🎯',
    linea: 'Tus OKRs y lo que hay que hacer para cumplirlos: las tareas, los deadlines y los proyectos.',
    subtitulo: '', tema: TEMA, periodo: 'este_mes',
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
    subtitulo: '', tema: TEMA, periodo: 'ult30',
    piezas: [
      bloque('prioridades'),
      parte('clientes', 'Clientes'),
      bloque('cobranza'), bloque('llamadas'),
      bloque('funnel', { w: 12, h: 7, opciones: { estilo: 'barras' } }),
    ],
  },
  {
    id: 'ventas', nombre: 'Ventas del mes', emoji: '📈',
    linea: 'El mes contra el anterior, el funnel de hoy y lo que está en rojo.',
    subtitulo: '', tema: TEMA, periodo: 'este_mes',
    piezas: [
      bloque('mes'),
      bloque('funnel', { h: 7, opciones: { estilo: 'barras' } }), bloque('semaforo', { h: 7 }),
    ],
  },
  {
    id: 'cobros', nombre: 'Cobros', emoji: '💳',
    linea: 'Lo cobrado y lo pendiente del mes, y a quién cobrarle primero.',
    subtitulo: '', tema: TEMA, periodo: 'este_mes_completo',
    piezas: [
      numero('cobrado', 'pagos', 'cobrado', 'Cobrado', { fecha: 'pago' }),
      numero('pendiente', 'pagos', 'pendiente', 'Por cobrar', { comparar: false }),
      numero('vence', 'pagos', 'monto', 'Vence en el mes', { comparar: false }),
      // Sin las columnas por semana (la quinta vuelta: «que no se parezcan tanto a un dashboard»): los tres números y la
      // lista de a quién cobrarle, a lo ancho.
      bloque('cobranza', { w: 12, h: 8 }),
    ],
  },
  {
    id: 'anuncios', nombre: 'Anuncios', emoji: '📣',
    linea: 'Cuánto inviertes en Meta, cuántos leads te trae y a qué costo.',
    subtitulo: '', tema: TEMA, periodo: 'ult30',
    piezas: [
      numero('gasto', 'meta', 'gasto', 'Inversión'),
      numero('leads', 'meta', 'leads', 'Leads'),
      numero('cpl', 'meta', 'cpl', 'Costo por lead'),
      bloque('funnel', { w: 12, h: 7, opciones: { estilo: 'barras' } }),
    ],
  },
  // ── Una por tipo de funnel (lo que mira cada negocio, según cómo vende) ──
  {
    id: 'funnel-llamadas', nombre: 'Funnel de llamadas', emoji: '📞',
    linea: 'Tus llamadas de la semana y cuánto agendas, asisten y cierras.',
    subtitulo: '', tema: TEMA, periodo: 'ult30',
    piezas: [
      bloque('llamadas'), bloque('agenda'),
      parte('cierre', 'Cómo cierras'),
      numero('asistencia', 'leads', 'tasa_asistencia', 'Tasa de asistencia', { fecha: 'agenda' }),
      numero('cierre', 'leads', 'tasa_cierre', 'Tasa de cierre', { fecha: 'agenda' }),
      numero('vendido', 'leads', 'vendido', 'Vendido', { fecha: 'cierre' }),
    ],
  },
  {
    id: 'funnel-whatsapp', nombre: 'Ventas por WhatsApp', emoji: '💬',
    linea: 'Cuántos escriben, qué tan rápido respondes y cuántos compran.',
    subtitulo: '', tema: TEMA, periodo: 'ult30',
    piezas: [
      numero('sin-responder', 'conversaciones', 'sin_responder', 'Esperando respuesta', { fecha: 'actual', comparar: false }),
      numero('respuesta', 'conversaciones', 'mediana_respuesta', 'Tiempo de respuesta'),
      numero('ventas', 'leads', 'cierres', 'Ventas'),
      bloque('funnel', { h: 7, opciones: { estilo: 'barras' } }), bloque('pendientes', { h: 7 }),
    ],
  },
  {
    id: 'lanzamiento', nombre: 'Contenido y lanzamiento', emoji: '🚀',
    linea: 'Lo que publicas esta semana, y cuántos ven tu página y tu video y se registran.',
    subtitulo: '', tema: TEMA, periodo: 'ult7',
    piezas: [
      bloque('publicaciones'),
      parte('atencion', 'La atención'),
      numero('visitas', 'visitas', 'visitantes', 'Visitantes'),
      numero('play', 'vsl', 'play_rate', 'Le dan play al video'),
      numero('leads', 'leads', 'leads', 'Registros'),
    ],
  },
  {
    id: 'servicio', nombre: 'Agencia o servicio', emoji: '🤝',
    linea: 'Tus clientes en cada etapa de la entrega y lo que te deben.',
    subtitulo: '', tema: TEMA, periodo: 'este_mes',
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
    subtitulo: '', tema: TEMA, periodo: 'ult30',
    piezas: [
      numero('alumnos', 'avance_cursos', 'alumnos', 'Alumnos activos', { comparar: false }),
      numero('avance', 'avance_cursos', 'pct', 'Avance promedio', { comparar: false }),
      numero('ventas', 'leads', 'cierres', 'Ventas'),
      bloque('publicaciones'),
    ],
  },
  {
    // 15/10/2026 (Martín: «faltaría uno para Instagram»). Medido en la base ANTES de armarla: ningún lead dice «Instagram»
    // en su origen (el 1.062 que se había contado era `instant_form`, los formularios de Meta, que son de Facebook O de
    // Instagram), y ningún negocio tiene los DM conectados. Lo que sí hay, para cada negocio con Meta, es la AUDIENCIA por
    // plataforma (lib/graficos-audiencia.ts): cuánto te ven, cuántos tocan y cuántos agendan desde Instagram.
    id: 'instagram', nombre: 'Instagram', emoji: '📸',
    linea: 'Lo que te trae Instagram contra Facebook: cuántos te ven, cuántos tocan y cuántos agendan.',
    subtitulo: '', tema: TEMA, periodo: 'ult30',
    piezas: [
      { local: 'plataformas', tipo: 'anillo', fuente: 'audiencia', dimension: 'plataforma', metricas: ['agendas'], titulo: 'Lo que te trae Instagram' },
      numero('vistas', 'audiencia', 'impresiones', 'Te vieron en Instagram', { comparar: false, controles: [SOLO_INSTAGRAM] }),
      numero('clics', 'audiencia', 'clics', 'Tocaron tu anuncio', { comparar: false, controles: [SOLO_INSTAGRAM] }),
      numero('agendas', 'audiencia', 'agendas', 'Agendaron desde Instagram', { comparar: false, controles: [SOLO_INSTAGRAM] }),
    ],
  },
];

/** Cuántas filas mide un número del catálogo en una plantilla de General (el del catálogo mide 3). */
export const ALTO_NUMERO = 5;

type Pieza = { clase?: unknown; tipo?: unknown; x: number; y: number; w: number; h: number };

/**
 * La hoja con sus números más altos: cada fila que es SÓLO de números del catálogo pasa a `ALTO_NUMERO` filas, y lo de
 * abajo baja lo que ella creció. El lugar lo pone `acomodar` (lib/graficos-ia.ts), que no sabe de General; acá sólo se
 * estira, así nada se pisa (las filas de `acomodar` no se cruzan).
 */
export function conNumerosAltos<T extends { componentes?: unknown }>(hoja: T): T {
  const cs = Array.isArray(hoja.componentes) ? (hoja.componentes as Pieza[]) : null;
  if (!cs) return hoja;
  const filas = [...new Set(cs.map((c) => c.y))].sort((a, b) => a - b);
  const baja = new Map<number, number>();
  let corrido = 0;
  const alto = new Map<number, number>();
  for (const y of filas) {
    baja.set(y, corrido);
    const fila = cs.filter((c) => c.y === y);
    const soloNumeros = fila.every((c) => c.clase === 'grafico' && c.tipo === 'numero');
    const h = Math.max(...fila.map((c) => c.h));
    if (soloNumeros && h < ALTO_NUMERO) { alto.set(y, ALTO_NUMERO); corrido += ALTO_NUMERO - h; }
  }
  const componentes = cs.map((c) => ({ ...c, y: c.y + (baja.get(c.y) ?? 0), h: alto.get(c.y) ?? c.h }));
  return { ...hoja, componentes };
}

/**
 * LAS PORTADAS de General (15/10/2026, lib/graficos-portadas.ts y lib/graficos-identidad.ts). General es lo que se HACE
 * hoy: arriba va UNA cosa para hacer o UNA cosa que mirar, no un análisis. Lo que contesta cada una:
 *   · General — ¿llego a la meta? La meta con su anillo.
 *   · Bienvenida — ¿qué hago hoy? «Buenos días, Ana» y la acción del día.
 *   · Foco de la semana — ¿avanzo en mis OKRs? Un anillo por OKR.
 *   · Operación diaria — ¿qué hago primero? La tarea #1 del Plan, sola.
 *   · Ventas del mes — ¿cuánto vendí? Lo vendido, gigante, contra el mes anterior.
 *   · Cobros — ¿a quién le cobro? La lista con «Marcar cobrada».
 *   · Anuncios — ¿qué anuncio funciona? Los ganadores como pósters, con su miniatura.
 *   · Funnel de llamadas — ¿con quién hablo? Las próximas llamadas.
 *   · Ventas por WhatsApp — ¿quién me espera? Los chats sin responder, en la burbuja.
 *   · Contenido y lanzamiento — ¿me miran? Cuántos le dan play, con el ▶.
 *   · Agencia o servicio — ¿a quién atiendo? Las personas que piden atención.
 *   · Curso o comunidad — ¿avanzan? El avance de los alumnos, como una barra hacia el 100 %.
 *   · Instagram — ¿qué me trae? Instagram contra Facebook, en agendas.
 */
export const PORTADAS_GENERAL: Readonly<Record<string, DefinicionPortada>> = {
  general: { sube: 'cabecera' },
  bienvenida: { sube: 'accion' },
  foco: { sube: 'objetivos' },
  operacion: { sube: 'prioridades', cambios: { general: { pieza: 'prioridades', opciones: { cuantas: '1', objetivo: 'no' } }, texto: 'Lo primero de hoy' } },
  ventas: {
    nueva: (id) => ({ id: id('ventas-portada'), clase: 'grafico', tipo: 'numero', fuente: 'leads', fecha: 'cierre', metricas: ['vendido'], dimension: null, comparar: true, titulo: 'Lo que vendiste este mes' }),
  },
  cobros: { sube: 'cobranza', cambios: { texto: 'A quién cobrarle hoy' } },
  anuncios: {
    nueva: (id) => ({
      id: id('anuncios-portada'), clase: 'grafico', tipo: 'tarjetas', fuente: 'meta', dimension: 'anuncio', metricas: ['leads', 'cpl'],
      ordenMetrica: 'leads', barra: 'leads', limite: 3, titulo: 'Los anuncios que más te traen',
    }),
  },
  'funnel-llamadas': { sube: 'llamadas', cambios: { texto: 'Con quién hablas' } },
  'funnel-whatsapp': { sube: 'sin-responder', cambios: { titulo: 'Te están esperando en WhatsApp' } },
  lanzamiento: { sube: 'play', cambios: { tipo: 'indicador', maximo: 100, titulo: 'Le dan play a tu video' } },
  servicio: {
    nueva: (id) => ({
      id: id('servicio-portada'), clase: 'grafico', tipo: 'tarjetas', fuente: 'cartera', dimension: 'cliente', metricas: ['atencion', 'deuda_vencida_usd', 'sesiones'],
      ordenMetrica: 'atencion', barra: 'deuda_vencida_usd', limite: 3, tabla: { columnas: ['senal', 'tramo_contacto'] }, titulo: 'Quién te necesita hoy',
    }),
  },
  curso: { sube: 'avance', cambios: { tipo: 'bala', metricas: ['avance'], maximo: 100, titulo: 'Cuánto avanzan tus alumnos' } },
  instagram: { sube: 'plataformas' },
};

/** La galería de General, en orden. «Hoja en blanco» va primera siempre (la pone el modal). */
export const PLANTILLAS_GENERAL: readonly PlantillaHoja[] = DEFINICIONES_GENERAL.map(plantilla)
  .map((p) => ({ ...p, armar: (id: (local: string) => string) => conPortada(conNumerosAltos(p.armar(id)), PORTADAS_GENERAL[p.id], COLOR_GENERAL[p.id], id) }));

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
