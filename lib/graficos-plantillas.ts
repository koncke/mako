// =============================================================================
// graficos-plantillas — las hojas armadas: el informe inicial y lo que ofrece «Nueva hoja»
// =============================================================================
// Martín, 11/10/2026: «personalices las 2 tabs de Mauricio como estaban en este editor» y, en el
// feedback de veinte puntos, «Faltan muchas cosas que sacaste que teníamos con Mauricio. Vuelvelo a
// agregar... Como el filtro de fecha... Los gráficos interactivos, el gráfico de México... En
// Comercial está diferente la parte de "A quién cobrarle", antes era un desplegable...» (punto 5) y
// «Al momento de crear un nuevo lienzo, replica el modal que tenemos en "Automations"... TEMPLATES»
// (punto 19).
//
// Una plantilla es una FUNCIÓN que arma la hoja: así las del modal salen con ids nuevos cada vez
// (`instanciarPlantilla`) y el informe inicial con ids FIJOS. ⚠️ Los ids del inicial no pueden ser al
// azar: quien sólo MIRA nunca guarda (alMoverGrilla, EditorInforme.tsx), así que recibe el inicial en
// cada carga, y con ids nuevos cada vez lo que se ata a un gráfico por id (lo elegido en sus
// controles, el chat de MaKo) se perdería en cada recarga.
//
// ⚠️ SIN `server-only`: lo leen el server (el inicial), la pantalla (el modal) y los tests. Y SIN
//    datos de ningún cliente (AGENTS.md: un ejemplo de pantalla es ficticio por regla).
//
// Desde el 11/10/2026 también vive acá A DÓNDE LLEVA un link a una hoja (`hojaDestino`, abajo) y la hoja
// ÚNICA de un rol (`HOJA_DE_ROL`): Closing, Ads y Landing Analyst se retiraron de la sidebar y sus rutas
// traen al Dashboard con `?hoja=` (decisión 6 de Martín: «Closing Analyst va COMPLETO al Dashboard… Los
// closers ven SÓLO la hoja Closing»).
//
// TANDA v5 (12/10/2026, contrato docs/relevo/dashboard-v5.md):
//   · SIN BLOQUES: Marketing y Comercial se arman con gráficos y elementos del catálogo (la tabla «Los bloques
//     se van»), con los MISMOS ids que la migración del saneo le pone a un informe guardado de antes
//     (lib/graficos-migrar-v5.ts). No dependen de la migración: ella es para lo GUARDADO.
//   · Cada hoja dice de qué plantilla nació (`Hoja.plantilla`): `hojaDestino` pregunta eso primero, y la
//     FIRMA de antes queda sólo de respaldo (los ids fijos de Marketing y Comercial).
//   · El SETTER ve SÓLO la hoja Chat Analyst, como el closer con Closing (`HOJA_DE_ROL`).
//   · Las plantillas de POP-UP («Llamada», «Anuncio») viven en lib/graficos-plantillas-analysts.ts y se
//     reexportan acá.

import {
  MAX_HOJAS, NOMBRE_INICIAL, campoDe, esElemento, esGrafico, hojaVacia, nuevoId, sanearComponente, sanearGrafico, sanearHoja,
  type Componente, type Hoja, type Tablero,
} from './graficos-catalogo';
import { ARMADO, PLANTILLAS_ANALYSTS, PLANTILLAS_POPUP, POPUP_ANUNCIO } from './graficos-plantillas-analysts';
import { PLANTILLAS_GENERALES, plantilla } from './graficos-plantillas-generales';
import { comoDenso, portadasDashboard } from './graficos-portadas';
import { PLANTILLAS_GENERAL } from './general-plantillas';
import type { RolWorkspace } from './auth-session';
import { CAPA_DE_HOJA_DE_ROL } from './graficos-roles';

export { PLANTILLAS_POPUP, POPUP_ANUNCIO, POPUP_LLAMADA, type PlantillaPopup } from './graficos-plantillas-analysts';

/** Una plantilla de la galería de «Nueva hoja». */
export type PlantillaHoja = {
  id: string;
  nombre: string;
  emoji: string;
  /** Una frase, ~110 caracteres: es texto de pantalla. */
  linea: string;
  /**
   * Otras palabras con las que se la busca en el modal, que no se dibujan: «Landing Analyst» para la hoja
   * Landing (la tab se llamaba así y la gente la busca por ese nombre). Ausente = sólo el nombre y la línea.
   */
  buscar?: string;
  /** Arma la hoja con los ids que le pasan (fijos para el inicial, nuevos para el modal). */
  armar: (id: (local: string) => string) => Record<string, unknown>;
};

const { kpi, fijo, periodoFijo, periodoVisible, popupDe } = ARMADO;

