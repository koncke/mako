// =============================================================================
// graficos-plantillas-generales — las plantillas de «Nueva hoja» armadas con el catálogo (punto 19)
// =============================================================================
// Martín, 11/10/2026: «replica el modal que tenemos en "Automations", en donde al principio tenemos
// la opción de "Pídeselo a MaKo" y abajo se le ofrece TEMPLATES». Marketing y Comercial son las dos
// tabs viejas (lib/graficos-plantillas.ts); las de Analysts las arma lib/graficos-plantillas-analysts.ts.
// Éstas son las del resto de MaKo, una por área: el CRM, la cobranza, las automatizaciones, WhatsApp,
// Customer Success y la IA. (El Plan no tiene una propia: lo cubre la de Productivity Analyst.)
//
// ⚠️ CADA PIEZA ESTÁ ESCRITA EN LA MISMA FORMA QUE LA SALIDA DE LA IA (`deIAHoja`, lib/graficos-ia.ts),
//    y el test las pasa por esa misma puerta: una plantilla con una métrica que no es de su conjunto
//    no la corrige `sanearGrafico` en silencio, la frena el test (tests/graficos-ia.test.ts).
// ⚠️ EL LUGAR LO PONE `acomodar`, no coordenadas a mano: así ninguna se superpone y todas se leen
//    igual (cuadros de resultados arriba, series y tablas a lo ancho).
// ⚠️ SIN DATOS DE NINGÚN CLIENTE (AGENTS.md: un ejemplo de pantalla es ficticio por regla): los
//    títulos nombran métricas, nunca un negocio, una persona ni un monto.
//
// Puro y sin server-only.

import { sanearComponente, type Componente, type Preset } from './graficos-catalogo';
import { acomodar } from './graficos-ia';
import type { PlantillaHoja } from './graficos-plantillas';

/**
 * Una pieza: un gráfico, un bloque o un título de sección, con la forma que escribe la IA más un
 * nombre `local` (de ahí sale su id: fijo para el inicial, nuevo al instanciar) y, si hace falta,
 * sus controles (un «agrupar por» en una serie).
 */
export type PiezaPlantilla = { local: string; controles?: Array<Record<string, unknown>> } & Record<string, unknown>;

export type DefinicionGeneral = {
  id: string; nombre: string; emoji: string; linea: string; subtitulo: string;
  /** El control de período de arriba de la hoja: lo que muestra de entrada. */
  periodo: Preset;
  piezas: PiezaPlantilla[];
};

/** Una pieza (en la forma de la IA) → el componente crudo que entiende el catálogo, con su id. */
function aComponente(p: PiezaPlantilla, id: (local: string) => string): Record<string, unknown> {
  const { local, controles, seccion, ...resto } = p;
  const propio = id(local);
  if (typeof seccion === 'string') return { id: propio, clase: 'elemento', tipo: 'texto', texto: seccion, tamano: 'xl' };
  // El id fijo tiene que pasar `idValido` (hasta 40 caracteres): por eso corto.
  const ctrls = (controles ?? []).map((c, i) => ({ ...c, id: id(`${local}-c${i}`) }));
  if (typeof resto.bloque === 'string') return { ...resto, id: propio, clase: 'bloque', controles: ctrls };
  return { ...resto, id: propio, clase: 'grafico', controles: ctrls };
}

function plantilla(d: DefinicionGeneral): PlantillaHoja {
  return {
    id: d.id, nombre: d.nombre, emoji: d.emoji, linea: d.linea,
    armar: (id) => {
      const componentes = d.piezas
        .map((p) => sanearComponente(aComponente(p, id)))
        .filter((c): c is Componente => c != null);
      return {
        id: id(d.id), nombre: d.nombre, emoji: d.emoji, subtitulo: d.subtitulo,
        controles: [{ id: id(`${d.id}-periodo`), tipo: 'periodo', preset: d.periodo }],
        componentes: acomodar(componentes),
      };
    },
  };
}

