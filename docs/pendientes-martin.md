# Pendientes de Martín — tablero vivo

**Qué es esto.** La lista única de lo que Martín pidió y todavía no está. Se actualiza **en el mismo
commit** que resuelve cada cosa: una línea que dice `HECHO` sin su commit al lado no vale.

**Por qué existe.** La noche del 1→2/11/2026 los pedidos llegaron más rápido de lo que se podían
hacer, y la cuenta se acerca a su tope semanal (corta sola al 97 %). Cuando corte, **el que siga lee
este archivo y sigue desde acá**, sin leer el chat.

**Cómo se trabaja.** De arriba hacia abajo. Cada ítem terminado se commitea y se pushea en **su
propia punta** antes de empezar el siguiente — así nada queda a medias en el disco de nadie.

⚠️ **`integracion` SE RETIRÓ el 4/11/2026.** Lo que diga «pusheá a `integracion`» en este archivo o
en un recordatorio es de antes: ahora se empuja a `punta/<nombre>`, Actions la chequea sola y la
lleva a `main` sola si da verde (`.github/workflows/punta.yml`; un push a `integracion` da una
corrida roja a propósito). Tampoco hace falta esperar: **una punta roja no frena a las demás.**

---

## ✅ YA LLEGA A MAIN — el tope de Actions se destrabó (comprobado el 7/11 ~17:00 UTC)

Este bloque decía «nada llega a main desde las 02:08 UTC» y **ya no es cierto**. Comprobado con tres
señales, no con una:

1. **Cuatro puntas entraron a main hoy**, entre las 12:42 y las 16:45:
   `carrusel-tipografia-por-texto`, `video-proporcion-y-precios`, `tablero-minutos-github` y
   `tablero-copilot-revisada`. Verificado con `git merge-base --is-ancestor` contra `origin/main`,
   no mirando el color de una corrida.
2. **`scripts/relanzar-puntas.mjs` encuentra CERO varadas.** Las 20 puntas en rojo fallaron **de
   verdad**: todas tienen un paso ejecutado que falló («Tests afectados», «Tipos», «Mezclar main en
   la punta», «Llevar a main»). La huella del tope era fallar **sin un solo paso**, y no hay ninguna así.
3. No hizo falta `--aplicar`: no había nada que relanzar.

**Lo que queda de esta entrada, y es lo que vale:** la forma de distinguir un rojo que NO es tuyo.

```
node pasos-rojos.mjs <id>     # si dice «sin paso», no es el código de nadie
```

⚠️ **Y el engaño que sigue vivo**, porque es del token y no del tope:
`scripts/minutos-actions.mjs` puede decir «Facturable REAL de GitHub: **0 min**» y **ese cero no es
«no gastamos»: es «no pude leer»**. La API devuelve 0 en vez de un error cuando el token no alcanza.
**Un cero de esa fuente nunca es un dato.**

**Las 20 rojas son trabajo de cada chat, no de la infraestructura.** Quien las dejó las arregla; acá
no se tocan.

---

## 🔓 DESTRABADO: la guardia negaba los commits por su MENSAJE, no por la RAM (6/11/2026 ~21:10)

**El diagnóstico obvio era el equivocado, y es el que está escrito varias veces más abajo en este
archivo.** Cada vez que un chat no pudo commitear y la negativa dijo «quedan 1,4 GB de RAM
disponibles y esto necesita 3», se anotó como falta de RAM. Para lo que de verdad pide memoria (el
chequeo de tipos, la suite de tests) es cierto. **Para un commit no lo era nunca: un commit no pide
RAM.** La guardia clasificaba el comando ENTERO, así que un `git commit` cuyo MENSAJE nombra `tsc`,
`npm test` o `eslint` quedaba clasificado «pesado» y lo negaba — justo cuando la máquina está
cargada, que es cuando más importa guardar el trabajo.

**Cómo se reconoce en diez segundos:** ¿el MENSAJE del commit nombra `tsc`, `npm test` o `eslint`?
Si sí, es esto y no es la RAM.

**HECHO** — la guardia arreglada ya estaba en el repo desde el 6/11 18:46 y nadie la había
instalado. Copiada a `~/.claude/guardia/memoria.mjs`, con respaldo `.antes-6-11-noche`, y verificado
ANTES de copiar que los cuatro topes son idénticos a los que corrían (3,0 / 3,0 / 1,0 / 0,6 GB):
eso era lo único que hacía peligrosa la reinstalación, porque el 29/10 una ya bajó topes en
silencio. Cosechado en `docs/hallazgos-infra.md`, en el mismo párrafo que decía que faltaba hacerlo.

**Qué destraba:** cualquier ítem de más abajo cuyo bloqueo era «no pude commitear». Lo que pide
tipos o tests sigue necesitando los 3 GB de verdad.

**Qué NO destraba, medido:** cerrar Chrome (23 procesos huérfanos, 1.530 MB) subió la RAM libre
**0,16 GB**. Los 4,1 GB se los llevan los 27 procesos de `claude`, que son los otros chats y no se
tocan. La máquina sigue en ~2 GB libres de 15,7.

**Lo que permitió en el acto:** la cosecha del chat de Tickets, horas escrita y sin commitear en
`C:devwt-tickets-0411`, quedó en `punta/tickets-tipos-sin-tiempo` — primer commit ya verde en
`main`. Enseña que **un rojo del paso «Tipos» puede no tener un solo error de tipos**: si no termina
en el tope de 840 s sale con código 97 y el registro dice «SIN TIEMPO», idéntico a un rojo real.

---

## 🛟 RESCATADO DEL LIMBO: tres decisiones de Martín que vencían el 8/11 (6/11/2026)

**Qué era esto.** En la cola del Ops Center había cinco «pedidos» por vencer. No eran avisos
pendientes: eran **respuestas que Martín ya había dado**, el 25/10, a preguntas de chats que hoy
están cerrados. A los 15 días se borran. Si vencían, nadie iba a poder reconstruir qué contestó ni
por qué, y las preguntas se habrían vuelto a hacer. El texto entero lo sacó el Runner de la base.

⚠️ **La regla que queda: una decisión que sólo vive en una cola que vence, ya está perdida.** Cuando
Martín contesta una pregunta, la respuesta se copia al repo en el momento, no cuando alguien se
acuerda.

### 1. El worker de montaje de video: **SÍ, desplegarlo** — decidido, sin hacer

Pregunta D7b del 21/10: «¿Se despliega el worker de montaje de video? Sin él, montar un video no
anda en ningún lado, ni en el chat ni en la tab». **Martín eligió la opción 0: «Sí, desplegarlo».**

El contexto que traía la pregunta: hay **un trabajo del 01/09 esperando turno hace 68.646 minutos**,
y por eso las tomas tampoco llegan al editor. Necesita un contenedor con su cuenta.

**Cómo se hace, según lo que él aceptó:** Infra lo provisiona con su cuenta y Video conecta la cola,
y **primero se mide el costo del contenedor y se le pasa el número antes de prenderlo**. Eso último
es parte de la decisión, no un agregado.

### 2. Editar un video pedido por chat: **la app de escritorio Y el servidor** — decidido, sin hacer

Pregunta D7a del 21/10: ¿el render se hace en un servidor de MaKo (lo paga MaKo) o en el editor
dentro del chat (lo paga la computadora del cliente)? **Martín no eligió ninguna de las dos: agregó
una tercera.** Textual: «Ahora que tenemos la app de MaKo desktop podríamos aprovechar para estas
cosas… Pero sí, también con servidor de MaKo».

O sea: **las dos, con la app de escritorio como el lugar natural para el render del cliente.** La
pregunta estaba mal planteada —ofrecía elegir— y la app de escritorio no existía cuando se escribió.

### 3. ✅ Avisar al activar una automatización — YA ESTÁ HECHO (verificado el 7/11)

Este bloque decía «esto no estaba en ninguna lista» y «no lo tiene nadie». **Lo tiene
`lib/ritmo-al-activar.ts`**, que cita el pedido de Martín del 25/10 textual en su cabecera y está
cableado en la pantalla (`app/automations/AvisoRitmoConfirm.tsx`, `SecuenciaPerfil.tsx`,
`SimuladorWhatsApp.tsx`, `app/api/whatsapp/secuencias/route.ts`).

Y no es un cartel genérico: **dice un HECHO, no «ojo que puede salir mucho»**. De su cabecera, que
es lo que lo hace útil:

- **WhatsApp sin goteo no son «200 de una»**: los frena el tope de la línea por hora y por día
  (`lib/limites-envio.ts`), y sale la tanda de cada hora junta. Por eso dice ese número.
- **Instagram y Messenger sin goteo SÍ salen todos juntos**, y lo dice.
- El tiempo se da como PISO («al menos»): el horario del negocio sólo lo alarga.
- **Un aviso que miente es peor que ninguno**: si el primer mensaje lo escribe la IA y queda para
  aprobar, nunca dice «sale».
- Y suma dos cosas que nadie había pedido y muerden igual: **cuántos mensajes de TODO el flujo
  quedan para aprobar**, y **los borradores viejos de OTRAS automatizaciones que van a frenar a esas
  personas** (27 borradores del 20/10 iban a frenar a 27 leads de otra automatización, en silencio).

`tests/ritmo-al-activar.test.ts` tiene **29 tests** sobre esa conducta («sin goteo, WhatsApp: no son
200 de una…», «Instagram no tiene tope de línea: todos juntos», «el primer mensaje queda para
aprobar: nunca dice sale»).

⚠️ **Lo verifiqué LEYENDO la implementación, los llamadores y los nombres de los tests: no los pude
CORRER.** La guardia de RAM los bloqueó (1,8 GB libres de los 3 que pide). Si alguien quiere el
verde, es `node --import tsx --test tests/ritmo-al-activar.test.ts`.

### 4. La captura del ws3 (Offer): ya resuelto, sin acción

«¿Volvés a abrir Chrome con la extensión?» → «Creo que esto ya se solucionó? De igual manera ya está
abierto claude in chrome». No queda nada que hacer.

**Falta el quinto**, de Landings (`c250f453`), que vence el **12/11**: «¿Hago ahora el borrador de la
frase…». El Runner lo tiene y lo pasa cuando se le pida.

---

## 🔍 LAS CINCO PUNTAS QUE ENTRARON A MAIN SIN QUE NADIE LAS MIRE — ✅ 5 de 5 revisadas (7/11)

El relevo del 6/11 las dejó pedidas: `punta/copilot-feedback` (eaec41da6), `punta/carruseles-thumbnails`
(25fbdc8a1), `punta/dashboards-edicion` (f6b9301d6), `punta/nada-por-detras` (2cb406043) y
`punta/github-minutos` (f7c2f57da).

**✅ `punta/dashboards-edicion` — REVISADA el 6/11 en producción, está bien.** Martín había preguntado
por esto («que los dashboards sean editables, sean utilizables»).
- En la computadora el editor está completo: deshacer y rehacer, **Añadir datos**, **Bloques**,
  **Añadir un gráfico**, texto, enlaces y formas, vistas por dispositivo, y **Personalización**.
  El botón alterna «Editar» / «Ver», como corresponde.
- En el teléfono el tablero se ve entero —las hojas, el gráfico de leads por día, los números de los
  últimos 30 días y las otras hojas— y **dice que editar es en la computadora**, en vez de ofrecer un
  editor que ahí no se puede usar. Es la decisión correcta y está escrita en la pantalla.
- ⚠️ **Lo que NO probé, a propósito:** que GUARDAR un cambio persista. Eso escribe en el tablero real
  de Martín en producción, y no se toca su tablero para probar. Lo prueba él, o se hace en el ws 3.

**✅ `punta/github-minutos` — HECHO y VERIFICADO el 7/11. La alarma ya no miente** (commit
`3181c4568`, en main). Este bloque describía el estado ANTERIOR al arreglo: las dos causas que
listaba como «SIN confirmar» ya están resueltas, y se comprobó leyendo el código y corriendo
los tests, no la cabecera.

| lo que decía el tablero | cómo está hoy |
|---|---|
| «los minutos incluidos están en 0 a propósito» | `incluidos` cae en **2.000** por defecto (el plan Free de `hola-mako`), `scripts/minutos-actions.mjs:268` |
| «la alarma juzga la estimación, que sobre-cuenta» | `veredicto()` da rojo **sólo** sobre el facturable REAL de GitHub; sin ese número avisa en amarillo y sale 0 (`:224-233`) |

**Y la cabecera vieja decía una cosa falsa que es la razón de que la alarma mintiera días:** que el
facturable real «el `GITHUB_TOKEN` de Actions no puede leer». Lo que no puede leer es el panel de
Settings → Billing; el facturable por workflow (`/actions/workflows/{id}/timing`) **sí**, y el repo
ya usaba ese endpoint en `scripts/tests-afectados.mjs`. Estaba a la vista.

`tests/minutos-actions.test.ts` **6/6**, y dos de ellos guardan justo esto: «el veredicto: rojo SÓLO
sobre el facturable real de GitHub; sobre la estimación, nunca» y «sin el facturable real de GitHub,
la estimación NO da rojo: avisa».

**✅ `punta/nada-por-detras` — REVISADA el 7/11, está bien hecha.** Es la que más podía doler: cambia **a qué
negocio le llega un aviso de la plataforma**. Miré lo que los tests no ven:

- **El número se guarda como TEXTO** (`datosDeLaPlataforma` devuelve `String(ws)`) y la condición compara texto.
  No está el choque clásico de `13` contra `"13"`, que habría hecho que la exclusión no se cumpliera nunca.
