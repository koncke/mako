# Hallazgos — Calendario

La tab `/calendario` (13/10/2026). Antes de tocarla, leer esto y `lib/calendario-modelo.ts` (la cabecera explica
las siete capas y las reglas que la sostienen).

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

El Calendario ya no tiene IA propia: «¿Qué vas a crear hoy?» (el armado de la semana con IA, lib/calendario-ia.ts y
/api/calendario/ia) se sacó entero el 14/10/2026 (Martín: «No pongas "¿Que vamos a crar hoy?", eso no es necesario,
eliminalo completamente»). Lo que un agente agenda entra por la API de MaKo (área `calendario`), que no lee Google ni
para listar ni para validar (AGENTS.md → `datosDeGoogle`). La API nunca expuso el armado con IA: no hubo nada que sacar
del registro. `tests/calendario.test.ts` falla si la caja, la ruta o la feature `calendario-ia` vuelven.

## Una hora de pared no es un instante

Lo que escribe la persona («el martes a las 10») se convierte con la zona del NEGOCIO y en dos pasadas
(`instanteDe`, lib/cron-aviso.ts). Medido en el test: en `America/Tijuana`, las 9:00 del 7/3/2026 son 17:00 UTC y
las del 8/3/2026 (el día del salto) son 16:00 UTC. Con `Date.UTC` pelado, o con una sola pasada, el evento del día del
salto queda una hora corrido sin un error. Y al dibujar, cada renglón va al día de la zona del negocio
(`itemsPorDia` con `diaDe`): un evento de las 22:00 en Tijuana es el día anterior en UTC.

## El onboarding se hace usándola

El molde de Offer: «Tu primera semana» (`cal_semana`) se cierra al agendar algo —a mano o con una plantilla— y «Tu
agenda de Google» (`cal_agenda`, opcional) cuando la agenda se LEE bien en la página (la prueba de vida, no la
credencial guardada). Desde el 14/10/2026 nada se abre solo por el onboarding: lo que salta al entrar es el modal de
CONECTAR Google Calendar, si no está (ver abajo). La galería de plantillas vive en «Crear › Plantilla de semana».

## Sin Google, el modal de conectarlo salta AHÍ; y el OAuth vuelve a la tab (14/10/2026)

**El pedido:** «si una persona entra allí y no tiene el google calendar conectado, que salte el modal que tenemos en
integraciones allí mismo... para una integración jamás se debe salir de la tab». Es regla para TODAS las tabs (AGENTS.md
→ «Para conectar una integración JAMÁS se sale de la tab»); lo que es de la pieza común está en
[hallazgos-integraciones.md](hallazgos-integraciones.md) → «Conectar sin salir de la tab».

Lo propio del Calendario:

- **«Una vez por visita» se cuenta en `sessionStorage`, por negocio** (`calendario.conectarGoogle.<ws>`), y no en el
  estado del componente: cambiar de semana o de vista es una navegación con otros `searchParams`, y NO se midió si eso
  vuelve a montar la pantalla; con la marca en el navegador no importa. El costo: un F5 en la misma pestaña no lo
  vuelve a ofrecer (el aviso de la barra lateral sí).
- **El Año no lee nada**, así que sin una pregunta aparte (`googleCalendarConectado()` en `page.tsx`) entrar por el Año
  sin Google no ofrecía conectarlo. Un fallo al preguntar NO se afirma como «no conectada».
- **Con `?gcal=` en la URL manda la vuelta del OAuth** (`useVueltaDeGoogle`): con un fallo reabre el modal con el
  motivo, con un «ok» avisa «Google Calendar conectado»; el modal «al entrar» no compite con eso.

## Una reunión CANCELADA se dibujaba como si siguiera en pie (14/10/2026)

**El diagnóstico obvio era la mitad.** El pedido decía «que las reservas que entran por esos webhooks se vean en la capa
de llamadas», y ya se veían: `leerCrm` lee `junta_1_at`/`junta_2_at`, que escriben los webhooks de Calendly y Cal.com.
Lo que nadie había mirado es la CANCELACIÓN: `cancelarJuntaEnLead` (lib/leads.ts) borra `fecha_junta_X` y **conserva
`junta_X_at` a propósito** (por la regla de No Show del CRM automático). Como la lectura filtraba sólo por la hora, cada
reunión cancelada seguía en el Calendario. Ahora se lee con `fecha_junta_X` puesta: la misma definición de «cancelada»
que `r1Cancelada` (lib/crm-auto-plan.ts). Lo fija `tests/calendario.test.ts`.

