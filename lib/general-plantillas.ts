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
import { comoDenso, type DefinicionPortada } from './graficos-portadas';

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
/** Un número del período, comparado con el anterior y con su línea. */
const numero = (local: string, fuente: string, metrica: string, titulo: string, extra: Record<string, unknown> = {}): PiezaPlantilla =>
  ({ local, tipo: 'numero_tendencia', fuente, metricas: [metrica], dimension: null, titulo, comparar: true, ...extra });
/** Un número de HOY (una fuente sin rango): sin línea, que saldría plana, y sin comparar. */
const deHoy = (local: string, fuente: string, metrica: string, titulo: string): PiezaPlantilla =>
  ({ local, tipo: 'numero', fuente, metricas: [metrica], dimension: null, titulo, fecha: 'actual', comparar: false });

/**
 * EL CATÁLOGO SE REHIZO EL 1/11/2026. Martín: «Si tenemos que combinar templates, eliminar algunos, crear nuevos... Lo que sea, pero
 * quiero que se vean mas como los que hemos copiado». Todas salen con la composición densa (`comoDenso`, lib/graficos-portadas.ts).
 *   · Salieron las que tenían entre tres y cinco piezas y repetían a una del Dashboard, ahora en la misma galería: Bienvenida (en
 *     General), Cobros (Cobranza), Anuncios (Ads Analyst), Funnel de llamadas (Closing), Ventas por WhatsApp (Chat Analyst) y Contenido y
 *     lanzamiento (Landing). Una hoja guardada que nació de ellas sigue igual: la plantilla sólo arma hojas nuevas.
 *   · Se revierte «pocas cosas, textos gigantes» (14/10): los números son tarjetas de 3 columnas y hasta cuatro por hoja.
 *   · Sigue valiendo: CADA DATO UNA VEZ, y lo más importante arriba y en número.
 */
const TEMA = 'general';
/** Lo que define a los números de la plantilla Instagram: la audiencia de Meta sólo de Instagram (un filtro FIJO). */
const SOLO_INSTAGRAM = { tipo: 'lista', campo: 'audiencia.plataforma', valores: ['Instagram'], fijo: true };

