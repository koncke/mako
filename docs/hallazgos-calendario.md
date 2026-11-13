# Hallazgos — Calendario

La tab `/calendario` (13/10/2026). Antes de tocarla, leer esto y `lib/calendario-modelo.ts` (la cabecera explica
las siete capas y las reglas que la sostienen).

**El pedido, textual** (punto 14 del feedback de Martín, y «Dale, arrancá con el Calendario, pero que sea en otra
tab, no en GENERAL», 13/10/2026): «debería ser "CALENDARIO" y listo... puede utilizarse para planificar
publicaciones de Stories, Reels, Ads... organizar llamadas de ventas, de entrega de servicio... poner "bloques de
trabajo" para crear guiones o lo que necesite el usuario... Se puede combinar con lo que queremos implementar de
"OBJETIVOS", el Q, el PLAN... que sea simple de usar, que sirva para todos los casos, que tenga IA que te ayude o
"templates" y que no sea restrictivo».

## MaKo dice «te mostré arriba tu agenda» y la agenda llega ABAJO (13/11/2026, claude5)

**El síntoma:** probando el grupo de la app del ws9, a «¿qué reuniones tengo mañana?» MaKo contestó «Te mostré arriba lo que tienes
en tu agenda de Google para mañana…» y la lista «🗓️ Tu agenda del sábado…» quedó en el mensaje SIGUIENTE (filas 577 y 578 de
`grupo_mensajes`, 0,8 s después). Captura: notas del Cerebro, `mako-en-la-app-1311/06-audio-respuesta-y-agenda-debajo-1440.jpg`.

**No es de la app:** WhatsApp sale igual. La agenda la escribe el CÓDIGO (lib/agenda-sin-ia.ts, `paraLaPersona`) y el doer la manda
AL FINAL a propósito (lib/mako-doer-in.ts, `[...partes, ...paraLaPersona]`, «los reemplazos de arriba pisan `respuesta`»). Pero lo que
se le dice al modelo es pasado: `ESTADOS_AGENDA.eventos_mostrados` = «El sistema YA le mostró a la persona lo que tiene ese día», y
de ahí sale el «arriba». Lo mismo `reuniones_mostradas`, `horarios_mostrados` y `ERRORES_MOVER`.

**Lo arreglado (mismo día):** se le dice al modelo la verdad. Todos los textos de lib/agenda-sin-ia.ts que avisan que el sistema le
muestra algo a la persona (`ESTADOS_AGENDA`, `ERRORES_MOVER`, `ERRORES_DEL_DIA`) dicen ahora «en un mensaje aparte, justo DEBAJO de tu
respuesta», y los que muestran una lista le prohíben «arriba» y «ya te la mostré». Se descartó la otra salida (mandar la agenda
primero): el orden «lo del código después» lo fija tests/agenda-sin-ia.test.ts y vale para la propuesta, los links para conectar y la
oferta de ayuda, que sí van después. Test: tests/agenda-sin-ia.test.ts, «lo que el sistema le muestra… va DEBAJO».

**Regla:** lo que se le dice al modelo sobre un mensaje que manda el CÓDIGO tiene que decir DÓNDE queda ese mensaje, en el orden en
que de verdad sale. «Ya le mostró» en pasado es una mentira si el código lo manda después, y el modelo la repite.

## Las reuniones del equipo y el email enlazado (6/11/2026, nube, la promesa a la agencia de Thiago)

**El pedido** (docs/promesas/2910-llamada-thiago.md, medido contra main el 6/11): «Gestionar las reuniones de tu equipo» y
«Programar en el Calendar un anuncio, un email». Al Calendario entraba sólo el admin, y el anuncio y el email eran un
recordatorio que se tildaba a mano.

**Las reuniones del equipo.** Un closer o un setter entra a «Llamadas» y arranca en las suyas; el admin filtra por persona.
- **Lo que NO ve un closer decide la puerta, no la lista.** La grilla trae la agenda de Google del dueño, los cobros y los
  objetivos; el Plan es del admin. Por eso la página (computadora y teléfono) va derecho a «Llamadas» cuando
  `miradaDeRol` dice `soloLlamadas`, aunque la URL pida `?vista=semana`, y no lee las tareas del Plan. Las acciones de la
  pantalla siguen en `requireRolWs([])`: marcar la asistencia pasa por la del CRM, que el closer ya tenía.
- **Una llamada es de su closer Y de su setter** (`leads.closer` / `leads.setter` guardan el NOMBRE): se compara sin
  mayúsculas ni espacios de más. Un rol que no se pudo leer ve lo mínimo, nunca la vista del admin.
- **Abrir una tab a otro rol mueve SEIS tests de la barra**, no uno: la sidebar, More (computadora y teléfono), el hueco de la
  barra del teléfono, la puerta del layout del loader y la query de la sección (`persona`). Todos fijaban «Calendar es del
  admin» como lista; se cambiaron con la fecha y el porqué. **Vive en:** lib/calendario-llamadas.ts,
  lib/calendario-equipo-server.ts, app/calendario/page.tsx, app/m/calendario/page.tsx.

**El email enlazado.** Un Email del Calendario se enlaza a un broadcast de Email Marketing y queda programado a la hora del
evento.
- **No hay una segunda regla de programar:** se llama al `preparar` y al `ejecutar` de `programar_broadcast`
  (lib/api-mako/areas/email.run.ts), con su segmento, su tope, el turno del envío automático y los avisos. El resumen se
  muestra ANTES y el `ejecutar` vuelve a revisar todo.
