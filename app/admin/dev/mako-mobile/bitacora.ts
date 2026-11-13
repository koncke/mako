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
  { titulo: 'MaKo sin conexión en la computadora', detalle: 'La misma PWA: sin red o con MaKo caído se ve lo guardado (T1, leer el CRM y el Plan); escribir y subir al volver es la T2; el teléfono, la T3', estado: 'sigue' },
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
  {
    fecha: '16 oct', hora: '11:04', chat: CH, sesion: 'local_38c56f56-c724-42ba-92ff-9679cfdeedf5', cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: 'Offer en el teléfono: las otras ofertas se marcan varias, como en la computadora',
    puntos: [
      'Offer ahora pregunta qué otras ofertas tiene el negocio y deja marcar varias. En el teléfono cada toque mandaba una sola, así que «tengo un curso y una mentoría» no se podía contestar.',
      'Ahora es igual que la computadora: cada oferta se marca y se desmarca, «Puedes marcar varias» arriba, y «Enviar (N)» las manda juntas como una respuesta. «No, sólo ésta» y «Armar mi oferta» siguen saliendo con un toque.',
      'Lo fija un test, probado rompiéndolo de ocho formas. Nada se miró en un teléfono.',
    ],
    archivos: ['app/m/offer/modelo.ts', 'app/m/offer/HiloOfferM.tsx', 'app/m/offer/OfferM.tsx', 'app/m/offer/offer.css', 'tests/m-offer.test.ts', 'docs/hallazgos-mobile.md'],
  },
  {
    fecha: '20 oct', hora: '19:36', chat: 'Sidebar', sesion: "local_789aebfb-8196-468e-96d2-1f4964c12a1c", cuenta: 'claude4', actor: 'martin', tipo: 'prompt',
    titulo: 'MaKo Mobile se veía como el escritorio',
    pedido: 'Veo MaKo mobile roto, como si estuviera en desktop, solucionalo',
    puntos: ['Llegó por el Ops Center, con una captura de su Android: la barra de escritorio y Configuración del negocio › General.'],
  },
  {
    fecha: '20 oct', hora: '21:30', chat: 'Sidebar', sesion: "local_789aebfb-8196-468e-96d2-1f4964c12a1c", cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'Hecho: «Abrir en la computadora» abre sólo esa pantalla, y siempre hay «Volver al teléfono»',
    pedido: 'Veo MaKo mobile roto, como si estuviera en desktop, solucionalo',
    puntos: [
      'La causa: tocar una fila «En la computadora» (General) dejaba toda la app en la versión de computadora 12 horas, sin vuelta.',
      'Ahora abre sólo esa pantalla; cualquier otra vuelve al teléfono.',
      'En el teléfono, la versión de computadora muestra abajo «Volver al teléfono».',
      'Sin probar en su Android ni en ningún teléfono: lo fijan los tests. General (Horario y Criterio) todavía no tiene pantalla en el teléfono.',
    ],
    archivos: ['lib/movil-dispositivo.ts', 'proxy.ts', 'lib/movil-guard.ts', 'app/_components/VueltaAlTelefono.tsx', 'app/m/_ui/EnComputadoraM.tsx', 'tests/movil-vuelta-telefono.test.ts'],
    revisar: '/configuraciones',
  },
  {
    fecha: '24 oct', hora: '22:23', chat: 'Automations', sesion: "local_f1f2610a-6994-4bbf-8ad4-dff49fe09b49", cuenta: 'claude5', actor: 'martin', tipo: 'prompt',
    titulo: 'Un solo Dashboard en el teléfono',
    pedido: '«En mobile aparecen 2 dashboards...»',
    puntos: [
      'Llegó firmado por el Ops Center (trabajo 49ff20a3) con la captura de More › Today: «Dashboard» y «Dashboard sheets».',
    ],
  },
  {
    fecha: '24 oct', hora: '22:40', chat: 'Automations', sesion: "local_f1f2610a-6994-4bbf-8ad4-dff49fe09b49", cuenta: 'claude5', actor: 'claude', tipo: 'correccion',
    titulo: 'More tiene un solo «Dashboard»',
    puntos: [
      'Si ves General, «Dashboard» abre Focus con todas tus hojas arriba, como en la computadora.',
      'El closer y el setter ven como Dashboard su hoja, también como en la computadora.',
      '«Dashboard sheets» ya no aparece: repetía lo que el Dashboard ya mostraba.',
    ],
    archivos: ['lib/movil-rutas.ts — masCompleto: una fila de Dashboard por rol', 'tests/sidebar-nueva.test.ts — probado rompiéndolo'],
    revisar: '/m/mas',
  },
  {
    fecha: '25 oct', hora: '00:39', chat: 'Landings', sesion: 'local_4b99db4c-3ebd-4559-a580-0abe37310f9b', cuenta: 'claude5',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Las pantallas que te mandan a otra parte ya no pueden romperse al abrirlas',
    puntos: [
      'Cuando una pantalla te tiene que mandar a otro lado (porque falta terminar el arranque, porque no está en tu plan o porque no iniciaste sesión), a veces se rompía con un error en vez de llevarte. Es el mismo error de la pantalla rota del Web Generator.',
      'Ahora ese salto pasa antes de que aparezca el «cargando», así que ya no choca. Quedó en 25 secciones: casi todas las del teléfono (CRM, Chats, Calendario, Automations, Plan, Hoy y las demás), y en la computadora Ads Writer, Automations, Calendario, Chats, Offer, Image Editor, Video Editor, Plan, Second Brain, Dashboard y el Web Generator.',
      'Quedó un control que revisa toda la app: si una pantalla nueva vuelve a saltar adentro del «cargando», se avisa antes de salir.',
      'Faltan tres, anotadas: el Ops Center y, en el teléfono, la lista de Chats y Second Brain.',
    ],
    archivos: [
      'tests/redirige-antes-del-loader.test.ts — el control que revisa toda la app',
      'docs/hallazgos-infra.md — por qué eran 25 y no 6, y las que faltan',
    ],
    revisar: '/m/hoy',
  },
  {
    fecha: '29 oct', hora: '11:35', chat: 'CRM y Chats', sesion: 'local_50d3b679-7aa4-4438-a315-993bea9b1e1a', cuenta: 'claude3',
    actor: 'claude', tipo: 'correccion',
    titulo: 'En el teléfono, elegir otro funnel en el CRM ya cambia el tablero',
    puntos: [
      'Ticket #27: en el CRM del celular, tocar otro funnel en la lista (por ejemplo «Venta Props») cerraba la lista y no cambiaba nada. Pasaba siempre.',
      'La lista se cerraba y en el mismo toque pedía el otro funnel, y el cierre pisaba el pedido. Ahora el pedido sale después de cerrar.',
      'El mismo arreglo vale para cuatro lugares que fallaban igual: «Abrir ficha» desde «Ver info», abrir la ficha de un lead recién creado, el «Lead» de una decisión en la Bandeja y, en el Calendario, ir a la semana de un evento recién guardado.',
    ],
    archivos: [
      'app/m/_ui/hoja-historial.ts — navegarAlCerrar: la navegación espera a que la hoja suelte su URL',
      'app/m/crm/TableroCrm.tsx · app/m/inbox/InboxM.tsx · app/m/calendario/CalendarioM.tsx — los lugares que cerraban y navegaban',
      'tests/m-hoja-navegar-al-cerrar.test.ts — el toque en «Venta Props», probado rompiéndolo',
    ],
    revisar: '/m/crm',
    tickets: [27],
  },
  {
    fecha: '3 nov', hora: '19:30', chat: 'Bot y avisos', sesion: 'local_0fabc2d4-f10f-4a2d-b0ef-70cec8e878a7', cuenta: 'claude5',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Los avisos del teléfono: paso obligatorio del onboarding',
    puntos: [
      'El onboarding no termina sin el teléfono con los avisos activados. En la computadora muestra un QR y sigue solo cuando el teléfono los activó.',
      'Si ya los tenías activados, el paso no aparece. Quien ya terminó el onboarding lo ve en General hasta activarlos.',
      'Los reportes también suenan en el teléfono: no pasaban por el motor de avisos.',
      '**Cómo se prueba:** entra al negocio de prueba desde la computadora, llega al final del onboarding, escanea el QR y toca «Activar avisos» en el teléfono.',
    ],
    archivos: [
      'app/onboarding/TarjetaAvisos.tsx — lo que pide según el dispositivo',
      'lib/avisos-telefono.ts y lib/avisos-telefono-reglas.ts — qué cuenta como «tiene los avisos»',
      'tests/onboarding-avisos.test.ts',
    ],
  },
  {
    fecha: '3 nov', hora: '20:00', chat: 'Cerebro', sesion: 'local_3f1a66d3-690f-4ebc-bd98-7dcf1cf14bb8', cuenta: 'claude5',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Un solo link para instalar la app, según el dispositivo',
    pedido: 'que instalen la app y que sea ese link o que les lleve a la apple store dependiendo su dispositivo... Tipo un QR o algo así',
    puntos: ['Lo relevó el Cerebro. Va en el paso de los avisos del onboarding.'],
  },
  {
    fecha: '3 nov', hora: '20:30', chat: 'Bot y avisos', sesion: 'local_0fabc2d4-f10f-4a2d-b0ef-70cec8e878a7', cuenta: 'claude5',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El link /app: la tienda de cada teléfono, y el QR en la computadora',
    puntos: [
      'Un iPhone va a la App Store, un Android a Play Store y una computadora ve el QR.',
      'Mientras una tienda no tenga la app, ese teléfono ve la guía para agregarla a la pantalla de inicio.',
      'Prender una tienda es cambiar un solo valor: `publicada`, en lib/app-tiendas.ts.',
      '**Cómo se prueba:** abre hola-mako.com/app en el teléfono y en la computadora.',
    ],
    archivos: ['lib/app-tiendas.ts — las dos tiendas y a dónde va cada dispositivo', 'app/app/page.tsx y app/app/GuiaApp.tsx — el link', 'tests/link-app.test.ts'],
    revisar: '/app',
  },
  {
    fecha: '4 nov', hora: '04:00', chat: 'Tickets 04/11', sesion: 'local_3f1a66d3-690f-4ebc-bd98-7dcf1cf14bb8', cuenta: 'claude5',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Con una imagen adjunta se puede grabar un audio, y el campo de Chats en el teléfono queda pegado al teclado',
    puntos: [
      '**Una imagen adjunta ya no te saca el micrófono:** con lo adjuntado y nada escrito van los dos botones. Lo que dices sale como el texto de ese mensaje, junto con la imagen, para que MaKo los lea juntos. Vale en todas las cajas de chat.',
      '**El campo de un chat en el iPhone:** con el teclado abierto queda pegado a él, sin el hueco de abajo, y ya no se ve pasar el hilo por debajo. El anillo negro alrededor del campo pasa a ser un borde, como en el chat con MaKo.',
    ],
    archivos: [
      'app/_chat/CajaChat.tsx — la sesión de la nota que sale con lo adjuntado · app/admin/operaciones/Microfono.tsx — `BotonGrabar` · lib/centro-caja.ts — `micAlLadoDeLaFlecha`',
      'app/m/chats/[clave]/ComposerChatsM.tsx · app/m/chats/chats.css · app/m/mako/chat-ui.ts — `tecladoDelComposer`',
      'tests/caja-nota-con-adjuntos.test.ts · tests/_caja-adjuntos-hijo.ts',
    ],
    revisar: '/m/chats',
    tickets: [51],
  },
  {
    fecha: '28 oct', hora: '14:10', chat: 'Web Generator: replicar landings', sesion: 'local_1dd40ee7-c2c9-403e-8b3d-ad1dd87b505c', cuenta: 'claude4',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Que la app de escritorio funcione sin conexión',
    pedido: 'revisa las implementaciones que salieron con la llamada de Teo, por ejemplo lo de que el servidor se caiga y que la app desktop funcione offline y luego cuando se vuelva a tener conexión se carguen las cosas',
    puntos: [
      'En la llamada de venta le dijo a Teo «si se llega a caer tenés tu aplicación de desktop, que eso funciona siempre». Hasta hoy, sin servidor no andaba nada.',
      'Llegó por el Cerebro, con el pedido de diseñar primero y repartir en tres tandas: leer, la cola y el resto.',
    ],
  },
  {
    fecha: '28 oct', hora: '15:30', chat: 'Web Generator: replicar landings', sesion: 'local_1dd40ee7-c2c9-403e-8b3d-ad1dd87b505c', cuenta: 'claude4',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El CRM y el Plan se ven aunque se corte internet o MaKo no responda',
    puntos: [
      'En Settings › Instalar la app hay una fila nueva, «Sin conexión»: elegís una clave para esta computadora y MaKo guarda una copia del CRM y del Plan cada 10 minutos.',
      'Si se corta internet o MaKo no responde, la misma dirección abre lo guardado con una cinta arriba: «Sin conexión · lo que ves es lo de las 10:42». Entrás con tu email y esa clave.',
      'Ves el tablero de cada funnel, la ficha de cada lead con sus últimas notas, y el Plan con Prioridades, Tareas, Proyectos y Recurrentes. Por ahora es para leer: escribir y que se suba al volver es la tanda 2.',
      'Lo guardado va cifrado, por persona: otra cuenta en la misma computadora no lo abre ni se entera de que existe. Mirando la cuenta de un cliente no se guarda nada.',
      'Es la app web de siempre, no un programa nuevo que haya que instalar o firmar.',
    ],
    archivos: [
      'docs/diseno-mako-desktop-sin-conexion.md — el diseño entero: por qué la PWA y no Electron, Tauri ni mako-pc, y las tres tandas',
      'public/sw.js — sin red devuelve el cascarón; nunca guarda una respuesta del servidor',
      'public/sin-conexion/ — el cascarón (su JS sale de lib/sin-conexion/cascaron.ts)',
      'lib/sin-conexion/ — el cifrado, la base por persona y la lógica de guardar y abrir',
      'app/api/sin-conexion/ — la llave de la persona y la copia, con las lecturas del teléfono',
      'tests/sin-conexion.test.ts — probado rompiéndolo (27 roturas)',
    ],
    revisar: '/perfil/instalar',
  },
  {
    fecha: '28 oct', hora: '18:30', chat: 'Web Generator: replicar landings', sesion: 'local_1dd40ee7-c2c9-403e-8b3d-ad1dd87b505c', cuenta: 'claude4',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Sin conexión también se escribe, y al volver se sube con tu OK',
    puntos: [
      'Sin internet o con MaKo caído, en lo guardado ya se puede escribir una nota en un lead, moverlo de etapa, cambiarle el nombre, el email o la empresa, mover una tarea de columna y crear una tarea nueva.',
      'Lo escrito queda guardado y cifrado en la computadora, marcado «Se sube al volver», aunque cierres la ventana.',
      'Al volver la conexión no se sube nada solo: aparece «Tienes 3 cambios hechos sin conexión» y los subes cuando lo decides, en orden.',
      'Si un cambio arranca una automatización que le escribe al lead, espera tu OK aparte. Si otra persona cambió lo mismo mientras tanto, MaKo te lo muestra y eliges: aplicar el tuyo o dejar el de ahora.',
      'Una tarea nueva escrita sin conexión llega como borrador, para que la confirmes en el Plan.',
    ],
    archivos: [
      'lib/sin-conexion/cola.ts — qué se escribe sin red, la decisión campo por campo y cómo se ve lo pendiente',
      'lib/sin-conexion/subir.ts — subir un cambio: idempotencia, conflictos, «Espera tu OK»',
      'app/_sin-conexion/acciones.ts — la subida, por las mismas puertas que el teléfono',
      'app/_components/SubirCambios.tsx — el panel que sube con tu OK',
      'supabase/migrations/0346_sin_conexion_aplicadas.sql — lo ya subido, para no aplicarlo dos veces',
      'tests/sin-conexion-cola.test.ts — probado rompiéndolo',
    ],
    revisar: '/perfil/instalar',
  },
  {
    fecha: '4 nov', hora: '04:22', chat: 'Grabar', sesion: 'cli_6ff1501b-e5d8-58be-a2dd-2546d599dfd6', cuenta: 'nube',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Grabar llamadas, la plantilla Cold Calling y el Dashboard en la barra del teléfono',
    pedido: 'quiero que implementes el botón de "grabar" en el detail de un lead y en un dashboard template que sea "Call Calling", en mobile, en lugar de "Plan" en la bottom bar, pon "Dashboard".',
    puntos: ['Llegó por el Cerebro a un chat de la nube. Tres pedazos, cada uno en su punta: la barra, el botón de grabar y la plantilla.'],
  },
  {
    fecha: '4 nov', hora: '04:22', chat: 'Grabar', sesion: 'cli_6ff1501b-e5d8-58be-a2dd-2546d599dfd6', cuenta: 'nube',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La barra del teléfono: Dashboard en el lugar de Plan',
    puntos: [
      'La barra es CRM · Chats · Ops Center · Dashboard · More. Plan quedó primero en More, en Today, como en la sidebar.',
      'Dashboard abre el de cada uno: la portada con Focus y las hojas a quien ve General, y su hoja (Closing, Chat Analyst) al closer y al setter.',
      'El número de lo que espera una decisión volvió al Dashboard; More ya no lo repite.',
      '**Cómo se prueba:** abre MaKo en el teléfono; abajo, el cuarto lugar dice Dashboard y Plan está en More.',
    ],
    archivos: ['lib/movil-rutas.ts — `destinoDashboard` y la barra', 'app/m/_ui/cabecera.ts y app/m/badges.ts', 'tests/movil-rutas.test.ts, tests/sidebar-nueva.test.ts'],
    revisar: '/general',
  },
  {
    fecha: '4 nov', hora: '05:40', chat: 'Tiendas: Partners fuera del teléfono', sesion: 'cli_d2b72179-90a8-55cc-b44f-a49a80e160ba', cuenta: 'nube',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'MaKo Partners y Agency Dashboard ya no están en ningún teléfono',
    puntos: [
      'En Android, como ya pasaba en la app de iPhone, More no muestra MaKo Partners ni Agency Dashboard.',
      'Un link a /partners o /agency abierto en el teléfono (un aviso, un mail) lleva a More. En la computadora no cambia nada.',
      'Por qué: en la clasificación de edad de Google Play se contestó que la app no da premios en dinero, y Partners decía «Ya cobraste». Agency decía «Falta pagar».',
      'Entrar a la cuenta de un cliente de la agencia queda en la computadora.',
      '**Cómo se prueba:** abre More en un Android; en el menú ya no están las dos.',
    ],
    archivos: [
      'lib/tienda.ts — `TABS_QUE_VENDEN` vale para todos los teléfonos (`esTabQueVende`, `sinLoQueVende`)',
      'lib/movil-rutas.ts — `masCompleto` las saca de More',
      'app/m/partners/page.tsx y app/m/agency/page.tsx — vuelven a More antes de leer nada',
      'tests/tiendas-telefono-no-vende.test.ts (9 y 9b), tests/movil-toda-tab.test.ts, tests/sidebar-nueva.test.ts — probado rompiéndolo',
    ],
    revisar: '/mas',
  },
  {
    fecha: '4 nov', hora: '08:23', chat: 'Tiendas: privacidad', sesion: 'cli_d2b72179-90a8-55cc-b44f-a49a80e160ba', cuenta: 'nube',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El responsable legal de las páginas para las tiendas',
    pedido: 'Si, el responsable legal es Leandro',
    puntos: ['Contestó la pregunta del plan de las tiendas: qué responsable dicen /privacidad y /terminos, si la cuenta de Play es suya y la de Apple de Leandro.'],
  },
  {
    fecha: '4 nov', hora: '08:23', chat: 'Tiendas: privacidad', sesion: 'cli_d2b72179-90a8-55cc-b44f-a49a80e160ba', cuenta: 'nube',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Las páginas legales dicen quién publica la app en cada tienda',
    puntos: [
      'Privacidad y Términos siguen nombrando a Leandro como responsable, y suman una línea: en la App Store publica ese mismo nombre, en Google Play Martín Carballo Koncke.',
      'Las fichas de Play quedan con el título y la descripción corta nuevos, y el token de avisos declarado en Data safety.',
      '**Cómo se prueba:** abre hola-mako.com/privacidad y hola-mako.com/terminos, y lee el final de cada una.',
    ],
    commits: [{ sha: '8cffbbf2', msg: 'Las páginas legales dicen quién publica la app en cada tienda', lineas: 112, archivos: 6 }],
    archivos: [
      'lib/titular-mako.ts — `PUBLICA_EN_PLAY`, al lado de la razón social',
      'app/privacidad/page.tsx y app/terminos/page.tsx — la línea de quién publica',
      'docs/tiendas-fichas-borradores.md y docs/tiendas-play-appstore.md — la ficha de Play y la decisión',
      'tests/tiendas-quien-publica.test.ts — las dos páginas sin JavaScript, probado rompiéndolo',
    ],
    revisar: '/privacidad',
  },
  {
    fecha: '13 nov', hora: '22:30', chat: 'Tickets Sellers', sesion: 'local_6215cd34-1e87-41f1-83cd-3a8627b1f683', cuenta: 'claude5',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El Agency Dashboard vuelve al teléfono: ves a tus clientes y entras a cada uno',
    puntos: [
      'Joan (Código Inmobiliario) no encontraba a sus clientes en el teléfono: sólo con «versión computadora».',
      'Ahora, si tu negocio es una agencia, More trae «Agency Dashboard»: tus clientes, en qué estado está cada uno, y entrar a su cuenta.',
      'Como el teléfono no vende, no dice lo que falta pagar ni quién paga: una cuenta que espera un pago dice «Por habilitar». Sumar un cliente y cambiar su plan siguen en la computadora.',
    ],
    archivos: [
      'app/m/agency/AgencyM.tsx · app/m/agency/page.tsx · app/m/agency/agency.css — la cartera sin plata, la hoja entera',
      'lib/tienda.ts · app/m/mas/page.tsx — Agency sale de lo que vende; More la muestra sólo a una agencia',
      'tests/agency-telefono-94.test.ts · tests/tiendas-telefono-no-vende.test.ts',
      'docs/hallazgos-mobile.md · AGENTS.md («El teléfono no vende»)',
    ],
    revisar: '/m/agency',
    tickets: [94],
  },
];
