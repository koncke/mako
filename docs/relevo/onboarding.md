# Onboarding: el arranque del cliente nuevo y el onboarding de cada tab

## ESTADO AL 21/10/2026 ~00:30 AR — LA SEGUNDA REVISIÓN (de 4eef10c7a) ARREGLADA

<sub>Chat «Onboarding», claude4, rama onboarding-v3. El Cerebro revisó 4eef10c7a: el BLOQUEA resuelto, pero los arreglos de
la fase escrita trajeron errores nuevos (side-session-notes/local_797d5445…/revision-onboarding-20-10-noche.md). Cosecha:
«La segunda revisión» dentro de «La revisión adversarial de onboarding-v3», en docs/hallazgos-onboarding.md.</sub>

- Sin respuestas rápidas en el nombre ni en el negocio, tampoco el del alta (lo decidió el Cerebro: gana Martín): `be2a4e4eb`.
- Las cifras (millones, letras, lunfardo, rangos, cifras sueltas, semana y año), la negación marcada en las opciones, el
  canal sin «directo», el «sí» compuesto, «con tarjeta» mensual y el «Entrando…»: `9259ca8d3`. La batería de frases es
  tests/onboarding-cifras-escritas.test.ts.
- La guardia del texto largo: cuenta como turno y documento, sólo el insulto de su principio, recortado antes de leer: `e78d76c4c`.
- Siguen sin hacer: el paso a `CajaChat` (cuando caja-voz llegue a main), el tutorial en /m, la propuesta del CRM aparte.
  Y esperan el sí de Martín: el ws21 y las dos keys del ws1.

## ESTADO AL 20/10/2026 ~22:00 AR — LA REVISIÓN ADVERSARIAL DE v3 ARREGLADA

<sub>Chat «Onboarding», claude4, rama **onboarding-v3** (C:/dev/wt-onboarding-v3, ya con florencia adentro). El Cerebro
revisó beb153118 («no sube todavía»): side-session-notes/local_797d5445…/revision-onboarding-v3-20-10.md. Todo lo que
marcó está arreglado encima, cada uno con su test probado rompiéndolo; la cosecha es «La revisión adversarial de
onboarding-v3» en docs/hallazgos-onboarding.md.</sub>

**Hecho** (bloquea, importantes y menores de la revisión):
- El «Sí» escrito ya no se guarda como nombre; todo lo escrito se confirma (`siONo`): `c73a26fdb`.
- El hilo: reserva con compare-and-set, un insert, lecturas estrictas, marca en el contexto, `dueno`/`hiloDe`, sólo con
  status 'done', fuera el ws1, capa con productos, timeout y «Entrando…» en la pantalla, también en /m/second-brain: `88a5ebd05`.
- La fase escrita: cifras a su tramo, canal por sinónimos sin negación, empates null: `6f3e53d26`.
- La entrada del teléfono no la pinta el server (script antes de pintar): `80c997d4c` + `6c3e3a8c4`.
- Texto largo sin la guardia de inyección; link sin leer con `linksDe` en el servidor: `6a6e5af41`.
- El tope de repreguntas por pieza: `2f2c9aaa6`. Cuotas de tarjeta = único; terminales del CRM; plazo 25/45 s: `f01e15e18`.
- Arrastrar un archivo con sólo texto no lo abre Chrome; el test de la caja compara por pieza y lee CajaChat si existe: `27460055c`.
- La conversación de Offer del onboarding se esconde sólo a quien tiene la copia (lib/chat-mako-reglas.ts, archivo de
  Ops Center 3; les avisé): `ebea6fb25`.

**SIN HACER:**
- **Pasar a `CajaChat`** cuando caja-voz llegue a main: `accept: ACCEPT_IMPORTAR`, «Fotos» con video, `voz` y `estado`;
  borrar app/offer/CajaDelCentro.tsx. El test ya mira CajaChat apenas exista.
- /m/second-brain no lee `?recorrido=`: en el teléfono no hay tutorial.
- La propuesta del CRM a medida se sigue pidiendo antes de responder (25 s / 45 s con la red).
- ~~Choque de las respuestas rápidas del nombre~~ **DECIDIDO (Cerebro, 20/10 noche): gana Martín.** Ni el nombre ni el
  negocio ofrecen opciones, tampoco el nombre del alta: `be2a4e4eb`.
- Reparar el ws21 y borrar las dos keys copiadas del ws1: siguen esperando el sí de Martín (abajo).

## ESTADO AL 20/10/2026 ~19:20 AR — LA TANDA DEL 18/10 CERRADA Y LA DE FLORENCIA (feedback del 20/10)

<sub>Chat «Onboarding», claude4. Dos ramas sin pushear: **onboarding-v3** (C:/dev/wt-onboarding-v3: la tanda del 18/10) y
**onboarding-florencia** (C:/dev/wt-onboarding-florencia, sale de v3: el feedback del 20/10). Se mergea florencia en v3 y
el VERDE (`antes-de-subir --rapido` con C:/dev/pesado.lock) va al Cerebro. El tsc acotado no entra en la RAM libre (ver
hallazgos-infra): los tipos se revisaron a mano.</sub>

**Hecho en onboarding-v3** (cada uno con su test probado rompiéndolo):
- 2, la entrada de MaKo al abrir la app en el teléfono: `ee2c96f26` (montada en el layout desde `2826d4df2`).
- 13b, al terminar entra al chat «Onboarding» con la conversación y arranca el tutorial: `b222b34fc`, `98df2846f`, `01553fd32`.
- 3, el chat del onboarding con la caja del Ops Center: `6b0154a1d` (+ `d78802587`).
- 10b, el CRM a medida de lo que vende (MaKo elige el tipo y nombra las etapas; las claves no cambian): `ef814400a`.

**Hecho en onboarding-florencia** (feedback del 20/10, puntos 2 y 3; el pedido literal es el hito del 20/10 en
app/admin/dev/onboarding/bitacora.ts, `0f46389e6`):
- 1, el chat «Onboarding» para quien ya terminó (en su primera visita al Ops Center; nunca mirando como super admin), con
  la salida que usa `interes` y dice dónde pedir ayuda: `c37574140`.
