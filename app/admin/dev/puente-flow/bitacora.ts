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
];
