// =============================================================================
// ficha/plantillas-resumen — las plantillas de la tab RESUMEN para la galería «¿Qué vas a crear hoy?»
// =============================================================================
// Martín, 16/10/2026: «que hayan templates para "resumen", "tracking" y todas las tabs... que se pueda ver "epico" como
// lo tenemos en general» y «completamente diferente en diseño y funcionalidad». Hasta acá la galería del Resumen eran
// las listas de cada tipo de funnel partidas por tab (todo de ancho completo, en el orden del documento). Éstas son las
// mismas listas ARMADAS: con su ancho y su diseño, como un registro de Attio (los HIGHLIGHTS arriba: la calificación,
// cuánto lleva en la etapa, lo que vale) y las tarjetas de a dos por fila de la columna del medio de HubSpot.
//
// ⚠️ CADA UNA TIENE, COMO MÍNIMO, LOS BLOQUES DE LA LISTA DE SU TIPO (lib/ficha/plantillas.ts): la plantilla del FUNNEL
//    decide los avisos de «datos sin marcar», y cada aviso que queda prendido tiene que tener dónde llenarse en el
//    Resumen de entrada. Lo fija tests/ficha-resumen.test.ts («no se pierde ningún bloque de la lista de su tipo»).
//    Los que todavía no tienen componente (la charla, los cambios de MaKo, el video) van igual: no se dibujan hasta que
//    lo tengan, y el día que lo tengan aparecen solos.
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
      { id: 'cambios-de-mako', ancho: 12 },
      { id: 'calificacion', ancho: 4, diseno: 'botones' },
      { id: 'tiempo-en-etapa', ancho: 4, diseno: 'barra' },
      { id: 'ingreso-estimado', ancho: 4, diseno: 'numero' },
      { id: 'proxima-reunion', ancho: 6, diseno: 'automatico' },
      { id: 'setter-y-closer', ancho: 6, diseno: 'cajas' },
      { id: 'contacto', ancho: 6, diseno: 'grilla' },
      { id: 'lo-que-contesto', ancho: 6, diseno: 'lista' },
      { id: 'video-visto', ancho: 6 },
      { id: 'cobrado', ancho: 6, diseno: 'chip' },
      { id: 'charla-whatsapp', ancho: 12 },
      { id: 'origen', ancho: 6, diseno: 'migas' },
      { id: 'redes-y-web', ancho: 6, diseno: 'chips' },
      { id: 'motivo-de-salida', ancho: 6, diseno: 'chips' },
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
      { id: 'proxima-reunion', ancho: 6, diseno: 'numero' },
      { id: 'tiempo-en-etapa', ancho: 3, diseno: 'chip' },
      { id: 'cobrado', ancho: 3, diseno: 'chip' },
      { id: 'contacto', ancho: 6, diseno: 'botonera' },
      { id: 'setter-y-closer', ancho: 6, diseno: 'chips' },
      { id: 'charla-whatsapp', ancho: 12 },
      { id: 'lo-que-contesto', ancho: 6, diseno: 'lista' },
      { id: 'lo-que-le-mandamos', ancho: 6 },
      { id: 'automatizaciones-en-curso', ancho: 12 },
      { id: 'origen', ancho: 12, diseno: 'linea' },
      { id: 'motivo-de-salida', ancho: 6, diseno: 'chips' },
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
      { id: 'calificacion', ancho: 4, diseno: 'botones' },
      { id: 'tiempo-en-etapa', ancho: 4, diseno: 'chip' },
      { id: 'ingreso-estimado', ancho: 4, diseno: 'numero' },
      { id: 'lo-que-contesto', ancho: 12, diseno: 'tabla' },
      { id: 'contacto', ancho: 6, diseno: 'grilla' },
      { id: 'origen', ancho: 6, diseno: 'migas' },
      { id: 'setter-y-closer', ancho: 6, diseno: 'cajas' },
      { id: 'proxima-reunion', ancho: 6, diseno: 'renglon' },
      { id: 'charla-whatsapp', ancho: 12 },
      { id: 'automatizaciones-en-curso', ancho: 12 },
      { id: 'motivo-de-salida', ancho: 6, diseno: 'chips' },
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
      { id: 'calificacion', ancho: 4, diseno: 'botones' },
      { id: 'tiempo-en-etapa', ancho: 4, diseno: 'chip' },
      { id: 'contacto', ancho: 6, diseno: 'grilla' },
      { id: 'lo-que-contesto', ancho: 6, diseno: 'lista' },
      { id: 'pagina-de-registro', ancho: 6, diseno: 'fila' },
      { id: 'origen', ancho: 6, diseno: 'linea' },
      { id: 'proxima-reunion', ancho: 12, diseno: 'renglon' },
      { id: 'charla-whatsapp', ancho: 12 },
      { id: 'automatizaciones-en-curso', ancho: 6 },
      { id: 'lo-que-le-mandamos', ancho: 6 },
      { id: 'motivo-de-salida', ancho: 6, diseno: 'chips' },
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
      { id: 'charla-dm', ancho: 12 },
      { id: 'charla-whatsapp', ancho: 12 },
      { id: 'mensaje-listo', ancho: 12 },
      { id: 'publicacion-de-entrada', ancho: 6, diseno: 'linea' },
      { id: 'origen', ancho: 6, diseno: 'linea' },
      { id: 'contacto', ancho: 6, diseno: 'renglon' },
      { id: 'setter-y-closer', ancho: 6, diseno: 'chips' },
      { id: 'tiempo-en-etapa', ancho: 4, diseno: 'chip' },
      { id: 'automatizaciones-en-curso', ancho: 12 },
      { id: 'motivo-de-salida', ancho: 6, diseno: 'chips' },
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
      { id: 'contacto', ancho: 6, diseno: 'botonera' },
      { id: 'redes-y-web', ancho: 6, diseno: 'destacada' },
      { id: 'tiempo-en-etapa', ancho: 4, diseno: 'barra' },
      { id: 'ingreso-estimado', ancho: 4, diseno: 'numero' },
      { id: 'setter-y-closer', ancho: 4, diseno: 'renglon' },
      { id: 'lo-que-le-mandamos', ancho: 12 },
      { id: 'charla-whatsapp', ancho: 6 },
      { id: 'charla-dm', ancho: 6 },
      { id: 'motivo-de-salida', ancho: 6, diseno: 'chips' },
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
      { id: 'cobrado', ancho: 6, diseno: 'numero' },
      { id: 'contacto', ancho: 6, diseno: 'grilla' },
      { id: 'origen', ancho: 6, diseno: 'migas' },
      { id: 'lo-que-contesto', ancho: 6, diseno: 'lista' },
      { id: 'charla-whatsapp', ancho: 12 },
      { id: 'motivo-de-salida', ancho: 6, diseno: 'chips' },
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
      { id: 'publicacion-de-entrada', ancho: 6, diseno: 'linea' },
      { id: 'motivo-de-salida', ancho: 6, diseno: 'chips' },
      { id: 'plazo-nutricion', ancho: 4, diseno: 'cuenta' },
      { id: 'notas', ancho: 12, diseno: 'caja' },
    ],
  },
];