export const DEFINICIONES_GENERAL: readonly DefinicionGeneral[] = [
  {
    // 4/11/2026 — ORVEL · CORBEL (docs/templates-dashboard-propuesta.md §7.3): «¿cómo viene el negocio y qué me está esperando?».
    // Orvel abre con UNA oración de tres hechos y uno accionable; Corbel pone la fila de números con su comparación y un link al
    // pie de cada uno al lugar donde se trabaja, el puntaje con veredicto (acá la Meta objetivo y el Semáforo) y lo facturado
    // por mes. El bloque «te está esperando» es «A quién cobrarle». Mockup: docs/diseno/mockups-dashboard/general.html.
    id: 'general', nombre: 'General', emoji: '🧭',
    linea: 'Cómo viene el mes en una frase, tu meta, la plata por mes y lo que te está esperando.',
    subtitulo: '', tema: TEMA, periodo: 'este_mes',
    piezas: [
      {
        // Lo que la fila de números NO dice: cuánto cambió y si la pauta vuelve (cada dato, una vez).
        local: 'apertura', tipo: 'frase', fuente: 'negocio', metricas: ['cobrado', 'gasto', 'roas_cobrado'], dimension: null, titulo: 'Cómo viene el mes', comparar: true,
        frase: 'Entraron {cobrado} · {cobrado:cambio} que el período anterior · con {gasto} de pauta, cada dólar volvió {roas_cobrado}', ir: 'cobranza',
      },
      numero('cobrado', 'pagos', 'cobrado', 'Cobrado', { fecha: 'pago', invertida: true, ir: 'cobranza' }),
      numero('vendido', 'leads', 'vendido', 'Vendido', { fecha: 'cierre', ir: 'comercial' }),
      numero('agendas', 'leads', 'agendas', 'Agendas', { fecha: 'agenda', ir: 'crm' }),
      numero('cierres', 'leads', 'cierres', 'Cierres', { fecha: 'cierre', ir: 'closing' }),
      bloque('cabecera'),
      {
        local: 'por-mes', tipo: 'columnas', fuente: 'negocio', dimension: 'mes', metricas: ['cobrado'], titulo: 'Facturado por mes',
        subtitulo: 'Lo cobrado, no lo prometido', controles: [{ tipo: 'periodo', preset: 'ult12m', fijo: true }], ir: 'cobranza',
      },
      bloque('semaforo', { titulo: 'Salud del negocio' }),
      bloque('cobranza', { titulo: 'Te está esperando' }), bloque('accion'), bloque('llamadas'),
    ],
  },
  {
    // 4/11/2026 — PANE · LUMORA (docs/templates-dashboard-propuesta.md §3 y §7.3): «¿en qué estoy ahora y qué me queda hoy?». Deja de
    // ser «Foco de la semana» (Martín, 1/11: «ya no sería "foco de la semana" solo sería "focus" con otras cosas»): es el DÍA.
    // Pane abre con la frase de lo que queda, la cápsula del día y «lo que viene»; Lumora, la tira del día con la línea del ahora
    // (acá «Mi día», en línea de tiempo). El temporizador de foco de Pane NO está: MaKo no mide el tiempo de foco por tarea
    // (§7.4.6), y un reloj que no guarda nada no se pone. Mockups: docs/diseno/mockups-dashboard/focus-pane.html y focus-lumora.html.
    id: 'foco', nombre: 'Focus', emoji: '🎯', buscar: 'Foco de la semana',
    linea: 'Tu día: lo que te queda, la línea del ahora, lo que viene y tus OKRs.',
    subtitulo: '', tema: TEMA, periodo: 'este_mes',
    // 4/11/2026 — EL DISEÑO DE PANE (app/dashboard/disenos/HojaFocus.tsx, maquetas en docs/diseno/mockups-dashboard/focus-pane/):
    // mirando se dibuja la copia, con los datos de los bloques de General (lib/focus-diseno.ts); editando, estas piezas.
    // Sin `piezas`: lo que dibuja no sale de un gráfico de la hoja sino de los datos de General.
    diseno: { id: 'foco', piezas: {} },
    piezas: [
      {
        local: 'apertura', tipo: 'frase', fuente: 'tareas', fecha: 'actual', metricas: ['abiertas', 'avance'], dimension: null, titulo: 'Tu día',
        frase: 'Te quedan {abiertas} tareas abiertas · tu Plan va {avance}', ir: 'plan',
      },
      numero('cerradas', 'tareas', 'hechas', 'Tareas cerradas', { fecha: 'deadline', ir: 'plan' }),
      deHoy('avance', 'proyectos', 'avance_proyectos', 'Avance de proyectos'),
      deHoy('proyectos', 'proyectos', 'proyectos', 'Proyectos'),
      deHoy('completos', 'proyectos', 'completos', 'Proyectos completos'),
      bloque('objetivos', { titulo: 'Cómo vas con tus OKRs', opciones: { estilo: 'barras', cuales: 'trimestre' } }),
      bloque('agenda', { titulo: 'Tu día, de ahora a la noche' }), bloque('llamadas', { titulo: 'Lo que viene', opciones: { dias: '1' } }),
      bloque('tareas', { titulo: 'Mis tareas' }), bloque('deadlines', { opciones: { dias: '7', que: 'tareas' } }),
      bloque('proyectos'),
    ],
  },
  {
    // 4/11/2026 — LUMORA, la otra referencia de Focus (docs/templates-dashboard-propuesta.md §7.3.1): «¿qué tengo hoy y qué me
    // espera?». Lumora abre con el saludo y la CINTA del día con la línea del ahora, cuatro números con su barrita, lo que vence,
    // tu funnel hoy, los OKRs contra lo esperado, los que te deben, el semáforo y, al costado, el mes, tu día y los recordatorios.
    // EL DISEÑO DE LUMORA (app/dashboard/disenos/HojaMiDia.tsx, maquetas en docs/diseno/mockups-dashboard/focus-lumora/): mirando se
    // dibuja la copia, con los datos de los bloques de General (lib/mi-dia-diseno.ts); editando, estas piezas.
    id: 'mi-dia', nombre: 'Mi día', emoji: '☀️', buscar: 'Hoy',
    linea: 'Tu día en una cinta con la línea del ahora, lo que vence, tu funnel, tus OKRs y quién te debe.',
    subtitulo: '', tema: TEMA, periodo: 'este_mes',
    diseno: { id: 'mi-dia', piezas: {} },
    piezas: [
      {
        local: 'apertura', tipo: 'frase', fuente: 'leads', fecha: 'agenda', metricas: ['agendas', 'asistencias'], dimension: null, titulo: 'Hoy',
        frase: 'Hoy tienes {agendas} llamadas agendadas · {asistencias} ya vinieron', controles: [{ tipo: 'periodo', preset: 'hoy', fijo: true }], ir: 'crm',
      },
      numero('agendas', 'leads', 'agendas', 'Agendas', { fecha: 'agenda', ir: 'crm' }),
      numero('cerradas', 'tareas', 'hechas', 'Tareas cerradas', { fecha: 'deadline', ir: 'plan' }),
      numero('pendiente', 'pagos', 'pendiente', 'Por cobrar', { comparar: false, invertida: true, ir: 'cobranza' }),
      numero('cobrado', 'pagos', 'cobrado', 'Cobrado', { fecha: 'pago', ir: 'cobranza' }),
      bloque('agenda', { titulo: 'Tu día' }), bloque('deadlines', { titulo: 'Lo que vence' }),
      bloque('funnel'), bloque('cobranza', { titulo: 'Los que te deben' }),
      bloque('objetivos', { titulo: 'Cómo vas con tus OKRs', opciones: { estilo: 'barras', cuales: 'trimestre' } }),
      bloque('tareas', { titulo: 'Para tildar hoy' }), bloque('semaforo'),
    ],
  },
  {
    // 4/11/2026 — MOORLY · TORQUE (docs/templates-dashboard-propuesta.md §7.3): «¿qué está vencido y a quién llamo?». Moorly abre con
    // lo de hoy y lo que vence; Torque, el tablero de lo que está en curso. Es el caso de la reunión del 12/10 (el
    // Plan, la cobranza y el CRM en la pantalla de lo que se hace hoy).
    id: 'operacion', nombre: 'Operación diaria', emoji: '⚡',
    linea: 'Lo de hoy: las llamadas, lo vencido, a quién llamar y lo primero del Plan.',
    subtitulo: '', tema: TEMA, periodo: 'ult30',
    piezas: [
      {
        local: 'apertura', tipo: 'frase', fuente: 'leads', fecha: 'agenda', metricas: ['agendas', 'asistencias', 'no_show'], dimension: null, titulo: 'Hoy',
        frase: 'Hoy hay {agendas} llamadas agendadas · {asistencias} ya vinieron · {no_show} no se presentaron',
        controles: [{ tipo: 'periodo', preset: 'hoy', fijo: true }], ir: 'crm',
      },
      numero('cobrado', 'pagos', 'cobrado', 'Cobrado', { fecha: 'pago', ir: 'cobranza' }),
      numero('pendiente', 'pagos', 'pendiente', 'Por cobrar', { comparar: false, invertida: true, ir: 'cobranza' }),
      numero('agendas', 'leads', 'agendas', 'Agendas', { fecha: 'agenda', ir: 'crm' }),
      numero('cierres', 'leads', 'cierres', 'Cierres', { fecha: 'cierre', ir: 'closing' }),
      bloque('prioridades'),
      bloque('cobranza', { titulo: 'Lo vencido', opciones: { cuales: 'vencidas' } }),
      bloque('llamadas', { titulo: 'A quién llamo hoy', opciones: { dias: '1' } }), bloque('agenda'),
      bloque('deadlines', { titulo: 'Lo que vence', opciones: { dias: '7', que: 'tareas' } }),
      bloque('funnel', { opciones: { estilo: 'barras' } }),
    ],
  },
  {
    // 4/11/2026 — SUNROW · TORQUE (docs/templates-dashboard-propuesta.md §7.3): «¿cada cliente va en fecha?». Torque es el tablero de
    // lo que está en curso: cuántos clientes hay en cada etapa de la entrega y cuántos avanzaron este mes. Sunrow, cada cliente con su
    // fila: quién te necesita y hace cuánto no hablan. ⚠️ «En fecha» de verdad pide una fecha comprometida por etapa, que la entrega no
    // guarda: lo que se mide es cuándo llegó cada uno a su etapa (docs/relevo/nube-dashboards.md).
    id: 'servicio', nombre: 'Agencia o servicio', emoji: '🤝',
    linea: 'Tus clientes en cada etapa de la entrega, quién avanzó, quién te necesita y lo que te deben.',
    subtitulo: '', tema: TEMA, periodo: 'este_mes',
    piezas: [
      {
        local: 'apertura', tipo: 'frase', fuente: 'cartera', fecha: 'actual', metricas: ['atencion', 'sesiones', 'cuotas_vencidas'], dimension: null, titulo: 'Tu cartera',
        frase: '{atencion} clientes te necesitan hoy · {sesiones} sesiones dadas · {cuotas_vencidas} cuotas vencidas', ir: 'clients',
      },
      deHoy('clientes', 'cartera', 'clientes', 'Clientes'),
      numero('avanzaron', 'entrega', 'clientes', 'Avanzaron de etapa', { fecha: 'desde', invertida: true, ir: 'clients' }),
      { ...deHoy('deuda', 'cartera', 'deuda_vencida_usd', 'Deuda vencida'), ir: 'cobranza' },
      numero('cobrado', 'pagos', 'cobrado', 'Cobrado', { fecha: 'pago', ir: 'cobranza' }),
      { local: 'etapas', tipo: 'barras', fuente: 'entrega', fecha: 'actual', dimension: 'etapa', metricas: ['clientes'], titulo: 'Clientes por etapa', ir: 'clients' },
      { local: 'por-producto', tipo: 'anillo', fuente: 'entrega', fecha: 'actual', dimension: 'producto', metricas: ['clientes'], titulo: 'Por funnel' },
      {
        local: 'contacto', tipo: 'barras', fuente: 'cartera', fecha: 'actual', dimension: 'tramo_contacto', metricas: ['clientes'], titulo: 'Hace cuánto no hablan',
      },
      { local: 'ritmo', tipo: 'columnas', fuente: 'entrega', fecha: 'desde', dimension: 'semana', metricas: ['clientes'], titulo: 'Avanzaron, por semana' },
      {
        local: 'quien', tipo: 'tarjetas', fuente: 'cartera', dimension: 'cliente', metricas: ['atencion', 'deuda_vencida_usd', 'sesiones'],
        ordenMetrica: 'atencion', barra: 'deuda_vencida_usd', limite: 3, tabla: { columnas: ['senal', 'tramo_contacto'] }, titulo: 'Quién te necesita hoy',
      },
      bloque('cobranza', { titulo: 'Lo que te deben' }), bloque('agenda'),
    ],
  },
  {
    // 4/11/2026 — LUMORA · VITREA (docs/templates-dashboard-propuesta.md §7.3): «¿cuántos siguen ahí al mes 3?». Lumora abre con la
    // frase de cuántos siguen viendo y si son más o menos que antes; Vitrea, el avance como barra contra el 100 % y lo que pasa por
    // estado y por área. ⚠️ La permanencia por cohorte (M0…M5) no se mide todavía: lo que hay es quién vio clases en el período.
    id: 'curso', nombre: 'Curso o comunidad', emoji: '🎓',
    linea: 'Cuántos alumnos siguen viendo clases y qué tanto avanzan, junto a lo que vendes.',
    subtitulo: '', tema: TEMA, periodo: 'ult30',
    piezas: [
      {
        local: 'apertura', tipo: 'frase', fuente: 'avance_cursos', metricas: ['clases'], dimension: null, titulo: 'Tus alumnos', comparar: true,
        frase: 'Tus alumnos vieron {clases} clases · {clases:cambio} que el período anterior', ir: 'classroom',
      },
      numero('alumnos', 'avance_cursos', 'alumnos', 'Alumnos activos', { invertida: true, ir: 'classroom' }),
      numero('ventas', 'leads', 'cierres', 'Ventas', { fecha: 'cierre', ir: 'closing' }),
      numero('cobrado', 'pagos', 'cobrado', 'Cobrado', { fecha: 'pago', ir: 'cobranza' }),
      { ...deHoy('atencion', 'cartera', 'atencion', 'Piden atención'), ir: 'clients' },
      { local: 'tendencia', tipo: 'serie', fuente: 'avance_cursos', dimension: 'dia', metricas: ['alumnos'], titulo: 'Alumnos que vieron clases' },
      { local: 'avance', tipo: 'bala', fuente: 'avance_cursos', metricas: ['avance'], dimension: null, maximo: 100, titulo: 'Cuánto avanzan' },
      { local: 'por-estado', tipo: 'anillo', fuente: 'avance_cursos', dimension: 'estado', metricas: ['alumnos'], titulo: 'En qué van' },
      { local: 'por-area', tipo: 'barras', fuente: 'avance_cursos', dimension: 'area', metricas: ['alumnos'], titulo: 'Alumnos por área' },
      { local: 'por-semana', tipo: 'columnas', fuente: 'avance_cursos', dimension: 'semana', metricas: ['clases'], titulo: 'Clases por semana' },
      bloque('publicaciones'),
    ],
  },
  {
    // 15/10/2026 (Martín: «faltaría uno para Instagram»). Medido en la base ANTES de armarla: ningún lead dice «Instagram»
    // en su origen (el 1.062 que se había contado era `instant_form`, los formularios de Meta, que son de Facebook O de
    // Instagram), y ningún negocio tiene los DM conectados. Lo que sí hay, para cada negocio con Meta, es la AUDIENCIA por
    // plataforma (lib/graficos-audiencia.ts): cuánto te ven, cuántos tocan y cuántos agendan desde Instagram.
    // 4/11/2026 — MURMURA · KESTREL (docs/templates-dashboard-propuesta.md §7.3): «¿qué publicación trajo gente de verdad?». Murmura
    // pone cada red contra la otra y lo que cada publicación trajo; Kestrel, el alcance y lo que cuesta. «De verdad» es CLIENTES, no
    // clics: por eso el anuncio se ordena por los cierres de sus leads (todas las redes de Meta: el lead no dice de cuál vino).
    // Se llama «Instagram y redes» y su id sigue siendo `instagram` (las hojas guardadas nacieron de ese id).
    id: 'instagram', nombre: 'Instagram y redes', emoji: '📸',
    linea: 'Lo que te trae Instagram contra Facebook, y qué anuncio trajo clientes de verdad.',
    subtitulo: '', tema: TEMA, periodo: 'ult30',
    piezas: [
      {
        local: 'apertura', tipo: 'frase', fuente: 'audiencia', metricas: ['impresiones', 'clics', 'agendas'], dimension: null, titulo: 'Instagram',
        frase: 'Instagram te mostró {impresiones} veces · {clics} tocaron tu anuncio · {agendas} agendaron', controles: [SOLO_INSTAGRAM], ir: 'ads-manager',
      },
      { ...numero('alcance', 'audiencia', 'alcance', 'Alcance en Instagram', { comparar: false, controles: [SOLO_INSTAGRAM] }), tipo: 'numero' },
      { ...numero('ctr', 'audiencia', 'ctr', 'Tocan el anuncio', { comparar: false, invertida: true, controles: [SOLO_INSTAGRAM] }), tipo: 'numero' },
      { ...numero('cpm', 'audiencia', 'cpm', 'Costo por mil', { comparar: false, controles: [SOLO_INSTAGRAM] }), tipo: 'numero' },
      { ...numero('gasto', 'audiencia', 'gasto', 'Inversión en Instagram', { comparar: false, controles: [SOLO_INSTAGRAM] }), tipo: 'numero' },
      {
        local: 'plataformas', tipo: 'tabla_barras', fuente: 'audiencia', dimension: 'plataforma', metricas: ['impresiones', 'clics', 'agendas'],
        titulo: 'Instagram contra Facebook',
      },
      { local: 'por-genero', tipo: 'anillo', fuente: 'audiencia', dimension: 'genero', metricas: ['impresiones'], titulo: 'Por género', controles: [SOLO_INSTAGRAM] },
      { local: 'por-edad', tipo: 'barras', fuente: 'audiencia', dimension: 'edad', metricas: ['impresiones'], titulo: 'Por edad', controles: [SOLO_INSTAGRAM] },
      { local: 'por-region', tipo: 'barras', fuente: 'audiencia', dimension: 'region', metricas: ['agendas'], titulo: 'Agendan por región', controles: [SOLO_INSTAGRAM] },
      { local: 'origen', tipo: 'barras', fuente: 'leads', fecha: 'alta', dimension: 'origen', metricas: ['leads'], titulo: 'De dónde llegan tus leads', ir: 'crm' },
      {
        local: 'anuncios', tipo: 'tarjetas', fuente: 'leads', fecha: 'alta', dimension: 'anuncio', metricas: ['cierres', 'agendas', 'leads'],
        ordenMetrica: 'cierres', barra: 'agendas', limite: 4, titulo: 'Qué anuncio trajo clientes', ir: 'ads-manager',
      },
    ],
  },
];

