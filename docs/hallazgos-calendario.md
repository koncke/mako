# Hallazgos — Calendario

La tab `/calendario` (13/10/2026). Antes de tocarla, leer esto y `lib/calendario-modelo.ts` (la cabecera explica
las cinco capas y las tres reglas que la sostienen).

**El pedido, textual** (punto 14 del feedback de Martín, y «Dale, arrancá con el Calendario, pero que sea en otra
tab, no en GENERAL», 13/10/2026): «debería ser "CALENDARIO" y listo... puede utilizarse para planificar
publicaciones de Stories, Reels, Ads... organizar llamadas de ventas, de entrega de servicio... poner "bloques de
trabajo" para crear guiones o lo que necesite el usuario... Se puede combinar con lo que queremos implementar de
"OBJETIVOS", el Q, el PLAN... que sea simple de usar, que sirva para todos los casos, que tenga IA que te ayude o
"templates" y que no sea restrictivo».

## Sólo lo propio se guarda; lo demás se LEE de donde vive

**La decisión.** `calendario_eventos` (mig 0271) guarda únicamente lo que se agenda en la tab: publicaciones
(Story, Reel, Post, Anuncio, Email, Video), bloques de trabajo y llamadas sueltas. Las reuniones del CRM, la agenda
de Google, los deadlines del Plan y el Quarter **no se copian**: `leerCalendario` (lib/calendario.ts) los lee en cada
carga, en paralelo, y cada lectura que falla queda en `fallos` y la pantalla lo dice en una línea. Una copia sería
la segunda verdad; un calendario vacío sobre una lectura caída diría que la semana está libre.

**Lo que hubo que medir para leer bien cada fuente:**
- **Las reuniones del CRM tienen DOS columnas**: `fecha_junta_1` es un `DATE` (sin hora) y `junta_1_at` es el ISO
  con hora que deja Calendly o Cal.com (lo mismo para R2). Leer sólo la primera dibuja cada llamada como de todo el
  día. Se lee `junta_*_at`, y sin ella, la fecha suelta como día completo.
- **Una llamada de Calendly sale DOS veces** (la reunión del CRM y el evento de Google): `sinDuplicarLlamadas` saca
  el de Google que empieza en el mismo minuto (±2) que una del CRM. Queda la del CRM, que lleva a la ficha.
- **Google se lee ESTRICTO** (`leerAgendaGoogle`, lib/calendario-google.ts; hasta el 14/10, `eventosEntre`): un fallo es `ok: false`, no una lista vacía, y un calendario que falla se nombra.
  «No conectada» no es un fallo: se dice en gris con «Conectar».
- **Los deadlines del Plan salen de `tableroDelPlan`** (lib/plan-hoy.ts, la misma lectura del teléfono): las dos
  mitades del tablero (dueño y cliente), sin `no_cumple` y sin las recurrentes, que no tienen deadline.

## La agenda no pasa por la IA, tampoco acá

«¿Qué vas a crear hoy?» (lib/calendario-ia.ts) ve el PEDIDO y las siete FECHAS de la semana, nada más: ni un evento
de Google, ni una reunión del CRM, ni lo ya agendado (decisión de Martín del 07/10/2026; AGENTS.md → `datosDeGoogle`).
Por eso el prompt le prohíbe afirmar que un horario está libre: no lo sabe. Lo fija `tests/calendario.test.ts`, que
falla si el módulo o su ruta leen la agenda. Y MaKo **propone**: la pantalla muestra lo propuesto con casillas y
recién «Agendar N» escribe (origen `ia`). La API de MaKo del área tampoco lee Google, ni para listar ni para validar.

## Una hora de pared no es un instante

