# Hallazgos — la API de MaKo (registro, confirmación y canales)

Todo lo que vive en `lib/api-mako/` fuera de `areas/` (registro, validación, vista,
ejecución, pendientes y propuestas), `app/api/v1/**`, las dos pantallas que confirman
(`app/mako/pendientes`, `app/mako/revisar/[id]`) y la parte del doer de WhatsApp que
consume el registro (`lib/mako-doer-in.ts`, `lib/mako-doer-acciones.ts`,
`lib/respuesta-doer.ts`).

El diseño y el porqué de cada decisión están en [api-mako-diseno.md](api-mako-diseno.md);
la referencia generada, en [api-mako.md](api-mako.md). Acá va lo que costó. Lo que las
áreas aprendieron sobre SUS libs (Evolution, Zernio, Meta, `getSetting`, closing…) está
en el documento de cada área. Lo de la skill del cliente, en
[hallazgos-agente.md](hallazgos-agente.md).

---

## El token de agencia: uno para la cartera, y el cliente se decide en CADA pedido (6/11/2026, nube)

La promesa a la agencia de Thiago: migrar 27 clientes sin acuñar 27 tokens. En /api-mako → Tokens, una agencia elige como
propietario «Todos los clientes de <agencia>» (el selector de propietario de GitHub, que estaba fijo) y sale un `mako_agt_…`.
Cada pedido dice a qué cliente va con `X-MaKo-Cliente` (o `?cliente=`). La regla, en `lib/api-mako/tokens-cartera.ts`; la
lectura, en `tokens-cartera-server.ts`; el corte, en `autenticar` (lib/api-mako/http.ts). Relevo: [relevo/nube-thiago-migrar.md](relevo/nube-thiago-migrar.md).

- **El corte cabe en UN lugar porque todo /api/v1 toma el negocio de `ctx.ws`, nunca del token.** Medido antes de escribir
  nada: las rutas, el registro de llamadas, el gating y `aplicarEnElActo` leen `auth.ctx.ws`. Así `autenticar` arma el contexto
  con el cliente y lo de abajo no se entera. Un camino nuevo de /api/v1 que lea `auth.token.ws` vuelve a abrir la agencia: ése es
  la AGENCIA. **Vive en:** `lib/api-mako/http.ts`.
- **«No pude leer la cartera» es un 503.** `puedeEntrarAhora` y `esAgencia` (lib/agencia.ts) devuelven false ante un error, que
  para una pantalla está bien y para la API manda a pensar que el cliente se dio de baja. Por eso hay lecturas estrictas aparte.
- **Un token de cartera nunca cae a la agencia misma:** sin cliente, o con el número de la agencia, no corre en ninguna cuenta.
  Un cliente ajeno, revocado o pendiente contesta 404 (un 403 confirmaría que existe). Y un token de CUENTA ignora el header.
- **El prefijo y la marca de la lista tienen que coincidir** (`mako_agt_` ⟺ `cartera: true`): sin eso, una lista tocada a mano
  convierte un token de cuenta en uno de cartera. Y su creador tiene que administrar la agencia MISMA: con la regla de un token de
  cuenta (`creadorConAcceso`), el admin de una agencia que entra a un cliente que también es agencia podía acuñar para una cartera
  que no es la suya.
- **Se probó con DOS agencias** (tests/api-mako-token-agencia.test.ts, sobre `crearToken` y `autenticar` reales): con una sola,
  sacar el filtro por agencia de la lectura y del juicio daba verde.
- **La guía «Migrar tu CRM con Claude»** (la primera de «Guías») se prueba pasando cada pedido por el resolvedor REST real y el
  lote de ejemplo por el validador real (tests/api-mako-migrar-crm-guia.test.ts). El ejemplo vive en `articulos-meta.ts`: un
  valor exportado desde `Articulos.tsx` (`'use client'`) no se puede leer desde un test ni desde el server.
- **Sin hacer:** el tope de 120 pedidos por minuto es por CLIENTE, así que un token de agencia puede hacer 27 veces eso en
  total. No se sumó un tope por agencia: 27 tokens sueltos tenían el mismo techo.

## «No tengo una herramienta» era la mitad: el documento ya se archivaba solo, y D6b lo frenaba (3/11/2026, ticket #44)

**El síntoma.** Una clienta (ws 23) pegó su documento maestro en el chat del Second Brain con «analizalo e incorporalo al
second brain». MaKo contestó «desde este chat no tengo una herramienta que escriba ahí» y abrió el ticket.

**El diagnóstico obvio era el equivocado, o la mitad.** «Falta exponer la ingesta del Archivero» (la deuda de
`negocio.def.ts` del 16/09) era cierto, pero el chat YA archivaba solo todo pegado largo del admin (#884,
`archivarPegadosDelChat`). No corrió por **D6b**: el negocio tiene su Claude en la COMPUTADORA y ninguna clave, así que
`puedeArchivarConSuIA()` dice que no y el servidor no tiene con qué extraer (mandarlo a la red gratis es lo prohibido). El
mensaje quedó con «[…se cortó aquí por largo]» SIN «quedó en El Archivero»: el documento entero se perdió en el corte
(12.000 caracteres) y a la clienta le faltaba desde el punto 10. Se ve en `chart_chats`, no en el ticket.

**Y había dos trampas más en el camino del chat**, las dos medidas con el turno real (`clasificarIntencion` +
`herramientasDelChat`):
- **El documento pegado se clasificaba como material dictado** (títulos, listas): «sumá este documento al second brain» + el
  pegado salía `capturar` y no viajaba NINGUNA herramienta. Lo pegado es dato: se clasifica lo escrito (`pedidoDelMensaje`).
- **«te cargo un documento con toda la información que necesitas saber…» salía `consultar`** («que necesitas» cuenta como
  pregunta), y en `consultar` no viajan acciones. Familia `documento-al-cerebro` (lib/mako-intencion-app.ts).

**Lo que queda:**
- Un negocio con su IA sólo en la computadora NO tiene IA en el servidor: todo lo que extrae en el servidor (El Archivero,
  el panorama) se le cae. El camino es que extraiga el **modelo del turno**, que es su IA, y la persona vea el resultado antes
  del «sí» (`sumar_documento_second_brain` pide los `campos` con `disponibles`).
- Un texto que el modelo copia de un pegado se limpia sólo de las marcas (`documentoDelChat`): su id sale del contenido y
  tiene que dar el mismo que el que el chat archivó solo, o se guarda dos veces. Un pegado CORTADO se sabe cortado.

**Sin hacer:** con su Claude en la computadora, el pegado largo se sigue cortando en 12.000 y lo que pasa de ahí se pierde
(lib/chat-pegado.ts, `TOPE_PEGADOS_MENSAJE`; lib/mako-turno-app.ts, `recortarMensaje`): la tarjeta lo dice y pide el resto,
pero guardar el texto ENTERO sin extraer (para que el modelo lo lea después) no está. Y el #43 (lo mismo por WhatsApp,
sobre el cerebro de otro workspace): el plan en docs/relevo/brain-docs.md.

## Recuperar margen: sólo cuenta lo que va ANTES, y el recorte tiene que llegar al ticket (31/10/2026)

**El síntoma:** `cambiar_crons_secuencia` entraba en los 12.000 caracteres con 119 de margen, y el recorte se avisaba con un
`console.warn` que nadie lee.

**El diagnóstico obvio era el equivocado: «acortar las descripciones más gordas del área».** `cambiar_botones_mensaje`
(2.169) o `agregar_escenario_secuencia` (1.821) no devuelven ni un carácter, porque van después del CRON en el orden de esa
frase. Sólo cuentan las seis que van antes, más el propio CRON. Y el CRON pesa 4.654, pero 3.706 son su esquema, que el
modelo necesita. Lo barato era lo que esas siete repetían:

| qué se sacó | caracteres |
|---|---|
| Los nombres de parámetros repetidos en la descripción de `crear_automatizacion_con_ia`, y «el número o el nombre de la opción» cuatro veces | ~170 |
| En `duplicar` y `desde_plantilla`, lo que la cola del registro ya dice («hasta el sí») y la referencia a la pantalla | ~110 |
| En `configurar`, «de esta automatización» y lo que el nombre del parámetro ya dice | ~95 |
| En el CRON, «devuelve un link» (lo dice la cola) y «hasta 10» (lo dice su parámetro) | ~50 |

La cola de las acciones con link también se acortó, y eso le da aire a todas las áreas. Margen: **119 → 551**. Medido con
`tests/ops-center-bateria`, que lo imprime.

**El piso nuevo: `MARGEN_MINIMO = 300`.** Antes el test daba rojo con el margen en 0, o sea cuando MaKo ya contestaba «no
puedo». Ahora da rojo antes, con tiempo para arreglarlo. ⚠️ Es un número puesto a ojo: alcanza para una descripción larga de
más. Si salta, se acorta lo que repiten esas siete; no se baja el piso.

**El aviso no se arregla con otro aviso.** El recorte pasa en casi todo turno de un área grande (57 operaciones en una corrida)
y es normal: un ticket o un aviso por cada recorte sería ruido. Lo que importa es el recorte **cuando MaKo dijo que no pudo**.
Por eso el ticket del «no pude» trae `contexto.noViajaron`: las seis operaciones más parecidas al pedido que esa persona podía
usar y no viajaron (`parecidasQueNoViajaron`, lib/api-mako/registro.ts). Se calcula sólo si hay ticket.

⚠️ **Va en `contexto`, no en la descripción:** `paraElCliente` muestra la descripción al cliente como si la hubiera escrito él,
y un id de operación no se le muestra. Lo ven la bandeja del Centro de Operaciones y `leer-ticket.mjs`.

**Las dos ramas entregadas tenían rojos REALES que sus informes no nombraban** (y nombraban otros que no existen). Ya estaban
en sus propias puntas, medido con `git show` sobre cada una:

- Competitors Spy agregó su área entre `cobros` y `mako`, y `tests/api-mako-cobros` exige `cobros` justo antes de `mako`. Un área
  nueva va antes de `cobros`.
- Knowledge agregó dos operaciones con `canales: TODOS` sin su ruta en `RUTAS_REST`: sin ella, `tests/api-mako-rest` da rojo. Una
  operación que sale por HTTP lleva ruta en `lib/api-mako/rest.ts` y `docs/api-mako.md` regenerado.
- Knowledge le pasó una prop a `ConocimientoView`, y `tests/barra-sin-dev` pedía la línea literal sin props. El código estaba bien
  y el guardia seguía el texto: ahora pide lo que cuida, que la puerta de la plataforma va antes de dibujar.

**Sin hacer:**

- En el grupo de WhatsApp el ticket trae `noViajaron`, pero sigue sin la causa `ruteo` (lib/mako-doer-in.ts, «El ruteo todavía
  no se arma en el grupo»).
- El margen se mide para UNA frase. Otra operación pesada de otra área puede estar igual de justa, y nada lo mide
  (`scripts/presupuesto-turno-app.mts "frase"` lo mide a mano).
- Sin ver con un ticket real: lo probado es el camino con la base simulada (`tests/no-pude-server`).

---

## Dos ramas recuperaron el MISMO margen y el merge se lo comió: un presupuesto compartido no da conflicto (31/10/2026)

**El síntoma:** el piso de la batería del Ops Center cayó en los dos modos —el chat de la app y
WhatsApp— por UNA frase: «Hacé que la automatización de reactivación salga todos los martes a las 15»
dejó de traer `cambiar_crons_secuencia`. MaKo contestaba «no puedo» de algo que sí puede y que la
pantalla tiene. `automations-clients 16/49 (piso 17)`.

**Los dos diagnósticos obvios eran los equivocados.** El primero, mío: «las 21 operaciones de estudio
de video que entraron empujaron el piso». Falso, y lo desmiente la misma salida del test: `video-imagen`
llega a su piso (10/14 y 9/14) y los otros siete grupos también. Se cae UNA operación, y es de
Automations. El segundo, «el presupuesto es chico»: el presupuesto es el mismo de siempre.

**La causa real es un EMPATE de puntaje, no un tamaño.** El turno ordena las operaciones por cuántas
raíces del pedido aparecen en su id, título y descripción (`ordenarPorRelevancia`, `lib/api-mako/registro.ts`:
id y título valen 2, la descripción 1) y recorta por caracteres. Esa línea es
`.sort((a, b) => b.p - a.p || a.i - b.i)`: **el puntaje manda y el orden de DECLARACIÓN desempata.**
`quienes_de_automatizacion` —la operación de «Ver quiénes» de Métricas— nació declarada **3.ª** en su
área con «automatización» en el título y «flujo» en la descripción, así que empataba en **3 puntos** con
`cambiar_crons_secuencia`, declarada **47.ª**. Y el CRON es la operación más pesada del área (~4.100
caracteres): entra de una sola vez o no entra.

Medido con una sonda sobre el registro real, no contado a mano:

| estado | puesto del CRON | chars hasta él | margen sobre 12.000 |
|---|---|---|---|
| `quienes` 3.ª, con «automatización» y «flujo» | 8.º | 12.431 | **−431 → afuera** |
| al final del área, sin esas palabras | 7.º | 11.881 | +119 |

**⚠️ Y POR QUÉ NADIE LO VIO, que es lo que ahorra el día siguiente:** dos ramas en paralelo pegaron el
MISMO rojo. `respaldo/aut-variantes-3110` le agregó 7 parámetros a dos operaciones del área, vio caer el
piso y lo arregló **acortando sus propias descripciones** — midiendo verde sobre un árbol que todavía no
tenía `quienes_de_automatizacion` (su fork es anterior al commit que la trajo). El merge juntó las dos
**sin un solo conflicto**, porque tocan lugares distintos del archivo, y sin volver a medir. El margen
que una rama recuperó se lo comió la otra.

**La regla que queda: un presupuesto compartido es un recurso que git no sabe mergear.** Dos ramas que
cada una «hace lugar» en el mismo tope de 12.000 caracteres se mezclan limpias y el resultado no
alcanza. Si una rama arregla un rojo de presupuesto acortando texto, al integrarla hay que **volver a
medir el margen**, no confiar en que midió verde en su propio árbol.

**Y la segunda regla, sobre cómo se cuida esto:** la de AGENTS.md tiene dos mitades —al final del área
**y** sin las palabras que toda el área comparte— y **cada mitad sola deja todo verde**. Los cuatro
estados, medidos:

- al final + palabras nuevas → verde, margen 119
- al final + palabras viejas → **verde**, margen 119
- declarada 3.ª + palabras nuevas → **verde**, margen 119
- declarada 3.ª + palabras viejas → ROJO, margen −431

O sea que el piso de la batería **no guarda ninguna de las dos mitades**: mañana alguien cumple «al
final» y repite las palabras, y pasa. Lo único que no se puede cumplir a medias es el MARGEN, y por eso
el test 4 de `tests/ops-center-bateria` lo mide y lo **imprime**. Hoy son **119 caracteres**: el área no
tiene aire, y la próxima descripción larga de más vuelve a tirar al CRON afuera. El número está en la
salida del test para que el próximo lo vea antes de que el ruteo se caiga, no después.

**Dos cosas más del camino:**

- **El recorte avisa y nadie lo lee.** `lib/api-mako/registro.ts` escribe
  `[api-mako] presupuesto de 12000 chars: quedaron afuera …` con la lista completa de lo que descartó —
  en esta corrida, 57 operaciones. Es un `console.warn` en la salida de un test. El aviso existía todo
  el tiempo.
- **El verde que queda es verde por casualidad.** El tercer punto del CRON sale de que su descripción
  dice «lo que la **hace** arrancar» y el pedido arranca con «**Hacé**»: la comparación es por
  SUBSTRING, no por palabra. El día que alguien escriba «lo que la dispara», el CRON baja a 2 puntos.
  Nada mide eso.
- **Las palabras del área van en los PARÁMETROS**, que no puntúan. Es el lugar donde se puede decir
  «la automatización (de listar_secuencias_nutricion)» sin pagar el empate.
- Al mover una operación hay que **regenerar `docs/api-mako.md` en el mismo commit** (va en orden de
  declaración; el snapshot HTTP es alfabético y de ids, no cambia). El id NO se toca: los ids son
  contrato.

---

## Un test que lee línea por línea no ve la falla que vive en una CONSTANTE (31/10/2026, claude1)

**El síntoma.** Llegó como «`tests/guarda-por-defecto` está rojo en `origin/integracion` desde el 27/10, y lleva cuatro días
así, por `lib/api-mako/areas/video-estudio.run.ts:528`». Medido en un worktree recién checkouteado de `origin/integracion`
(47de7dd2a): **4 pasan, 0 fallan**. Esa línea ya tenía `falla: true`: la puso `03dcbbc26` ese mismo día a las 04:07 («Los tres
rojos que quedaron sueltos entre chats, los tres de una línea»), seis horas antes. Un rojo que se mide en una rama vieja
describe el árbol de ESE día, no el de `integracion` de ahora — y entre chats, el que lo arregla no es el que lo reportó.

**La causa real, que sí estaba.** El mismo bug, en tres líneas que el detector del test **no puede ver**, y con 17 acciones
en vez de una:

| dónde | el error | lo ve el test |
|---|---|---|
| `video-estudio.run.ts:81`, el helper `anuncio()` | `return { error: NO_LEI }` con la base caída | **no**: el texto vive en una constante |
| `video-estudio.run.ts:192`, `preparar` de `crear_anuncio_con_guion` | idem, `NO_LEI` | **no**: misma razón |
| `video.run.ts:107` y `:114`, `proponerEnElEditor` | «No se pudo leer el proyecto.» / «No se pudo dejar la propuesta.» | **no**: comparten línea con una regla, en un ternario |

Las **dos cegueras** del detector (`fallasLiterales()`, tests/guarda-por-defecto.test.ts), las dos por leer línea por línea:

1. **El texto en una CONSTANTE.** El detector pide el literal «No pude» / «No se pudo» abierto por una comilla y
   **pegado al `error:`**, en el mismo renglón. `{ error: NO_LEI }` no calza, y `NO_LEI` es «No pude leer tus anuncios
   (falló la base)» — una falla nuestra de libro. Es la forma más natural de escribir un mensaje que se usa dos veces.
2. **La falla que comparte línea con una regla.** `{ error: a ? 'Los proyectos del editor todavía no se guardan en MaKo.' :
   'No se pudo dejar la propuesta.' }` mezcla una regla y una falla en un renglón: marcarlo entero marcaría la regla. Se parte
   en `if`s, un `return` por caso, y la marca va sólo en el de la falla.

Y encima el filtro de dueños es por **igualdad exacta** (`['preparar','proponer','revisando','seguro']`): `anuncio()` y
`proponerEnElEditor` son helpers, el caso que esta misma guarda ya tenía anotado en «Sin hacer» (la entrada del 28/10, más
abajo) para doce helpers de otras áreas. `video-estudio.run.ts` no estaba en esa lista porque nació el 27/10 en
`nube/video-generator-2710` y se mergeó el 30/10, después de escribirla.

**Lo medido** (el caso quedó en el scratchpad; lee el texto y la regla de la fuente, no de memoria): el `falla` viaja porque
los diez `preparar` devuelven el objeto ENTERO (`if ('error' in a) return a;`, 12 veces con `conToma` y `conEscena`). Con la
marca, el cuerpo que arma `ejecutar.ts` da `esGuardaDeHerramienta = false` → **abre ticket**; sin ella, `true` → se toma por
regla y **no abre ninguno**. Eran 17 acciones del estudio de video (diez que llaman a `anuncio()` directo y siete por
`conToma`/`conEscena`): con la base caída, todas contestaban «No pude leer tus anuncios» y ninguna abría ticket.

**Lo que NO lleva la marca, y está bien:** `anuncioDe()` de `video.run.ts` devuelve el mismo «No pude leer el historial» pero
sólo lo consumen `leer` — y el error de una LECTURA ya es falla salvo que traiga `falta` (`ejecutar.ts`), así que ya abría
ticket. `SIN_PUENTE`, `PUENTE_VIEJO` y «todavía no se guardan en MaKo» son reglas. Y los errores que un `preparar` REENVÍA de
una Action (`{ error: l.error }` de `cargar_guion_propio`) no se pueden clasificar en el sitio: el texto lo decide la Action,
y marcarlos a ciegas convertiría reglas en fallas.

**Sin hacer (medido el 31/10 sobre los 87 archivos de lib/api-mako/areas/).** De la ceguera (1) no queda ninguna: `NO_LEI` era la única constante así
en todo `lib/api-mako/areas/`. De la (2) quedan **16 renglones en 8 archivos**, todos en caminos de `preparar`/`proponer` o en
helpers que devuelven entero: `ads.helpers.ts:118` y `:162`, `chatbot.run.ts:342`, `crm.run.ts:634` `:1234` `:1247` `:1250`
`:1285` `:1288` `:1633` `:2157`, `landing-editor.run.ts:92` y `:679`, `landing.run.ts:1164`, `mako.run.ts:420`,
`plan.run.ts:1141`. **No están auditados**: la mayoría es `x.error ?? 'No pude leer…'` (el fallback de un error reenviado,
que es falla salvo que la lib describa un pedido mal hecho), alguno es regla (`chatbot.run.ts:342` dice «No encontré esa
publicación») y `landing-editor.run.ts` resuelve por otra vía (`siFallaNuestra`). Hay que mirarlos de a uno, con el criterio
de arriba, y no a ciegas: marcar una regla como falla abre un ticket por cada «no» legítimo.

**La regla que queda.** Un test que decide por el TEXTO de una línea no ve la falla que se escribió en otra forma, y su verde
no dice «no hay fallas sin marcar» sino «ninguna está escrita como yo la busco». Dos consecuencias para quien escribe un área:
el mensaje de una falla va **literal en el `return`** (si se repite, va la constante Y la marca en cada uso), y **una línea
nunca mezcla una regla con una falla**. Y antes de creer un rojo ajeno: medirlo en un árbol recién checkouteado de la rama que
lo nombra — acá el rojo ya no existía y el bug seguía, tres renglones más allá.

## El choque del registro se UNE; el de `NO_EN_FLUJOS` se une o abre un agujero (30/10/2026, rescate de video-generator)

**El síntoma.** `nube/video-generator-2710` (el estudio copiado de Arcads, 27/10) quedó tres días sin subir y al mergearla
contra `origin/main` chocó en cinco archivos. Cuatro son los de siempre: `registro.ts`, `runners.ts`, `flujo.ts` y
`tests/api-mako-registro.test.ts`.

**La causa real.** No es mala suerte: es la regla de este repo. *Toda* feature nueva declara su área en el registro, así que
**dos ramas que agregan áreas distintas escriben siempre en los mismos renglones**. La rama sumó `video-estudio`; `main`, en
el medio, sumó `copywriter` (62a9b1b28) y el Media Buyer (a2b0088a3). Los cuatro choques eran de UNA línea cada uno:

| archivo | HEAD (main) | la rama | resuelto |
|---|---|---|---|
| `registro.ts` → `POR_AREA` | `contenido: [...contenido, ...copywriter]` | `video: [...video, ...videoEstudio]` | las dos |
| `runners.ts` → `TODOS` | `contenido, copywriter` | `video, videoEstudio` | las dos |
| test → `RUNS_DE_AREA` | `contenido: ['contenido','copywriter']` | `video: ['video','video-estudio']` | las dos |
| `flujo.ts` → `NO_EN_FLUJOS` | 3 ids del Media Buyer | `...DEL_ESTUDIO_DE_VIDEO` | las dos |

Los `import` NO chocaron en ninguno: git los unió solo (están en líneas distintas). **Lo único que choca es la línea que los
usa**, y por eso el conflicto se ve más chico de lo que es.

**⚠️ El diagnóstico obvio era el equivocado en el cuarto.** «Son cuatro listas, se unen las cuatro» acierta por casualidad:
las tres primeras son CATÁLOGOS (elegir un lado borra un área, y el test de paridad def ↔ run sólo lo caza si el área perdida
tenía runner). La cuarta, `NO_EN_FLUJOS`, es una **denylist**: elegir un lado no pierde una feature, **abre un agujero**. De un
lado estaban `'zona_media_buyer'`, `'hasta_media_buyer'` y `'proponer_crear_campana'` (mueven plata en Meta); del otro, los ids
del estudio de video (gastan créditos de Google Flow del cliente). Las dos resoluciones «limpias» —quedarse con main o con la
rama— dejaban una de esas dos familias otra vez ofrecible como paso de una automatización, que se confirma solo y sin la sesión
de nadie. Un merge que compila y pasa los tests puede ser exactamente este bug.

**La regla:**
- Un choque en el registro se **une**, nunca se elige un lado. Y antes de unir, preguntate si la lista es un **catálogo** o una
  **denylist**: con la denylist, unir es lo único seguro, y perder un renglón no da rojo en ninguna parte.
- El spread de `DEL_ESTUDIO_DE_VIDEO` va **último** dentro del `new Set([...])`: lo exige el regex de
  `tests/video-estudio-api.test.ts` (`new Set\(\[[^\]]*\.\.\.DEL_ESTUDIO_DE_VIDEO…\]\)`), que no tolera un `]` en el medio.
- El test del registro **no cuenta entradas**: `RUNS_DE_AREA` mapea área → sus archivos `.run`. Resolverlo «sumando un número»
  es el error que invita su nombre.

**Lo que quedó sin hacer.** Las 21 operaciones de `lib/api-mako/areas/video-estudio.def.ts` salen sólo por `canales: ['app']`
porque sus runners llaman a las server actions de la tab, que leen la sesión de la cookie. Por WhatsApp y por `/api/v1` el
estudio **no existe**, y eso contradice «todo MaKo se debe poder utilizar por API» (Martín, 25/10). Está documentado en el
encabezado de `video-estudio.run.ts`, no resuelto: para abrirlo hay que sacarle la dependencia de la sesión a esas acciones.

## Las cifras de Joan eran ciertas las DOS: el dato cambió entre las preguntas (29/10/2026, claude3)

**El síntoma.** Código Inmobiliario (ws13), 26/10, del 19/09 al 26/10: a las 16:15 MaKo dijo 25 no-shows y 14 sin marcar; a
las 16:26, 28 y 10. Joan pidió los nombres de los sin marcar y MaKo contestó que «no se lista nominalmente».

**Medido contra la base** (el estado de cada R1 a esa hora, deshaciendo `lead_audit`): a las 16:15 había 25 y 14; entre
16:19 y 16:20 el equipo marcó cuatro R1 (una «vino», tres «no»), y a las 16:26 eran 28 y 10. **El diagnóstico obvio («MaKo
suma mal», el F3 del diagnóstico de WhatsApp) era el equivocado para los totales:** estaban bien. Lo que sí estaba mal: el
reparto «10 en septiembre y 18 en octubre» (era 8 y 20, sumado a mano: lo arregló `totalesDelPeriodo` el 28/10), que el
número nuevo no dijera por qué cambió, y que no hubiera ninguna lectura con los NOMBRES.

**La regla:**
- Un número que el equipo cambia en el día dice que es «de ahora» (`totalesDelPeriodo`, lib/metricas-modelo.ts) y la lista
  trae la hora de la cuenta (`contado_a`): si cambió, MaKo dice que se marcaron reuniones en el medio, no lo «corrige».
- **El número y su lista, con UNA definición:** `estadoDeAsistencia` (lib/reuniones-por-asistencia.ts) la usan
  `reporteMetricas` y `reuniones_por_asistencia`, con la misma ventana (`validarRango`). Dos cuentas parecidas dan dos
  cifras para lo mismo, y eso es exactamente lo que se ve como «MaKo se contradice».
- Va en el área **métricas**, no en la del CRM: por WhatsApp «sin marcar» y «no-show» abren métricas (`areasDelMensaje`,
  lib/mako-intencion.ts). Con el área del CRM no llegaba al turno (medido con `herramientasDelTurno`).

**Sin hacer:** `analisis_negocio` (`embudoDeFunnel`, lib/analisis-negocio.ts) cuenta lo mismo con su propio `if` y por
funnel; da igual hoy, pero no usa `estadoDeAsistencia`. «Pasame los no show» por WhatsApp clasifica «pensar» y no trae la
lista (es del clasificador del grupo).

**Vive en:** lib/reuniones-por-asistencia.ts · lib/api-mako/areas/metricas.* (`reuniones_por_asistencia`) ·
lib/metricas-negocio.ts · lib/metricas-modelo.ts · tests/reuniones-por-asistencia.test.ts.

## Un archivo del chat que una herramienta guarda: el `ref` viaja en la pendiente (29/10/2026, claude3)

**El síntoma.** Leila mandó la constancia fiscal de una clienta al chat del lead («este es el doc fiscal») y MaKo contestó
«Desde este chat no puedo adjuntar ni guardar el documento en su ficha». Era cierto por dos lados:
- el mensaje clasificaba «pensar» («adjunto para interpretar», lib/mako-intencion.ts), y con «pensar» no viaja ninguna
  herramienta que escriba;
- y no existía ninguna que tomara el archivo del mensaje.

**La causa de fondo:** `ctx.adjuntos` (los archivos de ESTE mensaje, ya guardados en el chat) existe sólo durante el turno
y sólo en la app. Una acción con tarjeta se EJECUTA después, al «sí», cuando ya no hay turno.

**La regla:**
- La acción toma el archivo en `preparar` (con el turno) y guarda su `ref` (`<id del mensaje>:<n>`) en la pendiente;
  `ejecutar` lo baja con `bajarAdjunto` (lib/chat-mako-adjuntos.ts), con el MISMO índice que `urlDeAdjunto`.
- El `ref` sale de `ctx.adjuntos`, nunca de lo que escribe el modelo.
- Va con `canales: ['app']`: por WhatsApp el archivo no queda guardado así.
- Lo que el documento dice lo pasa el modelo, que ya lo leyó. Se completa sólo lo VACÍO, también al confirmar (otro pudo
  cargarlo entre la propuesta y el «sí»).
- Guardar el archivo pasa por el mismo lugar que la pantalla (`guardarDocumentoFiscal`, lib/deal-fiscal-doc.ts).
- En el clasificador, nombrar el DOCUMENTO («constancia», «doc fiscal») actúa (familia `documento-fiscal`,
  lib/mako-intencion-app.ts). «Datos fiscales» sólo suma el área, porque «¿qué datos fiscales tiene?» es una pregunta.

**Sin hacer:** por WhatsApp (el doer) el adjunto no llega a `ctx.adjuntos`: la constancia por el grupo sigue sin poder
guardarse (dueño: MaKo en WhatsApp).

**Vive en:** lib/api-mako/areas/cobros.* (`guardar_documento_fiscal`) · lib/deal-fiscal-doc-reglas.ts ·
lib/deal-fiscal-doc.ts · lib/chat-mako-adjuntos.ts (`bajarAdjunto`) · lib/mako-intencion-app.ts ·
tests/documento-fiscal-desde-el-chat.test.ts.

## «Regenerar los docs, el snapshot y el plugin»: qué cambia de verdad con una operación que no sale por HTTP (25/10/2026)

Martín: «Todo, todo siempre tiene que ir a la API, todo MaKo se debe poder utilizar por API». Cada entrega dice qué quedó
declarado. Al sumar al área `operaciones` dos operaciones SÓLO de la plataforma y sin HTTP (ver y dar por visto un
«Completado»):
- **`docs/api-mako.md` y el snapshot no cambian, y está bien:** la referencia pública y `tests/api-mako-http.snapshot.txt` listan
  sólo lo que sale por HTTP. «Ya estaba al día» no es que el generador no la vio. La prueba de que una operación así está
  bien declarada es su test (que NO esté en el snapshot), no un diff en los docs.
- ⚠️ **`node scripts/generar-plugin.mjs` revienta** con `ERR_MODULE_NOT_FOUND ... lib/detalle-contrato` (importa `.ts`), aunque
  su cabecera diga ese comando. Se corre con `node --import tsx scripts/generar-plugin.mjs`, como `generar-api-doc.mjs`.

## Lo que falta conectar viaja como DATO (`falta: { servicio }`), y el link lo pone el código (25/10/2026)

Florencia (ws21) le preguntó al grupo «Estas analizando mis fathom?». Con su IA conectada, el runner del Closing habría
contestado «Fathom no está conectado en este negocio: se conecta en /integraciones»: un texto suelto, con el que ni el
código podía armar el link al modal de Fathom ni ofrecer ayuda. Plan: [conexiones-y-ayuda.md](conexiones-y-ayuda.md).
Vive en `lib/api-mako/tipos.ts` (`Falta`, `ctx.aFalta`), `lib/api-mako/ejecutar.ts` (`faltaParaElModelo`) y los runners;
lo fija `tests/conexiones-api.test.ts`.

- **El servicio va como dato en tres lugares a la vez:** la salida del runner (`SalidaLectura.falta`, el error de
  `Preparado`), el `Resultado` (y por HTTP, en el cuerpo del error) y el canal del código, `ctx.aFalta`, que corre salga
  bien o mal la lectura. Una lectura que NO es un error también puede llevarla: `panorama_closing` sin Fathom contesta sus
  contadores Y `falta`, porque unos contadores en cero se leen como «no tuviste llamadas».
- ⚠️ **El link lo pone UNO solo.** Si el canal agrega la línea por código (el doer de WhatsApp, `aFalta` →
  `lineaParaConectar`), el modelo recibe `falta` SIN link y con «no escribas ningún link»: si también se lo diéramos, lo
  escribiría él y saldría dos veces. Sin `aFalta` (la app, HTTP), va el link exacto del catálogo para que lo pase tal cual.
- ⚠️ **El análisis de llamadas no es «su IA»: es su Claude por clave.** Lo obvio era que `exigirIa` aceptara su GPT (IA16:
  «cada negocio paga su IA»). Pero el análisis corre sólo con Claude (`conClaveDelNegocio` en lib/closing.ts, Sonnet a
  propósito en lib/model-catalogo.ts): con su GPT la operación arrancaría y fallaría igual. Pide `falta: anthropic`.
- **«Se vincula en la tab WhatsApp» mandaba a una tab que ya no existe**: el QR vive en Chats (`/chats?conectar=whatsapp`).
- **`ver_ia_del_negocio`** dice con qué IA contesta cada cosa (la app, el grupo, los audios, el análisis) según las reglas del
  código, no una opinión, y **`como_conectar`** da los pasos y el link de una cosa por cómo la nombra la gente. Leen
  `listarPcDelNegocio` (lib/ia-pc.ts) sólo para contar: su comentario dice «para el super admin» porque devuelve nombres y
  ubicaciones; acá salen sólo cuántas y cuántas en línea, del propio negocio.

