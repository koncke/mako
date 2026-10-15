// =============================================================================
// graficos-plantillas-generales — las plantillas de «Nueva hoja» armadas con el catálogo (punto 19)
// =============================================================================
// Martín, 11/10/2026: «replica el modal que tenemos en "Automations", en donde al principio tenemos
// la opción de "Pídeselo a MaKo" y abajo se le ofrece TEMPLATES». Marketing y Comercial son las dos
// tabs viejas (lib/graficos-plantillas.ts); las de Analysts las arma lib/graficos-plantillas-analysts.ts.
// Éstas son las del resto de MaKo, una por área: el CRM, la cobranza, las automatizaciones y la IA. (El Plan
// no tiene una propia: lo cubre la de Productivity Analyst.)
//
// ⚠️ TANDA v5 (12/10/2026): «WhatsApp y MaKo» y «Customer Success» se FUERON. Las reemplazan las hojas Chat
//    Analyst y CS Analyst (lib/graficos-plantillas-analysts.ts), que miran lo mismo y más; dos plantillas del
//    mismo tema terminan contando distinto. Un link o un agente que nombre las viejas llega a las nuevas
//    (`PLANTILLAS_REEMPLAZADAS`, lib/graficos-plantillas.ts). Y sin bloques: «A quién cobrarle» es la tabla de la
//    cobranza (con «Marcar cobrada» en la fila), y «Para qué se usa» son barras (relevo C, punto 20).
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
 * Una pieza: un gráfico o un título de sección, con la forma que escribe la IA más un nombre `local` (de
 * ahí sale su id: fijo para el inicial, nuevo al instanciar) y, si hace falta, sus controles (un «agrupar
 * por» en una serie) y las opciones del catálogo que la IA no escribe (las de una tabla, el orden): la puerta
 * de la IA no las mira, el saneo las copia.
 */
export type PiezaPlantilla = { local: string; controles?: Array<Record<string, unknown>> } & Record<string, unknown>;

export type DefinicionGeneral = {
  id: string; nombre: string; emoji: string; linea: string; subtitulo: string;
  /** El control de período de arriba de la hoja: lo que muestra de entrada. */
  periodo: Preset;
  piezas: PiezaPlantilla[];
  /** El tema de la hoja (la plantilla de lib/graficos-temas.ts). Ausente = el de MaKo. Lo usan las de General. */
  tema?: string;
};

/** Una pieza (en la forma de la IA) → el componente crudo que entiende el catálogo, con su id. */
function aComponente(p: PiezaPlantilla, id: (local: string) => string): Record<string, unknown> {
  const { local, controles, seccion, elemento, ...resto } = p;
  const propio = id(local);
  if (typeof seccion === 'string') return { id: propio, clase: 'elemento', tipo: 'texto', texto: seccion, tamano: 'xl' };
  // 14/10/2026 (las plantillas de General, lib/general-plantillas.ts): un ELEMENTO tal cual (un texto con variables, un
  // bloque de General), con su tamaño. La IA no los escribe: sólo las plantillas.
  if (elemento && typeof elemento === 'object') return { ...(elemento as Record<string, unknown>), id: propio, clase: 'elemento' };
  // El id fijo tiene que pasar `idValido` (hasta 40 caracteres): por eso corto.
  const ctrls = (controles ?? []).map((c, i) => ({ ...c, id: id(`${local}-c${i}`) }));
  return { ...resto, id: propio, clase: 'grafico', controles: ctrls };
}