Lo que escribe la persona («el martes a las 10») se convierte con la zona del NEGOCIO y en dos pasadas
(`instanteDe`, lib/cron-aviso.ts). Medido en el test: en `America/Tijuana`, las 9:00 del 7/3/2026 son 17:00 UTC y
las del 8/3/2026 (el día del salto) son 16:00 UTC. Con `Date.UTC` pelado, o con una sola pasada, el evento del día del
salto queda una hora corrido sin un error. Y al dibujar, cada renglón va al día de la zona del negocio
(`itemsPorDia` con `diaDe`): un evento de las 22:00 en Tijuana es el día anterior en UTC.

## Lo que la IA devuelve se revalida, y lo ilegible se SACA

`deIACalendario` saca (con un aviso) el evento con una fecha fuera de la semana pedida, con un tipo inventado o con
una hora que vino y no se lee. La primera versión pasaba una hora ilegible a «todo el día»: era adivinar, y la regla
es no corregir adivinando. Lo cazó escribir el test con el caso.

## El onboarding se hace usándola

El molde de Offer: «Tu primera semana» (`cal_semana`) se cierra al agendar algo —una plantilla, MaKo o a mano— y «Tu
agenda de Google» (`cal_agenda`, opcional, lo aburrido al final) cuando la agenda se LEE bien en la página (la prueba
de vida, no la credencial guardada). Mientras el primero está pendiente, la galería se abre sola una vez por sesión
del navegador: armar la primera semana ES el onboarding. No se pregunta nada: el CRM, el Plan y el Q ya están en MaKo.

## La copia fiel de Google Calendar (14/10/2026)

**El pedido, textual:** «el calendario quiero que sea una copia fiel a Google Calendar, y que refleje todas las tareas y
eventos que se tienen en google calendar». Decisiones del mismo día (preguntadas, no se re-preguntan): las TAREAS de
Google quedan para después de la aprobación de la verificación de Google; lo que se crea, mueve o borra desde MaKo SE
ESCRIBE EN GOOGLE, como en Google.

**Cómo quedó.** La pantalla copia la web de Google Calendar (`.gc`, app/calendario/gc-css.ts): la barra de 64 px con
«Hoy», las flechas y el título como lo escribe Google («octubre de 2026»); «Crear» flotante; el mes chico; «Mis
calendarios» (las cinco capas de MaKo, con colores de la paleta de Google) y los calendarios de la cuenta de Google con
su casilla; las seis vistas (Día, Semana, Mes, Año, Agenda, 4 días) con las teclas de Google; los eventos llenos del color
de su calendario, repartidos en columnas cuando se pisan; la tarjeta al hacer clic; crear en el lugar con un clic o un
arrastre; mover y estirar arrastrando.

**Lo que no se ve y mordió (o casi):**

- **El diagnóstico obvio («hay que leer la agenda») era la mitad.** `eventosEntre` leía SÓLO el calendario principal
  (`calendars/primary/events`). «Todos los eventos que se tienen en Google» son los de TODOS los calendarios de la cuenta
  (`users/me/calendarList`), cada uno con su color. Ahora se leen todos (lib/calendario-google.ts) y se prende lo que la
  persona tiene tildado en Google; `eventosEntre` se borró.
- **Un día completo de Google tiene el fin EXCLUSIVO** (`end.date` = el día siguiente). Tomado como incluido, cada
  feriado ocupa dos días. `fechaFin` guarda el último día incluido; al escribir, se le suma uno (`cuerpoEventoGoogle`).
- **La hora de pared viaja CON SU ZONA a Google** (`dateTime` sin desvío + `timeZone`): Google la convierte, así un
  evento de las 10 queda a las 10 aunque cambie el horario de verano. Calcular el instante acá era la segunda copia de
  `instanteDe`.
- **Deshacer un borrado de Google devuelve el MISMO evento**: Google deja lo borrado como `cancelled` y se restaura con un
  PATCH a `confirmed` sobre el mismo id. Recrearlo le daba otro id y cortaba el hilo con los invitados.
- **Los colores que muestra Google no son los de la API.** `/colors` devuelve la paleta vieja; la web usa otra (Lavanda
  `#7986cb`, Pavo real `#039be5`…). Se copiaron los de la web (`COLORES_EVENTO_GOOGLE`). El color de un CALENDARIO sí
  viene tal cual en `calendarList` (`backgroundColor`).