/** Lo que abre cada plantilla de General: su panel principal, al lado de los números (`comoDenso`, lib/graficos-portadas.ts). */
export const PORTADAS_GENERAL: Readonly<Record<string, DefinicionPortada>> = {
  general: { sube: 'cabecera', vecino: 'cabecera', par: ['por-mes', 'semaforo'], molde: 'ledge' },
  foco: { sube: 'objetivos', vecino: 'objetivos', par: ['agenda', 'llamadas', 'tareas', 'deadlines'], molde: 'moorly' },
  'mi-dia': { sube: 'agenda', vecino: 'agenda', par: ['deadlines', 'funnel', 'cobranza'], molde: 'tilvo' },
  operacion: { sube: 'prioridades', cambios: { texto: 'Lo primero de hoy' }, vecino: 'prioridades', par: ['cobranza', 'llamadas', 'agenda', 'deadlines', 'funnel'], molde: 'tilvo' },
  servicio: { sube: 'etapas', vecino: 'etapas', par: ['por-producto', 'contacto'], molde: 'prism' },
  curso: { sube: 'tendencia', vecino: 'tendencia', par: ['avance', 'por-area', 'por-estado', 'por-semana'], molde: 'corbel' },
  instagram: { sube: 'plataformas', vecino: 'plataformas', par: ['por-genero', 'por-edad'], molde: 'prism' },
};

