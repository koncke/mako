# El análisis de competencia con video, para los clientes (diseño, 21/11/2026)

**Estado: diseño escrito, sin programar.** Programar espera el sí de Martín a las decisiones del final.

El 21/11 el Cerebro hizo a mano, para Martín, el relevo de cientos de reels de Ramiro Cubría, Víctor Heras y otros, y lo mostró en
la página «Content Machine» (https://claude.ai/artifact/FeLyfHY62GRHbLBAJX6QUz). Este documento lleva eso a MaKo para los clientes.
De cada reel de un competidor, MaKo muestra:

- el video;
- su guion transcripto;
- su **forma**: sketch, a cámara, tutorial animado…;
- cuánto rindió contra los reels cercanos de la misma cuenta (el N×).

Todo va en una galería para elegir qué replicar.

**Decidido por Martín (21/11):** la bajada va por **Apify**, para que escale. «Si no, para los clientes vamos a tener que hacer
que ellos prácticamente tengan que descargarlo». Nada de esto depende de la PC ni de la sesión de Instagram de nadie.

---

## 1. Lo que pasa hoy en producción (leído el 21/11/2026, sólo con SELECT)

| Qué | Cómo está |
|---|---|
| Quién usa Spy | Dos espacios: el **9** (de prueba, 49 competidores) y el **11** (Leila, cliente, 5 competidores). Ningún otro cliente. |
| La clave de Apify «vencida desde el 13/11» | Es la del **espacio 9**. Su lista de reels quedó quieta el 11/11, su último guion dice «Apify rechazó tu clave de Spy» (14/11), y el cron de cada día sigue probando y no avanza. |
| Leila | **Tiene su propia clave** (cargada el 2/11) y **anda**: el último reel nuevo de sus competidores entró el 19/11 a las 21:23. Sus 616 reels tienen fecha y miniatura, y 573 tienen vistas. |
| El guion de un reel de Leila | Lo pidió **una vez**, el 16/11, y falló al **bajar** el video: «No pude bajar el video de Instagram». Apify contestó bien (si no, diría «rechazó tu clave»): lo que falló fue traer el mp4 del CDN de Instagram desde Vercel. **Causa sin confirmar.** No es el agente «MaKoBot»: el CDN se lo acepta (206). Volver a probar gastaría el crédito de Apify de Leila y escribiría en su base, así que no se probó. |

**Para los clientes no hay nada roto por la clave.** Lo que sí queda abierto es esa bajada fallida, que es justo el paso del que
depende todo este diseño (§7, riesgo 1). La primera prueba, apenas el espacio 9 tenga clave, es bajar 3 reels desde producción.

**Lo que tiene que hacer Martín con Apify** (es el dueño de la cuenta):
1. Entrar a console.apify.com → Settings → API & Integrations, y copiar el token. Un 401 no es «sin crédito», que sería un 402:
   el token que tiene MaKo ya no existe en su cuenta, porque se regeneró o porque la cuenta es otra.
2. Pegarlo en MaKo, en el espacio 9 → Integraciones → Apify (Spy).
3. El plan. Para probar en los espacios 3 y 9 alcanza el **gratis**: trae US$5 de uso por mes, que son unos 2.000 reels listados.
   Para los clientes hace falta el **Starter**. En noviembre de 2026 las fuentes no coinciden: dan entre US$19 y US$39 por mes, con
   ese mismo monto incluido en uso, así que hay que mirar apify.com/pricing el día que se contrate. Con 20 clientes de 5
   competidores cada uno, el uso es de unos US$46 la primera vez y unos US$37 por mes después (§5).

---

## 2. Lo que ya existe y se reusa

- **La lista y el N× ya están.** Spy trae los reels de cada competidor con `apify~instagram-scraper`: 300 la primera vez y 40 en
  cada refresco semanal (`lib/spy-todo.ts`, `lib/spy-todo-reglas.ts`). Los guarda en `spy_piezas` con sus vistas y su fecha, y el
  N× lo calcula `lib/multiplo-rendimiento.ts`, la única cuenta de la app.
- **El N×:** se compara contra las 20 piezas vecinas en fecha, del mismo creador y el mismo formato, con 7 como mínimo, y lo de
  menos de una semana no tiene número. El relevo a mano usó otra cuenta: la mediana de los 6 reels maduros más cercanos. Para los
  clientes va la de la app, porque Martín pidió el 5/11 que el N× sea «igual en toda la app». La diferencia queda anotada en
  `docs/hallazgos-competitors-spy.md`.
- **El video fresco** de un reel lo da el mismo ítem de Apify, en `videoUrl`. Es un enlace del CDN que **vence en días**: hay que
  bajarlo apenas llega.
- **ffmpeg ya corre en las funciones de Vercel.** La cola de montaje lo usa con `ffmpeg-static` y `maxDuration` 800
  (`app/api/cron/montaje/route.ts`). Por eso este análisis **no necesita el worker de Railway** de `docs/diseno-desarmar-video.md`:
  ese worker queda para lo que mide mal la IA (el OCR del tamaño y el color de los textos, la música separada de la voz).
- **El desarme de UN video a pedido** (`lib/video-desarmar.ts`, ticket 97) sigue como está, para el reel que la persona elige
  replicar. Lo de acá es el **barrido** de la cuenta entera, que es lo que deja elegir.
- **Dos ejes distintos, que no se mezclan:** los 19 **formatos** de Spy (tutorial, lista, storytime, POV…) dicen *qué cuenta* el
  reel. La **forma** nueva dice *cómo está hecho*, y por eso con qué herramienta de MaKo se replica:

| Forma | Con qué se replica en MaKo |
|---|---|
| Sketch entero (con IA o con actores) | AI Avatar (video con IA) |
| Gancho actuado o exagerado, y después a cámara | AI Avatar para el gancho, y la persona a cámara |
| Escena con efecto o personaje | AI Avatar |
| Tutorial o animación (pantallas, motion graphics) | El personaje en cubos, hecho por código (no gasta video con IA) |
| A cámara (selfie, escritorio, auto, estudio) | Grabarse, con la ficha de grabación |
| Pizarra o pantalla dividida con texto | Grabarse, o Image |
| Recorte de llamada, podcast o taller en vivo | Grabarse |
| Montaje de fotos o clips con texto y música | Video Editor |

La lista sale del criterio que usó el Cerebro (`C:/dev/referentes-videos/criterio-video-ia.md`), que separó así unos 380 reels de Rama y Víctor el 21/11.

---

## 3. El recorrido, todo en el servidor

Hay dos niveles, porque bajar y transcribir TODO cuesta el doble que el barrido, y la galería sirve igual (§5):

**Nivel 1, la cuenta entera (barato).** Para cada reel listado:
1. La lista con vistas, fecha, texto y portada. Ya lo hace Spy.
2. El N×. Ya lo calcula la app.
3. **La forma por portada y texto:** la IA mira una hoja de 20 portadas numeradas con sus 20 textos y devuelve forma y serie, una
   por reel, con la marca «por portada». En el texto de Rama, «Ficción 100% generada con IA» es la señal más fuerte. Lo dudoso
   queda «en duda», y nunca se inventa una forma.

**Nivel 2, a fondo (sólo los que importan).** Entran solos los reels con N× ≥ 1,5 y los 10 más nuevos de cada cuenta, hasta 40 por
cuenta. Cualquier otro entra con «Analizar este reel». Cada uno pasa por una cola en la base (el molde de `montaje_tomar`, con
`for update skip locked`), que atiende un cron cada 2 minutos:

4. **Bajar** el `videoUrl` por la puerta SSRF-segura de siempre (`bajarWebSegura`, como el guion de hoy). Si el enlace venció, se
   pide UNA publicación a Apify para tener otro fresco, que es lo que ya hace `videoDeUnaPublicacion`.
5. **Medir con ffmpeg** en la función, con dos pasadas y nunca una búsqueda por cuadro:
   - la vista previa: los primeros 35 s a 480 px, crf 30 y audio mono a 64k, que es lo que se reproduce al pasar el cursor;
   - el póster;
   - en la otra pasada: los cuadros a 2 por segundo, los cortes de escena medidos **sin franjas negras**, el piso del audio
     (percentil 5 en tramos de 50 ms) y el audio a 16 kHz para transcribir.

   Las trampas ya pagadas están en `docs/series/desarmar-video-referente.md`.
6. **Transcribir** con Whisper large-v3-turbo de Groq, con el tiempo de cada palabra. De ahí salen la primera palabra, las palabras
   por segundo y en qué segundo termina el gancho o empieza el CTA. Con las frases sueltas quedaba a ±3 s.
7. **La hoja de cuadros:** 13 del gancho, en los segundos 0, 0,5, 1, 1,5, 2,5, 3,5, 5, 7, 9, 11, 13, 15 y 18, y 11 del resto.
8. **Clasificar con IA:** la hoja, la transcripción y el texto de la publicación entran en UNA llamada, que devuelve:
   - la forma, que reemplaza a la de «por portada»;
   - el gancho: la cita y en qué segundo termina;
   - cuándo aparece la persona real;
   - el CTA: tipo, palabra y segundo;
   - la estructura en tramos con segundos.

   Las correcciones de marcas («Cloud» por Claude, «Menichat» por ManyChat, «VCL» por VSL) se aplican al MOSTRAR, nunca a lo
   guardado.
9. **Guardar** la vista previa, el póster y la hoja en el bucket privado (`archivero`, `<ws>/spy-video/<pieza>/`). El mp4 original
   no se guarda.

**Los datos:** una tabla nueva, `spy_reel_video`, de a una fila por pieza de `spy_piezas`, con el estado de la cola, los intentos,
el error y lo medido. Va a los dos registros de inquilino, `TENANT_TABLES` y `TABLAS_DE_INQUILINO`: sin el primero, cada negocio ve
lo de todos. El número de migración se lee de `main` el día que se programa, nunca de un relevo.

**Topes, para que nada se coma el cupo sin avisar:** hasta 40 a fondo por cuenta y por corrida, y el gasto de cada paso pasa por el
medidor de MaKo Tokens (`conMedidorDeMt`). Una cuenta sin saldo se frena con su cartel, nunca a medias y sin decir nada.

---

## 4. La galería (la interfaz)

La referencia es la página «Content Machine» de Martín: **la referencia manda**, y se elige mirando, no leyendo.

- Va adentro de Competitor Spy, con una grilla de reels en 9:16. Cada uno lleva su sello (N× y vistas). Uno de menos de una
  semana dice «nuevo», porque su múltiplo todavía no dice nada.
- **El reel se reproduce al pasar el cursor**, mudo, con un parlante en la miniatura. Si la persona activa el sonido, queda
  activado y se recuerda. Nunca suenan dos a la vez, y nada arranca solo. En el teléfono va un botón de play.
- **Un solo «Filtrar»**, que abre un panel combinable: cuenta, forma, con qué se replica, N× mínimo, fecha y orden. Los filtros
  activos se ven como chips con X, con «Limpiar» y con «8 de 200» siempre a la vista. En el teléfono, el panel sube desde abajo.
- Todo en **modo claro**, sin variante oscura. Los reels pueden ir sobre fondo oscuro, como una pantalla.
- Al tocar un reel se ve el video entero (el enlace a Instagram), y en pestañas cerradas el guion con sus segundos, el gancho, el
  CTA y la estructura. Abajo, fijo, «Hacer uno así», que lleva a Copywriting o a AI Avatar según la forma, con el texto de
  edición que ya arma Spy (`textoDeEdicionParaCopiar`).
- Lo que no se analizó a fondo muestra su portada (no hay video para el cursor), su forma «por portada» y «Analizar este reel» con
  lo que cuesta en MT.
- Textos en español neutro, con «tú» y neutros en género. Los botones de acción, en MAYÚSCULA.

---

## 5. Lo que cuesta relevar una cuenta

**Lo medido** (21/11/2026, con los 294 reels ya bajados de Ramiro, Víctor, Heras Media y Hormozi):
- Duración: mediana de **75 s** (p25 56 s, p75 92 s).
- El mp4 a 1080 px: mediana de 11,1 MB. **14 de 294 pasan los 25 MB**, el techo de hoy de `MAX_BYTES_VIDEO`: para el barrido hay
  que pedir la versión más chica o subir el techo.
- Palabras: mediana de 247.

ffmpeg, medido en la PC de Martín con 3 reels de 89 a 151 s a 1080 px:
- la vista previa entera a 480 px: 40 a 48 s de CPU;
- los cuadros y los cortes: 14 a 17 s de CPU.

Para un reel de 75 s con la vista previa de 35 s son unos 24 s de CPU. **La CPU de Vercel no es la de la PC**: se vuelve a medir en
la función antes de fijar el costo.

**Los precios, publicados o los de la tabla de la casa** (`lib/anthropic-usage.ts`):

| Paso, por reel | US$ | De dónde sale |
|---|---|---|
| Apify, el ítem de la lista | 0,0023 | Tienda de Apify, plan gratis (`USD_POR_PUBLICACION`; en los planes pagos, menos) |
| La forma por portada (de a 20 en una hoja) | ~0,0005 | Haiku 4.5, US$1/5 por millón: ~5.500 de entrada y ~800 de salida cada 20 |
| ffmpeg en Vercel (~24 s de CPU + 2 GB) | ~0,001 | Vercel Fluid: CPU activa US$0,128 por hora y memoria US$0,0106 por GB-hora |
| Transcribir 75 s | 0,0008 | Groq whisper-large-v3-turbo, US$0,04 por hora de audio |
| Clasificar a fondo (hoja ~1.850 tokens + guion + texto) | 0,0044 / 0,0016 | Haiku 4.5 / Gemini 2.5 Flash (US$0,30/2,50) |
| Guardar la vista previa (~1,6 MB) | ~0 | Supabase, US$0,021 por GB al mes |

**Por cuenta** (1 MT = US$0,001 de costo real, `MT_POR_USD`):

| Cómo | Con Haiku | Con Gemini Flash |
|---|---|---|
| **Recomendado:** la cuenta entera (200 reels) por portada, más 40 a fondo | **US$0,81 = ~810 MT** | US$0,63 = ~630 MT |
| Todo a fondo (200 reels) | US$1,70 = ~1.700 MT | US$1,14 = ~1.140 MT |
| Mantenerla al día por mes (~30 reels nuevos + 4 refrescos de 40) | ~US$0,57 = ~570 MT | ~US$0,47 = ~470 MT |
| «Analizar este reel», uno suelto (+2,5 MT si el enlace del video venció) | ~6 MT | ~3 MT |

Contra el cupo de cada plan (`CUPO_MENSUAL`), una cuenta con lo recomendado es:
- el **54 %** del Gratis (1.500 MT);
- el **12 %** del Essential (7.000 MT);
- el **6 %** del Pro (14.400 MT).

⚠️ Estos MT todavía no tienen fila en `COSTOS` (`lib/mako-tokens-costos.ts`). Se agregan al programarlo, con `origen: 'estimado'`
hasta que el medidor junte los reales. Nunca se escriben a ojo en la vitrina.

**Para Martín, en Apify** (la cuenta de la plataforma paga y cobra en MT): 20 clientes con 5 competidores cada uno son unos 20.000
ítems la primera vez (~US$46) y unos 16.000 por mes después (~US$37).

---

## 6. El interruptor

`lib/spy-video/revision.ts`, con el molde de `lib/onboarding-v2/revision.ts`: `PARA_TODOS = false` y `WS_REVISION = [3, 9]`.
**Nunca el espacio 1, que es un cliente.** Las pruebas van sólo en los espacios 3, 9 y 4. La galería y la cola preguntan del lado
del servidor. Prenderlo para todos es cambiar `PARA_TODOS`, y eso es decisión de Martín.

---

## 7. Lo que puede salir mal y cómo se ve

1. **Que el CDN de Instagram no le dé el video a Vercel.** Es lo que le pasó a Leila el 16/11, con un solo intento. Si se repite
   en la prueba del espacio 9, el plan B es un actor de Apify que baje el archivo y lo deje en su almacén con un enlace estable.
   Cuesta más por reel: se mide antes de elegirlo.
2. **El Groq de la plataforma es el gratis**, con tope por día de segundos de audio. Una cuenta de 40 reels a fondo son unos 50
   minutos de audio. Para clientes hace falta su plan de pago (los US$0,04 por hora de arriba). Si no, la cola queda esperando
   y lo dice; nunca cae a otra IA más cara sin avisar.
3. **Guardar copias de videos de terceros** es nuevo en Spy: hasta hoy se guardaban textos con un reloj de 30 días y miniaturas.
   Leer perfiles públicos con Apify va contra los términos de Instagram, y fue decisión de Martín (1/11). Guardar el video agrega
   un paso más, y por eso va en las decisiones.
4. **Un reel resubido con otro cartel** puede quedar con otra forma si se clasifica solo: antes de contar las formas de una cuenta,
   se juntan las transcripciones repetidas.

---

## 8. Lo que decide Martín

1. **Quién paga Apify.** Hoy cada negocio conecta SU clave de Apify en Integraciones (Leila tiene la suya). Con «todo gasta MaKo
   Tokens», lo que escala es que **pague la cuenta de Apify de la plataforma** y se cobre en MT, sin que el cliente conecte nada.
   - Si sí: Martín contrata el Starter, y la clave del cliente queda como opción, para quien quiera usar su propia cuenta.
   - Si no: cada cliente tiene que abrir su cuenta en Apify, que es justo la traba que Martín quiere sacar.
2. **Cuánto se analiza solo.** La recomendación es la cuenta entera por portada y a fondo sólo los mejores y los más nuevos (~810
   MT por cuenta).
   - «Todo a fondo» (~1.700 MT) deja ver el video de todos al pasar el cursor, pero se come la cuarta parte del Essential en una
     sola cuenta.
3. **Qué IA clasifica.** Haiku es más estable y cuesta el doble que Gemini Flash (US$0,0044 contra US$0,0016 por reel). Martín
   prefirió Claude el 11/11 por estabilidad.
   - Si Haiku: unos 170 MT más por cuenta.
   - Si Gemini: más barato, con el riesgo de lentitud del 11/11.
4. **Cuánto se guarda la vista previa.** Se propone mientras el competidor siga en Spy y como mucho 90 días; después queda la
   portada y el enlace a Instagram.
   - Si se guarda para siempre, crece el bucket y crece el riesgo del punto 3 de §7.
5. **El nombre en la app.** «Content Machine» es el nombre de la página de Martín. Para los clientes podría ser una pestaña de Spy
   («Reels») o una sección propia.

Con el sí a 1 a 4, se programa detrás del interruptor (§6) y se prueba en los espacios 3 y 9. La prueba se mira a 1440 y a 375 px,
captura por captura, con una cuenta de verdad de 200 reels, y se mide lo que costó en MT contra la tabla de §5.
