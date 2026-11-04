// =============================================================================
// graficos-plantillas-generales — las plantillas de «Nueva hoja» armadas con el catálogo (punto 19)
// =============================================================================
// Martín, 11/10/2026: «replica el modal que tenemos en "Automations", en donde al principio tenemos
// la opción de "Pídeselo a MaKo" y abajo se le ofrece TEMPLATES». Marketing y Comercial son las dos
// tabs viejas (lib/graficos-plantillas.ts); las de Analysts las arma lib/graficos-plantillas-analysts.ts.
// Éstas son las del resto de MaKo, una por área: la cobranza, las automatizaciones y la IA (el CRM se fue el 4/11/2026: lo absorbe
// Comercial, `PLANTILLAS_REEMPLAZADAS`). (El Plan
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

import { sanearComponente, type Componente, type DisenoHoja, type Preset } from './graficos-catalogo';
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
  /** Otras palabras con las que se la busca en «Nueva hoja» (el nombre de antes: «Foco de la semana» para Focus). */
  buscar?: string;
  /** El control de período de arriba de la hoja: lo que muestra de entrada. */
  periodo: Preset;
  piezas: PiezaPlantilla[];
  /** El tema de la hoja (la plantilla de lib/graficos-temas.ts). Ausente = el de MaKo. Lo usan las de General. */
  tema?: string;
  /** Los controles de la HOJA además del período (22/10/2026: el «Funnel» de «Cobros», para elegir qué CRM o CRMs mira). */
  controles?: Array<Record<string, unknown>>;
  /**
   * Los botones de la hoja (el elemento «Acción», ACCIONES_ELEMENTO de lib/graficos-acciones.ts), aparte de las piezas: las piezas son la
   * forma que escribe la IA y pasan por su puerta (tests/graficos-ia.test.ts), y un botón no es eso. El de Cold Calling: «Grabar llamada».
   */
  acciones?: Array<{ local: string; accion: string; rotulo: string }>;
  /**
   * El DISEÑO PROPIO de la hoja (4/11/2026, `Hoja.diseno`): qué componente dibuja mirando, y de qué pieza lee cada bloque, por su
   * nombre `local` (acá) → el id de la pieza (al armar). La de Cobranza es la copia de Coffer (app/dashboard/disenos/HojaCobranza.tsx).
   */
  diseno?: { id: DisenoHoja['id']; piezas: Record<string, string> };
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
    id: d.id, nombre: d.nombre, emoji: d.emoji, linea: d.linea, ...(d.buscar ? { buscar: d.buscar } : {}),
    armar: (id) => {
      const botones = (d.acciones ?? []).map((a) => ({ id: id(a.local), clase: 'elemento', tipo: 'accion', texto: '', accion: { id: a.accion, rotulo: a.rotulo }, w: 3, h: 2 }));
      const componentes = [...d.piezas.map((p) => aComponente(p, id)), ...botones]
        .map((c) => sanearComponente(c))
        .filter((c): c is Componente => c != null);
      return {
        id: id(d.id), nombre: d.nombre, emoji: d.emoji, subtitulo: d.subtitulo,
        controles: [{ id: id(`${d.id}-periodo`), tipo: 'periodo', preset: d.periodo }, ...(d.controles ?? []).map((c, i) => ({ ...c, id: id(`${d.id}-c${i}`) }))],
        componentes: acomodar(componentes),
        ...(d.tema ? { tema: { plantilla: d.tema, acento: null, fuente: null } } : {}),
        ...(d.diseno ? { diseno: { id: d.diseno.id, piezas: Object.fromEntries(Object.entries(d.diseno.piezas).map(([k, local]) => [k, id(local)])) } } : {}),
      };
    },
  };
}

const AGRUPAR_AUTO = [{ tipo: 'agrupar', agrupar: 'auto' }];