**SIN hacer:**
- Meta (`SIN_META`, lib/api-mako/areas/ads.helpers.ts) sin `falta`: si es `meta` o `zernio` lo decide el chat de Zernio
  (Zernio reemplaza el token de Meta, detrás de `ZERNIO_META_PROBADO`).
- `crear_borrador_whatsapp_empresa` (un `proponer`: `Propuesto` no tiene `falta`), el remitente del email (no es una
  conexión que falte: es el dominio en /email) y `conPasarelaConectada` de cobros (al confirmar).
- El chat de la app (`turnoApp`) no pone `aFalta`: el link le llega al modelo en el JSON y lo escribe él.
- `como_conectar` llega al turno sólo si el mensaje nombra el área integraciones, y su expresión no reconoce «conectar» ni
  Fathom, Zernio, Instagram o «mi Claude» (lib/mako-intencion.ts): tanda 3.

---

## El filtro por TAB no existe, y el presupuesto de 12.000 caracteres no alcanza para un jefe (16/10/2026)

**Síntoma (medido leyendo, para el diseño del chat único, `docs/diseno-mako-ai-native.md`).** La idea obvia para darle a
cada tab su chat era «el turno carga las operaciones de la tab». No hay cómo: `toolsDelRegistro` filtra por `area`, no
por `gating.tab` (`lib/api-mako/registro.ts`, el filtro), y las dos cosas no calzan: `graphics` es el área `metricas`,
`script` es el área `ads` (mezclada con las 39 de Ads Manager) y `landing-an` es el área `landing` (con las 65 de
`landing-writer`). Fijar áreas metía Ads Manager y Web Generator enteros en el Dashboard.

**Y aunque existiera, no entra.** El turno carga hasta `PRESUPUESTO_REGISTRO_CHARS` = 12.000 (`lib/doer-herramientas.ts`);
sólo las acciones del Dashboard (`graphics`) son 26.377 caracteres, las del CRM 60.800. Cuando se pasa, el corte se
avisa con un `console.warn` y nada más.

**La regla:** un chat por tab lleva una LISTA de claves de gating (las tabs retiradas siguen guardando operaciones: con sólo
`graphics`, el Dashboard pierde 15 de sus 32 acciones), un filtro nuevo en `FiltroTools`, y un tope propio medido para
ese panel; si algo queda afuera, el turno lo sabe y lo dice. Detalle y números: `docs/diseno-mako-ai-native.md`, (a) y (b).

## ⚠️ Pasar una acción a `pantalla` no la saca del chat: la tool vieja del mismo nombre gana

**Síntoma.** `proponer_presupuesto_campana` se declaró `confirmacion: 'pantalla'` (mueve
plata) y por WhatsApp MaKo seguía diciendo «¿confirmás con un sí?». El «sí» se cerraba
en error.

**Causa.** Dos cosas que no se ven desde la def:

1. El doer arma sus tools con `MAKO_TOOLS + MAKO_ACCION_TOOLS`, `toolsDelRegistro` excluye
   esos nombres y `runTool` le da prioridad a `NOMBRES_ACCION`. Una operación del registro
   que comparte nombre con una tool vieja **nunca llega a WhatsApp**: corre la vieja.
2. `porId()` indexa el `tipoPendiente`. La pendiente `meta_presupuesto` que dejaba la tool
   vieja resolvía a la def de pantalla, pasaba `gatingOk` y `confirmarPendiente` corría su
   `ejecutar()` sin mirar la `confirmacion`. Lo que lo frenaba era una marca local del
   runner de ads (`desdePantalla`). Sacar el `tipoPendiente` era peor: caía en
   `TIPOS_HEREDADOS` y se ejecutaba por `ejecutarAccion`.

**Regla.** Una acción de pantalla no tiene gemela de chat. `confirmarPendiente` y el
`confirmar_accion` viejo cierran sin ejecutar toda pendiente cuyo tipo resuelve a una
acción de pantalla, **antes** de reclamarla. `meta_presupuesto` salió de
`TIPOS_HEREDADOS` y la tool vieja salió de `MAKO_ACCION_TOOLS`. El test
«lo que se confirma en PANTALLA no se confirma por chat» cruza los `proponer('…')` del
doer viejo y `TIPOS_HEREDADOS` contra el registro.

**Vive en:** `lib/api-mako/acciones.ts` (`confirmarPendiente`, `TIPOS_HEREDADOS`) ·
`lib/mako-doer-acciones.ts` · `lib/mako-doer-in.ts` (`runTool`) ·
`tests/api-mako-registro.test.ts` · *2026-09-16 api-mako-areas*

---

## ⚠️ Una LECTURA que devolvía un link a un borrador se anunciaba como borrador creado

**Síntoma.** «¿Cómo va el borrador del plan?» y MaKo contestaba «Listo, te armé el
borrador».

**Causa.** El doer parseaba la salida de **todas** las tools: si había un `link` a
`/plan/revisar/` en el primer nivel, lo guardaba como `linkBorrador` y pisaba la respuesta
del modelo con `mensajeBorrador()`. Lo mismo con `url` a `/crm/revisar/` y el mensaje de
lead propuesto. `ver_borrador_plan` y `ver_estado_borrador` tenían esa forma.

**Regla.** Solo una ACCIÓN crea un borrador: las tres capturas de link del doer excluyen
las operaciones que el registro declara `lectura` (`!esLectura`), y el test lo exige en
las tres. Las lecturas del plan igual devuelven `link_revision`, por si otra capa hace la
misma suposición.

**Vive en:** `lib/mako-doer-in.ts` (`runTool`) · `lib/api-mako/areas/plan.run.ts` ·
*2026-09-16 api-mako-areas*

---

## ⚠️ Un link que lee un modelo lo escribe el código, también el de `/mako/revisar`

El doer ya escribía por código el link del borrador del plan y el del lead, porque el id
son 17 caracteres al azar y el modelo los copia mal (pasó en producción, de las dos
formas: un link que no existía y uno que abría otro borrador). Las acciones de pantalla
del registro devolvían su link a `/mako/revisar/<id>` y el modelo lo pasaba a mano.

**Regla.** `conLinksDeAccion` deja la respuesta intacta si trae exactamente los links que
devolvieron las tools; si no, saca todo `/mako/revisar/` del texto y agrega los
verdaderos. Tiene test con el caso del carácter de menos.

**Sin hacer:** los links a `/whatsapp?chat=…` que arman las áreas de WhatsApp y CS siguen
pasando por el modelo, y un `?chat=` que no matchea abre la conversación de otra persona
(ver [hallazgos-comunicacion.md](hallazgos-comunicacion.md)).

**Vive en:** `lib/respuesta-doer.ts` · `lib/mako-doer-in.ts` · *2026-09-16 api-mako-areas*

---

## ⚠️ Confirmar reclama antes de ejecutar, así que un corte deja la fila colgada para siempre

**Síntoma esperado.** Una pendiente en `confirmada` que nunca pasa a `ejecutada` ni a
`error`, o una propuesta `aplicada` sin `ok`, que desaparece de toda bandeja. Con el
costo de la IA ya pagado.

**Causa.** Es a propósito: `reclamarPendiente` y `marcarAplicada({ en_curso: true })`
corren **antes** de `ejecutar()` para que dos «sí» o dos clicks hagan una sola cosa, y lo
que falla no vuelve a `pendiente` para no invitar a un segundo intento sobre algo que pudo
escribir a medias. Pero si la plataforma corta la función en el medio, no corre ningún
`catch`. Y el techo lo pone quien confirma: `/api/v1` corta a 60 s, y las dos páginas de
`/mako` no declaraban `maxDuration`, así que sus server actions heredaban el default. Las
áreas que lo reportaron (closing, email, contenido, negocio, cs) confirman acciones que
analizan llamadas, mandan broadcasts o corren varios modelos.

`after()` no lo evita: comparte el techo de la invocación que lo lanzó.

**Regla.**
- `/mako/revisar/[id]` y `/mako/pendientes` declaran `maxDuration = 300`.
- Lo que encadena modelos o sincroniza un tercero no lleva `'http'`.
- **Todo lo que se pueda saber sin escribir falla en `preparar()`**, no en `ejecutar()`.
  Un candado en `ejecutar()` («solo lo confirma quien lo propuso») consume la pendiente
  aunque rechace: queda en `error` y el dueño legítimo ya no la puede confirmar.

**Sin hacer:** `mako_acciones_pendientes` no tiene `reclamada_at`, así que no hay forma de
saber cuándo se reclamó ni un barrido que pase a `error` las `confirmada` viejas. Las
lecturas del área mako (`ver_pendiente`, `ver_propuesta_accion`) informan
`sin_resultado` pasados 5 minutos, que es una inferencia.

**Vive en:** `lib/api-mako/acciones.ts` · `lib/mako-pendientes.ts` (`reclamarPendiente`) ·
`app/mako/revisar/[id]/page.tsx` · `app/mako/pendientes/page.tsx` ·
*2026-09-16 api-mako-areas*

---

## ⚠️ La pantalla genérica `/mako/revisar` no es neutra: cinco formas en que confirma otra cosa

La pantalla arma un formulario desde `parametros`, guarda el INPUT y al confirmar vuelve a
validar y a correr `preparar()`. Cada paso tiene una trampa:

1. **Listas partidas por comas** *(resuelto)*. Un `string[]` se unía con `, ` y se partía
   por `,` al confirmar, aunque nadie lo tocara: «Llamar a Ana, y después a Luis» volvía
   como dos ítems. Ahora es un valor por renglón.
2. **No se puede vaciar un campo** *(sin hacer)*. La pantalla manda `null` por lo vaciado y
   `validarInput` omite `null`, `''` y la ausencia por igual. Un runner que completa con lo
   guardado (`str(input, k) ?? previa.k`) reinstala el valor: la persona borra la garantía,
   confirma, ve «actualizado» y la garantía sigue. El área equipo usa `-` como «vaciar».
   El arreglo de raíz es que la pantalla distinga ausente de vacío y que
   `lib/api-mako/validar.ts` deje pasar `''`.
3. **Se vuelve a leer la base al confirmar.** Lo que `preparar()` resuelve contra la base,
   y no desde el input, puede cambiar entre la propuesta y el clic. Con un texto que
   reescribe un webhook (el borrador de un DM de Instagram) eso mandaba un DM que nadie
   vio. La cura es un `proponer()` propio que FIJE el valor en el input guardado.
4. **El título no sigue al formulario** *(sin hacer)*. `RevisarAccion` pinta el `resumen`
   de cuando se propuso. Si la persona cambia un booleano de sentido opuesto (prender o
   apagar), la pantalla afirma una acción y ejecuta la otra.
5. **`object[]` es un JSON crudo** *(sin hacer)*. Las cuotas de un plan de pagos se editan
   como JSON en un textarea.

**Regla.** Una acción de edición por la pantalla genérica parte de la fila existente y
declara en `preparar()` lo que compara contra la base. Si el dato que importa vive en la
base, se fija en el input al proponer.

**Vive en:** `app/mako/revisar/[id]/RevisarAccion.tsx` · `app/mako/revisar/[id]/acciones.ts` ·
`lib/api-mako/validar.ts` · `lib/api-mako/acciones.ts` (`aplicarPropuestaGenerica`) ·
*2026-09-16 api-mako-areas*

---

## ⚠️ Las propuestas genéricas no son idempotentes, y la cura obvia bloquea repetir una acción

**Síntoma.** Un reintento del modelo o de n8n deja dos propuestas iguales.

**Causa.** `ejecutar.ts` solo pasa `ref` si el input la trae, y ninguna operación la
declara (declararla pintaría un campo «ref» en el formulario). La cura obvia es una ref
determinística (`<op>:<hash del input>`), y **no sirve tal cual**: `crearPropuesta` devuelve
la existente si está `pendiente` **o `aplicada`**. Con una ref por contenido, «pausá la
campaña» → «activala» → «pausala de nuevo» devolvería el link de la primera pausa ya
aplicada, y no se podría volver a hacer.

**Sin hacer.** La ref tiene que bloquear solo contra una `pendiente` igual, no contra una
aplicada. Mientras tanto, duplicar es el mal menor: una propuesta de más se descarta.
Aparte: la ref por defecto de un lote de leads (`lead:<tel1,tel2,…>`) se corta a 200
caracteres, y dos lotes que comparten los primeros ~15 contactos chocan.

**Vive en:** `lib/api-mako/ejecutar.ts` · `lib/propuestas.ts` (`crearPropuesta`) ·
*2026-09-16 api-mako-areas*

---

## ⚠️ `gating.tab` mira la CAPA del workspace, no a la persona

**Síntoma.** Un closer podía, por MaKo, cerrar experimentos, leer la Retro entera o ver
las métricas de marketing que su pantalla le esconde.

**Causa.** Esas páginas hacen `requireRolWs([])` (solo admin). El registro, con
`gating.tab`, solo pregunta si la capa compró la tab.

**Regla.** Si la página de la tab hace `requireRolWs([])`, cada operación del área lleva
`rolMinimo: 'admin'`.

Dos trampas más de la vista, resueltas:
- **Solo miraba la barra principal.** `integraciones` vive en el menú de la foto
  (`userNavKeys`) y el super-admin, que ve `/integraciones`, recibía 404 en todas sus
  operaciones. Ahora `tabsDeCapa` pregunta con `tabEnCapa`, la misma función del gate de
  las páginas.
- **Fallaba abierto.** Un error leyendo el workspace dejaba `tabs = null`, que significa
  «ve todo»: con la base lenta, un cliente `pm` veía el CRM. Ahora queda sin tabs.

**Vive en:** `lib/api-mako/vista.ts` · `lib/api-mako/registro.ts` (`gatingOk`,
`tabsDeCapa`) · *2026-09-16 api-mako-areas*

---

## ⚠️ Lo que el registro declara sin `'http'` puede salir igual por una puerta vieja

- **`/api/agente/consultar` sirve `historial_whatsapp` y `reuniones_lead` por bearer**
  (`CONSULTAS_AGENTE`), aunque el registro declara las dos sin `'http'`: salen por HTTP la
  conversación de WhatsApp de un lead y el `share_url` público de Fathom, que abre la
  grabación y la transcripción de la llamada de venta. En `/api/v1`, `reuniones_lead` ya es
  `SIN_HTTP`. **Decisión de producto pendiente:** sacarlas de la puerta vieja rompe las
  skills ya instaladas.
- **Las tools viejas devuelven el error adentro de un éxito.** `listar_horarios_reunion` y
  `reuniones_lead` contestan `{ok:false}` o «No pude buscar…» como texto, y el registro lo
  trata como lectura exitosa: HTTP 200 con la falla adentro. *(sin hacer)*
- **El script del Pixel pesa 86 KB** y ni `runTools` ni el runner del registro recortan un
  tool_result. Nada que devuelva el snippet sale por un canal donde lo lee un modelo.
- **Los errores de Postgres salían como 400 con nombres de tablas.** `esNuestro` solo
  reconocía algunos textos de infraestructura; «invalid input syntax…» iba crudo al
  tercero. Ahora reconoce los mensajes de Postgres y el prefijo «Query X falló».

**Regla.** «No sale por HTTP» se verifica contra TODAS las rutas con bearer, no contra el
registro. El snapshot `tests/api-mako-http.snapshot.txt` solo ve el registro.

**Vive en:** `lib/agente-consultas.ts` · `lib/api-mako/ejecutar.ts` ·
`lib/api-mako/areas/crm.def.ts` · `lib/api-mako/areas/landing.run.ts` ·
*2026-09-16 api-mako-areas*

---

## ⚠️ El email de quien confirma viaja en `resultado`

`aplicarPropuestaGenerica` guarda `por: ctx.actor` (el email de la sesión) en el mismo JSON
que el resultado, y `confirmarPendiente` y `cancelarPendiente` lo concatenan en el texto
(«confirmado por <email>»). Toda lectura que devuelva `resultado` crudo por HTTP filtra
datos del equipo. Las lecturas del área mako lo sanean con lista blanca y regex.

**Sin hacer:** guardar el actor en un campo propio. Mientras tanto, una lectura nueva que
exponga `resultado` tiene que sanearlo.

**Vive en:** `lib/api-mako/acciones.ts` · `lib/api-mako/areas/mako.run.ts` ·
*2026-09-16 api-mako-areas*

---

## ⚠️ Lecturas que escriben

`listar_pendientes`, y `confirmar`/`cancelar` al elegir, llaman a `vencerExpiradas`
(UPDATE a `vencida`) antes de leer. Las lecturas nuevas del área mako lo esquivan filtrando
`vence_at > ahora`. Lo mismo pasa en libs de otras áreas (`tzDeWorkspace` persiste la zona,
`listAccounts` de Zernio hace upsert del ruteo): una operación `lectura` no garantiza que
no escriba. *(sin hacer en el núcleo)*

**Vive en:** `lib/mako-pendientes.ts` · `lib/api-mako/acciones.ts` (`vigentesPara`) ·
*2026-09-16 api-mako-areas*

---

## ⚠️ `updateTag` fuera de una server action lanza, y el catch se lo traga

**Síntoma.** Después de confirmar por WhatsApp o por HTTP, el tablero y las listas
muestran lo de antes hasta 60 s. Confirmando desde `/mako/revisar` se ve bien.

**Causa.** `updateTag` solo funciona dentro de una server action. Desde un route handler o
el webhook lanza, y los runners lo tenían en un `try/catch`.

**Regla.** En un runner del registro se invalida con `revalidateTag(tag, { expire: 0 })`.

**Vive en:** `lib/api-mako/areas/crm.helpers.ts` · `lib/api-mako/areas/general.run.ts` ·
*2026-09-16 api-mako-areas*

---

## ⚠️ «Una def no importa valores» era el diagnóstico equivocado

Varias áreas copiaron enums a mano en su `.def.ts` creyendo que una def no puede importar
valores. La regla real es más chica: no puede importar valores de un módulo con
`server-only`, ni transitivamente, porque el generador de la referencia corre en el
pre-push bajo `node --import tsx` sin `--conditions react-server`. Los módulos de datos
puros (`fase-diagnostico`, `cerebro-modelo`, `personalidad`, `guion-estado`) se importan:
copiarlos crea un enum que se desincroniza sin avisar.

**Vive en:** `lib/api-mako/tipos.ts` (cabecera) · `lib/api-mako/areas/negocio.def.ts` ·
*2026-09-16 api-mako-areas*

---

## ⚠️ Tres formas en que un test del registro dio verde sin mirar nada

1. **Un regex sobre el fuente crudo matcheaba la cabecera** que explica la regla, y daba
   verde con el código borrado. Los chequeos de código van sobre `sinComentarios(src)`.
2. **Un caso de gating tapaba otro.** El test de `rolMinimo` usaba una def con
   `soloWs1`, que ya la escondía: borrar la guarda de rol no rompía nada. Un caso por
   guarda.
3. **El guard del pre-push leía el disco, no HEAD**, y frenaba el push de la sesión vecina
   por cambios sin commitear que no eran suyos. Ahora compara contra HEAD y se abstiene si
   `lib/api-mako` está sucio.

**Regla.** Cada test del registro se prueba rompiéndolo, una guarda por vez, y el
resultado queda en su comentario.

**Vive en:** `tests/api-mako-registro.test.ts` · `scripts/generar-api-doc.mjs` ·
*2026-09-15/16 api-mako*

---

## ⚠️ El tope de caracteres de las tools cortaba por orden de declaración

Groq corta en ~7k tokens de entrada y los esquemas de las tools pesan. El doer suma las
tools del registro de las áreas que nombra el mensaje con un tope de 12.000 caracteres, y
el tope cortaba en el orden en que están declaradas: en un área de 50 operaciones,
«pausá la campaña X» se quedaba con las primeras 15 lecturas y sin la acción que pidió.

**Regla.** Antes del tope, `ordenarPorRelevancia` pone primero las operaciones cuyo id,
título o descripción nombran palabras del mensaje. Es un orden, no un filtro.

**Vive en:** `lib/api-mako/registro.ts` · `lib/mako-doer-in.ts` ·
`app/api/mako-doer/route.ts` · *2026-09-15 api-mako*

---

## ⚠️ Una operación nueva le saca el lugar a otra por un EMPATE de palabras, no sólo por su tamaño (25/10/2026)

**Síntoma.** `tests/ops-center-clasificador-app` en rojo: «Cambiá el segundo mensaje de la automatización de bienvenida…» ya
no traía `editar_pasos_secuencia_mensajes`, y «Hacé que la automatización de reactivación salga todos los martes a las 15»
no traía `cambiar_crons_secuencia`. La que entraba en su lugar era la nueva, `cambiar_botones_mensaje`.

**El diagnóstico obvio («achicar lo que creció») arreglaba una sola.** Medido con una sonda en `toolsDelRegistro`:
- En la primera, la app busca en todo (`registroParaLaApp`) y las áreas nombradas tienen el 75 %, 9.000. Botones, CRON y
  editar_pasos sumaban 9.016: faltaban 16 caracteres.
- En la segunda (una pasada de 12.000), botones EMPATABA en 2 puntos con `cambiar_crons_secuencia` por dos palabras sueltas
  de su descripción: «automatización» y «flujo» (esta, de la pista del clasificador «crear automatizacion con ia flujo
  pedido»). A igual puntaje gana la declarada antes, y botones está antes en chatbot.def.ts. Con ella adelante, el CRON
  (4.114) no entraba. Achicar no alcanzaba: había que sacar el empate.
- El commit señalado (3a443b08f) no fue el primero: su padre fallaba igual. Empezó con la operación misma (b3ef516f9).
- Una hora después lo repitieron las tres de la prueba A/B (A3): `prueba_ab_automatizacion` llevaba «automatizacion» en el id
  (2 puntos en cualquier pedido de automatizaciones) y las tres estaban declaradas antes que el CRON. Ahora son `ver_prueba_ab`,
  `empezar_prueba_ab` y `detener_prueba_ab`, sin «automatización» en el título y AL FINAL del área: pierden los empates.

**La regla.** Una operación nueva va al FINAL de su área y se mide con las frases de `tests/ops-center-clasificador-app`
ANTES de entregar. Su descripción dice de entrada para qué sirve SÓLO ella («SÓLO para un DM de Instagram o Messenger (los
demás mensajes, con editar_pasos_secuencia_mensajes)») y no repite las palabras que tienen todas las del área
(«automatización», «flujo», «WhatsApp»): cada una es un punto que la sube por encima de la que se pidió. El presupuesto no se
sube: es el techo de Groq.

**Vive en:** `lib/api-mako/registro.ts` (`ordenarPorRelevancia`: el empate lo decide el orden de declaración) ·
`lib/relevancia-app.ts` (`registroParaLaApp`, el 75 %) · `lib/api-mako/areas/chatbot.def.ts` · `tests/api-mako-botones.test.ts`

---

## ⚠️ La escritura directa de /api/v1 perdía `faltan`: una pregunta llegaba como un 422 de texto (25/10/2026)

**Síntoma.** Crear con IA por HTTP con un token detallado que escribe: cuando MaKo necesitaba un dato («¿Por dónde le
escribo?»), la respuesta era un 422 con la pregunta como mensaje de error. Para quien llama, un fallo.

**Causa.** Hay dos caminos. El que propone (`ejecutarOperacion`, lib/api-mako/ejecutar.ts) devuelve el 400 de `preparar()`
con `faltan`. La escritura directa (`aplicarEnElActo`, lib/api-mako/flujo.ts) resume todo en `resumen`, porque la escribió
un flujo, que sólo necesita una frase para el rastro. El `faltan` se perdía ahí, y la pregunta que hace el modelo AL EJECUTAR
ni siquiera lo tenía.

**La regla.** `ResultadoFlujo.faltan` lo lleva (el de `preparar()`, y el de `ejecutar()` en `datos.faltan`), y
lib/api-mako/rutas-http.ts lo devuelve como 400 con `faltan` ANTES del 422. Una pregunta es un parámetro que falta: quien
llama contesta en ese parámetro y vuelve a llamar.

**Vive en:** `lib/api-mako/flujo.ts` (`aplicarEnElActo`) · `lib/api-mako/rutas-http.ts` ·
`lib/api-mako/areas/chatbot.run.ts` (`crear_automatizacion_con_ia`) · `tests/api-mako-botones.test.ts`

---

## ⚠️ Un aviso de «la lib corta en 1000» se vuelve mentira —o candado— el día que la lib pagina

**El caso (17/09/2026):** la API de MaKo no podía arreglar los truncados de las libs, así que
los DECÍA: contaba las filas reales con `count` exacto y ponía una salvedad en la respuesta
(`contarFilas` + `avisoRecorte` en `metricas.helpers.ts`, `avisoTope` en chatbot,
`avisoRecorteClosing` en closing). Honesto mientras la lib no paginaba. Cuando la caza de
paginado arregló las libs, esos avisos quedaron así:

- **Candado:** `email.run.ts` se negaba a mandar o programar un segmento de más de 1000
  «porque la lib no pagina». `leadsDeSegmento` ya paginaba, así que el guard **bloqueaba el
  envío a los 1.044 «activos» de ws1** desde MaKo. Ahora compara contra `MAX_DESTINATARIOS`,
  importado de `lib/email-marketing.ts`: el tope vive donde vive la lectura.
- **Mentira permanente:** `crm.run.ts` avisaba «puede haber leads sin evaluar» con
  `totalLeads >= 1000`. Con 1.108 leads y `evaluarAutoWorkspace` paginando, salía siempre en ws1
  y siempre era falso. Lo mismo los «se contó sobre los primeros 1000» de email y closing, y
  los textos de `landing.run.ts` e `integraciones.run.ts`.

**Regla:** un aviso que describe un defecto de OTRA capa se actualiza **en el mismo commit**
que arregla ese defecto. Antes de cerrar un arreglo de paginado, `grep` del nombre de la
función en `lib/api-mako/areas/`. Y un número que copia el tope de otra capa se importa, no se
reescribe.

**Lo que quedó SIN hacer:**

- `comparar_agendas_meta_crm` (`metricas.run.ts`, ~:338) sigue poniendo `avisoRecorte` sobre
  `agendas_segun_meta`, y `getAgendasComparador` pagina desde el 17/09: con un rango de más de
  ~5 meses diría que el número está calculado sobre 1000 filas cuando no.
- Siguen ciertos (las lecturas no se tocaron) y hay que sacarlos cuando se paginen: los de
  `metricas.run.ts` sobre embudo, Tendencias y `pagos`, `general.run.ts:129` (`cashUsd`/`soldUsd`)
  y `:323` (`getTramoJ1J2Reciente`), y `plan.helpers.ts:16` (`listPlanBoard`, `listTareas`).

**Vive en:** lib/api-mako/areas/{email,crm,closing,chatbot,landing,integraciones,metricas,general}.run.ts · metricas.helpers.ts · *2026-09-17 caza de paginado*

## `soloWs1` no es «el workspace 1»: es «ws 1 Y rol admin»

**Vive en:** `lib/api-mako/registro.ts` → `gatingOk` · `lib/api-mako/tipos.ts` → `Gating` · *2026-09-26*

El nombre menciona UNA dimensión y la condición mira DOS:

```ts
if (g?.soloWs1 && !(v.ws === WS_PRINCIPAL && v.rol === 'admin')) return false;
```

Así que una operación `soloWs1` **también exige rol admin**, sin que ninguna def lo
declare. El doc del tipo lo dice («solo para ws 1 con rol admin») y el nombre no, que es
donde se pierde.

**Por qué muerde al SACARLO, no al ponerlo.** El 26/09/2026 el área `cs` dejó de ser de
un solo cliente y había que quitarle `soloWs1` a las tres operaciones que sobrevivieron.
Quitarlo a secas suelta el workspace —que era el objetivo— **y el rol, que nadie había
pedido soltar**. La decisión correcta no se saca del flag: se saca de mirar qué exige la
PANTALLA de esa área. Ahí era `requireCapa('customer-success')` sin guard de rol, así que
quedó sin `rolMinimo`; si hubiera sido `requireRolWs([])`, había que escribirlo a mano en
las tres.

**La regla que queda:** al sacar un flag de gating, enumerá qué condiciones lleva adentro
leyendo `gatingOk`, y reponé a mano las que seguían haciendo falta. Un flag compuesto se
quita de a una dimensión, nunca de un saque.

El detalle del caso, en [hallazgos-customer-success.md](hallazgos-customer-success.md) →
«Sacar el programa de los SEIS lugares donde también vivía».

## Una capacidad del registro que el mensaje no NOMBRA no llega al turno

**Vive en:** `lib/mako-intencion.ts` (`AREA_KEYWORDS`) · `lib/api-mako/registro.ts`
(`toolsDelRegistro`, `ordenarPorRelevancia`) · `lib/api-mako/areas/crm.def.ts` ·
`lib/api-mako/areas/crm.run.ts` · `lib/google-calendar.ts` · `lib/mako-doer-in.ts` ·
`tests/agenda-whatsapp.test.ts`

Agendar y mover reuniones en Google Calendar desde el grupo de WhatsApp, pedido por un
cliente inmobiliario (ws13) el 07/10/2026. Agendar ya existía, pero solo por Calendly, y
escribir la capacidad nueva fue la parte fácil. Tres cosas decidían si le llegaba al
modelo, y ninguna da error:

1. **Las tools del registro entran al turno sólo si el mensaje NOMBRA el área**
   (`areasDelMensaje`). El área es una regex de palabras, y las del vertical no estaban:
   «pasá la visita de Juan al viernes» → cero áreas → cero tools de agenda. Un negocio
   inmobiliario no agenda «reuniones»: agenda visitas y citas. Y `\bagend` no matchea
   «reagendá», porque entre «re» y «agend» no hay borde de palabra.
2. **Dentro del área, entra por relevancia hasta un presupuesto de 12.000 caracteres.**
   La relevancia puntúa las raíces del mensaje contra id + título (doble) y contra la
   descripción. La lectura que mover NECESITA —encontrar la reunión— no tenía «reage» en
   el título, y con «reagendá a Juan» quedaba afuera mientras la acción de mover sí
   entraba: **el modelo tenía la herramienta para mover y no la que le dice QUÉ mover.**
   Lo cazó el test, que arma el turno con los mismos números que el doer.
3. **El doer no le decía al modelo qué día es.** «El jueves» lo tenía que adivinar. La
   confirmación del dueño lo ataja —el resumen dice el día de la semana—, pero esa red no
   está para eso. Ahora va HOY, en la zona del negocio, en los turnos con herramientas.

**La regla: una capacidad nueva del doer se prueba ARMANDO EL TURNO con los mensajes como
los escribe la persona, no llamando al runner.** El molde es `tests/agenda-whatsapp.test.ts`:
desde el 08/10, `clasificarIntencion` + `herramientasDelTurno` (lo MISMO que corre el doer)
—armarlo a mano, sin el clasificador, dio verde sobre el bug; ver abajo—.
Llamar al runner prueba que la operación funciona; armar el turno prueba que alguien la
puede pedir.

⚠️ **Y el gating `integracion` es INFORMATIVO: no filtra** (`lib/api-mako/tipos.ts`). El
modelo ve las de Calendly y las de Google a la vez, así que cada descripción dice cuándo es
la suya y el runner contesta un error legible si la integración falta. Leerlo como un
filtro es asumir que el modelo no puede elegir mal.

⚠️ **Y la referencia generada (`docs/api-mako.md`) documenta sólo lo que sale por HTTP.**
Con tres operaciones nuevas sin HTTP, el generador contesta «ya estaba al día», y eso es
correcto: no es que no las vio. Se distingue en un `grep` (`reuniones_lead`, que tampoco
sale por HTTP, tampoco figura).

### Lo que quedó sin hacer

- **No se probó de punta a punta contra una agenda real.** El único workspace con Google
  Calendar conectado es el ws1, que es un cliente: probar ahí es mandar una invitación real
  desde su cuenta. La primera prueba es el primer uso del ws13, con su agenda conectada.
- **Mover en Google no actualiza `fecha_junta_1/2` del lead.** `setMeetingManual` reabre el
  lead y le borra la etapa manual —es para mover tarjetas, no horarios—, y no hay forma
  determinística de saber si la reunión movida es la R1, la R2 o una visita. Queda anotado
  en el historial del lead.
- **Si la reunión entró por Cal.com (o Calendly) y se mueve en Google, el proveedor de
  reservas no se entera.** El evento de Google se mueve; la reserva sigue con la hora vieja.
- ~~El Uso Limitado de Google sigue abierto~~ **Cerrado el mismo día, y rehecho**: la
  agenda ya no pasa por el modelo. Estas tools le devuelven un estado o un resumen sin nada
  de la agenda, y el detalle va a la persona por `paraLaPersona`. Mover ya no necesita la
  lectura previa: el código busca la reunión con el día y la hora que dijo la persona
  (`lib/agenda-sin-ia.ts`, detalle en `docs/hallazgos-ia.md`). Por eso lo de «la
  herramienta para mover entraba y la que dice QUÉ mover no» quedó como historia: la
  regla de armar el turno con frases reales sigue valiendo.

*07/10/2026 — sin subagentes; medido armando el turno y rompiendo el test cinco veces
(2, 2, 1, 1 y 1 fallos). Commit `c3c2ef17`.*

### 08/10: el test armaba el turno SIN el clasificador, y daba verde sobre el bug

**Vive en:** `lib/mako-intencion.ts` (`esPedidoAgenda`, `corrigeAgenda`, `sinPrefijoDeLote`,
`RELEVANCIA_AGENDA`) · `lib/doer-herramientas.ts` (`herramientasDelTurno`, nuevo) ·
`lib/mako-doer-in.ts` · `lib/agenda-sin-ia.ts` · `lib/google-calendar.ts` (`eventosDelDia`,
`cancelarEventoDeReunion`, `cambiarEventoDeReunion`) · `lib/api-mako/areas/crm.{def,run}.ts` ·
`tests/agenda-whatsapp.test.ts`

Al día siguiente de conectar su Google, el cliente escribió «Mako, agenda me una reunión
mañana 12hs de 1hs que se llame PRUEBA» y MaKo contestó «por aquí no puedo agendarte». La
conexión tenía permiso de escritura; el pedido nunca llegó a una herramienta.

⚠️ **La regla de arriba se cumplió a medias, y esa mitad era la que importaba.** El test
armaba el turno con `areasDelMensaje` + `toolsDelRegistro` y `incluirAcciones: true` FIJO:
se salteaba el clasificador y el filtro de «en una pregunta MaKo ofrece». Con el código de
ese día, 3 de sus 5 frases de escritura llegaban al turno real sin la herramienta
(«agendame…» y «pasá la visita…» caían en `pensar`, que sólo lleva lecturas; «moveme la
cita…» en `capturar`), y la del cliente también: «agenda» sin tilde y el pronombre suelto no
son ninguno de los imperativos, así que cayó al default, material para anotar. **Ahora la
selección es una función pura que llaman el doer y el test** (`herramientasDelTurno`): un
test que arma el turno a mano prueba otra cosa que lo que corre.