/** La galería de General, en orden. «Hoja en blanco» va primera siempre (la pone el modal). */
export const PLANTILLAS_GENERAL: readonly PlantillaHoja[] = DEFINICIONES_GENERAL.map(plantilla)
  .map((p) => ({ ...p, armar: (id: (local: string) => string) => comoDenso(p.armar(id), PORTADAS_GENERAL[p.id], id) }));

/** Lo que /general tiene de propio en la galería (la de su «Nueva hoja»): éstas, nunca las del Dashboard. */
export const esPlantillaGeneral = (id: string): boolean => PLANTILLAS_GENERAL.some((p) => p.id === id);

// ── De quién es el informe (la API de MaKo) ────────────────────────────────────────────────────────────────────────

/** Una persona admin de la cuenta: el informe de General es POR PERSONA. */
export type PersonaGeneral = { sub: string; email: string; nombre: string };

const normalizarTexto = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * De quién es el informe que pide la API: la persona que se nombra (email o nombre), o la única persona admin. Dos
 * personas con el mismo nombre: se pide el email. (Era `elegirPersonaVista` de las vistas del 13/10, la misma regla.)
 * En la app, sin nombrar a nadie, es la de quien chatea (`quien`, lib/api-mako/tipos.ts `quienChatea`): Focus es la
 * General de quien la mira, como en la pantalla (20/10/2026, Ops Center = lo principal, 1.5).
 */
export function elegirPersona(admins: readonly PersonaGeneral[], pedido: string | null | undefined, quien?: PersonaGeneral | null): { ok: true; persona: PersonaGeneral } | { ok: false; error: string } {
  const p = (pedido ?? '').trim();
  if (!p && quien) return { ok: true, persona: { sub: quien.sub, email: quien.email, nombre: quien.nombre } };
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