- 2, el nombre del negocio se entiende y se confirma antes de escribirse, y vuelve el nombre del alta: `1bbba201e`.
- 3, el cierre de «lo que vendes» lo escribe el código, dos repreguntas como mucho: `f8faebbc4`.
- 4, respuestas rápidas sin cifras inventadas y dos o más: `94d3e04b2` (su `numerosDe` borrado por error lo devolvió `1c39ed1dd`).
- 5, el link que no abre se le dice a MaKo: `1c39ed1dd`.
- 6, «sin dato» no llega al producto ni al brief, el PDF muestra lo que trae datos, la escalera sale, el producto toma
  cómo cobra: `5573b9730`.
- 7, un texto de más de 12.000 caracteres va a documento: `64f716ba9`; las preguntas con opciones aceptan texto («Lo tomé
  como»): `9333f968d`; el micrófono del onboarding graba una nota de voz (el dictado no se pudo probar con 2 min):
  `b6f40d5c6`.

**SIN HACER (con dónde vive):**
- **Reparar el ws21** (su nombre, el funnel 40, el producto 48, el PDF, el grupo): el script está escrito y NO se corrió,
  en `side-session-notes/local_797d5445…/feedback-20-10/reparar-ws21.ts` (sin `--aplicar` sólo lee). Espera el sí de
  Martín y el nombre que él elija.
- **Coordinar con Ops Center 3** que la conversación de Offer del onboarding (`onboarding.arranque.sesionId`) no salga
  dos veces cuando proyecten Offer en el Ops Center: se lo propuse el 20/10 (que la salteen si hay `hiloChat`); sin respuesta.
- 5b, el diagnóstico de fase repite el canal que ya contó (lib/onboarding-arranque.ts → preguntarFase).
- El voseo y el «Perfecto:» del modelo sin filtro de salida (lib/offer-ia.ts); `TOPE_PIEZA` corta las piezas con «…».
- El dictado de respaldo usa las keys del negocio (hallazgos-plan): es del Plan, no de este chat.
- **Pasar la caja del onboarding a la pieza única** `app/_chat/CajaChat.tsx` (Ops Center 3, rama chat-unico, 7237af372) cuando esté en integración: borrar app/offer/CajaDelCentro.tsx. Le pedí a Ops Center 3 que la pieza sume la nota de voz (`voz`) y la línea de estado; tests/chat-unico.test.ts deja al onboarding en su lista de pendientes.

## ESTADO AL 18/10/2026 ~18:30 AR — PEDIDO 9a143455 (Martín, 17:28), CUENTA AL 98 %

<sub>Rama onboarding-v3. Commits sin pushear, cada uno con su test probado rompiéndolo. Los puntos 4 y 9 (los 4 MB, el
«Máximo 4 archivos» y arrastrar en el Center) los tiene Ops Center 3.</sub>

**Hecho:**
- 13 `fd8ad2f87`: mirando a un cliente, el super admin no ve el Centro ni sus chats. `quienOpera()` mira
  `estaImpersonando`. Un cliente real nunca los veía.
- 11 `9bb120646`: tu respuesta se ve apenas la mandás (`ladoDeLaPregunta`, origen e interes en `despues`).
- 7 `47548221a`: etapa `pdf`, «Perfecto: ya tengo claro qué vendes… ¿está correcto?» Sí/No. Con No, se anota
  (`pdfOk`) y se sigue.
- 5 `6470c86f6`: de la oferta sólo qué vende, a quién y cuánto cuesta (`PIEZAS_DEL_ARRANQUE`).
- 8 `b785202c8`: las respuestas del funnel y del cuello sin VSL, creativos ni CPA (lib/fase-diagnostico.ts).
- 10 `ccc8f3588`: el CRM con sus etapas numeradas y «Sí, es correcto».
- 1 `26f689d63`: tocar cualquier lado empieza; sin el anillo azul del foco.
- 6 `cbb9851a0`: la vista previa del PDF en un visor propio por portal a <body> (el Modal quedaba dentro de la capa,
  tapado por las respuestas rápidas), y sin las marcas «[de: chat]» en el PDF.

**SIN HACER (con dónde vive):**
- **13b, entrar al chat «Onboarding» con toda la conversación y después el tutorial de la app.** Hoy entra a
  /second-brain (`RUTA_AL_TERMINAR`, lib/onboarding-arranque.ts) con el chat del Second Brain vacío
  (app/second-brain/ChatSecondBrain.tsx). Hace falta un hilo «Onboarding» en el chat del cliente con los mensajes del
  arranque (`mensajesDeArranque` + la conversación de Offer de `sesionId`) y lanzar el tutorial (los recorridos de
  app/_ui/Recorrido.tsx).
- **2, la misma entrada al abrir la app en el teléfono:** EntradaMako en el arranque de /m (app/m/…).
- **3, el chat del onboarding como el del Ops Center:** + para adjuntar, grabar audio, enviar no verde. Hay que copiar
  el composer de app/admin/operaciones (Conversacion.tsx o su barra), sin crear uno nuevo. Hoy el onboarding usa
  ChatOffer (app/offer/ChatOffer.tsx).
- **10b, el CRM a medida de lo que vende** (hoy es el tipo por canal, `tiposOfrecidos`).
- **5b, si hace falta acortar también el diagnóstico de fase** (6 preguntas más el canal, lib/fase-diagnostico.ts).


## ESTADO AL 18/10/2026 ~15:00 AR — CIERRE CON LA CUENTA AL 96 %

<sub>Martín autorizó seguir pasado el 95 % (pedido 9cb5e3a6 del Ops Center, 14:42). Rama onboarding-v3, VERDE
`0322b1536` (con origin/integracion), pasado al Cerebro.</sub>

**Lo de esta tanda** (feedback-18-10.md, «Onboarding, probado por Martín a las 14:00 ART», menos el 3):
- `1f7467b4d`: nunca «Conectar mi propia IA» en el onboarding (usa el crédito de la plataforma).
- `8819fc58f`: la entrada vuelve a esperar el clic (se revierte el avance solo de ffd0ea3ef).
- `d40986454`: «Analizando tu link…» / «Analizando N archivos…» mientras lee; los puntitos, sólo al contestar
  (`leeAlgo` en app/offer/ChatOffer.tsx).
