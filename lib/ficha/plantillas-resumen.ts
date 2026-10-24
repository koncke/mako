// =============================================================================
// ficha/plantillas-resumen — las plantillas de la tab RESUMEN para la galería «¿Qué vas a crear hoy?»
// =============================================================================
// Martín, 16/10/2026: «que hayan templates para "resumen", "tracking" y todas las tabs... que se pueda ver "epico" como
// lo tenemos en general» y «completamente diferente en diseño y funcionalidad». Hasta acá la galería del Resumen eran
// las listas de cada tipo de funnel partidas por tab (todo de ancho completo, en el orden del documento). Éstas son las
// mismas listas ARMADAS: con su ancho y su diseño, como un registro de Attio (los HIGHLIGHTS arriba: la calificación,
// cuánto lleva en la etapa, lo que vale) y las tarjetas de a dos por fila de la columna del medio de HubSpot.
//
// ⚠️ LO ESENCIAL PRIMERO; LO DEMÁS SE AGREGA (#880, 17/10/2026). Martín, en la revisión del 16/10 (33:31): «revisar
//    todos los templates, porque eso dentro un lead creo que es un template que está muy grande, entonces los templates
//    tienen que ser como más simples». Salieron de las de entrada los bloques que ya tienen su tab o se agregan con
//    «＋»: la charla de WhatsApp (de ancho completo y con su raya aunque no haya charla; queda en «La charla»), el video
//    visto (Tracking), lo cobrado (Pagos, salvo en el evento y el carrito, donde es la pregunta), los cambios de MaKo,
//    las automatizaciones en curso y el origen donde la bajada no lo promete.
// ⚠️ «AUTOMATIZACIONES» VUELVE A LAS DE ENTRADA (23/10/2026), arriba, después de los duplicados. Martín: «crear un bloque
//    dentro del detail de cada lead que esté relacionado a las automatizaciones... para tener más claridad de lo que
//    pasa». No agranda nada: se calla si el lead no está ni estuvo en ninguna (`vistaVacia`, app/crm/automatizacion-lead.ts).
//    La épica y «Para llamarlo» no lo traen: se eligen para ver poco.
// ⚠️ CADA UNA TIENE LOS BLOQUES DE LA LISTA DE SU TIPO QUE AVISAN (lib/ficha/plantillas.ts): la plantilla del FUNNEL
//    decide los avisos de «datos sin marcar», y cada aviso que queda prendido tiene que tener dónde llenarse en el
//    Resumen de entrada. Lo fija tests/ficha-resumen.test.ts. Hasta el 17/10 exigía la lista ENTERA, que es más que su
//    motivo y era lo que hacía grandes a las plantillas.
// ⚠️ Y LA DE ENTRADA DE CADA TIPO TRAE «REDES Y WEB» E «INGRESO ESTIMADO» (verificación del 16/10/2026): el contacto de
//    antes (InfoPrincipalCard) los mostraba ADENTRO en todos los funnels (la web, Instagram y el ingreso son los de
//    fábrica de `crm.resumen.campos`), y al partirlos en sus bloques cinco de éstas los dejaban afuera: un lead del ws 11
//    con su ingreso cargado dejaba de verlo. Lo que el negocio apagó lo saca el respaldo (`listaDeIds`, ./config.ts).
//    Lo fija tests/ficha-resumen-lo-de-antes.test.ts.
// ⚠️ EL MOTIVO DE SALIDA ENTRA COMO TEXTO, no con los chips (verificación del 16/10/2026): el 12/10 se decidió que los
//    chips «Precio / Timing / …» viven donde se DECIDE la salida (el wizard de la etapa) y que aquí se CORRIGE uno ya
//    escrito («una fila de cinco botones para eso es la caja que este cambio vino a sacar»). «Chips y texto» sigue
//    siendo un diseño que el admin elige.
// ⚠️ EL ID SE GUARDA (`funnels.data.ficha.plantillasTab`): no se renombra. `resumen-epica` es el de la épica del marco
//    (el mismo id: una ficha que ya la eligió sigue con ella).
// ⚠️ `sugeridaPara` decide la DE ENTRADA de la tab para ese tipo (lib/ficha/plantillas-tab.ts): un funnel que nadie
//    tocó ve la suya. Los nueve tipos tienen una. La épica y «Para llamarlo» no se sugieren: se eligen.
//
// Puro, sin `server-only` ni `'use client'`: lo leen la galería, la API de MaKo y los tests.
// =============================================================================