const MARKETING: PlantillaHoja = {
  id: 'marketing', nombre: 'Marketing', emoji: '📣',
  linea: 'Cuánto te cuesta una agenda, de qué anuncio y campaña vino, y quién ve tus anuncios.',
  armar: (id) => ({
    id: id('marketing'), nombre: 'Marketing', emoji: '📣', subtitulo: 'La pauta, lo que trae y a quién le llega.',
    controles: [{ id: id('mk-periodo'), tipo: 'periodo', preset: 'ult30' }],
    // 4/11/2026 — KESTREL · ONDRA (docs/templates-dashboard-propuesta.md §7.3): «¿cuánto cuesta una agenda y de qué anuncio vino?».
    // 4/11/2026 (tarde): la hoja trae su DISEÑO PROPIO, la copia de Kestrel (app/dashboard/disenos/HojaMarketing.tsx; copia y
    // adaptación en docs/diseno/mockups-dashboard/marketing-kestrel/). Kestrel abre con seis números con su cambio (acá: costo por
    // agenda, ROAS cobrado, agendas, gasto, CTR y costo por lead), sigue con sus tendencias, una tabla con pestañas (por anuncio, por
    // campaña y día por día) y dos bloques por red (lo que trae la pauta, del anuncio a la agenda, y qué red trae agendas).
    // El costo por cierre vive en Comercial, y la edad y el mapa, que Kestrel no tiene, salieron (una hoja de antes no cambia).
    // ⚠️ Los ids de la FIRMA (mk-spend, mk-funnel, mk-tendencias, mk-anuncios) no cambian: reconocen la hoja guardada de antes.
    componentes: [
      {
        id: id('mk-apertura'), clase: 'grafico', tipo: 'frase', fuente: 'negocio', metricas: ['gasto', 'agendas', 'cpa'], comparar: true,
        titulo: 'Tu pauta', frase: 'Gastaste {gasto} en anuncios · trajeron {agendas} agendas · cada una costó {cpa} · {cpa:cambio} que el período anterior',
        ir: 'ads-manager', x: 0, y: 0, w: 12, h: 3,
      },
      // LA INVERTIDA: el costo por agenda, que es la pregunta de la hoja. Los seis, con su cambio contra el período anterior.
      kpi(id('mk-cpa'), 'negocio', 'cpa', 'Costo por agenda', '', 0, 3, { tipo: 'numero_tendencia', w: 2, comparar: true, invertida: true, ir: 'ads-manager' }),
      kpi(id('mk-roas-cash'), 'negocio', 'roas_cobrado', 'ROAS cobrado', '', 2, 3, { tipo: 'numero_tendencia', w: 2, comparar: true, ir: 'cobranza' }),
      kpi(id('mk-agendas'), 'negocio', 'agendas', 'Agendas', '', 4, 3, { tipo: 'numero_tendencia', w: 2, comparar: true, ir: 'crm' }),
      kpi(id('mk-spend'), 'negocio', 'gasto', 'Ad Spend', '', 6, 3, { tipo: 'numero_tendencia', w: 2, comparar: true, ir: 'ads-manager' }),
      kpi(id('mk-ctr'), 'meta', 'ctr', 'CTR', '', 8, 3, { tipo: 'numero_tendencia', w: 2, comparar: true, ir: 'ads-manager' }),
      kpi(id('mk-cpl'), 'negocio', 'cpl', 'Costo por lead', '', 10, 3, { tipo: 'numero_tendencia', w: 2, comparar: true, ir: 'ads-manager' }),
      // Tendencias: agrupa sola por día, semana o mes según el período. El diseño las dibuja contra la primera semana.
      {
        id: id('mk-tendencias'), clase: 'grafico', tipo: 'serie', fuente: 'negocio', dimension: 'dia', metricas: ['gasto', 'leads', 'agendas'],
        titulo: 'Tendencias', subtitulo: 'Lo gastado y lo que trajo, en el tiempo', x: 0, y: 7, w: 12, h: 12,
        controles: [{ id: id('mk-tendencias-agrupar'), tipo: 'agrupar', agrupar: 'auto' }],
      },
      {
        id: id('mk-funnel'), clase: 'grafico', tipo: 'embudo_vertical', fuente: 'negocio', metricas: ['impresiones', 'clics', 'vistas_landing', 'vistas_vsl', 'leads', 'agendas'],
        comparar: true, titulo: 'Del anuncio a la agenda', subtitulo: 'Cuántos pasan cada escalón', x: 0, y: 19, w: 6, h: 12,
      },
      // Kestrel tiene su bloque por red: acá, cuántas agendas trae cada una (en vivo de Meta).
      { id: id('mk-plataforma'), clase: 'grafico', tipo: 'barras', fuente: 'audiencia', dimension: 'plataforma', metricas: ['agendas', 'impresiones', 'ctr', 'cpm'], titulo: 'Qué red trae agendas', subtitulo: 'Instagram, Facebook y el resto', x: 6, y: 19, w: 6, h: 12 },
      {
        id: id('mk-campanas'), clase: 'grafico', tipo: 'tabla_barras', fuente: 'meta', dimension: 'campana', metricas: ['agendas', 'gasto', 'leads', 'cpa', 'anuncios'],
        ordenMetrica: 'agendas', barra: 'agendas', limite: 10, titulo: 'Qué campaña trae agendas', subtitulo: 'Ordenadas por agendas, con su costo',
        ir: 'ads-manager', x: 0, y: 31, w: 12, h: 10,
      },
      // Los anuncios del período, como TARJETAS (con su miniatura), ordenados por lo que trajeron. El clic abre el anuncio.
      {
        id: id('mk-anuncios'), clase: 'grafico', tipo: 'tarjetas', fuente: 'meta', dimension: 'anuncio', metricas: ['agendas', 'gasto', 'leads', 'cpa'],
        ordenMetrica: 'agendas', barra: 'agendas', limite: 10, tabla: { columnas: ['campana'] },
        titulo: 'De qué anuncio vino', subtitulo: 'Los anuncios del período, del que más agendas trajo', x: 0, y: 41, w: 12, h: 12,
        alClic: 'popup', popup: popupDe(POPUP_ANUNCIO, id, 'mk-anuncios'),
      },
    ],
    diseno: {
      id: 'marketing',
      piezas: {
        apertura: id('mk-apertura'), cpa: id('mk-cpa'), roas: id('mk-roas-cash'), agendas: id('mk-agendas'), gasto: id('mk-spend'), ctr: id('mk-ctr'), cpl: id('mk-cpl'),
        tendencias: id('mk-tendencias'), funnel: id('mk-funnel'), plataforma: id('mk-plataforma'), campanas: id('mk-campanas'), anuncios: id('mk-anuncios'),
      },
    },
  }),
};

