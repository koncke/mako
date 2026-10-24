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
