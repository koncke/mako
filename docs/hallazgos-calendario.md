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
  de Zernio (el mismo contenido en 24 h) es el post que ya estaba, no un error.
- **No medido:** el cuerpo para TikTok y YouTube (`platformSpecificData`, el `title`) sale del código viejo y de la
  documentación, sin una cuenta real. La primera publicación real la confirma el Cerebro antes (es producción).
- **Sin hacer:** el webhook `post.published`/`post.failed` (hoy no se suscribe: el estado se relee sólo cuando alguien abre el
  Calendario); la media que queda en `ig-media` al borrar un evento (el «Deshacer» la necesita; falta barrerla); un evento que
  quedó `programando` porque el server murió entre Zernio y la base (si se reprograma dentro de 24 h, el 409 devuelve el mismo
  post); por WhatsApp no se sube el archivo (la operación programa lo que ya está armado). La clave es la del negocio (`cfg`):
  conectar sin clave de Zernio es el punto 3 del pedido.

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