const COMERCIAL: PlantillaHoja = {
  id: 'comercial', nombre: 'Comercial', emoji: '💼', buscar: 'CRM y pipeline Ventas del mes',
  linea: 'Si convierte y a qué costo: de agenda a cierre, por qué no se cerró, quién cierra y por oferta.',
  armar: (id) => {
    // 4/11/2026 — COFFER · CORBEL · PRISM · ORVEL · PELAGO · SELVAR (docs/templates-dashboard-propuesta.md §6 y §7.3): «¿convierte,
    // y a qué costo?». Comercial mira una TASA (CRM mira una persona, Cobranza una cuota), y absorbe a «CRM y pipeline» y
    // «Ventas del mes», que decían la misma frase. Mockup: docs/diseno/mockups-dashboard/comercial.html.
    // La plata cobrada y «A quién cobrarle» se mudaron a la hoja Cobranza: allá es la pregunta.
    // ⚠️ Los ids de la FIRMA que quedan (co-funnel-embudo, co-tendencia) no cambian: reconocen la hoja guardada de antes.
    // Lo que DEFINE el funnel: las cohortes maduras, en todo el histórico (Martín, 11/10/2026).
    const maduras = (local: string) => [periodoFijo(id(`${local}-fecha`), 'todo'), fijo(id(`${local}-f1`), 'leads.madurez_semana', ['Madura'])];
    const numero = { tipo: 'numero_tendencia', h: 4 };
    return {
      id: id('comercial'), nombre: 'Comercial', emoji: '💼', subtitulo: 'Si convierte, y a qué costo.',
      controles: [{ id: id('co-periodo'), tipo: 'periodo', preset: 'ult30' }],
      componentes: [
        {
          // 4/11/2026 (tarde): una frase lleva hasta 4 métricas, y el diseño de Selvar necesita las cuatro de lo que pasó con las agendas
          // (su barra). La tasa de cierre ya es el primer número y lo vendido, «Lo vendido y lo invertido».
          id: id('co-apertura'), clase: 'grafico', tipo: 'frase', fuente: 'leads', fecha: 'agenda', metricas: ['agendas', 'asistencias', 'no_show', 'cierres'],
          titulo: 'De agenda a cierre', frase: 'De {agendas} agendas vinieron {asistencias} y salieron {cierres} cierres · {no_show} no se presentaron',
          ir: 'crm', x: 0, y: 0, w: 12, h: 3,
        },
        // LA INVERTIDA: la tasa de cierre, que es lo que la hoja pregunta.
        kpi(id('co-tasa'), 'leads', 'tasa_cierre', 'Tasa de cierre', '', 0, 3, { ...numero, fecha: 'agenda', comparar: true, invertida: true, ir: 'closing' }),
        kpi(id('co-ticket'), 'leads', 'ticket', 'Ticket promedio', '', 3, 3, { ...numero, fecha: 'cierre', comparar: true, ir: 'crm' }),
        kpi(id('co-costo-cierre'), 'negocio', 'cac', 'Costo por cierre', '', 6, 3, { ...numero, comparar: true, ir: 'marketing' }),
        kpi(id('co-ciclo'), 'leads', 'ciclo_cierre', 'Días hasta el cierre', '', 9, 3, { ...numero, fecha: 'cierre', comparar: true, ir: 'crm' }),
        {
          id: id('co-tendencia'), clase: 'grafico', tipo: 'serie', fuente: 'negocio', dimension: 'mes', metricas: ['vendido', 'cobrado'],
          titulo: 'Tendencia', subtitulo: 'Vendido y cobrado, mes a mes', x: 0, y: 7, w: 12, h: 8, controles: [periodoFijo(id('co-tendencia-fecha'), 'ult12m')],
        },
        {
          id: id('co-funnel-embudo'), clase: 'grafico', tipo: 'embudo_vertical', fuente: 'leads', fecha: 'agenda', metricas: ['agendas', 'asistencias', 'limpias', 'cierres'],
          titulo: 'De agenda a plata', subtitulo: 'Cohortes maduras: las que ya tuvieron tiempo de cerrar', x: 0, y: 15, w: 12, h: 10, controles: maduras('co-funnel-embudo'),
        },
        {
          id: id('co-closers'), clase: 'grafico', tipo: 'tabla', fuente: 'leads', fecha: 'agenda', dimension: 'closer', metricas: ['asistencias', 'cierres', 'tasa_cierre', 'vendido'],
          ordenMetrica: 'vendido', titulo: 'Quién cierra', subtitulo: 'Las que vinieron, las que cerró y lo que entró', ir: 'closing', x: 0, y: 25, w: 12, h: 10,
        },
        { id: id('co-motivos'), clase: 'grafico', tipo: 'barras', fuente: 'leads', dimension: 'motivo', metricas: ['leads'], limite: 8, titulo: 'Por qué no se cerró', subtitulo: 'Lo que se marcó al perder, contado', ir: 'crm', x: 0, y: 35, w: 4, h: 7 },
        {
          id: id('co-por-oferta'), clase: 'grafico', tipo: 'tabla_barras', fuente: 'leads', fecha: 'cierre', dimension: 'producto', metricas: ['vendido', 'cierres', 'ticket'], barra: 'vendido',
          titulo: 'Lo vendido por oferta', subtitulo: 'Cada funnel, con su ticket', x: 4, y: 35, w: 4, h: 7,
        },
        {
          id: id('co-origen'), clase: 'grafico', tipo: 'tabla_barras', fuente: 'leads', fecha: 'agenda', dimension: 'origen', metricas: ['agendas', 'cierres', 'tasa_cierre', 'vendido'], barra: 'cierres',
          titulo: 'De dónde vienen los que cierran', subtitulo: 'Por origen del lead', ir: 'crm', x: 8, y: 35, w: 4, h: 7,
        },
        {
          id: id('co-cohortes-mes-tabla'), clase: 'grafico', tipo: 'tabla', fuente: 'leads', fecha: 'agenda', dimension: 'mes', titulo: 'Cohortes mensuales', limite: 6,
          subtitulo: 'Cada mes de agendas, hasta dónde llegó',
          metricas: ['agendas', 'asistencias', 'cierres', 'tasa_cierre_calificadas', 'vendido'],
          tabla: { columnas: ['madurez_mes'], sinVacios: true, descendente: true },
          controles: [periodoFijo(id('co-cohortes-mes-tabla-fecha'), 'todo')],
          x: 0, y: 42, w: 12, h: 12,
        },
        // 4/11/2026 (tarde) — lo que lee el DISEÑO PROPIO (la copia de Selvar, app/dashboard/disenos/HojaComercial.tsx) y no estaba
        // arriba: lo vendido contra el período anterior con lo invertido (el «Closed-won» de Selvar), y lo vendido por semana y por
        // mes, apilado por funnel (su «Bookings»).
        // ⚠️ Una hoja lleva hasta 14 paneles y UNA sola frase (tests/graficos-corbel.test.ts): por eso lo vendido y lo invertido
        //    son columnas por semana (con sus totales y el período anterior), y «por mes» es la Tendencia de arriba.
        {
          id: id('co-plata'), clase: 'grafico', tipo: 'columnas', fuente: 'negocio', dimension: 'semana', metricas: ['vendido', 'gasto'], comparar: true,
          titulo: 'Lo vendido y lo invertido', subtitulo: 'Cada semana del período', ir: 'marketing', x: 0, y: 54, w: 6, h: 8,
        },
        {
          id: id('co-semanas'), clase: 'grafico', tipo: 'columnas', fuente: 'leads', fecha: 'cierre', dimension: 'semana', desglose: 'producto', metricas: ['vendido'],
          titulo: 'Lo vendido por semana', subtitulo: 'Los últimos 90 días, por funnel', x: 6, y: 54, w: 6, h: 8, controles: [periodoFijo(id('co-semanas-fecha'), 'ult90')],
        },
      ],
      // El DISEÑO PROPIO (4/11/2026, Martín: «primero la copia… y después la adaptación»): mirando, la hoja se dibuja como la copia
      // de Selvar (docs/diseno/mockups-dashboard/comercial-selvar/), leyendo los datos de estas piezas. Editando, la grilla.
      diseno: {
        id: 'comercial',
        piezas: {
          apertura: id('co-apertura'), plata: id('co-plata'), tasa: id('co-tasa'), ticket: id('co-ticket'), ciclo: id('co-ciclo'), costo: id('co-costo-cierre'),
          semanas: id('co-semanas'), meses: id('co-tendencia'), embudo: id('co-funnel-embudo'), motivos: id('co-motivos'), origen: id('co-origen'), closers: id('co-closers'),
        },
      },
    };
  },
};

