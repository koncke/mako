// =============================================================================
// Calendario — el registro de construcción de la tab
// =============================================================================
// La tab nace el 13/10/2026. Su código vive en `app/calendario/`, `lib/calendario*.ts`, la mig 0271 y el área
// `calendario` de la API de MaKo. Lo que costó, en docs/hallazgos-calendario.md.
//
// ESTO NO ES UN CHANGELOG. Va lo que git no guarda: qué pidió Martín con sus palabras y por qué se resolvió así.
// Las horas de los hitos de implementación son las del trabajo (el commit va al lado cuando existe); la del pedido,
// la del mensaje.
//
// Se agrega AL FINAL del array (orden cronológico). La pantalla lo lee al revés.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'La tab y sus capas', detalle: 'Publicaciones · Llamadas (CRM + Google) · Bloques · Plan · Se repite · Cobros · Objetivos y el Q', estado: 'hecha' },
  { titulo: 'Plantillas de semana', detalle: 'Seis semanas tipo en «Crear» · «¿Qué vas a crear hoy?» se fue el 14/10', estado: 'hecha' },
  { titulo: 'La API de MaKo', detalle: 'listar_eventos_calendario · crear_evento_calendario · crear_evento_google · link_agenda_llamada · ver_proximas_recurrentes', estado: 'hecha' },
  { titulo: 'Conectar sin salir de la tab', detalle: 'El modal de Integraciones salta al entrar sin Google · la regla en todas las tabs', estado: 'hecha' },
  { titulo: 'Agendar llamadas', detalle: 'Calendly (su popup) o Cal.com (sin medir) · la reserva entra por el webhook', estado: 'hecha' },
  { titulo: 'Publicaciones en redes', detalle: 'Programar en Instagram, TikTok y YouTube por Zernio · espera la decisión de Martín', estado: 'cola' },
  { titulo: 'La entrega de servicio y la comunidad', detalle: 'Sesiones de CS agendadas · eventos en vivo del curso', estado: 'cola' },
  { titulo: 'La copia fiel de Google Calendar', detalle: 'Seis vistas · todos los calendarios de Google · crear, mover y borrar en Google · arrastrar', estado: 'hecha' },
  { titulo: 'Las tareas de Google', detalle: 'Piden el permiso tasks.readonly: después de la aprobación de la verificación', estado: 'cola' },
  { titulo: 'Roles y móvil', detalle: 'Un closer viendo sus llamadas · el Calendario en /m', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '13 oct', hora: '—', chat: 'General', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El Calendario, en su propia tab',
    pedido: 'Quiero implementar el CALENDARIO de contenidos... Aunque debería ser más que un calendario de contenidos, para mi debería ser "CALENDARIO" y listo... Porque puede utilizarse para planificar publicaciones de Stories, Reels, Ads... Se puede utilizar para organizar llamadas de ventas, de entrega de servicio... Se pueden poner "bloques de trabajo" para crear guiones o lo que necesite el usuario... Se puede combinar con lo que queremos implementar de "OBJETIVOS", el Q, el PLAN... Nos falta una vista de calendario. Y como siempre, que sea simple de usar, que sirva para todos los casos, que tenga IA que te ayude o "templates" y que no sea restrictivo... Como todo lo que estamso creando. — Y el 13/10: Dale, arrancá con el Calendario, pero que sea en otra tab, no en GENERAL.',
    puntos: [
      'Punto 14 del feedback de Martín (mako-feedback-y-tareas.md), con los puntos 13 (calendario de Stories) y 15 (publicar en todos lados) cruzados. El «en otra tab, no en GENERAL» es la decisión que fija dónde vive.',
    ],
  },
  {
    fecha: '14 oct', hora: '—', chat: 'General', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La tab: lo propio se guarda, lo demás se lee de donde vive',
    puntos: [
      'Mig 0271 (`calendario_eventos`) para lo que se agenda en la tab y nada más. Las reuniones del CRM (con su hora, de `junta_*_at`), la agenda de Google (estricta, sin duplicar las de Calendly), los deadlines del Plan (`tableroDelPlan`, la misma lectura del teléfono) y el Quarter se leen en cada carga, en paralelo, y cada fuente que falla se dice en una línea.',
      'Seis plantillas de semana y «¿Qué vas a crear hoy?»: la IA (gratis, con la red de plataforma) ve el pedido y las fechas de la semana, NUNCA la agenda; propone, y la persona tilda lo que se agenda. El onboarding se hace usándola (el molde de Offer): «Tu primera semana» se cierra al agendar algo, y la agenda de Google, opcional y al final, cuando se lee bien.',
      'Declarada en la API de MaKo (área `calendario`: listar lo propio y proponer un evento con «sí»), sin tocar Google. En la barra, en Operate al lado del Plan; en las capas pm y superadmin. 16 tests, cada uno probado rompiendo la pieza que cuida (8 roturas, 8 fallos).',
    ],
    archivos: [
      'supabase/migrations/0271_calendario_eventos.sql', 'lib/calendario-modelo.ts', 'lib/calendario.ts', 'lib/calendario-ia.ts',
      'app/calendario/page.tsx', 'app/calendario/CalendarioApp.tsx', 'app/calendario/EventoModal.tsx', 'app/calendario/NuevoEnCalendario.tsx',
      'app/calendario/actions.ts', 'app/api/calendario/ia/route.ts', 'lib/api-mako/areas/calendario.def.ts', 'lib/api-mako/areas/calendario.run.ts',
      'tests/calendario.test.ts',
    ],
  },
  {
    fecha: '14 oct', hora: '03:05', chat: 'General', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Una copia fiel de Google Calendar',
    pedido: 'Por otro lado, el calendario quiero que sea una copia fiel a Google Calendar, y que refleje todas las tareas y eventos que se tienen en google calendar.',
    puntos: [
      'Preguntado el mismo día: las tareas de Google, después de la aprobación de la verificación de Google («Sólo eventos por ahora»); y lo que se crea, mueve o borra desde MaKo se escribe en Google («Sí, como Google»).',
    ],
  },
  {
    fecha: '14 oct', hora: '—', chat: 'General', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La tab es Google Calendar: seis vistas, todos los calendarios y escribir en Google',
    puntos: [
      'La pantalla copia la web de Google Calendar: la barra con «Hoy» y el título como lo escribe Google, «Crear», el mes chico, «Mis calendarios» (las capas de MaKo) y los calendarios de la cuenta de Google con su color, Día · Semana · Mes · Año · Agenda · 4 días con las teclas de Google, la tarjeta del evento, crear con un clic o un arrastre, y mover o estirar arrastrando.',
      'Se leen TODOS los calendarios de la cuenta (antes, sólo el principal). Lo de Google se crea, cambia, mueve y borra en Google (con «Deshacer» que devuelve el MISMO evento, y la pregunta de avisar a los invitados). La API de MaKo suma `crear_evento_google`, que escribe sin leer la agenda.',
    ],
    archivos: [
      'lib/calendario-google-modelo.ts', 'lib/calendario-google.ts', 'lib/google-calendar.ts', 'lib/calendario-modelo.ts', 'lib/calendario.ts',
      'app/calendario/CalendarioApp.tsx', 'app/calendario/VistaTiempo.tsx', 'app/calendario/VistasLista.tsx', 'app/calendario/Tarjetas.tsx',
      'app/calendario/MiniMes.tsx', 'app/calendario/comun.ts', 'app/calendario/gc-css.ts', 'app/calendario/actions.ts', 'app/calendario/page.tsx',
      'lib/api-mako/areas/calendario.def.ts', 'lib/api-mako/areas/calendario.run.ts', 'tests/calendario.test.ts', 'tests/agenda-sin-ia.test.ts',
    ],
  },
  {
    fecha: '14 oct', hora: '—', chat: 'Calendario', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Fuera «¿Qué vas a crear hoy?»; conectar sin salir de la tab; y que el Calendario tenga sentido con MaKo',
    pedido: 'Con respecto al calendario:\n1. No pongas "¿Que vamos a crar hoy?", eso no es necesario, eliminalo completamente. En su lugar, si una persona entra allí y no tiene el google calendar conectado, que salte el modal que tenemos en integraciones allí mismo para que lo pueda conectar. Esto significa también el botón de "Conectar" si no lo tiene conectado debería saltar el pop-up ahí. Esto como regla siempre, en todas las tabs, para una integración jamás se debe salir de la tab.\n2. Ahora debes agregarle cosas y funciones de MaKo para que tenga sentido... Como agregar el calendly o cal, para agendar llamadas, ver los deadlines de los proyectos y tareas, ver las tareas recurrentes allí, poder gestionar publicaciones de Instagram, TikTok, YouTube, etc... Piensa en las cosas que podríamos hacer con el calendario.',
    puntos: [
      'El punto 1 es una REGLA para todas las tabs, no sólo del Calendario: quedó en AGENTS.md («Para conectar una integración JAMÁS se sale de la tab») con su guard.',
    ],
  },
  {
    fecha: '14 oct', hora: '07:12', chat: 'Calendario', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El modal de Integraciones en cualquier tab, y el Calendario con lo que se repite, los cobros y agendar llamadas',
    puntos: [
      '«¿Qué vas a crear hoy?» se fue entero: la caja, el armado de la semana con IA, su ruta y su feature de modelos. Las plantillas quedan en «Crear › Plantilla de semana».',
      'La pieza para conectar sin salir de la tab ya existía (el modal suelto de /integraciones, del 12/10): le faltaban la vuelta del OAuth de Google a la tab de la que salió, el permiso real de la agenda y un portal en la pila de modales. Se montó en el Calendario (salta al entrar sin Google), Ads Manager, el CRM (Calificación, Campañas, cobrar con link, reagendar), el CRON de Automations (pagos, que abría una ventana), la voz con ElevenLabs, el email y el error de IA de «Pídeselo a MaKo». General y el Dashboard quedaron para su sesión.',
      'Lo que ya había y no se veía: las reuniones CANCELADAS se dibujaban (conservan su hora y pierden la fecha). Y lo nuevo: «Se repite» (las próximas veces de cada tarea que se repite, con la cuenta del generador, sin crear filas), «Cobros» (las cuotas que vencen), el deadline de un proyecto abre ese proyecto, y «Agendar llamada» por Calendly o Cal.com. En la API de MaKo: link_agenda_llamada y ver_proximas_recurrentes.',
      'Las publicaciones en redes por Zernio esperan una decisión: el 06/10 se sacó el programador de publicaciones.',
    ],
    commits: [{ sha: '184c0b3', msg: 'Calendario: sin «¿Qué vas a crear hoy?», conectar sin salir de la tab, y lo que se repite, los cobros y agendar llamadas', lineas: 1874, archivos: 44 }],
    archivos: [
      'app/_components/ConectarIntegracion.tsx', 'lib/integracion-en-tab.ts', 'app/integraciones/ServicioSuelto.tsx', 'app/integraciones/IntegracionesBoard.tsx',
      'app/api/integraciones/google-calendar/route.ts', 'app/api/integraciones/google-calendar/callback/route.ts', 'lib/gcal-estado.ts',
      'app/calendario/CalendarioApp.tsx', 'app/calendario/PlantillasSemana.tsx', 'app/calendario/AgendarLlamada.tsx', 'app/calendario/page.tsx', 'app/calendario/actions.ts',
      'lib/calendario.ts', 'lib/calendario-modelo.ts', 'lib/agenda-link.ts', 'lib/calcom.ts', 'lib/api-mako/areas/calendario.def.ts', 'lib/api-mako/areas/calendario.run.ts',
      'AGENTS.md', 'tests/calendario.test.ts', 'tests/gcal-estado.test.ts', 'tests/integracion-sin-salir.test.ts',
    ],
  },
  {
    fecha: '14 oct', hora: '—', chat: 'Calendario', cuenta: 'claude2',
    actor: 'claude', tipo: 'cosecha',
    titulo: 'Lo que costó, escrito',
    puntos: [
      'docs/hallazgos-calendario.md: la reunión cancelada, el ritmo de lo que se repite, los cobros, «Agendar llamada» (Cal.com sin medir) y lo que espera a Martín (las redes).',
      'docs/hallazgos-integraciones.md: conectar sin salir de la tab — el diagnóstico obvio («hace falta un modal») era el equivocado.',
    ],
    archivos: ['docs/hallazgos-calendario.md', 'docs/hallazgos-integraciones.md', 'docs/hallazgos.md'],
  },
];
