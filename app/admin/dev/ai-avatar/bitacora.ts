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
  { titulo: 'La tab con las cuatro secciones de HeyGen', detalle: 'Crear video, Avatares, Voces y Plantillas, copiadas de HeyGen por su documentación. Reemplazadas el 29/10 por el estudio de Higgsfield (sus rutas redirigen)', estado: 'hecha' },
  { titulo: 'El estudio de Higgsfield, con el diseño de Create', detalle: 'Una sola pantalla: el chat de MaKo fijo a la izquierda, los proyectos (cada look con sus videos) al costado, «Nueva» con 28 presets por categoría, la barra de prompt y el selector de presets; en la computadora y en el teléfono', estado: 'hecha' },
  { titulo: 'Looks: tu foto en una escena', detalle: 'Una imagen de Flow con la cara de la persona y la composición de una plantilla; gratis en créditos', estado: 'hecha' },
  { titulo: 'Video del avatar', detalle: 'El plan del Video Generator con el look como escenario de todas las tomas, filmadas en serie; se edita y exporta en el Video Editor', estado: 'hecha' },
  { titulo: 'Galería de voces en español', detalle: '25 voces públicas de ElevenLabs. La pantalla se deprecó el 29/10: la voz elegida no llegaba al video; la galería queda como dato', estado: 'hecha' },
  { titulo: 'Imágenes de ejemplo de los presets', detalle: 'Generar en Flow (gratis) una imagen por preset; hoy sólo dos tienen imagen real y el resto muestra el degradado de su categoría', estado: 'sigue' },
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
  {
    fecha: '17 oct', hora: '06:09', chat: CH, sesion: SESION, cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'La tab AI Avatar: looks, voces, plantillas y el video del avatar',
    puntos: [
      'Cuatro secciones copiadas de HeyGen: Crear video, Avatares, Voces y Plantillas. La ve sólo el super admin hasta que la valides.',
      'Un look es tu foto en una escena de la galería; sale gratis por Flow. Con un look se crea el video: tu guion, en tomas, por el motor del Video Generator.',
      'Voces: 25 voces en español para escuchar y sumar a la cuenta de ElevenLabs del cliente. El video todavía sale con la voz de Flow en su acento.',
      'Cómo se prueba: en un workspace con foto cargada y la extensión de MaKo al día, Avatares → elegir foto y tema → Crear look; cuando aparece, Crear video → guion → Generar video. Al terminar, Editar y exportar abre el Video Editor.',
    ],
    commits: [
      { sha: 'ee1b411c', msg: 'AI Avatar: la tab tipo HeyGen, con looks, galería de voces y de temas, y el video del avatar', lineas: 1738, archivos: 26 },
    ],
    archivos: [
      'app/ai-avatar/AiAvatarCliente.tsx — las cuatro secciones',
      'app/ai-avatar/actions.ts — looks, video y voces (sin generación propia)',
      'lib/ai-avatar/plantillas.ts y voces-galeria.ts — las galerías',
      'lib/flow-cara.ts — la cara de una foto en Flow, compartida con el Video Generator',
    ],
    revisar: '/ai-avatar/avatares',
  },
  {
    fecha: '29 oct', hora: '01:56', chat: 'Cerebro', sesion: 'local_428051c1-0369-4df2-ae6b-bcb42f63b64b', cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'AI Avatar = Higgsfield tal cual, con el diseño único de Create',
    pedido: 'Lo mismo para AI Avatar... En ese caso replica a higgsfield tal cual, busca un repo o algo y replícalo...',
    puntos: [
      '«Lo mismo» es el diseño de Create: el chat de MaKo siempre abierto a la izquierda, los proyectos al costado con la flecha y «Nueva», «Nueva» con templates bajo «¿Qué vas a crear hoy?», sin tabs internas y sin onboarding.',
      'El motor sigue siendo Google Flow por la interfaz; lo de Higgsfield que no tenga motor se ve y dice en una línea que no está.',
    ],
  },
  {
    fecha: '29 oct', hora: '05:40', chat: 'AI Avatar = Higgsfield', sesion: 'local_33825c6f-c9c1-47aa-9819-ca9159f3de04', cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: 'El estudio de Higgsfield con el motor de MaKo',
    puntos: [
      'Higgsfield se relevó en su sitio (AI Influencer, la barra de prompt de Image, el selector de presets). El repo abierto que más se le parece (Open-Generative-AI, MIT) se estudió y no se copió: es un selector de modelos por API paga, sin presets ni personaje.',
      'Una pantalla: proyectos a la izquierda (cada look con sus videos), «Nueva» con 28 presets en seis categorías y «Nuevos», la barra de prompt (Modelo, Formato, Cantidad, Personaje, Preset, Generar) y cada proyecto con su imagen, «Recrear», «Descargar», «Eliminar» y la barra para animarlo.',
      'Lo que se escribe en la barra ajusta la escena: va al final del prompt del preset, nunca lo reemplaza (si no, se perdía en el auto o se iba la cara).',
      'Sin motor y a la vista con su línea: otros modelos, 3:4 y 16:9, más de una imagen, 2K, la voz clonada, Motion y diseñar un personaje sin foto.',
      'Se deprecaron las cuatro secciones de HeyGen (sus rutas redirigen) y la pantalla de Voces: la voz elegida no llegaba al video.',
    ],
    revisar: '/ai-avatar',
  },
];