Lo que destapó, y ninguna da error:

1. **El clasificador no conocía el pedido de agenda.** Va una regla propia: un verbo de
   agenda + una reunión + un día o una hora, en un mensaje corto (la tilde que exigen los
   imperativos protege de la tercera persona de un volcado; acá protege el combo). Con las
   formas con modal («me puedes agendar…»), que es como pide quien tutea.
2. **Con una pendiente abierta, «cancelá la reunión…» y «no, movela al viernes» eran un
   «sí» o un «no»**: `CONFIRMACION` arranca con «cancela» y «no». El turno llegaba con
   confirmar/cancelar y nada más, y corregir la hora sólo cancelaba la propuesta.
3. **El «sí» a un ofrecimiento llegaba como `actuar` pero sin herramientas de agenda**, y
   no alcanzaba con calcular las áreas sobre el ofrecimiento: **el presupuesto ordena por
   relevancia CONTRA EL TEXTO**, y contra «sí, dale» la acción quedaba afuera. Cambiar las
   áreas sin cambiar la relevancia no trae la herramienta. Por la misma razón, «movela al
   viernes» («movel» no es raíz de nada) quedaba afuera: un pedido de agenda suma
   `RELEVANCIA_AGENDA` al presupuesto.
4. **El encabezado de un lote es nuestro y sumaba áreas**: «[Te mandó 2 mensajes… carga
   TODAS las tareas juntas…]» nombra plan, CRM y ads por sí solo, y gastaba el presupuesto.
5. **Las de Calendly viajaban a un negocio sin Calendly**, y su receta («buscá el lead,
   pedile el email») le ganaba a la de Google con un evento sin lead. `gating.integracion`
   sigue siendo informativo en el registro; el doer las saca leyendo la credencial, y si la
   lectura falla las deja (no pudo leer no es no tiene).
6. **Faltaba capacidad**: crear SIN lead (un evento del negocio, sin invitados), ver el día
   entero (`agenda_del_dia`), y cambiar el nombre o la duración, o cancelar, con o sin lead.
   Sin lead se busca por el día y la hora que dijo la persona (`eventosDelDia`, estricta: un
   fallo de Google no es «no tienes nada»). Para cancelar o cambiar se exige el MISMO
   minuto y el mismo título: si alguien lo movió entre el «propongo» y el «sí», no se toca.
   Todo por la regla del 07/10: la lista del día, los títulos y cuántos invitados hay van a
   la persona; el resumen que vuelve al modelo sólo lleva lo que ella dijo.

Aparte: el system de MaKo de TODO cliente decía «chat general del dashboard del negocio de
Martín», y le contestó «Mira, Martín…» al cliente. Nadie lo tenía editado (medido): era el
default del código (`lib/prompt-defaults.ts`, con su guard `tests/prompt-sin-dueno.test.ts`).

**Lo que quedó sin hacer:**

- **No se probó contra una agenda real.** El ws13 ya tiene Google conectado, pero es un
  cliente: probar ahí es escribir en su agenda. La primera prueba es su próximo pedido.
- **«movela al viernes» SIN pendiente ni agenda abierta** sigue sin llegar: no nombra la
  reunión, y un verbo suelto como «movela» también se usa para una tarea del plan.
  → **Cerrado el 09/10**: pregunta UNA vez «¿La reunión o la tarea?» (ver la entrada de abajo).
- **Un «Agendar reunión con…» al principio de una línea** se lee como una tarea dictada si
  el mensaje es una lista: decidir si es una orden o material es de Martín.
  → **Cerrado el 09/10**: dentro de una lista sigue siendo material; sola en una línea, es orden.

*08/10/2026 — sin subagentes; el diagnóstico y su refutación los midió la sesión del CRM
(solo lectura; `joan-0-diag.json` y `joan-3-refuta.json` en su scratchpad). 15 roturas entre `tests/agenda-whatsapp.test.ts` y
`tests/agenda-sin-ia.test.ts`, todas con su fallo.*

## ⚠️ Una herramienta con una lista cerrada de campos hace que el modelo afirme «no hay» sobre un dato guardado (08/10/2026)

**Vive en:** `lib/mako-tools.ts` (`ficha_lead`, `resumenLead`) · `lib/meta-leads-campos.ts`
(`formularioParaModelo`) · `lib/api-mako/areas/crm.def.ts` (`ficha_lead`)

Joan le preguntó a MaKo por WhatsApp (ws15) qué propiedad quería vender Rosana, y MaKo
contestó «en su ficha no hay detalles». La respuesta estaba en `leads.meta_field_data`, y la
ficha de la app la mostraba desde el 07/10. `ficha_lead` devolvía `resumenLead`, que son 20
campos fijos, más `getLeadRespuestas`, que son R1/R2 de `lead_respuestas`, y un lead de
formulario no tiene nada ahí. **El modelo no dice «no me llegó ese campo»: dice «no hay».**
El otro turno, «¿tenés acceso a lo que dijo en el formulario?», gastó 6 pasos buscando con
otras herramientas algo que ninguna devolvía, hasta el 429. `historial_lead` le mostraba que
las preguntas EXISTÍAN, pero sin las respuestas.

- **El dato va APARTE de `respuestas`.** `getLeadRespuestas` lo leen los datos faltantes, el
  chatbot y los insights, y mezclarlo ahí les cambia lo que leen.
- **`null` ≠ `[]`.** `null` es que no vino de un formulario, o que entró antes del 04/10, cuando
  las respuestas no se guardaban. `[]` es que el formulario no tenía preguntas propias. Lo
  explica la descripción una vez, no cada ficha: la nota en la ficha pesaba ~170 caracteres y
  viajaba en cada lead que no fuera de Meta.
- ⚠️ **Hay DOS descripciones de la misma herramienta.** El modelo de WhatsApp y la ruta vieja
  de la skill leen la de `MAKO_TOOLS`, y HTTP y la doc leen la del registro. Si se corrige una
  sola, el que la lee de la otra no se entera.
- **Sale por todos los canales, decidido.** Es dato del lead, como el teléfono y el email de
  la misma ficha. Los dos caminos de afuera son el runner de HTTP y `/api/agente/consultar`,
  que corre `runMakoTool` sin `ctx.canal`. Recortarlo en uno solo deja abierto el otro, y el
  snapshot de HTTP fija ids, no campos.

**Lo que quedó SIN hacer:** `reuniones_proximas`, `insight_lead`/`generar_insight` y el paso
del chatbot (`lib/paso-ia.ts:96`) tampoco ven `meta_field_data`.

*08/10/2026 — diagnóstico y refutación con subagentes, sólo lectura. Medido con la
herramienta real: `#2594` pasó de 438 a 648 caracteres. Commit `ddfb07e8`.*

## ⚠️ El registro tenía las operaciones del CRM y el clasificador no las dejaba llegar: «anotá» era «al plan» en TRES puertas (08/10/2026)

**Vive en:** `lib/mako-intencion.ts` (`esPedidoSobreLead`, regla 3-quater, `PEDIDO_ANOTAR`) ·
`lib/mako-router.ts` (`PLAN`) · `lib/mako-doer-in.ts` (`esCargaDePlan`, `guardarCrudo`) ·
`tests/crm-pedidos-whatsapp.test.ts`

