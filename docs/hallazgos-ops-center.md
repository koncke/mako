# Hallazgos — Ops Center (los coaches y sus referentes)

La casa de varios chats: el central y el Funnel Coach (desde el 4/11/2026, el único coach: la oferta y el funnel). Quién aconseja de qué está en
`lib/asesores/catalogo.ts`, su ficha destilada en `lib/asesores/fichas.ts`, la caricatura en
`public/asesores/<id>.png` y se elige tocando la criatura, en `app/second-brain/ElegirReferente.tsx`.
Acá va lo que costó y no se deduce leyendo el código.

---

## La lista de grupos no miraba la pestaña (ticket #55, 4/11/2026)

**Síntoma:** el administrador de una agencia, parado en la cuenta de un cliente, veía en la lista los grupos de todos sus otros clientes, y lo reportó como «no debería verse».
**Causa:** `gruposDeLaPersona` (`lib/grupo-puerta.ts`) usaba la pestaña sólo para el super admin. A quien no lo es le sumaba su negocio, su cartera aprobada y sus invitaciones, estuviera en la pestaña que estuviera.
**El diagnóstico obvio era el equivocado:** sonaba a fuga entre clientes, y no lo era. La clienta ve sólo el suyo y sus invitaciones, y quien veía los demás ya tenía acceso a cada uno: la puerta (`accesoAlGrupo`) estaba bien. Lo que fallaba era la LISTA, no el permiso.
**La regla que queda:** una lista que la persona ve parada en la cuenta de otro negocio muestra lo de ESE negocio, aunque tenga acceso a más. Tener acceso y mostrarlo son dos preguntas. En su propio negocio se sigue viendo todo, porque Martín quiere que el equipo de la agencia pueda estar pendiente.
**Vive en:** `lib/grupo-puerta.ts` → `gruposDeLaPersona`; lo fija `tests/grupos-ops-lista-cartera.test.ts`, con la ruta real y la pestaña puesta con `runWithWorkspace`.

---

## El grupo de la app, llevado a main (4/11/2026)

