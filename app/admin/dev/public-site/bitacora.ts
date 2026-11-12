// =============================================================================
// Public Site — el registro de construcción del área
// =============================================================================
// Alcance: la cara pública de MaKo en hola-mako.com: la portada, las landings por función de /vsl/<slug> (copiadas de la
// competencia ganadora de cada función, app/vsl/_competencia/) y la vista previa del sitio estilo beehiiv (app/vsl/_sitio/,
// /vsl/sitio y /vsl/comparaciones). La investigación: docs/competencia/landings-por-funcion.md; el relevo:
// docs/relevo/nube-landings-competencia.md; lo aprendido: docs/hallazgos-landing.md.
//
// De dónde salió esto: los `pedido` son textuales, de la sesión en la nube de las landings (11 y 12/11/2026); la hora de
// los prompts es el sello de la transcripción pasado a -03, y la de lo hecho, la del commit. El encargo original (la
// competencia de cada función, d5b1fac7c a las 06:53) está textual en el relevo: su hora no quedó en la transcripción.
//
// NO es un changelog. Va el motivo, la trampa, y lo que quedó SIN hacer.

import type { Hito, Parte } from '../_registro/tipos';

const SESION = 'cli_6913ee01-75cb-51a5-bf12-eaa299056226';
const CHAT = 'Landings por función (nube)';

