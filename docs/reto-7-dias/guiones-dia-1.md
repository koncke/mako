# Reto de 7 días: los guiones del DÍA 1 (borrador del 17/11/2026, para el feedback de Martín)

Lo pidió Martín el 17/11: «primero haz lo del primer día, lo de oferta y lo de funnel… el resto de días yo te voy dando feedback». Lo escribió la corrida `wf_15437be0-9c1` (leer el método de los VSL cortos, el reto de la maqueta y el curso de Sofía Contreras → escribir → un crítico que corrige). Los días 2 a 7 NO están.

**Cómo se lee:** «Dice» es el texto exacto de la voz (con «Máko» con tilde para que la voz lo pronuncie; en pantalla sale «MaKo»). «Muestra» es lo que se ve. Duración = palabras ÷ 3,2 + 0,38 s (scripts/tutorial-animado/beats.mjs:9).

## Resumen

Día 1: 4 videos que ve todo el mundo (V1 a V4) y un molde para los 11 opcionales (V5 a V15). Los opcionales salen sólo si la persona eligió esa cosa en «¿Qué te gustaría que MaKo resuelva primero?» (cuerpo.html:1496-1511). Los días 2 a 7 y los «Cómo funciona {pestaña}» no van.

Duración por palabras, a 3,2 palabras/s + 0,38 s de cola (beats.mjs:9):
- V1, bienvenida: 72 palabras, ~23 s de voz. A cámara, con el arranque, queda cerca de los 28 s que pidió Martín (audio-12.33.22.txt:1).
- V2, recorrido: 139 palabras, ~44 s de voz, más lo que la persona tarde en las 10 pausas.
- V3, Offer Coach: 170 palabras, ~54 s.
- V4, Funnel Coach: 128 palabras, ~40 s.
- Los cuatro suman unos 2:40. Cada opcional tiene de 34 a 41 palabras (11 a 13 s), y los 11 juntos, unos 2:12.
- Antes de entregar, cada audio se transcribe y se compara con el guion (chequear-guion.mjs; duracion-por-palabras.md:19).

Cómo se graban:
- V1: Martín a cámara, a pantalla completa, sin efectos (onboarding-16-11-decisiones.md:22, 40).
- V2 y V5 a V15: su video chico en el chat, mientras la app marca en vivo cada pausa (cuerpo.html:1269-1271).
- V3 y V4: se propone su cara a un lado y el texto animado al otro (`side`), con las pantallas del motor (emph, icon, bg:'blue', big y type:'app', engine.js). Siguen la estructura del VSL corto: gancho, idea, ejemplo, objeción, solución y cierre (crm.md:37). Son unas 5,6 palabras por pantalla.
- «Dice» es el texto exacto de la voz, con «Máko» con tilde (en pantalla sale «MaKo», beats.mjs:22) y los números en letras.
- Si algo va animado, los pasos son voz.mjs tts → chequear-guion.mjs → voz.mjs alinear → beats.mjs → capturar-app.cjs → render.cjs (LEEME.md:16-28).

Tres trampas del motor que tocan estos guiones:
- type:'app' dibuja una sola captura (app-ops.png), con un recuadro fijo sobre Second Brain (engine.js:28, 201-221). Para el chat de cada coach, el CRM y cada pestaña hace falta una captura y un recuadro por pantalla.
- Sólo hay 2 íconos precargados, brain y message-circle (engine.js:26-27). Hay que sumar percent, trophy, shield-check, dumbbell, hourglass y link a icons/ y a esa lista.
- `side` y `flow` existen sólo en vsl-julio/kinetic-full.js.

Para cosechar en docs/hallazgos-video-pipeline.md §17:
- Esas tres trampas.
- En el borrador se colaron frases casi calcadas de los cursos (Sofía en MH-090 ¶20, MH-092 ¶9 y MH-061 ¶11; ATV con los «seis caminos a oscuras», ¶5) y quedaron reescritas. La regla que queda: se toma la idea y el ejemplo se arma con MaKo.
- Martín no entendió el mensaje «tu reto ya tiene los días de tu funnel» (audio:1). Por eso ningún video lo dice.