// ── La PORTADA (15/10/2026) ───────────────────────────────────────────────────────────────────────────────────────────
// Martín rechazó las galerías («todos parecen muy iguales», «muchos gráficos juntos parece dashboard»): cada plantilla
// abre con UNA pieza a lo ancho, con la forma de su objetivo y su color (lib/graficos-portadas.ts y
// lib/graficos-identidad.ts). Reemplaza al titular 6 × 6 del 14/10, que dejaba cuatro piezas compitiendo arriba.
const PORTADAS = portadasDashboard();
const conPortadaDe = (p: PlantillaHoja): PlantillaHoja => ({ ...p, armar: (id) => comoDenso(p.armar(id), PORTADAS[p.id], id) });

// ── «Velocidad de llamada»: la hoja de los clientes de Código Inmobiliario (6/11/2026; rehecha el 10/11/2026) ──────────────
// Martín, 6/11: «investigues la metodología que tiene Código Inmobiliario con sus clientes, lo de que les corren campañas, les obligan
// a llamar rápido cuando entra un lead, necesitan el botón de grabar… quiero que armes un dashboard especial para ellos». La
// metodología: docs/dashboards/metodologia-codigo-inmobiliario.md. Y el 10/11, al verla: «se inventó cosas en lugar de copiar los
// templates que ya estábamos copiando… comparado con los otros dashboards es el más feo de todos… con urgencia rehacer este dashboard.
// Y que quede como los otros que tenemos». La de antes juntaba tarjetas de TRES diseños (Cold Calling, Closing y la tabla de
// Marketing) con una tabla y textos propios. Ésta es la COPIA de UN demo, como las demás: la página «Today» de Tend (la recepción de
// una clínica: su sala de espera con los minutos de cada paciente y su botón «Call in» es un lead esperando que lo llamen). La copia:
// docs/diseno/mockups-dashboard/velocidad-tend/; lo que lee cada tarjeta, lib/velocidad-diseno.ts.
// ⚠️ NOMBRA LEADS: no la ve ni un closer ni un setter, que tienen su hoja única (`HOJA_DE_ROL`).
// ⚠️ PASA POR `conPortadaDe`, como Cold Calling: mirando se ve el diseño, y sus piezas (plegadas en «Todas las piezas», o la hoja
//    entera si alguien le saca el diseño) siguen un molde, como las de las demás (tests/graficos-corbel.test.ts).
// ⚠️ DIEZ piezas y el botón «Grabar llamada» (una plantilla general no pasa de 12, `TOPE_COMPONENTES_IA`), y cada pieza es de los
//    conjuntos `primer_contacto`, `conversaciones` y `llamadas_grabadas`. El botón es el de Cold Calling (`grabar_llamada`): el de la
//    cabecera del diseño abre la misma grabadora.
const SIN_CONTACTAR = { tipo: 'lista', campo: 'primer_contacto.tramo', valores: ['Sin contactar'], fijo: true };
const COLUMNAS_LEAD = ['dia', 'setter', 'producto'];
export const VELOCIDAD_LLAMADA: PlantillaHoja = conPortadaDe(plantilla({
  id: 'velocidad-llamada', nombre: 'Velocidad de llamada', emoji: '⏱️',
  linea: 'Cuánto tardan en llamar a cada lead nuevo: quién espera, a quién ya contactaron y las llamadas de hoy.',
  buscar: 'inmobiliaria agencia primer contacto grabar llamada rápido lead nuevo',
  subtitulo: 'Cuánto tardas en llamar a cada lead nuevo.', periodo: 'ult30',
  acciones: [{ local: 'grabar', accion: 'grabar_llamada', rotulo: 'Grabar llamada' }],
  piezas: [
    // Los cuatro números, los números de cada carril y el % contra el período anterior.
    {
      local: 'resumen', tipo: 'tramos', fuente: 'primer_contacto', dimension: null, comparar: true, titulo: 'Primer contacto',
      metricas: ['leads', 'contactados', 'sin_contactar', 'base_1h', 'en_1h', 'mediana_contacto', 'mediana_espera', 'ya_hablaban'],
    },
    // «Patient flow»: los sin contactar de la espera más corta a la más larga (los dos primeros carriles), los contactados (del más
    // rápido) y los que ya hablaban o no se sabe.
    {
      local: 'recien', tipo: 'tabla', fuente: 'primer_contacto', dimension: 'lead', metricas: ['espera'], ordenAsc: true, limite: 50,
      titulo: 'Sin contactar, los más nuevos', tabla: { acciones: true, columnas: COLUMNAS_LEAD }, controles: [SIN_CONTACTAR],
    },
    {
      local: 'contactados', tipo: 'tabla', fuente: 'primer_contacto', dimension: 'lead', metricas: ['espera'], ordenAsc: true, limite: 50,
      titulo: 'Contactados', tabla: { acciones: true, columnas: [...COLUMNAS_LEAD, 'canal'] },
      controles: [{ tipo: 'lista', campo: 'primer_contacto.tramo', valores: ['En la primera hora', 'De 1 a 24 horas', 'De 1 a 3 días', 'Más de 3 días'], fijo: true }],
    },
    {
      local: 'antes', tipo: 'tabla', fuente: 'primer_contacto', dimension: 'lead', metricas: ['leads'], limite: 50,
      titulo: 'Sin medir (ya hablaban o sin dato)', tabla: { acciones: true, columnas: [...COLUMNAS_LEAD, 'tramo'] },
      controles: [{ tipo: 'lista', campo: 'primer_contacto.tramo', valores: ['Ya hablaban antes', 'No se sabe'], fijo: true }],
    },
    // «WhatsApp · waiting on us»: los chats de leads cuyo último mensaje es de la persona, el más reciente primero.
    {
      local: 'chats', tipo: 'tabla', fuente: 'conversaciones', fecha: 'actual', dimension: 'lead', metricas: ['espera_respuesta', 'sin_responder'],
      ordenAsc: true, limite: 50, titulo: 'Esperan respuesta en WhatsApp', tabla: { acciones: true, columnas: ['etapa'] },
    },
    // «Clinicians today» y «Team activity»: las llamadas grabadas hoy, UNA FILA POR LLAMADA (por lead, dos llamadas al mismo lead se
    // juntaban en una), con el lead, quién llamó, cómo terminó y a qué hora. Hasta 50 por día.
    {
      local: 'hoy', tipo: 'tabla', fuente: 'llamadas_grabadas', dimension: 'llamada', metricas: ['llamadas', 'minutos'], limite: 50,
      titulo: 'Llamadas de hoy', tabla: { acciones: true, columnas: ['lead', 'autor', 'resultado', 'hora'] }, controles: [{ tipo: 'periodo', preset: 'hoy', fijo: true }],
    },
    // «Reminders · Tomorrow»: los contactados por cuánto tardaron.
    { local: 'tramos', tipo: 'barras', fuente: 'primer_contacto', dimension: 'tramo', metricas: ['leads'], titulo: 'Cuánto tardaron' },
    // «Visits»: contactados y sin contactar, día por día.
    { local: 'dias', tipo: 'serie', fuente: 'primer_contacto', dimension: 'dia', metricas: ['contactados', 'sin_contactar'], titulo: 'Leads por día' },
    // «Recalls due»: los sin contactar, de la espera más larga.
    {
      local: 'esperan', tipo: 'tabla', fuente: 'primer_contacto', dimension: 'lead', metricas: ['espera'], limite: 10,
      titulo: 'Los que más esperan', tabla: { acciones: true, columnas: COLUMNAS_LEAD }, controles: [SIN_CONTACTAR],
    },
    // «Clinician load»: los leads de cada setter.
    {
      local: 'carga', tipo: 'tabla_barras', fuente: 'primer_contacto', dimension: 'setter', metricas: ['leads', 'contactados', 'sin_contactar', 'mediana_contacto'],
      barra: 'contactados', limite: 10, titulo: 'Carga por setter',
    },
  ],
  diseno: {
    id: 'velocidad',
    piezas: { resumen: 'resumen', recien: 'recien', contactados: 'contactados', antes: 'antes', chats: 'chats', hoy: 'hoy', tramos: 'tramos', dias: 'dias', esperan: 'esperan', carga: 'carga' },
  },
}));

