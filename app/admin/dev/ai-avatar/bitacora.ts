// =============================================================================
// AI Avatar — el registro de construcción de la tab tipo HeyGen
// =============================================================================
// ESTO NO ES UN CHANGELOG. Acá va lo que git no guarda: qué pidió Martín con sus
// palabras y por qué se resolvió así. Lo aprendido vive en docs/hallazgos-ai-avatar.md.
// Se agrega AL FINAL del array (orden cronológico). La pantalla lo lee al revés.

import type { Hito, Parte } from '../_registro/tipos';

const CH = 'AI Avatar';
const SESION = 'local_54b66516-3407-49c7-8bd9-ee08d420db69';

/** Las fases del área y en qué anda cada una. */
export const PARTES: Parte[] = [
  { titulo: 'La tab con las cuatro secciones de HeyGen', detalle: 'Crear video, Avatares, Voces y Plantillas, copiadas de HeyGen por su documentación; la ve sólo el super admin', estado: 'hecha' },
  { titulo: 'Looks: tu foto en una escena', detalle: 'Una imagen de Flow con la cara de la persona y la composición de una plantilla; gratis en créditos', estado: 'hecha' },
  { titulo: 'Video del avatar', detalle: 'El plan del Video Generator con el look como escenario de todas las tomas, filmadas en serie; se edita y exporta en el Video Editor', estado: 'hecha' },
  { titulo: 'Galería de voces en español', detalle: '25 voces públicas de ElevenLabs para escuchar, y sumarlas a la cuenta del cliente con su key', estado: 'hecha' },
  { titulo: 'Imágenes de ejemplo de la galería', detalle: 'Generar en Flow (gratis) una imagen por plantilla; hoy sólo dos plantillas tienen video real', estado: 'sigue' },
  { titulo: 'El video con la voz elegida o clonada', detalle: 'Reemplazar la voz de Flow por la de ElevenLabs (STS) y remuxar en el navegador con mediabunny', estado: 'cola' },
  { titulo: 'Guion largo con labios guiados por audio', detalle: 'Donde HeyGen gana: un motor de retrato + audio (InfiniteTalk o StableAvatar). Es gasto de medios: lo decide Martín', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '17 oct', hora: '04:55', chat: 'Runner', sesion: 'local_354ef1cd-0c58-4da4-9f6c-628fe3a4e686', cuenta: 'claude4', actor: 'martin', tipo: 'prompt',
    titulo: 'La tab AI Avatar, como HeyGen, con galería de ejemplos',
    pedido: 'Quiero que implementes end-to-end la tab nueva de "AI Avatar", este chat debería llamarse "AI Avatar". Haz la investigación para copiar a otras apps... Me imagino algo como Heygen... Busca alternativas o clones de esas apps como "https://github.com/topics/heygen-alternative" y también "https://github.com/debpalash/VoiceStudio" para clonar la voz... Recuerda que también quiero una "galería" de ejemplos o temas... Tanto en imagen, video y voz... Y estoy seguro que encuentras mas repos o skills o cosas para copiar eso también...',
    puntos: [
      'Llegó desde el Centro de Operaciones por el Runner; el chat «Video Generator» pasó a llamarse «AI Avatar».',
    ],
  },
  {
    fecha: '17 oct', hora: '05:30', chat: CH, sesion: SESION, cuenta: 'claude4', actor: 'claude', tipo: 'investigacion',
    titulo: 'HeyGen, sus clones y las licencias de los repos',
    puntos: [
      'HeyGen pide cuenta y no había navegador conectado: la estructura se copió de su documentación oficial y de capturas públicas de 2026, y así se dice.',
      'El topic heygen-alternative tiene 8 repos y dos son señuelos de malware. VoiceStudio es AGPL y su motor por defecto tiene pesos no comerciales: no se copia.',
      'Limpios para uso comercial: InfiniteTalk, StableAvatar, EchoMimicV3, LongCat (avatar por audio) y Chatterbox, Qwen3-TTS (voz). Ningún repo se copió: la tab usa Flow y ElevenLabs, que ya estaban.',
    ],
  },
];