- **Mover algo con invitados pregunta**, como Google: «¿Avisar a los invitados?» (`sendUpdates=all` o `none`). Sin
  invitados, se mueve y listo.
- **Lo que organiza otra cuenta no se mueve desde acá** (Google tampoco deja), ni lo que no es un evento común
  (`eventType` fuera de `default`: «fuera de la oficina», «tiempo de concentración», cumpleaños).
- **El paso de onboarding «Tu agenda de Google» se cerraba sin leer nada en la vista Año** (que no lee): la prueba de vida
  pasó a ser `lectura.google != null`, que sólo existe si Google contestó.
- **La API de MaKo escribe en Google sin leer la agenda**: `crear_evento_google` (área calendario, con `datosDeGoogle` y
  sin HTTP) crea en el calendario principal (`'primary'`, que `calendarioEditable` resuelve) y contesta un estado. No hay
  una operación que liste calendarios ni eventos de Google: la agenda no pasa por la IA.

**Vive en:** `lib/calendario-google-modelo.ts` · `lib/calendario-google.ts` · `lib/google-calendar.ts`
(`tokenDelCalendario`) · `lib/calendario-modelo.ts` (las vistas, `columnasDelDia`, `barrasDeLaFila`) · `lib/calendario.ts`
(`leerGoogle`) · `app/calendario/` · `lib/api-mako/areas/calendario.*` · `tests/calendario.test.ts` ·
`tests/agenda-sin-ia.test.ts`. *14/10/2026, claude2.*

## Lo que quedó SIN hacer

- **Las TAREAS de Google** (decisión de Martín del 14/10: después de la aprobación de la verificación). Piden el permiso
  `https://www.googleapis.com/auth/tasks.readonly`, que hay que sumar en la consola de Google (pantalla de consentimiento
  del proyecto `mako-500317`) y al pedido de `GCAL_SCOPE` (lib/google-calendar.ts); la lectura es
  `GET tasks/v1/users/@me/lists` y `lists/{id}/tasks?dueMin&dueMax&showCompleted=true`. La API de Tasks no da la HORA de
  una tarea (sólo el día): se dibujan como de todo el día, con su casilla, en un calendario «Tareas».
- **Invitar gente, la videollamada nueva y la repetición** al crear un evento de Google desde acá (Google los tiene en
  «Más opciones»). Mover o borrar UNA ocurrencia de una serie funciona (es la instancia); cambiar la serie entera, no.
- **Buscar** (la lupa de Google) no está.
- **La «entrega de servicio»** del pedido sale hoy sólo de la agenda de Google (las sesiones de Customer Success son
  grabaciones pasadas, no turnos futuros). Si CS agenda sesiones en MaKo, se suma como capa. Vive en `lib/calendario.ts`.
- **Las sesiones en vivo de la comunidad del curso** (`comunidad_eventos`) no se leen todavía: son otra capa posible.
- **Publicar** de verdad (que el Reel salga solo) no es de esta tab: el motor de publicar está pausado por Martín
  (relevo de Instagram). El Calendario planea y se tilda «Ya se publicó».
- **Los roles**: la tab es sólo del admin porque dibuja la agenda de Google del negocio. Si un closer tiene que ver
  sus llamadas, hace falta una capa sin Google.
- **MaKo Mobile** no tiene Calendario: en el teléfono se ve la pantalla de escritorio.

**Vive en:** `supabase/migrations/0271_calendario_eventos.sql` · `lib/calendario-modelo.ts` · `lib/calendario.ts` ·
`lib/calendario-ia.ts` · `lib/plan-hoy.ts` (`tableroDelPlan`) ·
`app/calendario/` · `app/api/calendario/ia/route.ts` · `lib/api-mako/areas/calendario.*` ·
`lib/tab-onboarding-catalogo.ts` · `tests/calendario.test.ts`. *13-14/10/2026, claude2.*