- **Lo pone el emisor central y no cada evento** (`emitirPorEvento`), así que no se puede olvidar al agregar uno.
- **Las dos banderas coinciden.** El código usa `ev.plataforma` para ofrecer la condición en el editor y
  `porSubtipo(evento)?.plataforma` para inyectar el dato: salen del mismo catálogo. Si no coincidieran, la
  condición aparecería en la pantalla y no se cumpliría nunca, en silencio. No pasa.
- **Usa el NÚMERO y no el nombre**, a propósito y escrito: el nombre se cambia y la condición dejaría de
  cumplirse sola.

⚠️ **Lo único que queda abierto, y es de diseño, no un error:** un valor que falta **no cumple la condición ni
negada** (`condiciones-catalogo.ts`). O sea que si algún día un evento de la plataforma se emite sin pasar por
`emitirPorEvento`, «No es el negocio número 13» no se cumple para NADIE y el aviso deja de salir, sin un error
en ningún lado. Es el lado seguro (nadie recibe lo que no es suyo), pero se pierde callado.

**El paso que me dejaron NO SE PUEDE CORRER TODAVÍA.** `docs/relevo/nube-nada-por-detras.md` pide crear la fila
de «Tareas de Reuniones al Plan» **después del deploy que trae esta tanda**. El commit es del 6/11 16:39 UTC y
el deploy del día había corrido a las 11:05: **esta tanda no está en producción**. Entra con el cron del 7/11
a las 11:05 UTC. No lo fuerzo con `desplegar-ya.mjs` porque la fila **nace pausada** y prenderla es decisión de
SuperAdmin: no hay nada que se gane por nueve horas.

Después del deploy, el comando es:

```
node --conditions react-server --import tsx scripts/mudanza-avisos-plataforma.mts \
  --env=C:/dev/mako-api/.env.local --eventos=reunion_tareas_al_plan --aplicar
```

**✅ `punta/copilot-feedback` — REVISADA el 7/11, está bien y arregló dos bugs que estaban callados.**
Marketing CoPilot decide por frases qué hacer con lo que escribe el cliente, y eso es frágil. Los dos que
había, que nadie veía porque no dan error:

- **`^s[ií]` aceptaba cualquier palabra que empiece con «si».** «Sinceramente no me convence» se leía como un
  SÍ. Ahora pide que sea la palabra entera.
- **`/no/` sin límites de palabra.** «Bueno, dale» contiene «no» adentro de *bueno*, así que se leía como «más
  tarde» en vez de como un sí. Lo mismo con «nosotros», «ninguno», «menos».

**Y lo más importante, que es hacia dónde se equivoca:** ahora todo lo dudoso **va a MaKo en vez de actuar**.
Una pregunta nunca dispara una acción, aceptar la propuesta pide un sí claro **y que la frase no tenga un «no»**
(«No sé si me sirve» ya no acepta), y «borrar todo» sólo cuenta en un mensaje corto. El lado seguro es el lado
de preguntar, y es el que eligieron.

**El test que lo cuida es del tipo bueno** (`tests/marketing-copilot-volver.test.ts`): prueba **frases reales
contra el resultado** —«No sé si me sirve» tiene que ir a MaKo— y **no fija el texto de la solución**. Si mañana
alguien reemplaza las expresiones por otra cosa, sigue en verde mientras la conducta sea la correcta. Es lo
contrario de las guardas que esta misma semana congelaron cuatro ramas por pedir que el código dijera lo mismo.

Verificado que caza el bug viejo sin correrlo: «No sé si me sirve» contiene «sirve», y el código anterior
(`/sirve|empec|ok|dale/`) lo aceptaba, así que con el código de antes ese `assert` falla.

⚠️ **El hueco que queda, y no es un error: el «Deshacer» no tiene test.** Está implementado y hace lo
que promete (`deshacerEmpezar`, `app/ads-manager/PrimeraEntrada.tsx:178`: devuelve el perfil **y** las notas
de la charla), pero es estado de React y el test de node no lo toca. Se prueba en el navegador o no se prueba.

**✅ `punta/carruseles-thumbnails` — REVISADA el 7/11, está bien.** Lo que arreglaba era un crash: el link
viejo `?ver=carruseles` —que viajó en avisos y en la API— hacía un `redirect()` **debajo del loader**, y eso
en Next va adentro del stream y tira **React #310**. Es la misma familia que el crash de Spy de esta noche:
un atajo durante el render no rompe una parte, tira la pantalla entera.

La solución es una función pura (`vistaDeImage`) con **el default del lado seguro**: cualquier `ver=` que no
conozca cae en los ejemplos, sin redirigir y sin romperse. Y queda escrito por qué vive en su propio archivo:
la página del teléfono no puede importar `ruta.ts`, que otro test trata como la puerta del motor del editor.

🔎 **Lo que encontré de paso, y NO es de esta punta** (la guarda es del 23/10, la punta sólo se apoya en ella):
`tests/redirige-antes-del-loader.test.ts` está probada rompiéndola una y otra vez —anota los conteos, «base
12 / 0», «base 14 / 0»—, que es la disciplina correcta. Pero una parte compara **fragmentos de código**
textuales entre `app/plan/layout.tsx` y `app/plan/page.tsx`.

Eso no es capricho: el layout **copia** la decisión de la página, y si se desincronizan hay un bucle de
redirección. El problema es real. Lo frágil es la forma: **si alguien lo arregla mejor** —sacando la condición
a un helper compartido, que elimina la duplicación de raíz— **la guarda se pone roja**. O sea que bloquea
justo el arreglo bueno. La pregunta que la distingue sigue siendo la misma: *¿seguiría en verde si alguien
arregla el bug de otra manera?* Acá, no.

**No lo toco en esta pasada**: cambiar una guarda que vigila diez rutas pide su propia tanda y su propia
rotura medida. Queda anotado con el archivo.

**LAS CINCO ESTÁN REVISADAS.**

---

## 📋 LA LISTA COMPLETA, BARRIDA EL 6/11/2026 → [pendientes-todo-6-11.md](pendientes-todo-6-11.md)

Martín la pidió entera («no solamente de lo que se hizo en la última sesión»). Siete agentes leyeron
en paralelo TODOS los documentos de pendientes del repo y un octavo buscó lo que nadie había leído:
**634 pendientes** — 343 abiertos, 27 trabados, 154 que lo esperan a él y 110 dudosos (de octubre,
que hay que verificar antes de tocar).

**Este archivo sigue siendo el tablero de lo que Martín pidió a mano.** El otro es el inventario.

---

## 🚨 LO PRIMERO AL ENTRAR — 3/11/2026 ~03:45, cuenta claude1 al 100 %

> ✅ **RESUELTO. Lo de abajo es del 3/11 y queda por lo que enseña, no porque siga pasando.** El
> deploy se arregló esa misma noche (`punta`/`main` verdes desde entonces) y el 6/11 producción sirve
> `cce171fab`. **Lo que sí vale para siempre:** «en main» no es «en producción» — el deploy lo hace un
> cron una vez por día (11:05 UTC), y lo urgente va con
> `node --env-file=C:/dev/mako-api/.env.local scripts/desplegar-ya.mjs`, que cuesta US$0,33-0,42.

**El deploy de Vercel NO está verde, y producción sirve código viejo sin estar caída.** Eso es lo que
tapó el problema cinco veces: nada avisa, porque la app anda.

⚠️ **Y ES LA ÚNICA RAZÓN POR LA QUE MARTÍN NO VE NADA.** Medido el 3/11 ~04:20: **todo el trabajo de
Competitors Spy ya está en `main`** —el desplegable que busca por nombre (`0aafde481`), la vista
previa del modal (`f74e6930e`), el caché compartido entre negocios (`cde75a8b6`)—, y `main` está en
`31dd88629`. Lo que falta no es código: es **un deploy que termine**. Cuando pregunte «por qué no lo
veo», la respuesta es ésta, y no hay que volver a tocar el código de Spy para arreglarlo.

