# Lo que pidió Martín el 24/10/2026 — textual

> **Para qué existe:** el 24/10 Martín pidió que sus prompts queden guardados «en cada chat, textuales, por más que
> los haga desde aquí». Esto es la copia del repo, que es la que sobrevive a un cambio de cuenta. **La próxima cuenta
> (claude5) lee esto antes de tocar nada.**
>
> Lo que está entre comillas es textual. Lo que no, es resumen y está marcado. **Cuando dudes, gana el textual.**

---

## Reglas que gobiernan código nuevo (las que no vencen)

| Regla | Textual |
|---|---|
| **No romper el diseño al agregar** | «siempre que vayas a agregar funcionalidades debes revisar que no rompa el diseño» |
| **Nombres, no identificadores** | «No me digas mas "ws9" porque yo no entiendo ID o codigos... Dime nombres.» |
| **MaKo en WhatsApp reacciona, no avisa** | «no quiero que MaKo en WhatsApp diga nada más como "En breves te contesto", basta con la reacción al mensaje y los clientes entienden que ya lo vio. A excepción de un proceso que lleve tiempo, como que le pidan el analisis de algo, o cambiar algo que lleve pensar, ahí le puede decir "Lo analizo y en breves te digo"» |
| **Nada por detrás** | Una promesa escrita que el código no cumple no es un pendiente: es la app contando algo que no hace. (Aplicado el 24/10 a la página de Partners.) |
| **Eludir no es evadir** | «Eludir no es evadir, es legal.» Sólo estructuras legales y declaradas. |

---

## El mensaje de los 20 puntos (24/10, tarde) — textual

Corrige la tabla de pendientes que le habían dado. **Los números son los suyos.**

| # | Textual | Dónde quedó |
|---|---|---|
| 1 | «Conectar Calendly. No voy a usar calendly, te dije que pongas las columnas de pricing de las ofertas» | **HECHO** · Planes, en producción |
| 2 | «Te pedí una investigación sobre que hago, quiero que investigues que me conviene para eludir impuestos... Tengo recursos en Paraguay, en Brasil, y en todo caso podría con una LLC... Investiga, yo estoy en argentina... No solo investiga tema impositivo y los cobros, sino tambien las pasarelas de pago, cual me conviene... Investiga todo.» | **HECHO** · `docs/estrategia-financiera-mako.md` |
| 3 | «"La página de venta del Sprint está pisada" no entiendo esto, como que "pisada"?» → después: «solucionalo tu... Y si no puedes, avisale a Mauricio por el grupo de MaKo diciendole lo que tiene que hacer.» | **HECHO** · avisado y Mauricio la restauró |
| 4 | «"Su cuenta de anuncios frenada por falta de pago", para esto tenemos las notificaciones de advertencia al grupo de mako» | Pendiente de verificar que el aviso salga |
| 5 | «"Código Inmobiliario manda nombre y email a Meta" no entiendo esto... Se mas explicito» → después: «sigo sin entender, cual es el problema? Eso es lo que usamos para alimetar CAPI.» | **CONTESTADO** · el problema no es CAPI (va hasheado): es que la URL de `/gracias` lleva `?name=…&email=…` en claro, y nosotros la guardamos entera en `vsl_events.landing_url` |
| 6 | «"Cliente de Diseño", simplemente quitalos... No es dificil» | **SIN HACER** |
| 7 | «"Reenviar los 6 pedidos...", para que me pedis reenviar... Si ya los conoces, hazlos» | **SIN HACER** |
| 8 | «Si no tengo instalada la app de desktop NO debe dejarme escribir nada, directamente en el chat donde está el botón de audio se debería reemplazar por "Instalar MaKo"... Y mira "USO" en Ops Center, quedo la version vieja del diseño» | **HECHO** · Ops Center, en producción |
| 9 | «En el desplegable del perfil, quiero que juntes todo en "Settings"... "Perfil" primero... Elimina la tab de "Tus cuentas de IA"... "Instalar la App" tiene que tener las 3 instalaciones... rediseñes todas esas tabs» | **A MEDIAS** · el molde y «Instalar la app» están; **falta el contenido de cada sección** |
| 10 | «"Un login en el navegador de la app" entiendo que esto es para la app desktop... Hazlo, implementalo... Y la App Desktop debería poder utilizar MaKo de manera normal, con todas las tabs... Y también debería funcionar la app en Mac y en otros, como Linux» | **SIN HACER** |
| 11 | «"codex login con tu ChatGPT" no entiendo esto, hazlo de una vez» → después: «por ahora no tengo cuenta de GPT» | **CERRADO** · rama cerrada, no es un pendiente suyo |
| 12-13 | «Si hay 33 mensajes es porque Mauricio no movió en el CRM a suficientes leads... No es un bug» → después: «eso si es un bug, el goteo debe comenzar a contar desde que se envia el primer mensaje» | **HECHO** · Automations, en producción |
| 14 | «"La venta externa de Stripe → CRM + evento de compra" Por que después? Si no comencé a vender mako aun... Implementa lo que tengas que implementar» | **REEMPLAZADO** · Stripe no existe como opción (Argentina no es país habilitado). Va Paddle/Creem + Mercado Pago |
| 15 | «"El Schedule doble en el píxel de Mauricio" no entiendo esto» → después: «soluciona esto... Es error de mako» | **HECHO** · Landings, en producción |
| 16 | «"El cartero como servicio de escritorio" Dejalo registrado para que lo siga trabajando la proxima cuenta» | **REGISTRADO** · `docs/diseno-cartero-servicio.md` |
| 17 | «"El recolector del Second Brain" Dejalo registrado» | **REGISTRADO** · `docs/diseno-second-brain-recolector.md` |
| 18 | «"La bienvenida y el panel de Partners" que es la "bienvenida"? Y mejora completamente el diseño de "Partners" eso debe verse de ventas, como una landing, esta horrible hoy» | **HECHO** · Planes, en producción |
| 19 | «"General" Dejalo registrado» | **REGISTRADO** |
| 20 | «"CRM" implementa esto, todo lo del CRM» | **EN CURSO** · 11 tandas en producción; sigue |

