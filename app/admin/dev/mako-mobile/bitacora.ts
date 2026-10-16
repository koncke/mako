// =============================================================================
// MaKo Mobile — el registro de construcción de la app del teléfono (/m/*)
// =============================================================================
// ESTO NO ES UN CHANGELOG. El changelog está en `git log`. Acá va lo que git no guarda: qué
// pidió Martín con sus palabras y por qué se resolvió así. Las decisiones y la spec viven en
// docs/diseno-mako-mobile.md; lo aprendido, en docs/hallazgos-mobile.md.
//
// Las horas de los prompts son las del chat (hora de Argentina); las de la implementación, las
// del commit. Se agrega AL FINAL del array (orden cronológico). La pantalla lo lee al revés.

import type { Hito, Parte } from '../_registro/tipos';

const CH = 'MaKo Mobile';

/** Las fases del área y en qué anda cada una. */
export const PARTES: Parte[] = [
  { titulo: 'El shell y la PWA', detalle: 'Árbol /m con su header y su barra por rol, manifest que abre la app y no la landing, service worker sin caché', estado: 'sigue' },
  { titulo: 'Today, Inbox, MaKo, CRM y Plan', detalle: 'Las cinco pantallas re-adaptadas: el Pulso, aprobar, el chat con voz y fotos, la ficha con agendar, las tareas de hoy', estado: 'sigue' },
  { titulo: 'Web Push', detalle: 'Los avisos que ya salen por WhatsApp también al teléfono, por persona; y «MaKo te pide confirmar»', estado: 'sigue' },
  { titulo: 'La v2: app nativa con la piel de MaKo', detalle: 'Claro por defecto, título grande, listas agrupadas, barra Today · CRM · Inbox · Plan · More y seis secciones más en More (Dashboard, Ads Manager, Customer Success, Automations, Video, Landing)', estado: 'sigue' },
  { titulo: 'Cualquier teléfono ve /m, con las mismas URLs', detalle: 'Un celular que abre /crm ve la versión del teléfono en esa misma URL (el proxy la sirve); lo que no va al teléfono dice que se usa en la computadora', estado: 'sigue' },
  { titulo: 'Medir en un iPhone y un Android de verdad', detalle: 'Voz, push, instalar, teclado y gestos no se pueden probar en un navegador sin pantalla', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '11 oct', hora: '04:29', chat: CH, cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'Implementar MaKo Mobile completo',
    pedido: 'Implementa completamente MaKo Mobile... Apalancate de diseños de otras apps e incluso de skills de skill.sh',
    puntos: [
      'Lo define la tarjeta «MaKo App Mobile» del seed del plan: no todas las pestañas van al teléfono, y las que van se re-adaptan 100%. Terminado cuando el dueño o el closer abre el celular, ve su Hoy, le responde a MaKo por voz y aprueba una acción.',
      'Se sumó el caso de la #521: agendar DURANTE una llamada desde el teléfono, que es lo que un cliente intentó en vivo y no pudo.',
    ],
  },
  {
    fecha: '11 oct', hora: '04:45', chat: CH, cuenta: 'claude3', actor: 'claude', tipo: 'investigacion',
    titulo: 'El relevo: qué existe, qué falta y de dónde se toma el diseño',
    puntos: [
      'La decisión abierta de la tarjeta, PWA o nativa, se cerró por PWA: cubre push (iOS 16.4+ instalada), cámara y voz, y es la única que se puede entregar completa desde una sola base.',
      'El manifest abría la LANDING de venta (start_url «/») a la persona logueada que agregó MaKo a su pantalla de inicio.',
      'La campanita no existía: la tabla de avisos nunca se aplicó en producción y el código se tragaba el error.',
      'El chat de MaKo de la app sólo lee, por una decisión escrita: hasta que exista el «turno compartido». Responder por voz y aprobar desde el chat exige construirlo.',
      'De skills.sh se instalaron mobile-native (el piso de plataforma: safe areas, 100dvh, inputs de 16 px), web-haptics (en iOS navigator.vibrate no existe) y thumb-first (push en iOS e instalar). De impeccable se leyeron crudos los vetos de craft-floor y adapt («adaptar es repensar, no escalar»).',
      'Apps de referencia: Linear (el móvil como complemento, el Inbox al centro), Superhuman y Avec (una acción por lado del swipe, con deshacer), Close (barra de cinco destinos), ChatGPT y WhatsApp (el micrófono: mantener para grabar, deslizar para cancelar), Things (Today como una sola lista) y Calendly (agendar: día, horarios libres, botón que nombra el horario).',
    ],
    archivos: ['docs/diseno-mako-mobile.md', 'lib/movil-rutas.ts'],
  },
  {
    fecha: '11 oct', hora: '14:52', chat: CH, cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: 'La app del teléfono en /m, con salida escalonada',
    puntos: [
      'Today, Inbox (con la campanita, que no existía), MaKo (voz, fotos y aprobar desde el hilo), CRM (ficha, agendar en la llamada, WhatsApp de la línea del negocio) y Plan (marcar hecha con deshacer).',
      'Web Push por persona: los avisos que ya salían por WhatsApp, y «MaKo te pide confirmar». Los avisos del negocio son de admin, como en escritorio.',
      'Salió con el reparto de teléfonos APAGADO: ninguna pantalla se pudo renderizar antes del deploy (la máquina no tenía RAM para un next dev). Se abre por URL hasta verla en producción.',
      'La revisión adversarial cerró tres bugs: chats del teléfono legibles por otra persona por las rutas de escritorio, la suscripción que seguía siendo de la cuenta anterior y los links con ?ws=9 que abrían el plan vacío.',
    ],
    commits: [{ sha: 'ef8626ce', msg: 'MaKo Mobile: la app del teléfono en /m (PWA), con Web Push y el chat de MaKo que propone y se aprueba desde el hilo', lineas: 44028, archivos: 328 }],
    archivos: ['app/m/', 'lib/movil-rutas.ts', 'lib/movil-guard.ts', 'lib/push.ts', 'lib/mako-turno-app.ts', 'lib/inbox-movil.ts', 'lib/vista-general.ts', 'app/plan/board/prioridades.ts', 'public/sw.js', 'docs/hallazgos-mobile.md'],
  },
  {
    fecha: '11 oct', hora: '21:54', chat: CH, cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'Que cualquier teléfono vea el diseño nuevo, no sólo la app',
    pedido: 'Entré desde mi celular a la web de MaKo y no se ven los cambios... No solamente tienes que hacerlo como "app" sino a cualquiera que entre desde mobile le debe salir este diseño.',
    puntos: [
      'No veía los cambios porque el desvío de teléfonos (MOVIL_ACTIVO) seguía APAGADO desde la v1: un celular que entraba a la web caía en el escritorio, y /m sólo se abría escribiendo la URL.',
      'Sus tres preguntas del diseño v2 quedaron sin contestar; se implementó con lo conservador: Video y Landing sobre lo que hay en main, el teléfono no gasta créditos de Google Flow, y Ads Manager sólo con lo que ya existe.',
    ],
  },
  {
    fecha: '12 oct', hora: '00:20', chat: CH, cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: 'La v2 implementada y el desvío de teléfonos prendido (sin commit todavía: la hora es la de la integración)',
    puntos: [
      'Doce agentes rehicieron el armazón y las pantallas sobre el prototipo v2, con datos reales: Today, Inbox, CRM (lista, ficha y chat), Plan, More, Dashboard, Ads Manager, Customer Success, Automations, Video, Landing, MaKo y la cuenta. Cada escritura reusa la action de escritorio con su mismo gating.',
      'MOVIL_ACTIVO quedó en true. Dos cosas que se habrían roto al prenderlo: lo público (el comprador que vuelve de pagar en /pagar/…/listo) se tapaba con «Esta pantalla se usa en la computadora», y el admin global sin cliente entraba en un bucle /customer-success → /m/cs → /inicio. Las dos quedaron cerradas y con test.',
      'Un link de escritorio abre la MISMA cosa en el teléfono cuando el id es el mismo en los dos lados: el plan de un video (/video-generator?plan=…) y una landing (/landing-generator/<id>); /comercial abre la pestaña Comercial del Dashboard.',
      'Lo que el prototipo dibuja y el repo no puede hacer de verdad no se inventó: filmar de nuevo una toma (gasta créditos), editar una sección de la landing (sería un segundo editor), «Hoy» en Ads Manager (la pauta llega hasta ayer), «Probar en mi WhatsApp» y «Conclusiones con MaKo».',
      'Falta verlo en un navegador y en un teléfono real: la máquina no tuvo RAM para un next dev en toda la corrida. El typecheck y los tests puntuales están en verde.',
    ],
    archivos: ['app/m/', 'lib/movil-desvio.ts', 'lib/movil-rutas.ts', 'app/layout.tsx', 'docs/diseno-mako-mobile-v2.md', 'docs/hallazgos-mobile.md', 'docs/relevo/mako-mobile.md'],
  },
  {
    fecha: '12 oct', hora: '09:26', chat: CH, cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'Las mismas rutas que la computadora',
    pedido: 'de igual manera esta mal porque se ve muy chiquito todo, no como una app de celular... Y sobre todo lo que esta mal es que funcione por rutas, eso no debe ser así... Las rutas deben ser las mismas, solo debe detectar si estoy en mobile',
    puntos: [
      'Lo «muy chiquito» de sus capturas era Chrome en «Sitio para computadoras»: la página a ~980 px y un UA de escritorio.',
      'También dijo «hay cosas que no funcionan, como el CRM», sin detalle. Se frenó al 90% semanal de la cuenta 3, sin arrancar.',
    ],
  },
  {
    fecha: '14 oct', hora: '02:21', chat: CH, cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'Las mismas rutas, el CRM que abría vacío y el script del tema roto por el minificador',
    puntos: [
      'El teléfono abre /crm, /general, /plan… y el proxy le sirve /m en esa URL (rewrite); una URL /m vieja redirige a la de escritorio, y conWs traduce todo link de /m. Las pantallas sólo del teléfono: /mas, /configurar, /perfil/instalar y /crm/<id>/chat.',
      'El CRM, medido en producción (ws9, sólo leyendo): abría «Nada pendiente por hoy.» con 13 leads. Sin nada pendiente, ahora muestra las etapas con su conteo.',
      'Un SyntaxError en cada página de /m: el minificador del build se comía parte del script del tema. Un solo template literal, y un guard que lo pasa por el mismo SWC.',
      'No se miró en un navegador ni corrió el typecheck: la máquina estuvo sin RAM toda la sesión. Los tests de lo tocado, en verde.',
    ],
    commits: [{ sha: '7b82bcde', msg: 'MaKo Mobile: las mismas rutas que la computadora, el CRM que abría vacío y el script del tema que rompía el minificador', lineas: 1085, archivos: 33 }],
    archivos: ['proxy.ts', 'lib/movil-rutas.ts', 'lib/movil-desvio.ts', 'lib/ws-tab.ts', 'app/_components/VistaMovil.tsx', 'app/m/crm/ListaCrm.tsx', 'app/m/_ui/tema.ts', 'tests/movil-mismas-rutas.test.ts', 'tests/minificador-templates.test.ts'],
  },
  {
    fecha: '15 oct', hora: '06:16', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'Las tarjetas se arrastran con el dedo (como Trello) y el iPad toca a 44 px',
    puntos: [
      'Las seis decisiones de MaKo Mobile y del iPad que esperaban en la Ticketera se resolvieron por criterio («Usa criterio hay cosas muy obvias»): cuatro ya estaban hechas (el CRM abre en el Tablero, una columna por pantalla con la siguiente asomando, el iPad con la computadora adaptada).',
      'Mover una tarjeta se copió de Trello: mantenerla la levanta, arrastrarla la lleva a otra columna (en el borde pasa a la de al lado) y soltarla sin moverla abre «Mover a…». Vale para el CRM, Clientes y el Plan.',
      'Una pantalla táctil de cualquier ancho (un iPad acostado) sube a 44 px de toque y a campos de 16 px; antes quedaba con la escala del mouse y iOS hacía zoom al enfocar.',
      'Probado con toques reales en Chrome sobre el componente real. Falta un iPhone y un iPad de verdad.',
    ],
    commits: [{ sha: '58b19028', msg: 'MaKo Mobile: las tarjetas se arrastran con el dedo (como Trello) y el iPad toca a 44 px', lineas: 243, archivos: 5 }],
    archivos: ['app/m/_ui/KanbanM.tsx', 'app/m/_ui/PantallaM.tsx', 'app/m/m.css', 'app/globals.css', 'tests/movil-shell.test.ts'],
  },
  {
    fecha: '15 oct', hora: '13:12', chat: CH, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Refrescar en todos lados',
    pedido: 'En el centro y otras tabs no está la funcionalidad de refrescar, eso debe estar presente en tooodos lados en mobile',
    puntos: [
      'Llegó por el chat orquestador. Tiró varias veces en el Centro de Operaciones esperando ver algo nuevo, y no pasaba nada.',
    ],
  },
  {
    fecha: '15 oct', hora: '13:12', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'Tirar hacia abajo refresca en todas las pantallas',
    puntos: [
      'El gesto venía apagado por defecto: lo tenían las pantallas que existían cuando se escribió, y el Centro nació sin él. Ahora viene prendido, y un test recorre las páginas del teléfono y falla si una nueva sale sin él.',
      'Siete pantallas no lo tenían en absoluto (el Centro, la Ticketera, Video, el detalle de un video y de una landing, Configurar), y cinco que sí lo tenían lo perdían justo en el vacío o en el error.',
      'En el mazo de la Ticketera refrescar animaba y no traía nada: ahora suma al final lo nuevo, sin rearmar el mazo.',
      'Falta probarlo en un teléfono de verdad.',
    ],
    commits: [{ sha: '97b2e56d', msg: 'MaKo Mobile: tirar hacia abajo refresca en TODAS las pantallas (venía apagado por defecto)', lineas: 380, archivos: 29 }],
    archivos: ['app/m/_ui/PantallaM.tsx', 'app/tickets/decisiones/Mazo.tsx', 'app/tickets/decisiones/reglas.ts', 'tests/movil-refrescar.test.ts'],
  },
  {
    fecha: '15 oct', hora: '21:54', chat: CH, sesion: 'local_38c56f56-c724-42ba-92ff-9679cfdeedf5', cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: 'More completo, tanda 1 de 3: el mapa de las 14 secciones, Calendario, Avisos y Tu cuenta (sin commit todavía: la hora es la de la integración)',
    puntos: [
      'Pedido de Martín del 14/10: «Implementá TODAS las tabs que construimos, todo», con la regla del v3: «en el celular todo se ve SIMILAR al escritorio, pero con menos texto y menos cosas».',
      'More pasa de 7 a 14 secciones, en el orden de la sidebar. Cada ruta de escritorio de las nuevas abre su pantalla en el teléfono y conserva lo que su página lee de la URL: un push que vuelve a la computadora no pierde la pestaña.',
      'Calendario, copiado de la app de Google Calendar: Día y Agenda (las vistas de escritorio que entran en un teléfono), crear un evento con el «+», marcar hecho y borrar con Deshacer. Lee con la misma función que escritorio, y lo que comparten se mudó a un módulo de los dos.',
      'La campana de General se llama Avisos, como en el v3, y sus botones dicen lo mismo que en escritorio («Confirmar y ejecutar», «Descartar propuesta»); un test los cruza contra el código de escritorio.',
      'Tu cuenta, copiada de la cuenta de Google: las secciones de la computadora en su orden, el modo oscuro y los avisos de este teléfono. Refrescar ahora trae lo nuevo y la fila de instalar no desaparece en Android.',
      'El mapa no sale solo: un test falla mientras falten las seis pantallas de las tandas 2 y 3, porque con el desvío prendido una sección sin página es un 404 en todo teléfono. Nada se miró en un navegador ni en un teléfono.',
    ],
    archivos: ['lib/movil-rutas.ts', 'app/m/calendario/', 'app/calendario/comun.ts', 'app/m/inbox/inbox-ui.ts', 'app/m/cuenta/CuentaM.tsx', 'tests/movil-mas-secciones.test.ts', 'tests/m-calendario.test.ts', 'tests/m-avisos.test.ts', 'tests/m-cuenta.test.ts', 'docs/hallazgos-mobile.md'],
  },
  {
    fecha: '16 oct', hora: '02:10', chat: CH, sesion: 'local_38c56f56-c724-42ba-92ff-9679cfdeedf5', cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: 'More completo, tanda 2 de 3: Second Brain, Experiments y Offer en el teléfono (sin commit todavía: la hora es la de la integración)',
    puntos: [
      'Second Brain, copiado de Obsidian y Notion en el teléfono: buscar (también con MaKo), el mapa en chico, «Tu negocio» con sus cinco carpetas, cada área y cada dato en una hoja, y subirle al Archivero archivos, fotos de la cámara o una web. Editar las áreas, el mapa interactivo y Exportar quedan en la computadora.',
      'Experiments con sus cuatro vistas de escritorio en el mismo orden (Retro · Experiments · Conclusions · Análisis): decidir el plan de una Retro como el Triage de Linear, la tarjeta de cada experimento como la de un ticker de la app de Bolsa, el alta con MaKo y el Análisis con sus tres rangos. Generar una Retro nueva sigue en la computadora.',
      'Offer, como la app de ChatGPT: el chat entero (texto, links, documentos y nota de voz), armar la oferta y bajar cada versión del PDF, guardarla en el funnel y «Probarlo», que lleva a Experiments.',
      'Lo que las tres comparten con escritorio salió de los componentes de la computadora a módulos de los dos (el conteo y el color del mapa, la subida al Archivero, el formato de los números, los grupos de piezas), y escritorio ya los usa: no quedó ninguna copia escrita dos veces salvo la orquestación del chat de Offer, que está anotada.',
      'Copiando Offer apareció un bug de la computadora: la nota de voz que sí se mandaba se borraba y dejaba de sonar. Arreglado en los dos lados, con su test.',
      'Nada se miró en un navegador ni en un teléfono. Falta la tanda 3 (Copywriting, Curso y Comunidad): sin ellas el mapa no se puede subir.',
    ],
    archivos: ['app/m/second-brain/', 'app/m/experimentos/', 'app/m/offer/', 'lib/cerebro-areas.ts', 'lib/archivero-subida.ts', 'lib/experimentos-formato.ts', 'app/offer/ayudas.ts', 'app/offer/OfferApp.tsx', 'tests/m-second-brain.test.ts', 'tests/m-experimentos.test.ts', 'tests/m-offer.test.ts', 'docs/hallazgos-mobile.md'],
  },
  {
    fecha: '16 oct', hora: '04:40', chat: CH, sesion: 'local_38c56f56-c724-42ba-92ff-9679cfdeedf5', cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: 'More completo, tanda 3 de 3: Ads Writer, Curso y Comunidad en el teléfono (sin commit todavía: la hora es la de la integración)',
    puntos: [
      'Con esta tanda las 14 secciones de More tienen su pantalla, y el mapa ya se puede subir: con el teléfono prendido para todos, una sección sin pantalla habría sido una página rota.',
      'Ads Writer con sus tres vistas de escritorio en el mismo orden (Anuncios · Guiones · Analizar guion): «Escribir el próximo guion» fijo abajo, en la misma celda que elige la computadora; copiar un guion, leerlo como un teleprompter, y valorar uno escrito o dictado. No hay un campo libre para pedir el copy, porque escritorio lo prohíbe a pedido de Martín: el dictado fue al guion a valorar.',
      'Curso, copiado del Classroom de Skool: el curso elegido, sus módulos y clases en el orden de escritorio, poner una clase en Público o Privado con Deshacer, y su avance entre los alumnos. El avance va por clase y no como tabla, porque Martín sacó esa vista del Curso el 07/10.',
      'Comunidad, copiada de la app de Skool: leer el feed, dar like, comentar y responder, votar una encuesta, publicar un post de texto, buscar, y ver Miembros y el Ranking. Calendario, About y la moderación quedan en la computadora.',
      'Lo que las tres reusan de escritorio salió de los componentes de la computadora a módulos de los dos (el próximo guion y la cobertura, el orden de la galería, el parser del gancho, los íconos de la comunidad), y escritorio ya los usa.',
      'Para que decida Martín: la Comunidad la muestra la barra sólo al admin, pero su página y sus acciones dejan entrar a cualquier rol del equipo. El teléfono quedó como la barra. Nada se miró en un navegador ni en un teléfono.',
    ],
    archivos: ['app/m/copywriting/', 'app/m/curso/', 'app/m/comunidad/', 'app/ads-writer/reglas.ts', 'lib/guion-secciones.ts', 'app/ads-writer/analizar.ts', 'app/_comunidad/iconos.tsx', 'tests/m-copywriting.test.ts', 'tests/m-curso.test.ts', 'tests/m-comunidad.test.ts', 'tests/layout-sin-suspense.test.ts', 'docs/hallazgos-mobile.md', 'docs/hallazgos-seguridad.md'],
  },
];