## V1 · Bienvenida a MaKo

- **Dónde:** A pantalla completa, al tocar «Listo, entrar a MaKo», después de la criatura y en el modo claro u oscuro de la persona. Sale una sola vez y no se puede adelantar. Al terminar aparece «Entrar a MaKo» (cuerpo.html:1485-1486; onboarding-16-11-decisiones.md:22, 33, 40).
- **Para qué:** Que la persona sienta que la cuidan, sepa que existe el reto y entre con ganas de exprimir la app. También vende a Martín (audio-12.33.22.txt:1). Acción final: tocar «Entrar a MaKo».
- **Largo:** 72 palabras, ~23 s

| # | Dice | Muestra |
|---|---|---|
| 1 | ¡Hola! Soy Martín, el creador de Máko. | Martín a cámara, a pantalla completa, sobre un fondo que sirva en claro y en oscuro. Sin efectos ni música. El subtítulo lo pone el reproductor, como el `sub` de la maqueta (cuerpo.html:1262-1267). |
| 2 | Muchas gracias por sumarte. | El mismo plano. |
| 3 | Ya activaste tu prueba gratuita de siete días. | El mismo plano. |
| 4 | Y no quiero que sea como tantas otras | El mismo plano. |
| 5 | que activaste y no aprovechaste. | El mismo plano. |
| 6 | Por eso creé un reto de siete días: | El mismo plano. |
| 7 | para que le saques el máximo provecho a Máko. | El mismo plano. |
| 8 | Quiero que exprimas esta aplicación. | El mismo plano. |
| 9 | Cada día, un paso, con un video mío. | El mismo plano. |
| 10 | Ahora Máko te muestra todo por dentro. | El mismo plano. |
| 11 | ¡Nos vemos adentro! | El mismo plano. Al terminar entra el botón «Entrar a MaKo» (onboarding-16-11-decisiones.md:33). |

**De dónde sale:** Son las palabras de Martín en el audio del 16/11: la prueba que no se aprovecha, el reto para sacarle el máximo provecho, «quiero que exprimas esta aplicación» y «MaKo te muestra todo por dentro» (audio-12.33.22.txt:1). Van sobre el guion de la maqueta (cuerpo.html:1262-1267). A «exprimas» se le sacó «en esos 7 días» para no decir «siete días» por tercera vez. «Cada día, un paso, con un video mío» es la tarjeta del reto (cuerpo.html:1279). De Sofía no lleva nada, a propósito: su idea de mitad ver y mitad hacer (MH-061 ¶11) quedaba casi calcada. Su «si estás aquí es porque viste un video» (MH-062 ¶1-2) tampoco sirve: también se llega por recomendación o por Google (cuerpo.html:981).

## V2 · Tu recorrido por MaKo

- **Dónde:** En el chat de Onboarding, enseguida de V1, con el mensaje «Te doy la bienvenida a tu Ops Center, {n}. Dale play: te muestro dónde está cada cosa.» (cuerpo.html:858, 1489-1492). El video se para en 10 pausas. Dos piden clic, y el video sigue recién después del clic (cuerpo.html:1269-1271).
- **Para qué:** Que sepa dónde está cada cosa y deje de preguntarse qué hacer con todo. Vende la app (audio-12.33.22.txt:1). Acción final: elegir en el recuadro de arriba «Seguir con el reto de 7 días de MaKo» o «Muéstrame {pestaña}» (cuerpo.html:1497-1503).
- **Largo:** 139 palabras, ~44 s