- `12ad33b25`: RESET devuelve el nombre del workspace a «Cliente de Prueba» (lib/reset-workspace.ts,
  `NOMBRE_WS_PRUEBA`). El onboarding le escribe el negocio y el RESET no tocaba esa fila: por eso seguía
  «Consultesis». El nombre y el negocio ya no tienen respuestas rápidas («Ayelen», «Consultesis»).

**Después (18/10 ~15:50, Martín sacó el corte del 97 %):**
- `a57d85f53`: las preguntas de fase sin Meta Ads. Es el paso chico: mismos ids y cortes de día a mes, en
  lib/fase-diagnostico.ts. El diseño por canales sigue abajo.
- `3c111e29d`: «la foto de Mauricio». MEDIDO: el único miembro del ws 3 tenía el `foto_url` de Mauricio. Lo puso
  «Traer datos de Mau» (`copiarPerfilDelDueno`), cuyo recibo vive en app_settings, y el RESET lo borraba sin devolver
  el perfil. Ahora el RESET deja a los usuarios del ws de prueba con el nombre del ws, sin foto y sin `PERFIL_EXTRA`.
  (La lectura anterior que decía «sin usuarios» estaba mal: falló por una columna que no existe.)

**SIN HACER:**
- Ver en el navegador, con un RESET del ws 3, que la tarjeta quede sin la foto y con «Cliente de Prueba».
- Todo lo de la sección siguiente que sigue «sin hacer»: las preguntas de fase sin Meta, el vuelo de la estrella, la
  carga de toda la app y #850.


## ESTADO AL 18/10/2026 ~12:40 AR — CIERRE POR CUENTA AL 95 % (LO PRIMERO PARA QUIEN SIGA)

<sub>Chat «Onboarding», cuenta 4. Rama onboarding-v3 (C:/dev/wt-onboarding-v3), sin pushear: las puntas van al Cerebro
(local_797d5445…). En producción hasta el run 145: todo el punto 15 del feedback del 18/10 y la estrella.</sub>

**Commiteado y pasado al Cerebro en esta última tanda** (feedback de Martín probando el ws 3):
- `469115ee1`: mientras MaKo contesta, sólo los tres puntitos (ChatOffer, también /offer). Test offer-escribiendo.
- `96971a73c`: la pregunta pendiente manda. Con las cinco piezas y una pregunta de MaKo sin contestar, no sale el PDF
  (`preguntaAbierta` en lib/offer-marco.ts). Test onboarding-pregunta-abierta.
- `01d68e2ef`: «Lo que vendes» se mira EN el chat (modal con las páginas en SVG). El link sin ?ws= hacía que el super
  admin buscara la conversación en otro ws. Un iframe no sirve: X-Frame-Options DENY. Test onboarding-pdf-en-el-chat.
- `d4d17b4fb`: sin «Antes de terminar» ni «Última cosa». Test onboarding-sin-anuncios.
- `bb14efd03`: al terminar entra solo a /second-brain (1,5 s, fundido, navegación interna para no cortar el plan).
- El commit de este relevo arregla offer-vista-pdf.test.ts, el único rojo del VERDE de esos cinco.

**SIN HACER, con dónde vive:**
- **Las preguntas de fase suponen Meta Ads** (Martín: «el onboarding sólo tiene presente el tema de META ADS…»).
  Viven en lib/fase-diagnostico.ts → `PREGUNTAS` (`inversion`: «¿Cuánto inviertes por día en Meta Ads?»,
  `creativos`: «¿Cuántos creativos lanzas por mes?»). Cada opción vota una fase de 0 a 4 por su ÍNDICE.
  - **Paso chico propuesto, sin tocar el cálculo:** mismos ids y 5 opciones.
    - `inversion` → «¿Cuánto inviertes por mes en conseguir clientes (anuncios, prospección, contenido)?», con
      «Nada o menos de $600 / $600 – $3.000 / $3.000 – $9.000 / $9.000 – $30.000 / Más de $30.000». Son los mismos
      cortes de hoy, pasados de día a mes.
    - `creativos` → «¿Cuántas piezas nuevas para atraer clientes sacas por mes (anuncios, videos, posts, lead
      magnets)?», con las mismas 5 opciones.
  - **El diseño entero, después:** primero «¿por qué canales consigues clientes hoy?» (varias: anuncios, prospección,
    funnel orgánico, lead magnets, YouTube y los del catálogo de funnels), y después una pregunta por canal elegido.
    El voto de inversión no puede hundir a un negocio orgánico.
  - Los consejos de cada fase (`FASES`: «Prende Meta con poco», `estrategia.inversion`) y los pilares también están
    escritos para VSL más Meta: se reescriben con el diseño entero.
- **El vuelo de la estrella a la sidebar al terminar** (hoy es un fundido): FLIP de `[data-mako-foto]` hasta el ícono
  de Ops Center de la barra (`Criatura` con `estrella` en app/_components/Sidebar.tsx). Después del 20/10.
- **La animación como carga de toda la app** y **el chat con el diseño del Ops Center**: después del 20/10.
- **#850** sigue abierta en el Plan hasta confirmar la F (`3a47301ed`) en producción. Se cierra con
  `cerrar-881-850.ts --solo=#850 --aplicar` (scratchpad de la sesión 35a96d39) o con `cerrar_tareas_plan`.
- **La cookie vieja `mako_ws`** (vale para todo el navegador) como otra vía de «datos de otro ws», sin tocar
  (hallazgos-onboarding).

## ESTADO AL 18/10/2026 ~11:30 AR — LO PRIMERO PARA QUIEN SIGA

<sub>Chat «Onboarding», cuenta 4, con la cuenta al 92 % semanal. Rama onboarding-v3 (C:/dev/wt-onboarding-v3), sin
pushear: las puntas van al Cerebro (local_797d5445…).</sub>

**El punto 15 del feedback del 18/10** (C:/dev/wt-push-q/docs/feedback-18-10.md), prioridad 1 de Martín:
- **Pasados VERDES al Cerebro:**
  - `fe38fb766`: nunca datos de otro ws («Consultesis»; ver hallazgos-onboarding);
  - `e04467639`: explica al arrancar; sin «Soy» ni el objetivo a 90 días; las dos preguntas al final.