---

## El mensaje de los 6 puntos (24/10, noche) — textual

1. «"La página del Sprint está pisada" solucionalo tu... Y si no puedes, avisale a Mauricio por el grupo de MaKo diciendole lo que tiene que hacer.»
2. «"Código Inmobiliario manda nombre y email a Meta" sigo sin entender, cual es el problema? Eso es lo que usamos para alimetar CAPI.»
3. «"El Schedule doble" soluciona esto... Es error de mako...»
4. «"12 y 13 — tenés razón y me equivoqué al explicarlo.", eso si es un bug, el goteo debe comenzar a contar desde que se envia el primer mensaje...»
5. «"codex login", por ahora no tengo cuenta de GPT...»
6. «Con respecto a "Argentina directo (monotributo)", no puedo tener monotributo si voy a cobrar mucho, justamente el monotributo te restringe por categorias y luego ya es reesponsable inscripto... Y ademas en Argentina no podria tener Stripe?... Y el programa de 1500 no va por pasarela, ese si va por llamada de ventas y yo cobro por otros medios...»

---

## El mensaje del editor web (24/10, noche) — textual

1. «Las notificaciones de MaKo cuando pasa algo, deberían tener un botón X para cerrarlas o si las desplazo se van, porque estoy editando algo y aparecen y tengo que esperar a que se vayan para apretar el boton de atras...» → **HECHO**
2. «Hay muchas cosas mal en el editor web... Primero que los botones se superponen como ves en la captura... Luego, 2 veces el titulo, no tiene sentido... Que sea el mismo sistema de "Automations" con el chat flotando y con la flecha para atras para ver las otras landing... Pero que no me redirija, que solo se vaya para atras la sidebar del chat, tal cual como en Automations, para elegir otra... Ese "panel" principal, solo sale si un usuario no ha creado nunca ninguna landing... Revisa el chat, que esta mal en diseño y seguramente en funcionalidad, tiene que ser lo mismo que en todos lados... Y lo que estoy viendo es que no pusiste en todos lados las funcionalidades que tenemos en el chat de MaKo, haz un relevo para UNIFICAR todo, por ejemplo, en Automations o Web Generator, si le doy click derecho, no hace nada... Y ya de por si, en el lienzo de Web tambien debería funcionar el click derecho, como en otros editores que pasa lo mismo...» → **HECHO**, salvo el clic derecho (relevo escrito, sin implementar)
3. «Hay 2 topbar de edición, debería haber solo 1... La barra de "Guarado, compartir, publicar, y los 3 puntitos" deberían estar todo en una sola barra, fijate como en diseño que entre todo bien, por ejemplo pienso que "Compartir y exportar" podrían ser el mismo botón, pero fijate como lo hacen otras apps...» → **HECHO** · sin verificar en pantalla a 1280
4. «Y si le doy a "Nueva landing" cuando le doy atras en la sidebar del chat de MaKo, ahí si salta el "¿Qué vas a crear hoy?" con las plantillas...» → **HECHO**
5. «Intento analizar la pagina de Mauricio y me dice "La página respondió 403: está bloqueando la lectura automática." eso es un error nuestro, no veo por que no podriamos ver una web para analizarla... Y pasa en muchos lugares, como en Offer cuando intentamos analizar con la pagina de Mauricio...» → **HECHO** · sin probar desde la app desplegada
6. «Y en web generator, como en todas las tabs, haz que por defecto al entrar se pliegue la sidebar principal, pero no impidas que se vuelva a desplegar si el usuario le da click en desplegar.» → **HECHO**

---

## Más temprano el mismo día (resumen, no textual salvo lo entrecomillado)