| # | Dice | Muestra |
|---|---|---|
| 1 | ¡Hola de nuevo! Te muestro dónde está cada cosa. | El video chico de Martín en el chat de Onboarding. La app, en el Ops Center, sin nada marcado (cuerpo.html:1274). |
| 2 | A la izquierda están tus chats: cada uno, un experto que trabaja para ti. | Pausa: velo oscuro, con la lista de chats marcada (`sb-chats`), la tarjeta «Tus chats» y «Siguiente» (cuerpo.html:1275). |
| 3 | El primero es el Ops Center: es Máko. Le pides lo que necesites y lo reparte. | Pausa: marcado `sb-ops`, con la tarjeta «Ops Center» (cuerpo.html:1276). |
| 4 | Offer Coach arma tu oferta contigo, inspirado en Alex Hormozi y otros referentes. | Pausa: marcado `sb-offer`, con la tarjeta «Offer Coach» (cuerpo.html:1277). Reemplaza el subtítulo viejo, «con el método de Alex Hormozi». |
| 5 | Funnel Coach te ayuda a elegir tu sistema de adquisición de clientes. | Pausa: marcado `sb-funnel`, con la tarjeta «Funnel Coach» (cuerpo.html:1278). |
| 6 | Y te llega tu reto de siete días. Puedes adelantar días cuando quieras. | Pausa: entra la tarjeta del reto, marcada (`sb-reto`, cuerpo.html:1279). T_RETO cae en la palabra «reto», la número 69, a unos 21 s a 3,2 palabras/s, y no a los 30 s de cuerpo.html:1272. Se ajusta con la alineación. |
| 7 | Este es tu panel: tus ventas, tu marketing y todo lo que creas. | Pausa: entra la barra «Tu panel», marcada (`nav`), y queda para siempre (cuerpo.html:1280; onboarding-16-11-decisiones.md:42). |
| 8 | Toca Second Brain: es todo lo que Máko sabe de tu negocio. | Pausa con clic: marcado `sb-second-brain`, con «Haz clic en Second Brain». El video sigue recién después del clic (cuerpo.html:1281). |
| 9 | Por ahora, esto es lo que sé de ti. A medida que te conozco, voy armando tu Second Brain automáticamente. | Pausa: adentro del Second Brain, con el grafo marcado (`sb-grafo`) y la tarjeta «Lo que MaKo sabe de ti» (cuerpo.html:1282). |
| 10 | Para volver, toca Ops Center. | Pausa con clic: marcado `nav-ops`, con «Haz clic en Ops Center» (cuerpo.html:1283). |
| 11 | ¿Una duda? Escríbele a Máko aquí. | Pausa: marcada la caja para escribir (`sb-escribir`, cuerpo.html:1284). |
| 12 | Y ahora, elige arriba cómo seguimos. | Sin marca. Arriba del chat aparece el recuadro con «Seguir con el reto de 7 días de MaKo» y «Muéstrame {pestaña}» (cuerpo.html:1497-1503). |

**De dónde sale:** Las 10 pausas, lo que marca cada una y sus tarjetas son las de la maqueta (cuerpo.html:1273-1285). Varias frases son de Martín (audio-12.33.22.txt:1; onboarding-16-11-decisiones.md:42-43):
- «Tu panel», con «tus ventas, tu marketing y todo lo que creas».
- Las dos frases del Second Brain. Las dice él mismo en el video: en el audio aclara «yo voy diciendo».
Offer Coach va «inspirado en Alex Hormozi y otros referentes» (:44), y así se corrige el subtítulo viejo. Vende la app, como pidió Martín (audio:1): cada chat es un experto y el panel junta todo. Del método: frases cortas, «aquí» y ninguna palabra repetida dentro del video (_voz-martin.md:10, 17). El cierre manda al recuadro, porque la persona puede elegir el reto o lo que pidió primero (cuerpo.html:859).

## V3 · Bienvenida a Offer Coach

