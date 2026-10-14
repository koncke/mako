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
- **Google se lee ESTRICTO** (`eventosEntre`, lib/google-calendar.ts): un fallo es `ok: false`, no una lista vacía.
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

## Lo que quedó SIN hacer

- **La «entrega de servicio»** del pedido sale hoy sólo de la agenda de Google (las sesiones de Customer Success son
  grabaciones pasadas, no turnos futuros). Si CS agenda sesiones en MaKo, se suma como capa. Vive en `lib/calendario.ts`.
- **Las sesiones en vivo de la comunidad del curso** (`comunidad_eventos`) no se leen todavía: son otra capa posible.
- **Arrastrar un evento a otro día** no existe: se cambia la fecha en el modal.
- **Publicar** de verdad (que el Reel salga solo) no es de esta tab: el motor de publicar está pausado por Martín
  (relevo de Instagram). El Calendario planea y se tilda «Ya se publicó».
- **Los roles**: la tab es sólo del admin porque dibuja la agenda de Google del negocio. Si un closer tiene que ver
  sus llamadas, hace falta una capa sin Google.
- **MaKo Mobile** no tiene Calendario: en el teléfono se ve la pantalla de escritorio.

**Vive en:** `supabase/migrations/0271_calendario_eventos.sql` · `lib/calendario-modelo.ts` · `lib/calendario.ts` ·
`lib/calendario-ia.ts` · `lib/google-calendar.ts` (`eventosEntre`) · `lib/plan-hoy.ts` (`tableroDelPlan`) ·
`app/calendario/` · `app/api/calendario/ia/route.ts` · `lib/api-mako/areas/calendario.*` ·
`lib/tab-onboarding-catalogo.ts` · `tests/calendario.test.ts`. *13-14/10/2026, claude2.*