- **El guardia de los grupos de WhatsApp:** «Y esta funcionando el guardia de MaKo en todos los grupos de WhatsApp para detectar bugs y errores?... Porque veo que hay muchos errores». Estaba apagado hacía tres días: lo disparaba un cron de sesión de otra cuenta. Se mudó a un cron de Vercel.
- **«Nuevo Lead»:** sacar «Vaciar»; tres botones mejor diseñados arriba del formulario, en un bloque aparte («Traer de otro funnel —que debería llamarse de otra manera mas corta—, Scraper e importar»). **HECHO.**
- **SuperAdmin:** «no deben haber 3 tabs allí, debe ser igual que el resto»; al conectar un WhatsApp «solo debería saltar el QR», no la tab vieja por detrás; «Faltan los Email aquí, para conectarlo».
- **Chats:** «Está increiblemente compleja, muchos botones... me gustaría que se parezca más al chat de MaKo. Entiendo que debe tener más cosas, pero no tan complejo.»
- **El importador:** «Los botones de abajo no pueden estar a la mitad y que abajo se sigan viendo leads, se ve horrible.» Y que traiga más datos: «si la persona tiene el nombre o incluso web o links en la descripción, podría traer más cosas».
- **Mover en lote:** «yo apreté el checkbox de la columna para moverlos a todos» y se movieron a medias. Causa real: un tope silencioso de 200 y un timeout de 60 s del server.
- **Enriquecer la base:** «Descarta completamente apify, no voy a gastar 5 usd por 200 leads cuando tengo grupos con miles, no es viable.» Sale de la extensión leyendo WhatsApp Web.
- **Second Brain:** un «recolector de información» de todos lados (Fathom, métricas de Meta, WhatsApp), «esto para todos los ws».
- **Dictar:** sacarlo de casi todos lados; en los chats, que se grabe el audio y se envíe directo. «la animación de ondas de grabando audios no sigue lo que esta escuchando... debería seguir lo que escucha, subir o bajar las ondas».
- **La ficha del lead:** «Elimina "También en Negocio que ESCALA" y rediseña el estilo de las tabs... No creo que sea el mejor diseño ese, mira como lo hacen otras apps».
- **Métricas en Automations:** «Llevar al Dashboard» dentro de los 3 puntitos; el título sin duplicar; «el botón de "analizar con MaKo" debería eliminarse completamente y tambien en el dashboard»; sin «Probar» ni «Configuraciones» mientras se ven las métricas.
- **La tarjeta de Automations:** «Te pedi que rediseñes la tarjeta, no solo que cambies el texto, se sigue viendo muy fea».
- **La PC:** «Literalmente tuve que forzar el apagado de la PC porque se trabo todo... Continua con todo, pero cuida que no se creashee». Y «Ya cerré Chrome, pushea, y cierra el resto de cosas que te interrumpan... No tengas miedo de cerrarlos» — **nunca `svchost`**.
- **El Ops Center en el teléfono:** «Intente responder esa pregunta en mobile y no funciono... Y respondi a mano, y no se envio el mensaje. Esta fallando». Causa: `AskUserQuestion` bloquea el turno. **Prohibido usarlo: se pregunta con `cartero preguntar <archivo.json>` y se termina el turno.**

---

# ⚠️ FEEDBACK DE LA NOCHE (24/10, lo último) — 24 puntos, TEXTUAL

> **Esto es lo más nuevo y lo que hay que atacar primero.** Martín mandó capturas con cada punto; las capturas están
> en el transcript del chat «Cerebro» de claude1 (`~/.claude/projects/C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main/e680c815-4e8a-...jsonl`, último turno del 24/10). Lo que está entre paréntesis es lo que se ve en ellas.

## Partners y Planes → chat «Planes»

1. «La pagina de MaKo Partners DEBE ser siempre la landing al menos que el usuario ya se haya registrado como partner, solo cuando se registre ahi aparece el dashboard... Pero mejora ampliamente la pagina de partner, hazla mas marketinera, busca referencias de como lo hacen otras apps... No me da claridad en lo que ganan, esta todo muy amontonado, no se sabe si se ganan meses o dinero... Falta algo como "Calculadora" para que calculen cuanto podrían ganar si refieren a X personas, en fin, que este muy buena esa pagina, revisa como lo hacen otros...»
2. «La sección de planes no se entiende para nada... Lo hiciste con lenguaje interno, las personas no saben que es "Ops Center" y muchas otras cosas... Tienes que VENDER, Revisa como lo hacen otras paginas... Y sobre todo el acompañamiento debe tener mas beneficios y verse diferencial, porque sino no tiene sentido. El personalizado tiene que tener un factor de PROMESA de resultados, ya no solo software.»

## Editor web → chat «Landings»