/**
 * La galería de «Nueva hoja», en orden. Marketing y Comercial son las del informe inicial; el resto
 * se arma con los conjuntos del catálogo.
 */
export const PLANTILLAS_HOJA: readonly PlantillaHoja[] = [...[MARKETING, COMERCIAL, ...PLANTILLAS_ANALYSTS, ...PLANTILLAS_GENERALES].map(conPortadaDe), VELOCIDAD_LLAMADA];

/**
 * Las plantillas que se fueron, y la que las reemplaza (v5): la general «WhatsApp y MaKo» es Chat Analyst y
 * «Customer Success» es CS Analyst. AGENTS.md, «Sacar algo de un catálogo no es borrarlo»: un link, un agente de
 * la API o un marcador que nombre la vieja llega a la nueva, y el salto se resuelve ACÁ, por donde pasan todos.
 */
const PLANTILLAS_REEMPLAZADAS: ReadonlyMap<string, string> = new Map([
  ['whatsapp', 'chat-analyst'], ['customer-success', 'cs-analyst'],
  // 4/11/2026 (docs/templates-dashboard-propuesta.md §7.3): las absorbe Comercial, que contesta la misma pregunta.
  ['crm', 'comercial'], ['ventas', 'comercial'],
]);

export const plantillaHojaDe = (id: string) => {
  const vigente = PLANTILLAS_REEMPLAZADAS.get(id) ?? id;
  // 14/10/2026: también las de la tab General (lib/general-plantillas.ts), que arma la MISMA ruta de plantillas.
  return PLANTILLAS_HOJA.find((p) => p.id === vigente) ?? PLANTILLAS_GENERAL.find((p) => p.id === vigente);
};

/**
 * LAS QUE SE OFRECEN (4/11/2026). Martín, mirando producción: «elimina todos los templates viejos y vamos de a poco cargando cuando
 * ya estén». Se ofrece —en «Nueva hoja», en el catálogo de la API y para crear desde una plantilla— SÓLO la que trae su DISEÑO PROPIO
 * copiado de su referencia (`Hoja.diseno`, como Closing con Halden). Se DERIVA del dato, no es una lista a mano: una hoja nueva copiada
 * entra sola el día que su plantilla tenga el diseño.
 * ⚠️ Las demás SIGUEN en el código (`PLANTILLAS_HOJA`, `PLANTILLAS_GENERAL`): las hojas que ya se crearon con ellas no cambian, y la
 *    portada de General (Focus) y los «Ver … →» de una hoja de antes las siguen usando. Lo que falta copiar está en
 *    docs/templates-dashboard-propuesta.md, «Lo que falta copiar»; la pantalla no lo muestra (no hay «próximamente»).
 */
export function esPlantillaOfrecida(p: PlantillaHoja): boolean {
  try { return traeDisenoCopiado(p.armar((local) => local) as { diseno?: unknown; componentes?: unknown }); } catch { return false; }
}
/**
 * «Trae su diseño copiado»: el de la hoja entera (`diseno`) o, desde el 6/11/2026, una hoja hecha de TARJETAS copiadas de varios
 * diseños (bloques `tipo: 'diseno'`, lib/disenos-partes.ts), como «Velocidad de llamada». ⚠️ Con sólo `diseno`, esa hoja quedaba
 * afuera de «Nueva hoja» y de la API sin un error: el test la buscaba en `PLANTILLAS_HOJA`, que no es lo que se ofrece.
 */
export function traeDisenoCopiado(h: { diseno?: unknown; componentes?: unknown }): boolean {
  if (h.diseno) return true;
  const cs = Array.isArray(h.componentes) ? (h.componentes as Array<{ clase?: unknown; tipo?: unknown }>) : [];
  return cs.some((c) => c.clase === 'elemento' && c.tipo === 'diseno');
}
export const PLANTILLAS_OFRECIDAS: readonly PlantillaHoja[] = PLANTILLAS_HOJA.filter(esPlantillaOfrecida);
export const PLANTILLAS_GENERAL_OFRECIDAS: readonly PlantillaHoja[] = PLANTILLAS_GENERAL.filter(esPlantillaOfrecida);
/** La plantilla de ese id (o la que la reemplaza), SÓLO si se ofrece. */
export const plantillaOfrecidaDe = (id: string): PlantillaHoja | undefined => {
  const p = plantillaHojaDe(id);
  return p && esPlantillaOfrecida(p) ? p : undefined;
};