import type { PlantillaTab } from './plantillas-tab';

export const PLANTILLAS_TAB_RESUMEN: PlantillaTab[] = [
  {
    id: 'resumen-llamada', tab: 'resumen', nombre: 'Antes de la llamada',
    bajada: 'Cuándo es, qué contestó y quién lo atiende.',
    sugeridaPara: ['dos-reuniones', 'una-llamada'],
    bloques: [
      { id: 'siguiente-accion', ancho: 12, diseno: 'banner' },
      { id: 'posibles-duplicados', ancho: 12, diseno: 'banner' },
      { id: 'automatizaciones-en-curso', ancho: 12, diseno: 'lista' },
      { id: 'calificacion', ancho: 4, diseno: 'botones' },
      { id: 'tiempo-en-etapa', ancho: 4, diseno: 'barra' },
      { id: 'ingreso-estimado', ancho: 4, diseno: 'numero' },
      { id: 'proxima-reunion', ancho: 6, diseno: 'automatico' },
      { id: 'setter-y-closer', ancho: 6, diseno: 'cajas' },
      { id: 'contacto', ancho: 6, diseno: 'grilla' },
      { id: 'lo-que-contesto', ancho: 6, diseno: 'lista' },
      { id: 'redes-y-web', ancho: 6, diseno: 'chips' },
      { id: 'motivo-de-salida', ancho: 6, diseno: 'texto' },
      { id: 'plazo-nutricion', ancho: 4, diseno: 'cuenta' },
      { id: 'notas', ancho: 12, diseno: 'caja' },
    ],
  },
  {
    id: 'resumen-evento', tab: 'resumen', nombre: 'Antes del evento',
    bajada: 'Cuándo es el evento, si le llega lo que mandas y su cobro.',
    sugeridaPara: ['evento'],
    bloques: [
      { id: 'siguiente-accion', ancho: 12, diseno: 'banner' },
      { id: 'posibles-duplicados', ancho: 12, diseno: 'banner' },
      { id: 'automatizaciones-en-curso', ancho: 12, diseno: 'lista' },
      { id: 'proxima-reunion', ancho: 6, diseno: 'numero' },
      { id: 'tiempo-en-etapa', ancho: 3, diseno: 'chip' },
      { id: 'cobrado', ancho: 3, diseno: 'chip' },
      { id: 'contacto', ancho: 6, diseno: 'botonera' },
      { id: 'setter-y-closer', ancho: 6, diseno: 'chips' },
      { id: 'redes-y-web', ancho: 6, diseno: 'chips' },
      { id: 'ingreso-estimado', ancho: 4, diseno: 'fila' },
      { id: 'lo-que-le-mandamos', ancho: 6 },
      { id: 'motivo-de-salida', ancho: 6, diseno: 'texto' },
      { id: 'plazo-nutricion', ancho: 4, diseno: 'cuenta' },
      { id: 'notas', ancho: 12, diseno: 'tres' },
    ],
  },
  {
    id: 'resumen-formulario', tab: 'resumen', nombre: 'Lo que contestó',
    bajada: 'Sus respuestas del anuncio, si califica y de qué anuncio vino.',
    sugeridaPara: ['formulario-meta'],
    bloques: [
      { id: 'siguiente-accion', ancho: 12, diseno: 'banner' },
      { id: 'posibles-duplicados', ancho: 12, diseno: 'banner' },
      { id: 'automatizaciones-en-curso', ancho: 12, diseno: 'lista' },
      { id: 'calificacion', ancho: 4, diseno: 'botones' },
      { id: 'tiempo-en-etapa', ancho: 4, diseno: 'chip' },
      { id: 'ingreso-estimado', ancho: 4, diseno: 'numero' },
      { id: 'lo-que-contesto', ancho: 12, diseno: 'tabla' },
      { id: 'contacto', ancho: 6, diseno: 'grilla' },
      { id: 'redes-y-web', ancho: 6, diseno: 'chips' },
      { id: 'origen', ancho: 6, diseno: 'migas' },
      { id: 'setter-y-closer', ancho: 6, diseno: 'cajas' },
      { id: 'proxima-reunion', ancho: 12, diseno: 'renglon' },
      { id: 'motivo-de-salida', ancho: 6, diseno: 'texto' },
      { id: 'plazo-nutricion', ancho: 4, diseno: 'cuenta' },
      { id: 'notas', ancho: 12, diseno: 'caja' },
    ],
  },
  {
    id: 'resumen-landing', tab: 'resumen', nombre: 'Su registro',
    bajada: 'Lo que llenó en tu página, dónde y qué le llegó después.',
    sugeridaPara: ['landing'],
    bloques: [
      { id: 'siguiente-accion', ancho: 12, diseno: 'banner' },
      { id: 'posibles-duplicados', ancho: 12, diseno: 'banner' },
      { id: 'automatizaciones-en-curso', ancho: 12, diseno: 'lista' },
      { id: 'calificacion', ancho: 4, diseno: 'botones' },
      { id: 'tiempo-en-etapa', ancho: 4, diseno: 'chip' },
      { id: 'ingreso-estimado', ancho: 4, diseno: 'numero' },
      { id: 'contacto', ancho: 6, diseno: 'grilla' },
      { id: 'redes-y-web', ancho: 6, diseno: 'chips' },
      { id: 'lo-que-contesto', ancho: 6, diseno: 'lista' },
      { id: 'pagina-de-registro', ancho: 6, diseno: 'fila' },
      { id: 'proxima-reunion', ancho: 12, diseno: 'renglon' },
      { id: 'lo-que-le-mandamos', ancho: 6 },
      { id: 'motivo-de-salida', ancho: 6, diseno: 'texto' },
      { id: 'plazo-nutricion', ancho: 4, diseno: 'cuenta' },
      { id: 'notas', ancho: 12, diseno: 'caja' },
    ],
  },
  {
    id: 'resumen-charla', tab: 'resumen', nombre: 'La charla',
    bajada: 'Lo que hablaron, si pide una persona y por dónde entró.',
    sugeridaPara: ['te-escriben'],
    bloques: [
      { id: 'siguiente-accion', ancho: 12, diseno: 'banner' },
      { id: 'pase-a-humano', ancho: 12 },
      { id: 'posibles-duplicados', ancho: 12, diseno: 'banner' },
      { id: 'automatizaciones-en-curso', ancho: 12, diseno: 'lista' },
      { id: 'charla-dm', ancho: 12 },
      { id: 'charla-whatsapp', ancho: 12 },
      { id: 'mensaje-listo', ancho: 12 },
      { id: 'publicacion-de-entrada', ancho: 6, diseno: 'linea' },
      { id: 'contacto', ancho: 6, diseno: 'renglon' },
      { id: 'redes-y-web', ancho: 6, diseno: 'chips' },
      { id: 'setter-y-closer', ancho: 6, diseno: 'chips' },
      { id: 'tiempo-en-etapa', ancho: 3, diseno: 'chip' },
      { id: 'ingreso-estimado', ancho: 3, diseno: 'numero' },
      { id: 'motivo-de-salida', ancho: 6, diseno: 'texto' },
      { id: 'plazo-nutricion', ancho: 4, diseno: 'cuenta' },
      { id: 'notas', ancho: 12, diseno: 'tres' },
    ],
  },
  {
    id: 'resumen-prospeccion', tab: 'resumen', nombre: 'Para prospectar',
    bajada: 'Cómo encontrarlo, cuántas veces le escribiste y a quién le toca.',
    sugeridaPara: ['prospeccion'],
    bloques: [
      { id: 'siguiente-accion', ancho: 12, diseno: 'banner' },
      { id: 'posibles-duplicados', ancho: 12, diseno: 'banner' },
      { id: 'automatizaciones-en-curso', ancho: 12, diseno: 'lista' },
      { id: 'contacto', ancho: 6, diseno: 'botonera' },
      { id: 'redes-y-web', ancho: 6, diseno: 'destacada' },
      { id: 'tiempo-en-etapa', ancho: 4, diseno: 'barra' },
      { id: 'ingreso-estimado', ancho: 4, diseno: 'numero' },
      { id: 'setter-y-closer', ancho: 4, diseno: 'renglon' },
      { id: 'lo-que-le-mandamos', ancho: 12 },
      { id: 'charla-dm', ancho: 12 },
      { id: 'motivo-de-salida', ancho: 6, diseno: 'texto' },
      { id: 'plazo-nutricion', ancho: 4, diseno: 'cuenta' },
      { id: 'notas', ancho: 12, diseno: 'tres' },
    ],
  },
  {
    id: 'resumen-carrito', tab: 'resumen', nombre: 'Si compró',
    bajada: 'Si pagó y cuánto, cómo contactarlo y de dónde vino.',
    sugeridaPara: ['carrito'],
    bloques: [
      { id: 'siguiente-accion', ancho: 12, diseno: 'banner' },
      { id: 'posibles-duplicados', ancho: 12, diseno: 'banner' },
      { id: 'automatizaciones-en-curso', ancho: 12, diseno: 'lista' },
      { id: 'cobrado', ancho: 6, diseno: 'numero' },
      { id: 'contacto', ancho: 6, diseno: 'grilla' },
      { id: 'origen', ancho: 6, diseno: 'migas' },
      { id: 'lo-que-contesto', ancho: 6, diseno: 'lista' },
      { id: 'redes-y-web', ancho: 6, diseno: 'chips' },
      { id: 'ingreso-estimado', ancho: 4, diseno: 'fila' },
      { id: 'motivo-de-salida', ancho: 6, diseno: 'texto' },
      { id: 'plazo-nutricion', ancho: 4, diseno: 'cuenta' },
      { id: 'notas', ancho: 12, diseno: 'caja' },
    ],
  },
  {
    // LA ÉPICA (General y MaKo Mobile v3): pocas cosas y en grande. La grilla épica pone dos por fila como mucho.
    id: 'resumen-epica', tab: 'resumen', nombre: 'Épica', epico: true,
    bajada: 'Lo que toca hacer, cuándo y su contacto, en grande.',
    bloques: [
      { id: 'siguiente-accion', ancho: 12, diseno: 'banner' },
      { id: 'proxima-reunion', ancho: 6, diseno: 'numero' },
      { id: 'tiempo-en-etapa', ancho: 4, diseno: 'numero' },
      { id: 'contacto', ancho: 12, diseno: 'botonera' },
      { id: 'calificacion', ancho: 4, diseno: 'botones' },
      { id: 'ingreso-estimado', ancho: 4, diseno: 'numero' },
      { id: 'notas', ancho: 12, diseno: 'ultima' },
    ],
  },
  {
    // Lo que el setter necesita para levantar el teléfono (el ejemplo de la caja: «Lo que necesita mi setter para llamarlo»).
    id: 'resumen-para-llamar', tab: 'resumen', nombre: 'Para llamarlo',
    bajada: 'El botón de llamar, lo que contestó y de dónde vino.',
    bloques: [
      { id: 'siguiente-accion', ancho: 12, diseno: 'fila' },
      { id: 'contacto', ancho: 12, diseno: 'botonera' },
      { id: 'lo-que-contesto', ancho: 6, diseno: 'tarjetas' },
      { id: 'origen', ancho: 6, diseno: 'linea' },
      { id: 'setter-y-closer', ancho: 6, diseno: 'renglon' },
      { id: 'tiempo-en-etapa', ancho: 4, diseno: 'chip' },
      { id: 'notas', ancho: 12, diseno: 'tres' },
    ],
  },
  {
    // La completa: todo lo que el Resumen sabe dibujar (la de respaldo, la de un funnel sin tipo).
    id: 'resumen-completa', tab: 'resumen', nombre: 'Completa',
    bajada: 'Todo lo que la ficha sabe de este lead.',
    sugeridaPara: ['respaldo'],
    bloques: [
      { id: 'siguiente-accion', ancho: 12, diseno: 'banner' },
      { id: 'posibles-duplicados', ancho: 12, diseno: 'banner' },
      { id: 'automatizaciones-en-curso', ancho: 12, diseno: 'lista' },
      { id: 'calificacion', ancho: 4, diseno: 'botones' },
      { id: 'tiempo-en-etapa', ancho: 4, diseno: 'barra' },
      { id: 'ingreso-estimado', ancho: 4, diseno: 'numero' },
      { id: 'proxima-reunion', ancho: 6, diseno: 'automatico' },
      { id: 'setter-y-closer', ancho: 6, diseno: 'cajas' },
      { id: 'contacto', ancho: 6, diseno: 'grilla' },
      { id: 'redes-y-web', ancho: 6, diseno: 'filas' },
      { id: 'lo-que-contesto', ancho: 12, diseno: 'lista' },
      { id: 'origen', ancho: 6, diseno: 'migas' },
      { id: 'pagina-de-registro', ancho: 6, diseno: 'fila' },
      { id: 'motivo-de-salida', ancho: 6, diseno: 'texto' },
      { id: 'plazo-nutricion', ancho: 4, diseno: 'cuenta' },
      { id: 'notas', ancho: 12, diseno: 'caja' },
    ],
  },
];