**La regla:** la hora sola no dice que una reunión siga en pie. Quien lea las reuniones del CRM pregunta por la fecha.

## Lo que se repite: el RITMO hacia adelante, con la cuenta del generador (14/10/2026)

Martín: «ver las tareas recurrentes allí». Una tarea que se repite es una PLANTILLA (`recurrente` + RRULE +
`recurrente_desde`, mig 0185); el generador (lib/plan-recurrentes-generar.ts) le crea UNA instancia normal, con
deadline, el día que toca, y esa instancia ya salía en la capa «Plan». La capa nueva «Se repite» dibuja las próximas
veces SIN crear filas (`proximasVeces`, lib/calendario-modelo.ts, sobre `ocurrenciasEntre`):

- **La misma cuenta que el generador:** el mismo ancla (`recurrente_desde`; sin ancla, hoy), y el día del ancla no
  cuenta (el generador arranca su cursor ahí, exclusivo).
- **Sólo de hoy en adelante.** Lo pasado son las instancias que nacieron; dibujar el ritmo hacia atrás afirmaría tareas
  que nunca existieron (el generador saltea las perdidas).
- **Sin el día que ya tiene su instancia** (`recurrente_de` + `deadline`): dos renglones el mismo día se leen como dos tareas.
- ⚠️ **El ancla y `recurrente_de` no los trae el mapper del tablero** (`rowToTask`/`toBoard`): se leen aparte en
  `recurrentesDelRango` (lib/calendario.ts), con la columna del título que corresponde a cada mitad (`title`/`titulo`:
  PostgREST rechaza la consulta entera si se pide una que no existe).
- ⚠️ **Por la API, el tablero se elige por CAPA, no por quien mira** (`tableroDeCapa`): por WhatsApp no hay cookie y
  `tableroActual()` contestaría «cliente» para el super admin (el mismo error que ya pagó lib/api-mako/areas/cs.run.ts).

## Los cobros que vencen (14/10/2026)

La capa «Cobros» son las cuotas SIN COBRAR de `pagos` (el plan de pagos de cada ficha) que vencen en el rango, con el
nombre del lead y el link a la ficha (`itemDeCuota`). `monto_usd` es lo que se muestra (`US$`), aunque el cobro real haya
sido en otra moneda. Una cuota de un lead que ya no está no se dibuja.

## «Agendar llamada»: el link de reserva del negocio (14/10/2026)

Martín: «agregar el calendly o cal, para agendar llamadas». «Crear › Agendar llamada» (app/calendario/AgendarLlamada.tsx)
pide el link al server (`linkDeAgenda`, lib/agenda-link.ts) y la reserva entra al CRM por el webhook, de donde la lee
«Llamadas». Calendly se abre en su popup (el de «Agendarla por Calendly» del CRM: el webhook tarda, así que la pantalla
vuelve a leer unos segundos después); Cal.com, en otra pestaña. Sin ninguno, el modal ofrece conectarlos ahí.

- **Calendly es el camino medido** (`eventTypeDeReunion` → `scheduling_url`).
- ⚠️ **Cal.com NO está medido contra una cuenta real**: el link se arma como `https://cal.com/<usuario>/<slug>` con el
  usuario de `GET /v2/me` (`linkDeReservaCalcom`, lib/calcom.ts). Lo que no se puede armar sin adivinar devuelve null y
  la pantalla lo dice: un tipo de evento cargado como id numérico o como nombre, y una cuenta de organización (su URL
  vive en otro dominio). Si `CALCOM_EVENT_TYPE_J1` es una URL entera, se usa tal cual.