/** Una hoja de la galería con ids NUEVOS (la hoja y cada componente y control): se puede agregar dos veces. */
export function instanciarPlantilla(p: PlantillaHoja): Hoja {
  const ids = new Map<string, string>();
  const id = (local: string) => { if (!ids.has(local)) ids.set(local, nuevoId()); return ids.get(local)!; };
  return sanearHoja({ ...p.armar(id), plantilla: p.id }, 0)!;
}

/** La hoja de una plantilla con sus ids FIJOS (los del informe inicial). */
function fija(p: PlantillaHoja): Hoja {
  return sanearHoja({ ...p.armar((local) => local), plantilla: p.id }, 0)!;
}

/**
 * El informe con el que arranca quien nunca armó el suyo: las dos tabs viejas, Marketing y Comercial,
 * rearmadas como hojas en el mismo orden y lugar, y con el filtro de fecha arriba.
 */
export function tableroInicial(): Tablero {
  return { v: 3, nombre: NOMBRE_INICIAL, hojas: [fija(conPortadaDe(MARKETING)), fija(conPortadaDe(COMERCIAL))] };
}

/**
 * LA HOJA QUE UNA AGENCIA LES PONE PRIMERO A SUS CLIENTES (9/11/2026). Martín, por Código Inmobiliario (ws 13): «Les estoy
 * creando un dashboard especial para sus clientes», y que lo vean sin armarlo. Quien nunca guardó su Dashboard en el negocio de un
 * cliente APROBADO de la agencia arranca con esa hoja adelante; nada se escribe en el negocio del cliente (es el informe inicial,
 * que se guarda recién cuando la persona lo toca). Quien ya guardó el suyo lo conserva tal cual: agregársela ahí es escribir en su
 * negocio, y eso lo decide Martín (docs/relevo/dashboards-codigo.md).
 */
export const HOJA_DE_AGENCIA: Readonly<Record<number, string>> = { 13: 'velocidad-llamada' };

/** El prefijo de los ids fijos de la hoja de una agencia en el informe inicial. */
const PREFIJO_AGENCIA = 'ag-';

/**
 * ¿Es la hoja de la agencia del informe inicial? ⚠️ La pantalla de quien nunca guardó es EN BLANCO (12/10/2026, Martín: «que no le
 * salga ninguna página»): el inicial viaja por dentro y no se muestra. La hoja de la agencia SÍ se muestra (app/dashboard/page.tsx),
 * y por eso se la reconoce: es lo único del inicial que se ve, y no se guarda hasta que la persona toca algo.
 */
export const esHojaDeAgencia = (h: Pick<Hoja, 'id' | 'plantilla'>): boolean =>
  h.id.startsWith(PREFIJO_AGENCIA) && !!h.plantilla && Object.values(HOJA_DE_AGENCIA).includes(h.plantilla);

/** El informe inicial en un negocio que llevan estas agencias (las aprobadas): sus hojas adelante, con ids fijos. */
export function tableroInicialDe(agencias: readonly number[]): Tablero {
  const base = tableroInicial();
  const ids = [...new Set(agencias.map((a) => HOJA_DE_AGENCIA[a]).filter((x): x is string => !!x))];
  const extra = ids.flatMap((id) => {
    const p = plantillaHojaDe(id);
    return p ? [sanearHoja({ ...p.armar((local) => `${PREFIJO_AGENCIA}${local}`), plantilla: p.id }, 0)!] : [];
  });
  return extra.length ? { ...base, hojas: [...extra, ...base.hojas].slice(0, MAX_HOJAS) } : base;
}

/** Los componentes de una plantilla (para los tests y el modal). */
export const componentesDe = (p: PlantillaHoja): Componente[] => fija(p).componentes;

/**
 * Un pop-up NUEVO de la plantilla de esa entidad («Llamada», «Anuncio»), con ids nuevos y saneado como lo que va
 * adentro de un gráfico: lo que trae «Abrir un pop-up» en el panel. `null` = esa entidad no tiene plantilla (un
 * lead): quien lo pide arma el suyo (la ficha entera).
 */
export function popupDeEntidad(tipo: string | null | undefined): { titulo: string; componentes: Componente[] } | null {
  const p = tipo === 'llamada' || tipo === 'anuncio' ? PLANTILLAS_POPUP[tipo] : null;
  if (!p) return null;
  const ids = new Map<string, string>();
  const crudo = p.armar((local) => { if (!ids.has(local)) ids.set(local, nuevoId()); return ids.get(local)!; });
  const componentes = crudo.componentes.map((c) => sanearComponente(c, { enPopup: true })).filter((c): c is Componente => c != null);
  return { titulo: crudo.titulo, componentes };
}

// ── A dónde lleva `?hoja=` (C2) ─────────────────────────────────────────────────────────────────
// Los links a una hoja nombran la PLANTILLA: /closing → `?hoja=closing`, /ads-analyst →
// `?hoja=ads-analyst`, /productivity-analyst → `?hoja=productividad`, /vsl-analyst → `?hoja=vsl-analyst`
// (v5), y lo mismo /marketing y /comercial. Hasta el 11/10/2026 page.tsx buscaba `h.id === hoja` y, si no
// estaba, caía en la primera hoja SIN AVISAR: una hoja agregada desde «Nueva hoja» nace con ids nuevos, así
// que a quien la había armado así el link de su tab vieja lo dejaba en Marketing.

/**
 * El RESPALDO para reconocer una hoja que no dice de qué plantilla nació: los ids fijos del informe inicial
 * (una hoja guardada antes de v5 no tiene `plantilla`; renombrada, todavía tiene sus componentes). Alcanza con
 * UNO. Hasta v5 la firma de las de Analysts era un BLOQUE exclusivo; los bloques se fueron y la migración del
 * saneo le pone `plantilla` a la hoja que los traía (lib/graficos-migrar-v5.ts), así que ya no hace falta.
 */
export type FirmaHoja = { ids: readonly string[] };
const FIRMAS: Readonly<Record<string, FirmaHoja>> = {
  marketing: { ids: ['marketing', 'mk-spend', 'mk-funnel', 'mk-tendencias', 'mk-anuncios'] },
  // 4/11/2026: la Comercial nueva ya no trae la barra ni la cobranza (se mudaron a Cobranza); la reconocen las que quedan.
  comercial: { ids: ['comercial', 'co-funnel-embudo', 'co-tendencia', 'co-cohortes-mes-tabla'] },
};
/** La firma de una plantilla, para los tests. */
export const firmaDe = (plantillaId: string): FirmaHoja | undefined => FIRMAS[plantillaId];

const calzaFirma = (h: Hoja, f: FirmaHoja): boolean => f.ids.includes(h.id) || h.componentes.some((c) => f.ids.includes(c.id));