- **Dónde:** Al tocar «Abrir Offer Coach». La pantalla se oscurece, el coach escribe y manda el video con «Antes de empezar, mira este video corto: te cuento cómo trabaja Offer Coach.» (cuerpo.html:881, 1515-1521; onboarding-16-11-decisiones.md:31). Corre solo, sin pausas. Enseguida el coach se presenta (cuerpo.html:882).
- **Para qué:** Es la «pequeña introducción de la importancia de la oferta» que pidió Martín (audio-12.33.22.txt:1). Cuenta por qué la oferta va primero, qué es y qué la hace valer, con empatía para el miedo a cobrar caro (onboarding-16-11-decisiones.md:35). Además, que la persona confíe en un coach que pregunta y frena. Acción final: contestar «¿Tienes algo escrito de tu oferta?» con «Subir un archivo» o «No tengo, pregúntame» (cuerpo.html:1523).
- **Largo:** 170 palabras, ~54 s

| # | Dice | Muestra |
|---|---|---|
| 1 | Si tu oferta no convence, | Formato propuesto: Martín a un lado y el texto al otro (`side`). Hoy sólo existe en vsl-julio/kinetic-full.js: hay que pasarlo a engine.js. emph ['oferta']. |
| 2 | ningún anuncio la salva. | Golpe: bg:'blue'. |
| 3 | Por eso la armamos primero. | emph ['primero']. |
| 4 | Y no hablo de un descuento: | icon 'percent.svg' (nuevo); emph ['descuento']. |
| 5 | hablo de todo lo que entregas. | emph ['entregas']. |
| 6 | Tu cliente no compra doce sesiones. | emph ['doce','sesiones']. |
| 7 | Lo que compra es facturar el doble. | big; emph ['doble']. |
| 8 | Para decidir, mide cuatro cosas: | emph ['cuatro']. |
| 9 | qué tan grande es lo que logra, | Ráfaga de íconos, uno por cosa (_voz-martin.md:45): icon 'trophy.svg' (nuevo); emph ['grande']. |
| 10 | cuánta certeza tiene de conseguirlo, | icon 'shield-check.svg' (nuevo); emph ['certeza']. |
| 11 | cuánto esfuerzo le pide | icon 'dumbbell.svg' (nuevo); emph ['esfuerzo']. |
| 12 | y cuánto tiene que esperar. | icon 'hourglass.svg' (nuevo); emph ['esperar']. |
| 13 | Mismo objetivo, dos ofertas. | Sólo texto. |
| 14 | Un curso grabado: | Sólo texto. |
| 15 | todo depende de ti y tardas meses. | emph ['meses']. |
| 16 | Un acompañamiento con casos como el tuyo: | emph ['casos']. |
| 17 | ves avances en treinta días. | big; emph ['treinta','días']. |
| 18 | El objetivo es el mismo. El valor, no. | Golpe: bg:'blue'. |
| 19 | ¿Sientes caro tu precio? | emph ['caro']. Con `side`, Martín a cámara. |
| 20 | Nadie te paga por tus horas. | emph ['horas']. |
| 21 | Te pagan la seguridad de llegar al resultado. | Golpe: bg:'blue'. |
| 22 | Para eso está Offer Coach, | type:'app': el chat de Offer Coach con la caricatura de Hormozi (cuerpo.html:947), con su propia captura y su propio recuadro. |
| 23 | inspirado en Alex Hormozi y otros referentes. | type:'app', marcado el encabezado del coach: «Inspirado en Alex Hormozi y otros referentes» (cuerpo.html:2334). |
| 24 | Te pregunta una cosa a la vez | type:'app', marcada una pregunta del recuadro de arriba del chat (cuerpo.html:1101-1109). |
| 25 | y, si algo no conviene, te frena. | type:'app', marcado uno de los mensajes de advertencia destacados (onboarding-16-11-decisiones.md:44). |
| 26 | Al final te deja tu oferta armada, | type:'app': el mensaje del diagnóstico, con la nota (cuerpo.html:951). |
| 27 | con su nota y su PDF, | type:'app', marcado «Descargar PDF». |
| 28 | y guardada en tu Second Brain. | icon 'brain.svg' (ya precargado, engine.js:26); emph ['Second','Brain']. |
| 29 | ¿Tienes algo escrito? Súbelo. | type:'app': el recuadro «¿Tienes algo escrito de tu oferta?», con «Subir un archivo» marcado (cuerpo.html:1523). |
| 30 | ¿No? Toca «No tengo, pregúntame». | type:'app', marcado «No tengo, pregúntame». |

