// =============================================================================
// La galería de subtítulos del editor, en lo que compara el desarme (ticket 97; PURO)
// =============================================================================
// El desarme elige el estilo de subtítulos más parecido al detectado (lib/video-desarmar.ts → `estiloMasParecido`). La galería
// vive en el motor del editor (app/video-editor/_opencut/subtitles/estilos.ts → PLANTILLAS_SUBTITULO), y un módulo del server no
// puede importar del motor (tests/video-editor-integracion.test.ts, 4: el motor es cliente por su única puerta). Por eso acá va
// una COPIA de los rasgos que se comparan, y tests/video-desarmar.test.ts la fija contra el motor: si alguien suma o cambia un
// estilo de la galería, el test dice qué copiar. El mismo trato que los ids de lib/editor-video/plantillas.ts.
// =============================================================================

import type { EstiloDeGaleria } from './video-desarmar';

export const GALERIA_SUBTITULOS: readonly (EstiloDeGaleria & { nombre: string })[] = [
  { id: 'predeterminado', nombre: 'Predeterminado', fuente: 'Montserrat', negrita: true, color: '#ffffff', fondo: { color: 'rgba(0, 0, 0, 0.6)' } },
  { id: 'clasico', nombre: 'Clásico', fuente: 'Roboto', negrita: true, color: '#ffffff', fondo: { color: '#000000' } },
  { id: 'amarillo', nombre: 'Amarillo', fuente: 'Montserrat', negrita: true, color: '#ffe14d', fondo: { color: 'rgba(0, 0, 0, 0.7)' } },
  { id: 'recuadro-blanco', nombre: 'Recuadro blanco', fuente: 'Poppins', negrita: true, color: '#111111', fondo: { color: '#ffffff' } },
  { id: 'cian', nombre: 'Cian', fuente: 'Poppins', negrita: true, color: '#ffffff', fondo: { color: '#00c1cd' } },
  { id: 'rojo', nombre: 'Rojo', fuente: 'Montserrat', negrita: true, color: '#ffffff', fondo: { color: '#e5283a' } },
  { id: 'violeta', nombre: 'Violeta', fuente: 'Lilita One', negrita: false, color: '#ffffff', fondo: { color: 'rgba(124, 58, 237, 0.9)' } },
  { id: 'impacto', nombre: 'Impacto', fuente: 'Anton', negrita: false, color: '#ffffff', fondo: { color: 'rgba(0, 0, 0, 0.45)' } },
  { id: 'titular', nombre: 'Titular', fuente: 'Bebas Neue', negrita: false, color: '#ffe14d', fondo: { color: 'rgba(0, 0, 0, 0.55)' } },
  { id: 'contorno', nombre: 'Contorno', fuente: 'Montserrat', negrita: true, color: '#ffffff', trazo: { color: '#000000' } },
  { id: 'amarillo-contorno', nombre: 'Amarillo con contorno', fuente: 'Montserrat', negrita: true, color: '#ffe14d', trazo: { color: '#000000' } },
  { id: 'solo-texto', nombre: 'Solo texto', fuente: 'Montserrat', negrita: true, color: '#ffffff' },
  { id: 'karaoke', nombre: 'Karaoke', fuente: 'Montserrat', negrita: true, color: '#ffffff', trazo: { color: '#000000' }, resaltado: { modo: 'frase', color: '#ffe14d' } },
  { id: 'palabra-resaltada', nombre: 'Palabra resaltada', fuente: 'Anton', negrita: false, color: '#ffffff', mayusculas: true, trazo: { color: '#000000' }, sombra: true, resaltado: { modo: 'palabra', color: '#3df25a' } },
  { id: 'atenuado', nombre: 'Atenuado', fuente: 'Poppins', negrita: true, color: '#ffffff', sombra: true, resaltado: { modo: 'palabra', color: '#ffffff' } },
  { id: 'lima', nombre: 'Lima', fuente: 'Inter', negrita: true, color: '#ffffff', sombra: true },
  { id: 'recuadro-bebas', nombre: 'Recuadro Bebas', fuente: 'Bebas Neue', negrita: false, color: '#ffffff', mayusculas: true, fondo: { color: 'rgba(12, 12, 20, 0.78)' } },
  { id: 'hormozi', nombre: 'Hormozi', fuente: 'Anton', negrita: false, color: '#ffffff', mayusculas: true, trazo: { color: '#ffe14d' }, sombra: true, clavesTamano: 120 },
  { id: 'hormozi-clasico', nombre: 'Hormozi clásico', fuente: 'Montserrat', negrita: true, color: '#ffffff', mayusculas: true, sombra: true, resaltado: { modo: 'palabra', color: '#ffe14d' } },
  { id: 'marcador', nombre: 'Marcador', fuente: 'Permanent Marker', negrita: false, color: '#ffffff', mayusculas: true, sombra: true },
  { id: 'palabra-gigante', nombre: 'Palabra gigante', fuente: 'Playfair Display', negrita: true, color: '#ffffff', sombra: true, clavesTamano: 300 },
];
