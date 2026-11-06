// =============================================================================
// Puente a Google Flow — el registro de construcción de la extensión
// =============================================================================
// ESTO NO ES UN CHANGELOG. El changelog está en `git log`. Acá va lo que git no guarda: qué
// pidió Martín con sus palabras y por qué se resolvió así. Lo aprendido vive en
// docs/hallazgos-generativa.md (el área tiene ~7.100 líneas de historia ahí, de antes de
// esta bitácora); el estado para retomar, en docs/relevo/video-generator.md.
//
// Las horas de los prompts son las del chat; las de la implementación, las del commit. Se
// agrega AL FINAL del array (orden cronológico). La pantalla lo lee al revés.

import type { Hito, Parte } from '../_registro/tipos';

const CH = 'Video Generator';
const SESION = 'local_54b66516-3407-49c7-8bd9-ee08d420db69';

/** Las fases del área y en qué anda cada una. */
export const PARTES: Parte[] = [
  { titulo: 'El motor por interfaz', detalle: 'La extensión 0.69.0 genera video e imagen y sube la foto apretando los botones reales de Flow en la pestaña del cliente, en vez de repetir pedidos de BOQ aprendidos', estado: 'hecha' },
  { titulo: 'La prueba en vivo', detalle: 'En el Chrome de Martín: la sonda (gratis), una imagen (0 créditos) y un clip (≈12), cada uno con la cara y visto en MaKo', estado: 'sigue' },
  { titulo: 'La cara que no está en el proyecto', detalle: 'Si la foto guardada no aparece en el selector de Flow, volver a subirla sola en vez de cortar con «Tu foto no está en este proyecto de Flow»', estado: 'cola' },
  { titulo: 'Retirar el camino de BOQ', detalle: 'El replay, las plantillas y el wizard de «enséñame», cuando ningún cliente siga en una extensión ≤ 0.68', estado: 'cola' },
  { titulo: 'La cola de montaje', detalle: 'La atiende un cron de Vercel con ffmpeg-static cada 2 minutos y lo que queda más de 6 horas en la fila se da de baja; falta ver el primer montaje en producción', estado: 'sigue' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '17 oct', hora: '00:30', chat: 'Cerebro', sesion: 'local_797d5445-2365-464d-ae3d-1d71aa7baa8c', cuenta: 'claude4', actor: 'martin', tipo: 'prompt',
    titulo: 'Terminar la conexión con Flow para el Video Generator',
    pedido: 'termina la conexión con Flow para los Video Generator, te paso cómo hacerlo, cópialo entero, dime si deprecamos la extensión o aún nos sirve',
    puntos: [
      'Las referencias: el video «I Fully Automated Google Flow Using Claude Code» y el repo github.com/GTAI-1/flow-mcp.',
      'flow-mcp no tiene licencia (todos los derechos reservados): se estudió el método y se reescribió con código propio; ningún archivo suyo entró al repo.',
    ],
  },
  {
    fecha: '17 oct', hora: '01:09', chat: CH, sesion: SESION, cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'La extensión genera apretando los botones de Flow (0.69.0) — falta la prueba en vivo',
    puntos: [
      'La extensión NO se depreca: es lo único que corre en el navegador de cada cliente con su cuenta de Flow; flow-mcp sirve para una PC con Claude, no para la app. Cambió su motor.',
      'El replay de BOQ se dejó: cada rechazo de Google pedía reponer otra pieza efímera (el at, el captcha de un solo uso, los ids de cliente), y lo que faltaba era justo la cara y el sondeo del video.',
      'La plata: «salió» se escribe antes del clic en «Start generation», un trabajo pagado nunca se vuelve a apretar, y no se aprieta si Flow cotiza más que el tope (video 15, imagen 0).',
      'La pestaña baja el archivo con su sesión y lo sube a nuestro Storage; el latido no espera a Flow y el route renueva los trabajos en curso para que el rescate de 10 minutos no los reparta de nuevo.',
      'El server manda pedidos de interfaz sólo a extensiones ≥ 0.69.0: Mauricio sigue igual hasta que actualice.',
      'Cómo se prueba: recargar MaKo en chrome://extensions (debe decir 0.69.0), dejar Flow abierto dentro de un proyecto, y en el Video Generator generar la imagen de una escena y después su toma.',
    ],
    commits: [
      { sha: '0e068f40', msg: 'Video Generator: la extensión genera apretando los botones reales de Flow (motor por interfaz, 0.69.0)', lineas: 2034, archivos: 22 },
      { sha: '8a70f492', msg: 'Extensión 0.69.0: el zip y su huella, generados sobre el contenido que publica git', lineas: 2, archivos: 2 },
    ],
    archivos: [
      'extension/flow-interfaz.js — el motor: ajustes, la cara por el selector de ingredientes, el prompt, «Start generation», la baldosa nueva',
      'extension/background.js — la sección «EL MOTOR POR INTERFAZ»: anota, corre de a uno, cosecha',
      'lib/flow-interfaz.ts — el contrato del lado de MaKo (qué versión, qué pedido, qué ruta se firma)',
      'lib/flow-cola.ts — seguirTomados y firmarSubidas',
      'tests/flow-interfaz-motor.test.ts — el motor real contra una pestaña de Flow simulada',
    ],
    revisar: '/video-generator',
  },
  {
    fecha: '17 oct', hora: '01:10', chat: CH, sesion: SESION, cuenta: 'claude4', actor: 'claude', tipo: 'cosecha',
    titulo: 'Qué hace flow-mcp y por qué la interfaz reemplaza al replay',
    puntos: [
      'docs/hallazgos-generativa.md → «El motor por interfaz reemplaza al replay de BOQ»: las nueve trampas, la primera es que la pestaña de fondo no tiene reloj (Chrome alinea sus timers a un minuto).',
      'docs/hallazgos-infra.md → zip-extension en un worktree de Windows hashea los CRLF del disco.',
    ],
    commits: [
      { sha: 'be7a2b67', msg: 'Hallazgo: zip-extension en un worktree de Windows hashea los CRLF del disco', lineas: 16, archivos: 1 },
    ],
  },
  {
    fecha: '20 oct', hora: '17:36', chat: 'Cerebro', sesion: 'local_797d5445-2365-464d-ae3d-1d71aa7baa8c', cuenta: 'claude4', actor: 'martin', tipo: 'prompt',
    titulo: '«68.646 minutos esperando turno»: la cola de montaje no la atiende nadie',
    pedido: 'Sale «68.646 minutos esperando turno»: es un trabajo real de la cola de montaje, del 01/09, pero el proceso que ejecuta esa cola NUNCA se desplegó. Por eso las tomas tampoco llegan al editor.',
    puntos: [
      'Lo vio Martín en la llamada con Leila del 19/10 (docs/investigacion-ops-center-19-10.md).',
      'El pedido: medir la cola sólo leyendo, hacer que se procese con un cron como los demás, y dar de baja lo viejo con un mensaje honesto. Probar en el ws3, nunca en el ws1.',
    ],
  },
  {
    fecha: '20 oct', hora: '18:10', chat: CH, sesion: SESION, cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'La cola de montaje la atiende un cron de Vercel, y nada espera para siempre',
    puntos: [
      'Medido: dos trabajos en la cola, #3 (ws1, 01/09) y #4 (ws11, 02/09), los dos sin tomar nunca. El worker en contenedor no se desplegó y, desplegado, no habría montado: nadie creaba la voz de cada toma (sts-N.mp3).',
      'El montaje pasó a Node (lib/montaje/pipeline.ts) y lo corre /api/cron/montaje cada 2 minutos con ffmpeg-static, uno por corrida. La voz sale del audio de cada clip de Flow.',
      'Lo que queda más de 6 horas en la fila se da de baja como «vencido», y la pantalla lo dice así: quedó en la fila sin que nadie lo tomara, fue un problema nuestro, móntalo de nuevo. La espera se dice en horas, no en minutos.',
      'De paso: el plan de cortes topeaba todas las tomas en la duración de la primera; ahora usa la de cada una.',
      'Probado en local con tres tomas de prueba y Groq real: 24 s → 12 s, Anton, −14 LUFS. La primera vez en la función (ffmpeg 7.0.2 en Linux) se ve recién en producción.',
    ],
    archivos: [
      'lib/montaje/pipeline.ts — el montaje en Node: bajar, voz de cada toma, cortes, mezcla, subtítulos, render',
      'lib/montaje/cola.ts — cuándo vence un trabajo, qué falla se reintenta, cómo se dice la espera',
      'app/api/cron/montaje/route.ts — vence, toma uno, lo monta y lo sube',
      'scripts/plan-cortes-anuncio.mjs — duración sin ffprobe y una por toma',
      'tests/montaje-cola.test.ts — 12 tests, 14 roturas',
    ],
    revisar: '/video-generator',
  },
  {
    fecha: '27 oct', hora: '19:00', chat: 'Cerebro', cuenta: 'nube', actor: 'martin', tipo: 'prompt',
    titulo: 'Terminar el Video Generator: menos pantallas, copiado de una app de referencia, con MaKo al costado',
    pedido: 'implementar Video Generator, que nos quedó a medias... Tiene una cantidad de pestañas absurdas, el diseño, que se parezca a una app que tomemos de referencia etc...',
    puntos: [
      'Lo pasó el Cerebro a una sesión en la nube, con lo que cuenta como hecho: una app de referencia elegida y copiada tal cual, el flujo en el mínimo de pantallas, los proyectos al costado sin cambiar de ruta, el chat de MaKo al costado como en Web Generator, todo lo de los botones también por prompt, los colores de MaKo y la generación por el puente de siempre.',
      'Sin tocar el Video Editor, el Image Editor ni la extensión. Todavía sin VidIQ ni Submagic.',
    ],
  },
  {
    fecha: '27 oct', hora: '19:45', chat: CH, sesion: 'cli_638a660a-c026-54e2-bfa1-38ca0a0103d4', cuenta: 'nube', actor: 'claude', tipo: 'implementacion',
    titulo: 'El estudio de video, copiado de Arcads: proyectos, anuncio y MaKo en una pantalla',
    puntos: [
      'La referencia es Arcads (su «New Project»: el guion, el actor de una biblioteca de videos, «Generate»; los proyectos a la izquierda). Se copió la estructura, con los colores de la casa.',
      'Una ruta, tres columnas: los anuncios en la barra (en curso con en qué anda cada uno, y los terminados), el anuncio en el centro y el chat de MaKo a la derecha. Abrir o crear un anuncio no cambia de ruta: viaja en ?plan= y conserva el ?ws=.',
      'El anuncio nuevo es UNA pantalla (guion, formato y lugar) en vez de cuatro pasos; el wizard del anuncio abierto ya no pregunta el lugar si se eligió al crear.',
      'El chat es el de la app (el mismo que el del Second Brain), con el anuncio abierto como entidad. 21 operaciones nuevas en la API (lib/api-mako/areas/video-estudio.def.ts) que llaman a la MISMA acción que cada botón, sólo por el chat de la app y nunca en una automatización; filmar se confirma en pantalla, de a una toma.',
      'La tab deja el negro forzado de Flow: los tokens de MaKo, claro u oscuro según elija la persona.',
    ],
    archivos: [
      'app/video-generator/estudio/ — el estudio: barra, composer, chat, inventario botón ↔ operación',
      'lib/api-mako/areas/video-estudio.def.ts y .run.ts — las operaciones del chat',
      'tests/video-estudio.test.ts, video-estudio-api.test.ts, video-estudio-chat.test.ts — 19 tests, 17 roturas',
    ],
    revisar: '/video-generator',
  },
  {
    fecha: '6 nov', hora: '02:52', chat: 'Thiago anuncios', sesion: 'cli_bf66b858-af9b-52bd-97de-5d68c180abe6', cuenta: 'nube', actor: 'claude', tipo: 'implementacion',
    titulo: '«Guardar en MaKo»: el perfil abierto de Instagram o LinkedIn, como lead del CRM (extensión 0.77.0)',
    puntos: [
      'Lo prometido a la agencia de Thiago. Sobre un perfil de Instagram o de LinkedIn, el desplegable ofrece «Guardar en MaKo»: de a uno, a la vista y con dos toques. El primero lee el perfil una vez (mundo aislado, sólo `activeTab`) y MaKo dice qué entendió y si ya está, sin guardar; «Guardar en mi CRM» crea el lead con el nombre que la persona corrige.',
      'Lo interpreta el servidor (lib/perfil-captura.ts): el usuario sale de la DIRECCIÓN, nunca del título, que lo escribe quien tiene la cuenta. El lead nace con su @ o su LinkedIn, su origen propio y la foto de Instagram.',
      'Sin permisos nuevos ni content scripts. La política de privacidad lo dice (6/11/2026).',
      '⚠️ Nadie lo probó en una página real de Instagram ni de LinkedIn (la nube no puede): hay que verlo en el Chrome de Martín antes de publicar la 0.77.0.',
    ],
    commits: [
      { sha: '39e48790', msg: 'Extensión 0.77.0: «Guardar en MaKo» guarda como lead el perfil abierto de Instagram o LinkedIn', lineas: 1015, archivos: 20 },
    ],
    archivos: [
      'extension/perfil-reglas.js · perfil-leer.js · popup.js · popup.html — el botón, el lector y las pantallas',
      'lib/perfil-captura.ts · lib/perfil-captura-db.ts · app/api/crm/extension/route.ts — qué se entiende y qué se guarda',
      'app/crm/origen-lead.ts · lib/leads.ts — el origen y el LinkedIn del lead',
      'tests/perfil-extension.test.ts — 11 casos, seis roturas en la cabecera',
      'docs/hallazgos-extension.md · docs/hallazgos-crm.md',
    ],
    revisar: '/crm',
  },
];