1. **Mirar cómo cerró el último deploy:**
   `node --env-file=C:/dev/mako-api/.env.local scripts/ver-deploy-vercel.mjs`
   Al cortar, `1efb12f08` (03:19 UTC, ticket #45) estaba en `BUILDING` desde 16 min; los tres
   anteriores, todos de `be38d9156`, dieron `ERROR` por `ENOSPC` en «Deploying outputs...».
2. **Lo que se hizo y falta probar en un build de verdad** (commiteado, ver más abajo): la exclusión
   de `onnxruntime-node` / `onnxruntime-web` / `@huggingface/transformers` del trazado de todas las
   funciones, y el `prebuild` que borra el proveedor de CUDA (327 MB) del disco del contenedor.
   **Si el deploy sale verde, era eso.** Si vuelve a dar `ENOSPC`, lo que falta medir está en
   `docs/hallazgos-infra.md` → «Subir el tope de la función cambió el error por uno peor».
3. **Las dos comprobaciones que faltaban, hechas** (3/11 ~04:15, por API):
   - El `buildCommand` del proyecto es `null`, o sea el default de Next, **`npm run build`**: el
     `prebuild` SÍ corre. ⚠️ Si alguien lo cambia a `next build` a secas, deja de correr sin avisar.
   - `VERCEL_BUILD_SYSTEM_REPORT=1` quedó puesta (production y preview). Sin ella el reporte del
     contenedor devuelve `unknown` en «Input source code» y «Build cache», los dos números que
     faltan para saber qué llena el disco. Es diagnóstico, no cambia el build.
4. **«Activar Enhanced Builds», que sugiere el propio mensaje de Vercel, ya está hecho y superado**:
   medido el 3/11, la máquina es **`turbo`** con concurrencia elástica (era `enhanced` el 17/10).
   No es una palanca disponible: hay que bajar el peso.
5. **El corte del 99 % sigue apagado, y NO se prende todavía.** Se prende borrando
   `~/.claude/guardia/sin-corte`. Lo apagó Martín a propósito («hazlo tu, no importa el 99%»)
   **porque el deploy estaba roto, y sigue roto**: prenderlo ahora bloquearía la terminal justo
   mientras se arregla, que es el error que ya se cometió una vez esta noche. **Se prende en cuanto
   el deploy cierre en verde**, y eso hay que hacerlo a mano: nada lo prende solo.

**Tickets nuevos, leídos y SIN empezar:**
- **#46, #47 y #48 (Leila Fittipaldi, ws 11) — ✅ LOS TRES HECHOS desde el 3/11, commit `d6501deac`,
  verificado en `origin/main` el 7/11.** El tablero los tenía abiertos cuatro días de más.

  ⚠️ **Y me corrijo a mí mismo**: hace una hora escribí acá que el arreglo del #48 era pasarle `MAKO_NAV`
  a MaKo en su contexto. **Era equivocado**, y habría mandado a alguien a construir algo que ya existe.
  Lo escribí después de leer los tickets y mirar el código por mi cuenta, sin buscar antes si ya había un
  commit que los nombrara. **Un ticket no se diagnostica sin buscar primero su número en el historial.**

  **La causa real de los tres (y del #45) eran DOS cosas, no una:** la palabra que escribe la persona no era
  la del nombre de la herramienta, **y la herramienta no viajaba al turno de la app**. Lo segundo es lo que yo
  no podía ver leyendo el catálogo.

  - **#46** «paso el precio de pesos a dólares»: ahora viajan `guardar_oferta` y `guardar_producto`, que
    proponen el precio con un link para confirmarlo.
  - **#47** «el WhatsApp del diagnóstico tiene que disparar una secuencia»: `crear_automatizacion_con_ia` la
    crea con disparador por etiqueta; ahora viaja, y su descripción dice *secuencia*, *disparador* y *etiqueta*.
  - **#48** «¿dónde actualizo mis datos?»: crearon `DATOS_DEL_NEGOCIO` (`lib/secciones-negocio.ts`), que dice
    **la pantalla de cada dato con el nombre que se lee en ella**, y cuatro capacidades lo devuelven con su link.
  - Un cuarto del mismo tipo que encontraron de paso: `guardar_campo_perfil` y `guardar_oferta` mandaban a
    corregir el precio a Documentos; se corrige en «La oferta» → «El brief».

  **Los tests están probados rompiéndolos**: `mako-no-puedo-falsos` 14-17, ocho mutaciones, cada una roja.

  🔴 **Lo que NO arregla ningún commit, y sigue abierto:** el mismo dato de Leila vive en varios lugares y
  estaban desfasados. Medido el 3/11 por MaKo: el producto «LíderMente» decía **miércoles 7:30-9:30 pm** y
  **USD 49/mes**, mientras «Qué incluye» seguía en **7-9 pm** y el precio en **800 MXN/mes**. **No lo verifiqué
  hoy**: pueden estar corregidos. Son datos de ella, los corrige ella, pero la advertencia de MaKo es correcta y
  es del tipo que rompe a un cliente: si los anuncios o el WhatsApp salen con el horario viejo, alguien llega a
  las 7 y encuentra la puerta cerrada. **Hay que avisarle a Leila**, y eso lo hace Martín.
  guardia de RAM dejó la PC por debajo de 3 GB y Bash quedó bloqueado). Se leen con
  `node --import tsx scripts/tickets.ts ver 47` y `… ver 48` desde el clon.

**Subido:** `31dd88629..5fdfd90ba` a `integracion` (3/11 ~04:10). Para que entrara hubo que archivar
siete chats quietos: la PC estaba en 1,7 GB y la guardia bloquea Bash por debajo de 3. Se desarchivan
desde la barra si vuelven a tener trabajo. ⚠️ **No pushear de nuevo hasta que ese run cierre**: un
push a `integracion` cancela el anterior.

---

## 👥 QUIÉN TIENE QUÉ — repartido el 2/11/2026 ~18:30

Martín: «y ya se está trabajando sobre todo el resto que te pedí también». **No era así: miré las
17 sesiones y estaban TODAS quietas.** Así que el Cerebro repartió. Esto es el estado del reparto,
no una promesa de que esté hecho.

| Ítems | A quién | Estado del envío |
|---|---|---|
| **14** — los 10 referentes que faltan (fichas + caricaturas) | `Ops Center` (local) | entregado |
| **19** — modal de «mensaje de difusión» del CRM | `Automations` (local) | ✅ **TERMINADO** en `difusion-modal-0211` |
| los 20 dashboards | `Replicar los 20 dashboards…` (local) | entregado |
| **13** — compartir las lecturas de Spy entre negocios | `Supabase API proxy access` (nube) | entregado |
| **ticket #44** — cargar un documento al Second Brain desde el chat | `Contexto breve [1c37c8]` (nube) | entregado |
| **2** + **16** — Offer y Ads Manager adentro del Ops Center; elegir gurú en «nuevo chat» | `Metodología Ops Center…` (nube) | entregado |
| **17** + **18** — capa de Second Brain por gurú, con el curso entero | `Contexto breve [21251a]` (nube) | entregado |
| **15** — diseño de la tab de gurús + **el modal roto en prod** | `Design: Continuación del proyecto` (nube) | entregado |

⚠️ **«Entregado» significa que el mensaje llegó al buzón de esa sesión, NO que su Claude lo leyó.**
Y de las sesiones en la NUBE no vuelve nada: el canal es de ida, así que el silencio no es acuerdo.
Lo que cada una hizo se ve en su propio transcript (claude.ai/code) y, cuando commitee, en
`origin/main`.

### ⛔ Y REPARTIR NO AGREGA CUOTA — lo corrigieron las dos sesiones que contestaron

**Las 17 sesiones, locales y de la nube, corren sobre la MISMA cuenta `claude1`.** Pasarle un ítem
a otro chat no suma cuota: gasta la misma. Al 93 % eso significa que el reparto **acelera el corte
en vez de evitarlo**, y que el trabajo grande se corta a mitad de camino en otra sesión en lugar de
en ésta.

Las dos sesiones que contestaron lo vieron antes que yo y las dos se frenaron solas, con razón:

· **`Ops Center`** midió lo que cuesta una ficha: **175–285 mil tokens de subagente** cada una, o
  sea **~2,3 millones por los diez**, sin contar las imágenes. No arranca sin cuenta nueva. Su rama
  `ops-coaches-0111` quedó limpia en `652e94c22` y **atrás de main: no usarla de base.**
· **`Replicar los 20 dashboards`** va **5 de 20** —General, Comercial, Cobranza, Landing y Focus,
  en dos variantes (Pane y Lumora)—, con los mockups en `docs/diseno/mockups-dashboard/` y su
  galería `index.html`. El mapa de qué hoja sale de qué referencia está en
  `docs/templates-dashboard-propuesta.md` §7.3; el relevo en `docs/relevo/templates-dashboard.md`;
  los hallazgos en `docs/hallazgos-templates-dashboard.md`. **No arranca las 15 restantes y tiene
  razón en el motivo: Martín todavía no vio las primeras, y corregir el criterio en 4 hojas es
  barato y en 19 no.** Lo que ya no hay que rehacer: los 24 demos están medidos y el medidor quedó
  en `docs/diseno/mockups-dashboard/medidor/`.

⚠️ **Y avisó de algo que podía borrar 3.430 líneas:** su rama `dashboard-denso-0111` vivía SÓLO en
el worktree `C:/dev/wt-dashboard-3110`, sin upstream y sin estar en ningún remoto, con el worktree
**limpio**. La regla de barrido de worktrees («sólo limpios, subidos, sin uso 24 h») lo habría
leído como limpio y lo habría borrado: *no estaba subido, pero parecía limpio.* **Ya la subí** —
`origin/dashboard-denso-0111`, punta `a4fb06dba`— y subir una rama que no es `integracion` **no
dispara Actions** (`.github/workflows/integracion.yml:28` sólo escucha `branches: [integracion]`),
así que no gastó minutos ni canceló ningún run. **La regla que queda: «limpio» no es «a salvo».
Antes de barrer un worktree hay que mirar si su rama está en un remoto, no si el working tree está
limpio.**

**Lo que hace falta para seguir, y es decisión de Martín: pasar a otra cuenta.** Con cuenta nueva
los briefs sirven tal cual.

⚠️ **Por qué cinco fueron a la nube y no acá: no hay RAM.** Medido el 2/11 ~18:20 — **2,73 GB
libres de 15,71**, y el guardia corta Bash por debajo de 3 GB. Los procesos `claude` solos ocupan
**5,09 GB**; Chrome no estaba ni abierto, así que no hay nada que cerrar para hacer lugar. Despertar
más sesiones locales habría ahogado la máquina. Martín lo había autorizado: «si tienes problema de
RAM comiénzalos en una sesión en la nube».

**Lo que NO se repartió, y por qué:**

| Ítem | Por qué sigue quieto |
|---|---|
| **9** (mitad CRM) — vista previa del perfil con el @ en el CRM | ✅ **HECHO** `0aafde481`: el desplegable del CRM ya tenía la vista previa; lo que le faltaba era un motor que ande, y ahora cae a Apify |
| **10** — con un dato traer TODAS sus redes + el desplegable | ✅ **el desplegable y el actor, HECHOS** `0aafde481` (`apify~instagram-scraper`, US$ 0,012 la búsqueda). **Sigue pendiente la otra mitad**: con un dato traer sus OTRAS redes (YouTube, TikTok) y que el usuario las VALIDE. La landing ya viene gratis del link de la bio |
| **21** — probar punta a punta la clave de Apify de ws 9 | ✅ **PROBADO** contra el actor real el 3/11 (`scripts/probar-busqueda-apify.mjs`), y encontró un error que los tipos no veían: 6 de 7 candidatos vienen SIN `username` y el @ sale de la `url` |
| la **caricatura** del competidor | falta UN dato antes de construir: **sobre qué cuenta de Google corre el puente de Flow**. Si corre sobre la de Martín, generar caricaturas para los competidores de cada cliente le gasta a él. Eso se mira en el puente, no se adivina |
| **20** — que desaparezca «Descargar la extensión» | trabado en el consentimiento OAuth de la cuenta de Google de Martín (cliente OAuth borrado). No es código y un asistente no puede hacerlo |
| **ticket #43** | Martín ya lo desbloqueó («una agencia sí puede, inspeccionando»), pero necesita el camino cross-tenant y los adjuntos de WhatsApp. Va DESPUÉS del #44, que es la misma pieza sin esos dos frenos |

---

## ✅ DESPLEGADO — 2/11/2026 ~05:40

`origin/main` = **`bee7d83fd`**. Los 16 commits de la noche entraron juntos y Vercel los desplegó.

**Lo que costó llegar, y es la lección de la noche:** cinco runs de Actions en rojo o cancelados.
Dos causas:

1. **Pushear por ítem CANCELA el run anterior** (`concurrency: integracion`). Lo escribí en este
   mismo tablero y lo hice igual nueve veces seguidas, así que durante horas hubo commits buenos
   sin desplegar. **Se junta, se pushea UNA vez y se espera.**

   ⚠️ **MEDIDO EN ACTIONS EL 2/11 ~19:10, y es la prueba, no la sospecha:** los runs **#349 al
   #358 salieron TODOS «cancelled»**. Ninguno rojo — **ninguno TERMINADO**. El último verde fue el
   **#348** (`63d66d8`), que es exactamente donde quedó clavado `main` mientras doce commits buenos
   esperaban arriba. Y la trampa de lectura: un run cancelado a los 2 minutos **no deja ningún
   error**, así que buscando el fallo no se encuentra nada y parece que el problema es otro. El
   **#359** lleva los 13 juntos.

   ⛔ **POR ESO EL PUSH DEL ÍTEM 9 ESTÁ RETENIDO A PROPÓSITO (2/11 ~19:45).** El ítem está hecho y
   commiteado en `c85e10ec2`, y la orden de trabajo dice pushear al terminar cada ítem — **pero el
   #359 todavía corre con 13 commits de Martín adentro, y pushear ahora lo cancela.** Esperar 15
   minutos cuesta menos que repetir una hora. **El que siga: mirá Actions primero** (si el #359 está
   verde, `main` ya avanzó solo) y recién entonces
   `MAKO_SIN_ANTES_DE_SUBIR=1 git push origin HEAD:integracion`.

   ⚠️ Y hay DOS ramas más esperando el mismo tren, las dos ya a salvo en el remoto:
   `difusion-modal-0211` (`6bf0a40a8`, el ítem 19) y `dashboard-denso-0111` (`a4fb06dba`, 5 de 20
   dashboards). Cuando el #359 cierre, **se juntan y se mandan de una sola vez**, no de a una.
2. ⚠️ **EL RESUMEN DEL RUN NO NOMBRA LOS TESTS ROJOS; EL LOG DEL JOB SÍ.** El resumen sólo dice
   `afectados: 889 s (código 1)`. En el log hay una línea **«Rojos:»** con los archivos y el
   comando para repetirlos solos. Mirar el resumen y adivinar me costó tres runs. Y correr
   `tests-afectados.mjs` en esta máquina da una lista DISTINTA —corta en otra tanda— que me mandó
   a perseguir dos tests lentos sin relación.

### Verificado EN PRODUCCIÓN (2/11 ~05:50, mirando hola-mako.com/competitor-spy)

- La rejilla de tarjetas se dibuja, y **el botón de borrar aparece al pasar por encima**. ✅
- ⚠️ **Las caras todavía no se ven: todas muestran la inicial.** No es un bug — `avatar` se llena
  recién cuando se vuelve a LEER al competidor («Revisar ahora»), y nadie leyó nada desde el
  deploy. Lo mismo vale para las miniaturas guardadas: las piezas que ya estaban en la base siguen
  apuntando al CDN de Meta, con `miniatura_guardada_en` en null. **La primera lectura las arregla.**
- ⚠️ **Los duplicados que ya existen no se van solos.** El arreglo del alta impide los NUEVOS;
  los seis que hay («sofiacontreras» vs «Sofia Contreras», «hormozi» vs «@AlexHormozi» vs
  «acquisition.com») hay que borrarlos a mano, que ahora se puede desde la tarjeta.

### ⛔ #20 · Publicar la versión nueva de la extensión

**«Descargar» ya no sale (3/11):** toda pantalla lleva a «Agregar a Chrome», también con la tienda
atrás, así que esto ya no depende de publicar. Lo de acá antes, «ningún cambio de código lo
arregla», estaba mal: [hallazgos-extension.md](hallazgos-extension.md) dice por qué.

**Lo que sí sigue pendiente:** la tienda publica la `0.74.3` y el repo tiene la `0.74.5` (medido el
3/11 con `node scripts/version-en-tienda.mjs`). Lo nuevo no le llega a nadie hasta publicar.

⚠️ **MEDIDO EL 2/11 ~15:30, Y NO ES LO QUE DECÍA ACÁ ANTES.** Las credenciales SÍ existen —están en
`C:/dev/mako-api/.env.local`, no en el `.env.local` del worktree, que es lo que me había hecho
concluir que faltaban—. El problema es otro y lo contesta Google:

```
node --env-file=C:/dev/mako-api/.env.local scripts/publicar-extension.mjs --estado
→ no se pudo renovar el token: {"error":"deleted_client",
  "error_description":"The OAuth client was deleted."}
```

**El cliente OAuth de Google Cloud fue BORRADO.** Por eso el refresh token no sirve, y por eso
nadie pudo publicar aunque las tres variables estén puestas.

**Lo que hace falta, y es trámite de Martín en SU cuenta de Google, no código:**
1. Google Cloud Console → Credenciales → crear un cliente OAuth 2.0 nuevo (tipo «App de escritorio»).
2. Poner el `CWS_CLIENT_ID` y el `CWS_CLIENT_SECRET` nuevos en `C:/dev/mako-api/.env.local`.
3. Autorizar una vez para sacar el `CWS_REFRESH_TOKEN` (`scripts/publicar-extension.mjs --ayuda`
   explica los dos pasos).

Hecho eso, publicar es **un comando**, y la versión nueva llega sola en cuanto Google apruebe.
**Un asistente no puede hacer el paso 1 ni el 3: son el consentimiento OAuth de la cuenta de
Martín.**

### 🎫 Tickets #43 y #44 — SON EL MISMO PEDIDO, y hay un orden (2/11 ~13:15)

Los dos los levantó el mismo cliente (Código Inmobiliario) y piden lo mismo: **cargar un documento
al Second Brain y que MaKo lo incorpore**.

| | #43 | #44 |
|---|---|---|
| Por dónde | WhatsApp | el chat de la app |
| Alcance | el cerebro de OTRO workspace (plan Agencia) | UN solo workspace (ws 23) |
| El contenido | un archivo adjunto | **ya viene como TEXTO en el chat** |

**#44 es el que se puede construir: no tiene ninguno de los dos frenos del #43** (ni adjuntos de
WhatsApp, ni escritura cross-tenant).

**Y la pieza pesada ya está hecha:** `app/api/onboarding/archivero/route.ts` ya ingiere `.txt`,
`.md` y `.docx` (con mammoth) y transcribe documentos e imágenes con IA. **Lo único que falta es
exponerla.**