**De dónde sale:** De Sofía Contreras (MasteryHaus), con otras palabras:
- Desarmar la palabra «oferta», que no es un descuento (MH-090 ¶1).
- El cliente compra lo que logra, no el programa (MH-090 ¶14-20). No usa su lámpara ni su serie de «no vendes X»: aquí son las doce sesiones contra facturar el doble.
- La Ecuación de Valor en cuatro preguntas: dos se suben y dos se bajan (MH-092 ¶6-13; ficha-sofia-contreras.ts:10). Es la de Hormozi, contada por ella.
- El ejemplo puntuado, con el mismo deseo y dos soluciones (MH-092 ¶20-28). Ella compara gimnasio y cirugía; aquí, curso grabado y acompañamiento.
- El miedo a cobrar caro, con empatía (onboarding-16-11-decisiones.md:35). Sale de la ficha: «Si sientes caro tu precio, falta valor o convicción» (ficha:14). Su frase sobre la certeza (MH-092 ¶9) quedó reescrita como «Te pagan la seguridad de llegar al resultado».
De Martín y de la maqueta:
- El gancho es la importancia de la oferta que pidió Martín (audio-12.33.22.txt:1).
- Que pregunte, frene y deje la nota y el PDF en un mensaje sale de cuerpo.html:1288-1292 y de onboarding-16-11-decisiones.md:35.
- «Inspirado en Alex Hormozi y otros referentes» viene de :44. En el audio, Martín lo marca como «súper importante».
- El Second Brain sale del audio: «todo se va a guardar en el second brain».

## V4 · Bienvenida a Funnel Coach

- **Dónde:** Al tocar «Abrir Funnel Coach», ya con la oferta guardada (cuerpo.html:894, 1593-1600). El coach escribe y manda el video con «Antes de elegir, mira este video corto: te cuento cómo trabaja Funnel Coach.» (cuerpo.html:896). Corre solo, sin pausas. El chat lleva la criatura del coach, no la estrella de MaKo (onboarding-16-11-decisiones.md:14).
- **Para qué:** Que entienda tres cosas: qué es un funnel, que se arma alrededor de lo que vende y que conviene empezar por uno. Además, que Funnel Coach es una charla y no una elección cerrada (onboarding-16-11-decisiones.md:24, 35). Acción final: elegir en la lista «¿Qué funnel te interesa?» o tocar «No sé, ayúdame a elegir» (cuerpo.html:926, 1604).
- **Largo:** 128 palabras, ~40 s

| # | Dice | Muestra |
|---|---|---|
| 1 | Tu oferta ya está armada. | El mismo formato que V3 (`side`); emph ['oferta']. |
| 2 | Pero una oferta que nadie ve, no vende. | Golpe: bg:'blue'. |
| 3 | Piensa en un perfil con diez links. | icon 'link.svg' (nuevo); emph ['diez','links']. |
| 4 | Quien entra no sabe qué tocar. | Sólo texto. |
| 5 | Y no toca ninguno. | emph ['ninguno']. |
| 6 | Un funnel es un solo camino: | emph ['solo','camino']. |
| 7 | desde que te ve, hasta que te paga. | `flow`: el ojo que lleva al dinero, del VSL de julio (_voz-martin.md:46). Hay que pasarlo de kinetic-full.js a engine.js. Si no se pasa, va sólo texto con emph ['paga']. |
| 8 | Y se arma alrededor de lo que vendes: | emph ['vendes']. |
| 9 | por eso empezamos por ahí. | Sólo texto. |
| 10 | Funnel Coach lo elige contigo. | type:'app': el chat de Funnel Coach con su criatura (cuerpo.html:956), con su propia captura. |
| 11 | Te pregunta, te recomienda | type:'app', marcada la lista de funnels del recuadro, sin acercar los nombres, porque la lista está sin aprobar (funnels-propuesta.md:3). |
| 12 | y, si hace falta, te cuestiona. | type:'app', marcado el mensaje «Antes de seguir, te freno» (cuerpo.html:905-916). |
| 13 | ¿Quieres probar varios? | emph ['varios']. Con `side`, Martín a cámara. |
| 14 | Déjame decirte algo: con varios a la vez, | Sólo texto. |
| 15 | no ves cuál te trae clientes. | emph ['cuál']. |
| 16 | Empieza por uno y hazlo funcionar. | Golpe: bg:'blue' y big. |
| 17 | Lo que elijas queda en tu CRM, con sus etapas. | type:'app': el CRM con las etapas de un funnel (capturar-app.cjs sobre app/crm). |
| 18 | No es una idea suelta. Es tu sistema. | Golpe: bg:'blue'. |
| 19 | ¿Cuál te interesa más? Elígelo en la lista. | type:'app': el recuadro «¿Qué funnel te interesa?» (cuerpo.html:1604). |
| 20 | ¿Dudas? | Sigue type:'app'. |
| 21 | Toca «No sé, ayúdame a elegir». | type:'app', marcado «No sé, ayúdame a elegir» (cuerpo.html:926). |