3. «Cuando le doy a "Nueva landing" NO me debe redireccionar a otra ruta... Y la sidebar no debe cambiar... Solamente debe aparecer el "¿Qué vas a crear hoy?" con los templates en lugar de la topbar de edición y el lienzo...» (captura: `/web-generator?panel=1`, con la sidebar cambiada y otra ruta. **Lo que se entregó el 24/10 no cumple esto.**)
4. «Todas las paginas de MaKo no son editables, clickeo y no se pueden editar las secciones... Eso esta mal. Deben serlo. Y eso no implica romper el diseño, en todo caso agregar funcionalidades al editor web.»
5. «Los botones se siguen superponiendo, fijate la esquina superior izquierda en el linezo... Los botones de los 3 puntos con "abrir tira de imagenes", con el botón de + y el botón para desplazar la sección, se superponen todos... Ya de por si "Abrir tira de imagenes" debería ser un botón en la topbar, y se debería abrir donde está el chat de mako. Hay un botón que dice "Editar con IA" eso eliminalo... Por defecto siempre esta el editor de IA.» (captura `/web-generator/32`: ⋮, ✨ y 📋 amontonados sobre el logo «MaKo» del lienzo.)
6. «Muchos placeholder como el de la captura se ponen por detras de otras secciones y no se llegan a leer...»
7. «Te pedí que "Compartir" y "publicar" sean un solo botón, azul y que diga "compartir"... Con el desplegable de la vista previa y las otras opciones, claro... Y mejora el diseño del pop-up de "Compartir y exportar" fijate como lo hacen otras apps, porque hay mucho texto y botones juntos, no se entiende...» (captura: siguen siendo DOS botones, «Compartir» y «Publicar ▾».)
8. «El editor de texto quedó en un scroll muy chiquito, lo que te propongo es que sea un botón el editor de texto y se abra otra topbar tipo edición de texto con todas las opciones.»
9. «Elimina "Guardado", ya que no deja ver bien el título de la pagina... Y extiende mas la sección del titulo para que se lea, ahora que ya no esta guardado...» (captura: el título se ve «Landin…» cortado.)
10. «La sidebar del chat de MaKo NO se debe poder cerrar nunca. Elimina el boton de plegar. Y mira como se bugea el placeholder del chat con un salto de linea... Tampoco pongas los botones de "toda la landing, sin titulo" pon los botones de "Discutir, editar".» (captura: «Envía un mensaje al / agente…» partido en dos renglones, y los chips «Toda la landing» / «Sin título».)

## Settings → chat «Ops Center»

11. «En settings no me gusta el diseño de "Perfil, Notificaciones, Instalar App, Equipo, Notificaciones, Identidades fiscales, Tu plan", basicamente no me gusta nada de lo que hiciste... Fijate pagina por pagina como lo hacen otras apps y esfuerzate en el diseño de cada una. En mobile tampoco se ven bien... Y en desktop es como que esta cortado a la mitad, no llega al final del ancho...» (captura `/perfil`: el contenido termina a ~2/3 del ancho. **Y «Notificaciones» aparece DOS veces en el índice.**) *Estado al 30/10: «Notificaciones» una sola vez desde el 25/10. Martín rechazó el 25/10 la versión a todo el ancho, y Settings quedó con el molde de Linear, columna centrada de 780 px (docs/hallazgos-ajustes.md). No se vuelve a todo el ancho.*

## CRM → chat «CRM»