- **Commiteados, falta el VERDE** (`antes-de-subir --rapido` con C:/dev/pesado.lock):
  - `34d4ef643`: halagos genuinos, respuestas rápidas siempre, sin preguntas de logística, al terminar a /second-brain;
  - `ffd0ea3ef`: la entrada avanza sola y sin anillos;
  - el commit de esta cosecha.
- **Sin hacer**, con dónde vive cada cosa en hallazgos-onboarding («El onboarding del 18/10»):
  - la animación como carga de toda la app;
  - la criatura volando a la sidebar de chats;
  - el chat con el diseño del Ops Center (después del 20/10).
- #850 sigue abierta en el Plan hasta que la F (`3a47301ed`) esté en producción. Para cerrarla:
  `cerrar-881-850.ts --solo=#850 --aplicar`, en el scratchpad de la sesión 35a96d39.

## 17/10/2026 a la tarde («Pendientes B3», claude4, rama pend-b3-1710)

Hecho: lo tachado de «Qué hacer ahora» se guarda y MaKo lo sabe; la tabla de clientes del super admin tiene «Llegó
por» (y el CSV); el PDF «Lo que vendes» queda en El Archivero al cerrar (sin extracción paga). Sin ver en un navegador.
Detalle: docs/hallazgos-onboarding.md, «Lo tachado del diagnóstico…».


## ESTADO AL 17/10/2026 ~13:30 AR — LO PRIMERO PARA QUIEN SIGA

**A, B, C, D y E están EN PRODUCCIÓN** (main 1bae61a77, run 110; «Ya está» de A-C escrito en el chat de Onboarding).
**#881 CERRADA en el Plan** (ws 9, `cerrar_tareas_plan`, 17/10 ~13:15). **#850 sigue abierta a propósito:** su «Listo
cuando» pide TODOS los botones de arriba, y las barras de lote del Plan y de Customer Success van en la punta F
(`--pegado-arriba` en globals.css: la barra en la página, 0 adentro de un modal; medido en Chrome 58 y 8). Se cierra con el
deploy de la F, con el script del scratchpad `cerrar-881-850.ts --solo=#850 --aplicar` (o el mismo `cerrar_tareas_plan`).

## ESTADO AL 17/10/2026 ~11:30 AR

<sub>Chat «Onboarding», cuenta 4. Rama onboarding-v3 (C:/dev/wt-onboarding-v3) con origin/integracion mergeado
(344c8b515): las cuatro puntas de la mañana (abajo) pasaron los 148 barridos del repo, 1680 tests, 0 fallas.</sub>

**El Cerebro sumó #881 y #850 al punto 2 («Inspeccionar»), en una punta E encima de la misma rama:**
- **#881 (Martín veía primero el perfil de Mauricio al inspeccionar):** el Sidebar nacía con `useState('Mauricio Bustos')`.
  Ahora el primer cuadro lo arma el server: `lib/vista-de-otro.ts` lo pasa el layout al Sidebar y a la barra, y lo usa
  también `/api/auth/me`. Test: tests/inspeccionar-primer-cuadro.test.ts.
- **#850 (la barra tapa cosas):** la regla de alto no tomaba el estilo como lo escribe el SERVER, y entrar a inspeccionar
  es una carga del server. Medido en Chrome: 608 antes, 558 después. Los dos «sin hacer» del hallazgo ya bajaban porque
  son `<aside>`. Se bajaron los cuatro que sí quedaban debajo: «Editando el deal», la hoja de la ruta del lead,
  /admin/estrategia y el índice de la API. Test: tests/barra-inspeccion-alto.test.ts (4 y 5).
- **Sin hacer** (detalle en docs/hallazgos-ui.md): `rolWs`/`capa` del Sidebar, que siguen naciendo vacíos. (Las barras de
  lote se hicieron en la F; la del CRM la bajó su chat.)
- **Cerrar #881 y #850 en el Plan** (`cerrar_tareas_plan`, con la prueba) y escribir el «Ya está» cuando el Cerebro
  confirme el deploy. Verlo con clics inspeccionando el ws3.
- #883 (Sidebar): el onboarding ya no fuerza el oscuro desde la D; el único color fijo (`#fff` del botón principal) pasó a
  `var(--on-primary)` en la E.
- **La estrella NO está hecha** (Ops Center 3, 17/10 ~12:30; la toma el próximo Ops Center). Cuando llegue, el cambio es
  una línea en app/onboarding/CriaturaMako.tsx (escrito ahí, con la API de `Criatura`).

## ESTADO AL 17/10/2026 ~08:30 AR

<sub>Chat «Onboarding», cuenta 4 (claude4). Las puntas de la mañana están en la rama onboarding-v3
(C:/dev/wt-onboarding-v3) y se le pasaron al Cerebro; las de la noche (abajo) ya están en producción.</sub>

**El pedido de Martín del 17/10 (Ops Center), entero y hecho en cuatro puntas, con su test probado rompiéndolo:**
- **A `42ab78a34`** — «Salir de la vista» del Cliente de Prueba vuelve a donde estabas, y el Reset volvió. Las dos cosas las
  causaba una relación de agencia REVOCADA (Código Inmobiliario → ws 3) que se contaba como vigente. La barra de
  «Inspeccionar» ya no tapa el onboarding. Cosecha: docs/hallazgos-customer-success.md.
- **B `47e77d40c`** — entiende el nombre («Soy Martín») y suma «¿Cómo llegaste a MaKo?» y «¿Qué quieres que MaKo
  resuelva primero?» (decide a qué pestaña entra al terminar; quedan en `onboarding.encuesta` y en la API de MaKo).
- **C `72fa11b56`** — la guardia contra el abuso: ráfaga por usuario e IP, tope de 60 turnos y 15 documentos por
  onboarding, el troleo que no llega a la IA y el bloqueo a la tercera falta, con email al equipo. Lo desbloquea el
  super admin mirando al cliente.
- **D `d4481702d`** — en claro y sin recuadro, como la referencia; MaKo entra con una animación y espera que la toquen;
  reacciona a las respuestas. La estrella la hace Ops Center 3 (pedida el 17/10, sin respuesta todavía): se enchufa
  en `app/onboarding/CriaturaMako.tsx`, que hoy dibuja el muñeco.