**De dónde sale:** De los cursos:
- ATV, clase «1. Introducción a Funnels» (app/conocimientos/curso-aumenta-tu-valor-y-atv-advantage.ts:2652; tx 1XjhKfvjAL-HsiNy_oRiQZUtVOCUMCPKU). Su imagen de muchos caminos sin luz es el perfil lleno de links (¶5), contra un solo camino guiado (¶6-7). Además, el funnel se construye alrededor de la oferta, y por eso va después (¶8-10). Aquí va con un ejemplo propio, el perfil con diez links, y sin sus palabras.
- «Desde que te ve, hasta que te paga» es el diagrama del ojo al dinero del VSL de julio (_voz-martin.md:46).
De la maqueta y de Martín:
- «Empieza por uno» y «queda en tu CRM» salen del guion de la maqueta (cuerpo.html:1293-1297).
- La objeción resume lo que contesta el coach cuando eligen varios (cuerpo.html:905-918).
- «¿Cuál te interesa más?» son palabras de Martín sobre el coach (onboarding-16-11-decisiones.md:24).
- «Con sus etapas» es cierto: cada plantilla de funnel trae su pipeline (lib/pipeline.ts:1147-1165).
Lo que no dice:
- No nombra funnels, porque la lista está sin aprobar (funnels-propuesta.md:3).
- No dice que arma los días 4 a 6 del reto: Martín leyó ese mensaje en la maqueta y dijo que no se entendía (audio-12.33.22.txt:1).
- No toma el «sólo público caliente» de Sofía (MH-122 ¶3-5): chocaría con un coach que puede recomendar «Anuncios a WhatsApp».

## V5–V15 · Cómo se hace: {pestaña} (un molde para las 11)

- **Dónde:** En el chat de Onboarding, después de V2, sólo si la persona toca «Muéstrame {pestaña}» con algo que eligió en «¿Qué te gustaría que MaKo resuelva primero?» (hasta 3). Lo presenta el mensaje «Te muestro dónde {hacer}, en {pestaña}. Dale play.» (cuerpo.html:860, 1496-1511).
- **Para qué:** Que sepa dónde se hace lo que eligió primero y vuelva al reto. Acción final: tocar Ops Center (cuerpo.html:2809).
- **Largo:** 37 palabras, ~12 s