- **La operación se gatea por `calendario` y programar un email es de `email`:** sin mirar el plan, un negocio sin Email
  Marketing programaba emails por el Calendario. Lo mira `sinEmailEnElPlan` (`tabEnCapa('email', capa)`).
- **Mover el evento mueve el email** (`reprogramarSiEnlazado`, desde `cambiarEventoAction`); si falla, el evento queda movido
  y el aviso dice que el email sigue a la hora de antes. **Vive en:** lib/calendario-email.ts, lib/calendario-email-reglas.ts,
  app/calendario/EnlazarEmail.tsx, mig 0406 (sin aplicar).

**Lo que quedó sin hacer, y por qué:**
- **El anuncio programado.** Hoy una campaña nace EN PAUSA (`proponer_crear_campana`) y no existe una «fecha de inicio».
  Programar un anuncio es empezar a gastar a una hora: tiene que pasar por `lanzar` (lib/media-buyer/ejecutar.ts, con la
  zona, la fecha de fin y los topes) y por una revisión adversarial. El camino propuesto, en docs/relevo/nube-thiago-migrar.md.
- **Lo que no se probó:** el enlace contra una base real (la nube no la ve). Corren las reglas puras y el cableado
  (tests/calendario-email.test.ts, tests/calendario-equipo.test.ts).

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

## El Calendario en el teléfono comparte un módulo PURO con escritorio (15/10/2026)

MaKo Mobile tiene Calendario (app/m/calendario: Día · Agenda, crear, marcar hecho, borrar con Deshacer). Lee con
`leerCalendario`, igual que escritorio, y lo que dibuja igual (`visiblesPorDefecto`, `sinLlamadasRepetidas`, los
colores, `tituloDe`, `lineaDeFecha`, `TIPOS_RAPIDO`, `vaAGoogle`…) se mudó a **app/calendario/comun.ts**, que no es
`'use client'`; VistaTiempo.tsx y Tarjetas.tsx lo importan de ahí y lo re-exportan. Una pieza nueva que usen los dos va
ahí, nunca copiada en /m (tests/m-calendario.test.ts fija que comun.ts no sea `'use client'`).