El área `negocio` de la API de MaKo tiene **cero** funciones de escritura, y
`lib/api-mako/areas/negocio.def.ts` lo explica en su línea 22 **desde el 16/09/2026**:
`agregar_web_archivero` quedó afuera porque su lógica vive INLINE en la ruta y primero hay que
extraerla a `lib/`. O sea que esto no es un bug nuevo: es una deuda anotada hace mes y medio que
recién ahora pidió un cliente.

**El trabajo, en orden:** (1) extraer la ingesta del route a `lib/`; (2) sumar la función de
escritura al área `negocio` con el patrón de las otras; (3) que MaKo la use cuando le peguen un
documento. Hecho eso, **#43 queda a una sola decisión de Martín**: si una agencia puede escribir
en el cerebro de su cliente, y con qué límite.

⚠️ Los dos quedaron en `esperando_decision` con el diagnóstico anotado. No les forcé el estado:
`reclasificar` sólo corre desde «en curso», y están esperando a Martín.

### ⛔ #12 · Por qué el límite de Instagram se subió sólo de un lado

Eran **dos números distintos**, no uno:

- **Por Apify: era 25 y ahora es 100.** El actor YA devolvía todas las publicaciones que traía, y
  nosotros tirábamos a la basura lo que pasaba de 25. Subirlo **no gasta una llamada ni un crédito
  más**: aprovecha lo que ya se pagó. Éste es el camino que funciona hoy.
- **Por Meta (Business Discovery): sigue en 25 y NO se toca sin poder medirlo.** En la Graph API un
  límite que Meta no acepte hace fallar la consulta ENTERA, y **Business Discovery no tiene
  credencial desde el 22/10/2026**: sólo una conexión de cliente (ws11) la tiene y hoy le funciona.
  Subirlo a ciegas es apostar la lectura de ese cliente a una corazonada. El día que haya una
  credencial para probarlo, se mide y se sube.

**Lo que sigue pendiente del pedido:** elegir publicaciones a dedo desde el perfil con la extensión
de MaKo. Eso es trabajo de la extensión, no de la tab.

### 🔎 Buscar mientras escribís — hecho a medias, y el porqué (2/11 ~14:20)

Martín pidió «cuando vaya escribiendo el arroba... ya me vayan apareciendo opciones, un
desplegable para seleccionar».

**Lo que está hecho:** el modal busca **solo, al dejar de escribir** (900 ms), sin tocar ningún
botón, y no repite lo ya buscado en esa sesión del modal. Se siente como «aparece mientras
escribo» y cuesta UNA lectura por @ entero.

⚠️ **Por qué NO se llama en cada tecla, que es lo que se pidió literalmente:** cada lectura de un
perfil gasta del tope **diario** de Apify (`APIFY_TOPE_POR_DIA`). «leilahormozi» son trece teclas:
con una llamada por tecla, dos o tres altas agotan el día y después **nadie del negocio puede
agregar a nadie**.

⚠️ **Lo que falta y NO es lo mismo: un DESPLEGABLE con varias opciones.** Eso es una BÚSQUEDA («los
perfiles que se parecen a `leilaho`»), y lo que tenemos es una lectura por handle EXACTO. Instagram
no da búsqueda por su API; haría falta un actor de búsqueda de Apify, que es otro costo y otra
decisión de Martín. **Antes de construirlo hay que decidir eso**, no es trabajo de pantalla.

### 🎨 La CARICATURA del competidor — lo entendí mal y está a medias (2/11 ~14:40)

**Martín pidió la MISMA caricatura que la de los gurús** («como la que estamos haciendo con los
gurús de los cursos»), generada **para cada competidor nuevo**, y **con protagonismo en la
tarjeta**. Yo entendí «su foto de perfil» y puse un avatar de 56 px arriba. Las dos cosas estaban
mal.

**Lo que YA está hecho:** la imagen manda en la tarjeta — cuadrada, a sangre, con el texto abajo.
Misma anatomía que la tarjeta de pieza y que la de los referentes. Hoy el hueco lo llena la foto de
perfil bajada; cuando exista la caricatura, entra en el mismo lugar sin tocar la pantalla.

**Lo que FALTA, y es trabajo nuevo:** generar la caricatura.

⚠️ **Las caricaturas de los gurús NO las hace la app: las hice yo a mano**, con Canva, desde este
chat. No hay ningún pipeline de generación en el repo. O sea que «que se ejecute el proceso con
cada nuevo competidor» es construir ese pipeline, no llamar a algo que ya existe.

**Lo que hace falta, en orden:**

1. **El prompt aprobado ya está**, textual, en `docs/hallazgos-ops-center.md`. Va cargado como
   prompt EDITABLE (`.claude/skills/add-editable-prompt`), no hardcodeado: Martín lo va a querer
   ajustar y hoy no podría.
2. **Una foto de origen.** Ya la tenemos bajada: `spy_competidores.avatar` (migración 0362). Sin
   foto de perfil no hay caricatura posible, y eso hay que decirlo en la pantalla, no dejar el
   hueco en blanco.