La rama (`rescate/grupos-ops-0311`) estaba 387 commits detrás de main, y main había tocado justo el turno del grupo: la cita (#40), Google Calendar (#42), el bot 1 a 1, la regla de no escribirle primero a nadie y el freno anti-ban. Se rearmó con cherry-pick de sus cuatro commits en `punta/grupos-app`. Lo vivido en una sesión de la nube, sin la base ni la app: con tests y el `tsc` entero.

**La guarda frenó lo que tenía que frenar, y fue lo único que lo vio.** `tests/grupos-ops-guarda.test.ts` fija la lista de bloques del system del turno: al mezclar dio rojo con `ctxGoogle` (si el negocio tiene su Google Calendar conectado) y con `vozDelCanal` (la voz del chat de a dos, dos constantes). `ctxGoogle` va vacío con `hayInvitado`, y `ctxCita` sólo en la rama de quien administra. **Una semilla nueva, porque la guarda de fuente no prueba que no llegue:** el pedido de las semillas del test del turno nombra Google Calendar, y «GOOGLE CALENDAR:» le llega a quien administra y no al invitado. Rompiéndolo, rojo en las dos.

**Un archivo nuevo de main le pega a `/message/send`, y no es un grupo:** `lib/mako-salida-drivers.ts`, la cañería del bot 1 a 1. La guarda de las copias lo marcó. La excepción va escrita con su porqué, y un test fija lo que la sostiene: la puerta de `lib/mako-salida.ts` (`salidaPara`) corta todo jid de grupo antes de mirar nada, y nadie más importa la cañería. Sin ese test, la excepción sería una frase.

**La regla 1 de main y lo de la app no chocan, por la forma de la clave.** `reaccionarMensaje` ganó en main «a una persona, sólo si escribió»: lo de la app va primero (no toca Evolution) y la regla después. `app<ws>@g.us` termina en `@g.us`, así que los envoltorios del doer (`enviarAGrupoJid`, `reaccionarMensaje`) la mandan a lib/mako-grupo.ts y nunca a lib/mako-salida.ts, y el freno de la línea vive en `ev()`, por donde pasa todo envío a Evolution.

**Lo obvio era el equivocado en el cron de huérfanos.** El choque se veía como «la rama refactorizó el bucle en `atenderLaColaDelCron`, main no»: quedarse con el lado de la rama compilaba y perdía dos cosas que main sumó en esas mismas líneas, el chat 1 a 1 (`huerfanoDelChat`) y la cita del lote (`conLaCitaDelLote`). Se pasaron a mano. **Regla:** en un choque donde un lado mueve un bloque a una función, se compara lo que el otro lado le agregó al bloque de antes, línea por línea.

**Los tres que habían quedado abiertos, hechos (con su escena o su prueba, rompiéndolos):**
- La respuesta al equipo escrita en la app ya no le llega a MaKo cuando falla el autollamado o cuando otra persona escribe en la misma ventana: `sinLasDelEquipo` (lib/mako-doer-in.ts) la aparta en el lote y en el cron, con la regla de `bufferearYResponder` y sin avisar dos veces (lee `CLAVE_RESPUESTAS_AVISADAS`).
- Un invitado ya no cuenta como no leídos los avisos a la agencia que no ve: `resumenParaLaLista` (lib/grupo-app.ts) los resta con los mismos filtros (`avisosParaAgencia`, lib/avisos-catalogo.ts).
- Borrar un negocio se lleva `archivero/grupos/<ws>/` (`CARPETAS_APARTE`, lib/reset-workspace.ts).

**Quien no tiene cuenta ahora se entera, y entra al ENTRAR, no al crear la cuenta** (el pedido de Joan, que el Cerebro pasó como LA prioridad). `invitarAlGrupo` avisaba sólo `if (usuario)`: a Juanfran sin cuenta lo anotaba callado y nunca entraba. Ahora le llega el mail («Ana te invitó a su grupo de MaKo…», con el link al grupo), con el mismo tope de 24 h por negocio y email, y la respuesta en pantalla sigue idéntica. **La decisión de dónde atarlo:** la revisión había dejado escrito «una cuenta creada después no entra sola: no consta que el email esté verificado», y era cierto: crear una cuenta lo hace un admin tipeando un email. Lo que sí prueba que el email es suyo es ENTRAR (el link del mail, Google o su contraseña), así que se ata en `registrarLogin` (`atarInvitacionesAlEntrar`, lib/grupo-invitaciones.ts), que corren los cuatro caminos de entrada. El test del recorrido lo fija en los dos sentidos: con la cuenta creada y sin entrar, 404; al entrar, el grupo.

**El recorrido de Joan, eslabón por eslabón** (`tests/grupos-ops-recorrido.test.ts`, con las rutas, la puerta, la copia, el turno y el login reales): abrir → invitar → push y mail con el link → el link en el teléfono cae en `/m/second-brain?grupo=` → leer → escribir y que MaKo conteste sin tocar WhatsApp → recibir un aviso → salir. Cuatro roturas, cuatro rojos.

**Trampas de esta tanda:**
- Con el node 22 de la nube, unos 40 archivos dan «test failed» sin un caso (el enlazador de módulos ES no encuentra `MAKO_ACCION_TOOLS`), también sobre main. Ya estaba escrito en docs/hallazgos-infra.md: los tests van con `/opt/node24/bin`, el de CI.
- `tests/agenda-sin-ia.test.ts` prohíbe la palabra `apartadas` en lib/mako-doer-in.ts (era el nombre de un ruteo que se sacó): una variable local con ese nombre lo puso rojo. Se renombró la variable.
- **lib/usuarios.ts no puede importar lib/grupo-app.ts**, ni con un `import()` dinámico: lo llaman las rutas del login y de la sesión, y grupo-app llega a una IA por el grafo de imports. `tests/d6b-rutas.test.ts` lo frenó («auth/me no le pide nada a una IA»), con doce rutas de golpe. Lo que corre al entrar vive en lib/grupo-invitaciones.ts, que sólo importa la base.
- Main sumó el 4/11 la cuenta de revisión de las tiendas: toda ruta nueva que escribe se clasifica (`tests/cuenta-revision-escrituras.snapshot.txt`). Las del grupo quedan cortadas para esa cuenta: invitar le manda mails a terceros.

**Lo que sigue sin hacer:** todo lo de abajo que no está en esta lista, y sin mirar en producción. Cómo se prueba, en docs/relevo/nube-grupos.md.

---

## El grupo de la app: lo que encontró la revisión, con todo en verde (4/11/2026)

98 y 41 roturas probadas, 398 tests en verde, y una lectura del código encontró cuatro fallas, y una quinta en el eco (docs/hallazgos-comunicacion.md), con la app funcionando. Ninguna daba error. Todas salieron de preguntarse qué camino NO recorre ningún test, y todas se vieron en rojo antes de arreglarlas.

**La respuesta al equipo: MaKo saltaba a los 2 minutos, y el test del turno daba verde.** Síntoma: alguien contesta en la app a una pregunta del equipo; le llega al equipo; 2 minutos después MaKo le contesta como si fuera para ella. Es exactamente el reclamo de Martín del 28/10 («Leila respondió al desarrollador y MaKo saltó a decirle cualquier cosa»), de vuelta. Causa: los `return` tempranos de `bufferearYResponder` se escribieron cuando «cortar antes» quería decir «no entró a la cola»: en WhatsApp van antes de `encolar`. En la app la ruta ya encoló (`yaEnCola`), y la fila quedaba `pendiente` hasta que `flushHuerfanos` corría un turno sobre ella. **Por qué no se veía:** las escenas miran lo que pasa al responder, y el cron no corre solo. **Regla:** todo corte antes del turno en `bufferearYResponder` llama a `sacarDeLaCola`.

**Dos puertas al ticket, y se había cerrado una.** El arreglo «un invitado no entra por la vía libre» estaba en `abrirTicketDelGrupo`. Pero el «[[no-pude]]» abre su ticket por `ticketDeNoPude`, que entra como `automatico`: «Hola Martin, desde ayer ya no carga el CRM» de un invitado salía `en_curso`, directo al arreglo, con el texto de alguien de otro negocio. Y `[[ya-pedido: #N]]` le sumaba su texto a un ticket abierto del negocio, porque el turno leía los tickets aunque no fueran al system. **Lo obvio era el equivocado:** buscar quién llama a `crearTicket` desde el turno no alcanza con mirar `abrirTicketDelGrupo`; hay tres caminos. Hoy `crearTicket({ invitado })` corta en los dos, y con invitado no se leen los tickets.

**«Hay que invitarlo de nuevo» contestaba ok y no hacía nada.** (Desde el 4/11 entra sola al entrar con ese email: arriba, «llevado a main».) Una cuenta creada después no entraba sola, y la pantalla y la API dicen que se la vuelva a invitar; pero con la fila ya anotada sin cuenta, `invitarAlGrupo` veía «ya está» y volvía. Es el caso de Joan y Juanfran si todavía no tienen cuenta. **El test lo escondía:** la escena de `cris@cerrada.test` sacaba a la persona antes de volver a invitarla, sin decir por qué. Un paso raro en un test para llegar a un estado suele ser un bug documentado con el arreglo por fuera.

**Varias fotos con el pedido en la primera: 3 minutos, y mirando una sola.** Sólo la primera nombra a MaKo, así que las otras no entraban a la cola; el `sigue` hacía que la primera no disparara y la última no estaba encolada, así que nadie disparaba. Lo levantaba el cron. El test de `sigue` usaba dos textos. Hoy la foto de quien tiene un pedido suyo en la cola de hace menos de un minuto es de ese pedido (`sigueSuPedido`); lo de otra persona no cuenta.

**Trampas de esta revisión:**
- El tope por minuto vive en memoria y dura todo el proceso del hijo: en una escena larga, la misma persona da 429 y el test pasa sin probar nada. Una persona propia por escena, y se afirma el estado de cada POST.
- Las filas de una escena anterior siguen en la cola, porque ahí el cron no corre: con «lo que esta persona tiene en la cola» cambiando una decisión, hay que vaciarla.
- `ctxGoogle` y `ctxCita` ya están en `tren-0311` y no estaban cuando se escribió lo del invitado. Por eso `tests/grupos-ops-guarda.test.ts` fija la lista de bloques del system del turno: al mezclar dio rojo a propósito, y se resolvió así (arriba, «llevado a main»). Un bloque nuevo que le cuente algo del negocio a un invitado no lo atrapa ninguna semilla: nadie la sembró.

**Lo que quedó sin hacer**, con el archivo donde vive:
- ~~La respuesta al equipo que entra a un lote ajeno, o cuyo autollamado falló, llega a MaKo~~: hecho el 4/11 (`sinLasDelEquipo`, arriba).
- ~~Un invitado cuenta como no leídos los avisos a la agencia que no ve~~: hecho el 4/11 (arriba).
- Atar el id de WhatsApp a la copia va por posición: una parte vacía de una tarjeta corre los ids (`emitirAviso`, lib/avisos.ts, y lib/probar-grupo-envio.ts). El eco por texto lo cubre casi siempre.
- El push del espejo corre adentro del webhook (`espejarUno`, lib/grupo-espejo.ts): con muchos miembros suscriptos demora la respuesta a Evolution. Hoy `push_suscripciones` estaba en 0.
- El autollamado se aborta a los 5 s (`dispararTurno`, app/api/grupos/[ws]/mensajes/route.ts): sin comprobar en Vercel si, en un arranque en frío, la función llamada sigue corriendo. Si no sigue, lo levanta el cron a los 2 o 3 minutos.

---

## El grupo de la app: lo que cuesta y no se ve leyendo el código (3/11/2026)

Martín, tras el ban de la línea de MaKo: un grupo por negocio adentro del Ops Center, fijado arriba, con invitados de otros negocios y MaKo igual que en WhatsApp. El servidor vive en `lib/grupo-*.ts` y `app/api/grupos/`.

**El diagnóstico obvio era el equivocado: «un invitado corre sin herramientas» NO alcanza.** Sacando `tools`, el turno seguía llevando en el system el perfil del negocio (siempre), los objetivos con USD vendidos y cobrados (con `pensar`), los tickets de cualquiera, las pendientes, 7 días de charla y 12 turnos de historial anteriores a que entrara: MaKo le contaba la plata a alguien de otro negocio, con la única barrera de una frase del prompt. Hoy, con `hayInvitado`: `buildSystemPrompt` en `lean` (el de la red), sin historial, sin pendientes, sin `conMemoria` salvo quién escribe. ⚠️ `baseDelSystem === base` da **true** con las dos `lean`: la condición de `conMemoria` no se puede apoyar en eso. El test compara contra un **control**: las mismas semillas, con quien administra, SÍ llegan al modelo; sin el control, un test de «no llegó» da verde si la semilla está mal puesta.

**Pasar el actor a email abrió la vía libre sin que nadie lo tocara.** `identidadDe` da el `rol` de la persona en SU negocio: un admin de otro negocio, invitado al ws10, pasaba `conPermisoEnElNegocio`, y `reglaDelNegocio` mira sólo el ws, así que su ticket nacía `en_curso` con el «hazlo» para el Runner. Por WhatsApp no pasaba porque un teléfono ajeno da `usuarioId` null. Con `invitado`, lo decide Martín, siempre, y sin turno de acción (`esAccionIA` false): sin herramientas, todo pedido se habría delegado.

**La identidad va en `participant` (`<email>#<m|i>@app.mako`) y no en un campo nuevo**, porque los dos sintéticos del lote ya lo copian: un campo nuevo se pierde en todo lote (ya pasó). ⚠️ `EMAIL_RE` acepta `#`: se lee sólo con la regex anclada al final (`leerParticipanteDeApp`), y **la letra se vuelve a calcular contra la base al armar el lote y en el cron**: el `payload` es de cuando se escribió, y un invitado sacado mientras esperaba correría con todo. `#m` sólo con prueba positiva leída sin error; cualquier otra cosa, `#i`.

**El turno corre en OTRA invocación (`/api/cron/grupo-turno`), sin la sesión.** Se diseñó para correr sin cookies. Adentro del POST, `getUsuarioActual` y `adminDeWorkspaceActual` verían a quien escribió: `cobros.run` trataría el turno como del Super Admin, y un admin de OTRO negocio pasaría `adminDeWorkspaceActual` sobre este ws. La ruta encola y responde; si el autollamado falla, lo levanta `doer-flush`. **Y `encolar` usa `getTenantDb`: va adentro de `runWithWorkspace(ws)`**, o la cola de un invitado cae en SU negocio y el cron corre el turno con SUS datos, contestando en el hilo del otro. Sin ningún error.

**`app<ws>@g.us` termina en `@g.us` A PROPÓSITO.** `enElGrupo`, `SOLO_GRUPOS` del vigía y los `endsWith('@g.us')` lo tratan como grupo: con otra forma, la regla del «sí» de plata se apaga callada. No empieza con `app:` porque `canalDeClave` daría 'app', y con `canal: 'app'` `rechazoSiNoEsConfirmacionPura` no corre: un «ok, esperá» ejecutaría plata. `ctx.canal` y `tickets.canal` siguen en 'whatsapp' y es el punto. Sin poder leer el jid, no se encola: otra clave sería otra cola, otro candado y otras pendientes de un negocio que sí tiene grupo.

**Una cola con el `sí` cruzado tiene dos peligros que no se parecen.** Lo propuesto en WhatsApp se puede confirmar desde la app (ve el grupo). Lo propuesto SÓLO en la app no se confirma por WhatsApp: sin `__soloApp`, el «dale» de Pedro a otra persona ejecutaba un mail que nadie de ahí vio pedir. La memoria sigue compartida por jid: un turno de WhatsApp puede citar lo escrito en la app. Es el costo del «sí» cruzado, y queda para decidir.

**Un candado de 150 s no aguanta un turno de 275.** La fila sigue `pendiente` hasta el final: el mensaje siguiente ganaba el candado vencido, la cola traía el pedido de antes, y MaKo contestaba dos veces y podía repetir lo que hacía. Existía en WhatsApp; con personas charlando es lo normal. `renovarCandado`. Y quien pierde el candado se iba callado: quedaba 2 o 3 minutos sin respuesta hasta el cron (la otra vuelta en `bufferearYResponder`). ⚠️ En un arnés con PostgREST de mentira, `mako_doer_lock` necesita su único: sin él, el insert de `reclamar` deja otra fila libre y cualquiera gana el candado, y el test lo lee como un bug del candado.

**`next/server` `after` en un test.** Tira fuera de un pedido, así que `lib/grupo-app.ts` cae en línea; el arnés lo cambia por una cola que corre al final: si la escena no la vacía, lo de una escena corre en la siguiente, y los mensajes «de más» parecen un bug del doer.

**Una base colgada y un timer `unref`:** node sale con código 0 y sin imprimir nada si lo único vivo es un `setTimeout` con `unref`. El hijo «terminó bien» sin resultado. Con un intervalo vivo en la escena, se ve.

**Tres pruebas verdes que no probaban nada, y salieron a la luz sólo rompiendo.** El PostgREST de mentira del arnés deja pasar un NULL en `neq` suelto (el de verdad no): sacarle el `or(usuario_id.is.null,…)` al conteo de no leídos daba verde, y por eso se afirma sobre el fuente. El push corta en la primera frase, y un link se corta en su propio punto: «no dice el dominio» era una aserción vacía; se afirma con un texto donde el link queda antes del corte. «@MaKo sí» ya confirmaba por `confirmacionPura` sin que se sacara la mención: lo que cambia sacándola es el clasificador, así que se prueba en las reglas. La regla que queda: una rotura que no da rojo es un dato sobre el TEST, no sobre el código.

**La burbuja de otra persona, con una cita, se iba por la izquierda (a 390 px, no en la computadora).** La cita va en un renglón (`nowrap`): sin tope, la burbuja toma el ancho de la frase entera. Es el bug del 18/10 de `.co-yo`, y una fila nueva lo vuelve a tener: `.co-otro .co-burbuja, .ch-plegable { max-width: 100% }` (app/_chat/grupo/grupo.css). **Regla:** toda fila nueva del hilo con burbuja lleva ese tope. Sólo se vio en una foto a 390: ni los tipos ni los tests lo agarran.

**`ReaccionWA` es un botón que quita la reacción.** Para la de MaKo en un grupo sería mentira (no es de quien la toca), así que la de MaKo es un `span` con `co-wa__reaccion--de-mako`. Y el menú mínimo de `HiloMako` (`MenuDelMensaje`) no abre con el dedo: en el teléfono no había ni Copiar. El grupo monta el de la casa (`MenuMensajeWA`) con `sinReacciones`.

**`ChatsM` corta con «Conecta un Runner» si no hay chats de Claude Code**, ANTES de la lista: el grupo no se dibujaba. No depende de un Runner, así que va también en esa rama.

**El `Reintentar` quedaba tapado por la caja:** va debajo del globo y aparece después de bajar. `useSeguirElHilo` también baja cuando sube `conError`.

**Lo que quedó sin hacer**, con el archivo donde vive:
- SIN MIRAR EN LA APP DE VERDAD: las pantallas se vieron en el arnés, con sesión y base de mentira. Faltan la sesión de un invitado real (`requireMovil`, y Joan y Juanfran: si comparten fila en `usuarios` no se puede invitar a los dos), el push tocado en un Android y el `?ws=` de `WsFetch` contra las rutas del grupo. La migración 0372 sin aplicar da «No pude abrir el grupo», no un error.
- La foto del autor: `MensajeDelHilo` no la trae, así que lo de otra persona va con su inicial (`FilaDeOtro`). Participantes sí la dibuja.
- Reacciones, fijar, destacar y eliminar en un grupo: se guardan por persona y nadie más las vería. Fuera de esta versión (`SIN_EN_EL_MENU`, app/_chat/grupo/HiloDelGrupo.tsx).
- Los sondeos (4 s el hilo, 15 s la lista) son criterio, sin medir con carga (`MS_HILO_DEL_GRUPO`, `MS_LISTA_DE_GRUPOS`).
- La memoria no se muda: si un negocio sin grupo crea uno, la clave pasa de `app<ws>@g.us` al jid y la memoria y las pendientes quedan atrás (`claveDeConversacion`). El hilo visible no se pierde.
- `misTickets` filtra por ws + email: el ticket de un invitado no aparece en SU /tickets (`lib/tickets-db.ts`).
- «vino por WhatsApp» en Pendientes: `canalDeClave` da whatsapp para la clave de la app, y eso es lo que mantiene las confirmaciones.
- ~~Los archivos de `grupos/<ws>/` no se borran del bucket al borrar un negocio~~: hecho el 4/11 (arriba).
- `esAcuse` usa `includes`: «el book» corta las insistencias de quien administra. Se usa igual que hoy, y en un chat de personas se va a notar más (`lib/flujos-tipos.ts`).

---

## Dos fotos parecidas dan dos muñecos IDÉNTICOS, y el estilo no es el culpable (1/11/2026)

**El síntoma.** Las caricaturas de Marcos Razzetti y Víctor Heras salieron indistinguibles. Martín:
«entre marcos razzetti y victor heras no hay diferencia».

**El diagnóstico obvio era el equivocado.** Parecía el prompt, o el estilo. No: **las dos fotos de
origen son casi la misma foto** — los dos morochos de treinta y pico, barba corta, saco azul marino,
fondo neutro, misma pose. Y el estilo de figurita encima normaliza la cabeza a una esfera y los ojos a
dos óvalos iguales, así que la identidad queda colgando de tres cosas: pelo, barba y ropa. Cuando esas
tres también coinciden, los dos muñecos son el mismo muñeco.

**La regla que queda: un prompt por persona, que NOMBRE lo que la diferencia.** No un prompt común con
el nombre cambiado. Para cada uno se mira la foto y se escribe qué tiene de propio — volumen y forma del
pelo, borde y densidad de la barba, color de la camisa — **y además se le da un color de fondo propio**:
a 92 px, que es como se ven en la pantalla, el fondo es lo primero que el ojo separa.

**⚠️ Y lo que NO se toca: la forma de la cabeza.** Para separar a Razzetti le puse «cabeza ancha y
redonda» y Martín lo cazó en el acto: «su cara se ensanchó muchísimo». Exagerar el cráneo rompe el
parecido, que es justo lo que la caricatura tiene que conservar. La diferencia va en pelo, barba, ropa y
fondo; nunca en el ancho de la cara.

## El canal que devuelve la búsqueda puede ser OTRA PERSONA (1/11/2026)

Buscar el nombre en `search.list` de YouTube y agarrar el primer resultado trajo a una Sofía Contreras
que no era. Martín: «Esa no es sofia contreras». **Se resuelve por `forHandle`, no por búsqueda**, y se
contrasta con los suscriptores y con lo que el referente hace: `@sofiacontreras` (178 mil, Mastery Haus)
es ella; `@marcosrazzettii` (29,2 mil) es él y no los cuatro homónimos de 1 a 155 suscriptores;
`@derekchamizo` se llama «YouTube Millonario», que no aparece buscando su nombre.
**Antes de dibujar, las fotos se le muestran a Martín en una hoja de contacto.** Un dibujo de la persona
equivocada se descubre recién cuando él pregunta «¿ése quién es?», y para entonces ya se gastó.

## Tres de los catorce usan gorra con marca, y uno una remera con logo (1/11/2026)

Hormozi, Derek Chamizo y Guille Collado posan con gorra de marca; Marc Verdú con una remera con logo.
El prompt pide **explícitamente** gorra y remera LISAS, «no text, no logos, no brand marks anywhere».
Si alguna se regenera, eso no se puede perder: el producto dice «Inspirado en», no reproduce marcas de
nadie.

## Un PNG no parpadea, y los ojos decían el estado del chat (1/11/2026)

Los retratos dibujados a mano tenían `.mun-ojos`: parpadeaban y decían si el chat trabajaba, como la criatura de MaKo. Un PNG no.

**Decidido: una sola cara en todos lados, y el estado por afuera de la foto** (`app/admin/operaciones/Retratos.tsx`): un anillo que late mientras trabaja, y la foto apagada si está cansada o dormida. Flotar sigue. Conservar el SVG para el chat activo era mostrarle a la misma persona dos caras, y una que Martín ya rechazó: por eso se borraron.

**Lo que se pierde, a sabiendas:** el parpadeo. Choca con su regla del 21/10 («las criaturas, siempre, donde sea que estén deben tener su animación de movimiento, y parpadeo»), y si lo extraña, hay que resolverlo con otra imagen, no con otro código.

## El prompt aprobado de las caricaturas no estaba escrito en ningún lado (1/11/2026)

Las catorce caras salieron de ocho vueltas de prueba y error, y el prompt que Martín aprobó quedó
**sólo adentro de las llamadas a la herramienta**: para recuperarlo hubo que rastrear un transcript
de 173 MB. Una caricatura nueva, o regenerar una, sin ese texto empieza de cero las ocho vueltas.
Queda acá, literal. Lo único que cambia por persona es el tramo de «Make him unmistakable».

```
Collectible vinyl toy caricature figure of the man in the reference photo — glossy toy-figurine
look like a Funko/Pop Mart collectible. HEAD AND SHOULDERS ONLY, tightly cropped, centered, facing
forward. Oversized head but keeping HIS OWN face shape — do not widen or round out the face, do not
puff up the cheeks. Eyes NORMAL SIZE and normally proportioned, open and bright, glossy with a small
catchlight — NOT oversized, NOT anime. Make him unmistakable: <PELO · BARBA · ANTEOJOS O GORRA ·
PIEL · GESTO, lo que lo separa de los demás>. Wearing <PRENDA LISA, sin texto ni logo>. Smooth
glossy vinyl surfaces, soft studio product lighting with gentle reflections. Plain <COLOR PROPIO>
background. No text, no logos, no brand marks anywhere.
```

Se genera con la foto de referencia subida (`upload-asset-from-url` → `generate-image` con
`imageReferences`). Las fotos están en el scratchpad de la sesión, en `refs/<id>.jpg`, y la hoja de
contacto que se le muestra a Martín la arma `hoja.py`.

## El nombre del curso es el nombre de la CARPETA, y puede estar mal (1/11/2026)

**El síntoma.** Al sumar seis referentes nuevos, antes de dibujar se buscó a cada uno para sacarle
la foto. Dos no cerraron:

- **«Jaime Jiguera» no existe.** Es **Jaime HIGUERA**, el fundador de E-com Growth Partners. El
  apellido mal escrito venía de la carpeta del curso y ya había entrado al repo en dos lugares más
  (`lib/offer-autores.ts` y `docs/offer-marco.md`), así que se corrigió en los cinco archivos a la
  vez. La pantalla dice «Inspirado en \<completo\>»: un apellido mal escrito se publica con el
  nombre de nadie.
- **«Tino Mossu» sí es él**, aunque la transcripción automática escriba **«Teo»** cada vez que se
  nombra (13 veces contra 7 de «Tino» en las primeras veinte clases, y «Mossu» cero). Suenan casi
  igual en español. Confirmado por fuera del curso: Crónica y Forbes Argentina lo ubican en Merlo,
  CEO de Factor Studios, fundador de «la U del Closer» en diciembre de 2023.

**La regla que queda: el nombre de un referente se verifica CONTRA EL MUNDO antes de dibujarlo, no
contra la carpeta.** Y la transcripción automática no sirve para nombres propios: confirma el
método, no quién lo firma. Es la misma familia de error que la Sofía Contreras equivocada, pero una
capa antes — ahí se dibujó a otra persona; acá se habría publicado a una persona que no existe.

## Cuál de los 130 cursos de Knowledge sirve, y por qué el título engaña (1/11/2026)

**El pedido.** Martín: «hay un montón de cursos que podríamos aprovechar de los que tenemos en
Knowledge... Implementa la mayor cantidad posible que tenga sentido, obviamente, de algunos, por
ejemplo, de trading o de e-commerce o de cosas que no tienen sentido para MaKo, pero el resto sí».

**Lo que hay.** 130 cursos, uno por archivo en `app/conocimientos/curso-<slug>.ts`, con el nombre de
cada clase en `grupo`/`titulo` y la transcripción en `public/cono-tx/<videoId>.json` (9.719
archivos). **Leer los `grupo` de un curso cuesta un segundo y dice de qué se trata de verdad**; las
transcripciones pesan 60-130 KB por clase y sólo hacen falta para destilar la ficha.

**El título miente, y es lo que más tiempo ahorra saber:**

- **«Belikethealgo»** suena a algoritmo y contenido orgánico: sus módulos son *orderblocks*,
  *imbalances*, rango de Asia y sesión de Londres. Es **trading**.
- **«Master Escala 100k»** (186 clases) suena a escalar un negocio: es **dropshipping** con Shopify.
- **«PROGRAMA RAIO»** (201 clases) es *interactive storytelling* para aprender inglés.
- **«DominIA Academy»** (159 clases) no es IA para vender: es ingeniería de automatizaciones con n8n.
- **«Growing Content Specialist»** es para el EMPLEADO que edita, no para el dueño del negocio.

**Dónde se cortó.** MaKo es ticket alto (coaches, agencias, consultorías), así que afuera quedaron
e-commerce, dropshipping, importación, Amazon FBA, trading, inmobiliario, afiliados, canales de
YouTube automatizados, los cursos de herramienta (Canva, CapCut, edición, ChatGPT, HeyGen) y los de
mentalidad. Afuera también los que no tienen autor con nombre (**un referente sin persona no se
puede dibujar ni atribuir**): «Club de Negocios», «MIDAS CONCEPT», los de «Lathos club».
Entraron seis: Felipe Vergara (anuncios), Jaime Higuera (socio de crecimiento), Adrià Solà Pastor
(comunicación), Augusto Bianchi (llamadas de ticket alto), Tino Mossu (objeciones y seguimiento) y
Jordi Seguís (TikTok).

**Un curso puede entrar A MEDIAS, y hay que decirlo en la ficha.** Growth Partner enseña el modelo de
socio (fijo + porcentaje, nicho, oferta, setting, llamada) a clientes de e-commerce: el modelo se
traslada a ticket alto y su catálogo de ofertas de entrada —producto gratis pagando el envío, set de
prueba— no. Va anotado adentro de la ficha, que es donde el chat lo va a leer.

**Y hay cursos que enseñan cosas que MaKo no puede aconsejar.** En Five Stars los alumnos cuentan
que cerraron con plazos de 24 h y cupos inventados; en «La universidad del Closer» la respuesta
universal se formula como «si te puedo GARANTIZAR que…» y se proponen catorce contactos por semana;
en el Instituto de Comunicación se improvisa un estudio de una universidad como ejemplo.
`lib/asesores/contexto.ts` ya prohíbe la escasez inventada y las promesas de ingresos, pero **la
prohibición genérica no alcanza cuando el marco entero se apoya en eso**: cada una lleva su línea
`⚠️ NO SE TRASLADA` con la versión usable.

**El tope de 5.200 caracteres no es decorativo.** `tests/coaches-ops-center.test.ts` lo afirma
porque la ficha entra entera al system del turno. Las seis salieron entre 5.600 y 7.000 y hubo que
recortarlas: primero las citas de clase a una por marco, después viñetas de la cola (CÓMO HABLA,
QUÉ PREGUNTA). **Nunca un marco**: la cola repite el tono que los marcos ya dejan claro.
⚠️ Y el recorte automático de la última viñeta se comió el acento invertido que cierra el template
en dos archivos — el error sale recién al importar, como «Unterminated string literal». Si se
recorta por script, hay que contar los acentos invertidos después.

## Lo que quedó sin hacer

- **La foto de Ximena Fukuda es una toma de escenario** donde la cara es chica: su parecido es el más
  flojo de los catorce. Si aparece una foto de frente, vale regenerarla.
- **No se probaron en la app de verdad:** el anillo y las cuatro caras apagadas se miraron con el `Muneco` real en una página suelta, no en un chat con sesión.

---

## Un grep que no encuentra no significa que no esté: tres errores seguidos por lo mismo (2/11/2026)

**El síntoma.** Tres veces en dos días afirmé que un curso «no está en Knowledge» y las tres veces
estaba. Vilma Núñez, Emilio Puigrredón y Mateo Maffia.

**La causa es siempre la misma, y no es Knowledge: es tratar un grep vacío como un hecho.**
Un grep que no devuelve nada significa «mi patrón no coincidió», nunca «no existe». Las tres formas
que tomó:

1. **Vilma Núñez** — busqué en los `curso-*.ts` y ahí su curso se llama otra cosa. **El mapa
   `TITULO` de `app/conocimientos/catalogo.ts` RENOMBRA**, y es el autoritativo: ahí es
   «Certificación en Marketing Digital potenciada por IA - Vilma Núñez (Convierte Más)».
2. **Emilio Puigrredón** — busqué «Puigrredon» sin tilde. El archivo dice **Puigrredón**.
3. **Mateo Maffia** — busqué «Mafia», que es como lo escribió Martín. El archivo dice **Maffia**,
   con dos efes. Y encima `TITULO` lo renombra a **«BYF»** a secas, sin el nombre.

**La regla que queda:** se busca por **el pedazo más corto e inequívoco del apellido** (`Puig`,
`Maffi`, `Vilma`) y recién después se confirma contra el campo `titulo:` del archivo del curso.
Nunca por el nombre tal como lo escribió quien pidió la tarea, y nunca por el nombre de la carpeta.

**El error espejo, que ya costó dos nombres mal escritos en producción:** sacar el nombre de la
persona del nombre de la carpeta. Así salieron «Jaime Jiguera» (es **Higuera**) y «Jordi Sigues»
(es **Segués**). **El nombre de un ser humano se lee del `titulo:`, nunca de un slug.**

**Vive en:** app/conocimientos/catalogo.ts (el mapa `TITULO`, ~línea 805) · lib/asesores/catalogo.ts

---

## El curso de un gurú: el disco de la función no tiene `public/`, y la pantalla no decide quién contesta (3/11/2026)

**El síntoma que no se veía.** La capa del curso estaba «cableada» y con tests en verde, pero el lector
hacía `readFile(process.cwd()/public/cono-tx/<videoId>.json)` dentro de un `try/catch` que devuelve
`null`. En Vercel la función sólo lleva lo que se IMPORTA (`next.config.ts`, `outputFileTracingIncludes`:
«un readFileSync no es un import»); `public/` lo sirve el CDN. Resultado posible: **cada clase `null`, el
gurú sin curso y ningún error**. Y la otra punta es peor: si el trazado SÍ siguiera la ruta, arrastraría
`public/cono-tx` entero — **187 MB medidos**, contra un tope de 250 MB por función: el deploy roto del 2/11
por otra puerta.

**La regla que queda:** un archivo de `public/` se lee **por HTTP** (`APP_BASE_URL` + la ruta pública,
`lib/cerebro-referente-server.ts`), nunca con `fs` desde una función. Y lo que se lee por red se memoiza
**sólo si llegó**: un curso a medias no se guarda, para que un corte no deje a un gurú vacío hasta el
próximo deploy.

**Quién contesta lo decide la CLAVE de la conversación, no la pantalla.** El chat con un gurú es una
tab con chat propio (`mako-movil:<persona>:referente-<id>`, `lib/chat-mako-reglas.ts`) y el servidor saca
al gurú de esa clave (`app/api/mako/chat/route.ts` → `contextoDelChat`). Si lo dijera la pantalla (como
el Funnel Coach, por `desde.tab`), la misma conversación abierta desde la lista del Ops Center contestaría
como MaKo a secas. ⚠️ Y `origenDeClave` tiene que reconocer la clave nueva: sin origen, `claveDeTab` la
rechaza y la conversación **no se puede escribir**.

**No va en `armar()`**, aunque el tablero lo decía: `armar` es el grafo del NEGOCIO, en caché por
workspace; el referente es de cada CHAT. Colgado ahí, el curso de uno viajaba en el chat de todos.

**Lo que quedó sin hacer:** el #15 (la tab de gurús y el modal que se vio roto) no se tocó.

---

## «No responde con su base»: el turno estaba bien, faltaba el mapa. Probar con UNO no prueba a los 22 (3/11/2026)

**El síntoma.** Martín: «Cuando le escribo a algun guru, aun no me respondo con su base de conocimientos».

**El diagnóstico obvio era el equivocado.** Ya se había arreglado el turno (los tramos del curso en un bloque
propio) y probado con el curso real de Alborna: 41/41 clases. Pero `CURSO_DE_REFERENTE`
(`lib/asesores/cursos.ts`) tenía **3 de los 22 gurús** de la galería. Con los otros 19, Hormozi incluido,
`cursoDe` devolvía `null`: el chat seguía con la ficha, el Second Brain decía «todavía no tiene su curso» y **no
había un solo error**. Se probó con el gurú que justo estaba en el mapa.

**La regla que queda:** lo que se ofrece en una galería se prueba con TODA la galería, no con un ejemplo.
`tests/gurus-ops-center.test.ts` corre el camino real con los 22 (`tests/_gurus-curso-hijo.ts`), y
`tests/asesores-cursos.test.ts` compara el mapa con el encabezado de cada ficha, que dice de qué archivo se
destiló. Sumar un gurú es tres cosas: su ficha, su línea en el mapa y regenerar el índice
(`node scripts/generar-clases-de-referentes.mjs`).

**Lo que pesa cada curso, medido el 3/11:** de 0,08 MB (Puigrredón) a 9,77 MB (Adrià Sola); 45 MB los 22. Marc
Verdú son 452 clases. Por eso la lectura va de a 16 pedidos y el turno espera 12 s: pasado el plazo sigue con la
ficha y la lectura termina por detrás. Contra el CDN real, en frío y desde la PC de Martín: Hormozi 33/33 en 975 ms,
Adrià Sola 158/158 en 2,8 s y Verdú 452/452 en 6,6 s. Elegir los tramos tarda de 6 a 788 ms por turno. Dos clases de Five Stars
y dos de Marca Personal 5.0 no tienen transcripción: un 404 no es un curso «a medias» (rearmarlo era en cada turno).

## La burbuja no tiene dueño si el chat se abre sin la lista (3/11/2026)

**El síntoma.** «El que responde es una criatura de mako, no la foto del guru». La cabecera sí traía su cara.

**La causa.** `HiloDelCliente` dibuja con `k.nombreMuneco` y `k.aspectoMuneco`, que salen de `filaAbierta`, la
fila de la lista. Un chat con `activo: false` (el del gurú, el Funnel Coach) no tiene lista: el aspecto daba
`null` y el nombre «Sin título», y de ahí salía una criatura sorteada. El Funnel Coach con un gurú al frente
tenía el mismo bug y nadie lo había visto. **La regla:** quien abre un chat sin lista le pasa `quien` a
`useChatCliente` (el mismo que usa su saludo); si no, su hilo no sabe quién contesta.

## El gurú no va en `ElegidoChat`, y queda montado (3/11/2026)

`ElegidoChat` es lo elegido en el motor de la PANTALLA; el gurú tiene su propio motor
(`useChatDelReferente.ts`). Sumarle `{ guru }` obligaba a tocar cada `'coach' in e` y no arreglaba nada: lo que
hacía falta era que la fila llamara a `abrirGuru` en vez de buscar una conversación que podía no existir
(`queAbreElOfferCoach`, `lib/chat-mako-reglas.ts`). Como el Funnel Coach, **una vez abierto queda montado y
escondido**: desmontado a mitad de un turno, la respuesta llegaba a nadie.

**El super admin no ve sus chats con gurús en su lista**, que es la de Claude Code (`k` corre con `activo: false`):
por eso `filasOffer` estaba siempre vacío y Hormozi era un clic muerto SIEMPRE para él. Su historial sale de
`?gurusConCharla=1` y va debajo de los coaches, igual para el cliente.

**Trampa de los tests:** `useChatCliente` llega a `lib/auth.ts` (`server-only`) por una server action, que Next
cambia por un puente y node no. Tapando `server-only` en `require.cache` el árbol carga, y el proceso del test
**sale con código 1 sin escribir una línea**, ni el nombre del test que corría: se ve como «test failed» a nivel de
archivo. El motor no se dibuja en un test; se mira su fuente y se dibuja `HiloMako`.

## El grafo de un gurú eran puntos iguales: era la FORMA del grafo, no el dibujo (4/11/2026)

**El síntoma.** Martín: «los nodos son todos iguales, no está bien diseñado como el que ya hicimos, que tienen
diferentes colores, tamaños y que los títulos van apareciendo y desapareciendo por "sección"». Y de la barra lateral:
«están bastante mal organizadas».

**El diagnóstico obvio era el equivocado.** Parecía un problema de `Grafo.tsx`, y el componente es el MISMO que el del
negocio. Lo distinto era el dato: `armarReferente` (`lib/cerebro-referente.ts`) cuelga todas las clases de una raíz, en
UN área y encadenadas. Con un área, todo sale de un color; con todas las clases de grado 3, todas del mismo tamaño
(`radioNodo` tiene piso de 8 hasta grado 6); y sin nodos `n1:`, el grafo no tiene un nivel 1 cuyo título quede de lejos
(`entraPorNivel`). La barra lateral contaba «453 cosas que MaKo sabe · 453 de MaKo · 0 tuyas» con una sola sección.

**El arreglo** (`lib/cerebro-referente-vista.ts`, sobre la misma capa que lee el chat, con los MISMOS ids de clase):
la raíz es el curso, cada módulo es un `n1:` con su color, las clases cuelgan de su módulo, y el tamaño sale de un
`peso` nuevo de `NodoCerebro`: un PISO que leen las dos copias de `gradosDe` (layout y dibujo), así el servidor y el
navegador miden igual. El grafo trae `curso`, y con eso la barra lateral, el filtro (sólo «Módulo»), el buscador (sin
«Buscar con MaKo», que busca en el negocio) y el detalle (sin la pastilla «MaKo») hablan de clases.

**Tres trampas que no se ven leyendo:**
- **El índice de clases tomaba `subtitulo:` por `titulo:`.** La regex suelta del generador encontraba el subtítulo del
  CURSO antes que el título de la primera clase: en 18 de 31 cursos la clase 1 se llamaba «33 clases, 2 módulos. Video,
  transcripción y tus apuntes…», y así la listaba el turno del chat. Ahora se lee bloque por bloque
  (`scripts/generar-clases-de-referentes.mjs`).
- **Un curso de 2 módulos con 32 clases en uno es una estrella**, no secciones (Hormozi). Con menos de 4 módulos se usa
  la sección de adentro (`subgrupo`): Hormozi queda en 8.
- **Unir clases por una palabra del título une cualquier cosa** si la palabra es «vamos», «creando» o el nombre del
  curso: con 452 clases salían 318 uniones y el mapa era una telaraña. Se sacan verbos y palabras vacías, una palabra
  en más del 4 % de los títulos no une, y el mapa tiene techo (clases / 4): Marc Verdú queda en 113.

**El encuadre mide los PUNTOS, no las etiquetas:** un título de sección pegado al borde salía cortado («…HOP
RECORDINGS»). En un curso, `ajustar` (`Grafo.tsx`) deja a los costados la mitad del título de sección más largo. En el
grafo del negocio no se tocó: si pasa ahí, es la misma línea.

**Vive en:** `lib/cerebro-referente-vista.ts` · `app/second-brain/Grafo.tsx` · `app/second-brain/SuSecondBrain.tsx` ·
`scripts/generar-clases-de-referentes.mjs` · `tests/cerebro-referente-vista.test.ts`.

## «Su Second Brain» abría un modal: ahora reemplaza la conversación (4/11/2026)

Martín: «en lugar de "Su Second Brain" que diga "Second Brain de NOMBRE DEL GURU" y que esté alineado a la derecha del
todo... no debe abrirse un modal, sino que debe reemplazar lo que está en el chat... y en el botón... "Volver al chat"».
`PanelDeChat` ganó `reemplazo`: lo que ocupa el lugar del hilo y la caja. **La conversación queda montada y escondida**
(`display: none`), así que al volver sigue donde estaba, con lo escrito en la caja; desmontarla perdía el scroll y el
borrador. El botón es uno (`BotonSecondBrainDe`) y va último en las acciones con `margin-left: auto`: en el Funnel Coach
«Ver el plan» va antes, y abrir uno cierra el otro.

**Vive en:** `app/admin/operaciones/PanelChat.tsx` · `app/second-brain/SuSecondBrain.tsx` · `ChatDelReferente.tsx` ·
`ChatDelCoach.tsx` · `ChatSecondBrain.tsx` · `app/m/second-brain/HojaDelGuru.tsx`.

## Los diez gurús que faltan no tienen caricatura en el repo (4/11/2026)

Martín: «faltan un montón de gurús que nos habían quedado por la mitad que ya habíamos hecho sus caricaturas». Medido:
los 22 retratos de `public/asesores/` ya están TODOS en la galería, y de los diez que faltan (Carrizo, Núñez, Landa,
Fons, Maffia, Begueria, Luque, Doglio, Seré, Albaa) no hay una sola imagen en ninguna rama ni etiqueta del repo
(`git log --all -- '*carrizo*.png'`, y así con cada uno). Las caricaturas se hacen con Canva desde la PC; una sesión en
la nube no tiene Canva. Lo que sí se puede hacer en la nube es su FICHA: queda escrita en `lib/asesores/en-espera.ts`
y el gurú entra a la galería en cuanto llegue su cara (el test lo avisa).

**Resuelto el mismo 4/11:** llegaron las diez caras (la entrada «Las diez caras llegaron», abajo).

## Las diez fichas que esperan cara: cómo se escribieron y qué quedó afuera (4/11/2026)

**Vive en:** `lib/asesores/ficha-*.ts` (las diez nuevas), `lib/asesores/en-espera.ts`, `tests/gurus-en-espera.test.ts`.

- **Un subagente por ficha costó ~480-500 mil tokens cada una** (las tres primeras). Las siete siguientes se escribieron a
  mano leyendo 8 a 12 clases de método por curso, con el índice (`lib/asesores/clases-de-referentes.json`, la clave es el slug
  de `lib/asesores/cursos.ts`) y las transcripciones de `public/cono-tx/<videoId>.json`, salteando el arranque de cada clase
  (los primeros 500-2.500 caracteres son saludo). Las clases que más rinden son las de método; las sesiones de preguntas, las
  entrevistas y las «revisiones de canales» pesan 50-150k y casi no traen marcos.
- **Lo que los cursos enseñan y la ficha no repite** (cada uno en su «⚠️ NO SE TRASLADA»), por si aparece en el próximo:
  escasez o urgencia inventada («la única clase en vivo», «este video se borra en 24 horas», descuentos «sólo hoy»); animar a
  pedir un CRÉDITO para pagar un programa (Maffia); COMPRAR ENLACES, que el curso presenta como lo normal del sector (Fons);
  revisar un anuncio contra las reglas de Meta para que una promesa exagerada pase el filtro (Doglio, «GPT Anti Ban»); los
  sorteos y la «escalera de sí» en un webinar; el precio terminado en 7 como truco (Luque); y en todos, los montos propios
  o de alumnos como expectativa.
- **Una nota de pendientes daba por hecho que Samuel Albaa enseñaba *setter***: el curso («Growing Closer», con Agustín
  Nievas) no tiene ni una clase de setter. Su ficha cubre la práctica del closer, distinta de la de Nievas. Antes de escribir
  la especialidad de un gurú, se lista el temario de SU curso.
- **El voseo del curso no viaja a la ficha**: los cursos argentinos y españoles dicen «vos» y «vosotros»; la ficha va de tú.
  El guard de voseo (`tests/puente-panel-copy.test.ts`) sólo ve los archivos que ESTÁN en el índice de git: con una ficha
  nueva se corre después de `git add -N`, o da verde sin haberla leído. Un título de clase citado tal cual también trae voseo
  («Vendele…»): se cita el módulo o se parafrasea.
- **Nadie más leyó las fichas**: las escribí yo, contra las clases citadas. Martín las puede leer antes de que entren.

## Las diez caras llegaron: de dónde salen las fotos, los tamaños y lo que quedó sin hacer (4/11/2026)

Martín: «en los gurus, me siguen faltando un montón que ya habiamos hecho la miniatura». Las diez caras se hicieron con Canva
y entraron a la galería (22 → 32): fila en `ASESORES`, id en `IdAsesor`, ficha en `FICHAS`, y `EN_ESPERA` quedó vacía.

**De dónde salen las fotos: la foto de perfil del canal público de YouTube de cada uno, sin API ni clave.**
`youtube.com/results?search_query=<nombre>&sp=EgIQAg%253D%253D` (el filtro «Canal») y `youtube.com/<@handle>` traen un
`ytInitialData` con el `avatar` hasta 900 px (`yt3.googleusercontent.com/…=s900-c-k-c0x00ffffff-no-rj`): una URL pública
HTTPS que `upload-asset-from-url` acepta. La búsqueda por nombre devuelve homónimos (de 2 a 5 canales por nombre, con 2 a 150
suscriptores y la foto por defecto): se elige por suscriptores y descripción, y **se mira la foto antes de dibujar**. Los
canales: `@Juan_carrizo` (el de testimonios es el mismo), `@vilmanunez` (el canal se llama «Vilma OS»), `@SamuelAlbaa`,
`@AlvaroLuque`, `@SergioBegueria`, `@RomualdFonsTV`, `@mateomaffia`, `@FranciscoDoglio`, `@InstaCoachAndy`, `@gonzalosere`.
Lo que ata cada canal a SU curso: «The perfect launch - Alvaro Luque» es colombiano y su canal anuncia el evento en
Bucaramanga; el de Samuel nombra «Growing Closers»; los títulos de Doglio, Maffia y Carrizo calzan con ARCADIA, BYF y ATV.
Andy Landa es una MUJER (foto y ficha en femenino): el prompt lleva «woman» y «HER».

**Los tamaños: Canva entrega 200 × 200 aunque el original mida 1264 × 1264, y no hay vuelta.** `get-assets` lo dice
(`metadata` 1264, `thumbnail` 200) y el thumbnail está firmado: cambiarle `width`/`height` da 403 «Signature invalid».
`public/asesores/<id>.png` sale tal cual (52-65 KB, bajo el tope de 150). **Los `grandes/` de estos diez son esos 200 agrandados
a 600 con bicúbica**, no los 1264 reducidos como los de los catorce primeros: en la tarjeta de Spy se ven blandos. Para
rehacerlos con el original hay que exportarlo desde Canva (un diseño con la imagen y `export-design`); los ids de media de
las diez, en la cuenta de Martín: Carrizo `MAHZ9QMgCMA`, Núñez `MAHZ9VmRnOs`, Albaa `MAHZ9RL4xtA`, Luque `MAHZ9dvwzmI`,
Begueria `MAHZ9RFb83U`, Fons `MAHZ9XkypNE`, Maffia `MAHZ9dHCqZc`, Doglio `MAHZ9aZXDhw`, Landa `MAHZ9XMiA54`, Seré `MAHZ9U9vkrc`.

**`get-generate-image-job` devolvió HTTP 409 `{"code":10}` en 6 de 10 al consultarlas todas juntas, y la generación estaba bien:**
al volver a leer, `SUCCESS`. No se regenera por un 409 (sería pagar dos veces).

**Cada una con un fondo que no repite los 22 que ya había** (magenta, cobalto, azul marino, rojo, durazno, naranja, lima,
amarillo, periwinkle, rosa viejo), y con la prenda lisa que pide el prompt: ningún logo salió en las diez. Las diez salieron
a la primera, comparadas una por una con su foto.

**Sin hacer:**
- **¿«Samuel Albaa» o «Samuel Alba»?** Su canal se llama «Samuel Alba | Ventas»; el @ y el Instagram son «samuelalbaa». El repo
  dice «Albaa» (viene de la carpeta del curso, como «Jiguera»). Si es «Alba», «Inspirado en Samuel Albaa» publica un apellido
  mal escrito. No se tocó: el nombre y el id están en 16 archivos (hasta el slug del curso) y no hay cómo confirmarlo desde acá. Se confirma con él o con su sitio.
- **Los `grandes/` a 600 reales** (arriba).
- **No se vieron en la app andando:** se midió con los tests (galería de 32, curso de cada uno, peso y existencia de las dos
  caras). La hoja de contacto se la ve Martín antes que nadie.
- `tests/gurus-en-espera.test.ts` ya no recorre nada (la lista está vacía): su guarda de las fichas (voseo, «no hables como si
  fueras él», «NO SE TRASLADA») pasó a un test sobre las diez que ya están en `FICHAS`.

---

## Juntar dos coaches: lo guardado no distingue «eligió» de «no eligió», y las herramientas propias van DENTRO del presupuesto (4/11/2026)

Martín: «Junta a "Offer coach" con "Funnel Coach", que se quede solo "Funnel coach" y que tenga ambas funcionalidades dentro...
Por defecto, que esté la cara de hormozi». Queda UN coach, el Funnel Coach: primero la oferta, después el funnel, en un chat.

**Qué era el Offer Coach, de verdad (medido leyendo, no supuesto).** No tenía conversación propia: su fila abría el chat con su
GURÚ (`referente-hormozi`, `queAbreElOfferCoach`) y debajo colgaban las conversaciones de la tab Offer (el motor de
/api/offer). Por eso, al juntarlos: las conversaciones de oferta cuelgan del Funnel Coach (computadora y teléfono), y la charla
con Hormozi que alguien tuvo tocando el Offer Coach sale en la lista de gurús, que ya no esconde a nadie (`gurusDeLaBarra`, sin
`delOffer`). Nada se duplica ni se borra. **Nunca hubo una URL del Offer Coach:** la tab /offer es la pantalla de Offer, no el
coach, y se queda (la abren el CRM, las aperturas y links guardados).

**Lo guardado no distingue elegir de no elegir.** Cada elección en un coach guardaba los DOS (`{ ...leerReferentes(), ...pedido }`,
con el otro en su fábrica). Así que `{ funnel: null, offer: 'hormozi' }` es a la vez «eligió MaKo en el Funnel Coach» y «eligió
Hormozi en el Offer Coach». La regla de Martín (`referenteDelCoach`, lib/asesores/catalogo.ts): `funnel` con un referente gana;
si no, `offer` (`null` ahí es una elección de MaKo, porque su fábrica era Hormozi); si no, Hormozi. El caso ambiguo sale Hormozi,
y cuántos negocios quedaron así se mide en producción (docs/relevo/nube-funnel-coach.md). Lo nuevo se guarda como `{ coach }`
AL LADO de lo de antes (`conReferenteElegido`), leyendo estricto: escribe la fila entera.

**Una pista delante de cada mensaje le saca el lugar a las demás herramientas.** El Funnel Coach clasificaba cada mensaje con
«plan del funnel, presupuesto de anuncios, calculadora» delante, para que la calculadora llegara con «1000 dólares». Medido con el
turno real: con la pista, `guardar_oferta` no llegaba ni con «guarda esta oferta», y «crea una landing para mi oferta» perdía
`crear_landing_desde_diseno` (`proponer_presupuesto_campana` se quedaba siempre el primer lugar). Sin la pista, las dos llegan.

**La cura fue hacerlas FIJAS, no otra pista.** `propias` (lib/doer-herramientas.ts): las seis del coach (`HERRAMIENTAS_DEL_COACH`)
entran primero y su peso se DESCUENTA del presupuesto de 12.000; el ranking llena lo que queda. En una pregunta, las que escriben no
viajan y se ofrecen (`ofrecibles`). Juntas pesan 7.806 (3.858 en una pregunta): quedan 4.194 para lo demás en un pedido de hacer.
⚠️ El precio a sabiendas: `proponer_crear_campana` (4.129) no entra después de `proponer_presupuesto_campana` en «crea la campaña con
ese presupuesto»; el coach nombra el Ads Manager. `tests/coaches-ops-center.test.ts` (11 y 11b) frena una herramienta más que no
entre, y una que desaparezca del registro.

**«Hay oferta» también es una oferta ARMADA en una conversación de oferta** (`hayOfertaArmada`, lib/offer-sesiones.ts). Con sólo las
guardadas, quien armó su oferta con el Offer Coach y no tocó «Guardar» leía «Empecemos por tu oferta».

**Lo que no se ve leyendo:**
- Las herramientas de la oferta tienen la puerta de la tab Offer (`gating.tab: 'offer'`); la capa `pm` (lib/capas.ts) no la tiene,
  así que ahí el coach habla de la oferta sin poder guardarla (`propiasDelChat` la saca, no se cae en silencio). No se tocó el gating:
  es una decisión de qué compra cada plan.
- En la nube, el tsc acotado con `lib/doer-herramientas.ts` muere sin memoria con el tope de 2.560 MB (arrastra el registro entero):
  va con `--heap=7000`.
- `tests/funciones-mako.test.ts` (6) ya está rojo en main (`wsEnContexto is not a function` al cargar lib/api-mako/link.ts), y el
  runner de `tests-afectados` en la nube marca tandas rojas «sin el pie del runner» por el `MAKO_ACCION_TOOLS` que node no ve como
  ESM: medido igual en un árbol limpio de main.

**Vive en:** lib/asesores/catalogo.ts · lib/asesores/contexto.ts · lib/funnel-plan-db.ts · lib/doer-herramientas.ts ·
app/api/mako/chat/route.ts · app/second-brain/ChatSecondBrain.tsx · app/second-brain/useChatDelCoach.ts ·
app/m/second-brain/HojaDelCoach.tsx · tests/coaches-ops-center.test.ts