Martín: «Joan le pidió que cargue una NOTA a ese lead y creó una tarea… Cuando justamente
creamos toda una documentación API para que MaKo en WhatsApp pueda hacer todas las acciones».
En ws15 (#1274), Joan dijo por audio: «Macu, anotá en el lead… Nicolás como una nota que ya
tiene su propiedad con Remax… Solo agregá esa nota al lead Nicolás».

**El diagnóstico obvio, «a MaKo le falta la herramienta», era el equivocado.**
`agregar_nota_lead` existe, y su descripción dice textual «úsala cuando el dueño diga "anota en
X que…"». Lo que pasó:

1. **«Anotá» se leía como «cargalo al plan» en TRES lugares que no se hablan:**
   - `PEDIDO_ANOTAR` del clasificador, la regla 2, que corre antes que todo;
   - el `PLAN` del router (también con `agregá`, `sumá` y `cargá`), que pone `(plan)` en la
     ruta, y con eso el doer exige un borrador del plan;
   - `esCargaDePlan` del doer, que manda el «Claro, anoto eso 👇», obliga a usar una
     herramienta y decide el guardado crudo.

   El turno llegó con las 3 herramientas del plan.
2. **Gemini dio 503 y el respaldo guardó el pedido como borrador del plan:** «MaKo no pudo
   procesarlo — quedó tal cual lo dijiste» (`plan_propuestas`, `propmuzvpq2whd8hr`). Esa es
   la «tarea» que vio Martín. El respaldo hizo lo que tenía que hacer con lo que le llegó: el
   error estaba en la clasificación, no en el respaldo.
3. **Una hora antes, otro pedido se había perdido sin que nadie lo notara.** «okay, movelo a
   "calificado" dentro del CRM» cayó al default (`capturar`), porque «movelo» sin tilde no
   está en ninguna lista. Con solo las herramientas del plan en la mesa, MaKo contestó «Voy a
   moverlo a Calificado. ¿Confirmas?» **sin dejar ninguna pendiente**, y el «sí» chocó con
   otro 503. Nicolas nunca se movió.

⚠️ **No era un caso suelto.** Se midió con el turno real (clasificador + `herramientasDelTurno`).
De 19 pedidos comunes del CRM (nota, mover de etapa, marcar calificado, asignar closer,
etiqueta), 17 llegaban SIN su herramienta. Pasaban sólo «mové a Rosana…», con la tilde exacta
que pide `ACCION_CUENTA_RE`, y el «sí» a un ofrecimiento.

**La regla:**
- **La señal es el OBJETO, no el verbo.** Un verbo de pedido más algo que sólo vive en el CRM
  (lead, ficha, nota, etapa, «calificado», etiqueta, closer) da `actuar`, con el área y la
  relevancia de su tipo. Sin la relevancia, la herramienta queda afuera del presupuesto de
  12.000 caracteres. Por eso la nota sin la palabra «nota» («anotá en el lead de Rosana
  que…») se marca por el verbo de anotar.
- **Las tres puertas preguntan lo MISMO** (`esPedidoSobreLead`). Arreglar sólo el
  clasificador deja el `(plan)` del router y el acuse de «anoto eso».

**Medido sobre los 178 mensajes reales de `mako_doer_conv`:** cambian 4 clasificaciones, y
las 4 eran pedidos perdidos:
- #349 de ws11, «Me agregas a lead…»;
- #1095 de ws13, «agrega el link a notas del lead…», que también había terminado de tarea
  del plan;
- #1267 y #1274 de ws15.

Ningún volcado de ideas cambia.

**Lo que quedó SIN hacer:**
- **La nota se probó hasta el turno, no hasta la ficha.** `agregar_nota_lead` escribe el
  evento `Nota` de `lead_audit`, el mismo que lee la tarjeta «Notas» de la ficha
  (`getLeadNotasAction`, en `app/crm/actions.ts`). Pero no se corrió un «sí» de punta a punta,
  porque ws15 es un cliente.
- **«¿Confirmas?» sin pendiente.** Un turno sin la herramienta puede prometer una confirmación
  que no existe, y nada lo ataja: `validarRespuestaDoer` caza un link inventado, no una
  pregunta de confirmación sin pendiente.
- **Gemini caído entero y una sola key.** La red de plataforma (Groq gratis) no entra en un
  turno de más de ~7 k tokens, y el último recurso pago sigue siendo una decisión de Martín.
- **Las operaciones del registro que no son del CRM tienen el mismo cuello**: ads, chatbot,
  email. No se midió cuántas llegan por WhatsApp.

*08/10/2026 — sin subagentes para el arreglo; diagnóstico leyendo `mako_doer_conv`,
`anthropic_usage` y `plan_propuestas` de ws15.*

## Lo que quedó sin hacer en el núcleo

| Qué | Dónde | Por qué no se hizo |
|---|---|---|
| Idempotencia de las propuestas genéricas (ref que bloquee solo contra una pendiente) | `lib/api-mako/ejecutar.ts`, `lib/propuestas.ts` | La ref por contenido bloquea repetir una acción ya aplicada |
| Distinguir «vacío» de «ausente» en la pantalla genérica | `app/mako/revisar/[id]/acciones.ts`, `lib/api-mako/validar.ts` | Cambia el contrato de todas las acciones con opcionales |
| Título de `/mako/revisar` que siga al formulario; `object[]` como sub-formulario | `app/mako/revisar/[id]/RevisarAccion.tsx` | UI, no bloquea |
| `reclamada_at` y barrido de pendientes `confirmada` colgadas | `lib/mako-pendientes.ts` + migración | Necesita columna nueva |
| Actor fuera de `resultado` | `lib/api-mako/acciones.ts` | Las lecturas lo sanean mientras tanto |
| `historial_whatsapp` y `reuniones_lead` por `/api/agente/consultar` | `lib/agente-consultas.ts` | Decisión de producto: rompe skills instaladas |
| Tools viejas que devuelven el error en un 200 | `lib/mako-tools.ts`, `lib/mako-doer-acciones.ts` | Se resuelve al mudar los cuerpos (F4) |
| Que la bandeja deje confirmar a un no-admin lo que no lleva `rolMinimo` | `app/mako/ctx-bandeja.ts` | Por eso `editar_perfil` y `configurar_notificaciones_inapp` salieron del registro |
| Mover `listar_productos`/`guardar_producto` a negocio y `adjuntar_grabaciones_fathom` a crm | `lib/api-mako/areas/*` | Decisión de registro, sin urgencia |
| `/whatsapp?chat=` escrito por código | `lib/mako-doer-in.ts` | Falta resolver el jid contra el espejo en cada área |

## La API existe, pero los que más la usan todavía no pasan por ella (08/10/2026)

**Vive en:** `lib/api-mako/registro.ts` · `lib/mako-tools.ts` · `lib/mako-doer-acciones.ts` ·
`lib/mako-doer-in.ts` · `app/api/mako-doer/route.ts` · `app/api/agente/*` · `lib/flujos.ts`

Martín pidió «que MaKo tenga una API propia, con todas las acciones bien documentadas... como un
CRUD» para ahorrar tokens y para configurar acciones en el chatbot. **La API es esta**: 498
operaciones en 18 áreas (316 lecturas, 180 acciones, 2 controles), 379 por HTTP. El «~379» que
circulaba es sólo lo que sale por HTTP. Lo que se midió (corrida de 8 agentes, 4 lectores, un
diseñador y 3 refutadores, sobre HEAD):

⚠️ **Las 25 herramientas más usadas están declaradas DOS veces, y ya divergieron.** Las 12 de
`MAKO_TOOLS` y las 13 de `MAKO_ACCION_TOOLS` tienen gemela con el MISMO id en el registro (0
exclusivas). El doer de WhatsApp (las 25, siempre) y el chat de la app (las 12) mandan el ToolDef
VIEJO; HTTP y la skill, la def nueva. Las 25 descripciones difieren, y ya hay tres arreglos que
corrieron en una copia y no en la otra:

- el tope de salida de `metricas_negocio` (`if (ctx.canal !== 'http')` en metricas.run.ts) corre
  sólo por HTTP, donde no hace falta: WhatsApp y la app usan el cuerpo viejo;
- `proponer_tareas_plan` vieja declara `eliminar` («el dueño confirma cada baja») y
  `/plan/revisar` ya no tiene paso de bajas;
- `listar_campanas_meta` rotula el gasto como MXN: el ws13 cobra en USD (ver más abajo).

19 son una envoltura del cuerpo viejo; 6 tienen dos cuerpos (`metricas_negocio`,
`analisis_negocio`, `listar_pendientes`, `confirmar_accion`, `cancelar_accion`, `proponer_lead`).
**Y «proponer alta de lead» tiene TRES cuerpos**: la tool vieja, `crm.run.ts` y
`/api/agente/lead`.

⚠️ **La def del registro de `proponer_tareas_plan` no sostiene capturar** (refutado al plan que
quería mudar las 25 de una): no declara `recurrente` —`validarInput` copia sólo lo declarado, así
que una tarea recurrente saldría única—, pierde `MOLDE_DETALLE` y `MOLDE_PROYECTO`, y manda a usar
`listar_tareas_plan`, que capturar no ve (la guarda de fantasmas corta al segundo rechazo). Antes
de mudar el despacho de las 25 hay que arreglar esa def. Y pasar por el registro mete el gating
de `visible()`: con la capa `pm` (ws5) 17 de las 25 dejarían de existir.

**`/api/agente/*` duplica 6 de 9 rutas** (consultar = 10 lecturas, contexto, metricas, plan GET
—un TERCER cuerpo de «ver el plan»—, plan POST todavía con `eliminar`, lead POST). La skill
instalada nombra `/api/agente/` 20 veces contra 7 `/api/v1`. Uso medido: 0 filas en
`api_llamadas`; 3 tokens (ws1, ws9, ws11), los tres `proponer`.

**Ninguna automatización pasa por el registro.** `ejecutarOperacion` lo llaman sólo el doer, el
chat, `/api/v1` y la bandeja. El CRM automático, la nutrición, los desenlaces, los flujos de
avisos, la página de gracias y el curso al ganar escriben directo. La base para un canal `flujo`
ya está —168 de las 180 acciones separan `preparar` de `ejecutar`—; falta el canal, poner el lead
del evento en los parámetros, una llave contra la ejecución doble y el panel. La tensión «el canal
propone» ya se resolvió de cuatro formas en el código (propone · aplica y deja deshacer · actúa
porque alguien prendió el interruptor · borrador de un clic) y el registro conoce una sola.

**Los huecos que un flujo necesita** (mapeo a mano sobre crm, chatbot, plan, ads y equipo: 175
cambios de pantalla, 81 con gemela, 33 afuera con motivo escrito, 61 huecos): ninguna operación
conoce `lead_funnel` (un lead en varios productos, mig 0207) ni inscribe a UN lead en una
secuencia, y Customer Success tiene ~31-34 escrituras sin operación (el curso y los movimientos de
la entrega; el refutador corrigió el «37 contra 1»: guardar datos del cliente, servicios y alta ya
tienen gemela en crm y negocio). La lista de exclusiones de `crm.def.ts:15-25` quedó vieja: dice
que reagendar e importar no están, y ya existen `proponer_mover_reunion` y `proponer_leads`.

⚠️ **El registro no está declarado en ningún área de `/admin/dev`**: `grep lib/api-mako` en
`app/admin/dev/areas.ts` sólo encuentra los tres archivos de cs. Su historial no lo ve nadie.

**SIN HACER** (el plan, en `docs/api-mako-diseno.md` § 10):
- La def de `proponer_tareas_plan` (`lib/api-mako/areas/plan.def.ts`) con `recurrente` y los
  moldes, y después el despacho de las 25 por el registro (`lib/mako-doer-in.ts`).
- ~~El canal `flujo`~~ y ~~`lead_funnel` e inscribir un lead en una secuencia~~: HECHOS el mismo
  día, sin canal nuevo (ver abajo, «El canal de los flujos»).
- Declarar `lib/api-mako/` en un área de `app/admin/dev/areas.ts`.

*08/10/2026, cuenta 2. Corrida `wf_88a97c1e-c89`.*

## ⚠️ Un token con nombre (hoy: detallado) vale SOLO para /api/v1: la ruta de la skill entrega el principal (08/10/2026)

> A la tarde del mismo día los «tokens con nombre» pasaron a ser los **detallados** de GitHub
> (`mako_pat_`, permisos por área, vencimiento): ver la entrada siguiente. La frontera de abajo
> sigue igual, con `resolverTokenApi` en el lugar de `wsPorTokenApi`.

**Vive en:** `lib/api-mako/tokens.ts` · `lib/api-mako/tokens-lista.ts` · `lib/api-mako/tokens-uso.ts` ·
`lib/api-mako/http.ts` · `lib/agente-token.ts` · `app/api/agente/skill/route.ts` · `app/api-mako/`

Martín decidió (08/10) **varios tokens, con nombre**: hasta acá había UNO por workspace
(`agente_token`) y rotarlo lo reemplazaba, así que darle a un n8n un token de solo lectura le
apagaba las propuestas a la skill de Claude. La tab `/api-mako` los crea y los revoca de a uno.

**El diagnóstico obvio era el equivocado:** «que el resolvedor de siempre (`wsPorAgenteToken`)
acepte también los nuevos, y valen en todas las rutas». Dos cosas lo hacían un agujero:

1. `/api/agente/skill` arma el archivo de la skill con `(await getAgenteToken(ws)) ?? token`:
   **siempre el PRINCIPAL**, no el que pidió. Con cualquier token válido del workspace se bajaba
   la skill con el principal adentro — un token «Solo leer» se llevaba el de la skill, que
   propone (o ejecuta).
2. `/hook` y `/telemetria` son el reporte del plugin, y su consentimiento está atado al
   principal: `/api/agente/token` no acuña sin el trato aceptado. Un token con nombre abría esa
   puerta sin trato.

**La regla:** los tokens con nombre resuelven en `wsPorTokenApi` (el resolvedor de `/api/v1`,
que si no es uno de ellos cae al principal); `/api/agente/*` sigue con `wsPorAgenteToken`, que no
los conoce. `tests/api-mako-tokens.test.ts` lo fija leyendo el FUENTE (probado rompiéndolo:
cambiar el resolvedor de `http.ts` y meter el módulo en `/api/agente/skill` hacen fallar 2 de 10).

Lo demás que no se ve desde la pantalla:

- **El índice token → workspace es append-only** (`webhook_routing`, servicio `api_token`, por
  hash): revocar NO borra la fila. Lo que decide si un token vale es la LISTA del workspace
  (setting `api_tokens`), igual que el setting en el principal — y se lee con
  `getSettingEstricto`, porque con `getSetting` la base caída da «revocado» sobre uno vigente.
- **Del token nuevo se guarda el hash**, nunca el valor: se muestra una vez. El principal sigue
  en claro (setting e índice) porque la skill y el tutorial de Integraciones lo releen.
- **`api_llamadas` no sabe QUÉ token pidió.** El «último uso» de cada token se anota al
  autenticar (`tokens-uso.ts`), con freno de 10 min por token e instancia, y en un setting
  APARTE de la lista (`api_tokens_uso`): una escritura de uso contra la lista, leída antes de
  una revocación, podía revivir el token recién revocado.
- **El catálogo entero son ~360 mil caracteres (~90k tokens)**, y la skill enseñaba a pedirlo
  entero «SIEMPRE» antes de empezar. `GET /api/v1` suma tres filtros aditivos —`?compacto=1`
  (~23 mil), `?area=` y `?operacion=<id>`— y la skill pasó a enseñar «el índice, y después el
  detalle de la que vas a usar».
- **La pantalla no importa el registro**: el índice se arma en el server (`app/api-mako/datos.ts`)
  y el detalle de una operación se pide al abrirla. «Probar» corre sólo lecturas que salen por
  HTTP y no gastan (`gratis` o `externo`), con el mismo canal y gating que un token `lectura`, y
  no deja fila en `api_llamadas` (esa bitácora contesta qué pidió un TOKEN).

### Lo que quedó sin hacer

- **`/api/agente/plan` y `/lead` (POST) no miran el alcance.** Un principal acuñado como
  `lectura` (sólo se puede por `POST /api/agente/token`, la pantalla no lo ofrece) igual deja
  propuestas por ahí. No se tocó por la decisión D de Martín (`/api/agente` se mantiene tal
  cual): son dos líneas en `app/api/agente/plan/route.ts` y `app/api/agente/lead/route.ts`.
- **`plugin/` se regeneró y no se publicó.** El repo público (`mbustos-digital/mako-plugin`) se
  publica a mano (`docs/hallazgos-infra.md`): hasta entonces, quien instaló el plugin sigue
  pidiendo el catálogo entero. La skill que sirve `/api/agente/skill` ya sale con lo nuevo.
- ~~**Qué token pidió cada llamada**~~ — hecho a la tarde: `api_llamadas.token_id`
  (migración 0222, aplicada el 08/10).

*08/10/2026, cuenta 2, sin subagentes. Commit `f2c0a04b`.*

---

## La API copiada de GitHub: tokens detallados que escriben, permisos por área, rutas REST y su pantalla (08/10/2026)

**Vive en:** `lib/api-mako/permisos.ts` · `lib/api-mako/tokens*.ts` · `lib/api-mako/http.ts` ·
`lib/api-mako/rutas-http.ts` · `lib/api-mako/rest.ts` · `lib/api-mako/recursos.ts` ·
`lib/api-mako/ejemplos.ts` · `lib/api-mako/openapi.ts` · `lib/api-mako/version.ts` ·
`lib/api-mako/registro.ts` (`gatingOk`) · `lib/api-mako/flujo.ts` (`aplicarEnElActo`) ·
`app/api/v1/**` · `app/api-mako/` · `tests/api-mako-rest.test.ts`

Pedido de Martín: «Me gusta como hace la API GitHub, con su diseño, permisos, presentación,
etc… Copialo todo, tal cual». Decidió: escribe directo (lo que gasta plata sigue en una
pantalla), permisos por área con vencimiento, URLs REST como alias (las viejas no cambian) y
que se vea igual a GitHub. El relevo de cómo lo hace GitHub (8 agentes, `wf_62c177ea-a1d`) y el
diseño de las 379 rutas (`wf_f551abb8-91f`) quedaron en el transcript; lo que importa está acá.

**Los permisos van en `gatingOk`, y el diagnóstico obvio era el equivocado.** Lo natural era
filtrar en la ruta o en `visible()`. Pero `gatingOk` es TAMBIÉN la guarda que corre al
confirmar una pendiente (`acciones.ts`): con el filtro en otro lado, un token con escritura sólo
en «mako» confirmaba (por `confirmar_accion`) pendientes del CRM o de Ads. `Ctx.permisos` →
`vistaDe` → `Vista.permisos` → `gatingOk`. `{}` es «nada», no «sin filtro»: el test lo fija.

**Escribir directo NO es un segundo camino de escritura.** `correr()` en `rutas-http.ts` es el
único lugar que decide: lectura → `ejecutarOperacion`; acción con el clásico o con
`costo: 'dinero'` → propone (202); acción con un detallado → valida ANTES (para devolver el 400
con `faltan`, que `aplicarEnElActo` resume en una frase) y llama a `aplicarEnElActo`, el mismo
camino con que confirma un flujo. Probado contra la base el 08/10 con
`PUT/DELETE /crm/leads/2472/faltantes/silencio` en el ws 9: 200 `hecho` las dos, y el lead
quedó como estaba (`pendientes_ignorados` null).

**Lo idempotente de GitHub choca con los runners.** El segundo `PUT` de lo mismo devolvió 422
(«ya están ignorados desde…»): el runner rechaza sin `yaEstaba`. En GitHub ese `PUT` es un
éxito. Con `yaEstaba: true` en `preparar()`, `aplicarEnElActo` lo contesta como éxito sin
cambios y la API devuelve 200 `sinCambios`. Hoy lo marcan 6 runners (`grep yaEstaba`).

**403 o 404, como GitHub.** Si lo ÚNICO que falta es el permiso del área de un detallado: 403
«Recurso no accesible con un token de acceso personal detallado» y `X-Accepted-MaKo-Permissions`
con lo que falta (`crm=write`). Si es la capa, el rol, el canal o el alcance del clásico: 404, sin
confirmar que existe. Un verbo equivocado en una ruta REST también es 404 (GitHub tampoco dice
qué existe); en la ruta vieja sigue el 405 con `Allow`.

**Un token nunca administra tokens** (regla de GitHub que trajo el relevo): ninguna operación
del registro acuña, edita ni revoca credenciales; `ver_estado_agente_claude` sólo LEE si existe
el clásico. `tests/api-mako-rest.test.ts` lo frena.

**Las rutas REST son una TABLA al costado del registro**, no una segunda declaración: una fila
por operación HTTP, y el test falla si una op nueva no tiene la suya, si un parámetro de ruta no
es de la op, si una ruta se repite o si una de dos tramos pisa una operación (el router viejo
gana con `/{area}/{operacion}`). Un parámetro de ruta puede ser OPCIONAL en la op
(`cancelar_accion` sin `id` cancela la última): la ruta lo trae siempre. El router prefiere lo
literal a un parámetro (`/plan/proyectos/vacios` antes que `/plan/proyectos/{proyectoId}`).
Probado rompiéndolo: sin la fila de `agregar_nota_lead`, fallan 2; con `{lead}`, falla 1.

**La pantalla: dos trampas de Next que costaron una corrida cada una.**

1. **El estado de un componente cliente NO sobrevive a cambiar `?v=` en la misma página.** El
   token recién creado se perdía: los searchParams son parte de la clave del segmento de la
   página, así que ir de `?tab=tokens&v=nuevo` a `?tab=tokens` MONTA DE NUEVO el componente. Y
   `router.push` + `router.refresh()` juntos lo montaban dos veces. El token vive entre la acción
   y la lista en una variable de MÓDULO (memoria de la pestaña, se pierde al recargar, como en
   GitHub), y se navega con `push` a otra vista o con `refresh` a la misma, nunca las dos.
2. **Una función de un módulo `'use client'` no se puede LLAMAR desde el server**:
   «Attempted to call esArticulo() from the server». Lo que `page.tsx` necesita para leer la
   URL (los artículos, sus slugs) vive en `app/api-mako/articulos-meta.ts`, sin `'use client'`.

**Lo que «tal cual» quiso decir en el aspecto:** los valores de Primer (colores, tipografía,
`Box`, `Label`, `Counter`, `UnderlineNav` con su línea coral, `Flash`, `Subhead`, el `Dialog`),
los Octicons (MIT) y el modo oscuro de Primer bajo `data-tema="oscuro"`, todo limitado a `.gh`.
El badge del verbo es del MISMO azul para todos los verbos (GitHub no pinta un color por verbo).
El reset global de MaKo saca las viñetas: dentro de `.gh` vuelven en las listas sin clase.

**Datos de prueba que quedaron:** ~33 filas de `api_llamadas` en el ws 9 (las del e2e de la
mañana y de la tarde) y dos líneas de historial en el lead 2472 del ws 9 (ignorar y reactivar).
Los tokens de prueba se eliminaron.

### Lo que quedó sin hacer

- ~~**Un token no se apaga cuando su creador pierde el acceso.**~~ **Cerrado el 14/10/2026**:
  `resolverTokenApi` revisa a `creadoPor` (`creadorConAcceso`, `lib/api-mako/tokens-creador.ts`,
  puro y con test): activo y no suspendido, y admin global, admin del MISMO negocio o admin de una
  agencia con el negocio aprobado en su cartera. Las lecturas son ESTRICTAS a propósito: con la
  base caída tiran (503), porque apagar todos los tokens de la plataforma por un bache de Supabase
  es peor que dejarlos un minuto más. Un token viejo sin `creadoPor` sigue valiendo. El 401 dice
  dónde se arregla (`mensajeSinCreador`).
- **Sin «modo sudo»**: GitHub pide reautenticarse para generar o regenerar tokens; acá alcanza
  la sesión del admin (`app/api-mako/actions.ts`).
- **Las descripciones dicen «PROPONE… queda pendiente hasta el sí»**, que con un detallado es
  falso: las comparte el doer, que sí propone. La documentación lo aclara en cada endpoint
  («Con Lectura y escritura, el token detallado lo hace en el acto»), pero el texto de la def
  sigue igual (`lib/api-mako/areas/*.def.ts`).
- **Más runners con `yaEstaba`** para que los `PUT` repetidos sean 200 y no 422
  (`lib/api-mako/areas/*.run.ts`, ver arriba).
- **`documentation_url` apunta a una pantalla con login** (`/api-mako?tab=docs…`): GitHub apunta
  a docs públicas. El integrador de un cliente sin cuenta en MaKo no la abre (`docsUrl` en
  `lib/api-mako/http.ts`).
- **Lo que GitHub tiene y acá no:** webhooks salientes (avisar cuando una pendiente se confirma
  o vence, en vez de consultar en bucle), OAuth para integraciones de terceros, el receptor del
  Secret scanning partner program (el prefijo `mako_pat_` ya es reconocible), paginación con
  el header `Link`, `Location` en los 202, zona horaria declarada (`Time-Zone`), y fechas de
  deprecación por operación en el OpenAPI.
- **La skill (`lib/agente-skill.ts`) y `plugin/` no enseñan las rutas REST** ni los detallados:
  siguen con la ruta por operación, que anda.

*08/10/2026, cuenta 2, con subagentes (relevo de GitHub y diseño de rutas).*

---


## El curso por la API: que un Claude migre un curso entero (08/10/2026)

**Vive en:** `lib/api-mako/areas/curso.def.ts` · `lib/api-mako/areas/curso.run.ts` ·
`lib/api-mako/areas/curso.helpers.ts` · `lib/api-mako/flujo.ts` (`ResultadoFlujo.datos`) ·
`lib/api-mako/rutas-http.ts` · `lib/api-mako/validar.ts` (`vaciaEsValor`) · `app/api-mako/Articulos.tsx`
(la guía) · `tests/api-mako-curso.test.ts`

Pedido de Martín, en el audio de feedback del curso (minuto ~05:30): quien probaba, con su curso en
Panda, preguntó «si esto lo puedo conectar por medio de API para que mi Claude lo pueda subir de forma
automática»; Martín: «No están las acciones dentro de curso, como agregar nueva clase… tengo que agregar
el tema de curso en la API», y «un pequeño tutorial de copia tu token de API, pásalo a Claude y dile que
te haga tal». Lo pasó el chat de Customer Success. Quedó un área nueva, `curso` (11 operaciones, SÓLO
por HTTP), y la guía «Migrar un curso con Claude» en la documentación de la tab API.

**Lo que no se ve desde el pedido:**

- **Una escritura que CREA algo no devolvía su id por la API.** `confirmarPendiente` sí devuelve
  `Ejecutado.datos`, pero `aplicarEnElActo` lo tiraba y la escritura directa contestaba sólo `resumen`.
  Quien crea una clase necesita su id para lo que sigue. Ahora viaja: `ResultadoFlujo.datos` → la
  respuesta 200 lleva `datos` (y el OpenAPI lo describe). Una operación nueva que crea algo devuelve su
  id en `datos`.
- **La tab crea una clase AL PRINCIPIO de su módulo** (`crearClase`, a propósito: la abre para editarla).
  Una migración crea en orden, así que quedaba al revés. `crear_clase_curso` la lleva al final con
  `moverClaseA(id, modulo, null)`, que con el módulo ya numerado escribe UNA fila.
- **Crear una clase son tres escrituras**: crear, llevarla al final y UNA con todo lo demás por
  `guardarLeccion` (lib/curso-admin.ts), el mismo camino del «Guardar» del editor, con compare-and-set
  (la base sale de `borradorDe`, la misma función de la pantalla; si otra persona la cambió en el medio,
  se relee y se reintenta una vez). Todo se valida en `preparar()`; si la escritura falla después de
  crear, la clase va a la papelera, para que un reintento no deje dos «Nueva clase». ⚠️ `guardarLeccion`
  acepta los minutos SÓLO junto con un video nuevo: los minutos solos van por `guardarCampoClase`.
- **`crearModulo` entiende `despuesDe: null` como «al principio»** y crea VINCULADO por default (una
  columna más en el kanban de clientes). Por la API, sin `despuesDe` va al final, y nace SUELTO salvo que
  se pida.
- **Un producto sin entrega guardada ya tiene CINCO módulos**: las etapas de fábrica del kanban
  (onboarding, arranque, hito 1, hito 2, entregado), todas vinculadas. Por eso `ordenar_modulos_curso`
  pide la lista ENTERA de claves, y la guía le dice a Claude que lea el curso antes.
- **No hay una pantalla de papelera**: lo borrado vuelve sólo con el «Deshacer» de 5 segundos de la tab.
  La primera versión de la descripción de `borrar_clase_curso` prometía «se recupera desde la papelera
  del curso en MaKo», que no existe. Por la API vuelve con `restaurar_clase_curso` (7 días, los de la
  purga; el test los compara con `DIAS_PAPELERA`).
- **Lo que NO se expone, a propósito**: vincular o borrar un módulo y mover clientes de etapa. Mueven
  clientes en el kanban, y en el ws1 eso manda WhatsApp. El test lo frena por nombre de función.
- **Lo que se crea se ve enseguida**: un módulo suelto nace `abierto` (`lib/curso-bloqueo.ts`). La guía lo
  avisa.

**La tarea y el video por código (la misma tarde, sobre el modelo nuevo de Customer Success, `dbae4da9`):**

- **`tareas` REEMPLAZA todas las tareas, y los ids de los campos se CONSERVAN.** Las respuestas de los
  alumnos cuelgan del `id` de cada campo: reescribir la tarea con ids nuevos las deja sin pregunta, sin
  un error. `modeloDeTareas` (curso.helpers.ts) mantiene el `id` que llega, y sin `id` reusa el del campo
  que ya tenía la misma pregunta y el mismo tipo. `ver_clase_curso` devuelve las tareas en la MISMA forma
  que se mandan, para editar de ida y vuelta.
- ⚠️ **El validador de la API TIRABA toda lista vacía, obligatoria o no** («una lista que no vino»), así
  que `tareas: []` contestaba «No pasaste nada para cambiar» y no había forma de sacar la tarea. Lo cazó
  la prueba de punta a punta, no los tests: los del helper le pasaban la lista directo. Ahora un
  parámetro declara `vaciaEsValor` y ahí `[]` es «vaciar»; sin la marca se sigue descartando, que es lo
  correcto para un filtro. **Toda lista que REEMPLAZA algo entero la lleva.**
- **La tarea principal es la primera y no lleva título; las demás son `seccion` del modelo.** Una
  `seccion` no se pide como campo (queda afuera de los tipos de la API, con `quiz`, `publicar` y
  `comentar`, que se arman en MaKo). Lo incompleto se rechaza con el motivo de `erroresDeCampos`, el mismo
  que pinta el editor; nunca se descarta.
- **El video acepta el `<iframe>` entero** (`videoDeLink` → lib/embeds.ts). El `src` que se guarda lo
  arma lib/embeds.ts desde el id: el `autoplay=1` del código de Panda no viaja (medido). El link del
  PANEL de Panda (`dashboard.pandavideo.com.br/…`) no es un video: contesta con `porQueNoSeInserta`, la
  misma frase del editor («De Panda Video, pega su código para insertar»).
- ⚠️ **Este archivo no puede leer `.campos` de nada**: `tests/curso-tareas-secciones.test.ts` barre todo
  lector de `.campos` en los archivos que importan lib/curso (una `seccion` no es un campo que se
  conteste). Los campos se toman por desestructuración.

**Probado contra la base el 08/10** en el ws 9, con un producto de prueba creado y borrado por la misma API.
Se probó todo esto: tres clases creadas en orden, video inválido (422 sin crear nada), editar con HTML
saneado (el `<script>` no quedó), mover, reordenar (incompleto 422; completo 200; igual 200 `sinCambios`),
renombrar, borrar dos veces (200 y 200 `sinCambios`), restaurar, y un token sin «Curso» (403). Al borrar
el producto, su curso cayó en cascada.

⚠️ **El Cliente de Prueba (ws 3) no sirve para probar una tab**: con el onboarding pendiente, cualquier
pantalla rebota a `/onboarding`. El e2e corrió en el ws 9.

### Lo que quedó sin hacer

- **La tarea y el video por código embed** (el de Panda): el chat de Customer Success está cambiando ese
  modelo en `lib/curso.ts` y `lib/curso-admin.ts`, y avisa con las firmas nuevas. Hasta entonces, un link
  de una página de Panda se guarda pero no se reproduce, y la guía lo dice.
- **Sin idempotencia por clave externa**: si un pedido se corta, el reintento puede duplicar una clase. La
  guía le pide a Claude que mire el curso antes de reintentar. Una columna `ref` en `curso_clases` lo
  cerraría.
- **Los módulos no se pueden crear cerrados** por la API: el candado (`guardarBloqueo`) no está expuesto.
  Para cargar un curso sin que los alumnos lo vean a medias, hoy hay que crearlo en módulos nuevos.

*08/10/2026, cuenta 2, sin subagentes.*

## El canal de los flujos: un paso corre cualquier acción, por el mismo choke point (08/10/2026)

**Vive en:** `lib/api-mako/flujo.ts` · `lib/api-mako/flujo-params.ts` · `lib/api-mako/canal.ts` ·
`lib/api-mako/ejecutar.ts` · `lib/api-mako/tipos.ts` (`yaEstaba`) · `app/api/flujos/acciones/route.ts` ·
`app/_components/EditorAccionMako.tsx` · `lib/mako-doer-acciones.ts` (el origen de las heredadas)

Martín contestó las cinco decisiones del § 10 de `api-mako-diseno.md` («Que pueda hacer todo, sin
limitaciones» · «La ofrece» · «No, no renombres» · «Mantenla, no cambies nada» · «No, no lo
escondas»). La A es la que cambia el registro: un paso «⚡ Acción» corre CUALQUIER acción sin pedir
un «sí». Lo que costó:

⚠️ **El diagnóstico obvio era el equivocado: «sumar `flujo` a CANALES».** `canales` es una lista
EN POSITIVO en cada una de las 498 operaciones: un canal nuevo obligaba a declararlo en todas, y
la decisión fue que todas valen. Va con el canal `app` y una clave de scope con prefijo
(`app:flujo:<origen>`, `PREFIJO_FLUJO`): de ahí salen el origen de la fila y la etiqueta «vino de
una automatización». CANALES no cambió.

⚠️ **Confirmar corre el `ejecutar()` de la acción SIN contexto de workspace.** `ejecutarOperacion`
fija el workspace para proponer, pero `confirmarPendiente` no: medido en la prueba del ws3, la nota
salía y el historial tiraba «`cookies` was called outside a request scope» (`logLeadEvent` →
`getTenantDb` cae a las cookies). Un cron que itera clientes no tiene cookies. El ejecutor envuelve
todo en `runWithWorkspace(ws)` (`63a0f95a`).

**Cada forma de acción se confirma por SU camino**, no por uno nuevo: la pendiente
(`confirmarPendiente`), la pantalla genérica (`aplicarPropuestaGenerica`) y las 7 de pantalla
propia —el borrador del plan (`aplicarPropuesta`), el alta de leads (`createLead` con su chequeo de
duplicados) y el WhatsApp de empresa (`enviarBorrador`)—. Las 5 heredadas (`proponerLegado`) dejan
la pendiente con origen «hola-mako» fijo: ahora, con la clave `app:flujo:`, llevan el flujo.

⚠️ **«Ya está así» no es un fallo para un flujo.** Muchos `preparar()` del registro rechazan lo que
ya es el estado actual («ya está en ese producto», «ya está marcado como calificado»): correcto para
una persona, y para un flujo una alarma al dueño en cada evento repetido. `Preparado` gana
`yaEstaba`, `ejecutarOperacion` lo propaga y el ejecutor lo cuenta como éxito. Hoy lo marcan las
operaciones de producto, la inscripción en curso, la asistencia y el calificado; el resto de los
«ya está» del registro todavía no.

**Las operaciones que faltaban** (las pedía el relevo de arriba): `inscribir_lead_secuencia`
(chatbot; la decisión y la escritura son UNA función, `inscribirEnSecuencia`, y antes de inscribir
contesta lo que el motor cerraría sin mandar —secuencia pausada, sin reunión futura, fuera del
tope—), y `agregar_lead_a_producto` / `quitar_lead_de_producto` / `mover_lead_en_producto` +
la lectura `productos_del_lead` (crm, sobre `lib/lead-funnel.ts` sin cambios). Ninguna sale por HTTP.

⚠️ **El id de un producto del CRM es el del EMBUDO, no el de la tabla `productos`.** Del producto al
embudo hay dos saltos: un id del otro catálogo movería al lead en el producto equivocado sin error.
El parámetro se llama `embudoId` y su descripción lo dice.

⚠️ **`listarFunnels` devuelve `[]` cuando la lectura falla**, y como todo negocio tiene al menos un
embudo, vacío significa «no pude leer»: `productosCrm` lo trata así.

⚠️ **Lo que cazó la revisión adversarial** (`wf_d229086b-56f`: 20 confirmados, 3 refutados), y que
vale para cualquier operación nueva:

- **Un id sacado de un link con `split('/').pop()` se lleva la query.** `proponer_tareas_plan` y
  `proponer_lead` sacaban el id del link que arma la tool vieja con `linkApp(…, wsEnContexto())`;
  adentro de `ejecutarOperacion` el contexto tiene workspace, así que el link trae `?ws=N` y el id
  quedaba `prop…?ws=3`. Desde un flujo, `aplicarPropuesta` no encontraba nada en CADA corrida. Va
  `split(/[?#]/)[0]` antes de partir por `/`. La versión de fondo es que la tool devuelva el id.
- **Un `leadId` OPCIONAL vacío es «ninguno», no «el del evento».** `paramsDelPaso` le inyectaba el
  lead del evento a toda operación que declarara `leadId`: un «Proponer un WhatsApp» a un teléfono
  fijo recibía además el lead, y la operación contestaba «el teléfono no coincide» siempre. Ahora
  se inyecta sólo si es obligatorio o si el paso lo pidió con `LEAD_DEL_EVENTO`; y «Otro lead» sin
  id se guarda como `LEAD_A_ELEGIR` y no viaja (antes era un `''` que se borraba y caía al evento).
- **Un borrador de pantalla propia se aplica ENTERO**: `proponer_cierre_tareas` necesita sus
  `cerrarIds` (sin ellos, «no hay nada para crear, cerrar ni borrar»), y el alta de leads reclama la
  propuesta ANTES de crear (dos corridas con el mismo id, por el `ref`, creaban dos veces).
- Lo obligatorio que le falta a un paso lo dice UNA función pura (`faltanEnPaso`), que usan el
  motor de avisos (no corre el paso) y el saneo de las secuencias (no lo guarda).

**SIN HACER:**
- La reentrega de Cal.com y Calendly ya no repite los pasos (`dedupKey`, ver
  `hallazgos-comunicacion.md`); Fathom y Meta también reintentan y sus `dispararEvento` todavía no
  llevan clave. Chatwoot no reintenta.
- El editor (`EditorAccionMako.tsx`) pide `secuenciaId`, `embudoId` y la key de una etapa como
  números o texto sueltos: falta un selector alimentado por `listar_secuencias_nutricion` y
  `productos_del_lead`.
- ~~No hay operación para SACAR a un lead de una secuencia~~: hecho el 17/10/2026 (`sacar_lead_de_secuencia`; queda
  CANCELADA y no se vuelve a abrir, ver «Pendientes B1 de la API» más abajo).
- Mover a un lead en su producto PRINCIPAL desde `mover_lead_en_producto` se niega y deriva a
  `proponer_cambio_etapa`: unificarlo obliga a decidir qué hace el paso con el monto o el motivo.
- Por chat no se puede CREAR un paso de acción (`editar_pasos_secuencia_mensajes` exige canal y
  cuerpo para un paso nuevo); se crea en el lienzo.

*08/10/2026, cuenta 2. Corrida `wf_48a7d912-9a9` (tres agentes en worktrees) y revisión
`wf_d229086b-56f`; commits `fafe007b`, `6d4703ec`, `63a0f95a`, `40d8f052`, `b2a6db9d`, `395c4c11`.*

## Pendientes B1 de la API (17/10/2026): un pago en pesos, sacar de una secuencia, los productos de una landing y lo que ya estaba

Pedido de Martín del 17/10 («implemente todos los pendientes al 100%»). Cada uno con el diagnóstico que NO era, porque
tres de los cuatro tenían una segunda causa escondida detrás de la obvia.

**«Un pago en pesos por WhatsApp entra como dólares».** El diagnóstico obvio era «a `marcar_pago_cobrado` y
`registrar_pago_suelto` les falta la moneda» (cobrarCuota y registrarPagoSuelto ya la recibían desde el 14/10). Era la mitad.
- **La otra mitad: ni siquiera llegaban al turno.** Medido con tsx contra `herramientasDelTurno` (el turno que CORRE):
  «Juan me pagó 500 mil pesos», «ya me pagó la cuota 2» y «registrá un pago de 500 mil pesos de Juan» salían `capturar`,
  dudosas, con DOS herramientas. MaKo no tenía con qué registrar un pago; el que sí llegaba (`marcá la cuota 2 … como cobrada`)
  quedaba sin `registrar_pago_suelto` por el presupuesto de 12.000 caracteres. Ahora `esPedidoDeCobro` (lib/mako-intencion.ts)
  conoce el tipo `pago` (un hecho —pagó, transfirió, depositó— más lo que se pagó, o el pedido de registrarlo) y el tipo
  `cuota` («cambiale el vencimiento a la cuota 3», «mandale el link de la cuota 2»), con las áreas `crm` y `cobros`.
  Regla: **una operación nueva se prueba por el turno que corre, no sólo por su definición**; una def perfecta que el
  clasificador no trae al turno no existe para MaKo.
- **La regla (pura, con test):** `cobroManualDeEntrada` (lib/pagos-campo.ts). Sin moneda el monto es en dólares (como la
  ficha); un `montoOriginal` SIN `moneda` se RECHAZA (antes los pesos de `montoUsd` entraban como dólares sin error); con otra
  moneda los dólares los declara la persona (nunca una tasa inventada), o son los de la cuota que se salda.
- **Y el resumen que se confirma lo dice:** si no se dijo la moneda y la del negocio no es USD, el «sí» trae «Queda en
  dólares (USD) … la moneda del negocio es ARS: si se cobró en ARS, dímelo antes de confirmar» (`avisoMonedaPorOmision`).
- **Vive en:** `lib/api-mako/areas/crm.def.ts` y `crm.run.ts` (`paramsDeCobro`, los dos runners), `lib/pagos-campo.ts`,
  `lib/mako-intencion.ts` (`pago`, `cuota`). **Tests:** `tests/api-mako-pagos-moneda.test.ts` (ejecuta los runners de verdad contra
  una base de mentira con dos negocios: `tests/_api-pagos-hijo.ts`) y `tests/api-mako-pago-intencion.test.ts`.
- ⚠️ **Los falsos positivos que se cazaron al medir:** «mi socio me pagó la comida» entraba como pago porque «pagó» sin tilde
  normaliza a «pago», que era su propio objeto (el objeto se busca SIN el verbo); y «la cuota de IA» / «la cuota diaria de
  WhatsApp» no son una cuota de pago (`CUOTA_DE_USO`). `textoDelPago` de `app/crm/[id]/deal-actions.ts` es una copia de
  `textoDelCobro` (lib/pagos-campo.ts): no se tocó para no pisar al CRM; cuando se toque, que importe la de la lib.

**«MaKo no puede sacar a un lead de una secuencia».** `sacar_lead_de_secuencia` (chatbot, chat, sólo admin, SIN http como
`inscribir_lead_secuencia`). Lo no obvio:
- **Salir es CANCELAR, no completar.** Una inscripción `completada` la lee el evaluador del desenlace
  (lib/nutricion-desenlace.ts) y puede mover la etapa del lead por una secuencia que nunca terminó; `cancelada` no es un
  desenlace (es lo que escribe archivar una secuencia). El costo está dicho en la operación y en el resumen: **una cancelada
  no se vuelve a abrir** (ni con `inscribir_lead_secuencia` ni por la entrada automática: puede ser una baja), así que
  `reversible: false`.
- Sólo sale lo que puede mandar (en curso, `respondio`, `handoff`); lo terminado o ya cancelado es «ya está así»
  (`yaEstaba`: en un flujo, éxito sin alarma) y se conserva su historia; un estado desconocido NO se corta (en POSITIVO).
  Escribe con compare-and-set sobre el estado leído y deja `proximo_envio_at` en null (una fila cancelada con fecha miente).
- **Vive en:** `lib/nutricion-inscripcion-manual.ts` (`decidirSalidaDeSecuencia`, pura), `lib/nutricion-salida-manual.ts`
  (lectura y escritura con `getTenantDb`: el lead o la secuencia de otro negocio no existen), `chatbot.def/run.ts`.
  **Test:** `tests/api-mako-acciones-1710.test.ts` (hijo `tests/_api-acciones-hijo.ts`).

**«MaKo no puede asignar productos a una landing».** `guardar_landing` gana `productos` (los `embudoId`; `[]` los saca todos; sin
el parámetro quedan como están) y `listar_landings` trae `productosDisponibles`. ⚠️ **`undefined` es «no los toques» y `[]`
es «sácalos»**: sin `vaciaEsValor` el validador descarta la lista vacía y no hay forma de desasignar, y un runner que escribe
`funnelIds: productos ?? []` borra los productos al corregirle la URL (la trampa del mapper campo por campo,
lib/landing-config.ts). Se valida contra `productosAsignables()` (los activos de ESTE negocio, los mismos que ofrece el
paso 2 del Pixel): uno de otro negocio o archivado se rechaza antes de escribir. Queda afuera `gracias` (la página de
gracias), que la pantalla también asigna.

**Lo que se dio por faltante y se midió contra el registro (no contra los docs).**
- **Ya estaban:** crear desde una plantilla (`crear_automatizacion_desde_plantilla`) y el botón que cobra un producto
  (`cobrar_producto_landing`, `quitar_cobro_landing`, `configurar_boton_landing`). Los docs (`hallazgos-chatbot.md`,
  `hallazgos-editor-landing.md`) los daban por pendientes: son de la undécima tanda de Automations y de la tanda 6 del Landing
  Generator (`feb0a0dff`, 14/10). Regla: «no está en la API» se mide corriendo el registro, no leyendo un hallazgo viejo.
- **Faltaban de verdad y se hicieron:** `duplicar_automatizacion` (la MISMA `duplicarSecuencia` que «Duplicar», con la base
  del negocio; la copia nace PAUSADA), `copiar_dashboard` y `pegar_dashboard` (el código `MAKO-DASH-…`, las mismas reglas y
  tabla que `/api/graficos/copia`). Los tres SIN http. El código del dashboard NO pasa por el modelo: va por
  `paraLaPersona` y `datos`, nunca en el `resumen`.

**MaKo Analyst y la ficha.**
- **«Esconde el ingreso estimado de un ganado» no era un bug: es la regla de la ficha** (`ingresoNoAplica`, el estimado no es
  una venta; la nueva ficha lo oculta en un ganado y la tarjeta vieja `InfoPrincipalCard` todavía no). Lo que sí era un
  defecto es que el modelo leyera esa ausencia como «no tiene estimado»: ahora MaKo usa la MISMA función que la ficha y,
  cuando lo oculta, dice `ingreso_estimado_oculto` con el porqué.
- **«Puede cortar formularios de una ficha larga» era cierto y peor de lo que decía:** `recortar` corta TEXTO por el final y
  `formulario_meta` / `formulario_landing` van al final, así que lo primero que se perdía era lo que el lead contestó, y lo
  que quedaba era un JSON cortado a media palabra. `compactarFicha` (lib/mako-analyst-lead-reglas.ts) acorta las respuestas
  largas (y, si hace falta, deja menos filas diciendo cuántas se omitieron) hasta que entra, sigue siendo un JSON válido y
  avisa con `ficha_acortada`.

**La herramienta de prueba que sirvió (y su trampa).** Los hijos `tests/_api-pagos-hijo.ts` y `tests/_api-acciones-hijo.ts`
corren los runners REALES de la API (`--conditions=react-server`) contra `tests/_postgrest-de-mentira.ts` con dos negocios, y
miran lo que QUEDA ESCRITO. ⚠️ **Se importan por el registro** (`lib/api-mako/runners.ts`, `runnerDe(id)`): importar un
`.run.ts` suelto cae en `Cannot access 'RUNNERS' before initialization` (ciclo runners → chatbot.run → runners). Lo que el
PostgREST de mentira NO puede probar es una carrera de verdad: el compare-and-set de `sacarDeSecuencia` se fija porque el
runner decide de nuevo contra la base, no por una carrera simulada.

**Vive en:** ver cada bloque · **Tests:** `tests/api-mako-pagos-moneda.test.ts`, `tests/api-mako-pago-intencion.test.ts`,
`tests/api-mako-acciones-1710.test.ts`.

## La comunidad por la API de MaKo: de «a medias» a main, firmada por una persona (17/10/2026)

El área `comunidad` (41 operaciones: posts, comentarios, categorías, miembros y eventos) estaba implementada en
`wip/api-acciones-1410` desde el 14/10 con un bloqueante abierto y sin revisión de seguridad. Se trajo SÓLO esa (no las otras
áreas de la rama) porque entra entera y verde: el resto sigue a medias (`docs/relevo/api-mako.md`).

**El bloqueante era de diseño y se cerró así (decisión de Martín, 17/10).** 11 escrituras «firmadas» (publicar, comentar, likes,
votar, seguir, la campana, el perfil) salen con el nombre de una persona del equipo (`miembro` sólo acepta `u:N` / `l:N`, el
CHECK de la 0217): firma **la persona que confirma en la bandeja, o la que creó el token detallado; sin persona no se
publica**. El `Ctx` gana `persona` (el email de quien creó el token, sólo en el detallado y sólo si es un email); el clásico, un
paso de flujo y un `actor` que parece un email pero no viene de la bandeja NO firman. Además tiene que ser una cuenta no
suspendida DE ESTE negocio (o un admin de la plataforma); la de otro negocio no firma, ni siquiera siendo admin del suyo.
**Vive en:** `lib/api-mako/areas/comunidad.helpers.ts` (`personaDe`, `firmaDelEquipo`), `comunidad.run.ts` (`quienFirma`,
`firmaAlProponer`, `firmaAlEscribir`, `faltaFirma`), `lib/api-mako/http.ts` y `tokens.ts` (`persona`, `creadoPor`).

**Lo que encontró la revisión de seguridad (un lector sin mi contexto, sólo leyendo el código) y se arregló:**
- ⚠️ **Se firmaba con el nombre del admin un texto que la bandeja le mostraba cortado.** Comentar, responder, editar un
  comentario y el perfil eran `chat`: la bandeja muestra el resumen a 120 letras y cada valor del payload a 240, y un comentario
  admite 4.000. Un Claude clásico que lee textos de alumnos (inyección de instrucciones) podía proponer un link de phishing
  pasadas las 240 letras y el admin confirmaba el principio. Ahora las cuatro son `pantalla` (el formulario entero, como
  `publicar_post_comunidad`). Regla: **lo que se firma con el nombre de una persona y puede ser largo se confirma en una
  pantalla que lo muestra entero, nunca en un «sí» sobre un resumen recortado.**
- ⚠️ **Confirmar una escritura firmada sin persona QUEMABA la pendiente.** `confirmarPendiente` reclama antes de ejecutar y la
  falta de firma recién se veía en `ejecutar`: un «sí» por un token clásico con alcance `ejecutar` o por WhatsApp la dejaba en
  `error` para el admin que sí la podía confirmar en la bandeja (regla 3 de AGENTS.md: lo que se sabe sin escribir falla antes).
  `AccionRun` gana `faltaParaConfirmar`, que se pregunta ANTES de reclamar (y en la pantalla genérica, antes de marcarla aplicada).
- **Una lectura escribía:** `ver_avisos_comunidad` llamaba a `campanaComunidad`, que anota los avisos de los eventos próximos (un
  upsert en `comunidad_notificaciones`): un token «Solo lectura» escribía filas en la campana de su creador. La API lee con
  `{ sinEscribir: true }`; la pantalla sigue anotando al abrirla.
- **Los ids de lo irreversible se podían editar al revisar** (`borrar_post`, `borrar_comentario`, `sacar_alumno`, `borrar_categoria`,
  `borrar_evento`, `editar_evento`, y los de comentar/editar): cambiar el `leadId` en /mako/revisar baneaba a otro alumno bajo el
  título del primero. Llevan `fijoAlRevisar`. El barrido de `tests/revisar-fijo.test.ts` sólo cubre plata y envíos: una
  acción de pantalla que borra o banea con un id merece la misma marca.

**Lo que la revisión confirmó que está bien (para no volver a medirlo):** ningún runner toca un id de otro negocio antes de
comprobar que es de `ctx.ws` (las `comunidad_*` ya están en `TENANT_TABLES` y toda query lleva el workspace a mano); ningún
cliente HTTP fija `persona` ni `actor` por el body o la query (el Ctx se arma sólo en http.ts y `validarInput` descarta lo que la
def no declara); las lecturas no devuelven emails, teléfonos ni URLs firmadas de adjuntos; el HTML de posts y comentarios queda
como texto plano; el video sólo se reconoce en YouTube, Vimeo o Loom; el lugar de un evento sólo acepta http(s).

**Sin arreglar, a propósito o por costo:**
- Un admin de agencia con cartera (rol global `usuario`, `workspace_id` de la agencia) NO firma (`firmaDelEquipo` falla cerrado),
  aunque la tab sí lo deja. Es un recorte, no un agujero.
- `por`, `creado_por` y `actualizado_por` quedan con el nombre del creador del token: la fila no dice que vino de un script.
- `miembrosDeLaComunidad` y `likesDelProducto` leen todos los accesos y todos los likes en cada `ver_comunidad`, `ver_ranking`,
  `listar_miembros` y `buscar`: en una comunidad grande `/api/v1` corta a los 60 s. Sin medir.
- Los textos de los alumnos (posts, bios, motivos de baneo) vuelven crudos a un agente: ninguna lectura avisa que no es de
  fiar. Un token detallado ejecuta `sacar_alumno` sin pantalla.
- `listar_pendientes` / `ver_pendiente` (área `mako`) muestran los resúmenes de las pendientes de comunidad a un token sin
  permiso en `comunidad`: ya pasaba con las otras áreas.
- Los errores internos de la base (`invalid input syntax for type bigint`) salen en el 400 de un id fuera de rango (`1e21`): los ids
  no llevan `maximo` y esos textos no pasan por `esNuestro` (lib/api-mako/ejecutar.ts).
- Los comentarios de la cabecera de `comunidad.run.ts` y de `comunidad-datos.ts` dicen que las tablas `comunidad_*` no están en
  `TENANT_TABLES`; ya están (`lib/workspace.ts`). La seguridad no depende de eso (cada query lleva el workspace).

**Vive en:** `lib/api-mako/areas/comunidad.{def,helpers,run}.ts`, `lib/comunidad-{datos,calendario,campana}.ts`,
`lib/api-mako/{tipos,registro,runners,rest,recursos,acciones,http,tokens}.ts` · **Tests:** `tests/api-mako-comunidad-acciones.test.ts`
(el de la rama, portado), `tests/api-mako-comunidad-firma.test.ts` (corre el runner de verdad con dos negocios:
`tests/_api-comunidad-hijo.ts`), `tests/comunidad-permisos.test.ts`.

## Agenda por WhatsApp: los dos casos abiertos, cerrados — y cuatro formas de romperlo sin un error (09/10/2026)

**Vive en:** `lib/mako-intencion.ts` (`esPedidoAgenda`, la sección de mover, `DESTINO_TIEMPO`,
`preguntoReunionOTarea`) · `lib/doer-herramientas.ts` (`INSTRUCCION_MOVER_SIN_OBJETO`,
`SIN_FECHA_DE_TAREA`) · `lib/mako-doer-in.ts` · `tests/agenda-whatsapp.test.ts`

Decisión de Martín del 09/10 («terminalo todo») sobre los dos casos de la entrada de arriba:

1. **«movela al viernes» sin nada abierto** se leía como mover a un lead DE ETAPA (`MOVER_A` tomaba «al
   viernes» por una columna), sin `agenda_del_dia` ni nada del plan; «cambiala para el jueves» o
   «reprogramala para mañana» caían al default con dos herramientas. Ahora un pedido corto de mover a un
   día u hora SIN objeto nombrado lleva CRM y plan, mete en el presupuesto reagendar, leer el día y las
   tareas, y el turno pregunta UNA vez «¿La reunión o la tarea?». Con una propuesta de agenda abierta es
   la reunión y no se pregunta. La agenda sigue sin pasar por la IA.
2. **«Agendar reunión con…» dentro de una lista** sigue siendo material para el plan (cargar tareas no
   pregunta nada). ⚠️ La premisa «sola ya era una orden» era falsa: sola también caía al default. Ahora el
   infinitivo es orden de agenda sólo en UNA línea y con reunión y día u hora.

**Lo que midió la revisión con el turno real** (`clasificarIntencion` + `herramientasDelTurno`), y ninguno
da error — dan la herramienta equivocada:

- **«pasalo a agendado para el lunes» preguntaba «¿La reunión o la tarea?».** Era mover un lead a una
  ETAPA; bastaba un día en cualquier lado del mensaje. Y no hay lista de nombres de etapa que lo resuelva:
  las etapas son de cada negocio. El día tiene que ser el DESTINO del verbo («al», «para el», «del…»).
- **La respuesta («la tarea») se reconocía después de CUALQUIER pregunta de MaKo**, así que «la agenda de
  mañana?» dejaba de ser una consulta y llegaba como acción con herramientas que escriben. El doer le dice
  ahora al clasificador si MaKo hizo ESA pregunta (las dos palabras en la misma pregunta), y «no, la tarea»
  también cuenta.
- **«Buen día, movela al viernes» llegaba sin la pregunta**: `herramientasDelTurno` volvía a leer el texto
  con el preludio del CRM, que no pela «buen día». Ahora lo dice el veredicto (campo `mover`), que
  sobrevive al saludo. ⚠️ Es la misma familia que «un prefijo de saludo no es el mensaje» (AGENTS.md): dos
  lectores del mismo texto con dos peladores distintos.
- **Un audio dictado llega en UNA línea**: «Agendar reunión con Ana mañana a las 15, llamar a la
  inmobiliaria y subir las fotos» se volvía una orden de agenda. Con otro infinitivo después de una coma o
  un punto, vuelve a ser material.
- **Un `if (porId('cambiar_fecha_tarea_plan'))` en el test iba a romperlo al integrar** la rama
  `wip/api-acciones-0910`, donde esa acción existe y es SÓLO HTTP. O sea que por WhatsApp no hay con qué
  cambiarle la fecha a una tarea, y el modelo tenía a mano sólo `proponer_tareas_plan`, que CREA una. El
  turno se lo dice (`SIN_FECHA_DE_TAREA`) cuando esa herramienta no viaja, y el test mira `visible`.

**Lo que decide Martín:** si `cambiar_fecha_tarea_plan` sale también por WhatsApp. Hoy, a «movela al
viernes» → «la tarea», el turno le avisa al modelo que no tiene con qué cambiarle la fecha (para que no cree una tarea nueva); no se midió qué le contesta a la persona.

_09/10/2026 — agente en worktree + revisión adversarial (8 roturas, cada una con su fallo, y dos del
implementador re-hechas); `tests/agenda-whatsapp.test.ts` 16/16. Integrado por quien escribe esto._

## El área `cobros` (11/10/2026, la pasarela de pagos)

### Sumar el área a `AREA_KEYWORDS` no alcanzaba: el diagnóstico obvio era el equivocado

**Medido:** «mandale un link de pago a Ana», «reembolsale el pago a Carlos» y «creá un checkout de
Mercado Pago para Laura» salían `capturar` y DUDOSAS, y con una intención dudosa `herramientasDelTurno`
ni siquiera mira las áreas del texto. **Causa:** no había ninguna regla que reconociera un pedido de
cobro. **Regla:** la señal es el OBJETO (link de pago, checkout, reembolso, suscripción) más un verbo de
pedido, y las tres puertas (clasificador, router y `esCargaDePlan`) dicen lo mismo.
**Vive en:** `lib/mako-intencion.ts` (`esPedidoDeCobro`) · `lib/mako-router.ts` · `lib/mako-doer-in.ts`.

### «Cancelá» es una palabra de CONFIRMACIÓN

Con una pendiente abierta, «cancelá la suscripción de Pedro» se leía como «cancelá la pendiente». Todo
pedido por objeto se excluye de la regla 1 del clasificador. **Vive en:** `lib/mako-intencion.ts`.

### Las áreas del clasificador incluyen las de las lecturas PREVIAS

Sin `crm` en el turno, `crear_link_pago` llegaba sin `listar_productos` (de donde sale el `productoId`):
comprobado rompiéndolo. **Vive en:** `lib/mako-intencion.ts` (`AREAS_COBROS`).

### Mercado Pago no crea links por la API, a propósito

El catálogo está en USD y Mercado Pago cobra en la moneda de su cuenta: `preparar()` lo rechaza con un
mensaje claro en vez de dejar una pendiente que falla al confirmar. Y `crear_link_pago` no duplica: con
un link pendiente del mismo producto y pasarela devuelve `yaEstaba` y vuelve a pasar ESE link.
**Vive en:** `lib/api-mako/areas/cobros.run.ts`.

### Una fuente nueva de variables rompe dos tests que no la nombran

`tests/datos-mensaje.test.ts` (`porFuente`, un `Record<FuenteDato>`) y el prefijo `link_` de
`tests/variables-aviso.test.ts` se rompen con cualquier fuente o variable nueva (`{{link_pago}}`, fuente
`cobro`). **Vive en:** `lib/variables-aviso.ts`.

_11/10/2026 — `tests/api-mako-cobros.test.ts` (15, probado con 10 roturas)._

## El área Dashboard (11/10/2026, 22 operaciones en `metricas`)

### Lo que viene de un agente se valida ESTRICTO antes de sanear

El modelo del Dashboard corrige en silencio: `sanearGrafico` convierte una métrica o un tipo que no existe
en otra cosa sin error, y `sanearElemento` aceptaba como Video cualquier https. Por la API eso es un
gráfico distinto del que se pidió y un «ok». **Regla:** cada operación valida contra el catálogo vigente y
rechaza con la lista de lo disponible (`armarGrafico`, `armarElemento`, `armarControlHoja`); el saneo queda
para lo que ya está guardado. **Vive en:** `lib/api-mako/areas/dashboard.helpers.ts`.

### Para borrar un campo de texto se manda `-`

El validador tira el `''` como «no vino» (`lib/api-mako/validar.ts:83`), así que un vacío nunca llega al
runner y no hay forma de vaciar un subtítulo. Mismo agujero que `vaciaEsValor` para las listas.

### El tablero leído sin cookie miente

Fuera de una request (un flujo, un token), `leerTablero()` devolvía el tablero inicial como si no hubiera
nada guardado: `lib/settings.ts` cae a `OWNER_WS` cuando no hay workspace. La lectura de la API exige
workspace y tira si falta (`wsDeLaLectura`, `lib/graficos-tablero.ts`).

### El compare-and-set no compara el JSON

Un `.eq` sobre el valor del tablero rompe el largo de la URL de PostgREST. Va un hash del valor y el
compare-and-set sobre `updated_at` (`guardarTableroSi`). ⚠️ El autoguardado del editor todavía escribe sin
versión: dos escritores, gana el último (ver [hallazgos-graficos.md](hallazgos-graficos.md)).

### La persona se NOMBRA, y en un flujo es obligatoria

Un `Ctx` no trae persona (sólo ws, canal y rol): «el informe» de un flujo no existe sin nombrarlo. Sin
nombrar y con un solo informe guardado, ése; con varios, pide elegir; en un flujo, error. Closer y setter
no son persona de un informe. Por HTTP las etiquetas de personas salen como alias y el link de una
grabación de Fathom no sale (`urlParaCanal`). **Vive en:** `elegirPersona`, `etiquetaPersona`.

### Crear, borrar y restablecer no corren en una automatización

Se frenan en `preparar()` (`noEnFlujo`), no en `NO_EN_FLUJOS`: una hoja por cada lead que entra no es lo
que nadie quiso configurar.

### Tres trampas del registro que mordieron al sumar el área

- **El chequeo de `server-only` en las `.def.ts` sólo ve las registradas**: una def suelta que lo importe
  no rompe nada hasta que alguien la registra. El test ahora barre el DIRECTORIO (probado con un
  `zzrotura.def.ts`: la lista vieja daba verde).
- **La regex de runners del test** (`^\s{2}'?id'?:\s*\{`) prohíbe cualquier otra clave con dos espacios de
  sangría en un `.run.ts`.
- **«plantilla» suelta choca con WhatsApp** en `mako-intencion`: la regex exige «plantilla de hoja /
  dashboard / informe».

### Un type guard sobre `l.c` no angosta `l`

Para angostar una unión discriminada se pregunta por la FORMA del objeto (`!('desde' in l)`). Lo cazó el
typecheck, no los tests.

_11/10/2026 — `tests/api-mako-dashboard.test.ts` (25, probado con 14 roturas), commit `6e85d8d7`._

## El área Dashboard en la v5: lo que la API escribía y no hacía nada (12/10/2026)

- **El período que pedía la API no hacía nada.** Desde la v5 el período propio de un gráfico vive en un control
  `periodo` con `fijo: true`, y con un control así el saneo descarta el campo `periodo` sin avisar. La API lo
  escribe como control fijo `<id>-fecha` (`conPeriodoFijo`) y comprueba DESPUÉS del saneo que quedó
  (`armarGrafico`). Los nombres de los parámetros (`periodo`, `desde`, `hasta`) no cambiaron.
- **Todo gráfico que armaba MaKo con filtros salía con chips para mirar.** Lo que se guarda en un gráfico lo DEFINE
  (`fijo`); un filtro para mirar va en la hoja (`controlesDeFiltros`).
- **La referencia quedó vieja dentro del mismo WIP**: se editó el `escribe` de una def después de generarla y
  `api-mako-registro` lo cazó. Regenerar `docs/api-mako.md` es el ÚLTIMO paso después de tocar una `.def.ts`.
- **Las «Conclusiones de MaKo» salen por la API sólo las SUELTAS en la hoja** (`leer_conclusiones_dashboard`,
  `generar_conclusiones_dashboard`): miran gráficos sin nombres (`dimensionPublica`). Las de un pop-up leen lo que
  se abre (el transcript de una llamada) y no las alcanza ningún canal: viven en `popup.componentes`, así que
  buscar sólo en la hoja ya las deja afuera. `tests/graficos-ia-elemento.test.ts` exige que `dashboard.run.ts`
  pida toda caja con `popupDe` vacío y sin `ref` (probado rompiéndolo: 14/1).
- **Sin bloques**: `leer_bloque_dashboard` y el parámetro `bloque` se fueron; `entidad` (una ficha) se rechaza
  fuera de un pop-up. **Vive en:** `lib/api-mako/areas/dashboard.def.ts`, `dashboard.helpers.ts`, `dashboard.run.ts`.

*12/10/2026, chat «Graphics», ola 3 de la v5 (paquete de la API y el link).*

## El editor del Landing Generator (14/10/2026, seis operaciones en `landing`)

El detalle del área está en [hallazgos-editor-landing.md](hallazgos-editor-landing.md) («Tanda 4»). Lo
que vale para cualquier área que sume operaciones:

- **Un recurso REST con tilde pasa el test con el título sin tilde.** `tests/api-mako-rest.test.ts` sólo
  mira que el título del recurso arranque en mayúscula y no tenga guiones: `/landing/disenos` salía
  «Disenos» en la referencia, en verde. Una palabra con tilde va a `ACENTOS` de `lib/api-mako/recursos.ts`
  (acá se eligió `plantillas`, que no la necesita). **Vive en:** `lib/api-mako/recursos.ts`.
- **Tercera vez: la operación existe por HTTP y no por WhatsApp porque el clasificador no conoce la
  frase** (antes cobros y automatizaciones). «publicá la landing…» sale `capturar` dudosa. Cuando el
  clasificador es de otro chat, el arreglo se mide sobre una COPIA de `lib/mako-intencion.ts` (sólo
  importa un tipo, así que se copia y se importa suelta) y el test lo espera como `{ todo }`: en
  `node:test` un `todo` que falla no rompe la corrida, y el día del parche pasa sin que nadie lo
  reescriba. **Regla: toda área que suma ACCIONES mide sus frases con el turno que corre ANTES de dar
  la tanda por cerrada.**
- **En la pantalla genérica se decide QUÉ queda fijo al proponer.** Fijarlo exige un parámetro (que es
  un campo editable en `/mako/revisar`) o un `proponer()` propio (que necesita su rama en el ejecutor de
  flujos, `tests/flujo-acciones.test.ts` las cuenta). `publicar_landing` NO fija la versión: publica lo
  guardado al confirmar, como el botón de su pantalla. Es una decisión por operación, y va escrita en la
  def.
- **`yaEstaba` no es sólo para no molestar al dueño**: también frena una escritura que deja rastro que
  no se poda (cada publicar deja una versión de hasta 1,5 MB en el historial).

*14/10/2026, chat del editor de landings, tanda 4 (`tests/api-mako-landing-editor.test.ts`).*

## Tres trampas de una operación nueva (14/10/2026, tanda 6 del Landing Generator)

- **`docs/api-mako.md` sólo documenta lo que sale por HTTP.** Después de cambiar la descripción de `replicar_landing`
  (sin `http`), el generador contestó «ya estaba al día»: no es caché, una operación sin `http` no aparece en la
  referencia. Para saber si quedó bien escrita se mira el `.def.ts` o el catálogo del modelo.
- **`siFallaNuestra` adentro de `ejecutar` es contraproducente**: el throw con «api-mako:» lo atrapa el catch del
  propio runner y el resumen sale con el detalle de la base. Va en `leer` y en `preparar` (los ataja el choke point
  de `ejecutar.ts` y los convierte en un 500 genérico); en `ejecutar` se devuelve el error.
- **Una def `reversible: true` tiene su camino de vuelta EN la API.** `aplicar_comentario_landing` decía «se deshace
  desde el historial del editor» sin una operación para leerlo o restaurarlo: una promesa falsa para el modelo. Se
  sumaron `listar_versiones_landing` y `restaurar_version_landing`. Trampa relacionada: `docsEditor.versiones(id)`
  devuelve [] tanto si no hay versiones como si la landing no existe o es de otro negocio: se pregunta aparte.
- `rutaRestDe(id)` devuelve `undefined` (no `null`) cuando la operación no tiene ruta REST.

**Vive en:** `lib/api-mako/areas/landing.def.ts` · `landing.run.ts` · `scripts/generar-api-doc.mjs`.
*15/10/2026, chat «Landing Generator» (`claude1`).*

## El área `imagen` (15/10/2026, el Image Editor): lo que pide un área nueva además de sus dos archivos

**Vive en:** `lib/api-mako/areas/imagen.{def,run}.ts` · `lib/api-mako/{tipos,registro,runners,rest}.ts` ·
`lib/mako-intencion.ts` (`AREA_KEYWORDS`, `esPedidoDiseno`) · `tests/api-mako-imagen.test.ts`

Se declaró el día que el editor se abrió a todos los workspaces (mientras era sólo del super admin, el permiso de la
tab lo habría abierto por token a cualquier cliente). Siete operaciones; el render no existe del lado del server, así
que crear y copiar devuelven el link al editor.

- **Seis lugares, no cuatro:** `AREAS` y `AREA_INFO` (tipos), `POR_AREA` (registro), `TODOS` (runners), las rutas
  de `rest.ts`, la referencia y el snapshot regenerados (`scripts/generar-api-doc.mjs`) y **`AREA_KEYWORDS`**:
  es `Record<Area, RegExp>`, y un typecheck ACOTADO que no incluye `lib/mako-intencion.ts` no ve que falta. Lo frena
  el pre-push, a los 5 minutos.
- **Y sumar el área a `AREA_KEYWORDS` otra vez no alcanzó** (es la misma trampa que `cobros`, más arriba): medido con
  `clasificarIntencion`, «qué diseños tengo» traía las lecturas y «cambiá el texto del flyer…» las acciones, pero
  **«creame un flyer de la inauguración» salía `capturar` DUDOSA, sin herramientas**. Se sumó `esPedidoDiseno`
  (molde de la automatización: verbo de crear, el objeto a tres palabras, sin otro objeto en el medio); «creame una
  tarea para el flyer» sigue siendo del Plan. Regla: al declarar un área que CREA algo, medir el «creame un X» del
  área contra el clasificador, no suponerlo.
- **Una `.def.ts` no importa nada con dependencias:** los tamaños con nombre viven en `lib/image-editor/tamanos.ts`,
  sin imports, y no en `reglas.ts` (que arrastra la Landing). El test 4 lo fija.
- **El motor de Doory no entra al server:** el documento en blanco y el cambio de textos se arman en
  `lib/image-editor/reglas.ts`, y el test 1 compara el documento en blanco con el `createBlankDocument` del motor.
- Verificado contra la base en el ws 3 con los runners tal cual (crear desde plantilla, ver, cambiar textos con
  mayúsculas, copiar, listar, borrar, otro workspace no lo ve), borrando lo creado.
- **⚠️ Un runner tampoco puede arrastrar `next/navigation`** (15/10, dos rojos en main después del push): el área
  importaba `lib/image-editor/server.ts`, que tomaba la pregunta de acceso de `app/image-editor/acceso.ts`, que importa
  `lib/tab-access.ts` → `next/navigation`. El build no se entera, pero todo lo que carga `lib/api-mako/runners.ts` fuera
  de Next murió con «createContext is not a function» (`tests/voz-mako.test.ts` #6 corre un runner con
  `--conditions=react-server`). La pregunta pasó a `lib/image-editor/acceso.ts`, suelta, y la página la reexporta.
  Regla: lo que una `.run.ts` importa no llega a un guard de página (`requireRolWs`, `redirect`); la pregunta de acceso
  va en un módulo de `lib/` sin `next/navigation`. Lo fija el test 7 de `tests/api-mako-imagen.test.ts` (carga el
  runner en un node suelto con esa condición). Y el texto: «aquí», no «acá» (`tests/puente-panel-copy.test.ts`).

## El editor entero del Web Generator (15/10/2026, tanda 7: 40 operaciones más en `landing`)

**Vive en:** `lib/api-mako/areas/landing-editor.{def,run}.ts` · `landing-contenido.helpers.ts` ·
`lib/editor-landing/server.ts` (`generarConIA`, `editarConIA`, `bibliotecaDeImagenes`) · `lib/mako-intencion.ts`
(`esPedidoDeLanding`, `RELEVANCIA_LANDING`) · `tests/api-mako-landing-contenido.test.ts` · `tests/mako-intencion-landing.test.ts`

Pedido de Martín (15/10, 00:10): «Ambos, tienen que pasarle absolutamente todos los botones. Todas las funciones a la API
de MaKo». Reabrió lo que la tanda 4 dejó fuera a propósito (generar con IA, editar el contenido). El detalle de la
pantalla está en [hallazgos-editor-landing.md](hallazgos-editor-landing.md) → «Tanda 7».

**El número.** El inventario de la pantalla contó 82 funciones de negocio: 23 estaban en la API. Con las 40 nuevas
quedaron **69 de 82** (`514f84468`), y **70** con `listar_imagenes_landing` de la corrección (`1412d13ee`). Varias
cuentan como hechas siendo PARCIALES: reescribir con IA el texto seleccionado y los diseños alternativos sólo se cubren
con `editar_landing_con_ia`, y leer un archivo a texto por HTTP sólo lo convierte el doer de WhatsApp. **Las 12 sin
declarar, y por qué:** el formato de una selección (fuera del editor no hay selección), las propiedades de Imagen y
Video, los datos de un Gráfico y los elementos de un Diseño optimizado (las cuatro, por `editar_landing_con_ia`);
subir un archivo desde el dispositivo (la API no recibe bytes; por enlace sí, el parámetro `imagen` lo copia a la
biblioteca); exportar a PDF, PPTX, PNG o HTML (corre en el navegador); comentar y borrar como equipo (abajo); leer la
página en el navegador de la persona (hace falta su navegador); y guardar, quitar o ver la clave de Stripe (ninguna
operación administra credenciales). Afuera a propósito, sin contarlas: el código del HTML personalizado (un modelo
inyectando código en una página pública), combinar o dividir secciones (con mover, borrar y agregar se llega), el alto
de un insertado y un video por enlace a la biblioteca.

- **Sumar 40 operaciones a un área sacó de WhatsApp a las que ya estaban.** «necesito que publiques la página de
  gracias» dejó de llevar `publicar_landing`. `ordenarPorRelevancia` (`registro.ts`) suma un punto por cada raíz de 5
  letras del mensaje que aparece en la descripción, y el presupuesto de 12.000 caracteres entra en ese orden: las 40
  descripciones repetían «creada en el editor», «(de listar_landings_creadas)» y «no publica (publicar_landing…)», cada
  una sumaba publi/cread/lista/pagin y le ganaba a `publicar_landing`. **Regla:** en una tanda grande, la frase que se
  repite en todas las descripciones no lleva las raíces de las intenciones de OTRAS operaciones (acá, `VERSION` en
  `landing-editor.def.ts`), y antes de commitear se corre el test del turno de WhatsApp del área.
- **La relevancia que pone el clasificador va CORTA.** Con `{ tipo: 'editar' }` ya funcionando, 4 de los 6 pedidos de
  editar seguían sin su herramienta: `RELEVANCIA_LANDING.editar` nombraba de todo («cambiar texto sección bloque enlace
  tema dominio…») y les repartía puntos parejos a las 40 operaciones; las más grandes llenaban el presupuesto. Con
  `'landings creadas'` deciden las palabras de la persona: 6 de 6, y `listar_landings_creadas` (de dónde sale el id)
  va en todos. **Regla:** para un pedido amplio, la relevancia del clasificador trae sólo lo auxiliar; la herramienta la
  eligen las palabras del mensaje. Se mide con `herramientasDelTurno`, no a ojo.
- ⚠️ **Sin hacer:** «quítale el formulario a la landing» se clasifica bien como editar, pero `acomodar_bloque_landing`
  no entra en el presupuesto: la raíz «quita» empuja primero a `quitar_dominio_landing` y `quitar_cobro_landing`. No
  está en ningún test. `lib/api-mako/registro.ts` (`ordenarPorRelevancia`).
- **Editar por WhatsApp** (`esPedidoDeLanding`, regla 5-bis, antes de la 6 de los links sueltos): verbo de pedido (con
  tilde, con pronombre —también «le»—, suelto al arranque o con modal) a ≤3 palabras de una pieza de la landing, sin
  otra área en el medio ni justo después («el titular DEL ANUNCIO» es de Ads), y la landing nombrada sin contar los
  links ni «la página de Facebook». La forma suelta sin tilde sólo vale al arranque: la tercera persona no es un pedido.
- **Un runner escrito `id: fabrica({...})` es invisible para el test del registro**: `tests/api-mako-registro.test.ts`
  encuentra los runners con `^\s{2}id:\s*\{`, que exige la llave después de los dos puntos («agregar_seccion_landing …
  no tiene runner»). Va `id: { ...fabrica({...}) }`. Y un segundo `.run.ts` de un área se declara en `RUNS_DE_AREA`
  del mismo test (hoy `landing: ['landing', 'landing-editor']` y `metricas: ['metricas', 'dashboard']`).
- **Segunda vez: el server no puede importar reglas puras que viven en un `'use client'`** (la primera, arriba, en la
  API copiada de GitHub): en el bundle del server devuelve referencias de cliente, no las funciones. Se copiaron a
  `landing-contenido.helpers.ts` con un test que compara cada copia con la de la pantalla (los tests en node sí
  importan el original). ⚠️ **Sin hacer: unificarlas** — mover a módulos sin `'use client'` las de
  `app/web-generator/editor/PanelPaginas.tsx` (`rutaLibreApi`, `hacerInicioApi`), `crear/SelectorTemaCrear.tsx`
  (`temaSugeridoApi`) y `editor/paneles/EstiloSeccion.tsx` (`ESTILO_RESTABLECIDO_API`), importarlas de ahí y borrar
  las copias.
- **`textoDe` (`doc.ts`) no sirve para buscar una frase**: junta los hijos de un párrafo o un título con un separador,
  así que «Agenda tu **llamada**» sale partida y la frase no aparece, sin decir por qué. Para buscar lo que lee el
  visitante, los nodos de texto de un contenedor se juntan SIN separador (`textosEnLinea`).
- **Los descartes del saneo no se comparan contra la landing entera**: sus mensajes llevan la posición («sección 3») y
  una landing vieja trae descartes propios. Se sanea SOLA cada sección tocada, antes y después, y frenan sólo los que
  aparecen después (`descartesNuevos`); la sección vieja se completa con `ATTRS_TARJETA_DEFAULT` antes de comparar, o
  «ya está así» falla sobre lo guardado antes de un atributo nuevo. Y agregar o duplicar exige ids NUEVOS en los campos
  del formulario y vaciar el del HTML personalizado (`conIdsNuevos`): el saneo los regeneraría, pero dejando un
  descarte cada vez.
- **`analizar_landing` no era el botón «Analizar»**: llamaba a `analizarLanding` suelto, sin guardar los hallazgos y sin
  la red de plataforma. Ahora pasa por `diagnostico-server.analizar`, con la URL tal cual.
- **`estadoDominio` ESCRIBE** (con DNS y Vercel listos pasa la fila de pendiente a verificado): no puede ser una
  lectura. `ver_dominio_landing` lee sólo la fila; verificar es una acción (`verificar_dominio_landing`).
- **Un comentario del equipo creado por la API no lo podría borrar nadie**: `comentar` (`lib/editor-landing/server.ts`)
  toma el autor de la cookie, por WhatsApp o HTTP quedaría `autor_sub` null, y `esComentarioPropio`
  (`server-reglas.ts`) dice que uno sin autor no es de nadie: sólo lo borra el super admin. Por eso no se declararon
  comentar ni borrar. ⚠️ **Decide Martín:** un autor «MaKo» en `comentar` y que `puedeBorrarComentario` deje a un admin
  borrar los de MaKo; con eso salen `comentar_landing` y `borrar_comentario_equipo_landing`.
- ⚠️ **Las versiones «Antes de un cambio de MaKo» no se podan.** Cada edición por la API deja una de hasta 1,5 MB y
  `podarVersionesAuto` (`server.ts`) sólo poda «Guardado automático»: un token detallado que edite en bucle llena el
  historial. Decidir si se suman al filtro o si va un tope por hora.
- **Lo que gasta plata va en pantalla, sólo admin y sin HTTP** (generar, editar y diagnosticar con IA): el techo de 60
  s de `/api/v1` no alcanza, y quien confirma en `/mako/revisar` tiene 300 s. Generar corta a los 240 s y lo que no
  salió se arma desde el esquema (`sin_diseno`: la pantalla, en cambio, espera a que la persona toque «Completar con el
  esquema»). ⚠️ **Sin hacer:** «Aplicar todos» va justo contra ese techo: no empieza otra vuelta pasados 90 s, pero una
  vuelta de `ia.editar` dura hasta 200 s, más el `preparar()` que se vuelve a correr al confirmar. Si se corta entre el
  guardado y la marca de resuelto, los comentarios quedan pendientes ya aplicados. Bajar a ~60 s o medir desde que
  arranca la confirmación (`landing-editor.run.ts`, `PLAZO_EMPEZAR_VUELTA_MS`).
- Las imágenes de afuera (`imagen`, `fondoImagen`, `favicon`, `imagenCompartir`, `logo`) se copian al CONFIRMAR, con
  `copiarUrlABucket` y su baranda SSRF; si la copia falla, la pendiente se consume con el error.
- **Dos roturas dieron verde por la razón equivocada.** Sacar la marca del voseo («cambiá») no rompía nada: el turno
  igual llevaba la herramienta por otro camino, y hubo que probarlo en `esPedidoDeLanding` (el tipo). Y «restaurar»
  mezclando en vez de reemplazar el tema daba verde porque el caso sólo tocaba los colores, que la mezcla superficial
  pisaba igual: se sumó una fuente. **Si una rotura da verde, el caso no ejercita la diferencia**: se agrega uno que la
  ejercite, y el comentario dice que la primera versión daba verde.
- **Cambiar descripciones de un `.def.ts` deja rojo `tests/api-mako-registro.test.ts`** («la referencia generada está al
  día») con un diff de 700 KB que no nombra la causa: `node --import tsx scripts/generar-api-doc.mjs` va ANTES de la
  suite de api-mako, no después del rojo.
- El guard de rótulos de `tests/editor-acciones.test.ts` no deja una minúscula seguida de una mayúscula
  (`[a-zá-ú][A-Z]`) y sólo exceptúa «WhatsApp»: «Hecho con MaKo» no pasa como rótulo (quedó «Créditos al pie»).

*15/10/2026, chat «Landing Generator» (`claude1`), tanda 7 (`514f84468`, `1412d13ee`).*

## Lo que se edita al revisar cambia sobre qué se ejecuta, y el título no se entera (15/10/2026)

**Síntoma:** en `/mako/revisar`, un reembolso propuesto para el cobro de Juan («Devolverle a Juan US$500…») se podía
confirmar con otro `cobroId` en el formulario: `aplicarPropuestaGenerica` re-prepara con lo editado y devuelve la plata
de OTRO cliente, mientras la pantalla seguía mostrando el título de Juan.
**Causa:** la pantalla es editable a propósito (la persona corrige un dato antes de confirmar), y el título es el
`resumen` que MaKo armó al PROPONER. Nada distinguía «corregir un dato» de «cambiar sobre qué se hace».
**Regla:** el parámetro que dice SOBRE QUÉ se hace lleva `fijoAlRevisar: true` (lib/api-mako/tipos.ts). El servidor lo
hace cumplir (un valor distinto se rechaza; uno vacío vuelve al guardado: el formulario llega del navegador, la
pantalla sola no alcanza), `plano` lo lleva al cliente y `RevisarAccion` lo pinta de sólo lectura. Si es otro, se
propone de nuevo. Copia del panel de Stripe: el cargo que se devuelve no se cambia en el diálogo de devolución.
**Hecho el mismo día, en todas las de plata o envío** (lo pidió Estrategia: ni Ads Manager ni Email tenían chat): el
`cobroId` de cobros; `P_CAMPAIGN`, `P_ADSET` y `P_AD` de Ads (y el `nivel` + `id` de `proponer_eliminar_entidad_meta`,
que no es plata pero no se deshace); el `idBroadcast` de Email; el borrador de `enviar_plantilla_a_meta` y el paso de
`enviar_plantilla_meta_paso` (en esa acción sola: `pOrden` en otra puede ser un valor que se corrige). **Y un BARRIDO**
(tests/revisar-fijo.test.ts): toda acción de pantalla con `costo: 'dinero'` o que manda algo (`enviar_*`, `programar_*`) y
tiene un id, tiene que traer uno fijo: la próxima no nace con el agujero. Queda afuera, sin plata ni envío, cualquier
otra acción de pantalla cuyo título nombre a alguien.
**Al hacerlo:** el reemplazo del `id` de `enviar_plantilla_a_meta` cayó primero en OTRA acción con la misma línea de
texto (`borrar_borrador_plantilla`); lo vio el barrido. Un parámetro declarado inline se repite tal cual en varias
acciones: el ancla de un cambio así es la acción, no la línea.
**Vive en:** `lib/api-mako/acciones.ts` (`aplicarPropuestaGenerica`) · `lib/api-mako/tipos.ts` (`Parametro.fijoAlRevisar`)
· `lib/bandeja-filas.ts` (`plano`) · `app/mako/revisar/[id]/RevisarAccion.tsx` · `tests/revisar-fijo.test.ts`.

## 183 caracteres en `cambiar_ficha_funnel` dejaron a «mover la reunión» fuera de WhatsApp (16/10/2026)

Sumarle el parámetro del ícono a `cambiar_ficha_funnel` puso en rojo `tests/agenda-whatsapp.test.ts`: con «no,
movela al viernes a las 10», `proponer_mover_reunion` dejó de viajar en el turno de WhatsApp.

- **El diagnóstico obvio era el equivocado.** «Cambió la relevancia» no: el puntaje era el mismo (4 contra 4) y
  el orden también.
- **La causa es el presupuesto, no el orden.** El doer manda como mucho 12.000 caracteres de esquema
  (`PRESUPUESTO_REGISTRO_CHARS`, lib/doer-herramientas.ts), y `toolsDelRegistro` saltea la que no entra.
  `cambiar_ficha_funnel` pesa casi 4.000 y, por el «cambi» de su id, empata arriba en cualquier «cambiá…» o
  «movela…». El turno estaba a 97 caracteres del tope; con +183, la de mover la reunión no entró. Sólo queda un
  `console.warn`.
- **El arreglo fue achicar la misma op:** las listas largas de ids (bloques, avisos, íconos) salen del `enum`, se
  validan en la traducción (lib/ficha/api.ts) y un id malo vuelve con `disponibles`. `tests/ficha-api.test.ts`
  le pone un tope de 3.796 caracteres.

**La regla:** antes de commitear una op, medir `JSON.stringify(aToolDef(def)).length` y correr el test del turno
de WhatsApp. Una op grande que empata arriba se come el lugar de las chicas.

**Pasó al revés el 21/10/2026 (Pagos).** Sumarle a `cobranza_lead` una frase en la descripción y el parámetro
`comprobante` (~440 caracteres) dejó afuera a `cambiar_ficha_funnel` en el turno de «editando la ficha»
(tests/ficha-editar-con-mako.test.ts: «cambia el nombre de esta hoja a Cierre»). Cualquiera de los dos solo ya
pasaba el tope. Quedó sólo el parámetro, con 140 caracteres; medido, ese turno tolera entre 120 y 250 más en el área
`crm`. **Lo que se le explica al modelo de UN parámetro va en el parámetro, no también en la descripción:** se paga dos
veces en un presupuesto que comparten todas las del área.

**Vive en:** lib/doer-herramientas.ts · lib/api-mako/registro.ts (`toolsDelRegistro`, `ordenarPorRelevancia`) ·
lib/api-mako/areas/crm.def.ts (`cambiar_ficha_funnel`) · tests/ficha-api.test.ts ·
*16/10/2026, chat «CRM» (claude3), corrida wf_e3cc574c-723 (`665f5bed1`).*

## `mover_tarea_plan` dejó a «movela al viernes» sin la tarea: mover de columna no es mover de día (16/10/2026)

En integración, `tests/agenda-whatsapp.test.ts` cayó con «mové eso al viernes»: no viajaba `listar_tareas_plan`.

- **El diagnóstico obvio era el equivocado.** «Las 34 acciones nuevas del Video Editor se comen el presupuesto»: en
  ese turno no viaja NINGUNA de video (las áreas son `crm` y `plan`; se midió con el mismo armado del test). Antes
  de culpar a la última área grande, se lista qué viaja de verdad y cuánto pesa cada una.
- **La causa: una acción cuyo id ES la relevancia del veredicto.** «Movela al viernes» suma `RELEVANCIA_MOVER`
  («… mover … tarea plan», lib/mako-intencion.ts), y `mover_tarea_plan` (el kanban del Plan, 49d30e58f) puntúa
  «mover», «tarea» y «plan» en su id: entraba arriba de `listar_tareas_plan` y, con el turno a 104 caracteres del
  tope, la dejaba afuera. Apagarla en WhatsApp lo ponía en verde (16/0): la prueba de la causa.
- **El arreglo es de sentido, no de tamaño:** esa acción cambia la COLUMNA de una tarea, nunca su fecha, así que no
  sirve cuando el veredicto es mover a un día (`v.mover`). `NO_MUEVEN_DE_DIA` (lib/doer-herramientas.ts) la saca de
  esos turnos; en «pasala a en proceso» sigue viajando. El test pide que no viaje (dos roturas, 15/1 cada una).

**La regla:** cuando un veredicto trae su relevancia, una acción de OTRA cosa cuyo id repite esas palabras le gana el
lugar a la que el veredicto necesita. Se mira qué viaja y, si no sirve para ese veredicto, se excluye ahí.

**Vive en:** lib/doer-herramientas.ts (`NO_MUEVEN_DE_DIA`) · lib/mako-intencion.ts (`RELEVANCIA_MOVER`) ·
lib/api-mako/areas/plan.def.ts (`mover_tarea_plan`) · tests/agenda-whatsapp.test.ts ·
*16/10/2026, chat «Video Editor» (claude3).*

## El Video Editor en la API: 34 acciones que PROPONEN, y lo que le pidieron al registro (16/10/2026)

Etapa 3 de docs/diseno-mako-ai-native.md: las operaciones del chat «Editar con IA» pasan a la API. El proyecto vive
en el navegador de quien lo edita, así que cada una es de pantalla PROPIA (`/video-editor`): deja su cambio en una
propuesta del proyecto (mig 0302), lo del mismo canal se junta, y una persona lo acepta en el editor. Se generan del
catálogo del chat (lib/editor-video/chat-api.ts): la descripción es el mismo `para` que lee la IA del chat.
- ⚠️ **El test del registro busca los runners ESCRITOS en el fuente** (`^  id: {` en el `.run.ts`): 34 runners
  generados con `Object.fromEntries` eran invisibles y el test decía «no tiene runner». Van explícitos
  (`agregar_texto_video: { ...enElEditor('agregar_texto_video') },`), que además es lo que lee quien busca un id.
- ⚠️ **En un pedido de edición por WhatsApp entra la acción, pero no la lista** (medido con `toolsDelRegistro` y el
  presupuesto de 12.000): con «quitale las muletillas al video de testimonio» viajaba `eliminar_muletillas_video` y
  no `listar_proyectos_video`, y sin el id no había cómo. **El proyecto va por NOMBRE o por id** (`elegirProyecto`),
  y si no alcanza, el error lista los proyectos. En una PREGUNTA no viaja ninguna acción (`incluirAcciones`) y las
  lecturas del Video Generator siguen enteras. Lo fija `tests/video-editor-propuestas-api.test.ts` (prueba 9).
- ⚠️ **Una acción de pantalla PROPIA tiene que decidir qué pasa en un flujo.** `ejecutarDesdeFlujo` manda toda
  propuesta que no conoce a `aplicarPropuestaGenerica`, que la busca en `propuestas`: el paso fallaba cada vez, y el
  editor de Automations ofrecía las 34 como «⚡ Acción». Quedan afuera de los flujos (`enElEditorDeVideo`,
  lib/api-mako/flujo.ts): un flujo corre sin nadie mirando el editor.
- **«SOLO PASA LO DECLARADO» con formas del chat que no se declaran:** los «textos» y «clips» de una plantilla son
  objetos con claves que dependen de la plantilla. En la API van como listas (`[{hueco, texto}]`) y vuelven a la forma
  del chat en `operacionDesdeInput`, que valida con la MISMA `validarOperacion`; «no» saca un color (el chat usa
  `false`). La prueba 2 pasa el ejemplo de cada operación del catálogo por `validarInput`: un campo sin declarar se
  perdería sin error.
- **Un rótulo con una sigla («Volumen (dB)») parece «pegado»** para la guarda de tests/editor-acciones.test.ts (una
  minúscula seguida de una mayúscula): va «Volumen», y la descripción dice dB.

**Vive en:** lib/editor-video/chat-api.ts · lib/editor-video/propuestas.ts y propuestas-server.ts ·
lib/api-mako/areas/video.def.ts y video.run.ts · lib/api-mako/flujo.ts · lib/api-mako/rest.ts ·
tests/video-editor-propuestas-api.test.ts (35 roturas). *16/10/2026, chat «Video Editor» (claude3).*

## `diagnosticar_funnel` de uno o varios funnels: dos embudos con etapas distintas NO se suman (17/10/2026)

**El pedido (#896):** Martín, tras el OKR por funnels: «estoy seguro que no solamente en los OKR, esa configuración seguro
debe faltar en varios lugares». La Retro se retiró con Experiments; quedaba el embudo de la API (`diagnosticar_funnel`,
`getFunnelEtapas` en lib/queries.ts), que siempre medía el funnel principal.

- **El parámetro `funnels` se lee UNA vez para todas las áreas** (lib/api-mako/funnels-del-pedido.ts): era una función
  privada de general.run.ts (guardar_objetivo, guardar_kpi), y una segunda copia sería otra respuesta a «¿de qué funnels?».
- **Cada lead cuenta en el funnel donde estaba ESE día** (`filtrarPorFunnels`, la regla del OKR), también las altas. Las
  altas no se pueden contar con un COUNT cuando hay funnels: hay que saber de cuál es cada una, así que van como filas
  paginadas.
- ⚠️ **Dos funnels con etapas distintas no se suman paso por paso.** Medido el 17/10 en el ws1: «Negocio que ESCALA» y
  «Renovación» no comparten sus pasos comerciales (`pasosComercialesDe`), así que pedirlos juntos da
  `FunnelsConEtapasDistintas` y la API dice «pídelos de a uno». No se adivina cuál vale.
- ⚠️ **Lo de Meta no se parte por funnel** (impresiones, clics, formularios: Meta no dice a qué funnel va cada uno). Las
  etapas del CRM sí; la salida lo dice en `notas` porque el modelo no ve la pantalla.
- ⚠️ **Trampa para medir con un script:** `getFunnelEtapas` llama a `getMarketingWindow`, que va por la caché de Next
  (`unstable_cache`), y fuera de Next tira «Invariant: incrementalCache missing». Un script de sólo lectura con
  `runWithWorkspace` no puede medir una lectura que pasa por `cachedRead`: se mide lo de abajo o en el server.
- tests/funnel-comercial.test.ts limita el largo de `getFunnelEtapas` (un recorte que mide el doble está mirando otra
  cosa): lo de funnels se sacó a `enLosFunnels` y `altasEnFunnels`, y el tope pasó de 6.000 a 7.000 (medía 6.343).

Test: tests/funnel-etapas-elegidos.test.ts (probado rompiéndolo; la primera versión no veía un `if` que nunca daba y se
ajustó). **No se midió con números reales** (la trampa de arriba).
**Vive en:** lib/queries.ts (`getFunnelEtapas`, `etapasDeFunnels`) · lib/api-mako/areas/metricas.run.ts ·
lib/api-mako/funnels-del-pedido.ts.
*17/10/2026, claude4 (chat Dashboard).*

**El cabo, cerrado el mismo día (B5):** `ver_serie_funnel_semanal` también recibe `funnels` y `getFunnelSeries` reparte las
R1 y las altas con `enLosFunnels`, igual que el período. La caché no necesitó cambiar: `unstable_cache` suma los
argumentos a la clave, así que la serie de «1,29» y la del negocio entero no se pisan (el relevo decía que había que
sumarlos a mano). Test: el último de tests/funnel-etapas-elegidos.test.ts.

## «Mi hoja» es la de quien chatea: el Dashboard y General ya no piden un email en el Ops Center (20/10/2026)

**Síntoma:** desde el Ops Center, en una cuenta con 2 o más informes guardados, «agregá un gráfico a mi hoja de
Marketing» contestaba «Hay 2 informes guardados en la cuenta: di de quién es (su email)». Es la pieza 1.5 de
docs/ops-center-principal.md.

**Causa:** la API elegía la persona del informe por el email que se nombraba o por «el único informe guardado». El
contexto de la app sólo traía `actor` (un email, o un nombre, o el `sub`, según la sesión). La pantalla, en cambio, lee
siempre el informe de quien mira, por su `sub`.

**Lo que quedó:** el turno de la app pasa `Ctx.quien` (`usuarios.id`, email y nombre), al proponer y al confirmar. El
Dashboard (`elegirPersona`, dashboard.helpers.ts) y General (lib/general-plantillas.ts) lo usan cuando no se nombra a
nadie. Se lee con `quienChatea(ctx)` (lib/api-mako/tipos.ts), que lo ignora fuera de la app: en WhatsApp, por HTTP o en
un flujo no hay «mío».
- **Por el `sub` y no por el email:** el super admin que mira un negocio no es miembro de ese workspace, y la pantalla
  igual abre SU informe ahí. Buscarlo por email entre los miembros no lo encontraba. Una sesión que no es una persona
  (`dev`, `password`) no trae `quien`.
- **Nombrar a otra persona le sigue ganando**, una automatización sigue exigiendo la persona, y un closer o un setter
  reciben «tu Dashboard es la hoja Closing» en vez de escribir un informe de admin.
- La descripción del parámetro `persona` cambió en las dos áreas (es lo que lee el modelo): si decía «con varios, pide
  elegir», el modelo preguntaba el email aunque el código ya no lo necesitara.

Test: tests/api-mako-mi-hoja.test.ts (probado rompiéndolo, cinco roturas). **Nadie lo probó en el Ops Center.**

## Compartir, exportar y mover desde el chat: las mismas piezas que la pantalla (20/10/2026, pieza 2.6)

Las tres sólo se hacían en la pantalla. Ahora están en el registro (`dashboard.def.ts`), cada una sobre lo que ya usa la
pantalla:
- **`mover_componente_dashboard`** usa la grilla de la pantalla. El editor acomoda con react-grid-layout y
  `verticalCompactor`, y `lib/graficos-mover.ts` llama a SUS funciones (`moveElement` y el compactador, desde
  `react-grid-layout/core`, que no trae React y corre en el servidor). Un acomodo escrito a mano dejaría una hoja que la
  pantalla reacomoda al abrirla, y el primer «Editar» la guardaría distinta. El mínimo de cada tarjeta es UNA regla
  (`minimoDeComponente`, lib/graficos-catalogo.ts), que antes vivía adentro del editor.
- **`exportar_hoja_dashboard`** es una lectura. Un modelo no le pasa un archivo a nadie: la persona recibe un link
  (`paraLaPersona`) a `app/api/graficos/exportar`, que corre `leer_hoja_dashboard` en CSV por el choke point
  (`ejecutarOperacion`) con SU sesión. Es el mismo CSV que da la API por HTTP, sin un CSV propio. Sólo existe en la app:
  el link pide la sesión de quien lo abre.
- **`compartir_dashboard`** crea el link de acceso con el mismo `crearShare` del botón «Compartir», sobre el informe de
  quien chatea, y no lee `persona` (la pantalla tampoco deja compartir el de otro). El link no pasa por el modelo.
  - Invitar por email quedó afuera a propósito: le escribe a un tercero, y es la decisión D3c de Martín (tarjeta en el
    chat o pantalla de revisión). Cuando esté, el envío tiene que salir de la ruta (`invitar`, app/api/compartir/route.ts)
    a un módulo compartido. Cinco tests de otras áreas fijan ese código, así que mudarlo es su propio trabajo.

**Trampas:**
- `nuevoElemento('experimento', [])` devuelve null: un experimento sin configuración no sanea. En un test, el spread de
  null armó una tarjeta sin tipo, el mínimo cayó al de un gráfico, y parecía un error de mover.
- Un ancho en palabras sólo topa con el mínimo en una sección (12) o en un experimento (4). Probarlo con un video (3) no
  prueba nada: el cuarto ya son 3.
- Dos guardas de OTRAS áreas lo frenaron en el antes-de-subir, con razón:
  - En dashboard.run.ts una variable no se llama `ref`: es el del pop-up de una caja de IA, y
    tests/graficos-ia-elemento.test.ts barre que ninguna puerta sin sesión lo arme.
  - El link de `/compartido/…` armado con `APP_BASE_URL` cae en tests/link-con-workspace.test.ts. Va en sus rutas
    PÚBLICAS: lo abre un tercero sin sesión, con el token del share, y un `?ws=` le diría a un extraño el número del
    negocio.
- **Que la frase natural traiga la operación NO está resuelto:** «mové / poné al lado / cambiá el ancho» llegan, pero
  «exportá», «descargame», «compartí», «mueve» y «hacé más ancho» caen en «capturar» o en «consultar». Es el clasificador
  (pieza 1.2, de MaKo WhatsApp y Ops Center 3). Las frases medidas quedaron en la carpeta de notas del Cerebro
  (`frases-dashboard-2-6.md`).

Test: tests/api-mako-dashboard-compartir-exportar-mover.test.ts (probado rompiéndolo, seis roturas). **Nadie lo probó en el
Ops Center.**
**Vive en:** lib/graficos-mover.ts · lib/api-mako/areas/dashboard.def.ts · dashboard.run.ts · dashboard.helpers.ts ·
app/api/graficos/exportar/route.ts · lib/graficos-catalogo.ts (`minimoDeComponente`).
*20/10/2026, claude4 (chat Dashboard).*
**Vive en:** lib/api-mako/tipos.ts · lib/mako-turno-app.ts · lib/api-mako/areas/dashboard.helpers.ts ·
lib/api-mako/areas/dashboard.run.ts · lib/api-mako/areas/general.run.ts · lib/general-plantillas.ts.
*20/10/2026, claude4 (chat Dashboard).*

## Lo que el chat dibuja al confirmar un cambio del Dashboard: un solo lugar, el `aplicar` (20/10/2026, pieza 2.7)

Sobre el marco de bloques de Ops Center 3 (1.7, lib/chat-bloques.ts): una acción confirmada devuelve `datos.bloque` y
`BloqueHilo` lo dibuja en la computadora y en el teléfono.
- **UN lugar arma el bloque:** `aplicar` (dashboard.run.ts) es el ejecutar() de TODAS las acciones que cambian el informe.
  Ahí `bloqueDelCambio` (lib/api-mako/areas/dashboard-bloques.ts) mira el cambio confirmado, el informe de antes y el que
  quedó GUARDADO:
  - una hoja creada o duplicada, o una tarjeta agregada, da un G5 «creado» con «Abrir en el Dashboard» en esa hoja;
  - editar, mover o quitar una tarjeta, renombrar o restilar una hoja, los filtros, «Editar con MaKo», archivar una hoja
    y restablecer dan un G4 «antes y después».
  Agregar un caso es sumar una rama ahí, no tocar cada runner.
- **Se arma con lo GUARDADO, no con lo pedido:** el saneo cambia lo que se pidió. Pasar un gráfico a «línea» le suma una
  dimensión, y el período vive en un control (v5), no en `periodo`. Un bloque armado con el pedido diría algo que la hoja
  no tiene.
- **El link es una ruta de la app** (`/dashboard?hoja=<id>`, sin `?ws=`): la pantalla le suma el de quien mira. El
  `linkHoja` que ya devolvía `aplicar` es ABSOLUTO (para HTTP y WhatsApp), y el saneo del marco descarta entero un bloque
  con un `https://`: la rotura que lo prueba tumba 4 de los 5 tests.
- **Los nombres van en palabras:** el período por `PRESETS` («Últimos 90 días», no `ult90`), el tipo por `tipoDe`, las
  métricas por `metricaDe`.

**Y una PREGUNTA también se dibuja (el mismo día, sobre el canal de Ops Center 3, `ctx.aDibujar`, 061c1b74d):** «¿cuánto
vendí este mes?» en el chat de la app deja su número, y «leads por mes», su serie.
- **El camino:** la lectura devuelve el OBJETO `{ content, bloque }`. `ejecutarOperacion` sanea el bloque y lo pasa por
  `ctx.aDibujar`, que sólo existe en la app, y el modelo lee sólo `content`. `consultar_datos_dashboard` lo hace con un
  gráfico (varias métricas sueltas son varios números, y un bloque es uno). El aviso de que la persona YA VE el resultado
  (para que no repita la tabla) va aparte, en `siSeDibuja`, y `ejecutarOperacion` lo suma SÓLO si el bloque se dibujó
  (ver la revisión del 21/10, abajo).
- **Se mira `ctx.aDibujar`, no el canal:** es lo que dice si hay dónde dibujar. El primer contrato del mismo día (un
  `bloque` metido en el JSON de la salida, que leía el turno) se sacó a la mañana siguiente. Con él, el modelo leía el
  bloque entero.
- **Una sola forma para el gráfico y la tabla** (`grafico`, lib/chat-bloques-dashboard.ts): una tabla ES un gráfico de tipo
  `tabla`, y la misma pieza la dibuja (`CuerpoGrafico`, por app/_chat/bloques/GraficoHilo.tsx, que se carga con
  `next/dynamic` porque arrastra recharts). El G7 del documento es otra cosa: la lista con acciones.
- **Lleva la FOTO del resultado,** no lo vuelve a pedir: es lo que MaKo contestó, y al recargar se ve igual. El gráfico se
  valida contra el catálogo (`sanearComponente`) y el resultado se acota: 60 filas (lo demás se cuenta en `fuera`; en el
  tiempo, las 60 más NUEVAS), 8 columnas y sin `ref` ni `imagen` por fila, que el hilo no usa.
- **Qué se dibuja:** un número queda número; con el tiempo, una serie; por categoría, barras hasta 12 grupos y tabla
  después; con desglose, columnas (`graficoParaElChat`).
- **Trampa de test:** `sanearComponente` saca sin avisar un desglose que no es dimensión del conjunto (`fuente` no es de
  `leads`: es `origen`). El gráfico de prueba quedó sin desglose y el test de «columnas» medía una serie.

**Lo que quedó sin hacer:**
- **El AI Analyst como trabajo largo (G6):** `analizar_hoja_dashboard` contesta «en curso». Espera la 1.11 (trabajos
  largos).
- **Otras lecturas que podrían dibujar:** `leer_hoja_dashboard` (una hoja entera no cabe en 4 bloques) y las de
  `metricas.run.ts` (`ver_revenue_periodo`, `metricas_negocio`): sumarles el bloque es el mismo molde.
- La miniatura de una hoja: una hoja no tiene una imagen guardada, así que su G5 va con el marco vacío y sin medidas.

Tests: tests/dashboard-bloques-chat.test.ts y tests/dashboard-bloque-grafico.test.ts (probados rompiéndolos, cinco roturas
cada uno). **Nadie lo miró en el Ops Center**: vive en la rama `dashboard-hilo`, que tiene mezclada `ola1` (122bac0d3),
todavía fuera de main.
*20/10/2026, claude4 (chat Dashboard).*

**La revisión del 21/10 (sobre 7eb2bbaae): lo que el código hacía mal sin que se viera.**
- **Una serie de más de 60 puntos dibujaba los 60 MÁS VIEJOS.** «Leads por día de los últimos 90 días» mostraba del
  23/07 al 20/09, escondía el último mes y la nota decía el período entero. `agregar` devuelve el tiempo en orden
  ascendente y el saneo cortaba con `slice(0, 60)`, aunque en el mismo archivo `serie` ya usaba `slice(-400)`. Ahora
  `inicioDibujado` se queda con las más nuevas (con la tabla al revés, las primeras), el desglose se corta igual y la nota
  dice el tramo dibujado (`desdeDibujado`). **Regla:** un corte de filas en el tiempo se queda con lo más reciente, y el
  texto que acompaña dice lo que se ve, no lo que se pidió.
- **«Ya lo ve: no repitas la tabla» se decía aunque el bloque no se dibujara.** El turno tiene un tope de 4 bloques por
  mensaje (compartido por todas las herramientas) y `dibujar` hacía `return` sin avisar. La quinta tabla no se veía, y al
  modelo se le había pedido callarla. Ahora `aDibujar` devuelve `false` si no dibujó (el tipo es `boolean | void`: un canal
  de antes, que no contesta, cuenta como dibujado), y la lectura manda el aviso en `siSeDibuja`, que `ejecutarOperacion`
  suma sólo si salió. **Regla:** lo que se le dice al modelo sobre la pantalla lo decide quien dibuja, no quien lee.
- **El gráfico del chat no tenía red de error.** ⚠️ **El diagnóstico obvio (envolver `CuerpoGrafico` adentro de
  GraficoHilo) no alcanzaba:** el error de un pedazo que no carga (un deploy con el chat abierto, la red del teléfono) lo
  tira el Lazy de `next/dynamic` en BloqueHilo, AFUERA de GraficoHilo. Sin red, subía a app/error.tsx y se caía la
  pantalla entera, chat incluido. Van dos redes (`RedDeBloque`): una en BloqueHilo alrededor del Lazy y otra adentro,
  alrededor del dibujo, que deja el título y el link en pie. ⚠️ React.lazy GUARDA el rechazo: «volver a intentar» no
  recupera el pedazo, sólo una recarga. Por eso la red no ofrece reintentar.
- **Bajas:** el G4 de «Editar con MaKo» pone primero «Se saca» (no se deshace, y era lo que perdía el corte de 12 filas
  del marco) y cuenta el resto en una última fila. Un cambio en el informe de OTRA persona va sin «Abrir en el Dashboard»,
  que abre el de quien mira (y con una plantilla se la agregaba a SU informe), y con el nombre del dueño en el título. Por
  la API HTTP ya no sale `datos.bloque` (rutas-http.ts lo saca para todas las áreas). El G5 de una hoja ya no escribe
  «16 × 10».

**La segunda revisión (sobre 17c0317b2): el arreglo de la serie abrió una regresión.**
- **El modelo leía las 25 filas más VIEJAS y la persona veía dibujadas las 60 más NUEVAS.** El texto que lee el modelo
  (`resultadoMarkdown`, tope de 25 filas en el chat) seguía cortando con `slice(0, 25)`. Con «leads por día de los
  últimos 90 días», el gráfico iba del 22/08 al 20/10 y el modelo leía del 23/07 al 16/08: cero filas en común. Encima
  `siSeDibuja` le decía «ya ve los últimos 60 puntos, comenta lo que importa», así que comentaba lo que nadie veía o
  inventaba la tendencia reciente. Antes del primer arreglo los dos arrancaban en la misma fila: **arreglar un corte
  desalineó el otro.** Ahora `resultadoMarkdown` corta con el mismo `inicioDibujado` (el desglose, corrido igual) y dice
  «(y N filas antes)». El test cruza las filas del texto con las del bloque.
  **Regla:** lo que se dibuja y lo que lee el modelo se cortan con LA MISMA función. Dos cortes escritos aparte se
  desalinean en cuanto alguien arregla uno.
- **Bajas:** en el informe de otra persona, `aplicar` ya no deja `link` en `datos`. Sin bloque (un conector, una edición
  que sólo mueve tarjetas), el chat armaba con él el mismo botón al informe de quien mira. Sólo en la app: por WhatsApp
  o HTTP no hay con quién comparar, y el link sigue. Restablecer el de Ana dice «El informe de Ana, como lo arma MaKo»
  (decía «Tu informe…, en el informe de Ana»). Una tabla de varias métricas cortada va sin la fila Total: la nota dice el
  tramo de 60 días y el Total sumaba los 90 (recalcularlo no sirve con una tasa).

**La tercera revisión (sobre 16b2c5cad): «lo más nuevo» no es lo que importa en una fecha que mira hacia ADELANTE.**
- **«¿Qué me vence en los próximos 30 días, día por día?» leía del 26/10 al 19/11 y perdía lo que vence HOY.** Con 30
  filas y un tope de 25, el corte «las más nuevas» se quedaba con las más LEJANAS. En cobranza lo urgente es lo de hoy, y
  por WhatsApp ese texto es lo único que lee el modelo. En main leía del 21/10 al 14/11, de casualidad bien. ⚠️ **El
  diagnóstico de la primera revisión («quedate con las más nuevas») era el correcto para lo que mira hacia atrás y el
  equivocado para el vencimiento:** la regla real es lo más CERCANO a hoy. `inicioDibujado` recibe `hoyAdelante` (hoy, si
  la fecha es `futuro` en el catálogo) y arranca en el grupo de hoy, llenando el tope hacia atrás si no alcanza («este
  mes» por vencimiento lee del 7 al 31 e incluye hoy). El texto dice «(y N filas antes)» y/o «(y M filas después)».
- **El gráfico se corta en el RUNNER (`cortarTiempo`), no en el saneo:** el saneo no sabe si la fecha mira hacia adelante
  ni qué día es. Lo cortado llega al saneo con 60 filas o menos, y el saneo ya no corta (al recargar, igual). La nota dice
  el tramo con `rangoDeTramo`, del grupo de la primera fila al de la última, y el pie dice «Y N puntos fuera de este
  tramo», porque puede ser de antes o de después.
- **Con 4 gráficos y una pregunta, el cuarto se recortaba DESPUÉS de leer «ya lo ve».** `bloquesDelMensaje`, de
  `ola1-guardia`, le hace lugar a la pregunta recortando los dibujos, pero el cuarto ya había avisado. Ahora lo decide
  `dibujar` con `entraOtroDibujo` (lib/mako-turno-app-reglas.ts): una lectura deja un lugar libre para la pregunta, que
  puede venir en cualquier turno con herramientas. Lo de una acción llega hasta el tope, porque con una pregunta se retira
  entero. **Regla, la misma de «ya lo ve»:** el tope se decide donde se le dice algo al modelo, no al armar el mensaje.

**Lo que quedó sin hacer (de la revisión):**
- **Con 4 dibujos de lecturas y una pregunta (G1), `[...dibujos, pregunta].slice(0, 4)` dejaba afuera la pregunta**
  (lib/mako-turno-app.ts). En main era imposible, porque ninguna lectura dibujaba. Esta rama lo vuelve alcanzable, y
  `siSeDibuja` empuja al modelo a escribir texto, con lo que la pregunta no aparece en ningún lado. Lo arregla Ops Center 3
  en `ola1-guardia` (02aee818b, `bloquesDelMensaje` deja siempre la pregunta), y el Cerebro integra las dos ramas en el
  mismo lote. **Esta rama no entra sin ésa.**
- **Analizar, programar el análisis y escribir la caja de Conclusiones en el informe de OTRA persona siguen dejando
  `link`** al informe de quien mira (dashboard.run.ts, los `datos` de `analizar_hoja_dashboard`,
  `programar_analisis_dashboard` y la caja). Ya estaba en main. El arreglo es la regla de `aplicar`: si `quienChatea(ctx)`
  existe y su `sub` no es el del payload, no poner `link`.
- **El «hoy» del área es el de Tijuana, no el del negocio** (`hoyEnTijuana()` en `consultar_datos_dashboard` y en el
  corte hacia adelante de `resultadoMarkdown`). Un negocio en otra zona corta el vencimiento y el período en otro día.
  Ya estaba en main. El arreglo es `hoyEnWorkspace` (lib/timezone.ts, async) en toda el área: pide pasar `hoy` a
  `resultadoMarkdown` desde cada runner, en vez del valor por defecto. Para la próxima pieza del chat Dashboard.
- **El pedazo que no cargó no se recupera sin recargar** (React.lazy guarda el rechazo). Un `import()` con reintento
  serviría si el runtime de Turbopack no guarda también el chunk fallido: no está medido.
*21/10/2026, claude4 (chat Dashboard).*

## ⚠️ La bandeja /mako/pendientes es OTRA puerta de confirmación: mostraba 240 caracteres y mandaba 2.000 (21/10/2026)

- La tarjeta del chat y el teléfono pintan «lo que se va a ejecutar» con `lineasDelPayload` (lib/inbox-movil-reglas.ts):
  el texto hasta `MAX_TEXTO` (2.000), sin ids. La bandeja del escritorio tenía su propio `valorLegible` con
  `MAX_VALOR = 240` y mostraba las claves crudas: se confirmaba un email de 1.500 caracteres viendo el principio. Ahora
  pinta con `lineasDelPayload` (app/mako/pendientes/BandejaPendientes.tsx).
- **Regla: toda superficie que CONFIRMA pinta con `lineasDelPayload`**, y el tope de una operación que se aprueba
  mirando su texto (`max` del parámetro) no pasa `MAX_TEXTO`. Una pantalla nueva de confirmación que arme su propio
  detalle repite este error. Lo fija tests/chats-mako-envio.test.ts.
- ⚠️ **Y la regla tapaba otra cosa (cuarta revisión):** `lineasDelPayload` pintaba una LISTA de objetos como «2
  elementos» y un objeto suelto como su JSON en 160. Producción mostraba el JSON en 240: con la regla, 13 operaciones con
  confirmación por chat (cambiar_textos_diseno_imagen, cerrar_tareas_plan, editar_clase_curso…) pasaron a confirmarse
  sin ver qué entraba. Ahora una lista de objetos es UNA FILA POR ELEMENTO («Cambios 1: De: Oferta 50% OFF · A: Oferta
  70% OFF»), hasta 20, y un objeto es «Clave: valor · …» hasta `MAX_TEXTO`. Filas y no saltos de línea: las pantallas
  pintan cada línea como dt/dd, y un salto adentro de un valor se pierde. **Una regla de «pintá con X» sólo vale si X
  muestra todo lo que se aprueba.**

*21/10/2026, chat «CRM» (claude4), tercera revisión del Cerebro de la 2.1.*

## Una operación nueva del registro deja AFUERA a otra, sin que nada falle (22/10/2026)

- **Síntoma:** el VERDE de la tanda del feedback 21/10 del CRM dio ROJO en `tests/ficha-editar-con-mako.test.ts`. Con la
  ficha en «Editar», «cambia el nombre de esta hoja a Cierre» ya no traía `cambiar_ficha_funnel`, y nadie había tocado ni
  la ficha ni el selector.
- **Causa:** `toolsDelRegistro` ordena por relevancia contra el texto y corta en el presupuesto de caracteres. La pista de
  edición («Cambia la ficha del CRM: ») hacía que el pedido saliera «sobre un lead (etapa)», y la relevancia que suma el
  clasificador (`RELEVANCIA_CRM.etapa`, «cambio etapa mover lead producto») es la de MOVER un lead. Con eso,
  `cambiar_ficha_funnel` era la ÚLTIMA que entraba. La operación nueva `cambiar_tipo_etapa` («cambiar» + «etapa» en el id,
  y una descripción larga) pasó delante y se quedó con su lugar. El corte sólo deja un `console.warn`.
- **El diagnóstico obvio era el equivocado:** no era la ficha ni la operación nueva, y achicar la descripción de
  `cambiar_tipo_etapa` sólo corría el problema a la próxima operación. La pista también ORDENA, no sólo clasifica: ahora
  lleva las palabras de la ficha («Cambia la ficha del CRM (sus bloques, hojas y estilo): ») y la pone primera o segunda
  en los seis pedidos medidos.
- **La regla:** un test que dice «el turno TRAE la herramienta X» tiene que pedir también un MARGEN (que entre entre las
  primeras), no sólo que esté. «Está» pasa mientras X sea la última que entra y se rompe en silencio con la próxima
  operación de la misma área.
- **Y volvió a pasar el mismo día con otra víctima.** Integración no tomó la tanda: en `tests/ops-center-bateria.test.ts`
  (main 3/3, la tanda 1/3), «cambia el teléfono del lead Juan a 5491199998888» dejó de traer `editar_contacto_lead` en la
  app y en WhatsApp. `cambiar_tipo_etapa` sumaba 5 (cambi + etapa en el id, que regala la relevancia genérica, y «leads»
  en la descripción) contra 4, y con sus 1.072 caracteres no quedaba lugar para los 1.450 de la otra. Arreglar la pista
  de la ficha había tapado UN síntoma, y la batería encontró el segundo. Lo que lo arregló, probado rompiéndolo:
  - la descripción sin «leads», que la deja en 4 (empate);
  - las 4 operaciones nuevas del feedback del 21/10 declaradas al FINAL del área, porque en un empate gana la declarada
    antes. Al final, pero ANTES de `armar_tab_ficha`: la misma regla la dejó última el 16/10, y tests/ficha-tabs.test.ts
    lo fija (el primer VERDE con el arreglo dio ROJO ahí).
  Cada parte sola deja un canal o los dos en rojo (2/1 y 1/2); juntas, 3/3. La regla quedó en AGENTS.md («Una operación
  nueva se declara AL FINAL de su área»).
- **Y una tercera vez, con el piso nuevo de Ops Center (94e9e7e40, cinco frases que ahora llegan):** el tren sacó la
  punta porque `crear_evento_agenda` y `editar_evento_agenda` dejaban sin herramienta a «crea una etiqueta llamada
  Caliente», «agenda un reel para el jueves a las 10» y «mové el evento del jueves al viernes». No era el orden: sumaban
  «agend» y «event» DOBLE por el id y el título, que es justo la relevancia que el clasificador pone en cualquier pedido
  de agenda (`RELEVANCIA_AGENDA`). Se renombraron por lo que crean, `crear_pagina_reserva` y `editar_pagina_reserva`
  (nunca estuvieron en producción), y la batería volvió a 3/3. Probado rompiéndolo: con el id viejo de la primera, dos
  frases se caen. Medido con el commit de Ops Center mergeado SIN commitear (`git merge --no-commit` y `--abort`): la
  batería se corre SOLA, porque en la tanda compartida pasa aunque esté roja (lo avisó Integración).

**Vive en:** lib/api-mako/registro.ts (`ordenarPorRelevancia`, `toolsDelRegistro`) · lib/mako-analyst-lead-reglas.ts
(`PISTA_EDICION_FICHA`) · lib/api-mako/areas/crm.def.ts (el final del área) · tests/ficha-editar-con-mako.test.ts ·
tests/ops-center-bateria.test.ts
*22/10/2026, chat «CRM» (claude3).*


## El ws13 no avisó de un solo lead nuevo del 13 al 22/10: medio emoji en el resumen de una pendiente (23/10/2026)

**Síntoma (medido por el Cerebro contra producción):** 20 envíos seguidos en `fallo`, todos del ws13, con «No se pudo
registrar la acción pendiente.»; cada lead nuevo se inscribía, el paso «MaKo en WhatsApp» fallaba y la inscripción quedaba
`completada` en el paso 1. **El diagnóstico obvio («el INSERT falla por el esquema o por el payload») era el equivocado:** el
Cerebro probó el insert por tres caminos, con el payload exacto, y entró las tres veces. **La causa:** el `preparar` de
`avisar_al_equipo` arma el RESUMEN con `mensaje.slice(0, 120)`, y en el texto de #241 y #264 (184 unidades) la unidad 119 es la
primera mitad de un emoji (U+D83D). `JSON.stringify` la manda como `\ud83d` y Postgres rechaza el pedido entero («invalid input
syntax for type json», medido con un `select …::jsonb` sin tocar tablas). El payload iba entero: por eso entraba. Sólo el ws13
tenía un emoji justo en ese corte. Y el motivo vivía en un `console.error` que nadie lee: `crearPendiente` devolvía `null`.
**Regla:** un texto que va a la base se corta con `cortarSinPartir`; lo que escribe una puerta compartida pasa por
`datosSinMediosEmojis` (`crearPendiente` lo hace con todo lo que inserta, así cubre los otros siete resúmenes cortados con
`slice` en los runners); una puerta que no puede escribir devuelve el MOTIVO, y el paso de una automatización lo deja en
`nutricion_envios.error` (`motivo` viaja APARTE: a una persona por el chat, WhatsApp o /api/v1 le llega la frase de siempre).
Y una acción que se sabe que NO corrió (`noCorrio`: la pendiente no entró) ya no cierra la inscripción: vuelve a su paso con
compare-and-set contra lo que escribió el reclamo y reintenta a 1 h, 6 h y 24 h (`REINTENTOS_ACCION_MS`); después sigue como
siempre, con «intento N de 4» en la fila. Sólo en el caso simple (sin hilos, sin flechas en paralelo, fuera del carril).
**Vive en:** lib/unicode-seguro.ts · lib/mako-pendientes.ts (`crearPendiente`) · lib/api-mako/areas/chatbot.run.ts
(`avisar_al_equipo`) · lib/api-mako/acciones.ts (`proponerChat`) · lib/api-mako/ejecutar.ts · lib/api-mako/flujo.ts
(`aplicarEnElActo`) · lib/nutricion-paso-accion.ts (`correrPasoAccion`) · lib/nutricion.ts (la rama del paso de acción) ·
test: tests/pendiente-medio-emoji.test.ts (6 roturas → 6 rojos). **Sin hacer:** `crearPropuesta` (lib/propuestas.ts) no sanea lo
que inserta; un paso de acción con hilos o en el carril sigue sin reintento; los 6 leads que se perdieron (#3098, #3096, #3091,
#2771, #2762, #2761) no recibieron su aviso, y mandárselo ahora al grupo del ws13 lo decide Martín; #264 dice «Nuevo agendado»
y su CRON también dispara al entrar a «lead» (es de ellos: se le muestra a Martín antes de tocarla).
*23/10/2026, chat «Automations» (claude1).*

## Sacar una operación del registro: qué da rojo y qué NO avisa (23/10/2026)

Al sacar `recomendar_formatos_creativo` (docs/hallazgos-onboarding.md → «Ángulos»). **Dan rojo** si falta una mitad:
`tests/api-mako-registro.test.ts` («toda def tiene su runner, y todo runner tiene def»), el snapshot HTTP
(`tests/api-mako-http.snapshot.txt`, que se REGENERA con `node --import tsx scripts/generar-api-doc.mjs` junto con
docs/api-mako.md), `tests/api-mako-rest.test.ts` (la fila REST huérfana) y el clasificador
(`tests/ops-center-clasificador-app.test.ts`, si una frase esperaba la operación). El pre-push frena con docs/api-mako.md viejo.

**Lo que NO avisaba nadie:** una LECTURA cuya descripción, o la nota que devuelve su runner, nombra la operación muerta. El
modelo la lee y va a buscar una herramienta que ya no existe. Una guarda general por patrón (todo `verbo_algo` de las
descripciones que no sea un id) da 24 falsos positivos (nombres de campos como `etapa_actual` o `lead_form_id`), así que
es una lista EXPLÍCITA: `OPERACIONES_RETIRADAS` en tests/angulos-sin-recomendacion.test.ts. **Al sacar una operación, se
suma ahí**, y su nombre no puede quedar en ningún texto del registro ni en ningún runner o helper.

**Al redirigir una frase a otra operación, mirá lo que esa operación acepta.** Sin la recomendación, «recomendame formatos
para mi anuncio» lleva a `elegir_formato_creativo_anuncio`, que aceptaba la celda virtual de los guiones propios
(`guiones-propios`, que `listar_anuncios_planteados` devuelve con `es_guiones_propios: true`): pagaba IA para fijarle un
formato a algo que no es un anuncio. Las hermanas (`escribir_guion_anuncio`, `_auto`) ya la frenaban; ahora también ésta,
en `preparar` y en `ejecutar` (que relee la celda).

**Vive en:** `tests/angulos-sin-recomendacion.test.ts` (`OPERACIONES_RETIRADAS`) · `lib/api-mako/areas/contenido.def.ts` · `contenido.run.ts` · `lib/api-mako/rest.ts`

*23/10/2026 · chat «Offer» (cuenta claude1) · medido en prod con un SELECT; no se miró en el navegador.*

**La cuenta de los perdidos: son 19, no 6 ni 10 (24/10, tres conteos independientes que dan los mismos ids).** Se contó
por los envíos en `fallo`, por los leads que entraron y por lo que llegó de verdad al grupo, y un cuarto releyó contra
la base cada nombre y cada teléfono. Hay 21 envíos en `fallo`, todos de leads distintos. 19 son de leads que llegaron
entre el último aviso bueno (lead 2647, 12/10 10:19 ART) y el último fallo (lead 3098, 22/10 23:09 ART). Los otros 2
(2624 y 2640) son leads viejos que la #264 barrió al prenderse, el 20/10. El 6 eran sólo los fallos de la #264 desde el
21/10. El 10 (antes 11) salió de una premisa **falsa**: «hasta el 17/10 igual salía el aviso del SISTEMA, porque su fila
en `notificaciones` no tiene `salida`». La marca `salida` recién existe desde e94f798a3 (17/10). Desde 4e2ebc7d2
(11/10), «Nuevo agendado» sale SÓLO por una automatización de aviso, y la única (#240) estaba archivada desde el 12/10.
Ninguno de los 19 tiene un turno en `mako_doer_conv` del grupo. **Regla:** lo que prueba que un aviso LLEGÓ al grupo es
la fila de `mako_doer_conv` del grupo (`role='assistant'`, `wa_message_id` no nulo), o el store de Evolution. No lo
prueban la fila del feed sin `salida` ni el «Le avisé al equipo.» de la pendiente: esa frase sale igual si el WhatsApp
del aviso está apagado y el email prendido. **Otras dos trampas de la misma medición:** la hora del commit no es la de
producción (0a5f6c9b6 es de las 10:58, entró a main a las 12:18 y quedó Ready a las 12:20:34 ART). Y un lead fusionado
conserva su `created_at` viejo, así que también hay que buscarlo por la fecha de inscripción. **Hoy (24/10):** 7 de los
19 siguen abiertos, 4 están ganados, 7 descalificados y 1 perdido. La lista con los 19 no entra en un aviso: 744
caracteres contra un tope de 500, y el negocio ya usó 1 de sus 3 avisos del día. El Cerebro decidió los 7 abiertos en
UN mensaje: los 12 cerrados ya los trabajó el cliente, y mandárselos era hacerle revisar trabajo hecho. La arma
`lista-ws13.mts` (sin versionar, en `C:/dev/wt-aut-sab24/scripts/_sab24/`) leyendo la base, con relectura antes de
escribir: nunca una lista copiada. **Hecho el 24/10:** el arreglo se vio andar con un lead real (Fabiana Mendez, 07:45
ART: envío en 'accion' → pendiente ejecutada → turno en el grupo con id de WhatsApp; `aviso-vivo-ws13.mts` → VERDE).
Salieron el aviso de arreglo (`commit:0a5f6c9b6`, id 3EB0AF61C11F1765025F34) y la lista de los 7 abiertos
(`leads-sin-aviso:0a5f6c9b6`, id 3EB0441020C727AF7607FC), por `scripts/avisar-arreglo-al-grupo.mts` con su vista
previa antes. Las 4 inscripciones de la #264 frenadas por borradores viejos de la #241 se sacaron
(`sacarDeSecuencia`) y sus 4 borradores se descartaron con el motivo en el historial de cada lead (ver «Archivar no
es cerrar», docs/hallazgos-chatbot.md): no queda nada que dispare un «Nuevo agendado» tardío.
*24/10/2026, chat «Automations» (claude1): corrige la entrada del 23/10, que daba 11 y la regla del feed.*

## Dar y quitar el acceso a un curso por HTTP: invitar existía, pero en un área que no sale por HTTP (23/10/2026)

**Síntoma.** Un chat que migraba un curso de Panda con un token «Curso» no encontró en la API cómo darles el curso a los
alumnos ni cómo cortárselo a quien se da de baja. Martín: «Revisá esto... Y si hay que hacer una revisión completa de la
API, porque creo que faltan muchas acciones posibles».

**Causa.** `invitar_cliente_curso_cs` existía, pero en el área `cs`, que no lleva `'http'` (lee cartera, emails y avance).
Sacarle un curso o cortarle el portal no estaba en ninguna área. La pantalla lo hacía todo (ficha, tarjeta del kanban).
Para alguien que integra por HTTP, eso era lo mismo que no existir: no hay pista de que la capacidad vive en otra área.

**Lo que quedó.** Cinco operaciones en `curso`, sólo HTTP y `rolMinimo: 'admin'` como el resto del área: `ver_acceso_curso`,
`dar_acceso_curso`, `quitar_curso_del_acceso`, `cortar_acceso_curso` y `habilitar_acceso_curso`, con rutas copiadas de los
colaboradores de un repo de GitHub (`PUT/DELETE /curso/cursos/{productoId}/accesos/{leadId}`, `PUT/DELETE
/curso/accesos/{leadId}/corte`). Cada una llama a la MISMA función de lib/ que la pantalla: `invitarAlCurso`,
`quitarCursoDelAcceso`, `revocarAcceso`, `reactivarAcceso`. El área `curso` pasa a decidir quién abre el curso, y nada más:
ni el email del lead, ni su avance, ni la cartera.

Tres decisiones que no se ven en el código:

- **Abrir exige un cliente ganado de ESE producto; cerrar se puede siempre.** `resolverAcceso` (lib/curso-datos.ts) sólo
  abre el portal a un lead con `estado_lead = 'ganado'`, así que un link mandado antes llega muerto. Y la API no mueve a
  nadie de etapa: eso lo decide el CRM. Cerrar no lo pide porque quien se da de baja suele salir del embudo ANTES de que
  alguien le corte el curso.
- **El «no» de sacar un curso se decide por lo que el alumno VE, nunca por el texto del error de la regla**
  (`decidirQuitarCurso`, curso.helpers.ts). Si no lo ve, es «ya está así» (200 sin cambios); si es lo único que le abre, el
  error manda a `cortar_acceso_curso`. La primera versión comparaba el texto de `productosTrasQuitar`: un texto
  reescrito habría convertido un «ya estaba» en un 422 sin que nada fallara.
- **Nada de lo que vuelve trae el email del lead**, ni el resumen ni los `datos`. Por HTTP, devolverlo sería leer un dato
  de una persona a través de una acción.

`habilitar_acceso_curso` no manda nada, y el link viejo sigue sin abrir: `revocarAcceso` subió la `version` del acceso, y
`reactivarAcceso` sólo borra el `revocado_at`. Para que le llegue un link que abre, `dar_acceso_curso` con `reenviar: true`.

⚠️ **Encontrado de paso, NO arreglado (no es de esta área):** «Invitar» desde el buscador de leads de cualquier etapa
(`invitarLeadDeCualquierEtapaAction`, pedido del 13/10, `cualquierEtapa: true`) le manda por email un link a un lead que
NO está en Ganado. Como `resolverAcceso` exige Ganado, ese link no abre hasta que el lead gane, y el mail no lo dice. Se le
avisó al chat de Customer Success.
**Vive en:** `app/customer-success/curso/invitar-actions.ts` · `lib/curso-invitar.ts` · `lib/curso-datos.ts` (`resolverAcceso`)

**Sin hacer** (la API sigue sin poder lo que la pantalla sí puede):

- el «Invitar al curso al ganar» de cada funnel (`cambiarCursoAlGanar`, lib/crm-curso-al-ganar.ts). Es lo que hace solo lo
  de «no vender sin entregar»;
- los líderes de área: invitarlos, cortarlos y habilitarlos;
- el alcance (qué módulos ve) y desbloquear;
- listar quién tiene acceso a un curso;
- sacar o cortar como «⚡ Acción» de un flujo. Hoy son sólo HTTP; para un flujo hace falta `'app'` y una forma en
  `lib/editor-acciones.ts`.

**Vive en:** `lib/api-mako/areas/curso.def.ts` («LOS ACCESOS») · `curso.run.ts` · `curso.helpers.ts` (`decidirQuitarCurso`) ·
`lib/api-mako/rest.ts` · `tests/api-mako-curso-accesos.test.ts` · `app/api-mako/Articulos.tsx` (la guía «Migrar un curso»)

*23/10/2026 · chat «API de MaKo» (claude2) · medido contra origin/main 4a2e7f9f0; tests y rotura en el worktree, sin tipos
(el acotado lo mató el vigía de RAM), sin navegador.*

## «Invitar al curso al ganar» y el @ de Instagram, por la API (23/10/2026, auditoría P0-4 y un pedido de Ventas)

**«Invitar al curso al ganar».** El interruptor del «⋯» de la columna Ganado sólo se prendía desde la pantalla. Ahora
están `ver_curso_al_ganar` y `cambiar_curso_al_ganar` (`GET`/`PUT /crm/curso-al-ganar`), con las mismas funciones que
la pantalla. Dos cosas que no se ven en el código:

- **La lectura del tablero (`estadoCursoAlGanar`) NO sirve para la API.** Lee el interruptor con `getSetting`, que con
  la base caída devuelve null; eso se lee como «ninguno prendido», y cualquier error también devuelve null. Para
  dibujar está bien: la opción no se ofrece. Pero MaKo, con esa lectura, le habría dicho al dueño «está apagada» sobre
  un CRM que invita. La API usa `estadoCursoAlGanarEstricto`, que tira y además separa «tiene curso» de «está
  prendida»: un CRM puede quedar prendido después de que su producto se quedó sin clases, y eso hay que poder decirlo.
- **«¿Tiene curso?» es UNA regla** (`tieneCurso`), que usan las dos lecturas. Copiarla en la estricta habría dejado dos
  definiciones de «se puede prender».

**El @ de Instagram en las propuestas de leads.** El CRM ya acepta un lead con sólo el @ (`tieneContacto`,
lib/contacto-minimo.ts, del chat de Ventas). La API lo perdía en tres lugares:
- el lote lo descartaba con la regla vieja, «email o teléfono»;
- `proponer_lead` no tenía dónde recibirlo;
- el flujo que escribe la propuesta en el acto (`crearLeadsDePropuesta`) no se lo pasaba a `createLead`, aunque
  llegara.

⚠️ **`lib/api-mako/flujo-params.ts` no puede importar valores**: es apto para el navegador, y
`tests/api-mako-registro.test.ts` lo frena. Por eso el @ se normaliza (`usuarioInstagram`) en quien propone y otra vez
en `flujo.ts`, nunca en `filasDeLeads`.

**Una dependencia entre dos ramas del tren se copia con el MISMO blob.** Esta punta necesitaba
`lib/contacto-minimo.ts`, que todavía estaba sólo en la rama de Ventas. Se trajo con `git show <sha>:<ruta>` (mismo
hash: `git hash-object` contra `git rev-parse <sha>:<ruta>`). Así la punta compila sola, y git funde las dos sin
conflicto en cualquier orden. Si el archivo cambia en la otra rama antes del merge, ya no es el mismo blob: se avisa.

**Vive en:** `lib/crm-curso-al-ganar.ts` · `lib/api-mako/areas/crm.def.ts` · `crm.run.ts` · `crm.helpers.ts` (`proponerLote`) ·
`lib/api-mako/flujo.ts` · `lib/api-mako/flujo-params.ts` · `lib/mako-doer-acciones.ts` · `tests/api-mako-curso-al-ganar.test.ts` ·
`tests/api-mako-leads-instagram.test.ts`

*23/10/2026 · chat «API de MaKo» (claude2) · tests y rotura en el worktree, sin tipos, sin navegador.*

## Editar las etapas de un CRM por la API: el cuerpo de la action se mudó a lib (23/10/2026, auditoría P0-6)

Seis operaciones nuevas en `crm`: `renombrar_etapa`, `agregar_etapa`, `eliminar_etapa`, `ordenar_etapas`, `plazo_etapa` y
`columna_nutricion_crm`. Hasta hoy la API sólo sabía cambiar el tipo de una etapa (`cambiar_tipo_etapa`, 21/10) y crear un
CRM entero: lo demás del «⋯» de la columna y del pop-up de etapas era sólo de la pantalla.

**El cuerpo de `editarEtapaAction` vive en `lib/etapas-crm-server.ts` (`editarEtapa`)**, el mismo molde que
`lib/etapa-tipo-server.ts`. La action quedó con la puerta (admin) y los cachés; la lib no limpia cachés, porque corre
también desde la API y un flujo (la API usa `invalidar`). Con dos copias de cómo se guarda una etapa, la que se queda vieja
es la que decide qué se puede borrar.

Lo que queda para código nuevo:
- **Lo que no se borra lo decide UNA función pura, `porQueNoSeElimina` (`lib/etapas-crm-reglas.ts`)**: las terminales, lo
  que no está en el pipeline, la última etapa y la de entrada. La op `eliminar` la llama al escribir y `eliminar_etapa` la
  pregunta en `preparar()`: una pendiente reclamada no vuelve a «pendiente», así que lo que se puede saber sin escribir
  falla antes del «sí». Lo mismo con el orden: `pipelineReordenado` arma lo que se guarda Y lo que muestra el resumen.
- **Los leads de la etapa que se quita se cuentan con el conteo del pop-up** (`conteosDelEmbudo`, que se mudó de
  `extrasDelEmbudoAction` con `etapaComoTablero`): todas las etapas arrancan en 0 y cuenta con la regla que dibuja la
  tarjeta. `contar_leads_por_etapa` mira sólo el CRM principal y con otra regla: con ése, una etapa propia con gente daba 0.
  El resumen dice lo que pasa con esos leads con la frase de la pantalla (`avisoAlQuitarEtapa`).
- **Una etapa se busca por key o por nombre, sin tildes** (`columnaDe`), como `cambiar_tipo_etapa`. `agregar_etapa` rechaza
  un nombre que ya tiene otra etapa del mismo CRM (un modelo que reintenta crearía dos iguales) y devuelve la key nueva
  (`editarEtapa` ahora la devuelve en `creada`).
- **Una columna de nutrición del catálogo no es una etapa**: se quita con `columna_nutricion_crm` (la op `quitarNutricion`,
  que apaga las transiciones que llegan a ella), no con `eliminar_etapa`. Una vez quitada ya no está en las etapas, así
  que se devuelve por su key: la respuesta al quitarla la dice.

**Quedó SIN hacer, y dónde:**
- Apagar UNA transición de nutrición (la op `nutricion`, por id `desde>hacia`) y el orden de la banda Nutrición
  (`ordenNutricion`): la pantalla los tiene, la API no. Van como P1.
- Devolver una etapa quitada TAL CUAL (la op `insertar`, que es el «Deshacer» de la pantalla): por la API, quitar una
  etapa no tiene vuelta (`reversible: false`); se puede volver a crear con `agregar_etapa`, con otra key.
- Los tests viejos que leían el cuerpo en `app/crm/actions.ts` (`etapa-reunion`, `funnel-estructura`,
  `leads-por-producto`) ahora leen también la lib y las reglas.

**Vive en:** `lib/etapas-crm-server.ts` · `lib/etapas-crm-reglas.ts` (puro) · `app/crm/actions.ts` (`editarEtapaAction`,
`extrasDelEmbudoAction`) · `lib/api-mako/areas/crm.def.ts` y `crm.run.ts` · `lib/api-mako/rest.ts` ·
`tests/api-mako-etapas-crm.test.ts`

*23/10/2026 · chat «API de MaKo» (claude2) · tests y roturas medidos; sin probar contra la base todavía.*

## La entrega de un cliente y el alumno nuevo, por la API (23/10/2026, auditoría P0-5 y P0-3)

**El síntoma.** Por la API se movía el CRM (`proponer_cambio_etapa`, `mover_lead_en_producto`, que escriben
`lead_funnel`), pero nada del registro escribía la entrega de Customer Success (`cliente_entrega`). Tampoco se podía dar
de alta a un alumno que no está en el CRM, que es lo primero que pide migrar un curso de Panda.

**Lo que quedó.**
- Área `cs`, sin HTTP: `mover_cliente_entrega`, `quitar_cliente_de_servicio` y `devolver_cliente_a_servicio`.
- Área `curso`, con HTTP (`POST /curso/cursos/{productoId}/alumnos`): `crear_alumno_curso`.

Las cuatro usan las funciones de la pantalla. Para eso hubo que sacarlas de las server actions, porque un runner no
llama server actions:
- `lib/cs-quitar-producto.ts`: «Quitar de este producto» y su deshacer;
- `lib/cs-crear-cliente.ts`: el alta de la cartera;
- `lib/curso-alta-alumno.ts`: el alta de un alumno, en cuatro pasos: crearlo, ponerlo en el kanban, dejarlo sólo en ese
  producto e invitarlo.

Las actions delegan y conservan la puerta, el autor y el `revalidatePath`.

Decisiones que no se ven en el código:

- **Sacarle la fila de entrega a un cliente NO es una operación de la API.** `sacarDeEntregaAction` borra la fila y deja
  al cliente en su «estado derivado»: es el deshacer del primer movimiento. Expuesta como «sacarlo de la entrega»,
  contestaría distinto según el servicio sea o no el de su embudo. Lo que la persona quiere decir con «sacarlo» es
  `quitar_cliente_de_servicio`.
- **`devolver_cliente_a_servicio` mira lo que QUEDÓ.** Si el servicio no era el de su embudo, sacarle la marca de
  «fuera» no lo devuelve, porque no tenía fila que reponer. En ese caso entra a la primera etapa por el choke point. La
  pantalla no tiene este problema: su deshacer manda la etapa y el reloj que guardó al quitar.
- **`crear_alumno_curso` no pasa a nadie a Ganado.** `usarLeadId` sólo vale para quien ya es cliente, al proponer y al
  confirmar, igual que `dar_acceso_curso`. En la pantalla, el botón «Marcar como cliente e invitar» lo dice; por la API
  no hay botón que lo diga.
- **Un duplicado vuelve con el id y el motivo, sin el nombre.** Los nombres son del CRM, y un token de «Curso» no tiene
  por qué leerlos.
- **El tope de leads del plan frena el alta**, al proponer y al confirmar. El alta de Customer Success de la pantalla
  todavía NO lo aplica: queda anotado abajo.

⚠️ **Mover código fuera de una server action rompe los guards que la leen por regex, aunque el código esté bien.** Seis
tests fijaban el cuerpo de las actions: `cs-pertenencia`, `cs-acciones-puerta`, `curso-invitar`, `curso-invitar-reglas`,
`venta-sin-cobro` y `crm-origen-lead`, este último con su lista `ALTAS` de quién hace `createLead`. Los seis siguen a la
regla a su archivo nuevo. Ninguno se debilitó: cada aserción busca lo mismo en otro lugar.

⚠️ **Y un runner nuevo cae en guards que barren el repo por SÍMBOLO, no por área.** El clasificador de
`tests/curso-invitar-reglas.test.ts` exige que todo archivo que llama `productosDelCliente(` esté en su lista con un
motivo. `curso.run.ts` lo llama desde el acceso a cursos, y esa primera punta salió con ese rojo: corrí los tests «del
área» y éste no lo era. **Antes de pasar una punta, un `grep` de cada símbolo y cada ruta tocada sobre `tests/`, y se
corren todos los que aparecen.** Acá fueron unos 300 archivos con `--test-concurrency=2`, sin tocar el límite de RAM.

**Sin hacer:**
- la ⚡ Acción de un flujo para mover, quitar, cortar y habilitar. Es de Automations (`lib/editor-acciones.ts`,
  `flujo-params.ts`), y le pregunté;
- `crearClienteAction`, el alta de la pantalla de Customer Success, no frena por el tope del plan. La API sí;
- leer las etapas de la entrega de un servicio sin moverlo (`ver_etapas_entrega`, P1). Hoy las devuelve el error de
  `mover_cliente_entrega` cuando la etapa no existe.

**Vive en:** `lib/api-mako/areas/cs.def.ts` · `cs.run.ts` · `lib/api-mako/areas/curso.def.ts` · `curso.run.ts` · `lib/cs-quitar-producto.ts` ·
`lib/cs-crear-cliente.ts` · `lib/curso-alta-alumno.ts` · `app/customer-success/actions.ts` · `app/customer-success/curso/invitar-actions.ts` ·
`tests/api-mako-cs-entrega.test.ts` · `tests/api-mako-curso-alumno.test.ts`

*23/10/2026 · chat «API de MaKo» (claude2) · tests y rotura en el worktree, tsc acotado sin errores propios, sin navegador.*

## Vender un plan de MaKo por el chat: lo que mueve plata se confirma en pantalla (23/10/2026, auditoría P0-8)

`vender_plan_mako` es «Vender un plan» de /admin/cobros por el chat del super admin. `crear_link_pago` no servía: exige un
producto del catálogo y no pone `altaCapa`, así que al pagarse no se creaba la cuenta. Lo que queda para código nuevo:

- **Lo que mueve plata va con `confirmacion: 'pantalla'`, `rolMinimo: 'admin'` y, si es de la plataforma,
  `gating.soloPlataforma`; sin `'http'` si cobra.** Lo decidió el Cerebro ese día, corrigiendo la primera versión, que
  se confirmaba por chat con la marca `plata`. El porqué: el precio lo tipea una persona y el link cobra eso, y en la
  pantalla se puede corregir antes del «sí».
- **En pantalla, lo que el resumen nombra como SUJETO va `fijoAlRevisar`**: acá el email y el plan. Corregirlos al
  revisar le vendería otro plan a otra persona con el resumen que se confirmó. El monto sí se edita: es lo que se revisa.
- **Un runner no llama server actions**: «Vender un plan» vivía adentro de `venderPlanAction` y se mudó a
  `lib/vender-plan.ts` (`venderPlan`; la validación, a `lib/vender-plan-reglas.ts`). La action quedó con el super admin
  primero y el `revalidatePath`, y delega. Cobros pidió no armar un segundo camino para crear un cobro con alta de cuenta.
- **Lo que el camino de la pantalla rechazaría al confirmar, se rechaza en `preparar()`**: el workspace de la plataforma
  (también en `ejecutar()`), dos leads con el mismo email (no elige uno a ciegas) y la pasarela (ninguna conectada, la
  pedida no conectada, o dos sin decir cuál). Una pendiente reclamada no vuelve a «pendiente».
- **El link lo escribe el código**: va a la persona (`paraLaPersona`) y en `datos.url`, que /mako/revisar dibuja como
  botón. Nunca al resumen que lee el modelo.

### ⚠️ La revisión propia dijo «nada que frene»; la adversarial encontró 16

La primera versión se revisó a mano con tres lentes (el Workflow no corría por la RAM) y salió «no encontró nada que
frene». Cobros pidió la revisión adversarial antes de soltarla, y con cuatro frentes (alguien sin admin que vende, un plan
que no existe, el doble clic, un workspace que no es la plataforma) aparecieron 16 confirmados, dos de severidad media. Lo
que generaliza:

- **`rolMinimo: 'admin'` + `soloPlataforma` es el admin DEL WORKSPACE de la plataforma, no el super admin global.**
  /admin/cobros exige `getSesionAdmin`; por la API alcanzaba con ser admin del ws de la plataforma. Una acción que la
  pantalla reserva al super admin lleva `faltaParaConfirmar` y el mismo chequeo en `ejecutar()` (`esSuperAdmin`, con
  `try`: fuera de un request no hay cookies y eso es un «no»). Al PROPONER no se exige: por WhatsApp no hay sesión.
- **Vale también para las LECTURAS (26/10/2026).** `ver_clientes_de_mako` y `ver_agentes_de_clientes` muestran datos de
  todos los negocios, que /customers sólo le enseña al super admin, y se quedaron en el `soloPlataforma`. La revisión del
  tren lo encontró: alguien con rol admin en el equipo de MaKo los leía por el chat. Ahora en la app preguntan
  `ctx.canal === 'app' && !(await esSuperAdmin())`. Por WhatsApp habla el grupo de la plataforma, que no tiene cookies, y
  un flujo corre con canal 'app' pero sin sesión, así que tampoco pasa.
- **Un paso «⚡ Acción» de un flujo se confirma solo (`aplicarEnElActo`).** Lo que tiene que confirmar una persona
  concreta va en `NO_EN_FLUJOS` (lib/api-mako/flujo.ts) Y el runner lo rechaza por `PREFIJO_FLUJO`: el lienzo no lo
  ofrece, pero un paso viejo o importado lo correría igual.
- **Lo que va a cobrar se decide ANTES del «sí» y el resumen lo dice.** El resumen nombraba el monto con la moneda que
  vino (o USD), Mercado Pago cobra en la de su cuenta, y una venta sin el valor en dólares fallaba DESPUÉS del «sí», con
  el lead ya creado. `previaDeLaVenta` corre `decidirCobro` + `montoUsdDelCobro` sin escribir, y `venderPlan` la llama
  antes de crear el lead (la pantalla también se benefició).
- **La lista «en positivo» que excluía.** `CAPAS_VENDIBLES` tenía el comentario «en POSITIVO» y el código
  `c.id !== 'superadmin'`: una capa nueva entraba sola a la venta, al enum de la operación y al alta al cobrar. Ahora son
  dos listas (`IDS_VENDIBLES` y `CAPAS_NO_VENDIBLES` con su porqué) y tests/capas-vendibles.test.ts exige cada capa en
  una. Es el «el nombre decía la intención y el código otra cosa» de `wsDePrueba()`, otra vez.
- **Una regla dentro de un módulo `server-only` no se ejecuta en ningún test.** `ventaValida` se mudó a
  `lib/vender-plan-reglas.ts` (puro) y el test la CORRE: capa, email en minúsculas (el alta crea al admin con él), moneda.
- **Dos pedidos dejaban dos links vivos, y pagar los dos creaba dos cuentas.** `cobroAbiertoDelPlan`: un link pendiente
  del mismo plan con el mismo precio vuelve como `yaEstaba` con su link; con otro precio, se anula primero.
- **El comprador por email EXACTO no veía un lead guardado con mayúsculas**, y la venta creaba otro. Va un patrón
  escapado (`\`, `%`, `_`) por `ilike` y decide `leadPorEmail`, la vara de lib/compra-plan.ts.
- **En /mako/revisar `paraLaPersona` no se muestra**: el resumen de lo hecho dice dónde quedó el link (Cobros, con el
  número de cobro).

### Lo que quedó sin hacer

- **`crearCobro` puede quedar a medias** (el cobro escrito y el link de la pasarela fallado, o al revés): vive en
  `lib/cobros.ts`, es del área Cobros y se les reportó.
- **`confirmar()` de `app/mako/revisar/[id]/RevisarAccion.tsx` no tiene `try/catch`**: si la action tira, el botón queda
  girando. Es UI compartida de todas las acciones de pantalla.
- **`CAPAS_DE_PLAN` de `lib/planes-mako.ts` repite `IDS_VENDIBLES` a mano**: dos listas de lo mismo (chat Planes).
- **La pantalla no rechaza una cuenta que ya existe** (del equipo de MaKo o de otro negocio): la API sí, porque el email
  lo transporta un modelo. En la pantalla lo ve Martín, y cambiarla es una decisión de Cobros.
- **Residual: dos propuestas para un comprador NUEVO confirmadas a la vez** pueden crear dos leads. Un `ref` determinista
  lo cerraría y bloquearía revender para siempre (una propuesta aplicada bloquea su `ref`).

**Vive en:** `lib/vender-plan.ts` · `lib/vender-plan-reglas.ts` · `lib/capas.ts` (`IDS_VENDIBLES`, `CAPAS_NO_VENDIBLES`) ·
`app/admin/cobros/actions.ts` (`venderPlanAction`) · `lib/api-mako/areas/cobros.def.ts` y `cobros.run.ts`
(`vender_plan_mako`) · `lib/api-mako/flujo.ts` (`NO_EN_FLUJOS`) · `tests/api-mako-vender-plan.test.ts` (18 roturas con
capas-vendibles, cada una al menos 1 fallo) · `tests/capas-vendibles.test.ts` · `tests/admin-cobros.test.ts`

*23/10/2026 · chat «API de MaKo» (claude2) · primera versión con revisión propia; revisión adversarial con agentes
(wf_fbeb8485-d3c) el mismo día, a pedido de Cobros.*

## «Toda capacidad nace en la API» es regla desde el 13/10, y la guarda que la hacía cumplir nunca llegó a main (23/10/2026)

**El síntoma.** La auditoría del 23/10 contó 788 operaciones y **174 acciones de pantalla sin declarar** (14 P0, 85 P1, 75
P2). Por grupo de pantallas:

| Grupo | Faltas sin repetir |
|---|---|
| cursos | 22 |
| contenido | 21 |
| operaciones (Customer Success, CRM y curso vistos desde la operación) | 18 |
| tablero (Plan, General, Dashboard) | 17 |
| crm | 15 |
| huérfanas (Offer, Onboarding, Archivero) | 15 |
| automations | 13 |
| canales (WhatsApp, email, calendario) | 13 |
| cobros | 12 |
| ads | 12 |
| cuenta | 10 |
| landings | 6 |

Hay además tabs enteras sin área: AI Avatar; generar Reels, Carousels y Stories; escribir Offer y Onboarding; pedir y
filmar en el Video Generator; las escrituras de Integraciones que no llevan secretos; el admin de la plataforma. La
auditoría está fuera del repo, en `C:/dev/cerebro-herramientas/auditoria-api-mako-23-10.md`.

**La causa.** El 13/10 Martín pidió «un sistema para que siempre se implementen los llamados a la API», y se escribió:
- `scripts/api-cobertura.mjs`: un inventario de 1.273 capacidades;
- `lib/api-mako/cobertura.ts`;
- `tests/api-mako-cobertura.test.ts`, que fallaba a propósito porque faltaban clasificar 931.

Todo quedó en el commit `b85971b9b`, «A MEDIAS — NO PUSHEAR», de la rama `wip/api-acciones-1410`. Esa foto se sacó al
cierre del 14/10, con trabajo a medias de quince áreas, y nadie la retomó. **La bitácora de `/admin/dev` describe la guarda
como hecha** («El sistema es un GUARD: tests/api-mako-cobertura.test.ts falla…»). Cualquiera que la leyera daba el agujero
por cerrado. Una semana después eran 174.

⚠️ **La guarda que sí está, `tests/api-mako-registro.test.ts`, no puede ver esto.** Revisa las operaciones que EXISTEN
(canales, gating, filas REST, confirmación) y el snapshot de lo que sale por HTTP. Una acción de pantalla que nadie
declaró no está en ningún lugar que esas guardas miren. Da verde siempre, y el verde se lee como «la API está completa».

⚠️ **La rama `wip/api-acciones-1410` no se puede fusionar tal cual: es una cantera, no una rama.** Tiene versiones a medio
hacer de lo que se hizo el 23/10:
- `invitar_al_curso`;
- `app/customer-success/entrega-acciones.ts`;
- `clientes-escritura.ts`.
Fusionada, duplica o pisa. Lo que sirve de ahí es el inventario.

**La propuesta de guarda (sin hacer).** Lo más chico que cierra el agujero, con la forma de `tests/cs-acciones-puerta.test.ts`.
Lee con el parser de TypeScript cada función exportada de cada archivo `'use server'` de `app/` y exige que esté:
- **cubierta**: en un mapa `accion → operaciones del registro`, y el test comprueba que esas operaciones existan;
- **exceptuada con su motivo**: una lectura que sólo sirve para dibujar, un paso de la interfaz;
- **o en una lista de deuda que sólo baja**: arranca con lo que no esté cubierto (las 174 de la auditoría y lo que
  aparezca), y una entrada que ya está cubierta también falla, para que la lista no quede vieja.
Los route handlers de `/api` que despachan por `action:` van en una segunda fase. `scripts/api-cobertura.mjs` de
`b85971b9b` sirve de punto de partida para el inventario.

**Vive en:** `tests/api-mako-registro.test.ts` · `lib/api-mako/registro.ts` · rama `wip/api-acciones-1410` (`b85971b9b`) ·
`app/admin/dev/api-mako/bitacora.ts` (el hito del 13/10)

*23/10/2026 · chat «API de MaKo» (claude2) · medido con `git cat-file` sobre origin/main y `git log --all` de los tres
archivos.*

## El onboarding y las ofertas por la API: cinco trampas que no avisaban (23/10/2026, auditoría P0-12, P0-13 y P0-14)

Cinco operaciones nuevas en `negocio`: `cerrar_paso_onboarding`, `marcar_paso_onboarding_tab`, `listar_ofertas`,
`guardar_oferta` y `borrar_oferta`. La decisión de abrir el onboarding a la API, con su porqué, está en
docs/hallazgos-onboarding.md (misma fecha). Lo que costó, y vale para cualquier operación que escriba:

**1. `getCapaActual` va memoizado con el `cache` de React por request.** `cerrarPasosOnboarding` leía los pasos de la capa
por ahí. Una página atiende un workspace por request y no se nota; un flujo o un cron que corre acciones de VARIOS
workspaces en el mismo request recibiría la capa del primero y cerraría el arranque de otro con los pasos equivocados.
No se midió en producción: se leyó en el código. La puerta acepta ahora los pasos como 4.º argumento y la API los pasa
siempre. **Regla: un runner no llama nada que resuelva el workspace o la capa por `getCapaActual`; los lee del `ctx.ws`.**

**2. `capaDelWs` (negocio.helpers) cae a la capa por defecto si no puede leer.** Para listar está bien; para decidir qué
pasos se pueden cerrar, no: con la base caída, un Project Manager pasaba a tener los pasos de la capa completa. Las dos
operaciones del onboarding leen la capa con `getWorkspace` (que tira) y, si no hay respuesta, no proponen nada.

**3. En la oferta que sale del perfil (`desde_brief`), escribir promesa, precio, incluye o garantía no cambia lo que MaKo
escribe.** `resolverOfertaPrincipal` lee esos cinco campos del perfil cuando la fila es `desde_brief`, y es lo que llega a
los prompts (`perfilNegocioTexto`). La pantalla de ofertas promete lo contrario («escríbelos aquí para que manden estos»),
y eso es falso hoy. `guardar_oferta` lo dice en el resumen antes de confirmar, y no lo esconde. ⚠️ **El arreglo obvio es el
equivocado**: hacer que la columna le gane al perfil haría mandar a lo que escribió `sugerir` (el «Que MaKo complete lo que
falta» de la pantalla llena esas columnas vacías con lo que propone la IA), o sea, una sugerencia le ganaría a lo que el
dueño declaró. Queda sin hacer: que la pantalla diga la verdad o que guardar esos campos pase la oferta a «declarada».

**4. El GET de la pantalla de ofertas ESCRIBE** (`seedOfertaDesdeBrief` siembra la oferta principal). Una lectura de la API
no puede reusarlo: `listar_ofertas` no siembra y, sin ofertas, devuelve la del perfil como `oferta_del_perfil`.

**5. Por WhatsApp, un pedido en imperativo no trae acciones.** Medido con `herramientasDelTurno` y el clasificador real:
«cierra el paso de la fase del onboarding», «cambia el precio de mi oferta Mentoría», «borra la oferta Prueba vieja»
salen `capturar` con cero herramientas, igual que «borra el producto Mentoría», que ya existía. La pregunta («¿puedes
cerrar el paso…?») sale `consultar` y trae sólo lecturas. No es de estas operaciones: es del clasificador, y no se tocó.
Por la app y por HTTP las cinco llegan.

**Lo demás que queda como regla:**
- **El saneo de una oferta es UNO** (`sanearOfertaInput`, lib/oferta-modelo.ts): lo usan la pantalla y la API, y devuelve lo
  que DESCARTÓ. La pantalla lo ignora (como antes); la API lo rechaza, porque una fecha mal escrita que desaparece es un
  dato perdido sin aviso. Una edición parcial parte de la oferta actual (`ofertaConCambios`) al proponer Y al confirmar.
- **Un paso de onboarding se cierra con el dato vivo**, con la comprobación de su pantalla o una más estricta
  (`lib/onboarding-hechos.ts`; abajo, por qué «la misma» no era cierto).
- **`navEnCapa` no es «la capa ve esta tab»** en la capa de la plataforma (mira sólo el sidebar): para eso está
  `tabEnCapa`. `listar_tabs_por_configurar` sigue usando `navEnCapa`; no se tocó.

**Vive en:** `lib/api-mako/areas/negocio.def.ts` y `negocio.run.ts` · `lib/onboarding-pasos-api.ts` · `lib/onboarding-hechos.ts` ·
`lib/onboarding-state.ts` · `lib/oferta-modelo.ts` (`sanearOfertaInput`, `ofertaConCambios`) · `lib/ofertas.ts` (`guardarOferta`,
`usoDeOferta`) · `app/api/onboarding/ofertas/route.ts` · `lib/api-mako/rest.ts` · `tests/api-negocio-onboarding.test.ts`

*23/10/2026 · chat «API de MaKo» (claude2), agente de la revisión de la API · tests y lectura del código; no se corrió
contra la base.*

### Lo que encontró la revisión adversarial de esas cinco (mismo día, tres lentes)

Las cinco salieron con sus 12 tests en verde y la revisión encontró siete cosas reales. Las tres que importan para código
nuevo:

**6. En una operación de PANTALLA, lo que decide QUÉ fila se toca tiene que estar fijo al revisar.** `guardar_oferta` sin
id usaba el nombre como llave (lo que hace el índice único), y en /mako/revisar el nombre se edita: corregirlo cambiaba el
destino. Una propuesta que decía «Crear la oferta «Mentoría»» pisaba «Programa VIP» si alguien escribía ese nombre al
revisar, y una que decía «Editar» creaba una nueva. Lo mismo entre proponer y confirmar: si alguien creaba en pantalla una
oferta con ese nombre, el «sí» la sobrescribía. `aplicarPropuestaGenerica` sólo frena los parámetros `fijoAlRevisar`, y el
único fijo era `id`. **Arreglo: sin id, siempre se crea, y un nombre que ya existe contesta su id**
(`planDeOferta`, lib/oferta-modelo.ts, pura y con test). La otra salida, «nombre fijo al revisar», deja sin poder corregir
una errata del nombre de una oferta nueva.

**7. Un saneo que descarta en silencio + una respuesta que dice «actualizada» = una escritura que miente.** Un
`urgencia_dato` sin `urgencia_tipo` lo tiraba el saneo sin anotarlo, y la operación contestaba «Oferta actualizada» sin
haber escrito nada. Y mandar los mismos valores reescribía la fila igual. Ahora: un dato de la urgencia sin su tipo se
rechaza, lo igual a lo que hay es `yaEstaba` (por HTTP sería un 200 sin cambios), y **se rechaza sólo lo que descarta el
CAMBIO**: antes, una fila vieja con una urgencia incompleta frenaba cualquier edición por la API, con un error sobre un
campo que el agente no mandó. ⚠️ Y «ya está así» no vale sobre una fila que el saneo ARREGLA: ahí escribir sí cambia algo
(lo cazó el test nuevo antes del commit).

**8. Mudar un saneo de lugar cambió lo que guarda la pantalla, y el comentario decía lo contrario.** La ruta de ofertas
nunca escribía `modelo`. Al mudar el saneo a `sanearOfertaInput` (que lo escribe si viene uno válido, para la API), la
pantalla empezó a escribirlo: `guardarCampo` (app/onboarding/OfertasView.tsx) manda la oferta ENTERA con el modelo de
cuando cargó, así que cada campo que se guardaba ahí pisaba el que la ficha del lead o la API habían cambiado. El
comentario del saneo afirmaba «la pantalla no manda `modelo`», y el test cubría el caso que el comentario describía, no el
de la pantalla real. Arreglo: la ruta se lo saca antes (`ofertaDeLaPantalla`), con test.

Las otras cuatro, más chicas:
- **El enum publicaba catorce pasos del arranque y sólo seis se pueden cerrar** (los otros ocho salieron del arranque y
  contestan siempre «no se puede»). Ahora el enum es `PASOS_ARRANQUE_POR_API`, en positivo, y un test cruza cada paso con
  su comprobación.
- **`vg_muletillas` daba siempre cumplido**: «ninguna marcada también es una respuesta», así que no hay dato que comprobar
  y un token detallado lo cerraba en el acto. Salió de `PASOS_TAB_POR_API`.
- **«La misma comprobación que su pantalla» no era cierto en cuatro pasos**: `contexto`, `carousels_contexto`,
  `stories_contexto` y `cg_angulos` exigen el dato aunque la pantalla no. Es el lado seguro y queda así, escrito como
  «más estricto a propósito».
- **Las tres de ofertas salían por HTTP sin que nadie lo decidiera.** Pasaron a `SIN_HTTP`, como las tres de Offer: una
  oferta es lo que el dueño le contó a MaKo, y `prueba` (casos, testimonios) puede traer nombres de personas.

**Quedó SIN hacer, y dónde:**
- **`crear_oferta_lead` y `oferta_del_lead` (CRM) tocan el mismo catálogo con otra vara**: crean una oferta con precio por
  chat y salen por HTTP, mientras `guardar_oferta` exige pantalla y no sale por HTTP. `guardar_oferta` ya nombra a
  `crear_oferta_lead`; falta la otra dirección (lib/api-mako/areas/crm.def.ts) y decidir las dos juntas.
- **El puente del Copy Generator** corre sólo al confirmar un desmarcado: en un negocio donde nunca corrió, el resumen se
  arma con los pasos de antes. El «sí» vuelve a revisar con el puente corrido (negocio.run.ts, el comentario del runner).
- **`productos` cuenta los inactivos**: un catálogo con todo archivado da el paso por hecho. Es el mismo criterio que el
  chat de arranque (`listProductos()` en lib/onboarding-arranque-server.ts), así que se cambia en los dos o en ninguno.

**Vive en:** `lib/oferta-modelo.ts` (`planDeOferta`, `ofertaDeLaPantalla`, `CAMPOS_OFERTA_EDITABLES`) ·
`lib/onboarding-pasos-api.ts` (`PASOS_ARRANQUE_POR_API`) · `lib/onboarding-hechos.ts` · `app/api/onboarding/ofertas/route.ts` ·
`tests/api-negocio-onboarding.test.ts` (15 tests, cada arreglo probado rompiéndolo)

*23/10/2026 · chat «API de MaKo» (claude2) · revisión con tres lentes (seguridad, corrección, contrato), cada hallazgo
medido con un script; arreglos probados rompiéndolos.*


## Meta por Zernio en la API: elegir es un PUT, y «le manda» en una descripción se lee como un envío a una persona (25/10/2026)

**Vive en:** `lib/api-mako/areas/integraciones.def.ts` / `.run.ts` (`ver_conexion_meta`, `elegir_cuenta_meta`,
`elegir_pixel_meta`, `elegir_pagina_meta`, `probar_capi_meta`) · `lib/api-mako/rest.ts` · `tests/zernio-meta.test.ts`

- **El área Integraciones era «sólo estado» por diseño** (guardar o elegir iba por el link a la pantalla). Martín, 25/10: «todo
  MaKo se debe poder utilizar por API». La excepción es acotada: se eligen ids que la conexión de Facebook YA ve (cuenta,
  píxel, página), con su «sí»; nunca se pega un secreto. Conectar sigue siendo un clic de una persona: eso es el link.
- **Una descripción que dice «le manda MaKo las conversiones» hizo caer `tests/confirmacion-terceros.test.ts`**: el guard lee
  «le manda» como algo que le llega a OTRA persona (y exige `aTerceros`). No era un envío a nadie: se reescribió («el píxel
  donde quedan registradas las conversiones»). Una acción que de verdad no le escribe a nadie no lleva esos verbos.
- **Cada operación que sale por HTTP necesita su ruta en `RUTAS_REST`** (y el recurso sale del segundo tramo: `meta`); elegir
  es reemplazar un dato (PUT), y la prueba de CAPI es una lectura (GET con el código de «Probar eventos», que Meta muestra en
  esa pestaña y no cuenta en el píxel).
- Los ids no llevan «zernio» (`tests/sin-instagram.test.ts`).

*25/10/2026, chat «Zernio y CAPI» (`claude5`).*

## Las páginas de MaKo no se leían ni se cambiaban por la API: su texto vive en un ATRIBUTO (25/10/2026, claude5)

Martín, 25/10: «Todo, todo siempre tiene que ir a la API, todo MaKo se debe poder utilizar por API». Ese día se arregló
en la pantalla que se pudiera escribir en las secciones de las landings de MaKo (docs/hallazgos-editor-landing.md, «Las
secciones de las landings de MaKo no dejaban escribir»). Por la API pasaba lo mismo. Medido sobre la #32 en memoria, sin
escribir nada: `ver_landing_creada` devolvía **0 secciones con texto** y `cambiar_texto_landing` contestaba «No encontré…».

- **La causa:** todas las secciones de esas páginas son «Diseño editable» (`htmlEditable`), y su texto vive en el HTML de
  `attrs.html`, no en nodos hijos. `textoDe` (doc.ts) ya lo miraba, pero el lector de la API usa `textoVisible`
  (diagnostico.ts, vía `bloquesDeTexto`), que no. `planCambiarTexto` sólo recorría nodos `text`.
- **La regla:** todo código que lee o cambia el texto de una landing tiene que mirar los nodos cuyo texto vive en un
  atributo (`htmlEditable`, el `boton` de un formulario, el `titulo` de un gráfico). Para cambiarlo se usa
  html-editable-textos.ts (`textosDeHtmlEditable`/`conTextos`): cada pedazo vuelve a su lugar exacto, se escapa lo que se
  escribe, y el esqueleto del HTML queda igual byte por byte. Nunca un `split/join` sobre el HTML crudo: no encuentra
  `&amp;` y deja pasar `<b>`.
- **Lo declarado:** `ver_landing_creada` (leer) y `cambiar_texto_landing` (cambiar) cubren el «Diseño editable». Su
  descripción lo dice, `docs/api-mako.md` está regenerado y el snapshot HTTP queda igual (no se expuso nada nuevo).
  De paso, el diagnóstico de una página de MaKo ahora tiene texto para analizar.
- Test: tests/api-mako-landing-diseno-editable.test.ts, probado rompiéndolo (4 roturas, cada una cae).

## configurar_seccion_landing contestaba «listo» en una sección de diseño y no cambiaba nada (25/10/2026, claude5)

En una sección de «Diseño editable» (las páginas de MaKo), el estilo de la sección (fondo, ancho, acento, alto) se guardaba
en los atributos de la tarjeta, que lo publicado de esas secciones no lee (render.ts las publica a sangre, su HTML tal cual).
**La API decía que lo había cambiado, quedaba una versión nueva en el historial, y en la página no cambiaba nada.**

Ahora, en una sección de diseño, configurar_seccion_landing cambia SÓLO el fondo, y lo hace en su HTML
(lib/editor-landing/fondo-de-diseno.ts):
- un color, un degradado, o fondo "tema" (o restablecer) para volver exacto al del diseño;
- lo demás contesta un error que dice que es parte del diseño.
ver_secciones_landing trae el `fondo` que se ve (leído del `style` y de las reglas simples de la hoja) y `fondo_cambiado`.

**Regla:** una operación de la API sobre un dato que lo publicado no lee tiene que fallar diciendo por qué. Nunca debe
contestar «listo». Antes de exponer un atributo, mirar que el render de ESE tipo de sección lo use.

## Los íconos por la API: 75 en la #32, ninguno con nombre, y el «texto junto» que mentía (25/10/2026, claude5)

Martín, 25/10: «Los íconos también por la API». La API no leía ni cambiaba ninguno. Ahora:
- ver_secciones_landing trae los `iconos` de cada sección (n, el nombre en la biblioteca y el texto junto a él);
- cambiar_icono_landing cambia uno por número o por el de hoy;
- ver_iconos_landing busca en la biblioteca del editor.

**Lo que no era obvio:**
- **Los íconos de la #32 no tienen nombre.** Son `<svg>` de otra familia (trazo, `stroke="currentColor"`) y su color está
  en el `style` (`color:#2F6FED`). Uno que pone MaKo (el editor o la API) se reconoce por el `d` de su único `path`, que es el
  de la biblioteca. Al cambiar uno hay que conservar `style`, `width` y `class`. Si no, pierde el color: es lo que ya hacía el
  control «Ícono» del editor.
- **El texto «junto» al ícono mentía de dos maneras.** Un tramo de HTML cortado a mitad de una etiqueta se leía como texto
  (salía `<div style="aspect-ratio:1;border`). Y el texto que sigue, juntado entero, ya era de la tarjeta de al lado («Arma tu
  embudo Despega»). Ahora se corta en el último `>`, se toma el PRIMER texto que sigue (o el del botón que lo contiene), y
  si no hay, el último de antes. Ocho íconos de una grilla en «¿Qué es MaKo?» quedan sin texto: se eligen por número.
- **En una sección de bloques**, el ícono es el atributo `icono` de cada ítem de un «Diseño optimizado». Sólo se ofrecen los
  que se ven (`mostrarIconos`, o un diseño de `CON_ICONOS`, css.ts). Cambiar uno apagado sería otro «listo» sin efecto.

Lo que quedó SIN hacer: el enlace de la agenda (`[data-calendly]`) por la API. En el editor ya se cambia desde el control
«Video».

## La guarda de la doc decía «no está en git» con la doc al día: el MEGA de `execFileSync` (25/10/2026)

- **Síntoma:** `node --import tsx scripts/generar-api-doc.mjs --check` (corre en el pre-push y en Actions) dijo
  «✖ docs/api-mako.md no está en git» con el archivo commiteado y al día.
- **Causa:** el chequeo lee la versión de HEAD con `execFileSync('git', ['show', 'HEAD:docs/api-mako.md'])`, y el `maxBuffer` por
  defecto de Node es **1 MB**. La doc pasó 1 MB (1.050.185 bytes) al sumar dos operaciones: `git show` cortó con ENOBUFS, y el
  `catch` lo leyó como «no está». **El diagnóstico obvio era el equivocado:** no faltaba commitear nada.
- **La regla:** todo `execFileSync`/`execSync` que lea un archivo generado grande lleva `maxBuffer` explícito (64 MB en este).
  Cualquier artefacto que crece con el registro (la doc, el snapshot, el plugin) va a cruzar el límite un día, sin aviso.

**Vive en:** scripts/generar-api-doc.mjs. *25/10/2026 · chat «Planes» (claude5), al sumar ver_mi_prueba y empezar_mi_plan_ya.*

## Meta por Zernio en la API: elegir es un PUT, y «le manda» en una descripción se lee como un envío a una persona (25/10/2026)

**Vive en:** `lib/api-mako/areas/integraciones.def.ts` / `.run.ts` (`ver_conexion_meta`, `elegir_cuenta_meta`,
`elegir_pixel_meta`, `elegir_pagina_meta`, `probar_capi_meta`) · `lib/api-mako/rest.ts` · `tests/zernio-meta.test.ts`

- **El área Integraciones era «sólo estado» por diseño** (guardar o elegir iba por el link a la pantalla). Martín, 25/10: «todo
  MaKo se debe poder utilizar por API». La excepción es acotada: se eligen ids que la conexión de Facebook YA ve (cuenta,
  píxel, página), con su «sí»; nunca se pega un secreto. Conectar sigue siendo un clic de una persona: eso es el link.
- **Una descripción que dice «le manda MaKo las conversiones» hizo caer `tests/confirmacion-terceros.test.ts`**: el guard lee
  «le manda» como algo que le llega a OTRA persona (y exige `aTerceros`). No era un envío a nadie: se reescribió («el píxel
  donde quedan registradas las conversiones»). Una acción que de verdad no le escribe a nadie no lleva esos verbos.
- **Cada operación que sale por HTTP necesita su ruta en `RUTAS_REST`** (y el recurso sale del segundo tramo: `meta`); elegir
  es reemplazar un dato (PUT), y la prueba de CAPI es una lectura (GET con el código de «Probar eventos», que Meta muestra en
  esa pestaña y no cuenta en el píxel).
- Los ids no llevan «zernio» (`tests/sin-instagram.test.ts`).

*25/10/2026, chat «Zernio y CAPI» (`claude5`).*

## El presupuesto del turno de la app: una operación nueva deja afuera a la que la frase pedía (25/10/2026, claude5)

Al mezclar landings-2510-b en tren-k cayeron tres tests (bisecado por el Cerebro). Las operaciones nuevas
(cambiar_imagen_landing, cambiar_icono_landing, listar_videos_alojados, ver_iconos_landing) y las descripciones más largas
empujaban fuera a otras. El último en caer: con «cambia el formulario de la landing: agrega el teléfono», el turno de la
app recibía cambiar_imagen_landing y NO configurar_formulario_landing.

**Cómo arma la lista** (lib/doer-herramientas.ts → `toolsDelRegistro`, lib/api-mako/registro.ts):
- Ordena por relevancia (`ordenarPorRelevancia`): 2 puntos si una raíz está en el id o el título, 1 si está en la
  descripción. La frase va junto con las palabras que suma el clasificador (`relevancia`).
- Mete en ese orden hasta 12.000 caracteres de esquema. La que no entra se SALTEA y las siguientes pueden entrar: por eso
  una operación más corta y peor ubicada entra donde la que se pidió no.
- **Lo engañoso:** configurar_formulario_landing era la DÉCIMA. Cuando le tocaba, las nueve de antes ya sumaban 10.590 y
  ella ocupa 1.790. Achicar cambiar_imagen_landing (la que «entraba en su lugar») no servía de nada. Había que sacar 380
  caracteres de las NUEVE de antes o de ella misma. Y ver_secciones_landing había subido al puesto 7 porque su
  descripción ganó la palabra «formulario».
- **El arreglo, sin tocar el orden (es de todos):** recortar las dos del área landing. ver_secciones_landing pasó de 821 a
  671 y configurar_formulario_landing de 1.790 a 1.522, sin sacar ninguna palabra que ordena. Ahora entra con 38 de
  margen (11.962).

**Regla:** antes de sumar una operación o alargar una descripción, medir el orden REAL de las frases de su área con
`scripts/presupuesto-turno-app.mts "frase"` (posición, entra o no, largo, acumulado). Una palabra nueva en una descripción
también MUEVE el orden. El margen es chico: el de WhatsApp quedó en 11.860 de 12.000 para «quítale la animación».

**Las palabras que la eligen van en el TÍTULO (27/10/2026).** Una operación nueva con sus palabras sólo en la descripción
suma 1 punto por palabra y empata con las ya declaradas. En un empate gana la declarada antes, así que queda afuera aunque
la frase la nombre. Pasó con dar_formato_texto_landing y «pon en negrita… en mi landing». El id y el título pesan el doble.
El registro limita el título a 3–6 palabras (tests/api-mako-registro.test.ts): entran las palabras de la frase, no un
nombre largo. Medido con el turno que corre: tests/mako-intencion-landing.test.ts.

## `FallaPlan.disponibles` es `unknown`: los tests pasan y el pre-push frena (25/10/2026, claude5)

`planConfigurarBoton` (lib/api-mako/areas/landing-contenido.helpers.ts) sumaba los botones de los diseños a la lista
de `elegirBoton` con `[...(elegido.disponibles ?? [])]`. Los tests corren con tsx, que NO chequea tipos, y daban verde.
El tsc acotado del tren lo marcó como TS2488, porque `FallaPlan.disponibles` se declara `unknown` y no se puede iterar.
**Regla:** para leer `disponibles` de una falla, normalizar con `Array.isArray(x) ? x.map(String) : []`. Un verde de
tests no es un verde de tipos.

## El test de «vender un plan» falla al CARGAR si un runner nuevo va detrás del suyo (26/10/2026, claude5)

- **Síntoma:** `tests/api-mako-vender-plan.test.ts` daba «el recorte mide 7509: está mirando otra cosa», y fallaba el
  archivo entero (0 tests corridos).
- **Causa:** el test recorta `vender_plan_mako` desde su clave hasta el cierre del objeto (`\n};`) y exige menos de
  7000 caracteres. Los runners de Customers estaban DETRÁS, y cuando crecieron con el rediseño el recorte pasó el techo.
  No era el runner de vender un plan el que estaba mal.
- **Regla:** en lib/api-mako/areas/cobros.run.ts, un runner nuevo va ANTES de `vender_plan_mako`. El bloque de Customers
  se movió ahí, con un comentario que lo dice.

## Frenar «Customer Success» no frenaba los OTROS nombres viejos (27/10/2026, claude5)

**Síntoma:** MaKo mandó a Leandro a una tab que ya no existe (ticket 874749710-19). tests/clients-nombre-en-mako.test.ts ya
frenaba «Customer Success» en la API, y pasaba.

**Lo obvio era el equivocado:** buscar la palabra. El test frenaba UN nombre; los caminos viejos seguían en otros lados y
con otras palabras: «Clients › Classroom» (al revés: hoy es Classroom, con Clients adentro) en dos descripciones de la API,
«Configuraciones › Notificaciones» (hoy es Settings) en tres de equipo, en los avisos agrupados, en el pie del mail y en la
tarjeta de MaKo, y «Configuraciones › Integraciones» en los errores de Calendly.

**La regla:** el freno no es una lista de nombres prohibidos sino la barra de HOY. tests/mako-nombres-de-tabs.test.ts toma los
`label` de app/_components/nav.ts y exige que toda ruta «X › Y» del código (sin comentarios, fuera de las bitácoras) empiece por
uno de ellos. Las rutas del sistema del teléfono o la PC («Ajustes › Safari») van en una lista con su porqué. Renombrar una tab
en la barra pone en rojo cada texto que la nombra con el nombre de antes.

**Ojo:** «Configuraciones» también es el panel de la tuerca de Automations, y ahí los tests prueban que MaKo NO lo nombre (lo
muestra con el ícono). Esos textos de los tests no se tocan.

## El error de un preparar ES una guarda; la falla se marca (28/10/2026, claude4, la verificación de 692368a60)

**El síntoma:** «MaKo reembolsale a Juan el cobro 7» con el cobro sin pagar → MaKo explica la regla, marca `[[no-pude]]` y en
el grupo del CLIENTE sale «Quedó el ticket #12 para el equipo de MaKo.». Lo mismo con un «sí» tardío («No hay ninguna acción
pendiente vigente») y con «dale» sin lista en la app.

**La causa:** la marca explícita de guarda (574107963) la ponía `ejecutar.ts` sólo si el preparar traía `guarda`, `faltan`,
`yaEstaba` o `falta`, y ninguna área ponía `guarda` (grep: 0). De 1.200 `return { error }` en preparar/proponer, 890 quedaron sin
marca, y unas 734 son reglas («Sólo se reembolsa un cobro pagado», «es un pago único», «No encuentro la tarea»). Los controles
(`confirmar_accion`, `cancelar_accion`) devuelven su error como TEXTO de un control que «salió bien»: nunca pasaban por la marca.
⚠️ **El obvio, «marcar las reglas», era el equivocado:** son cientos, y la próxima regla nace sin marca. Al revés son pocas.

**La regla (lib/api-mako/ejecutar.ts):**
- el `error` de un preparar o de un proponer de pantalla ES una guarda, salvo `falla: true` (`Preparado`, `Propuesto`);
- lleva `falla: true` toda falla NUESTRA con forma de error: «No pude leer las pasarelas conectadas», y los envoltorios que
  vuelven `error` lo que reventó (`revisando` de comunidad, cs y curso; `seguro` de negocio). Son 48;
  tests/guarda-por-defecto.test.ts pide la marca en todo `return { error: 'No pude…' }` de un preparar;
- lo que REVIENTA sigue siendo falla (el catch); la pendiente que no entró, también (`noCorrio`);
- una lectura con `falta` (lo que falta conectar) es guarda, como en un preparar;
- un helper que el preparar devuelve ENTERO lleva su `falla` (cobros.run.ts: `conPasarelaConectada`, y `cobroDe`, que con la
  base caída decía «No existe el cobro» y MaKo le mentía al dueño);
- `confirmar_accion` y `cancelar_accion` (mako.run.ts) marcan lo que no se confirma. La confirmada que falla también: ya dejó
  SU ticket (`ticket`), o es una negativa del runner; el «no pude» que la sigue abría un SEGUNDO ticket. Sin ticket y con la
  falla tragada (`esFallaTragada`: no se pudo abrir el suyo), no.

**Medido con los runners reales** (C:/dev/revisiones/scratch-6923/A-refuta/caso.cts del Cerebro): T1, T2, T3 y T5 ya no abren
ticket; T4 deja uno solo (el #12 de la ejecución). Los 36 casos de tren-t dan lo mismo.

**Sin hacer:**
- Los helpers que devuelven «No pude…» y su preparar PROPAGA con `{ error: x.error }` pierden la falla y quedan como guarda
  (igual que en producción, donde todo `ok:false` era guarda): `arbolMeta`, `vocabularioParaEscribir` y `estadoVivoMeta`
  (ads.helpers.ts), `fichaDelCrm`, `crmDeEtapas` y `vinculoDeCobro` (crm.run.ts), `servicioPedido` (cs.run.ts), `funnelPedido`
  (general.run.ts), `conexionLista` (integraciones.run.ts), `copiarImagenes` (landing-editor.run.ts), `eventoValido`
  (comunidad.run.ts). Se cierra pasando el objeto entero (o `falla`) en cada preparar que los usa.
- Una lib que TIRA un mensaje legible va como 400 sin marca (ejecutar.ts, el catch): es falla aunque la lib describa un pedido
  mal hecho. Ninguna regla se lo come.
- `getLead(...).catch(() => null)` del runner viejo (mako-doer-acciones.ts, `proponer_agendar_reunion` y `proponer_cambio_etapa`)
  vuelve «No existe el lead» con `guarda: true` cuando la base se cae (como en producción).

## Las horas y los totales que lee el modelo: en la zona del negocio, con su día, y ya sumados (28/10/2026, claude4)

**El síntoma** (el diagnóstico de MaKo en WhatsApp, C:/dev/revisiones/2810-diagnostico-mako-whatsapp.md, F3), en Código
Inmobiliario:
- el 26/10, «Francisco Piñeiro Negri - Horario: 20:00 hs» cuando era a las 17:00, y «lunes 27/10» cuando era martes;
- para el mismo período, 25 no-shows y 14 sin marcar, y once minutos después, 28 y 10.

**La causa:**
- `reuniones_proximas` daba la hora como el instante de Calendly en UTC, y las fechas sin su día de la semana. El modelo no
  convertía, o convertía mal, y calculaba el día a mano. No era sólo esa herramienta: casi todas las lecturas dan instantes en
  UTC (`created_at`, `at`) y fechas sin día.
- `metricas_negocio` trae una fila TOTAL, pero al final de una tabla de 24 columnas, y sin las reuniones 1 y 2 juntas. El modelo
  sumaba los meses a mano, distinto cada vez. Ni el doer ni el runner recortan la salida: no es que la fila no llegara.

**El diagnóstico obvio era el equivocado:** arreglar `reuniones_proximas` (crm.run.ts) y pedirle al prompt que no convierta.
Son decenas de lecturas en todas las áreas, y las nuevas nacerían con el mismo defecto.

**La regla:**
- Lo que LEE el modelo pasa por UN lugar: `runnerDelRegistro` (ejecutar.ts) → `conHorasDelNegocio` (horas-del-negocio.ts). Un
  instante con zona suma AL LADO `<campo>_hora_negocio` («2026-10-27 17:00», en la hora del negocio), y toda fecha o instante
  suma `<campo>_dia_semana`, con la zona y una nota: para hablar, la de `_hora_negocio`; para pasarle un instante a otra
  herramienta, el original tal cual. Una clave `<x>_utc` suma `<x>_hora_negocio`: la que dice UTC sigue diciendo la verdad.
- ⚠️ **UN CAMPO QUE EL MODELO TIENE QUE COPIAR DE VUELTA NO SE CONVIERTE** (la verificación de b799f7ed4, 28/10/2026,
  C:/dev/revisiones/2810-verificacion-crm-horas-b799f7ed4.md). La primera versión PISABA el instante con la hora local:
  `listar_horarios_reunion` daba el startIso de Calendly como «2026-10-30 09:00», `proponer_agendar_reunion` lo compara
  carácter por carácter (lib/mako-doer-acciones.ts) y la reserva fallaba siempre; si el modelo rearmaba el instante con la
  hora local y una Z, pasaba la validación y reservaba tres horas antes. El diagnóstico obvio («F3 pidió convertir») era el
  equivocado: faltaba la hora local AL LADO, no en lugar del instante. Lo fija tests/horas-del-negocio.test.ts (6, 7 y 8).
- NO en `ejecutarOperacion`: por ahí pasan la API HTTP (un programa, que recibe los datos crudos) y el código que lee el JSON
  (centro-plan, flujo).
- Un número que el modelo tiene que decir «del período» lo suma el código y va ARRIBA (`totalesDelPeriodo`, metricas-modelo.ts),
  con lo que se pregunta junto («no-shows» son las reuniones 1 y 2).

**Sin hacer:** las lecturas que devuelven TEXTO con fechas adentro (no JSON) siguen igual; y `resumenLead`
(lib/mako-tools.ts) y las herramientas viejas del doer que no pasan por el registro.

**Vive en:** lib/api-mako/horas-del-negocio.ts · lib/api-mako/ejecutar.ts (`runnerDelRegistro`) · lib/metricas-modelo.ts ·
tests/horas-del-negocio.test.ts

## La API importaba de la carpeta de una RUTA: borrar la pantalla de Reels la tiraba abajo (29/10/2026, claude3)

- **Síntoma:** al retirar /reels (su guion es una plantilla del Copywriter) se borraron sus módulos y
  `tests/funciones-mako.test.ts` («listar_capacidades_mako por negocio y por rol») cayó con
  `Cannot find module '@/app/reels/reels-datos'`. La pantalla no tenía nada que ver con esa prueba.
- **Causa:** `lib/api-mako/areas/contenido.run.ts` importaba `estadoContextoReels` de `app/reels/reels-datos.ts`, el
  módulo de datos de la TAB. Nadie lo ve leyendo la pantalla: el enlace va de lib hacia app, al revés de lo habitual.
- **Regla:** lo que sobrevive a una pantalla no vive en su carpeta (se mudó a `lib/contexto-ig.ts`). Antes de retirar una
  ruta, `grep -rn "@/app/<ruta>/" lib worker app/api` además de buscar sus links: los imports de la API también son
  «quien la enlaza».

**Vive en:** lib/contexto-ig.ts · lib/api-mako/areas/contenido.run.ts

## Los nombres de las áreas en el índice de la API (AP1, 6/11/2026, Recorrido visual, nube, `punta/recorrido-visual`)

- «Chatbot y secuencias» y «Ads (Manager y Analyst)» eran los nombres viejos: el título del área sale de `lib/api-mako/tipos.ts`
  y de ahí a `/api-mako` y a docs/api-mako.md, que se regenera (`node --import tsx scripts/generar-api-doc.mjs`) en el mismo
  commit o el pre-push lo frena. Las CLAVES (`chatbot`) no se tocan: están en tokens y en permisos guardados.

**Vive en:** lib/api-mako/tipos.ts, app/api-mako/Articulos.tsx, docs/api-mako.md

## La página de gracias de una landing, por la API (6/11/2026, nube, barrido de pendientes)

`guardar_landing` ya asignaba los productos y la conversión de una página; faltaba `gracias` (la pantalla la marca en el paso 2 del
Pixel). Va como los otros dos: ausente no la toca (`conLanding`, lib/landing-config.ts), y el resumen de la tarjeta dice lo que hace
—quien llegue ahí pasa a Ganado en sus productos y recibe el curso si su funnel lo invita— porque la visita no prueba la compra
(lib/landing-gracias.ts) y el «sí» se da leyéndolo; si la página todavía no tiene productos, lo dice. En /mako/revisar un booleano es
un casillero: apagado y sin venir en la propuesta va `null`, que la validación descarta, así que editar los productos de una
propuesta no desmarca la de gracias.
⚠️ **Y un parámetro nuevo de una operación GRANDE también le saca el lugar a otra** (el presupuesto de 12.000 del turno de la app):
con la descripción larga del parámetro (~260 caracteres), «cambia el formulario de la landing: agrega el teléfono» dejaba de traer
`configurar_formulario_landing` y el veredicto dio rojo en tests/ops-center-clasificador-app.test.ts. Va una descripción de una
línea y se le sacó a la de la operación una frase que el código ya cumple (el link de la tarjeta): +18 caracteres en total (2057 →
2075). La regla ya estaba escrita para las operaciones nuevas; vale igual para un parámetro: se mide antes de entregar.
**Vive en:** lib/api-mako/areas/landing.def.ts y landing.run.ts · tests/api-mako-acciones-1710.test.ts