- La API de MaKo suma `link_agenda_llamada` (el mismo link) y `ver_proximas_recurrentes` (área `calendario`). Para el
  link de Calendly con el nombre y el email de un lead, sigue `link_agenda_calendly` (área crm).

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
  ⚠️ **«Después de la aprobación» no es «al día siguiente».** Lo que está en revisión desde el 10/10 son `calendar.events` y
  `calendar.readonly`; `tasks.readonly` es un permiso NUEVO. Si la consola lo marca sensible al agregarlo en Data Access
  (la página de la API de Tasks no lo dice; no está medido), es otra ronda de verificación. Y `GCAL_SCOPE` no lo pide
  antes de que Google lo apruebe: pedirlo antes le vuelve a mostrar «Google no verificó esta app» a todo el que conecte su
  agenda. El estado de la verificación se mira en la consola o en martinkoncke@gmail.com: el Gmail conectado a las
  sesiones es el de Mauricio (medido el 14/10/2026, ~15:55, claude1).
- **Invitar gente, la videollamada nueva y la repetición** al crear un evento de Google desde acá (Google los tiene en
  «Más opciones»). Mover o borrar UNA ocurrencia de una serie funciona (es la instancia); cambiar la serie entera, no.
- **Buscar** (la lupa de Google) no está.
- **La «entrega de servicio»** del pedido sale hoy sólo de la agenda de Google (las sesiones de Customer Success son
  grabaciones pasadas, no turnos futuros). Si CS agenda sesiones en MaKo, se suma como capa. Vive en `lib/calendario.ts`.
- **Las sesiones en vivo de la comunidad del curso** (`comunidad_eventos`) no se leen todavía: son otra capa posible.
- **Publicaciones de Instagram, TikTok, YouTube… programadas de verdad** (pedido del 14/10/2026: «poder gestionar
  publicaciones de Instagram, TikTok, YouTube, etc»). ESPERA UNA DECISIÓN de Martín: el 06/10 sacó el programador de
  publicaciones de la tab Instagram («C: sacar la tab», 0 filas en `contenido_posts` en toda su historia) y
  `tests/sin-instagram.test.ts` fija que Zernio se habla SÓLO desde el canal de Automations. El lib de hoy
  (lib/zernio.ts) no tiene posts; el de antes sí (`createPost`/`getPost`/`deletePost` en `8d16c6ff^:lib/zernio.ts`,
  con `scheduledFor` + `timezone` y el `x-request-id` de idempotencia), y NO tenía un listado de programados
  (`GET /v1/posts` sin medir). Hace falta, además: una columna de la red en `calendario_eventos` (migración), subir el
  archivo a un lugar público (Zernio pide URLs), la cuenta de cada red conectada en Zernio, y que programar sea una
  acción con confirmación (publica afuera). Mientras tanto el Calendario planea («Publicación» con su formato) y se
  tilda «Ya se publicó».
- **Agendar una llamada PARA un lead desde el Calendario** (con su nombre y su email puestos): la pantalla abre la agenda
  sin datos. El CRM ya lo hace (`openCalendlyEn` con `prefill`); faltaría elegir el lead en «Agendar llamada».
- **Cal.com embebido**: se abre en otra pestaña. No hay un widget de Cal.com en el repo y su página no se midió en un iframe.
- **Que MaKo por WhatsApp traiga `link_agenda_llamada` y `ver_proximas_recurrentes`** cuando se lo piden: el doer elige
  herramientas por relevancia contra el texto (AGENTS.md, punto 8 de la API) y no se probó con el turno que corre
  (molde: tests/agenda-whatsapp.test.ts).
- **Los roles**: la tab es sólo del admin porque dibuja la agenda de Google del negocio. Si un closer tiene que ver
  sus llamadas, hace falta una capa sin Google.
- **MaKo Mobile** no tiene Calendario: en el teléfono se ve la pantalla de escritorio.

**Vive en:** `supabase/migrations/0271_calendario_eventos.sql` · `lib/calendario-modelo.ts` (`proximasVeces`,
`itemDeCuota`) · `lib/calendario.ts` (`leerCrm`, `recurrentesDelRango`, `leerCobros`) · `lib/plan-hoy.ts` (`tableroDelPlan`) ·
`lib/plan-recurrentes-fechas.ts` · `lib/agenda-link.ts` · `lib/calcom.ts` (`linkDeReservaCalcom`) · `app/calendario/`
(`AgendarLlamada.tsx`, `PlantillasSemana.tsx`) · `lib/api-mako/areas/calendario.*` · `lib/tab-onboarding-catalogo.ts` ·
`tests/calendario.test.ts`. *13-14/10/2026, claude2.*