/** Los componentes de una hoja y los de sus pop-ups. */
function todosLosComponentes(h: Hoja): Componente[] {
  return h.componentes.flatMap((c) => (esGrafico(c) && c.popup ? [c, ...c.popup.componentes] : [c]));
}

/** Los ids de todo lo que tiene id en el informe (componentes, los de los pop-ups, controles de la hoja y de cada uno). */
function idsDe(t: Tablero): Set<string> {
  const ids = new Set<string>();
  for (const h of t.hojas) {
    for (const k of h.controles) ids.add(k.id);
    for (const c of todosLosComponentes(h)) {
      ids.add(c.id);
      if (!esElemento(c)) for (const k of c.controles) ids.add(k.id);
    }
  }
  return ids;
}

/**
 * La hoja con cada id pasado por `libre`, y lo que NOMBRA un id (lo que lee una caja de IA, las puntas de un
 * conector) pasado por la MISMA función: un id renombrado y la referencia a él tienen que seguir juntos.
 */
function conIdsLibres(h: Hoja, libre: (id: string) => string): Hoja {
  const componente = (c: Componente): Componente => {
    if (esElemento(c)) return c.ia?.fuentes ? { ...c, id: libre(c.id), ia: { ...c.ia, fuentes: c.ia.fuentes.map(libre) } } : { ...c, id: libre(c.id) };
    const base = { ...c, id: libre(c.id), controles: c.controles.map((k) => ({ ...k, id: libre(k.id) })) };
    return (esGrafico(c) && c.popup ? { ...base, popup: { ...c.popup, componentes: c.popup.componentes.map(componente) } } : base) as Componente;
  };
  return {
    ...h,
    controles: h.controles.map((k) => ({ ...k, id: libre(k.id) })),
    componentes: h.componentes.map(componente),
    ...(h.conectores ? { conectores: h.conectores.map((k) => ({ ...k, desde: libre(k.desde), hasta: libre(k.hasta) })) } : {}),
  };
}

/**
 * La plantilla armada con sus ids FIJOS para agregarla a ESTE informe. La hoja conserva su id (es
 * lo que nombra el link, y así el próximo `?hoja=` la encuentra por el paso 1). Un componente o un
 * control cuyo id ya usa otra hoja se acuña de nuevo: las plantillas generales repiten nombres
 * locales (`por-dia` está en tres) y con el mismo id lo elegido mirando en una hoja se vería en la
 * otra, y los datos de una se pintarían un instante en la otra (los dos se guardan por id).
 */
function paraAgregar(t: Tablero, p: PlantillaHoja): Hoja {
  const h = fija(p);
  const usados = idsDe(t);
  const nuevos = new Map<string, string>();
  const libre = (id: string) => {
    if (!usados.has(id)) return id;
    if (!nuevos.has(id)) nuevos.set(id, nuevoId());
    return nuevos.get(id)!;
  };
  return conIdsLibres(h, libre);
}

/** Lo que contesta `hojaDestino`. `hojaId: null` = la primera hoja. */
export type DestinoHoja = {
  hojaId: string | null;
  /** La plantilla pedida, armada para agregarla: no estaba en el informe. */
  agregar: Hoja | null;
  /** Era una plantilla, no estaba, y el informe ya tiene el máximo de hojas: se avisa. */
  lleno?: true;
};

/**
 * Qué hoja abre `?hoja=<pedido>` en ESTE informe:
 *   1. la que tiene ese id exacto (o el id de la plantilla que reemplazó a la pedida);
 *   2. si el pedido es una plantilla, la primera hoja que NACIÓ de ella (`Hoja.plantilla`: la que se agregó
 *      desde «Nueva hoja», con ids nuevos, y la de un informe migrado);
 *   3. de respaldo, la primera con su FIRMA (Marketing y Comercial guardadas antes de v5);
 *   4. si es una plantilla y no está, la plantilla armada (`agregar`): la pantalla la AGREGA al
 *      informe y se guarda, porque la persona fue a buscarla (EditorInforme.tsx, con un toast).
 * Un pedido que no es ni una hoja ni una plantilla abre la primera hoja.
 */
export function hojaDestino(t: Tablero, pedido: string | null | undefined): DestinoHoja {
  const p = typeof pedido === 'string' ? pedido.trim() : '';
  if (!p) return { hojaId: null, agregar: null };
  if (t.hojas.some((h) => h.id === p)) return { hojaId: p, agregar: null };
  const plantilla = plantillaHojaDe(p);
  if (!plantilla) return { hojaId: null, agregar: null };
  if (plantilla.id !== p && t.hojas.some((h) => h.id === plantilla.id)) return { hojaId: plantilla.id, agregar: null };
  // Primero la que nació de la plantilla PEDIDA aunque ya se haya reemplazado (4/11/2026): quien tiene su Ads Analyst y abre
  // /ads-analyst vuelve a ESA hoja, no recibe una nueva de la plantilla que la reemplaza.
  const nacida = t.hojas.find((h) => h.plantilla === p) ?? t.hojas.find((h) => h.plantilla === plantilla.id);
  if (nacida) return { hojaId: nacida.id, agregar: null };
  const firma = FIRMAS[plantilla.id];
  const conFirma = firma ? t.hojas.find((h) => calzaFirma(h, firma)) : undefined;
  if (conFirma) return { hojaId: conFirma.id, agregar: null };
  if (t.hojas.length >= MAX_HOJAS) return { hojaId: null, agregar: null, lleno: true };
  const agregar = paraAgregar(t, plantilla);
  return { hojaId: agregar.id, agregar };
}

/** Un informe con una hoja más al final, si no estaba (la que agrega `hojaDestino`). */
export function conHojaAgregada(t: Tablero, h: Hoja | null | undefined): Tablero {
  if (!h || t.hojas.some((x) => x.id === h.id) || t.hojas.length >= MAX_HOJAS) return t;
  return { ...t, hojas: [...t.hojas, h] };
}

/**
 * El `recording_id` de una llamada que viene en la URL (`?llamada=` del Dashboard, `?call=` de la
 * ruta vieja): un entero positivo, o nada. Lo que no se entiende no abre una ficha vacía.
 */