/** Una definición → la plantilla de «Nueva hoja». Exportada desde el 14/10/2026: la usan también las de General. */
export function plantilla(d: DefinicionGeneral): PlantillaHoja {
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
        ...(d.tema ? { tema: { plantilla: d.tema, acento: null, fuente: null } } : {}),
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
    // «Este mes completo»: lo que VENCE mira hacia adelante (`pagos.vencimiento` es `futuro`), así que el mes
    // entra entero; lo cobrado igual se corta en hoy (decisión de la tanda v5).
    id: 'cobranza', nombre: 'Cobranza', emoji: '💳',
    linea: 'Lo que vence en el período, lo cobrado, lo pendiente y a quién cobrarle primero.',
    subtitulo: 'Las cuotas de tus clientes.', periodo: 'este_mes_completo',
    piezas: [
      { local: 'vence', tipo: 'numero', fuente: 'pagos', metricas: ['monto'], dimension: null, titulo: 'Vence en el período' },
      { local: 'cobrado', tipo: 'numero', fuente: 'pagos', fecha: 'pago', metricas: ['cobrado'], dimension: null, titulo: 'Cobrado', comparar: true },
      { local: 'pendiente', tipo: 'numero', fuente: 'pagos', metricas: ['pendiente'], dimension: null, titulo: 'Pendiente' },
      { local: 'clientes', tipo: 'numero', fuente: 'pagos', metricas: ['clientes'], dimension: null, titulo: 'Clientes con cuota' },
      // La que era el bloque «A quién cobrarle»: una fila por cliente, el más urgente arriba, «Marcar cobrada».
      {
        local: 'a-quien', tipo: 'tabla', fuente: 'cobranza', dimension: 'cliente', metricas: ['pendiente', 'proxima_monto', 'dias'], titulo: 'A quién cobrarle',
        ordenMetrica: 'dias', ordenAsc: true, limite: 50, tabla: { acciones: true, columnas: ['urgencia'] },
      },
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
    id: 'ia-contenido', nombre: 'Contenido e IA', emoji: '✨',
    linea: 'Cuánto usas la IA y para qué, y los videos e imágenes que MaKo le pidió a Flow.',
    subtitulo: 'La IA y la producción de contenido.', periodo: 'ult30',
    piezas: [
      { local: 'llamadas', tipo: 'numero', fuente: 'ia', metricas: ['llamadas'], dimension: null, titulo: 'Llamadas a la IA', comparar: true },
      { local: 'costo', tipo: 'numero', fuente: 'ia', metricas: ['costo'], dimension: null, titulo: 'Costo de la IA' },
      { local: 'pedidos', tipo: 'numero', fuente: 'flow', metricas: ['trabajos'], dimension: null, titulo: 'Pedidos a Flow' },
      { local: 'exito', tipo: 'numero', fuente: 'flow', metricas: ['tasa_exito'], dimension: null, titulo: 'Tasa de éxito' },
      { local: 'por-dia', tipo: 'serie', fuente: 'ia', dimension: 'dia', metricas: ['llamadas'], titulo: 'Llamadas por día', controles: AGRUPAR_AUTO },
      { local: 'funciones', tipo: 'barras', fuente: 'ia', dimension: 'funcion', metricas: ['llamadas'], ordenMetrica: 'llamadas', titulo: 'Para qué se usa' },
      { local: 'proveedores', tipo: 'circular', fuente: 'ia', dimension: 'proveedor', metricas: ['llamadas'], titulo: 'Por proveedor' },
      { local: 'flow', tipo: 'columnas', fuente: 'flow', dimension: 'tipo', desglose: 'estado', metricas: ['trabajos'], titulo: 'Videos e imágenes' },
      // Vivía en «WhatsApp y MaKo», que se fue en v5: lo que tu equipo le pide a MaKo es uso de la IA.
      { local: 'quien', tipo: 'barras', fuente: 'mako_chat', dimension: 'quien', metricas: ['mensajes'], titulo: 'Quién le escribe a MaKo' },
    ],
  },
];

/** Las generales, en el orden de la galería. */
export const PLANTILLAS_GENERALES: readonly PlantillaHoja[] = DEFINICIONES_GENERALES.map(plantilla);

/** Para buscar sin acentos ni mayúsculas. */
const plano = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Las plantillas que pasan el buscador del modal (nombre + línea + `buscar`, sin acentos ni mayúsculas). Recibe
 * la lista (`PLANTILLAS_HOJA`) en vez de importarla: lib/graficos-plantillas.ts importa este archivo.
 * «Hoja en blanco» no pasa por acá: va primera siempre (app/dashboard/NuevaHoja.tsx).
 * `buscar` (v5): las tabs de Analysts se buscan por el nombre que tenían («Landing Analyst»), que la hoja ya no
 * dibuja — sin eso, «analyst» encontraba 1 de 4 (relevo E, punto 21).
 */
export function filtrarPlantillasHoja(lista: readonly PlantillaHoja[], texto: string): PlantillaHoja[] {
  const q = plano(texto.trim());
  if (!q) return [...lista];
  return lista.filter((p) => plano(`${p.nombre} ${p.linea} ${p.buscar ?? ''}`).includes(q));
}