| # | Dice | Muestra |
|---|---|---|
| 1 | ¿Quieres {hacer}? Te muestro dónde. — {hacer} cambia según la pestaña:<br>- Marketing CoPilot: conseguir clientes con anuncios<br>- Web Generator: armar tu landing<br>- Competitor Spy: espiar a tu competencia<br>- Copywriting: armar tus guiones y carruseles<br>- AI Avatar: hacer tus videos con IA<br>- Automations: que WhatsApp e Instagram respondan solos<br>- CRM: ordenar tus ventas en el CRM<br>- Dashboard: ver tus números en un tablero<br>- Offer: armar tu oferta<br>- Classroom: armar tu curso y tu comunidad<br>- Plan: organizar tu plan | El Ops Center sin marcar y el video chico de Martín en el chat de Onboarding (cuerpo.html:2806). |
| 2 | Está en tu panel: toca {pestaña}. | Pausa con clic: velo oscuro, marcado `nav-{id}` en la barra, con «Haz clic en {pestaña}» (cuerpo.html:2807). |
| 3 | Cambia según la pestaña:<br>- Marketing CoPilot: «Aquí gestionas tus campañas, tu Instagram y tu YouTube con IA.»<br>- Web Generator: «Aquí copias la página que le funciona a tu competencia, o creas la tuya.»<br>- Competitor Spy: «Aquí ves todo lo que publica, y lo que mejor le funciona.»<br>- Copywriting: «Aquí la IA los escribe a partir de lo que ya funciona en tu nicho.»<br>- AI Avatar: «Aquí armas tu avatar, y con él haces tus videos.»<br>- Automations: «Aquí decides cómo contestan, y qué seguimiento hacen.»<br>- CRM: «Aquí ves todos tus contactos, y en qué etapa va cada uno.»<br>- Dashboard: «Aquí tienes cómo va tu negocio, de un vistazo.»<br>- Offer: «Aquí queda guardada, con su diagnóstico. Y la mejoras con Offer Coach.»<br>- Classroom: «Aquí van tus clases y tu gente, en un solo lugar.»<br>- Plan: «Aquí ves tus tareas. Y tu reto también está aquí.» | Pausa: la pestaña abierta, marcada entera (`sb-tab`), con «Siguiente» (cuerpo.html:2808). Si va animado, el recuadro late con «aquí» (engine.js:217). La maqueta no dibuja Competitor Spy, Web Generator, Copywriting ni AI Avatar (LEEME.md:124-125): para esas va la pestaña real. |
| 4 | Tu reto te espera en el Ops Center: tócalo para volver. | Pausa con clic: marcado `nav-ops` (cuerpo.html:2809). |

**De dónde sale:** Es el molde de la maqueta (guionMuestra, cuerpo.html:2802-2811), con el `hacer` y el `como` de cada opción (cuerpo.html:983-995). Están reescritos para que el gancho y la explicación no repitan palabras (_voz-martin.md:10). Plan suma «Tu reto también está en tu Plan» (cuerpo.html:877) y deja afuera «las tareas de cada uno», porque supone un equipo (memoria sin-equipo-todavia). AI Avatar no promete «sin grabarte», porque armar el avatar puede pedir una grabación (app/conocimientos/curso-cursos-heygen.ts:137). Cada uno tiene de 34 a 41 palabras, de 11 a 13 s a 3,2 palabras/s.

## Para que decida Martín

- Formato de V3 y V4: tu cara a un lado y el texto animado al otro (`side`, que hay que pasar a engine.js), sólo tu cara con subtítulos, o todo animado.
- Largo de V3 (~54 s) y V4 (~40 s), contra los ~20 s de la maqueta. Para dejarlos en ~20 s: V3 con las pantallas 1-3 y 22-30, y V4 con las 10-12 y 16-21. Así se pierde lo de Sofía.
- ¿V3 nombra a Sofía Contreras, o queda en «inspirado en Alex Hormozi y otros referentes», como el coach?
- V1 en claro y oscuro: una sola grabación con fondo neutro, o dos, una por modo.
- V2 y V5 a V15: tu cara chica en el chat con la app marcada en vivo, como en la maqueta, o animados con el motor, que hoy marca un solo recuadro fijo.
- Si algo va animado: tu clon en v4 (el 9/11 dijiste «No es mi voz», LA-CONFIG.json:17) o lo grabas tú.
- V5 a V15: ¿la misma grabación que «Cómo funciona {pestaña}», o una aparte?