export function llamadaDeUrl(v: unknown): number | null {
  const s = Array.isArray(v) ? v[0] : v;
  if (typeof s !== 'string' || !/^\d{1,15}$/.test(s.trim())) return null;
  const n = Number(s.trim());
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * /closing → la hoja Closing del Dashboard. `?call=<id>` (la ruta vieja abría ESA llamada) pasa a
 * `&llamada=<id>`, y el resto de la query viaja tal cual (el `?ws=` incluido): los links a /closing
 * salieron en avisos y mensajes de MaKo que nadie puede editar.
 */
export function destinoDeClosing(sp: Record<string, string | string[] | undefined>): string {
  const qs = new URLSearchParams();
  qs.set('hoja', 'closing');
  const id = llamadaDeUrl(sp.call);
  if (id != null) qs.set('llamada', String(id));
  for (const [k, v] of Object.entries(sp)) {
    if (k === 'call' || k === 'hoja' || k === 'llamada') continue;
    if (typeof v === 'string') qs.append(k, v);
    else if (Array.isArray(v)) for (const x of v) qs.append(k, x);
  }
  return `/dashboard?${qs.toString()}`;
}

// ── La hoja ÚNICA de un rol: el closer ve Closing, el setter ve Chat Analyst (C3 y v5) ───────────
// Decisión 6 de Martín (11/10/2026): «Los closers ven SÓLO la hoja Closing del Dashboard (no editan el
// informe, no ven otras hojas)», y la de la tanda v5: «El setter ve SÓLO la hoja Chat Analyst (como el
// closer con Closing), con los números del equipo». La pantalla le arma este informe EN MEMORIA (nunca se
// guarda) y /api/graficos le contesta sólo lo que su hoja pide. ⚠️ Esconder el resto en la pantalla no
// protege nada (AGENTS.md, «Un flag de visibilidad protege la PANTALLA»): las listas de abajo son las que usa
// el SERVER, y el test cruza que cada hoja no pida nada fuera de ellas.

/** Los conjuntos que un closer puede leer: las llamadas. Ni la plata, ni los leads, ni la pauta. */
export const CLOSER_CONJUNTOS: readonly string[] = ['llamadas', 'llamadas_venta', 'llamadas_dimensiones'];
/** Los del setter: los mensajes, las conversaciones y las automatizaciones. Ni la plata, ni las llamadas, ni MaKo. */
export const SETTER_CONJUNTOS: readonly string[] = ['whatsapp', 'conversaciones', 'envios', 'inscripciones'];

export type HojaDeRol = {
  /** La plantilla que ve (con sus ids fijos). */
  plantilla: string;
  /** La key de la capa que su negocio tiene que haber comprado (`tabEnCapa`): si no, la hoja no es para él. */
  capa: string;
  /** Los ÚNICOS conjuntos que el server le lee. EN POSITIVO: uno nuevo nace cerrado. */
  conjuntos: readonly string[];
  /** El 403 de lo que no es de su hoja. */
  error: string;
  nombre: string;
};

/** EN POSITIVO: un rol que no está acá (el admin) no tiene hoja única; uno nuevo nace sin Dashboard. */
export const HOJA_DE_ROL: Readonly<Partial<Record<RolWorkspace, HojaDeRol>>> = {
  closer: { plantilla: 'closing', capa: CAPA_DE_HOJA_DE_ROL.closer, conjuntos: CLOSER_CONJUNTOS, error: 'Sólo la hoja Closing', nombre: 'Closing' },
  setter: { plantilla: 'chat-analyst', capa: CAPA_DE_HOJA_DE_ROL.setter, conjuntos: SETTER_CONJUNTOS, error: 'Sólo la hoja Chat Analyst', nombre: 'Chat Analyst' },
};

/** La hoja única de un rol, o null (el admin, o un rol sin Dashboard). */
export const hojaDeRol = (rol: unknown): HojaDeRol | null =>
  (typeof rol === 'string' && Object.prototype.hasOwnProperty.call(HOJA_DE_ROL, rol) ? HOJA_DE_ROL[rol as RolWorkspace] ?? null : null);

/** El informe de un rol con hoja única: su plantilla con los ids fijos (sin guardar, lo elegido mirando no se pierde al recargar). */
export function informeDeRol(rol: unknown): Tablero | null {
  const u = hojaDeRol(rol);
  if (!u) return null;
  const p = plantillaHojaDe(u.plantilla);
  // Un informe sin hojas rompe la pantalla (todo lee `hojas[0]`): sin la plantilla, una hoja vacía.
  return { v: 3, nombre: NOMBRE_INICIAL, hojas: [p ? fija(p) : hojaVacia(u.nombre)] };
}

/**
 * Los conjuntos de la hoja de un rol donde puede pedir los valores de un campo (el desplegable de un filtro),
 * recortados a los que pidió la pantalla. Vacío = ese campo no es de su hoja: 403. «Closer» también está en los
 * leads, y por ahí no pasa.
 */
export function fuentesDeCampoDeRol(rol: unknown, campoId: unknown, pedidas?: unknown): string[] {
  const u = hojaDeRol(rol);
  const c = campoDe(typeof campoId === 'string' ? campoId : '');
  if (!u || !c) return [];
  const propias = Object.keys(c.en).filter((f) => u.conjuntos.includes(f));
  if (!Array.isArray(pedidas)) return propias;
  const p = pedidas.map(String);
  return propias.filter((f) => p.includes(f));
}

/**
 * ¿Este rol puede hacer este pedido a /api/graficos? El admin, todo. Un rol con hoja única: `datos` de sus
 * conjuntos y `valores` de un campo de su hoja. Guardar, el detalle de un número, los bloques (ya no existen) y
 * todo lo demás, no. EN POSITIVO: una acción nueva de la ruta nace cerrada para él.
 * Un pedido de la lista que no se entiende cierra la lista entera: su pantalla no los arma.
 */
export function puedePedir(rol: unknown, body: unknown): boolean {
  if (rol === 'admin') return true;
  const u = hojaDeRol(rol);
  if (!u || !body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  const lista = (v: unknown): Array<Record<string, unknown> | null> => (Array.isArray(v) ? v : []);
  if (b.accion === 'datos') {
    return lista(b.pedidos).every((p) => {
      const g = sanearGrafico(p?.grafico);
      return !!g && u.conjuntos.includes(g.fuente);
    });
  }
  if (b.accion === 'valores') return fuentesDeCampoDeRol(rol, b.campo, b.fuentes).length > 0;
  return false;
}

// Los nombres de antes (C3), del closer: los usan la ruta de las cajas de IA y los tests.
/** @deprecated v5: `informeDeRol('closer')`. */
export const informeCloser = (): Tablero => informeDeRol('closer')!;
/** @deprecated v5: `fuentesDeCampoDeRol('closer', …)`. */
export const fuentesDeCampoCloser = (campoId: unknown, pedidas?: unknown): string[] => fuentesDeCampoDeRol('closer', campoId, pedidas);
/** @deprecated v5: `puedePedir('closer', …)`. */
export const closerPuedePedir = (body: unknown): boolean => puedePedir('closer', body);