**Sin mirar en el navegador** (sin RAM; el Cerebro lo deja para la prueba de Martín en producción, en el ws 3). Cuando el
Cerebro avise que está desplegado, el «Ya está» va en el chat de Onboarding con el link del ws 3.

**Lo que sigue, si nadie dice otra cosa:** enchufar la estrella cuando Ops Center 3 la entregue; una pantalla del super
admin que junte «cómo llegó» de todos los clientes; y lo que Martín encuentre en el ws 3. Detalle de cada cosa en
docs/hallazgos-onboarding.md (las cuatro entradas del 17/10).

## ESTADO AL 17/10/2026 ~02:00 AR (la noche: ya en producción)

<sub>Escrito por el chat «Onboarding» de la cuenta 4 (claude4) al cerrar. Las dos puntas de esta sesión las sumó el
Cerebro en wt-push-q; la 1 estaba corriendo en integracion al escribir esto.</sub>

**Hecho esta sesión (con test probado rompiéndolo, sin migraciones):**
1. **El doer de WhatsApp ya no manda datos de clientes a la red gratis** (punta `24ce402a8`, rama onboarding-doer-red).
   El corte es POR TURNO y por lo que la persona PIDE (`turnoParaLaRed`, lib/doer-herramientas.ts): con datos de
   clientes se corta y el aviso lleva a /integraciones; sin ellos, la red corre sin las herramientas que los leen. Quién
   lee datos de clientes lo dice el registro de la API (`DATOS_DE_CLIENTES_POR_AREA` + `datosDeClientes` por operación).
   Detalle y lo que quedó: docs/hallazgos-ia.md, entrada del 17/10. Regla nueva en AGENTS.md.
2. **El onboarding sin el análisis de Offer** (punta `b8ec91b26`, rama onboarding-lo-que-vendes; el pedido textual en
   docs/feedback-16-10-crm-onboarding-second-brain.md). La conversación pregunta sólo qué vende (`PIEZAS_DEL_ARRANQUE`),
   deja «Lo que vendes» en PDF (lib/lo-que-vendes-pdf.ts, GET /api/offer/pdf?tipo=lo-que-vendes) y no arma la oferta;
   el diagnóstico de fase se queda, preguntado por el arranque con opciones (el Cerebro lo aprobó por criterio).
   Detalle: docs/hallazgos-onboarding.md, «El onboarding sin el análisis de Offer».

**Sin mirar en el navegador.** El Cerebro frenó el recorrido local (la app se cayó a la 01:05 por RAM con nueve chats
abiertos). Martín lo prueba en PRODUCCIÓN en el Cliente de Prueba (ws 3), que tiene el onboarding sin empezar; está
anotado en la bitácora (app/admin/dev/onboarding/bitacora.ts, hito del 17/10, con qué mirar). Nunca ws1. Si alguien lo
recorre en local: la receta está en docs/hallazgos-infra.md («Recorrer una pantalla en local…»); la foto del ws3
(`scripts/ws-prueba-foto.mjs guardar`) se sacó el 17/10 y NO hizo falta restaurar: no se levantó el server.

**El «paso de IA opcional» ya no existe como paso:** el arranque no pide ninguna key (lo fija
tests/onboarding-sin-api.test.ts); «Conectar mi propia IA» aparece sólo si la IA no contesta, dentro del chat.

**Esperando a Martín (no hacerlo sin su sí, en el chat que lo ejecute):** borrar las dos filas del ws1 que son copias
de la plataforma (`GEMINI_API_KEY` y `OPENAI_API_KEY`): guardar antes sus huellas sha256, borrar por id y releer. No
urge: desde `b78bb977c` ya no cuentan como suyas.

**Lo que sigue, si nadie dice otra cosa:** lo que Martín encuentre en el ws3; y lo abierto en los hallazgos (el
historial del grupo que viaja a la red, el Dashboard entero marcado con datos de clientes, el guion de audio de
Automations sin corte —es de Automations—, el PDF que no queda en El Archivero).

---

<sub>Lo de abajo es la historia (16/10 y antes): sirve para saber por qué, no como mapa de hoy.</sub>

## Feedback de Martín del 16/10/2026 a la tarde (HECHO el 17/10, ver arriba)

«Sería bueno que la funcionalidad de "OFFER" no esté en el onboarding... Pero simular "Offer" en el onboarding
simplemente para organizar en un PDF lo que vende el usuario.»

## ⚠️ Actualización del 16/10/2026: el wizard ya no existe

<sub>Escrito el 16/10/2026 por el chat «Onboarding» (claude3), sobre lo suyo. Main `9f89a5004`. Lo de abajo
(10/10) describe el wizard: sirve como historia, no como mapa.</sub>

- **El onboarding es el chat de Offer** (Martín: «el onboarding será ese chat de offer»). Lo lleva el chat
  Offer: `/onboarding` dibuja `ChatArranque.tsx`, el cierre pasa por UNA puerta (`cerrarPasosOnboarding`,
  lib/onboarding-state.ts) y la regla del cierre es `aplicarCambiosDePaso` (lib/onboarding-contrato.ts).
  `OnboardingWizard.tsx`, `Bienvenida.tsx` y `Listo.tsx` se borraron. Las cuatro redirecciones a /onboarding
  siguen igual.
- **El crédito de Claude de la plataforma** (dos planes Max de Martín) sólo durante el onboarding, y sólo para
  `'offer'`, `'El Archivero'` y `'onboarding-extract'` (`CREDITO_HABILITADO_PARA`, lib/veto-claude.ts). Sumar
  algo lo decide Martín.
- **El histórico (Meta, Fathom, YouTube, Panda) arranca al CONECTAR la integración**, por cualquier puerta
  (`arrancarHistoricoEnSegundoPlano(ws, servicio)`, lib/onboarding-extract.ts), y lo corre el cron de cada 15
  minutos, que recorre a quien tenga cualquiera de las cuatro. Antes lo arrancaba sólo el wizard.
- **Toda escritura del estado lee estricto** (`getEstadoOnboardingEstricto`): la tolerante, con la base caída,
  reabría onboardings terminados.