export const PARTES: Parte[] = [
  { titulo: 'Investigación de la competencia por función', detalle: '21 funciones, de 3 a 6 competidores cada una y la ganadora de cada una, en docs/competencia/landings-por-funcion.md', estado: 'hecha' },
  { titulo: 'Las 19 landings con el diseño de su referencia', detalle: 'Cada /vsl/<slug> copia la estructura, el diseño y los textos de su ganadora (disenos/<slug>.tsx), con el logo, los colores, la llamada y el caso de MaKo', estado: 'hecha' },
  { titulo: 'El feedback del 12/11: lo más vistoso de cada función y los textos de la referencia tal cual', detalle: 'Image con los carruseles que funcionan, Copywriting con los referentes, Web Generator con Replicar, Ops Center con «Tu departamento de marketing»', estado: 'sigue' },
  { titulo: 'La versión con el diseño de MaKo', detalle: 'La misma página con la letra (Urbanist y Geist Mono) y los colores de MaKo: hoy es una vista previa en capturas; se pasa al código si Martín la elige', estado: 'cola' },
  { titulo: 'El sitio estilo beehiiv', detalle: 'Vista previa sin indexar en /vsl/sitio y /vsl/comparaciones: Producto con las 19 landings, Industrias con los avatares, Comparaciones, Precios a /planes. La portada de hoy no cambia hasta que Martín la apruebe', estado: 'sigue' },
  { titulo: 'Closing y Classroom', detalle: 'Closing sin ganadora (nadie en español analiza llamadas de venta) y la portada de Skool no se pudo leer sin sesión', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '11 nov', hora: '12:08', chat: CHAT, sesion: SESION, cuenta: 'nube',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Más landings: Video, Competitor Spy, el CoPilot y todas las que se puedan',
    pedido: '¿Pero por qué hiciste de tan pocas si justamente tenías ejemplos de un montón de otras? Por ejemplo, también me interesa tener la de video, es decir, la de edición. La de la espía de la competencia. El copilot. Podemos generar otras no pudiste generar con todos los ejemplos que tuviste. Y muéstrame',
    puntos: ['Salieron 14 landings más el mismo día (cinco en paralelo, con ayudantes).'],
  },
  {
    fecha: '11 nov', hora: '14:17', chat: CHAT, sesion: SESION, cuenta: 'nube',
    actor: 'claude', tipo: 'implementacion',
    titulo: '19 landings por función con la estructura de su competencia ganadora',
    puntos: [
      'Cada landing es una lista de bloques en app/vsl/_competencia/<slug>.ts, con su referencia (URL y fecha) en la cabecera y lo que afirma verificado en lib/funciones-mako.ts.',
      'Lo que no se pudo: Closing (sin ganadora) y Classroom (Skool vacía sin sesión).',
    ],
    commits: [{ sha: 'a91b723d8', msg: 'Landings de Video, Spy, CoPilot y once más con la estructura de su competencia ganadora', lineas: 3062, archivos: 41 }],
    revisar: '/vsl/video',
  },
  {
    fecha: '11 nov', hora: '20:57', chat: CHAT, sesion: SESION, cuenta: 'nube',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Copiar el diseño de la referencia, no sólo su orden',
    pedido: 'No me gusta para nada el diseño que hiciste. Vuelve a arrasarlo todo, copia de las referencias, copia la estructura, copia el diseño. Lo único que tal vez debe quedar un poco es sutilmente el tema de los colores, el tema del logo y cambios sutiles, pero no inventes, copia la estructura de las páginas.',
    puntos: [],
  },
  {
    fecha: '11 nov', hora: '23:21', chat: CHAT, sesion: SESION, cuenta: 'nube',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Cada landing con la página entera de su referencia',
    puntos: [
      'Una página por landing en app/vsl/_competencia/disenos/<slug>.tsx: la barra, el hero, las secciones, la tipografía y el pie medidos en el navegador (docs/diseno/landings-competencia/<slug>.md).',
      'Las fuentes de las referencias van en public/vsl-assets/fuentes/ (la política de seguridad no deja cargar Google Fonts).',
      '⚠️ Compararlas sin servidor engaña: los gráficos se dibujan al hidratar y en la foto estática salen cajas vacías.',
    ],
    commits: [
      { sha: '6d02ba04c', msg: 'Molde para que cada landing por función copie el diseño de su referencia', lineas: 101, archivos: 4 },
      { sha: '4f93afb40', msg: 'Diseños copiados de la referencia para 18 landings por función (sin conectar todavía)', lineas: 12454, archivos: 84 },
      { sha: '418781413', msg: 'Diseño copiado de Foreplay para la landing de Competitor Spy (sin conectar todavía)', lineas: 1049, archivos: 3 },
      { sha: '68ccc5d65', msg: 'Las 19 landings por función se dibujan con el diseño copiado de su referencia', lineas: 67, archivos: 2 },
      { sha: 'ee9ca659a', msg: 'El menú «Funciones» de Spy y Ads Analyst abre con CSS sin un botón muerto', lineas: 6, archivos: 2 },
    ],
    revisar: '/vsl/competitor-spy',
  },
  {
    fecha: '11 nov', hora: '21:30', chat: CHAT, sesion: SESION, cuenta: 'nube',
    actor: 'martin', tipo: 'prompt',
    titulo: 'La portada como la web de un SaaS grande, con soluciones, precios y comparaciones',
    pedido: 'También te pido rediseñar la admin principal de Maco para que deje de ser una landing y se convierta en una página web como normalmente las tienen los grandes SaaS que arriba tienen una parte de soluciones diferentes desplegables y en ese desplegable de soluciones o no sé cómo ellos lo llaman, features o algo así, que estén justamente todas estas landings, ¿no? Que sería como las soluciones que ofrece Maco. Y ahí puede haber una parte de pricing y bueno, fíjate de copiar alguna, o sea, busca alguna de la competencia para copiar la estructura. Si quieres, mándame opciones y yo te digo cuál de esas podemos copiar.\nMe gusta la de beehiiv y sobre todo la parte de comparaciones, MaKo reemplaza muchísimas apps grandes de la competencia, podemos hacer lo mismo.\nSolo que ahí le falta "Industrias" que sería los avatares de MaKo.',
    puntos: ['Las tres frases llegaron en mensajes seguidos: el pedido, la elección entre las opciones y lo que le faltaba a beehiiv.'],
  },
  {
    fecha: '12 nov', hora: '00:06', chat: CHAT, sesion: SESION, cuenta: 'nube',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El sitio copiado de beehiiv, como vista previa',
    puntos: [
      'La barra con los mega-menús (Producto con las 19 landings, Industrias con los cuatro avatares, Comparaciones y Precios a /planes) y el pie, sin JavaScript: los menús abren con CSS.',
      '/vsl/sitio en el orden de beehiiv, con los planes de planesParaLanding() y el caso de Mauricio; /vsl/comparaciones con las 8 apps de los `reemplaza` de lib/funciones-mako.ts, sin precios ni afirmaciones sobre la competencia.',
      'Sin indexar, y la portada de hoy no se toca hasta que Martín la apruebe. Antes de cambiarla hay que confirmar que /vsl/mako-<avatar> (Industrias) esté publicada.',
    ],
    commits: [{ sha: 'd21baa7eb', msg: 'Vista previa del sitio de MaKo copiado de beehiiv: portada y comparaciones', lineas: 1766, archivos: 10 }],
    revisar: '/vsl/sitio',
  },
  {
    fecha: '12 nov', hora: '00:10', chat: CHAT, sesion: SESION, cuenta: 'nube',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Lo más vistoso de cada función, los textos de la referencia tal cual y una versión con el diseño de MaKo',
    pedido: 'Bueno, te doy feedback de las landing. Primero lo que veo es que tal vez no aprovechaste bien todo lo que hace realmente Maco. Por ejemplo, en la parte de carruseles, pusiste 8 tipos de carruseles, todo es editable, cuando realmente podés traer los montón de carruseles de la competencia y podés ver super outliers, y de hecho podemos sacar un screenshot a cómo se ve eso dentro de Maco porque es buenísimo. Luego la parte de copywriting, en lugar de el método de copywriting escribiendo en tus 100 páginas, o sea, lo atractivo de la página original era 100 años de copywriting instalado en tu inteligencia artificial. En este caso podríamos aprovechar la cantidad de gurús que hemos analizado, o sea, por ejemplo, puede ser más de 100 gurús o más de 100 expertos de marketing analizados y puestos en tu IA, instalados en tu IA, algo así, y ahí después podemos poner como las caritas de los animadas de los gurús, o sea, las caricaturas, ¿no? Luego, en la parte de landing, tal vez no pusiste lo de replicar, que eso está buenísimo. Entonces te pido que des una revisada a eso. Y luego hay ciertas cosas que también valen la pena copiarlo directamente. Por ejemplo, en Holo dice Your Marketing Department One Hire. O sea, tu departamento de marketing, y eso estaría bueno copiarlo, o sea, porque es cierto, o sea, dentro de Mago tenés tu departamento de marketing. Y en lugar de tú apruebas, o sea, no tiene sentido eso ahí. O sea, hay ciertas cosas que valen la pena copiarlas tal cual, porque coinciden con Mako. Y por último, te pido de que, así como me pusiste el original y la adaptación en Maco, me pongas una tercera screenshot donde yo vea ahora también la adaptación en diseño de Maco, te pido de que la adaptación en diseño no rompa el diseño original de donde estamos inspirándonos, sino que tenga sutilezas con la tipografía de Maco, con los colores de Maco, pero sin romper lo original. Entonces yo también veo cómo queda el diseño.',
    puntos: [
      'La regla que sale: los textos de la referencia se copian tal cual, traducidos, donde son verdad para MaKo; inventar un titular propio cuando el de la referencia ya era cierto es lo que no se hace.',
      'El número de referentes es el del código (32 en lib/asesores/catalogo.ts, con su caricatura), no «más de 100».',
    ],
  },
  {
    fecha: '12 nov', hora: '00:55', chat: CHAT, sesion: SESION, cuenta: 'nube',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Las 19 landings con lo más vistoso de MaKo y los textos de su referencia tal cual',
    puntos: [
      'Image abre con «Carruseles que funcionan» (outliers, buscar, filtrar, «Editar»); Copywriting dice «32 referentes del marketing, instalados en tu IA» con sus caricaturas y el «Inspirado en»; Web Generator suma «Replicar»; Ops Center copia «Tu departamento de marketing. Una sola contratación.» de Holo.',
      'En las 19, los textos de la referencia traducidos frase por frase; fuera lo que no está medido (conversiones, 24/7, «triplica»). Cada cabecera lista el original y la traducción.',
      '⚠️ Falta la captura real de «Carruseles que funcionan»: en la nube no hay AUTH_SECRET para entrar a la app. Los pasos, en el relevo.',
      'La tercera versión («con el diseño de MaKo»: su letra y sus colores sobre el diseño copiado) es una vista previa en capturas; se pasa al código si Martín la elige.',
    ],
    commits: [
      { sha: '23ed3633e', msg: 'Image, Copywriting, Web Generator y Ops Center con lo más vistoso de MaKo y los textos de su referencia', lineas: 616, archivos: 9 },
      { sha: 'a4d60b930', msg: 'Las otras 15 landings con los textos de su referencia, tal cual y traducidos', lineas: 866, archivos: 18 },
    ],
    revisar: '/vsl/copywriting',
  },
  {
    fecha: '12 nov', hora: '07:20', chat: 'Landings de /vsl', sesion: 'local_ec06a1f5-08a0-4404-80fb-5123883b13aa', cuenta: 'claude5',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'AI Avatar con las imágenes reales de sus escenas en la portada',
    puntos: [
      'Martín aprobó poner imágenes reales de avatares en el hero («Sí, con imágenes»): van tres plantillas de venta con la imagen de su preset (public/formatos/presets/, con su cara), en abanico, la principal con la primera frase de su gancho. La silueta se fue.',
      'Los pasos «Elige tu escena» y «Genera tu anuncio» usan las mismas imágenes. Mirado a 1440 y a 375, sin scroll horizontal.',
      '⚠️ Producción servía a23bad24f, antes de los textos del 12/11 y del sitio estilo beehiiv: lo que Martín vio en el visor estaba en main y no en el aire.',
    ],
    revisar: '/vsl/ai-avatar',
  },
  {
    fecha: '12 nov', hora: '08:10', chat: 'Landings de /vsl', sesion: 'local_ec06a1f5-08a0-4404-80fb-5123883b13aa', cuenta: 'claude5',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Sin agendar llamadas: la prueba gratis en todos lados, el sitio navegable, el sol y la luna, y su VSL en la portada',
    pedido: 'Bueno, lo primero que te pido es que elimines de todos lados lo de agendar llamada porque hoy en día vamos a hacer que el CTA de todos sea comienza tu prueba gratuita. Porque promocionamos la prueba gratuita, entonces en todos lados tiene que ser comienza tu prueba gratuita. Luego elimina también la sidebar de landings de Maco porque yo debería poder navegar por todo con lo que ya tenemos, ¿no? De en la navegación de la top bar, etc. Luego, por ejemplo, hay ciertas cosas que no funcionan todavía, como por ejemplo la tab de precios no hace nada, y deberíamos ya tener eso. Y haz que todo sea navegable tal cual como quedaría. Por ejemplo, si le aprieto el logo de Maco, que me vaya el logo de Maco. Luego no tiene sentido arriba entrar, ver planes, agenda tu llamada. O sea, debería ser registrarse, loguearse también. Sí podría ser ver planes. En lugar de agenda tu llamada y registrarse gratis o algo así. Luego estaría bueno de que ahí arriba también esté como el botoncito de luna y sol que tenemos, que si se aprieta haga la misma animación que tenemos dentro de Maco, que es como el círculo que se va expandiendo, que hace dark mode, etcétera, y que obviamente eso se mantenga. Si yo me voy a tratar que se mantenga lo último que hice, en una parte me gustaría que revises todo lo que falta porque tal vez hay botones que todavía no andan, como por ejemplo el de precios.\nY por otro lado, también en la página principal, en la landing principal, pusiste CRM Ops Center y Automation, cuando en esa parte debería estar el VSL que yo ya grabé.',
    puntos: ['Se lo había dado a la cuenta claude4 en la sesión de la nube y no llegó al relevo: lo volvió a pegar en el chat de claude5.'],
  },
  {
    fecha: '12 nov', hora: '09:05', chat: 'Landings de /vsl', sesion: 'local_ec06a1f5-08a0-4404-80fb-5123883b13aa', cuenta: 'claude5',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Un solo botón para empezar, el sol y la luna en las 21 páginas, y la portada con el VSL',
    puntos: [
      'El botón de las 19 landings y del sitio sale de app/vsl/_competencia/cta.ts y lleva a /planes. Sigue al interruptor de la prueba gratis: con la prueba apagada dice «Empieza con MaKo», para no prometer días gratis que el cobro no da.',
      'La barra del sitio: «Iniciar sesión», «Ver planes», el sol y la luna, y el botón para empezar. El sol y la luna es un script en línea (TemaSitio.tsx) con el barrido de la app, y recuerda el modo de una página a otra.',
      '«Industrias» llevaba a cuatro páginas que daban 404: ahora a las publicadas el 23/10 (coaches, infoproductores, inmobiliarias); agencias no tiene página.',
      'La portada nueva muestra el VSL de Martín (el de la portada de hoy) en lugar de las pantallas del CRM, el Ops Center y Automations.',
      '⚠️ Sin prender: la prueba gratis (PRUEBA_GRATIS_PRENDIDA). Cambia /planes, /reembolsos, /terminos y Partners: lo decide Martín.',
    ],
    revisar: '/vsl/sitio',
  },
];