/** Las definiciones, a la vista de los tests (que las pasan por `deIAHoja`). */
export const DEFINICIONES_GENERALES: readonly DefinicionGeneral[] = [
  {
    // 4/11/2026 — COFFER · CORVANE · TALVO (docs/templates-dashboard-propuesta.md §7.3): «¿qué plata está prometida y no entró?».
    // Coffer: los tramos de lo vencido y «a quién perseguir» con su sello; Talvo: la frase con lo que vence y lo que falta; Corvane:
    // el porqué de cada número escrito al lado. La plata que se mudó de Comercial (la barra cobrado / pendiente) vive acá.
    // Mockup: docs/diseno/mockups-dashboard/cobranza.html.
    // «Este mes completo»: lo que VENCE mira hacia adelante (`pagos.vencimiento` es `futuro`), así que el mes entra entero; lo
    // cobrado igual se corta en hoy (decisión de la tanda v5).
    id: 'cobranza', nombre: 'Cobranza', emoji: '💳',
    linea: 'La plata prometida que no entró: lo que vence, a quién perseguir y hace cuánto esperan.',
    subtitulo: 'Las cuotas de tus clientes.', periodo: 'este_mes_completo',
    // EL SELECTOR DE CRM (22/10/2026, llamada con un cliente: «que tú le puedas seleccionar de qué CRM quieres ver ese dashboard»): el
    // «Funnel» de la hoja, en «Todos» de entrada.
    controles: [{ tipo: 'lista', campo: 'producto', valores: null }],
    piezas: [
      {
        local: 'apertura', tipo: 'frase', fuente: 'pagos', fecha: 'vencimiento', metricas: ['monto', 'cobrado', 'pendiente'], dimension: null, titulo: 'Lo prometido',
        frase: 'En el período vencen {monto} · entraron {cobrado} · faltan {pendiente}', ir: 'clients',
      },
      // 4/11/2026 — EL DISEÑO DE COFFER (app/dashboard/disenos/HojaCobranza.tsx, maquetas en docs/diseno/mockups-dashboard/cobranza/):
      // cada bloque lee una de estas piezas (`diseno.piezas`, abajo). Sus cuatro números de la derecha («Paid · Spent · Profit ·
      // Average days to be paid») son lo cobrado, lo que vence, lo que falta y cuánto tardan en pagar, cada uno contra el mes anterior.
      { local: 'cobrado', tipo: 'numero_tendencia', fuente: 'pagos', fecha: 'pago', metricas: ['cobrado'], dimension: null, titulo: 'Cobrado', comparar: true, invertida: true, ir: 'clients' },
      { local: 'vence', tipo: 'numero_tendencia', fuente: 'pagos', fecha: 'vencimiento', metricas: ['monto'], dimension: null, titulo: 'Lo que vence', comparar: true, ir: 'clients' },
      { local: 'falta', tipo: 'numero_tendencia', fuente: 'pagos', fecha: 'vencimiento', metricas: ['pendiente'], dimension: null, titulo: 'Falta cobrar', comparar: true, ir: 'clients' },
      { local: 'atraso-pago', tipo: 'numero_tendencia', fuente: 'pagos', fecha: 'pago', metricas: ['atraso_pago'], dimension: null, titulo: 'Atraso al pagar', subtitulo: 'Días después del vencimiento, en promedio', comparar: true },
      // El flujo de Coffer («Cash flow», 6M / 12M): de lo que vencía cada mes, lo que entró y lo que sigue sin pagar.
      {
        local: 'meses', tipo: 'columnas', fuente: 'pagos', fecha: 'vencimiento', dimension: 'mes', metricas: ['cobrado', 'pendiente'], titulo: 'Lo que vencía cada mes',
        subtitulo: 'Lo que entró y lo que sigue sin pagar', controles: [{ tipo: 'periodo', preset: 'ult12m', fijo: true }],
      },
      // La barra de Coffer («Not due · 1–30 · 31–60 · 60+»): TODO lo que se debe hoy, por los días que lleva vencido.
      {
        local: 'atraso', tipo: 'barras', fuente: 'pagos', fecha: 'vencimiento', dimension: 'atraso', metricas: ['pendiente', 'pagos', 'clientes'], titulo: 'Cuánto hace que esperan',
        subtitulo: 'Todo lo que te deben, por días de atraso', controles: [{ tipo: 'periodo', preset: 'todo', fijo: true }, { tipo: 'lista', campo: 'estado', valores: ['Vencido', 'Pendiente'], fijo: true }],
      },
      { local: 'por-funnel', tipo: 'barras', fuente: 'pagos', dimension: 'producto', metricas: ['pendiente'], titulo: 'Pendiente por funnel', subtitulo: 'Qué oferta tiene más plata en el aire' },
      // La que era el bloque «A quién cobrarle»: una fila por cliente, el más urgente arriba, «Marcar cobrada».
      {
        local: 'a-quien', tipo: 'tabla', fuente: 'cobranza', dimension: 'cliente', metricas: ['pendiente', 'proxima_monto', 'dias'], titulo: 'A quién perseguir',
        subtitulo: 'Te está esperando: el más urgente arriba, con «Marcar cobrada»',
        ordenMetrica: 'dias', ordenAsc: true, limite: 50, tabla: { acciones: true, columnas: ['urgencia', 'proxima'] },
      },
      { local: 'por-cliente', tipo: 'barras', fuente: 'pagos', dimension: 'cliente', metricas: ['pendiente'], titulo: 'Quién debe más', subtitulo: 'Los cinco con más pendiente', limite: 5 },
      // «Top clients» y «Latest» de Coffer: quién más pagó en el año y cada cuota que entró, la última arriba.
      {
        local: 'pagaron', tipo: 'barras', fuente: 'pagos', fecha: 'pago', dimension: 'cliente', metricas: ['cobrado'], titulo: 'Los que más pagaron', subtitulo: 'Los últimos 12 meses',
        limite: 5, controles: [{ tipo: 'periodo', preset: 'ult12m', fijo: true }],
      },
      {
        local: 'ultimos', tipo: 'tabla', fuente: 'pagos', fecha: 'pago', dimension: 'cobro', metricas: ['cobrado'], titulo: 'Lo último que entró', subtitulo: 'Las cuotas cobradas de los últimos 30 días',
        limite: 50, tabla: { columnas: ['dia'] }, controles: [{ tipo: 'periodo', preset: 'ult30', fijo: true }],
      },
    ],
    diseno: {
      id: 'cobranza',
      piezas: {
        atraso: 'atraso', cobrado: 'cobrado', vence: 'vence', falta: 'falta', demora: 'atraso-pago', meses: 'meses',
        perseguir: 'a-quien', ultimos: 'ultimos', pagaron: 'pagaron', funnel: 'por-funnel',
      },
    },
  },
  {
    id: 'automatizaciones', nombre: 'Automatizaciones', emoji: '⚙️',
    linea: 'Qué salió de cada automatización, qué falló, cuántos te responden y en cuánto tiempo.',
    subtitulo: 'Tus automatizaciones del período.', periodo: 'ult30',
    piezas: [
      // COMPOSICIÓN DEL 31/10/2026: la tabla por automatización es el tema de la hoja. «Por canal» era una torta estirada.
      // 4/11/2026 — NORIA (docs/templates-dashboard-propuesta.md §7.3): «¿qué corrió, qué falló y cuántas horas ahorró?». Abre con la
      // frase de lo que salió y lo que falló; el ancla es lo que falló, y la tabla dice en cuál. ⚠️ Las horas AHORRADAS no se miden
      // (pedirían cuánto tardaría una persona en hacerlo a mano): lo que hay es en cuántas horas responden.
      // 4/11/2026 — EL DISEÑO DE NORIA (app/dashboard/disenos/HojaAutomatizaciones.tsx, maquetas en
      // docs/diseno/mockups-dashboard/automatizaciones-noria/): cada bloque lee una de estas piezas (`diseno.piezas`, abajo). La frase
      // compara (los cuatro números llevan su cambio), el día a día es lo que salió y lo que falló, y las dos piezas de los últimos 14
      // días (los envíos y los fallos por día y por automatización) son las casillas de «Qué tan bien salen» y la línea de la tabla.
      {
        local: 'resumen', tipo: 'frase', fuente: 'envios', metricas: ['enviados', 'fallaron', 'respuestas'], dimension: null, titulo: 'Tus automatizaciones',
        frase: 'Salieron {enviados} mensajes · {fallaron} fallaron · {respuestas} te respondieron', ir: 'automations', comparar: true,
      },
      { local: 'entraron', tipo: 'numero_tendencia', fuente: 'inscripciones', metricas: ['personas'], dimension: null, titulo: 'Personas que entraron', comparar: true },
      { local: 'fallaron', tipo: 'numero_tendencia', fuente: 'envios', metricas: ['fallaron'], dimension: null, titulo: 'Fallaron', invertida: true, ir: 'automations' },
      { local: 'apertura', tipo: 'numero_tendencia', fuente: 'envios', metricas: ['tasa_apertura'], dimension: null, titulo: 'Tasa de apertura' },
      { local: 'respuesta', tipo: 'numero_tendencia', fuente: 'envios', metricas: ['tasa_respuesta'], dimension: null, titulo: 'Tasa de respuesta', comparar: true },
      { local: 'por-dia', tipo: 'serie', fuente: 'envios', dimension: 'dia', metricas: ['enviados', 'fallaron'], titulo: 'Lo que salió y lo que falló', controles: AGRUPAR_AUTO },
      {
        local: 'por-automatizacion', tipo: 'tabla_barras', fuente: 'envios', dimension: 'automatizacion', metricas: ['envios', 'fallaron', 'respuestas', 'tasa_respuesta', 'leads'],
        titulo: 'Por automatización', ir: 'automations',
      },
      { local: 'desenlace', tipo: 'barras', fuente: 'inscripciones', dimension: 'desenlace', metricas: ['personas', 'respondieron', 'en_curso'], titulo: 'Cómo terminaron' },
      { local: 'donde-fallo', tipo: 'barras', fuente: 'envios', dimension: 'automatizacion', metricas: ['fallaron'], ordenMetrica: 'fallaron', limite: 8, titulo: 'Dónde falló' },
      {
        local: 'horas', tipo: 'barras', fuente: 'inscripciones', fecha: 'alta', dimension: 'automatizacion', metricas: ['horas_respuesta', 'respondieron'], ordenMetrica: 'horas_respuesta',
        limite: 8, titulo: 'En cuántas horas responden',
      },
      { local: 'envios-dia', tipo: 'serie', fuente: 'envios', dimension: 'dia', desglose: 'automatizacion', metricas: ['envios'], titulo: 'Envíos por día, por automatización' },
      { local: 'fallos-dia', tipo: 'serie', fuente: 'envios', dimension: 'dia', desglose: 'automatizacion', metricas: ['fallaron'], titulo: 'Fallos por día, por automatización' },
    ],
    diseno: {
      id: 'automatizaciones',
      piezas: {
        apertura: 'resumen', entraron: 'entraron', respuesta: 'respuesta', dias: 'por-dia', tabla: 'por-automatizacion', recorrido: 'desenlace',
        fallos: 'donde-fallo', horas: 'horas', vol: 'envios-dia', fal: 'fallos-dia',
      },
    },
  },
  {
    id: 'ia-contenido', nombre: 'Contenido e IA', emoji: '✨',
    linea: 'Cuánta IA gastas y en qué, y los videos e imágenes que MaKo le pidió a Flow.',
    subtitulo: 'La IA y la producción de contenido.', periodo: 'ult30',
    piezas: [
      // COMPOSICIÓN DEL 31/10/2026: cuánto se usa, cuánto cuesta, cuánto cuesta cada una y cuánto salió. Se fue «Por proveedor»: ninguna
      // hoja lo dibuja desde acá, y los videos e imágenes van como tabla, con su tasa de éxito adentro.
      // 4/11/2026 — ORRERY (docs/templates-dashboard-propuesta.md §7.3): «¿cuánta IA gastamos y en qué?». Abre con la frase de cuántas
      // veces se usó; el ancla es el costo, el anillo dice en qué función se va y el modelo cuál cuesta más.
      {
        local: 'resumen', tipo: 'frase', fuente: 'ia', metricas: ['llamadas'], dimension: null, titulo: 'Tu IA', comparar: true,
        frase: 'Usaste la IA {llamadas} veces · {llamadas:cambio} que el período anterior',
      },
      { local: 'costo', tipo: 'numero_tendencia', fuente: 'ia', metricas: ['costo'], dimension: null, titulo: 'Costo de la IA', comparar: true, invertida: true },
      { local: 'costo-prom', tipo: 'numero_tendencia', fuente: 'ia', metricas: ['costo_prom'], dimension: null, titulo: 'Costo por llamada' },
      { local: 'pedidos', tipo: 'numero_tendencia', fuente: 'flow', metricas: ['trabajos'], dimension: null, titulo: 'Pedidos a Flow', ir: 'video-generator' },
      { local: 'listos', tipo: 'numero_tendencia', fuente: 'flow', metricas: ['tasa_exito'], dimension: null, titulo: 'Salieron bien' },
      { local: 'por-dia', tipo: 'serie', fuente: 'ia', dimension: 'dia', metricas: ['costo'], titulo: 'Lo gastado por día', controles: AGRUPAR_AUTO },
      { local: 'funciones', tipo: 'barras', fuente: 'ia', dimension: 'funcion', metricas: ['llamadas'], ordenMetrica: 'llamadas', titulo: 'Para qué se usa' },
      { local: 'modelos', tipo: 'barras', fuente: 'ia', dimension: 'modelo', metricas: ['costo'], ordenMetrica: 'costo', limite: 6, titulo: 'Qué modelo cuesta más' },
      // Vivía en «WhatsApp y MaKo», que se fue en v5: lo que tu equipo le pide a MaKo es uso de la IA.
      { local: 'quien', tipo: 'barras', fuente: 'mako_chat', dimension: 'quien', metricas: ['mensajes'], titulo: 'Quién le escribe a MaKo' },
      { local: 'flow', tipo: 'tabla_barras', fuente: 'flow', dimension: 'tipo', metricas: ['trabajos', 'listos', 'fallidos', 'tasa_exito'], barra: 'trabajos', titulo: 'Videos e imágenes', ir: 'video-generator' },
    ],
  },
  {
    // 4/11/2026 — INMOBILIARIA, la primera por RUBRO (docs/templates-dashboard-propuesta.md §6, regla 3, y §7.3, LINTEL): se copia
    // SÓLO su Overview, la página que informa (las otras cinco dejan trabajar: ya son el CRM). La pregunta es la del rubro: ¿cuántos
    // interesados visitan, cuántos compran y en qué proyecto? «Proyecto» es el funnel de MaKo (un desarrollo, una propiedad), así que
    // le sirve a cualquier negocio que venda inmuebles. ⚠️ Lintel pone «97 % win rate» sin denominador ni ventana: acá cada tasa dice
    // de qué ES en su título («de los que visitan»).
    id: 'inmobiliaria', nombre: 'Inmobiliaria', emoji: '🏠', buscar: 'bienes raíces desarrollos propiedades proyectos',
    linea: 'Cuántos interesados visitan, cuántos compran y en qué proyecto, quién vende y por qué no compraron.',
    subtitulo: 'Tus interesados, de la visita a la compra.', periodo: 'ult90',
    controles: [{ tipo: 'lista', campo: 'producto', valores: null }],
    piezas: [
      {
        local: 'apertura', tipo: 'frase', fuente: 'leads', fecha: 'alta', metricas: ['leads', 'agendas', 'cierres'], dimension: null, titulo: 'Tus interesados',
        frase: 'Entraron {leads} interesados · {agendas} agendaron una visita · {cierres} ya compraron', ir: 'crm',
      },
      { local: 'cierre', tipo: 'numero_tendencia', fuente: 'leads', fecha: 'agenda', metricas: ['tasa_cierre'], dimension: null, titulo: 'Compran, de los que visitan', comparar: true, invertida: true, ir: 'closing' },
      { local: 'asistencia', tipo: 'numero_tendencia', fuente: 'leads', fecha: 'agenda', metricas: ['tasa_asistencia'], dimension: null, titulo: 'Vienen a la visita', comparar: true, ir: 'calendario' },
      { local: 'ticket', tipo: 'numero_tendencia', fuente: 'leads', fecha: 'cierre', metricas: ['ticket'], dimension: null, titulo: 'Ticket promedio', ir: 'crm' },
      { local: 'ciclo', tipo: 'numero_tendencia', fuente: 'leads', fecha: 'cierre', metricas: ['ciclo_cierre'], dimension: null, titulo: 'Días hasta comprar', ir: 'crm' },
      { local: 'por-semana', tipo: 'columnas', fuente: 'leads', fecha: 'alta', dimension: 'semana', metricas: ['leads', 'agendas'], titulo: 'Interesados y visitas, por semana' },
      {
        local: 'por-proyecto', tipo: 'tabla_barras', fuente: 'leads', fecha: 'alta', dimension: 'producto', metricas: ['leads', 'agendas', 'cierres'], barra: 'leads',
        titulo: 'Por proyecto', ir: 'crm',
      },
      { local: 'origen', tipo: 'barras', fuente: 'leads', fecha: 'alta', dimension: 'origen', metricas: ['leads'], limite: 8, titulo: 'De dónde llegan' },
      { local: 'etapa', tipo: 'barras', fuente: 'leads', fecha: 'alta', dimension: 'etapa', metricas: ['leads'], titulo: 'En qué etapa están', ir: 'crm' },
      {
        local: 'asesores', tipo: 'tabla', fuente: 'leads', fecha: 'agenda', dimension: 'closer', metricas: ['asistencias', 'cierres', 'tasa_cierre', 'vendido'],
        ordenMetrica: 'vendido', titulo: 'Quién vende', subtitulo: 'Las visitas que recibió, las que cerró y lo que vendió', ir: 'closing',
      },
      { local: 'motivos', tipo: 'barras', fuente: 'leads', dimension: 'motivo', metricas: ['leads'], limite: 8, titulo: 'Por qué no compraron', subtitulo: 'Lo que se marcó al perder, contado' },
      { local: 'donde', tipo: 'mapa', fuente: 'ubicacion', dimension: 'region', metricas: ['visitas'], titulo: 'De dónde te buscan', subtitulo: 'Las visitas a tus páginas, por región' },
    ],
  },
  {
    // Martín, 04/11/2026: «un dashboard template que sea "Call Calling"», con el mismo botón de grabar de la ficha del lead. Se
    // leyó como COLD CALLING (llamar en frío a una lista). Primero, «Grabar llamada» (elige el lead y graba: la misma grabadora de la
    // ficha) al lado de los números de la tanda; después, lo demás, todos del conjunto `llamadas_grabadas` (lo que se grabó con ese botón). «Cómo terminó»
    // lo marca quien llama al cortar: sin marcar, cuenta en «Sin marcar», nunca como «no contestó».
    id: 'cold-calling', nombre: 'Cold Calling', emoji: '📞',
    linea: 'Graba tus llamadas en frío y mira cuántas contestan, cuántas agendan y quién llama más.',
    subtitulo: 'Las llamadas grabadas en MaKo.', periodo: 'ult7',
    acciones: [{ local: 'grabar', accion: 'grabar_llamada', rotulo: 'Grabar llamada' }],
    piezas: [
      { local: 'llamadas', tipo: 'numero_tendencia', fuente: 'llamadas_grabadas', metricas: ['llamadas'], dimension: null, titulo: 'Llamadas', comparar: true, invertida: true },
      { local: 'contacto', tipo: 'numero_tendencia', fuente: 'llamadas_grabadas', metricas: ['tasa_contacto'], dimension: null, titulo: 'Contestaron' },
      { local: 'agendaron', tipo: 'numero_tendencia', fuente: 'llamadas_grabadas', metricas: ['agendaron'], dimension: null, titulo: 'Agendaron' },
      { local: 'por-dia', tipo: 'serie', fuente: 'llamadas_grabadas', dimension: 'dia', metricas: ['llamadas', 'contestaron', 'agendaron'], titulo: 'Llamadas por día', controles: AGRUPAR_AUTO },
      { local: 'como-terminan', tipo: 'anillo', fuente: 'llamadas_grabadas', dimension: 'resultado', metricas: ['llamadas'], titulo: 'Cómo terminan' },
      { local: 'quien', tipo: 'tabla_barras', fuente: 'llamadas_grabadas', dimension: 'autor', metricas: ['llamadas', 'contestaron', 'agendaron', 'tasa_contacto'], barra: 'llamadas', titulo: 'Quién llamó' },
      {
        local: 'leads', tipo: 'tabla', fuente: 'llamadas_grabadas', dimension: 'lead', metricas: ['llamadas', 'minutos'], titulo: 'A quién llamaste',
        limite: 50, tabla: { acciones: true, columnas: ['resultado'] },
      },
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