- Las trampas y lo medido, en `docs/hallazgos-onboarding.md` → «Si el onboarding deja de ser el wizard».
  Tests: `historico-al-conectar`, `onboarding-escritura-estricta`, `veto-claude-credito-plataforma`.
- **IA, el mismo día (pedido de Cerebro):** una key de la plataforma COPIADA en la fila de un negocio no cuenta como
  suya (`provsDe`, lib/ai-cheap.ts; `b78bb977c`). La Gemini del ws1 lo era, y sus pedidos con datos de clientes iban a
  la key gratis de la agencia. Detalle en `docs/hallazgos-ia.md`. **Escalado a Cerebro, sin tocar:** la red propia del
  doer de WhatsApp no corta con datos de clientes (lib/mako-doer-in.ts).
- **El modelo gratis de OpenRouter** (`minimax/minimax-m3:free` ya no existía; lo midió Web Generator) pasó a ser UNO,
  `MODELO_OPENROUTER_GRATIS` = `nvidia/nemotron-3.5-super-vl:free`, medido con un pedido real (`de33ad192`). Antes de
  cambiarlo: `VERIFICAR_OPENROUTER=1 npx tsx --test tests/openrouter-modelo.test.ts`.
- **PENDIENTE al 16/10 (el 1 se HIZO el 17/10, ver arriba; el 2 espera a Martín):**
  1. **La red propia del doer de WhatsApp corta con datos de clientes, POR TURNO.** Sólo si el turno trae herramientas
     que leen leads o conversaciones; la charla sigue. El aviso: «Conecta tu Claude para que MaKo lea tus leads», con
     el link a /integraciones (`linkApp`). Dónde: el bucle sobre `provsGratisDePlataforma` en `lib/mako-doer-in.ts`
     (busca `LA RED DE PLATAFORMA`). Qué herramientas viajan lo decide `herramientasDelTurno`
     (`lib/doer-herramientas.ts`): la pregunta «¿lee leads o conversaciones?» tiene que salir de un dato del registro de
     la API (el área de cada operación, o una marca nueva en la def), no de una lista de nombres a mano. Test probado
     rompiéndolo, con el turno que CORRE (molde: `tests/agenda-whatsapp.test.ts`).
  2. **Borrar las dos filas del ws1 que son copias de la plataforma** (`GEMINI_API_KEY` y `OPENAI_API_KEY`). Antes,
     guardar SÓLO sus huellas sha256; borrar por id y releer. Es un borrado en producción sobre la cuenta de un cliente:
     se hace con el sí de Martín en el chat que lo ejecuta. Ya no se usan como propias (`provsDe`), así que no urge.