const AGRUPAR_AUTO = [{ tipo: 'agrupar', agrupar: 'auto' }];

/** Las definiciones, a la vista de los tests (que las pasan por `deIAHoja`). */
export const DEFINICIONES_GENERALES: readonly DefinicionGeneral[] = [
  {
    id: 'crm', nombre: 'CRM y pipeline', emoji: '🧲',
    linea: 'Cuántos leads entran, cuántos agendan y cierran, de dónde vienen y en qué etapa están.',
    subtitulo: 'Los leads del período, del alta al cierre.', periodo: 'ult30',
    piezas: [
      { local: 'leads', tipo: 'numero', fuente: 'leads', metricas: ['leads'], dimension: null, titulo: 'Leads nuevos', comparar: true },
      { local: 'agendas', tipo: 'numero', fuente: 'leads', metricas: ['agendas'], dimension: null, titulo: 'Agendaron' },
      { local: 'asistencia', tipo: 'numero', fuente: 'leads', metricas: ['tasa_asistencia'], dimension: null, titulo: 'Tasa de asistencia' },
      { local: 'cierre', tipo: 'numero', fuente: 'leads', metricas: ['tasa_cierre'], dimension: null, titulo: 'Tasa de cierre' },
      { local: 'embudo', tipo: 'embudo_vertical', fuente: 'leads', metricas: ['leads', 'agendas', 'asistencias', 'cierres'], dimension: null, titulo: 'Del lead al cierre' },
      { local: 'etapas', tipo: 'barras', fuente: 'leads', dimension: 'etapa', metricas: ['leads'], titulo: 'Leads por etapa' },
      { local: 'por-dia', tipo: 'serie', fuente: 'leads', dimension: 'dia', metricas: ['leads', 'agendas'], titulo: 'Leads y agendas', controles: AGRUPAR_AUTO },
      { local: 'origen', tipo: 'tabla_barras', fuente: 'leads', dimension: 'origen', metricas: ['leads', 'agendas', 'cierres', 'tasa_cierre'], titulo: 'De dónde vienen' },
      { local: 'perdidas', tipo: 'barras', fuente: 'leads', dimension: 'motivo', metricas: ['leads'], titulo: 'Por qué se pierden' },
      { local: 'closers', tipo: 'barras', fuente: 'leads', dimension: 'closer', metricas: ['cierres'], titulo: 'Cierres por closer' },
    ],
  },
  {
    id: 'cobranza', nombre: 'Cobranza', emoji: '💳',
    linea: 'Lo que vence en el período, lo cobrado, lo pendiente y a quién cobrarle primero.',
    subtitulo: 'Las cuotas de tus clientes.', periodo: 'este_mes',
    piezas: [
      { local: 'vence', tipo: 'numero', fuente: 'pagos', metricas: ['monto'], dimension: null, titulo: 'Vence en el período' },
      { local: 'cobrado', tipo: 'numero', fuente: 'pagos', fecha: 'pago', metricas: ['cobrado'], dimension: null, titulo: 'Cobrado', comparar: true },
      { local: 'pendiente', tipo: 'numero', fuente: 'pagos', metricas: ['pendiente'], dimension: null, titulo: 'Pendiente' },
      { local: 'clientes', tipo: 'numero', fuente: 'pagos', metricas: ['clientes'], dimension: null, titulo: 'Clientes con cuota' },
      { local: 'a-quien', bloque: 'cobranza' },
      { local: 'semanas', tipo: 'columnas', fuente: 'pagos', dimension: 'semana', metricas: ['cobrado', 'pendiente'], titulo: 'Cobrado y pendiente por semana' },
      { local: 'estados', tipo: 'circular', fuente: 'pagos', dimension: 'estado', metricas: ['monto'], titulo: 'Por estado' },
      { local: 'por-cliente', tipo: 'tabla', fuente: 'pagos', dimension: 'cliente', metricas: ['monto', 'cobrado', 'pendiente'], titulo: 'Por cliente' },
    ],
  },
  {
    id: 'automatizaciones', nombre: 'Automatizaciones', emoji: '⚙️',
    linea: 'Quién entra a cada automatización, cuántos mensajes salen, cuántos se abren y cuántos responden.',
    subtitulo: 'Tus automatizaciones del período.', periodo: 'ult30',
    piezas: [
      { local: 'entraron', tipo: 'numero', fuente: 'inscripciones', metricas: ['personas'], dimension: null, titulo: 'Personas que entraron', comparar: true },
      { local: 'envios', tipo: 'numero', fuente: 'envios', metricas: ['envios'], dimension: null, titulo: 'Mensajes enviados' },
      { local: 'apertura', tipo: 'numero', fuente: 'envios', metricas: ['tasa_apertura'], dimension: null, titulo: 'Tasa de apertura' },
      { local: 'respuesta', tipo: 'numero', fuente: 'envios', metricas: ['tasa_respuesta'], dimension: null, titulo: 'Tasa de respuesta' },
      { local: 'por-automatizacion', tipo: 'tabla_barras', fuente: 'envios', dimension: 'automatizacion', metricas: ['envios', 'abiertos', 'respuestas', 'tasa_respuesta'], titulo: 'Por automatización' },
      { local: 'por-dia', tipo: 'serie', fuente: 'envios', dimension: 'dia', metricas: ['envios', 'respuestas'], titulo: 'Envíos y respuestas', controles: AGRUPAR_AUTO },
      { local: 'desenlace', tipo: 'barras', fuente: 'inscripciones', dimension: 'desenlace', metricas: ['personas'], titulo: 'Cómo terminaron' },
      { local: 'canal', tipo: 'circular', fuente: 'envios', dimension: 'canal', metricas: ['envios'], titulo: 'Por canal' },
    ],
  },
  {
    id: 'whatsapp', nombre: 'WhatsApp y MaKo', emoji: '💬',
    linea: 'Los mensajes de tus líneas de WhatsApp y lo que tu equipo le pide a MaKo.',
    subtitulo: 'Tus líneas y tus chats con MaKo.', periodo: 'ult30',
    piezas: [
      { local: 'enviados', tipo: 'numero', fuente: 'whatsapp', metricas: ['enviados'], dimension: null, titulo: 'Enviados', comparar: true },
      { local: 'recibidos', tipo: 'numero', fuente: 'whatsapp', metricas: ['recibidos'], dimension: null, titulo: 'Recibidos' },
      { local: 'chats', tipo: 'numero', fuente: 'whatsapp', metricas: ['chats'], dimension: null, titulo: 'Chats' },
      { local: 'mako', tipo: 'numero', fuente: 'mako_chat', metricas: ['mensajes'], dimension: null, titulo: 'Mensajes con MaKo' },
      { local: 'por-dia', tipo: 'serie', fuente: 'whatsapp', dimension: 'dia', metricas: ['enviados', 'recibidos'], titulo: 'Mensajes por día', controles: AGRUPAR_AUTO },
      { local: 'lineas', tipo: 'barras', fuente: 'whatsapp', dimension: 'linea', metricas: ['mensajes'], titulo: 'Por línea' },
      { local: 'tipos', tipo: 'circular', fuente: 'whatsapp', dimension: 'tipo', metricas: ['mensajes'], titulo: 'Por tipo' },
      { local: 'quien', tipo: 'barras', fuente: 'mako_chat', dimension: 'quien', metricas: ['mensajes'], titulo: 'Quién le escribe a MaKo' },
    ],
  },
  {
    id: 'customer-success', nombre: 'Customer Success', emoji: '🤝',
    linea: 'En qué etapa de la entrega está cada cliente y cuánto avanzan tus alumnos en los cursos.',
    subtitulo: 'La entrega y los cursos.', periodo: 'ult30',
    piezas: [
      { local: 'clientes', tipo: 'numero', fuente: 'entrega', metricas: ['clientes'], dimension: null, titulo: 'Clientes en entrega' },
      { local: 'clases', tipo: 'numero', fuente: 'avance_cursos', metricas: ['clases'], dimension: null, titulo: 'Clases vistas', comparar: true },
      { local: 'avance', tipo: 'numero', fuente: 'avance_cursos', metricas: ['avance'], dimension: null, titulo: 'Avance promedio' },
      { local: 'alumnos', tipo: 'numero', fuente: 'avance_cursos', metricas: ['alumnos'], dimension: null, titulo: 'Alumnos activos' },
      { local: 'etapas', tipo: 'barras', fuente: 'entrega', dimension: 'etapa', metricas: ['clientes'], titulo: 'Clientes por etapa' },
      { local: 'productos', tipo: 'barras_apiladas', fuente: 'entrega', dimension: 'producto', desglose: 'etapa', metricas: ['clientes'], titulo: 'Por producto y etapa' },
      { local: 'semanas', tipo: 'serie', fuente: 'avance_cursos', dimension: 'semana', metricas: ['clases'], titulo: 'Clases vistas por semana' },
      { local: 'areas', tipo: 'barras', fuente: 'avance_cursos', dimension: 'area', metricas: ['clases'], titulo: 'Por área' },
    ],
  },
  {
    id: 'ia-contenido', nombre: 'Contenido e IA', emoji: '✨',
    linea: 'Cuánto usas la IA y para qué, y los videos e imágenes que MaKo le pidió a Flow.',
    subtitulo: 'La IA y la producción de contenido.', periodo: 'ult30',
    piezas: [
      { local: 'llamadas', tipo: 'numero', fuente: 'ia', metricas: ['llamadas'], dimension: null, titulo: 'Llamadas a la IA', comparar: true },
      { local: 'costo', tipo: 'numero', fuente: 'ia', metricas: ['costo'], dimension: null, titulo: 'Costo de la IA' },
      { local: 'pedidos', tipo: 'numero', fuente: 'flow', metricas: ['trabajos'], dimension: null, titulo: 'Pedidos a Flow' },
      { local: 'exito', tipo: 'numero', fuente: 'flow', metricas: ['tasa_exito'], dimension: null, titulo: 'Tasa de éxito' },
      { local: 'por-dia', tipo: 'serie', fuente: 'ia', dimension: 'dia', metricas: ['llamadas'], titulo: 'Llamadas por día', controles: AGRUPAR_AUTO },
      { local: 'funciones', tipo: 'tabla_barras', fuente: 'ia', dimension: 'funcion', metricas: ['llamadas', 'costo', 'costo_prom'], titulo: 'Para qué se usa' },
      { local: 'proveedores', tipo: 'circular', fuente: 'ia', dimension: 'proveedor', metricas: ['llamadas'], titulo: 'Por proveedor' },
      { local: 'flow', tipo: 'columnas', fuente: 'flow', dimension: 'tipo', desglose: 'estado', metricas: ['trabajos'], titulo: 'Videos e imágenes' },
    ],
  },
];

/** Las generales, en el orden de la galería. */
export const PLANTILLAS_GENERALES: readonly PlantillaHoja[] = DEFINICIONES_GENERALES.map(plantilla);

/** Para buscar sin acentos ni mayúsculas. */
const plano = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Las plantillas que pasan el buscador del modal (nombre + línea, sin acentos ni mayúsculas). Recibe
 * la lista (`PLANTILLAS_HOJA`) en vez de importarla: lib/graficos-plantillas.ts importa este archivo.
 * «Hoja en blanco» no pasa por acá: va primera siempre (app/dashboard/NuevaHoja.tsx).
 */
export function filtrarPlantillasHoja(lista: readonly PlantillaHoja[], texto: string): PlantillaHoja[] {
  const q = plano(texto.trim());
  if (!q) return [...lista];
  return lista.filter((p) => plano(`${p.nombre} ${p.linea}`).includes(q));
}
