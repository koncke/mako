# Hallazgos de Automations, ex Chatbot (/automations: el flujo con ramas)

Lo que hay que saber antes de tocar el lienzo de /automations (ex /chatbot: la tab se renombró el
09/10/2026 y la ruta vieja redirige), su motor, «Probar» o el conversor de las secuencias de antes.
Las entradas fechadas antes del renombre nombran la ruta como era. El área es dónde vive el código:

- el modelo: `lib/flujo-grafo.ts` y `lib/flujo-legado.ts`;
- el motor: `lib/nutricion.ts`, `lib/nutricion-grafo-motor.ts` y los demás `lib/nutricion-*.ts`;
- el lienzo: `lib/flujo-conversacion.ts`, `lib/lienzo-grafo.ts`, `app/_components/Lienzo.tsx`,
  `app/automations/FlujoLienzo.tsx` y `app/automations/SecuenciaPerfil.tsx`;
- «Probar» y la página: `lib/simulador-grafo.ts`, `lib/prueba-paso.ts`, `app/automations/PanelProbar.tsx`,
  `app/automations/SimuladorWhatsApp.tsx`, `app/automations/ChatAgentApp.tsx` y
  `app/api/chat-agent/simulador/route.ts`;
- la biblioteca de archivos: `lib/setting-adjuntos.ts` y `lib/setting-adjuntos-reglas.ts`.

El composer de WhatsApp (`app/whatsapp/_shared/`), la biblioteca vista desde el bucket y las
etiquetas del teléfono están en [hallazgos-comunicacion.md](hallazgos-comunicacion.md); las
etiquetas del CRM, en [hallazgos-crm.md](hallazgos-crm.md). Lo de antes del rediseño (el modo
asistido, el recordatorio, la reagenda) sigue en hallazgos-comunicacion.md → «Las seis tarjetas
del Chatbot en paralelo». El diseño y el pedido literal de Martín (los doce puntos del
08/10/2026) están en [chatbot-flujo-ramas-diseno.md](chatbot-flujo-ramas-diseno.md).
**No es un changelog.**

*Origen: el rediseño del 08/10/2026, cuenta 2. Cinco partes en paralelo (corrida
`wf_8096a9d7-b3f`: **P** página y «Probar», **C** composer, **L** lienzo, **E** etiquetas, **M**
motor), una revisión adversarial (`wf_c1c0d3d3-ae3`: 43 hallazgos, 42 confirmados, 1 refutado) y
sus arreglos (`wf_92e4c306-856`). Entre corchetes, quién lo vio: la parte, o el id del hallazgo de
la revisión.*

## Tres formas de decirlo y arrancar de a poco, para Black November de Leila (31/10/2026, llamada, punto 5.8)

**El pedido:** el número de Mauricio quedó bloqueado 24 h al pasar de unos 20 a 60 por día con mensajes idénticos, y Leila usaba tres variantes antes de MaKo. **Lo que se creía:** «en MaKo se puede configurar que a algunos les mande uno y a otros otro». **Lo medido:** el motor sí las sortea (`textoDelPaso`), pero nadie podía escribirlas: «↻» sólo aparecía si MaKo ya las había generado al armar el flujo, y en toda la base las tienen 4 tarjetas, todas de Mauricio. La hoja de difusión ni las mandaba. El tope por día era fijo.

**La regla del arranque:** sube cuando un día LLEGÓ a su tope, contando lo que salió de verdad (`subidasDelArranque`, lib/goteo.ts). No por fecha: una pausada que vuelve a las dos semanas saltaba al tope de golpe. **⚠️ Y el diagnóstico obvio, «cuenta los días que mandó», también era el equivocado:** mi primera versión lo hacía, y lo encontró la revisión independiente: una difusión lanzada a las 20:40 mandaba 5 antes de cerrar y al otro día ya podía 40, de 5 a 34 sin pasar por 20. Hasta 2 días sin mandar no corta, para que un horario de lunes a viernes siga el lunes; más que eso, vuelve a empezar. Si no se puede leer, el tope del primer día: manda menos y no se cae la corrida.

**Sólo WhatsApp, aunque el goteo sea «uno para todos los canales».** Lo que se bloquea es el número. Aplicado a todos, frenaba el email de la misma difusión y dejaba gente afuera de su ventana de Instagram: 20 en vez de 40, sin que nadie lo pidiera. Tres días de borradores sin aprobar tampoco calientan un número: cuenta `enviado`, no el `ESTADOS_DEL_GOTEO` del goteo. Un borrador aprobado cuenta en el día que nació (`anotarPasoEnviado` no cambia su `created_at`): aprobar con días de demora puede dejar el tope más bajo, nunca más alto.

**El ↻ se pide, no viene de fábrica (`conVersiones`).** Mostrado en todas las tarjetas, se guardaba y no salía: en el oficial sale la plantilla, en el recordatorio sólo el cuerpo, y en el aviso al grupo el botón no hacía nada. Sólo el WhatsApp por QR lo sortea.

**⚠️ La línea manda.** Leila usa el tope de fábrica, 40 por día y 6 por hora, y desde el 23/10 ese tope no se edita en ninguna pantalla: sólo Mauricio tiene otro guardado (65 y 15). Pedir 60 no llega a 60, y la hoja lo dice. Subírselo es decisión de Martín, y el riesgo es de su número.

**⚠️ Corregir el texto suelta las variantes** (`variantesTrasCambio`, 25/10: el motor sorteaba lo que ya no decía). Con MaKo daba igual; escritas a mano duele, así que se avisa, y «Deshacer» las devuelve ABIERTAS: siguen diciendo lo de antes y se sortearían, así que quedan a la vista. Si se sale de la tarjeta sin el ➤ (`alSalir`), se van sin aviso: el cartel no llega a verse.

**⚠️ Una descripción nueva en la API le saca el lugar a otra operación.** Las del arranque inflaron `configurar_automatizacion`, y «Hacé que la automatización de reactivación salga todos los martes a las 15» dejó de traer `cambiar_crons_secuencia`: el presupuesto de herramientas del chat es fijo. Se arregló achicando lo mío, no subiendo el presupuesto (docs/hallazgos-api-mako.md, «Una operación nueva le saca el lugar…»). **Para saber que era mío hubo que correrlo en una copia limpia de integración:** de 3 rojos del barrido, ése era el único que ahí daba verde.

**Sin hacer:** el arranque es de cada automatización y no de la línea: dos automatizaciones arrancando sobre un número se suman, y sólo las frena su tope. Instagram no tiene el «↻» (`EditorMensajeSocial`), y su riesgo no es éste. Un arranque que tardaría más de 60 días en llegar se rechaza: esa historia se lee en cada corrida. Sin ver en pantalla: el código no está desplegado (punto 10 de docs/relevo/automations.md).

## La automatización de Leila que «siguió hasta las 11 de la noche» (30/10/2026, llamada, punto 1.7)

**Lo medido, no lo supuesto.** «Prospección: apertura», creada de nuestra plantilla el 26/10 a las 15:01 (hora de Cancún, la de ella):
68 mensajes a 68 personas, de los 113 que trajo de un grupo de WhatsApp. **Exactamente el tope de la línea:** tandas de hasta 6, en los
minutos :00 a :02 de cada hora. El 26/10, de 16:00 a 21:01, cortó por el tope de 40 en 24 h (34 suyos + 6 de otra); el 27/10 volvió a
las 17:01, cuando se liberó la ventana, y siguió hasta las 23:01. La última escritura de la fila es de las 23:46: la pausa a mano.
**El horario no falló: no tenía.** Ni ella ni el negocio tenían uno, y sin horario nada la cierra (`cerradasAhora`). El motor hizo
exactamente lo que estaba configurado. **Martín, textual:** «ella no sabia donde se configuraba el horario de oficina nada mas». No es
un bug del motor; es el mismo defecto que el goteo: **una opción que decide cuándo y cuánto se manda, escondida en Configuraciones.** Por
eso el aviso dice entre qué horas sale y, si no tiene horario, lo dice y ofrece ponerlo.

**Y lo que sí era nuestro, en la plantilla:** decía «nace para aprobar y el goteo la reparte» y las dos cosas eran falsas. Desde el
23/10 un mensaje fijo sale solo (`saleSolo`: el `revisar` de la plantilla ya no frena), y nadie le ponía goteo. La plantilla de escribirle
en frío a una base nacía sin horario, sin goteo y sin aprobación. **Ahora nace con los dos (`ritmo`: 9 a 21, uno cada 10 min, 30 por
día)**, sólo las nuevas.

**Trampas de esta medición:**
- `nutricion_envios` tenía sólo 2 de los 68: un lead borrado se lleva en cascada sus inscripciones y sus envíos, y deja el mensaje en
  `wa_mensajes` con `lead_id` null. **Quien mide lo que salió con los envíos, después de un borrado, ve casi nada: se mide en `wa_mensajes`.**
  Los leads ya no están y tampoco en la papelera, que es del 28/10; el rastro del `lead_audit` dice que los trajo, movió y cambió de etapa ella.
- `at time zone` da una fecha sin zona, y el driver la lee como hora local de la máquina y la corre 3 horas: se pide con `to_char`.
- Medir en la zona equivocada escondía todo: el negocio es Cancún, no Tijuana.

**Un negocio sin horario manda a cualquier hora (decidido por el Cerebro, 30/10).** Medido ese día: de 15 activas (sin los avisos de
MaKo), 14 sin goteo y 12 sin horario; sólo 2 negocios tienen uno propio. **Las que nacen de ahora en más: horario de fábrica, de 9 a 21.
Las que ya existen: no se toca ninguna**, y el puente es el aviso en las prendidas. El corte es por fecha de creación
(`DESDE_HORARIO_DE_FABRICA`, `naceConHorario`). ⚠️ **Se decide al prenderla por primera vez, no al crearla:** una vacía nace sin saber
qué la dispara, y lo que contesta a algo que acaba de hacer la persona (un DM, un comentario, un email) no espera a las 9: alguien
probándola a las 22:00 la lee como rota. Va en `setSecuenciaActiva`, la única puerta que prende, y el aviso dice ese mismo horario. La difusión queda afuera: la manda la persona a
propósito, y su hoja promete los turnos de Instagram sin horario de por medio. Si no se puede leer el horario o la fecha, no se pone.

## Al activar se dice cuántos y a qué ritmo (30/10/2026, decisión de Martín del 25/10)

**El pedido:** «como está muy escondido el "goteo" se manden muchos mensajes de una… al activar la automatización podriamos darle una
advertencia». **El diagnóstico obvio («sin goteo salen 200 de una») era el equivocado, y nadie lo había medido.** En WhatsApp los
frena el tope de la línea, por hora de reloj y por día (de fábrica 6 y 40; cada negocio lo puede subir hasta 30 y 150), y sale la
tanda de cada hora junta. **Los que sí salen todos juntos son Instagram y Messenger:** no tienen tope propio. El riesgo no estaba donde
se creía, y por eso el aviso dice el canal y el número, no «ojo». **La regla:** un aviso de este tipo sale de lo que el motor mira.
La cuenta es la misma puerta del barrido (`ritmoAlActivar`, lib/nutricion.ts) y el texto, puro (lib/ritmo-al-activar.ts). ⚠️ El tiempo
es un PISO: 200 a 40 por día son 5 tandas y la quinta arranca a los 4 días; el horario y las otras automatizaciones de la línea sólo lo
alargan. ⚠️ El tope de la línea no separa, corta la tanda: usarlo como un goteo daba 10 min entre dos personas con goteo de 5.
**Cerrar el aviso nunca la prende:** `Confirm` manda Escape y el fondo a `onCancel`, y por eso «Poner goteo» es el cancelar y
«Activar igual» el confirmar.

**Una que dispara por su evento también avisa si no tiene goteo (el Cerebro, 30/10).** La primera versión callaba porque al activar no
hay a quién contar: quedaba puesto donde el riesgo es menor y callado en Instagram, donde es mayor. El aviso no está para decir a
cuántos, está para que no te enteres del goteo después. **Un aviso que miente es peor que ninguno:** si el primer mensaje lo escribe la
IA y no sale solo (`saleSolo`), queda para aprobar, y el aviso lo dice en vez de «sale». Desde el 23/10 un mensaje fijo siempre sale, así
que este caso es sólo el de la IA.

**El aviso miraba sólo el primer mensaje, y se equivocaba para los dos lados (30/10).** Uno de IA más adentro quedaba esperando sin que nadie
lo dijera: el negocio creía que MaKo había escrito. Y al revés: `primeroQuedaParaAprobar` contaba todo lo que no fuera email, así que de un
mensaje de IA por Instagram decía «queda en Borradores», y Instagram no tiene bandeja: el motor lo manda. ⚠️ **Un test fijaba ese error** («queda
para aprobar: no se va de golpe», sobre un paso de Instagram), porque lo escribió quien escribió el código. Medido el 30/10, en las 555 de la base:
13 dejan algo para aprobar, en 12 no es el primero (la plantilla «Un Lead Entró», 1 de 5) y ninguna de esas 12 está prendida; ninguna usa IA por
Instagram o Messenger, así que los dos errores no le pasaron a nadie todavía. **La regla:** una sola lista, `mensajesQueQuedan`
(lib/mensajes-por-aprobar.ts), de la que salen `dejaBorradores` y `porAprobarDelFlujo`; y lo que queda para aprobar se dice siempre, también sin
nadie a quien contar, con cuántos y de cuántos. «Hasta»: con ramas nadie pasa por todos, y a quien ya pagó le sale directo. ⚠️ Una prendida con
goteo y horario NO lleva ⚠ sólo por esto: la línea de la automatización ya cuenta los que esperan (`textoPorAprobar`). ⚠️ `envio_automatico` no es
una columna, vive en `estrategia`: un script que la pide directo falla.

**Un borrador pendiente frena TODO el WhatsApp de ese lead, en cualquier automatización, no sólo la IA (30/10, medido en Leila).** El diagnóstico que llegó
decía «sus mensajes de IA sin "sale sola" se frenan»: no. «Seguimiento a leads que no cierran» (pausada) **no tiene un solo mensaje de IA** y 27 de sus
personas igual se frenarían (contando también a las que ya contestaron): la guarda del motor (`tieneBorradorNutriPendiente`) va antes de mirar el tipo, y mira cualquier borrador de automatización del
lead, de cualquier automatización y fecha. Esperan los mensajes de WhatsApp no oficial y las acciones; no esperan los «N antes de la reunión», «Si responde», el
oficial, el email ni Instagram, y a quien ya pagó no lo frena (`seFrenaPorBorradores`, `clasificarBorradores`, lib/ritmo-al-activar.ts). Eran 27 borradores del
20/10 de dos automatizaciones pausadas: si la prendían, el negocio creía que MaKo escribía y MaKo no escribía; y aprobar uno mandaba un mensaje de hace diez
días. **La regla:** el aviso al prender dice cuántos, de qué fecha, de dónde y qué pasa, y ofrece descartarlos ahí, por `descartarBorradoresAnotando`
(lib/borradores-descartar.ts), el camino de archivar. ⚠️ Una medición tiene fecha, y lo que cuenta depende del filtro: CRM midió 33 y yo 31 el mismo día; los
otros 2 son de `origen: 'setter-asistido'`, del 28/10, y no frenan a nadie.

**⚠️ Descartar un borrador NO es neutro: suelta lo que venía detrás, y la primera versión de esto lo hacía por una automatización que nadie miraba.** Al crear el
borrador la inscripción ya avanzó; lo que la tiene quieta es ese borrador. Descartar uno de otra automatización PRENDIDA desde el aviso de ésta le mandaba al
lead su segundo mensaje sin el primero, aunque después se apretara «Cancelar». No le pasó a nadie: no se subió, y lo encontró la revisión independiente, que
además no era obvia para quien la escribió. **La regla:** de una prendida no se ofrece; lo reciente tampoco (`BORRADOR_VIEJO_DIAS`, 3: se dice, y se resuelve en
Chats › Borradores); y la frase dice la consecuencia de descartar, no sólo la de aprobar.

**Un cartel con un botón adentro: Enter sobre ese botón confirmaba.** `Confirm` escucha el teclado antes que nadie y confirmaba con cualquier foco: Enter sobre
«Descartar», o sobre «Poner goteo», PRENDÍA la automatización. Y con las flechas que le pasa cada pantalla, cada render le robaba el foco al botón que se miraba.
Valía para todos los carteles de la app. Ahora, Enter sobre otro botón es ese botón, y el foco va una vez. Escape, con algo en vuelo, no cierra.

**La misma revisión, en una línea cada una:** los que contestaron también se mueven (`['activa','respondio']`, no `'pendiente'`, que el motor ni levanta); con
«Incluirlas» se contaba en «Entran» a gente cuyos borradores no se miraban; el cartel decía que salían y, dos frases después, que no salía nada (`entranFrenados`);
con ramas, «el primer mensaje» y «más adelante» mentían para una de ellas (`mezcla`); el primero para aprobar callaba la falta de horario de los que sí salen solos.

**La segunda revisión (31/10), sobre los arreglos de la primera: 7 de 8 hallazgos eran reales, y dos caían en el miedo original de Martín.** Un arreglo de una revisión también se revisa. No le pasó a nadie: no estaba subido.
- **«Descartar» soltaba mensajes sin haber dicho nunca que no tiene goteo.** El ritmo contaba sólo a los que entran, y prender una pausada también manda lo vencido de los de adentro (`setSecuenciaActiva`). Con 27 adentro y nadie nuevo, el aviso callaba el goteo. **La regla:** lo que sale al prender se cuenta entero, los que entran y los que ya estaban (`fraseDeAdentro`), y lo que suelta el botón se dice antes de apretarlo.
- **«Se frena» miraba el flujo, no a la persona.** «Algún paso del flujo espera» restaba de «Entran» a quien recibe el primer email igual, y con los 200 frenados callaba el goteo con 200 emails saliendo. Y ofrecía descartar el borrador de alguien que ya pasó ese WhatsApp, o al que el motor le cierra la automatización porque contestó: se perdía un mensaje sin soltar a nadie. **La regla:** se pregunta por lo que le queda a cada uno (`seFrenaDesde`, `seFrenaAlEntrar`), y el cierre es la misma función del motor (`cierraAlContestar`), no una copia.
- **Descartar un borrador de alguien a quien otro lo sigue frenando no lo suelta,** y la frase decía «sigue con el próximo». Ya no se ofrece: se ofrece cuando se resuelva el otro.
- **Una de sólo acciones se frena igual,** y el aviso cortaba antes de mirar: la etiqueta no se ponía y nadie se enteraba.
- **Enter, otra vez.** El arreglo de arriba dejó dos huecos: al volver de descartar el foco caía en ningún lado, y el mismo Enter prendía sin haber leído el aviso nuevo; y con Tab a un botón de atrás del velo, Enter lo clickeaba. **⚠️ El diagnóstico del revisor sobre el segundo estaba mal, y lo corrigió el refutador:** Enter ya lo clickeaba antes, y además confirmaba. Solo acotar a los botones del cartel volvía al doble efecto: hace falta `preventDefault`. Y hay que dejar pasar el Enter de OTRO cartel, porque los dos escuchan en `document`.
- **Lo refutado:** «cerrar Configuraciones del teléfono con la X pierde el refresh» es falso en Next 16.2.6: el reducer del refresh es síncrono, no queda en `pending` cuando llega el popstate. Sale de leer el código, no de un teléfono: el punto 7 de `docs/relevo/automations.md` lo mira.
- **Permisos: nada.** Un id de otro negocio no pasa el cruce con lo que se puede descartar, y las tablas van por `getTenantDb`.

**⚠️ Un test que lee el fuente no compila.** `tests/ritmo-al-activar.test.ts` dio 29 / 0 con `lib/nutricion.ts` sin poder compilar: agregué `inscripcionesVencidas` y ese nombre ya existía. Lo agarró la lectura real contra la base, no el test. **La regla:** después de tocar el motor, algo tiene que importarlo de verdad antes de creerle a un verde.

**El aviso decía y no llevaba a ningún lado (Martín, 30/10: «ella no sabia donde se configuraba el horario de oficina nada mas»).** No era un
bug del motor, era la pantalla. En la computadora «Poner horario» ya abría Configuraciones, pero el ⚠ de la fila era un dibujo, y **en el teléfono no
había camino**: el aviso era un texto, y Configuraciones no existía. Ahora, un toque desde el aviso en los tres lugares. El teléfono usa los MISMOS
ajustes (`AjustesDeLaAutomatizacion`, por `dynamic`, app/m/automations/ConfiguracionesM.tsx), no una copia. Al cerrar se relee, y el aviso se va.

**Un aviso que sale al activar no alcanza a las que ya viajan (el hallazgo de este punto).** Medido el 30/10: las 7 activas de Instagram
leídas no tienen goteo. El riesgo que Martín temía no es futuro, está prendido. **La regla:** el valor de un aviso no está en el momento
de prender, está en que el dueño lo sepa: se dice en la pantalla y en la tarjeta de la prendida (`avisoDeUnaPrendida`, `aviso_ritmo`), y
NO se les pone goteo: cambiaría cómo le llegan los mensajes a los leads de un cliente, sin que el cliente lo pida. No poder leer la
configuración no dice nada: no saber si tiene goteo no es «no tiene goteo». Una lectura por lista, no una por automatización. Lo ve
quien ve la automatización, en la computadora y en el teléfono: un setter no lo arregla, pero puede avisar. Ponerlo, sólo el admin.

**Un tope que se sube cada vez que algo no entra dejó de ser un tope.** `tests/automations-decima-lienzo.test.ts` mide el tramo del título de `app/automations/SecuenciaPerfil.tsx`: subió a 4.000 el 28/10 (la pregunta de los que ya están en la etapa) y a 4.500 el 30/10 (este aviso). Y `tests/chatbot-lista-nueva.test.ts` mide la acción de la fila (`accionFila`, `app/automations/SimuladorWhatsApp.tsx`): de 2.700 a 3.400 el 30/10, por este mismo aviso. **La pregunta no es cuánto más aguantan, sino por qué esos tramos siguen creciendo** y si deberían partirse. Un cuarto (el pie, 4.000 en `tests/lienzo-sexta-tanda.test.ts`) no se subió: el aviso salió del tramo a una constante, y eso bastó.

**Cambiar una línea rompe los tests que leen el fuente de ese archivo, aunque el comportamiento no cambie.** Este aviso dejó siete rojos en el tren, y correr «los tests de lo que toqué» de memoria no encontró ninguno. Los encontraron la corrida del tren (dos) y correr TODOS los que nombran los archivos tocados (cinco, en 298 archivos, una hora de máquina). ⚠️ **No eran todos iguales:** `tests/chatbot-probar.test.ts` cuidaba una regla de diseño de verdad, que el único texto de una fila de la lista es el nombre, y ahí se cambió el código, no el test. **La regla:** antes de pasar una punta se corren los que leen el fuente de lo tocado, y un rojo se lee antes de ajustarlo. ⚠️ El barrido corre sobre un árbol que se sigue arreglando: lo que corrió antes de un arreglo hay que volver a correrlo.

**Decisiones de Automations:** con menos de 2 personas que salgan, contando a las de adentro con lo suyo vencido, y sin evento, no hay ritmo que decir. No poder contar no frena, pero sin goteo se
dice igual.

**Sin hacer:** el interruptor de /email y «MaKo escribe tu nutrición» (app/email/EmailApp.tsx, app/_components/NutricionGenerar.tsx)
prenden sin este aviso. Una con horario cuenta a los de hoy, no a los de su próxima vez. El tope de Meta para Instagram no entra en la cuenta. Una que ya está prendida con sólo borradores viejos no avisa nada (`avisoDeUnaPrendida`, lib/ritmo-al-activar.ts). Chats › Borradores no dice que uno es de hace diez días: aprobarlo lo manda igual. Con hilos, las acciones esperan sólo a su mensaje anterior, y `seFrenaPorBorradores` lo aproxima.
**Sin ver en pantalla:** probado con tests, roturas y el dato real de producción, no en el navegador (sin servidor local por la RAM).

## El botón de un DM viejo no andaba y pausaba todo (30/10/2026, ticket #33 de Leandro)

**El síntoma:** cinco copias de la 680 (los MISMOS ids de tarjeta y el mismo «Obtener recurso»), la misma cuenta comenta las
cinco palabras y recibe cinco DMs. El botón del último DM anda; el de uno anterior no hace nada, y todas las inscripciones del
lead, también las completadas, pasan a «respondió». **El diagnóstico del pedido** («el toque se resuelve contra la inscripción
más nueva») **no era:** el payload lleva la inscripción y, en el arnés, el toque del DM viejo con su payload mueve SU
automatización. **Lo medido** (lead 5437, 30/10 03:51:14): el toque viejo no movió nada y 50 ms después las ocho quedaron en
'respondio'. Eso sólo pasa si `tocarBoton` contesta 'no_es', y con la fila completa eso es **un payload que no es el de MaKo**:
el webhook lo trató como un mensaje escrito, la pausa frenó las activas y el #788 pasó las completadas a «respondió». El cuerpo
del evento no se guarda (`zernio_eventos` tiene sólo el id): qué payload mandó Zernio no se puede ver.

**El arreglo, sin depender de qué mande Zernio:** un postback NUNCA va a la pausa ni al «Te envía un mensaje» (webhook), y con
el payload viaja el título: si el payload no se lee, se resuelve por el título, como un botón que no se vio. Varias esperando el
mismo título: la MÁS VIEJA (antes, el orden de la base). La regla: **un toque de botón no es una respuesta**, se resuelva o no.

**La API decía cualquier cosa sobre en qué paso está un lead (lo que quedó del #33).** El 70 % de las inscripciones vivas sin tarjeta
nombraba otra tarjeta que la última que les salió, en la API y en la ficha. Nadie lo vio porque cada caso suelto parece un detalle.
La consulta, sólo lectura, por si hay que volver a medir: `select i.id, i.estado, i.paso_actual, s.pasos, (select e.nodo_id from
nutricion_envios e where e.inscripcion_id = i.id and e.estado in ('enviado','accion','simulado') order by e.created_at desc limit 1)
from nutricion_inscripciones i join nutricion_secuencias s on s.id = i.secuencia_id where i.nodo_actual is null and i.estado in
('activa','respondio')`, comparando `pasos[paso_actual].id` con ese último nodo.

**`paso_actual` sin tarjeta NO es una posición.** Al terminar el flujo el motor deja `nodo_actual` null y
`paso_actual` en el índice SIGUIENTE (`avanceDesde`), y el #788 la pasa a «respondió»: ese número es lo que sigue en el array, y por
eso GANCHOS decía «Todavía no te veo…» con el recurso ya enviado. Medido el 30/10 en producción, de 150 vivas sin tarjeta: 106
nombraban OTRA tarjeta que la última que les salió, 4 sin envíos, 2 fuera del array, 1 acertaba; las 37 activas sin tarjeta están
en la entrada, y ésas sí valen. **La regla:** todo lo que lee «la tarjeta de ahora» pasa por `indiceDeLaFila`
(lib/automatizaciones-del-lead-reglas.ts), no por `indiceActual`: también los botones que espera, que leían los de una tarjeta
ajena. Sin tarjeta, la API y la ficha nombran lo último que SALIÓ (`paso_es` lo dice en la API); el tablero del CRM no paga esa
lectura y se queda sin nombre, porque sólo muestra el paso de las activas. La ficha no necesita leer nada más: ya tiene los envíos.

**Lo que manda Instagram queda guardado: `ig_mensajes.metadata_zernio` (migración 0353).** ⚠️ NO sólo cuando viene
`postbackPayload`: la duda de este ticket es justamente si vino, o vino con otro nombre, y el mensaje sin ese campo es el que hay
que poder mirar. Se escribe APARTE del mensaje y sin tirar: si fuera en el upsert, una columna que todavía no está haría perder el
mensaje. **La duda sigue abierta:** con el próximo toque de un DM viejo, mirar esa columna. Hasta entonces, «era un payload ajeno»
es lo que se dedujo, no lo que se vio.

**Los datos que rompió, reparados (30/10/2026 17:19, con el arreglo ya desplegado y el «dale» del Cerebro):** ningún camino de
la app saca una inscripción de «respondió» a como estaba («Volver a probar» sólo marca el desenlace y la deja en
'respondio'; «Empezar de nuevo» le MANDA el primer DM; «Frenar» cancela). La pausa sólo había escrito `estado` y `updated_at`,
así que se volvió SÓLO `estado`, en una transacción con compare-and-set contra el `updated_at` del bug: 703 a 707 a 'activa'
(paradas en nlcjml0, sin próximo envío: esperan el toque y no les sale nada) y 660, 708 y 709 a 'completada'. Las 8 tocadas,
con una línea en el historial del lead; después, ningún envío ni borrador. Para la próxima: si una pausa por error vuelve a
pasar, es la misma reparación (medir que nada se movió, y devolver sólo `estado`).

## Elegir la publicación o el Reel del CRON de comentario (29/10/2026, ticket #25 de Leandro)

**El pedido** (Leandro, ticket #25, levantado por MaKo a las 05:50): «que el flujo arranque solo cuando el comentario contiene
una palabra… y, si se puede, elegir en qué publicación o Reel». Lo de la palabra ya estaba (#17, desplegado DESPUÉS de que
escribiera: por eso «no lo encontramos»); faltaba la publicación. Ahora el CRON de comentario elige «Cualquier publicación» o
una de las últimas 25 de la cuenta, con su miniatura (lib/publicacion-cron.ts, `PublicacionDelCron` en el editor).

- **El id es el MISMO en los dos lados, y está dicho en la doc de Zernio** (OpenAPI v1.416.0): el comentario trae
  `comment.platformPostId` (el id NATIVO) y GET /v1/accounts/{id}/posts devuelve «the 25 most recent posts that exist on the
  platform… including posts that were never created through Zernio», con `id` = «The platform's own post id». No hace falta
  un id de Zernio (el `post.id` del webhook viene null en lo que no se publicó por Zernio).
- **La trampa del #17 vuelve con cada campo nuevo del CRON:** el PRIMER disparador se rearma de las COLUMNAS
  (`disparadoresDe`) y pierde lo que las columnas no tienen. La publicación va en la misma lista que las palabras
  (`palabras: g0.palabras, …, publicacion: g0.publicacion`); el test lo prueba por el webhook con la fila como la guarda la base.
- **Dos lugares deciden, y los dos miran la publicación:** `hayQuienEscuche` (si nace el lead de quien comentó) y
  `dispararEventoSocial` (si se inscribe). Con uno solo, quien comentó otra publicación quedaba como lead sin automatización.
- **Un comentario que no dice de qué publicación es no dispara** un CRON con publicación (como el texto vacío con palabras):
  nunca «entonces todos».
- **La API de MaKo toma el LINK del Reel** (`resolverPublicaciones`, chatbot.run.ts): se busca entre las últimas por el código
  del link («/reel/X» y «/p/X» son la misma; con o sin «www.» y «?igsh=»). La descripción del campo es CORTA a propósito
  (el presupuesto del turno, ver el #29 más abajo); la guía de /docs lo explica.

**Sin hacer:** una publicación más vieja que las últimas 25 no se puede elegir en la pantalla (sí por la API, con su id).
Las miniaturas son links de Instagram que vencen: si la lista se abre días después, se vuelven a pedir (la visita no las
guarda). Por el token (HTTP) los CRON todavía no se cambian (`cambiar_crons_secuencia` no es HTTP). No se probó con una
cuenta real de Instagram: el test usa el Zernio de mentira con la forma de la doc.

## «Ya te sigo» no hacía nada: el motor SÍ volvía a la tarjeta de antes (29/10/2026, ticket #29 de Leandro)

**El síntoma** (Leandro, `mako_doer_conv` 1716): el «Seguinos» tiene «Ya te sigo», que vuelve a «¿Te sigue en Instagram?»;
el lead lo toca y «no pasa nada, siga o no siga». **Su diagnóstico, y el del pedido:** «el botón no puede llevar a una
tarjeta por la que el lead ya pasó». **Era el equivocado.** La base (la 680, inscripción 659 y la vuelta anterior del lead
5436, `nutricion_envios` e `ig_mensajes`) muestra que el motor volvía a la condición en cada toque y anotaba el «Seguinos»
como ENVIADO otra vez, y que a las 16:00:20 el link salió. Lo que el lead veía como «nada» eran tres cosas, ninguna en el
grafo:
- **El segundo «Seguinos» no salía y MaKo lo anotaba enviado.** La clave de Zernio era (inscripción, vuelta, tarjeta): la
  misma tarjeta otra vez en la misma vuelta repetía la clave, y Zernio devuelve la respuesta guardada (24 h) SIN mandar.
  Ahora la clave lleva la PASADA (`claveDeEnvio`, lib/reentrada.ts: cuántas veces ya salió esa tarjeta en la vuelta, sin
  contar los fallos, que se reintentan con la suya).
- **El toque de quien seguía rápido se tiraba.** Un toque del mismo botón dentro del minuto era «repetido» (15:43:47 y
  15:44:07 en la base). Ahora es repetido sólo si la tarjeta del botón NO volvió a salir desde el toque anterior
  (`tocarBoton`). Los reintentos de Zernio ni llegan: el webhook reclama cada evento.
- **«¿Te sigue?» se leía de la caché de Zernio** (`refresh=false`, que guarda «briefly» por cuenta y persona). Su doc pide
  `refresh=true` «right after asking someone to follow». Ahora la vía rápida de UN lead (la del toque) pregunta fresco;
  la corrida de la hora, con la caché.
Y como cada toque ahora SÍ manda un DM: **hasta 10 toques que mueven por vuelta** (`TOPE_TOQUES_POR_VUELTA`, la marca
`nutricion.boton.<inscripción>` los cuenta; «Volver a probar» es otra vuelta). La guía de /docs «Palabras clave y botones de
Instagram» lo dice, con las reglas de las palabras clave (el punto 2 del ticket).
⚠️ La guía va en /docs y NO en las descripciones de la API: alargarlas (los botones, el CRON, `palabras`) sacó
editar_pasos_secuencia_mensajes y cambiar_crons_secuencia del presupuesto del turno (Integración, tren-ac). La regla ya
estaba escrita: docs/hallazgos-api-mako.md, «El presupuesto del turno de la app» (medir con scripts/presupuesto-turno-app.mts).

**La regla:** cuando algo «no pasa», mirar `nutricion_envios` contra lo que llegó de verdad antes de tocar el grafo: un
envío «enviado» con la misma Idempotency-Key que otro NO salió. Y la prueba va con un Zernio de mentira que REPITE la
respuesta guardada como el de verdad (tests/_boton-vuelve-hijo.ts): un doble que siempre «entrega» no ve esto.

**Sin hacer:** quien tocó 10 veces sin seguir la cuenta no recibe el recurso en esa vuelta (el tope es a propósito; si
molesta, se sube). Un envío que Zernio entregó pero dio «fallo» terminal (un tiempo agotado) no cuenta como pasada: la
siguiente repetiría su clave. El costo de `refresh=true` en Zernio no está documentado (va una consulta por toque). El
PostgREST de mentira no entiende `or=`: el hijo contesta vacío el «quién entró en 24 h» (si no, 7 s de reintentos por corrida).

## La difusión desde el CRM: tres cosas del motor que hacían que «un flujo con tres tarjetas» no sirviera (28/10/2026, Leila)

**El pedido** (Martín, por Leila): elegir una columna o leads sueltos en el CRM y «mandar mensaje de difusión» por
WhatsApp, email o Instagram, con la tarjeta ahí mismo y el goteo y el tope por día «por una cuestión de baneo». La regla
del Cerebro: una difusión ES una automatización de una sola vez (lib/difusion.ts, la hoja en
app/automations/difusion/HojaDifusion.tsx, la API `difundir_a_leads`). Lo que mapeó el agente de lectura y cambió el diseño:

- **El WhatsApp oficial hoy NO manda.** Con la plantilla aprobada, el motor igual escribe `fallo` con `SIN_CANAL_OFICIAL`
  («Chatwoot no existe más…», lib/nutricion.ts) y lo reintenta cada 4 h; no hay un emisor de la API de Meta en `lib/`. La
  difusión sale sólo por QR (`proveedor: 'no_oficial'`), y sin una línea QR conectada el canal no se ofrece.
- **En un flujo LINEAL, el canal que falta cierra la inscripción entera.** Sin teléfono, sin email o dado de baja
  (`leads.email_opt_out`), sin conversación de Instagram o con la ventana de 24 h cerrada: los tres son fallos terminales;
  con un solo cursor la inscripción queda `cancelada` (lib/nutricion-hilos.ts) y ya no se puede volver a inscribir. «Un
  WhatsApp, después un email» no le mandaba el email a quien no tenía teléfono. Por eso la difusión es la tarjeta de inicio
  con UN HILO POR CANAL (el patrón de «Un Lead Agendó Llamada»), cada uno con su CONDITION (`tiene_telefono`, `tiene_email`
  + no `email_baja`, `tiene_instagram`): sin el canal, termina ESE hilo.
- **La inscripción en lote se había dejado afuera a propósito** (app/crm/AccionesLoteLeads.tsx: «necesita su pantalla con el
  ritmo a la vista», la línea QR se protege sólo con el ritmo). La hoja ES esa pantalla: el goteo y el tope del día de esta
  automatización (`automatizacion.config:<id>`, «Todos los canales»: cada canal cuenta lo suyo) se ven y se confirman antes.

**Trampas para quien siga:** el CRON «A mano» no tiene cohorte (sólo entran los que se inscriben a mano); la columna entera
se resuelve con `leadsDeCohorte('etapa_actual', …, { sinVentana: true })`, que lee SÓLO `estado_lead = 'abierto'` (una
columna de cerrados o perdidos vuelve vacía); el tick de cada minuto mira lo vencido hace menos de 10 min (lo frenado por el
goteo pasa a su turno). A la hoja no le viajan teléfonos ni emails: sólo por qué canal le llega a cada uno (`motivosDe`). Y las conversaciones de Instagram se leen POR EL CANAL (`conversacionesDeLeads`, lib/canal-zernio.ts): leer `ig_conversaciones` desde otro módulo lo frena tests/sin-instagram; y un camino nuevo que prende automatizaciones o escribe pasos va con su porqué en tests/automations-activar-todos-los-caminos (las listas `CREAN_A_MANO` y `SISTEMA`).
tests/difusion.test.ts.

**⚠️ Lo que la verificación del Cerebro encontró sobre 69b49a31c (29/10) y cómo quedó:**
- **La misma difusión salía dos veces.** El camino real era MaKo: 250 leads, la 2ª tanda del insert falla, MaKo vuelve a
  proponer «a 250 de 250» y con el «sí» quedaban 450 inscripciones en DOS automatizaciones. Ahora cada pedido tiene su clave
  (`claveDeDifusion`: a quién, por dónde, qué y con qué goteo) y su marca en app_settings, reclamada con compare-and-set
  ANTES de crear nada; el mismo pedido dentro de 24 h RETOMA la automatización que creó y suma sólo a los que faltan
  (`upsert` sin pisar sobre `unique (lead_id, secuencia_id)`). **La trampa:** el «sí» de MaKo ya era de un solo uso
  (`reclamarPendiente`); el doble venía de una PROPUESTA nueva, que es otro «sí». La idempotencia va donde se escribe.
- **Instagram con goteo prometía de más.** Con 40 por día, a los que pasaban del tope se les cerraba la ventana de 24 h antes
  de su turno y el envío los daba por fallo. `salidaHastaMs` (lib/canal-social.ts) es `decidirSalida` en el tiempo, y
  `alcanceDeMotivos` con el `ritmo` cuenta el turno de cada uno (`demoraDelTurno`, el orden del motor: `proximo_envio_at, id`):
  el que no llega queda afuera (`instagram_turno`) y, si Instagram era su único canal, no se inscribe. Por comentario (7 días)
  sí entran: el último de 200 sale el 5º día.
- **Por el grupo de WhatsApp, un setter lanzaba una difusión** (el doer arma el rol como 'admin' para todos). `difundir_a_leads`
  pasa a `canales: ['app']`, la regla de AGENTS.md para lo que toca números de terceros en lote.
- **El goteo fuera de rango fallaba después del «sí»:** `preparar` llama a `goteoValido` y `porDia` tiene su máximo.
- **Cada difusión quedaba prendida para siempre** y ocupaba un lugar del tope del Esencial (3 activas). Ahora nace con la
  clave `difusion-…` (la clave no cambia nunca; el nombre sí) y la corrida de la hora la pausa cuando no le queda nadie
  en curso (`pausarDifusionesTerminadas`), con 15 min de gracia porque se prende ANTES de inscribir. Las de antes de
  este cambio tienen la clave `automatizacion-…`: ésas siguen apagándose a mano. **⚠️ Y las dos reglas se pisaban** (la
  reverificación de Integración, 29/10): pausada la que terminó, el mismo pedido dentro de las 24 h contestaba «préndela ahí»
  y prenderla no sumaba a los que faltaban. Ahora `retomarDifusion` la vuelve a prender por `setSecuenciaActiva` y suma.
  **La trampa del arreglo:** la primera versión la prendía con `aunqueDuplique: true`, copiado de `crearDifusion`. Ese
  permiso vale para la fila RECIÉN creada A mano, no para una que estuvo pausada y que pudieron editar en Automations
  (otro disparador, otros pasos). Lo agarró la red de caminos (tests/automations-activar-todos-los-caminos.test.ts), no
  el test de la difusión. Regla: **lo que se retoma pregunta por la duplicada como «Activar»**; el permiso no se copia.

**Sin hacer:** el botón «Mandar mensaje» y la selección en el tablero son del CRM (la interfaz se le pasó por el Cerebro);
no se probó mandando de verdad (sería escribirle a leads reales). Un lead que tiene Instagram Y otro canal y no alcanza
su turno de Instagram sigue inscripto (le llega por el otro) y su hilo de Instagram termina en fallo: la hoja ya no se
lo promete, pero la métrica lo cuenta. La marca de cada pedido (`difusion.pedido:<hash>`) queda en app_settings.

## Un tope de Meta CERRABA el hilo: el mensaje se perdía en vez de esperar (28/10/2026, Leandro)

**El pedido** (Leandro, ws10, por audio): hace ~500 respuestas a comentarios y ~1.000 DMs por mes; ¿hay un límite? Y «que
MaKo me avise ANTES de que se trabe la automatización, para no encontrarme con mil mensajes sin responder». Topes (el
Cerebro): Meta, 750 respuestas privadas por hora y por cuenta (y 300 mensajes por segundo); Zernio, 60 pedidos por minuto con
0-2 cuentas y 600 con 3+, con 429, `Retry-After` y `X-RateLimit-Remaining` (docs.zernio.com/rate-limits).

**Lo obvio era sólo la mitad:** «falta un aviso». Medido en el código, había algo peor: un «muchos pedidos» de Meta llega como
un 400 `platform_error`, y la última regla de `esLimiteDeMeta` («Meta no deja») lo tomaba como TERMINAL: cerraba el hilo y el
mensaje se perdía. Y un 429 de Zernio se reintentaba en 4 h, sin mirar su `Retry-After` (que `zFetch` ni leía). Ojo: un 429
de Zernio con `type: platform_error` («upstream platform quota») es el tope de META, no el de Zernio.

**Lo hecho:** `topeDeError` (lib/zernio-tope.ts, puro) dice si es un tope y de quién, con la espera (`Retry-After`, o el minuto
de Zernio, o la hora de Meta); `esLimiteDeMeta` lo excluye primero. Los tres envíos (DM, respuesta privada, respuesta pública)
miran el tope ANTES que el rechazo: no cierran, no gastan la privada y vuelven a salir con su espera (`porTope`). El motor junta
los topes de la corrida y avisa UNA vez al final (y no más de uno por estado y por hora), también ANTES del tope de Meta (600
de 750 en la última hora), por el evento de la plataforma `social_tope` (`avisarTopesSociales`, lib/nutricion.ts).
tests/tope-social.test.ts, 10 roturas en rojo.

**Sobre 56be0692d («una cuenta frenada avisa una vez por día»):** es la cuenta PUBLICITARIA (lib/alerta-critica.ts, el evento
`meta_cuenta_frenada`): mismo molde (evento de la plataforma con freno), otro tope. No cubría los mensajes.

**⚠️ La fila del ws 9 no se podía crear (verificación de 69b49a31c, 29/10):** el paso documentado tiraba «social_tope no está
en la mudanza»: el evento se sumó a EVENTOS_MAKO y a las plantillas, pero no a `TODOS` del script. **La regla:** un evento de
la plataforma va con su línea en la mudanza; tests/mudanza-apagados lo fija para TODOS los `plataforma: true`.

**Sin hacer:** el aviso no sale hasta que exista su fila en el ws 9 (`scripts/mudanza-avisos-plataforma.mts --eventos=social_tope`:
escribir en producción, lo pide el Cerebro); la respuesta del AI Step (`contestarSolaPorRedes`) y la de «Si responde» por redes
son de una vez: con un tope no se reintentan; `X-RateLimit-Remaining` se lee pero todavía no frena el ritmo antes del 429.
Nunca corrió contra un tope real. **El «cerca» ya es por cuenta** (la verificación sobre 69b49a31c, 29/10): sumaba el negocio
entero (dos cuentas a 320 daban un falso «te estás acercando») y decía «Instagram» aunque saliera por Messenger. Ahora la
suma del negocio sólo decide si vale la pena mirar, y cada envío cuenta en la cuenta de la conversación del lead por ese
canal (`cuentaMasCargada`, lib/tope-social.ts); `nutricion_envios` no guarda la cuenta, así que es la de la conversación
de HOY del lead, no necesariamente la que mandó.

## El primer DM de Instagram no lo contestaba nadie: el AI Step esperaba el SEGUNDO (28/10/2026, la (a) del Cerebro)

**⚠️ Y contestaba DOS veces (la verificación del Cerebro sobre 69b49a31c, 29/10):** un lead con una charla abierta (la 680)
y otra automatización «envía un mensaje» con el AI Step primero: el webhook marca pausar Y disparar para el mismo DM, y
contestaban `pausarRespuestaSocial` (la charla abierta) y `contestarDisparoSocial` (la nueva). Ahora la nueva contesta sólo si
nadie contestó ese mensaje (`contestada`, app/api/webhooks/zernio/route.ts). **La regla:** dos caminos que contestan el
mismo evento se excluyen en el lugar donde se juntan, no cada uno por su lado.

**⚠️ El primer arreglo abrió el hueco contrario (la reverificación de Integración sobre 0265924c6, 29/10):** el freno usaba lo
que DEVUELVE `pausarPorRespuesta`, que es cuántas inscripciones pasaron a 'respondio': cualquier automatización activa del
lead, también una SIN AI Step (comentario → m1 → Esperar 1 día → m2, el flujo de Leandro). El primer DM no lo contestaba nadie
y el dueño no se enteraba. Ahora `pausarPorRespuesta` llena `atencion.contestada` con lo que un AI Step o la charla abierta
contestaron o dejaron para aprobar (`seguirCharla` devuelve eso; el aviso «Contéstale tú» no cuenta). **La regla:** «cuántos
se pausaron» no es «a cuántos se les contestó»; una exclusión mira el hecho que excluye. **Y la trampa del arnés:** sin la
zona del negocio, el arnés cae en Tijuana y de madrugada el AI Step deja BORRADOR en vez de mandar: el doble no se veía. El
arnés de Integración pone Asia/Dubai (C:/dev/revisiones/scratch-0265/ig-refuta/_hijo.mts, `ZONA_HIJO`).

**El síntoma** (Teo, la llamada del 28/10): «la primera DM no la contesta el AI Step». Una automatización cuyo CRON es «envía
un mensaje» y cuya primera tarjeta es el AI Step no tiene SALIDA (`raizSalida` null: la flecha CRON → AI Step es implícita,
`suelta` ausente). El DM la inscribía y la inscripción quedaba esperando que la persona escribiera de nuevo: el motor sólo
le pasa al AI Step lo que llega por `pausarPorRespuesta`, y el DM que la arrancó llegó ANTES de que existiera la inscripción.

**La decisión** (el Cerebro, la (a), como ManyChat): si la primera tarjeta es el AI Step de ese medio (`contestaElDisparo`,
lib/flujo-grafo.ts), contesta ese mismo DM. El webhook lo pide DESPUÉS de inscribir y sólo si inscribió
(`contestarDisparoSocial`); el motor toma sólo las inscripciones de ESE evento que todavía no mandaron nada, las anota
'respondio' (compare-and-set) y las pasa por la MISMA puerta que una respuesta (`asistirRespuesta`). Sólo un mensaje privado
que la persona escribió (un DM, una respuesta a la historia, el primer texto de un anuncio o un enlace): un comentario no.
Con una bienvenida adelante, lo de siempre. tests/instagram-primer-dm.test.ts.

**Sin hacer:** nunca corrió contra un DM real; «Crear con IA» todavía no arma una automatización de Instagram con un AI Step
como primera tarjeta (el otro pedazo de la promesa a Teo).

## «Clic en un anuncio»: el webhook ya lo producía, sólo la pantalla lo escondía (28/10/2026, lo prometido a Teo)

**El pedido** (el Cerebro, de la llamada con Teo): Martín vendió Automations como «ManyChat 2.0», y el disparador «El usuario
hace clic en un anuncio» estaba apagado («Todavía no»), copiado de cómo lo muestra ManyChat.

**Lo medido:** el canal ya lo producía (`subtipoDeReferral`, lib/canal-social.ts: un mensaje con `metadata.referral.ad_id`
es `anuncio`, y `DISPARADORES_SOCIALES` lo tenía `disponible`). Prenderlo fue sacar el `apagado` de Instagram y de Messenger;
la tienda de Facebook sigue apagada (Zernio no la avisa). Ojo: Meta manda primero el post del anuncio SIN referral (cuenta
como «envía un mensaje») y el referral en el mensaje que sigue: arranca con el primer texto de la persona.

**La trampa:** dos opciones más en la lista del CRON que recibe «Crear con IA» pasaban el techo de Groq (~4.021 tokens
contra 4.000, tests/crear-ia-tercera y editar-ia-cambiar-quitar). El «El usuario » ya lo sacaba `bloqueDisparadores`: no
había de dónde recortar. La IA lo ve SÓLO si el pedido habla de anuncios (`PIDE_ANUNCIO`), como las reglas de los botones.

**⚠️ «Sólo si el pedido lo nombra» tenía tres agujeros (la revisión del Cerebro, 28/10):** (1) la pregunta «¿Qué hace la
persona?» se arma ANTES del modelo y no tenía palabra para el anuncio (`PALABRAS_EVENTO`): preguntaba sin ofrecerlo; (2) lo
que se contesta en «Otra cosa» no entraba al contexto (se armaba con el pedido de la primera vuelta); (3) «¿Qué hace esta
automatización?» no nombra anuncios y el rótulo del CRON guardado no se encontraba: «no tiene CRON». Y de rebote Messenger
perdió «enlace de referencia»: el anuncio, primero de su lista, ocupaba uno de los 3 lugares y después se filtraba. Ahora
el contexto lo trae también con lo de «Otra cosa» y con el CRON guardado (`armarContexto(ws, pedido, { textos, anuncio })`),
y la pregunta filtra antes de cortar. **La regla:** un recorte por tokens que depende del pedido tiene que mirar también lo
que YA está guardado; si no, la IA no ve lo que la automatización es. tests/crear-ia-anuncio.test.ts.

**Sin hacer:** nunca se probó con un anuncio de verdad.

## Las palabras clave del comentario: el PRIMER CRON se rearma de las columnas y perdía lo nuevo (28/10/2026, ticket #17)

**El pedido** (Leandro, ws10, por audio): «cuando alguien comente la palabra fiesta o la palabra guía… que se responda el
comentario», y «Tal cual como lo hace manychat». El CRON «comenta tu publicación o Reel» arrancaba con CUALQUIER comentario.

**Lo hecho:** `palabras` y `coincidencia` («contiene» o «exacta») en el CRON de comentario de Instagram o Messenger
(lib/palabras-clave.ts, puro): sin mayúsculas ni acentos, «contiene» es la palabra entera («guía» no está en «guiar»),
vacía = cualquier comentario. Lo decide `disparaPorEvento` con el texto de ESE comentario (el webhook lo pasa por
`hayQuienEscuche` y `dispararEventoSocial`), no el de cuando nació el lead: quien ya comentó vuelve a disparar con la palabra.
La pantalla guarda al salir de la caja (no en cada tecla), y la API (`cambiar_crons_secuencia`) y MaKo por WhatsApp las ponen.

**La trampa:** `disparadoresDe` rearma el PRIMER CRON desde las COLUMNAS y le devuelve de la lista sólo lo que nombra
(`ignorar`, `subtipo`, `grupo`). Un campo nuevo del disparador que no se suma ahí se pierde en cada lectura del primero —el
caso de casi toda automatización— sin un error. Es la quinta puerta de los pasos (`camposDelFlujo`), del lado del CRON.
tests/palabras-clave-comentario.test.ts.

**⚠️ Lo obvio era sólo la mitad** (medido el 28/10 leyendo su automatización 680 en producción, sin escribir): «no se puede
responder en público» era cierto, pero su automatización «Comentario con 'pruebafm' en Instagram» no arrancaba NUNCA. Su
filtro «pruebafm» era la CONDITION «Respuesta del formulario contiene» (`respuesta_contiene`, fuente: las respuestas de un
formulario de Meta): quien comenta no tiene ninguna, la condición no se cumple y su «Si no» estaba vacío. Además está
pausada. Con las palabras en el CRON, sin esa condición y «Enviado, mira tus mensajes» en el comentario, la prueba de punta
a punta (lectura + las funciones de la app, sin mandar nada) da: arranca con «PruebaFM 🙌», no con «qué lindo video», se
puede publicar, sale primero la respuesta pública y la privada sigue disponible para el DM del recurso.

**⚠️ El emoji (la revisión del Cerebro, 28/10):** la primera versión tiraba los emojis con los signos, así que una palabra
clave «🔥» quedaba vacía: se descartaba al guardar y, peor, una lista que quedaba vacía al normalizar caía en «sin palabras»
y el CRON arrancaba con CUALQUIER comentario. Ahora el emoji es una palabra propia (sin la variante ni el tono de piel), y
una lista con palabras que no se pueden leer no dispara nunca. **La regla:** un filtro que se queda sin términos al sanear
falla CERRADO, nunca abre a todos.

**⚠️ Y fallar cerrado no alcanzaba:** «?» o «...» (sin letra, número ni emoji) seguían tirándose CALLADAS en `sanearPalabras`
al GUARDAR, y si eran las únicas lo que se guardaba era la lista vacía, que es «cualquier comentario» a propósito. El
descarte pasa antes de que el motor pueda fallar cerrado. Ahora la ruta (`listaValida`, también la API en `preparar()`) las
mira en lo que LLEGÓ, antes de sanear, y contesta 400 con «… no es una palabra clave: usa letras, números o un emoji»; la
caja lo dice y no guarda (`problemaDePalabras`). **La regla:** sanear no puede convertir «lo que la persona escribió» en «el
valor que significa todos»; eso se rechaza con aviso, no se limpia. Y el resumen que se confirma por WhatsApp
(`textoDeUnCron`) nombra las palabras: antes «fiesta», «🔥» y ninguna se leían igual.

**⚠️ Probar con la propia cuenta se gasta en la primera (ticket #19, medido el 28/10 en el ws10, sólo lectura):** la 680
estuvo activa de 20:51 a 20:58; @aliensfilms comentó «Lista» (no «pruebafm») y @martin.koncke «Pruebafm»: los dos nacieron
como lead y quedaron 'completada' en un segundo (la CONDITION del formulario no se cumplía y su «Si no» estaba vacío). Sin
filtro, CUALQUIER comentario de quien no era lead crea el lead y lo inscribe (`hayQuienEscuche`); en pausa, ninguno (ese
día, 30+ comentarios sin lead). Y la 680 es «Una sola vez» (sin guardar: `reentradaDe(null)`), así que el próximo comentario
de esas dos cuentas NO vuelve a entrar: la prueba de punta a punta del deploy habría fallado callada. La pantalla de la
reentrada se sacó el 23/10 («para eso tenemos CONDITION»). **Lo hecho:** «Volver a probar» por lead en la ficha (y
`volver_a_probar_lead_secuencia` en la API): marca el `desenlace` de la terminada (`DESENLACE_VOLVER_A_PROBAR`) y lo próximo
que la arranca la corre UNA vez con cualquier reentrada; el reuso limpia el desenlace. **La trampa:** `enrolarPorEvento`
filtraba con `reusaInscripciones` ANTES de mirar la fila: «Una sola vez» nunca llegaba a `puedeReentrar`, así que una
regla nueva ahí no alcanzaba; hubo que abrir el filtro (`modoSec` con todas las que tienen pasos) y que `reusablesDe` deje
pasar sólo la marcada. tests/volver-a-probar.test.ts.

**⚠️ Y la segunda prueba NO SALÍA (la verificación del Cerebro sobre 69b49a31c, 29/10):** la inscripción reusada es la
MISMA fila, y la clave de Zernio era `nutri:<inscripción>:<nodo>`. Zernio guarda la respuesta de cada clave 24 h: la pública
a OTRO comentario volvía con 422 (misma clave, otro pedido) y el DM, con el 200 de la vez anterior, sin salir. Ahora la clave
lleva la vuelta (`claveDeEnvio`, lib/reentrada.ts: `inscripto_at`, que `reactivarInscripcion` renueva). **La regla:** una
clave de idempotencia identifica UN envío de UNA corrida; si la fila se reusa para otra corrida, la clave tiene que llevar
algo que cambie con la corrida. Ya pasaba con «Cada vez» y «Empezar de nuevo»; lo destapó «Volver a probar».

**Sin hacer:** «Crear con IA» no las pone (el modelo elige el CRON por su clave `dN`; sumarle palabras es otro campo de la
salida y tokens contra el techo de Groq), y nada impide poner «Respuesta del formulario contiene» en una automatización de
comentario (no se cumple nunca); no se probó con un comentario de verdad. Elegir la publicación o el Reel (lo último que
pidió Leandro) tampoco: el webhook ya trae el `postId` (`comentario_post_id`), pero falta el campo del CRON, su selector con
las publicaciones de la cuenta (Zernio) y la firma; es la tanda siguiente.

## «La activé para los que están en reactivación y no pasa nada»: mover de etapa NO es un hito (28/10/2026, Leila 2)

**El síntoma** (Leila, ws11, 20/10 17:38): activó una automatización «llega a etapa» para los que ya estaban en
«reactivación» y no salió nada.

**Lo obvio era el equivocado:** «el CRON por etapa sólo agarra a los que ENTRAN después de activarla». No: el barrido SÍ
mira a los que ya están parados en la etapa (`cohorteDeTrigger`, lib/nutricion.ts: «una secuencia que se crea HOY tiene que
alcanzar a los que YA están»). Lo que los dejaba afuera es la ventana anti-revival de 90 días sobre el ÚLTIMO HITO del lead
(el alta, la agenda, una reunión), y **la tabla `leads` no guarda cuándo cambió de etapa**: un lead de marzo pasado a mano a
«reactivación» el 20/10 sigue siendo, para la ventana, de marzo. «Reactivación» es justo la etapa de los viejos. En los
agregados a otro CRM (`lead_funnel`) sí cuenta `etapa_desde`; en la casa no hay de dónde leerlo.

**La regla que queda:** la ventana no se toca (protege de escribirle por accidente a una base muerta). Al ACTIVAR una con un
CRON «llega a etapa» sin horario, la pantalla cuenta (`existentesEnEtapa`, por la MISMA puerta que el barrido: `aTiempo` +
`aInscribir`) y, si quedan afuera algunos, pregunta «¿Las incluyo?»; «Incluirlas» las inscribe ya (`incluirExistentes`, sólo
en una activa) y salen con el goteo y los topes de siempre. El barrido nunca pide sin ventana (`sinVentana` es sólo de
contar e incluir). tests/etapa-existentes.test.ts, 9 roturas en rojo.

**Sin hacer:**
- no se midió en la base de Leila cuántos de «reactivación» quedaban afuera (es leer producción de una clienta);
- activar por otros caminos (la API, el teléfono) no pregunta: activa con la ventana, como antes;
- un CRON con horario (Recurrente) no se ofrece: su ocurrencia decide, y la ventana sigue.

## Responder EN PÚBLICO un comentario no es otra «vía» del DM: se decide aparte y antes (28/10/2026, ticket #17 de Leandro)

**El síntoma** (Leandro, Fiesta Music, ws10; el #12 es el mismo texto): con el disparador «El usuario comenta tu publicación
o Reel», el nodo de Instagram sólo mandaba la respuesta privada. No había forma de contestar debajo del comentario.

**Lo obvio era el equivocado:** sumar una tercera `via` a `decidirSalida` (lib/canal-social.ts). Esa función decide un
MENSAJE PRIVADO: mira la ventana de 24 h, los 7 días del comentario y si la respuesta privada ya se usó
(`comentarioRespondidoAt`). Nada de eso rige para un comentario público, y metida ahí la pública habría heredado esos
frenos o gastado la privada (Meta deja UNA por comentario: el DM que sigue no salía). Vive en `decidirRespuestaPublica`,
y `enviarPasoSocial` (lib/canal-zernio.ts) la corre ANTES de `decidirSalida`, sin marcar `comentario_respondido_at`.

**Zernio** (OpenAPI v1.394.0, medido el 28/10): `POST /v1/inbox/comments/{postId}` con `accountId`, `message` y
`commentId` (sin `commentId` comenta el post, no responde). Sólo texto (`attachmentUrl` es sólo de Facebook). 403 = falta el
add-on Inbox **o** la cuenta no puede comentar ese post; 422 = Meta lo rechazó (post cerrado, comentario borrado) **o** la
`Idempotency-Key` se reusó con otro texto. Las dos son terminales (`esRechazoDelComentario`).

**El dato** (la regla de AGENTS.md: un campo del nodo es UNA rama): `en_comentario: true` dentro del mensaje de Instagram o
Messenger; ausente = un DM. Pasa por las mismas puertas que `botones`: `normalizar`, `camposDelFlujo` (sin esa línea el
primer guardado lo borraba), Publicar (`problemasDeRespuestaPublica`: sin botones y con texto), la IA de crear y de editar
(la regla al modelo va SÓLO si el pedido dice «público» o «responder el comentario»: el techo de Groq) y la API
(`cambiar_botones_mensaje` con `en_comentario`). La pantalla ofrece el interruptor sólo con un CRON de comentario
(`canalesConComentario`, lib/disparadores.ts). tests/instagram-respuesta-publica.test.ts, 11 roturas en rojo.

**⚠️ «Terminal» cerraba más que la tarjeta (la revisión del Cerebro, 28/10):** la pública sin comentario, o rechazada por
Meta (403/422), volvía `terminal`, y en el motor terminal es `estadoDeCierrePermanente`: la INSCRIPCIÓN entera se cerraba
y el DM del recurso, que va después, no salía. Además respondía el ÚLTIMO comentario guardado, de cualquier edad: quien
entraba hoy por DM (con un CRON de comentario y otro de DM en la misma automatización) recibía una respuesta pública
debajo de un comentario de hace meses. Ahora: sólo el comentario del disparo (`inscriptoAt`, con 15 min de margen antes
porque el webhook guarda y después inscribe, y 2 min después por los relojes). **⚠️ «O uno posterior» era el diagnóstico
equivocado** (la verificación sobre 69b49a31c, 29/10): la conversación guarda el ÚLTIMO comentario, así que con la pública
detrás de una espera, un «qué lindo ❤️» de la misma persona en una foto vieja pisaba el del disparo y la respuesta salía
debajo de ése, en otra publicación. Y lo que no puede salir vuelve `omitir`: el motor lo anota 'omitido'
con su motivo y AVANZA. **La regla:** en un flujo lineal, un fallo «que reintentar no arregla» de UNA tarjeta no es lo
mismo que «esta persona no puede recibir nada más»; terminal es lo segundo. Ojo que el mismo patrón vale para cualquier
canal faltante (sin teléfono, sin email, ventana cerrada): ver «La difusión» más abajo.

**Sin hacer:**
- no se probó con un comentario de verdad (es mandar en producción a la cuenta de Leandro);
- «Si responde» (la rama de un AI Step) no sabe la inscripción: su pública sigue yendo al último comentario guardado;
- la tarjeta del lienzo no dice «en el comentario» (el alto de la tarjeta es fijo: `altoDeMensaje`); se ve al abrirla;
- «Probar» no la simula aparte: la muestra como un DM.

## El nombre de un botón perdía los espacios: no era la barra espaciadora, era el saneo en cada tecla (27/10/2026)

Ticket #12 de Leandro (ws10): «Obtener recurso» quedaba «Obtenerrecurso» al tipear, y pegando sí andaba. **El obvio («el
lienzo se queda con la barra espaciadora») era el equivocado:** ningún `keydown` del lienzo mira el espacio.
- **La causa:** el editor (app/automations/EditorMensajeSocial.tsx) dibujaba `botonesDe(paso)`, la lista SANEADA, y ésa
  hace `trim` del título. En cada tecla «Obtener » volvía como «Obtener» y la «r» siguiente quedaba pegada. Pegando, el
  espacio queda en el medio y el `trim` no lo toca.
- **Lo mismo hacía dos cosas más:** vaciar el campo para reescribirlo borraba el botón (sin título «se cae»), y vaciar el link
  lo pasaba a «Sigue el flujo».
- **El arreglo:** `botonesDe(…, { comoSeEscribe: true })` para el editor; el motor y Publicar siguen con la saneada.
  tests/botones-titulo-como-se-escribe.test.ts simula el tipeo letra por letra (3 roturas).
- **La regla, en AGENTS.md:** un campo que se edita no muestra lo saneado. Sanear es para lo que sale, no para lo que se
  está escribiendo.

## Una pregunta en «Editar» cambiaba el lienzo: no era el modelo, era NUESTRA revisión (27/10/2026)

**El síntoma** (874749710-11, Leandro el 24/10 y Martín con Aaron el 26/10): en «Editar», una pregunta terminaba
cambiando tarjetas. **El diagnóstico obvio era el equivocado**: «el modelo de editar edita». Medido con el modelo real
(`scripts/arnes-pregunta-en-editar.mts`: Claude sonnet-5 y Gemini flash-lite, el mismo `system` y `user` que arma la ruta,
sin la base): ante una pregunta, el modelo de editar CONTESTA casi siempre. Lo que lo empujaba a editar era
`errorDeRespuestaEnEditar` (lib/flujo-ia-intencion.ts): con `esPregunta` en false rechaza la respuesta («En modo EDITAR no
se contesta…») y el reintento de `generar` lo obliga a cambiar algo. En el arnés salieron así «como levanto un ticket»,
«MaKo, a cuántos les llega esto» y «desde qué número sale».

**Por qué no se reconocía la pregunta** (`esPreguntaDirecta`): contaba sólo empezar con «¿» o terminar en «?», sin mirar si
pedía algo. Se escapaban:
- el «?» en el medio: «y en instagram? porque no me aparece en la configuración.» (Leandro, ws10, 25/10, del chat real);
- un saludo adelante: «Hola MaKo, ¿qué hace…? Gracias», «MaKo, a cuántos…», «Una pregunta, …»;
- arranques que no estaban: «a cuántos / a quién», «desde qué», «quiero saber», «explícame», «cómo levanto».

Y al revés: «¿Le agregás un audio al final?» empezaba con «¿» y se CONTESTABA en vez de hacerse.

**La regla que queda.** En «Editar», es pregunta un «¿» o un «?» FUERA de lo citado (lo que va entre comillas es texto para
el lead), o un arranque de pregunta después de la muletilla. En los dos casos, SIN un pedido de cambio (`pideCambio`,
`RX_PIDE_PREGUNTANDO`). Lo que va a explicar sólo devuelve `{"respuesta"}` y la ruta devuelve el borrador tal cual: con el
camino bien elegido, el lienzo no se puede tocar. Y en «Editar», «no tengo (audios guardados…)» vale como respuesta, igual
que «no se puede»: rechazarla mandaba al reintento a armar otra cosa.

**⚠️ Y el «?» en cualquier lugar abrió el otro lado (la revisión del Cerebro, 28/10):** 7 de 8 pedidos de cambio en voseo
que antes se editaban pasaron a contestarse sin tocar el lienzo («…emoji? poné uno al principio», «Está bien, subí la
espera»). `pideCambio` era el freno y no los veía: **`plano` saca las tildes, y la tilde es lo único que separa el voseo
de -er/-ir de otra cosa** («poné» → «pone», «hacé» → «hace», que también es «¿qué hace?»). El de -ar no se notaba
(«cambiá» → «cambia», que ya era imperativo de tú). Ahora el voseo se mira en el texto CON tildes (`RX_VOSEO`), con
pronombre pegado sin tilde («ponelo», `RX_VOSEO_ENCLITICO`); el pedido en subjuntivo («que el primero diga…», «que salga a
las 10») cuenta salvo que el pedido ARRANQUE como pregunta («¿hace falta que tenga…?»); y «Está bien,» con su coma ya no
arranca una pregunta («¿Está bien así?» sí). **La regla:** al ampliar lo que cuenta como pregunta, se prueba con los
pedidos de cambio de los clientes en voseo, no sólo con las preguntas; normalizar para comparar puede borrar justo lo que
distingue. tests/chat-mako-pregunta-en-editar.test.ts.

**Trampas del arnés.**
- Una espera del lienzo es una tarjeta `esperar` (`espera.minutos`), no un `delay_horas` en el mensaje. Con `delay_horas`,
  los dos modelos ven dos mensajes seguidos y contestan «sale sin demora».
- Al prompt de editar, Claude a veces contesta en prosa, sin JSON, cuando no puede hacerlo. En la app lo frena el `validar`
  de `generar` y prueba el siguiente proveedor.

**La frase del 26/10 no quedó guardada.** En el ws9, esa noche el único turno del lienzo es un pedido («agrégale una
notificación…», #700), que contestó dos veces «Gemini está saturado» (ver hallazgos-ia.md, 27/10). Tests:
tests/chat-mako-pregunta-en-editar.test.ts. Roturas, base 3 / 0: la regla vieja → 1 / 2; sin `sinMuletilla`, sin
`sinLoCitado`, sin `pideCambio` en los signos, sin «a (quien|cuantos)» o con «no tengo» como error → 2 / 1 cada una.

## El chat de Joan (MK-12): el 15/10 era el incidente de Gemini; el 16/10, el error que el 17/10 aprendió a corregir (27/10/2026)

Medido en los chats del lienzo (sólo lectura). **15/10, 14:02Z, ws13 (Código Inmobiliario):** el mismo pedido dos veces y,
a los 12 s, «Falló de nuestro lado, no de tus keys. Prueba más tarde.», sin una sola fila de IA. Era el incidente de esa mañana:
desde el 14/10 20:31Z Gemini contestaba 400 «Thinking level MINIMAL is not supported» y el error llegaba pelado. Lo arregló
230323411 (15/10, 14:47Z), que nombra a «Joan (ws17)»: los chats que fallaron son del ws13. **16/10, 21:26Z, el siguiente
intento llegó a los modelos** (Gemini, y la red de Groq y de Gemini) y falló por OTRA cosa: «MaKo armó el flujo pero quedó mal:
Un texto usa un dato de la reunión sin un esperar con antes de reunión…». El pedido era «cuando llegue un lead… un aviso al grupo
de WhatsApp con los datos del formulario, el día y la hora»: el modelo leyó «el día y la hora» como los de una REUNIÓN. Es el
mismo pedido que el ítem 1 (el aviso al grupo de un lead de formulario). **Ya atendido:** a0feecde9 (17/10, #847) hizo que ese
error le diga al modelo el arreglo de UNA tarjeta («Su reunión sigue en pie» delante), nombrando este mismo caso de Joan; antes
los cuatro proveedores lo repetían. Joan no volvió a pedirlo desde el lienzo: no está confirmado por ella.

## Quién cambió una automatización NO se puede saber: no hay registro de Publicar (27/10/2026)

#266 «Un Lead Entró 2», de Brigitte Eberlin (ws15), perdió el 23/10 a las 14:05:22Z la espera de 1 h y el recordatorio
«🚨 *RECORDATORIO IMPORTANTE*: Entró {{nombre}}, lo contactaron?». Quedó `entrada → WhatsApp`. Medido en producción (sólo
lectura, P12):
- ese minuto no hubo IA de «Editar» (`anthropic_usage`), ni acción de la API de MaKo sobre la 266
  (`mako_acciones_pendientes`), ni borrador;
- fue un **Publicar de la pantalla**;
- `nutricion_secuencias` guarda `updated_at` y nada más, así que **quién** publicó no se sabe.

**La regla:** antes de decir «lo cambió X», se miran `anthropic_usage` y `mako_acciones_pendientes` de ese minuto; si no
hay nada, fue la pantalla y no se sabe quién.

**Lo que falta:**
- un registro de publicaciones (quién, cuándo, qué tarjetas cambió), en la pantalla y en la API;
- devolverle a la 266 la espera y el recordatorio. Es una escritura en el negocio de Brigitte: la pide el Cerebro.

## La prueba A/B como CONDICIÓN era el diseño obvio y el equivocado; y lo que una bifurcación nueva rompe en silencio (25/10/2026)

**Vive en:** `lib/flujo-grafo.ts`, `lib/flujo-forma.ts`, `lib/nutricion-grafo-motor.ts`, `lib/nutricion.ts`.

- **Lo obvio era agregar «Prueba A/B» al catálogo de condiciones.** No sirve: una condición pegada a otra no se puede guardar
  (`condicion_pegada`, `lib/flujo-forma.ts`), tiene «Si no» y elige la primera fila que se cumple (rompe los porcentajes), y el
  motor la RE-EVALÚA antes de mandar (`condicionDeArriba`). La tarjeta es una clase nueva (`ab`), como manda AGENTS.md para un nodo
  que «hace otra cosa».
- **Una bifurcación nueva apaga sin aviso la guarda de los recordatorios.** `condicionDeArriba` sólo reconoce como guarda a un
  padre directo de clase `condicion`, y `minutosAntesDeReunion` sólo sube por padres `condicion`. Con una tarjeta en el medio,
  «Su reunión sigue en pie» deja de re-evaluarse y puede salir «Mañana es tu reunión» para una reunión cancelada. Regla: toda clase
  que bifurca es TRANSPARENTE para esas dos funciones y para las reglas de forma, con test probado rompiéndolo.
- **`=== 'condicion'` aparece ~70 veces en 20 archivos**, no 20: se usa un helper (`esBifurcacion()`) y se lista lo revisado.
- **El insert principal de `nutricion_envios` ignora su error, y el presupuesto anti-ban de 24 h CUENTA esas filas.** Una columna
  nueva que falte en producción deja de guardar la fila sin que nadie se entere: el mensaje sale sin contarse y la línea pasa su
  tope. No se agregan columnas a ese insert sin antes revisar su error.
- **`generarVariantes` no tiene llamador** (`action:'variantes'` en app/api/chat-agent/secuencias no lo usa nadie): hoy nadie
  regenera las variantes anti-ban.
- **El AI Step no se puede probar con una tarjeta A/B**: es un «Si responde» con `paso_ia`, no corre en la salida y hay uno por
  medio. Probar el setter es otro diseño (sortear al momento de la respuesta).

*25/10/2026, el Cerebro (claude5), con los relevamientos de pruebas A/B y de conexiones (docs/diseno-pruebas-ab.md, docs/conexiones-y-ayuda.md).*

## Lo que más muerde

- **Un flujo nunca pasa por `legadoAGrafo`, y tener ids no lo hace un flujo.** El conversor arma la
  salida recorriendo el array en fila: sobre un flujo con ramas las aplasta → [El modelo](#el-modelo).
- **La entrada es `raizSalida`, nunca `pasos[0]`, y «lo que sigue» sale de los puertos, nunca de
  `pasos.slice`.** Debajo, en el array, puede haber otra rama → [El motor](#el-motor).
- **«Otra cosa» cierra la CHARLA, no el estado.** Congelar en 'handoff' «como antes» deja la
  inscripción sin salida; no cerrar nada deja a MaKo contestando solo mientras le habla una persona
  → [El motor](#el-motor).
- **La LIMPIEZA de la estrategia no es inerte.** `logrado: 'ninguno'` cambiaba lo que MaKo le
  escribía al lead y lo dejaba sin post-agenda al reagendar → [El modelo](#el-modelo).
- **Lo que la pantalla afirma sale de la regla del motor.** La casilla «Revisar» pintaba «sale sola»
  y el motor dejaba un borrador → [El lienzo](#el-lienzo).
- **«A mi WhatsApp» le escribía al cliente**, y el arreglo obvio (`getPerfil`) devuelve al admin del
  cliente → [«Probar» y la página](#probar-y-la-página).
- **Un CRM nuevo con sus leads AGREGADOS inscribía a CERO, sin un error** (21/10/2026): la cohorte miraba sólo la casa
  (`leads.funnel_id`); ahora mira también `lead_funnel` → [La prospección del Sprint](#la-prospección-del-sprint-de-mauricio-el-crm-nuevo-no-inscribía-a-nadie-y-el-cupo-era-de-la-campaña-21102026).
- **Un escritor que no sabe de ramas aplana un flujo SIN ERROR**: una lista es un flujo válido.
  `armarSecuenciasDeAudios` (onboarding) lo hacía en cada carga sobre #198/#212/#213 →
  [Escritores que no saben de ramas](#escritores-que-no-saben-de-ramas-aplanaban-un-flujo-sin-error-cosecha).

---

## El modelo

### «Volver al principio» dejaba la salida sin raíz: un salto no es un padre [P]

**Síntoma:** un flujo que termina en «Ir a» la PRIMERA tarjeta (el «volver al principio» de
ManyChat, con una espera en el medio) pasaba `validarGrafo` sin un error y su salida no arrancaba
nunca. Medido: `[m1 → esperar 1 día → ir_a m1]` daba `raiz = null` y `errores = []`, y «Probar»
mostraba «Sin tarjetas».

**Causa:** `raizSalida` salteaba todo nodo que fuera destino de un salto, y el destino era justo la
raíz. `validarGrafo` contaba los destinos de salto como alcanzables, así que no marcaba nada suelto.

**Regla:** la raíz se elige por PUERTOS: el primer nodo que ningún puerto apunta y que no es «Si
responde». Ser destino de un «Ir a» no lo descarta, y un salto tampoco salva a una tarjeta suelta:
a la que sólo se llega saltando es una segunda salida que nadie dibuja. Arreglado en la base
(`ebdb5003`).

**Vive en:** `lib/flujo-grafo.ts` (`raizSalida`, `validarGrafo`) · `tests/flujo-grafo.test.ts`

### Tener ids no es ser un flujo, y un flujo nunca pasa por `legadoAGrafo` [P, L, M]

**Síntoma:** tres partes lo vieron por separado. Un flujo con ramas que traía algo de antes encima
(un `delay_horas` que volvió a poner la API de MaKo, o la estrategia todavía sin limpiar) se habría
vuelto a convertir: el lienzo lo mostraba en una sola fila y «Probar» le sumaba un segundo «Si
responde» con los casos viejos.

**Causa:** `legadoAGrafo` arma la salida recorriendo el ARRAY en fila y pisa `siguiente`: sólo
sirve para listas. Y `tieneLegado` miraba la estrategia y los `delay_horas` aunque los pasos ya
fueran un grafo.

⚠️ **El atajo obvio, «si tiene ids ya es un flujo» (`esGrafo`), es el equivocado.**
`setSecuenciaPasos` le pone `id: o<i>` y `siguiente` explícito a toda lista de antes en el primer
guardado: una lista guardada tiene ids y sigue siendo una lista que se puede convertir.

**Regla:** la pregunta es `esFlujoExplicito`: hay una tarjeta de control, o algún `siguiente` que no
es el elemento siguiente del array. Sobre un flujo, `tieneLegado` contesta false y `legadoAGrafo`
devuelve los pasos normalizados sin tocarlos. Si en un flujo queda algo de antes en un PASO, se
marca en la tarjeta y el motor lo sigue haciendo; si queda en la ESTRATEGIA, se limpia al publicar.
Vale para el lienzo, «Probar» y `scripts/migrar-secuencias-a-grafo.mts`.

**Vive en:** `lib/flujo-legado.ts` (`esFlujoExplicito`, `tieneLegado`) ·
`app/automations/SecuenciaPerfil.tsx` · `lib/simulador-grafo.ts` (`flujoParaProbar`)

### La LIMPIEZA conserva el logro: `logrado: 'ninguno'` parecía inerte y no lo era [motor-4, motor-8, lienzo-8]

**Síntoma:** después de convertir #212 y #213, el lead que contestaba quedaba en 'respondio' para
siempre: cuando reagendaba no le salía la post-agenda de la reunión nueva (decisión del 06/10:
«también con reunión nueva») y además bloqueaba la otra mitad. Y el redactor de «MaKo contesta» le
escribía otra cosa que antes, para el mismo caso.

**Causa:** la limpieza pisaba `desenlace.logrado` con 'ninguno'. Con 'respondio', `evaluarDesenlaces`
era lo único que cerraba como lograda la inscripción del que contestó; y `responderSimulador` le
dice al modelo cuándo se cumplió el objetivo con ese mismo campo («esta secuencia no cierra sola» en
vez de «el lead contesta cualquier cosa»).

**Regla:** `limpiezaPara(est)` conserva `logrado` y apaga sólo lo que ahora hacen las tarjetas: la
etapa, el «sigue con» y el fallo por silencio. Con `agendo`/`pago` en un flujo, `evaluarDesenlaces`
no interrumpe: lo hacen las condiciones. Y **sin estrategia no hay nada que limpiar**:
`estrategiaConLimpieza(null)` le inventaba `objetivo: 'agendar'` a una secuencia que no tenía
ninguno, y desde ahí `encadenar()` salteaba a todo lead que ya había agendado. Si una función recibe
null y tiene que «limpiar», devuelve null y quien llama no escribe nada.

**Vive en:** `lib/flujo-legado.ts` (`limpiezaPara`) · `lib/flujo-conversacion.ts`
(`estrategiaConLimpieza`) · `lib/nutricion-desenlace.ts` · `lib/setting-simulador.ts`

### Lo que el conversor genera tiene que existir en el registro [lienzo-2]

**Síntoma:** una secuencia de antes con «Termina si… → etapa» se abría con tarjetas «Acción
mover_lead_etapa» (el id crudo) y no se podía publicar: «"mover_lead_etapa" no es una acción de
MaKo». El script de migración las escribía igual, porque sólo corre `validarGrafo`.

**Causa:** `OP_MOVER_ETAPA` era un nombre que ningún `.def.ts` declara, y `validarGrafo` mira la
forma, no las operaciones.

**Regla:** la operación es `proponer_cambio_etapa`, y un test pasa por `porId` + `esAccion` cada
operación que genera `legadoAGrafo`. Lo que un conversor escribe se valida contra lo que el motor
ejecuta, no contra lo que el conversor cree (`b6f43009`).

**Vive en:** `lib/flujo-legado.ts` (`OP_MOVER_ETAPA`) · `lib/nutricion.ts` (`setSecuenciaPasos`) ·
`tests/flujo-grafo.test.ts`

### Se convierte lo que el motor LEE: la estrategia parseada [M]

**Síntoma:** convertir desde la estrategia CRUDA inventaba casos y desenlaces en secuencias cuyo
motor no los ejecutaba.

**Causa:** `parseEstrategia` devuelve null si falta `objetivo`, y el motor lee la parseada: una
cruda sin objetivo, para él, no es asistida ni tiene desenlace.

**Regla:** `legadoAGrafo` recibe la estrategia PARSEADA, la limpieza va sobre la parseada y el
objeto se guarda entero.

**Vive en:** `scripts/migrar-secuencias-a-grafo.mts`

### Trampas menores del modelo

- **Los ids `n…` son aleatorios a propósito; los `o<n>` son estables** [M]. `nuevoId` no reusa el id
  de un nodo borrado (una inscripción parada ahí seguiría por la tarjeta nueva). Por eso un dry-run
  del script se compara con lo aplicado por los `o<n>` y por la forma, nunca por los ids nuevos.
- **«Ir a» sólo entra en una salida VACÍA** [L]. `insertarNodo` no le cuelga a un salto lo que
  había en ese lugar: insertado en el medio de una flecha, dejaba suelto todo lo que seguía. Lo
  valida `insertarDesdeLienzo`, no sólo el menú del ＋.
- **`textoFila` escribe en días las horas múltiplo de 24 desde 48** [L]: «72 h» sale «3 días». Para
  comparar el texto de una fila, `textoFila` o un número que no sea múltiplo de 24.

---

### Escritores que no saben de ramas aplanaban un flujo sin error [cosecha]

**Síntoma:** encontrado al cosechar, DESPUÉS de convertir en producción #198/#212/#213 (por suerte
antes de que se abriera el onboarding): esas secuencias podían volver a ser una lista de uno o dos
pasos sin que nada avisara, y con la estrategia ya limpia se perdían «Si responde» y sus casos.

**Causa:** `armarSecuenciasDeAudios` (`lib/secuencias-audios.ts`) corre en CADA carga del paso del
onboarding (`GET /api/chat-agent/onboarding/resumen`) y en la operación `armar_secuencias_de_audios`,
y hacía `.update({ pasos: plan.pasos })` directo, sin `setSecuenciaPasos`. ⚠️ El diagnóstico de la
parte del motor («los escritores sin guarda pasan por `setSecuenciaPasos`, lo peor es un 400») era
cierto para /email y falso para éste. Y aunque hubiera pasado por `setSecuenciaPasos`, no habría
fallado: **una lista lineal es un flujo VÁLIDO**, así que `validarGrafo` no tenía nada que objetar.

**Dónde:** `lib/secuencias-audios.ts` (`audiosDeLaListaEnElFlujo`), `lib/nutricion.ts`
(`setSecuenciaPasos` → `puedePisarFlujo`), `lib/flujo-legado.ts`, `tests/flujo-grafo.test.ts`.

**La regla:** sobre un flujo de tarjetas (`esFlujoExplicito`) nadie escribe la lista entera.
Re-grabar un audio le cambia el `audio_id` a su tarjeta (`o<k>`, el id que conserva la conversión) y
nada más. Y la red general está en `setSecuenciaPasos`: si lo guardado es un flujo y lo nuevo no
trae ni un id, se rechaza con «se edita en /chatbot» (el lienzo manda siempre sus ids). Un escritor
nuevo de `pasos` que arme la lista de cero choca con esa red en vez de aplanar en silencio.

## El motor

### «Misma persona» apagada por defecto sin cambiarle nada a nadie, y en cualquier orden (23/10/2026)

**El pedido:** Martín, «"Misma persona" apagado por defecto» y «nada para todas». Lo ingenuo es cambiar el default, pero
AUSENTE quiere decir «la del negocio» (20 h): 510 de las 518 automatizaciones de producción se habrían apagado de golpe y le
habrían mandado dos mensajes seguidos a la misma persona. **La primera vuelta también estaba mal:** ausente = apagada, con un
script que había que correr ANTES del deploy. El Cerebro lo frenó: un deploy sin el script era una trampa armada. **Cómo
quedó:** «sin las suyas» sigue siendo la del negocio (`personaHorasDeLaAutomatizacion` no cambió), y lo de «apagado por
defecto» se cumple al NACER: cada alta guarda la suya apagada (`CONFIG_DE_NACIMIENTO`, `nacerConfigAutomatizacion`). El
script (`fijarPersonaPropia`, scripts/misma-persona-propia.mts) es una limpieza que guarda como suyo lo que cada vieja
heredaba, antes o después del deploy, igual da. Es un script y no un `.sql` porque lo heredado sale de
`limitesVigentes(raw, limitesDeFabrica(env))`. El test compara los TRES órdenes contra la regla de hoy en 48 casos.
**La trampa que destapó:** el aviso de Prospección de Publicar («revisa su horario y sus límites») salía sólo si la
automatización no tenía NADA propio (`tieneConfigPropia`), y ahora todas nacen con algo. Es la trampa del backfill de
AGENTS.md («invierte en silencio a todo el que cuenta filas»), pero con un campo: ahora mira el ritmo (`tieneRitmoPropio`:
horario o goteo). **Reglas:** un default nuevo va AL NACER, no cambiando qué significa «ausente»; y antes de que todas
tengan algo, grepear quién pregunta «¿tiene algo?». **Y el barrido de las altas** (que cada insert en
`nutricion_secuencias` la haga nacer apagada) dejó pasar dos roturas en su primera versión: una llamada después del
`return` y una segunda alta en un archivo ya listado. Ahora cuenta las altas por archivo y mira el orden.
**Vive en:** lib/config-automatizacion.ts · lib/config-automatizacion-db.ts (`nacerConfigAutomatizacion`) · las altas
(lib/setting-secuencias.ts, lib/plantilla-crear.ts, lib/flujo-copia-negocio.ts, lib/secuencias-audios.ts) ·
scripts/misma-persona-propia.mts · app/automations/ConfiguracionesBoton.tsx · tests/misma-persona-propia.test.ts.
*23/10/2026, chat «Automations» (claude2).*

### «Misma persona» se fue entera, y el «apagado» no estaba apagado (23/10/2026, más tarde)

**El pedido:** Martín, «elimina "Misma persona"»; el Cerebro: si la pantalla no la muestra, el motor no la puede seguir
aplicando (sería una regla escondida). Esto deja sin efecto la entrada de arriba: el «nacer apagada» y el script se fueron
con ella. **El diagnóstico obvio («ponerla en 0 h para todas») era el equivocado:** una automatización con «Misma persona»
APAGADA (0 h) igual frenaba 3 h a los leads con una reunión en las próximas 48 h, porque `leadsConEnvioReciente` partía los
leads en dos ventanas y la de la reunión cercana (`HS_MIN_PREPARACION`) no miraba la configuración. Sacarla de verdad es
sacar la VENTANA, no bajarla a cero. Queda el freno de la MISMA corrida (`frenadoPorAntiBan` con `enviadoEnCorrida`): dos
mensajes al mismo lead en el mismo minuto no salen juntos. Eso no es una espera, es no mandar dos veces. Lo que cambió en
producción: 19 automatizaciones activas tenían 20 h; desde el deploy, manda la espera de cada flujo. **Y «por qué no sale»
mentía en otra cosa:** daba por libre de los topes de la línea a un lead con la reunión cerca (`sinAntiBan`), y el motor
nunca lo eximió (`pasaPorAntiBan` sólo saltea el carril). **Regla:** apagar una regla del motor es buscar TODAS las ramas que
la aplican, no el valor que la configura.
**El goteo del Email destapó otra:** `sinLugar` no miraba el canal, así que el goteo de WhatsApp frenaba también al email
de la misma automatización. Ahora cada canal frena con su goteo (`sinLugar(insc, canal)`, `goteoEmail`).
**La vista previa del link:** se movió dos veces el mismo día, de la tarjeta a Configuraciones y de Configuraciones al
mensaje. El lugar lo decía el pedido: «donde haya pegado el link». Quedó en el editor del WhatsApp, con su X, que es
`sin_vista_previa` de ese mensaje. **Una trampa al detectar el link** (`primerLink`): con `\S+` se come la puntuación
pegada («www.x.com.»), y como la tarjeta vuelve cuando el link cambia, escribir un punto después la hacía volver sola. Se
recorta como lo hace WhatsApp, y no a los datos `{{…_link}}`.
**Vive en:** lib/nutricion.ts (la ventana se fue; `goteosEmail`, `sinLugar`, `quedaFrenada`) · lib/config-automatizacion.ts ·
lib/por-que-no-sale.ts · lib/mensaje-partes.ts (`primerLink`) · app/automations/FlujoLienzo.tsx (`VistaPreviaDelLink`) ·
app/automations/ConfigAutomatizacionPanel.tsx · app/automations/FilasOpciones.tsx (`debajo`) ·
tests/punto5-goteo-email-y-vista-link.test.ts. **Sin hacer:** `lib/limites-envio.ts` sigue teniendo `personaHoras` del
negocio (tipos, rangos), y ya nadie lo lee.
*23/10/2026, chat «Automations» (claude2).*

### La entrada es `raizSalida`, nunca `pasos[0]`, y el índice se traduce en UNA puerta [M, motor-10, lienzo-1]

**Síntoma:** tres caras del mismo dato. Una inscripción que nunca avanzó (`paso_actual` 0,
`nodo_actual` NULL) quedaba parada en «Si responde» cuando el lienzo dejaba esa tarjeta primera en
el array. Un lead de la rama A cuyo nodo se borró recibía el mensaje de la rama B. Y una inscripción
de antes del deploy con `paso_actual = 1`, sobre una #212 publicada desde el lienzo, leía
`pasos[1]` del array nuevo, que es el audio que ya había recibido: le salía otra vez.

**Causa:** `paso_actual` es un ÍNDICE del array, todo lo que inscribe escribe 0, y con ramas el
array cambia de orden en cada conversión o borrado.

**Regla:** `indiceActual` es la única puerta. `nodo_actual` que existe → ése; que ya no existe → -1
(se cierra con rastro); NULL con `paso_actual` 0 → la entrada (`raizSalida`); NULL con k > 0 →
primero el id `o<k>` (el que `legadoAGrafo` conserva) y sólo después el índice. El primer envío al
inscribir lo programa `pasoDeEntrada`.

**Vive en:** `lib/nutricion-grafo-motor.ts` (`indiceActual`, `indiceEntrada`, `pasoDeEntrada`) ·
`lib/nutricion.ts` (`procesarEnvios`, `planificarEnvios`, `pausarPorRespuesta`) ·
`tests/flujo-motor-grafo.test.ts`

### «Lo que viene después» sale de los puertos y de los saltos, nunca del array [M]

**Síntoma:** la regla del canal apagado («¿queda algo enviable después?») contestaba sobre lo que
había más abajo en el array.

**Causa:** ⚠️ el diagnóstico obvio («miremos el resto de los pasos») era el equivocado: con ramas,
lo de abajo puede ser OTRA rama que este lead no va a recorrer.

**Regla:** todo «después» sale de `puertosDe` y de los «Ir a» a una tarjeta (`alcanzablesDesde`),
nunca de `pasos.slice(i + 1)`.

**Vive en:** `lib/nutricion-grafo-motor.ts` (`alcanzablesDesde`) · `lib/nutricion.ts` (`canalOn`)

### En la misma corrida sólo se avanza por lo que no es un mensaje [M]

**Síntoma:** si después de un mensaje se miraba lo que seguía en la misma corrida (`otraVuelta`),
un segundo mensaje pegado quedaba en «saltado: msg <20h» en cada envío.

**Causa:** `leadsConEnvioReciente` se recalcula por lote leyendo la base y ve el envío que se acaba
de hacer.

**Regla:** en la misma corrida se resuelve sólo lo que no es un mensaje (condición, espera,
acción); otro mensaje sale en la corrida siguiente, como siempre.

**Vive en:** `lib/nutricion.ts` (`avanceDesde`)

### «Otra cosa» cierra la CHARLA, no el estado [motor-3, M]

**Síntoma:** en #212/#213 convertidas, el lead escribía algo fuera de guion, «Otra cosa» avisaba, el
dueño se ponía a hablarle a mano… y al mensaje siguiente («listo, confirmo el martes») MaKo le
contestaba solo por el caso «Confirma», en medio de la charla de una persona.

**Causa:** `responderConGrafo` escribía `conversacion_ultima_at` en TODA rama, así que la charla
quedaba abierta y `seguirCharla` la retomaba. Antes la inscripción pasaba a 'handoff' y
`conversacionAbierta` la excluía.

⚠️ **Las dos salidas obvias eran las equivocadas.** Volver a congelar en 'handoff' «como antes»
deja la inscripción sin salida: `avisar_al_equipo` no crea fila en `chat_agent_handoffs` (nadie la
puede resolver), `evaluarDesenlaces` saltea 'handoff', `inscripcionReusable` la cuenta como no
terminada (bloquea la post-agenda al reagendar, la misma clase de bug que la limpieza) y
`resolverHandoff` reactiva sin `proximo_envio_at`, que la cola no levanta nunca. Y cerrar con
`conversacion_cierre = 'handoff'` no se puede: el CHECK de la 0203 sólo admite fin_bien, fin_mal e
insistencia.

**Regla:** un hand-off nuevo cierra la CHARLA: `conversacion_cerrada_at` puesto y
`conversacion_cierre` null EXPLÍCITO (`undefined` quiere decir «no se leyó»). Lo lee
`cerradaPorUnaPersona`, y el motivo sale del ÚLTIMO cierre (`f33578dc`). Si algún día el CHECK suma
'handoff', cambian a la vez los dos escritores y `cerradaPorUnaPersona`. Medido el 08/10: 0
cierres en toda la base.

**Vive en:** `lib/nutricion.ts` (`responderConGrafo`) · `lib/setter-conversacion.ts`
(`cerradaPorUnaPersona`, `conversacionAbierta`) · `supabase/migrations/0203_charla_del_setter.sql` ·
`scripts/migrar-secuencias-a-grafo.mts`

### Un aviso deduplicado no es un aviso que salió [motor-1]

**Síntoma:** en #212, a las 37 h salía la tarjeta «no confirmó» (`avisar_al_equipo`, dedup por lead
12 h). Si dos horas después el lead escribía algo fuera de guion, «Otra cosa» avisaba… y el aviso
se descartaba por dedup. MaKo no contestaba y Mauricio no se enteraba. Y el aviso decía «Te
escribió algo que no sé contestar», sin el mensaje.

**Causa:** `avisoDelFlujo = true` se marcaba ANTES de correr la acción y sin mirar si salió, y eso
apagaba el aviso de respaldo, el único con el texto del lead. Las dos tarjetas usaban el mismo tipo
y la misma clave. El hand-off de antes mandaba el texto literal, sin dedup y con otro tipo.

**Regla:** se marca sólo si la acción emitió de verdad. Como `aplicarEnElActo`
(`lib/api-mako/flujo.ts`) descarta los `datos` del resultado, la señal viaja en el PREFIJO del
resumen (`AVISO_REPETIDO`): una constante que comparten el runner y el motor, con test, nunca una
comparación con texto libre. Y el aviso de «Otra cosa» lleva el texto del lead y una clave por
respuesta.

**Vive en:** `lib/nutricion.ts` (`responderConGrafo`) · `lib/nutricion-grafo-motor.ts`
(`AVISO_REPETIDO`, `avisoSalio`) · `lib/api-mako/areas/chatbot.run.ts` (`avisar_al_equipo`)

### Saltar a otra automatización no reinicia lo terminado [motor-2]

**Síntoma:** el «Sigue con» convertido (`ir_a { secuencia_id }`, #198 → #212) le reenviaba la
secuencia entera a un lead que ya la había completado, quizás para la misma reunión. Apuntando a sí
misma, era un bucle que reenviaba todo en cada vuelta.

**Causa:** el motor lo resolvía con `inscribirEnSecuencia`, que aplica las reglas de la inscripción
MANUAL («lo terminado se puede volver a arrancar»). Antes, `encadenar()` cortaba ante cualquier fila
previa.

**Regla:** desde un flujo, `inscribirEnSecuencia` va con `desdeFlujo`: cualquier fila previa es «ya
estuvo» y además mira `hitoYaHecho`. Un «Ir a» a la propia automatización se rechaza al guardar
(`irAEstaMisma` en `setSecuenciaPasos`: `validarGrafo` no sabe el id de la secuencia).

**Vive en:** `lib/nutricion.ts` · `lib/nutricion-inscripcion-manual.ts` · `lib/nutricion-grafo-motor.ts`
(`irAEstaMisma`)

### Un mensaje fijo de «Si responde» se reclama por (inscripción, nodo) [motor-5]

**Síntoma:** «Otra cosa» → «¡Gracias! En un rato te respondo» se repetía con cada mensaje del lead
durante los 7 días de la charla, sin anti-ban ni tope.

**Causa:** `mandarMensajeDeRespuesta` no tenía reclamo; la acción sí (`reclamarEspaciado`).

**Regla:** antes de mandar, `reclamarEspaciado` por (inscripción, nodo) con 20 h. El costo
aceptado: el reclamo va antes de mandar (la regla de la casa), así que un envío que falló también
ocupa la ventana, y el aviso lo dice («ya salió (o se intentó)»).

**Vive en:** `lib/nutricion.ts` (`mandarMensajeDeRespuesta`)

### Sólo un MENSAJE sube por las condiciones hasta la espera anclada [motor-6, M]

**Síntoma:** con «1 día antes de la reunión → condición → mensaje», si el lead movía la reunión
salía «Mañana es tu reunión» cuatro días antes, o para una reunión cancelada.

**Causa:** `minutosAntesDeReunion` miraba sólo el padre directo, que era la condición: el mensaje
quedaba sin anclar, sin re-anclaje y sin cierre por reunión pasada.

⚠️ **«Subir por todos los padres que no esperan» era el arreglo equivocado:** subiendo también
desde una ACCIÓN, la acción del logro («ya pagó → muévelo»), que cuelga de la condición, quedaba
anclada y se postergaba hasta la reunión nueva.

**Regla:** sólo un mensaje sube por las condiciones hasta la primera espera; una acción mira su
padre directo.

**Vive en:** `lib/nutricion-grafo-motor.ts` (`minutosAntesDeReunion`) · `lib/nutricion.ts`

### Sin la 0223, el webhook se comía la primera respuesta, y tirar ante cualquier error era peor [motor-9, M]

**Síntoma:** desplegado sin la 0223, `pausarPorRespuesta` marcaba la inscripción 'respondio'
(columnas viejas: sale bien) y después `getSecuenciasConStats` pedía `etiqueta_id` y fallaba; el
`catch` se la tragaba. Sin borrador ni aviso, y aplicar la 0223 después no la recuperaba. La
cabecera de la 0223 decía «falla cerrado, nada se pierde» mirando sólo el cron.

**Causa:** PostgREST rechaza la consulta ENTERA si falta una columna, y el orden era marcar → leer.

⚠️ **El arreglo obvio (leer antes de marcar y tirar ante cualquier error) empeoraba otro caso:** ante
un error pasajero el lead quedaba 'activa' y la corrida siguiente le mandaba el próximo mensaje de
prospección a alguien que acababa de contestar.

**Regla:** se tira sólo cuando FALTA UNA COLUMNA (42703 o PGRST204: `esColumnaInexistente`);
cualquier otro error pausa como siempre. Una TABLA que falta es otra cosa (PGRST205 o 42P01:
`esTablaInexistente`) y sí se tolera donde se lee `crm_lead_etiquetas`. «does not exist» aparece en
los dos mensajes: una regex floja confunde columna con tabla. Y la migración va antes del deploy;
un script que lee la columna nueva la prueba al arrancar y con `--aplicar` se niega sin ella. Las
trampas de PostgREST, en [hallazgos-infra.md](hallazgos-infra.md).

**Vive en:** `lib/nutricion.ts` (`pausarPorRespuesta`) · `lib/nutricion-grafo-motor.ts`
(`esColumnaInexistente`, `esTablaInexistente`) · `supabase/migrations/0223_flujo_grafo.sql` ·
`scripts/migrar-secuencias-a-grafo.mts`

### El disparador por etiqueta sin horario es SÓLO el evento [etiquetas-1, datos-1, motor-7]

**Síntoma:** poner una etiqueta en lote, o por el espejo de una etapa, no disparaba en el acto (lo
promete el diseño: «una acción en lote no dispara»)… y en la corrida horaria siguiente el barrido de
la cohorte inscribía a todos los que la tenían: 150 leads, 40 por día por la línea no oficial,
delante de la post-agenda.

**Causa:** `leadsConEtiqueta` devolvía todas las filas de `crm_lead_etiquetas` sin mirar quién la
puso, y una secuencia sin horario da `toca: true` en cada corrida.

⚠️ **El mismo mecanismo salió CONFIRMADO dos veces y REFUTADO una (motor-7) en la misma
revisión.** No se contradicen: el refutador juzga la AFIRMACIÓN, no el mecanismo. «Barre a perdidos
y a leads de hace meses» era una decisión escrita en el código («SIN FILTRO, a propósito»); «el
lote dispara por la puerta de atrás» contradecía una promesa de la pantalla.

**Regla:** sin horario, una secuencia por etiqueta corre SÓLO por el evento; con horario, el barrido
alcanza a los que la tienen, porque eso eligió el dueño al poner el horario. Vive en
`barridoInscribe`. Si Martín quiere que «Se le puso X» sin horario alcance a quien ya la tenía, es
una decisión suya.

**Vive en:** `lib/nutricion-grafo-motor.ts` (`barridoInscribe`) · `lib/nutricion.ts`
(`comprometerInscripciones`, `leadsConEtiqueta`) · el lado de las etiquetas, en
[hallazgos-crm.md](hallazgos-crm.md)

### Elegir un disparador no toca el producto: ausente no es null [motor-11]

**Síntoma:** cambiar el disparador de una secuencia con producto a un evento o a una etiqueta le
escribía `funnel_id: null`, que es «todos los embudos»: la próxima corrida inscribía leads de todos
los productos.

**Causa:** `pedidoDisparo` no manda `funnel_id` para esos disparadores, y la ruta convertía el
ausente en null.

**Regla:** ausente = no se toca; `funnel_id: null` explícito = todos los embudos. La ruta distingue
`'funnel_id' in body`. Hoy no afecta a ninguna fila (0 secuencias con `funnel_id`, medido el 08/10).

**Vive en:** `app/api/chat-agent/secuencias/route.ts` · `lib/setting-secuencias.ts`
(`setTriggerSecuencia`) · `lib/flujo-conversacion.ts` (`pedidoDisparo`)

### Un mensaje que pasa a archivo o a voz suelta sus variantes [costuras-1, C]

**Síntoma:** un paso de texto con variantes (las que escribe MaKo al armar la secuencia) pasaba a
PDF con el caption «Te dejo la info 👇», y a 3 de cada 4 leads les llegaba el PDF con un texto viejo
como caption; con el caption vacío, a todos. «Probar» mostraba el bueno (`p.cuerpo`), así que la
prueba no lo detectaba.

**Causa:** `pasoAMedia` no tocaba `variantes`, y `textoDelPaso` sólo cortaba el sorteo para un
audio.

⚠️ **«El editor no manda el cambio» era el diagnóstico equivocado:** el editor sí manda
`variantes: []`; el merge de `setSecuenciaPasos` trata un `[]` igual que la clave ausente y repone
las guardadas.

**Regla:** `textoDelPaso` devuelve `cuerpo` para audio y archivo; `pasoAMedia` y `pasoAVoz` dejan
`variantes: []`; el «↻ N» sólo se dibuja en un mensaje de texto. Y un merge que conserva un campo
cuando «no viene» separa ausente (`undefined`) de vacío (`[]`), o la persona no puede borrar ese
campo nunca. Esa última mitad NO está hecha (ver abajo).

**Vive en:** `lib/nutricion-canal.ts` (`textoDelPaso`) · `lib/guion-audio.ts` (`pasoAMedia`,
`pasoAVoz`, `cambiosDePaso`) · `app/automations/EditorMensajeWhatsApp.tsx` · `lib/nutricion.ts`
(`setSecuenciaPasos`)

### Las guardas de texto del motor anclaban en la forma del modelo viejo [M]

**Síntoma:** al pasar el motor al grafo se pusieron rojos 29 tests sin un solo bug de
comportamiento.

**Causa:** las guardas anclaban en expresiones literales del modelo de antes:
`sec.pasos[insc.paso_actual + 1]`, `insc.paso_actual === 0 && sec.antiguedad_max_horas`,
`.update({ pasos: limpio`, el cuerpo entero de `asistirRespuesta`.

**Regla:** antes de cambiar el modelo de un motor, se grepean sus anclas en `tests/`, y se ancla en
funciones o constantes con nombre (`topeAntiguedad`, `avanceDesde`, `anclada`), no en la forma de
una expresión. Dos más del mismo día:
- la guarda `/linea:/` no ve una propiedad abreviada (`{ …, linea }`): en las llamadas que una
  guarda cuenta por texto, la propiedad va explícita (`linea: c.linea`);
- `tests/nutricion-canal.test.ts` mide el tramo entre `const limpio = pasos` y `const { error } =`
  con un tope de 4000 caracteres: las validaciones nuevas de `setSecuenciaPasos` van ANTES de
  `const limpio`.

Y una del typecheck: `filtros: (q) => q.not(...) as ConsultaPaginada` dio TS2589 («Type
instantiation is excessively deep») en `hechosDeLeads`; con `.not` va sin el cast, como en el resto
del repo.

**Vive en:** `tests/antiguedad-cableada.test.ts` · `tests/setter-conversacion.test.ts` ·
`tests/lineas-whatsapp.test.ts` · `tests/nutricion-canal.test.ts` · los `tests/nutricion-*.test.ts`

---

## El lienzo

### La tarjeta «MaKo en WhatsApp» con tres desplegables arriba del mensaje, y de dónde salieron (23/10/2026)

**Síntoma:** en la #289 de Mauricio, la tarjeta abría con «Por dónde», «Sin grupo de MaKo» y «Fuera del horario» antes del
mensaje. Martín: «Completamente roto y no se entiende». **De dónde salieron:** de tres pedidos legítimos, cada uno resuelto
con un desplegable: `c46ee888f` (15/10, «que se pueda configurar que te mande el mensaje luego, cuando se abra la oficina»),
`12ac3cb85` (16/10, el reporte semanal de la plataforma por email al equipo) y `e94f798a3` (17/10, qué pasa si el
negocio no tiene grupo). Ninguno estaba mal por separado; sumados, la tarjeta dejó de parecerse a las demás.
**Medido en producción antes de sacarlos:** de 57 tarjetas de MaKo vivas, una sola sale por email (la #256 del ws9, el
reporte semanal, que sólo ve SuperAdmin), ninguna tiene «Sin grupo» elegido y 10 tienen «Lo manda igual» (9 del ws9 y la
#289). Lo guardado sigue valiendo: el motor no cambió. La #256 conserva su asunto, porque sin él no se puede corregir. «Fuera
del horario» lo dice el chip del lienzo y se cambia pidiéndoselo a MaKo (`fueraDeHorario` de la API).
**Regla (AGENTS.md):** una tarjeta no gana controles, y cada canal es su tarjeta. **Sin hacer:** decidir si la #256 pasa
a otra forma (hoy es la única tarjeta de MaKo por email). **Vive en:** app/automations/FlujoLienzo.tsx (`EditorMako`,
`AsuntoDeMako`) · tests/tarjeta-mako-como-las-demas.test.ts.
**Y la revisión de todas las tarjetas (puntos 1, 7, 8 y 11 del informe del Cerebro)** dejó otra trampa: el cartel «Espera a
que abra (mañana 9:00)» leía el horario del NEGOCIO desde el 15/10, y el 20/10 el motor pasó a usar el de CADA automatización
(9d291d844) sin que nadie tocara la tarjeta. **Regla:** lo que una pantalla dice sobre cuándo sale algo se calcula con la
MISMA función del motor (`horarioDeLaAutomatizacion`), o no se dice. El cartel se fue, porque `ChipEnCola` ya lo dice bien.
También se fueron el interruptor suelto «Vista previa del link» y el aviso cortado a 90 caracteres que veía el setter.
*23/10/2026, chat «Automations» (claude2).*

### Las otras ocho tarjetas de la revisión: lo roto entra de a uno, también lo que la cara DIBUJA (23/10/2026)

**Síntoma.** Después de la tarjeta de MaKo (la entrada de arriba, que trae la regla y los tres desplegables), la
revisión con escépticos confirmó otros hallazgos en las demás tarjetas. Ninguno lo había pedido Martín. Este chat
arregló ocho; los de `FlujoLienzo.tsx` (1, 7, 8 y 11) los tiene «Automations». El detalle con archivo:línea está en
`C:/dev/cerebro-herramientas/revision-tarjetas-automations-23-10.md`.

**El patrón, con estos ejemplos: cada uno entró solo, en una tanda que tenía otro foco, y nadie lo vio hasta abrir la
tarjeta.**
- **Una ACTION traída entera de la API** (57bc44ea4, 17/10, «Invitar al curso»): la def venía de la rama
  `wip/api-acciones-1410` con email escrito a mano, canales y reenviar. El editor dibuja todo parámetro que no esté
  escondido, así que la ACTION hacía de EMAIL y de WHATSAPP. Cualquier acción nueva de la API que entra a los flujos
  trae el mismo riesgo: `FUERA_DEL_FLUJO` (lib/api-mako/flujo-params.ts) es dónde se esconde, y lo leen el editor Y el
  motor.
- **Un canal nuevo que reusa el componente sin repasar lo de antes** (c9cdbdf3a, 14/10, el AI Step por Instagram y
  Messenger): volvió a ofrecer el chip de medio, pero no limpiaba el audio al cambiar y no le dio piel al Ensayo.
  Quedaba un audio guardado e invisible que frenaba Publicar con el paso «Escenarios» en rojo.
- **Lo que la cara dibuja contra lo que mide** (04f40af49, la foto de Instagram de hasta 90 px en un hueco de 34): el
  alto se calcula antes de pintar (lib/flujo-conversacion.ts) y lo que sobra se corta sin error. La zona del CRON
  (d98dd86aa) es el mismo caso en texto: tres renglones donde caben dos, y el corte se comía el «A quién».
- **Textos que quedan viejos**: «Producto» después del renombre a Funnel (53ba64509 no tocó CamposAccion), el motivo
  repetido junto al link de Pagos (184c0b377), y la marca «(de antes)» que la undécima tanda había rechazado.

Ningún test miraba la tarjeta entera. El revisor de cada tanda mira el diff, no la tarjeta abierta.

**Qué quedó.** Todo saca o corrige, nada suma. Lo fija tests/tarjetas-revision-23-10.test.ts, probado rompiéndolo:
- **4** «Invitar al curso» muestra sólo el Curso. Medido: ningún paso guardado usaba los otros tres.
- **2** la foto va como chip en la cara, igual que en WhatsApp.
- **3** pasar a Instagram o Messenger saca el audio de la tarjeta y de cada escenario (`cambioDeMedio`,
  lib/flujo-grafo.ts).
- **9** el Ensayo con `SimuladorSocial`, como «Probar».
- **10** «Funnel».
- **5** el link de Pagos sin el motivo repetido.
- **6** la zona sólo si la eligió la persona.
- **12** sin «(de antes)». Medido: 0 filas vivas lo tenían.

**Sin hacer.** No se vio en pantalla ni se chequearon los tipos en local (el vigía de RAM cortó `tsc-acotado`). La
pantalla se mira en el ws3 de producción después del deploy, sin guardar nada.

**Vive en:** `lib/api-mako/flujo-params.ts` (`FUERA_DEL_FLUJO`) · `lib/api-mako/flujo.ts` ·
`app/_components/EditorAccionMako.tsx` · `app/automations/social-ui.tsx` · `lib/flujo-grafo.ts` (`cambioDeMedio`) ·
`app/automations/ModalEnsayoAIStep.tsx` · `lib/disparadores.ts` (`textoDeDisparador`)
*23/10/2026, chat «Automations › Limpieza» (claude2).*

### Lo que la casilla pinta como heredado sale de la regla del motor [costuras-3, L]

**Síntoma:** en una secuencia que sale sola, «＋ caso» en «Si responde» creaba el «MaKo contesta»
con la casilla «Revisar antes de enviar» destildada (promete que sale sola), y el motor dejaba un
borrador: el lead no recibía respuesta hasta que alguien la aprobara.

**Causa:** el editor pintaba `paso.revisar ?? !envio_automatico` para cualquier mensaje; para un
`tipo: 'ia'` de «Si responde», el motor exige `revisar === false` estricto (`escenariosDeRespuesta` →
`contestaSolo`). Y `agregarCaso` creaba el mensaje sin `revisar`.

**Regla:** el valor heredado sale de la MISMA regla del motor (`revisarHeredado`, que llama a
`saleSolo` y a `escenariosDeRespuesta`, los dos puros), fijado con un test de MATRIZ que compara lo
que se pinta contra lo que hace el motor. La matriz no caza el valor con el que NACE un caso (pone
`revisar` a mano en cada vuelta): hacen falta los dos tests, el del nacimiento y el de la herencia.
`agregarCaso` crea con `revisar: true`, como el conversor.

**Vive en:** `lib/flujo-conversacion.ts` (`revisarHeredado`, `agregarCaso`) ·
`app/automations/FlujoLienzo.tsx` · `lib/nutricion-grafo-motor.ts` (`saleSolo`)

### Una tarjeta se nombra con lo que dibuja, y el error abre la tarjeta [L, lienzo-6]

**Síntoma:** primero, las tarjetas recién agregadas se publicaban vacías y los errores nombraban ids
(`n0abcde`). Después del primer arreglo, Publicar decía «Falta completar "Mensaje 4"» y ninguna
tarjeta lleva número: era la segunda «MaKo contesta».

**Causa:** `validarGrafo` mira la forma y no el contenido, y escribe con ids. `nombreDeTarjeta`
numeraba por el orden del array contando todas las clases de mensaje.

**Regla:** Publicar corre `validarGrafo` y después `faltaEscribir`, antes del PATCH. Una tarjeta se
nombra con su título visible más un trozo de lo que dice, y el título lo calcula UNA función que
usan el árbol y los errores (`tituloDeTarjeta`). Todo error, propio o del server, pasa por
`errorLegible`, que se come el sustantivo de `validarGrafo` («la condición X»; si no, queda «la
condición "Condición"»). Y el error ABRE la tarjeta culpable (`tarjetaDelError`).

**Vive en:** `lib/flujo-conversacion.ts` (`faltaEscribir`, `nombreDeTarjeta`, `tituloDeTarjeta`,
`tarjetaDelError`, `errorLegible`) · `app/automations/SecuenciaPerfil.tsx`

### Una tarjeta con salidas tiene alto FIJO: se mide por partes [L, costuras-7]

**Síntoma:** la nota de voz se cortaba: ni el pie (el link) ni el «Dice: …» se veían nunca, así que
una nota con link se veía igual que una sin link.

**Causa:** el punto de cada salida lo dibuja el lienzo AFUERA de la tarjeta, contado desde el pie
(`yDePuerto`). Por eso una tarjeta con `puertos` tiene alto fijo (`nodo.alto`) y `overflow: hidden`:
si creciera con su contenido, cada flecha saldría de la fila de al lado. Y el layout puro no sabía
si el audio tenía transcripción.

**Regla:** lo que se pinta adentro tiene que caber en el alto estimado; si no cabe, se ajusta la
estimación (`altoDeMensaje`, por partes y con las constantes de los estilos que la dibujan), nunca
el alto de la tarjeta. Lo que el layout puro no sabe le llega por una opción (`audioDe`).

**Vive en:** `lib/lienzo-grafo.ts` (`yDePuerto`, `ALTO_PUERTO`, `PIE_PUERTOS`) ·
`app/_components/Lienzo.tsx` (`TarjetaNodo`) · `lib/flujo-conversacion.ts` (`altoDeMensaje`)

### Una lectura que falla no es una lista vacía: la biblioteca tiene tres estados [costuras-6, costuras-11]

**Síntoma:** toda tarjeta de archivo decía «(no disponible)», o «document (no disponible)» sin
caption, sobre un PDF sano. Y una etiqueta archivada en una condición salía «Una etiqueta que ya no
está»: el dueño la reemplazaba creyendo que se había borrado.

**Causa:** la tarjeta le pasaba a `BurbujaHilo` un archivo con `url: null`, y la burbuja dice «(no
disponible)» siempre que falta la url. Y el lienzo pedía `/api/crm/etiquetas` sin `archivadas=1`.

**Regla:** la biblioteca se lee con tres estados (ok / error / cargando) y sólo «ok sin el id»
afirma que falta: con `[]` ante un error, la tarjeta diría «Un archivo que ya no está». Lo que se
busca por id para NOMBRARLO se pide incluyendo lo archivado. `GET /api/chat-agent/adjuntos` es sólo
para admin: un setter ve «Archivo».

**Vive en:** `lib/flujo-conversacion.ts` (`vistaDeArchivo`) · `app/automations/FlujoLienzo.tsx` ·
`app/automations/SecuenciaPerfil.tsx`

### Un guard de layout mide el ANCLAJE, no sólo que nada se pise [L]

**Síntoma:** el test «dos ramas no se pisan» seguía en verde con el bloque de ramas mal medido.

**Causa:** ⚠️ el diagnóstico obvio era el equivocado: ese error no produce solapes, porque el
apilado igual suma lo que cada subárbol sube por encima de su tope. Lo que rompe es el CENTRADO: el
bloque baja y las ramas de arriba dejan de estar arriba del puerto.

**Regla:** un guard de layout mide qué queda centrado contra qué. «No se pisan» lo garantiza el
apilado aunque la cuenta esté mal.

**Vive en:** `lib/flujo-conversacion.ts` (`bloque`, `medir`, `colocar`) ·
`tests/flujo-conversacion.test.ts`

### Con «Probar» abierto, la tarjeta a editar caía debajo del teléfono [lienzo-4, L]

**Síntoma:** al tocar una tarjeta con «Probar» abierto, la vista se corría hasta dejarla debajo del
panel; sin «Probar», se corría a x = 1024 y se cortaba contra el borde.

**Causa:** `vistaConPanel` hacía `panelAncho + margen * 2` con `margen = 12 + insetIzq`: el inset
izquierdo se contaba dos veces, y no había límite a la derecha.

⚠️ **El límite derecho ENMASCARA el error doble:** con «Probar» abierto el límite corta antes y el
test pasa igual; la rotura sólo se ve en el caso sin «Probar». Un límite nuevo se prueba también
donde no actúa.

**Regla:** un margen que ya incluye un inset no es simétrico: el borde libre se calcula una vez
(inicio + ancho + separación) y todo corrimiento lleva el tope del otro lado (`insetDer`). Es la
regla de AGENTS.md «Apoyar algo sobre el borde de un lienzo», del lado derecho.

⚠️ **Y el comentario del panel miente.** Dice que `panelAncho` es ancho de CONTENIDO, y
`app/globals.css` tiene `* { box-sizing: border-box }`: es el ancho exterior, y el `+ 30` del
`maxWidth` le saca 30 px de más en ventanas angostas. El reporte de construcción de L afirmaba lo
contrario; el de los arreglos leyó el reset global y lo desmintió. Antes de razonar sobre el modelo
de caja de una pieza compartida, se mira el reset global.

**Vive en:** `lib/lienzo-grafo.ts` (`vistaConPanel`) · `app/_components/Lienzo.tsx` (el `maxWidth` del
panel del nodo)

### Todo cambio sube como función del estado anterior, y «es tipear» es una propiedad del cambio [L, costuras-9, lienzo-7]

**Síntoma:** el composer manda dos cambios en el mismo tick (`onChange({ tipo })` y `onModoIA(on)`) y
el segundo pisaba al primero, cada uno con su foto de deshacer. Y tipear una variante apilaba una
foto por tecla: a los 30 caracteres se perdía la foto de antes de borrar una rama.

**Causa:** las closures de un mismo render ven los mismos `pasos`; y `soloTexto` aceptaba sólo
`cuerpo` y `asunto`.

**Regla:** todo cambio sube como FUNCIÓN del estado anterior (`onPasos(fn, apilar)`), con UNA foto
por tick (una bandera que limpia `queueMicrotask`); un cambio que no pasa por `onPasos` no se
deshace. «Es tipear» es mismo campo y misma forma (mismo largo de la lista): agregar o quitar una
variante sí apila (`cambioApila`).

**Vive en:** `app/automations/SecuenciaPerfil.tsx` (`onPasos`, `fotoAntes`) · `lib/flujo-conversacion.ts`
(`cambioApila`) · `app/automations/FlujoLienzo.tsx`

---

## «Probar» y la página

### El simulador corre el MISMO dato con las MISMAS funciones que el motor [P]

**Síntoma:** «no puedo interactuar para probarlo de verdad» (punto 10 del pedido).

**Causa:** ⚠️ el diagnóstico obvio (un bug de UI: el composer tapado, el chat en `readOnly`) era la
mitad. El simulador viejo recorría `pasos` con su propio orden (todos los de WhatsApp, también los
que se excluyen entre sí), resolvía variables con su propio reemplazo y contestaba con un setter
libre. La #198 tiene 0 casos: en producción toda respuesta iba a hand-off y MaKo callaba, y en el
simulador MaKo contestaba igual.

**Regla:** «Probar» usa `raizSalida`, `siguienteDe`, `claseDe`, `clasificarEscenario` con
`escenariosDeRespuesta` y el redactor de producción (`responderSimulador`); las variables, con
`aplicarVariables` y los ejemplos del catálogo. Sin «Si responde» dice «MaKo no contesta», que es lo
que pasa en producción. Y prueba lo de la PANTALLA: re-elegir en la lista la misma automatización
vaciaba la edición local y volvía a lo publicado [lienzo-5].

**Vive en:** `lib/simulador-grafo.ts` (`flujoParaProbar`, `iniciar`, `siguiente`, `elegir`) ·
`app/automations/PanelProbar.tsx` · `app/automations/SimuladorWhatsApp.tsx`

### Todo destino «a mi…» sale de la fila propia de la sesión [P, lienzo-3]

**Síntoma:** «A mi WhatsApp» venía precargado con el contacto de reportes del workspace. En el ws1
es el de Mauricio: si Martín probaba el flujo de un cliente, la prueba le llegaba al cliente, bajo el
rótulo «Tu número».

**Causa:** `user_telefono` y `user_email` son el contacto de REPORTES del workspace, no de quien
mira.

⚠️ **El arreglo obvio era el equivocado:** `getPerfil()` (`lib/perfil.ts`), con un admin parado en
un workspace ajeno, devuelve el perfil del ADMIN DEL CLIENTE (`usuarioDelPerfil`, «viendo como
cliente»): justo la persona a la que no hay que escribirle.

**Regla:** el destino sale de la fila PROPIA de la sesión (`getUsuarioActual`, y si no,
`buscarUsuarioPorEmail(sesion.email)`); sin fila propia, vacío. El campo es editable, el interruptor
nace apagado y el destino NO se guarda nunca (guardarlo cambiaría a dónde le llegan los reportes al
dueño). El primer mensaje real lleva «🧪 Prueba de MaKo», decidido en el server.

**Vive en:** `lib/simulador-grafo.ts` (`destinoDelQueMira`) · `app/api/chat-agent/simulador/route.ts`
(GET `?destino=1`) · `lib/perfil.ts` · `tests/chatbot-probar.test.ts`

### Lo que se repite SOLO no se reenvía; lo que dispara quien prueba, sí [datos-4, P]

**Síntoma:** con «A mi WhatsApp» prendido, un flujo mensaje → esperar → «Ir a» el mismo mensaje
mandaba unos 21 WhatsApp idénticos en segundos por la línea no oficial: el simulador no espera y
repite hasta `TOPE_SALTOS = 20`. Y la ruta mandaba texto libre a cualquier número, sin tope.

**Causa:** el envío real colgaba de cada mensaje dibujado, y el server no contaba.

⚠️ **Un Set por tarjeta habría silenciado respuestas legítimas:** en «Si responde» la misma «MaKo
contesta» corre en cada turno con un texto nuevo.

**Regla:** lo que se repite solo (un «Ir a» que vuelve, en la salida o en el mismo turno) no se
reenvía; lo que dispara quien prueba (un mensaje nuevo como lead) sí: la clave lleva el turno
(`debeSalirDeVerdad`). Y el server topea por destino: N por ventana se arma con N casilleros de
`reclamarEspaciado`, que es un compare-and-set sobre UNA marca por clave (`reclamarCupoPrueba`); se
reclama después de los chequeos que pueden cortar, y si el conteo falla no se manda. Costo: hasta 11
filas de `app_settings` por destino probado, que nadie limpia.

**Vive en:** `lib/simulador-grafo.ts` (`debeSalirDeVerdad`, `reclamarCupoPrueba`) · `lib/prueba-paso.ts` ·
`app/automations/PanelProbar.tsx`

### Un pedido de abrir algo desde afuera baja como OBJETO y se aplica al dibujar [costuras-5, P]

**Síntoma:** el link del aviso de hand-off (`/chatbot?sec=<id>`, «súmalo como caso en "Si
responde"») abría el wizard de 9 pasos, donde no hay «Si responde».

**Causa:** el ancla del deep link era de cuando el wizard era el editor.

**Regla:** el pedido baja como un objeto nuevo por pedido (comparado por identidad: el mismo id dos
veces vuelve a abrir) y se aplica AL DIBUJAR con el patrón de estado previo, no en un efecto (un
efecto pinta primero la primera de la lista). `tests/chatbot-probar.test.ts` cruza el
`linkApp('/chatbot?<param>=')` de `lib/chat-agent-handoff.ts` con el `params.get` de la página: si
el aviso cambia de parámetro, el test cae.

**Vive en:** `app/automations/ChatAgentApp.tsx` · `app/automations/SimuladorWhatsApp.tsx` (prop `abrir`) ·
`lib/chat-agent-handoff.ts`

### La pantalla ofrece lo que el emisor hace, nada más [P]

**Síntoma:** en el recordatorio de la reunión dibujado como tarjetas, «quitar un toque» parecía una
capacidad natural.

**Causa:** el emisor no la tiene: guarda sólo los textos propios (uno vacío vuelve al de fábrica) y
recorre siempre los tres toques (1440, 60 y 15 min).

**Regla:** un «quitar» que el emisor ignora es un botón roto. Para apagar un toque, primero el
emisor (un `apagado` por toque en el setting) y después la tarjeta. La pantalla escribe por la MISMA
ruta y la MISMA clave (`chatbot.recordatorio_reunion`): mudarla de lugar no lo apaga ni lo duplica.

**Vive en:** `app/automations/RecordatorioFlujo.tsx` · `lib/recordatorio-lead.ts` ·
`lib/reunion-recordatorio.ts`

### Trampas menores de «Probar»

- **Un documento va con `nombreArchivo` y el caption aparte** [costuras-8]: sin eso, `ChatHilo` usa
  el texto como nombre del archivo y el caption no sale.
- **`PanelProbar.tsx` conserva a propósito un `eslint-disable` de react-hooks** (el efecto de
  montaje): con eso el React Compiler saltea el componente entero (ver
  [hallazgos-ui.md](hallazgos-ui.md)).

---

## Las costuras entre las partes

### Repartir por archivo dejó capacidades sin enchufar [revisión, integración]

**Síntoma:** de los 42 confirmados de la revisión, 11 eran «costuras»: cosas que cada parte hizo
bien y que se cayeron entre dos. La más cara, una regresión: el lienzo dejó de pasarle `paraGuion`
al editor y «✦ guion» perdió objetivo, gancho y preguntas (en un negocio sin link de agenda, todo
guion que dijera «agendemos» volvía a terminar en «Prueba de nuevo»). Además, la prop `handoffs` de
`SecuenciaPerfil` nació con cero call sites (la marca de «Otra cosa» no se veía hasta `1b0e2515`),
`SecuenciaDto` no declaraba `etiqueta_id`, `EstrategiaWizard` quedó huérfano y
`app/admin/dev/areas.ts` no conocía los archivos nuevos (`75402dd7`).

**Causa:** la forma del reparto, ya escrita en AGENTS.md («repartir trabajo por archivo garantiza
salidas huérfanas»): la capacidad queda en un archivo y el call site en el de otra parte.

**Regla:** cada parte declara en su reporte, con las líneas exactas, lo que no pudo enchufar (las
«notas para integrar» de esta corrida lo hicieron, y por eso se cerró en horas); el integrador
grepea cada prop nueva y cuenta sus call sites antes del commit.

**Vive en:** `app/automations/FlujoLienzo.tsx` (`paraGuion`) · `app/automations/SimuladorWhatsApp.tsx`
(`handoffs`) · `app/automations/ChatAgentApp.tsx` (`SecuenciaDto`)

### Estado de producción (medido con SELECT)

- **08/10/2026, al cerrar la primera tanda:** ni la 0223, ni la 0224, ni la 0225 estaban aplicadas.
  ⚠️ Es una afirmación CON FECHA: el mismo día se aplicaron, y la conversión de las 6 secuencias
  corrió. La segunda tanda la leyó como estado actual y dos relevos la repitieron.
- **09/10/2026, al cerrar la segunda:** 0223-0225 y **0228** aplicadas (`hilos`, `hilos_rev` y el
  CHECK `nutricion_inscripciones_hilos_chk`, verificados contra information_schema y pg_constraint);
  0 inscripciones activas en toda la base.

---

## La segunda tanda (08-09/10/2026): un solo CRON, hilos en paralelo, editores anchos, IA

El pedido (11 puntos), el diseño y las 16 decisiones están en docs/chatbot-flujo-ramas-diseno.md →
«SEGUNDA TANDA». Se construyó en 7 partes (modelo + 6 en worktrees) y una revisión adversarial de
5 frentes: 38 hallazgos, 32 confirmados por un verificador independiente, los 32 arreglados con test.

### Una flecha en paralelo es un PUERTO, y así el modelo no tuvo que cambiar sus recorridos [modelo]

**Qué:** `paralelos?: string[]` en mensaje, acción, espera y el nodo `inicio` (id `'entrada'`, se crea
sólo con la primera flecha desde el CRON y va al FINAL del array para no correr índices).
`puertosDe` los devuelve como `par:<id>`, así `apuntados`, `padreDe`, `descendientes`, la regla de un
padre y las sueltas siguieron andando sin tocarlos. Lo que sí hubo que escribir: `raicesSalida`,
`hiloDe` ('p' el principal, el id de la primera tarjeta de cada flecha, 'r' «Si responde') y las
reglas de `validarGrafo` (paralelos en un bucle de «Ir a» = un hilo nuevo por vuelta; «Ir a» de la
salida a otro hilo = el mismo mensaje dos veces).

**La regla:** una clase nueva de nodo pasa por DOS lugares del guardado con dueños distintos: el
saneo (`camposDelFlujo`) y el relleno (`esNodoDeControl`). Sanear la clase no alcanza: el inicio se
guardaba como si fuera un mensaje. Y `PasoSecuencia` copiaba a mano la unión de `nodo`: al ampliar una
unión del contrato, los tipos copiados y los `switch` exhaustivos de afuera se cuentan antes.

**Vive en:** `lib/flujo-grafo.ts` · `lib/nutricion-grafo-motor.ts` (`camposDelFlujo`) · `lib/nutricion.ts`

### Un compare-and-set por revisión sólo protege si TODOS los escritores suben la revisión [motor]

**Síntoma (revisión):** una escritura del motor leída antes de que el lead contestara revivía los
hilos congelados y pisaba la tarjeta del «Ir a» de «Si responde».

**Causa:** las dos retomas (`responderConGrafo` y el destrabe de `pausarPorRespuesta`) escriben
`hilos: null` sin subir `hilos_rev`; la fila volvió a 'activa' y la revisión seguía igual, así que el
CAS del motor pasaba. ⚠️ Y el diagnóstico obvio al revés también es falso: perder el CAS NO dice «otra
corrida movió este hilo»: cualquier hilo de la fila sube la revisión. Al perder se relee y se pregunta
por ESTE hilo (`hiloSigueEn`).

**La regla:** si el CAS es por la versión de la fila, exige también la FORMA leída (`not hilos is null`
cuando se leyó con hilos), o todos los escritores suben la revisión.

**Vive en:** `lib/nutricion.ts` (`escribirHilos`) · `lib/nutricion-hilos.ts`

### En modo hilos, el estado del ÚLTIMO hilo que cierra es el de la inscripción [motor]

**Síntoma (revisión):** mismo lead, mismos WhatsApp recibidos: el «no confirmó» salía o no según qué
hilo cerraba último. Un email terminal (sin email, dado de baja) cerraba su hilo 'cancelada'; si era el
último, la inscripción entera quedaba 'cancelada' y el desenlace la saltaba.

**La regla:** todo cierre de hilo con estado terminal se prueba en los DOS órdenes. Con hilos, lo
terminal de un email cierra 'completada' (el silencio se mide igual desde el último envío real).

**Vive en:** `lib/nutricion.ts` · `lib/nutricion-hilos.ts` (`aplicarAHilo`) · `lib/nutricion-desenlace.ts`

### «Vuelve a la cola» se decidía en TRES caminos, y el nuevo concepto entró en dos [motor]

**Síntoma (revisión):** un hilo «Enseguida» que arrancaba una acción esperaba una hora; detrás de un
mensaje o una espera salía en la misma corrida.

**La regla:** si una decisión del motor se repite en varios caminos, va en UNA función que llamen
todos; al sumar un concepto (hilos), `grep` de `otraVuelta = true` y revisar cada condición. Y lo nuevo
del motor va FUERA de `procesarEnvios` (un test lo recorta con tope de 40.000 caracteres).

**Vive en:** `lib/nutricion.ts` (`procesarEnvios`)

### El freno anti-ban y los topes son POR CANAL, y eso cambia también a los flujos de antes [motor]

`qNutri` y `enviosUltimas24h` contaban todos los canales y el freno se calculaba una vez por lote:
WhatsApp y email del mismo CRON salían con 20 h de diferencia, y dos hilos de WhatsApp en la misma
vuelta. Ahora los 20 h y los topes miran WhatsApp, el email tiene su propio freno y su tope
(`MAX_EMAIL_POR_DIA` = 100), y `enviadoEnCorrida` se actualiza tras cada envío. ⚠️ No es «modo hilos»:
un email masivo ya no frena 20 h al WhatsApp del mismo lead en NINGÚN flujo. Medido: 0 inscripciones
activas al desplegar.

**Ventana 9-21:** se decide con `zonaDelMotor` (`mako.timezone`; sin zona, Ciudad de México como
siempre). El ws1 NO tiene `mako.timezone`; ws9/10/13/14/15 son Buenos Aires. Para MOSTRAR una hora va
`tzDeWorkspace`. Guardar la zona del ws1 (America/Tijuana) es una decisión de Martín.

**Vive en:** `lib/nutricion.ts`

### Una validación nueva dentro de una escritura que corre un `ejecutar()` consume la pendiente [motor]

Activar pasó a validar lo mismo que Publicar (decisión 15) adentro de `setSecuenciaActiva`, que es lo
que corre el «sí» de la pendiente `nutricion_toggle`: el sí se consumía y contestaba error. La misma
validación va exportada y la corre quien PROPONE. Regla de AGENTS.md («falla en preparar()»), aplicada
a un throw nuevo en una función vieja: grepear quién la llama desde un `ejecutar()`.

**Vive en:** `lib/nutricion.ts` (`setSecuenciaActiva`, `setSecuenciaPasos(…, { soloValidar })`) · `lib/mako-doer-acciones.ts`

### Lo que un editor OFRECE sale de la regla que lo RECHAZA al guardar [modelo]

El lienzo ofrecía «＋ En paralelo» y destinos de «Ir a» que Publicar después rechazaba: `admiteParalelo`
y `tarjetasParaIrA` reescribían a mano PARTE de `validarGrafo` y se olvidaron del bucle. Para ofrecer un
valor se corre la regla sobre el flujo hipotético con ese valor puesto. (Queda: «Crear con IA»
—`problemaDeSalto`— todavía copia reglas en vez de usar `repartenEnBucle`.)

**Vive en:** `lib/flujo-conversacion.ts` · `lib/flujo-grafo.ts` (`repartenEnBucle`) · `lib/flujo-ia.ts`

### Lo que flota sobre un lienzo se mide contra la SALIDA del encuadre, no sólo contra los insets [ui]

La caja de «Crear con IA» centrada entre los insets caía EXACTAMENTE encima del CRON, porque
`encuadreInicial` centra el grafo en el mismo lugar. El encuadre le reserva su franja (`franjaIA`,
`lib/crear-ia-lugar.ts`). Y el envoltorio de una capa con `pointerEvents: auto` mide lo mismo que lo que
dibuja: el aire transparente también come clics. Lo que tiene un pedido en vuelo se ESCONDE, no se
desmonta (desmontar cancela la IA).

**Vive en:** `app/automations/SecuenciaPerfil.tsx` · `lib/crear-ia-lugar.ts`

### El panel apaisado llega al rincón de abajo a la derecha y necesita capa propia [modelo, ui]

Sin z-index, la esquina de avisos tapaba «Revisar antes de enviar» del editor en fila. Capa entre 55
(esquina de avisos) y 60; los modales arrancan en 130. El contenido va en columna flex con `flex: 1` +
`min-height: 0` (los editores anchos estiran así; nada de `height: 100%`).

**Vive en:** `app/_components/Lienzo.tsx`

### Crear con IA: lo que el modelo inventa se repara con código, y hay cosas que no se ven en los tests [ia]

- **Un id, una etiqueta, un link o un monto nunca vienen del modelo**: la etiqueta por nombre (o se
  crea), el link desde una clave, y un monto de Ganado vale sólo si aparece literal en lo que escribió
  una persona. Las `{{variables}}` en los datos de una ⚡ Acción se borran (`aplicarVariables` corre
  sólo sobre mensajes: llegarían con llaves al grupo).
- **Dos padres y uno es una espera: gana la espera** (sólo existe para demorar lo que sigue). Lo
  encontró una salida REAL de Groq que pasaba `validarGrafo`; las fixtures escritas a mano no.
- **Lo que puede CREAR una referencia se resuelve antes de decidir qué se crea** (el disparador por
  etiqueta nueva quedaba `etiqueta:-2`).
- **Un callback que se llama al final de un pedido largo va por un ref**: la prop capturada al clic
  comparaba contra el lienzo de hace un minuto.
- **Cancelar sólo se dibuja mientras el server todavía lo respeta**, y un 409 por estado viejo
  devuelve lo guardado.
- **La key de Gemini de PLATAFORMA está bloqueada por Google** (403 «Your project has been denied
  access»): una prueba «con la key de plataforma» no prueba nada; se probó por Groq.
- **El voseo de la salida no lo caza `marcasDeVoseo`** (lista corta a mano): el detector bueno vive en
  `tests/puente-panel-copy.test.ts`. Mudarlo a `lib` está sin hacer.
- **Lo que una pantalla decide con un módulo que tiene prompts va en un módulo aparte**
  (`lib/flujo-ia-cliente.ts`): importar un valor de `lib/flujo-ia.ts` desde un `'use client'` se lleva
  los prompts al navegador.

**Vive en:** `lib/flujo-ia.ts` · `lib/flujo-ia-cliente.ts` · `app/api/chat-agent/secuencias/ia/route.ts` · `app/automations/CrearConIA.tsx`

### Un estado sembrado de una prop que el SERVER cambia bajo el mismo `key` [ui]

Después de «Crear con IA», el CRON decía «A mano»: `disparo` se sembraba una vez y la ruta de IA cambia
el disparador en el server sin cambiar el id. Se resiembra comparando una firma en el render. Lo mismo
con la caché de etiquetas: una ruta del SERVER que crea entidades obliga a quien recibe su respuesta a
invalidar la caché (`avisarCambioEtiquetas`).

**Vive en:** `app/automations/SecuenciaPerfil.tsx` · `app/_components/etiquetas-cliente.tsx`

### Cal.com: las respuestas, el aviso y lo que la pantalla promete [datos]

Las respuestas se deduplican por clave (`responses` primero; `userFieldsResponses` repite), se saltean
las ocultas, y lo que ya es un campo de la reserva se excluye en positivo. ⚠️ Un jsonb no conserva el
orden de las claves: comparar con `JSON.stringify` contra lo guardado habría insertado de nuevo cada
reentrega. Un emoji cortado en el tope deja un sustituto suelto y Postgres rechaza el jsonb ENTERO
(se perdían todas las respuestas). Y el aviso dice «+N en el resumen»: el resumen tenía que leer ESA
tabla (`lead_respuestas`).

**Vive en:** `lib/calcom.ts` · `app/api/webhooks/calcom/route.ts` · `lib/leads.ts` · `lib/lead-respuestas.ts`


## La tercera tanda (09/10/2026): condiciones de todo el negocio, CRON por producto, editores medidos

Pedido literal en la bitácora (9 oct 02:05); decisiones en docs/chatbot-flujo-ramas-diseno.md →
«TERCERA TANDA». Seis partes en worktrees y una integración: 6035 tests, typecheck 0.

### Una condición devuelve sí, no o «no sé», y «no sé» no se cumple ni negada [condiciones]

`lib/condiciones-catalogo.ts` tiene 48 condiciones por sección y ámbito (adquisición = CRM; entrega =
Customer Success), y cada una sale de un dato que el motor lee en BATCH (`hechosDeLeads(db, ids,
filas)` lee sólo las fuentes que piden los flujos del lote). «No asistió a la R1» negado salía para
quien todavía no tuvo la reunión: un no-show exige la asistencia registrada como «no asistió», no la
falta de reunión. Y lo que no tiene un dato que lo registre no se ofrece: «Confirmó la asistencia» y
«Reagendó» no existen en ningún campo; la sección «Plan» tampoco (la unión tarea→lead está puesta en 6
de 776 tareas, medido).

**Vive en:** `lib/condiciones-catalogo.ts` · `lib/flujo-grafo.ts` (`cumpleFila`) · `lib/nutricion.ts` (`hechosDeLeads`) · `app/automations/EditorCondicion.tsx`

### «+y» que creaba «+o»: agregar y elegir el modo son dos decisiones [condiciones]

Los dos botones agregaban una fila con un «Agendó» de relleno Y fijaban el modo de la rama entera, así
que el separador de todas las filas cambiaba con el último tocado. Ahora «＋ Condición» abre el
desplegable por secciones y la fila nace al elegir; «Todas / Cualquiera» es su propio control. Y una
rama (o una condición) nueva nace VACÍA: validarGrafo la frena hasta que se elija algo.

**Vive en:** `app/automations/EditorCondicion.tsx` · `lib/flujo-conversacion.ts` (`agregarRama`, `nodoNuevo`)

### Lo que pide una etapa se calcula sobre el embudo REAL, no sobre el pipeline de fábrica [acciones]

El diagnóstico obvio para «Mover de etapa» era «ganado pide monto, perdido pide motivo» sobre
`DEFAULT_PIPELINE`. Lo que pide una etapa sale de `cfg.stages` del embudo del producto
(getFunnelDe/buildFunnel), y para elegir A DÓNDE mover hacen falta todas las etapas, incluidas las
salidas (`productosConEtapas` las filtra: la ruta nueva `app/api/flujos/opciones` las lee sin filtrar).
⚠️ `proponer_cambio_etapa` sólo mueve en el producto principal: el producto del editor es una
referencia hasta que la acción acepte `embudoId`. Y un parámetro que la acción no declara viaja en los
params sin error: un nombre mal escrito desaparece igual de callado.

**Vive en:** `app/_components/EditorAccionMako.tsx` · `app/_components/CamposAccion.tsx` · `lib/editor-acciones.ts`

### Crear con IA fallaba porque el único proveedor sano no cabía [ia]

Medido con las keys del ws1: Gemini 403 (Google bloqueó el proyecto de la key, que es la misma de la
plataforma) y 429; OpenRouter 404 (el modelo gratis ya no es gratis); Mistral 429 siempre; OpenAI 429
sin crédito. Groq armaba un flujo válido en 3 s y la cascada nunca lo probaba: `maxTokens` CUENTA para
el techo de entrada, y 4k de prompt + 6k de salida pasaban los 7k. Se achicó el contexto (claves
cortas para los disparadores, topes al perfil) y la salida se calcula para que entre (`salidaParaIA`).
⚠️ El mensaje culpaba a «la configuración de MaKo» porque clasificaba todos los errores juntos: ahora
es por proveedor (`falloDeIA`). Los demás callers de `errorDeCascada` siguen con el defecto.

**Vive en:** `lib/flujo-ia.ts` · `app/api/chat-agent/secuencias/ia/route.ts` · `lib/ai-cheap.ts` (`techoDeEntrada`)

### El email en HTML: las variables se resuelven POR CONTEXTO dentro del saneo [mensajes]

El cuerpo del email es el editor rico de las lecciones y el paso guarda `cuerpo_html` saneado con
lista blanca (`lib/email-html-seguro.ts`). Un `{{nombre}}` adentro de un href (`?n={{lead_nombre}}`)
con «Ana Pérez» rompía el link: en el texto va escapado, en un href/src codificado, y la URL se valida
DESPUÉS de reemplazar. Sin imágenes subidas: falta un almacenamiento público.

**Vive en:** `lib/email-html-seguro.ts` · `lib/email-html.ts` · `app/automations/EditorEmailGmail.tsx` · `lib/nutricion.ts` (envío)

### Una fila optimista es un estado aparte, y se sigue por una clave estable [lista]

La fila de «＋ Nueva» que aparece al instante desaparecía a mitad de la creación y la selección se
perdía al llegar el id real. Va calculada sobre la lista del server (`creando:<temporal>`), aplicada al
dibujar. Y «Duplicar» no copia la fila entera: inserta una pausada con lista blanca de columnas y cada
campo con puerta propia pasa por su puerta (pasos → setSecuenciaPasos).

**Vive en:** `app/automations/SimuladorWhatsApp.tsx` · `app/automations/ChatAgentApp.tsx` · `lib/secuencia-duplicar.ts`

### Un cambio de contrato de una parte deja «verde por aire» el test de otra [integración]

Al sacar «Eventos» del CRON, el test de presupuesto de Crear con IA siguió en verde con sus roturas: el
negocio de prueba pesaba 40 eventos y ya no medía el borde. Un test de presupuesto se calibra CERCA del
borde, con la medición escrita, y se re-prueba rompiéndolo cuando cambia lo que mide. Y una función
que alimenta una pantalla y otro lector no se reforma para la pantalla: se agrega la forma nueva al
lado (el CRON por pasos dejaba a Crear con IA sin disparadores).

**Vive en:** `tests/flujo-ia*.test.ts` · `lib/flujo-conversacion.ts` (`seccionesDisparo`)


## La cuarta tanda (09/10/2026, a medias): «Probar» que no mostraba nada, y sacar sin romper lo prendido

Pedido literal en la bitácora (9 oct 11:02); decisiones en docs/chatbot-flujo-ramas-diseno.md →
«CUARTA TANDA». Se hizo una parte, directo y en pasos chicos (la cuenta en 92-93 %): lo que falta,
por número de punto, en `docs/relevo/chatbot.md`.

### «Le di a probar y no salieron los mensajes»: no era el envío, era una puerta del simulador [probar]

El diagnóstico obvio era que la prueba no mandaba. Lo que pasaba: el simulador FRENABA en cada
condición esperando que alguien eligiera la rama con los botones («Llegó hace menos de 3 días /
Si no»), y con una condición como primera tarjeta no salía ningún mensaje. Ahora sigue sola por la
primera rama (el «Sí»). La regla: una prueba que arranca sola no puede quedarse esperando una
decisión que nadie le pidió a quien mira; si hace falta probar la otra rama, eso es un control
aparte, no un freno.

⚠️ **Y «siempre por el Sí» fue el arreglo equivocado** (quinta tanda): cambió el freno por un desvío.
Ver «"Probar" por el "Sí" también escondía los mensajes», más abajo: la decide el motor con un lead
recién llegado.

**Vive en:** `app/automations/PanelProbar.tsx` (el `case 'condicion'`)

### Sacar un tipo de tarjeta del producto = dejar de OFRECERLO, no dejar de dibujarlo [lienzo]

Martín pidió sacar REPLY, GO TO, «Si responde» del CRON, «antes de la reunión» del DELAY y
condiciones que el CRM no registra. Varias secuencias PRENDIDAS los usan (las convertidas de la
primera tanda tienen «Si responde»). Sacarlos del dibujo habría cambiado qué hace hoy una secuencia
sin que nadie lo viera. Se sacan de lo que se OFRECE (el ＋, el desplegable, el catálogo con
`retirada`, `FUERA_DEL_SELECTOR`) y lo que ya existe se sigue dibujando, corriendo y borrando. La
migración de esas secuencias a lo nuevo es una decisión aparte.

**Vive en:** `lib/flujo-conversacion.ts` (`opcionesDelMas`, la tarjeta CRON) · `lib/condiciones-catalogo.ts` (`retirada`, `seOfrece`) · `lib/editor-acciones.ts` (`FUERA_DEL_SELECTOR`) · `app/automations/FlujoLienzo.tsx` (`EditorEspera`)

### El desplegable de la casa no es un `<select>`: lo puesto que no está en la lista lo dice el botón [cron]

«La que tiene puesta» existía por la regla del `<select>` cuyo valor no está entre sus opciones
(muestra la primera y el primer clic la pisa). El `Dropdown` de la casa no tiene esa trampa: el botón
dibuja `botonLabel` (`rotuloDisparo` cae a `textoActual`) y nada se escribe hasta elegir. Esa sección
era ruido, y Martín la vio como tal. La regla del `<select>` sigue valiendo para un `<select>` nativo.

**Vive en:** `lib/flujo-conversacion.ts` (`pasosDisparo`, `rotuloDisparo`)

### `echo tsc=$?` después de un pipe mide el `tail`, no el typecheck [proceso]

`npx tsc --noEmit | tail -15; echo tsc=$?` imprime el exit del `tail` (0), y un commit salió con un
error de tipos que el mismo comando mostraba arriba. Se cazó en el paso siguiente, sin pushear. El
chequeo va a un archivo y el `$?` del comando: `npx tsc --noEmit > out.txt 2>&1; echo $?`.

### El «De» del email: hoy hay UN remitente por negocio, y «Vincular nuevo» lo REEMPLAZA [email]

Martín pidió elegir el remitente «si se tiene vinculado varios email, con el botón de vincular
nuevo». Medido: un workspace tiene UN remitente (`getEmailFrom`: `resend_from` → `RESEND_FROM` → el
sandbox), «Guardar remitente» de /email lo PISA, y de los 11 workspaces sólo el ws1 tiene
`resend_from` (y es «MaKo <equipo@hola-mako.com>»). No existe una lista de remitentes en ningún lado.

Lo hecho sin inventar un modelo: el «De» lista lo que hay (`remitentesVinculados` ya lee un
`remitentes` si la ruta algún día lo manda) y «Vincular nuevo» monta el MISMO `DominioSetup` de
/email en un modal. Como el rótulo promete SUMAR y ese botón pisa el «De» de todos los emails del
negocio (los pasos sin remitente propio y los broadcasts), el modal lo dice arriba cuando ya hay uno
(«Reemplaza el remitente de tu negocio.»). El paso guarda `remitente` sólo si no es el del workspace,
y el motor lo usa sólo si es del MISMO dominio (`remitenteDelPaso`): la cuenta de Resend es una para
todos los clientes, así que sin esa guarda un paso guardado con el mail de otro cliente saldría.

**Regla:** mudar a un botón cercano una acción que pisa algo COMPARTIDO le cambia los supuestos de
frecuencia (AGENTS.md); el lugar nuevo nombra lo que pisa. Sumar de verdad es un dato nuevo (varios
remitentes por negocio) y lo decide Martín.

**Vive en:** `lib/email-remitente.ts` · `app/automations/EditorEmailGmail.tsx` (`VincularRemitente`,
`AVISO_REEMPLAZA`) · `app/email/EmailApp.tsx` (`DominioSetup`) · `lib/nutricion.ts` (envío y
`setSecuenciaPasos`)

### Una prop nueva del editor con CERO call sites: el «De» se guardaba y no se veía [email]

`EditorEmailGmail` acepta `remitente` y sus tests lo prueban montándolo a mano, pero quien lo monta
en el lienzo (`EditorEmail`, `app/automations/FlujoLienzo.tsx`, de otra parte de la tanda) no se lo pasa:
elegir otro remitente lo GUARDABA en el paso y la pantalla seguía diciendo el del workspace. Es
«escribir la salida no es ofrecerla» con la forma del reparto por archivo: la capacidad en un
archivo y el enchufe en otro que la parte no podía tocar. Se enchufó al unir la tanda, y lo fija
`tests/chatbot-enchufes.test.ts`.

**Vive en:** `app/automations/FlujoLienzo.tsx` (`EditorEmail`)

### El modo HTML: lo que el editor visual no sabe dibujar SALE, y se simplifica al volver a escribir [email]

La caja HTML pasa cada tecla por la misma lista blanca (`sanearHtmlEmail`) y lo saneado llega al
paso tal cual, incluido lo que el editor rico no tiene en su esquema (un `h1`, `sub`/`sup`, un
`colspan`): eso sale en el mail. Al volver al modo visual el editor carga ese HTML con SU esquema, y
la próxima tecla guarda lo que el editor dibuja, o sea la versión simplificada. No se midió con clics:
sale de cómo carga ProseMirror un documento. Si un cliente arma un mail en HTML y después toca una
coma en el visual, pierde lo que el visual no sabe dibujar.

**Vive en:** `app/automations/EditorEmailGmail.tsx` (`alCambiarCrudo`, `salirHtml`) · `app/_ui/EditorRico.tsx`

## Cuarta tanda punto 1 y quinta punto 3 (09/10/2026, parte «editores»): el panel por tipo y el DELAY con segundos

Pedido literal: «No me gusta que el editor del CRON como muchos otros tengan tanto espacio en blanco y
un desplegable chico arriba del todo» y «En Delay, falta la opción de minutos y segundos...». Rama
`wip-v4-editores`; una corrida la empezó y la cuota la cortó, la segunda la verificó contra el pedido
y cerró lo que faltaba.

### «Segundos» que no eran segundos: el diagnóstico obvio (la precisión del cron) era la mitad [motor]

La primera corrida resolvió la precisión como había que resolverla —una espera de hasta 120 s se
cumple DURMIENDO adentro de la corrida (`dormirEsperaCorta`), con su tope y sus tests— y la pantalla
no avisaba nada para ≤ 120 s, o sea prometía exactitud. Medido después, en tres lugares:

- **La ruta del cron nunca le pasaba el tope** (`esperarHastaMs`): `procesarEnvios` sin tope no duerme
  (a propósito), así que el dormir era una capacidad con CERO call sites. Los tests leían el motor y
  daban verde; nadie miraba la ruta.
- **El caso típico no pasa por el cron**: «Nuevo lead → esperar 30 s → WhatsApp» corre por la VÍA
  RÁPIDA del evento (`enrolarPorEvento` / `inscribirEnSecuencia` → `procesarEnvios({ soloLeadId })`),
  adentro de un webhook que tiene que contestar ya. Ahí no se puede dormir, y los 30 s eran «la corrida
  de la hora siguiente». Va con `after()` de Next: contesta y DESPUÉS duerme lo que falta y vuelve a
  correr ese lead con tope (`seguirDespuesDeResponder`), en fila por proceso para no correr 30 motores
  a la vez sobre los topes. Si `after` no está o la función muere, la fila ya tiene la hora exacta y la
  toma el cron: tarde, nunca perdida.
- **La píldora y «Probar» redondeaban a minutos** (`textoEspera`, lib/flujo-grafo.ts): 10 s se
  dibujaba «Esperar 0 min» y 30 s «Esperar 1 min», con el editor diciendo «10 segundos» al lado. El
  commit decía que estaba hecho y el test probaba `textoDuracion`, no a quien la tenía que llamar.

La regla: **una capacidad del motor que depende de un parámetro se verifica en el que lo PASA**, y
«¿quién llega a este nodo?» se contesta enumerando las ejecuciones que lo alcanzan (acá: el cron y la
vía rápida), no la que uno tenía en la cabeza.

**Vive en:** `lib/espera-duracion.ts` (la decisión entera, en la cabecera) · `lib/nutricion.ts` (`procesarEnvios`, `seguirDespuesDeResponder`) · `app/api/cron/nutricion/route.ts` · `lib/flujo-grafo.ts` (`textoEspera`)

### Un DELAY corto entre dos WhatsApp no existe: lo frena el anti-ban de 20 h, no la espera [motor]

El ejemplo con que se pensó la feature («audio y 10 s después el link») no puede pasar con ningún
DELAY: el segundo WhatsApp al mismo lead cae en `frenadoPorAntiBan` (20 h por canal; 3 h con reunión
en menos de 48 h) y no avanza. Un DELAY de segundos sirve entre el CRON y el primer mensaje, o entre un
mensaje y una acción, un email o un aviso al grupo. Dos mensajes seguidos de WhatsApp son UNA tarjeta
con varias burbujas (cuarta tanda, punto 15). La pantalla del DELAY no lo dice: el aviso es de la
espera, no del anti-ban.

**Vive en:** `lib/nutricion-grafo-motor.ts` (`frenadoPorAntiBan`) · `lib/nutricion.ts` (`HS_MIN_ENTRE_MSGS`)

### «Puede salir hasta 1 h después» era falso dos tercios del día: el cron corre de 15 a 23 UTC [motor, ui]

`"0 15-23 * * *"` son nueve corridas, de 9 a 17 en Ciudad de México. Una espera que vence a las
17:30 de ahí sigue a las 9 del día siguiente, y eso vale también para «Esperar 2 horas» y «1 día»,
que no llevaban aviso («una hora de más sobre un día no cambia nada» — de noche son 16). El aviso
pasó a decir CUÁNDO sigue, con las horas de quien mira y para toda espera de más de 120 s: «Sigue a
la hora en punto (9 a 17 h)». Las horas y la cadencia las fija un test leyendo vercel.json.

Y de rebote: entre las 17 y las 21 de Ciudad de México la ventana horaria del motor deja mandar y no
hay ninguna corrida — lo que vence en esa franja espera a la mañana (sólo lo dispara al momento un
evento nuevo, por la vía rápida). Decide Martín: ampliar el cron cambia cuántas veces por día se
aplica el tope «por corrida».

**Vive en:** `vercel.json` · `lib/espera-duracion.ts` (`HORAS_MOTOR_UTC`, `avisoDePrecision`)

### El panel mide por TIPO de tarjeta, y el selector es el campo grande de la casa [lienzo]

Todos los editores medían lo del de WhatsApp (~720 × 420): un DELAY era una frase arriba y el resto
vacío. `editorDeTarjeta` (lib/lienzo-grafo.ts) decide alto y ancho por el TIPO —nunca por el contenido
de cada render: lo que no entra scrollea adentro—: DELAY, TAG y GO TO 140; MAKO 280; CONDITION y CRON
320; ACTION y «Si responde» 400; un mensaje, el grande (840 × 560). `campoGrande` / `botonGrande`
(48 de alto, letra 16) en DELAY, TAG, ACTION y GO TO. Lo que queda raro: el CRON usa su propio
`BOTON_CAMPO_CRON` (44, letra 14,5) —dos «campos grandes» que difieren es el olor de dos piezas
separándose— y con horario mensual o anual su contenido pasa los 320 y scrollea.

**Vive en:** `lib/lienzo-grafo.ts` (`editorDeTarjeta`, `ALTO_EDITOR_CONTROL`) · `app/_components/Lienzo.tsx` (`campoGrande`, `botonGrande`, `altoFijo`) · `app/automations/SecuenciaPerfil.tsx` (`BOTON_CAMPO_CRON`)

## Lo que quedó sin hacer

**De la parte «editores» (cuarta 1 + quinta 3, 09/10/2026):**

- **Medir la espera corta en producción.** Lo que corre después de contestar vive lo que el
  `maxDuration` de la ruta que llamó a la vía rápida (webhooks, server actions): no se midió cuánto es
  en cada una. Si muere, sale con el cron (la hora exacta ya está en la fila). `lib/nutricion.ts`
- **De 2 a 59 min sigue dependiendo del cron**: si Martín quiere minutos exactos, hace falta un tick
  frecuente SÓLO para las filas que salen de una espera (el de `flujo-corridas` corre cada 5 min), sin
  multiplicar el tope «por corrida». Y la franja 15-23 UTC deja sin corrida de 17 a 21 de México.
- `BOTON_CAMPO_CRON` (44 / 14,5) contra `botonGrande` (48 / 16): unificar. `app/automations/SecuenciaPerfil.tsx`
  (lo fija `tests/cron-varias-etapas.test.ts`).
- El selector de la CONDITION sigue siendo el `Dropdown` de fila. `app/automations/EditorCondicion.tsx`
- Verlo con clics: el panel por tipo, el DELAY con «10 segundos» y su aviso, y una espera de 30 s de
  un lead nuevo de verdad.

## Cuarta tanda, punto 15, y quinta, punto 1 (09/10/2026): varios mensajes por tarjeta y «Probar» como un lead nuevo

### «Probar» por el «Sí» también escondía los mensajes: la causa no era la espera [probar]

Síntoma (quinta tanda, punto 1): «al darle probar en la automatización de bienvenida, no salió el
mensaje que debería salir… si es por el delay, evidentemente no debe tardar nada». El diagnóstico
obvio era la espera de 1 h, y era el equivocado: la prueba ya no espera (la píldora se dice y se
sigue). MEDIDO con la Bienvenida del ws1 (`docs/relevo/chatbot-secuencias.json`, M2) y la regla de la
cuarta tanda: «Esperar 1 h» → el «Sí» de «Agendó» → «↪ Sigue en «Agendó: confirmar y preparar»», y
ningún mensaje. El arreglo de la entrada de arriba («sigue sola por el Sí») cambió el freno por un
desvío: toda condición del tipo «si ya agendó, mandalo a otra automatización» se comía el flujo.

La regla: **una prueba que decide sola decide como el MOTOR, con un lead que acaba de entrar por ese
CRON** (sin agenda, sin pago, sin respuestas, llegado ahora, con la etapa o la etiqueta por la que
entró), y lo que la prueba misma produjo también cuenta (después de un mensaje, «ya le escribimos»).
Con la MISMA función que el motor (`elegirSalida`). Y el bloque `catalogo` de ese lead va con CEROS,
no ausente: ausente, una condición negada del catálogo («No reprodujo el VSL») nunca se cumple, y la
prueba seguiría por el «Si no» de algo que un lead nuevo sí cumple.

**Vive en:** `lib/simulador-grafo.ts` (`hechosDeLeadNuevo`, `leadNuevoDelCron`, `elegirComoLead`) · `app/automations/PanelProbar.tsx` (el `case 'condicion'`) · `tests/probar-lead-nuevo.test.ts`

### Un dato que pasa a vivir en DOS lugares rompe a quien pregunta «¿quién usa esto?» [modelo]

Un mensaje de varias partes guarda la primera en los campos de siempre (`cuerpo`, `audio_id`,
`media_id`: el espejo) y el resto en `partes`. El barrido de AGENTS.md («antes de sumar un tipo de
paso, `grep` de `.pasos` y de `setSecuenciaPasos`») encontró a los que leían sólo el espejo, y el caso
caro no recorre pasos: PREGUNTA por un id. `pasosUsanAdjunto` (biblioteca) y `borrar_audio` (API)
miraban `media_id` / `audio_id` del paso, así que el archivo o el audio de la SEGUNDA parte se podía
borrar y el motor fallaba en cada lead cada 24 h, sin que nadie lo viera (`enviarPartesDelPaso` baja
todo antes de mandar y no manda nada). Los otros: el generador de copy le pedía texto al modelo para
el espejo (un audio con cuerpo vacío) y ese texto entraba como una parte MÁS; las variantes se
generaban —y se pagaban— para que el guardado las tirara; la prueba de la API mandaba sólo la primera
parte (y un audio sin su pie, que el motor sí manda); la ficha de la API y el contexto de MaKo leían
sólo el espejo.

La regla: **al partir un dato en espejo + resto, se buscan también los lectores del ID (`audio_id ===`,
`media_id ===`), no sólo los que recorren la lista**, y la pregunta «¿lo usa?» va en UNA función
(`pasoUsaAudio`, `pasoUsaArchivo`).

**Vive en:** `lib/mensaje-partes.ts` · `lib/setting-adjuntos-reglas.ts` (`pasosUsanAdjunto`) · `lib/api-mako/areas/chatbot.run.ts` (`borrar_audio`, la ficha) · `lib/nutricion-generator.ts` · `lib/secuencias-variantes.ts` · `lib/setting-secuencias.ts` (`probarSecuencia`) · `lib/mako-context.ts` · `tests/partes-recorren.test.ts`

### Los destinos de «Probar» se guardan, y son de la PERSONA [probar]

Pedido: «primero el desplegable me debe ofrecer los números que ya tiene guardado, y abajo un botón de
"Nuevo número"». Hasta acá la regla era «el destino NO se guarda» (lienzo-3: precargar el contacto de
reportes del NEGOCIO le mandaba la prueba al cliente). Lo que se guarda ahora es de QUIEN PRUEBA: su
teléfono y su email de siempre, y los que fue escribiendo como «Nuevo número», en `usuarios.perfil.
destinosPrueba` de SU fila (por el email de su sesión, nunca «viendo como cliente»), reescribiendo el
jsonb desde lo que ya tenía (ahí viven el formulario y `notifInApp`). Nunca los destinatarios del
workspace: con el super admin mirando a un cliente, ofrecer los números del cliente es un clic de
distancia de mandarle la prueba a él.

**Vive en:** `lib/simulador-grafo.ts` (`destinosGuardados`, `perfilConDestino`) · `lib/prueba-paso.ts` (`guardarDestinoDeQuienPrueba`) · `app/api/chat-agent/simulador/route.ts` (`guardar-destino`) · `app/automations/PanelProbar.tsx` (`MenuDestinos`)

## Quinta tanda punto 2 (09/10/2026, parte «lienzo»): el ＋ en toda la flecha y las tarjetas que se mueven

### `vector-effect: non-scaling-stroke` NO corrige un zoom de CSS: el diagnóstico obvio era el equivocado [lienzo]

El ＋ de una flecha sólo aparecía en un cuadrado invisible de 28 px en el medio. La cura que proponía
el relevo —una franja invisible a lo largo del trazo con `non-scaling-stroke`— medida en Chrome al 40%
daba **6,5 px**, igual que sin el efecto: Chromium calcula el trazo «que no escala» sólo con las
transformaciones de ADENTRO del `<svg>`, y el zoom del lienzo es un `scale()` sobre la capa HTML. Lo que
anda es dividir el ancho por el zoom (16,5 px a cualquier escala). El ＋ además tarda 350 ms en apagarse,
para poder llegar a él en línea recta aunque la curva se salga de la franja. Ya está en AGENTS.md, en la
regla de las capas con `scale(k)`.

**Vive en:** `app/_components/Lienzo.tsx` (`TOQUE_FLECHA`)

### Mover una tarjeta: tres trampas que no se ven en el handler [lienzo]

- **Soltar deshacía el paneo.** Al mover una tarjeta el dibujo cambia de tamaño, cambia la firma del
  encuadre y la vista se re-centraba sola. Afectaba también a /mensajes. `trasMover` lo evita.
- **Mover sólo la tarjeta dejaba atrás sus salidas y sus ＋**, y las flechas se despegaban. Se arrastra el
  ENVOLTORIO de la tarjeta y las flechas se recalculan con la misma curva.
- **«No pude leer las posiciones» no es «no hay ninguna».** Un mapa que arrancó vacío por una lectura
  caída y se guarda al soltar pisa todo lo que la persona ya había acomodado: con la lectura fallida no se
  guarda nada. Y si falta la columna (la 0233 sin aplicar), las tarjetas se mueven y no se guardan, sin
  error (42703 / PGRST204 se distinguen de otros fallos).

Las posiciones son DESPLAZAMIENTOS desde donde el árbol pone el CRON (lo que no se movió se dibuja como
antes), viven en `nutricion_secuencias.posiciones` —nunca en `pasos`, que pasan por un saneo campo por
campo— y se guardan por su propia acción, sin pasar por Publicar ni por la pila de deshacer.

**Vive en:** `lib/lienzo-posiciones.ts` · `lib/secuencia-posiciones.ts` · `app/automations/usePosicionesLienzo.ts` ·
`app/_components/Lienzo.tsx` (`trasMover`) · `supabase/migrations/0233_secuencia_posiciones.sql`

### Proceso: lo que costó verificarlo con clics en un worktree [proceso]

`next dev --webpack` no compila (`node:crypto`); Turbopack en un worktree sólo anda con `turbopack.root`
apuntando a la carpeta de arriba (se cambia y se restaura sin diff); la primera compilación de /chatbot
tardó 4,6 min; matar un `npm test` en curso deja 218 falsos rojos «The service was stopped»; y el número
de migración se ocupó DOS veces mientras se trabajaba (0231 y 0232): se mira justo antes de commitear.
Y el agente dejó el `next dev` prendido al terminar: quien une la tanda revisa los procesos.

## Sexta tanda, parte «modelo» (09/10/2026, noche): varias flechas a una tarjeta, sueltas, «Si responde» como CONDITION, sin GO TO

Las decisiones y los contratos, en [chatbot-flujo-ramas-diseno.md](chatbot-flujo-ramas-diseno.md) →
«SEXTA TANDA, parte «modelo»». Acá, lo que costó.

### «No puedo abrir 2 flechas después de una condición» era el TOPE DE CAMINOS sumando de más [modelo]

**Síntoma:** Martín, punto 13: «Aún no funciona poner o sacar más de una flecha a una tarjeta... si
quiero luego de una condición abrir 2 flechas. Debería poderse».

**El diagnóstico obvio era el equivocado:** que el lienzo no ofrecía el ＋ en paralelo en un resultado,
o que el motor no corría los paralelos. El motor, «Probar» y `validarGrafo` los corrían bien. La causa
real eran DOS: (1) `validarGrafo` rechazaba «la tarjeta X cuelga de N lugares» y no había ninguna
edición para conectar a una tarjeta que ya existe; (2) el tope de caminos (`TOPE_HILOS` = 6) se medía
con la SUMA de todas las flechas en paralelo, también las de los DOS resultados de cada condición,
aunque para un lead corre uno solo. Con tres condiciones con una flecha en el «Sí» y otra en el «Si
no» eran 1 + 6 = 7 «caminos»: la tercera ya no podía sacar su segunda flecha. Y como el lienzo
pregunta con la misma función qué ofrecer, el botón tampoco aparecía — se leía como un botón que falta.

**La regla:** un tope sobre «lo que corre a la vez» se calcula sobre lo que CORRE: en ramas que se
excluyen es el MÁXIMO, nunca la suma (`contarParalelos`, la suma quedó en `totalDeParalelos`). Y cuando
un número decide a la vez lo que se OFRECE y lo que se RECHAZA, un número inflado se ve como un botón
que no está, no como un error.

**Vive en:** `lib/flujo-grafo.ts` (`contarParalelos`, `reglasDeHilos`)

### Sacar «un padre por tarjeta» rompía en silencio a cuatro lectores que subían por `padreDe` [modelo]

**Síntoma (en la revisión, no en pantalla):** con varios padres permitidos, tres ayudantes del motor
seguían subiendo por UN padre: `esPrimerPaso` (¿es la bienvenida? — decide si se vuelve a mirar el tope
de antigüedad), `minutosAntesDeReunion` (¿es un recordatorio? — sin eso sale «Mañana es tu reunión» sin
reunión) y `mensajeAnteriorDe` (qué borrador espera una acción). Y `borrarNodo` reconectaba sólo al
primer padre: los demás quedaban apuntando a la nada.

**Causa real:** relajar un invariante estructural (de árbol a grafo con ciclos) no rompe a quien lo
declaró; rompe a quien lo ASUMÍA, que es otro archivo y no falla: elige un padre y sigue.

**La regla:** al aflojar un invariante, `grep` de cada lector del supuesto (`padreDe`) y una decisión
por lector: «por TODOS los padres» (`padresDe`) o «sin la flecha que vuelve» (`padresSinVuelta`, con
`aristasDeVuelta`: la flecha de un «volver al principio» no es «lo de antes» — sin sacarla, la
bienvenida de un bucle dejaba de ser la primera). Lo fijan `tests/flujo-sexta-modelo.test.ts` (M6, M9,
M10, M13 de sus roturas).

**Vive en:** `lib/nutricion-grafo-motor.ts` · `lib/nutricion-hilos.ts` · `lib/flujo-grafo.ts` (`borrarNodo`, `soloDe`)

### Una tarjeta suelta conectada a la primera se volvía la ENTRADA [modelo]

**Síntoma (medido con el modelo, antes de dibujar):** conectar una suelta a la primera tarjeta dejaba
a la suelta como raíz: el CRON le iba a escribir al lead lo que la persona dejó a un costado.

**El diagnóstico obvio era el equivocado:** «que `normalizar` fije la raíz». `normalizar` no sabe
cuál era la raíz ANTES de la edición; cuando corre, la primera ya está apuntada. **Causa real:** sin el
nodo `inicio` en el dato, la raíz se DEDUCE («la primera tarjeta que nadie apunta»), y con tarjetas
sueltas esa deducción deja de alcanzar.

**La regla:** toda edición de flechas fija la raíz ANTES (`fijarRaiz`: el CRON como dato, al final del
array para no correr ningún `paso_actual`). Y «volver al principio» con una flecha dejaba la primera
apuntada y `raizSalida` sin raíz: si todo lo que la apunta cuelga de ella misma, sigue siendo la raíz.

**Vive en:** `lib/flujo-grafo.ts` (`fijarRaiz`, `raizSalida`, `conectar`, `desconectar`, `crearSuelta`)

### Un ciclo ya no lo arma sólo un «Ir a»; y el «Ir a» que retoma desde «Si responde» no es un cruce [modelo]

**Síntoma:** con flechas que vuelven, la regla «el «Ir a» X vuelve atrás sin espera» no veía un ciclo
armado con flechas. Y la primera versión de `cruces` marcaba como «dos caminos a la vez» el «Ir a» que
retoma la salida desde «Si responde» (5 rojos en tests viejos).

**Causa real:** el retome no es un camino más: el motor descarta los congelados y sigue UNO. Y los
resultados de una condición se excluyen: dos llegadas sólo chocan si no tomaron resultados distintos
en ninguna condición que compartan (`ctx`).

**La regla:** los ciclos se buscan en el grafo de EJECUCIÓN sin las esperas (`ciclosSinEspera`); un
cruce se juzga con el contexto de qué resultado tomó cada llegada. El texto viejo «…de «Ir a»» queda
sólo si el bucle tiene un «Ir a»: `tests/lienzo-capas.test.ts` mira el texto exacto, y nombrar algo que
ya no existe no dice qué pasó.

**Vive en:** `lib/flujo-grafo.ts` (`ciclosSinEspera`, `cruces`, `llegadasPorTarjeta`)

### No había borrador: una automatización a medias no sobrevivía a una recarga [modelo]

**Medido:** lo único que escribía los pasos era Publicar (PATCH /api/whatsapp/secuencias →
`setSecuenciaPasos` → `validarGrafo`). El lienzo editaba en memoria. «Que quede flotando» era imposible
de guardar.

**La trampa al hacer el borrador:** se abre sólo si se armó sobre lo publicado de hoy, y la huella
(`firmaPublicado`) tiene que ser el MISMO cálculo de los dos lados —ordenado por `orden`, normalizado y
renumerado, como lo publica `setSecuenciaPasos` y lo carga el lienzo—. Con una diferencia en el orden,
ningún borrador se abriría nunca, sin un error (rotura B3).

**La regla:** lo incompleto se GUARDA con `validarParaGuardar` y se PUBLICA con `validarGrafo`; el
motor no lee `pasos_borrador` nunca (lo fija un guard que barre los tres módulos del motor).

**Vive en:** `lib/secuencia-borrador.ts` · `supabase/migrations/0240_secuencia_borrador.sql`

### «Si responde» como CONDITION: convertir el dato era el camino caro [modelo]

**El diagnóstico obvio:** pasar el nodo `respuesta` a `nodo: 'condicion'` con una fila nueva. **Por qué
no:** #212 y #213 (ws1, un cliente) corren en vivo con ese nodo, y una respuesta nunca PASA por una
tarjeta de la salida: la pausa y entra por `responderConGrafo`. Convertir obligaba a reescribir ese
camino y reubicar inscripciones. Se dibuja y se edita como condición sobre el mismo motor (la familia
«Respuesta» del catálogo con `evento: 'respuesta'`, que no se ofrece en la salida y cuyo `evaluar` dice
«no sé»). Una fila «Su respuesta trata de» puesta a mano en una condición de la salida no se guarda.

**Vive en:** `lib/condiciones-catalogo.ts` (`respuesta_trata_de`, `seOfrece`) · `lib/flujo-grafo.ts` (`condicionARespuesta`) · `app/automations/EditorCondicion.tsx` (`EditorCondicionDeRespuesta`)

### GO TO: lo medido en producción y la red de `abrirFlujo` [modelo]

**Medido (09/10/2026, `scripts/quitar-ir-a.mts --simular --con-archivadas`, sólo lectura):** de 69
automatizaciones, tres con «Ir a»: #198 (activa, dos «Sigue en #212»; a #212 la dispara su CRON), #221
(pausada, un salto que vuelve a la espera de arriba → flecha) y #222 (archivada, tres «Sigue en #221»,
que está pausada: por el salto tampoco entraba nadie). Cero inscripciones paradas en un «Ir a»; cero
riesgos. `--aplicar` no se corrió.

**La trampa:** `erroresNuevos` compara TEXTOS de error, y sacar un «Ir a» cambia el texto de un error
que ya estaba («…dentro de un bucle de «Ir a»» → «…dentro de un bucle»): una automatización que ya no
se podía publicar contaba como «la conversión la rompe» y el lienzo la habría abierto CON el GO TO. Lo
de antes vuelve sólo si se podía publicar y convertido no (no pasa en ninguna de las tres: es la red).

**Vive en:** `lib/flujo-legado.ts` (`quitarIrA`, `abrirFlujo`) · `scripts/quitar-ir-a.mts`

### Trampas del entorno de esta corrida [modelo]

- **El scratchpad de la sesión es COMPARTIDO por las ocho partes en paralelo** (había `parte-lienzo/`,
  `editores-v6/`, un `romper.mjs` ajeno): es la regla de `/tmp` un nivel más adentro. Cada parte usa
  una subcarpeta propia, o el `commit -F` de una lee el mensaje de otra.
- **Python en Windows escribe CRLF en modo texto**: un `.ts` creado en LF y editado con `open().write()`
  queda CRLF entero (parejo, no mezclado). Y un arnés de roturas cuyo «de» viene de un JSON con `\n` no
  encuentra nada en un archivo CRLF: el arnés tiene que pasar sus anclas al salto del archivo.
- **Un script no puede importar el catálogo de CRON** (`TRIGGERS`, `lib/email-marketing.ts`): arrastra
  `lib/workspace.ts`, que es `server-only`. El script imprime el `trigger_tipo` crudo; copiar la lista
  sería un segundo catálogo.

### Lo que quedó sin hacer (parte «modelo»)

- **El cableado, que es de otras partes** (las líneas exactas van en el reporte de la corrida):
  `SecuenciaPerfil` abre con `abrirFlujo` y guarda el borrador; la ruta POST
  `/api/chat-agent/secuencias` con `action: 'borrador'`; el GET lee `leerBorradoresSecuencias`; el
  `EditorDeNodo` pasa `onPasarARespuesta`; `lib/flujo-conversacion.ts` dibuja `respuesta` como
  CONDITION; `lib/flujo-edicion.ts` edita por `conectar` / `desconectar` / `crearSuelta`.
- **Aplicar la 0240 ANTES del deploy** (tolera su ausencia: sin columna no hay borrador).
- **`scripts/quitar-ir-a.mts --aplicar`**: lo decide Martín. Sin correrlo, el lienzo abre igual sin GO TO
  y Publicar guarda lo convertido.
- **El plazo de una respuesta** («si responde en N horas») no existe en el motor. `lib/nutricion.ts`
- **Verlo con clics**: nada de esta parte se vio en un navegador.
## Sexta tanda (09/10/2026, parte «lienzo»): «Entonces», arrastrar flechas, sueltas, el DELAY en la flecha y el click derecho

Pedido literal en la bitácora (9 oct 18:37), General 2-8, 13 y 14, CRON 10 y DELAY 1. Las ediciones
del mouse viven en `lib/flujo-edicion.ts` (puro, con test); el lienzo las dibuja.

### El CRON implícito convierte «queda flotando» en «pasa a colgar del CRON» [lienzo]

**Síntoma (en los tests, antes de la pantalla):** borrar la primera tarjeta hacía que la de después
quedara conectada al CRON sola; y conectar una suelta a la primera hacía que la SUELTA pasara a ser la
salida (CRON → suelta → primera).

**Causa:** sin nodo de inicio, la salida es «la primera tarjeta que nadie apunta, en el orden del array»
(`raizSalida`). Toda edición que cambia quién no tiene padre puede cambiar la raíz sin que nadie la toque.
⚠️ El diagnóstico obvio («la suelta tiene que ir al final del array») es la mitad: un hijo que pierde a su
padre puede estar ANTES de la raíz en el array, y se la gana igual.

**Regla:** una edición que puede cambiar «la primera» deja la flecha del CRON EXPLÍCITA (`conRaiz`: el
inicio `'entrada'` con la raíz de antes) — sólo cuando hace falta, así un flujo que nadie desconectó
queda igual byte a byte. Romperlo tumba 4 de 16 tests.

**Vive en:** `lib/flujo-edicion.ts` (`conRaiz`) · `tests/flujo-edicion.test.ts`

### Sacar la regla de «dos padres» abre una puerta que no es de dibujo: dos hilos que se juntan [modelo, lienzo]

**Síntoma:** CRON → m1 → m2 con e1 en paralelo; conectar e1 a m2 «se puede» y el lead recibe m2 DOS veces.

**Causa:** ⚠️ la regla «una tarjeta cuelga de un solo lugar» de `validarGrafo` parecía una restricción
del layout (un árbol) y era además la que impedía que dos hilos en paralelo alcanzaran la misma tarjeta:
el motor corre cada hilo por su cuenta (`aplicarAHilo`). Con varios padres (punto 13), juntar ramas de
una CONDICIÓN está bien (se excluyen: corre una) y juntar dos hilos en paralelo duplica envíos.

**Regla:** `conectar` rechaza juntar dos caminos en paralelo (`tarjetasDondeSeJuntan`; «Si responde» no
cuenta: retoma UN hilo). ⚠️ Pero `validarGrafo` también lo tiene que rechazar, o Crear con IA, la API o un
flujo viejo lo producen sin pasar por el lienzo: lo pedí a la parte del modelo.

**Vive en:** `lib/flujo-edicion.ts` (`tarjetasDondeSeJuntan`) · `lib/flujo-grafo.ts` (`validarGrafo`)

### Una espera sobre la flecha sigue siendo un NODO: la flecha del dato llega a ella, no a `hasta` [lienzo]

El DELAY del medio se dibuja como pastilla sobre la flecha padre → lo de después (`AristaFlujo.esperas`) y
no ocupa columna; en el dato sigue siendo un `esperar` con su `siguiente`. Quien borra o inserta sobre esa
flecha mira `esperas[0]`, no `hasta`: borrar la flecha se lleva sus esperas (eran de ella) y deja suelto lo
de después; eliminar la pastilla la SACA de la cadena (`borrarNodo`) y la flecha queda. Se aplasta sólo si
es un lugar de la flecha: un padre, una salida que sigue en algo y nada en paralelo; la del final, con dos
padres o que reparte sigue siendo su píldora. Lo que se pierde: una espera del medio ya no ofrece «＋ en
paralelo» desde ella (no tiene círculo).

**Vive en:** `lib/flujo-conversacion.ts` (`colapsable`, `tramo`) · `lib/lienzo-grafo.ts` (`posicionDePildora`, `puntoDeCurva`) · `app/automations/FlujoLienzo.tsx` (`quitarFlecha`, `borrarTarjeta`)

### El botón derecho armaba un gesto y SELECCIONABA la tarjeta debajo de su menú [lienzo]

`onPointerDown` no miraba el botón: con el click derecho capturaba el puntero y el `pointerup` lo
resolvía como un clic (abría el panel). El gesto de un lienzo se arma sólo con `e.button === 0`.

**Vive en:** `app/_components/Lienzo.tsx` (`onPointerDown`, `bajarCirculo`)

### El scratchpad NO es de la parte: es de la SESIÓN, y las ocho partes son la misma [proceso]

A mitad de la corrida, `msg1.txt` del scratchpad pasó a tener el mensaje de commit de OTRA parte («tiempo»).
Se salvó porque el commit ya había salido (verificado con `git log -1 --format=%B`). ⚠️ El diagnóstico
obvio —«el scratchpad es mío, la regla de `/tmp` no me toca»— es el equivocado: los subagentes de un
workflow comparten el directorio de su sesión, y los nombres que se le ocurren a uno (`msg1.txt`, `tc.txt`,
`correr-tests.mjs`) se le ocurren a todos. Cada parte trabaja en su subcarpeta (`scratchpad/parte-<nombre>/`).

### Verificado con clics (dev server del worktree, ws1, sólo lectura) [lienzo]

Playwright contra `next dev`, con una automatización de mentira inyectada en el GET de secuencias
(m1 → espera 1 h → m2, y m3 suelta) y TODO lo que no es GET contestado por el arnés: 0 llegaron al server.
Medido: el fondo con botón derecho ofrece 10 filas (los 7 tipos, Publicar, Acomodar, Centrar) y cierra con
Escape; la tarjeta, 3 (Duplicar, Desconectar, Eliminar) sin abrir el panel; un clic en el ＋ de m2 abre el
menú de 7 tipos en la punta (pegado al borde derecho de la ventana); arrastrando de m2 a m3 queda todo en
0,28 menos origen y destino (1) con la flecha siguiendo al cursor, y al soltar las flechas pasan de 2 a 3 y
m3 deja de estar suelta; la papelera de m1 se lleva la flecha y su espera (píldoras 1 → 0) y deja sueltas
m2 y m3 (m3 cuelga de una suelta, así que tampoco se alcanza).

⚠️ El ws3 no sirve para esto: rebota al onboarding GLOBAL (`/onboarding?ws=3`), y el arnés esperó el
lienzo 10 minutos en vez de fallar al ver la URL. Un arnés que espera un selector mira también `p.url()`.

### Lo que quedó sin hacer (parte «lienzo»)

- **Verlo con clics con datos reales** de un cliente: lo de arriba corrió sobre una automatización
  inyectada. Sin clic quedaron: editar la píldora del DELAY, crear una tarjeta con el botón derecho en un
  punto, Duplicar, la lista «⚡ Cuando…» del CRON y el botón Acomodar.
- La lista: el reparto la ubicaba en `ChatAgentApp.tsx` y vive en `app/automations/SimuladorWhatsApp.tsx`
  (las divisiones y los íconos del «⋯» son dos hunks ahí). Los íconos del desplegable del FILTRO salen de
  `lib/chatbot-lista-filtro.ts`, que no es de esta parte.
- Las posiciones (lo movido, la suelta, «Acomodar») siguen afuera de Ctrl+Z: «Acomodar» trae su deshacer
  en un aviso; mover una tarjeta, no.
- La papelera del círculo aparece al pasar el cursor por la tarjeta (o con la tarjeta elegida), no siempre.
## Sexta tanda (09/10/2026, parte «disparadores»): varios CRON por automatización

Una automatización tiene ahora una LISTA de CRON (`nutricion_secuencias.disparadores`, mig 0241) y
arranca por CUALQUIERA. El primero sigue viviendo también en las columnas de siempre (`trigger_tipo`,
`etapa`, `cron`…), que leen unos quince lugares; los demás, sólo en la lista. **La regla para código
nuevo: quien pregunta «¿esto dispara esta automatización?» recorre `vistasPorDisparador(sec)`
(`lib/disparadores.ts`), nunca `sec.trigger_tipo` solo** — eso es el primer CRON, no la automatización.

### Un Recurrente con «A quién» arrancaba TAMBIÉN por el evento [motor]

Con el CRON único, una secuencia con `cron` y `trigger_tipo: 'etapa_actual'` era «cada lunes a las 9, a
los que están en Agendado» — y `enrolarPorEvento` la inscribía además en el momento en que alguien
entraba a Agendado, porque sólo miraba `trigger_tipo`. Con varios CRON eso deja de ser un detalle: un
«Recurrente» y un «Producto» sobre la misma etapa son dos cosas distintas. El evento saltea los CRON con
horario (`!s.cron`) y `disparaPorEvento` devuelve false para un horario. Medido en prod el 09/10: **cero
secuencias con `cron`**, así que el cambio no le mueve nada a nadie hoy.

**Vive en:** `lib/nutricion.ts` (`enrolarPorEvento`) · `lib/disparadores.ts` (`disparaPorEvento`)

### Guardar la lista entera corría el ancla de los horarios a «ahora» [motor]

Cada toque del panel (un «A quién», el evento de OTRO CRON) guarda la lista completa, y la primera
versión recalculaba la próxima ocurrencia de todos los horarios: un «todos los lunes a las 9» guardado
un lunes a las 10 saltaba al lunes siguiente y perdía la de hoy, o la que el motor ya había reclamado.
`conProximas` conserva la de antes si la firma del horario de ESE CRON no cambió. Es la regla de
AGENTS.md («un horario se ancla en la ocurrencia anterior») aplicada a un guardado que no es del horario.

**Vive en:** `lib/disparadores.ts` (`conProximas`) · `lib/disparadores-guardar.ts`

### Un CRON extra con horario necesita su propio compare-and-set, y sin la 0241 no existe [motor]

El CAS de siempre (`.eq('cron_proxima_at', …)`) cubre sólo la columna, o sea el primero. Los horarios
de los demás viven en el JSON: se reclaman con un CAS sobre `disparadores_rev`, que sube en cada
escritura (`reclamarOcurrenciaExtra`). Con la 0241 sin aplicar no hay `rev`: el motor no reclama ningún
extra y el guardado rechaza una lista de más de uno («Aún no se pueden varios CRON.») en vez de guardar
la mitad.

**Vive en:** `lib/nutricion.ts` (`comprometerInscripciones`, `reclamarOcurrenciaExtra`) · `lib/disparadores-guardar.ts`

### «El grupo de MaKo» como destinatario: cómo corre un Recurrente sin lead [motor]

Un Recurrente con el grupo marcado, en cada ocurrencia RECLAMADA (no en el dry-run), le manda al grupo
de MaKo los TEXTOS de los mensajes del flujo (`textosParaElGrupo`) por `emitirAviso` (tipo
`chatbot-aviso-equipo`, `dedupKey` por ocurrencia). No corre condiciones, esperas ni acciones: sin lead
no hay de quién preguntar nada. Dos trampas:

- **`emitirAviso` sin workspace cae al `OWNER_WS`**, que es el ws1, un CLIENTE: un Recurrente de otro
  negocio le hablaría al grupo de Mauricio. `mandarRecurrenteAlGrupo` lee `wsEnContexto()` y sin él no
  manda nada.
- **El barrido sólo corre si el negocio tiene un canal prendido**: `app/api/cron/nutricion` llama a
  `comprometerInscripciones` dentro de esa condición. Un Recurrente que sólo le habla al grupo, en un
  negocio sin WhatsApp ni email, no sale. Es de la ruta del cron (otra parte): está en «sin hacer».

**Vive en:** `lib/nutricion.ts` (`mandarRecurrenteAlGrupo`) · `lib/disparadores.ts` (`textosParaElGrupo`)

### Sacar una etiqueta no avisaba nada, y la etapa no puede disparar «Se elimina» [etiquetas]

`sacarEtiquetaCon` no emitía ningún evento: «Se elimina etiqueta a un lead» no tenía de dónde salir.
Ahora emite `etiqueta_quitada` (con su clave de reclamo `etiqueta-quitada:<id>`), salvo cuando la saca
el cambio de ETAPA: mover a un lead de columna le saca la etiqueta de la columna vieja, y eso dispararía
«Se elimina…» en cada movimiento del kanban.

**Vive en:** `lib/etiquetas-motor.ts` · `lib/etiquetas.ts`

### El contrato con «canales» y «probar»: los eventos nuevos y su `subtipo` [motor]

`EventoNutricion` suma `etiqueta_quitada`, `instagram`, `messenger` y `email_recibido`, y `CtxEvento`
suma `subtipo` (Instagram: `comentario | historia | dm | anuncio | en_vivo | ref`; Messenger: `anuncio |
comentario | dm | ref | qr | tienda`). Hoy no los emite nadie: los webhooks son de la parte «canales».
Los eventos de anuncios se OFRECEN apagados («Todavía no»), como en ManyChat, y con el canal sin
conectar se apagan todos con su motivo (`GET /api/chat-agent/secuencias?canales=1`). «No pude
comprobarlo» también apaga: un evento que no puede llegar es una automatización que no arranca nunca.

**Vive en:** `lib/nutricion.ts` (`EventoNutricion`, `TRIGGERS_POR_EVENTO`) · `lib/disparadores.ts` (`EVENTOS_*`) · `lib/disparadores-canales.ts`

### El catálogo `TRIGGERS` no conoce los tipos nuevos [motor]

`lib/email-marketing.ts` (`TRIGGERS`) es el catálogo con el que `setTriggerSecuencia` valida y con el
que la API de MaKo nombra un disparador. Los seis tipos nuevos no están: el guardado de la lista los
acepta (`TRIGGERS_NUEVOS`), pero `setTriggerSecuencia` los rechaza y `labelDe(TRIGGERS, …)` devuelve el
slug crudo. Sumarlos ahí es de otra parte; mientras tanto, «Crear con IA» y la API sólo editan el
primer CRON con los tipos de siempre.

**Vive en:** `lib/email-marketing.ts` (`TRIGGERS`) · `lib/disparadores-guardar.ts`

### Un test de coherencia en verde con la rotura: el saneo ya hacía el trabajo [proceso]

La regla «`ignorar` sólo vale en las dos etiquetas genéricas» se probó quitándola de
`problemaDeDisparador`, y el test siguió verde: `higiene` (el saneo) ya borraba el campo antes de
validar. El diagnóstico obvio —«el test está flojo»— era el equivocado: la rotura no era observable por
ese camino. Hizo falta un caso que el saneo no limpia (un `subtipo` de Messenger en un CRON de
Instagram). Cuando un guard de validación pasa con la validación quitada, mirá primero si un saneo de
más arriba ya la cumple.

### Proceso: el scratchpad de una corrida es UNO para todas las partes [proceso]

Las ocho partes de esta tanda compartían el directorio de scratchpad: un `msg1.txt` con el mensaje de
un commit lo pisó otra parte antes del `git commit -F`. Se verificó el cuerpo después de commitear
(`git log -1 --format=%B`) y cada parte pasó a su propia subcarpeta. Es la regla de `/tmp` de AGENTS.md,
un nivel más adentro: un scratchpad por SESIÓN no es uno por AGENTE.

### Lo que quedó sin hacer (parte «disparadores»)

- **La tarjeta CRON del lienzo todavía no dibuja la lista**: `FlujoLienzo` ya tiene las props
  (`disparadores`, `onNuevoDisparador`, `onAbrirDisparador`) y SecuenciaPerfil las llena; dibujar una
  fila por CRON con su ícono y «＋ Nuevo CRON», y abrir el panel con ESE CRON, es de la parte «lienzo».
  `app/automations/FlujoLienzo.tsx`
- **El panel del Recurrente pide más alto**: `ALTO_EDITOR_CONTROL` de la entrada es 320 y el Recurrente
  con «A quién» mide ~440. `lib/lienzo-grafo.ts`
- **El barrido no corre sin un canal prendido** (ver arriba): un Recurrente sólo al grupo no sale.
  `app/api/cron/nutricion/route.ts`
- **Ninguna operación de la API cambia los CRON**: la ficha (`ficha_secuencia_mensajes`) los LEE;
  `setTriggerSecuencia` y las tools de antes siguen editando sólo el primero. Y «Crear con IA» elige uno
  solo. `lib/api-mako/areas/chatbot.def.ts` · `lib/flujo-ia.ts`
- **Los webhooks de Instagram, Messenger y Email no emiten los eventos** (parte «canales»), y «Probar»
  no simula un Recurrente ni un evento de canal (parte «probar»).
- **Aplicar la 0241 ANTES del deploy** (el código la tolera ausente: dispara sólo el primer CRON).
  Lo decide Martín. `supabase/migrations/0241_secuencia_disparadores.sql`
- **Nada se vio con clics**: los seis botones, el Recurrente (días, calendario, reloj, huso), «A
  quién», «Ignorar», los eventos apagados y las pastillas de dos CRON se probaron dibujando
  (`tests/editor-disparadores.test.ts`), no en un navegador.
## Sexta tanda (09/10/2026, parte «editores»): el desplegable de la casa, TAG con varias, ACTION en árbol, DELAY sin aviso

Pedido literal en la bitácora (9 oct 18:37): general 9, 10 y 11, CONDITION 2 a 4 («para todos lados»),
TAG 1 y 2, ACTION 1 y 2, DELAY 2 y CRON 1. Rama `wip-v6-editores`.

### Una tarjeta TAG con varias etiquetas: la acción acepta UNA y el validador tira el resto SIN ERROR [editores]

Lo obvio era guardar la lista en el paso (`etiquetaIds: [7, 8, 9]`) y dejar que el motor la corra. Medido el
09/10: `poner_etiqueta_lead` / `sacar_etiqueta_lead` declaran UN `etiquetaId: number`, y `validarInput`
(lib/api-mako/validar.ts) recorre sólo los `parametros` de la def: lo que la def no declara NO LLEGA y nadie
lo dice (`faltanEnPaso` tampoco lo ve). Una tarjeta con tres corría la primera —o ninguna— con la pantalla
mostrando tres. Lo hecho: la primera sigue en `etiquetaId` (así la leen sin cambios la tarjeta, el conteo de
uso, Crear con IA y el freno de Publicar) y TODAS van en `etiquetaIds` sólo si son más de una; con una, el
paso queda exacto como antes. Correr una por etiqueta es `unaPorEtiqueta` + `juntarPorEtiqueta`, para el
ejecutor. ⚠️ **Ese enchufe vive en `ejecutarDesdeFlujo` (lib/api-mako/flujo.ts), que no es de esta parte:
sin él corre sólo la primera.** Lo dice un test `todo` en tests/editor-etiqueta.test.ts.

La regla: un dato de MÁS DE UN VALOR en un paso de un flujo lo declara la def o lo parte el ejecutor;
guardarlo y confiar en que viaja es un éxito parcial callado. Los que leen la forma vieja (`params.etiquetaId`
solo), medidos: `etiquetaDeAccion` (lib/flujo-conversacion.ts), `usoDeEtiqueta` (lib/etiquetas-reglas.ts) y
lib/flujo-ia.ts (la vuelta a JSON de «Editar con IA», la resolución de las nuevas, `validarIA`).

**Vive en:** `lib/editor-acciones.ts` (`etiquetasDelPaso`, `paramsConEtiquetas`, `unaPorEtiqueta`, `juntarPorEtiqueta`) · `app/automations/EditorEtiqueta.tsx` · `app/automations/FlujoLienzo.tsx` (`EditorEtiquetaLienzo`)

### «Mover de etapa» y «Mover en otro producto»: cuál sirve lo decide el LEAD, no el flujo [acciones]

Para «faltan muchas acciones», lo obvio era sumar `mover_lead_en_producto`: «Mover de etapa»
(`proponer_cambio_etapa`) mueve SÓLO en el producto principal del lead —el producto que se elige en el editor
es una pista—. Medido en los `preparar` (lib/api-mako/areas/crm.run.ts): `mover_lead_en_producto` rechaza el
producto que es el principal del lead y el producto que el lead no tiene, sin `yaEstaba`. En un flujo pasan
leads con principales distintos, así que con las dos en el menú la equivocada falla en cada lead con una alarma
al dueño. Se dejó afuera, con su porqué en `ACCIONES_DEL_FLUJO`. Lo que falta es UNA «Mover de etapa» que, por
lead, corra una u otra según el producto elegido sea su principal o uno agregado (en el ejecutor, o una acción
nueva del registro).
**Hecho el 21/10/2026, en el ejecutor** (`moverEnElCrmDelPaso`, lib/api-mako/flujo.ts): ver «La prospección del Sprint».

**Vive en:** `lib/editor-acciones.ts` (`ACCIONES_DEL_FLUJO`) · `lib/api-mako/areas/crm.run.ts` · `app/_components/CamposAccion.tsx` (`SelectorEtapa`)

### Un campo `icono`, tres formas; y lo que cada negocio nombra no lleva ícono [ui]

El `icono` de un renglón del `Dropdown` acepta el NOMBRE de uno del set de la casa (app/_ui/iconos-menu.tsx,
para que lo pida una lista armada en un `.ts`), una URL o `data:` (los logos del ＋), o un dibujo. Un nombre
no trae `:`, `/` ni `.`, así que no se confunde con una URL. ⚠️ `esIconoMenu` va con `hasOwnProperty`: con
`s in TRAZOS`, «toString» era un ícono (lo cazó la rotura B10) y el renglón dibujaba nada con cara de algo.
Lo que nombra cada negocio (etapas, productos, etiquetas) va con su `color`, no con un ícono repetido. Y
«borrar» es UN dibujo (`TRAZOS_BORRAR`) en rojo que no se puede cambiar desde afuera: el rojo no es un prop.

**Vive en:** `app/_ui/iconos-menu.tsx` · `app/_ui/BotonBorrar.tsx` · `app/components/Dropdown.tsx` (`IconoOpcion`) · `app/components/dropdown-reglas.ts`

### Git Bash se come una barra de un argumento que empieza con `//`, y el scratchpad es de las ocho partes [proceso]

- `node reemplazar.mjs archivo nuevo "// ── Marca"` llegó como `/ ── Marca` (MSYS convierte lo que arranca con
  `//` como si fuera una ruta). El reemplazo por anclas calzó un carácter corrido: «///» arriba y «/ ──»
  abajo, y el typecheck lo dijo como «Unterminated regular expression literal» en una línea que no nombra
  la causa. Las anclas de texto van en un archivo (un JSON), nunca por la línea de comandos.
- El scratchpad de la sesión lo comparten las partes de la corrida: un `eol.mjs` de esta parte lo pisó otra
  con el mismo nombre en minutos, y `editores/` traía archivos de la cuarta tanda. Cada parte trabaja en una
  carpeta con su nombre y su tanda (`editores-v6/`).

### Lo que quedó sin hacer (parte «editores»)

- **Los enchufes en archivos ajenos** (el detalle exacto, en el informe de la parte): correr una por etiqueta
  en `ejecutarDesdeFlujo` (lib/api-mako/flujo.ts); «Agregar Cualificado y 2 más» en la tarjeta
  (`etiquetaDeAccion` / `textoEtiqueta`, lib/flujo-conversacion.ts); `usoDeEtiqueta` con todas
  (lib/etiquetas-reglas.ts); el ✕ del chip dice «Sacar» (`ChipEtiqueta`, app/_components/etiquetas-cliente.tsx);
  «Poner»/«Sacar» en app/crm/AccionesLoteLeads.tsx, app/crm/lead-view/EtiquetasDelLead.tsx, lib/etiquetas-motor.ts
  (el historial del lead), lib/api-mako/areas/crm.run.ts, crm.def.ts y whatsapp.run.ts, lib/flujo-ia.ts; y el alto
  del panel del TAG (`ALTO_EDITOR_CONTROL.etiqueta`, lib/lienzo-grafo.ts: con varias, 140 scrollea).
- **El barrido del tacho por toda la app** (general 9): `BotonBorrar` / `IconoBorrar` existen y no los usa
  todavía ninguna pantalla. Los lugares: el 🗑 del panel del lienzo (`app/_components/Lienzo.tsx:1060`, el que
  Martín ve); `Icon name="trash"` (app/admin/ui/CatalogoUI.tsx:193, app/_components/PanelAgencia.tsx:66/363/387,
  app/automations/GrabadorAudioPaso.tsx:168, app/automations/OnboardingChatAgent.tsx:1176,
  app/integraciones/NombrarVideos.tsx:245, app/integraciones/ProbarTracking.tsx:298/677,
  app/integraciones/ServicioConfigForm.tsx:806, app/video-generator/EditorAnuncio.tsx:516,
  app/video-generator/ElegirFoto.tsx:240, app/video-generator/PasoTomas.tsx:411,
  app/ads-manager/BarraAcciones.tsx:369); `IconTrash` del composer (app/whatsapp/_shared/composer-icons.tsx:26,
  usado en app/automations/EditorMensajeWhatsApp.tsx:560, app/whatsapp/_shared/ComposerWhatsApp.tsx:342,
  app/whatsapp/_shared/VoiceRecorder.tsx:179); el 🗑 de app/experimentos/RetroTab.tsx:113/188; los trazos sueltos
  de app/crm/AccionesLoteLeads.tsx:147, app/crm/CrmBoard.tsx:263, app/onboarding/Archivero.tsx:79 y
  app/_ui/EditorRico.tsx:542. Las ✕ que BORRAN (no las que cierran) quedan por contar aparte.
- **Los íconos en los ~71 desplegables de la app** (general 10): el `Dropdown` los dibuja y el set existe; los
  pusieron sólo ACTION, TAG y DELAY.
- **Las acciones de Customer Success de la rama de la API** (`wip/api-acciones-0910`: mover en la entrega,
  invitar al curso, mandar el link, cortar el acceso, abrir un módulo): entran a `ACCIONES_DEL_FLUJO` cuando
  la rama llegue a main, y piden controles nuevos (el servicio y la etapa de la ENTREGA, no las del CRM).
- Los campos de abajo del selector de ACTION siguen a 40 de alto (`Select` de app/_ui): «botones gigantes»
  quedó en el principal. `app/_components/CamposAccion.tsx`
- Verlo con clics: el árbol de ACTION, el TAG con tres chips y «＋ Otra», el DELAY a 56 y un desplegable de 8
  opciones con su buscador.
## Sexta tanda (09/10/2026, parte «canales»): Instagram y Messenger por Zernio

Medido contra la doc de Zernio (`docs.zernio.com/llms-full.txt` y `zernio.com/openapi.json` v1.249.1,
bajados el 09/10/2026) y contra producción en sólo lectura. **No se mandó un solo mensaje ni se recibió
un evento real**: todo lo de abajo que dice «doc» es lo que Zernio documenta, no lo que se vio pasar.

### Los disparadores de ManyChat contra lo que Zernio entrega [canales]

| ManyChat | Canal | Qué lo trae en Zernio | ¿Va? |
|---|---|---|---|
| Comenta tu publicación o Reel | Instagram | `comment.received` (`comment.isLive` ausente) | sí: se contesta por privado, UNA vez y en 7 días; a quien no sigue la cuenta, sólo texto |
| Responde a tu historia | Instagram | `message.received` con `metadata.storyReply` | sí |
| Te envía un mensaje | Instagram | `message.received` | sí |
| Hace clic en tu anuncio | Instagram | `message.received` con `metadata.referral.ad_id` | sí: Meta suele mandar primero el post del anuncio SIN referral y el referral en el mensaje que sigue |
| Comenta en tu En vivo | Instagram | `comment.received` con `comment.isLive: true` | sí: la respuesta privada sale mientras el En vivo está al aire |
| Clic en tu enlace de referencia | Instagram | `metadata.referral.ref` (o `referral.received` en un chat que ya existía) | sí, con trampa: en un chat NUEVO Instagram manda el `ref` sólo si la cuenta tiene un Ice Breaker |
| Hace clic en tu anuncio | Messenger | `metadata.referral.ad_id` / `referral.received` (clic de vuelta) | sí |
| Comenta tu publicación | Messenger | `comment.received` (platform `facebook`) | sí, con una duda NO medida: el id del autor de un comentario de Facebook puede no ser su PSID de Messenger, y entonces quien comenta y quien contesta la respuesta privada serían dos filas (en Instagram los dos son el IGSID) |
| Te envía un mensaje | Messenger | `message.received` | sí |
| Clic en tu enlace de referencia | Messenger | `referral.received` / `metadata.referral.ref` | sí |
| Escanea un código QR | Messenger | el mismo `referral`, con un `ref` que empieza con `qr-` | sí, por convención: Meta no distingue escanear de tocar (el QR es el link `m.me/…?ref=qr-…`) |
| Mensajes de tu tienda de Facebook | Messenger | — | **NO: apagado**, «Zernio no avisa los mensajes que llegan desde la tienda» |

La tabla vive en código (`DISPARADORES_SOCIALES`) y `tests/canal-social.test.ts` exige que cada fila
«disponible» la produzca un cuerpo del webhook. Una mención en una historia SÍ llega
(`metadata.isStoryMention`) y no la escucha ningún disparador: no es «te envía un mensaje».

**Vive en:** `lib/canal-social.ts` (`DISPARADORES_SOCIALES`, `eventoSocialDe`)

### Instagram NO es el WhatsApp no oficial: la ventana de 24 h acá SÍ existe [canales]

AGENTS.md dice «el WhatsApp del chatbot no tiene ventana de 24 h», y el reflejo es copiar el WhatsApp
tal cual. Para Instagram y Messenger es al revés: un DM sale dentro de las 24 h del último mensaje DE LA
PERSONA, o como la única respuesta privada a un comentario (7 días). Fuera de eso Instagram acepta sólo
`HUMAN_AGENT`, que por política de Meta es para una persona que contesta, nunca para una automatización.

- Un paso social fuera de la ventana NO sale y es **terminal** (cierra el hilo con su motivo): reintentar no
  la abre; sólo la abre la persona escribiendo.
- El reloj de acá es la pre-guarda; lo que manda es la respuesta de Zernio (`PLATFORM_LIMITATION`,
  `privateReplyConsumed`, `not_thread_owner`: `esLimiteDeMeta`).
- **El freno de 20 h del WhatsApp NO aplica**: protege a la línea no oficial de un baneo, y frenar 20 h un
  segundo DM lo dejaría fuera de la ventana.
- Un DELAY de más de 24 h antes de una tarjeta de Instagram la deja siempre afuera: el editor todavía no lo avisa.

**Vive en:** `lib/canal-social.ts` (`decidirSalida`) · `lib/canal-zernio.ts` · `lib/nutricion.ts` (la rama social)

### Un paso de Instagram le habría salido al lead POR WHATSAPP, sin un error [canales]

El diagnóstico obvio era «falta la rama de envío». La causa real eran dos lugares que convierten en
WhatsApp todo lo que no reconocen:

- `setSecuenciaPasos` guardaba `canal: email ? 'email' : 'whatsapp'`: la tarjeta de Instagram se publicaba
  como WhatsApp. Ahora `canalAGuardar` la conserva.
- La respuesta de «Si responde» (`responderConGrafo`) preguntaba `proveedorDelPaso(p) !== 'no_oficial'`, y un
  paso de Instagram «es» no oficial porque no tiene plantilla: salía por la línea. Ahora se frena antes.

La regla está en AGENTS.md: un camino que manda lo que dice un paso pregunta `esCanalSocial` ANTES de
decidir que es WhatsApp.

**Vive en:** `lib/nutricion.ts` (`setSecuenciaPasos`, `procesarEnvios`, `responderConGrafo`)

### Sin WhatsApp ni email, el cron decía 'off' y el DM que sigue a una espera no salía nunca [canales, motor]

(Revisión de la sexta tanda, 10/10/2026.) Lo engañoso es que **el primer DM sale**: va por la vía
rápida del evento, que no mira los interruptores del negocio, y el motor trata Instagram y Messenger
como siempre prendidos (`canalOn`). Una prueba con un mensaje inmediato da verde. Lo que no salía era
lo que viene después de «Esperar 1 día»: eso lo despierta el cron, y sus DOS puertas (el tick y la
corrida de cada hora) devolvían `modo: 'off'` en un negocio sin `envio_whatsapp_enabled` ni
`envio_email_enabled` —el caso de un negocio que usa sólo Instagram, como el ws13— porque la única
excepción que conocían eran los pasos «⚡ Acción». Sin un error, y con la ventana de Meta corriendo.

Es la tercera puerta de la misma familia que la entrada de arriba: un lugar que decide «¿hay algo que
mandar?» con la lista de canales de ANTES. Ahora las dos puertas preguntan con `correSinCanales`
(`lib/motor-tick.ts`, pura y ejecutada en `tests/motor-tick.test.ts`): una acción, o un MENSAJE (por la
clase del nodo, no por el campo `canal`) por Instagram o Messenger. La regla: **al sumar un canal sin
interruptor del negocio, grepeá las puertas que deciden si el motor corre**, no sólo el motor.

**Vive en:** `lib/motor-tick.ts` (`correSinCanales`) · `app/api/cron/nutricion-tick/route.ts` · `app/api/cron/nutricion/route.ts`

### El webhook de Zernio nunca entregó un evento: con key propia, el webhook vive en SU cuenta [canales]

Medido en producción (09/10/2026): los dos negocios con Zernio (ws11 y ws13) tienen key PROPIA, fila de
ruteo por profile y `zernio_workspace.webhook_ok = false` desde agosto. No es la firma ni el ruteo: con
key propia el webhook se registra en la cuenta de Zernio DEL NEGOCIO, y nadie lo registró. Lo registra
MaKo (`asegurarWebhook`, idempotente) cuando el editor de la tarjeta pide la cuenta (POST `/api/zernio`,
«estado»), con un secreto DE ESE NEGOCIO y no el de la plataforma (ver la entrada siguiente).

Y dos trampas de la forma del evento: **un `comment.received` NO trae el profile** (sólo
`account.accountId`), así que el ruteo por profile no alcanza y cada cuenta conectada se reclama aparte
(`zernio_cuenta`); y **Zernio corta a los 5 s**, así que el webhook guarda rápido y dispara la
automatización en `after`. El dedup es por el id del EVENTO (`zernio_eventos`, mig 0242), que es el mismo
en cada uno de los 7 reintentos.

**Vive en:** `lib/zernio.ts` (`asegurarWebhook`, `cuentasConectadas`) · `app/api/webhooks/zernio/route.ts` · `app/api/zernio/route.ts`

### Con key propia, lo que MaKo le da a Zernio lo lee el cliente: el secreto del webhook es por negocio [canales]

Revisión adversarial del 10/10/2026 (hallazgo #4). `asegurarWebhook` escribía el secreto ÚNICO del webhook
(`ZERNIO_WEBHOOK_SECRET`, el que verifica los eventos de TODOS los negocios) en la cuenta de Zernio del
cliente. Medido en producción con un GET: **`GET /v1/webhooks/settings` devuelve el `secret` en claro**
(en la cuenta de la plataforma vino el maestro). O sea que el cliente con su key lo leía y firmaba eventos
de cualquier otro negocio. No llegó a salir: ws13 tenía 0 webhooks y la cuenta de ws11 contesta 402.

- **Cuenta propia: `secretoDeWorkspace(maestro, ws)` y la URL `?w=<ws>`**; la de la plataforma, el
  maestro y la URL pelada. El webhook verifica con el que nombra el `?w=` y, ANTES de reclamar el evento,
  exige que el evento ruteado sea de ese negocio (`aceptaElWorkspace`). El maestro vale sólo para negocios
  sin cuenta propia, preguntado con la lectura estricta.
- ⚠️ **El arreglo obvio (`ws === w`) no alcanzaba.** Con SU propio secreto, el dueño de una cuenta propia
  firma en su `?w=` un `account.connected` con el `accountId` de otro negocio, y el ruteo de una cuenta es
  del primero que la reclama. `account.connected` ya no le cree al cuerpo: reclama las cuentas que lista
  la cuenta de Zernio de ese negocio (`cuentasConectadas`).
- **El parámetro es `w` y no `ws`**: `?ws=` lo lee `proxy.ts`.
- **Se re-apunta sólo el webhook de la URL exacta.** Si un negocio cargara como «propia» la key de la
  plataforma, el de la URL pelada es el webhook que comparten todos los negocios sin cuenta propia.
- Si algún día hay que rotar el maestro, cambian también los secretos de cada negocio: el de la plataforma
  se re-registra a mano, y el de cada cuenta propia en el próximo «estado» de su editor (hasta entonces,
  sus eventos dan 401).

**Vive en:** `lib/zernio-firma.ts` (`secretoDeWorkspace`, `webhookDeLaCuenta`, `aceptaElWorkspace`) · `lib/zernio.ts` (`asegurarWebhook`, `usaCuentaPropia`) · `app/api/webhooks/zernio/route.ts` · `tests/zernio-secreto-por-negocio.test.ts`

### El profile guardado puede ser de OTRA cuenta de Zernio: la key cambia después [canales]

Revisión adversarial del 10/10/2026 (hallazgo #3). ws11 nunca podía usar Instagram ni Messenger, y la
pantalla no decía por qué (decía «Conectar», y conectar contestaba «Zernio no contestó»). La causa no era
la conexión: `zernio_workspace.profile_id` de ws11 es el `mako_ws_11` que acuñó la rama SIN key propia el
15/08, en la cuenta de la AGENCIA, y la key propia llegó el 28/08. `profileIdEfectivo` devolvía el guardado
sin mirar de qué cuenta era, y cada pedido iba a la cuenta de ella con un profile ajeno. ws13 andaba sólo
porque su fila tenía `null`.

- **Con key propia, el guardado vale si está en el `GET /profiles` de ESA key**; si no, se suelta y se usa
  el Default de su cuenta (`profileDeLaCuenta`, puro). La fila de ws11 se corrige sola en el primer pedido
  que conteste su cuenta: no hay que escribirla a mano.
- **Y al revés:** con la key de la plataforma, un `null` guardado (lo que deja una key propia borrada) se
  acuña. Antes el negocio quedaba sin profile para siempre.
- Hoy la cuenta de Zernio de ws11 contesta **402 «Account paused: payment required»** a todo: aunque esto
  esté arreglado, su canal no anda hasta que pague (ver «Lo que quedó sin hacer»).

**Vive en:** `lib/zernio-profile.ts` · `lib/zernio.ts` (`ensureProfile`, `profileIdEfectivo`) · `tests/zernio-profile-propio.test.ts`

### Trampas chicas que se pagan caro [canales]

- **`createLead` tira `meta_ad_id` sin avisar**: lo tiene en `LeadCreateInput` y no en el insert (sí lo
  escribe el alta del instant form). Pasarlo no da error y no guarda nada. `lib/leads.ts`
- **Instagram rechaza el MP3 y el OGG/Opus** (doc de Zernio): las notas de voz de la biblioteca de WhatsApp
  no salen por ahí, y por eso el editor social no graba audio.
- **Un test no puede importar un módulo `server-only`** (el paquete tira fuera de `react-server`): el webhook y
  el motor se fijan sobre el FUENTE, y lo que decide va en módulos puros (`lib/canal-social.ts`,
  `lib/zernio-firma.ts`) que sí se ejecutan.
- **Un ancla de rotura tiene que poder fallar**: dos de las roturas del arnés pasaron en verde la primera vez
  porque el reemplazo no tocaba lo que el assert miraba (un `JSON.parse(raw || …)` contra un assert que busca
  `JSON.parse(raw)`). Se rehicieron; el número que vale es el de la segunda corrida.

### Lo que quedó sin hacer (parte «canales») [canales]

- **Una respuesta por Instagram NO pausa la salida**: `pausarPorRespuesta` pausa y además contesta (asistido,
  «Si responde», la charla) POR WHATSAPP. Hace falta que el motor conteste por el canal donde le escribieron.
  `lib/nutricion.ts` · `lib/zernio-entrante.ts`
- **El tinte de la tarjeta** (`CanalTarjeta` e `identidadDeTarjeta`, de la parte «lienzo») y el rótulo de
  «Probar» con varios canales (`SecuenciaPerfil`). Los colores están en `IDENTIDAD_SOCIAL`.
  `lib/lienzo-grafo.ts` · `app/_components/Lienzo.tsx` · `app/automations/SecuenciaPerfil.tsx`
- **El editor del CRON con los doce disparadores** (parte «disparadores»), el QR dibujado y los Ice Breakers
  que pide el `ref` de Instagram. `lib/canal-social.ts` (`DISPARADORES_SOCIALES`, `linkDeReferencia`)
- **Medir en Messenger si quien comenta y quien contesta son la misma fila** (ver la tabla). Si no, la unión
  sale del eco de la respuesta privada (`message.sent`), que hoy no se escucha. `lib/zernio-entrante.ts`
- **Verlo con clics y un evento real**: nada de esto recibió un webhook de verdad.
- **Sin WhatsApp ni email, nadie se INSCRIBE por cohorte** (revisión del 10/10/2026): la rama 'off' de
  la corrida de cada hora corre el motor para lo social pero no llama a `comprometerInscripciones()`
  (sólo `{ soloGrupo: true }`). Una automatización social disparada por un EVENTO anda; una por cohorte
  (antigüedad, residuo) en un negocio que usa sólo Instagram no inscribe a nadie. Decidir si esa rama
  inscribe es de Martín. `app/api/cron/nutricion/route.ts`
- **Un 402 de Zernio llega a la pantalla como «Zernio no contestó»**: `app/api/zernio/route.ts` convierte
  todo 4xx en ese texto. A ws11 (cuenta pausada por falta de pago, medido el 10/10/2026) le tendría que
  decir que es SU cuenta de Zernio la que está pausada y que se arregla pagando ahí
  (`code: 'PAYMENT_REQUIRED'`, `billingUrl` en el cuerpo), como pide AGENTS.md para el error de un tercero.
## Sexta tanda (09/10/2026, parte «whatsapp»): el audio, la grabación, el número y el ✦ por mensaje

### El audio «que no se escucha» no era el audio: un porcentaje cíclico dejaba el reproductor en 0 px [whatsapp]

Síntoma (WhatsApp 1 y 8): en el editor del lienzo la burbuja de un audio salía vacía («no aparece nada») y
en /whatsapp un audio propio mostraba sólo «—» y «⋮», sin play ni duración. Es la familia de la #350.

El diagnóstico obvio —el MP3 de lamejs sin cabecera Xing que la tarjeta #350 apuntaba— era el equivocado.
Medido en orden: **datos** (`wa_mensajes` 89057 del ws1, el audio que Martín se mandó: `media_path` puesto,
MP3 válido, cabecera `fffb`, 30.528 bytes); **server** (la URL firmada contesta 206 `audio/mpeg`);
**navegador** (el mismo archivo en un `<audio controls>` de 240 px dura 2,544 s y suena). Con la burbuja
REAL renderizada y medida en Chrome: el `<audio>` medía **43 px** en /whatsapp y **0 px** en el editor.
La burbuja se ajusta a su contenido (`max-width: 78%` en un flex) y el reproductor tenía
`width: min(240px, 100%)`: ese 100% es cíclico, y para un elemento REEMPLAZADO el navegador lo resuelve
contra cero al calcular el ancho de la burbuja. En /whatsapp sólo la hora y las palomitas le daban 45 px;
los controles nativos de Chrome se esconden de a uno cuando no entran, y el play es el primero que se va.

La regla: **un reemplazado (`audio`, `video`, `img`) adentro de una caja que se ajusta a su contenido lleva
un ancho en px, nunca un % ni un `min(px, %)`**: el % se resuelve contra la caja que mide lo que mide él. El
reproductor pasó a ser propio (▶, avance y tiempo) con ancho en px; adentro de una caja de ancho conocido
(la tarjeta), `100%`. Y para diagnosticar «no se ve», se mide el ancho del elemento antes que el archivo.

**Vive en:** `app/whatsapp/_shared/AudioPlay.tsx` · `app/whatsapp/_shared/BurbujaHilo.tsx` (`ANCHO_AUDIO`) · `tests/whatsapp-sexta-tanda.test.ts`

### Un 78% de una caja que se ajusta a su hijo es un hueco del 22% [whatsapp]

Síntoma (WhatsApp 4): el lápiz y la papelera de la segunda burbuja quedaban lejos del mensaje. La burbuja
llevaba su `max-width: 78%` adentro de un envoltorio que se ajusta a ella: el envoltorio crecía hasta el
ancho del texto y la burbuja ocupaba el 78% de eso, alineada a la derecha. Con un texto largo, un cuarto de
la fila vacío entre los botones y el mensaje. **El tope de ancho lo pone la FILA** (el envoltorio con
`max-width: calc(100% - 70px)`), y la burbuja va al 100% de él (`BurbujaHilo` `maxAncho`). Medido en
Chrome después: 6 px entre la papelera y la burbuja.

**Vive en:** `app/automations/EditorMensajeWhatsApp.tsx` (`vista`) · `app/whatsapp/_shared/BurbujaHilo.tsx` (`maxAncho`)

### «Terminar» no es «mandar», y un MediaRecorder parado no se reanuda [whatsapp]

Pedido (WhatsApp 7): «al darle enviar, en cualquier lado, no se debe enviar, se debe "terminar"… y donde
aparece el punto rojo, el botón de reproducir… Y si apreto el botón de enviar otra vez, ahí sí se envía».
La sesión (`crearSesionVoz`) va sobre el grabador de siempre: cada ✓ es un `stop` cuyo blob NO se entrega,
se guarda como TRAMO; la ➤ une los tramos y recién ahí entrega. Tres cosas que no se ven en el código:

- **«Seguir grabando» después de terminar no existe en MediaRecorder**: parado, no se reanuda. Pausarlo en
  vez de pararlo dejaba el micrófono prendido mientras la persona escucha. Se graba otro tramo y se unen
  decodificando (Web Audio) en un WAV; quien manda lo pasa a MP3 igual que a un tramo solo (`blobToMp3`
  decodifica cualquier cosa que el navegador entienda), así el camino de envío no cambia.
- **`audioAlSoltar` (EmpresaInbox) ya no decide nada** y el archivo que la pasa no se tocó: la regla vive en
  el composer, que es por donde pasan los tres que graban («en todos lados»). Lo mismo para los grabadores
  del onboarding (`GrabadorAudioPaso`) y `PasoAudioControl`.
- **El composer de ChatHilo va por conversación** (`key`): una escucha a medias ya no viaja al chat de al
  lado. El borrador de AUDIO por chat que guardaba ChatHilo se fue con esto, a sabiendas.

Probado en Chrome con micrófono FALSO (`--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`
y `permissions: ['microphone']`): grabar → ✓ → la barra de escuchar (sin ➤ mientras graba) → 🎤 → ✓ → el
WAV unido dura 2,76 s y suena → ➤ entrega UNA vez.

**Vive en:** `app/whatsapp/_shared/VoiceRecorder.tsx` (`crearSesionVoz`, `useGrabacionVoz`, `BarraGrabacion`, `unirAudios`) · `app/whatsapp/_shared/ComposerWhatsApp.tsx` · `app/whatsapp/_shared/ChatHilo.tsx`

### La línea de UN mensaje: en el paso, `null` no es «la de por default» [whatsapp]

WhatsApp 2: el número es de cada tarjeta (`linea` del paso; el motor manda con `lineaDelPaso(paso) ??
sec.instance_name`). El selector de siempre guardaba la de por default como `null`, que en la SECUENCIA es
«la de por default» y en el PASO es «la de la automatización» —que puede ser otra—: elegir la principal en un
mensaje lo dejaba siguiendo a la automatización. Con `explicita` se guarda su nombre (`lineaElegida`).
Y `setSecuenciaPasos` la reconstruye con la regla de las variantes: con la clave manda lo que llega, sin la
clave (la API, /email, el generador) se conserva la del mismo paso por su id (`lineaAlGuardar`). Una línea
pedida que no es del negocio no está en `lineasEvo`: `canalDeLinea` frena el envío con su motivo, sin caer
a otra (AGENTS.md, «Un negocio tiene VARIAS líneas»).

**Vive en:** `lib/mensaje-partes.ts` (`lineaDelPaso`, `lineaAlGuardar`) · `lib/nutricion.ts` (la línea del envío y `setSecuenciaPasos`) · `app/automations/SalidaWhatsApp.tsx` (`lineaElegida`) · `app/automations/EditorMensajeWhatsApp.tsx` (`CabeceraWhatsApp`)

### La pausa entre los mensajes de una tarjeta duerme ADENTRO de la corrida: por eso es corta [whatsapp]

WhatsApp 11. Las partes salen una detrás de otra en la MISMA ejecución (`enviarPartesDelPaso`): una pausa es
el motor durmiendo. El cron (`maxDuration` 300) manda hasta 6 leads y además duerme hasta 150 s por las
esperas cortas; con pausas de minutos, seis leads se comen la función, y una función cortada a la mitad no
escribe cuántas partes salieron: el reintento le repite al lead lo que ya leyó. Topes: 10 s por pausa y 20 s
por tarjeta (`problemaDePartes` al guardar, `pausaAntesDe` en el motor); para más, la tarjeta DELAY, que
programa en vez de dormir. Dos trampas: el audio con pie de siempre (`formaGuardada`) colapsaba
[audio, texto] a los campos de antes y la pausa del texto no tenía dónde guardarse (con pausa, se guarda
como dos partes); y la pausa por default era 1,2 s y la pantalla decía «1 s» (pasó a 1 s redondo).

**Vive en:** `lib/mensaje-partes.ts` (`pausaAntesDe`, `pausasPosibles`, `PAUSA_TOTAL_MAX_S`, `formaGuardada`) · `lib/nutricion.ts` (`enviarPartesDelPaso`)

### El ✦ de MaKo: el contexto por el REGISTRO, y lo que el registro no deja ver desde la app [whatsapp]

WhatsApp 3. La ruta lee el negocio, los productos, el embudo, el curso y la voz con `ejecutarOperacion`
(canal `app`, alcance lectura): las mismas lecturas de MaKo por WhatsApp, con su gating. **`listar_cursos`
contesta 404 desde la app**: el área `curso` declara `canales: ['http']`. Se pide igual y se saltea; el día
que el área sume `'app'`, entra sola (está en «bloqueantes» del reparto). Dos más:

- **El detector de voseo marca «acá»** (`marcasDeVoseo`, lib/puestas-data.ts): un mensaje del modelo con
  «agenda acá» se descarta como voseo. Para el neutro es «aquí»; lo dice el prompt.
- **El «demasiado corto» de WhatsApp 6** (`GUION_PALABRAS.min` 25, lib/guion-audio.ts) no pasa por el ✦: el
  filtro del panel no tiene piso (un audio corto es un audio) y sí el techo. El botón «✦ guion» que lo
  disparaba salió de la grabación; el piso sigue vivo para «Escríbeme el guion» del onboarding.

- **`sinVoz` se decide con la lectura ESTRICTA** (revisión, 10/10/2026): con `sinVoz: true` el panel
  ofrece «Que la aprenda MaKo» y «Escribirla yo», y los dos terminan en `setVozGuia` sin comparar. Leído
  con `getVozGuia` (vía `getSetting`, que vuelve null un error de Supabase), una lectura caída ofrecía
  pisar una guía escrita a mano. Va `hayVozGuiaEstricto().catch(() => null)` y `sinVoz: hayVoz === false`.

**Vive en:** `lib/mako-redacta.ts` · `app/api/chat-agent/redactar/route.ts` · `app/automations/MakoRedacta.tsx`

### Revisión (10/10/2026): lo que se graba es del chat donde se grabó — el composer que MANDA lleva `key` [whatsapp]

Síntoma (hallazgo 7, el más grave de la parte «pantalla»): en /whatsapp, grabar en el chat de A, ✓, tocar
a B y ➤ mandaba la nota a A con la pantalla mostrando a B. La sesión guarda el `onSend` del render en que
se apretó el 🎤, y ése lee el `sel` de ESE render. ChatHilo ya llevaba `key={draftKey}`; EmpresaInbox no.

⚠️ **Lo que engañó: «el archivo que la pasa no se tocó» (la entrada de arriba) se leyó como inocuo**,
porque `audioAlSoltar` ya no hacía nada. Lo que la bandeja necesitaba no era perder esa prop sino la `key`:
el contrato del composer CAMBIÓ (antes no había un rato entre grabar y mandar; ahora el ✓ abre justo el
momento de mirar y cambiar de chat). Cuando un componente compartido cambia de contrato, quien lo monta
se revisa aunque «siga compilando». Va `key={selConv.chatJid}`; `audioAlSoltar` se borró del tipo.

**Vive en:** `app/whatsapp/EmpresaInbox.tsx` · `app/whatsapp/_shared/ComposerWhatsApp.tsx` · `app/whatsapp/_shared/VoiceRecorder.tsx` (`useGrabacionVoz`) · `tests/whatsapp-sexta-tanda.test.ts`

### Revisión (10/10/2026): la barra de grabar aparece ANTES de que el navegador entregue el micrófono [whatsapp]

Hallazgo 8. `crearSesionVoz.start` pone «grabando» y dibuja 🗑 ⏸ ✓ antes del `await` que pide el permiso.
Con el cartel del navegador puesto, `stop`/`soltar` no encontraban grabador y al dar Permitir el
MediaRecorder arrancaba igual: 🗑 dejaba el micrófono grabando sin barra; ✓ dejaba la barra en `uniendo`
con todo apagado. **La regla:** un pedido de un recurso del navegador que puede tardar (micrófono, cámara,
pantalla) lleva un número de intento y se cancela; y la UI que se dibuja antes sabe que el recurso no
llegó (`pidiendoMic`: ⏸ y ✓ apagados, 🗑 prendido porque es lo que cancela). Afecta a todo lo que monta
`useGrabacionVoz`. Se prueba con un `pedirMicrofono` que se contesta A MANO.

**Vive en:** `app/whatsapp/_shared/VoiceRecorder.tsx` (`crearGrabadorVoz`, `crearSesionVoz`, `BarraGrabacion`) · `tests/whatsapp-sexta-tanda.test.ts` (`armarMicPendiente`)

### Proceso: un arnés de roturas que restaura en `finally` no restaura si lo matan, y un test con un timer vivo no termina [proceso, tests]

La primera corrida de las roturas del hallazgo 8 se colgó: un recorder falso que quedó «grabando» (porque la
rotura lo dejaba arrancar) mantiene vivo el `setInterval` del grabador, y `node --test` espera para siempre.
Peor: la salida del arnés iba por un pipe y la línea de la rotura anterior no había llegado, así que parecía
colgada la R8a cuando en el disco estaba aplicada la R8b. Matar el arnés no corre su `finally`: el archivo
quedó roto y se restauró a mano, contando cuántas veces aparecía cada `buscar` y cada `reemplazo`.

- **El arnés corre cada test con `timeout` y `--test-force-exit`** (Node 24 lo tiene).
- **Un test que arranca algo con timer lo suelta en un `finally`**, pase o falle: la rotura que el test
  caza es justo la que deja el timer vivo.
- **Después de matar un arnés, la última línea impresa no dice qué rotura quedó en el disco**: se cuenta.

**Vive en:** `tests/whatsapp-sexta-tanda.test.ts` (los tests con `armarMicPendiente`)

### Proceso: el `sinComentarios` de los tests se come el JSX que sigue a un `accept="image/*"` [tests]

El helper que usan decenas de tests (`/\/\*[\s\S]*?\*\//g` después de sacar las líneas `//`) toma el `/*`
de un MIME con comodín ADENTRO DE UN STRING como el inicio de un comentario. Medido en
app/whatsapp/EmpresaInbox.tsx: el `acceptArchivo="image/*,…"` del composer se come 11 líneas (509
caracteres, hasta el próximo `*/` del archivo), con el `/>` del `<ComposerWhatsApp>` adentro. Un guard que
corte el bloque del composer con `sinComentarios` mira otro texto. Es distinto de lo de AGENTS.md (un `text/*`
en un comentario `//`): acá está en el código. Sobre un archivo con un `accept=` se sacan sólo las líneas
`//`, y la regex pide la FORMA del código para que la prosa no la dispare.

**Vive en:** `tests/whatsapp-sexta-tanda.test.ts` (el test de la `key` de /whatsapp) · `tests/pantalla-links-ws.test.ts`

### Proceso: un componente del lienzo se verifica sin `next dev`, con esbuild y Chrome [proceso]

`renderToStaticMarkup` sirve para medir anchos (el HTML real en Chrome headless) pero no ata eventos: un ▶
no suena. Para probar un gesto, esbuild (el del clon) arma el componente con React vivo en un `.js` suelto
(`alias` al worktree, `nodePaths` al `node_modules`) y Playwright lo abre por `file://` con
`--allow-file-access-from-files`. Necesita un `banner` con `var process = { env: {...} }`: `next/link`, que
entra por `app/_ui/Link`, lee `process.env` al importar y sin eso la página queda en blanco. Para grabar,
los flags del micrófono falso de arriba. Ni un POST a producción, y sin el `turbopack.root`.

### Dos guards de OTRAS áreas leían lo que esta parte tocó, y sólo los vio el `npm test` completo [proceso]

Los tests de los archivos tocados daban 124/0; la suite entera, 6400/2. Los dos rojos eran guards que leen
fuente de otra área:

- **Un prompt que CITA el voseo para prohibirlo cae en el guard del voseo** (`tests/puente-panel-copy.test.ts`
  barre `lib/` entero): «Nada de voseo («tenés», «querés»)» en `lib/mako-redacta.ts` lo frenó. Se nombran
  las formas neutras («tienes», «quieres»), nunca las prohibidas.
- **La línea por mensaje rompía un guard de Comunicación**: `tests/lineas-whatsapp.test.ts` exigía
  `const lineaSec = sec.instance_name;` literal en la rama del no oficial de `lib/nutricion.ts`. Se mudó a
  la forma nueva (`lineaDelPaso(paso) ?? sec.instance_name`), probado rompiéndolo (15/1).

La regla: antes de dar por cerrada una parte que toca `lib/nutricion.ts` o un prompt, `grep` de la ruta en
`tests/` (`leer('lib/nutricion.ts')`) dice qué otros guards la miran; correr sólo los propios no los ve.

**Vive en:** `tests/lineas-whatsapp.test.ts` · `tests/puente-panel-copy.test.ts` · `lib/mako-redacta.ts`

### Lo que quedó sin hacer (parte «whatsapp»)

- **Las Notificaciones con la tarjeta MAKO y el editor nuevo (MaKo en WhatsApp 3)**: su lienzo es
  `app/agencia/FlujoAviso.tsx` + `lib/flujo-aviso.ts` (la tarjeta «WHATSAPP» sale de `grafoDeAviso`, del
  CÓDIGO: no hay datos que convertir) y el editor viejo es `app/agencia/EditorMensaje.tsx`. Quedó listo
  `EditorMensajeGrupo` para montarlo; los cambios exactos están en «bloqueantes» del reparto.
- **El título de la TARJETA MAKO** en el lienzo sigue «MAKO» (`TITULO.mako`, `lib/flujo-conversacion.ts`); la
  cabecera del panel ya dice «MaKo en WhatsApp».
- ~~**El onboarding del Video Generator** sigue con el grabador que entrega al soltar y la tarea del alumno
  tiene su propio MediaRecorder~~: cerrado en la segunda pasada (parte «datos»), y desde la revisión del
  10/10 la muestra rechazada vuelve a la barra (ver «La sesión de voz suelta la grabación ANTES…»).
- **El disparador no le llega al ✦** (el `disparador` del lienzo a `EditorDeNodo`, `app/automations/FlujoLienzo.tsx`).
- **El clon de configuración se lleva la línea POR MENSAJE** (`secuenciaParaElDestino`, `lib/clonar-config.ts`):
  vacía `audio_id` y `media_id` y deja la `linea` del paso, que nombra un número del DUEÑO. En el destino
  `elegirLinea` la rechaza (no es del negocio) y ese mensaje no sale, sin caer a la de por default. Va
  `linea` en la misma lista, con su aviso («vuelve a la línea de la automatización»). Duplicar
  (`lib/secuencia-duplicar.ts`) es del mismo workspace y está bien que la conserve.
- **Verlo con clics en producción**: el ✦ con las keys reales de un cliente (sólo se probó la pantalla) y
  la grabación en Safari (el WAV unido se probó en Chrome).
## Sexta tanda (09/10/2026, parte «tiempo»): las esperas a la hora exacta, el horario de envío y el «{ }»

Pedido literal: DELAY 2 («No entiendo el texto "Sigue a la hora en punto"... Eso se hace en todo caso
en configuraciones, no aquí. No pongas esa limitación»), la respuesta del mismo día («Sin límite,
editable»), WhatsApp 10 y MaKo en WhatsApp 4 (el «{ }» en árbol, con muchos más datos, sin «Tu
negocio», igual en todos lados). Rama `wip-v6-tiempo`.

### Un tick cada minuto NO es la corrida de cada hora cada minuto: lo frenado sigue vencido [motor]

La salida obvia —pasar `/api/cron/nutricion` a `* * * * *`— corre el motor entero de cada negocio
cada minuto, todo el día, por una razón que no se ve en el código del cron: una fila frenada por el
anti-ban («msg <20h»), por el tope o por la lectura de la condición NO SE TOCA, sigue vencida, y un
motor que mira «todo lo vencido» la encuentra en cada vuelta. El tick nuevo
(`app/api/cron/nutricion-tick`, `1-59 * * * *`) mira sólo lo que venció en los últimos
`VENTANA_FRESCA_MIN` (10) minutos y, sin nada, termina con dos consultas para todos los negocios; lo
viejo lo sigue barriendo la corrida de cada hora (`0 * * * *`, las 24 h). Medido en prod el 09/10: 0
inscripciones activas, o sea que hoy el tick cuesta 2 consultas por minuto. Vercel Pro: 100 crons por
proyecto y cada minuto (docs del 15/07/2026); con éste son 38.

Lo que el corte no cubre: un hilo en paralelo frenado deja la fila con su hora vieja (la fila resume
el hilo que vence primero, lib/nutricion-hilos.ts), y otro hilo que vence después sale con la corrida
de la hora, no con el tick.

**Vive en:** `app/api/cron/nutricion-tick/route.ts` · `lib/espera-duracion.ts` (`VENTANA_FRESCA_MIN`, `desdeFresco`) · `lib/nutricion.ts` (`vencidasDesde`) · `lib/motor-tick.ts`

### Un tope «por corrida» es un tope por HORA disfrazado: al cambiar la cadencia se multiplica [motor]

`MAX_POR_CORRIDA` (6 WhatsApp) y `RESIDUO_POR_CORRIDA` (1) valían como ritmo anti-ban porque había 9
corridas por día. Con 60 por hora, una cohorte de 30 leads inscriptos juntos saldría en cinco minutos.
Lo cazó un test que ya existía (`tests/nutricion-residuo.test.ts` cruzaba el techo con vercel.json):
el cron nuevo no se dejaba contar. Ahora las corridas del cron comparten el cupo de la HORA DE RELOJ
(`enviosEnLaHora`, opción `cupoPorHora`) y el residuo arranca su contador en lo ya usado (1 por hora,
10 en 24 h, `residuoYaUsado`). ⚠️ De reloj y no 60 minutos móviles: con la ventana móvil, la corrida
de las 11:00 encontraba los 6 que mandó la de las 10:00:05 y no mandaba nada — y es la única que barre
lo viejo. La vía rápida de un evento sigue con su cupo de siempre (un lead).

**Vive en:** `lib/nutricion.ts` (`enviosEnLaHora`, `residuoYaUsado`, `procesarEnvios`) · `lib/nutricion-residuo.ts`

### Un mensaje del motor no se RECLAMA antes de salir: el compare-and-set no lo cubre [motor]

El diagnóstico obvio era «el motor ya tiene compare-and-set, dos corridas no pueden pisarse». Es cierto
para las condiciones, las esperas y las acciones (`modo: 'cas'`); el avance DESPUÉS de mandar un
mensaje es `modo: 'fila'` y el freno anti-ban se lee por lote: dos corridas que leen la misma fila
vencida a la vez mandan las dos. Con una corrida por hora casi no pasaba; con un tick por minuto, una
corrida que tarda más de 60 s (varios WhatsApp con su tipeo, una espera corta durmiendo) se pisa con la
siguiente. Va el TURNO del negocio (`conTurnoDelMotor`, compare-and-set sobre `mako.nutricion.turno`,
vence solo a los 6 min); la corrida de la hora lo espera hasta 60 s en total.

⚠️ **Y la vía rápida TAMBIÉN lo toma, sin esperarlo** (corrección del 10/10/2026, revisión de la
sexta tanda). La primera versión la dejó afuera diciendo «lo de antes, sin cambios», y era falso:
la carrera es entre DOS lectores de la misma fila, y uno de los dos pasó de 9 a 1.440 corridas por
día. La vía rápida (el primer paso de un evento, una inscripción a mano, lo que sigue a una espera
corta) manda un WhatsApp no oficial con el HTTP abierto 1 a 11 s por el tipeo, y recién después
escribe `nutricion_envios` y avanza la fila. Si el tick leía la cola en esa ventana, veía la fila
fresca en el mismo paso, tomaba el turno (nadie lo tenía) y la mandaba otra vez: el lead recibía el
mismo mensaje dos veces, una de cada pocas veces. Instagram y Messenger los frenaba la clave de
Zernio; el WhatsApp, nada. Ahora las tres pasan por `viaRapidaConTurno` (`lib/nutricion.ts`): con el
turno tomado no manda nada y la fila, vencida y fresca, la manda el tick al minuto siguiente. De paso
cubre a la vía rápida que se dispara ADENTRO de una corrida que ya tiene el turno: el motor no se
corre adentro de sí mismo. El guard (`tests/motor-tick.test.ts`) cuenta los llamadores de
`procesarEnvios(` en todo `lib/` y `app/`.

La regla que queda: **cambiar la CADENCIA de un proceso cambia la exposición de todo lo que corre al
lado, aunque ese código no se toque.** «Sin cambios» sobre un código que no cambió es una afirmación
sobre el código; sobre una carrera, es una afirmación sobre los DOS lados, y hay que medirla.

**Vive en:** `lib/motor-turno.ts` · `lib/motor-tick.ts` · `app/api/cron/nutricion/route.ts` (`conTurno`) · `lib/nutricion.ts` (`viaRapidaConTurno`)

### «No pude leer el horario» no es «sin horario» [motor]

El horario de envío (lib/horario-envio.ts, Configuraciones › Horario, apagado por defecto) se lee con
`getSettingEstricto`: con `getSetting`, una base caída devuelve `null`, y `null` ES «sin límite» — un
negocio que puso «de 9 a 18» recibía sus WhatsApps a las 3 de la mañana el día que Supabase tosía. Con
la lectura caída la corrida no manda (`saltado: 'horario-ilegible'`) y lo vencido queda para el minuto
siguiente. Y «sale al abrir» lo cumple el tick: en los primeros minutos del horario barre ENTERO lo
vencido de ese negocio (`acabaDeAbrir`), no sólo lo fresco.

**Vive en:** `lib/horario-envio.ts` · `lib/nutricion.ts` (`horarioDeEnvio`, `dentroDeVentana`) · `app/configuraciones/HorarioEnvioPanel.tsx`

### Revisión (10/10/2026): el server no puede rechazar lo que la pantalla ESCONDE — apagado se guarda siempre [motor, ui]

Hallazgo 11. Prender, sacar todos los días (o cerrar antes de abrir) y apagar: la pantalla valida sólo
prendido (`invalido` mira `activo`) y el «Guardar» quedaba habilitado, pero `horarioParaGuardar` sanea con
las reglas de lectura, que no miran `activo`, y contestaba «Elige al menos un día» con los días ocultos. Lo
guardado prendido seguía limitando. El arreglo obvio —validar en la pantalla sin mirar `activo`— pinta el
error rojo con los controles escondidos. Va en el server: con un `false` LITERAL y lo elegido que no
cierra, se guarda apagado con `HORARIO_SUGERIDO`; un pedido roto sigue siendo error. **La regla:** si la
pantalla esconde un campo en un estado, el server no rechaza ese estado por ese campo.

**Vive en:** `lib/horario-envio.ts` (`horarioParaGuardar`) · `app/configuraciones/HorarioEnvioPanel.tsx` · `tests/horario-envio.test.ts`

### El motor dejaba CRUDO todo token con dígitos: el «{ }» no podía ofrecer más de cinco datos [motor, ui]

`aplicarVariables` (lib/template-vars.ts) matcheaba `[a-z_]+`: `{{lead_fecha_r1}}` salía literal al
lead. Y el motor resolvía sólo nombre, nombre completo, apellido, empresa y negocio, así que el selector
de WhatsApp no podía ofrecer la etapa ni la reunión (AGENTS.md: «La previsualización de un editor no
puede resolver un token que el motor NO resuelve»). Ahora hay UN catálogo (lib/variables-aviso.ts, 75
datos en 10 ramas) con la FUENTE de cada dato y su DESTINO, y el motor lo resuelve con
`datosParaElLead` en sus tres envíos (una lectura por entidad que el texto nombra). Con una llave sola
la regex sigue sin dígitos: un `{1}` de un copy de Meta no es una variable. Las plantillas OFICIALES
(`bodyParams`) siguen con los cinco: sus parámetros los registra Meta.

La regla: **antes de ofrecer un token en un editor, pasalo por la función del MOTOR**, no por la de la
vista previa. Y `lead_nombre` (el completo, de los avisos) y `nombre` (el primero, del motor) eran el
mismo nombre con dos significados: quedan los dos resueltos y sólo `nombre` / `nombre_completo` en el
árbol.

**Vive en:** `lib/variables-aviso.ts` · `lib/variables-del-lead.ts` · `lib/variables-resolver.ts` (`datosParaElLead`) · `lib/template-vars.ts` · `app/_components/SelectorDatos.tsx`

### `v_funnel_productos` no está en `TENANT_TABLES`: `getTenantDb` no la acota [entorno]

Una vista que no está en el `Set` de lib/workspace.ts pasa sin filtro de workspace. Se acota sola sólo
si se filtra por un id que ya es de un negocio (el `funnel_id`, que es global): eso hace el resolvedor
del curso. Una lectura de esa vista sin ese filtro devuelve los productos de todos los clientes.

**Vive en:** `lib/variables-resolver.ts` (`valoresDeSuCurso`) · `lib/workspace.ts`

### El scratchpad es COMPARTIDO entre las partes de una tanda [proceso]

Las 8 partes corren en worktrees distintos pero con el MISMO scratchpad. El mensaje de commit de esta
parte (`msg1.txt`) lo pisó, minutos después de usarlo, el de la parte «canales». Salió bien porque se
commiteó antes; al revés, esta rama llevaba el mensaje de otra. Cada parte escribe en su subcarpeta
(`scratchpad/<parte>/`) y verifica `git log -1 --format=%B` después de commitear.
## Sexta tanda (09/10/2026, parte «probar»): el email de «Probar», el emisor de la prueba real y el email que llega

### «Probar en Email» vacío: no era la bandeja, era el CONTACTO del lead de la prueba [probar]

**Síntoma:** «está configurado el email y en PROBAR no salió nada» — «Sin correos» y «Fin» abajo, en
la «Felicitación al terminar clase» (#226 del ws1: CRON → «Tiene WhatsApp» → Sí: WhatsApp + TAG; Si no:
EMAIL).

⚠️ **El diagnóstico obvio era el equivocado**: la bandeja, la animación y el envío andaban. Medido con
el flujo leído de la base: `hechosDeLeadNuevo` le daba al lead de la prueba teléfono Y email SIEMPRE,
así que «Tiene WhatsApp» salía por el «Sí» y el email del «Si no» no llegaba nunca. Es la misma familia
que «Agendó» en la quinta tanda: decidir como el motor está bien; el DATO estaba mal.

**Regla:** de un lead que acaba de entrar, lo único que NO se sabe es si tiene teléfono y si tiene
email. Esos dos se ELIGEN para el canal que se prueba (`contactoParaProbar`: los dos → sólo el canal
probado → sólo el otro → ninguno; el primero con el que llega algo de ese canal), corriendo el MISMO
recorrido de una vez (`mensajesDelRecorrido`). Lo que sí se sabe (sin agenda, sin pago) no se elige:
un email detrás de «Agendó» sigue sin llegar, y eso es lo que pasa de verdad.

**Vive en:** `lib/simulador-grafo.ts` (`contactoParaProbar`, `mensajesDelRecorrido`, `hechosDeLeadNuevo`) ·
`app/automations/PanelProbar.tsx` (`arrancarRefs`, el `case 'condicion'`) · `tests/probar-email-canal.test.ts`

### El email que llega (Resend): lo que hay que saber antes de tocarlo [email-entrante]

Medido el 09/10/2026 (doc oficial y la cuenta, sólo lectura):

- **El webhook `email.received` trae sólo el SOBRE** (`from`, `to`, `cc`, `received_for`, `subject`,
  `message_id`, los adjuntos sin contenido). El cuerpo se pide aparte: `GET /emails/receiving/{id}`.
  Para disparar alcanza; para una condición sobre el texto, hace falta esa llamada.
- **La cuenta de MaKo tiene UN dominio (hola-mako.com) con `receiving: disabled`, y su único webhook
  (a /api/webhooks/resend) YA está suscripto a `email.received`** y lo tira al `default`. O sea: el día
  que alguien prenda la recepción, los mails llegan a esa ruta y se pierden sin un error.
- ⚠️ **«Opción A: una cuenta de Resend para todos» no es del todo cierto**: los ws 1, 4, 10 y 11 tienen
  su propia `RESEND_API_KEY`, y el único `resend_domain` cargado (ws11, marca-ejemplo.com) NO está en
  la cuenta de MaKo. Un cliente con cuenta propia recibe en SU cuenta: haría falta un webhook allá con su
  secreto.
- **Se rutea por `resend_domain` (se reclama con titularidad), NUNCA por `resend_from`**: el del ws1 es
  «MaKo <equipo@hola-mako.com>», el dominio de la PLATAFORMA. Un subdominio cuenta (el MX recomendado va
  en uno), el reclamo exacto gana, dos workspaces → de ninguno.
- **La fila de `email_entrantes` es la deduplicación Y el rastro**: `email_id` único corta los reintentos
  de Svix; lo descartado queda con su motivo. Un mail de ningún negocio también queda escrito
  (`workspace_id` null), nunca asignado «por default».

**Vive en:** `lib/email-entrante-reglas.ts` · `lib/email-entrante.ts` · `app/api/webhooks/email-entrante/route.ts` ·
`supabase/migrations/0245_email_entrantes.sql` · `tests/email-entrante.test.ts`

### El emisor de la prueba real es un PEDIDO; lo autoriza el envío [probar]

«Probar en WhatsApp / Email» pide «De» (las líneas o el remitente del negocio, con «Vincular nuevo») y
«Para». El emisor viaja del navegador, así que el server no lo cree: la línea la resuelve `elegirLinea`
en el envío (una ajena no manda y NO cae a la de por default) y el remitente, `remitenteDelPaso` (mismo
dominio que el del negocio). Uno que no sirve corta con su motivo ANTES del tope, para no gastar un
lugar. Y hoy hay UN remitente por negocio: «Vincular nuevo» del email REEMPLAZA y lo dice.

**Vive en:** `lib/simulador-grafo.ts` (`sanearEmisorPrueba`, `lineaDePrueba`) · `lib/prueba-paso.ts` ·
`app/automations/PanelProbar.tsx` (`MenuDestinos`, `VincularEmisor`, `CANALES_PROBAR`)

### Lo que quedó sin hacer (parte «probar»)

- **Que llegue un mail de verdad**: prender «Receiving» en el dominio en Resend + el MX del cliente, y
  sumar `email.received` a la ruta nueva (un webhook con `RESEND_INBOUND_WEBHOOK_SECRET`) o delegarlo
  desde /api/webhooks/resend (`case 'email.received'` → `recibirEmailEntrante`). Lo decide Martín.
- **Un email del lead no PAUSA la automatización que le está escribiendo** (una respuesta de WhatsApp
  sí). Es del motor: `lib/nutricion.ts` (`pausarPorRespuesta` del lado del webhook).
- `email_entrantes` tiene que entrar a `TABLAS_DE_INQUILINO` (`lib/tablas-de-inquilino.ts`) y el
  servicio `'email'` a `ServicioRuteo` (`lib/webhook-ruteo-huella.ts`) para anotar los fallos de ruteo
  en el super admin como los demás webhooks.
- `app/automations/SimuladorEmail.tsx` tiene CERO call sites (lo reemplazó la bandeja de `PanelProbar`).
  *(Borrado en la segunda pasada, parte «datos».)*
- Nada de esto se vio con clics: el desplegable «De / Para», «Vincular nuevo» en su modal y la bandeja
  con la #226.

## Sexta tanda, segunda pasada, parte «flujo» (09/10/2026): UNA puerta para las flechas, el borrador y «Si responde» como CONDITION

### Dos puertas para las flechas, y cada una tenía la mitad de las reglas [edicion]

**Síntoma:** el lienzo editaba flechas por DOS módulos: `conectar` / `desconectar` / `crearSuelta` /
`destinosConectables` de `lib/flujo-grafo.ts`, y los de `lib/flujo-edicion.ts`. El primero no miraba si
dos caminos se juntaban; el segundo sí, pero FILTRANDO EL TEXTO de `validarGrafo` (`errorPropio` buscaba
«cuelga de» y el id de la tarjeta en cada error) y con su propia copia de la regla
(`tarjetasDondeSeJuntan`), distinta de `cruces`, que es la que usa Publicar.

⚠️ **El filtro de texto es la parte cara**: el día que alguien reescribe la frase de un error de
`validarGrafo`, la regla del lienzo se apaga sin un rojo. Y la copia de la regla no la pasaban Crear con
IA, la API ni un flujo de antes: lo que el lienzo prohibía entraba por las otras puertas.

**Regla:** toda edición de flechas pasa por `lib/flujo-edicion.ts` (`paraEditar` fija la raíz con
`fijarRaiz` SIEMPRE, antes de tocar nada). Lo que decide es la DIFERENCIA de antes a después, por función
y no por texto: `cruces` (dos caminos que se juntan; con «Si responde», `MOTIVO.conRespuesta`),
`ciclosSinEspera` (`MOTIVO.circulo`) y `validarParaGuardar` (lo que rompe el dato). Un error que ya estaba
no frena la edición de al lado. El guard «UNA PUERTA» de `tests/flujo-edicion.test.ts` falla si
`lib/flujo-grafo.ts` vuelve a exportar una edición de flechas, o si `lib/flujo-edicion.ts` vuelve a leer
el texto de `validarGrafo`.

**Y el círculo:** la regla vieja rechazaba TODO círculo, y `abrirFlujo` (`quitarIrA`) convierte un «Ir a»
hacia atrás en una flecha que cierra uno: la automatización abría con un círculo que la misma pantalla no
dejaba volver a dibujar. Lo que el motor no puede correr es un círculo SIN espera; con espera, se dibuja.

**Vive en:** `lib/flujo-edicion.ts` · `lib/flujo-grafo.ts` (`fijarRaiz`, `cruces`, `ciclosSinEspera`,
`validarParaGuardar`) · `tests/flujo-edicion.test.ts`

### El borrador: «no lo pude leer» y «no hay» son dos respuestas [borrador]

Una automatización a medio armar (una suelta, una condición vacía) no se puede publicar, y hasta acá
tampoco se guardaba: se perdía al recargar. Ahora va a `nutricion_secuencias.pasos_borrador` (mig 0240)
por su propia acción (`action: 'borrador'`), con un respiro, y el motor no la lee nunca.

- **`secuencia.borrador` AUSENTE = no se pudo leer** (falta la columna o falló la consulta); `null` = no
  hay. Con ausente la pantalla abre lo publicado y NO guarda: tratarlo como «no hay» haría que el primer
  cambio pisara un borrador que la pantalla no vio. La ruta contesta `sinColumna` y el lienzo deja de
  mandar sin cartel.
- **Publicar descarta el borrador** y anota lo publicado como ya guardado (sin eso, el respiro lo volvía
  a mandar como borrador). Un borrador cuya base cambió no se abre (`borradorVigente`).
- **La lógica de un hook con relojes no se prueba leyendo el fuente**: vivía en refs y el único test
  posible era un regex. Pasó a `crearBorrador` (sin React) y se ejecuta con `mock.timers` — ocho
  roturas de comportamiento (respiro, `sinColumna`, rechazo, despachar al irse, descartar) que un guard
  de cableado no habría visto.

**Vive en:** `app/automations/useBorradorSecuencia.ts` · `app/automations/SecuenciaPerfil.tsx` ·
`app/api/chat-agent/secuencias/route.ts` · `lib/setting-secuencias.ts` (`getSettingData`) ·
`lib/secuencia-borrador.ts` · `tests/chatbot-v6b-flujo.test.ts`

### La base del borrador la pone la pestaña que LEYÓ, no el momento de guardar [borrador, revisión 10/10]

**Síntoma (revisión adversarial, reproducido con las funciones reales):** la pestaña A abre X; MaKo por
WhatsApp, otra pestaña o un hand-off (que le suma un caso a «Si responde») publican Y; A toca una tarjeta y
guarda X+cambio. El server anotaba como base lo publicado AL GUARDAR (Y), así que al recargar —en todas las
pestañas, también la que publicó Y— se abría el borrador viejo encima de Y, sin aviso, y Publicar revertía Y.
`borradorVigente` comparaba bien, sobre el dato equivocado.

**Regla:** un token de «sobre qué versión trabajo» lo pone QUIEN LEYÓ y viaja con cada escritura; el server
compara y, si no coincide, no escribe y lo dice (409 `desactualizado` → «Cambió lo publicado: recarga»).
Guardar con la base del cliente y dejar que `borradorVigente` lo descarte es peor: queda guardado y no se
abre nunca, o sea perdido sin aviso.

⚠️ **El arreglo obvio era el equivocado: calcular la huella en el navegador.** `firmaPublicado` es pura,
pero `setSecuenciaPasos` reconstruye cada paso campo por campo y le mergea variantes, partes y remitentes:
la firma de lo que el lienzo mandó a publicar no es la de lo que quedó en la fila (leído en el código, no
medido). Con la huella del navegador, cada borrador después de publicar se rechazaría como «otro publicó».
La calcula el server en el GET (`getSettingData`, sobre la MISMA columna cruda que lee
`guardarBorradorSecuencia`) y, después de publicar, la devuelve `descartar-borrador`.

**Lo que eso arrastra (`crearBorrador`):** publicar cierra una compuerta (lo que sale de su respiro espera
la base nueva, o el cartel acusaría a otro de lo que publicó esta pestaña) y las respuestas de antes del
PATCH no se escuchan. «Descartar» y «Volver a lo publicado» NO adoptan la base que contesta el server (no
publicaron nada), y el borrado sale DETRÁS de lo que ya salió: al revés, un guardado lento lo resucitaba.

**Y «Descartar cambios» guardaba lo descartado:** la pregunta vive en SimuladorWhatsApp, cambiar de
automatización desmonta el lienzo, y el desmonte despacha lo que esperaba su respiro. Va por una ref que
llena SecuenciaPerfil (`descartarBorrador`) y la tab llama ANTES de cambiar. Al irse se relee la lista
(`cerrar` → `onSalir`) cuando el server quedó distinto: la lista se lee al entrar, y volver a la misma
automatización en la visita abría lo de la entrada. ⚠️ Releerla en el acto, como pedía el verificador,
compite con el borrado en vuelo: el GET puede ver el borrador todavía. Va después de que el borrado volvió.

⚠️ **Un test de «descartar no guarda lo pendiente» que llama `yaGuardado` antes del desmonte da verde con
el bug puesto** (`yaGuardado` suelta lo pendiente por su cuenta): roturas M8 y M9 en 22 / 0 hasta partirlo.

**Vive en:** `lib/secuencia-borrador.ts` · `app/automations/useBorradorSecuencia.ts` ·
`app/automations/SecuenciaPerfil.tsx` · `app/api/chat-agent/secuencias/route.ts` ·
`lib/setting-secuencias.ts` · `tests/secuencia-borrador.test.ts` · `tests/chatbot-v6b-flujo.test.ts`

**Sin hacer:** el enchufe en `app/automations/SimuladorWhatsApp.tsx` (`descartarBorrador.current?.()` en
`descartar()`, antes de cambiar) y `base?: string` en `SecuenciaDto` (`app/automations/ChatAgentApp.tsx`;
hoy SecuenciaPerfil lo lee con `SecuenciaConBase`). Quedan dos ventanas de milisegundos: otro que publica
entre el PATCH y la respuesta de `descartar-borrador` (la pestaña tomaría su base), y un guardado que espera
la compuerta cuando se cierra la pestaña.

### «Si responde» se DIBUJA como la CONDITION que escucha; el dato sigue siendo `respuesta` [respuesta]

Punto 12: «Reply ya te dije que tiene que estar dentro de CONDITION». Se cambió el DIBUJO, no el nodo:
`nodo: 'respuesta'` lo leen el motor, «Probar» y la API, y renombrarlo era una migración de datos sin
ganancia. La tarjeta se titula CONDITION, una fila por caso (`textoCasoRespuesta`) y la última «Si no»;
el CRON pierde su fila «Si responde» y su flecha; el ＋ ya no la ofrece. Se crea eligiendo «Su respuesta
trata de» en una CONDITION vacía (`condicionARespuesta`, desde `EditorDeNodo`), una por automatización.

⚠️ **Sin flecha de entrada, el layout la ponía donde cayera en el array**: se crea al final, así que
una suelta creada antes quedaba entre el CRON y ella. Va PRIMERA entre lo que no cuelga del CRON
(`libres` en `grafoDeSecuencia`), y no se marca suelta.

**Vive en:** `lib/flujo-conversacion.ts` (`grafoDeSecuencia`, `tituloDeTarjeta`) · `app/automations/FlujoLienzo.tsx`
(`case 'condicion'`) · `lib/flujo-grafo.ts` (`condicionARespuesta`)

### El aviso de las 24 h es una aproximación, y lo dice [ventana-meta]

Un DELAY de más de 24 h justo antes de Instagram o Messenger marca la tarjeta «Tras 24 h no sale»: Meta
deja escribir sólo dentro de las 24 h del último mensaje DEL LEAD (`VENTANA_META_MS`) y el motor cierra
el paso sin mandar. `esperaAntesDe` suma las esperas pegadas (dos seguidas son una), toma el padre que
más espera y no cuenta «antes de la reunión» (depende de la fecha).

⚠️ **Lo que mide no es la ventana**: mide la espera de ANTES de la tarjeta. Un DM tras 2 h de espera
también cae fuera si el lead escribió hace tres días; eso sólo lo sabe el motor al mandar. El aviso caza
el caso que se puede ver dibujando, nada más.

**Vive en:** `lib/flujo-conversacion.ts` (`esperaAntesDe`, `AVISO_VENTANA_META`) · `lib/canal-social.ts`

### Lo demás, medido

- **`ALTO_EDITOR_CONTROL`** sale de medir los paneles, no de un número a ojo: el CRON con el Recurrente
  (seis filas de 36 + 5 huecos de 8, «＋ Nuevo CRON», el pie y la cabecera de 62) pide ~460; la etiqueta
  en columna, ~200. `lib/lienzo-grafo.ts` · `tests/lienzo-muelles.test.ts`
- **La tarjeta MAKO ofrece los datos del EQUIPO con lead** (`datosOfrecidos({ destino: 'equipo', conLead:
  true })`), pero PLANOS con el grupo de prefijo: montar el árbol (`SelectorDatos`) dentro de su panel
  dibujaba un segundo «{ }» al lado del de `EditorMensajeGrupo`, que no es de esta parte.
  `app/automations/FlujoLienzo.tsx` (`GRUPOS_MAKO`, `DATOS_MAKO`)
- **Quitar dos tests de un archivo deja viejos los números de sus roturas**: la cabecera de
  `tests/flujo-bucle-paralelos.test.ts` decía «4 / 2» y «2 / 4» sobre seis tests que ya eran cuatro. Al
  borrar tests, se re-miden las roturas que quedan.

### Lo que quedó sin hacer (parte «flujo»)

- **Nada se vio con clics**: el borrador al recargar, la condición que pasa a escuchar, las filas del
  CRON abriendo cada una su CRON, el aviso de las 24 h, la papelera roja en el panel y en las condiciones.
- **El árbol de datos en la tarjeta MAKO**: `EditorMensajeGrupo` (app/automations/EditorMensajeWhatsApp.tsx)
  tiene que aceptar `grupos?: GrupoDatos[]` y dibujar `ArbolDeDatos` en su «{ }»; después `EditorMako`
  le pasa `grupos={GRUPOS_MAKO}` y `DATOS_MAKO` se borra.
- **`IconoBorrar` de app/automations/IconosDisparador.tsx** quedó sin call site (todos usan el de
  app/_ui/BotonBorrar.tsx): se borra.
- **`PasoConLinea`** (app/automations/EditorMensajeWhatsApp.tsx) sobra desde que `PasoSecuenciaDto` trae `linea`.
- **La mig 0240 sin aplicar no rompe nada** (el GET no trae el borrador y el lienzo no guarda), pero sin
  ella el punto 7 no existe: va antes o junto con el deploy. `supabase/migrations/0240_secuencia_borrador.sql`
- **Sin ícono a propósito**: los días, meses, ordinales y zonas de `EditorRecurrente`, el operador ≥/≤ de
  la condición y las líneas de WhatsApp (son del negocio, con su punto de color). Si Martín los quiere,
  es una fila por desplegable.
- `repartenEnBucle` sigue exportada sólo para sus tests y `admiteParalelo`. `lib/flujo-grafo.ts`
## Sexta tanda, segunda pasada, parte «motor» (09/10/2026): los enchufes del motor, los webhooks y la API

Las ocho partes dejaron salidas con cero call sites; esta pasada las enchufó (rama `wip-v6b-motor`).
De las listas «sin hacer» de arriba quedaron CERRADOS: la pausa por una respuesta de Instagram o
Messenger, el email que llega por el webhook de siempre de Resend, `email_entrantes` en
`TABLAS_DE_INQUILINO` y `'email'` en `ServicioRuteo`, el Recurrente al grupo con los canales apagados,
una operación de la API para cambiar los CRON (`cambiar_crons_secuencia`), los seis tipos en
`TRIGGERS`, la tarjeta MAKO con el catálogo entero del «{ }», «Probar» con los datos nuevos y los
textos de la API con «de 9 a 21». Lo que sigue es lo que ahorra tiempo después.

### Sacar un cast de «INTEGRACIÓN» no integra: el webhook y el CRON hablaban dos idiomas [canales, motor]

El diagnóstico obvio del bloqueante era «falta el evento en `EventoNutricion`; cuando esté, se saca el
cast». Se sacó, compiló perfecto, y un CRON «El usuario envía un mensaje» no iba a arrancar NUNCA: el
lector del webhook (`eventoSocialDe`, parte «canales») dice `mensaje`, `comentario_vivo`, `referencia`,
y el CRON (`EVENTOS_INSTAGRAM` / `EVENTOS_MESSENGER`, parte «disparadores») guarda `dm`, `en_vivo`,
`ref`. `disparaPorEvento` compara exacto. 3 de los 11 eventos que llegan no coincidían, y la tienda de
Facebook se ofrecía encendida en el CRON con Zernio sin avisarla.

**La regla:** cuando un productor y un consumidor se escriben en paralelo, el cast que los une esconde
también los VALORES, no sólo el tipo. Al sacarlo, un test que CRUCE las dos tablas en las dos
direcciones (todo lo que llega cae en algo del CRON; todo lo que el CRON ofrece encendido llega). La
traducción vive en UN lugar (`subtipoDelEvento`).

**Vive en:** `lib/disparadores.ts` (`subtipoDelEvento`, `EVENTOS_MESSENGER`) · `lib/zernio-entrante.ts` · `tests/disparadores-canal-social.test.ts`

### «¿Hay quién escuche?» preguntaba otra cosa que «¿a quién inscribo?»: un lead por cada DM [canales]

`hayQuienEscuche` decide si se CREA un lead para alguien que escribió por Instagram, y preguntaba
`trigger_tipo.includes(canal)`: el PRIMER CRON y cualquier evento del canal. Con un CRON «comenta tu
publicación», cada persona que mandaba un DM quedaba como lead del CRM, y un segundo CRON de Instagram
no contaba. Ahora es la MISMA pregunta que al inscribir (`escuchaElEvento`: `disparaPorEvento` sobre
`vistasPorDisparador`). Dos funciones que contestan «¿esto arranca algo?» con dos criterios terminan
creando leads que nada inscribe.

**Vive en:** `lib/disparadores.ts` (`escuchaElEvento`) · `lib/zernio-entrante.ts` (`hayQuienEscuche`)

### Una respuesta por Instagram pausa SIN contestar, y la pausa va ANTES del disparo [motor]

Llamar a `pausarPorRespuesta` desde el webhook de Zernio, tal cual, le contestaba por WhatsApp a quien
escribió por Instagram (el destrabe, el asistido y la charla contestan). Con `origen: canal` corta
después de pausar lo activo y lo terminado, y antes de todo lo que contesta. Y el orden en el `after`
importa: el mismo DM puede arrancar una automatización de «Te envía un mensaje», así que pausar DESPUÉS
del disparo pausaba la que ese mensaje acababa de arrancar. El negocio ve la respuesta en su Instagram
(MaKo no tiene bandeja de Instagram desde el 06/10).

**Vive en:** `lib/nutricion.ts` (`pausarPorRespuesta`, `soloPausa`) · `app/api/webhooks/zernio/route.ts` · `lib/zernio-entrante.ts` (`pausarRespuestaSocial`)

### Con los canales apagados, el Recurrente al grupo NO puede ser «correr el barrido» [motor]

El bloqueante pedía llamar `comprometerInscripciones()` cuando alguna automatización tuviera un
Recurrente al grupo. Hecho así, un negocio con los dos canales apagados (modo 'off') pasaba a inscribir
a TODAS sus cohortes, y el día que prendiera un canal le salían semanas de mensajes juntos. Va
`soloGrupo`: reclama la ocurrencia y le manda al grupo (que sale por la línea de MaKo, no por la del
negocio) sin inscribir a nadie. Un Recurrente mixto (cohorte + grupo) pierde esa ocurrencia para la
cohorte, que es lo que ya pasaba con los canales apagados.

**Vive en:** `lib/nutricion.ts` (`comprometerInscripciones({ soloGrupo })`) · `app/api/cron/nutricion/route.ts` · `lib/disparadores.ts` (`tieneRecurrenteAlGrupo`)

### Nombrar un disparador no es poder elegirlo por cualquier puerta [motor]

Sumar los seis tipos a `TRIGGERS` (para que la API no diga el slug crudo) los ofrece también en el
selector de /email y en la API de email, que escriben SÓLO `trigger_tipo`: un «instagram» sin su evento,
un «email_recibido» sin subtipo o un «grupo_mako» sin horario quedaban como una automatización que no
arranca nunca. `SOLO_DESDE_EL_CRON` los rechaza en esas puertas; las dos de etiqueta («Se agrega / se
elimina») sí pasan (su «Ignorar» es opcional). ⚠️ Queda abierta la de `setTriggerSecuencia`
(lib/setting-secuencias.ts, de otra parte): ver «sin hacer».

**Vive en:** `lib/disparadores.ts` (`SOLO_DESDE_EL_CRON`) · `lib/email-marketing.ts` · `lib/api-mako/areas/email.run.ts`

### Un campo que pasa de UNO a una LISTA: los lectores no fallan, miran la primera [etiquetas]

La tarjeta TAG guarda la primera en `etiquetaId` y todas en `etiquetaIds`. Un `grep` de `etiquetaId`
dio cinco lectores que miraban sólo la primera, cada uno con su síntoma mudo: el ejecutor corría UNA
(el validador del registro tira lo no declarado), archivar la 2.ª contaba «nada la usa», la copia a un
workspace de prueba llevaba la 2.ª con el id del DUEÑO, y Crear con IA guardaba NEGATIVO el ref de una
etiqueta nueva en la 2.ª posición. ⚠️ Medido: «Editar con IA» NO perdía las demás (sólo agrega,
`deIAEdicion`), pero su contexto (`aIA`) decía una sola. Y `etiquetasDelPaso` no sirve en flujo-ia: tira
los ids negativos, que ahí son etiquetas por crear (`etiquetasDeAccion`).

**Vive en:** `lib/api-mako/flujo.ts` (`ejecutarDesdeFlujo`) · `lib/etiquetas-reglas.ts` (`usoEnPasos`, `traducirEtiquetasEnSecuencia`) · `lib/flujo-ia.ts` · `tests/etiquetas-varias-lectores.test.ts`

### La copia a un workspace de prueba llevaba la línea por mensaje y los archivos de las partes [motor]

`secuenciaParaElDestino` vaciaba el audio y el archivo del PASO, no los de sus partes (cuarta tanda), y
no conocía la `linea` por mensaje (sexta): en el destino `elegirLinea` no encuentra la línea del dueño y
ese mensaje no sale, sin caer a la de por default. Ahora es una función pura con test
(`pasosParaElDestino`). ⚠️ `lib/datos-mau.ts` copia secuencias por otro camino y no la usa.

**Vive en:** `lib/clonar-pasos.ts` · `lib/clonar-config.ts`

### Los datos «{ }»: lo que se ofrece se resuelve, en la tarjeta MAKO y en «Probar» [motor]

La tarjeta MAKO EN WHATSAPP resolvía los cinco del motor y la parte «flujo» le monta el árbol del equipo:
ahora `conVariables` con destino 'equipo' y el workspace del ctx, con lo del motor como `datos` (gana) y
`aplicarVariables` después para lo de antes con UNA llave (`{nombre}`), que el catálogo no lee.
«Probar» y la prueba real resuelven con los ejemplos del catálogo (`datosDeEjemplo`), salvo el nombre
del negocio: es el real o queda crudo, como en el motor (uno inventado se leería como el del cliente).

**Vive en:** `lib/api-mako/areas/chatbot.run.ts` (`textoDelAviso`) · `lib/simulador-grafo.ts` (`datosDeEjemplo`) · `lib/setting-secuencias.ts` (`probarSecuencia`)

### La API: cambiar los CRON, y las dos lecturas del curso por la app [api]

`cambiar_crons_secuencia` es de PANTALLA y SIN http (cambia a quién le escribe; exponerlo a un token es
la decisión del snapshot), y se guarda por la MISMA puerta que la pantalla. `prepararDisparadores`
chequea contra el negocio sin escribir: un rechazo al confirmar consumiría la pendiente. `ignorar` y
`cron.dias` viajan como TEXTOS (el validador no tiene listas de números) y el saneador del CRON ya los
convierte. ⚠️ En un `preparar()` no va `tzDeWorkspace`: si la zona falta, la averigua y la ESCRIBE.
`listar_cursos` y `ver_curso` salen también por la app (el ✦ las pedía y contestaban 404): son la
estructura del curso, sin una sola persona.

**Vive en:** `lib/api-mako/areas/chatbot.def.ts` / `.run.ts` · `lib/disparadores-guardar.ts` · `lib/api-mako/areas/curso.def.ts` · `tests/api-mako-crons.test.ts`

### Medido en producción (sólo lectura, 09/10/2026) [entorno]

Sin aplicar: `email_entrantes` (0245), `zernio_eventos` (0242), `nutricion_secuencias.disparadores`
(0241) y `.pasos_borrador` (0240). `ig_conversaciones` e `ig_mensajes` SÍ existen (no medí si con las
columnas nuevas). Hasta aplicar la 0242 el webhook de Zernio contesta 500 en cada evento (el reclamo del
dedup no tiene tabla): fail-closed, pero ⚠️ con el webhook ya registrado (lo registra el editor al pedir
la cuenta, `asegurarWebhook`) Zernio apaga el endpoint a los 3 días sin una entrega buena. La 0242 va
ANTES del deploy. La tabla que falta contesta `PGRST205`, no `42P01`: ver
[hallazgos-infra.md](hallazgos-infra.md) → «Borrar un inquilino entero».

### Lo que quedó sin hacer (parte «motor»)

- **`setTriggerSecuencia` acepta los seis por `TRIGGERS`**: hay que rechazar `SOLO_DESDE_EL_CRON` ahí
  también (`lib/setting-secuencias.ts`, otra parte). Hoy lo llaman /email (cerrado en su puerta), la API
  de email (cerrada) y la ruta del CRON de antes (`action: 'trigger'`).
- **Un email del lead no pausa** lo que le escriben (una respuesta de WhatsApp sí). Es una decisión de
  producto: con `origen: 'email'` sería una línea en `recibirEmailEntrante`. `lib/email-entrante.ts`
- **`cambiar_crons_secuencia` por HTTP**: es una decisión (el snapshot y su fila en `lib/api-mako/rest.ts`).
- **La copia de `lib/datos-mau.ts`** no usa `pasosParaElDestino`.
- **El clon no copia `disparadores`** (la lista de CRON): una automatización con varios llega con uno, y
  un primer CRON de Instagram llega sin su evento. `lib/clonar-config.ts` (`TABLAS`, la fila de
  `nutricion_secuencias`).
- **`noExiste` de `lib/reset-workspace.ts` mira sólo `42P01`** (ver infra).
- **Verlo con clics y con un evento real**: nada de esto recibió un webhook de verdad.
## Sexta tanda, segunda pasada, parte «datos» (09/10/2026, noche): el «{ }» montado, MaKo en WhatsApp en Notificaciones, los grabadores

Rama `wip-v6b-datos`. Enchufó lo que la primera pasada dejó escrito y sin llamar: el árbol del «{ }»
en los editores, la tarjeta y el editor de MaKo en Configuraciones › Notificaciones, la sesión de voz en
los dos grabadores que faltaban, el modal de «Vincular nuevo» de «Probar».

### «El mismo «{ }» en todos lados» NO es el mismo árbol en todos lados: lo que se ofrece lo decide el CANAL [ui, motor]

El bloqueante decía «`ArbolDeDatos` con `datosOfrecidos({ destino: 'lead', conLead: true })` en el
editor de WhatsApp», y montarlo así en los tres editores era el diagnóstico obvio. Medido contra el motor
(lib/nutricion.ts), el catálogo entero sólo se resuelve por DOS caminos: el WhatsApp no oficial y el
email, que pasan el texto por `datosParaElLead`. La vía OFICIAL manda la plantilla de Meta con
`bodyParams: valoresVariablesLead(...)` (cuatro datos), e Instagram / Messenger llaman a
`enviarPasoSocial` con `vars: valoresVariablesLead(...)` (los mismos cuatro). Con el árbol entero ahí,
`{{lead_fecha_r1}}` le llegaba CRUDO al lead.

**Regla:** el «{ }» de un mensaje al lead sale de `datosDelLead(todos)`
(app/automations/EditorMensajeWhatsApp.tsx): el árbol de la casa recortado a lo que el motor resuelve POR ESE
CANAL. Antes de ofrecerle el árbol entero a un canal nuevo, se busca en lib/nutricion.ts con qué `vars`
sale su envío. Y el test que fija «el editor ofrece sólo lo que el motor resuelve» lee al MOTOR, no al
editor: el de tests/editor-email-gmail exigía importar de lib/template-vars.ts «porque el envío de
nutrición no resuelve las de /mensajes», una premisa que la parte «tiempo» volvió falsa el mismo día —
ahora cruza el editor con el `datosParaElLead` del envío del email.

**Vive en:** `app/automations/EditorMensajeWhatsApp.tsx` (`datosDelLead`, `arbolDeVariables`) · `app/automations/EditorEmailGmail.tsx` · `app/automations/EditorMensajeSocial.tsx` · `lib/nutricion.ts` (los `vars` de cada envío)

### Cambiarle el `tipo` a un nodo para que herede la identidad de otro: grepear quién decide por `tipo` [lienzo]

La tarjeta del mensaje al grupo de Notificaciones tenía que verse como «MaKo en WhatsApp» sin tocar
`Lienzo.tsx`. `identidadDeTarjeta` pinta por `canal` y por `tipo`, así que alcanza con `tipo: 'mako'` (y
`ICONO_MAKO`, el logo) en `grafoDeAviso`. Lo que cuesta no está en el lienzo: FlujoAviso decidía el cuerpo
de la tarjeta con `n.tipo === 'mensaje' && n.id === 'mensaje'` y los tests contaban `tipo === 'mensaje'`;
los dos pasaron a preguntar por el ID, que no cambia porque las posiciones guardadas se podan por id.
⚠️ Y `editorDeTarjeta` (lib/lienzo-grafo.ts) mide el panel por `tipo`: un `mako` tiene 280 de alto. Hoy
/mensajes no pasa `muelles` y no le afecta; el día que los pase, el editor del aviso queda en 280.

**Vive en:** `lib/flujo-aviso.ts` (`grafoDeAviso`, `TITULO_MAKO_EN_WHATSAPP`) · `app/agencia/FlujoAviso.tsx` · `app/_components/Lienzo.tsx` (`identidadDeTarjeta`, no se tocó)

### La sesión de voz suelta la grabación ANTES de entregarla: quien sube y puede fallar la tiene que devolver [whatsapp, curso]

`crearSesionVoz.enviar` vacía la revisión y vuelve a `quieta` antes de llamar a `onSend`, a propósito
(un doble clic no la manda dos veces). Para un consumidor cuya subida puede fallar —la tarea de audio del
alumno— eso es perder la grabación en el primer 5xx: antes, su grabador propio volvía a «grabado». Se
devuelve con `revisarExistente({ blob, secs })`. Y varios tramos se unen en un WAV (`unirAudios`): ~5,6 MB
por minuto, 57 MB con el tope de 10 minutos de una tarea; quien sube un archivo lo pasa a MP3 antes
(`blobToMp3`, ~1 MB por minuto). El composer de WhatsApp ya lo hacía; la tarea del alumno no tenía por qué
saberlo.

**Regla:** al montar `useGrabacionVoz` donde lo que se hace con el audio puede fallar, el fallo vuelve a
la barra de escuchar; y si se SUBE, el WAV no viaja.

⚠️ **La regla nombraba OnboardingVideoGen y sólo TareaAlumno la cumplía** (revisión, 10/10/2026, hallazgo
10). Ahí se perdía hasta 90 s leídos en voz alta, y el caso común no es una subida que falla sino el piso
de 20 s: con 15 s grabados la sesión ya se había vaciado y no quedaba ni el 🎤 para sumar el tramo. Y el
diagnóstico del revisor culpaba a ElevenLabs, que no está en este camino: la rama multipart de
/api/onboarding/voz sube a Storage (`subirMuestra`); ElevenLabs falla en `clonar`, sin grabación en juego.
`subirGrabacion` devuelve si sirvió y `GrabadorVoz` llama a `revisarExistente` con el blob de la sesión.
Siguen sin cumplirla `GrabadorAudioPaso.subir` y `EditorMensajeWhatsApp.usarAudio` (app/automations) y el
`enviarAudioBlob` de /whatsapp (una nota cuyo envío falla se pierde).

**Vive en:** `app/whatsapp/_shared/VoiceRecorder.tsx` (`crearSesionVoz`, `unirAudios`) · `app/compartido/curso/[token]/TareaAlumno.tsx` (`CampoGrabacionAudio`) · `app/video-generator/OnboardingVideoGen.tsx` (`GrabadorVoz`, `subirGrabacion`)

### Borrar un archivo sin llamadores pone en rojo tests/dev-areas, y `areas.ts` no es de ninguna parte [proceso]

app/agencia/EditorMensaje.tsx quedó con cero llamadores al pasar los avisos al editor de WhatsApp, y se
borró. tests/dev-areas.test.ts exige que cada ruta del `vive[]` de app/admin/dev/areas.ts exista, y
`app/agencia/EditorMensaje.tsx` está en el del área de configuraciones. Con el reparto por archivo,
`areas.ts` no es de ninguna parte: todo borrado de un archivo declarado ahí deja un rojo que sólo arregla
quien integra. Es la regla de AGENTS.md («al mover o renombrar un archivo, grepeá su ruta vieja en … 
app/admin/dev/areas.ts») vista desde el reparto: el bloqueante se escribe con la línea exacta.

**Vive en:** `app/admin/dev/areas.ts` (el `vive` de configuraciones) · `tests/dev-areas.test.ts`

### «El trailer PEGADO sin línea en blanco» es entre los dos trailers, no con el cuerpo [proceso]

El primer commit de esta parte llevó `Claude-Cuenta:` pegado al último párrafo del cuerpo, y
`git log -1 --format='%(trailers:key=Claude-Cuenta,valueonly)'` devolvió VACÍO: git sólo toma como
trailers el último párrafo si es TODO trailers. Lo correcto: una línea en blanco antes del bloque, y
`Claude-Cuenta:` y `Co-Authored-By:` pegados entre sí. Se verifica con ese comando, no leyendo el mensaje
(se ve perfecto). Se corrigió con un `--amend` sobre el commit propio.

### Lo que quedó sin hacer (parte «datos»)

- **El ✦ / la tarjeta MAKO del Chatbot sigue con la lista plana**: `EditorMako` (app/automations/FlujoLienzo.tsx)
  le pasa `variables={DATOS_MAKO}` a `EditorMensajeGrupo`; con `datos={datosOfrecidos({ destino: 'equipo',
  conLead: true })}` recibe el árbol, DESPUÉS de que `textoDelAviso` (lib/api-mako/areas/chatbot.run.ts)
  resuelva el catálogo. Es de la parte «flujo».
- **Instagram y Messenger ofrecen sólo los cuatro datos** hasta que `enviarPasoSocial` (lib/nutricion.ts)
  reciba `datosParaElLead`; ahí `EditorMensajeSocial` pasa a `datosDelLead(true)`.
- **`VARIABLES_NEGOCIO` (vacía) no se pudo borrar**: la importa lib/mako-redacta.ts (`variablesParaPrompt`).
- **`app/agencia/EditorMensaje.tsx` se borró**: falta sacarlo del `vive` de configuraciones en
  app/admin/dev/areas.ts (tests/dev-areas en rojo hasta entonces).
- **Sin llamadores**: `PasoAudioControl` (app/automations/PasoAudioControl.tsx; lo leen tests/guion-audio y
  tests/whatsapp-sexta-tanda) y el botón suelto `SelectorDatos` (app/_components/SelectorDatos.tsx).
- **El selector de acento del onboarding del Video Generator** (`Select` de app/_ui) no tiene íconos: son
  regiones, y `Select` no pasa `icono`.
- **Nada se vio con clics**: el árbol en los tres editores, la tarjeta y el editor de MaKo en
  Notificaciones (el alto del panel con el editor de WhatsApp adentro), la grabación nueva del Video
  Generator y la tarea de audio del alumno.
## Sexta tanda, segunda pasada, parte «barrido» (09/10/2026): el tacho y los íconos en toda la app

General 9 (el tacho rojo «en TODOS lados»), 10 (íconos en todos los desplegables) y 11 (el buscador),
fuera de /chatbot. Las reglas que valen para código nuevo quedaron en AGENTS.md («Borrar es UN tacho…»).

### El tacho se cambia en el SET, no en cada pantalla: `Icon name="trash"` arrastra a las de otras partes [ui]

La salida obvia era reemplazar cada `<Icon name="trash">` por `IconoBorrar`, y no alcanzaba: lo piden
también `IconBtn name="trash"` (/integraciones), `BotonLote icono="trash"` (Ads Manager, con un test que
exige ese texto) y archivos de otras partes (el lienzo, el chatbot). Lo que cerró los diez de una vez
fue que la entrada `trash` de `app/_components/icons.tsx` sea `TRAZOS_BORRAR` y que `Icon` la pinte
roja ÉL (`const borrar = name === 'trash'`). Lo mismo con los nombres propios que ya tenían su lugar:
`IconoTacho` del Plan delega en `IconoBorrar`, y `basura` del editor rico pasó a `borrar`.

**La regla:** cuando un set tiene un NOMBRE que significa una acción, el dibujo y el color se arreglan
en el set; los call sites con nombre siguen andando. Lo que queda prohibido es el trazo propio.

**Vive en:** `app/_components/icons.tsx` · `app/plan/board/piezas.tsx` · `tests/borrar-tacho-casa.test.ts`

### La firma de un tacho a mano: la tapa ARRANCA la cadena y el subpath siguiente sube a la manija [tests]

Para el guard hacía falta reconocer un tacho dibujado a mano sin reconocer cualquier ícono. «Una raya
de 10 a 19 y una `V` a y=2..5 en la misma cadena» dio CUATRO falsos positivos (dos íconos de alinear del
editor rico, la `nota` del set, el reloj de arena del flujo y un rectángulo de ServicioVisual). La que
caza los seis que había y ninguno de esos: la cadena EMPIEZA con la tapa (`"M x y h1N`) y el subpath que
sigue arranca subiendo a la manija (`M x y V2..5`). El test lleva las dos listas adentro y se prueba a sí
mismo.

**Vive en:** `tests/borrar-tacho-casa.test.ts`

### Cuándo una ✕ es un tacho: si la cosa deja de EXISTIR [ui]

No se puede barrer por texto (las ✕ que cierran son la mayoría). El criterio, el de Google Forms: la ✕
que BORRA algo que deja de existir (un guion, un producto, una nota, una pregunta de un formulario, un
campo, un borrador del historial) pasa al tacho; la que QUITA de una selección o de un vínculo (un chip,
un público elegido, un archivo todavía no subido, «desasociar», una opción de una lista que se tipea, una
cuota) se queda. Y un renglón `sutil` del Dropdown («Quitar deadline») sigue siendo sólo texto: lo pidió
así («debe ser un texto»).

### Un `<select>` adentro de un menú propio NO se puede pasar al Dropdown sin romperlo [ui]

El pedido decía «pasalos al de la casa si se puede sin cambiar comportamiento», y en los menús «⋯» del
curso (`MenuCurso.tsx`, `EditorConocimientos.tsx`) no se puede: el menú del Dropdown vive en un PORTAL
sobre el `body`, y el menú del curso se cierra con cualquier `mousedown` fuera de SU nodo
(`MenuUgc`, `afuera` en `app/_cursos/CursoUgc.tsx`). Elegir una opción cerraría el menú de atrás antes
de que la opción llegue. Para pasarlos, el menú de atrás tiene que reconocer el portal como suyo.

### Pasar un `<select>` al Dropdown: elegir el MISMO valor ahora dispara `onChange` [ui]

El nativo no avisa si se elige lo que ya estaba; el Dropdown sí. En el Quarter del Plan eso habría escrito
un cambio que no fue (historial y deshacer de algo que no cambió): va `if (v !== actual)`.

### Una aserción que lee el renglón exacto se rompe con el ícono, y está bien [tests]

`>Eliminar módulo</button>` (tests/curso-menu-estructura) y `label: 'Campañas de Meta' }` (tests/
campana-producto) fallaron apenas el renglón llevó su ícono. Se admite el ícono sin exigirlo
(`(?:<svg…</svg>)?`) y la aserción sigue cazando lo que cazaba: 9/1 y 34/1 rompiendo lo de antes.

### Proceso: «PEGADO sin línea en blanco» es entre los dos trailers, no contra el cuerpo [proceso]

El primer commit de esta parte puso `Claude-Cuenta:` pegado a la última viñeta del cuerpo. Git sólo lee
como trailers el ÚLTIMO PÁRRAFO si es todo de trailers: `%(trailers:key=Claude-Cuenta)` devolvió VACÍO.
Va una línea en blanco antes del bloque, y los dos trailers juntos. Se verifica con
`git log -1 --format='%(trailers:key=Claude-Cuenta,valueonly)'`, no leyendo el mensaje.

### Lo que quedó sin hacer (parte «barrido»)

- **Los tachos de archivos de otras partes** (la lista vive en `PENDIENTES` del test, que falla cuando
  una se arregla para que se saque): el 🗑 del panel del lienzo (`app/_components/Lienzo.tsx:1355`), el
  tacho propio de `app/automations/IconosDisparador.tsx:101`, `IconTrash` del composer
  (`app/whatsapp/_shared/composer-icons.tsx:26`, usado en `VoiceRecorder.tsx:477/496/523`,
  `app/automations/EditorMensajeWhatsApp.tsx:677` y `EditorMensajeSocial.tsx:297`) y el de la barra de lote
  del CRM (`app/crm/AccionesLoteLeads.tsx:147`).
- **Desplegables de archivos de otras partes, sin íconos:** `app/_components/CamposAccion.tsx:85/105/108/
  122/137/158`, `app/_components/etiquetas-cliente.tsx:251`, `app/agencia/FlujoAviso.tsx:863`,
  `app/agencia/EditorMensaje.tsx:427`, `app/crm/AccionesLoteLeads.tsx:310/320/332`,
  `app/video-generator/OnboardingVideoGen.tsx:1097` y los de `app/automations/**`.
- **Selects nativos que se quedan:** los del menú del curso (`app/customer-success/curso/MenuCurso.tsx:
  327/352/368`, `app/conocimientos/EditorConocimientos.tsx:245`, ver arriba), el rol de
  `app/customer-success/FichaCliente.tsx:870` (tres opciones) y los de `app/api-mako/*` (copian GitHub
  tal cual, decisión de Martín).
- **Sin ícono a propósito, y lo puede querer distinto:** la barra del editor rico («Párrafo / Título /
  Subtítulo», `app/_ui/EditorRico.tsx:1214`: el botón es de ancho fijo y el ícono del elegido se dibuja
  adentro), los públicos de Meta (`app/ads-manager/NuevaCampanaModal.tsx:1244`: Facebook e Instagram
  piden su logo, que el set no tiene), los disparadores del email (`lib/email-marketing.ts:299`, una
  situación por renglón) y los roles.
- No se vio con clics: ni el tacho rojo en cada pantalla, ni los menús con su ícono, ni el buscador del
  Quarter.

## Sexta tanda, parte «renombre» (09/10/2026): la tab pasa a llamarse Automations

General 1, textual: «Cambia el nombre de la tab "Chatbot" por "Automations", el nombre en la sidebar, la
ruta, todo.» La carpeta pasó con `git mv` de `app/chatbot` a `app/automations`, la ruta es
`/automations` y `/chatbot` quedó como redirect (`app/chatbot/page.tsx`, lo único de esa carpeta).

### «/chatbot» en el repo son TRES cosas, y un reemplazo de texto rompe dos [renombre]

593 líneas en 169 archivos nombraban la carpeta o la ruta, y no todas significan lo mismo:

- **La carpeta** (`app/chatbot/` en imports, en los `readFileSync` de ~60 tests, en los «Vive en:»):
  se cambia entera. ⚠️ Pero `./chatbot/bitacora` en `app/admin/dev/registros.ts` es el REGISTRO del área
  (`app/admin/dev/chatbot/`), no la carpeta: un import relativo se cambia sólo si RESUELVE a `app/chatbot`.
- **La ruta de la pantalla** (`'/chatbot'`, `` `/chatbot?sec=` ``, `linkApp('/chatbot', ws)`): se cambia.
  ⚠️ Pero `'/chatbot/secuencias'` y las otras 27 de `lib/api-mako/rest.ts` son las rutas REST de
  `/api/v1` del ÁREA `chatbot` de la API de MaKo: renombrarlas cambia la API pública y su snapshot. El
  patrón que separa las dos: `/chatbot` que no siga con `/` más ruta.
- **El nombre de algo que no es la tab**: la división «Chatbot» de la lista (`ROTULO_CHATBOT`, decisión
  de Martín del mismo día), el interruptor «Chatbot: ON/OFF» de la tab WhatsApp, `chatbot` como concepto
  en la prosa. Se queda.

**Vive en:** `lib/ruta-automations.ts` · `app/chatbot/page.tsx` · `tests/ruta-automations.test.ts`

### Los alias viejos redirigían SIN la query, y el link de un aviso abría otra automatización [renombre]

`/setting`, `/chat-bot`, `/chat-agent` e `/instagram` hacían `redirect(await rutaConWs('/chatbot'))`
pelado: el `?ws=` sobrevivía (lo pega `rutaConWs` desde el header) y el resto no. Los avisos de WhatsApp
ya mandados llevan `/chatbot?sec=<id>` (el hand-off, `lib/chat-agent-handoff.ts`) y `?aviso=<id>` (el link
de Notificaciones), así que un redirect así abre la tab en la PRIMERA automatización, sin decir nada.
Ahora todos pasan por `destinoConQuery` (la query entera, valores repetidos incluidos) y van DIRECTO a
`/automations`; `/instagram` no traduce nada a propósito (su `?conectado=1` era de un OAuth muerto).

### La lista de alias no puede nombrar `/instagram`: la prohíbe otro guard [tests]

`tests/sin-instagram.test.ts` falla con la CADENA `'/instagram'` en cualquier archivo de `app/` y `lib/`.
Por eso `RUTAS_VIEJAS_AUTOMATIONS` tiene sólo `/chatbot`, `/chat-bot` y `/chat-agent` (las que el nav ya
marcaba), y `/setting` sigue con su título en `lib/titulo-tab.ts`. Una lista «completa» de alias habría
roto un guard ajeno por un string correcto.

### Cambiar `AREA_INFO` o una `descripcion` de la API regenera `docs/api-mako.md` [api-mako]

La tab y la ruta del área (`lib/api-mako/tipos.ts`) y cuatro descripciones que decían «/chatbot» salen en
la referencia generada: sin `node --import tsx scripts/generar-api-doc.mjs`, falla
`tests/api-mako-registro.test.ts` («la referencia generada está al día»). El snapshot de HTTP no cambia
(sólo lista ids). El `titulo` del área («Chatbot y secuencias») se quedó: es el nombre del permiso que
ven los tokens detallados.

### Lo que NO se renombró, a propósito: son CLAVES o historia [renombre]

- La key `setting` del nav (capas, roles por workspace, `onboarding.tab.setting`, la key del catálogo de
  onboarding y las de sus pasos) y el ícono `chatbot`. Cambiar una reabre el onboarding o apaga la tab.
- El área `chatbot` de la API de MaKo: ids de operaciones, permisos de los tokens, `/api/v1/chatbot/*`.
- `/api/chat-agent/*`, los nombres de tablas y settings, las features `chatbot-crear-ia` y
  `setting-guion-audio` del catálogo de modelos (cambió sólo su `label`).
- El registro de /admin/dev: slug `chatbot`, carpeta `app/admin/dev/chatbot` y su bitácora (cambió el
  título del área y el rótulo del sidebar de Dev). El proyecto «Agente: Chatbot» del plan
  (`lib/plan-proyectos-catalogo.ts`, `proyectos` del área, `loHabilita` del pricing): es una clave del tablero.
- Los archivos `lib/chatbot-*.ts`, `tests/chatbot-*.test.ts`, `docs/hallazgos-chatbot.md` y
  `docs/chatbot-*.md` (nombres de archivo, no de la pantalla), las props `puedeChatbot` /
  `mensajesEnChatbot` / `editarEnChatbot` y el atributo `data-editar-en-chatbot`.
- La historia: las bitácoras de /admin/dev, `_historial.generado.ts`, las migraciones, `docs/relevo*`,
  `docs/chats/`, `docs/superpowers/` y `docs/dev-areas.mjs` nombran la ruta como era.

### `git log` de un archivo movido empieza en el renombre [proceso]

`git log -- app/automations/FlujoLienzo.tsx` muestra un solo commit. La historia sale con
`git log --follow -- app/automations/FlujoLienzo.tsx`, de a un archivo. `scripts/gen-dev-historial.mjs`
no usa `--follow`; afecta poco porque toma los últimos 12 commits de todo el `vive[]` del área.

### Mover una ruta pide `npx next typegen`, y el build de un worktree de `.claude/` su propia raíz [proceso]

Después del `git mv` va `npx next typegen` antes del typecheck (AGENTS.md): sin eso `.next/types` no
conoce `app/automations/page.tsx`. Y el `npm run build` del worktree corrió con
`turbopack.root = resolve(__dirname, '..', '..', '..')` —el clon, que contiene al worktree y al
`node_modules` del junction—, no con el `'..'` que sirve para un worktree hermano del clon: verde, con
`/automations` y `/chatbot` las dos como rutas dinámicas. `next.config.ts` restaurado y su diff vacío.

### Revisión (10/10/2026): el renombre TOCÓ las líneas que perdían el `?ws=` y no las arregló [renombre]

Hallazgos 12 y 13. Al pasar `/chatbot` a `/automations` se reescribieron dos navegaciones que ya estaban
mal en main: el rebote de `/whatsapp?stab=plantillas` (WhatsAppApp, con el `useRouter` de
`next/navigation`) y los `<a href>` crudos del wizard compartido (OnboardingChatAgent, R099 en el `git mv`).
Las dos dejaban al super admin mirando SU cuenta. Un reemplazo de ruta es el momento barato de pasar la
línea por `app/_ui/Link`, y nadie lo miró porque el diff era de una palabra. **La regla:** al tocar una
línea que navega (aunque sea para cambiarle la ruta), se mira por cuál de las cinco formas sale.
`tests/pantalla-links-ws.test.ts` barre las pantallas de la parte «pantalla»; en `app/` quedan 40
`<a href="/…">` crudos en 25 archivos (medido el 10/10/2026: un `<a` cuyo `href` arranca en `/`), y
`app/video-generator/VideoGeneratorApp.tsx` sigue con el `useRouter` de Next.

**Vive en:** `app/whatsapp/WhatsAppApp.tsx` · `app/automations/OnboardingChatAgent.tsx` · `app/video-generator/OnboardingVideoGen.tsx` (`/extension/instalar`) · `tests/pantalla-links-ws.test.ts`

### Lo que quedó sin hacer (parte «renombre»)

- **Comentarios con «/chatbot» en archivos de la parte «plantillas»** (no se tocaron):
  `lib/avisos-catalogo.ts:752` y `:759`, `lib/flujo-aviso.ts:37`. Son prosa; el guard no los mira.
- **`app/admin/runway/datos.ts:280` y `:303`** dicen «/chatbot» en prosa (carpeta fuera de esta parte).
- **Datos en producción** (medido el 09/10/2026, sólo lectura): 4 tareas de `plan_tareas` citan
  `app/chatbot/<archivo>:<línea>` en su detalle (ChatAgentApp, GrabadorAudioPaso, OnboardingChatAgent ×2):
  el archivo está en `app/automations/`. No hay links a `/chatbot` guardados en `app_settings`.
- **No se vio con clics**: ni el redirect con un `?sec=` en el navegador, ni el título de la pestaña.
## Sexta tanda, parte «plantillas» (09/10/2026, noche): las plantillas que quedaron viejas

General 15, literal: «Hay plantillas que quedaron viejas con todos los cambios, incluso que no tienen
sentido porque quedaron con configuraciones viejas obsoletas... Cuando termines de implementar todo,
revisalas». Rama `wip-v6c-plantillas`. Lo guardado se mira con `scripts/plantillas-viejas.mts`
(simulacro por default); lo que lo mantiene al día, `tests/plantillas-viejas.test.ts`.

### «Las plantillas» son dos cosas, y en el código se llaman igual sólo una [plantillas]

En el código, una plantilla es un mensaje de MaKo en WhatsApp: el catálogo (`lib/avisos-catalogo.ts`),
el store por negocio (`mako.plantillas.store`, `lib/plantillas.ts`) y su ruta (`/api/perfil/plantillas`),
que la tab dibuja como la división «MaKo en WhatsApp». En boca de Martín es eso y además lo que la
plataforma trae hecho: «la plantilla por defecto» de la cobranza (04/10) y las automatizaciones que
siembra (las tres del onboarding y el esqueleto de la API). Se revisaron las dos, y las dos tenían lo
mismo: estaban escritas para un modelo que la tanda cambió y nada falla cuando eso pasa.

**Vive en:** `lib/avisos-catalogo.ts` · `lib/plantillas.ts` · `lib/setting-semillas.ts`

### Siete de los ocho mensajes que edita un cliente no mandaban lo que se editaba [plantillas]

**Síntoma:** el editor de MaKo en WhatsApp (el mismo del WhatsApp, MaKo en WhatsApp 2) dejaba escribir
el texto del reporte semanal, del recordatorio de reunión, de «Terminó la reunión», del mensaje
entrante y de la línea caída/volvió. Se publicaba, decía «Publicado ✓», y lo que llegaba no cambiaba.

**Causa:** cada emisor le pasa a `emitirDelCatalogo` un `texto` armado con lo que midió (o lo manda
`despacharReporte`), y entonces la plantilla no se lee. Sólo `cuota-vencida` usa la suya. Ya estaba
anotado como «cola» para el reporte («El texto de un REPORTE no llega al mail», /admin/dev/configuraciones)
y eran siete. En ws1 eso dejó un `texto` y un borrador de prueba («…$12.800 ZZZ QQQ») que no salen nunca.

⚠️ **El diagnóstico obvio —«hacerlos editables de verdad»— es el caro:** cada emisor arma su texto con
datos exactos (montos, links, la línea) y pasarlo por la plantilla es cambiar lo que le llega a cada
negocio. Lo que se hizo es lo seguro: el catálogo DECLARA `textoDelCodigo` y la ruta y el editor
preguntan lo mismo (`seEditaElTexto`). Lo decide Martín si alguno pasa a usar el texto del cliente.

⚠️ **Y `editable` eran dos preguntas en un booleano:** apagar el texto apagaba también el ＋ del
lienzo. El flujo de esos mensajes (su CRON por evento, sus pasos) sigue siendo del cliente:
`FlujoAviso` recibe `textoEditable` aparte. El guard cruza la marca contra los EMISORES en las dos
direcciones: un emisor que pase a mandar su texto obliga a poner la marca, y uno que pase a usar la
plantilla, a sacarla.

**Vive en:** `lib/avisos-catalogo.ts` (`textoDelCodigo`, `seEditaElTexto`) · `app/api/perfil/plantillas/route.ts` · `app/agencia/TemplateDetalleModal.tsx` · `app/agencia/FlujoAviso.tsx` (`textoEditable`)

### La plantilla de fábrica de la cobranza: dibujada rota, sin editor, y sus textos no salían [plantillas]

Tres capas, y ninguna daba error:

1. **Rota:** sus cuatro pasos —que el cron de cobranza corre con `correrFlujoDe`— llevaban «Este paso
   sólo corre cuando el mensaje lo dispara un evento», y una tarjeta con advertencia se pinta como rota.
   El grafo no sabía qué avisos corre el código: `correSuFlujo` en el catálogo, cruzado en el test contra
   el único llamador.
2. **Sin editor:** la espera, la condición y el mensaje al grupo caían al `return` del final de
   `EditorDelAviso`: una línea de texto, ni un campo ni «Quitar este paso». Un DELAY o un CONDITION
   agregados con el ＋ quedaban para siempre. Ahora tienen editor, con el mismo guardado diferido que la
   acción (`usePasoDiferido`: `panelPendiente`, desmonte, pestaña oculta).
3. **No salían:** la rama del mensaje al grupo (`lib/flujos.ts`) le pedía a la IA que reescribiera la
   plantilla PRINCIPAL (`generarMensajeAviso` lee `referenciaPlantilla(flujoId)`), no el paso. O sea que
   a las 48 h salía otra vez el mismo aviso, con `{{cuota_dias}}` crudo, en vez de «Sigue sin
   cobrarse…». Ahora sale el texto del paso con los datos por código y sin IA, como el mensaje de
   entrada. Medido: `flujo_corridas` vacía, no le cambió un mensaje a nadie.

Y los títulos de los pasos eran los de antes («Hace algo», «Espera», «Si pasa esto», «Te lo recuerda»):
son los de la casa (`TITULO`), y el mensaje al grupo es la tarjeta de MaKo con su texto.

**Vive en:** `lib/flujo-aviso.ts` (`corren`, `recorteDeTarjeta`) · `lib/flujos.ts` (rama `aviso_dueno`) · `app/agencia/FlujoAviso.tsx` (`EditorPasoEspera`, `EditorPasoCondicion`, `EditorPasoAlGrupo`)

### Las semillas escribían el modelo de antes, y el lienzo las abría «Sin publicar» [semillas]

`armarSecuenciasDeAudios` y `crearSecuenciaDesdeEtapa` escribían una LISTA (la espera en
`delay_horas`, la condición en `requiere`, el modo asistido, un «sigue con» que es un GO TO, y un
relleno que mandaba al «paso de redacción» de un wizard que no existe). Nacen por la MISMA conversión
que hace el lienzo al abrirlas (`abrirFlujo`) y con la limpieza que pone Publicar
(`estrategiaConLimpieza`): lo que nace es lo que se habría publicado, y el motor manda lo mismo.

⚠️ **La trampa de al lado:** sobre un flujo de tarjetas sin estrategia, re-grabar un audio sembraba la
estrategia de la LISTA (modo asistido, fallo por silencio), y el motor viejo volvía a hacer por su lado
lo que ya hacen las tarjetas. Una estrategia sembrada va con la forma de los pasos.

**Vive en:** `lib/setting-semillas.ts` (`planosDeAudios`, `comoNace`, `pasosDeEsqueleto`) · `lib/secuencias-audios.ts` · `lib/setting-secuencias.ts`

### Un evento sin emisor se ofrecía, y un mensaje propio con un evento no sale nunca [motor]

«Un lead escribe por WhatsApp» quedó sin emisor el 09/10 y seguía en el desplegable del CRON de los
mensajes: salió de `EVENTOS` y vive en `EVENTOS_SIN_EMISOR` para nombrar lo guardado. Y algo que no se
arregló: `dispararEvento` corre los PASOS del flujo de un aviso, nunca su mensaje. Un mensaje propio del
negocio (`custom`) con un evento —el ws13 tiene uno, apagado— no sale nunca, aunque el lienzo dibuje
CRON → MaKo en WhatsApp. Mandarlo también duplicaría los del catálogo que su código ya emite en ese
evento: lo decide Martín.

**Vive en:** `lib/flujos-tipos.ts` · `lib/flujos.ts` (`dispararEvento`)

### Medido en producción (09/10/2026, sólo lectura) [entorno]

- Store de mensajes en ws1 (6 entradas), ws3 (1), ws4 (2) y ws13 (5); el de la plataforma, vacío. Cero
  overrides de prompts (`mako.prompt-overrides` no existe): el prompt de Crear con IA es el del código.
- 69 automatizaciones, 10 no archivadas. #212 y #213 (ws1, en vivo): nada viejo, no se tocaron.
- Lo idéntico que el script escribiría: 4 flujos vacíos y un paso «⚡ Acción» de antes en ws1, 2 flujos
  vacíos en ws4. Lo que es de Martín: el texto «ZZZ» del reporte de ws1, el mensaje propio con evento de
  ws13, #221 (ws1: «Agendó pero no confirmó» al lado de la post-agenda nueva, o sea dos audios si se
  activa, y un GO TO), #210 (ws4, la post-agenda vieja del onboarding) y #224 (ws13, manual: no la
  arranca nada).

### Proceso [proceso]

- `tests/sin-chatwoot.test.ts` barre `scripts/` también: un script nuevo que nombre la integración
  borrada lo pone en rojo. Se escribe «la línea oficial».
- En un worktree aislado, un `node -e` con el programa en la línea lo puede rechazar el aislamiento del
  agente: las ediciones van por la herramienta de editar o por un archivo.

### Lo que quedó sin hacer (parte «plantillas»)

- **El DELAY de un mensaje de MaKo sigue siendo tarjeta** en su lienzo (DELAY 1 se hizo en el de las
  automatizaciones). `lib/flujo-aviso.ts` (`grafoDeAviso` → `AristaFlujo.esperas`) · `app/agencia/FlujoAviso.tsx`
- **El CRON de un mensaje sigue con «Por tiempo / Por una acción»** (CRON 2 era del de las
  automatizaciones). `app/_components/EditorCron.tsx` (`SelectorDisparo`)
- **Los textos que arma el código dicen «secuencia» y «Si responde»**: «Secuencia: X» y «súmalo como
  caso en «Si responde»» (`lib/chat-agent-handoff.ts`), «respondió a la secuencia de mensajes»
  (`lib/nutricion.ts`, rama protegida), «la secuencia está pausada» (`lib/setter-conversacion.ts`).
- **La API dice que re-armar las del onboarding «pierde sus cambios de texto y variantes»**: desde el
  08/10 una de tarjetas sólo cambia el audio. `lib/api-mako/areas/chatbot.run.ts` (`armar_secuencias_de_audios`)
- **El onboarding de la tab arrastra los pasos de la línea oficial** (y «la sub-tab Plantillas»), que el
  catálogo ya no tiene: código muerto. `app/chatbot/OnboardingChatAgent.tsx`
- **En /mensajes (agencia) se siguen editando los textos que arma el código**: lo decide Martín.
- **`usePasoDiferido` y `EditorPasoAccion` repiten el mismo guardado diferido**: pasar la acción al hook.
  `app/agencia/FlujoAviso.tsx`
- **Correr `scripts/plantillas-viejas.mts --aplicar`**: lo decide Martín (escribe sólo lo idéntico).
- **Verlo con clics**: el lienzo de la cobranza con sus editores, un mensaje que arma el código
  (sin editor y con ＋), y las semillas abriendo sin «Sin publicar».

## Sexta tanda, parte «horario» (10/10/2026): el horario de envío ahí mismo en Automations

Pedido literal: «El horario de oficina si se configura en la tab de configuraciones, pero haz que se
pueda configurar allí mismo, sin redirigir.» Rama `wip-v6e-horario`. Un botón con el reloj en el renglón
de «Chatbot» de la lista abre el MISMO `HorarioEnvioPanel` en un panel anclado, con las mismas acciones;
Configuraciones › Horario se queda. Lo fija `tests/automations-horario.test.ts` (10 roturas, las 10 en rojo,
y 18 más de la revisión en `wip-v6f-horario`, las 18 en rojo).

### Lo que usa una acción de Configuraciones no se importa en la lista: entra como nodo [horario]

**Síntoma (medido antes de escribir):** `import('./app/configuraciones/HorarioEnvioPanel.tsx')` bajo
`node --import tsx` tira «This module cannot be imported from a Client Component module»: `horario-actions.ts`
arrastra `server-only` (lib/tab-access, lib/settings). Cinco tests dibujan `SimuladorWhatsApp` con
`renderToStaticMarkup`, así que importado ahí caían los cinco AL IMPORTAR, no en una aserción.
**La regla:** lo que llame a una server action entra a la lista como NODO desde la tab (`horario`, como el
`pie`), y lo monta ChatAgentApp, que ningún test importa en runtime. Lo que se puede dibujar (el botón, la
cuenta de dónde cae el panel) va en un archivo sin las acciones (`HorarioBoton.tsx`), que sí se prueba.

**Vive en:** `app/automations/HorarioLista.tsx` · `app/automations/HorarioBoton.tsx` · `app/automations/SimuladorWhatsApp.tsx` · desde la décima tanda (11/10/2026) los dos de Horario se borraron: los reemplaza `app/automations/ConfiguracionesBoton.tsx` (`tests/automations-configuraciones.test.ts`)

### Un popover con un `Dropdown` de la casa adentro: el clic y el Escape del desplegable caen «afuera» [horario]

**Leído en el código, no visto con clics:** el menú del `Dropdown` va por portal al `body`, AFUERA del
panel, así que un «clic afuera» que mira `panel.contains(target)` cerraría el panel al elegir una hora. Y
los dos Escape viven en `document` y en captura, que corren en orden de REGISTRO: el del panel (al abrir)
corre antes que el del desplegable (al desplegar), y con `stopImmediatePropagation` el desplegable no se
entera. **La regla:** con un `[aria-expanded="true"]` adentro del panel, el panel no contesta ni el clic
ni el Escape (`hayMenuAbiertoEn`). Y `capa.visible` de `useCapaModal` es false en el PRIMER render (la
capa se registra en un efecto): un `display` atado a eso deja el panel en `display:none` justo cuando se
lo mide y se le da el foco.

**Vive en:** `app/automations/HorarioBoton.tsx` · `app/components/Dropdown.tsx` · `app/_components/pila-modales.ts` · desde la décima tanda (11/10/2026) los dos de Horario se borraron: los reemplaza `app/automations/ConfiguracionesBoton.tsx` (`tests/automations-configuraciones.test.ts`)

### Revisión: el panel anclado tiraba lo no guardado, y el borde en línea anulaba el hover [horario]

La revisión adversarial (sólo lectura) dejó dos reglas. Se arreglaron en la rama `wip-v6f-horario`.

- **Un panel anclado con «Guardar» que se cierra con un clic afuera pierde lo no guardado.** El editor se
  desmonta al cerrar, así que cambiar «De 9» a «De 8» y tocar el lienzo lo tiraba sin avisar. En
  Configuraciones eso sólo pasa al salir de la pantalla; acá alcanzaba un clic suelto. Arreglo: el panel
  avisa `onSucio` (con un efecto ANTES del return temprano) y `onGuardado`. Con cambios sin guardar no
  cierran ni el clic afuera, ni el Escape, ni el scroll (`retener`). ⚠️ **El Escape retenido se FRENA
  igual** (`stopImmediatePropagation`): un `return` antes del freno le pasa la tecla a la capa de abajo, y
  entonces se cierra lo de atrás con el panel abierto. El botón del reloj cierra siempre: es la salida
  explícita para descartar.
- **Un `border` en el `style` en línea anula el `:hover` de la clase.** El fondo ya estaba en la clase por
  esa razón, y el borde no: no cambiaba al pasar el cursor ni con el panel abierto, y su transición no
  corría nunca. El test dibuja el botón y falla si el `style` pone una propiedad que el hover cambia, o su
  atajo (`border` pisa `border-color`).
- ⚠️ **Y retener el panel DEJANDO PASAR el clic no protegía nada** (segunda revisión, al integrar). El clic
  seguía su camino: «＋ Nueva» del cartel vacío creaba la primera automatización, el cartel se desmontaba
  y con él el panel y lo editado. Con cambios sin guardar se frenan el `pointerdown` y el `click` que lo
  sigue, y el panel se sacude como seña (sin movimiento si la persona lo pidió). La pregunta antes de
  retener algo: **¿el clic que dejo pasar puede desmontar al dueño de lo que retengo?**
- ⚠️ **`stopImmediatePropagation` corta a los listeners que se registraron DESPUÉS**, y ésos son justo los
  de lo que la persona abrió con el panel ya abierto (un «⋯», un renombre): con el panel sucio, el Escape
  quedaba muerto en toda la pantalla. El retenido frena sólo la tecla que nace en el panel, en su botón o
  sin foco. Las dos cosas las fija `tests/automations-horario.test.ts` (roturas C1-C8).

**Vive en:** `app/configuraciones/HorarioEnvioPanel.tsx` · `app/automations/HorarioLista.tsx` · `app/automations/HorarioBoton.tsx` · `tests/automations-horario.test.ts` · desde la décima tanda (11/10/2026) los dos de Horario se borraron: los reemplaza `app/automations/ConfiguracionesBoton.tsx` (`tests/automations-configuraciones.test.ts`)

### Lo que quedó sin hacer (parte «horario»)

- **Verlo con clics**: no se levantó la app (bootear local escribe en prod). Falta ver en un navegador la
  retención con cambios sin guardar, el cierre por scroll, el borde en el hover y el panel colgando del
  botón en el cartel vacío.
- **Una decisión por defecto, avisada a Martín:** con cambios sin guardar el panel no se cierra solo, y el
  clic afuera no muestra ninguna señal (lo de atrás contesta igual). Si prefiere que cierre igual, la otra
  salida es dejar el editor montado y escondido después de la primera apertura.
- En el cartel vacío, «＋ Nueva» con el panel abierto y sucio crea la primera automatización y el cartel se
  desmonta con el panel: lo no guardado se pierde ahí.

## La galería de plantillas (10/10/2026, parte «galeria»): arrancar de una automatización hecha

Martín, al preguntarle si quería las automatizaciones de los clientes como galería o copiadas: «Si,
hagamos la galería de las más comunes...», y después «no estan todas las plantillas de Mauricio».
Rama `wip-v7-galeria`. El catálogo es `lib/plantillas-automatizaciones.ts` (siete plantillas, una por
cada automatización de Mauricio y la de no-show de ws13, generalizadas); lo fija
`tests/plantillas-automatizaciones.test.ts` (27 roturas, las 27 en rojo).

### Una automatización colgada de una ETAPA no hereda «la reunión ya pasó» del motor [plantillas, motor]

**Síntoma (leído en el código, antes de que pase):** las post-agenda de origen (#212, #213, #221)
dicen «¿me confirmas que nos vemos en la reunión?» a las 25 h. Bien colgadas de un evento; colgadas
de la etapa «Agendado», ese mensaje le llega a quien agendó para dentro de 20 h con la reunión ya
pasada, y al prender la automatización el CRON inscribe a TODOS los que están en la etapa, también al
que la tuvo hace un mes.

**Causa:** la guarda del motor que cierra sin mandar («la reunión ya pasó») decide por el
`trigger_tipo` —`preparaUnaReunion`, la familia `agendado_*`, los eventos que la tercera tanda sacó del
CRON— y una etapa es `etapa_actual`. Una espera `antes_reunion` sí se cuida sola (sin reunión por
delante, el motor corta con `sin_reunion`); una espera por tiempo, no.

**La regla:** en un flujo que arranca por una etapa, cada mensaje que habla de la reunión va detrás de
una condición «Próxima reunión en ≤ 720 h» DESPUÉS de cada espera por tiempo (no sólo al entrar). Lo
fija `miraLaReunion` en el test. ⚠️ Vale igual para Crear con IA, que hoy no lo sabe.

**Vive en:** `lib/plantillas-automatizaciones.ts` (`REUNION_POR_DELANTE`) · `lib/nutricion-familias.ts` (`preparaUnaReunion`)

### «Agendó» es «tiene una reunión cargada», pasada o futura: en un flujo de no-show no sirve [motor, datos]

`agendoLead` (lib/nutricion-grafo-motor.ts) mira las cuatro fechas de junta, sin preguntar si pasaron.
Para quien faltó a una reunión es siempre verdadero: la reunión a la que faltó cuenta. Medido en
producción (sólo lectura): **#224 de ws13** («No asistió: reagendar», pausada) espera 2 días y su
primera rama es «Agendó → termina», así que a quien faltó a una reunión cargada en su ficha no le
saldría nunca el email de los 2 días. La plantilla usa «Próxima reunión en ≤ 720 h». #224 no se tocó:
lo decide Martín.

### Medido en producción (10/10/2026, sólo lectura) [entorno]

Las diez vivas: #198 todavía tiene dos «Ir a» a la #212 (los pasa `scripts/quitar-ir-a.mts`, en
simulacro); #221 tiene uno de tarjeta a tarjeta y pone la etiqueta 1 del ws1; #226 cuelga de las
nueve etapas de entrega del producto 1 y pone la etiqueta 2. Todo lo de los clientes es suyo: los
audios, el link del video de confirmación (`confirmar.lovable.app`) y la agenda de Cal.com de ws13.

### Proceso: el Chromium de Playwright no arranca acá; el Chrome del sistema sí [proceso]

`spawn UNKNOWN` al lanzar `ms-playwright/chromium-*/chrome.exe`, también sin sandbox y con
`spawnSync(… ['--version'])` pelado: no es Playwright. Con `executablePath` al Chrome del sistema,
headless y `--mute-audio`, el banco de esbuild (ver «un componente del lienzo se verifica sin `next
dev`») abre por `file://` y se recorre con clics. La galería se vio así: los dos pasos, el desplegable
con productos, «Elegir después», «Volver», Escape y un teléfono de 390 px sin desborde.

### Lo que quedó sin hacer (parte «galeria»)

- **El enchufe**: «＋ Nueva» abre la galería. Vive en `app/automations/SimuladorWhatsApp.tsx` y
  `app/automations/ChatAgentApp.tsx`, que eran de otra corrida: el cambio exacto, en el informe de la
  parte (bloqueantes). Hasta entonces la galería tiene cero call sites.
- **«En blanco» y «Con MaKo» hacen hoy lo mismo**: la vacía de «＋ Nueva» abre siempre con la caja
  de Crear con IA. Para que se distingan, «En blanco» sin la caja (o «Con MaKo» con el foco en ella)
  es un cambio de `app/automations/SecuenciaPerfil.tsx`. Lo decide Martín.
- **Crear desde una plantilla no está en el registro de la API** (tampoco «Duplicar» ni «＋ Nueva»):
  existe para la pantalla y no para MaKo por WhatsApp. `lib/api-mako/areas/chatbot.def.ts`
- **Crear con IA no pone la guarda de la reunión** en un flujo colgado de una etapa. `lib/flujo-ia.ts`
- **Verlo con clics en la app real**: crear una de cada en el ws3 y abrirla en el lienzo.

## Restos de versiones anteriores, grupo recordatorio (10/10/2026)

Martín, con la captura del recordatorio en producción: «siguen habiendo cosas de versiones anteriores que
estan mal..». Rama `wip-v7-recordatorio`. Lo fijan `tests/recordatorio-lienzo.test.ts` y
`tests/recordatorio-lead.test.ts` (las roturas, en sus cabeceras).

### Un lienzo que arma sus nodos a mano no hereda los arreglos del lienzo [recordatorio]

**Síntoma:** después de la sexta tanda el recordatorio seguía con las esperas como tarjetas DELAY, el CRON
sin su cajita ni su «Entonces» y las tarjetas creciendo con el texto. **Causa:** `grafoRecordatorio` ponía
sus nodos con un `poner({ … })` propio, así que cada cambio de `grafoDeSecuencia` (la pastilla en la
flecha, `altoCron`, `salidaAlPie`, el alto fijo) le pasaba de largo. **La regla:** lo que se dibuja «como
una automatización más» se arma como PASOS del modelo (lib/flujo-grafo.ts) y pasa por `grafoDeSecuencia`;
lo propio se aplica ENCIMA de su salida. Lo que mejore el constructor le llega solo.

**Vive en:** `lib/recordatorio-grafo.ts` · `app/automations/RecordatorioFlujo.tsx`

### El hueco entre columnas no mide la pastilla del DELAY [lienzo]

**Estimado con los estilos, no visto en un navegador:** `grafoDeSecuencia` separa las columnas 92 px
(`GAP_COLUMNA`) y el lienzo dibuja la pastilla con `nowrap` y sin ancho: «1 h antes de la reunión» mide
~180 px y queda encima de las dos tarjetas y del círculo de la salida. `anchoPildoraFlecha` topea en 150,
así que la estimación también se queda corta. Pasa con toda espera `antes_reunion` colapsada en la flecha
de una automatización (las de antes). En el recordatorio se resolvió con la pastilla corta («24 h antes») y
cada flecha ensanchada (`AIRE_PILDORA`); en el constructor, no.

**Vive en:** `lib/flujo-conversacion.ts` (`GAP_COLUMNA`) · `lib/lienzo-grafo.ts` (`anchoPildoraFlecha`)

### El ✦ de MaKo no se puede prender sobre un emisor con variables propias [whatsapp]

`MakoRedacta` arma el prompt y el filtro (`sinVariablesAjenas`, lib/mako-redacta.ts) con las variables del
MOTOR. Sobre el recordatorio escribiría `{{empresa}}` —que `problemaDelTexto` rechaza al publicar— o la hora
escrita a mano, y nunca `{{cuando}}`, `{{hora}}`, `{{faltan}}` ni `{{link}}`. **La regla:** un ✦ que escribe
para un emisor propio recibe SU lista de variables, y la usan el prompt y el filtro. Hasta entonces el
recordatorio va con `conMako={false}`.

**Vive en:** `lib/mako-redacta.ts` · `app/api/chat-agent/redactar/route.ts` · `app/automations/MakoRedacta.tsx`

### Lo que quedó sin hacer (grupo recordatorio)

- **Los botones de deshacer y rehacer**: `BotonPila` es privada (y está dos veces: SecuenciaPerfil.tsx y
  FlujoAviso.tsx). El atajo ya anda. `app/automations/RecordatorioFlujo.tsx` (`herramientas`)
- **Mover las tarjetas y «Acomodar»**: `usePosicionesLienzo` guarda sólo en `nutricion_secuencias`.
  `app/automations/usePosicionesLienzo.ts`
- **«▶ Probar»**: el panel prueba una automatización con las variables del motor; el recordatorio tendría
  que resolver con `textoDelToque`. `app/automations/PanelProbar.tsx` · `app/automations/SimuladorWhatsApp.tsx`
- **El borrador en el server**: lo no publicado ya pregunta antes de perderse, pero no se guarda.
- **El texto repetido del editor de un solo texto** (la burbuja y la barra con lo mismo): es del editor.
  `app/automations/EditorMensajeWhatsApp.tsx`
- **`EMOJI_RECORDATORIO` vive en dos lugares** (el título y la fila): un test los ata hasta que la lista lo
  importe. `app/automations/SimuladorWhatsApp.tsx`
- **`lib/recordatorio-grafo.ts` falta en el `vive[]` del área chatbot.** `app/admin/dev/areas.ts`
- **Verlo con clics.**

## Restos de versiones anteriores, grupo avisos (10/10/2026): el lienzo de un mensaje de MaKo

Pedido literal: «Pero no estan todas las plantillas de Mauricio y siguen habiendo cosas de versiones
anteriores que estan mal..». Rama `wip-v7-avisos`. El lienzo de un mensaje de MaKo (`FlujoAviso`) pasó a
las piezas de una automatización: el DELAY sobre la flecha, la tarjeta CRON con sus cajitas, el círculo
«Entonces», la CONDITION con sus dos filas, el tacho del panel, el menú de la casa. Lo fijan
`tests/flujo-aviso.test.ts` y `tests/barrido-sexta-datos.test.ts` (24 roturas, las 24 en rojo).

### La flecha del «Si no» pasaba POR DETRÁS de la tarjeta del «sí» [avisos]

**Síntoma (visto en un navegador, con los tests en verde):** con las ramas como filas de la CONDITION, la
flecha del «Si no» sale horizontal de la fila de abajo, y la tarjeta del «sí» estaba en la misma fila: la
flecha la cruzaba por detrás y se leía como que entraba ahí. **El diagnóstico obvio era el equivocado:**
bajar la tarjeta del salto no cambia nada, porque lo que estorba es la de al lado. **La regla:** la tarjeta
del «sí» de una CONDITION con salto SUBE una fila (`sube`), y la fila del tronco (`fila`) baja lo que suba
la más alta, para que nada quede arriba del borde del dibujo. Por eso el modelo de los pasos se calcula
ANTES que el tronco.

**Vive en:** `lib/flujo-aviso.ts` (`grafoDeAviso`)

### Un mensaje de MaKo es una LISTA: el ＋ en paralelo sólo prende un canal [avisos]

El lienzo de una automatización ofrece flechas sueltas, en paralelo y arrastrables porque su motor es un
grafo; el de los avisos (`decidir`, `lib/flujo-pasos.ts`) recorre una lista: +1, o +2 si la condición no
se cumple. Copiar esos gestos dibujaría caminos que el motor no corre. Lo único que sale «a la vez» en un
mensaje es el otro canal: con un canal apagado, el círculo de la cabeza ofrece su ＋ aunque ya siga en
algo, y ese ＋ ofrece sólo el canal (el Lienzo le pasa el puerto `par`). Sin eso, con pasos puestos no
quedaba en el lienzo cómo prender el mail, porque el ＋ del costado se fue. Y con WhatsApp prendido la
tarjeta del mail no tiene círculo: un «después» del mail no existe.

Y la espera dice lo que el motor ESPERA: el editor de antes dejaba poner 8760 horas y `sanearHoras` corta
en 720 (`DELAY_MAX_HORAS`). Una espera vieja de un año se dibuja «30 días», y así se guarda al tocarla.

**Vive en:** `lib/flujo-aviso.ts` (`salidaDe`, `canalPorPrender`, `segundosDeEspera`) · `app/agencia/FlujoAviso.tsx` (`opcionesEn`, `EditorPasoEspera`)

### Lo que quedó sin hacer (grupo avisos)

- **Verlo con clics en la app real.** Se vio en un arnés (esbuild + `fetch` simulado, Chrome sin ventana):
  las pastillas, el CRON, los círculos, el menú, el click derecho y el tacho. La app no se levantó.
- **`muelles` no tiene call site:** FlujoAviso la recibe y la cadena `SimuladorWhatsApp` →
  `MensajeMakoLienzo` → `TemplateDetalleModal` no la pasa, así que el panel abre con el tamaño de siempre.
- **El ✦ del mensaje es `RedactaAviso`, no `MakoRedacta`:** el del composer escribe con la voz del lead
  para una automatización, y un aviso va al grupo del dueño. Se reusa el día que acepte un `pedir` propio
  (`app/automations/EditorMensajeWhatsApp.tsx`).
- **Piezas privadas:** `VistaEmail` y `EditorEspera` (`app/automations/FlujoLienzo.tsx`) y
  `ElegirClase`/`Volver` (`app/automations/EditorDisparadores.tsx`) no se exportan.
- **`CRON_DEFAULT` sigue en `app/_components/EditorCron.tsx`** porque lo importa `EditorDisparadores`; su
  lugar es `lib/cron-aviso.ts`.

## Restos de versiones anteriores, grupo «lista» (10/10/2026)

Martín abrió /automations en su ws9: «Pero no están todas las plantillas de Mauricio y siguen habiendo
cosas de versiones anteriores que están mal». Rama `wip-v7-lista`. Salió el pie «N etapas sin secuencia ·
Armar una» (y su `huecos` y el pedido de «Armar una»), las filas marcan lo sin publicar, la tab dice
«automatizaciones», el editor de UN mensaje dejó de dibujar el texto dos veces, y «Probar», los avisos que
arma el código y el wizard del onboarding (sin la línea oficial ni «aprobar») hablan como la tab.

### «MaKo en WhatsApp» no tiene identidad de tarjeta: lo que se guarda POR TARJETA se comparte [whatsapp]

`EditorMensajeGrupo` monta el editor de WhatsApp con un paso fijo (`id: 'mako-grupo'`, orden 1), así que
`claveDeTarjeta` da LA MISMA clave para todas las tarjetas MAKO de un lienzo y para todos los mensajes de
Notificaciones. Mientras la barra de un mensaje era el mensaje (`modo="editar"`) no importaba; al pasarla a
borrador (la misma interfaz que el de varias partes), el mapa del módulo `borradores` llevaba lo tipeado en
un aviso a la barra del siguiente, y su ➤ lo mandaba ahí. **La regla:** antes de guardar algo por tarjeta
en un mapa del módulo, mirá si TODOS los que montan el editor le dan una identidad; el de un mensaje no
recuerda la barra (`recordarBarra`), y cada montaje es de un mensaje porque los tres que lo montan le ponen
`key`. ⚠️ El panel de MaKo (`usePanelMako`) y el guion (`guionesDeMaKo`) usan la misma clave: hoy no muerde
porque «MaKo en WhatsApp» va sin ✦; el día que lo lleve, `EditorMensajeGrupo` necesita una `clave` propia.

**Vive en:** `app/automations/EditorMensajeWhatsApp.tsx` (`claveDeTarjeta`, `recordarBarra`, `EditorMensajeGrupo`)

### «No están todas las plantillas de Mauricio»: lo medido, para preguntarlo bien [plantillas]

Leído en producción (sólo lectura, 10/10/2026): el ws9 (la plataforma) no tiene ninguna automatización viva
(11 archivadas) ni store de mensajes; el ws1 (Mauricio) tiene vivas #198, #212 y #213, pausadas #220, #221 y
#226, y un store de 6 entradas: `ad-fatiga` (flujo), `reporte-semanal` (flujo y borrador),
`meta-cuenta-frenada` (flujo), `plan-proyecto-vence` (borrador), `lead-formulario-meta` (apagado) y
`lead-no-confirmo` (flujo). Cuatro de esas seis no están en `AVISOS_DEL_CLIENTE`, así que la lista de
/automations no las muestra en NINGÚN negocio: «MaKo en WhatsApp» lee `/api/perfil/plantillas` (vista
cliente, 7 mensajes) y el catálogo de la agencia (65) vive sólo en /mensajes. Las tres lecturas posibles, para
preguntarle a Martín con opciones (no se tocó nada):
1. el catálogo de la AGENCIA en la lista del ws9 (la pregunta abierta del relevo: «¿/mensajes también se muda?»):
   pide el endpoint de admin en `MensajeMakoLienzo` y en `ChatAgentApp.cargarAvisos`;
2. los flujos que armó en el store del ws1 cuando la base de la herencia era el ws1 (157a302a la pasó a la
   plataforma): pasarlos al ws9 es escribir en la base;
3. las automatizaciones de Mauricio (las de `docs/relevo/chatbot-secuencias.json`) como plantillas para
   «＋ Nueva»: hoy no hay un catálogo de plantillas de automatización.

**Vive en:** `lib/plantillas.ts` (`listarPlantillas`) · `lib/avisos-catalogo.ts` (`AVISOS_DEL_CLIENTE`) · `app/automations/ChatAgentApp.tsx` (`cargarAvisos`)

### Lo que quedó sin hacer (grupo «lista»)

- **El panel grande, el `insetDer` y lo no publicado para el recordatorio y los mensajes de MaKo**: la lista
  ya tiene `muelles` y `setSinPublicar`; faltan las props del otro lado (`RecordatorioFlujo`,
  `MensajeMakoLienzo` → `TemplateDetalleModal` → `FlujoAviso`). La marca de «sin publicar» de un mensaje de
  MaKo sale de lo GUARDADO: aparece al volver a leer la lista (publicar, prender, recargar). En vivo hace
  falta que `TemplateDetalleModal` avise (`onSinPublicar`, o `onCambio` después de guardar el borrador).
- **`/api/chat-agent/onboarding/resumen` quedó sin llamadores** (lo llamaba el paso «aprobar»). Es un GET
  que ARMA automatizaciones: borrarlo es retirar una ruta (`npx next typegen` en el clon).
- **El ✦ en la tarjeta MAKO**: el redactor (`/api/chat-agent/redactar`) escribe para el LEAD; para el
  equipo hace falta otro contexto y la `clave` de arriba.
- **Verlo con clics**: nada de esto se vio en un navegador.

## Séptima tanda (10/10/2026): la condición «suelta», las de Mauricio y Código Inmobiliario, y lo viejo del ws9

Pedidos literales en la bitácora (hitos del 10 oct 10:21-11:25). Lo que se aprendió, no lo que se hizo:

- **La «condición suelta» de la 198 no estaba suelta: el DIBUJO mentía.** Es la CONDITION que escucha la
  respuesta (nodo 'respuesta'), que en el motor cuelga del CRON y por eso `validarGrafo` la deja pasar. La
  segunda pasada de la sexta tanda le sacó la flecha al sacar la fila «Si responde» del CRON, y se veía igual
  que una tarjeta suelta. ⚠️ **El diagnóstico obvio —«Publicar y Probar no frenan las sueltas»— era el
  equivocado** para esa tarjeta: las 8 automatizaciones vivas de ws1 y ws13 pasaban `validarGrafo` sin una
  suelta real. La regla: lo que el motor cuelga de algo se DIBUJA colgado de eso, con una flecha que no es del
  dato (`sinMas`: sin ＋ en el medio, sin papelera, y «Desconectar» no la cuenta). Y una fila única no se llama
  «Si no» (sin un «Sí» arriba se lee a medio armar): `rotuloSiNoDeRespuesta`, que leen la tarjeta, su editor y
  «Probar».
- **Pero «me deja probarlo» era cierto por otra puerta.** El botón «▶ Probar» frenaba; con el panel ABIERTO,
  ↻, «Cambió · ↻», «Probar en WhatsApp» y un número nuevo rearrancaban sobre lo que se edita sin mirar nada, y
  «Probar en WhatsApp» MANDABA. El freno va en cada puerta que arranca, no en el botón que abre: el lienzo le
  pasa al panel el mismo `frenoDelFlujo` que Publicar (`EdicionLocal.freno`).
- **Un script que cambia `pasos` deja el borrador huérfano en silencio.** El borrador guarda `base` = la firma
  de lo publicado (`firmaPublicado`); con otra firma, `borradorVigente` ya no lo abre. Al arreglar datos se
  rearma o se borra en el mismo cambio. Y para comparar un borrador con lo publicado se ignora `orden`: el
  lienzo lo renumera al abrir (el de la 198 sólo difería en eso y en una errata).
- **La 221 era la post-agenda VIEJA** (`agendado_sin_confirmar`), que no está en `FAMILIA_POST_AGENDA`: prendida
  junto a la 212 y la 213, el lead recibía el audio dos veces y Activar no lo frenaba. Se archivó; el agujero del
  código sigue (ver abajo).
- **La pastilla del DELAY pisaba las tarjetas en CUALQUIER automatización**: el árbol separaba las columnas 92 px
  y «1 h antes de la reunión» mide 150. El recordatorio lo había arreglado sólo para él. La columna se corre lo
  que pide su flecha (`huecoHacia`). ⚠️ Un test que medía sólo el eje X dio un falso rojo con dos esperas
  seguidas: van a distinta altura sobre la curva, así que se comparan rectángulos.
- **Un test que fija un camino que nunca corre.** `tests/flujo-aviso.test.ts` fijaba `editorDeTarjeta(muelles, …)`
  en FlujoAviso, pero `muelles` no llegaba desde la lista: el panel de MaKo en WhatsApp estaba siempre en 460 px.
  Se enchufó de punta a punta (SimuladorWhatsApp → MensajeMakoLienzo → TemplateDetalleModal → FlujoAviso) y el
  guard mira la cadena entera.
- **Dos botones con el mismo resultado se leen como que uno está roto.** La galería traía «En blanco» y «Con
  MaKo», y una vacía abre siempre con la caja de Crear con IA: queda una tarjeta.
- **Un reporte sale por las preferencias, no por su plantilla.** El lienzo del reporte semanal dibujaba WhatsApp (el
  default de la plantilla) y no Email, que es por donde sale: `canalesDeMensaje`, la misma de la bandeja.
- **El guard de nombres reales existía y no tenía los nombres.** «Terminó la R1 con Sergio Esquer» (un cliente
  de Mauricio) pasaba el test de los ejemplos del catálogo porque la lista `REALES` no lo nombraba. La lista caza
  los conocidos; cada nombre real que aparezca se suma ahí.
- **El aviso de 30 minutos al dueño miraba sólo la hora**: una cancelación de Calendly borra la fecha y deja la
  hora (0 de 130 filas hoy). `reunionParaElDueno` (pura, con test) pasa por `juntasDe` + `fechaCoincide`.

### Lo que quedó sin hacer, con su archivo

- **`agendado_sin_confirmar` fuera de la regla del doble envío** (`lib/nutricion-familias.ts`, `FAMILIA_POST_AGENDA`):
  una automatización nueva con ese CRON, prendida junto a 212/213, repite el audio. Activar no lo frena.
- **Activar no mira si la línea está conectada** (`mako_ws13` desconectada y sin número): se prende y no sale nada.
- **Una espera «N antes de la reunión» que ya pasó sale enseguida** (el «mañana» de la 223, a quien reserva con
  menos de 24 h). Se arregló el texto; el motor sigue de largo (`lib/nutricion.ts`).
- **La 224: «Agendó» cuenta la reunión a la que faltó**, así que el email de reagendar no le sale a nadie. La
  plantilla de la galería lo resuelve con «Próxima reunión en ≤ 720 h»; la 224 la decide Martín.
- **El recordatorio sin ✦, sin mover tarjetas, sin «Acomodar» y sin «Probar»** (`app/automations/RecordatorioFlujo.tsx`;
  los cambios exactos en la sección del grupo recordatorio). Si el recordatorio se muda al motor, vienen solos.
- **Copias en FlujoAviso**: `VistaEmailAviso`, `BotonMakoAviso`, `BotonVolver` y `RedactaAviso` (originales:
  `VistaEmail` y `EditorEspera` de FlujoLienzo, `BotonMakoWhatsApp`, `Volver` de EditorDisparadores, `MakoRedacta`
  con una prop `pedir`). `BotonPila` ya es uno (`app/automations/BotonPila.tsx`, con guard).
- **«Probar» en MaKo en WhatsApp**: la vista del chat sigue en Notificaciones (`MensajeMakoLienzo` no pasa `onVerChat`).
- **El aviso de 30 min al dueño sólo corre con Calendly** (`app/api/cron/reunion-recordatorio/route.ts`,
  `correrPorWorkspace('calendly', …)`): ws13 (Cal.com) no lo recibe. Extenderlo es mandar avisos nuevos a clientes.
- **`/api/chat-agent/onboarding/resumen` sin llamadores**; retirarla pide `npx next typegen` en el clon.
- **El reporte semanal no sale por WhatsApp** desde que se borró Chatwoot (`despacharReporte`, `lib/notify.ts`).
- **El store de mensajes del ws9 es el default de todos los clientes** (`leerPar`, `lib/plantillas.ts`).

**Vive en:** `lib/flujo-conversacion.ts` (`huecoHacia`, la flecha de la que escucha) · `lib/flujo-grafo.ts`
(`rotuloSiNoDeRespuesta`) · `app/automations/PanelProbar.tsx` · `app/automations/SecuenciaPerfil.tsx`
(`EdicionLocal.freno`) · `app/agencia/TemplateDetalleModal.tsx` · `lib/recordatorio-lead.ts` (`reunionParaElDueno`)

## Lo que quedó sin hacer

**De la parte «tiempo» (sexta tanda, 09/10/2026):**

- **Montar el selector en los cinco «{ }»** (las líneas exactas, en el informe de la parte): el composer
  de WhatsApp (`app/automations/EditorMensajeWhatsApp.tsx`, el `MenuWA` de `abierto === 'datos'`), el email
  (`app/automations/EditorEmailGmail.tsx`, los dos `MenuWA` de datos), el editor de avisos
  (`app/agencia/EditorMensaje.tsx`, el `Dropdown` de secciones), la tarjeta MAKO (`app/automations/FlujoLienzo.tsx`,
  `DATOS_MAKO`) y los avisos (`app/agencia/FlujoAviso.tsx`, que ya recibe el árbol nuevo). Hasta que se
  monten, el WhatsApp y el email ofrecen los 4 de siempre (sin «Tu negocio») y el aviso, el árbol nuevo
  aplanado en secciones.
- **La tarjeta MAKO resuelve sólo los 5 del motor** (`textoDelAviso`, lib/api-mako/areas/chatbot.run.ts):
  pasarla a `conVariables(t, { ws, leadId, destino: 'equipo' })` ANTES de ofrecerle el árbol.
- ~~Borrar los cascarones `sinPrecision` / `avisoDePrecision`~~ HECHO en la segunda pasada (parte «flujo»):
  `tests/espera-duracion.test.ts` falla si vuelven.
- **«Probar»** previsualiza con el lead de ejemplo de los 5 datos (`textoDeEjemplo`, lib/simulador-grafo.ts) y
  la prueba real con `valoresVariablesLead` (`probarSecuencia`, lib/setting-secuencias.ts): los tokens nuevos
  salen crudos ahí. Va `{ ...valoresDeEjemplo(), ...lo de hoy }`.
- **Textos de la API viejos**: «cada hora, en horario de envío» y «la ventana de 9 a 21» en
  lib/api-mako/areas/chatbot.run.ts (`cuandoSale`, la nota de la simulación) y chatbot.def.ts (dos descripciones).
- **Lo que decide Martín**: los recordatorios de clases (lib/curso-mensajes.ts) y las insistencias al grupo
  (lib/flujos-tipos.ts, `INSISTIR_VENTANA` 8-21) tienen su propio horario fijo y no siguen al de
  Configuraciones; ¿el horario del negocio vale también para ellos?
- **El curso de un lead es una aproximación** (lo que abre su acceso, o su entrega + el producto de su
  embudo + donde ya tiene avance): la regla completa vive en `universoDeLaEntrega` y lee la cartera entera.
  `lib/variables-resolver.ts`
- **El tick topea en 1000 filas** por minuto (PostgREST): con más, lo que queda sale al minuto siguiente o con
  la corrida de la hora. `app/api/cron/nutricion-tick/route.ts`
- **Verlo con clics**: Configuraciones › Horario y el selector en árbol.

**De la parte «lienzo» (quinta 2), lo que decide Martín:** si mover una tarjeta se deshace con Ctrl+Z (hoy
no: la pila es de los pasos), si hace falta un «Reacomodar» que vuelva al layout automático, y qué pasa con
una tarjeta soltada arriba o a la izquierda del margen (queda en coordenadas negativas y «Centrar» no la
cuenta; igual en /mensajes). La copia de «Duplicar» hereda el acomodo. `app/_components/Lienzo.tsx`

**Del punto 15 de la cuarta tanda (09/10/2026):** los tres enchufes que quedaron en archivos de otras
partes —el número de salida en el editor, «✦ MaKo» al lado del título (`accionesTitulo` de `Lienzo.tsx`)
y la tarjeta con «+N más» y sin la transcripción— y el «De» del email (punto 16) se ENCHUFARON al unir la
tanda, con `tests/chatbot-enchufes.test.ts` (7 roturas, las 7 en rojo). Lo que sigue sin hacer: el
marcador de cuántas partes salieron vive en `nutricion_envios.asunto` (una columna `partes_salidas` es el
arreglo de fondo) y el borrador del setter de un mensaje de varias partes junta los textos en uno
(`wa_borradores` no tiene partes). `lib/mensaje-partes.ts` · `lib/nutricion.ts`

**De la cuarta tanda (09/10/2026):** los puntos 1, 5, 6 (la cuota N), 7, 8, 11 (más acciones), 14,
15 y 16, cada uno con sus archivos, en `docs/relevo/chatbot.md` → «La cuarta tanda». El chat de CRM ya
dejó marcadas las etapas de reunión (`adf1ca3d`), que es lo que el punto 5 necesitaba.


**De la tercera tanda (09/10/2026)**

- **Verla en un navegador**: editor mediano, CRON por pasos, emoji, «⋯» de la lista, «Nueva», bandeja
  tipo Gmail de «Probar», editor rico del email, monto al mover a Ganado y la capa de Crear con IA.
- `proponer_cambio_etapa` no acepta el producto (`embudoId`); faltan en el registro «sacar de una
  automatización» y «mover en el kanban de entrega». `lib/api-mako/areas/crm.def.ts` · `cs.def.ts`
- Crear con IA sólo conoce las 9 condiciones de antes, no el catálogo. `lib/flujo-ia.ts`
- `getVslEngagementMap` se traga el error: con la base caída, «No reprodujo el VSL» se cumpliría para
  todos. Hace falta una lectura estricta para el motor. `lib/leads.ts`
- El modelo gratis de OpenRouter por default está muerto para TODAS las features y `CASCADA_DOCS` sigue
  con OpenAI y Mistral. `lib/ai-cheap.ts`
- La red de plataforma en Crear con IA (cliente con una sola key) y Cancelar que no frena la cascada. `lib/ai-cheap.ts`
- Las props muertas del editor de WhatsApp (`mostrarRevisar`, `revisarHeredado`, `disposicion`). `app/automations/EditorMensajeWhatsApp.tsx`
- **La key de Gemini de la plataforma está bloqueada por Google** (403): lo decide Martín.

**De la segunda tanda (09/10/2026)**

- **Verla en un navegador en producción**: el CRON con «Al entrar» y «Si responde», el ＋ en paralelo,
  las tarjetas de control, el editor apaisado (WhatsApp en fila, Gmail, la frase de etiqueta), el
  selector de acciones, «Probar» ancho con un email, y crear con IA de punta a punta en el ws3.
- **Las secuencias de los clientes están creadas EN PAUSA** (#221, #222 y la #220 en el ws1; #223 y
  #224 en el ws13). Falta que Martín las active, y el disparador de la #224: la etapa «noresp» no
  existe en el embudo del ws13 y `setTriggerSecuencia` la rechaza. Código Inmobiliario no tiene canal
  hoy.
- `saveLeadRespuestas` guarda el set entero en UN insert: una fila mala pierde todas. `lib/leads.ts`
- El «+N» de los avisos de la IA vive en el `title` (no se ve en un teléfono). `app/automations/SecuenciaPerfil.tsx`
- `asignar_closer_setter` salió de la lista blanca de la IA en vez de validar nombres. `lib/flujo-ia.ts`
- Un override guardado del prompt `chatbot.crear-ia.system` conserva el ejemplo viejo.
- El editor y «Probar» pintan itálica con `_…_` sin bordes (`lead_nombre_x`). `app/agencia/EditorMensaje.tsx` · `app/_components/TextoMarcas.tsx`
- `scripts/typecheck-lock.mjs` arma la ruta de tsc a mano: en un worktree anidado da MODULE_NOT_FOUND
  (va `createRequire(...).resolve('typescript/bin/tsc')`). Lo mismo `tests/replay-envoltorio.test.ts`.
- El detector de voseo bueno vive en un test; `validarIA` usa la lista corta.

**De la primera tanda — antes de desplegar (HECHO el 08/10)**

- **Aplicar la 0223, la 0224 y la 0225 ANTES del deploy** (el código nuevo lee sus columnas y
  tablas) y, después del deploy, correr `npx tsx scripts/migrar-secuencias-a-grafo.mts --aplicar`.
  Lo decide Martín. `supabase/migrations/0223_flujo_grafo.sql` · `0224_crm_etiquetas.sql` ·
  `0225_setting_adjuntos.sql`.
- **Nada lo vio todavía un navegador.** Ni las cinco partes ni los arreglos levantaron un dev
  server (bootear local escribe en prod, y con `node_modules` como junction Turbopack no arranca).
  Falta mirar: los puertos y las filas de Condición y de «Si responde», el ＋ de cada salida vacía,
  el panel de 392 px con el composer, la nota de voz con link y el PDF con caption en su alto fijo,
  «Probar» abierto al editar una tarjeta, el error de Publicar abriendo su tarjeta, el popover del
  emoji y del clip sobre el panel, y el recordatorio con sus 7 tarjetas.

**Riesgos vivos**

- (Arreglado el mismo 08/10, ver la entrada siguiente.) `armarSecuenciasDeAudios` escribía
  `pasos` directo sobre las secuencias del onboarding.
- **El «aviso repetido» se detecta por el PREFIJO del resumen** (`AVISO_REPETIDO`, `lib/nutricion-grafo-motor.ts`), porque `aplicarEnElActo` no devolvía los `datos` de la acción. Desde `c4309144` (sesión API de MaKo) `ResultadoFlujo` trae `datos`: `avisar_al_equipo` puede devolver `{ salio: boolean }` y el motor leerlo de ahí en vez de comparar texto.
- **`resolverHandoff` reactiva a 'activa' sin `proximo_envio_at`**: la cola filtra con `lte` y un
  null no entra nunca. Bug previo, sin arreglar. `lib/chat-agent-handoff.ts` (`resolverHandoff`).
- **No hay forma de devolverle la charla a MaKo después de un hand-off**: `resolver_handoff`
  necesita una fila en `chat_agent_handoffs`, que el flujo no crea, y hoy sólo la reabre una
  reinscripción (`reactivarInscripcion` limpia la charla). Decisión de producto.
  `lib/chat-agent-handoff.ts` · `lib/nutricion.ts` (`responderConGrafo`).
- **Publicar una secuencia convertida no resuelve el hand-off vivo** (la segunda mitad de
  lienzo-1): una inscripción en 'handoff' publicada desde el lienzo antes del script queda sin
  salida; el script sí lo resuelve. `app/automations/SecuenciaPerfil.tsx` · `lib/nutricion.ts`
  (`setSecuenciaPasos`).
- **El merge de `setSecuenciaPasos` trata `variantes: []` como ausente**
  (`Array.isArray(p.variantes) && p.variantes.length ? … : variantesPrevias.get(…)`): la ✕ de la
  última variante no la borra. No se cambió porque antes hay que auditar a los diez escritores de
  `pasos`: uno que mande `[]` siempre borraría las variantes en cada guardado. `lib/nutricion.ts`.
- **`generarVariantes` saltea sólo `tipo === 'audio'`**: la acción «variantes» le puede volver a
  escribir variantes al caption de un archivo. `lib/secuencias-variantes.ts`.
- **`normalizar` renombra un `o0` viejo si se inserta un paso SIN id al principio**: el nuevo toma
  `o0`, el viejo pasa a `o0_2`, y una inscripción con `nodo_actual = 'o0'` seguiría al paso nuevo.
  Todo escritor que inserte pasos les da `nuevoId`. `lib/flujo-grafo.ts` (`normalizar`).
- **`inscribir_lead_secuencia` desde un «⚡ Acción» sigue reiniciando lo terminado**: es la «orden
  explícita» de la regla 3 y no usa `desdeFlujo`. Si Martín quiere el mismo freno, se pasa desde
  `lib/api-mako/areas/chatbot.run.ts` cuando `desdeUnFlujo(ctx)`.

**Arreglos que faltan**

- **«Probar» no lee la estrategia local**: `responderSimulador` lee de lo GUARDADO nombre, etapa,
  objetivo, gancho, preguntas y criterio; del lienzo sólo llega el caso. Haría falta un
  `opts.estrategia`. `lib/setting-simulador.ts`.
- **Los hand-offs pendientes**: abrir directo la tarjeta «Si responde» al entrar por el aviso (hoy
  `?sec=` sólo elige la automatización) y resolverlos al publicar un caso nuevo.
  `app/automations/SimuladorWhatsApp.tsx` · `app/automations/SecuenciaPerfil.tsx`.
- **El inbox oficial sigue con su copia del composer** (la tercera). `app/whatsapp/WhatsAppApp.tsx`.
- **El comentario del `maxWidth` del panel del nodo dice content-box y es border-box**, y el `+ 30`
  sobra. `app/_components/Lienzo.tsx` (cerca de la línea 746).
- **Las etiquetas**: la vuelta WhatsApp→MaKo (una rama `labels.association` en
  `app/api/webhooks/evolution/route.ts`) y la columna de línea en `evolution_labels`; y los avisos de
  /mensajes no cuentan el uso de una etiqueta (`usoDeEtiqueta`, `lib/etiquetas.ts`). El detalle, en
  [hallazgos-comunicacion.md](hallazgos-comunicacion.md) y [hallazgos-crm.md](hallazgos-crm.md).
- **El tope de 40 caracteres del nombre vive en dos constantes**: `TOPE_NOMBRE_SECUENCIA`
  (`lib/setting-estrategia.ts`) y `TOPE_NOMBRE` (`app/automations/SimuladorWhatsApp.tsx`).
- **La condición «Está en la etapa» ofrece sólo las etapas de venta de los productos con embudo**:
  no ofrece «la casa» ni las de entrega, porque `HechosLead` no las tiene. `app/automations/FlujoLienzo.tsx`.
- **El recordatorio**: lo que se borra queda sin borrador. (Cambiar de automatización con textos sin
  publicar ya pregunta desde el 10/10: «Restos de versiones anteriores, grupo recordatorio».)
  `app/automations/RecordatorioFlujo.tsx`.
- **El área `chatbot` de `/admin/dev` no apunta a este documento** (le falta `hallazgos:
  'hallazgos-chatbot'`). `app/admin/dev/areas.ts`.

## Octava tanda (10/10/2026, tarde): copiar y pegar, el lazo, el horario de oficina y el recordatorio en el motor

Lo hecho está en `b8af255e`, `37727baa` (el lienzo) y `c309b390` (el recordatorio). Acá lo que no se ve en el diff.

- **Un zoom borroso no era la resolución de nada: era `willChange: 'transform'` en la capa del lienzo.** Con esa
  pista Chrome pinta la capa una vez y estira el bitmap al cambiar la escala, así que al acercar el texto se
  ve lavado. Sin ella vuelve a pintar a la escala nueva. **Vive en:** `app/_components/Lienzo.tsx` (la capa).
- **El desplegable de la casa se salía de la pantalla por el costado** (el «Probar» pegado al borde): abría
  siempre desde el borde izquierdo del botón. Ahora, con el ancho MEDIDO en el segundo cuadro, si no entra se
  ancla al borde derecho. Arregla a todos los desplegables, no sólo a ése. **Vive en:**
  `app/components/Dropdown.tsx` (`place`).
- **«Si responde» no tiene padre en el dato, así que borrar su flecha no tenía qué borrar.** La flecha del
  CRON se DIBUJA (es lo que hace el motor), no es un puerto. Borrarla tuvo que ser una marca en el nodo
  (`suelta`): `raizRespuesta` la saltea, así que el motor deja de escuchar y Publicar la frena como a
  cualquier suelta; conectarla desde el CRON la saca. Y es la SEXTA puerta de `setSecuenciaPasos`: sin la línea
  en `camposDelFlujo`, guardar le devolvía la flecha. **Vive en:** `lib/flujo-grafo.ts`, `lib/flujo-edicion.ts`,
  `lib/nutricion-grafo-motor.ts`.
- **«Sacar una flecha no mueve nada» no se resuelve guardando posiciones relativas.** Las posiciones van
  relativas al CRON del árbol, y sacar una flecha puede correr el CRON mismo (`aOrigen`). Se fija cada tarjeta
  que CAMBIARÍA de lugar, contra el ancla del árbol NUEVO (`congelarPosiciones`); las que no cambian siguen
  acomodándose solas. **Vive en:** `lib/lienzo-posiciones.ts`.
- **Minutos entre dos mensajes no se pueden dormir.** El motor duerme las pausas adentro de la corrida (tope
  10 s): elegir minutos PARTE la tarjeta con una espera en el medio (`partirConEspera`). Martín lo confirmó el
  10/10 a la noche: **queda así**. **Vive en:** `lib/flujo-edicion.ts`, `app/automations/EditorMensajeWhatsApp.tsx`.
- **Un menú que cuenta lo elegido tiene que contar lo que la acción hace.** El CRON entra en el lazo pero no
  se copia ni se borra como tarjeta: el menú decía «Eliminar 3 tarjetas» y borraba 2. Lo vio el navegador, no
  un test. **Vive en:** `app/automations/FlujoLienzo.tsx` (`menuNodo`).
- **⚠️ La primera medición del lazo dio CERO y el lazo andaba.** El arrastre arrancaba en el rincón de abajo a
  la derecha, encima de «Publicar» (`data-no-pan`): el lienzo no lo toma, a propósito. Repetido desde el fondo
  vacío: lazo visible, 3 elegidas, la cuarta atenuada. Antes de diagnosticar un gesto, se mira DÓNDE empezó.
- **`next dev` en un worktree tropieza igual que el build** con el junction de `node_modules` («Symlink … points
  out of the filesystem root»): la misma raíz temporal en `next.config.ts`, y restaurarla después.
- **Leer el portapapeles pide permiso** (el aviso «Copiaste un flujo» al entrar y «Pegar lo copiado» del modal):
  sin permiso no aparece nada, y no se insiste. El «Ahora no» se recuerda por firma de la copia, en este
  navegador. Ctrl+C / Ctrl+V del lienzo usan los eventos `copy` / `paste`, que no piden nada.

Lo que quedó sin hacer, con su archivo:
- ~~La galería no tiene «Recordatorio de la reunión»~~ HECHO el 10/10 a la noche: ver «El recordatorio como
  plantilla», abajo.
- Arrastrar lo elegido con el lazo JUNTO (`app/_components/Lienzo.tsx`): hoy se mueve de a una.
- «Pídesela a MaKo» del modal no lleva el pedido escrito: crea la vacía y abre la caja (`app/automations/GaleriaPlantillas.tsx`).

## El recordatorio como plantilla (10/10/2026, noche, claude3)

Decisión de Martín, a la pregunta de qué hacer con el recordatorio de un negocio nuevo (la opción recomendada era
crearla sola al dar de alta, pausada): **«Ningún negocio tiene que arrancar con ninguna automatización creada, para
eso ya tenemos los templates. Solo ponlo como template.»** Y la espera en minutos que parte la tarjeta: «queda así».

- **Un CRON fijo NO puede entrar por `guardarDisparadores`, como las etapas: va en la FILA al insertar.**
  `setSecuenciaPasos` lee el `trigger_tipo` de la fila para decidir si exige la forma que el emisor del recordatorio
  sabe mandar (`toquesDeLaAutomatizacion`). Con el CRON puesto DESPUÉS de los pasos —que es como entra la etapa de
  las otras plantillas—, los pasos se guardan sin esa vara. Por eso `filaDePlantilla` escribe `cron.fijo` y la lista
  de CRON no se toca (roturas R28 y R33). **Vive en:** `lib/plantilla-crear.ts`.
- **Uno por negocio, y lo frenan los dos lados.** Con dos filas el emisor manda «la primera activa por cada minuto»
  (las marcas `claveToque` evitan el doble envío), pero la lista muestra dos recordatorios sin decir cuál sale. El
  server rechaza crear otro si hay uno sin archivar, y la galería lo dibuja apagado con «Ya la tienes en tu lista»
  (`yaLaTiene`, con el `trigger_tipo` de la lista que ya tiene la pantalla). Uno ARCHIVADO no cuenta: la lista no lo
  muestra. **Vive en:** `lib/plantilla-crear.ts`, `app/automations/GaleriaPlantillas.tsx`.
- **Sus datos del «{ }» no son los del motor.** `{{cuando}}`, `{{hora}}`, `{{faltan}}` y `{{link}}` los resuelve su
  emisor (`VARIABLES`, `lib/recordatorio-lead.ts`); el guard de la galería que mira el catálogo del motor los daba
  por inexistentes. Ahora los mira contra `VARIABLES` cuando el CRON es el del recordatorio, y uno del motor
  (`{{lead_nombre}}`) da rojo en tres tests (R31). **Vive en:** `tests/plantillas-automatizaciones.test.ts`.
- **Los pasos salen de la MISMA función que la mudanza** (`pasosDeLaConfig`, con los textos de fábrica y un prefijo
  de ids `rr_`): una segunda escritura de la forma del recordatorio se separaría de la que lee el emisor.
- **Nada del alta de un negocio crea automatizaciones** (medido con `grep` de los `insert` a
  `nutricion_secuencias`): los únicos son la galería, Duplicar, copiar entre negocios, la API de MaKo y
  `armarSecuenciasDeAudios`, que sólo llama `/api/chat-agent/onboarding/resumen` (sin llamadores) y la API.

Medido en producción (sólo lectura, 10/10 ~21:20):
- Las 10 filas del recordatorio están (#228 del ws1 PRENDIDA, #229-#237 pausadas) y **ninguna se tocó desde que la
  creó la mudanza**. De las 9 pausadas, sólo el ws11 tenía una configuración de antes, y estaba apagada y sin textos
  propios: **son 9 automatizaciones que esos negocios no crearon**, justo lo que la decisión de arriba dice que no
  tiene que pasar. **Martín: «Archivalos y los que te parezca ponlos como templates».** Las 9 eran idénticas a la
  plantilla (textos de fábrica, sin números propios, sin borrador ni posiciones, 0 inscripciones), así que no hay
  otra plantilla que sacar de ahí: se ARCHIVARON el 11/10 00:52 UTC (#229-#237, con compare-and-set sobre
  `activa`, `archivada_at` y `updated_at`). Para recuperar una: `archivada_at = null`. No cambia ningún envío: sin
  fila, el emisor lee la configuración de antes, que en esos negocios no existe o está apagada (ws11).
- **⚠️ El script de la mudanza las habría vuelto a crear.** `scripts/recordatorio-a-automatizacion.mts` crea la fila
  a todo negocio sin una SIN ARCHIVAR, así que una segunda corrida con `--aplicar` devolvía las 9. Ahora saltea al
  que no tiene nada propio que mudar (apagada y de fábrica); el simulacro da «creadas: 0».
- **Y lo mismo en el ws1** (Martín: «También con Mauricio... Archiva todas las que no haya pedido. Solo deja la de
  los audios que él ya grabó y el mensaje de MaKo de nueva agenda»): se archivaron la #220 (residuo +45 días), la
  #226 (felicitación al terminar clase) y la #227 (una vacía), todas pausadas y sin nadie adentro. Quedan
  prendidas las tres con SUS audios (#198 bienvenida, #212 y #213 post-agenda: audios 1, 5 y 7, grabados el
  02/08) y, con su «sí», el recordatorio #228. «Nueva agenda» es el aviso `reunion-nuevo-agendado` (🎯 Nuevo
  agendado), que no está en la lista del cliente y sigue prendido. Los otros Mensajes de MaKo de Mauricio NO se
  apagaron: a la pregunta contestó con la regla de abajo, no con un «apagalos».
- **Todavía no salió ni un recordatorio por el camino nuevo**: en toda la historia hay 3 marcas, las tres del ws1 y
  anteriores a la mudanza, y desde entonces no hubo reuniones. El primero real es el toque de 24 h de la reunión
  del 13/10 17:00 UTC (lead 2593): sale el **12/10 a las 17:00 UTC**. Ésa es la prueba de que el emisor lee la fila.

## Novena tanda (10-11/10/2026, claude3): el AI Step, el «⋯» de MaKo en WhatsApp y «Agendó» unificado

Pedidos de Martín: «Todo lo que hiciste de una cantidad impresionante de flujos y tarjetas eso justamente debería
estar en una nueva tarjeta que sea "AI Step". Configuralo allí» (eligió «una tarjeta con sus casos adentro»); «No
aparecen los 3 puntos para eliminar una automatización de "MaKo en WhatsApp"... deben ser EXACTAMENTE igual al
resto»; «Las dos automatizaciones de agendó se podrían unificar ya que se tiene justamente la tarjeta de CONDITION»;
y arrastrar el lienzo con el botón del medio. Código en `f2d4f25a` (botón del medio) y `18369310` (el resto).

- **El AI Step NO es una clase de nodo: es una FORMA del «Si responde»** (`paso_ia: true`, casos con
  `responder`/`sola`/`avisar`, `instrucciones`, `otra_aviso`). Una clase nueva tocaba ~15 archivos y duplicaba las
  reglas de «una por automatización, sin padre, sin esperas, sin paralelos»; como forma, `claseDe` sigue diciendo
  'respuesta' y las hereda. **El motor no se reescribió**: `expandirPasoIA` (pura, idempotente) lo devuelve a la
  forma de siempre en las puertas que RECORREN la respuesta (`responderConGrafo`, el simulador), así el
  clasificador, el borrador, la guarda de la plata y la charla de varios mensajes son los mismos. Lo que se GUARDA
  es la forma compacta. **Vive en:** `lib/flujo-grafo.ts`, `lib/nutricion.ts`, `lib/simulador-grafo.ts`,
  `app/automations/EditorPasoIA.tsx`, `lib/paso-ia-convertir.ts` (el «Pasar a AI Step»).
- **Los ids de la expansión llevan `~` a propósito** (`<nodo>~<caso>~r`, `~a`, `<nodo>~otra`): quedan fuera de
  `RX_ID`, así un flujo expandido guardado por error pierde sus flechas y Publicar falla RUIDOSO en vez de guardar
  tarjetas fantasma. Y son fijos: el motor guarda `nodo_id` y la clave del reclamo con ellos.
- **⚠️ La forma de siempre deja publicar un caso que no lleva a nada, y el motor se come la respuesta en silencio.**
  Sólo el AI Step exige que el caso conteste o avise (`faltaEnCaso`). Por eso **volver a un deploy anterior a
  `18369310` después de convertir datos es destructivo**: el motor viejo lee los casos sin nada debajo (MaKo deja
  de contestar y sólo avisa), y el primer guardado con el `camposDelFlujo` viejo borra `paso_ia` y las guías sin un
  error. Antes de un rollback, el respaldo que deja el script (`backups/novena-tanda-ws1-*.json`).
- **Un id de caso repetido era inofensivo y expandido es dañino**: la expansión deriva las tarjetas del id del caso,
  y el segundo contestaba con la guía del primero. Nace solo (un id inválido queda en '' y su `<nodo>c<k>` choca).
  El diagnóstico obvio —frenar al guardar— era el equivocado: el lienzo no muestra ids y nadie podría arreglarlo.
  Se desempatan solos (`idsDeCasos`). **Vive en:** `lib/flujo-grafo.ts`.
- **Proponer aceptaba y ejecutar fallaba**: enseñarle a un AI Step un caso sin guía (API `agregar_escenario_secuencia`
  o `resolverHandoff`) pasaba `preparar` y explotaba al confirmar. Ahora frena en `preparar` (AGENTS.md: lo que se
  puede saber sin escribir falla antes de la pendiente). **Vive en:** `lib/nutricion-grafo-motor.ts`
  (`agregarCasoAlGrafo`).
- **SIN DECIDIR (Martín):** plegar a AI Step pierde el texto PROPIO del aviso de cada caso (sale el título del caso +
  «Te escribió sobre esto.»): en la galería eran 5, p.ej. «coordina el nuevo horario». Y un caso que contesta Y
  avisa manda dos avisos (el del redactor y el del caso). Guardar el texto haría falta un campo más en el caso.
- **«⋯» de MaKo: Eliminar = OCULTAR + apagar, en ese negocio** (`oculto` en el store, `lib/plantillas-ocultas.ts`), y
  se recupera desde «Nueva automatización». ⚠️ **`oculto` no se hereda de la base y `enabled` sí**: ocultar o
  recuperar EN la base de la plataforma apagaría o prendería el mensaje para todos los clientes; está frenado en
  `ocultarPlantilla`/`restaurarPlantilla`. Duplicar y Copiar no se ofrecen para un mensaje (la copia de uno de
  fábrica no sale por el mismo evento). **Vive en:** `lib/plantillas.ts`, `app/automations/SimuladorWhatsApp.tsx`.
- **«Agendó» unificado:** en la galería, una plantilla con la condición «Ya le escribiste». En Mauricio, la #212 se
  archiva y la #213 pasa a tener los dos CRON de antes (`agendado_primer_contacto` en la columna y
  `agendado_ya_contactado`). ⚠️ **El ORDEN importa: archivar ANTES de sumar el CRON.** Con el CRON puesto y la #212
  viva, `enrolarPorEvento` inscribe al lead en las dos (la exclusión de familia se pregunta antes de insertar) y le
  llegan dos audios. Y la pantalla no ofrece los eventos de antes como CRON: si alguien borra el segundo, vuelve
  sólo por la API (`cambiar_crons_secuencia`) o el script.
- **Las escrituras de una secuencia no tienen compare-and-set** (`setSecuenciaPasos`, `renombrarSecuencia`,
  `archivarSecuencias`: update por id): un Publicar en paralelo a un script pisa sin error. Por eso el script de
  datos escribe con supabase-js y compare-and-set sobre `updated_at`, validando con las funciones puras.
  **Vive en:** `scripts/novena-tanda-ws1.mts`.
- **Una inscripción sin `nodo_actual` depende del ÍNDICE del array** (la 199 de la #198: `paso_actual` 1). Meter una
  tarjeta antes de ese índice la mueve de tarjeta sin error; los nodos nuevos van SIEMPRE al final.
- **El botón del medio**: cancelar el `pointerdown` no frena el auto-scroll de Windows (cuelga del `mousedown`), y
  el `pointerup` del medio tiene que salir antes del «clic quieto», que cerraba el panel abierto.
  **Vive en:** `app/_components/Lienzo.tsx`.
- Sin ver en el navegador: los altos de la tarjeta AI STEP y su panel, el «⋯» de los mensajes y el botón del medio
  con un mouse real (el auto-scroll no se dibuja en headless). Lo mira Martín.

## «MaKo en WhatsApp» = una automatización más (11/10/2026, claude3, `56581a3f`)

Martín, con enojo y después de pedirlo en varias tandas: «debe ser IDENTICO… quedaron cosas muy viejas que quiero que
las depreques. Todo ahora es lo mismo». Decidió «Todos arrancan vacíos» y nada de opciones nuevas («ya existe con lo
que hicimos de CONDITIONS y DELAY… Solo debes readaptar esas plantillas»). El diseño entero, en
`docs/diseno-mako-en-whatsapp-unificado.md`.

- **⚠️ El diagnóstico de fondo: se igualaba POR FUERA.** Tres tandas seguidas (quinta, novena, ésta) le agregaron a
  los mensajes un botón o un «⋯» de dos opciones encima de OTRO modelo (el store de plantillas, el lienzo de
  Notificaciones, su motor). Por eso «sigue todo distinto». La cura fue mudarlos al modelo de la automatización, no
  más paridad. Regla en la memoria (`mako-en-whatsapp-es-una-automatizacion`).
- **El molde es el del recordatorio de la reunión:** una fila con un CRON que el motor de nutrición NO inscribe
  (`aviso_mako`, el evento en el subtipo; `TRIGGERS_DEL_EMISOR`) y que corre su emisor de siempre
  (`emitirDelCatalogo` → `emitirPorEvento`, lib/aviso-evento.ts). Los 45 lugares que emiten avisos no cambiaron.
- **El `tipo` que se emite NO se puede cambiar:** el dedup (la cobranza: 120 días por cuota), el rótulo, el resumen
  y el feed cuelgan de él. Con otro tipo, el día del cambio se reenvían todas las cuotas vencidas.
- **Dos filas del mismo evento:** el dedup se reclama UNA vez por evento y cada tarjeta emite sin ventana propia; si
  no, la segunda fila la frena la ventana de la primera.
- **Una corrida dormida guarda una POSICIÓN, no una tarjeta.** Al editar el flujo mientras duerme, al despertar
  ejecutaba otra tarjeta (repetía la entrada de la cobranza con `{{cuota_dias}}` sin resolver). Ahora guarda una
  firma de los pasos y se corta si cambiaron. ⚠️ Las corridas de los flujos del STORE (p.ej. `cuota-por-vencer`)
  tienen el mismo problema y no se tocaron (hoy hay 0 corridas). **Vive en:** `lib/flujos.ts` (`retomarCorrida`).
- **«No pude leer al lead» gastaba el dedup** (la CONDITION lo leía como «no cumple» y la corrida terminaba): ahora
  reintenta 3 veces cada 5 min sin gastar la ventana. Y «Lo que arma MaKo» (`{{mensaje_mako}}`) no va después de un
  DELAY: es la foto de ese momento.
- **Duplicar perdía los CRON** (la lista blanca `COPIA` no incluía `disparadores`): arreglado para las filas del
  emisor. **Vive en:** `lib/secuencia-duplicar.ts`.
- **SIN HACER:** `lib/nutricion-desenlace.ts` (`encadenar`) y `lib/api-mako/areas/chatbot.run.ts` (~785) todavía
  dejan apuntar a una fila del emisor como siguiente automatización; el motor la cancela en el tick siguiente, pero
  queda contada. El dry-run la muestra como «acción».
- **Consecuencia que se avisó:** desde el deploy, «aviso antes de la reunión», «un lead te escribió» y «cuota vencida»
  dejan de salir en los 10 negocios hasta que cada uno agregue su plantilla. El ws1 recibía 7 y 3 en 30 días.

## Décima tanda (11/10/2026, claude3)

Siete partes en paralelo, una revisión adversarial de motor y datos y el cierre. El pedido, textual, en
`app/admin/dev/chatbot/bitacora.ts` (11/10, 04:30). Lo que no se ve en el diff:

- **Un freno de «no cambia lo que se contesta» compara lo que lee el REDACTOR, no sólo el clasificador.** La migración
  del AI Step ponía en cada caso el objetivo de la tabla de §8.4 y `loQueContesta` daba igual (nombre, «cuándo», guía,
  «sale sola»), pero el objetivo viaja aparte al redactor (`bloqueEscenario`): con `--aplicar`, la #213 del ws1 (activa,
  dos casos que salen solos) contestaba otra cosa. El diseño se contradecía (§8.4 contra §10-A). Lo migrado NO lleva
  objetivo (se imprime como sugerencia) y el freno compara objetivo, ejemplos, audio y «hasta». **Vive en:**
  `lib/ai-step-migrar.ts`, `scripts/ai-step-v2.mts`.
- **El repo tiene DOS zonas por defecto:** `ZONA_SIN_CONFIGURAR` (Ciudad de México, `lib/nutricion-grafo-motor.ts`) y
  `TZ_DEFAULT` (Tijuana, `lib/timezone.ts`). Al sumar el horario de oficina, «Contesta sola» saltó de una a la otra y en
  el ws1 (sin `mako.timezone`, horario 9-21 prendido) la ventana se corrió una hora, dos desde el 1/11. El diagnóstico
  obvio era «el horario está mal»: estaba bien. Volvió a `tz` (`tzActual`). **Vive en:** `lib/nutricion.ts` («4.5) ¿SALE
  SOLA?»). ⚠️ SIN DECIDIR: el resto del motor ya manda con el horario en hora de Ciudad de México al ws1, que es de Baja
  California: o se guarda su `mako.timezone`, o se unifican los dos defaults. **Resuelto en la undécima** (un default y una lectura):
  `docs/hallazgos-infra.md` → «Una zona, un default, una lectura».
- **Lo de fábrica no se valida contra el rango de lo que se ELIGE.** `limitesDeFabrica` respeta un env fuera de rango
  a propósito y `limitesParaGuardar` lo rechazaba igual: con `NUTRICION_MAX_POR_DIA` > 150 no pasaba ningún guardado
  (el env de prod no se pudo medir). **Vive en:** `lib/limites-envio.ts`.
- **Dos clasificadores sobre las mismas palabras: el arreglo de uno rompe al otro.** La agenda se llevaba «créame una
  automatización que le escriba a los que no vinieron a la reunión»; la regla nueva, puesta antes, se llevó «Quiero una
  reunión sobre el flujo de ventas» y «Haz el flujo de caja». Entre el verbo y el sustantivo no puede haber otro objeto
  de agenda, y «flujo de caja / efectivo / fondos / dinero» no es un flujo. **Vive en:** `lib/mako-intencion.ts`.
- **El typecheck acotado a «mis archivos» no ve los tests de otro:** quedaron cuatro errores de la tanda —
  `useState<función>(() => (b) => …)` deja `b` sin tipo, un `rol: 'setter'` que `Rol` no tiene, el estrechamiento de
  `p.cron` perdido en un callback, un `gating` opcional—. Y un enchufe del reparto por archivo: «MaKo en WhatsApp» seguía
  en el panel de control de 280 (`editorDeTarjeta`, `lib/lienzo-grafo.ts`; /mensajes ya lo medía como un mensaje).
- **Filtrar el selector no corta un remitente.** El ws1 tiene guardados el remitente y el dominio de MaKo: el corte real
  va en el motor (`procesarEnvios`, junto al sandbox: «remitente de MaKo: conecta tu email», un reintento por día) y en
  /integraciones, que seguía diciendo «Conectada». **Vive en:** `lib/nutricion.ts`, `lib/integraciones.ts`.
- **La propuesta para el CRON de antes cerraba un círculo** en 24 de 32: un paso sin `siguiente` sigue por el de abajo
  del array, y la entrada se agregaba al final de una lista vieja. Se normaliza ANTES. **Vive en:** `lib/cron-de-antes.ts`.
- **Lienzo y editores, medido:** `flex: 1` con `minHeight` deja encoger el recuadro bajo su contenido (va `flex: 1 0
  auto`); un tacho que cuelga 9 px en una caja `overflow: auto` da scroll lateral (`AIRE_ESQUINA`); la rueda hacía zoom
  en los paneles porque el listener no pasivo del lienzo hace `preventDefault` de todo (`queHaceLaRueda`); el cleanup de
  un efecto ve el primer render (va por refs); la grabación se perdía al recargar (`VoiceRecorder.tsx`, por trozos).
- **Herramientas que mintieron:** `sed -i` de Git Bash pasó dos archivos CRLF a LF; un argumento que empieza con `//`
  se reescribe (TS1161); un heredoc con comillas dobles ejecutó backticks; Edit escribe ` ` como espacio duro; los
  guards con `git ls-files` no ven lo nuevo (índice temporal: `GIT_INDEX_FILE` + `git add -N`).

**SIN HACER:**
- Datos, en orden: la mig `0251_setting_audios_origen.sql` ANTES del deploy (verificar el número contra las 0249/0250
  de otras sesiones); `scripts/mudanza-nuevo-agendado.mts --aplicar` antes del push (sin eso ws1 y ws13 se quedan sin
  «nuevo agendado»); deploy; `scripts/ai-step-v2.mts` simulacro y `--aplicar` DESPUÉS (volver atrás luego es
  destructivo). `scripts/migrar-cron-de-antes.mts` se niega a `--aplicar`: falta la fase 1 del motor.
- Al commitear, `git rm` de `HorarioBoton.tsx`, `HorarioLista.tsx` y `tests/automations-horario.test.ts`: si no,
  `funnel-estructura` y `motor-tick` dan ENOENT (leen el índice).
- `app/_ui/BotonMako.tsx` (la estrella chica del ✦), `EditorCondicionDeRespuesta` sin el layout nuevo
  (`app/automations/EditorCondicion.tsx`), el chip «Sin conectar» del CRON (`FlujoLienzo.tsx`, `CuerpoCron`), el AI Step
  por Instagram/Messenger (§6), «Escuchar» en `PanelProbar.tsx`, `armar_ai_step` en la API, el filtro por medio
  (`lib/chatbot-lista-filtro.ts`), las props muertas `claseInicial` (`EditorDisparadores.tsx`) y `graphify update`.
  Nada se abrió en el navegador: lo revisa Martín.

**DECISIONES TOMADAS POR MARTÍN, a confirmar:** lo migrado sin objetivo (§10-A); «Contesta sola» en `tzActual`; el
editor de «MaKo en WhatsApp» con el tamaño del de WhatsApp pero **sin audio, archivos, varios mensajes ni ✦** (el pedido
dice «las mismas opciones»); el email de MaKo no sale y /integraciones del ws1 dice «falta» (Mauricio sin emails hasta
vincular su dominio); al salir del editor la barra pasa a burbuja; «Descartar cambios» sin preguntar si está abierta;
0 en «por persona» = siempre borrador; Publicar frena aunque esté pausada; el tutorial se abre solo a un admin la
primera vez que ve un lienzo; Instagram y Messenger sin AI Step en la galería; el evento de antes no se ofrece en el CRON.

## El CRON «Pagos» y el aviso «Entra un pago» (11/10/2026, la pasarela de pagos)

- **«Pagos» es un BOTÓN PROPIO de la primera pantalla** (decisión de Martín, elegida entre dos opciones):
  siete botones van en una grilla de **4+3**, nunca 3+3+1 (un botón solo en una tercera fila se ve roto).
  `esClaseDeEventos` reemplazó las tres copias de «instagram || messenger || email» (editor, API).
  **Vive en:** `lib/disparadores.ts` · `app/automations/EditorDisparadores.tsx` · `tests/editor-disparadores.test.ts`.
- **Lo emite la pasarela DESPUÉS de asentar el pago en el CRM** (`enrolarPorPago`, `lib/pago-entrante.ts`):
  con `fecha_primer_pago` ya escrita, `esLeadCliente` da true y el WhatsApp sale solo, no como borrador.
  Y un lead que entra pagando NO dispara `lead_nuevo` («dejó el formulario sin agendar»).
- **«Se aprueba un pago» corre UNA vez por lead**: la inscripción es única por (lead, automatización), así
  que la bienvenida sale con el primer pago y no con cada renovación de una suscripción.
- **«Entra un pago» es el quinto Evento de MaKo** (`pago_recibido` → `pago-recibido`, `textoDelCodigo`):
  sale sólo si el negocio agrega «Aviso de pago recibido» (`mako-pago`) de la galería. En una venta de
  MaKo, el texto dice cómo quedó el alta de la cuenta. `tests/plantillas-viejas.test.ts` cruza el aviso
  contra su emisor (`lib/cobros.ts`): sin emisor queda rojo — y así quedó en la rama de Automations hasta
  juntarla con la pasarela.
- **`disparadores-canales` suma `pagos`**: «conectado» es tener Stripe o Mercado Pago con lo que MaKo
  deriva (sin el aviso registrado, un pago nunca llegaría). Un test que arma `EstadoCanales` a mano
  (`tests/editor-disparadores.test.ts`) se rompe en el TYPECHECK, no en la suite: `npm test` no chequea
  tipos. **Vive en:** `lib/disparadores-canales.ts`.

_11/10/2026 — `tests/disparadores-pagos.test.ts` (6, probado con 3 roturas)._

## Undécima tanda (11/10/2026, claude3): un flujo por categoría, un AI Step por objetivo, nada inventado

El pedido, textual, en `app/admin/dev/chatbot/bitacora.ts` (11/10, 14:38), con las cuatro decisiones de la décima (12:38).
El diseño, en `docs/diseno-undecima-tanda.md`. Diez paquetes en cuatro olas, un enchufador y el cierre, en el worktree
`C:/dev/wt-undecima` (rama `undecima`). Lo que no se ve en el diff:

**El AI Step: un nodo, el saneo y los atajos**

- **⚠️ Un campo que se MUDA del caso al nodo se pierde en el saneo, no en el modelo** (el diagnóstico obvio era el
  equivocado). El diseño decía «el saneo del caso deja de escribir objetivo/audio/ejemplos»; hecho así, se borraban al
  guardar, porque `setSecuenciaPasos` arma lo limpio con `camposDelFlujo` ANTES de juntar (`grafoAGuardar` →
  `juntarPasosIA`). Regla: el campo se SUBE en el saneo, y lo que juntar tiene que plegar o reportar no se borra ahí.
  **Y se buscan los atajos de antes:** `vozDeAIStepQueFalta` salía con null mirando sólo `c.audio` antes de llamar a la
  regla pura: con la voz en el nodo, Publicar nunca frenaba por la voz y los tests de la regla seguían verdes.
  **Vive en:** `lib/nutricion-grafo-motor.ts` (`camposDelFlujo`), `lib/nutricion.ts`.
- **Sacar tarjetas del array corre los índices.** Sin ids ni `siguiente` explícitos, las de después cambian de identidad
  (`o<i>`) y de salida («la de abajo»), y una inscripción guarda una POSICIÓN. `juntarPasosIA` normaliza antes de quitar,
  y el script de prod deja los ids viejos en su índice y agrega al final (frena si algo se corre). En #213 las tres
  quitadas eran las últimas. **Vive en:** `lib/flujo-grafo.ts`, `lib/undecima-flujos-plan.ts`.
- **Una sola puerta para la libertad** (`libertadesPermitidas` + `juntarPasosIA`). Una rotura con 0 rojos destapó que el
  corte de plata del conversor (`lib/paso-ia-convertir.ts`) era código muerto: una copia de una regla es código que
  ninguna rotura detecta.
- **«Crear con IA» rompía TODO flujo con AI Step** desde que Publicar exige el objetivo: `lib/flujo-ia-crear-core.ts`
  valida la salida del modelo a nivel Publicar, toda la cascada fallaba y el reintento citaba un id que el modelo no
  conoce. Regla: una regla nueva de Publicar entra al contrato de la IA en la misma tanda (prompt, `deIA` y `validarIA`
  con las palabras del modelo).
- **`Partial<…>` es un tipo débil:** el DTO de la pantalla (`CamposDelFlujo`, `ChatAgentApp.tsx`) y el tipo de la fila
  (`PasoSecuencia`, `lib/nutricion.ts`) no declaraban objetivo/audio/ejemplos y todo compilaba. Sólo una línea de tipo
  que lo exija lo protege (`tests/automations-paso-ia-revision.test.ts`).

**El recordatorio adentro del flujo (el carril)**

- **⚠️ El «1 h antes» de una reunión temprana no salía**, aunque el carril corre fuera de horario. Lo obvio (equivocado):
  la tolerancia o el horario. Causa: el tick sólo mira las filas cuyo `proximo_envio_at` venció en los últimos 10 min, y
  con hilos esa columna resume el hilo MÁS VIEJO: uno frenado (fuera de horario, anti-ban, cupo) la deja clavada y tapa al
  del recordatorio. Regla: un hilo que tiene que salir a horario no comparte fila con uno frenado sin aplazarlo
  (`aplazaParaNoTapar`, 15 min). Y el tick filtraba `estado = 'activa'`: lo que vive en 'respondio' le era invisible
  (`ESTADOS_QUE_SE_MUEVEN`). **Vive en:** `lib/nutricion.ts`, `lib/nutricion-grafo-motor.ts`,
  `app/api/cron/nutricion-tick/route.ts`.
- **Una respuesta apagaba los recordatorios por DOS caminos:** `pausarPorRespuesta` pasaba la inscripción entera a
  'respondio' (ahora `alResponder` deja vivos los hilos del carril), y #213 tiene `desenlace.logrado = 'respondio'`, así
  que el evaluador la cerraba como lograda la hora siguiente (`desenlaceEsperaAlCarril`). Además una 'respondio' no se
  reusaba: quien contestaba y reagendaba se quedaba sin el «Nuevo agendado» (`soloQuedaElCarril`).
- **El anti-ban se comía el «15 min antes»**: sale 45 min después del «1 h antes» y el freno deja 3 h entre mensajes. El
  carril no pasa por el anti-ban ni por los topes (`pasaPorAntiBan`), pero sus envíos SÍ entran en la cuenta diaria y
  horaria de la línea para los demás mensajes (~2 por día en el ws1).
- **`{{hora}}` no es el mismo dato en dos emisores.** En el del recordatorio (`VARIABLES`, `lib/recordatorio-lead.ts`) es
  la hora de la REUNIÓN; en el catálogo del motor, la del MOMENTO. Los textos de #228 copiados tal cual decían otra hora.
  Un texto que viene de otro emisor se traduce dato por dato, y lo que no está en el mapa frena (`MAPA_RECORDATORIO`).
- **La reserva entra al instante a su etapa** (M1): `enrolarPorEvento('agenda_nueva')` suma los CRON de la etapa
  efectiva. Lo que la ficha carga a mano tiene su propia trampa, en [hallazgos-crm.md](hallazgos-crm.md).

**Los flujos de producción**

- **⚠️ #238: «la lista `disparadores` le gana a la columna» era falso, y el diagnóstico obvio se equivocó DOS veces.** El
  relevo dijo «manda la columna» y el arquitecto lo «corrigió». El motor saca el PRIMER CRON siempre de las columnas
  (`disparadoresDe`/`listaDe`, `lib/nutricion.ts`) y la lista sólo suma del segundo en adelante. Regla: qué dispara una
  fila se le pregunta a `disparadoresDe(fila)`, nunca al jsonb crudo.
- **Los borradores viejos pisan lo rehecho:** #198 tenía `pasos_borrador` y #213 `posiciones` de la forma anterior, y
  «Publicar» desde el lienzo devolvía lo viejo. El script los pone en null.
- **La galería ya traía lo que Martín rechaza:** `bienvenida-sin-agenda` era CONDITION → DELAY → CONDITION y
  `agendo-preparar` CONDITION → CONDITION; #198 nació de ahí. `problemasDeForma` (`lib/flujo-forma.ts`) cuida ahora la
  galería, «Crear con IA» y el script.
- **El ws13 no tiene etapa de no-show:** #224 se archiva (un CRON «(de antes)» se rehace sólo si el embudo tiene la
  etapa). Y su fila nueva nace PAUSADA, pre-siembra sus 9 leads de «Pre R1» y recién ahí se prende: prendida al
  insertar, el barrido podía mandar 9 «Nuevo agendado» viejos al grupo del cliente.

**Datos y tokens**

- **El renglón opcional se lleva el renglón ENTERO.** Con «{{pago_tipo}} · {{pago_modo}}», cada pago real (sin modo)
  perdía «Primer pago». Un dato opcional por renglón. «Sin valor» = la clave no está; '' cuenta como valor (si no,
  «Hola {{nombre}}, …» con nombre '' se comía el saludo). ⚠️ Y una lectura que FALLA ahora borra el renglón en silencio,
  porque el mapa de valores no distingue «no tiene» de «no pude leer» (antes salía crudo y se notaba). SIN HACER:
  marcar en el resolvedor lo que no pudo leer (`lib/variables-resolver.ts`).
- **`{{ mensaje_mako }}` con espacios no lo ve `tokensDe`** (`RE_VARIABLE` es estricto) y `aplicarVariables` sí lo
  resuelve: un validador de token prohibido armado con `tokensDe` deja pasar justo lo que el motor manda. Se busca con el
  regex del motor (`lib/tokens-del-flujo.ts`). Y `limpiarTexto` de «Crear con IA» borraba todo dato fuera de los 5 del
  motor (también los de «Próxima reunión»), y su llave suelta no aceptaba dígitos (`lead_hora_r1`).
- **Un Evento de MaKo que se retira no se borra ni se apaga:** fuera de `EVENTOS_MAKO`, #239/#240 dejan de salir; con
  `apagado`, no se pueden guardar. Es `retirado` + `EVENTOS_MAKO_OFRECIDOS`, que quedó HUÉRFANO hasta el enchufe: el
  selector del CRON seguía ofreciendo «Un lead agenda». Escribir la salida no es ofrecerla.
- **Un ciclo de imports que sólo falla según quién cargue primero:** `flujo-conversacion → tokens-del-flujo →
  aviso-evento → disparadores → flujo-conversacion`, con `aviso-evento` evaluando `EVENTOS_MAKO` al cargar. Los tests de
  flujo-conversacion pasaban e `import('lib/disparadores.ts')` tiraba «Cannot access 'EVENTOS_MAKO' before
  initialization». Regla: `lib/flujo-conversacion.ts` sólo hace `import type` de esos dos (`frenoDelFlujo` recibe los
  problemas calculados), y antes de importar algo que llega a disparadores se prueba
  `node --import tsx -e "import('./lib/disparadores.ts')"`.
- **Sumar contexto al user de «Crear con IA» deja a Groq fuera de la cascada, sin error.** Subir `TOPE_TARJETAS_IA` a
  30 parecía cambiar un número, y la salida mínima está calibrada para ~20 tarjetas: quedó en 25. Todo lo que se sume
  pasa por `entraEnGroq` (`lib/flujo-ia.ts`); la calibración es `tests/crear-ia-tercera.test.ts`.

**La tarjeta «MaKo en WhatsApp» y la Voz de MaKo**

- **«Le avisé al equipo» sin grupo:** `emitirAviso` devuelve `ok: true` aunque el WhatsApp no salga. Detalle en
  [hallazgos-comunicacion.md](hallazgos-comunicacion.md) → «Undécima tanda».
- **El cambio del editor va DENTRO del updater** (`onPasos(prev => …)`): al salir del editor llegan dos cambios en el
  mismo tick (la barra y el audio), y con los params del render el segundo pisaba al primero.
- **Editar una tarjeta de antes la pasa a TAL CUAL**: pierde el envoltorio (título, teléfono, link, «— MaKo») y el dedup
  de 12 h. La `ne9jyr0` de #213 está así hasta que corra el script, que la reescribe con los datos a la vista.
- **⚠️ Sin la mig 0257, generar la voz SÍ cobra** (el diseño §8.2 decía que no): el insert va después del TTS. `crearAudio`
  borra el binario huérfano y la 0257 va antes o junto con el deploy. La key es `MAKO_ELEVENLABS_API_KEY`, no
  `ELEVENLABS_API_KEY`: ws9/10/11 tienen ElevenLabs BYOK y la hidratación podría dejar la de un cliente en la env de
  siempre. Y el error no dice «tu cuenta» (`textoFalloVozMaKo`): esa voz la paga la plataforma.

**La lista**

- **Un campo sembrado de la prop + una SEGUNDA puerta que escribe el mismo dato:** con «Renombrar» desde la lista y la
  automatización abierta (mismo `key`), el título de `SecuenciaPerfil` quedaba viejo y un clic + blur volvía a ESCRIBIR el
  nombre anterior. Se re-siembra al dibujar cuando cambia la prop y no se está editando.
- **Un test de selector que no podía caer:** `loQuePide` (`tests/automations-recorrido.test.ts`) no pedía las clases
  (`(?<![\w-])\.` nunca coincide en `tag.clase`). Al simplificar un selector, romperlo y ver caer el test.
- Renombrar un id ARCHIVADO funcionaba y uno ajeno contestaba «ok» sin cambiar nada: ahora los dos dan 404.

**Herramientas**

- `grep $'\r'` del Git Bash dijo LF en archivos CRLF: el worktree tiene `core.autocrlf=true` y TODO `lib/` y `tests/`
  sale CRLF. Se mide con node o con `grep --binary`. Edit conserva el CRLF; Write escribe LF (git lo normaliza).
- Un typecheck que espera turno puede leer el árbol en medio de una rotura: se vuelve a correr con los archivos quietos.
- `mock.module` de node:test prueba `server-only` de punta a punta (`--conditions=react-server
  --experimental-test-module-mocks`): hay que sacar `default` del namespace que se mockea y cargar
  `lib/api-mako/runners.ts` antes que un `areas/*.run.ts`. Molde: `tests/voz-mako.test.ts`, `tests/zona-negocio.test.ts`.
- Retirar un script con un `process.exit(1)` suelto arriba hace que TypeScript tome el resto como `never` (222 errores):
  se retira con una función `void` (`retirado()`).
- Borrar un archivo trackeado rompe los tests que recorren `git ls-files` (ENOENT) hasta el `git rm`.
- Los tests que fijan una línea exacta o un TOPE de largo de un recorte (nutricion-canal 5000 → 6500,
  flujo-aviso-accion 2500, seis que fijaban `preparaUnaReunion(sec.trigger_tipo)`) se rompen con cambios que no les
  tocan: se escriben con margen y anclados a una función, no a una línea.
- Un campo «para la pantalla» que nadie lee pasa todos los tests (`propio` del dominio, `PasosInvalidosError.tarjeta`):
  sólo un grep de lectores lo ve.

**SIN HACER (con su archivo):**
- Datos, en orden y todos en simulacro: mig 0257 antes o con el deploy → deploy → `scripts/zona-negocio-backfill.mts` →
  `scripts/undecima-email-remitente.mts` → `scripts/voz-mako-agregar.mts` (después de pagar ElevenLabs y cargar
  `MAKO_ELEVENLABS_API_KEY`) → `scripts/undecima-flujos.mts`, mejor antes del 12/10 17:00 UTC (primer toque real).
  Ninguno corrió `--aplicar`.
- La limpieza §8.7, en commit aparte después de `--aplicar`: la compatibilidad de `{{mensaje_mako}}` (también
  `CLAVE_MENSAJE_MAKO` en `app/_components/CampoConDatos.tsx`), el emisor del recordatorio, `DATOS_RECORDATORIO` en
  `FlujoLienzo.tsx` y `TRIGGER_RECORDATORIO` de `TRIGGERS_DEL_EMISOR`. Los campos `@deprecated` del caso del AI Step se
  van cuando una medición diga «0 filas con la forma de antes» (`lib/flujo-grafo.ts`).
- «Tiene una duda» no está en `ESCENARIOS_TIPICOS` (`lib/ai-step-escenarios.ts`): `lead-tuvo-reunion` y
  `cliente-empezo` salen sin él. Agregarlo es inventar texto: lo decide Martín.
- El Recurrente al grupo manda los textos de las partes pero no los binarios (`lib/disparadores.ts`
  `textosParaElGrupo`, `lib/nutricion.ts` `mandarRecurrenteAlGrupo`).
- Sin guarda para un email o un borrador que quedan vacíos por el renglón opcional (`lib/nutricion.ts`), y el HTML del
  email no recorta (`sinRenglonesVacios`).
- Una R2 no inscribe al instante (`app/api/webhooks/{calendly,calcom}/route.ts`, rama j2); un «Ir a» desde el AI Step o
  el destrabe de `requiere: 'respondio'` dejan `hilos` en null y apagan el carril de una 'respondio'; lo aplazado sale
  hasta 15 min después de la apertura (`lib/nutricion.ts`).
- La CONDITION «Próxima reunión ≤ N h» sigue laxa y el ancla del DELAY es estricta (`lib/nutricion-grafo-motor.ts`):
  igualarlas es una decisión. `u11aviso` cuelga del CRON sin esa condición: un lead sin reunión futura perdería el primer
  renglón del aviso.
- `--restaurar` del script de flujos no deshace las pre-siembras 'completada' (`scripts/undecima-flujos.mts`).
- «Pídele un cambio» no suma escenarios al AI Step (`lib/flujo-ia.ts`, `deIAEdicion`); el AI Step de Instagram y
  Messenger (`MEDIOS_OFRECIDOS`, `EditorPasoIA.tsx`); el alto del editor con 10 escenarios (`lib/lienzo-grafo.ts`); el
  lint `react-hooks/refs` en `app/_components/CampoConDatos.tsx:340-349`.
- No medido: Evolution mandando un mp3 a un @g.us, ni la plataforma hablando con «David». El ws3 no tiene grupo de MaKo:
  se crea antes de probar ahí (nunca en el ws1).
- Nada se abrió en el navegador: lo visual lo mira Martín.

_11/10/2026 — cierre de la undécima: typecheck limpio; suite entera 8190 tests: 8186 pasan, 3 fallan (de MaKo Mobile,
ya en HEAD: `confirm-encima-de-modales`, `mover-etapa-validacion`, `plan-filtro-cliente`), 1 skip. El cuarto rojo era de
la corrida (un «acá» en el `context` de `chatbot.crear-ia.system`) y lo arregló el cierre._

## Duodécima tanda (12/10/2026, claude3): Crear con IA respeta el canal y el catálogo, el chat de MaKo, Instagram

El pedido, textual, en `app/admin/dev/chatbot/bitacora.ts` (12/10, 01:50): la prueba con Fiesta Music (ws10). El diseño,
en `docs/diseno-duodecima-tanda.md`. Once paquetes en dos olas y la cosecha (corrida `wf_ec999673-272`, worktree
`C:/dev/wt-undecima`). Lo que no se ve en el diff:

**Crear con IA: lo que el modelo ve y lo que puede devolver**

- ⚠️ **El diagnóstico obvio era el equivocado: las etapas de Entrega SÍ le llegaban al modelo**, y en vivo
  (`productosConEtapas`). Lo que NO le llegaba eran las clases del CRON que se sumaron después (Instagram, Messenger,
  Email, Pagos, «se agrega / se quita etiqueta»): `armarContexto` armaba las opciones con `seccionesDisparo`. Y las
  condiciones no se filtraban por ámbito. El «Onboarding» de ws10 está en dos productos (39 y 10): faltaba una PREGUNTA,
  no opciones. Regla: el modelo ve lo que arma el desplegable (`opcionesCronIA`, con `eventosParaIA` = `eventosOfrecidos`
  sin los apagados), y una clase nueva entra sola si está en `CLASES_DISPARADOR` y `eventosDe`. **Vive en:**
  `lib/disparadores.ts`, `lib/flujo-ia-crear.ts`.
- **El canal lo perdía el CÓDIGO, no el modelo** («le dije Instagram y lo hizo por WhatsApp», #243). `nodoDe` convertía
  en WhatsApp todo lo que no fuera email, sin aviso, y `PasoIA.canal` sólo admitía esos dos. Ahora el canal del pedido lo
  decide `canalDelPedido`: gana la palabra FUERTE por el orden de `PALABRAS_CANAL`, no por la posición en el texto, y
  «historia» sola NO es Instagram («la historia de mi negocio»). `validarIA` frena WhatsApp al lead en un flujo social, un
  DM con un CRON de otro canal, un DM bajo «Si responde» y uno después de más de 24 h. Un flujo social va sin «Si responde»
  ni AI Step, porque el AI Step contesta por WhatsApp (`asistirRespuesta` sin `medio`). **Vive en:** `lib/flujo-ia.ts`.
- **#243 y #245 los escribió gemini-flash-lite, no Groq.** `pasada` llamaba a la cascada sin `sinRespaldoDeModelo`, y
  `modelosAProbar` suma los respaldos del MISMO proveedor antes de pasar al siguiente. La pasada y la reparación del JSON
  van con `sinRespaldoDeModelo: true`, y editar lleva su propio `motivo`.
- **El CRON de la IA entraba por otra puerta** (`setTriggerSecuencia`, sólo las columnas), y la lista `disparadores` de la
  0241 quedaba en NULL. Ahora entra por `guardarDisparadores(id, disparadorDeValorIA(valor))`, la de la pantalla. Las
  columnas no tienen `subtipo`: el evento vive sólo en la lista, y el 409 y editar la leen (ver «El enchufe»).
- **«Pagó» con un CRON de entrega, y unas «cuotas» que nadie pidió.** Las FILAS escritas a mano del system eran todas de
  adquisición, `filaDe` nunca llamaba a `seOfrece(def, ámbito)`, y la fila «Pagó» dibuja sola «Cuota [Cualquiera]». Ahora
  vale sólo lo que da `seccionesDeCondiciones(ámbito, catálogo)` con el catálogo del editor (`catalogosDe`, mudado a
  `lib/condiciones-catalogos.ts`). El ámbito sale de resolver el CRON PRIMERO: `entrega:` es entrega, y sin CRON vale la
  intersección. Una condición de lista se elige por NOMBRE EXACTO o se va con aviso, nunca «la más parecida». ⚠️ Un `deIA`
  sin disparador ahora saca «Agendó» o «Está en la etapa», y sin `catalogoCondicion` no se ofrece «Está en la etapa». Una
  herramienta que no está en el perfil ni en el pedido («Ya procesamos tu pago en Stripe») es un error para el reintento.
- ⚠️ **El presupuesto de Groq: el diseño medía mal.** Pedía que `entraEnGroq` siguiera en true con `ctxGrande`, y ya era
  false en HEAD (~3.793 > 3.700). Ahí manda el techo de la cascada: prompt + 3.000 ≤ 7.000. Para pagar lo nuevo se sacaron
  las filas del system, el bloque «ETAPAS» (repetía DISPARADORES) y las etiquetas ya listadas: quedan 47 tokens de aire.
  **Quien sume algo al prompt de crear lo paga** (`tests/crear-ia-tercera.test.ts`). En editar, el bloque DISPARADORES
  entero pesa ~862 tokens y deja a Groq afuera (~4.293): va sólo si el pedido habla del CRON (`RX_PIDE_CRON`; «cuando»
  suelto no alcanza). Y `bloqueDisparadores` ya no corta en 80 sin decirlo: las opciones nuevas iban al final, y eran
  justo las que se perdían.

**Editar: cambiar, quitar y volver a poner**

- **«Esa tarjeta no puede abrir otro camino a la vez»: editar sólo AGREGABA.** El system decía «NUNCA cambias ni
  borras», y «cambia WhatsApp por Instagram» colgó en paralelo una COPIA por WhatsApp (#245). Ahora el orden es quitar
  (`borrarNodo`, el del lienzo), cambiar (conserva el id), el canal POR CÓDIGO (`cambioDeCanal`) y agregar. Una copia de
  un mensaje que ya existe (misma huella) no se agrega en un cambio de canal. **Vive en:** `lib/flujo-ia.ts`
  (`deIAEdicion`).
- ⚠️ **Volver a pasar una tarjeta GUARDADA por `nodoDe` la rompe**, y era lo obvio. `aIA` recorta a 300 con «…»,
  `limpiarTexto` borra las URL (el link de agenda) y un monto que puso una persona sale como «inventado». El parche es por
  CLASE: lo que no nombra queda como estaba. Un cambio que deja la tarjeta incompleta la deja como estaba, con aviso.
- **La revisión de editar descuenta lo que ya estaba mal** en esas tarjetas (un link o un voseo de la persona): si
  frenara, el reintento no podría arreglarlo nunca. La excepción es «un mensaje al lead va por WhatsApp» en un flujo
  social. En editar, «un DM sólo con un CRON de su canal» no es un error: es la pregunta «¿Cambio qué la dispara?», y la
  respuesta se guarda por `action:'disparadores'`, fuera del borrador.

**Las preguntas y el chat de MaKo**

- **MaKo pregunta SÓLO canal, evento o producto** (`preguntaAntes`, `lib/flujo-ia-preguntas.ts`), y la respuesta la
  impone el CÓDIGO (`aplicarRespuestas`), nunca el modelo. WhatsApp cuenta siempre como conectado. El producto filtra los
  kanbans de los otros productos: así `entregaNombrada` encuentra un solo «Onboarding» (el test lo ejecuta con el ws10
  medido). El CRON forzado entra ANTES de `deIA`: pisarlo al final no alcanza, porque el ámbito de las condiciones y el
  canal de los DM ya se resolvieron con el del modelo.
- ⚠️ **`cambiarSettingSi` con un valor largo no llega a la base** (medido). Compara con `.eq('value', esperado)` y
  PostgREST pone ese filtro en la URL: con 6 KB da 200, con 8 a 12 KB «fetch failed», con 16 a 32 KB 400 y con 64 KB 414.
  El chat habría dejado de guardarse desde ~30 mensajes, sin un error. «Es el compare-and-set de la casa» vale para
  valores CORTOS: el chat compara `updated_at` ([hallazgos-infra.md](hallazgos-infra.md)). **Vive en:** `lib/settings.ts`,
  `lib/automatizacion-chat-db.ts`.
- **Cada turno re-POSTea el pedido ORIGINAL con las respuestas acumuladas.** La ronda abierta se reconstruye del chat
  guardado (`rondaAbierta`, `lib/flujo-ia-cliente.ts`), y un mensaje de MaKo sin pregunta, o una pregunta con `cambios`,
  la CIERRA. Editar manda el historial de ANTES del turno: `respuestaDelCron` («Elige tú» = la primera opción) y
  `turnoDelUsuario` lo leen del body, no del chat guardado. Con el turno al final, el turno no se guardaba.
- **El chat de editar se cerraba por código** (`alListoIA` terminaba con `setEditandoIA(false)`): el resumen, los avisos
  y la pregunta del CRON no se veían nunca. Y `escribirSec` borra `mako=1`, o se pegaba a la automatización siguiente.

**Instagram y Messenger**

- **Dos verdades de «Instagram conectado».** El CRON medía la PÁGINA de Facebook (Graph); la tarjeta, Probar y Publicar
  miden Zernio, que es por donde llegan los eventos. Queda una, `estadoMedios` (`lib/disparadores-canales.ts`), y el CRON
  abre el mismo `ConectarMedio`. Los ws 1, 9 y 15 (página sin Zernio) ven «Sin conectar», que es lo cierto. ⚠️
  `estadoMedios` traga el `ZernioError` y da `conectado: null`. Con Zernio, ese «no pude» es casi siempre una key mala o
  una cuenta pausada: por eso el CRON ofrece «Conectar» también con null.
- **El 402 de Zernio se perdía en el `catch` de la RUTA** (`app/api/zernio/route.ts`). El encargo citaba la línea 256 de
  una ruta de 60 líneas: era `asegurarWebhook`, en `lib/zernio.ts`. Ahora un 401 da `motivo:'key'` y un 402 da `pausada`
  con `billingUrl`. Pero un 401 o un 402 con la key de la PLATAFORMA es de MaKo: ese link de pago no se le muestra a un
  cliente (`usaCuentaPropia`), y un link de un tercero que va a un `href` se valida https.
- **El webhook de Zernio sólo se registraba al abrir el modal** (el POST `estado`): ws10, 11 y 13 tenían
  `webhook_ok=false` y 0 eventos. Ahora lo aseguran Publicar y Activar (`asegurarAvisosSociales`, 8 s), sólo con
  Instagram o Messenger usados y conectados, y una falla no frena. Ojo: `validarActivacion` corre también cuando MaKo
  PROPONE activar.
- **Publicar y Activar no miraban el CRON:** un CRON de Instagram con tarjetas de WhatsApp se activaba sin Instagram.
  `mediosQueUsa` y `usosDeMedios` reciben los `disparadores` guardados en la fila, porque el CRON no viaja en el body.
- **«Te sigue» sólo se sabe de quien ya ESCRIBIÓ por DM** (regla de Meta). Un 200 de Zernio no es «sé»: trae
  `isFollower: null` y un `unavailableReason`, y `error` es una falla de Meta DENTRO de un 200. Los 400, 403, 404, 410 y
  422 son «no sé» y no tiran: si tiraran, la inscripción se trabaría para siempre. Tiran la red, el timeout, 408, 409,
  425, 429 y 5xx. «Se le puede escribir» y el envío eligen la conversación con la MISMA función pura
  (`conversacionQueCuenta`, `lib/canal-social.ts`). **Vive en:** `lib/canal-zernio.ts`, `lib/zernio.ts`.
- **Un guard que barre literales no ve las variables:** el `createLead({ origen_lead: e.canal })` de Zernio dejaba a esos
  leads «Sin origen», y `tests/crm-origen-lead.test.ts` no lo veía. La ficha (`app/crm/lead-view/OrigenCard.tsx`) no
  tenía su renglón hasta la cosecha.
- **El filtro de canales de la lista:** `expandirPasoIA(pasos)` expande sólo los AI Step de WhatsApp. Quien cuente lo
  que manda un AI Step le pasa SU medio, y las opciones salen de `MEDIOS` (`lib/chatbot-lista-filtro.ts`).

**La pantalla**

- **El ✦ «no hace nada» con una tarjeta abierta:** el clic alternaba `editandoIA` con la barra en `display: none`.
  `abrirMako()` cierra la tarjeta con `foco` en `id: null` (no hace falta otra prop) y abre el chat. Y «está más grande
  que el de al lado» era falso al medir (44 y 44): pesaba el bloque negro junto a tarjetas claras. Ahora usa la cara de
  `tarjetaChrome`.
- **El aviso de Probar existía y no se veía**, y lo obvio era «falta el aviso». El primer POST tarda ~14 s, el toast dura
  3,2 s, el gate de la prueba lo mataba al tocar ↻ o cerrar, y vivía dentro de la capa de Probar:
  [hallazgos-ui.md](hallazgos-ui.md) → «un fixed atrapado». Un aviso de algo que YA pasó no se ata a la vida del panel que
  lo pidió.
- **El QR salta solo al crear una tarjeta que lo necesita** (`medioAConectarAlCrear`, `lib/medios-automatizacion.ts`),
  colgado de `chipDeTarjeta().frena` y nunca de «no está conectado», que incluye el «no sé». ⚠️ `useEstadoMedios`
  devuelve `undefined` MIENTRAS lee, y la primera tarjeta de WhatsApp cambia la consulta: el efecto espera
  `medios !== undefined`, porque el handler del ＋ todavía no lo sabe.
- **Sin la puerta del QR, la tab abre más rápido:** el spinner esperaba tres GET en fila, y ahora sólo la lista.

**El enchufe (lo que ningún paquete conectaba)**

- **Editar no sabía qué CRON tenía la automatización:** la ruta no ponía `ctx.disparadorActual`, así que «cambia WhatsApp
  por Instagram» preguntaba «¿Cambio qué la dispara?» aunque ya fuera de Instagram, y las condiciones valían con
  cualquier ámbito. ⚠️ El arreglo obvio (armarlo desde las columnas con `valorDisparo`) era el equivocado: da
  `trigger:instagram`, que no es ninguna opción del CRON de la IA (`instagram:dm`), y `userDeEditar` no encuentra el
  CRON ACTUAL. El evento vive sólo en la LISTA (mig 0241). Ahora: `disparadoresDeSecuencia` (la lectura de Publicar) y
  `valorIADeDisparador` (`lib/disparadores.ts`), el inverso EJECUTADO de `disparadorDeValorIA`. Lo usa también el 409
  de crear. **Regla:** el valor que la IA ve y el que se lee de un CRON guardado salen de las dos funciones de ida y
  vuelta, nunca de las columnas.
- **Publicar escribía `aviso` y la pantalla no lo leía** («Los avisos de Instagram no se activaron»): ahora va después
  de «Publicado ✓» (`SecuenciaPerfil.tsx`, `publicar`).
- **Las etapas de «Está en la etapa» tenían dos armados:** el lienzo (`etapasCond`) y lo que ve la IA
  (`etapasDeCondicion`). El lienzo usa ahora la función, y el test la ejecuta.
- La tarjeta CRON se siembra con `disparadorDeValorIA` (`sembrarPrimero` recibe el `Disparador` entero). Hoy esa rama
  de `alListoIA` no se alcanza (crear vive en la galería, que recarga la lista), pero ya no miente si vuelve.

**Herramientas**

- Probar rompiendo se hace en un ESPEJO (copia de `lib/`, `app/` y `tests/` con `node_modules` enlazado), y así las
  otras sesiones del worktree nunca ven un archivo roto. Un arnés que busca texto con `\n` en un archivo CRLF dice «no
  encontré».
- `typecheck-lock.mjs` «corre igual» después de 5 minutos sin RAM: con siete paquetes en paralelo, eso es la caída del
  11/10.
- `ResultadoEdicion` (`Omit<…> & { disparador?: … }`) ya no cumple `R extends ResultadoIA`: `generar` y `pasada` pasaron
  a `<R extends { avisos: string[] }>`.
- **Un guard que se queda vacío no falla:** `indexOf('await setTriggerSecuencia(')` daba -1 y `ok > -1` pasaba siempre
  (`tests/flujo-ia-arreglos.test.ts`). Al renombrar una puerta, se grepean los tests que la buscan por nombre.

**SIN HACER (con su archivo):**
- `app/automations/SecuenciaPerfil.tsx`: lo que crea la IA (`alListoIA`) no hace saltar el QR.
- `lib/disparadores-guardar.ts`: cambiar el CRON de una automatización YA ACTIVA no pasa por el freno del medio, y la API
  de MaKo y la IA no tienen otro.
- `lib/disparadores-canales.ts` (`estadoMedios`): un 401 o un 402 de la key propia queda «Sin comprobar» y no frena. Y
  `EstadoCanal` (`lib/disparadores.ts`) no trae un código: con «sin Zernio», el primer clic abre y cierra la ventana
  emergente antes de mostrar el campo de la key.
- `app/automations/ConectarMedio.tsx` (`guardarKeyZernio`) guarda la key sin verificarla: el `verificar` de Zernio dice
  «respondió 402» de una cuenta pausada.
- `lib/flujo-ia.ts`:
  - un pedido explícito del CRON en un negocio grande deja a Groq afuera (`userDeEditar`);
  - `cambioDeCanal` es una heurística (`RX_CAMBIO_CANAL`);
  - no se puede sacar una rama, ni cambiar los casos de un «Si responde» o los escenarios de un AI Step;
  - «Avance del curso» se saca (`filaDelCatalogo`).
- `lib/flujo-ia-preguntas.ts`: «mándale un DM» no pregunta el evento (a propósito), y dos embudos con producto que
  comparten «Nuevo» preguntan el producto.
- `app/automations/ChatMako.tsx` y `SimuladorWhatsApp.tsx` (`makoPara`):
  - el mensaje de MaKo del `listo` no comparte id con el guardado;
  - una automatización en blanco no tiene chat;
  - `?sec=X&mako=1` dos veces sobre la misma no lo reabre.
- `app/automations/ChatAgentApp.tsx` (`vioVacio`): la reapertura del recorrido puede pisarse con el chat que se abre al
  crear. Y el aviso de Probar sigue en 3,2 s (`app/_ui/Toast.tsx`).
- `lib/canal-zernio.ts`: «Te sigue» se consulta en vivo, una llamada por lead (de a 4, con 8 s de tope). Con cientos de
  leads parados, la alternativa es la mig 0258 (decisión 5). No se midió en prod: no hay ningún DM real.
- Antes del push: medir `ZERNIO_API_KEY` y `ZERNIO_WEBHOOK_SECRET` en Vercel prod. Lo visual lo mira Martín.

_12/10/2026 — cierre de la duodécima: typecheck sin errores de la tanda (quedan 2 de `lib/editor-landing`: `html-to-image` y `pptxgenjs` están en package.json pero no en el `node_modules` enlazado del clon). Suite entera, 8413 tests: 8409 pasan, 3 fallan y 1 se salta. Los 3 son los de antes, ya en HEAD y de otras áreas (`confirm-encima-de-modales`, `mover-etapa-validacion`, `plan-filtro-cliente`). La primera corrida dio 7 rojos: 3 eran cruces entre paquetes de la tanda (la ficha del origen, la puerta del CRON en `cron-varias-etapas` y el ＋ en `nutricion-paso-accion`) y 1 venía de `dbe5d1ec` (la quinta familia de la barra no llegó a `lib/plan-proyectos-catalogo.ts`). Los 4 quedaron arreglados._

_12/10/2026 — enchufe del cierre (el CRON que se edita, el 409, el aviso de Publicar, la siembra del CRON, las etapas de la condición): typecheck con los mismos 2 de entorno; suite entera 8418 tests, 8413 pasan, 4 fallan y 1 se salta. Los 3 de antes más `ads-video-procesando` (un tiempo bajo carga: solo da 10 / 0). Roturas en un espejo: 9 de 9 cazadas (`tests/automations-duodecima-enchufes.test.ts`, al pie)._

_12/10/2026 — cierre final de la duodécima: typecheck entero en 0 errores (los 2 de `lib/editor-landing` se fueron: otra sesión instaló `html-to-image` y `pptxgenjs` en el `node_modules` compartido). Suite entera, 8418 tests: 8414 pasan, 3 fallan y 1 se salta. Los 3 son de HEAD y de otras áreas, y la tanda no toca ningún archivo que lean: `confirm-encima-de-modales` (ya arreglado en origin/main, `DesvioMovil.tsx`), `mover-etapa-validacion` y `plan-filtro-cliente` (los dos siguen rojos en origin/main `2a9b0777`: ni el test ni lo que leen cambiaron). `ads-video-procesando` pasó: lo del enchufe era carga._

## Decimotercera tanda (12/10/2026, claude3): la barra de MaKo, crear y llevarte al lienzo, Probar sin conexión, el chat de WhatsApp

El pedido, textual (8 puntos con capturas de hola-mako.com/automations), en el último hito de
`app/admin/dev/chatbot/bitacora.ts` (12/10, 10:30). Un agente solo, sin multi-agente, en el worktree `C:/dev/wt-undecima`.
Lo que no se ve en el diff:

- ⚠️ **«No se ve el placeholder, tiene scroll y no aparece más la animación»: el diagnóstico obvio (se borró la animación)
  era el equivocado.** `useEjemploQueSeEscribe` seguía andando; lo roto era el ALTO del campo. La pila de modales pinta un
  `Modal` con `display: none` en su PRIMER render (`decidirVisible` da false hasta que un efecto lo mete en la pila), y el
  efecto del hijo corre antes que el del padre: medía `scrollHeight = 0`, ponía `height: 0px` y no volvía a medir hasta que
  cambiara el texto. Quedaba el relleno, con el ejemplo escribiéndose fuera de la vista y la barra de scroll. Además,
  `height = scrollHeight` con `box-sizing: border-box` y 2 px de borde desborda SIEMPRE 2 px. Estaba roto desde la décima
  (la caja de la galería tenía el mismo efecto). **Regla:** la barra es `ComposerWhatsApp`, que mide con el borde y tiene
  `minHeight`. La trampa general, en [hallazgos-ui.md](hallazgos-ui.md). **Vive en:** `app/_components/pila-modales.ts`,
  `app/whatsapp/_shared/ComposerWhatsApp.tsx`, `app/automations/ChatMako.tsx` (`BarraPideselo`).
- **«Al enviar no ocurre nada»: MaKo trabajaba ADENTRO del modal** y la fila nacía al guardar (para la persona, un minuto
  sin nada). Ahora el modal se cierra al enviar y la fila nace YA por la puerta de «Nueva» (`crearNueva(pedido)`, la de
  «Lienzo en blanco»): la fila «creándose» en la lista, su lienzo, y el chat de MaKo abierto con el pedido puesto, que el
  chat manda como CREAR sobre esa fila (la ruta ya lo aceptaba: vacía y pausada). Las preguntas de MaKo salen en el chat de
  la fila, no en el modal. **Decisión:** si MaKo falla, la fila queda vacía y pausada, con el error en su chat y el pedido
  de vuelta en la barra: no es una fantasma, es una automatización a la que se le puede volver a pedir. Si falla crear la
  fila, el error va pegado a «＋ Nueva» y el pedido vuelve a la barra de la galería (`pedidoSinCrear`). **Vive en:**
  `ChatAgentApp.tsx` (`crearNueva`, `pedirAMako`), `SimuladorWhatsApp.tsx` (`AbrirSecuencia.pedido`), `SecuenciaPerfil.tsx`
  (`pedidoAlAbrir`, la capa), `ChatMako.tsx` (`pedidoInicial`).
- ⚠️ **Un pedido que sale al MONTAR se corta en desarrollo:** React monta, desmonta y vuelve a montar los efectos, y el
  desmonte de `useStreamIA` aborta el pedido en vuelo. El primer turno sale en un `setTimeout(0)` que limpia el cleanup,
  con una guarda por pedido. **Regla:** si otro efecto del mismo componente aborta al desmontar, un fetch de montaje no sale
  en el cuerpo del efecto.
- **La capa ya no es un portal sobre toda la pantalla.** La pone SecuenciaPerfil, de la lista para la derecha (la fila
  recién creada se sigue viendo), y POR ENCIMA de «Publicar»: z 58 > `Z_ACCION_LIENZO` (57). El Lienzo no crea un contexto
  de apilamiento, así que compiten en el mismo. El chat sube a 59 mientras MaKo trabaja; los dos, debajo de 60 (AGENTS.md).
- **«Sin Zernio», y Probar dejaba probar.** Probar miraba sólo la FORMA (`frenoDelFlujo`), nunca los medios; Publicar sí, en
  el server. Ahora `medioQueFrena` (lib/medios-automatizacion.ts) es la cuenta de Publicar y Activar (`medioSinConectar` la
  usa) Y la de Probar, con la línea de la tarjeta que frena (para abrir SU QR). Probar dice «Conecta tu Instagram» y abre el
  modal de ese medio. «No pude comprobarlo» no frena.
- **El modal de Zernio es EL de Integraciones:** `ServicioModal`, exportado de IntegracionesBoard.tsx y montado a demanda por
  `app/integraciones/ServicioSuelto.tsx`. La `Integracion` la arma el server con la MISMA cuenta que la grilla
  (`getIntegracion` → `integracionDeDef`, por la server action `integracionAction`). Se fueron el campo propio de la key y
  `guardarKeyZernio`. Al cerrar Integraciones se vuelve a mirar Zernio: si sirve, sigue el OAuth; si se guardó una key que
  no sirve, se dice y queda «Abrir Zernio». ⚠️ `getIntegracion` NO filtra por la capa (la capa decide qué se LISTA): una
  automatización que necesita Zernio lo necesita aunque la tarjeta no esté en la grilla. Sí respeta `soloPlataforma`.
- **El chat ES el hilo de WhatsApp** (`ChatHilo` + `BurbujaHilo` + `ComposerWhatsApp`), no una copia. Lo que le faltaba al
  hilo para servirle a MaKo entró como props OPCIONALES, y nadie más cambia:
  - `onEnviarAudio`: el micrófono sin el clip (MaKo no recibe archivos). La nota se transcribe con `transcribirNota` y viaja
    como texto.
  - `acentoEnviar` y `fondoHilo`: los colores de MaKo.
  - `ponerBorrador`: devolver a la barra un pedido que no nació en ella.
  - `onEnviarTexto` puede devolver `{ error }`: no salió, y lo escrito vuelve.

  La pregunta va como los botones de respuesta de WhatsApp, debajo de la burbuja.
- **El historial del ✦ (punto 7):** la ruta del ✦ (`/api/chat-agent/redactar`) anota en el chat de MaKo de la automatización
  el pedido y lo propuesto (o el error), con `tarjeta`: el nombre de `nombreDeTarjeta`, el mismo de los errores de
  Publicar. ⚠️ El id llega del navegador: se escribe sólo si la automatización es del workspace (`secuenciaDelWorkspace`,
  lib/automatizacion-chat-db.ts). Es lo único que esa ruta escribe; el guard «la ruta no paga ni escribe»
  (`tests/whatsapp-sexta-tanda.test.ts`) lo admite explícito. El chat abierto lo suma sin releer (`chat-mako-eventos.ts`).
- **El ✦ en el email y en los DM (punto 8)**, con `canal` en lib/mako-redacta.ts:
  - el email pide asunto y cuerpo, con su JSON propio;
  - un DM, uno o dos mensajes cortos (≤ `TOPE_TEXTO_SOCIAL`);
  - la nota de voz es SÓLO de WhatsApp (Instagram rechaza el OGG/Opus).

  ⚠️ `String.replace` con un texto como patrón reemplaza SÓLO la primera vez: el system de los DM tiene `{{red}}` dos veces y
  le llegaba al modelo «DM de {{red}}». Lo encontró el test nuevo en su primera corrida. **Regla:** para llenar un hueco que
  puede repetirse, `split().join()` (o `replaceAll`).
- **El ✦ del título también con el lienzo vacío:** ahí MaKo crea. La caja grande del lienzo vacío sigue afuera (la sacó la
  décima): el ✦ es un botón chico.

**SIN HACER (con su archivo):**
- ~~`app/automations/ChatMako.tsx`: el 409 de crear sobre lo publicado~~ y ~~los rearranques de Probar sin los medios~~:
  HECHOS el 13/10/2026 (`6e53ff79`, ver «Los pendientes de la decimotercera, cerrados» más abajo).
- `app/automations/EditorPasoIA.tsx` y `app/landing-generator/CajaCrear.tsx`: el ejemplo que se escribe solo usa el mismo
  placeholder. Si alguno mide su alto en el primer efecto adentro de un Modal, tiene la trampa de arriba: no se midió.
- Lo visual (el chat como WhatsApp, la capa, el modal de Zernio) no se miró en el navegador: lo mira Martín.

_12/10/2026 — cierre de la decimotercera: typecheck en 0 errores. Tests de las áreas tocadas: 1093 / 1093 (84 archivos). Suite entera, 9043 tests: la primera corrida dio 4 rojos; 1 era un guard de la forma del lienzo (`flujo-lienzo-paralelos`, la rama del email ahora abre un bloque), ya arreglado. Los otros 3 son de HEAD y de otras áreas, y ninguno lee un archivo de la tanda: `mover-etapa-validacion`, `plan-filtro-cliente` y `plan-proyectos-catalogo` (la barra de `nav.ts`). Roturas: 16 de 16 cazadas (`tests/automations-decimotercera.test.ts`, al pie)._

## Decimocuarta tanda (12/10/2026)

El pedido (Martín, 12/10, con dos capturas: la caja «¿Qué vas a crear hoy?» del Landing Generator y la tarjeta INSTAGRAM
del lienzo): sacar «Nace pausada»; la caja «Pídeselo a MaKo» igual a la del Landing Generator; el chat de MaKo al costado;
sin el chip «Conecta tu Instagram» junto a «Activar»; varias cuentas de Instagram con el desplegable de WhatsApp («Conectar
otra» adentro, sin «Conectar», sin «Sin Zernio» ni el logo de la derecha) y el ✦ al lado. Un agente solo, en
`C:/dev/wt-undecima`.

- **La caja de MaKo ES la del Landing Generator, no una copia.** Salió de `CajaCrear.tsx` a
  `app/landing-generator/CajaPedido.tsx` y la montan las dos puertas (`BarraPideselo`, ChatMako.tsx). ⚠️ Importar
  MiniaturaLanding desde /automations arrastra el render de la landing entera: `Ico` salió a `Ico.tsx`. ⚠️ Sus tokens
  `--gp-*` caen a valores CLAROS fuera de `.gma` (un `var()` inexistente no falla, toma el respaldo): en oscuro la caja
  salía blanca. Afuera va envuelta en `.gp.cp-casa` con `CSS_TOKENS_CASA` (los de la casa). **Regla:** reusar una pieza
  de Gamma fuera del editor = sus tokens desde los de la casa, nunca `CSS_GP` suelto.
- **Sin el chip «Plan | Express»:** acá no hay un modo que elegir (MaKo pregunta en el chat de la fila). El «+» ofrece lo
  que ya tiene el modal (`accionesMas`): «Lienzo en blanco», «Usar plantilla» (enfoca el buscador) y «Pegar lo copiado».
- **Medir escondido:** la caja nueva no fija `height: 0px` si `scrollHeight` da 0 (el modal se pinta con
  `display: none` en su primer render: la trampa de la decimotercera). Cierra ese «sin hacer» para `CajaCrear`.
- **El chat al costado comparte el muelle de «Probar»** (`chatAlCostado`, lib/crear-ia-lugar.ts). Los muelles los
  calcula la tab (SimuladorWhatsApp) y el estado del chat vive en SecuenciaPerfil: `onChatMako` sube «abierto» y la tab
  reserva la derecha con `probarAbierto || makoVisible`. Con «Probar» abierto el chat se ESCONDE sin desmontarse (un
  pedido en vuelo sigue) y el ✦ cierra «Probar» y lo muestra. Ya no se esconde con una tarjeta abierta: el editor se corta
  antes del muelle.
- **El chip «Conecta tu Instagram» era `err`:** el texto del freno quedaba en la píldora roja de «Activar» después de
  cerrar el modal. Probar, Publicar (409) y Activar ahora sólo abren el modal del medio.
- ⚠️ **Varias cuentas: el diagnóstico obvio («Zernio no deja») era el equivocado.** Zernio lista varias por profile
  (`GET /accounts?profileId&platform`) y `connect/{plataforma}` suma otra. Lo que impedía «Conectar otra» era el sondeo
  de `ConectarSocial`: daba conectado con «hay alguna cuenta», y con una ya conectada cerraba en el PRIMER sondeo, antes de
  terminar en la ventana. Ahora espera una cuenta que antes no estaba (`cuentaNueva`) y la deja elegida en la tarjeta.
- **El paso guarda SU cuenta** (`cuenta_zernio`, el `accountId`; `cuentaDelPaso` / `cuentaAlGuardar`, lib/canal-social.ts,
  como `linea`). El motor manda SÓLO por ella (`conversacionDelPaso`): sin conversación con esa cuenta, falla terminal y
  no cae a otra. Caer tampoco serviría: la ventana de 24 h de Meta es por conversación, y la conversación es de UNA cuenta.
  Sin cuenta elegida, lo de siempre; con varias, el desplegable lo dice: «Donde escribió el lead».

**SIN HACER (con su archivo):**
- `lib/medios-automatizacion.ts`: el chip «Sin conectar», Probar y Publicar miran «hay alguna cuenta», no la ELEGIDA. Una
  tarjeta con una cuenta desconectada recién falla al enviar.
- `lib/canal-social.ts` (`conversacionesPorLead`): las condiciones de Instagram («Se le puede escribir…») miran la
  conversación de cualquier cuenta, no la de la tarjeta que sigue.
- `app/automations/PanelProbar.tsx` / `SimuladorSocial.tsx`: Probar un DM no muestra por qué cuenta saldría.
- `app/automations/SecuenciaPerfil.tsx`: con la ventana angosta (editor de columna) no se midió el chat junto al editor.
- Lo visual (la caja, el chat al costado, la cabecera de Instagram) no se miró en el navegador: lo mira Martín.

_12/10/2026 — cierre de la decimocuarta: typecheck en 0 errores. Áreas tocadas: 1044 / 1044 (82 archivos). Suite entera, 9066 tests: 3 rojos de la tanda (guards de la forma vieja en `medios-automatizacion` y `plantillas-automatizaciones`), ya arreglados. Quedan 3 rojos de HEAD, los mismos de la decimotercera y de otras áreas: `mover-etapa-validacion`, `plan-filtro-cliente` y `plan-proyectos-catalogo`. Roturas: 10 de 10 cazadas (`tests/automations-decimocuarta.test.ts`, al pie)._

## Decimoquinta tanda (12/10/2026)

El pedido (Martín, 12/10, 13:20; textual en la bitácora): el título «¿Qué vas a crear hoy?» en la caja; el lápiz y el tacho
pegados a la burbuja en el editor de Instagram; el logo de MaKo (no la estrella chica) en los editores; que el modal de
conectar no salte mientras se edita; sin «Publicar», «Acomodar» ni «Centrar» en el click derecho; que el ejemplo de la caja
vuelva si se sale sin escribir; el «+» de la caja para subir un archivo o una imagen y pegar un flujo; y «Copiar flujo» como
un TOKEN que al pegarse dice «Flujo copiado: <nombre>». Un agente solo, en `C:/dev/wt-undecima`.

- **El título era de la página, no de la caja.** Vivía en `CajaCrear.tsx` (un `<h1>` suelto), así que el modal de
  Automations recibió la caja sin él. Ahora es `titulo` de `CajaPedido` (`TITULO_CAJA`; h1 en la landing, h2 en el modal)
  y su hoja va en `CSS_CAJA_PEDIDO`; afuera de la landing toma `--gp-titulo` de `CSS_TOKENS_CASA`. **Regla:** lo que se ve
  en «la imagen» de una pieza compartida vive EN la pieza, no en una de las puertas.
- ⚠️ **El hueco entre los botones y la burbuja de Instagram: el diagnóstico obvio («el `gap` de la fila») era el
  equivocado.** `BurbujaSocial` lleva `max-width: 78%` y su caja se ajusta a la burbuja: el 78% se resuelve contra ESA
  caja y la burbuja se encoge, dejando el hueco adentro de la caja, entre los botones y el mensaje. Es la trampa que el
  WhatsApp ya había resuelto en la sexta (`BurbujaHilo` `maxAncho`), pero el editor social tiene su propia burbuja y no la
  heredó. Ahora `BurbujaSocial`/`ArchivoSocial` aceptan `maxAncho` y el editor pasa `100%`, con la caja de la fila de
  WhatsApp (`flex: 0 1 auto`, `calc(100% - 70px)`). **Regla:** una burbuja en una fila con botones va al 100%; el tope lo
  pone la fila.
- **«La estrella que no es el logo» era `BotonMako`:** dibujaba `MakoStar` (la chispa al 45% del lado y el punto chico
  arriba: «una segunda estrella arriba»), y la cabecera usaba `MakoLogo`. Ahora `BotonMako` ES `MakoLogo` (la chispa sola),
  así que cambian también los botones de MaKo del Dashboard (`NuevaHoja`, `PanelAnalista`): es la regla de la décima («el
  logo de MaKo, que es una estrella en el centro, sin la estrella chiquita arriba»). **Regla:** un botón de MaKo es el
  logo; `MakoStar` queda para marcas chicas en texto.
- **Conectar sólo cuando se pide.** Se fue lo de la duodécima §2.12 (`pedirConectar` en FlujoLienzo y
  `medioAConectarAlCrear` / `MEDIOS_QUE_SALTAN` en lib/medios-automatizacion.ts): Martín dio vuelta su propio pedido («que
  salte el QR»). El modal lo abren el chip «Sin conectar», Publicar, Probar, Activar y «Conectar otra». **Regla:** nada se
  abre solo mientras se edita un flujo.
- **El click derecho:** «Centrar» lo sumaba `Lienzo.tsx` a TODO fondo (también al lienzo de la agencia) y «Publicar» /
  «Acomodar» los sumaba FlujoLienzo. Se fueron los tres; Centrar sigue en el zoom (⤢) y Acomodar al lado del deshacer.
- ⚠️ **El ejemplo que no volvía no era el hook.** `useEjemploQueSeEscribe` ya pausaba y retomaba; el «para siempre» era el
  `tocada` de CADA puerta (la caja de Automations y la de la landing), una decisión de la tercera tanda («al darle click
  debe parar la animación completamente»). Ahora lo decide la caja (`seMueveElEjemplo(animar, foco, valor)`): se mueve sin
  el foco de la caja y vacía; el foco es el del `<form>` (con `relatedTarget`: el micrófono y el «+» también cuentan).
- **El «+» con archivo:** POST `/api/chat-agent/secuencias/archivo` (multipart, sólo admin) lee con `archivoATexto` (una
  imagen o un PDF escaneado, por visión; el gasto a `chatbot-crear-ia`). ⚠️ La ruta de MaKo corta el pedido a 2000 en
  silencio (`body.pedido.trim().slice(0, 2000)`): pegar el archivo DESPUÉS de lo escrito lo perdía. `pedidoConArchivo`
  pone lo escrito primero y recorta el archivo a la vista («…»). ⚠️ ChatMako.tsx y CrearConIA.tsx no pueden tener un
  `method: 'POST'` (el test del único lector del stream): la subida vive en `archivo-pedido-cliente.ts`.
- **El token** (`MAKO-FLUJO-` + 10 de Crockford, `tokenDeBytes` / `tokenDeTexto`, lib/flujo-copia.ts): la tabla
  `flujo_copias` (mig 0265) tiene `workspace_origen`, NO `workspace_id`: con `workspace_id` iría a `TENANT_TABLES`,
  `getTenantDb` la acotaría y el token no se leería desde otro negocio, que es para lo que existe. Sin la tabla, supabase-js
  contesta `PGRST205` (medido en prod, sólo lectura, antes de aplicarla): la ruta da 503 con `falta` y el botón copia el
  texto entero de antes. Pegar un token (la caja, «Pegar un flujo», el aviso al entrar, la galería, Ctrl+V en un lienzo)
  pasa por `resolverCopia`, y lo guardado vuelve a pasar por `leerCopia`. ⚠️ Safari pierde el permiso del clic si se
  espera un `fetch` antes de `writeText`: el token va con `ClipboardItem` y una promesa (`copiarAlPortapapeles`).

**SIN HACER (con su archivo):**
- `supabase/migrations/0265_flujo_copias.sql`: escrita, NO aplicada (la aplica la sesión principal antes del deploy).
- `lib/flujo-copia-negocio.ts`: los tokens no vencen ni se pueden revocar (no hay pantalla para listar o borrar copias).
- `app/automations/ChatMako.tsx` (`hiloDeChat`): un pedido con archivo se ve entero en el chat de MaKo (hasta 2000
  caracteres), sin resumirlo a «📎 archivo».
- `app/automations/ChatMako.tsx` (`BarraPideselo`): soltar o pegar una imagen en la caja no la sube (sólo el «+»).
- `app/automations/FlujoLienzo.tsx`: copiar TARJETAS (Ctrl+C) sigue copiando el texto entero, no un token.
- `app/agencia/FlujoAviso.tsx`: el click derecho del lienzo de la agencia conserva su «Acomodar» (no se pidió).
- Lo visual (el título en el modal, los chips, el logo en los editores) no se miró en el navegador: lo mira Martín.

_12/10/2026 — cierre de la decimoquinta: typecheck en 0 errores. Áreas tocadas: 1640 / 1640 (119 archivos). Roturas: 10 de 10 cazadas (`tests/automations-decimoquinta.test.ts`, al pie)._

## Los pendientes de la decimotercera, cerrados, y los plazos de etapa como plantilla (13/10/2026)

Cuenta `claude2`, worktree `C:/dev/wt-undecima`, commits `ae462b56` y `6e53ff79` (sin push al escribir esto).

### El 409 de «crear» no era del server: el chat decidía con la mitad del dato [chat de MaKo]

Síntoma: con el borrador vaciado a mano y tarjetas publicadas, pedirle algo a MaKo contestaba «ya tiene tarjetas: pídele un
cambio». El diagnóstico obvio era el server (el 409 sale de la ruta). La ruta tenía razón: crear ESCRIBE encima y no pisa un
flujo publicado (puede tener leads adentro). Lo que estaba mal era la pregunta del cliente: `crea = pasos.length === 0`
miraba sólo el BORRADOR. Con algo publicado, edita sobre el borrador vacío (`publicadas`, lo pasa SecuenciaPerfil).
**Regla:** una decisión que cambia QUÉ escribe el server (crear vs editar) se toma con lo que el server va a mirar, no con la
copia local.

**Vive en:** `app/automations/ChatMako.tsx` · `app/automations/SecuenciaPerfil.tsx` · `app/api/chat-agent/secuencias/ia/route.ts`

### Un freno que viaja a otro componente tiene que ser el MISMO que el del botón [probar]

El botón «Probar» frenaba por la forma Y por un medio sin conectar; lo que viajaba al panel (`EdicionLocal.freno`) era sólo
la forma, así que los rearranques (↻, «Cambió · ↻», «Probar en WhatsApp») corrían con un medio desconectado. Ahora viaja
`FrenoDeProbar` (forma o medio, con la cuenta de Publicar: `medioQueFrena`) y frenar abre el modal del medio. La lectura de
los medios tuvo que SUBIR antes del efecto que manda la edición local: un `useMemo` declarado después no lo podía usar.

**Vive en:** `app/automations/SecuenciaPerfil.tsx` (`frenoProbar`, `frenarDesdeProbar`) · `app/automations/PanelProbar.tsx`

### Una condición que depende de la AUTOMATIZACIÓN no se guarda en la fila: la pone quien evalúa [condiciones]

Los plazos de etapa del CRM pasaron a la plantilla «Un Lead No Avanzó» (espera → «Sigue en la etapa del CRON» → aviso). La
salida obvia era copiar la etapa elegida en la condición al crear la plantilla; queda VIEJA el día que alguien cambia el
CRON. La condición no guarda la etapa: `HechosLead.etapasDelCron` lo pone quien evalúa (`conEtapasDelCron`,
lib/disparadores.ts) — el motor por automatización en los dos lugares donde decide, y «Probar» con el lead de prueba, que
entra EN la etapa del CRON. Sin un CRON de etapa es «no sé». Medido el 13/10: ningún embudo tiene plazos guardados
(`funnels.data.umbrales.porEtapa`), así que no hubo nada que migrar; el aviso viejo (`lib/lead-quieto-aviso.ts`) y la op
`plazo` del CRM quedan sin datos (retirarlos es del chat CRM).

**Vive en:** `lib/condiciones-catalogo.ts` (`sigueEnEtapaDelCron`) · `lib/disparadores.ts` · `lib/nutricion.ts` · `lib/simulador-grafo.ts` · `lib/plantillas-automatizaciones.ts`

### El entorno del 13/10: `tsc` y las suites largas mueren sin decir nada

`tsc --noEmit` sale con código 1 y CERO bytes de salida (ni con `--extendedDiagnostics`), y `npm test` corta sin el resumen:
el vigía de RAM (`~/.claude/guardia/vigia.ps1`) los mata con poca memoria libre (2,8 GB medidos). Un «exit 1» sin texto NO es
un error de tipos. Los tests se corrieron en tandas de 10-12 archivos (1153 del área en verde). El typecheck queda para antes
del push, cuando «Fallas en la PC» lo destrabe.

### «No salió el mensaje»: el lead CONTESTÓ un mensaje a mano y eso frenó el flujo [motor · bug 5 del 13/10, corregido el 14/10]

Síntoma: en la reunión del 13/10 Mauricio probó «Un Lead Agendó Llamada» (#213, ws1) con un lead de prueba (Marco
Bustos, 2660) y el audio de los 5 minutos no salió. El lead se borró después y con él (en cascada) su inscripción y sus
`nutricion_envios`. **Lo que sobrevive a un borrado:** `lead_audit` (sin FK), `notificaciones` (los avisos al equipo, con el
texto entero) y `wa_mensajes` de OTROS números. La cronología, reconstruida con eso (UTC):
- 01:57:24 pasado a mano a «agenda» con la R1 «2026-10-12» sin hora (el asistente de mover de etapa sólo pide la fecha).
- 02:02:44 de vuelta a «lead» a mano. 02:05:09 reservó por Calendly: R1 el 13/10 a las 23:00, CON hora.
- 02:05:16 `notificaciones` «chatbot-aviso-equipo» «Nuevo agendado: Marco Bustos»: es la tarjeta de MaKo de la #213. **El
  flujo SÍ reinició con la reserva** (reuso `nada_le_llego`, `nutricion-reinscripcion.ts`).
- 02:06:22 Mauricio le escribe A MANO desde su línea: «Marco te llegó un mensaje con un código?». 02:08:16 Marco contesta.
- 02:08:18 aviso «Marco Bustos te escribió… la automatización todavía no le había mandado nada». El audio vencía ~02:10 y
  no hay ningún mensaje automático a su número (…686 140 5022) entre 01:50 y 04:00.
**Causa:** `pausarPorRespuesta` (lib/nutricion.ts): CUALQUIER mensaje entrante del lead pasa todas sus inscripciones
activas a 'respondio' y les saca el próximo envío; sólo sobreviven los hilos del carril del recordatorio. Contestarle a
Mauricio un código frenó la bienvenida. Es una regla que no está en ninguna tarjeta del lienzo.
**El diagnóstico obvio era el equivocado, DOS veces:** primero «las tarjetas que borró en la llamada»; después (mío, 13/10)
«una fecha sin hora cuenta como pasada desde el mediodía». Lo segundo es real (y quedó arreglado en `329d1443`), pero sólo
explica la PRIMERA vuelta (01:57); la que importaba era la de Calendly. Lo que lo destrabó fue Martín recordando que
habían reservado por Calendly, y los avisos de `notificaciones`, que nadie miraba para diagnosticar.
**Trampas:** el cambio de etapa de una reserva se firma «MaKo» (`AUTOR_SISTEMA`) y no «Calendly» — se leyó como «MaKo lo
movió». El teléfono de `evolution_contactos` (…686 280 5657) NO era el del lead: el del lead sale del aviso al equipo.
**Regla (Martín, 14/10):** MaKo no decide nada que no esté en el flujo (memoria `mako-nada-por-detras`). La pausa por
respuesta, «la reunión ya pasó» y las demás reglas escondidas pasan a condiciones u opciones visibles: inventario y plan
en docs/diseno-mako-nada-por-detras.md.

**Vive en:** `lib/nutricion.ts` (`pausarPorRespuesta`, `procesarEnvios`) · `lib/nutricion-reinscripcion.ts` · `lib/leads.ts` (la reserva)

### Un Evento de MaKo que se ofrece sin emisor deja main en rojo, aunque el emisor «sea de otro chat» [avisos · 14/10]

`2ea2cf81` sumó el evento «El AI Analyst termina un análisis» y su plantilla, con la idea de que lo emitiera después el
chat Graphics. Main quedó con dos tests en rojo (lo avisó el chat CRM): tests/plantillas-viejas.test.ts (test 1, «se le
muestra al cliente y nada lo emite») y tests/tabs-retiradas.test.ts (un `?hoja=12` de EJEMPLO, en lib/avisos-catalogo.ts
y lib/variables-aviso.ts, que no es una hoja). Ninguno de los dos estaba en las tandas que corrí: leen el catálogo de
avisos y el de variables, no el área.
**Regla:** al tocar `lib/avisos-catalogo.ts`, `lib/variables-aviso.ts` o `EVENTOS_MAKO`, correr también esos dos. Y un
evento entra con su emisor en el MISMO commit, aunque el emisor viva en el código de otra área (acá, `avisarAnalisisListo`
en lib/graficos-analisis-server.ts). Un link de ejemplo nombra una hoja real (`?hoja=marketing`).

**Vive en:** `lib/avisos-catalogo.ts` · `lib/variables-aviso.ts` · `lib/graficos-analisis-server.ts`

### «Si el lead contesta» es una CONDITION: que conteste no corta nada por su cuenta [motor · bug 5, 14/10]

Lo que causó el bug 5 (`pausarPorRespuesta`: una respuesta frenaba todo salvo el carril) pasó primero a una opción de
cada flecha del CRON («sigue» / «se corta», `si_contesta` en la tarjeta CRON, commit `c0c46bad`). Duró unas horas.
Martín: «"Si el lead contesta" NO debería ir en el CRON, debería ser una CONDITION... Es obvio eso». Quedó así:
- **El diagnóstico «falta una opción» era el equivocado.** Lo que el lead hace es un HECHO, y un hecho lo decide una
  condición en el lugar exacto del camino. Una opción del CRON vuelve a esconder la regla en un panel que no está en el
  dibujo, y además corta TODO el camino en vez de sólo el seguimiento que da por hecho que no contestó.
- **`contesto` es de la INSCRIPCIÓN, no del lead.** «Te escribió alguna vez» (`respondio`) ya existía y es otra cosa: un
  lead que escribió hace un mes entra a un seguimiento sin haber contestado ahí. El hecho es `contestoEnEsta` y lo pone
  quien evalúa: el motor con `insc.estado === 'respondio'`, «Si responde» con true, «Probar» con lo escrito en el chat.
- **Contestar sólo se ANOTA** ('respondio', con la posición, los hilos y el próximo envío intactos): sin tocar la posición
  no hace falta el compare-and-set de antes (`pausarConCarril`, borrado). El motor mueve una 'respondio' igual que una
  activa (`seMueveEnLaCorrida` ya no mira la respuesta).
- **Dónde va la condición: DESPUÉS de cada espera.** Es donde un lead puede contestar antes de lo que sigue; lo que sale
  sin espera de por medio sale antes de que pueda. Si el mensaje queda parado (un reintento), `condicionDeArriba` la
  vuelve a pasar. Dos condiciones seguidas no se pueden guardar: si después de la espera ya hay una, la fila se SUMA con
  «y» a cada grupo de cada rama (las «o» abren grupo).
- **La quinta puerta, al revés:** para borrar una clave del dato no alcanza con sacarla del tipo; `normalizar` la borra
  a mano (`delete … si_contesta`), si no viaja intacta en cada guardado.
- **Migración:** scripts/migrar-contesto-condicion.ts, DESPUÉS del deploy (el código de antes no conoce `contesto`, la da
  por no cumplida y el camino termina). En el dry run del 14/10: las 3 prendidas (#198, #213 ws1; #241 ws13) sólo pierden
  la clave (sus «se corta» no tenían espera de por medio); a las apagadas de ws10, ws11 y ws15 se les pone la condición.

**Vive en:** `lib/condiciones-catalogo.ts` (`contesto`) · `lib/nutricion.ts` (`pausarPorRespuesta`, `procesarEnvios`) · `lib/nutricion-grafo-motor.ts` · `lib/simulador-grafo.ts` · `lib/plantillas-automatizaciones.ts`

### «Probar» con un contacto por escenario: las condiciones se deciden en el CLIENTE [probar · 14/10]

Pedido de Martín: una barra de contactos (estilo WhatsApp o Instagram) con un escenario en cada uno, y elegir el escenario
al probar por WhatsApp. Lo que costó o conviene saber:
- **«Probar» decide cada condición en el navegador, también en la prueba DE VERDAD** (el server sólo manda lo que el
  panel le pasa). Por eso el escenario se fuerza en un solo lugar, el `case 'condicion'` de `avanzar` (PanelProbar), y
  vale igual para «Probar en WhatsApp». No hace falta tocar `/api/chat-agent/simulador`.
- **Los escenarios salen del MISMO simulador** (`siguiente` + `elegir`, `escenariosDePrueba`), no de recorrer el grafo
  aparte: con flechas en paralelo, «Ir a» y esperas, un recorrido propio inventaba caminos que la prueba no puede hacer.
  El primero es el que elegiría el motor con el lead recién llegado (`elegirSalida` con `hechosDeLeadNuevo`).
- **Un panel es UN canal:** el camino que sólo manda email no es un contacto de WhatsApp (`mensajes` cuenta los del canal).
- **Las cajas, absolutas:** el chat se mide con `height: 100%` y contra un alto de flex es cero en Safari (AGENTS.md);
  la barra y el chat van `position: absolute` dentro del cuerpo.
- **SIN HACER:** la operación `probar_secuencia` de la API manda TODOS los pasos de una (el modelo de antes, sin camino):
  ahí todavía no se elige un escenario. La API sí los lista (`escenarios_secuencia`). Vive en lib/setting-secuencias.ts
  (`probarSecuencia`). La bandeja de email no tiene barra (es otra cara); su menú sí pide el escenario.

**Vive en:** `lib/simulador-grafo.ts` (`escenariosDePrueba`) · `app/automations/PanelProbar.tsx` (`BarraEscenarios`, `MenuDestinos`)

### El AI Step no contesta por redes: una respuesta de Instagram o Messenger sólo PAUSA [motor · 14/10]

Lo encontró la investigación de TikTok (docs/diseno-tiktok-linkedin.md, fase 0). `pausarPorRespuesta` con origen social
(`soloPausa`) sólo marca 'respondio' y se va: no hay «chatbot» en ningún canal social, aunque el lienzo deje armar un flujo
de Instagram. Es el prerrequisito de TikTok. Y una trampa para sumar un canal: los ternarios binarios de
`lib/canal-social.ts` (`plataformaDe`, `problemaDeAdjunto`, `logoSocialSvg`…) tratarían a `'tiktok'` como Messenger SIN
avisar; van a `Record<CanalSocial, …>` para que el compilador obligue.

**Vive en:** `lib/nutricion.ts` (`pausarPorRespuesta`, `asistirRespuesta`) · `lib/canal-social.ts` · `app/automations/EditorPasoIA.tsx` (`MEDIOS_OFRECIDOS`)

### Una flecha no se podía soltar sobre la PASTILLA de una espera [lienzo · bug 4 del 13/10, 14/10]

«Las líneas de conexión desde el botón de sumar no se sueltan ni se guardan» (Mauricio, 13/10). Una espera con un solo
padre y una salida se dibuja como pastilla sobre la flecha (`colapsable`), y `tarjetaBajo` sólo aceptaba `[data-nodo]`:
soltar la flecha sobre la pastilla caía al vacío. El caso de esa llamada: conectar el segundo audio de «Un Lead Agendó
Llamada» a la espera de 2 h (la #213 terminó con los dos audios en esa espera). El dato siempre lo admitió (`conectar` a una
espera); era el lienzo. Ahora la pastilla recibe la flecha (y se ve entera bajo el cursor). Con dos padres, la espera se
dibuja como tarjeta. ⚠️ Sin ver la grabación (la cuenta 2 no accede a Fathom 858927676): es la causa más probable, no la
medida; hay que confirmarlo con Mauricio después del deploy.

**Vive en:** `app/_components/Lienzo.tsx` (`tarjetaBajo`, las pastillas) · `lib/flujo-conversacion.ts` (`colapsable`)

### «Sola» con plata: la regla de tres puertas que nadie veía [AI Step · punto 1 del 13/10, 14/10]

«La IA no permite configurar "hacer todo sola" en ciertos escenarios» (reunión del 13/10). La regla «con plata o en «Lo
demás», nunca «Sola»» (decisión del 06/10: «el precio va siempre en borrador») estaba en TRES puertas que se repetían: el
desplegable no ofrecía la opción, Publicar la frenaba («no puede salir sola») y `juntarPasosIA` la bajaba sola a «Para
aprobar» en cada guardado; y la cuarta, el motor, frenaba el texto con plata. Cambiar una sola no alcanzaba. Ahora la
persona elige en cualquier escenario con respuesta y el editor avisa (`avisoDeLibertad`); el motor no frena el precio en
un escenario DE plata en «Sola». **La IA sigue prudente** (`libertadesDeFabrica`: lo que arma ✦ Armar y el conversor de
lo de antes), y el conversor de un «Si responde» viejo también, porque ahí el freno del texto hacía que no saliera solo:
convertido con la regla nueva, contestaría distinto.

**Vive en:** `lib/ai-step-libertad.ts` · `lib/ai-step-armar.ts` · `lib/paso-ia-convertir.ts` · `lib/setter-conversacion.ts` (`puedeContestarSolo`) · `app/automations/EditorPasoIA.tsx`

## TikTok fase 0 (14/10/2026): el AI Step contesta por Instagram y Messenger

Lo hecho está en `c9cdbdf3a` (decisión de producto: docs/diseno-ai-step-v2.md §6; plan: docs/diseno-tiktok-linkedin.md §4).

- **⚠️ El diagnóstico obvio era UNA línea y eran nueve lugares.** El plan decía «`pausarPorRespuesta` con `soloPausa`
  sólo pausa»: sacar ese `return` hacía que un DM pasara por todo lo de abajo, y TODO asumía WhatsApp. El historial
  (`mensajesRecientesDelLead` por línea), «¿entró uno más nuevo?», el borrador (`guardarBorradorSetter` con teléfono),
  el audio, el tope de «Sola» (`wa_borradores`), los mensajes fijos de la rama (`enviarYEspejar`), la pregunta de la
  charla (`charlaDelLead` miraba `escuchaPor(..., 'whatsapp')` fijo, así que un AI Step de Instagram nunca abría
  charla), «Probar» (el simulador expandía el AI Step de WhatsApp) y «Editar con IA» (`validarIA` rechazaba CUALQUIER
  «si_responde» en un flujo social: editar un flujo de Instagram con su AI Step habría dado error). Sacando sólo el
  `return`, un DM le dejaba al lead un borrador que salía POR WHATSAPP. Cada lugar quedó con su rama y su test.
- **Lo que le salió a un lead por Instagram no está en `ig_mensajes`.** El envío por Zernio no escribe ahí (el
  webhook no guarda `message.sent`, a propósito): lo saliente vive en `nutricion_envios`. La charla para el redactor se
  arma de las DOS (`filasDeCharlaSocial`, pura y con test); con sólo `ig_mensajes` el redactor no sabría qué se le
  contestó y repetiría la pregunta. Por lo mismo, cada respuesta del AI Step que sale deja su fila (canal social, autor
  'ia'): es lo que cuenta el tope de «Sola» por 24 h y lo que lee la charla siguiente.
- **«Para aprobar» por las redes no tiene bandeja**: el texto ENTERO va en el aviso al grupo («Te dejé esta respuesta
  para mandarla tú por Instagram»), como pidió el §6. Sin audio. La ventana de 24 h la mira el envío (`decidirSalida`):
  es una respuesta a algo que la persona acaba de escribir.
- **La clave de idempotencia es la del MENSAJE que se contesta** (`ai-step:<secuencia>:<lead>:<ms del entrante>`):
  Zernio reintenta hasta 7 veces, y con una clave nueva por intento cada reentrega mandaba otro DM.
- **El webhook de Zernio pasó de 120 a 300 s**: ahora redacta con IA en el `after`, como el de WhatsApp.
- **«Cambia WhatsApp por Instagram» (Editar con IA) MUDA el AI Step** en el mismo id, sin su audio. Antes lo sacaba
  porque «todavía no contesta», que ya no es cierto. Un «Si responde» de los de siempre se sigue sacando: escucha por
  WhatsApp.

Lo que quedó sin hacer, con su archivo:
- **«Crear con IA» no arma un AI Step de Instagram** (`lib/flujo-ia.ts`, `deIA`): `nodoDe` le saca la IA a un mensaje
  social y `respuestaAPasoIA` (`lib/paso-ia-convertir.ts`) sólo pliega «MaKo contesta» de WhatsApp. Hoy lo saca con el
  aviso «el AI Step de Instagram se suma desde el ＋».
- **La PRIMERA DM de un lead nuevo no la contesta el AI Step**: esa persona no era lead, así que no hay respuesta que
  atender; la arranca el CRON «Te envía un mensaje» y la contesta su primera tarjeta. El AI Step contesta desde la
  segunda (`lib/zernio-entrante.ts`, `pausar` sólo con `yaEraLead`). Si se quiere que conteste la primera, es una
  decisión de producto (y choca con la bienvenida).
- **Nada de esto corrió contra un DM real**: el 12/10 ningún workspace tenía `webhook_ok`. Falta la cuenta de prueba de
  Martín en ws3.
- **La API de MaKo no configura el medio de un AI Step**: en main no edita flujos con ramas (eso está en la rama sin
  subir `wip/api-acciones-*`). El comportamiento nuevo no es una operación: lo hereda toda automatización.
- Rojos ajenos en main al medirlo (14/10 ~17:00): `tests/api-mako-landing-editor.test.ts`, `tests/integracion-sin-salir.test.ts`
  (dos archivos del editor de landings) y `tests/cobranza.test.ts`.

**Vive en:** `lib/nutricion.ts` (`pausarPorRespuesta`, `contextoDeRespuesta`, `redactarRespuesta`, `contestarSolaPorRedes`, `mandarMensajeDeRespuesta`) · `lib/canal-social.ts` (`filasDeCharlaSocial`) · `lib/canal-zernio.ts` (`charlaSocialDelLead`) · `lib/zernio-entrante.ts` · `app/api/webhooks/zernio/route.ts` · `lib/simulador-grafo.ts` · `app/automations/PanelProbar.tsx` · `app/automations/EditorPasoIA.tsx` · `lib/flujo-ia.ts`

## `probar_secuencia` manda UN escenario (14/10/2026)

Lo hecho está en `d488977f0`.

- **Mandar «todos los pasos» de un flujo con ramas es mandar una prueba que ningún lead recibe.** La prueba en vivo
  (`probarSecuencia`, la de la API) recorría el ARRAY: con una condición, el dueño recibía el «Sí» y el «No» juntos, y el
  `[PRUEBA n/N]` contaba las tarjetas del array, no los mensajes del camino. Ahora manda los de UN escenario
  (`escenarioDePrueba` → `mensajesDelEscenario`), los MISMOS de «Probar» y de `escenarios_secuencia`
  (`escenariosDeLaSecuencia`, una regla, un lugar). Con más de un escenario, la API pide cuál (en `preparar()`: se sabe
  sin escribir); el número sale de `escenarios_secuencia`.
- **Un paso de Instagram o Messenger se mandaba como EMAIL.** El bucle era `if (whatsapp) {…} else {email}`: todo lo
  que no fuera WhatsApp caía al email, con el asunto vacío. Ahora se saltea con su aviso (Meta no deja escribir primero).

Lo que quedó sin hacer: la acción `probar` de `app/api/chat-agent/secuencias/route.ts` no tiene quién la llame en la
app (medido el 14/10: el único `action: 'probar'` es de otra ruta); prueba el escenario 1.

**Vive en:** `lib/setting-secuencias.ts` (`escenarioDePrueba`, `probarSecuencia`) · `lib/simulador-grafo.ts` (`mensajesDelEscenario`, `escenariosDeLaSecuencia`) · `lib/api-mako/areas/chatbot.run.ts` · `lib/api-mako/areas/chatbot.def.ts`

## «Los avisos al equipo salen igual» (14/10/2026)

Lo hecho está en `87bdf9530` (§2.4-h de docs/diseno-mako-nada-por-detras.md). Con horario de oficina, «MaKo en WhatsApp»
salía fuera de horario sin decirlo; ahora es una casilla del horario, prendida de fábrica.

- **Lo guardado no trae el campo**, así que el saneo lee «ausente» como prendido (sólo un `false` literal lo apaga): leído
  como apagado, el primer deploy habría cortado los avisos de agendado de noche en todos los negocios con horario.
- **El cambio vive en lib/nutricion.ts, no en `seMueveEnLaCorrida`** (lib/nutricion-grafo-motor.ts, que es de
  `crm-bloques-b5`): con la casilla apagada, fuera del horario se pregunta sólo `esHiloDelCarril`.
- ⚠️ Un test (`tests/motor-freno-ventana.test.ts`) fija las tres líneas de `fueraDeHorario` seguidas: la lectura de la
  casilla va DESPUÉS de ellas, no en el medio.

**Vive en:** `lib/horario-envio.ts` (`avisosAlEquipo`) · `lib/nutricion.ts` (`makoFueraDeHorario`) · `app/configuraciones/HorarioEnvioPanel.tsx`

## «Email a la persona» y el dato SECRETO: restablecer la contraseña (15/10/2026)

Lo hecho está en `6ed57990d` (docs/diseno-2fa-obligatorio.md §9). Un evento de MaKo de una PERSONA (`contrasena_restablecer`)
le escribe por email a ese usuario, por el remitente de MaKo, con un link de un uso.

- **El propósito se DECLARA en el evento; no se deduce.** La primera versión mandaba el código y el link al mismo correo
  «porque traen un secreto». Ciberseguridad lo frenó: un código del 2FA va SÓLO al correo de respaldo (al de Google no es
  un segundo factor), y el link de restablecer va al de la cuenta. Deducido, el link habría ido a un correo que la
  mayoría no tiene. Quedó `EventoMako.persona`.
- **Un secreto no se cuida en un lugar: se cuida en cada lugar donde se GUARDA o se COPIA.** La corrida guarda su
  contexto en dos caminos: el DELAY (`ctxParaDormir`) y el reintento de una CONDITION, que guarda el contexto ENTERO. El
  feed recibe el `texto` del emisor cuando no hay ninguna fila prendida. Y un error de Resend puede repetir el cuerpo.
  Cada uno tiene su tapa: `sinSecretos`, el emisor sin `texto` (`avisarPedidoDeRestablecer`) y `sinValoresSecretos`.
- ⚠️ **Un freno escrito dos veces esconde una rotura.** El DELAY con secreto se frenaba en el barrido y en el recorrido, y
  sacar el primero no hacía fallar nada: el segundo lo tapaba. Quedó uno, el del barrido, que además ve un DELAY suelto.
- ⚠️ **«Los tests que tocan lo que cambié» no encuentra a los guardias que BARREN el código.** Se corrieron 127 archivos
  elegidos por los módulos que importan, y el push dejó main en rojo: `tests/undecima-email-propio.test.ts` lista en
  positivo cada archivo que llama `sendEmail` con el remitente de MaKo, y lo encuentra por PATRÓN (`sendEmail(`), no por
  import. Lo cazaron otros dos chats. Antes de pushear un cambio que llama algo sensible (`sendEmail`, el remitente,
  una credencial), correr también los barridos: `grep -l "ls-files\|readdirSync\|barrido\|sendEmail" tests/*.test.ts`.
- **Lo de SuperAdmin va APARTE de la galería de los negocios** (`PLANTILLAS_PLATAFORMA`). Metida en `PLANTILLAS`, rompía
  «13, una por categoría, en orden de embudo» y la habría ofrecido a cada negocio. Lo que se ofrece lo dice
  `plantillasPara`; lo que se crea lo frena `crearDesdePlantilla` (`deps.plataforma`, fail-closed). La pantalla sabe si
  es la plataforma por un contexto que pone app/automations/page.tsx.

Lo que quedó sin hacer, con su archivo:
- `lib/destino-usuario.ts` es de Seguridad: entra a main antes que esta rama.
- La fila en el ws de la plataforma se crea con la plantilla cuando esté en prod, y se prueba con la cuenta de Martín.
- El aviso «se cambió tu contraseña» y `ingreso_nuevo` usan la misma tarjeta, sin secreto: después del 21/10.

**Vive en:** `lib/email-persona.ts` · `lib/restablecer-aviso.ts` · `lib/aviso-evento.ts` (`pasosDelEvento`, `datosDeLaPersona`, `secretosDelEvento`) · `lib/variables-aviso.ts` (`secreto`, `sinSecretos`) · `lib/flujo-corridas.ts` · `lib/plantillas-automatizaciones.ts` (`PLANTILLAS_PLATAFORMA`)

## La «Reentrada» del CRON (14/10/2026)

Lo hecho está en `58f5cabdb` (diseño: docs/diseno-mako-nada-por-detras.md §1-B y §2.4-a).

- **«Cada vez que vuelve a entrar» NO puede correr por el barrido.** El barrido del CRON (la cohorte) mira quién ESTÁ
  en la etapa, no quién acaba de llegar: un lead parado ahí habría vuelto a recibir la automatización entera en cada
  corrida. «Vuelve a entrar» es un EVENTO (`enrolarPorEvento`) o un «Ir a» / ⚡ inscribir; el barrido sólo reusa con
  «Otra vez si es otra reunión», donde la reunión dice que es otra (`puedeReentrar`, `solo_por_evento`).
- **Sin guardar, la regla de antes, y no «Una sola vez».** Leer la columna en null como «Una sola vez» le habría sacado
  el reuso a toda «Un Lead Agendó Llamada» creada desde la galería mientras sus plantillas no la escriban: un cambio de
  comportamiento que nadie decidió (lo marcó también el chat del CRM). El respaldo es transitorio y el panel del CRON lo
  muestra como lo elegido (`reentrada_efectiva`), así que no queda escondido.
- **«Otra vez si es otra reunión» necesita la reunión ANOTADA.** El reuso compara contra `reunion_at`, y esa columna
  sólo se escribía en los flujos que preparan una reunión por su forma. Elegida en otro flujo, caía siempre en «no sé
  qué reunión preparaba». Ahora la anota `anotaReunion` (la forma, o esa opción).
- **La lectura de un «Ir a» no toleraba una columna que falta.** `inscribirEnSecuencia` pedía su lista a mano: sumarle
  `reentrada` la habría tirado antes de aplicar la 0279. La lista pasó a una constante y se reintenta sin la columna,
  como las lecturas del motor.

Lo que quedó sin hacer, con su archivo:
- **La 0279 quedó aplicada en prod el 15/10**: la columna está vacía en las 93 automatizaciones, así que todas siguen con
  la regla de antes. Se le había preguntado a Martín y contestó «No entiendo esta pregunta»: una columna nueva que no
  cambia nada no era una decisión suya (AGENTS.md, «A la Ticketera va lo que DECIDE Martín»).
- `scripts/reentrada-explicita.mts` (la deja escrita en las que existen) NO se corrió: con la columna vacía el motor
  hace lo de antes. Hace falta recién para sacar el respaldo de `reentradaDe`, y ese día se corre.
- Las plantillas (`lib/plantillas-automatizaciones.ts`, `lib/plantilla-crear.ts`) y una operación de la API
  (`cambiar_reentrada_secuencia`, chatbot.def/run): después de que integre `crm-bloques-b5`, que toca esos archivos.
  Cuando entren, el respaldo de `reentradaDe` se va.

**Vive en:** `lib/reentrada.ts` · `lib/nutricion.ts` (`reentradaDeSecuencia`, `anotaReunion`, `reusablesDe`, `setSecuenciaReentrada`) · `lib/nutricion-inscripcion-manual.ts` · `app/automations/SecuenciaPerfil.tsx` · `app/api/whatsapp/secuencias/route.ts` · `supabase/migrations/0279_reentrada_cron.sql`

## Dos personas no pudieron conectar una flecha: el gesto existía, pero no se descubría (15/10/2026)

Lo hecho está en `50f263134`. Mauricio y Joan, mirando el lienzo, no supieron conectar una tarjeta con otra.

- **El diagnóstico obvio era el equivocado.** El pedido decía «revisa cómo lo hace ManyChat para hacerlo simple», y el
  arrastre del círculo YA era el de ManyChat: soltar en cualquier punto de una tarjeta, el resto atenuado, el menú al
  soltar en el vacío. Rehacer el arrastre no arreglaba nada.
- **Lo que faltaba era el CLIC.** Tocar el círculo ofrecía sólo tarjetas NUEVAS: quien lo tocaba veía «qué tarjeta
  nueva querés» y no tenía cómo decir «a ésa». La ayuda de ManyChat dice que se conecta «haciendo clic en el punto de
  conexión y eligiendo otro paso». Ahora el menú ofrece primero «Conectar a una tarjeta»: el lienzo espera el toque en
  una tarjeta y la conecta. Dos clics, sin puntería, y anda en el teléfono.
- ⚠️ **De Make NO se copió arrastrar la tarjeta entera hasta otra para conectarlas.** Arrastrar una tarjeta es moverla
  para ordenar el lienzo; conectar sin querer es peor que no poder. Si vuelve a proponerse, es esto.

**Vive en:** `app/_components/Lienzo.tsx` (`eligiendo`, `empezarAElegir`, `TOQUE_CIRCULO`)

## «MaKo en WhatsApp» fuera del horario: lo decide la tarjeta, y el runner de eventos no miraba el horario (15/10/2026)

Lo hecho está en `c46ee888f` (§2.4-h de docs/diseno-mako-nada-por-detras.md). La tarjeta ofrece «Fuera del horario:
Espera a que abra / Lo manda igual», de fábrica espera (Martín), y su chip dice cuándo saldría.

- **El runner de los EVENTOS de MaKo no miraba el horario.** El de los leads ya esperaba (con la casilla del 14/10);
  el de los eventos (cobranza, entró un pago, el AI Analyst, un lead contesta) mandaba a cualquier hora. Se encontró
  leyendo el runner, no suponiendo que los dos hacían lo mismo.
- **La CONDITION espera con la tarjeta y se decide AL SALIR.** Si se decidiera al encolar, un «su reunión sigue en pie»
  evaluado a las 23 y mandado a las 9 podría mentir (`esperaApertura`). Con un DELAY en el medio, el DELAY duerme solo.
- ⚠️ **`paramsConPartes` conservaba sólo `leadId` y `titulo`:** cualquier campo nuevo de la tarjeta se borraba al
  editar el texto. `fueraDeHorario` viaja ahí; un campo nuevo de la tarjeta, también.
- ⚠️ **Un hook del cliente que importa una acción del server tira los tests** (`server-only` al cargar el módulo): el
  lienzo lo importan decenas de tests. El horario lo lee la página del server y lo reparte un contexto
  (app/automations/horario-oficina.tsx).
- **Medido antes de cambiar el default:** sólo el ws1 tiene horario (9 a 21) y nadie había guardado la casilla del 14/10.
  Lo único que cambia es su «Un Lead Agendó Llamada» (#213): el aviso de las 23 llega a las 9.

**Vive en:** `lib/mako-tarjeta.ts` (`esperaQueAbra`, `chipDeEspera`) · `lib/horario-envio.ts` (`proximaApertura`, `textoDeApertura`) · `lib/nutricion.ts` (`sigueIgual`) · `lib/aviso-evento.ts` (`esperaApertura`) · `lib/flujos.ts` (`aperturaDelNegocio`)

## El chat del lienzo editaba cuando le preguntabas: «No cambies nada, sólo explícamelo» terminó en «Cambié 1» (15/10/2026)

**Síntoma (medido en producción, 15/10 ~19:30 AR, en «Un Lead Entró» #198):** «¿Qué hace esta automatización? No cambies
nada, sólo explícamelo.» estuvo ~100 s en «Escribiendo el flujo» y contestó «Cambié 1». El borrador tenía el texto que
acompaña al audio de bienvenida reescrito: «Te dejo aquí el video: https://confirmar.lovable.app» pasó a «Hola estimado
{{nombre}}! espero que estés muy bien! …», **sin el link del video**. No se publicó: se deshizo con ↶, y al recargar la
fila seguía con `updated_at` del 12/10 y `pasos_borrador` en null.

**Causa:** no era el modelo. La ruta (`app/api/chat-agent/secuencias/ia`) mandaba TODO lo que se escribe en el chat al
prompt de EDITAR, que sólo sabe devolver cambios. No había un camino para contestar una pregunta. Joan y Mauricio usan
ese chat.

**Lo que quedó (dos capas):**
- **Una pregunta no pasa por editar.** `esConsulta` (lib/flujo-ia-consulta.ts) decide antes de llamar al modelo, y lo que
  es claramente una pregunta va a un prompt (`chatbot.explicar-ia.system`, editable en /configuraciones) que sólo puede
  devolver `{"respuesta"}`. La ruta devuelve el borrador tal cual: no hay forma de que cambie una tarjeta. En el chat se
  ve «Pensando la respuesta» en vez de «Escribiendo el flujo».
- **Lo que se le escapa a la regla:** el prompt de editar ahora también puede contestar con "respuesta", y si lo hace
  `deIAEdicion` no aplica NADA de lo que haya traído junto, ni el cambio de canal que se lee del pedido.
- ⚠️ **La regla es a propósito estrecha.** En español «¿Qué manda?» y «Manda un email» usan la misma forma del verbo, así
  que un verbo de cambio al principio de una frase, con un pronombre pegado («agrégale») o detrás de «¿puedes…?» la saca
  de la consulta y la manda a editar. Ante la duda edita, y el modelo decide con la segunda capa. Una negación («no
  cambies el audio») se borra antes de buscar el pedido: sin eso, «¿Puedes no cambiar nada…?» se leía como «¿puedes
  cambiar…?».
- ⚠️ **Hay otra `respuestaDe` en lib/flujo-ia.ts** (la del «Si responde», devuelve un Set). Importar una con el mismo
  nombre no da error en tsx: la local la tapa y el test vio `Set {undefined}` donde esperaba un texto. La del modelo se
  llama `respuestaDelModelo`.
- **Para editar, «no cambió nada» es un error que pide otro intento** (`erroresEdicion`). Por eso la ruta no revisa una
  respuesta: si lo hiciera, cada pregunta pagaría un reintento y terminaría en «MaKo armó el flujo pero quedó mal».

**La trampa que costó la pasada:** el Chrome de Martín tenía abierta la sesión de **Mauricio** (cliente, ws1), no la de
super admin. Para un usuario normal `?ws=3` no hace nada y no da error: se ve SU negocio. Las automatizaciones que
parecían de ws3 eran la #198 y la #213 de Mauricio. Lo delató medir en la base (ws3 tiene cero automatizaciones vivas) y
`/api/auth/me`. **Antes de una pasada en producción: `/api/auth/me` y mirar `email` y `ws`.** (También en
docs/hallazgos-infra.md.)

**SIN HACER:**
1. **Un cambio pedido de verdad puede reescribir otra tarjeta** que nadie nombró, y llevarse un link. Nada lo frena: la
   capa de hoy sólo cubre preguntas. La pista es comparar los links y los datos de cada mensaje `cambiado` contra el
   de antes (lib/texto-critico.ts ya lo hace con el mensaje que la IA reescribe al mandarlo).
2. **~100 s para tocar una tarjeta.** No se midió dónde se va el tiempo (la cascada, `armarContexto` o la reparación).
3. **La pasada con clics en ws3 sigue sin hacer.** Hace falta la sesión de super admin en el Chrome.
4. **Dos mensajes de prueba en el chat de MaKo de la #198 de Mauricio** (`app_settings` `automatizacion.chat:198`, ws1):
   la pregunta y el «Cambié 1». Es la fila entera (no tenía nada antes); se borra con el OK de Martín.

**Vive en:** `lib/flujo-ia-consulta.ts` (`esConsulta`, `pideCambio`, `EXPLICAR_IA_SYSTEM_TEMPLATE`) · `lib/flujo-ia.ts`
(`deIAEdicion`, la salida temprana con `respuesta`) · `app/api/chat-agent/secuencias/ia/route.ts` (`contestar`) ·
`app/automations/stream-ia.ts` (`TEXTO_FASE.respuesta`) · test: `tests/flujo-ia-consulta.test.ts`

## Las doce de Martín del 15/10: la punta de la flecha trabada, y «Probar» con casos imposibles, sin lead y aplastado (15/10/2026)

La lista literal está en docs/relevo/chatbot.md. Hasta ese día vivía sólo en un mensaje entre chats que nadie leyó.

**1. La punta de la flecha quedaba trabada (ni Esc la soltaba).** La lista de puntas se dibujaba con
`!arrastreFlecha && …`. Cuando el gesto pasaba a ser un arrastre (`moverCirculo` → `setArrastreFlecha`), React
**desmontaba la punta que tenía el puntero capturado**: el `pointerup` no le llegaba a nadie, `soltarCirculo` no
corría y `arrastreFlecha` quedaba puesto para siempre. Esc sólo cancelaba «Conectar a una tarjeta». Ahora:
- la punta llevada sigue montada (se esconden las demás);
- si igual se pierde el `pointerup`, lo cierra la ventana;
- Esc cancela.
⚠️ **Regla: un elemento con `setPointerCapture` no puede depender de un estado que el mismo gesto cambia.** Si
desaparece, el gesto queda abierto. Las zonas del medio de cada flecha sí se esconden enteras: ésas no capturan.

**5. «Una cantidad impresionante de chats» en «Un Lead Agendó Llamada».** Medido en #213: 8 escenarios y uno
afuera, casi todos IMPOSIBLES («No: Su reunión sigue en pie · … · Su reunión sigue en pie»). `escenariosDePrueba`
abría cada condición por su cuenta, aunque dos preguntaran lo mismo, así que salía el producto de todas. Ahora un
escenario es una combinación de **hechos**: cada fila sin su «No» (`claveHecho`), que se abre recién cuando una
condición la pregunta, y primero con el valor del lead recién llegado. El mismo hecho vale lo mismo en todo el flujo,
y dos combinaciones que se ven igual en el chat son una. #213 quedó en 3.
⚠️ Un hecho que cambia con el tiempo (la reunión se cancela entre el «1 h antes» y el «15 min antes») se prueba
como fijo. Es a propósito: la prueba muestra caminos, no carreras.

**6. «En ninguno de esos casos el LEAD responde».** Con un AI Step que escucha por ese medio hay un caso más por
cada uno de sus casos (hasta 4), o «Lo demás» con su objetivo si no tiene casos. Después del primer mensaje, el lead
escribe algo de ese caso: lo arma el server con la acción `mensaje-lead` y el prompt `automations.probar.lead`. Lo
demás es la prueba de siempre: lo clasifica el clasificador del motor y contesta el AI Step. **Si el clasificador lo
manda a otro caso, se ve**, y eso es un hallazgo de la prueba, no un error.
⚠️ La API (`escenarios_secuencia`, `probar_secuencia`) NO ofrece esos casos: por WhatsApp no hay quién escriba como el
lead, y mandaría lo mismo que el primero.

**7 y 8. «La tab muy compacta».** «Probar» medía como mucho 560 px (el 40 % del lugar) y la lista se comía 172: el
chat quedaba en unos 300 px en una pantalla de 1536. Ahora:
- con contactos pide hasta 820 px (`muelles`, `probarConContactos`);
- si el cuerpo mide menos de 640 px, la lista pasa a una fila de fotos arriba del chat (como las historias), así el
  chat no se achica nunca por la lista. Es la misma pieza para el teléfono.

**9, 10, 11 y 12.**
- 9: el hilo TERMINADO de cada caso se guarda con la firma del flujo; volver a él lo muestra sin animar (`ChatHilo`
  se remonta por caso y sólo anima lo que llega después).
- 10: «Caso N», y la primera píldora del hilo dice cuándo cae.
- 11: «Hay más caminos» sale.
- 12: fotos de randomuser.me, con la inicial si no carga.

**SIN HACER:**
- **2 («en Automations de SuperAdmin no veo las automatizaciones que armamos para los clientes de MaKo»).** Medido el
  15/10: el ws 9 tiene UNA sola automatización viva, «Restablecer Contraseña» (#251, pausada). Las demás del ws 9
  están archivadas desde agosto. Los mensajes de sistema a los clientes (caída y vuelta del WhatsApp, Fathom:
  `AVISOS_SOLO_SUPERADMIN`) siguen en /mensajes como avisos, no como automatizaciones, aunque la regla de Martín es
  que «un Mensaje de MaKo ES una automatización». Falta que diga qué espera ver: esos avisos pasados a
  automatizaciones del ws 9, o las automatizaciones de cada cliente vistas desde SuperAdmin.
- **3, la línea de WhatsApp de SuperAdmin:** en docs/hallazgos-comunicacion.md, espera decisión.
- **4 («Probar se ve rota») y 7 (la caja de escribir) no se vieron en el navegador.** El Chrome de Martín tenía la
  sesión de Mauricio, y con la RAM al límite no se levanta `next dev`. Lo arreglado es lo que el código explica (el
  ancho); falta mirarlo con la sesión de super admin.
- Las fotos se piden a randomuser.me desde el navegador de quien prueba (un tercero ve esa IP). Si molesta, se
  bajan a /public.

**Vive en:** `app/_components/Lienzo.tsx` (la red del arrastre, `tarjetaBajo`) · `lib/simulador-grafo.ts`
(`escenariosDePrueba`, `claveHecho`, `salidaConHechos`) · `app/automations/PanelProbar.tsx` (`BarraEscenarios`,
`pildoraDelCaso`, `escribirComoLead`, `hilos`) · `lib/probar-lead.ts` · `lib/lienzo-grafo.ts` (`probarAnchoContactos`)
· tests: `tests/lienzo-punta-flecha.test.ts`, `tests/probar-casos.test.ts`

## Los Mensajes de MaKo a sus clientes pasan a ser automatizaciones de SuperAdmin: las trampas de mudarlos (15/10/2026)

El 2 de las doce de Martín. El diseño, en docs/diseno-avisos-plataforma.md. Medido: el catálogo tiene 72 avisos, sólo 7
con evento de MaKo, y **65 los mandaba el código por fuera de una automatización**. Mudados: la línea caída y la que
volvió. La receta sirve para los demás.

- ⚠️ **`textoConDatos` toma un dato VACÍO (`''`) como un valor.** El renglón «📱 {{linea_numero}}» quedaba con el «📱»
  solo para una línea sin número ni etiqueta. Un dato que no se sabe tiene que FALTAR, no venir vacío: así el renglón
  se va entero (`datosCaida`, lib/linea-vigilancia.ts). Vale para todo emisor que pase `datos`.
- ⚠️ **El vigilante de líneas lee `wa`** para marcar «avisado», y sin esa marca el «volvió» no sale nunca. El camino por
  evento devolvía `wa: false` siempre («ningún llamador de estos tres lee `wa`»). Para uno de la plataforma ahora dice si
  corrió. **Antes de mudar un aviso: `grep` de quién lee su resultado.**
- **Sin hueco y sin duplicado:** mientras la plataforma no tenga NINGUNA fila con el evento (ni pausada), el aviso sale
  como antes (`sinFila`); con una, decide ella. Por eso la mudanza va en dos pasos: el deploy, y después el script que
  crea la fila prendida (scripts/mudanza-avisos-plataforma.mts).
- **El texto de siempre sale de los mismos datos** que cita la plantilla (`datosCaida` → `textoCaida`), así no pueden
  decir cosas distintas. Como el código y la plantilla se mueven juntos, lo que fija que el CLIENTE reciba lo mismo es
  la comparación letra por letra con el texto de antes, no la comparación entre los dos. (La rotura que cambiaba el
  texto pasó verde hasta que se sumó.)
- Un evento de la plataforma **no trae lead**: una CONDITION no se cumpliría nunca y se rechaza, como en los de una
  persona.
- En /mensajes desaparecen al volverse eventos, como los demás. Mientras no haya fila, el envío de siempre sigue leyendo
  su interruptor del store, que ya no se ve. Es por el rato entre el deploy y el script.
- ⚠️ **Normalizar los dos lados de una comparación esconde lo que se pierde de UNO.** El test comparaba plantilla y texto
  de siempre después de quitarles «— MaKo» a los dos, y la plantilla no la tenía: con la fila creada, el cliente la
  habría recibido sin firma. Una tarjeta TAL CUAL manda el texto exacto (el envoltorio con «— MaKo» era de las tarjetas
  de antes, ver «La tarjeta MaKo en WhatsApp» más arriba), así que la firma va escrita en la plantilla, como en las de
  cobranza. **Al mudar uno: lo que la normalización saca, se compara aparte.**
- **Un pedazo de renglón no puede ser opcional en una plantilla:** `textoConDatos` sólo saca el renglón ENTERO cuyo dato
  falta. Fathom decía « (42 min)» dentro de la frase; en la plantilla la duración va en su renglón («⏱️ 42 min»). Es el
  único cambio de forma de los tres, y es a propósito.
- Un helper que necesita un test **no puede vivir en `lib/lead-resumen.ts`** (es `server-only`): los datos de Fathom
  están en `lib/reunion-grabada.ts`, puro.

- ⚠️ **En un evento de la plataforma, `ws` es donde CORRE la fila (el ws 9), no a quién le llega.** Grupo, datos y links
  ya usaban `negocioWs`, pero el horario de oficina se leía de `ws`: la tarjeta esperaba la oficina de Martín. No se
  notaba porque el ws 9 no tiene horario (medido el 16/10). Lo arregló a5b9e6d06. **Al sumar algo que el runner de
  eventos lee por ws, preguntar: ¿es de quien corre la fila o de quien recibe la tarjeta?**
- **El reporte semanal no sale por WhatsApp, sale por EMAIL al equipo.** Por eso hizo falta «MaKo por email» (un campo
  de la misma tarjeta, no una tarjeta nueva): `canal: 'email'` + `asunto`. Termina en `enviarAvisoPorEmail`, el camino
  de siempre de un aviso con email (los destinatarios del negocio, desde equipo@hola-mako.com) y SIN push, porque la
  tarjeta dice email. El cron sigue decidiendo a qué negocio le toca (sus preferencias) y armando el reporte; la fila
  sólo lo MANDA. Sin fila, `despacharReporte` como siempre (`emitirEventoDePlataforma` no cae al motor de avisos).
- **Medido el 16/10, el semanal le llega a 8 negocios** (ws 1, 9, 10, 11, 13, 14, 18 y 19). Un error existente que la
  mudanza saca: el pie del correo firma con el nombre del contacto del PROPIO negocio (`fromName: perfil.nombre` en
  `despacharReporte`), cuando los correos de la plataforma firman «MaKo» (lib/email-html.ts). Con la fila, ese renglón
  no está.

**SIN HACER:** correr el script después del deploy (crea las CUATRO filas: la caída, la vuelta, Fathom y el reporte); y
los otros 61, por familias.

**Vive en:** `lib/disparadores.ts` (`EventoMako.plataforma`) · `lib/aviso-evento.ts` (`emitirPorEvento`, `sinFila`) ·
`lib/avisos.ts` (`emitirDelCatalogo`) · `lib/flujos.ts` (`negocioWs`) · `lib/linea-vigilancia.ts` (`datosCaida`) ·
`lib/reunion-grabada.ts` (`datosPostLlamada`) · `app/api/webhooks/fathom/route.ts` ·
`lib/mako-tarjeta.ts` («MaKo por email»: `CanalMako`, `problemaDeEmailMako`, `avisoPorEmail`) ·
`app/api/cron/reporte-semanal/route.ts` · `lib/reporte-destino.ts` (`datosDelReporte`) ·
`lib/plantillas-automatizaciones.ts` (`PLANTILLAS_PLATAFORMA`) · tests: `tests/avisos-plataforma.test.ts`,
`tests/reporte-semanal-plataforma.test.ts`

## «Probar» visto en producción (16/10/2026): el ws3 no sirve, y lo que sólo se veía con clics

- ⚠️ **Para mirar una tab en el Cliente de Prueba (ws3), el onboarding pendiente la tapa** y lleva a /onboarding (trampa
  ya escrita en la memoria de verificar en el navegador). Terminar su onboarding le cambiaría un estado que quizá está así a propósito. Se probó en el ws 9 (la plataforma, de
  Martín) con una automatización creada para eso: #252 «Un Lead Agendó Llamada», pausada y sin CRON (no entra nadie).
  **ARCHIVADA el 16/10, no borrada** (borrar espera el OK de Martín): se deshace con `archivada_at = null`.
- **Los casos en que el lead contesta salían sobre un camino SIN mensajes.** Sin CRON, el lead recién llegado no tiene
  reunión y su camino («la reunión ya pasó») no manda nada. El lead escribe después del primer mensaje, así que nunca
  escribía, y la prueba terminaba en «Fin». Ningún test lo veía: todos tenían un primer camino con mensajes. Ahora
  salen del primer camino con mensajes, y si no llega ninguno el lead escribe al terminar (`terminarSalida`).
- **La píldora de cuándo cae decía seis hechos**, «Tiene WhatsApp · Tiene email» en todos. Ahora dice sólo los que
  distinguen un caso de los otros.
- **Visto bien:** «Caso N» con fotos; la fila de fotos con el panel de ~645 px (en 1536 de ancho no entra la columna);
  sin «Hay más caminos»; volver al Caso 1 lo muestra terminado y sin animar; en el ws 9, ninguna tarjeta de WhatsApp
  dice «Sin conectar» y el AI Step lleva «No escucha respuestas» (un `span`, no ofrece conectar).

**Vive en:** `lib/simulador-grafo.ts` (`escenariosDePrueba`: `primero`, `distinguen`) · `app/automations/PanelProbar.tsx` (`terminarSalida`)

## El AI Step en vivo: la red de plataforma y las notas de voz (16/10/2026)

Dos huecos de docs/mapa-ia-24h.md, con la decisión A de Martín («lo que responde en vivo, con API»). Los dos dejaban a
un lead REAL sin respuesta. Una revisión adversarial del mismo día encontró 11 defectos en la primera versión, y la
mayoría eran del mismo tipo: **lo que se agrega a un camino en vivo cambia los tiempos y los datos de lo que ya estaba**.

- **La red ya existía; lo que faltaba era pedirla.** `chatCheapCascade` tiene `redDePlataforma` desde agosto (otro
  proveedor primero, el motivo «⚠ red de plataforma», los errores de la red aparte). El clasificador, el redactor y la
  calificación no la pedían. Un negocio sin key propia veía cómo el clasificador devolvía '' y el lead caía en «Otra cosa».
- ⚠️ **La red va como OPCIÓN del que llama (`EnVivo`), nunca fija en la función compartida.** La primera versión la
  puso fija en `responderSimulador`, y eso la abría también a las lecturas de la API (`simular_respuesta_setter`,
  `evaluar_calificacion_charla`), que un agente externo puede llamar en bucle. Esas llamadas gastaban la cuota gratis
  de la agencia, que es de la que viven las respuestas en vivo de todos. **Regla:**
  - la piden el motor (con plazo) y el Probar, porque AGENTS.md dice «todo camino de IA que use un cliente necesita su
    red»;
  - la API, no, y esa excepción es a propósito.

  El diagnóstico obvio («el Probar no le contesta a nadie, que vaya sin red») era el equivocado: lo usa un cliente, y
  sin red un negocio sin keys ve fallar su prueba como antes fallaba en vivo.
- ⛔ **Y lo del lead es PII** (regla del 16/10/2026 en AGENTS.md: los datos de los clientes de un cliente nunca van a
  un proveedor que entrena, y el plan gratis de Gemini entrena). El motor marca `pii: true` en clasificar, redactar y
  calificar. Así la red va sólo por el crédito de Claude de la plataforma: el corte de PII de `chatCheapCascade` la
  frena antes de las keys gratis. La nota de voz también lleva `pii` en `transcribirAudio`, que tiene su PROPIA red y
  no pasa por ese corte: con la marca, la saltea. Para escuchar no hay crédito de Claude, así que un negocio sin keys
  propias no escucha la nota, y el aviso dice por qué («no hay ninguna API key de IA cargada»). La primera versión de
  este trabajo mandaba las dos cosas a la red gratis, y no se subió.
- ⚠️ **Todo corre adentro del webhook** (`maxDuration` 420 s). El webhook espera al motor, y Evolution no reintenta
  (la fila ya existe y vuelve). Sin plazo, una red lenta mataba la función sin borrador ni aviso. Ahora va
  `PLAZO_AI_STEP_MS` (240 s) para todo, y escuchar tiene su propio tope (`conPlazo`, 90 s).
- ⚠️ **La guarda de «entró un mensaje más nuevo» (#788) comparaba con «el último que hay al leer».** Eso andaba porque
  leer era inmediato. Escuchar una nota de voz tarda, y si en ese rato el lead escribía otro mensaje, la hora de ése
  quedaba como la de éste: contestaban las dos corridas, y una contestaba lo viejo. **Regla:** la guarda compara con la
  hora del PROPIO mensaje (`recibidoAt`, la de WhatsApp), que manda el webhook.
- **Lo que dijo se GUARDA en su mensaje** (`wa_mensajes.texto`, compare-and-set sobre el vacío). Sin eso, en el turno
  siguiente la nota volvía a ser «(mandó un audio)» y el setter le preguntaba de nuevo lo que ya había dicho. Con eso:
  - la charla la ve como «🎤 lo que dijo» (`historialDeMensajes`);
  - la bandeja la dibuja «Dice: …» debajo del audio (`contenidoDeMensaje`), no como un mensaje escrito. Un audio de
    WhatsApp no tiene pie, así que un audio del lead con texto sólo puede ser eso.
- **El aviso del negocio sólo ve los DATOS.** «Un Lead Te Escribió» cita `{{lead_escribio}}`, y el texto armado por el
  motor (`citaDelLead`) no le llega. Por eso el 🎤, y el porqué cuando no se pudo escuchar, van en el dato
  (`escritoParaElAviso`). Lo mismo en el hand-off y en la acción de una rama.
- **La marca de la voz es un emoji y no «(nota de voz)».** Unas palabras de más diluían el parecido del corte por
  insistencia: «sigue caro» dicho por voz no contaba. Y un dicho que terminara en «)» quedaba como relleno (`RELLENO`).
- **El porqué de un fallo se dice con la regla de la casa** (`causaDelFallo` + `fraseDelFallo`, con las keys DEL
  NEGOCIO), no con el primer error crudo del proveedor en inglés.
- **Si el webhook no trae el audio** (sin `webhookBase64`), se le pide a la instancia (`fetchMediaBase64EnInstancia`),
  y se le saca el prefijo `data:` como al guardarlo.

**SIN HACER:**
- Las notas de voz por Instagram y Messenger (lib/zernio-entrante.ts no pasa el audio).
- Si el lead manda un audio y enseguida un texto, la corrida del texto no sabe lo que dijo el audio si la escucha
  todavía no terminó. Cuando termina, queda guardada para el turno siguiente.
- De una imagen el AI Step sigue viendo sólo el pie de foto.

**Vive en:** `lib/nutricion.ts` (`escucharDelLead`, `asistirRespuesta`, `contextoDeRespuesta`: `recibidoAt`,
`PLAZO_AI_STEP_MS`) · `lib/setter-conversacion.ts` (`escucharNotaDeVoz`, `escritoParaElAviso`, `conTurnoActual`,
`historialDeMensajes`) · `lib/setting-simulador.ts` (`EnVivo`) · `lib/chat-agent-handoff.ts` · `lib/fallo-ia-texto.ts`
(`fraseDelFallo`) · `lib/evolution-mensajes.ts` · `app/whatsapp/_shared/ChatHilo.tsx` · test:
`tests/ai-step-red-y-voz.test.ts`

## «Muchas flechas no se pueden desconectar» (16/10/2026): eran las que llevan una espera encima

Martín: «en "Un Lead Agendó Llamada" solo puedo desconectar la flecha del CONDITION "Su reunión sigue en pie"».

- **El diagnóstico obvio («`desconectar` falla con esas flechas») era el equivocado.** Medido en producción sobre #252
  (la copia de esa plantilla en el ws 9) y en los datos: las 17 flechas se desconectan, la papelera aparece en todas y
  «Desconectar» del click derecho anda.
- **Lo que no andaba era agarrar la PUNTA.** `Lienzo.tsx` no le daba punta a una flecha con esperas encima
  (`a.esperas?.length`), y en esa automatización son casi todas las de la cadena de recordatorios. La de la condición
  no lleva espera: era la única que se agarraba. El que recibe la punta (`reconectar`, FlujoLienzo) ya salía de la
  ÚLTIMA espera, así que alcanzó con mostrarla: las pastillas se quedan.
- **Soltar una punta en el vacío no tenía cómo «desconectar»:** sólo ofrecía una tarjeta nueva, y cerrar el menú la
  dejaba como estaba. Ahora la primera opción es «Desconectar».
- ⚠️ En el dato, una flecha con esperas no llega a la tarjeta que se ve: llega a su PRIMERA espera
  (`a.esperas[0].id`). Quien la quite tiene que pasar ésa, y quien la mueva tiene que salir de la última.

**Falta:** verlo con clics después del deploy (la punta de una flecha con pastilla, y «Desconectar» en el vacío).

**Vive en:** `app/_components/Lienzo.tsx` (las puntas, `soltarCirculo`) · `app/automations/FlujoLienzo.tsx`
(`quitarFlecha`, `reconectar`, `desdeDe`) · test: `tests/lienzo-flechas-desconectar.test.ts`

## «Probar» ponía los «antes de la reunión» antes que un «Esperar 5 min» (16/10/2026)

- **La causa:** en el simulador, una espera «N antes de la reunión» NO movía el reloj de su camino, porque «la prueba no
  tiene una reunión de la que descontar». Con varios caminos en paralelo, el de los recordatorios quedaba en el minuto
  0 y salía entero antes que el «Esperar» de otro.
- **Pero la prueba SÍ tiene una reunión:** quien entra por una etapa de reunión la tiene mañana a esta hora
  (`hechosDeLeadNuevo`, desde el 14/10). Ahora el estado lleva ese minuto (`reunionMin`, `reunionMinDe`), y la espera
  lleva el reloj a la reunión menos N, como el motor (`nutricion-grafo-motor.ts`: si eso ya pasó, sigue enseguida).
  Sin reunión, no inventa un minuto.
- **Son cuatro los que arrancan una simulación:** el panel, los escenarios, el recorrido y la API (`probar_secuencia`).
  Los cuatro tienen que pasarle la reunión; si falta en uno, ése ordena distinto.

**Vive en:** `lib/simulador-grafo.ts` (`correrHilo`, `iniciar`, `reunionMinDe`) · `app/automations/PanelProbar.tsx`
(`reunionDeLaPrueba`) · `lib/setting-secuencias.ts` · test: `tests/probar-orden-antes.test.ts`

## «Probar»: el encabezado del caso, la sidebar y el «escribiendo…» (16/10/2026)

- ⚠️ **Un tipo de mensaje nuevo en el hilo tiene que quedar fuera de la charla.** El encabezado del caso pasó a ser su
  propio tipo (`'caso'`, `ChipDelCaso`), y había tres lugares que filtraban sólo `'sistema'`: lo que lee el redactor
  (la IA habría leído «Caso 1: …» como algo que dijo el negocio), el último mensaje de un contacto y lo que contesta el
  lead. Ahora pasan por UN filtro (`esDeLaCharla`); el test fija que no quede ningún `m.tipo !== 'sistema'` suelto.
- **La sidebar «salía arriba» por 5 píxeles:** el cuerpo del panel en la pantalla de Martín mide ~645 px y la columna
  pedía 640 (con el borde caía debajo). Desde 520.
- **El «escribiendo…» del lead sumaba dos esperas:** las pausas de la animación y DESPUÉS la IA. Ahora el mensaje se
  pide apenas aparece lo que contesta, y el «escribiendo…» espera sólo lo que falte.

**Pendiente de Martín (consultado a Cerebro):** si «su nombre» en la sidebar es un nombre de persona (y entonces el
lead de cada caso se llama así en sus mensajes), y qué quiere decir «los chips de "antes de"... no en el medio».

**Vive en:** `app/automations/ChipDelCaso.tsx` · `app/automations/PanelProbar.tsx` (`pildoraDelCaso`, `esDeLaCharla`,
`pedirMensajeDelLead`, `ANCHO_PARA_COLUMNA`) · `app/automations/SimuladorSocial.tsx` · test:
`tests/probar-chip-caso.test.ts`

## «Probar»: el grupo de MaKo como primer contacto (16/10/2026)

Martín: «En todas las automatizaciones de WhatsApp que haya un paso del grupo de WhatsApp de MaKo, debería salir como
primer contacto, con el nombre real del grupo... Y al reproducir cada caso, MaKo debería enviar el mensaje
correspondiente». Hasta ese día la tarjeta «MaKo en WhatsApp» pasaba como la pastilla «⚡ Avisar al equipo», y lo que le
llega al grupo no se veía en ningún lado.

- ⚠️ **La prueba NUNCA le escribe al grupo de verdad, tampoco con «Probar en WhatsApp».** El grupo es el del cliente,
  con su equipo adentro (en el ws1, el de Mauricio): una prueba ahí es un aviso falso a gente real. Lo que MaKo le
  mandaría queda en el chat del grupo DE LA PRUEBA, con la nota «Prueba: al grupo no le llega nada» arriba. El test
  fija que `alGrupo` no llame a `mandarReal`, `postar` ni `fetch`, y que la ruta sólo LEA el grupo.
- **En SuperAdmin no hay UN grupo.** La fila de un evento de la plataforma le escribe al grupo del negocio que lo emitió
  (`negocioWs`, lib/flujos.ts): leer el grupo del ws de SuperAdmin habría mostrado un nombre que nunca recibe ese
  mensaje. Con `evento=1` la ruta contesta «Grupo de cada negocio».
- **«No pude leer el nombre» no es «no tiene grupo».** El nombre sale de WhatsApp (Evolution, `infoGrupoMaKo`), con 8 s
  de plazo: si no contesta, el contacto dice «Grupo de MaKo», que no finge ser el real. Sin grupo guardado
  (`hay: false`) el renglón dice «Sin grupo todavía».
- **Lo que le llega, como lo arma el motor:** la tarjeta de hoy, por partes y con los datos de ejemplo; una de antes (sin
  `partes`), con el texto envuelto de `armarAvisoDeTarjeta` («🟡 título», el lead, «— MaKo»). La que va por email
  («MaKo por email») no le escribe al grupo: sigue siendo la pastilla.
- **Una guarda vieja prohíbe `readOnly` en el panel** (era el «Editar» de cuando «Probar» era una vista de sólo
  lectura): el chat del grupo va sin caja porque no recibe `onEnviarTexto`, y la nota es su primer renglón.

**Vive en:** `lib/probar-grupo.ts` · `app/automations/PanelProbar.tsx` (`alGrupo`, `pildora`, `verGrupo`,
`BarraEscenarios` con `grupo`) · `app/api/chat-agent/simulador/route.ts` (`GET ?grupo=1`) · `lib/simulador-grafo.ts`
(el evento `accion` lleva su `paso`) · test: `tests/probar-grupo-mako.test.ts`

## «1 día antes» con la reunión en 3 h: lo de esa espera ya no sale (16/10/2026)

Martín: «si MaKo sabe por la API que el evento permite agendar con poca anticipación (por ejemplo 3 h), el delay "1 día
antes" lo advierte. Y lo ideal: "si está configurado "1 día antes" y se agendó dentro de 3 horas, que simplemente no
salga"». Hasta ese día el motor seguía de largo con una espera «antes de la reunión» que ya había pasado: quien agendaba
a 3 h recibía el «mañana es tu reunión» al instante, y el «1 h antes» también.

- **La regla es la MITAD, no «ya pasó»** (`llegaTarde`, lib/flujo-grafo.ts). El lead llega a la espera unos minutos
  después de agendar (el cron, un «Esperar 5 min» de antes): con «ya pasó», agendar 24 h y 3 min antes salteaba el «1 día
  antes». Si al llegar falta menos de la mitad («1 día antes» con menos de 12 h), lo que sigue —mensajes y acciones— no
  sale, hasta la próxima espera; las condiciones del medio se deciden igual. Las flechas en paralelo de esa espera
  tampoco arrancan.
- **No es una regla escondida** (la de Martín del 14/10: «MaKo NADA por detrás»): el editor de la espera la dice entera
  («Si agenda con menos de 12 h, no sale») y se cambia a «Si agenda más cerca, sale enseguida», que es lo de antes y se
  guarda (`siAgendaCerca: 'sale'`). Lo de fábrica no se escribe. **Cambia lo que reciben los leads de los flujos que ya
  existen**: Martín lo pidió como lo ideal para todos.
- **El motor y «Probar» lo hacen igual**: `resolverControl` (lib/nutricion-grafo-motor.ts) y el simulador, que lo dice en
  la pastilla («⏳ 1 día antes de la reunión · agendó más cerca: no sale»).
- ⚠️ **La API de Calendly NO publica la «anticipación mínima» de un event type** (es un ajuste de la pantalla; no aparece
  en su referencia). Lo que sí da son los huecos libres: `primerHuecoLibre` (lib/calendly-agenda.ts) toma el más cercano
  de cada event type activo en la semana. Es una MEDICIÓN y así se dice («Calendly tiene huecos a 3 h»). La lee
  `anticipacion_agenda` (API de MaKo, área calendario) y el lienzo (GET /api/flujos/anticipacion), que pone la ⚠ en la
  píldora de la espera que no llegaría a salir.
- **Una espera entre dos tarjetas NO es un nodo: es una pastilla de la flecha** (`AristaFlujo.esperas`). El aviso tenía
  que viajar también ahí (`aviso`), o la ⚠ sólo salía en las esperas sueltas.

**Vive en:** `lib/flujo-grafo.ts` (`llegaTarde`, `textoSiAgendaCerca`) · `lib/nutricion-grafo-motor.ts`
(`resolverControl`, `sanearEspera`) · `lib/simulador-grafo.ts` · `lib/flujo-conversacion.ts` (`avisoAgendaCerca`) ·
`lib/agenda-anticipacion.ts` · `app/automations/FlujoLienzo.tsx` (`EditorEspera`) · test: `tests/agenda-cerca.test.ts`

## «Crear con IA» por Instagram: 140 s y un error de la revisión, el adjunto leído con visión, y «Probar» sin nada (16/10/2026)

Tres bugs que Martín vio el mismo día (por Cerebro, A1-A3).

- ⚠️ **El diagnóstico obvio («la IA tarda») era el equivocado. MEDIDO en `anthropic_usage` (ws10, 16/10 06:07-06:10
  UTC):** Groq contestó en segundos. El flujo traía `"canal": "whatsapp"` en un pedido de Instagram, la revisión lo
  rechazó y la cascada (que pasa al siguiente proveedor cuando `validar` dice que no) probó OpenRouter: 97 s, y el mismo
  error. Después vino el reintento con los errores: 76 s más. La causa estaba en el código: `canalDeTarjeta` respetaba el
  «whatsapp» que el modelo escribe por costumbre. Ahora, en un flujo social, un mensaje NUEVO al lead sale por ese canal
  sin otra vuelta. Editando, un mensaje que ya estaba conserva el suyo si el cambio no lo nombra (`mantenerCanal`).
- **La regla de la IA «por Instagram sólo texto y link» quedó atrás del editor:** el editor social sube archivos desde
  la decimocuarta tanda y el motor los manda por partes (`enviarPasoSocial`). Ahora la IA pone un archivo por Instagram
  o Messenger si ese canal lo acepta (`problemaDeAdjunto`: Instagram, foto, video o PDF), y si no, lo saca con su
  porqué. (La primera respuesta a un COMENTARIO sigue siendo sólo texto: eso lo decide el motor.)
- **El error que ve la persona no lleva lo que le habla al modelo** (`paraLaPersona`: sin «: usa "canal": …» ni las
  claves del JSON).
- **El adjunto se razona ANTES de leerlo** (lib/archivo-del-pedido.ts). Lo que el flujo DA («dando este lead magnet»,
  «mándales el PDF») es CONTENIDO: va a la biblioteca de archivos sin leerlo, el pedido lo nombra con su id, y `deIA`
  lo pone en el último mensaje al lead si el modelo no lo puso. Lo que dice CÓMO armarlo, o un archivo solo, es
  INSTRUCCIONES y se lee como antes. Si subir o leer falla, el pedido sale igual y lo dice. ⚠️ **La decisión es del
  código, no de una IA:** el caso que la pidió fue justamente la IA caída.
- **«Probar» apagado mientras falte algo**, con el porqué al lado en 3-4 palabras (`motivoParaNoProbar`): «Completa el
  disparador», «Agrega un mensaje» o «Completa una tarjeta». Esta última se puede tocar y lleva a la tarjeta, como
  Publicar.

**Sin hacer:** el plazo por intento sigue en 100 s: OpenRouter gratis contestó en 76 y 97 s, y cortarlo antes dejaría
sin respuesta al negocio que sólo tiene ese proveedor vivo. La espera dice «hasta 5 min» porque es el tope de la ruta
(tests/flujo-ia-arreglos.test.ts).

**Vive en:** `lib/flujo-ia.ts` (`canalDeTarjeta`, `nodoDe`, `validarIA`, `conElArchivoDelPedido`, `paraLaPersona`) ·
`lib/archivo-del-pedido.ts` · `app/automations/ChatMako.tsx` (`BarraPideselo`) · `app/automations/archivo-pedido-cliente.ts`
· `lib/flujo-conversacion.ts` (`motivoParaNoProbar`) · `app/automations/SecuenciaPerfil.tsx` · tests:
`tests/crear-ia-instagram-solo.test.ts`, `tests/crear-ia-adjunto.test.ts`, `tests/probar-apagado.test.ts`

## El AI Step sin red por llevar datos del lead dice «Conecta tu Claude» (16/10/2026)

- La cascada saltea la red gratis de la agencia cuando el pedido lleva datos de clientes, y lo anota en
  `erroresPlataformaOut` con «red gratis salteada:». Pero el aviso al negocio se elegía sólo con los errores de SUS keys,
  así que decía «no hay ninguna API key de IA cargada»: un remedio equivocado. Ahora, con ese salto, dice
  `CONECTA_TU_CLAUDE` (lib/fallo-ia-texto.ts), la misma frase que ya usan el análisis del lead y las cajas del Dashboard.
  Vale para la respuesta (`responderSimulador`) y para la nota de voz (`escucharDelLead`). Con la compuerta del crédito
  de Claude que pone Onboarding, éste pasa a ser el camino de todo negocio sin su Claude.

**Vive en:** `lib/fallo-ia-texto.ts` (`sinRedPorDatos`) · `lib/setting-simulador.ts` · `lib/nutricion.ts` · test:
`tests/ai-step-conecta-claude.test.ts`

## Lo que el evento de la oferta lista destapó del motor: tres huecos de los eventos de la plataforma (16/10/2026)

Al sumar `oferta_lista` (docs/diseno-avisos-plataforma.md §7) se mapeó qué puede y qué no puede hacer hoy un evento de
la plataforma. Ninguno de los tres se arregló en esa tanda: son del motor, y quedan acá para quien lo toque.

- **Un evento de la plataforma no admite CONDITION.** Publicar la rechaza (`MOTIVO_EVENTO.condicionPersona`,
  lib/aviso-evento.ts, con test en tests/avisos-plataforma.test.ts). Y aunque se levantara, los hechos que leen las
  condiciones son SÓLO de un lead (`hechosDeLaCorrida` → `hechosDeUnLead`, lib/flujos.ts) y saldrían del ws 9, no de
  `negocioWs`. Por eso «avisar sólo si no vio su oferta» no se puede armar: necesitaría hechos DEL NEGOCIO, una fuente
  nueva en lib/condiciones-catalogo.ts y la hora del evento en `datos` (sobrevive al DELAY: `ctxParaDormir` sólo saca
  `cuota_dias`). **16/10/2026, noche: resuelto en parte:** ya hay CONDITION sobre los DATOS DEL EVENTO (la
  sección de abajo); los hechos DEL NEGOCIO siguen sin existir.
- **Sin grupo de MaKo, la tarjeta de WhatsApp se pierde sin decirlo.** `enviarAlGrupoMaKo` contesta «el workspace no
  tiene grupo de MaKo todavía» (lib/mako-grupo.ts), `emitirAviso` sólo lo loguea y `emitirPorEvento` igual devuelve
  `wa: true` cuando corrió una fila. No hay respaldo por email: «email sólo si no hay grupo» no se puede escribir como
  una condición visible. El grupo nace con `setNumeroDuenoYSync`; un cliente que posterga el teléfono en el onboarding
  no tiene grupo. (16/10/2026, noche: el emisor devuelve además `llegaron`, lo que de verdad llegó; el respaldo sigue sin hacer.)
- **No hay aviso «en la app» de escritorio.** No existe una tarjeta in-app: `emitirAviso` siempre llama
  `crearNotificacion`, pero la tabla `notificaciones` **no existe en producción** (docs/estado-del-arte.md), así que esas
  filas no van a ningún lado. Lo único que llega es el push de MaKo Mobile (salvo las tarjetas por email, `push: false`),
  y no hay campanita en escritorio. **Medido el 16/10/2026 (noche): la tabla SÍ existe en producción** (mig 0250, 273 filas, la lee el
  «Avisos» de MaKo Mobile); lo que falta es la campanita de escritorio (docs/hallazgos-comunicacion.md).

**Vive en:** lib/aviso-evento.ts (`MOTIVO_EVENTO`, `emitirPorEvento`) · lib/flujos.ts (`hechosDeLaCorrida`,
`emitirTarjetaDelEvento`) · lib/mako-grupo.ts (`enviarAlGrupoMaKo`) · lib/avisos.ts (`emitirAviso`) ·
lib/notificaciones.ts

*16/10/2026, chat «Offer» (claude3), al sumar el evento `oferta_lista`.*

## La CONDITION sobre los datos del evento, con «Si no» (16/10/2026)

- **Un evento de la plataforma no admitía CONDITION** (miraba los hechos de un LEAD, y no trae ninguno), así que el
  código elegía la frase. Ahora una CONDITION puede preguntar los DATOS DEL EVENTO: el campo es `dato:<clave>` y su def
  sale de la variable (`VariableAviso.condicion`: rótulo, tipo y opciones); se evalúa con lo que pasó el emisor, nunca
  leyendo un lead. Un evento sin lead (de la plataforma o de una persona) pregunta sólo sus datos, y ninguno un dato que
  no trae. Fuera de una fila de evento no se guarda (Publicar lo frena): no habría evento que la conteste.
- ⚠️ **El runner de los eventos es una LISTA, no un grafo.** Una CONDITION con «Si no» o varias salidas se escribe en
  fila: cada salida es una pregunta con `siNo` (el índice de la siguiente), su camino y un `fin` para no caer en la de al
  lado; después, el camino del «Si no». Por eso **dos salidas no se pueden juntar en la misma tarjeta** (saldría dos
  veces en la lista): Publicar lo frena con su motivo.
- ⚠️ **La de UNA salida sin «Si no» conserva la traducción y la huella de antes.** Una corrida dormida guarda la firma
  de la fila (`pasosParaRetomar`); traducirla como las nuevas le cambiaba la firma y cortaba todas las que esperaban.
- **«No sé» y «no pude mirar» no son lo mismo.** Con varias salidas, un dato que falta va al «Si no» (como en el lienzo);
  SIN hechos (no hay lead que leer, o ya no está) termina, también con «Si no»: si no, salía «sigue sin pagar» de un lead
  borrado (lo cazó la revisión).
- ⚠️ **Fuera del horario, se decide primero y se duerme en la PRIMERA condición de la cadena** (`cadena`, lib/flujos.ts).
  Mirar adelante las dos salidas hacía esperar también a la que «Lo manda igual»; decidir y dormir en la tarjeta dejaba una
  decisión de las 23 h para un mensaje de las 9. La de una salida sin «Si no» sigue mirando adelante, como siempre.
- **Trampa de los tests:** el barrido de tests/plantillas-viejas.test.ts encuentra emisores por el id LITERAL en
  `emitirDelCatalogo('…')`; un id que elige una función (`avisoDeCaida`) es invisible y el test dice «nadie lo emite». Y
  los guardias que barren el repo entero (el voseo) sólo saltan en la suite completa.
- **Trampa del merge:** un campo que se renombra (`sinFila` → `filas`) no choca en git si el otro lado sólo lo LEE en un
  archivo nuevo (lib/oferta-lista-server.ts): el merge sale limpio y el tsc no. Después de mergear, tsc sobre lo que llegó.

**Sin hacer:** «Crear con IA» no sabe armar condiciones de datos; «Probar» sigue cada condición por el «Sí».

**Vive en:** `lib/dato-evento.ts` · `lib/condiciones-catalogo.ts` (`defDeDato`, `SECCION_DATOS`) · `lib/aviso-evento.ts`
(`pasosDelEvento`, `condicionesDelEvento`, `esperaApertura`) · `lib/flujo-pasos.ts` (`decidir`) · `lib/flujos.ts`
(`hechosDeLaCorrida`, `cadena`, `entregas`) · `lib/nutricion.ts` (el freno de `setSecuenciaPasos`) ·
`app/automations/EditorCondicion.tsx` · test: `tests/dato-evento.test.ts`

## Los pedidos sueltos en el chat de Automations: lo que la revisión frenó antes de subir (16/10/2026)

El enganche del módulo de Web Generator (docs/diseno-mako-pedidos.md) en el chat de MaKo quedó en la rama
**`wip/automations-pedidos`** (1639ae566) sin subir: la revisión adversarial confirmó regresiones del chat de siempre.
**Arregladas todas el 17/10/2026** (sección de abajo). Lo que encontró, y por qué no se veía:

- ⚠️ **El resolver no sabe que el lienzo está VACÍO.** Con una automatización recién creada (modo crear), «Crea una
  automatización que…» es el pedido para ESTA, pero sale como «crear otra» (una burbuja) y no llega a MaKo. El chat tiene
  que mandarle a la ruta que lo abierto está vacío, o no preguntar en modo crear.
- ⚠️ **Nombrar otra automatización en un pedido de edición se lleva el mensaje entero** («que el mensaje diga lo mismo
  que en Cobranza»): el resolver lo lee como un pedido sobre ESA (lib/mako-pedidos.ts), MaKo no recibe nada, y «borra el
  mensaje de X» ofrece archivar la automatización X. Un nombre de objeto dentro de una edición no es un pedido aparte.
- **Un mensaje con dos «borrar»** no se parte: la parte de la abierta se descarta sin aviso.
- ⚠️ **Crear otra choca con «cambios sin publicar».** Después de que MaKo edita, la abierta queda con borrador; crear
  desde la burbuja salta la pregunta de lo no publicado que hace «＋ Nueva» ANTES de crear: queda una vacía de más, o
  «Descartar cambios» se lleva lo que MaKo acaba de hacer y el pedido se pierde. Va por la misma pregunta que «＋ Nueva»,
  o se guarda el borrador antes de crear.
- **«Crear ahora» no espera a MaKo** (sólo «Sí» espera): cambia de lienzo, desmonta el chat y corta la edición en vuelo.
  Y la burbuja dice «Creada» sin saber si se creó (`onCrearOtra` no devuelve nada).
- **«Deshacer» no deshace del todo:** archivar CANCELA las inscripciones vivas y desarchivar no las devuelve
  (lib/secuencias-huecos.ts). La burbuja no puede prometer lo que el «⋯ › Eliminar» de la lista tampoco cumple.
- **La deduplicación de burbujas se traga un mensaje repetido**: ni burbuja ni MaKo.
- Lo que sí quedó firme y se reusa: `archivar` sin `ids` archiva TODAS, y `cuerpoEliminar` nunca arma un cuerpo sin un
  id; el chat no hace POST propios (los dos viven en `pedidos-cliente.ts`) para respetar el guard del stream.

**Vive en:** rama `wip/automations-pedidos` (app/automations/pedidos-chat.ts, pedidos-cliente.ts, ChatMako.tsx, la ruta
app/api/mako/pedidos con `chatbot`) · lib/mako-pedidos.ts (el resolver, del Web Generator) · test:
tests/automations-pedidos-chat.test.ts (en la rama)

## Las automatizaciones de Brigitte (ws15) no respondían a los leads nuevos (17/10/2026, tarjeta #868)

Joan (Código Inmobiliario) en la revisión del 16/10, 2:01:20: «la Brigitte sería la parte de las automatizaciones, esa es
como la más prioritaria». Medido el 17/10: 16 leads de formulario en 14 días en el ws15 y CERO inscripciones en toda su
historia. Eran TRES cosas apiladas, y ninguna era «la automatización está mal armada»:

- ⚠️ **El poll de Meta cargaba el lead y no hacía lo inmediato.** La página de Brigitte no está suscripta a la app, así que
  el webhook no llega nunca; el poll lo creaba sin aviso, sin flujos y sin inscribirlo. Arreglado: lib/meta-lead-nuevo.ts
  (docs/hallazgos-ads.md, «08/10/2026: Brigitte»).
- ⚠️ **`lead_nuevo` no miraba las automatizaciones de la ETAPA.** «Un Lead Entró» cuelga de «Lead entrante», y el evento sólo
  inscribía en los tres triggers de antes (`instant_form_sin_agenda`…): el lead entraba por el barrido de la hora, que no
  es «el lead nuevo» sino todo el que esté en la etapa con actividad en 90 días. Ahora entra al instante a la de su etapa
  y su embudo, con la MISMA pregunta que la reserva (M1): `conSuEtapa` en `enrolarPorEvento` (lib/nutricion.ts).
- ⚠️ **La que armó Joan en la llamada quedó en «manual».** «Un Lead Entró 2» (#266) nació de PEGAR una copia de otro negocio;
  el pegado dijo «su etapa no está en su negocio», tiró el disparador y la guardó con `trigger_tipo: manual`. Después
  Publicar y Activar la dejaron prendida: en la lista se veía activa y no escuchaba nada. La original (#247, la plantilla)
  sigue PAUSADA a propósito: le escribe a los leads, y prenderla es de Joan.
- **El dato, corregido el 17/10** con el escritor validado (`guardarDisparadores`): #266 escucha «Está en la etapa: Lead
  entrante» del funnel 17, el mismo CRON de #247. Antes se midió el barrido: un solo lead abierto en esa etapa (Silvana,
  #2731, del 16/10), así que el cambio avisa a lo sumo por ella. Respaldo de la fila en el scratchpad de la sesión
  74712af3 (`respaldo-266-ws15.json`); se deshace volviendo a `trigger_tipo: manual` y `disparadores: null`.

**Hecho después (17/10, #882):** pegar en otro negocio busca la MISMA etapa en un embudo de acá (en uno → ése; en varios →
todos, y lo dice; en ninguno → «Elige qué la dispara»): lib/copia-disparador.ts, tests/copia-disparador.test.ts. La otra
mitad de #882 (crear al instante con loader por cualquier vía): HECHA el 17/10 — la plantilla y la copia usan el cargador de
«＋ Nueva» (la fila aparece YA con el lienzo y su loader), y la plantilla ya no pregunta la etapa en el modal: el lienzo abre
con su CRON abierto (`cronAlAbrir`). El chat ya lo hacía. Sin mirar en pantalla (tests/crear-al-instante.test.ts).
**Sin hacer:** que una
automatización SIN disparador no se pueda prender callada (o que la lista diga «Manual: sólo si la mandas a mano»).
Prender #247 lo decide Joan.

**Vive en:** `lib/meta-lead-nuevo.ts` · `lib/meta-leads.ts` (`pollMetaLeads`) · `lib/meta-leads-poll-reglas.ts`
(`esNuevoParaElNegocio`) · `lib/nutricion.ts` (`enrolarPorEvento`, `conSuEtapa`) · test: `tests/meta-lead-nuevo.test.ts`

**Vive en:** app/automations/pedidos-chat.ts, pedidos-cliente.ts, ChatMako.tsx, la ruta app/api/mako/pedidos con
`chatbot` · lib/mako-pedidos.ts (el resolver, del Web Generator) · test: tests/automations-pedidos-chat.test.ts

## Los pedidos sueltos, arreglados: lo que no era lo que parecía (17/10/2026)

- ⚠️ **«Un nombre se lleva el mensaje» no era que el resolver busque nombres de más: eran dos casos con forma distinta.**
  «Que diga lo mismo QUE EN Cobranza» usa el nombre como DATO de un cambio de lo abierto; «borra EL MENSAJE de Cobranza»
  sí habla de Cobranza, pero de una PARTE suya. Lo primero va a lo abierto (`esComparacion`, el nombre después de «como»,
  «que (en)», «igual que»…); lo segundo es un cambio de Cobranza —un link para abrirla—, nunca archivarla (`borraUnaParte`:
  el sustantivo del verbo es una parte, `PARTES_DE_LO_ABIERTO.chatbot`). Las dos reglas viven en el resolver y valen
  para todas las tabs.
- ⚠️ **Un nombre con una palabra de OTRA área cae a lo abierto aunque sea otro objeto:** «Seguimiento de agendados» lleva
  «agendados», que es del CRM, y el pedido se lee como «nombra otra área, puede ser un cambio de lo abierto» (va entero a
  MaKo). No ofrece archivar, que era lo grave; pero «abre Seguimiento de agendados» tampoco da el link. Sin hacer.
- **«A y elimina la otra» se parte sólo si la referencia está en B.** «y + verbo» no partía nunca a propósito («Crea otra
  landing y ponle el título X» es UN pedido), y con dos «borrar» las reglas tampoco dudaban (cuentan verbos DISTINTOS).
  `partirPorY` parte cuando A no nombra otro objeto y B sí.
- ⚠️ **La pregunta de «cambios sin publicar» no protegía nada en este camino:** el borrador del lienzo se guarda solo al
  irse (`useBorradorSecuencia`), y la pregunta sólo ofrecía «Descartar cambios» (llevarse lo que MaKo acababa de hacer) o
  «Seguir editando» con una fila vacía de más. «Crea otra» desde el chat cambia SIN preguntar y deja la abierta con su
  punto ámbar (`creaDesdeElChat`, app/automations/SimuladorWhatsApp.tsx). «＋ Nueva» sigue preguntando como siempre.
- ⚠️ **El ref que recuerda «vino del chat» se apaga en un EFECTO, no en el render:** el `abrir` se aplica al dibujar, y en
  desarrollo React dibuja dos veces; apagado en el primer dibujo, el segundo volvía a `elegir` y salía la pregunta.
- **Cuatro tests fijan la forma de `crearNueva`** (su primera línea, el `return;` del fallo, el `setAbrirSec` del pedido):
  para que conteste si nació se cambiaron sólo los `return` a `false`/`true` y la lógica nueva fue a la lista, no a la tab.

**Sin hacer:** verlo con clics en el ws3 (pedir «crea una…» con el lienzo vacío, «elimina la otra» con dos, y crear otra
con un borrador). El link de «abre X» cuando el nombre de X lleva una palabra de otra área (arriba).

## «Probar en el grupo»: la regla del 16/10 a la mañana, dada vuelta por Martín a la tarde (17/10/2026, tarjeta #852)

- ⚠️ **«La prueba nunca le escribe al grupo de verdad» era una decisión de un chat, no de Martín**, y Martín la dio vuelta
  en la revisión de esa misma tarde (44:06): «que se envíen las pruebas al grupo… si la automatización no tiene ningún
  mensaje a clientes… que se pueda probar en el grupo de MaKo». Se conservó lo que la regla protegía: sólo una
  automatización que SÓLO le habla al grupo (`soloAlGrupo`: ningún mensaje al lead ni AI Step), sólo el admin, con tope,
  y cada envío abre con «🧪 Prueba de «X» · Caso N. No es un lead real.» (`ENCABEZADO_PRUEBA`).
- **«¿Por qué me piden un remitente?» (Joan):** el botón de esas automatizaciones es «Probar en el grupo», sin «De» ni
  «Para»: sale por la línea de MaKo al grupo del negocio. Con un mensaje al lead sigue «Probar en WhatsApp» con su
  remitente, y la tarjeta del grupo de ESA prueba sigue sin salir de verdad.
- **Lo que viaja lo valida el server como una tarjeta de verdad** (`problemaDePartesGrupo`, `prepararPartesGrupo`): el
  texto llega con los datos DE EJEMPLO del panel (nunca de un lead), el audio sólo la Voz de MaKo, el archivo del
  negocio; y la automatización tiene que ser del negocio. Una fila de un evento de SuperAdmin no lo ofrece (le escribe al
  grupo de cada negocio, no hay uno).
- **#845 (sacar la exclusión del número y el email de Martín): no hay ninguna.** Medido el 17/10: ninguna regla en el
  código, `wa_bloqueados` vacía, ningún lead de Martín dado de baja. Lo que frena una prueba repetida con el mismo
  contacto es el tope anti-spam (una por persona cada 20 h, `lib/limites-envio.ts`), la reentrada «Una sola vez» y el
  embudo de la automatización (`ámbito`). Los leads de prueba de la llamada ya no existen: no se pudo saber cuál fue.

**Vive en:** `lib/probar-grupo.ts` (`soloAlGrupo`, `ENCABEZADO_PRUEBA`, `partesDeBurbujas`) · `lib/probar-grupo-envio.ts`
· `app/api/chat-agent/simulador/route.ts` (`enviar-grupo`) · `app/automations/PanelProbar.tsx` (`enElGrupo`, `alGrupo`) ·
tests: `tests/probar-en-el-grupo.test.ts`, `tests/probar-grupo-mako.test.ts`

## «El envío de WhatsApp está apagado» con la línea conectada: el interruptor escondido (17/10/2026, tarjeta #851)

- ⚠️ **No era la línea: era un SEGUNDO interruptor.** `envio_whatsapp_enabled` (lib/envio-flags.ts) es fail-closed para
  los clientes. Medido el 17/10: prendido sólo en ws1, ws11 y ws13. Pablo (ws18) y Brigitte (ws15) tenían la línea
  conectada y el envío apagado: una automatización «Activa» que le escribe al lead no mandaba nada. Era el cartel amarillo
  que Martín vio en la revisión («qué raro que esté conectado y te salga…»).
- **Decisión de Martín (Ticketera `envio-whatsapp-al-activar`, «B · Sí, y prenderlo ya»):** activar una automatización
  que le escribe al lead por WhatsApp prende el envío del negocio (`prenderEnvioAlActivar` en `setSecuenciaActiva`, la
  regla en lib/envio-al-activar.ts). Sólo prende; apagarlo sigue siendo a mano en /whatsapp, y el cartel lo dice.
- **Prendido el 17/10 en ws15 y ws18.** Antes se midió el riesgo de prender de golpe (con el envío apagado el tick no mueve
  nada y lo vencido se acumula): las únicas automatizaciones activas que le escriben al lead estaban en ws1 y ws13, ya
  prendidos. Se deshace con `envio_whatsapp_enabled = 'false'` en esos dos.
- **«Que salte el QR al Probar o Publicar sin WhatsApp» ya estaba** (décima tanda: el 409 de Publicar, Activar y Probar
  abren `ConectarMedio` ahí mismo). Lo que se vio en la llamada fue el interruptor, no la falta de línea.

**Vive en:** `lib/envio-al-activar.ts` · `lib/nutricion.ts` (`setSecuenciaActiva`, `prenderEnvioAlActivar`) ·
`lib/envio-flags.ts` · test: `tests/envio-al-activar.test.ts`

## «El equipo no contestó en el grupo»: la condición que mira el grupo de MaKo (17/10/2026, tarjeta #849)

- **De dónde sale el dato:** lo que escribe el grupo queda en `mako_doer_conv` como `role: 'user'` (lib/mako-doer-in.ts,
  `guardarTurno`), y el aviso de la automatización es su fila de `nutricion_envios` (`asunto: OP_AVISAR`, estado
  'accion'). La condición `equipo_contesto` pregunta: ¿alguna fila `user` del grupo desde el ÚLTIMO aviso de ESTA
  inscripción? Sin aviso todavía, sin grupo de MaKo (el aviso salió por email) o sin poder leer: `null`, y no se cumple
  ni negada. No se inventa que «nadie contestó».
- ⚠️ **La tabla guarda sólo lo que MaKo procesa.** En modo 'ventana' (opt-in por grupo) un texto que no nombra a MaKo se
  descarta ANTES de guardarse (`procesarDoer`, el `skip: 'no lo nombran…'`): ahí un «ya lo llamo» no contaría. Medido el
  17/10: todos los grupos en 'libre' (el default). Si alguien pasa un grupo de cliente a 'ventana', esta condición miente.
- ⚠️ **No dice QUIÉN contestó:** la tabla no guarda el autor. Cualquier fila `user` cuenta, también un «ok» o una pregunta
  a MaKo de otra cosa. El eco del propio aviso (una fila `user` con el id de WhatsApp de una de MaKo) se descarta.
- ⚠️ **La fila se escribe al cerrar el buffer de 8 s** (lib/mako-doer-buffer.ts): la condición va detrás de una espera,
  no pegada al aviso.
- **Se evalúa en los TRES lugares donde el motor decide una condición:** la corrida, el reintento antes de mandar
  (`condicionDeArriba`) y adentro de «Si responde» (`elegirSalida`, que se olvida fácil: arma sus propios hechos). Sólo
  si el flujo la pregunta (`usaEquipoContesto`): son dos consultas más por inscripción. «Probar» la da en false.
- ⚠️ **Cada condición nueva le cuesta tokens a «Crear con IA»:** el bloque CONDICIONES del prompt lleva todos los ids
  del desplegable, y tests/crear-ia-tercera.test.ts estaba en ~4.005 de 4.000 con este id. Se pagó sacando una frase
  repetida del system («Devuelves el flujo como un objeto JSON», que ya dice el cierre). La próxima condición también va
  a chocar: hay que recortar algo, no subir el techo (es el de Groq).

**Vive en:** `lib/equipo-contesto.ts` · `lib/nutricion.ts` (`equipoDeLaInscripcion`, `equipoContestoDesdeElAviso`) ·
`lib/condiciones-catalogo.ts` (`equipo_contesto`) · `lib/flujo-grafo.ts` (`equipoContestoEnEsta`) ·
test: `tests/equipo-contesto.test.ts`

## «Crear con IA se quedó pensando»: no era lento, era un error repetido cuatro veces (17/10/2026, tarjeta #847)

- ⚠️ **El diagnóstico obvio (el modelo tarda, el loader no corta) era el equivocado.** ws13, 16/10 21:27-21:29 UTC:
  Joan pidió «aviso al grupo con el día y hora de la reunión» para un pre-R1. Gemini, Groq dos veces y el Gemini de la
  red escribieron JSON que se LEÍA, los cuatro rechazados por la MISMA regla de la revisión (un dato de la reunión sin
  mirarla antes). Un Gemini de la red se colgó 100 s, el plazo se fue y el «Corregir» nunca corrió: 2,5 min y un error.
  Se reconstruyó con `anthropic_usage` (qué llegó) y `vercel logs` (por qué no sirvió): ver hallazgos-infra.md.
- **Un error de revisión casi siempre lo pide el PEDIDO**: otro proveedor con el mismo pedido lo repite. La primera
  pasada para en el primer JSON que se lee y no pasa (`pararEnRevision`), y va al «Corregir», que le lista los
  problemas. El «Corregir» sí prueba los demás proveedores (con los errores en el pedido, otro puede arreglarlo). Un JSON
  que NO se lee sigue probando el siguiente, como antes.
- **La regla de la reunión también vale para los avisos al equipo, a propósito** (tests/flujo-forma.test.ts, «Colgado
  del CRON, sin nada: no»; la plantilla «Un Lead Agendó» le pone una condición delante). No se aflojó: el error ahora
  dice el arreglo de UNA tarjeta (`"reunion_en_pie"` delante). Decía sólo «reunion_en», que pide horas.
- **Un error de la revisión le habla a DOS lectores:** al modelo en el «Corregir» y a la persona en `falloDeRevision`.
  Lo que va después de `: usa "…": "…"` es sólo para el modelo (`paraLaPersona` lo corta).
- ⚠️ **El log dice «resolvió con la RED DE PLATAFORMA» cuando `validar` acepta**, y con `pararEnRevision` acepta
  también una salida con errores para cortar la cascada: esa línea ya no prueba que la salida sirvió.
- **Lo que faltaba, hecho (17/10, segunda mitad):** el tope de un intento bajó de 100 a 45 s (`INTENTO_CREAR_MS`).
  ⚠️ **Lo de arriba se había dejado sin hacer por un dato mal leído**: «OpenRouter tardó 97 s en una salida buena de ws10».
  En `anthropic_usage` (14 días, 36 llamadas), después de esa salida la cascada SIGUIÓ (otro OpenRouter a los 76 s y el
  crédito de Claude), o sea que no se aceptó. Ninguna salida de más de 45 s fue la que quedó; las aceptadas tardan
  segundos (mediana 11 s entre intentos). Un registro en `anthropic_usage` dice que llegó una respuesta, no que sirvió.
- **«Que diga en qué está»:** la cascada avisa al ARRANCAR cada pedido a un proveedor (`alIntentar` de
  `chatCheapCascade`, opcional y sin poder frenarla), y desde el segundo la fase dice «· intento 2» al lado del reloj. Lo
  manda la ruta cuando pasa, no un temporizador del navegador: decir «probando otra IA» por tiempo sería inventarlo.
- **El dictado no decía nada** mientras la nota de voz pasaba a texto (hasta 90 s, `transcribirNota`): `ChatHilo` lo
  dice con la misma línea que usa para subir un audio.
- **Sin hacer:** el orden `PROVS_CREAR_IA` sigue con Gemini primero. Groq contesta en 1,4-3,4 s (medido el 09/10 y el
  16/10) y pondría lo común en segundos, pero cambia QUIÉN escribe los flujos y no hay una medición de calidad. Tampoco
  se miró en pantalla.

**Vive en:** `lib/flujo-ia-crear.ts` (`pasada`, `generar`, `INTENTO_CREAR_MS`) · `lib/ai-cheap.ts` (`alIntentar`) ·
`lib/flujo-ia-crear-core.ts` · `app/automations/stream-ia.ts` y `ChatMako.tsx` (el intento) ·
`app/whatsapp/_shared/ChatHilo.tsx` (el dictado) · `lib/flujo-ia.ts` (`validarIA`, el error de la reunión) · tests:
`tests/crear-ia-revision-corrige.test.ts`, `tests/crear-ia-intentos.test.ts`, `tests/flujo-ia-crear.test.ts`

## El CRON sólo dispara: «Número» y «Reentrada» fuera de su panel (17/10/2026, tarjeta #846)

- **El «Número» del CRON estaba de más:** desde la sexta tanda cada WhatsApp elige el suyo en la cabecera de su panel
  (`CabeceraWhatsApp`, «sin "Toda la automatización"»), el motor usa `lineaDelPaso(paso) ?? sec.instance_name`, y una
  respuesta sale por la línea donde escribió el lead (`lineaEntrante ?? secuencia.instance_name`). El selector del CRON
  editaba ese respaldo. Se fue; `instance_name` sigue valiendo para lo que ya lo tenía.
- **La «Reentrada» es de toda la automatización** (lib/reentrada.ts), así que no se volvió «de cada mensaje»: va debajo
  de cada WhatsApp (`pieWhatsApp`, el MISMO control y el mismo guardado en todos) rotulada «toda la automatización». Un
  flujo sin ningún WhatsApp (sólo email) la sigue teniendo en el CRON: si no, no habría dónde elegirla.
- **Sin verificar en pantalla:** el pie suma ~70 px debajo del composer; el cuerpo del panel scrollea (Lienzo.tsx),
  pero no se miró en un panel bajo.

**Vive en:** `app/automations/SecuenciaPerfil.tsx` (`controlReentrada`, `hayWhatsApp`) ·
`app/automations/FlujoLienzo.tsx` (`pieWhatsApp`, `EditorMensaje`) · test: `tests/cron-solo-disparo.test.ts`

## Los links de un WhatsApp, con o sin la vista previa (17/10/2026, tarjeta #869)

- **Es de cada mensaje** (`sin_vista_previa: true` en el paso, lib/mensaje-partes.ts), como la línea: el interruptor
  «Vista previa del link» aparece en la tarjeta sólo si un texto lleva un link (escrito, o un dato como
  `{{reunion_link}}`). Apagada, Evolution recibe `linkPreview: false` en /message/sendText (v2.3.7). Sin el campo, con
  la tarjeta, como siempre. Sólo el no oficial: el oficial es una plantilla de Meta.
- ⚠️ **Un campo nuevo del paso se pierde al guardar si no pasa por `setSecuenciaPasos`**: el paso se RECONSTRUYE campo
  por campo. Va `vistaPreviaAlGuardar` con la regla de `lineaAlGuardar` (con la clave, lo que llega; sin la clave —la
  API, el generador—, lo de antes).
- ⚠️ **El texto de un paso sale por SEIS caminos**, y el obvio es uno solo: el texto que sale solo, las partes
  (`enviarPartesDelPaso`), el pie de un audio, el BORRADOR que espera al setter (cuatro `crearBorrador`), «Si
  responde» (`mandarMensajeDeRespuesta`) y las dos pruebas (la del panel, que manda lo que el NAVEGADOR arma, y
  `probar_secuencia`). Un borrador se manda después y sin el paso: la marca viaja en `wa_borradores.sin_vista_previa`
  (mig 0309).
- ⚠️ **Una columna nueva no se pide en el claim de un borrador.** `enviarBorrador` reclama con `update … select(…)`:
  con la columna en el select y la migración sin aplicar, PostgREST rechaza el pedido y NO sale ningún borrador. Se lee
  aparte (`borradorSinVistaPrevia`) y `crearBorrador` reintenta sin la marca ante un 42703: sin la columna, el
  borrador sale con la tarjeta, pero sale.
- **Sin verificar en vivo:** que Evolution 2.3.7 respete `linkPreview: false` se tomó de su contrato, no de un envío.
  Se prueba con «Probar en mi WhatsApp» de una tarjeta con un link y el interruptor apagado.

**Vive en:** `lib/mensaje-partes.ts` (`sinVistaPrevia`, `vistaPreviaAlGuardar`, `tieneLink`) · `lib/evolution.ts`
(`enviarTexto`) · `lib/evolution-envio.ts` (`crearBorrador`, `enviarBorrador`) · `lib/nutricion.ts` ·
`app/automations/FlujoLienzo.tsx` · mig `0309_wa_borradores_sin_vista_previa.sql` · test:
`tests/whatsapp-sin-vista-previa.test.ts`

## El chat de MaKo con el muñeco de la tab (17/10/2026, punto 8 del feedback del 16/10)

- **Se copió del CRM (8db1e3cbc) sólo el muñeco**, no el hilo: el chat de Automations tiene OTRO modelo de mensajes (las
  preguntas de MaKo con sus opciones, las rondas, el archivo y la copia pegada; lib/automatizacion-chat.ts y
  lib/flujo-ia-cliente.ts) que `HiloMako` (app/_chat/, sobre app/m/mako/chat-ui.ts) no dibuja. Pasarlo entero es una
  reescritura, y la PC no daba para mirarla en pantalla. Queda para cuando se pueda ver.
- ⚠️ **Un `.css` importado en un componente que los tests IMPORTAN los rompe a todos** (`SyntaxError: Unexpected token '.'`:
  Node no carga hojas de estilo). La hoja del muñeco (app/admin/operaciones/centro.css, todo con prefijo `.co-` y `.mun-`)
  va en app/automations/page.tsx, que los tests sólo LEEN.

**Vive en:** `app/automations/ChatMako.tsx` (la cabecera) · `app/automations/page.tsx` · test: `tests/chat-mako-muneco.test.ts`

## «Está en el funnel de» con varios funnels: «A o B» en una sola fila (17/10/2026, tarjeta #894)

- **La fila guarda TODAS en `valores` y repite la primera en `valor`.** Así lo que sólo mira `valor` (las filas de
  antes, «falta elegir», los nombres de la tarjeta) sigue andando sin migrar nada. Pero se lee SIEMPRE con
  `valoresDeFila` y se escribe con `conValores` (lib/condiciones-catalogo.ts): leer `valor` a mano decide con el
  primero y se calla el resto.
- ⚠️ **La quinta puerta otra vez**: `sanearFila` (lib/nutricion-grafo-motor.ts) arma la fila campo por campo, y sin la
  línea de `valores` el primer guardado volvía «A o B» a «A» sin avisar. Un campo nuevo de la fila no existe hasta que
  pasa por ahí (lo mismo que pasó con la unión y las reuniones de la cuarta tanda).
- **El selector es `ElegirFunnels`, con `sinTodos`.** Su convención (vacío = todo el negocio, un renglón «Todos») sirve
  para un OKR. En una condición está mal: vacío es «falta elegir». Con `sinTodos` no hay renglón «Todos», el botón dice
  «Elige uno o varios» en rojo y apagar el último deja la fila incompleta.
- Negada se lee «ni»: «No está en el funnel de «A» ni «B»» (el motor niega el «o» entero).

**Lo que quedó SIN hacer:** «Crear con IA» todavía arma la condición con UN funnel: el prompt no explica las varias (el
de Groq está al tope de 4.000 tokens) y `filaDelCatalogo` (lib/flujo-ia.ts) toma un solo nombre. La validación sí mira
todas. Sólo `en_producto` tiene `varios`: otra de lista lo prende con `varios: true`, pero el editor sólo dibuja el
selector múltiple para el catálogo `producto`. No se miró en pantalla.

**Vive en:** `lib/condiciones-catalogo.ts` (`valoresDeFila`, `conValores`, `en_producto`) · `lib/flujo-grafo.ts`
(`FilaCondicion.valores`) · `lib/nutricion-grafo-motor.ts` (`sanearFila`) · `app/automations/EditorCondicion.tsx` ·
`app/components/ElegirFunnels.tsx` (`sinTodos`) · test: `tests/condicion-varios-funnels.test.ts`

## Los dos carteles de arriba de Automations, fuera (17/10/2026, tarjeta #851, segunda mitad)

- **Martín los pidió afuera, textual**: «eliminar el mensaje del envío de WhatsApp está apagado. Que no aparezca ningún
  mensaje», y también el rojo «Tienes automatizaciones activas y tu WhatsApp está desconectado». Se fueron los dos, con
  su botón («Volver a conectarlo», «Prender el envío») y el estado que sólo usaban ellos (`envioWa`, `prenderEnvio`, el
  modal del QR de arriba).
- **Lo que decían no se perdió, se mudó**: el chip «Sin conectar» de cada WhatsApp FRENA Publicar, Activar y Probar, y
  los cuatro abren el QR ahí mismo (`ConectarMedio`, tests/medios-automatizacion.test.ts). El envío apagado ya no se queda
  apagado: activar una automatización que le escribe al lead lo prende (`prenderEnvioAlActivar`, más arriba en este
  documento). ⚠️ Lo que SÍ deja de verse: una línea que se cae DESPUÉS de publicar, con todo activo. El rojo existía por
  eso (el 3/09 la sesión del ws1 se cayó sin síntoma). Hoy lo avisa «Se Cortó el WhatsApp de un Negocio» (la #253
  de SuperAdmin, evento `whatsapp_caido`, activa: mirado el 17/10), no la tab.
- La API de las secuencias sigue trayendo `envioWhatsapp`; la tab ya no lo mira. El interruptor sigue en /whatsapp.

**Vive en:** `app/automations/ChatAgentApp.tsx` (el comentario ⛔ donde estaban) · tests que fijaban los carteles,
actualizados con el porqué.

## El link de la reunión, con o sin la vista previa (17/10/2026, tarjeta #869, lo que faltaba)

- **El recordatorio de la reunión había quedado afuera a propósito** del interruptor «Vista previa del link»: el lienzo
  no lo dibujaba ahí (`noOficial && !recordatorio`) y su emisor (lib/reunion-recordatorio.ts) mandaba sin la opción. Y
  justo esa automatización es la que más links manda: sus tres textos de fábrica traen `{{link}}`.
- **El toque lleva el interruptor de SU tarjeta** (`toquesDeLaAutomatizacion` → `sinVistaPrevia`), y el emisor se lo
  pasa a `enviarYEspejar`. La configuración de antes (sin fila de automatización) no tiene dónde guardarlo: sale con
  tarjeta, como siempre.
- **Cuándo se ofrece** (`ofreceVistaPrevia`, una sola regla para el lienzo): con un link en el texto o ya apagado, como
  en cualquier WhatsApp; en el recordatorio, además, con la tarjeta VACÍA (sale el texto de fábrica) o con `{{link}}`
  escrito. Mirar sólo `tieneLink` lo escondía siempre: el link del recordatorio es una variable, no una URL.

**Lo que quedó SIN hacer:** nadie comprobó en vivo que Evolution 2.3.7 respete `linkPreview: false` (es mandarse un
«Probar en mi WhatsApp» con el interruptor apagado: sale a un teléfono de verdad, lo hace quien lo tenga en la mano). Y
en la llamada quedó «en nuestro caso se va a mandar sin»: apagarlo en las automatizaciones de MaKo es tocar sus tarjetas
en producción, no se hizo.

**Vive en:** `lib/recordatorio-automatizacion.ts` (`ofreceVistaPrevia`, `toquesDeLaAutomatizacion`) ·
`lib/reunion-recordatorio.ts` (`toquesDelNegocio`, el envío) · `app/automations/FlujoLienzo.tsx` · test:
`tests/recordatorio-vista-previa.test.ts`
---

## Un DM pagado de Instagram dejaba un lead huérfano con el anuncio (17/10/2026)

- **Síntoma** (revisión de b4, docs/relevo/crm-tanda-b1.md): en un anuncio click-to-DM, Meta manda dos mensajes de la
  misma persona nueva casi juntos —el primero sin `referral`, el segundo con el anuncio—. Los dos pedidos crean un lead
  y el compare-and-set de `ig_conversaciones` deja uno; el otro quedaba con `meta_ad_id`, la entrada y el @, y las
  métricas por anuncio le contaban un lead que nunca agenda mientras el real quedaba sin atribuir.
- **La regla.** El que perdió se BORRA (lo creó esa misma llamada: sin charla ni historial, y `createLead` no dispara
  nada) y le pasa al que ganó el anuncio y la entrada sólo si no los tiene (`.is(null)`). Nunca se borra el que quedó
  unido. **Vive en:** lib/zernio-entrante.ts (`quitarHuerfano`) · tests/zernio-huerfano.test.ts · *17/10/2026, agente B4.*

---

## «Crear con IA» no podía poner un Recurrente, y el que se pusiera a mano llegaba una sola vez por lead (20/10/2026)

Visto el 20/10/2026 (Leila, ws11, #284; diagnóstico del Cerebro en feedback-20-10). Pidió «cada semana los días martes a
las 3 de la tarde ... a todos los que tenemos en el funnel principal» y salió «Llega a «1ª sesión sin costo»», sin
horario, con 6 de 7 tarjetas que nadie pidió, y al editar MaKo contestó «Cambié 2». ⛔ #284 y #282 no se tocaron: lo
decide Martín.

- **El horario es un dato exacto: lo saca el CÓDIGO.** `opcionesCronIA` deja afuera el Recurrente a propósito y el
  modelo, sin él, elegía la etapa de nombre más parecido («sesión»), sin avisar que el horario se perdía. Ahora
  `horarioDelPedido` (lib/flujo-ia-recurrente.ts) lee el horario del pedido y `crearConIA` lo IMPONE; si falta el día o
  la hora, MaKo pregunta con opciones que dicen el horario entero («Todos los martes a las 15:00»). Se guarda por la
  puerta de la pantalla (`recurrenteDeValorIA` → `guardarDisparadores`).
- **⚠️ La hora es la de AL LADO del horario.** El pedido de Leila trae dos: «a las 3 de la tarde» (cuándo sale) y «a las
  7:30» (la sesión, que es contenido). Vale la más cercana a la frase del horario y sólo a 40 caracteres o menos
  (`VENTANA_HORA`). Tomar «la primera hora del texto» o «la última» falla con este mismo pedido.
- **A quién lo dice el pedido, no el modelo.** «Todos los del funnel X» son TODAS sus etapas (las salidas ya no vienen:
  `productosConEtapas`); sin funnel ni etapa nombrados, se pregunta «¿A quién le llega?» con cuántos hay HOY en cada
  opción. ⚠️ Ese número es la cohorte del MOTOR (`leadsDeCohorte`, con su ventana de 90 días), no los leads del embudo:
  contar el embudo daría un número plausible y falso. Sin poder contar, va sin número.
- **⚠️ Una etiqueta nombrada como TEMA no es a quién.** «La sesión de Lídermente» nombra una etiqueta de ws11; sólo
  cuenta si el pedido habla de etiquetas.
- **El diagnóstico obvio era el equivocado: las tarjetas de más NO venían de la plantilla.** `plantillaParaPedido` manda
  todo «recordatorio» a «Un Lead Agendó Llamada», pero en ws11 no entró al prompt (medido en anthropic_usage: 3664 vs
  3622 tokens, la diferencia del pedido). Salían del system: la regla 8 pedía flujos «completos» con el aviso al equipo
  y el único ejemplo traía un `avisar_al_equipo`. Antes de culpar a la plantilla, mirá si entró (los tokens lo dicen).
  Ahora la regla 8 dice «SÓLO lo que pide el pedido», el ejemplo no trae el aviso, y lo cumple el código: un aviso que el
  pedido no pide se saca y queda como sugerencia (`pidioAviso`; «avísales» es al lead, no cuenta), y un «Si responde»
  va sólo si el pedido habla de lo que contesta o un mensaje pregunta algo (`pidioRespuesta`). Un Recurrente o una
  difusión no llevan plantilla.
- **Un «Otra cosa» que CONTESTA no entra en un AI Step** (`respuestaAPasoIA`: «Lo demás» sólo avisa), y dejaba el «Si
  responde» con tres tarjetas de IA. Al crear, pasa a ser un escenario más (`otraCosaComoCaso`): queda UN AI Step.
- **Un apodo de la guía de voz no va en un mensaje para todos.** La guía de ws11 nombra «hermosa» cuatro veces y la regla
  7 manda escribir con ella. En un Recurrente se saca donde se le HABLA a alguien (un saludo, una coma, el final) y el
  primero se vuelve {{nombre}} (`sinApodos`). «Qué linda sesión» no se toca.
- **Decir qué hizo.** «Creé «X»: sale todos los martes a las 15:00 a todos los de «Funnel principal» (37 hoy). Manda
  «…». Quedó pausada.» (`detalleDeCreada`, con lo GUARDADO). Editar dice tarjeta por tarjeta «Cambié «…»: ahora «…»» y
  «Está en el borrador: toca Publicar.» (`resumenEdicionDetalle`). «corté la flecha» era una reparación interna que le
  llegaba a la clienta en jerga: ahora va al log.
- **Trampa del motor: un Recurrente le llegaba UNA vez a cada lead.** Cada ocurrencia inscribe por el BARRIDO
  (`aInscribir`, porEvento=false) y, con el unique (lead, secuencia), ni «Una sola vez» ni «Cada vez que vuelve a
  entrar» reinscribían a quien ya lo recibió: un «todos los martes a todos» llegaba una vez y después sólo a los nuevos,
  sin error. Ahora el barrido de un CRON CON horario cuenta como evento (`barridoEsEvento`, lib/reentrada.ts): corre una
  vez por ocurrencia (la reclama el compare-and-set de `cron_proxima_at`), así que no repite en cada tick. Un barrido
  sin horario sigue sin serlo. El Recurrente que crea la IA nace con «Cada vez que vuelve a entrar».

**Regla:** un horario que dice el pedido lo extrae el código y se impone; si no se puede expresar, se pregunta, nunca se
cambia por otro CRON. Un flujo creado con IA lleva sólo lo que el pedido pide.

**Lo que quedó SIN hacer:** la sugerencia del aviso va como texto («pídemelo»), sin botones · «cada año» y «el primer
lunes de cada mes» no se leen (el pedido sigue al modelo, como antes) · un Recurrente hecho A MANO en el editor no nace
con «Cada vez que vuelve a entrar» (la reentrada se elige en el CRON) · #284 tiene un Recurrente puesto a mano los
martes 16:15 con la reentrada de antes: le llega una vez por lead hasta que alguien elija «Cada vez» (lo decide Martín).

**Vive en:** lib/flujo-ia-recurrente.ts · lib/flujo-ia-crear-core.ts (`crearConIA`, `detalleDeCreada`, `conConteos`) ·
lib/flujo-ia-preguntas.ts (`preguntaAntes`) · lib/flujo-ia.ts (regla 8, `pidioAviso`, `pidioRespuesta`,
`otraCosaComoCaso`, `resumenEdicionDetalle`) · lib/disparadores.ts (`recurrenteDeValorIA`) · lib/flujo-ia-crear.ts
(`contarCohorte`) · lib/reentrada.ts (`barridoEsEvento`) · lib/nutricion.ts (`aInscribir`) · test:
tests/crear-ia-recurrente.test.ts · *20/10/2026, claude4.*

**«Configuré una recurrente y no salió» (Leila, ws11, 20/10, medido a las 21:31 UTC):** el diagnóstico obvio («el Recurrente no anda») era a medias. Pasaron tres cosas:
- **Lo que no salió no era el Recurrente.** Era #282 «Recordatorio clase reactivación», disparada por la etapa: la corrida de las 21:00Z inscribió a los 31 leads de Reactivación, y los **31 mensajes quedaron como BORRADORES pendientes** (`wa_borradores`, origen nutricion). Por WhatsApp no oficial, a un lead sin `fecha_primer_pago` nunca se le manda directo: se deposita un borrador que alguien manda con un clic (la regla dura del PDF, `esLeadCliente` en lib/evolution-envio.ts). La pantalla de Automations no lo dice: la clienta cree que la automatización no anda.
- **Un Recurrente sale a la hora en punto siguiente, no a su minuto.** El tick de cada minuto (app/api/cron/nutricion-tick) no inscribe por cohorte: eso lo hace sólo la corrida de cada hora (`comprometerInscripciones`, app/api/cron/nutricion, minuto 0). El de los martes 16:15 (21:15Z) seguía con `cron_proxima_at` 21:15Z a las 21:31Z: toca a las 22:00Z.
- **Dos automatizaciones al mismo grupo con el mismo recordatorio.** #282 (por etapa) y el d2 de #284 (Recurrente) van a Reactivación del funnel 4 con casi el mismo texto. El motor no apila (espera a que se mande el borrador pendiente: `tieneBorradorNutriPendiente`), así que si se aprueban las dos, el lead recibe el recordatorio DOS veces. Nada avisa que hay otra automatización con la misma cohorte.

**Regla:** antes de decir «no salió», mirar `wa_borradores` pendientes del ws y `cron_proxima_at` de cada disparador. Una automatización que deja borradores tiene que decirlo en su pantalla, con cuántos y dónde se aprueban.

**Hecho el 20/10/2026 a la noche (`claude4`; #282, #284 y sus borradores sin tocar), y lo que no se ve en el código:**
- **⚠️ #282 NO es un Recurrente, y el que sí es vive en el JSON.** Leído en la base: #282 es «Está en la etapa» sin
  `cron`; el Recurrente es el d2 de #284, un CRON EXTRA (`disparadores[1]`, mig 0241). Mirar sólo la columna
  `nutricion_secuencias.cron_proxima_at` no lo encuentra nunca (medido: 20 activas en todos los negocios, NINGUNA con
  `cron` en las columnas). El tick lee las activas enteras y pregunta con `disparadoresDe`, la lista del motor
  (`negociosConRecurrenteVencido`, lib/motor-tick.ts). Costo medido antes de decidir: 0,1 ms en la base.
- **El tick reclama con el MISMO compare-and-set** (`comprometerInscripciones({ soloRecurrentes })`, que salta lo que no
  tiene horario): una ocurrencia la gana una sola corrida, el tick o la de la hora. Inscribe ANTES de `procesarEnvios`:
  el primer envío nace «ahora», cae en la ventana fresca y sale ese mismo minuto. Sólo lo fresco (10 min): una
  ocurrencia vieja que nadie reclama (un CRON que el barrido no inscribe) correría ese negocio cada minuto. Si la
  lectura falla, el tick sigue (las esperas no dependen de esto) y el Recurrente sale a la hora en punto, como antes.
- **La pantalla lo dice.** Al lado de «Activar»: «31 mensajes esperando que los apruebes →» con «WhatsApp no oficial a
  leads sin pago»; el link abre Chats en Borradores (`/chats?vista=borradores`, nuevo). El conteo es del server
  (`por_aprobar`, sólo los del motor: `origen: 'nutricion'`); `null` = no se pudo leer y la pantalla calla. Al
  activarla, el chat dice «Por WhatsApp no oficial, los mensajes a leads que no pagaron quedan para que los apruebes»
  sólo si algún WhatsApp de la salida no sale solo, con `saleSolo` del motor y no una copia (`dejaBorradores`).
- **El aviso de duplicada pregunta, no frena.** Al Activar, y al Publicar una ACTIVA (pausada, publicar no manda nada):
  «A la misma gente ya le escribe «X»: «<arranque de la otra>». Ésta: «<arranque de ésta>»», con «Activar igual». Sale
  por HECHOS (ver abajo): misma cohorte = un CRON de cada una con la misma etapa del mismo funnel (sin funnel = todos),
  la misma entrega o la misma etiqueta (por evento no se compara); el mismo canal en el primer mensaje; y horarios que
  se pisan (dos Recurrentes semanales sin un día en común, o mensuales en días distintos, no). Compara lo de AHORA de
  ésta (lienzo y CRON) con lo PUBLICADO de las otras, que es lo que manda el motor.
- **⚠️ Una defensa que no cubre TODOS los caminos que prenden algo no defiende** (revisión del Cerebro, 20/10 noche). La
  primera versión preguntaba sólo en el interruptor del lienzo: el «⋯» de la lista (el camino más común para activar)
  y un CRON agregado a una que YA está activa (se guarda en vivo, no habilita Publicar) prendían el doble recordatorio
  de #282 y #284 sin una pregunta. Ahora es UNA función (`duplicadaAlActivar`) que usan el interruptor, el «⋯» (pregunta
  antes del PATCH; «Activar igual» sigue sin volver a preguntar) y el guardado del CRON (avisa DESPUÉS de guardar, sólo
  si recién ahí pasó a ser la misma gente: `onGuardado` de `useDisparadores`, llamado después de `onError(null)` o el
  aviso se borraba en el mismo tick). Y al ACTIVAR se compara lo PUBLICADO de ésta (`abiertoPublicado`), no el
  borrador del lienzo: Activar prende la fila, no lo que se está editando. Lo mismo la nota del chat (`dejaBorradores`).
  Test: tests/automations-aviso-todos-caminos.test.ts.
- **⚠️ Y LA LISTA DE CAMINOS SE SACA DEL REPO, NO DE LA MEMORIA** (segunda revisión, 21/10). Arreglados el «⋯» y el
  CRON, seguían sin preguntar el TELÉFONO (/m/automations, que con `MOVIL_ACTIVO` es la pantalla de cualquier celular),
  «MaKo escribe tu nutrición» › Aprobar en /email y la API de MaKo. La pregunta pasó al SERVER, a la única puerta que
  prende (`setSecuenciaActiva` tira `DuplicadaError` sin `aunqueDuplique`; las rutas contestan 409 `duplicada`; Publicar
  una ACTIVA pregunta lo mismo antes de escribir los pasos). Cada pantalla vuelve a preguntar con eso y manda
  `aunqueDuplique` recién después de «… igual»; la API de MaKo lo dice en la PROPUESTA y sólo entonces el «sí» lo lleva.
  Un camino que nadie actualizó no prende en silencio: recibe el aviso como error. tests/automations-activar-todos-los-caminos.test.ts
  barre `git ls-files`: los llamadores de `setSecuenciaActiva`, quién escribe `activa: true` y qué pantalla hace PATCH con
  `activa`; uno nuevo lo hace fallar hasta que alguien lo mire.
- **⚠️ PUBLICAR UNA ACTIVA ES PRENDER LO NUEVO, y también tiene varias puertas** (tercera revisión, 21/10). Con la pregunta
  en `setSecuenciaActiva` y en la ruta de Publicar del lienzo, seguían reescribiendo lo publicado de una ACTIVA sin
  preguntar «MaKo escribe tu nutrición» › Aprobar, /email › Guardar (los pasos, y también la etapa o el disparador) y la
  API de MaKo (`editar_pasos_secuencia_mensajes` / `_email`): por ahí vuelve lo de #282 y #284. La guarda NO va adentro
  de `setSecuenciaPasos`: ahí escribe también el sistema (el hand-off, las variantes, Meta, las mudanzas), que no tiene a
  quién preguntarle. Va en `publicarPasos` (lib/nutricion.ts), que usan los caminos de una persona; /email pregunta con
  los pasos Y la etapa o el disparador nuevos antes de escribir nada (`duplicadaDeLaActivacion` con `columnas`); la API
  lo dice en la propuesta. El barrido lista a cada uno que escribe los pasos: o va por `publicarPasos`, o está en la
  lista del sistema con su motivo. Y mira los `.mts`: las mudanzas quedaban fuera de la red.
- **⚠️ TRES RONDAS DE REGLAS SOBRE EL TEXTO, Y LA RED SE MOVIÓ A LOS HECHOS** (21/10, decisión del Cerebro). El aviso se
  decidía por el PARECIDO del primer mensaje, y cada ronda arreglaba unos pares y rompía otros:
  1. **El umbral** (Dice ≥ 0,5 de las palabras de 4 letras o más; con menos de 3, sólo el MISMO texto). «Hola {{nombre}},
     soy Leila de LíderMente» al principio hacía «parecidos» dos mensajes distintos (0,55), y un recordatorio corto con
     el nombre del negocio pasaba callado (menos de 3 palabras con peso).
  2. **La firma de «la mayoría»** (sacar del parecido lo que se repite en el primer mensaje de casi todas): una
     REGRESIÓN. Contaba al par y a las otras (pausadas, de otra etapa): UNA más que dijera «Huayacán» bajaba #282 contra
     #284 de 0,53 a 0,47 y dejaba de avisar, y una copia pausada de Duplicar borraba todo lo que el par compartía.
  3. **La firma fija, sólo al arranque** (el relleno de una lista y el nombre del negocio, hasta el primer fin de frase).
     Seguía con falsos negativos (dos medios confirmados por el Cerebro en f43957365) y con falsos positivos.
  El diagnóstico obvio («falta afinar la regla») era el equivocado: ninguna regla sobre el texto separa «el mismo
  mensaje reescrito» de «otro mensaje a la misma gente», porque la diferencia la sabe la persona, no las palabras. Ahora
  se avisa SIEMPRE que otra ACTIVA le escribe a la misma gente (los hechos de arriba), y el aviso muestra el nombre de la
  otra y el arranque de los dos mensajes uno al lado del otro (`arranqueParaAviso`, 70 caracteres sin partir una
  palabra; un audio dice «(un audio o un archivo, sin texto)»). El parecido sólo ORDENA cuál mostrar con varias.
  Medido con los pares del Cerebro (tests/_pares-duplicada.ts): 0 de 34 duplicados de verdad sin aviso (24 + los 10
  cortos), #282 contra #284 avisa, y los 24 mensajes distintos de la misma etapa avisan también: son avisos CIERTOS (les
  escriben las dos). ¿Es demasiado? Medido en la base el 21/10 (sólo lectura): de 20 activas en 7 negocios, NINGUNA
  recibe hoy el aviso; si se prendiera todo lo pausado, el peor grupo es el de ws11 (#282, #284 y una más, 3 a la misma
  etapa). No hay etapas con 5 automatizaciones legítimas: no hace falta volver a una regla de texto. Regla que queda
  (AGENTS.md): una heurística sobre texto libre PROPONE u ORDENA; lo que decide es un hecho, y la persona compara.
- **⚠️ «UN EVENTO NO TIENE COHORTE QUE SE PISE» ERA FALSO** (revisión del Cerebro de cc8a82e6d, 21/10). La regla por
  hechos comparaba sólo la etapa, la entrega y la etiqueta, y daba por sentado que dos CRON por evento (un DM, un pago,
  «Se agrega etiqueta», «Agendó sin confirmar») no alcanzan a la misma gente. Pero `enrolarPorEvento` (lib/nutricion.ts)
  inscribe al lead en TODAS las activas del disparador: el unique es (lead, automatización), y `unaPorSecuencia` deduplica
  dentro de una, no entre dos. Lo más común: «Duplicar» una de DM o de pago (la copia nace pausada con el mismo CRON) y
  prender la copia; por Instagram y Messenger los dos mensajes salen al instante. Ahora el mismo disparador con el mismo
  evento (`subtipo`) es la misma gente, y «Se agrega etiqueta» (cualquiera) cruza con «Se le puso la N» si no ignora la
  N. «A mano» no. El test lo ata al motor: si `disparaPorEvento` dispara dos CRON con el MISMO evento, `mismaCohorte` las
  ve juntas. Medido en la base (sólo lectura, 21/10): hoy no hay dos activas del mismo evento en ningún negocio.
  ⚠️ **Y «el mismo disparador» tampoco alcanzaba** (revisión de 10b52bcc3). El motor junta disparadores DISTINTOS bajo un
  mismo evento (`TRIGGERS_POR_EVENTO`) y les suma la etapa en la que cae el lead (`conSuEtapa`): un lead nuevo de Meta
  entra a «Dejó el formulario sin agendar» y a «Un Lead Entró» (la etapa «lead») y recibe las dos bienvenidas; una
  reserva entra a «Agendó pero no confirmó» y a «Un Lead Agendó Llamada» (la etapa «agenda»). Es el caso más probable de
  migración: la galería ofrece «Un Lead Entró» como reemplazo de la bienvenida vieja. El test anterior ataba el aviso
  sólo a `disparaPorEvento`, que para esos eventos siempre dice que no: atar la regla a UNA función del motor no alcanza
  si el motor decide con varias. Ahora la tabla vive en un módulo puro (lib/nutricion-eventos.ts, con
  `ETAPA_DEL_EVENTO`) que leen el motor y el aviso. Dos que entran con el mismo evento son la misma gente, salvo las dos
  mitades de la post-agenda, que el motor separa. El test recorre la tabla. Verificado por el Cerebro (21/10): el motor
  inscribe igual que antes de la mudanza (el `enrolarPorEvento` real de los dos árboles, 660 escenarios, 0 diferencias),
  y de los pares que el motor inscribe juntos, en producción quedaban 46 sin aviso; ahora ninguno.
- **Cambiar a quién le escribe una ACTIVA, o por dónde, es activarla de nuevo para esa gente.** Por la API de MaKo,
  `cambiar_crons_secuencia` pasaba una activa a la etapa de otra sin preguntar, y `asignar_audio_paso` pasaba a WhatsApp
  el primer mensaje (de email) de una activa, al lado de una gemela de WhatsApp. La regla por hechos hizo esto último
  NUEVO: antes del canal, un email y un WhatsApp no se distinguían. Ahora los CRON de una persona por la API van por
  `publicarCrons` (lib/disparadores-guardar.ts, la misma pregunta que `publicarPasos`), y el audio que cambia el canal
  del primer mensaje va por `publicarPasos`; la propuesta lo dice y el «sí» lleva `aunqueDuplique`. El lienzo sigue
  guardando el CRON en vivo y lo DICE al lado de «Activar» (`dupActiva`). Un test barre quién llama a
  `guardarDisparadores`: uno nuevo tiene que preguntar o estar en la lista con su motivo.
- **Bajos de la misma revisión.** El arranque cortaba con `slice` por unidades UTF-16: partía un emoji y dejaba medio par
  suelto, «�» en pantalla, y la pendiente del Doer o de la API (que lleva el aviso) no se podía guardar en
  `mako_acciones_pendientes`. Ahora corta por grafemas (`Intl.Segmenter`), así que una familia 👨‍👩‍👧 queda entera. Los
  días de dos Recurrentes se comparan sólo en la MISMA zona: «lunes 23:30» de Tijuana y «martes 00:30» de Ciudad de
  México salen en el mismo instante. Además, a menos de 12 horas se pisan aunque sean días distintos (las 23:30 y las
  00:30), también con la vuelta del mes (el 28 a las 23 y el 1 a la 1; el día va hasta el 28, `DIA_MES_MAX`). Y una PAUSADA que se publica ya no lee todas las automatizaciones con sus
  pasos: primero mira si está activa, y después lee sólo las activas.
- **Un aviso que se calcula no se borra.** El del CRON nuevo en una activa colgaba del guardado (se lo comía el
  `onError(null)` del guardado siguiente, y se perdía si se cambiaba de automatización antes de que volviera). Ahora se
  CALCULA de lo que hay (sus CRON de ahora y lo publicado, `dupActiva`) y se dice al lado de «Activar» mientras sea así.
- **Guardas que cambiaron a propósito:** tests/motor-tick.test.ts fijaba «el tick no llama a
  `comprometerInscripciones`»; ahora fija que la llama UNA vez y sólo con `soloRecurrentes`. Y `motivo === 'vencio'`
  pasó a `motivo !== 'abrio'` (`recurrente` también mira sólo lo fresco), también en tests/espera-duracion.test.ts.

**Lo que quedó SIN hacer:** los 31 borradores de #282 y el de #284 siguen pendientes (aprobar o descartar lo decide
Martín) · el aviso de duplicada no mira la hora del día ni la reentrada (dos Recurrentes el MISMO día a horas
distintas avisan: el lead recibe los dos; un `ordinal` mensual, «el primer lunes», se toma como que se pisa) ni el
horario de envío propio de cada una · dos eventos «de antes» del mismo tipo en funnels distintos avisan igual (el
motor barre por el funnel de la FILA y el CRON no lo lleva: `higiene`, lib/disparadores.ts) · dos CRON de cohortes
distintas con «también al grupo de MaKo» le escriben los dos al grupo y no avisan · en el lienzo, guardar un CRON en
una activa no pregunta (por diseño: se guarda en vivo y el aviso queda al lado de «Activar») · la espera o la vista
previa de un paso por la API no preguntan (no cambian ni a quién ni por dónde) · `ETAPA_DEL_EVENTO`
(lib/nutricion-eventos.ts) es una aproximación: una reserva de una etapa de reunión que no se llama «agenda» («webinar» en
embudos viejos, una «stN» marcada Reunión) inscribe en «Agendó…» y en esa etapa sin aviso; el motor lee la etapa real
(`etapaDeLaReserva`), el aviso no la sabe · un mismo hecho que dispara DOS eventos (un pago aprobado que además pasa el
lead a Ganado, lib/cobros.ts `alCron`; una etiqueta vinculada a una etapa) inscribe en dos disparadores distintos y no
avisa (ya estaba antes) · el conteo está en la automatización abierta, no en la fila de la lista · nada se vio con
clics en un navegador.

**Vive en:** lib/mensajes-por-aprobar.ts · lib/setting-secuencias.ts (`leerPorAprobar`) · app/automations/SecuenciaPerfil.tsx
(la línea, `notaChat`, `conAvisoDuplicada`) · app/automations/ChatMako.tsx (`nota`) · lib/automatizacion-duplicada.ts ·
lib/motor-tick.ts · app/api/cron/nutricion-tick/route.ts · lib/nutricion.ts (`soloRecurrentes`) · test:
tests/recurrente-no-salio.test.ts · *20/10/2026, claude4.*

## «El chat de MaKo siempre abierto en la sidebar»: el pedido no se perdió en el código, se perdió en el relevo (20/10/2026)

**Síntoma.** El 20/10 Martín preguntó: «Te habia pedido varias cosas, ¿No tienes el registro?». Pedía el chat de Automations siempre abierto en la sidebar, sin el logo de MaKo y con la tuerca en su lugar.

**Diagnósticos obvios, los dos equivocados:**
- **«Nadie lo anotó»:** falso. El Cerebro reenvió el pedido textual al chat Automations el 16/10 a las 05:22 UTC (puntos 5 y 6 del «Feedback Automations»).
- **«Se hizo y se revirtió»:** falso. `git log --all --since=2026-10-16` no tiene un solo commit que lo toque. El chat a la derecha es de la decimocuarta tanda (51a3ad96d, 12/10).

**La causa real: un PUNTERO sin contenido entre cuentas.**
1. El chat de la cuenta 3 dejó los puntos 5 y 6 al final de la cola.
2. Al cerrar por cuota, el relevo escribió «lo visual de «Probar», 4c (Calendly) y los puntos 5-6», sin el texto (docs/relevo/chatbot.md:104).
3. El Cerebro de la cuenta 4 lo leyó como si los puntos 5-6 fueran parte de «Probar».
4. El chat nuevo buscó «el feedback del 16/10» y encontró OTRO documento con ese nombre (docs/feedback-16-10-crm-onboarding-second-brain.md, del CRM, de la tarde), donde el 5 y el 6 son otra cosa. Lo marcó «sin ubicar» (docs/relevo/chatbot.md:37).
5. Le preguntó al Cerebro y la pregunta no tuvo respuesta. Al día siguiente el pedido ya no estaba en ninguna lista ni en docs/pendientes.md.

Ya había pasado el 15/10 («Las doce cosas de Automations (vivían sólo en un mensaje entre chats)», bitácora): ese día se arregló para esas doce, pero no quedó como regla.

**Reglas que quedan:**
- Un pedido de Martín que llega por otro chat se pega LITERAL como hito `actor: "martin", tipo: "prompt"` en la bitácora del área, el mismo día, aunque vaya al final de la cola.
- Un relevo nunca escribe «los puntos N-M del feedback del <fecha>»: copia el texto o cita el hito.
- Un mismo día puede tener varios «feedback» (el 16/10 hubo dos), así que una fecha no identifica un documento.
- Una pregunta a otro chat que queda sin respuesta no saca el pedido de la lista: va a docs/pendientes.md con «sin ubicar» y el transcript donde buscarlo. Los transcripts quedan en ~/.claude/projects/…/<sesión>.jsonl; este estaba en a8f8993e, 2026-10-16T05:22:05Z.

**Vive en:**
- docs/relevo/chatbot.md:37, :104, :119-120
- app/admin/dev/chatbot/bitacora.ts:1638 (el último hito «prompt»)
- app/automations/SecuenciaPerfil.tsx:1202 y app/automations/SimuladorWhatsApp.tsx:827 (lo que sigue sin hacer)

**Hecho el 20/10/2026 a la noche (`claude4`), y lo que no se ve en el código:**
- **El chat es la sidebar POR PORTAL, y la ranura no se desmonta.** El chat necesita el estado del lienzo (los pasos, el
  borrador, `alListoIA`), así que lo sigue montando SecuenciaPerfil, por portal en una ranura de la lista flotante. La «←»
  esconde la ranura (`display: none`), no la saca: un portal hacia un nodo que desaparece desmonta el chat, y con él un
  pedido en vuelo de hasta cinco minutos. El muelle de la derecha quedó sólo para «Probar».
- **⚠️ El modal NO se importa en la lista ni en el lienzo, ni siquiera por tipos.** Arrastra acciones del servidor y los
  tests que dibujan SimuladorWhatsApp y SecuenciaPerfil caen AL IMPORTAR; además una guarda (automations-configuraciones)
  lee el TEXTO y caza un `import type` igual. La tab lo pasa como componente (`Configuraciones`) y el tipo de sus props
  vive en el módulo puro (`PropsConfiguraciones`, lib/config-automatizacion.ts).
- **Qué es de cada automatización y qué no.** El horario de oficina (propio, «sin horario» o el del negocio) y las horas
  entre dos mensajes a la misma persona sí; los topes por día y por hora NO: son el presupuesto anti-ban de UNA línea que
  comparten todas, y un tope por automatización no la protege. Sin nada guardado vale la del negocio: así cada
  automatización que ya existía arrancó con lo de su negocio sin escribir nada en producción.
- **En el motor, `fueraDeHorario` pasó a ser «TODAS cerradas»** (o «no pude leer»); cada fila pregunta por la suya
  (`fuera(insc.secuencia_id)`) y las cerradas sin nada que corra afuera ni se leen. Lo propio de todas sale de UNA lectura
  estricta por corrida (`configsDeEnvio`): «no pude leer» no es «no tiene nada propio». El tick barre también cuando abre
  el horario PROPIO de una automatización (`abrioAlgunaPropia`), o lo que venció de noche esperaba a la corrida de la hora.
- **El id `au-mako` del recorrido ya existía y está prohibido**: era «MaKo en WhatsApp» (retirado en la undécima) y un
  test lo veta. El paso del chat es `au-chat`. Y `marcasDeVoseo` marca «acá»: el texto dice «aquí».

**La revisión adversarial lo frenó (Cerebro, 20/10/2026 noche), y lo que enseñó — arreglado el mismo día (`claude4`):**
- **⚠️ Un control de UNA automatización que escribe algo del NEGOCIO.** La tuerca montaba el `HorarioEnvioPanel` de
  siempre con otra `fuente`, pero el desplegable del huso seguía guardando `mako.timezone` (`saveZonaHorarioAction`):
  elegir Madrid en «Leads Meta» dejaba a TODAS las demás mandando de madrugada, y la tarjeta decía «Sólo para esta
  automatización». Reusar un panel del negocio adentro de algo por automatización obliga a revisar CADA cosa que guarda,
  no sólo la `fuente` principal. Ahora, con `zonaSoloLectura`, el huso es texto («Huso del negocio: …»). **Regla:** en la configuración de una
  automatización, lo del negocio se muestra y no se edita.
- **⚠️ Una copia que pierde lo que vive FUERA de la fila.** `duplicarSecuencia` copia una lista blanca de columnas, y la
  configuración propia está en `app_settings` (`automatizacion.config:<id>`): la copia de una «Prospección fría» de 9 a
  18 con 48 h nacía mandando a las 3 AM con 20 h, sin aviso. `copiarConfig` es OBLIGATORIA en las dependencias (un
  llamador nuevo que la olvide no compila) y, si falla, la copia se borra. Regla: todo lo que se guarde por id fuera de
  la fila tiene que estar en «Duplicar».
- **Esconder no es mudar.** `sinPersona` sacó las horas «misma persona» del NEGOCIO del único panel que las editaba: el
  valor que heredan TODAS las que ya existían quedó sin pantalla. Volvieron al mismo panel, rotuladas «Misma persona, por
  defecto» (`personaPorDefecto`).
- **La elegida sola no es una elección.** `selId` cae en la primera para dibujar su lienzo; con `enLaLista` en false, la
  sidebar arrancaba siendo SU chat y escondía la lista, «＋ Nueva» y el «?» (el recorrido salteaba tres pasos). Arranca en
  la lista; el chat aparece al ELEGIR (clic, `?sec=`, la recién creada).
- **Un listener en captura sobre `document` alcanza al componente escondido.** El Escape de ChatMako cancelaba el pedido
  en vuelo aunque la ranura estuviera oculta (un Escape para cerrar un modal de la lista). Ahora mira si se ve
  (`getClientRects`) y si hay un diálogo o menú abierto afuera.
- **Las «Evento de MaKo» no pasan por el motor**: esperan la apertura en lib/flujos.ts (`aperturaDelNegocio`), que leía
  sólo el horario del negocio. Ahora lee el de la fila (`filaDeIdCorrida` → `automatizacion.config:<id>`, en el negocio
  donde VIVE la fila) con la zona del que la recibe.
- **Una lectura nueva que falla no puede frenar lo que antes andaba.** «Lo propio ilegible» cortaba el carril del
  recordatorio de TODAS (`limites-ilegibles`) y, en el tick, tiraba la ruta entera. Ahora el horario lo marca
  ilegible (no sale prospección), el carril corre con las horas del negocio, y el tick sigue sin esa lectura. Lo mismo
  la zona: sin ella se cierran SÓLO las que tienen horario (`cerradasAhora(…, null)`), no la de los anuncios.
  ⚠️ Y ESE ARREGLO ABRIÓ UN HUECO (revisión de la misma noche): «el horario ya cerró la prospección» no vale con
  `ignorar_ventana`, que saltea el bloque del horario; esa corrida mandaba TODO con las horas del negocio. El corte
  volvió para cuando nada lo acotó (`configs === 'ilegible' && fueraDeHorario == null`). Un arreglo que se apoya en «lo
  de arriba ya cortó» tiene que mirar los caminos donde lo de arriba no corre.
- **«Copiar flujo» › «Crear» es otra copia que crea un id desde otro.** Pegado en el MISMO negocio (el token guarda el
  negocio y la automatización de origen: `origenDeCopia`) lleva la configuración propia, como «Duplicar»; entre
  negocios no (es de otro negocio). Va adentro del try que borra la copia si algo falla (`crearDesdeCopia`, `configDe`).
- **Arrancar en la lista dejó muerto el paso au-chat del recorrido** (sólo buscaba el chat, y el «?» vive en la lista):
  ahora también señala la fila elegida, y el texto dice las dos formas («Abre una y aquí le pides cambios a MaKo»).
- **Menores:** un horario sin `activo` booleano se rechaza (`sanearHorario` lo leía como «apagado» = a las 3 AM);
  apagado con los días vacíos se guarda (como el del negocio); «como el negocio» BORRA la clave (los '{}' se
  acumulaban) y el tick lee sólo los prendidos, con tope; la tarjeta dice «manda a cualquier hora» con el propio
  apagado; tres ▲ rápidos ya no guardan 21 en vez de 23 (estado optimista y cambios juntados en el respiro); la tuerca
  la ve también el que no es admin (sólo lectura); el aviso de Prospección consulta una vez; «contesta sola» del AI
  Step mira el horario de SU automatización (`horarioDeEnvioDe`). Test: tests/automations-config-revision.test.ts.

**Lo que quedó SIN hacer:** el chip «Espera a que abra» de la tarjeta MaKo del lienzo lee el horario del negocio
(`useFijarHorarioOficina`, app/automations/horario-oficina.tsx: el lienzo no lee la configuración de su automatización) ·
las horas «misma persona» del negocio que se cambian abajo no refrescan el «Como el negocio (20 h)» de arriba hasta
reabrir el modal · con «sin horario» propio, «contesta sola» sigue con su 9 a 21 de siempre (`puedeContestarSolo` sin
`enHorario`) · el piso de la línea entre automatizaciones: con 3 h propias, «Leads Meta» le escribe 3 h después de un
WhatsApp de «Prospección» (20 h); al revés se respeta. Si Martín quiere un piso, `max(horas de la fila, las del negocio)`
sólo frente a envíos de OTRA (lib/nutricion.ts, `ventanaDe`) · una plantilla de SuperAdmin copiada a un cliente no lleva
la configuración (es de otro negocio) · la sugerencia del aviso al equipo va como texto, sin botones · nada se vio con
clics en un navegador · de la cola del 16/10: el botón de conectar WhatsApp (OnboardingChatAgent.tsx) y lo visual de
«Probar» (nombres de persona, chips «antes de», «Prueba finalizada»).

**Vive en:** app/automations/SimuladorWhatsApp.tsx (la ranura, `enLaLista`) · app/automations/SecuenciaPerfil.tsx (el
portal, `BotonTuerca`, `conAvisoProspeccion`) · app/automations/ConfiguracionesBoton.tsx (el modal y el «?») ·
app/automations/ConfigAutomatizacionPanel.tsx · lib/config-automatizacion.ts (+ `-db`) · lib/nutricion.ts
(`procesarEnvios`) · app/api/cron/nutricion-tick/route.ts · lib/api-mako/areas/chatbot.* (`configuracion_automatizacion`,
`configurar_automatizacion`) · lib/secuencia-duplicar.ts (`copiarConfig`) · lib/flujos.ts (`aperturaDelNegocio`) ·
app/configuraciones/HorarioEnvioPanel.tsx (`zonaSoloLectura`) · app/automations/LimitesEnvioPanel.tsx (`personaPorDefecto`) ·
test: tests/automations-chat-siempre.test.ts y tests/automations-config-revision.test.ts · *20/10/2026, claude4.*

## La segunda revisión del pedido B (Cerebro, 20/10/2026 noche): lo que el arreglo dejó abierto

La punta `396a82847` entró con estos defectos conocidos (revisión adversarial de 2 lentes + escépticos; detalle en las
notas compartidas del Cerebro, `revision-automations-20-10-noche.md`). El motor quedó bien: ningún envío doble ni
ocurrencia perdida del Recurrente.
- **⚠️ Un arreglo que AFLOJA un corte tiene que recorrer todos los caminos que antes cortaban.** «Lo propio ilegible ya
  no frena el carril» se hizo dentro de `if (!opts?.ignorarVentana)`: con `ignorar_ventana=1` y la configuración
  ilegible, la corrida manda con las horas del negocio (antes devolvía `limites-ilegibles`). lib/nutricion.ts:3718-3755.
- **El aviso de duplicada vive en UN camino de los varios que prenden algo**: no sale al Activar desde el «⋯» de la
  lista ni al agregar un CRON a una activa (app/automations/SimuladorWhatsApp.tsx:634). Es el aviso que habría frenado
  #282 + #284 de Leila.
- **«Copiar flujo» › «Crear» en el MISMO negocio pierde la configuración propia**: sólo Duplicar llama a `copiarConfig`
  (app/api/chat-agent/secuencias/route.ts:437, `crear_desde_copia`).

**Lo que quedó SIN hacer** (pedido a Automations como punta de seguimiento): los tres de arriba · el aviso al Activar
compara el borrador del lienzo y no lo publicado (SecuenciaPerfil.tsx:1062) · el paso `au-chat` del recorrido no
aparece nunca para quien ya tiene automatizaciones (arranca en la lista). *20/10/2026, Cerebro, claude4.*

## El motor no le escribe a un bloqueado en NINGUNA forma del número (21/10/2026)

La secuencia, el AI Step que contesta solo, la rama y los recordatorios de reunión preguntan `estaBloqueado(lead.telefono)`
(lib/nutricion.ts, lib/reunion-recordatorio.ts). Comparaba exacto: un bloqueado desde /chats (542233550684) con
2233550684 en el CRM seguía recibiendo, y desde el 20/10 le llega. La regla ahora vive en `estaBloqueado` y el motor la
hereda sin cambios; el residuo de nutrición inscribe con la misma (`TelefonosDe`). Detalle y porqué en
hallazgos-comunicacion («La identidad de un bloqueo es UNA regla»). *21/10/2026, chat «CRM» (claude4).*

## La prospección del Sprint de Mauricio: el CRM nuevo no inscribía a nadie, y el cupo era de la campaña (21/10/2026)

Martín, 21/10: «que pruebes y valides que todo funcione bien en Automations de punta a punta para que con Mauricio
podamos hacer esta estrategia de prospección con todos los contactos que tiene en su CRM que nunca fueron contactados».
El plan obvio: un CRM nuevo de Prospección, sumarle los 1.094 nunca contactados y colgarle una automatización. El
relevamiento previo (C:/dev/cerebro-herramientas/automations-mauricio-21-10.md) midió por qué no andaba; esto es lo
que quedó de arreglarlo.

### Un CRM nuevo con sus leads AGREGADOS inscribía a CERO, sin un error

**Síntoma:** CRON «Sprint de Diseño › Por contactar» con 301 leads agregados en esa columna → «inscribiría: 0».
**Causa:** la cohorte de un CRON por etapa (`cohorteDeTrigger`, `etapa_actual`) filtraba por la CASA del lead
(`leads.funnel_id`) y su etapa (`pipelineStageOf`). Sumar a otro CRM («se AGREGA, nunca se mueve», Martín 06/10)
escribe sólo una fila de `lead_funnel`, que ninguna cohorte leía. Los 1.169 leads del ws1 tienen casa NULL (el CRM
principal): toda automatización colgada de otro CRM era sorda a ellos. Y el CRON «Tienen la etiqueta» de esa misma
automatización hereda su CRM, así que el camino «alternativo» (etiqueta + Recurrente) también daba cero si la
automatización declaraba el CRM.
**Regla:** una automatización que DECLARA un CRM ve a la casa y a los agregados a ese CRM (`agregadosQueEntran` y
`conAgregados`, lib/nutricion-ambito.ts): la etapa es la de ESE CRM, sólo `abierto` (el estado es de la persona), y la
ventana de 90 días mira cuándo se lo sumó o se lo movió ahí. Sin CRM declarado (las de antes del ámbito) no cambia
nada: aplican a todos los productos, y sumarles las filas escribiría dos veces a la misma persona.
**Medido:** ws3 con 301 agregados: origin/main 0, con el arreglo 288 (los 13 cerrados quedan afuera). Producción, las
20 cohortes activas de los 7 negocios con automatizaciones: iguales antes y después (scratchpad de la sesión,
`cohortes-todos.mts`; sólo lectura).
**La trampa que encontró la revisión adversarial:** una fila que NACE con el lead (Meta con varios CRM en la campaña,
una landing con varios) no puede entrar: la casa ya lo saluda por el evento del alta y el «Un Lead Entró» del otro CRM
le mandaba una SEGUNDA bienvenida en el barrido de la hora. `filaNacidaConElLead` (10 min, y sin movimiento después).
**Vive en:** `lib/nutricion.ts` (`cohorteDeTrigger`, `agregadosEnEtapa`, `leadsConEtiqueta`) · `lib/nutricion-ambito.ts`
· test: tests/cohorte-crm-agregados.test.ts.

### «Mover de etapa» escribía la etapa del OTRO CRM en la principal del lead

**Síntoma (por leer el código, nadie lo vio pasar todavía):** «Mover a Contactado» del CRM de prospección, corrido
sobre un lead agregado, llamaba `setPipelineStage(lead, 'st1')` en su CASA. `setPipelineStage` no valida que la key
exista en el CRM del lead: la etapa principal de Mauricio quedaba en una key que su CRM no tiene (el tablero la dibuja
en la primera columna, como los 1.050 'reactivacion' de hoy) y la tarjeta del Sprint no se movía.
**Causa:** el control de etapa guarda `embudoId`, pero `proponer_cambio_etapa` no lo declara y `paramsDelPaso` lo saca.
**Regla:** el flujo decide por lead (`moverEnElCrmDelPaso`, lib/api-mako/flujo.ts; `dondeMoverEtapa`,
lib/editor-acciones.ts): en su casa, la casa; agregado, `mover_lead_en_producto`; donde no está, no mueve y lo dice.
Salvo lo de antes (revisión adversarial): si la etapa existe en su casa, o su casa no se pudo resolver, se mueve la
casa como siempre — las 62 automatizaciones sin CRM guardan igual el `embudoId` del principal.
**Sin hacer:** en un CRM agregado, «Ganado» no registra la venta ni cambia el estado (es el modelo de
`mover_lead_en_producto`) y el paso no lo dice. `setPipelineStage` sigue aceptando una key que el CRM del lead no tiene.

### «Simulado» cuenta como «ya le escribiste» pero NO gasta el tope

`?commit=1` del cron marca 'simulado' los pasos de un canal apagado. `leadsYaContactados` incluye 'simulado' (la
condición «Nunca le escribiste» lo da por contactado), pero `enviosUltimas24h` / `enviosEnLaHora` cuentan sólo
'enviado'. Así que un commit forzado no reproduce el reparto de una campaña (el cupo nunca se llena) y además
«quema» a esos leads para una campaña de verdad. **Regla:** el reparto se prueba con el envío real y topes bajos
(Configuraciones › Límites en 1-2 por día), nunca con `commit=1`, y nunca en el ws1.
**Vive en:** `lib/nutricion.ts` (`leadsYaContactados`, `enviosUltimas24h`) · app/api/cron/nutricion/route.ts.

### El cupo de WhatsApp es UNO por negocio: una campaña le comía el día a la bienvenida

**Síntoma (medido en la cola, no en un envío):** la cola era FIFO por `proximo_envio_at`. Una campaña de 1.000
inscripta a las 10:00 se ponía delante del audio de «Un Lead Entró» de un lead de anuncios de las 10:05, y hacia la
tarde se llevaba las 40 del día: la bienvenida salía mañana. Ordenar no alcanza: el día se gasta de a poco.
**Regla, a la vista en Configuraciones › Límites (`textoPrioridad`):** primero lo que ENTRA — un lead que llegó por un
canal (`origen_lead`: formulario, landing, agenda) o agendó en 24 h va primero en la cola (una vuelta) — y un
WhatsApp a cualquier otro usa el cupo menos una reserva (`reservaParaEntradas`: una hora del cupo por día, con techo
10, y 1 por hora). **La trampa de la revisión:** sin el `origen_lead`, una base fría IMPORTADA a la mañana y lanzada a
la tarde contaba como «fresca» y se llevaba el cupo entero. Y «Datos de Mau» copia los leads al ws3 con su
`origen_lead` y su alta: los que Mauricio recibió en las últimas 24 h cuentan como entrada en la prueba (6 de 300 el 21/10).
**Vive en:** `lib/nutricion-prioridad.ts` · `lib/nutricion.ts` (`procesarEnvios`, `entradasFrescas`, `sinLugar`) ·
`app/automations/LimitesEnvioPanel.tsx` · test: tests/primero-lo-que-entra.test.ts.

### «Sale sola» volvió, a la vista, en cada tarjeta

Salió del editor el 09/10 («¿Qué es "Revisar antes de enviar"?... Quitalo») y el motor lo siguió leyendo: a un lead
sin pago, una tarjeta nueva quedaba como borrador en Chats sin que nada lo dijera (los 31 de Leila del 20/10; la
campaña serían 1.000). Ahora es un interruptor debajo del teléfono, con lo que pasa en cada caso y la regla de quien
ya pagó. **Regla:** lo que la casilla pinta sale de la regla del motor (`saleSolaDelPaso` → `revisarHeredado` /
`saleSolo`), probado para cada combinación. **Vive en:** `app/automations/FlujoLienzo.tsx` (`data-sale-sola`) ·
`lib/flujo-conversacion.ts` · test: tests/sale-sola-por-tarjeta.test.ts.

### El aviso de «Si responde» lleva a la CHARLA, y en «Si responde» la tarjeta deja de ser «tal cual»

`{{link_chat_lead}}` («Link a su conversación», /chats?lead=<id>) está en el «{ }» y el aviso armado suma «💬 <link>»
debajo de la ficha. **Lo que no se ve:** en «Si responde» el motor le pasa a la tarjeta lo que escribió el lead
(`LLENA_EL_FLUJO`) y, con eso, `armarAvisoDeTarjeta` arma el formato de siempre (🟡 título, la cita, nombre ·
teléfono, ficha y charla) aunque la tarjeta sea «tal cual». Y Publicar rechaza `{{lead_escribio}}` en esa tarjeta
(«No existe»: `contextoDeTarjeta` no le da `conEscrito`), aunque el motor la cita igual. **Sin hacer:** decir en la
tarjeta que en «Si responde» sale con la cita, o darle `conEscrito` y dejarla tal cual.

### En un negocio sin línea, ni Publicar ni «Probar» abren: piden conectar el WhatsApp

En el ws3 (sin línea), con tarjetas de WhatsApp, Publicar y «Probar» abren «Vincular número» (y eso crea la fila
`mako_ws3` en «conectando», sin escanear). O sea: el simulador, que no manda nada, también necesita el chip. La cohorte
se midió por script (`leadsDeCohorte` con cada árbol, sólo lectura) en vez del dry-run de una automatización activa.

## La llamada con Mauricio del 22/10/2026: el goteo, «Discutir / Editar» y la etapa que «no existía»

Lo que salió de probar la campaña del Sprint en vivo con Mauricio (Fathom 195129619, 01:51-02:16; la lista en
C:/dev/cerebro-herramientas/feedback-llamada-mau-22-10.md, A1-A7). El plan cambió: el CRM «Sprint 3 días» (#44 en el
ws1), los ~1.050 en «Lead entrante», y cada día Mauricio mueve A MANO 50 a «Prospección activa», que dispara la apertura.

### El goteo: lo que frena el goteo tiene que pasar a SU TURNO, o sale de a uno por HORA

**Pedido:** «al pasar 50 a Prospección activa, que no salgan juntos: uno, esperar 4-5 min, el siguiente», configurable
por automatización (minutos, tope por día, días). **Regla:** un SUB-tope adentro del de la línea (lib/goteo.ts; la
línea sigue siendo el techo anti-ban del negocio), con los días del horario propio. **La trampa:** el tick de cada
minuto mira sólo lo que venció hace ≤10 min (`VENTANA_FRESCA_MIN`). Una fila frenada que se deja «vencida» con su hora
vieja la ve recién la corrida de cada HORA: con 50 inscriptos de una, el goteo de 5 minutos habría mandado uno por hora.
Lo frenado SÓLO por el goteo pasa a su turno escalonado (`turnoDeGoteo`: el lugar libre más `minutos` por cada una que
ya está delante); lo frenado por la línea, como siempre. **Vive en:** lib/goteo.ts · lib/nutricion.ts (`usoDelGoteo`,
`sinLugar`, `quedaFrenada`) · Configuraciones › Límites de cada automatización · test: tests/goteo-automatizacion.test.ts.
**Para que la línea deje pasar 50 a la campaña:** la campaña usa el día de la línea menos la reserva para lo que entra
(hasta 10 por día y 1 por hora: tests/primero-lo-que-entra.test.ts) y menos lo que ya mandaron las bienvenidas. Con el
goteo de 5 min son 12 por hora: la línea pide ≥13 por hora y ~65 por día.

### El chat no obedecía porque no veía la charla (y no porque «no quisiera»)

**Síntoma (el chat guardado de #289):** a «quiero que estos sean los mensajes: …» MaKo contestó «habría que editarlos o
añadir nuevas tarjetas»; a «hazlo como te lo indiqué», «indícame qué cambios…»; al tercero armó 2 de 4 y borró una
variable. **Lo obvio era tocar el prompt de editar; lo de verdad:** (1) la primera frase la ruta la mandó a EXPLICAR o el
modelo contestó en vez de cambiar, y no había forma de pedir «hacelo»; (2) el prompt de editar recibía SÓLO el último
mensaje: «como te lo indiqué» no tenía a qué referirse, aunque el cliente ya mandaba el `historial`. **Regla:** la
persona elige Discutir (sólo contesta) o Editar (nunca explica; contestar sin cambiar es un error que el reintento
corrige; los textos pegados van tal cual); y la charla viaja SIEMPRE (`bloqueDeLaCharla`). Medido en seco con el flujo
de #289: «hazlo como te lo indique» cambió 1 tarjeta y agregó la otra con el texto tal cual. **Vive en:**
lib/flujo-ia-intencion.ts · app/api/chat-agent/secuencias/ia/route.ts · app/automations/ChatMako.tsx · test:
tests/chat-mako-discutir-editar.test.ts. **Sin hacer:** al CREAR, el modelo sigue inventando el texto de una tarjeta de
audio que la persona dijo que graba ella (el pedido de #289); crear no tiene modo Editar.

### «Esta etapa no existe» no era un cache, y TAMPOCO era la etapa: era el CRM

Mauricio creó «Prospección activa» y MaKo dijo «esa etapa no existe»: parecía que el chat veía las etapas viejas. El
chat guardado lo desmiente: la pregunta del CRON ya ofrecía «Prospección activa» (`venta:44:st0`). **El primer
diagnóstico (A5, 661146056) también estaba mal:** «era «Contactado», que el CRM «Sprint 3 días» no tiene». La prueba de los
chats del Cerebro lo midió con una etapa que SÍ existía («movelo a Respondió», 3 de 3) y salía igual: «Mover de etapa»
(`proponer_cambio_etapa`) no pide CRM, y `resolverAccion` buscaba la etapa SIEMPRE en el CRM principal
(`resolverProducto(null)`). **Regla:** la etapa de «Mover de etapa» se busca primero en el CRM del CRON, después en el
principal, después en cualquiera (`crmDeLaEtapa`), y el paso guarda ese CRM en `embudoId`, como el control de etapa del
lienzo, para que el motor mueva la tarjeta de ESE CRM (`moverEnElCrmDelPaso`). Y un aviso de algo que no existe dice CUÁL
y DÓNDE. **Lo que enseña:** «una etapa que no existe» se mide con una que SÍ existe antes de culpar al pedido. **Vive en:**
lib/flujo-ia.ts · test: tests/chat-mako-prueba-de-chats.test.ts.

### La plantilla de prospección

No había ninguna para «apertura a los que muevo a una etapa». «Prospección: apertura» (lib/plantillas-automatizaciones.ts):
CRON en la etapa a la que se MUEVE (no la de entrada), «Nunca le escribiste» + «Tiene WhatsApp», una apertura que nace
para aprobar. Sin AI Step: el test de la galería exige 2+ escenarios a todo AI Step, y el «sólo avisa» sin escenarios no
pasa; el aviso de quien responde se arma con «Si responde» → «MaKo en WhatsApp».

## La barra de grabar decía lo mismo grabando que sin grabar (22/10/2026, la llamada con Mauricio)

Mauricio grabó una nota de voz en Offer (min 56:01-56:27): «¿está grabando? No», y borró y repitió dos veces. La barra es UNA
(app/whatsapp/_shared/VoiceRecorder.tsx → `BarraGrabacion`) y la montan WhatsApp (el composer), Automations (el lienzo y los
pasos de audio) y Offer (la tab con el composer, el onboarding con la caja única). Test: tests/mic-grabando.test.ts.

- **El diagnóstico obvio («le falta el punto rojo, el tiempo o la onda») era el equivocado: los tres estaban.** Lo ambiguo eran
  dos momentos. Mientras el navegador abre el micrófono (su cartel de permiso, o un auricular que tarda), la barra ya estaba
  pero con el punto gris, 0:00 y la onda quieta: se lee «no graba». Y grabando, la onda era una animación que se movía SOLA:
  hablaras o no, con el micrófono equivocado o mudo, igual. Nada en pantalla respondía a la voz.
- **Ahora:** mientras abre, lo dice con palabras («Abriendo el micrófono…» y, a los 2,5 s, «Permite el micrófono»); grabando,
  el punto rojo LATE (`mako-latido`) y la onda sigue el nivel real del micrófono (la sesión entrega su `flujo`, un
  AnalyserNode lo escucha sin sonar por el parlante, `nivelDeMuestras` lo pasa a 0-1). Si se habla y no se mueve, no entra.
- **Las alturas se escriben en el DOM, no en un estado de React:** un estado por cuadro re-dibujaría la caja entera 60 veces
  por segundo. Una barra armada a mano sin `flujo` (o sin Web Audio) se mueve sola, como antes.
- **El ✓ del onboarding de Offer no se veía en oscuro:** Offer pinta la barra con `--good: var(--ink)` (SIN_VERDE) y el ícono
  iba fijo en blanco; la tinta del modo oscuro es casi blanca. El ícono va en `--sobre-good`, que quien cambia `--good` también
  define.
- **Cómo se miró sin levantar la app:** la barra real compilada con esbuild en una página suelta, con `getUserMedia`
  reemplazado por un oscilador cuyo volumen sube y baja como una voz (frases con silencios) y que tarda en «abrir»; servida
  con `python -m http.server` y recorrida en el navegador (el panel de vista previa no ejecuta archivos locales).

**SIN HACER:** mirarlo en producción en los tres lugares, con un micrófono de verdad (en un teléfono Android, el permiso del
sistema además del del navegador).

## La prueba de los chats del Cerebro (22/10/2026): 36 casos sin pantalla, y lo que se arregló con ellos

El arnés del Cerebro (rama `probar-chats-automations`, `scripts/probar-chats/automations.mts`, con lo GUARDADO como juez)
corrió 36 casos contra be4b9189a (18 fallas, causa por causa en `verificacion-automations-be4b9189a.json`). Se volvió a
correr acá tres veces, con la pantalla de hoy (que manda «Editar» por defecto): **producción 4de3fe769: 12 pasan · con los
arreglos de editar: 21 · con todos: 20, pero 12 casos cortados por «No tienes ninguna IA gratis conectada»** (Gemini sin
cuota todo el día y la red de la plataforma agotada al final: ese número no mide el código).

### Editar, prendido por defecto, rechazaba toda respuesta (la regresión la metió 4de3fe769)

**Síntoma:** «¿Qué hace esta automatización?», «que no salgan todos juntos» o «cambiá el mensaje» terminaban en «MaKo armó el
flujo pero quedó mal: No cambió nada». **Causa:** en Editar, `ERROR_EDITAR_SIN_CAMBIOS` rechazaba CUALQUIER "respuesta", y
la pantalla arranca en Editar. **Y el arreglo obvio tenía su trampa:** con el bloque de Configuraciones en el prompt, el
modelo contestó «Configuraciones › Acciones» (no existe) a «que lo llame por teléfono» y «Se configura en Configuraciones ›
Límites» a «¿A cuántos les va a llegar?». **Regla:** en Editar, una pregunta DIRECTA (`esPreguntaDirecta`: empieza con «¿» o
termina en «?», sin textos pegados) va al prompt de explicar; y una respuesta vale (`errorDeRespuestaEnEditar`) si no hay
textos pegados y nombra un lugar REAL (Horario o Límites), dice que no se puede sin delegar («pídemelo», «habría que»), o
pregunta para aclarar sin que los textos ya estén en la charla. Un lugar que no existe vuelve al modelo con el error que lo
nombra. **Vive en:** lib/flujo-ia-intencion.ts · app/api/chat-agent/secuencias/ia/route.ts · test:
tests/chat-mako-discutir-editar.test.ts.
**Cómo se metió, y la regla que queda (AGENTS.md):** el test de 4de3fe769 fijaba la regla tal como se escribió («en Editar,
contestar es un error») y sólo probaba la falla que se buscaba (los textos pegados de la llamada). Nadie probó una pregunta
con Editar prendido por defecto, y el arnés, que lo veía, se corrió después del deploy. **Un cambio en un chat de MaKo pasa
su arnés de casos de uso ANTES de pasar la punta**, con los casos que el cambio no buscaba (preguntar en el modo nuevo,
imposible, ambiguo). El test que fija la regla tal como la escribiste no cuenta como prueba de uso.

### Lo que era código y no modelo

- **«Cambié» sin ningún cambio:** lo guardado trae `preheader: null` y el parche de un WhatsApp lo borra; `contenido()`
  comparaba el JSON crudo. Ahora compara la forma estable (sin vacíos, claves ordenadas: `estable`).
- **«arranque» (el verbo) pisaba el CRON** con la etapa de entrega «Arranque»: si la etapa de venta que eligió el modelo está
  escrita en el pedido, se respeta, salvo que hable de un cliente («no es lead entrante, es un cliente entrante»).
- **El link que escribió el dueño se borraba** («que les mande el link https://sprint.mauriciobustos.com/»): se queda si
  está tal cual en el pedido (`linksDelPedido`); el que inventa el modelo se sigue borrando, y otra ruta del mismo sitio también.
- **`{{empresa_del_lead}}` se borraba y dejaba «¿Sigues al frente de?» al lead:** una llave que nombra un dato que existe
  pasa a la del catálogo (`aliasDeVariable`: empresa, apellido, nombre_completo, nombre), con aviso.
- **Un pedido de 8.304 caracteres se cortaba a 2.000 en silencio** y MaKo armaba otra cosa: ahora la ruta lo rechaza
  diciendo cuántos tiene y cuántos lee (`TOPE_PEDIDO`).
- **«Entre el primero y el segundo esperá 2 días» no hacía nada:** un tramo sólo iba a una salida vacía. En la «sig»
  ocupada de una tarjeta simple, va EN EL MEDIO si termina en una sola punta (como el ＋ en medio de una flecha).
- **Una espera de 5 minutos entre dos WhatsApp** la retiene «Misma persona» (20 h de fábrica): lo avisa el código
  (`AVISO_MISMA_PERSONA`), porque el modelo la ponía sin decirlo o culpaba a Meta.
- **«Avisame por WhatsApp» armaba un WhatsApp al lead:** es «avisar_al_equipo» (regla en `REGLAS_EDITAR`).
- **Al CREAR con textos pegados** (lo de Mauricio: lienzo vacío y la secuencia con «(esperar 1 día)»), van tal cual, con las
  esperas que escribió y sin las 20 h de la regla 3 (`REGLAS_PEGADO`, en el `user` de crear sólo si pegó textos).
- Y el prompt no sabía de Configuraciones (horario, goteo, topes, «Misma persona», el ↶): `LO_QUE_NO_ES_TARJETA`.

**Vive en:** lib/flujo-ia.ts · lib/flujo-ia-intencion.ts · lib/flujo-ia-crear-core.ts · tests:
tests/chat-mako-prueba-de-chats.test.ts, tests/flujo-ia.test.ts («en el medio»), tests/flujo-ia-arreglos.test.ts (alias).

### Sin hacer

- **«No tienes ninguna IA gratis conectada» miente** cuando las IA gratis están SIN CUOTA (Gemini 429 todo el día, Groq
  agotado): en la tercera corrida cortó 12 de 36 casos con ese texto. Es del área IA (lib/ai-cheap.ts y su mensaje).
- **Reordenar** («poné el tercero primero») no es una operación de editar: el modelo devuelve nada y sale «No cambió nada».
- **«Deshacé eso»** no tiene lo que se borró: el modelo inventa otro texto. Lo honesto hoy es el ↶ (ya está en el prompt);
  lo de verdad sería pasarle al modelo las tarjetas publicadas que el borrador ya no tiene.
- **«Cuando entra a la etapa X» con una X que no existe:** el modelo no devuelve ni cambio ni respuesta, y sale «No cambió
  nada» (medido también en producción, 87365c830).
- **«Editalos y agregalos:» + textos** (el turno 1 del «Hazlo como te lo indiqué»): el modelo PISA los dos mensajes que había
  en vez de sumar los nuevos, y el turno 2 sale «No cambió nada». Lo de la llamada sigue a medias. Pide una regla en
  `REGLAS_EDITAR` («agregá / sumá = tarjetas nuevas, no cambies las que están»), que por la regla de AGENTS.md tiene que pasar
  el arnés ANTES de la punta: hoy no se pudo (sin cuota de IA).

**Medido en producción (87365c830, 22/10 ~12:40, 16 casos de preguntar en Editar, imposible, ambiguo, Configuraciones,
textos pegados y «Si responde»):** la primera pasada, 9 pasan, y ninguna pregunta en Editar terminó en «No cambió nada»
(«¿qué recomendás?», «¿a cuántos les llega?», ambiguo, goteo, sábado y domingo, 50 por día, la secuencia pegada); 4 de los 7
rojos, cortados por la cuota. La segunda pasada, 15 de 16 cortados por «No tienes ninguna IA gratis conectada» (Gemini:
`GenerateRequestsPerDayPerProjectPerModel-FreeTier`).
- **Los turnos tardan 16-76 s** (la regla de Martín es 20 s).
- **Medir con Gemini:** las tres corridas de hoy contestó Groq. El arnés hay que correrlo otra vez cuando vuelva la cuota.

## El goteo con APROBACIÓN no espaciaba nada (22/10/2026, AU1 del plan del Cerebro: #289 nace para aprobar)

**Síntoma (sospecha del relevamiento, confirmada leyendo el código):** con una automatización cuyos WhatsApp nacen para
aprobar (#289 «Sprint · apertura»: estrategia null y «Sale sola» en false), el goteo de 5 minutos no frenaba nada. **Causa,
dos puntas:** (1) el goteo contaba sólo los `nutricion_envios` 'enviado', y un borrador no gasta el cupo de la línea, así
que el barrido dejaba los 50 borradores de una; (2) aprobar (`enviarBorradorPorSuCanal`, la única puerta) mandaba en el
acto: aprobar diez seguidos eran diez juntos por la línea personal de Mauricio. **Regla:** para el goteo cuenta lo que
salió Y lo que quedó para aprobar (`cuentaParaElGoteo`, `ESTADOS_DEL_GOTEO`), y aprobar respeta el goteo de su
automatización (`frenoDelGoteoAlAprobar`: lo aprobado en 24 h por su `enviado_at`; si no hay lugar, no sale y dice en
cuántos minutos sí; si no puede leer, no sale). **Cómo se probó:** el caso de 50 inscriptos a la vez en los dos modos, con
la MISMA vuelta del motor (un tick por minuto, lo frenado a su turno como `quedaFrenada`): de a uno cada 5 minutos, los 50
en 4 h 5 min, y con 60, 50 en 24 h. **Vive en:** lib/goteo.ts · lib/nutricion.ts (`usoDelGoteo` y la corrida) ·
lib/borrador-camino.ts · test: tests/goteo-con-aprobacion.test.ts. **Sin hacer:** aprobar no PROGRAMA el envío para su
turno (`wa_borradores` no tiene dónde guardarlo; haría falta una columna): dice cuándo, y hay que volver a tocar.

**Y salía a la MITAD del ritmo (24/10/2026, medido en la primera hora de la campaña de Mauricio).** Con goteo de 11 min, los
M1 salieron a las 13:00, 13:23 y 13:45: cada 22. El freno de la línea y del goteo se miraba sobre CUALQUIER nodo leído
(`sinLugar` en la puerta de `procesarEnvios`) y sólo pasaban las acciones y los emails (`sigueSinCupoWa`). La condición
«Contestó» que sigue a cada M1 quedaba frenada y TOMABA un turno de 11 min sin mandar nada, así que el M1 siguiente salía
en el turno de después: unos 33 por día en vez de los 55 decididos. **La regla:** el goteo espacia MENSAJES; lo que no
manda nada (una condición, una espera, un «Ir a») corre en el acto, y el mensaje al que lleva pasa por el freno en la
segunda mirada, sobre el destino (`noGastaTurnoDeWhatsapp`, lib/goteo.ts). **La trampa para medirlo:** los intervalos
salen bien «más largos que el goteo» (0 por debajo de 11 min), y eso parece cumplir; lo que lo delata es la MEDIANA, de 22.

**Y la espera contaba desde que el motor procesaba la condición, no desde que salió el mensaje (24/10/2026, la tarde).**
Martín, cuando se le dijo que los 33 por día eran «que Mauricio no movió suficientes leads»: «eso sí es un bug, el goteo
debe comenzar a contar desde que se envía el primer mensaje». Medido en `nutricion_inscripciones` de la #289, la otra
cara del mismo defecto: después de M1 vienen «Contestó» y «Esperar 1 día», y la espera calculaba su vencimiento como
`ahora + 1 día` (`resolverControl`, lib/nutricion-grafo-motor.ts), con «ahora» = cuando la condición por fin pasaba. El
goteo le daba turno a la condición, y el horario de la automatización la congelaba de noche. A «186» le salió M1 el 23/10
a las 23:14 (ART); la condición pasó el 24/10 a las 13:57, al abrir el horario y en su turno; M2 quedó para el 25/10 a las
13:57, 14 h 43 min tarde. De las 20 activas, siete tienen M2 entre 12 y 15 horas tarde, y el resto entre 12 y 24 minutos.
**La regla:** una espera «de tiempo» cuenta desde que la inscripción quedó LISTA para seguir —salió el mensaje de antes
(el motor deja lo que sigue con `proximo_envio_at` = la hora del envío) o venció la espera de antes—, no desde que se la
procesa (`relojDeLasEsperas`). El horario cerrado no toca la fila, así que ese reloj sobrevive a la noche. Va junto con
629500245, porque sin él el freno del goteo le reescribe el `proximo_envio_at` a la condición.
**El diagnóstico obvio era otro:** que los BORRADORES consumían el reloj del goteo (`ESTADOS_DEL_GOTEO` cuenta
'borrador'). Medido: la #289 no tiene ni un borrador (25 enviados, 0 borradores), así que no era eso. El reloj que estaba
mal no era el del goteo de los MENSAJES (cuenta bien desde el último enviado), sino el de las ESPERAS. Se encontró
mirando, inscripción por inscripción, cuándo salió M1 contra cuándo quedó agendado M2 (`scripts` de sólo lectura
contra producción), no leyendo el código.
**Lo que ya quedó agendado** (las 20 activas) no se recalcula: el arreglo vale para las esperas que se resuelvan después
del deploy. Test: tests/espera-desde-el-mensaje.test.ts.

**Medido en producción (24/10/2026, 20:50 ART, claude5; scripts/medir-goteo-tras-deploy.mts).** «Contestó» corta: los 4
que contestaron (insc 292, 319, 320, 340) no recibieron ningún mensaje más y están en 'respondio'. El reloj nuevo todavía
no tiene nada propio que mostrar: desde el deploy no salió ningún M1 (Mauricio no movió más leads) y las 20 activas
siguen con lo agendado ANTES (M2 entre 24,19 h y 38,70 h después de M1). **La trampa del script de medición:** la primera
versión leía todo con el cliente de la base PRINCIPAL, encontraba la #289 y su config (`app_settings` y
`nutricion_secuencias` también están ahí) y decía «nada tocado desde el deploy». Era verdad en esa base: las
inscripciones y los envíos del ws1 viven en SU base. Un script que mide un negocio con base propia lee con
`runWithWorkspace(ws)` + `getTenantDb()`, o da un «todo tranquilo» falso (la trampa «k» de arriba, otra vez).
**Lo agendado con el reloj viejo se puede poner donde lo habría puesto el nuevo:** scripts/recalcular-esperas-viejas.mts
(`ultimo_paso_at` + los minutos de la espera, sólo si adelanta, compare-and-set sobre estado, tarjeta y vencimiento;
sin `--aplicar` sólo dice lo que haría). Para la #289 adelanta 13 por ~24 min y 7 por 12 a 15 h. **Sin aplicar:** es
escribir en la base de un cliente real y quedó para que lo decida Martín.
**Y el arreglo, visto andar (22:00 ART):** los tres M2 que salieron después del deploy (21:34, 21:46 y 21:58) dejaron la
espera de 2 días agendada a **48,00 h exactas** del mensaje. Antes daba 48,20. Falta la otra mitad (el ritmo de 11 min de
los M1 y la condición sin turno), que necesita M1 nuevos. El aviso de arreglo al grupo de Mauricio quedó probado en seco
(`avisar-arreglo-al-grupo.mts`, prueba de producción en verde); mandarlo lo frenó el permiso de la sesión.

## Lo de la llamada que seguía a medias, con el arnés contra producción (22/10/2026, AU2 del plan del Cerebro)

Medido por el Cerebro contra 87365c830 (el arnés `probar-chats-automations` @ eee20b3ab) y arreglado con tests que usan la
RESPUESTA DEL MODELO GRABADA (lib/flujo-ia-revision-editar.ts: lo que la ruta hace con cada intento, puro). El modelo de
verdad lo vuelve a medir el arnés cuando hay cuota.

### «Editalos y agregalos» PISABA, y «Hazlo como te lo indiqué» DUPLICABA

**Síntoma:** con dos WhatsApp, «Los textos que te pasé no están en el flujo. Editalos y agregalos:» + dos textos → el modelo
CAMBIÓ los dos mensajes que había (2 de 2). Y el segundo turno, con todo hecho, los agregó OTRA vez (#491) o terminó en «No
cambió nada» (#481). **Causa, tres piezas:** nada distinguía sumar de cambiar; el filtro de copias (`huellas`) sólo corría en
un cambio de canal; y la respuesta honesta «Ya están en el flujo» la rechazaba MI regla de Editar (`errorDeRespuestaEnEditar`:
no era pregunta, ni lugar, ni «no se puede»), así que el reintento duplicaba. **Es la segunda vez en el día que una regla de
Editar bloquea una respuesta buena:** una regla que rechaza respuestas se prueba con las respuestas que SÍ valen. **Regla:**
pedir SUMAR («agrega», «suma», «añade», aunque diga «edítalos») y cambiar el texto de lo que había vuelve al modelo con el
error que lo dice (`pideAgregar`, y la regla en `REGLAS_EDITAR`: las dos capas); un WhatsApp idéntico a uno que ya está,
también (`mensajesCopiados`); y si lo pegado en la charla ya está en el flujo, eso es lo que se contesta (`yaEstaEnElFlujo`).

### La condición «antes del primer mensaje»: el diagnóstico obvio era el equivocado

**Síntoma:** «Antes del primer mensaje, si tiene la etiqueta «Sprint · audio» que siga el flujo; si no, que no le mande nada»
→ el primer mensaje quedaba DOS veces, sin condición (#535). **Lo obvio:** el camino de consulta (`RX_NADA` lee «que no le
mande nada» como «no cambies nada»). **Lo de verdad:** con Editar eso ya no pasaba; el lenguaje de editar NO TENÍA DÓNDE
PONERLA. «despues_de: cron» con el CRON ocupado colgaba EN PARALELO sin aviso; «en el medio» rechazaba una condición (no
termina en una sola punta); una flecha del tramo a una tarjeta que ya existe se cortaba («Una tarjeta seguía en dos
lugares»); y «cambiar» el mensaje a condición no cambia de tipo. **Regla:** desde el CRON con «sig», o con el tramo que ya
sigue en la primera tarjeta, va EN EL MEDIO; el tramo PUEDE seguir en la tarjeta que seguía (`OpcionesArmar.enElMedio`); y
una condición sola sigue por su primera rama. **Vive en:** lib/flujo-ia.ts (`armar`, `agregarTramos`).

### «Si responde, movelo… y avisame por WhatsApp» se iba a OTRAS tabs

**Síntoma:** dos burbujas «ir» (CRM y WhatsApp), y MaKo no hacía nada. **Causa:** la IA de pedidos lo partió en área crm +
área whatsapp, y lo que etiqueta la IA es «fuerte» (lib/mako-pedidos.ts, `decidir`). **Regla:** en Automations, con una
abierta, una orden sobre el flujo («si responde», «cuando entra», «movelo», «avisame», «mandale») es un cambio de lo
abierto (`esOrdenDelFlujo`): la etapa, el CRM y el WhatsApp son ingredientes del flujo.

### Una etapa que no existe se dice ANTES del modelo

«Que arranque cuando el lead entra a la etapa «Clientes VIP Platino»» → el modelo no devolvía nada y salía «No cambió nada».
Con la etapa entre comillas que ese CRM no tiene, MaKo contesta sin llamar al modelo, con las etapas que sí tiene, y el CRON
no se toca (`etapaQueNoExiste`). Sólo entre comillas: un nombre suelto no se sabe dónde termina.

**Vive en:** lib/flujo-ia-revision-editar.ts · lib/flujo-ia.ts · lib/mako-pedidos.ts · app/api/chat-agent/secuencias/ia/route.ts ·
tests: tests/chat-mako-agregar-y-etapa.test.ts, tests/chat-mako-orden-del-flujo.test.ts.

**Sin hacer (AU2):** «reordená» (no es una operación de editar), «deshacé eso» (el modelo no tiene lo borrado), la tarjeta de
audio que el modelo inventa al CREAR; el aviso interno «Una tarjeta seguía en dos lugares» le llega a la persona; «Borrá el
segundo mensaje» deja «1 día» y «2 días» seguidos sin avisar. Y el arnés con IA sobre esta rama: corre cuando vuelve la cuota
de Gemini (~04:00 ART del 23/10).
## «No tienes ninguna IA gratis conectada» era la red de MaKo al tope de hoy (22/10/2026, AU3 del plan del Cerebro)

**Síntoma:** Mauricio (ws1) leyó en el chat de su automatización «No tienes ninguna IA gratis conectada.», con el link a
Gemini. El arnés del Cerebro se cortó con la misma frase. **El diagnóstico obvio era el equivocado:** no faltaba una IA.
El ws1 no tiene keys propias, la red gratis de la plataforma sí corrió y se quedó sin cuota (el 429 por día de Gemini,
`GenerateRequestsPerDayPerProjectPerModel-FreeTier`). **Causa:** `falloDeIA` sólo ve `errores` (las keys DEL NEGOCIO).
Los de la red (`erroresPlataformaOut`) se guardan aparte a propósito, para que un 429 de la agencia no culpe a las keys
del cliente, y nunca llegaban al mensaje. Con la lista vacía y sin keys, la frase era «no tienes IA» (lo encontró el chat
«IA del cliente»). **Regla:** sin keys propias, el mensaje dice qué le pasó a la IA gratis de MaKo («llegó a su tope de
hoy», «está al tope», «está saturada», «no contestó») y la salida es SU Claude (`/integraciones?abrir=anthropic`), que es
lo primero que prueba esta cascada. Con keys propias, la red no cambia nada. Un tope POR DÍA no dice «prueba en un rato».
**Trampa:** «Conecta tu Claude o tu GPT» era el texto pedido, pero OpenAI no está en `PROVS_CREAR_IA` (cobra): una clave
de OpenAI no arma flujos HOY (la cascada de main no usa `PROVS_SU_IA` por su cuenta; lo midió «IA del cliente»). Con el IA6 (lote 2 de IA) sí: entonces `SU_IA` y `SU_CLAVE` (lib/flujo-ia.ts) pasan a «tu Claude o tu GPT», y el test falla hasta que se cambien. **Vive en:**
lib/flujo-ia.ts (`falloDeIA`, `sinIAPropia`) · lib/flujo-ia-crear.ts (`generar` le pasa `erroresRed`) · test:
tests/ia-aviso-sin-ia-propia.test.ts. **Sin hacer:** las otras pantallas que llaman `falloDeIA` (la ficha, los gráficos,
el «preparar» de la API de MaKo) no le pasan su red. Ven el texto nuevo sin la causa: lib/ficha/ia-generar.ts,
lib/graficos-ia-*.ts, lib/api-mako/areas/chatbot.run.ts.

## Un flujo que no depende de la IA: el «Si responde» SIN casos y sin `paso_ia` (22/10/2026, #289 del ws1)

**Por qué:** IA16 apaga la red gratis de la plataforma para los negocios, y el ws1 no tiene IA propia. El AI Step de
«Sprint · apertura» («Que responda: avisarle a Mauricio…») habría dejado de clasificar las respuestas el día de la campaña.
**Lo que se sabe del motor:** un «Si responde» (`nodo: 'respuesta'`) sin `paso_ia` y con `casos: []` manda TODA respuesta
por su `si_no`, que el lienzo rotula «Respondió» (`rotuloSiNoDeRespuesta`). `responderConGrafo` llama igual a
`clasificarEscenario`, pero con la lista vacía vuelve ANTES de llamar a una IA («esta secuencia todavía no tiene casos»).
O sea: «cualquier respuesta → aviso fijo al grupo → etiqueta» corre sin ninguna IA. **Regla:** cuando un flujo de un
cliente no puede depender de la IA (sin key propia, o una campaña con fecha), el «Si responde» va sin casos y lo que sigue
son acciones fijas. Las variables del aviso son `{{nombre_completo}}` y `{{link_chat_lead}}`; `{{lead_escribio}}` es de los
avisos de eventos de MaKo y en un flujo no está garantizada. Para marcar al que respondió sin tocar las etapas que armó el
cliente: una etiqueta sin vínculo a etapa (`poner_etiqueta_lead` no lo mueve). **Vive en:** lib/nutricion.ts
(`responderConGrafo`) · lib/chat-agent-handoff.ts (`clasificarEscenario`) · lib/flujo-grafo.ts (`rotuloSiNoDeRespuesta`).

## Probar un aviso en seco: sin `leadNombre`, el renglón del nombre desaparece (22/10/2026, auditoría de #289)

**Síntoma:** resolviendo el aviso de «Sprint · apertura» con `conVariables(texto, { ws, leadId, destino: 'equipo' })`,
salió sólo «Síguelo a mano desde Chats 👉 …»: el renglón «💬 {{nombre_completo}} respondió…» no estaba. **El
diagnóstico obvio era el equivocado:** el aviso está bien. **Causa:** `{{nombre_completo}}` no sale de la ficha, sale de
`leadNombre` del contexto (`fuente: 'nombre'`, lib/variables-aviso.ts), y `textoConDatos` borra entero un renglón cuyo dato
quedó vacío. La tarjeta real (`textoDelAviso`, lib/api-mako/areas/chatbot.run.ts) sí pasa `leadNombre`, y además le suma
`valoresVariablesLead`. **Regla:** una prueba en seco de un aviso se resuelve como la tarjeta: con `leadNombre` (o con
`textoDelAviso`), nunca con `conVariables` pelado. Lo mismo vale para un lead sin nombre de verdad: ese renglón no sale.

## El chat de MaKo en segundo plano: irse cortaba el pedido, y el resultado de «Editar» no lo guarda la ruta (22/10/2026)

**Síntoma (Martín, mirando #289):** con «Escribiendo · 16 s · hasta 5 min», el desenfoque tapaba también la barra de la
app y no se podía ir a otra tab; y sobre su mensaje decía «No se envió · Reintentar» cuando el mensaje SÍ había llegado y
lo que faltaba era la IA. **Causas:** (1) la capa iba por encima de la barra (z 61, pedido de esa misma mañana); (2) el
lector (`useStreamIA`) cortaba el pedido al desmontar, así que irse a otra tab lo perdía; (3) **la trampa:** en «Editar»
la ruta NO guarda los pasos nuevos: los manda por el stream y el lienzo los pone en SU borrador. Sin la pantalla montada,
el resultado se perdía aunque la ruta terminara (el chat sí lo guarda la ruta). (4) Todo `error` del turno se dibujaba
como «No se envió», también el que contestó la ruta. **Regla:** el turno vive afuera del componente, por automatización
(`TRABAJOS`, app/automations/stream-ia.ts): desmontar no lo corta, volver muestra lo que va (`alAdoptar`), y si termina sin
nadie mirando, quien lo largó guarda el resultado por la MISMA acción del lienzo (`action: 'borrador'` con la base que abrió
y `keepalive`, `guardarSinVer` en SecuenciaPerfil.tsx) y queda avisado para la estrella (lib/mako-trabajos.ts). Guardar el
borrador desde la RUTA no: la pestaña abierta queda con un `visto` viejo y su próximo Publicar rebota «desactualizado».
«No se envió» sólo con `noSalio` (el `fetch` falló antes de la respuesta); si la ruta contestó, lo dice MaKo con su botón.
La capa va debajo de la barra de la app (z 58; el chat, 59). **Vive en:** app/automations/stream-ia.ts ·
app/automations/ChatMako.tsx · app/automations/SecuenciaPerfil.tsx · lib/mako-trabajos.ts · test:
tests/chat-mako-segundo-plano.test.ts. **Sin hacer:** el globito de la estrella lo pinta `MakoEnLaTab` (chat «Ops Center»),
y hoy la estrella sólo está en el CRM; un CRON elegido en una pregunta que termina sin nadie mirando no se guarda
(`crons.guardar` vive en la pantalla); cerrar la pestaña del navegador sí corta el turno.

## «Creó a la mitad»: las ramas según lo que conteste se perdían en el código, no en el modelo (22/10/2026, #289)

**Síntoma (Martín, ws1, «Editar» con el crédito de Claude, Haiku):** pidió un saludo, una pregunta y DOS ramas según lo que
conteste el lead, cada una con su mensaje. MaKo cambió el saludo, agregó la pregunta y las ramas no aparecieron. Abajo, en
naranja: «No agregué otra «Si responde»: ya hay una, sumé un caso», «Saqué 3 tarjetas que no colgaban de nada». **El
diagnóstico obvio era el equivocado:** «Haiku no alcanza». Medido en seco con una secuencia NEUTRA de la misma forma
(scratchpad `medir-editar-ramas.mts`; Haiku 6 veces, Sonnet 3): los dos modelos SÍ mandan las ramas, de tres formas que el
código descartaba: (1) un "si_responde" entero adentro del tramo, como al crear → se tiraba con «sumé un caso» SIN sumar
nada (aun sin ninguna «Si responde») y sus mensajes quedaban colgando de nada; (2) «cambiar» del «Si responde» con casos
nuevos (`sigue` a los mensajes del tramo, a veces con `"cuando": "respuesta_contiene"` o un objeto de palabras) → «se cambian
en el lienzo»; (3) un tramo colgado del «Si responde» por su id, sin `salida: "caso"` → el default «paralelo» lo mandaba a «no
puede abrir otro camino». Sonnet no lo arregla: armó una sola rama y preguntó por el link, en 71-82 s y ~US$ 0,13 por turno
contra ~5 s y US$ 0,008 de Haiku. **Regla:** el código acepta las tres formas (`partirSiResponde`, `casosPedidos` +
`repartirCasosPedidos`, el tramo colgado del «Si responde» es un caso) y nunca dice que hizo algo que no hizo. Y al final de
cada turno de «Editar» hay un CONTROL: los textos que el dueño puso entre comillas (≥ 20 caracteres) que no quedaron en ningún
mensaje (`faltantesDelPedido`). La primera vez es un error para el reintento; si sigue faltando, se aplica lo que hay y se
dice en ROJO (`noHecho`), sin «Listo». Lo que MaKo acomodó solo va en gris y plegado; un turno sin nada afuera arranca con
«✓ Listo» y una línea (`lineaDeListo`). **Trampa:** no cabe ni una línea más en el prompt de editar: el tope de entrada de Groq
(tests/editar-ia-cambiar-quitar.test.ts) la rechaza, por eso el arreglo es de código. **Vive en:** lib/flujo-ia.ts
(`agregarTramos`, `parcheRespuesta`) · lib/flujo-ia-intencion.ts (`faltantesDelPedido`) · app/api/chat-agent/secuencias/ia/route.ts
· app/automations/ChatMako.tsx · test: tests/chat-mako-ramas-y-listo.test.ts (con las respuestas REALES de la medición).
**Sin hacer:** el control sólo mira textos entre comillas (una rama pedida sin comillas no se controla); «crear» no tiene el
control; un link que el dueño escribe y no está en sus links se sigue borrando del mensaje.

## Configuraciones › Anti-ban: renombrar una pestaña es también el prompt de MaKo y su guard de lugares (22/10/2026)

**Pedido (Martín, captura del modal de #289):** «Límites» pasa a llamarse «Anti-ban», cada opción con su interruptor (apagada
no aplica, número gris, sin «Quitar») y fuera todo el texto suelto: cada fila es nombre, número, unidad e interruptor; lo que
hay que explicar va en un ⓘ (app/automations/FilasOpciones.tsx). **Trampa 1:** la pestaña no vive sólo en la pantalla: el
prompt de MaKo le dice al dueño dónde configurar el goteo y los topes (`LO_QUE_NO_ES_TARJETA`, `REGLAS_EDITAR`), los avisos lo
nombran (`AVISO_MISMA_PERSONA`, `frenoAlAprobar` en lib/goteo.ts) y el guard de Editar rechaza una respuesta que nombra un lugar
que no existe (`LUGARES_REALES`). Renombrar sólo la pantalla dejaba a MaKo mandando a «Configuraciones › Límites». **Trampa 2:**
ese guard leía el lugar con `([\p{L}]+)`: «Anti-ban» se leía «Anti» y la respuesta CORRECTA se rechazaba por inventada. Ahora
lleva el guion. **Decisión:** «Misma persona» apagado = 0 h guardado como propio (`PERSONA_SIN_ESPERA`); ausente sigue siendo
la del negocio, así ninguna automatización que ya existía cambia, y el motor no necesita nada (con 0 h la ventana de «ya le
escribimos» es vacía; lo de la misma corrida lo frena `frenadoPorAntiBan`). Los topes de la LÍNEA no se apagan. **Vive en:**
app/automations/ConfigAutomatizacionPanel.tsx (`AntibanDeLaAutomatizacion`) · LimitesEnvioPanel.tsx · ConfiguracionesBoton.tsx
· lib/config-automatizacion.ts · lib/flujo-ia-intencion.ts · test: tests/automations-antiban.test.ts. **Sin hacer:** el
teléfono (/m/automations) no tiene Configuraciones: el anti-ban y el horario de una automatización sólo se cambian en la
computadora.

## «Sólo apertura y un seguimiento si no responde»: el modelo piensa «Si responde» como un paso de la cadena (23/10/2026, #289)

**Síntoma (Martín, ws1, Editar con Haiku):** «solo quiero que la automatización sea de "Apertura", y de última con un
seguimiento si no responden… y cuando alguien responde se corta y le avisa a Mauricio». MaKo puso la espera de 2 días y el
mensaje SIN la condición «no respondió», y no sacó los mensajes de los casos. **El diagnóstico obvio («la regla 3 del prompt
no está») era el equivocado:** la regla ya pedía `contesto` con `no`. Medido en seco (scratchpad `medir-solo-apertura.mts`,
forma de #289 con textos neutros): Haiku piensa «Si responde» como un PASO («si no responde → esperar → seguimiento») y le
cuelga la espera; ahí no hay esperas, el código la tiraba y el seguimiento quedaba como respuesta, o no quedaba. Y con «sólo
X», a veces se llevaba también X. **Regla:** lo que el modelo no cumple lo hace el código: un seguimiento NUEVO que el pedido
nombra lleva «No contestó desde que entró» (`seguimientosConNoContesto`; un «recordatorio» no); un tramo que empieza con una
espera y cuelga de «Si responde» va después del último mensaje; los casos que el turno vació se van; y el control de lo
pedido mira también lo que había que SACAR (y no pide volver a poner lo que pidió sacar: `faltantesDelPedido` lo contaba),
el seguimiento, el aviso cuando responde y que «sólo X» no se lleve X. Tras el arreglo, 8 de 8 corridas. **Trampa:**
`esperaAntesDe` (la ventana de 24 h de Meta) no atravesaba una condición: una espera de 48 h antes de un DM con una
condición en el medio pasaba. **Vive en:** lib/flujo-ia.ts (`seguimientosConNoContesto`, `sinCasosVaciados`,
`agregarTramos`) · lib/flujo-ia-revision-editar.ts (`formaPedida`) · lib/flujo-ia-intencion.ts (`sobrantesDelPedido`,
`pideQueQuedeSolo`) · lib/flujo-conversacion.ts · test: tests/chat-mako-seguimiento-y-solo.test.ts. **Sin hacer:** en 2 de 8
corridas Haiku sacó también la pregunta de la apertura (no hay cómo saber qué es «apertura» sin el modelo); el «sólo X» sin
comillas no se controla más que con «no quitaste nada».

## «Misma persona» retrasa los pasos de la MISMA automatización: dos WhatsApp seguidos salen con 20 h entre uno y otro (23/10/2026)

**Pregunta (Martín, por el Cerebro):** «si "Misma persona" dice 20 h y el flujo tiene un seguimiento o un delay de 2 h, ¿se
rompe la automatización?». **Medido** (tests/automations-misma-persona-pasos.test.ts, con la ventana del motor): NO se rompe,
se RETRASA. A las 2 h el segundo WhatsApp encuentra el primero dentro de la ventana (`leadsConEnvioReciente`: lo enviado con
`created_at >= ahora − 20 h`, y lo de la misma corrida en `enviadoEnCorrida`), queda «saltado: msg <20h», la inscripción sigue
en ese paso y sale en la primera corrida después de las 20 h. **Trampa:** vale también para dos WhatsApp SEGUIDOS sin espera
(el segundo sale 20 h después) y para cualquier espera menor: la tarjeta decía «2 h» y salía a las 20. **Decisión:** el motor
no se toca (frenar a la misma persona ES el anti-ban; sacarlo para los pasos propios haría salir en minutos flujos que hoy
esperan 20 h, en producción); la tarjeta del WhatsApp lo dice («Sale 20 h después del anterior («Misma persona»)»), con el
valor de ESA automatización (`/api/flujos/misma-persona`), que se apaga en su Configuraciones. **Vive en:**
lib/flujo-conversacion.ts (`minutosDesdeElWhatsappAnterior`) · app/automations/FlujoLienzo.tsx ·
app/api/flujos/misma-persona/route.ts. Y la pantalla de Configuraciones pasó a ser UNA (sin pestañas), con «Horario de
oficina» y un bloque por canal; la «Misma persona, por defecto» de la línea ya no tiene fila (cada automatización muestra la del
negocio mientras no tenga la suya). **Sin hacer:** el valor del negocio de «Misma persona» no se edita desde ninguna pantalla
(sólo por la API de límites); el lienzo no relee el valor si se cambia con el modal abierto (al volver a abrir la automatización, sí).

## El seguimiento «si no responde» que pidió el dueño no quedaba: tres causas, y ninguna era el prompt (23/10/2026, arnés del AU2)

**Síntoma:** en el arnés del AU2 (`scripts/probar-chats/automations.mts`, ws3, c08b5e729) `seguimiento-no-contesto` dio rojo en las
dos pasadas y `solo-apertura` en la segunda: MaKo dejaba la espera de 2 días y una condición, y el mensaje del seguimiento no
estaba. **El diagnóstico obvio («el modelo no cumple la regla 3») era el equivocado.** Las causas, medidas en el informe:
1. **La cita se leía como orden.** El pedido era «un seguimiento a los 2 días si no responde: «{Nombre}, ¿pudiste ver lo que te
   mandé? Me avisas»». `pidioAviso` veía «avisas» ADENTRO de la cita; el control de lo pedido le exigía al modelo «falta el aviso
   al grupo» y el reintento ponía un aviso al equipo en vez del seguimiento (pasada 2, tal cual). Lo mismo podía pasar con
   `pidioRespuesta`, el cambio de canal, el CRON, «agregá» y «sólo X». **Regla:** lo que lee la INTENCIÓN del pedido pregunta
   sobre `sinCitas(pedido)`: lo citado (20+ caracteres) es el mensaje para el lead; lo corto entre comillas (una etapa, una
   etiqueta) sí es parte de la orden y se queda.
2. **El modelo lo dejó a medias** (gpt-oss-120b por la red de plataforma): la espera y la condición POSITIVA («Contestó»)
   colgando de una tarjeta que no existía, y el mensaje cortado («Una tarjeta seguía en otra que no existe: lo corté»). El texto
   estaba citado y la espera la decía el pedido. **Regla:** lo que el modelo no cumple lo hace el código — `seguimientoQueFalta`
   arma el tramo en el formato del modelo (espera + mensaje, por `agregarTramos`) y «No contestó» la pone
   `seguimientosConNoContesto`. Sólo con UNA cita faltante, nada del dueño después del último mensaje, y una espera dicha (la del
   modelo o la del pedido): no inventa la espera ni pisa lo que estaba.
3. **El ruteo de «pedidos sueltos» se lo tragó** (pasada 2 de `solo-apertura`): «que la automatización sea de "Apertura"» calzó
   en `referidos` con OTRA automatización cuyo nombre tenía «apertura» (la fila del caso anterior del arnés), salió la burbuja
   «Eso va en «…»» y MaKo no recibió nada. En ws1 alcanza con que exista una automatización con esa palabra en el nombre.
   **Regla:** en Automations, con una abierta, una orden sobre el flujo (`esOrdenDelFlujo`: ahora también «si no responden»,
   «seguimiento», «que la automatización sea…») es de la abierta aunque una cita calce en otro nombre; borrar y «la otra»
   siguen señalando a otra.
**Vive en:** lib/flujo-ia-intencion.ts (`sinCitas`, `citasQueFaltan`, `minutosDelPedido`) · lib/flujo-ia.ts (`seguimientoQueFalta`,
`haySeguimiento`, `protegidasPorElPedido`, `pidioAviso`, `pidioRespuesta`, `cambioDeCanal`, `pideCron`) ·
lib/flujo-ia-revision-editar.ts (`formaPedida`, `pideAgregar`) · lib/mako-pedidos.ts (`decidir`, `esOrdenDelFlujo`) · test:
tests/chat-mako-seguimiento-citas.test.ts (9 roturas → 9 rojos).
**La segunda vuelta (el arnés, ws3, gpt-oss-120b, dos pasadas):** `seguimiento-no-contesto` pasó 2 de 2 (antes 0 de 2) y
`solo-apertura` ya llega a MaKo. Quedaban dos fallas del modelo, con su arreglo en código:
4. **«Sólo X» se llevaba lo que el mismo pedido pide tener**: quitó el «Si responde» con su aviso al grupo, que el pedido pedía
   («le avisa a Ana por el grupo»). Ahora, si el pedido pide el aviso cuando el lead responde (y no pide sacarlo), el «Si
   responde» y los avisos de abajo no entran en "quitar" (`protegidasPorElPedido`); los mensajes de los casos sí se van.
5. **Sin una espera dicha, el código no armaba el seguimiento** («un seguimiento si no responden»). Ahora toma las 20 h de la
   regla 3 del prompt, la misma que sigue el modelo, y el aviso lo dice para cambiarla (`AVISO_SEGUIMIENTO_A_20`).
**Trampa:** una condición VACÍA que deja el modelo no llega nunca a la cola del último mensaje: el saneo la saca antes (medido).
Código que la contemple ahí es código muerto.
**La tercera vuelta (sha c8c219cd8):** `solo-apertura` pasó; `seguimiento-no-contesto` pasó 1 de 2. En la otra, el modelo
puso él mismo la condición, pero la equivocada: «Nunca te escribió» (`respondio`, «jamás te escribió, en ningún lado»). Con
esa condición, un lead que entró escribiéndote no recibe nunca el seguimiento. Además, con una condición ya puesta, el
código no ponía la suya. Ahora, en una condición NUEVA entre la espera del seguimiento y el mensaje, las filas de respuesta
(`respondio` y `contesto` positiva) pasan a «No contestó desde que entró», y el resto de las filas se queda.
`AVISO_SEGUIMIENTO_CAMBIADA` lo dice. **Sin hacer:** volver a correr el arnés sobre este commit.
**Sin hacer:** al CREAR (`deIA`) el código todavía no arma el seguimiento que falta (sólo le pone «No contestó» al que haya);
con dos citas faltantes no se sabe cuál es el seguimiento y queda el rojo; si el negocio no tenía «Si responde» con aviso, el
código no lo crea (lo pide el control, y en rojo).

## El chat de MaKo de Automations con el hilo y la caja únicos: las piezas traen CSS, el lienzo lo dibujan los tests (23/10/2026, AU4)

**Pedido (Martín, por el Cerebro):** la estrella de MaKo como criatura, aire bajo la caja, el «+» para adjuntar, y el chat en
CajaChat + HiloMako. **Trampa:** las piezas únicas importan su CSS y Node no lo carga; ChatMako.tsx lo importan
SecuenciaPerfil y la galería, que ~90 archivos de test dibujan bajo tsx. Importarlas directo rompía todos. **Regla:** la vista
(ChatMakoVista.tsx) entra con `next/dynamic` (el molde del agente del Web Generator) y ChatMako arma lo que le pasa
(`hiloUnico`, exportada: los tests miran lo de cada globo sin dibujar las piezas; el test que sí las dibuja registra el hook
que vacía los `.css`, como tests/ops-center-caja-angosta.test.ts). **Trampa 2:** el hilo del Ops Center calcula su margen
lateral con el ANCHO DE LA VENTANA (`clamp(16px, 4vw, 56px)`): en la sidebar del lienzo (~380 px) dejaba ~270 al globo; la
vista lo fija para la columna angosta. **El «+»:** la cascada de Automations lee texto, así que cada archivo se lee al
adjuntarlo con la ruta que ya existía (`/api/chat-agent/secuencias/archivo`, `archivoATexto`: PDF, docx, imagen por visión con
las keys del negocio) y viaja aparte del pedido (lib/chat-adjuntos-automatizacion.ts): el control de lo pedido sigue mirando
sólo lo escrito. **Vive en:** app/automations/ChatMako.tsx · ChatMakoVista.tsx · app/api/chat-agent/secuencias/ia/route.ts ·
test: tests/chat-mako-caja-unica.test.ts. **Sin hacer:** un archivo que es CONTENIDO del flujo («mandales este PDF») se lee
como instrucciones en el chat (la galería ya lo sube a la biblioteca: `usoDelArchivo`); la «Pídeselo a MaKo» de la galería
(CajaPedido) sigue con su caja.

## Dejar armado un flujo en un negocio SIN línea conectada (23/10/2026)

Las automatizaciones de venta de MaKo en el ws9 (#568 «Venta MaKo · apertura», #569 «Venta MaKo · conversación
abierta»), pausadas, con la línea del ws9 sin QR:
- **Publicar desde el lienzo pide la línea** (`medioSinConectar` en la ruta). `setSecuenciaPasos` no la pide y no toca
  `activa`: es la vía para dejar un flujo armado y pausado en un negocio que todavía no conectó WhatsApp. Activar sí
  vuelve a pasar por `validarActivacion`.
- **Las piezas de la galería no se exportan** (`whatsapp()`, `condicion()`, `esperar()` en
  lib/plantillas-automatizaciones.ts): un script copia su forma exacta (`RELLENO` + campos) y valida con
  `validarGrafo` + `frenoDelFlujo` + `problemasDeForma` antes de escribir. Las dos pasaron sin nada.
- **Lo que frena es la PAUSA, no la aprobación por mensaje.** Nacieron con `revisar: true` (para aprobar) y el mismo
  día se sacó: Martín, 23/10, «si estoy haciendo una AUTOMATIZACIÓN es OBVIO que debe llegar sola». Quedan pausadas,
  con cada WhatsApp que sale solo (`saleSolaDelPaso`), «Misma persona» apagado en cada una (las 20 h del negocio
  retrasaban un seguimiento corto) y goteo de la apertura en 5 min / 40 por día.
- **El orden importa al activar:** «Traer de un grupo de WhatsApp» no ofrece una etapa de la que cuelga una
  automatización ACTIVA (`etapasQueDisparan`). Con #568 activa, TIBIO deja de ofrecerse: primero se traen los grupos,
  después se activa.

**Sin hacer:** activarlas es de Martín, después de vincular su WhatsApp al ws9 y de traer los grupos.

## «No salió ni a mí ni a mi esposa»: SÍ se inscribieron; el motor cortó por el horario y no lo dijo en ningún lado (23/10/2026, P0 de #289)

**Síntoma.** Martín probó en vivo la #289 de Mauricio (ws1) con su lead y el de su esposa: los movió a «Prospección activa»
y no les llegó nada. «No funcionó».

**El diagnóstico obvio era el equivocado.** «No se enrolaron: entran por el barrido de la hora» (lo que este documento
anotaba de los agregados). Medido en producción: se inscribieron **por evento en 8 s** (#291 y #292, `paso_actual` 0,
`proximo_envio_at` = ya). La vía rápida corrió y `procesarEnvios` devolvió `saltado: 'fuera-de-horario'`: la #289 usa el
horario del negocio, 9 a 21 en **America/Tijuana**, y lo probaron a las 21:47 de allá (01:47 en Argentina). Descartado con
dato: la línea conectada, el envío prendido, los topes en 0, «Misma persona» apagada, «Nunca le escribiste» pasa, los
teléfonos bien.

**La causa de verdad: el silencio.** Un corte por horario no deja NADA: ni un `nutricion_envios`, ni un aviso, ni una
línea en el lead. La ficha decía «Lo próximo sale 22 oct, 21:47» (una hora pasada, en la hora del navegador). Cualquier
freno que no escribe es un «no funciona». ⚠️ Y una trampa al medir: `nutricion_inscripciones` NO tiene `created_at` (es
`inscripto_at`); un `.order('created_at')` devuelve `data: null` sin tirar, y el primer conteo dio «0 inscripciones».

**La regla que queda.** Si algo frena un envío, el lead y la tarjeta lo DICEN, con las mismas reglas que el motor
(`lib/por-que-no-sale.ts`, puro; lo del negocio en `lib/por-que-no-sale-db.ts`): el chip y la ficha del CRM, una línea en
el historial al inscribirse («Entró a «X». No salió: fuera del horario de oficina (9 a 21, hora de Tijuana). Sale mañana
9:00.», `anotarLaEntrada`), y la tarjeta del lienzo («2 esperando · Abre mañana 9:00», `/api/flujos/en-cola`). Lo
permanente va ANTES que el horario (el envío apagado, sin línea): decir «Sale 9:00» cuando igual no va a salir es mentir.
Un **fallo no avanza el paso**: el motor lo reprograma, la fila deja de estar vencida y sin mirarlo se volvía a callar
(lo encontró el arnés): el fallo se dice también con su reintento.

**El arnés de punta a punta** (`scripts/arnes-automatizacion-punta-a-punta.mts`, ws3): mueve un agregado y un lead de casa
con las funciones del tablero y compara lo que la pantalla DICE con lo que el motor HACE (horario cerrado, fallo de
línea, simulado, envío apagado). El ws3 no tiene número vinculado y los teléfonos no existen: no sale nada. «Activar»
exige un WhatsApp conectado, así que el arnés activa con la misma escritura sin esa guarda.

**Lo que quedó SIN hacer.**
- Agregar EN LOTE a un CRM (`agregarLoteAProducto`, lib/lead-funnel.ts) no inscribe por evento: 300 de una vez serían 300
  vías rápidas. Lo levanta el barrido de la hora. Hoy ninguna automatización del Sprint cuelga de «Lead entrante».
- Una fila de `lead_funnel` creada Y movida dentro de los 10 min del alta del lead cuenta como «parte del alta» y no entra
  ni por evento ni por barrido (`filaNacidaConElLead`, lib/nutricion-ambito.ts): crear un lead de prueba y moverlo al
  minuto en un CRM agregado no lo inscribe. El arnés usa un lead con alta vieja, como los 300.
- La inscripción MANUAL (`inscribirEnSecuencia`) no anota la entrada en el historial: sólo el evento.

## «¿Contestó corta de verdad?»: NO cortaba, y la rama «Contestó» no corría nunca (23/10/2026, P0 de #289)

**Síntoma (medido en el ws3, scripts/arnes-contesto-corta.mts, la forma de #289 con textos neutros).** «M1 → Contestó?
(sí → aviso) / no → esperar 1 día → M2». El lead contesta durante la espera: le salía IGUAL M2, y lo de «Contestó» no
salía nunca. Martín, en la llamada (min 49): «¿Contestó corta de verdad?».

**Por qué.** La condición corre segundos después de M1, cuando nadie pudo contestar, y M2 cuelga de la ESPERA, no de la
condición. Y desde el 14/10 contestar no corta nada por su cuenta: sólo la condición visible.

**El diagnóstico obvio llevaba a un arreglo peligroso.** El primero fue «volver a mirar la condición de arriba cruzando las
esperas» (y de paso se descubrió que esa segunda mirada era código muerto: `necesitaHechos` sólo miraba hacia ADELANTE y
una fila parada en un mensaje nunca cargaba los hechos). La revisión adversarial le encontró 7 riesgos: el aviso dos veces
con hilos en paralelo, condiciones que cambian por la espera misma («Llegó hace menos de N h»), las 13 plantillas, «Ir a».
Se descartó entero.

**La regla que quedó (por el Cerebro).** En una automatización que USA «Contestó» (`usaContesto`), la respuesta del lead lo
saca de ella EN EL ACTO: `pausarPorRespuesta` → `alContestar` lleva la fila a la rama «Contestó» (`destinoAlContestar`:
hacia arriba desde donde está, y si no, hacia adelante), que corre ya por la vía rápida; sin esa rama, la cierra. Y la
guarda de `procesarEnvios`: a quien contestó no le sale ningún MENSAJE más de esa automatización (las acciones sí). No toca
las que no usan «Contestó», las que tienen «Si responde», las filas con hilos ni el carril. «Contestó desde que entró» pasó
a «Contestó» / «No contestó». El arnés: contesta antes de M1, durante la espera de 1 día, durante la de 2 días, y uno que no
contesta (le sale todo).

**Lo que cambió la revisión adversarial (las trampas).** (1) Cerrar con `estado: 'completada'` directo se salteaba
`estadoAlEscribir`: el desenlace la daba por FALLIDA (`no_responde`, la etapa de fallo y su automatización: más mensajes a
quien SÍ contestó). Sin rama «Contestó» la fila queda en 'respondio' sin próximo envío. (2) «No contestó → M2 / si no →
aviso»: el aviso es el «si no», y se perdía. (3) Lo dibujado DENTRO de la rama «Contestó» sale (`ramaDeQuienContesto`). (4)
Quien le escribió al negocio antes de que le saliera algo de esa automatización no se corta: le sale su primer mensaje y
después «Contestó» lo ve (`yaLeSalioAlgo`).

**Lo que quedó SIN hacer.** Una fila con hilos en paralelo no salta a la rama (la guarda igual le corta los mensajes). Una
fila que junta «Contestó» con otra cosa («Contestó y sigue en la etapa») no salta: lo decide la condición. «Probar»
(lib/simulador-grafo.ts) todavía no imita el corte. Un DM de Instagram también cuenta como respuesta para los flujos de
WhatsApp que usan «Contestó». Un «N antes de la reunión» que va en el MISMO camino se corta con él.

**Y un agujero que vio la campaña real (24/10/2026, la #289 en el ws1, medido con `medir-289.mts`, sin versionar, en `C:/dev/wt-aut-sab24/scripts/_sab24/`).** Quien
contesta MIENTRAS le está saliendo el mensaje se pierde el corte. M1 son 3 partes con pausas de 5 s: ~20 s desde la
primera parte hasta la fila del envío. El #2502 contestó a los 5 s de la primera parte. `pausarPorRespuesta` lo puso en
'respondio', y `alContestar` no lo tocó porque todavía no le había salido nada (`yaLeSalioAlgo` busca la fila del envío,
que no existía). Al terminar, el avance escribió con `escribir` en modo 'fila': ese modo no compara el estado y pone el
LEÍDO al empezar la corrida (`conEstadoDeLaFila`), así que volvió a 'activa' (lib/nutricion.ts, `escribir` y el avance
después de mandar). Quedó 'activa', sin aviso al equipo y con M2 programado. **Lo que esconde:** lo que contestó era la
bienvenida automática de su WhatsApp Business. Esas llegan a los segundos, dentro de esa ventana, así que HOY el agujero
hace que casi ninguna cuente como «Contestó». Una que llega a los 30 s sí cuenta: incoherente. Arreglar sólo la carrera
haría que todas cuenten (aviso al equipo y sin M2). Por eso el arreglo va junto con la decisión de qué es una respuesta
automática. **Medido de paso:** con un goteo de 11 min salen cada ~12. El turno se cuenta desde el `created_at` de la
fila, que se escribe después de las partes, y el tick corre una vez por minuto. La condición «Contestó» también espera su
turno de goteo (es un nodo con canal WhatsApp: `sinLugar`), así que M2 sale 24 h después de evaluarla, no de M1.

**Lo hecho (24/10/2026, el Cerebro: las dos cosas en el mismo cambio; y tres revisores encima).** (1) La carrera: el
avance después de mandar es `avanzarTrasMandar` (lib/nutricion.ts), compare-and-set contra lo LEÍDO (estado, paso y nodo).
Si no entra, relee y decide `reconciliarAvance` (lib/nutricion-grafo-motor.ts, puro): misma posición y 'activa' →
'respondio' = contestó mientras salía, el avance va igual CONSERVANDO 'respondio' y corre `alContestar` (ahora sí le salió
algo: la rama «Contestó» y su línea en la ficha); otra escritura la movió (`alContestar`, una retoma, otra corrida), la
cerró, o `alContestar` ya la sacó (misma posición sin próximo envío) = no se pisa. Con hilos, `escribirHilos` con
`trasMandar`, y en la PRIMERA conversión a hilos con la misma regla del cursor (sin eso revivía la que «Contestó» había
sacado). (2) El reclamo antes de mandar (`reclamarAntesDeMandar`): un compare-and-set de `updated_at` contra lo leído,
después de las guardas que no mandan y antes del turno del residuo. Si la fila cambió, el mensaje no sale y vuelve a la
cola. Cerró uno PREEXISTENTE: a quien contestaba mientras el motor recorría el lote (minutos, en la apertura de las 9) le
salía el mensaje que seguía, porque la guarda «Contestó corta» y la condición de arriba miraban el estado del lote. (3) La
respuesta automática: `esRespuestaAutomatica` (lib/respuesta-automatica.ts, pura) y su lectura donde entra el mensaje
(`esRespuestaAutomaticaDelEntrante`, lib/evolution-mensajes.ts). Un entrante a 15 s o menos (`UMBRAL_RESPUESTA_AUTOMATICA_MS`)
de la PRIMERA parte del PRIMER WhatsApp de una inscripción (en esta pasada: desde `inscripto_at`) no llama a
`pausarPorRespuesta` para ninguna automatización del lead (ni «Contestó», ni AI Step, ni borrador, ni avisos); el mensaje se
guarda y la ficha dice «Su mensaje llegó a los N s del primer mensaje de «X»: tan rápido se toma como la respuesta
automática de su WhatsApp y no cuenta como respuesta.» (una LECTURA por la hora, no un hecho). La ráfaga es de una
inscripción sólo con SU fila del envío (o su borrador aprobado); si el motor la reclamó y la fila todavía no está, el
lector la ESPERA (hasta `FILA_DEL_ENVIO_TRAS_LA_PRIMERA_MAX_MS`, 85 s) y vuelve a decidir. ⚠️ **Esa espera NO va en el
camino sincrónico del webhook** (revisión a mano del 24/10): el 1-a-1 se guarda sincrónico, y esperar ahí dejaba la línea
sin contestarle a Evolution ~20 s por cada bienvenida automática, que en una campaña a dueños de negocio pasa seguido. El
webhook pregunta con `sinEsperar` y, si hay que esperar, decide después de contestar (`after`, re-entrando al negocio con
`runWithWorkspace`). No es automática si el lead
nos escribió en los 14 días de antes (sin actividad no hay bienvenida; con actividad es una charla). Se miran también las
'completada' sin desenlace (la «Bienvenida» de un solo mensaje ya se cerró cuando llega la bienvenida). Sólo el no oficial:
el oficial no tiene entrante ni manda desde el 09/10, y por Instagram/Messenger el motor nunca escribe primero. Probado en
el ws3 (el arnés, casos E, E2, F, F2, G y H): con el avance de vuelta en 'fila', E da exactamente el #2502; sin el
reclamo, G recibe M2; sin la espera, F2 cuenta; sin «ya hablaban», H se come. A #2502 no se lo tocó.

**Medido (24/10/2026, sólo lectura, todos los ws, 45 días).** 30 primeros WhatsApp de una inscripción, todos en el ws1. Un
solo entrante a menos de 60 s de la primera parte: la bienvenida del #2502 (inscripción 327), a los 4,4 s, 199 caracteres
(«Gracias por comunicarte con…»), y ese lead no había escrito antes. Ninguna persona. La fila del envío, a los 19 s de la
primera parte (mediana) y 24 como máximo. **El umbral sale de UN dato**: una persona que contesta en 15 s o menos al primer
mensaje no cuenta, y una automática que llega después de los 15 s (con mala señal) sí. Re-medirlo: por cada primer
`nutricion_envios` 'enviado' de WhatsApp de una inscripción, la primera parte en el espejo (caminando hacia atrás con
`HUECO_ENTRE_PARTES_MS`) y los entrantes reales (sin 'evento' ni 'otro') hasta 60 s después, POR ws con `runWithWorkspace`.

**Las trampas.** (a) La hora de la primera parte NO está en `nutricion_envios`: esa fila se escribe después de la ÚLTIMA
parte. Sale del espejo (`wa_mensajes` con `from_me`, lo que escribe `enviarYEspejar` por parte), y la primera se encuentra
caminando hacia atrás desde el entrante: medir desde la última daría por automática a una persona que contestó a los 16 s.
El hueco entre dos partes no es sólo la pausa: el espejo se escribe cuando Evolution VUELVE, después del «escribiendo…» de
hasta 11 s (`enviarTexto`, lib/evolution.ts), así que dos partes quedan hasta ~22 s una de otra (`HUECO_ENTRE_PARTES_MS` =
25 s; con 15 s se partían en dos mensajes). (b) **«Vencida y sin envíos» NO es «se la está mandando»** (el diagnóstico
obvio, y el de la primera versión). Una vencida sin mandar dura horas o días: pausada (`idsDePausadas` la saca de la cola
y la fila sigue 'activa'), cerrada por su horario, con el cupo lleno, o frenada por el anti-ban de la corrida PORQUE otra
automatización le acaba de escribir: es el propio freno el que hace que coincidan. Así se tragaba la respuesta de una
persona al M3 de otra automatización o a un mensaje desde Chats. Y `updated_at` tampoco prueba nada (lo escribe cualquier
escritura: una condición que la movió, la reactivación de una pausada): el reclamo sólo dice cuándo vale la pena esperar
la fila. (c) **En asistido la fila del envío miente la hora**: `anotarPasoEnviado` (lib/evolution-envio.ts) le cambia el
estado a 'enviado' y deja el `created_at` del borrador, de horas antes de que alguien lo apruebe; la de salida es
`wa_borradores.enviado_at` (`horasDeSalida`). (d) Sólo cuentan los envíos de WhatsApp: un email de antes no impide la
bienvenida del primer WhatsApp. (e) La ventana de la carrera no es lo que tardan las partes: el lote se lee UNA vez y se
recorre en serie mandando, así que arranca cuando se leyó el lote. (f) Con hilos el bug era OTRO: `escribirHilos` sí
comparaba el estado, pero al perder devolvía false y el avance se PERDÍA: el hilo quedaba parado en el mensaje que ya
salió. (g) El 'fila' también revivía a 'activa' una inscripción cancelada desde la ficha mientras salía el mensaje: el
compare-and-set lo cierra de paso. (h) `alContestar` llamado desde el motor va sin la vía rápida (`sinViaRapida`): esa
corrida ya tiene el turno; la fila vuelve a la cola y la rama corre en la vuelta siguiente. (i) Tres relojes: el entrante
trae la hora de WhatsApp en segundos truncados, el espejo y el reclamo la del servidor, la fila del envío la de la base
(1 s de holgura; en la notebook la base va 0,3 s atrás). (j) **El arnés del ws3 corre CONTRA EL TICK DE PRODUCCIÓN**, que
también mira el ws3 cada minuto y SIN simular: si agarraba la fila entre `vence` y la corrida del arnés la mandaba 24 h
adelante («canal apagado»), y E salió rojo una vez de tres. Parecía un bug del reclamo; era el reclamo haciendo su trabajo
(antes la corrida del arnés mandaba igual con la fila vieja). El arnés ahora corre con el turno del motor del ws3
(`conTurnoDelMotor`). Y en una corrida simulada la fila del envío se escribe en milisegundos: para pasar por la espera, el
`durante` de F2 tiene que demorar al motor. (k) Para medir en producción, `getSupabaseServer()` NO ve las filas de un ws
con base propia (el ws1 tiene la suya: otros ids); cada ws, con `runWithWorkspace` y `getTenantDb`. (l) El arnés estaba
roto desde el 23/10: `guardarConfigAutomatizacion` rechaza `personaHoras` («Misma persona» se fue); se sacó ese paso.

**Sin hacer.** Los demás `escribir(..., { modo: 'fila' })` que ponen `estado` (los cierres sin mandar: la reunión ya pasó,
el residuo, el tope de antigüedad, la tarjeta borrada, el email apagado, el fallo terminal; lib/nutricion.ts) siguen sin
comparar: pueden pisar un 'respondio' que llegue entre la lectura del lote y el cierre; sin un mensaje de por medio no le
cortan nada a nadie. Un borrador aprobado de audio con pie, o de archivo, está en 'enviando' (sin hora) mientras sale el
pie: la bienvenida que llega en ese rato cuenta. Un paso con IA que tarda más de 60 s entre el reclamo y la primera parte
pierde el filtro (cuenta). Con la espera en `after`, un entrante que llega mientras se decide el anterior puede
procesarse antes que él (orden distinto, mismo resultado). Un «ausente» de quien nos escribió en los 14 días
cuenta como respuesta; la regla de los 14 días es la que publica WhatsApp, no medida, y no mira nuestros salientes. Sin la
fila del espejo (Evolution no devolvió el id y el eco no llegó) cuenta como respuesta. «Probar» (lib/simulador-grafo.ts)
no imita ni la carrera, ni el reclamo, ni la automática.

## «Sale sola» y la reentrada se fueron de la tarjeta de WhatsApp (23/10/2026)

**Medido antes de sacarlo.** El primer mensaje de #289 salía solo (`revisar: false`): no fue el P0. Pero el SEGUNDO no
tenía el interruptor y heredaba `estrategia.envio_automatico` (nace apagado): habría quedado de BORRADOR. Activas con algo
que quedaba para aprobar: #289 (ws1) y #282 (ws11, dos mensajes). 43 borradores de automatizaciones pendientes ese día.

**La regla.** Sacar el interruptor sin cambiar el motor era volver al borrador escondido del 09/10 (los 31 de Leila). Por
eso cambió `saleSolo`: un mensaje de una automatización SALE; sólo lo que escribe la IA (`tipo: 'ia'`) sigue con su
`revisar`. La reentrada («Una sola vez / otra vez que es reunión») no se elige más en pantalla: el motor sigue con la
`reentrada_efectiva`; lo de volver a escribirle se dice con condiciones.

**Lo retenido no se saltea (medido antes del deploy).** #282 del ws11 (activa) tenía 31 borradores esperando aprobación
desde el 20/10 y 29 inscripciones paradas en su SEGUNDO WhatsApp, esperando por eso. Con `saleSolo` a secas, el segundo
mensaje habría salido de golpe a quien no recibió el primero. Regla: si el lead tiene un borrador pendiente, lo que sigue
espera (como hasta hoy); el borrador sale cuando alguien lo aprueba, o se descarta. Lo nuevo sale solo.
---

## El ws13 lleva DIEZ DÍAS sin avisarle al equipo de un solo lead nuevo, y el diagnóstico obvio es el equivocado (23/10/2026)

**Síntoma:** nada. Ninguna pantalla lo dice, ningún aviso sale, el cron termina con éxito. Se encontró de
rebote, verificando otra cosa (que dos leads del ws1 esperaran la apertura de su horario).

**Lo medido, contra producción, el 23/10 a las 10:00 ART:**

- **20 envíos consecutivos en `fallo`, TODOS del ws13** (Código Inmobiliario, un cliente real), desde el
  **13/10/2026 08:18** hasta el **22/10 23:09**, con el mismo texto:
  `No se pudo registrar la acción pendiente.` Cero fallos de esta familia en los otros nueve workspaces.
- Afecta a **dos** secuencias distintas —la #241 hasta el 20/10 y la #264 desde el 20/10—, y lo que comparten
  es el paso con `operacion: 'avisar_al_equipo'`.
- El efecto en el cliente: cada lead nuevo del ws13 se inscribe, el paso del aviso falla, y la inscripción
  queda **`completada` en el paso 1**. O sea el flujo no reintenta, no deja pendiente, y el equipo no se
  entera de ningún lead. Los últimos: Stefanie Ambrois (#3098), Fernando Gomez (#3096), Malena Piaggio
  (#3091), Pablo Rodriguez (#2771), Marcela Fernandez (#2762), Eugenia (#2761)…

**El diagnóstico obvio —«el INSERT de la pendiente está fallando»— es FALSO, y se descartó por tres
caminos distintos:**

| Cómo se probó | Resultado |
|---|---|
| SQL directo (driver `postgres`) en una transacción con ROLLBACK | el insert entra (id 377) |
| El MISMO camino del código: `runWithWorkspace(13)` + `getTenantDb()` + PostgREST | entra (id 378), se borró |
| Idem, con el **payload exacto** del paso de la secuencia #264 (448 caracteres, emojis, un surrogate suelto) | entra (id 379), se borró |

Y el esquema no tiene nada que lo explique: `mako_acciones_pendientes` no tiene un solo CHECK, ni índice
único además del pkey, ni trigger; sus NOT NULL son `id, workspace_id, grupo_jid, tipo, payload, resumen,
estado, vence_at, created_at` y la tabla **sí** está en `TENANT_TABLES`, así que `getTenantDb` le pone el
`workspace_id`.

**Dónde vive el único lugar que puede devolver ese texto:** `proponerChat` (`lib/api-mako/acciones.ts:95`)
lo devuelve cuando `crearPendiente` (`lib/mako-pendientes.ts:41`) contesta `null`, y esa función sólo
contesta `null` en el `if (error)` del insert. O sea: el insert falla en producción, el motivo sólo existe
en un `console.error('[pendientes] crear:', …)` —los logs de Vercel, que nadie lee y que a los 60 minutos
no existen— y desde acá no se reproduce.

⚠️ **LA CAUSA, medida por Automations el mismo día: MEDIO EMOJI.** `avisar_al_equipo` arma el resumen de
la pendiente con `mensaje.slice(0, 120)`. En las secuencias #241 y #264 ese texto mide 184 unidades y la
**unidad 119 es U+D83D**, la primera mitad del par que forma el emoji del dardo. Cortar ahí deja un
surrogate SUELTO, `JSON.stringify` lo manda escapado, y Postgres rechaza el insert ENTERO con «invalid
input syntax for type json». Sólo el ws13 lo tenía, porque sólo su texto lleva un emoji justo en el 120.

Y explica por qué las tres pruebas de arriba entraron: **el payload viaja entero; el que se corta es el
RESUMEN.** La tercera medición llegó a imprimir «tiene surrogate suelto: true» sobre ese payload y se dejó
pasar — ahí el par estaba completo. **Un `slice` sobre texto con emojis no corta caracteres: corta
unidades UTF-16**, y la mitad de un par es JSON inválido aunque el original fuera perfecto. Lo cubren
`cortarSinPartir` y el saneo de lo que `crearPendiente` inserta (había otros 7 resúmenes con `slice` en
los runners).

⚠️ **Y la vuelta de tuerca, que costó el documento entero: este archivo se volvió ilegible para Python por
lo mismo.** Al escribir el párrafo de arriba con un script, `io.open(p, encoding='utf-8')` falló con
«surrogates not allowed» —el documento ya traía un surrogate suelto adentro— y para entonces el
`io.open(p, 'w')` **ya había truncado el archivo a 0 bytes**. El script reportó el error y aun así dejó
385 KB de hallazgos en la nada; se recuperó con `git checkout HEAD -- <ruta>` porque estaba commiteado
media hora antes. Dos reglas, y la segunda es la que salva:

- **Un script que toca un fuente con emojis va con `errors='surrogatepass'`** en la lectura y en la
  escritura, o se niega a guardar justo el documento que explica el bug.
- **Y NUNCA abre el destino en `'w'`: escribe a un temporal y renombra.** `open(dest, 'w')` trunca ANTES
  de saber si lo que sigue va a fallar, así que cualquier excepción posterior deja el archivo vacío. Es la
  misma forma que «un reescritor de código fuente reporta éxito sobre un archivo roto», con el signo
  cambiado: acá reportó el fallo correctamente y el daño ya estaba hecho.

**La regla que queda, y es la que hubiera ahorrado los diez días:** un `console.error` no es un control
(ya está en AGENTS.md) y acá se paga en su forma más cara — **el fallo que mata un flujo guarda SU MOTIVO
en la fila que ya está escribiendo**. `nutricion_envios.error` recibió la frase genérica del proponedor en
vez del `error.message` de Postgres, que es el único dato que distingue las cinco causas posibles. Un
error de un tercero (o de la base) se propaga ENTERO hasta la fila que alguien va a poder leer después.

**Lo que quedaba SIN hacer**, y le tocaba al chat de Automations:
1. ~~Hacer que `crearPendiente` devuelva el motivo (no `null`) y que `proponerChat` lo escriba en el envío.~~
   HECHO en 0a5f6c9b6 (en producción desde el 23/10 12:20:34 ART). La causa era medio emoji: docs/hallazgos-api-mako.md.
2. ~~Que un fallo del paso de aviso **no cierre la inscripción**.~~ HECHO en 0a5f6c9b6: vuelve a su paso y reintenta a 1 h,
   6 h y 24 h.
3. Reparar el ws13. El arreglo está; los dos mensajes al grupo (el aviso y la lista de los 19 sin aviso, no 6 ni 10)
   esperan a que un lead nuevo avise bien. La cuenta, en docs/hallazgos-api-mako.md. Y revisar la secuencia #264,
   que quedó con un único paso `nodo: 'mensaje'` con una `accion` adentro, **sin nodo `inicio`**, y con el
   token `{{mensaje_mako}}` en su hermana #240 — justo el que `problemasDeTokens` prohíbe publicar.

**Vive en:** `lib/mako-pendientes.ts` (`crearPendiente`) · `lib/api-mako/acciones.ts:95` (`proponerChat`) ·
`lib/api-mako/areas/chatbot.run.ts` (`avisar_al_equipo`) · `nutricion_envios.error`

---

## «MaKo no les escribió a sus leads»: eran avisos al equipo y borradores por aprobar (30/10/2026, ws13)

**Síntoma.** Código Inmobiliario: 21 fallos del 13 al 23/10 y 10 borradores de IA sin salir. Leído como «diez días creyendo que
MaKo les escribía a sus leads».
**El diagnóstico obvio era el equivocado.** Ninguno de los 21 era un mensaje a un lead: eran el paso `avisar_al_equipo`
(`estado='fallo'` no dice a quién iba; hay que leer `accion.operacion` del paso, en `$[*].accion`, no en `$[*].operacion`). La
causa ya estaba arreglada desde el 23/10 (`0a5f6c9b6`, docs/hallazgos-api-mako.md): desde el 24/10, 11 bien y 0 fallos. Los
borradores no son una falla: IA por WhatsApp no oficial, a un lead que no pagó, sin «sale sola», queda para aprobar
(lib/mensajes-por-aprobar.ts). Lo nuestro fue que la pantalla no lo decía hasta el 20/10.
**Antes de decir «se perdió un lead», medir qué le pasó.** De los 21, 16 recibieron mensajes después y los otros 5 están en
descalificado (4) o no responde (1); de los 10 borradores, 9 recibieron mensajes por otro lado y 2 son ganados. No se midió quién
los movió. Por eso **no se reenvió nada**: un aviso de hace dos semanas y un saludo a un lead ya ganado hacen más daño que el hueco.
**Y un arreglo hacia adelante no barre lo que ya quedó.** El 24/10 `archivarSecuencias` empezó a descartar borradores, y a mano se
descartaron sólo los 4 que frenaban otra automatización. Los otros 7 de la #241 siguieron aprobables hasta el 30/10: se descartaron
con el mismo texto en el historial del lead (6 líneas; el séptimo no tiene lead). **Regla:** al arreglar una regla de cierre, medir
cuántas filas viejas siguen abiertas por la regla vieja, no sólo las que hoy molestan.
**Sin hacer:**
- `tieneBorradorNutriPendiente` mira TODOS los borradores del lead, también los de una automatización pausada. En el ws 11, 31
  borradores del 20/10 de la #282 y la #284 (pausadas) caen sobre leads de 26 inscripciones activas de la #249 (pausada). Hoy no sale
  nada; al prenderla, un mensaje de IA sin «sale sola» de la #249 esperaría a esos borradores. Pausar no es archivar: es de quien
  lleve Automations y del dueño de esos borradores.
- La #264 del ws13: su aviso dice «Nuevo agendado» y también dispara en la etapa «lead». Es del cliente y no se le toca. Desde el 30/10 la pantalla lo dice en una línea
  (lib/automatizacion-disparador-dice.ts). ⚠️ El nombre solo no alcanzaba: se llama «Nueva automatización». Se lee el nombre y el primer renglón de cada aviso al equipo, nunca
  un mensaje al lead («Agenda tu llamada» en Lead es lo correcto).
**Vive en:** lib/nutricion.ts (`saleSoloEste`) · lib/evolution-envio.ts (`tieneBorradorNutriPendiente`) · lib/secuencias-huecos.ts

---

## Archivar no es cerrar: los borradores de una automatización archivada seguían vivos (24/10/2026, ws13)

**Síntoma.** El 24/10 la #264 del ws13 tenía 4 inscripciones en 'respondio' que llevaban 4 días frenadas, y cada 6 horas
el motor les corría el próximo envío. Las frenaba un borrador pendiente de cada lead (`tieneBorradorNutriPendiente`).
Esos borradores eran del paso 5 de la #241, que se había archivado el 20/10. Si alguien del cliente aprobaba uno, al lead
le salía un mensaje escrito para un flujo que ya no corre. Además, en el mismo instante, la #264 disparaba un «Nuevo
agendado» tardío sobre un lead ya trabajado, y Monica Fantoni estaba en la lista de los leads sin aviso.
**Causa.** `archivarSecuencias` (lib/secuencias-huecos.ts) cancelaba las inscripciones 'activa' y 'pendiente' y no tocaba
nada más. El mismo día pasó dos veces: acá y con las 7 confirmaciones del CRM.
**Regla.** Archivar una automatización decide en el mismo movimiento lo que dejó esperando. Ahora sus borradores pendientes
pasan a 'descartado' (nunca se borran) con una línea en el historial de cada lead, y la API lo dice al confirmar y al
terminar. **El motivo vive en el historial del lead porque `wa_borradores` no tiene dónde guardarlo:** quien lea esa tabla
sola ve un descartado y no sabe por qué. Para auditarlo hay que cruzar con `lead_audit` (campo 'Automatización').
Los 4 de la #241 se descartaron a mano el 24/10, con el mismo texto y el antes y el después medidos (`descartarBorrador`
de la app). Las 4 inscripciones salieron con `sacarDeSecuencia`, que hace CAS sobre el estado leído. No se pasaron a
'completada' porque eso dispara el desenlace.
**Sin hacer.** Las pendientes de `mako_acciones_pendientes` con origen `flujo:secuencia:<id>` de una automatización
archivada siguen vivas (lib/mako-pendientes.ts): aprobar una ejecuta la acción de un flujo muerto. Su forma de archivarlas
('archivado', el motivo en `resolved_by`) es la que usa el CRM. Las inscripciones en 'respondio' tampoco se cancelan al
archivar. No mandan nada porque una archivada queda pausada, pero quedan colgando.
**Vive en:** `lib/secuencias-huecos.ts` (`archivarSecuencias`) · `lib/api-mako/areas/chatbot.run.ts` (`archivar_secuencia`)
· `tests/archivar-descarta-borradores.test.ts`

---

## Una inscripción ACTIVA con el envío vencido hace horas puede ser lo CORRECTO: es el horario del negocio (23/10/2026)

El 23/10 a las 10:00 ART, las únicas tres inscripciones vencidas de toda la app eran del ws1 (Mauricio): la
#280 desde la 01:02, y la #291 y #292 —los leads #3099 Martín Koncke y #3100 Maria del Carmen Galvan
Castro, de la secuencia #289 «Sprint · apertura»— desde la 01:47 y la 01:51, **las dos en paso 0 y sin un
solo envío**. Leído de frente eso es un motor caído; no lo era.

El ws1 tiene `mako.horario_envio` = `{activo:true, desde:9, hasta:21}` y `mako.timezone` =
**`America/Tijuana`**. A las 10:00 de Argentina en Tijuana son las 06:00: fuera de la ventana. **Lo vencido
de noche queda en la fila a propósito** y sale a las 9:00 de Tijuana, que son las **13:00 ART** — el
«timbre de las 13:00» no era un cron ni un recordatorio: es la apertura del horario de un cliente que vive
en Baja California.

**Y el barrido de la apertura es robusto, medido en `vercel.json`:** `nutricion-tick` corre `1-59 * * * *`
(cada minuto salvo el 0) y `acabaDeAbrir` da verdadero durante los primeros `VENTANA_FRESCA_MIN` = **10**
minutos desde la apertura, barriendo TODO lo vencido de ese negocio y no sólo lo fresco. La apertura cae a
las 16:00 UTC, así que hay ~9 ticks que la ven, más la corrida de cada hora (`nutricion`, `0 * * * *`) que
cae justo en el minuto que el tick se saltea. Para que esas tres se pierdan tendrían que fallar diez
corridas seguidas.

**Antes de diagnosticar un motor por una inscripción vencida, leé el horario y la ZONA del negocio.** Son
dos consultas a `app_settings` (`mako.horario_envio`, `mako.timezone`) y descartan la clase entera. Y la
pregunta que sí importaba era la otra: **si la línea va a poder mandar cuando abra** — se sondeó
(`sondearSocket`) y `mako_ws1` contestó `vivo`, número 5216862168122, así que a las 13:00 los dos mensajes
salen en vez de fallar. Un cliente del ws3 tenía su línea caída ese mismo día («WhatsApp de empresa
desconectado: hay que volver a vincular el QR»), que es exactamente lo que convierte una espera sana en
dos mensajes perdidos.

**Vive en:** `lib/horario-envio.ts` (`acabaDeAbrir`, `proximaApertura`) ·
`app/api/cron/nutricion-tick/route.ts` · `lib/espera-duracion.ts` (`VENTANA_FRESCA_MIN`) · `vercel.json`

## «518 automatizaciones» (23/10/2026): por qué había tantas sin que nadie lo notara

**Síntoma.** Un simulacro de Automations contó 518 filas en `nutricion_secuencias`, en 14 negocios. Martín:
«No creo que existan tantas… hoy sólo Mauricio y Leila usan Automations».

**El diagnóstico obvio era el equivocado.** «Las crea el alta de cada negocio» o «las crea MaKo sola». Medido en
producción, ninguna de las dos:
- **97 ya estaban ARCHIVADAS.** El conteo leía la tabla entera. Una cuenta de «cuántas hay» tiene que filtrar
  `archivada_at is null`, y si importa, también `activa`. Vivas había 421; prendidas, 21 (todas fuera del ws3),
  y 13 de ésas son los avisos de la plataforma del ws9. El 23/10 se archivaron las 374 que no usaba nadie (las del
  ws3, la #242 y la #257 del ws10 y la #209 y la #210 del ws4) y quedaron 47 vivas.
- **370 de las vivas eran del ws3**, todas del 22 y 23/10: «🧪 Prueba chats N/M · …» y «🧪 Arnés …». Los arneses
  crean una fila por corrida en producción. `scripts/arnes-automatizacion-punta-a-punta.mts` la PAUSABA al
  terminar pero no la archivaba, y la de «Prueba chats» no vive en el repo. Pausada no se ve en ningún tablero,
  pero cuenta. Nadie lo notó porque el ws3 no lo mira nadie y ninguna fila estaba prendida.
- **Los clientes nuevos con «Un Lead Entró»** (ws15/18/19/20/22) las crearon ellos. La clave es
  `plantilla-lead-entro-*` y aparecen entre 1 h y 5 días después del alta (el ws21 no tiene ninguna). Es un clic
  en la galería o en la sugerencia del CRM, que crean al primer toque.
- **Lo que sí sembró el sistema** es de julio y agosto: el ws10 nació con 5 en el mismo segundo que el negocio, el
  31/07 se sembraron más en los ws9, ws10 y ws11, y el 10/10 la mudanza del recordatorio. Todo eso ya estaba
  archivado.

**Cómo se averigua quién creó una fila (no hay columna de autor).** `api_llamadas` sólo guarda la API externa
por token, no lo que se hace en la app. Lo que sirve, en este orden:
- **`app_settings` con la clave `automatizacion.chat:<id>`** (lib/automatizacion-chat.ts): el chat de Crear con IA
  guarda el pedido textual de la persona y la respuesta «Creé «X». Quedó pausada.». Así se probó que la #268 del
  ws1 («Crea una automatización… le envié el acceso al curso») y la #249 del ws11 las pidió la persona. Existe
  desde la duodécima tanda (12/10): una fila de antes no lo tiene.
- **La clave**: `plantilla-<id>-…` es la galería o la sugerencia del CRM, `automatizacion-…` es ＋Nueva o Crear con
  IA, y `copia-…` es duplicar.
- **Los `disparadores` y el ritmo**: varias plantillas creadas con 8 a 12 s de diferencia, cada una con su CRON ya
  puesto en una etapa distinta (noshow_r1, noshow_r2, facturando…), es el «Hacerlo» de las sugerencias «MaKo te
  sugiere» del CRM (`hacerSugerencia`, lib/sugerencias-crm-server.ts; POST /api/crm/mako sólo con `rol admin`): un
  clic por tarjeta. Así salieron las #577–#581 del ws1, el 23/10 a las 03:32 AR. La galería de /automations, en
  cambio, crea sin CRON.
- **`created_at`** contra el alta del negocio y contra la ventana de los arneses.

**La regla que queda.** `tests/automatizaciones-solo-plantillas.test.ts` tiene tres chequeos:
- la lista CERRADA de los archivos que insertan en la tabla, cada uno con la persona que lo dispara;
- que el alta, el onboarding, los cron y los webhooks no llamen a ningún creador;
- que el arnés archive su fila.

Un arnés que escribe en producción ARCHIVA lo que crea, no sólo lo pausa.

**Sin hacer.**
- El arnés de «Prueba chats» no está en el repo: quien lo tenga, que archive al terminar.

**Falsa alarma: «el recordatorio de la reunión del ws1 está archivado».** La #228 la archivó a propósito
`scripts/undecima-flujos.mts --aplicar` el 12/10 a las 02:01 UTC, en la misma corrida que la #239 y las #223, #224 y
#240 del ws13. Fue por el pedido de Martín del 11/10: el recordatorio no es un flujo aparte, va dentro de «Un Lead
Agendó Llamada». La #212 la archivó `scripts/novena-tanda-ws1.mts` el 11/10 a las 03:55 UTC («Agendó» unificado en
la #213). Hoy el recordatorio vive en la #213, en las tarjetas «60 min antes» y «15 min antes» (`antes_reunion`).
El lead 2725 lo recibió el 21/10 a las 15:00 y a las 15:45 para su reunión de las 16:00. Antes de tomar una
decisión de la memoria como vigente, mirar si una tanda posterior la reemplazó: `archivada_at` en el mismo segundo
que otras filas es la firma de un script.

**Vive en:** `lib/plantilla-crear.ts` · `lib/setting-secuencias.ts` · `lib/workspace.ts` (`crearWorkspace`: sólo
el funnel) · `lib/sugerencias-crm-server.ts` · `scripts/arnes-automatizacion-punta-a-punta.mts`

## El chat de MaKo de Automations, probado con 36 casos SIN PANTALLA (22/10/2026)

Martín, 22/10: «prueba los chats... Como el chat de MaKo en Automations, todo debe funcionar. Prueba muchos casos de
uso». Lo que pasó en la llamada con Mauricio (01:51-02:10): pegó la secuencia con «Quiero que estos sean los mensajes»,
MaKo armó dos WhatsApp, contestó «indícame qué cambios…» y después metió un audio y una variable que no existe.
El arnés es `scripts/probar-chats/automations.mts` con `casos-automations.json` (cómo correrlo y contra otra rama, en su
cabecera): llama a las MISMAS rutas que la pantalla (`/api/mako/pedidos`, `/api/chat-agent/secuencias/ia`,
`/api/chat-agent/secuencias`) en el orden de `ChatMako.tsx`, en el ws3, y juzga lo GUARDADO, no el texto de MaKo.
Corrido contra origin/main 43b0c2625: **18 pasan y 18 fallan**. Lo que falla, por causa (no por caso):

### «Quiero que estos sean los mensajes» terminaba en una RESPUESTA: el «?» de lo PEGADO lo volvía una pregunta

**Síntoma (medido, caso `quiero-que-estos-sean`):** lienzo con 2 WhatsApp + «Quiero que estos sean los mensajes:» y tres
textos. MaKo contestó «Yo no puedo modificar el flujo directamente desde aquí, pero si quieres… pídemelo en el chat», sin
tocar nada. Lo mismo con «…si no la tiene, que no le mande nada» (caso `condicion-etiqueta`): «Tendrías que insertar una
condición…».
**El diagnóstico obvio era el equivocado:** no es el modelo «que no quiere». Es el enrutador por regex de ANTES del modelo:
`esConsulta` (lib/flujo-ia-consulta.ts) da consulta si no ve un verbo de cambio Y hay un «?» en CUALQUIER parte — y los
mensajes pegados llevan «¿Sigues al frente de tu empresa?». «Quiero que estos sean» no tiene infinitivo, así que no
cuenta como pedido. Y `RX_NADA` lee «que no le mande nada» (lo que se PIDE que haga el flujo) como «no cambies nada». La
consulta va al prompt de explicar, que sólo puede devolver `{"respuesta"}`: no hay forma de que edite.
**Además:** el voseo no es un verbo de cambio para `pideCambio`: «poné» → «pone», que no es «pon» (`IMPERATIVOS`).
**Regla:** lo que viene después de «:» o entre comillas es MATERIAL (lo pegado), no cuenta para decidir si es pregunta; y
una negación DENTRO de lo pedido no es «no toques nada». Ante la duda, editar (la capa 2 contesta si no había cambio).
**Vive en:** `lib/flujo-ia-consulta.ts` (`esConsulta`, `RX_NADA`, `IMPERATIVOS`) · la ruta, `esConsulta(pedido)`.

### «Hazlo como te lo indiqué» → «indícame qué cambios…»: EDITAR no ve el chat

**Síntoma (caso `hazlo-como-te-indique`, la llamada tal cual):** turno 1 «Editalos y agregalos: <dos textos>» pisó los
dos mensajes de antes (no los agregó) y le sumó «Hola {{nombre}},» a uno de los textos pegados. Turno 2, «Hazlo como te lo
indiqué»: «Por favor indícame con más detalle qué cambios te gustaría hacer en el flujo». Y «Deshacé eso» (caso
`deshacer`): «No tengo el registro del texto anterior exacto de ese mensaje».
**Causa:** la ruta recibe `historial`, pero editar no se lo pasa al modelo: `userDeEditar` (lib/flujo-ia.ts) manda sólo
el pedido de ESTE turno y el lienzo. El modelo no sabe qué «te indiqué» ni qué había antes; el hilo sólo lo usan las
preguntas con botones.
**Vive en:** `lib/flujo-ia.ts` (`userDeEditar`) · `app/api/chat-agent/secuencias/ia/route.ts` (editar). El ↶ del lienzo
sí deshace, pero MaKo no lo dice.

### «Que arranque cuando…» ponía el CRON en la etapa de ENTREGA «Arranque»

**Síntoma (casos `mau-pega-con-disparador` y `disparador-etapa-recien-creada`):** «Que arranque cuando el lead entra a la
etapa Prospección activa del CRM X» → «arranca cuando llega a «Arranque»», con el aviso «Elegí la etapa de entrega
«Arranque»». Con «Cuando un lead entra a la etapa…» (sin «arranque») la misma etapa recién creada sale bien (casos
`crear-con-etapa-recien-creada`, `pideselo-a-mako-modal`): no es caché ni que la etapa «no se vea».
**Causa:** `entregaNombrada` (lib/flujo-ia.ts) busca los NOMBRES de las etapas de entrega como palabras sueltas del pedido
y PISA lo que eligió el modelo. «arranque» (el verbo) = «Arranque» (la etapa del producto del ws3).
**Regla:** un nombre de etapa de una o dos palabras comunes no basta para pisar al modelo; si se pisa, que sea porque el
pedido habla de un cliente (`hablaDeAlumno`) o nombra el producto.

### «Movelo a Respondió»: «esa etapa no existe» con la etapa recién creada (la pista del «esta etapa no existe» de la llamada)

**Síntoma (caso `si-responde-mover-avisar`):** automatización con el CRON en el CRM de prueba, «Respondió» creada en ese
CRM: «Saqué «Mover de etapa»: esa etapa no existe». Tampoco quedó el aviso pedido, y dijo «Cambié «…abrí 3 lugares…»».
**Causa:** `resolverAccion` (lib/flujo-ia.ts) resuelve el CRM de «Mover de etapa» con `resolverProducto(datos.embudoId ??
datos.producto ?? null)`: si el modelo no escribe el nombre EXACTO del CRM (con «🧪», «·»…), cae al PRINCIPAL
(`esDefault`), no al CRM del CRON de la automatización, y ahí la etapa no está. Las condiciones sí prueban «el principal y
después cualquiera» (`resolverEtapa`); la acción no. En la campaña de Mauricio, «mover a Contactado/Respondió» del CRM
Sprint va por acá. **No se midió en el ws1** (no se toca): es la hipótesis más fuerte para el A5 de la llamada.

### Un pedido de más de 2.000 caracteres se CORTA EN SILENCIO y MaKo inventa lo que falta

**Síntoma (caso `pedido-largo`, 8.304 caracteres con los mensajes al final):** «Creé «Primer contacto Sprint Diseño»…
Manda «Hola {{nombre}}, soy Mauricio de Sprint Diseño. ¿Le gustaría conversar brevemente…»» y un AI Step: nada de lo
pedido, sin decir que no leyó el final.
**Causa, en tres topes que no se hablan:** la ruta corta `pedido.slice(0, 2000)` (y otra vez `userDeCrear`,
`userDeEditar` y `userDeExplicar`); el modal «Pídeselo a MaKo» deja escribir 8.000 (`TOPE_PEDIDO`, CajaPedido) y la
barra del chat no tiene tope; `/api/mako/pedidos` contesta 400 «muy largo» desde 4.000 y el chat sigue con el texto
entero. Nadie lo dice.
**Regla:** un tope se DICE (o se lee entero); nunca se manda a un modelo la mitad de un pedido sin avisar.

### La regla 3 del prompt («entre dos WhatsApp, 20 horas o más») le gana a lo pedido, y se usa para inventar

**Síntomas:** «estos 2 mensajes tal cual» → metió una espera de 20 h entre ellos (caso `emojis-saltos`). «Que entre cada
mensaje haya 5 minutos» → se negó con un dato inventado: «Meta exige al menos 20 horas entre mensajes de seguimiento»
(caso `cinco-min-entre-mensajes`). La regla 8 dice «SÓLO lo que pide el pedido»: las dos chocan y gana la 3.
**Vive en:** `lib/flujo-ia.ts` (`TARJETAS_Y_REGLAS`, reglas 2, 3 y 8).

### Lo demás que se midió (cada uno con su caso)

- **Un link escrito en el pedido se saca** (caso `creame-otra`): «No tengo guardado el link «sprint»: el mensaje va sin
  link». La regla 2 del prompt sólo deja links del catálogo, aunque el dueño lo escriba.
- **Editar no puede INSERTAR entre dos tarjetas** (caso `esperar-2-dias`): «agregar» cuelga sólo de una salida VACÍA
  («Esa salida ya tiene tarjetas: no la pisé») y el resumen dice igual «Cambié «Hola estimado…»» con el borrador idéntico
  al publicado (61,7 s y 5 intentos). Una flecha reescrita cuenta como «Cambié».
- **Dos textos pegados para agregar quedaron en UNA tarjeta** (caso `agrega-estos-textos`).
- **Una variable que no existe se borra y deja el texto roto**: «¿Sigues al frente de?» (caso `variable-inventada`), con
  el aviso «Borré una variable que no existe» y nada más.
- **Límites y horario: el modelo de editar no sabe dónde viven** e inventa lugares («se configura desde la campaña o
  difusión al momento de programarla», «la configuración general del disparador»). Los reales: Configuraciones › Límites
  y el horario de la automatización. Ante «no mandes sábado ni domingo» intentó una condición `dia_semana` (no existe) y
  terminó agregando dos «Esperar 2 días» al final.
- **«Que lo llame por teléfono»** (caso `imposible`): no dijo que no puede; sacó la espera de 1 día que nadie nombró y
  metió un aviso al equipo «Llamar a {{lead_telefono}}».
- **Al borrar un mensaje del medio quedan dos esperas seguidas** (1 día + 2 días = 3 días hasta el siguiente).
- **Lo que anda:** crear sobre el lienzo VACÍO con la secuencia pegada (el caso de Mauricio en vacío: tres tarjetas, 1 y 2
  días, `{Nombre}` → `{{nombre}}`), cambiar un texto, borrar, mover, el mexicano, emojis, email, Instagram sin conectar
  (avisa), la etapa inexistente (lista las que hay), preguntas que no tocan el lienzo, «créame otra» por la burbuja (la
  abierta queda igual), la plantilla de un lead nuevo, un audio que no hay (lo dice).

### El tiempo: 26 de 36 casos tienen un turno de más de 20 s

Dónde se va, medido en las fases: `/api/mako/pedidos` tarda 7-8 s cuando llama a la IA (antes de que MaKo empiece);
`armarContexto` ~4 s; y el primer intento del ws3 rebota casi siempre (la key propia de Gemini al tope diario, 429) y
recién contesta la red de plataforma (Gemini flash / flash-lite o Groq gpt-oss). Un caso hizo 11 intentos (45 s).

**Sin hacer (todo lo de arriba):** ningún arreglo se hizo en esta corrida; el arnés queda como prueba de aceptación del
chat del área (`node … scripts/probar-chats/automations.mts --casos=…`).

## «Métricas» de cada automatización: el editor del Dashboard con un tercer informe (23/10/2026)

**El pedido** (Martín, 23/10 20:56): una pestaña de métricas por automatización, con un botón al lado de la tuerca. Al
tocarlo, el lienzo se reemplaza por un dashboard que arma MaKo, que se personaliza como el Dashboard y que se puede
llevar como hoja nueva a la tab Dashboard. Se copió la estructura de las métricas de un flujo de Klaviyo y de HubSpot:
arriba los totales, abajo lo que pasó por día y lo que pasó en cada paso del flujo.

**Lo que no era obvio:**
- **No hay un «tipo de informe» genérico.** `'general'` está comparado a mano en cada lugar: la clave en
  `lib/graficos-tablero.ts`, el guardado en `/api/graficos`, la URL del autoguardado en `EditorInforme` y
  `CLAVE_HILOS`. El informe `automatizacion:<id>` (clave `automatizacion.informe.<id>.<sub>`, por persona como
  General) se sumó en cada uno. Lo que todavía no lo conoce está en «Sin hacer».
- **El campo compartido «Automatización» es el NOMBRE, no el id.** Las fuentes `inscripciones` y `envios` lo traen
  así. El filtro fijo de cada hoja se reescribe al abrir con el nombre de hoy (`conLaAutomatizacion`), así que
  renombrar no deja la hoja en cero. Una hoja llevada al Dashboard sí queda con el nombre del día en que se llevó.
- **«Contestó» no tiene hora propia.** `nutricion_envios.respondio_at` no lo escribe nadie (0 de 184 el 23/10). Las
  «horas hasta responder» van de `inscripto_at` a `desenlace_at` o `updated_at` de una inscripción en `respondio` o
  `handoff`. Es una aproximación que puede dar de más, nunca de menos (`horasHastaResponder`).
- **Un envío puede ser un mensaje, un aviso al equipo u otra acción.** El campo `asunto` guarda el asunto de un email
  y también la operación de una acción. Por eso un aviso que falló queda `fallo` con `avisar_al_equipo` en `asunto`
  (`tipoDeEnvio`).
- **La cabecera del lienzo la dibuja el lienzo (`chrome`).** Para que «Métricas» lo reemplace y se pueda volver con el
  mismo botón, la cabecera pasó a `const cabecera` en `SecuenciaPerfil.tsx`, y la usan las dos vistas.
- **EditorInforme es del cliente.** Si importara el módulo de la plantilla, se llevaría `flujo-conversacion` al bundle
  del Dashboard. El nombre del informe vive aparte, en `lib/informe-automatizacion.ts`, sin imports.

**Medido con la #289 del ws1 (sólo lectura, 23/10):**
- **Totales:** 12 entraron, 10 siguen y 2 respondieron (16,7%).
- **Respuesta:** 5,8 horas hasta responder, el promedio de 11,3 h y 0,3 h.
- **Avisos al equipo:** 1.
- **Por tarjeta:** 7 llegaron a la tarjeta 01 y 2 a la de MaKo.
- **Envíos de hoy:** 8 enviados y 1 fallado.

Todo coincide con la base contada a mano.

**Sin hacer.**
- El cron del AI Analyst no lee estos informes (`leerInformeGuardado`, lib/graficos-analisis-server.ts, mira Dashboard
  y General). Una caja de Conclusiones que se ponga en las Métricas no corre sola.
- Los pop-ups de un gráfico leen la definición del informe del Dashboard (`popupDe`, app/api/graficos/route.ts), así
  que en las Métricas usan la que manda la pantalla.
- «Llevar al Dashboard» lleva la PRIMERA hoja de las Métricas, no la que se está mirando, porque el editor no expone
  la hoja abierta.

### Una sola barra arriba: la del informe (24/10/2026)

**El pedido** (Martín, cuatro puntos). «Llevar al Dashboard» va dentro de los 3 puntitos. El título no se duplica y no
lleva desplegable. «Analizar con MaKo» se va. Y mirando las métricas no van «Probar» ni «Configuraciones»: en su lugar
van la búsqueda, el filtro y los 3 puntitos. **El problema de fondo:** las Métricas heredaron la barra entera del editor
del Dashboard, con su selector de hojas, debajo de la barra de la automatización. Un informe de automatización no tiene
varias hojas, no se prueba y no se configura desde ahí.

**Cómo quedó:**
- La cabecera de la automatización (título y «Flujo») es la MITAD IZQUIERDA de la barra del informe:
  `cabeceraPropia` de `EditorInforme` y `propia` de `BarraSuperior` (app/dashboard/Cabecera.tsx).
- La derecha es la del informe: buscar, filtrar, Editar y el ⋮.
- La tuerca y «Probar» no se dibujan mientras `verMetricas`.
- «Llevar al Dashboard» es el primer renglón del ⋮ (`enMas`). Como el `Flotante` no se cierra con un clic adentro,
  después de llevarla queda ahí mismo «Abrir … en el Dashboard».
- El título del PDF y el nombre del CSV son los de la automatización, no «Métricas».

**Por qué se bajó la cabecera al editor y no se subieron los controles con un portal** (los dos caminos parecían
iguales):
- `BuscarEnHoja` busca su hoja con `closest('.lk-app')`. Fuera de esa caja la búsqueda deja de andar sin dar error.
- Los eventos de React suben por los portales: un clic derecho en un botón portaleado abría el menú contextual del
  Dashboard.
- Al imprimir sólo queda `.lk-app`, así que el PDF habría salido titulado «Métricas».

**Dos trampas que no se ven:**
- El «✕ Cerrar» de la prueba vive en la misma barra que «Probar». Abrir las métricas con la prueba abierta la dejaba sin
  forma de cerrarse, así que `BotonMetricas` la cierra antes.
- El editor entra con `next/dynamic`: mientras baja su código, su `loading` no recibe props y «Flujo» desaparecía. La
  izquierda le llega por contexto (`IzquierdaDeCarga`).

Test: tests/metricas-una-barra.test.ts (10 roturas). **Los dos defectos que quedaban** se arreglaron el mismo día. El
análisis programado se borraba solo, porque la hoja era `am-hoja` en todas. «Compartir» entregaba el Dashboard entero.
El detalle está en docs/hallazgos-graficos.md, «"Analizar con MaKo" sale de la barra».
- No se vio en pantalla antes de subir (no había RAM para un build local): se mira en producción después del deploy.

**Vive en:** `lib/automatizacion-metricas.ts` (la plantilla, el filtro, lo que cuentan las fuentes) ·
`lib/informe-automatizacion.ts` · `lib/automatizacion-metricas-server.ts` · `app/api/automations/metricas/route.ts` ·
`app/automations/MetricasAutomatizacion.tsx` · `app/automations/SecuenciaPerfil.tsx` (`BotonMetricas`, `cabecera`) ·
`app/m/automations/MetricasM.tsx` · `metricas_automatizacion` (lib/api-mako/areas/dashboard.*) ·
tests/automatizacion-metricas.test.ts
*23/10/2026, chat «Automations › Métricas» (claude2).*

### El aviso «Contestó» de la #289 quedó VACÍO, y «Contestó» es de la inscripción, no del teléfono (23/10/2026)

**El síntoma:** la única persona real que contestó en «Sprint · apertura» (ws1, lead 3100) no le llegó a Mauricio: el
envío 183 quedó en 'fallo' con «No salió el aviso: El aviso quedó vacío.». **La causa:** el texto del aviso era UN
renglón («… Teléfono: {{lead_telefono}} | Email: {{lead_email}} | Chat: {{link_chat_lead}}») y `sinRenglonesVacios`
(lib/variables-aviso.ts) borra entero el renglón con un dato del catálogo sin valor. Ella no tenía email, y el flujo
existe justamente para pedírselo a quien no lo dio: con ese texto, NINGÚN aviso de esa rama iba a salir. **Arreglo:** el
dato se partió en renglones (setSecuenciaPasos, mismos ids) y, en el código, `textoConDatosParaEquipo`
(lib/variables-del-lead.ts): si la regla deja vacío un aviso AL EQUIPO que tenía palabras propias, sale entero con «—»
en el dato que falta. **Regla:** una regla que borra contenido opcional tiene que tener piso; «opcional» es del renglón,
no del mensaje. Al lead nunca le sale el «—».
**Y lo que parecía el bug no lo era:** Martín probó con su lead 3099 y «no le cortó». Su respuesta cayó en el lead 249:
`matchLeadPorTelefono` (lib/evolution-mensajes.ts) se queda con el id MÁS CHICO entre los que comparten teléfono, y
«Contestó» lee sólo el estado de la INSCRIPCIÓN (`insc.estado === 'respondio'`, que pone `pausarPorRespuesta` por
lead_id). Un lead duplicado por teléfono contesta en el otro y la automatización no se entera. No se cambió el matcher
(anotado, el ws1 tiene un solo par: 249/3099). Para probar, un lead que sea el único con ese teléfono.
**Vive en:** lib/variables-del-lead.ts · lib/api-mako/areas/chatbot.run.ts (`textoDelAviso`) ·
tests/aviso-equipo-no-vacio.test.ts. **Sin hacer:** el lienzo no avisa al escribir un renglón con varios datos
opcionales. (El duplicado por teléfono se arregló el 24/10: la respuesta va a la ficha a la que le escribimos último, ver «Dos fichas con el mismo teléfono» en docs/hallazgos-comunicacion.md.)
*23/10/2026, chat «Automations» (claude2).*

### Mover un lead a la etapa del CRON no lo hace empezar de nuevo, y no lo decía (23/10/2026)

**El síntoma:** Martín llevó su lead a «Prospección activa» (el CRON de la #289) y «no pasó nada». **La causa, en dos
capas:** la reentrada de la #289 era NULL, que para un flujo que no prepara reunión se lee «Una sola vez»
(`reentradaDe`), así que `reusaInscripciones` la dejaba afuera; y aunque fuera «Cada vez», la inscripción seguía VIVA, y
una viva nunca se reinicia por evento (`puedeReentrar` → 'no_termino'). En `enrolarPorEvento` las dos terminan en el
mismo `if (!r) continue;`, sin escribir nada: ni historial, ni error. Y desde la pantalla no había salida: «Frenar» deja
'cancelada', y una cancelada no vuelve nunca. **Arreglo:** si lo mueve una PERSONA, una línea en el historial firmada por
ella («No volvió a entrar a «…»: ya entró una vez y su reentrada es «Una sola vez».», `motivoNoVuelve`) y el informe del
movimiento (`automatizaciones`: en cuáles entró y en cuáles no) de vuelta a la pantalla; «Empezar de nuevo» (acción y
operación de la API `empezar_de_nuevo_lead_secuencia`) por la inscripción manual de siempre (`decidirInscripcionManual`
con `empezarDeNuevo` → `reactivarInscripcion`); y el detalle para el bloque «Automatizaciones» de la ficha
(`detalleDelLead`). La pantalla es del chat del CRM. El «no entró» no tiene tabla: el detalle lo lee del historial
(`leerNoVolvio`), y el id sale de las inscripciones del lead, porque sólo deja de entrar quien ya tiene una. **La trampa del autor:** el evento de etapa
no dice quién movió (lo usan el motor, MaKo, los lotes y las confirmaciones, todos por `setPipelineStage`), y adivinarlo
por el valor de `autor` firmaba como persona lo que hizo un proceso. Va EXPLÍCITO: `porPersona` lo pasan sólo
`setLeadStageAction`, `completeStageMoveAction` y `moverEtapaEnProductoAction`, que exigen sesión. **Regla:** un `continue` que decide por el usuario
tiene que dejar una línea en algún lado; si no, «no funcionó» es lo único que queda.
**Vive en:** lib/nutricion.ts (`enrolarPorEvento`, `decirQueNoVolvio`, `inscribirEnSecuencia`) · lib/reentrada.ts
(`motivoNoVuelve`, `lineaNoVolvio`, `leerNoVolvio`) · lib/leads.ts y lib/lead-funnel.ts (devuelven el informe) ·
lib/nutricion-inscripcion-manual.ts · lib/automatizaciones-del-lead*.ts (`detalleDe`, `detalleDelLead`) ·
lib/api-mako/areas/chatbot.* · tests/no-volvio-a-entrar.test.ts · tests/empezar-de-nuevo.test.ts ·
tests/automatizaciones-del-lead-detalle.test.ts. **Sin hacer:** los lotes (tablero y agregados) y el celular
(app/m/crm) no pasan la persona; el reinicio de una fila 'activa' no frena un envío que el tick esté mandando en ese
mismo instante (el compare-and-set es sobre estado y desenlace); el envío no guarda «entregado/leído» del WhatsApp.
*23/10/2026, chat «Automations» (claude2).*

### Lo que se midió de la #289 y la #198 antes del sábado (23/10/2026, sólo lectura)

**Los 1050 agregados del Sprint entrarían todos** al moverlos a «Prospección activa» (`agregadoEntraPorEvento`: abiertos,
dentro de los 90 días, ninguno nació con el lead), pero el goteo de la #289 deja salir 50 por día y la línea 65: son unas
TRES SEMANAS, no un fin de semana. El lote (`moverLeadsDeEtapaAction`) corta en 200 y manda sin la vía rápida. **La #289
no respeta el horario de oficina:** su configuración trae `horario.activo:false` (guardada el 23/10 a las 20:03), y
`horarioDeLaAutomatizacion` da null; el «fuera del horario» que vio Martín a las 21:47 era de antes. **Los fallos 184 a
186 de la #198 no son un bug:** son leads de prueba de Meta («<test lead: dummy data for …>», sin teléfono real, en
'perdido'); la trampa es otra: sus inscripciones siguen 'activa' y el motor las reintenta cada 24 h (o 4 h) para
siempre, sumando fallos en el registro de la línea. **Sin hacer:** cerrar la inscripción de un lead sin teléfono válido
después de N reintentos (lib/nutricion.ts, «lead sin teléfono» ~5177), y no inscribir los «test lead» de Meta.
### Un teléfono que falta no se arregla reintentando, y a un lead de prueba de Meta no se le escribe (23/10/2026)

**El síntoma:** la #198 «Un Lead Entró» del ws1 sumaba ~7 fallos por día a leads de la Lead Ads Testing Tool de Meta («<test
lead: dummy data for PHONE>»): el 2767 con «teléfono inválido» cada 4 h (no tiene un solo dígito) y los 2769-2773 con
«lead sin teléfono» cada 24 h, para siempre. **La causa:** el reintento diario era a propósito («por si le cargan el
teléfono»), pero contradice la regla de AGENTS.md (un fallo que va a fallar igual no se reintenta), y el «teléfono
inválido» caía en el backoff de 4 h de un error del proveedor. **Arreglo:** `telefonoSinArreglo` (vacío o sin dígitos) y
`esLeadDePruebaDeMeta` (lib/lead-sin-arreglo.ts): el motor cierra la inscripción con su motivo (`terminal`, el mismo
camino del opt-out), en los dos WhatsApp; el lead de prueba se corta antes de cualquier canal (su email es
`test+…@meta.com` y saldría de verdad). El número de 10 dígitos sin código de país NO se cierra: se arregla configurando la
línea. **Vive en:** lib/lead-sin-arreglo.ts · lib/nutricion.ts (`procesarEnvios`) · tests/lead-sin-arreglo.test.ts.
**Sin hacer:** el lead de prueba igual ENTRA a la automatización (se cierra en su primer envío); no se filtra al inscribir.
*23/10/2026, chat «Automations» (claude2).*

## «MaKo no tiene botones en los DM de Instagram»: los tenía Zernio, no MaKo (24/10/2026, trabajo 49ff20a3)

**Síntoma:** un chat de la cuenta 1 le preguntó a Martín cómo armar «el gate de seguidor» porque «MaKo no tiene botones en
los DM de Instagram», y le propuso rodeos («repetir la keyword por DM»). Martín contestó con la captura de un DM de Fiesta
Music que trae «Obtener recurso», «Abrir» y «Obtener el enlace»: «Aun no arreglaste lo de los botones». **El diagnóstico
obvio («Instagram o Zernio no lo permiten») era el equivocado:** `https://zernio.com/openapi.yaml` (v1.352.0, medido el
24/10) trae `buttons` (1 a 3, `postback` o `url`, título ≤20) en el DM y en la respuesta privada a un comentario, y el
toque vuelve al webhook `message.received` como `metadata.postbackPayload`. Lo que faltaba era MaKo: `enviarDm` mandaba
sólo `message` y la respuesta privada era «sólo texto» a propósito.
**Cómo quedó (fase A, el motor, y el lienzo):** lib/botones-social.ts (la pieza pura). Un botón sin `url` es una SALIDA de
la tarjeta (`btn:<id>` en `puertosDe`, como una fila de una condición). El `payload` lleva la inscripción, la tarjeta y el
botón (`mako:b:<insc>:<nodo>:<botón>`). El webhook lo pasa a `tocarBoton` (lib/nutricion.ts) ANTES de la pausa y del
disparo: un toque no es una respuesta. `tocarBoton` mueve la inscripción a la rama del botón con compare-and-set y corre la
vía rápida. Un mensaje con botones y nada abajo ESPERA el toque: queda 'activa' en esa tarjeta, sin próximo envío. Con
eso, el flujo de ManyChat entero se publica, con la vuelta de «Ya te sigo» a «¿Te sigue?».
**Las trampas:**
- **El ciclo sin espera:** `ciclosSinEspera` rechazaba esa vuelta. La flecha de un botón no cuenta, porque la corre el
  toque de la persona y no el motor en la misma corrida.
- **La quinta puerta:** sin `botones` en `camposDelFlujo` (lib/nutricion-grafo-motor.ts), el primer guardado los borraba
  en silencio.
- **El rechazo desparejo de Meta:** algunas cuentas rechazan los botones en la respuesta privada a quien no sigue (código
  2, subcode 1545133), y el intento GASTA la única respuesta. La cuenta que rechazó queda anotada
  (`zernio.botones_rechazados.<cuenta>`) y la próxima sale en texto con «Escríbeme «…»». Escribir el título de un botón
  cuenta como tocarlo (`botonPorTexto`), sólo en una inscripción que espera un toque.
- **Después del toque, «¿Te sigue?» lee en vivo:** el toque es un mensaje y deja la conversación (`pedidoDeSeguimiento`
  pide su id). Antes del toque, a quien sólo comentó, el «¿te sigue?» le decía «no sé».
**Y lo que arma la IA de MaKo al CREAR (fase B):** `deIA` (lib/flujo-ia.ts) lee los botones de un mensaje de Instagram, y
el gate de seguidor sale armado y publicable (tests/crear-ia-botones.test.ts). **Dos trampas:**
- **El armador es un árbol** («cada tarjeta cuelga de un solo lugar»): la vuelta de «Ya te sigo» a la condición daba
  «una tarjeta seguía en dos lugares» y se cortaba. Un botón que vuelve a una tarjeta que ya tiene lugar es una salida, no
  un segundo padre: el toque es la espera.
- **El techo de Groq:** decirle al modelo lo de los botones en el system pesaba ~100 tokens para TODOS los pedidos, y
  tests/crear-ia-tercera.test.ts marcó ~4.098 contra 4.000. Va en el user, SÓLO en un pedido de Instagram o Messenger
  (`BOTONES_SOCIAL`, junto a la línea `CANAL`). Ahí también va dicho el gate («el link va SÓLO en el mensaje del sí»): es
  lo que le faltaba al borrador que regalaba el link.
**Sin hacer:** «Editar con IA» (`deIAEdicion`) todavía no conoce los botones. «Probar» (lib/simulador-grafo.ts) no imita el
toque. La ficha del lead no dice «esperando que toque un botón». No se probó con un DM de verdad: falta una cuenta de
Instagram conectada en el Cliente de Prueba.
**Vive en:** lib/botones-social.ts · lib/flujo-grafo.ts · lib/canal-zernio.ts · lib/zernio.ts · lib/nutricion.ts
(`tocarBoton`, `avanceDesde`) · lib/canal-social.ts (`postback`) · app/api/webhooks/zernio/route.ts ·
lib/flujo-conversacion.ts · app/automations/BotonesSocial.tsx · tests/botones-instagram.test.ts.
*24/10/2026, chat «Automations» (claude5).*

## Un goteo para todos los canales, y el goteo del email que no frenaba (24/10/2026, f20 y f21)

**El pedido:** la llamada con Leandro (24/10, docs/feedback-24-10.md): «solamente está el goteo en WhatsApp y en email, pero
no está en Instagram» (f20) y «que sea un solo botón para todos y listo» (f21). Martín, 24/10 23:00: «Uno solo: un solo
interruptor de goteo (y uno de tope por día) que valga para todos los canales».

**Qué quedó:** UN `goteo` por automatización (lib/config-automatizacion.ts) y UN bloque «Todos los canales» en Configuraciones
(app/automations/ConfigAutomatizacionPanel.tsx), que vale para WhatsApp, email, Instagram y Messenger. **Cada canal cuenta
lo suyo** (lib/goteo.ts, `canalDelGoteo`, `claveDeGoteo`): «hasta 50 por día» son 50 WhatsApp y 50 DMs. Lo decidió
Automations, porque el riesgo es de cada canal (el baneo de un número no tiene nada que ver con el tope de Meta) y porque
el 23/10 ya se había decidido que el goteo del WhatsApp no frenara al email. Si Martín lo quiere sumado entre todos, es
cambiar `claveDeGoteo` por una sola clave.

**Lo que estaba roto y no se veía:**
- **El goteo del email no frenaba nunca** (desde 629500245, 24/10). La puerta de los mensajes (`sigueSinCupo`) dejaba pasar
  un email mientras quedara cupo de email, para que no lo frenara el cupo de WhatsApp. Pero el freno que esquivaba
  también incluía SU goteo. Ahora el freno de un email es sólo su goteo (`sinLugarDelMensaje`) y `noGastaTurno` no deja
  pasar ningún mensaje. No le pegó a nadie: ninguna automatización tenía goteo de email (medido).
- **Instagram «tenía» goteo sin tenerlo:** un DM pasaba por el goteo de WhatsApp, pero sus envíos nunca se contaban.
  Lo frenaba lo que salía por WhatsApp, nunca lo suyo.

**Lo guardado:** medido en producción antes de juntarlos (`scripts/medir-goteo-un-interruptor.mts`, sólo lectura): dos
automatizaciones con goteo, la #289 de Mauricio (prendida: 11 min, 65 por día) y la #568 de Martín (apagada), las dos sólo
de WhatsApp. Al leer, el `goteo` de antes pasa a ser el de todos y, si no hay, el `goteoEmail`. No se escribió nada en
producción, y a ninguna le cambió el número. Guardar un `goteoEmail` da error. El tope por día llega a 500 (el más alto
de las líneas); los WhatsApp los sigue cortando su línea.

**Regla:** un interruptor por canal en Configuraciones es una regresión (memoria `goteo-un-interruptor`). Lo que MaKo dice
de esa pantalla (`LO_QUE_NO_ES_TARJETA`, `LUGARES_REALES` en lib/flujo-ia-intencion.ts) se cambia junto con la pantalla:
decía «un bloque por canal (WhatsApp, Email)», y a Leandro le nombró uno de Instagram que no existía (f22).

**Sin hacer:**
- Un DM de Instagram sigue gastando el cupo de la LÍNEA de WhatsApp (`waEnCorrida` cuenta todo lo que no es email), lo que
  ya pasaba antes. No es lo que pidió f20, y cambiarlo saca a Instagram del único tope de línea que tiene.
- Aprobar un borrador de email mira el goteo con lo aprobado por WhatsApp (`frenoDelGoteoAlAprobar`,
  lib/borrador-camino.ts).
- No se vio en pantalla.

Vive en: lib/goteo.ts · lib/config-automatizacion.ts · lib/nutricion.ts (`usoDelGoteo`, `sinLugar`, `quedaFrenada`) ·
app/automations/ConfigAutomatizacionPanel.tsx · lib/api-mako/areas/chatbot.def.ts y .run.ts · lib/flujo-ia-intencion.ts ·
tests/goteo-un-interruptor.test.ts.

## La nota de voz del chat del lienzo: sale ya y se escucha (24/10/2026, f17)

**El síntoma (la llamada con Leandro, 29:49):** «se envió tipo transcripto cuando ahí en el chat mismo se debería poder
escuchar el audio... cuando le das a enviar audio se tiene que enviar automáticamente, no esperar a transcribirlo».

**La causa:** `enviarAudio` (app/automations/ChatMako.tsx) transcribía PRIMERO y recién ahí mandaba el texto. No se veía
nada mientras tanto, y el audio no quedaba en ningún lado. El hilo compartido (`HiloMako`) ya sabía dibujar una nota de
voz (`voz` del item, con `AudioPlay`); el chat del lienzo nunca le pasaba una.

**Qué quedó:** el globo con el audio entra al hilo en el acto («enviando» mientras se transcribe), y lo entendido sale como
el mensaje, con su audio (`voces`, por id). Si no se entiende, queda con su error y «Reintentar» lo vuelve a transcribir.
El molde es el chat del lead (app/crm/lead-view/MakoAnalystLead.tsx).

**Sin hacer:** el audio es de esta sesión de la pantalla. Al recargar queda lo entendido, sin el audio. Guardarlo es subirlo
como hace el Ops Center (`subirNotaDeVozDelChat`, lib/chat-mako-adjuntos.ts) desde la ruta del chat
(/api/chat-agent/secuencias/ia). No se vio en pantalla.

Vive en: app/automations/ChatMako.tsx (`enviarAudio`, `reintentar`, `hiloUnico`) · tests/chat-mako-nota-de-voz.test.ts.

## Una pregunta en «Editar» y lo que no está en MaKo (24/10/2026, f18 y f23)

**El síntoma (la llamada con Leandro, 29:24-31:16 y 36:01):** preguntó por audio, en «Editar», «¿Existe un tope de mensajes o
un tope de comentarios que se puedan responder en la cuenta…?», y MaKo contestó «El tope de mensajes por día se configura
en configuraciones de esta automatización». Martín: «le hiciste una pregunta en la opción de editar en lugar de discutir,
entonces te respondió otra cosa». Después MaKo le describió «un bloque para Instagram» en Configuraciones que no existía.

**⚠️ El diagnóstico obvio era el equivocado.** «Editar no contesta preguntas» no era cierto: desde el 22/10 una pregunta con
«¿?» en «Editar» ya va al prompt de explicar (`vaAExplicar`, `esPreguntaDirecta`). Lo que falló fueron tres cosas:
- **La pregunta DICTADA** no siempre trae «¿?». Ahora `esPreguntaDictada` (lib/flujo-ia-consulta.ts) reconoce la que arranca
  como pregunta («existe…», «hay algún…», «cómo hago…», «cuántos…», «qué pasa si…») y no pide un cambio. Es a propósito
  estrecha: «cuando contesta, mándale…» es una orden, y «se puede agregar…» es un pedido (`RX_PIDE_PREGUNTANDO`).
- **MaKo no sabía lo que pone Meta**, y la regla «lo que se configura fuera de las tarjetas, di dónde está» lo mandaba a
  Configuraciones. Ahora `LO_QUE_NO_ES_TARJETA` (lib/flujo-ia-intencion.ts) lo dice: un DM sólo dentro de las 24 h del
  último mensaje de la persona, nunca primero, y a un comentario se le contesta una vez por privado.
- **Lo que no está, inventado** (f22). Ahora MaKo lo dice en una frase y pone en `falta` qué pidió. El globo ofrece
  «Pedírselo al equipo» (app/automations/PedirAlEquipo.tsx), que levanta un PEDIDO en la Ticketera con `noExiste`, como
  `levantar_ticket` del Ops Center.

**Regla:** el ticket sale del chat GUARDADO (`ticketDeLaFalta`, app/automations/pedir-al-equipo.ts): la última vez que MaKo
dijo esa falta y lo que se le pidió antes. Del navegador sólo viaja cuál es. Una falta que MaKo no dijo no levanta nada, y
tocar dos veces da el mismo ticket (`refDeLaFalta`). Se pregunta con un botón, no sale solo: es como lo hace
`levantar_ticket`, y un falso «no está» del modelo no llena la Ticketera.

**Sin hacer:** el chat del Ops Center ya tenía `levantar_ticket`; este botón es del chat del lienzo. No se probó con el modelo
de verdad (sólo la lectura de su JSON): falta ver que Groq ponga `falta` cuando corresponde. No se vio en pantalla.

Vive en: lib/flujo-ia-consulta.ts (`esPreguntaDictada`, `faltaDelModelo`) · lib/flujo-ia-intencion.ts ·
lib/automatizacion-chat.ts (`falta`) · app/api/chat-agent/secuencias/ia/route.ts y …/ia/falta/route.ts ·
app/automations/PedirAlEquipo.tsx · tests/chat-mako-falta-y-pregunta-dictada.test.ts.

## MaKo nombraba un ícono y un lugar que no estaban (24/10/2026, f19 y f22)

**El síntoma (la llamada con Leandro, 31:29 y 36:01):** «el ícono de configuraciones no es el correcto... Fíjate dónde está»,
y «un bloque para Instagram donde puedes configurar el tope máximo de comentarios», que no existía.

**La causa:** a MaKo se le decía que Configuraciones está «en el «⋯» de esta automatización». Ese es el menú de la FILA, en la
lista. En el lienzo, donde se chatea con MaKo, Configuraciones se abre con la tuerca del título (`BotonTuerca`,
app/automations/SecuenciaPerfil.tsx). Y la guarda de un lugar inventado (`errorDeRespuestaEnEditar`) era sólo de Editar,
pero la respuesta de Leandro salió de explicar.

**Qué quedó:**
- El prompt dice «la tuerca al lado del nombre de esta automatización» (`LO_QUE_NO_ES_TARJETA`).
- El globo de MaKo que nombra Configuraciones lleva esa misma tuerca (`Icon name="config"`, `TuercaEnElGlobo`,
  ChatMako.tsx), que la abre. Así lo que dice MaKo y lo que se ve son lo mismo.
- `lugarInventado` (lib/flujo-ia-intencion.ts) la usan Editar y explicar: «Configuraciones › X» con una X que no está, o un
  bloque, sección o pestaña de un canal, vuelve al modelo como error.

**Regla:** lo que el prompt dice de una pantalla se cambia con la pantalla, y lo que MaKo puede mostrar (un ícono, un botón)
sale del componente de verdad, no de una descripción.

**Sin hacer:** la tuerca del globo sólo está en el chat del lienzo (el modal «Pídeselo a MaKo» no abre Configuraciones). Los
otros chats (Ops Center) no tienen esta guarda de lugares. No se vio en pantalla.

Vive en: lib/flujo-ia-intencion.ts (`lugarInventado`, `LO_QUE_NO_ES_TARJETA`) · app/api/chat-agent/secuencias/ia/route.ts ·
app/automations/ChatMako.tsx (`TuercaEnElGlobo`) · app/automations/SecuenciaPerfil.tsx · tests/chat-mako-tuerca-y-lugares.test.ts.

## Los botones de Instagram, de punta a punta: Editar, Probar, la ficha y la API (25/10/2026)

**El pedido:** Martín, 25/10 ~13:15: «Ya esta el tema de los botones de Instagram para Automations? Que lo pide el cliente
Leandro». El Cerebro: que queden terminados de punta a punta (la API, «Probar», «Editar con IA», la ficha y un DM de verdad).

**Qué quedó:**
- **Editar con IA** (lib/flujo-ia.ts): el modelo los lee en el flujo (`aIA`), los cambia con "botones" en "cambiar"
  (`botonesDelParche`) y cuelga tarjetas de uno con "salida": "btn:<id>". Las reglas van sólo si el flujo ya tiene botones
  o el pedido habla de ellos o del gate. Con «Cambia WhatsApp por Instagram» y el CRON pasaba el techo de Groq.
- **Probar** (lib/simulador-grafo.ts, PanelProbar, SimuladorSocial): quien prueba toca los botones en el DM. Un DM con
  botones y nada más que correr deja la prueba esperando, sin «Fin». `tocar` es el `tocarBoton` del motor.
- **La ficha** (`botonesQueEspera`): «Espera que toque «Obtener recurso»», no «En curso».
- **La API**: `cambiar_botones_mensaje`, por HTTP, que es lo que usa el Claude de Leandro, y de pantalla. Cambia los
  botones y también el TEXTO del DM (`editar_pasos_secuencia_mensajes` es sólo WhatsApp y email, y sin ramas: un DM con
  botones vive en un flujo con ramas). La ficha dice los botones con su puerto (`btn:<id>`); `inscripciones_lead`,
  `espera_toque`. Y `crear_automatizacion_con_ia` sale por HTTP (el Cerebro, 25/10: «todo MaKo se debe poder utilizar por
  API»), con `costo: 'ia'`.

**⚠️ Las trampas:**
- **Un botón nuevo tomaba el id de su lugar** («b1») y le robaba el suyo a uno que se quedó en otro lugar. Lo que colgaba
  del puerto `btn:b1` se iba con el nuevo. Ahora uno que se queda conserva su id, y uno nuevo toma uno libre (en Editar y
  en la API). La primera rotura del test salió VERDE: en el mismo lugar el id coincide igual. Se le sumó el caso reordenado.
- **Sacarle el único botón a «Obtener recurso» deja la condición suelta.** La API lo rechaza porque mira sólo los errores
  NUEVOS de `validarGrafo`. Uno que el flujo ya tenía no frena cambiar un botón.
- **Una prueba sin `siguiente: null` explícito sigue por el ORDEN de la lista** (lo de antes, lineal). Un flujo del lienzo
  siempre lo tiene; un fixture escrito a mano, no.

**⚠️ La prueba con un DM de verdad NO se pudo hacer**, y no es por el código. Medido el 25/10 14:10 ART
(`scripts/medir-instagram-de-mako.mts`, sólo lectura):
- el negocio de la plataforma (Martin Koncke) no tiene Zernio: ni key, ni fila, ni automatizaciones de Instagram;
- el Cliente de Prueba tiene fila de Zernio con profile, pero sin key y con el webhook sin entregar;
- ningún negocio nuestro tiene Instagram conectado.
Para hacerla, Martín tiene que conectar en su negocio la key de Zernio de MaKo y el Instagram de MaKo (Integraciones ›
Zernio, y el login de Instagram). Después alguien comenta desde OTRA cuenta de Instagram. Los pasos están en el relevo.

- **⚠️ Por qué crear con IA no salía por HTTP, y por qué ahora sí.** La def decía «tarda minutos y /api/v1 corta a 60 s».
  Ya no es así: cada intento se acota al plazo del que llama (`hastaMs` en `chatCheapCascade`), y desde el 17/10 un intento
  dura 45 s como mucho. Por HTTP el modelo tiene 40 s (`PLAZO_CREAR_HTTP_MS`) y el resto queda para escribir. Si no le
  alcanza, vuelve un error SIN haber escrito nada, porque la fila nace después del modelo. Un token clásico sólo propone, y el
  «sí» corre en la app con sus 170 s.
- **⚠️ La primera medición del Cerebro decía que la API no tenía botones**: medía main, y lo de esta tanda vivía sólo en
  aut-2510. Una medición de la API se hace sobre la rama que se va a subir.

**Sin hacer:** el DM de verdad (arriba). «Probar» no simula el texto de respaldo («Escríbeme «…»») de una cuenta que rechaza
los botones. No se vio en pantalla. (Cerrados el 25/10: el texto de un WhatsApp o email en un flujo con ramas, con
`cambiar_texto_mensaje`, y la pregunta de crear con IA por HTTP, que vuelve con `faltan`.)

Vive en: lib/flujo-ia.ts · lib/simulador-grafo.ts · app/automations/PanelProbar.tsx · app/automations/SimuladorSocial.tsx ·
lib/automatizaciones-del-lead-reglas.ts · app/crm/automatizacion-lead.ts · lib/botones-api.ts · lib/api-mako/areas/chatbot.*.ts ·
tests/editar-ia-botones · probar-botones · ficha-espera-toque · api-mako-botones.

## ⚠️ Cambiar el texto de un mensaje dejaba sus VARIANTES del texto viejo, y el motor las sorteaba (25/10/2026)

**El síntoma (encontrado al cerrar el texto por la API, no en un cliente):** las variantes («↻ N», lib/secuencias-variantes.ts)
son otras formas de decir UN texto, y el motor sortea entre el cuerpo y ellas (`textoDelPaso`, lib/nutricion-canal.ts; SÓLO
el WhatsApp no oficial: un DM o un email no sortean). Si el texto cambia y las variantes quedan, a 4 de cada 5 leads les
llega lo que el mensaje ya no dice. «Probar» muestra el cuerpo nuevo, así que la prueba no lo ve.

**⚠️ El diagnóstico obvio («que el cambio mande `variantes: []`») no alcanzaba:** `setSecuenciaPasos` (lib/nutricion.ts) sólo
tomaba las que llegaban si había AL MENOS una; con `[]` volvían a ponerse las guardadas por el id del nodo. lib/guion-audio.ts
ya daba por hecho que un `[]` explícito las borraba (al pasar a voz o a archivo), y no era así: volver a texto las traía de
nuevo, y borrar la última en el editor no se guardaba.

**⚠️ Y no era sólo la API (la revisión adversarial del tren-k, el Cerebro):** el mismo hueco estaba en main por la PANTALLA y
por Editar con IA. `aplicarPartes` con un solo texto, la ➤ y el «al salir» de un mensaje único, el «Usar» del ✦
(EditorMensajeWhatsApp), el editor de Instagram y `parcheMensaje` (lib/flujo-ia.ts) cambiaban el cuerpo sin mirar las
variantes. Y la tarjeta A/B: `conRamaBCopiada` copiaba a B las de A; al cambiarle el texto a B, en 10.000 envíos el texto nuevo
salió 1.939 veces, y el juez comparaba A contra casi A. Con el `[]` honrado apareció una regresión chica: el 🗑 + «Deshacer»
volvía el texto sin sus variantes (antes el guardado las reponía).

**La regla.** En el guardado, la clave AUSENTE conserva las de antes y un `[]` EXPLÍCITO es «ya no tiene». Todo lo que cambia el
texto pasa por `variantesTrasCambio` (lib/mensaje-partes.ts): otra cosa que un texto, o un texto que CAMBIA, → `[]`; el mismo
texto no toca la clave; «Deshacer» repone las del paso de antes. La API usa la misma regla (`conCuerpo`, lib/botones-api.ts) y
lo dice. La copia de B nace sin variantes, y la firma de cada rama las cuenta (sin variantes y `[]` firman igual).
`editar_pasos_secuencia_mensajes` sigue avisando «conserva N variantes del texto viejo» en vez de soltarlas (sin hacer).

Vive en: lib/nutricion.ts (`setSecuenciaPasos`) · lib/mensaje-partes.ts (`variantesTrasCambio`) ·
app/automations/EditorMensajeWhatsApp.tsx y EditorMensajeSocial.tsx · lib/flujo-ia.ts (`parcheMensaje`) ·
lib/flujo-conversacion.ts (`conRamaBCopiada`) · lib/pruebas/tarjeta-ab.ts · lib/botones-api.ts · tests/variantes-al-cambiar-texto ·
api-mako-texto-mensaje · pruebas-tarjeta-ab.

## La tarjeta «A/B TEST»: una clase nueva con todas sus puertas (tanda A3 de las pruebas A/B, 25/10/2026)

**El pedido:** Martín, 25/10: «Lo mismo con Automations, podemos poner una tarjeta que sea "Prueba A/B"». El diseño está en
docs/diseno-pruebas-ab.md (3.1, con la crítica D). El motor de las pruebas vive en lib/pruebas/ (docs/hallazgos-pruebas.md).

**⚠️ El diseño obvio era el equivocado:** una condición del catálogo. No se puede pegar a otra condición, tiene «Si no»,
elige la primera fila que se cumple y el motor la vuelve a mirar antes de mandar. Es una clase nueva, `nodo: 'ab'`, con
`ramas_ab` (letra, porcentaje, salida). Se usó un campo aparte y no `ramas` con `pct`: así lo de la condición (sus filas,
el «Si no») no la ve, y lo que tiene que verla tiene que nombrarla.

**⚠️ La trampa más peligrosa:** `claseDe` devuelve `'mensaje'` para lo que no conoce. Antes de que la clase existiera en
todas partes, la tarjeta se guardaba y se mandaba como un WhatsApp vacío. Por eso entró todo en un commit.

**⚠️ La TRANSPARENCIA es lo que cuida a los clientes:** «Su reunión sigue en pie» → A/B → «Mañana es tu reunión». Si
`condicionDeArriba` mira sólo el padre directo, la condición no se vuelve a evaluar, y sale el recordatorio de una reunión
cancelada. Suben por la tarjeta: `condicionDeArriba` y `condicionSigueLlevando`, `minutosAntesDeReunion`, el carril
(`esHiloDelCarril`), `mensajeAnteriorDe`, `esperaAntesDe` (la ventana de Meta) y la forma: CONDITION → A/B → CONDITION
son dos pegadas.

**⚠️ Encontrado de paso, de los botones de Instagram (24/10):** al pegar una copia o llevarla a otro negocio, `conDestinos`
(lib/flujo-copia.ts) no rehacía las flechas de los botones. Quedaban apuntando a las tarjetas del ORIGINAL. Ahora sí, y las
ramas de la prueba también.

**Las puertas, revisadas una por una** (barrido de los ~84 `=== 'condicion'` / `!== 'condicion'` / `case 'condicion'`, más
los switch y las listas de clases). Qué se hizo en cada una:
- **Tratan la prueba como una bifurcación** (sus ramas se excluyen): `puertosDe`, `siguienteDe`, `contarParalelos`,
  `cruces` (con el contexto: dos ramas que se juntan no chocan), `insertarNodo` / `sinSalida` (la A toma lo que seguía),
  `borrarNodo` (borrarla es quedarse con A), `conectarPuerto` (el puerto es la letra), `necesitaHechos`,
  `ramaDeQuienContesto`, `destinoAlContestar` (por la A), `ultimoMensajeDelCamino` y `haySeguimiento` (por la A),
  `esMulti` y la tarjeta del lienzo (`grafoDeSecuencia`), `textosParaElGrupo`, y en «Probar» `correrHilo` (evento
  `ab`), `elegirComoLead` (sin escenario, la A) y `escenariosDePrueba` (uno por rama).
- **La atraviesan:** las siete del párrafo de la transparencia.
- **La rechazan:** `pasosDelEvento` (un evento de MaKo no reparte leads), `responderConGrafo` (no corre en «Si
  responde»), `validarGrafo` (una por automatización, nunca en «Si responde»), `duplicar`, `crearSuelta`, `pegarTarjetas`
  (una por automatización), `opcionesDelMas` / `opcionesSueltas` (el ＋ no ofrece una segunda) y «Duplicar» del lienzo.
- **La nombran (listas y tipos):** `ClaseNodo`, `claseDe`, `PasoGrafo.nodo`, `NODOS`, `CamposFlujo` / `camposDelFlujo`
  (la quinta puerta), `normalizar`, `esControl`, `esLineal`, `esFlujoExplicito` (sin ella, el armado de audios del
  onboarding pisaba el flujo), `NOMBRE_CONTROL`, `TITULO`, `tituloDeTarjeta`, `trozoDe`, `QueAgregar`, `MENU_MAS`,
  `ICONOS_MAS`, `nodoNuevo`, `TipoNodo`, `filaALaDerecha`, `ALTO_EDITOR_CONTROL`, `tinteDeControl`, `EditorDeNodo`, la
  ficha de la API, la descripción de la tarjeta para el lead (`automatizaciones-del-lead-reglas`), y en la IA
  `ClaseEditable`, `aIA`, `TipoTarjeta`, `TIPOS`, `NodoIA`, `nodoDe` y el armado. **Se me pasó `CLASE_DE_TIPO`** (el tipo
  de cada tarjeta de la IA a su clase, en Editar con IA): sin `prueba_ab`, «cambia este mensaje por una prueba A/B» se
  ignoraba en silencio en vez de avisar «Esa tarjeta no cambia de tipo». Ningún test lo veía; lo cazó el tsc acotado
  (`Record<TipoTarjeta, …>`). Una lista revisada a mano no reemplaza al compilador.
- **Revisadas y sin cambio** (son SÓLO de la condición: filas, «Si no», hechos, el catálogo): `esResultadoDe`,
  `resultadosDe`, `todosLosParalelos`, `elegirSalida`, `antiguedadDeEntrada`, `conectarParalelo`,
  `promoverResultados`, `condicionARespuesta`, `filasDelFlujo`, `sanearRama`, `usaContesto`, `preguntaContesto`,
  `miraLaReunion` (ya subía por todo lo que no es espera), `filasConParalelo`, `agregarRama` / `quitarRama` (la prueba
  tiene las suyas), `quitarPuerto`, `conectar`, `repartosDe`, `equipo-contesto`, `rasgosDelFlujo`, `preferirEsperas`,
  `seguimientosConNoContesto`, `seguimientoQueFalta`, `agregarTramos`, `validarIA`, `legadoAGrafo`, el motor de los
  eventos (lib/flujo-pasos.ts, lib/flujos.ts: nunca le llega) y los scripts de una vez.

**Sin hacer:** la dimensión «rama» en los gráficos del Dashboard. Métricas muestra la prueba en una franja fija arriba de la
hoja, como el aviso de Closing, y el gráfico por rama es del área del Dashboard. Tampoco se probó la tarjeta en pantalla.

## El primer mensaje de una etapa, después de contestar, cuando mueve una persona (27/10/2026)

**Vive en:** `enrolarPorEvento` y `mandarDespuesDeContestar` (lib/nutricion.ts) · tests/mover-etapa-rapido.

Leila (llamada con Martín): «está tardando muchísimo en mover una etapa». Mover a una etapa con automatización inscribía
al lead y corría la VÍA RÁPIDA adentro de la acción: MaKo escribía el mensaje y el WhatsApp no oficial dejaba el HTTP
abierto de 1 a 11 s por el tipeo, y la ficha esperaba todo eso con la ruedita. Ahora, con `ctx.persona` (lo movió una
persona desde el CRM), en qué automatizaciones entró y por qué no volvió a una se decide en el acto (el aviso de la
pantalla no cambia), y el envío más su línea en el historial salen con `after()`, con el workspace fijado y en la fila de
lo que sigue después de responder (el mismo molde que `seguirDespuesDeResponder`). Fuera de un pedido (un script) se manda
en el acto, como siempre. Si la función muere antes de mandar, la fila ya está vencida y la toma el tick.
**Regla:** lo que mueve una persona no espera un envío; el envío no cambia el «entró / no entró».

## El modal de difusión: el «formato de cada red» ya estaba, faltaba el marco (2/11/2026)

**Síntoma.** Martín: «que se vea lindo, con el formato de cada red social, como lo tenemos en Automations». El pedido apuntaba a `app/crm/AccionesLoteLeads.tsx` y `app/crm/seleccion-difusion.ts`.

**El diagnóstico obvio era el equivocado, dos veces.** Esos dos archivos sólo ponen la selección: el modal es `app/automations/difusion/HojaDifusion.tsx`. Y la hoja ya usaba los MISMOS editores de cada canal: reusarlos no cambiaba nada. Lo que no tenía era lo que los rodea en el lienzo: logo y nombre arriba, un panel con alto, y el chat llenándolo. Apilados en 560 px, con rótulos en mayúscula, cada editor quedaba con el chat en 110 px.

**Dónde vive y la regla.**
- **Los editores crecen solos si su padre es una columna flex con alto** (`flex: 1 1 auto`). Adentro de un `display: grid` quedan en su mínimo: el chat mide 110 px y sobra medio panel.
- **`SvcIcon` no sirve fuera de una pantalla que monte `BrandDefs`:** pinta con `<use>` de un símbolo. El CRM no lo monta, y sin él queda un cuadrado de color, sin error. Por eso la hoja usa `IconoCanal` y `LogoSocial`, que traen su dibujo.
- **La cabecera del lienzo no se copia entera:** `CabeceraWhatsApp` y `CabeceraSocialPanel` traen el desplegable de número o cuenta, y la difusión no los guarda (`MensajesDifusion`). Se vería bien y mentiría: elegir otro número no cambiaría por dónde sale.
- **Un `<style>` suelto adentro de `Modal` cuenta como un bloque:** `.mk-modal__cuerpo > * + *` le pone un filete a lo que sigue. Va adentro del único hijo.
- **Un canal a la vista, y los otros ocultos sin desmontar:** lo que quedó sin enviar en la barra de un editor se perdería al mirar otro canal.

**Cómo se miró sin levantar la app.** Una maqueta con el componente real y las actions falsas (esbuild + Chrome headless mudo), en escritorio, en oscuro y en un iframe de 390 px. Con eso aparecieron el logo liso, el chat de 110 px y el doble filete, que ningún test veía.

**Sin hacer.**
- Elegir por qué número o cuenta sale una difusión: hoy el motor usa la línea que le toca. Vive en `lib/difusion.ts` y `MensajesDifusion`.
- Sin mirar en el CRM de verdad, con datos reales: punto 11 de `docs/relevo/automations.md`.


## Black November: la rampa del número y el 9 a 21 que tapaba el horario del negocio (5/11/2026, nube)

**Síntoma.** La auditoría del 5/11 (sin correr la app) marcó dos riesgos para la campaña de Leila (negocio 11). Uno: las
secuencias mandaban hasta 40 WhatsApp por día desde el primer día; la rampa existía sólo para el email. Dos: las
automatizaciones prendidas antes del 31/10 no tienen horario y le escriben a los leads a cualquier hora.

**El diagnóstico obvio del horario era el equivocado.** «Las nuevas nacen con 9 a 21, falta ponérselo a las viejas» era la
mitad. La otra: el 9 a 21 que MaKo guarda en CADA automatización nueva le gana al horario del negocio
(`horarioDeLaAutomatizacion`: el propio manda). O sea que los 10 a 20 que pide Leila no le llegaban a ninguna de las nuevas, y
ponerles el 9 a 21 a las viejas habría hecho lo mismo con todas.

**Dónde vive y la regla.**
- **El 9 a 21 que pone MaKo lleva una marca, `horarioDeFabrica`** (lib/config-automatizacion.ts), y cede ante el horario del
  negocio. Uno que eligió la persona no la lleva: cambiarlo en la tuerca la saca (`configParaGuardar`), aunque elija el mismo
  9 a 21. Una marca sin horario no vive.
- **La rampa del WhatsApp es la del email**: `topeConRampa` (lib/goteo.ts) con `wa.arranqueDia` y `wa.arranqueSube`
  (lib/limites-envio.ts; 20 y 20, hasta los 40). Cuenta lo que SALIÓ (`topeDeLineaDeHoy`, lib/goteo-db.ts): un día sube sólo si
  llegó a su tope, y dos días sin mandar la reinician. Así una línea que ya venía mandando sigue en su nivel, como la difusión.
  Si la lectura falla, el tope de hoy es el del primer día (`topeDelPrimerDia`), nunca el de fábrica.
- **Lo acumulado no sale todo junto** porque el tope por hora (6) y la reserva para las entradas ya existían: la rampa achica el
  presupuesto del día, no el ritmo.
- **Las prendidas sin horario se arreglan con un script en seco** (scripts/horario-de-fabrica-prendidas.mts; el plan, puro, en
  lib/horario-de-fabrica.ts). De noche no pone nada en ese negocio: puesto fuera de 9 a 21, lo que vence ahora se quedaría
  quieto hasta la mañana. No toca las difusiones (las manda la persona a propósito) ni las que contestan al momento (un DM, un
  email), y marca el 9 a 21 de las nuevas para que siga el horario del negocio. Probado contra un Postgres 16 local: en seco
  rechaza toda escritura (transacción `read only`), `--aplicar` escribe con compare-and-set y deja el respaldo, y la segunda
  corrida no hace nada.
- **Con un horario del negocio, las que contestan al momento también lo siguen**, y un DM fuera de hora espera a que abra. Era
  así antes; el script lo dice en cada una para que quien pone el horario lo sepa.
- **Tres guardas leían la línea literal** (`presupuesto`, `topeEmailDeHoy`, el `leer` del panel). Se pasaron a la forma nueva;
  lo que cuidaban lo prueban ahora tests/rampa-whatsapp.test.ts y tests/horario-de-fabrica.test.ts, ejecutando el código.

**Sin medir desde la nube:** cuántas automatizaciones prendidas tiene cada negocio sin horario, y si la línea de Leila ya llega
a sus 40 por día (si no, el día del lanzamiento arranca en 20). Lo mide el script en seco, desde la PC.

**Regla:** un valor de fábrica que se GUARDA en la fila tiene que poder ceder. Sin una marca, se lee igual que una decisión de
la persona y tapa la configuración de más arriba.

## La tarjeta Pagos: leer un comprobante y emitir un recibo, sin una clase nueva (5/11/2026, nube)

**El pedido:** Martín: «una tarjeta nueva de automations que sea un lector de comprobantes de pago [...] una tarjeta que se llame
pagos [...] para leer comprobantes que vienen como para emitir factura y [...] varios templates de factura». El encargo, en
docs/relevo/pagos-automations-encargo.md; lo que le toca al Cerebro, en docs/relevo/nube-recibos.md.

**Dos tarjetas, no una, y no una clase nueva.** Una tarjeta es algo que OCURRE: leer y emitir son dos cosas, y cada una es su
tarjeta en el grupo del CRM del ＋ (PAYMENT PROOF y RECEIPT). Las dos son la ⚡ Acción de una operación de la API
(`leer_comprobante`, `emitir_recibo`) dibujada como lo que hace, como la etiqueta y «MaKo en WhatsApp»
(`esLeerComprobante`, `esEmitirRecibo`, lib/flujo-conversacion.ts). **⚠️ El diseño obvio era el caro:** una clase nueva
(`nodo: 'pagos'`) son ~25 archivos (la de A/B, arriba); una acción dibujada son cuatro lugares (`MENU_MAS`, `nodoNuevo`, `TITULO`
y el panel) y hereda el motor, «Probar», la copia, el registro de la API y Crear con IA.

**Nada por detrás.** La tarjeta que lee NUNCA marca nada cobrado: guarda la lectura y lo que sigue lo decide la CONDITION «Su
comprobante» (lib/condiciones-catalogo.ts, fuente `comprobante`). Lo que decide «cubre» es el CÓDIGO
(lib/comprobante-reglas.ts): sólo una lectura con monto, moneda, fecha y N.º de operación, sin dudas del modelo, en la MISMA
moneda que la cuota y por lo que tocaba. «De más», «otra moneda» y «sin cuota» van a una persona como «hay que revisarlo». Un
monto que llega como texto con coma («1.234,56») no se adivina. Un N.º de operación cuenta una vez: lo frena un índice único
de la base (mig 0400, `operacion_unica`), no una lectura previa.

**⚠️ Una foto no abre la rama de «Si responde».** Al motor sólo le llegan el texto y el audio de un lead
(lib/evolution-mensajes.ts). Por eso el disparador es un CRON nuevo de «Pagos» («Llega un comprobante»), que sale con
cualquier foto o PDF de un lead (nunca de un grupo ni nuestro), y las dos tarjetas no se ofrecen debajo de «Si responde».
Instagram y Messenger no guardan la URL de un adjunto (`ig_mensajes.adjuntos` trae sólo el tipo): el lector es de WhatsApp.

**⚠️ La plantilla nace con «Cada vez».** Un lead entra una vez a cada automatización; el que paga todos los meses manda un
comprobante cada mes. Las plantillas de la galería pueden declarar su `reentrada` (`filaDePlantilla`, lib/plantilla-crear.ts).

**⚠️ El techo de Groq ya no tenía aire.** El evento y la condición nuevos sumaron ~10 tokens y «Crear con IA» con todo en el
tope pasó de 3.996 a 4.004 (techo: 4.000); editar con el CRON estaba a UN token del borde. Se pagó con el encabezado
«DISPARADORES:» a secas (el «(clave y qué lo dispara)» repetía la regla 10 del system) y dos rótulos más cortos del bloque de
condiciones. Quedó en 3.998: lo próximo que se sume al CRON o al catálogo de condiciones paga otra cosa.

**⚠️ Y una plantilla nueva también cobra en el turno de WhatsApp.** Su id entra al `enum` de
`crear_automatizacion_desde_plantilla` (`IDS_PLANTILLAS`), que va antes del CRON en «salga todos los martes a las 15»: las dos
de esta tarjeta (+39 caracteres) bajaron el margen de `cambiar_crons_secuencia` de 318 a 279, debajo del piso de 300
(tests/ops-center-bateria.test.ts, el 4). Se pagó con la última frase de esa descripción, que repetía su parámetro: margen 336.

**⚠️ Dos listas de tablas con nombres parecidos.** `TABLAS_DE_INQUILINO` (lib/tablas-de-inquilino.ts) es lo que se VACÍA al
resetear un negocio; `TENANT_TABLES` (lib/workspace.ts) es lo que `getTenantDb` SCOPEA. La primera tanda sumó la tabla sólo a la
primera: el insert salía sin `workspace_id`, sin un error de tipos. Una tabla nueva de un negocio va en las dos.

**Probado rompiéndolo:** 15 roturas en tests/comprobantes.test.ts, 13 en tests/recibos-negocio.test.ts y 4 en
scripts/probar-0399-0400-pglite.mjs. Una dio VERDE en la primera versión: «copia al grupo antes de mandar» se comparaba con
`indexOf`, que da -1 si la copia no está (la trampa ya escrita en AGENTS.md).

**Sin hacer:** marcar la cuota cobrada desde el flujo cuando el comprobante «cubre» (hoy le avisa al equipo y lo marca una
persona); el recibo de un pago marcado A MANO no tiene un CRON propio (se emite con la tarjeta en otro flujo o por el chat);
la línea de WhatsApp por la que sale el recibo es la de por defecto, no la de la automatización.