12. «En el editor del CRM no me gusta que MaKo sea un cuadrado, cuando ya lo venimos haciendo tipo bloque flotante con cuadros un poco redondeados... Unifica ese diseño. Y aún no hiciste que se pueda editar cada cosa, por ejemplo en el bloque de "Contacto" no puedo sacar EMPRESA, y en general debes revisas que todo sea editable...» (captura: «Editar con MaKo» como panel cuadrado pegado a la izquierda; el bloque Contacto con Teléfono/Email/Empresa sin poder quitar campos.) *Estado al 30/10, según el chat CRM (commits en main; sin mirar en pantalla): HECHO en `61f3ec828` y `e007c2957`; que Fiscal, Servicio y Promesa elijan sus datos está en la rama `crm-instagram-3010`, sin subir.*
13. «En los 3 puntos de cada columna, lo primero debe ser nuevo lead. Y el editor de columnas abajo del todo, claro que eliminar siempre por ultimo. Y que no diga "Cambiar EL nombre", solo "Cambiar nombre". Y ahí pon la opción de "ordenar", y la sacas de filtros, que no este ordenamientos en el botón de filtros, sino que se pueda ordenar dentro de esos 3 puntos, y en este caso si pusiste un chip de "Respondió" se debe poder ordenar por eso... Aunque revisa porque estoy seguro que existen muchos otros posibles ordenamientos... Y en general tambien revisa el orden y los botones de los desplegables, tal vez sobran botones o estan desordenados y causan confusion.» (menú actual: Columnas / ← → / Agregar etapa · Leads / Nuevo lead · Etapa / Cambiar el nombre / Tipo de etapa / Eliminar etapa.) *Estado al 30/10, según el chat CRM (commits en main; sin mirar en pantalla): HECHO en `bd0da135e`.*
14. «En el detail del lead, que las paginas comiencen a la izquierda del todo, no alineado al nombre. Y no pongas la flechita con esas opciones, para eso ya tenemos los 3 puntos al lado de "editar", que ese desplegable de los 3 puntos tambien esta desordenado... Y llegará un punto donde "nueva hoja" ya no se vea bien, ahí si deberías poner la ultima hoja con un desplegable, algo como "Ver más" o algo así y que ahí salte el desplegable con el resto de hojas y que el botón de "nueva hoja" se meta allí.» (⋯ actual: AI Analyst / Copiar el link / Exportar CSV / Exportar PDF / Historial de la ficha / Guía de edición.) *Estado al 30/10, según el chat CRM (commits en main; sin mirar en pantalla): HECHO en `5cf31a180`.*
15. «En el editor de CRM, elimina lo de "Asignar campañas", para eso ya tenemos los 3 puntos en cada columna...» *Estado al 30/10, según el chat CRM (commits en main; sin mirar en pantalla): HECHO en `bd0da135e`.*
16. «El botón de "A revisar" no esta funcionando por CRM, cuando si debería... No debo estar en un CRM y que me traigan las notificaciones de otro.» *Estado al 30/10, según el chat CRM (commits en main; sin mirar en pantalla): HECHO en `5cf31a180`.*
17. «En "traer de otro funnel" te habia pedido que si ya lo trajo, no aparezca. Mejor que sea como en los grupos de whatsapp, que aparezca todo, pero en gris.» *Estado al 30/10, según el chat CRM (commits en main; sin mirar en pantalla): HECHO en `bd0da135e`.*
18. «La extracción en grupos de WhatsApp tarda bastante, no solo la extracción, sino también el cargar los grupos, tarda muchísimo. Hazlo más rapido, optimizalo.» *Estado al 30/10, según el chat CRM (commits en main; sin mirar en pantalla): HECHO en `a31923008` (medido antes: 33 s con 285 grupos; ahora abre al instante y la lista completa llega por detrás).*
19. «Si le doy a "Scraper" o algun boton asi, se me abre el modal nuevo, si me salgo haciendo click afuera debería tener abierto el modal anterior. Siempre todos los modales deben tener esa "navegación" interna.» *Estado al 30/10, según el chat CRM (commits en main; sin mirar en pantalla): HECHO en `002a8c31c`.*
20. «Rediseña los modales de "scraper" y "de otro funnel", se ven muy feos, mira la captura la cantidad de botones que tienen, no se entiende nada... Y también rediseña el de "importar", que tiene una estetica MUY diferente, todos tienen que compartir estetica...» (captura de «Traer de un grupo de WhatsApp»: PROSPECCIÓN / Círculo TIBIO / nombre del grupo / ← Atrás / Completar desde mi WhatsApp / Datos de empresa / Traer 131.) *Estado al 30/10, según el chat CRM (commits en main; sin mirar en pantalla): HECHO en `002a8c31c`.*
21. «Aún no funciona el buscador de Instagram... Mira que puse el usuario exacto y no me da la vista previa con la foto de perfil... Me dice "conectar meta" cuando en la cuenta de mauricio ya lo tengo conectado, no tiene sentido...» (captura «Nuevo lead» con `@leilafittipaldiok`: «Su cuenta se busca con tu Meta · Conectar Meta» aparece DOS veces.) *Estado al 30/10, según el chat CRM (commits en main; sin mirar en pantalla): A MEDIAS: `5cf31a180` sacó el «Conectar Meta» de más, pero la foto sigue sin llegar (ver M6 en docs/pendientes.md).*

## Plataforma → chat «Ops Center»

22. «Ni en la cuenta de Mauricio ni en la mia tengo instalado aun la app de escritorio de MaKo y aún así me sigue dejando enviar mensajes... No debería. En ningun chat, no solo en Ops Center...» *Estado al 30/10: HECHO el 25/10 en cada caja de MaKo (tests/app-de-escritorio-todos-los-chats.test.ts); «Editar con IA» se sumó el 30/10. Sin recorrer en pantalla con una cuenta sin computadora.*
23. «La sidebar principal en muchas tabs no funciona el botón de "desplegar" para mantenerla desplegada, eso debería funcionar siempre...» *Estado al 30/10: era una regresión del 24/10, arreglada el 25/10 (`barraFija` y `loQueGuardaLaFlecha`, app/_components/Sidebar.tsx). Sin recorrer en producción.*
24. «La investigación financiera ponme en una ruta de MaKo para leerla.» *Estado al 30/10: se lee en Strategy › «Cómo cobrar MaKo» (/admin/estrategia/cobrar), del mismo archivo `docs/estrategia-financiera-mako.md`.*

---

# La llamada con Leandro (Fathom, 24/10, 20:55 ART, 90 min) — TEXTUAL