3. ⚠️ **CORRECCIÓN (2/11 ~15:00): SÍ HAY generador de imágenes en el repo, y además acepta una
   FOTO DE REFERENCIA, que es justo lo que la caricatura necesita.** Es **Google Flow**
   (`lib/flow-imagen.ts`, `lib/flow-protocolo.ts`), el que usa el Video Estudio para las imágenes
   de escenario. Lo verificado abriendo los archivos:
   · soporta `referenceEntities` / `referenceLikenesses`, y ya tiene escrito un prompt de
     identidad («The reference image is provided ONLY as an identity reference: match the
     subject's…»);
   · **el token del puente es un BEARER y sirve fuera del navegador** — está escrito así en
     `flow-protocolo.ts`, porque «el puente tiene que trabajar mientras la persona no está». O sea
     que no hace falta que Martín tenga Chrome abierto.

   **Yo le había dicho a Martín que NO existía**, de memoria y sin abrir el archivo — el mismo
   error que ya me costó tres «no está en Knowledge». Esto achica mucho el trabajo: no hay que
   conseguir un proveedor, hay que REUSAR el camino de Flow con el prompt de la caricatura y la
   foto del competidor como referencia.

   **Lo que SÍ queda por averiguar antes de construirlo:** sobre qué cuenta de Google corre el
   puente. Si corre sobre la de Martín, generar caricaturas para los competidores de CADA cliente
   le gasta a él. Eso se mira en el puente, no se adivina.
4. **Guardarla**: el bucket `spy-miniaturas` ya sirve, con una ruta propia.
5. ⚠️ **NO adentro de la lectura.** Generar una imagen tarda bastante más que bajarla, y «Revisar
   ahora» ya casi se pasa del tiempo de la función (ver #4b). Va como trabajo aparte, después de
   crear el competidor, y la tarjeta muestra la foto mientras tanto.

⚠️ **Dos decisiones de Martín antes de construirlo:** (a) **cada caricatura cuesta plata**, y
«para cada competidor nuevo» sin tope puede sumar rápido; (b) es la cara de una persona REAL que no
dio su consentimiento. Para los gurús la regla ya existe y distingue: la galería PÚBLICA va sin
caras ni nombres reales, pero **dentro del análisis PRIVADO de un negocio el competidor que ese
negocio eligió sí se ve** (docs/hallazgos-competitors-spy.md). La tarjeta de Spy es análisis
privado, así que encaja — pero conviene que Martín lo confirme por escrito.

### 📸 Las miniaturas de YouTube NO se estaban guardando — corregido (2/11 ~15:20)

**Le dije a Martín que la miniatura del video largo «ya queda archivada» y era falso.** Lo vi
mirando la base, no suponiendo: de **163 piezas, sólo 12 tenían imagen guardada**, y las 12 eran de
Instagram. Las de YouTube se **derivaban del id al dibujar** y no se bajaban nunca.

Para VERLAS alcanzaba —la URL de YouTube no vence ni bloquea, al revés que la de Meta—, y por eso
nadie lo había notado. Pero Martín las quiere por otro motivo: «que eso también pueda servir de
referencia para crear miniaturas luego para los propios usuarios de MaKo». **Una URL ajena no es
material de referencia; un archivo sí.**

Ahora el mapeo de YouTube pasa la miniatura que YouTube dio —la de mayor resolución— y la baja el
mismo camino que las de Instagram.

⚠️ **La regla, porque es la que lo hizo invisible:** «se ve bien» y «lo tenemos» son dos cosas
distintas. Una imagen que se dibuja desde una URL ajena se ve perfecta y **no está guardada en
ningún lado**. Si alguien la va a usar DESPUÉS para otra cosa, hay que mirar la base, no la pantalla.

**Y algo para saber al revisar:** la última lectura de un competidor fue a las 04:01, **antes** de
que se desplegara el bajador. Por eso hoy hay 0 miniaturas bajadas y 0 caras guardadas. **No está
roto: nadie leyó nada todavía.** Se arregla solo al tocar «Revisar ahora».

### 🧑‍🏫 La RECETA de un referente, probada con Emilio Puigrredón (2/11 ~16:00)

**Hecho: 1 de 12.** Los otros once son esta misma secuencia, sin nada que averiguar.

1. **La transcripción NO está en el archivo del curso.** `curso-*.ts` tiene `transcripcion: []` y
   `resumen: ''` a propósito. El texto vive en **`public/cono-tx/<videoId>.json`**, y el JSON es una
   LISTA de strings. Se sacan los `videoId` del curso y se leen esos archivos.
2. **Para la FICHA se leen las clases del MÉTODO, no todas** (para la capa del segundo cerebro se leen todas: ver la sección de arriba).** En Social Funnel eran «La fórmula», «La
   estructura» y «Principios de tráfico»: ahí están los marcos. La intro y el bonus no aportan.
   Un curso entero son 80 KB; las del método, la mitad.
3. **La ficha** va en `lib/asesores/ficha-<id>.ts`, **≤ 5.200 caracteres**, con la forma de las que
   ya están: MARCOS numerados (Qué es / Cuándo / Regla / «(clase: …)»), CÓMO PIENSA, QUÉ PREGUNTA
   ANTES DE ACONSEJAR, CÓMO HABLA, y un «⚠️ NO SE TRASLADA» con lo que no hay que repetir —los
   resultados de alumnos son ejemplos, nunca promesas—.
   ⚠️ **Español neutro con «tú».** Las transcripciones están en voseo y copiarlas pone ROJO a
   `tests/puente-panel-copy.test.ts`. La ficha es la voz de MaKo, no la del instructor.
   ⚠️ **Las tácticas engañosas del curso NO pasan a la ficha.** Varios cursos enseñan maniobras
   para forzar una respuesta o aparentar algo que no es. La ficha es un asesor que MaKo le pone
   enfrente a un negocio: se destila el MÉTODO, no el truco. Esto salió de las ocho fichas que
   quedaron escritas en el brief del 2/11 y conviene que esté acá, porque es la clase de cosa que
   se copia sin pensar.
   ⚠️ **Toda cifra se busca en la clase que se cita, antes de darla por buena.** Las
   transcripciones son habla: un número dicho al pasar, redondeado o exagerado se lee igual que un
   dato. Si no aparece en la clase citada, no va.
4. **Registrarlo en tres lugares**: el `IdAsesor` y la fila de `ASESORES` en
   `lib/asesores/catalogo.ts`, y el import + la entrada del mapa en `lib/asesores/fichas.ts`.
5. **La caricatura**, que `tests/coaches-ops-center.test.ts` EXIGE («sin imagen su fila saldría
   como un disco vacío»):
   · **la foto de referencia sale de la portada del curso**, `public/cono-portadas/<slug>.webp`,
     que casi siempre tiene la cara del instructor;
   · se sube a Canva con `upload-asset-from-url` apuntando a
     `https://hola-mako.com/cono-portadas/<slug>.webp` (tiene que ser una URL pública);
   · se genera con `generate-image`, `SQUARE_1_1`, pasando ese media id en `imageReferences` y el
     **prompt aprobado textual de `docs/hallazgos-ops-center.md`**, rellenando los huecos con lo
     que se ve en la foto (pelo, barba, anteojos o gorra, piel, gesto, prenda lisa, color de fondo);
   · se guarda como `public/asesores/<id>.png`.

**Los diez que faltan, con su curso, están en la tabla de más arriba.**

⚠️ **Dos cosas que aprendí en el segundo y ahorran tiempo en los que vienen:**
· **Un curso puede tener 740 KB de transcripción.** «Inteligencia Viral» son 41 clases. NO se
  lee entero: se eligen cuatro o cinco clases del método por el título y alcanza de sobra.
· **La ficha se va de largo sola.** La primera versión de Alborna salió en 5.692 y el tope es
  5.200. Lo que sobra casi siempre son los «Cuándo:» de cada marco y los ejemplos repetidos:
  se recorta eso antes que un marco entero.

### 🧠 LA FICHA Y EL SEGUNDO CEREBRO SON DOS COSAS DISTINTAS (2/11 ~17:00)

Martín: «me gustaría que se lea entero los cursos, que no haya limitación de caracteres,
justamente la idea es que el segundo cerebro de estos gurús tenga todo el contexto».

**Tiene razón en el objetivo, y por eso el camino NO es sacarle el tope a la ficha.** Son dos
piezas con dos trabajos:

| | La ficha (`lib/asesores/ficha-<id>.ts`) | El segundo cerebro del gurú |
|---|---|---|
| Qué es | cómo piensa, qué pregunta, cómo habla | el curso ENTERO, clase por clase |
| Cuándo viaja | **en cada mensaje**, siempre | **sólo cuando la pregunta lo pide** |
| Por eso | tope de 5.200 | sin tope |

Sacarle el tope a la ficha metería las 740 KB de un curso en **cada turno** de cada chat: caro,
lento, y peor de leer para el modelo —el método se ahoga entre el relleno—. Lo que Martín quiere
«todo el contexto disponible» se resuelve del otro lado, y **el repo ya tiene exactamente ese
mecanismo**: `lib/cerebro-knowledge.ts` (31/10) cuelga Knowledge como una CAPA del Second Brain,
y `lib/cerebro-recuperar.ts` la recupera **sin IA y con presupuesto**. Su propio comentario lo
dice en mayúsculas: «POR QUÉ UNA CAPA Y NO MÁS TEXTO EN EL PROMPT».

Cómo funciona hoy, que es lo que hay que copiar: **el índice viaja siempre, una línea por módulo
y SIN contenido**; el cuerpo largo de un nodo viaja **sólo cuando un chat lo pide por id**. Una
pregunta que nombra «anuncios» trae ese módulo y sus vecinos, no el índice entero.

**Entonces lo que falta (ítems 17 y 18) es una capa POR GURÚ, con un nodo por CLASE**, para que
preguntarle algo a Alborna traiga la clase donde él lo explica — con sus palabras y completa— y
no un resumen. Ahí sí se lee el curso entero: va a la capa, no a la ficha.

⚠️ **Y esto corrige una instrucción que yo mismo escribí más arriba en la receta.** «Leer sólo
las clases del método» vale para ESCRIBIR LA FICHA, que es corta por diseño. Para la capa hay que
procesar **todas** las clases. Son dos pasos distintos sobre el mismo curso, y confundirlos fue
mío.

## Estado

| | Ítem | Estado | Commit |
|---|---|---|---|
| 1 | Spy visible para todos (tenía `adminOnly`) | **HECHO** | `91bcafb09` |
| 1b | **Que además FUNCIONE para todos** (las acciones pedían admin) | **HECHO** | mirar y agregar: cualquiera. Borrar: sólo el admin |
| 2 | Offer y Ads Manager fuera de la barra | **REVERTIDO** | rompe 6 tests: esas keys las nombran el catálogo de la API, el móvil, Knowledge, Create y Estrategia. Es un trabajo propio, ver abajo |
| 3 | Miniaturas de IG: `referrerPolicy` + respaldo | **HECHO** | `91bcafb09`, y reemplazado por #4 |
| 4 | **Descargar y GUARDAR la miniatura** | **HECHO** | bucket `spy-miniaturas` (0361) + `lib/spy-miniaturas.ts`. Migración YA APLICADA en prod |
| 4b | **Que bajar las imágenes no rompa «Revisar ahora»** | **HECHO** | presupuesto de 9 s; lo que no entra lo toma la próxima lectura |
| 4c | **Que no vuelva a bajar lo que ya bajó** | **HECHO** | sin esto el presupuesto se gastaba siempre en las mismas y nunca convergía |
| 4d | **`maxDuration` en la tab** | **HECHO** | Spy no lo declaraba y «Revisar ahora» es lo más caro de la app |
| 5 | **YouTube: que traiga los videos LARGOS** | **HECHO** | pagina la playlist y le reserva cupo a los largos |
| 6 | **Lista de competidores en tarjetas con caricatura** | **HECHO** | la cara es su foto de perfil, bajada (0362) |
| 7 | **Borrar competidor desde la lista** | **HECHO** | el botón vive en la tarjeta |
| 7b | **Deduplicar el alta** (por eso hay 3 «Sofia Contreras») | **HECHO** | deduplica por canal y por nombre comparable |
| 8 | **Rediseñar el modal de «Mirar a alguien más»** | **HECHO** | una entrada, vista previa y confirmación |
| 9 | **Con el @ traer el perfil** | **HECHO, Spy y CRM** | `c85e10ec2` — en el CRM no faltaba pantalla —estaba desde el 12/10—: la ruta pedía `APIFY_TOKEN`, que no existe en ningún negocio, teniendo al lado la `APIFY_CLAVE_DE_SPY` que Martín pegó el 1/11. Una fuente sin credencial hace `continue`, no error: fallaba en silencio once días. `docs/hallazgos-crm.md` |
| 10 | **Con un dato, traer todas sus redes** + landing/funnel de la bio | **HECHA la mitad GRATIS** | el link de la bio ya se leía, se MOSTRABA y se tiraba a la basura al guardar (`lib/spy.ts` no nombraba `perfil.web` en ninguna línea). Ahora viaja con la confirmación y entra como landing —o como YouTube, si su bio enlaza su canal—, sin pagar una segunda lectura. `canalDeLaBio` en `lib/spy-reglas.ts`, con `tests/spy-canal-de-la-bio.test.ts`. **Falta** la búsqueda por nombre (otro actor de Apify, decisión de Martín) |
| 11 | **Validar con el usuario** antes de guardar | **HECHO** | nada se guarda sin mostrar quién es |
| 12 | **Pasar de 50 publicaciones** | **HECHO a medias** | por Apify, de 25 a 100 (gratis: ya las recibíamos). Por Meta NO se toca, ver abajo |
| 13 | **Spy compartido entre usuarios** | **EMPEZADO: la base está** | migración `0363` **ya aplicada en producción** (tabla global `spy_lecturas_canal`, sin `workspace_id` a propósito, RLS prendida sin políticas como las otras de Spy) + `lib/spy-compartido.ts` con la regla, probada rompiéndola. ⚠️ **FALTA EL CABLEADO**: que `mirarCompetidor` la consulte antes de llamar a Apify/YouTube y la refresque después. Ver abajo |
| 14 | **Los 12 referentes** (fichas + caricaturas) | **2 de 12** | Puigrredón y Alborna hechos. La receta, abajo |
| 15 | **El diseño de la tab principal de gurús** (no el detalle) | pendiente | |
| 16 | **Elegir un gurú desde «nuevo chat»** | **HECHO** (rama `gurus-0311`) | los gurús a la vista en Nuevo chat (`GaleriaDeGurus.tsx`), en la computadora y el teléfono, cliente y super admin; tocar uno abre su chat ahí mismo. Una conversación por persona y gurú, y el servidor saca al gurú de la CLAVE |
| 17 | **Base de conocimiento por gurú** | **HECHO, los 22** (rama `gurus-0311`) | el turno trae los TRAMOS del curso que hablan de la pregunta (`cursoParaElTurno`); antes no viajaba ni una palabra, y el mapa tenía 3 de 22. Leído del CDN. Ver `docs/hallazgos-ops-center.md` y `docs/hallazgos-second-brain.md` |
| 18 | **Botón de Second Brain por gurú** | **HECHO** (rama `gurus-0311`) | «Su Second Brain» en el chat del gurú, el Funnel Coach y una conversación de Offer, y adentro de la hoja en el teléfono: el grafo de su curso (`?cerebroDe=`) |
| 19 | **Modal de «mensaje de difusión» del CRM** con formato por red | **HECHO, esperando el tren** | rama `difusion-modal-0211`, punta `6bf0a40a8`, ya en el remoto. ⚠️ **Vive en `app/automations/difusion/HojaDifusion.tsx`**, NO en `app/crm/AccionesLoteLeads.tsx` ni `app/crm/seleccion-difusion.ts` — esos dos sólo ponen la selección, y el ítem los nombraba mal. No trae selector de número/cuenta: la difusión no lo guarda y mentiría |
| 20 | **Instalar extensión: sacar la descarga** | **TRABADO, no es código** | el zip YA está detrás de un flag; falta PUBLICAR en la tienda. Ver abajo |
| 21 | **Probar punta a punta la clave de Apify de ws 9** | pendiente | |
| — | Los 20 dashboards | **OTRO CHAT** | `docs/templates-dashboard-propuesta.md` |
| — | ¿Spy trae sólo Reels? | **NO ES UN BUG** | `lib/spy.ts:429` deja pasar todo |

---

## Lo que ya está averiguado, para no volver a averiguarlo

### #5 · YouTube no filtra Shorts: es un tope por RECENCIA

El lector NO filtra por formato. Pide `playlistItems` sobre la playlist de subidas del canal
(`lib/spy-youtube.ts:270`), que trae **todos** los videos, los largos y los Shorts, del más nuevo al
más viejo. Lo que pasa es que se queda con los **últimos 50** (`piezasPorVuelta`), y en un canal que
sube Shorts todos los días los últimos 50 son todos Shorts: **el video largo queda afuera por viejo,
no por formato.**

La duración YA se lee (`lib/spy-youtube.ts:218`, `contentDetails.duration`), así que se puede
clasificar sin pedir nada nuevo. La salida es un cupo por tipo —traer los N largos más nuevos
ADEMÁS de los Shorts— paginando hasta llenarlo.

Y Martín agregó el para qué, que decide el diseño: **la miniatura del video largo tiene que
guardarse igual, porque más adelante sirve de referencia para generarle miniaturas al usuario de
MaKo.** O sea que #5 y #4 son el mismo trabajo: guardar la imagen, no la URL.

### #13 · Cómo compartir Spy sin filtrar datos entre negocios

Hoy es por negocio: `spy_competidores` tiene `workspace_id not null` y `unique (workspace_id,
nombre)` (`supabase/migrations/0359_competitors_spy.sql:67,94`).

**Se comparte lo CARO, no lo privado.** Lo leído de un canal público va a una caché global por `ref`
de canal, que cualquier negocio aprovecha: nadie paga dos veces por leer a Hormozi. **A quién mira
cada negocio sigue siendo suyo.** De ahí sale el borrado que Martín pedía: el usuario saca al
competidor de SU lista y la lectura compartida no se toca; y un competidor sembrado por nosotros va
marcado y no se puede borrar, sólo dejar de ver.

### #14 · Los 12 referentes: el curso de cada uno

Verificado contra el campo `titulo:` de cada archivo, **nunca contra el nombre de la carpeta** (eso
ya puso dos nombres mal en producción: «Jaime Jiguera» por **Higuera** y «Jordi Sigues» por
**Segués**).

| Martín pidió | Curso | Archivo |
|---|---|---|
| Juan Carrizo | Aumenta tu valor y ATV ADVANTAGE | `curso-aumenta-tu-valor-y-atv-advantage.ts` |
| Emilio Puigrredón | Social Funnel | `curso-social-funnel.ts` |
| Vilma Núñez | Certificación en Marketing Digital potenciada por IA | slug `certificacion-marketing-digital-ia` |
| Julián Alborna | Inteligencia Viral 2026 | `curso-inteligencia-viral-2026.ts` |
| Andy Landa | ManyChat Master - Instagram | `curso-manychat-master-instagram.ts` |
| Romuald Fons | Bigseo Academy | `curso-bigseo-academy.ts` |
| Mateo Maffia | BYF | `curso-mateo-maffia-byf.ts` |
| Sergio Begueria | Instituto De Marca Personal | `curso-instituto-de-marca-personal.ts` |
| Álvaro Luque | The perfect launch | `curso-the-perfect-launch.ts` |
| Francisco Doglio | ARCADIA | `curso-arcadia.ts` |
| Gonzalo Seré | Growing Content Specialist | `curso-growing-content-specialist.ts` |
| Samuel Albaa | Growing Closer (con Agustín Nievas) | `curso-growing-closer-agustin-nievas-samuel-albaa.ts` |

⚠️ **Samuel Albaa comparte curso con Agustín Nievas, que ya es referente.** Su ficha tiene que
destilar SU parte —el *appointment setter*: manejar la conversación y conseguir la llamada—, que es
distinto del cierre, que es lo que ya tiene Nievas.

⚠️ **Buscar por el pedazo más corto e inequívoco del apellido** (`Puig`, `Maffi`), nunca por el
nombre tal como lo escribió quien pidió la tarea: «Puigrredon» sin tilde y «Mafia» con una efe no
encuentran nada, y las dos veces concluí que el curso no existía.

Cada referente necesita: su entrada en `ASESORES`, su `IdAsesor`, su `lib/asesores/ficha-<id>.ts`
(≤ 5.200 caracteres, **español neutro con «tú»** — el voseo pone ROJO a
`tests/puente-panel-copy.test.ts`) y su caricatura en `public/asesores/<id>.png` con el prompt
aprobado, que está textual en `docs/hallazgos-ops-center.md`.

---

# Orden de trabajo de lo que falta (escrita el 2/11 ~06:20, al 91 % de la cuenta)

Para cada pendiente: **dónde vive**, **qué pieza ya existe para reusar**, **la trampa** y **qué es
estar hecho**. Lo averiguado acá ya está pago: no hace falta volver a buscarlo.

## #8 · Rediseñar el modal de «Mirar a alguien más»
- **Vive en:** `app/competitor-spy/SpyApp.tsx` → `ModalAlta` (dos pestañas: pegar / a mano).
- **Reusar:** la referencia ya está medida en `docs/diseno/referencia-spy.md` — la ficha de
  producto de fitlo, que es la pantalla análoga.
- **Hecho =** una sola entrada, y lo que se pega se PREVISUALIZA antes de guardar (ver #9 y #11:
  son el mismo modal).

## #9 · Con el @, traer el perfil (Spy y CRM)
- **Ya existe todo el lado servidor:** `leerPerfilInstagram(usuario, { ws, conPiezas })` en
  `lib/instagram-perfil-server.ts` devuelve `{ usuario, nombre, foto, bio, web, seguidores,
  publicaciones }`. Falta sólo una acción que lo exponga.
- **Cómo:** una acción nueva en `app/competitor-spy/actions.ts` copiando el patrón de las otras
  (guard `soloMiembro()`, `try/catch` con `msg(e)`).
- ⚠️ **La trampa:** NO dispararlo en cada tecla. Apify tiene tope diario (`APIFY_TOPE_POR_DIA`,
  `lib/instagram-perfil-server.ts`) y una vista previa por pulsación se lo come en una tarde.
  Va con Enter o al salir del campo.
- **La foto del perfil se baja con lo que ya está hecho:** `guardarMiniaturas([{ canal: 'avatar',
  ref, miniatura: foto }])` de `lib/spy-miniaturas.ts`.

## #10 y #11 · Traer sus otras redes, y VALIDARLAS
- **La landing ya viene gratis:** el campo `web` del perfil de Instagram es el link de su bio.
  Eso solo ya cubre buena parte del pedido.
- **Lo que falta de verdad** es buscar las otras redes por un motor de búsqueda.
- ⚠️ **La trampa, y ya la pagamos con los gurús:** resolver una persona por búsqueda trae a OTRA.
  Por eso Martín pidió explícitamente validar («¿este es el YouTube de esta persona?»).
  **Nada que venga de una búsqueda se guarda sin que el usuario lo confirme.**

### ✅ HECHO (3/11/2026, rama `spy-0311`) — y lo que cuesta
- **Con un dato salen sus otras redes:** al dar de alta a alguien se busca solo su YouTube, su
  TikTok y su Instagram, y la ficha PREGUNTA: «¿Son de esta persona?» con «Sí, es esta persona» /
  «No es». El enlace abre el perfil para comprobarlo. **Nada entra sin el sí.** En las fichas que
  ya existían, «Buscar sus otras redes» en la miga.
- **El actor:** `apify~google-search-scraper`, UNA página de Google por búsqueda (trae las tres
  redes juntas). **Medido en dos corridas reales: US$0,00455 por búsqueda** (US$0,0045 la página +
  US$0,00005 el arranque). Lo paga la clave de Spy del negocio.
- **Tope:** `TOPE_BUSQUEDAS_REDES_POR_DIA = 20` por negocio → **el peor día cuesta US$0,09**. No se
  busca al abrir una ficha, sólo al dar de alta o a pedido.
- **TikTok ahora se guarda** (migración `0365`, **APLICADA en producción**): Spy no lo LEE, muestra
  dónde está. De paso se arregló que un TikTok en la bio se guardaba como su landing.

## #12 · Pasar de 50 publicaciones
- **El tope es `piezasPorVuelta: 50`** en `lib/spy-reglas.ts` (dentro de `TOPES`).
- **Para YouTube ya está resuelto a medias:** `lib/spy-youtube.ts` ahora pagina con
  `PAGINAS_MAX` y `LARGOS_QUE_QUEREMOS`; el mismo patrón sirve para subir el tope.
- **La otra mitad del pedido** —elegir publicaciones a dedo desde el perfil con la extensión— es
  trabajo de la extensión, no de la tab.

## #13 · Spy compartido entre negocios — ✅ HECHO `cde75a8b6`, en `main`
- Se comparte LA LECTURA (caché global por `ref` de canal), nunca la lista de a quién mira cada
  negocio. La regla pura vive en `lib/spy-compartido.ts` (`sirveLaCompartida`: 24 h si la lectura fue
  de alta, 6 h si fue de rutina, y **0 h si alguien la pidió a mano** — pedirla a mano es justamente
  pedir que se relea) y lo que toca la base en `lib/spy-compartido-db.ts`.
- **Migración `0363_spy_lecturas_compartidas.sql`, APLICADA en producción.** La tabla
  `spy_lecturas_canal` **no tiene `workspace_id` a propósito** —es global, como las miniaturas de la
  0361— con RLS prendida y sin políticas: no la lee nadie salvo el servidor.
- ⚠️ **Cómo se logró sin romper el aislamiento**, que es lo más vigilado del repo: `TENANT_TABLES`
  (`lib/workspace.ts`) le pone el filtro de negocio a las tablas de la lista y deja pasar a las que
  no están. Dejarla AFUERA de esa lista es lo que la hace global. Si alguien la agrega, el caché
  deja de compartirse **y no falla ningún test**: por eso está dicho acá.

## #14 · Los 12 referentes
- **Los 12 cursos ya están localizados** (tabla más arriba), verificados contra el `titulo:` de
  cada archivo. Falta: entrada en `ASESORES`, `IdAsesor`, `lib/asesores/ficha-<id>.ts` y la
  caricatura en `public/asesores/<id>.png` con el prompt de `docs/hallazgos-ops-center.md`.
- ⚠️ **Español neutro con «tú»**: el voseo pone ROJO a `tests/puente-panel-copy.test.ts`. Las
  transcripciones están en voseo, así que la ficha hay que ESCRIBIRLA, no copiarla.

## #16 · Elegir un gurú desde «Nuevo chat»
- **Vive en:** `app/admin/operaciones/ChatNuevo.tsx` (214 líneas, **hoy no nombra referentes en
  ninguna**).
- **Reusar:** el selector ya existe y ya está arreglado — `app/second-brain/ElegirReferente.tsx`
  (el del modal de 1040 px). Lo usan `ChatDelCoach.tsx` y `ChatSecondBrain.tsx`.
- ⚠️ **Lo que lo hace coach es el CONTEXTO, no la pantalla**: lo elige el servidor por
  `desde.tab` en `lib/asesores/contexto.ts`. Poner el selector sin tocar eso deja un chat que se
  ve distinto y contesta igual.

## #18 · Botón de Second Brain por gurú
- **Las piezas están todas:** `app/second-brain/Grafo.tsx` recibe
  `cerebro = { nodos, aristas, cuenta, posiciones, encuadre }`, y `lib/cerebro-knowledge.ts`
  (31/10) ya cuelga Knowledge como una capa del grafo (`conCapa`, `lib/cerebro-union.ts`).
- **Hecho =** un botón en el chat del gurú que abre el grafo filtrado a SU curso.

## #19 · Modal de «mensaje de difusión» del CRM
- **Vive en:** `app/crm/AccionesLoteLeads.tsx` y `app/crm/seleccion-difusion.ts`.
- **Reusar:** el formato por red ya existe en Automations — de ahí sale el «como lo tenemos en
  Automations» que pidió Martín.

## #2 · Sacar Offer y Ads Manager de la barra (revertido)
- **No es borrar una línea de `nav.ts`.** Esas keys las nombran: el catálogo de funciones de la
  API de MaKo, las rutas del móvil, los módulos de Knowledge, Create y Estrategia. Seis tests.
- **Hecho =** cada consumidor mudado a donde viven ahora (Funnel Coach y Hormozi, adentro del
  Ops Center), y recién entonces la línea de menos en `nav.ts`.

## 🔎 REVISIÓN COMPLETA DE COMPETITORS SPY — 2/11/2026 ~20:30

Martín la pidió dos veces: «revisá bien todas las cosas que van a faltar de Competitor Spy». Esto es
la lista entera, con lo que YO había marcado mal.

### ⛔ Lo que marqué HECHO y NO lo está

**Ítem 8 — el rediseño del modal de «nuevo competidor».** Martín: «si faltan más cosas de Competitor
Spy, también por ejemplo como el rediseño del modal de nuevo competidor, entonces eso también hace
falta».

**Tiene razón y el error es mío.** Lo marqué HECHO porque le puse **una entrada, vista previa y
confirmación** — o sea arreglé cómo FUNCIONA. El pedido del 2/11 era «rediseña el modal de nuevo
competidor», que es cómo se VE. Es exactamente la confusión que él me corrigió cuatro veces esta
semana con la tab: *«no quiero que corrijas o intentes mejorar lo que ya hiciste»*.

Lo que haría falta, y el método está medido: empezar por `docs/diseno/referencia-spy.md` (la
anatomía de modal sacada del navegador) y NO por `SpyApp.tsx`. Si el primer archivo que se abre es el
nuestro, es una mejora, no un rediseño.

### ✅ Lo que quedó andando hoy

| | qué |
|---|---|
| **Las 22 caricaturas ya dibujadas entran en la tarjeta** | `ff17d32ba`. Se empareja por nombre comparable, sin tabla de @: `alexhormozi`, `hormozi` y «Alex Hormozi» colapsan al mismo texto. ⚠️ **Sin cartel «Inspirado en» y a sangre**: le había puesto el cartel y un 10 % de aire alrededor del dibujo, y Martín sacó las dos cosas — «eso no tiene sentido» y «deberían ocupar todo el ancho, no estar chiquititas en un cuadrado». Foto y caricatura se dibujan IGUAL |
| **No hay dos Hormozi** | el alta guarda el nombre DE VERDAD que ya leía la vista previa (antes: `alexhormozi`, o `UCxxxx` si pegabas su canal — por eso salían dos tarjetas), y el referente entró como tercera llave de deduplicación |
| **El link de su bio** | `4ad25d54d`. Entra como landing, o como YouTube si su bio enlaza su canal |
| **El @ en el CRM** | `c85e10ec2`. Pedía una clave de Apify que no existe |

### ⏳ Lo que falta de Spy, en orden de lo que Martín pidió

| | qué falta | por qué no está |
|---|---|---|
| **13** | **compartir el análisis entre todos los usuarios** | la decisión está tomada (caché global por `ref` de canal; la LISTA de cada negocio sigue siendo suya). Falta una migración con RLS y la pantalla. **Es lo más grande que queda y Martín lo volvió a pedir con prioridad.** Delegado a una sesión en la nube; no volvió nada todavía |
| **8** | **el rediseño del modal** (lo de arriba) | se confundió «funciona» con «se ve bien» |
| **10** | **el desplegable con varios perfiles** | es una BÚSQUEDA, y lo que tenemos es lectura por @ exacto. Necesita un actor de búsqueda de Apify: Martín ya dijo que paga, falta elegirlo y medir qué cuesta por búsqueda |
| — | **generar caricaturas NUEVAS** (para quien no es referente) | el camino es Google Flow (`lib/flow-imagen.ts`, acepta foto de referencia). **Falta UN dato antes de construir: sobre qué cuenta de Google corre el puente.** Si corre sobre la de Martín, generar para los competidores de cada cliente le gasta a él |
| **21** | probar punta a punta la clave de Apify de ws 9 | gasta del tope diario de un cliente real; se prueba junto a una lectura que de todos modos había que hacer |
| **12** | pasar de 25 publicaciones POR META | Business Discovery no tiene credencial desde el 22/10. Un límite que Meta no acepte hace fallar la consulta ENTERA: no se toca a ciegas |
| — | elegir publicaciones a dedo desde el perfil | es trabajo de la extensión, no de la tab |

### 🎯 Los 22 que ya tienen cara: Martín pega el @ y sale dibujado

Él pidió los @. **No hace falta que yo los adivine, y es mejor así:** el emparejamiento es por nombre,
y la vista previa ya lee el nombre real del perfil. O sea que pegando el @ que él conoce, el sistema
reconoce a la persona por el nombre que devuelve Instagram y le pone la caricatura. **Un @ puesto de
memoria por mí traería a OTRA persona**, que es el error que ya pagamos con los gurús.

Alex Hormozi · Juan Osorio (Juan ADS) · Julián Otálora · Sofía Contreras · Marcos Razzetti ·
Víctor Heras · Agustín Nievas · Derek Chamizo · David Turu · Ximena Fukuda · Guille Collado ·
Marc Verdú · Ramiro Cubria · Iman Gadzhi · Felipe Vergara · Jaime Higuera · Adrià Sola Pastor ·
Augusto Bianchi · Tino Mossu · Jordi Segués · Emilio Puigrredón · Julián Alborna

⚠️ **Y los duplicados que YA están en la base no se arreglan solos.** El arreglo impide los nuevos.
Los que hay («sofiacontreras» vs «Sofia Contreras», «hormozi» vs «@AlexHormozi» vs «acquisition.com»)
hay que borrarlos a mano desde la tarjeta. ⚠️ **`acquisition.com` no se va a juntar con Hormozi
nunca**: un dominio no se empareja con una persona, y hacerlo necesitaría una tabla de dominios.

## 🎫 EL PROGRESO DE UN TICKET, PARA QUIEN LO LEVANTÓ — 2/11/2026

Joan, por WhatsApp: «¿cómo van esos tickets?». Martín: «que cuando él levante un ticket… le diga,
mira el progreso de tu ticket aquí, y que él pueda ir viendo: tu ticket fue levantado, el equipo lo
revisó, ya lo están desarrollando. Y también… que se le envíe por email los avances. Y solamente
cuando ya esté 100 % finalizado, ahí sí el mensaje de WhatsApp que ya tenemos».

**Lo que YA existía y nadie le había dicho:**
· Los estados de cara al cliente: `EstadoCliente` = recibido · en curso · tu respuesta · resuelto ·
  cerrado (`lib/tickets-reglas.ts:76`).
· La LÍNEA DE TIEMPO con fechas: `pasosDelTicket` (recibido → en curso → arreglado → resuelto →
  cerrado), que dibuja la pantalla `/tickets?t=<id>`.
· Que WhatsApp **ya avisa sólo al final**: `avisarPendientes` (`lib/tickets-cierre.ts:124`) manda
  «cerrados, resueltos o con una pregunta del equipo». O sea que esa parte del pedido ya estaba bien.

**Lo que faltaba de verdad, y es por lo que Joan preguntó:** la respuesta del grupo terminaba en
«te aviso por aquí cuando esté» y **no nombraba la pantalla**. La única forma de saber algo era
esperar o preguntar.

**HECHO** (`53f6f2f26`): la respuesta del grupo lleva «Mirá cómo va acá: …/tickets?t=<id>».
La base viaja por PARÁMETRO y no por import: `lib/despacho-grupo.ts` es puro y sus tests lo ejecutan
directo; importar `APP_BASE_URL` arrastraría `ws-tab` y las landings. Sin base, la frase es la de
antes palabra por palabra, y hay tests de las dos formas.

**FALTA — el email de avance.** Es lo único del pedido que no está:
· Hoy `avisarPendientes` dispara en resuelto / cerrado / pregunta del equipo. El avance intermedio
  («el equipo lo revisó», «ya lo están desarrollando») **no dispara nada**.
· El camino: colgar el aviso del cambio de `EstadoCliente` —no del estado interno, que tiene ocho
  valores y varios no le dicen nada a nadie— y mandarlo por Resend desde `equipo@hola-mako.com`,
  que es el remitente de la casa (`lib/app-url.ts`, `EMAIL_MAKO`).
· ⚠️ **Con tope por ticket.** Un ticket que rebota entre «en curso» y «esperando cliente» mandaría
  un correo por rebote. El patrón ya existe en el repo: `avisado_at` por hito, no por cambio.
· ⚠️ **Y el WhatsApp NO se toca:** sigue sólo al final, que es lo que Martín pidió y lo que ya hace.

### 💸 DECISIÓN DE PLATA QUE MARTÍN PUEDE REVERTIR — 2/11/2026

**El alta del CRM ahora puede gastar la clave de Apify del negocio.** Hasta el 1/11 la regla era
«Apify: sólo Spy», y `tests/leads-scraper-retirado.test.ts` la hacía cumplir con estas palabras: *«el
alta del CRM y Offer siguen sin poder gastarla»*. Por eso el run #361 salió rojo, y **el rojo era
correcto**: mi cambio del ítem 9 la rompía.

Gana el pedido posterior —Martín, 2/11: «ya con Apify debería funcionar el traer el perfil
escribiendo el @, eso también en el CRM»—, pero **es plata del negocio**, así que queda acá y en el
guard, con fecha y con cómo se revierte, en vez de aflojarse en silencio.

**Qué gasta, exactamente:** cuando ni Meta ni Google traen nada, el buscador lee UN perfil por @
EXACTO con `APIFY_CLAVE_DE_SPY`. Mismo tope diario que Spy (`APIFY_TOPE_POR_DIA`) y la pantalla
espera a que la persona deje de escribir, así que no se gasta por tecla. **El scraper de leads NO
vuelve**: eso es búsqueda masiva, se llamaba `apify` a secas, y el guard lo sigue prohibiendo. Offer
tampoco puede gastarla.

**Para revertirlo:** sacar `'apify-spy'` de las fuentes en `app/api/crm/instagram-buscar/route.ts` y
dejar el guard como estaba.

### 🖼️ Y un rojo que se cazó ANTES de subir

Agrandar las caricaturas a 600 px iba a poner en rojo `tests/coaches-ops-center.test.ts`: exige
menos de **150 KB** por cara porque la lista de chats del Ops Center las baja TODAS, y a 600 px
quedaban en ~159 KB. **Un archivo no puede servir a los dos.** Ahora son dos:
`public/asesores/<id>.png` (200 px, la lista) y `public/asesores/grandes/<id>.png` (600 px, la
tarjeta de Spy), con un test que exige que cada referente tenga las dos.

### 🔗 ÍTEM 13 — CÓMO SE TERMINA EL CABLEADO (la base ya está, 2/11/2026)

**Hecho y aplicado en producción:**
· `supabase/migrations/0363_spy_lecturas_compartidas.sql` — tabla `spy_lecturas_canal`, con clave
  `(canal, ref)`. **Sin `workspace_id` a propósito**: si guardara quién la pidió, diría a quién
  vigila cada negocio, que es justo el dato que NO se comparte. RLS prendida y sin políticas, igual
  que `spy_competidores` y `spy_piezas` (0359): sólo el service role.
· ⚠️ **NO AGREGAR `spy_lecturas_canal` A `TENANT_TABLES`** (`lib/workspace.ts:87`). El proxy le
  estamparía un `workspace_id` que la columna no tiene y rompería toda escritura. Es global a
  propósito, y ese concepto ya existe: lo que no está en esa lista pasa sin scoping.
· `lib/spy-compartido.ts` — la regla, pura y con test probado rompiéndolo
  (`tests/spy-lectura-compartida.test.ts`).

**La regla, que es lo que separa ahorrar de mentir:**

| cuándo se lee | sirve la lectura de otro |
|---|---|
| **alta** de un competidor nuevo | hasta **24 h** — no hay nada en pantalla, y una lectura de ayer vale más que un cuadro vacío mientras se gasta un crédito. **Acá es donde se ahorra de verdad** |
| **rutina** (revisión de fondo) | hasta **6 h** |
| **«Revisar ahora»** | **NUNCA.** Quien toca ese botón está mirando y pide datos de HOY. Ahí se lee de verdad y se refresca la copia compartida para todos |

**Lo que falta, en orden, y es todo en `lib/spy.ts` → `mirarCompetidor` (línea ~514):**
1. Antes de `leerPerfilInstagram` y del lector de YouTube: armar la clave con `claveDeCanal` y, si
   `sirveLaCompartida(motivo, fila.leido_en, Date.now())`, usar `fila.piezas` en vez de llamar.
2. `mirarCompetidor` necesita recibir el **motivo** (`'alta' | 'rutina' | 'a-pedido'`). Hoy no lo
   tiene: el alta y el botón entran por el mismo camino. **Sin ese parámetro no se puede cumplir la
   regla de arriba**, así que es el primer paso, no un detalle.
3. Después de una lectura de verdad: `upsert` de la fila con las piezas y el perfil.
4. Sumar 1 a `ahorros` cada vez que se sirve sin pagar. Es la medida de si esto sirve: si queda en
   cero, nadie mira a los mismos y la tabla no se ganó el lugar.
5. Podar lo que pase de `DIAS_QUE_SE_GUARDA` (30).

⚠️ **Lo que NO cambia, y conviene no tocarlo:** `spy_piezas` y `spy_competidores` siguen por
negocio, con su borrado de siempre. El usuario saca al competidor de SU lista y la lectura
compartida no se toca. **Nadie ve la lista de nadie.**

### 🧠 ÍTEM 17 — EL SECOND BRAIN DE UN GURÚ: EL MECANISMO YA ESTÁ (2/11/2026)

Martín: «me interesa que se avance con los gurús, y el second brain de cada uno».

**Hecho:** `lib/cerebro-referente.ts` + `tests/cerebro-referente.test.ts` (7/0, probado
rompiéndolo). Es la capa de UN gurú: su raíz, **un nodo por CLASE con la transcripción entera y sin
tope**, y las clases encadenadas en orden.

**Las dos mitades de la regla, y las dos tienen test:**
· el `cuerpo` de una clase **no se recorta** — el tope de 5.200 es de la FICHA, que viaja en cada
  mensaje; esta capa viaja sólo cuando la pregunta la pide;
· el `detalle` **no puede llevar el texto** — el índice sí viaja siempre, así que una clase de 40
  mil caracteres ahí metería el curso entero en cada turno, que es justo lo que se está evitando.

**Por qué esto cuesta horas y no millones de tokens:** el texto va CRUDO a la capa. No pasa por el
modelo. Lo caro de un gurú es la FICHA (175–285 mil tokens de subagente, medido por la sesión del
Ops Center); la capa es copiar archivos.

⚠️ **LO QUE FALTA, en orden:**
1. **El lector del servidor.** `armarReferente` recibe las clases ya leídas, a propósito: es puro y
   los tests lo ejecutan. Falta quien saque los `videoId` del curso (`app/conocimientos/curso-*.ts`)
   y lea `public/cono-tx/<videoId>.json` — que es una **LISTA de strings**, no un string.
2. **Colgarla con `conCapa`** (`lib/cerebro-union.ts:60`), como hace `lib/cerebro-knowledge.ts`.
3. **Cuándo entra la capa en el turno.** Knowledge tiene esa decisión escrita y es la parte fina:
   nombrar al gurú NO alcanza, igual que nombrar un módulo no alcanza para Knowledge. Copiar ese
   criterio, no inventar otro.
4. **El botón del grafo (ítem 18)**, que es la parte chica: las piezas ya existen.

⚠️ **Y no depende de que estén las 12 fichas.** La capa se arma desde el catálogo: sirve hoy para
Puigrredón y Alborna, y los otros diez entran solos cuando se carguen.

**Avance del 2/11 ~20:10 — el lector del servidor ya está** (`lib/cerebro-referente-server.ts`), o
sea el paso 1 de los cuatro de arriba. Lee `public/cono-tx/<videoId>.json`, que es una LISTA de
strings, y arma las clases en el orden del curso. Una clase sin transcribir NO rompe la capa: queda
afuera y el resto se arma igual.

**Medido contra los cursos de verdad, no supuesto:**

| referente | clases | con transcripción | caracteres |
|---|---|---|---|
| Emilio Puigrredón — «Social Funnel» | 11 | **11** | 78.695 |
| Julián Alborna — «Inteligencia Viral» | 41 | **41** | 742.094 |

Ninguna clase sin transcribir. Y esos **742.094 caracteres de un solo gurú** son la prueba de por
qué esto no podía ir en la ficha: ahí viajaría en CADA mensaje de cada chat.

Quedan los pasos 2, 3 y 4: colgarla con `conCapa`, decidir cuándo entra en el turno (copiando el
criterio de Knowledge, que es la parte fina) y el botón del grafo.

⚠️ **CORRECCIÓN AL PASO 3 DE ARRIBA (2/11 ~20:25): la capa de un referente NO lleva el heurístico de
Knowledge, y copiarlo habría sido resolver un problema que acá no existe.**

Knowledge necesita `esPreguntaDeConocimiento` porque va en TODOS los negocios y los nombres de sus
módulos son palabras del negocio: «¿cuál es mi oferta?» no pregunta por el método de armar una. La
capa de un gurú **se cuelga sólo cuando el chat TIENE a ese gurú al frente**, cosa que el servidor
ya sabe (`lib/asesores/contexto.ts`). Si el chat es con Alborna, su curso es pertinente por
definición; si no, la capa ni se arma.

El criterio es **«¿qué referente tiene este chat?»**, no «¿de qué habla la pregunta?»: más barato y
más exacto.

**El punto de enganche exacto:** `lib/cerebro-para-chat.ts` → `armar()`, con `conCapa`, donde hoy se
cuelgan «Lo que hace MaKo» y Knowledge. Y la capa se pide con `cerebroDeReferenteMemo`, que la lee
UNA vez por proceso: sin eso, cada turno abriría los 41 archivos del curso de Alborna.

### ✅ DESPLEGADO Y VERIFICADO EN PRODUCCIÓN — 2/11/2026 ~20:45

`origin/main` = **`90cd7f126`** (run #364 verde). Mirado en hola-mako.com/competitor-spy, no en una
maqueta: **2 tarjetas, las dos tirando de `/asesores/grandes/`, cero carteles «Inspirado en», y la
animación `spy-flota` activa**.

Entró todo lo visible de Spy: caricaturas, movimiento, 600 px, imagen a sangre, «Su web», el @ en el
CRM, el link de la bio, la deduplicación por referente y el link de progreso del ticket. Más el
modal de difusión del CRM, que vino de la sesión de Automations.

⚠️ **Y mirándolo en producción saltó una cosa que la maqueta no mostraba:** una tarjeta decía
**«@AlexHormozi»**. El alta guarda el nombre completo desde hoy, pero **los competidores que YA
estaban se guardaron con lo que se pegó** —un @, o el id de un canal— y esas filas no se arreglan
solas.

**Se arregló al DIBUJAR, no tocando la base** (`nombreDeTarjeta`): el nombre guardado es del negocio
y reescribirlo sería cambiarle un dato sin que lo pida. Y no pisa un nombre que el negocio haya
puesto: «Hormozi (competencia directa)» se respeta tal cual, porque sólo entra cuando lo guardado ES
una de las formas del referente. Con test de las dos mitades.

**La regla que queda:** un arreglo que sólo corre al CREAR no toca lo que ya existe. Si el dato viejo
se ve en pantalla, o se repara la base o se decide al dibujar — pero hay que elegir, porque «lo
arreglé» sobre el camino de alta no arregla lo que el usuario está mirando.

### 📧 EL EMAIL DE AVANCE DEL TICKET — la regla y la migración, 2/11/2026

**Hecho y aplicado en producción:** `0364_ticket_avance_por_email.sql` (columnas `avance_email` y
`avance_email_at` en `tickets`) + `lib/tickets-avance.ts`, con `tests/tickets-avance.test.ts` 7/0
probado rompiéndolo.

**Las dos reglas, que son las que se rompen en silencio:**
1. **Sólo hacia ADELANTE.** Un ticket que rebota entre «en curso» y «esperando cliente» no manda un
   correo por rebote: el tercero va a spam y el cuarto no lo lee nadie. Por eso la columna guarda
   QUÉ hito se avisó y no un booleano.
2. **«cerrado» NO manda correo.** El cierre ya avisa por push, por el chat y por WhatsApp
   (`avisarPendientes`). Un correo más sería el cuarto aviso de lo mismo, y Martín pidió que el
   final siga siendo el WhatsApp que ya existe.

⚠️ **`avisado_at` no se toca**: es del aviso FINAL. Mezclarlos haría que un correo de avance tape el
aviso de cierre.

**FALTA el envío**, y son tres cosas, ninguna difícil:
1. Un camino que mire los tickets cuyo `EstadoCliente` de hoy (`estadoClienteDe`,
   `lib/tickets-reglas.ts:76`) sea posterior a su `avance_email`. ⚠️ **No sirve la consulta de
   `avisarPendientes`**: ésa filtra `estado in ('resuelto','rechazado','duplicado','esperando_cliente')`,
   o sea sólo los finales — justo los que NO son avance.
2. Mandarlo con Resend desde `EMAIL_MAKO` (`lib/app-url.ts`), que es el remitente de la casa.
3. Escribir `avance_email` y `avance_email_at` **después** de que salga, nunca antes: si se marca
   primero y el envío falla, ese hito no se avisa nunca más.

### 🔗 EL ESLABÓN QUE FALTABA: qué curso es de cada gurú (2/11/2026 ~21:40)

`lib/asesores/cursos.ts` + `tests/asesores-cursos.test.ts` (4/0, probado rompiéndolo).

La capa de un gurú necesita SU curso, y hasta acá no había forma de saber cuál: `Asesor.curso`
guarda el título en prosa («Social Funnel»), no el slug con el que se busca. **Ahora están los
DOCE**, no sólo los dos que tienen ficha: a los otros diez les falta la ficha, no el curso.

⚠️ **Cada slug está verificado abriendo el archivo del curso, y el test los vuelve a abrir.** Un
slug con una letra cambiada no rompe nada a la vista: el gurú se queda sin Second Brain y nadie se
entera. Deducirlos del nombre ya puso dos mal en producción.

⚠️ **Albaa y Nievas comparten curso a propósito** («Growing Closer»). Hay un test que lo fija, para
que nadie lo «arregle» creyendo que es un duplicado.

**Con esto, para que el Second Brain de un gurú funcione falta UNA sola cosa**, y es una línea:
colgar la capa en `lib/cerebro-para-chat.ts` → `paqueteParaElTurno`, que tiene que recibir el
`IdAsesor` del turno. Hoy el asesor se resuelve en la ruta (`app/api/mako/chat/route.ts`,
`app/api/offer/route.ts`) y no baja hasta ahí: ese parámetro opcional es todo el trabajo que queda.

### 🚫 OFFER FUERA DE LA BARRA — 2/11/2026 ~21:45

Martín: «elimina las tabs de offer… si rompe cosas la de ads manager, dejala, pero la de offer no la
quiero». **Ads Manager NO se tocó**, tal como pidió.

**Se sacó de la barra SIN borrar la entrada**, y la diferencia importa: un test lo gritaba —«la key
es contrato con la base»—. La key `offer` la resuelven con `itemNav('offer')` los permisos por capa
(`navKeys`, lib/capas.ts), el onboarding por tab, el móvil y el catálogo de la API. Borrarla les
devuelve `undefined` a todos, y **el daño no sería que falte un renglón: sería un negocio perdiendo
el permiso de una tab porque su key dejó de existir.** Eso fue lo que rompió los seis tests el
intento anterior.

**Cómo quedó:** un flag nuevo, `fueraDeLaBarra`, chequeado en `puedeVerItem`
(`lib/nav-visibilidad.ts`), que es la puerta compartida por la barra y el móvil. El ítem existe, la
key vive, **pero no se dibuja en ningún lado**. No bloquea la página: el enforcement real es
server-side (`lib/tab-access`), así que **/offer sigue respondiendo** y se llega desde el Ops
Center, donde está el Offer Coach — que es lo que él pidió el 1/11.

⚠️ **Se verificó ANTES de sacarlo que Strategy no quedaba huérfana.** El renglón de Offer marcaba
también `/admin/estrategia`; Strategy tiene el suyo propio (`admin-estrategia` en `ADMIN_NAV`), así
que al sacar Offer la barra marca ése. Si no lo hubiera tenido, sacar Offer la dejaba sin nada.

⚠️ Y la convención dice que `nav.ts` lo toca sólo el chat Sidebar. Ese chat no está vivo y Martín lo
pidió directo, así que queda anotado acá para su dueño.

## ✅ DOS DECISIONES DE MARTÍN — 2/11/2026 ~21:50, destraban dos ítems

**1. El gasto: aprobado, y yo elijo.** Textual: «con respecto a cuánto estoy dispuesto a gastar, la
verdad es que no tengo problema, o sea, tú determínalo y me vas diciendo cuánto va a ser el gasto…
pero impleméntalo ya».

· Destraba el **ítem 10** (el desplegable con varios perfiles al escribir el @): hay que elegir un
  actor de BÚSQUEDA de Apify, no de lectura por handle.
· ⚠️ **Lo que sigue siendo obligación nuestra: DECIRLE el número.** No es un cheque en blanco, es
  «elegí vos y contame». Antes de prenderlo hay que medir el costo por búsqueda y escribirlo acá.
· ⚠️ Y poner un **tope por día**, como ya lo tiene la lectura por handle (`APIFY_TOPE_POR_DIA`).
  Una búsqueda por tecla vacía el presupuesto de un negocio en una tarde: la pantalla ya espera a
  que la persona deje de escribir, y eso NO se toca.

**2. El puente de Google Flow corre sobre la cuenta de Martín, y aprueba generar con ella.** Textual:
«sí, es sobre la mía, la que vamos a generar las caricaturas de Google Flow. Eso también quiero que
lo implementes ya».

· Destraba **la caricatura de un competidor que no es referente**. Era la única pregunta abierta:
  si el puente corría sobre su cuenta, generar para los competidores de CADA cliente le gasta a él.
  **Lo sabe y lo aprueba.**
· El camino ya está medido: `lib/flow-imagen.ts` acepta `referenceEntities`/`referenceLikenesses`,
  el token del puente es un BEARER que sirve fuera del navegador, la foto de origen es
  `spy_competidores.avatar` (migración 0362) y el prompt aprobado está textual en
  `docs/hallazgos-ops-center.md`.
· ⚠️ **Sigue valiendo lo que NO cambió con esta decisión:** va como trabajo APARTE de la lectura
  («Revisar ahora» ya casi se pasa del tiempo de la función), con **tope** —«para cada competidor
  nuevo» sin límite suma rápido y ahora la factura es de Martín—, y la tarjeta muestra la foto
  mientras tanto.

**2/11 ~23:40 — ÍTEM 13 CABLEADO.** `mirarCompetidor` ahora recibe el MOTIVO y consulta la caché
compartida antes de pagar una lectura de Instagram, y la refresca después. El alta pasa `'alta'`
(sirve hasta 24 h, y es donde se ahorra de verdad); **«Revisar ahora» va siempre sin motivo, o sea
`'a-pedido'`, que NUNCA usa la caché.**

⚠️ **El default de `mirarCompetidor` es `'a-pedido'` a propósito:** quien no dice para qué está
leyendo se lleva datos frescos. Equivocarse hacia «leer de más» cuesta un crédito; equivocarse hacia
«servir lo de otro» le muestra a alguien datos viejos creyendo que son de hoy.

⚠️ **Guardar la caché NUNCA bloquea ni tira** (`void guardarLecturaCompartida`): si falla, el
negocio ya tiene sus piezas y lo único que se pierde es el ahorro del siguiente.

**Falta de este ítem:** el mismo tratamiento para YouTube (hoy sólo Instagram, que es la que gasta
créditos del negocio) y la poda de lo que pase de 30 días. Y mirar `spy_lecturas_canal.ahorros`: si
queda en cero, nadie mira a los mismos y la tabla no se ganó el lugar.

## 🔍 EL BUSCADOR MIENTRAS SE ESCRIBE — SON TRES COSAS, NO UNA (2/11/2026 ~00:00)

Martín: «te había pedido que cuando yo vaya buscando una arroba, de un competidor, o incluso en el
CRM, ya vaya saliendo ciertos resultados mientras voy escribiendo… y eso no lo veo que lo tengas en
los pendientes… no quiero que te pregunte cuáles son nuestros pendientes y me des información a
medias». **Tenía razón: yo lo tenía como un solo ítem y son tres.**

### ✅ LOS TRES, HECHOS Y EN `main` — 3/11/2026 (sin desplegar todavía: ver el bloque de arriba)

| Dónde | Qué pasa AHORA | Commit |
|---|---|---|
| **Spy, con @** | el desplegable existe: ofrece candidatos con foto mientras se escribe | `0aafde481` |
| **Spy, SIN @** | busca por NOMBRE, sin que haga falta el @ — **no se construyó un buscador nuevo**: se reusó el del alta de un lead (`app/crm/new/InstagramBuscador.tsx`), que ya busca por nombre, muestra fotos, abre la lista en un portal y tiene resueltos Escape y Enter | `0aafde481` |
| **CRM** | el desplegable ya existía; lo que le faltaba era un motor que ande sin Meta ni Google CSE, y ahora lo tiene: `app/api/crm/instagram-buscar/route.ts:337` cae a Apify como tercera fuente | `0aafde481` |

**El actor de búsqueda, elegido y medido** (`lib/instagram-buscar-apify.ts` y su mitad pura
`lib/instagram-buscar-apify-reglas.ts`): `apify~instagram-scraper`, 8 resultados por búsqueda,
**US$ 1,50 el millar → US$ 0,012 por búsqueda**. Martín había aprobado el gasto y pedido el número.

⚠️ **Y se probó contra el actor de verdad, no sólo con tipos — que es lo que encontró el error.**
De 7 candidatos, **sólo 1 traía `username`**; los otros 6 venían con `error: 'no_items'` y el @ había
que leerlo de la `url`. Un test de tipos jamás lo habría visto: el campo existe en el tipo. Por eso
`usuarioDeUrl` saca el @ de la URL y rechaza `/p/`, `/reel/`, `/explore/` y `/stories/`.

⚠️ **Y NO se llama en cada tecla.** Cada búsqueda gasta del tope diario: la pantalla espera a que la
persona deje de escribir (900 ms) y eso no se toca. «Mientras escribo» significa *sin apretar un
botón*, no *una llamada por tecla*: con una por tecla, «leilahormozi» son trece lecturas y dos altas
agotan el día del negocio.

## 🎨 LA CARICATURA POR FLOW — la arquitectura, medida (3/11/2026 ~00:30)

Martín confirmó que el puente corre sobre SU cuenta y pidió hacerlo. Esto es lo que hay que saber,
leído de los archivos, para que no haya que volver a descubrirlo:

**NO se llama a Google desde el servidor. Hay una COLA.** La app encola un trabajo
(`encolar(tipo, pedido)`, `lib/flow-cola.ts`) y el PUENTE —el navegador de Martín— lo toma y lo
ejecuta. Los tipos son `'subir_imagen' | 'generar_imagen' | 'generar_clip' | ...`.

**La receta exacta está en `app/ai-avatar/actions.ts:171`, y es de DOS pasos:**
1. `caraDeFoto(fotoId)` → el `mediaId` de esa foto DENTRO de Flow. Si todavía no está, encola
   `'subir_imagen'` y devuelve `''`; se reintenta en unos segundos. **No es sincrónico.**
2. `encolar('generar_imagen', pedidoImagenInterfaz({ prompt, cara, ruta }))`.

**Lo que hay que escribir para el competidor** (`lib/spy-caricatura-flow.ts`, no existe todavía):
· un `caraDelCompetidor(id, avatarUrl)` equivalente a `caraDeFoto`, pero leyendo de NUESTRO bucket
  (`spy_competidores.avatar`, migración 0362) en vez de `persona.fotos` del AI Avatar. El resto es
  igual: buscar un `subir_imagen` anterior por una clave estable (`spy:<id>`), y si no hay, bajar el
  avatar y encolarlo;
· el prompt aprobado, textual, está en `docs/hallazgos-ops-center.md`. **Va como prompt EDITABLE**
  (`.claude/skills/add-editable-prompt`), no hardcodeado;
· guardar el resultado en el bucket `spy-miniaturas`, con su propia ruta.

⚠️ **NO adentro de «Revisar ahora»**: generar tarda mucho más que bajar una imagen y esa función ya
casi se pasa del tiempo de la ruta. Va como trabajo aparte, después de crear el competidor.
⚠️ **CON TOPE**, y ahora más que antes: la factura es de Martín. `TOPE_CREDITOS.imagen`
(`lib/flow-interfaz.ts`) es el molde que ya usa el AI Avatar.
⚠️ **Hoy no urge para sus dos competidores**: Sofía Contreras y Alex Hormozi YA muestran caricatura,
porque son referentes y se reusó la dibujada. Esto hace falta para el competidor que NO es gurú.

**3/11 ~00:40 — el modal: la vista previa pasa a la anatomía de la tarjeta.** Tenía una cara de
**56 px al costado**, que es exactamente lo que Martín me hizo sacar de la lista («que no esté
chiquito arriba, que tenga protagonismo»). Yo apliqué esa corrección en la tarjeta y no acá. Ahora
la imagen manda: cuadrada, a sangre, con el texto abajo. **Es el momento en que la persona confirma
QUIÉN es: si hay un lugar donde la cara tiene que verse, es ése.**

⚠️ **Lo que NO cambié, y es una decisión:** las dos pestañas («Pegar un dato» / «Cargar a mano»)
siguen. Sacarlas iría con la doctrina de «una entrada, no un formulario», pero «Cargar a mano» es el
único camino para dar de alta a alguien con nombre propio y tres canales a la vez. Convertirlo en un
enlace discreto abajo es el paso siguiente, y es cambio de estructura: va con Martín mirando.

⚠️ Y verifiqué algo antes de «arreglarlo»: el `<h2>` del modal NO duplica el título, porque el
`label` de `ModalShell` es sólo `aria-label` y no se dibuja.
