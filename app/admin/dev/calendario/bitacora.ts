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
  { titulo: 'La tab y sus cinco capas', detalle: 'Publicaciones · Llamadas (CRM + Google) · Bloques · Plan · Objetivos y el Q', estado: 'hecha' },
  { titulo: 'Plantillas y «¿Qué vas a crear hoy?»', detalle: 'Seis semanas tipo · MaKo propone sin ver la agenda · la persona confirma', estado: 'hecha' },
  { titulo: 'La API de MaKo', detalle: 'listar_eventos_calendario · crear_evento_calendario (con «sí»)', estado: 'hecha' },
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
];