- **Queda abierto:** los comentarios de otras áreas que nombran al wizard como vivo (lib/capas.ts,
  lib/paises.ts, app/onboarding/FaseUI.tsx, OnboardingForm.tsx, app/automations/*) son historia y no
  rompen nada. Y la ruta /api/onboarding/extraccion queda sin llamadores en la app: sirve para pedir un
  `tick` o un `retry` a mano.

---

<sub>Escrito el 10/10/2026 por el chat «Onboarding» (cuenta claude3), sobre lo que hizo ese
mismo chat. Es el primer briefing de esta área: no había ninguno, y no hubo un chat
«Onboarding» desde el 05/09 (el del prototipo conversacional). Cubre hasta el commit
`dae23ffa` (10/10/2026 21:43).</sub>

## Qué es esta parte del producto

Dos cosas distintas que se llaman igual:

- **El wizard del cliente nuevo** (`/onboarding`, `app/onboarding/OnboardingWizard.tsx`). El
  alta deja al workspace en `pending` y `guardOnboarding` lo manda acá antes que a cualquier
  tab. Los pasos los elige la capa (`lib/capas.ts`): en `completo` y `agencia` son seis —
  fase, llave de IA (`gemini`), Archivero, productos, teléfono (`tabs`) y Meta
  (`integraciones`)—. Los dos últimos se pueden dejar para después (`PASOS_POSTERGABLES`).
  Al terminar, MaKo escribe el plan del cliente (`/api/onboarding/plan-arranque`,
  `lib/todo-seed-ia.ts`) y lo deja como borrador.
- **El onboarding de cada tab** (`lib/tab-onboarding-catalogo.ts`, estado en
  `lib/tab-onboarding-state.ts`). Regla de agosto: toda tab tiene uno. Dos excepciones
  decididas por Martín: Automations (ex /chatbot) entra por su estado vacío, el QR de
  WhatsApp si no hay línea (05/10), y el CRM entra directo, sin panel (08/10).

Para probar se usa el **Cliente de Prueba (ws3)**: está sin empezar (sin fila de
`onboarding.state`). Nunca ws1, que es Mauricio, un cliente.

## Qué se hizo en esta ventana

Martín pidió revisar el proyecto «Feature: Onboarding» del tablero con el criterio de la
casa, repriorizar o borrar lo innecesario, y dejarlo en Runway. Se aplicó en el tablero
(ws9) y está a la vista en **/admin/runway#onboarding**:

| | Tareas |
|---|---|
| **Se quedan** (etapa 3, que vencía el 9/10) | #734 la cuota de Gemini frena el arranque · #171 el histórico de leads de Meta nunca llega · #737 el video tutorial · #801 el onboarding del Ads Manager · #201 Instagram figura «leída» vacía |
| **Se posponen** (abajo, en A FUTURO) | #614 #652 #607 #608 (eran para la versión gratis) · #532 #164 #699 #214 #213 #743 |
| **Se cerraron**, con la prueba en el historial | #372 #309 #706 #707 |
| **Se borró** | #625 (reiniciar el onboarding de Leila: se prueba en ws3) |

El respaldo de las 20 filas y del proyecto, tomado antes de escribir:
`dashboard-marketing-main/backups/onboarding-depuracion-2026-10-10.json` (fuera del repo).
El detalle del proyecto se reescribió: su «Qué falta» nombraba tarjetas que ya eran del CRM.

## Lo que quedó a medias, y dónde vive

- **Las cinco que se quedan están sin empezar y sin fecha.** Por dónde arrancar:
  - **#171 es una línea**: `lib/onboarding-extract.ts:67` lee `getSetting('meta_page_id')`,
    que no escribe nadie. Va `credWs('META_PAGE_ID')` con el mismo respaldo fail-closed de
    `lib/meta-leads.ts`.
  - **#734**: la red de plataforma (`provsGratisDePlataforma`) no la usa ningún camino del
    arranque. El Archivero lee con `leerDocumentoIA` y los productos con `chatCheapCascade`
    sobre `CASCADA_DOCS`, sólo con las keys del cliente. Y `app/onboarding/ProductosView.tsx:242`
    pinta el error sin el botón para sumar otra key (la pieza `ErrorIA` ya existe).
  - **#801**: el Ads Manager no tiene entrada ni en `lib/tab-onboarding-catalogo.ts` ni en
    `lib/tab-activacion.ts`. El Offer Analyst ya no va: P2 se eliminó el 03/10.
  - **#201**: `app/api/onboarding/archivero/route.ts` no tiene guarda de host para Instagram,
    y cuenta como «leída» una web de la que no sacó ningún campo.
  - **#737** no es código: lo graba Martín.
- **Las prioridades nuevas pueden deshacerse solas**: la re-priorización del navegador
  (`applyGuardian`) pisa `score` y `score_base` de todas las abiertas cuando alguien crea,
  borra o completa una tarjeta con /plan abierto. Así se deshizo la depuración del 25/09.
  Detalle en `docs/hallazgos-plan.md`, la entrada del 10/10.

## Lo que espera una decisión de Martín

1. **¿Las fijo a mano?** La regla de la casa es que `score_manual` lo pone una persona. Si
   Martín quiere que esta depuración no se mueva, es suya la decisión. (Y ojo: por lo que se
   lee en el código, `applyGuardian` tampoco respeta las fijadas; no se midió en el navegador.)
2. **Las fechas de las cinco que quedan.** Propuesta: #734 y #171 primero.

## Ventana del 13/10: el prototipo conversacional, ahora contra el flujo real

<sub>Agregado por el chat de Claude Design (cuenta claude2). No toca producción: todo vive en
el canvas publicado y en el scratchpad. Cambia lo que el área SABE, no lo que corre.</sub>

El prototipo del onboarding-como-chat (el que menciona el encabezado, del 05/09) se retomó y
pasó de **5 turnos a 28**, escritos esta vez **leyendo el wizard**, no de memoria: las 6
preguntas del quiz más la de canal que cambia el enunciado y los tramos de la siguiente, la
devolución del diagnóstico en cuatro turnos, el paso de la llave de IA, el Archivero con su
espera y su devolución documento por documento, las preguntas de los huecos, el catálogo, el
email + WhatsApp + código, y la cascada de Meta.

Lo que el prototipo aporta como DECISIÓN de producto, y que `docs/onboarding-nuevo.md` no
tenía resuelto:

- **El orden es una afirmación.** El paso que muestra lo leído de Meta iba ANTES de conectar
  Meta. Se reordenó, y saltear Meta ahora saltea también la pantalla que la enseña: el mapa
  queda con 14 piezas de 16 y la consecuencia se ve.
- **La espera es un turno, no un spinner.** «Estoy leyendo tus documentos» merece pantalla.
- **Un turno que depende de algo que no pasó no se muestra vacío: no se muestra.**

Dónde está: `https://claude.ai/code/artifact/6d5c12ad-f582-4e80-be3b-0eb1a89c3231`. El
generador y las pruebas, en el scratchpad de esa sesión (`scratchpad/dc/`): `build-main.mjs`
construye el componente, `probar-orden.mjs` comprueba que ningún paso muestre un dato que no
se consiguió, y `probar-grafo.mjs` que ningún nodo del mapa nazca de un padre apagado en
ninguna de las 16 ramas. **Si el prototipo se retoma, esos tres archivos valen más que el
HTML**: el HTML es generado.

### Lo que esto encontró del wizard REAL

- **El checklist «Qué hacer ahora» del diagnóstico no se guarda.** `app/onboarding/FaseUI.tsx:121`
  es `useState<Set<number>>` local: se tilda, se dibuja (`:191`) y se pierde al recargar. No hay
  ningún endpoint ni setting que lo reciba. El usuario marca lo que ya hizo y MaKo no se entera.
- **La pregunta de canal se puede pasar sin tocarla y queda `llamadas` por default**
  (`OnboardingWizard.tsx:629` la excluye de `esFaseQuiz` a propósito, y el default viene
  marcado). Eso define el enunciado y los tramos de la pregunta siguiente **y siembra la
  plantilla de funnel de ese canal**. La exclusión es deliberada y está comentada; que el
  efecto lateral corra con un default sin tocar es lo que no está decidido.

⚠️ **Y una advertencia sobre auditar producción con agentes.** De tres cosas que la corrida
marcó como defecto del wizard, **dos eran decisiones deliberadas ya comentadas en el código**
(el `FasePanel` que no se dibuja lo explica `OnboardingWizard.tsx:792`, y la exclusión del
canal, `:429`). Se verificaron una por una antes de escribir acá; sin ese paso, dos
«hallazgos» hubieran mandado a alguien a deshacer algo que estaba decidido.

## Ventana del 13/10 a la noche: tres de las cinco ALTA, cerradas

<sub>Mismo chat que la sección de arriba (cuenta claude2), ya sobre producción. La tanda se
cortó a pedido de Martín (~20:00) para liberar RAM: lo que quedó a medias está nombrado abajo
con su archivo.</sub>

| Tarea | Estado | Commit |
|---|---|---|
| **#171** el histórico de leads de Meta no llegaba nunca | cerrada, con guard probado rompiéndolo (5 roturas, 5 cazadas) y la suite entera en verde | `4da4b720` |
| **#201** Instagram figuraba «leída» vacía | cerrada, con guard probado rompiéndolo (7 de 7) | `3ea8f2bf` |
| **#734** la cuota de Gemini frenaba el arranque | código cerrado; **test probado rompiéndolo el 15/10** (7 de 7, ver abajo) | `26b8eabe` · `fa6a2ac3` |
| **#801** el Ads Manager sin onboarding | sin empezar | — |
| **#737** el video tutorial | no es código: lo graba Martín | — |

### #171 — dos fuentes de verdad que no se hablaban

`jobAplica` leía la setting `meta_page_id` (minúscula, que nadie escribe desde que el page id
vive como credencial) y `pollMetaLeads` la credencial `META_PAGE_ID`. El job quedaba `skipped`
con «Falta token de página o ID de página» en un workspace donde la ingesta andaba perfecto:
sin error, con el paso en verde, y el CRM del cliente nuevo vacío. Ahora la pregunta se
contesta UNA vez, en `credencialesDeLeads()` (`lib/meta-leads.ts`), y la llaman los dos. De
paso se cerró la segunda divergencia del mismo gate: pedía el token a secas y el ingestor
además rechaza un `PENDING…`.

### #201 — una web pegada sólo cuenta si se aprendió algo

Las tres preguntas viven en `lib/archivero-webs.ts` (sin `server-only`, para que los tests las
ejecuten) y las usa `app/api/onboarding/archivero/route.ts`. **Medido con nuestro propio
User-Agent**: instagram 991 caracteres de muro, facebook **4**, tiktok 14, x 1.385 — y
**linkedin 13.159 de contenido real**, así que LinkedIn no entra en ninguna lista por
parecerse a las otras. El defecto era más grande que Instagram: una página de cuatro
caracteres pasaba el `!texto.trim()` y se guardaba como documento leído, y ese texto le daba
de comer al panorama, que es el perfil del negocio.

### #734 — verificada el 15/10

El código está: la red de plataforma llega a `chatCheapCascade` y al camino de VISIÓN
(`leerDocumentoIA`), encendida en los 11 puntos del arranque, con los errores de nuestras keys
en lista aparte y `chatCheap` aceptando `wsKey`. `npx tsc --noEmit` devolvió cero errores.

**El 15/10 (chat «Onboarding», claude3) se corrieron la base y las siete roturas**, restaurando
de memoria: base 8/0, y seis de las siete caían 7/1 de entrada. La séptima —«`chatCheap` deja de
pasar `wsKey`», o sea la red reintentando con la key del cliente— daba **8/0**: el assert leía
`lib/ai-cheap.ts` entero y la misma línea vive en `chatCheapTools`. Ahora mira el cuerpo de
`chatCheap` y cae 7/1. Commit `fa6a2ac3`, en la rama `onboarding-734-verificacion` (la sube el
coordinador). Los números quedaron en el encabezado del test.

### Lo que sigue sin hacer, con su archivo

- **#801**: el Ads Manager no tiene entrada ni en `lib/tab-onboarding-catalogo.ts` ni en
  `lib/tab-activacion.ts`. Sin empezar.
- **El checklist «Qué hacer ahora» no se guarda**: `app/onboarding/FaseUI.tsx:121` sigue siendo
  un `useState` local. Es el defecto real que encontró el prototipo y NO se tocó.
- **Una decisión de Martín**: la pregunta de canal avanza con su default marcado
  (`OnboardingWizard.tsx:632`) y ese valor siembra la plantilla de funnel del canal. ¿Se exige
  elegir, o queda el default?
- **`lib/entregable.ts`** quedó sin red de plataforma a propósito: no es del arranque.

## Ventana del 15/10 a la noche: el arranque sin API

<sub>Chat «Onboarding», cuenta claude3, por pedido del coordinador sobre la decisión de Martín en la
Ticketera (`clientes-usan-su-claude`, opción A). Commit `7f0ced90f`.</sub>

- **El paso de la IA del wizard es OPCIONAL** («Tu propia IA (opcional)»). Ya no frena: lo que viene
  después en las dos capas que lo tienen (El Archivero, Productos y el plan de arranque) corre con la
  red de la plataforma. El plan de arranque (`lib/todo-seed-ia.ts`) no la tenía y se le sumó. Lo fija
  `tests/onboarding-sin-api.test.ts` (6 roturas, 6 cazadas).
- **La guía del crédito de Claude Max** vive en la ficha de Anthropic (`lib/metodo-catalogo.ts`, el
  tutorial del servicio y el «?» del campo), y el paso del wizard abre ese modal ahí mismo.
- **La clave de Anthropic del negocio ya mueve sus funciones de texto** (16/10, commit `a488757c`): el
  coordinador contestó que la decisión A de Martín ya lo cubría. Es la segunda puerta del veto
  (`lib/veto-claude.ts`), nunca con una clave de la plataforma ni en el Plan; el detalle, en
  `docs/hallazgos-ia.md`.
- **16/10: El Archivero cortaba a los clientes sin keys** antes de la red (tres `docsIADisponible()`), y
  con el paso de la IA opcional ya en main, un cliente sin keys se trababa ahí. Arreglado (`daebfcc89`, y
  sólo el arreglo en la rama `onboarding-archivero-fix`).
- **16/10: la red se extendió a la primera semana** de un cliente sin API: Ads Writer, Offer, crear landing,
  crear automatización y buscar en el Second Brain (`tests/red-primera-semana.test.ts`). La capacidad y el
  porqué, en `docs/hallazgos-ia.md`.
- **Lo que NO está hecho y no es mío decidir** (se lo pasé al coordinador):
  - el análisis del lead: manda datos personales de los leads por las keys de la agencia, y no se sabe
    si están en el plan gratis de Google (que entrena). Es una decisión de privacidad de Martín;
  - el resto de las llamadas sin red, en el orden que diga el coordinador sobre `docs/mapa-ia-24h.md`;
  - sin mirar en el navegador: no se levantó la app (RAM). Falta ver el paso en escritorio y celular
    cuando esté desplegado.

## Dónde leer más

- `docs/hallazgos-onboarding.md`: la última entrada (10/10) y, antes, las del 05 y 06/10
  (Automations y «Tu forma de escribir»).
- `docs/onboarding-nuevo.md`: la propuesta de rediseño (el mapa, la promesa, el revelado).
  De sus fases sólo se hizo la salida de Meta (16/08); el resto quedó atado a la versión
  gratis, igual que las cuatro tarjetas pospuestas.
- En la memoria: `regla-onboarding-por-tab`, `onboarding-cliente-wizard`,
  `plan-arranque-generado` y `personalidad-quiz`.