> Martín pidió el 24/10 a las 22:23 desde el Ops Center: «Revisa mi ultima llamada de fathom, ahi hay feedback para debugear». Leída con la key de Fathom del negocio de Martín (grabación 196023930); el transcript entero quedó en el scratchpad de la sesión del Cerebro de la cuenta 5. Fathom rotula mal quién habla: se atribuyó por contenido. Lo que es texto de la pantalla leído en voz alta está marcado. Cada punto, cruzado con git el 24/10 a la noche.

## CRM

| # | Textual | Qué espera | Estado |
|---|---|---|---|
| f10 (16:21-17:01) | «Yo también ya le acabo de dar feedback de que eso, por ejemplo, se tarda mucho. Y ahora ya lo está ejecutando.» | Que traer los contactos de un grupo no tarde tanto. Ya está en manos de otra sesión: no duplicar. | en una rama |
| f11 (18:22-19:26) | «Ah, no lo vi eso, a ver, vamos a verlo. (...) te ofrece la opción de hacer una búsqueda y buscar el nombre, la página web, Instagram.» | Que la opción de completar datos se descubra sola; Leandro no la vio hasta que se la mostraron. | pendiente |
| f12 (22:00-22:56) | «En completar nombres, si no tenés instalada la extensión de Maco (...) eso es un bug (...) ese botón te debería decir instala la extensión de Maco y que ahí directamente comience.» | Sin la extensión, el botón debe avisar «instala la extensión» (y arrancar solo al instalarla); hoy completa algunos o ninguno sin decir por qué. | pendiente |
| f13 (23:00-23:27) | «Es otro feedback, el texto muy largo. No me gustan textos largos.» | Un texto corto en esa confirmación. | pendiente |
| f14 (24:52-25:55) | «Eso funciona mal, yo ahora lo voy a arreglar porque no debería volver a tocar nada, o sea, debería extraerte todo.» | Que una sola pasada complete todo, sin «vuelve a tocar para seguir». Martín quiere que salga del píxel/extensión de MaKo y no de algo «tipo Apify». OJO: los 40 por corrida y 120 por día son un tope puesto a propósito (li | pendiente |
| f15 (26:25-26:57) | «Eso es un error, ahí si apretás el botón de WhatsApp debería llevarte al chat dentro de Maco.» | Que abra el chat dentro de MaKo; hoy abre WhatsApp Web. | pendiente |

## Automations

| # | Textual | Qué espera | Estado |
|---|---|---|---|
| f16 (27:24-27:52 y 01:24:00-01:24:29) | «El nodo de Instagram todavía no tiene botones. (...) No se arregló ese todavía.» | Botones en el nodo de Instagram. Martín dice que ya mandó el feedback de los botones y la documentación; al final de la llamada sigue sin estar. | pendiente |
| f17 (29:49-30:15) | «Error número uno, que se envió tipo transcripto cuando ahí en el chat mismo se debería poder escuchar el audio. Error número dos, cuando le das a enviar audio se tiene que enviar automáticamente, no esperar a transcribirlo.» | El audio se manda al instante y se escucha en el chat. Hoy el mensaje salió muy tarde, ya transcripto. Martín: «yo me lo llevo a trabajar». | pendiente |
| f18 (30:24-30:41) | «Error número tres, es muy normal de que te pase (...) le hiciste una pregunta en la opción de editar en lugar de discutir, entonces te respondió otra cosa. Mako debería detectar si vos en realidad quisiste discutir o editar y responderte igualmente.» | Si la pregunta es de Discutir pero está en Editar, MaKo igual debe responder la pregunta y no ejecutar otra cosa. | pendiente |
| f19 (31:16-31:47) | «Maco debería poder enviar íconos o cosas así porque el ícono que te envió no es el correcto. O sí te dio bien la instrucción pero el ícono de configuraciones no es el correcto.» | Que el ícono de la respuesta sea el mismo de la pantalla, o que MaKo pueda mandar el ícono real. | pendiente |
| f20 (32:40-33:00) | «En las configuraciones solamente está el goteo en WhatsApp y en email, pero no está en Instagram. Entonces ahí yo tengo que configurarlo para que estén todas las plataformas en todos los canales.» | Goteo y tope por día también en Instagram, en todos los canales. | pendiente |
| f21 (32:50-33:00) | «No está bueno de que sean el mismo botón de on-off para email, WhatsApp, Instagram (...) que sea un solo botón para todos y listo.» | Un único interruptor para todos los canales. **Contestado por Martín el 24/10 a las 23:00 (Ops Center, pregunta a292945e):** «Uno solo: un solo interruptor de goteo (y uno de tope por día) que valga para todos los canales». | decidido · Automations |
| f22 (32:10-32:21 y 36:01-36:27) | «Una vez más (...) no me aparece ninguna configuración de Instagram en todo eso.» | Que MaKo no mande a un bloque de Instagram que no existe. Es información inventada. | pendiente |
| f23 (36:27-36:55) | «MaKo detecta que lo que le preguntó no está, que levante un ticket o que le diga al usuario no, eso no está, pero se lo voy a levantar al equipo (...) y que me levante un ticket directamente. Para eso existe la tiquetera que ya está implementada.» | MaKo avisa «eso no existe», abre un ticket en la Ticketera y no contesta con instrucciones falsas. | pendiente |
| f34 (59:33-1:00:03) | «Muchas veces la animación del muñequito de Mako, de la criatura de Mako, cuando se va para abajo y se pone en su chat, y si está la sidebar desplegada, es como que se oculta detrás y no se entiende a dónde se fue.» | Que la criatura se vea durante todo el vuelo, por delante de la sidebar. | pendiente |

## Landings

| # | Textual | Qué espera | Estado |
|---|---|---|---|
| f35 (1:00:03-1:00:30) | «Eso es un error de que vos no deberías poder cerrar el coso de Maco nunca (...) porque ahora no tenés forma de abrirlo más.» | Que el chat de MaKo no se pueda cerrar del todo, o que siempre haya forma de reabrirlo (F5 lo recupera). Dice que ya mandó la corrección. | en el tren |
| f37 (1:14:44-1:18:00) | «Marco es el mejor SaaS para ventas high ticket que te resuelve el negocio end to end, tanto en adquisición de clientes como en operación y entrega de servicio. (...) Todavía no sé la respuesta, lo tengo que seguir pensando.» | Una frase única de qué es MaKo. Leandro: «ya no está enfocada sólo en anuncios». Martín: «sí puedo hacer una landing específica y un canal de venta sólo de anuncios, eso sí lo voy a hacer». | pendiente |

## Ops Center

| # | Textual | Qué espera | Estado |
|---|---|---|---|
| f01 (02:45-03:34) | «Eso es porque todavía no compré el certificado de SSL, porque sale caro (...) como 100 dólares (...) te voy a comprar tanto para Windows como para Apple.» | Que el instalador baje y abra sin advertencias de malware: comprar la firma de código Windows y Apple. | pendiente |
| f02 (04:27-04:38 y 06:02-07:00) | «¿Cómo abro Maco? (...) No, ya la instalé. (...) Se me descargó algo, pero en la computadora no lo puedo [ver].» | Que tras instalar se vea y se abra la app; hoy no hay ventana que mostrar y el usuario no sabe cómo abrirla. Martín dice que por ahora sólo hace de enrutador a Claude. | pendiente |
| f03 (04:47-05:50) | «No, eso está mal. Ahí te debería dejar elegir otra cuenta, no solamente detectar la que ya está abierta.» | Poder loguearse con OTRA cuenta de Claude; hoy sólo detecta la que está abierta en el navegador. | pendiente |
| f04 (07:00-07:34) | «Ya estoy haciendo de que la aplicación de Maco también sea tipo desktop (...) es básicamente duplicar la aplicación en una aplicación desktop.» | La app de escritorio será MaKo entero en una ventana, no sólo el enrutador a Claude. Notificaciones y otras pestañas siguen en rediseño; Integraciones ya rediseñada. | pendiente |
| f06 (09:10-10:54) | «En algún lado por ahí se tiene que estar la opción de conectar otro número o conectar Instagram en chats.» | Que se vea cómo agregar un segundo número de WhatsApp o Instagram desde Chats; Leandro llega a «conectar un canal, QR» pero no a «otro número». | ya en producción |

## Clients (sin chat todavía)

| # | Textual | Qué espera | Estado |
|---|---|---|---|
| f25 (37:22-38:00 y 49:10-50:27) | «El curso sin nombre lo quiero eliminar. (...) ¿Existe todavía la opción de eliminar? (Martín: Eso lo tengo que poner.)» | Poder eliminar cursos y productos. Hoy no hay opción. | pendiente |
| f26 (37:40-38:46) | «Tengo que implementar el click derecho en toda la app, o sea, el click derecho casi que en toda la app se tiene que poder usar.» | Menú de clic derecho (eliminar, renombrar, etc.) en todas las listas y elementos. | pendiente |
| f27 (38:46-39:11 y 52:10-52:20 y 53:16-53:50) | «El coso de Fiesta Music no debería ser clickeable dentro de la sidebar del curso (...) y que toda la configuración de diseño se vaya al botón de personalizar. (...) La sidebar negra del Classroom, ahí no tiene que ser un desplegable. Eso es un bug.» | El nombre del producto sin desplegable ni clic; tipografía y color sólo en «Personalizar». | pendiente |
| f28 (38:00-38:46 y 52:00-52:20) | «Dentro de un producto vos podés tener varios cursos, pero eso yo lo voy a eliminar, o sea que un curso sea directamente un nuevo producto.» | Un producto = un curso. Hoy el selector de arriba y el de abajo cambian a la vez y confunde a Leandro. | pendiente |
| f29 (43:00-44:30) | «Me aparece automáticamente un programa de Fiesta (...) también me deja crear mi propio programa. (Martín: ese es el feedback que yo ya me di a mí mismo de que ahí solamente diga Fiesta Music y que no se puedan crear varios cursos.)» | Que el alumno vea sólo el curso de Fiesta Music y no pueda crear programas propios. | pendiente |
| f30 (46:47-49:05) | «Eso está mal porque tiene el nombre de la tab vieja (...) no tengo ninguna sección que diga Customer Success. (Los cursos están en Clients.)» | Que MaKo diga «Clients». El nombre viejo sigue en el contexto de MaKo: lib/api-mako/areas/curso.def.ts y cs.def.ts hablan de «Customer Success › Curso». | pendiente |
| f31 (45:00-49:05) | «MaKo, no encuentro la sección de curso. (...) Yo pensé que Clients era algo más CRM. (...) Esto va a pasar mucho.» | Que un usuario nuevo encuentre los cursos. Leandro buscó en Web Generator y Offer antes de dar con Clients, y dice que le pasará a otros. | pendiente |
| f32 (50:36-55:00) | «Voy a Fiesta Music, voy a Leandro Prueba y no me saca de ningún lado. (...) Claramente no me está pudiendo sacar de ninguno de los cursos. (Martín: Bueno, ese es un bug, yo lo voy a arreglar.)» | Que «Sacar» quite al alumno del producto y de los cursos; hoy lo saca de «curso sin nombre» pero sigue en Fiesta Music y sigue apareciendo. | pendiente |
| f33 (55:00-56:01) | «De ciberseguridad en login de alumnos no está funcionando bien. No me saca del curso, pero me saca de la comunidad. (...) Sí, eso es un bug, yo lo voy a solucionar.» | Un alumno sacado pierde el acceso a TODO igual: hoy el curso lo deja pasar y la comunidad le dice «acceso no activo» con «No autenticado». | pendiente |

## Calendario (sin chat todavía)

| # | Textual | Qué espera | Estado |
|---|---|---|---|
| f07 (12:09-16:04) | «Ese calendario todavía no está listo para feedback mío (...) ahora se ve muy como calendario de Google (...) lo tengo que personalizar un poco.» | Que ponga lo que ya existe en MaKo: llamadas de ventas, tareas del plan con deadline y, a futuro, el calendario de contenido (historias, reels) con publicación automática. Ya hay feedback dado y una sesión trabajando en  | pendiente |
| f08 (15:11-16:04) | «Que ahí aparezca el tema del chat de Maco, que ahí no aparece la estrellita (...) le tenés que poder decir che Maco, movéme la reunión, agendame tal o tal.» | Chat de MaKo disponible en el Calendario para mover y agendar reuniones, conectado al CRM. | pendiente |
| f09 (12:36-12:55) | «A ver, ahí darle a recargar porque algo está...» | Posible fallo de carga: hubo que recargar la pestaña. La frase queda cortada; no hay síntoma claro. | no es un bug |

## nadie (no es bug o es decisión)

| # | Textual | Qué espera | Estado |
|---|---|---|---|
| f05 (08:43-08:55) | «¿En qué momento se conectó mi WhatsApp? Yo no lo había conectado esto. (Martín: Sí, lo conectaste. Si no, no se conecta sola.)» | Que un WhatsApp sólo figure conectado si la persona lo conectó. Martín dice que no se conecta solo; verificar. | no es un bug |
| f24 (33:28-33:46 y 35:12-35:41) | «Acá como que envié algo y se me puso todo difuminado y me quedé solo en la pantalla. (...) Maco me está pidiendo un código.» | Martín lo da por bueno como seguridad; el síntoma (pantalla difuminada sin contexto antes de pedir el código) sólo es sospechoso, no se pidió cambiarlo. | no es un bug |
| f36 (1:02:30-1:03:05) | «Ese número de Fiesta Music también es para distribuidora (...) si meto automatizaciones, no sé si va a responder mensajes de personas de distribuidora. (Martín: ¿y si no están en el CRM, por qué respondería? No sé cómo funciona.)» | Que las automatizaciones sólo actúen sobre gente que está en el CRM y no contesten a los demás chats del número. Hay que confirmarlo, nadie en la llamada lo sabía. | no es un bug |
| f38 (1:17:00-1:21:41) | «Por ahora Maco solamente funciona en high ticket, o sea, low ticket no funciona. (...) Maco actualmente acepta low to high, pero no solamente low.» | Queda claro que MaKo no sirve para muchos productos (un supermercado, un CRM por producto) ni para low ticket puro. Sí sirve el low-to-high; los cursos se alojan como parte de una escalera. | no es un bug |

**Para preguntarle a Martín:** ~~f21~~ (contestada: uno solo para todos los canales, y uno solo de tope por día) y f14 (el tope de 40 consultas por corrida y 120 por día de «Datos de empresa» es a propósito: ¿se saca o se explica mejor?). Y f37, la frase única de qué es MaKo, que él mismo dejó abierta.