- **Una función que PARECE pura puede estar fijada por un test que lee la fuente.** Mudar `lineasDeAviso` de
  CalendarioApp.tsx a comun.ts rompe tests/calendario.test.ts:286, que busca sus textos ('servicio: google, link:
  Conectar') DENTRO de CalendarioApp.tsx. Se quedó donde estaba. **Regla:** antes de sacar una función de un archivo,
  `grep` de sus textos en tests/; si un test fija la fuente, se deja o se cambia el test en el mismo commit.

**Vive en:** app/calendario/comun.ts · app/calendario/{CalendarioApp,VistaTiempo,Tarjetas}.tsx · app/m/calendario/ ·
tests/m-calendario.test.ts · tests/calendario.test.ts. Las trampas del teléfono, en hallazgos-mobile.md («Las pantallas
de More que faltaban»). *15/10/2026, claude3.*

## La estrella de MaKo y «Llamadas»: lo que pedía ya estaba leído, faltaba dónde verlo (24/10/2026, noche)

La llamada con Leandro (Fathom, 24/10; textual en docs/feedback-24-10.md, f07 y f08): «se ve muy como calendario de Google»,
que muestre lo que ya existe en MaKo (llamadas de ventas, tareas del Plan con deadline) y que esté la estrellita para «che
Maco, movéme la reunión, agendame tal o tal». Chat «Planes», cuenta 5, a pedido del Cerebro.

- **El diagnóstico obvio («hay que leer las llamadas y las tareas») era el equivocado:** la grilla YA las lee y las prende por
  defecto (capas «Llamadas» y «Plan», `leerCrm` y `leerPlan`). Lo que faltaba era una forma de verlas que no fuera la de
  Google: «Llamadas» (app/calendario/ListaLlamadas.tsx), la lista de citas de venta copiada del «Appointment List View» de
  HighLevel, con Próximas · Pasadas · Canceladas, el estado de cada una y las tareas con fecha al lado. Se entra por
  «Calendario | Llamadas» arriba a la derecha (como el «Calendario | Tareas» de Google Calendar).
- **Mover y agendar con MaKo ya existía en la API** (`proponer_mover_reunion`, `proponer_agendar_reunion`,
  `horarios_libres_dia`, del área CRM): la estrella sólo tenía que estar. Con una llamada del CRM abierta va su lead como
  entidad, y con una tarea, la tarea (`entidadDelItem`, app/calendario/comun.ts). **Lo de Google NO lleva entidad**: la
  agenda no pasa por la IA (AGENTS.md, `datosDeGoogle`).
- **Una reunión cancelada conserva la hora y pierde la fecha**: la grilla la saltea (`not('fecha_junta_X', 'is', null)`), la
  lista la lee igual para su pestaña (`leerLlamadasDeVenta`). Copiar la consulta de `leerCrm` tal cual dejaba «Canceladas»
  vacía sin error.
- **El estado: lo marcado gana sobre la hora** (una que ya asistió es «Asistió» aunque sea de hoy) y «Sin marcar» es la que
  terminó sin que nadie dijera si vino; con sólo el día, termina cuando termina el día (`estadoDeLlamada`,
  lib/calendario-llamadas.ts). Qué ya pasó lo decide el reloj del server (`ahora` viaja como prop): con el del navegador,
  el HTML y la hidratación podían discrepar.
- **Mirar una pantalla que importa MakoEnLaTab sin levantar la app:** el render estático no sirve (importa CSS y el Link de
  la casa necesita el router de Next). Se empaquetó con la API de esbuild y un plugin `onResolve` que cambia
  `@/app/_chat/MakoEnLaTab` y `@/app/_ui/Link` por dos stubs, y se montó con `createRoot` en Chrome (Playwright).
- **`.gc-pestanas` ya existía** en app/calendario/gc-css.ts (otra pieza): el selector nuevo va con `.gc-que-ver`. Antes de
  nombrar una clase en una hoja de 170 reglas, `grep`.

**25/10, la segunda tanda (Martín: «implementa todos los feedback... no hagas preguntas»):**
- **Marcar la asistencia en la fila no es un camino nuevo de escritura:** es `guardarCampoLeadAction(lead, 'asistio_j1')`,
  el MISMO de la ficha (historial, etapa derivada, Meta, «Deshacer» con `deshacerCampoLeadAction`). Escribir `asistio_jX`
  con un update suelto saltaba todo eso. **La trampa:** en la R1, todo lo que no sea «asistió» BORRA el calificado
  (`updateLead`: `asistio_j1 !== true` → calificado = null), también DESMARCAR. Por eso la lectura trae el calificado y la
  lista pregunta antes (`avisoAlMarcar`). Sólo se marca una reunión que ya empezó (`sePuedeMarcar`).
- **«Llamadas» en el teléfono** (app/m/calendario/LlamadasM.tsx) usa las MISMAS funciones puras que la computadora (el
  estado, las pestañas, `rotuloDelDia`, `TONO_ESTADO_LLAMADA`, en lib/calendario-llamadas.ts) y se entra por el selector de
  vistas (Día · Agenda · Llamadas). La asistencia se marca en la ficha (un desplegable en una fila de 44 px no se toca bien).
  El número azul va sólo en lo que espera algo (las pasadas sin marcar), como pide la guía del teléfono.
- **Debajo de 1100 px las tareas bajan** debajo de la tabla y la columna entera scrollea (antes se escondían).
- **f09, la recarga: SIN SÍNTOMA, no se arregla a ciegas.** El Cerebro leyó el tramo entero de la llamada (11:04-15:11):
  Martín dice «ahí darle a recargar porque algo está...» y en el acto pasa a otra cosa; nadie dice qué se veía mal ni qué
  cambió al recargar (docs/feedback-24-10.md: «no es un bug: no hay síntoma»). Queda medido, por si vuelve con un síntoma:
  leer Google hace el refresco del token (8 s), la lista de calendarios (10 s) y tandas de 4 calendarios con 10 s cada una,
  en serie: con 9 calendarios, ~48 s antes de dibujar. Si el síntoma es ése, la salida es un presupuesto TOTAL para Google
  (lo que no llegue, a `fallaron`, que ya se muestra).

**Sin hacer:** «Se ve muy como Google» en la GRILLA sigue a propósito (Martín, 25/10: «lo tengo que personalizar»). **Vive
en:** app/calendario/ListaLlamadas.tsx · app/calendario/Pestanas.tsx · app/calendario/comun.ts (`entidadDelItem`) ·
app/m/calendario/LlamadasM.tsx · lib/calendario-llamadas.ts · lib/calendario.ts (`leerLlamadasDeVenta`,
`leerTareasConFecha`) · tests/calendario.test.ts.

## Un lead con emoji en el nombre tiraba /calendario entero (27/10/2026, ticket #10)

**Síntoma:** con el lead de prueba del ws3 (su nombre empieza con un emoji), «Llamadas» se caía con React #418.
**Causa:** la inicial de la fila salía de `l.nombre.trim().charAt(0)`, que es la primera UNIDAD UTF-16: con «🧪 Lead», media
pieza del emoji. El HTML del server no puede llevar medio emoji (sale «�») y el navegador sí lo tiene: React ve dos textos
distintos al hidratar y tira la pantalla, no sólo el avatar.
⚠️ **Por qué sobrevivió al barrido del 25/10:** la guarda de toda la app (tests/iniciales-con-emoji.test.ts) busca las formas
de las copias viejas (`split(/\s+/).map((w) => w[0])`, `${p[0][0]}${p[1][0]}`), no `charAt(0)` ni `trim()[0]`. Una inicial de
UNA letra no tenía esa forma.
**Regla:** la inicial sale de `iniciales(nombre, 1, '·')` (lib/unicode-seguro.ts). `tests/calendario-classroom-iniciales.test.ts`
barre el Calendario y el Classroom (escritorio y teléfono) buscando cualquier primera unidad recortada o sola en mayúscula;
`charAt(0).toUpperCase() + x.slice(1)` (poner la mayúscula) no rompe y no se marca. **Vive en:** app/calendario/ListaLlamadas.tsx.

## Una Publicación se programa en la red, por Zernio (28/10/2026)

Martín a Teo (28/10, 00:23:08): «publicás reels e historias desde el Calendar los días y a la hora que elijas». El Cerebro:
la decisión que este documento esperaba («ESPERA UNA DECISIÓN de Martín», abajo) es ese pedido. Chat «Zernio y CAPI».

**Vive en:** `lib/calendario-publicar-reglas.ts` (puro: si se puede, el cuerpo del post, la ruta, el estado) ·
`lib/calendario-publicar.ts` (la base, el archivo y Zernio) · `lib/zernio-publicar.ts` (los posts de Zernio, el molde de
`8d16c6ff^:lib/zernio.ts`) · `app/calendario/PublicarEnRed.tsx` (dentro del modal) · «Crear → Programar las publicaciones
listas» (en serie) · la operación `programar_publicacion` · mig 0342 · tests/calendario-publicar*.test.ts.

- **La regla:** una Publicación con su cuenta (las conectadas en Zernio: Instagram, Facebook, TikTok, YouTube), su archivo y
  su hora se programa con `POST /v1/posts` y sale sola. Lo programado no se mueve, no se borra ni se le cambia el archivo
  sin cancelar antes (saldría igual a la hora vieja). Al abrir el Calendario se relee lo que ya tenía que salir.
- ⚠️ **Las columnas nuevas se leen APARTE** (`leerPublicaciones`, que tolera que no existan). Sumarlas a `COLS` rompía la
  lectura entera del Calendario en una base sin la 0342 (la trampa de docs/hallazgos-pagos.md, «Una columna nueva en un
  select explícito rompe la lectura entera sin la migración»). Y el «Deshacer» de un borrado las devuelve aparte del INSERT.
- ⚠️ **El estado de la red va APARTE de `estado`** (planeado | hecho): cambiar ese CHECK obligaba a tocar el «Deshacer», que
  inserta una lista fija de columnas. Cuando Zernio dice «publicada», el evento además pasa a `hecho`.
- ⚠️ **La hora es un instante:** `scheduledFor` va con su Z (Zernio ignora `timezone` si la hora trae zona). Un evento «todo
  el día» NO se programa: nace a las 00:00 del negocio y saldría a la medianoche.
- ⚠️ **La media se firma hasta 7 días DESPUÉS de la hora:** Zernio la lee al publicar, días después de programarla. Una firma
  corta (la de 12 h de `wa-media`) muere antes. Bucket privado `ig-media` (mig 0136, ya en el Reset), ruta
  `<ws>/calendario/<evento>/<al azar>` armada por el server y validada por segmentos.
- **Una vez:** el evento se reclama (`programando`, compare-and-set) antes de pedirle a Zernio, con `x-request-id`; un 409
  de Zernio con `existingPostId` es el post que ya estaba, no un error.
- ⚠️ **El diagnóstico obvio era el equivocado: «si Zernio falla, `fallo` y se reprograma»** (la verificación del 28/10,
  `C:/dev/revisiones/2810-verificacion-zernio-bef5bfcd3.md`). Si la conexión se corta o Zernio da 5xx, el post PUEDE haber
  quedado creado; reprogramar con un `x-request-id` nuevo lo duplica en la red (y el 409 no salva: no está documentado que
  cubra un pedido nuevo con el mismo contenido; la línea vieja «el 409 de las 24 h» no se sostenía). La regla: sin respuesta
  (no `ZernioError`, o status 0 o ≥500) → `dudosa`, con el `x-request-id` y la hora del PRIMER envío guardados en
  `publicacion_intento` (`<id>@<ms>`, `anotarIntento`). Dentro de 4 minutos **desde el primer envío** se reintenta el MISMO
  pedido (la idempotencia de Zernio devuelve el que había creado); después NO se reprograma: alguien mira en Zernio y, si no
  está, «No quedó programada» la pasa a `fallo`; si está, «Ya lo resolví en Zernio» la suelta (sin la cuenta, para que
  «Programar las listas» no la duplique). Un `programando` de más de 10 minutos (la función murió en el medio) pasa a
  `dudosa` en la relectura, SIN el intento. Una `dudosa` no se mueve, no se borra ni se cancela.
- ⚠️ **La ventana se cuenta desde el PRIMER envío, no desde la última anotación** (la segunda verificación, 29/10,
  `C:/dev/revisiones/2910-verificacion-zernio-254856316-planes-ddfa645d4.md`). Contarla desde `updated_at` parecía lo mismo y
  no lo era: la relectura de un trabado y cada reintento cortado renuevan `updated_at`, así que «Reintentar» a los 12 minutos
  repetía un `x-request-id` que Zernio ya no recordaba (~5 min) y salían DOS posts. Y en el reintento, sólo el post resuelve: un
  429 o un 422 dicen que Zernio no creó ESE pedido, no que el primero no exista (si el `x-request-id` se porta como su
  Idempotency-Key, el 422 «mismo key, cuerpo distinto» sale SIEMPRE: la media se firma de nuevo en cada intento). Sigue `dudosa`.
- ⚠️ **El reclamo exige que el evento no haya cambiado desde que se leyó** (`.eq('updated_at', …)`). La condición en la escritura
  de mover y borrar cerraba un orden de la carrera, no el otro: programar leía, otro pedido lo movía o le cambiaba la cuenta
  (todavía sin publicación, así que la condición lo dejaba), y el reclamo ganaba con lo viejo. Regla para código nuevo: todo lo
  que escribe `calendario_eventos` renueva `updated_at` (no hay trigger).
- **Una programada con OTRA clave** (o sin clave) ni se relee ni se cancela desde MaKo: la pantalla lo dice y ofrece «Ya lo
  resolví en Zernio». Tildar, mover y borrar dicen el porqué de su estado (`textoDeBloqueo`): «se tilda sola cuando sale» es
  cierto sólo de una programada con la clave de hoy.
- ⚠️ **La cuenta es del NEGOCIO, no la que manda el navegador.** `guardarPublicacion` y `programarPublicaciones` validan la
  cuenta contra `conexionesViaZernio(ws)` (filtradas por el perfil del negocio) y la red sale de la cuenta. Antes se guardaba
  cualquier `acc_…` que llegara: con la cuenta prestada de la plataforma (un perfil por negocio en la MISMA cuenta de Zernio)
  eso publicaba en la cuenta de otro negocio. Si las cuentas no se pueden leer, no se programa a ciegas. El «Deshacer» de un
  borrado devuelve el archivo y el texto, NUNCA la cuenta, y si el evento ya había vuelto (un segundo «Deshacer», 23505) no
  escribe nada: el segundo pisaba el archivo y el texto de uno ya programado otra vez.
- ⚠️ **Un 404 de Zernio con OTRA clave no es «no está».** Un post es de la cuenta de Zernio con cuya clave se creó; si el
  negocio cambia de clave (pasa: el ws 11 cambió de cuenta, el ws 1 va a dejar la de la plataforma), el post viejo da 404 y
  sigue programado allá. Se guarda la huella de la clave (`publicacion_clave`, sha256 corto, nunca la clave): con otra clave,
  cancelar da error y la relectura no la da por perdida.
- ⚠️ **La condición «no espera a Zernio» va EN la escritura**, no en una lectura antes (`sinPublicacionEnCurso` en
  `lib/calendario.ts`, dos pasos: `is null` y `in (publicada, fallo)`, porque el PostgREST de los tests no entiende un `or`
  con `in`). Leer «libre» y escribir sin condición movía o borraba una recién programada por otro pedido.
- **El «sí» de la API lleva la HUELLA** de lo que se resumió (la hora, la cuenta, el archivo, el texto): el «sí» puede llegar
  horas después; uno que cambió no se programa con el resumen viejo. El resumen dice la cuenta (`@usuario`), no sólo la red.
- **No medido:** el cuerpo para TikTok y YouTube (`platformSpecificData`, el `title`) sale del código viejo y de la
  documentación, sin una cuenta real. En YouTube el título del evento es el título público (tope 100). La primera publicación
  real la confirma el Cerebro antes (es producción). Tampoco está medido con una cuenta real que el `x-request-id` de Zernio
  devuelva el mismo post al repetir el pedido (lo dice su documentación; el test lo supone).
- **Sin hacer:** el webhook `post.published`/`post.failed` (hoy no se suscribe: el estado se relee sólo cuando alguien abre el
  Calendario); la media que queda en `ig-media` al borrar un evento (el «Deshacer» la necesita; falta barrerla); por WhatsApp
  no se sube el archivo (la operación programa lo que ya está armado). La mig 0342 (con `publicacion_intento`,
  `publicacion_clave` y el estado `dudosa`) NO está aplicada: la pide el Cerebro.

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
- ~~**La «entrega de servicio»** del pedido sale hoy sólo de la agenda de Google~~ **Desde el 29/10/2026 es un tipo propio, `entrega`**
  (ver «A la medida del negocio», abajo); lo que sigue vale para las sesiones de CS. Lo de antes: sale sólo de la agenda de Google (las sesiones de Customer Success son
  grabaciones pasadas, no turnos futuros). Si CS agenda sesiones en MaKo, se suma como capa. Vive en `lib/calendario.ts`.
- **Las sesiones en vivo de la comunidad del curso** (`comunidad_eventos`) no se leen todavía: son otra capa posible.
- ~~**Publicaciones de Instagram, TikTok, YouTube… programadas de verdad**~~ **HECHO el 28/10/2026**: ver «Una Publicación se
  programa en la red» (arriba). Lo que decía antes: (pedido del 14/10/2026: «poder gestionar
  publicaciones de Instagram, TikTok, YouTube, etc»). ESPERABA UNA DECISIÓN de Martín: el 06/10 sacó el programador de
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
- **En el teléfono** (app/m/calendario, 15/10/2026) quedan en la computadora Semana, Mes, Año, 4 días, plantillas,
  agendar por Calendly, editar o mover un evento, elegir qué calendarios se ven y conectar Google; y el teléfono no
  marca el paso `cal_agenda` del onboarding (escritorio lo marca en app/calendario/page.tsx al leer bien Google).

**Vive en:** `supabase/migrations/0271_calendario_eventos.sql` · `lib/calendario-modelo.ts` (`proximasVeces`,
`itemDeCuota`) · `lib/calendario.ts` (`leerCrm`, `recurrentesDelRango`, `leerCobros`) · `lib/plan-hoy.ts` (`tableroDelPlan`) ·
`lib/plan-recurrentes-fechas.ts` · `lib/agenda-link.ts` · `lib/calcom.ts` (`linkDeReservaCalcom`) · `app/calendario/`
(`AgendarLlamada.tsx`, `PlantillasSemana.tsx`) · `lib/api-mako/areas/calendario.*` · `lib/tab-onboarding-catalogo.ts` ·
`tests/calendario.test.ts`. *13-14/10/2026, claude2.*

## «Publicar» desde el Video Editor, el Image Editor y el Copywriter: un solo camino, el del Calendario (29/10/2026)

Martín, por el Cerebro: «que con las funcionalidades que ya creamos puedan publicar en Facebook, TikTok, LinkedIn…». El Cerebro:
«El botón lleva lo exportado (el video, la imagen o el texto) al Calendario con el evento ya armado, para elegir la red, el día y
la hora. Un solo camino de publicación».

**Vive en:** `lib/calendario-desde-crear.ts` (puro: qué evento se arma, qué archivo vale, el link) · `publicacionDesdeCrearAction`
(app/calendario/actions.ts) · `llevarAlCalendario` (app/calendario/publicar-desde-crear.ts, lo comparten los tres) · `?evento=`
(app/calendario/page.tsx → CalendarioApp) · el Video Editor (`PublicarButton`, `DialogoExportar publicar`, `Exportacion { guardar }`)
· el Image Editor (DownloadDialog, «Publicar en redes») · el Copywriter (EditorGuion, el menú «⋯») · tests/publicar-desde-crear.test.ts.

- **La regla: ningún editor habla con la red.** Arman una Publicación «planeada» para MAÑANA a las 10:00 (video → reel; imagen y
  texto → post), suben el archivo con la MISMA subida firmada del Calendario (`subidaDelArchivo` + `subirConProgreso`) y abren
  ese evento (`/calendario?…&evento=<id>`). La red, la cuenta, el día, la hora y «Programar» son del Calendario, con los límites de
  cada red (`motivoParaNoProgramar`). Un test barre los tres editores: ninguno importa Zernio ni `programarAction`.
- ⚠️ **El video exportado no volvía:** `Exportacion` lo escribía en la carpeta de «Exportar a» y devolvía sólo los NOMBRES. Ahora
  devuelve el blob del video, y con `{ guardar: false }` (el modo «Publicar») no deja un archivo en la carpeta de la persona. El
  modo publicar exporta SÓLO el video y en MP4 (lo que aceptan todas las redes), con el codec que el navegador puede; ya
  exportado en MP4 o MOV, «Publicar en redes» lleva el mismo video sin volver a exportar.
- ⚠️ **Los ids de evento no son uuid** (`ev` + base 36, `nuevoId` de lib/calendario.ts): la primera validación del `?evento=` los
  rechazaba todos. El patrón lo fija el test contra `nuevoId`.
- ⚠️ **`toLocaleString('es')` no separa los miles de un número de 4 cifras** («2200», no «2.200»: la regla de la RAE que trae
  ICU). Para un texto de pantalla, a mano.
- **Un texto de más de 2.200 no se corta en silencio:** el pie queda vacío y el texto entero va a las notas del evento, con el aviso
  arriba («recórtalo y pégalo en «Texto de la publicación»»). Los topes de cada red (X 280, Threads 500) los dice el Calendario al
  elegir la red.
- **El Image Editor publica UNA página en JPG, PNG o WEBP:** una Publicación del Calendario lleva un archivo. El botón dice por qué
  está apagado. **El Copywriter nunca publica desde el editor compartido** (quien edita por un link no tiene Calendario).
- ⚠️ **Doory (el Image Editor) no marca «use client»:** su diálogo no puede importar un VALOR de app/_ui/Link.tsx
  (tests/frontera-use-client.test.ts: falla al usarlo, en runtime). Ahí se navega con `conWs` + `wsDeBusqueda` de lib/ws-tab.ts
  (el mismo `?ws=` que pondría el router). Lo vio la barredora, no el test propio.
- ⚠️ **Una corrida de tests-afectados con la RAM al límite (0,1 GB libre) da «112 rojos» que corrieron 0 tests:** el grupo
  compartido se murió entero. No son fallas: se repiten en tandas de 14 por con-turno (ahí apareció el único rojo de verdad).
- **Si la subida falla, la Publicación ya existe:** las dos salidas con error devuelven su link («quedó en el Calendario sin el
  archivo: súbelo ahí»), para que reintentar no arme otra.
- **Sin hacer:** un carrusel (varias imágenes en una publicación); publicar un texto SOLO (el Calendario pide un archivo para
  programar: el texto del Copywriter llega sin archivo y ahí se sube la imagen o el video). **Sin verificar en el navegador:** no se
  levanta `next dev` local; las capturas las saca el Cerebro en producción, en el ws3, después del deploy.

## Publicaciones que se repiten: un molde, una regla, y el cron que crea y programa cada vez (29/10/2026)

La llamada de Martín con una agencia de 27 clientes (29/10, [19:25]): «podés programarte publicaciones recurrentes». El Cerebro: un
«Repetir» en el evento, la regla en `calendario_eventos` (mig 0349), un cron que cree y programe por Zernio, y que el Calendario dibuje
las próximas.

**Vive en:** `lib/calendario-recurrentes-reglas.ts` (puro) · `lib/calendario-recurrentes.ts` (`guardarRepeticion`, `seriesParaDibujar`,
`generarRecurrentes`) · `app/api/cron/calendario-recurrentes` (cada 6 horas) · `app/calendario/PublicarEnRed.tsx` («Repetir») ·
mig 0349 · tests/calendario-recurrentes.test.ts.

- **La regla es la del Plan** (RRULE, `lib/plan-recurrentes.ts`: la frase en español, los presets, `ocurrenciasEntre` con su ancla), no
  una nueva. La Publicación con la regla es el MOLDE y la primera vez; cada vez nace igual (la hora, la cuenta, el texto) y se
  programa por `programarPublicaciones`, el mismo «Programar» con los límites de cada red. Ninguna otra puerta a la red.
- ⚠️ **El archivo se COPIA, no se comparte:** `rutaValida` exige `<ws>/calendario/<evento>/…`, así que el archivo del molde no
  pasaba para otra fila, y compartirlo dejaba que borrar una vez se llevara el del molde. Cada vez nace con su copia (Storage `copy`).
- **Nada hacia atrás y dos días adelante:** con el cron caído, la vez que pasó no se publica tarde; la de hoy cuya hora pasó, tampoco.
  Cada 6 horas (no una vez por día), y como crea dos días adelante ninguna llega justa. ⚠️ Una vez que NACIÓ y cuyo «Programar» falló
  NO se reintenta sola: queda en el Calendario con su motivo (la versión anterior de esta línea decía que se reintentaba; no era cierto).
- ⚠️ **Lo que el cron atendió se anota en el MOLDE (`repetir_hasta`), no se cuenta por las filas que existen.** La primera versión
  contaba las veces por las hijas que había: borrar la de mañana la hacía RENACER y programarse sola, y moverla al sábado dejaba las
  dos (revisión de privacidad del 29/10, A1). Ahora nunca se crea un día en o antes de la marca, y la capa «Se repite» tampoco lo
  dibuja. La marca se escribe ANTES de programar. Dos pasadas a la vez, igual: índice único (`workspace_id, serie_de, inicio`); la
  segunda choca, borra su copia y no programa.
- ⚠️ **Una vez de una serie NO lleva regla** (A2): su «Repetir» decía «No se repite» y, al elegir otra, armaba una segunda serie con la
  misma cuenta, archivo y hora: dos posts por día, para siempre. `guardarRepeticion` lo rechaza, la base también
  (`calendario_eventos_vez_sin_regla`), y la pantalla muestra «se cambia en la primera» con el link al molde.
- ⚠️ **La regla se CONFIRMA y pide el molde completo, TEXTO incluido** (M5): el Select guardaba al tocarlo y un borrador sin el pie
  salía así cada día. Lo que ya nació (hasta dos días) sale como está: un cambio en el molde vale para las que nazcan después, y
  sacar la regla no cancela las ya programadas. La pantalla lo dice; no se automatizó.
- ⚠️ **El «Deshacer» devuelve el lugar en la serie** (re-verificación del 29/10, N1 y N8). `restaurarEvento` insertaba sólo las
  columnas de `COLS`, y `serie_de` no está ahí (no puede: sin la 0349, PostgREST rechazaría la lectura entera). Una vez borrada y
  devuelta volvía SUELTA: «Repetir» decía «No se repite», `guardarRepeticion` la aceptaba y el check de la base tampoco la frenaba
  (`serie_de` era null): dos series, dos posts por día. **El A2 estaba arreglado y se reabría por otra puerta.** Ahora `borrarEvento`
  lee aparte su `serie_de` y su `repetir_hasta` (`EventoBorrado.serie`) y el Deshacer los escribe EN el insert, validados (lo manda el
  navegador): el molde tiene que ser un evento del negocio; si ya no está, la vez vuelve suelta (su serie se borró); si no se puede
  leer, el Deshacer tira. El molde devuelto trae su marca y NO su regla (se vuelve a poner con su confirmación). **Regla:** una columna
  que guarda una identidad (de qué serie es, hasta dónde se atendió) entra al Deshacer aunque no sea de las de `COLS`.
- ⚠️ **Un 409 de Zernio no se comparte entre dos publicaciones** (M6, sospecha sin medir): el 409 es «el mismo contenido en 24 h» y
  devuelve el post que ya estaba. Las veces iguales de una serie se programan juntas: si el post ya es de OTRA publicación, ésta queda
  en `fallo` con su motivo, en vez de quedarse con el mismo `post_id` (una sola salía, y cancelar una cancelaba la de las otras).
- ⚠️ **Lo que se dibuja es desde AHORA:** la primera versión dibujaba como «próximas» las veces de la semana que ya habían pasado sin
  nacer, que no iban a salir nunca. Las próximas van en la capa «Se repite», de SÓLO LECTURA (`fuente: 'plan'`, como las recurrentes
  del Plan), y llevan al molde con `?evento=`.
- ⚠️ **Sin la mig 0349 el Calendario sigue andando:** la regla se lee y se escribe APARTE (`COLS` no la nombra; un test lo fija). Si
  la lectura principal pidiera `repetir`, PostgREST rechazaba la consulta ENTERA y el Calendario quedaba vacío hasta la migración.
- **Sin hacer:** «Personalizado…» (sólo los presets del Plan: todos los días, cada semana, cada mes, cada año, días laborables; una
  regla puesta por la API se muestra igual); cambiar UNA vez sin tocar el molde (cada vez es una Publicación normal: se edita como
  cualquiera); avisar en el Calendario que un molde está incompleto (hoy sólo lo cuenta el log del cron); corregir el molde y que se
  corrijan las ya programadas; cancelar las programadas al sacar la regla o borrar el molde; reintentar una vez cuyo «Programar»
  falló (B5); `rutaValida` como segunda red al copiar el archivo del molde (B6); avisar al BORRAR el molde que lo ya programado sale
  igual (N7: el aviso está sólo en «Que no se repita»). ⚠️ **Sin medir (N2):** si el 409 de Zernio es por contenido, una serie diaria
  que programa 2 o 3 veces iguales juntas sale una de cada tres y las otras quedan en `fallo` para siempre (no se reintentan): se
  publica de MENOS, nunca de más. Medirlo con Zernio real antes de prometer «todos los días». **La mig 0349 está escrita, NO aplicada** (la pide el
  Cerebro; se le sumaron `repetir_hasta` y `calendario_eventos_vez_sin_regla` el 29/10 a la noche, antes de aplicarla). No se vio
  en un navegador.

## Las publicaciones que se repiten: una vez borrada renace, y una copia puede abrir otra serie (29/10/2026, Integración)

> **Estado (29/10 noche):** arreglado en `zernio-token-2910` (`a745e4eb3`): `repetir_hasta` en el molde, ninguna regla en una vez
> (también en la base), confirmación y texto obligatorio, y el 409 que no se comparte. Ver la entrada de las repetidas, arriba.
> La 0349 cambió (todavía NO aplicada).

La misma revisión (`ce56bd693`, `lib/calendario-recurrentes.ts`) encontró dos ALTA que sólo corren con la mig 0349 aplicada. Por
eso **la 0349 no se aplica, aunque Martín diga que sí, hasta que estén arregladas** (lo acordó el Cerebro el 29/10).

- ⚠️ **Contar las veces por las filas que existen hace renacer la que se borró.**
  - Si la persona borra la de mañana, el cron la vuelve a crear y la programa en menos de 6 h.
  - Si la mueve al sábado, salen las dos.
  - **Regla:** la serie recuerda qué veces ya nacieron, aunque la fila no esté.
- ⚠️ **«Repetir» en una copia (`serie_de` lleno) arma una segunda serie: dos posts por día.** `guardarRepeticion` no mira
  `serie_de`, y la pantalla ofrece «Repetir» en cualquier Publicación.
- **Medias:**
  - La regla se guarda al tocar el Select, sin confirmar.
  - Un molde sin texto se programa igual.
  - Corregir, sacarle la regla o borrar el molde no cambia las hasta 3 veces ya nacidas.
  - Sospecha, sin medir: si Zernio contesta 409 por contenido repetido, todas las veces quedan con el mismo post, y cancelar una
    cancela las otras (`lib/zernio-publicar.ts`).
- **La re-verificación de `da3cff9f7`** (Integración, 30/10, `C:/dev/revisiones/2910-reverificacion-zernio-leads-da3cff9f7.md`, con
  pruebas en `2910-reverif-zernio-pruebas/`) dio «entra con bajas»: A1, A2, M5 y M6 están y funcionan. **La 0349 sigue sin
  aplicarse** por esto:
  - ⚠️ **N1: el A2 vuelve por «Deshacer».** Al deshacer el borrado de una vez de la serie, `restaurarEvento`
    (`lib/calendario.ts`) la devuelve sin `serie_de`. «Repetir» la acepta, el check de la base no la frena, y salen dos posts
    por día. **Regla:** lo que restaura una fila restaura TODAS sus columnas, no las que conocía cuando se escribió.
  - **N8:** el «Deshacer» del molde puede hacer renacer veces borradas.
  - **N7:** borrar el molde no avisa que lo ya programado sale igual.
  - **N2 (sospecha):** un 409 de Zernio por contenido publica DE MENOS en una serie diaria. Nunca publica dos veces.

| El desplegable de seis vistas y las vistas **Año** (no dibujaba eventos) y **4 días** | un selector: Día · Semana · Mes · Agenda · Llamadas (con «Calendario \ | Llamadas», que era otro control). `?vista=anio` abre el Mes y `4dias`, la Semana |

## MaKo toma la iniciativa en el Calendario: sin Google, una guía más al entrar son dos (5/11/2026)

**Lo que se hizo (T9 de docs/mako-iniciativa/plan.md):** con Google conectado y `cal_semana` pendiente, la estrella pregunta
«¿Tienes alguna llamada esta semana?» (lib/aperturas/calendario.ts); «Sí, tengo una» abre `AgendarLlamada`, la misma alta del «+»
de Ventas, que anotada ahí cierra `cal_semana`. La guía (app/calendario/guia-calendario.ts) señala el «+» de una llamada, la
leyenda de los usos, las vistas y «Hoy».

**Trampas:**
- **Sin Google ya salta el modal de conectar** (pedido de Martín): la apertura no suma nada ahí, y la guía espera al onboarding de
  la tab (`onboardingPendiente`). Dos guías al entrar son la pantalla que se rechaza.
- **El estado de la tab se pasa como DATO o null**: con `getEstadoTab` caído, MaKo calla y la guía espera; nunca se lee como
  «primera semana sin estrenar».
- Las anclas del «+» se ponen sólo al uso que crea una llamada (`u.crea === 'llamada'`): los cuatro «+» son el mismo botón mapeado.

**Vive en:** lib/aperturas/calendario.ts, app/calendario/guia-calendario.ts, app/calendario/CalendarioApp.tsx,
app/calendario/page.tsx. Lo fija tests/iniciativa-calendario.test.ts.

